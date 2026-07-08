import React, { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const MENU_HEIGHT = 80;
const SEGMENT_GAP = 3;
const SEGMENT_RADIUS = 8;

type Props = {
  isProMode?: boolean;
  isSimpleActive?: boolean;
  isProActive?: boolean;
  proDisabled?: boolean;
  onVoiceQueryPress: () => void;
  onImageQueryPress: () => void;
  onBasicQueryPress: () => void;
  onMenuPress: () => void;
  onSearchPress: () => void;
  onProQueryPress: () => void;
  style?: StyleProp<ViewStyle>;
};

type ButtonSurfaceProps = {
  children: ReactNode;
  pressed?: boolean;
  active?: boolean;
  disabled?: boolean;
  contentDirection?: 'row' | 'column';
  style?: StyleProp<ViewStyle>;
};

function ButtonSurface({
  children,
  pressed,
  active,
  disabled,
  contentDirection = 'row',
  style,
}: ButtonSurfaceProps) {
  return (
    <View
      style={[
        styles.buttonSurface,
        active && styles.buttonSurfaceActive,
        pressed && styles.buttonSurfacePressed,
        disabled && styles.buttonSurfaceDisabled,
        style,
      ]}
    >
      <View style={styles.gradientLayerTop} pointerEvents="none" />
      <View style={styles.gradientLayerMid} pointerEvents="none" />
      <View style={styles.gradientLayerBottom} pointerEvents="none" />
      {pressed ? <View style={styles.pressedOverlay} pointerEvents="none" /> : null}
      {active ? <View style={styles.activeOverlay} pointerEvents="none" /> : null}
      {active ? <View style={styles.activeGlow} pointerEvents="none" /> : null}
      <View
        style={[styles.buttonTopHighlight, active && styles.buttonTopHighlightActive]}
        pointerEvents="none"
      />
      <View style={styles.buttonInnerShadow} pointerEvents="none" />
      {active ? <View style={styles.activeBottomBar} pointerEvents="none" /> : null}
      <View
        style={[
          styles.buttonInner,
          contentDirection === 'column' && styles.buttonInnerColumn,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

type SegmentPressableProps = {
  onPress: () => void;
  disabled?: boolean;
  /** Pasif görünüm; dokunma engellenmez (Pro Sorgu giriş uyarısı için). */
  visuallyDisabled?: boolean;
  testID?: string;
  accessibilityLabel: string;
  surfaceStyle?: StyleProp<ViewStyle>;
  active?: boolean;
  contentDirection?: 'row' | 'column';
  children: ReactNode;
  flex?: number;
  width?: number;
};

function SegmentPressable({
  onPress,
  disabled,
  visuallyDisabled,
  testID,
  accessibilityLabel,
  surfaceStyle,
  active,
  contentDirection = 'row',
  children,
  flex,
  width,
}: SegmentPressableProps) {
  const showDisabledStyle = Boolean(disabled || visuallyDisabled);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        flex != null ? { flex } : null,
        width != null ? { width, flexGrow: 0, flexShrink: 0 } : null,
        styles.segmentPressable,
      ]}
    >
      {({ pressed }) => (
        <ButtonSurface
          pressed={pressed && !disabled}
          active={active}
          disabled={showDisabledStyle}
          contentDirection={contentDirection}
          style={surfaceStyle}
        >
          {children}
        </ButtonSurface>
      )}
    </Pressable>
  );
}

export function BottomQueryMenu({
  isProMode = false,
  isSimpleActive = false,
  isProActive = false,
  proDisabled = false,
  onVoiceQueryPress,
  onImageQueryPress,
  onBasicQueryPress,
  onMenuPress,
  onSearchPress,
  onProQueryPress,
  style,
}: Props) {
  return (
    <View testID="query-action-bar" style={[styles.row, style]}>
      <View style={styles.leftBlock}>
        <SegmentPressable
          testID="query-action-voice"
          onPress={onVoiceQueryPress}
          accessibilityLabel="Sesli Sorgu"
          flex={1}
        >
          <Ionicons name="mic-outline" size={14} color="#fff" />
          <Text style={styles.compactLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            Sesli Sorgu
          </Text>
        </SegmentPressable>
        <SegmentPressable
          testID="query-action-image"
          onPress={onImageQueryPress}
          accessibilityLabel="Resimden Sorgu"
          flex={1}
        >
          <Ionicons name="image-outline" size={14} color="#fff" />
          <Text style={styles.compactLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            Resimden Sorgu
          </Text>
        </SegmentPressable>
      </View>

      <SegmentPressable
        testID="query-action-simple"
        onPress={onBasicQueryPress}
        accessibilityLabel="Basit Sorgu"
        flex={1}
        active={isSimpleActive}
        contentDirection="column"
      >
        <MaterialCommunityIcons
          name="cursor-default-outline"
          size={20}
          color={isSimpleActive ? '#93dfee' : '#fff'}
        />
        <Text style={[styles.mainLabel, isSimpleActive && styles.mainLabelActive]} numberOfLines={1}>
          Basit Sorgu
        </Text>
      </SegmentPressable>

      <View style={styles.middleBlock}>
        <SegmentPressable
          testID="query-action-my-queries"
          onPress={onMenuPress}
          accessibilityLabel="Sorgularım"
          flex={1}
        >
          <Ionicons name="menu" size={18} color="#fff" />
        </SegmentPressable>
        <SegmentPressable
          testID="query-action-search"
          onPress={onSearchPress}
          accessibilityLabel="Ara"
          flex={1}
        >
          <Ionicons name="search" size={17} color="#fff" />
        </SegmentPressable>
      </View>

      <SegmentPressable
        testID="query-action-pro"
        onPress={onProQueryPress}
        accessibilityLabel="Pro Sorgu"
        flex={1}
        active={isProActive}
        contentDirection="column"
        visuallyDisabled={proDisabled}
      >
        <MaterialCommunityIcons
          name="cursor-default-outline"
          size={20}
          color={isProActive ? '#93dfee' : '#fff'}
        />
        <Text style={[styles.mainLabel, isProActive && styles.mainLabelActive]} numberOfLines={1}>
          Pro Sorgu
        </Text>
      </SegmentPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: MENU_HEIGHT,
    minHeight: MENU_HEIGHT,
    maxHeight: MENU_HEIGHT,
    width: '100%',
    padding: SEGMENT_GAP,
    gap: SEGMENT_GAP,
    backgroundColor: '#1e293b',
    borderBottomWidth: StyleSheet.hairlineWidth + 0.5,
    borderBottomColor: 'rgba(59, 130, 246, 0.28)',
  },
  segmentPressable: {
    minWidth: 0,
    minHeight: 0,
    alignSelf: 'stretch',
  },
  buttonSurface: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(17, 32, 55, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(95, 150, 220, 0.28)',
    borderRadius: SEGMENT_RADIUS,
    overflow: 'hidden',
    position: 'relative',
  },
  buttonSurfaceActive: {
    borderColor: 'rgba(59, 130, 246, 0.88)',
    borderWidth: 1.5,
  },
  buttonSurfacePressed: {
    borderColor: 'rgba(45, 130, 255, 0.65)',
    opacity: 0.92,
  },
  buttonSurfaceDisabled: {
    opacity: 0.45,
  },
  gradientLayerTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(31, 51, 78, 0.95)',
    opacity: 0.88,
  },
  gradientLayerMid: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '28%',
    bottom: '28%',
    backgroundColor: 'rgba(17, 32, 55, 0.96)',
    opacity: 0.72,
  },
  gradientLayerBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '52%',
    backgroundColor: 'rgba(8, 20, 38, 0.98)',
    opacity: 0.9,
  },
  pressedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45, 130, 255, 0.14)',
  },
  activeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(59, 130, 246, 0.34)',
  },
  activeGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  activeBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 6,
    right: 6,
    height: 3,
    backgroundColor: '#3b82f6',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    zIndex: 4,
  },
  buttonTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 2,
  },
  buttonTopHighlightActive: {
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: 'rgba(147, 223, 255, 0.62)',
  },
  buttonInnerShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    zIndex: 1,
  },
  buttonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
    zIndex: 3,
  },
  buttonInnerColumn: {
    flexDirection: 'column',
    gap: 3,
    paddingVertical: 2,
  },
  leftBlock: {
    flex: 1.55,
    flexDirection: 'column',
    gap: SEGMENT_GAP,
    minWidth: 0,
  },
  middleBlock: {
    width: 64,
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'column',
    gap: SEGMENT_GAP,
  },
  compactLabel: {
    color: '#fff',
    fontSize: 10.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  mainLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  mainLabelActive: {
    fontWeight: '800',
    color: '#e0f2fe',
  },
});
