import type { DroneMyVideoItem } from "../../services/droneRunwayStatusParser";
import type { DroneParcelQuery } from "../../services/aiDroneSimpleEditorService";

export type DroneProjectLocation = {
  city: string;
  district: string;
  mahalle: string;
  ada: string;
  parsel: string;
  cityId?: string;
  townId?: string;
  quarterId?: string;
  proparcelValue?: string;
  referenceId?: string;
};

export const DRONE_PROJECT_LOCATION_MISSING_LABEL = "Konum bilgisi eksik";

const KONUM_ZORUNLU_MESSAGE =
  "Konum bilgisi zorunludur. İl, ilçe, mahalle adı, ada ve parsel girin.";

function trim(value: unknown): string {
  return String(value ?? "").trim();
}

function isNumericToken(value: string): boolean {
  return Boolean(value) && /^\d+$/.test(value);
}

function parseReferenceParts(referenceId: string): { mahalle: string; ada: string; parsel: string } {
  const parts = trim(referenceId).split("_");
  return {
    mahalle: trim(parts[0]),
    ada: trim(parts[1]),
    parsel: trim(parts.slice(2).join("_")),
  };
}

function resolveMahalleName(src: Record<string, unknown>): string {
  const preferred = trim(src.mahalle_name || src.quarter_name || src.quarter || src.runway_quarter);
  if (preferred && !isNumericToken(preferred)) return preferred;
  const rawMahalle = trim(src.mahalle);
  if (rawMahalle && !isNumericToken(rawMahalle)) return rawMahalle;
  return preferred || "";
}

export function locationFromParcelFields(input: {
  mahalleTkgmValue?: number | string;
  mahalle: string;
  ada: string;
  parsel: string;
  city?: string;
  town?: string;
  district?: string;
  cityId?: number | string;
  townId?: number | string;
  proparcelValue?: number | string;
}): DroneProjectLocation {
  return locationFromDroneParcelQuery({
    mahalleTkgmValue: Number(input.mahalleTkgmValue) || 0,
    mahalle: input.mahalle,
    ada: input.ada,
    parsel: input.parsel,
    city: input.city,
    town: input.town || input.district,
    cityId: input.cityId != null ? Number(input.cityId) : undefined,
    townId: input.townId != null ? Number(input.townId) : undefined,
    proparcelValue: input.proparcelValue != null ? Number(input.proparcelValue) : undefined,
  });
}

export function parseDroneProjectLocationParams(
  params: Record<string, string | undefined> | null | undefined,
): DroneProjectLocation | null {
  const src = params || {};
  const loc = {
    city: trim(src.city),
    district: trim(src.district),
    mahalle: trim(src.mahalle),
    ada: trim(src.ada),
    parsel: trim(src.parsel),
    cityId: trim(src.city_id || src.cityId) || undefined,
    townId: trim(src.town_id || src.townId) || undefined,
    quarterId: trim(src.quarter_id || src.quarterId) || undefined,
    proparcelValue: trim(src.proparcel_value || src.proparcelValue) || undefined,
    referenceId: trim(src.reference_id || src.referenceId) || undefined,
  };
  const validated = validateDroneProjectLocation(loc);
  return validated.ok ? validated.location : null;
}

export function droneProjectLocationRouteParams(
  loc: DroneProjectLocation,
): Record<string, string> {
  return {
    city: loc.city,
    district: loc.district,
    mahalle: loc.mahalle,
    ada: loc.ada,
    parsel: loc.parsel,
    display_name: buildDroneProjectDisplayName(loc),
  };
}

export function extractDroneProjectLocationFromVideoItem(
  item: Partial<DroneMyVideoItem> | null | undefined,
): DroneProjectLocation | null {
  if (!item) return null;
  const meta = (item.meta || {}) as Record<string, unknown>;
  return extractDroneProjectLocation(
    {
      ...meta,
      city: item.city ?? meta.city,
      district: item.district ?? meta.district,
      mahalle: item.mahalle ?? meta.mahalle,
      ada: item.ada ?? meta.ada,
      parsel: item.parsel ?? meta.parsel,
      reference_id: item.reference_id ?? meta.reference_id,
    },
    item.reference_id,
  );
}

export function buildDroneProjectDisplayName(
  loc: Pick<DroneProjectLocation, "mahalle" | "ada" | "parsel">,
): string {
  const mahalle = trim(loc.mahalle);
  const ada = trim(loc.ada);
  const parsel = trim(loc.parsel);
  if (!mahalle || !ada || !parsel) return "";
  return `${mahalle} · ada ${ada} / parsel ${parsel}`;
}

export function validateDroneProjectLocation(
  loc: DroneProjectLocation | null | undefined,
): { ok: true; location: DroneProjectLocation } | { ok: false; error: string } {
  if (!loc) return { ok: false, error: KONUM_ZORUNLU_MESSAGE };
  const normalized: DroneProjectLocation = {
    city: trim(loc.city),
    district: trim(loc.district),
    mahalle: trim(loc.mahalle),
    ada: trim(loc.ada) || "0",
    parsel: trim(loc.parsel),
    cityId: trim(loc.cityId) || undefined,
    townId: trim(loc.townId) || undefined,
    quarterId: trim(loc.quarterId) || undefined,
    proparcelValue: trim(loc.proparcelValue) || undefined,
    referenceId: trim(loc.referenceId) || undefined,
  };
  if (isNumericToken(normalized.mahalle)) {
    return { ok: false, error: KONUM_ZORUNLU_MESSAGE };
  }
  const missing: string[] = [];
  if (!normalized.city) missing.push("city");
  if (!normalized.district) missing.push("district");
  if (!normalized.mahalle) missing.push("mahalle");
  if (!normalized.ada) missing.push("ada");
  if (!normalized.parsel) missing.push("parsel");
  if (missing.length) return { ok: false, error: KONUM_ZORUNLU_MESSAGE };
  return { ok: true, location: normalized };
}

export function locationFromDroneParcelQuery(parcel: DroneParcelQuery): DroneProjectLocation {
  const mahalleName = trim(parcel.mahalle);
  const mahalleTkgm = Number(parcel.mahalleTkgmValue) || 0;
  const ada = trim(parcel.ada) || "0";
  const parsel = trim(parcel.parsel);
  const referenceId =
    mahalleTkgm > 0 && ada && parsel ? `${mahalleTkgm}_${ada}_${parsel}` : undefined;
  return {
    city: trim(parcel.city),
    district: trim(parcel.town),
    mahalle: isNumericToken(mahalleName) ? "" : mahalleName,
    ada,
    parsel,
    cityId: parcel.cityId != null ? String(parcel.cityId) : undefined,
    townId: parcel.townId != null ? String(parcel.townId) : undefined,
    proparcelValue: parcel.proparcelValue != null ? String(parcel.proparcelValue) : undefined,
    referenceId,
  };
}

export function extractDroneProjectLocation(
  source: Record<string, unknown> | null | undefined,
  referenceId?: string,
): DroneProjectLocation | null {
  const src = source && typeof source === "object" ? source : {};
  const ref = parseReferenceParts(referenceId || trim(src.reference_id));
  const mahalle = resolveMahalleName(src) || (isNumericToken(ref.mahalle) ? "" : ref.mahalle);
  const ada = trim(src.ada || ref.ada);
  const parsel = trim(src.parsel || ref.parsel);
  const city = trim(src.city || src.runway_city || src.il);
  const district = trim(src.district || src.runway_district || src.ilce);
  if (!city && !district && !mahalle && !ada && !parsel) return null;
  return {
    city,
    district,
    mahalle,
    ada: ada || "0",
    parsel,
    cityId: trim(src.city_id || src.cityId) || undefined,
    townId: trim(src.town_id || src.townId) || undefined,
    quarterId: trim(src.quarter_id || src.quarterId) || undefined,
    proparcelValue: trim(src.proparcel_value || src.proparcelValue) || undefined,
    referenceId: trim(referenceId || src.reference_id) || undefined,
  };
}

export function resolveDroneProjectDisplayName(item: Partial<DroneMyVideoItem> | null | undefined): string {
  if (!item) return DRONE_PROJECT_LOCATION_MISSING_LABEL;
  const displayName = trim(item.display_name);
  if (displayName) return displayName;

  const topLevel = extractDroneProjectLocation(
    {
      city: item.city,
      district: item.district,
      mahalle: item.mahalle,
      ada: item.ada,
      parsel: item.parsel,
      reference_id: item.reference_id,
    },
    item.reference_id,
  );
  const fromTop = topLevel ? buildDroneProjectDisplayName(topLevel) : "";
  if (fromTop) return fromTop;

  const meta = (item.meta || {}) as Record<string, unknown>;
  const fromMeta = extractDroneProjectLocation(meta, item.reference_id);
  const built = fromMeta ? buildDroneProjectDisplayName(fromMeta) : "";
  return built || DRONE_PROJECT_LOCATION_MISSING_LABEL;
}

export function resolveProjectId(item: Partial<DroneMyVideoItem> | null | undefined): string {
  return trim(item?.project_id || item?.job_id);
}

export function formatDroneProjectListLabel(
  item: Partial<DroneMyVideoItem>,
  dateSuffix?: string,
): string {
  const title = resolveDroneProjectDisplayName(item);
  const date = trim(dateSuffix);
  return date ? `${title} · ${date}` : title;
}

export function appendRunwayPrepLocationFields(
  target: Record<string, unknown>,
  loc: DroneProjectLocation,
): void {
  if (loc.city) target.city = loc.city.slice(0, 120);
  if (loc.district) target.district = loc.district.slice(0, 120);
  if (loc.mahalle) target.mahalle_name = loc.mahalle.slice(0, 120);
  if (loc.ada) target.ada = loc.ada.slice(0, 40);
  if (loc.parsel) target.parsel = loc.parsel.slice(0, 40);
  if (loc.cityId) target.city_id = loc.cityId;
  if (loc.townId) target.town_id = loc.townId;
  if (loc.quarterId) target.quarter_id = loc.quarterId;
  if (loc.proparcelValue) target.proparcel_value = loc.proparcelValue;
  if (loc.referenceId) target.reference_id = loc.referenceId.slice(0, 160);
}

export function appendRunwayPrepReuseFields(target: Record<string, unknown>, projectId: string): void {
  const id = trim(projectId);
  if (!id) return;
  target.reuse_job_id = id;
  target.project_id = id;
}

export function appendRunwayLocationFormFields(form: FormData, loc: DroneProjectLocation): void {
  if (loc.city) form.append("city", loc.city.slice(0, 120));
  if (loc.district) form.append("district", loc.district.slice(0, 120));
  if (loc.mahalle) {
    form.append("mahalle_name", loc.mahalle.slice(0, 120));
    form.append("runway_quarter", loc.mahalle.slice(0, 120));
  }
  if (loc.ada) form.append("ada", loc.ada.slice(0, 40));
  if (loc.parsel) form.append("parsel", loc.parsel.slice(0, 40));
  if (loc.cityId) form.append("city_id", loc.cityId);
  if (loc.townId) form.append("town_id", loc.townId);
  if (loc.quarterId) form.append("quarter_id", loc.quarterId);
  if (loc.proparcelValue) form.append("proparcel_value", loc.proparcelValue);
  if (loc.referenceId) form.append("reference_id", loc.referenceId.slice(0, 160));
}

export function appendRunwayReuseFormFields(form: FormData, projectId: string): void {
  const id = trim(projectId);
  if (!id) return;
  form.append("reuse_job_id", id);
  form.append("project_id", id);
}

export function userFacingKonumZorunluError(source?: unknown): string {
  if (typeof source === "string" && source === "konum_zorunlu") return KONUM_ZORUNLU_MESSAGE;
  if (!source || typeof source !== "object") return KONUM_ZORUNLU_MESSAGE;
  const row = source as Record<string, unknown>;
  if (trim(row.error) === "konum_zorunlu") return KONUM_ZORUNLU_MESSAGE;
  return KONUM_ZORUNLU_MESSAGE;
}

export function runwayPrepFailureMessage(
  error: unknown,
  fallback: string,
  status?: number,
  payload?: Record<string, unknown>,
): string {
  const token = trim(
    (typeof error === "string" ? error : null) ||
      payload?.error ||
      (error as { error?: unknown })?.error,
  );
  if (status === 400 && token === "konum_zorunlu") {
    return userFacingKonumZorunluError(payload || { error: token });
  }
  if (typeof error === "string" && error.trim()) return error.trim();
  if (typeof error === "object" && error) {
    const maybe = error as { message?: unknown; detail?: unknown; error?: unknown };
    if (typeof maybe.message === "string" && maybe.message.trim()) return maybe.message.trim();
    if (typeof maybe.detail === "string" && maybe.detail.trim()) return maybe.detail.trim();
    if (typeof maybe.error === "string" && maybe.error.trim()) return maybe.error.trim();
  }
  return fallback;
}

export type RunwayPrepStartResult = {
  jobId: string;
  projectId: string;
  displayName: string;
};

export function parseRunwayPrepResponse(data: Record<string, unknown>): RunwayPrepStartResult | null {
  const jobId = trim(data.job_id);
  if (!jobId) return null;
  const projectId = trim(data.project_id) || jobId;
  const displayName = trim(data.display_name);
  return { jobId, projectId, displayName };
}
