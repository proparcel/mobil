import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Defs, Line, Pattern, Polygon, Text as SvgText } from 'react-native-svg';
import AppBottomSheetModal from './AppBottomSheetModal';
import { styles } from './shapeDrawingModal/styles';
import {
  DEFAULT_PARCEL_POLYGON_DESIGN,
  MAP_TOOLS_SHEET_BACKGROUND,
  PARCEL_DESIGN_FILL_SWATCHES,
  PARCEL_DESIGN_STROKE_SWATCHES,
  PARCEL_FILL_PATTERNS,
  PARCEL_PATTERN_SIZE_OPTIONS,
  PARCEL_DESIGN_FILL_OPACITY_OPTIONS,
  isFillOpacityOptionActive,
  resolveFillOpacity,
  resolvePatternSizeScale,
  type ParcelFillPatternId,
  getPatternGlyph,
  type ParcelPolygonDesignConfig,
} from '../../src/constants/parcelPolygonDesign';

const PREVIEW_POINTS = '40,18 78,32 70,72 30,68 22,38';

type Props = {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;
  initialConfig?: ParcelPolygonDesignConfig | null;
  onConfirm: (config: ParcelPolygonDesignConfig) => void;
};

function PatternIcon({
  iconLib,
  iconName,
  color,
  size = 22,
}: {
  iconLib: 'ion' | 'mci';
  iconName: string;
  color: string;
  size?: number;
}) {
  if (iconLib === 'mci') {
    return <MaterialCommunityIcons name={iconName as any} size={size} color={color} />;
  }
  return <Ionicons name={iconName as any} size={size} color={color} />;
}

function ParcelDesignPreview({
  fillColor,
  fillOpacity,
  strokeColor,
  strokeWidth,
  patternId,
  patternSizeScale,
}: ParcelPolygonDesignConfig) {
  const glyph = getPatternGlyph(patternId);
  const scale = resolvePatternSizeScale(patternSizeScale);
  const cell = 10 + 8 * scale;
  const glyphFont = 6 + 7 * scale;
  const patternKey = `preview-${patternId}-${fillColor}-${scale}`;

  return (
    <View
      style={{
        alignItems: 'center',
        marginVertical: 12,
        paddingVertical: 8,
      }}
    >
      <Svg width={220} height={160} viewBox="0 0 100 90">
        {glyph ? (
          <Defs>
            <Pattern id={patternKey} patternUnits="userSpaceOnUse" width={cell} height={cell}>
              <SvgText
                x={cell / 2}
                y={cell * 0.78}
                fontSize={glyphFont}
                fill={strokeColor}
                fillOpacity={0.38}
                textAnchor="middle"
                fontWeight="600"
              >
                {glyph}
              </SvgText>
            </Pattern>
          </Defs>
        ) : null}
        <Polygon
          points={PREVIEW_POINTS}
          fill={fillColor}
          fillOpacity={fillOpacity}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
        {glyph ? (
          <Polygon
            points={PREVIEW_POINTS}
            fill={`url(#${patternKey})`}
            fillOpacity={fillOpacity}
            stroke="none"
          />
        ) : null}
        <Line x1="8" y1="82" x2="92" y2="82" stroke="#334155" strokeWidth="0.5" />
      </Svg>
      <Text style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>Örnek parsel</Text>
    </View>
  );
}

function ColorSwatchRow({
  title,
  colors,
  selected,
  onSelect,
}: {
  title: string;
  colors: readonly string[];
  selected: string;
  onSelect: (c: string) => void;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {colors.map((c) => {
          const active = selected === c;
          return (
            <TouchableOpacity
              key={c}
              onPress={() => onSelect(c)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: c,
                borderWidth: active ? 2 : 1,
                borderColor: active ? '#3b82f6' : '#475569',
              }}
              accessibilityLabel={title}
            />
          );
        })}
      </View>
    </View>
  );
}

export function ParcelPolygonDesignSheet({
  visible,
  onClose,
  insetsBottom,
  initialConfig,
  onConfirm,
}: Props) {
  const base = initialConfig ?? DEFAULT_PARCEL_POLYGON_DESIGN;
  const [fillColor, setFillColor] = useState(base.fillColor);
  const [fillOpacity, setFillOpacity] = useState(resolveFillOpacity(base.fillOpacity));
  const [strokeColor, setStrokeColor] = useState(base.strokeColor);
  const [strokeWidth, setStrokeWidth] = useState(base.strokeWidth);
  const [patternId, setPatternId] = useState<ParcelFillPatternId>(base.patternId);
  const [patternSizeScale, setPatternSizeScale] = useState(
    resolvePatternSizeScale(base.patternSizeScale)
  );

  useEffect(() => {
    if (!visible) return;
    const cfg = initialConfig ?? DEFAULT_PARCEL_POLYGON_DESIGN;
    setFillColor(cfg.fillColor);
    setFillOpacity(resolveFillOpacity(cfg.fillOpacity));
    setStrokeColor(cfg.strokeColor);
    setStrokeWidth(cfg.strokeWidth);
    setPatternId(cfg.patternId);
    setPatternSizeScale(resolvePatternSizeScale(cfg.patternSizeScale));
  }, [visible, initialConfig]);

  const draft = useMemo(
    (): ParcelPolygonDesignConfig => ({
      fillColor,
      fillOpacity: resolveFillOpacity(fillOpacity),
      strokeColor,
      strokeWidth,
      patternId,
      patternSizeScale: resolvePatternSizeScale(patternSizeScale),
    }),
    [fillColor, fillOpacity, strokeColor, strokeWidth, patternId, patternSizeScale]
  );

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={['78%', '92%']}
      initialIndex={0}
      backdropPressBehavior="close"
      backgroundStyle={MAP_TOOLS_SHEET_BACKGROUND}
      handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.35)' }}
    >
      <View style={{ flex: 1, paddingBottom: insetsBottom }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#334155',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Parsel Poligon Tasarımı</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Kapat">
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          style={{ flex: 1, paddingHorizontal: 14 }}
          contentContainerStyle={{ paddingBottom: Math.max(insetsBottom, 0) + 88 }}
        >
          <ParcelDesignPreview {...draft} />

          <ColorSwatchRow
            title="Dolgu rengi"
            colors={PARCEL_DESIGN_FILL_SWATCHES}
            selected={fillColor}
            onSelect={setFillColor}
          />

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
              Dolgu saydamlığı
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PARCEL_DESIGN_FILL_OPACITY_OPTIONS.map((o) => {
                const active = isFillOpacityOptionActive(fillOpacity, o);
                return (
                  <TouchableOpacity
                    key={o}
                    onPress={() => setFillOpacity(o)}
                    style={[
                      styles.dropdownMenuItem,
                      { minWidth: '30%', flexGrow: 1, justifyContent: 'center' },
                      active && styles.dropdownMenuItemActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownMenuItemText,
                        active && styles.dropdownMenuItemTextActive,
                        { textAlign: 'center' },
                      ]}
                    >
                      {Math.round(o * 100)}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <ColorSwatchRow
            title="Kenar rengi"
            colors={PARCEL_DESIGN_STROKE_SWATCHES}
            selected={strokeColor}
            onSelect={setStrokeColor}
          />

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
              Kenar kalınlığı
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[1.5, 2, 3, 4].map((w) => (
                <TouchableOpacity
                  key={w}
                  onPress={() => setStrokeWidth(w)}
                  style={[
                    styles.dropdownMenuItem,
                    { flex: 1, justifyContent: 'center' },
                    strokeWidth === w && styles.dropdownMenuItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.dropdownMenuItemText,
                      strokeWidth === w && styles.dropdownMenuItemTextActive,
                      { textAlign: 'center' },
                    ]}
                  >
                    {w}px
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text
            style={{
              color: '#e2e8f0',
              fontSize: 13,
              fontWeight: '700',
              marginTop: 18,
              marginBottom: 8,
            }}
          >
            Şekil deseni
          </Text>
          <Text style={{ color: '#64748b', fontSize: 11, marginBottom: 10 }}>
            Dolgu üzerinde hafif kontur desen; haritada parsel içine uygulanır.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PARCEL_FILL_PATTERNS.map((p) => {
              const active = patternId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setPatternId(p.id)}
                  style={[
                    {
                      width: '30%',
                      minWidth: 96,
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: active ? '#3b82f6' : '#334155',
                      backgroundColor: active ? 'rgba(51,65,85,0.85)' : 'rgba(30,41,59,0.6)',
                    },
                  ]}
                >
                  <PatternIcon
                    iconLib={p.iconLib}
                    iconName={p.iconName}
                    color={active ? '#3b82f6' : '#94a3b8'}
                  />
                  <Text
                    style={{
                      color: active ? '#3b82f6' : '#94a3b8',
                      fontSize: 11,
                      marginTop: 4,
                      fontWeight: active ? '700' : '500',
                    }}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {patternId !== 'none' ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                Şekil boyutu
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PARCEL_PATTERN_SIZE_OPTIONS.map((opt) => {
                  const active = patternSizeScale === opt.scale;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      onPress={() => setPatternSizeScale(opt.scale)}
                      style={[
                        styles.dropdownMenuItem,
                        { flex: 1, justifyContent: 'center' },
                        active && styles.dropdownMenuItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownMenuItemText,
                          active && styles.dropdownMenuItemTextActive,
                          { textAlign: 'center', fontSize: 11 },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
        </BottomSheetScrollView>

        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: Math.max(insetsBottom, 12),
            borderTopWidth: 1,
            borderTopColor: '#334155',
          }}
        >
          <TouchableOpacity
            style={[styles.dropdownMenuItem, { flex: 1, justifyContent: 'center' }]}
            onPress={onClose}
          >
            <Text style={[styles.dropdownMenuItemText, { textAlign: 'center' }]}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.dropdownMenuItem,
              styles.dropdownMenuItemActive,
              { flex: 1, justifyContent: 'center' },
            ]}
            onPress={() => {
              onConfirm(draft);
              onClose();
            }}
          >
            <Text style={[styles.dropdownMenuItemTextActive, { textAlign: 'center', fontWeight: '700' }]}>
              Onayla
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppBottomSheetModal>
  );
}
