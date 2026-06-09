import type { VrParcelSource } from "../types/vrParcelSource";

let lastParcel: VrParcelSource | null = null;
let lastSelectedParcel: VrParcelSource | null = null;

export function setLastParcelForVr(parcel: VrParcelSource | null): void {
  lastParcel = parcel;
}

export function setSelectedParcelForVr(parcel: VrParcelSource | null): void {
  lastSelectedParcel = parcel;
}

/**
 * Basit mod çözümlemesi: seçili varsa seçili, yoksa son eklenen.
 */
export function getEffectiveParcelForVr(): VrParcelSource | null {
  if (lastSelectedParcel?.geometry) return lastSelectedParcel;
  if (lastParcel?.geometry) return lastParcel;
  return null;
}

export function clearVrParcelStore(): void {
  lastParcel = null;
  lastSelectedParcel = null;
}
