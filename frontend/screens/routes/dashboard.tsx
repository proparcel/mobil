/**
 * ProParcel Dashboard Screen
 * 
 * Kullanıcı dashboard sayfası - kredi bakiyesi, istatistikler ve kullanım geçmişi.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { creditService } from "../../services/creditService";
import type {
  CreditBalance,
  CreditStats,
  CreditHistoryItem,
} from "../../services/creditService";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  // State
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [history, setHistory] = useState<CreditHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Dashboard verilerini yükle
   */
  const loadDashboardData = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    try {
      const [balanceRes, statsRes, historyRes] = await Promise.all([
        creditService.getBalance(),
        creditService.getStats(),
        creditService.getHistory(10),
      ]);

      if (balanceRes.success && balanceRes.data) {
        setBalance(balanceRes.data);
      }

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }

      if (historyRes.success && historyRes.data) {
        setHistory(historyRes.data.history || []);
      }
    } catch (error) {
      console.error("[Dashboard] Veri yükleme hatası:", error);
      Alert.alert("Hata", "Dashboard verileri yüklenemedi.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  /**
   * Pull to refresh
   */
  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  /**
   * Sayfa odaklandığında verileri yükle
   */
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        setIsLoading(true);
        loadDashboardData();
      }
    }, [isAuthenticated, loadDashboardData])
  );

  // Giriş yapılmamışsa
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            accessibilityLabel="Geri"
          >
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed" size={64} color="#64748b" />
          <Text style={styles.emptyText}>Giriş yapmanız gerekiyor</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("login")}
          >
            <Text style={styles.loginButtonText}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Yükleniyor
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            accessibilityLabel="Geri"
          >
            <Ionicons name="arrow-back" size={18} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => router.push("pricing")}
        >
          <Ionicons name="add-circle" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: 32 + insets.bottom + 80 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.statIconBlue]}>
              <Ionicons name="wallet" size={24} color="#2c5282" />
            </View>
            <Text style={styles.statValue}>
              {balance?.balance?.toLocaleString("tr-TR") || "0"}
            </Text>
            <Text style={styles.statLabel}>Mevcut Bakiye</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.statIconGreen]}>
              <Ionicons name="add-circle" size={24} color="#276749" />
            </View>
            <Text style={styles.statValue}>
              {balance?.total_purchased?.toLocaleString("tr-TR") || "0"}
            </Text>
            <Text style={styles.statLabel}>Toplam Alınan</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.statIconOrange]}>
              <Ionicons name="trending-down" size={24} color="#c05621" />
            </View>
            <Text style={styles.statValue}>
              {balance?.total_used?.toLocaleString("tr-TR") || "0"}
            </Text>
            <Text style={styles.statLabel}>Toplam Kullanılan</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.statIconPurple]}>
              <Ionicons name="calendar" size={24} color="#6b46c1" />
            </View>
            <Text style={styles.statValue}>
              {stats?.last_30_days?.toLocaleString("tr-TR") || "0"}
            </Text>
            <Text style={styles.statLabel}>Son 30 Gün</Text>
          </View>
        </View>

        {/* Son Kullanımlar */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Son Kullanımlar</Text>
          </View>
          {history.length > 0 ? (
            <View style={styles.historyList}>
              {history.map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.historyItemLeft}>
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color="#64748b"
                    />
                    <View style={styles.historyItemContent}>
                      <Text style={styles.historyItemTitle}>
                        {item.action_type_display || item.action_type}
                      </Text>
                      {item.description && (
                        <Text style={styles.historyItemDescription}>
                          {item.description}
                        </Text>
                      )}
                      <Text style={styles.historyItemDate}>
                        {new Date(item.created_at).toLocaleDateString("tr-TR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyItemCredits}>
                    -{item.credits_used} C
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptySection}>
              <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptySectionText}>
                Henüz kullanım geçmişi yok
              </Text>
            </View>
          )}
        </View>

        {/* Kredi Satın Al Butonu */}
        <TouchableOpacity
          style={styles.purchaseButton}
          onPress={() => router.push("pricing")}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.purchaseButtonText}>Kredi Satın Al</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e293b",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "#3b82f6",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: "#64748b",
    textAlign: "center",
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statIconBlue: {
    backgroundColor: "#ebf8ff",
  },
  statIconGreen: {
    backgroundColor: "#f0fff4",
  },
  statIconOrange: {
    backgroundColor: "#fffaf0",
  },
  statIconPurple: {
    backgroundColor: "#faf5ff",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  historyItemLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 12,
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  historyItemDescription: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  historyItemDate: {
    fontSize: 11,
    color: "#94a3b8",
  },
  historyItemCredits: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ef4444",
  },
  emptySection: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptySectionText: {
    marginTop: 12,
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  purchaseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  purchaseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
