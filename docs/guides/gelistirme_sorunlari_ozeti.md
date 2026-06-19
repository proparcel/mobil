# ProParcel Mobil Uygulama - Geliştirme Ortamı Sorunu Özeti

## Ortam
- **İşletim Sistemi:** Windows
- **Cihaz:** Fiziksel iPhone 11 (USB ile bağlı, aynı WiFi ağında)
- **Proje:** React Native 0.81.5, native (bare) workflow
- **Routing:** React Navigation (Expo Router DEĞİL)
- **Build:** EAS Build ile development build alınıyor, cihaza yüklü

## Ana Sorun
Fiziksel iPhone'da uygulama açılmıyor. Metro bundler çalışıyor ancak uygulama bundle'ı yüklerken çöküyor.

---

## Karşılaşılan Hatalar (Kronolojik)

### 1. `[runtime not ready]: ReferenceError: Property 'require' doesn't exist`
- **Ne zaman:** Bundle cihaza yüklenirken
- **Stack trace:** `anonymous &platform=ios&dev=true&hot=false&lazy=true&transform.routerRoot=app:1304:24`
- **Neden:** Expo, `app/` klasörünü tespit edip Expo Router varsayarak `lazy=true` ve `transform.routerRoot=app` parametreleri ekliyor. Proje React Navigation kullanıyor, Expo Router değil. Lazy bundling `require`'ın runtime'da tanımlı olmadığı bir bağlamda kod çalıştırıyor.

### 2. `ERR_NGROK_3200` - Endpoint offline
- **Ne zaman:** `npx expo start --tunnel` kullanırken
- **Mesaj:** `pm0ddps-sercanyanaz-8081.exp.direct is offline`
- **Neden:** Ngrok tüneli kapalı/erişilemez. Aynı ağda olduğumuz için `--tunnel` yerine `--lan` kullanılması önerildi.

### 3. `Error: Expecting the request url to have a valid protocol`
- **Ne zaman:** Metro HmrServer, rewriteRequestUrl çıktısını işlerken
- **Dosya:** `metro/src/lib/parseBundleOptionsFromBundleRequestUrl.js:81`
- **Cause:** `'/index.bundle?platform=ios&dev=true&hot=false&lazy=false'`
- **Neden:** `rewriteRequestUrl` path döndürüyordu, Metro tam URL (http://...) bekliyordu.

### 4. `No apps connected. Sending "reload" to all React Native apps failed`
- **Ne zaman:** Metro'da "r" tuşuna basıldığında
- **Neden:** Uygulama Metro'ya bağlanamadı (muhtemelen yukarıdaki require hatası yüzünden çöküyor).

### 5. `iOS apps can only be built on macOS devices`
- **Ne zaman:** `npx react-native run-ios` veya `npx expo run:ios` çalıştırılırken
- **Neden:** Windows'ta iOS build yapılamaz. Fiziksel cihaz için EAS Build kullanılıyor.

---

## Denenen Çözümler

### 1. app.config.js
```javascript
extra: {
  router: { asyncRoutes: false },
}
```
**Sonuç:** Hata devam etti.

### 2. metro.config.js - rewriteRequestUrl override
- `lazy=true` → `lazy=false`
- `transform.asyncRoutes=true` → `transform.asyncRoutes=false`
- `transform.routerRoot` parametresini kaldırma

**Sonuç:** URL'de lazy=false görünüyor ama "require doesn't exist" hatası devam etti.

### 3. metro.config.js - Babel transformer değişikliği
Expo babel transformer yerine React Native transformer kullanıldı:
```javascript
transformer: {
  babelTransformerPath: require.resolve('@react-native/metro-babel-transformer'),
}
```

**Sonuç:** Denenmedi (URL hatası sonrası sıra buna gelmedi).

### 4. metro.config.js - rewriteRequestUrl protocol düzeltmesi
Path yerine tam URL döndürme: `u.toString()` ile `http://localhost:8081/index.bundle?...`

**Sonuç:** Protocol hatası giderildi.

### 5. `--tunnel` yerine `--lan`
**Sonuç:** Ngrok hatası giderildi, ancak uygulama hâlâ açılmıyor.

---

## Mevcut metro.config.js Yapısı

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { getRewriteRequestUrl } = require('@expo/metro-config/build/rewriteRequestUrl');
const { mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const originalRewrite = getRewriteRequestUrl(__dirname);

const config = {
  transformer: {
    babelTransformerPath: require.resolve('@react-native/metro-babel-transformer'),
  },
  server: {
    rewriteRequestUrl: (url) => {
      const rewritten = originalRewrite(url);
      if (typeof rewritten === 'string') {
        const base = rewritten.startsWith('http') ? undefined : 'http://localhost:8081';
        const u = new URL(rewritten, base);
        u.searchParams.set('lazy', 'false');
        u.searchParams.delete('transform.routerRoot');
        u.searchParams.delete('transform.asyncRoutes');
        return u.toString();
      }
      return rewritten;
    },
  },
  resolver: {
    unstable_enablePackageExports: false,
    assetExts: [..., "glb", "gltf", "bin"],
    alias: { '@': path.resolve(__dirname) },
  },
  // ...
};
module.exports = mergeConfig(defaultConfig, config);
```

---

## Proje Yapısı

- **Entry:** `index.js` → `App.tsx`
- **Routing:** `App.tsx` içinde React Navigation `Stack.Navigator`, `app/routes/` altında ekranlar
- **expo-router:** `package.json`'da yok, sadece `app/` klasör yapısı var
- **app.config.js:** `expo.extra.router.asyncRoutes: false` mevcut
- **Babel:** `module:@react-native/babel-preset` + `babel-plugin-module-resolver` + `react-native-reanimated/plugin`

---

## Özet Soru

**Windows + fiziksel iPhone 11 + React Native (native) + React Navigation + expo-dev-client + EAS Build** ortamında:

1. Metro `npx expo start --lan` ile başlıyor.
2. Uygulama cihazda açıldığında bundle yüklenirken `[runtime not ready]: ReferenceError: Property 'require' doesn't exist` hatası alınıyor.
3. `lazy=false` ve `transform.routerRoot` kaldırılmasına rağmen hata devam ediyor.
4. Expo Router kullanılmıyor, `app/` sadece React Navigation route dosyaları için kullanılıyor.

**Nasıl bu "require doesn't exist" hatasını giderebiliriz ve uygulamanın fiziksel iPhone'da Metro'ya bağlanıp çalışmasını sağlayabiliriz?**
