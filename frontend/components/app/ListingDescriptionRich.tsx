import React from 'react';
import { Text, StyleSheet } from 'react-native';

export default function ListingDescriptionRich({ html, text }: { html?: string; text?: string }) {
  const content = text || (html ? html.replace(/<[^>]+>/g, ' ') : '');
  if (!content.trim()) return null;
  return <Text style={styles.body}>{content.trim()}</Text>;
}

const styles = StyleSheet.create({
  body: { fontSize: 14, color: '#334155', lineHeight: 20 },
});
