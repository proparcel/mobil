# Avatar örnek resimleri (arka plan sorusu için)

Bu klasörde kullanılması gereken dosyalar (isimler tam olarak böyle olmalı):

- **avatar_with_back.png** – Arka planlı örnek (örn. bir kişi odada/arka planda)
- **avatar_no_back.png** – Arka planı temizlenmiş örnek (aynı kişi, beyaz fon)

Kullanıcı profil fotoğrafı yüklerken "Resim yüklendiğinde arka plan temizlensin mi?" sorusu bu iki örnekle birlikte gösterilir.

`app/routes/profile.tsx` içindeki modal bu dosyaları kullanır:
- Sol örnek: `require("../../assets/images/avatar_with_back.png")`
- Sağ örnek: `require("../../assets/images/avatar_no_back.png")`
