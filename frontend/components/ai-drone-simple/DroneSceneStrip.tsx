import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  RunwaySegmentItem,
  RunwaySegmentTimelineEntry,
  SceneGenerationRights,
} from "../../services/droneSceneService";
import { DRONE_SCENE_PACKAGE_ALLOWANCE } from "../../services/droneSceneService";
import { AI_DRONE_EDITOR_THEME } from "../../src/constants/aiDroneEditorTheme";

export type SceneStripCard = {
  slot: number | null;
  segment?: RunwaySegmentItem | null;
  timelineEntry?: RunwaySegmentTimelineEntry | null;
  placeholder?: boolean;
};

type Props = {
  cards: SceneStripCard[];
  activeSlot: number | null;
  mergeSelectedSlots: Set<number>;
  sceneRights: SceneGenerationRights;
  busy?: boolean;
  merging?: boolean;
  onSelectScene: (slot: number) => void;
  onToggleMerge: (slot: number) => void;
  onDeleteScene: (slot: number) => void;
  onMergeScenes: () => void;
  onNewScene: () => void;
};

export function buildSceneStripCards(
  segments: RunwaySegmentItem[],
  timeline: RunwaySegmentTimelineEntry[],
  sceneRights: SceneGenerationRights,
): SceneStripCard[] {
  const readySegments = segments.filter((s) => s.exists && s.slot > 0);
  const cards: SceneStripCard[] = readySegments.map((segment) => {
    const timelineEntry = timeline.find((t) => Number(t.slot) === segment.slot) || null;
    return { slot: segment.slot, segment, timelineEntry };
  });

  const remaining = Math.max(0, Number(sceneRights.remaining) || 0);
  const emptyCount = Math.max(0, DRONE_SCENE_PACKAGE_ALLOWANCE - cards.length);
  for (let i = 0; i < emptyCount; i += 1) {
    const canUse = i < remaining;
    cards.push({ slot: null, placeholder: canUse });
  }

  return cards.slice(0, DRONE_SCENE_PACKAGE_ALLOWANCE);
}

export function DroneSceneStrip({
  cards,
  activeSlot,
  mergeSelectedSlots,
  sceneRights,
  busy = false,
  merging = false,
  onSelectScene,
  onToggleMerge,
  onDeleteScene,
  onMergeScenes,
  onNewScene,
}: Props) {
  const rightsLabel = useMemo(() => {
    const used = Number(sceneRights.used) || 0;
    const allowance = Number(sceneRights.allowance) || DRONE_SCENE_PACKAGE_ALLOWANCE;
    return `${used}/${allowance} sahne hakkı kullanıldı`;
  }, [sceneRights]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Sahneler</Text>
        <Text style={styles.rights}>{rightsLabel}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {cards.map((card, index) => {
          const slot = card.slot;
          const isActive = slot != null && activeSlot === slot;
          const selected = slot != null && mergeSelectedSlots.has(slot);
          const thumbUri = card.segment?.url || card.segment?.ref_url || "";
          return (
            <View
              key={slot != null ? `scene-${slot}` : `placeholder-${index}`}
              style={[styles.card, isActive && styles.cardActive]}
            >
              {slot != null ? (
                <>
                  <TouchableOpacity
                    style={styles.thumbBtn}
                    onPress={() => onSelectScene(slot)}
                    disabled={busy}
                    activeOpacity={0.85}
                  >
                    {thumbUri ? (
                      <Image source={{ uri: thumbUri }} style={styles.thumb} resizeMode="cover" />
                    ) : (
                      <View style={styles.thumbEmpty}>
                        <Ionicons name="videocam-outline" size={18} color="#94a3b8" />
                      </View>
                    )}
                    <Text style={styles.slotLabel}>S{index + 1}</Text>
                  </TouchableOpacity>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.checkBtn, selected && styles.checkBtnOn]}
                      onPress={() => onToggleMerge(slot)}
                      disabled={busy}
                    >
                      <Ionicons name={selected ? "checkbox" : "square-outline"} size={14} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => onDeleteScene(slot)}
                      disabled={busy}
                    >
                      <Ionicons name="trash-outline" size={13} color="#fecaca" />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={[styles.placeholder, !card.placeholder && styles.placeholderDisabled]}>
                  <Ionicons name="add" size={18} color={card.placeholder ? "#64748b" : "#334155"} />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.mergeBtn, (busy || merging || mergeSelectedSlots.size < 2) && styles.btnDisabled]}
          onPress={onMergeScenes}
          disabled={busy || merging || mergeSelectedSlots.size < 2}
        >
          {merging ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="git-merge-outline" size={16} color="#fff" />
          )}
          <Text style={styles.mergeBtnText}>Sahne birleştir</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.newBtn, busy && styles.btnDisabled]}
          onPress={onNewScene}
          disabled={busy}
        >
          <Ionicons name="camera-outline" size={16} color="#fff" />
          <Text style={styles.newBtnText}>Yeni sahne</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const CARD_WIDTH = 62;

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#e2e8f0", fontWeight: "800", fontSize: 14 },
  rights: { color: "#94a3b8", fontSize: 11, fontWeight: "600" },
  row: { gap: 8, paddingVertical: 2 },
  card: {
    width: CARD_WIDTH,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "#111827",
  },
  cardActive: { borderColor: AI_DRONE_EDITOR_THEME.primaryBright },
  thumbBtn: { height: 72, backgroundColor: "#0b1220" },
  thumb: { width: "100%", height: "100%" },
  thumbEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  slotLabel: {
    position: "absolute",
    left: 4,
    bottom: 4,
    color: "#f8fafc",
    fontSize: 10,
    fontWeight: "800",
    backgroundColor: "rgba(15,23,42,0.65)",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 4,
    backgroundColor: "#0f172a",
  },
  checkBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(51,65,85,0.9)",
  },
  checkBtnOn: { backgroundColor: AI_DRONE_EDITOR_THEME.primary },
  deleteBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(127,29,29,0.45)",
  },
  placeholder: {
    height: 98,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "rgba(100,116,139,0.45)",
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  placeholderDisabled: { opacity: 0.45 },
  actionRow: { flexDirection: "row", gap: 8 },
  mergeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#334155",
    borderRadius: 10,
    paddingVertical: 11,
  },
  mergeBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  newBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: AI_DRONE_EDITOR_THEME.primary,
    borderRadius: 10,
    paddingVertical: 11,
  },
  newBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  btnDisabled: { opacity: 0.45 },
});
