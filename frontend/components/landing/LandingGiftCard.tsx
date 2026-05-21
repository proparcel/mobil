import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LandingGlassCard } from './LandingGlassCard';
import { landingColors, landingRadii } from './landingTheme';

type Props = {
  onSignUp: () => void;
};

export function LandingGiftCard({ onSignUp }: Props) {
  return (
    <LandingGlassCard glow style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.giftLeft}>
          <View style={styles.giftIcon}>
            <Ionicons name="gift" size={22} color={landingColors.cyanBright} />
          </View>
          <View>
            <Text style={styles.giftEyebrow}>Yeni Üyelere Özel</Text>
            <Text style={styles.giftAmount}>100 Kredi</Text>
          </View>
        </View>
        <View style={styles.freePill}>
          <Text style={styles.freePillText}>BEDAVA</Text>
        </View>
      </View>

      <View style={styles.featuresRow}>
        <MiniFeature icon="shield" label="Güvenli Altyapı" />
        <View style={styles.divider} />
        <MiniFeature icon="flash" label="Hızlı Analiz" />
        <View style={styles.divider} />
        <MiniFeature icon="trophy" label="Akıllı Yatırım" />
      </View>

      <TouchableOpacity style={styles.cta} onPress={onSignUp} activeOpacity={0.88}>
        <Text style={styles.ctaText}>Üye Ol</Text>
        <Ionicons name="arrow-forward" size={20} color="#031426" />
      </TouchableOpacity>
    </LandingGlassCard>
  );
}

function MiniFeature({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.miniFeat}>
      <Ionicons name={icon as any} size={16} color={landingColors.cyan} />
      <Text style={styles.miniFeatText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  giftLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  giftIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(57, 223, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(57, 223, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftEyebrow: {
    fontSize: 12,
    color: landingColors.textMuted,
    marginBottom: 2,
  },
  giftAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: landingColors.text,
  },
  freePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: landingRadii.pill,
    backgroundColor: 'rgba(42, 220, 190, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(54, 170, 255, 0.45)',
  },
  freePillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: landingColors.cyanBright,
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  miniFeat: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  miniFeatText: {
    fontSize: 10,
    fontWeight: '600',
    color: landingColors.textSoft,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cta: {
    height: 56,
    borderRadius: landingRadii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: landingColors.cyan,
    shadowColor: landingColors.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#031426',
  },
});
