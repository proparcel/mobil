/**

 * ProParcel mobil landing — cinematic intro + yatay pager (Ana + Tepe Kredi).

 */



import React, { useCallback, useEffect, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { useLocalSearchParams, useRouter } from '../../src/hooks/useNavigation';

import type { GiftRewardItem } from '../../services/creditService';

import { storageService } from '../../services/storageService';

import { LandingPager } from '../../components/landing/LandingPager';

import { LandingHeroBackground } from '../../components/landing/LandingHeroBackground';

import { LandingIntroCinematic } from '../../components/landing/LandingIntroCinematic';

import type { LandingCapabilityId } from '../../components/landing/landingCapabilities';

import {

  navigateGiftReward,

  navigateLandingCapability,

} from '../../components/landing/landingNavigation';


import { useLandingIntroSequence } from '../../components/landing/useLandingIntroSequence';



type LandingContentProps = {

  skipIntroOnMount: boolean;

};



function LandingScreenContent({ skipIntroOnMount }: LandingContentProps) {

  const router = useRouter();

  const {

    introPhase,

    visibleStep,

    contentExiting,

    skipIntro,

    introDone,

    overlayExiting,

  } = useLandingIntroSequence(skipIntroOnMount);



  const markIntroSeen = useCallback(async () => {

    await storageService.setSkipLandingIntro(true);

  }, []);



  useEffect(() => {

    if (introDone && !skipIntroOnMount) {

      markIntroSeen();

    }

  }, [introDone, skipIntroOnMount, markIntroSeen]);



  const finishIntro = useCallback(() => {

    skipIntro();

    markIntroSeen();

  }, [skipIntro, markIntroSeen]);



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



  const showDashboard = introPhase === 'reveal' || introDone;

  const showIntroOverlay = introPhase === 'cinematic' || introPhase === 'reveal';



  return (

    <View style={styles.root}>

      {showDashboard ? (

        <LandingPager

          reveal={introDone}

          onMenuPress={goMap}

          onNotificationsPress={() => router.push('notifications')}

          onSignUp={() => router.push('register')}

          onPartnerDetails={() => router.push('register')}

          onFeaturePress={onFeaturePress}

          onGoToMap={goMap}

          onBuyCredit={() => router.push('pricing')}

          onSeeAllMissions={() => router.push('tepe-coin-earn')}

          onTepeHelp={() => router.push('tepe-coin-earn')}

          onEarnItemPress={onEarnItemPress}

        />

      ) : (

        <LandingHeroBackground dimmed>

          <View style={styles.boot} />

        </LandingHeroBackground>

      )}



      {showIntroOverlay ? (

        <LandingIntroCinematic

          visibleStep={visibleStep}

          contentExiting={contentExiting}

          overlayExiting={overlayExiting}

          onSkip={finishIntro}

        />

      ) : null}

    </View>

  );

}



export default function LandingScreen() {

  const params = useLocalSearchParams<{ skipIntro?: boolean }>();

  const forceSkipIntro = params.skipIntro === true;

  const [skipIntroOnMount, setSkipIntroOnMount] = useState<boolean | null>(

    forceSkipIntro ? true : null,

  );



  useEffect(() => {

    if (forceSkipIntro) return;

    let cancelled = false;

    (async () => {

      const skip = await storageService.getSkipLandingIntro();

      if (!cancelled) setSkipIntroOnMount(skip);

    })();

    return () => {

      cancelled = true;

    };

  }, [forceSkipIntro]);



  if (skipIntroOnMount === null) {

    return <View style={styles.bootRoot} />;

  }



  return <LandingScreenContent skipIntroOnMount={skipIntroOnMount} />;

}



const styles = StyleSheet.create({

  root: {

    flex: 1,

    backgroundColor: '#081120',

  },

  boot: {

    flex: 1,

  },

  bootRoot: {

    flex: 1,

    backgroundColor: '#081120',

  },

});


