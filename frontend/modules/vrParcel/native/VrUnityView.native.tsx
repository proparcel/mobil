import React from "react";
import {
  requireNativeComponent,
  View,
  Text,
  StyleSheet,
  Platform,
  type ViewStyle,
  type NativeSyntheticEvent,
} from "react-native";

type NativeProps = {
  style?: ViewStyle;
  sessionJson?: string;
  onTouchCapture?: (event: NativeSyntheticEvent<{ x: number; y: number }>) => void;
};

const NativeVrUnityView =
  Platform.OS === "ios" || Platform.OS === "android"
    ? requireNativeComponent<NativeProps>("VrUnityView")
    : null;

type Props = {
  payloadJson: string;
  style?: ViewStyle;
  onScreenTap?: (x: number, y: number) => void;
};

export function VrUnityView({ payloadJson, style, onScreenTap }: Props): React.ReactElement {
  if (NativeVrUnityView) {
    return (
      <NativeVrUnityView
        style={style}
        sessionJson={payloadJson}
      />
    );
  }

  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.title}>Unity AR View</Text>
      <Text style={styles.sub}>
        Native VrUnityView yalnızca UnityFramework embed edilmiş iOS build'de aktif olur.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { color: "#f8fafc", fontSize: 16, fontWeight: "700" },
  sub: { color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 18 },
});

export default VrUnityView;
