import { Platform } from "react-native";

/**
 * Bottom sheet alt boşluk kuralları:
 * - Android: AppBottomSheetModal bottomInset nav barı karşılar; içerikte tekrar safe-area eklenmez.
 * - iOS: Sheet ekranın dibine oturur; home indicator için yalnızca içerik padding'i uygulanır.
 */

export function sheetModalBottomInset(safeAreaBottom: number): number {
  return Platform.OS === "android" ? safeAreaBottom : 0;
}

export function sheetContentSafeBottom(safeAreaBottom: number): number {
  return Platform.OS === "ios" ? safeAreaBottom : 0;
}

export function sheetScrollBottomPadding(safeAreaBottom: number, extra = 0): number {
  return sheetContentSafeBottom(safeAreaBottom) + extra;
}

/** Tam sayfa scroll: klavye açıkken home indicator padding'i eklenmez */
export function scrollContentBottomPadding(
  safeAreaBottom: number,
  extra: number,
  keyboardHeight: number,
): number {
  return keyboardHeight > 0 ? extra : sheetContentSafeBottom(safeAreaBottom) + extra;
}

/**
 * Tam ekran modal (3D editör): sheet ekran dibine yapışır; safe area yalnızca içerik padding'inde.
 */
export function sheetEditorScrollBottomPadding(safeAreaBottom: number, extra = 12): number {
  return Math.max(safeAreaBottom, 0) + extra;
}

export function sheetMenuListBottomPadding(safeAreaBottom: number): number {
  const MIN = 24;
  const EXTRA = 72;
  return Math.max(sheetContentSafeBottom(safeAreaBottom), MIN) + EXTRA;
}
