# İlan detay hero video oynatımı

**Konum:** `frontend/screens/routes/son-30-gun-detay.tsx` (galeri), `frontend/components/app/ListingHeroVideoSlide.tsx`, `ListingFullscreenVideo.tsx`, `frontend/src/utils/listingVideoSource.ts`

## UX kuralları

- Detay açılışında video **otomatik oynatılmaz**; yalnızca `thumbnail_url` gösterilir.
- Kullanıcı play’e basınca `react-native-video` mount edilir (lazy).
- Native `poster` prop kullanılmaz; kapak görseli uygulama `Image` overlay ile yönetilir.
- Kapak, `onReadyForDisplay` veya `currentTime > 0.05` ile kalkar; 3 sn yedek zaman aşımı.
- Sunucu: progressive MP4 + `faststart` (pipeline); kısa ilan için HLS yok.

## Manuel test matrisi

| Senaryo | Beklenti |
|---------|----------|
| Android — video ilk slayt | Thumbnail + play; tap sonrası hareketli görüntü |
| iOS — aynı | Aynı |
| Galeri kaydır (video ↔ foto) | Önceki slayt player unmount |
| Pause / play | Kapak geri gelmez |
| Tam ekran | Görüntü + ses |
| Zayıf ağ | Yükleniyor / hata + yeniden dene |
| Video modülü yok | Thumbnail veya fallback ikon |

`__DEV__` log: `[ListingHeroVideo] play-to-first-frame ms=`
