# İl/İlçe/Mahalle Verileri

Bu doküman, mobil uygulamada kullanılan il/ilçe/mahalle verilerinin nasıl yönetildiğini açıklar.

## JSON Dosyası

Mobil uygulama içinde hazır bir JSON dosyası mevcuttur:
- **Konum:** `frontend/src/data/locations.json`
- **İçerik:** 81 il, 973 ilçe, 76,762 mahalle
- **Önemli Alanlar:** Her mahalle için `Proparcel_value` dahil

## Endpoint'ler

### 1. Django Backend
- **URL:** `/api/locations/all/`
- **Yöntem:** GET
- **Açıklama:** Tüm il/ilçe/mahalle verilerini hiyerarşik yapıda döndürür

### 2. FastAPI Backend (Mobil)
- **URL:** `/api/locations/all`
- **Yöntem:** GET
- **Açıklama:** Aynı verileri FastAPI üzerinden sağlar

## JSON Dosyasını Güncelleme

Veritabanında değişiklik olduğunda JSON dosyasını güncellemek için:

```bash
cd mobile/mobil_github/backend
python generate_locations_json.py
```

Bu script, Django veritabanından tüm verileri çekerek `frontend/src/data/locations.json` dosyasını günceller.

## FastAPI Backend Kurulumu

FastAPI backend'in SQL Server'a bağlanabilmesi için:

1. **Gerekli paketi yükleyin:**
```bash
pip install pyodbc
```

2. **.env dosyası oluşturun** (`backend/.env`):
```env
# MongoDB Bağlantı Bilgileri
MONGO_URL=mongodb://localhost:27017
DB_NAME=mobil_proje_db

# SQL Server Bağlantı Bilgileri (Windows Authentication için)
SQL_SERVER=localhost
SQL_DATABASE=Sahibinden
SQL_USERNAME=
SQL_PASSWORD=
```

**Not:** Windows Authentication kullanıyorsanız `SQL_USERNAME` ve `SQL_PASSWORD` alanlarını boş bırakın.

## JSON Yapısı

```json
{
  "cities": [
    {
      "Id": 1,
      "Proparcel_text": "Ankara",
      "Tkgm_value": 28,
      "CityPlaka": 6,
      "Towns": [
        {
          "Id": 1,
          "Proparcel_text": "Akyurt",
          "Tkgm_value": 159,
          "Quarters": [
            {
              "Id": 114066,
              "Tkgm_text": "Ahmet Adil",
              "Tkgm_value": 135676,
              "Proparcel_text": "Ahmetadil Mah.",
              "Proparcel_value": "52696",
              "Inactive": false
            }
          ]
        }
      ]
    }
  ],
  "total_cities": 81,
  "total_towns": 973,
  "total_quarters": 76762
}
```

