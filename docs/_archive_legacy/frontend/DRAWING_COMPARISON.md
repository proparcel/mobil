# react-native-maps vs Mapbox GL JS Çizim Desteği

## Desteklenen Özellikler ✓

### 1. **Temel Geometriler**
- ✅ **Polygon**: Parsel sınırları, bölge çizimleri
- ✅ **Polyline**: Yol çizimleri (MultiLineString)
- ✅ **Circle**: Ölçüm ve etki alanı gösterimi
- ✅ **Marker**: Nokta işaretlemeleri

### 2. **Web Projenizde Kullandığınız Özellikler**
- ✅ Yol çizimleri (roads_multilinestring)
- ✅ Parsel/boundary polygon çizimleri
- ✅ Elektrik hattı çizimleri
- ✅ Nokta işaretlemeleri
- ✅ Ölçüm araçları (circle ile mesafe gösterimi)

### 3. **Styling**
- ✅ Renk, kalınlık ayarlama
- ✅ Dolu/çizgili görünüm
- ✅ Opacity kontrolü

## Sınırlamalar ⚠️

### 1. **3D Özellikler**
- ❌ 3D bina çizimleri (react-native-maps 2D'dir)
- ❌ Custom shaders
- ⚠️ **Çözüm**: Mapbox SDK kullanırsanız 3D desteği var

### 2. **Gelişmiş Özellikler**
- ❌ Custom layer'lar (Mapbox GL JS'teki gibi)
- ⚠️ GeoJSON desteği var ama sınırlı
- ✅ Temel GeoJSON rendering destekleniyor

### 3. **Performance**
- ⚠️ Çok fazla geometri olduğunda performans sorunları olabilir
- ✅ Clustering desteği var (çok sayıda marker için)

## Örnek Kullanım

```tsx
import MapView, { Polygon, Polyline, Marker, Circle } from 'react-native-maps';

<MapView>
  {/* Polygon - Parsel sınırları */}
  <Polygon
    coordinates={parcelCoordinates}
    fillColor="rgba(0, 0, 255, 0.3)"
    strokeColor="blue"
    strokeWidth={2}
  />
  
  {/* Polyline - Yol çizimi */}
  <Polyline
    coordinates={roadCoordinates}
    strokeColor="red"
    strokeWidth={3}
  />
  
  {/* Marker - Nokta işareti */}
  <Marker coordinate={point} />
  
  {/* Circle - Ölçüm */}
  <Circle
    center={center}
    radius={1000} // metre
    fillColor="rgba(255, 0, 0, 0.2)"
    strokeColor="red"
  />
</MapView>
```

## Sonuç

**Temel çizimler için react-native-maps YETERLİ:**

1. ✅ Parsel sınırları (Polygon)
2. ✅ Yol çizimleri (Polyline)
3. ✅ Elektrik hatları (Polyline)
4. ✅ Nokta işaretlemeleri (Marker)
5. ✅ Ölçüm araçları (Circle)

**Eğer 3D özelliklere ihtiyacınız varsa Mapbox SDK kullanmalısınız**, ancak bu durumda:
- Downloads token gerekir
- Daha karmaşık kurulum
- Daha fazla native kod

**Öneri**: Mobil uygulamada 2D çizimler yeterliyse react-native-maps kullanın. 3D özelliklere ihtiyacınız varsa Mapbox SDK'yı tercih edin.

