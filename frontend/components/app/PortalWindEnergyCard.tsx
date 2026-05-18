/**
 * Web `DetailWindEnergyTab.jsx` ile aynı içerik — mobilde bölümlü alt kartlar.
 */

import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { PortalWindEnergyScoreResponse } from "../../src/types/portal";

const EMPTY_MESSAGES: Record<string, string> = {
  no_report: "Bu sorgu için tam analiz raporu henüz yok; rüzgar skoru üretilemiyor.",
  no_parameters_data: "Parsel analiz verisi eksik.",
  no_centroid: "Parsel geometrisinden konum çıkarılamadı.",
  no_area: "Parsel alanı bulunamadı.",
  incomplete_data: "Rüzgar skoru için gerekli alanlar tamamlanamadı.",
  validation_error: "Doğrulama hatası.",
  compute_error: "Rüzgar skoru hesaplanırken hata oluştu.",
  not_applicable: "Bu sorgu tipi için rüzgar arazi analizi uygulanmaz.",
};

function levelTr(level: string | undefined): string {
  if (level === "high") return "Yüksek";
  if (level === "medium") return "Orta";
  if (level === "low") return "Düşük";
  return level || "—";
}

function classificationTr(code: string | undefined): string {
  if (code === "commercial_pre_feasibility_positive") return "Ticari ön fizibilite — olumlu sinyal";
  if (code === "micro_wind_candidate") return "Mikro rüzgar adayı";
  if (code === "limited_wind_potential") return "Sınırlı rüzgar potansiyeli";
  if (code === "technically_positive_economically_weak") return "Teknik olumlu, ekonomik zayıf";
  if (code === "pre_feasibility_required") return "Ön fizibilite gerekli";
  return code || "—";
}

function fmt1(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function fmt2(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function fmtPctFromUnit(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)} %`;
}

function fmtGWhFromMwh(mwh: unknown): string {
  const n = Number(mwh);
  if (!Number.isFinite(n)) return "—";
  return `${(n / 1000).toFixed(1)} GWh`;
}

function fmtCompactEur(eur: unknown): string {
  const n = Number(eur);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1000) return `${Math.round(n / 1000)}k €`;
  return `${Math.round(n)} €`;
}

function fmtEnergyMwh(mwh: unknown): string {
  const n = Number(mwh);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)} GWh`;
  return `${fmt1(n)} MWh`;
}

function dataQualityTr(q: unknown): string {
  const s = String(q ?? "");
  if (s === "high") return "Yüksek";
  if (s === "medium") return "Orta";
  if (s === "low") return "Düşük";
  return s || "—";
}

function providerTr(p: string): string {
  const m: Record<string, string> = {
    wind_grid: "Birleşik ızgara",
    nasa_power: "NASA POWER",
    mock: "Tamamlayıcı örnek",
    atlas: "Atlas",
  };
  return m[p] || p;
}

function roughnessClassTr(c: unknown): string {
  const x = String(c ?? "")
    .trim()
    .toLowerCase();
  if (x === "low") return "Düşük";
  if (x === "medium") return "Orta";
  if (x === "high") return "Yüksek";
  return String(c || "—");
}

function turbineScenarioClassTr(code: string | undefined): string {
  const m: Record<string, string> = {
    strong_candidate: "Güçlü aday",
    medium_candidate: "Orta düzey aday",
    weak_candidate: "Zayıf ama değerlendirilebilir",
    uneconomic_candidate: "Ekonomik açıdan zayıf",
  };
  return (code && m[code]) || code || "—";
}

function riskLabelTr(code: string): string {
  const m: Record<string, string> = {
    grid_distance_risk: "Şebekeye uzaklık riski",
    settlement_constraint_risk: "Yerleşim yakınlığı riski",
    high_slope_risk: "Yüksek eğim riski",
    high_roughness_risk: "Yüksek arazi pürüzlülüğü riski",
    high_turbulence_risk: "Yüksek türbülans riski",
    insufficient_area_risk: "Yetersiz parsel alanı riski",
    data_low_confidence: "Düşük veri güveni",
  };
  return m[code] || code;
}

type WindRecord = Record<string, unknown>;

function windShearSummary(wind: WindRecord): WindRecord | null {
  const ws = wind.wind_shear;
  if (ws && typeof ws === "object") return ws as WindRecord;
  const inv = wind.investment;
  if (inv && typeof inv === "object") {
    const i = inv as WindRecord;
    return {
      wind_speed_100m: i.wind_speed_100m,
      wind_speed_hub: i.wind_speed_hub ?? i.wind_speed_hub_m,
      hub_height_m: i.hub_height_m ?? i.turbine_hub_height_m,
      shear_alpha: i.shear_alpha,
    };
  }
  return null;
}

function windGridAccessDisplay(wind: WindRecord) {
  const im =
    wind.input_metrics && typeof wind.input_metrics === "object" ? (wind.input_metrics as WindRecord) : {};
  const comp = wind.components && typeof wind.components === "object" ? (wind.components as WindRecord) : {};
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

  const hvScore = hvSc != null && hvSc !== "" ? String(hvSc) : "—";
  const hvMeasure = hasHvNum ? `${fmt1(dHv)} m` : "—";

  return { trafoScore, trafoMeasure, hvScore, hvMeasure, combined, dGrid: im.distance_to_grid_m };
}

function componentMeasureLabel(wind: WindRecord, row: string): string {
  const im =
    wind.input_metrics && typeof wind.input_metrics === "object" ? (wind.input_metrics as WindRecord) : {};
  switch (row) {
    case "wind_speed":
      return im.annual_mean_wind_speed_ms != null ? `${fmt2(im.annual_mean_wind_speed_ms)} m/s` : "—";
    case "wpd":
      return im.wind_power_density_wm2 != null ? `${fmt1(im.wind_power_density_wm2)} W/m²` : "—";
    case "turbulence":
      return im.turbulence_intensity != null ? fmt2(im.turbulence_intensity) : "—";
    case "terrain_exposure": {
      const rc = roughnessClassTr(im.roughness_class);
      const dem = im.dem_elevation_mean_m != null ? ` · DEM ort. ${fmt1(im.dem_elevation_mean_m)} m` : "";
      return `eğim ${fmt1(im.slope_deg)}° · yükselti ${fmt1(im.elevation_m)} m · pürüzlülük ${rc}${dem}`;
    }
    case "slope":
      return im.slope_deg != null ? `${fmt1(im.slope_deg)}°` : "—";
    case "elevation":
      return im.elevation_m != null ? `${fmt1(im.elevation_m)} m` : "—";
    case "grid":
      return im.distance_to_grid_m != null ? `${fmt1(im.distance_to_grid_m)} m` : "—";
    case "settlement":
      return im.distance_to_settlement_m != null ? `${fmt1(im.distance_to_settlement_m)} m` : "—";
    case "roughness":
      return roughnessClassTr(im.roughness_class);
    case "area":
      return im.parcel_area_m2 != null ? `${fmt1(im.parcel_area_m2)} m²` : "—";
    default:
      return "—";
  }
}

function DlRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dlRow}>
      <Text style={styles.dlDt}>{label}</Text>
      <Text style={styles.dlDd}>{value}</Text>
    </View>
  );
}

type Props = {
  loading: boolean;
  payload: PortalWindEnergyScoreResponse | null;
  fetchError: string | null;
};

export default function PortalWindEnergyCard({ loading, payload, fetchError }: Props) {
  const [dataQualityOpen, setDataQualityOpen] = useState(false);

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Rüzgar enerjisi uygunluğu</Text>
        <Text style={styles.subtitle}>Pro sorgu parsel verileri ile bölgesel rüzgar ve arazi sinyalleri (ön analiz).</Text>
        <ActivityIndicator color="#0369a1" style={{ marginTop: 12 }} />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Rüzgar enerjisi uygunluğu</Text>
        <Text style={styles.err}>{fetchError}</Text>
      </View>
    );
  }

  const reason = payload?.empty_reason;
  const wind = payload?.wind as WindRecord | null | undefined;
  if (reason && !wind) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Rüzgar enerjisi uygunluğu</Text>
        <Text style={styles.subtitle}>Pro sorgu sonuçlarından otomatik hesaplanır (harici API + önbellek).</Text>
        <Text style={styles.muted}>{EMPTY_MESSAGES[String(reason)] || "Veri yok."}</Text>
      </View>
    );
  }

  if (!wind) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Rüzgar enerjisi uygunluğu</Text>
        <Text style={styles.muted}>Sonuç üretilemedi.</Text>
      </View>
    );
  }

  const comp = (wind.components || {}) as Record<string, number | string | undefined>;
  const gridAcc = windGridAccessDisplay(wind);
  const notes = Array.isArray(wind.notes) ? (wind.notes as string[]) : [];
  const risks = Array.isArray(wind.risks) ? (wind.risks as string[]) : [];
  const degraded = Boolean((wind.debug as WindRecord | undefined)?.degraded_mode);
  const src = (wind.sources || {}) as WindRecord;
  const ext = wind.external_data && typeof wind.external_data === "object" ? (wind.external_data as WindRecord) : null;
  const attempted = Array.isArray(src.providers_attempted) ? (src.providers_attempted as string[]) : [];
  const used = Array.isArray(src.providers_used) ? (src.providers_used as string[]) : [];
  const roughnessSource = src.roughness_source as string | undefined;
  const trMeta = (wind.debug as WindRecord | undefined)?.terrain_roughness as WindRecord | undefined;
  const roughnessSourceLabel =
    roughnessSource === "wind_terrain_grid"
      ? "Birleşik rüzgar–arazi veri ızgarası"
      : roughnessSource === "terrain_roughness_grid"
        ? "DEM yükseklik ızgarası (eski)"
        : roughnessSource === "parcel"
          ? "Parsel analiz girdisi"
          : roughnessSource || "—";
  const roughnessClassLine =
    trMeta?.used && typeof trMeta.grid_id === "string"
      ? `Hücre: ${trMeta.grid_id}${
          typeof trMeta.roughness_class === "string" ? ` · sınıf: ${roughnessClassTr(trMeta.roughness_class)}` : ""
        }`
      : trMeta?.reason && !trMeta?.used
        ? typeof trMeta.reason_hint_tr === "string" && trMeta.reason_hint_tr
          ? String(trMeta.reason_hint_tr)
          : `DEM kullanılmadı (${String(trMeta.reason)})`
        : null;

  const investment = wind.investment && typeof wind.investment === "object" ? (wind.investment as WindRecord) : null;
  const scenarios = Array.isArray(wind.turbine_scenarios) ? (wind.turbine_scenarios as WindRecord[]) : [];
  const bestScenario =
    wind.best_scenario && typeof wind.best_scenario === "object" ? (wind.best_scenario as WindRecord) : null;
  const ws = windShearSummary(wind);

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.title}>Rüzgar enerjisi uygunluğu</Text>
        <Text style={styles.subtitle}>Skor 0–100; ön analiz ve uygunluk dili — kesin yatırım kararı değildir.</Text>

        <View style={styles.scoreRow}>
          <Text style={styles.scoreBig}>{fmt1(wind.overall_wind_score)}</Text>
          <View>
            <Text style={styles.levelText}>{levelTr(String(wind.wind_level))}</Text>
            <Text style={styles.typeText}>{String(wind.property_type || "—")}</Text>
          </View>
        </View>

        {degraded ? (
          <Text style={styles.degraded}>
            Kısmi veri ile hesaplandı (harici rüzgar servisi yanıtı sınırlı olabilir).
          </Text>
        ) : null}

        <View style={styles.subScoresGrid}>
          <DlRow label="Teknik skor" value={fmt1(wind.technical_wind_score)} />
          <DlRow label="Ekonomik skor" value={fmt1(wind.economic_wind_score)} />
          <DlRow label="Mikro rüzgar" value={fmt1(wind.micro_wind_score)} />
          <DlRow label="Ticari sinyal" value={fmt1(wind.commercial_wind_score)} />
          <DlRow label="Veri güveni" value={wind.confidence_score != null ? Number(wind.confidence_score).toFixed(3) : "—"} />
        </View>

        <Text style={styles.classificationText}>
          Sınıflandırma: <Text style={styles.classificationStrong}>{classificationTr(String(wind.classification))}</Text>
        </Text>
      </View>

      <View style={styles.card}>
        <Pressable
          onPress={() => setDataQualityOpen((o) => !o)}
          style={({ pressed }) => [styles.dqSummary, pressed && styles.dqSummaryPressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: dataQualityOpen }}
        >
          <Text style={styles.dqSummaryText}>{dataQualityOpen ? "▾ " : "▸ "}Veri kalitesi</Text>
        </Pressable>
        {dataQualityOpen ? (
          <View style={styles.dqPanel}>
            <DlRow label="Kalite düzeyi" value={dataQualityTr(src.data_quality)} />
            <Text style={styles.srcItem}>
              Denenen sağlayıcılar: {attempted.length ? attempted.map(providerTr).join(", ") : "—"}
            </Text>
            <Text style={styles.srcItem}>Kullanılan kaynaklar: {used.length ? used.map(providerTr).join(", ") : "—"}</Text>
            <Text style={styles.srcItem}>Pürüzlülük verisi: {roughnessSourceLabel}</Text>
            {roughnessClassLine ? <Text style={styles.mutedSmall}>{roughnessClassLine}</Text> : null}
          </View>
        ) : null}
      </View>

      {ext || investment ? (
        <View style={styles.card}>
          {ext ? (
            <View style={styles.innerSection}>
              <Text style={styles.sectionTitle}>Harici veri özeti</Text>
              <DlRow
                label="Yıllık ort. rüzgar (m/s)"
                value={ext.annual_mean_wind_speed_ms != null ? Number(ext.annual_mean_wind_speed_ms).toFixed(2) : "—"}
              />
              <DlRow
                label="Rüzgar güç yoğunluğu (W/m²)"
                value={ext.wind_power_density_wm2 != null ? Number(ext.wind_power_density_wm2).toFixed(1) : "—"}
              />
              <DlRow
                label="Türbülans yoğunluğu"
                value={ext.turbulence_intensity != null ? Number(ext.turbulence_intensity).toFixed(3) : "—"}
              />
            </View>
          ) : null}

          {investment ? (
            <View style={[styles.innerSection, ext ? styles.innerSectionBorder : null]}>
              <Text style={styles.sectionTitle}>Enerji üretim tahmini</Text>
              <Text style={styles.leadPara}>
                Özet senaryo (en iyi ekonomik seçim): Weibull dağılımı + güç eğrisi ile ortalama güç; wind shear ile hub
                hızı; wake sonrası net enerji ve LCOE (yüklenme faktörü ve kesintiler dahil değildir). Ayrıntılı üç senaryo
                aşağıda.
              </Text>
              {ws ? (
                <View style={styles.shearBlock}>
                  <Text style={styles.subSectionTitle}>Wind shear düzeltmesi</Text>
                  <DlRow
                    label="Atlas rüzgarı (100 m)"
                    value={
                      ws.wind_speed_100m != null && Number.isFinite(Number(ws.wind_speed_100m))
                        ? `${fmt2(ws.wind_speed_100m)} m/s`
                        : "—"
                    }
                  />
                  <DlRow
                    label="Türbin yüksekliği"
                    value={
                      ws.hub_height_m != null && Number.isFinite(Number(ws.hub_height_m)) ? `${fmt1(ws.hub_height_m)} m` : "—"
                    }
                  />
                  <DlRow
                    label="Shear katsayısı (α)"
                    value={ws.shear_alpha != null && Number.isFinite(Number(ws.shear_alpha)) ? fmt2(ws.shear_alpha) : "—"}
                  />
                  <DlRow
                    label="Tahmini rüzgar (hub)"
                    value={
                      ws.wind_speed_hub != null && Number.isFinite(Number(ws.wind_speed_hub))
                        ? `${fmt2(ws.wind_speed_hub)} m/s`
                        : "—"
                    }
                  />
                </View>
              ) : null}
              <DlRow
                label="Türbin yüksekliği"
                value={
                  investment.turbine_hub_height_m != null ? `${fmt1(investment.turbine_hub_height_m)} m` : "—"
                }
              />
              <DlRow label="Capacity Factor" value={fmtPctFromUnit(investment.capacity_factor)} />
              <DlRow
                label="Yıllık enerji (brüt)"
                value={
                  investment.annual_energy_gross_mwh != null ? fmtGWhFromMwh(investment.annual_energy_gross_mwh) : "—"
                }
              />
              <DlRow label="Wake Loss" value={fmtPctFromUnit(investment.wake_loss)} />
              <DlRow
                label="Net üretim"
                value={investment.net_annual_energy_mwh != null ? fmtGWhFromMwh(investment.net_annual_energy_mwh) : "—"}
              />
              <DlRow
                label="LCOE"
                value={
                  investment.lcoe_eur_mwh != null && Number.isFinite(Number(investment.lcoe_eur_mwh))
                    ? `${fmt1(investment.lcoe_eur_mwh)} €/MWh`
                    : "—"
                }
              />
              <DlRow label="Şebeke bağlantı maliyeti" value={fmtCompactEur(investment.grid_connection_cost)} />
            </View>
          ) : null}
        </View>
      ) : null}

      {scenarios.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Türbin senaryoları</Text>
          <Text style={styles.leadPara}>
            Mikro, orta ve ticari türbin katalogları; Weibull + güç eğrisi ile kapasite faktörü ve yıllık üretim
            (göstergesel).
          </Text>
          {scenarios.map((s, idx) => (
            <View key={String(s.scenario_key || s.label_tr || idx)} style={styles.scenarioCard}>
              <Text style={styles.scenarioTitle}>{String(s.label_tr || s.scenario_key || "—")}</Text>
              <DlRow label="Hub (m)" value={s.hub_height_m != null ? fmt1(s.hub_height_m) : "—"} />
              <DlRow
                label="Hub rüzgarı"
                value={s.wind_speed_hub != null ? `${fmt2(s.wind_speed_hub)} m/s` : "—"}
              />
              <DlRow label="Kapasite faktörü" value={fmtPctFromUnit(s.capacity_factor)} />
              <DlRow label="Brüt yıllık enerji" value={fmtEnergyMwh(s.gross_annual_energy_mwh)} />
              <DlRow label="Wake kaybı" value={fmtPctFromUnit(s.wake_loss)} />
              <DlRow label="Net yıllık enerji" value={fmtEnergyMwh(s.net_annual_energy_mwh)} />
              <DlRow
                label="LCOE"
                value={
                  s.lcoe_eur_mwh != null && Number.isFinite(Number(s.lcoe_eur_mwh))
                    ? `${fmt1(s.lcoe_eur_mwh)} €/MWh`
                    : "—"
                }
              />
              <DlRow label="Şebeke bağlantı maliyeti" value={fmtCompactEur(s.grid_connection_cost_eur)} />
              <DlRow label="Sonuç" value={turbineScenarioClassTr(String(s.classification))} />
            </View>
          ))}
          {bestScenario ? (
            <View style={styles.bestScenarioBox}>
              <Text style={styles.subSectionTitle}>En iyi senaryo</Text>
              <Text style={styles.bestScenarioLead}>
                <Text style={styles.classificationStrong}>
                  {String(bestScenario.label_tr || bestScenario.scenario_key || "—")}
                </Text>
                {" · "}
                <Text>{turbineScenarioClassTr(String(bestScenario.classification))}</Text>
              </Text>
              {bestScenario.summary_tr ? (
                <Text style={styles.bestScenarioSummary}>{String(bestScenario.summary_tr)}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {risks.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Risk işaretleri</Text>
          {risks.map((r) => (
            <Text key={r} style={styles.riskLine}>
              • {riskLabelTr(r)}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bileşen detayı</Text>
        <Text style={styles.tableHint}>Bileşen · skor · ölçü / girdi</Text>
        <CompRow label="Rüzgar hızı" score={comp.wind_speed_score} measure={componentMeasureLabel(wind, "wind_speed")} />
        <CompRow label="Güç yoğunluğu" score={comp.wind_power_density_score} measure={componentMeasureLabel(wind, "wpd")} />
        <CompRow label="Türbülans" score={comp.turbulence_score} measure={componentMeasureLabel(wind, "turbulence")} />
        <CompRow
          label="Arazi maruziyeti"
          score={comp.terrain_exposure_score}
          measure={componentMeasureLabel(wind, "terrain_exposure")}
        />
        <CompRow label="Eğim" score={comp.slope_score} measure={componentMeasureLabel(wind, "slope")} />
        <CompRow label="Yükseklik" score={comp.elevation_score} measure={componentMeasureLabel(wind, "elevation")} />
        <CompRow label="Şebeke (trafo merkezi)" score={gridAcc.trafoScore} measure={gridAcc.trafoMeasure} />
        <CompRow label="Yüksek gerilim hattı" score={gridAcc.hvScore} measure={gridAcc.hvMeasure} />
        <CompRow
          label="Yerleşim tamponu"
          score={comp.settlement_buffer_score}
          measure={componentMeasureLabel(wind, "settlement")}
        />
        <CompRow label="Pürüzlülük" score={comp.roughness_score} measure={componentMeasureLabel(wind, "roughness")} />
        <CompRow label="Kullanılabilir alan" score={comp.usable_area_score} measure={componentMeasureLabel(wind, "area")} />
        {gridAcc.combined != null && gridAcc.dGrid != null && Number.isFinite(Number(gridAcc.dGrid)) ? (
          <Text style={styles.gridFootnote}>
            Genel skorda şebeke bileşeni: {String(gridAcc.combined)} · kullanılan mesafe (en kısa): {fmt1(gridAcc.dGrid)} m
          </Text>
        ) : null}
      </View>

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

function CompRow({ label, score, measure }: { label: string; score: unknown; measure: string }) {
  const sc = score != null && score !== "" ? String(score) : "—";
  return (
    <View style={styles.compRow}>
      <Text style={styles.compRowLabel}>{label}</Text>
      <Text style={styles.compRowScore}>{sc}</Text>
      <Text style={styles.compRowMeasure}>{measure}</Text>
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
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 8 },
  muted: { fontSize: 14, color: "#64748b", marginTop: 8 },
  err: { fontSize: 14, color: "#b91c1c", marginTop: 8 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  scoreBig: { fontSize: 36, fontWeight: "800", color: "#0369a1" },
  levelText: { fontSize: 16, fontWeight: "700", color: "#334155" },
  typeText: { fontSize: 12, fontWeight: "600", color: "#94a3b8", textTransform: "uppercase" },
  degraded: {
    marginTop: 10,
    fontSize: 13,
    color: "#92400e",
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    padding: 8,
    borderRadius: 8,
  },
  subScoresGrid: { marginTop: 12, gap: 8 },
  dlRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  dlDt: { flex: 1, fontSize: 13, color: "#64748b", fontWeight: "600" },
  dlDd: { fontSize: 13, color: "#0f172a", fontWeight: "700", textAlign: "right", maxWidth: "52%" },
  classificationText: { fontSize: 14, color: "#334155", marginTop: 12, lineHeight: 20 },
  classificationStrong: { fontWeight: "700", color: "#0f172a" },
  dqSummary: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    backgroundColor: "rgba(15, 23, 42, 0.02)",
  },
  dqSummaryPressed: { opacity: 0.85 },
  dqSummaryText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: "#64748b",
    textTransform: "uppercase",
  },
  dqPanel: { marginTop: 12, gap: 8 },
  srcItem: { fontSize: 13, color: "#475569", fontWeight: "600", lineHeight: 20 },
  mutedSmall: { fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 18 },
  innerSection: { marginTop: 0 },
  innerSectionBorder: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.35)",
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0c4a6e", marginBottom: 10 },
  subSectionTitle: { fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 8, marginTop: 4 },
  leadPara: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 12,
  },
  shearBlock: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(3, 105, 161, 0.06)",
  },
  scenarioCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.4)",
    backgroundColor: "rgba(248, 250, 252, 0.9)",
    gap: 6,
  },
  scenarioTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 6 },
  bestScenarioBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  bestScenarioLead: { fontSize: 14, color: "#334155", marginBottom: 6, lineHeight: 20 },
  bestScenarioSummary: { fontSize: 13, color: "#64748b", lineHeight: 20 },
  riskLine: { fontSize: 13, color: "#475569", marginBottom: 6, lineHeight: 20 },
  tableHint: { fontSize: 12, color: "#94a3b8", marginBottom: 10, fontWeight: "600" },
  compRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.45)",
  },
  compRowLabel: { fontSize: 12, fontWeight: "700", color: "#334155", marginBottom: 4 },
  compRowScore: { fontSize: 13, fontWeight: "700", color: "#0369a1" },
  compRowMeasure: { fontSize: 12, color: "#475569", marginTop: 2, lineHeight: 18 },
  gridFootnote: { fontSize: 12, color: "#64748b", marginTop: 12, fontStyle: "italic", lineHeight: 18 },
  noteLine: { fontSize: 13, color: "#334155", lineHeight: 20, marginBottom: 6 },
});
