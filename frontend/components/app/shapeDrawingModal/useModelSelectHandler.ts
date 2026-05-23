import { useCallback } from "react";
import { Alert, Platform } from "react-native";
import type { ModelCatalogFlatItem } from "@/src/maps/models/modelCatalog";
import { isModelUsable } from "@/src/services/modelUsageService";
import { ensureModelAvailable } from "@/src/services/modelDelivery";
import { isFreeRole } from "@/src/maps/models/modelAvailability";

type Args = {
  placingModelId: string | null;
  setPlacingModelId: (modelId: string | null) => void;

  setModelsDropdownOpen: (open: boolean) => void;
  setShapeDrawingMode: (mode: any) => void;
  setMeasurementMode: (mode: any) => void;
  setParcelSelectMode: (v: boolean) => void;

  setIsModelLoading: (v: boolean) => void;
  setModelLoadingText: (t: string) => void;
  setModelLoadingProgress: (p: number | null) => void;

  formatModelDisplayName: (modelId: string) => string;
  
  getRemainingUses?: (modelId: number) => number | null;
};

export function useModelSelectHandler(args: Args) {
  const {
    placingModelId,
    setPlacingModelId,
    setModelsDropdownOpen,
    setShapeDrawingMode,
    setMeasurementMode,
    setParcelSelectMode,
    setIsModelLoading,
    setModelLoadingText,
    setModelLoadingProgress,
    formatModelDisplayName,
    getRemainingUses,
  } = args;

  return useCallback(
    async (m: ModelCatalogFlatItem) => {
      const isActive = placingModelId === m.modelId;
      const label = (m.name && m.name.trim()) ? m.name : formatModelDisplayName(m.filename);
      try {
        if (isActive) {
          setPlacingModelId(null);
          setModelsDropdownOpen(false);
          return;
        }

        // Availability gate (purchase/ownership). Free and admin are already marked available by backend.
        // Dropdown list can show locked models; prevent selecting them here.
        if (m.isAvailable === false) {
          Alert.alert(
            "Model Kilitli",
            `"${label}" modeli şu an kilitli. Satın almak için Model Galerisi'nden modeli seçip satın alma ekranını açın.`
          );
          return;
        }

        // Check usage count before allowing selection
        if (!isFreeRole(m.role) && m.id !== undefined && getRemainingUses) {
          const remainingUses = getRemainingUses(m.id);
          if (!isModelUsable(remainingUses)) {
            Alert.alert(
              "Kullanım Hakkı Tükenmiş",
              `"${label}" modeli için kullanım hakkınız tükenmiş. Lütfen başka bir model seçin veya modeli yeniden satın alın.`
            );
            return;
          }
        } else if (!isFreeRole(m.role) && m.remainingUses !== undefined && !isModelUsable(m.remainingUses)) {
          Alert.alert(
            "Kullanım Hakkı Tükenmiş",
            `"${label}" modeli için kullanım hakkınız tükenmiş. Lütfen başka bir model seçin veya modeli yeniden satın alın.`
          );
          return;
        }

        if (typeof m?.id !== "number") {
          throw new Error("Model indirimi için DB id yok");
        }

        const remoteUrl = m.source?.trim() || "";
        if (!remoteUrl) {
          throw new Error("Model dosya adresi (source) yok");
        }

        setIsModelLoading(true);
        setModelLoadingProgress(null);
        const loadingPrefix =
          Platform.OS === "ios" ? "Sunucudan indiriliyor" : "Play'dan indiriliyor";
        setModelLoadingText(`${loadingPrefix}: ${label}`);

        const result = await ensureModelAvailable(m.id, {
          timeoutMs: 120_000,
          remoteUrl,
          onProgress: (s) => {
            if (typeof s?.percent === "number" && Number.isFinite(s.percent)) {
              setModelLoadingProgress(Math.max(0, Math.min(100, s.percent)));
            } else {
              setModelLoadingProgress(null);
            }
            const status = s?.statusName ? ` (${s.statusName})` : "";
            setModelLoadingText(`${loadingPrefix}: ${label}${status}`);
          },
        });

        if (__DEV__) {
          if (result.ok) {
            console.log(`[ModelSelect] model_${m.id} (${label}): VAR – seçildi, haritaya tıklayarak yerleştirin`);
          } else {
            console.warn(
              `[ModelSelect] model_${m.id} (${label}): YOK – pack/assets'ta dosya yok veya hata. ${result.lastState?.statusName ?? "?"}`
            );
          }
        }

        if (!result.ok) {
          const status = result?.lastState?.statusName ? `Durum: ${result.lastState.statusName}` : "Durum bilinmiyor";
          const errHint =
            Platform.OS === "ios"
              ? "Model indirilemedi veya doğrulanamadı"
              : "Asset pack indirilemedi veya hazır değil";
          throw new Error(`${errHint}. ${status}`);
        }

        setPlacingModelId(m.modelId);
        setModelsDropdownOpen(false);
        setShapeDrawingMode(null);
        setMeasurementMode(null);
        setParcelSelectMode(false);
      } catch (err: any) {
        console.error("[useModelSelectHandler] Model load failed:", { 
          modelId: m.modelId, 
          err: String(err?.message || err),
          stack: err?.stack 
        });
        // Hata durumunda modalı açık tut (kullanıcı tekrar deneyebilsin)
        // setModelsDropdownOpen(false); // Hata durumunda modalı kapatma
        Alert.alert("Model Yüklenemedi", `${m.modelId} indirilemedi veya doğrulanamadı.\n${String(err?.message || err)}`);
      } finally {
        setIsModelLoading(false);
        setModelLoadingText("Model yükleniyor...");
        setModelLoadingProgress(null);
      }
    },
    [
      formatModelDisplayName,
      placingModelId,
      setIsModelLoading,
      setMeasurementMode,
      setModelLoadingProgress,
      setModelLoadingText,
      setModelsDropdownOpen,
      setParcelSelectMode,
      setPlacingModelId,
      setShapeDrawingMode,
      getRemainingUses,
    ]
  );
}

