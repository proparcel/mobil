import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRouter, useLocalSearchParams } from '../../src/hooks/useNavigation';
import { useProfileAwareBack } from '../../src/utils/profileReturnNavigation';
import { portalPageUrl } from '../../config/portalSite';
import { storageService } from '../../services/storageService';

function buildFetchInject(token: string): string {
  const t = JSON.stringify(token);
  return `
(function(){
  try { window.__PP_PLATFORM_MOBILE_APP__ = true; } catch(e) {}
  var TOKEN = ${t};
  if (!TOKEN) return;
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    init = init || {};
    var urlStr = typeof input === 'string' ? input : (input && input.url ? String(input.url) : '');
    var isApi = urlStr.indexOf('/api/') !== -1;
    if (!isApi && urlStr.indexOf('http') === 0) {
      try { isApi = new URL(urlStr).pathname.indexOf('/api/') !== -1; } catch (e) {}
    }
    if (!isApi) return origFetch.call(this, input, init);
    var headers = {};
    if (init.headers) {
      if (typeof Headers !== 'undefined' && init.headers instanceof Headers) {
        init.headers.forEach(function(v, k) { headers[k] = v; });
      } else {
        for (var k in init.headers) { if (Object.prototype.hasOwnProperty.call(init.headers, k)) headers[k] = init.headers[k]; }
      }
    }
    if (!headers.Authorization && !headers.authorization) headers.Authorization = 'Bearer ' + TOKEN;
    init.headers = headers;
    return origFetch.call(this, input, init);
  };
})();
true;
`;
}

export type PortalWebViewProps = {
  path?: string;
  title?: string;
};

export function PortalWebViewContent({ path: pathProp, title: titleProp }: PortalWebViewProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ path?: string; title?: string }>();
  const handleBack = useProfileAwareBack(() => router.back());
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);

  const path = pathProp ?? params.path ?? '/';
  const title = titleProp ?? params.title ?? 'ProParcel';

  const uri = useMemo(() => portalPageUrl(path), [path]);

  useEffect(() => {
    storageService.getAccessToken().then((t) => setToken(t || ''));
  }, []);

  const injectedBefore = useCallback(() => buildFetchInject(token), [token]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} accessibilityLabel="Geri">
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.backBtn} />
      </View>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : null}
      <WebView
        source={{ uri }}
        style={styles.web}
        onLoadEnd={() => setLoading(false)}
        injectedJavaScriptBeforeContentLoaded={injectedBefore()}
        sharedCookiesEnabled
        domStorageEnabled
      />
    </SafeAreaView>
  );
}

export default function PortalWebViewScreen() {
  return <PortalWebViewContent />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  web: { flex: 1, backgroundColor: '#fff' },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
});
