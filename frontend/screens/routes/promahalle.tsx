/**
 * ProMahalle — mobil özgü native arayüz (sosyal akış + mahalle seçimi + uzmanlar).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  TextInput,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  Linking,
  Alert,
  Platform,
  Dimensions,
  StatusBar,
  Switch,
} from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useRouter, useLocalSearchParams } from "../../src/hooks/useNavigation";
import { parseTurkishPrice } from "../../src/utils/priceParser";
import { useAuth } from "../contexts/AuthContext";
import AppBottomSheetModal from "../../components/app/AppBottomSheetModal";
import { KeyboardAwareBody } from "../../components/app/KeyboardAwareBody";
import { PromahalleQuarterSelect } from "../../components/app/PromahalleQuarterSelect";
import { PromahalleMapLayers } from "../../components/app/PromahalleMapLayers";
import { promahallePageUrl } from "../../config/portalSite";
import {
  QUARTER_LAYER_DEFS,
  buildInitialLayerVisibility,
  type QuarterLayerDef,
} from "../../src/utils/quarterInfoMapLayers";
import { buildQuarterMorphologySections } from "../../src/utils/quarterMorphologyDisplay";
import {
  fetchGeoCities,
  fetchGeoTownsByCity,
  fetchGeoQuartersByTown,
  type GeoQuarterRow,
} from "../../services/portalService";
import {
  fetchQuarterSocialPosts,
  fetchQuarterSocialScore,
  toggleQuarterSocialLike,
  createQuarterSocialPost,
  fetchEmlakConsultantsForQuarter,
  fetchQuarterSocialComments,
  createQuarterSocialComment,
  deleteQuarterSocialPost,
  updateQuarterSocialPost,
  resolveDjangoUrl,
  fetchQuarterRatingSummary,
  saveQuarterRating,
  fetchQuarterLayers,
  QUARTER_RATING_QUESTIONS,
  type QuarterSocialPost,
  type QuarterSocialScope,
  type EmlakConsultantRow,
  type QuarterRatingSummary,
  type QuarterLayersPayload,
} from "../../services/promahalleService";

/** Harita katmanı listesinde grup başlıkları (toolbar ile aynı sıra) */
const QUARTER_LAYER_UI_GROUPS = (() => {
  const o: string[] = [];
  const seen = new Set<string>();
  for (const d of QUARTER_LAYER_DEFS) {
    if (!seen.has(d.group)) {
      seen.add(d.group);
      o.push(d.group);
    }
  }
  return o;
})();

let Mapbox: any = null;
try {
  const m = require("@rnmapbox/maps");
  Mapbox = m.default || m;
} catch {
  /* optional */
}
let MAPBOX_TOKEN = "";
try {
  MAPBOX_TOKEN = require("../../config/mapbox").MAPBOX_ACCESS_TOKEN || "";
} catch {
  /* optional */
}
if (Mapbox?.setAccessToken && MAPBOX_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
}

let RasterDemSource: any = null;
let Terrain: any = null;
try {
  const m = require("@rnmapbox/maps");
  if (m.RasterDemSource) RasterDemSource = m.RasterDemSource;
  if (m.Terrain) Terrain = m.Terrain;
} catch {
  /* optional */
}

const { width: SW, height: SH } = Dimensions.get("window");
/** postCard marginHorizontal 12 × 2 */
const POST_INNER_WIDTH = SW - 24;
/** Web `QuarterSocialApp` ile aynı: en fazla 6 görsel */
const MAX_POST_IMAGES = 6;

/** `son-30-gun-detay` ve liste ekranları ile aynı üst bar / safe area renkleri */
const COLORS = {
  headerBg: "#1e293b",
  accentBlue: "#3b82f6",
  pageBg: "#f8fafc",
} as const;

/** Beyaz ağırlıklı içerik alanı (kartlar, metin) */
const THEME = {
  bg: "#f3f4f6",
  bgWhite: "#ffffff",
  card: "#ffffff",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  accent: "#2563eb",
  accentSoft: "#eff6ff",
  accentDark: "#1d4ed8",
  text: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  starOn: "#fbbf24",
  starOff: "#d1d5db",
  danger: "#ef4444",
  success: "#10b981",
} as const;

type GeoPick = { id: number; name: string };
type QuarterPick = GeoPick & { proparcelValue: number };

function formatQuarterLabel(q: GeoQuarterRow): string {
  const tkgm = String(q.Tkgm_text || "").trim();
  const ptxt = String(q.Proparcel_text || "").trim();
  if (ptxt) return tkgm ? `${tkgm} (${ptxt})` : ptxt;
  return tkgm || String(q.Id ?? "");
}

function proparcelFromQuarterRow(q: GeoQuarterRow): number {
  const raw = (q as Record<string, unknown>).Proparcel_value ?? (q as Record<string, unknown>).proparcel_value;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number(q.Id ?? 0);
}

function extractLngLatFromGeoJson(geo: unknown): [number, number] | null {
  if (!geo || typeof geo !== "object") return null;
  const g = geo as Record<string, unknown>;
  if (g.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    return [Number(g.coordinates[0]), Number(g.coordinates[1])];
  }
  if (g.type === "Feature" && g.geometry) return extractLngLatFromGeoJson(g.geometry);
  return null;
}

interface PickerItem {
  value: string | number;
  label: string;
}

function PickerRow({
  label,
  placeholder,
  hideLabel,
  items,
  selectedValue,
  onSelect,
  loading,
  disabled,
}: {
  label: string;
  /** Boşken gösterilecek metin (etiket yerine) */
  placeholder?: string;
  hideLabel?: boolean;
  items: PickerItem[];
  selectedValue: string | number | null;
  onSelect: (v: string | number | null) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === selectedValue);
  const emptyLabel = placeholder ?? "Seçin…";
  return (
    <View style={ps.pickerWrap}>
      {hideLabel ? null : <Text style={ps.pickerLabel}>{label}</Text>}
      <TouchableOpacity
        style={[ps.pickerBtn, disabled && { opacity: 0.35 }]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator size="small" color={THEME.accent} />
        ) : (
          <>
            <Text style={[ps.pickerBtnText, !selected && { color: THEME.textSecondary }]} numberOfLines={1}>
              {selected ? selected.label : emptyLabel}
            </Text>
            <Ionicons name="chevron-down" size={18} color={THEME.accent} />
          </>
        )}
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={ps.modalOverlay} onPress={() => setOpen(false)}>
          <View style={ps.modalSheet}>
            <View style={ps.modalHandle} />
            <Text style={ps.modalTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: Math.min(SH * 0.68, SH * 0.72 - 100) }} bounces={false}>
              {items.map((item, idx) => {
                const isActive = selectedValue === item.value;
                return (
                  <TouchableOpacity
                    key={String(item.value ?? idx)}
                    style={[ps.modalItem, isActive && ps.modalItemActive]}
                    onPress={() => {
                      onSelect(item.value ?? null);
                      setOpen(false);
                    }}
                  >
                    <Text style={[ps.modalItemText, isActive && { color: THEME.accent, fontWeight: "700" }]}>
                      {item.label}
                    </Text>
                    {isActive ? <Ionicons name="checkmark-circle" size={22} color={THEME.accent} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function isSystemPost(t?: string) {
  return t === "listing_publish" || t === "pro_query";
}

function postLabel(t?: string) {
  if (t === "listing_publish") return "İlan";
  if (t === "pro_query") return "Pro sorgu";
  return "Paylaşım";
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Web `QuarterSocialPostCard` ile aynı: Başlık, İlan Tipi, Fiyat (TL), Alan m², Yayın */
function formatQuarterSocialPriceMeta(value: unknown): string {
  const n =
    typeof value === "number" && Number.isFinite(value) ? value : parseTurkishPrice(String(value ?? ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toLocaleString("tr-TR")} TL`;
}

/** İlan / Pro sorgu kartı → yerel detay (web URL yerine). */
function getQuarterSocialNativeDetailNav(
  item: QuarterSocialPost
): { snapshotId: string; listingId?: string } | null {
  const pt = String(item.post_type || "");
  if (pt !== "listing_publish" && pt !== "pro_query") return null;
  const meta = item.meta && typeof item.meta === "object" ? (item.meta as Record<string, unknown>) : {};
  const raw = meta.snapshot_id;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const listingRaw =
    pt === "pro_query"
      ? meta.source_listing_id ?? meta.listing_id
      : meta.listing_id ?? meta.source_listing_id;
  const listingId = String(listingRaw ?? "").trim();
  return {
    snapshotId: String(Math.trunc(n)),
    ...(listingId ? { listingId } : {}),
  };
}

function systemPostMetaLines(meta: unknown): string[] {
  if (!meta || typeof meta !== "object") return [];
  const m = meta as Record<string, unknown>;
  const lines: string[] = [];
  const title = m.title;
  if (title != null && String(title).trim()) lines.push(`Başlık: ${String(title).trim()}`);
  const lt = m.listing_type_label;
  if (lt != null && String(lt).trim()) lines.push(`İlan Tipi: ${String(lt).trim()}`);
  const priceStr = formatQuarterSocialPriceMeta(m.price_amount);
  if (priceStr) lines.push(`Fiyat: ${priceStr}`);
  const rawArea = m.area_m2;
  if (rawArea != null && rawArea !== "") {
    const a = typeof rawArea === "number" && Number.isFinite(rawArea) ? rawArea : parseFloat(String(rawArea));
    if (Number.isFinite(a) && a > 0) lines.push(`Alan: ${a.toLocaleString("tr-TR")} m²`);
  }
  const pub = m.published_at;
  if (pub != null && String(pub).trim()) {
    const d = fmtDate(String(pub));
    if (d) lines.push(`Yayın: ${d}`);
  }
  return lines;
}

type LocalImage = { uri: string; type?: string; name?: string };

type FeedTabKey = "all" | "listings" | "pro_query" | "user";

function StarRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}>
          <Ionicons name={n <= value ? "star" : "star-outline"} size={22} color={n <= value ? THEME.starOn : THEME.starOff} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function PromahalleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const params = useLocalSearchParams<{
    city_id?: string;
    town_id?: string;
    quarter_id?: string;
    proparcel_value?: string;
    title?: string;
  }>();

  const memberType = String(user?.member_type || "").toLowerCase();
  const restrictUserFeedOnly = !isAuthenticated || memberType === "individual";

  const [cities, setCities] = useState<GeoPick[]>([]);
  const [towns, setTowns] = useState<GeoPick[]>([]);
  const [quarterRows, setQuarterRows] = useState<QuarterPick[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [townsLoading, setTownsLoading] = useState(false);
  const [quartersLoading, setQuartersLoading] = useState(false);
  const [draftCity, setDraftCity] = useState<number | null>(null);
  const [draftTown, setDraftTown] = useState<number | null>(null);
  const [draftQuarter, setDraftQuarter] = useState<number | null>(null);
  const [selectedCityName, setSelectedCityName] = useState("");
  const [locationPickerExpanded, setLocationPickerExpanded] = useState(true);
  const [quarterLayers, setQuarterLayers] = useState<QuarterLayersPayload | null>(null);
  const [layersLoading, setLayersLoading] = useState(false);
  const [layersError, setLayersError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  /** Harita altı katman/morfoloji — bottom sheet değil, açılır panel */
  const [layersPanelExpanded, setLayersPanelExpanded] = useState(false);
  /** Mahalle puanı & yıldız değerlendirme */
  const [ratingSheetVisible, setRatingSheetVisible] = useState(false);
  /** Web quarter_info_v2 tarzı harita menüsü (katman / web / çizim) */
  const [mapMenuSheetVisible, setMapMenuSheetVisible] = useState(false);
  /** Web quarter_info toolbar ile aynı katman aç/kapa */
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [mapFullscreenVisible, setMapFullscreenVisible] = useState(false);
  /** Arazi / 3D (DEM + pitch) — index.tsx / son-30-gun-detay ile aynı */
  const [mapTerrain3D, setMapTerrain3D] = useState(false);

  const [scope, setScope] = useState<QuarterSocialScope>("global");
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [quarterId, setQuarterId] = useState("");

  const [mainSegment, setMainSegment] = useState<"feed" | "experts">("feed");
  const [feedTab, setFeedTab] = useState<FeedTabKey>("all");

  const [posts, setPosts] = useState<QuarterSocialPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scoreData, setScoreData] = useState<{ final_score?: number } | null>(null);
  const [consultants, setConsultants] = useState<EmlakConsultantRow[]>([]);
  const [loadingExperts, setLoadingExperts] = useState(false);

  const [composerText, setComposerText] = useState("");
  const [composerImages, setComposerImages] = useState<LocalImage[]>([]);
  const [composerActiveImgIndex, setComposerActiveImgIndex] = useState(0);
  const [submittingPost, setSubmittingPost] = useState(false);
  const composerImgScrollRef = useRef<ScrollView | null>(null);
  /** Gönderi galerisi: sayfa indeksi + kaydırma ref (web küçük thumb şeridi) */
  const [postImageIndex, setPostImageIndex] = useState<Record<string, number>>({});
  const postImgScrollRefs = useRef<Record<string, ScrollView | null>>({});
  /** Beğeni toggle yanıtı — liste API’si liked göndermediği için yerel */
  const [likedByPost, setLikedByPost] = useState<Record<string, boolean>>({});

  const [ratingSummary, setRatingSummary] = useState<QuarterRatingSummary | null>(null);
  const [ratingAnswers, setRatingAnswers] = useState<Record<string, number>>({});
  const [loadingRating, setLoadingRating] = useState(false);
  const [savingRating, setSavingRating] = useState(false);

  const [openCommentsFor, setOpenCommentsFor] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Array<Record<string, unknown>>>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [loadingCommentsFor, setLoadingCommentsFor] = useState<string | null>(null);

  /** Web `QuarterSocialPostCard` — … menüsü + düzenle */
  const [postActionMenuId, setPostActionMenuId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDraftText, setEditDraftText] = useState("");
  const [editKeptImageIndexes, setEditKeptImageIndexes] = useState<number[]>([]);
  const [editNewImages, setEditNewImages] = useState<LocalImage[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const [proparcelValue, setProparcelValue] = useState<number | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      setCitiesLoading(true);
      const res = await fetchGeoCities();
      if (!c && res.ok && Array.isArray(res.data)) {
        setCities(
          res.data.map((row) => ({
            id: Number(row.Id),
            name: String(row.Proparcel_text || row.Id || "").trim() || String(row.Id),
          }))
        );
      }
      if (!c) setCitiesLoading(false);
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    if (!draftCity) {
      setTowns([]);
      setQuarterRows([]);
      setDraftTown(null);
      setDraftQuarter(null);
      setSelectedCityName("");
      return;
    }
    const cityRow = cities.find((x) => x.id === draftCity);
    if (cityRow) setSelectedCityName(cityRow.name);
    let c = false;
    (async () => {
      setTownsLoading(true);
      setTowns([]);
      setQuarterRows([]);
      setDraftTown(null);
      setDraftQuarter(null);
      const res = await fetchGeoTownsByCity(draftCity);
      if (!c && res.ok && Array.isArray(res.data)) {
        setTowns(
          res.data.map((row) => ({
            id: Number(row.Id),
            name: String(row.Proparcel_text || row.Id || "").trim() || String(row.Id),
          }))
        );
      }
      if (!c) setTownsLoading(false);
    })();
    return () => {
      c = true;
    };
  }, [draftCity, cities]);

  useEffect(() => {
    if (!draftCity || !draftTown) {
      setQuarterRows([]);
      setDraftQuarter(null);
      return;
    }
    let c = false;
    (async () => {
      setQuartersLoading(true);
      setQuarterRows([]);
      setDraftQuarter(null);
      const res = await fetchGeoQuartersByTown(draftTown);
      if (!c && res.ok && Array.isArray(res.data)) {
        const rows: QuarterPick[] = (res.data as GeoQuarterRow[]).map((q) => {
          const id = Number(q.Id ?? (q as { id?: number }).id);
          const pv = proparcelFromQuarterRow(q);
          return {
            id,
            name: formatQuarterLabel(q),
            proparcelValue: pv,
          };
        });
        setQuarterRows(rows);
      }
      if (!c) setQuartersLoading(false);
    })();
    return () => {
      c = true;
    };
  }, [draftCity, draftTown]);

  /** Route ile gelen detay (ilan / pro sorgu) — seçimleri doldur ve mahalle bağlamına geç */
  useEffect(() => {
    const cid = params.city_id?.trim();
    const tid = params.town_id?.trim();
    const qid = params.quarter_id?.trim();
    const pv = params.proparcel_value?.trim();
    if (!cid || !tid || !qid) return;
    const cn = parseInt(cid, 10);
    const tn = parseInt(tid, 10);
    const qn = parseInt(qid, 10);
    if (!Number.isFinite(cn) || !Number.isFinite(tn) || !Number.isFinite(qn)) return;
    setDraftCity(cn);
    setDraftTown(tn);
    setDraftQuarter(qn);
    setCityId(cid);
    setDistrictId(tid);
    setQuarterId(qid);
    setScope("quarter");
    const pvi = pv ? parseInt(pv, 10) : NaN;
    setProparcelValue(Number.isFinite(pvi) ? pvi : null);
  }, [params.city_id, params.town_id, params.quarter_id, params.proparcel_value]);

  /** Mahalle listesi yüklendikten sonra Proparcel değeri (uzman araması) — route'ta yoksa satırdan */
  useEffect(() => {
    const raw = params.proparcel_value?.trim();
    const pvi = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(pvi)) {
      setProparcelValue(pvi);
      return;
    }
    if (!draftQuarter || quarterRows.length === 0) return;
    const row = quarterRows.find((r) => r.id === draftQuarter);
    if (row) setProparcelValue(row.proparcelValue);
  }, [draftQuarter, quarterRows, params.proparcel_value]);

  const applyLocation = useCallback(() => {
    if (!draftCity || !draftTown || !draftQuarter) {
      Alert.alert("Konum", "İl, ilçe ve mahalle seçin.");
      return;
    }
    const row = quarterRows.find((r) => r.id === draftQuarter);
    if (!row) {
      Alert.alert("Konum", "Mahalle listesi yüklenemedi veya seçim geçersiz.");
      return;
    }
    setCityId(String(draftCity));
    setDistrictId(String(draftTown));
    setQuarterId(String(row.id));
    setProparcelValue(row.proparcelValue);
    setScope("quarter");
    setLocationPickerExpanded(false);
    setLayersPanelExpanded(true);
  }, [draftCity, draftTown, draftQuarter, quarterRows]);

  const resetToGlobal = useCallback(() => {
    setScope("global");
    setCityId("");
    setDistrictId("");
    setQuarterId("");
    setDraftCity(null);
    setDraftTown(null);
    setDraftQuarter(null);
    setProparcelValue(null);
    setScoreData(null);
    setConsultants([]);
    setMainSegment("feed");
    setRatingSummary(null);
    setRatingAnswers({});
    setQuarterLayers(null);
    setLayersError(null);
    setMapCenter(null);
    setLayersPanelExpanded(false);
    setRatingSheetVisible(false);
    setMapMenuSheetVisible(false);
    setMapFullscreenVisible(false);
    setMapTerrain3D(false);
    setLayerVisibility({});
    setSelectedCityName("");
  }, []);

  useEffect(() => {
    if (scope !== "quarter" || !quarterId || proparcelValue == null || !selectedCityName.trim()) {
      setQuarterLayers(null);
      setLayersError(null);
      setLayersLoading(false);
      return;
    }
    let c = false;
    (async () => {
      setLayersLoading(true);
      setLayersError(null);
      const res = await fetchQuarterLayers({
        quarterId: quarterId,
        proparcelValue,
        cityName: selectedCityName,
      });
      if (c) return;
      if (res.ok && res.data?.success) {
        setQuarterLayers(res.data);
        const centroid = res.data.layers?.centroid_point;
        const ll = extractLngLatFromGeoJson(centroid);
        if (ll) setMapCenter(ll);
      } else {
        setQuarterLayers(null);
        setLayersError(
          res.error ||
            (typeof (res.data as QuarterLayersPayload | undefined)?.error === "string"
              ? (res.data as QuarterLayersPayload).error
              : null) ||
            "Mahalle katman verisi alınamadı."
        );
      }
      setLayersLoading(false);
    })();
    return () => {
      c = true;
    };
  }, [scope, quarterId, proparcelValue, selectedCityName]);

  /** Konum seçerken mahalle seçilince haritayı centroida odakla (henüz «Uygula» öncesi) */
  useEffect(() => {
    if (scope === "quarter") return;
    if (!draftQuarter || !draftTown || !draftCity || !selectedCityName.trim()) {
      setMapCenter(null);
      return;
    }
    const row = quarterRows.find((r) => r.id === draftQuarter);
    if (!row) return;
    let cancelled = false;
    (async () => {
      const res = await fetchQuarterLayers({
        quarterId: draftQuarter,
        proparcelValue: row.proparcelValue,
        cityName: selectedCityName,
      });
      if (cancelled || !res.ok || !res.data?.success) return;
      const centroid = res.data.layers?.centroid_point;
      const ll = extractLngLatFromGeoJson(centroid);
      if (ll) setMapCenter(ll);
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, draftQuarter, draftTown, draftCity, selectedCityName, quarterRows]);

  /** Web init.js: mahalle sınırı varsayılan açık; mahalle değişince sıfırla (aynı yüklemede toggle korunur) */
  const lastLayerInitKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (scope !== "quarter") {
      setLayerVisibility({});
      lastLayerInitKeyRef.current = null;
      return;
    }
    if (layersLoading || !quarterLayers?.layers) {
      return;
    }
    const initKey = `${quarterId}|${proparcelValue ?? ""}|${selectedCityName}`;
    if (lastLayerInitKeyRef.current === initKey) return;
    lastLayerInitKeyRef.current = initKey;
    setLayerVisibility(
      buildInitialLayerVisibility(
        quarterLayers.features as Record<string, boolean> | undefined,
        quarterLayers.layers as Record<string, unknown>
      )
    );
  }, [scope, quarterId, proparcelValue, selectedCityName, layersLoading, quarterLayers]);

  const mapMenuLayerSections = useMemo(() => {
    const sections: { title: string; items: QuarterLayerDef[] }[] = [];
    for (const def of QUARTER_LAYER_DEFS) {
      const last = sections[sections.length - 1];
      if (!last || last.title !== def.group) sections.push({ title: def.group, items: [] });
      sections[sections.length - 1].items.push(def);
    }
    return sections;
  }, []);

  const loadPosts = useCallback(
    async (opts: { reset?: boolean; cursor?: string | null } = {}) => {
      const reset = opts.reset !== false;
      const cursor = opts.cursor ?? null;
      if (reset) {
        setLoadingPosts(true);
        setNextCursor(null);
      } else {
        setLoadingMore(true);
      }
      try {
        const res = await fetchQuarterSocialPosts({
          scope,
          city_id: scope === "global" ? undefined : cityId || undefined,
          district_id: scope === "global" ? undefined : districtId || undefined,
          quarter_id: scope === "quarter" ? quarterId : undefined,
          cursor,
        });
        if (!res.ok) {
          if (reset) setPosts([]);
          return;
        }
        const next = res.data?.items || [];
        setPosts((prev) => (reset ? next : [...prev, ...next]));
        setNextCursor(res.data?.next_cursor || null);

        if (scope === "quarter" && quarterId) {
          const sr = await fetchQuarterSocialScore(quarterId);
          if (sr.ok && sr.data && (sr.data as any).success !== false) setScoreData(sr.data as any);
          else setScoreData(null);
        } else {
          setScoreData(null);
        }
      } finally {
        setLoadingPosts(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [scope, cityId, districtId, quarterId]
  );

  useEffect(() => {
    void loadPosts({ reset: true, cursor: null });
  }, [loadPosts]);

  const loadExperts = useCallback(async () => {
    if (!draftCity || !draftTown || proparcelValue == null) {
      setConsultants([]);
      return;
    }
    setLoadingExperts(true);
    try {
      const res = await fetchEmlakConsultantsForQuarter({
        city_id: draftCity,
        town_id: draftTown,
        quarter_value: proparcelValue,
        page_size: 24,
      });
      if (res.ok && res.data?.ok) setConsultants(res.data.results || []);
      else setConsultants([]);
    } finally {
      setLoadingExperts(false);
    }
  }, [draftCity, draftTown, proparcelValue]);

  useEffect(() => {
    if (mainSegment === "experts" && scope === "quarter") void loadExperts();
  }, [mainSegment, scope, loadExperts]);

  const loadRatingSummary = useCallback(async () => {
    if (scope !== "quarter" || !quarterId) {
      setRatingSummary(null);
      setRatingAnswers({});
      return;
    }
    setLoadingRating(true);
    try {
      const res = await fetchQuarterRatingSummary(quarterId);
      if (res.ok && res.data) {
        const data = res.data as QuarterRatingSummary;
        setRatingSummary(data);
        const mine = data.my_rating?.answers;
        const next: Record<string, number> = {};
        if (mine && typeof mine === "object") {
          for (const [k, v] of Object.entries(mine)) {
            const n = Number(v);
            if (Number.isFinite(n) && n >= 1 && n <= 5) next[k] = n;
          }
        }
        setRatingAnswers(next);
      }
    } finally {
      setLoadingRating(false);
    }
  }, [scope, quarterId]);

  useEffect(() => {
    void loadRatingSummary();
  }, [loadRatingSummary]);

  const pickComposerImages = useCallback(() => {
    const remain = Math.max(0, MAX_POST_IMAGES - composerImages.length);
    if (remain <= 0) {
      Alert.alert("Limit", `En fazla ${MAX_POST_IMAGES} görsel ekleyebilirsiniz.`);
      return;
    }
    launchImageLibrary(
      {
        mediaType: "photo",
        selectionLimit: remain,
        quality: 0.85,
      },
      (response) => {
        if (response.didCancel || response.errorMessage) return;
        const assets = response.assets;
        if (!assets?.length) return;
        setComposerImages((prev) => {
          const next = [...prev];
          for (const a of assets) {
            if (next.length >= MAX_POST_IMAGES) break;
            if (!a.uri) continue;
            next.push({
              uri: a.uri,
              type: a.type || "image/jpeg",
              name: a.fileName || `photo_${Date.now()}_${next.length}.jpg`,
            });
          }
          return next;
        });
      }
    );
  }, [composerImages.length]);

  useEffect(() => {
    setComposerActiveImgIndex((i) => {
      const next = Math.min(i, Math.max(0, composerImages.length - 1));
      if (composerImages.length > 0) {
        requestAnimationFrame(() => {
          composerImgScrollRef.current?.scrollTo({ x: next * POST_INNER_WIDTH, animated: false });
        });
      }
      return next;
    });
  }, [composerImages.length]);

  const onSaveRating = async () => {
    if (!isAuthenticated) {
      Alert.alert("Giriş", "Değerlendirme için giriş yapın.", [
        { text: "İptal", style: "cancel" },
        { text: "Giriş", onPress: () => router.push("login") },
      ]);
      return;
    }
    if (!quarterId) return;
    const answers = { ...ratingAnswers };
    if (Object.keys(answers).length === 0) {
      Alert.alert("Değerlendirme", "En az bir soru için yıldız seçin.");
      return;
    }
    setSavingRating(true);
    try {
      const res = await saveQuarterRating({
        quarter_id: quarterId,
        city_id: cityId,
        district_id: districtId,
        answers,
      });
      if (res.ok && (res.data as any)?.success !== false) {
        Alert.alert("Teşekkürler", "Değerlendirmeniz kaydedildi.");
        await loadRatingSummary();
        void loadPosts({ reset: true, cursor: null });
      } else Alert.alert("Hata", res.error || (res.data as any)?.error || "Kaydedilemedi.");
    } finally {
      setSavingRating(false);
    }
  };

  /** Bireysel / girişsiz: yalnızca kullanıcı gönderileri (sistem ilanları & Pro sorgu hariç) */
  const basePosts = useMemo(() => {
    if (restrictUserFeedOnly) return posts.filter((p) => !isSystemPost(p.post_type));
    return posts;
  }, [posts, restrictUserFeedOnly]);

  const visiblePosts = useMemo(() => {
    if (feedTab === "user") return basePosts.filter((p) => !isSystemPost(p.post_type));
    if (feedTab === "listings") return basePosts.filter((p) => p.post_type === "listing_publish");
    if (feedTab === "pro_query") return basePosts.filter((p) => p.post_type === "pro_query");
    return basePosts;
  }, [basePosts, feedTab]);

  const cityItems = useMemo<PickerItem[]>(
    () => [{ value: "", label: "— İl —" }, ...cities.map((c) => ({ value: c.id, label: c.name }))],
    [cities]
  );
  const townItems = useMemo<PickerItem[]>(
    () => [{ value: "", label: "— İlçe —" }, ...towns.map((t) => ({ value: t.id, label: t.name }))],
    [towns]
  );
  const quarterSelectItems = useMemo(
    () => quarterRows.map((q) => ({ value: q.id, label: q.name })),
    [quarterRows]
  );

  const locationSummaryText = useMemo(() => {
    if (scope !== "quarter" || !cityId || !districtId || !quarterId) return "Tüm Türkiye — genel akış";
    const c = cities.find((x) => x.id === Number(cityId))?.name;
    const t = towns.find((x) => x.id === Number(districtId))?.name;
    const q = quarterRows.find((x) => x.id === Number(quarterId))?.name;
    return [c, t, q].filter(Boolean).join(" · ") || "Mahalle seçili";
  }, [scope, cityId, districtId, quarterId, cities, towns, quarterRows]);

  /** Web `renderQuarterInfo` konum satırı: il / ilçe / mahalle */
  const locationMorphLine = useMemo(() => {
    if (scope !== "quarter" || !cityId || !districtId || !quarterId) return "—";
    const c = cities.find((x) => x.id === Number(cityId))?.name;
    const t = towns.find((x) => x.id === Number(districtId))?.name;
    const q = quarterRows.find((x) => x.id === Number(quarterId))?.name;
    return [c, t, q].filter(Boolean).join(" / ") || "—";
  }, [scope, cityId, districtId, quarterId, cities, towns, quarterRows]);

  const morphologySections = useMemo(
    () => buildQuarterMorphologySections(quarterLayers?.morphology ?? undefined, { locationLine: locationMorphLine }),
    [quarterLayers?.morphology, locationMorphLine]
  );

  const selectedQuarterName = useMemo(() => {
    if (scope !== "quarter" || !quarterId) return null;
    return quarterRows.find((x) => x.id === Number(quarterId))?.name?.trim() || null;
  }, [scope, quarterId, quarterRows]);

  const headerTitle = useMemo(() => {
    if (scope === "quarter" && selectedQuarterName) return selectedQuarterName;
    return params.title?.trim() || "ProMahalle";
  }, [scope, selectedQuarterName, params.title]);

  const headerSubtitle = useMemo(() => {
    if (scope === "quarter") return "ProMahalle";
    return "Türkiye geneli paylaşımlar";
  }, [scope]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadPosts({ reset: true, cursor: null });
    void loadRatingSummary();
  }, [loadPosts, loadRatingSummary]);

  const onEndReached = useCallback(() => {
    if (!nextCursor || loadingMore || loadingPosts) return;
    void loadPosts({ reset: false, cursor: nextCursor });
  }, [nextCursor, loadingMore, loadingPosts, loadPosts]);

  const onToggleLike = async (postId: string) => {
    if (!isAuthenticated) {
      Alert.alert("Giriş", "Beğenmek için giriş yapın.", [
        { text: "İptal", style: "cancel" },
        { text: "Giriş", onPress: () => router.push("login") },
      ]);
      return;
    }
    const res = await toggleQuarterSocialLike("post", postId);
    if (res.ok && res.data) {
      const liked = Boolean((res.data as { liked?: boolean }).liked);
      const likeCount = (res.data as { like_count?: number }).like_count;
      setLikedByPost((m) => ({ ...m, [postId]: liked }));
      if (likeCount != null) {
        setPosts((prev) =>
          prev.map((p) => (String(p.post_id) === postId ? { ...p, like_count: likeCount } : p))
        );
      }
    } else Alert.alert("Hata", res.error || "Beğeni başarısız.");
  };

  const onOpenComments = async (postId: string) => {
    if (openCommentsFor === postId) {
      setOpenCommentsFor(null);
      return;
    }
    setOpenCommentsFor(postId);
    setLoadingCommentsFor(postId);
    const res = await fetchQuarterSocialComments(postId);
    setLoadingCommentsFor(null);
    if (res.ok && res.data?.items) setCommentsByPost((m) => ({ ...m, [postId]: res.data!.items! }));
  };

  const onSubmitComment = async (postId: string) => {
    if (!isAuthenticated) {
      Alert.alert("Giriş", "Yorum için giriş yapın.");
      return;
    }
    const text = (commentDraft[postId] || "").trim();
    if (!text) return;
    const res = await createQuarterSocialComment({ post_id: postId, text });
    if (res.ok) {
      setCommentDraft((d) => ({ ...d, [postId]: "" }));
      const cr = await fetchQuarterSocialComments(postId);
      if (cr.ok && cr.data?.items) setCommentsByPost((m) => ({ ...m, [postId]: cr.data!.items! }));
      void loadPosts({ reset: true, cursor: null });
    } else Alert.alert("Hata", res.error || "Yorum gönderilemedi.");
  };

  const onSubmitPost = async () => {
    if (!isAuthenticated) {
      Alert.alert("Giriş", "Paylaşım için giriş yapın.");
      return;
    }
    const t = composerText.trim();
    if (!t || scope !== "quarter" || !quarterId) {
      if (composerImages.length > 0 && !t) {
        Alert.alert("Metin gerekli", "Paylaşım metni zorunludur; görselleri metinle birlikte gönderebilirsiniz.");
      }
      return;
    }
    setSubmittingPost(true);
    try {
      const fd = new FormData();
      fd.set("quarter_id", quarterId);
      fd.set("city_id", cityId);
      fd.set("district_id", districtId);
      fd.set("text", t);
      composerImages.forEach((img, idx) => {
        fd.append("images", {
          uri: img.uri,
          type: img.type || "image/jpeg",
          name: img.name || `photo_${idx}.jpg`,
        } as any);
      });
      const res = await createQuarterSocialPost(fd);
      if (res.ok && res.data?.success !== false) {
        setComposerText("");
        setComposerImages([]);
        setComposerActiveImgIndex(0);
        void loadPosts({ reset: true, cursor: null });
      } else Alert.alert("Hata", (res.data as any)?.error || res.error || "Gönderilemedi.");
    } finally {
      setSubmittingPost(false);
    }
  };

  const cancelEditPost = useCallback(() => {
    setEditingPostId(null);
    setEditDraftText("");
    setEditKeptImageIndexes([]);
    setEditNewImages([]);
  }, []);

  const startEditPost = useCallback(
    (postId: string) => {
      const post = posts.find((p) => String(p.post_id) === postId);
      if (!post) return;
      const imgs = Array.isArray(post.images) ? post.images : [];
      setEditingPostId(postId);
      setEditDraftText(post.text || "");
      setEditKeptImageIndexes(imgs.map((_, i) => i));
      setEditNewImages([]);
      setOpenCommentsFor(null);
    },
    [posts]
  );

  const pickEditImages = useCallback(() => {
    const remain = Math.max(0, MAX_POST_IMAGES - editKeptImageIndexes.length - editNewImages.length);
    if (remain <= 0) {
      Alert.alert("Limit", `En fazla ${MAX_POST_IMAGES} görsel ekleyebilirsiniz.`);
      return;
    }
    launchImageLibrary(
      {
        mediaType: "photo",
        selectionLimit: remain,
        quality: 0.85,
      },
      (response) => {
        if (response.didCancel || response.errorMessage) return;
        const assets = response.assets;
        if (!assets?.length) return;
        setEditNewImages((prev) => {
          const next = [...prev];
          for (const a of assets) {
            if (!a.uri) continue;
            if (editKeptImageIndexes.length + next.length >= MAX_POST_IMAGES) break;
            next.push({
              uri: a.uri,
              type: a.type || "image/jpeg",
              name: a.fileName || `photo_${Date.now()}_${next.length}.jpg`,
            });
          }
          return next;
        });
      }
    );
  }, [editKeptImageIndexes]);

  const saveEditPost = useCallback(async () => {
    if (!editingPostId) return;
    const t = editDraftText.trim();
    if (!t) {
      Alert.alert("Metin gerekli", "Paylaşım metni boş olamaz.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await updateQuarterSocialPost(editingPostId, {
        text: t,
        keepImageIndexes: [...editKeptImageIndexes].sort((a, b) => a - b),
        newImages: editNewImages,
      });
      if (res.ok && res.data?.success !== false) {
        cancelEditPost();
        void loadPosts({ reset: true, cursor: null });
      } else Alert.alert("Hata", (res.data as any)?.error || res.error || "Güncellenemedi.");
    } finally {
      setSavingEdit(false);
    }
  }, [editingPostId, editDraftText, editKeptImageIndexes, editNewImages, loadPosts, cancelEditPost]);

  const onDeletePost = (post: QuarterSocialPost) => {
    const pid = String(post.post_id || "");
    if (!pid) return;
    Alert.alert("Sil", "Bu paylaşımı silmek istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          const res = await deleteQuarterSocialPost(pid);
          if (res.ok) {
            if (editingPostId === pid) cancelEditPost();
            void loadPosts({ reset: true, cursor: null });
          } else Alert.alert("Hata", res.error || "Silinemedi.");
        },
      },
    ]);
  };

  const openDetailUrl = (url?: string) => {
    const u = resolveDjangoUrl(String(url || ""));
    if (u) Linking.openURL(u).catch(() => {});
  };

  const openQuarterSocialSystemDetail = (item: QuarterSocialPost) => {
    const nav = getQuarterSocialNativeDetailNav(item);
    if (nav) {
      router.push("son-30-gun-detay", nav);
      return;
    }
    const detailUrl =
      item.meta && typeof item.meta === "object" ? String((item.meta as Record<string, unknown>).detail_url || "").trim() : "";
    if (detailUrl) openDetailUrl(detailUrl);
  };

  const renderPost = ({ item }: { item: QuarterSocialPost }) => {
    const pid = String(item.post_id || "");
    const liked = Boolean(likedByPost[pid]);
    const sys = isSystemPost(item.post_type);
    const imgs = Array.isArray(item.images) ? item.images : [];
    const detailUrl = item.meta && typeof item.meta === "object" ? String((item.meta as any).detail_url || "").trim() : "";
    const nativeDetailNav = sys ? getQuarterSocialNativeDetailNav(item) : null;
    const canOpenSystemDetail = Boolean(nativeDetailNav) || Boolean(detailUrl);
    const canOpenDetail = sys ? canOpenSystemDetail : Boolean(detailUrl);
    const showDetailCtaUnderImage = imgs.length > 0 && canOpenDetail;
    const isListingAdPost = item.post_type === "listing_publish";
    const metaLines = sys ? systemPostMetaLines(item.meta) : [];
    const commentsOpen = openCommentsFor === pid;
    const comments = commentsByPost[pid] || [];

    return (
      <View style={ps.postCard}>
        <View style={ps.postHeader}>
          <View style={ps.avatar}>
            {item.avatar_url ? (
              <Image source={{ uri: resolveDjangoUrl(String(item.avatar_url)) }} style={ps.avatarImg} />
            ) : (
              <Text style={ps.avatarTxt}>{(item.username || "P").slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ps.postName}>{item.username || "Kullanıcı"}</Text>
            <View style={ps.badgeRow}>
              <View style={[ps.typeBadge, sys && ps.typeBadgeSys]}>
                <Text style={ps.typeBadgeText}>{postLabel(item.post_type)}</Text>
              </View>
              <Text style={ps.postTime}>{fmtDate(item.created_at)}</Text>
            </View>
          </View>
          {item.can_manage && !sys ? (
            <TouchableOpacity
              onPress={() => setPostActionMenuId(pid)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Paylaşım işlemleri"
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={THEME.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {editingPostId === pid ? (
          <View style={ps.postEditWrap}>
            <TextInput
              style={ps.postEditInput}
              placeholder="Paylaşım metninizi güncelleyin..."
              placeholderTextColor={THEME.textMuted}
              multiline
              value={editDraftText}
              onChangeText={setEditDraftText}
              maxLength={2000}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ps.postEditThumbRow}>
              {editKeptImageIndexes
                .slice()
                .sort((a, b) => a - b)
                .map((idx) => {
                  const im = imgs[idx];
                  if (!im) return null;
                  const uri = resolveDjangoUrl(String(im.large || im.thumb || im.original || ""));
                  if (!uri) return null;
                  return (
                    <View key={`k-${idx}`} style={ps.postEditThumbWrap}>
                      <Image source={{ uri }} style={ps.postEditThumb} />
                      <TouchableOpacity
                        style={ps.postEditThumbRm}
                        onPress={() => setEditKeptImageIndexes((prev) => prev.filter((i) => i !== idx))}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="close-circle" size={22} color={THEME.danger} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              {editNewImages.map((im, ii) => (
                <View key={`n-${ii}`} style={ps.postEditThumbWrap}>
                  <Image source={{ uri: im.uri }} style={ps.postEditThumb} />
                  <TouchableOpacity
                    style={ps.postEditThumbRm}
                    onPress={() => setEditNewImages((p) => p.filter((_, j) => j !== ii))}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle" size={22} color={THEME.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={ps.postEditAddBtn} onPress={pickEditImages} accessibilityLabel="Görsel ekle">
                <Ionicons name="add" size={28} color={THEME.accent} />
              </TouchableOpacity>
            </ScrollView>
            <View style={ps.postEditActions}>
              <TouchableOpacity style={ps.postEditGhostBtn} onPress={cancelEditPost} disabled={savingEdit}>
                <Text style={ps.postEditGhostBtnTxt}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ps.postEditSaveBtn, (!editDraftText.trim() || savingEdit) && { opacity: 0.35 }]}
                onPress={() => void saveEditPost()}
                disabled={!editDraftText.trim() || savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={ps.postEditSaveBtnTxt}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <TouchableOpacity
              disabled={sys ? !canOpenSystemDetail : !detailUrl}
              onPress={() => (sys ? openQuarterSocialSystemDetail(item) : openDetailUrl(detailUrl))}
              activeOpacity={sys ? (canOpenSystemDetail ? 0.85 : 1) : detailUrl ? 0.85 : 1}
            >
              <Text style={ps.postBody}>{item.text || ""}</Text>
              {sys && metaLines.length > 0 ? (
                <View style={ps.postMetaBlock}>
                  {metaLines.map((line, i) => (
                    <Text key={i} style={ps.postMetaLine}>
                      {line}
                    </Text>
                  ))}
                </View>
              ) : null}
            </TouchableOpacity>

            {imgs.length > 0 ? (
              <View style={ps.postMediaBlock}>
                <View style={ps.postMediaHeroWrap}>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    style={ps.imgScroll}
                    decelerationRate="fast"
                    ref={(r) => {
                      postImgScrollRefs.current[pid] = r;
                    }}
                    onMomentumScrollEnd={(e) => {
                      const x = e.nativeEvent.contentOffset.x;
                      const idx = Math.round(x / POST_INNER_WIDTH);
                      const clamped = Math.min(Math.max(0, idx), imgs.length - 1);
                      setPostImageIndex((m) => ({ ...m, [pid]: clamped }));
                    }}
                  >
                    {imgs.map((im, ii) => {
                      const uri = resolveDjangoUrl(String(im.large || im.thumb || im.original || ""));
                      if (!uri) return null;
                      return (
                        <View key={ii} style={ps.postImgPage}>
                          <Image source={{ uri }} style={ps.postImg} resizeMode="cover" />
                        </View>
                      );
                    })}
                  </ScrollView>
                  {showDetailCtaUnderImage ? (
                    <TouchableOpacity
                      style={[ps.postDetailCtaOverlay, isListingAdPost && ps.postDetailCtaOverlayListing]}
                      onPress={() => (sys ? openQuarterSocialSystemDetail(item) : openDetailUrl(detailUrl))}
                      activeOpacity={0.88}
                      accessibilityRole="button"
                      accessibilityLabel="Detayları incele"
                    >
                      <Text style={[ps.postDetailCtaTxt, isListingAdPost && ps.postDetailCtaTxtOnYellow]}>
                        Detayları İncele
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {imgs.length > 1 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={ps.postThumbStrip}
                    contentContainerStyle={ps.postThumbStripContent}
                  >
                    {imgs.map((im, ii) => {
                      const uri = resolveDjangoUrl(String(im.thumb || im.large || im.original || ""));
                      if (!uri) return null;
                      const active = (postImageIndex[pid] ?? 0) === ii;
                      return (
                        <TouchableOpacity
                          key={`th-${ii}`}
                          activeOpacity={0.85}
                          onPress={() => {
                            setPostImageIndex((m) => ({ ...m, [pid]: ii }));
                            postImgScrollRefs.current[pid]?.scrollTo({
                              x: ii * POST_INNER_WIDTH,
                              animated: true,
                            });
                          }}
                          style={[ps.postThumbSmWrap, active && ps.postThumbSmWrapOn]}
                          accessibilityLabel={`Görsel ${ii + 1}`}
                        >
                          <Image source={{ uri }} style={ps.postThumbSm} resizeMode="cover" />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : null}
              </View>
            ) : null}
          </>
        )}

        <View style={ps.postActions}>
          <TouchableOpacity style={ps.actionBtn} onPress={() => onToggleLike(pid)}>
            <Ionicons
              name={liked ? "thumbs-up" : "thumbs-up-outline"}
              size={22}
              color={liked ? COLORS.accentBlue : THEME.textSecondary}
            />
            <Text style={ps.actionTxt}>{item.like_count ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ps.actionBtn} onPress={() => void onOpenComments(pid)}>
            <Ionicons name="chatbubble-outline" size={21} color={THEME.textSecondary} />
            <Text style={ps.actionTxt}>{item.comment_count ?? 0}</Text>
          </TouchableOpacity>
        </View>

        {commentsOpen ? (
          <View style={ps.commentBox}>
            {loadingCommentsFor === pid ? (
              <ActivityIndicator color={THEME.accent} />
            ) : (
              comments.slice(0, 12).map((c, ci) => (
                <Text key={ci} style={ps.commentLine}>
                  <Text style={{ fontWeight: "700", color: THEME.text }}>
                    {String((c as any).username || "Kullanıcı")}:{" "}
                  </Text>
                  {String((c as any).text || "")}
                </Text>
              ))
            )}
            {isAuthenticated ? (
              <View style={ps.commentInputRow}>
                <TextInput
                  style={ps.commentInput}
                  placeholder="Yorum yazın…"
                  placeholderTextColor={THEME.textMuted}
                  value={commentDraft[pid] || ""}
                  onChangeText={(x) => setCommentDraft((d) => ({ ...d, [pid]: x }))}
                />
                <TouchableOpacity style={ps.sendCmtBtn} onPress={() => void onSubmitComment(pid)}>
                  <Ionicons name="send" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const locationCard = (
    <View style={ps.locCard}>
      <TouchableOpacity
        style={ps.locCardHeader}
        onPress={() => setLocationPickerExpanded((e) => !e)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={locationPickerExpanded ? "Konum seçimini daralt" : "Konum seçimini aç"}
      >
        <View style={{ flex: 1 }}>
          <Text style={ps.locTitle}>Mahalle seçimi</Text>
          {!locationPickerExpanded ? (
            <Text style={ps.locCollapsedSummary} numberOfLines={2}>
              {locationSummaryText}
            </Text>
          ) : (
            <Text style={ps.locHint}>Tüm iller, ilçeler ve mahalleler (Pro sorgu filtresi yok).</Text>
          )}
        </View>
        <Ionicons name={locationPickerExpanded ? "chevron-up" : "chevron-down"} size={22} color={THEME.accent} />
      </TouchableOpacity>
      {locationPickerExpanded ? (
        <>
          <PickerRow
            label="İl"
            hideLabel
            placeholder="İl seçin"
            items={cityItems}
            selectedValue={draftCity}
            onSelect={(v) => setDraftCity(v ? Number(v) : null)}
            loading={citiesLoading}
          />
          <PickerRow
            label="İlçe"
            hideLabel
            placeholder="İlçe seçin"
            items={townItems}
            selectedValue={draftTown}
            onSelect={(v) => setDraftTown(v ? Number(v) : null)}
            loading={townsLoading}
            disabled={!draftCity}
          />
          <PromahalleQuarterSelect
            label="Mahalle"
            hideLabel
            placeholder="Mahalle seçin"
            items={quarterSelectItems}
            selectedValue={draftQuarter}
            onSelect={(v) => setDraftQuarter(v)}
            loading={quartersLoading}
            disabled={!draftTown}
          />
          <View style={ps.locActions}>
            <TouchableOpacity style={ps.btnPrimary} onPress={() => void applyLocation()} activeOpacity={0.9}>
              <Ionicons name="location" size={18} color={THEME.bg} style={{ marginRight: 8 }} />
              <Text style={ps.btnPrimaryText}>Mahalleyi uygula</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ps.btnGhost} onPress={resetToGlobal}>
              <Text style={ps.btnGhostText}>Tüm paylaşımlar</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </View>
  );

  const layersMorphologySection = (
    <View style={ps.morphBlock}>
      <Text style={ps.morphSecTitle}>Mahalle bilgileri</Text>
      {layersLoading ? <ActivityIndicator color={THEME.accent} style={{ marginVertical: 10 }} /> : null}
      {layersError ? <Text style={ps.sheetErr}>{layersError}</Text> : null}
      {!layersLoading && !layersError && !quarterLayers?.morphology ? (
        <Text style={ps.morphLineMuted}>Bu mahalle için morfoloji kaydı yok veya veri henüz yüklenmedi.</Text>
      ) : null}
      {!layersLoading && !layersError && quarterLayers?.morphology
        ? morphologySections.map((sec) => (
            <View key={sec.title} style={{ marginTop: 12 }}>
              <Text style={ps.morphSubSecTitle}>{sec.title}</Text>
              {sec.rows.map((row) => (
                <View key={row.label} style={ps.morphKvRow}>
                  <Text style={ps.morphLineKey}>{row.label}</Text>
                  <Text style={ps.morphLineVal}>{row.value}</Text>
                </View>
              ))}
            </View>
          ))
        : null}
      {quarterLayers?.features ? (
        <View style={{ marginTop: 14 }}>
          <Text style={ps.morphSubSecTitle}>Harita katmanı verisi</Text>
          {QUARTER_LAYER_UI_GROUPS.map((group) => (
            <View key={group} style={{ marginTop: 10 }}>
              <Text style={ps.morphGroupTitle}>{group}</Text>
              {QUARTER_LAYER_DEFS.filter((d) => d.group === group).map((def) => {
                const on = quarterLayers.features?.[def.featureKey] === true;
                return (
                  <View key={def.featureKey} style={ps.morphKvRow}>
                    <Text style={ps.morphLineKey}>{def.label}</Text>
                    <Text style={ps.morphLineVal}>{on ? "Mevcut" : "Yok"}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  const mapCoreChildren = useMemo(() => {
    if (!Mapbox) return null;
    const center: [number, number] = mapCenter ? [mapCenter[0], mapCenter[1]] : [32.85, 39.93];
    const zoom = mapCenter ? 15 : 5.2;
    const animMs = mapCenter ? 1100 : 0;
    return (
      <>
        <Mapbox.Camera
          key={`cam-${center[0]}-${center[1]}-${zoom}-${mapTerrain3D ? "3d" : "2d"}`}
          defaultSettings={{
            centerCoordinate: center,
            zoomLevel: zoom,
            pitch: mapTerrain3D ? 55 : 0,
            animationDuration: animMs,
            animationMode: mapCenter ? "easeTo" : undefined,
          }}
        />
        {mapTerrain3D && RasterDemSource && Terrain ? (
          <RasterDemSource id="promahalle-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxZoomLevel={15}>
            <Terrain style={{ exaggeration: 1.35 }} />
          </RasterDemSource>
        ) : null}
        <PromahalleMapLayers
          Mapbox={Mapbox}
          layers={quarterLayers?.layers as Record<string, unknown> | undefined}
          visibility={layerVisibility}
        />
      </>
    );
  }, [mapCenter?.[0], mapCenter?.[1], mapTerrain3D, mapCenter, quarterLayers?.layers, layerVisibility]);

  const mapPreview = (
    <View style={ps.mapCard}>
      <Text style={ps.mapCardTitle}>Harita</Text>
      <View style={ps.mapFrame}>
        {Mapbox ? (
          <Mapbox.MapView
            style={{ flex: 1 }}
            styleURL="mapbox://styles/mapbox/satellite-streets-v12"
            logoEnabled={false}
            attributionEnabled={false}
            scaleBarEnabled={false}
          >
            {mapCoreChildren}
          </Mapbox.MapView>
        ) : (
          <View style={ps.mapPlaceholder}>
            <Text style={ps.mapPlaceholderTxt}>Harita modülü kullanılamıyor</Text>
          </View>
        )}
        {Mapbox ? (
          <View style={ps.mapOverlayCol} pointerEvents="box-none">
            <TouchableOpacity
              style={ps.mapCtrlBtn}
              onPress={() => setMapTerrain3D((v) => !v)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={mapTerrain3D ? "Düz harita" : "Arazi 3D"}
            >
              <Text style={ps.mapCtrlTxt}>3D</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ps.mapCtrlBtn}
              onPress={() => setMapFullscreenVisible(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Haritayı tam ekran aç"
            >
              <Ionicons name="expand-outline" size={20} color="#f8fafc" />
            </TouchableOpacity>
          </View>
        ) : null}
        {scope === "quarter" && layersLoading ? (
          <View style={ps.mapLoadingOverlay}>
            <ActivityIndicator color={COLORS.accentBlue} />
          </View>
        ) : null}
      </View>
      {scope === "quarter" ? (
        <>
          <TouchableOpacity
            style={ps.layersCollapsibleTrigger}
            onPress={() => setLayersPanelExpanded((e) => !e)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={layersPanelExpanded ? "Mahalle katman bilgisini gizle" : "Mahalle katman bilgisini göster"}
          >
            <Ionicons name="layers-outline" size={20} color={THEME.accent} />
            <Text style={ps.layersCollapsibleTriggerTxt}>Mahalle bilgileri & katmanlar</Text>
            <Ionicons name={layersPanelExpanded ? "chevron-up" : "chevron-down"} size={20} color={THEME.textSecondary} />
          </TouchableOpacity>
          {layersPanelExpanded ? (
            <ScrollView
              style={ps.layersCollapsibleBody}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <Text style={ps.sheetSubtitle}>
                Harita ve katman verileri web «mahalle bilgileri» sayfasıyla aynı uç noktadan gelir.
              </Text>
              {layersMorphologySection}
            </ScrollView>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const ratingCard =
    scope === "quarter" && quarterId ? (
      <View style={ps.ratingCard}>
        <View style={ps.ratingHeaderRow}>
          <Ionicons name="star" size={22} color={THEME.starOn} />
          <Text style={ps.ratingTitle}>Mahalle değerlendirmesi</Text>
        </View>
        <Text style={ps.ratingSub}>
          {ratingSummary?.response_count != null && ratingSummary.response_count > 0
            ? `${ratingSummary.response_count} katılımcı · Ortalama ${(ratingSummary.overall_avg ?? 0).toFixed(1)}/5`
            : "Aşağıdaki sorularda 1–5 yıldız ile oylayın (web ile aynı kriterler)."}
        </Text>
        {loadingRating ? (
          <ActivityIndicator style={{ marginVertical: 16 }} color={THEME.accent} />
        ) : (
          <>
            {QUARTER_RATING_QUESTIONS.map(([key, label]) => {
              const qAvg = ratingSummary?.questions?.find((q) => q.key === key);
              return (
                <View key={key} style={ps.ratingQ}>
                  <Text style={ps.ratingQLabel}>{label}</Text>
                  {qAvg != null && (qAvg.avg ?? 0) > 0 ? (
                    <Text style={ps.ratingQHint}>
                      Topluluk ort. {Number(qAvg.avg).toFixed(1)}/5 · {qAvg.count ?? 0} oy
                    </Text>
                  ) : null}
                  <StarRow
                    value={ratingAnswers[key] ?? 0}
                    onChange={(n) => setRatingAnswers((r) => ({ ...r, [key]: n }))}
                  />
                </View>
              );
            })}
            {isAuthenticated ? (
              <TouchableOpacity
                style={[ps.ratingSaveBtn, savingRating && { opacity: 0.65 }]}
                disabled={savingRating}
                onPress={() => void onSaveRating()}
              >
                {savingRating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={ps.ratingSaveTxt}>Değerlendirmeyi kaydet</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={ps.ratingLoginHint} onPress={() => router.push("login")} activeOpacity={0.85}>
                <Text style={ps.ratingLoginHintTxt}>Değerlendirmek için giriş yapın</Text>
                <Ionicons name="chevron-forward" size={18} color={THEME.accent} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    ) : null;

  const segmentRow = (
    <View style={ps.segmentWrap}>
      <TouchableOpacity
        style={[ps.segmentBtn, mainSegment === "feed" && ps.segmentBtnOn]}
        onPress={() => setMainSegment("feed")}
      >
        <Ionicons name="newspaper-outline" size={18} color={mainSegment === "feed" ? THEME.bg : THEME.accent} />
        <Text style={[ps.segmentTxt, mainSegment === "feed" && ps.segmentTxtOn]}>Akış</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[ps.segmentBtn, mainSegment === "experts" && ps.segmentBtnOn, scope !== "quarter" && { opacity: 0.4 }]}
        onPress={() => scope === "quarter" && setMainSegment("experts")}
        disabled={scope !== "quarter"}
      >
        <Ionicons name="people-outline" size={18} color={mainSegment === "experts" ? THEME.bg : THEME.accent} />
        <Text style={[ps.segmentTxt, mainSegment === "experts" && ps.segmentTxtOn]}>Uzmanlar</Text>
      </TouchableOpacity>
    </View>
  );

  const feedTabs = (
    <View style={ps.feedTabBlock}>
      <View style={ps.segmentWrap} accessibilityRole="tablist" accessibilityLabel="Akış türü">
        <TouchableOpacity
          style={[ps.segmentBtn, feedTab === "all" && ps.segmentBtnOn]}
          onPress={() => setFeedTab("all")}
          activeOpacity={0.85}
          accessibilityRole="tab"
          accessibilityState={{ selected: feedTab === "all" }}
        >
          <Text style={[ps.segmentTxt, ps.feedSegmentTxt, feedTab === "all" && ps.segmentTxtOn]} numberOfLines={1}>
            Tümü
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ps.segmentBtn, feedTab === "listings" && ps.segmentBtnOn]}
          onPress={() => setFeedTab("listings")}
          activeOpacity={0.85}
          accessibilityRole="tab"
          accessibilityState={{ selected: feedTab === "listings" }}
        >
          <Text style={[ps.segmentTxt, ps.feedSegmentTxt, feedTab === "listings" && ps.segmentTxtOn]} numberOfLines={1}>
            İlanlar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ps.segmentBtn, feedTab === "pro_query" && ps.segmentBtnOn]}
          onPress={() => setFeedTab("pro_query")}
          activeOpacity={0.85}
          accessibilityRole="tab"
          accessibilityState={{ selected: feedTab === "pro_query" }}
        >
          <Text style={[ps.segmentTxt, ps.feedSegmentTxt, feedTab === "pro_query" && ps.segmentTxtOn]} numberOfLines={1}>
            ProSorgular
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ps.segmentBtn, feedTab === "user" && ps.segmentBtnOn]}
          onPress={() => setFeedTab("user")}
          activeOpacity={0.85}
          accessibilityRole="tab"
          accessibilityState={{ selected: feedTab === "user" }}
        >
          <Text style={[ps.segmentTxt, ps.feedSegmentTxt, feedTab === "user" && ps.segmentTxtOn]} numberOfLines={1}>
            Paylaşım
          </Text>
        </TouchableOpacity>
      </View>
      {restrictUserFeedOnly ? (
        <View style={ps.subTabHint}>
          <Text style={ps.subTabHintTxt}>
            Bireysel üyelerde yalnızca topluluk paylaşımları listelenir; İlanlar ve ProSorgular sekmeleri boş olabilir.
          </Text>
        </View>
      ) : null}
    </View>
  );

  /** Web `QuarterSocialApp`: sekmelerin altında, gönderi listesinin üstünde paylaşım formu */
  const composerSubHint =
    !isAuthenticated
      ? "Paylaşım ve yorum için önce giriş yapın veya üye olun."
      : scope === "quarter" && quarterId
        ? "Görüşünü yaz, fotoğraf ekle ve komşularınla paylaş."
        : "Önce mahalle seçerek paylaşımı başlat.";
  const composerPlaceholder =
    !isAuthenticated
      ? "Paylaşım yapmak için giriş yapın"
      : scope === "quarter" && quarterId
        ? "Mahalle hakkında görüşünü paylaş..."
        : "Önce mahalle seçin";
  const canCompose = isAuthenticated && scope === "quarter" && Boolean(quarterId);

  const feedComposerSection = (
    <View style={ps.composerCard}>
      <View style={ps.composerHeadRow}>
        <View style={ps.composerAvatarWrap}>
          <Ionicons name="person" size={22} color={THEME.accentDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ps.composerCardTitle}>Mahallede neler oluyor?</Text>
          <Text style={ps.composerCardSub}>{composerSubHint}</Text>
        </View>
      </View>
      {!isAuthenticated ? (
        <TouchableOpacity style={ps.composerLoginRow} onPress={() => router.push("login")} activeOpacity={0.85}>
          <Text style={ps.composerLoginRowTxt}>Paylaşım yapmak için giriş yapın</Text>
          <Ionicons name="log-in-outline" size={20} color={THEME.accent} />
        </TouchableOpacity>
      ) : canCompose ? (
        <>
          {composerImages.length > 0 ? (
            <View style={ps.composerMediaBlock}>
              <ScrollView
                ref={composerImgScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={ps.composerHeroScroll}
                decelerationRate="fast"
                onMomentumScrollEnd={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const idx = Math.round(x / POST_INNER_WIDTH);
                  setComposerActiveImgIndex(
                    Math.min(Math.max(0, idx), Math.max(0, composerImages.length - 1))
                  );
                }}
              >
                {composerImages.map((im, ii) => (
                  <View key={`hero-${im.uri}-${ii}`} style={ps.composerHeroPage}>
                    <Image source={{ uri: im.uri }} style={ps.composerHeroImg} resizeMode="cover" />
                  </View>
                ))}
              </ScrollView>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={ps.composerThumbStripRow}
                contentContainerStyle={ps.composerThumbStripContent}
              >
                {composerImages.map((im, ii) => (
                  <View key={`${im.uri}-${ii}`} style={ps.composerThumbWrap}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setComposerActiveImgIndex(ii);
                        composerImgScrollRef.current?.scrollTo({ x: ii * POST_INNER_WIDTH, animated: true });
                      }}
                      style={[ps.composerThumbInner, composerActiveImgIndex === ii && ps.composerThumbInnerOn]}
                    >
                      <Image source={{ uri: im.uri }} style={ps.composerThumb} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={ps.composerThumbRemove}
                      onPress={() => setComposerImages((p) => p.filter((_, j) => j !== ii))}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close-circle" size={22} color={THEME.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
          <View style={ps.composerRow}>
            <TouchableOpacity style={ps.composerAddPhoto} onPress={pickComposerImages} accessibilityLabel="Görsel ekle">
              <Ionicons name="images-outline" size={26} color={THEME.accent} />
            </TouchableOpacity>
            <TextInput
              style={ps.composerInput}
              placeholder={composerPlaceholder}
              placeholderTextColor={THEME.textMuted}
              multiline
              value={composerText}
              onChangeText={setComposerText}
              maxLength={2000}
            />
            <TouchableOpacity
              style={[
                ps.composerSendBtn,
                (!composerText.trim() || submittingPost) && { opacity: 0.35 },
              ]}
              disabled={!composerText.trim() || submittingPost}
              onPress={() => void onSubmitPost()}
            >
              {submittingPost ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Ionicons name="send" size={22} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={ps.composerHint}>En fazla {MAX_POST_IMAGES} görsel · Metin zorunlu</Text>
        </>
      ) : (
        <View style={ps.composerDisabledBox}>
          <Text style={ps.composerDisabledTxt}>{composerPlaceholder}</Text>
        </View>
      )}
    </View>
  );

  const expertsBody =
    mainSegment === "experts" ? (
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.pageBg }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        refreshControl={
          <RefreshControl
            refreshing={loadingExperts}
            onRefresh={() => void loadExperts()}
            tintColor={COLORS.accentBlue}
          />
        }
      >
        {locationCard}
        {mapPreview}
        {segmentRow}
        <Text style={ps.sectionTitle}>Bu mahallede uzman emlakçılar</Text>
        {loadingExperts ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={THEME.accent} />
        ) : consultants.length === 0 ? (
          <Text style={ps.emptyTxt}>Uzman bulunamadı veya mahalle seçimi eksik.</Text>
        ) : (
          consultants.map((c, i) => (
            <View key={String(c.user_id ?? i)} style={ps.expertCard}>
              <View style={ps.expertRow}>
                {c.avatar_url ? (
                  <Image source={{ uri: resolveDjangoUrl(String(c.avatar_url)) }} style={ps.expertAv} />
                ) : (
                  <View style={[ps.expertAv, { alignItems: "center", justifyContent: "center", backgroundColor: THEME.accentSoft }]}>
                    <Text style={{ color: THEME.accentDark, fontWeight: "800" }}>
                      {(c.full_name || "?").slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={ps.expertName}>{c.full_name || "Danışman"}</Text>
                  {c.company_name ? <Text style={ps.expertCo}>{c.company_name}</Text> : null}
                  <Text style={ps.expertMeta}>
                    {c.member_label || ""}
                    {c.agent_rating_avg_overall != null
                      ? ` · ⭐ ${Number(c.agent_rating_avg_overall).toFixed(1)}`
                      : ""}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    ) : null;

  return (
    <SafeAreaView style={ps.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

      <View style={ps.header}>
        <TouchableOpacity onPress={() => router.back()} style={ps.headerBtn} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <View style={ps.headerCenter}>
          <Text style={ps.headerTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
          <Text style={ps.headerSub} numberOfLines={1}>
            {headerSubtitle}
          </Text>
        </View>
        <View style={ps.headerRight}>
          {scope === "quarter" && quarterId ? (
            <TouchableOpacity
              style={ps.headerScoreChip}
              onPress={() => setRatingSheetVisible(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Mahalle puanı ve değerlendirme"
            >
              <Ionicons name="star" size={16} color={THEME.starOn} />
              {scoreData?.final_score != null ? (
                <Text style={ps.headerScoreChipTxt}>{Number(scoreData.final_score).toFixed(0)}</Text>
              ) : ratingSummary?.overall_avg != null ? (
                <Text style={ps.headerScoreChipTxt}>{Number(ratingSummary.overall_avg).toFixed(1)}</Text>
              ) : (
                <Text style={ps.headerScoreChipTxtMuted}>Puan</Text>
              )}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={ps.headerBtn}
            onPress={() => setMapMenuSheetVisible(true)}
            disabled={scope !== "quarter"}
            accessibilityLabel="Harita menüsü"
          >
            <Ionicons name="menu" size={22} color={scope === "quarter" ? "#f8fafc" : "rgba(248,250,252,0.35)"} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={ps.contentWrap}>
        {mainSegment === "experts" ? (
          expertsBody
        ) : (
        <KeyboardAwareBody headerHeight={56} backgroundColor={COLORS.pageBg}>
          <FlatList
            style={{ flex: 1, backgroundColor: COLORS.pageBg }}
            data={visiblePosts}
            keyExtractor={(it) => String(it.post_id || Math.random())}
            renderItem={renderPost}
            ListHeaderComponent={
              <>
                {locationCard}
                {mapPreview}
                {segmentRow}
                {feedTabs}
                {feedComposerSection}
              </>
            }
            contentContainerStyle={{
              paddingBottom: insets.bottom + 32,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accentBlue} />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.35}
            extraData={{
              editingPostId,
              editDraftText,
              editKeptImageIndexes,
              editNewImages,
              postActionMenuId,
              likedByPost,
              postImageIndex,
              composerImages,
              composerActiveImgIndex,
            }}
            ListEmptyComponent={
              loadingPosts ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={THEME.accent} />
              ) : (
                <Text style={ps.emptyTxt}>
                  {feedTab === "listings"
                    ? "Bu filtrede henüz ilan bildirimi yok. Aşağı çekerek yenileyin."
                    : feedTab === "pro_query"
                      ? "Bu filtrede henüz Pro sorgu bildirimi yok. Aşağı çekerek yenileyin."
                      : feedTab === "user"
                        ? "Henüz kullanıcı paylaşımı yok. Aşağı çekerek yenileyin."
                        : "Henüz gönderi yok. Aşağı çekerek yenileyin."}
                </Text>
              )
            }
            ListFooterComponent={loadingMore ? <ActivityIndicator color={THEME.accent} style={{ marginVertical: 16 }} /> : null}
          />
        </KeyboardAwareBody>
        )}
      </View>

      <Modal
        visible={postActionMenuId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPostActionMenuId(null)}
      >
        <View style={ps.postMenuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPostActionMenuId(null)} />
          <View style={[ps.postMenuSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={ps.postMenuItem}
              onPress={() => {
                const id = postActionMenuId;
                setPostActionMenuId(null);
                if (id) startEditPost(id);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={22} color={THEME.text} />
              <Text style={ps.postMenuItemTxt}>Düzenle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ps.postMenuItem}
              onPress={() => {
                const id = postActionMenuId;
                setPostActionMenuId(null);
                if (id) {
                  const p = posts.find((x) => String(x.post_id) === id);
                  if (p) onDeletePost(p);
                }
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={22} color={THEME.danger} />
              <Text style={[ps.postMenuItemTxt, { color: THEME.danger }]}>Sil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ps.postMenuCancel} onPress={() => setPostActionMenuId(null)} activeOpacity={0.85}>
              <Text style={ps.postMenuItemCancel}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AppBottomSheetModal
        visible={ratingSheetVisible && scope === "quarter"}
        onClose={() => setRatingSheetVisible(false)}
        snapPoints={["70%", "92%"]}
        variant="light"
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 28 }}>
          <Text style={ps.sheetTitle}>Mahalle puanı & değerlendirme</Text>
          <Text style={ps.sheetSubtitle}>
            Topluluk yıldızları ve kriterler; web mahalle bilgileri ile aynı soru seti.
          </Text>
          {scoreData?.final_score != null ? (
            <View style={ps.scoreBanner}>
              <Ionicons name="sparkles" size={22} color={THEME.accent} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={ps.scoreLabel}>Mahalle skoru (sosyal)</Text>
                <Text style={ps.scoreVal}>{Number(scoreData.final_score).toFixed(1)} / 100</Text>
              </View>
            </View>
          ) : null}
          {ratingCard}
        </BottomSheetScrollView>
      </AppBottomSheetModal>

      <AppBottomSheetModal
        visible={mapMenuSheetVisible && scope === "quarter"}
        onClose={() => setMapMenuSheetVisible(false)}
        snapPoints={["70%", "92%"]}
        variant="light"
        backdropPressBehavior="close"
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
          <Text style={[ps.sheetTitle, { paddingHorizontal: 16 }]}>Harita menüsü</Text>
          <Text style={[ps.sheetSubtitle, { paddingHorizontal: 16 }]}>
            Web «Mahalle Bilgileri» sağ toolbar ile aynı katmanlar. Ek çizim araçları için tam sayfayı tarayıcıda açabilirsiniz.
          </Text>

          <TouchableOpacity
            style={ps.menuRow}
            onPress={() => {
              setMapMenuSheetVisible(false);
              const url = promahallePageUrl({
                city_id: cityId || undefined,
                town_id: districtId || undefined,
                quarter_id: quarterId || undefined,
                proparcel_value: proparcelValue != null ? String(proparcelValue) : undefined,
              });
              Linking.openURL(url).catch(() => {});
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="open-outline" size={22} color={THEME.accent} />
            <View style={{ flex: 1 }}>
              <Text style={ps.menuRowTitle}>Tam özellikli harita (web)</Text>
              <Text style={ps.menuRowSub}>Çizimler ve gelişmiş araçlar — mahalle-bilgileri sayfası</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={ps.menuRow}
            onPress={() => {
              setMapMenuSheetVisible(false);
              setRatingSheetVisible(true);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="star" size={22} color={THEME.starOn} />
            <View style={{ flex: 1 }}>
              <Text style={ps.menuRowTitle}>Mahalle puanı & yıldız oylama</Text>
              <Text style={ps.menuRowSub}>Değerlendirme panelini aç</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={ps.menuRow}
            onPress={() => {
              setMapMenuSheetVisible(false);
              setLayersPanelExpanded(true);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="document-text-outline" size={22} color={THEME.accent} />
            <View style={{ flex: 1 }}>
              <Text style={ps.menuRowTitle}>Morfoloji & metin özet</Text>
              <Text style={ps.menuRowSub}>Haritanın altındaki katman bilgisi panelini aç</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
          </TouchableOpacity>

          <Text style={[ps.menuSectionTitle, { marginTop: 8 }]}>Katmanlar (web ile aynı)</Text>

          {mapMenuLayerSections.map((section) => (
            <View key={section.title}>
              <Text style={ps.menuSectionHeading}>{section.title}</Text>
              {section.items.map((def) => {
                const feats = quarterLayers?.features as Record<string, boolean> | undefined;
                const hasData = feats?.[def.featureKey] === true;
                const hasGeo = quarterLayers?.layers?.[def.layerId as keyof typeof quarterLayers.layers] != null;
                const disabled = !hasData || !hasGeo;
                return (
                  <View key={def.layerId} style={ps.layerToggleRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[ps.menuRowTitle, disabled && { color: THEME.textMuted }]}>{def.label}</Text>
                      {disabled ? (
                        <Text style={ps.menuRowSub}>Veri yok</Text>
                      ) : null}
                    </View>
                    <Switch
                      value={Boolean(layerVisibility[def.layerId])}
                      onValueChange={(v) => {
                        if (disabled) return;
                        setLayerVisibility((prev) => ({ ...prev, [def.layerId]: v }));
                      }}
                      disabled={disabled}
                      trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
                      thumbColor={disabled ? "#e2e8f0" : layerVisibility[def.layerId] ? THEME.accent : "#f4f4f5"}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </BottomSheetScrollView>
      </AppBottomSheetModal>

      <Modal
        visible={mapFullscreenVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setMapFullscreenVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
          <StatusBar barStyle="light-content" />
          {Mapbox ? (
            <Mapbox.MapView
              style={{ flex: 1 }}
              styleURL="mapbox://styles/mapbox/satellite-streets-v12"
              logoEnabled={false}
              attributionEnabled={false}
              scaleBarEnabled={false}
            >
              {mapCoreChildren}
            </Mapbox.MapView>
          ) : (
            <View style={[ps.mapPlaceholder, { flex: 1 }]}>
              <Text style={ps.mapPlaceholderTxt}>Harita modülü kullanılamıyor</Text>
            </View>
          )}
          <SafeAreaView edges={["top", "left", "right"]} style={ps.mapFsBar}>
            <TouchableOpacity
              style={ps.mapCtrlBtn}
              onPress={() => setMapTerrain3D((v) => !v)}
              activeOpacity={0.85}
              accessibilityLabel={mapTerrain3D ? "Düz harita" : "Arazi 3D"}
            >
              <Text style={ps.mapCtrlTxt}>3D</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ps.mapCtrlBtn}
              onPress={() => setMapFullscreenVisible(false)}
              activeOpacity={0.85}
              accessibilityLabel="Tam ekranı kapat"
            >
              <Ionicons name="close" size={24} color="#f8fafc" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  android: { elevation: 2 },
});

const ps = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.headerBg },
  contentWrap: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.accentBlue,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 2,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff", flexShrink: 1, textAlign: "center" },
  headerSub: { fontSize: 11, color: "rgba(248,250,252,0.75)", textAlign: "center" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 36, justifyContent: "flex-end" },
  headerScoreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    maxWidth: 88,
  },
  headerScoreChipTxt: { fontSize: 13, fontWeight: "800", color: "#fef3c7" },
  headerScoreChipTxtMuted: { fontSize: 12, fontWeight: "700", color: "rgba(248,250,252,0.85)" },

  locCard: {
    marginHorizontal: 12,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    ...cardShadow,
  },
  locCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  locTitle: { fontSize: 16, fontWeight: "800", color: THEME.text },
  locCollapsedSummary: { fontSize: 13, color: THEME.textSecondary, marginTop: 6, lineHeight: 18 },
  locHint: { fontSize: 12, color: THEME.textSecondary, marginTop: 4, marginBottom: 12 },
  locActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  mapCard: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    overflow: "hidden",
    ...cardShadow,
  },
  mapCardTitle: { fontSize: 14, fontWeight: "800", color: THEME.text, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  mapFrame: { height: 200, width: "100%", backgroundColor: "#0f172a", position: "relative" },
  mapOverlayCol: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 20,
    gap: 8,
    alignItems: "flex-end",
  },
  mapCtrlBtn: {
    backgroundColor: "rgba(15,23,42,0.82)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
    minWidth: 44,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  mapCtrlTxt: { color: "#f8fafc", fontSize: 13, fontWeight: "800" },
  mapFsBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  mapPlaceholderTxt: { color: THEME.textMuted, fontSize: 13 },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.25)",
  },
  layersCollapsibleTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: THEME.accentSoft,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.borderLight,
  },
  layersCollapsibleTriggerTxt: { flex: 1, fontSize: 14, fontWeight: "800", color: THEME.accentDark },
  layersCollapsibleBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.borderLight,
    backgroundColor: THEME.bgWhite,
    maxHeight: 360,
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: THEME.text, marginBottom: 6 },
  sheetSubtitle: { fontSize: 12, color: THEME.textSecondary, lineHeight: 17, marginBottom: 14 },
  sheetErr: { color: THEME.danger, fontSize: 13, marginBottom: 10, lineHeight: 18 },
  morphBlock: { marginBottom: 16 },
  morphSecTitle: { fontSize: 14, fontWeight: "800", color: THEME.accentDark, marginBottom: 6 },
  morphSubSecTitle: { fontSize: 13, fontWeight: "800", color: THEME.text, marginBottom: 8 },
  morphGroupTitle: { fontSize: 12, fontWeight: "700", color: THEME.textSecondary, marginBottom: 6 },
  morphKvRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.borderLight,
  },
  morphLineKey: { flex: 1, fontSize: 12, color: THEME.textSecondary, lineHeight: 18, fontWeight: "600" },
  morphLineVal: { flex: 1, fontSize: 12, color: THEME.text, lineHeight: 18, textAlign: "right" },
  morphLineMuted: { fontSize: 11, color: THEME.textMuted, lineHeight: 16 },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnPrimaryText: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
  btnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.bgWhite,
  },
  btnGhostText: { color: THEME.accentDark, fontWeight: "600" },

  pickerWrap: { marginBottom: 10 },
  pickerLabel: { fontSize: 12, fontWeight: "700", color: THEME.textSecondary, marginBottom: 6 },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: THEME.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerBtnText: { flex: 1, fontSize: 15, color: THEME.text, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: THEME.bgWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 28,
    minHeight: "70%",
    maxHeight: "92%",
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.border,
    marginTop: 10,
    marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: THEME.text, paddingHorizontal: 20, marginBottom: 8 },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.borderLight,
  },
  modalItemActive: { backgroundColor: THEME.accentSoft },
  modalItemText: { fontSize: 15, color: THEME.text, flex: 1, paddingRight: 8 },

  segmentWrap: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: THEME.bgWhite,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: THEME.border,
    ...cardShadow,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
  },
  segmentBtnOn: { backgroundColor: THEME.accent },
  segmentTxt: { fontSize: 14, fontWeight: "800", color: THEME.accent },
  segmentTxtOn: { color: "#ffffff" },

  scoreBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: THEME.accentSoft,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    ...cardShadow,
  },
  scoreLabel: { fontSize: 11, color: THEME.textSecondary, textTransform: "uppercase", letterSpacing: 0.8 },
  scoreVal: { fontSize: 22, fontWeight: "900", color: THEME.accentDark, marginTop: 2 },

  ratingCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    ...cardShadow,
  },
  ratingHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  ratingTitle: { fontSize: 16, fontWeight: "800", color: THEME.text },
  ratingSub: { fontSize: 12, color: THEME.textSecondary, marginBottom: 10, lineHeight: 17 },
  ratingQ: { marginBottom: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.borderLight },
  ratingQLabel: { fontSize: 13, fontWeight: "600", color: THEME.text, lineHeight: 18, marginBottom: 4 },
  ratingQHint: { fontSize: 11, color: THEME.textMuted, marginBottom: 6 },
  ratingSaveBtn: {
    marginTop: 6,
    backgroundColor: THEME.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  ratingSaveTxt: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
  ratingLoginHint: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  ratingLoginHintTxt: { fontSize: 14, fontWeight: "700", color: THEME.accent },

  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.borderLight,
  },
  menuRowTitle: { fontSize: 15, fontWeight: "800", color: THEME.text },
  menuRowSub: { fontSize: 12, color: THEME.textSecondary, marginTop: 2, lineHeight: 16 },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.textSecondary,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  menuSectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.accentDark,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  layerToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.borderLight,
    backgroundColor: THEME.bgWhite,
  },

  feedTabBlock: { marginTop: 0 },
  feedSegmentTxt: { fontSize: 10, textAlign: "center", paddingHorizontal: 1 },
  subTabHint: { marginHorizontal: 12, marginTop: 8 },
  subTabHintTxt: { fontSize: 11, color: THEME.textMuted, fontStyle: "italic" },

  postCard: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 0,
    borderRadius: 16,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    overflow: "hidden",
    ...cardShadow,
  },
  postHeader: { flexDirection: "row", alignItems: "flex-start", padding: 12, paddingBottom: 8 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.accentSoft,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  avatarImg: { width: 42, height: 42, borderRadius: 21 },
  avatarTxt: { fontSize: 13, fontWeight: "900", color: THEME.accentDark },
  postName: { fontSize: 15, fontWeight: "800", color: THEME.text },
  badgeRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8, flexWrap: "wrap" },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: THEME.bg,
  },
  typeBadgeSys: { backgroundColor: "#f3e8ff" },
  typeBadgeText: { fontSize: 10, fontWeight: "800", color: THEME.accentDark, textTransform: "uppercase" },
  postTime: { fontSize: 11, color: THEME.textMuted },
  postBody: { paddingHorizontal: 12, fontSize: 15, lineHeight: 22, color: THEME.text, marginBottom: 8 },
  postMetaBlock: { paddingHorizontal: 12, marginTop: 4, marginBottom: 4 },
  postMetaLine: { fontSize: 13, lineHeight: 19, color: THEME.textSecondary, marginBottom: 2 },
  postMediaBlock: { marginBottom: 8 },
  postMediaHeroWrap: {
    width: POST_INNER_WIDTH,
    height: 220,
    position: "relative",
    overflow: "hidden",
  },
  imgScroll: { marginTop: 0, marginBottom: 0 },
  postImgPage: { width: POST_INNER_WIDTH },
  postImg: { width: POST_INNER_WIDTH, height: 220, borderRadius: 0, backgroundColor: THEME.bg },
  /** Görselin alt bandı üzerinde yarı saydam mavi (ilan dışı) */
  postDetailCtaOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(59, 130, 246, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    elevation: 3,
  },
  /** İlan sistem gönderileri — sarı şerit */
  postDetailCtaOverlayListing: {
    backgroundColor: "rgba(250, 204, 21, 0.58)",
  },
  postDetailCtaTxt: { fontSize: 14, fontWeight: "700", color: "rgba(248, 250, 252, 0.96)" },
  postDetailCtaTxtOnYellow: { color: "#1e293b" },
  postThumbStrip: { marginTop: 8, marginBottom: 0, maxHeight: 64 },
  postThumbStripContent: { paddingHorizontal: 12, gap: 8, alignItems: "center" },
  postThumbSmWrap: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: THEME.bg,
  },
  postThumbSmWrapOn: { borderColor: COLORS.accentBlue },
  postThumbSm: { width: "100%", height: "100%" },
  postActions: {
    flexDirection: "row",
    marginTop: 0,
    gap: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.borderLight,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionTxt: { fontSize: 14, fontWeight: "600", color: THEME.textSecondary },

  postEditWrap: { paddingHorizontal: 12, marginBottom: 8 },
  postEditInput: {
    minHeight: 100,
    maxHeight: 200,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    color: THEME.text,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  postEditThumbRow: { marginTop: 10, marginBottom: 4, maxHeight: 88 },
  postEditThumbWrap: { marginRight: 8, position: "relative" },
  postEditThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: THEME.bg },
  postEditThumbRm: { position: "absolute", top: -4, right: -4 },
  postEditAddBtn: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.accentSoft,
  },
  postEditActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 },
  postEditGhostBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.bgWhite,
  },
  postEditGhostBtnTxt: { fontSize: 14, fontWeight: "700", color: THEME.textSecondary },
  postEditSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: THEME.accent,
    minWidth: 100,
    alignItems: "center",
  },
  postEditSaveBtnTxt: { fontSize: 14, fontWeight: "800", color: "#ffffff" },
  postMenuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  postMenuSheet: {
    backgroundColor: THEME.bgWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.borderLight,
    zIndex: 2,
    elevation: 12,
  },
  postMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.borderLight,
  },
  postMenuItemTxt: { fontSize: 16, fontWeight: "600", color: THEME.text, flex: 1 },
  postMenuCancel: { alignItems: "center", paddingVertical: 14 },
  postMenuItemCancel: { fontSize: 15, fontWeight: "600", color: THEME.textSecondary },

  commentBox: {
    marginTop: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.borderLight,
    backgroundColor: "#fafafa",
  },
  commentLine: { fontSize: 13, color: THEME.textSecondary, marginBottom: 6 },
  commentInputRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: THEME.text,
    backgroundColor: THEME.bgWhite,
  },
  sendCmtBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  composerCard: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: THEME.bgWhite,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    ...cardShadow,
  },
  composerHeadRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  composerAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  composerCardTitle: { fontSize: 15, fontWeight: "800", color: THEME.text },
  composerCardSub: { fontSize: 12, color: THEME.textSecondary, marginTop: 4, lineHeight: 17 },
  composerLoginRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: THEME.accentSoft,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  composerLoginRowTxt: { color: THEME.accentDark, fontWeight: "700", fontSize: 14 },
  composerDisabledBox: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  composerDisabledTxt: { fontSize: 14, color: THEME.textMuted },
  composerMediaBlock: { marginBottom: 10 },
  composerHeroScroll: { marginBottom: 8 },
  composerHeroPage: { width: POST_INNER_WIDTH },
  composerHeroImg: {
    width: POST_INNER_WIDTH,
    height: 220,
    borderRadius: 12,
    backgroundColor: THEME.bg,
  },
  composerThumbStripRow: { marginBottom: 4, maxHeight: 88 },
  composerThumbStripContent: { gap: 8, alignItems: "center" },
  composerThumbWrap: { marginRight: 8, position: "relative", flexDirection: "row", alignItems: "flex-start" },
  composerThumbInner: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  composerThumbInnerOn: { borderColor: COLORS.accentBlue },
  composerThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: THEME.bg },
  composerThumbRemove: { position: "absolute", top: -6, right: -6 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  composerAddPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    color: THEME.text,
    fontSize: 15,
  },
  composerSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  composerHint: { fontSize: 10, color: THEME.textMuted, marginTop: 6, marginLeft: 4 },

  sectionTitle: {
    marginHorizontal: 16,
    marginTop: 20,
    fontSize: 16,
    fontWeight: "800",
    color: THEME.text,
  },
  expertCard: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    ...cardShadow,
  },
  expertRow: { flexDirection: "row", alignItems: "center" },
  expertAv: { width: 52, height: 52, borderRadius: 26, marginRight: 12, borderWidth: 1, borderColor: THEME.borderLight },
  expertName: { fontSize: 16, fontWeight: "800", color: THEME.text },
  expertCo: { fontSize: 13, color: THEME.textSecondary, marginTop: 2 },
  expertMeta: { fontSize: 12, color: THEME.textSecondary, marginTop: 4 },

  emptyTxt: { textAlign: "center", color: THEME.textSecondary, marginTop: 32, paddingHorizontal: 24, fontSize: 14 },
});
