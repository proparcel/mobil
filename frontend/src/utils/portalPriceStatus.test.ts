import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isDbDrivenPriceSelection,
  resolveKmTabDisplayMode,
  resolvePortalPriceStatus,
  resolvePortalTotalPrice,
} from './portalPriceStatus';

describe('resolvePortalTotalPrice', () => {
  it('returns positive total_price for verified arsa query', () => {
    assert.equal(
      resolvePortalTotalPrice({
        query_type: 'arsa',
        total_price: 1_500_000,
        valuation_canonical: null,
        portal_summary_prices: null,
        land_price_summary: null,
        arsa_fiyati: null,
        dfa_json: [],
        price_estimation_warning: null,
      }),
      1_500_000,
    );
  });

  it('returns null for zero total price', () => {
    assert.equal(
      resolvePortalTotalPrice({
        query_type: 'arsa',
        total_price: 0,
        valuation_canonical: null,
        portal_summary_prices: null,
        land_price_summary: null,
        arsa_fiyati: null,
        dfa_json: [],
        price_estimation_warning: null,
      }),
      null,
    );
  });
});

describe('resolvePortalPriceStatus', () => {
  it('marks verified when total price is positive and no warning', () => {
    const result = resolvePortalPriceStatus({
      query_type: 'arsa',
      total_price: 900_000,
      valuation_canonical: null,
      portal_summary_prices: null,
      land_price_summary: null,
      arsa_fiyati: null,
      dfa_json: [],
      price_estimation_warning: null,
    });
    assert.equal(result.status, 'verified');
    assert.equal(result.label, 'Doğrulandı');
    assert.equal(result.isWarning, false);
    assert.equal(result.clickable, false);
  });

  it('marks km_estimated when price_estimation_warning.show is true', () => {
    const result = resolvePortalPriceStatus({
      query_type: 'arsa',
      total_price: 750_000,
      valuation_canonical: null,
      portal_summary_prices: null,
      land_price_summary: null,
      arsa_fiyati: null,
      dfa_json: [],
      price_estimation_warning: { show: true, variant: 'km_neighbor_estimate' },
    });
    assert.equal(result.status, 'km_estimated');
    assert.equal(result.label, 'Komşu Mahalle Analizi');
    assert.equal(result.isWarning, true);
    assert.equal(result.clickable, true);
  });

  it('marks unknown when no price and no warning', () => {
    const result = resolvePortalPriceStatus({
      query_type: 'arsa',
      total_price: 0,
      valuation_canonical: null,
      portal_summary_prices: null,
      land_price_summary: null,
      arsa_fiyati: null,
      dfa_json: [],
      price_estimation_warning: null,
    });
    assert.equal(result.status, 'unknown');
    assert.equal(result.label, 'Bilinmiyor');
    assert.equal(result.isWarning, true);
    assert.equal(result.clickable, true);
  });
});

describe('resolveKmTabDisplayMode', () => {
  const verifiedSummary = {
    query_type: 'arsa',
    total_price: 1_000_000,
    valuation_canonical: null,
    portal_summary_prices: null,
    land_price_summary: null,
    arsa_fiyati: null,
    dfa_json: [],
    price_estimation_warning: null,
  };

  const kmSummary = {
    ...verifiedSummary,
    total_price: 800_000,
    price_estimation_warning: { show: true },
  };

  it('returns neighbors_only for verified price', () => {
    assert.equal(
      resolveKmTabDisplayMode({
        kmData: { km_analysis_invoked: false },
        summary: verifiedSummary,
        selection: { model: 'DB', details: { db_source: { verified: true } } },
      }),
      'neighbors_only',
    );
  });

  it('returns km_analysis_full when km invoked and km estimated', () => {
    assert.equal(
      resolveKmTabDisplayMode({
        kmData: { km_analysis_invoked: true },
        summary: kmSummary,
        selection: { model: 'KM' },
      }),
      'km_analysis_full',
    );
  });

  it('returns neighbors_only_warning for unverified without km analysis', () => {
    assert.equal(
      resolveKmTabDisplayMode({
        kmData: { km_analysis_invoked: false },
        summary: kmSummary,
        selection: { model: 'KM' },
      }),
      'neighbors_only_warning',
    );
  });
});

describe('isDbDrivenPriceSelection', () => {
  it('detects DB model and DB_ reason prefixes', () => {
    assert.equal(isDbDrivenPriceSelection({ model: 'DB' }), true);
    assert.equal(isDbDrivenPriceSelection({ reason: 'DB_NO_PREDICTION' }), true);
    assert.equal(isDbDrivenPriceSelection({ model: 'KM' }), false);
  });
});
