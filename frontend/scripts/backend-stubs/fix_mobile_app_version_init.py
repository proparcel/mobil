"""Fix myapp/views/__init__.py import order after app-version patch."""
from pathlib import Path

INIT = Path(r"C:\proparcel\myapp\views\__init__.py")
text = INIT.read_text(encoding="utf-8")
import_line = "from .mobile_app_version import mobile_app_version\n"

if import_line.strip() in text:
    text = text.replace(import_line, "")
    future_idx = text.find("from __future__ import annotations")
    if future_idx == -1:
        text = import_line + text
    else:
        line_end = text.find("\n", future_idx)
        insert_at = line_end + 1 if line_end != -1 else 0
        text = text[:insert_at] + "\n" + import_line + text[insert_at:]
    INIT.write_text(text, encoding="utf-8")
    print("views/__init__.py: import order fixed")
else:
    print("views/__init__.py: nothing to fix")
