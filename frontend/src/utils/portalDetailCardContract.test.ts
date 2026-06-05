import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PortalQueryDetail } from '../types/portal';
import {
  buildParcelInfoRows,
  buildStructureInfoRows,
  isStructurePortalQueryType,
} from './portalDetailCardContract';

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
    quarter_name: 'Test Mahalle',
    city_name: null,
    town_name: null,
    ada: '1',
    parsel: '2',
    query_type: 'villa',
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

describe('isStructurePortalQueryType', () => {
  it('returns true for extended structure types', () => {
    for (const qt of ['ciftlik_ev', 'konut_daire', 'ticari', 'commercial']) {
      assert.equal(isStructurePortalQueryType(qt), true);
    }
  });

  it('returns false for tarla', () => {
    assert.equal(isStructurePortalQueryType('tarla'), false);
  });
});

describe('buildParcelInfoRows', () => {
  it('does not include bina brüt or building_params loop fields for pro villa', () => {
    const rows = buildParcelInfoRows(
      baseDetail({
        query_type: 'villa',
        building_params: {
          'İnşaat Alanı (m²)': 220,
          'Bina Yaşı': 5,
          Kalite: 'İyi',
          Peyzaj: 'Evet',
        },
        listing_attributes: {
          building_gross_m2: 220,
        },
      }),
      { queryTypeLabel: 'Villa' },
    );
    const labels = rows.map(([l]) => l);
    assert.ok(labels.includes('Arazi Alanı'));
    assert.ok(!labels.some((l) => /bina brüt/i.test(l)));
    assert.ok(!labels.includes('Bina Yaşı'));
    assert.ok(!labels.includes('Kalite'));
    assert.ok(!labels.includes('Peyzaj'));
  });
});

describe('buildStructureInfoRows', () => {
  it('includes construction m2 and peyzaj multiplier without duplicate peyzaj evet', () => {
    const rows = buildStructureInfoRows(
      baseDetail({
        query_type: 'villa',
        viewer_can_see_structure_cost_breakdown: true,
        structure_price_summary: {
          construction_area_m2: 220,
          cost_factors: [{ label: 'Peyzaj çarpanı', multiplier: 1.08 }],
        },
        building_params: {
          Peyzaj: 'Evet',
          'İnşaat Alanı (m²)': 220,
        },
      }),
    );
    const map = Object.fromEntries(rows);
    assert.equal(map['İnşaat m²'], '220 m²');
    assert.equal(map['Peyzaj çarpanı'], '×1.08');
    assert.equal(map.Peyzaj, undefined);
    assert.equal(map['İnşaat Alanı (m²)'], undefined);
  });

  it('does not fall back to area_m2 for construction m2', () => {
    const rows = buildStructureInfoRows(
      baseDetail({
        query_type: 'villa',
        area_m2: 500,
        arazi_m2: 500,
        structure_price_summary: null,
        building_params: { Kalite: 'İyi' },
      }),
    );
    assert.ok(!rows.some(([label]) => label === 'İnşaat m²'));
  });

  it('returns empty rows for tarla', () => {
    assert.deepEqual(buildStructureInfoRows(baseDetail({ query_type: 'tarla' })), []);
  });
});
