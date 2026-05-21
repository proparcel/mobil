"""
İl, İlçe ve Mahalle verilerini JSON dosyası olarak oluşturur.
Bu script Django backend'den verileri çekerek mobil uygulama için JSON dosyası oluşturur.
"""

import sys
import os
import json
from pathlib import Path

# Django projesine erişim için path ekle
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(BASE_DIR))

# Django settings'i yükle
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'proparcel.settings')

import django
django.setup()
from django.utils import timezone

from myapp.scripts.database.db_utils import (
    get_all_cities,
    get_towns_by_city_id,
    get_quarters_by_town_id
)


def generate_locations_json(output_path: Path):
    """
    Tüm il, ilçe ve mahalle verilerini JSON dosyası olarak oluşturur.
    
    Args:
        output_path: JSON dosyasının kaydedileceği path
    """
    print("Konum verileri çekiliyor...")
    
    cities_data = get_all_cities()
    
    result = {
        "cities": [],
        "total_cities": 0,
        "total_towns": 0,
        "total_quarters": 0,
        "metadata": {
            "generated_at": str(timezone.now()),
            "version": "1.0"
        }
    }
    
    total_cities = len(cities_data)
    print(f"Toplam {total_cities} il bulundu.")
    
    for idx, city in enumerate(cities_data, 1):
        city_id = city.get("Id")
        city_name = city.get("Proparcel_text", "")
        
        print(f"[{idx}/{total_cities}] İşleniyor: {city_name}")
        
        towns_data = get_towns_by_city_id(city_id) if city_id else []
        
        towns_list = []
        for town in towns_data:
            town_id = town.get("Id")
            quarters_data = get_quarters_by_town_id(town_id) if town_id else []
            
            towns_list.append({
                "Id": town.get("Id"),
                "Proparcel_text": town.get("Proparcel_text"),
                "Tkgm_value": town.get("Tkgm_value"),
                "Quarters": quarters_data
            })
            result["total_quarters"] += len(quarters_data)
        
        result["cities"].append({
            "Id": city.get("Id"),
            "Proparcel_text": city.get("Proparcel_text"),
            "Tkgm_value": city.get("Tkgm_value"),
            "CityPlaka": city.get("CityPlaka"),
            "Towns": towns_list
        })
        result["total_towns"] += len(towns_list)
    
    result["total_cities"] = len(result["cities"])
    
    # JSON dosyasını kaydet
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n[OK] JSON dosyasi olusturuldu: {output_path}")
    print(f"  - Toplam Il: {result['total_cities']}")
    print(f"  - Toplam Ilce: {result['total_towns']}")
    print(f"  - Toplam Mahalle: {result['total_quarters']}")
    
    return result


if __name__ == "__main__":
    # Output path: mobil proje içinde assets veya data klasörü
    script_dir = Path(__file__).parent
    frontend_dir = script_dir.parent / "frontend"
    
    # JSON dosyasını frontend/src/data/ altına kaydet (aktif import yolu)
    output_path = frontend_dir / "src" / "data" / "locations.json"
    
    try:
        generate_locations_json(output_path)
        print("\n[OK] Islem basariyla tamamlandi!")
    except Exception as e:
        print(f"\n[ERROR] Hata olustu: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

