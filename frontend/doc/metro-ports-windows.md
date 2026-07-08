# Metro port akisi (Windows)

Giriş dosyaları `frontend/` kökünde:

| Dosya | Metro | Build / baglanti |
|-------|-------|------------------|
| `start_android.bat` | Baslatmaz | `run-android --no-packager` |
| `start_android_metro.bat` | Kapaliysa ac (8082) | + build |
| `start_ios.bat` | Baslatmaz | URL / odaklan |
| `start_ios_metro.bat` | Kapaliysa ac (8081) | expo start |

```mermaid
flowchart TD
  subgraph android_metro [start_android_metro]
    AM1{8082 acik?} -->|Evet| AM2[build only]
    AM1 -->|Hayir| AM3[Metro pencere ac] --> AM4[build]
  end

  subgraph android [start_android]
    A1[build --no-packager] 
  end

  subgraph ios_metro [start_ios_metro]
    IM1{8081 acik?} -->|Evet| IM2[URL goster]
    IM1 -->|Hayir| IM3[expo start 8081]
  end

  subgraph ios [start_ios]
    I1{8081 acik?} -->|Evet| I2[URL goster]
    I1 -->|Hayir| I3[uyari, Metro acma]
  end
```

Port tanimi: `scripts/metro-ports.ps1` (iOS 8081, Android 8082).
