/**
 * Web `analysis-report-v5.html` ile aynı v5 rapor motoru (html2pdf + createPdfBlobFromReport).
 * Rapor: görüntüleme | Paylaş: PDF blob → base64 → RN Share ile web ile aynı çıktı.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from '../../src/hooks/useNavigation';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_URL, FALLBACK_API_URL } from '../../config/api';
import { storageService } from '../../services/storageService';
import { authService } from '../../services/authService';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { buildReportPdfFileName } from '../../src/utils/reportPdfFileName';
import { authJsonFetch } from '../../services/apiClient';

const LOG_TAG = '[PortalV5PdfShare]';

function logPdfShare(step: string, detail?: Record<string, unknown> | string | number | boolean | null) {
  if (detail === undefined) {
    console.log(`${LOG_TAG} ${step}`);
    return;
  }
  if (typeof detail === 'object' && detail !== null) {
    console.log(`${LOG_TAG} ${step}`, detail);
    return;
  }
  console.log(`${LOG_TAG} ${step}`, { value: detail });
}

function warnPdfShare(step: string, detail?: Record<string, unknown> | string) {
  if (detail === undefined) {
    console.warn(`${LOG_TAG} ${step}`);
    return;
  }
  if (typeof detail === 'object' && detail !== null) {
    console.warn(`${LOG_TAG} ${step}`, detail);
    return;
  }
  console.warn(`${LOG_TAG} ${step}`, { value: detail });
}

function errorPdfShare(step: string, err?: unknown, extra?: Record<string, unknown>) {
  const payload =
    err instanceof Error
      ? { message: err.message, name: err.name, ...extra }
      : { err, ...extra };
  console.error(`${LOG_TAG} ${step}`, payload);
}

function getServerOrigin(): string {
  const raw = (API_URL || FALLBACK_API_URL || '').trim().replace(/\/$/, '');
  return raw;
}

/** WebView içi: mobilde çerez yok; JWT ile /api/ istekleri (authJsonFetch ile aynı mantık). */
function buildFetchInject(token: string): string {
  const t = JSON.stringify(token);
  return `
(function(){
  try { window.__PP_PLATFORM_MOBILE_APP__ = true; } catch(e) {}
  var TOKEN = ${t};
  if (!TOKEN) return;
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    init = init || {};
    var urlStr = typeof input === 'string' ? input : (input && input.url ? String(input.url) : '');
    var isApi = urlStr.indexOf('/api/') !== -1;
    if (!isApi && urlStr.indexOf('http') === 0) {
      try { isApi = new URL(urlStr).pathname.indexOf('/api/') !== -1; } catch (e) {}
    }
    if (!isApi) return origFetch.call(this, input, init);
    var headers = {};
    if (init.headers) {
      if (typeof Headers !== 'undefined' && init.headers instanceof Headers) {
        init.headers.forEach(function(v, k) { headers[k] = v; });
      } else {
        for (var k in init.headers) { if (Object.prototype.hasOwnProperty.call(init.headers, k)) headers[k] = init.headers[k]; }
      }
    }
    if (!headers.Authorization && !headers.authorization) headers.Authorization = 'Bearer ' + TOKEN;
    init.headers = headers;
    return origFetch.call(this, input, init);
  };
})();
true;
`;
}

/** A4 tasarım genişliği (report_v5_layout.css ile uyumlu); ekrana sığdırmak için zoom. */
const REPORT_DESIGN_WIDTH = 794;

/** Mobil rapor yükleme + PDF üretim zaman aşımı (ms). */
const MOBILE_PDF_TIMEOUT_MS = 360_000;
/** PDF paylaşım menüsü — kullanıcıyı dakikalarca bekletmemek için daha kısa limitler. */
const SHARE_PDF_LOAD_SOFT_TIMEOUT_MS = 45_000;
const SHARE_PDF_EXPORT_TIMEOUT_MS = 120_000;
const PDF_LIBRARY_POLL_MS = 400;
const REPORT_READY_POLL_MS = 160;
const PDF_LIBRARY_MAX_ATTEMPTS = Math.ceil(MOBILE_PDF_TIMEOUT_MS / PDF_LIBRARY_POLL_MS);
const REPORT_READY_MAX_TICKS = Math.ceil(MOBILE_PDF_TIMEOUT_MS / REPORT_READY_POLL_MS);
/** WebView: grid/konum beklerken en fazla bu süre (ms) sonra yumuşak hazır kabul et. */
const SHARE_PDF_SOFT_READY_MS = 22_000;
const GRID_READY_MAX_WAIT_MS = 2_500;
/** PDF paylaşım: web normalizePriceMapsForSnapshot ile aynı grid bekleme süresi. */
const GRID_READY_PDF_SHARE_WAIT_MS = 6_000;
/** Rapor hazır sinyali sonrası harita/katman oturması için ek süre. */
const SHARE_PDF_POST_READY_DELAY_MS = 1_500;
/** Overlay DOM'dan kalkmadan share sheet açılmasın. */
const OVERLAY_DISMISS_BEFORE_SHARE_MS = 220;
const MIN_PDF_FILE_BYTES = 50_000;

type SharePdfOverlayPhase = 'hidden' | 'report' | 'export';

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * PDF: report_share (ESM) + html2pdf defer ile geç yüklenir; kısa timeout ile "motor hazır değil" oluyordu.
 * __PP_CREATE_PDF_BLOB_V5__ ve window.html2pdf hazır olana kadar bekler, sonra üretir.
 */
function buildExportPdfInject(): string {
  return `
(function(){
  var ran = false;
  var attempts = 0;
  var maxAttempts = ${PDF_LIBRARY_MAX_ATTEMPTS};
  function ppLog(step, detail) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'pdf_share_log',
        step: step,
        detail: detail != null ? detail : null,
        ts: Date.now()
      }));
    } catch(e) {}
  }
  function sendErr(msg) {
    ppLog('export_error', { message: String(msg) });
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'pdf_error', message: String(msg)}));
    } catch(e) {}
  }
  function ready() {
    return !!(window.__PP_CREATE_PDF_BLOB_V5__ && typeof window.__PP_CREATE_PDF_BLOB_V5__ === 'function' && typeof window.html2pdf !== 'undefined');
  }
  function readyStatus() {
    return {
      hasCreateFn: !!(window.__PP_CREATE_PDF_BLOB_V5__ && typeof window.__PP_CREATE_PDF_BLOB_V5__ === 'function'),
      hasHtml2pdf: typeof window.html2pdf !== 'undefined',
      hasReportData: !!window.__REPORT_V4_DATA__
    };
  }
  ppLog('export_inject_start', readyStatus());
  function waitThenGenerate() {
    if (ran) return;
    if (!ready()) {
      attempts++;
      if (attempts === 1 || attempts % 10 === 0) {
        ppLog('export_library_waiting', { attempts: attempts, maxAttempts: maxAttempts, status: readyStatus() });
      }
      if (attempts <= maxAttempts) {
        setTimeout(waitThenGenerate, ${PDF_LIBRARY_POLL_MS});
        return;
      }
      ppLog('export_library_timeout', { attempts: attempts, status: readyStatus() });
      sendErr('PDF kütüphanesi yüklenemedi. Ağınızı kontrol edip tekrar deneyin.');
      return;
    }
    ran = true;
    ppLog('export_library_ready', { attempts: attempts });
    try {
      document.documentElement.style.zoom = '1';
      document.body.style.zoom = '1';
      document.documentElement.style.overflowX = '';
      document.body.style.overflowX = '';
    } catch(e) {}
    function sleep(ms, cb) { setTimeout(cb, ms); }
    function waitForSnapshotAssets(done) {
      ppLog('export_wait_snapshot_start');
      var startPrice = Date.now();
      function pollPrice() {
        var loading = false;
        try { loading = !!window.__REPORT_NEIGHBORHOOD_PRICE_MAP_LOADING; } catch(e) {}
        if (!loading || Date.now() - startPrice > 7000) {
          waitGrid(done);
          return;
        }
        sleep(150, pollPrice);
      }
      function waitGrid(done) {
        var needGrid = false;
        try { needGrid = !!window.__PP_REPORT_HAS_GRID_POLYGON; } catch(e) {}
        if (!needGrid) {
          settle(done);
          return;
        }
        var startG = Date.now();
        function pollGrid() {
          var ready = false;
          try { ready = window.__REPORT_QUARTER_SALES_GRID_READY === true; } catch(e) { ready = true; }
          if (ready || Date.now() - startG > ${GRID_READY_PDF_SHARE_WAIT_MS}) {
            ppLog('export_wait_grid_done', {
              ready: ready,
              elapsedMs: Date.now() - startG,
              hasGridPolygon: needGrid
            });
            settle(done);
            return;
          }
          sleep(100, pollGrid);
        }
        pollGrid();
      }
      function settle(done) {
        sleep(800, function() {
          ppLog('export_wait_snapshot_done', {
            gridReady: (function(){ try { return window.__REPORT_QUARTER_SALES_GRID_READY; } catch(e) { return null; } })()
          });
          done();
        });
      }
      pollPrice();
    }
    function startBlobGeneration() {
      ppLog('export_blob_start');
      window.__PP_CREATE_PDF_BLOB_V5__().then(function(blob) {
      if (!blob || !blob.size) {
        ran = false;
        ppLog('export_blob_empty', { size: blob && blob.size });
        sendErr('PDF oluşturulamadı (boş dosya)');
        return;
      }
      ppLog('export_blob_ok', { size: blob.size, type: blob.type || null });
      var reader = new FileReader();
      reader.onloadend = function() {
        var data = reader.result;
        var b64 = typeof data === 'string' && data.indexOf(',') >= 0 ? data.split(',')[1] : data;
        if (!b64 || b64.length < 50) {
          ppLog('export_b64_invalid', { length: b64 ? b64.length : 0 });
          sendErr('PDF verisi okunamadı');
          return;
        }
        ppLog('export_b64_ok', { length: b64.length });
        var pdfFileName = (function(){
          function norm(s){ try {
            var map={'ç':'c','Ç':'C','ğ':'g','Ğ':'G','ı':'i','I':'I','İ':'I','ö':'o','Ö':'O','ş':'s','Ş':'S','ü':'u','Ü':'U'};
            return String(s||'').replace(/[çÇğĞıİöÖşŞüÜ]/g,function(ch){return map[ch]||ch;})
              .replace(/[^0-9A-Za-z\\-\\s]/g,' ').trim().replace(/\\s+/g,' ');
          } catch(e){ return String(s||''); } }
          function num(v){ var m=String(v||'').match(/\\d+/); return m?m[0]:null; }
          var data = window.__REPORT_V4_DATA__ || window.__PP_REPORT_DATA__ || null;
          var pv = data && data.parameters_data && (data.parameters_data.parcel_values || data.parameters_data.parcel_dict);
          if (pv) {
            var mah = norm(pv.mahalleAd||pv.mahalle||pv.quarter||pv.quarter_name||'').replace(/\\s+/g,'');
            if (mah) return mah + '_' + (num(pv.adaNo||pv.ada||pv.ada_no)||'0') + '_' + (num(pv.parselNo||pv.parsel||pv.parsel_no)||'0') + '.pdf';
          }
          try {
            var place = document.getElementById('place-big-p1');
            var mahT = place ? String(place.textContent||'').trim().split('/').filter(Boolean).pop() : '';
            var adaT = document.getElementById('b-ada-p1');
            var parT = document.getElementById('b-parsel-p1');
            mah = norm(mahT).replace(/\\s+/g,'');
            if (mah) return mah + '_' + (num(adaT&&adaT.textContent)||'0') + '_' + (num(parT&&parT.textContent)||'0') + '.pdf';
          } catch(e2) {}
          return '';
        })();
        try {
          ppLog('export_post_b64');
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'pdf_base64', data: b64, fileName: pdfFileName}));
        } catch(e) {
          ppLog('export_post_b64_failed', { error: String(e && e.message ? e.message : e) });
          sendErr('PDF aktarılamadı (çok büyük olabilir)');
        }
      };
      reader.onerror = function() {
        ppLog('export_read_failed');
        sendErr('read_failed');
        ran = false;
      };
      reader.readAsDataURL(blob);
    }).catch(function(e) {
      ran = false;
      ppLog('export_blob_failed', { error: e && e.message ? e.message : String(e) });
      sendErr(e && e.message ? e.message : String(e));
    });
    }
    waitForSnapshotAssets(startBlobGeneration);
  }
  setTimeout(waitThenGenerate, 500);
})();
true;
`;
}

/**
 * Tek seferlik zoom (794px A4 → ekran genişliği); titremeyi önlemek için MutationObserver / ardışık apply yok.
 * Rapor DOM’u oturunca mobile_report_ready postMessage — RN overlay kapanır.
 */
function buildMobileViewportFitJs(sharePdfMode: boolean): string {
  const softReadyMs = sharePdfMode ? SHARE_PDF_SOFT_READY_MS : 45_000;
  const gridWaitMs = sharePdfMode ? GRID_READY_PDF_SHARE_WAIT_MS : GRID_READY_MAX_WAIT_MS;
  const enableSoftReady = sharePdfMode ? 'false' : 'true';
  return `
(function(){
  var SHARE_PDF_MODE = ${sharePdfMode ? 'true' : 'false'};
  var ENABLE_SOFT_READY = ${enableSoftReady};
  var SOFT_READY_MS = ${softReadyMs};
  var GRID_READY_MAX_WAIT_MS = ${gridWaitMs};
  var DESIGN_W = ${REPORT_DESIGN_WIDTH};
  var notified = false;
  var pollStartedAt = Date.now();
  var gridBlockedSince = null;
  function ppLog(step, detail) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'pdf_share_log',
        step: step,
        detail: detail != null ? detail : null,
        ts: Date.now()
      }));
    } catch(e) {}
  }
  ppLog('viewport_inject_start', { sharePdfMode: SHARE_PDF_MODE, softReadyMs: SOFT_READY_MS });
  try {
    document.documentElement.classList.add('pp-mobile-app-embed');
    document.body.classList.add('pp-mobile-app-embed');
    var chromeStyle = document.getElementById('pp-rn-embed-chrome');
    if (!chromeStyle) {
      chromeStyle = document.createElement('style');
      chromeStyle.id = 'pp-rn-embed-chrome';
      chromeStyle.textContent = [
        'body.pp-mobile-app-embed .tkgm-topbar #main-menu-dropdown,',
        'body.pp-mobile-app-embed .tkgm-topbar #topbarRightGroup,',
        'body.pp-mobile-app-embed .tkgm-topbar #save-dropdown,',
        'body.pp-mobile-app-embed .tkgm-topbar #wa-share-dropdown,',
        'body.pp-mobile-app-embed .tkgm-topbar .topbar-dropdown { display: none !important; }',
        'body.pp-mobile-app-embed .tkgm-topbar { padding-left: 12px; padding-right: 12px; min-height: 48px; }',
        'body.pp-mobile-app-embed #report-root { box-sizing: border-box; }',
      ].join('\\n');
      (document.head || document.documentElement).appendChild(chromeStyle);
    }
  } catch(e) {}
  function vw(){
    try {
      return Math.max(
        document.documentElement.clientWidth || 0,
        window.innerWidth || 0,
        (document.body && document.body.clientWidth) || 0
      );
    } catch(e) { return 0; }
  }
  function applyFit(){
    var w = vw();
    if (w < 280) return;
    var z = Math.min(1, w / DESIGN_W);
    try {
      document.documentElement.style.overflowX = 'hidden';
      document.body.style.overflowX = 'hidden';
      document.documentElement.style.zoom = String(z);
      document.body.style.zoom = String(z);
    } catch(e) {}
  }
  function notifyOnce(reason){
    if (notified) return;
    notified = true;
    applyFit();
    ppLog('report_notify_once', { reason: reason || 'unknown', elapsedMs: Date.now() - pollStartedAt });
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mobile_report_ready', reason: reason || 'unknown' }));
    } catch(e) {
      ppLog('report_notify_post_failed', { error: String(e && e.message ? e.message : e) });
    }
  }
  function isPlaceholderText(t){
    var s = String(t || '').trim();
    return !s || s === '—' || s === '-' || s === '...' || s === '…';
  }
  function gridReadyBlocks(){
    try {
      var hasGridPolygon = false;
      try { hasGridPolygon = !!window.__PP_REPORT_HAS_GRID_POLYGON; } catch(e) {}
      var gridReadyVal = null;
      try { gridReadyVal = window.__REPORT_QUARTER_SALES_GRID_READY; } catch(e) {}

      // PDF paylaşım: grid poligonu varsa true olana kadar bekle (web ile aynı).
      if (SHARE_PDF_MODE && hasGridPolygon) {
        if (gridReadyVal === true) {
          gridBlockedSince = null;
          return false;
        }
        if (!gridBlockedSince) gridBlockedSince = Date.now();
        return (Date.now() - gridBlockedSince) < GRID_READY_MAX_WAIT_MS;
      }

      if (gridReadyVal !== false) {
        gridBlockedSince = null;
        return false;
      }
      if (!gridBlockedSince) gridBlockedSince = Date.now();
      return (Date.now() - gridBlockedSince) < GRID_READY_MAX_WAIT_MS;
    } catch(e) { return false; }
  }
  /** API verisi + sayfa render; PDF paylaşımda konum alanı zorunlu değil */
  function reportFullyReady(){
    try {
      if (!window.__REPORT_V4_DATA__) return false;
      if (gridReadyBlocks()) return false;
      var root = document.getElementById('report-root');
      if (!root) return false;
      var pages = root.querySelectorAll('.report');
      if (!pages || pages.length < 1) return false;
      var tallPage = false;
      for (var i = 0; i < pages.length; i++) {
        if ((pages[i].scrollHeight || 0) > 220) { tallPage = true; break; }
      }
      if (!tallPage) return false;
      if (!SHARE_PDF_MODE) {
        var placeEl = root.querySelector('[data-pp-role="loc-place"]');
        if (placeEl && isPlaceholderText(placeEl.textContent)) return false;
        var adaEl = root.querySelector('[data-pp-role="loc-ada-parsel-alan"]');
        if (adaEl && isPlaceholderText(adaEl.textContent)) return false;
        var typeEl = root.querySelector('[data-pp-role="loc-property-type"]');
        if (typeEl && isPlaceholderText(typeEl.textContent)) return false;
      }
      return true;
    } catch(e) { return false; }
  }
  /** Harita/grid takılırsa PDF paylaşımı sonsuza kadar beklemesin */
  function reportSoftReady(){
    try {
      if (!window.__REPORT_V4_DATA__) return false;
      var root = document.getElementById('report-root');
      if (!root) return false;
      var pages = root.querySelectorAll('.report');
      return !!(pages && pages.length >= 1);
    } catch(e) { return false; }
  }
  function reportBlockReason(){
    try {
      if (!window.__REPORT_V4_DATA__) return 'no_report_data';
      if (gridReadyBlocks()) return 'grid_not_ready';
      var root = document.getElementById('report-root');
      if (!root) return 'no_report_root';
      var pages = root.querySelectorAll('.report');
      if (!pages || pages.length < 1) return 'no_report_pages';
      var tallPage = false;
      for (var i = 0; i < pages.length; i++) {
        if ((pages[i].scrollHeight || 0) > 220) { tallPage = true; break; }
      }
      if (!tallPage) return 'pages_not_tall';
      if (!SHARE_PDF_MODE) {
        var placeEl = root.querySelector('[data-pp-role="loc-place"]');
        if (placeEl && isPlaceholderText(placeEl.textContent)) return 'loc_place_placeholder';
        var adaEl = root.querySelector('[data-pp-role="loc-ada-parsel-alan"]');
        if (adaEl && isPlaceholderText(adaEl.textContent)) return 'loc_ada_placeholder';
        var typeEl = root.querySelector('[data-pp-role="loc-property-type"]');
        if (typeEl && isPlaceholderText(typeEl.textContent)) return 'loc_type_placeholder';
      }
      return null;
    } catch(e) { return 'status_error'; }
  }
  function reportStatus(){
    try {
      var root = document.getElementById('report-root');
      var pages = root ? root.querySelectorAll('.report') : null;
      return {
        hasReportData: !!window.__REPORT_V4_DATA__,
        gridReady: (function(){ try { return window.__REPORT_QUARTER_SALES_GRID_READY; } catch(e) { return 'err'; } })(),
        pageCount: pages ? pages.length : 0,
        blockReason: reportBlockReason(),
        fullyReady: reportFullyReady(),
        softReady: reportSoftReady(),
        elapsedMs: Date.now() - pollStartedAt
      };
    } catch(e) {
      return { blockReason: 'status_error', error: String(e && e.message ? e.message : e) };
    }
  }
  var ticks = 0;
  var maxTicks = ${REPORT_READY_MAX_TICKS};
  ppLog('report_poll_start', reportStatus());
  var poll = setInterval(function(){
    ticks++;
    if (ticks === 1 || ticks % 25 === 0) {
      ppLog('report_poll_tick', { ticks: ticks, status: reportStatus() });
    }
    if (reportFullyReady()) {
      clearInterval(poll);
      ppLog('report_fully_ready', reportStatus());
      setTimeout(function(){ notifyOnce('fully_ready'); }, 700);
    } else if (ENABLE_SOFT_READY && reportSoftReady() && (Date.now() - pollStartedAt) >= SOFT_READY_MS) {
      clearInterval(poll);
      ppLog('report_soft_ready', reportStatus());
      setTimeout(function(){ notifyOnce('soft_ready'); }, SHARE_PDF_MODE ? 400 : 700);
    } else if (ticks >= maxTicks) {
      clearInterval(poll);
      ppLog('report_poll_timeout', reportStatus());
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'mobile_report_timeout',
          message: 'Rapor hazırlanırken zaman aşımı oluştu.',
          status: reportStatus()
        }));
      } catch(e) {}
    }
  }, ${REPORT_READY_POLL_MS});
  window.addEventListener('orientationchange', function(){
    setTimeout(applyFit, 280);
  });
})();
true;
`;
}

export default function PortalV5ReportWebViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    snapshotId?: string;
    sharePdf?: string;
    mahalle?: string;
    ada?: string;
    parsel?: string;
  }>();
  const snapshotId = params.snapshotId || '';
  const sharePdf = params.sharePdf === '1';

  const pdfFilename = useMemo(
    () => buildReportPdfFileName(params.mahalle, params.ada, params.parsel),
    [params.mahalle, params.ada, params.parsel],
  );

  const webRef = useRef<WebView>(null);
  const autoShareTriggeredRef = useRef(false);
  const flowIdRef = useRef(`pdf-${Date.now()}`);
  const exportPdfInject = useMemo(() => buildExportPdfInject(), []);
  /** Görüntüleme modu: baştan overlay. PDF paylaşım: WebView oturunca overlay açılır. */
  const [loading, setLoading] = useState(!sharePdf);
  const [shareOverlayPhase, setShareOverlayPhase] = useState<SharePdfOverlayPhase>('hidden');
  /** null = auth yükleniyor; boş string = hata (olmamalı); dolu = JWT */
  const [token, setToken] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** Rapor DOM + zoom uygulandı; kullanıcı inceleyebilir / PDF paylaş aktif */
  const [contentReady, setContentReady] = useState(false);

  const flowMeta = useCallback(
    (extra?: Record<string, unknown>) => ({
      flowId: flowIdRef.current,
      snapshotId,
      sharePdf,
      loading,
      shareOverlayPhase,
      contentReady,
      exporting,
      authFailed,
      hasToken: Boolean(token),
      ...extra,
    }),
    [snapshotId, sharePdf, loading, shareOverlayPhase, contentReady, exporting, authFailed, token],
  );

  const showOverlay = sharePdf
    ? shareOverlayPhase !== 'hidden'
    : loading || exporting;

  const hideShareOverlay = useCallback(() => {
    setShareOverlayPhase('hidden');
    setLoading(false);
    setExporting(false);
  }, []);

  const openShareSheet = useCallback(
    async (fileUrl: string, filename: string, message: string) => {
      hideShareOverlay();
      await waitMs(OVERLAY_DISMISS_BEFORE_SHARE_MS);
      logPdfShare('share_open_start', { flowId: flowIdRef.current, filename, fileUrl });
      await Share.open({
        title: 'Analiz Raporu',
        message,
        url: fileUrl,
        type: 'application/pdf',
        filename,
      });
      logPdfShare('share_open_ok', { flowId: flowIdRef.current, filename });
    },
    [hideShareOverlay],
  );

  const beginShareReportOverlay = useCallback(() => {
    if (!sharePdf || contentReady) return;
    setShareOverlayPhase('report');
    logPdfShare('share_overlay_report', flowMeta());
  }, [sharePdf, contentReady, flowMeta]);

  useEffect(() => {
    logPdfShare('mount', flowMeta({ mahalle: params.mahalle, ada: params.ada, parsel: params.parsel }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    logPdfShare('auth_start', flowMeta());
    (async () => {
      let t = await storageService.getAccessToken();
      if (!t) {
        logPdfShare('auth_refresh_attempt', flowMeta());
        await authService.refreshToken();
        t = await storageService.getAccessToken();
      }
      if (cancelled) return;
      if (!t) {
        warnPdfShare('auth_failed', flowMeta());
        setAuthFailed(true);
        setToken('');
        return;
      }
      logPdfShare('auth_ok', flowMeta({ tokenPrefix: t.slice(0, 12) }));
      setToken(t);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authFailed) return;
    warnPdfShare('auth_alert_shown', flowMeta());
    Alert.alert(
      'Rapor yüklenemedi',
      'Oturum doğrulanamadı veya süresi doldu. Lütfen tekrar giriş yapıp deneyin.',
      [{ text: 'Tamam', onPress: () => router.back() }],
    );
  }, [authFailed, router]);

  const uri = useMemo(() => {
    if (!snapshotId) return '';
    const origin = getServerOrigin();
    const q = new URLSearchParams({
      from_portal: '1',
      snapshot_id: snapshotId,
      _t: String(Date.now()),
    });
    const built = `${origin}/reports/analysis-report-v5.html?${q.toString()}`;
    logPdfShare('webview_uri', { flowId: flowIdRef.current, origin, snapshotId, uri: built });
    return built;
  }, [snapshotId]);

  const fetchInject = useMemo(() => buildFetchInject(token ?? ''), [token]);
  const mobileViewportFitJs = useMemo(() => buildMobileViewportFitJs(sharePdf), [sharePdf]);

  /** PDF paylaşım: yalnızca log — contentReady zorlamaz (eksik PDF riski). */
  useEffect(() => {
    if (!sharePdf || !snapshotId || !token || authFailed || contentReady) return;
    logPdfShare('soft_load_timeout_armed', flowMeta({ timeoutMs: SHARE_PDF_LOAD_SOFT_TIMEOUT_MS, note: 'observe_only' }));
    const t = setTimeout(() => {
      if (!contentReady && !exporting) {
        warnPdfShare('soft_load_timeout_observed', flowMeta());
      }
    }, SHARE_PDF_LOAD_SOFT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [sharePdf, snapshotId, token, authFailed, contentReady, exporting, flowMeta]);

  /** RN tarafı yedek zaman aşımı (WebView mesajı gelmezse) */
  useEffect(() => {
    if (!snapshotId || !token || authFailed) return;
    const timeoutMs = sharePdf ? SHARE_PDF_LOAD_SOFT_TIMEOUT_MS + 15_000 : MOBILE_PDF_TIMEOUT_MS;
    logPdfShare('hard_load_timeout_armed', flowMeta({ timeoutMs }));
    const t = setTimeout(() => {
      if (!contentReady && !exporting) {
        errorPdfShare('hard_load_timeout_fired', undefined, flowMeta());
        hideShareOverlay();
        Alert.alert(
          'Rapor yüklenemedi',
          'Rapor hazırlanırken zaman aşımı oluştu. Lütfen tekrar deneyin.',
          [{ text: 'Tamam', onPress: () => router.back() }],
        );
      }
    }, timeoutMs);
    return () => clearTimeout(t);
  }, [snapshotId, token, authFailed, contentReady, exporting, sharePdf, router, flowMeta, hideShareOverlay]);

  /** PDF üretimi sırasında RN yedek zaman aşımı */
  useEffect(() => {
    if (!exporting) return;
    const timeoutMs = sharePdf ? SHARE_PDF_EXPORT_TIMEOUT_MS : MOBILE_PDF_TIMEOUT_MS;
    logPdfShare('export_timeout_armed', flowMeta({ timeoutMs }));
    const t = setTimeout(() => {
      errorPdfShare('export_timeout_fired', undefined, flowMeta());
      hideShareOverlay();
      Alert.alert('PDF', 'PDF oluşturulurken zaman aşımı oluştu. Lütfen tekrar deneyin.');
    }, timeoutMs);
    return () => clearTimeout(t);
  }, [exporting, sharePdf, flowMeta, hideShareOverlay]);

  const onMessage = useCallback(
    async (e: { nativeEvent: { data: string } }) => {
      try {
        const raw = e.nativeEvent.data;
        if (!raw || raw[0] !== '{') return;
        const msg = JSON.parse(raw) as {
          type?: string;
          data?: string;
          message?: string;
          fileName?: string;
          step?: string;
          detail?: unknown;
          reason?: string;
          status?: unknown;
        };

        if (msg.type === 'pdf_share_log') {
          logPdfShare(`webview:${String(msg.step || 'unknown')}`, {
            flowId: flowIdRef.current,
            detail: msg.detail ?? null,
            webTs: (msg as { ts?: number }).ts ?? null,
          });
          return;
        }

        logPdfShare(`message:${String(msg.type || 'unknown')}`, flowMeta({
          reason: msg.reason,
          message: msg.message,
          fileName: msg.fileName,
          status: msg.status,
          dataLength: msg.data ? msg.data.length : 0,
        }));

        if (msg.type === 'mobile_report_ready') {
          logPdfShare('report_ready', flowMeta({ reason: msg.reason }));
          setContentReady(true);
          if (!sharePdf) {
            setLoading(false);
          }
          return;
        }
        if (msg.type === 'mobile_report_timeout') {
          errorPdfShare('report_timeout', undefined, flowMeta({ message: msg.message, status: msg.status }));
          hideShareOverlay();
          Alert.alert('Rapor yüklenemedi', msg.message || 'Rapor hazırlanamadı.', [
            { text: 'Tamam', onPress: () => router.back() },
          ]);
          return;
        }
        if (msg.type === 'pdf_base64' && msg.data) {
          const webName = String(msg.fileName || '').trim();
          const filename =
            webName && webName.toLowerCase().endsWith('.pdf')
              ? webName
              : pdfFilename;
          const path = `${RNFS.CachesDirectoryPath}/${filename}`;
          logPdfShare('pdf_write_start', flowMeta({ filename, path, b64Length: msg.data.length }));
          await RNFS.writeFile(path, msg.data, 'base64');
          const stat = await RNFS.stat(path);
          logPdfShare('pdf_write_ok', flowMeta({ filename, path, bytes: stat.size }));
          if (!stat.size || stat.size < MIN_PDF_FILE_BYTES) {
            errorPdfShare('pdf_file_too_small', undefined, flowMeta({ filename, bytes: stat.size }));
            hideShareOverlay();
            Alert.alert('PDF', 'PDF dosyası henüz hazır değil. Lütfen tekrar deneyin.');
            return;
          }
          const fileUrl = path.startsWith('file://') ? path : `file://${path}`;
          const mahalleLabel = String(params.mahalle ?? '').trim();
          const adaLabel = String(params.ada ?? '').trim() || '0';
          const parselLabel = String(params.parsel ?? '').trim() || '0';
          const shareMessage = mahalleLabel
            ? `ProParcel Analiz Raporu — ${mahalleLabel} ${adaLabel}/${parselLabel}`
            : 'ProParcel Analiz Raporu';
          try {
            await openShareSheet(fileUrl, filename, shareMessage);
          } catch (shareErr: any) {
            if (shareErr?.message === 'User did not share' || shareErr?.message?.includes('cancel') || shareErr?.code === 'ECANCELLED') {
              logPdfShare('share_cancelled', flowMeta({ filename }));
              router.back();
              return;
            }
            throw shareErr;
          }
          try {
            const coinRes = await authJsonFetch('/api/coin-events/report-pdf-share-completed/', {
              method: 'POST',
              json: {
                share_hash: `${snapshotId}-${Date.now()}`,
                snapshot_id: snapshotId,
              },
            });
            logPdfShare('coin_event_result', flowMeta({ ok: coinRes.ok, error: coinRes.ok ? null : coinRes.error }));
          } catch (coinErr) {
            warnPdfShare('coin_event_failed', flowMeta({ error: coinErr instanceof Error ? coinErr.message : String(coinErr) }));
          }
          logPdfShare('flow_complete', flowMeta({ filename }));
          router.back();
        } else if (msg.type === 'pdf_error') {
          errorPdfShare('pdf_error', undefined, flowMeta({ message: msg.message }));
          hideShareOverlay();
          Alert.alert('PDF', msg.message || 'PDF oluşturulamadı.');
        }
      } catch (err: any) {
        errorPdfShare('on_message_failed', err, flowMeta());
        hideShareOverlay();
        Alert.alert('Hata', err?.message || 'İşlem başarısız.');
      }
    },
    [router, snapshotId, pdfFilename, params.mahalle, params.ada, params.parsel, flowMeta, sharePdf, hideShareOverlay, openShareSheet],
  );

  const handleSharePdfPress = useCallback(() => {
    if (!sharePdf || exporting || !contentReady) {
      warnPdfShare('export_skipped', flowMeta({
        reason: !sharePdf ? 'not_share_mode' : exporting ? 'already_exporting' : 'content_not_ready',
      }));
      return;
    }
    logPdfShare('export_start', flowMeta());
    setExporting(true);
    setShareOverlayPhase('export');
    setTimeout(() => {
      if (!webRef.current) {
        errorPdfShare('export_inject_failed', undefined, flowMeta({ reason: 'web_ref_missing' }));
        hideShareOverlay();
        Alert.alert('PDF', 'Rapor görünümü hazır değil. Lütfen tekrar deneyin.');
        return;
      }
      logPdfShare('export_inject', flowMeta());
      webRef.current.injectJavaScript(exportPdfInject);
    }, 120);
  }, [sharePdf, exporting, contentReady, exportPdfInject, flowMeta, hideShareOverlay]);

  /** PDF Paylaş menüsünden gelince rapor oturduktan sonra PDF üret */
  useEffect(() => {
    if (!sharePdf || !contentReady || exporting || autoShareTriggeredRef.current) return;
    autoShareTriggeredRef.current = true;
    logPdfShare('auto_share_scheduled', flowMeta({ delayMs: SHARE_PDF_POST_READY_DELAY_MS }));
    const t = setTimeout(() => handleSharePdfPress(), SHARE_PDF_POST_READY_DELAY_MS);
    return () => clearTimeout(t);
  }, [sharePdf, contentReady, exporting, handleSharePdfPress, flowMeta]);

  if (!snapshotId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rapor</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errText}>Geçersiz sorgu.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (token === null && !authFailed) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      </SafeAreaView>
    );
  }

  if (authFailed || !token) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rapor</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errText}>Oturum gerekli</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={20} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {sharePdf
            ? shareOverlayPhase === 'export' || exporting
              ? 'PDF oluşturuluyor…'
              : shareOverlayPhase === 'report'
                ? 'Rapor hazırlanıyor…'
                : 'PDF Paylaş'
            : exporting
              ? 'PDF oluşturuluyor…'
              : 'Analiz Raporu'}
        </Text>
        <View style={styles.headerRight}>
          {sharePdf && contentReady && !exporting ? (
            <TouchableOpacity
              onPress={handleSharePdfPress}
              style={styles.headerShareBtn}
              accessibilityLabel="PDF paylaş"
              accessibilityRole="button"
            >
              <Ionicons name="share-outline" size={20} color="#38bdf8" />
              <Text style={styles.headerShareText}>PDF Paylaş</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerRightSpacer} />
          )}
        </View>
      </View>
      <View style={styles.webWrap}>
        {showOverlay && (
          <View style={styles.loaderWrap} pointerEvents="auto">
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.loaderHint}>
              {shareOverlayPhase === 'export' || exporting
                ? 'PDF oluşturuluyor (web ile aynı şablon)…'
                : sharePdf
                  ? 'Rapor hazırlanıyor, paylaşım için bekleyin…'
                  : 'Rapor yükleniyor…'}
            </Text>
          </View>
        )}
        <WebView
          ref={webRef}
          key={`${snapshotId}-${token.slice(0, 12)}`}
          source={{ uri }}
          style={[styles.web, (showOverlay || sharePdf) && styles.webHidden]}
          injectedJavaScriptBeforeContentLoaded={fetchInject}
          injectedJavaScript={mobileViewportFitJs}
          onMessage={onMessage}
          onLoadStart={() => {
            logPdfShare('webview_load_start', flowMeta({ uri }));
          }}
          onLoadEnd={() => {
            logPdfShare('webview_load_end', flowMeta({ uri }));
            if (sharePdf && !contentReady) {
              beginShareReportOverlay();
            } else if (!sharePdf && !contentReady) {
              setLoading(true);
            }
          }}
          onError={(event) => {
            errorPdfShare('webview_error', undefined, flowMeta({
              uri,
              description: event.nativeEvent.description,
              code: event.nativeEvent.code,
              domain: event.nativeEvent.domain,
            }));
            hideShareOverlay();
            Alert.alert('Rapor yüklenemedi', 'Rapor sayfası açılamadı. Lütfen tekrar deneyin.', [
              { text: 'Tamam', onPress: () => router.back() },
            ]);
          }}
          onHttpError={(event) => {
            errorPdfShare('webview_http_error', undefined, flowMeta({
              uri,
              statusCode: event.nativeEvent.statusCode,
              description: event.nativeEvent.description,
            }));
            hideShareOverlay();
            Alert.alert('Rapor yüklenemedi', 'Rapor sunucusuna ulaşılamadı. Lütfen tekrar deneyin.', [
              { text: 'Tamam', onPress: () => router.back() },
            ]);
          }}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator
          bounces
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerBtn: { padding: 8, minWidth: 40 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  headerRight: { minWidth: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', maxWidth: 140 },
  headerShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 4 },
  headerShareText: { color: '#38bdf8', fontSize: 14, fontWeight: '600' },
  headerRightSpacer: { minWidth: 40 },
  webWrap: { flex: 1, position: 'relative' },
  web: { flex: 1, backgroundColor: '#0f172a' },
  webHidden: { opacity: 0 },
  loaderWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: '#0f172a',
    gap: 12,
  },
  loaderHint: { color: '#94a3b8', fontSize: 14, marginTop: 8, paddingHorizontal: 28, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errText: { color: '#94a3b8', fontSize: 15 },
});
