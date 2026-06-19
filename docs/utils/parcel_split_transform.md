# Hisseli Parsel Transform (parcelSplitTransform)

## Özellik / Görev

`parcelSplitTransform.ts`, hisseli parsel ekranında GeoJSON polygon’ı ekran koordinatlarına çevirmek için kullanılır. Ring çıkarma ve fit-to-view ölçekleme yapar.

## Girdiler

- `getRingFromGeoJSON(geom)`: `geom` — GeoJSON Polygon veya benzeri object.
- `fitRingToView(ring, width, height, padding)`: `ring` — `{x,y}[]`, view boyutları ve padding.

## İç akış

- `getRingFromGeoJSON`: `Polygon.coordinates[0]` (dış ring) alınır; `{x, y}` dizisine çevrilir. Geçersiz yapıda `null` döner.
- `fitRingToView`: Ring bbox hesaplanır; scale = min(w/spanX, h/spanY, 1); merkezleme ile offset uygulanır. Çıktı: SVG `Polygon` `points` string’i (`x1,y1 x2,y2 ...`).

## Çıktılar

- `getRingFromGeoJSON`: `Array<{x,y}> | null`
- `fitRingToView`: `string` (points)

## Dosya

- `src/utils/parcelSplitTransform.ts`
