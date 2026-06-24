import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

export type RegistrationCorporateType = "emlak" | "spk" | "lihkab";

export type CorporateTypeConfig = {
  value: RegistrationCorporateType;
  title: string;
  description: string;
  icon: string;
  iconFamily: "ionicons" | "material";
  variant: "emlak" | "spk" | "lihkab";
};

export const CORPORATE_TYPES: CorporateTypeConfig[] = [
  {
    value: "emlak",
    title: "Emlak",
    description:
      "Emlak ofisleri ve yetki belgesine sahip bağımsız emlak danışmanları bu alandan kayıt olur.",
    icon: "home-outline",
    iconFamily: "ionicons",
    variant: "emlak",
  },
  {
    value: "spk",
    title: "SPK",
    description: "SPK lisanslı değerleme firmaları bu alandan üyelik oluşturur.",
    icon: "certificate-outline",
    iconFamily: "material",
    variant: "spk",
  },
  {
    value: "lihkab",
    title: "LİHKAB",
    description: "LİHKAB büroları bu alandan üyelik oluşturur.",
    icon: "business",
    iconFamily: "ionicons",
    variant: "lihkab",
  },
];

type VariantTheme = {
  card: object;
  title: object;
  description: object;
  iconColor: string;
  selectedBorder: string;
};

const VARIANT_THEMES: Record<CorporateTypeConfig["variant"], VariantTheme> = {
  emlak: {
    card: { backgroundColor: "#062B5F", borderColor: "transparent" },
    title: { color: "#FFFFFF" },
    description: { color: "rgba(255,255,255,0.82)" },
    iconColor: "#FFFFFF",
    selectedBorder: "rgba(255,255,255,0.55)",
  },
  spk: {
    card: { backgroundColor: "#0F4C81", borderColor: "transparent" },
    title: { color: "#FFFFFF" },
    description: { color: "rgba(255,255,255,0.85)" },
    iconColor: "#FFFFFF",
    selectedBorder: "rgba(255,255,255,0.55)",
  },
  lihkab: {
    card: { backgroundColor: "#00A6D6", borderColor: "transparent" },
    title: { color: "#FFFFFF" },
    description: { color: "rgba(255,255,255,0.88)" },
    iconColor: "#FFFFFF",
    selectedBorder: "rgba(255,255,255,0.55)",
  },
};

function CorporateTypeIcon({
  config,
  color,
  size,
}: {
  config: CorporateTypeConfig;
  color: string;
  size: number;
}) {
  if (config.iconFamily === "material") {
    return <MaterialCommunityIcons name={config.icon} size={size} color={color} />;
  }
  return <Ionicons name={config.icon} size={size} color={color} />;
}

type CorporateTypeCardProps = {
  config: CorporateTypeConfig;
  selected: boolean;
  onPress: () => void;
};

export function CorporateTypeCard({ config, selected, onPress }: CorporateTypeCardProps) {
  const theme = VARIANT_THEMES[config.variant];

  return (
    <TouchableOpacity
      style={[
        styles.card,
        theme.card,
        selected && styles.cardSelected,
        selected && { borderColor: theme.selectedBorder },
      ]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={config.title}
    >
      <View style={styles.cardBody}>
        <CorporateTypeIcon config={config} color={theme.iconColor} size={28} />
        <Text style={[styles.title, theme.title]} numberOfLines={1}>
          {config.title}
        </Text>
        <Text style={[styles.description, theme.description]} numberOfLines={4}>
          {config.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

type CorporateTypeSelectorProps = {
  value: RegistrationCorporateType | null;
  onChange: (value: RegistrationCorporateType) => void;
  onSelect?: (value: RegistrationCorporateType) => void;
};

export function CorporateTypeSelector({
  value,
  onChange,
  onSelect,
}: CorporateTypeSelectorProps) {
  return (
    <View style={styles.stack}>
      {CORPORATE_TYPES.map((item) => (
        <CorporateTypeCard
          key={item.value}
          config={item}
          selected={value === item.value}
          onPress={() => {
            onChange(item.value);
            onSelect?.(item.value);
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    flexDirection: "column",
    gap: 14,
    marginBottom: 12,
  },
  card: {
    width: "100%",
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: "stretch",
    justifyContent: "center",
    overflow: "visible",
  },
  cardSelected: {
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      default: {},
    }),
  },
  cardBody: {
    alignItems: "flex-start",
    gap: 8,
    paddingRight: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "left",
  },
  description: {
    fontSize: 13,
    textAlign: "left",
    lineHeight: 18,
  },
});
