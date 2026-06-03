import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { adminCommonStyles, adminColors } from "../../../styles/admin/common";

type Props = {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
};

export function AdminScreenHeader({ title, onBack, right }: Props) {
  return (
    <View style={adminCommonStyles.header}>
      <TouchableOpacity onPress={onBack} style={adminCommonStyles.headerBtn} accessibilityLabel="Geri">
        <Ionicons name="chevron-back" size={24} color={adminColors.textPrimary} />
      </TouchableOpacity>
      <Text style={adminCommonStyles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      {right ? <View style={adminCommonStyles.headerBtn}>{right}</View> : <View style={adminCommonStyles.headerBtn} />}
    </View>
  );
}
