# VR Parsel — Kalibrasyon Akışı

## Amaç

Gerçek lat/lon dünyası ile AR world arasında **3-nokta similarity transform** (`CalibrationTransform`) üretmek. GPS yürüme ve pusula ana hizalama **değildir**; harita + AR referans noktaları kullanılır.

## Mod seçimi

Cihaz kabiliyeti (`VrArCapabilitiesModule`) ile mod belirlenir:

| Mod | Koşul |
|-----|-------|
| `lidar_precise` | iOS + LiDAR / scene depth |
| `arkit_standard` | iOS ARKit |
| `arcore_standard` | Android ARCore |
| `map_only_fallback` | AR yok |

## Adımlar (Faz 1)

```
mode_intro → map_user → map_ref_a → map_ref_b → ar_user → ar_ref_a → ar_ref_b → review → draw → fine_tune
```

### Harita referansları (RN Mapbox)

1. **Konumunuz** — bulunduğunuz nokta
2. **Hedef A** — kamerada görünen sabit referans
3. **Hedef B** — farklı yönde ikinci sabit referans

Validasyon (`vrMapReferenceSelection.ts`):

- Noktalar birbirine < 3 m → uyarı/red
- Üç nokta kolinear → red
- GPS sapması > eşik → sarı uyarı (kilitleme değil)

### AR referansları (Unity veya RN fallback)

Aynı üç nokta AR world'de raycast ile işaretlenir:

1. Ayaklarınızın olduğu zemin
2. Hedef A
3. Hedef B

Raycast önceliği (Unity `ReferencePointCapture`):

1. LiDAR modu: depth raycast
2. AR plane (within polygon)
3. Estimated plane
4. Ground fallback (y=0 düzlemi)

## Hesap (RN + Unity paralel)

`vrCalibrationMath.ts` / `CalibrationTransformCalculator.cs`:

1. Origin = UserPoint lat/lon
2. User, A, B → east/north metre (`GeoLocalConverter`)
3. AR User, A, B → XZ düzlemi
4. Kabsch/Umeyama 2D similarity: rotation + scale + translation
5. `qualityScore`: mesafe, scale, kolinearite ağırlıklı

## Parsel yerleştirme

Polygon lat/lon → lokal metre → transform → Unity world `LineRenderer` (`useWorldSpace = true`). Kamera hareketi çizgiyi taşımaz.

## Manuel ince ayar

±0.1 m X/Z, ±1° yaw → `ApplyFineTune("dx,dz,dyaw")` → polygon yeniden çizilir.

## GPS rolü

GPS yalnızca **saha doğrulama** (`vrGpsRegionValidation.ts`):

- Harita UserPoint vs filtrelenmiş GPS sapması
- Parsel merkezi uzaklık uyarısı

Ana kalibrasyon GPS yürümesi kullanmaz.

## Deprecated (eski akış)

- GPS A/B yürüme (`save_a`, `walk_to_b`, `save_b`)
- `vrSessionMotion` path integral
- `VrParcelOverlay` pusula SVG çizimi
