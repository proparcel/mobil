import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  PanResponder,
  PixelRatio,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHeading(value: number): number {
  return ((value % 360) + 360) % 360;
}

function buildMapsPanoUrl(lat: number, lng: number, heading: number): string {
  const params = new URLSearchParams();
  params.set('api', '1');
  params.set('map_action', 'pano');
  params.set('viewpoint', `${lat},${lng}`);
  params.set('heading', String(heading));
  params.set('pitch', '5');
  params.set('fov', '90');
  return `https://www.google.com/maps/@?${params.toString()}`;
}

function buildNativeStreetViewUrl(lat: number, lng: number, heading: number): string | null {
  const cbp = `0,${heading},0,0,0`;
  if (Platform.OS === 'android') {
    return `google.streetview:cbll=${lat},${lng}&cbp=${cbp}`;
  }
  if (Platform.OS === 'ios') {
    return `comgooglemaps://?cbll=${lat},${lng}&cbp=${cbp}`;
  }
  return null;
}

function buildStaticStreetViewUrl(
  lat: number,
  lng: number,
  heading: number,
  pitch: number,
  fov: number,
  apiKey: string
): string {
  const scale = PixelRatio.get();
  const width = Math.min(640, Math.max(400, Math.round(SCREEN_WIDTH * scale)));
  const height = Math.min(640, Math.max(300, Math.round(SCREEN_HEIGHT * 0.62 * scale)));
  const params = new URLSearchParams();
  params.set('size', `${width}x${height}`);
  params.set('location', `${lat},${lng}`);
  params.set('heading', String(Math.round(heading)));
  params.set('pitch', String(Math.round(pitch)));
  params.set('fov', String(Math.round(fov)));
  params.set('key', apiKey);
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

const StreetViewModal: React.FC<StreetViewModalProps> = ({ visible, onClose, streetViewPoint }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewHeading, setViewHeading] = useState(180);
  const [viewPitch, setViewPitch] = useState(5);
  const [viewFov, setViewFov] = useState(90);

  const viewHeadingRef = useRef(180);
  const viewPitchRef = useRef(5);
  const viewFovRef = useRef(90);
  const dragStartHeading = useRef(180);
  const dragStartPitch = useRef(5);
  const isFirstImageLoad = useRef(true);

  viewHeadingRef.current = viewHeading;
  viewPitchRef.current = viewPitch;
  viewFovRef.current = viewFov;

  const hasPoint = Boolean(streetViewPoint?.point);
  const lat = streetViewPoint?.point?.lat ?? 0;
  const lng = streetViewPoint?.point?.lng ?? 0;
  const baseHeading = streetViewPoint?.heading ?? 180;

  useEffect(() => {
    if (visible && streetViewPoint) {
      setLoading(true);
      setError(null);
      setViewHeading(baseHeading);
      setViewPitch(5);
      setViewFov(90);
      isFirstImageLoad.current = true;
    }
  }, [visible, streetViewPoint, baseHeading]);

  const panoUrl = useMemo(() => {
    if (!hasPoint) return '';
    return buildMapsPanoUrl(lat, lng, viewHeading);
  }, [hasPoint, lat, lng, viewHeading]);

  const imageUrl = useMemo(() => {
    if (!hasPoint || !GOOGLE_MAPS_API_KEY) return null;
    return buildStaticStreetViewUrl(lat, lng, viewHeading, viewPitch, viewFov, GOOGLE_MAPS_API_KEY);
  }, [hasPoint, lat, lng, viewHeading, viewPitch, viewFov]);

  const openInGoogleMaps = useCallback(async () => {
    if (!hasPoint) return;
    const candidates = [buildNativeStreetViewUrl(lat, lng, viewHeading), panoUrl].filter(Boolean) as string[];
    for (const url of candidates) {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        // sonraki adayı dene
      }
    }
    try {
      await Linking.openURL(panoUrl);
    } catch {
      setError('Google Maps açılamadı. Cihazınızda Google Maps yüklü olduğundan emin olun.');
    }
  }, [hasPoint, lat, lng, viewHeading, panoUrl]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartHeading.current = viewHeadingRef.current;
        dragStartPitch.current = viewPitchRef.current;
      },
      onPanResponderMove: (_evt, gesture) => {
        setViewHeading(normalizeHeading(dragStartHeading.current - gesture.dx * 0.35));
        setViewPitch(clamp(dragStartPitch.current + gesture.dy * 0.12, -25, 35));
      },
    })
  ).current;

  if (!visible) return null;

  if (!hasPoint) {
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

  const hasApiKey = Boolean(GOOGLE_MAPS_API_KEY);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Sokak Görüntüsü</Text>
            {streetViewPoint?.roadName ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {streetViewPoint.roadName}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.zoomButton} onPress={() => setViewFov((f) => clamp(f - 10, 30, 100))}>
              <Ionicons name="add" size={20} color="#1d4ed8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomButton} onPress={() => setViewFov((f) => clamp(f + 10, 30, 100))}>
              <Ionicons name="remove" size={20} color="#1d4ed8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mapsButton} onPress={() => void openInGoogleMaps()}>
              <Ionicons name="navigate-outline" size={18} color="#1d4ed8" />
              <Text style={styles.mapsButtonText}>Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButtonHeader} onPress={onClose}>
              <Ionicons name="close" size={28} color="#1f2937" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.viewerContainer}>
          {loading && imageUrl ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Sokak görüntüsü yükleniyor...</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorViewContainer}>
              <Ionicons name="warning-outline" size={48} color="#dc2626" />
              <Text style={styles.errorTitle}>Street View Yüklenemedi</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              <View style={styles.errorActionsRow}>
                <TouchableOpacity
                  style={[styles.closeButton, { backgroundColor: '#111827' }]}
                  onPress={() => void openInGoogleMaps()}
                >
                  <Text style={styles.closeButtonText}>Google Maps'te Aç</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Text style={styles.closeButtonText}>Kapat</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {hasApiKey && imageUrl ? (
            <View style={styles.panoramaSurface} {...panResponder.panHandlers}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.panoramaImage}
                resizeMode="cover"
                onLoadStart={() => {
                  if (isFirstImageLoad.current) {
                    setLoading(true);
                  }
                  setError(null);
                }}
                onLoadEnd={() => {
                  setLoading(false);
                  isFirstImageLoad.current = false;
                }}
                onError={() => {
                  setLoading(false);
                  setError(
                    'Sokak görüntüsü yüklenemedi. Bu konumda görüntü olmayabilir veya API anahtarı Street View Static API için yetkili olmayabilir.'
                  );
                }}
              />
            </View>
          ) : (
            <View style={styles.fallbackContainer}>
              <Ionicons name="map-outline" size={56} color="#3b82f6" />
              <Text style={styles.fallbackTitle}>Sokak Görüntüsü</Text>
              <Text style={styles.fallbackMessage}>
                API anahtarı bulunamadı. Tam sokak görüntüsü için Google Maps uygulamasını açın.
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => void openInGoogleMaps()}>
                <Text style={styles.closeButtonText}>Google Maps'te Aç</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {hasApiKey && !error ? (
          <View style={styles.footerHint}>
            <Text style={styles.footerHintText}>
              Parmağınızla sürükleyerek döndürün · +/- ile yakınlaştırın · Tam deneyim için Maps
            </Text>
          </View>
        ) : null}
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
    elevation: 4,
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  zoomButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  mapsButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  closeButtonHeader: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  viewerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  panoramaSurface: {
    flex: 1,
    backgroundColor: '#000',
  },
  panoramaImage: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  fallbackMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17,24,39,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#f3f4f6',
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
  footerHint: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  footerHintText: {
    color: '#d1d5db',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default StreetViewModal;
