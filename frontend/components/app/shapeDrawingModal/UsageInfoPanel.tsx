/**
 * UsageInfoPanel Component
 * 
 * Displays usage count information for the selected model.
 * Shows different messages based on usage state:
 * - null: "Sınırsız kullanım" (green)
 * - 0: "Kullanım hakkınız tükenmiş" (red)
 * - > 0: "Kalan: X kullanım" (blue)
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { UsageBadge } from "./UsageBadge";
import { formatUsageCount } from "@/src/services/modelUsageService";

type UsageInfoPanelProps = {
  remainingUses: number | null;
  modelName?: string;
};

export const UsageInfoPanel: React.FC<UsageInfoPanelProps> = ({
  remainingUses,
  modelName,
}) => {
  const isUnlimited = remainingUses === null;
  const isZero = remainingUses === 0;
  const isLimited = !isUnlimited && !isZero;

  const containerStyle = [
    styles.container,
    isUnlimited && styles.containerUnlimited,
    isLimited && styles.containerLimited,
    isZero && styles.containerZero,
  ];

  const getMessage = () => {
    if (isUnlimited) {
      return "Sınırsız kullanım";
    }
    if (isZero) {
      return "Kullanım hakkınız tükenmiş";
    }
    return `Kalan: ${remainingUses} kullanım`;
  };

  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    if (isUnlimited) return "infinite";
    if (isZero) return "close-circle";
    return "repeat";
  };

  const getIconColor = () => {
    if (isUnlimited) return "#10b981";
    if (isLimited) return "#3b82f6";
    return "#ef4444";
  };

  return (
    <View style={containerStyle}>
      <View style={styles.content}>
        <Ionicons name={getIconName()} size={16} color={getIconColor()} style={styles.icon} />
        <View style={styles.textContainer}>
          {modelName && (
            <Text style={styles.modelName} numberOfLines={1}>
              {modelName}
            </Text>
          )}
          <Text style={[styles.message, isUnlimited && styles.messageUnlimited, isLimited && styles.messageLimited, isZero && styles.messageZero]}>
            {getMessage()}
          </Text>
        </View>
        <UsageBadge remainingUses={remainingUses} size="small" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginVertical: 4,
  },
  containerUnlimited: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  containerLimited: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  containerZero: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    marginRight: 4,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  modelName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
  },
  message: {
    fontSize: 11,
    fontWeight: "500",
  },
  messageUnlimited: {
    color: "#10b981",
  },
  messageLimited: {
    color: "#3b82f6",
  },
  messageZero: {
    color: "#ef4444",
  },
});
