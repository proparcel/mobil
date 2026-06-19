# Portal liste modları (Pro sorgu / Emlak vitrini)

`Son30GunScreen` (`frontend/screens/routes/son-30-gun.tsx`) tek liste kabuğudur; **liste modu route ile kilitlidir**, filtre sheet’te mod toggle yoktur.

## Route eşlemesi

| Route (`App.tsx`) | `listMode` | API | Kart bileşeni |
|-------------------|------------|-----|----------------|
| `son-30-gun` | `proSorgular` | `getPortalRecentQueries` (`exclude_listing_source=1`) | `QueryCard` |
| `emlak-vitrini-liste` | `ilanlar` | `getPublicVitrinListings` | `VitrinListingCard` |

```ts
const listMode: ListMode =
  routeName === 'son-30-gun' ? 'proSorgular' : 'ilanlar';
```

Web’deki `list_mode` URL parametresinin mobil karşılığı **route adı**dır.

## Emlak vitrini girişi (2026)

- Menü / landing / ana ekran: doğrudan `emlak-vitrini-liste` (`router.replace`) — Pro sorgu listesi gibi tek adım.
- `emlak-vitrini.tsx` içindeki kategori → satılık/kiralık → il **sihirbazı pasif** (`EmlakVitriniWizardScreen`); route yalnızca eski deep link için listeye yönlendirir. İleride yeniden açılabilir.
- Vitrin liste varsayılan il sırası: route `city_id` → AsyncStorage son portal ili (`pp.portal.recentQueries.lastCityId`, Pro ile ortak) → profil adres `city_id` → şehir listesinde en yüksek `count`.

## UI

- **Başlık:** Pro → “Son 30 Gün Pro Sorgular”; vitrin → “Emlak Vitrini”.
- **Filtre sheet:** “Pro sorgu filtreleri” / “İlan filtreleri”; İlanlar | ProSorgular segmenti yok.
- **Mod şeridi:** Mevcut `listModeNoticeText` route ile uyumlu kalır.
- **Focus:** `useFocusEffect` route moduna göre `loadList` veya `loadListings` çağırır; Pro route’ta listing state temizlenir.

## Manuel test matrisi

| # | Adım | Beklenti |
|---|------|----------|
| 1 | Menü → Son 30 gün Pro sorgu | Başlık “Son 30 Gün…”, şerit Pro, **Ada/Parsel** kartları; filtrede mod segmenti yok |
| 2 | Menü → Emlak vitrini | Doğrudan liste; başlık “Emlak Vitrini”, varsayılan il yüklü, vitrin kartları |
| 3 | Pro listede Filtre aç | Yalnızca Pro alanları; “İlanlar” sekmesi görünmez |
| 4 | Pro → ana sayfa → tekrar Pro | Hâlâ Pro kartları (önceki oturumda toggle ile ilan moduna geçilmiş olsa bile) |
| 5 | `emlak-vitrini-liste` → geri → `son-30-gun` | Ayrı stack ekranları; Pro listesi, vitrin API çağrısı yok |
| 6 | Pro kart → detay | Açılır; ilan kökenli sorguda detay bandı “Emlak İlan Detayı” kalabilir (ürün kuralı) |

## İlan kökenli Pro snapshot

İlan yayınında otomatik oluşan `source_listing_id` dolu snapshot'lar **Son 30 gün listesinde gösterilmez** (API + istemci süzgeci). Aynı kayıt yalnızca **emlak vitrini** (`getPublicVitrinListings`) tarafında ilan kartı olarak kalır. Detay sayfasına ilan üzerinden veya `portal_snapshot_id` ile gidilebilir.

## Kapsam dışı (bilinçli)

- Dosyayı ikiye bölmek (Faz 2 hook + ince sarmalayıcılar).
- Web `list_mode=all` (web Son 30 listesi ayrıca `exclude_listing_source` alabilir).
- Detay sayfasındaki ilan kökenli Pro sorgu bandı metni.
