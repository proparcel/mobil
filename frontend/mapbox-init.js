import Mapbox from '@rnmapbox/maps';
import { MAPBOX_ACCESS_TOKEN } from './config/mapbox';

if (MAPBOX_ACCESS_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
} else if (__DEV__) {
  console.warn('[mapbox-init] Access token bos — harita yuklenmez');
}
