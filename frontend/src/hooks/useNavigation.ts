/**
 * Navigation helper hook
 * 
 * React Navigation için compatibility layer - React Navigation API wrapper
 */

import { useNavigation as useRNNavigation, useRoute as useRNRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const useRoute = useRNRoute;

export type RootStackParamList = {
  /** Web ana sayfa (landing) ile uyumlu tanıtım ekranı */
  landing: undefined;
  index:
    | {
        proQueryMahalle?: number;
        proQueryAda?: string;
        proQueryParsel?: string;
        launch?: 'my-queries' | 'parcel-split' | '3d-designs';
      }
    | undefined;
  profile: undefined;
  badges: undefined;
  /** Başka kullanıcı rozet özeti (native) */
  "visitor-badges": { userId: string; displayName?: string };
  /** Web `VisitProfilePage` ile uyumlu ziyaretçi profil (herkese açık alanlar) */
  "visit-profile": { userId: string; displayName?: string };
  chatbot: undefined;
  pricing: undefined;
  "complete-registration": undefined;
  "tepe-coin-earn": undefined;
  "tepe-coin-purchase": { package_id?: string; package_name?: string; package_price?: string; package_credits?: string } | undefined;
  "payment-webview": { checkout_form_html: string; purchase_id: string; coin_amount?: string; payable_amount?: string };
  notifications: undefined;
  "expert-requests": { mode?: "mine" | "incoming" } | undefined;
  "sales-report": undefined;
  "ai-video-studio": undefined;
  report_mobil_viewver: { reportId?: string; [key: string]: any };
  "report-expert-request": {
    il?: string;
    ilce?: string;
    mahalle?: string;
    ada?: string;
    parsel?: string;
    tkgm_value?: string;
    proparcel_value?: string;
    cacheId?: string;
    /** Menüden: map | spk | expert */
    menuFocus?: string;
    /** LİHKAB alt öğesi — harita talebi requestTypeCode için */
    mapOperationLabel?: string;
  };
  "expert-request-report": { expertRequestId: string; mode: 'mine' | 'incoming'; savedQueryId?: string };
  "parcel-split": { parentPolygon?: object; roadLines?: object[]; parcelId?: string; [key: string]: any };
  "emlak-vitrini": undefined;
  "emlak-vitrini-liste": {
    categoryMain?: string;
    category_main?: string;
    categoryLeafId?: string;
    category_leaf_id?: string;
    categoryLabel?: string;
    listingType?: 'sale' | 'rent';
    listing_type?: 'sale' | 'rent';
    cityId?: string;
    city_id?: string;
    cityName?: string;
    city_name?: string;
  };
  "son-30-gun": undefined;
  dosyalarim: undefined;
  "son-30-gun-detay": { snapshotId: string; commentId?: string; ratingId?: string; listingId?: string };
  "portal-v5-report-webview": { snapshotId: string; sharePdf?: string };
  /** ProMahalle — native; isteğe bağlı konum; boş = genel akış */
  promahalle: {
    city_id?: string;
    town_id?: string;
    quarter_id?: string;
    proparcel_value?: string;
    tkgm_value?: string;
    title?: string;
  };
  login: undefined;
  /** Landing: Kurumsal veya Danışman sekmesi + tür ön seçimi */
  register: {
    presetCorporate?: 'emlak' | 'lihkab' | 'spk';
    presetConsultant?: 'emlak' | 'spk' | 'lihkab';
  } | undefined;
  "otp-verify": { phone?: string; mode?: string; [key: string]: any };
  "forgot-password": undefined;
  "legal-hub": undefined;
  "legal-webview": { slug: string; title?: string };
  "accounts-webview": { path: string; title?: string };
  "portal-webview": { path: string; title?: string };
  /** Sosyal medya şablonu — mobil native; listingId veya snapshotId ile */
  "sosyal-medya-sablonu": { listingId?: string; snapshotId?: string; source?: string } | undefined;
  ilanlarim: undefined;
  /** İlan favorileri — mobil listeleme (web URL yok) */
  "favori-ilanlarim": undefined;
  /** Pro sorgu favorileri — GET /api/portal/recent-queries/favorites/ */
  "sorgu-favorilerim": undefined;
  "ilan-islemleri": undefined;
  aranacaklar: undefined;
  "aranacaklar-picker": undefined;
  "aranacaklar-detail": { contactId: string };
  "aranacaklar-stats": undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * useRouter hook - React Navigation için router API wrapper
 */
export function useRouter() {
  const navigation = useRNNavigation<NavigationProp>();
  const route = useRNRoute();

  return {
    push: (path: string | { pathname: string; params?: any }, params?: any) => {
      if (typeof path === 'string') {
        // Convert path to React Navigation route name
        const routeName = path.replace(/^\//, '').replace(/^routes\//, '').replace(/^\(auth\)\//, '');
        if (params) {
          navigation.navigate(routeName as any, params);
        } else {
          navigation.navigate(routeName as any);
        }
      } else {
        navigation.navigate(path.pathname.replace(/^\//, '').replace(/^routes\//, '').replace(/^\(auth\)\//, '') as any, path.params);
      }
    },
    replace: (path: string | { pathname: string; params?: any }, params?: any) => {
      if (typeof path === 'string') {
        const routeName = path.replace(/^\//, '').replace(/^routes\//, '').replace(/^\(auth\)\//, '');
        if (params) {
          navigation.replace(routeName as any, params);
        } else {
          navigation.replace(routeName as any);
        }
      } else {
        navigation.replace(path.pathname.replace(/^\//, '').replace(/^routes\//, '').replace(/^\(auth\)\//, '') as any, path.params);
      }
    },
    back: () => {
      navigation.goBack();
    },
    canGoBack: () => {
      return navigation.canGoBack();
    },
  };
}

/**
 * useLocalSearchParams hook - React Navigation route params için helper hook
 */
export function useLocalSearchParams<T = Record<string, string>>(): T {
  const route = useRNRoute();
  return (route.params as T) || ({} as T);
}
