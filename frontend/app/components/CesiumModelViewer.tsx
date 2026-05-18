import React, { useRef, useState, useEffect, useMemo } from 'react';
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
import { MAPBOX_ACCESS_TOKEN } from '../../config/mapbox';
import { CESIUM_ION_TOKEN } from '../../config/cesium';
import { generateCesiumModelViewerHTML } from '../utils/cesiumModelViewer/cesiumModelViewer-core/cesiumModelViewer-core';
import {
  parseCesiumMessage,
  handleCesiumMessage,
  CesiumMessageHandlers,
} from '../utils/cesiumWebViewBridge';

interface CesiumModelViewerProps {
  visible: boolean;
  onClose: () => void;
  initialCenter?: [number, number]; // [lon, lat]
  initialZoom?: number;
  backendUrl?: string;
}

const CesiumModelViewer: React.FC<CesiumModelViewerProps> = ({
  visible,
  onClose,
  initialCenter = [35.0, 39.0],
  initialZoom = 15,
  backendUrl,
}) => {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Backend URL'i belirle - yeni API: https://nonpluralistic-timothy-resultingly.ngrok-free.dev/
  const backendUrlFinal = backendUrl || process.env.EXPO_PUBLIC_API_URL || 'https://nonpluralistic-timothy-resultingly.ngrok-free.dev';

  // Mapbox token'ı al
  const mapboxToken = useMemo(() => {
    try {
      return MAPBOX_ACCESS_TOKEN;
    } catch {
      return process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
    }
  }, []);

  // Cesium Ion token'ı al
  const cesiumIonToken = useMemo(() => {
    try {
      return CESIUM_ION_TOKEN;
    } catch {
      return process.env.EXPO_PUBLIC_CESIUM_ION_TOKEN || '';
    }
  }, []);

  // HTML içeriğini oluştur
  const htmlContent = useMemo(() => {
    try {
      const html = generateCesiumModelViewerHTML({
        backendUrl: backendUrlFinal,
        cesiumIonToken: cesiumIonToken,
        mapboxAccessToken: mapboxToken,
        initialCenter: initialCenter || [35.0, 39.0],
        initialZoom,
      });
      
      // ============================================
      // GELİŞMİŞ DEBUG SİSTEMİ - HATA BULMA
      // ============================================
      const lines = html.split('\n');
      console.log('[CesiumModelViewer] Generated HTML lines:', lines.length);
      
      // Hata satırını dinamik olarak bul (WebView'den gelen hata mesajına göre)
      const ERROR_LINE = 4280; // WebView'den gelen hata satırı
      const checkIndex = ERROR_LINE - 1; // Array index (0-based)
      
      if (lines.length > checkIndex) {
        console.log(`[CesiumModelViewer] 🔍 ========== HATA ANALİZİ - SATIR ${ERROR_LINE} ==========`);
        
        // Özel fonksiyon çağrıları listesi (tüm scope'ta kullanılacak)
        const functionCalls = [
          'fromDegrees', 'fromRadians', 'btoa', 'add', 'subtract', 
          'multiplyByScalar', 'normalize', 'distance', 'map', 'forEach',
          'Cartesian3', 'Cartographic', 'Math.toRadians', 'Math.toDegrees'
        ];
        
        // Hata satırını ve çevresini göster
        // "missing ) after argument list" hatası genelde önceki satırlarda olur
        const contextRange = 20; // Önce 20, sonra 10 satır (hatalar genelde önceki satırlarda)
        const startIndex = Math.max(0, checkIndex - contextRange);
        const endIndex = Math.min(lines.length - 1, checkIndex + 10);
        
        console.log(`[CesiumModelViewer] 📍 Hata satırı ${ERROR_LINE} (index ${checkIndex}):`);
        console.log(`[CesiumModelViewer] Context: satır ${startIndex + 1} - ${endIndex + 1}`);
        
        // Hata satırını detaylı analiz et
        const errorLine = lines[checkIndex];
        if (errorLine) {
          console.log(`[CesiumModelViewer] 🔴 HATA SATIRI (${ERROR_LINE}):`);
          console.log(`[CesiumModelViewer] Tam satır:`, errorLine);
          console.log(`[CesiumModelViewer] Satır uzunluğu:`, errorLine.length);
          console.log(`[CesiumModelViewer] İlk 200 karakter:`, errorLine.substring(0, 200));
          console.log(`[CesiumModelViewer] Son 200 karakter:`, errorLine.substring(Math.max(0, errorLine.length - 200)));
          
          // Parantez kontrolü
          const openParens = (errorLine.match(/\(/g) || []).length;
          const closeParens = (errorLine.match(/\)/g) || []).length;
          const openBraces = (errorLine.match(/\{/g) || []).length;
          const closeBraces = (errorLine.match(/\}/g) || []).length;
          const openBrackets = (errorLine.match(/\[/g) || []).length;
          const closeBrackets = (errorLine.match(/\]/g) || []).length;
          
          console.log(`[CesiumModelViewer] 📊 Parantez/Bracket analizi:`);
          console.log(`[CesiumModelViewer]   Parantezler: (${openParens} açık, ${closeParens} kapalı, fark: ${openParens - closeParens})`);
          console.log(`[CesiumModelViewer]   Süslü parantezler: {${openBraces} açık, ${closeBraces} kapalı, fark: ${openBraces - closeBraces})`);
          console.log(`[CesiumModelViewer]   Köşeli parantezler: [${openBrackets} açık, ${closeBrackets} kapalı, fark: ${openBrackets - closeBrackets})`);
          
          if (openParens !== closeParens) {
            console.error(`[CesiumModelViewer] ❌ PARANTEZ HATASI! ${openParens - closeParens} eksik/kapalı parantez var!`);
          }
          
          // Özel fonksiyon çağrılarını kontrol et
          functionCalls.forEach(funcName => {
            // Tamamlanmamış fonksiyon çağrılarını bul
            const incompleteRegex = new RegExp(`${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\([^)]*$`, 'g');
            const incompleteMatches = errorLine.match(incompleteRegex);
            if (incompleteMatches) {
              console.error(`[CesiumModelViewer] ❌ TAMAMLANMAMIŞ ${funcName}() çağrısı bulundu:`, incompleteMatches);
            }
            
            // Parantez sayısını kontrol et
            const funcRegex = new RegExp(`${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(`, 'g');
            const funcMatches = errorLine.match(funcRegex);
            if (funcMatches) {
              console.log(`[CesiumModelViewer]   ${funcName}() çağrıları: ${funcMatches.length}`);
            }
          });
          
          // Satır içindeki tüm açık parantezleri bul ve pozisyonlarını göster
          let parenPos = -1;
          const openParenPositions: number[] = [];
          const closeParenPositions: number[] = [];
          
          while ((parenPos = errorLine.indexOf('(', parenPos + 1)) !== -1) {
            openParenPositions.push(parenPos);
          }
          
          parenPos = -1;
          while ((parenPos = errorLine.indexOf(')', parenPos + 1)) !== -1) {
            closeParenPositions.push(parenPos);
          }
          
          if (openParenPositions.length > closeParenPositions.length) {
            const missingCount = openParenPositions.length - closeParenPositions.length;
            console.error(`[CesiumModelViewer] ❌ ${missingCount} eksik kapanış parantezi var!`);
            console.error(`[CesiumModelViewer]   Açık parantez pozisyonları:`, openParenPositions);
            console.error(`[CesiumModelViewer]   Kapalı parantez pozisyonları:`, closeParenPositions);
            
            // Eksik parantezlerin yakınındaki kodu göster
            const lastOpenParen = openParenPositions[openParenPositions.length - 1];
            const context = errorLine.substring(Math.max(0, lastOpenParen - 50), Math.min(errorLine.length, lastOpenParen + 100));
            console.error(`[CesiumModelViewer]   Son açık parantez çevresi:`, context);
          }
          
          // String literal kontrolü
          const singleQuotes = (errorLine.match(/'/g) || []).length;
          const doubleQuotes = (errorLine.match(/"/g) || []).length;
          const backticks = (errorLine.match(/`/g) || []).length;
          
          if (singleQuotes % 2 !== 0) {
            console.error(`[CesiumModelViewer] ❌ TEK TIRNAK HATASI! Eşleşmeyen tek tırnak var!`);
          }
          if (doubleQuotes % 2 !== 0) {
            console.error(`[CesiumModelViewer] ❌ ÇİFT TIRNAK HATASI! Eşleşmeyen çift tırnak var!`);
          }
          if (backticks % 2 !== 0) {
            console.error(`[CesiumModelViewer] ❌ BACKTICK HATASI! Eşleşmeyen backtick var!`);
          }
        }
        
        // Önceki satırlarda tamamlanmamış fonksiyon çağrılarını kontrol et
        console.log(`[CesiumModelViewer] 🔍 Önceki satırlarda tamamlanmamış fonksiyon çağrıları kontrol ediliyor...`);
        for (let i = Math.max(0, checkIndex - 20); i <= checkIndex; i++) {
          const line = lines[i];
          if (!line) continue;
          
          // Her fonksiyon çağrısını kontrol et
          functionCalls.forEach(funcName => {
            const funcPattern = new RegExp(`${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(`, 'g');
            let match;
            while ((match = funcPattern.exec(line)) !== null) {
              // Bu satırdan sonraki satırlara bak, parantez kapanmış mı?
              const openParenPos = match.index + funcName.length;
              let parenCount = 1; // Açık parantez sayısı
              let currentLineIdx = i;
              let currentCharIdx = openParenPos + 1;
              
              // Aynı satırda devam et
              while (currentCharIdx < line.length && parenCount > 0) {
                if (line[currentCharIdx] === '(') parenCount++;
                if (line[currentCharIdx] === ')') parenCount--;
                currentCharIdx++;
              }
              
              // Eğer satır sonuna geldiysek ve hala açık parantez varsa, sonraki satırlara bak
              if (parenCount > 0 && currentCharIdx >= line.length) {
                currentLineIdx++;
                currentCharIdx = 0;
                
                // Sonraki 5 satıra bak
                for (let j = 0; j < 5 && currentLineIdx < lines.length && parenCount > 0; j++) {
                  const nextLine = lines[currentLineIdx];
                  if (!nextLine) break;
                  
                  while (currentCharIdx < nextLine.length && parenCount > 0) {
                    if (nextLine[currentCharIdx] === '(') parenCount++;
                    if (nextLine[currentCharIdx] === ')') parenCount--;
                    currentCharIdx++;
                  }
                  
                  if (parenCount > 0) {
                    currentLineIdx++;
                    currentCharIdx = 0;
                  }
                }
                
                // Hala açık parantez varsa, bu bir sorun
                if (parenCount > 0) {
                  console.error(`[CesiumModelViewer] ❌ TAMAMLANMAMIŞ ${funcName}() çağrısı bulundu!`);
                  console.error(`[CesiumModelViewer]   Satır ${i + 1}, pozisyon ${openParenPos}:`);
                  console.error(`[CesiumModelViewer]   Satır içeriği: ${line.substring(Math.max(0, openParenPos - 50), Math.min(line.length, openParenPos + 100))}`);
                }
              }
            }
          });
        }
        
        // Çevre satırları göster
        console.log(`[CesiumModelViewer] 📋 Çevre satırları (${startIndex + 1}-${endIndex + 1}):`);
        for (let i = startIndex; i <= endIndex; i++) {
          const line = lines[i];
          const isErrorLine = i === checkIndex;
          const marker = isErrorLine ? '🔴>>>' : '   ';
          const lineNum = String(i + 1).padStart(5, ' ');
          
          // Satırda sorunlu karakterler var mı kontrol et
          const hasIssue = line && (
            (line.match(/\(/g) || []).length !== (line.match(/\)/g) || []).length ||
            (line.match(/\{/g) || []).length !== (line.match(/\}/g) || []).length ||
            (line.match(/\[/g) || []).length !== (line.match(/\]/g) || []).length ||
            functionCalls?.some(func => line.includes(func + '(')) || false
          );
          
          if (isErrorLine || hasIssue) {
            const preview = line ? line.substring(0, 150).replace(/\n/g, '\\n') : '(empty)';
            console.log(`[CesiumModelViewer] ${marker} ${lineNum}: ${preview}${line && line.length > 150 ? '...' : ''}`);
          }
        }
        
        // Hatanın hangi bölümden geldiğini belirle
        // Yaklaşık satır numaraları (generateCesiumModelViewerHTML'den)
        const sectionRanges = {
          'DOCTYPE/HTML Start': { start: 1, end: 3 },
          'HEAD Section': { start: 3, end: 11 },
          'CSS Styles': { start: 11, end: 11 + 500 }, // CSS genelde ~500 satır
          'BODY Start': { start: 11 + 500, end: 11 + 500 + 10 },
          'HTML Structure': { start: 11 + 500 + 10, end: 11 + 500 + 10 + 250 }, // HTML structure ~250 satır
          'Cesium Script Tag': { start: 11 + 500 + 10 + 250, end: 11 + 500 + 10 + 250 + 5 },
          'Init Script': { start: 11 + 500 + 10 + 250 + 5, end: 11 + 500 + 10 + 250 + 5 + 300 }, // Init script ~300 satır
          'Handlers Script': { start: 11 + 500 + 10 + 250 + 5 + 300, end: 5000 }, // Handlers script geri kalan
        };
        
        let errorSection = 'Bilinmeyen';
        for (const [sectionName, range] of Object.entries(sectionRanges)) {
          if (ERROR_LINE >= range.start && ERROR_LINE <= range.end) {
            errorSection = sectionName;
            break;
          }
        }
        
        console.log(`[CesiumModelViewer] 📍 Hata bölümü: ${errorSection}`);
        console.log(`[CesiumModelViewer] 💾 HTML bilgileri:`);
        console.log(`[CesiumModelViewer]   Hata satırı: ${ERROR_LINE}`);
        console.log(`[CesiumModelViewer]   Toplam satır: ${lines.length}`);
        console.log(`[CesiumModelViewer]   HTML uzunluğu: ${html.length} karakter`);
        
        // Eğer handlers script bölümündeyse, hangi handler dosyasından geldiğini tahmin et
        if (errorSection === 'Handlers Script') {
          const handlersStartLine = sectionRanges['Handlers Script'].start;
          const relativeLine = ERROR_LINE - handlersStartLine;
          console.log(`[CesiumModelViewer]   Handlers script içinde: ${relativeLine}. satır`);
          console.log(`[CesiumModelViewer]   Muhtemel dosya: cesiumModelViewer-handlers-shapes.ts veya cesiumModelViewer-handlers-map.ts`);
        }
        
        // Eğer init script bölümündeyse
        if (errorSection === 'Init Script') {
          const initStartLine = sectionRanges['Init Script'].start;
          const relativeLine = ERROR_LINE - initStartLine;
          console.log(`[CesiumModelViewer]   Init script içinde: ${relativeLine}. satır`);
          console.log(`[CesiumModelViewer]   Muhtemel dosya: cesiumModelViewer-init.ts veya alt modülleri`);
        }
        
        console.log(`[CesiumModelViewer] 🔍 ========== HATA ANALİZİ TAMAMLANDI ==========`);
      }
      
      return html;
    } catch (error) {
      console.error('[CesiumModelViewer] Error generating HTML:', error);
      throw error;
    }
  }, [backendUrlFinal, cesiumIonToken, mapboxToken, initialCenter, initialZoom]);

  // Modal açıldığında state'leri sıfırla
  useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(null);
    }
  }, [visible]);

  // WebView mesajlarını işle
  const handleMessage = (event: any) => {
    console.log('[CesiumModelViewer] Raw message received:', event.nativeEvent?.data);
    const message = parseCesiumMessage(event);
    if (!message) {
      console.warn('[CesiumModelViewer] Failed to parse message, raw data:', event.nativeEvent?.data);
      return;
    }
    console.log('[CesiumModelViewer] Parsed message:', message.type, message.payload);
    
    // shape-selected mesajı için özel log
    if (message.type === 'shape-selected') {
      console.log('[CesiumModelViewer] 🔵 SHAPE-SELECTED MESSAGE RECEIVED:', message.payload);
    }

    const handlers: CesiumMessageHandlers = {
      onCesiumReady: (payload) => {
        console.log('[CesiumModelViewer] Cesium ready message received:', payload);
        setLoading(false);
        setError(null);
        console.log('[CesiumModelViewer] Loading screen closed after cesium-ready');
      },
      onModelAdded: (payload) => {
        console.log('[CesiumModelViewer] Model added:', payload);
      },
      onModelSelected: (payload) => {
        console.log('[CesiumModelViewer] Model selected:', payload);
      },
      onModelsLoaded: (payload) => {
        console.log('[CesiumModelViewer] Models loaded:', payload);
      },
      onModelsCleared: (payload) => {
        console.log('[CesiumModelViewer] Models cleared:', payload);
      },
      onParcelSelected: (payload) => {
        console.log('[CesiumModelViewer] Parcel selected:', payload);
      },
      onShapeSelected: (payload) => {
        console.log('[CesiumModelViewer] ✅✅✅ SHAPE SELECTED HANDLER CALLED ✅✅✅');
        console.log('[CesiumModelViewer] Shape selected payload:', JSON.stringify(payload, null, 2));
        console.log('[CesiumModelViewer] Shape ID:', payload?.shapeId);
        console.log('[CesiumModelViewer] Shape type:', payload?.type);
        console.log('[CesiumModelViewer] Shape properties:', payload?.properties);
        // Şekil seçildiğinde yapılacak işlemler buraya eklenebilir
        // Örneğin: state güncelleme, UI güncelleme, vb.
      },
      onShapeDeleted: (payload) => {
        console.log('[CesiumModelViewer] Shape deleted:', payload);
        // Şekil silindiğinde yapılacak işlemler buraya eklenebilir
      },
      onMeasurementUpdate: (payload) => {
        console.log('[CesiumModelViewer] Measurement update:', payload);
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
          console.error('[CesiumModelViewer] Model loading error (non-blocking):', payload);
          // Loading ekranını açma, sadece WebView içinde button disabled kalır
          return;
        }
        
        // Cesium initialization hatalarını göster
        if (payload?.type === 'cesium_init_error' || payload?.type === 'webgl_error') {
          let errorMessage = payload?.message || 'Cesium yüklenemedi';
          if (payload?.error) {
            errorMessage += '\n\nHata: ' + payload.error;
          }
          setError(errorMessage);
          setLoading(false);
          console.error('[CesiumModelViewer] Cesium initialization error:', payload);
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
        console.error('[CesiumModelViewer] Error:', payload);
      },
      onCloseRequested: () => {
        onClose();
      },
      onAddModelRequested: (payload) => {
        console.log('[CesiumModelViewer] Add model requested:', payload);
      },
    };

    // Cesium ready mesajını handle et
    if (message.type === 'cesium-ready') {
      console.log('[CesiumModelViewer] Received cesium-ready message:', message.payload);
      handlers.onCesiumReady?.(message.payload);
      return;
    }
    
    // Diğer mesajları normal handler ile işle
    handleCesiumMessage(message, handlers);
  };

  // WebView hata yönetimi
  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('[CesiumModelViewer] WebView error:', nativeEvent);
    setError(nativeEvent?.description || 'WebView error');
    setLoading(false);
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
              <Text style={styles.loadingText}>Cesium yükleniyor...</Text>
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
            source={{ html: htmlContent, baseUrl: 'https://localhost' }}
            style={styles.webview}
            onMessage={handleMessage}
            onError={handleError}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('[CesiumModelViewer] HTTP error:', nativeEvent);
              setError(`HTTP ${nativeEvent.statusCode}: ${nativeEvent.description || 'Network error'}`);
              setLoading(false);
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            mixedContentMode="always"
            allowFileAccess={true}
            originWhitelist={['*']}
            allowUniversalAccessFromFileURLs={true}
            // Android WebView pinch zoom kilitlenmesini önlemek için kritik ayarlar
            scalesPageToFit={false}
            setBuiltInZoomControls={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            onLoadEnd={() => {
              console.log('[CesiumModelViewer] WebView loaded');
            }}
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

export default CesiumModelViewer;
