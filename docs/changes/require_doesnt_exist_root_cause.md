# "require doesn't exist" Hatasının Kök Sebebi

## Özet

Hata: `[runtime not ready]: ReferenceError: Property 'require' doesn't exist`

**Kök sebep:** React Native'ın **native kodu** (iOS/Android), development modunda bundle isteğine otomatik olarak `lazy=true` parametresi ekliyor. Bu parametre Metro'da lazy/async bundle formatına geçişe yol açıyor. Lazy format, `@expo/metro-runtime` ile tam uyumlu değil veya modül sıralaması yanlış olduğunda `require` tanımsız kalıyor.

---

## 1. lazy=true Nereden Geliyor?

**Kaynak:** `react-native/React/Base/RCTBundleURLProvider.mm` (satır 315-316)

```objc
BOOL lazy = enableDev;  // enableDev = true ise lazy = true
...
[[NSURLQueryItem alloc] initWithName:@"lazy" value:lazy ? @"true" : @"false"],
```

- Development build'de (`enableDev=true`) React Native **native tarafında** her bundle isteğine `lazy=true` ekleniyor.
- Bu davranış **native kodda sabit**; `app.config.js` veya `metro.config.js` ile değiştirilemiyor.
- Değiştirmek için native kodu patch'lemek veya yeniden build gerekir.

---

## 2. lazy=true Ne Yapıyor?

Metro `lazy` parametresini `parseBundleOptionsFromBundleRequestUrl` ile okuyor:

- **Dosya:** `metro/src/lib/parseBundleOptionsFromBundleRequestUrl.js` (satır 128)
- `lazy=true` → Metro bundle'ı lazy/async formatında üretiyor.
- Lazy format: modüller ayrı chunk'lara bölünüyor, async yükleme kullanılıyor.
- Bu format `@expo/metro-runtime` ve `expo/internal/async-require-module` ile çalışacak şekilde tasarlanmış.

---

## 3. Neden "require doesn't exist" Oluyor?

Lazy bundle'da:

1. Ana bundle küçük bir loader içeriyor.
2. Gerçek modüller ayrı chunk'larda.
3. Chunk'lar yüklendiğinde kendi execution context'inde çalışıyor.
4. `require` global'de tanımlı olmalı; bu da `InitializeCore` ve `@expo/metro-runtime` ile sağlanıyor.

Projede:

- Expo Router kullanılmıyor (React Navigation var).
- `app/` → `screens/` olarak değiştirildi.
- `@react-native/metro-babel-transformer` kullanılıyor (Expo transformer değil).
- Bu kombinasyon lazy format ile tam uyumlu olmayabilir; chunk'lar `require` olmadan çalışmaya çalışıyor.

---

## 4. Mevcut Çözüm: rewriteRequestUrl

`metro.config.js` içinde `rewriteRequestUrl` ile `lazy=false` zorlanıyor:

```javascript
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
```

**Akış:**

1. Client: `GET /index.bundle?platform=ios&dev=true&lazy=true&...`
2. Metro `rewriteRequestUrl` çağırıyor.
3. `lazy` → `false` yapılıyor.
4. Metro bu URL ile bundle üretiyor; `lazy=false` ile normal (sync) format kullanılıyor.

---

## 5. Hata Devam Ediyorsa Olası Nedenler

### A. HMR (Hot Module Replacement)

- `metro/src/HmrServer.js` kendi `rewriteRequestUrl` kullanıyor.
- HMR istekleri farklı bir path'ten geçiyor olabilir.
- `rewriteRequestUrl` her iki yerde de aynı mantıkla uygulanmalı (zaten config'den geliyor).

### B. URL Formatı

- Bazı durumlarda relative vs absolute URL farkı sorun çıkarabilir.
- Girdi relative ise çıktıyı da relative tutmak daha güvenli olabilir.

### C. Metro Cache

- Eski `lazy=true` bundle cache'te kalmış olabilir.
- `npx expo start -c` veya `--clear` ile cache temizlenmeli.

### D. Client Tarafı Cache

- Native uygulama veya WebView eski bundle'ı cache'lemiş olabilir.
- Uygulama tamamen kapatılıp yeniden açılmalı.

---

## 6. Önerilen Adımlar (Yeniden Build Olmadan)

1. **Cache temizle:**
   ```bash
   npx expo start -c --dev-client --lan --scheme proparcel
   ```

2. **Rewrite'in çalıştığını doğrula:**
   - `metro.config.js` içinde geçici `console.log` ekleyip `lazy` değerini kontrol et.
   - Metro loglarında "Rewritten to:" satırını ara.

3. **URL formatını koru:**
   - Girdi relative ise çıktıyı relative döndür (pathname + search).

4. **Hata hâlâ sürüyorsa:**
   - `lazy` parametresinin gerçekten `false` olduğundan emin ol.
   - Gerekirse `patch-package` ile `RCTBundleURLProvider` içinde `lazy = NO` yapıp native patch uygula (son çare).

---

## 7. Kalıcı Çözüm (Yeniden Build Gerekir)

React Native'da `lazy=true`'yu devre dışı bırakmak için:

1. **patch-package** ile `RCTBundleURLProvider.mm` patch'le:
   ```objc
   BOOL lazy = NO;  // enableDev yerine her zaman false
   ```

2. Veya **react-native.config.js** ile custom bundle URL provider kullan (varsa).

3. Ardından `eas build` veya `npx expo prebuild` ile yeniden build al.

---

## Referanslar

- `react-native/React/Base/RCTBundleURLProvider.mm` (lazy parametresi)
- `metro/src/lib/parseBundleOptionsFromBundleRequestUrl.js` (lazy parsing)
- `metro/src/Server.js` (rewriteRequestUrl kullanımı)
- `@expo/metro-config/build/rewriteRequestUrl.js` (Expo rewrite mantığı)
