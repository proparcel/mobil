/**
 * V4 Analiz Raporu PDF — Mobil
 * 
 * Web v4 tasarımıyla uyumlu 2 sayfalık PDF raporu:
 *   Sayfa 1: Ana Sayfa — Harita (sol %61.8) + Firma/Kullanıcı/Fiyat (sağ %38.2)
 *   Sayfa 2: DFA Tablosu — Tam genişlik
 * 
 * react-native-html-to-pdf + react-native-fs (Expo yok).
 */

import { Platform } from 'react-native';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';
import type { DfaRow } from '../types/reportPayload';

// ── A4 Landscape boyutları (pt) ──
const PAGE_WIDTH_PT = 842;
const PAGE_HEIGHT_PT = 595;

// ── Tipler ──

export interface AnalysisReportPdfOpts {
  /** Harita görüntüsü (base64, data URI veya ham base64) */
  mapScreenshotBase64: string;
  /** Konum bilgileri */
  location: {
    il: string;
    ilce: string;
    mahalle: string;
    ada: string;
    parsel: string;
    area: string;
  };
  /** Fiyat bilgileri */
  pricing: {
    unitPrice: number | null;
    totalPrice: number | null;
  };
  /** Mobil DfaRow dizisi (desc + kind + details) — valuationSteps boş olduğunda fallback */
  dfaRows: DfaRow[];
  /** Ham valuation_steps (DFA tablosunda yüzde/fiyat göstermek için) */
  valuationSteps: any[];
  /** Arazi alanı m² */
  areaM2: number;
  /** Firma adı */
  companyName?: string;
  /** Firma logo URL (opsiyonel) */
  companyLogoUrl?: string;
  /** Kullanıcı adı soyadı */
  userName?: string;
  /** Kullanıcı telefonu */
  userPhone?: string;
  /** Kullanıcı avatar URL (opsiyonel) */
  userAvatarUrl?: string;
  /** Fiyat değerlendirmesi (varsa) */
  priceComment?: { lines: string[]; isRamsar: boolean; ramsarText: string | null } | null;
  /** PDF dosya adı (opsiyonel) */
  fileName?: string;
}

// ── Yardımcılar ──

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtTL0(n: any): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return '₺' + Math.round(v).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
}

function pctTextFromFactor(appliedFactor: any): string {
  const f = Number(appliedFactor);
  if (!Number.isFinite(f) || f === 1) return '%0';
  const pct = Math.abs((f - 1) * 100);
  const sign = f > 1 ? '+' : '-';
  const abs0 = Math.round(pct);
  const abs1 = Math.round(pct * 10) / 10;
  const showDecimal = Math.abs(abs1 - abs0) >= 0.1;
  return (
    sign +
    '%' +
    (showDecimal
      ? abs1.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : abs0.toLocaleString('tr-TR', { maximumFractionDigits: 0 }))
  );
}

function nowDateStr(): string {
  return new Date().toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function resolveImgSrc(base64: string): string {
  if (!base64) return '';
  if (base64.startsWith('data:')) return base64;
  if (base64.startsWith('http://') || base64.startsWith('https://')) return base64;
  if (base64.startsWith('file://') || base64.startsWith('/')) return base64;
  return `data:image/png;base64,${base64}`;
}

// ── DFA tablosu satırlarını valuation_steps'ten oluştur ──

interface DfaTableRow {
  desc: string;
  pct: string;
  unit: string;
  total: string;
  kind: 'initial' | 'inc' | 'dec' | 'warn' | 'neutral';
}

/** Güvenli sayı okuma — string "1.234,56" veya number kabul eder */
function safeNum(v: any): number {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(s);
}

/** Adımdan (step) birim fiyat çek — birden fazla alan adı dener */
function getUnitPrice(step: any, field: 'prev' | 'new'): number {
  if (field === 'prev') {
    return safeNum(step.prev_avg ?? step.previous_avg ?? step.prevAvg ?? step.prev_unit_price ?? step.unit_price_before);
  }
  return safeNum(step.new_avg ?? step.newAvg ?? step.new_unit_price ?? step.unit_price ?? step.unit_price_after);
}

/** Adımdan (step) toplam fiyat çek */
function getTotalPrice(step: any, field: 'prev' | 'new'): number {
  if (field === 'prev') {
    return safeNum(step.prev_total ?? step.previous_total ?? step.prevTotal ?? step.total_price_before);
  }
  return safeNum(step.new_total ?? step.newTotal ?? step.total_price ?? step.total_price_after);
}

/** Adımdan factor çek */
function getFactor(step: any): number {
  return safeNum(step.applied_factor ?? step.factor ?? step.appliedFactor);
}

function buildDfaTableRows(steps: any[], areaM2: number): DfaTableRow[] {
  if (!Array.isArray(steps) || steps.length === 0) return [];
  const rows: DfaTableRow[] = [];

  const first = steps[0] || {};
  const initAvg = getUnitPrice(first, 'prev');
  const initTotalRaw = getTotalPrice(first, 'prev');
  const initTotal = Number.isFinite(initTotalRaw)
    ? initTotalRaw
    : (Number.isFinite(areaM2) && areaM2 > 0 && Number.isFinite(initAvg) ? initAvg * areaM2 : NaN);

  // İlk satır: new_avg varsa onu kullan, yoksa prev_avg
  const firstAvgDisplay = Number.isFinite(getUnitPrice(first, 'new')) ? getUnitPrice(first, 'new') : initAvg;
  const firstTotalDisplay = Number.isFinite(getTotalPrice(first, 'new'))
    ? getTotalPrice(first, 'new')
    : (Number.isFinite(areaM2) && areaM2 > 0 && Number.isFinite(firstAvgDisplay) ? firstAvgDisplay * areaM2 : initTotal);

  if (Number.isFinite(firstAvgDisplay)) {
    const f0 = getFactor(first);
    const pct0 = Number.isFinite(f0) && Math.abs(f0 - 1) >= 1e-6 ? pctTextFromFactor(f0) : '%0';
    rows.push({
      desc: String(first.note || first.title || first.key || 'Başlangıç'),
      pct: pct0,
      unit: fmtTL0(firstAvgDisplay),
      total: Number.isFinite(firstTotalDisplay) ? fmtTL0(firstTotalDisplay) : '',
      kind: 'initial',
    });
  }

  for (let i = 1; i < steps.length; i++) {
    const it = steps[i] || {};
    const desc = String(it.note || it.title || it.key || 'Adım');
    const f = getFactor(it);
    const pct = pctTextFromFactor(f);
    const newAvg = getUnitPrice(it, 'new');
    let newTotal = getTotalPrice(it, 'new');
    if (!Number.isFinite(newTotal) && Number.isFinite(areaM2) && areaM2 > 0 && Number.isFinite(newAvg)) {
      newTotal = newAvg * areaM2;
    }

    let kind: DfaTableRow['kind'] = 'neutral';
    const dl = desc.toLowerCase();
    if (dl.includes('uyarı') || dl.includes('sarı')) kind = 'warn';
    else if (Number.isFinite(f) && Math.abs(f - 1) >= 1e-6) {
      kind = f > 1 ? 'inc' : 'dec';
    } else if (pct.startsWith('+')) kind = 'inc';
    else if (pct.startsWith('-')) kind = 'dec';

    rows.push({
      desc,
      pct,
      unit: Number.isFinite(newAvg) ? fmtTL0(newAvg) : '',
      total: Number.isFinite(newTotal) ? fmtTL0(newTotal) : '',
      kind,
    });
  }

  return rows;
}

// ── CSS — web v4'ten adapte, inline ──

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Helvetica Neue", sans-serif;
  color: #1f2937;
  background: #fff;
}

.page {
  width: ${PAGE_WIDTH_PT}pt;
  height: ${PAGE_HEIGHT_PT}pt;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  page-break-after: always;
}
.page:last-child { page-break-after: auto; }

/* ── Header (topbar) ── */
.page-topbar {
  height: 42pt;
  padding: 0 14pt;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
  background:
    radial-gradient(400pt 110pt at 15% 50%, rgba(59,130,246,.22), transparent 70%),
    radial-gradient(350pt 110pt at 85% 50%, rgba(2,60,105,.20), transparent 70%),
    linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-bottom: 2pt solid #3b82f6;
}
.brand { display: flex; flex-direction: column; line-height: 1.1; }
.brand .name { font-weight: 700; font-size: 13pt; letter-spacing: 0.2pt; }
.brand .tag { margin-top: 2pt; font-size: 8pt; color: rgba(255,255,255,.65); font-weight: 400; }
.topbar-right { display: flex; flex-direction: column; text-align: right; line-height: 1.2; }
.header-title { font-size: 11pt; color: #f8fafc; font-weight: 600; }
.header-date { font-size: 8pt; color: #94a3b8; margin-top: 1pt; }

/* ── Page body — golden ratio grid ── */
.page-body {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 10pt;
  padding: 10pt;
}
.left {
  width: 61.8%;
  border-radius: 10pt;
  overflow: hidden;
  position: relative;
  background:
    radial-gradient(600pt 300pt at 20% 10%, rgba(59,130,246,.18), transparent 60%),
    radial-gradient(500pt 280pt at 80% 80%, rgba(2,60,105,.18), transparent 55%),
    linear-gradient(135deg, #0f172a 0%, #111827 100%);
}
.right {
  width: 38.2%;
  border-radius: 10pt;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  border: 1pt solid #edf2f7;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.content {
  padding: 10pt 10pt 8pt 10pt;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ── Map area ── */
.map-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.map-header {
  position: absolute;
  left: 0; right: 0; top: 0;
  padding: 8pt 10pt;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8pt;
  background: linear-gradient(180deg, rgba(0,0,0,.42) 0%, rgba(0,0,0,0) 100%);
  z-index: 2;
}
.map-title { color: #fff; font-size: 9pt; font-weight: 500; opacity: .95; }
.map-sub { margin-top: 2pt; color: rgba(255,255,255,.70); font-size: 8pt; }
.map-badges { display: flex; gap: 5pt; align-items: center; flex-wrap: wrap; }
.badge {
  font-size: 8pt; padding: 4pt 7pt; border-radius: 999pt;
  border: 1pt solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92); font-weight: 450;
}

/* ── Company Card ── */
.company-card {
  margin-top: 6pt;
  display: flex;
  align-items: center;
  gap: 10pt;
  padding: 8pt 10pt;
  border: 1pt solid #edf2f7;
  border-radius: 10pt;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
}
.company-card__logo {
  width: 36pt; height: 36pt; border-radius: 8pt;
  object-fit: contain; border: 1pt solid rgba(15,23,42,.06);
  background: #fff; flex-shrink: 0;
}
.company-card__logo-placeholder {
  width: 36pt; height: 36pt; border-radius: 8pt;
  border: 1pt dashed rgba(15,23,42,.12);
  background: #f1f5f9;
  display: flex; align-items: center; justify-content: center;
  color: #9ca3af; font-size: 14pt; font-weight: 700;
  flex-shrink: 0;
}
.company-card__name {
  flex: 1; font-size: 13pt; font-weight: 700;
  color: #1e293b; letter-spacing: 0.2pt; line-height: 1.25;
}

/* ── User Card ── */
.user-card {
  margin-top: 6pt;
  display: flex;
  align-items: center;
  gap: 8pt;
  padding: 7pt 10pt;
  border: 1pt solid #edf2f7;
  border-radius: 8pt;
  background: #ffffff;
}
.user-card__avatar {
  width: 32pt; height: 32pt; border-radius: 50%;
  object-fit: cover; border: 1.5pt solid #3b82f6;
  background: #fff; flex-shrink: 0;
}
.user-card__avatar-placeholder {
  width: 32pt; height: 32pt; border-radius: 50%;
  border: 1.5pt dashed rgba(15,23,42,.12);
  background: #f1f5f9;
  display: flex; align-items: center; justify-content: center;
  color: #9ca3af; font-size: 12pt; font-weight: 700;
  flex-shrink: 0;
}
.user-card__info { display: flex; flex-direction: column; gap: 1pt; }
.user-card__name {
  font-size: 10pt; font-weight: 600; color: #1e293b;
  letter-spacing: 0.1pt;
}
.user-card__meta {
  display: flex; align-items: center; gap: 4pt;
  font-size: 9pt; color: #6b7280; line-height: 1.35;
}

/* ── Price Card ── */
.prices { padding: 10pt 0 0 0; display: flex; flex-direction: column; gap: 8pt; flex: 1; }
.price-card {
  position: relative;
  border-radius: 10pt;
  padding: 12pt 12pt 10pt 12pt;
  overflow: hidden;
  background:
    radial-gradient(250pt 100pt at 15% 40%, rgba(59,130,246,.10), transparent 65%),
    radial-gradient(220pt 100pt at 90% 65%, rgba(2,60,105,.08), transparent 65%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1pt solid rgba(59,130,246,.12);
}
.price-card-border {
  position: absolute; left: 0; top: 0; bottom: 0; width: 2.5pt;
  background: linear-gradient(180deg, #3b82f6 0%, #1e40af 100%);
  border-radius: 2.5pt 0 0 2.5pt;
}
.pc-head { display: flex; align-items: center; justify-content: space-between; gap: 6pt; margin-bottom: 8pt; }
.pc-title { font-size: 10pt; font-weight: 600; color: #1e293b; }
.pc-unit { font-size: 8pt; color: #9ca3af; font-weight: 450; }
.pc-value-wrap { display: flex; align-items: center; gap: 7pt; }
.pc-dot { width: 6pt; height: 6pt; border-radius: 999pt; background: #3b82f6; opacity: .9; }
.pc-value { font-size: 22pt; font-weight: 700; color: #0f172a; letter-spacing: -0.2pt; line-height: 1.1; }
.pc-unit-sub {
  margin-top: 7pt; padding-top: 5pt;
  border-top: 1pt solid rgba(59,130,246,.08);
  font-size: 9pt; color: #475569; font-weight: 500;
}

/* ── Price Comment ── */
.price-comment { margin-top: 6pt; font-size: 8.5pt; color: #374151; line-height: 1.45; }
.price-comment-line { margin-bottom: 3pt; }
.price-comment-ramsar { color: #dc2626; font-weight: 700; margin-top: 4pt; }

/* ── Footer ── */
.r-footer { margin-top: auto; padding-top: 6pt; }
.r-footer-line { height: 1pt; background: #edf2f7; margin-bottom: 5pt; }
.r-footer-row {
  display: flex; align-items: center; gap: 6pt;
  font-size: 8pt; color: #6b7280;
}
.r-footer-brand { color: #1e293b; font-weight: 550; }
.dot { color: #cbd5e1; }
.spacer { flex: 1; }
.page-no { color: #1e293b; font-weight: 450; }

/* ══════════════════════════════════
   SAYFA 2: DFA TABLOSU
   ══════════════════════════════════ */
.page-dfa .page-body {
  padding: 10pt 14pt;
  display: flex;
  flex-direction: column;
}
.dfa-section-title {
  font-size: 12pt; font-weight: 700; color: #0f172a;
  margin-bottom: 8pt;
}
.dfa-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
  background: #fff;
  border: 1pt solid #e5e7eb;
  border-radius: 8pt;
  overflow: hidden;
}
.dfa-table thead th {
  text-align: left;
  padding: 7pt 10pt;
  font-weight: 650;
  color: #0f172a;
  background: linear-gradient(180deg, #f8fafc, #ffffff);
  border-bottom: 1pt solid #e5e7eb;
  white-space: nowrap;
}
.dfa-table tbody td {
  padding: 6pt 10pt;
  border-bottom: 1pt solid #f1f5f9;
  color: #0f172a;
  vertical-align: top;
}
.dfa-table tbody tr:last-child td { border-bottom: none; }

/* ── DFA satır renklendirmeleri ── */
.dfa-initial {
  background: linear-gradient(90deg, #f1f5f9, #f8fafc);
}
.dfa-initial td { color: #475569; font-weight: 550; }

.dfa-inc {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.03));
}
.dfa-inc td { color: #064e3b; }
.dfa-inc td:nth-child(2) { color: #059669; font-weight: 700; }
.dfa-inc td:first-child { border-left: 2.5pt solid #10b981; }

.dfa-dec {
  background: linear-gradient(90deg, rgba(249, 115, 22, 0.08), rgba(249, 115, 22, 0.03));
}
.dfa-dec td { color: #7c2d12; }
.dfa-dec td:nth-child(2) { color: #ea580c; font-weight: 700; }
.dfa-dec td:first-child { border-left: 2.5pt solid #f97316; }

.dfa-warn {
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.10), rgba(245, 158, 11, 0.04));
}
.dfa-warn td { color: #78350f; }
.dfa-warn td:nth-child(2) { color: #d97706; font-weight: 700; }
.dfa-warn td:first-child { border-left: 2.5pt solid #f59e0b; }

.dfa-neutral td:first-child { border-left: 2.5pt solid transparent; }
`;

// ── HTML Builder ──

export function buildAnalysisReportHtml(opts: AnalysisReportPdfOpts): string {
  const {
    mapScreenshotBase64,
    location,
    pricing,
    valuationSteps,
    areaM2,
    companyName = 'ProParcel',
    companyLogoUrl = '',
    userName = '',
    userPhone = '',
    userAvatarUrl = '',
    priceComment,
    dfaRows,
  } = opts;

  const dateStr = nowDateStr();
  const mapSrc = resolveImgSrc(mapScreenshotBase64);
  const totalPriceText = pricing.totalPrice != null ? fmtTL0(pricing.totalPrice) : '—';
  const unitPriceText = pricing.unitPrice != null
    ? `Birim fiyat: ${fmtTL0(pricing.unitPrice)}/m²`
    : '';
  const areaText = areaM2 > 0
    ? `${Math.round(areaM2).toLocaleString('tr-TR')} m²`
    : (location.area && location.area !== '-' ? location.area : '— m²');

  // Firma ilk harfi (logo placeholder)
  const companyInitial = escHtml((companyName || 'P')[0].toUpperCase());
  // Kullanıcı ilk harfi
  const userInitial = escHtml((userName || 'K')[0].toUpperCase());

  // Avatar & logo
  const avatarSrc = resolveImgSrc(userAvatarUrl);
  const logoSrc = resolveImgSrc(companyLogoUrl);

  // DFA tablo satırları: önce valuation_steps'ten dene, boşsa dfaRows fallback
  const dfaTableRows = buildDfaTableRows(valuationSteps, areaM2);
  const useDfaFallback = dfaTableRows.length === 0 && Array.isArray(dfaRows) && dfaRows.length > 0;

  // Fiyat değerlendirmesi HTML
  let priceCommentHtml = '';
  if (priceComment && priceComment.lines.length > 0) {
    const linesHtml = priceComment.lines
      .map(l => `<div class="price-comment-line">${escHtml(l)}</div>`)
      .join('');
    const ramsarHtml = priceComment.isRamsar && priceComment.ramsarText
      ? `<div class="price-comment-ramsar">⚠ ${escHtml(priceComment.ramsarText)}</div>`
      : '';
    priceCommentHtml = `<section class="price-comment">${linesHtml}${ramsarHtml}</section>`;
  }

  // DFA tablo HTML
  const dfaHead = `<tr><th>Açıklama</th><th>Yüzde</th><th>Birim Fiyat</th><th>Toplam Fiyat</th></tr>`;
  const dfaBody = dfaTableRows
    .map(r => {
      const cls =
        r.kind === 'initial' ? 'dfa-initial'
        : r.kind === 'inc' ? 'dfa-inc'
        : r.kind === 'dec' ? 'dfa-dec'
        : r.kind === 'warn' ? 'dfa-warn'
        : '';
      return `<tr class="${cls}"><td>${escHtml(r.desc)}</td><td>${escHtml(r.pct)}</td><td>${escHtml(r.unit)}</td><td>${escHtml(r.total)}</td></tr>`;
    })
    .join('\n');

  // Konum metni
  const locationParts = [location.il, location.ilce, location.mahalle]
    .filter(x => x && x !== '-')
    .join(', ');

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <style>${CSS}</style>
</head>
<body>

  <!-- ════════ SAYFA 1: ANA SAYFA ════════ -->
  <div class="page page-home">
    <div class="page-topbar">
      <div class="brand">
        <div class="name">ProParcel</div>
        <div class="tag">Arazi Değerlendirme</div>
      </div>
      <div class="topbar-right">
        <div class="header-title">Analiz Raporu</div>
        <div class="header-date">${escHtml(dateStr)}</div>
      </div>
    </div>

    <div class="page-body">
      <!-- Sol: Harita -->
      <section class="left">
        <div class="map-header">
          <div>
            <div class="map-title">Harita</div>
            <div class="map-sub">${escHtml(locationParts)}</div>
          </div>
          <div class="map-badges">
            <div class="badge">Ada ${escHtml(location.ada || '-')}</div>
            <div class="badge">Parsel ${escHtml(location.parsel || '-')}</div>
            <div class="badge">${escHtml(areaText)}</div>
          </div>
        </div>
        ${mapSrc
          ? `<img class="map-img" src="${mapSrc}" alt="Harita" />`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8pt;">
              <div style="font-size:32pt;opacity:.3;">🗺</div>
              <div style="color:rgba(255,255,255,.45);font-size:9pt;font-weight:500;">${escHtml(locationParts)}</div>
            </div>`
        }
      </section>

      <!-- Sağ: İçerik -->
      <aside class="right">
        <div class="content">
          <!-- Firma Kartı -->
          <section class="company-card">
            ${logoSrc
              ? `<img class="company-card__logo" src="${logoSrc}" alt="Logo" />`
              : `<div class="company-card__logo-placeholder">${companyInitial}</div>`
            }
            <div class="company-card__name">${escHtml(companyName)}</div>
          </section>

          <!-- Kullanıcı Kartı -->
          ${userName ? `
          <section class="user-card">
            ${avatarSrc
              ? `<img class="user-card__avatar" src="${avatarSrc}" alt="Avatar" />`
              : `<div class="user-card__avatar-placeholder">${userInitial}</div>`
            }
            <div class="user-card__info">
              <div class="user-card__name">${escHtml(userName)}</div>
              ${userPhone ? `<div class="user-card__meta">${escHtml(userPhone)}</div>` : ''}
            </div>
          </section>
          ` : ''}

          <!-- Fiyat Kartı -->
          <section class="prices">
            <div class="price-card">
              <div class="price-card-border"></div>
              <div class="pc-head">
                <div class="pc-title">Toplam Fiyat</div>
                <div class="pc-unit">tahmini toplam değer</div>
              </div>
              <div class="pc-value-wrap">
                <div class="pc-dot"></div>
                <div class="pc-value">${escHtml(totalPriceText)}</div>
              </div>
              ${unitPriceText ? `<div class="pc-unit-sub">${escHtml(unitPriceText)}</div>` : ''}
            </div>
          </section>

          ${priceCommentHtml}

          <footer class="r-footer">
            <div class="r-footer-line"></div>
            <div class="r-footer-row">
              <span class="r-footer-brand">ProParcel</span>
              <span class="dot">·</span>
              <span>Arazi Değerlendirme</span>
              <span class="spacer"></span>
              <span class="page-no">Sayfa 1</span>
            </div>
          </footer>
        </div>
      </aside>
    </div>
  </div>

  <!-- ════════ SAYFA 2: DFA TABLOSU ════════ -->
  <div class="page page-dfa">
    <div class="page-topbar">
      <div class="brand">
        <div class="name">ProParcel</div>
        <div class="tag">Arazi Değerlendirme</div>
      </div>
      <div class="topbar-right">
        <div class="header-title">Detaylı Fiyat Analizi</div>
        <div class="header-date">${escHtml(dateStr)}</div>
      </div>
    </div>

    <div class="page-body" style="padding:10pt 14pt; display:flex; flex-direction:column;">
      <div class="dfa-section-title">Detaylı Fiyat Analizi (DFA)</div>
      ${dfaTableRows.length > 0 ? `
      <table class="dfa-table">
        <thead>${dfaHead}</thead>
        <tbody>${dfaBody}</tbody>
      </table>
      ` : useDfaFallback ? `
      <table class="dfa-table">
        <thead><tr><th style="width:70%">Açıklama</th><th style="width:30%">Durum</th></tr></thead>
        <tbody>${dfaRows.map(r => {
          const cls =
            r.kind === 'initial' ? 'dfa-initial'
            : r.kind === 'inc' ? 'dfa-inc'
            : r.kind === 'dec' ? 'dfa-dec'
            : r.kind === 'warn' ? 'dfa-warn'
            : '';
          const statusText =
            r.kind === 'initial' ? 'Başlangıç'
            : r.kind === 'inc' ? '▲ Artış'
            : r.kind === 'dec' ? '▼ Azalış'
            : r.kind === 'warn' ? '⚠ Uyarı'
            : '—';
          const detailsHtml = r.details && r.details.length > 0
            ? `<div style="font-size:7.5pt; color:#6b7280; margin-top:3pt;">${r.details.map(d => escHtml(d)).join('; ')}</div>`
            : '';
          return `<tr class="${cls}"><td>${escHtml(r.desc)}${detailsHtml}</td><td style="font-weight:600;text-align:center;">${statusText}</td></tr>`;
        }).join('\n')}</tbody>
      </table>
      ` : '<div style="color:#6b7280; font-size:10pt; padding:16pt 0;">DFA verisi bulunamadı.</div>'}

      <footer class="r-footer" style="margin-top:auto; padding-top:10pt;">
        <div class="r-footer-line"></div>
        <div class="r-footer-row">
          <span class="r-footer-brand">ProParcel</span>
          <span class="dot">·</span>
          <span>Arazi Değerlendirme</span>
          <span class="spacer"></span>
          <span class="page-no">Sayfa 2</span>
        </div>
      </footer>
    </div>
  </div>

</body>
</html>
  `.trim();
}

// ── Ana harita görüntüsünü temp dosyaya yaz (iOS için) ──

async function writeImageToTempFile(base64: string): Promise<string> {
  const clean = base64.startsWith('data:')
    ? base64.replace(/^data:image\/\w+;base64,/, '')
    : base64;
  const filename = `report_map_${Date.now()}.png`;
  const path = `${RNFS.CachesDirectoryPath}/${filename}`;
  await RNFS.writeFile(path, clean, 'base64');
  return path;
}

// ── PDF Üretimi ──

export async function generateAnalysisReportPdf(
  opts: AnalysisReportPdfOpts,
): Promise<{ pdfUri: string; filename: string }> {
  // iOS'ta büyük base64 görseller sorun çıkarabiliyor — temp file kullan
  let imageFilePath: string | null = null;
  let optsWithFile = { ...opts };

  if (Platform.OS === 'ios' && opts.mapScreenshotBase64) {
    try {
      imageFilePath = await writeImageToTempFile(opts.mapScreenshotBase64);
      optsWithFile = {
        ...opts,
        mapScreenshotBase64: `file://${imageFilePath}`,
      };
    } catch {
      // base64 ile devam et
    }
  }

  const html = buildAnalysisReportHtml(optsWithFile);

  // Dosya adı
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultBaseName = `analiz_raporu_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const rawFileName = opts.fileName?.trim();
  const filename = rawFileName
    ? (rawFileName.toLowerCase().endsWith('.pdf') ? rawFileName : `${rawFileName}.pdf`)
    : `${defaultBaseName}.pdf`;
  const baseName = filename.replace(/\.pdf$/i, '');

  const result = await RNHTMLtoPDF.convert({
    html,
    fileName: baseName,
    width: PAGE_WIDTH_PT,
    height: PAGE_HEIGHT_PT,
  });

  // Temp dosyayı temizle
  if (imageFilePath) {
    try {
      await RNFS.unlink(imageFilePath);
    } catch {
      // ignore
    }
  }

  if (!result.filePath) {
    throw new Error('PDF oluşturulamadı');
  }

  // DocumentDirectory'ye kopyala
  const destUri = `${RNFS.DocumentDirectoryPath}/${filename}`;
  try {
    await RNFS.copyFile(result.filePath, destUri);
    return { pdfUri: destUri, filename };
  } catch {
    return { pdfUri: result.filePath, filename };
  }
}
