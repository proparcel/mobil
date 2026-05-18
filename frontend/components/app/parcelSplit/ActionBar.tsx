/**
 * Header altı bar: İşlemler (açılır menü), Ayarlar, Parseller.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { parcelSplitTheme } from "./theme";
import type { UiMode } from "../../../src/types/parcelSplit";

const ACTION_BAR_HEIGHT = 48;

type Props = {
  uiMode: UiMode;
  setUiMode: (m: UiMode) => void;
  showEdgeMeasurements: boolean;
  setShowEdgeMeasurements: (v: boolean) => void;
  hasPieces: boolean;
  hasRoad?: boolean;
  onDrawRoadToggle: () => void;
  onKenarOlculeriPress?: () => void;
  onYolCizPress?: () => void;
  onKenarKaydirPress?: () => void;
  onYolKaydirPress?: () => void;
  onAyarlarPress?: () => void;
  onParsellerPress?: () => void;
};

export const ACTION_BAR_HEIGHT_PX = ACTION_BAR_HEIGHT;

export function ActionBar({
  uiMode,
  setUiMode,
  showEdgeMeasurements,
  setShowEdgeMeasurements,
  hasPieces,
  hasRoad = false,
  onDrawRoadToggle,
  onKenarOlculeriPress,
  onYolCizPress,
  onKenarKaydirPress,
  onYolKaydirPress,
  onAyarlarPress,
  onParsellerPress,
}: Props) {
  const [opsMenuVisible, setOpsMenuVisible] = useState(false);

  const isDrawRoad = uiMode === "draw_road";
  const isEdgeSlide = uiMode === "edge_slide";
  const isRoadSlide = uiMode === "road_slide";

  const closeOps = () => setOpsMenuVisible(false);

  const handleOlculeri = () => {
    closeOps();
    if (onKenarOlculeriPress) {
      onKenarOlculeriPress();
    } else {
      setShowEdgeMeasurements((v) => !v);
      if (isDrawRoad) onDrawRoadToggle();
      if (isEdgeSlide) setUiMode("select_piece");
      if (isRoadSlide) onYolKaydirPress?.();
    }
  };

  const handleYolCiz = () => {
    closeOps();
    if (onYolCizPress) {
      onYolCizPress();
    } else {
      if (isDrawRoad) setUiMode("pan_zoom");
      else {
        if (isEdgeSlide) setUiMode("select_piece");
        if (isRoadSlide) onYolKaydirPress?.();
        setUiMode("draw_road");
      }
    }
  };

  const handleKenarKaydir = () => {
    closeOps();
    if (onKenarKaydirPress) {
      onKenarKaydirPress();
    } else {
      if (isEdgeSlide) setUiMode("select_piece");
      else {
        if (isDrawRoad) onDrawRoadToggle();
        if (isRoadSlide) onYolKaydirPress?.();
        setUiMode("edge_slide");
      }
    }
  };

  const handleYolKaydir = () => {
    closeOps();
    if (onYolKaydirPress) {
      onYolKaydirPress();
    } else {
      if (isRoadSlide) setUiMode("pan_zoom");
      else {
        if (isDrawRoad) onDrawRoadToggle();
        if (isEdgeSlide) setUiMode("select_piece");
        setUiMode("road_slide");
      }
    }
  };

  return (
    <View style={[styles.bar, { height: ACTION_BAR_HEIGHT }]}>
      <TouchableOpacity
        style={[styles.btn, opsMenuVisible && styles.btnActive]}
        onPress={() => setOpsMenuVisible(true)}
        activeOpacity={0.7}
        accessibilityLabel="İşlemler"
      >
        <Ionicons
          name="options-outline"
          size={22}
          color={opsMenuVisible ? parcelSplitTheme.accentBlue : parcelSplitTheme.textMuted}
        />
        <Text style={[styles.btnText, opsMenuVisible && styles.btnTextActive]}>
          İşlemler
        </Text>
        <Ionicons name="chevron-down" size={16} color={parcelSplitTheme.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={onAyarlarPress}
        activeOpacity={0.7}
        accessibilityLabel="Ayarlar"
      >
        <Ionicons name="settings-outline" size={22} color={parcelSplitTheme.textMuted} />
        <Text style={styles.btnText}>Ayarlar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={onParsellerPress}
        activeOpacity={0.7}
        accessibilityLabel="Parseller"
      >
        <Ionicons name="grid-outline" size={22} color={parcelSplitTheme.textMuted} />
        <Text style={styles.btnText}>Parseller</Text>
      </TouchableOpacity>

      <Modal visible={opsMenuVisible} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={closeOps}>
          <Pressable style={styles.menuCard} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity style={styles.menuItem} onPress={handleOlculeri}>
              <MaterialCommunityIcons
                name="vector-square"
                size={20}
                color={showEdgeMeasurements ? parcelSplitTheme.accentBlue : parcelSplitTheme.textMuted}
              />
              <Text style={[styles.menuItemText, showEdgeMeasurements && styles.menuItemTextActive]}>
                Ölçüler
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleYolCiz}>
              <Ionicons
                name="trail-sign-outline"
                size={20}
                color={isDrawRoad ? parcelSplitTheme.accentBlue : parcelSplitTheme.textMuted}
              />
              <Text style={[styles.menuItemText, isDrawRoad && styles.menuItemTextActive]}>
                Yol Çiz
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, !hasPieces && styles.menuItemDisabled]}
              onPress={handleKenarKaydir}
              disabled={!hasPieces}
            >
              <Ionicons
                name="resize-outline"
                size={20}
                color={isEdgeSlide ? parcelSplitTheme.accentBlue : parcelSplitTheme.textMuted}
              />
              <Text style={[styles.menuItemText, isEdgeSlide && styles.menuItemTextActive, !hasPieces && styles.menuItemTextDisabled]}>
                Kenar Kaydır
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, !hasRoad && styles.menuItemDisabled]}
              onPress={handleYolKaydir}
              disabled={!hasRoad}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={20}
                color={isRoadSlide ? parcelSplitTheme.accentBlue : parcelSplitTheme.textMuted}
              />
              <Text style={[styles.menuItemText, isRoadSlide && styles.menuItemTextActive, !hasRoad && styles.menuItemTextDisabled]}>
                Yol Kaydır
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: parcelSplitTheme.cardBg,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnActive: {
    backgroundColor: "rgba(59,130,246,0.12)",
  },
  btnText: {
    fontSize: 13,
    fontWeight: "600",
    color: parcelSplitTheme.textMuted,
  },
  btnTextActive: {
    color: parcelSplitTheme.accentBlue,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start",
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: parcelSplitTheme.brandNavy,
  },
  menuItemTextActive: {
    color: parcelSplitTheme.accentBlue,
  },
  menuItemTextDisabled: {
    color: parcelSplitTheme.textMuted,
  },
});
