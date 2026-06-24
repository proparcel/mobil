import os
import sys

os.chdir(r"C:\proparcel")
sys.path.insert(0, r"C:\proparcel")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")

import django

django.setup()

from django.test import RequestFactory
from myapp.views.mobile_app_version import mobile_app_version

req = RequestFactory().get("/api/mobile/app-version/")
resp = mobile_app_version(req)
print("status", resp.status_code)
print(resp.content.decode("utf-8"))
