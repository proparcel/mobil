"""
Mobil uygulama store güncelleme politikası API.
Politika dosyası: data/mobile_app_version_policy.json
"""
from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

DEFAULT_POLICY = {
    "ios": {
        "min_version": "0.0.0",
        "latest_version": "0.0.0",
        "force_message": "Uygulamayı güncellemeniz gerekiyor.",
        "optional_message": "Yeni sürüm mevcut. Güncellemek ister misiniz?",
    },
    "android": {
        "min_version": "0.0.0",
        "min_build": 0,
        "latest_version": "0.0.0",
        "latest_build": 0,
        "force_message": "Uygulamayı güncellemeniz gerekiyor.",
        "optional_message": "Yeni sürüm mevcut. Güncellemek ister misiniz?",
    },
}


def _policy_path() -> Path:
    return Path(settings.BASE_DIR) / "data" / "mobile_app_version_policy.json"


def _load_policy() -> dict:
    path = _policy_path()
    if not path.is_file():
        return DEFAULT_POLICY
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, dict):
            return DEFAULT_POLICY
        return data
    except Exception:
        return DEFAULT_POLICY


@require_GET
def mobile_app_version(request):
    """GET /api/mobile/app-version/ — auth gerektirmez."""
    policy = _load_policy()
    return JsonResponse(policy, json_dumps_params={"ensure_ascii": False})
