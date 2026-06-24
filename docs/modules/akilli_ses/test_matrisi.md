# Sesli Üyelik — test matrisi

Fiziksel cihaz + mikrofon. Backend: pp33 veya yerel Django + proxy.

## Ortak kontroller

| # | Senaryo | Beklenen |
|---|---------|----------|
| O1 | Mikrofon izni reddi | Wizard açılmaz; permissionHint |
| O2 | Çok kısa kayıt (<800ms) | API yok; "Ses çok kısa…"; yeniden dinleme |
| O3 | Ağ hatası | Mesaj; aynı adımda kal |
| O4 | manual_password | Ses kaydı başlamaz; şifre manuel |

## Bireysel

| # | Adım | Girdi | Beklenen |
|---|------|-------|----------|
| B1 | full_name | "Ali Veli" | firstName, lastName |
| B2 | phone | Geç / numara | Opsiyonel; OTP yalnız doluysa |
| B3 | email | geçerli e-posta ses | email alanı |
| B4 | location | — | Adım atlanır |
| B5 | manual_password | — | Wizard biter |

## Kurumsal Emlak

| # | Adım | Girdi | Beklenen |
|---|------|-------|----------|
| KE0 | Ön | corporate_type=emlak seçili | Wizard açılır |
| KE1 | company_name | Geç | companyName boş; submit ad soyad |
| KE2 | company_name | Sesle firma adı | companyName dolu |
| KE3 | company_license_no | 7 hane TTBS | companyLicenseNo |
| KE4 | location + address | Tam adres | corporateAddress dolu |
| KE5 | Mezuniyet | Manuel | SPK değil; opsiyonel |
| KE6 | expertise | Manuel | Mahalle modu |

## Kurumsal SPK

| # | Adım | Beklenen |
|---|------|----------|
| KS1 | spk_tc_no | 11 hane TCKN |
| KS2 | Mezuniyet | Lisans + üniversite zorunlu (manuel) |
| KS3 | expertise | İl (cities) modu |

## Kurumsal LİHKAB

| # | Adım | Beklenen |
|---|------|----------|
| KL1 | office_no | Büro no dolu |
| KL2 | expertise | Adım atlanır |

## Danışman

| # | Adım | Beklenen |
|---|------|----------|
| D1 | consultant_company | Firma eşleşmesi veya listeden fallback |
| D2 | SPK parent | consultant_license_no ses adımı |
| D3 | Emlak parent | Uzmanlık mahalle |
| D4 | LİHKAB parent | Uzmanlık yok |

## Regresyon — Sesli Sorgu

Sesli üyelik değişiklikleri sonrası parsel orb ve ParcelSearchModal smart sekmesi etkilenmemeli.

## Debug

- `voice-registration-debug.log` — sesli üyelik ayrıntılı log (raw_text, extraction_failed)
- `voice-query-debug.log` — tüm ses özellikleri
- Hata ekranı: **Hata logunu paylaş**
- adb / filtre: [voice_debug_log.md](./voice_debug_log.md)
