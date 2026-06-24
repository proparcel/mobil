import urllib.request

resp = urllib.request.urlopen("http://127.0.0.1:8000/api/mobile/app-version/")
print(resp.status)
print(resp.read().decode("utf-8"))
