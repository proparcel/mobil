import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('buildContextMorphologyDisplay', () => {
  it('uses context_morphology_json morphology and elevations', async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const { buildContextMorphologyDisplay } = await import('./slopeTerrainHelpers');
    const result = buildContextMorphologyDisplay(
      {
        morphology: { type: 'tepe', type_label: 'Tepe', confidence: 0.82 },
        elevations: {
          parcel_mean_m: 412.4,
          sides: [{ delta_m: 6.2 }, { delta_m: -4.1 }],
        },
      },
      null,
    );
    assert.equal(result.type_label, 'Tepe');
    assert.equal(result.type, 'tepe');
    assert.equal(result.confidence, 0.82);
    assert.equal(result.parcel_mean_m, 412.4);
    assert.equal(result.height_spread, 12.4);
  });

  it('falls back to legacy elevation_morphology', async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const { buildContextMorphologyDisplay } = await import('./slopeTerrainHelpers');
    const result = buildContextMorphologyDisplay(null, {
      type: 'vadi',
      type_label: 'Vadi',
      confidence: 0.71,
    });
    assert.equal(result.type_label, 'Vadi');
    assert.equal(result.type, 'vadi');
    assert.equal(result.confidence, 0.71);
  });

  it('returns dashes when no data', async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const { buildContextMorphologyDisplay } = await import('./slopeTerrainHelpers');
    const result = buildContextMorphologyDisplay(null, null);
    assert.equal(result.type_label, '—');
    assert.equal(result.type, '—');
    assert.equal(result.confidence, null);
  });
});
