import { API_URL } from '../../config/api';

export const LANDING_HERO_BG_URI = `${API_URL.replace(/\/$/, '')}/media/landingpage/sluet3.png`;

export const landingColors = {
  bgDeep: '#081120',
  bgMid: '#0B1730',
  bgPanel: '#0E223F',
  text: '#FFFFFF',
  textMuted: 'rgba(231, 241, 255, 0.72)',
  textSoft: 'rgba(200, 220, 245, 0.55)',
  cyan: '#39DFFF',
  cyanBright: '#59DFFF',
  electricBlue: '#36AAFF',
  teal: '#2ADCBE',
  borderGlass: 'rgba(80, 210, 255, 0.22)',
  borderSoft: 'rgba(255, 255, 255, 0.12)',
  glassBg: 'rgba(8, 26, 55, 0.72)',
  glassBgLight: 'rgba(11, 31, 58, 0.65)',
} as const;

export const landingRadii = {
  card: 28,
  button: 16,
  pill: 999,
  nav: 32,
} as const;

export const LANDING_INTRO_STAGGER_MS = 400;
export const LANDING_INTRO_ENTER_MS = 480;
export const LANDING_INTRO_HOLD_AFTER_MS = 2200;
export const LANDING_INTRO_CONTENT_EXIT_MS = 900;
export const LANDING_INTRO_PAGE_REVEAL_MS = 1100;
export const LANDING_INTRO_LINE_COUNT = 5;

/** Alt nav + hukuki link şeridi için scroll boşluğu (iOS/Android aynı) */
export const LANDING_LEGAL_DOCK_HEIGHT = 52;
export const LANDING_BOTTOM_CHROME = 100 + LANDING_LEGAL_DOCK_HEIGHT;
