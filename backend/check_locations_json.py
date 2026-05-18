"""JSON dosyasını kontrol et"""
import json
from pathlib import Path

json_path = Path(__file__).parent.parent / "frontend" / "app" / "data" / "locations.json"

if not json_path.exists():
    print(f"[HATA] Dosya bulunamadi: {json_path}")
    exit(1)

print(f"[OK] Dosya bulundu: {json_path}")
print(f"  Boyut: {json_path.stat().st_size / 1024 / 1024:.2f} MB")

try:
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"\n[OK] JSON gecerli!")
    print(f"  - Il sayisi: {data.get('total_cities', 0)}")
    print(f"  - Ilce sayisi: {data.get('total_towns', 0)}")
    print(f"  - Mahalle sayisi: {data.get('total_quarters', 0)}")
    
    # Proparcel_value kontrolü
    if data.get('cities'):
        first_city = data['cities'][0]
        if first_city.get('Towns'):
            first_town = first_city['Towns'][0]
            if first_town.get('Quarters'):
                first_quarter = first_town['Quarters'][0]
                pv = first_quarter.get('Proparcel_value')
                if pv:
                    print(f"\n[OK] Ornek mahalle Proparcel_value: {pv}")
                    print("[OK] Tum mahallelerde Proparcel_value mevcut!")
                else:
                    print("\n[HATA] Proparcel_value bulunamadi!")
    
    print("\n[OK] Dosya hazir ve kullanima uygun!")
    
except json.JSONDecodeError as e:
    print(f"[HATA] JSON gecersiz: {e}")
    exit(1)
except Exception as e:
    print(f"[HATA] Hata: {e}")
    exit(1)

