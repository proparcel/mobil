import type { VrParcelSource } from "../types/vrParcelSource";
import { setLastParcelForVr, setSelectedParcelForVr } from "../store/lastParcelStore";

/** Basit sorgu sonrası son parseli VR store'a yazar. */
export function syncLastParcelForVr(parcel: VrParcelSource): void {
  if (!parcel?.geometry) return;
  setLastParcelForVr(parcel);
}

/** Kullanıcı haritadan parsel seçtiğinde. */
export function syncSelectedParcelForVr(parcel: VrParcelSource | null): void {
  setSelectedParcelForVr(parcel);
}
