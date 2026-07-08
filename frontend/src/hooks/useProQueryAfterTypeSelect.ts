/**
 * Tip seçimi sonrası Pro Sorgu yürütme akışı (paylaşılabilir).
 *
 * Portal detay ekranından (ve gelecekte başka ekranlardan) onay modalı OLMADAN
 * doğrudan tip seçim modalı + alt modallar (Villa/Fabrika/Bina/Müstakil/Konut) zincirini
 * yönetir, `runProParcelQuery` ile yeni bir Pro Sorgu çalıştırır ve sonucu `onSuccess`'e devreder.
 *
 * Index ekranının (ana harita) mevcut akışı haritaya/kamera durumuna sıkı bağlı olduğundan
 * burada bilinçli olarak hafif (harita capture'sız) bir varyant tutulur; modal mount'u
 * `ProQueryTypeModalHost` bileşeniyle yapılır.
 */

import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { ShareParcelSelection } from '../../components/PropertyTypeSelectionModal';
import {
  ProQueryLimitError,
  ProQueryHttpError,
  getProQueryAlertButtons,
  getProQueryErrorAlert,
  shouldDeferProQueryForApify,
  runProParcelQuery,
  startProParcelQueryBackground,
  type BackgroundProQueryPending,
} from '../utils/proQueryApi';
import { startProQueryBackgroundWatch } from '../../services/proQueryJobTracker';
import {
  PortalDetailGeometryError,
  type ProQueryTkgmFeature,
} from '../utils/portalDetailProQueryLauncher';

export type ProQueryLaunchInput = {
  feature: ProQueryTkgmFeature;
  title: string;
  suggestedType: string | null;
  areaM2?: number;
};

export type UseProQueryAfterTypeSelectOptions = {
  isAuthenticated: boolean;
  /** Backend kaynak etiketi (web parity: 'portal-detail'). */
  source: string;
  /** Giriş gerekiyorsa çağrılır. */
  onLogin: () => void;
  /** Pro sorgu başarıyla tamamlandığında (yeni snapshot) çağrılır. */
  onSuccess: (data: any) => Promise<void> | void;
  /** 402 / yetersiz kredi durumunda çağrılır (ör. pricing ekranına git). */
  onInsufficientCredit?: () => void;
};

export type ProQueryTypeFlowController = {
  typeModalVisible: boolean;
  typeModalTitle: string;
  typeModalSuggested: string | null;
  villaVisible: boolean;
  factoryVisible: boolean;
  binaVisible: boolean;
  mustakilVisible: boolean;
  konutVisible: boolean;
  areaM2: number;
  submitting: boolean;
  apifyPendingVisible: boolean;
  apifyPendingMessage: string;
  apifyConfirming: boolean;
  confirmApifyPending: () => void;
  dismissApifyPending: () => void;
  /** Tip seçim modalını açar (onay modalı YOK). */
  launch: (input: ProQueryLaunchInput) => void;
  closeTypeModal: () => void;
  handleSelect: (propertyType: string, shareData?: ShareParcelSelection | null) => void;
  onVillaResult: (params: any | null) => void;
  onFactoryResult: (params: any | null) => void;
  onBinaResult: (params: any | null) => void;
  onMustakilResult: (params: any | null) => void;
  onKonutResult: (params: any | null) => void;
};

function normalizeShareData(
  shareData?: ShareParcelSelection | null,
): ShareParcelSelection | null {
  if (!shareData) return null;
  const hisseM2 = String(shareData.hisseM2 || '').replace(/[^\d]/g, '').trim();
  const parcelLocationStatus =
    shareData.parcelLocationStatus === 'parselbelirli' ||
    shareData.parcelLocationStatus === 'parselbelirlidegil'
      ? shareData.parcelLocationStatus
      : null;
  if (!shareData.hisseli && !hisseM2 && !parcelLocationStatus) return null;
  return {
    hisseli: true,
    hisseM2: hisseM2 || null,
    parcelLocationStatus,
  };
}

function applyShareSelectionToBody(
  body: Record<string, unknown>,
  shareData: ShareParcelSelection | null,
): void {
  if (!shareData) return;
  const hisseM2 = String(shareData.hisseM2 || '').replace(/[^\d]/g, '').trim();
  const parcelLocationStatus =
    shareData.parcelLocationStatus === 'parselbelirli' ||
    shareData.parcelLocationStatus === 'parselbelirlidegil'
      ? shareData.parcelLocationStatus
      : null;
  if (!hisseM2 && !parcelLocationStatus) return;
  body.hisseli = true;
  if (hisseM2) body.hisse_m2 = hisseM2;
  if (parcelLocationStatus) body.parcel_location_status = parcelLocationStatus;
}

export function useProQueryAfterTypeSelect(
  options: UseProQueryAfterTypeSelectOptions,
): ProQueryTypeFlowController {
  const { isAuthenticated, source, onLogin, onSuccess, onInsufficientCredit } = options;

  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [typeModalTitle, setTypeModalTitle] = useState('Taşınmaz Türü Seçin');
  const [typeModalSuggested, setTypeModalSuggested] = useState<string | null>(null);
  const [villaVisible, setVillaVisible] = useState(false);
  const [factoryVisible, setFactoryVisible] = useState(false);
  const [binaVisible, setBinaVisible] = useState(false);
  const [mustakilVisible, setMustakilVisible] = useState(false);
  const [konutVisible, setKonutVisible] = useState(false);
  const [areaM2, setAreaM2] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [apifyPendingVisible, setApifyPendingVisible] = useState(false);
  const [apifyPendingMessage, setApifyPendingMessage] = useState('');
  const [apifyConfirming, setApifyConfirming] = useState(false);

  const featureRef = useRef<ProQueryTkgmFeature | null>(null);
  const shareRef = useRef<ShareParcelSelection | null>(null);
  const pendingBodyRef = useRef<Record<string, unknown> | null>(null);

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof PortalDetailGeometryError) {
        Alert.alert('Hata', error.message);
        return;
      }
      if (error instanceof ProQueryHttpError && error.status === 402) {
        if (onInsufficientCredit) {
          onInsufficientCredit();
          return;
        }
      }
      if (error instanceof ProQueryLimitError) {
        Alert.alert(
          'Günlük Sorgu Limiti',
          `${error.message}\n\nGünlük ücretsiz sorgu hakkınız: ${error.dailyLimit}`,
          isAuthenticated
            ? [{ text: 'Tamam' }]
            : [
                { text: 'Kapat', style: 'cancel' },
                { text: 'Giriş Yap', onPress: onLogin },
              ],
        );
        return;
      }
      const alert = getProQueryErrorAlert(error);
      Alert.alert(
        alert.title,
        alert.message,
        getProQueryAlertButtons(alert, { isAuthenticated, onLogin }),
      );
    },
    [isAuthenticated, onLogin, onInsufficientCredit],
  );

  const buildRequestBody = useCallback(
    (propertyType: string, extraParams?: Record<string, unknown>) => {
      const feature = featureRef.current;
      if (!feature) return null;
      const props = (feature.properties || {}) as Record<string, any>;
      const body: Record<string, unknown> = {
        tkgm_data: feature,
        property_type_override: propertyType,
        map_mode: '2d',
        is3D: false,
        source,
        ...(extraParams || {}),
      };
      if (props.mahalleAd && props.adaNo && props.parselNo) {
        body.mahalle = props.mahalleAd;
        body.ada = props.adaNo;
        body.parsel = props.parselNo;
        if (props.mahalleId) body.mahalleTkgmValue = props.mahalleId;
      }
      applyShareSelectionToBody(body, shareRef.current);
      return body;
    },
    [source],
  );

  const runBackgroundQuery = useCallback(
    async (body: Record<string, unknown>) => {
      const pending: BackgroundProQueryPending = await startProParcelQueryBackground(body);
      startProQueryBackgroundWatch(pending);
      featureRef.current = null;
      shareRef.current = null;
    },
    [],
  );

  const runQuery = useCallback(
    async (propertyType: string, extraParams?: Record<string, unknown>) => {
      const body = buildRequestBody(propertyType, extraParams);
      if (!body) return;
      setSubmitting(true);
      try {
        const gate = await shouldDeferProQueryForApify(body);
        if (gate.deferred) {
          pendingBodyRef.current = gate.body;
          setApifyPendingMessage(gate.message);
          setApifyPendingVisible(true);
          setSubmitting(false);
          return;
        }

        const data = await runProParcelQuery(body);
        if (data?.error) {
          throw new Error(String(data.error));
        }
        await onSuccess(data);
        featureRef.current = null;
        shareRef.current = null;
      } catch (error) {
        handleError(error);
      } finally {
        setSubmitting(false);
      }
    },
    [buildRequestBody, onSuccess, handleError],
  );

  const confirmApifyPending = useCallback(async () => {
    const body = pendingBodyRef.current;
    if (!body || apifyConfirming) return;
    setApifyConfirming(true);
    try {
      await runBackgroundQuery(body);
      setApifyPendingVisible(false);
      pendingBodyRef.current = null;
    } catch (error) {
      handleError(error);
    } finally {
      setApifyConfirming(false);
      setSubmitting(false);
    }
  }, [apifyConfirming, runBackgroundQuery, handleError]);

  const dismissApifyPending = useCallback(() => {
    setApifyPendingVisible(false);
    pendingBodyRef.current = null;
    setSubmitting(false);
    featureRef.current = null;
    shareRef.current = null;
  }, []);

  const launch = useCallback((input: ProQueryLaunchInput) => {
    featureRef.current = input.feature;
    shareRef.current = null;
    setAreaM2(input.areaM2 && input.areaM2 > 0 ? input.areaM2 : 0);
    setTypeModalTitle(input.title || 'Taşınmaz Türü Seçin');
    setTypeModalSuggested(input.suggestedType ?? null);
    setTypeModalVisible(true);
  }, []);

  const closeTypeModal = useCallback(() => {
    setTypeModalVisible(false);
  }, []);

  const handleSelect = useCallback(
    (propertyType: string, shareData?: ShareParcelSelection | null) => {
      shareRef.current = normalizeShareData(shareData);
      setTypeModalVisible(false);

      if (propertyType === 'Villa') {
        setVillaVisible(true);
        return;
      }
      if (propertyType === 'Fabrika') {
        setFactoryVisible(true);
        return;
      }
      if (propertyType === 'Bina') {
        setBinaVisible(true);
        return;
      }
      if (propertyType === 'Müstakil Ev') {
        setMustakilVisible(true);
        return;
      }
      if (propertyType === 'Konut Maliyeti + Daire Satış Fiyatı Hesaplama') {
        setKonutVisible(true);
        return;
      }
      void runQuery(propertyType);
    },
    [runQuery],
  );

  const onVillaResult = useCallback(
    (params: any | null) => {
      setVillaVisible(false);
      if (!params) return;
      void runQuery('Villa', { villa_params: params });
    },
    [runQuery],
  );

  const onFactoryResult = useCallback(
    (params: any | null) => {
      setFactoryVisible(false);
      if (!params) return;
      void runQuery('Fabrika', { factory_params: params });
    },
    [runQuery],
  );

  const onBinaResult = useCallback(
    (params: any | null) => {
      setBinaVisible(false);
      if (!params) return;
      void runQuery('Bina', { bina_params: params });
    },
    [runQuery],
  );

  const onMustakilResult = useCallback(
    (params: any | null) => {
      setMustakilVisible(false);
      if (!params) return;
      void runQuery('Müstakil Ev', { mustakil_ev_params: params });
    },
    [runQuery],
  );

  const onKonutResult = useCallback(
    (params: any | null) => {
      setKonutVisible(false);
      if (!params) return;
      void runQuery('Konut Maliyeti + Daire Satış Fiyatı Hesaplama', {
        konut_daire_params: params,
      });
    },
    [runQuery],
  );

  return {
    typeModalVisible,
    typeModalTitle,
    typeModalSuggested,
    villaVisible,
    factoryVisible,
    binaVisible,
    mustakilVisible,
    konutVisible,
    areaM2,
    submitting,
    apifyPendingVisible,
    apifyPendingMessage,
    apifyConfirming,
    confirmApifyPending: () => {
      void confirmApifyPending();
    },
    dismissApifyPending,
    launch,
    closeTypeModal,
    handleSelect,
    onVillaResult,
    onFactoryResult,
    onBinaResult,
    onMustakilResult,
    onKonutResult,
  };
}
