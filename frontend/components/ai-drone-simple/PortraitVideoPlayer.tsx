import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, UIManager, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AI_DRONE_EDITOR_THEME } from "../../src/constants/aiDroneEditorTheme";

let Video: any = null;
try {
  const v = require("react-native-video");
  Video = v?.default || v;
} catch {
  Video = null;
}

const hasNativeVideoView =
  !!(UIManager as any)?.getViewManagerConfig?.("RCTVideo") ||
  !!(UIManager as any)?.getViewManagerConfig?.("RCTVideoView");

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type VideoSource = {
  uri: string;
  headers?: Record<string, string>;
};

type MusicSource = {
  uri: string;
  headers?: Record<string, string>;
};

type Props = {
  source: VideoSource;
  musicSource?: MusicSource | null;
  onPlaybackProgress?: (currentTime: number, duration: number) => void;
  onSourceError?: () => void;
};

export function PortraitVideoPlayer({ source, musicSource, onPlaybackProgress, onSourceError }: Props) {
  const videoRef = useRef<any>(null);
  const musicRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const unloadMusic = useCallback(async () => {
    const sound = musicRef.current;
    musicRef.current = null;
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const loadMusic = useCallback(async () => {
    await unloadMusic();
    if (!musicSource?.uri) return null;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: musicSource.uri, headers: musicSource.headers },
        { shouldPlay: false, isLooping: true, volume: 0.85 },
      );
      musicRef.current = sound;
      return sound;
    } catch {
      return null;
    }
  }, [musicSource, unloadMusic]);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setSeeking(false);
    setLoadError(false);
    void unloadMusic();
  }, [source.uri, unloadMusic]);

  useEffect(() => {
    void loadMusic();
    return () => {
      void unloadMusic();
    };
  }, [loadMusic, unloadMusic]);

  const syncMusicPlayback = useCallback(async (shouldPlay: boolean, positionSec: number) => {
    const sound = musicRef.current;
    if (!sound) return;
    try {
      if (shouldPlay) {
        await sound.setPositionAsync(Math.max(0, positionSec) * 1000);
        await sound.playAsync();
      } else {
        await sound.pauseAsync();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const onLoad = useCallback(
    (e: { duration?: number }) => {
      const d = Number(e?.duration ?? 0);
      if (d > 0) {
        setDuration(d);
        onPlaybackProgress?.(0, d);
      }
    },
    [onPlaybackProgress],
  );

  const onProgress = useCallback(
    (e: { currentTime?: number }) => {
      if (seeking) return;
      const t = Number(e?.currentTime ?? 0);
      setCurrentTime(t);
      if (duration > 0) onPlaybackProgress?.(t, duration);
    },
    [seeking, duration, onPlaybackProgress],
  );

  const onEnd = useCallback(() => {
    setPlaying(false);
    if (duration > 0) setCurrentTime(duration);
    void unloadMusic();
  }, [duration, unloadMusic]);

  const togglePlay = useCallback(() => {
    if (!playing && duration > 0 && currentTime >= duration - 0.25) {
      videoRef.current?.seek(0);
      setCurrentTime(0);
      setPlaying(true);
      void syncMusicPlayback(true, 0);
      return;
    }
    const nextPlaying = !playing;
    setPlaying(nextPlaying);
    void syncMusicPlayback(nextPlaying, currentTime);
  }, [playing, duration, currentTime, syncMusicPlayback]);

  const onSeekStart = useCallback(() => setSeeking(true), []);

  const onSeekComplete = useCallback(
    (value: number) => {
      setSeeking(false);
      setCurrentTime(value);
      videoRef.current?.seek(value);
      void syncMusicPlayback(playing, value);
    },
    [playing, syncMusicPlayback],
  );

  const onSliderValueChange = useCallback(
    (value: number) => {
      if (seeking) setCurrentTime(value);
    },
    [seeking],
  );

  if (!Video || !hasNativeVideoView) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Video önizleme modülü yok</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Video yüklenemedi</Text>
      </View>
    );
  }

  const sliderMax = duration > 0 ? duration : 1;
  const sliderValue = Math.min(currentTime, sliderMax);

  return (
    <View style={styles.root}>
      <Video
        key={source.uri}
        ref={videoRef}
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        repeat={false}
        paused={!playing}
        onLoad={onLoad}
        onProgress={onProgress}
        onEnd={onEnd}
        onError={() => {
          if (onSourceError) {
            onSourceError();
            return;
          }
          setLoadError(true);
        }}
        progressUpdateInterval={250}
      />
      <View style={styles.controls} pointerEvents="box-none">
        <View style={styles.controlsBar}>
          <TouchableOpacity
            onPress={togglePlay}
            style={styles.playBtn}
            accessibilityRole="button"
            accessibilityLabel={playing ? "Duraklat" : "Oynat"}
          >
            <Ionicons name={playing ? "pause" : "play"} size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.time}>{formatTime(currentTime)}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={sliderMax}
            value={sliderValue}
            onSlidingStart={onSeekStart}
            onValueChange={onSliderValueChange}
            onSlidingComplete={onSeekComplete}
            minimumTrackTintColor={AI_DRONE_EDITOR_THEME.primaryBright}
            maximumTrackTintColor="rgba(255, 255, 255, 0.35)"
            thumbTintColor="#ffffff"
          />
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    color: AI_DRONE_EDITOR_THEME.mutedOnDark,
    fontSize: 14,
  },
  controls: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  controlsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.25)",
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56, 189, 248, 0.25)",
  },
  slider: {
    flex: 1,
    height: 32,
  },
  time: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "600",
    minWidth: 32,
    textAlign: "center",
  },
});
