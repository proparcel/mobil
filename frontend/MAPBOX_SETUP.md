# Mapbox Kurulum Talimatları

## Mapbox Downloads Token Alma

Mapbox Android SDK'sını kullanmak için bir **Downloads Token** almanız gerekiyor.

### Adımlar:

1. Mapbox hesabına giriş yapın: https://account.mapbox.com/

2. Access Tokens sayfasına gidin: https://account.mapbox.com/access-tokens/

3. **Downloads token** oluşturun:
   - "Create a token" butonuna tıklayın
   - Token türü olarak "Downloads token" seçin
   - Token'a bir isim verin (örn: "Android Downloads Token")
   - Gerekli izinleri verin ve token'ı oluşturun

4. Token'ı `android/gradle.properties` dosyasına ekleyin:

```properties
MAPBOX_DOWNLOADS_TOKEN=sk.your_downloads_token_here
```

5. Token'ı ekledikten sonra projeyi yeniden build edin:

```bash
npx expo prebuild --clean
npx expo run:android
```

## Alternatif: Mapbox Access Token (Harita Görüntüleme İçin)

Haritayı görüntülemek için ayrı bir **Public Access Token** da gerekir. Bu token'ı `config/mapbox.ts` dosyasına eklemeniz gerekir:

```typescript
export const MAPBOX_ACCESS_TOKEN = 'pk.your_public_token_here';
```

**Not:** Downloads token ve Public access token farklıdır:
- **Downloads Token (sk.)**: SDK'yı indirmek için gerekli (gradle.properties)
- **Public Token (pk.)**: Haritayı görüntülemek için gerekli (config/mapbox.ts)

Her ikisini de Mapbox hesabınızdan alabilirsiniz.

