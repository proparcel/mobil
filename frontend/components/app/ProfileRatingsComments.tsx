/**
 * Portal agent ratings — size yapılan değerlendirmeler ve yorumlar (GET .../agent-ratings/).
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { getPortalUserAgentRatings } from "../../services/portalService";

export type AgentRatingItem = {
  id: number;
  reviewer_display_name?: string;
  star_subject_mastery?: number;
  star_courtesy?: number;
  star_communication?: number;
  star_trust?: number;
  avg_overall?: number | null;
  comment?: string | null;
  created_at?: string | null;
  is_mine?: boolean;
};

type Agg = {
  count?: number;
  avg_overall?: number | null;
  avg_subject_mastery?: number | null;
  avg_courtesy?: number | null;
  avg_communication?: number | null;
  avg_trust?: number | null;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ProfileRatingsComments({ userId }: { userId: number }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [agg, setAgg] = useState<Agg | null>(null);
  const [items, setItems] = useState<AgentRatingItem[]>([]);

  const load = useCallback(async () => {
    setErr("");
    const res = await getPortalUserAgentRatings(userId);
    if (!res.ok || !res.data) {
      setErr(typeof res.error === "string" ? res.error : "Liste yüklenemedi.");
      setAgg(null);
      setItems([]);
    } else {
      const d = res.data as {
        aggregate?: Agg;
        items?: unknown[];
      };
      setAgg(d.aggregate ?? null);
      const raw = Array.isArray(d.items) ? d.items : [];
      setItems(
        raw.map((x) => {
          const o = x as Record<string, unknown>;
          return {
            id: Number(o.id),
            reviewer_display_name: String(o.reviewer_display_name ?? ""),
            star_subject_mastery: o.star_subject_mastery != null ? Number(o.star_subject_mastery) : undefined,
            star_courtesy: o.star_courtesy != null ? Number(o.star_courtesy) : undefined,
            star_communication: o.star_communication != null ? Number(o.star_communication) : undefined,
            star_trust: o.star_trust != null ? Number(o.star_trust) : undefined,
            avg_overall: o.avg_overall != null ? Number(o.avg_overall) : null,
            comment: o.comment != null ? String(o.comment) : null,
            created_at: o.created_at != null ? String(o.created_at) : null,
            is_mine: Boolean(o.is_mine),
          };
        }),
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#3b82f6" />
        <Text style={s.muted}>Değerlendirmeler yükleniyor…</Text>
      </View>
    );
  }

  const n = agg?.count ?? 0;
  const avg = agg?.avg_overall;

  return (
    <View style={s.wrap}>
      {err ? <Text style={s.err}>{err}</Text> : null}

      <View style={s.card}>
        <Text style={s.cardTitle}>Özet</Text>
        <View style={s.aggRow}>
          <View style={s.aggCell}>
            <Text style={s.aggLabel}>Genel ort.</Text>
            <Text style={s.aggVal}>
              {avg != null && Number.isFinite(avg) ? avg.toFixed(1) : "—"}
            </Text>
          </View>
          <View style={s.aggCell}>
            <Text style={s.aggLabel}>Kayıt</Text>
            <Text style={s.aggVal}>{n}</Text>
          </View>
        </View>
        <View style={s.dims}>
          <Dim label="Konu hakimiyeti" v={agg?.avg_subject_mastery} />
          <Dim label="Nezaket" v={agg?.avg_courtesy} />
          <Dim label="İletişim" v={agg?.avg_communication} />
          <Dim label="Güven" v={agg?.avg_trust} />
        </View>
        <Text style={s.hint}>
          Liste son 50 değerlendirmeyi gösterir. Detaylar web profilinizle aynı kaynaktan gelir.
        </Text>
      </View>

      <Text style={s.sectionH}>Yorumlar</Text>
      {!items.length ? (
        <View style={s.emptyBox}>
          <Ionicons name="chatbubble-outline" size={40} color="#cbd5e1" />
          <Text style={s.emptyTxt}>Henüz değerlendirme veya yorum yok.</Text>
        </View>
      ) : (
        items.map((it) => (
          <View key={it.id} style={s.item}>
            <View style={s.itemHead}>
              <Text style={s.itemName}>{it.reviewer_display_name || "Değerlendirme"}</Text>
              <Text style={s.itemDate}>{fmtDate(it.created_at)}</Text>
            </View>
            <Text style={s.itemStars}>
              Ortalama:{" "}
              {it.avg_overall != null && Number.isFinite(it.avg_overall)
                ? it.avg_overall.toFixed(1)
                : "—"}{" "}
              / 5
              {it.is_mine ? <Text style={s.badgeMine}> (sizin kaydınız)</Text> : null}
            </Text>
            <Text style={s.itemDims}>
              Konu {it.star_subject_mastery ?? "—"} · Nezaket {it.star_courtesy ?? "—"} · İletişim{" "}
              {it.star_communication ?? "—"} · Güven {it.star_trust ?? "—"}
            </Text>
            {it.comment ? <Text style={s.itemComment}>{it.comment}</Text> : null}
          </View>
        ))
      )}
    </View>
  );
}

function Dim({ label, v }: { label: string; v?: number | null }) {
  const t = v != null && Number.isFinite(v) ? v.toFixed(1) : "—";
  return (
    <View style={s.dimRow}>
      <Text style={s.dimL}>{label}</Text>
      <Text style={s.dimV}>{t}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingBottom: 28 },
  center: { paddingVertical: 32, alignItems: "center" },
  muted: { marginTop: 8, fontSize: 13, color: "#64748b" },
  err: { color: "#b91c1c", fontSize: 14, marginBottom: 10, paddingHorizontal: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 12 },
  aggRow: { flexDirection: "row", marginBottom: 12 },
  aggCell: { flex: 1, padding: 10, backgroundColor: "#f8fafc", borderRadius: 10, marginRight: 8 },
  aggLabel: { fontSize: 11, color: "#64748b", fontWeight: "600", textTransform: "uppercase" },
  aggVal: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginTop: 4 },
  dims: { marginTop: 4 },
  dimRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dimL: { fontSize: 13, color: "#64748b", flex: 1 },
  dimV: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  hint: { marginTop: 10, fontSize: 12, color: "#94a3b8", lineHeight: 17 },
  sectionH: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 10,
    marginTop: 4,
  },
  emptyBox: { alignItems: "center", paddingVertical: 28 },
  emptyTxt: { marginTop: 8, fontSize: 14, color: "#64748b", textAlign: "center" },
  item: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  itemHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#0f172a", flex: 1, paddingRight: 8 },
  itemDate: { fontSize: 11, color: "#94a3b8" },
  itemStars: { fontSize: 14, fontWeight: "600", color: "#b45309", marginBottom: 6 },
  badgeMine: { fontSize: 12, color: "#2563eb", fontWeight: "600" },
  itemDims: { fontSize: 11, color: "#64748b", marginBottom: 8, lineHeight: 16 },
  itemComment: { fontSize: 14, color: "#334155", lineHeight: 21 },
});
