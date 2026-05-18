/**
 * ProParcel Pricing Screen
 * 
 * Kredi paketleri satın alma sayfası.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Modal,
  Dimensions,
} from "react-native";

const { height: WINDOW_HEIGHT } = Dimensions.get("window");

const TepeCoinIcon = require("../../assets/images/TepeCoin.png");
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { StatusBar } from "react-native";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../contexts/AuthContext";
import { creditService } from "../../services/creditService";
import type { CreditPackage, CreditBalance, CreditCostItem } from "../../services/creditService";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";

type PeriodType = "monthly" | "yearly";
type CustomerType = "kurumsal" | "bireysel";

export default function PricingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  // State
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [customerType, setCustomerType] = useState<CustomerType>("kurumsal");
  const [period, setPeriod] = useState<PeriodType>("monthly");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [purchasingPackageId, setPurchasingPackageId] = useState<number | null>(
    null
  );
  const [coinModalVisible, setCoinModalVisible] = useState(false);
  const [creditUsageItems, setCreditUsageItems] = useState<CreditCostItem[]>([]);

  // Icon rengi eşlemesi (icon key -> { bg, color })
  const ICON_COLORS: Record<string, { bg: string; color: string }> = {
    search: { bg: "rgba(44,82,130,0.1)", color: "#2c5282" },
    home: { bg: "rgba(39,103,73,0.1)", color: "#276749" },
    cube: { bg: "rgba(192,86,33,0.1)", color: "#c05621" },
    document: { bg: "rgba(85,60,154,0.1)", color: "#553c9a" },
    image: { bg: "rgba(116,66,16,0.1)", color: "#744210" },
    map: { bg: "rgba(26,54,93,0.1)", color: "#1a365d" },
    construct: { bg: "rgba(74,85,104,0.1)", color: "#4a5568" },
    cart: { bg: "rgba(44,82,130,0.1)", color: "#2c5282" },
    eye: { bg: "rgba(43,108,176,0.1)", color: "#2b6cb0" },
    share: { bg: "rgba(39,103,73,0.1)", color: "#276749" },
    circle: { bg: "rgba(74,85,104,0.1)", color: "#4a5568" },
  };

  // Bakiye kartındaki coin: tam dönüş (0→360°) soldan sağa, bitince sıfırlayıp tekrarla
  const coinRotation = useSharedValue(0);
  const runCoinRotation = useCallback(() => {
    coinRotation.value = 0;
    coinRotation.value = withTiming(
      360,
      { duration: 4000, easing: Easing.linear },
      (finished) => {
        "worklet";
        if (finished) runOnJS(runCoinRotation)();
      }
    );
  }, [coinRotation]);
  useEffect(() => {
    runCoinRotation();
  }, [runCoinRotation]);
  const animatedCoinStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 400 },
      { rotateY: `${coinRotation.value}deg` },
    ],
  }));

  /**
   * Paketleri ve bakiyeyi yükle
   * Not: Paketler giriş yapılmamış kullanıcılar için de gösterilmeli (ana projedeki gibi)
   */
  const loadData = useCallback(async () => {
    try {
      // Paketleri her zaman yükle (giriş yapılmamış kullanıcılar için de)
      const packagesRes = await creditService.listPackages();

      if (packagesRes.success && packagesRes.data) {
        const packagesList = packagesRes.data.packages || [];
        console.log("[Pricing] Paketler yüklendi:", packagesList.length, "paket");
        console.log("[Pricing] Paket detayları:", packagesList);
        setPackages(packagesList);
      } else {
        console.error("[Pricing] Paketler yüklenemedi:", packagesRes);
        // Giriş yapılmamış kullanıcılar için hata gösterme, sadece log
        if (isAuthenticated) {
          Alert.alert("Bilgi", packagesRes.message || "Paketler yüklenemedi.");
        }
      }

      // Bakiyeyi sadece giriş yapılmış kullanıcılar için yükle
      if (isAuthenticated) {
        try {
          const balanceRes = await creditService.getBalance();
          if (balanceRes.success && balanceRes.data) {
            setBalance(balanceRes.data);
          }
        } catch (error) {
          console.error("[Pricing] Bakiye yükleme hatası:", error);
        }
      }

      // Kredi kullanım maliyetlerini yükle (pricing kartları için)
      try {
        const costsRes = await creditService.getCreditCosts();
        const raw = costsRes as { items?: CreditCostItem[] };
        const items = raw?.items ?? (raw as { data?: { items?: CreditCostItem[] } })?.data?.items ?? [];
        if (Array.isArray(items) && items.length > 0) {
          setCreditUsageItems(items);
        }
      } catch (error) {
        console.warn("[Pricing] Kredi maliyetleri yüklenemedi:", error);
      }
    } catch (error) {
      console.error("[Pricing] Veri yükleme hatası:", error);
      if (isAuthenticated) {
        Alert.alert("Hata", "Paketler yüklenemedi.");
      }
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
    loadData();
  }, [loadData]);

  /**
   * Sayfa odaklandığında verileri yükle
   * Not: Paketler giriş yapılmamış kullanıcılar için de gösterilmeli
   */
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadData();
    }, [loadData])
  );

  /**
   * Paket satın al - Ana projedeki gibi direkt satın alma (onay modalı yok)
   */
  const handlePurchase = useCallback(
    async (packageId: number, packageName: string) => {
      if (!isAuthenticated) {
        Alert.alert("Giriş Gerekli", "Paket satın almak için giriş yapmanız gerekiyor.", [
          { text: "İptal", style: "cancel" },
          {
            text: "Giriş Yap",
            onPress: () => router.push("login"),
          },
        ]);
        return;
      }

      // Direkt satın alma işlemini başlat (ana projedeki gibi)
      setPurchasingPackageId(packageId);
      try {
        const response = await creditService.purchasePackage(packageId);
        if (response.success && response.data) {
          // Başarı mesajı göster (ana projedeki gibi)
          const message = response.data.message || 
            `${response.data.package?.credits || 0} Tepe Coin hesabınıza eklendi!`;
          const newBalance = response.data.new_balance || 0;
          
          Alert.alert(
            "Başarılı",
            `${message}\nYeni Bakiye: ${newBalance.toLocaleString("tr-TR")} Tepe Coin`,
            [
              {
                text: "Tamam",
                onPress: () => {
                  // Bakiyeyi yenile
                  loadData();
                },
              },
            ]
          );
        } else {
          Alert.alert(
            "Hata",
            response.message || "Paket satın alınamadı."
          );
        }
      } catch (error) {
        console.error("[Pricing] Satın alma hatası:", error);
        Alert.alert("Hata", "Satın alma işlemi başarısız oldu. Lütfen tekrar deneyin.");
      } finally {
        setPurchasingPackageId(null);
      }
    },
    [isAuthenticated, router, loadData]
  );

  // Filtrelenmiş paketler: Bireysel/Kurumsal + Aylık/Yıllık (her iki sekmede de aylık/yıllık)
  const filteredPackages = packages.filter((pkg) => {
    const pkgType = pkg.package_type ?? "kurumsal";
    if (customerType === "bireysel") {
      if (pkgType !== "bireysel") return false;
      return period === "monthly" ? pkg.duration_months === 1 : pkg.duration_months === 12;
    }
    if (pkgType !== "kurumsal") return false;
    return period === "monthly" ? pkg.duration_months === 1 : pkg.duration_months === 12;
  });

  // Giriş yapılmamışsa - Ana projedeki gibi paketler gösterilmeli, sadece satın alma için giriş gerekli

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
          <Text style={styles.headerTitle}>Tepe Coin Paketleri</Text>
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
        <Text style={styles.headerTitle}>Tepe Coin Paketleri</Text>
        <View style={styles.headerRight} />
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
        {/* Mevcut Bakiye */}
        {balance && (
          <View style={styles.balanceCard}>
            <View style={styles.balanceCardInner}>
              <TouchableOpacity
                style={styles.balanceCardIconCol}
                onPress={() => setCoinModalVisible(true)}
                activeOpacity={0.9}
              >
                <Animated.View style={animatedCoinStyle}>
                  <Image source={TepeCoinIcon} style={styles.balanceTepeCoinIconLarge} resizeMode="contain" />
                </Animated.View>
              </TouchableOpacity>
              <View style={styles.balanceCardInfoCol}>
                <Text style={styles.balanceTitle}>Mevcut Bakiyeniz</Text>
                <Text style={styles.balanceValue}>
                  {balance.balance.toLocaleString("tr-TR")} Tepe Coin
                </Text>
              </View>
            </View>
            <Text style={styles.balanceNote}>
              "Tepe Coin" ismi, "Göbekli Tepe"ye atfen seçilmiştir. Tescilli Markamızdır.
            </Text>
          </View>
        )}

        {/* Tepe Coin Kazan! */}
        <TouchableOpacity
          style={styles.earnCard}
          activeOpacity={0.85}
          onPress={() => {
            router.push("tepe-coin-earn");
          }}
        >
          <View style={styles.earnCardRow}>
            <View style={styles.earnCardIconWrap}>
              <Image source={TepeCoinIcon} style={styles.earnCardIcon} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.earnCardTitle}>Tepe Coin Kazan!</Text>
              <Text style={styles.earnCardSubtitle}>Öner, paylaş, değerlendir — coin kazan.</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#64748b" />
          </View>
        </TouchableOpacity>

        {/* Bireysel / Kurumsal sekmeleri - Kurumsal varsayılan */}
        <View style={styles.customerTypeToggle}>
          <TouchableOpacity
            style={[styles.customerTypeButton, customerType === "kurumsal" && styles.customerTypeButtonActive]}
            onPress={() => setCustomerType("kurumsal")}
          >
            <Text style={[styles.customerTypeButtonText, customerType === "kurumsal" && styles.customerTypeButtonTextActive]}>
              Kurumsal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.customerTypeButton, customerType === "bireysel" && styles.customerTypeButtonActive]}
            onPress={() => setCustomerType("bireysel")}
          >
            <Text style={[styles.customerTypeButtonText, customerType === "bireysel" && styles.customerTypeButtonTextActive]}>
              Bireysel
            </Text>
          </TouchableOpacity>
        </View>

        {/* Aylık / Yıllık - Kurumsal ve Bireysel altında */}
        <View style={styles.periodToggle}>
          <View style={styles.periodTabsRow}>
            <TouchableOpacity
              style={[styles.periodTab, period === "monthly" && styles.periodTabActive]}
              onPress={() => setPeriod("monthly")}
              activeOpacity={0.8}
            >
              <Text style={[styles.periodTabText, period === "monthly" && styles.periodTabTextActive]}>
                Aylık
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodTab, period === "yearly" && styles.periodTabActive]}
              onPress={() => setPeriod("yearly")}
              activeOpacity={0.8}
            >
              <Text style={[styles.periodTabText, period === "yearly" && styles.periodTabTextActive]}>
                Yıllık
                <Text style={styles.saveBadge}> Tasarruf!</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Coin PNG modal - GIF'e tıklanınca açılır */}
        <Modal
          visible={coinModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCoinModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setCoinModalVisible(false)}>
            <View style={styles.coinModalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.coinModalContent}>
                  <TouchableOpacity
                    style={styles.coinModalCloseButton}
                    onPress={() => setCoinModalVisible(false)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="close" size={28} color="#64748b" />
                  </TouchableOpacity>
                  <Image source={TepeCoinIcon} style={styles.coinModalPng} resizeMode="contain" />
                  <View style={styles.coinModalScrollWrap}>
                    <ScrollView
                      style={styles.coinModalScroll}
                      contentContainerStyle={styles.coinModalScrollContent}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      bounces={true}
                    >
                      <Text style={styles.coinModalBody}>
                        {"Yaklaşık 12.000 yıl önce inşa edilen Göbekli Tepe, yerleşik hayata geçişle birlikte insanlık tarihinde yeni bir çağ başlattı. İnsan ilk kez toprağa kalıcı biçimde bağlandı; yaşamını ve geleceğini bir mekân üzerinden tanımladı.\n\n"}
                        {"Yerleşik hayat, kişisel mülkiyeti doğurdu.\nSınırlar çizildi, paylar ayrıldı, gelecek planlandı.\nArazi artık rastgele bir alan değil; emekle, anlamla ve beklentiyle ölçülen bir değerdi.\n\n"}
                        {"ProParcel, bu tarihsel kırılmanın dijital çağdaki karşılığıdır.\nGöbekli Tepe'de taşlarla yapılan sınırlandırmayı, bugün bağımsız algoritmalarla yapar; toprağın eğimini, konumunu ve potansiyelini okuyarak gerçek değerini veriyle ortaya koyar.\n\n"}
                        {"Nasıl ki Göbekli Tepe yerleşik hayatla bir çağ açtıysa,\nProParcel de dünyada ilk olan özel algoritmik toprak değerlemesiyle yeni bir çağ açacak."}
                      </Text>

                    </ScrollView>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Packages Grid */}
        {filteredPackages.length > 0 ? (
          <View style={styles.packagesGrid}>
            {filteredPackages.map((pkg) => {
              const showYearlyStyle =
                (customerType === "bireysel" && pkg.duration_months === 12) ||
                (customerType === "kurumsal" && period === "yearly");
              return (
              <View
                key={pkg.id}
                style={[
                  styles.packageCard,
                  pkg.is_popular && styles.packageCardPopular,
                ]}
              >
                {pkg.is_popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>En Popüler</Text>
                  </View>
                )}

                <Text style={[styles.packageName, pkg.is_popular && styles.packageNameWithBadge]}>{pkg.name}</Text>

                <View style={styles.packageCredits}>
                  <Text style={styles.creditsValue}>
                    {pkg.credits.toLocaleString("tr-TR")}
                  </Text>
                  <View style={styles.packageCreditsLabelRow}>
                    <Image source={TepeCoinIcon} style={styles.packageTepeCoinIcon} resizeMode="contain" />
                    <Text style={styles.creditsLabel}>Tepe Coin</Text>
                  </View>
                  {showYearlyStyle && pkg.monthly_credits && (
                    <Text style={styles.monthlyCredits}>
                      ({pkg.monthly_credits}/ay)
                    </Text>
                  )}
                </View>

                <View style={styles.packagePrice}>
                  <Text style={styles.priceValue}>
                    {showYearlyStyle && pkg.monthly_price
                      ? pkg.monthly_price.toLocaleString("tr-TR")
                      : pkg.price.toLocaleString("tr-TR")}
                  </Text>
                  <Text style={styles.priceCurrency}>TL</Text>
                  <Text style={styles.pricePeriod}>
                    {showYearlyStyle ? "/ay" : ""}
                  </Text>
                </View>

                {showYearlyStyle && (
                  <Text style={styles.totalPrice}>
                    Toplam: {pkg.price.toLocaleString("tr-TR")} TL/yıl
                  </Text>
                )}

                <View style={styles.packageFeatures}>
                  <View style={styles.feature}>
                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                    <Text style={styles.featureText}>
                      {pkg.credits} Tepe Coin
                      {showYearlyStyle &&
                        pkg.monthly_credits &&
                        ` (${pkg.monthly_credits}/ay)`}
                    </Text>
                  </View>
                  <View style={styles.feature}>
                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                    <Text style={styles.featureText}>
                      {pkg.duration_months === 1
                        ? "1 Aylık Geçerlilik"
                        : "12 Aylık Geçerlilik"}
                    </Text>
                  </View>
                  {showYearlyStyle && (
                    <View style={[styles.feature, styles.featureHighlight]}>
                      <Ionicons name="pricetag" size={16} color="#f59e0b" />
                      <Text style={[styles.featureText, styles.featureTextHighlight]}>
                        %40 Tasarruf
                      </Text>
                    </View>
                  )}
                  <View style={styles.feature}>
                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                    <Text style={styles.featureText}>Tüm Özelliklere Erişim</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.purchaseButton,
                    purchasingPackageId === pkg.id && styles.purchaseButtonDisabled,
                  ]}
                  onPress={() => handlePurchase(pkg.id, pkg.name)}
                  disabled={purchasingPackageId === pkg.id}
                >
                  {purchasingPackageId === pkg.id ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.purchaseButtonText}>İşleniyor...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="cart" size={20} color="#fff" />
                      <Text style={styles.purchaseButtonText}>Satın Al</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
            })}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>
              {customerType === "bireysel"
                ? period === "monthly"
                  ? "Henüz bireysel aylık paket tanımlanmamış"
                  : "Henüz bireysel yıllık paket tanımlanmamış"
                : period === "monthly"
                  ? "Henüz aylık paket tanımlanmamış"
                  : "Henüz yıllık paket tanımlanmamış"}
            </Text>
          </View>
        )}

        {/* Credit Usage Info */}
        <View style={styles.usageInfoSection}>
          <View style={styles.usageInfoHeader}>
            <Image source={TepeCoinIcon} style={styles.usageInfoTepeCoinIcon} resizeMode="contain" />
            <Text style={styles.usageInfoTitle}>Tepe Coin Nasıl Kullanılır?</Text>
          </View>

          <View style={styles.usageCards}>
            {creditUsageItems.length > 0 ? (
              creditUsageItems.map((item, idx) => {
                const iconStyle = ICON_COLORS[item.icon] ?? ICON_COLORS.circle;
                const ionName = (item.icon_ion || item.icon || "ellipse") as React.ComponentProps<typeof Ionicons>["name"];
                return (
                  <View key={item.action_type} style={styles.usageCard}>
                    <View style={[styles.usageIcon, { backgroundColor: iconStyle.bg }]}>
                      <Ionicons name={ionName} size={24} color={iconStyle.color} />
                    </View>
                    <View style={styles.usageContent}>
                      <Text style={styles.usageCardTitle}>{item.display_name}</Text>
                      <Text style={styles.usageCost}>{item.credits} Tepe Coin</Text>
                      {item.description ? (
                        <Text style={styles.usageDesc}>{item.description}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.usageCard}>
                <View style={[styles.usageIcon, styles.usageIconBlue]}>
                  <Ionicons name="information-circle-outline" size={24} color="#64748b" />
                </View>
                <View style={styles.usageContent}>
                  <Text style={styles.usageCardTitle}>Kredi Kullanımı</Text>
                  <Text style={styles.usageDesc}>Kullanım bilgileri yükleniyor...</Text>
                </View>
              </View>
            )}
          </View>
        </View>
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
    fontSize: 16,
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
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  earnCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.35)",
  },
  earnCardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  earnCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
  },
  earnCardIcon: { width: 26, height: 26 },
  earnCardTitle: { fontSize: 16, fontWeight: "900", color: "#1e293b" },
  earnCardSubtitle: { fontSize: 12, color: "#64748b", fontWeight: "600", marginTop: 4 },
  balanceCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  balanceCardIconCol: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: 12,
  },
  balanceTepeCoinIconLarge: {
    width: 72,
    height: 72,
  },
  balanceCardInfoCol: {
    flex: 1,
    justifyContent: "center",
  },
  balanceTitle: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#3b82f6",
  },
  balanceNote: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 12,
    marginBottom: 0,
    marginHorizontal: 0,
    fontStyle: "italic",
    textAlign: "center",
  },
  coinModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  coinModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    paddingBottom: 12,
    alignItems: "center",
    maxWidth: "100%",
    width: "100%",
    height: WINDOW_HEIGHT * 0.88,
    maxHeight: WINDOW_HEIGHT * 0.88,
  },
  coinModalCloseButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  coinModalPng: {
    width: 140,
    height: 140,
  },
  coinModalScrollWrap: {
    width: "100%",
    flex: 1,
    minHeight: 0,
    marginTop: 12,
  },
  coinModalScroll: {
    flex: 1,
    width: "100%",
  },
  coinModalScrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 40,
    flexGrow: 1,
  },
  coinModalBody: {
    fontSize: 13,
    lineHeight: 20,
    color: "#334155",
    textAlign: "left",
  },
  coinModalHint: {
    marginTop: 12,
    fontSize: 12,
    color: "#64748b",
  },
  customerTypeToggle: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  customerTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  customerTypeButtonActive: {
    backgroundColor: "#3b82f6",
  },
  customerTypeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  customerTypeButtonTextActive: {
    color: "#fff",
  },
  periodToggle: {
    marginBottom: 24,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  periodTabsRow: {
    flexDirection: "row",
  },
  periodTab: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  periodTabActive: {
    backgroundColor: "#f1f5f9",
    borderBottomColor: "#3b82f6",
  },
  periodTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  periodTabTextActive: {
    color: "#1e293b",
  },
  saveBadge: {
    fontSize: 12,
    color: "#f59e0b",
  },
  packagesGrid: {
    gap: 16,
  },
  packageCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    position: "relative",
  },
  packageCardPopular: {
    borderColor: "#f59e0b",
    borderWidth: 2,
  },
  popularBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#f59e0b",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  packageName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e293b",
    marginTop: 4,
    marginBottom: 16,
    textAlign: "center",
  },
  packageNameWithBadge: {
    marginTop: 40,
  },
  packageCredits: {
    alignItems: "center",
    marginBottom: 16,
  },
  packageCreditsLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  packageTepeCoinIcon: {
    width: 22,
    height: 22,
  },
  creditsValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#3b82f6",
  },
  creditsLabel: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },
  monthlyCredits: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  packagePrice: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
  },
  priceCurrency: {
    fontSize: 16,
    color: "#64748b",
    marginLeft: 4,
  },
  pricePeriod: {
    fontSize: 14,
    color: "#94a3b8",
    marginLeft: 4,
  },
  totalPrice: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
  },
  packageFeatures: {
    gap: 8,
    marginBottom: 20,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureHighlight: {
    backgroundColor: "#fef3c7",
    padding: 8,
    borderRadius: 6,
  },
  featureText: {
    fontSize: 14,
    color: "#64748b",
  },
  featureTextHighlight: {
    color: "#f59e0b",
    fontWeight: "600",
  },
  purchaseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  usageInfoSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  usageInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  usageInfoTepeCoinIcon: {
    width: 24,
    height: 24,
  },
  usageInfoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
  },
  usageCards: {
    gap: 16,
  },
  usageCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  usageIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  usageIconBlue: {
    backgroundColor: "#ebf8ff",
  },
  usageIconGreen: {
    backgroundColor: "#f0fff4",
  },
  usageIconOrange: {
    backgroundColor: "#fffaf0",
  },
  usageContent: {
    flex: 1,
  },
  usageCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  usageCost: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
    marginBottom: 4,
  },
  usageDesc: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
});
