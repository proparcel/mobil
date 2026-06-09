import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ParcelTerrain3d } from '../../../src/types/portal';
import { validateTerrainPayload } from './validateTerrainPayload';

function basePayload(overrides: Partial<ParcelTerrain3d> = {}): ParcelTerrain3d {
  return {
    version: 1,
    type: 'parcel_terrain_3d',
    parcel: {
      center: { lat: 40, lon: 29 },
      localPolygon: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }],
    },
    terrain: {
      gridType: 'regular',
      width: 2,
      height: 2,
      cellSizeM: 1,
      origin: { x: 0, z: 0 },
      elevations: [100, 101, 102, 103],
      slopes: [5, 6, 7, 8],
      mask: [1, 1, 1, 1],
    },
    stats: { schemaVersion: 2, displaySlopeUnit: 'percent' },
    render: {
      slopeColorStops: [{ maxSlopeDeg: 10, label: 'Düz', color: '#4CAF50' }],
    },
    ...overrides,
  };
}

test('validateTerrainPayload accepts valid grid', () => {
  assert.equal(validateTerrainPayload(basePayload()), null);
});

test('validateTerrainPayload rejects length mismatch', () => {
  const p = basePayload();
  p.terrain.elevations = [100];
  assert.match(validateTerrainPayload(p) ?? '', /uyuşmuyor/i);
});

test('validateTerrainPayload rejects wrong type', () => {
  const p = basePayload();
  (p as { type: string }).type = 'other';
  assert.match(validateTerrainPayload(p as ParcelTerrain3d) ?? '', /tip/i);
});

test('buildMockParcelTerrain3d passes validation', async () => {
  const { buildMockParcelTerrain3d } = await import('./mockParcelTerrain3d');
  const payload = buildMockParcelTerrain3d({ ada: '1', parsel: '2' });
  assert.equal(validateTerrainPayload(payload), null);
  assert.equal(payload.parcel.localPolygon.length >= 3, true);
  assert.equal(payload.terrain.mask.filter((m) => m === 1).length > 0, true);
});
