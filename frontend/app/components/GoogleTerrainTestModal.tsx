import React, { useRef, useState, useEffect } from 'react';
import { Modal, StyleSheet, View, ActivityIndicator, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAPBOX_ACCESS_TOKEN } from '../../config/mapbox';
import { CESIUM_ION_TOKEN } from '../../config/cesium';

interface GoogleTerrainTestModalProps {
  visible: boolean;
  onClose: () => void;
  backendUrl?: string;
}

const TERRAIN_METHODS = [
  { id: 'mapbox-terrain', title: 'Mapbox Satellite + Cesium Terrain', description: 'Mapbox Satellite + Cesium World Terrain (CDN, sunucuya yük yok)', icon: 'layers' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_WIDTH = SCREEN_WIDTH - 32; // Tek sütun, padding dahil (16px her iki tarafta)
const GRID_ITEM_HEIGHT = 300;

const GoogleTerrainTestModal: React.FC<GoogleTerrainTestModalProps> = ({
  visible,
  onClose,
  backendUrl,
}) => {
  const insets = useSafeAreaInsets();
  const webViewRefs = useRef<{ [key: string]: WebView | null }>({});
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [errorStates, setErrorStates] = useState<{ [key: string]: string | null }>({});

  // Modal açıldığında state'leri sıfırla
  useEffect(() => {
    if (visible) {
      const initialLoading: { [key: string]: boolean } = {};
      const initialErrors: { [key: string]: string | null } = {};
      TERRAIN_METHODS.forEach(method => {
        initialLoading[method.id] = true;
        initialErrors[method.id] = null;
      });
      setLoadingStates(initialLoading);
      setErrorStates(initialErrors);
    }
  }, [visible]);

  // Mapbox Satellite + Cesium World Terrain - sunucuya sıfır yük (en doğru mimari)
  const getHTMLForMethod = (): string => {
    const initialCenter: [number, number] = [35.0, 39.0];
    const initialZoom = 15;
    const cameraHeight = 40075016.686 * Math.cos(initialCenter[1] * Math.PI / 180) / Math.pow(2, initialZoom + 1);

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link href="https://cesium.com/downloads/cesiumjs/releases/1.110/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
  <style>
    html, body { width:100%; height:100%; margin:0; padding:0; overflow:hidden; background:#000; }
    #cesiumContainer { position:absolute; inset:0; width:100%; height:100%; }
    canvas { width:100% !important; height:100% !important; display:block; }
  </style>
</head>
<body>
  <div id="cesiumContainer"></div>
  <script src="https://cesium.com/downloads/cesiumjs/releases/1.110/Build/Cesium/Cesium.js"></script>
  <script>
    (function () {
      function post(type, payload) {
        try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload })); } catch(e) {}
      }
      function log(level) {
        var args = Array.prototype.slice.call(arguments, 1).map(function(a){ return String(a); });
        post('log', { level: level, args: args });
      }
      window.onerror = function(message, source, lineno, colno, error) {
        post('error', { message: String(message), source: String(source||''), lineno: lineno||0, colno: colno||0, stack: (error && error.stack) ? String(error.stack) : '' });
      };
      window.onunhandledrejection = function(e) {
        post('error', { message: 'Unhandled promise rejection', reason: String(e && e.reason ? e.reason : ''), stack: (e && e.reason && e.reason.stack) ? String(e.reason.stack) : '' });
      };

      try {
        var testCanvas = document.createElement('canvas');
        var gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
        log('info', 'WebGL available?', !!gl);
      } catch(e) {}

      log('info', 'HTML booted');

      // Cesium Ion token - ana projeden
      window.CESIUM_ION_TOKEN = '${CESIUM_ION_TOKEN}';
      
      // Mapbox Access Token
      window.MAPBOX_ACCESS_TOKEN = '${MAPBOX_ACCESS_TOKEN}';
      
      // NOT: buildModuleUrl.setBaseUrl() KALDIRILDI
      // Bu satır Cesium'un resource loader'ını bozuyor ve absolute URL'leri bile yanlış çözümlüyor
      // WebView'de about:blank origin'inde absolute URL'ler doğru çalışır, setBaseUrl gerekmez

      var container = document.getElementById('cesiumContainer');
      if (!container) { post('error', { message: 'Container not found' }); return; }

      // Mapbox Satellite + Cesium World Terrain - sunucuya sıfır yük (CDN'den)
      (async function() {
        try {
          log('log', '[Cesium] Initializing with Mapbox Satellite + Cesium Terrain (CDN, sunucuya sıfır yük)');
          
          // Cesium Ion token ayarla
          if (typeof Cesium !== 'undefined' && window.CESIUM_ION_TOKEN) {
            Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN;
            log('log', '[Cesium] ✅ Ion token set');
          } else {
            log('warn', '[Cesium] ⚠️ Ion token not available');
          }
          
          // 3D Terrain Provider - Cesium World Terrain (ana projedeki gibi)
          // Bu CDN'den gelir, sunucuya yük bindirmez
          let terrainProvider = new Cesium.EllipsoidTerrainProvider();
          try {
            terrainProvider = await Cesium.createWorldTerrainAsync({
              requestWaterMask: true,
              requestVertexNormals: true
            });
            log('log', '[Cesium] ✅ Cesium World Terrain loaded');
          } catch (e) {
            log('warn', '[Cesium] ⚠️ Cesium World Terrain failed, using Ellipsoid:', String(e));
          }

          // Cesium viewer oluştur - önce default provider ile (ana projedeki yaklaşım)
          const viewer = new Cesium.Viewer(container, {
            terrainProvider: terrainProvider,  // Cesium World Terrain (CDN)
            // imageryProvider: default olarak Cesium Ion World Imagery kullanılacak, sonra değiştireceğiz
            baseLayerPicker: false,
            timeline: false,
            animation: false,
            geocoder: false,
            homeButton: false,
            infoBox: false,
            sceneModePicker: false,
            selectionIndicator: false,
            navigationHelpButton: false,
            fullscreenButton: false,
            requestRenderMode: false
          });

          // Mavi sky/atmosphere kapat
          viewer.scene.skyAtmosphere.show = false;
          viewer.scene.fog.enabled = false;
          viewer.scene.sun.show = false;
          viewer.scene.moon.show = false;
          viewer.scene.backgroundColor = Cesium.Color.BLACK;

          // Mapbox Satellite Imagery Provider - async olarak oluştur ve ekle
          (async function() {
            try {
              let imageryProvider;
              
              // Önce Bing Satellite (Cesium Ion) - en güvenilir, token gerekmez
              try {
                imageryProvider = await Cesium.IonImageryProvider.fromAssetId(2);
                log('log', '[Cesium] ✅ Bing Satellite provider created (Cesium Ion)');
              } catch (e) {
                log('error', '[Cesium] ❌ Bing Satellite failed, trying Mapbox:', String(e));
                
                // Fallback: Mapbox Satellite (UrlTemplateImageryProvider ile)
                if (window.MAPBOX_ACCESS_TOKEN) {
                  try {
                    const mapboxUrl = 'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.png?access_token=' + window.MAPBOX_ACCESS_TOKEN;
                    imageryProvider = new Cesium.UrlTemplateImageryProvider({
                      url: mapboxUrl,
                      credit: 'Mapbox',
                      maximumLevel: 22,
                      tileWidth: 512,
                      tileHeight: 512
                    });
                    log('log', '[Cesium] ✅ Mapbox Satellite provider created (UrlTemplate)');
                  } catch (e2) {
                    log('error', '[Cesium] ❌ Mapbox failed:', String(e2));
                    // Son fallback: Cesium Ion World Imagery
                    imageryProvider = await Cesium.IonImageryProvider.fromAssetId(2);
                    log('log', '[Cesium] ✅ Using Cesium Ion World Imagery (final fallback)');
                  }
                } else {
                  // Mapbox token yok, Cesium Ion kullan
                  imageryProvider = await Cesium.IonImageryProvider.fromAssetId(2);
                  log('log', '[Cesium] ✅ Using Cesium Ion World Imagery (no Mapbox token)');
                }
              }

              // Mevcut layer'ları kaldır ve yeni provider'ı ekle
              viewer.scene.imageryLayers.removeAll();
              const newLayer = viewer.scene.imageryLayers.addImageryProvider(imageryProvider);
              newLayer.show = true;
              newLayer.alpha = 1.0;
              log('log', '[Cesium] ✅ Imagery layer updated');
              
              // Globe'u zorla göster
              viewer.scene.globe.show = true;
              viewer.scene.requestRender();
            } catch (e) {
              log('error', '[Cesium] ❌ Failed to create imagery provider:', String(e));
            }
          })();

          // Kamerayı ayarla - ana projedeki gibi
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(${initialCenter[0]}, ${initialCenter[1]}, ${cameraHeight}),
            orientation: {
              heading: 0,
              pitch: Cesium.Math.toRadians(-45),
              roll: 0
            }
          });

          // Container resize - ana projedeki gibi
          setTimeout(function() {
            if (viewer) {
              try {
                viewer.resize();
                log('log', '[Cesium] ✅ Viewer resized');
              } catch (e) {
                log('warn', '[Cesium] Resize error:', String(e));
              }
            }
          }, 100);

          var readySent = false;
          function sendReady() {
            if (readySent) return;
            readySent = true;
            log('log', '[Cesium] ✅ Ready signal sent');
            post('cesium-ready', { providerType: 'mapbox-terrain', canvasWidth: viewer.canvas.width, canvasHeight: viewer.canvas.height });
            viewer.scene.requestRender();
          }

          viewer.scene.postRender.addEventListener(function() { sendReady(); });
          setTimeout(sendReady, 1500);
          
        } catch(e) {
          post('error', { message: 'Cesium init failed: ' + String(e), stack: (e && e.stack) ? String(e.stack) : '' });
        }
      })();
    })();
  </script>
</body>
</html>`;
  };

  // WebView mesajlarını işle
  const handleMessage = (methodId: string) => (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log(`[TerrainTest-${methodId}] Message:`, data.type, data.payload);

      switch (data.type) {
        case 'cesium-ready':
          setLoadingStates(prev => ({ ...prev, [methodId]: false }));
          setErrorStates(prev => ({ ...prev, [methodId]: null }));
          break;
        case 'error':
          setErrorStates(prev => ({ ...prev, [methodId]: data.payload?.message || 'Unknown error' }));
          setLoadingStates(prev => ({ ...prev, [methodId]: false }));
          break;
        case 'log':
          // Log mesajlarını console'a yaz (debug için)
          if (data.payload?.level === 'error') {
            console.error(`[TerrainTest-${methodId}]`, ...(data.payload.args || []));
          } else if (data.payload?.level === 'warn') {
            console.warn(`[TerrainTest-${methodId}]`, ...(data.payload.args || []));
          } else {
            console.log(`[TerrainTest-${methodId}]`, ...(data.payload.args || []));
          }
          break;
        default:
          break;
      }
    } catch (e) {
      console.error(`[TerrainTest-${methodId}] Error parsing message:`, e);
    }
  };

  // WebView hata yönetimi
  const handleError = (methodId: string) => (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error(`[TerrainTest-${methodId}] WebView error:`, nativeEvent);
    setErrorStates(prev => ({ ...prev, [methodId]: nativeEvent?.description || 'WebView error' }));
    setLoadingStates(prev => ({ ...prev, [methodId]: false }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Mapbox Satellite + Terrain</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {/* Grid Container */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.gridContainer}>
            {TERRAIN_METHODS.map((method) => (
              <View key={method.id} style={styles.gridItem}>
                {/* Method Header */}
                <View style={styles.methodHeader}>
                  <Ionicons name={method.icon as any} size={20} color="#3b82f6" />
                  <Text style={styles.methodTitle}>{method.title}</Text>
                </View>
                <Text style={styles.methodDescription}>{method.description}</Text>

                {/* WebView Container */}
                <View style={styles.webviewContainer}>
                  {loadingStates[method.id] && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="small" color="#3b82f6" />
                    </View>
                  )}
                  
                  {errorStates[method.id] && (
                    <View style={styles.errorOverlay}>
                      <Text style={styles.errorText}>{errorStates[method.id]}</Text>
                    </View>
                  )}

                  <WebView
                    ref={(ref) => { webViewRefs.current[method.id] = ref; }}
                    source={{ html: getHTMLForMethod(), baseUrl: 'https://localhost' }}
                    style={styles.webview}
                    onMessage={handleMessage(method.id)}
                    onError={handleError(method.id)}
                    onHttpError={(syntheticEvent) => {
                      const { nativeEvent } = syntheticEvent;
                      console.error(`[TerrainTest-${method.id}] HTTP error:`, nativeEvent);
                      setErrorStates(prev => ({ ...prev, [method.id]: `HTTP ${nativeEvent.statusCode}: ${nativeEvent.description || 'Network error'}` }));
                      setLoadingStates(prev => ({ ...prev, [method.id]: false }));
                    }}
                    onLoadProgress={({ nativeEvent }) => {
                      if (nativeEvent.progress === 1) {
                        console.log(`[TerrainTest-${method.id}] WebView fully loaded (progress: ${nativeEvent.progress})`);
                      }
                    }}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
                    mixedContentMode="always"
                    allowFileAccess={true}
                    originWhitelist={['*']}
                    allowUniversalAccessFromFileURLs={true}
                    onLoadEnd={() => {
                      console.log(`[TerrainTest-${method.id}] WebView loaded`);
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  gridContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 16,
  },
  gridItem: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  methodDescription: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 8,
  },
  webviewContainer: {
    width: '100%',
    height: GRID_ITEM_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1e1e1e',
    position: 'relative',
    minHeight: GRID_ITEM_HEIGHT,
  },
  webview: {
    width: '100%',
    height: GRID_ITEM_HEIGHT,
    backgroundColor: '#1e1e1e',
    flex: 0,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 10,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fee',
    padding: 8,
    zIndex: 20,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 11,
    textAlign: 'center',
  },
});

export default GoogleTerrainTestModal;
