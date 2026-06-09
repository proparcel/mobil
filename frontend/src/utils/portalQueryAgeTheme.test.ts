import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeQueryAgeElapsedDays,
  getQueryAgeVisualTier,
} from './portalQueryAgeTheme';

/** TR öğlen 12:00 → UTC 09:00 */
function trNoonUtc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 9, 0, 0));
}

describe('computeQueryAgeElapsedDays', () => {
  const created = '2026-01-01T10:30:00+03:00';

  it('returns 0 on creation day', () => {
    assert.equal(computeQueryAgeElapsedDays(created, trNoonUtc(2026, 1, 1)), 0);
  });

  it('returns 9 on day 10', () => {
    assert.equal(computeQueryAgeElapsedDays(created, trNoonUtc(2026, 1, 10)), 9);
  });

  it('returns 10 on day 11', () => {
    assert.equal(computeQueryAgeElapsedDays(created, trNoonUtc(2026, 1, 11)), 10);
  });

  it('returns 20 on day 21', () => {
    assert.equal(computeQueryAgeElapsedDays(created, trNoonUtc(2026, 1, 21)), 20);
  });

  it('returns 30 on day 31', () => {
    assert.equal(computeQueryAgeElapsedDays(created, trNoonUtc(2026, 1, 31)), 30);
  });

  it('returns -1 for invalid input', () => {
    assert.equal(computeQueryAgeElapsedDays(null), -1);
    assert.equal(computeQueryAgeElapsedDays('not-a-date'), -1);
  });
});

describe('getQueryAgeVisualTier', () => {
  const created = '2026-01-01T10:30:00+03:00';

  it('returns default for days 1–10', () => {
    assert.equal(getQueryAgeVisualTier(created, trNoonUtc(2026, 1, 1)), 'default');
    assert.equal(getQueryAgeVisualTier(created, trNoonUtc(2026, 1, 10)), 'default');
  });

  it('returns yellow for days 11–20', () => {
    assert.equal(getQueryAgeVisualTier(created, trNoonUtc(2026, 1, 11)), 'yellow');
    assert.equal(getQueryAgeVisualTier(created, trNoonUtc(2026, 1, 20)), 'yellow');
  });

  it('returns red for days 21–30', () => {
    assert.equal(getQueryAgeVisualTier(created, trNoonUtc(2026, 1, 21)), 'red');
    assert.equal(getQueryAgeVisualTier(created, trNoonUtc(2026, 1, 30)), 'red');
  });

  it('returns default after 30 days', () => {
    assert.equal(getQueryAgeVisualTier(created, trNoonUtc(2026, 1, 31)), 'default');
    assert.equal(getQueryAgeVisualTier(created, trNoonUtc(2026, 2, 15)), 'default');
  });
});
