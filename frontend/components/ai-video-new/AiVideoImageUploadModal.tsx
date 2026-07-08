/**
 * AI Video — proje başlangıcı ve yeni sahne için resim yükleme modalı.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { launchImageLibrary } from "react-native-image-picker";

import { KeywordPillInput } from "./KeywordPillInput";
import { KeyboardAwareScrollScreen } from "../app/KeyboardAwareScrollScreen";
import { AI_DRONE_EDITOR_THEME } from "../../src/constants/aiDroneEditorTheme";
import { useScrollInputIntoView } from "../../src/keyboard";
import { DRONE_SCENE_INITIAL_COUNT, DRONE_SCENE_MAX_CAPTURE_PER_PURCHASE } from "../../services/droneSceneService";
import type { MobileUploadImage } from "../../services/imageAnimationService";

export type AiVideoUploadMode = "initial" | "new_scene";

export type AiVideoImageUploadContinuePayload = {
  images: MobileUploadImage[];
  projectTitle?: string;
  promptText?: string;
  highlightTexts?: string[];
  useOpenAiPreflight?: boolean;
};

type Props = {
  visible: boolean;
  mode: AiVideoUploadMode;
  onClose: () => void;
  onContinue: (payload: AiVideoImageUploadContinuePayload) => void;
  defaultProjectTitle?: string;
  /** new_scene: min(hak, strip boş slot, 2) */
  sessionMaxFrames?: number;
  onNeedPurchase?: () => void;
};

type SlotImage = MobileUploadImage & { id: string };

type UploadStep = "images" | "keywords";

const MODAL_HEADER_HEIGHT = 52;
const FOOTER_HEIGHT = 72;

function nextId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toUploadImage(asset: {
  uri?: string;
  fileName?: string;
  type?: string;
}): MobileUploadImage | null {
  const uri = String(asset.uri || "").trim();
  if (!uri) return null;
  return {
    uri,
    name: asset.fileName || `ai_video_${Date.now()}.jpg`,
    type: asset.type || "image/jpeg",
  };
}

export function AiVideoImageUploadModal({
  visible,
  mode,
  onClose,
  onContinue,
  defaultProjectTitle = "",
  sessionMaxFrames,
  onNeedPurchase,
}: Props) {
  const insets = useSafeAreaInsets();
  const requiredCount = mode === "initial" ? DRONE_SCENE_INITIAL_COUNT : 1;
  const maxCount =
    mode === "initial"
      ? DRONE_SCENE_INITIAL_COUNT
      : Math.max(1, sessionMaxFrames ?? DRONE_SCENE_MAX_CAPTURE_PER_PURCHASE);

  const [step, setStep] = useState<UploadStep>("images");
  const [projectTitle, setProjectTitle] = useState(defaultProjectTitle);
  const [images, setImages] = useState<SlotImage[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const titleInputWrapRef = useRef<View>(null);
  const keywordsInputWrapRef = useRef<View>(null);

  const { handleFocus: scrollTitleIntoView, handleBlur: scrollTitleBlur } = useScrollInputIntoView({
    scrollRef,
    inputWrapRef: titleInputWrapRef,
  });
  const { handleFocus: scrollKeywordsIntoView, handleBlur: scrollKeywordsBlur } = useScrollInputIntoView({
    scrollRef,
    inputWrapRef: keywordsInputWrapRef,
    keyboardOverlapMargin: 48,
  });

  const titleLabel =
    mode === "initial" && step === "keywords"
      ? "Referans kelimeler"
      : mode === "initial"
        ? "AI Video projesi"
        : "Yeni sahne görseli";

  const canContinueImages = useMemo(() => {
    if (mode === "initial" && !String(projectTitle || "").trim()) return false;
    return images.length >= requiredCount;
  }, [mode, projectTitle, images.length, requiredCount]);

  const canContinueKeywords = keywords.length >= 1;

  const reset = useCallback(() => {
    setStep("images");
    setProjectTitle(defaultProjectTitle);
    setImages([]);
    setKeywords([]);
    setBusy(false);
  }, [defaultProjectTitle]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleHeaderBack = useCallback(() => {
    if (mode === "initial" && step === "keywords") {
      setStep("images");
      return;
    }
    handleClose();
  }, [mode, step, handleClose]);

  const pickImages = useCallback(async () => {
    const remaining = maxCount - images.length;
    if (remaining <= 0) {
      if (mode === "new_scene" && onNeedPurchase) {
        onNeedPurchase();
        return;
      }
      Alert.alert("Görsel", `En fazla ${maxCount} görsel seçebilirsiniz.`);
      return;
    }
    setBusy(true);
    try {
      const result = await launchImageLibrary({
        mediaType: "photo",
        selectionLimit: remaining,
        quality: 0.92,
      });
      if (result.didCancel) return;
      const assets = result.assets || [];
      const next: SlotImage[] = [];
      for (const asset of assets) {
        const img = toUploadImage(asset);
        if (img) next.push({ ...img, id: nextId() });
      }
      if (next.length) {
        setImages((prev) => [...prev, ...next].slice(0, maxCount));
      }
    } finally {
      setBusy(false);
    }
  }, [images.length, maxCount, mode, onNeedPurchase]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const finishContinue = useCallback(() => {
    const title = String(projectTitle || "").trim();
    onContinue({
      images: images.map(({ uri, name, type }) => ({ uri, name, type })),
      projectTitle: mode === "initial" ? title : undefined,
      highlightTexts: mode === "initial" ? keywords : undefined,
    });
    reset();
  }, [mode, projectTitle, images, keywords, onContinue, reset]);

  const handleContinue = useCallback(() => {
    const title = String(projectTitle || "").trim();
    if (mode === "initial" && !title) {
      Alert.alert("Proje", "Proje adı girin.");
      return;
    }
    if (images.length < requiredCount) {
      Alert.alert(
        "Görsel",
        mode === "initial"
          ? `${DRONE_SCENE_INITIAL_COUNT} referans görseli seçin.`
          : "En az bir görsel seçin.",
      );
      return;
    }
    if (mode === "initial") {
      setStep("keywords");
      return;
    }
    finishContinue();
  }, [mode, projectTitle, images, requiredCount, finishContinue]);

  const handleKeywordsContinue = useCallback(() => {
    if (keywords.length < 1) {
      Alert.alert("Referans kelime", "Video metni için en az bir kelime girin.");
      return;
    }
    finishContinue();
  }, [keywords.length, finishContinue]);

  const footerContinueDisabled =
    step === "keywords" ? !canContinueKeywords : !canContinueImages;
  const footerContinueAction = step === "keywords" ? handleKeywordsContinue : handleContinue;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleHeaderBack}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleHeaderBack} accessibilityLabel={step === "keywords" ? "Geri" : "Kapat"}>
            <Ionicons
              name={mode === "initial" && step === "keywords" ? "arrow-back" : "close"}
              size={24}
              color={AI_DRONE_EDITOR_THEME.textOnDark}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{titleLabel}</Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAwareScrollScreen
          ref={scrollRef}
          behaviorContext="modal"
          headerHeight={MODAL_HEADER_HEIGHT}
          backgroundColor={AI_DRONE_EDITOR_THEME.shell}
          style={styles.scrollFlex}
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + FOOTER_HEIGHT + 16 },
          ]}
        >
          {step === "images" ? (
            <>
              {mode === "initial" ? (
                <View style={styles.fieldBlock} ref={titleInputWrapRef} collapsable={false}>
                  <Text style={styles.fieldLabel}>Proje adı</Text>
                  <TextInput
                    style={styles.input}
                    value={projectTitle}
                    onChangeText={setProjectTitle}
                    placeholder="Örn. Villa tanıtım videosu"
                    placeholderTextColor={AI_DRONE_EDITOR_THEME.mutedOnDark}
                    maxLength={120}
                    onFocus={scrollTitleIntoView}
                    onBlur={scrollTitleBlur}
                  />
                </View>
              ) : null}

              <Text style={styles.hint}>
                {mode === "initial"
                  ? `${DRONE_SCENE_INITIAL_COUNT} referans görseli yükleyin. Videonuz bu görsellerden üretilir.`
                  : "Sahne için en az bir görsel yükleyin."}
              </Text>

              <TouchableOpacity
                style={[styles.pickBtn, busy && styles.pickBtnDisabled]}
                onPress={() => void pickImages()}
                disabled={busy || images.length >= maxCount}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="images-outline" size={20} color="#fff" />
                    <Text style={styles.pickBtnText}>
                      Galeriden seç ({images.length}/{maxCount})
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.grid}>
                {images.map((img) => (
                  <View key={img.id} style={styles.thumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeImage(img.id)}
                      accessibilityLabel="Görseli kaldır"
                    >
                      <Ionicons name="close-circle" size={22} color="#f87171" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.hint}>
                Emlak ilanını tanımlayan kelimeleri girin. AI bu kelimelerden seslendirme metnini oluşturur.
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbRow}
              >
                {images.map((img) => (
                  <Image key={img.id} source={{ uri: img.uri }} style={styles.thumbMini} resizeMode="cover" />
                ))}
              </ScrollView>

              <View ref={keywordsInputWrapRef} collapsable={false}>
                <KeywordPillInput
                  keywords={keywords}
                  onChange={setKeywords}
                  placeholder="deniz manzarası, 3+1, merkezi konum"
                  onFocus={scrollKeywordsIntoView}
                  onBlur={scrollKeywordsBlur}
                />
              </View>
            </>
          )}
        </KeyboardAwareScrollScreen>

        <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.continueBtn, footerContinueDisabled && styles.continueBtnDisabled]}
            onPress={footerContinueAction}
            disabled={footerContinueDisabled}
          >
            <Text style={styles.continueText}>Devam</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AI_DRONE_EDITOR_THEME.shell },
  scrollFlex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.2)",
  },
  headerTitle: {
    color: AI_DRONE_EDITOR_THEME.textOnDark,
    fontSize: 16,
    fontWeight: "800",
  },
  body: { padding: 16, gap: 14 },
  fieldBlock: { gap: 6 },
  fieldLabel: {
    color: AI_DRONE_EDITOR_THEME.mutedOnDark,
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: AI_DRONE_EDITOR_THEME.textOnDark,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    fontSize: 15,
  },
  hint: {
    color: AI_DRONE_EDITOR_THEME.mutedOnDark,
    fontSize: 13,
    lineHeight: 20,
  },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: AI_DRONE_EDITOR_THEME.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  pickBtnDisabled: { opacity: 0.6 },
  pickBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  thumbWrap: {
    width: "30%",
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  thumb: { width: "100%", height: "100%" },
  thumbRow: { gap: 8, paddingVertical: 4 },
  thumbMini: {
    width: 88,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(2, 6, 23, 0.65)",
    borderRadius: 12,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.2)",
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  cancelText: { color: AI_DRONE_EDITOR_THEME.textOnDark, fontWeight: "700" },
  continueBtn: {
    flex: 1.4,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: AI_DRONE_EDITOR_THEME.primaryBright,
  },
  continueBtnDisabled: { opacity: 0.45 },
  continueText: { color: "#0f172a", fontWeight: "800", fontSize: 15 },
});
