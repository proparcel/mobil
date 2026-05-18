"""
3D Models Listesi Endpoint Test Scripti
Django ve FastAPI endpoint'lerini test eder ve performans karşılaştırması yapar.
"""
import requests
import time
import json
from typing import Dict, Any, List
from datetime import datetime

# Test URL'leri
DJANGO_URL = "http://127.0.0.1:8000/api/3d-models-list/"
FASTAPI_URL = "http://127.0.0.1:8001/api/3d-models-list/"

def test_endpoint(url: str, name: str) -> Dict[str, Any]:
    """
    Bir endpoint'i test eder ve sonuçları döndürür.
    
    Args:
        url: Test edilecek endpoint URL'i
        name: Endpoint adı (Django veya FastAPI)
    
    Returns:
        Test sonuçları dictionary'si
    """
    result = {
        "name": name,
        "url": url,
        "success": False,
        "status_code": None,
        "response_time_ms": None,
        "model_count": 0,
        "categories": [],
        "error": None,
        "timestamp": datetime.now().isoformat()
    }
    
    try:
        start_time = time.time()
        response = requests.get(url, timeout=65)  # 65 saniye timeout
        elapsed_time = (time.time() - start_time) * 1000  # milliseconds
        
        result["response_time_ms"] = round(elapsed_time, 2)
        result["status_code"] = response.status_code
        
        if response.status_code == 200:
            try:
                data = response.json()
                result["success"] = True
                
                # Kategori ve model sayılarını hesapla
                total_models = 0
                categories = []
                for category, models in data.items():
                    if isinstance(models, list):
                        count = len(models)
                        total_models += count
                        categories.append({
                            "name": category,
                            "count": count
                        })
                
                result["model_count"] = total_models
                result["categories"] = categories
                
            except json.JSONDecodeError as e:
                result["error"] = f"JSON decode hatası: {str(e)}"
        else:
            result["error"] = f"HTTP {response.status_code}: {response.text[:200]}"
            
    except requests.exceptions.Timeout:
        result["error"] = "Timeout (65 saniye aşıldı)"
    except requests.exceptions.ConnectionError:
        result["error"] = "Bağlantı hatası (Server çalışmıyor olabilir)"
    except Exception as e:
        result["error"] = f"Beklenmeyen hata: {str(e)}"
    
    return result

def print_results(results: List[Dict[str, Any]]):
    """Test sonuçlarını güzel formatta yazdırır."""
    print("\n" + "="*80)
    print("3D MODELS LIST ENDPOINT TEST SONUÇLARI")
    print("="*80)
    print(f"Test Zamanı: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80 + "\n")
    
    for result in results:
        print(f"📡 {result['name']} Endpoint")
        print(f"   URL: {result['url']}")
        print(f"   Durum: {'✅ BAŞARILI' if result['success'] else '❌ BAŞARISIZ'}")
        
        if result['success']:
            print(f"   Yanıt Süresi: {result['response_time_ms']} ms")
            print(f"   Toplam Model: {result['model_count']}")
            print(f"   Kategoriler:")
            for cat in result['categories']:
                print(f"      - {cat['name']}: {cat['count']} model")
        else:
            print(f"   Hata: {result['error']}")
            if result['status_code']:
                print(f"   HTTP Status: {result['status_code']}")
        
        print()
    
    # Karşılaştırma
    successful_results = [r for r in results if r['success']]
    if len(successful_results) == 2:
        django_result = next(r for r in successful_results if r['name'] == 'Django')
        fastapi_result = next(r for r in successful_results if r['name'] == 'FastAPI')
        
        print("="*80)
        print("PERFORMANS KARŞILAŞTIRMASI")
        print("="*80)
        
        django_time = django_result['response_time_ms']
        fastapi_time = fastapi_result['response_time_ms']
        
        if django_time < fastapi_time:
            faster = "Django"
            slower = "FastAPI"
            diff = fastapi_time - django_time
            diff_percent = (diff / fastapi_time) * 100
        else:
            faster = "FastAPI"
            slower = "Django"
            diff = django_time - fastapi_time
            diff_percent = (diff / django_time) * 100
        
        print(f"⚡ Daha Hızlı: {faster} ({min(django_time, fastapi_time)} ms)")
        print(f"🐌 Daha Yavaş: {slower} ({max(django_time, fastapi_time)} ms)")
        print(f"📊 Fark: {diff:.2f} ms (%{diff_percent:.1f})")
        
        # Model sayısı karşılaştırması
        if django_result['model_count'] != fastapi_result['model_count']:
            print(f"\n⚠️  UYARI: Model sayıları farklı!")
            print(f"   Django: {django_result['model_count']} model")
            print(f"   FastAPI: {fastapi_result['model_count']} model")
        else:
            print(f"\n✅ Model sayıları eşit: {django_result['model_count']} model")
        
        print()
    
    elif len(successful_results) == 1:
        print("="*80)
        print("⚠️  UYARI: Sadece bir endpoint başarılı oldu")
        print("="*80)
        print(f"✅ Çalışan: {successful_results[0]['name']}")
        failed = [r for r in results if not r['success']]
        for f in failed:
            print(f"❌ Çalışmayan: {f['name']} - {f['error']}")
        print()
    
    else:
        print("="*80)
        print("❌ HATA: Hiçbir endpoint çalışmıyor!")
        print("="*80)
        for result in results:
            print(f"   {result['name']}: {result['error']}")
        print()

def main():
    """Ana test fonksiyonu."""
    print("3D Models Listesi Endpoint Test Başlatılıyor...")
    print("Django ve FastAPI endpoint'leri test ediliyor...\n")
    
    results = []
    
    # Django endpoint testi
    print("🔄 Django endpoint test ediliyor...")
    django_result = test_endpoint(DJANGO_URL, "Django")
    results.append(django_result)
    
    # Kısa bir bekleme
    time.sleep(1)
    
    # FastAPI endpoint testi
    print("🔄 FastAPI endpoint test ediliyor...")
    fastapi_result = test_endpoint(FASTAPI_URL, "FastAPI")
    results.append(fastapi_result)
    
    # Sonuçları yazdır
    print_results(results)
    
    # JSON dosyasına kaydet
    output_file = "test_results_3d_models.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"📄 Sonuçlar kaydedildi: {output_file}")

if __name__ == "__main__":
    main()
