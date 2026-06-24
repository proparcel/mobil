import { MOBILE_DRONE_RUNWAY_CLIENT_SOURCE } from "../src/constants/aiDroneProductionPipeline";

/** true → OpenAI referans canlandırma; false → JPEG doğrudan Runway */
export function openAiPreflightPrepJsonFields(useOpenAiPreflight: boolean): Record<string, unknown> {
  if (useOpenAiPreflight) {
    return {
      skip_openai_preflight: false,
      use_openai_preflight: true,
      source: MOBILE_DRONE_RUNWAY_CLIENT_SOURCE,
    };
  }
  return {
    skip_openai_preflight: true,
    source: MOBILE_DRONE_RUNWAY_CLIENT_SOURCE,
  };
}

export function appendOpenAiPreflightFormFields(form: FormData, useOpenAiPreflight: boolean): void {
  if (useOpenAiPreflight) {
    form.append("skip_openai_preflight", "0");
    form.append("use_openai_preflight", "1");
  } else {
    form.append("skip_openai_preflight", "1");
  }
  form.append("source", MOBILE_DRONE_RUNWAY_CLIENT_SOURCE);
}
