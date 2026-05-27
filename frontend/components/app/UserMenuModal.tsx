/**
 * Hamburger menü — ana sayfa ile aynı sıra, alt menüler, lacivert sheet, profil/avatar/uzmanlık.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "../../src/hooks/useNavigation";
import { useAuth } from "../../screens/contexts/AuthContext";
import AppBottomSheetModal from "./AppBottomSheetModal";
import { authService } from "../../services/authService";
import { creditService } from "../../services/creditService";
import { createListingDraft } from "../../services/listingService";
import { listNotifications } from "../../services/notificationService";
import { getExpertBadgeCounts } from "../../services/expertRequestService";
import type { UserProfile } from "../../src/types/auth";
import {
  USER_MENU_SHEET_SNAP_POINTS,
  UserMenuSheetHeader,
  userMenuSheetDarkStyles,
} from "./UserMenuSheet";
import UserMenuSheetList from "./UserMenuSheetList";
import { getMenuItems } from "./userMenuItems";

interface Props {
  visible: boolean;
  onClose: () => void;
  currentScreen?: string;
}

export default function UserMenuModal({ visible, onClose, currentScreen: _currentScreen }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, logout, user, isLoading: isAuthLoading } = useAuth();
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [submenuOpenId, setSubmenuOpenId] = useState<string | null>(null);
  const [uzmanGorusuOpen, setUzmanGorusuOpen] = useState(false);
  const [menuSheetIndex, setMenuSheetIndex] = useState(0);
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [expertIncomingUnread, setExpertIncomingUnread] = useState(0);
  const [expertMyRepliesUnread, setExpertMyRepliesUnread] = useState(0);

  useEffect(() => {
    if (!visible) {
      setSubmenuOpenId(null);
      setUzmanGorusuOpen(false);
      setMenuSheetIndex(0);
    }
  }, [visible]);

  const loadProfile = useCallback(async () => {
    if (!isAuthenticated || isAuthLoading) {
      setUserProfile(null);
      return;
    }
    try {
      const res = await authService.getProfile();
      if (res.success && res.data?.profile) setUserProfile(res.data.profile);
    } catch {
      // best-effort
    }
  }, [isAuthenticated, isAuthLoading]);

  useEffect(() => {
    if (!visible || !isAuthenticated || isAuthLoading) {
      if (!visible || !isAuthenticated) setCreditBalance(null);
      return;
    }
    let cancelled = false;
    (async () => {
      await loadProfile();
      const [cr, n, badges] = await Promise.all([
        creditService.getBalance(),
        listNotifications(1, 0),
        getExpertBadgeCounts(),
      ]);
      if (cancelled) return;
      if (cr.success && cr.data && typeof cr.data.balance === "number") setCreditBalance(cr.data.balance);
      if (n.ok) setNotificationsUnread(n.unread_count);
      if (badges.ok) {
        setExpertIncomingUnread(Number(badges.data.unreadIncomingCount || 0));
        setExpertMyRepliesUnread(Number(badges.data.unreadMyRepliesCount || 0));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, isAuthenticated, isAuthLoading, loadProfile]);

  const openIlanVer = useCallback(async () => {
    if (!isAuthenticated) {
      onClose();
      Alert.alert("Giriş gerekli", "İlan vermek için giriş yapın veya kayıt olun.", [
        { text: "İptal", style: "cancel" },
        { text: "Giriş", onPress: () => router.push("login") },
      ]);
      return;
    }
    try {
      const res = await createListingDraft();
      if (!res.ok) {
        Alert.alert("İlan oluşturulamadı", res.error || "Sunucu yanıtı alınamadı.");
        return;
      }
      const lid = (res.data as { data?: { listing_id?: string } })?.data?.listing_id;
      if (!lid) {
        Alert.alert("İlan oluşturulamadı", "Tanıtıcı alınamadı.");
        return;
      }
      router.push("portal-webview", {
        path: `/portal/ilan/${lid}/duzenle/`,
        title: "İlan düzenle",
      });
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "İlan oluşturulamadı.");
    }
  }, [isAuthenticated, onClose, router]);

  const handleMenuItemPress = useCallback(
    (itemId: string) => {
      if (itemId === "dosyalarim") {
        setSubmenuOpenId((prev) => {
          const next = prev === "dosyalarim" ? null : "dosyalarim";
          setMenuSheetIndex(next ? 1 : 0);
          return next;
        });
        return;
      }
      if (itemId === "ilan-islemleri") {
        setSubmenuOpenId((prev) => {
          const next = prev === "ilan-islemleri" ? null : "ilan-islemleri";
          setMenuSheetIndex(next ? 1 : 0);
          return next;
        });
        return;
      }
      if (itemId === "ai-video") {
        setSubmenuOpenId((prev) => {
          const next = prev === "ai-video" ? null : "ai-video";
          setMenuSheetIndex(next ? 1 : 0);
          return next;
        });
        return;
      }

      onClose();
      setSubmenuOpenId(null);
      setUzmanGorusuOpen(false);
      setMenuSheetIndex(0);

      const run = () => {
        switch (itemId) {
          case "landing-intro":
            router.push("landing", { skipIntro: true });
            break;
          case "emlak-vitrini":
            router.replace("emlak-vitrini-liste");
            break;
          case "son-30-gun-pro":
            router.push("son-30-gun");
            break;
          case "promahalle":
            router.push("promahalle", { title: "ProMahalle" });
            break;
          case "sosyal-medya-sablonu":
            router.push("sosyal-medya-sablonu", { source: "menu" });
            break;
          case "aranacaklar":
            router.push("aranacaklar");
            break;
          case "sorgularim":
            router.push("index", { launch: "my-queries" });
            break;
          case "hisseli-parsel-projelerim":
            router.push("index", { launch: "parcel-split" });
            break;
          case "3d-tasarimlarim":
            router.push("index", { launch: "3d-designs" });
            break;
          case "kredi-paketleri":
            router.push("pricing");
            break;
          case "bildirimler":
            router.push("notifications");
            break;
          case "uzman-gorusu-isteklerim":
            router.push({ pathname: "expert-requests", params: { mode: "mine" } });
            break;
          case "uzman-gorusu-gelen":
            router.push({ pathname: "expert-requests", params: { mode: "incoming" } });
            break;
          case "kullanici":
            router.push(isAuthenticated ? "profile" : "login");
            break;
          case "admin-panel":
            router.push("admin");
            break;
          case "emsal-satis-bildir":
            router.push("sales-report");
            break;
          case "giris":
            router.push("login");
            break;
          case "hukuki-metinler":
            router.push("legal-hub");
            break;
          case "ilanlarim":
            router.push("ilanlarim");
            break;
          case "ai-video-studio":
            if (!isAuthenticated) {
              Alert.alert("Giriş gerekli", "AI Video için giriş yapın.", [
                { text: "İptal", style: "cancel" },
                { text: "Giriş", onPress: () => router.push("login") },
              ]);
              return;
            }
            router.push("ai-video-studio");
            break;
          case "ai-image-animation":
            if (!isAuthenticated) {
              Alert.alert("Giriş gerekli", "AI Resim için giriş yapın.", [
                { text: "İptal", style: "cancel" },
                { text: "Giriş", onPress: () => router.push("login") },
              ]);
              return;
            }
            router.push("ai-image-animation-purchase");
            break;
          case "ai-drone-video":
            router.push("ai-drone-video-info");
            break;
          case "ai-drone-jobs":
            if (!isAuthenticated) {
              Alert.alert("Giriş gerekli", "İşlerinizi görmek için giriş yapın.", [
                { text: "İptal", style: "cancel" },
                { text: "Giriş", onPress: () => router.push("login") },
              ]);
              return;
            }
            router.push("ai-drone-jobs");
            break;
          case "ilan-mesajlar":
            if (!isAuthenticated) {
              Alert.alert("Giriş gerekli", "Mesajları görmek için giriş yapın.", [
                { text: "İptal", style: "cancel" },
                { text: "Giriş", onPress: () => router.push("login") },
              ]);
              return;
            }
            router.push("portal-webview", {
              path: "/portal/ilan/mesajlar/",
              title: "Mesajlar",
            });
            break;
          case "cikis":
            Alert.alert("Çıkış Yap", "Çıkış yapmak istediğinize emin misiniz?", [
              { text: "İptal", style: "cancel" },
              {
                text: "Çıkış Yap",
                style: "destructive",
                onPress: async () => {
                  try {
                    await logout();
                  } catch {
                    Alert.alert("Hata", "Çıkış yapılırken bir hata oluştu.");
                  }
                },
              },
            ]);
            break;
          default:
            break;
        }
      };
      if (itemId === "ilan-ver") {
        void openIlanVer();
        return;
      }
      run();
    },
    [onClose, router, logout, openIlanVer, isAuthenticated],
  );

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={[...USER_MENU_SHEET_SNAP_POINTS]}
      index={menuSheetIndex}
      initialIndex={0}
      variant="dark"
      backdropOpacity={0.2}
      backdropPressBehavior="close"
    >
      <View style={{ paddingBottom: insets.bottom }}>
        <UserMenuSheetHeader
          variant="dark"
          isAuthenticated={!!isAuthenticated}
          user={user}
          profile={userProfile}
          creditBalance={creditBalance}
          onPressProfile={() => {
            onClose();
            router.push(isAuthenticated ? "profile" : "login");
          }}
          onPressCredits={() => {
            onClose();
            router.push("pricing");
          }}
        />
        <UserMenuSheetList
          items={getMenuItems(true, !!isAuthenticated, user?.is_admin || user?.role === "admin", user)}
          st={userMenuSheetDarkStyles}
          variant="dark"
          submenuOpenId={submenuOpenId}
          uzmanGorusuOpen={uzmanGorusuOpen}
          setUzmanGorusuOpen={setUzmanGorusuOpen}
          onItemPress={handleMenuItemPress}
          notificationsUnread={notificationsUnread}
          expertIncomingUnread={expertIncomingUnread}
          expertMyRepliesUnread={expertMyRepliesUnread}
          user={user}
          userProfile={userProfile}
          footerInsetBottom={insets.bottom}
        />
      </View>
    </AppBottomSheetModal>
  );
}
