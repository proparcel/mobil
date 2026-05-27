import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { companyService } from '../../services/companyService';
import type {
  CompanyCreditAllocationItem,
  CompanyCreditAllocationsData,
  ProfileSubUser,
} from '../../src/types/auth';

type MemberRow = {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  allocation: CompanyCreditAllocationItem | null;
};

function subUserId(sub: ProfileSubUser): number | null {
  const id = sub.user?.id;
  return id != null && Number.isFinite(Number(id)) ? Number(id) : null;
}

function subUserEmail(sub: ProfileSubUser): string {
  return String(sub.user?.email || sub.email || '').trim();
}

type Props = {
  subUsers: ProfileSubUser[];
  onRemoveMember: (userId: number) => void;
  onAllocationsChanged?: () => void;
};

export default function ProfileCompanySubUsersSection({
  subUsers,
  onRemoveMember,
  onAllocationsChanged,
}: Props) {
  const [allocations, setAllocations] = useState<CompanyCreditAllocationsData>({
    items: [],
    company_balance: 0,
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});

  const loadAllocations = useCallback(async () => {
    if (__DEV__) {
      console.log('[ProfileCompanySubUsers] loadAllocations', {
        subUsersCount: subUsers.length,
      });
    }
    setLoading(true);
    setLoadError(null);
    const res = await companyService.getCompanyCreditAllocations();
    if (res.success && res.data) {
      setAllocations(res.data);
      setLoadError(null);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const item of res.data!.items) {
          const key = String(item.consultant_user_id);
          if (!Object.prototype.hasOwnProperty.call(next, key)) {
            next[key] = String(item.monthly_limit ?? 0);
          }
        }
        return next;
      });
    } else {
      setLoadError(res.message || 'Kredi payları yüklenemedi.');
      setAllocations({ items: [], company_balance: 0 });
      setDrafts((prev) => {
        const next = { ...prev };
        for (const sub of subUsers) {
          const uid = subUserId(sub);
          if (uid == null) continue;
          const key = String(uid);
          if (!Object.prototype.hasOwnProperty.call(next, key)) {
            next[key] = '0';
          }
        }
        return next;
      });
    }
    setLoading(false);
  }, [subUsers]);

  useEffect(() => {
    void loadAllocations();
  }, [loadAllocations, subUsers]);

  const members = useMemo((): MemberRow[] => {
    const byUser = new Map<string, CompanyCreditAllocationItem>();
    for (const item of allocations.items) {
      byUser.set(String(item.consultant_user_id), item);
    }
    const rows: MemberRow[] = [];
    const seen = new Set<string>();

    for (const sub of subUsers) {
      const userId = subUserId(sub);
      if (userId == null) continue;
      const key = String(userId);
      seen.add(key);
      const allocation = byUser.get(key) || null;
      rows.push({
        userId,
        email: subUserEmail(sub) || allocation?.email || '',
        firstName: sub.first_name || allocation?.first_name || '',
        lastName: sub.last_name || allocation?.last_name || '',
        allocation,
      });
    }

    for (const item of allocations.items) {
      const key = String(item.consultant_user_id);
      if (seen.has(key)) continue;
      rows.push({
        userId: item.consultant_user_id,
        email: item.email || '',
        firstName: item.first_name || '',
        lastName: item.last_name || '',
        allocation: item,
      });
    }

    return rows;
  }, [subUsers, allocations.items]);

  const onSaveAllocation = async (userId: number) => {
    const key = String(userId);
    const raw = drafts[key] ?? '0';
    const monthlyLimit = Math.max(0, Math.floor(Number(raw) || 0));
    setSavingMap((m) => ({ ...m, [key]: true }));
    const res = await companyService.updateCompanyCreditAllocation(userId, monthlyLimit);
    setSavingMap((m) => ({ ...m, [key]: false }));
    if (res.success) {
      if (res.data) {
        setAllocations(res.data);
        setDrafts((prev) => ({ ...prev, [key]: String(monthlyLimit) }));
      } else {
        await loadAllocations();
      }
      onAllocationsChanged?.();
      Alert.alert('Tamam', res.message || 'Aylık pay kaydedildi.');
    } else {
      Alert.alert('Hata', res.message || 'Pay kaydedilemedi.');
    }
  };

  const confirmRemove = (row: MemberRow) => {
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email || 'Bu kullanıcı';
    Alert.alert(
      'Firmadan çıkar',
      `${name} firma bağlantısından ayrılacak. Kullanılmamış kredi payı firma havuzuna döner.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Çıkar', style: 'destructive', onPress: () => onRemoveMember(row.userId) },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="people" size={20} color="#3b82f6" />
        <Text style={styles.cardTitle}>Alt kullanıcılar</Text>
      </View>
      <Text style={styles.cardHint}>
        Bağlı kullanıcılara aylık Tepe Coin payı tanımlayın. Web firma sekmesi ile aynı API kullanılır.
      </Text>

      <View style={styles.poolPill}>
        <Text style={styles.poolLabel}>Firma havuzu</Text>
        <Text style={styles.poolValue}>
          {Number(allocations.company_balance || 0).toLocaleString('tr-TR')} Tepe Coin
        </Text>
      </View>

      {loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity onPress={() => void loadAllocations()}>
            <Text style={styles.retryText}>Yeniden dene</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color="#3b82f6" style={{ marginVertical: 16 }} />
      ) : members.length > 0 ? (
        <View style={styles.list}>
          {members.map((row) => (
            <MemberCard
              key={row.userId}
              row={row}
              draftValue={
                Object.prototype.hasOwnProperty.call(drafts, String(row.userId))
                  ? drafts[String(row.userId)]
                  : String(row.allocation?.monthly_limit ?? 0)
              }
              saving={Boolean(savingMap[String(row.userId)])}
              onDraftChange={(v) =>
                setDrafts((prev) => ({ ...prev, [String(row.userId)]: v }))
              }
              onSave={() => void onSaveAllocation(row.userId)}
              onRemove={() => confirmRemove(row)}
            />
          ))}
        </View>
      ) : loadError && subUsers.length > 0 ? (
        <Text style={styles.emptyText}>
          Kullanıcı listesi profilden yüklendi; kredi payları şu an alınamadı. Yeniden deneyin.
        </Text>
      ) : (
        <Text style={styles.emptyText}>Henüz alt kullanıcı bulunmuyor.</Text>
      )}
    </View>
  );
}

function MemberCard({
  row,
  draftValue,
  saving,
  onDraftChange,
  onSave,
  onRemove,
}: {
  row: MemberRow;
  draftValue: string;
  saving: boolean;
  onDraftChange: (v: string) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const alloc = row.allocation;
  const displayName = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();

  return (
    <View style={styles.memberCard}>
      <View style={styles.memberHead}>
        <View style={styles.memberHeadText}>
          <Text style={styles.memberName}>{displayName || row.email || `Kullanıcı #${row.userId}`}</Text>
          {row.email ? <Text style={styles.memberEmail}>{row.email}</Text> : null}
        </View>
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Aylık kredi payı</Text>
        <TextInput
          style={styles.fieldInput}
          value={draftValue}
          onChangeText={onDraftChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor="#94a3b8"
        />
      </View>
      <View style={styles.readonlyRow}>
        <View style={styles.readonlyCol}>
          <Text style={styles.fieldLabel}>Danışman bakiyesi</Text>
          <Text style={styles.readonlyValue}>
            {Number(alloc?.consultant_balance ?? 0).toLocaleString('tr-TR')} C
          </Text>
        </View>
        <View style={styles.readonlyCol}>
          <Text style={styles.fieldLabel}>Bu ay net ayrılan</Text>
          <Text style={styles.readonlyValue}>
            {Number(alloc?.period_net_allocated ?? 0).toLocaleString('tr-TR')} C
          </Text>
        </View>
      </View>
      {alloc?.current_period ? (
        <Text style={styles.periodHint}>Son dönem: {alloc.current_period}</Text>
      ) : null}
      <Text style={styles.hint}>
        Kullanılmamış pay eksiltmede firma havuzuna döner.
      </Text>

      <View style={styles.memberActions}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Payı kaydet</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove} activeOpacity={0.85}>
          <Ionicons name="person-remove-outline" size={18} color="#dc2626" />
          <Text style={styles.removeBtnText}>Firmadan çıkar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  cardHint: { fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 18 },
  poolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  poolLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  poolValue: { fontSize: 15, fontWeight: '800', color: '#1d4ed8' },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { fontSize: 13, color: '#b91c1c', marginBottom: 6 },
  retryText: { fontSize: 13, fontWeight: '700', color: '#3b82f6' },
  list: { gap: 10 },
  emptyText: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingVertical: 16 },
  memberCard: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  memberHead: { marginBottom: 8 },
  memberHeadText: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  memberEmail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  fieldRow: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  readonlyRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  readonlyCol: { flex: 1 },
  readonlyValue: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  periodHint: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  hint: { fontSize: 11, color: '#64748b', lineHeight: 16, marginBottom: 10 },
  memberActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  saveBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    minWidth: 110,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  removeBtnText: { fontSize: 13, fontWeight: '700', color: '#dc2626' },
});
