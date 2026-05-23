import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { fetchModelCatalogFlat, type ModelCatalogFlatItem } from "@/src/maps/models/modelCatalog";

type Result = {
  modelCatalogFlat: ModelCatalogFlatItem[];
  isModelCatalogLoading: boolean;
  modelCatalogError: string | null;
  modelsProp: Record<string, string | number>;
};

export function useModelCatalog(visible: boolean, refreshKey?: number): Result {
  const [modelCatalogFlat, setModelCatalogFlat] = useState<ModelCatalogFlatItem[]>([]);
  const [isModelCatalogLoading, setIsModelCatalogLoading] = useState(false);
  const [modelCatalogError, setModelCatalogError] = useState<string | null>(null);

  // Model kataloğunu backend'den yükle (veritabanından)
  useEffect(() => {
    if (!visible) {
      console.log("[3DEDIT] useModelCatalog: visible=false, yükleme atlanıyor");
      return;
    }
    
    console.log("[3DEDIT] useModelCatalog: Model kataloğu yüklenmeye başlıyor");
    let cancelled = false;
    setIsModelCatalogLoading(true);
    setModelCatalogError(null);
    
    (async () => {
      try {
        console.log("[3DEDIT] useModelCatalog: fetchModelCatalogFlat çağrılıyor");
        const list = await fetchModelCatalogFlat();
        
        if (cancelled) {
          console.log("[3DEDIT] useModelCatalog: iptal edildi");
          return;
        }
        
        console.log("[3DEDIT] useModelCatalog: Model listesi alındı, count=", list?.length ?? 0);
        setModelCatalogFlat(list || []);
        
        if (!list || list.length === 0) {
          const errorMsg = "Model listesi boş. Backend'den hiç model döndürülmedi.";
          console.warn("[useModelCatalog]", errorMsg);
          setModelCatalogError(errorMsg);
        } else {
          const byCategory: Record<string, number> = {};
          list.forEach(m => {
            byCategory[m.groupId] = (byCategory[m.groupId] || 0) + 1;
          });
          console.log("[3DEDIT] useModelCatalog: ✅ listesi yüklendi, total=", list.length, "byCategory=", byCategory);
        }
      } catch (e: any) {
        if (cancelled) {
          console.log("[3DEDIT] useModelCatalog: iptal edildi, hata atlanıyor");
          return;
        }
        
        console.error("[3DEDIT] useModelCatalog: ❌ Model listesi hatası:", {
          error: e,
          message: e?.message,
          stack: e?.stack
        });
        
        setModelCatalogFlat([]);
        
        // Hata mesajını iyileştir
        let errorMessage = "Model listesi alınamadı";
        const errorStr = String(e?.message || e || "");
        
        if (errorStr.includes("Zaman aşımı") || errorStr.includes("timeout") || errorStr.includes("AbortError")) {
          errorMessage = "Model listesi yüklenirken zaman aşımı oluştu. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.";
        } else if (errorStr.includes("Ağ hatası") || errorStr.includes("Network request failed") || errorStr.includes("Failed to fetch")) {
          errorMessage = "Backend'e bağlanılamadı. Lütfen internet bağlantınızı ve backend sunucusunun çalıştığını kontrol edin.";
        } else if (errorStr.includes("HTTP")) {
          errorMessage = `Backend API hatası: ${errorStr}`;
        } else if (errorStr) {
          errorMessage = errorStr;
        }
        
        console.error("[useModelCatalog] Hata mesajı ayarlandı:", errorMessage);
        setModelCatalogError(errorMessage);
      } finally {
        if (!cancelled) {
          console.log("[3DEDIT] useModelCatalog: loading=false");
          setIsModelCatalogLoading(false);
        }
      }
    })();
    
    return () => {
      console.log("[3DEDIT] useModelCatalog: cleanup (cancelled=true)");
      cancelled = true;
    };
  }, [visible, refreshKey]);

  // Android: pp-local + PAD interceptor. iOS: sunucu source (HTTPS); ShapeDrawingModal önceliği source.
  const modelsProp = useMemo(() => {
    const map: Record<string, string | number> = {};
    for (const item of modelCatalogFlat || []) {
      const id = typeof item?.id === "number" ? item.id : null;
      if (!id) continue;
      if (Platform.OS === "ios") {
        if (item.source) map[String(id)] = item.source;
      } else {
        map[String(id)] = `https://pp-local/models/model_${id}.glb`;
      }
    }
    if (__DEV__ && Object.keys(map).length > 0) {
      const ids = Object.keys(map).sort((a, b) => Number(a) - Number(b));
      const strategy = Platform.OS === "ios" ? "HTTPS source" : "pp-local pack";
      console.log(`[3DEDIT] modelsProp (${strategy}): ${ids.length} model (id'ler: ${ids.join(", ")})`);
    }
    return map;
  }, [modelCatalogFlat]);

  return {
    modelCatalogFlat,
    isModelCatalogLoading,
    modelCatalogError,
    modelsProp,
  };
}

