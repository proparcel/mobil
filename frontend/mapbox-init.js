/**
 * Mapbox token — native modül yoksa uygulama çökmemeli (eski dev IPA / yanlış build).
 */
import { MAPBOX_ACCESS_TOKEN } from './config/mapbox';

try {
  const Mapbox = require('@rnmapbox/maps').default || require('@rnmapbox/maps');
  if (MAPBOX_ACCESS_TOKEN && Mapbox?.setAccessToken) {
    Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
  } else if (__DEV__) {
    console.warn('[mapbox-init] Token veya Mapbox modülü eksik');
  }
} catch (e) {
  if (__DEV__) {
    console.warn('[mapbox-init] Mapbox yüklenemedi (dev client yeniden kurulmalı olabilir):', e);
  }
}
