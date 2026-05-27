import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  buildListingVideoSource,
  LISTING_VIDEO_BUFFER_CONFIG,
} from '../../src/utils/listingVideoSource';

type Props = {
  videoUri: string;
  posterUri?: string | null;
  VideoComponent: React.ComponentType<any>;
  onClose: () => void;
  closeTop: number;
};

const COVER_FALLBACK_MS = 3000;

export default function ListingFullscreenVideo({
  videoUri,
  posterUri,
  VideoComponent,
  onClose,
  closeTop,
}: Props) {
  const [showCover, setShowCover] = useState(Boolean(posterUri));
  const [loading, setLoading] = useState(true);
  const loadStartMsRef = useRef<number>(Date.now());
  const coverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCoverTimeout = useCallback(() => {
    if (coverTimeoutRef.current) {
      clearTimeout(coverTimeoutRef.current);
      coverTimeoutRef.current = null;
    }
  }, []);

  const dismissCover = useCallback(() => {
    setShowCover(false);
    setLoading(false);
    clearCoverTimeout();
    if (__DEV__ && loadStartMsRef.current) {
      console.log('[ListingFullscreenVideo] play-to-first-frame ms=', Date.now() - loadStartMsRef.current);
    }
  }, [clearCoverTimeout]);

  useEffect(() => {
    loadStartMsRef.current = Date.now();
    setShowCover(Boolean(posterUri));
    setLoading(true);
    coverTimeoutRef.current = setTimeout(() => dismissCover(), COVER_FALLBACK_MS);
    return () => clearCoverTimeout();
  }, [videoUri, posterUri, dismissCover, clearCoverTimeout]);

  const handleReadyForDisplay = useCallback(() => {
    dismissCover();
  }, [dismissCover]);

  const handleProgress = useCallback(
    (e: { currentTime?: number }) => {
      if (Number(e?.currentTime ?? 0) > 0.05) {
        dismissCover();
      }
    },
    [dismissCover],
  );

  const handleError = useCallback((e: unknown) => {
    if (__DEV__) console.warn('[ListingFullscreenVideo] error', e);
    setLoading(false);
    clearCoverTimeout();
  }, [clearCoverTimeout]);

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={[styles.closeBtn, { top: closeTop }]}
        onPress={onClose}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>
      <VideoComponent
        source={buildListingVideoSource(videoUri)}
        style={styles.video}
        controls
        resizeMode="contain"
        muted={false}
        volume={1}
        bufferConfig={LISTING_VIDEO_BUFFER_CONFIG}
        ignoreSilentSwitch="ignore"
        playInBackground={false}
        hideShutterView={Platform.OS === 'android'}
        onLoadStart={() => {
          loadStartMsRef.current = Date.now();
          setLoading(true);
        }}
        onReadyForDisplay={handleReadyForDisplay}
        onProgress={handleProgress}
        onError={handleError}
      />
      {posterUri && showCover ? (
        <Image source={{ uri: posterUri }} style={styles.cover} resizeMode="contain" pointerEvents="none" />
      ) : null}
      {loading && showCover ? (
        <View style={styles.loadingWrap} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: { flex: 1, width: '100%' },
  cover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});
