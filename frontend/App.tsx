/**
 * ProParcel App Entry Point
 * 
 * React Navigation ile routing yapısı
 */

import React, { useEffect, useState, useCallback } from 'react';
import { NativeModules, Platform, View, ActivityIndicator, AppState } from "react-native";
import { checkAppUpdate, type AppUpdateCheckResult } from './services/appUpdateService';
import { setDismissedOptionalUpdateVersion } from './src/utils/appUpdateStorage';
import { ForceUpdateScreen } from './components/app/ForceUpdateScreen';
import { OptionalUpdateModal } from './components/app/OptionalUpdateModal';
import { NavigationContainer, DarkTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './components/app/ErrorBoundary';
import { AppChromeScaffold } from './components/app/AppChromeScaffold';
import { AuthProvider } from './screens/contexts/AuthContext';
import { BadgeCelebrationProvider } from './screens/contexts/BadgeCelebrationContext';
import { ScreenShieldProvider, useScreenShield } from './screens/contexts/ScreenShieldContext';
import { ScreenShieldOverlay } from './components/app/screenShield/ScreenShieldOverlay';
import { storageService } from "./services/storageService";
import { useDeepLinkNavigation } from './src/hooks/useDeepLinkNavigation';
import { IncomingShareImageListener } from './src/hooks/IncomingShareImageListener';
import { ShareIntentProvider } from './src/shareIntent/shareIntentNative';
import {
  addNotificationResponseListener,
  getInitialNotificationData,
  registerPushToken,
  shouldOpenHowToLiveTab,
  type PushNotificationData,
} from './services/pushNotificationService';
import { saveHowToLiveSession } from './services/howToLiveSessionStorage';

// Screens (index lazy — 6000+ satir, ayri chunk)
import ProfileScreen from './screens/routes/profile';
import ChatbotScreen from './screens/routes/chatbot';
import PricingScreen from './screens/routes/pricing';
import ReportMobilViewverScreen from './screens/routes/report_mobil_viewver';
import ParcelSplitScreen from './screens/routes/parcel-split';
import TepeCoinEarnScreen from './screens/routes/tepe-coin-earn';
import NotificationsScreen from './screens/routes/notifications';
import SalesReportScreen from './screens/routes/sales-report';
import AiImageAnimationPurchaseScreen from './screens/routes/ai-image-animation-purchase';
import AiImageAnimationEditorScreen from './screens/routes/ai-image-animation-editor';
import AiDroneHubScreen from './screens/routes/ai-drone-hub';
import AiDroneSimpleEditorScreen from './screens/routes/ai-drone-simple-editor';
import AiVideoNewEditorScreen from './screens/routes/ai-video-new-editor';
import AiDroneVideoInfoScreen from './screens/routes/ai-drone-video-info';
import AiDroneJobsScreen from './screens/routes/ai-drone-jobs';
import AiDroneJobDetailScreen from './screens/routes/ai-drone-job-detail';
import AiDroneMyVideosScreen from './screens/routes/ai-drone-my-videos';
import AiDroneEditorChatScreen from './screens/routes/ai-drone-editor-chat';
import RequestCenterScreen from './screens/routes/expert-requests';
import ExpertRequestReportScreen from './screens/routes/expert-request-report';
import ReportExpertRequestScreen from './screens/routes/report-expert-request';
import LoginScreen from './screens/routes/(auth)/login';
import RegisterScreen from './screens/routes/(auth)/register';
import OTPVerifyScreen from './screens/routes/(auth)/otp-verify';
import ForgotPasswordScreen from './screens/routes/(auth)/forgot-password';
import CompleteRegistrationScreen from './screens/routes/complete-registration';
import AdminScreen from './screens/routes/admin';
import AdminUsersScreen from './screens/routes/admin/users';
import AdminUserDetailScreen from './screens/routes/admin/user-detail';
import AdminImageApprovalsScreen from './screens/routes/admin/image-approvals';
import AdminGraduationApprovalsScreen from './screens/routes/admin/graduation-approvals';
import AdminHavaleApprovalsScreen from './screens/routes/admin/havale-approvals';
import AdminHavaleDetailScreen from './screens/routes/admin/havale-detail';
import AdminSalesApprovalsScreen from './screens/routes/admin/sales-approvals';
import AdminAiDroneRequestsScreen from './screens/routes/admin/ai-drone-requests';
import PaymentWebViewScreen from './screens/routes/payment-webview';
import Son30GunScreen from './screens/routes/son-30-gun';
import EmlakVitriniScreen from './screens/routes/emlak-vitrini';
import Son30GunDetayScreen from './screens/routes/son-30-gun-detay';
import PortalV5ReportWebViewScreen from './screens/routes/portal-v5-report-webview';
import PromahalleScreen from './screens/routes/promahalle';
import DosyalarimScreen from './screens/routes/dosyalarim';
import BadgesScreen from './screens/routes/badges';
import VisitorBadgesScreen from './screens/routes/visitor-badges';
import VisitProfileScreen from './screens/routes/visit-profile';
import LegalHubScreen from './screens/routes/legal-hub';
import LegalWebViewScreen from './screens/routes/legal-webview';
import AccountsWebViewScreen from './screens/routes/accounts-webview';
import PortalWebViewScreen from './screens/routes/portal-webview';
import SosyalMedyaSablonuScreen from './screens/routes/sosyal-medya-sablonu';
import IlanlarimScreen from './screens/routes/ilanlarim';
import FavoriIlanlarimScreen from './screens/routes/favori-ilanlarim';
import SorguFavorilerimScreen from './screens/routes/sorgu-favorilerim';
import IlanIslemleriScreen from './screens/routes/ilan-islemleri';
import ListingWizardScreen from './screens/routes/listing-wizard';
import AranacaklarScreen from './screens/routes/aranacaklar';
import AranacaklarPickerScreen from './screens/routes/aranacaklar-picker';
import AranacaklarDetailScreen from './screens/routes/aranacaklar-detail';
import AranacaklarStatsScreen from './screens/routes/aranacaklar-stats';
import ProQueryGlobalModals from './components/app/ProQueryGlobalModals';
import { notifyProQueryJobComplete } from './services/proQueryJobTracker';
import {
  buildProQueryCompletePayload,
  handleSocialNotificationTap,
  normalizeNotificationDataJson,
  openPortalDetailFromProQueryData,
} from './src/utils/notificationNavigation';
import {
  initDroneRunwayJobTracker,
  teardownDroneRunwayJobTracker,
} from './services/droneRunwayJobTracker';
import {
  initDronePortraitExportJobTracker,
  teardownDronePortraitExportJobTracker,
} from './services/dronePortraitExportJobTracker';
import {
  initDroneLandscapeExportJobTracker,
  teardownDroneLandscapeExportJobTracker,
} from './services/droneLandscapeExportJobTracker';
import { registerParcelTerrain3dRoute } from './modules/parcelTerrain3d';
import { registerUnitySmokeTestRoute, UNITY_SMOKE_TEST_ENABLED } from './modules/unitySmokeTest';
import { maybePreloadPhonebookOnFirstLaunch } from './services/phonebookCacheService';

const Stack = createNativeStackNavigator();

/** Ödeme ekranı — expo-document-picker yalnızca ekran açılınca yüklenir. */
function TepeCoinPurchaseScreen(props: Record<string, unknown>) {
  const Screen = require('./screens/routes/tepe-coin-purchase').default;
  return <Screen {...props} />;
}

/** ProjeOlustur — youtube iframe yalnızca ekran açılınca yüklenir. */
function NasilYapilirScreen(props: Record<string, unknown>) {
  const Screen = require('./screens/routes/nasil-yapilir').default;
  return <Screen {...props} />;
}

function IndexScreenLazy(props: Record<string, unknown>) {
  const Screen = require('./screens/routes/index').default;
  return <Screen {...props} />;
}

function AppWithShield({ initialRouteName }: { initialRouteName: 'index' | 'unity-smoke-test' }) {
  const { overlayVisible } = useScreenShield();
  const navigationRef = useNavigationContainerRef();
  const [navReady, setNavReady] = useState(false);
  const getNavigation = useCallback(() => navigationRef.current, [navigationRef]);
  useDeepLinkNavigation(getNavigation, navReady);

  const openHowToLiveScreen = useCallback(
    (opts?: { videoId?: string; title?: string }) => {
      const nav = getNavigation();
      if (!nav) return;
      const videoId = opts?.videoId?.trim();
      if (videoId) {
        void saveHowToLiveSession({
          videoId,
          title: opts?.title?.trim(),
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
      nav.navigate({
        name: 'nasil-yapilir',
        params: {
          tab: 'live',
          ...(videoId ? { videoId } : {}),
          ...(opts?.title?.trim() ? { liveTitle: opts.title.trim() } : {}),
        },
        merge: true,
      } as never);
    },
    [getNavigation],
  );

  const handlePushNotificationData = useCallback(
    (data: PushNotificationData) => {
      if (shouldOpenHowToLiveTab(data)) {
        openHowToLiveScreen({ videoId: data.video_id });
        return;
      }
      const notifType = String(data.type || '').trim();
      if (notifType === 'pro_query_complete') {
        const normalized = normalizeNotificationDataJson(data);
        void openPortalDetailFromProQueryData(
          {
            push: (path, params) => {
              const nav = getNavigation();
              if (!nav) {
                notifyProQueryJobComplete(buildProQueryCompletePayload(normalized));
                return;
              }
              if (typeof nav.push === 'function') {
                nav.push(path as never, params as never);
              } else {
                nav.navigate(path as never, params as never);
              }
            },
          },
          normalized,
        ).then((opened) => {
          if (!opened) {
            notifyProQueryJobComplete(buildProQueryCompletePayload(normalized));
          }
        });
        return;
      }
      if (
        handleSocialNotificationTap(
          {
            push: (path, params) => {
              const nav = getNavigation();
              if (!nav) return;
              if (typeof nav.push === 'function') {
                nav.push(path as never, params as never);
              } else {
                nav.navigate(path as never, params as never);
              }
            },
          },
          notifType,
          data,
        )
      ) {
        return;
      }
    },
    [getNavigation, openHowToLiveScreen],
  );

  useEffect(() => {
    if (!navReady) return;
    void registerPushToken();
    const unsubscribe = addNotificationResponseListener(handlePushNotificationData);
    void getInitialNotificationData().then((data) => {
      if (data) handlePushNotificationData(data);
    });
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void registerPushToken();
    });
    return () => {
      unsubscribe();
      appStateSub.remove();
    };
  }, [navReady, handlePushNotificationData]);

  useEffect(() => {
    initDroneRunwayJobTracker();
    initDronePortraitExportJobTracker();
    initDroneLandscapeExportJobTracker();
    void maybePreloadPhonebookOnFirstLaunch();
    return () => {
      teardownDroneRunwayJobTracker();
      teardownDronePortraitExportJobTracker();
      teardownDroneLandscapeExportJobTracker();
    };
  }, []);

  // Android deferred referral
  useEffect(() => {
    if (Platform.OS !== "android") return;
    let cancelled = false;

    const getParam = (referrer: string, key: string): string | null => {
      if (!referrer) return null;
      const m = referrer.match(new RegExp(`(?:^|&)${key}=([^&]+)`));
      if (!m?.[1]) return null;
      try {
        return decodeURIComponent(m[1]).trim();
      } catch {
        return m[1].trim();
      }
    };

    const base64UrlDecode = (b64url: string): string | null => {
      try {
        const pad = (4 - (b64url.length % 4)) % 4;
        const b64 = (b64url + "=".repeat(pad)).replace(/-/g, "+").replace(/_/g, "/");
        // atob is available in RN JS runtime
        const binary = globalThis.atob ? globalThis.atob(b64) : (Buffer as any).from(b64, "base64").toString("binary");
        // decode binary to utf-8
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const text = new TextDecoder("utf-8").decode(bytes);
        return text;
      } catch {
        return null;
      }
    };

    (async () => {
      try {
        const mod = (NativeModules as any)?.InstallReferrerModule;
        if (!mod?.getInstallReferrer) return;
        const referrer: string = await mod.getInstallReferrer();
        const code = getParam(referrer, "referral_code");
        const dl_b64 = getParam(referrer, "dl_b64");
        if (!cancelled) {
          if (code) await storageService.setDeferredReferralCode(code);
          if (dl_b64) {
            const decoded = base64UrlDecode(dl_b64);
            if (decoded) await storageService.setDeferredOpenDeepLink(decoded);
          }
        }
      } catch {
        // best-effort
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // iOS: StoreKit bağlantısı ve bekleyen işlemler (Android etkilenmez)
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let cancelled = false;
    (async () => {
      try {
        const { initializeIAP } = await import("./services/iapService");
        if (!cancelled) await initializeIAP();
      } catch (e) {
        console.warn("[App] IAP init skipped", e);
      }
    })();
    return () => {
      cancelled = true;
      import("./services/iapService")
        .then(({ teardownIAP }) => teardownIAP())
        .catch(() => {});
    };
  }, []);

  return (
    <React.Fragment>
      <NavigationContainer
        ref={navigationRef}
        theme={DarkTheme}
        onReady={() => {
          if (__DEV__) console.log(`[ProParcel][${Platform.OS}] NavigationContainer ready`);
          setNavReady(true);
        }}
      >
        <Stack.Navigator
          initialRouteName={initialRouteName}
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            freezeOnBlur: Platform.OS === 'ios' && __DEV__ ? false : true,
            contentStyle: { flex: 1, backgroundColor: '#1e293b' },
          }}
        >
          <Stack.Screen name="index" component={IndexScreenLazy} />
          <Stack.Screen name="profile" component={ProfileScreen} />
          <Stack.Screen name="badges" component={BadgesScreen} />
          <Stack.Screen name="visitor-badges" component={VisitorBadgesScreen} />
          <Stack.Screen name="visit-profile" component={VisitProfileScreen} />
          <Stack.Screen name="chatbot" component={ChatbotScreen} />
          <Stack.Screen name="pricing" component={PricingScreen} />
          <Stack.Screen name="tepe-coin-earn" component={TepeCoinEarnScreen} />
          <Stack.Screen name="notifications" component={NotificationsScreen} />
          <Stack.Screen name="expert-requests" component={RequestCenterScreen} />
          <Stack.Screen name="expert-request-report" component={ExpertRequestReportScreen} />
          <Stack.Screen name="sales-report" component={SalesReportScreen} />
          <Stack.Screen name="ai-image-animation-purchase" component={AiImageAnimationPurchaseScreen} />
          <Stack.Screen name="ai-image-animation-editor" component={AiImageAnimationEditorScreen} />
          <Stack.Screen name="ai-drone-hub" component={AiDroneHubScreen} />
          <Stack.Screen name="ai-drone-simple-editor" component={AiDroneSimpleEditorScreen} />
          <Stack.Screen name="ai-video-new-editor" component={AiVideoNewEditorScreen} />
          <Stack.Screen name="ai-drone-video-info" component={AiDroneVideoInfoScreen} />
          <Stack.Screen name="ai-drone-jobs" component={AiDroneJobsScreen} />
          <Stack.Screen name="ai-drone-job-detail" component={AiDroneJobDetailScreen} />
          <Stack.Screen name="ai-drone-my-videos" component={AiDroneMyVideosScreen} />
          <Stack.Screen name="ai-drone-editor-chat" component={AiDroneEditorChatScreen} />
          <Stack.Screen name="report_mobil_viewver" component={ReportMobilViewverScreen} />
          <Stack.Screen name="report-expert-request" component={ReportExpertRequestScreen} />
          <Stack.Screen name="parcel-split" component={ParcelSplitScreen} />
          <Stack.Screen name="complete-registration" component={CompleteRegistrationScreen} />
          <Stack.Screen name="admin" component={AdminScreen} />
          <Stack.Screen name="admin-users" component={AdminUsersScreen} />
          <Stack.Screen name="admin-user-detail" component={AdminUserDetailScreen} />
          <Stack.Screen name="admin-image-approvals" component={AdminImageApprovalsScreen} />
          <Stack.Screen name="admin-graduation-approvals" component={AdminGraduationApprovalsScreen} />
          <Stack.Screen name="admin-havale-approvals" component={AdminHavaleApprovalsScreen} />
          <Stack.Screen name="admin-havale-detail" component={AdminHavaleDetailScreen} />
          <Stack.Screen name="admin-sales-approvals" component={AdminSalesApprovalsScreen} />
          <Stack.Screen name="admin-ai-drone-requests" component={AdminAiDroneRequestsScreen} />
          <Stack.Screen name="tepe-coin-purchase" component={TepeCoinPurchaseScreen} />
          <Stack.Screen name="payment-webview" component={PaymentWebViewScreen} />
          <Stack.Screen name="emlak-vitrini" component={EmlakVitriniScreen} />
          <Stack.Screen name="emlak-vitrini-liste" component={Son30GunScreen} />
          <Stack.Screen name="son-30-gun" component={Son30GunScreen} />
          <Stack.Screen name="dosyalarim" component={DosyalarimScreen} />
          <Stack.Screen name="son-30-gun-detay" component={Son30GunDetayScreen} />
          <Stack.Screen name="portal-v5-report-webview" component={PortalV5ReportWebViewScreen} />
          <Stack.Screen name="promahalle" component={PromahalleScreen} />
          <Stack.Screen name="login" component={LoginScreen} />
          <Stack.Screen name="register" component={RegisterScreen} />
          <Stack.Screen name="otp-verify" component={OTPVerifyScreen} />
          <Stack.Screen name="forgot-password" component={ForgotPasswordScreen} />
          <Stack.Screen name="legal-hub" component={LegalHubScreen} />
          <Stack.Screen name="nasil-yapilir" component={NasilYapilirScreen} />
          <Stack.Screen name="legal-webview" component={LegalWebViewScreen} />
          <Stack.Screen name="accounts-webview" component={AccountsWebViewScreen} />
          <Stack.Screen name="portal-webview" component={PortalWebViewScreen} />
          <Stack.Screen name="sosyal-medya-sablonu" component={SosyalMedyaSablonuScreen} />
          <Stack.Screen name="ilanlarim" component={IlanlarimScreen} />
          <Stack.Screen name="favori-ilanlarim" component={FavoriIlanlarimScreen} />
          <Stack.Screen name="sorgu-favorilerim" component={SorguFavorilerimScreen} />
          <Stack.Screen name="ilan-islemleri" component={IlanIslemleriScreen} />
          <Stack.Screen name="listing-wizard" component={ListingWizardScreen} />
          <Stack.Screen name="aranacaklar" component={AranacaklarScreen} />
          <Stack.Screen name="aranacaklar-picker" component={AranacaklarPickerScreen} />
          <Stack.Screen name="aranacaklar-detail" component={AranacaklarDetailScreen} />
          <Stack.Screen name="aranacaklar-stats" component={AranacaklarStatsScreen} />
          {registerParcelTerrain3dRoute(Stack)}
          {registerUnitySmokeTestRoute(Stack)}
        </Stack.Navigator>
      </NavigationContainer>
      <ProQueryGlobalModals navigationRef={navigationRef} navReady={navReady} />
      <IncomingShareImageListener
        navReady={navReady}
        getNavigation={getNavigation}
        onNavigatePricing={() => getNavigation()?.navigate('pricing')}
      />
      <ScreenShieldOverlay visible={overlayVisible} />
    </React.Fragment>
  );
}

export default function App() {
  // Dev: guncelleme kontrolu UI'yi bloklamasin (Fast Refresh iptalinde navReady takilmasin).
  const [navReady, setNavReady] = useState(__DEV__);
  const [initialRoute, setInitialRoute] = useState<'index' | 'unity-smoke-test'>(
    __DEV__ ? (UNITY_SMOKE_TEST_ENABLED ? 'unity-smoke-test' : 'index') : 'index',
  );
  const [updateCheck, setUpdateCheck] = useState<AppUpdateCheckResult>({ kind: 'none' });
  const [optionalDismissed, setOptionalDismissed] = useState(false);

  useEffect(() => {
    if (__DEV__) {
      console.log(`[ProParcel][${Platform.OS}] App mounted navReady=${navReady}`);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const updateResult = await checkAppUpdate();
        if (cancelled) return;
        if (updateResult.kind === 'force') {
          setUpdateCheck(updateResult);
          setNavReady(true);
          return;
        }
        if (updateResult.kind === 'optional') {
          setUpdateCheck(updateResult);
        }
      } catch {
        // keep default initialRoute (index)
      } finally {
        if (!cancelled) setNavReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOptionalLater = useCallback(() => {
    if (updateCheck.kind === 'optional') {
      setDismissedOptionalUpdateVersion(updateCheck.latestVersion).catch(() => {});
    }
    setOptionalDismissed(true);
  }, [updateCheck]);

  if (!navReady) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AppChromeScaffold>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0b1220' }}>
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            </AppChromeScaffold>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  if (updateCheck.kind === 'force') {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AppChromeScaffold>
              <ForceUpdateScreen message={updateCheck.message} />
            </AppChromeScaffold>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  const showOptionalUpdate =
    updateCheck.kind === 'optional' && !optionalDismissed;

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BadgeCelebrationProvider>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#1e293b' }}>
            <SafeAreaProvider>
              <AppChromeScaffold>
                <BottomSheetModalProvider>
                  <View style={{ flex: 1, backgroundColor: '#1e293b' }}>
                    <ShareIntentProvider>
                      <ScreenShieldProvider>
                        <AppWithShield initialRouteName={initialRoute} />
                      </ScreenShieldProvider>
                    </ShareIntentProvider>
                  </View>
                </BottomSheetModalProvider>
                <OptionalUpdateModal
                  visible={showOptionalUpdate}
                  message={updateCheck.kind === 'optional' ? updateCheck.message : ''}
                  onLater={handleOptionalLater}
                />
              </AppChromeScaffold>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </BadgeCelebrationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
