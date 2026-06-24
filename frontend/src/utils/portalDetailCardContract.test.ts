import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PortalQueryDetail } from '../types/portal';
import {
  buildParcelInfoRows,
  buildPriceInfoRows,
  buildStructureInfoRows,
  isStructurePortalQueryType,
  mergeSupplementalIntoParcelRows,
} from './portalDetailCardContract';
import {
  buildPhysicalSupplementalRows,
  resolveImportantFrontageM,
  resolveLongestFrontageM,
  resolveRoadFrontageFaceCount,
  resolveRoadFrontageTotalLengthM,
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
          cost_factors: [{ label: 'Peyzaj', multiplier: 1.08, applied_pct: '+%8' }],
        },
        building_params: {
          Peyzaj: 'Evet',
          'İnşaat Alanı (m²)': 220,
        },
      }),
    );
    const map = Object.fromEntries(rows);
    assert.equal(map['İnşaat m²'], '220 m²');
    assert.equal(map.Peyzaj, '+%8');
    assert.equal(map['Peyzaj çarpanı'], undefined);
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

describe('RoadV2 frontage contract readers', () => {
  const roadV2Detail = baseDetail({
    query_type: 'arsa',
    road_v2: true,
    road_v2_frontage: {
      face_count: 4,
      edge_labels: ['a', 'b', 'c', 'd'],
      total_length_m: 253.13,
    },
    road_frontage_values: {
      road_v2: true,
      total_road_frontage_edge_length_m: 100,
      frontage_count: 1,
    },
    edge_measure_data: {
      total_road_frontage_edge_length_m: 50,
    },
  });

  it('prefers road_v2_frontage face_count and total_length_m', () => {
    assert.equal(resolveRoadFrontageFaceCount(roadV2Detail), 4);
    assert.equal(resolveRoadFrontageTotalLengthM(roadV2Detail), 253.13);
  });

  it('buildParcelInfoRows does not inline road frontage (supplemental merge)', () => {
    const rows = buildParcelInfoRows(roadV2Detail, { queryTypeLabel: 'Arsa' });
    const labels = rows.map(([l]) => l);
    assert.ok(!labels.some((l) => /yola cephe|yol cephesi/i.test(l)));
    assert.ok(!labels.includes('Toplam Yol Cephesi'));
  });

  it('mergeSupplementalIntoParcelRows inserts frontage rows after Ada/Parsel', () => {
    const core = buildParcelInfoRows(roadV2Detail, { queryTypeLabel: 'Arsa' });
    const supplemental = buildPhysicalSupplementalRows({
      summary: roadV2Detail,
      analysis: null,
      slopePct: null,
    });
    const merged = mergeSupplementalIntoParcelRows(core, supplemental);
    const labels = merged.map(([l]) => l);
    const adaIdx = labels.findIndex((l) => /ada.*parsel/i.test(l));
    assert.ok(adaIdx >= 0);
    assert.equal(labels[adaIdx + 1], 'Önemli Cephe');
    assert.equal(labels[adaIdx + 2], 'Uzun Cephe');
    assert.equal(labels[adaIdx + 3], 'Toplam Yol Cephesi');
    assert.equal(labels[adaIdx + 4], 'Cephe Sayısı');
    const map = Object.fromEntries(merged);
    assert.equal(map['Toplam Yol Cephesi'], '253 m');
  });

  it('falls back to legacy fields when RoadV2 is absent', () => {
    const legacy = baseDetail({
      query_type: 'arsa',
      road_frontage_values: {
        total_road_frontage_edge_length_m: 88.5,
        frontage_count: 2,
      },
    });
    assert.equal(resolveRoadFrontageTotalLengthM(legacy), 88.5);
    assert.equal(resolveRoadFrontageFaceCount(legacy), 2);
  });

  it('buildPriceInfoRows uses valuation_layers_summary for structure queries', () => {
    const detail = baseDetail({
      query_type: 'villa',
      viewer_can_see_structure_cost_breakdown: true,
      bina_maliyeti: 2168150,
      arsa_fiyati: 12000000,
      total_price: 6602085,
      valuation_layers_summary: {
        land: { total_tl: 6168455 },
        structure: { structure_share_tl: 433630, cost_tl: 2168150 },
        delivery: { total_tl: 6602085 },
      },
    });
    const rows = buildPriceInfoRows(detail);
    const labels = rows.map(([label]) => label);
    assert.ok(labels.includes('Arazi maliyeti'));
    assert.ok(labels.includes('Yapı payı'));
    assert.equal(labels.includes('Villa maliyeti'), false);
    const landRow = rows.find(([label]) => label === 'Arazi maliyeti');
    const shareRow = rows.find(([label]) => label === 'Yapı payı');
    const totalRow = rows.find(([label]) => label === 'Toplam fiyat (TL)');
    assert.match(String(landRow?.[1]), /6\.168\.455/);
    assert.match(String(shareRow?.[1]), /433\.630/);
    assert.match(String(totalRow?.[1]), /6\.602\.085/);
  });
});
