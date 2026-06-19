# Mapbox Android CustomLayer Render Sorunu - AI Prompt

## Sorun Özeti

Mapbox Android Maps SDK'da `CustomLayer` başarıyla eklendi, `CustomLayerHost.initialize()` çağrıldı, ancak `CustomLayerHost.render()` metodu **sadece bir kere çağrılıyor**. Map'i hareket ettirdiğimizde (zoom, pan) bile `render()` tekrar çağrılmıyor. Frame count 1'de kalıyor.

## Teknik Detaylar

### Ortam
- **Platform**: React Native Android
- **Mapbox SDK**: Android Maps SDK (v10+)
- **Paket**: `@rnmapbox/maps` (Mapbox Maps SDK for React Native)
- **Dil**: Kotlin (native module)

### Sorun Senaryosu

1. **Custom Layer Ekleme (Başarılı)**:
   ```kotlin
   val customLayer = CustomLayer(
       layerId = "filament-custom-layer-probe",
       host = customLayerProbe!!
   )
   style.addLayer(customLayer as com.mapbox.maps.extension.style.layers.Layer)
   ```

2. **CustomLayerHost Implementation**:
   ```kotlin
   class MapboxCustomLayerProbe : CustomLayerHost {
       override fun initialize() {
           // ✅ Çağrılıyor
           Log.d(TAG, "✅ Custom layer probe initialize() tamamlandı")
       }
       
       override fun render(renderParameters: CustomLayerRenderParameters) {
           val currentFrame = frameCount.incrementAndGet()
           // ❌ Sadece bir kere çağrılıyor (currentFrame = 1)
           // Map'i hareket ettirdiğimizde tekrar çağrılmıyor
           Log.d(TAG, "🔍 TEST: Render çağrısı #$currentFrame")
       }
   }
   ```

### Log Çıktıları

```
✅ Custom Layer Mapbox'a eklendi (layerId=filament-custom-layer-probe)
✅ Custom layer probe initialize() tamamlandı - Thread: MapboxRenderThread
🔍 TEST: İlk render çağrısı - Thread: MapboxRenderThread, Frame: 1
🔍 TEST: Render çağrısı #1 - Thread: MapboxRenderThread
GL_VERSION = OpenGL ES 3.2 V@0800.40.1
```

**Sorun**: Sadece "Render çağrısı #1" görünüyor. Map'i hareket ettirdiğimizde (zoom, pan, rotate) `render()` tekrar çağrılmıyor. Frame count 1'de kalıyor.

### Önemli Gözlemler

1. ✅ **Custom Layer eklendi**: `style.addLayer()` başarılı
2. ✅ **initialize() çağrıldı**: `CustomLayerHost.initialize()` başarıyla çağrıldı
3. ✅ **İlk render çağrıldı**: `render()` bir kere çağrıldı (Frame: 1)
4. ❌ **Sonraki render'lar yok**: Map'i hareket ettirdiğimizde `render()` tekrar çağrılmıyor
5. ✅ **GL Context hazır**: GL_VERSION okunabiliyor, GL context çalışıyor
6. ✅ **Thread doğru**: MapboxRenderThread'de çalışıyor

### Mevcut Kod

**CustomLayerHost Implementation**:
```kotlin
class MapboxCustomLayerProbe : CustomLayerHost {
    private val frameCount = AtomicInteger(0)
    private var initialized = false

    override fun initialize() {
        initialized = true
        Log.d(TAG, "✅ Custom layer probe initialize() tamamlandı")
    }

    override fun render(renderParameters: CustomLayerRenderParameters) {
        if (!initialized) {
            Log.w(TAG, "⚠️ Render çağrıldı ama initialize() henüz çağrılmadı")
            return
        }

        val currentFrame = frameCount.incrementAndGet()
        Log.d(TAG, "🔍 TEST: Render çağrısı #$currentFrame")
        
        // GL error kontrolü
        val glError = android.opengl.GLES20.glGetError()
        if (glError != android.opengl.GLES20.GL_NO_ERROR) {
            errorCount.incrementAndGet()
        }
    }

    override fun deinitialize() {
        initialized = false
    }

    override fun contextLost() {
        initialized = false
    }
}
```

**Custom Layer Ekleme**:
```kotlin
val customLayer = CustomLayer(
    layerId = "filament-custom-layer-probe",
    host = customLayerProbe!!
)
style.addLayer(customLayer as com.mapbox.maps.extension.style.layers.Layer)
```

## Sorular

1. **Neden `render()` sadece bir kere çağrılıyor?**
   - Mapbox Custom Layer'lar normalde her frame'de render edilir
   - Map'i hareket ettirdiğimizde `render()` tekrar çağrılmalı
   - Neden sadece bir kere çağrılıyor?

2. **Custom Layer'ın render edilmesi için özel koşullar var mı?**
   - Terrain/3D mode açık olmalı mı?
   - Belirli bir zoom level'da mı render edilir?
   - Layer order önemli mi?

3. **Layer visibility sorunu olabilir mi?**
   - Custom Layer görünür mü?
   - minZoom/maxZoom ayarları gerekli mi?
   - Layer'ın render edilmesi için özel bir property var mı?

4. **Mapbox SDK versiyonu ile ilgili bir sorun mu?**
   - Belirli SDK versiyonlarında bilinen bir bug var mı?
   - Custom Layer render'ı için özel bir konfigürasyon gerekli mi?

5. **CustomLayerHost implementation'ında eksik bir şey var mı?**
   - `render()` metodunda yapılması gereken bir şey var mı?
   - GL state management gerekli mi?
   - `renderParameters` kullanılmalı mı?

## Beklenen Davranış

- `render()` metodu her frame'de çağrılmalı (60 FPS için saniyede 60 kere)
- Map'i hareket ettirdiğimizde `render()` tekrar çağrılmalı
- Frame count sürekli artmalı

## Gerçek Davranış

- `render()` sadece bir kere çağrılıyor (Frame: 1)
- Map'i hareket ettirdiğimizde `render()` tekrar çağrılmıyor
- Frame count 1'de kalıyor

## Ek Bilgiler

- Custom Layer başarıyla eklendi (`style.addLayer()` başarılı)
- `initialize()` başarıyla çağrıldı
- GL context hazır (GL_VERSION okunabiliyor)
- Thread doğru (MapboxRenderThread)
- Map görünür ve kullanıcı map'e bakıyor
- Map'i hareket ettiriyoruz (zoom, pan) ama `render()` çağrılmıyor

## Kritik Soru

**Mapbox Android Maps SDK'da CustomLayer eklendi, initialize() çağrıldı, ama render() sadece bir kere çağrılıyor. Map'i hareket ettirdiğimizde render() tekrar çağrılmıyor. Bu normal bir davranış mı, yoksa bir bug mı? Custom Layer'ın her frame'de render edilmesi için özel bir konfigürasyon gerekli mi?**

---

**Not**: Bu prompt'u başka bir AI'ya (Claude, ChatGPT, vb.) sorabilirsiniz. Custom Layer başarıyla eklendi ama render edilmiyor - bu Mapbox SDK'nın beklenen davranışı mı yoksa bir sorun mu?
