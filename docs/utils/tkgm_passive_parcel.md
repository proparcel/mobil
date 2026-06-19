# TKGM Pasif / Toplulaştırılmış Parsel (tkgmPassiveParcel) Dokümantasyonu

## Özellik/Görev

`tkgmPassiveParcel.ts`, TKGM'de **pasif / toplulaştırılmış** durumdaki parselleri ele alan
saf iş mantığı modülüdür. Web referansının (`myapp/static/js/utils/tkgm_passive_parcel.js`)
birebir TypeScript portudur. UI içermez; onay (modal) gösterimi çağıran tarafça
(`TkgmPassiveParcelModal` + `index.tsx`) sağlanır.

Pasif parsel: TKGM yanıtında `geometry == null` olup `properties.gittigiParselListe`
(JSON string veya object) dolu olan kayıttır. Bu durumda parsel başka bir aktif parsele
toplulaştırılmıştır; kullanıcıya bilgi verilip haritada **hedef (aktif) parsel geometrisi**
kullanılır.

## Dosyalar

| Dosya | Sorumluluk |
| --- | --- |
| `src/utils/tkgmPassiveParcel.ts` | Saf mantık: çıkarım, normalize, onay sözleşmesi |
| `components/app/TkgmPassiveParcelModal.tsx` | React Native `Modal` ile bilgilendirme UI |
| `src/utils/tkgmApi.ts` | `applyPassiveParcelIfNeeded`, 200/404 pasif payload yakalama |
| `src/utils/tkgmParcelQuery.ts` | `confirm` iletimi + `mapTkgmCatch` hata metinleri |
| `src/utils/handlers/parcelHandlers.ts` | Basit mod catch'inde pasif kurtarma + uyarı |
| `screens/routes/index.tsx` | Modal state + `confirmPassiveParcel` + hata modalı |

## Genel API (tkgmPassiveParcel.ts)

### `extractPassiveParcelInfo(data): PassiveParcelInfo | null`
Pasif değilse `null`. İki dal:
1. Ham TKGM yanıtı: `geometry == null` + `gittigiParselListe`.
2. Backend normalize etmiş: `properties.pp_tkgm_passive_redirect === true` (Pro mod).

Dönen `PassiveParcelInfo`:
```typescript
{
  sourceProps: PassiveParcelRowProps;   // Sorgulanan (pasif) parsel
  sebep: string;                        // Değişiklik sebebi (gittigiParselSebep)
  destinations: PassiveParcelRowProps[];// Gittiği (aktif) parsel(ler)
  normalizedFeature: TkgmFeatureLike;   // Hedef geometriyle Feature
}
```

### `normalizeFeature(data): unknown`
Pasif ise hedef parselin geometrisiyle Feature döndürür; değilse `data`. Hedef
`properties` içine kaynak meta yazılır (aşağı bkz.).

### `isPassiveParcelPayload(data): boolean`
Payload pasif parsel mi? (200 geometry yok + gittigiParselListe **veya**
`pp_tkgm_passive_redirect`).

### `normalizeAndConfirm(data, confirm?): Promise<unknown>`
Pasif ise önce `confirm(info)` (modal) beklenir, sonra normalize feature döner.
`confirm` verilmezse modal'sız normalize edilir (geri uyumluluk).

```typescript
type PassiveConfirmFn = (info: PassiveParcelInfo) => Promise<void> | void;
```

### `shouldShowNotFoundBanner(error): boolean`
`TKGM_PARCEL_NOT_FOUND` hatası gerçek "bulunamadı" mı yoksa pasif redirect mi?
Pasif (kurtarılabilir) ise `false` → "parsel bulunamadı" uyarısı gösterilmez.

## Normalize edilen feature'a yazılan meta (izlenebilirlik)

Hedef (aktif) parsel `properties` içine kaynak bilgisi eklenir:

- `pp_tkgm_passive_redirect: true`
- `pp_tkgm_passive_source_ada`
- `pp_tkgm_passive_source_parsel`
- `pp_tkgm_passive_source_ozet`
- `pp_tkgm_passive_sebep`

## Akış (mobil)

1. TKGM çağrısı (`fetchTkgmByIds` / `fetchTkgmByCoords`) opsiyonel `confirm` callback'i alır.
2. `parseTkgmResponse`:
   - 200 + `geometry` yok ama pasif payload → `applyPassiveParcelIfNeeded` (modal + normalize), hata fırlatmaz.
   - 404 + `detail` pasif payload → `TKGM_PARCEL_NOT_FOUND` fırlatmadan kurtarır.
3. `confirmPassiveParcel` (index.tsx) modal'ı açar; "Tamam"'a basılınca Promise resolve olur.
4. Dönen veri **aktif parsel** geometrisidir; haritaya çizilir.

## Hata davranışı (çökme önleme)

TKGM yanıt alamazsa / HTTP 500 (5xx) dönerse uygulama **çökmez**;
bunun yerine **Uyarı** başlıklı modal gösterilir:

- Mesaj: **"TKGM yanıt vermiyor. Lütfen sonra tekrar deneyin."**
- Ortak yardımcı: `tkgmApi.ts` → `TKGM_NO_RESPONSE_MESSAGE`, `getTkgmUserAlert(error)`
- HTTP 5xx → `TKGM_UNAVAILABLE` tipi + yukarıdaki mesaj (`parseTkgmResponse`)
- `index.tsx`, `parcelHandlers.ts`, `tkgmParcelQuery.ts` bu yardımcıyı kullanır

## Test Senaryoları

1. Pasif ada/parsel sorgusu → modal açılır (kaynak + hedef bilgileri).
2. "Tamam" → haritada aktif parsel çizilir.
3. Gerçek bulunamayan parsel → "Parsel bulunamadı" (pasif değil).
4. Harita tıklama ile pasif parsel → aynı modal.
5. Pro modda backend normalize yanıt (`pp_tkgm_passive_redirect`) → modal yine çalışır.
6. TKGM 500 / beklenmeyen hata → uygulama çökmez, uyarı modalı.

## İlgili Değişiklik Notu

`docs/changes/2026-06-09-mobile-tkgm-passive-parcel.md`
