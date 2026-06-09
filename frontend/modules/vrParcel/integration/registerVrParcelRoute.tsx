import React from "react";
import { VR_PARCEL_ENABLED } from "../featureFlag";
import VrParcelScreen from "../screens/VrParcelScreen";

type StackScreenRegistrar = {
  Screen: React.ComponentType<{
    name: string;
    component: React.ComponentType<unknown>;
    options?: object;
  }>;
};

/**
 * App.tsx içinde tek satır: registerVrParcelRoute(Stack)
 */
export function registerVrParcelRoute(Stack: StackScreenRegistrar): React.ReactElement | null {
  if (!VR_PARCEL_ENABLED) return null;
  return (
    <Stack.Screen
      name="vr-parcel"
      component={VrParcelScreen as React.ComponentType<unknown>}
      options={{
        headerShown: false,
        animation: "slide_from_bottom",
        gestureEnabled: false,
      }}
    />
  );
}

export { VrParcelScreen };
