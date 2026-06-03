import React from "react";
import { Platform, StatusBar, type StatusBarProps } from "react-native";

/** Uygulama üst bar / Android sistem gezinti çubuğu rengi */
export const APP_CHROME_NAVY = "#1e293b";

/**
 * Android 15+ (targetSdk 35+): status bar arka plan rengi native API ile ayarlanamaz.
 * Android'de yalnızca ikon rengi (barStyle); arka plan SafeAreaView / container ile verilir.
 * Sistem gezinti çubuğu rengi: MainActivity + styles.xml (apply-android-native-fix).
 */
export function AppStatusBar({ barStyle = "light-content", ...rest }: StatusBarProps) {
  if (Platform.OS === "android") {
    return <StatusBar barStyle={barStyle} translucent={false} {...rest} />;
  }
  return <StatusBar barStyle={barStyle} backgroundColor={APP_CHROME_NAVY} {...rest} />;
}
