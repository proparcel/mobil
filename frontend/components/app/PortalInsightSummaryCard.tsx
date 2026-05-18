import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = { title?: string; summary?: string; [key: string]: unknown };

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
  card: { marginVertical: 8, padding: 14, backgroundColor: '#f8fafc', borderRadius: 12 },
  title: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  body: { fontSize: 13, color: '#475569', lineHeight: 18 },
});
