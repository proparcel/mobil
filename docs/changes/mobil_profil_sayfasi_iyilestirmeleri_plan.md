# Mobil Profil Sayfası İyileştirmeleri Planı

## Mevcut Durum

- **Profil sayfası**: `frontend/screens/routes/profile.tsx` - Basit yapı, bireysel/kurumsal ayrımı yok
- **Menü**: "Kullanıcı" olarak gösteriliyor, "Profil" olarak değiştirilmeli
- **Dashboard**: İyi bir tasarım referansı olarak kullanılabilir

## Yapılacaklar

### 1. Menü İsmi Değiştirme

**Dosya**: `frontend/screens/routes/index.tsx`

**Değişiklikler**:
- `getMenuItems` fonksiyonunda `kullanici` item'ının `title`'ını "Profil" olarak değiştir

### 2. Profil Sayfası Yeniden Tasarımı

**Dosya**: `frontend/screens/routes/profile.tsx`

**Değişiklikler**:

#### 2.1. Dashboard Benzeri Header ve Tasarım

- Dashboard sayfasındaki gibi header yapısı (geri butonu, başlık, sağ tarafta boş alan)
- SafeAreaView kullanımı
- ScrollView ile içerik
- Pull-to-refresh desteği
- Kart bazlı tasarım (dashboard'daki gibi)

#### 2.2. Bireysel ve Kurumsal Ayrımı

- Profil verilerinden `member_type` kontrolü yap
- Bireysel kullanıcılar için: `ProfileIndividualContent` component'i
- Kurumsal kullanıcılar için: `ProfileCorporateContent` component'i
- Her ikisi için ortak header ve temel yapı

#### 2.3. Bireysel Kullanıcı Özellikleri

**Bölümler**:
1. **Profil Header** (Avatar, İsim, E-posta, Badge'ler)
2. **Hesap Bilgileri** (E-posta, Telefon, Kayıt Tarihi)
3. **Kişisel Bilgiler** (Ad, Soyad, Şirket/Firma, İl, İlçe) - Düzenlenebilir
4. **Adres Bilgileri** (İl, İlçe, Mahalle, Sokak, Posta Kodu) - Düzenlenebilir
5. **Firma Bilgileri** (Bağlı firma varsa göster, "Firmadan Çık" butonu)
6. **Firma Kaydı** (Vergi numarası ile firma arama ve istek gönderme)
7. **Bekleyen İstekler** (Eğer varsa)
8. **Şifre Değiştir**
9. **Hesap Ayarları** (Hesap silme)

**Firma İşlemleri**:
- Firma arama (vergi numarası ile)
- Firma bağlantı isteği gönderme
- Firmadan çıkma (bağlıysa) - Backend endpoint eklenmeli

#### 2.4. Kurumsal Kullanıcı Özellikleri

**Bölümler**:
1. **Profil Header** (Logo, Firma Adı, E-posta, Badge'ler)
2. **Hesap Bilgileri** (E-posta, Telefon, Kayıt Tarihi)
3. **Firma Bilgileri** (Firma Adı, Vergi No, Vergi Dairesi, Emlak Yetki Belge No) - Düzenlenebilir
4. **Kişisel Bilgiler** (Ad, Soyad, İl, İlçe) - Düzenlenebilir
5. **Adres Bilgileri** (İl, İlçe, Mahalle, Sokak, Posta Kodu) - Düzenlenebilir
6. **Firma Logosu** (Yükleme ve silme)
7. **Alt Kullanıcılar** (Yetkili ise - alt kullanıcıları listele ve çıkarabilir)
8. **Bekleyen Onaylar** (Bireysel üye isteklerini onayla/reddet)
9. **Şifre Değiştir**
10. **Hesap Ayarları** (Hesap silme)

**Firma İşlemleri**:
- Bireysel üye isteklerini onaylama
- Bireysel üye isteklerini reddetme
- Alt kullanıcıları firmadan çıkarma (yetkili ise)

### 3. API Servisleri

**Dosya**: `frontend/services/companyService.ts` (yeni)

**Yeni Fonksiyonlar**:
- `searchCompanyByVergiNo(vergiNo: string)` - Firma arama
- `requestCompanyMembership(vergiNo: string)` - Firma bağlantı isteği gönderme
- `approveCompanyMembership(requestId: number)` - İstek onaylama
- `rejectCompanyMembership(requestId: number)` - İstek reddetme
- `removeCompanyMember(userId: number)` - Firmadan çıkarma (kurumsal için)
- `leaveCompany()` - Firmadan çıkma (bireysel için)

**Not**: Ana projede bu işlemler web view'lar olarak var. Bu endpoint'ler JSON response döndürüyor, mobilde kullanılabilir.

### 4. Type Definitions

**Dosya**: `frontend/src/types/auth.ts`

**Yeni Tipler**:
```typescript
export interface CompanyMembershipRequest {
  id: number;
  individual_user: User;
  company_vergi_no: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  responded_at?: string;
  responded_by?: User;
}

export interface CompanyProfile {
  id: number;
  company_name: string;
  vergi_no: string;
  vergi_dairesi?: string;
  company_logo?: string;
  is_company_authority?: boolean;
}
```

### 5. Profil Sayfası Yapısı

**Bileşen Yapısı**:
```
ProfileScreen (Ana component)
├── Header (Dashboard gibi)
├── ProfileHeaderSection (Avatar/Logo, İsim, Badge'ler)
├── Conditional Rendering:
│   ├── IndividualProfileContent (Bireysel kullanıcı için)
│   │   ├── AccountInfoCard
│   │   ├── PersonalInfoCard
│   │   ├── AddressInfoCard
│   │   ├── CompanyInfoCard (Bağlı firma varsa + "Firmadan Çık" butonu)
│   │   ├── CompanyRequestCard (Firma arama ve istek)
│   │   ├── PendingRequestsCard (Bekleyen istekler)
│   │   ├── ChangePasswordCard
│   │   └── DangerZoneCard
│   └── CorporateProfileContent (Kurumsal kullanıcı için)
│       ├── AccountInfoCard
│       ├── CompanyInfoCard
│       ├── PersonalInfoCard
│       ├── AddressInfoCard
│       ├── LogoUploadCard
│       ├── SubUsersCard (Yetkili ise)
│       ├── PendingApprovalsCard (Bekleyen onaylar)
│       ├── ChangePasswordCard
│       └── DangerZoneCard
```

## Teknik Detaylar

### API Endpoint'leri (Web View'lar - JSON response döndürüyor)

**Mevcut Web Endpoint'leri**:
- `GET /accounts/profile/company/search/?vergi_no=...` - Firma arama (JSON döndürüyor)
- `POST /accounts/profile/company/request/` - Firma bağlantı isteği (redirect döndürüyor, JSON'a çevrilmeli)
- `POST /accounts/profile/company/approve/<request_id>/` - İstek onaylama (redirect döndürüyor, JSON'a çevrilmeli)
- `POST /accounts/profile/company/reject/<request_id>/` - İstek reddetme (redirect döndürüyor, JSON'a çevrilmeli)
- `POST /accounts/profile/company/remove-member/<user_id>/` - Üye çıkarma (redirect döndürüyor, JSON'a çevrilmeli)

**Yeni Endpoint Gerekli**:
- `POST /accounts/profile/company/leave/` - Bireysel kullanıcının firmadan çıkması (eklenmeli)

**Not**: Web view'lar redirect döndürüyor. Mobil için JSON response döndüren API endpoint'leri eklenmeli veya mevcut endpoint'ler güncellenmeli.

### Profil Verisi Yapısı

API'den gelen profil verisi (`/api/profile/`):
```typescript
{
  user: User;
  profile: UserProfile & {
    member_type: 'individual' | 'consultant' | 'corporate';
    company_relation?: CompanyProfile; // Bireysel için
    pending_requests?: CompanyMembershipRequest[]; // Bireysel için
    pending_membership_requests?: CompanyMembershipRequest[]; // Kurumsal için
    sub_users?: UserProfile[]; // Kurumsal yetkili için
  };
}
```

**Not**: Mevcut API endpoint'i bu verileri döndürmüyor olabilir. Backend'de profil view'ı güncellenmeli veya ayrı endpoint'ler eklenmeli.

### Firma Arama ve İstek Akışı

1. Bireysel kullanıcı vergi numarası girer
2. "Firma Bul" butonuna tıklar
3. API'ye istek gönderilir (`/accounts/profile/company/search/?vergi_no=...`)
4. Firma bulunursa bilgileri gösterilir
5. "Firma Bağlantı İsteği Gönder" butonu aktif olur
6. İstek gönderilir
7. Bekleyen istekler listesine eklenir

### Onay/Red Akışı (Kurumsal)

1. Kurumsal kullanıcı profil sayfasını açar
2. "Bekleyen Onaylar" bölümünde istekler listelenir
3. Her istek için "Onayla" veya "Reddet" butonu var
4. Onay/Red işlemi yapılır
5. Liste güncellenir

## Dosya Değişiklikleri

1. `frontend/screens/routes/index.tsx`
   - Menü item ismini "Profil" yap

2. `frontend/screens/routes/profile.tsx`
   - Tamamen yeniden yazılacak
   - Dashboard benzeri tasarım
   - Bireysel ve kurumsal ayrımı
   - Tüm bölümlerin eklenmesi

3. `frontend/services/companyService.ts` (yeni)
   - Firma işlemleri için API fonksiyonları

4. `frontend/src/types/auth.ts`
   - Yeni type tanımlamaları

5. `accounts/views/profile_views.py` (Backend - opsiyonel)
   - Profil API'sine company_relation, pending_requests vb. eklenmeli
   - Firma işlemleri için JSON response döndüren endpoint'ler eklenmeli

## Referans Dosyalar

- `accounts/templates/accounts/profile_individual.html` - Bireysel profil yapısı
- `accounts/templates/accounts/profile_corporate.html` - Kurumsal profil yapısı
- `accounts/views/web_views.py` - Profil view logic
- `frontend/screens/routes/dashboard.tsx` - Tasarım referansı

## Test Edilecekler

1. Bireysel kullanıcı profil sayfası görünümü
2. Kurumsal kullanıcı profil sayfası görünümü
3. Firma arama işlemi
4. Firma bağlantı isteği gönderme
5. Bekleyen isteklerin görüntülenmesi
6. Kurumsal kullanıcının istekleri onaylama/reddetme
7. Firmadan çıkma işlemi (bireysel)
8. Alt kullanıcı çıkarma (kurumsal)
9. Profil bilgileri güncelleme
10. Şifre değiştirme
11. Avatar/Logo yükleme
