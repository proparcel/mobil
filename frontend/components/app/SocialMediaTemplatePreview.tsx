/**
 * Web `social-media-template.css` ile aynı katman sırası: görseller → şablon PNG → metin.
 * Metin/avatar alanları dokununca seçilir, sürüklenerek taşınır.
 */
import React, { useMemo, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  PanResponder,
  Pressable,
  type ViewStyle,
} from "react-native";
import type { EditableAdjustment } from "../../src/utils/socialMediaTemplateHelpers";

const BG = "#dbe5f1";

const SELECT_RING = "#38bdf8";

export type SocialMediaTemplatePreviewProps = {
  cardWidth: number;
  templateUri: string;
  slot0Uri: string;
  slot1Uri: string;
  avatarUri: string | null;
  logoLoadFailed: boolean;
  onAvatarLoadError: () => void;
  companyName: string;
  contactLine: string;
  title: string;
  priceText: string;
  areaText: string;
  locationText: string;
  themeId: "default" | "gold" | "green";
  adjustments: Record<string, EditableAdjustment>;
  selectedEditableId: string;
  onSelectEditable: (id: string) => void;
  onAbsolutePosition: (id: string, x: number, y: number) => void;
  onClearSelection: () => void;
};

function fontPlus(base: number, id: string, adjustments: Record<string, EditableAdjustment>): number {
  const a = adjustments[id]?.fontSize ?? 0;
  return Math.max(8, base + a);
}

type DragProps = {
  id: string;
  selected: boolean;
  adjustment: EditableAdjustment;
  onSelect: (id: string) => void;
  onAbsolute: (id: string, x: number, y: number) => void;
  style?: ViewStyle;
  children: React.ReactNode;
};

function DraggableEditable({ id, selected, adjustment, onSelect, onAbsolute, style, children }: DragProps) {
  const origin = useRef({ x: 0, y: 0 });
  const adjRef = useRef(adjustment);
  adjRef.current = adjustment;
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const absRef = useRef(onAbsolute);
  absRef.current = onAbsolute;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          origin.current = { x: adjRef.current.x, y: adjRef.current.y };
          selectRef.current(id);
        },
        onPanResponderMove: (_, g) => {
          absRef.current(id, origin.current.x + g.dx, origin.current.y + g.dy);
        },
      }),
    [id],
  );

  const { x, y } = adjustment;

  return (
    <View
      style={[
        style,
        { transform: [{ translateX: x }, { translateY: y }] },
        selected && styles.dragSelected,
      ]}
      collapsable={false}
      {...panResponder.panHandlers}
    >
      {children}
    </View>
  );
}

export default function SocialMediaTemplatePreview({
  cardWidth,
  templateUri,
  slot0Uri,
  slot1Uri,
  avatarUri,
  logoLoadFailed,
  onAvatarLoadError,
  companyName,
  contactLine,
  title,
  priceText,
  areaText,
  locationText,
  themeId,
  adjustments,
  selectedEditableId,
  onSelectEditable,
  onAbsolutePosition,
  onClearSelection,
}: SocialMediaTemplatePreviewProps) {
  const theme = useMemo(() => {
    if (themeId === "gold") {
      return {
        text: "#5b3b00",
        shadow: "#fff8dc",
        pillShadow: "rgba(146,103,16,0.35)",
        logoBg: "rgba(255,248,220,0.35)",
        fallbackBg: "rgba(255,248,220,0.28)",
        fallbackBorder: "rgba(146,103,16,0.35)",
      };
    }
    return {
      text: "#ffffff",
      shadow: "rgba(15,23,42,0.35)",
      pillShadow: "rgba(15,23,42,0.45)",
      logoBg: "rgba(255,255,255,0.14)",
      fallbackBg: "rgba(255,255,255,0.12)",
      fallbackBorder: "rgba(255,255,255,0.25)",
    };
  }, [themeId]);

  const w = cardWidth;
  const scale = w / 360;
  const titleFont = fontPlus(Math.round(22 * scale), "title", adjustments);
  const companyFont = fontPlus(Math.round(14 * scale), "companyName", adjustments);
  const contactFont = fontPlus(Math.round(11 * scale), "contactLine", adjustments);
  const priceFont = fontPlus(Math.round(13 * scale), "price", adjustments);
  const areaFont = fontPlus(Math.round(11 * scale), "area", adjustments);
  const locFont = fontPlus(Math.round(11 * scale), "location", adjustments);

  const a = (k: string): EditableAdjustment =>
    adjustments[k] || { x: 0, y: 0, fontSize: 0 };

  return (
    <View style={[styles.stage, { width: w, aspectRatio: 1024 / 1536 }]}>
      <View style={[styles.slotHero, { zIndex: 1 }]}>
        {slot0Uri ? (
          <Image source={{ uri: slot0Uri }} style={styles.slotImg} resizeMode="cover" />
        ) : (
          <View style={styles.slotEmpty}>
            <Text style={styles.slotEmptyText}>Üst görsel</Text>
          </View>
        )}
        <Text style={[styles.ppBadge, { fontSize: 10 * scale }]} pointerEvents="none">
          ProParcel
        </Text>
      </View>

      <View style={[styles.slotBottom, { zIndex: 1 }]}>
        {slot1Uri ? (
          <Image source={{ uri: slot1Uri }} style={styles.slotImg} resizeMode="cover" />
        ) : (
          <View style={styles.slotEmpty}>
            <Text style={styles.slotEmptyText}>Alt görsel</Text>
          </View>
        )}
      </View>

      <Image source={{ uri: templateUri }} style={[styles.templateImg, { zIndex: 2 }]} resizeMode="cover" pointerEvents="none" />

      <View style={[styles.overlay, { zIndex: 3 }]} pointerEvents="box-none">
        <Pressable
          style={styles.overlayBackdrop}
          onPress={onClearSelection}
          accessibilityLabel="Seçimi kaldır"
          accessibilityRole="button"
        />
        <View style={[styles.brandRow, styles.overlayLayer]} pointerEvents="box-none">
          <DraggableEditable
            id="avatar"
            selected={selectedEditableId === "avatar"}
            adjustment={a("avatar")}
            onSelect={onSelectEditable}
            onAbsolute={onAbsolutePosition}
            style={styles.dragAvatarWrap}
          >
            {avatarUri && !logoLoadFailed ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatarImg}
                resizeMode="cover"
                onError={onAvatarLoadError}
              />
            ) : (
              <View
                style={[styles.avatarFallbackInner, { backgroundColor: theme.fallbackBg, borderColor: theme.fallbackBorder }]}
              >
                <Text style={[styles.avatarFallbackText, { color: theme.text }]}>PP</Text>
              </View>
            )}
          </DraggableEditable>

          <View style={styles.brandTextCol} pointerEvents="box-none">
            <DraggableEditable
              id="companyName"
              selected={selectedEditableId === "companyName"}
              adjustment={a("companyName")}
              onSelect={onSelectEditable}
              onAbsolute={onAbsolutePosition}
              style={styles.dragTextWidth}
            >
              <Text
                style={[
                  styles.companyName,
                  {
                    color: theme.text,
                    fontSize: companyFont,
                    textShadowColor: theme.shadow,
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                  },
                ]}
                numberOfLines={2}
              >
                {companyName || "Firma"}
              </Text>
            </DraggableEditable>
            {contactLine ? (
              <DraggableEditable
                id="contactLine"
                selected={selectedEditableId === "contactLine"}
                adjustment={a("contactLine")}
                onSelect={onSelectEditable}
                onAbsolute={onAbsolutePosition}
                style={styles.dragTextWidth}
              >
                <Text
                  style={[
                    styles.contactLine,
                    {
                      color: theme.text,
                      fontSize: contactFont,
                      textShadowColor: theme.shadow,
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {contactLine}
                </Text>
              </DraggableEditable>
            ) : null}
          </View>
        </View>

        <View style={[styles.titleWrap, styles.overlayLayer]} pointerEvents="box-none">
          <DraggableEditable
            id="title"
            selected={selectedEditableId === "title"}
            adjustment={a("title")}
            onSelect={onSelectEditable}
            onAbsolute={onAbsolutePosition}
            style={styles.dragTitleInner}
          >
            <Text
              style={[
                styles.titleText,
                {
                  color: theme.text,
                  fontSize: titleFont,
                  textShadowColor: theme.shadow,
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 6,
                },
              ]}
              numberOfLines={4}
            >
              {title}
            </Text>
          </DraggableEditable>
        </View>

        <View style={[styles.pillRow, styles.overlayLayer]} pointerEvents="box-none">
          <DraggableEditable
            id="price"
            selected={selectedEditableId === "price"}
            adjustment={a("price")}
            onSelect={onSelectEditable}
            onAbsolute={onAbsolutePosition}
            style={[styles.pillDrag, { flex: 2.1 }]}
          >
            <Text
              style={[
                styles.pill,
                styles.pillPrice,
                {
                  color: theme.text,
                  fontSize: priceFont,
                  textShadowColor: theme.pillShadow,
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                },
              ]}
              numberOfLines={2}
            >
              {priceText || "Fiyat"}
            </Text>
          </DraggableEditable>
          <DraggableEditable
            id="area"
            selected={selectedEditableId === "area"}
            adjustment={a("area")}
            onSelect={onSelectEditable}
            onAbsolute={onAbsolutePosition}
            style={[styles.pillDrag, { flex: 1.1 }]}
          >
            <Text
              style={[
                styles.pill,
                {
                  color: theme.text,
                  fontSize: areaFont,
                  textShadowColor: theme.pillShadow,
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                },
              ]}
              numberOfLines={2}
            >
              {areaText || "m²"}
            </Text>
          </DraggableEditable>
          <DraggableEditable
            id="location"
            selected={selectedEditableId === "location"}
            adjustment={a("location")}
            onSelect={onSelectEditable}
            onAbsolute={onAbsolutePosition}
            style={[styles.pillDrag, { flex: 1.35 }]}
          >
            <Text
              style={[
                styles.pill,
                styles.pillLoc,
                {
                  color: theme.text,
                  fontSize: locFont,
                  textShadowColor: theme.pillShadow,
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                },
              ]}
              numberOfLines={2}
            >
              {locationText || "Konum"}
            </Text>
          </DraggableEditable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignSelf: "center",
    backgroundColor: BG,
    borderRadius: 0,
    overflow: "hidden",
  },
  slotHero: {
    position: "absolute",
    top: "8.2%",
    left: 0,
    right: 0,
    height: "54.8%",
    overflow: "hidden",
    backgroundColor: "#ece7eb",
  },
  slotBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "24.8%",
    overflow: "hidden",
    backgroundColor: "#ece7eb",
  },
  slotImg: { width: "100%", height: "100%" },
  slotEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59,130,246,0.12)",
  },
  slotEmptyText: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 12 },
  ppBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    color: "#fff",
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  templateImg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  overlayLayer: {
    zIndex: 2,
  },
  brandRow: {
    position: "absolute",
    top: "3.1%",
    left: "6.2%",
    right: "6.2%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  dragAvatarWrap: {
    alignSelf: "flex-start",
    padding: 4,
    margin: -4,
    borderRadius: 6,
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  avatarFallbackInner: {
    width: 48,
    height: 48,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { fontWeight: "800", letterSpacing: 1 },
  brandTextCol: { flex: 1, minWidth: 0, gap: 6 },
  dragTextWidth: { alignSelf: "stretch", padding: 4, margin: -4, borderRadius: 6 },
  companyName: { fontWeight: "800", lineHeight: 18 },
  contactLine: { fontWeight: "600", opacity: 0.95 },
  titleWrap: {
    position: "absolute",
    top: "46%",
    left: "9%",
    right: "9%",
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: "14%",
  },
  dragTitleInner: {
    maxWidth: "100%",
    padding: 6,
    margin: -6,
    borderRadius: 8,
    alignItems: "center",
  },
  titleText: {
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 28,
  },
  pillRow: {
    position: "absolute",
    top: "68%",
    left: "8%",
    right: "8%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 6,
  },
  pillDrag: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    margin: -2,
    borderRadius: 6,
    minWidth: 0,
  },
  pill: { fontWeight: "800", textAlign: "center" },
  pillPrice: { textAlign: "left" },
  pillLoc: { textAlign: "right" },
  dragSelected: {
    borderWidth: 2,
    borderColor: SELECT_RING,
    borderRadius: 6,
  },
});
