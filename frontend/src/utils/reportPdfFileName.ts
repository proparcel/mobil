/**
 * Web report share (file_naming.js buildFileName) ile uyumlu PDF dosya adı.
 * Format: Mahalle_Ada_Parsel.pdf (Türkçe karakterler ASCII'ye çevrilir, boşluklar kaldırılır).
 */

function normalizeTurkishForFilename(str: string): string {
  if (!str) return '';
  const map: Record<string, string> = {
    ç: 'c', Ç: 'C',
    ğ: 'g', Ğ: 'G',
    ı: 'i', I: 'I',
    İ: 'I',
    ö: 'o', Ö: 'O',
    ş: 's', Ş: 'S',
    ü: 'u', Ü: 'U',
  };
  const s = String(str).replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => map[ch] || ch);
  return s.replace(/[^0-9A-Za-z\-\s]/g, ' ').trim().replace(/\s+/g, ' ');
}

function firstNum(v: unknown): string | null {
  const m = String(v ?? '').match(/\d+/);
  return m ? m[0] : null;
}

/** Mahalle_Ada_Parsel.pdf — web buildFileName ile aynı mantık. */
export function buildReportPdfFileName(
  mahalle?: string | null,
  ada?: string | null,
  parsel?: string | null,
): string {
  const mahClean = normalizeTurkishForFilename(String(mahalle ?? '').trim()).replace(/\s+/g, '');
  if (!mahClean) {
    const ts = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `ProParcel_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}.pdf`;
  }
  const adaClean = firstNum(ada) || '0';
  const parselClean = firstNum(parsel) || '0';
  return `${mahClean}_${adaClean}_${parselClean}.pdf`;
}
