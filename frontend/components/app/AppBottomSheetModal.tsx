import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";

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
}: AppBottomSheetModalProps) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  const finalSnapPoints = useMemo<(string | number)[]>(
    () => (snapPoints && snapPoints.length ? snapPoints : ["70%", "90%"]),
    [snapPoints]
  );

  // Default: open at the first snap point
  const desiredIndex =
    typeof index === "number" ? index : typeof initialIndex === "number" ? initialIndex : 0;

  // prevVisibleRef'i false ile başlat ki ilk render'da visible true ise değişiklik algılansın
  const prevVisibleRef = useRef(false);
  
  useEffect(() => {
    const visibleChanged = prevVisibleRef.current !== visible;
    prevVisibleRef.current = visible;

    if (!visibleChanged) {
      return;
    }

    if (visible) {
      const timeoutId = setTimeout(() => {
        if (!ref.current) {
          return;
        }

        try {
          ref.current.present();
          setTimeout(() => {
            try {
              if (ref.current && desiredIndex >= 0) {
                ref.current.snapToIndex(desiredIndex);
              }
            } catch {
              // ignore
            }
          }, 150);
        } catch {
          try {
            if (ref.current && desiredIndex >= 0) {
              ref.current.snapToIndex(desiredIndex);
            }
          } catch {
            // ignore
          }
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    } else {
      try {
        if (ref.current) {
          ref.current.dismiss();
        }
      } catch {
        // ignore
      }
    }
  }, [visible, desiredIndex]);

  /** Kontrollü `index` prop'u değişince (modal açıkken) senkronize et; açılışta üstteki effect yeterli — çift snap titremeye yol açmasın. */
  const indexProp = index;
  useEffect(() => {
    if (!visible || typeof indexProp !== "number") return;
    const t = setTimeout(() => {
      try {
        ref.current?.snapToIndex(indexProp);
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(t);
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

  // onDismiss callback'ini sadece gerçekten dismiss olduğunda çağır
  // BottomSheetModal'ın onDismiss'i sadece modal gerçekten kapandığında çağrılır
  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const defaultBackgroundStyle =
    variant === "dark" ? styles.backgroundDark : styles.backgroundLight;
  const defaultHandleIndicatorStyle =
    variant === "dark" ? styles.handleIndicatorDark : styles.handleIndicatorLight;

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={finalSnapPoints}
      // IMPORTANT: Dynamic sizing can collapse to header-only when content is a ScrollView.
      // We want snapPoints to be the source of truth.
      enableDynamicSizing={false}
      enablePanDownToClose={enablePanDownToClose}
      enableContentPanningGesture={true}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={handleIndicatorStyle ?? defaultHandleIndicatorStyle}
      backgroundStyle={backgroundStyle ?? defaultBackgroundStyle}
      // Keep modal mounted only while presented; notify caller on dismiss.
      onDismiss={handleDismiss}
      topInset={insets.top}
      {...(modalProps as any)}
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

