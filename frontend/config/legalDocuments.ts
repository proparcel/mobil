/**
 * Hukuki metin slug/başlıkları — Django `myapp/views/legal_views.py` LEGAL_DOCUMENTS ile aynı.
 */
export type LegalDocument = {
  slug: string;
  title: string;
  /** Landing footer gibi dar alanlar için kısa etiket */
  shortTitle?: string;
};

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  { slug: 'kullanim-sartlari', title: 'Kullanım Şartları' },
  { slug: 'kvkk', title: 'KVKK Aydınlatma Metni', shortTitle: 'KVKK' },
  { slug: 'cerez-politikasi', title: 'Çerez Politikası' },
  { slug: 'uyelik-sozlesmesi', title: 'Üyelik Sözleşmesi' },
  { slug: 'ilan-sozlesmesi', title: 'İlan Sözleşmesi' },
  { slug: 'veri-dogruluk-reddi', title: 'Veri Doğruluk Reddi', shortTitle: 'Veri Reddi' },
  {
    slug: 'yatirim-analiz-reddi',
    title: 'Yatırım Analizi ve Skor Bilgilendirmesi',
    shortTitle: 'Yatırım Reddi',
  },
  { slug: 'hizmet-sozlesmesi-pro', title: 'Hizmet Sözleşmesi (Pro Üyelik)', shortTitle: 'Pro Üyelik' },
  { slug: 'mesafeli-satis-sozlesmesi', title: 'Mesafeli Satış Sözleşmesi', shortTitle: 'Mesafeli Satış' },
  { slug: 'gizlilik-politikasi', title: 'Gizlilik Politikası' },
];

export function legalDocumentPath(slug: string): string {
  return `/hukuki/${slug}/`;
}
