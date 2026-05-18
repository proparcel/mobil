/**
 * Aranacaklar talep formu — tam il/ilçe/mahalle listesi (/api/cities, /api/towns, /api/quarters).
 * Not: /api/portal/locations yalnızca son 30 günde sorgu kaydı olan yerleri döndürür; bu ekranda kullanılmaz.
 * İlçe tek seçim; mahalle çoklu. Listeye ekleme sonrası «Yeni konum grubu» ile başka il/ilçe/mahalle eklenebilir.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  fetchGeoCities,
  fetchGeoQuartersByTown,
  fetchGeoTownsByCity,
  type GeoQuarterRow,
} from '../../services/portalService';
import type { PortalLocationItem } from '../../src/types/portal';
import { AranacaklarBottomSheetShell } from './AranacaklarBottomSheetShell';

const COLORS = {
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderSoft: '#e2e8f0',
  accentBlue: '#3b82f6',
  cardBg: '#ffffff',
  chipBg: '#f1f5f9',
} as const;

export type SavedQuarterItem = {
  quarterId: number;
  cityId: number;
  townId: number;
  cityName: string;
  townName: string;
  quarterName: string;
};

type FilterPickerItem = { value: number | null; label: string };

function uniqNums(v: unknown): number[] {
  const arr = Array.isArray(v) ? v : [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const x of arr) {
    const n = Number(x);
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function geoQuartersToPortalItems(rows: GeoQuarterRow[]): PortalLocationItem[] {
  return rows
    .map((q) => {
      const id = Number(q.Id ?? q.id);
      const name = String(q.Tkgm_text || q.Proparcel_text || '').trim() || `Mahalle #${id}`;
      return { id, name, count: 0 };
    })
    .filter((r) => Number.isFinite(r.id));
}

/** Son 30 gün sorgu listesi değil; tam PG coğrafya ile kayıtlı mahalleleri intent id’lerinden çözer */
export async function hydrateSavedQuartersFromIntent(
  intent: Record<string, unknown> | null | undefined,
): Promise<SavedQuarterItem[]> {
  if (!intent) return [];
  const neighborhoodIds = new Set(uniqNums(intent.neighborhood_ids));
  if (neighborhoodIds.size === 0) return [];

  const cityIdsFilter = uniqNums(intent.city_ids);
  const districtIdsFilter = new Set(uniqNums(intent.district_ids));

  const citiesRes = await fetchGeoCities();
  const geoCities = citiesRes.ok && Array.isArray(citiesRes.data) ? citiesRes.data : [];
  const cityNameById = new Map(
    geoCities.map((c) => [Number(c.Id), String(c.Proparcel_text || '').trim() || `İl #${c.Id}`]),
  );

  const remaining = new Set(neighborhoodIds);
  const results: SavedQuarterItem[] = [];

  const citiesToScan =
    cityIdsFilter.length > 0
      ? cityIdsFilter.filter((id) => geoCities.some((c) => Number(c.Id) === id))
      : geoCities.map((c) => Number(c.Id));

  for (const cityId of citiesToScan) {
    if (remaining.size === 0) break;
    const townsRes = await fetchGeoTownsByCity(cityId);
    const towns = townsRes.ok && townsRes.data ? townsRes.data : [];
    const townsToScan =
      districtIdsFilter.size > 0 ? towns.filter((t) => districtIdsFilter.has(Number(t.Id))) : towns;
    for (const town of townsToScan) {
      if (remaining.size === 0) break;
      const qRes = await fetchGeoQuartersByTown(Number(town.Id));
      const raw = qRes.ok && Array.isArray(qRes.data) ? qRes.data : [];
      const qList = geoQuartersToPortalItems(raw);
      for (const q of qList) {
        if (remaining.has(q.id)) {
          results.push({
            quarterId: q.id,
            cityId,
            townId: Number(town.Id),
            cityName: cityNameById.get(cityId) || `İl #${cityId}`,
            townName: String(town.Proparcel_text || '').trim() || `İlçe #${town.Id}`,
            quarterName: q.name,
          });
          remaining.delete(q.id);
        }
      }
    }
  }

  for (const qid of remaining) {
    results.push({
      quarterId: qid,
      cityId: 0,
      townId: 0,
      cityName: '',
      townName: '',
      quarterName: `Mahalle #${qid}`,
    });
  }
  return results;
}

function SinglePickerRow({
  label,
  items,
  selectedValue,
  onSelect,
  loading,
  disabled,
}: {
  label: string;
  items: FilterPickerItem[];
  selectedValue: number | null;
  onSelect: (v: number | null) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === selectedValue);

  return (
    <View style={styles.pickerContainer}>
      {label ? <Text style={styles.pickerLabel}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.pickerButton, disabled && styles.pickerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.accentBlue} />
        ) : (
          <>
            <Text style={[styles.pickerButtonText, !selected && styles.pickerPlaceholder]} numberOfLines={1}>
              {selected ? selected.label : 'Seçin…'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
          </>
        )}
      </TouchableOpacity>

      <AranacaklarBottomSheetShell visible={open} onClose={() => setOpen(false)} title={label}>
        {items.map((item, idx) => {
          const isActive = selectedValue === item.value;
          return (
            <TouchableOpacity
              key={item.value != null ? String(item.value) : `opt-${idx}`}
              style={[styles.modalItem, isActive && styles.modalItemActive]}
              onPress={() => {
                onSelect(item.value);
                setOpen(false);
              }}
            >
              <Text style={[styles.modalItemText, isActive && styles.modalItemTextActive]}>{item.label}</Text>
              {isActive ? <Ionicons name="checkmark" size={18} color={COLORS.accentBlue} /> : null}
            </TouchableOpacity>
          );
        })}
      </AranacaklarBottomSheetShell>
    </View>
  );
}

function MultiPickerRow({
  label,
  items,
  selectedIds,
  onToggle,
  loading,
  disabled,
  searchable = false,
}: {
  label: string;
  items: FilterPickerItem[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  loading?: boolean;
  disabled?: boolean;
  /** Mahalle: Select2 benzeri arama + çoklu seçim */
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const count = selectedIds.size;
  const summary =
    count === 0
      ? searchable
        ? 'Mahalle seçin veya arayın…'
        : 'Seçin…'
      : searchable
        ? `${count} mahalle seçili`
        : `${count} seçili`;

  const filteredItems = useMemo(() => {
    const t = q.trim().toLocaleLowerCase('tr-TR');
    if (!searchable || !t) return items;
    return items.filter(
      (x) =>
        x.value != null &&
        String(x.label ?? '')
          .toLocaleLowerCase('tr-TR')
          .includes(t),
    );
  }, [items, q, searchable]);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  return (
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.pickerButton, disabled && styles.pickerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.accentBlue} />
        ) : (
          <>
            <Text style={[styles.pickerButtonText, count === 0 && styles.pickerPlaceholder]} numberOfLines={1}>
              {summary}
            </Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
          </>
        )}
      </TouchableOpacity>

      <AranacaklarBottomSheetShell
        visible={open}
        onClose={() => setOpen(false)}
        title={searchable ? 'Mahalle (Select2)' : label}
        headerExtra={
          searchable ? (
            <TextInput
              style={styles.mahalleSearchInp}
              placeholder="Mahalle ara…"
              placeholderTextColor={COLORS.textSecondary}
              value={q}
              onChangeText={setQ}
              autoCorrect={false}
              autoCapitalize="none"
            />
          ) : undefined
        }
      >
        <Text style={styles.multiHint}>
          {searchable
            ? 'Arayarak daraltın; çoklu seçim için satıra dokunun.'
            : 'Birden fazla seçmek için satırlara dokunun.'}
        </Text>
        {filteredItems.map((item, idx) => {
          if (item.value == null) return null;
          const id = item.value;
          const isOn = selectedIds.has(id);
          return (
            <TouchableOpacity
              key={String(id) + idx}
              style={[styles.modalItem, isOn && styles.modalItemActive]}
              onPress={() => onToggle(id)}
            >
              <Text style={[styles.modalItemText, isOn && styles.modalItemTextActive]}>{item.label}</Text>
              <Ionicons
                name={isOn ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={isOn ? COLORS.accentBlue : COLORS.textSecondary}
              />
            </TouchableOpacity>
          );
        })}
        {searchable && filteredItems.length === 0 ? (
          <Text style={styles.emptySearch}>Sonuç yok</Text>
        ) : null}
        <TouchableOpacity style={styles.doneBtn} onPress={() => setOpen(false)} activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>Tamam</Text>
        </TouchableOpacity>
      </AranacaklarBottomSheetShell>
    </View>
  );
}

export function AranacaklarIntentLocationSection({
  savedQuarters,
  onSavedQuartersChange,
}: {
  savedQuarters: SavedQuarterItem[];
  onSavedQuartersChange: (next: SavedQuarterItem[]) => void;
}) {
  const [cities, setCities] = useState<PortalLocationItem[]>([]);
  const [towns, setTowns] = useState<PortalLocationItem[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [townsLoading, setTownsLoading] = useState(false);
  const [quartersLoading, setQuartersLoading] = useState(false);

  const [draftCity, setDraftCity] = useState<number | null>(null);
  /** Tek ilçe (Select2 / bottom sheet ile aynı hiyerarşi) */
  const [draftTown, setDraftTown] = useState<number | null>(null);
  const [selectedQuarterIds, setSelectedQuarterIds] = useState<Set<number>>(() => new Set());

  const [quarterRows, setQuarterRows] = useState<PortalLocationItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCitiesLoading(true);
      const res = await fetchGeoCities();
      if (!cancelled && res.ok && Array.isArray(res.data)) {
        const mapped: PortalLocationItem[] = res.data
          .map((c) => ({
            id: Number(c.Id),
            name: String(c.Proparcel_text || '').trim() || `İl #${c.Id}`,
            count: 0,
          }))
          .filter((c) => Number.isFinite(c.id))
          .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
        setCities(mapped);
      }
      if (!cancelled) setCitiesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setTowns([]);
    setDraftTown(null);
    setSelectedQuarterIds(new Set());
    setQuarterRows([]);
    if (draftCity == null) return;
    let cancelled = false;
    (async () => {
      setTownsLoading(true);
      const res = await fetchGeoTownsByCity(draftCity);
      if (!cancelled && res.ok && res.data) {
        const mapped: PortalLocationItem[] = res.data
          .map((t) => ({
            id: Number(t.Id),
            name: String(t.Proparcel_text || '').trim() || `İlçe #${t.Id}`,
            count: 0,
          }))
          .filter((t) => Number.isFinite(t.id))
          .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
        setTowns(mapped);
      }
      if (!cancelled) setTownsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [draftCity]);

  useEffect(() => {
    setSelectedQuarterIds(new Set());
    setQuarterRows([]);
    if (draftCity == null || draftTown == null) {
      setQuartersLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setQuartersLoading(true);
      const res = await fetchGeoQuartersByTown(draftTown);
      if (cancelled) return;
      const raw = res.ok && Array.isArray(res.data) ? res.data : [];
      const flat = geoQuartersToPortalItems(raw).sort((a, b) =>
        String(a.name ?? '').localeCompare(String(b.name ?? ''), 'tr'),
      );
      setQuarterRows(flat);
    })()
      .finally(() => {
        if (!cancelled) setQuartersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draftCity, draftTown]);

  const cityItems: FilterPickerItem[] = useMemo(
    () => [{ value: null, label: '— İl seçin —' }, ...cities.map((c) => ({ value: c.id, label: c.name }))],
    [cities],
  );

  const townItems: FilterPickerItem[] = useMemo(
    () => [{ value: null, label: '— İlçe seçin —' }, ...towns.map((t) => ({ value: t.id, label: t.name }))],
    [towns],
  );

  const quarterItems: FilterPickerItem[] = useMemo(
    () => quarterRows.map((q) => ({ value: q.id, label: q.name })),
    [quarterRows],
  );

  const toggleQuarter = useCallback((id: number) => {
    setSelectedQuarterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addSelectionToSaved = useCallback(() => {
    if (draftCity == null || draftTown == null || selectedQuarterIds.size === 0) return;
    const city = cities.find((c) => c.id === draftCity);
    const cityName = city?.name ?? `İl #${draftCity}`;
    const town = towns.find((t) => t.id === draftTown);
    const next = [...savedQuarters];
    const existingQ = new Set(next.map((s) => s.quarterId));
    for (const qid of selectedQuarterIds) {
      if (existingQ.has(qid)) continue;
      const q = quarterRows.find((r) => r.id === qid);
      if (!q) continue;
      next.push({
        quarterId: qid,
        cityId: draftCity,
        townId: draftTown,
        cityName,
        townName: town?.name ?? `İlçe #${draftTown}`,
        quarterName: q.name,
      });
      existingQ.add(qid);
    }
    onSavedQuartersChange(next);
    setSelectedQuarterIds(new Set());
  }, [draftCity, draftTown, selectedQuarterIds, savedQuarters, cities, quarterRows, towns, onSavedQuartersChange]);

  const resetDraftLocationGroup = useCallback(() => {
    setDraftCity(null);
    setDraftTown(null);
    setSelectedQuarterIds(new Set());
    setQuarterRows([]);
    setTowns([]);
  }, []);

  const removeSaved = useCallback(
    (quarterId: number) => {
      onSavedQuartersChange(savedQuarters.filter((s) => s.quarterId !== quarterId));
    },
    [savedQuarters, onSavedQuartersChange],
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Konum</Text>
      <Text style={styles.sectionHint}>
        Tüm iller ve seçime göre ilçe/mahalle listesi (veritabanı). İlçe tek; mahalle birden fazla seçilebilir.
      </Text>

      <SinglePickerRow
        label="İl"
        items={cityItems}
        selectedValue={draftCity}
        onSelect={(v) => setDraftCity(v)}
        loading={citiesLoading}
        disabled={false}
      />

      <SinglePickerRow
        label="İlçe"
        items={townItems}
        selectedValue={draftTown}
        onSelect={(v) => setDraftTown(v)}
        loading={townsLoading}
        disabled={!draftCity}
      />

      <MultiPickerRow
        label="Mahalle (Select2 — çoklu)"
        items={quarterItems}
        selectedIds={selectedQuarterIds}
        onToggle={toggleQuarter}
        loading={quartersLoading}
        disabled={!draftCity || draftTown == null}
        searchable
      />

      <TouchableOpacity
        style={[
          styles.addBtn,
          (selectedQuarterIds.size === 0 || draftCity == null || draftTown == null) && styles.addBtnDisabled,
        ]}
        onPress={addSelectionToSaved}
        disabled={selectedQuarterIds.size === 0 || draftCity == null || draftTown == null}
        activeOpacity={0.85}
      >
        <Text style={styles.addBtnText}>Seçilen mahalleleri listeye ekle</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.resetDraftBtn} onPress={resetDraftLocationGroup} activeOpacity={0.85}>
        <Text style={styles.resetDraftBtnText}>Yeni konum grubu (il / ilçe / mahalle)</Text>
      </TouchableOpacity>

      <Text style={styles.savedTitle}>Kayıtlı mahalleler</Text>
      {savedQuarters.length === 0 ? (
        <Text style={styles.emptySaved}>Henüz mahalle eklenmedi. Yukarıdan seçip listeye ekleyin.</Text>
      ) : (
        savedQuarters.map((s) => (
          <View key={String(s.quarterId)} style={styles.savedRow}>
            <View style={styles.savedTextWrap}>
              <Text style={styles.savedLine} numberOfLines={2}>
                {s.cityName ? `${s.cityName} · ` : ''}
                {s.townName ? `${s.townName} · ` : ''}
                {s.quarterName}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeSaved(s.quarterId)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={22} color="#b91c1c" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

export function intentPayloadFromSavedQuarters(saved: SavedQuarterItem[]) {
  const cityIds = [...new Set(saved.map((s) => s.cityId).filter((id) => id > 0))];
  const districtIds = [...new Set(saved.map((s) => s.townId).filter((id) => id > 0))];
  const neighborhoodIds = [...new Set(saved.map((s) => s.quarterId))];
  return { city_ids: cityIds, district_ids: districtIds, neighborhood_ids: neighborhoodIds };
}

const styles = StyleSheet.create({
  section: { marginTop: 4, gap: 10 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  sectionHint: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16, marginBottom: 4 },
  pickerContainer: { marginBottom: 4 },
  pickerLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  pickerDisabled: { opacity: 0.45 },
  pickerButtonText: { fontSize: 14, color: COLORS.textPrimary, flex: 1, marginRight: 4 },
  pickerPlaceholder: { color: COLORS.textSecondary },
  multiHint: { fontSize: 12, color: COLORS.textSecondary, paddingHorizontal: 16, paddingBottom: 10 },
  mahalleSearchInp: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: '#f8fafc',
  },
  emptySearch: { padding: 16, textAlign: 'center', color: COLORS.textSecondary, fontSize: 14 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.borderSoft,
  },
  modalItemActive: { backgroundColor: '#eff6ff' },
  modalItemText: { fontSize: 14, color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  modalItemTextActive: { color: COLORS.accentBlue, fontWeight: '600' },
  doneBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: COLORS.accentBlue,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  addBtn: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnDisabled: { opacity: 0.45 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  resetDraftBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
  },
  resetDraftBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 13 },
  savedTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginTop: 8 },
  emptySaved: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic' },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.chipBg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  savedTextWrap: { flex: 1, minWidth: 0 },
  savedLine: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
});
