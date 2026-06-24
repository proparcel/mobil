# TL Paket Lisansları — Mağaza SKU Kurulumu

Bu doküman `store-setup-test` todo'su için App Store Connect ve Google Play Console yapılandırmasını özetler.

## Ürünler (Consumable)

| action_type | Product ID | Referans fiyat (Mongo `price_try`) |
|-------------|------------|-------------------------------------|
| `ai_video` | `com.proparcel.license.ai_video` | 500 ₺ |
| `drone_video` | `com.proparcel.license.drone_video` | 600 ₺ |
| `ai_drone_proparcel` | `com.proparcel.license.ai_drone_proparcel` | 1500 ₺ |
| `drone_video_ek_sahne` | `com.proparcel.license.drone_video_ek_sahne_1` | Admin panel |
| `drone_video_ek_sahne_2` | `com.proparcel.license.drone_video_ek_sahne_2` | Admin panel |

Fiyat kaynağı: Mongo `purchasing_kredits` (`price_try`, `is_try_priced`). Admin panelden güncellenir; mağaza tier'ları yaklaşık eşleşmeli.

## App Store Connect

1. **App** → **In-App Purchases** → **Consumable** oluştur.
2. Her SKU için yukarıdaki Product ID'yi birebir kullan.
3. Fiyatlandırma: Türkiye tier'ı Mongo `price_try` değerine en yakın seçenek (500 / 600 / 1500 TRY; ek sahne paketleri admin fiyatı).
4. Admin `/accounts/admin/packages/` → ilgili action_type satırında **iOS Product ID** alanına aynı ID'yi gir (opsiyonel; kod fallback map'i de var).
5. **Sandbox tester** hesabı ile mobil uçtan uca test:
   - AI Drone Video modal → IAP → verify → editör
   - Pratik Video editör → ek sahne IAP (`drone_video_ek_sahne` / `_2`) → verify → capture
   - AI Video Studio → IAP → job başlat
   - ProParcel talep → IAP → `createRequest` + `payment_reference`

## Google Play Console

1. **Monetize** → **Products** → **In-app products** (managed consumable).
2. Product ID'ler App Store ile aynı (`com.proparcel.license.*`).
3. Admin panelde **Google Product ID** alanını doldur.
4. **License testers** listesine test Gmail ekle.
5. Android internal/closed track build ile sandbox satın alma testi.

## Backend doğrulama

- iOS: `POST /api/payments/apple/verify/` — body: `product_id`, `transaction_id`, `action_type`, `reference_id`
- Android: `POST /api/payments/google/verify/` — body: `product_id`, `purchase_token`, `action_type`, `reference_id`
- Web havale: `POST /api/payments/license/create/` → dekont → admin onay → `grant_paid_product_license`

## pp33 migration

Sunucuda migration çalıştır:

```bash
python manage.py migrate accounts 0181_drone_video_ek_sahne_products
```

## Kontrol listesi

- [ ] 5 consumable SKU (iOS + Android) — 3 lisans + 2 ek sahne
- [ ] Sandbox satın alma → lisans `accounts_creditusage` (`credits_used=0`, `amount_paid_try`)
- [ ] `POST /api/credit/use/` → `ai_video` / `drone_video` / `ai_drone_proparcel` → 403 `DIRECT_PAYMENT_REQUIRED`
- [ ] Ek frame / `ai_img` hâlâ Tepe Kredi
