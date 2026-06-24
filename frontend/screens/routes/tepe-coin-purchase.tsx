/**
 * Platforma göre ödeme checkout — iOS: Apple IAP, Android: Google Play.
 */

import React from "react";
import { Platform, Text, View, StyleSheet } from "react-native";
import BillingCheckoutIosScreen from "./billing-checkout-ios";
import BillingCheckoutAndroidScreen from "./billing-checkout-android";

export default function TepeCoinPurchaseScreen(props: Record<string, unknown>) {
  if (Platform.OS === "ios") {
    return <BillingCheckoutIosScreen {...props} />;
  }
  if (Platform.OS === "android") {
    return <BillingCheckoutAndroidScreen {...props} />;
  }
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>Uygulama içi ödeme bu platformda desteklenmiyor.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  fallbackText: { color: "#64748b", fontSize: 15, textAlign: "center" },
});
