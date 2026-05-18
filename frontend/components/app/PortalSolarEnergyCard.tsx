/**
 * Web `DetailSolarEnergyTab.jsx` ile aynı içerik — mobilde akıcı bölümlü kartlar.
 */

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { PortalSolarEnergyScoreResponse } from "../../src/types/portal";
import { buildPortalExpertFallback } from "../../utils/portalSolarExpertFallback";

const EMPTY_MESSAGES: Record<string, string> = {
  no_report: "Bu sorgu için tam analiz raporu henüz yok; güneş skoru üretilemiyor.",
  no_parameters_data: "Parsel analiz verisi eksik.",
  no_centroid: "Parsel geometrisinden konum çıkarılamadı.",
  no_area: "Parsel alanı bulunamadı.",
  incomplete_data: "Güneş skoru için gerekli alanlar tamamlanamadı.",
  validation_error: "Doğrulama hatası.",
  compute_error: "Güneş skoru hesaplanırken hata oluştu.",
};

function levelTr(level: string | undefined): string {
  if (level === "high") return "Yüksek";
  if (level === "medium") return "Orta";
  if (level === "low") return "Düşük";
  return level || "—";
}

function fmt1(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

/** Web `solarGridAccessDisplay` ile aynı mantık */
function solarGridAccessDisplay(solar: Record<string, any>) {
  const im = solar.input_metrics && typeof solar.input_metrics === "object" ? (solar.input_metrics as Record<string, unknown>) : {};
  const comp = solar.components && typeof solar.components === "object" ? (solar.components as Record<string, unknown>) : {};
  const src = im.grid_distance_source;
  const dSub = im.distance_to_substation_m;
  const dHv = im.distance_to_parcel_electric_line_m;
  const dGrid = im.distance_to_grid_m;
  const combined = comp.grid_access_score;
  const subSc = comp.grid_access_substation_score;
  const hvSc = comp.grid_access_hv_line_score;
  const hasSubNum = dSub != null && Number.isFinite(Number(dSub));
  const hasHvNum = dHv != null && Number.isFinite(Number(dHv));
  const proxyOnly = src === "centroid_proxy" && !hasSubNum && !hasHvNum;
  let trafoScore = subSc != null && subSc !== "" ? String(subSc) : "—";
  let trafoMeasure = hasSubNum ? `${fmt1(dSub)} m` : "—";
  if (proxyOnly) {
    trafoScore = combined != null && combined !== "" ? String(combined) : "—";
    trafoMeasure =
      dGrid != null && Number.isFinite(Number(dGrid)) ? `${fmt1(dGrid)} m (yaklaşık · merkez proxy)` : "—";
  }
  return {
    trafoScore,
    trafoMeasure,
    hvScore: hvSc != null && hvSc !== "" ? String(hvSc) : "—",
    hvMeasure: hasHvNum ? `${fmt1(dHv)} m` : "—",
    combined,
    dGrid: im.distance_to_grid_m,
  };
}

function DlRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dlRow}>
      <Text style={styles.dlDt}>{label}</Text>
      <Text style={styles.dlDd}>{value}</Text>
    </View>
  );
}

function CompRow({ label, score, measure }: { label: string; score: string; measure: string }) {
  return (
    <View style={styles.compRow}>
      <Text style={styles.compRowLabel}>{label}</Text>
      <View style={styles.compRowRight}>
        <Text style={styles.compRowScore}>{score}</Text>
        <Text style={styles.compRowMeasure}>{measure}</Text>
      </View>
    </View>
  );
}

type Props = {
  loading: boolean;
  payload: PortalSolarEnergyScoreResponse | null;
  fetchError: string | null;
};

export default function PortalSolarEnergyCard({ loading, payload, fetchError }: Props) {
  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Güneş enerjisi potansiyeli</Text>
        <Text style={styles.subtitle}>Pro sorgu parsel verileri ile bölgesel güneşlenme ve çatı/analiz tahmini.</Text>
        <ActivityIndicator color="#ca8a04" style={{ marginTop: 12 }} />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Güneş enerjisi potansiyeli</Text>
        <Text style={styles.err}>{fetchError}</Text>
      </View>
    );
  }

  const reason = payload?.empty_reason;
  const solar = payload?.solar as Record<string, any> | null | undefined;
  if (reason && !solar) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Güneş enerjisi potansiyeli</Text>
        <Text style={styles.subtitle}>Pro sorgu sonuçlarından otomatik hesaplanır (harici API + önbellek).</Text>
        <Text style={styles.muted}>{EMPTY_MESSAGES[String(reason)] || "Veri yok."}</Text>
      </View>
    );
  }

  if (!solar) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Güneş enerjisi potansiyeli</Text>
        <Text style={styles.muted}>Sonuç üretilemedi.</Text>
      </View>
    );
  }

  const score = Number(solar.solar_score);
  const comp = (solar.components || {}) as Record<string, unknown>;
  const gridAcc = solarGridAccessDisplay(solar);
  const derived =
    payload?.derived_inputs && typeof payload.derived_inputs === "object"
      ? (payload.derived_inputs as Record<string, any>)
      : null;
  const serverExpert = solar.expert && typeof solar.expert === "object" ? (solar.expert as Record<string, any>) : null;
  const expert = serverExpert || buildPortalExpertFallback(solar, derived);
  const expertSynthesized = Boolean(expert && expert._client_synthesized);
  const sr = expert?.solar_resource && typeof expert.solar_resource === "object" ? expert.solar_resource : null;
  const coords = expert?.coordinates && typeof expert.coordinates === "object" ? expert.coordinates : null;
  const geom = expert?.site_geometry && typeof expert.site_geometry === "object" ? expert.site_geometry : null;
  const gb = expert?.google_building && typeof expert.google_building === "object" ? expert.google_building : null;
  const disclaimers = Array.isArray(expert?.disclaimers_tr) ? (expert.disclaimers_tr as string[]) : [];
  const notes = Array.isArray(solar.notes) ? (solar.notes as string[]) : [];
  const degraded = Boolean(solar.debug?.degraded_mode);
  const src = (solar.sources || {}) as Record<string, boolean>;

  return (
    <View>
      {/* 1 — Özet skor */}
      <View style={styles.card}>
        <Text style={styles.title}>Güneş enerjisi potansiyeli</Text>
        <Text style={styles.subtitle}>Skor 0–100; konum, eğim, alan ve şebeke (trafo / HV / proxy) mesafesi kullanılır.</Text>

        <View style={styles.scoreRow}>
          <Text style={styles.scoreBig}>{Number.isFinite(score) ? score.toFixed(1) : "—"}</Text>
          <View>
            <Text style={styles.levelText}>{levelTr(String(solar.solar_level))}</Text>
            <Text style={styles.typeText}>{String(solar.property_type || "—")}</Text>
          </View>
        </View>

        {degraded ? (
          <Text style={styles.degraded}>Kısmi veri ile hesaplandı (harici servis yanıtı sınırlı olabilir).</Text>
        ) : null}
      </View>

      {/* 2 — Veri kaynakları */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Veri kaynakları</Text>
        <DlRow label="Google Solar" value={src.google_solar_used ? "Kullanıldı" : "Kullanılmadı"} />
        <DlRow label="NASA POWER" value={src.nasa_power_used ? "Kullanıldı" : "Kullanılmadı"} />
      </View>

      {/* 3 — Uzman / PV girdileri */}
      {expert ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ölçülebilir teknik özet</Text>
          <Text style={styles.leadPara}>
            Ön fizibilite ve PVsyst / GES yazılımına girdi olarak kullanılabilecek değerler. Skor yerine buradaki sayılar
            ve köken (lineage) önemlidir.
          </Text>
          {expertSynthesized ? (
            <Text style={styles.staleBanner}>
              Önbellek veya eski sunucu yanıtı: değerler mevcut alanlardan türetildi; tam özet için sonra yenileyin.
            </Text>
          ) : null}
          {coords ? (
            <DlRow
              label="Koordinat (WGS84)"
              value={`${Number(coords.latitude).toFixed(5)}, ${Number(coords.longitude).toFixed(5)}`}
            />
          ) : null}
          {geom ? (
            <DlRow
              label="Eğim / bakı"
              value={`${Number(geom.slope_deg).toFixed(1)}° eğim, ${Number(geom.aspect_deg).toFixed(1)}° bakı (0=kuzey)`}
            />
          ) : null}
          {expert.parcel_area_m2 != null ? (
            <DlRow
              label="Parsel alanı"
              value={`${Number(expert.parcel_area_m2).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²`}
            />
          ) : null}
          {expert.grid_distance_proxy_m != null ? (
            <DlRow
              label="Şebeke mesafesi (proxy)"
              value={`${Number(expert.grid_distance_proxy_m).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m`}
            />
          ) : null}
          {sr ? (
            <>
              <DlRow
                label="Yıllık GHI (yatay)"
                value={
                  sr.annual_ghi_horiz_kwh_m2 != null
                    ? `${Number(sr.annual_ghi_horiz_kwh_m2).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} kWh/m²-yıl`
                    : "—"
                }
              />
              {sr.daily_ghi_horiz_kwh_m2 != null ? (
                <DlRow label="Günlük ort. GHI (yatay)" value={`${Number(sr.daily_ghi_horiz_kwh_m2).toFixed(3)} kWh/m²-gün`} />
              ) : null}
              <DlRow label="Güneş kaynağı" value={String(sr.lineage_label_tr || sr.lineage || "—")} />
              {sr.nasa_parameter ? <DlRow label="NASA parametresi" value={String(sr.nasa_parameter)} /> : null}
            </>
          ) : null}
          {gb && Object.keys(gb).length > 0 ? (() => {
            const googleLine = [
              gb.max_sunshine_hours_per_year != null
                ? `Max. güneş saati/yıl: ${Number(gb.max_sunshine_hours_per_year).toFixed(0)}`
                : null,
              gb.roof_area_m2 != null
                ? `Çatı alanı: ${Number(gb.roof_area_m2).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²`
                : null,
              gb.estimated_annual_irradiance_kwh_m2 != null
                ? `Tahm. GHI: ${Number(gb.estimated_annual_irradiance_kwh_m2).toFixed(1)} kWh/m²-yıl`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return googleLine ? (
              <View style={styles.googleBlock}>
                <Text style={styles.subSectionTitle}>Google Solar (bina)</Text>
                <Text style={styles.googleLine}>{googleLine}</Text>
              </View>
            ) : null;
          })() : null}
          {disclaimers.length > 0 ? (
            <View style={styles.disclaimerBox}>
              {disclaimers.map((d) => (
                <Text key={d} style={styles.disclaimerLine}>
                  • {d}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 4 — Skor bileşenleri (web tablosu) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Skor bileşenleri</Text>
        <Text style={styles.tableHint}>Bileşen · skor · ölçü / girdi</Text>
        <CompRow label="Bakı" score={String(comp.aspect_score ?? "—")} measure="—" />
        <CompRow label="Eğim" score={String(comp.slope_score ?? "—")} measure="—" />
        <CompRow label="Güneşlenme" score={String(comp.irradiance_score ?? "—")} measure="—" />
        <CompRow label="Gölge" score={String(comp.shadow_score ?? "—")} measure="—" />
        <CompRow label="Şebeke (trafo merkezi)" score={gridAcc.trafoScore} measure={gridAcc.trafoMeasure} />
        <CompRow label="Yüksek gerilim hattı" score={gridAcc.hvScore} measure={gridAcc.hvMeasure} />
        <CompRow label="Alan" score={String(comp.usable_area_score ?? "—")} measure="—" />
        {gridAcc.combined != null && gridAcc.dGrid != null && Number.isFinite(Number(gridAcc.dGrid)) ? (
          <Text style={styles.gridFootnote}>
            Genel skorda şebeke bileşeni: {String(gridAcc.combined)} · kullanılan mesafe (en kısa): {fmt1(gridAcc.dGrid)}{" "}
            m
          </Text>
        ) : null}
      </View>

      {/* 5 — Notlar */}
      {notes.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notlar</Text>
          {notes.map((n) => (
            <Text key={n} style={styles.noteLine}>
              • {n}
            </Text>
          ))}
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
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 8, lineHeight: 18 },
  muted: { fontSize: 14, color: "#64748b", marginTop: 8 },
  err: { fontSize: 14, color: "#b91c1c", marginTop: 8 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  scoreBig: { fontSize: 36, fontWeight: "800", color: "#ca8a04" },
  levelText: { fontSize: 16, fontWeight: "700", color: "#334155" },
  typeText: { fontSize: 12, fontWeight: "600", color: "#94a3b8", textTransform: "uppercase" },
  degraded: {
    marginTop: 10,
    fontSize: 13,
    color: "#92400e",
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    padding: 8,
    borderRadius: 8,
    lineHeight: 18,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0c4a6e", marginBottom: 10 },
  subSectionTitle: { fontSize: 13, fontWeight: "700", color: "#334155", marginBottom: 6 },
  leadPara: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 12,
  },
  staleBanner: {
    fontSize: 11,
    color: "#7c2d12",
    backgroundColor: "rgba(251, 191, 36, 0.25)",
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    lineHeight: 16,
  },
  dlRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  dlDt: { flex: 1, fontSize: 13, color: "#64748b", fontWeight: "600" },
  dlDd: { fontSize: 13, color: "#0f172a", fontWeight: "600", textAlign: "right", maxWidth: "58%", lineHeight: 20 },
  googleBlock: { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: "rgba(14, 165, 233, 0.08)" },
  googleLine: { fontSize: 12, color: "#0f172a", lineHeight: 18 },
  disclaimerBox: { marginTop: 12 },
  disclaimerLine: { fontSize: 11, color: "#64748b", lineHeight: 17, marginBottom: 4 },
  tableHint: { fontSize: 12, color: "#94a3b8", marginBottom: 10, fontWeight: "600" },
  compRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.45)",
  },
  compRowLabel: { flex: 1, fontSize: 13, fontWeight: "700", color: "#334155" },
  compRowRight: { alignItems: "flex-end", maxWidth: "48%" },
  compRowScore: { fontSize: 13, fontWeight: "700", color: "#ca8a04" },
  compRowMeasure: { fontSize: 12, color: "#64748b", marginTop: 4, textAlign: "right", lineHeight: 17 },
  gridFootnote: { fontSize: 12, color: "#64748b", marginTop: 12, fontStyle: "italic", lineHeight: 18 },
  noteLine: { fontSize: 13, color: "#334155", lineHeight: 20, marginBottom: 6 },
});
