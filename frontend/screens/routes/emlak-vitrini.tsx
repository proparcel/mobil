import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import {
  getPortalLocations,
  getPublicListingCategories,
  type PublicListingCategoryNode,
} from '../../services/portalService';
import { getPublicVitrinListings } from '../../services/vitrinSearchService';
import { useRouter, type NavigationProp } from '../../src/hooks/useNavigation';
import { Alert } from 'react-native';

const COLORS = {
  headerBg: '#1e293b',
  /** Liste alanı — ana uygulama lacivert tonu */
  pageBg: '#0f172a',
  cardBg: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  accentBlue: '#3b82f6',
} as const;

type StepKey = 'category' | 'listingType' | 'city';

type CategoryChoice = {
  categoryMain?: string;
  categoryLeafId?: string;
  label: string;
};

type ListingTypeChoice = 'sale' | 'rent';

type CountRow = {
  id: string;
  label: string;
  count: number;
  depth?: number;
  onPress: () => void;
};

function formatCount(n: number | null | undefined) {
  return new Intl.NumberFormat('tr-TR').format(Number(n || 0));
}

function normalizeLocationRows(rows: Array<{ id?: number | string | null; name?: string | null; count?: number | null }> | undefined) {
  return (rows || [])
    .map((row) => {
      const id = Number(row?.id);
      if (!Number.isFinite(id)) return null;
      return {
        id,
        name: String(row?.name || '').trim() || `İl #${id}`,
        count: Number(row?.count || 0),
      };
    })
    .filter(Boolean) as Array<{ id: number; name: string; count: number }>;
}

function SelectionRow({ label, count, depth = 0, onPress }: { label: string; count: number; depth?: number; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.rowCard, depth > 0 && styles.rowCardChild, { paddingLeft: 16 + depth * 18 }]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <Text style={[styles.rowLabel, depth > 0 && styles.rowLabelChild]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.rowCount}>({formatCount(count)})</Text>
    </TouchableOpacity>
  );
}

function RootCategoryRow({
  label,
  count,
  expanded,
  onPress,
  onToggle,
}: {
  label: string;
  count: number;
  expanded: boolean;
  onPress: () => void;
  onToggle: () => void;
}) {
  return (
    <View style={styles.rootRowCard}>
      <TouchableOpacity style={styles.rootRowMain} onPress={onPress} activeOpacity={0.78}>
        <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.rowCount}>({formatCount(count)})</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.rootRowToggle}
        onPress={onToggle}
        activeOpacity={0.72}
        accessibilityLabel={expanded ? 'Daralt' : 'Genişlet'}
      >
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={COLORS.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
}

export default function EmlakVitriniScreen() {
  const router = useRouter();
  const navigation = useNavigation<NavigationProp>();
  const [step, setStep] = useState<StepKey>('category');
  const [selectedCategory, setSelectedCategory] = useState<CategoryChoice | null>(null);
  const [selectedListingType, setSelectedListingType] = useState<ListingTypeChoice | null>(null);
  const [expandedRoots, setExpandedRoots] = useState<Record<string, boolean>>({});

  const [rootNodes, setRootNodes] = useState<PublicListingCategoryNode[]>([]);
  const [childNodesByRoot, setChildNodesByRoot] = useState<Record<string, PublicListingCategoryNode[]>>({});
  const [cities, setCities] = useState<Array<{ id: number; name: string; count: number }>>([]);

  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingListingTypes, setLoadingListingTypes] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const [saleCount, setSaleCount] = useState(0);
  const [rentCount, setRentCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingCategories(true);
        const rootsRes = await getPublicListingCategories({ includeCounts: true });
        const roots = rootsRes.ok && rootsRes.data?.nodes ? rootsRes.data.nodes : [];
        if (cancelled) return;
        setRootNodes(roots);
        const pairs = await Promise.all(
          roots.map(async (root) => {
            const childRes = await getPublicListingCategories({ parentId: root.id, includeCounts: true });
            return [root.id, childRes.ok && childRes.data?.nodes ? childRes.data.nodes : []] as const;
          }),
        );
        if (cancelled) return;
        const next: Record<string, PublicListingCategoryNode[]> = {};
        pairs.forEach(([rootId, nodes]) => {
          next[rootId] = nodes;
        });
        setChildNodesByRoot(next);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step !== 'listingType' || !selectedCategory) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingListingTypes(true);
        const baseParams = {
          page: 1,
          page_size: 1,
          ...(selectedCategory.categoryMain ? { category_main: selectedCategory.categoryMain } : {}),
          ...(selectedCategory.categoryLeafId ? { category_leaf_id: selectedCategory.categoryLeafId } : {}),
        };
        const [saleRes, rentRes] = await Promise.all([
          getPublicVitrinListings({ ...baseParams, listing_type: 'sale' }),
          getPublicVitrinListings({ ...baseParams, listing_type: 'rent' }),
        ]);
        if (cancelled) return;
        setSaleCount(saleRes.ok ? saleRes.data?.pagination?.total_count ?? 0 : 0);
        setRentCount(rentRes.ok ? rentRes.data?.pagination?.total_count ?? 0 : 0);
      } finally {
        if (!cancelled) setLoadingListingTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, selectedCategory]);

  useEffect(() => {
    if (step !== 'city' || !selectedListingType) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingCities(true);
        const res = await getPortalLocations(undefined, undefined, {
          countsFor: 'listings',
          categoryMain: selectedCategory?.categoryMain,
          categoryLeafId: selectedCategory?.categoryLeafId,
          listingType: selectedListingType,
        });
        if (cancelled) return;
        setCities(res.ok ? normalizeLocationRows(res.data?.cities) : []);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, selectedCategory, selectedListingType]);

  const totalCategoryCount = useMemo(
    () => rootNodes.reduce((sum, node) => sum + Number(node.count || 0), 0),
    [rootNodes],
  );

  useEffect(() => {
    setExpandedRoots((prev) => {
      const next: Record<string, boolean> = {};
      rootNodes.forEach((root) => {
        next[root.id] = prev[root.id] ?? false;
      });
      return next;
    });
  }, [rootNodes]);

  const listingTypeRows = useMemo<CountRow[]>(() => ([
    {
      id: 'sale',
      label: 'Satılık',
      count: saleCount,
      onPress: () => {
        setSelectedListingType('sale');
        setStep('city');
      },
    },
    {
      id: 'rent',
      label: 'Kiralık',
      count: rentCount,
      onPress: () => {
        setSelectedListingType('rent');
        setStep('city');
      },
    },
  ]), [saleCount, rentCount]);

  const title = step === 'category'
    ? 'Emlak Vitrini'
    : step === 'listingType'
      ? (selectedCategory?.label || 'İşlem Türü')
      : 'İller';

  const subtitle = step === 'category'
    ? 'Önce kategori seçin'
    : step === 'listingType'
      ? 'Satılık veya kiralık seçin'
      : 'İl seçin';

  const handleBack = () => {
    if (step === 'city') {
      setStep('listingType');
      return;
    }
    if (step === 'listingType') {
      setSelectedListingType(null);
      setStep('category');
      return;
    }
    router.back();
  };

  const openListingPage = (cityId: number, cityName: string) => {
    const normalizedCityId = Number(cityId);
    if (!Number.isFinite(normalizedCityId)) {
      Alert.alert('Hata', 'Şehir seçimi sırasında hata oluştu.');
      return;
    }
    navigation.push('emlak-vitrini-liste', {
      ...(selectedCategory?.categoryMain ? { categoryMain: selectedCategory.categoryMain } : {}),
      ...(selectedCategory?.categoryMain ? { category_main: selectedCategory.categoryMain } : {}),
      ...(selectedCategory?.categoryLeafId ? { categoryLeafId: selectedCategory.categoryLeafId } : {}),
      ...(selectedCategory?.categoryLeafId ? { category_leaf_id: selectedCategory.categoryLeafId } : {}),
      ...(selectedCategory?.label ? { categoryLabel: selectedCategory.label } : {}),
      ...(selectedListingType ? { listingType: selectedListingType } : {}),
      ...(selectedListingType ? { listing_type: selectedListingType } : {}),
      cityId: String(normalizedCityId),
      city_id: String(normalizedCityId),
      cityName,
      city_name: cityName,
    });
  };

  const renderContent = () => {
    if (step === 'category') {
      if (loadingCategories) {
        return (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={COLORS.accentBlue} />
          </View>
        );
      }
      return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHint}>{subtitle}</Text>
          <SelectionRow
            label="Tüm Kategoriler"
            count={totalCategoryCount}
            onPress={() => {
              setSelectedCategory({ label: 'Tüm Kategoriler' });
              setStep('listingType');
            }}
          />
          {rootNodes.map((root) => (
            <View key={root.id} style={styles.rootGroup}>
              <RootCategoryRow
                label={root.label}
                count={Number(root.count || 0)}
                expanded={Boolean(expandedRoots[root.id])}
                onPress={() => {
                  setSelectedCategory({ categoryMain: root.id, label: root.label });
                  setStep('listingType');
                }}
                onToggle={() => {
                  setExpandedRoots((prev) => ({
                    ...prev,
                    [root.id]: !prev[root.id],
                  }));
                }}
              />
              {expandedRoots[root.id]
                ? (childNodesByRoot[root.id] || []).map((child) => (
                    <SelectionRow
                      key={child.id}
                      label={child.label}
                      count={Number(child.count || 0)}
                      depth={1}
                      onPress={() => {
                        setSelectedCategory({
                          categoryMain: root.id,
                          categoryLeafId: child.id,
                          label: child.label,
                        });
                        setStep('listingType');
                      }}
                    />
                  ))
                : null}
            </View>
          ))}
        </ScrollView>
      );
    }

    if (step === 'listingType') {
      if (loadingListingTypes) {
        return (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={COLORS.accentBlue} />
          </View>
        );
      }
      return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHint}>{selectedCategory?.label || 'Tüm Kategoriler'}</Text>
          {listingTypeRows.map((row) => (
            <SelectionRow key={row.id} label={row.label} count={row.count} onPress={row.onPress} />
          ))}
        </ScrollView>
      );
    }

    if (loadingCities) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.accentBlue} />
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHint}>
          {(selectedCategory?.label || 'Tüm Kategoriler')} / {selectedListingType === 'sale' ? 'Satılık' : 'Kiralık'}
        </Text>
        {cities.map((city) => (
          <SelectionRow
            key={String(city.id)}
            label={city.name}
            count={city.count}
            onPress={() => openListingPage(city.id, city.name)}
          />
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleBack} accessibilityLabel="Geri">
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.headerBtn} />
      </View>
      <View style={styles.body}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.headerBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.headerBg,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  body: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  sectionHint: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  rowCardChild: {
    minHeight: 48,
  },
  rootGroup: {
    gap: 8,
  },
  rootRowCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    overflow: 'hidden',
  },
  rootRowMain: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rootRowToggle: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: COLORS.borderSoft,
    backgroundColor: '#f8fafc',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  rowLabelChild: {
    fontSize: 14,
    fontWeight: '500',
  },
  rowCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accentBlue,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.pageBg,
  },
});
