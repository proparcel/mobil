import AsyncStorage from '@react-native-async-storage/async-storage';

export type CachedExpertRequestData = Record<string, unknown> & {
  expertRequestId: string;
};

const prefix = 'pp_expert_req_cache:';

export const expertRequestCache = {
  async get(id: string): Promise<CachedExpertRequestData | null> {
    try {
      const raw = await AsyncStorage.getItem(prefix + id);
      if (!raw) return null;
      return JSON.parse(raw) as CachedExpertRequestData;
    } catch {
      return null;
    }
  },
  async save(id: string, data: CachedExpertRequestData): Promise<void> {
    try {
      await AsyncStorage.setItem(prefix + id, JSON.stringify({ ...data, expertRequestId: id }));
    } catch {
      // best-effort
    }
  },
  async remove(id: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(prefix + id);
    } catch {
      // best-effort
    }
  },
};
