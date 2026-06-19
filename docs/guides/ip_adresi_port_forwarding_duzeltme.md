# IP Adresi ve Port Forwarding Duzeltme

## Kisa Ozet

Bu dokuman, DHCP nedeniyle degisen yerel IP adresinin port forwarding kurallarini bozdugu senaryoyu kayda alir.
Genel port forwarding adimlari icin `docs/guides/port_forwarding_rehberi.md` kullanilmalidir.

## Olay Ozeti

- Onceki hedef IP: `192.168.1.101`
- Guncel cihaz IP: `192.168.1.100`
- Etki: Router kurallari eski IP'ye baktigi icin dis agdan erisim kesildi.

## Uygulanan Duzeltme

1. Router panelinde ilgili kurallarin hedef IP'si `192.168.1.100` yapildi.
2. Port `8000` ve `8001` icin kural hedefleri yeni IP'ye cekildi.
3. Kalici olmasi icin DHCP rezervasyonu onerildi.

## Dogrulama

```powershell
# Yerel IP dogrulama
ipconfig

# Port dinleme kontrolu
Get-NetTCPConnection -LocalPort 8001 -State Listen
```

Dis ag testi:
- Mobil veri uzerinden `http://<dis_ip>:8001/api/` kontrol edilir.

## Not

Tekrarli ag sorunlarinda bu dosya olay kaydi olarak tutulur; operasyon adimlari icin birincil kaynak `port_forwarding_rehberi.md` dosyasidir.
