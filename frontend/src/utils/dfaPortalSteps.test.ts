import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildStructureValuationStoryRows,
  mapMahalleOrtSimulationToFooter,
  mahalleOrtWrittenPriceMatchesInput,
  normalizeBuildingStoryStepLabel,
  parseMahalleOrtInput,
  resolveMahalleOrtDisplaySimulation,
} from './dfaPortalSteps';
import type { PortalQueryDetail } from '../types/portal';

describe('dfaPortalSteps', () => {
  it('parseMahalleOrtInput accepts TR formatted numbers', () => {
    assert.equal(parseMahalleOrtInput('12.000'), 12000);
    assert.equal(parseMahalleOrtInput('12500'), 12500);
  });

  it('resolveMahalleOrtDisplaySimulation prefers db_simulation', () => {
    const sim = resolveMahalleOrtDisplaySimulation({
      simulation: { user_unit_m2: 16000 },
      db_simulation: { user_unit_m2: 12000 },
    });
    assert.equal(sim?.user_unit_m2, 12000);
  });

  it('mapMahalleOrtSimulationToFooter uses db_simulation base for expert bildir', () => {
    const footer = mapMahalleOrtSimulationToFooter({
      user_unit_m2: 12000,
      simulated_final_unit_m2: 15000,
      simulated_land_total_tl: 600000,
      applied_percent_label: '+25%',
      is_structure_query: false,
    });
    assert.equal(footer?.startUnit, 12000);
    assert.equal(footer?.endUnit, 15000);
  });

  it('mahalleOrtWrittenPriceMatchesInput validates direct write', () => {
    assert.equal(
      mahalleOrtWrittenPriceMatchesInput(
        { db_saved: true, saved_m2_price: 12000, db_simulation: { user_unit_m2: 12000 } },
        12000,
      ),
      true,
    );
    assert.equal(
      mahalleOrtWrittenPriceMatchesInput(
        { db_saved: true, saved_m2_price: 16000, db_simulation: { user_unit_m2: 16000 } },
        12000,
      ),
      false,
    );
  });

  it('normalizeBuildingStoryStepLabel shortens legacy API notes', () => {
    assert.equal(normalizeBuildingStoryStepLabel('building_formula', 'Bina yaşına göre birleştirildi (16_plus)'), 'Bina yaşı etkisi');
    assert.equal(
      normalizeBuildingStoryStepLabel(
        'building_cost_landscape_multiplier',
        'Yapı maliyeti hesabına — Peyzaj etkisi: +%3',
      ),
      'Peyzaj',
    );
    assert.equal(normalizeBuildingStoryStepLabel('building_cost_cost_multiplier', ''), 'Alt tip / maliyet');
  });

  it('buildStructureValuationStoryRows matches structure query #1165 parity', () => {
    const detail = {
      bina_maliyeti: 2168150,
      building_dfa_json: [
        { key: 'building_inputs', applied_factor: 1, title: 'Başlangıç' },
        {
          key: 'building_cost_landscape_multiplier',
          applied_factor: 1.03,
          note: 'Yapı maliyeti hesabına — Peyzaj etkisi: +%3',
        },
        {
          key: 'building_cost_cost_multiplier',
          applied_factor: 1.03,
          note: 'Yapı maliyeti hesabına — Alt tip etkisi: +%3',
        },
        {
          key: 'building_formula',
          applied_factor: 0.2,
          note: 'Bina yaşına göre birleştirildi (16_plus)',
        },
      ],
      valuation_layers_summary: {
        land: {
          label: 'Arazi',
          start_unit_m2: 15000,
          end_unit_m2: 13350,
          total_tl: 6168455,
        },
        structure: {
          cost_tl: 2168150,
          structure_share_tl: 433630,
        },
        delivery: {
          label: 'Toplam değer',
          total_tl: 6602085,
        },
      },
    } as unknown as PortalQueryDetail;

    const rows = buildStructureValuationStoryRows(detail);
    assert.ok(rows);

    const land = rows!.find((r) => r.key === 'land');
    assert.equal(land?.effect, '-%11');
    assert.equal(land?.total, 6168455);

    const start = rows!.find((r) => r.label === 'Yapı Başlangıç Fiyatı');
    assert.equal(start?.effect, '%0');
    assert.equal(start?.total, 2168150);

    const peyzaj = rows!.find((r) => r.label === 'Peyzaj');
    assert.equal(peyzaj?.effect, '+%3');
    assert.equal(peyzaj?.total, null);

    const altTip = rows!.find((r) => r.label === 'Alt tip / maliyet');
    assert.equal(altTip?.effect, '+%3');
    assert.equal(altTip?.total, null);

    const age = rows!.find((r) => r.label === 'Bina yaşı etkisi');
    assert.equal(age?.effect, '-%80');
    assert.equal(age?.total, 433630);

    const delivery = rows!.find((r) => r.key === 'delivery');
    assert.equal(delivery?.total, 6602085);
    assert.equal((land?.total ?? 0) + (age?.total ?? 0), delivery?.total);
  });
});
