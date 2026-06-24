import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'pp-pro-query-credit-notice-modal-';

export function proQueryCreditNoticeModalStorageKey(snapshotId: number): string {
  return `${KEY_PREFIX}${snapshotId}`;
}

export async function hasSeenProQueryCreditNoticeModal(snapshotId: number): Promise<boolean> {
  const value = await AsyncStorage.getItem(proQueryCreditNoticeModalStorageKey(snapshotId));
  return value === '1';
}

export async function markProQueryCreditNoticeModalSeen(snapshotId: number): Promise<void> {
  await AsyncStorage.setItem(proQueryCreditNoticeModalStorageKey(snapshotId), '1');
}
