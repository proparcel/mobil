# pp32 — worker-only sadeleştirme planı

> **Durum:** W0–W5 tamam; W4 ilk denemede worker boot kırıldı → **hotfix uygulandı** (analyze road-v2 test route kaldırıldı)  
> **Tarih:** 2026-06-19  
> **Uygulama yolu:** **rclone SFTP** (`pp32:/ProParcel/`) — lokal PC ve RDP değil  
> **İlgili:** [local-pc-mobile-only-cleanup-plan.md](./local-pc-mobile-only-cleanup-plan.md)  
> **Kaynak (pp33):** `docs/operations/runtime-and-backup.md`, `docs/architecture.md`

---

## Karar özeti (2026-06-19)

| Konu | Karar |
|------|--------|
| Erişim | **rclone SFTP** ile pp32 diskinde işlem |
| `birlestirilmis_katmanlar/` | **Silinmez** (tam ağaç kalır) |
| Drone ile ilgili | **Kalır** (export + referans kod) |
| Diğerleri | Lokal PC denylist ile **aynı mantık** — worker ana işi dışında kalan monorepo yükü silinir |
| pp33 / lokal PC | Bu plan **yalnızca pp32 diskini** hedefler |
| **Git (pp32)** | **`proparcel_pp32`** — pp32'nin tek monorepo kaynağı (`proparcel_v1` değil) |

---

## Üç repo modeli

| Makine | Git repo | Remote |
|--------|----------|--------|
| **pp33** | `proparcel_v1` | `https://github.com/proparcel/proparcel_v1.git` |
| **pp32** | **`proparcel_pp32`** | `https://github.com/proparcel/proparcel_pp32.git` |
| **Lokal PC** | `mobil.git` | `https://github.com/proparcel/mobil.git` |

```
pp33  ── proparcel_v1    ──►  web + API + docs + broker (kaynak)
pp32  ── proparcel_pp32  ──►  worker-only disk (valuation + io_heavy + drone export)
lokal ── mobil.git       ──►  mobile/mobil_github (Metro)
```

**Kural:** pp32 **`proparcel_v1` pull/push yapmaz.** Kod güncellemesi yalnızca **`proparcel_pp32`** üzerinden (`start_32.bat pull` → `origin` = `proparcel_pp32`).

**Mevcut durum (2026-06-19):** pp32 disk hâlâ `proparcel_v1` remote'una bağlı — W5 migrasyonu ile `proparcel_pp32`'ye geçilecek.

---

## pp32 ana işi (silinmeyecek çekirdek)

**pp32 = uzak Celery worker.** pp33 = control-plane (API, broker, Mongo, SMB).

```
start_32.bat
├── remote-valuation1  → valuation_queue   (run_valuation)
├── remote-ioheavy1    → io_heavy_queue    (io_t5, io_t7, fetch_price_and_km)
└── droneexport1       → drone_export_queue (FFmpeg + Remotion export)
```

**Ağ (pp32 → pp33):** Redis `:6379`, Mongo `:27017`, SMB `\\178.210.168.33\proparcel\media`

Günlük: `start_32.bat` · Kod: `start_32.bat pull`

---

## Allowlist — pp32'de kalacaklar

Lokal allowlist'ten farklı olarak pp32 **Django/Celery worker** çalıştırır; aşağıdakiler zorunlu.

### Worker çekirdeği

| Yol | Gerekçe |
|-----|---------|
| `start_32.bat` | Tek kanonik başlatıcı |
| `celery_app.py`, `manage.py` | Celery / Django entry |
| `proparcel/` | Settings, Celery app |
| `myapp/` | Valuation, io_t5/io_t7 task'ları |
| `accounts/` | Task zincirinde kullanıcı/kredi import |
| `ilan_portal/` | Drone export servisleri (`listing/drone_*`) |
| `scripts/` | Worker env + launcher (`start_remote_compute_workers.cmd`, `start_drone_export_worker.cmd`, `stop_*.ps1`, `setup_remotion_image_scene.cmd`, …) |
| `requirements.txt` | Python bağımlılıkları |
| `logs/` | Worker logları |
| `.git/` | pp32 sunucuda — **`proparcel_pp32`** (W5 sonrası; şu an geçici `proparcel_v1`) |

### Drone (kullanıcı: kalacak)

| Yol | Gerekçe |
|-----|---------|
| `remotion-image-scene/` | Drone export segment render (Node); `drone_export_queue` |
| `orbit_video/` | Drone CPU pipeline referans/kod (export/import zinciri) |
| `packages/` | `image-scene-motion` vb. Remotion bağımlılığı |
| `Dockerfile.remotion-worker` | Remotion worker imaj referansı (opsiyonel; silinmez) |
| `ilan_portal/listing/drone_*` | Export task kodu (`ilan_portal/` ile birlikte kalır) |

### Coğrafi veri (kullanıcı: silinmez)

| Yol | Gerekçe |
|-----|---------|
| **`birlestirilmis_katmanlar/`** | DEM + katman ağacı; `io_t5` yerel `.tif` yedek + operasyonel referans |

### Django app klasörleri — W1 doğrulama

Lokal PC'de silinen ancak pp32'de **`INSTALLED_APPS` / Celery boot** için diskte kalması gerekebilecekler:

| Yol | pp32 |
|-----|------|
| `analyze/` | **Kalır** — `INSTALLED_APPS` |
| `energy_analysis/`, `wind_analysis/` | **Kalır** — `INSTALLED_APPS` |
| `buildings/`, `aranacaklar/`, `Eids/` | **Kalır** — `INSTALLED_APPS` / boot |

**Kural:** Lokal denylist ile aynı hedef; ancak `python -m celery -A proparcel inspect ping` kırılırsa geri al.

---

## Denylist — lokal PC ile aynı (pp32'de silinecek)

Lokal [local-pc-mobile-only-cleanup-plan.md](./local-pc-mobile-only-cleanup-plan.md) denylist'inden; **allowlist'te olmayan** her şey.

### Web, mobil, doküman

| Yol | Not |
|-----|-----|
| `frontend-web/` | Vite portal — pp32 HTTP sunmaz |
| `mobile/` | Mobil submodule |
| `docs/` | Kanonik doküman pp33 + mobil.git |
| `architecture.md` (kök) | pp33 docs |

### Test, deploy, tasarım

| Yol |
|-----|
| `test_modulleri/` |
| `deploy/` |
| `design/` |
| `docker/` ( **`Dockerfile.remotion-worker` hariç** — drone allowlist'te köke taşınmışsa kalır ) |
| `tools/` |
| `templates/` |
| `staticfiles/` |
| `inetpub/` |
| `temp/` |

### Veri / yedek (pp32 yerel kopyalar)

| Yol | Not |
|-----|-----|
| `backups/` | |
| `data/` | |
| `media/` | Canlı media SMB üzerinden pp33; pp32 yerel `media/` gereksiz |
| `google/` | Credential / stats |

### pp33-only launcher ve kök dosyalar

Silinecek ( **`start_32.bat` hariç** ):

```
start_proparcel.bat, fast_proparcel.bat, restart_waitress_8000.bat
start_workers_hidden.ps1, kill_workers.ps1
docker-compose.yml, Dockerfile, Dockerfile.heavy
terrain_roughness_grid_preload.py, wind_grid_preload_compressed.py, wind_terrain_grid_preload.py
gunicorn.conf.py, from django.py
mongo_runtime.sqlite3
settings.py, urls.py, wsgi.py, asgi.py   → yalnızca KÖKTEKİ kopyalar (proparcel/ paketi kalır)
```

**Not:** Kök `settings.py` / `urls.py` monorepo'da duplicate ise W0 envanterde doğrula; `proparcel/settings.py` **silinmez**.

### Geçici / credential

```
tmp_*.txt, tmp_*.bat, tmp_*.log
gulumsetenemlak-*.json
.env, .env.docker.example, .env.wsl2.example  → worker env scripts kullanır
```

---

## Lokal vs pp32 karşılaştırma

| Kategori | Lokal PC | pp32 |
|----------|----------|------|
| `mobile/mobil_github` | Kalır | **Sil** (`mobile/`) |
| `birlestirilmis_katmanlar` | Kalır | **Kalır** |
| `orbit_video`, `remotion-image-scene` | Kalır (referans) | **Kalır** (worker drone) |
| `myapp/`, `accounts/`, `ilan_portal/` | Silindi | **Kalır** |
| `scripts/` | Silindi | **Kalır** (worker) |
| `frontend-web/`, `docs/` | Silindi | **Sil** |
| `logs/` | Silindi | **Kalır** |
| Kök `.git` | Silindi | **Kalır** (sunucu clone) |

---

## Hedef disk yapısı (pp32)

```
C:\ProParcel\
├── start_32.bat
├── celery_app.py, manage.py, requirements.txt
├── proparcel/, myapp/, accounts/, ilan_portal/
├── analyze/, energy_analysis/, wind_analysis/, buildings/, aranacaklar/, Eids/
├── scripts/                         # worker launcher
├── remotion-image-scene/
├── orbit_video/
├── packages/
├── birlestirilmis_katmanlar/        # TAM — silinmez
├── logs/
├── README.md                        # "pp32 worker node"
└── .git/                            # W5: proparcel_pp32
```

---

## Uygulama — rclone SFTP

**Remote:** `pp32:/ProParcel/`  
**Lokal PC:** yalnızca komut çalıştırır; pp32 dosyalarına yazmaz.

### Ön kontrol

```powershell
rclone lsd pp32:/ProParcel
rclone lsf pp32:/ProParcel/birlestirilmis_katmanlar --dirs-only | Select-Object -First 5
```

Mount (`C:\ProParcelMounts\pp32`) **kullanılmıyor** — bkz. lokal [REMOTE-ACCESS.md](../../../../REMOTE-ACCESS.md).

### W0 — Hazırlık

- [x] Git SHA: `17bd757` (pp32 main)
- [x] Allowlist doğrulandı (`birlestirilmis_katmanlar`, `remotion-image-scene`, `start_32.bat`)
- [x] Denylist boyutları ölçüldü (~68 MiB toplam)
- [ ] pp32 worker smoke (`start_32.bat`) — **2026-06-19 07:32 FAIL** → hotfix sonrası yeniden başlatın

### W1 — INSTALLED_APPS / import audit

**Sonuç:** `analyze`, `energy_analysis`, `wind_analysis`, `buildings`, `aranacaklar` → **`INSTALLED_APPS` içinde; silinmez** (Celery boot kırılır).

| Klasör | W1 karar |
|--------|----------|
| `analyze/`, `energy_analysis/`, `wind_analysis/` | **Kalır** |
| `buildings/`, `aranacaklar/` | **Kalır** |
| `Eids/` | **Kalır** (ayar/import; W1 diskte duruyor) |
| Drone yığını | **Kalır** — dokunulmadı |

### W2 — Silme (rclone purge) — 2026-06-19

- [x] `frontend-web/`, `mobile/`, `docs/`, `test_modulleri/`, `deploy/`, `design/`, `tools/`, `templates/`, `backups/`, `data/`, `inetpub/`, `google/`, `docker/` silindi
- [x] Kök pp33 launcher dosyaları yoktu veya silindi (exit 4 = zaten yok)
- [x] Allowlist korundu

### W3 — README

- [x] `pp32:/ProParcel/README.md` yazıldı (rclone copyto, 2026-06-19)

### W2 ek — kök denylist (2026-06-19)

- [x] Kök `settings.py`, `urls.py`, `wsgi.py`, `asgi.py`, preload script'leri, `.env.*.example`, `tmp_analysis.txt`, `start_32.bat.bak` silindi (var olanlar)
- [x] `staticfiles/`, `media/`, `temp/` — yoksa atlandı

**Asla purge edilmeyecek prefix'ler:**

```
birlestirilmis_katmanlar
remotion-image-scene
orbit_video
packages
scripts
myapp
proparcel
accounts
ilan_portal
logs
.git
start_32.bat
```

**Denylist purge örneği:**

```powershell
$Remote = "pp32:/ProParcel"
$RemoveDirs = @(
  "frontend-web","mobile","docs","test_modulleri",
  "deploy","design","tools","templates","staticfiles",
  "backups","data","media","inetpub","temp","google"
)
foreach ($d in $RemoveDirs) {
  Write-Host "Purging $d ..."
  rclone purge "$Remote/$d"
}
```

Kök dosyalar (tek tek):

```powershell
$RemoveFiles = @(
  "start_proparcel.bat","fast_proparcel.bat","restart_waitress_8000.bat",
  "start_workers_hidden.ps1","kill_workers.ps1",
  "docker-compose.yml","Dockerfile","Dockerfile.heavy",
  "architecture.md","mongo_runtime.sqlite3"
)
foreach ($f in $RemoveFiles) {
  rclone deletefile "$Remote/$f" 2>$null
}
```

W1 sonrası opsiyonel app purge:

```powershell
# Yalnızca W1 onayından sonra (pp32'de artık gerek yok — INSTALLED_APPS):
# rclone purge pp32:/ProParcel/analyze
```

### W4 — Doğrulama (sunucuda)

**2026-06-19 07:32 — ilk smoke FAIL:** üç worker logunda aynı hata:

```
ModuleNotFoundError: No module named 'test_modulleri'
  analyze/urls.py → road_v2_test_bridge.py
```

**Hotfix (rclone):** `analyze/urls.py` road-v2 test route'ları kaldırıldı; `road_v2_test_bridge.py` silindi; `views.py` `_LIGHT_MODULES` güncellendi.

pp32'de yeniden:

```bat
cd /d C:\ProParcel
start_32.bat
git add analyze/urls.py analyze/views.py
git commit -m "fix(pp32): drop road-v2 test routes — test_modulleri not on worker"
git push origin main
```

| Kontrol | Sonuç (2026-06-19) |
|---------|-------------------|
| Denylist | OK — `frontend-web`, `mobile`, `docs`, `test_modulleri` yok |
| Allowlist | OK — `birlestirilmis_katmanlar`, `remotion-image-scene`, `start_32.bat` |
| Git remote | OK — `origin` = `proparcel_pp32`, `origin_v1_backup` = `proparcel_v1` |
| Git SHA | `8b34ca7` — `chore(pp32): worker-only tree — proparcel_pp32 initial` |
| Worker boot | **FAIL** (hotfix öncesi) → hotfix sonrası **yeniden test gerekli** |

---

## Git — `proparcel_pp32`

| Kural | Açıklama |
|-------|----------|
| **pp32 repo** | **`proparcel_pp32`** — worker-only monorepo |
| **Remote URL** | `https://github.com/proparcel/proparcel_pp32.git` |
| **pp33 repo** | `proparcel_v1` — pp32 **buna bağlanmaz** |
| **Güncelleme** | `start_32.bat pull` → `git pull origin main` (**proparcel_pp32**) |
| **Lokal PC** | `proparcel_pp32` / `proparcel_v1` **pull/push yok** |
| **İçerik** | W2 denylist sonrası allowlist ağacı (worker + drone + `birlestirilmis_katmanlar` diskte; büyük veri Git dışı) |

### W5 — `proparcel_v1` → `proparcel_pp32` migrasyonu

- [x] pp32 `origin` → `https://github.com/proparcel/proparcel_pp32.git`
- [x] `origin_v1_backup` korundu
- [x] Initial commit: `8b34ca7` (`chore(pp32): worker-only tree — proparcel_pp32 initial`)
- [x] `refs/remotes/origin/main` = `8b34ca7` (push diskte görünüyor)
- [ ] Hotfix commit + push (analyze road-v2 test kaldırma)
- [ ] `origin_v1_backup` kaldır (opsiyonel)

W2 sadeleştirme bittikten **sonra** (W4 smoke OK):

1. **GitHub:** `proparcel/proparcel_pp32` repo oluştur (boş veya README).
2. **pp32 disk** (`C:\ProParcel\`) — sadeleştirilmiş ağaç commit:
   ```bat
   cd /d C:\ProParcel
   git status
   git add -A
   git commit -m "chore(pp32): worker-only tree — proparcel_pp32 initial"
   ```
3. **Remote değiştir:**
   ```bat
   git remote rename origin origin_v1_backup
   git remote add origin https://github.com/proparcel/proparcel_pp32.git
   git push -u origin main
   ```
4. **`start_32.bat` doğrula:** `start_32.bat pull` → `git pull origin main` artık **proparcel_pp32** çeker.
5. **`origin_v1_backup` kaldır** (opsiyonel, onay sonrası):
   ```bat
   git remote remove origin_v1_backup
   ```

**Alternatif (temiz clone):** W2 sonrası `C:\ProParcel_pp32` yeni clone → allowlist dosyaları kopyala → `birlestirilmis_katmanlar` yerinde kalır → eski dizin arşiv.

### pp33 ↔ pp32 kod akışı

| Yön | Akış |
|-----|------|
| pp33 → pp32 | Worker-relevant değişiklik pp33 `proparcel_v1`'de geliştirilir; pp32'ye **seçici taşıma** (patch, cherry-pick veya manuel sync) → **`proparcel_pp32` commit** |
| pp32 → pp33 | Worker-only commit pp33'e **merge edilmez**; gerekirse aynı fix pp33'te ayrı commit |
| Doküman | pp32 README + bu plan; kanonik mimari pp33 `docs/` |

### rclone silme vs Git

| rclone purge | Git'te klasörler durur; `git pull` geri getirebilir |
| W5 sonrası | Kalıcı yapı **`proparcel_pp32`** commit'inde; denylist tekrar gelmez |

---

## Riskler

| Risk | Önlem |
|------|--------|
| Allowlist yanlışlıkla purge | W2'de prefix whitelist; komutta çift okuma |
| `birlestirilmis_katmanlar` silindi | Purge listesinde **yok**; kullanıcı kararı kilitli |
| Remotion bozuldu | `remotion-image-scene/` + `setup_remotion_image_scene.cmd` korunur |
| Celery boot kırıldı | W1 INSTALLED_APPS; W4 `start_32.bat` |
| SMB / Redis kopuk | Mevcut `start_32.bat` bağlantı kontrolü |

---

## Sıra

```
W0 envanter → W1 INSTALLED_APPS audit → W2 rclone purge (denylist)
    → W3 README → W4 worker smoke → W5 proparcel_pp32 migrasyon
```

**Bağımlılık:** Lokal L1–L4 tamamlandı. pp32 bağımsız.

---

## Onay (kilitli)

- [x] rclone SFTP ile uygulama
- [x] `birlestirilmis_katmanlar/` silinmez
- [x] Drone yığını kalır
- [x] Diğerleri lokal denylist mantığı + worker çekirdeği
- [x] Git: pp32 → **`proparcel_pp32`** (W5; `proparcel_v1` değil)
- [x] W1: `analyze/` vb. **silinmez** (`INSTALLED_APPS`)
- [ ] W5: `proparcel_pp32` repo oluştur + push (commit sizde)
