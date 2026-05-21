import { DJANGO_API_URL } from '../../config/api';

const MEDIA_BASE = DJANGO_API_URL.replace(/\/$/, '');

export type SlopeInfo = { desc: string; iconUri: string };

export function getSlopeInfo(v: number | null | undefined): SlopeInfo {
  const icon = (name: string) => `${MEDIA_BASE}/media/avatars/EgimAvatars/${name}`;
  if (v == null || (typeof v === 'string' && v === '')) {
    return { desc: 'Veri yok', iconUri: icon('adam.png') };
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    return { desc: 'Veri yok', iconUri: icon('adam.png') };
  }
  if (n < 5) return { desc: 'Düz yürüyüş', iconUri: icon('adam.png') };
  if (n < 10) return { desc: 'Hafif yokuş', iconUri: icon('adam2.png') };
  if (n < 20) return { desc: 'Belirgin yokuş', iconUri: icon('adam3.png') };
  if (n < 30) return { desc: 'Çoğu insan zorlanır', iconUri: icon('adam4.png') };
  if (n < 40) return { desc: 'Araç çıkamaz', iconUri: icon('arabaX.png') };
  return { desc: 'İş makinesi çıkamaz', iconUri: icon('traktorX.png') };
}

/** 0–10 yeşil, 10–20 sarı, 20–30 turuncu, 30+ kırmızı */
export function getSlopeHeatColor(slope: number | null | undefined): string {
  const s = Number(slope);
  if (!Number.isFinite(s)) return '#94a3b8';
  let color = '#22c55e';
  if (s > 10) color = '#eab308';
  if (s > 20) color = '#f97316';
  if (s > 30) color = '#ef4444';
  return color;
}

export function getMobilityHints(slope: number | null | undefined): {
  walk: string;
  car: string;
  tractor: string;
} {
  const s = Number(slope);
  if (!Number.isFinite(s)) {
    return { walk: '—', car: '—', tractor: '—' };
  }
  const walk =
    s < 10 ? 'Rahat' : s < 20 ? 'Hafif zorlanır' : s < 30 ? 'Yürüyüş zorlaşır' : 'Çok zor';
  const car =
    s < 15 ? 'Çıkabilir' : s < 28 ? 'Dikkat' : s < 38 ? 'Genelde çıkamaz' : 'Çıkamaz';
  const tractor = s < 22 ? 'Rahat' : s < 35 ? 'Dikkat' : 'Zorlanır / çıkamaz';
  return { walk, car, tractor };
}

/** Web SlopeTerrainCard clip-path ile aynı tepe noktaları (0–100 koordinat, y aşağı). */
export function getSlopeHillPoints(slope: number | null | undefined): string {
  const s = Number(slope);
  const rise = Number.isFinite(s) ? Math.min(Math.max(s * 1.15, 8), 78) : 18;
  const yLeft = 100 - rise;
  const yMid = 100 - rise * 0.35;
  return `0,100 0,${yLeft} 58,${yMid} 100,100`;
}

export function formatSlopePercentLabel(slope: number | null | undefined): string {
  if (slope == null || !Number.isFinite(Number(slope))) return '—';
  return `%${Number(slope).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
}
