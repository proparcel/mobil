# React Native CLI Setup Instructions

## 1. Paketleri Yükle

Windows'ta `yarn` yüklü değilse `npm` kullanın:

```bash
npm install --legacy-peer-deps
```

**Not:** `--legacy-peer-deps` flag'i React 19 ile bazı paketlerin peer dependency uyarılarını görmezden gelir. Bu güvenlidir.

veya yarn yüklüyse:

```bash
yarn install
```

## 2. Android için Native Modülleri Linkle

Windows'ta `gradlew.bat` kullanın:

```bash
cd android
gradlew.bat clean
cd ..
```

## 3. Uygulamayı Çalıştır

```bash
npm run android
```

veya

```bash
npx react-native run-android
```

## 4. react-native-vector-icons Kurulumu

### Android

`android/app/build.gradle` dosyasına ekleyin (en üste):

```gradle
apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"
```

### iOS

`ios/Info.plist` dosyasına ekleyin (otomatik olabilir, kontrol edin):

```xml
<key>UIAppFonts</key>
<array>
  <string>AntDesign.ttf</string>
  <string>Entypo.ttf</string>
  <string>EvilIcons.ttf</string>
  <string>Feather.ttf</string>
  <string>FontAwesome.ttf</string>
  <string>FontAwesome5_Brands.ttf</string>
  <string>FontAwesome5_Regular.ttf</string>
  <string>FontAwesome5_Solid.ttf</string>
  <string>Foundation.ttf</string>
  <string>Ionicons.ttf</string>
  <string>MaterialIcons.ttf</string>
  <string>MaterialCommunityIcons.ttf</string>
  <string>SimpleLineIcons.ttf</string>
  <string>Octicons.ttf</string>
  <string>Zocial.ttf</string>
  <string>Fontisto.ttf</string>
</array>
```

## 5. Metro Bundler'ı Başlat

Ayrı bir terminal'de:

```bash
npm start
```

veya

```bash
npx react-native start
```

## Sorun Giderme

### "yarn is not recognized"
- `npm` kullanın veya yarn'ı yükleyin: `npm install -g yarn`

### "@react-native-community/cli" hatası
- `npm install` çalıştırın (package.json'a eklendi)

### "gradlew" hatası (Windows)
- `gradlew.bat` kullanın: `gradlew.bat clean`

### Native modül linkleme sorunları
- `cd android && gradlew.bat clean && cd ..`
- `npm install` tekrar çalıştırın
- `npm run android` tekrar deneyin
