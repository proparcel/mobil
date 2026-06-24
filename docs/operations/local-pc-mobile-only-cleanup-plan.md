# Lokal PC — mobil-only temizlik planı

> **Durum:** L1–L4 uygulandı (lokal mobil-only)  
> **Tarih:** 2026-06-19  
> **Kapsam:** `C:\ProParcel` — yalnızca mobil geliştirme  
> **İlgili:** pp33 (control-plane, asla pull almaz), pp32 (heavy + drone worker, ayrı sadeleştirme planı)

---

## Amaç

Lokal geliştirme PC'de **ProParcel ana projesine ait backend, web, doküman ve sunucu kodu kalmayacak**. Geliştirme yüzeyi: **mobil uygulama** + allowlist’teki **yerel veri / drone CPU modülleri** (`mobile/mobil_github` → `proparcel/mobil.git`).

| Ortam | Git remote | Pull | Rol |
|-------|------------|------|-----|
| **pp33 (sunucu)** | `proparcel_v1` | **Yasak** | **Ana monorepo kaynağı** — web, Django, docs, broker |
| **pp32 (sunucu)** | **`proparcel_pp32`** | **`start_32.bat pull` yalnızca pp32'de** | Heavy + drone worker |
| **Lokal PC** | **`proparcel/mobil.git`** (submodule) | **Yasak** (`proparcel_v1`) | Mobil geliştirme; sunucu reposu **lokalde tutulmaz** |

**Önemli:** `proparcel_v1` **sunucunun reposudur** (pp33). Lokal PC bu monorepo’nun “yeni home’u” veya devamı **değildir**. Lokal temizlik = diskten sunucu kodunu kaldırmak; mobil iş **`https://github.com/proparcel/mobil.git`** ile submodule (`mobile/mobil_github`) üzerinden sürer — commit/push **mobil repo**ya gider.

```
pp33  ── proparcel_v1    ──►  web + backend + docs (kaynak)
pp32  ── proparcel_pp32  ──►  worker node (ayrı repo — bkz. pp32-worker-scope.md)
lokal ── mobil.git       ──►  mobile/mobil_github/frontend (Metro)
```

---

## Kalacaklar (allowlist)

Aşağıdakiler dışında **hiçbir şey** lokal kökte kalmamalı.

| Yol | Gerekçe |
|-----|---------|
| `mobile/mobil_github/` | Submodule — **tek Git kaynağı lokalde** (`https://github.com/proparcel/mobil.git`, `main`) |
| `mobile/mobil_github/frontend/` | Metro / Expo; `git commit` / `push` burada |
| `.gitmodules` | Yalnızca `mobile/mobil_github` girdisi |
| `.git/` (kök) | **Kaldırılacak veya arşivlenecek** — kök `proparcel_v1` clone’u sunucu reposudur, lokal mobil workflow’da kullanılmaz |
| `README.md` | **Yeniden yazılacak** — yalnızca lokal mobil workspace tanımı + pp33/pp32'ye referans (ana proje dokümanı değil) |
| `ProParcel-multi.code-workspace` | **Güncellendi** — yalnızca mobil + lokal allowlist; pp32/pp33 mount **yok** → [REMOTE-ACCESS.md](../../../../REMOTE-ACCESS.md) |
| `.cursor/rules/` | **Yalnızca mobil** kurallar kalır; backend/worker/test_modulleri kuralları silinir |
| `.gitignore` | **Sadeleştirilmiş** — mobil + IDE; Django/staticfiles kuralları kaldırılır |
| **`birlestirilmis_katmanlar/`** | Yerel DEM / coğrafi katman ağacı (büyük veri; Git’e dahil değil). Lokal referans veya offline test için **kalır** |
| **`orbit_video/`** | Drone stills → MP4 **CPU render motoru** (Python/OpenCV). Mobil **kaynak kodu değil**; mobil uygulama pp33 API üzerinden drone üretimini tetikler — lokalde referans/kopya olarak **kalır** (kullanıcı talebi) |
| **`remotion-image-scene/`** | Drone export **Remotion/Node** render paketi. Mobil kaynak kodu değil; pp32/pp33 export hattı — lokalde **kalır** (orbit_video ile aynı gerekçe) |

### Mobil mi, backend mi? (2026-06-19 inceleme)

| Klasör | Mobil repo import? | Gerçek rol | Lokalde kalır mı? |
|--------|-------------------|------------|-------------------|
| `mobile/mobil_github/frontend/` | — | Kanonik mobil uygulama | **Evet** |
| `birlestirilmis_katmanlar/` | Hayır | DEM `.tif`, coğrafi katmanlar (backend/worker okur) | **Evet** (talep) |
| `orbit_video/` | Hayır (`orbit_video` string’i mobil TS/TSX’te yok) | `POST /api/drone-orbit-stills/`, `/api/orbit-video-render/` → CPU pipeline | **Evet** (talep; API pp33’te çalışır) |
| `remotion-image-scene/` | Hayır | Drone editör export segment render (pp32 worker) | **Evet** (talep) |
| `ilan_portal/listing/drone_*` | Hayır (yalnızca HTTP API) | Backend drone servisleri | **Hayır** — denylist (pp33/pp32) |

Mobil drone UI: `mobile/mobil_github/frontend/components/ai-drone-simple/` — kredi/API çağrıları; render motoru sunucuda.

### Mobil dokümantasyon taşıması

Monorepo `docs/mobile/` → **`mobil.git`** içinde kanonik `docs/` ağacı. Lokal kökte `docs/` **tutulmaz**.

**Uygulama planı (ayrıntılı):** [mobile-docs-to-mobil-repo-plan.md](./mobile-docs-to-mobil-repo-plan.md)

| Adım | Özet |
|------|------|
| M0–M5 | `docs/mobile/` içeriğini `mobile/mobil_github/docs/` altına taşı; legacy `frontend/*.md` birleştir; **mobil.git push** |
| M6 | pp33 sunucuda `docs/mobile/` sil; `docs/README.md` güncelle |
| M7 | Lokal `docs/` tamamını sil (cleanup Faz L1 — **M5 bitmeden docs silinmez**) |

### Opsiyonel (tercihe bağlı)

| Yol | Not |
|-----|-----|
| `.env` (mobil API URL) | Yalnızca Expo/RN ortam değişkenleri; backend `.env` silinir |

---

## Silinecekler (denylist)

### Uygulama ve backend

| Yol | Açıklama |
|-----|----------|
| `accounts/` | Django auth / IAP / portal backend |
| `analyze/` | Analiz modülü |
| `myapp/` | Ana Django uygulama |
| `ilan_portal/` | İlan / drone portal backend |
| `proparcel/` | Django project package |
| `energy_analysis/` | Celery analiz app |
| `wind_analysis/` | Celery analiz app |
| `buildings/` | Django app |
| `aranacaklar/` | Django app |
| `Eids/` | Backend modül |
| `packages/` | Monorepo paketleri (web/backend) |

### Web

| Yol | Açıklama |
|-----|----------|
| `frontend-web/` | Vite web / portal UI (~372 dosya) |

### Dokümantasyon (ana proje)

| Yol | Açıklama |
|-----|----------|
| `docs/` | **Tamamı** — backend, frontend, platform, products, operations, changes |
| `architecture.md` (kök) | Ana proje mimari yönlendirmesi |
| `myapp/static/docs/` | Varsa — taşınmış doküman kalıntısı |

### Test, veri, operasyon

| Yol | Açıklama |
|-----|----------|
| `test_modulleri/` | Test modülleri (ana projede; pp32 planı ayrı) |
| `data/` | Backend veri |
| `backups/` | Sunucu yedekleri |
| `media/` | Django media |
| `staticfiles/` | Django static |
| `templates/` | Django şablonları |
| `logs/` | Sunucu logları |
| `tools/` | Backend araçları |
| `scripts/` | Sunucu/worker scriptleri (`start_proparcel`, mount, drone vb.) |
| `deploy/` | nginx / deploy |
| `design/` | Web tasarım varlıkları |
| `docker/` | Docker backend |
| `inetpub/` | IIS kalıntısı |
| `temp/` | Geçici |

### Kök Django / Celery / sunucu dosyaları

```
manage.py, celery_app.py, settings.py, urls.py, wsgi.py, asgi.py
requirements.txt
docker-compose.yml, Dockerfile, Dockerfile.heavy, Dockerfile.remotion-worker
start_proparcel.bat, fast_proparcel.bat, restart_waitress_8000.bat
start_workers_hidden.ps1, kill_workers.ps1
terrain_roughness_grid_preload.py, wind_grid_preload_compressed.py, wind_terrain_grid_preload.py
gunicorn.conf.py, from django.py, __init__.py (kök)
mongo_runtime.sqlite3
```

### Geçici / credential (sil + .gitignore doğrula)

```
tmp_*.txt, tmp_*.bat, tmp_*.log, tmp_pp33_index
gulumsetenemlak-*.json, google/ (service account / stats)
.env, .env.docker.example, .env.wsl2.example  → mobil repo kendi .env.example kullanır
```

---

## Git stratejisi

### Prensipler

1. **`proparcel_v1` = pp33 sunucu reposu.** Lokal PC bu repoyu sync etmez, taşımaz, devralmaz.
2. **Mobil = `proparcel/mobil.git`.** Geliştirme, commit ve push yalnızca `mobile/mobil_github` içinde.
3. Lokal **`git pull origin main` yok** — ne `proparcel_v1` ne başka sunucu remote’u için.
4. Sunucu kodu güncellemesi **pp33’te** (Cursor Agent / sunucu commit); lokalden monorepo push yok.

### Lokal kök (`C:\ProParcel`) Git sonrası

| Bileşen | Hedef |
|---------|--------|
| `C:\ProParcel\.git` (proparcel_v1) | Sil veya `C:\ProParcel_archive\.git` taşı — **mobil workflow buna bağlı değil** |
| `mobile/mobil_github\.git` | **Kalır** — `origin` → `proparcel/mobil.git` |
| Submodule güncelleme | `cd mobile/mobil_github && git pull origin main` (yalnızca **mobil** repo) |

### Uygulama adımları (Git)

1. Mobil repoda açık değişiklik varsa commit + push (`mobil.git`).
2. Kök `proparcel_v1` remote/untracked durumunu kaydet (SHA notu); kök `.git` kaldır.
3. Denylist fiziksel silme (backend/web/docs).
4. Kök `README.md`: “Lokal = mobil submodule + allowlist veri; sunucu repo pp33 `proparcel_v1`.”
5. İleride mobil: `cd mobile/mobil_github/frontend` → normal mobil git akışı.

### Yasak

- Lokalden `git pull` — **`proparcel_v1` / pp33 monorepo için**
- Lokalden `proparcel_v1` push
- pp33 dosyalarını lokale kopyalayıp mobil repo’ya commit
- Credential dosyalarını commit

---

## Uygulama fazları

### Faz L0 — Hazırlık

- [ ] `git status` — commit edilmemiş mobil değişiklik varsa **mobil repo** içinde commit
- [ ] Tam yedek: `C:\ProParcel` → `E:\ProParcel_backup_YYYYMMDD` (robocopy, `node_modules` hariç)
- [ ] API tabanı: mobil `.env` / config → pp33 URL (`178.210.168.33`) doğrula
- [ ] Bu plan onayı

### Faz L1 — Silme (denylist)

Sıra önerisi (bağımlılık yok, güvenli):

1. **Mobil doküman taşıması (M0–M5)** — [mobile-docs-to-mobil-repo-plan.md](./mobile-docs-to-mobil-repo-plan.md); `mobil.git` push **önce**
2. `frontend-web/`, **`docs/` (tamamı, M5 sonrası)**, `test_modulleri/`
2. Django app klasörleri: `accounts/`, `myapp/`, `analyze/`, `ilan_portal/`, …
3. Kök `.py`, `.bat`, Docker, `requirements.txt`
4. `scripts/`, `deploy/`, `tools/`
5. Geçici ve credential dosyaları
6. `.cursor/rules/` — mobil dışı kuralları sil
7. **L1 öncesi:** cleanup plan + mobile-docs plan → `mobil.git/docs/operations/` kopyala; köke `LOCAL-PC-CLEANUP-PLAN.md` özeti (M5 sonrası)

**PowerShell silme iskeleti (onay sonrası):**

```powershell
$Root = "C:\ProParcel"
$RemoveDirs = @(
  "accounts","analyze","myapp","ilan_portal","proparcel","frontend-web","docs",
  "test_modulleri","scripts","deploy","design","docker","tools","templates",
  "staticfiles","media","logs","backups","data",
  "energy_analysis","wind_analysis",
  "buildings","aranacaklar","Eids","packages","inetpub","temp","google"
)
foreach ($d in $RemoveDirs) {
  $p = Join-Path $Root $d
  if (Test-Path $p) { Remove-Item $p -Recurse -Force }
}
```

Kök dosyalar ayrıca tek tek silinir (denylist).

### Faz L2 — Yeniden yazım

- [ ] `README.md` — lokal mobil workspace (pp33 API, pp32 worker notu, **pull yok**)
- [x] `ProParcel-multi.code-workspace` — mobil + allowlist only; mount kaldırıldı ([REMOTE-ACCESS.md](../../../../REMOTE-ACCESS.md))
- [ ] `.gitignore` — mobil-only
- [ ] `.gitmodules` — yalnızca mobil submodule (kök `proparcel_v1` `.git` kaldırıldıysa isteğe bağlı silinir)

### Faz L3 — Doğrulama

| Kontrol | Beklenen |
|---------|----------|
| `Get-ChildItem C:\ProParcel -Directory` | `mobile`, `birlestirilmis_katmanlar`, `orbit_video`, `remotion-image-scene`, `.git`, `.cursor` (+ izin verilenler) |
| `Test-Path frontend-web` | `$false` |
| `Test-Path docs` | `$false` |
| `Test-Path myapp` | `$false` |
| `Test-Path birlestirilmis_katmanlar` | `$true` |
| `Test-Path orbit_video` | `$true` |
| `cd mobile\mobil_github\frontend && npm run start` | Metro ayağa kalkar |
| Mobil API isteği | pp33 backend yanıt verir |

### Faz L4 — Git (lokal)

- [ ] Kök `proparcel_v1` `.git` kaldırıldı veya arşivlendi
- [ ] `mobile/mobil_github` → `mobil.git` remote doğrulandı
- [ ] Mobil değişiklikler `mobil.git`’e push edildi
- [ ] **`proparcel_v1` push/pull lokalde yok**

---

## pp33 / pp32 ile ilişki (referans)

Lokal temizlik **pp33 ve pp32'ye dokunmaz**.

| Makine | Rol | Lokal temizlik sonrası |
|--------|-----|------------------------|
| **pp33** | Web + API + broker | Mobil API hedefi; doküman kaynağı pp33 `docs/` |
| **pp32** | `io_heavy_queue` + `drone_export_queue` | Ayrı sadeleştirme planı (`docs/operations/pp32-worker-scope.md` — henüz yazılacak) |

Ana proje dokümantasyonu ve mimari **pp33 sunucusunda** (`proparcel_v1`) kalır; lokal README yalnızca mobil submodule + allowlist veriyi açıklar — pp33 dokümanına dosya linki yok, **sunucu yolu / IP** ile referans.

---

## Riskler ve önlemler

| Risk | Önlem |
|------|--------|
| Mobil submodule bozulması | Silmeden önce `mobil_github` commit SHA kaydet; yedek al |
| Yanlışlıkla mobil silinmesi | Allowlist dışında silme scripti; `mobile/` exclude |
| Credential sızıntısı | `gulumsetenemlak*.json`, `google/*.json` sil; commit etme |
| Cursor kuralları eksik | Mobil `.cursor/rules` mobil repo veya lokal kökte tut |
| Unity / VR native modül | `mobile/mobil_github/frontend` altında — silme denylist'e **dokunma** |
| `birlestirilmis_katmanlar` disk alanı | Gitignore’da kalır; yedekte robocopy ile isteğe bağlı hariç tutulabilir |
| `orbit_video` / `remotion` Node bağımlılığı | Lokal Metro için gerekmez; klasör referans amaçlı durabilir |

---

## Sonraki adımlar (bu plandan sonra)

1. **pp32 worker-only sadeleştirme** — [pp32-worker-scope.md](./pp32-worker-scope.md) (rclone; drone + birlestirilmis_katmanlar kalır)
2. **pp33 sunucuda** ana README + `docs/` (kaynak doküman — lokalde olmayacak)

---

## Onay checklist

Uygulamaya geçmeden:

- [ ] Git: kök `proparcel_v1` kaldırılacak mı onaylandı mı?
- [ ] Mobil repo (`mobil.git`) güncel push edildi mi?
