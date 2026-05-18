/**
 * ProParcel App Entry Point
 * 
 * React Navigation ile routing yapısı
 */

import React, { useEffect, useState } from 'react';
import { NativeModules, Platform, View, ActivityIndicator } from "react-native";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './components/app/ErrorBoundary';
import { AuthProvider } from './screens/contexts/AuthContext';
import { BadgeCelebrationProvider } from './screens/contexts/BadgeCelebrationContext';
import { ScreenShieldProvider, useScreenShield } from './screens/contexts/ScreenShieldContext';
import { ScreenShieldOverlay } from './components/app/screenShield/ScreenShieldOverlay';
import { storageService } from "./services/storageService";

// Screens
import IndexScreen from './screens/routes/index';
import ProfileScreen from './screens/routes/profile';
import ChatbotScreen from './screens/routes/chatbot';
import PricingScreen from './screens/routes/pricing';
import ReportMobilViewverScreen from './screens/routes/report_mobil_viewver';
import ParcelSplitScreen from './screens/routes/parcel-split';
import TepeCoinEarnScreen from './screens/routes/tepe-coin-earn';
import NotificationsScreen from './screens/routes/notifications';
import SalesReportScreen from './screens/routes/sales-report';
import AiVideoStudioScreen from './screens/routes/ai-video-studio';
import RequestCenterScreen from './screens/routes/request-center';
import ExpertRequestReportScreen from './screens/routes/expert-request-report';
import ReportExpertRequestScreen from './screens/routes/report-expert-request';
import LoginScreen from './screens/routes/(auth)/login';
import RegisterScreen from './screens/routes/(auth)/register';
import OTPVerifyScreen from './screens/routes/(auth)/otp-verify';
import ForgotPasswordScreen from './screens/routes/(auth)/forgot-password';
import CompleteRegistrationScreen from './screens/routes/complete-registration';
import AdminScreen from './screens/routes/admin';
import TepeCoinPurchaseScreen from './screens/routes/tepe-coin-purchase';
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
import LandingScreen from './screens/routes/landing';
import AranacaklarScreen from './screens/routes/aranacaklar';
import AranacaklarPickerScreen from './screens/routes/aranacaklar-picker';
import AranacaklarDetailScreen from './screens/routes/aranacaklar-detail';
import AranacaklarStatsScreen from './screens/routes/aranacaklar-stats';

const Stack = createNativeStackNavigator();

function AppWithShield({ initialRouteName }: { initialRouteName: 'landing' | 'index' }) {
  const { overlayVisible } = useScreenShield();

  // Android deferred referral (Branch'siz): Google Play Install Referrer
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

  return (
    <React.Fragment>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRouteName}
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="landing" component={LandingScreen} />
          <Stack.Screen name="index" component={IndexScreen} />
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
          <Stack.Screen name="ai-video-studio" component={AiVideoStudioScreen} />
          <Stack.Screen name="report_mobil_viewver" component={ReportMobilViewverScreen} />
          <Stack.Screen name="report-expert-request" component={ReportExpertRequestScreen} />
          <Stack.Screen name="parcel-split" component={ParcelSplitScreen} />
          <Stack.Screen name="complete-registration" component={CompleteRegistrationScreen} />
          <Stack.Screen name="admin" component={AdminScreen} />
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
          <Stack.Screen name="legal-webview" component={LegalWebViewScreen} />
          <Stack.Screen name="accounts-webview" component={AccountsWebViewScreen} />
          <Stack.Screen name="portal-webview" component={PortalWebViewScreen} />
          <Stack.Screen name="sosyal-medya-sablonu" component={SosyalMedyaSablonuScreen} />
          <Stack.Screen name="ilanlarim" component={IlanlarimScreen} />
          <Stack.Screen name="favori-ilanlarim" component={FavoriIlanlarimScreen} />
          <Stack.Screen name="sorgu-favorilerim" component={SorguFavorilerimScreen} />
          <Stack.Screen name="ilan-islemleri" component={IlanIslemleriScreen} />
          <Stack.Screen name="aranacaklar" component={AranacaklarScreen} />
          <Stack.Screen name="aranacaklar-picker" component={AranacaklarPickerScreen} />
          <Stack.Screen name="aranacaklar-detail" component={AranacaklarDetailScreen} />
          <Stack.Screen name="aranacaklar-stats" component={AranacaklarStatsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <ScreenShieldOverlay visible={overlayVisible} />
    </React.Fragment>
  );
}

export default function App() {
  const [navReady, setNavReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<'landing' | 'index'>('index');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const skip = await storageService.getSkipLandingIntro();
        if (!cancelled) setInitialRoute(skip ? 'index' : 'landing');
      } catch {
        if (!cancelled) setInitialRoute('index');
      } finally {
        if (!cancelled) setNavReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!navReady) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0b1220' }}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BadgeCelebrationProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
              <BottomSheetModalProvider>
                <ScreenShieldProvider>
                  <AppWithShield initialRouteName={initialRoute} />
                </ScreenShieldProvider>
              </BottomSheetModalProvider>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </BadgeCelebrationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
