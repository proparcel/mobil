/**
 * Web `ListingFavoriteHeart` + `AddFavoriteFolderModal` ile aynı akış:
 * kalbe basınca menü; "Favorilere ekle" → klasör seçimi veya klasörsüz ekleme; "Favorilerden kaldır"; favori ilanlarım.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  TextInput,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import AppBottomSheetModal from "./AppBottomSheetModal";
import { useRouter } from "../../src/hooks/useNavigation";
import {
  pickFavoriteId,
  getFavoriteForListing,
  removeFavorite,
  addFavorite,
  listFavoriteFolders,
  createFavoriteFolder,
} from "../../services/portalFavoritesApi";

const THEME = {
  text: "#f8fafc",
  textMuted: "#94a3b8",
  danger: "#fecaca",
  accent: "#fbbf24",
  rowBg: "rgba(255,255,255,0.06)",
} as const;

export type ListingFavoriteMenuMobileProps = {
  listingId: string;
  favoriteCountTotal: number;
  isAuthenticated: boolean;
  viewerIsOwner?: boolean;
  onFavoriteCountChange?: (delta: { wasFavorite: boolean; isFavorite: boolean }) => void;
  sourceSurface?: string;
  /** Örn. detay `heroMediaFavBtn` ile aynı görünüm */
  touchableStyle?: StyleProp<ViewStyle>;
  touchableActiveStyle?: StyleProp<ViewStyle>;
  countStyle?: StyleProp<TextStyle>;
  countActiveStyle?: StyleProp<TextStyle>;
};

type FolderRow = { folder_id: string; name: string };

function ListingFavoriteFolderSheet({
  visible,
  onClose,
  listingId,
  sourceSurface,
  onSaved,
  onOpenFavoritesList,
}: {
  visible: boolean;
  onClose: () => void;
  listingId: string;
  sourceSurface: string;
  onSaved: (data: Record<string, unknown> | null) => void;
  /** Web’deki «Favori listem» — mobil favori ilanları ekranı */
  onOpenFavoritesList: () => void;
}) {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    listFavoriteFolders()
      .then((items) => setFolders(items))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!visible) return;
    load();
  }, [visible, load]);

  const pickFolder = async (folderId: string | null) => {
    const id = String(listingId || "").trim();
    if (!id || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const data = await addFavorite(id, sourceSurface, folderId);
      onSaved(data);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const submitNewFolder = async () => {
    const n = newName.trim();
    if (!n || creating) return;
    setCreating(true);
    setErr(null);
    try {
      await createFavoriteFolder(n);
      setNewName("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={["78%"]}
      variant="dark"
      backdropPressBehavior="close"
    >
      <BottomSheetScrollView contentContainerStyle={styles.folderSheetContent} bounces={false}>
        <Text style={styles.folderTitle}>Favori listeme kaydet</Text>
        {err ? (
          <Text style={styles.errText} accessibilityRole="alert">
            {err}
          </Text>
        ) : null}
        {loading ? (
          <ActivityIndicator color={THEME.accent} style={{ marginVertical: 16 }} />
        ) : (
          <>
            <TouchableOpacity
              style={[styles.folderRow, busy && styles.disabled]}
              disabled={busy}
              onPress={() => pickFolder(null)}
            >
              <Ionicons name="bookmark-outline" size={20} color={THEME.text} />
              <Text style={styles.folderRowText}>Klasör seçmeden ekle</Text>
            </TouchableOpacity>
            {folders.map((f) => (
              <TouchableOpacity
                key={f.folder_id}
                style={[styles.folderRow, busy && styles.disabled]}
                disabled={busy}
                onPress={() => pickFolder(f.folder_id)}
              >
                <Ionicons name="folder-outline" size={20} color={THEME.text} />
                <Text style={styles.folderRowText}>{f.name || "—"}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        <View style={styles.newFolderRow}>
          <TextInput
            style={styles.folderInput}
            placeholder="Yeni klasör adı"
            placeholderTextColor={THEME.textMuted}
            value={newName}
            maxLength={80}
            editable={!creating && !loading}
            onChangeText={setNewName}
          />
          <TouchableOpacity
            style={[styles.folderNewBtn, (!newName.trim() || creating || loading) && styles.disabled]}
            disabled={!newName.trim() || creating || loading}
            onPress={() => void submitNewFolder()}
          >
            <Text style={styles.folderNewBtnTxt}>{creating ? "…" : "Oluştur"}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.folderFooterDivider} />
        <TouchableOpacity
          style={styles.favListRow}
          onPress={() => {
            onClose();
            onOpenFavoritesList();
          }}
          activeOpacity={0.75}
        >
          <Ionicons name="albums-outline" size={20} color={THEME.accent} />
          <Text style={styles.favListRowText}>Favori listem</Text>
          <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={busy}>
          <Text style={styles.cancelBtnTxt}>İptal</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
}

export default function ListingFavoriteMenuMobile({
  listingId,
  favoriteCountTotal,
  isAuthenticated,
  viewerIsOwner = false,
  onFavoriteCountChange,
  sourceSurface = "listing_detail",
  touchableStyle,
  touchableActiveStyle,
  countStyle,
  countActiveStyle,
}: ListingFavoriteMenuMobileProps) {
  const router = useRouter();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [syncKey, setSyncKey] = useState(0);

  const lid = String(listingId || "").trim();

  useEffect(() => {
    if (!lid || !isAuthenticated) {
      setRow(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getFavoriteForListing(lid)
      .then((r) => {
        if (!cancelled) setRow(r || null);
      })
      .catch(() => {
        if (!cancelled) setRow(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lid, isAuthenticated, syncKey]);

  const favId = pickFavoriteId(row);
  const filled = Boolean(favId);

  const onHeartPress = () => {
    if (!isAuthenticated) {
      Alert.alert("Giriş gerekli", "Favorilere eklemek için giriş yapın.", [
        { text: "İptal", style: "cancel" },
        { text: "Giriş yap", onPress: () => router.push("login") },
      ]);
      return;
    }
    if (busy) return;
    /** Web ile aynı: favori yokken doğrudan klasör seç / yeni klasör (ara menü yok) */
    if (viewerIsOwner) {
      setMenuOpen(true);
      return;
    }
    if (!filled) {
      setFolderOpen(true);
      return;
    }
    setMenuOpen(true);
  };

  const handleRemove = async () => {
    if (!favId || busy) return;
    setBusy(true);
    setMenuOpen(false);
    try {
      await removeFavorite(favId);
      setRow(null);
      onFavoriteCountChange?.({ wasFavorite: true, isFavorite: false });
      setSyncKey((k) => k + 1);
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openFavoritesPage = () => {
    setMenuOpen(false);
    router.push("favori-ilanlarim");
  };

  const onFolderSaved = (data: Record<string, unknown> | null) => {
    const id = pickFavoriteId(data);
    if (data && typeof data === "object" && (id || (data as { favorite_id?: unknown }).favorite_id != null)) {
      setRow(id ? { ...data, favorite_id: id } : data);
    } else if (id) {
      setRow({ favorite_id: id });
    } else {
      setSyncKey((k) => k + 1);
    }
    onFavoriteCountChange?.({ wasFavorite: filled, isFavorite: true });
  };

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.btn,
          filled && styles.btnActive,
          touchableStyle,
          filled && touchableActiveStyle,
        ]}
        onPress={onHeartPress}
        disabled={busy || loading}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`İlan favori. Toplam ${favoriteCountTotal}`}
      >
        {loading ? (
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

      <AppBottomSheetModal
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        snapPoints={["44%"]}
        variant="dark"
        backdropPressBehavior="close"
      >
        <BottomSheetScrollView contentContainerStyle={styles.menuSheetContent} bounces={false}>
          <Text style={styles.menuTitle}>Favori</Text>
          {viewerIsOwner ? (
            <Text style={styles.muted}>Kendi ilanınızı favorilere ekleyemezsiniz.</Text>
          ) : null}
          {isAuthenticated && filled ? (
            <TouchableOpacity style={styles.menuRow} onPress={() => void handleRemove()}>
              <Ionicons name="heart-dislike-outline" size={20} color={THEME.danger} />
              <Text style={[styles.menuRowText, styles.dangerText]}>Favorilerden kaldır</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.menuRow} onPress={openFavoritesPage}>
            <Ionicons name="albums-outline" size={20} color={THEME.text} />
            <Text style={styles.menuRowText}>Favori listem</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={() => setMenuOpen(false)}>
            <Text style={styles.menuCancel}>Kapat</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </AppBottomSheetModal>

      <ListingFavoriteFolderSheet
        visible={folderOpen}
        onClose={() => setFolderOpen(false)}
        listingId={lid}
        sourceSurface={sourceSurface}
        onSaved={(data) => onFolderSaved(data)}
        onOpenFavoritesList={() => router.push("favori-ilanlarim")}
      />
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
  menuSheetContent: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 8 },
  menuTitle: { fontSize: 18, fontWeight: "800", color: THEME.text, marginBottom: 14 },
  muted: { fontSize: 14, color: THEME.textMuted, lineHeight: 20, marginBottom: 12 },
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
  folderSheetContent: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  folderTitle: { fontSize: 18, fontWeight: "800", color: THEME.text, marginBottom: 12 },
  errText: { color: THEME.danger, fontSize: 13, marginBottom: 8 },
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
  newFolderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  folderInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.text,
    fontSize: 15,
  },
  folderNewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.35)",
  },
  folderNewBtnTxt: { color: THEME.text, fontWeight: "700", fontSize: 14 },
  folderFooterDivider: {
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
  disabled: { opacity: 0.45 },
});
