/**
 * UI Handler Fonksiyonları
 * 
 * Bu dosya, UI ile ilgili basit handler fonksiyonlarını içerir.
 */

/**
 * Menu item press handler
 */
export const createHandleMenuItemPress = (
  setMenuVisible: (visible: boolean) => void,
  setActiveScreen: (screen: string | null) => void
) => {
  return (itemId: string) => {
    setMenuVisible(false);
    if (itemId === 'ada-parsel') {
      setActiveScreen('ada-parsel');
    }
  };
};

/**
 * Search toggle handler
 */
export const createHandleSearchToggle = (
  activeScreen: string | null,
  setActiveScreen: (screen: string | null) => void
) => {
  return () => {
    if (activeScreen === 'ada-parsel') {
      setActiveScreen(null); // Açıksa kapat
    } else {
      setActiveScreen('ada-parsel'); // Kapalıysa aç
    }
  };
};

/**
 * Close form handler
 */
export const createHandleCloseForm = (
  setActiveScreen: (screen: string | null) => void
) => {
  return () => {
    setActiveScreen(null);
  };
};

/**
 * Toggle mode handler (Pro/Basit)
 */
export const createToggleMode = (
  isProMode: boolean,
  setIsProMode: (mode: boolean) => void
) => {
  return () => {
    setIsProMode(!isProMode);
  };
};

/**
 * Property Type Modal Close handler
 */
export const createHandlePropertyTypeModalClose = (
  setPropertyTypeModalVisible: (visible: boolean) => void,
  setPropertyTypeModalTitle: (title: string) => void,
  setPropertyTypeModalSuggested: (type: string | null) => void,
  setPendingCoordinates: (coords: [number, number] | null) => void,
  setPendingTkgmData: (data: any) => void
) => {
  return () => {
    setPropertyTypeModalVisible(false);
    setPropertyTypeModalTitle('');
    setPropertyTypeModalSuggested(null);
    setPendingCoordinates(null);
    setPendingTkgmData(null);
  };
};

/**
 * Parsel Press handler
 */
export const createHandleParcelPress = (
  parcelData: any,
  isProMode: boolean,
  setParcelModalVisible: (visible: boolean) => void,
  handleMapPress: (feature: any) => Promise<void>,
  calculateBoundsAndCamera: (geometry: any) => { center: [number, number]; zoom: number } | null
) => {
  return () => {
    console.log('[uiHandlers.ts:47] 🔵 Parsel tıklandı, modal açılıyor');
    if (parcelData) {
      console.log('[uiHandlers.ts:49] 📋 Parsel data mevcut, modal state güncelleniyor');
      // Pro modda fiyat/analiz yoksa önce pro sorgu yapıp sonra modal aç
      if (isProMode && !parcelData.analysisData && parcelData.geometry) {
        try {
          const bounds = calculateBoundsAndCamera(parcelData.geometry);
          const center = bounds?.center;
          if (center && center.length === 2) {
            console.log('[uiHandlers.ts:55] 📍 Pro analiz yok; parsel merkezinden pro sorgu tetikleniyor');
            // handleMapPress zaten fetch akışını içeriyor; merkez nokta ile tetikle
            handleMapPress({ geometry: { coordinates: center } });
            return;
          }
        } catch (e) {
          console.warn('[uiHandlers.ts:61] Pro sorgu tetikleme hatası:', e);
        }
      }
      setParcelModalVisible(true);
    } else {
      console.warn('[uiHandlers.ts:66] ⚠️ Parsel tıklandı ama parcelData null');
    }
  };
};