import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PORTAL_UNVERIFIED_PRICE_WARNING_TEXT } from '../../src/utils/portalPriceStatus';

type Props = {
  onExpertRequest?: () => void;
  showExpertButton?: boolean;
};

export default function PortalKmUnverifiedWarning({ onExpertRequest, showExpertButton = true }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <View style={styles.iconWrap}>
        <Ionicons name="warning-outline" size={20} color="#c2410c" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Tahmini fiyat uyarısı</Text>
        <Text style={styles.text}>{PORTAL_UNVERIFIED_PRICE_WARNING_TEXT}</Text>
        {showExpertButton && onExpertRequest ? (
          <Pressable style={styles.action} onPress={onExpertRequest} accessibilityRole="button">
            <Text style={styles.actionText}>Uzman Görüşü</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
    marginBottom: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffedd5',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9a3412',
    marginBottom: 6,
  },
  text: {
    fontSize: 13,
    lineHeight: 20,
    color: '#7c2d12',
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
