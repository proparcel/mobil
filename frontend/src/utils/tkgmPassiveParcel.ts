/**
 * TKGM pasif / toplulaştırılmış parsel (geometry=null + gittigiParselListe).
 *
 * Web referansının (myapp/static/js/utils/tkgm_passive_parcel.js) saf TypeScript portu.
 * UI yoktur; onay modalı çağıran tarafça (React) sağlanır.
 */

export interface PassiveParcelRowProps {
  ilAd?: unknown;
  il?: unknown;
  ilceAd?: unknown;
  ilce?: unknown;
  mahalleAd?: unknown;
  mahalle?: unknown;
  adaNo?: unknown;
  ada?: unknown;
  parselNo?: unknown;
  parsel?: unknown;
  ozet?: unknown;
  durum?: unknown;
  durumLabel?: string;
  alan?: unknown;
  nitelik?: unknown;
  pafta?: unknown;
}

export interface PassiveParcelInfo {
  sourceProps: PassiveParcelRowProps;
  sebep: string;
  destinations: PassiveParcelRowProps[];
  normalizedFeature: TkgmFeatureLike;
}

export interface TkgmFeatureLike {
  type?: string;
  geometry?: unknown;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

/** React modalını süren onay callback'i. Promise resolve olunca akış devam eder. */
export type PassiveConfirmFn = (info: PassiveParcelInfo) => Promise<void> | void;

export function durumLabel(value: unknown): string {
  const s = value == null ? '' : String(value).trim();
  if (s === '0') return 'Pasif (aktif değil)';
  if (s === '1') return 'Aktif';
  return s || '—';
}

function parseGittigiParselListe(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return null;
    try {
      const p = JSON.parse(t);
      return p && typeof p === 'object' ? (p as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function firstDestinationFeature(fc: Record<string, unknown> | null): TkgmFeatureLike | null {
  const features = (fc?.features as TkgmFeatureLike[]) || [];
  if (!Array.isArray(features)) return null;
  for (const f of features) {
    if (f && f.geometry) return f;
  }
  return null;
}

function destinationFromProps(dp: Record<string, unknown>): PassiveParcelRowProps {
  return {
    ilAd: dp.ilAd,
    ilceAd: dp.ilceAd,
    mahalleAd: dp.mahalleAd ?? dp.mahalle,
    adaNo: dp.adaNo ?? dp.ada,
    parselNo: dp.parselNo ?? dp.parsel,
    ozet: dp.ozet,
    alan: dp.alan,
    nitelik: dp.nitelik,
    durumLabel: durumLabel(dp.durum),
    pafta: dp.pafta,
  };
}

/**
 * Pasif parsel bilgisini çıkarır; pasif değilse null döner.
 * - 1. dal: ham TKGM yanıtı (geometry=null + gittigiParselListe)
 * - 2. dal: backend zaten normalize etmiş (pp_tkgm_passive_redirect)
 */
export function extractPassiveParcelInfo(data: unknown): PassiveParcelInfo | null {
  if (!data || typeof data !== 'object') return null;
  const feature = data as TkgmFeatureLike;
  const props = (feature.properties || {}) as Record<string, unknown>;

  if (feature.geometry == null && props.gittigiParselListe) {
    const sourceProps: PassiveParcelRowProps = {
      ...(props as PassiveParcelRowProps),
      durumLabel: durumLabel(props.durum),
    };
    const sebep = String(props.gittigiParselSebep || '').trim();
    const fc = parseGittigiParselListe(props.gittigiParselListe);
    const destFeat = firstDestinationFeature(fc);
    if (!destFeat) return null;

    const destinations: PassiveParcelRowProps[] = [];
    const features = (fc?.features as TkgmFeatureLike[]) || [];
    for (const f of features) {
      const dp = (f?.properties || {}) as Record<string, unknown>;
      destinations.push(destinationFromProps(dp));
    }

    const destProps: Record<string, unknown> = { ...(destFeat.properties || {}) };
    destProps.pp_tkgm_passive_redirect = true;
    destProps.pp_tkgm_passive_source_ada = props.adaNo ?? props.ada;
    destProps.pp_tkgm_passive_source_parsel = props.parselNo ?? props.parsel;
    destProps.pp_tkgm_passive_source_ozet = props.ozet;
    destProps.pp_tkgm_passive_sebep = sebep;

    return {
      sourceProps,
      sebep,
      destinations,
      normalizedFeature: {
        type: feature.type || 'Feature',
        geometry: destFeat.geometry,
        properties: destProps,
      },
    };
  }

  if (props.pp_tkgm_passive_redirect) {
    const sourceProps: PassiveParcelRowProps = {
      ilAd: props.ilAd,
      ilceAd: props.ilceAd,
      mahalleAd: props.mahalleAd,
      adaNo: props.pp_tkgm_passive_source_ada,
      parselNo: props.pp_tkgm_passive_source_parsel,
      ozet: props.pp_tkgm_passive_source_ozet,
      durumLabel: 'Pasif (aktif değil)',
    };
    const sebep = String(props.pp_tkgm_passive_sebep || '').trim();
    const destinations: PassiveParcelRowProps[] = [
      {
        ilAd: props.ilAd,
        ilceAd: props.ilceAd,
        mahalleAd: props.mahalleAd,
        adaNo: props.adaNo ?? props.ada,
        parselNo: props.parselNo ?? props.parsel,
        ozet: props.ozet,
        alan: props.alan,
        nitelik: props.nitelik,
        durumLabel: durumLabel(props.durum),
        pafta: props.pafta,
      },
    ];
    return {
      sourceProps,
      sebep,
      destinations,
      normalizedFeature: feature,
    };
  }

  return null;
}

/** geometry=null + gittigiParselListe ise hedef geometriyle Feature döndürür. */
export function normalizeFeature(data: unknown): unknown {
  const info = extractPassiveParcelInfo(data);
  if (!info) return data;
  if (info.normalizedFeature && info.normalizedFeature.geometry) {
    return info.normalizedFeature;
  }
  const feature = data as TkgmFeatureLike;
  const props = (feature.properties || {}) as Record<string, unknown>;
  const fc = parseGittigiParselListe(props.gittigiParselListe);
  const dest = firstDestinationFeature(fc);
  if (!dest) return data;
  const destProps: Record<string, unknown> = { ...(dest.properties || {}) };
  destProps.pp_tkgm_passive_redirect = true;
  destProps.pp_tkgm_passive_source_ada = props.adaNo ?? props.ada;
  destProps.pp_tkgm_passive_source_parsel = props.parselNo ?? props.parsel;
  destProps.pp_tkgm_passive_source_ozet = props.ozet;
  destProps.pp_tkgm_passive_sebep = String(props.gittigiParselSebep || '').trim();
  return {
    type: feature.type || 'Feature',
    geometry: dest.geometry,
    properties: destProps,
  };
}

/** Bir TKGM payload'ının pasif/toplulaştırılmış parsel olup olmadığını söyler. */
export function isPassiveParcelPayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const feature = data as TkgmFeatureLike;
  if ((feature.properties as Record<string, unknown> | undefined)?.pp_tkgm_passive_redirect) {
    return true;
  }
  const props = (feature.properties || feature) as Record<string, unknown>;
  if (!props || typeof props !== 'object') return false;
  if (feature.geometry) return false;
  return !!parseGittigiParselListe(props.gittigiParselListe);
}

/**
 * Pasif parsel ise önce onay modalını (confirm) bekler, sonra normalize feature döner.
 * Pasif değilse data'yı olduğu gibi döner. confirm verilmezse modal'sız normalize edilir.
 */
export async function normalizeAndConfirm(
  data: unknown,
  confirm?: PassiveConfirmFn,
): Promise<unknown> {
  const info = extractPassiveParcelInfo(data);
  if (!info) return data;
  if (confirm) {
    await confirm(info);
  }
  return info.normalizedFeature || normalizeFeature(data);
}

/**
 * Gerçek "parsel bulunamadı" banner'ı gösterilmeli mi?
 * Pasif redirect (kurtarılabilir) ise gösterilmez.
 */
export function shouldShowNotFoundBanner(error: unknown): boolean {
  const err = error as { type?: string; detail?: unknown; payload?: unknown; passiveParcel?: unknown };
  if (!err || err.type !== 'TKGM_PARCEL_NOT_FOUND') return false;
  if (isPassiveParcelPayload(err.detail)) return false;
  if (isPassiveParcelPayload(err.payload)) return false;
  if (err.passiveParcel) return false;
  return true;
}
