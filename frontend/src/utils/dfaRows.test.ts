import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatParcelAreaDisplay,
  parseAreaM2,
  pickParcelAreaRaw,
  resolveParcelAreaM2,
} from './dfaRows';

describe('parseAreaM2', () => {
  it('parses Turkish thousands with comma decimals', () => {
    assert.equal(parseAreaM2('2.450,00'), 2450);
    assert.equal(parseAreaM2('500,00'), 500);
  });

  it('parses Turkish thousands dot without comma', () => {
    assert.equal(parseAreaM2('1.556'), 1556);
    assert.equal(parseAreaM2('1.556,00'), 1556);
  });

  it('parses English/API decimal dot', () => {
    assert.equal(parseAreaM2('500.00'), 500);
    assert.equal(parseAreaM2('500.0'), 500);
  });

  it('parses plain numbers', () => {
    assert.equal(parseAreaM2('500'), 500);
    assert.equal(parseAreaM2(1556), 1556);
    assert.equal(parseAreaM2('1556 m²'), 1556);
  });
});

describe('resolveParcelAreaM2', () => {
  it('uses numeric alan like ParcelModal bottom sheet', () => {
    assert.equal(resolveParcelAreaM2(1556), 1556);
    assert.equal(resolveParcelAreaM2(500), 500);
    assert.equal(resolveParcelAreaM2('500.00'), 500);
  });
});

describe('formatParcelAreaDisplay', () => {
  it('formats reported bug cases correctly', () => {
    assert.equal(formatParcelAreaDisplay(1556), '1.556 m²');
    assert.equal(formatParcelAreaDisplay(500), '500 m²');
    assert.equal(formatParcelAreaDisplay('500.00'), '500 m²');
  });
});

describe('pickParcelAreaRaw', () => {
  it('prefers alan over yuzolcum like ParcelModal', () => {
    assert.equal(pickParcelAreaRaw({ alan: 1556, yuzolcum: '1,556' }), 1556);
    assert.equal(pickParcelAreaRaw({ alan: 500, yuzolcum: '500.00' }), 500);
  });

  it('falls back to yuzolcum when alan missing', () => {
    assert.equal(pickParcelAreaRaw({ yuzolcum: '1.556' }), '1.556');
  });
});
