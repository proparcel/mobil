import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolvePortalPriceStatus,
  resolvePortalTotalPrice,
  resolveProparcelAskCreditSurcharge,
  resolveProparcelAskPriceTierLabel,
  resolveProQueryCreditNoticeTitle,
} from './portalPriceStatus';

describe('resolvePortalTotalPrice', () => {
  it('arazi: vc 0 iken shell total_price korunur', () => {
    const total = resolvePortalTotalPrice({
      query_type: 'tarla',
      total_price: 5_480_883,
      valuation_canonical: { final_total_tl: 0 },
    } as never);
    assert.equal(total, 5_480_883);
  });

  it('yapı: delivery_total_tl öncelikli', () => {
    const total = resolvePortalTotalPrice({
      query_type: 'villa',
      structure_price_summary: { delivery_total_tl: 28_900_000 },
      land_price_summary: { total_tl: 22_411_859 },
      valuation_canonical: { final_total_tl: 22_411_859 },
    } as never);
    assert.equal(total, 28_900_000);
  });
});

describe('resolvePortalPriceStatus', () => {
  it('pozitif fiyat doğrulandı', () => {
    const status = resolvePortalPriceStatus({
      query_type: 'tarla',
      total_price: 3_600_000,
      valuation_canonical: { final_total_tl: 3_600_000 },
    } as never);
    assert.equal(status.status, 'verified');
    assert.equal(status.totalPrice, 3_600_000);
    assert.equal(status.clickable, false);
  });
});

describe('resolveProparcelAskCreditSurcharge', () => {
  it('verified +0, km +5, unknown +10', () => {
    assert.equal(
      resolveProparcelAskCreditSurcharge({
        query_type: 'tarla',
        total_price: 3_600_000,
      } as never),
      0,
    );
    assert.equal(
      resolveProparcelAskCreditSurcharge({
        query_type: 'tarla',
        total_price: 3_600_000,
        price_estimation_warning: { show: true },
      } as never),
      5,
    );
    assert.equal(
      resolveProparcelAskCreditSurcharge({
        query_type: 'tarla',
        total_price: null,
      } as never),
      10,
    );
  });
});

describe('resolveProQueryCreditNoticeTitle', () => {
  it('maps variants', () => {
    assert.equal(resolveProQueryCreditNoticeTitle({ variant: 'zero_price_no_charge' }), 'Fiyat üretilemedi');
    assert.equal(resolveProQueryCreditNoticeTitle({ variant: 'km_estimated_no_charge' }), 'Tahmini fiyat');
    assert.equal(resolveProQueryCreditNoticeTitle(null), 'Bilgilendirme');
  });
});

describe('resolveProparcelAskPriceTierLabel', () => {
  it('returns tier labels', () => {
    assert.match(resolveProparcelAskPriceTierLabel('verified'), /Doğrulanmış/i);
    assert.match(resolveProparcelAskPriceTierLabel('km_estimated'), /Doğrulanmamış/i);
    assert.match(resolveProparcelAskPriceTierLabel('unknown'), /Fiyat bilgisi yok/i);
  });
});
