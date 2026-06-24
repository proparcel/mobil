import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeGeometryCoordinates, shouldSwapLatLonForTurkey } from './geoCoordNormalize';

describe('shouldSwapLatLonForTurkey', () => {
  it('Sivas TKGM [lat, lon] swap edilir', () => {
    assert.equal(shouldSwapLatLonForTurkey(39.7, 37.0), true);
  });

  it('Sivas Mapbox [lon, lat] swap edilmez', () => {
    assert.equal(shouldSwapLatLonForTurkey(37.0, 39.7), false);
  });

  it('İstanbul [lon, lat] swap edilmez', () => {
    assert.equal(shouldSwapLatLonForTurkey(29.0, 41.0), false);
  });

  it('İstanbul TKGM [lat, lon] swap edilir', () => {
    assert.equal(shouldSwapLatLonForTurkey(41.0, 29.0), true);
  });

  it('Kars [lon, lat] swap edilmez', () => {
    assert.equal(shouldSwapLatLonForTurkey(43.1, 40.6), false);
  });

  it('Kars TKGM [lat, lon] swap edilir', () => {
    assert.equal(shouldSwapLatLonForTurkey(40.6, 43.1), true);
  });
});

describe('normalizeGeometryCoordinates', () => {
  it('Sivas [lon, lat] poligonu olduğu gibi kalır', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[[37.0, 39.7], [37.01, 39.7], [37.01, 39.71], [37.0, 39.7]]],
    };
    const normalized = normalizeGeometryCoordinates(geometry);
    assert.deepEqual(normalized.coordinates[0][0], [37.0, 39.7]);
  });

  it('Sivas [lat, lon] poligonu [lon, lat] olur', () => {
    const geometry = {
      type: 'Polygon',
      coordinates: [[[39.7, 37.0], [39.7, 37.01], [39.71, 37.01], [39.7, 37.0]]],
    };
    const normalized = normalizeGeometryCoordinates(geometry);
    assert.deepEqual(normalized.coordinates[0][0], [37.0, 39.7]);
  });
});
