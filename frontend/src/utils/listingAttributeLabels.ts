const LABELS: Record<string, string> = {
  zoning_status: 'İmar durumu',
  kaks_emsal: 'KAKS / Emsal',
  gabari: 'Gabari',
  credit_eligible: 'Krediye uygunluk',
  building_title_deed_status: 'Tapu durumu',
  seller_type: 'Satıcı tipi',
};

export function listingAttributeLabelTr(key: string): string {
  const k = String(key || '').trim();
  return LABELS[k] || k.replace(/_/g, ' ');
}

export function formatListingAttributeValueTr(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  return String(value);
}
