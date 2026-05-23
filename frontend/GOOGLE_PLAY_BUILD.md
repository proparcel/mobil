# ProParcel – Google Play için Android Derleme Rehberi

Bu rehber, ProParcel uygulamasını **Android App Bundle (AAB)** formatında derleyip **Google Play**'e yüklemeniz için adımları açıklar.

---

## 1. Gereksinimler

- **Node.js** ve **Yarn** (veya npm) yüklü
- **JDK 17** (Android Gradle için)
- **Android SDK** (ANDROID_HOME ayarlı)
- Proje bağımlılıkları yüklü: `yarn` veya `npm install`
- **`android/` klasörü** (gitignore'da): `android\gradlew.bat` yoksa önce `npm run prebuild:android` veya geliştirme makinenizdeki tam `android\` kopyası gerekir

---

## 2. Release keystore oluşturma

Google Play'e yükleyeceğiniz AAB'yi **release keystore** ile imzalamanız gerekir. Bu keystore'u **bir kez** oluşturup güvenli yerde saklayın; kaybederseniz uygulama güncellemesi yapılamaz.

### 2.1 Keystore oluşturma komutu

Proje kökünden (frontend klasörü) PowerShell veya CMD:

```bash
mkdir android\keystores 2>nul
keytool -genkeypair -v -storetype PKCS12 -keystore android\keystores\proparcel-release.keystore -alias proparcel -keyalg RSA -keysize 2048 -validity 10000
```

`-validity 10000` yaklaşık 27 yıl geçerlilik sağlar.

Keytool sizden şunları isteyecek:

- **Keystore şifresi**: Güçlü bir şifre seçin, `keystore.properties` içinde kullanacaksınız.
- **Key şifresi**: Genelde aynı şifreyi verirsiniz.
- **Ad, birim, kuruluş, şehir, ülke**: Uygulama sahibi bilgileri (ör. ProParcel, Türkiye).

### 2.2 `keystore.properties` ayarlama

1. `android\app\keystore.properties.example` dosyasını kopyalayıp `android\app\keystore.properties` olarak kaydedin.
2. İçeriği kendi keystore bilgilerinizle doldurun:

```properties
storeFile=../keystores/proparcel-release.keystore
storePassword=GÜÇLÜ_ŞİFRENİZ
keyAlias=proparcel
keyPassword=GÜÇLÜ_ŞİFRENİZ
```

- `keystore.properties` ve `*.keystore` dosyalarını **asla** Git'e eklemeyin (`.gitignore`'da zaten var).

---

## 3. Asset pack'ler ve 3D modeller

3D modeller (.glb) **ana uygulamaya gömülmez**; **Play Asset Delivery (PAD)** ile ayrı pack'ler olarak dağıtılır. Tek AAB yüklediğinizde base APK + tüm model pack'leri Play Store üzerinden kullanıcıya sunulur; ayrı bir "pack yükleme" adımı yok.

### Build öncesi script sırası (zorunlu)

1. **İsteğe bağlı:** Backend'den güncel model listesi  
   `npm run gen:model-packs-manifest`  
   → `assets/packs/models_manifest.json` güncellenir.

2. **Zorunlu:** Asset pack'lere .glb dosyalarını yaz (veya backend'den indir)  
   `npm run gen:android-asset-packs`  
   → Her `android/asset-packs/pp_model_X/src/main/assets/models/model_X.glb` oluşturulur.  
   Bu adım atlanırsa AAB'de model pack'leri boş veya hatalı olur.

3. AAB derleme (aşağıdaki bölüm).

### Neden pack'te?

- Base APK boyutunu küçük tutar; kullanıcı yalnızca ihtiyaç duyduğu modelleri (fast-follow / on-demand) indirir.
- Ana uygulama `android/app/src/main` altında **assets** ile .glb içermez; modeller sadece `asset-packs/pp_model_X/...` içindedir.

**Özet:** Modeller AAB içinde pack olarak gider; tek AAB yüklemesi yeterlidir.

---

## 3b. İlk yayın: modeller olmadan AAB (önerilen başlangıç)

Google Play **AAB** formatı zorunludur (düz APK yeni uygulamalarda genelde kabul edilmez). İlk sürümde 3D model pack'lerini dahil etmeden küçük bir base bundle yükleyebilirsiniz.

### Ne olur?

- **Parsel sorgu, harita, kredi, giriş** vb. çalışır.
- **3D şekil editöründeki ev/araba/ağaç** modelleri bu sürümde **çalışmaz** (PAD pack yok; `ensureModelAvailable` başarısız olur).
- Sonraki sürümde `build_google_play.bat` ile pack'li AAB yükleyerek modelleri ekleyebilirsiniz.

### Build (modeller yok)

```bash
build_google_play_no_models.bat
```

veya:

```bash
npm run build:bundle:no-models
```

Script sırası:

1. `npm run clear:android-asset-packs` — `ppAssetPacks` listesini boşaltır, pack içi `.glb` dosyalarını siler.
2. `gradlew bundleRelease` — imzalı AAB üretir.

Çıktı: `release_builds\ProParcel-1.0.1-no-models-*.aab` ve `android\app\build\outputs\bundle\release\app-release.aab`.

### Test APK (Play dışı, sideload)

```bash
build_apk_no_models.bat
# veya
npm run build:apk:no-models
```

Çıktı: `apk_releases\ProParcel-no-models.apk`.

### Pack'leri geri yüklemek (sonraki sürüm)

```bash
npm run gen:android-asset-packs
build_google_play.bat
```

`versionCode` değerini her Play yüklemesinde +1 artırın.

---

## 4. AAB derleme (3D modeller dahil)

### Yöntem A: Batch script (önerilen)

```bash
build_google_play.bat
```

Script:

- (İsteğe bağlı) `gen:model-packs-manifest` çalıştırır.
- **Zorunlu** `gen:android-asset-packs` çalıştırır; hata varsa durur.
- `bundleRelease` ile AAB üretir.
- Çıktıyı `release_builds\ProParcel-1.0.0-YYYYMMDD-HHMMSS.aab` altına kopyalar.

### Yöntem B: Gradle doğrudan

Önce asset pack'leri doldurun, sonra:

```bash
npm run gen:android-asset-packs
cd android
gradlew.bat bundleRelease
cd ..
```

AAB yolu:

```
android\app\build\outputs\bundle\release\app-release.aab
```

### Yöntem C: npm/yarn script

```bash
npm run gen:android-asset-packs
yarn build:bundle
# veya
npm run build:bundle
```

(`package.json`'da `build:bundle` tanımlıysa.)

---

## 5. Sürüm (version) güncelleme

Her yeni Play Console sürümünde **versionCode** artırılmalı.  
`android/app/build.gradle` içinde:

```groovy
defaultConfig {
    versionCode 2        // Her yayında +1 artırın
    versionName "1.0.1"  // Kullanıcıya görünen sürüm (örn. 1.0.1, 1.1.0)
}
```

---

## 6. Google Play Console'a yükleme

1. [Google Play Console](https://play.google.com/console) → Giriş.
2. **Uygulama oluştur** (henüz yoksa) veya mevcut ProParcel uygulamasını seçin.
3. **Release** → önce **Internal testing** (önerilen), sonra Production → **Create new release**.
4. **App bundle** alanına AAB dosyasını yükleyin (`release_builds\ProParcel-*-no-models-*.aab` veya `app-release.aab`). **APK değil, AAB** kullanın.
5. **Release name** ve **Release notes** girin, ardından **Review release** → **Start rollout**.

### İlk yayın checklist (Play Console)

| Madde | Not |
|--------|-----|
| **AAB + Play App Signing** | Upload key keystore'unuzu yedekleyin |
| **Internal testing** | İlk doğrulama için Production yerine |
| **Store listing** | Ad, açıklama, ikon, telefon ekran görüntüleri |
| **Gizlilik politikası URL** | Konum, kişiler (`READ_CONTACTS`), medya izinleri |
| **İçerik derecelendirmesi** | Anket tamamlanmalı |
| **Hedef kitle / Veri güvenliği** | Toplanan verileri beyan edin |
| **targetSdk** | Projede 36 (`android/app/build.gradle`) |
| **64-bit** | `arm64-v8a` dahil (`gradle.properties`) |
| **Mapbox** | `MAPBOX_DOWNLOADS_TOKEN` (build), `EXPO_PUBLIC_MAPBOX_TOKEN` (runtime) |
| **versionCode** | Her yüklemede +1 |

İlk yayın öncesi tamamlanması gerekenler:

- **Store listing**: Uygulama adı, kısa uzun açıklama, ekran görüntüleri, ikon vb.
- **İçerik derecelendirmesi**: Anketi doldurup derece alın.
- **Gizlilik politikası**: URL zorunlu (uygulama veri topluyorsa).
- **Hedef kitle ve içerik**: Yaş grubu, reklam kullanımı vb.

---

## 7. Play App Signing

Play Console'da **Play App Signing** açıksa (yeni uygulamalarda varsayılan):

- Siz **upload key** (kendi release keystore'unuz) ile imzalarsınız.
- Google, yayın için kendi **app signing key** ile tekrar imzalar.
- İlk kez AAB yüklediğinizde gerekirse **upload key** sertifikanızı (ör. PEM) Play Console'a yüklersiniz; talimatlar ekranda çıkar.

---

## 8. Yerelde modellerle çalıştırma (debug)

Google Play'den pack indirilmediği için **yerel/debug** build'de 3D modelleri görmek için modeller **uygulama içine gömülür** (sadece debug APK'da).

### Tek komut (önerilen)

```bash
npm run android:local
```

Bu komut sırayla:

1. `gen:android-asset-packs` – asset pack'lere .glb yazar
2. `gen:debug-assets-models` – pack'teki .glb'leri `android/app/src/debug/assets/models/` altına kopyalar
3. `react-native run-android` – debug APK'yı derleyip cihaza/emülatöre kurar

### Adım adım

```bash
npm run gen:android-asset-packs
npm run gen:debug-assets-models
npm run android
```

- **Araba (ve diğer modeller)** bu build'de pack indirmeden çizilir; istekler `https://pp-local/models/model_X.glb` üzerinden uygulama içi asset'ten sunulur.
- Release / Play AAB'de modeller yine pack ile dağıtılır; bu gömme sadece **debug** build içindir.

---

## 9. Özet komutlar

| Amaç | Komut |
|------|--------|
| **Google Play AAB (modeller yok)** | `build_google_play_no_models.bat` veya `npm run build:bundle:no-models` |
| **Test APK (modeller yok)** | `build_apk_no_models.bat` veya `npm run build:apk:no-models` |
| Asset pack'leri temizle | `npm run clear:android-asset-packs` |
| **Yerelde modellerle çalıştır** | `npm run android:local` |
| Keystore oluştur | `keytool -genkeypair -v -storetype PKCS12 -keystore android\keystores\proparcel-release.keystore -alias proparcel -keyalg RSA -keysize 2048 -validity 10000` |
| `keystore.properties` | `android\app\keystore.properties.example` → `keystore.properties` kopyala ve düzenle |
| Asset pack'leri doldur | `npm run gen:android-asset-packs` |
| Debug asset'lere kopyala | `npm run gen:debug-assets-models` |
| AAB derle (modeller dahil) | `build_google_play.bat` veya `npm run gen:android-asset-packs` ardından `cd android && gradlew.bat bundleRelease` |
| AAB konumu | `release_builds\ProParcel-*.aab` veya `android\app\build\outputs\bundle\release\app-release.aab` |

---

## 10. Olası sorunlar

- **`keystore.properties` bulunamıyor**: Dosyanın `android\app\keystore.properties` yolunda olduğundan emin olun.
- **Gradle / NDK hataları**: `android\gradle.properties` içinde `ndkVersion` ve `reactNativeArchitectures` değerlerini kontrol edin; gerekirse Android SDK/NDK sürümünü güncelleyin.
- **Mapbox token**: Harita kullanıyorsanız `MAPBOX_DOWNLOADS_TOKEN` veya proje içi Mapbox ayarlarının doğru olduğundan emin olun.
- **Model pack'leri boş (modelli build)**: `npm run gen:android-asset-packs` çalıştırıldı mı? `assets/packs/models_manifest.json` mevcut mu? Backend erişilebilir mi (`staticUrl` ile indirme)?
- **Eski .glb hâlâ bundle'da**: `npm run clear:android-asset-packs` çalıştırıp yeniden `bundleRelease` alın.
- **Play APK reddi**: AAB kullanın (`build_google_play_no_models.bat`).
- **Debug imza uyarısı**: `keystore.properties` yoksa release debug key ile imzalanır; Play kabul etmez.

Bu adımlarla ProParcel'i Google Play için AAB olarak derleyip yükleyebilirsiniz.
