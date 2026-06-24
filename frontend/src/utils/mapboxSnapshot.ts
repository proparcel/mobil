/**
 * Mapbox Snapshot Utilities
 *
 * Mapbox haritasından snapshot alma fonksiyonları ve map idle yönetimi
 */

import React from 'react';
import { Platform } from 'react-native';
import { isCaptureImageUriUsable } from './screenshotManager';

export interface MapReadyState {
  didFinishLoadingMap: boolean;
  didFinishLoadingStyle: boolean;
  isIdle: boolean;
}

/** Platformda en hızlı çalışan snap modu (oturum boyunca hatırlanır) */
let preferredSnapMode: 'sized' | 'boolean' | null = null;

function snapModeOrder(): Array<'sized' | 'boolean'> {
  const fallback: Array<'sized' | 'boolean'> =
    Platform.OS === 'android' ? ['boolean', 'sized'] : ['sized', 'boolean'];
  if (!preferredSnapMode) return fallback;
  const other = preferredSnapMode === 'sized' ? 'boolean' : 'sized';
  return [preferredSnapMode, other];
}

/**
 * Mapbox map idle durumunu bekler
 */
export const waitForMapIdle = async (
  mapReadyRef: React.MutableRefObject<MapReadyState>,
  timeoutMs = 4000,
  options?: { resetIfAlreadyIdle?: boolean },
): Promise<boolean> => {
  const r = mapReadyRef.current;
  const alreadyIdle = r.didFinishLoadingMap && r.didFinishLoadingStyle && r.isIdle;
  if (alreadyIdle && options?.resetIfAlreadyIdle === false) {
    return true;
  }

  const start = Date.now();
  if (options?.resetIfAlreadyIdle !== false) {
    mapReadyRef.current.isIdle = false;
  }
  while (Date.now() - start < timeoutMs) {
    const state = mapReadyRef.current;
    if (state.didFinishLoadingMap && state.didFinishLoadingStyle && state.isIdle) {
      return true;
    }
    await new Promise((res) => setTimeout(res, 40));
  }
  if (__DEV__) console.warn('[mapboxSnapshot] Map idle timeout');
  return false;
};

function normalizeSnapUri(uri: string): string {
  if (uri.startsWith('file://') || uri.startsWith('http')) return uri;
  return uri.startsWith('/') ? `file://${uri}` : `file://${uri}`;
}

function extractSnapUri(res: unknown): string | null {
  if (typeof res === 'string' && res.length > 0) return normalizeSnapUri(res);
  const r = res as { uri?: string; path?: string } | null;
  const raw = r?.uri || r?.path || null;
  return raw ? normalizeSnapUri(raw) : null;
}

async function invokeMapboxSnap(
  fn: (...args: unknown[]) => Promise<unknown>,
  map: unknown,
  mode: 'sized' | 'boolean',
  dimensions: { mapWidth: number; mapHeight: number },
  format: 'png' | 'jpeg' = 'png',
): Promise<string | null> {
  try {
    const res =
      mode === 'boolean'
        ? await fn.call(map, true)
        : await fn.call(map, {
            width: dimensions.mapWidth,
            height: dimensions.mapHeight,
            format,
            quality: format === 'jpeg' ? 0.92 : 1,
            writeToDisk: true,
          });
    return extractSnapUri(res);
  } catch {
    return null;
  }
}

export const tryMapboxSnap = async (
  mapRef: React.RefObject<any>,
  dimensions: { mapWidth: number; mapHeight: number },
  options?: { format?: 'png' | 'jpeg' },
): Promise<string | null> => {
  const snapFormat = options?.format ?? 'png';
  const map = mapRef.current;
  if (!map) {
    console.warn('[mapboxSnapshot] MapView ref yok');
    return null;
  }

  const fn =
    (typeof map.takeSnap === 'function' && map.takeSnap) ||
    (typeof map.takeSnapshot === 'function' && map.takeSnapshot) ||
    null;

  if (!fn) {
    console.warn('[mapboxSnapshot] takeSnap/takeSnapshot yok');
    return null;
  }

  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  for (const mode of snapModeOrder()) {
    const uri = await invokeMapboxSnap(fn, map, mode, dimensions, snapFormat);
    if (uri && (await isCaptureImageUriUsable(uri))) {
      preferredSnapMode = mode;
      if (__DEV__) console.log('[mapboxSnapshot] snapshot OK:', mode, uri);
      return uri;
    }
    if (uri && __DEV__) {
      console.warn('[mapboxSnapshot] snapshot çok küçük, sonraki yöntem deneniyor:', mode);
    }
  }

  console.warn('[mapboxSnapshot] snapshot başarısız veya boş');
  return null;
};

/**
 * MapView'da görünen piksel kadrajını yakalar (boyut zorlaması yok — önizleme WYSIWYG).
 * takeSnap(true) öncelikli; şablon en-boy oranına zorlanmış snap kadrajı kaydırır.
 */
export async function tryMapboxSnapLiveView(
  mapRef: React.RefObject<any>,
  options?: { format?: 'png' | 'jpeg' },
): Promise<string | null> {
  const snapFormat = options?.format ?? 'png';
  const map = mapRef.current;
  if (!map) {
    console.warn('[mapboxSnapshot] MapView ref yok (live)');
    return null;
  }

  const fn =
    (typeof map.takeSnap === 'function' && map.takeSnap) ||
    (typeof map.takeSnapshot === 'function' && map.takeSnapshot) ||
    null;

  if (!fn) {
    console.warn('[mapboxSnapshot] takeSnap/takeSnapshot yok (live)');
    return null;
  }

  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  try {
    const res =
      snapFormat === 'jpeg'
        ? await fn.call(map, { writeToDisk: true, format: 'jpeg', quality: 0.92 })
        : await fn.call(map, true);
    const uri = extractSnapUri(res);
    if (uri && (await isCaptureImageUriUsable(uri))) {
      if (__DEV__) console.log('[mapboxSnapshot] live snapshot OK:', uri);
      return uri;
    }
  } catch {
    /* sized yedek aşağıda */
  }

  console.warn('[mapboxSnapshot] live snapshot başarısız');
  return null;
}
