/**
 * Fiyat Parse Utility Fonksiyonları
 * 
 * Backend'den gelen Türk formatındaki fiyat string'lerini parse eder.
 * Format: "1.234,56" (nokta binlik ayırıcı, virgül ondalık ayırıcı)
 */

/**
 * Türk formatındaki fiyat string'ini sayıya çevirir
 * 
 * @param price - Fiyat değeri (string, number, null, undefined)
 * @returns Parse edilmiş sayı (0 dahil) veya 0 (veri yoksa)
 * 
 * Örnekler:
 * - "1.234,56" -> 1234.56
 * - "0,00" -> 0
 * - "1234.56" -> 1234.56 (number olarak gelirse direkt döner)
 * - null/undefined -> 0
 */
export function parseTurkishPrice(
  price: string | number | null | undefined
): number {
  // Null/undefined/boş string kontrolü - 0 döndür
  if (price === null || price === undefined || price === '') {
    return 0;
  }

  // Number tipinde gelirse direkt döndür (0 dahil)
  if (typeof price === 'number') {
    return isNaN(price) ? 0 : price;
  }

  // String tipinde gelirse parse et
  if (typeof price === 'string') {
    const trimmed = price.trim();
    
    // "0,00" veya "0" gibi değerleri direkt 0 döndür
    if (trimmed === '0' || trimmed === '0,00' || trimmed === '0.00' || trimmed.toLowerCase() === 'none') {
      return 0;
    }

    // Noktaları kaldır (binlik ayırıcı), virgülü nokta yap (ondalık ayırıcı)
    // Örnek: "1.234,56" -> "1234.56"
    const cleaned = trimmed
      .replace(/\./g, '') // Binlik ayırıcıları kaldır
      .replace(',', '.') // Ondalık ayırıcıyı noktaya çevir
      .replace(/[^\d.]/g, ''); // Sadece rakam ve nokta bırak

    // Parse et
    const parsed = parseFloat(cleaned);

    // NaN kontrolü - 0 döndür
    if (isNaN(parsed)) {
      return 0;
    }

    // Parse edilmiş değeri döndür (0 dahil)
    return parsed;
  }

  // Beklenmeyen tip - 0 döndür
  return 0;
}

/**
 * Fiyatı Türk formatında formatlar (gösterim için)
 * 
 * @param price - Sayısal fiyat değeri
 * @returns Formatlanmış string: "1.234,56 ₺" veya "0,00 ₺"
 * 
 * Örnek:
 * - 1234.56 -> "1.234,56 ₺"
 * - 0 -> "0,00 ₺"
 */
export function formatTurkishPrice(price: number | null | undefined): string {
  // Null/undefined/NaN ise 0 olarak göster
  const value = (price === null || price === undefined || isNaN(price)) ? 0 : price;

  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' ₺';
}

