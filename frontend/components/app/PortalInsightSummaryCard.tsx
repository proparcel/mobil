import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PortalInvestmentScorePayload } from '../../src/types/portal';

export type PortalInsightScoresBundle = {
  loading: boolean;
  err: string | null;
  invPayload: PortalInvestmentScorePayload | null;
  slopeSection: Record<string, unknown> | null;
};

type Props = {
  title?: string;
  summary?: string;
  detail?: unknown;
  data?: PortalInsightScoresBundle;
};

export default function PortalInsightSummaryCard({ title, summary }: Props) {
  if (!title && !summary) return null;
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {summary ? <Text style={styles.body}>{summary}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, marginVertical: 8, padding: 14, backgroundColor: '#f8fafc', borderRadius: 12 },
  title: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  body: { fontSize: 13, color: '#475569', lineHeight: 18 },
});
