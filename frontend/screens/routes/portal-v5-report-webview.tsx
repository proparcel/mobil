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

/**
 * PDF: report_share (ESM) + html2pdf defer ile geç yüklenir; kısa timeout ile "motor hazır değil" oluyordu.
 * __PP_CREATE_PDF_BLOB_V5__ ve window.html2pdf hazır olana kadar bekler, sonra üretir.
 */
const EXPORT_PDF_INJECT = `
(function(){
  var ran = false;
  var attempts = 0;
  var maxAttempts = 160;
  function sendErr(msg) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'pdf_error', message: String(msg)}));
    } catch(e) {}
  }
  function ready() {
    return !!(window.__PP_CREATE_PDF_BLOB_V5__ && typeof window.__PP_CREATE_PDF_BLOB_V5__ === 'function' && typeof window.html2pdf !== 'undefined');
  }
  function waitThenGenerate() {
    if (ran) return;
    if (!ready()) {
      attempts++;
      if (attempts <= maxAttempts) {
        setTimeout(waitThenGenerate, 400);
        return;
      }
      sendErr('PDF kütüphanesi yüklenemedi. Ağınızı kontrol edip tekrar deneyin.');
      return;
    }
    ran = true;
    try {
      document.documentElement.style.zoom = '1';
      document.body.style.zoom = '1';
      document.documentElement.style.overflowX = '';
      document.body.style.overflowX = '';
    } catch(e) {}
    window.__PP_CREATE_PDF_BLOB_V5__().then(function(blob) {
      if (!blob || !blob.size) {
        ran = false;
        sendErr('PDF oluşturulamadı (boş dosya)');
        return;
      }
      var reader = new FileReader();
      reader.onloadend = function() {
        var data = reader.result;
        var b64 = typeof data === 'string' && data.indexOf(',') >= 0 ? data.split(',')[1] : data;
        if (!b64 || b64.length < 50) {
          sendErr('PDF verisi okunamadı');
          return;
        }
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
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'pdf_base64', data: b64, fileName: pdfFileName}));
        } catch(e) {
          sendErr('PDF aktarılamadı (çok büyük olabilir)');
        }
      };
      reader.onerror = function() { sendErr('read_failed'); ran = false; };
      reader.readAsDataURL(blob);
    }).catch(function(e) {
      ran = false;
      sendErr(e && e.message ? e.message : String(e));
    });
  }
  setTimeout(waitThenGenerate, 500);
})();
true;
`;

/**
 * Tek seferlik zoom (794px A4 → ekran genişliği); titremeyi önlemek için MutationObserver / ardışık apply yok.
 * Rapor DOM’u oturunca mobile_report_ready postMessage — RN overlay kapanır.
 */
const MOBILE_VIEWPORT_FIT_JS = `
(function(){
  var DESIGN_W = ${REPORT_DESIGN_WIDTH};
  var notified = false;
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
  function notifyOnce(){
    if (notified) return;
    notified = true;
    applyFit();
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mobile_report_ready' }));
    } catch(e) {}
  }
  function rootLooksReady(){
    var root = document.getElementById('report-root');
    if (!root) return false;
    return (root.scrollHeight || 0) > 140 || (root.children && root.children.length > 0);
  }
  var ticks = 0;
  var poll = setInterval(function(){
    ticks++;
    if (rootLooksReady() || ticks >= 90) {
      clearInterval(poll);
      notifyOnce();
    }
  }, 160);
  window.addEventListener('orientationchange', function(){
    setTimeout(applyFit, 280);
  });
})();
true;
`;

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
  const [loading, setLoading] = useState(true);
  /** null = auth yükleniyor; boş string = hata (olmamalı); dolu = JWT */
  const [token, setToken] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** Rapor DOM + zoom uygulandı; kullanıcı inceleyebilir / PDF paylaş aktif */
  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let t = await storageService.getAccessToken();
      if (!t) {
        await authService.refreshToken();
        t = await storageService.getAccessToken();
      }
      if (cancelled) return;
      if (!t) {
        setAuthFailed(true);
        setToken('');
        return;
      }
      setToken(t);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authFailed) return;
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
    return `${origin}/reports/analysis-report-v5.html?${q.toString()}`;
  }, [snapshotId]);

  const fetchInject = useMemo(() => buildFetchInject(token ?? ''), [token]);

  /** Rapor yüklenmezse bile takılı kalmamak için */
  useEffect(() => {
    if (!snapshotId || !token || authFailed) return;
    const t = setTimeout(() => {
      setLoading((prev) => {
        if (!prev) return prev;
        setContentReady(true);
        return false;
      });
    }, 18000);
    return () => clearTimeout(t);
  }, [snapshotId, token, authFailed]);

  const onMessage = useCallback(
    async (e: { nativeEvent: { data: string } }) => {
      try {
        const raw = e.nativeEvent.data;
        if (!raw || raw[0] !== '{') return;
        const msg = JSON.parse(raw) as { type?: string; data?: string; message?: string; fileName?: string };
        if (msg.type === 'mobile_report_ready') {
          setContentReady(true);
          setLoading(false);
          return;
        }
        if (msg.type === 'pdf_base64' && msg.data) {
          const webName = String(msg.fileName || '').trim();
          const filename =
            webName && webName.toLowerCase().endsWith('.pdf')
              ? webName
              : pdfFilename;
          const path = `${RNFS.CachesDirectoryPath}/${filename}`;
          await RNFS.writeFile(path, msg.data, 'base64');
          setExporting(false);
          const fileUrl = path.startsWith('file://') ? path : `file://${path}`;
          const mahalleLabel = String(params.mahalle ?? '').trim();
          const adaLabel = String(params.ada ?? '').trim() || '0';
          const parselLabel = String(params.parsel ?? '').trim() || '0';
          try {
            await Share.open({
              title: 'Analiz Raporu',
              message: mahalleLabel
                ? `ProParcel Analiz Raporu — ${mahalleLabel} ${adaLabel}/${parselLabel}`
                : 'ProParcel Analiz Raporu',
              url: fileUrl,
              type: 'application/pdf',
              filename,
            });
          } catch (shareErr: any) {
            if (shareErr?.message === 'User did not share' || shareErr?.message?.includes('cancel') || shareErr?.code === 'ECANCELLED') {
              router.back();
              return;
            }
            throw shareErr;
          }
          try {
            await authJsonFetch('/api/coin-events/report-pdf-share-completed/', {
              method: 'POST',
              body: JSON.stringify({
                share_hash: `${snapshotId}-${Date.now()}`,
                snapshot_id: snapshotId,
              }),
            });
          } catch {}
          router.back();
        } else if (msg.type === 'pdf_error') {
          setExporting(false);
          Alert.alert('PDF', msg.message || 'PDF oluşturulamadı.');
        }
      } catch (err: any) {
        setExporting(false);
        Alert.alert('Hata', err?.message || 'İşlem başarısız.');
      }
    },
    [router, snapshotId, pdfFilename, params.mahalle, params.ada, params.parsel],
  );

  const handleSharePdfPress = useCallback(() => {
    if (!sharePdf || exporting || !contentReady) return;
    setExporting(true);
    setTimeout(() => {
      webRef.current?.injectJavaScript(EXPORT_PDF_INJECT);
    }, 120);
  }, [sharePdf, exporting, contentReady]);

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
          {exporting ? 'PDF oluşturuluyor…' : sharePdf ? 'Önizleme' : 'Analiz Raporu'}
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
        {loading && (
          <View style={styles.loaderWrap} pointerEvents="none">
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.loaderHint}>Rapor yükleniyor…</Text>
          </View>
        )}
        {exporting && (
          <View style={styles.pdfProgressBar} pointerEvents="none">
            <ActivityIndicator size="small" color="#38bdf8" />
            <Text style={styles.pdfProgressText}>PDF hazırlanıyor (web ile aynı şablon)…</Text>
          </View>
        )}
        <WebView
          ref={webRef}
          key={`${snapshotId}-${token.slice(0, 12)}`}
          source={{ uri }}
          style={styles.web}
          injectedJavaScriptBeforeContentLoaded={fetchInject}
          injectedJavaScript={MOBILE_VIEWPORT_FIT_JS}
          onMessage={onMessage}
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
  loaderWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    backgroundColor: 'rgba(15,23,42,0.5)',
    gap: 12,
  },
  loaderHint: { color: '#94a3b8', fontSize: 13, marginTop: 8, paddingHorizontal: 24, textAlign: 'center' },
  pdfProgressBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  pdfProgressText: { color: '#94a3b8', fontSize: 13, flex: 1, textAlign: 'center', marginLeft: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errText: { color: '#94a3b8', fontSize: 15 },
});
