import type { Parcel3dEntry } from "./parcel3dPurchasedStorage";
import { resolveMahalleTkgmFromLocationsLabel } from "./resolveMahalleTkgmFromLocations";

/** Sunucu `parse_3d_design_reference_id` ile aynı (rsplit _, 2). */
export function parse3dDesignReferenceId(
  referenceId: string
): { mahalle: string; ada: string; parsel: string } | null {
  const s = String(referenceId ?? "").trim();
  const i1 = s.lastIndexOf("_");
  if (i1 <= 0) return null;
  const i2 = s.lastIndexOf("_", i1 - 1);
  if (i2 <= 0) return null;
  return {
    mahalle: s.slice(0, i2),
    ada: s.slice(i2 + 1, i1),
    parsel: s.slice(i1 + 1),
  };
}

function tryNumericTkgm(value: string | undefined | null): number | null {
  const s = String(value ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function tryDescriptionTkgm(description?: string | null): number | null {
  if (!description?.trim()) return null;
  try {
    const desc = JSON.parse(description);
    if (!desc || typeof desc !== "object") return null;
    for (const key of ["mahalleTkgm", "mahalle_tkgm", "mahalleTkgmValue", "tkgm_value"]) {
      const v = (desc as Record<string, unknown>)[key];
      const n = tryNumericTkgm(v != null ? String(v) : null);
      if (n != null) return n;
    }
  } catch {
    /* düz metin */
  }
  return null;
}

/**
 * 3D Tasarımlarım satırından TKGM mahalle kodu (veya proparcel yedeği için null + entry.proparcelValue).
 */
export function resolveTkgmFor3dDesignOpen(entry: Parcel3dEntry): {
  mahalleTkgmValue: number | null;
  proparcelValue: number | null;
} {
  let mahalleTkgmValue: number | null =
    entry.mahalleTkgmValue != null && Number.isFinite(Number(entry.mahalleTkgmValue))
      ? Number(entry.mahalleTkgmValue)
      : null;
  let proparcelValue: number | null =
    entry.proparcelValue != null && Number.isFinite(Number(entry.proparcelValue))
      ? Number(entry.proparcelValue)
      : null;

  if (mahalleTkgmValue != null) {
    return { mahalleTkgmValue, proparcelValue };
  }

  const fromDesc = tryDescriptionTkgm(entry.description);
  if (fromDesc != null) mahalleTkgmValue = fromDesc;

  const candidates: string[] = [];
  if (entry.mahalle?.trim()) candidates.push(entry.mahalle.trim());
  if (entry.referenceId?.trim()) {
    const parsed = parse3dDesignReferenceId(entry.referenceId);
    if (parsed?.mahalle?.trim()) candidates.push(parsed.mahalle.trim());
  }

  for (const label of candidates) {
    const num = tryNumericTkgm(label);
    if (num != null) {
      mahalleTkgmValue = num;
      break;
    }
    const fromLabel = resolveMahalleTkgmFromLocationsLabel(label);
    if (fromLabel != null) {
      mahalleTkgmValue = fromLabel;
      break;
    }
  }

  return { mahalleTkgmValue, proparcelValue };
}
