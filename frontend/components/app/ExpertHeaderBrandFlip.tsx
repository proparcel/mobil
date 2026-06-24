import React, { useEffect, useMemo, useRef } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { proparcelFavicon } from '../landing/proparcelBrandAssets';
import { resolveMediaUrl } from '../../src/utils/resolveMediaUrl';

const EXPERT_VISIBLE_MS = 30000;
const BRAND_VISIBLE_MS = 3000;
const FADE_DURATION_MS = 600;
const ORB_SIZE = 32;

type Props = {
  enabled: boolean;
  displayName: string;
  avatarUrl?: string | null;
  onPress?: () => void;
};

function HeaderOrb({
  children,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  return (
    <View style={styles.headerLogoOrb} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

function AvatarOrb({ uri }: { uri: string | null }) {
  if (uri) {
    return (
      <HeaderOrb accessibilityLabel="Profil fotoğrafı">
        <Image source={{ uri }} style={styles.headerLogo} resizeMode="cover" />
      </HeaderOrb>
    );
  }
  return (
    <HeaderOrb accessibilityLabel="Profil fotoğrafı yok">
      <View style={styles.avatarPlaceholder}>
        <Ionicons name="person" size={18} color="rgba(255,255,255,0.85)" />
      </View>
    </HeaderOrb>
  );
}

function BrandOrb() {
  return (
    <HeaderOrb accessibilityLabel="ProParcel">
      <Image source={proparcelFavicon} style={styles.headerLogo} resizeMode="cover" />
    </HeaderOrb>
  );
}

export default function ExpertHeaderBrandFlip({
  enabled,
  displayName,
  avatarUrl,
  onPress,
}: Props) {
  const fadeProgress = useSharedValue(1);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const resolvedAvatarUri = useMemo(
    () => resolveMediaUrl(avatarUrl),
    [avatarUrl],
  );

  const trimmedName = displayName.trim() || 'Kullanıcı';

  useEffect(() => {
    const clearTimers = () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };

    cancelAnimation(fadeProgress);

    if (!enabled) {
      fadeProgress.value = 1;
      return clearTimers;
    }

    fadeProgress.value = 0;

    const schedule = (fn: () => void, delayMs: number) => {
      const timer = setTimeout(fn, delayMs);
      timeoutsRef.current.push(timer);
    };

    const runCycle = () => {
      fadeProgress.value = 0;
      schedule(() => {
        fadeProgress.value = withTiming(1, {
          duration: FADE_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
        });
        schedule(() => {
          fadeProgress.value = withTiming(0, {
            duration: FADE_DURATION_MS,
            easing: Easing.inOut(Easing.quad),
          });
          schedule(runCycle, FADE_DURATION_MS);
        }, FADE_DURATION_MS + BRAND_VISIBLE_MS);
      }, EXPERT_VISIBLE_MS);
    };

    runCycle();

    return () => {
      clearTimers();
      cancelAnimation(fadeProgress);
    };
  }, [enabled, fadeProgress]);

  const expertFaceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fadeProgress.value, [0, 1], [1, 0]),
  }));

  const brandFaceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fadeProgress.value, [0, 1], [0, 1]),
  }));

  const content = (
    <View style={styles.flipStage}>
      <Animated.View style={[styles.face, expertFaceStyle]}>
        <View style={styles.headerCenter}>
          <AvatarOrb uri={resolvedAvatarUri} />
          <View style={styles.textColumn}>
            <Text style={styles.expertNameTitle} numberOfLines={1} ellipsizeMode="tail">
              {trimmedName}
            </Text>
            <Text style={styles.expertLabel}>Expert</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.face, brandFaceStyle]}>
        <View style={styles.headerCenter}>
          <BrandOrb />
          <Text style={styles.headerTitle} numberOfLines={1}>
            ProParcel
          </Text>
        </View>
      </Animated.View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityLabel={enabled ? `${trimmedName}, Expert` : 'ProParcel ana sayfa'}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 12 }}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  flipStage: {
    minHeight: ORB_SIZE + 4,
    minWidth: ORB_SIZE + 10 + 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  textColumn: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 180,
  },
  headerLogoOrb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 26, 55, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(57, 223, 255, 0.35)',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    flexShrink: 0,
    ...(Platform.OS === 'android' ? { elevation: 6 } : {}),
  },
  headerLogo: {
    width: ORB_SIZE,
    height: ORB_SIZE,
  },
  avatarPlaceholder: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(51, 65, 85, 0.9)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
    flexShrink: 0,
  },
  expertNameTitle: {
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.2,
    flexShrink: 1,
    marginTop: 1,
    fontFamily: Platform.select({
      ios: 'Snell Roundhand',
      android: 'cursive',
      default: 'cursive',
    }),
    fontStyle: 'italic',
  },
  expertLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(147, 223, 255, 0.85)',
    letterSpacing: 0.4,
    marginTop: -3,
  },
});
