import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  message: string;
};

/** Web `.pp-detail-credit-notice` — modal kapansa bile görünür kalır. */
export default function PortalProQueryCreditNoticeBanner({ message }: Props) {
  const text = String(message || '').trim();
  if (!text) {
    return null;
  }

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
    backgroundColor: '#ecfdf5',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#14532d',
    textAlign: 'center',
  },
});
