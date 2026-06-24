import { MOBILE_DRONE_RUNWAY_CLIENT_SOURCE } from "../src/constants/aiDroneProductionPipeline";

/** Mobil basit drone editör — dikey referans hedef boyutu (9:16). */
export const RUNWAY_PORTRAIT_REF_WIDTH = 720;
export const RUNWAY_PORTRAIT_REF_HEIGHT = 1280;

export const RUNWAY_PORTRAIT_ORIENTATION = "portrait";

/** Prep JSON + production FormData için sabit portrait istemci alanları. */
export function runwayPortraitClientJsonFields(): Record<string, unknown> {
  return {
    orientation: RUNWAY_PORTRAIT_ORIENTATION,
    refs_client_presized: true,
    source: MOBILE_DRONE_RUNWAY_CLIENT_SOURCE,
  };
}

export function appendRunwayPortraitClientFormFields(form: FormData): void {
  form.append("orientation", RUNWAY_PORTRAIT_ORIENTATION);
  form.append("refs_client_presized", "1");
  form.append("source", MOBILE_DRONE_RUNWAY_CLIENT_SOURCE);
}
