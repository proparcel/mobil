## 2026-02-26 Operasyon Notlari Konsolide Ozet

Bu dosya, daginik operasyon notlarini tek bir kayitta toplar ve aktif referans olarak kullanilir.

### Kenar kaydirma ve yol kaydirma

- Kenar kaydirma akisinda kalici sorun, geometri tutarliligi bozulmasi ve etiket sapmasi olarak gozlenir.
- Cozum yaklasimi: komut seviyesinde tanimli adimlar yerine tek bir akista "sorun tespiti -> kok neden -> duzeltme -> dogrulama" uygulanir.
- Debug adimlari kalici olarak tek listede tutulur; gecici prompt/komut belgeleri ayri dosyalarda korunmaz.
- Yol kaydirma adimlari kenar kaydirma ile ayni dogrulama adimlarina baglanir (olcu etiketi, geometri stabilitesi, geri alma davranisi).

### Hisseli parsel PDF ve ekran goruntusu

- PDF kart tasmasi sorunu ve ekran goruntusu engel senaryosu ayni hata sinifinda ele alinir: cikti katmani ve yerlesim uyumu.
- Kalici dogrulama: PDF cikti onizleme, kart boyut sinirlari, engel durumunda fallback davranisi.
- Bu konuda gecici komut notlari kaldirilir; tek kayit bu ozet dosyasi olur.

### Konsolide edilen kayitlar

- `kenar_kaydirma_sistem_komutu.md`
- `kenar_kaydirma_soru_komutu.md`
- `kenar_kaydirma_debug_komutu.md`
- `kenar_kaydirma_sorun_raporu.md`
- `kenar_kaydirma_detayli_sorun_raporu.md`
- `kenar_kaydirma_kok_neden_ve_cozum.md`
- `yol_kaydirma_sistem_komutu.md`
- `hisseli_parsel_pdf_kart_tasma_sorunu_komutu.md`
- `hisseli_parsel_ekran_goruntusu_engel_sorunu_komutu.md`

### Not

Detayli teknik akis ihtiyacinda ilgili kalici modul dokumanlari (`docs/components/` ve `docs/utils/`) referans alinmalidir.
