# Mobil: customer_type özellik kapıları (Akıllı Sorgu)

Backend uygulandı (2026-06-03). Üyelik migrasyonu (2026-06-04): `role` kaldırıldı; `customer_type` + `member_type` kullanın. Yerel mobil repoda aşağıdaki değişiklikleri yapın.

## Kural

| `customer_type` | Akıllı Sorgu sekmesi + sesli komut |
|-----------------|-------------------------------------|
| `basic` | Görünür, **pasif** (upgrade mesajı) |
| `business`, `silver`, `gold`, `vip`, `vip_limited` | Tam erişim |

Kaynak: `GET /api/profile/read/` → `data.features.smart_query` (boolean).

403 yanıtı (basic API denemesi):

```json
{
  "error": "feature_locked",
  "feature": "smart_query",
  "message": "Bu özellik abonelik paketine dahildir."
}
```

## Güncellenecek dosyalar (yerel repo)

Yol öneki: `frontend/` (Expo projesi).

### 1. Auth / profil tipi

**Dosya:** `src/types/auth.ts` (veya eşdeğer)

```typescript
export type CustomerFeatureFlags = {
  smart_query: boolean;
  street_view: boolean;
  portal_share_pdf: boolean;
  portal_share_link: boolean;
};

// User veya profile read modeline ekleyin:
features?: CustomerFeatureFlags;
customer_type?: string;
```

### 2. Profile read parse

**Dosya:** `services/authService.ts` veya `services/portalService.ts`

Login sonrası ve uygulama açılışında `GET /api/profile/read/` yanıtından:

```typescript
const features = response.data?.features;
// AsyncStorage / context'e kaydedin
```

### 3. Ada Parsel Form — Akıllı Sorgu sekmesi

**Dosya:** `app/components/AdaParselForm.tsx` (veya `screens/...` eşdeğeri)

- `activeTab === 'akilli'` sekmesi **gizlenmesin**.
- `features?.smart_query !== true` ise:
  - Sekme stili: `opacity: 0.5`
  - `disabled` / tıklamada Alert veya bottom sheet: *"Bu özellik abonelik paketine dahildir"*
  - `/accounts/pricing/` deep link veya webview
- Mikrofon / ses kaydı başlamadan önce aynı kontrol (`speech_query_extract` backend zaten 403 döner).

Örnek yardımcı:

```typescript
function canUseSmartQuery(user: User | null): boolean {
  if (!user) return false;
  if (user.features?.smart_query === true) return true;
  const ct = (user.customer_type || 'basic').toLowerCase();
  return ['business', 'silver', 'gold', 'vip', 'vip_limited'].includes(ct);
}
```

### 4. API hata yakalama

**Dosya:** `services/smartQueryService.ts` (veya ada parsel API katmanı)

`POST /api/speech_query_extract/`, `/api/text_query_extract/`, `/api/image_query_extract/` çağrılarında:

- HTTP 403 + `error === 'feature_locked'` → kullanıcıya paket mesajı, teknik hata gösterme.

## Test (yerel)

1. `basic` hesapla giriş → Akıllı Sorgu sekmesi pasif, API 403.
2. `business` (veya `silver`) hesapla giriş → sekme aktif, API 200.

## Web tarafı (referans — bu repoda uygulandı)

- `accounts/services/customer_type_entitlements.py`
- `myapp/static/js/app/ui/feature_gate.js`
- Sokak görüntüsü + portal PDF yalnızca web; mobilde **yalnız Akıllı Sorgu** güncellenir.

## İlgili backend doküman

`docs/changes/2026-06-03-customer-type-business-feature-gates-plan.md`
