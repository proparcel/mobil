# Expo Temizleme Planı - React Native CLI Projesi

**Proje Yolu:** `mobile/mobil_github/frontend`  
**Tarih:** 2026-01-23  
**Durum:** React Native CLI projesi (Expo kullanılmıyor)

---

## 📋 Özet

Bu proje React Native CLI kullanıyor ve Expo bağımlılığı yok. Ancak bazı yapılandırma dosyalarında Expo referansları bulunuyor. Bu plan, tüm Expo referanslarını temizlemek için adım adım rehber sağlar.

---

## 1. Tespit Edilen Expo Referansları

### 1.1 Yapılandırma Dosyaları

#### ✅ `tsconfig.json`
- **Durum:** Expo base config'i extend ediyor
- **Satır:** 2
- **İçerik:** `"extends": "expo/tsconfig.base"`
- **Öncelik:** YÜKSEK ⚠️

#### ✅ `app.json`
- **Durum:** Minimal yapılandırma dosyası (Expo-specific değil)
- **İçerik:** Sadece app name, displayName, version
- **Öncelik:** DÜŞÜK (isteğe bağlı kaldırılabilir)

#### ✅ `.gitignore`
- **Durum:** Expo klasörleri ve dosyaları ignore ediliyor
- **Satırlar:** 6-10
- **İçerik:**
  ```
  # Expo
  .expo/
  dist/
  web-build/
  expo-env.d.ts
  ```
- **Öncelik:** ORTA (temizlik için kaldırılabilir)

### 1.2 Kod İçi Referanslar

#### ✅ `src/hooks/useNavigation.ts`
- **Durum:** Sadece yorum satırlarında Expo-router benzeri API'den bahsediliyor
- **Satırlar:** 4, 23, 57
- **İçerik:** "expo-router benzeri API" yorumları
- **Öncelik:** DÜŞÜK (sadece dokümantasyon)

### 1.3 Bağımlılık Dosyaları

#### ✅ `package-lock.json`
- **Durum:** `@rnmapbox/maps` paketinin peerDependencies'inde Expo optional olarak listelenmiş
- **Satır:** 2428-2436
- **Not:** Bu paket seviyesinde bir referans, proje seviyesinde değil
- **Öncelik:** DÜŞÜK (paket kendi bağımlılığı, değiştirilemez)

#### ✅ `package.json`
- **Durum:** ✅ TEMİZ - Hiçbir Expo paketi yok
- **Öncelik:** YOK

### 1.4 Script Dosyaları

#### ✅ `scripts/reset-project.js`
- **Durum:** Expo-style yapıdan bahsediyor ama Expo kullanmıyor
- **Satırlar:** 4, 39
- **İçerik:** "expo-router benzeri" yorumları
- **Öncelik:** DÜŞÜK (sadece dokümantasyon)

---

## 2. Kaldırılacak/Değiştirilecek Dosyalar

### 2.1 Tamamen Kaldırılacak Dosyalar

**YOK** - Hiçbir dosya tamamen kaldırılmayacak. `app.json` isteğe bağlı olarak kaldırılabilir ama React Native CLI projelerinde de kullanılabilir.

### 2.2 Değiştirilecek Dosyalar

1. **`tsconfig.json`** - ⚠️ ZORUNLU
2. **`.gitignore`** - ⚠️ ÖNERİLİR
3. **`src/hooks/useNavigation.ts`** - ⚠️ OPSİYONEL (sadece yorumlar)
4. **`scripts/reset-project.js`** - ⚠️ OPSİYONEL (sadece yorumlar)

---

## 3. Değiştirilecek Kod Bölümleri

### 3.1 `tsconfig.json` - ZORUNLU DEĞİŞİKLİK

**Mevcut:**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    ...
  }
}
```

**Yeni:**
```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "commonjs",
    "lib": ["esnext"],
    "jsx": "react-native",
    "strict": true,
    "allowJs": true,
    "checkJs": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    "**/*.js",
    "**/*.jsx"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

### 3.2 `.gitignore` - ÖNERİLEN DEĞİŞİKLİK

**Mevcut:**
```
# Expo
.expo/
dist/
web-build/
expo-env.d.ts
```

**Yeni:**
```
# Build outputs
dist/
web-build/
```

**Not:** `.expo/` ve `expo-env.d.ts` satırları kaldırılacak.

### 3.3 `src/hooks/useNavigation.ts` - OPSİYONEL

**Mevcut yorumlar:**
```typescript
/**
 * React Navigation için compatibility layer - expo-router benzeri API sağlar
 */
...
/**
 * useRouter hook - React Navigation için expo-router benzeri API
 */
...
/**
 * useLocalSearchParams hook - React Navigation route params için expo-router benzeri API
 */
```

**Yeni yorumlar (opsiyonel):**
```typescript
/**
 * Navigation helper hook
 * 
 * React Navigation için compatibility layer - React Navigation API wrapper
 */
...
/**
 * useRouter hook - React Navigation için router API wrapper
 */
...
/**
 * useLocalSearchParams hook - React Navigation route params için helper hook
 */
```

### 3.4 `scripts/reset-project.js` - OPSİYONEL

**Mevcut yorum:**
```javascript
/**
 * This script is used to reset the project to a blank state.
 * It deletes or moves the /app, /components, /hooks, /scripts, and /constants directories...
 */
```

**Yeni yorum (opsiyonel):**
```javascript
/**
 * This script is used to reset the project to a blank state.
 * It deletes or moves the /app, /components, /hooks, /scripts, and /constants directories...
 * React Native CLI projesi için tasarlanmıştır.
 */
```

---

## 4. Güncellenecek Yapılandırma Dosyaları

### 4.1 Zorunlu Güncellemeler

1. **`tsconfig.json`** ✅
   - Expo base config'i kaldır
   - React Native CLI için standart TypeScript config ekle

### 4.2 Önerilen Güncellemeler

2. **`.gitignore`** ✅
   - Expo-specific ignore kurallarını kaldır

### 4.3 Opsiyonel Güncellemeler

3. **`src/hooks/useNavigation.ts`** (yorumlar)
4. **`scripts/reset-project.js`** (yorumlar)

---

## 5. Test ve Doğrulama Adımları

### 5.1 Değişiklik Sonrası Testler

#### ✅ TypeScript Derleme Kontrolü
```bash
cd mobile/mobil_github/frontend
npx tsc --noEmit
```
**Beklenen:** Hata olmamalı

#### ✅ Metro Bundler Testi
```bash
npm start
# veya
npx react-native start
```
**Beklenen:** Metro başarıyla başlamalı, hata olmamalı

#### ✅ Android Build Testi
```bash
npm run android
# veya
npx react-native run-android
```
**Beklenen:** Uygulama başarıyla derlenmeli ve çalışmalı

#### ✅ iOS Build Testi (Mac'te)
```bash
npm run ios
# veya
npx react-native run-ios
```
**Beklenen:** Uygulama başarıyla derlenmeli ve çalışmalı

#### ✅ Linter Kontrolü
```bash
npm run lint
```
**Beklenen:** Linter hataları olmamalı

### 5.2 Doğrulama Checklist

- [ ] `tsconfig.json` Expo referansı yok
- [ ] `.gitignore` Expo referansları temizlendi
- [ ] TypeScript derleme başarılı
- [ ] Metro bundler çalışıyor
- [ ] Android build başarılı
- [ ] iOS build başarılı (Mac'te)
- [ ] Linter hataları yok
- [ ] Uygulama çalışıyor
- [ ] Navigation çalışıyor
- [ ] Tüm ekranlar erişilebilir

---

## 6. Öncelik Sıralaması

### 🔴 YÜKSEK ÖNCELİK (Zorunlu)

1. **`tsconfig.json` güncellemesi**
   - **Neden:** TypeScript derlemesi Expo base config'e bağımlı
   - **Risk:** Yüksek - Proje derlenmeyebilir
   - **Süre:** 5 dakika

### 🟡 ORTA ÖNCELİK (Önerilen)

2. **`.gitignore` temizliği**
   - **Neden:** Gereksiz ignore kuralları
   - **Risk:** Düşük - Sadece temizlik
   - **Süre:** 2 dakika

### 🟢 DÜŞÜK ÖNCELİK (Opsiyonel)

3. **Yorum satırlarının güncellenmesi**
   - **Neden:** Dokümantasyon tutarlılığı
   - **Risk:** Yok - Sadece yorumlar
   - **Süre:** 5 dakika

---

## 7. Uygulama Adımları

### Adım 1: Yedekleme
```bash
cd mobile/mobil_github/frontend
git status
git add .
git commit -m "chore: Expo temizleme öncesi yedek"
```

### Adım 2: tsconfig.json Güncelleme
- `tsconfig.json` dosyasını yeni içerikle değiştir

### Adım 3: .gitignore Temizleme
- Expo satırlarını kaldır

### Adım 4: Opsiyonel Yorum Güncellemeleri
- `useNavigation.ts` yorumlarını güncelle
- `reset-project.js` yorumlarını güncelle

### Adım 5: Test
- TypeScript derleme kontrolü
- Metro bundler testi
- Android build testi
- Linter kontrolü

### Adım 6: Commit
```bash
git add .
git commit -m "chore: Expo referanslarını temizle

- tsconfig.json: Expo base config'i kaldır, React Native CLI config ekle
- .gitignore: Expo-specific ignore kurallarını kaldır
- Yorumları güncelle (opsiyonel)"
```

---

## 8. Risk Analizi

### Düşük Risk
- ✅ `.gitignore` değişiklikleri
- ✅ Yorum güncellemeleri
- ✅ `app.json` kaldırma (isteğe bağlı)

### Orta Risk
- ⚠️ `tsconfig.json` değişiklikleri
  - **Azaltma:** Yedek al, test et, geri al

### Yüksek Risk
- ❌ YOK

---

## 9. Geri Alma Planı

Eğer bir sorun çıkarsa:

```bash
cd mobile/mobil_github/frontend
git checkout HEAD -- tsconfig.json .gitignore
# veya
git reset --hard HEAD~1
```

---

## 10. Notlar

1. **`app.json`** dosyası React Native CLI projelerinde de kullanılabilir (isteğe bağlı)
2. **`@rnmapbox/maps`** paketinin Expo peer dependency'si paket seviyesinde, proje seviyesinde değil
3. Kod içinde hiçbir Expo import'u yok - sadece yapılandırma dosyalarında referanslar var
4. Proje zaten React Native CLI kullanıyor, Expo migration gerekmiyor

---

## 11. Tamamlanma Durumu

- [ ] Yedekleme yapıldı
- [ ] `tsconfig.json` güncellendi
- [ ] `.gitignore` temizlendi
- [ ] Yorumlar güncellendi (opsiyonel)
- [ ] TypeScript derleme testi başarılı
- [ ] Metro bundler testi başarılı
- [ ] Android build testi başarılı
- [ ] Linter kontrolü başarılı
- [ ] Değişiklikler commit edildi

---

**Plan Hazırlayan:** AI Assistant  
**Son Güncelleme:** 2026-01-23
