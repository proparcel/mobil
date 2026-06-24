/**
 * Basit editör — hazır (tamamlanmış) drone videoları seçici.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";

import { AI_DRONE_EDITOR_THEME } from "../../src/constants/aiDroneEditorTheme";
import { StatusErrorPanel } from "./settings/StatusErrorPanel";
import {
  isMyVideoReady,
  listDroneMyVideos,
  type DroneMyVideoItem,
} from "../../services/droneRunwayService";

function formatVideoDate(value: string | undefined): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function formatCompletedDroneVideoLabel(item: DroneMyVideoItem): string {
  const title = String(item.label || item.reference_id || item.job_id || "Video").trim();
  const date = formatVideoDate(item.updated_at || item.created_at);
  return date ? `${title} · ${date}` : title;
}

type Props = {
  selectedJobId: string;
  onSelect: (item: DroneMyVideoItem) => void;
  disabled?: boolean;
  refreshToken?: number;
};

export function CompletedDroneVideoPicker({
  selectedJobId,
  onSelect,
  disabled = false,
  refreshToken = 0,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DroneMyVideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listDroneMyVideos();
    if (!res.ok) {
      setError(res.error);
      setItems([]);
    } else {
      setItems(
        res.videos.filter(
          (v) =>
            !v.is_license_placeholder &&
            String(v.job_id || "").trim() &&
            isMyVideoReady(v),
        ),
      );
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (refreshToken > 0) void load();
  }, [refreshToken, load]);

  const selectedLabel = useMemo(() => {
    const id = String(selectedJobId || "").trim();
    if (!id) return "Hazır videolarınızdan seçin";
    const row = items.find((v) => String(v.job_id) === id);
    if (row) return formatCompletedDroneVideoLabel(row);
    return "Seçili video";
  }, [selectedJobId, items]);

  const pick = useCallback(
    (item: DroneMyVideoItem) => {
      onSelect(item);
      setOpen(false);
    },
    [onSelect],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.fieldLabel}>Hazır videolar</Text>
      <TouchableOpacity
        style={[styles.selectBox, disabled && styles.selectBoxDisabled]}
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Hazır video seç"
      >
        <Text style={styles.selectText} numberOfLines={2}>
          {selectedLabel}
        </Text>
        {loading && !open ? (
          <ActivityIndicator size="small" color={AI_DRONE_EDITOR_THEME.primaryBright} />
        ) : (
          <Ionicons name="chevron-down" size={18} color={AI_DRONE_EDITOR_THEME.mutedOnDark} />
        )}
      </TouchableOpacity>
      {error ? <StatusErrorPanel message={error} style={styles.errorPanel} /> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Tamamlanan videolar</Text>
              <TouchableOpacity onPress={() => setOpen(false)} accessibilityLabel="Kapat">
                <Ionicons name="close" size={22} color={AI_DRONE_EDITOR_THEME.textOnDark} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.sheetCentered}>
                <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} />
              </View>
            ) : items.length === 0 ? (
              <View style={styles.sheetCentered}>
                <Text style={styles.emptyText}>Henüz hazır video yok.</Text>
                <Text style={styles.emptyHint}>Video Oluştur ile yeni üretim başlatabilirsiniz.</Text>
              </View>
            ) : (
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {items.map((item) => {
                  const id = String(item.job_id || "").trim();
                  const active = id && id === String(selectedJobId || "").trim();
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.option, active && styles.optionActive]}
                      onPress={() => pick(item)}
                    >
                      <Text style={[styles.optionTitle, active && styles.optionTitleActive]} numberOfLines={2}>
                        {formatCompletedDroneVideoLabel(item)}
                      </Text>
                      {item.reference_id ? (
                        <Text style={styles.optionMeta} numberOfLines={1}>
                          Parsel: {item.reference_id}
                        </Text>
                      ) : null}
                      {active ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={AI_DRONE_EDITOR_THEME.primaryBright}
                          style={styles.optionCheck}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.refreshBtn} onPress={() => void load()}>
              <Ionicons name="refresh-outline" size={16} color={AI_DRONE_EDITOR_THEME.primaryBright} />
              <Text style={styles.refreshText}>Listeyi yenile</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: 12 },
  fieldLabel: {
    color: AI_DRONE_EDITOR_THEME.mutedOnDark,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  selectBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  selectBoxDisabled: { opacity: 0.55 },
  selectText: {
    flex: 1,
    color: AI_DRONE_EDITOR_THEME.textOnDark,
    fontSize: 14,
    fontWeight: "600",
  },
  errorPanel: { marginTop: 4 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "72%",
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 3,
    borderColor: AI_DRONE_EDITOR_THEME.primary,
    paddingBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.2)",
  },
  sheetTitle: {
    color: AI_DRONE_EDITOR_THEME.textOnDark,
    fontSize: 16,
    fontWeight: "800",
  },
  sheetCentered: {
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 8,
  },
  emptyText: { color: AI_DRONE_EDITOR_THEME.textOnDark, fontSize: 14 },
  emptyHint: { color: AI_DRONE_EDITOR_THEME.mutedOnDark, fontSize: 13, textAlign: "center" },
  list: { maxHeight: 360 },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.12)",
  },
  optionActive: { backgroundColor: "rgba(56, 189, 248, 0.12)" },
  optionTitle: { color: AI_DRONE_EDITOR_THEME.textOnDark, fontSize: 14, fontWeight: "600" },
  optionTitleActive: { color: AI_DRONE_EDITOR_THEME.primaryBright },
  optionMeta: { color: AI_DRONE_EDITOR_THEME.mutedOnDark, fontSize: 12, marginTop: 4 },
  optionCheck: { marginTop: 6 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  refreshText: { color: AI_DRONE_EDITOR_THEME.primaryBright, fontWeight: "700", fontSize: 13 },
});
