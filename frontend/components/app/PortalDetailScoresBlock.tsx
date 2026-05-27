/**
 * Detay sayfası — özet kart + Mülk Skoru detayı + Meyve Bahçesi (tek yük: investment + slope [+ meyve]).
 * `betweenMulkAndArazi`: genelde Bilgiler kartı — Arazi Skoru tablosunun hemen üstüne gelir.
 */

import React, { useCallback, useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { getPortalDetailSection, getPortalFruitInvestment, getPortalInvestmentScore } from "../../services/portalService";
import type { PortalFruitAnalysis, PortalInvestmentScorePayload, PortalQueryDetail } from "../../src/types/portal";
import { isStructurePortalQueryType } from "../../src/utils/portalInsightCardLogic";
import PortalFruitInvestmentCard from "./PortalFruitInvestmentCard";
import PortalInsightSummaryCard, { type PortalInsightScoresBundle } from "./PortalInsightSummaryCard";
import PortalMulkScoreDetailCard, { PortalAraziScoreDetailCard } from "./PortalMulkScoreDetailCard";

type Props = {
  snapshotId: number;
  detail: PortalQueryDetail;
  /** Örn. Bilgiler tablosu — Mülk skoru blokları ile Arazi Skoru arasına */
  betweenMulkAndArazi?: ReactNode;
};

export type PortalDetailScoresData = {
  insightData: PortalInsightScoresBundle;
  loading: boolean;
  err: string | null;
  invPayload: PortalInvestmentScorePayload | null;
  slopeSection: Record<string, unknown> | null;
  fruitAnalysis: PortalFruitAnalysis | null;
  fruitEmptyReason: string | null;
  fruitErr: string | null;
  structureQuery: boolean;
};

/** Tek yük: investment + slope [+ meyve]. Detay sekmelerinde içerik paylaşımı için. */
export function usePortalDetailScoresData(
  snapshotId: number,
  detail: PortalQueryDetail,
  enabled = true,
): PortalDetailScoresData {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [invPayload, setInvPayload] = useState<PortalInvestmentScorePayload | null>(null);
  const [slopeSection, setSlopeSection] = useState<Record<string, unknown> | null>(null);
  const [fruitAnalysis, setFruitAnalysis] = useState<PortalFruitAnalysis | null>(null);
  const [fruitEmptyReason, setFruitEmptyReason] = useState<string | null>(null);
  const [fruitErr, setFruitErr] = useState<string | null>(null);

  const structureQuery = isStructurePortalQueryType(detail.query_type);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!Number.isFinite(snapshotId) || snapshotId <= 0) {
      setLoading(false);
      setInvPayload(null);
      setSlopeSection(null);
      setFruitAnalysis(null);
      setFruitEmptyReason(null);
      setFruitErr(null);
      setErr(null);
      return;
    }
    setLoading(true);
    setErr(null);
    setFruitErr(null);
    try {
      const invP = getPortalInvestmentScore(snapshotId);
      const slopeP = getPortalDetailSection(snapshotId, "slope");
      const fruitP = structureQuery ? Promise.resolve({ ok: true as const, data: { analysis: null, empty_reason: null } }) : getPortalFruitInvestment(snapshotId);

      const [inv, slope, fruit] = await Promise.all([invP, slopeP, fruitP]);

      if (inv.ok) setInvPayload(inv.data);
      else {
        setErr(inv.error || "Özet alınamadı");
        setInvPayload(null);
      }

      if (slope.ok) setSlopeSection(slope.data);

      if (!structureQuery) {
        if (fruit.ok && fruit.data) {
          setFruitAnalysis(fruit.data.analysis ?? null);
          setFruitEmptyReason(fruit.data.empty_reason != null ? String(fruit.data.empty_reason) : null);
        } else if (!fruit.ok) {
          setFruitErr(fruit.error || "Meyve skoru alınamadı");
        }
      } else {
        setFruitAnalysis(null);
        setFruitEmptyReason(null);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Özet alınamadı");
    } finally {
      setLoading(false);
    }
  }, [snapshotId, structureQuery, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const insightData: PortalInsightScoresBundle = {
    loading,
    err,
    invPayload,
    slopeSection,
  };

  return {
    insightData,
    loading,
    err,
    invPayload,
    slopeSection,
    fruitAnalysis,
    fruitEmptyReason,
    fruitErr,
    structureQuery,
  };
}

export default function PortalDetailScoresBlock({ snapshotId, detail, betweenMulkAndArazi }: Props) {
  const { insightData, loading, err, invPayload, fruitAnalysis, fruitEmptyReason, fruitErr, structureQuery } =
    usePortalDetailScoresData(snapshotId, detail);

  return (
    <View>
      <PortalInsightSummaryCard detail={detail} data={insightData} />
      <PortalMulkScoreDetailCard detail={detail} loading={loading} fetchError={err} invPayload={invPayload} />
      {betweenMulkAndArazi}
      <PortalAraziScoreDetailCard detail={detail} loading={loading} fetchError={err} invPayload={invPayload} />
      {!structureQuery && (
        <PortalFruitInvestmentCard
          loading={loading}
          analysis={fruitAnalysis}
          emptyReason={fruitEmptyReason}
          fetchError={fruitErr}
        />
      )}
    </View>
  );
}
