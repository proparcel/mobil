# Incremental patch: altire → _ in normalize_email_from_speech
from pathlib import Path
import re

TARGET = Path(r"C:\proparcel\myapp\services\voice_registration_ai\field_extract.py")
text = TARGET.read_text(encoding="utf-8")

if "_fix_glued_email_punctuation_in_local" in text:
    print("already patched altire")
    raise SystemExit(0)

HELPERS = '''

def _apply_email_spoken_punctuation(text: str) -> str:
    t = text
    t = re.sub(r"\\balt\\s*(?:tire|çizgi|cizgi)\\b", "_", t)
    t = re.sub(r"\\baltire\\b", "_", t)
    t = re.sub(r"\\baltcizgi\\b", "_", t)
    t = re.sub(r"\\b(ust|üst)\\s*(?:tire|çizgi|cizgi)\\b", "-", t)
    t = re.sub(r"\\b(usttire|ustire|ustcizgi)\\b", "-", t)
    t = re.sub(r"\\bunderscore\\b", "_", t)
    t = re.sub(r"\\b(hyphen|dash)\\b", "-", t)
    t = re.sub(r"\\btire\\b", "-", t)
    return t


def _fix_glued_email_punctuation_in_local(local: str) -> str:
    local = re.sub(r"altire", "_", local)
    local = re.sub(r"altcizgi", "_", local)
    local = re.sub(r"usttire|ustire|ustcizgi", "-", local)
    return local

'''

anchor = "def normalize_email_from_speech(raw: str) -> str:"
if anchor not in text:
    raise SystemExit("anchor not found")
text = text.replace(anchor, HELPERS + anchor, 1)

old_block = """    t = re.sub(r\"\\balt\\s*(?:tire|çizgi|cizgi)\\b\", \"_\", t)
    t = re.sub(r\"\\b(ust|üst)\\s*(?:tire|çizgi|cizgi)\\b\", \"-\", t)
    t = re.sub(r\"\\bunderscore\\b\", \"_\", t)
    t = re.sub(r\"\\b(hyphen|dash)\\b\", \"-\", t)
    t = t.replace(\" kuyruklu a \", \"@\").replace(\" kuyruklu-a \", \"@\")
    t = re.sub(r\"\\be\\s+mail\\b\", \"@\", t)
    t = re.sub(r\"\\b(et|at|arroba)\\b\", \"@\", t)
    t = re.sub(r\"\\b(nokta|dot)\\b\", \".\", t)
    t = re.sub(r\"\\btire\\b\", \"-\", t)
    t = _convert_spoken_number_words_in_text(t)"""

new_block = """    t = _apply_email_spoken_punctuation(t)
    t = t.replace(\" kuyruklu a \", \"@\").replace(\" kuyruklu-a \", \"@\")
    t = re.sub(r\"\\be\\s+mail\\b\", \"@\", t)
    t = re.sub(r\"\\b(et|at|arroba)\\b\", \"@\", t)
    t = re.sub(r\"\\b(nokta|dot)\\b\", \".\", t)
    t = _convert_spoken_number_words_in_text(t)"""

if old_block not in text:
    raise SystemExit("old punctuation block not found")

text = text.replace(old_block, new_block, 1)

old_tail = """    t = re.sub(r\"\\s+\", \"\", t)
    t = re.sub(r\"\\.{2,}\", \".\", t)
    return _transliterate_tr_email(t)




def _extract_email_regex"""

new_tail = """    t = re.sub(r\"\\s+\", \"\", t)
    t = re.sub(r\"\\.{2,}\", \".\", t)
    at_idx = t.find(\"@\")
    if at_idx > 0:
        t = _fix_glued_email_punctuation_in_local(t[:at_idx]) + t[at_idx:]
    return _transliterate_tr_email(t)




def _extract_email_regex"""

if old_tail not in text:
    raise SystemExit("tail block not found")

text = text.replace(old_tail, new_tail, 1)

TARGET.write_text(text, encoding="utf-8")
print("patched altire ok")
