import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const SIZE = 232;
const CX = SIZE / 2;
const CY = SIZE / 2;

const COLORS = {
  bg: '#08111F',
  primary: '#2563EB',
  secondary: '#38BDF8',
  accent: '#22D3EE',
  glow: '#60A5FA',
};

type VoiceSearchListeningMode = 'idle' | 'listening' | 'processing';
type VoiceOverlayLabelTone = 'idle' | 'active' | 'processing';

type Props = {
  mode: VoiceSearchListeningMode;
  audioLevel?: number;
  overlayLabel?: string;
  overlayLabelTone?: VoiceOverlayLabelTone;
  /** Varsayılan 232; ana sayfa orb için ~108 */
  size?: number;
  /** Koyu kutu arka planını kaldırır */
  transparentBackground?: boolean;
  /** Harita üstü orb: yarı saydam koyu dolgu */
  mapOrbBackground?: boolean;
  /** İğne boyutu çarpanı (varsayılan 1) */
  pinScale?: number;
  /** Küçük boyutta overlay yazısı */
  compactLabel?: boolean;
};

function buildContourPath(
  radius: number,
  irregularity: number,
  phase: number,
  squashY = 0.9
): string {
  const steps = 56;
  let path = '';
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const wobble =
      1 +
      irregularity *
        (Math.sin(t * 3 + phase) * 0.1 +
          Math.sin(t * 5 - phase * 1.2) * 0.06 +
          Math.cos(t * 2 + phase * 0.8) * 0.05);
    const x = CX + Math.cos(t) * radius * wobble;
    const y = CY + Math.sin(t) * radius * wobble * squashY;
    path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return `${path} Z`;
}

const CONTOURS = [
  { radius: 34, irregularity: 0.55, phase: 0.2, opacity: 0.34 },
  { radius: 46, irregularity: 0.62, phase: 0.9, opacity: 0.3 },
  { radius: 58, irregularity: 0.68, phase: 1.6, opacity: 0.26 },
  { radius: 70, irregularity: 0.72, phase: 2.3, opacity: 0.22 },
  { radius: 82, irregularity: 0.76, phase: 3.1, opacity: 0.18 },
  { radius: 94, irregularity: 0.8, phase: 3.9, opacity: 0.14 },
  { radius: 106, irregularity: 0.84, phase: 4.7, opacity: 0.1 },
];

export default function VoiceSearchListeningAnimation({
  mode,
  audioLevel = 0,
  overlayLabel,
  overlayLabelTone = 'idle',
  size = SIZE,
  transparentBackground = false,
  mapOrbBackground = false,
  pinScale = 1,
  compactLabel = false,
}: Props) {
  const levelSv = useSharedValue(0);
  const breatheSv = useSharedValue(1);
  const rotateSv = useSharedValue(0);
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);
  const pulse3 = useSharedValue(0);
  const driftSv = useSharedValue(0);
  const lineBoostSv = useSharedValue(1);

  const contourPaths = useMemo(
    () => CONTOURS.map((c) => buildContourPath(c.radius, c.irregularity, c.phase)),
    []
  );

  useEffect(() => {
    levelSv.value = withTiming(audioLevel, { duration: 120, easing: Easing.out(Easing.quad) });
  }, [audioLevel, levelSv]);

  useEffect(() => {
    // Harita üstü orb: idle iken sürekli SVG/Reanimated döngüsü tüm UI'ı yavaşlatıyor
    if (mode === 'idle' && mapOrbBackground) {
      breatheSv.value = 1;
      rotateSv.value = 0;
      driftSv.value = 0;
      pulse1.value = 0;
      pulse2.value = 0;
      pulse3.value = 0;
      lineBoostSv.value = 1;
      return;
    }

    const breatheMs =
      mode === 'listening' ? 1800 : mode === 'processing' ? 2400 : 3000;
    const rotateMs =
      mode === 'listening' ? 14000 : mode === 'processing' ? 20000 : 26000;
    const pulseDuration =
      mode === 'listening' ? 2200 : mode === 'processing' ? 3200 : 4200;

    breatheSv.value = withRepeat(
      withSequence(
        withTiming(mode === 'idle' ? 1.03 : 1.05, {
          duration: breatheMs,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(1, {
          duration: breatheMs,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      false
    );
    rotateSv.value = withRepeat(
      withTiming(360, {
        duration: rotateMs,
        easing: Easing.linear,
      }),
      -1,
      false
    );
    driftSv.value = withRepeat(
      withSequence(
        withTiming(1, { duration: mode === 'idle' ? 3200 : 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: mode === 'idle' ? 3200 : 2600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    pulse1.value = withRepeat(
      withTiming(1, { duration: pulseDuration, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    pulse2.value = withRepeat(
      withSequence(
        withTiming(0, { duration: pulseDuration * 0.33 }),
        withTiming(1, { duration: pulseDuration * 0.67, easing: Easing.out(Easing.quad) })
      ),
      -1,
      false
    );
    pulse3.value = withRepeat(
      withSequence(
        withTiming(0, { duration: pulseDuration * 0.66 }),
        withTiming(1, { duration: pulseDuration * 0.34, easing: Easing.out(Easing.quad) })
      ),
      -1,
      false
    );
  }, [mode, mapOrbBackground, breatheSv, rotateSv, driftSv, pulse1, pulse2, pulse3, lineBoostSv]);

  useEffect(() => {
    const target =
      mode === 'listening' ? 1.82 : mode === 'processing' ? 1.55 : 1;
    lineBoostSv.value = withTiming(target, {
      duration: mode === 'idle' ? 260 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [mode, lineBoostSv]);

  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breatheSv.value + levelSv.value * 0.08 }],
  }));

  const scanRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateSv.value}deg` }],
    opacity: 0.35 + levelSv.value * 0.35 + (mode === 'processing' ? 0.15 : 0),
  }));

  const contourStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: 1 + levelSv.value * 0.14 + driftSv.value * 0.015 },
      { scaleY: 1 + levelSv.value * 0.1 - driftSv.value * 0.012 },
      { rotate: `${driftSv.value * 2.5 + levelSv.value * 3}deg` },
    ],
  }));

  const pulseBase =
    mapOrbBackground && mode === 'processing'
      ? 0.3
      : mode === 'idle'
        ? 0.1
        : mode === 'processing'
          ? 0.14
          : 0.22;
  const baseMapLineWeight = mapOrbBackground ? 2.55 : 1;
  const mapContourOpacityBoost =
    mapOrbBackground
      ? mode === 'listening'
        ? 2.15
        : mode === 'processing'
          ? 1.95
          : 1.75
      : mode === 'listening'
        ? 1.38
        : mode === 'processing'
          ? 1.22
          : 1;

  const pulse1Props = useAnimatedProps(() => ({
    r: 28 + pulse1.value * 78,
    opacity: (1 - pulse1.value) * (pulseBase + levelSv.value * 0.18),
    strokeWidth: 1.15 * baseMapLineWeight * lineBoostSv.value,
  }));
  const pulse2Props = useAnimatedProps(() => ({
    r: 28 + pulse2.value * 78,
    opacity: (1 - pulse2.value) * (pulseBase * 0.75 + levelSv.value * 0.14),
    strokeWidth: 1.05 * baseMapLineWeight * lineBoostSv.value,
  }));
  const pulse3Props = useAnimatedProps(() => ({
    r: 28 + pulse3.value * 78,
    opacity: (1 - pulse3.value) * (pulseBase * 0.55 + levelSv.value * 0.12),
    strokeWidth: 0.95 * baseMapLineWeight * lineBoostSv.value,
  }));

  const contourAnimatedProps = useAnimatedProps(() => ({
    strokeWidth: (1.12 + levelSv.value * 0.95) * baseMapLineWeight * lineBoostSv.value,
  }));

  const scanRingStroke =
    mode === 'listening' ? 1.82 : mode === 'processing' ? 1.55 : 1;

  const pinW = 42 * pinScale;
  const pinH = 52 * pinScale;
  const glowGradientId = mapOrbBackground ? 'mapOrbRadialGlow' : 'bgGlow';
  const glowRadius = mapOrbBackground ? SIZE * 0.52 : SIZE * 0.48;

  return (
    <View
      style={[
        styles.wrap,
        mapOrbBackground && styles.wrapMapOrb,
        { width: size, height: size },
        mapOrbBackground && { borderRadius: size / 2, overflow: 'hidden' as const },
      ]}
    >
      <View
        style={[
          styles.canvas,
          { width: size, height: size },
          transparentBackground && !mapOrbBackground && styles.canvasTransparent,
          mapOrbBackground && styles.canvasMapOrb,
          mapOrbBackground && { borderRadius: size / 2, overflow: 'hidden' as const },
        ]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Defs>
            {mapOrbBackground ? (
              <RadialGradient id="mapOrbRadialGlow" cx="50%" cy="44%" r="58%">
                <Stop offset="0%" stopColor={COLORS.primary} stopOpacity="0.58" />
                <Stop offset="20%" stopColor={COLORS.secondary} stopOpacity="0.36" />
                <Stop offset="42%" stopColor={COLORS.bg} stopOpacity="0.22" />
                <Stop offset="62%" stopColor={COLORS.bg} stopOpacity="0.13" />
                <Stop offset="80%" stopColor={COLORS.bg} stopOpacity="0.06" />
                <Stop offset="92%" stopColor={COLORS.bg} stopOpacity="0.02" />
                <Stop offset="100%" stopColor={COLORS.bg} stopOpacity="0" />
              </RadialGradient>
            ) : (
              <RadialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
                <Stop
                  offset="0%"
                  stopColor={COLORS.primary}
                  stopOpacity={transparentBackground ? '0.14' : '0.22'}
                />
                <Stop
                  offset="55%"
                  stopColor={COLORS.secondary}
                  stopOpacity={transparentBackground ? '0.05' : '0.08'}
                />
                <Stop offset="100%" stopColor={COLORS.bg} stopOpacity="0" />
              </RadialGradient>
            )}
            <LinearGradient id="pinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={COLORS.accent} />
              <Stop offset="100%" stopColor={COLORS.primary} />
            </LinearGradient>
          </Defs>

          <Circle cx={CX} cy={CY} r={glowRadius} fill={`url(#${glowGradientId})`} />

          <AnimatedCircle
            cx={CX}
            cy={CY}
            fill="none"
            stroke={COLORS.glow}
            animatedProps={pulse1Props}
          />
          <AnimatedCircle
            cx={CX}
            cy={CY}
            fill="none"
            stroke={COLORS.secondary}
            animatedProps={pulse2Props}
          />
          <AnimatedCircle
            cx={CX}
            cy={CY}
            fill="none"
            stroke={COLORS.accent}
            animatedProps={pulse3Props}
          />

          <AnimatedG animatedProps={contourAnimatedProps}>
            <AnimatedG style={contourStyle}>
              {CONTOURS.map((contour, index) => (
                <AnimatedPath
                  key={`contour-${index}`}
                  d={contourPaths[index]}
                  fill="none"
                  stroke={index % 2 === 0 ? COLORS.secondary : COLORS.glow}
                  strokeOpacity={Math.min(contour.opacity * mapContourOpacityBoost, 0.52)}
                  animatedProps={contourAnimatedProps}
                />
              ))}
            </AnimatedG>
          </AnimatedG>

          <AnimatedG style={scanRingStyle}>
            <Circle
              cx={CX}
              cy={CY}
              r={112}
              fill="none"
              stroke={COLORS.primary}
              strokeOpacity={mapOrbBackground ? 0.38 : 0.28}
              strokeWidth={1.15 * baseMapLineWeight * scanRingStroke}
              strokeDasharray={mapOrbBackground ? '10 12' : '8 14'}
            />
            <Circle
              cx={CX}
              cy={CY}
              r={118}
              fill="none"
              stroke={COLORS.accent}
              strokeOpacity={mapOrbBackground ? 0.22 : 0.14}
              strokeWidth={1 * baseMapLineWeight * scanRingStroke}
              strokeDasharray={mapOrbBackground ? '6 14' : '4 18'}
            />
          </AnimatedG>
        </Svg>

        <View style={mapOrbBackground ? styles.pinWrapMapOrbOffset : undefined}>
          <Animated.View style={[styles.pinWrap, mapOrbBackground && styles.pinWrapMapOrb, pinStyle]}>
            <Svg width={pinW} height={pinH} viewBox="0 0 24 24">
              <Defs>
                <RadialGradient id="pinGlow" cx="50%" cy="35%" r="60%">
                  <Stop offset="0%" stopColor={COLORS.glow} stopOpacity="0.95" />
                  <Stop offset="100%" stopColor={COLORS.primary} stopOpacity="0.85" />
                </RadialGradient>
              </Defs>
              <Path
                d="M12 2c-3.87 0-7 3.13-7 7 0 5.02 5.12 10.36 6.42 11.72a1.2 1.2 0 001.16.28c.38-.1.72-.34.98-.66C15.1 18.8 19 13.8 19 9c0-3.87-3.13-7-7-7z"
                fill="url(#pinGlow)"
              />
              <Circle cx={12} cy={9} r={2.6} fill={COLORS.bg} fillOpacity={0.55} />
              <Circle cx={12} cy={9} r={1.2} fill={COLORS.accent} />
            </Svg>
          </Animated.View>
        </View>

        {overlayLabel && !mapOrbBackground ? (
          <View
            style={[styles.overlayLabelWrap]}
            pointerEvents="none"
          >
            <View style={styles.overlayLabelPill}>
              <Text
                style={[
                  styles.overlayLabel,
                  compactLabel && styles.overlayLabelCompact,
                  overlayLabelTone === 'active' && styles.overlayLabelActive,
                  overlayLabelTone === 'processing' && styles.overlayLabelProcessing,
                  transparentBackground && styles.overlayLabelOnMap,
                ]}
              >
                {overlayLabel}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  wrapMapOrb: {
    overflow: 'hidden',
    paddingVertical: 0,
  },
  canvas: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.28)',
    overflow: 'hidden',
  },
  canvasTransparent: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  canvasMapOrb: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    overflow: 'hidden',
    shadowOpacity: 0,
    elevation: 0,
  },
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.glow,
    shadowOpacity: 0.65,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  pinWrapMapOrb: {
    shadowOpacity: 0,
    elevation: 0,
  },
  pinWrapMapOrbOffset: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -10 }],
  },
  overlayLabelWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 4,
  },
  overlayLabelWrapMapOrb: {
    top: undefined,
    bottom: 5,
    left: 0,
    right: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  overlayLabelPill: {
    maxWidth: '100%',
  },
  overlayLabelPillMapOrb: {
    backgroundColor: 'rgba(8, 17, 31, 0.84)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.42)',
    maxWidth: '94%',
  },
  overlayLabelPillActive: {
    backgroundColor: 'rgba(8, 47, 73, 0.88)',
    borderColor: 'rgba(34, 211, 238, 0.45)',
  },
  overlayLabelPillProcessing: {
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
    borderColor: 'rgba(96, 165, 250, 0.38)',
  },
  overlayLabel: {
    color: 'rgba(186, 230, 253, 0.92)',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.25,
    textAlign: 'center',
    textShadowColor: 'rgba(8, 17, 31, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  overlayLabelCompact: {
    fontSize: 11,
    letterSpacing: 0.15,
  },
  overlayLabelMapOrb: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 10,
  },
  overlayLabelInPill: {
    textShadowColor: 'transparent',
    textShadowRadius: 0,
  },
  overlayLabelOnMap: {
    textShadowColor: 'rgba(15, 23, 42, 0.88)',
  },
  overlayLabelActive: {
    color: 'rgba(34, 211, 238, 0.96)',
    fontWeight: '500',
  },
  overlayLabelProcessing: {
    color: 'rgba(147, 197, 253, 0.94)',
    fontWeight: '400',
  },
});
