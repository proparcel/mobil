/**
 * ProParcel mobil landing — yatay pager (Ana + Tepe Kredi).
 */

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from '../../src/hooks/useNavigation';
import type { GiftRewardItem } from '../../services/creditService';
import { storageService } from '../../services/storageService';
import { LandingPager } from '../../components/landing/LandingPager';
import type { LandingCapabilityId } from '../../components/landing/landingCapabilities';
import {
  navigateGiftReward,
  navigateLandingCapability,
} from '../../components/landing/landingNavigation';

export default function LandingScreen() {
  const router = useRouter();

  useEffect(() => {
    storageService.setSkipLandingIntro(true).catch(() => {});
  }, []);

  const goMap = useCallback(() => {
    router.replace('index');
  }, [router]);

  const onFeaturePress = useCallback(
    (id: LandingCapabilityId) => {
      navigateLandingCapability(router, id);
    },
    [router],
  );

  const onEarnItemPress = useCallback(
    (item: GiftRewardItem) => {
      navigateGiftReward(router, item.event_type);
    },
    [router],
  );

  return (
    <View style={styles.root}>
      <LandingPager
        reveal
        onMenuPress={goMap}
        onNotificationsPress={() => router.push('notifications')}
        onPartnerDetails={() => router.push('register')}
        onFeaturePress={onFeaturePress}
        onGoToMap={goMap}
        onBuyCredit={() => router.push('pricing')}
        onSeeAllMissions={() => router.push('tepe-coin-earn')}
        onTepeHelp={() => router.push('tepe-coin-earn')}
        onEarnItemPress={onEarnItemPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#081120',
  },
});
