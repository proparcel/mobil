import React, { type ReactNode, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const BAR_HEIGHT = 30;
const CREDIT_PILL_HEIGHT = 30;
const NOTCH_RADIUS = 14;
const PILL_GAP = 4;
const WING_OUTER_RADIUS = 10;

type WingSide = 'left' | 'right';

type Props = {
  isAuthenticated: boolean;
  creditLabel: string;
  onCreditPress: () => void;
  onEmlakVitriniPress: () => void;
  onMenuPress: () => void;
  onTumProSorgularPress: () => void;
};

type WingButtonProps = {
  side: WingSide;
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
  icon: ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
};

function buildWingFillPath(side: WingSide, width: number, height: number, notchR: number): string {
  const cy = height / 2;
  if (side === 'left') {
    return [
      `M 0 ${WING_OUTER_RADIUS}`,
      `Q 0 0 ${WING_OUTER_RADIUS} 0`,
      `H ${width}`,
      `V ${cy - notchR}`,
      // sweep=0 → kavis pille doğru içbükey
      `A ${notchR} ${notchR} 0 0 0 ${width} ${cy + notchR}`,
      `V ${height}`,
      `H ${WING_OUTER_RADIUS}`,
      `Q 0 ${height} 0 ${height - WING_OUTER_RADIUS}`,
      'Z',
    ].join(' ');
  }

  return [
    `M ${width} ${WING_OUTER_RADIUS}`,
    `Q ${width} 0 ${width - WING_OUTER_RADIUS} 0`,
    'H 0',
    `V ${cy - notchR}`,
    `Q ${notchR} ${cy} 0 ${cy + notchR}`,
    `V ${height}`,
    `H ${width - WING_OUTER_RADIUS}`,
    `Q ${width} ${height} ${width} ${height - WING_OUTER_RADIUS}`,
    'Z',
  ].join(' ');
}

function buildWingConcaveBorderPath(
  side: WingSide,
  width: number,
  height: number,
  notchR: number,
): string {
  const cy = height / 2;
  if (side === 'left') {
    return `M ${width} ${cy - notchR} A ${notchR} ${notchR} 0 0 0 ${width} ${cy + notchR}`;
  }
  return `M 0 ${cy - notchR} Q ${notchR} ${cy} 0 ${cy + notchR}`;
}

function buildWingOuterBorderPath(side: WingSide, width: number, height: number): string {
  const r = WING_OUTER_RADIUS;
  if (side === 'left') {
    return [
      `M 0 ${r}`,
      `Q 0 0 ${r} 0`,
      `H ${width - NOTCH_RADIUS * 0.35}`,
      `M 0 ${height - r}`,
      `Q 0 ${height} ${r} ${height}`,
      `H ${width - NOTCH_RADIUS * 0.35}`,
      `M 0 ${r}`,
      `V ${height - r}`,
    ].join(' ');
  }

  return [
    `M ${width} ${r}`,
    `Q ${width} 0 ${width - r} 0`,
    `H ${NOTCH_RADIUS * 0.35}`,
    `M ${width} ${height - r}`,
    `Q ${width} ${height} ${width - r} ${height}`,
    `H ${NOTCH_RADIUS * 0.35}`,
    `M ${width} ${r}`,
    `V ${height - r}`,
  ].join(' ');
}

function WingButtonSurface({
  children,
  side,
  pressed,
}: {
  children: ReactNode;
  side: WingSide;
  pressed?: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: BAR_HEIGHT });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setSize({ width, height });
    }
  };

  const fillPath =
    size.width > 0 ? buildWingFillPath(side, size.width, size.height, NOTCH_RADIUS) : '';
  const outerBorderPath =
    size.width > 0 ? buildWingOuterBorderPath(side, size.width, size.height) : '';
  const concaveBorderPath =
    size.width > 0
      ? buildWingConcaveBorderPath(side, size.width, size.height, NOTCH_RADIUS)
      : '';
  const borderColor = pressed ? 'rgba(45, 130, 255, 0.72)' : 'rgba(95, 150, 220, 0.34)';
  const concaveBorderColor = pressed ? 'rgba(59, 130, 246, 0.55)' : 'rgba(59, 130, 246, 0.32)';

  return (
    <View style={styles.wingSurface} onLayout={onLayout}>
      {size.width > 0 ? (
        <Svg
          width={size.width}
          height={size.height}
          style={styles.wingSvg}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id={`wingFill-${side}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="rgba(31, 51, 78, 0.98)" />
              <Stop offset="0.45" stopColor="rgba(17, 32, 55, 0.98)" />
              <Stop offset="1" stopColor="rgba(8, 20, 38, 0.99)" />
            </LinearGradient>
          </Defs>
          <Path d={fillPath} fill={`url(#wingFill-${side})`} />
          {pressed ? <Path d={fillPath} fill="rgba(45, 130, 255, 0.12)" /> : null}
          <Path
            d={outerBorderPath}
            fill="none"
            stroke={borderColor}
            strokeWidth={1}
            strokeLinejoin="round"
          />
          <Path
            d={concaveBorderPath}
            fill="none"
            stroke={concaveBorderColor}
            strokeWidth={1}
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
      <View style={styles.wingInner}>{children}</View>
    </View>
  );
}

function WingButton({
  side,
  onPress,
  accessibilityLabel,
  testID,
  icon,
  label,
  style,
}: WingButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.wingPressable, style]}
    >
      {({ pressed }) => (
        <WingButtonSurface side={side} pressed={pressed}>
          {icon}
          <Text style={styles.wingLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>
            {label}
          </Text>
        </WingButtonSurface>
      )}
    </Pressable>
  );
}

export function HeaderMapActionBar({
  isAuthenticated,
  creditLabel,
  onCreditPress,
  onEmlakVitriniPress,
  onMenuPress,
  onTumProSorgularPress,
}: Props) {
  return (
    <View testID="header-map-action-bar" style={styles.bar} pointerEvents="box-none">
      <View style={styles.row}>
        <WingButton
          testID="header-action-emlak-vitrini"
          side="left"
          onPress={onEmlakVitriniPress}
          accessibilityLabel="Emlak Vitrini"
          icon={<Ionicons name="storefront-outline" size={14} color="#fff" />}
          label="Emlak Vitrini"
          style={styles.wingLeft}
        />

        <TouchableOpacity
          testID="credit-badge"
          onPress={onCreditPress}
          activeOpacity={0.82}
          accessibilityLabel="Kredi bakiyesi"
          style={styles.creditPill}
        >
          <Text style={styles.creditPillLabel} numberOfLines={1}>
            {creditLabel}
          </Text>
        </TouchableOpacity>

        {isAuthenticated ? (
          <WingButton
            testID="header-action-tum-pro-sorgular"
            side="right"
            onPress={onTumProSorgularPress}
            accessibilityLabel="Tüm Pro Sorgular"
            icon={<Ionicons name="calendar-outline" size={14} color="#fff" />}
            label="Tüm Pro Sorgular"
            style={styles.wingRight}
          />
        ) : (
          <WingButton
            testID="header-action-menu"
            side="right"
            onPress={onMenuPress}
            accessibilityLabel="Menü"
            icon={<MaterialCommunityIcons name="menu" size={15} color="#fff" />}
            label="Menü"
            style={styles.wingRight}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 5,
    borderBottomWidth: StyleSheet.hairlineWidth + 0.5,
    borderBottomColor: 'rgba(59, 130, 246, 0.28)',
    zIndex: 21,
    ...(Platform.OS === 'android' ? { elevation: 12 } : {}),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: BAR_HEIGHT,
    gap: PILL_GAP,
  },
  creditPill: {
    height: CREDIT_PILL_HEIGHT,
    minWidth: 72,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 4,
    ...(Platform.OS === 'android' ? { elevation: 10 } : {}),
  },
  creditPillLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  wingPressable: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  wingLeft: {
    marginRight: 0,
  },
  wingRight: {
    marginLeft: 0,
  },
  wingSurface: {
    flex: 1,
    minHeight: BAR_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  wingSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  wingInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    zIndex: 2,
  },
  wingLabel: {
    color: '#fff',
    fontSize: 10.5,
    fontWeight: '600',
    flexShrink: 1,
  },
});
