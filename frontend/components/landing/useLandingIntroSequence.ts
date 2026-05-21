import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LANDING_INTRO_CONTENT_EXIT_MS,
  LANDING_INTRO_ENTER_MS,
  LANDING_INTRO_HOLD_AFTER_MS,
  LANDING_INTRO_LINE_COUNT,
  LANDING_INTRO_PAGE_REVEAL_MS,
  LANDING_INTRO_STAGGER_MS,
  LANDING_HERO_BG_URI,
} from './landingTheme';

export type LandingIntroPhase = 'cinematic' | 'reveal' | 'done';

export function useLandingIntroSequence(skipOnMount: boolean) {
  const [introPhase, setIntroPhase] = useState<LandingIntroPhase>(() =>
    skipOnMount ? 'done' : 'cinematic',
  );
  const [visibleStep, setVisibleStep] = useState(0);
  const [contentExiting, setContentExiting] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  const skipIntro = useCallback(() => {
    clearTimers();
    setIntroPhase('done');
    setVisibleStep(0);
    setContentExiting(false);
  }, [clearTimers]);

  useEffect(() => {
    if (skipOnMount || introPhase === 'done') return undefined;

    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timersRef.current.push(id);
    };

    for (let i = 0; i < LANDING_INTRO_LINE_COUNT; i += 1) {
      schedule(() => setVisibleStep(i + 1), i * LANDING_INTRO_STAGGER_MS);
    }

    const afterAllVisible =
      (LANDING_INTRO_LINE_COUNT - 1) * LANDING_INTRO_STAGGER_MS +
      LANDING_INTRO_ENTER_MS +
      LANDING_INTRO_HOLD_AFTER_MS;

    schedule(() => setContentExiting(true), afterAllVisible);
    const revealAt = afterAllVisible + LANDING_INTRO_CONTENT_EXIT_MS;
    schedule(() => setIntroPhase('reveal'), revealAt);
    schedule(() => setIntroPhase('done'), revealAt + LANDING_INTRO_PAGE_REVEAL_MS);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ilk mount
  }, [skipOnMount]);

  useEffect(() => {
    if (skipOnMount) return;
    const { Image } = require('react-native');
    Image.prefetch(LANDING_HERO_BG_URI).catch(() => {});
  }, [skipOnMount]);

  return {
    introPhase,
    visibleStep,
    contentExiting,
    skipIntro,
    introDone: introPhase === 'done',
    overlayExiting: introPhase === 'reveal',
  };
}
