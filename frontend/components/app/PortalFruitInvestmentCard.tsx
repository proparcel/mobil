/**
 * Web `DetailFruitInvestmentTab.jsx` ile aynı içerik.
 */

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { PortalFruitAnalysis } from "../../src/types/portal";

const EMPTY_MESSAGES: Record<string, string> = {
  no_saved_query:
    "Bu sorgu kayıtlı bir Pro sorgu kaydına bağlı değil; meyve yatırım skoru bu ekranda gösterilemiyor.",
  not_analyzed:
    "Meyve skoru şu an üretilemedi (sunucu veya veri kaynağı). Bir süre sonra yeniden deneyin.",
  not_applicable:
    "Bu sorgu tipi için meyve bahçesi skoru uygulanmaz; yalnızca arazi tarafı sorgularda gösterilir.",
};

function formatScore(n: unknown): string {
  const num = Number(n);
  if (n === null || n === undefined || !Number.isFinite(num)) return "—";
  return String(Math.round(num));
}

type Props = {
  loading: boolean;
  analysis: PortalFruitAnalysis | null;
  emptyReason: string | null;
  fetchError: string | null;
};

export default function PortalFruitInvestmentCard({ loading, analysis, emptyReason, fetchError }: Props) {
  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Meyve Bahçesi Skoru</Text>
        <Text style={styles.subtitle}>İklim zonu ve parsel uygunluğuna göre meyve türü önerileri.</Text>
        <ActivityIndicator color="#15803d" style={{ marginTop: 12 }} />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Meyve Bahçesi Skoru</Text>
        <Text style={styles.err}>{fetchError}</Text>
      </View>
    );
  }

  if (emptyReason && !analysis) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Meyve Bahçesi Skoru</Text>
        <Text style={styles.subtitle}>İklim zonu ve parsel uygunluğuna göre meyve türü önerileri.</Text>
        <Text style={styles.muted}>{EMPTY_MESSAGES[emptyReason] || "Veri yok."}</Text>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Meyve Bahçesi Skoru</Text>
        <Text style={styles.muted}>Veri yok.</Text>
      </View>
    );
  }

  const best = analysis.bestFruit;
  const rows = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.title}>Meyve Bahçesi Skoru</Text>
        <Text style={styles.subtitle}>
          Parsel konumu ve iklim zonuna göre en uygun meyve türleri (0–100 uygunluk skoru).
        </Text>
        <View style={styles.highlight}>
          <Text style={styles.highlightLabel}>Öne çıkan tür</Text>
          <Text style={styles.highlightName}>{best?.name || "—"}</Text>
          <Text style={styles.highlightScore}>{formatScore(best?.score)}</Text>
        </View>
        <View style={styles.metaGrid}>
          <MetaItem label="İklim zonu" value={analysis.zone || "—"} />
          <MetaItem label="İl (özet)" value={analysis.city || "—"} />
          <MetaItem
            label="Ada / Parsel"
            value={[analysis.ada, analysis.parsel].filter(Boolean).join(" / ") || "—"}
          />
          <MetaItem label="Sürüm" value={analysis.analysisVersion || "—"} />
        </View>
      </View>

      {rows.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Öneriler</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.thRank]}>#</Text>
            <Text style={[styles.th, styles.thName]}>Meyve türü</Text>
            <Text style={[styles.th, styles.thScore]}>Skor</Text>
          </View>
          {rows.map((row, idx) => (
            <View style={styles.tableRow} key={`${row?.name}-${idx}`}>
              <Text style={[styles.td, styles.thRank]}>{idx + 1}</Text>
              <Text style={[styles.td, styles.thName]}>{row?.name || "—"}</Text>
              <Text style={[styles.td, styles.thScore]}>{formatScore(row?.score)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.muted}>Öneri listesi boş.</Text>
        </View>
      )}
    </View>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 12, lineHeight: 18 },
  muted: { fontSize: 14, color: "#64748b", marginTop: 8 },
  err: { fontSize: 14, color: "#b91c1c", marginTop: 8 },
  highlight: {
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#86efac",
  },
  highlightLabel: { fontSize: 12, color: "#15803d", fontWeight: "600" },
  highlightName: { fontSize: 20, fontWeight: "800", color: "#14532d", marginTop: 4 },
  highlightScore: { fontSize: 28, fontWeight: "800", color: "#15803d", marginTop: 4 },
  metaGrid: { gap: 8 },
  metaItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  metaLabel: { fontSize: 13, color: "#64748b" },
  metaValue: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#334155", marginBottom: 10 },
  tableHead: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#f1f5f9" },
  th: { fontSize: 12, fontWeight: "700", color: "#64748b" },
  td: { fontSize: 14, color: "#0f172a" },
  thRank: { width: 28 },
  thName: { flex: 1 },
  thScore: { width: 48, textAlign: "right" },
});
