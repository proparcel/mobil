import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateThreeJsModelViewerHTML } from '../utils/threeJsModelViewer';
import {
  parseCesiumMessage,
  handleCesiumMessage,
  CesiumMessageHandlers,
} from '../utils/cesiumWebViewBridge';

interface ThreeJsModelViewerProps {
  visible: boolean;
  onClose: () => void;
  initialCenter?: [number, number]; // [lon, lat]
  initialZoom?: number;
  backendUrl?: string;
}

const ThreeJsModelViewer: React.FC<ThreeJsModelViewerProps> = ({
  visible,
  onClose,
  initialCenter,
  initialZoom = 15,
  backendUrl,
}) => {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threeJsReady, setThreeJsReady] = useState(false);

  // Backend URL'i belirle - FastAPI portu (8001) kullan
  const backendUrlFinal = backendUrl || process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.101:8001';

  // Mapbox token'ı al
  const mapboxToken = useMemo(() => {
    try {
      const { MAPBOX_ACCESS_TOKEN } = require('../../config/mapbox');
      return MAPBOX_ACCESS_TOKEN;
    } catch {
      return process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
    }
  }, []);

  // HTML içeriğini oluştur
  const htmlContent = useMemo(() => {
    return generateThreeJsModelViewerHTML({
      backendUrl: backendUrlFinal,
      mapboxAccessToken: mapboxToken,
      initialCenter: initialCenter || [35.0, 39.0],
      initialZoom,
    });
  }, [backendUrlFinal, mapboxToken, initialCenter, initialZoom]);

  // Modal açıldığında state'i sıfırla
  useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(null);
      setThreeJsReady(false);
      // Fallback timeout yok - sadece threejs-ready mesajını bekleyelim
      // Eğer mesaj gelmezse hata gösterilecek
    }
  }, [visible]);

  // WebView mesajlarını işle
  const handleMessage = (event: any) => {
    console.log('[ThreeJsModelViewer] Raw message received:', event.nativeEvent?.data);
    const message = parseCesiumMessage(event);
    if (!message) {
      console.warn('[ThreeJsModelViewer] Failed to parse message, raw data:', event.nativeEvent?.data);
      return;
    }
    console.log('[ThreeJsModelViewer] Parsed message:', message.type, message.payload);

    const handlers: CesiumMessageHandlers = {
      onCesiumReady: (payload) => {
        // Three.js ready mesajı
        console.log('[ThreeJsModelViewer] Three.js ready message received:', payload);
        setThreeJsReady(true);
        setLoading(false);
        console.log('[ThreeJsModelViewer] Loading screen closed after threejs-ready');
      },
      onModelAdded: (payload) => {
        console.log('[ThreeJsModelViewer] Model added:', payload);
      },
      onModelSelected: (payload) => {
        console.log('[ThreeJsModelViewer] Model selected:', payload);
      },
      onModelsLoaded: (payload) => {
        console.log('[ThreeJsModelViewer] Models loaded:', payload);
      },
      onModelsCleared: (payload) => {
        console.log('[ThreeJsModelViewer] Models cleared:', payload);
      },
      onDebug: (payload) => {
        // WebView'den gelen debug log'ları console'a yazdır
        const { level, message, timestamp } = payload || {};
        const prefix = '[WebView]';
        const levelEmoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
        
        if (level === 'error') {
          console.error(prefix, levelEmoji, message);
        } else if (level === 'warn') {
          console.warn(prefix, levelEmoji, message);
        } else {
          console.log(prefix, levelEmoji, message);
        }
      },
      onError: (payload) => {
        // Model yükleme hataları loading ekranını etkilemesin - sadece console'a log
        if (payload?.type === 'model_load_error' || payload?.type === 'model_add_error') {
          console.error('[ThreeJsModelViewer] Model loading error (non-blocking):', payload);
          // Loading ekranını açma, sadece WebView içinde button disabled kalır
          return;
        }
        
        // Three.js module script hatalarını göster
        if (payload?.type === 'threejs_module_error' || payload?.type === 'threejs_module_timeout') {
          let errorMessage = payload?.message || 'Three.js yüklenemedi';
          if (payload?.error) {
            errorMessage += '\n\nHata: ' + payload.error;
          }
          setError(errorMessage);
          setLoading(false);
          console.error('[ThreeJsModelViewer] Three.js module error:', payload);
          return;
        }
        
        let errorMessage = payload?.message || 'Bilinmeyen hata';
        
        if (payload?.type === 'api_error') {
          if (errorMessage.includes('404')) {
            errorMessage = `Backend API'ye erişilemiyor (404).\n\nLütfen backend sunucusunun çalıştığından ve URL'in doğru olduğundan emin olun.`;
          } else {
            errorMessage = `API Hatası: ${errorMessage}`;
          }
        }
        
        setError(errorMessage);
        setLoading(false);
        console.error('[ThreeJsModelViewer] Error:', payload);
      },
      onCloseRequested: () => {
        onClose();
      },
      onAddModelRequested: (payload) => {
        console.log('[ThreeJsModelViewer] Add model requested:', payload);
      },
    };

    // Three.js ready mesajını handle et
    if (message.type === 'threejs-ready') {
      console.log('[ThreeJsModelViewer] Received threejs-ready message:', message.payload);
      handlers.onCesiumReady?.(message.payload);
      return;
    }
    
    // Diğer mesajları normal handler ile işle
    handleCesiumMessage(message, handlers);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        {/* WebView Container - Full Screen */}
        <View style={styles.webViewContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Three.js yükleniyor...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorViewContainer}>
              <Ionicons name="warning-outline" size={48} color="#dc2626" />
              <Text style={styles.errorTitle}>Hata Oluştu</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => setError(null)}>
                <Text style={styles.retryButtonText}>Tekrar Dene</Text>
              </TouchableOpacity>
            </View>
          )}

          <WebView
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={styles.webview}
            onLoadStart={() => {
              setLoading(true);
              setError(null);
              console.log('[ThreeJsModelViewer] WebView onLoadStart called');
            }}
            onLoadEnd={() => {
              // WebView HTML'i yüklendi, ama Mapbox/Three.js henüz yüklenmemiş olabilir
              // Loading'i kapatmayı bırak - threejs-ready mesajını bekle
              console.log('[ThreeJsModelViewer] WebView onLoadEnd called, waiting for threejs-ready message...');
              
              // Test: HTML içindeki script'lerin çalışıp çalışmadığını kontrol et
              setTimeout(() => {
                if (webViewRef.current) {
                  webViewRef.current.injectJavaScript(`
                    (function() {
                      // Test mesajı gönder
                      if (window.sendToReactNative && typeof window.sendToReactNative === 'function') {
                        window.sendToReactNative('debug', {
                          level: 'log',
                          message: '✅ HTML script\'leri çalışıyor - sendToReactNative mevcut',
                          timestamp: new Date().toISOString()
                        });
                        console.log('[Test] sendToReactNative available');
                      } else {
                        console.error('[Test] sendToReactNative NOT available');
                      }
                      
                      // Bridge durumunu kontrol et
                      console.log('[Test] Bridge check:', {
                        sendToReactNative: typeof window.sendToReactNative,
                        ReactNativeWebView: typeof window.ReactNativeWebView,
                        mapboxgl: typeof window.mapboxgl
                      });
                    })();
                    true;
                  `);
                }
              }, 500);
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('[ThreeJsModelViewer] WebView error:', nativeEvent);
              setLoading(false);
              setError('Three.js viewer yüklenemedi. Lütfen internet bağlantınızı kontrol edin.');
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('[ThreeJsModelViewer] WebView HTTP error:', nativeEvent);
              setLoading(false);
              if (nativeEvent.statusCode === 403 || nativeEvent.statusCode === 404) {
                setError('Kaynaklara erişilemiyor. Lütfen daha sonra tekrar deneyin.');
              } else {
                setError('Three.js viewer yüklenemedi.');
              }
            }}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={false}
            mixedContentMode="always"
            allowsFullscreenVideo={false}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            originWhitelist={['*']}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  errorViewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    zIndex: 10,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ThreeJsModelViewer;
