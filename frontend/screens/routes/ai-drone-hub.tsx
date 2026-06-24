/**
 * AI Drone giriş — Basit Video (kendi editörünüz) veya ProParcel yapsın.
 */

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { MobileAiScreenShell } from "../../components/app/MobileAiScreenHeader";
import { AI_DRONE_EDITOR_THEME } from "../../src/constants/aiDroneEditorTheme";
import { useRouter } from "../../src/hooks/useNavigation";

export default function AiDroneHubScreen() {
  const router = useRouter();

  return (
    <MobileAiScreenShell title="AI Drone Video" onBack={() => router.back()} pageBackgroundColor="#f8fafc">
      <View style={styles.body}>
        <Text style={styles.lead}>
          Parsel tanıtım videosu için yöntem seçin. Basit modda kendiniz düzenlersiniz; ProParcel modunda uzman editör üretir.
        </Text>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => router.push("ai-drone-simple-editor")}
        >
          <View style={[styles.iconWrap, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
            <Ionicons name="phone-portrait-outline" size={28} color={AI_DRONE_EDITOR_THEME.primaryBright} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Pratik Video</Text>
            <Text style={styles.cardDesc}>
              Dikey video, seslendirme ve müzik. Parsel sorgusu ile haritadan kareler, hızlı üretim.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={AI_DRONE_EDITOR_THEME.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => router.push("ai-drone-video-info")}
        >
          <View style={[styles.iconWrap, { backgroundColor: "rgba(26, 95, 180, 0.12)" }]}>
            <Ionicons name="people-outline" size={28} color={AI_DRONE_EDITOR_THEME.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>ProParcel Yapsın</Text>
            <Text style={styles.cardDesc}>
              Uzman editör ekibimiz parseliniz için profesyonel drone videosu hazırlar.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={AI_DRONE_EDITOR_THEME.muted} />
        </TouchableOpacity>
      </View>
    </MobileAiScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 20, gap: 16 },
  lead: {
    fontSize: 14,
    lineHeight: 21,
    color: AI_DRONE_EDITOR_THEME.muted,
    marginBottom: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: AI_DRONE_EDITOR_THEME.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: AI_DRONE_EDITOR_THEME.border,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: AI_DRONE_EDITOR_THEME.text },
  cardDesc: { fontSize: 13, lineHeight: 19, color: AI_DRONE_EDITOR_THEME.muted },
});
