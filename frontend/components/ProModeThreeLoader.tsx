import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ProModeThreeLoaderProps {
  visible: boolean;
}

/**
 * ProParcel web loader (loadingScreen.html) uyarlaması:
 * - Ağır 3D terrain arka plan yok (mobilde pahalı)
 * - CSS grid/pulse background + ortada Three.js forest_house.glb (CDN) dönen sahne
 * - Altta tek satır default mesajlar döner
 */
export default function ProModeThreeLoader({ visible }: ProModeThreeLoaderProps) {
  const insets = useSafeAreaInsets();

  const html = useMemo(() => {
    const messages = [
      'Analiz başlatılıyor…',
      'Parsel geometrisi hazırlanıyor…',
      'Mahalle ve katman verileri kontrol ediliyor…',
      'Önbellek (cache) verileri kontrol ediliyor…',
      'Merkeze uzaklık analizi yapılıyor…',
      'Sınır / yapılaşma alanı mesafesi hesaplanıyor…',
      'Nehir / göl / su yolu mesafeleri ölçülüyor…',
      'Yol ağı verisi hazırlanıyor…',
      'Yol bağlantısı ve cephe bilgileri çıkarılıyor…',
      'Deniz etkisi kontrol ediliyor…',
      'Elektrik hattı etkisi hesaplanıyor…',
      'Yükselti görünümü oluşturuluyor…',
      'Parsel eğimi hesaplanıyor…',
      'Morfoloji ve yön etkileri değerlendiriliyor…',
      'Grid / satış yoğunluğu verileri hazırlanıyor…',
      'Birim fiyat / mahalle baz fiyat verisi hazırlanıyor…',
      'Değerleme motoru başlatılıyor…',
      'Kriterler uygulanıyor (yol / su / demiryolu)…',
      'Kombine çarpan ve final sonuç hesaplanıyor…',
      'Rapor sayfası hazırlanıyor…',
    ];

    // WebView içindeki HTML: CSS animasyon + (mümkünse) Three.js ile forest_house
    return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>ProParcel Loader</title>
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.161.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.161.0/examples/jsm/"
      }
    }
  </script>
  <style>
    html, body { height:100%; width:100%; margin:0; padding:0; overflow:hidden; background:#020617; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    .root { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; }

    .panel {
      width: min(560px, 92vw);
      background: rgba(15, 23, 42, 0.96);
      border-radius: 14px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.65);
      padding: 16px 16px 14px;
      display:flex;
      flex-direction:column;
      gap: 12px;
    }

    .logo {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      align-self:flex-start;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(15, 118, 110, 0.15);
      border: 1px solid rgba(45, 212, 191, 0.7);
      color: #a5f3fc;
    }
    .title { font-size: 16px; font-weight: 650; color: #f9fafb; }
    .subtitle { font-size: 13px; color: #9ca3af; }

    .map {
      position: relative;
      height: 170px;
      border-radius: 12px;
      overflow: hidden;
      background: radial-gradient(circle at 10% 0, #22c55e 0, transparent 45%),
                  radial-gradient(circle at 90% 100%, #0ea5e9 0, transparent 50%),
                  #020617;
      border: 1px solid rgba(148, 163, 184, 0.5);
    }
    .grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(90deg, rgba(148,163,184,0.28) 1px, transparent 1px),
        linear-gradient(180deg, rgba(148,163,184,0.28) 1px, transparent 1px);
      background-size: 26px 26px;
      opacity: 0.9;
      animation: gridDrift 14s linear infinite;
    }
    .pulse {
      position:absolute;
      inset: 22% 20%;
      border-radius: 18px;
      border: 1px solid rgba(56,189,248,0.8);
      box-shadow: 0 0 20px rgba(56,189,248,0.4);
      animation: pulse 1.8s ease-in-out infinite;
      display:flex;
      align-items:center;
      justify-content:center;
    }

    /* Three.js canvas */
    #pp-inner-canvas { width:100%; height:100%; display:block; }

    /* Fallback: SVG icon */
    .fallbackIcon {
      position:absolute;
      inset: 0;
      display:flex;
      align-items:center;
      justify-content:center;
      pointer-events:none;
      opacity: 0.95;
    }
    .spinSvg {
      width: 54px;
      height: 54px;
      filter: drop-shadow(0 10px 18px rgba(0,0,0,0.35));
      animation: spin 2.2s linear infinite;
    }

    .msgRow {
      display:flex;
      align-items:center;
      justify-content:center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.25);
      background: rgba(2, 6, 23, 0.35);
      min-height: 44px;
      overflow:hidden;
    }
    .msgDot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: linear-gradient(90deg, #22c55e, #22d3ee);
      box-shadow: 0 0 14px rgba(34,211,238,0.35);
      flex-shrink:0;
    }
    .msgText {
      font-size: 13px;
      color: #e2e8f0;
      font-weight: 650;
      text-align:center;
      white-space: nowrap;
      overflow:hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      opacity: 1;
      transform: translateY(0);
      transition: opacity 220ms ease, transform 220ms ease;
    }
    .msgText.fadeOut {
      opacity: 0;
      transform: translateY(4px);
    }

    @keyframes gridDrift {
      0%   { transform: translate(0, 0) scale(1); }
      50%  { transform: translate(-8px, -6px) scale(1.03); }
      100% { transform: translate(0, 0) scale(1); }
    }
    @keyframes pulse {
      0%   { transform: scale(1); opacity: 0.85; }
      50%  { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(1); opacity: 0.85; }
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* küçük ekran */
    @media (max-width: 380px) {
      .map { height: 150px; }
      .title { font-size: 15px; }
      .subtitle { font-size: 12px; }
    }
  </style>
</head>
<body>
  <div class="root">
    <div class="panel">
      <div class="logo">ProParcel</div>
      <div class="title">Arazi değerleme analizi hazırlanıyor…</div>
      <div class="subtitle">Lütfen bekleyin, kriterler değerlendiriliyor.</div>

      <div class="map">
        <div class="grid"></div>
        <div class="pulse">
          <canvas id="pp-inner-canvas"></canvas>
          <div class="fallbackIcon" id="fallbackIcon">
            <svg class="spinSvg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M31.8 52.5c-6.2 0-11.1-2.5-14.6-6.6-3.4-4.0-5.2-9.5-5.2-15.1 0-5.9 2.1-11.4 6-15.5C21.9 11.0 27.1 8.8 33 9.1c7.8.4 14.3 5.5 17.2 12.6 1.2 2.9 1.7 6.1 1.4 9.1-.3 3.0-1.4 5.9-3.1 8.4-3.3 4.7-8.8 7.8-16.7 7.8z" fill="rgba(226,232,240,0.10)"/>
              <path d="M33.5 14c-3.1-.2-6 .8-8.4 2.6-2.4 1.8-4.3 4.4-5.4 7.4-2.2 5.9-1 13.0 3.3 17.9 2.6 3.0 6.3 4.8 10.7 4.8 6.0 0 10.0-2.2 12.3-5.5 2.2-3.1 2.9-7.4 2.3-11.3-.9-6.3-6.0-13.6-14.8-13.9z" fill="rgba(34,197,94,0.28)"/>
              <path d="M32 18c3.2 3.8 4.7 7.1 4.7 10.0 0 4.9-4.3 8.7-8.7 8.7-4.0 0-7.3-3.3-7.3-7.3 0-4.9 5.8-8.7 11.3-11.4z" fill="rgba(14,165,233,0.35)"/>
              <path d="M36 44c-2.2 0-4 1.8-4 4v6.5h8V48c0-2.2-1.8-4-4-4z" fill="rgba(148,163,184,0.45)"/>
            </svg>
          </div>
        </div>
      </div>

      <div class="msgRow">
        <div class="msgDot"></div>
        <div class="msgText" id="msgText"></div>
      </div>
    </div>
  </div>

  <script>
    (function(){
      const messages = ${JSON.stringify(messages)};
      const el = document.getElementById('msgText');
      let idx = 0;
      function setMsg(next){
        if(!el) return;
        el.classList.add('fadeOut');
        setTimeout(()=>{
          el.textContent = next;
          el.classList.remove('fadeOut');
        }, 220);
      }
      setMsg(messages[0]);
      setInterval(()=>{ idx = (idx+1)%messages.length; setMsg(messages[idx]); }, 1900);
    })();
  </script>

  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

    const canvas = document.getElementById('pp-inner-canvas');
    const fallback = document.getElementById('fallbackIcon');

    function showFallback(){
      if (fallback) fallback.style.display = 'flex';
    }
    function hideFallback(){
      if (fallback) fallback.style.display = 'none';
    }

    try {
      if(!canvas) { showFallback(); throw new Error('no canvas'); }

      const rect = canvas.getBoundingClientRect();
      const aspect = rect.width / (rect.height || 1);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(rect.width, rect.height, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
      camera.position.set(1.5, 4, 9);

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
      hemiLight.position.set(0, 20, 0);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(5, 10, 7.5);
      scene.add(dirLight);

      const controls = new OrbitControls(camera, canvas);
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = false;
      controls.target.set(0, 2, 0);
      controls.update();

      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://threejs.org/examples/jsm/libs/draco/gltf/');
      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);
      loader.setPath('https://threejs.org/examples/models/gltf/AVIFTest/');

      let houseRoot = null;

      loader.load('forest_house.glb', (gltf) => {
        houseRoot = gltf.scene;
        scene.add(houseRoot);
        hideFallback();
      }, undefined, (err) => {
        console.warn('forest_house load failed', err);
        showFallback();
      });

      function resize(){
        const r = canvas.getBoundingClientRect();
        const a = r.width / (r.height || 1);
        camera.aspect = a;
        camera.updateProjectionMatrix();
        renderer.setSize(r.width, r.height, false);
      }
      window.addEventListener('resize', resize);

      function animate(){
        requestAnimationFrame(animate);
        if(houseRoot) {
          houseRoot.rotation.y += 0.005;
        }
        renderer.render(scene, camera);
      }
      animate();
    } catch (e) {
      showFallback();
    }
  </script>
</body>
</html>`;
  }, []);

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={() => {}}
    >
      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <WebView
          source={{ html }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowsFullscreenVideo={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          automaticallyAdjustContentInsets={false}
          style={styles.webview}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 99999,
    elevation: 50,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
    opacity: 1,
    ...(Platform.OS === 'android' ? { } : null),
  },
});

