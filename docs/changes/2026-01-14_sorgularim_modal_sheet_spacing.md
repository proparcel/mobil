## Amaç

Mobil uygulama ana sayfada (“index”) menüden açılan **Sorgularım** listesinin:

- Telefonun alt “footer / navigation bar” alanı (safe-area) altında kalmaması
- Alt-sheet görünümünün daha yukarı uzaması (ekranın neredeyse ortasına kadar)

## Kapsam

- Etkilenen bileşen: `frontend/app/components/MyQueriesModal.tsx`
- Bu değişiklik sadece **UI/yerleşim** iyileştirmesidir; veri modeli ve backend çağrılarını etkilemez.

## Uygulanan Değişiklikler

### 1) Alt-sheet yüksekliği

- Alt-sheet artık dinamik olarak:
  - Minimum yükseklik: ekran yüksekliğinin ~%55’i
  - Maksimum yükseklik: ekran yüksekliğinin ~%88’i

### 2) Liste alanı (ScrollView) davranışı

- Liste `flex: 1` ile sheet içinde kalan alanı doldurur.

### 3) Alt boşluk (footer/safe-area altında kalmaması)

- Liste `contentContainerStyle` içine:
  - `paddingBottom: (safe-area bottom) + 24`
  - Böylece en alttaki/tek kayıt dahi navigation bar altında kalmaz.

Bu amaçla `react-native-safe-area-context` üzerinden `useSafeAreaInsets()` kullanılır.

### 4) Harita üstü siyah overlay kaldırma

- Modal açıldığında haritayı karartan backdrop katmanı kaldırıldı:
  - `backdrop.backgroundColor` artık `transparent`
  - Böylece alt-sheet açıkken harita siyah bir overlay ile kapanmaz.

### 5) Sorgularım tasarımını açık tema (beyaz / hafif grimsi) yapma

- `MyQueriesModal` alt-sheet ve liste kartları açık tona çekildi:
  - Sheet arka planı hafif gri, kartlar beyaz
  - Metin renkleri koyu gri/siyah
  - İkonlar (yenile/kapat/sil) açık temaya göre ayarlandı

### 6) Aşağı sürükleyerek kapatma (Sorgularım)

- `MyQueriesModal` alt-sheet artık aşağı sürüklenerek kapatılabilir:
  - Eşik: `dy > 120` veya hızlı sürükleme (`vy > 1.2`)
  - Kapatma animasyonu sonrası modal kapanır.
  - Not: Sürükleme alanı üstteki tutma barıdır (ScrollView kaydırması ile çakışmasın diye).

### 7) Ana menü overlay kaldırma + aşağı sürükleyerek kapatma

- Hamburger ile açılan ana menüdeki siyah overlay kaldırıldı:
  - `menuModalOverlay.backgroundColor` artık `transparent`
- Ana menü artık aşağı sürüklenerek kapatılabilir:
  - Eşik: `dy > 120` veya hızlı sürükleme (`vy > 1.2`)
  - Kapatma animasyonu sonrası modal kapanır.
  - Not: Sürükleme alanı üstteki tutma barıdır.

### 8) Çift kapanma / anlık geri açılıp kapanma (flicker) engeli

- Kapatma sırasında iki kez tetiklenmeyi önlemek için “kapanıyor” guard eklendi:
  - `isClosingRef / menuClosingRef` true iken tekrar close tetiklenmez.
- Kapatma animasyonu sırasında `translateY` sıfırlanmadığı için panel “geri zıplamaz”.

## Test Planı

- Ana sayfada menüden **Sorgularım** açılır.
- Liste kısa (1–2 kayıt) iken:
  - Sheet daha yukarı uzamalı (yaklaşık yarım ekran hissi)
  - Kart(lar) alt kısımda navigation bar altında kalmamalı
- Harita üstünde siyah overlay olmamalı.
- Sheet aşağı sürüklenerek kapanmalı.
- Liste uzun iken:
  - Scroll düzgün çalışmalı
  - En alttaki öğeler görünür olmalı (bottom padding sayesinde)

- Hamburger menü açılır:
  - Harita üstünde siyah overlay olmamalı.
  - Menü aşağı sürüklenerek kapanmalı.

