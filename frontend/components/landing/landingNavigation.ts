type Router = {
  push: (path: string | { pathname: string; params?: Record<string, unknown> }, params?: Record<string, unknown>) => void;
  replace: (path: string | { pathname: string; params?: Record<string, unknown> }, params?: Record<string, unknown>) => void;
};

export function navigateLandingCapability(router: Router, id: string) {
  switch (id) {
    case 'prosorgu':
    case 'basit-sorgu':
    case 'tasarimli-screenshot':
      router.replace('index');
      break;
    case 'ilan-ver':
      router.push('ilan-islemleri');
      break;
    case 'emlak-vitrini':
      router.replace('emlak-vitrini-liste');
      break;
    case 'sandik':
      router.push('son-30-gun');
      break;
    case 'prosorgu-listesi':
      router.replace('index', { launch: 'my-queries' });
      break;
    case '3d-model':
      router.replace('index', { launch: '3d-designs' });
      break;
    case 'ai-drone':
    case 'ai-video':
      router.push('ai-video-studio');
      break;
    case 'uzman-gorusu':
      router.push({ pathname: 'expert-requests', params: { mode: 'mine' } });
      break;
    case 'hisseli-parsel':
      router.push('parcel-split');
      break;
    default:
      break;
  }
}

export function navigateGiftReward(router: Router, eventType: string) {
  switch (eventType) {
    case 'referral':
    case 'invite':
      router.push('tepe-coin-earn');
      break;
    case 'screenshot_share':
    case 'share':
      router.replace('index');
      break;
    case 'sales_report':
    case 'emsal':
      router.push('sales-report');
      break;
    case 'review':
    case 'rating':
      router.push('notifications');
      break;
    case 'photos':
    case 'report_photos':
      router.replace('index');
      break;
    default:
      router.push('tepe-coin-earn');
      break;
  }
}
