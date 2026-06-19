# Jetifier Java Heap Space Hatası Çözümü

## 🔴 Sorun

Build sırasında `Java heap space` hatası alınıyordu. Jetifier, React Native 0.81.5'in `react-android-0.81.5-debug.aar` dosyasını dönüştürmeye çalışırken bellek tükeniyordu.

**Neden?** React Native 0.81.5 zaten tamamen AndroidX kullanıyor. Jetifier'ın bu paketi dönüştürmeye çalışması gereksiz ve bellek sorununa yol açıyor.

## ✅ Çözümler

### 1. `local.properties` - NDK Deprecated Uyarısı

**Değişiklik:**
```properties
# ÖNCE:
ndk.dir=C:\\Android\\Sdk\\ndk\\27.0.12077973

# SONRA:
# ndk.dir deprecated - NDK versiyonu build.gradle'da android.ndkVersion ile belirtiliyor
```

**Açıklama:** `ndk.dir` deprecated. NDK versiyonu artık `build.gradle`'daki `android.ndkVersion` ile belirtiliyor (zaten ayarlı: `27.0.12077973`).

### 2. `gradle.properties` - Java Heap Space Artırma

**Değişiklik:**
```properties
# ÖNCE:
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m

# SONRA:
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError
```

**Açıklama:** 
- Heap space 2GB'dan 4GB'a çıkarıldı
- Metaspace 512MB'dan 1GB'a çıkarıldı
- OutOfMemoryError durumunda heap dump alınacak (debug için)

### 3. `gradle.properties` - Jetifier Ignore List

**Eklenen:**
```properties
# React Native paketlerini Jetifier'dan hariç tut (zaten AndroidX kullanıyorlar, dönüştürmeye gerek yok)
# Bu, Java heap space hatalarını önler çünkü büyük AAR dosyalarını gereksiz yere dönüştürmeye çalışmaz
android.jetifier.ignorelist=react-android,hermes-android,react-native
```

**Açıklama:** 
- `react-android`: React Native'in ana Android paketi (zaten AndroidX)
- `hermes-android`: Hermes JS engine (zaten AndroidX)
- `react-native`: Genel React Native paketleri

Bu paketler Jetifier tarafından dönüştürülmeyecek, bu da:
- ✅ Bellek kullanımını azaltır
- ✅ Build süresini kısaltır
- ✅ Java heap space hatalarını önler

## 🎯 Sonuç

- ✅ NDK deprecated uyarıları giderildi
- ✅ Java heap space 4GB'a çıkarıldı
- ✅ React Native paketleri Jetifier'dan hariç tutuldu
- ✅ Build başarılı olmalı

## 📝 Notlar

1. **Jetifier Neden Gerekli?** 
   - Bazı eski third-party paketler hala Support Library kullanıyor olabilir
   - Jetifier bunları otomatik olarak AndroidX'e dönüştürür
   - Ancak React Native paketleri zaten AndroidX kullandığı için dönüştürmeye gerek yok

2. **NDK Versiyonu:**
   - `build.gradle`'da `ndkVersion = "27.0.12077973"` ayarlı
   - `app/build.gradle`'da `ndkVersion ndkVersionValue` ile kullanılıyor
   - `local.properties`'teki `ndk.dir` artık gerekli değil

3. **Bellek Ayarları:**
   - 4GB heap space büyük projeler için yeterli
   - Eğer hala sorun yaşarsanız, 6GB veya 8GB'a çıkarabilirsiniz
   - Ancak sisteminizde yeterli RAM olmalı

## 🧪 Test

Build'i test etmek için:
```bash
cd android
gradlew.bat clean
gradlew.bat assembleDebug
```

Eğer hala heap space hatası alırsanız:
1. `gradle.properties`'te heap space'i daha da artırın
2. `android.jetifier.ignorelist`'e daha fazla paket ekleyin
3. Gradle cache'i temizleyin: `gradlew.bat clean --refresh-dependencies`
