# VR Parsel — Kullanıcı Akışı

## Ön koşul

Kullanıcı **Basit Sorgu** ile parsel seçmiş olmalıdır. VR modülü kendi sorgusunu yapmaz.

## Ana ekran → VR

1. Pill bar'daki AR (VR) ikonuna bas.
2. Parsel yoksa: *Önce Basit Sorgu ile bir parsel seçmelisiniz.*
3. Polygon yoksa: *Parsel sınır verisi bulunamadı.*

## İzin akışı

BottomSheet açılır:

- Başlık: VR Parsel Görüntüleme
- Kamera + konum neden gerekli açıklanır
- **Devam Et** → native izin diyalogları
- **Vazgeç** → iptal

Konum izni harita UserPoint GPS doğrulaması için istenir; hareket takibi AR world tracking ile yapılır.

## Cihaz modu

Sistem cihazı analiz eder ve mod seçer:

| Mod | Kullanıcı mesajı |
|-----|------------------|
| LiDAR hassas | *Bu cihaz LiDAR destekliyor; hassas AR kalibrasyonu kullanılacak.* |
| Standart ARKit | *Standart AR kalibrasyonu* |
| Harita fallback | *Bu cihazda kamera üzerinden VR parsel çizimi desteklenmiyor…* |

## Kalibrasyon (3-nokta)

### 1. Harita referansları

Mapbox mini haritada sırayla:

1. **Konumunuz**
2. **Hedef A** (kamerada görünen sabit nokta)
3. **Hedef B** (farklı yönde sabit nokta)

GPS sapması varsa sarı uyarı gösterilir; akış durmaz.

### 2. AR referansları

Unity AR oturumu (veya geliştirme build'inde RN kamera fallback):

1. Ayaklarınızın olduğu zemine dokunun
2. Hedef A'ya dokunun
3. Hedef B'ye dokunun

### 3. Kalibrasyon + çizim

- Kalite skoru gösterilir
- **Parseli Çiz** → world-anchored sınır çizgisi
- İnce ayar: ±10 cm, ±1° yaw, kilitle, yeniden kalibre

## Unity bağlı değilse

Development IPA olmadan Unity modülü `isAvailable() = false` döner. Harita adımları test edilebilir; AR world çizimi için EAS development build gerekir:

```bash
cd frontend
npm run eas:build:ios
npm run start:ios-dev
```

## Kapat

**Kapat** → ana harita; Unity oturumu sonlandırılır.
