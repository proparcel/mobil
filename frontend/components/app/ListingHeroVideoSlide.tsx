import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  buildListingVideoSource,
  LISTING_VIDEO_BUFFER_CONFIG,
} from '../../src/utils/listingVideoSource';

export type ListingHeroVideoMediaStatus = 'idle' | 'loading' | 'ready' | 'error';

type Props = {
  videoUrl: string;
  posterUrl: string | null;
  /** Aktif galeri slaytı — false iken player unmount */
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onFullscreen: () => void;
  VideoComponent: React.ComponentType<any> | null;
  slideHeight: number;
  slideWidth: number;
};

const COVER_FALLBACK_MS = 3000;

export default function ListingHeroVideoSlide({
  videoUrl,
  posterUrl,
  isActive,
  muted,
  onToggleMute,
  onFullscreen,
  VideoComponent,
  slideHeight,
  slideWidth,
}: Props) {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<ListingHeroVideoMediaStatus>('idle');
  const [showCover, setShowCover] = useState(true);
  const [remountNonce, setRemountNonce] = useState(0);

  const loadStartMsRef = useRef<number | null>(null);
  const coverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaStatusRef = useRef(mediaStatus);
  mediaStatusRef.current = mediaStatus;

  const clearCoverTimeout = useCallback(() => {
    if (coverTimeoutRef.current) {
      clearTimeout(coverTimeoutRef.current);
      coverTimeoutRef.current = null;
    }
  }, []);

  const dismissCover = useCallback(() => {
    setShowCover(false);
    clearCoverTimeout();
  }, [clearCoverTimeout]);

  useEffect(() => {
    if (isActive) return;
    setStarted(false);
    setPaused(false);
    setMediaStatus('idle');
    setShowCover(true);
    loadStartMsRef.current = null;
    clearCoverTimeout();
  }, [isActive, clearCoverTimeout]);

  useEffect(() => {
    return () => clearCoverTimeout();
  }, [clearCoverTimeout]);

  const scheduleCoverFallback = useCallback(() => {
    clearCoverTimeout();
    coverTimeoutRef.current = setTimeout(() => {
      if (mediaStatusRef.current !== 'error') {
        dismissCover();
      }
    }, COVER_FALLBACK_MS);
  }, [clearCoverTimeout, dismissCover]);

  const handleStartPlay = useCallback(() => {
    if (!VideoComponent) return;
    setStarted(true);
    setPaused(false);
    setMediaStatus('loading');
    setShowCover(true);
    loadStartMsRef.current = Date.now();
    scheduleCoverFallback();
  }, [VideoComponent, scheduleCoverFallback]);

  const handleTapOverlay = useCallback(() => {
    if (!isActive) return;
    if (!started) {
      handleStartPlay();
      return;
    }
    setPaused((p) => !p);
  }, [isActive, started, handleStartPlay]);

  const handleLoadStart = useCallback(() => {
    setMediaStatus('loading');
    if (loadStartMsRef.current == null) {
      loadStartMsRef.current = Date.now();
    }
    scheduleCoverFallback();
  }, [scheduleCoverFallback]);

  const handleReadyForDisplay = useCallback(() => {
    setMediaStatus('ready');
    dismissCover();
    if (__DEV__ && loadStartMsRef.current != null) {
      const ms = Date.now() - loadStartMsRef.current;
      console.log('[ListingHeroVideo] play-to-first-frame ms=', ms);
    }
  }, [dismissCover]);

  const handleLoad = useCallback(() => {
    setMediaStatus((prev) => (prev === 'error' ? prev : 'ready'));
  }, []);

  const handleProgress = useCallback(
    (e: { currentTime?: number }) => {
      const t = Number(e?.currentTime ?? 0);
      if (t > 0.05 && showCover) {
        dismissCover();
      }
    },
    [showCover, dismissCover],
  );

  const handleError = useCallback(
    (e: unknown) => {
      if (__DEV__) {
        console.warn('[ListingHeroVideo] error', e);
      }
      setMediaStatus('error');
      clearCoverTimeout();
    },
    [clearCoverTimeout],
  );

  const handleRetry = useCallback(() => {
    setMediaStatus('loading');
    setShowCover(true);
    setRemountNonce((n) => n + 1);
    loadStartMsRef.current = Date.now();
    scheduleCoverFallback();
  }, [scheduleCoverFallback]);

  const showLoading = started && isActive && mediaStatus === 'loading' && showCover;
  const showError = started && mediaStatus === 'error';
  const showPlayHint = isActive && (!started || paused);
  const mountPlayer = Boolean(VideoComponent && started && isActive);

  const containerStyle = { width: slideWidth, height: slideHeight };

  return (
    <View style={[styles.pagerItem, containerStyle]}>
      {!mountPlayer && posterUrl ? (
        <Image source={{ uri: posterUrl }} style={styles.fill} resizeMode="cover" />
      ) : !mountPlayer ? (
        <View style={[styles.fill, styles.posterFallback]}>
          <Ionicons name="videocam-outline" size={40} color="#64748b" />
        </View>
      ) : null}

      {mountPlayer ? (
        <VideoComponent
          key={`listing-hero-v-${remountNonce}-${videoUrl.slice(-32)}`}
          source={buildListingVideoSource(videoUrl)}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          paused={paused}
          muted={muted}
          volume={muted ? 0 : 1}
          repeat
          bufferConfig={LISTING_VIDEO_BUFFER_CONFIG}
          hideShutterView={Platform.OS === 'android'}
          ignoreSilentSwitch={muted ? 'obey' : 'ignore'}
          mixWithOthers={muted ? 'inherit' : 'mix'}
          playInBackground={false}
          playWhenInactive={false}
          onLoadStart={handleLoadStart}
          onLoad={handleLoad}
          onReadyForDisplay={handleReadyForDisplay}
          onProgress={handleProgress}
          onError={handleError}
        />
      ) : null}

      {posterUrl && showCover && (mountPlayer || !started) ? (
        <Image
          source={{ uri: posterUrl }}
          style={[styles.fill, styles.coverImage]}
          resizeMode="cover"
          pointerEvents="none"
        />
      ) : null}

      <Pressable
        style={styles.tapOverlay}
        onPress={handleTapOverlay}
        accessibilityRole="button"
        accessibilityLabel={!started || paused ? 'Videoyu oynat' : 'Videoyu duraklat'}
      />

      {showPlayHint ? (
        <View style={styles.playHint} pointerEvents="none">
          <Ionicons name="play-circle" size={56} color="rgba(255,255,255,0.92)" />
        </View>
      ) : null}

      {showLoading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Video yükleniyor…</Text>
        </View>
      ) : null}

      {showError ? (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle-outline" size={40} color="#fecaca" />
          <Text style={styles.errorText}>Video oynatılamadı</Text>
          <Text style={styles.errorHint} numberOfLines={2}>
            Ağ veya biçim sorunu olabilir. Tam ekranı veya yeniden denemeyi deneyin.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
            <Text style={styles.retryBtnText}>Yeniden dene</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {VideoComponent && started ? (
        <TouchableOpacity
          style={styles.muteBtn}
          onPress={onToggleMute}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={muted ? 'Sesi aç' : 'Sesi kapat'}
        >
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={22} color="#fff" />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.fullscreenBtn}
        onPress={onFullscreen}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Tam ekran video"
      >
        <Ionicons name="expand-outline" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  pagerItem: {
    position: 'relative',
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  posterFallback: {
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  playHint: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.35)',
    gap: 10,
  },
  loadingText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(15,23,42,0.55)',
    gap: 8,
  },
  errorText: { color: '#fecaca', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  errorHint: { color: '#e2e8f0', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.85)',
  },
  retryBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  muteBtn: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    elevation: 5,
  },
  fullscreenBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    elevation: 5,
  },
});
