# Mobil dokümantasyon — `docs/mobile/` → `mobil.git` taşıma planı

> **Durum:** M0–M7 tamamlandı; M6 pp33 commit edildi  
> **Tarih:** 2026-06-19  
> **İlgili:** [local-pc-mobile-only-cleanup-plan.md](./local-pc-mobile-only-cleanup-plan.md)  
> **Kural:** Mobil doküman **yalnızca** `https://github.com/proparcel/mobil.git` içinde yaşar; lokal kökte `docs/` **tutulmaz**.

---

## Amaç

ProParcel monorepo (`proparcel_v1`, pp33) içindeki **`docs/mobile/`** ağacını mobil repoya taşımak; lokal ve pp33’te mobil doküman kopyası bırakmamak.

| Konum | Son durum |
|-------|-----------|
| **`mobil.git`** | Kanonik mobil doküman kökü: `docs/` |
| **pp33 `proparcel_v1`** | `docs/mobile/` **silinir**; `docs/README.md` mobil satırı mobil repo linkine güncellenir |
| **Lokal `C:\ProParcel`** | Tüm `docs/` **silinir** (bu plan dahil — taşıma bitince kopya `mobil.git` içinde) |

---

## Mevcut envanter (2026-06-19)

### Monorepo `docs/mobile/` (kaynak)

- **Dal:** `cursor/mobile-landing-portal-release` commit `e0693c17d` (88 `.md` dosyası)
- **`main` / `17bd757`:** `docs/mobile/` **yok** — taşıma bu dal içeriğinden veya pp33 sunucusundan alınır
- **Yapı:**

```
docs/mobile/
├── index.md
├── architecture.md
├── development-rules.md
├── api/
├── build/
├── changes/
├── components/
├── guides/
├── modules/
└── utils/
```

### Mobil repo `mobil.git` (hedef — dağınık legacy)

- **~41** kök/alt `.md` dosyası; yapı düzensiz:
  - Repo kökü: `HOW_TO_DEBUG.md`, `SUNUCU_BASLATMA.md`, …
  - `frontend/*.md`: `EXPO_CLEANUP_PLAN.md`, `GRADLE_FIX_PLAN.md`, …
  - `backend/*.md`
  - `docs/ARCHITECTURE_DECISION_3D_MODELS.md`
- **Çakışma:** Birçok konu hem `docs/mobile/changes/` hem `frontend/*.md` altında farklı isimle var (birleştirme gerekir).

---

## Hedef yapı (`mobil.git`)

Tek kanonik kök:

```
mobil.git/
├── README.md                    # kısa giriş → docs/README.md
├── docs/
│   ├── README.md                # docs/mobile/index.md
│   ├── architecture.md
│   ├── development-rules.md
│   ├── api/
│   ├── build/
│   ├── changes/
│   ├── components/
│   ├── guides/
│   ├── modules/
│   └── utils/
├── frontend/                    # uygulama kodu (doc *.md kökte kalmaz)
└── backend/
```

**İsimlendirme:** Monorepo `docs/mobile/` yolları → `docs/` altında aynı göreli yol (`docs/mobile/architecture.md` → `docs/architecture.md`).

---

## Faz M0 — Hazırlık

- [ ] Kaynak seç:
  - **A)** Lokal `e0693c17d` dalından `docs/mobile/` export
  - **B)** pp33 sunucusunda `docs/mobile/` varsa oradan (mount değil, sunucu disk)
- [ ] `mobile/mobil_github` submodule güncel; mobil repoda çalışma dalı (`main` veya feature branch)
- [ ] Taşıma öncesi `mobil.git` commit + push (rollback noktası)

**Export komutu (kaynak A — lokal monorepo dal):**

```powershell
$Src = "C:\ProParcel\_export_docs_mobile"
New-Item -ItemType Directory -Path $Src -Force | Out-Null
git -C C:\ProParcel archive e0693c17d docs/mobile/ | tar -x -C $Src
# veya: git checkout e0693c17d -- docs/mobile  (geçici; sonra geri al)
```

---

## Faz M1 — Mobil repoda `docs/` iskeleti

`mobile/mobil_github` içinde:

```powershell
cd C:\ProParcel\mobile\mobil_github
mkdir docs\api, docs\build, docs\changes, docs\components, docs\guides, docs\modules, docs\utils
```

- [ ] `docs/README.md` ← `docs/mobile/index.md`
- [ ] Kök `README.md` kısalt: “Mobil dokümantasyon: [docs/README.md](docs/README.md)”

---

## Faz M2 — Monorepo içeriğini kopyala

- [ ] `docs/mobile/*` → `mobil.git/docs/` (üst `mobile/` önekini kaldır)
- [ ] Binary/varlık yoksa doğrudan kopya; görseller varsa `docs/` altına taşı

```powershell
$Export = "C:\ProParcel\_export_docs_mobile\docs\mobile"
$Dest   = "C:\ProParcel\mobile\mobil_github\docs"
Copy-Item -Path "$Export\*" -Destination $Dest -Recurse -Force
# index.md → README.md
Move-Item -Force "$Dest\index.md" "$Dest\README.md" -ErrorAction SilentlyContinue
```

---

## Faz M3 — Legacy `mobil.git` markdown birleştirme

Her legacy dosya için **tek kanonik** hedef; duplicate silinir.

| Legacy (mobil.git) | Aksiyon | Hedef |
|--------------------|---------|--------|
| `docs/ARCHITECTURE_DECISION_3D_MODELS.md` | Taşı | `docs/modules/` veya `docs/architecture/` alt sayfa |
| `frontend/EXPO_CLEANUP_PLAN.md` | Monorepo `docs/mobile/changes/expo_cleanup_plan.md` varsa **monorepo kazanır**; legacy sil |
| `frontend/GRADLE_*.md`, `JETIFIER_*.md`, `METRO_*.md` | `docs/changes/` veya `docs/build/` — içerik diff; tek dosya bırak |
| `frontend/GOOGLE_PLAY_BUILD.md` | `docs/build/` ile birleştir |
| `HOW_TO_DEBUG.md`, `SUNUCU_*.md` | `docs/guides/` |
| `backend/*.md` | `docs/api/` veya `docs/guides/` |

- [ ] Birleştirme tablosu satır satır işlendi
- [ ] `frontend/*.md` (doc) ve repo kökü `.md` (doc) **temizlendi** — yalnızca kod README’leri kalabilir (`assets/.../README.md`)

---

## Faz M4 — Link ve referans düzeltme

- [ ] `docs/` içi linkler: `docs/mobile/` → `docs/` veya göreli yol
- [ ] Monorepo referansları (`docs/architecture.md`, `proparcel_v1`) → “sunucu dokümanı pp33” notu veya sil
- [ ] Mobil kod yorumları / `.cursor/rules` mobil repo içinde `docs/architecture.md` path’ine güncelle
- [ ] `frontend` içinde `doc/architecture.md` arayan referans var mı — grep ile kontrol

**Kontrol:**

```powershell
cd C:\ProParcel\mobile\mobil_github
git grep -n "docs/mobile" -- "*.md" "*.tsx" "*.ts" ".cursor" 2>$null
git grep -n "mobile/doc/" -- "*.md" 2>$null
```

---

## Faz M5 — `mobil.git` commit ve push

```powershell
cd C:\ProParcel\mobile\mobil_github
git add docs/ README.md
git status
git commit -m "docs: monorepo docs/mobile tasindi; kanonik docs/ agaci"
git push origin HEAD
```

- [ ] Push başarılı
- [ ] Submodule SHA ana repoda güncellenmez (lokal kök `proparcel_v1` artık taşınmıyor) — yalnızca mobil repo yeterli

---

## Faz M6 — pp33 monorepo temizliği (sunucuda)

**pp33 pull yok** — değişiklik sunucuda doğrudan uygulanır.

- [ ] `docs/mobile/` varsa **sil**
- [ ] [`docs/README.md`](../README.md) — `mobile/` satırını kaldır; not ekle: “Mobil doküman: https://github.com/proparcel/mobil/tree/main/docs”
- [ ] [`docs/guides/documentation_inventory.md`](../guides/documentation_inventory.md) — mobil girdileri mobil repo URL’sine yönlendir
- [ ] `mobile/README.md` (monorepo) — submodule pointer + link `mobil.git/docs/`
- [ ] Sunucuda commit + push `proparcel_v1`

---

## Faz M7 — Lokal temizlik (cleanup plan ile birleşik)

- [ ] Bu plan dosyasının son hali `mobil.git/docs/operations/mobile-docs-migration-plan.md` veya `docs/changes/` altına kopyalandı
- [ ] `C:\ProParcel\docs\` **tamamı silinir** (operations dahil)
- [ ] Kök `architecture.md`, `mobile/README.md` (monorepo) silinir
- [ ] Doğrulama: `Test-Path C:\ProParcel\docs` → `$false`

---

## Doğrulama checklist

| # | Kontrol |
|---|---------|
| 1 | `mobil.git/docs/architecture.md` mevcut |
| 2 | `mobil.git/frontend/` kökünde geçici `*.md` doc kalmadı (istisna: asset readme) |
| 3 | pp33 `docs/mobile/` yok |
| 4 | Lokal `docs/` yok |
| 5 | Metro/build dokümanı geliştirici `mobil.git` clone/submodule ile erişiyor |

---

## Riskler

| Risk | Önlem |
|------|--------|
| `main`’de `docs/mobile` yok | Kaynak: `e0693c17d` veya pp33 sunucu |
| Duplicate içerik çelişkisi | M3’te monorepo sürümü kanonik; legacy arşiv commit mesajında not |
| Kırık linkler | M4 grep zorunlu |
| Plan dosyası `docs/` ile silinir | M7 öncesi `mobil.git`’e kopyala |

---

## Sıra özeti

```
M0 hazırlık → M1 iskelet → M2 kopyala → M3 birleştir → M4 linkler
    → M5 mobil.git push → M6 pp33 sunucu → M7 lokal docs/ sil
```

**Bağımlılık:** M5 bitmeden M7’de `docs/` silme. M6 pp33 ile M7 lokal paralel olabilir (pull yok).

---

## Onay

- [ ] Kaynak: dal `e0693c17d` / pp33 sunucu?
- [ ] Legacy birleştirmede monorepo mu öncelikli?
- [ ] M5 sonrası pp33 sunucu adımı kimde?
