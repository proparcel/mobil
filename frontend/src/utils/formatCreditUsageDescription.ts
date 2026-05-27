/**
 * CreditUsage.description — sıkça JSON (Pro sorgu / drone meta); mobil listede okunur satır.
 */

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function formatCreditUsageDescription(raw: string | undefined | null): string | null {
  const text = String(raw || '').trim();
  if (!text) return null;

  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const o = parsed as Record<string, unknown>;
        const parts: string[] = [];
        const mahalle = pickStr(o, ['mahalleTkgm', 'mahalle', 'quarter', 'quarter_name']);
        const ada = pickStr(o, ['ada']);
        const parsel = pickStr(o, ['parsel']);
        const il = pickStr(o, ['il', 'city', 'city_name']);
        const ilce = pickStr(o, ['ilce', 'district', 'district_name']);
        if (il || ilce) parts.push([il, ilce].filter(Boolean).join(' / '));
        if (mahalle) parts.push(mahalle);
        if (ada && parsel) parts.push(`Ada/Parsel ${ada}/${parsel}`);
        else if (ada || parsel) parts.push(`Parsel ${ada || parsel}`);
        const title = pickStr(o, ['title', 'listing_title', 'label']);
        if (title && !parts.some((p) => p.includes(title))) parts.push(title);
        if (parts.length) return parts.join(' · ');
      }
    } catch {
      // ham JSON gösterme
    }
    return 'İşlem detayı';
  }

  if (text.length > 140) return `${text.slice(0, 137)}…`;
  return text;
}

export function formatCreditUsageDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCreditUsageCoin(amount: number, isPositive?: boolean): string {
  const n = Math.abs(Number(amount) || 0);
  const prefix = isPositive ? '+' : '−';
  return `${prefix}${n.toLocaleString('tr-TR')} C`;
}
