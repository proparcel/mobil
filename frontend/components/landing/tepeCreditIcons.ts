import type { GiftRewardItem } from '../../services/creditService';

const FA_TO_ION: Record<string, string> = {
  gift: 'gift',
  share: 'share-social',
  'share-alt': 'share-social',
  camera: 'camera',
  star: 'star',
  coins: 'logo-bitcoin',
  drone: 'airplane',
  video: 'videocam',
  cube: 'cube',
  search: 'search',
  user: 'person',
  users: 'people',
  chart: 'stats-chart',
  home: 'home',
  file: 'document-text',
  whatsapp: 'logo-whatsapp',
};

export function ionIconForReward(item: Pick<GiftRewardItem, 'icon' | 'icon_fa' | 'event_type'>): string {
  const fa = (item.icon_fa || '').replace(/^fas\s+/, '').replace(/^fa-/, '');
  if (fa && FA_TO_ION[fa]) return FA_TO_ION[fa];
  const ic = (item.icon || '').replace(/^fa-/, '');
  if (ic && FA_TO_ION[ic]) return FA_TO_ION[ic];
  const et = (item.event_type || '').toLowerCase();
  if (et.includes('share')) return 'share-social';
  if (et.includes('photo') || et.includes('camera')) return 'camera';
  if (et.includes('referral') || et.includes('invite')) return 'people';
  if (et.includes('review') || et.includes('rating')) return 'star';
  if (et.includes('sales') || et.includes('emsal')) return 'stats-chart';
  if (et.includes('video') || et.includes('drone')) return 'videocam';
  return 'gift';
}

export const FALLBACK_GIFT_REWARDS: GiftRewardItem[] = [
  {
    event_type: 'referral',
    display_name: 'Bizi Öner',
    credits: 5,
    description: 'Arkadaşın linkinle kayıt olursa Tepe Kredi kazanın.',
    icon: 'gift',
    is_coming_soon: false,
  },
  {
    event_type: 'screenshot_share',
    display_name: 'Ekran Görüntüsü Paylaş',
    credits: 1,
    description: 'Paylaşım tamamlanınca Tepe Kredi kazanın.',
    icon: 'share',
    is_coming_soon: false,
  },
  {
    event_type: 'review',
    display_name: 'Değerlendirme Yap',
    credits: 10,
    description: 'Uygulama değerlendirmesi ile kredi kazanın.',
    icon: 'star',
    is_coming_soon: true,
  },
  {
    event_type: 'report_photos',
    display_name: '3 Güncel Fotoğraf Yükle',
    credits: 20,
    description: 'Rapor için güncel fotoğraflar yükleyin.',
    icon: 'camera',
    is_coming_soon: true,
  },
  {
    event_type: 'sales_report',
    display_name: 'Satış Bilgisi Gir',
    credits: 30,
    description: 'Dekont onaylanınca Tepe Kredi kazanın.',
    icon: 'stats-chart',
    is_coming_soon: false,
  },
];
