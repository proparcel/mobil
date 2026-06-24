# Patches C:\proparcel\myapp\services\voice_registration_ai\field_extract.py
from pathlib import Path
import re

TARGET = Path(r"C:\proparcel\myapp\services\voice_registration_ai\field_extract.py")
text = TARGET.read_text(encoding="utf-8")

if "_convert_spoken_number_words_in_text" in text:
    print("already patched")
    raise SystemExit(0)

HELPERS = r'''
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

'''

NEW_FUNC = r'''def normalize_email_from_speech(raw: str) -> str:
    t = _transliterate_tr_email(raw or "")
    t = re.sub(r"\s+", " ", t.strip())
    t = re.sub(r"\b(e-?posta|eposta|mail\s*adres(?:im|i|in)?)\b", " ", t)
    t = re.sub(r"\balt\s*(?:tire|çizgi|cizgi)\b", "_", t)
    t = re.sub(r"\b(ust|üst)\s*(?:tire|çizgi|cizgi)\b", "-", t)
    t = re.sub(r"\bunderscore\b", "_", t)
    t = re.sub(r"\b(hyphen|dash)\b", "-", t)
    t = t.replace(" kuyruklu a ", "@").replace(" kuyruklu-a ", "@")
    t = re.sub(r"\be\s+mail\b", "@", t)
    t = re.sub(r"\b(et|at|arroba)\b", "@", t)
    t = re.sub(r"\b(nokta|dot)\b", ".", t)
    t = re.sub(r"\btire\b", "-", t)
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
    return _transliterate_tr_email(t)
'''

pattern = re.compile(
    r"def normalize_email_from_speech\(raw: str\) -> str:.*?(?=\n\ndef _extract_email_regex)",
    re.S,
)
if not pattern.search(text):
    raise SystemExit("normalize_email_from_speech block not found")

match = pattern.search(text)
if not match:
    raise SystemExit("normalize_email_from_speech block not found")

replacement = HELPERS + "\n" + NEW_FUNC + "\n\n"
text = text[: match.start()] + replacement + text[match.end() :]

text = text.replace(
    '"Türkçe sesli kayıt e-posta adresi. Kullanıcı e-posta söylüyor. "\n'
    '        "Örnek: sercan et gmail nokta com, at işareti, hotmail nokta com. "\n'
    '        "Et, at, nokta, gmail, hotmail, outlook, yahoo, com."',
    '"Türkçe sesli kayıt e-posta adresi. Kullanıcı e-posta söylüyor. "\n'
    '        "Örnek: buyuk seksen alti et gmail nokta com. "\n'
    '        "Et, at, nokta, alt tire, üst tire, gmail, hotmail, outlook, yahoo, com, rakamlar."',
)

text = text.replace(
    '"Türkçe konuşma transkriptinden e-posta adresini çıkar. "\n'
    '        \'Kullanıcı "et/at/nokta com" diyebilir. JSON: {"value": "kullanici@domain.com"}\'',
    '"Türkçe konuşma transkriptinden e-posta adresini çıkar. "\n'
    '        \'Kullanıcı "et/at/nokta com", "alt tire", "üst tire" diyebilir; rakamlar kelimeyle söylenebilir. \'\n'
    '        \'E-postada Türkçe karakter kullanma (ü→u, ş→s). JSON: {"value": "kullanici@domain.com"}\'',
)

TARGET.write_text(text, encoding="utf-8")
print("patched ok")
