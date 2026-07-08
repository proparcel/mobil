import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, UIManager, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import RNFS from "react-native-fs";
import {
  resolveSceneReferenceThumbUrl,
  segmentFileUrl,
  segmentVideoAbsoluteUrl,
} from "../../services/droneSceneService";
import { getApiAuthHeaders } from "../../services/apiClient";

let Video: any = null;
try {
  const v = require("react-native-video");
  Video = v?.default || v;
} catch {
  Video = null;
}

const hasNativeVideoView =
  !!(UIManager as any)?.getViewManagerConfig?.("RCTVideo") ||
  !!(UIManager as any)?.getViewManagerConfig?.("RCTVideoView");

type Props = {
  jobId: string;
  slot: number;
  segmentUrl?: string;
  refUrl?: string;
  preflightUrl?: string;
  authHeader?: Record<string, string>;
  cacheBust?: number;
};

async function downloadReferenceThumb(
  remoteUrl: string,
  cachePath: string,
): Promise<string | null> {
  const headers = await getApiAuthHeaders();
  if (!headers.Authorization) return null;

  try {
    const cached = await FileSystem.getInfoAsync(cachePath);
    if (cached.exists && typeof cached.size === "number" && cached.size > 64) {
      return cachePath;
    }
  } catch {
    /* cache miss */
  }

  try {
    const downloaded = await FileSystem.downloadAsync(remoteUrl, cachePath, { headers });
    if (downloaded.status >= 200 && downloaded.status < 300 && downloaded.uri) {
      return downloaded.uri;
    }
  } catch {
    /* fall through */
  }

  try {
    const dl = await RNFS.downloadFile({ fromUrl: remoteUrl, toFile: cachePath, headers }).promise;
    if (dl.statusCode >= 200 && dl.statusCode < 300) {
      return cachePath;
    }
  } catch {
    return null;
  }

  return null;
}

export function DroneSceneThumbnail({
  jobId,
  slot,
  segmentUrl,
  refUrl,
  preflightUrl,
  authHeader,
  cacheBust = 0,
}: Props) {
  const [refImageUri, setRefImageUri] = useState<string | null>(null);
  const [loadingRef, setLoadingRef] = useState(false);
  const [segmentVideoFailed, setSegmentVideoFailed] = useState(false);

  const segmentVideoSource = useMemo(() => {
    const trimmedJobId = String(jobId || "").trim();
    const fromApi = segmentVideoAbsoluteUrl(String(segmentUrl || "").trim());
    const abs =
      fromApi ||
      (trimmedJobId && slot > 0
        ? segmentFileUrl(trimmedJobId, slot, cacheBust > 0 ? cacheBust : undefined)
        : "");
    if (!abs || segmentVideoFailed) return null;
    if (authHeader?.Authorization) {
      return { uri: abs, headers: authHeader };
    }
    return { uri: abs };
  }, [jobId, slot, segmentUrl, authHeader, segmentVideoFailed, cacheBust]);

  const preferSegmentVideo = Boolean(segmentVideoSource && Video && hasNativeVideoView);

  useEffect(() => {
    setSegmentVideoFailed(false);
  }, [segmentUrl, jobId, slot, cacheBust]);

  useEffect(() => {
    if (preferSegmentVideo) {
      setRefImageUri(null);
      setLoadingRef(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const trimmedJobId = String(jobId || "").trim();
      if (!trimmedJobId || slot < 1) {
        setRefImageUri(null);
        setLoadingRef(false);
        return;
      }

      setLoadingRef(true);
      const remoteUrl = resolveSceneReferenceThumbUrl(
        trimmedJobId,
        slot,
        { ref_url: refUrl, preflight_url: preflightUrl },
        cacheBust > 0 ? cacheBust : undefined,
      );
      const cachePath = `${FileSystem.cacheDirectory}drone-scene-${trimmedJobId}-${slot}.jpg`;
      const localUri = await downloadReferenceThumb(remoteUrl, cachePath);
      if (!cancelled) {
        setRefImageUri(localUri);
        setLoadingRef(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, slot, refUrl, preflightUrl, cacheBust, preferSegmentVideo]);

  if (preferSegmentVideo) {
    return (
      <Video
        source={segmentVideoSource}
        style={styles.thumb}
        resizeMode="cover"
        paused
        muted
        repeat={false}
        controls={false}
        playInBackground={false}
        playWhenInactive={false}
        pointerEvents="none"
        onError={() => setSegmentVideoFailed(true)}
      />
    );
  }

  if (refImageUri) {
    return (
      <Image
        source={{ uri: refImageUri }}
        style={styles.thumb}
        resizeMode="cover"
        pointerEvents="none"
      />
    );
  }

  return (
    <View style={styles.thumbEmpty} pointerEvents="none">
      {loadingRef ? (
        <ActivityIndicator color="#94a3b8" size="small" />
      ) : (
        <Ionicons name="videocam-outline" size={18} color="#94a3b8" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: "100%", height: "100%" },
  thumbEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
});
