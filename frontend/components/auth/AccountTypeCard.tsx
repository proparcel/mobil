import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

export type AccountMemberType = "individual" | "consultant" | "corporate";

export type AccountTypeConfig = {
  value: AccountMemberType;
  title: string;
  description: string;
  icon: string;
  iconFamily: "ionicons" | "material";
  variant: "corporate" | "consultant" | "individual";
  priceAdvantage?: boolean;
};

export const ACCOUNT_TYPES: AccountTypeConfig[] = [
  {
    value: "corporate",
    title: "Kurumsal",
    description:
      "Emlak, SPK ve LİHKAB ofisleri bu alandan üyelik oluşturabilir. Önemli: Firmada çalışmayan, yetki belgesine sahip bağımsız emlak danışmanları da bu alanı kullanmalıdır.",
    icon: "business",
    iconFamily: "ionicons",
    variant: "corporate",
    priceAdvantage: true,
  },
  {
    value: "consultant",
    title: "Danışman",
    description:
      "Emlak, SPK ve LİHKAB ofislerinde çalışan emlak danışmanları bu alandan kayıt olmalıdır.",
    icon: "account-tie",
    iconFamily: "material",
    variant: "consultant",
    priceAdvantage: true,
  },
  {
    value: "individual",
    title: "Bireysel",
    description: "Bireysel kullanıcılar için üyelik kayıt alanıdır.",
    icon: "person-outline",
    iconFamily: "ionicons",
    variant: "individual",
  },
];

const MEMBER_TYPE_LABELS: Record<AccountMemberType, string> = {
  corporate: "Kurumsal",
  consultant: "Danışman",
  individual: "Bireysel",
};

export function getMemberTypeLabel(type: AccountMemberType): string {
  return MEMBER_TYPE_LABELS[type];
}

type VariantTheme = {
  card: object;
  title: object;
  description: object;
  iconColor: string;
  indicator: string;
  selectedBorder: string;
};

const VARIANT_THEMES: Record<AccountTypeConfig["variant"], VariantTheme> = {
  corporate: {
    card: { backgroundColor: "#062B5F", borderColor: "transparent" },
    title: { color: "#FFFFFF" },
    description: { color: "rgba(255,255,255,0.82)" },
    iconColor: "#FFFFFF",
    indicator: "#38BDF8",
    selectedBorder: "rgba(255,255,255,0.55)",
  },
  consultant: {
    card: { backgroundColor: "#00A6D6", borderColor: "transparent" },
    title: { color: "#FFFFFF" },
    description: { color: "rgba(255,255,255,0.88)" },
    iconColor: "#FFFFFF",
    indicator: "#E0F7FF",
    selectedBorder: "rgba(255,255,255,0.55)",
  },
  individual: {
    card: {
      backgroundColor: "#FFFFFF",
      borderColor: "#DDE3EC",
    },
    title: { color: "#062B5F" },
    description: { color: "#64748B" },
    iconColor: "#334155",
    indicator: "#00A6D6",
    selectedBorder: "#00A6D6",
  },
};

type AccountTypeCardProps = {
  config: AccountTypeConfig;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
  layout?: "row" | "stack";
};

function AccountTypeIcon({
  config,
  color,
  size,
}: {
  config: AccountTypeConfig;
  color: string;
  size: number;
}) {
  if (config.iconFamily === "material") {
    return <MaterialCommunityIcons name={config.icon} size={size} color={color} />;
  }
  return <Ionicons name={config.icon} size={size} color={color} />;
}

function renderDescription(
  config: AccountTypeConfig,
  theme: VariantTheme,
  descSize: number,
  isStack: boolean,
) {
  const descStyle = [
    styles.description,
    theme.description,
    { fontSize: descSize, textAlign: isStack ? ("left" as const) : ("center" as const) },
  ];

  if (config.variant !== "corporate") {
    return (
      <Text style={descStyle} numberOfLines={6}>
        {config.description}
      </Text>
    );
  }

  const importantIdx = config.description.indexOf("Önemli:");
  if (importantIdx === -1) {
    return (
      <Text style={descStyle} numberOfLines={6}>
        {config.description}
      </Text>
    );
  }

  const before = config.description.slice(0, importantIdx);
  const after = config.description.slice(importantIdx + "Önemli:".length);

  return (
    <Text style={descStyle}>
      {before}
      <Text style={styles.descriptionEmphasis}>Önemli:</Text>
      {after}
    </Text>
  );
}

export function AccountTypeCard({
  config,
  selected,
  onPress,
  compact,
  layout = "row",
}: AccountTypeCardProps) {
  const theme = VARIANT_THEMES[config.variant];
  const isStack = layout === "stack";
  const iconSize = isStack ? 28 : compact ? 22 : 26;
  const titleSize = isStack ? 16 : compact ? 12 : 13;
  const descSize = isStack ? 13 : compact ? 10 : 11;

  return (
    <TouchableOpacity
      style={[
        isStack ? styles.cardStack : styles.card,
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
      {config.priceAdvantage ? (
        <View style={[styles.priceBadge, isStack ? styles.priceBadgeStack : styles.priceBadgeCompact]}>
          <Text
            style={[styles.priceBadgeText, isStack ? styles.priceBadgeTextStack : styles.priceBadgeTextCompact]}
          >
            Fiyat Avantajı
          </Text>
        </View>
      ) : null}
      <View style={[styles.cardBody, isStack && styles.cardBodyStack]}>
        <AccountTypeIcon config={config} color={theme.iconColor} size={iconSize} />
        <Text
          style={[
            styles.title,
            theme.title,
            { fontSize: titleSize, textAlign: isStack ? "left" : "center" },
          ]}
          numberOfLines={1}
        >
          {config.title}
        </Text>
        {renderDescription(config, theme, descSize, isStack)}
      </View>
      {!isStack ? (
        <View
          style={[
            styles.indicator,
            { backgroundColor: theme.indicator },
            selected && styles.indicatorSelected,
          ]}
        />
      ) : null}
    </TouchableOpacity>
  );
}

type AccountTypeSelectorProps = {
  value: AccountMemberType;
  onChange: (value: AccountMemberType) => void;
  layout?: "row" | "stack";
  onSelect?: (value: AccountMemberType) => void;
};

export function AccountTypeSelector({
  value,
  onChange,
  layout = "row",
  onSelect,
}: AccountTypeSelectorProps) {
  const { width } = useWindowDimensions();
  const compact = layout === "row" && width < 360;

  return (
    <View style={layout === "stack" ? styles.stack : styles.row}>
      {ACCOUNT_TYPES.map((item) => (
        <AccountTypeCard
          key={item.value}
          config={item}
          selected={value === item.value}
          compact={compact}
          layout={layout}
          onPress={() => {
            onChange(item.value);
            onSelect?.(item.value);
          }}
        />
      ))}
    </View>
  );
}

export function RegistrationHeaderDivider() {
  return (
    <View style={dividerStyles.wrap}>
      <View style={dividerStyles.line} />
      <View style={dividerStyles.dot} />
      <View style={dividerStyles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  stack: {
    flexDirection: "column",
    gap: 14,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    minHeight: 124,
    maxHeight: 135,
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 6,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "visible",
  },
  cardStack: {
    width: "100%",
    minHeight: 132,
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 18,
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: "100%",
  },
  cardBodyStack: {
    alignItems: "flex-start",
    gap: 8,
    paddingRight: 4,
  },
  priceBadge: {
    position: "absolute",
    zIndex: 2,
    backgroundColor: "#10B981",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    ...Platform.select({
      ios: {
        shadowColor: "#064E3B",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  priceBadgeStack: {
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  priceBadgeCompact: {
    top: 6,
    right: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priceBadgeText: {
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  priceBadgeTextStack: {
    fontSize: 11,
  },
  priceBadgeTextCompact: {
    fontSize: 8,
  },
  title: {
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    textAlign: "center",
    lineHeight: 18,
  },
  descriptionEmphasis: {
    fontWeight: "700",
  },
  indicator: {
    width: 28,
    height: 3,
    borderRadius: 2,
    opacity: 0.55,
  },
  indicatorSelected: {
    width: 36,
    height: 4,
    opacity: 1,
  },
});

const dividerStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    width: "72%",
    maxWidth: 280,
    gap: 10,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#CBD5E1",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00A6D6",
  },
});
