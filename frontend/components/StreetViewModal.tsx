import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GOOGLE_MAPS_API_KEY } from '../config/googleMaps';
import { StreetViewPoint } from '../src/utils/streetViewHelper';

interface StreetViewModalProps {
  visible: boolean;
  onClose: () => void;
  streetViewPoint: StreetViewPoint | null;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const StreetViewModal: React.FC<StreetViewModalProps> = ({ visible, onClose, streetViewPoint }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useFallbackUrl, setUseFallbackUrl] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);

  useEffect(() => {
    if (visible && streetViewPoint) {
      setLoading(true);
      setError(null);
      setUseFallbackUrl(false);
    }
  }, [visible, streetViewPoint]);

  if (!visible) return null;

  // Koordinat kontrolü
  if (!streetViewPoint || !streetViewPoint.point) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={[styles.overlay, { paddingTop: insets.top }]}>
          <View style={styles.errorContainer}>
            <Ionicons name="location-outline" size={48} color="#f59e0b" />
            <Text style={styles.errorTitle}>Koordinat Bulunamadı</Text>
            <Text style={styles.errorMessage}>
              Sokak görüntüsü için koordinat bilgisi bulunamadı.{'\n'}
              Lütfen önce bir parsel sorgulayın.
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const { lat, lng } = streetViewPoint.point;
  const heading = streetViewPoint.heading || 180;

  // 1) Google Maps "pano" URL (API key gerektirmez, WebView'da daha dayanıklı)
  const panoUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('api', '1');
    params.set('map_action', 'pano');
    params.set('viewpoint', `${lat},${lng}`);
    params.set('heading', String(heading));
    params.set('pitch', '5');
    params.set('fov', '90');
    return `https://www.google.com/maps/@?${params.toString()}`;
  }, [heading, lat, lng]);

  // 2) Embed API URL (API key + Maps Embed API gerektirir; bazı key kısıtlarında 403 dönebilir)
  const embedUrl = useMemo(() => {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === '') return null;
    return `https://www.google.com/maps/embed/v1/streetview?key=${GOOGLE_MAPS_API_KEY}&location=${lat},${lng}&heading=${heading}&pitch=5&fov=90`;
  }, [heading, lat, lng]);

  const streetViewUrl = !useFallbackUrl && embedUrl ? embedUrl : panoUrl;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Sokak Görüntüsü</Text>
            {streetViewPoint.roadName && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {streetViewPoint.roadName}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.closeButtonHeader} onPress={onClose}>
            <Ionicons name="close" size={28} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {/* WebView Container */}
        <View style={styles.webViewContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Sokak görüntüsü yükleniyor...</Text>
            </View>
          )}
          
          {error && (
            <View style={styles.errorViewContainer}>
              <Ionicons name="warning-outline" size={48} color="#dc2626" />
              <Text style={styles.errorTitle}>Street View Yüklenemedi</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              <View style={styles.errorActionsRow}>
                <TouchableOpacity
                  style={[styles.closeButton, { backgroundColor: '#111827' }]}
                  onPress={async () => {
                    try {
                      await Linking.openURL(panoUrl);
                    } catch {
                      // sessiz geç
                    }
                  }}
                >
                  <Text style={styles.closeButtonText}>Google Maps'te Aç</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Text style={styles.closeButtonText}>Kapat</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <WebView
            key={webViewKey}
            source={{ uri: streetViewUrl }}
            style={styles.webview}
            onLoadStart={() => {
              setLoading(true);
              setError(null);
            }}
            onLoadEnd={() => {
              setLoading(false);
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('[StreetViewModal] WebView error:', nativeEvent);
              // Embed URL bazı ortamlarda 403/engelleme döndürebiliyor. Bu durumda pano URL'e düş.
              if (!useFallbackUrl && embedUrl) {
                setUseFallbackUrl(true);
                setWebViewKey((k) => k + 1);
                return;
              }
              setLoading(false);
              setError(
                'Street View görüntüsü yüklenemedi. Bu konum için Google Street View mevcut olmayabilir veya Google erişimi engellenmiş olabilir.'
              );
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('[StreetViewModal] WebView HTTP error:', nativeEvent);
              if (!useFallbackUrl && embedUrl && nativeEvent.statusCode === 403) {
                // API key / Embed API kısıtları → pano URL'e düş.
                setUseFallbackUrl(true);
                setWebViewKey((k) => k + 1);
                return;
              }
              setLoading(false);
              if (nativeEvent.statusCode === 403) {
                setError('Street View erişimi reddedildi (HTTP 403). "Google Maps\'te Aç" ile deneyin.');
              } else {
                setError('Street View görüntüsü yüklenemedi.');
              }
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            mixedContentMode="always"
            allowsFullscreenVideo={false}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  closeButtonHeader: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
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
  errorContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    margin: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
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
  errorActionsRow: {
    width: '100%',
    gap: 10,
  },
  closeButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StreetViewModal;
