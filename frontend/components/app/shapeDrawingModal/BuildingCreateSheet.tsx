import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";
import Slider from "@react-native-community/slider";
import { BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { TextInput as GHTextInput } from "react-native-gesture-handler";
import Ionicons from "react-native-vector-icons/Ionicons";
import type {
  BuildingGuideLimits,
  BuildingSettings,
  BuildingPositionPick,
} from "@/src/maps/building/computeBuildingFootprint";
import { BUILDING_TEMPLATE_OPTIONS } from "@/src/maps/building/buildingFrameTemplates";
import { ROOF_TEMPLATE_OPTIONS } from "@/src/maps/building/roofTemplates";

/** iOS’ta decimal/number-pad’de Return yok; Tamam/İleri ile sonraki alana geçiş için noktalı klavye. */
const KH_DECIMAL: NonNullable<TextInputProps["keyboardType"]> = Platform.select({
  ios: "numbers-and-punctuation",
  default: "decimal-pad",
})!;
const KH_INT_ROWS: NonNullable<TextInputProps["keyboardType"]> = Platform.select({
  ios: "numbers-and-punctuation",
  default: "number-pad",
})!;

const WINDOW_GLASS_HEX = ["#94a3b8", "#64748b", "#475569", "#334155", "#0ea5e9", "#38bdf8", "#1e293b"];
const WINDOW_BORDER_HEX = ["#f8fafc", "#e2e8f0", "#94a3b8", "#475569", "#1e293b", "#0f172a", "#000000"];

const POSITION_OPTIONS: Array<{ value: BuildingPositionPick; label: string }> = [
  { value: "merkez", label: "Merkez" },
  { value: "sol", label: "Sol" },
  { value: "sol-ust", label: "Sol-Üst" },
  { value: "ust", label: "Üst" },
  { value: "ust-sag", label: "Üst-Sağ" },
  { value: "sag", label: "Sağ" },
  { value: "sag-alt", label: "Sağ-Alt" },
  { value: "alt", label: "Alt" },
  { value: "alt-sol", label: "Alt-Sol" },
];

export type BuildingCreateFormBodyProps = {
  /** Oluştur sekmesi görünürken true (klavye / yerel metin senkronu) */
  active: boolean;
  insetsBottom: number;
  settings: BuildingSettings;
  onChangeSettings: (patch: Partial<BuildingSettings>) => void;
  onCreateBuilding: () => void;
  onClearBuildings: () => void;
  buildingMapVisible: boolean;
  onToggleBuildingMapVisible: () => void;
  edgeLoading: boolean;
  edgeReady: boolean;
  onRefreshEdgeData: () => void;
  guideLimits: BuildingGuideLimits | null;
};

function numOr(s: string, fallback: number): number {
  const t = s.trim().replace(",", ".");
  if (t === "") return fallback;
  const n = Number(t);
  return Number.isFinite(n) ? n : fallback;
}

function fmtM(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n >= 100 ? n.toFixed(1) : n.toFixed(2);
}

export const BuildingCreateFormBody: React.FC<BuildingCreateFormBodyProps> = ({
  active,
  insetsBottom,
  settings,
  onChangeSettings,
  onCreateBuilding,
  onClearBuildings,
  buildingMapVisible,
  onToggleBuildingMapVisible,
  edgeLoading,
  edgeReady,
  onRefreshEdgeData,
  guideLimits,
}) => {
  const [posMenuOpen, setPosMenuOpen] = useState(false);
  /** Taban m²: boş silince numOr(..., 100) ile 100'e zorlanmayı önlemek için yerel metin */
  const [tabanM2Text, setTabanM2Text] = useState(String(settings.tabanM2));
  /** Kat sayısı: boşken numOr(...,1) ile sürekli 1'e dönmesini önlemek için yerel metin */
  const [katSayisiText, setKatSayisiText] = useState(String(settings.katSayisi));
  /** Genel | Pencere alt sekmesi */
  const [formSub, setFormSub] = useState<"general" | "windows">("general");
  const prevVisibleRef = useRef(false);

  const refSag = useRef<GHTextInput | undefined>(undefined);
  const refSol = useRef<GHTextInput | undefined>(undefined);
  const refUst = useRef<GHTextInput | undefined>(undefined);
  const refAlt = useRef<GHTextInput | undefined>(undefined);
  const refTaban = useRef<GHTextInput | undefined>(undefined);
  const refKatSayisi = useRef<GHTextInput | undefined>(undefined);
  const refOpacity = useRef<GHTextInput | undefined>(undefined);
  const refGenislik = useRef<GHTextInput | undefined>(undefined);
  const refUzunluk = useRef<GHTextInput | undefined>(undefined);
  const refKatYuk = useRef<GHTextInput | undefined>(undefined);
  const refCitYuk = useRef<GHTextInput | undefined>(undefined);

  useEffect(() => {
    if (!active) setPosMenuOpen(false);
  }, [active]);

  useEffect(() => {
    if (!active) setFormSub("general");
  }, [active]);

  useEffect(() => {
    const justOpened = active && !prevVisibleRef.current;
    prevVisibleRef.current = active;
    if (justOpened) {
      setTabanM2Text(String(settings.tabanM2));
      setKatSayisiText(String(settings.katSayisi));
    }
  }, [active, settings.tabanM2, settings.katSayisi]);

  const positionLabel = useMemo(() => {
    return POSITION_OPTIONS.find((p) => p.value === settings.positionPick)?.label ?? "Merkez";
  }, [settings.positionPick]);

  /** Genişlik (u): kılavuz + taban/uzunluk ile üst sınır */
  const maxGenislikM = useMemo(() => {
    if (!guideLimits) return null;
    const tab = Math.max(0.1, settings.tabanM2);
    let cap = guideLimits.availW;
    if (settings.uzunluk != null && settings.uzunluk > 0) {
      cap = Math.min(cap, tab / settings.uzunluk);
    }
    return cap;
  }, [guideLimits, settings.tabanM2, settings.uzunluk]);

  /** Uzunluk (v): kılavuz + taban/genişlik ile üst sınır */
  const maxUzunlukM = useMemo(() => {
    if (!guideLimits) return null;
    const tab = Math.max(0.1, settings.tabanM2);
    let cap = guideLimits.availH;
    if (settings.genislik != null && settings.genislik > 0) {
      cap = Math.min(cap, tab / settings.genislik);
    }
    return cap;
  }, [guideLimits, settings.tabanM2, settings.genislik]);

  const clampGenislik = (raw: number): number => {
    let v = Math.max(0.1, raw);
    if (!guideLimits) return v;
    v = Math.min(v, guideLimits.availW);
    const tab = Math.max(0.1, settings.tabanM2);
    if (settings.uzunluk != null && settings.uzunluk > 0) {
      v = Math.min(v, tab / settings.uzunluk);
    }
    return v;
  };

  const clampUzunluk = (raw: number): number => {
    let v = Math.max(0.1, raw);
    if (!guideLimits) return v;
    v = Math.min(v, guideLimits.availH);
    const tab = Math.max(0.1, settings.tabanM2);
    if (settings.genislik != null && settings.genislik > 0) {
      v = Math.min(v, tab / settings.genislik);
    }
    return v;
  };

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
        {edgeLoading ? (
          <View style={sheetStyles.loadingBox}>
            <ActivityIndicator color="#93c5fd" />
            <Text style={sheetStyles.muted}>Kenar ölçüleri hesaplanıyor…</Text>
          </View>
        ) : !edgeReady ? (
          <View style={sheetStyles.loadingBox}>
            <Text style={sheetStyles.warnText}>Parsel için kenar ölçü verisi yok.</Text>
            <TouchableOpacity style={sheetStyles.secondaryBtn} onPress={onRefreshEdgeData}>
              <Text style={sheetStyles.secondaryBtnText}>Yeniden dene</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={sheetStyles.formSubTabRow}>
          <TouchableOpacity
            style={[sheetStyles.formSubTabBtn, formSub === "general" && sheetStyles.formSubTabBtnActive]}
            onPress={() => setFormSub("general")}
          >
            <Text style={[sheetStyles.formSubTabText, formSub === "general" && sheetStyles.formSubTabTextActive]}>Genel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[sheetStyles.formSubTabBtn, formSub === "windows" && sheetStyles.formSubTabBtnActive]}
            onPress={() => setFormSub("windows")}
          >
            <Text style={[sheetStyles.formSubTabText, formSub === "windows" && sheetStyles.formSubTabTextActive]}>Pencere</Text>
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          style={sheetStyles.scroll}
          contentContainerStyle={[
            sheetStyles.scrollContent,
            { paddingBottom: 24 + Math.max(0, insetsBottom) },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {formSub === "windows" ? (
            <View style={{ paddingTop: 4 }}>
              <Text style={sheetStyles.sectionLabel}>Cam çerçeve şablonu</Text>
              <Text style={sheetStyles.muted}>Bina oluşturmadan önce veya sonra değiştirilebilir.</Text>
              <View style={{ marginTop: 10, gap: 8 }}>
                {BUILDING_TEMPLATE_OPTIONS.map((opt) => {
                  const sel = settings.frameTemplate === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => onChangeSettings({ frameTemplate: opt.value })}
                      style={[sheetStyles.templateChip, sel && sheetStyles.templateChipActive]}
                    >
                      <Text style={[sheetStyles.templateChipText, sel && sheetStyles.templateChipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[sheetStyles.sectionLabel, { marginTop: 16 }]}>Cam rengi</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {WINDOW_GLASS_HEX.map((hex) => {
                  const cur = settings.windowGlassColor ?? "#475569";
                  const sel = cur.toLowerCase() === hex.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={`g-${hex}`}
                      onPress={() => onChangeSettings({ windowGlassColor: hex })}
                      style={[sheetStyles.winColorDot, { backgroundColor: hex }, sel && sheetStyles.winColorDotActive]}
                      accessibilityLabel={`Cam ${hex}`}
                    />
                  );
                })}
              </View>

              <Text style={[sheetStyles.sectionLabel, { marginTop: 14 }]}>Kenarlık rengi</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {WINDOW_BORDER_HEX.map((hex) => {
                  const cur = settings.windowBorderColor ?? "#0f172a";
                  const sel = cur.toLowerCase() === hex.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={`b-${hex}`}
                      onPress={() => onChangeSettings({ windowBorderColor: hex })}
                      style={[sheetStyles.winColorDot, { backgroundColor: hex }, sel && sheetStyles.winColorDotActive]}
                      accessibilityLabel={`Kenarlık ${hex}`}
                    />
                  );
                })}
              </View>

              <Text style={[sheetStyles.sectionLabel, { marginTop: 14 }]}>Kenarlık kalınlığı</Text>
              <Slider
                style={{ width: "100%", height: 36 }}
                minimumValue={0}
                maximumValue={0.22}
                step={0.01}
                value={settings.windowBorderThicknessM ?? 0.08}
                onValueChange={(v) => onChangeSettings({ windowBorderThicknessM: v })}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#475569"
                thumbTintColor="#93c5fd"
              />
              <Text style={sheetStyles.muted}>
                {(settings.windowBorderThicknessM ?? 0.08).toFixed(2)} m · 0 = sadece cam (çerçeve yok)
              </Text>

              <View style={sheetStyles.switchRow}>
                <Text style={sheetStyles.switchLabel}>Orta çıta (+ şeklinde)</Text>
                <Switch
                  value={!!settings.windowCrossMullion}
                  onValueChange={(v) => onChangeSettings({ windowCrossMullion: v })}
                  trackColor={{ false: "#475569", true: "#2563eb" }}
                  thumbColor="#f1f5f9"
                />
              </View>
            </View>
          ) : (
            <>
          <Text style={sheetStyles.sectionLabel}>Kenar çekme (m)</Text>
          <View style={sheetStyles.row2}>
            <Field
              label="Sağ"
              value={String(settings.sag)}
              onChangeText={(t) => onChangeSettings({ sag: numOr(t, 0) })}
              inputRef={refSag}
              keyboardType={KH_DECIMAL}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refSol.current?.focus()}
            />
            <Field
              label="Sol"
              value={String(settings.sol)}
              onChangeText={(t) => onChangeSettings({ sol: numOr(t, 0) })}
              inputRef={refSol}
              keyboardType={KH_DECIMAL}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refUst.current?.focus()}
            />
          </View>
          <View style={sheetStyles.row2}>
            <Field
              label="Üst"
              value={String(settings.ust)}
              onChangeText={(t) => onChangeSettings({ ust: numOr(t, 0) })}
              inputRef={refUst}
              keyboardType={KH_DECIMAL}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refAlt.current?.focus()}
            />
            <Field
              label="Alt"
              value={String(settings.alt)}
              onChangeText={(t) => onChangeSettings({ alt: numOr(t, 0) })}
              inputRef={refAlt}
              keyboardType={KH_DECIMAL}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refTaban.current?.focus()}
            />
          </View>

          {guideLimits && edgeReady ? (
            <Text style={sheetStyles.guideHint}>
              Kılavuz (çekme sonrası): kısa kenar ≤ {fmtM(guideLimits.shortSideM)} m · uzun kenar ≤{" "}
              {fmtM(guideLimits.longSideM)} m · en fazla taban alanı ≤ {fmtM(guideLimits.maxRectAreaM2)} m²
            </Text>
          ) : null}

          <Field
            label="Taban m²"
            value={tabanM2Text}
            inputRef={refTaban}
            keyboardType={KH_DECIMAL}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => refKatSayisi.current?.focus()}
            onChangeText={(t) => {
              setTabanM2Text(t);
              const tr = t.trim().replace(",", ".");
              if (tr === "" || tr === "." || tr === "-") {
                return;
              }
              const n = Number(tr);
              if (Number.isFinite(n) && n > 0) {
                let nn = Math.max(0.1, n);
                if (guideLimits) nn = Math.min(nn, guideLimits.maxRectAreaM2);
                const patch: Partial<BuildingSettings> = { tabanM2: nn };
                if (
                  guideLimits &&
                  settings.genislik != null &&
                  settings.uzunluk != null &&
                  settings.genislik > 0 &&
                  settings.uzunluk > 0 &&
                  settings.genislik * settings.uzunluk > nn + 1e-6
                ) {
                  patch.uzunluk = Math.max(
                    0.1,
                    Math.min(settings.uzunluk, nn / settings.genislik, guideLimits.availH)
                  );
                }
                onChangeSettings(patch);
              }
            }}
            onBlur={() => {
              const tr = tabanM2Text.trim().replace(",", ".");
              if (tr === "" || !Number.isFinite(Number(tr)) || Number(tr) <= 0) {
                const v = Math.max(0.1, settings.tabanM2 > 0 ? settings.tabanM2 : 100);
                setTabanM2Text(String(v));
                onChangeSettings({ tabanM2: v });
              } else {
                let n = Math.max(0.1, Number(tr));
                if (guideLimits) {
                  n = Math.min(n, guideLimits.maxRectAreaM2);
                }
                setTabanM2Text(String(n));
                const patch: Partial<BuildingSettings> = { tabanM2: n };
                if (
                  guideLimits &&
                  settings.genislik != null &&
                  settings.uzunluk != null &&
                  settings.genislik > 0 &&
                  settings.uzunluk > 0 &&
                  settings.genislik * settings.uzunluk > n + 1e-6
                ) {
                  const u = Math.min(settings.uzunluk, n / settings.genislik, guideLimits.availH);
                  patch.uzunluk = Math.max(0.1, u);
                }
                onChangeSettings(patch);
              }
            }}
          />
          <View style={sheetStyles.row2}>
            <Field
              label="Kat sayısı"
              keyboardType={KH_INT_ROWS}
              value={katSayisiText}
              inputRef={refKatSayisi}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refOpacity.current?.focus()}
              onChangeText={(t) => {
                const cleaned = t.replace(/[^\d]/g, "");
                setKatSayisiText(cleaned);
                if (cleaned === "") return;
                const n = parseInt(cleaned, 10);
                if (Number.isFinite(n) && n >= 1 && String(n) === cleaned) {
                  onChangeSettings({ katSayisi: n });
                }
              }}
              onBlur={() => {
                const tr = katSayisiText.trim();
                if (tr === "") {
                  const v = Math.max(1, settings.katSayisi);
                  setKatSayisiText(String(v));
                  onChangeSettings({ katSayisi: v });
                  return;
                }
                const n = Math.max(1, parseInt(tr, 10) || 1);
                setKatSayisiText(String(n));
                onChangeSettings({ katSayisi: n });
              }}
            />
            <Field
              label="Opaklık (0–100)"
              value={String(settings.opacity)}
              inputRef={refOpacity}
              keyboardType={KH_DECIMAL}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refGenislik.current?.focus()}
              onChangeText={(t) =>
                onChangeSettings({ opacity: Math.max(0, Math.min(100, numOr(t, 100))) })
              }
            />
          </View>

          <View style={sheetStyles.row2}>
            <Field
              label="Genişlik (m, boş=oto)"
              hint={
                maxGenislikM != null
                  ? `En fazla ${fmtM(maxGenislikM)} m`
                  : undefined
              }
              value={settings.genislik == null ? "" : String(settings.genislik)}
              inputRef={refGenislik}
              keyboardType={KH_DECIMAL}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refUzunluk.current?.focus()}
              onChangeText={(t) => {
                const tr = t.trim();
                if (tr === "") {
                  onChangeSettings({ genislik: null });
                  return;
                }
                const v = clampGenislik(numOr(tr, 0.1));
                onChangeSettings({ genislik: v });
              }}
            />
            <Field
              label="Uzunluk (m, boş=oto)"
              hint={
                maxUzunlukM != null
                  ? `En fazla ${fmtM(maxUzunlukM)} m`
                  : undefined
              }
              value={settings.uzunluk == null ? "" : String(settings.uzunluk)}
              inputRef={refUzunluk}
              keyboardType={KH_DECIMAL}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refKatYuk.current?.focus()}
              onChangeText={(t) => {
                const tr = t.trim();
                if (tr === "") {
                  onChangeSettings({ uzunluk: null });
                  return;
                }
                const v = clampUzunluk(numOr(tr, 0.1));
                onChangeSettings({ uzunluk: v });
              }}
            />
          </View>
          {guideLimits && edgeReady ? (
            <Text style={sheetStyles.guideHint}>
              İki kenar da doluysa genişlik × uzunluk, taban m² değerini aşamaz (ör. 100 m² taban için 10×20 kabul
              edilmez).
            </Text>
          ) : null}

          <Text style={sheetStyles.sectionLabel}>Konum</Text>
          <TouchableOpacity
            style={sheetStyles.selectBtn}
            onPress={() => setPosMenuOpen((o) => !o)}
          >
            <Text style={sheetStyles.selectBtnText}>{positionLabel}</Text>
            <Ionicons name={posMenuOpen ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" />
          </TouchableOpacity>
          {posMenuOpen && (
            <View style={sheetStyles.posList}>
              {POSITION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    sheetStyles.posItem,
                    settings.positionPick === opt.value && sheetStyles.posItemActive,
                  ]}
                  onPress={() => {
                    onChangeSettings({ positionPick: opt.value });
                    setPosMenuOpen(false);
                  }}
                >
                  <Text
                    style={[
                      sheetStyles.posItemText,
                      settings.positionPick === opt.value && sheetStyles.posItemTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={sheetStyles.row2}>
            <Field
              label="Kat yüksekliği (m)"
              value={String(settings.katYuksekligi)}
              inputRef={refKatYuk}
              keyboardType={KH_DECIMAL}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refCitYuk.current?.focus()}
              onChangeText={(t) => onChangeSettings({ katYuksekligi: Math.max(2, numOr(t, 3.2)) })}
            />
            <Field
              label="Çit yüksekliği (m)"
              value={String(settings.citYuksekligi)}
              inputRef={refCitYuk}
              keyboardType={KH_DECIMAL}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
              onChangeText={(t) => onChangeSettings({ citYuksekligi: Math.max(0, numOr(t, 0)) })}
            />
          </View>

          <TouchableOpacity style={sheetStyles.toggleRow} onPress={onToggleBuildingMapVisible}>
            <Text style={sheetStyles.toggleLabel}>Binayı haritada göster</Text>
            <Ionicons
              name={buildingMapVisible ? "checkbox" : "square-outline"}
              size={22}
              color={buildingMapVisible ? "#60a5fa" : "#64748b"}
            />
          </TouchableOpacity>

          <View style={sheetStyles.actions}>
            <TouchableOpacity
              style={[sheetStyles.primaryBtn, (!edgeReady || edgeLoading) && sheetStyles.btnDisabled]}
              onPress={onCreateBuilding}
              disabled={!edgeReady || edgeLoading}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={sheetStyles.primaryBtnText}>Bina Oluştur</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sheetStyles.dangerBtn} onPress={onClearBuildings}>
              <Ionicons name="trash-outline" size={18} color="#fecaca" />
              <Text style={sheetStyles.dangerBtnText}>Tümünü Temizle</Text>
            </TouchableOpacity>
          </View>
            </>
          )}
        </BottomSheetScrollView>
    </View>
  );
};

function Field({
  label,
  hint,
  value,
  onChangeText,
  onBlur,
  placeholder,
  keyboardType = "decimal-pad",
  inputRef,
  returnKeyType,
  blurOnSubmit,
  onSubmitEditing,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (t: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  keyboardType?: TextInputProps["keyboardType"];
  inputRef?: React.Ref<GHTextInput | undefined>;
  returnKeyType?: TextInputProps["returnKeyType"];
  blurOnSubmit?: boolean;
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={sheetStyles.field}>
      <Text style={sheetStyles.fieldLabel}>{label}</Text>
      {hint ? <Text style={sheetStyles.fieldHint}>{hint}</Text> : null}
      <BottomSheetTextInput
        ref={inputRef}
        style={sheetStyles.input}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        returnKeyType={returnKeyType}
        blurOnSubmit={blurOnSubmit}
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#f1f5f9" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingBox: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
  },
  muted: { color: "#94a3b8", fontSize: 13 },
  warnText: { color: "#fca5a5", fontSize: 14, textAlign: "center" },
  secondaryBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#334155",
    borderRadius: 8,
  },
  secondaryBtnText: { color: "#e2e8f0", fontWeight: "600" },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 10 },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#94a3b8", marginTop: 4 },
  row2: { flexDirection: "row", gap: 10 },
  field: { flex: 1, marginBottom: 4 },
  fieldLabel: { fontSize: 12, color: "#94a3b8", marginBottom: 4 },
  fieldHint: { fontSize: 11, color: "#64748b", marginBottom: 4 },
  guideHint: { fontSize: 12, color: "#94a3b8", lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f1f5f9",
    backgroundColor: "#1e293b",
    fontSize: 15,
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#1e293b",
  },
  selectBtnText: { color: "#e2e8f0", fontSize: 15 },
  posList: {
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 4,
  },
  posItem: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#1e293b" },
  posItemActive: { backgroundColor: "#334155" },
  posItemText: { color: "#cbd5e1", fontSize: 14 },
  posItemTextActive: { color: "#93c5fd", fontWeight: "600" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  toggleLabel: { color: "#e2e8f0", fontSize: 15 },
  actions: { gap: 10, marginTop: 8 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  btnDisabled: { opacity: 0.45 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#450a0a",
  },
  dangerBtnText: { color: "#fecaca", fontWeight: "600" },
  formSubTabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 2,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  formSubTabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  formSubTabBtnActive: { backgroundColor: "#334155" },
  formSubTabText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  formSubTabTextActive: { color: "#e2e8f0" },
  templateChip: {
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#1e293b",
  },
  templateChipActive: { borderColor: "#60a5fa", backgroundColor: "#1e3a5f" },
  templateChipText: { color: "#cbd5e1", fontSize: 14 },
  templateChipTextActive: { color: "#93c5fd", fontWeight: "600" },
  winColorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  winColorDotActive: { borderColor: "#fff" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingVertical: 4,
  },
  switchLabel: { color: "#e2e8f0", fontSize: 14, flex: 1, paddingRight: 12 },
});
