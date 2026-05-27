import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LandingBottomNav, type LandingNavTab } from './LandingBottomNav';
import { LandingHeroBackground } from './LandingHeroBackground';
import { LandingHomePanel } from './LandingHomePanel';
import { LandingLegalFooter } from './LandingLegalFooter';
import type { LandingCapabilityId } from './landingCapabilities';
import type { GiftRewardItem } from '../../services/creditService';
import { TepeCreditEarnPanel } from './TepeCreditEarnPanel';
import { TepeCreditUsagePanel } from './TepeCreditUsagePanel';
import { LANDING_LEGAL_DOCK_HEIGHT } from './landingTheme';

const PAGE_COUNT = 3;

type Props = {
  reveal: boolean;
  onMenuPress: () => void;
  onNotificationsPress: () => void;
  onSignUp: () => void;
  onPartnerDetails: () => void;
  onFeaturePress: (id: LandingCapabilityId) => void;
  onGoToMap: () => void;
  onBuyCredit: () => void;
  onSeeAllMissions: () => void;
  onTepeHelp: () => void;
  onEarnItemPress: (item: GiftRewardItem) => void;
};

export function LandingPager({
  reveal,
  onMenuPress,
  onNotificationsPress,
  onSignUp,
  onPartnerDetails,
  onFeaturePress,
  onGoToMap,
  onBuyCredit,
  onSeeAllMissions,
  onTepeHelp,
  onEarnItemPress,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const { width } = Dimensions.get('window');
  const insets = useSafeAreaInsets();
  const legalDockBottom = 78 + Math.max(insets.bottom, 12);
  const dotsBottom = legalDockBottom + LANDING_LEGAL_DOCK_HEIGHT + 8;

  const goToPage = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(PAGE_COUNT - 1, index));
      scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
      setPageIndex(clamped);
    },
    [width],
  );

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / width);
      if (idx !== pageIndex) setPageIndex(idx);
    },
    [width, pageIndex],
  );

  const handleNavTab = useCallback(
    (tab: LandingNavTab) => {
      if (tab === 'home') {
        goToPage(0);
        return;
      }
      if (tab === 'earn') {
        goToPage(1);
        return;
      }
      if (tab === 'usage') {
        goToPage(2);
        return;
      }
      if (tab === 'map') {
        onGoToMap();
      }
    },
    [goToPage, onGoToMap],
  );

  const bottomActive: LandingNavTab =
    pageIndex === 1 ? 'earn' : pageIndex === 2 ? 'usage' : 'home';

  return (
    <LandingHeroBackground dimmed={!reveal}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        <View style={[styles.page, { width }]}>
          <LandingHomePanel
            reveal={reveal}
            onMenuPress={onMenuPress}
            onNotificationsPress={onNotificationsPress}
            onSignUp={onSignUp}
            onPartnerDetails={onPartnerDetails}
            onFeaturePress={onFeaturePress}
          />
        </View>
        <View style={[styles.page, { width }]}>
          <TepeCreditEarnPanel
            reveal={reveal}
            onBack={() => goToPage(0)}
            onHelp={onTepeHelp}
            onBuyCredit={onBuyCredit}
            onSeeAllMissions={onSeeAllMissions}
            onEarnItemPress={onEarnItemPress}
          />
        </View>
        <View style={[styles.page, { width }]}>
          <TepeCreditUsagePanel
            reveal={reveal}
            onBack={() => goToPage(1)}
            onHelp={onTepeHelp}
            onBuyPackages={onBuyCredit}
          />
        </View>
      </ScrollView>

      {reveal ? (
        <>
          <View style={[styles.legalDock, { bottom: legalDockBottom }]} pointerEvents="box-none">
            <LandingLegalFooter variant="dock" tone="dark" />
          </View>
          <View style={[styles.dots, { bottom: dotsBottom }]} pointerEvents="none">
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, pageIndex === i && styles.dotActive]} />
            ))}
          </View>
          <LandingBottomNav active={bottomActive} onTabPress={handleNavTab} />
        </>
      ) : null}
    </LandingHeroBackground>
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  legalDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    width: 20,
    backgroundColor: '#36AAFF',
  },
});
