import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Alert, Keyboard } from 'react-native';
import { postMahalleOrtSignal } from '../../services/portalService';
import type { MahalleOrtSignalResponse, PortalQueryDetail } from '../types/portal';
import type { PortalDfaSimulatedFooter } from '../utils/portalDfaHelpers';
import {
  mapMahalleOrtSimulationToFooter,
  mahalleOrtWrittenPriceMatchesInput,
  parseMahalleOrtInput,
  resolveMahalleOrtDisplaySimulation,
} from '../utils/dfaPortalSteps';

export type PortalMahalleOrtSession = {
  mahalleOrtInput: string;
  setMahalleOrtInput: Dispatch<SetStateAction<string>>;
  simulatedFooter: PortalDfaSimulatedFooter | null;
  mahalleOrtNotice: string | null;
  mahalleOrtHesaplaSubmitting: boolean;
  mahalleOrtBildirSubmitting: boolean;
  mahalleOrtDbSaved: boolean;
  creditCelebration: { credits: number; message: string } | null;
  setCreditCelebration: Dispatch<SetStateAction<{ credits: number; message: string } | null>>;
  handleMahalleOrtHesapla: () => Promise<void>;
  handleMahalleOrtBildir: () => Promise<void>;
  handleMahalleOrtReset: () => void;
  canResetMahalleOrt: boolean;
  mahalleOrtValid: boolean;
  mahalleOrtBusy: boolean;
};

type Options = {
  onMahalleOrtSaved?: () => void;
  viewerIsExpert?: boolean;
};

export function usePortalMahalleOrtSession(
  detail: PortalQueryDetail | null | undefined,
  { onMahalleOrtSaved, viewerIsExpert = false }: Options = {},
): PortalMahalleOrtSession {
  const [mahalleOrtInput, setMahalleOrtInput] = useState('');
  const [simulatedFooter, setSimulatedFooter] = useState<PortalDfaSimulatedFooter | null>(null);
  const [mahalleOrtNotice, setMahalleOrtNotice] = useState<string | null>(null);
  const [mahalleOrtHesaplaSubmitting, setMahalleOrtHesaplaSubmitting] = useState(false);
  const [mahalleOrtBildirSubmitting, setMahalleOrtBildirSubmitting] = useState(false);
  const [mahalleOrtDbSaved, setMahalleOrtDbSaved] = useState(false);
  const [creditCelebration, setCreditCelebration] = useState<{ credits: number; message: string } | null>(
    null,
  );

  useEffect(() => {
    setMahalleOrtInput('');
    setSimulatedFooter(null);
    setMahalleOrtNotice(null);
    setMahalleOrtDbSaved(false);
    setCreditCelebration(null);
  }, [detail?.snapshot_id]);

  const applyMahalleOrtSimulation = useCallback(
    (body: Pick<MahalleOrtSignalResponse, 'db_simulation' | 'simulation'>) => {
      const displaySimulation = resolveMahalleOrtDisplaySimulation(body);
      const footer = mapMahalleOrtSimulationToFooter(displaySimulation);
      if (footer) {
        setSimulatedFooter(footer);
      }
    },
    [],
  );

  const applyMahalleOrtReward = useCallback((body: MahalleOrtSignalResponse) => {
    const reward = body.reward;
    if (!reward?.show_celebration_modal) return;
    setCreditCelebration({
      credits: reward.credit_awarded ?? 1,
      message:
        reward.celebration_message ||
        `Tebrikler! ${reward.credit_awarded ?? 1} Tepe Kredi kazandınız.`,
    });
    const attempts = reward.attempts_remaining;
    if (Number.isFinite(attempts) && attempts != null && attempts >= 0) {
      setMahalleOrtNotice((prev) => {
        const base = prev || 'İşlem tamamlandı.';
        return `${base} Kalan deneme hakkı: ${attempts}.`;
      });
    }
  }, []);

  const processMahalleOrtSuccess = useCallback(
    (body: MahalleOrtSignalResponse, unit: number, mode: 'hesapla' | 'bildir') => {
      applyMahalleOrtSimulation(body);
      setMahalleOrtInput(String(Math.round(unit)));

      if (mode === 'bildir') {
        if (body.db_saved) {
          if (!mahalleOrtWrittenPriceMatchesInput(body, unit)) {
            setMahalleOrtNotice(
              'Kayıt alındı ancak simülasyon girilen fiyatla eşleşmiyor. Sayfayı yenileyin.',
            );
          } else {
            setMahalleOrtNotice('Mahalle ortalaması bildirildi.');
          }
          setMahalleOrtDbSaved(true);
          onMahalleOrtSaved?.();
        } else {
          setMahalleOrtNotice(body.message || 'Mahalle ortalaması kaydedilemedi.');
          setMahalleOrtDbSaved(false);
        }
      } else if (body.db_saved) {
        setMahalleOrtNotice(body.message || 'Mahalle ortalaması güncellendi.');
        setMahalleOrtDbSaved(true);
        onMahalleOrtSaved?.();
      } else if (body.message) {
        setMahalleOrtNotice(body.message);
      }

      applyMahalleOrtReward(body);
      if (!body.reward?.show_celebration_modal && body.reward?.badge_counted) {
        const notice =
          mode === 'bildir'
            ? 'Mahalle ortalaması bildirildi. Bu parsel için kredi penceresi henüz dolmadı.'
            : 'Katılımınız kaydedildi. Bu parsel için kredi penceresi henüz dolmadı.';
        setMahalleOrtNotice(notice);
      }
    },
    [applyMahalleOrtReward, applyMahalleOrtSimulation, onMahalleOrtSaved],
  );

  const submitMahalleOrtSignal = useCallback(
    async (
      unit: number,
      snapshotId: number,
      options: { persist: boolean; confirmExtremePrice?: boolean },
    ) => postMahalleOrtSignal(snapshotId, unit, options),
    [],
  );

  const handleMahalleOrtHesapla = useCallback(async () => {
    const unit = parseMahalleOrtInput(mahalleOrtInput);
    const snapshotId = Number(detail?.snapshot_id);
    if (unit == null || !Number.isFinite(snapshotId) || snapshotId <= 0 || mahalleOrtHesaplaSubmitting) {
      setSimulatedFooter(null);
      return;
    }

    setMahalleOrtHesaplaSubmitting(true);
    setMahalleOrtNotice(null);
    try {
      const res = await submitMahalleOrtSignal(unit, snapshotId, { persist: false });
      if (!res.ok) {
        Alert.alert('Uyarı', res.error || 'Hesaplama yapılamadı.');
        setSimulatedFooter(null);
        return;
      }
      processMahalleOrtSuccess(res.data, unit, 'hesapla');
    } catch {
      Alert.alert('Uyarı', 'Hesaplama isteği gönderilemedi.');
      setSimulatedFooter(null);
    } finally {
      setMahalleOrtHesaplaSubmitting(false);
      Keyboard.dismiss();
    }
  }, [
    mahalleOrtInput,
    detail?.snapshot_id,
    mahalleOrtHesaplaSubmitting,
    processMahalleOrtSuccess,
    submitMahalleOrtSignal,
  ]);

  const handleMahalleOrtBildir = useCallback(async () => {
    const unit = parseMahalleOrtInput(mahalleOrtInput);
    const snapshotId = Number(detail?.snapshot_id);
    if (unit == null || !Number.isFinite(snapshotId) || snapshotId <= 0 || mahalleOrtBildirSubmitting) {
      return;
    }

    const runSignal = (confirmExtremePrice: boolean) =>
      submitMahalleOrtSignal(unit, snapshotId, { persist: true, confirmExtremePrice });

    setMahalleOrtBildirSubmitting(true);
    setMahalleOrtNotice(null);
    try {
      let res = await runSignal(false);

      if (!res.ok && res.status === 409 && res.code === 'confirm_extreme_price') {
        if (res.payload && typeof res.payload === 'object') {
          applyMahalleOrtSimulation({
            db_simulation: res.payload.db_simulation as MahalleOrtSignalResponse['db_simulation'],
            simulation: res.payload.simulation as MahalleOrtSignalResponse['simulation'],
          });
        }
        const message =
          res.error ||
          String(res.payload?.message || '') ||
          'Girdiğiniz fiyat mahalle ortalamasından önemli ölçüde farklı. Onaylıyor musunuz?';
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert('Onay', message, [
            { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Evet', onPress: () => resolve(true) },
          ]);
        });
        if (!confirmed) {
          setMahalleOrtNotice('Onay verilmediği için fiyat veritabanına kaydedilmedi.');
          return;
        }
        res = await runSignal(true);
      }

      if (!res.ok) {
        Alert.alert('Uyarı', res.error || 'Mahalle ortalaması kaydedilemedi.');
        return;
      }

      processMahalleOrtSuccess(res.data, unit, 'bildir');
    } catch {
      Alert.alert('Uyarı', 'Mahalle ortalaması isteği gönderilemedi.');
    } finally {
      setMahalleOrtBildirSubmitting(false);
      Keyboard.dismiss();
    }
  }, [
    mahalleOrtInput,
    detail?.snapshot_id,
    mahalleOrtBildirSubmitting,
    applyMahalleOrtSimulation,
    processMahalleOrtSuccess,
    submitMahalleOrtSignal,
  ]);

  const handleMahalleOrtReset = useCallback(() => {
    setMahalleOrtInput('');
    setSimulatedFooter(null);
    setMahalleOrtNotice(null);
    setMahalleOrtDbSaved(false);
    Keyboard.dismiss();
  }, []);

  const canResetMahalleOrt =
    simulatedFooter != null ||
    mahalleOrtInput.trim().length > 0 ||
    mahalleOrtNotice != null ||
    mahalleOrtDbSaved;

  const mahalleOrtValid = parseMahalleOrtInput(mahalleOrtInput) != null;
  const mahalleOrtBusy = mahalleOrtHesaplaSubmitting || mahalleOrtBildirSubmitting;

  return {
    mahalleOrtInput,
    setMahalleOrtInput,
    simulatedFooter,
    mahalleOrtNotice,
    mahalleOrtHesaplaSubmitting,
    mahalleOrtBildirSubmitting,
    mahalleOrtDbSaved,
    creditCelebration,
    setCreditCelebration,
    handleMahalleOrtHesapla,
    handleMahalleOrtBildir,
    handleMahalleOrtReset,
    canResetMahalleOrt,
    mahalleOrtValid,
    mahalleOrtBusy,
  };
}
