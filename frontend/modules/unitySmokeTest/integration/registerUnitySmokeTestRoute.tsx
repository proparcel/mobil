import React from 'react';
import { UNITY_SMOKE_TEST_ENABLED } from '../featureFlag';
import UnitySmokeTestScreen from '../screens/UnitySmokeTestScreen';

type StackScreenRegistrar = {
  Screen: React.ComponentType<{
    name: string;
    component: React.ComponentType<unknown>;
    options?: object;
  }>;
};

export function registerUnitySmokeTestRoute(Stack: StackScreenRegistrar): React.ReactElement | null {
  if (!UNITY_SMOKE_TEST_ENABLED) return null;
  return (
    <Stack.Screen
      name="unity-smoke-test"
      component={UnitySmokeTestScreen as React.ComponentType<unknown>}
      options={{
        headerShown: false,
        animation: 'fade',
        gestureEnabled: true,
      }}
    />
  );
}

export { UnitySmokeTestScreen };
