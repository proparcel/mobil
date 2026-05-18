/**
 * Pro sorgu favorisi — ListingFavoriteMenuMobile ile aynı UX:
 * favori yokken: «Sorguyu favorilere kaydet» sheet + Favori listem;
 * favori varken: menü (kaldır + Favori listem).
 */
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import AppBottomSheetModal from "./AppBottomSheetModal";
import { useRouter } from "../../src/hooks/useNavigation";

const THEME = {
  text: "#f8fafc",
  textMuted: "#94a3b8",
  danger: "#fecaca",
  accent: "#fbbf24",
  rowBg: "rgba(255,255,255,0.06)",
} as const;

export type QueryFavoriteMenuMobileProps = {
  snapshotId: number;
  isQueryFavorite: boolean;
  favoriteCountTotal: number;
  isAuthenticated: boolean;
  favoriteLoading: boolean;
  favoriteBusy: boolean;
  onApplyFavorite: (next: boolean) => void;
  touchableStyle?: StyleProp<ViewStyle>;
  touchableActiveStyle?: StyleProp<ViewStyle>;
  countStyle?: StyleProp<TextStyle>;
  countActiveStyle?: StyleProp<TextStyle>;
};

export default function QueryFavoriteMenuMobile({
  snapshotId,
  isQueryFavorite,
  favoriteCountTotal,
  isAuthenticated,
  favoriteLoading,
  favoriteBusy,
  onApplyFavorite,
  touchableStyle,
  touchableActiveStyle,
  countStyle,
  countActiveStyle,
}: QueryFavoriteMenuMobileProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const sid = Number(snapshotId);
  const valid = Number.isFinite(sid) && sid > 0;

  const openFavoritesList = useCallback(() => {
    router.push("sorgu-favorilerim");
  }, [router]);

  const onHeartPress = () => {
    if (!isAuthenticated) {
      Alert.alert("Giriş gerekli", "Favorilere eklemek için giriş yapın.", [
        { text: "İptal", style: "cancel" },
        { text: "Giriş yap", onPress: () => router.push("login") },
      ]);
      return;
    }
    if (favoriteBusy || !valid) return;
    if (!isQueryFavorite) {
      setAddSheetOpen(true);
      return;
    }
    setMenuOpen(true);
  };

  const runAdd = () => {
    setAddSheetOpen(false);
    onApplyFavorite(true);
  };

  const runRemove = () => {
    setMenuOpen(false);
    onApplyFavorite(false);
  };

  const openListFromAdd = () => {
    setAddSheetOpen(false);
    openFavoritesList();
  };

  const openListFromMenu = () => {
    setMenuOpen(false);
    openFavoritesList();
  };

  const filled = isQueryFavorite;

  return (
    <View>
      <TouchableOpacity
        style={[styles.btn, filled && styles.btnActive, touchableStyle, filled && touchableActiveStyle]}
        onPress={onHeartPress}
        disabled={favoriteBusy || favoriteLoading}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Pro sorgu favori. Toplam ${favoriteCountTotal}`}
      >
        {favoriteLoading ? (
          <ActivityIndicator size="small" color={THEME.accent} />
        ) : (
          <>
            <Ionicons
              name={filled ? "heart" : "heart-outline"}
              size={16}
              color={filled ? THEME.accent : "#64748b"}
            />
            <Text style={[styles.count, filled && styles.countActive, countStyle, filled && countActiveStyle]}>
              {favoriteCountTotal}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* İlan favorisindeki klasör sheet’i ile aynı rol: önce ekleme + Favori listem */}
      <AppBottomSheetModal
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        snapPoints={["52%"]}
        variant="dark"
        backdropPressBehavior="close"
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent} bounces={false}>
          <Text style={styles.sheetTitle}>Sorguyu favorilere kaydet</Text>
          <TouchableOpacity
            style={[styles.folderRow, favoriteBusy && styles.disabled]}
            disabled={favoriteBusy}
            onPress={runAdd}
            activeOpacity={0.75}
          >
            <Ionicons name="heart-outline" size={20} color={THEME.text} />
            <Text style={styles.folderRowText}>Sorguyu favorilere ekle</Text>
          </TouchableOpacity>
          <View style={styles.footerDivider} />
          <TouchableOpacity style={styles.favListRow} onPress={openListFromAdd} activeOpacity={0.75}>
            <Ionicons name="albums-outline" size={20} color={THEME.accent} />
            <Text style={styles.favListRowText}>Favori listem</Text>
            <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddSheetOpen(false)}>
            <Text style={styles.cancelBtnTxt}>İptal</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </AppBottomSheetModal>

      <AppBottomSheetModal
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        snapPoints={["40%"]}
        variant="dark"
        backdropPressBehavior="close"
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent} bounces={false}>
          <Text style={styles.menuTitle}>Favori</Text>
          <TouchableOpacity
            style={[styles.menuRow, favoriteBusy && styles.disabled]}
            disabled={favoriteBusy}
            onPress={runRemove}
            activeOpacity={0.75}
          >
            <Ionicons name="heart-dislike-outline" size={20} color={THEME.danger} />
            <Text style={[styles.menuRowText, styles.dangerText]}>Sorguyu favorilerden çıkar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={openListFromMenu} activeOpacity={0.75}>
            <Ionicons name="albums-outline" size={20} color={THEME.text} />
            <Text style={styles.menuRowText}>Favori listem</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={() => setMenuOpen(false)} activeOpacity={0.75}>
            <Text style={styles.menuCancel}>Kapat</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </AppBottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  btnActive: {
    backgroundColor: "rgba(251,191,36,0.15)",
    borderColor: "rgba(251,191,36,0.35)",
  },
  count: { fontSize: 12, fontWeight: "700", color: "#64748b" },
  countActive: { color: THEME.accent },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: THEME.text, marginBottom: 12 },
  folderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: THEME.rowBg,
    marginBottom: 8,
  },
  folderRowText: { fontSize: 15, fontWeight: "600", color: THEME.text, flex: 1 },
  footerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: 8,
    marginBottom: 4,
  },
  favListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(251,191,36,0.1)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
    marginBottom: 8,
  },
  favListRowText: { fontSize: 15, fontWeight: "700", color: THEME.text, flex: 1 },
  cancelBtn: { marginTop: 8, alignItems: "center", paddingVertical: 12 },
  cancelBtnTxt: { color: THEME.textMuted, fontWeight: "600", fontSize: 15 },
  menuTitle: { fontSize: 18, fontWeight: "800", color: THEME.text, marginBottom: 14 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  menuRowText: { fontSize: 15, fontWeight: "600", color: THEME.text, flex: 1 },
  dangerText: { color: THEME.danger },
  menuCancel: { fontSize: 15, fontWeight: "600", color: THEME.textMuted, textAlign: "center", width: "100%" },
  disabled: { opacity: 0.45 },
});
