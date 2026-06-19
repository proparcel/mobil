# Gradle Build Hataları Düzeltme Planı

## 🔴 Mevcut Hatalar

### Hata 1: Plugin with id 'com.facebook.react' not found
**Dosya:** `android/app/build.gradle` line 3
**Sebep:** `com.facebook.react` plugin'i `settings.gradle`'da tanımlı değil veya yanlış yapılandırılmış.

### Hata 2: compileSdkVersion is not specified
**Dosya:** `android/app/build.gradle`
**Sebep:** `rootProject.ext.compileSdkVersion` erişimi çalışmıyor, muhtemelen `ext` bloğu değerlendirilmeden önce erişilmeye çalışılıyor.

---

## 📋 Düzeltme Adımları

### 1. `settings.gradle` Düzeltmesi (YÜKSEK ÖNCELİK)

**Sorun:** React Native 0.81 CLI için `com.facebook.react` plugin'i `settings.gradle`'da doğru şekilde tanımlanmalı.

**Çözüm:**
- `settings.gradle`'da `plugins {}` bloğuna `id("com.facebook.react")` ekle
- VEYA `app/build.gradle`'da plugin uygulamasını değiştir

**Seçenek A (Önerilen):** `settings.gradle`'ı güncelle:
```gradle
plugins {
    id("com.facebook.react.settings")
    id("com.facebook.react") version "0.81.5" apply false  // Version'ı package.json'dan al
}
```

**Seçenek B:** `app/build.gradle`'da plugin uygulamasını değiştir:
```gradle
apply from: "../../node_modules/@react-native/gradle-plugin"
apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"
```

---

### 2. `app/build.gradle` - compileSdkVersion Erişimi (YÜKSEK ÖNCELİK)

**Sorun:** `rootProject.ext.compileSdkVersion` erişimi çalışmıyor.

**Çözüm Seçenekleri:**

**Seçenek A:** `ext` değerlerini doğrudan kullan (hardcode):
```gradle
android {
    compileSdk 35
    buildToolsVersion "35.0.0"
    ndkVersion "27.0.12077987"
    defaultConfig {
        minSdkVersion 24
        targetSdkVersion 35
    }
}
```

**Seçenek B:** `rootProject.ext` erişimini düzelt - `afterEvaluate` kullan:
```gradle
afterEvaluate {
    android {
        compileSdk rootProject.ext.compileSdkVersion
        buildToolsVersion rootProject.ext.buildToolsVersion
        // ...
    }
}
```

**Seçenek C (Önerilen):** `ext` bloğunu `build.gradle`'ın en üstüne taşı ve `app/build.gradle`'da doğrudan eriş:
```gradle
// android/build.gradle - ext bloğu buildscript'ten ÖNCE olmalı
ext {
    buildToolsVersion = "35.0.0"
    minSdkVersion = 24
    compileSdkVersion = 35
    targetSdkVersion = 35
    ndkVersion = "27.0.12077987"
    kotlinVersion = "2.1.0"
}

buildscript {
    ext.kotlinVersion = "2.1.0"  // buildscript için ayrı
    // ...
}
```

---

### 3. `build.gradle` Yapılandırması Kontrolü (ORTA ÖNCELİK)

**Kontrol Listesi:**
- [ ] `ext` bloğu `buildscript` dışında mı?
- [ ] `ext` bloğu `allprojects`'ten önce mi?
- [ ] `kotlinVersion` hem `buildscript` hem `ext`'te tanımlı mı?
- [ ] `repositories` bloğu doğru mu?

---

### 4. React Native Gradle Plugin Versiyonu (ORTA ÖNCELİK)

**Kontrol:**
- `package.json`'da `react-native: "0.81.5"` var mı?
- `settings.gradle`'da plugin versiyonu eşleşiyor mu?

**Çözüm:**
- Plugin versiyonunu `package.json`'dan dinamik olarak al:
```gradle
def reactNativeVersion = new File(["node", "--print", "require('react-native/package.json').version"].execute(null, rootDir).text.trim())
```

---

### 5. Test ve Doğrulama (YÜKSEK ÖNCELİK)

**Adımlar:**
1. `cd android && gradlew.bat clean`
2. `cd .. && npm run android`
3. Hataları kontrol et
4. Gerekirse `--stacktrace` ile detaylı log al

---

## 🎯 Öncelik Sırası

1. **YÜKSEK ÖNCELİK:** `settings.gradle` - `com.facebook.react` plugin tanımı
2. **YÜKSEK ÖNCELİK:** `app/build.gradle` - `compileSdkVersion` erişimi
3. **ORTA ÖNCELİK:** `build.gradle` - `ext` bloğu sıralaması
4. **ORTA ÖNCELİK:** Plugin versiyonu kontrolü
5. **DÜŞÜK ÖNCELİK:** Test ve optimizasyon

---

## 📝 Notlar

- React Native 0.81 CLI, `@react-native/gradle-plugin` kullanır
- Plugin `settings.gradle`'da `includeBuild` ile dahil edilir
- `com.facebook.react` plugin'i `app/build.gradle`'da uygulanır
- `ext` bloğu tüm alt projeler tarafından erişilebilir olmalı

---

## 🔧 Önerilen Çözüm (En Güvenli)

1. `settings.gradle`'a `id("com.facebook.react")` ekle (version ile)
2. `app/build.gradle`'da `compileSdkVersion`'ı hardcode et (geçici)
3. Build testi yap
4. Çalışırsa, `ext` erişimini düzelt
5. Tekrar test et
