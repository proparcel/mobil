# Çözüm Adımları - require doesn't exist

## Yapılan Değişiklikler

### 1. index.js - @expo/metro-runtime eklendi
```javascript
import '@expo/metro-runtime';  // En üstte, diğer import'lardan önce
```

### 2. metro.config.js - Sadeleştirildi
- rewriteRequestUrl override kaldırıldı
- babelTransformerPath override kaldırıldı
- Sadece `unstable_enablePackageExports: false` + proje gereksinimleri (assetExts, alias, vb.) kaldı

### 3. package.json - @expo/metro-runtime eklendi
Bağımlılık olarak eklendi (expo-dev-client ile gelebilir ama açıkça eklenmesi önerildi).

---

## Manuel Yapılması Gereken: app/ → screens/ Yeniden Adlandırma

Expo, `app/` klasörünü görünce Expo Router varsayıyor ve `transform.routerRoot=app` ekliyor. Bu router hattına girmenize neden oluyor.

**Adımlar:**
1. Tüm editörleri ve Metro'yu kapatın
2. `app` klasörünü `screens` olarak yeniden adlandırın
3. Tüm import'ları güncelleyin: `./app/` → `./screens/`

**Güncellenecek dosyalar:**
- `App.tsx` - tüm `./app/routes/` ve `./app/contexts/` → `./screens/routes/` ve `./screens/contexts/`
- `components/app/ShapeDrawingModal.tsx` - `../../app/contexts/` → `../../screens/contexts/`
- `app/routes/` içindeki dosyalar birbirine referans veriyorsa onları da güncelleyin

---

## Sonraki Adımlar

1. **Bağımlılıkları yükle:**
   ```bash
   yarn install
   ```

2. **Cache temizleyerek başlat:**
   ```bash
   npx expo start -c --dev-client --lan
   ```

3. **EAS development build yeniden al** (gerekirse):
   ```bash
   eas build --profile development -p ios
   ```

4. **iPhone'da uygulamayı kaldırıp yeniden kur** (eski embedded config kalmasın)
