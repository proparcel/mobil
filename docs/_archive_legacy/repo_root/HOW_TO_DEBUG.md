# 📱 Mobil Uygulama Hatalarını PC'de Görme Rehberi

## 1️⃣ Terminal Logları (EN KOLAY)

Expo çalışırken terminal'de tüm loglar görünür:
```bash
# Expo loglarını kontrol et
sudo supervisorctl tail -f expo
```

## 2️⃣ Web Preview Console (TAVSİYE EDİLEN)

- Web preview'da (localhost:3000) sağ tıklayın
- "Inspect" veya "İncele" seçin
- "Console" sekmesine gidin
- Tüm hatalar ve console.log'lar burada görünür

## 3️⃣ Expo Go'da Hata Gösterme

Telefonda Expo Go'da:
1. Cihazı sallayın (shake)
2. "Show Dev Menu" açılır
3. "Toggle Element Inspector" - element inceleme
4. "Reload" - yeniden yükle
5. "Debug Remote JS" - Chrome'da debug

## 4️⃣ Log Dosyalarını Kontrol

```bash
# Backend logları
tail -f /var/log/supervisor/backend.err.log

# Frontend (Expo) logları
tail -f /var/log/supervisor/expo.err.log
tail -f /var/log/supervisor/expo.out.log
```

## 5️⃣ Chrome DevTools ile Debug

1. Expo Go'da Dev Menu açın (cihazı sallayın)
2. "Debug Remote JS" seçin
3. Chrome'da otomatik açılır: http://localhost:19000/debugger-ui
4. Chrome DevTools açın (F12)
5. Console'da tüm hataları görün

## 6️⃣ Emergent Console'da Log Görme

Chat arayüzünde yazdığınız kodlara:
```javascript
console.log('Test:', data);
console.error('Hata:', error);
console.warn('Uyarı:', warning);
```
Bunlar hem telefonda hem de PC console'da görünür.

## 🎯 En Pratik Yöntem:

**Web Preview Console Kullanın:**
1. localhost:3000'i tarayıcıda açın
2. F12 basın (DevTools)
3. Console sekmesine gidin
4. Telefonda ne yaparsanız, hatalar burada görünür!

## 🔴 Yaygın Hatalar ve Çözümleri:

**"Cannot connect to Metro"**
- Supervisor restart expo

**"Network request failed"**
- Backend çalışıyor mu kontrol et
- API URL'i doğru mu kontrol et

**"undefined is not an object"**
- Console'da hangi satırda hata olduğunu gör
- Eksik import veya state kontrolü yap
