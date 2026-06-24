"""Sesli üyelik — alan bazlı Whisper transkripsiyon + alan çıkarımı."""

from __future__ import annotations

import json
import logging
import re
import time
import urllib.error
import urllib.request
from typing import Any

from myapp.services.smart_query_ai.location_validator import merge_extracted_location
from myapp.services.smart_query_ai.openai_extractor import (
    _openai_api_key,
    _openai_model,
    extract_parcel_from_text,
    parse_json_content,
)
from myapp.services.smart_query_ai.openai_speech import transcribe_audio

logger = logging.getLogger("myapp.voice_registration")

ALLOWED_FIELDS = frozenset(
    {
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
)

MEMBER_TYPES = frozenset({"individual", "consultant", "corporate"})
CORPORATE_TYPES = frozenset({"emlak", "spk", "lihkab"})

EMAIL_REGEX = re.compile(r"^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$")

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

_FIELD_CHAT_SYSTEM = {
    "full_name": (
        "Türkçe konuşma transkriptinden yalnızca kişinin ad ve soyadını çıkar. "
        'JSON döndür: {"value": "Ad Soyad"}. Başka alan ekleme.'
    ),
    "email": (
        "Sen Türkçe sesli kayıt transkriptinden e-posta adresini çıkaran bir asistansın. "
        "Kullanıcı adresi konuşarak söyler; örnek: \"büyük seksen altı et gmail nokta com\". "
        "Kurallar: "
        "1) Çıktı yalnızca geçerli ASCII e-posta olsun (kullanici@domain.com). "
        "2) Türkçe karakter kullanma: ü→u, ö→o, ş→s, ğ→g, ç→c, ı→i. "
        "3) \"et\", \"at\", \"e-posta\" → @ ; \"nokta\", \"dot\" → . "
        "4) \"alt tire\", \"alt çizgi\" → _ ; \"üst tire\" → - "
        "5) Söylenen rakamları rakam olarak yaz (seksen altı → 86). "
        "6) gmail com → gmail.com; boşlukları kaldır. "
        "Transkriptte e-posta yoksa veya emin değilsen {\"value\": null} döndür. "
        'Aksi halde JSON: {"value": "tam@email.com"} — başka alan ekleme.'
    ),
    "phone": (
        "Türkiye cep telefonu transkriptini yalnızca rakamlara çevir. "
        "Kullanıcı gruplu söyleyebilir: 'sıfır beş yüz otuz sekiz, beş yüz seksen bir, otuz dört doksan dokuz'. "
        "10 haneli numara döndür; başında 0 olmasın; 5 ile başlamalı. "
        'JSON: {"value": "5385813499"} — value yalnızca rakam.'
    ),
    "spk_tc_no": (
        "Türkçe konuşmadan TC kimlik numarasını yalnızca rakamlara çevir. "
        "11 hane. "
        'JSON: {"value": "12345678901"} — value yalnızca rakam.'
    ),
    "digits": (
        "Türkçe konuşmadan belge/numara değerini çıkar. "
        'JSON: {"value": "..."} — mümkünse yalnızca rakam ve harf, boşluk yok.'
    ),
    "address_detail": (
        "Türkçe konuşmadan açık adres detayını çıkar (sokak, cadde, kapı no, kat, daire). "
        'JSON: {"value": "..."}.'
    ),
    "company_name": (
        "Türkçe konuşmadan firma / şirket adını çıkar. "
        'JSON: {"value": "..."}.'
    ),
}

REGISTRATION_WHISPER_PROMPTS: dict[str, str] = {
    "email": (
        "Türkçe sesli kayıt e-posta adresi. Kullanıcı e-posta söylüyor. "
        "Örnek: buyuk seksen alti et gmail nokta com. "
        "Et, at, nokta, alt tire, üst tire, gmail, hotmail, outlook, yahoo, com, rakamlar."
    ),
    "phone": (
        "Türkçe cep telefonu numarası kaydı. "
        "Sıfır beş yüz otuz sekiz, telefon numarası, rakamlar."
    ),
    "full_name": "Türkçe ad soyad kaydı. Kişi adını ve soyadını söylüyor.",
    "address_detail": "Türkçe açık adres kaydı. Sokak, cadde, kapı numarası, kat, daire.",
    "company_name": "Türkçe firma adı kaydı.",
    "location": (
        "Türkçe il ilçe mahalle adresi kaydı. Bursa, Osmangazi, mahalle adı."
    ),
}

DEFAULT_REGISTRATION_WHISPER_PROMPT = (
    "Türkçe sesli üyelik formu. Ad, telefon, e-posta, adres, firma bilgisi."
)


def normalize_spoken_digits(text: str) -> str:
    lower = (text or "").lower()
    for word, digit in TURKISH_DIGIT_MAP.items():
        lower = re.sub(rf"\b{word}\b", digit, lower)
    return re.sub(r"\D", "", lower)


def _digits_only(value: str) -> str:
    return re.sub(r"\D", "", str(value or ""))


def _normalize_phone_digits(value: str) -> str:
    digits = _digits_only(value)
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits


def _phone_candidate_ok(digits: str) -> bool:
    return len(digits) == 10 and digits.startswith("5")


def _pick_phone_digits(normalize_fn, *sources: str) -> str:
    for src in sources:
        if not src:
            continue
        for candidate in (normalize_fn(src), normalize_fn(normalize_spoken_digits(src))):
            if candidate and _phone_candidate_ok(candidate):
                return candidate
    return ""


def _extract_digits_via_chat(
    transcript: str,
    *,
    chat_system: str,
    expected_lengths: tuple[int, ...] | None = None,
    phone: bool = False,
) -> str:
    """Whisper metnini OpenAI Chat ile rakam stringine çevirir."""
    text = (transcript or "").strip()
    if not text:
        return ""

    normalize = _normalize_phone_digits if phone else _digits_only

    if phone:
        direct = _pick_phone_digits(normalize, text)
        if direct:
            return direct

        chat = _call_registration_chat(chat_system, text)
        chat_value = str((chat or {}).get("value") or "").strip()
        from_chat = _pick_phone_digits(normalize, chat_value, text)
        if from_chat:
            logger.info("[voice_reg] chat_digits OK phone=True len=%s", len(from_chat))
            return from_chat

        fallback = normalize(normalize_spoken_digits(text))
        return fallback if _phone_candidate_ok(fallback) else ""

    direct = normalize(text)
    if direct and (not expected_lengths or len(direct) in expected_lengths):
        return direct

    chat = _call_registration_chat(chat_system, text)
    chat_value = str((chat or {}).get("value") or "").strip()
    if chat_value:
        normalized = normalize(chat_value)
        if normalized and (not expected_lengths or len(normalized) in expected_lengths):
            logger.info(
                "[voice_reg] chat_digits OK phone=%s len=%s",
                phone,
                len(normalized),
            )
            return normalized

    return normalize(normalize_spoken_digits(text))


def _extract_phone_from_transcript(transcript: str) -> str:
    return _extract_digits_via_chat(
        transcript,
        chat_system=_FIELD_CHAT_SYSTEM["phone"],
        expected_lengths=(10,),
        phone=True,
    )


def _extract_spk_tc_from_transcript(transcript: str) -> str:
    return _extract_digits_via_chat(
        transcript,
        chat_system=_FIELD_CHAT_SYSTEM["spk_tc_no"],
        expected_lengths=(11,),
    )


def _extract_license_from_transcript(transcript: str) -> str:
    text = (transcript or "").strip()
    if not text:
        return ""
    chat = _call_registration_chat(_FIELD_CHAT_SYSTEM["digits"], text)
    chat_value = str((chat or {}).get("value") or "").strip()
    if chat_value:
        cleaned = re.sub(r"[^a-zA-Z0-9]", "", chat_value).upper()
        if cleaned:
            return cleaned
    return _extract_license_value(text)



_TR_EMAIL_ASCII = str.maketrans({
    "ü": "u", "ö": "o", "ş": "s", "ğ": "g", "ç": "c", "ı": "i",
    "Ü": "u", "Ö": "o", "Ş": "s", "Ğ": "g", "Ç": "c", "İ": "i",
})

_TENS_MAP = {
    "on": 10, "yirmi": 20, "otuz": 30, "kirk": 40, "elli": 50,
    "altmis": 60, "yetmis": 70, "seksen": 80, "doksan": 90,
}

_UNITS_MAP = {
    "sifir": 0, "sfir": 0, "zero": 0,
    "bir": 1, "iki": 2, "uc": 3, "dort": 4, "bes": 5,
    "alti": 6, "yedi": 7, "sekiz": 8, "dokuz": 9,
}

_NUMBER_WORDS = set(_UNITS_MAP) | set(_TENS_MAP) | {"yuz", "bin"}


def _normalize_spoken_token_email(text: str) -> str:
    s = (text or "").lower().strip()
    for old, new in {
        "ı": "i", "ü": "u", "ö": "o", "ş": "s", "ç": "c", "ğ": "g",
    }.items():
        s = s.replace(old, new)
    return s


def _transliterate_tr_email(text: str) -> str:
    return (text or "").translate(_TR_EMAIL_ASCII).lower().replace("ı", "i")


def _enforce_ascii_email(email: str) -> str:
    e = _transliterate_tr_email(email or "")
    at = e.find("@")
    if at <= 0:
        return re.sub(r"[^a-z0-9._+-]", "", e)
    local = re.sub(r"[^a-z0-9._+-]", "", e[:at])
    domain = re.sub(r"[^a-z0-9.-]", "", e[at + 1 :])
    return f"{local}@{domain}" if domain else local


def _parse_turkish_number_chunk_email(chunk: str) -> int | None:
    words = [w for w in re.split(r"[\s,;]+", _normalize_spoken_token_email(chunk)) if w]
    if not words:
        return None
    total = 0
    current = 0
    for word in words:
        w = _normalize_spoken_token_email(word)
        if w in _UNITS_MAP:
            current += _UNITS_MAP[w]
            continue
        if w in _TENS_MAP:
            current += _TENS_MAP[w]
            continue
        if w == "yuz":
            current = (current or 1) * 100
            continue
        if w == "bin":
            current = (current or 1) * 1000
            total += current
            current = 0
            continue
        return None
    total += current
    return total if total >= 0 else None


def _is_number_word_email(token: str) -> bool:
    w = _normalize_spoken_token_email(token)
    return w in _NUMBER_WORDS or w.isdigit()


def _convert_spoken_number_words_in_text(text: str) -> str:
    tokens = [t.strip() for t in (text or "").split() if t.strip()]
    if not tokens:
        return ""
    out: list[str] = []
    i = 0
    while i < len(tokens):
        if not _is_number_word_email(tokens[i]):
            out.append(tokens[i])
            i += 1
            continue
        j = i
        while j < len(tokens) and _is_number_word_email(tokens[j]):
            j += 1
        run = tokens[i:j]
        has_compound = any(
            _normalize_spoken_token_email(t) in _TENS_MAP
            or _normalize_spoken_token_email(t) in {"yuz", "bin"}
            for t in run
        )
        if has_compound:
            num = _parse_turkish_number_chunk_email(" ".join(run))
            if num is not None:
                out.append(str(num))
                i = j
                continue
        digits = ""
        for token in run:
            w = _normalize_spoken_token_email(token)
            if w in _UNITS_MAP:
                digits += str(_UNITS_MAP[w])
            elif w.isdigit():
                digits += w
        if digits:
            out.append(digits)
            i = j
            continue
        out.append(tokens[i])
        i += 1
    return " ".join(out)




def _apply_email_spoken_punctuation(text: str) -> str:
    t = text
    t = re.sub(r"\balt\s*(?:tire|çizgi|cizgi)\b", "_", t)
    t = re.sub(r"\baltire\b", "_", t)
    t = re.sub(r"\baltcizgi\b", "_", t)
    t = re.sub(r"\b(ust|üst)\s*(?:tire|çizgi|cizgi)\b", "-", t)
    t = re.sub(r"\b(usttire|ustire|ustcizgi)\b", "-", t)
    t = re.sub(r"\bunderscore\b", "_", t)
    t = re.sub(r"\b(hyphen|dash)\b", "-", t)
    t = re.sub(r"\btire\b", "-", t)
    return t


def _fix_glued_email_punctuation_in_local(local: str) -> str:
    local = re.sub(r"altire", "_", local)
    local = re.sub(r"altcizgi", "_", local)
    local = re.sub(r"usttire|ustire|ustcizgi", "-", local)
    return local

def normalize_email_from_speech(raw: str) -> str:
    t = _transliterate_tr_email(raw or "")
    t = re.sub(r"\s+", " ", t.strip())
    t = re.sub(r"\b(e-?posta|eposta|mail\s*adres(?:im|i|in)?)\b", " ", t)
    t = _apply_email_spoken_punctuation(t)
    t = t.replace(" kuyruklu a ", "@").replace(" kuyruklu-a ", "@")
    t = re.sub(r"\be\s+mail\b", "@", t)
    t = re.sub(r"\b(et|at|arroba)\b", "@", t)
    t = re.sub(r"\b(nokta|dot)\b", ".", t)
    t = _convert_spoken_number_words_in_text(t)
    t = re.sub(
        r"\b(gmail|hotmail|yahoo|outlook|icloud|yandex|protonmail|live|msn)\s+(com|net|org|tr)\b",
        r"\1.\2",
        t,
    )
    if "@" not in t:
        t = re.sub(
            r"\b(gmail|hotmail|yahoo|outlook|icloud|yandex|protonmail|live|msn)\b",
            r"@\1",
            t,
            count=1,
        )
    t = re.sub(r"@([a-z0-9._-]+)\s+(com|net|org|tr)\b", r"@\1.\2", t)
    t = re.sub(r"\s*\.\s*", ".", t)
    t = re.sub(r"@\s+", "@", t)
    t = re.sub(r"\s+@", "@", t)
    t = re.sub(r"\s+", "", t)
    t = re.sub(r"\.{2,}", ".", t)
    at_idx = t.find("@")
    if at_idx > 0:
        t = _fix_glued_email_punctuation_in_local(t[:at_idx]) + t[at_idx:]
    return _enforce_ascii_email(t)




def _extract_email_regex(text: str) -> str:
    compact = re.sub(r"\s+", "", _transliterate_tr_email(text or ""))
    match = re.search(r"([a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,})", compact)
    return _enforce_ascii_email(match.group(1)) if match else ""


def _extract_email_from_transcript(transcript: str) -> str:
    """Whisper metnini önce OpenAI Chat ile e-postaya çevirir; yerel kurallar yedek."""
    text = (transcript or "").strip()
    if not text:
        return ""

    chat = _call_registration_chat(
        _FIELD_CHAT_SYSTEM["email"],
        text,
        user_prefix=(
            "Whisper transkriptinden e-posta adresini çıkar. "
            "Bana geçerli mail adresini JSON value olarak ver:\n"
        ),
    )
    chat_value = str((chat or {}).get("value") or "").strip()
    if chat_value and chat_value.lower() not in {"null", "none"}:
        normalized = _enforce_ascii_email(normalize_email_from_speech(chat_value))
        if EMAIL_REGEX.match(normalized):
            logger.info("[voice_reg] chat_email OK")
            return normalized

    for candidate in (
        normalize_email_from_speech(text),
        _extract_email_regex(text),
    ):
        candidate = normalize_email_from_speech(candidate) if candidate else ""
        if candidate and EMAIL_REGEX.match(candidate):
            logger.info("[voice_reg] local_email OK")
            return candidate

    return _enforce_ascii_email(normalize_email_from_speech(text))


def transcribe_registration_field(
    audio_bytes: bytes,
    mime: str,
    field: str,
) -> dict[str, Any]:
    prompt = REGISTRATION_WHISPER_PROMPTS.get(field) or DEFAULT_REGISTRATION_WHISPER_PROMPT
    return transcribe_audio(audio_bytes, mime=mime, prompt=prompt)


def _normalize_company_query(text: str) -> str:
    s = (text or "").lower()
    s = re.sub(r"\b(a\.?\s*ş\.?|aş|as|ltd|limited|şti|sti|emlak|gayrimenkul|danışmanlık|danismanlik)\b", " ", s)
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    na = _normalize_company_query(a)
    nb = _normalize_company_query(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if na in nb or nb in na:
        return 0.9
    wa, wb = set(na.split()), set(nb.split())
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / len(wa | wb)


def _call_registration_chat(
    system: str,
    transcript: str,
    *,
    user_prefix: str = "Transkript:\n",
) -> dict[str, Any] | None:
    key = _openai_api_key()
    if not key:
        logger.error("[voice_reg] chat FAIL reason=no_api_key")
        return None

    model = _openai_model()
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": f"{user_prefix}{(transcript or '')[:4000]}"},
        ],
        "max_tokens": 200,
        "temperature": 0.1,
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        content = body["choices"][0]["message"]["content"]
        parsed = parse_json_content(content)
        if not isinstance(parsed, dict):
            logger.warning("[voice_reg] chat FAIL invalid_json ms=%s", elapsed_ms)
            return None
        logger.info("[voice_reg] chat OK ms=%s keys=%s", elapsed_ms, list(parsed.keys()))
        return parsed
    except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError):
        logger.exception("[voice_reg] chat FAIL exception")
        return None


def _extract_license_value(raw_text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]", "", raw_text or "")
    return cleaned.upper()


def _map_corporate_type(raw_text: str) -> str | None:
    t = (raw_text or "").lower()
    if re.search(r"\bspk\b|sermaye\s*piyas", t):
        return "spk"
    if re.search(r"\blihkab\b|l[iı]hkab|harita\s*kadastro", t):
        return "lihkab"
    if re.search(r"\bemlak\b|ttbs|yetki\s*belge", t):
        return "emlak"
    return None


def _location_value_from_fields(fields: dict[str, Any]) -> dict[str, Any]:
    return {
        "city_id": fields.get("city_id"),
        "town_id": fields.get("town_id"),
        "quarter_id": fields.get("quarter_id"),
        "il": fields.get("il") or "",
        "ilce": fields.get("ilce") or "",
        "mahalle": fields.get("mahalle") or "",
        "tkgm_value": fields.get("tkgm_value"),
        "proparcel_value": fields.get("proparcel_value"),
    }


def _match_consultant_company(raw_text: str) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    from accounts.services.mongo_user_service import list_company_profiles_for_registration

    search = (raw_text or "").strip()
    companies = list_company_profiles_for_registration(search, limit=10)
    if not companies:
        return None, []

    if len(companies) == 1:
        item = companies[0]
        return (
            {
                "company_profile_id": item["company_profile_id"],
                "company_name": item["company_name"],
                "corporate_type": item.get("corporate_type"),
            },
            companies,
        )

    best: dict[str, Any] | None = None
    best_score = 0.0
    for item in companies:
        score = _similarity(search, str(item.get("company_name") or ""))
        if score > best_score:
            best_score = score
            best = item

    if best and best_score >= 0.45:
        return (
            {
                "company_profile_id": best["company_profile_id"],
                "company_name": best["company_name"],
                "corporate_type": best.get("corporate_type"),
            },
            companies,
        )
    return None, companies


def extract_field_value(
    field: str,
    raw_text: str,
    context: dict[str, Any],
) -> tuple[Any, list[dict[str, Any]] | None]:
    """Transkriptten alan değeri çıkarır. consultant_company için aday listesi dönebilir."""
    transcript = (raw_text or "").strip()
    candidates: list[dict[str, Any]] | None = None

    if field == "full_name":
        chat = _call_registration_chat(_FIELD_CHAT_SYSTEM["full_name"], transcript)
        value = str((chat or {}).get("value") or transcript).strip()
        value = re.sub(
            r"^(adım|adim|ismim|ben|benim)\s+",
            "",
            value,
            flags=re.IGNORECASE,
        ).strip()
        return value, None

    if field == "phone":
        return _extract_phone_from_transcript(transcript), None

    if field == "email":
        return _extract_email_from_transcript(transcript), None

    if field == "location":
        fields = extract_parcel_from_text(transcript, from_speech=True)
        if not fields.get("ok"):
            return None, None
        fields = merge_extracted_location(fields, transcript=transcript)
        if not fields.get("ok"):
            return None, None
        return _location_value_from_fields(fields), None

    if field == "address_detail":
        chat = _call_registration_chat(_FIELD_CHAT_SYSTEM["address_detail"], transcript)
        value = str((chat or {}).get("value") or transcript).strip()
        value = re.sub(
            r"^(adresim|adres|açık\s*adres|acik\s*adres)\s*[:,-]?\s*",
            "",
            value,
            flags=re.IGNORECASE,
        ).strip()
        return value, None

    if field == "company_name":
        chat = _call_registration_chat(_FIELD_CHAT_SYSTEM["company_name"], transcript)
        value = str((chat or {}).get("value") or transcript).strip()
        return value, None

    if field in {"company_license_no", "office_no", "consultant_license_no"}:
        return _extract_license_from_transcript(transcript), None

    if field == "spk_tc_no":
        return _extract_spk_tc_from_transcript(transcript), None

    if field == "corporate_type":
        return _map_corporate_type(transcript), None

    if field == "consultant_company":
        matched, candidates = _match_consultant_company(transcript)
        return matched, candidates

    return transcript, None


def validate_field(
    field: str,
    value: Any,
    context: dict[str, Any],
) -> tuple[bool, str | None, str | None]:
    member_type = str(context.get("member_type") or "").strip().lower()
    if member_type and member_type not in MEMBER_TYPES:
        return False, "invalid_field", "Geçersiz üyelik tipi."

    if field == "full_name":
        parts = str(value or "").strip().split()
        if len(parts) < 2:
            return False, "invalid_name", "Lütfen adınızı ve soyadınızı birlikte söyleyin."
        if all(re.fullmatch(r"\d+", p) for p in parts):
            return False, "invalid_name", "Lütfen adınızı ve soyadınızı birlikte söyleyin."
        return True, None, None

    if field == "phone":
        digits = _normalize_phone_digits(str(value or ""))
        if not digits and member_type == "individual":
            return True, None, None
        if len(digits) != 10 or not digits.startswith("5"):
            return False, "invalid_phone", "Telefon numarası doğru algılanamadı."
        return True, None, None

    if field == "email":
        normalized = normalize_email_from_speech(str(value or ""))
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

    if field == "company_name":
        if not str(value or "").strip():
            return True, None, None
        if len(str(value or "").strip()) < 2:
            return False, "invalid_company", "Firma adı algılanamadı."
        return True, None, None

    if field == "spk_tc_no":
        digits = _digits_only(str(value or ""))
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

    if field == "corporate_type":
        ct = str(value or "").strip().lower()
        if ct not in CORPORATE_TYPES:
            return False, "invalid_field", "Firma tipi algılanamadı."
        return True, None, None

    return True, None, None


def normalize_extracted_value(field: str, value: Any) -> Any:
    if field == "email":
        return normalize_email_from_speech(str(value or ""))
    if field == "phone":
        return _normalize_phone_digits(str(value or ""))
    if field == "spk_tc_no":
        return _digits_only(str(value or ""))
    return value


def process_voice_registration_field(
    *,
    audio_bytes: bytes,
    mime: str,
    field: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    if field not in ALLOWED_FIELDS:
        return {
            "ok": False,
            "field": field,
            "raw_text": "",
            "value": None,
            "is_valid": False,
            "error": "invalid_field",
            "message": "Desteklenmeyen alan.",
        }

    if str(context.get("source") or "") != "voice_registration":
        return {
            "ok": False,
            "field": field,
            "raw_text": "",
            "value": None,
            "is_valid": False,
            "error": "invalid_field",
            "message": "Geçersiz istek kaynağı.",
        }

    transcript = transcribe_registration_field(audio_bytes, mime=mime, field=field)
    if not transcript.get("ok"):
        err = str(transcript.get("error") or "Ses metne çevrilemedi.")
        code = "openai_error" if "OpenAI" in err else "transcription_failed"
        return {
            "ok": False,
            "field": field,
            "raw_text": "",
            "value": None,
            "is_valid": False,
            "error": code,
            "message": err,
        }

    raw_text = str(transcript.get("text") or "").strip()
    if not raw_text:
        return {
            "ok": False,
            "field": field,
            "raw_text": "",
            "value": None,
            "is_valid": False,
            "error": "transcription_failed",
            "message": "Ses metne çevrilemedi.",
        }

    extracted, candidates = extract_field_value(field, raw_text, context)
    extracted = normalize_extracted_value(field, extracted)

    ok, err_code, err_msg = validate_field(field, extracted, context)
    if not ok:
        logger.warning(
            "[voice_reg] extraction_failed field=%s error=%s raw_text=%r value=%r",
            field,
            err_code,
            raw_text[:200] if raw_text else "",
            extracted if field not in {"phone", "spk_tc_no"} else "***",
        )
        if field in {"email", "phone"} and raw_text:
            preview = raw_text[:100].strip()
            err_msg = f"{err_msg} (duyulan: {preview})"
        payload: dict[str, Any] = {
            "ok": False,
            "field": field,
            "raw_text": raw_text,
            "value": extracted if field != "consultant_company" else None,
            "is_valid": False,
            "error": err_code or "invalid_field",
            "message": err_msg or "",
        }
        if field == "email":
            payload["debug_normalized"] = normalize_email_from_speech(raw_text)
        if field == "phone" and raw_text:
            payload["debug_normalized"] = _extract_phone_from_transcript(raw_text) or None
        if candidates:
            payload["candidates"] = [
                {
                    "company_profile_id": c["company_profile_id"],
                    "company_name": c["company_name"],
                    "corporate_type": c.get("corporate_type"),
                }
                for c in candidates[:5]
            ]
        return payload

    return {
        "ok": True,
        "field": field,
        "raw_text": raw_text,
        "value": extracted,
        "is_valid": True,
        "message": None,
    }
