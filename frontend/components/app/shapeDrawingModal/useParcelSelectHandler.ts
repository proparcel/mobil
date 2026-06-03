import { useCallback } from "react";
import { Alert } from "react-native";
import { fetchTkgmParcelByCoords } from "../../../src/utils/tkgmParcelQuery";
import type { TkgmError } from "../../../src/utils/tkgmApi";

type Args = {
  parcelSelectMode: boolean;
  setIsLoadingParcel: (v: boolean) => void;
  setParcels: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedParcel: (p: any) => void;
};

export function useParcelSelectHandler({
  parcelSelectMode,
  setIsLoadingParcel,
  setParcels,
  setSelectedParcel,
}: Args) {
  return useCallback(
    async (e: any) => {
      if (!parcelSelectMode) return;

      const c: [number, number] | null =
        e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
      if (!c) return;

      setIsLoadingParcel(true);

      try {
        const result = await fetchTkgmParcelByCoords(c[1], c[0]);

        if (!result.ok) {
          const msg = result.error;
          if (msg.includes("bulunamadı")) {
            Alert.alert("Bilgi", "Bu konumda parsel bulunamadı");
          } else if (msg.includes("limit")) {
            Alert.alert("Günlük Sorgu Limiti", msg);
          } else {
            Alert.alert("Hata", msg || "Parsel sorgusu sırasında bir hata oluştu");
          }
          return;
        }

        const data = result.data;
        if (data?.geometry) {
          const parcelId = `parcel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const parcelWithId = { ...data, id: parcelId };

          setParcels((prev) => {
            const exists = prev.some(
              (p) =>
                p?.properties?.adaNo === data?.properties?.adaNo &&
                p?.properties?.parselNo === data?.properties?.parselNo,
            );
            if (exists) return prev;
            return [...prev, parcelWithId];
          });

          setSelectedParcel(parcelWithId);
          const props = (data?.properties || {}) as Record<string, unknown>;
          const info =
            props.mahalleAd && props.adaNo && props.parselNo
              ? `${props.mahalleAd} - Ada: ${props.adaNo}, Parsel: ${props.parselNo}`
              : "Parsel seçildi";
          Alert.alert("Başarılı", info);
        } else {
          Alert.alert("Bilgi", "Bu konumda parsel bulunamadı");
        }
      } catch (error: unknown) {
        const err = error as TkgmError;
        console.error("[handleParcelSelect] Hata:", err);
        if (err?.type === "TKGM_PARCEL_NOT_FOUND") {
          Alert.alert("Bilgi", "Bu konumda parsel bulunamadı");
        } else if (err?.type === "TKGM_RATE_LIMIT") {
          Alert.alert("Günlük Sorgu Limiti", err.message || "TKGM günlük sorgu limiti aşıldı.");
        } else if (err?.type === "TIMEOUT") {
          Alert.alert("Zaman Aşımı", "TKGM sunucusu yanıt vermedi. Lütfen birkaç saniye sonra tekrar deneyin.");
        } else {
          Alert.alert("Hata", err?.message || "Parsel sorgusu sırasında bir hata oluştu");
        }
      } finally {
        setIsLoadingParcel(false);
      }
    },
    [parcelSelectMode, setIsLoadingParcel, setParcels, setSelectedParcel],
  );
}
