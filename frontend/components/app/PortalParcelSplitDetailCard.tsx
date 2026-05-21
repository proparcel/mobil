/**
 * Web `DetailSplitTab.jsx` ile aynı içerik — bölünebilirlik analizi (imarlı / imarsız tarım).
 */

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const SPLIT_REGIME_LABELS: Record<string, string> = {
  koy_ici: "Köy içi",
  normal_imar: "Normal imar",
  bitisik_nizam: "Bitişik nizam",
};

const SPLIT_RULE_SOURCE_LABELS: Record<string, string> = {
  global: "Genel",
  location_override: "Mahalle planı",
  imarsiz_tarim_criteria: "İmarsız tarım kriterleri",
};

function formatValue(value: unknown, suffix = ""): string {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) {
    return "—";
  }
  return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(n)}${suffix}`;
}

function formatSplitLabel(value: unknown, mapping: Record<string, string> = {}): string {
  if (value === null || value === undefined || value === "") return "—";
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, "_");
  return mapping[normalized] || String(value);
}

type InfoRow = { label: string; value: string };

function InfoRows({ rows }: { rows: InfoRow[] }) {
  const filtered = rows.filter((r) => r.value !== "—" && r.value !== "");
  if (!filtered.length) {
    return <Text style={styles.muted}>Gösterilecek veri yok.</Text>;
  }
  return (
    <View style={styles.infoCard}>
      {filtered.map((row) => (
        <View style={styles.infoRow} key={row.label}>
          <Text style={styles.infoLabel}>{row.label}</Text>
          <Text style={styles.infoValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ImarsizTarimLegalNotice() {
  return (
    <View style={styles.legalBox}>
      <Text style={styles.legalTitle}>
        Tarım arazilerinde (tarla) bölünme / ifraz işlemleri hakkında bilgilendirme
      </Text>
      <Text style={styles.legalBody}>
        Türkiye'de tarım arazilerinin bölünmesi (ifraz işlemleri), 5403 sayılı Toprak Koruma ve Arazi Kullanımı
        Kanunu kapsamında yürütülmekte olup, bu işlemler serbestçe yapılamaz ve belirli kurumların onayına tabidir.
      </Text>
      <Text style={styles.legalSubtitle}>1. İl / İlçe Tarım ve Orman Müdürlüğü (ana yetkili kurum)</Text>
      <Text style={styles.legalBody}>
        Tarım arazilerinin bölünmesi için en kritik ve zorunlu onay bu kurumdan alınır. Başvuru değerlendirilirken
        minimum parsel büyüklüğü, tarımsal bütünlük ve bölünme sonrası ekonomik kullanılabilirlik incelenir. Bu kurumdan
        uygun görüş alınmadan ifraz işlemi yapılamaz.
      </Text>
    </View>
  );
}

type SplitReason = {
  code?: string;
  label?: string;
  status?: string;
  message?: string;
  actual?: unknown;
  required?: unknown;
};

function ReasonList({ reasons }: { reasons: SplitReason[] }) {
  if (!Array.isArray(reasons) || !reasons.length) {
    return <Text style={styles.muted}>Gerekçe bulunamadı.</Text>;
  }
  return (
    <View style={styles.reasonList}>
      {reasons.map((reason, index) => {
        const status = reason.status || "warn";
        const statusLabel =
          status === "pass" ? "Uygun" : status === "fail" ? "Uygun Değil" : "Kontrol Gerekli";
        const statusStyle =
          status === "pass" ? styles.reasonPass : status === "fail" ? styles.reasonFail : styles.reasonWarn;
        return (
          <View style={[styles.reasonCard, statusStyle]} key={`${reason.code || "reason"}-${index}`}>
            <View style={styles.reasonTop}>
              <Text style={styles.reasonLabel}>{reason.label || "Kural"}</Text>
              <Text style={styles.reasonStatus}>{statusLabel}</Text>
            </View>
            <Text style={styles.reasonMessage}>{reason.message || "Açıklama yok."}</Text>
            {(reason.actual != null || reason.required != null) && (
              <View style={styles.reasonMeta}>
                {reason.actual != null ? <Text style={styles.reasonMetaLine}>Mevcut: {String(reason.actual)}</Text> : null}
                {reason.required != null ? (
                  <Text style={styles.reasonMetaLine}>Gerekli: {String(reason.required)}</Text>
                ) : null}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

type Props = {
  loading: boolean;
  analysis: Record<string, unknown> | null;
  fetchError: string | null;
};

export default function PortalParcelSplitDetailCard({ loading, analysis, fetchError }: Props) {
  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Bölünebilirlik</Text>
        <Text style={styles.subtitle}>
          Bu veriler kesinlik içermez; genel kurallara göre hazırlanmıştır. Kesin bilgi için ilgili kurumlara başvurunuz.
        </Text>
        <ActivityIndicator color="#1d4ed8" style={{ marginTop: 12 }} />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Bölünebilirlik</Text>
        <Text style={styles.err}>{fetchError}</Text>
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Bölünebilirlik</Text>
        <Text style={styles.muted}>Bölünebilirlik analizi bulunamadı.</Text>
      </View>
    );
  }

  const usedMetrics = (analysis.used_metrics as Record<string, unknown>) || {};
  const appliedRule = (analysis.applied_rule as Record<string, unknown>) || {};
  const isImarsizTarim = analysis.split_mode === "imarsiz_tarim";
  const imarsizCategories = Array.isArray(analysis.imarsiz_tarim_categories)
    ? (analysis.imarsiz_tarim_categories as Record<string, unknown>[])
    : [];

  const heroRows: InfoRow[] = isImarsizTarim
    ? [
        { label: "Durum", value: String(analysis.status_label || "—") },
        {
          label: "Parsel alanı",
          value: usedMetrics.area_m2 != null ? formatValue(usedMetrics.area_m2, " m²") : "—",
        },
        { label: "Uygun kriter", value: `${analysis.eligible_criteria_count ?? 0} / 3` },
        { label: "Kural kaynağı", value: formatSplitLabel(analysis.rule_source, SPLIT_RULE_SOURCE_LABELS) },
      ]
    : [
        { label: "Durum", value: String(analysis.status_label || "—") },
        { label: "Rejim", value: formatSplitLabel(analysis.regime_type, SPLIT_REGIME_LABELS) },
        { label: "Kural kaynağı", value: formatSplitLabel(analysis.rule_source, SPLIT_RULE_SOURCE_LABELS) },
        { label: "Tahmini Yeni Parsel", value: String(analysis.estimated_max_new_parcels ?? "—") },
      ];

  const metricRows: InfoRow[] = [
    { label: "Alan", value: usedMetrics.area_m2 != null ? formatValue(usedMetrics.area_m2, " m²") : "—" },
    {
      label: "BBox Uzun Kenar",
      value: usedMetrics.bbox_long_edge_m != null ? formatValue(usedMetrics.bbox_long_edge_m, " m") : "—",
    },
    {
      label: "BBox Kısa Kenar",
      value: usedMetrics.bbox_short_edge_m != null ? formatValue(usedMetrics.bbox_short_edge_m, " m") : "—",
    },
    { label: "Cephe Sayısı", value: String(usedMetrics.frontage_count ?? "—") },
    {
      label: "Yol Bağlantısı",
      value:
        usedMetrics.has_road_connection == null
          ? "—"
          : usedMetrics.has_road_connection
            ? "Var"
            : "Yok",
    },
  ];

  const ruleRows: InfoRow[] = [
    {
      label: "Min. Cephe",
      value: appliedRule.min_frontage_m != null ? formatValue(appliedRule.min_frontage_m, " m") : "—",
    },
    {
      label: "Min. Derinlik",
      value: appliedRule.min_depth_m != null ? formatValue(appliedRule.min_depth_m, " m") : "—",
    },
    {
      label: "Min. Parsel Alanı",
      value: appliedRule.min_parcel_area_m2 != null ? formatValue(appliedRule.min_parcel_area_m2, " m²") : "—",
    },
    { label: "Maks. Yeni Parsel", value: String(appliedRule.max_new_parcels ?? "—") },
    {
      label: "Kamu Yoluna Cephe",
      value:
        appliedRule.requires_public_road_frontage == null
          ? "—"
          : appliedRule.requires_public_road_frontage
            ? "Zorunlu"
            : "Hayır",
    },
    {
      label: "İkinci İfraz",
      value:
        appliedRule.prohibits_secondary_split == null
          ? "—"
          : appliedRule.prohibits_secondary_split
            ? "Yasak"
            : "Serbest / Belirtilmedi",
    },
  ];

  const sectionSubtitle = isImarsizTarim
    ? "İmarsız tarım arazilerinde üç bağımsız kriter değerlendirilir; hangi kriter için toplam alan yeterliyse o kart uygun görünür."
    : "Bu veriler kesinlik içermez; genel kurallara göre hazırlanmıştır. Kesin bilgi için ilgili kurumlara başvurunuz.";

  const note = String(analysis.divisible_note || analysis.explanation || "Açıklama yok.");
  const reasons = Array.isArray(analysis.reasons) ? (analysis.reasons as SplitReason[]) : [];

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.title}>Bölünebilirlik</Text>
        <Text style={styles.subtitleWarning}>{sectionSubtitle}</Text>
        <View style={styles.heroGrid}>
          {heroRows.map((item) => (
            <View style={styles.heroMetric} key={item.label}>
              <Text style={styles.heroMetricLabel}>{item.label}</Text>
              <Text style={styles.heroMetricValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {isImarsizTarim ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>İmarsız tarım kriterleri</Text>
          <Text style={styles.intro}>
            Her satır bağımsızdır. Toplam alan, o kriterdeki asgari parsel büyüklüğüne göre en az iki parsel üretmeye
            yetiyorsa kart uygun sayılır.
          </Text>
          <View style={styles.tarimGrid}>
            {imarsizCategories.map((row) => {
              const eligible = !!row.eligible;
              return (
                <View
                  style={[styles.tarimCard, eligible && styles.tarimCardEligible]}
                  key={String(row.id ?? row.title)}
                >
                  <View style={styles.tarimHead}>
                    {row.emoji ? <Text style={styles.tarimEmoji}>{String(row.emoji)}</Text> : null}
                    <Text style={styles.tarimTitle}>{String(row.title || "—")}</Text>
                  </View>
                  <Text style={[styles.tarimOk, eligible ? styles.tarimOkYes : styles.tarimOkNo]}>
                    {eligible ? "Uygun" : "Uygun değil"}
                  </Text>
                  <Text style={styles.tarimMeta}>
                    Asgari parça:{" "}
                    {row.min_m2_per_piece != null ? formatValue(row.min_m2_per_piece, " m²") : "—"}
                    {row.max_pieces_if_split != null ? ` · Tahmini en fazla parça: ${row.max_pieces_if_split}` : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.callout}>
          <Text style={styles.calloutText}>{note}</Text>
        </View>
      </View>

      {isImarsizTarim ? (
        <View style={styles.card}>
          <ImarsizTarimLegalNotice />
        </View>
      ) : null}

      {!isImarsizTarim ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Kullanılan Ölçüler</Text>
            <InfoRows rows={metricRows} />
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Uygulanan Kural</Text>
            <InfoRows rows={ruleRows} />
          </View>
        </>
      ) : null}

      {!isImarsizTarim && reasons.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gerekçeler</Text>
          <ReasonList reasons={reasons} />
        </View>
      ) : null}
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
  subtitleWarning: { fontSize: 13, color: "#b45309", marginTop: 6, marginBottom: 12, lineHeight: 18 },
  muted: { fontSize: 14, color: "#64748b", marginTop: 8 },
  err: { fontSize: 14, color: "#b91c1c", marginTop: 8 },
  heroGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heroMetric: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heroMetricLabel: { fontSize: 12, color: "#64748b" },
  heroMetricValue: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#334155", marginBottom: 10 },
  intro: { fontSize: 13, color: "#64748b", marginBottom: 12, lineHeight: 18 },
  callout: {
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
  },
  calloutText: { fontSize: 14, color: "#1e3a8a", lineHeight: 20 },
  infoCard: { gap: 8 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  infoLabel: { fontSize: 13, color: "#64748b", flex: 1 },
  infoValue: { fontSize: 14, fontWeight: "600", color: "#0f172a", flex: 1, textAlign: "right" },
  tarimGrid: { gap: 10 },
  tarimCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  tarimCardEligible: { borderColor: "#86efac", backgroundColor: "rgba(34, 197, 94, 0.08)" },
  tarimHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  tarimEmoji: { fontSize: 20 },
  tarimTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", flex: 1 },
  tarimOk: { fontSize: 13, fontWeight: "700", marginTop: 6 },
  tarimOkYes: { color: "#15803d" },
  tarimOkNo: { color: "#b91c1c" },
  tarimMeta: { fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 17 },
  legalBox: { gap: 8 },
  legalTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  legalSubtitle: { fontSize: 13, fontWeight: "600", color: "#334155", marginTop: 8 },
  legalBody: { fontSize: 13, color: "#475569", lineHeight: 19 },
  reasonList: { gap: 10 },
  reasonCard: { borderRadius: 10, padding: 12, borderWidth: 1 },
  reasonPass: { borderColor: "#86efac", backgroundColor: "rgba(34, 197, 94, 0.06)" },
  reasonFail: { borderColor: "#fca5a5", backgroundColor: "rgba(239, 68, 68, 0.06)" },
  reasonWarn: { borderColor: "#fcd34d", backgroundColor: "rgba(234, 179, 8, 0.08)" },
  reasonTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  reasonLabel: { fontSize: 14, fontWeight: "700", color: "#0f172a", flex: 1 },
  reasonStatus: { fontSize: 12, fontWeight: "700", color: "#475569" },
  reasonMessage: { fontSize: 13, color: "#334155", marginTop: 6, lineHeight: 18 },
  reasonMeta: { marginTop: 6, gap: 2 },
  reasonMetaLine: { fontSize: 12, color: "#64748b" },
});
