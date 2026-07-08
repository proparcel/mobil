import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  useBottomSheetTimingConfigs,
  type BottomSheetBackdropProps,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";
import { KEYBOARD_SHEET_MODAL_PROPS } from "../../src/keyboard";
import { sheetModalBottomInset } from "../../src/utils/sheetSafeArea";

export type AppBottomSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  snapPoints?: (string | number)[];
  /**
   * Visual variant for default colors.
   * - "light": white surface (Basit mod default)
   * - "dark": corporate navy surface (Pro mod)
   */
  variant?: "light" | "dark";
  /**
   * Controlled index (preferred when changing snap points while visible).
   */
  index?: number;
  initialIndex?: number;
  children: React.ReactNode;
  /**
   * Default: true (drag down to close)
   */
  enablePanDownToClose?: boolean;
  /**
   * Backdrop opacity.
   */
  backdropOpacity?: number;
  /**
   * What happens when user presses the backdrop.
   * - "none": do nothing (default)
   * - "close": close sheet
   * - "collapse": collapse to the lowest snap point
   */
  backdropPressBehavior?: "none" | "close" | "collapse";
  /**
   * When true, touches pass through the backdrop to content below (e.g. ActionBar, canvas).
   */
  enableBackdropTouchThrough?: boolean;
  /**
   * Optional override for sheet background.
   */
  backgroundStyle?: BottomSheetModalProps["backgroundStyle"];
  /**
   * Optional override for handle indicator style.
   */
  handleIndicatorStyle?: BottomSheetModalProps["handleIndicatorStyle"];
  /**
   * Extra props forwarded to BottomSheetModal when needed.
   */
  modalProps?: Partial<BottomSheetModalProps>;
  /**
   * Sheet içinde TextInput varsa true — adjustResize + interactive klavye (merkezi sözleşme).
   */
  keyboardForm?: boolean;
  /**
   * Tam ekran modal (3D editör): sheet alt kenarı ekran dibine yapışır; safe area içerik padding'inde kalır.
   */
  flushToScreenBottom?: boolean;
};

export default function AppBottomSheetModal({
  visible,
  onClose,
  snapPoints,
  variant = "light",
  index,
  initialIndex,
  children,
  enablePanDownToClose = true,
  backdropOpacity = 0.45,
  backdropPressBehavior = "none",
  enableBackdropTouchThrough = false,
  backgroundStyle,
  handleIndicatorStyle,
  modalProps,
  keyboardForm = false,
  flushToScreenBottom = false,
}: AppBottomSheetModalProps) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const sheetBottomInset = flushToScreenBottom ? 0 : sheetModalBottomInset(insets.bottom);
  const animationConfigs = useBottomSheetTimingConfigs({ duration: 160 });
  const dismissNotifiedRef = useRef(false);
  /** visible=false ile başlatılan dismiss'te onClose tekrar tetiklenmesin (Android'de sheet yeniden açılabiliyor). */
  const programmaticClosingRef = useRef(false);

  const finalSnapPoints = useMemo<(string | number)[]>(
    () => (snapPoints && snapPoints.length ? snapPoints : ["70%", "90%"]),
    [snapPoints]
  );

  // Default: open at the first snap point
  const openIndex =
    typeof initialIndex === "number" ? initialIndex : 0;
  const sheetIndex = typeof index === "number" ? index : openIndex;

  // prevVisibleRef'i false ile başlat ki ilk render'da visible true ise değişiklik algılansın
  const prevVisibleRef = useRef(false);
  
  useEffect(() => {
    const visibleChanged = prevVisibleRef.current !== visible;
    prevVisibleRef.current = visible;

    if (!visibleChanged) {
      return;
    }

    if (visible) {
      programmaticClosingRef.current = false;
      dismissNotifiedRef.current = false;
      const frame = requestAnimationFrame(() => {
        try {
          ref.current?.present();
          if (sheetIndex >= 0 && typeof index === "number") {
            ref.current?.snapToIndex(sheetIndex);
          }
        } catch {
          // ignore
        }
      });
      return () => cancelAnimationFrame(frame);
    }

    programmaticClosingRef.current = true;
    try {
      ref.current?.dismiss();
    } catch {
      // ignore
    }
  }, [visible, sheetIndex, index]);

  /** Kontrollü `index` prop'u değişince (modal açıkken) senkronize et. */
  const indexProp = index;
  useEffect(() => {
    if (!visible || typeof indexProp !== "number") return;
    try {
      ref.current?.snapToIndex(indexProp);
    } catch {
      // ignore
    }
  }, [visible, indexProp]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        opacity={backdropOpacity}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior={backdropPressBehavior}
        enableTouchThrough={enableBackdropTouchThrough}
      />
    ),
    [backdropOpacity, backdropPressBehavior, enableBackdropTouchThrough]
  );

  const backdropComponent =
    backdropOpacity <= 0 && enableBackdropTouchThrough ? undefined : renderBackdrop;

  const notifyDismiss = useCallback(() => {
    if (dismissNotifiedRef.current) return;
    dismissNotifiedRef.current = true;
    const wasProgrammatic = programmaticClosingRef.current;
    programmaticClosingRef.current = false;
    if (!wasProgrammatic) {
      onClose();
    }
  }, [onClose]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        notifyDismiss();
      }
    },
    [notifyDismiss],
  );

  const handleDismiss = useCallback(() => {
    notifyDismiss();
  }, [notifyDismiss]);

  const defaultBackgroundStyle =
    variant === "dark" ? styles.backgroundDark : styles.backgroundLight;
  const defaultHandleIndicatorStyle =
    variant === "dark" ? styles.handleIndicatorDark : styles.handleIndicatorLight;

  const mergedModalProps = useMemo(
    () =>
      keyboardForm
        ? { ...KEYBOARD_SHEET_MODAL_PROPS, ...modalProps }
        : modalProps,
    [keyboardForm, modalProps],
  );

  return (
    <BottomSheetModal
      ref={ref}
      index={sheetIndex}
      snapPoints={finalSnapPoints}
      animationConfigs={animationConfigs}
      // IMPORTANT: Dynamic sizing can collapse to header-only when content is a ScrollView.
      // We want snapPoints to be the source of truth.
      enableDynamicSizing={false}
      enablePanDownToClose={enablePanDownToClose}
      enableContentPanningGesture={true}
      backdropComponent={backdropComponent}
      handleIndicatorStyle={handleIndicatorStyle ?? defaultHandleIndicatorStyle}
      backgroundStyle={backgroundStyle ?? defaultBackgroundStyle}
      onChange={handleSheetChange}
      onDismiss={handleDismiss}
      topInset={insets.top}
      bottomInset={sheetBottomInset}
      {...(mergedModalProps as any)}
    >
      {children}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  backgroundLight: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: "#ffffff",
  },
  backgroundDark: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#1e293b",
    borderTopWidth: 4,
    borderTopColor: "#3b82f6",
  },
  handleIndicatorLight: {
    backgroundColor: "rgba(15,23,42,0.18)",
    width: 42,
  },
  handleIndicatorDark: {
    backgroundColor: "rgba(148, 163, 184, 0.35)",
    width: 42,
  },
});

