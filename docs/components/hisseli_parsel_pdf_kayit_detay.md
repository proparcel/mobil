# Hisseli Parsel Böl Sayfası – PDF Kayıt İşlemi (Detaylı)

Bu doküman, mobil projedeki **Hisseli Parsel Böl** sayfasında PDF kaydının nasıl yapıldığını, parsellerin ve koordinatların nasıl saklandığını ve PDF’in nasıl hazırlandığını adım adım anlatır.

---

## 1. Genel Akış

1. Kullanıcı parsel bölmesini **Hesapla** ile oluşturur → `pieces` (parçalar) state’e yazılır.
2. **PDF Kaydet** / **PDF Paylaş** tıklanınca:
   - Gizli bir alanda ana parsel + her parça için **ekran görüntüsü (PNG)** alınır.
   - Bu görseller + parsel verileri (alan, kenar uzunlukları, **köşe koordinatları**) kullanılarak **HTML rapor** üretilir.
   - HTML, **react-native-html-to-pdf** ile PDF’e çevrilir ve dosya **DocumentDirectory**’ye kopyalanır.
   - Proje listesi (**savedParcelSplitProjects**) güncellenir (mahalle, ada, parsel, dosya yolu).

İlgili dosyalar:
- **Sayfa:** `frontend/screens/routes/parcel-split.tsx`
- **PDF üretimi:** `frontend/src/utils/parcelSplitPdf.ts`
- **Kayıtlı projeler:** `frontend/src/utils/savedParcelSplitProjects.ts`
- **PDF görsel render:** `PdfRenderCanvas.tsx`, `PieceThumbnailForPdf.tsx`

---

## 2. Parsellerin ve Koordinatların Kaynağı

### 2.1 Parça (Piece) veri yapısı

Ekrandaki her “parsel parçası” şu tip ile temsil edilir (`src/types/parcelSplit.ts`):

```ts
type Piece = {
  id: string;
  polygon: Polygon;   // { type: "Polygon"; ring: Point[] }
  area: number;      // m²
  frontageLen?: number;
  violations: string[];
  valid: boolean;
};

type Point = { x: number; y: number };
```

- **`polygon.ring`**: Kapalı poligon halkası; `Point[]` — **yerel metre (local metre)** koordinatları.
- Ring genelde son nokta = ilk nokta (kapalı); listelemede tekrarsız da kullanılır.

### 2.2 Koordinat sistemi (yerel metre)

- **Girdi:** Backend’den gelen parsel geometrisi GeoJSON (WGS84 lon/lat).
- **Dönüşüm:** `parcelSplitTransform.ts` içinde:
  - lon/lat → Web Mercator metre,
  - sonra **origin (bbox merkezi)** çıkarılıp **Y ekseni çevriliyor** (ekranda kuzey yukarı olsun diye).
- Ekranda ve PDF’de kullanılan **ring koordinatları bu yerel metre sistemindedir** (origin merkezli, metre birimi).
- PDF’deki “Köşe koordinatları (x, y) metre” tablosu da **aynı yerel metre** değerlerini yazar; WGS84 veya projeksiyon dönüşümü bu aşamada yapılmaz.

---

## 3. PDF Hazırlama Adımları (buildPdf)

`parcel-split.tsx` içindeki `buildPdf` callback’i şunları yapar:

### 3.1 Kenar ölçülerini açma

- `setShowEdgeMeasurements(true)` ile kenar uzunlukları etiketleri (örn. "48m") gösterilir; hem ana harita hem PDF görselinde aynı pipeline kullanılır.

### 3.2 Ana parsel görüntüsü (screenshot)

- **Gizli ViewShot** (`pdfParentRenderRef`): Ekran dışında, sabit boyutta (ör. 800×500 px) bir alan.
- İçinde **PdfRenderCanvas** `mode="parent"` ile çizilir:
  - Ana parsel poligonu, yol poligonu (varsa), bölme çizgileri, parçalar, kenar ölçüleri, parça numaraları (daire içinde).
- Koordinatlar **ring’in yerel metre** değerleri; SVG `viewBox` bbox + padding ile bu metre alanına göre ayarlanır (`PdfRenderCanvas.tsx`).
- `pdfParentRenderRef.current.capture({ format: "png", quality: 0.9, result: "base64", width: PDF_PARENT_W, height: PDF_PARENT_H })` ile bu alan **PNG base64** olarak alınır.

### 3.3 Her parça için küçük görsel (thumbnail)

- Her `pieces[i]` için ayrı bir **ViewShot** + **PdfRenderCanvas** `mode="piece"` ve `pieceIndex={i}`.
- Sadece o parçanın poligonu (ve parça numarası) çizilir; boyut örn. 120×120 px.
- `pieceShotRefs.current[i].capture({ format: "png", quality: 0.9, result: "base64", width: PDF_THUMB_W, height: PDF_THUMB_H })` ile **PNG base64** alınır.

### 3.4 PDF için parsel verisi (piecesData)

Her parça için `parcelSplitPdf` modülünün beklediği **PiecePdfData** üretilir:

```ts
const piecesData = pieces.map((p, idx) => ({
  id: p.id ?? `P-${idx + 1}`,
  pieceNumber: idx + 1,
  area: Math.round(p.area * 100) / 100,
  edgeLengths: computeEdgeLengths(p.polygon.ring),  // metre
  valid: p.valid,
  violations: p.violations,
  imageBase64: pieceImages[idx] ?? "",   // yukarıdaki thumbnail PNG
  ring: p.polygon.ring ?? [],            // yerel metre köşe listesi
}));
```

- **ring:** Aynen ekrandaki **yerel metre** koordinatları; PDF’de tabloda “K1 (x, y), K2 (x, y), …” olarak yazılır.
- **edgeLengths:** `parcelSplitPdf.ts` içinde `computeEdgeLengths(ring)` ile ring üzerinde ardışık kenar uzunlukları (metre) hesaplanır.

### 3.5 Dosya adı

- `parcelSplitFileName(params.mahalle, params.ada, params.parsel)` → örn. `MahalleAdi_1_2.pdf` (boşluk/özel karakterler temizlenir).

### 3.6 generateParcelSplitPdf çağrısı

- `title`, `dateStr`, `screenshotBase64` (ana görsel), `pieces: piecesData`, `fileName` gönderilir.
- Dönen `{ pdfUri, filename }` hem dosya yolunu hem kullanıcıya gösterilen dosya adını verir.

---

## 4. PDF İçeriğinin Üretimi (parcelSplitPdf.ts)

### 4.1 HTML şablonu (buildParcelSplitHtml)

- **Sayfa 1:** Başlık (ProParcel, “Hisseli Parsel Bölme Raporu”, tarih), ardından **ana parsel görünümü** (tek büyük PNG).
- **Sayfa 2:** “Diğer parseller” bölümü: Her parça için bir **kart** (Parsel 1, Parsel 2, …); her kartta ilgili **thumbnail PNG** (imageBase64) kullanılır. Sayfa başına 4×3 = 12 kart; 12’den fazla parça varsa yeni sayfa açılır.
- **Köşe koordinatları tablosu:** Aynı sayfada (veya devamında) bir tablo:
  - Sütunlar: “Parsel” | “Köşe koordinatları (x, y) metre”.
  - Her satır: “Parsel 1” vb. ve `formatRingCoords(p.ring)` çıktısı.

### 4.2 Köşe koordinatlarının yazımı (formatRingCoords)

- **Kapalı ring:** Son nokta ilk ile aynıysa listelemede **tekrarlanmaz**.
- Format: `K1 (x1, y1), K2 (x2, y2), …` — x, y **yerel metre**, iki ondalık basamak.
- Bu değerler doğrudan `p.polygon.ring` (yerel metre) üzerinden gelir; ek projeksiyon yok.

### 4.3 Görsel kaynağı (img src)

- Ana görsel: Android’de çoğunlukla **base64** data URI; iOS’ta isteğe bağlı geçici dosya (`file://`) denenir, olmazsa base64.
- Kart görselleri: Hep **base64** data URI (`data:image/png;base64,...`).

### 4.4 PDF’e çevirme ve dosyaya yazma (generateParcelSplitPdf)

- **react-native-html-to-pdf** ile `convert({ html, fileName: baseName, width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT })` (A4 pt).
- Çıkan PDF dosyası `RNFS.DocumentDirectoryPath` altına `filename` (örn. `MahalleAdi_1_2.pdf`) ile **kopyalanır**; dönen `pdfUri` bu tam yoldur.

---

## 5. Kayıtlı Projeler Listesi (savedParcelSplitProjects)

- **addSavedParcelSplitProject** ile her kayıtta şunlar saklanır:
  - `fileName`, `filePath` (PDF’in tam yolu), `mahalle`, `ada`, `parsel`, `createdAt`, `id`.
- Depolama: **AsyncStorage** (key: `pp_saved_parcel_split_projects_v1`); AsyncStorage kullanılamazsa **RNFS** ile aynı key’e karşılık gelen bir JSON dosyasına yedeklenir.
- Aynı **mahalle/ada/parsel** için yeni kayıt yapılırsa **eski kayıt listeden çıkarılır**, yeni kayıt başa eklenir (aynı parselin üzerine yazma).

---

## 6. Kısa Özet Tablosu

| Ne | Nerede | Nasıl |
|----|--------|--------|
| Parça geometrisi | `pieces[].polygon.ring` | Yerel metre (Point[]), kapalı halka |
| Ana parsel görüntüsü | PDF sayfa 1 | ViewShot + PdfRenderCanvas(parent) → PNG base64 → HTML img |
| Parça kart görselleri | PDF sayfa 2 | Her parça için ViewShot + PdfRenderCanvas(piece) → PNG base64 → HTML kart img |
| Köşe koordinatları | PDF tablo | `ring` aynen; K1 (x,y), K2 (x,y)… formatında, yerel metre |
| Kenar uzunlukları | Hesaplanan | `computeEdgeLengths(ring)` (metre); HTML’de ayrı tablo yok, görsel etiketler var |
| PDF dosyası | Cihaz | DocumentDirectory + `mahalle_ada_parsel.pdf` |
| Proje listesi | AsyncStorage / dosya | fileName, filePath, mahalle, ada, parsel, createdAt |

Bu akış, hisseli parsel böl sayfasında PDF’in nasıl hazırlandığını, parsellerin ve koordinatların (yerel metre) nasıl kaydedildiğini tek bir dokümanda toplar.
