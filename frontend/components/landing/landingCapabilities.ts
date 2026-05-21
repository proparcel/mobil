/** Web `HERO_CAPABILITY_CARDS` ile aynı sıra ve içerik */
export type LandingCapabilityId =
  | 'prosorgu'
  | 'basit-sorgu'
  | 'ilan-ver'
  | 'emlak-vitrini'
  | 'sandik'
  | 'prosorgu-listesi'
  | 'tasarimli-screenshot'
  | '3d-model'
  | 'ai-drone'
  | 'uzman-gorusu'
  | 'hisseli-parsel'
  | 'ai-video';

export type LandingCapability = {
  id: LandingCapabilityId;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
};

export const LANDING_CAPABILITIES: LandingCapability[] = [
  {
    id: 'prosorgu',
    title: 'ProSorgu',
    description: 'Parsel ve bölge sorgularını profesyonelce yapın.',
    icon: 'search',
    iconColor: '#39DFFF',
  },
  {
    id: 'basit-sorgu',
    title: 'Basit Sorgu',
    description: 'Hızlı ve kolay parsel sorgulama aracı.',
    icon: 'map',
    iconColor: '#2ADCBE',
  },
  {
    id: 'ilan-ver',
    title: 'İlan Ver',
    description: 'Analiz ettiğiniz araziyi vitrinde yayınlayın.',
    icon: 'add-circle',
    iconColor: '#4ADE80',
  },
  {
    id: 'emlak-vitrini',
    title: 'Emlak Vitrini',
    description: 'Portföyünüzü geniş kitlelere sergileyin.',
    icon: 'tablet-portrait',
    iconColor: '#A78BFA',
  },
  {
    id: 'sandik',
    title: 'Sandık',
    description: 'Gayrimenkul danışmanlarına özel gizli ilan portalı.',
    icon: 'lock-closed',
    iconColor: '#FBBF24',
  },
  {
    id: 'prosorgu-listesi',
    title: 'ProSorgu Listesi',
    description: 'Yapılan diğer sorgu sonuçları görün.',
    icon: 'list',
    iconColor: '#60A5FA',
  },
  {
    id: 'tasarimli-screenshot',
    title: 'Tasarımlı Ekran Görüntüsü',
    description: 'Parsel seçtikten sonra sunuma hazır görüntü alın.',
    icon: 'camera',
    iconColor: '#38BDF8',
  },
  {
    id: '3d-model',
    title: '3D Model',
    description: 'Araziyi 3D ortamda inceleyin.',
    icon: 'cube',
    iconColor: '#818CF8',
  },
  {
    id: 'ai-drone',
    title: 'AI Drone',
    description: 'Yapay zeka destekli drone görüntü analizi.',
    icon: 'airplane',
    iconColor: '#22D3EE',
  },
  {
    id: 'uzman-gorusu',
    title: 'Uzman Görüşü',
    description: 'ProSorgu sonrası uzman talebi oluşturun.',
    icon: 'school',
    iconColor: '#F472B6',
  },
  {
    id: 'hisseli-parsel',
    title: 'Hisseli Parsel',
    description: 'Hisseli parselleri analiz edin ve yönetin.',
    icon: 'grid',
    iconColor: '#34D399',
  },
  {
    id: 'ai-video',
    title: 'AI Video',
    description: 'Yapay zeka ile arazi videoları oluşturun.',
    icon: 'videocam',
    iconColor: '#FB7185',
  },
];
