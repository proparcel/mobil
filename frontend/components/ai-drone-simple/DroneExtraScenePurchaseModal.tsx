/**
 * Pratik Video — ek sahne IAP (1 veya 2 sahne).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getProductPricing, purchaseProductLicense } from "../../services/productLicenseService";
import {
  DRONE_EK_SAHNE_2_ACTION,
  DRONE_EK_SAHNE_ACTION,
} from "../../services/droneSceneService";
import { AI_DRONE_EDITOR_THEME } from "../../src/constants/aiDroneEditorTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Backdrop / Vazgeç — bekleyen capture iptali (editor Devam gate). */
  onDismiss?: () => void;
  referenceId: string;
  jobId: string;
  /** Devam gate: kare sayısına göre öne çıkarılacak paket. */
  preferredActionType?: typeof DRONE_EK_SAHNE_ACTION | typeof DRONE_EK_SAHNE_2_ACTION;
  onPurchaseSuccess?: () => void;
};

type PackageOption = {
  actionType: typeof DRONE_EK_SAHNE_ACTION | typeof DRONE_EK_SAHNE_2_ACTION;
  title: string;
  subtitle: string;
  scenes: number;
};

const PACKAGES: PackageOption[] = [
  {
    actionType: DRONE_EK_SAHNE_ACTION,
    title: "1 Ek Sahne",
    subtitle: "Tek sahne üretim hakkı",
    scenes: 1,
  },
  {
    actionType: DRONE_EK_SAHNE_2_ACTION,
    title: "2 Ek Sahne",
    subtitle: "Tek seferde en fazla iki sahne",
    scenes: 2,
  },
];

function formatTry(price: number | null): string {
  if (price == null || price <= 0) return "Fiyat yükleniyor…";
  return `${Math.round(price).toLocaleString("tr-TR")} ₺`;
}

export function DroneExtraScenePurchaseModal({
  visible,
  onClose,
  onDismiss,
  referenceId,
  jobId,
  preferredActionType,
  onPurchaseSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [error, setError] = useState<string | null>(null);

  const packageOptions = useMemo(() => {
    if (!preferredActionType) return PACKAGES;
    return [...PACKAGES].sort((a, b) => {
      if (a.actionType === preferredActionType) return -1;
      if (b.actionType === preferredActionType) return 1;
      return 0;
    });
  }, [preferredActionType]);

  const handleDismiss = useCallback(() => {
    (onDismiss ?? onClose)();
  }, [onDismiss, onClose]);

  const loadPricing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next: Record<string, number | null> = {};
      for (const pkg of PACKAGES) {
        const row = await getProductPricing(pkg.actionType);
        next[pkg.actionType] =
          row && typeof row.price_try === "number" && row.price_try > 0 ? row.price_try : null;
      }
      setPrices(next);
    } catch {
      setError("Fiyat bilgisi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void loadPricing();
  }, [visible, loadPricing]);

  const handlePurchase = async (pkg: PackageOption) => {
    if (!referenceId.trim() || !jobId.trim()) {
      setError("Parsel veya video bilgisi eksik.");
      return;
    }
    const price = prices[pkg.actionType];
    if (price == null || price <= 0) {
      setError("Paket fiyatı tanımlı değil.");
      return;
    }
    setPurchasing(pkg.actionType);
    setError(null);
    try {
      const result = await purchaseProductLicense({
        actionType: pkg.actionType,
        referenceId,
        description: JSON.stringify({
          product: "Pratik Video Ek Sahne",
          source: "mobile_drone_simple_editor",
          job_id: jobId,
          scenes: pkg.scenes,
        }),
      });
      if (!result.success) {
        setError(result.error || result.message || "Satın alma başarısız.");
        return;
      }
      onPurchaseSuccess?.();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Satın alma başarısız.");
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>Ek Sahne Satın Al</Text>
          <Text style={styles.subtitle}>
            Sahne üretim hakkınız bitti. Devam etmek için paket seçin.
          </Text>

          {loading ? (
            <ActivityIndicator color={AI_DRONE_EDITOR_THEME.primaryBright} style={styles.loader} />
          ) : (
            packageOptions.map((pkg) => (
              <TouchableOpacity
                key={pkg.actionType}
                style={[
                  styles.pkgBtn,
                  preferredActionType === pkg.actionType ? styles.pkgBtnPreferred : null,
                ]}
                disabled={Boolean(purchasing)}
                onPress={() => void handlePurchase(pkg)}
              >
                <View style={styles.pkgBody}>
                  <Text style={styles.pkgTitle}>
                    {pkg.title}
                    {preferredActionType === pkg.actionType ? " · Önerilen" : ""}
                  </Text>
                  <Text style={styles.pkgSub}>{pkg.subtitle}</Text>
                </View>
                <View style={styles.pkgRight}>
                  <Text style={styles.pkgPrice}>{formatTry(prices[pkg.actionType] ?? null)}</Text>
                  {purchasing === pkg.actionType ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="cart" size={18} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss}>
            <Text style={styles.closeBtnText}>Vazgeç</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.72)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
  },
  title: { color: "#f8fafc", fontWeight: "800", fontSize: 18 },
  subtitle: { color: "#94a3b8", fontSize: 13, lineHeight: 18 },
  loader: { marginVertical: 16 },
  pkgBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: AI_DRONE_EDITOR_THEME.primary,
    borderRadius: 12,
    padding: 12,
  },
  pkgBtnPreferred: {
    borderWidth: 2,
    borderColor: "#fbbf24",
  },
  pkgBody: { flex: 1, gap: 2 },
  pkgTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
  pkgSub: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
  pkgRight: { alignItems: "flex-end", gap: 6, minWidth: 72 },
  pkgPrice: { color: "#fff", fontWeight: "700", fontSize: 13 },
  error: { color: "#fecaca", fontSize: 12 },
  closeBtn: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12 },
  closeBtnText: { color: "#cbd5e1", fontWeight: "700" },
});
