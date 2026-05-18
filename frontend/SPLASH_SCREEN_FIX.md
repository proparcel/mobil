# Splash Screen Build Hatası Çözümü

## 🔴 Sorun

Build sırasında şu hatalar alınıyordu:
```
error: resource style/Theme.SplashScreen not found
error: style attribute 'attr/windowSplashScreenBackground' not found
error: style attribute 'attr/windowSplashScreenAnimatedIcon' not found
error: style attribute 'attr/postSplashScreenTheme' not found
```

## 🔍 Neden?

`styles.xml` dosyasında `Theme.SplashScreen` kullanılıyor:
```xml
<style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/splashscreen_background</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
    <item name="postSplashScreenTheme">@style/AppTheme</item>
</style>
```

Ancak `androidx.core:core-splashscreen` bağımlılığı eksikti. Bu bağımlılık Android 12+ (API 31+) Splash Screen API'sini sağlar.

## ✅ Çözüm

`android/app/build.gradle` dosyasına AndroidX Splash Screen bağımlılığı eklendi:

```gradle
dependencies {
    // ... diğer bağımlılıklar ...
    
    // AndroidX Splash Screen API (react-native-splash-screen için gerekli)
    implementation("androidx.core:core-splashscreen:1.0.1")
}
```

## 📝 Detaylar

### Kullanılan Paket
- `react-native-splash-screen: ^3.3.0` - React Native için splash screen paketi

### AndroidX Splash Screen
- **Paket:** `androidx.core:core-splashscreen`
- **Versiyon:** `1.0.1` (güncel ve stabil)
- **API Seviyesi:** Android 12+ (API 31+) için native splash screen desteği

### styles.xml Yapılandırması
```xml
<style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/splashscreen_background</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
    <item name="postSplashScreenTheme">@style/AppTheme</item>
    <item name="android:windowSplashScreenBehavior">icon_preferred</item>
</style>
```

## 🎯 Sonuç

- ✅ `androidx.core:core-splashscreen:1.0.1` bağımlılığı eklendi
- ✅ `Theme.SplashScreen` artık bulunabilir
- ✅ Splash screen özellikleri çalışmalı
- ✅ Build başarılı olmalı

## 🧪 Test

```powershell
cd c:\ProParcel\mobile\mobil_github\frontend\android
gradlew.bat clean
cd ..
npm run android
```

Build başarılı olmalı ve splash screen hatası çözülmüş olmalı.

## 📚 Referanslar

- [AndroidX Splash Screen](https://developer.android.com/develop/ui/views/launch/splash-screen)
- [react-native-splash-screen](https://github.com/crazycodeboy/react-native-splash-screen)
