"""
pp33 Django referans uygulaması — mobil repo kopya şablonu.

Hedef: proparcel_v1 (C:\\proparcel) içinde myapp/views/ veya urls.py'ye entegre edin.
Mevcut smart_query Whisper + Chat servislerini import ederek duplicate etmeyin.

URL:
    path("api/voice_registration_field_extract/", voice_registration_field_extract),

Auth:
    @permission_classes([AllowAny])
    throttle_classes = [AnonRateThrottle]  # settings'te tanımlı scope
"""

from __future__ import annotations

import base64
import json
import re
from typing import Any

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle

# pp33: mevcut modüllerden import edin
# from myapp.services.smart_query_openai import transcribe_audio_bytes, chat_json_extract
# from myapp.services.location_resolver import resolve_location_from_text

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
ALLOWED_FIELDS = {
    "full_name",
    "phone",
    "email",
    "location",
    "address_detail",
    "company_name",
    "company_license_no",
    "spk_tc_no",
    "office_no",
    "consultant_license_no",
    "consultant_company",
    "corporate_type",
}

TURKISH_DIGIT_MAP = {
    "sıfır": "0",
    "sfir": "0",
    "bir": "1",
    "iki": "2",
    "üç": "3",
    "uc": "3",
    "dört": "4",
    "dort": "4",
    "beş": "5",
    "bes": "5",
    "altı": "6",
    "alti": "6",
    "yedi": "7",
    "sekiz": "8",
    "dokuz": "9",
}


def _error(field: str, raw_text: str, code: str, message: str) -> dict[str, Any]:
    return {
        "ok": False,
        "field": field,
        "raw_text": raw_text,
        "value": None,
        "is_valid": False,
        "error": code,
        "message": message,
    }


def _success(field: str, raw_text: str, value: Any) -> dict[str, Any]:
    return {
        "ok": True,
        "field": field,
        "raw_text": raw_text,
        "value": value,
        "is_valid": True,
        "message": None,
    }


def _normalize_spoken_digits(text: str) -> str:
    lower = text.lower()
    for word, digit in TURKISH_DIGIT_MAP.items():
        lower = re.sub(rf"\b{word}\b", digit, lower)
    return re.sub(r"\D", "", lower)


def _normalize_email_from_speech(raw: str) -> str:
    t = raw.lower().strip()
    t = t.replace(" kuyruklu a ", "@").replace(" kuyruklu-a ", "@")
    t = re.sub(r"\b(et|at)\b", "@", t)
    t = re.sub(r"\b(nokta|dot)\b", ".", t)
    t = re.sub(r"\balt çizgi\b", "_", t)
    t = re.sub(r"\btire\b", "-", t)
    t = re.sub(r"\s+", "", t)
    return t


def _validate_field(field: str, value: Any, context: dict[str, Any]) -> tuple[bool, str | None, str | None]:
    if field == "full_name":
        parts = str(value or "").strip().split()
        if len(parts) < 2:
            return False, "invalid_name", "Lütfen adınızı ve soyadınızı birlikte söyleyin."
        return True, None, None

    if field == "phone":
        digits = _normalize_spoken_digits(str(value or ""))
        if len(digits) == 11 and digits.startswith("0"):
            digits = digits[1:]
        if len(digits) != 10 or not digits.startswith("5"):
            return False, "invalid_phone", "Telefon numarası doğru algılanamadı."
        return True, None, None

    if field == "email":
        normalized = _normalize_email_from_speech(str(value or ""))
        if not EMAIL_REGEX.match(normalized):
            return False, "invalid_email", "E-posta adresi doğru algılanamadı."
        return True, None, None

    if field == "location":
        loc = value if isinstance(value, dict) else {}
        if not loc.get("quarter_id"):
            return False, "invalid_location", "İl, ilçe ve mahalle eşleştirilemedi."
        return True, None, None

    if field == "address_detail":
        if len(str(value or "").strip()) < 8:
            return False, "invalid_address", "Açık adres detayı doğru algılanamadı."
        return True, None, None

    if field == "spk_tc_no":
        digits = _normalize_spoken_digits(str(value or ""))
        if len(digits) != 11:
            return False, "invalid_field", "SPK için 11 haneli TC kimlik no gereklidir."
        return True, None, None

    if field in {"company_license_no", "office_no", "consultant_license_no"}:
        if not str(value or "").strip():
            return False, "invalid_license", "Belge numarası algılanamadı."
        return True, None, None

    if field == "consultant_company":
        if not isinstance(value, dict) or not value.get("company_profile_id"):
            return False, "company_not_found", "Firma eşleştirilemedi."
        return True, None, None

    return True, None, None


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AnonRateThrottle])
@require_POST
def voice_registration_field_extract(request):
    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse(_error("", "", "invalid_audio", "Geçersiz istek."), status=400)

    field = str(body.get("field") or "").strip()
    audio_b64 = str(body.get("audio") or "").strip()
    mime_type = str(body.get("mimeType") or "audio/m4a").strip()
    context = body.get("context") or {}

    if field not in ALLOWED_FIELDS:
        return JsonResponse(_error(field, "", "invalid_field", "Desteklenmeyen alan."), status=400)

    if not audio_b64:
        return JsonResponse(_error(field, "", "invalid_audio", "Ses verisi boş."), status=400)

    try:
        audio_bytes = base64.b64decode(audio_b64)
    except Exception:
        return JsonResponse(_error(field, "", "invalid_audio", "Ses verisi okunamadı."), status=400)

    # pp33: Whisper
    # raw_text = transcribe_audio_bytes(audio_bytes, mime_type)
    raw_text = ""  # placeholder — pp33'te gerçek transkripsiyon

    if not raw_text:
        return JsonResponse(
            _error(field, "", "transcription_failed", "Ses metne çevrilemedi."),
            status=422,
        )

    # pp33: field bazlı Chat JSON extraction (telefon/e-posta → OpenAI rakam/metin döndürür)
    # phone: _extract_phone_from_transcript → {"value": "5385813499"}
    # email: _extract_email_from_transcript
    extracted: Any = raw_text

    if field == "email":
        extracted = _normalize_email_from_speech(raw_text)
    elif field == "phone":
        extracted = _normalize_spoken_digits(raw_text)
        if len(extracted) == 11 and extracted.startswith("0"):
            extracted = extracted[1:]
    elif field == "location":
        # extracted = resolve_location_from_text(raw_text)
        extracted = {"il": raw_text}  # placeholder
    elif field == "consultant_company":
        # extracted = match_registration_company(raw_text)
        extracted = None

    ok, err_code, err_msg = _validate_field(field, extracted, context)
    if not ok:
        return JsonResponse(_error(field, raw_text, err_code or "invalid_field", err_msg or ""), status=200)

    return JsonResponse(_success(field, raw_text, extracted))
