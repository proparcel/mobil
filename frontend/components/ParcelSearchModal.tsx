import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBottomSheetModal from './app/AppBottomSheetModal';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { launchImageLibrary } from 'react-native-image-picker';
import AdaParselForm from './AdaParselForm';
import locationsJson from '../src/data/locations.json';
import {
  extractSmartQueryFromImage,
  extractSmartQueryFromText,
  type SmartQueryExtractResponse,
} from '../services/smartQueryService';
import type { LocationHierarchySelection } from '../src/utils/locationHierarchyMap';

type TabKey = 'parcel' | 'smart';

type ParcelSubmitPayload = {
  mahalleTkgmValue: number;
  mahalle: string;
  ada: string;
  parsel: string;
  proparcelValue?: number;
  city?: string;
  town?: string;
};

type Quarter = {
  Id: number;
  Tkgm_text?: string;
  Tkgm_value: number;
  Proparcel_text: string;
  Proparcel_value?: number | string;
  Inactive?: boolean;
};

type Town = {
  Id: number;
  Proparcel_text: string;
  Quarters: Quarter[];
};

type City = {
  Id: number;
  Proparcel_text: string;
  Towns: Town[];
};

type LocationsResponse = {
  cities: City[];
};

const LOCATIONS = locationsJson as unknown as LocationsResponse;

const normalizeTr = (value: string): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\bmahallesi\b/g, '')
    .replace(/\bmahalle\b/g, '')
    .replace(/\bkoyu\b/g, '')
    .replace(/\bkoy\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const matchesLocationName = (candidate: string, target?: string): boolean => {
  const left = normalizeTr(candidate);
  const right = normalizeTr(target || '');
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
};

const buildSmartSummary = (
  result: SmartQueryExtractResponse,
  city?: City,
  town?: Town,
  quarter?: Quarter
): string => {
  const parts = [
    city?.Proparcel_text || result.il || '',
    town?.Proparcel_text || result.ilce || '',
    quarter?.Proparcel_text || quarter?.Tkgm_text || result.mahalle || '',
  ].filter(Boolean);

  const adaParsel = [result.ada_no, result.parsel_no].filter(Boolean).join('/');
  return [parts.join(' / '), adaParsel].filter(Boolean).join(' - ');
};

const resolveSmartQueryPayload = (
  result: SmartQueryExtractResponse
): { ok: true; payload: ParcelSubmitPayload; summary: string } | { ok: false; error: string } => {
  const ada = String(result.ada_no || '').trim();
  const parsel = String(result.parsel_no || '').trim();

  if (!ada || !parsel) {
    return { ok: false, error: 'Metinden ada ve parsel bilgisi çıkarılamadı.' };
  }

  const cities = LOCATIONS.cities || [];
  let city: City | undefined = result.city_id != null
    ? cities.find((item) => Number(item.Id) === Number(result.city_id))
    : undefined;

  if (!city && result.il) {
    city = cities.find((item) => matchesLocationName(item.Proparcel_text, result.il));
  }

  let town: Town | undefined = city && result.town_id != null
    ? city.Towns.find((item) => Number(item.Id) === Number(result.town_id))
    : undefined;

  if (!town && city && result.ilce) {
    town = city.Towns.find((item) => matchesLocationName(item.Proparcel_text, result.ilce));
  }

  if ((!city || !town) && (result.town_id != null || result.ilce)) {
    for (const cityItem of cities) {
      const candidateTown = result.town_id != null
        ? cityItem.Towns.find((item) => Number(item.Id) === Number(result.town_id))
        : cityItem.Towns.find((item) => matchesLocationName(item.Proparcel_text, result.ilce));
      if (candidateTown) {
        city = cityItem;
        town = candidateTown;
        break;
      }
    }
  }

  let quarter: Quarter | undefined = town && result.quarter_id != null
    ? (town.Quarters || []).filter((item) => !item?.Inactive).find((item) => Number(item.Id) === Number(result.quarter_id))
    : undefined;

  if (!quarter && town && result.mahalle) {
    quarter = (town.Quarters || [])
      .filter((item) => !item?.Inactive)
      .find((item) => matchesLocationName(item.Tkgm_text || item.Proparcel_text, result.mahalle) || matchesLocationName(item.Proparcel_text, result.mahalle));
  }

  if ((!quarter || !town || !city) && (result.quarter_id != null || result.mahalle)) {
    for (const cityItem of cities) {
      for (const townItem of cityItem.Towns || []) {
        const candidateQuarter = (townItem.Quarters || [])
          .filter((item) => !item?.Inactive)
          .find((item) => {
            if (result.quarter_id != null && Number(item.Id) === Number(result.quarter_id)) {
              return true;
            }
            if (!result.mahalle) {
              return false;
            }
            return matchesLocationName(item.Tkgm_text || item.Proparcel_text, result.mahalle)
              || matchesLocationName(item.Proparcel_text, result.mahalle);
          });
        if (candidateQuarter) {
          city = cityItem;
          town = townItem;
          quarter = candidateQuarter;
          break;
        }
      }
      if (quarter) break;
    }
  }

  if (!quarter || !town || !city) {
    return {
      ok: false,
      error: 'Akıllı sorgu alanları bulundu ama mobil lokasyon listesinde eşleşen il/ilçe/mahalle bulunamadı.',
    };
  }

  const payload: ParcelSubmitPayload = {
    mahalleTkgmValue: Number(quarter.Tkgm_value),
    mahalle: quarter.Proparcel_text || quarter.Tkgm_text || String(result.mahalle || '').trim(),
    ada,
    parsel,
    city: city.Proparcel_text || String(result.il || '').trim(),
    town: town.Proparcel_text || String(result.ilce || '').trim(),
  };

  const proparcelValue = Number(quarter.Proparcel_value);
  if (Number.isFinite(proparcelValue)) {
    payload.proparcelValue = proparcelValue;
  }

  return {
    ok: true,
    payload,
    summary: buildSmartSummary(result, city, town, quarter),
  };
};

interface ParcelSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (payload: ParcelSubmitPayload) => void | Promise<void>;
  onHierarchySelect?: (selection: LocationHierarchySelection) => void;
}

export default function ParcelSearchModal({
  visible,
  onClose,
  onSubmit,
  onHierarchySelect,
}: ParcelSearchModalProps) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('parcel');
  const [smartText, setSmartText] = useState('');
  const [smartResultSummary, setSmartResultSummary] = useState<string | null>(null);
  const [isSmartLoading, setIsSmartLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    base64: string;
    fileName: string;
  } | null>(null);

  const containerStyle = useMemo(
    () => [styles.sheet, { paddingBottom: insets?.bottom || 0 }],
    [insets?.bottom]
  );

  const submitResolvedSmartQuery = useCallback(async (result: SmartQueryExtractResponse) => {
    if (!result.ok) {
      Alert.alert('Akıllı Sorgu', result.error || 'Sorgu metni çözümlenemedi.');
      return;
    }

    const resolved = resolveSmartQueryPayload(result);
    if (!resolved.ok) {
      Alert.alert('Akıllı Sorgu', resolved.error);
      return;
    }

    setSmartResultSummary(resolved.summary);

    if (onSubmit) {
      await Promise.resolve(onSubmit(resolved.payload));
    }
  }, [onSubmit]);

  const handleTextSmartQuery = useCallback(async () => {
    const text = smartText.trim();
    if (!text) {
      Alert.alert('Akıllı Sorgu', 'Lütfen ilan metni veya parsel bilgisini girin.');
      return;
    }

    setIsSmartLoading(true);
    setSmartResultSummary(null);

    try {
      const response = await extractSmartQueryFromText(text);
      if (!response.ok) {
        Alert.alert('Akıllı Sorgu', response.error || 'Metin çözümlenirken bir hata oluştu.');
        return;
      }

      await submitResolvedSmartQuery(response.data);
    } catch (error: any) {
      Alert.alert('Akıllı Sorgu', error?.message || 'Akıllı sorgu başlatılamadı.');
    } finally {
      setIsSmartLoading(false);
    }
  }, [smartText, submitResolvedSmartQuery]);

  const handlePickImage = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.8,
        includeBase64: true,
      });

      if (result.didCancel) return;

      if (result.errorCode) {
        Alert.alert('Akıllı Sorgu', result.errorMessage || 'Gorsel secilemedi.');
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Alert.alert('Akıllı Sorgu', 'Secilen gorselden veri okunamadi.');
        return;
      }

      setSelectedImage({
        base64: asset.base64,
        fileName: asset.fileName || 'secilen-gorsel',
      });
      setSmartResultSummary(null);
    } catch (error: any) {
      Alert.alert('Akıllı Sorgu', error?.message || 'Gorsel secilemedi.');
    }
  }, []);

  const handleImageSmartQuery = useCallback(async () => {
    if (!selectedImage?.base64) {
      Alert.alert('Akıllı Sorgu', 'Lutfen once bir gorsel secin.');
      return;
    }

    setIsSmartLoading(true);
    setSmartResultSummary(null);

    try {
      const response = await extractSmartQueryFromImage(selectedImage.base64);
      if (!response.ok) {
        Alert.alert('Akıllı Sorgu', response.error || 'Gorsel islenirken bir hata olustu.');
        return;
      }

      await submitResolvedSmartQuery(response.data);
    } catch (error: any) {
      Alert.alert('Akıllı Sorgu', error?.message || 'Gorsel sorgusu baslatilamadi.');
    } finally {
      setIsSmartLoading(false);
    }
  }, [selectedImage, submitResolvedSmartQuery]);

  if (!visible) return null;

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={['86%']}
      initialIndex={0}
      variant="dark"
      keyboardForm
    >
      <View style={containerStyle as any}>
        <View style={styles.headerRow}>
          <View style={styles.tabs}>
            <TouchableOpacity
              onPress={() => setTab('parcel')}
              style={[styles.tabBtn, tab === 'parcel' && styles.tabBtnActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, tab === 'parcel' && styles.tabTextActive]}>Parsel Sorgu</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTab('smart')}
              style={[styles.tabBtn, tab === 'smart' && styles.tabBtnActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, tab === 'smart' && styles.tabTextActive]}>Akıllı Sorgu</Text>
            </TouchableOpacity>
          </View>
        </View>

        <BottomSheetScrollView style={styles.body} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
          {tab === 'parcel' ? (
            <AdaParselForm
              onClose={onClose}
              onSubmit={onSubmit}
              variant="dark"
              inBottomSheet
              onHierarchySelect={onHierarchySelect}
            />
          ) : (
            <View style={styles.smartContainer}>
              <View style={styles.smartCard}>
                <View style={styles.smartHeader}>
                  <Ionicons name="sparkles" size={18} color="#60a5fa" />
                  <Text style={styles.smartTitle}>Metinden Akıllı Sorgu</Text>
                </View>
                <Text style={styles.smartDescription}>
                  Webdeki akilli sorgu mantigi gibi ilan metninden il, ilce, mahalle, ada ve parsel bilgilerini cikarip sorguyu otomatik baslatir.
                </Text>
                <TextInput
                  multiline
                  value={smartText}
                  onChangeText={setSmartText}
                  editable={!isSmartLoading}
                  placeholder="Ornek: Ankara Golbasi Karagedik Mahallesi 123 ada 4 parsel"
                  placeholderTextColor="#64748b"
                  style={styles.smartTextInput}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  onPress={handleTextSmartQuery}
                  disabled={isSmartLoading}
                  style={[styles.smartActionButton, isSmartLoading && styles.smartActionButtonDisabled]}
                  activeOpacity={0.9}
                >
                  {isSmartLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="search" size={18} color="#fff" />
                  )}
                  <Text style={styles.smartActionButtonText}>Metinden Sorgula</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.smartDivider} />

              <View style={styles.smartCard}>
                <View style={styles.smartHeader}>
                  <Ionicons name="image-outline" size={18} color="#60a5fa" />
                  <Text style={styles.smartTitle}>Resimden Akıllı Sorgu</Text>
                </View>
                <Text style={styles.smartDescription}>
                  Tapu veya ekran goruntusundeki bilgileri OCR ile okuyup ayni sorgu akisini calistirir.
                </Text>

                <TouchableOpacity
                  onPress={handlePickImage}
                  disabled={isSmartLoading}
                  style={styles.imagePickerButton}
                  activeOpacity={0.85}
                >
                  <Ionicons name="images-outline" size={18} color="#cbd5e1" />
                  <Text style={styles.imagePickerButtonText}>
                    {selectedImage?.fileName || 'Gorsel sec'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleImageSmartQuery}
                  disabled={isSmartLoading}
                  style={[styles.smartActionButton, isSmartLoading && styles.smartActionButtonDisabled]}
                  activeOpacity={0.9}
                >
                  {isSmartLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="scan-outline" size={18} color="#fff" />
                  )}
                  <Text style={styles.smartActionButtonText}>Resimden Sorgula</Text>
                </TouchableOpacity>
              </View>

              {smartResultSummary ? (
                <View style={styles.smartInfoBox}>
                  <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                  <View style={styles.smartInfoTextWrap}>
                    <Text style={styles.smartInfoTitle}>Akilli sorgu alanlari bulundu</Text>
                    <Text style={styles.smartInfoText}>{smartResultSummary}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </BottomSheetScrollView>
      </View>
    </AppBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    flex: 1,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tabs: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#334155',
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.55)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#fff',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
  },
  body: {
    flex: 1,
  },
  smartContainer: {
    padding: 16,
    gap: 16,
  },
  smartCard: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  smartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  smartDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
  },
  smartTextInput: {
    minHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
    color: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  smartActionButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  smartActionButtonDisabled: {
    opacity: 0.7,
  },
  smartActionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  imagePickerButton: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imagePickerButtonText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  smartDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginHorizontal: 4,
  },
  smartInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    borderRadius: 12,
    padding: 12,
  },
  smartInfoTextWrap: {
    flex: 1,
    gap: 2,
  },
  smartInfoTitle: {
    color: '#dcfce7',
    fontSize: 13,
    fontWeight: '800',
  },
  smartInfoText: {
    color: '#bbf7d0',
    fontSize: 13,
    lineHeight: 18,
  },
});

