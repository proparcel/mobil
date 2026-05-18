import { useCallback } from "react";
import { Alert } from "react-native";

type Args = {
  parcelSelectMode: boolean;
  setIsLoadingParcel: (v: boolean) => void;
  setParcels: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedParcel: (p: any) => void;
  apiUrl: string;
  fallbackApiUrl: string;
};

export function useParcelSelectHandler({
  parcelSelectMode,
  setIsLoadingParcel,
  setParcels,
  setSelectedParcel,
  apiUrl,
  fallbackApiUrl,
}: Args) {
  return useCallback(
    async (e: any) => {
      if (!parcelSelectMode) return;

      const c: [number, number] | null =
        e?.geometry?.coordinates || e?.coordinates || (e?.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null);
      if (!c) return;

      setIsLoadingParcel(true);
      const backendUrl = String(apiUrl || "").replace(/\/$/, "");
      const fallbackUrl = String(fallbackApiUrl || "").replace(/\/$/, "");

      try {
        const requestBody = { lat: c[1], lon: c[0], map_mode: "3d", is3D: true };

        const fetchParcel = async (baseUrl: string) => {
          const url = `${baseUrl}/api/tkgm_view/`;
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });

          const contentType = response.headers?.get?.("content-type") || "";
          const payload: any = contentType.includes("application/json")
            ? await response.json().catch(() => null)
            : await response.text().catch(() => null);

          if (!response.ok) {
            const msg =
              (payload && typeof payload === "object" && (payload.error || payload.detail || payload.message)) ||
              (typeof payload === "string" ? payload : "");
            const err: any = new Error(`HTTP ${response.status}${msg ? ` - ${String(msg).slice(0, 200)}` : ""}`);
            err.status = response.status;
            err.payload = payload;
            err.url = url;
            throw err;
          }

          return payload;
        };

        let data: any = null;
        let usedFallback = false;
        try {
          const base = backendUrl || fallbackUrl;
          data = await fetchParcel(base);
        } catch (primaryErr: any) {
          const canRetry = Boolean(fallbackUrl) && fallbackUrl !== backendUrl;
          if (canRetry) {
            try {
              usedFallback = true;
              data = await fetchParcel(fallbackUrl);
            } catch (fallbackErr: any) {
              console.error("[handleParcelSelect] Primary error:", primaryErr);
              console.error("[handleParcelSelect] Fallback error:", fallbackErr);
              throw fallbackErr;
            }
          } else {
            throw primaryErr;
          }
        }

        if (usedFallback) {
          console.log("[handleParcelSelect] API fallback (ngrok) kullanıldı:", fallbackUrl);
        }

        if (data?.geometry) {
          const parcelId = `parcel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const parcelWithId = { ...data, id: parcelId };

          setParcels((prev) => {
            const exists = prev.some(
              (p) => p?.properties?.adaNo === data?.properties?.adaNo && p?.properties?.parselNo === data?.properties?.parselNo
            );
            if (exists) return prev;
            return [...prev, parcelWithId];
          });

          setSelectedParcel(parcelWithId);
          const props = data?.properties || {};
          const info =
            props.mahalleAd && props.adaNo && props.parselNo
              ? `${props.mahalleAd} - Ada: ${props.adaNo}, Parsel: ${props.parselNo}`
              : "Parsel seçildi";
          Alert.alert("Başarılı", info);
        } else {
          Alert.alert("Bilgi", "Bu konumda parsel bulunamadı");
        }
      } catch (error: any) {
        const status = error?.status;
        const payload = error?.payload;
        console.error("[handleParcelSelect] Hata:", { status, payload, message: error?.message, url: error?.url });

        if (status === 404) {
          Alert.alert("Bilgi", "Bu konumda parsel bulunamadı");
        } else if (status === 502 || status === 503) {
          Alert.alert("Bağlantı Hatası", "Backend sunucusuna bağlanılamadı. Gerekirse ngrok ile deneyin.");
        } else if (status === 504) {
          Alert.alert("Zaman Aşımı", "TKGM sunucusu yanıt vermedi. Lütfen birkaç saniye sonra tekrar deneyin.");
        } else {
          Alert.alert("Hata", "Parsel sorgusu sırasında bir hata oluştu");
        }
      } finally {
        setIsLoadingParcel(false);
      }
    },
    [apiUrl, fallbackApiUrl, parcelSelectMode, setIsLoadingParcel, setParcels, setSelectedParcel]
  );
}

