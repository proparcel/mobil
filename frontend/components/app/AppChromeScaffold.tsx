import React from "react";
import { Platform, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_CHROME_NAVY } from "./AppStatusBar";

type Props = {
  children: React.ReactNode;
};

/**
 * Android: edge-to-edge acik olsa bile alt sistem cubugu alanini lacivert boyar.
 */
export function AppChromeScaffold({ children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      {Platform.OS === "android" && insets.bottom > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.bottomScrim, { height: insets.bottom }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_CHROME_NAVY,
  },
  content: {
    flex: 1,
  },
  bottomScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: APP_CHROME_NAVY,
  },
});
