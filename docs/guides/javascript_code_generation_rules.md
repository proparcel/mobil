# JavaScript Kod Üretimi Kuralları ve En İyi Pratikler

## Genel Bakış

Bu doküman, özellikle WebView'e enjekte edilen dinamik JavaScript kodlarının üretimi için kritik kuralları ve en iyi pratikleri içerir. HTML içinde 4.600+ satırlık script üretimi gibi senaryolarda bu kurallara uyulması zorunludur.

## 0. Kod Stili Kuralları (Zorunlu)

### Tırnak Kullanımı

**KURAL:** JavaScript ve TypeScript kodlarında tek tırnak (`'`) kullanılmayacak, çift tırnak (`"`) kullanılacaktır.

- Tüm string değerler çift tırnak ile yazılmalıdır
- Template literal'lar (backtick) kullanıldığında içindeki string'ler de çift tırnak kullanmalıdır
- JSON.stringify ve benzeri fonksiyonlarda üretilen string'ler çift tırnak kullanmalıdır

**Örnekler:**

```typescript
// ❌ YANLIŞ
const message = 'Hello World';
const data = { name: 'John', age: 30 };
const script = `const value = 'test';`;

// ✅ DOĞRU
const message = "Hello World";
const data = { name: "John", age: 30 };
const script = `const value = "test";`;
```

**Amaç:**
- Kod tutarlılığını sağlamak
- Kod okunabilirliğini artırmak
- Proje genelinde standart bir stil kullanmak

## 1. Parse Validator Kullanımı (Zorunlu)

### Neden Gerekli?

WebView'e göndermeden önce parse doğrulaması (validator), "parse edilen (string) JS" dünyasında en pratik ve en düşük maliyetli savunma hattıdır. Tek başına yeterli değil, ama "IDE dışı / string üretilen JS" kaynaklı hataların %80'ini çok hızlı teşhis eder ve sahte satır numarası probleminden kurtarır.

### Senaryo

- HTML içinde 4.600 satırlık script üretiyorsunuz
- Hata satırı "const safeProperties = {" gibi masum bir satırda çıkıyor
- Metro cache temizliği hiçbir şey değiştirmiyor

Bu, %99 ihtimalle WebView'e enjekte edilen JS string'i parse olurken patlıyor demektir.

### Uygulama

```typescript
function validateJS(moduleName: string, jsCode: string): void {
  if (__DEV__) {
    try {
      new Function(jsCode);
    } catch (error) {
      const message = `[${moduleName}] Parse Error: ${error.message}`;
      console.error(message);
      throw new Error(message);
    }
  }
}

// Kullanım
validateJS("HandlersScript", handlersScript);
validateJS("InitScript", initScript);
```

### Avantajlar

- Hatayı "gerçek message + line/col" ile verir
- "Nereye bakacağım" belirsizliğini bitirir
- Debug süresini dramatik düşürür

### Öneri

- **DEV'de zorunlu:** Parse validator her zaman aktif olmalı
- **PROD'da kapalı veya örnekleme:** Performans için `__DEV__` koşulu ile sarın

## 2. Modüler Script Yapısı (Kaynak Ayrıştırma)

### Problem

Tek dev HTML yerine modüler script blokları kullanılmalı. Şu an tek parça "Init Script" + "Handlers Script" basıyorsunuz.

### Dosya Satır Limit Kuralı (Zorunlu)

**KURAL:** JavaScript kodları içeren parse dosyaları veya sadece JavaScript kodları içeren dosyalar **200 satırı geçmeyecektir**.

- Bir satır bile geçse, yeni dosya oluşturularak modüler yapı uygulanacaktır
- Dosyalar mantıksal sorumluluklarına göre bölünecektir
- Her modül kendi dosyasında olacak ve maksimum 200 satır limitine uyacaktır

**Örnekler:**
- `handlers-map.ts` → 200 satırı geçiyorsa → `handlers-map-core.ts` + `handlers-map-utils.ts` şeklinde bölünür
- `init.ts` → 200 satırı geçiyorsa → `init-core.ts` + `init-config.ts` + `init-bridge.ts` şeklinde bölünür
- `handlers-shapes.ts` → 200 satırı geçiyorsa → `handlers-shapes-core.ts` + `handlers-shapes-helpers.ts` şeklinde bölünür

### Çözüm: Modüler Yapı

Script'leri sorumluluklarına göre bölün ve 200 satır limitine uyun:

- `init.ts` → string olarak üretilse bile tek sorumluluk (max 200 satır)
- `handlers.map.ts` (max 200 satır)
- `handlers.shapes.ts` (max 200 satır)
- `helpers.postMessage.ts` (max 200 satır)
- `helpers.safeSerialize.ts` (max 200 satır)

### HTML İçinde Kullanım

Tek dev script yerine birkaç `<script>` bloğu veya tek script içinde bölümlere ayrılmış stringler:

```html
<script>
  // Init Module
  ${initScript}
</script>
<script>
  // Handlers Module - Map
  ${handlersMapScript}
</script>
<script>
  // Handlers Module - Shapes
  ${handlersShapesScript}
</script>
```

### Avantajlar

- Validator hangi modülde patladığını netleştirir
- Hata ayıklama kolaylaşır
- Kod organizasyonu iyileşir

## 3. Runtime Error Bridge (Zorunlu)

### Neden Gerekli?

Parse geçse bile runtime'da (undefined, type error) patlayabilir. WebView'den React Native'e stack'li error taşımanız şart.

### Uygulama

```javascript
// WebView içinde
window.onerror = function(message, source, lineno, colno, error) {
  window.ReactNativeWebView?.postMessage(JSON.stringify({
    type: 'error',
    message: message,
    source: source,
    line: lineno,
    column: colno,
    stack: error?.stack
  }));
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  window.ReactNativeWebView?.postMessage(JSON.stringify({
    type: 'unhandledRejection',
    reason: event.reason?.toString(),
    stack: event.reason?.stack
  }));
});

// console.error yakalama
const originalConsoleError = console.error;
console.error = function(...args) {
  originalConsoleError.apply(console, args);
  window.ReactNativeWebView?.postMessage(JSON.stringify({
    type: 'consoleError',
    args: args.map(arg => String(arg))
  }));
};
```

### React Native Tarafı

```typescript
const handleWebViewMessage = (event: WebViewMessageEvent) => {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'error' || data.type === 'consoleError' || data.type === 'unhandledRejection') {
      console.error('[WebView Error]', data);
      // Hata yönetimi
    }
  } catch (e) {
    // Parse hatası
  }
};
```

## 4. String JS Yerine Alternatifler (En İyi Pratik)

### Seçenek 1: WebView İçinde Bundled Static JS (En Sağlam)

**Yaklaşım:**

WebView HTML'niz sabit bir "shell" olur. İş mantığı JS'i ayrı bir dosya olarak bundle edilir (metro/webpack/rollup). React Native yalnızca "config/data" gönderir (postMessage), script string'i göndermez.

**Uygulama:**

```
assets/webview/index.html
assets/webview/app.js (bundle)
```

React Native:
```typescript
source={{ uri: 'file:///android_asset/webview/index.html' }}
```

**Kazançlar:**

- ✅ IDE lint + TypeScript + build-time syntax kontrolü
- ✅ Source map ile gerçek stack
- ✅ `</script>` kapanması, backtick, `${}` gibi string-kaynaklı tuzaklar biter

### Seçenek 2: JSON Komut Protokolü (En Güvenli)

**Yaklaşım:**

React Native tarafı JS kodu göndermesin. Şöyle mesajlar göndersin:

```typescript
// React Native tarafı
webViewRef.current?.postMessage(JSON.stringify({
  type: "add-shape",
  payload: { id: 123, coordinates: [...] }
}));

webViewRef.current?.postMessage(JSON.stringify({
  type: "delete-shape",
  id: 123
}));

webViewRef.current?.postMessage(JSON.stringify({
  type: "set-camera",
  lon: 35.1,
  lat: 39.2,
  zoom: 15
}));
```

WebView tarafında switch/case ile handler'lar çalışır:

```javascript
window.addEventListener('message', function(event) {
  const command = JSON.parse(event.data);
  switch (command.type) {
    case 'add-shape':
      addShape(command.payload);
      break;
    case 'delete-shape':
      deleteShape(command.id);
      break;
    case 'set-camera':
      setCamera(command);
      break;
  }
});
```

**Kazançlar:**

- ✅ String code injection yok, sadece data var
- ✅ Güvenlik riski minimize edilir
- ✅ Type-safe iletişim mümkün

### Seçenek 3: Template Hygiene (String Zorunluysa)

Mecburen string üretecekseniz:

**Kurallar:**

1. **JSON.stringify ile gömün:** Script içine girecek her dinamik parçayı JSON.stringify ile gömün
2. **`</script>` kaçışı:** `<\\/script>` kullanın
3. **Sanitize edin:** `${` ve backtick içeren metinleri sanitize edin
4. **Raw concatenation yok:** Asla "raw concatenation" ile `key: ${maybeEmpty}` gibi parçalar üretmeyin

**Örnek:**

```typescript
// ❌ YANLIŞ
const script = `
  const data = ${maybeUndefined};
  const html = \`<div>${userInput}</div>\`;
`;

// ✅ DOĞRU
const script = `
  const data = ${JSON.stringify(maybeUndefined)};
  const html = \`<div>${escapeTemplateLiteral(userInput)}</div>\`;
`;

function escapeTemplateLiteral(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');
}
```

## 5. Hemen Şimdi Yapılacak Minimum Set

### (1) DEV Parse Validator ✅

```typescript
function validateJS(moduleName: string, jsCode: string): void {
  if (__DEV__) {
    try {
      new Function(jsCode);
    } catch (error) {
      throw new Error(`[${moduleName}] Parse Error: ${error.message}`);
    }
  }
}

// Kullanım
validateJS("HandlersScript", handlersScript);
```

**Patlarsa WebView'e hiç göndermeyin (fail-fast).**

### (2) WebView Error Bridge ✅

```javascript
window.onerror = function(message, source, lineno, colno, error) {
  window.ReactNativeWebView?.postMessage(JSON.stringify({
    type: 'error',
    message, source, line: lineno, column: colno, stack: error?.stack
  }));
};
```

### (3) Handlers Script'i 2-3 Modüle Bölün ✅

- `handlers-shapes.ts`
- `handlers-map.ts`
- `helpers.ts`

**Bu üçlü ile "syntax bulamıyorum" dönemi biter.**

## 6. Performans ve Güvenlik Notları

### Performans

- `new Function` çalıştırmaz, sadece parse eder; yine de DEV'de tutmanız daha doğru
- PROD'da kapatın veya `__DEV__` koşulu ile sarın

### Güvenlik

- HTML/JS injection riskini azaltmak için data-only messaging yaklaşımı (Seçenek 2) en güvenlisidir
- String üretiminde mutlaka sanitization yapın
- Kullanıcı girdilerini asla doğrudan script'e gömme

## 7. Proje Bağlamında Öneriler

### Kısa Vadede

- ✅ Validator + error bridge + modüler bölme
- ✅ Parse validator'ı DEV'de zorunlu yapın
- ✅ Error bridge'i ekleyin
- ✅ Handlers script'ini modüllere bölün

### Orta Vadede

- 📋 "Static asset + bundled JS" modeline geçin (string üretimini minimize edin)
- 📋 WebView içinde static JS bundle kullanın
- 📋 React Native sadece config/data göndersin

### Uzun Vadede

- 🎯 React Native ↔ WebView iletişimini tamamen JSON komut protokolüne çevirin (script string yok)
- 🎯 Type-safe komut protokolü oluşturun
- 🎯 String üretimini tamamen kaldırın

## 8. Örnek Implementasyon

### Parse Validator Utility

```typescript
// utils/cesiumModelViewer/cesiumModelViewer-utils.ts

export function validateJS(moduleName: string, jsCode: string): void {
  if (__DEV__) {
    try {
      new Function(jsCode);
    } catch (error: any) {
      const message = `[${moduleName}] Parse Error: ${error.message}`;
      console.error(message);
      console.error('Failed code snippet:', jsCode.substring(0, 500));
      throw new Error(message);
    }
  }
}
```

### Modüler Script Bölme

```typescript
// utils/cesiumModelViewer/buildHandlersScript.ts

export function buildHandlersScript(): string {
  const handlersMap = buildHandlersMapScript();
  const handlersShapes = buildHandlersShapesScript();
  const helpers = buildHelpersScript();
  
  if (__DEV__) {
    validateJS("HandlersMap", handlersMap);
    validateJS("HandlersShapes", handlersShapes);
    validateJS("Helpers", helpers);
  }
  
  return `
    // === Handlers Map Module ===
    ${handlersMap}
    
    // === Handlers Shapes Module ===
    ${handlersShapes}
    
    // === Helpers Module ===
    ${helpers}
  `;
}
```

### Error Bridge Setup

```typescript
// utils/cesiumModelViewer/cesiumModelViewer-init.ts

export function setupErrorBridge(): string {
  return `
    window.onerror = function(message, source, lineno, colno, error) {
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'error',
        message: message,
        source: source,
        line: lineno,
        column: colno,
        stack: error?.stack
      }));
      return false;
    };
    
    window.addEventListener('unhandledrejection', function(event) {
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'unhandledRejection',
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      }));
    });
  `;
}
```

## 9. Checklist

JavaScript kod üretimi yaparken bu checklist'i takip edin:

- [ ] Parse validator kullanıldı mı? (DEV'de zorunlu)
- [ ] Error bridge eklendi mi? (window.onerror + unhandledrejection)
- [ ] Script modüllere bölündü mü? (init, handlers-map, handlers-shapes, helpers)
- [ ] **Her dosya 200 satır limitine uyuyor mu?** (1 satır bile geçse yeni dosya oluşturulmalı)
- [ ] Dinamik değerler JSON.stringify ile gömüldü mü?
- [ ] Template literal kaçışları yapıldı mı? (`</script>`, backtick, `${}`)
- [ ] PROD'da validator kapalı mı veya `__DEV__` koşulu var mı?
- [ ] Console.error yakalama eklendi mi?
- [ ] React Native tarafında error handling var mı?

## 10. Referanslar

- Ana geliştirme kuralları: `docs/development-rules.md`
- Ana mimari dokümantasyon: `docs/architecture.md`
