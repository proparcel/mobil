import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PortalQueryDetail } from '../types/portal';
import {
  buildInsightRiskChips,
  buildPhysicalSupplementalRows,
  formatMorphologyTypeLabel,
  formatRoadFrontageMeters,
  resolveImportantFrontageM,
  resolveInsightMorphologyVariant,
  resolveLongestFrontageM,
  resolvePortalMorphologyLabel,
} from './portalInsightHelpers';

function baseDetail(overrides: Partial<PortalQueryDetail> = {}): PortalQueryDetail {
  return {
    snapshot_id: 1,
    id: 1,
    city_id: null,
    town_id: null,
    quarter_id: null,
    proparcel_value: null,
    tkgm_value: null,
    title: null,
    quarter_name: 'Test',
    city_name: null,
    town_name: null,
    ada: '1',
    parsel: '2',
    query_type: 'arsa',
    area_m2: 500,
    arazi_m2: 500,
    unit_price: 1000,
    total_price: 500000,
    created_at: '2026-01-01T10:00:00Z',
    thumbnail_url: null,
    dfa_json: [],
    building_params: null,
    arsa_fiyati: null,
    bina_maliyeti: null,
    ramsar_json: null,
    parcel_coords_lonlat: null,
    summary: null,
    images: { thumbnail_url: null, attachments: [] },
    expert: {
      request: null,
      responses: [],
      location: { city: null, district: null, neighborhood: null, ada: null, parsel: null },
      total_price: null,
      survey_questions: [],
    },
    requester_public: null,
    owner_card: null,
    parcel_shape_type: null,
    parcel_shape_type_label: null,
    slope_elevation_json: null,
    slope_polygons_json: null,
    prediction_json: null,
    price_selection_json: null,
    edge_measure_data: null,
    electric_values: null,
    electric_line_feature: null,
    km_recommended_price: null,
    km_analysis: null,
    is_own_query: false,
    viewer_is_staff: false,
    viewer_is_expert_user: false,
    viewer_is_expert_for_this_query: false,
    expert_price_detail: null,
    rating_summary: null,
    ...overrides,
  };
}

describe('formatRoadFrontageMeters', () => {
  it('formats tr-TR metres', () => {
    assert.equal(formatRoadFrontageMeters(253.13), '253 m');
    assert.equal(formatRoadFrontageMeters(null), '—');
  });
});

describe('resolveImportantFrontageM', () => {
  it('prefers road_v2_frontage.important_length_m', () => {
    const detail = baseDetail({
      road_v2_frontage: { important_length_m: 42.5, selected_length_m: 10 },
      road_frontage_values: { important_frontage_length_m: 99 },
    });
    assert.equal(resolveImportantFrontageM(detail), 42.5);
  });

  it('falls back to selected_length_m and road_frontage_values', () => {
    const fromSelected = baseDetail({
      road_v2_frontage: { selected_length_m: 18.2 },
    });
    assert.equal(resolveImportantFrontageM(fromSelected), 18.2);

    const fromRf = baseDetail({
      road_frontage_values: { selected_road_frontage_length_m: 33.3 },
    });
    assert.equal(resolveImportantFrontageM(fromRf), 33.3);
  });
});

describe('resolveLongestFrontageM', () => {
  it('prefers road_v2_frontage.longest_length_m', () => {
    const detail = baseDetail({
      road_v2_frontage: { longest_length_m: 120.4 },
      road_frontage_values: { longest_frontage_length_m: 80 },
    });
    assert.equal(resolveLongestFrontageM(detail), 120.4);
  });

  it('falls back to accepted_parallel_roads max and edges max', () => {
    const fromAccepted = baseDetail({
      road_frontage_values: {
        accepted_parallel_roads: [
          { frontage: { length_m: 55.1 } },
          { frontage: { length_m: 88.9 } },
        ],
      },
    });
    assert.equal(resolveLongestFrontageM(fromAccepted), 88.9);

    const fromEdges = baseDetail({
      road_v2_frontage: {
        edges: [{ length_m: 12 }, { length_m: 67.5 }],
      },
    });
    assert.equal(resolveLongestFrontageM(fromEdges), 67.5);
  });
});

describe('buildPhysicalSupplementalRows', () => {
  it('orders Önemli → Uzun → Toplam → Cephe Sayısı', () => {
    const detail = baseDetail({
      road_v2: true,
      road_v2_frontage: {
        face_count: 3,
        important_length_m: 40,
        longest_length_m: 95,
        total_length_m: 180,
      },
      road_frontage_values: { road_v2: true, frontage_count: 3 },
    });
    const rows = buildPhysicalSupplementalRows({ summary: detail, analysis: null, slopePct: null });
    assert.deepEqual(
      rows.slice(0, 4).map((r) => r.label),
      ['Önemli Cephe', 'Uzun Cephe', 'Toplam Yol Cephesi', 'Cephe Sayısı'],
    );
    assert.equal(rows[0].value, '40 m');
    assert.equal(rows[1].value, '95 m');
    assert.equal(rows[2].value, '180 m');
    assert.equal(rows[3].value, '3 / Yarım Ada');
  });
});

describe('formatMorphologyTypeLabel', () => {
  it('title-cases tr-TR morphology labels', () => {
    assert.equal(formatMorphologyTypeLabel('tepe', 'TEPE'), 'Tepe');
    assert.equal(formatMorphologyTypeLabel('vadi', null), 'Vadi');
    assert.equal(formatMorphologyTypeLabel(null, null), '—');
  });
});

describe('resolvePortalMorphologyLabel', () => {
  it('prefers slope section context_morphology_json', () => {
    const detail = baseDetail();
    const label = resolvePortalMorphologyLabel(detail, {
      context_morphology_json: {
        morphology: { type: 'tepe', type_label: 'Tepe' },
      },
    });
    assert.equal(label, 'Tepe');
  });

  it('falls back to summary slopeSummary morphology fields', () => {
    const detail = baseDetail({
      slopeSummary: { morphology_type: 'vadi', morphology_label: 'Vadi' },
    });
    assert.equal(resolvePortalMorphologyLabel(detail), 'Vadi');
  });
});

describe('resolveInsightMorphologyVariant', () => {
  it('marks cukur and vadi as alert', () => {
    assert.equal(resolveInsightMorphologyVariant('cukur'), 'alert');
    assert.equal(resolveInsightMorphologyVariant('vadi'), 'alert');
    assert.equal(resolveInsightMorphologyVariant('tepe'), 'normal');
  });
});

describe('buildInsightRiskChips', () => {
  it('does not include slope chip', () => {
    const chips = buildInsightRiskChips({
      summary: baseDetail(),
      analysis: { ramsar_wetland: false, high_voltage_line: false },
      slopePct: 25,
    });
    assert.equal(
      chips.some((chip) => chip.key === 'slope'),
      false,
    );
    assert.equal(chips.length, 4);
  });
});
