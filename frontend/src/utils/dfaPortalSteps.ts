/**
 * Mahalle ort. DFA adımları + yapı değerleme hikâyesi — web `dfaPortalSteps.js` portu.
 */

import type { MahalleOrtSignalResponse, MahalleOrtSimulationPayload, PortalQueryDetail } from '../types/portal';
import {
  applyMahalleOrtSimulationToValuationLayers,
  buildDfaRowsFromSteps,
  unitDeltaToAppliedPct,
  type PortalDfaSimulatedFooter,
} from './portalDfaHelpers';

export type StructureValuationStoryRow = {
  kind: 'land-summary' | 'building-detail' | 'delivery-total';
  key: string;
  label: string;
  startUnit: number | null | undefined;
  endUnit: number | null | undefined;
  effect: string | null;
  total: number | null | undefined;
  tone: 'neutral' | 'positive' | 'negative';
};

function normalizeMahalleOrtNumericInput(cleaned: string): string {
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  }
  if (cleaned.includes(',')) {
    if (cleaned.indexOf(',') !== cleaned.lastIndexOf(',')) {
      return cleaned.replace(/,/g, '');
    }
    const commaParts = cleaned.split(',');
    if (
      commaParts.length === 2 &&
      commaParts[1].length === 3 &&
      /^\d+$/.test(commaParts[0]) &&
      /^\d+$/.test(commaParts[1])
    ) {
      return commaParts[0] + commaParts[1];
    }
    return cleaned.replace(',', '.');
  }
  const dotCount = (cleaned.match(/\./g) || []).length;
  if (dotCount > 1) {
    return cleaned.replace(/\./g, '');
  }
  if (dotCount === 1) {
    const parts = cleaned.split('.');
    if (
      parts.length === 2 &&
      parts[1].length === 3 &&
      /^\d+$/.test(parts[0]) &&
      /^\d+$/.test(parts[1])
    ) {
      return parts[0] + parts[1];
    }
  }
  return cleaned;
}

/** TR sayı girişi: 37.459 / 37459 / 37,459 */
export function parseMahalleOrtInput(raw: string): number | null {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;
  const normalized = normalizeMahalleOrtNumericInput(cleaned);
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toOptionalNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** API simulation → DFA özet kartı footer state. */
export function mapMahalleOrtSimulationToFooter(
  simulation: MahalleOrtSimulationPayload | Record<string, unknown> | null | undefined,
): PortalDfaSimulatedFooter | null {
  if (!simulation || typeof simulation !== 'object') {
    return null;
  }
  const isStructure = Boolean(simulation.is_structure_query);
  const startUnit = toOptionalNumber(simulation.user_unit_m2);
  const endUnit = toOptionalNumber(simulation.simulated_final_unit_m2);
  const landTotal = toOptionalNumber(simulation.simulated_land_total_tl);
  const deliveryTotal = toOptionalNumber(simulation.simulated_delivery_total_tl);
  return {
    startUnit,
    endUnit,
    total: isStructure ? deliveryTotal : landTotal,
    appliedPercent:
      typeof simulation.applied_percent_label === 'string' && simulation.applied_percent_label.trim()
        ? simulation.applied_percent_label
        : '—',
    landTotal,
    deliveryTotal,
    isStructureQuery: isStructure,
  };
}

/** Expert Bildir sonrası db_simulation öncelikli (web ile aynı). */
export function resolveMahalleOrtDisplaySimulation(
  body: Pick<MahalleOrtSignalResponse, 'db_simulation' | 'simulation'> | null | undefined,
): MahalleOrtSimulationPayload | undefined {
  if (!body) return undefined;
  return body.db_simulation ?? body.simulation;
}

export function mahalleOrtWrittenPriceMatchesInput(
  body: MahalleOrtSignalResponse,
  inputUnit: number,
  tolerance = 1,
): boolean {
  const sim = resolveMahalleOrtDisplaySimulation(body);
  const written =
    toOptionalNumber(body.saved_m2_price) ??
    toOptionalNumber(body.written_m2_price) ??
    toOptionalNumber(sim?.user_unit_m2);
  if (written == null) return true;
  return Math.abs(written - inputUnit) <= tolerance;
}

/** Eski snapshot building_dfa_json notalarını kısa Katman etiketlerine çevirir. */
export function normalizeBuildingStoryStepLabel(stepKey: string, description: string): string {
  const key = String(stepKey || '').trim();
  if (key === 'building_formula') {
    return 'Bina yaşı etkisi';
  }
  const costLabels: Record<string, string> = {
    building_cost_quality_multiplier: 'Kalite',
    building_cost_pool_multiplier: 'Havuz',
    building_cost_landscape_multiplier: 'Peyzaj',
    building_cost_cost_multiplier: 'Alt tip / maliyet',
  };
  if (costLabels[key]) {
    return costLabels[key];
  }
  if (key.startsWith('building_cost_')) {
    let plain = String(description || '').trim();
    plain = plain.replace(/^Yapı maliyeti hesabına\s*[—–-]\s*/i, '');
    plain = plain.replace(/\s*etkisi:\s*[+-]?%[\d.,]+$/i, '').trim();
    plain = plain.replace(/\s+etkisi$/i, '').trim();
    if (plain) return plain;
  }
  if (/birleştirildi/i.test(description || '')) {
    return 'Bina yaşı etkisi';
  }
  return description;
}

/**
 * Yapı sorgusu — birleşik değerleme tablosu satırları.
 * Sıra: arazi özeti → yapı adımları → toplam değer (ara yapı özeti satırı yok).
 */
export function buildStructureValuationStoryRows(
  summary: PortalQueryDetail | null | undefined,
  simulatedLand: PortalDfaSimulatedFooter | null = null,
): StructureValuationStoryRow[] | null {
  const baseLayers = summary?.valuation_layers_summary;
  if (!baseLayers || typeof baseLayers !== 'object') {
    return null;
  }

  const layers = applyMahalleOrtSimulationToValuationLayers(baseLayers, simulatedLand);
  if (!layers) {
    return null;
  }

  const land = layers.land || {};
  const structure = layers.structure || {};
  const delivery = layers.delivery || {};

  const landEffect = unitDeltaToAppliedPct(land.start_unit_m2, land.end_unit_m2);
  const structureCostTl = structure.cost_tl;
  let structureShareTl = structure.structure_share_tl;
  const landTotal = land.total_tl;
  const deliveryTotal = delivery.total_tl;
  if (structureShareTl == null && deliveryTotal != null && landTotal != null) {
    structureShareTl = deliveryTotal - landTotal;
  }

  const steps = Array.isArray(summary?.building_dfa_json) ? summary.building_dfa_json : [];
  const buildingRows = buildDfaRowsFromSteps(steps);

  const rows: StructureValuationStoryRow[] = [
    {
      kind: 'land-summary',
      key: 'land',
      label: land.label || 'Arazi',
      startUnit: land.start_unit_m2,
      endUnit: land.end_unit_m2,
      effect: landEffect !== '—' ? landEffect : land.applied_pct || '—',
      total: land.total_tl,
      tone: 'neutral',
    },
  ];

  for (const row of buildingRows) {
    const stepKey = String(row.stepKey || '').trim();

    if (stepKey === 'building_inputs') {
      const startCost =
        structureCostTl != null
          ? structureCostTl
          : summary?.bina_maliyeti != null && summary.bina_maliyeti !== ''
            ? Number(summary.bina_maliyeti)
            : null;

      rows.push({
        kind: 'building-detail',
        key: row.key,
        label: 'Yapı Başlangıç Fiyatı',
        startUnit: null,
        endUnit: null,
        effect: '%0',
        total: Number.isFinite(startCost) ? startCost : null,
        tone: 'neutral',
      });
      continue;
    }

    let total: number | null = null;
    let effect = row.percent;
    let tone = row.tone;
    if (stepKey === 'building_formula') {
      if (structureShareTl != null) {
        total = structureShareTl;
      }
      const startCost =
        structureCostTl != null
          ? structureCostTl
          : summary?.bina_maliyeti != null && summary.bina_maliyeti !== ''
            ? Number(summary.bina_maliyeti)
            : null;
      if (
        structureShareTl != null &&
        startCost != null &&
        Number.isFinite(startCost) &&
        startCost > 0
      ) {
        effect = unitDeltaToAppliedPct(startCost, structureShareTl);
        const shareRatio = structureShareTl / startCost;
        tone = shareRatio > 1 ? 'positive' : shareRatio < 1 ? 'negative' : 'neutral';
      }
    }

    rows.push({
      kind: 'building-detail',
      key: row.key,
      label: normalizeBuildingStoryStepLabel(stepKey, row.description),
      startUnit: null,
      endUnit: null,
      effect,
      total,
      tone,
    });
  }

  rows.push({
    kind: 'delivery-total',
    key: 'delivery',
    label: delivery.label || 'Toplam değer',
    startUnit: null,
    endUnit: null,
    effect: null,
    total: delivery.total_tl,
    tone: 'neutral',
  });

  return rows;
}
