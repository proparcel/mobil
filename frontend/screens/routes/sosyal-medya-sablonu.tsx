/**
 * Sosyal medya post şablonu — mobil özel arayüz (web SocialMediaTemplateApp ile aynı veri kaynakları).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
  StatusBar,
  FlatList,
  Pressable,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import ViewShot from "react-native-view-shot";
import { launchImageLibrary } from "react-native-image-picker";
import Share from "react-native-share";
import { useLocalSearchParams, useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../../services/authService";
import { getPortalRecentQuerySummary } from "../../services/portalService";
import { fetchPublicListingDetailData } from "../../services/publicListingApi";
import { getPortalSiteBaseUrl } from "../../config/portalSite";
import { API_URL, FALLBACK_API_URL } from "../../config/api";
import SocialMediaTemplatePreview from "../../components/app/SocialMediaTemplatePreview";
import {
  TEMPLATE_OPTIONS,
  EDITABLE_OVERLAY_ITEMS,
  type SocialFormState,
  buildDraftFromSource,
  buildGalleryUrls,
  buildLocationLine,
  createDefaultTemplateAdjustments,
  formatAreaText,
  formatPriceText,
  getInitialForm,
  resolveAvatarFromSource,
  resolveContactFromSource,
  formatPhoneDisplay,
} from "../../src/utils/socialMediaTemplateHelpers";

const MOBILE_HEADER_BG = "#1e293b";
const MOBILE_HEADER_ACCENT = "#3b82f6";
const PAGE_BG = "#f8fafc";

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const base = API_URL || FALLBACK_API_URL || "";
  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return u.startsWith("/") ? `${cleanBase}${u}` : `${cleanBase}/${u}`;
}

export default function SosyalMedyaSablonuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isAuthenticated } = useAuth();
  const params = useLocalSearchParams<{
    listingId?: string;
    snapshotId?: string;
    source?: string;
  }>();

  const listingId = String(params.listingId ?? "").trim();
  const snapshotIdNum = (() => {
    const n = parseInt(String(params.snapshotId ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState<SocialFormState>(() => getInitialForm());
  const [listingImages, setListingImages] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<(typeof TEMPLATE_OPTIONS)[number]["id"]>("default");
  const [selectedEditableId, setSelectedEditableId] = useState<string>("");
  const [templateAdjustments, setTemplateAdjustments] = useState(() => createDefaultTemplateAdjustments());
  const [slotSources, setSlotSources] = useState<Array<{ type: "gallery" | "upload" | null; url: string }>>([
    { type: null, url: "" },
    { type: null, url: "" },
  ]);

  const shotRef = useRef<ViewShot>(null);
  const uploadUrisRef = useRef<(string | null)[]>([null, null]);

  useEffect(() => {
    return () => {
      uploadUrisRef.current.forEach((u) => {
        if (u) {
          /* local file:// no revoke needed in RN same as blob */
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      Alert.alert("Giriş gerekli", "Sosyal medya şablonu için giriş yapın.", [
        { text: "Tamam", onPress: () => router.back() },
      ]);
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        let sourcePayload: Record<string, unknown> | null = null;
        if (listingId) {
          const res = await fetchPublicListingDetailData(listingId);
          if (!res.ok) throw new Error(res.error || "İlan yüklenemedi");
          const data = (res.data as { data?: Record<string, unknown> })?.data;
          if (data) sourcePayload = data;
        } else if (snapshotIdNum > 0) {
          const res = await getPortalRecentQuerySummary(snapshotIdNum);
          if (!res.ok) throw new Error(res.error || "Sorgu özeti alınamadı");
          if (res.data) sourcePayload = res.data as Record<string, unknown>;
        }

        const profileResp = await authService.getProfile();
        const profile = profileResp.success ? profileResp.data?.profile : null;
        const companyRelation = profileResp.success ? profileResp.data?.company_relation : null;
        const companyFallback =
          profile?.company_name?.trim() ||
          companyRelation?.company_name?.trim() ||
          "";

        const draft = buildDraftFromSource(sourcePayload);
        const nextForm: SocialFormState = {
          ...getInitialForm(companyFallback),
          ...draft,
          companyName: companyFallback || draft.companyName || getInitialForm().companyName,
        };

        const gallery = buildGalleryUrls(sourcePayload || undefined);
        let av = "";
        let cn = "";
        let cp = "";
        if (sourcePayload) {
          av = resolveAvatarFromSource(sourcePayload, profile);
          const c = resolveContactFromSource(sourcePayload, profile);
          cn = c.name;
          cp = c.phone;
        } else {
          av = resolveMediaUrl(profile?.avatar_url || profile?.pending_avatar_url || null) || "";
          cn = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
          cp = formatPhoneDisplay(profile?.phone_number);
        }

        if (cancelled) return;
        setForm(nextForm);
        setListingImages(gallery.map((u) => resolveMediaUrl(u) || u).filter(Boolean));
        setAvatarUrl(av);
        setContactName(cn);
        setContactPhone(cp);
        setLogoLoadFailed(false);
        setSlotSources([
          { type: null, url: "" },
          { type: null, url: "" },
        ]);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Yükleme hatası");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, listingId, snapshotIdNum]);

  const previewLocation = useMemo(
    () => buildLocationLine(form.city, form.district, form.neighborhood),
    [form.city, form.district, form.neighborhood],
  );
  const previewPrice = useMemo(
    () => formatPriceText(form.price, form.priceCurrency),
    [form.price, form.priceCurrency],
  );
  const previewArea = useMemo(() => formatAreaText(form.areaM2), [form.areaM2]);
  const previewTitle = form.listingTitle.trim() || "İlan Başlığı";
  const previewCompany = form.companyName.trim() || "Firma";
  const contactLine = [contactName, contactPhone].filter(Boolean).join("  ");

  const activeTemplate = TEMPLATE_OPTIONS.find((t) => t.id === selectedTemplateId) || TEMPLATE_OPTIONS[0];
  const templateFullUri = `${getPortalSiteBaseUrl()}${activeTemplate.path}`;
  const activeAdjustments = templateAdjustments[selectedTemplateId] || {};

  const selectedEditableItem = useMemo(
    () => (selectedEditableId ? EDITABLE_OVERLAY_ITEMS.find((x) => x.id === selectedEditableId) : null),
    [selectedEditableId],
  );

  const cardWidth = Math.min(width - 32, 360);

  const updateAdjustment = useCallback(
    (itemId: string, updater: (prev: { x: number; y: number; fontSize: number }) => { x: number; y: number; fontSize: number }) => {
      setTemplateAdjustments((current) => {
        const tpl = current[selectedTemplateId] || {};
        const cur = tpl[itemId] || { x: 0, y: 0, fontSize: 0 };
        return {
          ...current,
          [selectedTemplateId]: {
            ...tpl,
            [itemId]: updater(cur),
          },
        };
      });
    },
    [selectedTemplateId],
  );

  const nudge = (dx: number, dy: number) => {
    if (!selectedEditableId) return;
    updateAdjustment(selectedEditableId, (c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
  };

  const fontDelta = (d: number) => {
    if (!selectedEditableId || !selectedEditableItem?.supportsFontSize) return;
    updateAdjustment(selectedEditableId, (c) => ({ ...c, fontSize: c.fontSize + d }));
  };

  const resetEditable = () => {
    if (!selectedEditableId) return;
    updateAdjustment(selectedEditableId, () => ({ x: 0, y: 0, fontSize: 0 }));
  };

  const onSelectEditable = useCallback((id: string) => {
    setSelectedEditableId(id);
  }, []);

  const onClearSelection = useCallback(() => {
    setSelectedEditableId("");
  }, []);

  const onAbsolutePosition = useCallback(
    (id: string, x: number, y: number) => {
      setTemplateAdjustments((current) => {
        const tpl = { ...(current[selectedTemplateId] || {}) };
        const prev = tpl[id] || { x: 0, y: 0, fontSize: 0 };
        tpl[id] = { ...prev, x, y };
        return { ...current, [selectedTemplateId]: tpl };
      });
    },
    [selectedTemplateId],
  );

  const pickForSlot = (slotIndex: number) => {
    launchImageLibrary({ mediaType: "photo", selectionLimit: 1 }, (res) => {
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      setSlotSources((prev) =>
        prev.map((s, i) => (i === slotIndex ? { type: "upload" as const, url: uri } : s)),
      );
    });
  };

  const assignGallery = (slotIndex: number, url: string) => {
    setSlotSources((prev) => prev.map((s, i) => (i === slotIndex ? { type: "gallery" as const, url } : s)));
  };

  const clearSlot = (slotIndex: number) => {
    setSlotSources((prev) => prev.map((s, i) => (i === slotIndex ? { type: null, url: "" } : s)));
  };

  const onSharePng = useCallback(async () => {
    const s0 = slotSources[0]?.url;
    const s1 = slotSources[1]?.url;
    if (!s0 || !s1) {
      Alert.alert("Görsel gerekli", "Paylaşım için iki görsel seçin veya yükleyin.");
      return;
    }
    setExporting(true);
    setError("");
    try {
      await new Promise((r) => setTimeout(r, 300));
      const cap = shotRef.current as unknown as { capture?: (o?: object) => Promise<string> } | null;
      const uri = await cap?.capture?.({ format: "png", quality: 1 });
      if (!uri) throw new Error("Görüntü alınamadı");
      const fileUrl = uri.startsWith("file://") ? uri : `file://${uri}`;
      await Share.open({
        url: fileUrl,
        type: "image/png",
        title: "Sosyal medya görseli",
        message: previewTitle,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("did not share") || msg.includes("User did not share")) return;
      Alert.alert("Hata", msg || "Paylaşılamadı");
    } finally {
      setExporting(false);
    }
  }, [slotSources, previewTitle]);

  const field = (label: string, key: keyof SocialFormState, ph?: string, keyboard?: "default" | "numeric") => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={String(form[key] ?? "")}
        onChangeText={(t) => setForm((f) => ({ ...f, [key]: t }))}
        placeholder={ph}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboard || "default"}
      />
    </View>
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeOuter} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor={MOBILE_HEADER_BG} />
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Sosyal medya</Text>
          <View style={styles.headerIconBtn} />
        </View>
        <View style={styles.centerBox}>
          <Text style={styles.muted}>Giriş gerekli.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeOuter} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={MOBILE_HEADER_BG} />
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle} numberOfLines={1}>
          Sosyal medya postu
        </Text>
        <View style={styles.headerIconBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.screenTapClear} onPress={onClearSelection}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={MOBILE_HEADER_ACCENT} />
            <Text style={styles.loadingText}>Şablon verileri yükleniyor…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errBox}>
            <Ionicons name="alert-circle" size={20} color="#b91c1c" />
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İlan bilgileri</Text>
          {field("Firma adı", "companyName", "Firma")}
          {field("İlan başlığı", "listingTitle", "Örn. Bursa Nilüfer arsa")}
          <View style={styles.row2}>
            <View style={styles.row2Cell}>{field("Mülk tipi", "propertyType", "Tarla")}</View>
            <View style={styles.row2Cell}>{field("Fiyat (sayı)", "price", "2450000", "numeric")}</View>
          </View>
          <View style={styles.row2}>
            <View style={styles.row2Cell}>{field("Para birimi", "priceCurrency", "TL")}</View>
            <View style={styles.row2Cell}>{field("Alan (m²)", "areaM2", "1750", "numeric")}</View>
          </View>
          <View style={styles.row2}>
            <View style={styles.row2Cell}>{field("İl", "city", "Bursa")}</View>
            <View style={styles.row2Cell}>{field("İlçe", "district", "Nilüfer")}</View>
          </View>
          {field("Mahalle", "neighborhood", "Mahalle")}
          {field("Buton metni", "ctaText", "Detayları İncele")}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Görseller (2 zorunlu)</Text>
          <Text style={styles.sectionHint}>Şablonda üst ve alt görsel kullanılır.</Text>
          {[0, 1].map((ix) => (
            <View key={ix} style={styles.slotCard}>
              <Text style={styles.slotTitle}>{ix + 1}. görsel</Text>
              <View style={styles.slotPreview}>
                {slotSources[ix]?.url ? (
                  <Image source={{ uri: slotSources[ix].url }} style={styles.slotImg} resizeMode="cover" />
                ) : (
                  <View style={styles.slotPh}>
                    <Ionicons name="image-outline" size={32} color="#94a3b8" />
                  </View>
                )}
              </View>
              <View style={styles.slotActions}>
                <TouchableOpacity style={styles.btnSecondary} onPress={() => pickForSlot(ix)}>
                  <Ionicons name="cloud-upload-outline" size={18} color={MOBILE_HEADER_ACCENT} />
                  <Text style={styles.btnSecondaryTxt}>Galeriden seç</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnGhost, !slotSources[ix]?.url && styles.btnDisabled]}
                  onPress={() => clearSlot(ix)}
                  disabled={!slotSources[ix]?.url}
                >
                  <Text style={styles.btnGhostTxt}>Temizle</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {listingImages.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>İlan görselleri</Text>
            <Text style={styles.sectionHint}>Küçük resimlere dokunarak slota atayın.</Text>
            <FlatList
              horizontal
              data={listingImages}
              keyExtractor={(u, i) => `${u}-${i}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
              renderItem={({ item }) => (
                <View style={styles.galItem}>
                  <Image source={{ uri: item }} style={styles.galThumb} resizeMode="cover" />
                  <View style={styles.galBtns}>
                    <TouchableOpacity style={styles.galMiniBtn} onPress={() => assignGallery(0, item)}>
                      <Text style={styles.galMiniTxt}>1</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.galMiniBtn} onPress={() => assignGallery(1, item)}>
                      <Text style={styles.galMiniTxt}>2</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Önizleme</Text>
          <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }} style={{ alignItems: "center", backgroundColor: "#fff" }}>
            <SocialMediaTemplatePreview
              cardWidth={cardWidth}
              templateUri={templateFullUri}
              slot0Uri={slotSources[0]?.url || ""}
              slot1Uri={slotSources[1]?.url || ""}
              avatarUri={avatarUrl ? resolveMediaUrl(avatarUrl) : null}
              logoLoadFailed={logoLoadFailed}
              onAvatarLoadError={() => setLogoLoadFailed(true)}
              companyName={previewCompany}
              contactLine={contactLine}
              title={previewTitle}
              priceText={previewPrice}
              areaText={previewArea}
              locationText={previewLocation || "Konum"}
              themeId={selectedTemplateId}
              adjustments={activeAdjustments}
              selectedEditableId={selectedEditableId}
              onSelectEditable={onSelectEditable}
              onAbsolutePosition={onAbsolutePosition}
              onClearSelection={onClearSelection}
            />
          </ViewShot>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Şablon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {TEMPLATE_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.tplCard, selectedTemplateId === t.id && styles.tplCardActive]}
                onPress={() => setSelectedTemplateId(t.id)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: `${getPortalSiteBaseUrl()}${t.path}` }} style={styles.tplThumb} resizeMode="cover" />
                <Text style={styles.tplLabel}>{t.previewLabel}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metin konumu</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexWrap: "wrap" }}>
            {EDITABLE_OVERLAY_ITEMS.map((it) => (
              <TouchableOpacity
                key={it.id}
                style={[styles.chip, selectedEditableId === it.id && styles.chipActive]}
                onPress={() => setSelectedEditableId(it.id)}
              >
                <Text style={[styles.chipTxt, selectedEditableId === it.id && styles.chipTxtActive]}>{it.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.nudgeRow}>
            <TouchableOpacity
              style={[styles.nudgeBtn, !selectedEditableId && styles.btnDisabled]}
              onPress={() => nudge(0, -4)}
              disabled={!selectedEditableId}
            >
              <Text style={styles.nudgeTxt}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nudgeBtn, !selectedEditableId && styles.btnDisabled]}
              onPress={() => nudge(-4, 0)}
              disabled={!selectedEditableId}
            >
              <Text style={styles.nudgeTxt}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nudgeBtn, !selectedEditableId && styles.btnDisabled]}
              onPress={() => nudge(4, 0)}
              disabled={!selectedEditableId}
            >
              <Text style={styles.nudgeTxt}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nudgeBtn, !selectedEditableId && styles.btnDisabled]}
              onPress={() => nudge(0, 4)}
              disabled={!selectedEditableId}
            >
              <Text style={styles.nudgeTxt}>↓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nudgeBtn, (!selectedEditableItem?.supportsFontSize || !selectedEditableId) && styles.btnDisabled]}
              onPress={() => fontDelta(-1)}
              disabled={!selectedEditableId || !selectedEditableItem?.supportsFontSize}
            >
              <Text style={styles.nudgeTxt}>A−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nudgeBtn, (!selectedEditableItem?.supportsFontSize || !selectedEditableId) && styles.btnDisabled]}
              onPress={() => fontDelta(1)}
              disabled={!selectedEditableId || !selectedEditableItem?.supportsFontSize}
            >
              <Text style={styles.nudgeTxt}>A+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nudgeBtnWide, !selectedEditableId && styles.btnDisabled]}
              onPress={resetEditable}
              disabled={!selectedEditableId}
            >
              <Text style={styles.nudgeTxtSmall}>Sıfırla</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, (exporting || loading) && styles.btnDisabled]}
          onPress={() => void onSharePng()}
          disabled={exporting || loading}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="share-social" size={20} color="#fff" />
              <Text style={styles.primaryBtnTxt}>Görseli paylaş (PNG)</Text>
            </>
          )}
        </TouchableOpacity>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeOuter: { flex: 1, backgroundColor: MOBILE_HEADER_BG },
  scroll: { flex: 1, backgroundColor: PAGE_BG },
  screenTapClear: { flex: 1 },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: MOBILE_HEADER_BG,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: MOBILE_HEADER_ACCENT,
    gap: 6,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerBarTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  loadingBox: {
    padding: 32,
    alignItems: "center",
    gap: 12,
    backgroundColor: PAGE_BG,
  },
  loadingText: { color: "#64748b", fontWeight: "600" },
  errBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errText: { color: "#991b1b", flex: 1, fontWeight: "600" },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a", marginBottom: 6 },
  sectionHint: { fontSize: 13, color: "#64748b", marginBottom: 12, fontWeight: "500" },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  row2: { flexDirection: "row", gap: 10 },
  row2Cell: { flex: 1 },
  slotCard: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  slotTitle: { fontWeight: "700", color: "#334155", marginBottom: 8 },
  slotPreview: {
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
  },
  slotImg: { width: "100%", height: "100%" },
  slotPh: { flex: 1, alignItems: "center", justifyContent: "center" },
  slotActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  btnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  btnSecondaryTxt: { color: MOBILE_HEADER_ACCENT, fontWeight: "800" },
  btnGhost: { paddingHorizontal: 14, justifyContent: "center" },
  btnGhostTxt: { color: "#64748b", fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
  galItem: { width: 100 },
  galThumb: { width: 100, height: 72, borderRadius: 10, backgroundColor: "#e2e8f0" },
  galBtns: { flexDirection: "row", gap: 6, marginTop: 6, justifyContent: "center" },
  galMiniBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  galMiniTxt: { fontWeight: "900", color: "#334155" },
  tplCard: {
    width: 100,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#f1f5f9",
  },
  tplCardActive: { borderColor: MOBILE_HEADER_ACCENT },
  tplThumb: { width: "100%", height: 72 },
  tplLabel: { textAlign: "center", paddingVertical: 6, fontWeight: "700", color: "#334155", fontSize: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipActive: { backgroundColor: "#eff6ff", borderColor: "#93c5fd" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#64748b" },
  chipTxtActive: { color: MOBILE_HEADER_ACCENT },
  nudgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    alignItems: "center",
  },
  nudgeBtn: {
    minWidth: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  nudgeBtnWide: {
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  nudgeTxt: { fontSize: 18, fontWeight: "900", color: "#334155" },
  nudgeTxtSmall: { fontWeight: "800", color: "#334155" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: MOBILE_HEADER_ACCENT,
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 16 },
  centerBox: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: PAGE_BG },
  muted: { color: "#64748b", fontWeight: "600" },
});
