/**
 * Ortak kullanıcı menüsü sheet — başlık, kullanıcı bilgisi şeridi ve liste stilleri (tüm sayfalarda aynı görünüm).
 */
import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import type { User, UserProfile } from "../../src/types/auth";

export const TepeCoinIcon = require("../../assets/images/TepeCoin.png");

/** Ana sayfa menüsü ile aynı snap; çift yükseklik için. */
export const USER_MENU_SHEET_SNAP_POINTS: (string | number)[] = ["70%", "90%"];

const COLORS = {
  accentBlue: "#3b82f6",
  cardBg: "#ffffff",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  borderSoft: "#e2e8f0",
  subRowBg: "#f8fafc",
  subSubRowBg: "#f1f5f9",
  dangerRed: "#ef4444",
  vipBg: "#d97706",
  placeholderBg: "#e2e8f0",
  creditBg: "#f1f5f9",
  creditText: "#334155",
} as const;

export function UserMenuSheetTitleRow({
  title,
  variant = "light",
}: {
  title: string;
  variant?: "light" | "dark";
}) {
  const st = variant === "dark" ? userMenuSheetDarkStyles : userMenuSheetStyles;
  return (
    <View style={st.titleRow}>
      <Text style={st.title}>{title}</Text>
    </View>
  );
}

type HeaderProps = {
  isAuthenticated: boolean;
  user: User | null;
  profile: UserProfile | null;
  creditBalance: number | null;
  onPressProfile: () => void;
  onPressCredits: () => void;
  /** `dark`: lacivert sheet (harita / vitrin menüsü) */
  variant?: "light" | "dark";
};

export function UserMenuSheetHeader({
  isAuthenticated,
  user,
  profile,
  creditBalance,
  onPressProfile,
  onPressCredits,
  variant = "light",
}: HeaderProps) {
  const nameAndMeta = useMemo(() => {
    const fullName = profile
      ? [profile.first_name, profile.last_name]
          .filter(Boolean)
          .map((s) => (s!.charAt(0).toUpperCase() + (s!.slice(1) || "").toLowerCase()))
          .join(" ") || user?.full_name || user?.email || "Kullanıcı"
      : user?.full_name || user?.email || "Kullanıcı";
    const canShowExpert = user?.role === "consultant" || user?.role === "broker";
    const current = profile?.expert_score_current ?? 0;
    const peak = profile?.expert_score_peak ?? 0;
    const level = profile?.expert_level;
    const levelLabel =
      level === "platinum"
        ? "Platin"
        : level === "gold"
          ? "Altın"
          : level === "silver"
            ? "Gümüş"
            : level === "bronze"
              ? "Bronz"
              : level === "advisor"
                ? "Danışman"
                : level === "first_experience"
                  ? "İlk Tecrübe"
                  : "";
    const meta =
      canShowExpert
        ? `Uzmanlık Puanı: ${Number(current || 0)}${levelLabel ? ` (${levelLabel})` : ""} • Peak: ${Number(peak || 0)}`
        : null;
    return { fullName, canShowExpert: !!canShowExpert, meta, isVip: user?.role === "vip" || user?.role === "vip_limited" };
  }, [profile, user]);

  const avatarUrl = profile?.avatar_url || profile?.avatar;
  const isApproved = profile?.avatar_approved === true;
  const showAvatar = Boolean(avatarUrl && isApproved);
  const hs = variant === "dark" ? headerStylesDark : headerStyles;

  return (
    <View style={hs.outer}>
      <TouchableOpacity
        style={hs.userRow}
        onPress={onPressProfile}
        activeOpacity={0.7}
        accessibilityLabel={isAuthenticated ? "Profili aç" : "Giriş yap"}
      >
        {isAuthenticated ? (
          showAvatar ? (
            <>
              <Image source={{ uri: avatarUrl as string }} style={hs.avatar} />
              <View style={hs.textCol}>
                <View style={hs.nameRow}>
                  <Text style={hs.userName} numberOfLines={1}>
                    {nameAndMeta.fullName}
                  </Text>
                  {nameAndMeta.isVip ? (
                    <View style={hs.vipBadge}>
                      <Ionicons name="star" size={10} color="#fff" />
                      <Text style={hs.vipText}>VIP</Text>
                    </View>
                  ) : null}
                </View>
                {nameAndMeta.canShowExpert && nameAndMeta.meta ? (
                  <Text style={hs.userMeta} numberOfLines={1}>
                    {nameAndMeta.meta}
                  </Text>
                ) : null}
              </View>
            </>
          ) : (
            <>
              <View style={hs.avatarPlaceholder}>
                <Ionicons name="person" size={24} color={variant === "dark" ? "#94a3b8" : COLORS.textSecondary} />
              </View>
              <View style={hs.textCol}>
                <View style={hs.nameRow}>
                  <Text style={hs.userName} numberOfLines={1}>
                    {nameAndMeta.fullName}
                  </Text>
                  {nameAndMeta.isVip ? (
                    <View style={hs.vipBadge}>
                      <Ionicons name="star" size={10} color="#fff" />
                      <Text style={hs.vipText}>VIP</Text>
                    </View>
                  ) : null}
                </View>
                {nameAndMeta.canShowExpert && nameAndMeta.meta ? (
                  <Text style={hs.userMeta} numberOfLines={1}>
                    {nameAndMeta.meta}
                  </Text>
                ) : null}
              </View>
            </>
          )
        ) : (
          <>
            <View style={hs.avatarPlaceholder}>
              <Ionicons name="person-outline" size={24} color={variant === "dark" ? "#94a3b8" : COLORS.textSecondary} />
            </View>
            <Text style={hs.userName}>Giriş yapın</Text>
          </>
        )}
      </TouchableOpacity>
      {isAuthenticated && creditBalance !== null ? (
        <TouchableOpacity style={hs.creditBadge} onPress={onPressCredits} activeOpacity={0.7}>
          <Image source={TepeCoinIcon} style={hs.creditIcon} resizeMode="contain" />
          <Text style={hs.creditText}>{creditBalance.toLocaleString("tr-TR")}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  outer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    backgroundColor: COLORS.cardBg,
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.placeholderBg,
    justifyContent: "center",
    alignItems: "center",
  },
  textCol: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 17, fontWeight: "600", color: COLORS.textPrimary, flexShrink: 1 },
  userMeta: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginTop: 2 },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.vipBg,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  vipText: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  creditBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    gap: 6,
    backgroundColor: COLORS.creditBg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  creditIcon: { width: 20, height: 20 },
  creditText: { fontSize: 14, fontWeight: "800", color: COLORS.creditText },
});

const headerStylesDark = StyleSheet.create({
  outer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    backgroundColor: "#1e293b",
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  textCol: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 17, fontWeight: "600", color: "#e2e8f0", flexShrink: 1 },
  userMeta: { fontSize: 12, fontWeight: "600", color: "#94a3b8", marginTop: 2 },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.vipBg,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  vipText: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  creditBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    gap: 6,
    backgroundColor: "#334155",
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  creditIcon: { width: 20, height: 20 },
  creditText: { fontSize: 14, fontWeight: "800", color: "#fff" },
});

/** Liste satırları — UserMenuModal / ana sayfa menüsü ile uyumlu */
export const userMenuSheetStyles = StyleSheet.create({
  titleRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    backgroundColor: COLORS.cardBg,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  scroll: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  itemCurrent: {
    backgroundColor: COLORS.accentBlue + "10",
  },
  itemSub: {
    paddingLeft: 28,
    marginHorizontal: 4,
    backgroundColor: COLORS.subRowBg,
  },
  itemSubSub: {
    paddingLeft: 40,
    marginHorizontal: 4,
    backgroundColor: COLORS.subSubRowBg,
  },
  itemDisabled: { opacity: 0.5 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.cardBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  iconWrapCurrent: {
    backgroundColor: COLORS.accentBlue + "15",
    borderColor: COLORS.accentBlue + "30",
  },
  itemText: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textPrimary,
    flex: 1,
  },
  itemTextCurrent: {
    fontWeight: "700",
    color: COLORS.accentBlue,
  },
  itemTextDisabled: {
    color: COLORS.textSecondary,
  },
  itemTextDanger: {
    color: COLORS.dangerRed,
  },
  currentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accentBlue,
    marginRight: 8,
  },
  chevron: { marginLeft: 4 },
  unreadBadge: {
    marginLeft: "auto",
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeRed: {
    marginLeft: "auto",
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeGreen: {
    marginLeft: "auto",
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },
});

/** Lacivert menü listesi (AppBottomSheetModal `variant="dark"` ile) */
export const userMenuSheetDarkStyles = StyleSheet.create({
  titleRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(51, 65, 85, 0.85)",
    backgroundColor: "transparent",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e2e8f0",
  },
  scroll: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  itemCurrent: { backgroundColor: "rgba(59, 130, 246, 0.12)" },
  itemSub: {
    paddingLeft: 28,
    marginHorizontal: 4,
    backgroundColor: "#0f172a",
  },
  itemSubSub: {
    paddingLeft: 40,
    marginHorizontal: 4,
    backgroundColor: "#0f172a",
  },
  itemDisabled: { opacity: 0.5 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#475569",
  },
  iconWrapCurrent: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderColor: "rgba(59, 130, 246, 0.45)",
  },
  itemText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#e2e8f0",
    flex: 1,
  },
  itemTextCurrent: { fontWeight: "700", color: "#60a5fa" },
  itemTextDisabled: { color: "#64748b" },
  itemTextDanger: { color: "#f87171" },
  currentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3b82f6",
    marginRight: 8,
  },
  chevron: { marginLeft: 4 },
  unreadBadge: {
    marginLeft: "auto",
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeRed: {
    marginLeft: "auto",
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeGreen: {
    marginLeft: "auto",
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },
});
