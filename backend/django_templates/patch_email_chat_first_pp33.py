# Whisper sonrası e-postayı önce OpenAI Chat ile çıkar (pp33 field_extract.py)
from pathlib import Path
import re

TARGET = Path(r"C:\proparcel\myapp\services\voice_registration_ai\field_extract.py")
text = TARGET.read_text(encoding="utf-8")

if "chat_email OK" in text:
    print("already patched chat-first email")
    raise SystemExit(0)

old_email_prompt = '''    "email": (
        "Türkçe konuşma transkriptinden e-posta adresini çıkar. "
        'Kullanıcı "et/at/nokta com", "alt tire", "üst tire" diyebilir; rakamlar kelimeyle söylenebilir. '
        'E-postada Türkçe karakter kullanma (ü→u, ş→s). JSON: {"value": "kullanici@domain.com"}'
    ),'''

new_email_prompt = '''    "email": (
        "Sen Türkçe sesli kayıt transkriptinden e-posta adresini çıkaran bir asistansın. "
        "Kullanıcı adresi konuşarak söyler; örnek: \\"büyük seksen altı et gmail nokta com\\". "
        "Kurallar: "
        "1) Çıktı yalnızca geçerli ASCII e-posta olsun (kullanici@domain.com). "
        "2) Türkçe karakter kullanma: ü→u, ö→o, ş→s, ğ→g, ç→c, ı→i. "
        "3) \\"et\\", \\"at\\", \\"e-posta\\" → @ ; \\"nokta\\", \\"dot\\" → . "
        "4) \\"alt tire\\", \\"alt çizgi\\" → _ ; \\"üst tire\\" → - "
        "5) Söylenen rakamları rakam olarak yaz (seksen altı → 86). "
        "6) gmail com → gmail.com; boşlukları kaldır. "
        "Transkriptte e-posta yoksa veya emin değilsen {\\"value\\": null} döndür. "
        'Aksi halde JSON: {"value": "tam@email.com"} — başka alan ekleme.'
    ),'''

if old_email_prompt not in text:
    raise SystemExit("email prompt block not found")
text = text.replace(old_email_prompt, new_email_prompt, 1)

old_chat_def = "def _call_registration_chat(system: str, transcript: str) -> dict[str, Any] | None:"
new_chat_def = (
    "def _call_registration_chat(\n"
    "    system: str,\n"
    "    transcript: str,\n"
    "    *,\n"
    "    user_prefix: str = \"Transkript:\\n\",\n"
    ") -> dict[str, Any] | None:"
)
if old_chat_def not in text:
    raise SystemExit("_call_registration_chat signature not found")
text = text.replace(old_chat_def, new_chat_def, 1)

text = text.replace(
    '{"role": "user", "content": f"Transkript:\\n{(transcript or \'\')[:4000]}"},',
    '{"role": "user", "content": f"{user_prefix}{(transcript or \'\')[:4000]}"},',
    1,
)

old_extract = re.search(
    r"def _extract_email_from_transcript\(transcript: str\) -> str:\n.*?return (?:_enforce_ascii_email\()?normalize_email_from_speech\(text\)(?:\))?\n",
    text,
    re.S,
)
if not old_extract:
    raise SystemExit("_extract_email_from_transcript block not found")

new_extract = '''def _extract_email_from_transcript(transcript: str) -> str:
    """Whisper metnini önce OpenAI Chat ile e-postaya çevirir; yerel kurallar yedek."""
    text = (transcript or "").strip()
    if not text:
        return ""

    chat = _call_registration_chat(
        _FIELD_CHAT_SYSTEM["email"],
        text,
        user_prefix=(
            "Whisper transkriptinden e-posta adresini çıkar. "
            "Bana geçerli mail adresini JSON value olarak ver:\\n"
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
'''

text = text[: old_extract.start()] + new_extract + text[old_extract.end() :]

TARGET.write_text(text, encoding="utf-8")
print("patched chat-first email ok")
