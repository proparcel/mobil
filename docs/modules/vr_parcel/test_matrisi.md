# VR Parsel — Fiziksel Cihaz Test Matrisi

## RN kabuk (Unity olmadan)

| # | Senaryo | Beklenen |
|---|---------|----------|
| 1 | Parsel yokken VR | Uyarı: Basit Sorgu |
| 2 | Basit sorgu sonrası VR | İzin BottomSheet |
| 3 | Vazgeç | Sheet kapanır, ekran açılmaz |
| 4 | Devam + izin red | Kamera/konum mesajı |
| 5 | Devam + izin ver | VrParcelScreen açılır, mod banner görünür |
| 6 | Harita 3 nokta | Mapbox picker, validasyon mesajları |
| 7 | GPS sapma uyarısı | Sarı metin, akış devam |
| 8 | Kapat | Ana harita |
| 9 | `EXPO_PUBLIC_VR_PARCEL_ENABLED=0` | Buton/route yok |
| 10 | AR desteklenmeyen cihaz | `map_only_fallback` ekranı |

## Unity + AR (native link sonrası)

| # | Senaryo | Beklenen |
|---|---------|----------|
| 11 | `isAvailable() = true` | Unity AR view açılır |
| 12 | Harita 3 nokta → Unity | `OnOpenSession` JSON iletilir |
| 13 | AR User + A + B tap | 3-nokta kalibrasyon |
| 14 | Harita ref < 3 m | Validasyon uyarısı |
| 15 | Kolinear 3 nokta | Red mesajı |
| 16 | Parseli Çiz | World sabit sınır |
| 17 | Kamera hareket | Çizgi sabit (head-lock değil) |
| 18 | İnce ayar 10 cm | Görsel kayma |
| 19 | İnce ayar 1° | Dönüş |
| 20 | Yeniden kalibre | Sıfırlanır |

## LiDAR (Faz 2)

| # | Senaryo | Beklenen |
|---|---------|----------|
| 21 | LiDAR iPhone | `lidar_precise` mod etiketi |
| 22 | LiDAR'sız iPhone | `arkit_standard` |
| 23 | Depth raycast | Plane'den önce depth denenir |
| 24 | Simülatör | LiDAR modu açılmaz |

## Android (Faz 3)

| # | Senaryo | Beklenen |
|---|---------|----------|
| 25 | ARCore yüklü | `arcore_standard` |
| 26 | ARCore yok | Play Store yönlendirme / fallback |
| 27 | Unity Android export | `VrUnityModule.kt` session açar |

## Platform checklist

- [ ] iOS LiDAR cihaz
- [ ] iOS ARKit (LiDAR'sız)
- [ ] Android ARCore cihaz
- [ ] ARCore desteklenmeyen Android → uygun mesaj

## Regresyon

- [ ] Basit Sorgu / harita akışı bozulmadı
- [ ] Diğer pill bar butonları çalışıyor
- [ ] Unit testler: `npm test` (vrCalibrationMath, mode selector, map validation)
