# Enforce ASCII-only email local/domain on pp33 field_extract.py
from pathlib import Path
import re

TARGET = Path(r"C:\proparcel\myapp\services\voice_registration_ai\field_extract.py")
text = TARGET.read_text(encoding="utf-8")

if "_enforce_ascii_email" in text:
    print("already patched ascii email")
    raise SystemExit(0)

text = text.replace(
    'EMAIL_REGEX = re.compile(r"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")',
    'EMAIL_REGEX = re.compile(r"^[a-z0-9._+-]+@[a-z0-9.-]+\\.[a-z]{2,}$")',
    1,
)

enforce_fn = '''

def _enforce_ascii_email(email: str) -> str:
    e = _transliterate_tr_email(email or "")
    at = e.find("@")
    if at <= 0:
        return re.sub(r"[^a-z0-9._+-]", "", e)
    local = re.sub(r"[^a-z0-9._+-]", "", e[:at])
    domain = re.sub(r"[^a-z0-9.-]", "", e[at + 1 :])
    return f"{local}@{domain}" if domain else local
'''

anchor = "def _parse_turkish_number_chunk_email"
if anchor not in text:
    raise SystemExit("anchor not found for enforce fn")
text = text.replace(anchor, enforce_fn + anchor, 1)

text = text.replace(
    "    return _transliterate_tr_email(t)\n\n\n\n\ndef _extract_email_regex",
    "    return _enforce_ascii_email(t)\n\n\n\n\ndef _extract_email_regex",
    1,
)

old_regex = '''def _extract_email_regex(text: str) -> str:
    compact = re.sub(r"\\s+", "", (text or "").lower())
    match = re.search(r"([a-z0-9._+-]+@[a-z0-9.-]+\\.[a-z]{2,})", compact)
    return match.group(1) if match else ""'''

new_regex = '''def _extract_email_regex(text: str) -> str:
    compact = re.sub(r"\\s+", "", _transliterate_tr_email(text or ""))
    match = re.search(r"([a-z0-9._+-]+@[a-z0-9.-]+\\.[a-z]{2,})", compact)
    return _enforce_ascii_email(match.group(1)) if match else ""'''

if old_regex not in text:
    raise SystemExit("extract_email_regex block not found")
text = text.replace(old_regex, new_regex, 1)

old_loop = """    for candidate in (
        normalize_email_from_speech(text),
        _extract_email_regex(text),
    ):
        if candidate and EMAIL_REGEX.match(candidate):
            return candidate"""

new_loop = """    for candidate in (
        normalize_email_from_speech(text),
        _extract_email_regex(text),
    ):
        candidate = normalize_email_from_speech(candidate) if candidate else ""
        if candidate and EMAIL_REGEX.match(candidate):
            return candidate"""

if old_loop not in text:
    raise SystemExit("extract email loop not found")
text = text.replace(old_loop, new_loop, 1)

TARGET.write_text(text, encoding="utf-8")
print("patched ascii email ok")
