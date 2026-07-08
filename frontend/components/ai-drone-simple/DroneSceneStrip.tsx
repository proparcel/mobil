import React, { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  buildCanonicalTimeline,
  DRONE_SCENE_PACKAGE_ALLOWANCE,
  freeSceneRemaining,
  type RunwaySegmentItem,
  type RunwaySegmentTimelineEntry,
  type SceneGenerationRights,
} from "../../services/droneSceneService";
import { AI_DRONE_EDITOR_THEME } from "../../src/constants/aiDroneEditorTheme";
import { DroneSceneThumbnail } from "./DroneSceneThumbnail";

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

export type SceneStripCard = {
  slot: number | null;
  segment?: RunwaySegmentItem | null;
  timelineEntry?: RunwaySegmentTimelineEntry | null;
  placeholder?: boolean;
  /** Paket içi ücretsiz hak ile eklenebilir boş slot */
  placeholderFree?: boolean;
  /** Tam birleşik video kartı — strip başında, sil/birleştir yok */
  fullVideo?: boolean;
};

export type SceneStripPlaceholderProgress = {
  cardIndex: number;
  runwaySlot: number;
  percent: number;
  label: string;
};

type Props = {
  jobId: string;
  authHeader?: Record<string, string>;
  thumbCacheBust?: number;
  cards: SceneStripCard[];
  activeSlot: number | null;
  mergeSelectedSlots: Set<number>;
  sceneRights: SceneGenerationRights;
  busy?: boolean;
  merging?: boolean;
  /** Ek sahne üretimi — boş kart üzerinde ilerleme */
  placeholderProgress?: SceneStripPlaceholderProgress | null;
  fullVideoActive?: boolean;
  fullVideoUri?: string;
  onSelectFullVideo?: () => void;
  onSelectScene: (slot: number, segment?: RunwaySegmentItem | null) => void;
  onToggleMerge: (slot: number) => void;
  onDeleteScene: (entryId: string, slot: number) => void;
  onMoveActiveScene?: (direction: -1 | 1) => void;
  onMergeScenes: () => void;
  onNewScene: () => void;
};

export function buildSceneStripCards(
  segments: RunwaySegmentItem[],
  timeline: RunwaySegmentTimelineEntry[],
  sceneRights: SceneGenerationRights,
): SceneStripCard[] {
  const canonical = buildCanonicalTimeline(segments, timeline);
  const segmentBySlot = new Map(
    segments.filter((s) => s.exists && s.slot > 0).map((s) => [s.slot, s]),
  );
  const cards: SceneStripCard[] = canonical
    .map((timelineEntry) => {
      const segment = segmentBySlot.get(Number(timelineEntry.slot));
      if (!segment) return null;
      return { slot: timelineEntry.slot, segment, timelineEntry };
    })
    .filter((card): card is SceneStripCard => card != null);

  const remaining = Math.max(0, Number(sceneRights.remaining) || 0);
  const freeRemaining = freeSceneRemaining(sceneRights);
  const emptyCount = Math.max(0, DRONE_SCENE_PACKAGE_ALLOWANCE - cards.length);
  for (let i = 0; i < emptyCount; i += 1) {
    const canUse = i < remaining;
    const isFree = canUse && i < freeRemaining;
    cards.push({ slot: null, placeholder: canUse, placeholderFree: isFree });
  }

  return cards.slice(0, DRONE_SCENE_PACKAGE_ALLOWANCE);
}

export function DroneSceneStrip({
  jobId,
  authHeader,
  thumbCacheBust = 0,
  cards,
  activeSlot,
  mergeSelectedSlots,
  sceneRights,
  busy = false,
  merging = false,
  onSelectScene,
  onToggleMerge,
  onDeleteScene,
  onMoveActiveScene,
  onMergeScenes,
  onNewScene,
  placeholderProgress = null,
  fullVideoActive = false,
  fullVideoUri = "",
  onSelectFullVideo,
}: Props) {
  const moveDisabled = busy || merging;

  const fullVideoCard = useMemo(() => cards.find((c) => c.fullVideo) ?? null, [cards]);
  const sceneCards = useMemo(
    () => cards.filter((c) => c.slot != null && !c.fullVideo),
    [cards],
  );
  const placeholderCards = useMemo(
    () => cards.filter((c) => c.slot == null && !c.fullVideo),
    [cards],
  );

  const fullVideoOffset = fullVideoCard ? 1 : 0;

  const activeSceneIndex = useMemo(() => {
    if (activeSlot == null) return -1;
    return sceneCards.findIndex((c) => Number(c.slot) === Number(activeSlot));
  }, [activeSlot, sceneCards]);

  const canMoveLeft = activeSceneIndex > 0;
  const canMoveRight = activeSceneIndex >= 0 && activeSceneIndex < sceneCards.length - 1;

  const fullVideoThumbSource = useMemo(() => {
    const uri = String(fullVideoUri || "").trim();
    if (!uri) return null;
    if (uri.startsWith("file:") || uri.startsWith("content:")) {
      return { uri };
    }
    if (authHeader?.Authorization) {
      return { uri, headers: authHeader };
    }
    return { uri };
  }, [fullVideoUri, authHeader]);

  const rightsLabel = useMemo(() => {
    const used = Number(sceneRights.used) || 0;
    const allowance = Number(sceneRights.allowance) || DRONE_SCENE_PACKAGE_ALLOWANCE;
    return `${used}/${allowance} sahne hakkı kullanıldı`;
  }, [sceneRights]);

  const renderFullVideoCard = () => {
    if (!fullVideoCard) return null;
    return (
      <View style={[styles.card, fullVideoActive && styles.cardActive]}>
        <TouchableOpacity
          style={styles.fullVideoBtn}
          onPress={() => onSelectFullVideo?.()}
          disabled={busy}
          activeOpacity={0.85}
        >
          <View style={styles.thumbContent} pointerEvents="none">
            {fullVideoThumbSource && Video && hasNativeVideoView ? (
              <Video
                source={fullVideoThumbSource}
                style={styles.fullVideoThumb}
                resizeMode="cover"
                paused
                muted
                repeat={false}
                controls={false}
                playInBackground={false}
                playWhenInactive={false}
                pointerEvents="none"
              />
            ) : (
              <View style={styles.fullVideoIconWrap}>
                <Ionicons name="film-outline" size={22} color="#94a3b8" />
              </View>
            )}
            <Text style={styles.slotLabel}>Tam video</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSceneCard = (card: SceneStripCard) => {
    const slot = Number(card.slot);
    const isSceneActive = activeSlot != null && Number(activeSlot) === slot;
    const selected = mergeSelectedSlots.has(slot);

    return (
      <View
        key={card.timelineEntry?.id || `scene-${slot}`}
        style={[styles.card, isSceneActive && styles.cardActive]}
      >
        <TouchableOpacity
          style={styles.thumbBtn}
          onPress={() => onSelectScene(slot, card.segment ?? null)}
          disabled={busy}
          activeOpacity={0.85}
        >
          <View style={styles.thumbContent} pointerEvents="none">
            <DroneSceneThumbnail
              jobId={jobId}
              slot={slot}
              segmentUrl={card.segment?.url}
              refUrl={card.segment?.ref_url}
              preflightUrl={card.segment?.preflight_url}
              authHeader={authHeader}
              cacheBust={thumbCacheBust}
            />
            <Text style={styles.slotLabel}>
              S{card.timelineEntry?.label || slot}
            </Text>
          </View>
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
            onPress={() =>
              onDeleteScene(card.timelineEntry?.id || `slot-${slot}`, slot)
            }
            disabled={busy}
          >
            <Ionicons name="trash-outline" size={13} color="#fecaca" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPlaceholderCard = (card: SceneStripCard, placeholderIndex: number) => {
    const stripIndex = fullVideoOffset + sceneCards.length + placeholderIndex;
    const isProducing = placeholderProgress?.cardIndex === stripIndex;
    const labelText = card.placeholderFree
      ? "Ücretsiz sahne ekle"
      : card.placeholder
        ? "Sahne ekle"
        : null;

    const placeholderBody = isProducing ? (
      <>
        <ActivityIndicator size="small" color={AI_DRONE_EDITOR_THEME.primaryBright} />
        <Text style={styles.placeholderProgressTitle}>S{placeholderProgress.runwaySlot}</Text>
        <View style={styles.placeholderBarTrack}>
          <View
            style={[
              styles.placeholderBarFill,
              { width: `${Math.max(0, Math.min(100, placeholderProgress.percent))}%` },
            ]}
          />
        </View>
        <Text style={styles.placeholderPercent}>%{placeholderProgress.percent}</Text>
        <Text style={styles.placeholderLabel} numberOfLines={2}>
          {placeholderProgress.label}
        </Text>
      </>
    ) : card.placeholder ? (
      <>
        <Ionicons name="add" size={16} color={card.placeholderFree ? "#22c55e" : "#64748b"} />
        {labelText ? (
          <Text
            style={[styles.placeholderAddLabel, card.placeholderFree && styles.placeholderAddLabelFree]}
            numberOfLines={3}
          >
            {labelText}
          </Text>
        ) : null}
      </>
    ) : (
      <Ionicons name="add" size={18} color="#334155" />
    );

    return (
      <View
        key={`placeholder-${placeholderIndex}`}
        style={[
          styles.card,
          !card.placeholder && styles.placeholderDisabledWrap,
          isProducing && styles.cardActive,
        ]}
      >
        {card.placeholder && !isProducing ? (
          <TouchableOpacity
            style={[
              styles.placeholder,
              isProducing && styles.placeholderProducing,
            ]}
            onPress={() => onNewScene()}
            disabled={busy || merging}
            activeOpacity={0.85}
          >
            {placeholderBody}
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.placeholder,
              !card.placeholder && styles.placeholderDisabled,
              isProducing && styles.placeholderProducing,
            ]}
          >
            {placeholderBody}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Sahneler</Text>
        <View style={styles.headerRight}>
          <View style={styles.moveBtns}>
            <TouchableOpacity
              style={[
                styles.moveBtn,
                (moveDisabled || !canMoveLeft || activeSceneIndex < 0) && styles.moveBtnDisabled,
              ]}
              onPress={() => onMoveActiveScene?.(-1)}
              disabled={moveDisabled || !canMoveLeft || activeSceneIndex < 0}
              accessibilityLabel="Seçili sahneyi sola taşı"
            >
              <Ionicons name="chevron-back" size={14} color="#e2e8f0" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.moveBtn,
                (moveDisabled || !canMoveRight || activeSceneIndex < 0) && styles.moveBtnDisabled,
              ]}
              onPress={() => onMoveActiveScene?.(1)}
              disabled={moveDisabled || !canMoveRight || activeSceneIndex < 0}
              accessibilityLabel="Seçili sahneyi sağa taşı"
            >
              <Ionicons name="chevron-forward" size={14} color="#e2e8f0" />
            </TouchableOpacity>
          </View>
          <Text style={styles.rights}>{rightsLabel}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {renderFullVideoCard()}
        {sceneCards.map((card) => renderSceneCard(card))}
        {placeholderCards.map((card, index) => renderPlaceholderCard(card, index))}
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  moveBtns: { flexDirection: "row", alignItems: "center", gap: 2 },
  moveBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(15,23,42,0.85)",
  },
  moveBtnDisabled: { opacity: 0.35 },
  title: { color: "#e2e8f0", fontWeight: "800", fontSize: 14 },
  rights: { color: "#94a3b8", fontSize: 11, fontWeight: "600" },
  row: { gap: 8, paddingVertical: 2, alignItems: "flex-start" },
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
  fullVideoBtn: { height: 98, backgroundColor: "#0b1220" },
  fullVideoThumb: { flex: 1, width: "100%", height: "100%" },
  fullVideoIconWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b1220",
  },
  thumbContent: { flex: 1 },
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
  placeholderDisabledWrap: { opacity: 0.45 },
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
  placeholderProducing: {
    borderStyle: "solid",
    borderColor: AI_DRONE_EDITOR_THEME.primaryBright,
    paddingHorizontal: 4,
    gap: 3,
  },
  placeholderProgressTitle: {
    color: "#f8fafc",
    fontSize: 10,
    fontWeight: "800",
  },
  placeholderBarTrack: {
    alignSelf: "stretch",
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(148,163,184,0.25)",
    overflow: "hidden",
  },
  placeholderBarFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: AI_DRONE_EDITOR_THEME.primaryBright,
  },
  placeholderPercent: {
    color: AI_DRONE_EDITOR_THEME.primaryBright,
    fontSize: 10,
    fontWeight: "800",
  },
  placeholderLabel: {
    color: "#94a3b8",
    fontSize: 8,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 10,
  },
  placeholderAddLabel: {
    color: "#94a3b8",
    fontSize: 7,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 9,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  placeholderAddLabelFree: {
    color: "#22c55e",
  },
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
