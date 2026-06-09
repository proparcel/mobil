import React from 'react';

type StackScreenRegistrar = {
  Screen: React.ComponentType<{
    name: string;
    component: React.ComponentType<unknown>;
    options?: object;
  }>;
};

/** RN embed ekrani kaldirildi — TerrainUnityActivity (NativeModule) kullanilir. */
export function registerParcelTerrain3dRoute(_Stack: StackScreenRegistrar): React.ReactElement | null {
  return null;
}
