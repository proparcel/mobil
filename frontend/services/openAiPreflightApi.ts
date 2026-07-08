import { MOBILE_DRONE_RUNWAY_CLIENT_SOURCE } from "../src/constants/aiDroneProductionPipeline";

/** true → OpenAI referans canlandırma; false → JPEG doğrudan Runway */
export function openAiPreflightPrepJsonFields(
  useOpenAiPreflight: boolean,
  clientSource: string = MOBILE_DRONE_RUNWAY_CLIENT_SOURCE,
): Record<string, unknown> {
  const source = String(clientSource || MOBILE_DRONE_RUNWAY_CLIENT_SOURCE).trim();
  if (useOpenAiPreflight) {
    return {
      skip_openai_preflight: false,
      use_openai_preflight: true,
      source,
    };
  }
  return {
    skip_openai_preflight: true,
    source,
  };
}

export function appendOpenAiPreflightFormFields(
  form: FormData,
  useOpenAiPreflight: boolean,
  clientSource: string = MOBILE_DRONE_RUNWAY_CLIENT_SOURCE,
): void {
  if (useOpenAiPreflight) {
    form.append("skip_openai_preflight", "0");
    form.append("use_openai_preflight", "1");
  } else {
    form.append("skip_openai_preflight", "1");
  }
  form.append("source", String(clientSource || MOBILE_DRONE_RUNWAY_CLIENT_SOURCE).trim());
}
