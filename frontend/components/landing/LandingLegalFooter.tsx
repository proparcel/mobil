import React, { useCallback } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from '../../src/hooks/useNavigation';
import { LEGAL_DOCUMENTS } from '../../config/legalDocuments';
import { landingColors } from './landingTheme';

type Props = {
  /** scroll: panel içi | dock: landing alt şerit (iOS + Android) */
  variant?: 'scroll' | 'dock';
  /** dark: landing arka planı | light: giriş/kayıt ekranları */
  tone?: 'dark' | 'light';
};

const lightTone = {
  heading: '#94a3b8',
  link: '#64748b',
  sep: '#cbd5e1',
  underline: 'rgba(100, 116, 139, 0.45)',
};

export function LandingLegalFooter({ variant = 'scroll', tone = 'dark' }: Props) {
  const router = useRouter();
  const isLight = tone === 'light';

  const openDocument = useCallback(
    (slug: string, title: string) => {
      router.push('legal-webview', { slug, title });
    },
    [router],
  );

  return (
    <View
      style={[styles.wrap, variant === 'dock' && styles.wrapDock]}
      accessibilityRole="list"
    >
      <Text
        style={[
          styles.heading,
          isLight && { color: lightTone.heading },
          variant === 'dock' && styles.headingDock,
        ]}
      >
        Hukuki metinler
      </Text>
      <View style={styles.linksRow}>
        {LEGAL_DOCUMENTS.map((doc, index) => (
          <React.Fragment key={doc.slug}>
            {index > 0 ? (
              <Text style={[styles.sep, isLight && { color: lightTone.sep }]}>·</Text>
            ) : null}
            <TouchableOpacity
              onPress={() => openDocument(doc.slug, doc.title)}
              accessibilityRole="link"
              accessibilityLabel={doc.title}
              hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
            >
              <Text
                style={[
                  styles.link,
                  isLight && { color: lightTone.link, textDecorationColor: lightTone.underline },
                ]}
              >
                {doc.shortTitle ?? doc.title}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  wrapDock: {
    marginTop: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 16,
  },
  heading: {
    fontSize: 11,
    fontWeight: '600',
    color: landingColors.textSoft,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headingDock: {
    marginBottom: 6,
    textAlign: 'center',
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 6,
  },
  link: {
    fontSize: 11,
    lineHeight: 16,
    color: landingColors.textMuted,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(231, 241, 255, 0.35)',
    ...Platform.select({
      ios: { fontWeight: '400' },
      android: { includeFontPadding: false },
    }),
  },
  sep: {
    fontSize: 11,
    lineHeight: 16,
    color: landingColors.textSoft,
    marginHorizontal: 6,
  },
});
