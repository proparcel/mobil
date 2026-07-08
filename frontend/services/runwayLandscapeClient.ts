import { MOBILE_AI_VIDEO_NEW_CLIENT_SOURCE } from "../src/constants/aiDroneProductionPipeline";

/** Mobil AI Video editör — yatay referans hedef boyutu (16:9, backend 1280:768). */
export const RUNWAY_LANDSCAPE_REF_WIDTH = 1280;
export const RUNWAY_LANDSCAPE_REF_HEIGHT = 768;

export const RUNWAY_LANDSCAPE_ORIENTATION = "landscape";

/** Prep JSON + production FormData için sabit landscape istemci alanları. */
export function runwayLandscapeClientJsonFields(
  opts?: { refsClientPresized?: boolean },
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    orientation: RUNWAY_LANDSCAPE_ORIENTATION,
    source: MOBILE_AI_VIDEO_NEW_CLIENT_SOURCE,
  };
  if (opts?.refsClientPresized) {
    fields.refs_client_presized = true;
  }
  return fields;
}

export function appendRunwayLandscapeClientFormFields(
  form: FormData,
  opts?: { refsClientPresized?: boolean },
): void {
  form.append("orientation", RUNWAY_LANDSCAPE_ORIENTATION);
  form.append("source", MOBILE_AI_VIDEO_NEW_CLIENT_SOURCE);
  if (opts?.refsClientPresized) {
    form.append("refs_client_presized", "1");
  }
}
