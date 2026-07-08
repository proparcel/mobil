import React, { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AI_DRONE_EDITOR_THEME } from "../../src/constants/aiDroneEditorTheme";
import type { MusicTrack } from "../../services/aiDroneSimpleEditorService";
import { musicTrackKey } from "../../services/aiDroneSimpleEditorService";
import { resolveMusicPreviewUri } from "../../services/droneMusicLibraryService";

type Props = {
  track: MusicTrack;
  index: number;
  isPending: boolean;
  isSaved: boolean;
  isPlaying: boolean;
  selecting?: boolean;
  onPlayToggle: (track: MusicTrack, index: number) => void;
  onSelect: (track: MusicTrack) => void;
};

export function DroneMusicTrackCard({
  track,
  index,
  isPending,
  isSaved,
  isPlaying,
  selecting = false,
  onPlayToggle,
  onSelect,
}: Props) {
  const displayTitle = String(track.title || track.name || "Parça").trim();
  const displayArtist = String(track.artist || "ProParcel").trim();

  return (
    <View
      style={[
        styles.card,
        isPending && styles.cardPending,
        isSaved && !isPending && styles.cardSaved,
      ]}
    >
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{displayTitle}</Text>
        <Text style={styles.artist} numberOfLines={1}>{displayArtist}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => onPlayToggle(track, index)}
          accessibilityLabel={isPlaying ? "Duraklat" : "Dinle"}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={18}
            color={AI_DRONE_EDITOR_THEME.primaryBright}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.selectBtn, isPending && styles.selectBtnActive]}
          onPress={() => onSelect(track)}
          disabled={selecting}
          accessibilityLabel="Seç"
        >
          {selecting ? (
            <ActivityIndicator size="small" color="#0f172a" />
          ) : (
            <Text style={styles.selectBtnText}>Seç</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Kart önizlemesi için tek aktif Audio instance yöneticisi */
export function useMusicListPreview() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);

  const stopPreview = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    activeKeyRef.current = null;
    setActiveKey(null);
    setLoadingKey(null);
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      void stopPreview();
    };
  }, [stopPreview]);

  const togglePreview = useCallback(
    async (track: MusicTrack, index: number) => {
      const key = musicTrackKey(track, index);

      if (activeKeyRef.current === key) {
        await stopPreview();
        return;
      }

      await stopPreview();
      setLoadingKey(key);
      try {
        const resolved = await resolveMusicPreviewUri(track);
        if (!resolved.ok) {
          Alert.alert("Müzik", resolved.error);
          setLoadingKey(null);
          return;
        }
        const { sound } = await Audio.Sound.createAsync(
          { uri: resolved.uri },
          { shouldPlay: true },
        );
        soundRef.current = sound;
        activeKeyRef.current = key;
        setActiveKey(key);
        setLoadingKey(null);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            void stopPreview();
          }
        });
      } catch (e: unknown) {
        setLoadingKey(null);
        await stopPreview();
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert("Müzik", msg || "Önizleme oynatılamadı.");
      }
    },
    [stopPreview],
  );

  return {
    activeKey,
    loadingKey,
    togglePreview,
    stopPreview,
  };
}

export function MusicPreviewLoadingRow({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} size="small" />
      <Text style={styles.loadingText}>Parça indiriliyor…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    backgroundColor: "rgba(2, 6, 23, 0.35)",
  },
  cardPending: {
    borderColor: "#f97316",
    backgroundColor: "rgba(249, 115, 22, 0.12)",
  },
  cardSaved: {
    borderColor: AI_DRONE_EDITOR_THEME.primaryBright,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
  },
  info: { flex: 1, minWidth: 0 },
  title: { color: AI_DRONE_EDITOR_THEME.textOnDark, fontWeight: "700", fontSize: 14 },
  artist: { color: AI_DRONE_EDITOR_THEME.mutedOnDark, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.45)",
  },
  selectBtnActive: {
    backgroundColor: "rgba(56, 189, 248, 0.22)",
  },
  selectBtnText: {
    color: AI_DRONE_EDITOR_THEME.primaryBright,
    fontWeight: "800",
    fontSize: 12,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  loadingText: { color: AI_DRONE_EDITOR_THEME.mutedOnDark, fontSize: 12 },
});
