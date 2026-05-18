/**
 * UsageBadge Component
 * 
 * Displays usage count badge for models with different states:
 * - null: Unlimited (green)
 * - 0: Zero uses (red, disabled)
 * - > 0: Limited uses (blue)
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { formatUsageCount } from "@/src/services/modelUsageService";

type UsageBadgeProps = {
  remainingUses: number | null;
  size?: "small" | "medium" | "large";
  showIcon?: boolean;
  /** Örn: FREE */
  labelOverride?: string;
};

export const UsageBadge: React.FC<UsageBadgeProps> = ({
  remainingUses,
  size = "small",
  showIcon = true,
  labelOverride,
}) => {
  const isUnlimited = remainingUses === null || (typeof labelOverride === "string" && labelOverride.length > 0);
  const isZero = remainingUses === 0;
  const isLimited = !isUnlimited && !isZero;

  const badgeStyle = [
    styles.badge,
    size === "small" && styles.badgeSmall,
    size === "medium" && styles.badgeMedium,
    size === "large" && styles.badgeLarge,
    isUnlimited && styles.badgeUnlimited,
    isLimited && styles.badgeLimited,
    isZero && styles.badgeZero,
  ];

  const textStyle = [
    styles.badgeText,
    size === "small" && styles.badgeTextSmall,
    size === "medium" && styles.badgeTextMedium,
    size === "large" && styles.badgeTextLarge,
    isUnlimited && styles.badgeTextUnlimited,
    isLimited && styles.badgeTextLimited,
    isZero && styles.badgeTextZero,
  ];

  const iconName = isUnlimited ? "infinite" : isZero ? "close-circle" : "repeat";
  const iconSize = size === "small" ? 10 : size === "medium" ? 12 : 14;

  return (
    <View style={badgeStyle}>
      {showIcon && (
        <Ionicons
          name={iconName}
          size={iconSize}
          color={
            isUnlimited
              ? "#10b981"
              : isLimited
              ? "#3b82f6"
              : "#ef4444"
          }
          style={styles.badgeIcon}
        />
      )}
      <Text style={textStyle}>{labelOverride || formatUsageCount(remainingUses)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  badgeSmall: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  badgeMedium: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeLarge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  badgeUnlimited: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  badgeLimited: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  badgeZero: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  badgeIcon: {
    marginRight: -2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  badgeTextSmall: {
    fontSize: 9,
  },
  badgeTextMedium: {
    fontSize: 10,
  },
  badgeTextLarge: {
    fontSize: 11,
  },
  badgeTextUnlimited: {
    color: "#10b981",
  },
  badgeTextLimited: {
    color: "#3b82f6",
  },
  badgeTextZero: {
    color: "#ef4444",
  },
});
