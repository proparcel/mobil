import { Platform, type TextStyle } from "react-native";

/** Açık arka plan üzerinde okunaklı metin — DayNight temada beyaz nokta sorununu önler. */
export const INPUT_TEXT_COLOR = "#1e293b";
export const INPUT_SELECTION_COLOR = "#1a73e8";

export const securePasswordInputStyle: TextStyle = {
  color: INPUT_TEXT_COLOR,
};

/** secureTextEntry alanlarına eklenecek ortak prop'lar (Realme/Samsung koyu mod uyumu). */
export const securePasswordInputProps = {
  autoCapitalize: "none" as const,
  autoCorrect: false,
  selectionColor: INPUT_SELECTION_COLOR,
  underlineColorAndroid: "transparent" as const,
  ...(Platform.OS === "android" ? { color: INPUT_TEXT_COLOR } : {}),
};
