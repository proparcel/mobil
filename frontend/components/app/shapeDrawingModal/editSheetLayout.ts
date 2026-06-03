import type { StyleProp, ViewStyle } from "react-native";
import type { BottomSheetModalProps } from "@gorhom/bottom-sheet";
import { sheetEditorScrollBottomPadding } from "@/src/utils/sheetSafeArea";
import { styles } from "./styles";

/** Alt “Sil” butonu + home indicator için ek boşluk (px) */
const EDIT_SHEET_SCROLL_EXTRA = 128;

/** Şekil / ölçüm düzenleme sheet’lerinde scroll içeriği alt padding */
export function editSheetScrollPadding(insetsBottom: number): number {
  return sheetEditorScrollBottomPadding(insetsBottom, EDIT_SHEET_SCROLL_EXTRA);
}

export function editSheetScrollContentStyle(insetsBottom: number): StyleProp<ViewStyle> {
  return [styles.editPanelContentContainer, { paddingBottom: editSheetScrollPadding(insetsBottom), flexGrow: 1 }];
}

/** İçerik kaydırılırken sheet sürüklemesi scroll’u yutmasın; slider yatay jesti korunur */
export const EDIT_SHEET_MODAL_PROPS: Partial<BottomSheetModalProps> = {
  enableContentPanningGesture: false,
  activeOffsetY: [-10, 10],
  failOffsetX: [-18, 18],
};

export const EDIT_SHEET_SNAP_POINTS = ["12%", "60%", "92%"] as const;

/** Genişletilmiş panel: sil butonu görünür olsun diye üst snap */
export function editSheetExpandedIndex(minimized: boolean): number {
  return minimized ? 0 : 2;
}

export const editSheetScrollViewProps = {
  scrollEventThrottle: 16 as const,
  keyboardShouldPersistTaps: "handled" as const,
  keyboardDismissMode: "on-drag" as const,
  nestedScrollEnabled: true,
  showsVerticalScrollIndicator: true,
};
