import type { RegistrationExpertiseValue } from "../../components/auth/RegistrationExpertiseStep";
import type { VoiceRegistrationLocationValue } from "../types/voiceRegistration";
import type { ResolvedVoiceLocation, VoiceLocationExtractInput } from "./voiceLocationResolve";
import {
  resolveVoiceCityFromExtract,
  resolveVoiceLocationFromExtract,
} from "./voiceLocationResolve";

export function voiceLocationValueToInput(
  value: VoiceRegistrationLocationValue | undefined,
  transcript?: string,
): VoiceLocationExtractInput {
  return {
    il: value?.il,
    ilce: value?.ilce,
    mahalle: value?.mahalle,
    city_id: value?.city_id,
    town_id: value?.town_id,
    quarter_id: value?.quarter_id,
    tkgm_value: value?.tkgm_value,
    proparcel_value: value?.proparcel_value,
    transcript,
  };
}

export async function resolveVoiceLocationFromApiValue(
  value: unknown,
  transcript?: string,
): Promise<{ ok: true; location: ResolvedVoiceLocation } | { ok: false; error: string }> {
  const input = voiceLocationValueToInput(value as VoiceRegistrationLocationValue | undefined, transcript);
  return resolveVoiceLocationFromExtract(input);
}

export function applyExpertiseQuarterFromLocation(
  current: RegistrationExpertiseValue,
  location: ResolvedVoiceLocation,
):
  | { ok: true; value: RegistrationExpertiseValue; summary: string }
  | { ok: false; error: string } {
  const qvRaw = location.quarter.Proparcel_value;
  const qv = qvRaw === null || qvRaw === undefined || qvRaw === "" ? NaN : Number(qvRaw);
  if (!Number.isFinite(qv)) {
    return { ok: false, error: "Mahalle kodu bulunamadı." };
  }
  if (current.quarters.some((item) => item.quarter_value === qv)) {
    return { ok: false, error: "Bu mahalle zaten listede." };
  }
  if (current.quarters.length >= 5) {
    return { ok: false, error: "En fazla 5 mahalle seçebilirsiniz." };
  }

  const label =
    location.quarterName ||
    location.quarter.Proparcel_text ||
    location.quarter.Tkgm_text ||
    "";
  const summary = [location.cityName, location.townName, location.quarterName]
    .filter(Boolean)
    .join(" / ");

  return {
    ok: true,
    summary,
    value: {
      ...current,
      quarters: [...current.quarters, { quarter_value: qv, label }],
    },
  };
}

export function applyExpertiseCityFromVoice(
  current: RegistrationExpertiseValue,
  cityId: number,
  cityName: string,
):
  | { ok: true; value: RegistrationExpertiseValue; summary: string }
  | { ok: false; error: string } {
  if (current.cities.some((item) => item.city_id === cityId)) {
    return { ok: false, error: "Bu il zaten listede." };
  }
  if (current.cities.length >= 5) {
    return { ok: false, error: "En fazla 5 il seçebilirsiniz." };
  }

  return {
    ok: true,
    summary: cityName,
    value: {
      ...current,
      cities: [...current.cities, { city_id: cityId, label: cityName }],
    },
  };
}

export async function resolveExpertiseTargetFromApiValue(
  mode: "quarters" | "cities",
  value: unknown,
  transcript?: string,
):
  | { ok: true; kind: "quarter"; location: ResolvedVoiceLocation }
  | { ok: true; kind: "city"; cityId: number; cityName: string }
  | { ok: false; error: string } {
  const input = voiceLocationValueToInput(value as VoiceRegistrationLocationValue | undefined, transcript);

  if (mode === "quarters") {
    const locResult = await resolveVoiceLocationFromExtract(input);
    if (!locResult.ok) return locResult;
    return { ok: true, kind: "quarter", location: locResult.location };
  }

  const cityResult = await resolveVoiceCityFromExtract(input);
  if (!cityResult.ok) return cityResult;
  return {
    ok: true,
    kind: "city",
    cityId: cityResult.cityId,
    cityName: cityResult.cityName,
  };
}
