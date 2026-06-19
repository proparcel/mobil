# Mobil Uygulama Hata Ayıklama Rehberi

## Kisa Ozet

Bu rehber, mobil uygulamada hata ayiklama icin en hizli gozlem kanallarini ve temel sorun giderme adimlarini listeler.

## 1) Ilk Kontrol Sirasi

1. Expo/Metro terminal ciktilarini izle.
2. Web preview veya cihaz debug menusu uzerinden console hatasini yakala.
3. Backend ve frontend loglarini birlikte kontrol et.
4. Hata mesajina gore ag, Metro veya kod kaynakli ayrim yap.

## 2) Terminal ve Log Kanallari

```bash
# Expo loglari
sudo supervisorctl tail -f expo

# Backend loglari
tail -f /var/log/supervisor/backend.err.log

# Frontend (Expo) loglari
tail -f /var/log/supervisor/expo.err.log
tail -f /var/log/supervisor/expo.out.log
```

## 3) Tarayici ve Cihaz Uzerinden Izleme

- Web preview tarafinda `localhost:3000` acip DevTools -> Console kullan.
- Expo Go/dev client icinde cihaz menu adimlari:
  - Cihazi salla
  - `Show Dev Menu`
  - `Reload` veya `Debug Remote JS`

## 4) Yaygin Hata Kaliplari

### `Cannot connect to Metro`

- Expo/Metro servisinin calistigini dogrula.
- Gerekirse Metro cache temizleyip tekrar baslat.

### `Network request failed`

- API sunucusunun ayakta oldugunu kontrol et.
- API URL ve port bilgisinin dogru oldugunu dogrula.
- Ag tarafi problemleri icin `port_forwarding_rehberi.md` dokumanina bak.

### `undefined is not an object`

- Hata stack bilgisinden ilgili satiri bul.
- Eksik import, null/undefined state veya veri tipini kontrol et.

## 5) Ilgili Dokumanlar

- `docs/guides/gelistirme_sorunlari_ozeti.md`
- `docs/guides/metro_connection_troubleshooting.md`
- `docs/guides/sunucu_erisim_sorunlari.md`
- `docs/guides/port_forwarding_rehberi.md`
