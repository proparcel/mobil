/** Parsel 3D eğim viewer — __DEV__ varsayilan acik; production icin env gerekir */
export const PARCEL_TERRAIN_3D_ENABLED =
  process.env.EXPO_PUBLIC_PARCEL_TERRAIN_3D_ENABLED === '1' ||
  process.env.EXPO_PUBLIC_PARCEL_TERRAIN_3D_ENABLED === 'true' ||
  (process.env.EXPO_PUBLIC_PARCEL_TERRAIN_3D_ENABLED !== '0' &&
    process.env.EXPO_PUBLIC_PARCEL_TERRAIN_3D_ENABLED !== 'false' &&
    __DEV__);