/** Geliştirme ortamında ekran görüntüsü adım süreleri */

const marks = new Map<string, number>();

export function capturePerfMark(label: string): void {
  if (!__DEV__) return;
  marks.set(label, Date.now());
  console.log(`[capture-perf] ${label} @0ms`);
}

export function capturePerfSince(label: string, since?: string): void {
  if (!__DEV__) return;
  const start = since ? marks.get(since) : marks.get('capture:total');
  if (start == null) return;
  console.log(`[capture-perf] ${label} +${Date.now() - start}ms`);
}

export function capturePerfStart(): void {
  if (!__DEV__) return;
  marks.clear();
  marks.set('capture:total', Date.now());
  console.log('[capture-perf] --- başlangıç ---');
}
