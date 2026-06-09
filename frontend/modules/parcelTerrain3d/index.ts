export { PARCEL_TERRAIN_3D_ENABLED } from './featureFlag';
export { registerParcelTerrain3dRoute } from './integration/registerParcelTerrain3dRoute';
export { useOpenParcelTerrain3d } from './hooks/useOpenParcelTerrain3d';
export { logTerrain3dDev } from './utils/terrain3dDevLog';
export { buildMockParcelTerrain3d, isTerrain3dMockMode } from './utils/mockParcelTerrain3d';
export {
  beginTerrainAttempt,
  finishTerrainAttempt,
  logTerrainAttempt,
  readTerrainAttemptLog,
  getTerrainWorkspaceLogPath,
} from './logging/terrainAttemptLog';
