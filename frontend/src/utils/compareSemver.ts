/** Semver karşılaştırması: a<b → negatif, a>b → pozitif, eşit → 0 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((part) => parseInt(part, 10) || 0);
  const pb = b.split('.').map((part) => parseInt(part, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
