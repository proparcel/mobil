from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import sys
import base64
import io
# Google Cloud imports - lazy loading (sadece gerektiğinde import et)
# from google.cloud import speech_v1
# from google.cloud import vision_v1


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging early
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Mobile backend Mongo-only çalışır.

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


def _get_mongo_client():
    from pymongo import MongoClient

    uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    return MongoClient(uri, serverSelectionTimeoutMS=2500)


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.get("/health")
async def health_check():
    """Backend health check endpoint"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "database": "checking..."
    }

@api_router.get("/health/db")
async def health_check_db():
    """Database health check endpoint"""
    try:
        client = _get_mongo_client()
        client.admin.command("ping")
        db_name = os.environ.get("MONGO_USER_DB", "UserDb")
        return {
            "status": "ok",
            "database": db_name,
            "message": "Bağlantı başarılı"
        }
    except Exception as e:
        return {
            "status": "error",
            "database": "UserDb",
            "message": str(e)
        }

# Status endpoint'leri kaldırıldı


class SpeechToTextRequest(BaseModel):
    audio: str  # Base64 encoded audio
    mimeType: str = "audio/m4a"

class TextQueryRequest(BaseModel):
    text: str

class ImageQueryExtractRequest(BaseModel):
    image: str

class ImageToTextRequest(BaseModel):
    image: str  # Base64 encoded image
    mimeType: str  # image/jpeg, image/png, etc.

class TkgmViewRequest(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    mahalleTkgmValue: Optional[int] = None
    ada: Optional[str] = None
    parsel: Optional[str] = None
    map_mode: Optional[str] = None
    is3D: Optional[bool] = None

class ParcelInfoRequest(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    mahalle: Optional[str] = None
    mahalleTkgmValue: Optional[int] = None
    ada: Optional[str] = None
    parsel: Optional[str] = None
    map_mode: Optional[str] = None
    is3D: Optional[bool] = None
    tkgm_data: Optional[Dict[str, Any]] = None
    property_type_override: Optional[str] = None


class MobileRerunRequest(BaseModel):
    """
    Mobil kayıtlı sorgu seçimi sonrası, Django'daki /api/mobile/rerun_parcel_info/ endpoint'ine proxy istek.
    """
    proparcel_value: Optional[Any] = None
    tkgm_value: Optional[Any] = None
    ada: Optional[str] = None
    parsel: Optional[str] = None
    map_mode: Optional[str] = None
    is3D: Optional[bool] = None
    include_valuation: Optional[bool] = None


@api_router.post("/speech-to-text")
async def speech_to_text(request: SpeechToTextRequest):
    """
    Google Cloud Speech-to-Text API ile ses kaydını metne çevirir.
    """
    import time
    start_time = time.time()
    
    try:
        logger.info("=" * 50)
        logger.info(f"[{time.strftime('%H:%M:%S')}] Speech-to-Text isteği alındı")
        logger.info(f"MIME Type: {request.mimeType}")
        logger.info(f"Audio data boyutu: {len(request.audio)} karakter (base64)")
        
        # Google Cloud credentials path'i
        credentials_path = os.environ.get(
            'GOOGLE_APPLICATION_CREDENTIALS',
            r"C:\Users\user\OneDrive\Desktop\2-Yazilim\8-ProParcel\105-Google\api-project-1091364358970-8308473bfade.json"
        )
        
        logger.info(f"Credentials path kontrol ediliyor: {credentials_path}")
        if not os.path.exists(credentials_path):
            error_msg = f"Google credentials dosyası bulunamadı: {credentials_path}"
            logger.error(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
        logger.info("✓ Credentials dosyası bulundu")
        
        # Base64'ü decode et
        logger.info("Base64 decode başlıyor...")
        decode_start = time.time()
        audio_bytes = base64.b64decode(request.audio)
        decode_duration = time.time() - decode_start
        logger.info(f"✓ Base64 decode tamamlandı ({decode_duration:.2f}s)")
        logger.info(f"Decode edilen audio boyutu: {len(audio_bytes)} bytes ({len(audio_bytes)/1024:.2f} KB)")
        
        # Speech client oluştur
        logger.info("Speech client oluşturuluyor...")
        client_start = time.time()
        client = speech_v1.SpeechClient.from_service_account_json(credentials_path)
        client_duration = time.time() - client_start
        logger.info(f"✓ Speech client oluşturuldu ({client_duration:.2f}s)")
        
        # MIME type'a göre encoding belirle
        mime_lower = request.mimeType.lower()
        logger.info(f"MIME type analizi: {mime_lower}")
        if "m4a" in mime_lower or "mp4" in mime_lower:
            encoding = speech_v1.RecognitionConfig.AudioEncoding.MP3
            logger.info("Encoding: MP3 (M4A/MP4 için)")
        elif "mp3" in mime_lower:
            encoding = speech_v1.RecognitionConfig.AudioEncoding.MP3
            logger.info("Encoding: MP3")
        elif "wav" in mime_lower:
            encoding = speech_v1.RecognitionConfig.AudioEncoding.LINEAR16
            logger.info("Encoding: LINEAR16 (WAV için)")
        elif "flac" in mime_lower:
            encoding = speech_v1.RecognitionConfig.AudioEncoding.FLAC
            logger.info("Encoding: FLAC")
        else:
            encoding = speech_v1.RecognitionConfig.AudioEncoding.MP3
            logger.info(f"Encoding: MP3 (varsayılan, MIME type: {mime_lower})")
        
        # Audio config
        logger.info("Recognition config oluşturuluyor...")
        config = speech_v1.RecognitionConfig(
            encoding=encoding,
            sample_rate_hertz=44100,
            language_code="tr-TR",
            enable_automatic_punctuation=True,
            alternative_language_codes=["en-US"],
        )
        logger.info("✓ Config oluşturuldu (tr-TR, 44100Hz)")
        
        # Audio content
        logger.info("Audio content hazırlanıyor...")
        audio = speech_v1.RecognitionAudio(content=audio_bytes)
        logger.info("✓ Audio content hazırlandı")
        
        # Recognition yap
        logger.info("=" * 50)
        logger.info("🚀 Google Speech-to-Text API'ye istek gönderiliyor...")
        logger.info(f"Bu işlem birkaç saniye sürebilir (audio boyutu: {len(audio_bytes)/1024:.2f} KB)")
        recognition_start = time.time()
        
        try:
            response = client.recognize(config=config, audio=audio)
        except Exception as api_err:
            recognition_duration = time.time() - recognition_start
            error_str = str(api_err)
            
            # Billing hatası kontrolü
            if "BILLING_DISABLED" in error_str or "billing" in error_str.lower() or "403" in error_str:
                logger.error("=" * 50)
                logger.error("⚠️  BİLLİNG HATASI: Google Cloud Speech-to-Text API için billing aktif değil!")
                logger.error("=" * 50)
                logger.error("Çözüm:")
                logger.error("1. https://console.developers.google.com/billing/enable?project=1091364358970")
                logger.error("2. Projeye billing hesabı bağlayın")
                logger.error("3. Birkaç dakika bekleyin ve tekrar deneyin")
                logger.error("=" * 50)
                raise HTTPException(
                    status_code=402,
                    detail="Google Cloud Speech-to-Text API için billing aktif değil. Lütfen Google Cloud Console'da billing'i aktif edin: https://console.developers.google.com/billing/enable?project=1091364358970"
                )
            raise
        
        recognition_duration = time.time() - recognition_start
        logger.info(f"✓ Google API yanıtı alındı ({recognition_duration:.2f}s)")
        logger.info(f"Yanıt results sayısı: {len(response.results) if response.results else 0}")
        
        # Sonucu birleştir
        logger.info("Sonuçlar işleniyor...")
        transcript = ""
        if response.results:
            for idx, result in enumerate(response.results):
                if result.alternatives:
                    alt_text = result.alternatives[0].transcript
                    confidence = result.alternatives[0].confidence if hasattr(result.alternatives[0], 'confidence') else None
                    transcript += alt_text + " "
                    logger.info(f"  Result {idx+1}: '{alt_text}' (confidence: {confidence})")
        else:
            logger.warning("⚠️ Response'da result yok!")
        
        if not transcript.strip():
            error_msg = "Ses kaydından metin çıkarılamadı. Lütfen tekrar deneyin."
            logger.warning(f"⚠️ {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        total_duration = time.time() - start_time
        logger.info("=" * 50)
        logger.info(f"✅ İşlem başarıyla tamamlandı (Toplam süre: {total_duration:.2f}s)")
        logger.info(f"Transkripsiyon: '{transcript.strip()}'")
        logger.info("=" * 50)
        
        return {
            "text": transcript.strip(),
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        error_detail = f"Speech-to-Text hatası ({total_duration:.2f}s): {str(e)}"
        logger.error("=" * 50)
        logger.error(f"❌ {error_detail}", exc_info=True)
        logger.error("=" * 50)
        raise HTTPException(status_code=500, detail=f"Ses işleme hatası: {str(e)}")


@api_router.post("/image-to-text")
async def image_to_text(request: ImageToTextRequest):
    """
    Google Cloud Vision API ile resimden metin çıkarır (OCR).
    """
    import time
    start_time = time.time()
    
    try:
        logger.info("=" * 50)
        logger.info(f"[{time.strftime('%H:%M:%S')}] Image-to-Text (OCR) isteği alındı")
        logger.info(f"Image data boyutu: {len(request.image)} karakter (base64)")
        
        # Google Cloud credentials path'i
        credentials_path = os.environ.get(
            'GOOGLE_APPLICATION_CREDENTIALS',
            r"C:\Users\user\OneDrive\Desktop\2-Yazilim\8-ProParcel\105-Google\api-project-1091364358970-8308473bfade.json"
        )
        
        logger.info(f"Credentials path kontrol ediliyor: {credentials_path}")
        if not os.path.exists(credentials_path):
            error_msg = f"Google credentials dosyası bulunamadı: {credentials_path}"
            logger.error(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
        logger.info("✓ Credentials dosyası bulundu")
        
        # Base64'ü decode et
        logger.info("Base64 decode başlıyor...")
        decode_start = time.time()
        image_bytes = base64.b64decode(request.image)
        decode_duration = time.time() - decode_start
        logger.info(f"✓ Base64 decode tamamlandı ({decode_duration:.2f}s)")
        logger.info(f"Decode edilen image boyutu: {len(image_bytes)} bytes ({len(image_bytes)/1024:.2f} KB)")
        
        # Vision client oluştur
        logger.info("Vision client oluşturuluyor...")
        client_start = time.time()
        client = vision_v1.ImageAnnotatorClient.from_service_account_json(credentials_path)
        client_duration = time.time() - client_start
        logger.info(f"✓ Vision client oluşturuldu ({client_duration:.2f}s)")
        
        # Image oluştur
        logger.info("Image object hazırlanıyor...")
        image = vision_v1.Image(content=image_bytes)
        logger.info("✓ Image object hazırlandı")
        
        # OCR yap
        logger.info("=" * 50)
        logger.info("🚀 Google Vision API OCR'ye istek gönderiliyor...")
        logger.info(f"Bu işlem birkaç saniye sürebilir (image boyutu: {len(image_bytes)/1024:.2f} KB)")
        ocr_start = time.time()
        
        try:
            response = client.text_detection(image=image)
        except Exception as api_err:
            ocr_duration = time.time() - ocr_start
            error_str = str(api_err)
            
            # Billing hatası kontrolü
            if "BILLING_DISABLED" in error_str or "billing" in error_str.lower() or "403" in error_str:
                logger.error("=" * 50)
                logger.error("⚠️  BİLLİNG HATASI: Google Cloud Vision API için billing aktif değil!")
                logger.error("=" * 50)
                logger.error("Çözüm:")
                logger.error("1. https://console.developers.google.com/billing/enable?project=1091364358970")
                logger.error("2. Projeye billing hesabı bağlayın")
                logger.error("3. Vision API'yi etkinleştirin")
                logger.error("=" * 50)
                raise HTTPException(
                    status_code=402,
                    detail="Google Cloud Vision API için billing aktif değil. Lütfen Google Cloud Console'da billing'i aktif edin ve Vision API'yi etkinleştirin."
                )
            raise
        
        ocr_duration = time.time() - ocr_start
        logger.info(f"✓ Google Vision API yanıtı alındı ({ocr_duration:.2f}s)")
        
        # Metni çıkar
        logger.info("OCR sonuçları işleniyor...")
        texts = response.text_annotations
        extracted_text = ""
        
        if texts:
            # İlk text annotation genellikle tüm metni içerir
            extracted_text = texts[0].description
            logger.info(f"✓ OCR tamamlandı, {len(texts)} text annotation bulundu")
            logger.info(f"Çıkarılan metin uzunluğu: {len(extracted_text)} karakter")
            
            # Eğer birden fazla text varsa, hepsini birleştir
            if len(texts) > 1:
                logger.info(f"Detaylı text annotations ({len(texts) - 1} adet):")
                for idx, text in enumerate(texts[1:6], 1):  # İlk 5 detaylı sonucu göster
                    logger.info(f"  Text {idx}: '{text.description[:50]}...'")
        else:
            logger.warning("⚠️ OCR sonucunda metin bulunamadı!")
        
        if not extracted_text.strip():
            error_msg = "Resimden metin çıkarılamadı. Lütfen daha net bir resim seçin."
            logger.warning(f"⚠️ {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        total_duration = time.time() - start_time
        logger.info("=" * 50)
        logger.info(f"✅ OCR işlemi başarıyla tamamlandı (Toplam süre: {total_duration:.2f}s)")
        logger.info(f"Çıkarılan metin: '{extracted_text[:200]}...'")
        logger.info("=" * 50)
        
        return {
            "text": extracted_text.strip(),
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - start_time
        error_detail = f"Image-to-Text hatası ({total_duration:.2f}s): {str(e)}"
        logger.error("=" * 50)
        logger.error(f"❌ {error_detail}", exc_info=True)
        logger.error("=" * 50)
        raise HTTPException(status_code=500, detail=f"Resim işleme hatası: {str(e)}")


@api_router.post("/text-query-extract")
async def text_query_extract(request: TextQueryRequest):
    """
    Django backend'deki text_query_extract endpoint'ine proxy yapar.
    """
    try:
        # Django backend URL'i
        django_url = os.environ.get(
            'DJANGO_API_URL',
            'http://127.0.0.1:7000'  # Django localhost
        )
        
        import requests
        
        response = requests.post(
            f"{django_url}/api/text_query_extract/",
            json={"text": request.text},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response.status_code != 200:
            logger.error(f"Django API hatası: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Django API hatası: {response.text[:200]}"
            )
        
        return response.json()
        
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Django bağlantı hatası: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Django backend'e bağlanılamadı. Lütfen Django sunucusunun çalıştığından emin olun."
        )
    except requests.exceptions.Timeout as e:
        logger.error(f"Django timeout hatası: {e}")
        raise HTTPException(
            status_code=504,
            detail="Django backend yanıt vermedi. Lütfen tekrar deneyin."
        )
    except requests.exceptions.RequestException as e:
        logger.error(f"Text query extract hatası: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Text query işleme hatası: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Text query extract genel hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Beklenmeyen hata: {str(e)}"
        )


@api_router.post("/image-query-extract")
async def image_query_extract(request: ImageQueryExtractRequest):
    """
    Django backend'deki image_query_extract endpoint'ine proxy yapar.
    """
    try:
        django_url = os.environ.get(
            'DJANGO_API_URL',
            'http://127.0.0.1:7000'
        )

        import requests

        response = requests.post(
            f"{django_url}/api/image_query_extract/",
            json={"image": request.image},
            headers={"Content-Type": "application/json"},
            timeout=60
        )

        if response.status_code != 200:
            logger.error(f"Django image query API hatası: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Django API hatası: {response.text[:200]}"
            )

        return response.json()

    except requests.exceptions.ConnectionError as e:
        logger.error(f"Django bağlantı hatası: {e}")
        raise HTTPException(
            status_code=503,
            detail="Django backend'e bağlanılamadı. Lütfen Django sunucusunun çalıştığından emin olun."
        )
    except requests.exceptions.Timeout as e:
        logger.error(f"Django timeout hatası: {e}")
        raise HTTPException(
            status_code=504,
            detail="Django backend yanıt vermedi. Lütfen tekrar deneyin."
        )
    except requests.exceptions.RequestException as e:
        logger.error(f"Image query extract hatası: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Image query işleme hatası: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Image query extract genel hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Beklenmeyen hata: {str(e)}"
        )


@api_router.post("/mobile/rerun_parcel_info")
@api_router.post("/mobile/rerun_parcel_info/")  # Trailing slash desteği
async def mobile_rerun_parcel_info_proxy(request: MobileRerunRequest):
    """
    Django /api/mobile/rerun_parcel_info/ endpoint'ine proxy isteği gönderir.
    Mobil kayıtlı sorgu seçimi sonrası "rerun" akışı için kullanılır.
    """
    try:
        django_url = os.environ.get(
            "DJANGO_API_URL",
            "http://127.0.0.1:7000"
        )

        import requests

        body = request.model_dump(exclude_none=True)

        logger.info(f"Mobile rerun proxy isteği: {list(body.keys())}")
        logger.info(f"Django URL: {django_url}/api/mobile/rerun_parcel_info/")

        response = requests.post(
            f"{django_url}/api/mobile/rerun_parcel_info/",
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=120
        )

        logger.info(f"Django yanıt status: {response.status_code}")

        if response.status_code == 404:
            try:
                error_data = response.json()
                raise HTTPException(
                    status_code=404,
                    detail=error_data.get("error", "Parsel Bulunamadı")
                )
            except Exception:
                raise HTTPException(status_code=404, detail="Parsel Bulunamadı")

        if response.status_code != 200:
            logger.error(f"Django mobile rerun API hatası: {response.status_code} - {response.text[:500]}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Django API hatası: {response.text[:200]}"
            )

        return response.json()

    except HTTPException:
        raise
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Django bağlantı hatası: {e}")
        raise HTTPException(
            status_code=503,
            detail="Django backend'e bağlanılamadı. Lütfen Django sunucusunun çalıştığından emin olun."
        )
    except requests.exceptions.Timeout as e:
        logger.error(f"Django timeout hatası: {e}")
        raise HTTPException(
            status_code=504,
            detail="Django backend yanıt vermedi. Lütfen tekrar deneyin."
        )
    except Exception as e:
        logger.error(f"Mobile rerun proxy hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Beklenmeyen hata: {str(e)}"
        )


@api_router.post("/tkgm_view")
@api_router.post("/tkgm_view/")  # Trailing slash desteği
async def tkgm_view_proxy(request: TkgmViewRequest):
    """
    Django /api/tkgm_view/ endpoint'ine proxy isteği gönderir.
    TKGM modunda basit parsel verisi döner.
    """
    try:
        django_url = os.environ.get(
            'DJANGO_API_URL',
            'http://127.0.0.1:7000'
        )
        
        import requests
        
        # Request body'yi hazırla
        body = request.model_dump(exclude_none=True)
        
        logger.info(f"TKGM View proxy isteği: {list(body.keys())}")
        logger.info(f"Django URL: {django_url}/api/tkgm_view/")
        
        response = requests.post(
            f"{django_url}/api/tkgm_view/",
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        logger.info(f"Django yanıt status: {response.status_code}")
        
        if response.status_code == 404:
            # Parsel bulunamadı durumu - özel olarak handle et
            try:
                error_data = response.json()
                raise HTTPException(
                    status_code=404,
                    detail=error_data.get("error", "Parsel Bulunamadı")
                )
            except:
                raise HTTPException(
                    status_code=404,
                    detail="Parsel Bulunamadı"
                )
        
        if response.status_code != 200:
            logger.error(f"Django TKGM View API hatası: {response.status_code} - {response.text[:500]}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Django API hatası: {response.text[:200]}"
            )
        
        return response.json()
        
    except HTTPException:
        raise
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Django bağlantı hatası: {e}")
        raise HTTPException(
            status_code=503,
            detail="Django backend'e bağlanılamadı. Lütfen Django sunucusunun çalıştığından emin olun."
        )
    except requests.exceptions.Timeout as e:
        logger.error(f"Django timeout hatası: {e}")
        raise HTTPException(
            status_code=504,
            detail="Django backend yanıt vermedi. Lütfen tekrar deneyin."
        )
    except Exception as e:
        logger.error(f"TKGM View proxy hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Beklenmeyen hata: {str(e)}"
        )


@api_router.post("/get_parcel_info")
async def get_parcel_info_proxy(request: ParcelInfoRequest):
    """
    Django /api/get_parcel_info/ endpoint'ine proxy isteği gönderir.
    Pro mod sorgusu - tam analiz sonuçları döner.
    """
    try:
        django_url = os.environ.get(
            'DJANGO_API_URL',
            'http://127.0.0.1:7000'
        )
        
        import requests
        
        # Request body'yi hazırla
        body = request.model_dump(exclude_none=True)
        
        logger.info(f"Parcel Info proxy isteği: {list(body.keys())}")
        
        response = requests.post(
            f"{django_url}/api/get_parcel_info/",
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=120  # Pro mod sorguları daha uzun sürebilir
        )
        
        if response.status_code == 404:
            # Parsel bulunamadı durumu
            try:
                error_data = response.json()
                raise HTTPException(
                    status_code=404,
                    detail=error_data.get("error", "Parsel Bulunamadı")
                )
            except:
                raise HTTPException(
                    status_code=404,
                    detail="Parsel Bulunamadı"
                )
        
        if response.status_code != 200:
            logger.error(f"Django Parcel Info API hatası: {response.status_code} - {response.text[:500]}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Django API hatası: {response.text[:200]}"
            )
        
        return response.json()
        
    except HTTPException:
        raise
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Django bağlantı hatası: {e}")
        raise HTTPException(
            status_code=503,
            detail="Django backend'e bağlanılamadı. Lütfen Django sunucusunun çalıştığından emin olun."
        )
    except requests.exceptions.Timeout as e:
        logger.error(f"Django timeout hatası: {e}")
        raise HTTPException(
            status_code=504,
            detail="Django backend yanıt vermedi. Lütfen tekrar deneyin."
        )
    except Exception as e:
        logger.error(f"Parcel Info proxy hatası: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Beklenmeyen hata: {str(e)}"
        )


# NOT: /tkgm_view ve /get_parcel_info route'ları yukarıda zaten tanımlı.
# Çift tanım kaldırıldı (FastAPI'de duplicate route soruna yol açar).


@api_router.get("/3d-models-list")
@api_router.get("/3d-models-list/")  # Trailing slash desteği
async def get_3d_models_list():
    """
    Django backend'den 3D model listesini proxy ederek döndürür.
    """
    logger.info("=" * 50)
    logger.info("[3d-models-list] İstek alındı")
    start_time = datetime.now()
    
    try:
        import requests
        django_url = os.environ.get("DJANGO_API_URL", "http://127.0.0.1:7000")
        response = requests.get(f"{django_url}/api/3d-models-list/", timeout=60)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text[:300])
        models_data = response.json()
        total_models = sum(len(v) for v in models_data.values()) if isinstance(models_data, dict) else 0
        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"[3d-models-list] ✅ Başarılı! Toplam {total_models} model, süre: {duration:.2f}s")
        logger.info("=" * 50)
        return models_data
            
    except HTTPException:
        raise
    except Exception as e:
        duration = (datetime.now() - start_time).total_seconds()
        logger.error(f"[3d-models-list] ❌ Beklenmeyen hata (süre: {duration:.2f}s): {e}", exc_info=True)
        logger.info("=" * 50)
        raise HTTPException(
            status_code=500,
            detail=f"Beklenmeyen hata: {str(e)}"
        )


@api_router.get("/locations/all")
async def get_all_locations():
    """
    Tüm il, ilçe ve mahalle verilerini hiyerarşik yapıda döndürür.
    Her mahalle için Proparcel_value ve diğer gerekli alanları içerir.
    """
    try:
        import requests
        django_url = os.environ.get("DJANGO_API_URL", "http://127.0.0.1:7000")
        response = requests.get(f"{django_url}/api/all_locations/", timeout=60)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text[:300])
        return response.json()
    except Exception as e:
        logger.error(f"Konum verileri alınırken hata: {e}")
        raise HTTPException(status_code=500, detail=f"Veri alınırken hata oluştu: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

# Request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    import time
    start_time = time.time()
    
    # Log incoming request
    logger.info("=" * 60)
    logger.info(f"📥 INCOMING REQUEST: {request.method} {request.url.path}")
    logger.info(f"   Query params: {dict(request.query_params)}")
    logger.info(f"   Client: {request.client.host if request.client else 'unknown'}")
    
    # Read request body if it exists
    if request.method == "POST":
        body = await request.body()
        if body:
            try:
                import json
                body_json = json.loads(body)
                logger.info(f"   Body keys: {list(body_json.keys()) if isinstance(body_json, dict) else 'N/A'}")
            except:
                logger.info(f"   Body size: {len(body)} bytes (non-JSON)")
    
    # Process request
    response = await call_next(request)
    
    # Log response
    process_time = time.time() - start_time
    logger.info(f"📤 RESPONSE: {response.status_code} ({process_time:.2f}s)")
    logger.info("=" * 60)
    
    return response

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging zaten yukarıda yapılandırıldı


# Run server if this file is executed directly
if __name__ == "__main__":
    import uvicorn
    import sys
    
    port = int(os.environ.get('PORT', 7001))
    host = os.environ.get('HOST', '0.0.0.0')  # Tüm arayüzlerde dinle (mobil erişim için)
    
    logger.info(f"Starting FastAPI server on {host}:{port}")
    logger.info("Server başlatılıyor...")
    
    try:
        # Uvicorn'u en basit şekilde başlat - app objesini direkt geç
        config = uvicorn.Config(
            app=app,
            host=host,
            port=port,
            log_level="info",
            access_log=True
        )
        server = uvicorn.Server(config)
        logger.info(f"Server {host}:{port} adresinde başlatılıyor...")
        server.run()
    except KeyboardInterrupt:
        logger.info("Server kullanıcı tarafından durduruldu")
    except Exception as e:
        logger.error(f"Uvicorn başlatma hatası: {e}", exc_info=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)
