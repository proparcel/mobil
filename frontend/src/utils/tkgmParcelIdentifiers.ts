import { resolveQuarterByTkgmValue } from './resolveSavedQueryLocation';

export function pickTkgmString(props: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const val = props[key];
    if (val !== null && val !== undefined && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}

export function pickTkgmMahalleId(props: Record<string, unknown>): number {
  const raw = props.mahalleId ?? props.MahalleId;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

/** TKGM coords yanıtında ada boş gelince çoğu kayıt ada=0 kullanır. */
export function resolveAdaFromTkgmProps(
  props: Record<string, unknown>,
  formAda?: string | null,
): string {
  const fromForm = String(formAda ?? '').trim();
  if (fromForm) return fromForm;

  const fromProps = pickTkgmString(props, ['adaNo', 'ada']);
  if (fromProps) return fromProps;

  const parsel = pickTkgmString(props, ['parselNo', 'parsel']);
  return parsel ? '0' : '';
}

export function resolveParselFromTkgmProps(
  props: Record<string, unknown>,
  formParsel?: string | null,
): string {
  const fromForm = String(formParsel ?? '').trim();
  if (fromForm) return fromForm;
  return pickTkgmString(props, ['parselNo', 'parsel']);
}

export function resolveMahalleAdFromTkgmProps(props: Record<string, unknown>): string {
  return pickTkgmString(props, ['mahalleAd', 'MahalleAd']);
}

export function resolveIlFromTkgmProps(props: Record<string, unknown>): string {
  return pickTkgmString(props, ['ilAd', 'IlAd', 'il']);
}

export function resolveIlceFromTkgmProps(props: Record<string, unknown>): string {
  return pickTkgmString(props, ['ilceAd', 'IlceAd', 'ilce']);
}

export function resolveProparcelValueFromTkgmProps(
  props: Record<string, unknown>,
  formValue?: number | null,
  mahalleAd?: string | null,
): number {
  const fromForm = Number(formValue);
  if (Number.isFinite(fromForm) && fromForm > 0) return fromForm;

  const fromProps = pickTkgmString(props, ['proparcel_value', 'Proparcel_value']);
  const parsedProps = fromProps ? Number(fromProps) : NaN;
  if (Number.isFinite(parsedProps) && parsedProps > 0) return parsedProps;

  const mahalleTkgm = pickTkgmMahalleId(props);
  if (!Number.isFinite(mahalleTkgm) || mahalleTkgm <= 0) return NaN;

  const quarter = resolveQuarterByTkgmValue(mahalleTkgm, {
    mahalleAd: mahalleAd ?? resolveMahalleAdFromTkgmProps(props),
    proparcelValue: fromForm > 0 ? fromForm : undefined,
  });
  return quarter?.proparcelValue ?? NaN;
}

export type TkgmParcelLookupParams = {
  proparcelValue: number;
  ada: string;
  parsel: string;
  mahalle?: string;
  il?: string;
  townId?: number;
};

function resolveQuarterContext(
  props: Record<string, unknown>,
  form?: {
    proparcelValue?: number | null;
    mahalle?: string | null;
    il?: string | null;
  },
) {
  const mahalleAd =
    String(form?.mahalle ?? '').trim() || resolveMahalleAdFromTkgmProps(props);
  const mahalleTkgm = pickTkgmMahalleId(props);
  if (!Number.isFinite(mahalleTkgm) || mahalleTkgm <= 0) return null;

  return resolveQuarterByTkgmValue(mahalleTkgm, {
    mahalleAd,
    proparcelValue:
      form?.proparcelValue != null && Number(form.proparcelValue) > 0
        ? Number(form.proparcelValue)
        : undefined,
  });
}

/** TKGM properties + isteğe bağlı form → adaparsel API lookup parametreleri. */
export function resolveTkgmParcelLookupParams(
  properties?: Record<string, unknown> | null,
  form?: {
    proparcelValue?: number | null;
    ada?: string | null;
    parsel?: string | null;
    mahalle?: string | null;
    il?: string | null;
    townId?: number | null;
  },
): TkgmParcelLookupParams | null {
  const p = properties || {};
  const mahalle =
    String(form?.mahalle ?? '').trim() || resolveMahalleAdFromTkgmProps(p);
  const ada = resolveAdaFromTkgmProps(p, form?.ada);
  const parsel = resolveParselFromTkgmProps(p, form?.parsel);

  const quarter = resolveQuarterContext(p, {
    proparcelValue: form?.proparcelValue,
    mahalle,
    il: form?.il,
  });

  const proparcelValue = (() => {
    const fromForm = Number(form?.proparcelValue);
    if (Number.isFinite(fromForm) && fromForm > 0) return fromForm;
    if (quarter?.proparcelValue) return quarter.proparcelValue;
    return resolveProparcelValueFromTkgmProps(p, form?.proparcelValue, mahalle);
  })();

  if (!ada || !parsel || !Number.isFinite(proparcelValue) || proparcelValue <= 0) {
    return null;
  }

  const il =
    String(form?.il ?? '').trim() ||
    quarter?.il ||
    resolveIlFromTkgmProps(p);
  const townId =
    form?.townId != null && Number(form.townId) > 0
      ? Number(form.townId)
      : quarter?.townId;

  return {
    proparcelValue,
    ada,
    parsel,
    mahalle: mahalle || undefined,
    il: il || undefined,
    townId: townId && townId > 0 ? townId : undefined,
  };
}
