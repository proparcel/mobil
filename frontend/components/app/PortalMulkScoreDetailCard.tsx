import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = { title?: string; [key: string]: unknown };

function ScoreCard({ title }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title || 'Skor detayı'}</Text>
    </View>
  );
}

export default function PortalMulkScoreDetailCard(props: Props) {
  return <ScoreCard {...props} title={props.title || 'Mülk skoru'} />;
}

export function PortalAraziScoreDetailCard(props: Props) {
  return <ScoreCard {...props} title={props.title || 'Arazi skoru'} />;
}

const styles = StyleSheet.create({
  card: { marginVertical: 8, padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  title: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
});
