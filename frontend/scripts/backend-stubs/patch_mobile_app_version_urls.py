"""pp33 myapp/urls.py patch - mobile app-version route."""
from pathlib import Path

URLS = Path(r"C:\proparcel\myapp\urls.py")
VIEWS_INIT = Path(r"C:\proparcel\myapp\views\__init__.py")

ROUTE = "    path('api/mobile/app-version/', views.mobile_app_version, name='mobile_app_version'),\n"
NEEDLE = "path('api/mobile/report_payload/'"

text = URLS.read_text(encoding="utf-8")
if "api/mobile/app-version/" not in text:
    idx = text.find(NEEDLE)
    if idx == -1:
        raise SystemExit("report_payload route not found in urls.py")
    line_start = text.rfind("\n", 0, idx) + 1
    text = text[:line_start] + ROUTE + text[line_start:]
    URLS.write_text(text, encoding="utf-8")
    print("urls.py: app-version route added")
else:
    print("urls.py: app-version route already present")

init_text = VIEWS_INIT.read_text(encoding="utf-8")
import_line = "from .mobile_app_version import mobile_app_version\n"
if "mobile_app_version" not in init_text:
    future_idx = init_text.find("from __future__ import annotations")
    if future_idx == -1:
        init_text = import_line + init_text
    else:
        line_end = init_text.find("\n", future_idx)
        insert_at = line_end + 1 if line_end != -1 else 0
        init_text = init_text[:insert_at] + "\n" + import_line + init_text[insert_at:]
    VIEWS_INIT.write_text(init_text, encoding="utf-8")
    print("views/__init__.py: export added")
else:
    print("views/__init__.py: export already present")
