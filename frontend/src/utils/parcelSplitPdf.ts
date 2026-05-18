/**
 * Hisseli Parsel Bölme PDF raporu: kenar uzunlukları, HTML şablonu, PDF üretimi.
 * react-native-html-to-pdf + react-native-fs (Expo yok).
 * Yerleşim: Sayfanın üst yarısı = ana parsel görüntü alanı, alt yarısı = diğer parseller (kartlar).
 */

import { Platform } from "react-native";
import type { Point } from "../types/parcelSplit";
import RNHTMLtoPDF from "react-native-html-to-pdf";
import RNFS from "react-native-fs";

/** Ring üzerinde her kenarın uzunluğu (metre). Kapalı ring: son=ilk tekrar sayılmaz; i..i+1 kenarları. */
export function computeEdgeLengths(ring: Point[]): number[] {
  if (!ring || ring.length < 2) return [];
  const out: number[] = [];
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    out.push(Math.hypot(dx, dy));
  }
  return out;
}

export interface PiecePdfData {
  id: string;
  /** Parça numarası (1-based, daire içinde gösterilen). */
  pieceNumber: number;
  area: number;
  edgeLengths: number[];
  valid?: boolean;
  violations?: string[];
  /** Kart görseli (base64, data URI prefix olmadan). */
  imageBase64?: string;
  /** Parsel köşe koordinatları (metre, yerel sistem). Kapalı ring: son nokta ilk ile aynı olabilir; listelemede tekrarsız. */
  ring?: Point[];
}

export interface ParcelSplitPdfOpts {
  title?: string;
  dateStr?: string;
  /** Ana parsel görünümü için PNG base64 (data URI veya ham base64). */
  screenshotBase64: string;
  pieces: PiecePdfData[];
  /** PDF dosya adı (örn. mahalle_ada_parsel.pdf). Verilmezse zaman damgalı ad kullanılır. */
  fileName?: string;
}

/** A4 pt. Sayfa1: Ana + 12 kart (4×3). Taşan kartlar aynı düzende sonraki sayfalar. Son sayfa: sadece koordinat tablosu. */
const PAGE_WIDTH_PT = 595;
const PAGE_HEIGHT_PT = 842;
const CARDS_PER_PAGE = 12;
const CARD_COLUMNS = 4;

/**
 * Ana parsel PNG'sini geçici dosyaya yazar; HTML'de file:// ile kullanmak için.
 * Android WebView bazen base64 göstermiyor; dosya yolu denenebilir.
 */
async function writeImageToTempFile(base64: string): Promise<string> {
  const clean = base64.startsWith("data:") ? base64.replace(/^data:image\/\w+;base64,/, "") : base64;
  const filename = `parcel_main_${Date.now()}.png`;
  const path = `${RNFS.CachesDirectoryPath}/${filename}`;
  await RNFS.writeFile(path, clean, "base64");
  return path;
}

/** HTML raporu: 2 sayfa. Page1 = Başlık + Ana parsel + Diğer parseller kartları. Page2 = Sadece koordinat tablosu. */
export function buildParcelSplitHtml(opts: ParcelSplitPdfOpts & { imageFilePath?: string | null }): string {
  const { title = "Hisseli Parsel Bölme Raporu", dateStr = new Date().toLocaleString("tr-TR"), screenshotBase64, pieces, imageFilePath } = opts;

  const heroImgSrc = imageFilePath
    ? `file://${imageFilePath}`
    : screenshotBase64.startsWith("data:")
      ? screenshotBase64
      : `data:image/png;base64,${screenshotBase64}`;

  const n = pieces.length;
  const gridGapPt = 8;
  const cardPaddingPt = 8;
  const thumbHeightPt = 96;
  const gridStyle = `display: grid; grid-template-columns: repeat(${CARD_COLUMNS}, 1fr); gap: ${gridGapPt}pt;`;
  const cardStyle = `border: 1pt solid #e5e7eb; border-radius: 10pt; padding: ${cardPaddingPt}pt; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid;`;
  const thumbStyle = `width: 100%; height: ${thumbHeightPt}pt; object-fit: contain; display: block;`;

  function cardHtml(p: PiecePdfData): string {
    const src = p.imageBase64
      ? (p.imageBase64.startsWith("data:") ? p.imageBase64 : `data:image/png;base64,${p.imageBase64}`)
      : "";
    return `<div class="card" style="${cardStyle}"><div class="cardTitle">Parsel ${p.pieceNumber}</div>${src ? `<img class="thumb" src="${src}" alt="Parsel ${p.pieceNumber}" style="${thumbStyle}" />` : ""}</div>`;
  }

  const page1Chunk = pieces.slice(0, CARDS_PER_PAGE);
  const page1CardsHtml = page1Chunk.map(cardHtml).join("");
  const cardPagesHtml: string[] = [];
  for (let i = CARDS_PER_PAGE; i < n; i += CARDS_PER_PAGE) {
    const chunk = pieces.slice(i, i + CARDS_PER_PAGE);
    cardPagesHtml.push(`<div class="page cardPage"><div class="sectionTitle">Diğer Parseller (devam)</div><div class="grid" style="${gridStyle}">${chunk.map(cardHtml).join("")}</div></div>`);
  }

  function formatRingCoords(ring: Point[] | undefined): string {
    if (!ring || ring.length === 0) return "—";
    const len = ring.length;
    const closed = len >= 2 && ring[len - 1].x === ring[0].x && ring[len - 1].y === ring[0].y;
    const pts = closed ? ring.slice(0, len - 1) : ring;
    return pts.map((p, i) => `K${i + 1} (${Number(p.x).toFixed(2)}, ${Number(p.y).toFixed(2)})`).join(", ");
  }
  function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  const coordsRows = pieces
    .map((p) => `<tr><td class="tdNum">Parsel ${p.pieceNumber}</td><td class="tdList">${escapeHtml(formatRingCoords(p.ring))}</td></tr>`)
    .join("");
  const coordsTable =
    pieces.length > 0
      ? `<table class="table"><thead><tr><th>Parsel No</th><th>Köşe Koordinatları (m)</th></tr></thead><tbody>${coordsRows}</tbody></table>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; }
    .page {
      width: ${PAGE_WIDTH_PT}pt;
      height: ${PAGE_HEIGHT_PT}pt;
      padding: 18pt;
      box-sizing: border-box;
    }
    .page1 { page-break-after: always; }
    .cardPage { page-break-after: always; }
    .pageCoords { page-break-before: always; page-break-after: auto; }
    .pdfHeader {
      display: flex; flex-direction: row; align-items: center; justify-content: space-between;
      margin: -18pt -18pt 14pt -18pt; padding: 12pt 18pt;
      background: #1e293b; border-radius: 0 0 8pt 8pt;
    }
    .headerBrand { font-size: 16pt; font-weight: 700; color: #ffffff; letter-spacing: 0.02em; }
    .headerInfo { text-align: right; }
    .headerInfo .headerTitle { margin: 0 0 4pt 0; font-size: 14pt; color: #f8fafc; font-weight: 600; }
    .headerInfo .headerDate { font-size: 10pt; color: #94a3b8; }
    h1 { font-size: 18pt; margin: 0 0 6pt 0; }
    .meta { font-size: 10pt; color: #6b7280; margin-bottom: 10pt; }
    .heroWrap { border: 1pt solid #e5e7eb; border-radius: 10pt; padding: 10pt; margin-bottom: 10pt; }
    .heroImg { width: 100%; height: 300pt; object-fit: contain; display: block; }
    .sectionTitle { font-size: 12pt; margin: 12pt 0 8pt 0; font-weight: 700; }
    .cardTitle { font-size: 10pt; font-weight: 700; margin-bottom: 6pt; }
    .table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    .table th, .table td { border: 1pt solid #e5e7eb; padding: 6pt; vertical-align: top; }
    .table th { background: #f3f4f6; font-weight: 700; }
    .tdNum { font-weight: 600; width: 80pt; }
    .tdList { word-break: break-word; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    @media print { .page1 { page-break-after: always; } .cardPage { page-break-after: always; } .pageCoords { page-break-before: always; } }
  </style>
</head>
<body>
  <div class="page page1">
    <div class="pdfHeader">
      <span class="headerBrand">ProParcel</span>
      <div class="headerInfo">
        <div class="headerTitle">${title}</div>
        <div class="headerDate">${dateStr}</div>
      </div>
    </div>
    <div class="heroWrap">
      <img class="heroImg" src="${heroImgSrc}" alt="Ana parsel" />
    </div>
    <div class="sectionTitle">Diğer Parseller</div>
    <div class="grid" style="${gridStyle}">${page1CardsHtml}</div>
  </div>
  ${cardPagesHtml.join("\n  ")}
  <div class="page pageCoords">
    <div class="sectionTitle">Köşe Koordinatları (m)</div>
    ${coordsTable}
  </div>
</body>
</html>
  `.trim();
}

/** HTML'i PDF'e çevirir, dosyayı DocumentDirectory'ye kopyalar. Döner: { pdfUri, filename }. */
export async function generateParcelSplitPdf(opts: ParcelSplitPdfOpts): Promise<{ pdfUri: string; filename: string }> {
  let imageFilePath: string | null = null;
  if (Platform.OS === "ios") {
    try {
      imageFilePath = await writeImageToTempFile(opts.screenshotBase64);
    } catch {
      // base64 ile devam et
    }
  }
  // Android WebView file:// göstermiyor; base64 kullan (küçük capture ile)

  const html = buildParcelSplitHtml({ ...opts, imageFilePath });
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaultBaseName = `parcel_split_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const rawFileName = opts.fileName?.trim();
  const filename = rawFileName
    ? (rawFileName.toLowerCase().endsWith(".pdf") ? rawFileName : `${rawFileName}.pdf`)
    : `${defaultBaseName}.pdf`;
  const baseName = filename.replace(/\.pdf$/i, "");

  const result = await RNHTMLtoPDF.convert({
    html,
    fileName: baseName,
    width: PAGE_WIDTH_PT,
    height: PAGE_HEIGHT_PT,
  });

  if (imageFilePath) {
    try {
      await RNFS.unlink(imageFilePath);
    } catch {
      // ignore
    }
  }

  if (!result.filePath) {
    throw new Error("PDF oluşturulamadı");
  }

  const destUri = `${RNFS.DocumentDirectoryPath}/${filename}`;
  try {
    await RNFS.copyFile(result.filePath, destUri);
    return { pdfUri: destUri, filename };
  } catch {
    return { pdfUri: result.filePath, filename };
  }
}
