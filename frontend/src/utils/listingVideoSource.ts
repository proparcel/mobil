/** react-native-video: HLS/DASH için `type` gerekir; aksi halde oynatma başlamayabilir */
export function buildListingVideoSource(uri: string): { uri: string; type?: string } {
  const u = uri.trim();
  const path = u.split('?')[0].toLowerCase();
  if (path.endsWith('.m3u8') || path.includes('.m3u8')) {
    return { uri: u, type: 'm3u8' };
  }
  if (path.endsWith('.mpd')) {
    return { uri: u, type: 'mpd' };
  }
  return { uri: u };
}

/** Kısa ilan videoları — daha hızlı ilk kare, makul rebuffer riski */
export const LISTING_VIDEO_BUFFER_CONFIG = {
  minBufferMs: 8000,
  maxBufferMs: 30000,
  bufferForPlaybackMs: 1200,
  bufferForPlaybackAfterRebufferMs: 2500,
} as const;
