# Android Network Hatası Düzeltmesi

## Sorun
Telefonda "network hatası" alınıyor çünkü Android 9+ (API 28+) varsayılan olarak HTTP (cleartext) trafiğini engelliyor.

## Çözüm
AndroidManifest.xml'e `android:usesCleartextTraffic="true"` eklendi.

## Yapılan Değişiklikler

1. **AndroidManifest.xml** güncellendi
2. **app.config.js** güncellendi (gelecekteki prebuild'ler için)

## Yeni APK Build Etme

Değişiklikler yapıldıktan sonra **YENİ BİR APK BUILD ETMENİZ GEREKİYOR**:

```bash
cd c:\ProParcel\mobile\mobil_github\frontend
npx expo run:android --variant release
```

Veya batch dosyası ile:
```bash
cd c:\ProParcel\mobile\mobil_github\frontend
build_apk.bat
```

## Notlar

- Bu ayar HTTP trafiğine izin verir (güvenlik açısından ideal değil ama geliştirme için gerekli)
- Production'da HTTPS kullanmayı düşünün
- Eski APK'yı silip yeni APK'yı yükleyin
