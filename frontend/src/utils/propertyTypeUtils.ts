/**
 * Property Type Utility Functions
 * Handles property type inference and selection for mobile app
 */

/**
 * TKGM Nitelik metninden türü türetir: Arsa | Köy içi | Tarla | null
 */
export function inferPropertyTypeFromNitelik(nitelikRaw: any): string | null {
  if (!nitelikRaw || typeof nitelikRaw !== 'string') return null;
  const s = (nitelikRaw || '').toLocaleLowerCase('tr-TR');
  
  // Arsa
  if (s.includes('arsa')) return 'Arsa';
  
  // Köy içi (çeşitli yazımlar)
  if (s.includes('köy içi') || s.includes('köyiçi') || s.includes('koy ici') || s.includes('koyici')) {
    return 'Köy içi';
  }
  
  // Tarla ve benzerleri
  const tarlaHints = [
    'tarla',
    'bağ',
    'bag',
    'bahçe',
    'bahce',
    'zeytinlik',
    'kavaklık',
    'kavaklik',
    'fındık',
    'findik',
    'çayır',
    'cayir',
    'fındıklık',
    'findiklik',
    'sera',
    'çalılık',
    'calilik',
    'maki',
    'tarım arazisi',
    'tarim arazisi',
  ];
  for (let i = 0; i < tarlaHints.length; i++) {
    if (s.includes(tarlaHints[i])) return 'Tarla';
  }
  
  // Ticari
  if (s.includes('ticari')) return 'Ticari';
  
  return null;
}

/**
 * TKGM verisinden nitelik metnini çıkarır
 */
export function extractNitelikText(tkgmData: any): string {
  if (!tkgmData) return '';
  
  try {
    const props = (tkgmData && tkgmData.properties) ? tkgmData.properties : {};
    const nitelikText = (
      tkgmData.Nitelik || 
      tkgmData.nitelik || 
      props.nitelik || 
      props.Nitelik || 
      ''
    ).trim();
    return nitelikText;
  } catch (_) {
    return '';
  }
}

/**
 * Nitelik metninden önerilen türü ve mesajı oluşturur
 */
export function generatePropertyTypeTitle(nitelikText: string): { title: string; suggestedType: string | null } {
  const normalized = (nitelikText || '').toLocaleLowerCase('tr-TR');
  
  const tarlaHints = [
    'tarla',
    'bağ',
    'bag',
    'zeytinlik',
    'kavaklık',
    'kavaklik',
    'sera',
    'çalılık',
    'calilik',
    'maki',
    'tarım arazisi',
    'tarim arazisi',
  ];
  const matchesTarla = tarlaHints.some(h => normalized.includes(h));
  const matchesTicari = normalized.includes('ticari');
  const matchesArsa = normalized.includes('arsa');
  
  const evKoyHints = [
    'bahçeli ev',
    'bahceli ev',
    'ev',
    'bina',
    'kargir',
    'kârgir',
    'kargir',
    'köy içi',
    'köyiçi',
    'koy ici',
    'koyici',
  ];
  const matchesEvKoy = evKoyHints.some(h => normalized.includes(h));

  let title: string;
  let suggestedType: string | null = null;

  if (matchesTarla) {
    suggestedType = 'Tarla';
    title = `Arazi tipi genel olarak "Tarla" sınıfına uymaktadır.\nTKGM'den gelen veri bu şekilde: "${nitelikText || '?'}".\nLütfen onayladığınız tipi seçin.`;
  } else if (matchesTicari) {
    suggestedType = 'Ticari';
    title = `Arazi tipi genel olarak "Ticari" sınıfına uymaktadır.\nTKGM'den gelen veri bu şekilde: "${nitelikText || '?'}".\nLütfen onayladığınız tipi seçin.`;
  } else if (matchesArsa) {
    suggestedType = 'Arsa';
    title = `Arazi tipi genel olarak "Arsa" sınıfına uymaktadır.\nTKGM'den gelen veri bu şekilde: "${nitelikText || '?'}".\nLütfen onayladığınız tipi seçin.`;
  } else if (matchesEvKoy) {
    suggestedType = 'Arsa';
    title = `Arazi tipi genel olarak "Arsa veya Köy içi" sınıfına uymaktadır.\nTKGM'den gelen veri bu şekilde: "${nitelikText || '?'}".\nLütfen onayladığınız tipi seçin.`;
  } else {
    title = `TKGM'den gelen nitelik: "${nitelikText || '?'}".\nArazi tipi doğru mu? Eğer doğru değilse aşağıdan uygun türü seçin.`;
  }

  return { title, suggestedType };
}
