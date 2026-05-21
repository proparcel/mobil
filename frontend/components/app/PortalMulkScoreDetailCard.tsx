/**
 * Web `DetailInvestmentScoreTab.jsx` — Mülk / Yapı / Arazi skoru (mobil).
 */

import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { PortalInvestmentScorePayload, PortalQueryDetail } from "../../src/types/portal";
import { buildDfaRowsFromSteps } from "../../src/utils/portalDfaHelpers";
import {
  computeCombinedMulkScore,
  getStructureScoreNumber,
  LAND_WEIGHT,
  normalizeLandInvestmentScore,
  STRUCT_WEIGHT,
} from "../../src/utils/investmentScoreCombined";
import { isStructurePortalQueryType } from "../../src/utils/portalInsightCardLogic";

function formatScore(n: unknown): string {
  const num = Number(n);
  if (n === null || n === undefined || !Number.isFinite(num)) return "—";
  return String(Math.round(num));
}

function formatCurrency(n: unknown): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(num);
}

function formatArea(n: unknown): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(num);
}

const COMPONENT_LABELS: Record<string, string> = {
  price_position: "Fiyat konumu",
  area_fit: "Alan uyumu",
  dfa_trajectory: "DFA değerleme akışı",
  market_activity: "Piyasa aktivitesi",
  grid_cell: "Satış grid hücresi",
  slope_terrain: "Eğim (arazi)",
  parcel_shape: "Parsel şekli",
  imarsiz_infrastructure: "Arazi altyapısı (su / elektrik / ağaç)",
  road_access: "Yol erişimi",
  corner_parcel_bonus: "Köşe parsel (yol cephesi ek puanı)",
  imar_proximity: "İmarlı Alana Yakınlık",
  split_divisibility: "Bölünebilirlik (imarlı arsa)",
  wetland_risk: "Sulak alan cezası (RAMSAR)",
  high_voltage_risk: "Yüksek gerilim hattı cezası",
};

const STRUCTURE_EMPTY_MESSAGES: Record<string, string> = {
  not_structure_leaf: "Bu sorgu / kategori için yapı skoru uygulanmıyor.",
  insufficient_attributes: "Yapı skoru için yeterli ilan özelliği yok.",
};

const LAND_EMPTY_MESSAGES: Record<string, string> = {
  not_analyzed: "Arazi skoru bu sorgu için henüz hesaplanamadı. Sayfayı kısa süre sonra yenileyin.",
};

function ScoreRing({ score, label }: { score: number; label?: string }) {
  const ringPct = Math.round(Math.min(100, Math.max(0, score)));
  const high = ringPct >= 80;
  return (
    <View style={styles.ringWrap}>
      <View style={[styles.ring, high && styles.ringHigh]}>
        <Text style={[styles.ringValue, high && styles.ringValueHigh]}>{formatScore(score)}</Text>
        <Text style={styles.ringSuffix}>/ 100</Text>
      </View>
      {label ? <Text style={styles.ringBadge}>{label}</Text> : null}
    </View>
  );
}

function ScoreBar({ label, pct, valueText, excluded }: { label: string; pct: number; valueText: string; excluded?: boolean }) {
  return (
    <View style={[styles.barRow, excluded && styles.barRowExcluded]}>
      <Text style={styles.barLabel} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${excluded ? 0 : pct}%` }]} />
      </View>
      <Text style={[styles.barNum, excluded && styles.barNumExcluded]}>{valueText}</Text>
    </View>
  );
}

type SharedProps = {
  detail: PortalQueryDetail;
  loading: boolean;
  fetchError: string | null;
  invPayload: PortalInvestmentScorePayload | null;
};

function CardShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export default function PortalMulkScoreDetailCard({ detail, loading, fetchError, invPayload }: SharedProps) {
  const structureQuery = isStructurePortalQueryType(detail.query_type);
  const buildingSteps = Array.isArray(detail.building_dfa_json) ? detail.building_dfa_json : [];
  const buildingRows = useMemo(() => buildDfaRowsFromSteps(buildingSteps), [buildingSteps]);
  const totalPct = buildingRows.length
    ? buildingRows.reduce((acc, r) => {
        const m = String(r.percent || "").match(/-?\d+/);
        return acc + (m ? Number(m[0]) : 0);
      }, 0)
    : null;

  if (!structureQuery) return null;

  if (loading) {
    return (
      <CardShell title="Mülk Skoru" subtitle="Yapı ve arazi skorlarından ağırlıklı birleşik mülk skoru (0–100).">
        <ActivityIndicator color="#1d4ed8" style={{ marginTop: 12 }} />
      </CardShell>
    );
  }

  if (fetchError) {
    return (
      <CardShell title="Mülk Skoru">
        <Text style={styles.err}>{fetchError}</Text>
      </CardShell>
    );
  }

  const analysis = (invPayload?.analysis as Record<string, unknown> | null) ?? null;
  const landN = normalizeLandInvestmentScore(analysis);
  const structN = getStructureScoreNumber(invPayload);
  const combined = computeCombinedMulkScore(landN, structN);
  const ss = invPayload?.structure_score;

  return (
    <View>
      <CardShell
        title="Mülk Skoru"
        subtitle="Formül: %70 × Arazi skoru + %30 × Yapı skoru."
      >
        {combined != null ? (
          <>
            <ScoreRing score={combined} />
            <ScoreBar
              label="Arazi skoru (ağırlık %70)"
              pct={landN ?? 0}
              valueText={landN != null ? formatScore(landN) : "—"}
              excluded={landN == null}
            />
            <ScoreBar
              label="Yapı skoru (ağırlık %30)"
              pct={structN ?? 0}
              valueText={structN != null ? formatScore(structN) : "—"}
              excluded={structN == null}
            />
          </>
        ) : (
          <Text style={styles.muted}>Arazi veya yapı skoru hesaplanamadı; birleşik mülk skoru gösterilemiyor.</Text>
        )}
      </CardShell>

      {ss ? (
        <CardShell
          title="Yapı Skoru"
          subtitle="İlan teknik özelliklerine göre özet yapı skoru (0–100)."
        >
          {ss.empty_reason != null && ss.structure_score == null ? (
            <Text style={styles.muted}>
              {STRUCTURE_EMPTY_MESSAGES[String(ss.empty_reason)] || "Yapı skoru hesaplanamadı."}
            </Text>
          ) : (
            <>
              <ScoreRing score={Number(ss.structure_score) || 0} />
              {(ss.structure_score_components || []).map((c) => {
                const included = Boolean(c.included);
                const sc = included && c.score != null ? Number(c.score) : 0;
                const pct = included && Number.isFinite(sc) ? Math.min(100, Math.max(0, sc)) : 0;
                return (
                  <ScoreBar
                    key={c.key || c.label}
                    label={c.label || c.key || "—"}
                    pct={pct}
                    valueText={included && c.score != null ? formatScore(c.score) : "—"}
                    excluded={!included}
                  />
                );
              })}
              {ss.structure_score_age_band_note ? (
                <Text style={styles.note}>{ss.structure_score_age_band_note}</Text>
              ) : null}
            </>
          )}
        </CardShell>
      ) : null}

      <CardShell title="Yapı Detaylı Fiyat Analizi" subtitle="Yaş bandı formülü ve maliyet adımları">
        {!buildingSteps.length ? (
          <Text style={styles.muted}>Yapı fiyat adımı bulunamadı (eski sorgu veya eksik rapor).</Text>
        ) : (
          <>
            {buildingRows.map((row) => (
              <View style={styles.dfaRow} key={row.key}>
                <Text style={styles.dfaDesc}>{row.description}</Text>
                <Text style={styles.dfaPct}>{row.percent}</Text>
              </View>
            ))}
            {totalPct != null ? (
              <Text style={styles.dfaFoot}>Uygulanan % (çarpım): {totalPct > 0 ? `+${totalPct}` : String(totalPct)}</Text>
            ) : null}
            {detail.total_price != null ? (
              <Text style={styles.dfaFoot}>Toplam (TL): {formatCurrency(detail.total_price)}</Text>
            ) : null}
          </>
        )}
      </CardShell>
    </View>
  );
}

export function PortalAraziScoreDetailCard({ detail, loading, fetchError, invPayload }: SharedProps) {
  const structureQuery = isStructurePortalQueryType(detail.query_type);
  const analysis = (invPayload?.analysis as Record<string, unknown> | null) ?? null;
  const emptyReason = invPayload?.empty_reason;

  if (loading) {
    return (
      <CardShell title="Arazi Skoru" subtitle="Mahalle birim fiyatı, alan ve DFA verilerine göre özet arazi skoru (0–100).">
        <ActivityIndicator color="#1d4ed8" style={{ marginTop: 12 }} />
      </CardShell>
    );
  }

  if (fetchError) {
    return (
      <CardShell title="Arazi Skoru">
        <Text style={styles.err}>{fetchError}</Text>
      </CardShell>
    );
  }

  if (emptyReason && !analysis) {
    return (
      <CardShell title="Arazi Skoru">
        <Text style={styles.muted}>{LAND_EMPTY_MESSAGES[String(emptyReason)] || "Veri yok."}</Text>
      </CardShell>
    );
  }

  if (!analysis) {
    return (
      <CardShell title="Arazi Skoru">
        <Text style={styles.muted}>Veri yok.</Text>
      </CardShell>
    );
  }

  const score = Number(analysis.normalized_score);
  const ringScore = Number.isFinite(score) ? score : 0;
  const comps =
    analysis.components && typeof analysis.components === "object"
      ? (analysis.components as Record<string, unknown>)
      : {};
  const compEntries = Object.entries(comps).filter(([, v]) => v != null && v !== "");

  const pos = Array.isArray(analysis.top_positive_drivers) ? analysis.top_positive_drivers : [];
  const neg = Array.isArray(analysis.top_negative_drivers) ? analysis.top_negative_drivers : [];

  return (
    <View>
      <CardShell
        title={structureQuery ? "Arazi Skoru" : "Yatırım / Arazi Skoru"}
        subtitle="Parsel birim fiyatı, alan, DFA ve satış grid bileşenlerinden türetilen skor."
      >
        <ScoreRing score={ringScore} label={String(analysis.score_label || "")} />
        <View style={styles.metaGrid}>
          <MetaRow
            label={
              analysis.listing_ask_unit_m2 != null && analysis.listing_ask_unit_m2 !== ""
                ? "İlan birim (TL/m²)"
                : "Parsel birim (TL/m²)"
            }
            value={
              analysis.listing_ask_unit_m2 != null && analysis.listing_ask_unit_m2 !== ""
                ? formatCurrency(analysis.listing_ask_unit_m2)
                : analysis.unit_price_snapshot != null
                  ? formatCurrency(analysis.unit_price_snapshot)
                  : "—"
            }
          />
          <MetaRow
            label="Mahalle özet birim (TL/m²)"
            value={
              analysis.benchmark_unit_m2 != null && analysis.benchmark_unit_m2 !== ""
                ? formatCurrency(analysis.benchmark_unit_m2)
                : "—"
            }
          />
          <MetaRow
            label="Alan"
            value={analysis.area_m2 != null && analysis.area_m2 !== "" ? `${formatArea(analysis.area_m2)} m²` : "—"}
          />
          <MetaRow
            label="DFA net çarpan"
            value={
              analysis.dfa_net_multiplier != null && analysis.dfa_net_multiplier !== ""
                ? Number(analysis.dfa_net_multiplier).toFixed(3)
                : "—"
            }
          />
          <MetaRow
            label="Grid hücresi skoru"
            value={
              analysis.grid_cell_score_pct != null && analysis.grid_cell_score_pct !== ""
                ? `%${Number(analysis.grid_cell_score_pct).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`
                : "—"
            }
          />
        </View>

        {compEntries.length > 0 ? (
          <View style={styles.compSection}>
            <Text style={styles.compTitle}>Skor bileşenleri</Text>
            {compEntries.map(([key, val]) => {
              const pct = Math.round(Math.min(100, Math.max(0, Number(val) || 0)));
              return (
                <ScoreBar
                  key={key}
                  label={COMPONENT_LABELS[key] || key}
                  pct={pct}
                  valueText={formatScore(val)}
                />
              );
            })}
          </View>
        ) : null}

        {pos.length > 0 ? (
          <View style={styles.driverBox}>
            <Text style={styles.driverTitle}>Olumlu etkenler</Text>
            {pos.map((d, i) => (
              <Text key={`p-${i}`} style={styles.driverLine}>
                • {String(d)}
              </Text>
            ))}
          </View>
        ) : null}

        {neg.length > 0 ? (
          <View style={styles.driverBox}>
            <Text style={styles.driverTitle}>Olumsuz etkenler</Text>
            {neg.map((d, i) => (
              <Text key={`n-${i}`} style={styles.driverLine}>
                • {String(d)}
              </Text>
            ))}
          </View>
        ) : null}
      </CardShell>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
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
  muted: { fontSize: 14, color: "#64748b", marginTop: 4 },
  err: { fontSize: 14, color: "#b91c1c", marginTop: 8 },
  note: { fontSize: 12, color: "#92400e", marginTop: 8, fontStyle: "italic" },
  ringWrap: { alignItems: "center", marginBottom: 16 },
  ring: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    borderColor: "#93c5fd",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
  },
  ringHigh: { borderColor: "#22c55e", backgroundColor: "#f0fdf4" },
  ringValue: { fontSize: 32, fontWeight: "800", color: "#1d4ed8" },
  ringValueHigh: { color: "#15803d" },
  ringSuffix: { fontSize: 12, color: "#64748b" },
  ringBadge: { marginTop: 8, fontSize: 13, fontWeight: "600", color: "#475569" },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  barRowExcluded: { opacity: 0.55 },
  barLabel: { flex: 1, fontSize: 12, color: "#475569" },
  barTrack: { flex: 1.2, height: 8, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: "#3b82f6", borderRadius: 4 },
  barNum: { width: 36, fontSize: 12, fontWeight: "700", color: "#0f172a", textAlign: "right" },
  barNumExcluded: { color: "#94a3b8" },
  metaGrid: { gap: 4, marginTop: 8 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  metaLabel: { fontSize: 13, color: "#64748b", flex: 1 },
  metaValue: { fontSize: 13, fontWeight: "600", color: "#0f172a", textAlign: "right", flex: 1 },
  compSection: { marginTop: 14 },
  compTitle: { fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 8 },
  driverBox: { marginTop: 12, padding: 10, backgroundColor: "#f8fafc", borderRadius: 8 },
  driverTitle: { fontSize: 13, fontWeight: "700", color: "#334155", marginBottom: 6 },
  driverLine: { fontSize: 12, color: "#475569", lineHeight: 18, marginBottom: 2 },
  dfaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  dfaDesc: { flex: 1, fontSize: 13, color: "#334155" },
  dfaPct: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  dfaFoot: { fontSize: 13, fontWeight: "600", color: "#475569", marginTop: 10 },
});
