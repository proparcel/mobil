import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { ExpertRequestListItem } from "../../src/types/expertRequests";

type Props = {
  item: ExpertRequestListItem;
  mode: "mine" | "incoming";
  onPress?: () => void;
};

function fmtStatus(status: string): { label: string; bg: string; fg: string } {
  switch (status) {
    case "ANSWERED":
      return { label: "Yanıtlandı", bg: "rgba(34,197,94,0.12)", fg: "#16a34a" };
    case "EXPIRED_REFUNDED":
      return { label: "İade", bg: "rgba(148,163,184,0.18)", fg: "#64748b" };
    case "CANCELLED":
      return { label: "İptal", bg: "rgba(148,163,184,0.14)", fg: "#64748b" };
    case "IN_REVIEW":
      return { label: "İncelemede", bg: "rgba(148,163,184,0.16)", fg: "#475569" };
    case "PENDING":
    default:
      return { label: "Beklemede", bg: "rgba(148,163,184,0.16)", fg: "#475569" };
  }
}

export function ExpertRequestCard({ item, mode, onPress }: Props) {
  const person = mode === "incoming" ? (item.person as any) : (item.assignedExpert as any);
  const title = person?.fullName || (mode === "mine" ? "Uzman Bekleniyor" : item.requester?.fullName || "Kullanıcı");
  const company = person?.companyName || (mode === "mine" ? "Bölgendeki uzmanlar" : item.requester?.companyName) || "";
  const avatarUrl = person?.profilePhotoUrl || (mode === "incoming" ? item.requester?.profilePhotoUrl : null);

  const locText = useMemo(() => {
    const l = item.location || {};
    const parts = [l.cityName, l.districtName, l.neighborhoodName].filter(Boolean);
    const ap = [l.ada ? `Ada ${l.ada}` : null, l.parsel ? `Parsel ${l.parsel}` : null].filter(Boolean);
    const left = parts.length ? parts.join(" / ") : "-";
    const right = ap.length ? ap.join(" / ") : "";
    return right ? `${left} • ${right}` : left;
  }, [item.location]);

  const statusMeta = fmtStatus(item.status);
  const showExpert = !!person?.isExpert;
  const expertScore = person?.expertScoreCurrent ?? null;

  return (
    <TouchableOpacity style={[styles.card, item.unreadForMe && styles.cardUnread]} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={18} color="#94a3b8" />
            </View>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {title}
            </Text>
            {item.unreadForMe ? <View style={styles.newDot} /> : null}
          </View>
          {company ? (
            <Text style={styles.company} numberOfLines={1}>
              {company}
            </Text>
          ) : null}
        </View>

        <View style={styles.rightMeta}>
          {showExpert ? (
            <View style={styles.expertPill}>
              <Ionicons name="ribbon" size={14} color="#2563eb" />
              <Text style={styles.expertPillText} numberOfLines={1}>
                Uzman{expertScore != null ? ` • ${Number(expertScore)}` : ""}
              </Text>
            </View>
          ) : null}
          <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
            <Text style={[styles.statusText, { color: statusMeta.fg }]}>{statusMeta.label}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.snippet} numberOfLines={2}>
        {item.noteSnippet || "Uzman görüşü talebi"}
      </Text>

      <View style={styles.bottomRow}>
        <Ionicons name="location-outline" size={14} color="#64748b" />
        <Text style={styles.location} numberOfLines={1}>
          {locText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  cardUnread: {
    borderColor: "rgba(34,197,94,0.45)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarWrap: { width: 40, height: 40 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f1f5f9" },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: "#0f172a", fontWeight: "900", fontSize: 14, flex: 1, minWidth: 0 },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  company: { color: "#64748b", fontWeight: "700", fontSize: 12, marginTop: 2 },
  rightMeta: { alignItems: "flex-end", gap: 6 },
  expertPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(37,99,235,0.10)",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.18)",
    maxWidth: 150,
  },
  expertPillText: { color: "#1d4ed8", fontWeight: "900", fontSize: 11 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontWeight: "900", fontSize: 11 },
  snippet: { marginTop: 10, color: "#334155", fontWeight: "700", fontSize: 12, lineHeight: 16 },
  bottomRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  location: { color: "#64748b", fontWeight: "700", fontSize: 11, flex: 1, minWidth: 0 },
});

