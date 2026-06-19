# VR Parsel — Veri Sözleşmesi

## RN → Unity: VrParcelPayload

```json
{
  "parcelId": "bursa-nilufer-123-45",
  "city": "Bursa",
  "town": "Nilüfer",
  "quarter": "…",
  "ada": "123",
  "parsel": "45",
  "areaM2": 4250,
  "center": { "lat": 40.123, "lon": 29.123 },
  "polygon": [
    { "lat": 40.123, "lon": 29.123 },
    { "lat": 40.124, "lon": 29.124 }
  ]
}
```

TypeScript: `modules/vrParcel/types/vrParcelPayload.ts`  
Unity DTO: `VrParcelBridge.VrParcelPayloadDto`

## CalibrationTransform

```json
{
  "originLat": 40.123,
  "originLon": 29.123,
  "rotationYaw": 12.5,
  "translationX": 0.1,
  "translationY": 0,
  "translationZ": -0.2,
  "scale": 1.02,
  "accuracyScore": 0.78,
  "createdAt": "2026-06-07T12:00:00.000Z"
}
```

## Referans noktası (Unity internal)

GPS capture + screen tap capture — bkz. `ReferencePointCapture.cs`, `types/referencePoint.ts`.

## Bridge API

| Yön | Metot | Açıklama |
|-----|-------|----------|
| RN → Native | `VrUnityModule.openParcelSession(json)` | Unity oturumu aç |
| RN → Native | `VrUnityModule.closeParcelSession()` | Kapat |
| RN → Native | `VrUnityModule.isAvailable()` | Unity build bağlı mı |
| Unity | `VrParcelBridge.OnOpenSession(string json)` | JSON parse + reset |

## GeoJSON kaynak

Ana ekran Mapbox formatı `[lon, lat]`. Adapter modül içinde `{ lat, lon }[]` üretir; shared `parcelUtils` değiştirilmez.
