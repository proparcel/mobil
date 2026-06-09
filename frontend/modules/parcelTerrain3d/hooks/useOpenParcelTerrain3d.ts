import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { getPortalTerrain3d } from '../../../services/portalService';
import type { PortalQueryDetail } from '../../../src/types/portal';
import { validateTerrainPayload } from '../utils/validateTerrainPayload';
import { buildMockParcelTerrain3d, isTerrain3dMockMode } from '../utils/mockParcelTerrain3d';
import { beginTerrainAttempt, logTerrainAttempt } from '../logging/terrainAttemptLog';
import {
  logTerrain3dDev,
  TERRAIN3D_BACKFILL_ALERT,
  TERRAIN3D_FETCH_FAIL_ALERT,
  TERRAIN3D_INVALID_PAYLOAD_ALERT,
  TERRAIN3D_UNITY_UNAVAILABLE_ALERT,
} from '../utils/terrain3dDevLog';
import { isTerrainUnityAvailable, openTerrainActivity } from '../native/TerrainUnityModule';
import { PARCEL_TERRAIN_3D_ENABLED } from '../featureFlag';
import { NativeModules } from 'react-native';

function isUnityModuleLinked(): boolean {
  return Boolean(NativeModules.TerrainUnityModule);
}

type RouterLike = {
  push: (name: string) => void;
};

export function useOpenParcelTerrain3d(data: PortalQueryDetail | null, _router: RouterLike) {
  const [loading, setLoading] = useState(false);

  const openTerrain3d = useCallback(async () => {
    if (!data || !PARCEL_TERRAIN_3D_ENABLED) return;
    if (Platform.OS !== 'android') {
      Alert.alert('3D eğim', 'Tam ekran terrain viewer şu an yalnızca Android’de.');
      return;
    }

    const snapshotId = data.snapshot_id;
    const mockMode = isTerrain3dMockMode();
    const titleOpts = { ada: data.ada, parsel: data.parsel };

    logTerrain3dDev('tap', {
      snapshotId,
      available: mockMode ? true : data.terrain3dAvailable === true,
      mock: mockMode,
      dataSource: mockMode ? 'mock_json' : 'api_terrain_3d',
      via: 'TerrainUnityActivity',
    });

    if (mockMode) {
      setLoading(true);
      try {
        const mockPayload = buildMockParcelTerrain3d({
          ada: data.ada,
          parsel: data.parsel,
          areaM2: data.area_m2,
        });
        const terrainJson = JSON.stringify(mockPayload);

        const attemptId = await beginTerrainAttempt({
          snapshotId,
          mock: true,
          embeddedDemo: false,
          ada: data.ada,
          parsel: data.parsel,
        });

        if (!isUnityModuleLinked()) {
          await logTerrainAttempt(attemptId, 'rn', 'error', 'unity.notLinked');
          Alert.alert('3D eğim', TERRAIN3D_UNITY_UNAVAILABLE_ALERT);
          return;
        }

        const exportReady = await isTerrainUnityAvailable();
        await logTerrainAttempt(attemptId, 'rn', 'info', 'unity.exportCheck', { exportReady });
        if (!exportReady) {
          await logTerrainAttempt(attemptId, 'rn', 'error', 'unity.exportNotReady');
          Alert.alert('3D eğim', TERRAIN3D_UNITY_UNAVAILABLE_ALERT);
          return;
        }

        const opened = await openTerrainActivity(attemptId, terrainJson, titleOpts);
        if (!opened) {
          await logTerrainAttempt(attemptId, 'rn', 'error', 'activity.openFailed');
          Alert.alert('3D eğim', 'Terrain Activity acilamadi.');
          return;
        }
        await logTerrainAttempt(attemptId, 'rn', 'info', 'activity.open', {
          route: 'TerrainUnityActivity',
          jsonLen: terrainJson.length,
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    const available = data.terrain3dAvailable === true;
    if (!available) {
      Alert.alert('3D eğim', TERRAIN3D_BACKFILL_ALERT);
      return;
    }

    setLoading(true);
    try {
      const attemptId = await beginTerrainAttempt({
        snapshotId,
        mock: false,
        embeddedDemo: false,
        ada: data.ada,
        parsel: data.parsel,
      });

      const res = await getPortalTerrain3d(snapshotId);
      if (!res.ok || !res.data?.success || !res.data.terrain3d) {
        await logTerrainAttempt(attemptId, 'rn', 'error', 'fetch.fail', {
          status: res.ok ? 200 : res.status ?? 0,
        });
        Alert.alert('3D eğim', res.data?.message || res.error || TERRAIN3D_FETCH_FAIL_ALERT);
        return;
      }

      const validationError = validateTerrainPayload(res.data.terrain3d);
      if (validationError) {
        await logTerrainAttempt(attemptId, 'rn', 'error', 'validate.fail', { validationError });
        Alert.alert('3D eğim', TERRAIN3D_INVALID_PAYLOAD_ALERT);
        return;
      }

      const unityReady = await isTerrainUnityAvailable();
      if (!unityReady) {
        await logTerrainAttempt(attemptId, 'rn', 'error', 'unity.notReady');
        Alert.alert('3D eğim', TERRAIN3D_UNITY_UNAVAILABLE_ALERT);
        return;
      }

      const terrainJson = JSON.stringify(res.data.terrain3d);
      logTerrain3dDev('fetch ok', { snapshotId, attemptId, jsonLen: terrainJson.length });

      const opened = await openTerrainActivity(attemptId, terrainJson, titleOpts);
      if (!opened) {
        await logTerrainAttempt(attemptId, 'rn', 'error', 'activity.openFailed');
        Alert.alert('3D eğim', 'Terrain Activity acilamadi.');
        return;
      }
      await logTerrainAttempt(attemptId, 'rn', 'info', 'activity.open', {
        route: 'TerrainUnityActivity',
        jsonLen: terrainJson.length,
      });
    } finally {
      setLoading(false);
    }
  }, [data]);

  return { openTerrain3d, terrain3dLoading: loading };
}
