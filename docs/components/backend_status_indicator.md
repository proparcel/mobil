# Backend Durum Göstergesi

## Özellik

Uygulamanın ana ekranında (header'da), backend sunucusunun durumunu gösteren bir status indicator eklendi.

## Nasıl Çalışır?

1. **Uygulama açıldığında:** Backend durumu otomatik olarak kontrol edilir
2. **Periyodik kontrol:** Her 15 saniyede bir backend durumu tekrar kontrol edilir
3. **Görsel gösterge:** Header'ın sağ üst köşesinde, menü butonunun yanında renkli bir nokta gösterilir

## Renkler

- 🟢 **Yeşil (Online):** Backend sunucusu çalışıyor ve erişilebilir
- 🔴 **Kırmızı (Offline):** Backend sunucusu çalışmıyor veya erişilemiyor
- 🟠 **Turuncu (Kontrol Ediliyor):** İlk açılışta veya durum kontrol edilirken

## Teknik Detaylar

### Kontrol Mekanizması

- **Endpoint:** Backend URL'inin root path'i (`/`)
- **Timeout:** 3 saniye
- **Kontrol Sıklığı:** Her 15 saniyede bir
- **Method:** GET request

### Kod Yapısı

```typescript
// State
const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

// Kontrol fonksiyonu
const checkBackendStatus = async () => {
  // Backend'e GET request gönderir
  // Başarılı yanıt alırsa: true
  // Hata alırsa: false
};

// useEffect ile periyodik kontrol
useEffect(() => {
  checkBackendStatus(); // İlk kontrol
  const intervalId = setInterval(() => {
    checkBackendStatus(); // Her 15 saniyede bir
  }, 15000);
  return () => clearInterval(intervalId);
}, []);
```

## Görsel Konum

Status indicator, header'ın sağ tarafında, menü butonunun solunda görünür:

```
[🔍]  ProParcel  [●] [☰]
                ↑
          Status Dot
```

## Backend URL

Backend URL'i environment variable'dan alınır:
- `EXPO_PUBLIC_API_URL` (varsa)
- Varsayılan: `http://78.186.188.162:8001`

## Notlar

- Status indicator sadece görsel bir gösterge sağlar
- Gerçek API çağrıları yine de timeout ve error handling ile korunur
- Backend offline olsa bile kullanıcı uygulamayı kullanabilir (sadece API çağrıları başarısız olur)
