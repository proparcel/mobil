import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import AppBottomSheetModal from "../app/AppBottomSheetModal";
import {
  UserMenuSheetTitleRow,
  userMenuListBottomPadding,
  userMenuSheetDarkStyles,
} from "../app/UserMenuSheet";
import type { HowToViewMode } from "./HowToScreenShell";

type Props = {
  visible: boolean;
  viewMode: HowToViewMode;
  onClose: () => void;
  onViewModeChange: (mode: HowToViewMode) => void;
};

const VIEW_ITEMS: { id: HowToViewMode; title: string; icon: string }[] = [
  { id: "grid", title: "Grid Görünümü", icon: "grid-outline" },
  { id: "list", title: "Liste Görünümü", icon: "list-outline" },
];

export function HowToViewMenuModal({ visible, viewMode, onClose, onViewModeChange }: Props) {
  const insets = useSafeAreaInsets();
  const st = userMenuSheetDarkStyles;

  const handleSelect = (mode: HowToViewMode) => {
    onViewModeChange(mode);
    onClose();
  };

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={["28%"]}
      initialIndex={0}
      variant="dark"
      backdropOpacity={0.2}
      backdropPressBehavior="close"
    >
      <UserMenuSheetTitleRow title="Görünüm" variant="dark" />
      <View style={[st.scroll, { paddingBottom: userMenuListBottomPadding(insets.bottom) }]}>
        {VIEW_ITEMS.map((item) => {
          const selected = viewMode === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[st.item, selected && st.itemCurrent]}
              onPress={() => handleSelect(item.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <View style={[st.iconWrap, selected && st.iconWrapCurrent]}>
                <Ionicons name={item.icon} size={20} color={selected ? "#3b82f6" : "#e2e8f0"} />
              </View>
              <Text style={[st.itemText, selected && st.itemTextCurrent]}>{item.title}</Text>
              {selected ? <Ionicons name="checkmark" size={20} color="#3b82f6" /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </AppBottomSheetModal>
  );
}
