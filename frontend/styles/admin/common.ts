import { StyleSheet } from "react-native";

export const adminColors = {
  bg: "#0f172a",
  card: "#1e293b",
  cardBorder: "#334155",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  accent: "#3b82f6",
  success: "#22c55e",
  danger: "#ef4444",
  warning: "#f59e0b",
  badge: "#dc2626",
} as const;

export const adminCommonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: adminColors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: adminColors.cardBorder,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: adminColors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  card: {
    backgroundColor: adminColors.card,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: adminColors.cardBorder,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    color: adminColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  cardSub: {
    color: adminColors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  empty: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: adminColors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: adminColors.success,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  dangerBtn: {
    backgroundColor: adminColors.danger,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
