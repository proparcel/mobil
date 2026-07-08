# ProParcel Mobile Uygulama Mimarisi

Bu dosya, ProParcel mobil uygulamasının genel mimari kurallarını, dokümantasyon yapısını ve temel geliştirme prensiplerini içerir. Detaylı teknik bilgiler ilgili modül dokümanlarında bulunur.

## Tek kaynak kodu (önemli)

- **Güncel uygulama:** `` → uzak: `https://github.com/proparcel/mobil.git` (`main`)
- **Çalıştırma:** `frontend/` (`index.js` → `App.tsx`, React Navigation)
- **Ekranlar:** `frontend/screens/routes/` (aktif). Portal Pro sorgu / vitrin listesi: `son-30-gun.tsx` paylaşılan kabuk; mod `son-30-gun` vs `emlak-vitrini-liste` route ile kilitli — `docs/components/portal_list_modes.md`. **Emlak vitrini:** menüden doğrudan `emlak-vitrini-liste`; `emlak-vitrini.tsx` sihirbazı (kategori/işlem/il) şimdilik pasif, not `portal_list_modes.md`.
- **Kullanılmıyor:** `frontend/app/` (eski Expo Router kopyası), `mobile/emergent/` (parça yedek)
- Özet: `mobile/README.md`

## Önemli not (tüm oturumlar için)

Backend ile uyum: kullanıcı kimliği ve profil **Mongo-first**; zorunlu PostgreSQL dışında (ör. `QueryDfaSnapshot`, portal liste/hızlı filtre) SQL üzerinden kullanıcı varsayımı yapılmaz. Oturum görevi sırasında bu ihlal tespit edilirse düzeltilir. Tam metin: repo kökü `architecture.md` ve `docs/architecture.md` içindeki **Mongo-first kimlik ve PostgreSQL sınırı** bölümleri. **“Hiç SQL yok” doğru değildir:** portal/snapshot katmanı bilinçli PG kullanır; kullanıcı katmanı Mongo’dur — kök `architecture.md` içindeki **Veri katmanları** tablosuna bakın.

## Doküman Güncelleme Kuralı

### Genel İlkeler

**ÖNEMLİ:** Değişiklik olduğunda ilgili dosyadaki eski içerik güncellenir ve dokümanlar güncel durumu yansıtır. Ayrıca izlenebilirlik için operasyonel değişiklik taslakları `docs/changes/` altında tutulabilir; süreç sonunda kalıcı dokümanlara entegre edilmelidir.

### Döküman Oluşturma ve Güncelleme Kuralları

1. **Mevcut Döküman Güncelleme**
   - Yeni bir döküman oluşturma talebi gelmediyse, ilgili mevcut dökümanı bulup güncelle.
   - Güncelleme yapılırken eski konuyu tamamen sil ve yenisini yaz.
   - "Değişim", "Yenilik", "Güncelleme" gibi başlıklar veya diff formatında ek satırlar ekleme.
   - İlgili bölümü doğrudan güncel içerikle değiştir.

2. **Yeni Döküman Ekleme**
   - Yeni bir döküman eklenecekse, ilgili klasör altına ekle:
     - Component dokümanları için: `docs/components/` klasörü
     - API/Servis dokümanları için: `docs/api/` klasörü
     - Rehberler için: `docs/guides/` klasörü
     - Build/Deploy dokümanları için: `docs/build/` klasörü
   - Yeni döküman eklendiğinde bu architecture.md dosyasındaki ilgili bölümü (Doküman Yapısı) güncelle.

3. **Güncelleme Yaklaşımı**
   - Eski içeriği koruma veya arşivleme yapma.
   - Tüm değişiklikler doğrudan ilgili doküman dosyasına uygulanır.
   - Dokümanlar her zaman güncel durumu yansıtmalıdır.

4. **Değişiklik Notları Güncelleme Kuralı**
   - Dosyalarda yapılan değişiklikler sonucu dokümanlar güncellenirken:
     - **Eski not varsa:** İlgili dokümanlarda (architecture.md veya modül dokümanlarında) yapılan değişiklik ile ilgili eski not/başlık bulunuyorsa, eski değişiklik notu **tamamen silinir** ve yeni not eklenir.
     - **Eski not yoksa:** Değişiklik ile ilgili not dokümanlarda yoksa, yeni not doğrudan ilgili bölüme eklenir.
   - Amaç: Dokümanlarda aynı konu hakkında birden fazla/çelişkili not bulunmasını önlemek ve her zaman güncel bilgiyi yansıtmak.

5. **Ağaç Mimarisinde Dokümantasyon Kuralı**
   - Ağaç mimarisinde (hierarchical/tree structure) doküman oluşturulması istendiğinde **Mermaid flowchart** kullanılır.
   - Amaç: Ağaç yapısını görsel olarak net bir şekilde temsil etmek ve dokümantasyonun anlaşılabilirliğini artırmak.

6. **Geçici Doküman Yönetimi**
   - Yeni bir operasyon için geçici doküman oluşturulmak istenirse, bu doküman `docs/temp_doc/` klasörü altında oluşturulur.
   - Geçici dokümanlar operasyon sürecindeki adımları, notları ve ara durumları içerir.
   - Operasyon notları süreç adımları sonunda **başarıya ulaşmışsa**, geçici doküman **silinir** ve gerekli bilgiler kalıcı dokümanlara (architecture.md veya ilgili modül dokümanlarına) aktarılır.
   - Başarısız veya yarıda kalan operasyonlar için geçici dokümanlar, operasyon tamamlanana kadar korunur.

7. **Döküman Konumlandırma ve İsimlendirme Kuralları (ZORUNLU)**
   - **Doc Klasörü Harici Döküman Oluşturulmaz:** Tüm dökümanlar `docs/` klasörü altında olmalıdır. `docs/` klasörü harici hiçbir klasör altına döküman oluşturulmaz.
   - **Direkt MD Dosyası Eklenmez:** `docs/` klasörü altına direkt olarak `.md` dosyası eklenmez. Dökümanlar ilgili klasörlerin altına eklenir (örn: `docs/components/`, `docs/guides/`, `docs/build/`, `docs/utils/`). Eğer ilgili klasör yoksa oluşturulur.
   - **Mimari Dökümana Kayıt:** Her oluşturulan döküman için bu architecture.md dosyasındaki "Doküman Yapısı" bölümüne dökümanın yolu ve konusu yazılır.
   - **Snake Case İsimlendirme:** Tüm döküman ve dosya isimlerinde snake_case kullanılır (örn: `android_network_fix.md`, `apk_build_ve_sunucu.md`, `cesium_model_viewer_architecture.md`).

### Doküman Yapısı

Dokümanlar aşağıdaki klasör yapısında organize edilmiştir:

- **doc/** - Ana dokümantasyon klasörü
  - `architecture.md` - Bu dosya (genel mimari kurallar)
  - `development-rules.md` - Geliştirme kuralları ve prensipleri
  - `index.md` - Ana ekran (index.tsx) dokümantasyonu
  - **changes/** - Operasyon/iş notları (geçici taslaklar, konsolide kayıtlar)
    - `2026-02-26_operasyon_notlari_konsolide_ozet.md` - Kenar kaydırma/yol/PDF ekran görüntüsü operasyon notlarının tekil özeti
    - `adb_fix.md`, `androidx_migration.md`, `gradle_fix_plan.md`, `gradle_fixes_applied.md` - Android/Gradle operasyon notları
    - `metro_connection_fix.md`, `require_doesnt_exist_root_cause.md` - Metro ve runtime sorun notları
    - `diger_yuz_komutu_etiket_sistemi.md` - Kenar ölçüm etiketi operasyon notu
  - **build/** - Build ve deploy dokümanları
    - `apk_build_ve_sunucu.md` - APK build ve sunucu dokümantasyonu
    - `apk_guncelleme_rehberi.md` - APK güncelleme rehberi
    - `eas_build_readme.md` - EAS build notları
    - `fiziksel_cihaz_build.md` - Fiziksel cihaz build süreci
    - `google_play_build.md` - Google Play build/release notları
    - `aab_release_checklist.md` - Google Play AAB alma checklist'i, release imza kontrolu ve surum kaydi
    - `android_model_assets_pad.md` - Android 3D model varlıkları (PAD, manifest, APK’ya gömme, `android:embed-models`, teşhis)
    - `ios_build_rehberi.md` - iOS build rehberi
    - `logo_guncelleme.md` - Logo güncelleme
  - **guides/** - Rehberler ve kullanım kılavuzları
    - `android_network_fix.md` - Android network sorun giderme
    - `android_cihaz_cozum.md` - Android cihaz özel çözüm notları
    - `hata_ayiklama_rehberi.md` - Mobil hata ayıklama hızlı kontrol adımları
    - `ip_adresi_port_forwarding_duzeltme.md` - IP değişimi kaynaklı erişim sorunu olay kaydı
    - `port_forwarding_rehberi.md` - Dış ağ erişimi için port yönlendirme rehberi
    - `javascript_code_generation_rules.md` - Kod üretim/stil kuralları
    - `platform_strategy.md` - Platform stratejisi
    - `setup_instructions.md` - Kurulum adımları
    - `kurulum_sunucu_rehberi.md` - Sunucu ortamında mobil kurulum adımları
    - `avatar_ornek_rehberi.md` - Kayıt/avatar akışı örnek rehberi
    - `paket_kopyalama_rehberi.md` - Paket kopyalama adımları
    - `gelistirme_sorunlari_ozeti.md` - Geliştirme ortamı kök neden özeti
    - `expo_dev_server_sorun.md` - Expo dev server sorunları
    - `expo_test_rehberi.md` - Expo test rehberi
    - `mapbox_setup.md` - Mapbox kurulum rehberi
    - `react_native_devtools_rehberi.md` - Devtools kullanım rehberi
    - `sunucu_erisim_sorunlari.md` - APK sunucu erişim sorunları ve çözümleri
    - `turkce_metro_cozum.md` - Metro Türkçe hata çözümleri
    - `uygulama_adimlari.md` - Operasyon akış adımları
    - `aranacaklar_modulu.md` - Aranacaklar (rehber kişi, talep, not, takip; Django Mongo + REST API + mobil)
    - `keyboard_and_input_display.md` - Klavye ve TextInput gösterim standardı (tek KAV, scroll-into-view, sheet/modal; yapay zeka ve geliştirici referansı)
  - **modules/** - İzole mobil modül dokümanları (kolay kaldırılabilir)
    - **akilli_ses/** - Akıllı Ses (ortak ses altyapısı, Sesli Sorgu referansı, Sesli Üyelik)
      - `modul_overview.md` - Modül amacı, alt özellikler, klasör haritası
      - `ortak_altyapi.md` - Recorder, animasyon, debug log
      - `sesli_sorgu_referans.md` - Parsel Akıllı Sorgu → smart_query.md köprüsü
      - `sesli_uyelik.md` - Sesli üyelik sihirbazı akışı
      - `api_voice_registration.md` - voice_registration_field_extract API sözleşmesi
      - `test_matrisi.md` - Cihaz test senaryoları
    - **vr_parcel/** - VR parsel görüntüleme (Basit Sorgu parseli + Unity AR kalibrasyon)
      - `modul_overview.md` - Modül amacı, klasör haritası, entegrasyon noktaları, feature flag
      - `kullanici_akisi.md` - Kullanıcı adımları ve uyarı metinleri
      - `kalibrasyon_akisi.md` - Referans noktası kalibrasyonu ve validasyon
      - `veri_sozlesmesi.md` - RN ↔ Unity JSON sözleşmesi
      - `unity_native_entegrasyon.md` - Unity as a Library build adımları
      - `removal_checklist.md` - Modül kaldırma checklist
      - `test_matrisi.md` - Fiziksel cihaz test matrisi
  - **components/** - Component dokümanları
    - `ada_parsel_form.md` - Ada/Parsel sorgu formu
    - `smart_query.md` - Akıllı Sorgu (ses, metin, görsel; ana harita orb + ParcelSearchModal)
    - `customer_type_feature_gates_mobile.md` - Akıllı Sorgu abonelik kapıları (customer_type / features.smart_query)
    - `parcel_modal.md` - Parsel detay modal'ı
    - `kenar_yol_cizimi_tam_dokuman.md` - Kenar/yol çizim mimarisi
    - `kenar_yol_cizimi_is_akisi_ve_sorunlar.md` - Çizim iş akışı ve sorunları
    - `hisseli_parsel_pdf_kayit_detay.md` - Hisseli parsel PDF kayıt akışı
    - `kenar_olcum_etiket_yerlestirme_sistemi.md` - Ölçüm etiketi yerleşim sistemi
    - `yol_cizme_islemleri.md` - Yol çizim adımları
    - `drawing_comparison.md` - Çizim karşılaştırması
    - `backend_status_indicator.md` - Backend durum göstergesi
    - `test_model_layer_asset.md` - ModelLayer (asset GLB) ile 3D model çizim doğrulama testi
    - `parcel_split_screen.md` - Hisseli parsel bölme ekranı (parcel-split)
    - `complete_registration.md` - Danışman/Kurumsal kayıt tamamlama (avatar → adres → uzmanlık bölgeleri)
    - `expert_score_and_badges.md` - Danışman/Kurumsal uzmanlık puanı ve kalıcı rozetlerin mobil gösterimi
    - `uc_boyutlu_model_api_mimari_karari.md` - 3D model listeleme endpoint mimari kararı
    - `listing_hero_video.md` - İlan detay hero galeri video (tap-to-play, kapak overlay, buffer)
    - `portal_list_modes.md` - Son30GunScreen: Pro sorgu / vitrin liste modu route kilidi ve test matrisi
    - `parcel_terrain_3d_viewer.md` - Pro sorgu detay Eğim sekmesi Unity 3D parsel eğim viewer (lazy `/terrain-3d/`, `modules/parcelTerrain3d/`)
    - `nasil_yapilir_videolari.md` - Nasıl Yapılır YouTube videoları (admin, API, mobil kategori grid/list, canlı yayın sekmesi)
    - `ai_video_editor.md` - AI Video editör (yatay 16:9, runway ai_video, menü ve pipeline)
  - **api/** - API/servis dokümanları
    - `konum_verisi_ve_endpointleri.md` - İl/ilçe/mahalle veri kaynağı ve endpoint rehberi
  - **utils/** - Utility dokümanları
    - `readme.md` - Utils klasörü açıklaması
    - `measurement_manager.md` - Ölçüm yönetimi
    - `screenshot_manager.md` - Ekran görüntüsü yönetimi
    - `parcel_split_transform.md` - Hisseli parsel geometri transform (fit-to-view)
    - **handlers/** - Handler dokümanları
      - `share_handler.md` - Paylaşım handler fonksiyonları
      - `parcel_handlers.md` - Parsel handler fonksiyonları
  - **temp_doc/** - Operasyon sırasında geçici notlar (süreç sonunda temizlenir)

## Genel Bakış

- **Harita Motoru:** React Native Mapbox GL (rnmapbox/maps)
- **Routing:** Expo Router (file-based routing)
- **UI Framework:** React Native + TypeScript
- **State Management:** React Hooks (useState, useRef, useEffect)
- **3D Harita:** Mapbox Terrain API ile 3D görünüm desteği
- **Ekran Yakalama:** expo-screen-capture ve react-native-view-shot

## Genel Kurallar

### 1.1) Ortak Fonksiyon Kullanım İlkesi

- Yeni bir işlem/özellik için önce mevcut mimaride uygun fonksiyon var mı kontrol edilir.
- Uygun bir fonksiyon varsa "ortak fonksiyon" olarak doğrudan çağrılır; kopyalanmaz.
- Benzer fonksiyon %90 uyumlu ama küçük farklar gerektiriyorsa mevcut fonksiyon asla bozulmaz.
- Bu durumda ilgili modül altında (gerekirse yeni dosya oluşturarak) yeni ve bağımsız bir fonksiyon yazılır.
- Her düzenleme sonrası bu mimari değişikliği ilgili modül dokümanında güncelle.

### 1.2) Doküman Güncelleme Kuralı

- Her geliştirme/işlem sonrası ilgili modülün kendi doküman dosyası güncellenmelidir.
  - React Native component'leri: `docs/components/<component_adi>.md`
  - API/Servis: `docs/api/<servis_adi>.md`
  - Utilities: `docs/utils/<utility_adi>.md`
- Güncellenmesi gereken başlıklar:
  - Girdiler (veri tipleri ve kaynaklar)
  - İç akış adımları
  - Üretilen çıktılar ve tipleri
  - Diğer modüllere/arayüze veri akışı

### 1.3) Dosya Boyutu Kuralı – 2000 Satır Limiti (ZORUNLU)

- **TypeScript (.tsx, .ts) ve JavaScript (.js, .jsx) dosyaları 2000 satırı geçmeyecektir.**
- Bir dosya 2000 satıra yaklaştığında veya geçtiğinde, mantıklı bir şekilde klasör oluşturularak içine alt dosyalar olarak bölünecektir.
- **Bölme İşlemi Prensipleri:**
  - İlgili fonksiyonlar ve sınıflar mantıksal olarak gruplandırılmalıdır.
  - Her alt dosya tek bir sorumluluğa odaklanmalıdır (Single Responsibility Principle).
  - Ana dosya, alt dosyaları import ederek veya yöneterek koordinasyon sağlamalıdır.
  - Bölme işlemi sonrası ilgili modül dokümanında değişiklikler belirtilmelidir.
- **Amaç:** Kodun bakımını kolaylaştırmak ve okunabilirliği artırmak.
- **Kontrol:** Yeni kod eklerken veya mevcut dosyaları düzenlerken dosya boyutunu kontrol et; 2000 satıra yaklaşıyorsa bölme planı yap.

### 1.4) Dosya Oluşturma Kuralı – Klasör Yapısı (ZORUNLU)

- **Yeni dosyalar direkt olarak ana klasörler altında oluşturulmamalıdır.**
- **Component dosyaları:** `app/components/` klasörü altında oluşturulmalıdır.
  - Örnek: Parsel modal bileşeni → `app/components/ParcelModal.tsx`
  - Örnek: Arama modal bileşeni → `app/components/ParcelSearchModal.tsx`
- **Utility dosyaları:** `app/utils/` klasörü altında oluşturulmalıdır.
  - Örnek: 3D mod yardımcıları → `app/utils/threeDMode.js`
  - Örnek: Ekran görüntüsü yönetimi → `app/utils/screenshotManager.ts`
  - Örnek: Fiyat parsing → `app/utils/priceParser.ts`
- **Type dosyaları:** `app/types/` klasörü altında oluşturulmalıdır.
  - Örnek: Parsel response tipleri → `app/types/parcelResponse.ts`
- **Config dosyaları:** `config/` klasörü altında oluşturulmalıdır.
  - Örnek: Mapbox konfigürasyonu → `config/mapbox.ts`
- **Klasör yoksa oluşturulmalıdır:** Dosya için uygun bir klasör yapısı yoksa, mantıksal olarak uygun bir klasör oluşturulmalıdır.
- **Amaç:** Kodun organizasyonunu ve bulunabilirliğini artırmak, modüler yapıyı korumak.
- **Kontrol:** Yeni dosya oluşturulmadan önce mevcut klasör yapısı incelenmeli ve uygun klasör belirlenmelidir.

### 1.5) Ana Dosyalarda Script ve CSS Yazım Kuralı (ZORUNLU)

- **Ana Dosyalarda (index.tsx, _layout.tsx vb.) Script ve CSS Yazımı:**
  - Ana component dosyaları (ör. `app/index.tsx`) içine zorunlu olmadıkça script (JavaScript/TypeScript) kodu yazılmaz.
  - Ana component dosyaları içine CSS (StyleSheet) yazılmaz; stil dosyaları ayrı dosyalarda tutulur.
  - Ya var olan kodların çağrısı yapılır ya da klasör/dosya/kod oluşturma stratejisine göre yeni dosya oluşturulur ve component içinde import edilerek çağrı yapılır.
- **Uygulama Adımları:**
  1. İhtiyaç duyulan JavaScript/TypeScript işlevi için önce mevcut kod tabanında uygun fonksiyon/modül var mı kontrol edilir (1.1 Ortak Fonksiyon Kullanım İlkesi).
  2. Mevcut kod varsa ana component dosyasında yalnızca import ve çağrı yapılır.
  3. Mevcut kod yoksa, 1.4 Dosya Oluşturma Kuralı'na göre uygun klasör ve dosya oluşturulur.
  4. Yeni JavaScript/TypeScript kodu ilgili dosyaya yazılır.
  5. Stil dosyaları ayrı dosyalarda tutulur (örn: `styles/indexStyles.ts` veya ilgili component klasörü altında `styles.ts`).
  6. Ana component dosyasında yeni dosyalar import edilir ve gerekli fonksiyon çağrıları yapılır.
- **Amaç:**
  - Ana component dosyalarının sade ve okunabilir kalmasını sağlamak
  - JavaScript/TypeScript kodlarının modüler ve yeniden kullanılabilir olmasını sağlamak
  - CSS stillerinin ayrı dosyalarda tutularak yönetilebilirliğini artırmak
  - Kod organizasyonunu ve bakımını kolaylaştırmak
  - Separation of concerns prensibini korumak
- **Uygulama:**
  - Ana dosyalarda (`app/index.tsx` gibi) inline script veya StyleSheet yazmak yerine, harici dosyalar kullanılmalıdır
  - Sadece zorunlu durumlarda (ör. minimal inline style objeleri) ana dosyada stil tanımlanabilir, ancak mümkün olduğunca ayrı stil dosyaları tercih edilmelidir
  - Utility fonksiyonlar, hook'lar ve helper'lar `app/utils/` klasöründe olmalıdır
  - Stil dosyaları `styles/` klasöründe veya component klasörü altında `styles.ts` olarak tutulmalıdır

### 1.6) Kod Güncelleme ve Temizlik Kuralı (ZORUNLU)

- **Yeni Kod Ekleme Sonrası:**
  - Yeni kod eklendikten sonra başarı sonucu **her zaman sorulur**.
  - Kullanıcıdan sürecin başarıyla tamamlanıp tamamlanmadığı onaylanmalıdır.
- **Eski Kod Temizliği:**
  - Süreç tamamlandıysa ve başarılıysa, eski kodlar **muhakkak silinir**.
  - Eski kodlar, yorum satırı olarak bırakılmaz veya devre dışı bırakılmaz; tamamen kaldırılır.
  - Geçici test kodları, debug kodları ve kullanılmayan fonksiyonlar da temizlenir.
- **Amaç:**
  - Kafa karışıklığını önlemek
  - Kod fazlalığını önlemek
  - Kod tabanının temiz ve bakımı kolay kalmasını sağlamak
  - Gelecekteki geliştiricilerin hangi kodun aktif olduğunu net anlamasını sağlamak
- **Uygulama:**
  - Her kod güncellemesi sonrası başarı kontrolü yapılır
  - Başarılı onay sonrası eski kodlar derhal silinir
  - Silinen kodlar için ilgili modül dokümanında güncelleme yapılır

### 1.7) Console Log İfadesi Kullanım Kuralı (ZORUNLU)

- **Console Log İfadeleri:**
  - Kod içinde `console.log()`, `console.warn()`, `console.error()`, `console.debug()` gibi console ifadeleri kullanıldığında, log içine **mutlaka dosya adı ve satır numarası** eklenmelidir.
  - Format: `console.log(f"[dosya_adi.tsx:satir_numarasi] Mesaj içeriği")`
  - Örnek: `console.log(f"[index.tsx:1234] Parsel verisi yüklendi")`
  - Örnek: `console.warn(f"[ParcelModal.tsx:567] Eksik veri tespit edildi")`
- **Amaç:**
  - Debug console log ifadelerinin sonradan kolayca bulunup silinmesini sağlamak
  - Hangi dosyadan ve hangi satırdan gelen log olduğunu hızlıca tespit edebilmek
  - Kod temizliği sırasında console log ifadelerinin hızlıca bulunmasını kolaylaştırmak
- **Uygulama:**
  - Her console log ifadesi dosya adı ve satır numarası içermelidir
  - Geçici debug console log'ları silinirken dosya adı ve satır numarası sayesinde kolayca bulunabilir

### 1.8) Yeni Modül Ekleme Süreci Kuralı (ZORUNLU)

- **Yeni Modül Ekleme:**
  - Yeni bir modül ekleneceği zaman, klasörleme, dosya oluşturma ve kod yazımı süreci bu dosyada (architecture.md) yazan süreç haritasına göre yapılır.
  - Bu dosyada belirtilen tüm kurallar (klasör yapısı, dosya oluşturma, kod yazım standartları, dokümantasyon güncelleme vb.) yeni modül eklerken de geçerlidir.
- **Süreç Adımları:**
  1. Bu dosyadaki ilgili kuralları incele (1.1 Ortak Fonksiyon Kullanım İlkesi, 1.4 Dosya Oluşturma Kuralı, 1.3 Dosya Boyutu Kuralı vb.)
  2. Mevcut mimari yapıyı ve benzer modülleri incele
  3. Uygun klasör yapısını belirle ve oluştur
  4. Dosyaları uygun konumlarda oluştur
  5. Kod yazımı sırasında tüm kurallara uy (console log formatı, dosya boyutu, ortak fonksiyon kullanımı vb.)
  6. İlgili dokümantasyonu güncelle (modül dokümanı ve architecture.md)
- **Amaç:**
  - Tutarlı bir mimari yapı korumak
  - Yeni modüllerin mevcut yapıya uyumlu olmasını sağlamak
  - Kod tabanının organizasyonunu ve bakımını kolaylaştırmak
- **Uygulama:**
  - Her yeni modül ekleme işleminde bu dosyadaki kurallar referans alınmalıdır
  - Kurallara uygun olmayan modül ekleme işlemleri yapılmamalıdır

### 1.9) Build İşlemi Kuralı

**KURAL:** AI asistanı build işlemleri yapmaz. Build işlemleri tamamen geliştirici tarafından manuel olarak gerçekleştirilir.

#### Neden Bu Kural Var?

1. **Build Süreçleri Zaman Alıcı:** Build işlemleri genellikle uzun sürer ve terminali bloklar.
2. **Hata Ayıklama Gerektirir:** Build hataları genellikle manuel müdahale ve geliştirici kararları gerektirir.
3. **Kaynak Tüketimi:** Build işlemleri sistem kaynaklarını yoğun kullanır.
4. **Geliştirici Kontrolü:** Build işlemi sonrası test ve doğrulama geliştirici tarafından yapılmalıdır.

#### AI Asistanın Rolü

AI asistan şunları yapar:
- ✅ **Kod yazımı ve düzenleme**
- ✅ **Hata analizi ve çözüm önerileri**
- ✅ **Konfigürasyon dosyalarını güncelleme**
- ✅ **Dokümantasyon oluşturma**
- ✅ **Kod inceleme ve iyileştirme önerileri**

AI asistan şunları yapmaz:
- ❌ **Build komutları çalıştırma** (`npx expo run:android`, `npm run build` vb.)
- ❌ **Uzun süren build işlemlerini başlatma**
- ❌ **Build sonrası uygulamayı çalıştırma**

#### Build İşlemleri Nasıl Yapılır?

Build işlemleri geliştirici tarafından terminal üzerinden manuel olarak gerçekleştirilir:

```bash
# Örnek build komutları (Geliştirici tarafından çalıştırılır)
cd frontend
npx expo prebuild --clean
npx expo run:android
```

#### İstisnalar

Bazı durumlarda AI asistan build komutları çalıştırabilir:
- ✅ **Hızlı kontrol komutları** (örn: `npm install`, `npm list`)
- ✅ **Test komutları** (kısa süren unit testler)
- ✅ **Linter kontrolü** (`npm run lint`)
- ✅ **Format kontrolü** (`npm run format`)

Ancak asla uzun süren build ve run işlemleri yapılmaz.

## React Native / TypeScript / Expo Standartları

### Component Yapısı

- Functional components kullanılır
- TypeScript ile tip güvenliği sağlanır
- React Hooks (useState, useRef, useEffect, useCallback) kullanılır
- Expo Router file-based routing yapısı kullanılır

### Dosya İsimlendirme

- Component dosyaları: PascalCase (örn: `ParcelModal.tsx`)
- Utility dosyaları: camelCase (örn: `priceParser.ts`)
- Type dosyaları: camelCase (örn: `parcelResponse.ts`)
- Config dosyaları: camelCase (örn: `mapbox.ts`)

### Kod Stili - Tırnak Kullanımı (Zorunlu)

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

### Import Sıralaması

1. React ve React Native core imports
2. Third-party library imports
3. Expo imports
4. Local component imports
5. Local utility/type imports
6. Config imports

## Detaylı Dokümantasyon

Detaylı teknik bilgiler için ilgili modül dokümanlarına bakınız:

- **Geliştirme Kuralları:** `docs/development-rules.md`
- **Android 3D model gömme (PAD + APK assets, tekrarlayan “model yok” hataları):** `docs/build/android_model_assets_pad.md` — konu: build öncesi `npm run android:embed-models` / `build:apk:with-models`, manifest ve pack yolları, kontrol listesi.
- **Build ve Deploy:** `docs/build/` klasöründeki dokümanlar
- **Rehberler:** `docs/guides/` klasöründeki dokümanlar
- **Klavye ve input alanı:** `docs/guides/keyboard_and_input_display.md` — klavye/input düzenlemesi önce bu rehber okunur
- **Aranacaklar modülü (tam modül):** `docs/guides/aranacaklar_modulu.md`
- **TKGM pasif / toplulaştırılmış parsel:** `docs/utils/tkgm_passive_parcel.md` — pasif parsel onay akışı (`tkgmPassiveParcel.ts`, `TkgmPassiveParcelModal.tsx`) ve TKGM hata (500/timeout/network) uyarı modalı davranışı.
- **Component Dokümanları:** `docs/components/` klasöründeki dokümanlar
