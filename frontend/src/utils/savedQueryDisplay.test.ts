import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  mergeLocationHeader,
  parseMahalleFromApiTitle,
  resolveLocationForSavedQueryItem,
  resolveLocationFromTkgmValue,
} from './resolveSavedQueryLocation';

const KNOWN_TKGM = 207911;
const KNOWN_QUARTER_ID = 119451;

type TestSavedQuery = {
  id: string;
  createdAt: string;
  proparcel_value: number | null;
  tkgm_value: number;
  ada: string;
  parsel: string;
  mode?: 'simple' | 'pro';
  price_snapshot: { unit_price: number | null; total_price: number | null };
  location_header?: {
    ilAd?: string | null;
    ilceAd?: string | null;
    mahalleAd?: string | null;
    adaNo?: string | null;
    parselNo?: string | null;
  };
};

function baseLocal(overrides: Partial<TestSavedQuery> = {}): TestSavedQuery {
  return {
    id: '1',
    createdAt: '2026-01-01T00:00:00.000Z',
    proparcel_value: 310,
    tkgm_value: KNOWN_TKGM,
    ada: '1',
    parsel: '2',
    mode: 'simple',
    price_snapshot: { unit_price: null, total_price: null },
    ...overrides,
  };
}

describe('resolveLocationFromTkgmValue', () => {
  it('returns Adana / Aladağ for known mahalle TKGM code', () => {
    const loc = resolveLocationFromTkgmValue(KNOWN_TKGM, 310);
    assert.ok(loc);
    assert.equal(loc.il, 'Adana');
    assert.equal(loc.ilce, 'Aladağ');
    assert.ok(loc.mahalle.length > 0);
  });

  it('returns null for invalid tkgm', () => {
    assert.equal(resolveLocationFromTkgmValue(0), null);
    assert.equal(resolveLocationFromTkgmValue(NaN), null);
  });
});

describe('parseMahalleFromApiTitle', () => {
  it('extracts mahalle before ada/parsel suffix', () => {
    assert.equal(parseMahalleFromApiTitle('Akören Mh. - 1/2'), 'Akören Mh.');
  });
});

describe('resolveLocationForSavedQueryItem', () => {
  it('prefers location_header when present', () => {
    const q = baseLocal({
      location_header: {
        ilAd: 'İstanbul',
        ilceAd: 'Kadıköy',
        mahalleAd: 'Moda',
        adaNo: '1',
        parselNo: '2',
      },
    });
    const loc = resolveLocationForSavedQueryItem(q);
    assert.equal(loc.il, 'İstanbul');
    assert.equal(loc.ilce, 'Kadıköy');
    assert.equal(loc.mahalle, 'Moda');
  });

  it('resolves il/ilce from tkgm when header empty', () => {
    const q = baseLocal({ location_header: undefined });
    const loc = resolveLocationForSavedQueryItem(q);
    assert.equal(loc.il, 'Adana');
    assert.equal(loc.ilce, 'Aladağ');
  });

  it('resolves API item via quarter_id', () => {
    const q = {
      id: 99,
      tkgm_value: KNOWN_TKGM,
      ada: '1',
      parsel: '2',
      title: 'Akören Mh. - 1/2',
      quarter_id: KNOWN_QUARTER_ID,
      proparcel_value: 310,
      created_at: '2026-01-01T00:00:00.000Z',
      local: null,
      _fromApi: true as const,
    };
    const loc = resolveLocationForSavedQueryItem(q);
    assert.equal(loc.il, 'Adana');
    assert.equal(loc.ilce, 'Aladağ');
    assert.ok(loc.mahalle.length > 0);
  });

  it('uses title for mahalle when tkgm mahalle is unavailable', () => {
    const q = {
      id: 100,
      tkgm_value: 999999999,
      ada: '3',
      parsel: '4',
      title: 'Test Mahalle - 3/4',
      quarter_id: null,
      proparcel_value: null,
      created_at: '2026-01-01T00:00:00.000Z',
      local: null,
      _fromApi: true as const,
    };
    const loc = resolveLocationForSavedQueryItem(q);
    assert.equal(loc.mahalle, 'Test Mahalle');
    assert.equal(loc.il, '');
    assert.equal(loc.ilce, '');
  });
});

describe('display row mapping', () => {
  it('maps resolved location to card title fields', () => {
    const q = baseLocal({ location_header: undefined });
    const resolved = resolveLocationForSavedQueryItem(q);
    assert.equal(resolved.il || '-', 'Adana');
    assert.equal(resolved.ilce || '-', 'Aladağ');
    assert.notEqual(resolved.mahalle, '');
  });

  it('shows dash when no location hints exist', () => {
    const resolved = resolveLocationForSavedQueryItem({
      id: 'x',
      createdAt: '',
      proparcel_value: null,
      tkgm_value: 999999999,
      ada: '1',
      parsel: '2',
      mode: 'simple',
      price_snapshot: { unit_price: null, total_price: null },
      location_header: undefined,
    });
    assert.equal(resolved.il || '-', '-');
    assert.equal(resolved.ilce || '-', '-');
  });
});

describe('mergeLocationHeader', () => {
  it('keeps existing il when incoming is empty', () => {
    const merged = mergeLocationHeader(
      { ilAd: 'Adana', ilceAd: 'Aladağ', mahalleAd: 'X' },
      { ilAd: null, ilceAd: 'Yeni İlçe', mahalleAd: null },
    );
    assert.equal(merged?.ilAd, 'Adana');
    assert.equal(merged?.ilceAd, 'Yeni İlçe');
    assert.equal(merged?.mahalleAd, 'X');
  });
});
