# iOS App Store — Fiyatlandırma (Mobil)

Mobil Tepe Coin paket ekranı iOS’ta App Store üzerinden satın alır.

## Konum

- UI: [`frontend/screens/routes/pricing.tsx`](../../mobil_github/frontend/screens/routes/pricing.tsx)
- SKU listesi: [`config/iapProducts.ts`](../../mobil_github/frontend/config/iapProducts.ts)
- StoreKit: [`services/iapService.ts`](../../mobil_github/frontend/services/iapService.ts)
- Paket API: [`services/creditService.ts`](../../mobil_github/frontend/services/creditService.ts) → `GET /api/packages/`

## Sekmeler

| Sekme | IAP ürünleri |
|-------|----------------|
| Kurumsal | `com.proparcel.*.monthly` / `*.yearly` (kurumsal slug) |
| Bireysel | `com.proparcel.individual.*` |
| Ek Paket | `com.proparcel.ek.*` (consumable) |

iOS’ta yalnızca `ios_product_id` dolu paketler listelenir.

## Ek paket kilidi

`has_active_yearly_subscription === false` ise ek paket satın alma butonu kapalı; backend verify `ek_requires_yearly_subscription` döner.

## Backend doğrulama

Satın alma sonrası: `POST /api/payments/apple/verify/` (`transaction_id`, `product_id`, `platform: ios`).

Doküman: [`docs/backend/apple_iap_ios_payments.md`](../../../docs/backend/apple_iap_ios_payments.md)
