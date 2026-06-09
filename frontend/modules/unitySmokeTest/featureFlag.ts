/** Unity embed smoke test — yalnizca EXPO_PUBLIC_UNITY_SMOKE_TEST=1 ile acilir */
export const UNITY_SMOKE_TEST_ENABLED =
  process.env.EXPO_PUBLIC_UNITY_SMOKE_TEST === '1' ||
  process.env.EXPO_PUBLIC_UNITY_SMOKE_TEST === 'true';