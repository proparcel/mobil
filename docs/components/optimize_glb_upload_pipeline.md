# GLB Upload Optimizasyon Pipeline (Mapbox ModelLayer)

Upload anında GLB’yi otomatik optimize edip mobil “lite” üretmek ve Mapbox ModelLayer’da güvenli render için kullanmak.

---

## 1) `optimize_glb.js` kullanımı

```bash
node scripts/optimize_glb.js --in <input.glb> --out <output_mb.glb> --category <car|tree|grass|house> [--config <path>]
```

**Örnek:**

```bash
npm run optimize-glb -- --in assets/models/car/Car.glb --out assets/models/car/Car_mb.glb --category car
```

**Texture’sız model (ör. Box.glb):** resize atlanır; simplify, dedup, prune yine uygulanır. Örnek log: `textureCount=0`, `input byteLength=1.6 KB`, `output byteLength=1.5 KB`.

**Config** (`scripts/optimize_glb_config.json`):

| Kategori | width | height | ratio |
|----------|-------|--------|-------|
| car      | 1024  | 1024   | 0.25  |
| tree     | 1024  | 1024   | 0.4   |
| grass    | 512   | 512    | 0.4   |
| house    | 2048  | 2048   | 0.35  |

`--config` verilmezse `scripts/optimize_glb_config.json` kullanılır.

---

## 2) Örnek log satırları

**Başarılı çalışma:**

```
[optimize_glb] input byteLength=98.65 MB
[optimize_glb] input extensionsUsed=["KHR_materials_clearcoat","KHR_texture_transform"] extensionsRequired=["KHR_texture_transform"]
[optimize_glb] input maxVertexCountPerMesh=102549 textureCount=24 indexTypes=["u32"]
[optimize_glb] output byteLength=8.12 MB
[optimize_glb] output extensionsUsed=[] extensionsRequired=[]
[optimize_glb] output maxVertexCountPerMesh=28412 textureCount=24 indexTypes=["u16"]
[optimize_glb] OK Car.glb -> Car_mb.glb 98.65 MB -> 8.12 MB (12453 ms) category=car width=1024 height=1024 ratio=0.25
```

**Hata (input yok):**

```
[optimize_glb] Input not found: /path/to/input.glb
```

**Hata (deps eksik):**

```
[optimize_glb] Missing deps. Install: npm i meshoptimizer sharp <message>
```

**Hata (read/transform/write):**

```
[optimize_glb] Read failed: Missing required extension, "KHR_foo".
[optimize_glb] Transform failed: ...
[optimize_glb] Write failed: ...
[optimize_glb] FAIL: <message>
```

---

## 3) Başarısızlık durumları ve fallback

| Durum | Ne yapılır | Fallback |
|-------|------------|----------|
| **Input not found** | `--in` dosyası yok | Upload’ı reddet veya hata dön; optimizasyon çalıştırma. |
| **Missing deps** (meshoptimizer / sharp) | `npm i meshoptimizer sharp` | Optimize etme; mobil tarafına orijinali kopyala (mevcut bypass). |
| **Read failed** | GLB parse / extension hatası | Optimize etme; mobil’e orijinali kopyala. Log’la; gerekirse kullanıcıyı uyar. |
| **Transform failed** | simplify / weld / prune vb. hata | Optimize etme; mobil’e orijinali kopyala. |
| **Write failed** | Disk / izin / path hatası | Optimize etme; mobil’e orijinali kopyala. DB’yi orijinal path ile güncelle. |
| **Exit 1** (genel) | Yukarıdakilerden biri | Optimize edilmiş dosyayı kullanma; orijinali kopyala, DB’de mobil path orijinali işaret et. |

**Özet:** Optimizasyon herhangi bir noktada başarısız olursa **orijinal dosyayı mobil path’e kopyala**, DB’yi buna göre güncelle ve kullanıcıya “optimize edilemedi, orijinal kullanılıyor” benzeri bilgi verilebilir.

---

## 4) Server pipeline entegrasyonu (pseudo-code)

### 4.1) Node (Express veya Fastify) – spawn ile

Upload tamamlandığında optimize script’i çalıştır; başarılıysa DB’yi güncelle ve optimize dosyayı servis et, değilse orijinali kopyala ve onu servis et.

```js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FRONTEND_ROOT = path.join(__dirname, '..', 'mobile', 'mobil_github', 'frontend');
const OPTIMIZE_SCRIPT = path.join(FRONTEND_ROOT, 'scripts', 'optimize_glb.js');

async function runOptimizeGlb({ inputPath, outputPath, category }) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [OPTIMIZE_SCRIPT, '--in', inputPath, '--out', outputPath, '--category', category],
      { cwd: FRONTEND_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d; });
    child.stderr?.on('data', (d) => { stderr += d; });
    child.on('error', (e) => reject(new Error(`spawn failed: ${e.message}`)));
    child.on('close', (code) => {
      const out = stdout + stderr;
      if (code !== 0) return reject(new Error(`optimize_glb exit ${code}\n${out}`));
      resolve(out);
    });
  });
}

async function onGlbUpload(req, res) {
  const webPath = ...;      // e.g. myapp/static/models/car/foo.glb
  const mobilPath = ...;    // e.g. assets/models/car/foo_mb.glb (or foo.glb)
  const category = req.body.category || 'car';
  const inputFull = path.join(BASE_DIR, 'myapp', 'static', webPath);
  const mobilFull = path.join(FRONTEND_ROOT, 'assets', 'models', category, path.basename(mobilPath));

  try {
    await runOptimizeGlb({ inputPath: inputFull, outputPath: mobilFull, category });
    await db.updateModel({ id, mobil_path: mobilPath });
    return res.json({ success: true, message: 'Model eklendi (mobil: optimize edildi).' });
  } catch (e) {
    console.warn('[upload] optimize failed, fallback to original:', e.message);
    fs.copyFileSync(inputFull, mobilFull);
    await db.updateModel({ id, mobil_path: mobilPath });
    return res.json({ success: true, message: 'Model eklendi (mobil: orijinal kopyalandı).' });
  }
}
```

- **stdout/stderr:** Log’a yaz; `runOptimizeGlb` reject etmeden önce bu çıktıyı `Error` mesajına ekleyebilirsin.
- **Timeout:** `spawn` için timeout eklenebilir; aşımda `child.kill('SIGTERM')` ve reject.

### 4.2) Django – `subprocess` ile

Mevcut `handle_model_save` / `_write_web_mobil_from_upload` akışına optimize adımı ekle. Önce web’e orijinali yaz; sonra Node script’i çalıştır; başarılıysa mobil path’e optimize çıktısını koy, değilse orijinali kopyala.

```python
import subprocess
import shutil
from pathlib import Path

FRONTEND_ROOT = Path(settings.BASE_DIR) / "mobile" / "mobil_github" / "frontend"
OPTIMIZE_SCRIPT = FRONTEND_ROOT / "scripts" / "optimize_glb.js"

def run_optimize_glb(*, input_path: Path, output_path: Path, category: str) -> bool:
    out = subprocess.run(
        [
            "node",
            str(OPTIMIZE_SCRIPT),
            "--in", str(input_path),
            "--out", str(output_path),
            "--category", category,
        ],
        cwd=str(FRONTEND_ROOT),
        capture_output=True,
        text=True,
        timeout=300,
    )
    log = (out.stdout or "") + (out.stderr or "")
    if out.returncode != 0:
        logger.warning("[optimize_glb] exit %s: %s", out.returncode, log)
        return False
    return True

def _write_web_mobil_from_upload(model_file, web_path_full, mobil_path_full, category: str):
    web_path_full = Path(web_path_full)
    mobil_path_full = Path(mobil_path_full)
    web_path_full.parent.mkdir(parents=True, exist_ok=True)
    mobil_path_full.parent.mkdir(parents=True, exist_ok=True)
    with open(web_path_full, "wb") as f:
        for chunk in model_file.chunks():
            f.write(chunk)
    if run_optimize_glb(
        input_path=web_path_full,
        output_path=mobil_path_full,
        category=category,
    ):
        return True, None  # compressed/optimized
    shutil.copy2(web_path_full, mobil_path_full)
    return False, "optimize_failed"
```

- `handle_model_save` içinde `_write_web_mobil_from_upload(..., category=cat_type)` çağrılır.
- Optimize başarısızsa mobil’e orijinal kopyalanır; DB yine `mobil_path` ile güncellenir.

### 4.3) Celery (opsiyonel)

Optimizasyon uzun sürüyorsa upload yanıtını hemen dönüp, arka planda Celery task ile `run_optimize_glb` çalıştırılabilir. Task başarılıysa `mobil_path` optimize dosyayı işaret eder; başarısızsa orijinali kopyala ve DB’yi güncelle. Akış yine aynı: **başarı → optimize dosya**, **hata → orijinal kopyala + fallback**.

---

## 5) Akış özeti

1. Kullanıcı GLB yükler → sunucu orijinali web path’e yazar.
2. `optimize_glb.js` çalıştırılır: `--in` web path, `--out` mobil path, `--category` car/tree/grass/house.
3. **Exit 0:** Çıktı `output_mb.glb` (veya verdiğin mobil dosya adı) olur; DB’de `mobil_path` buna işaret eder.
4. **Exit 1:** Orijinal dosyayı mobil path’e kopyala; `mobil_path` orijinali işaret eder.
5. Uygulama (web/mobil) her zaman `mobil_path`’teki dosyayı kullanır; bu dosya mümkünse optimize, değilse orijinal olur.

---

## 6) Config ve parametreler

- **Kategori parametreleri:** `scripts/optimize_glb_config.json` (veya `--config` ile verilen dosya).
- **Texture downscale:** Kategoriye göre max `width` x `height`; `fit: inside`, `withoutEnlargement`.
- **Simplify:** `weld` + `simplify`; `ratio` kategoriye göre, `error: 0.001`.
- **Cleanup:** `dedup`, `prune`.

Bu pipeline ile upload anında üretilen “lite” GLB, Mapbox ModelLayer’da daha güvenli render için kullanılabilir; optimizasyon bozulursa fallback ile orijinal kullanılmaya devam eder.
