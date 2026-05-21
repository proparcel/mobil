import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LandingGlassCard } from './LandingGlassCard';
import { landingColors } from './landingTheme';

type Props = {
  onDetails: () => void;
};

export function LandingPartnerBanner({ onDetails }: Props) {
  return (
    <LandingGlassCard style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Ionicons name="people" size={24} color={landingColors.teal} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Güçlü iş ortaklarımızla daha güçlüyüz.</Text>
          <Text style={styles.desc}>
            Gayrimenkul firması, SPK lisanslı ofis veya LİHKAB bürosuysanız sistemimize katılın.
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.btn} onPress={onDetails} activeOpacity={0.85}>
        <Text style={styles.btnText}>Detaylı Bilgi</Text>
        <Ionicons name="arrow-forward" size={16} color={landingColors.text} />
      </TouchableOpacity>
    </LandingGlassCard>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(42, 220, 190, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: landingColors.text,
    marginBottom: 6,
    lineHeight: 20,
  },
  desc: {
    fontSize: 12,
    lineHeight: 17,
    color: landingColors.textMuted,
  },
  btn: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
    color: landingColors.text,
  },
});
