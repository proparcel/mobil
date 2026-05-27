import React from 'react';
import { PortalWebViewContent } from './portal-webview';
import { useLocalSearchParams } from '../../src/hooks/useNavigation';
import { legalDocumentPath } from '../../config/legalDocuments';

export default function LegalWebViewScreen() {
  const params = useLocalSearchParams<{ slug?: string; title?: string; path?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug.trim() : '';
  const path =
    typeof params.path === 'string' && params.path.trim().length > 0
      ? params.path
      : slug
        ? legalDocumentPath(slug)
        : '/hukuki/kullanim-sartlari/';
  const title = typeof params.title === 'string' && params.title.trim().length > 0 ? params.title : 'Hukuki Metin';

  return <PortalWebViewContent path={path} title={title} />;
}
