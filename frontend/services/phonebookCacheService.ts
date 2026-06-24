import { InteractionManager, Platform, PermissionsAndroid } from 'react-native';
import Contacts, { type Contact } from 'react-native-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PhonebookRow = {
  recordID: string;
  displayName: string;
  phoneNumber: string;
};

export const ERR_CONTACTS_PERMISSION = 'Rehber izni gerekli.';

/** Sadece rehber okuma — native takılırsa üst sınır */
const READ_CONTACTS_MS = 120_000;

const PHONEBOOK_STORAGE_KEY = 'pp_phonebook_cache_v1';
const FIRST_LAUNCH_PROMPT_KEY = 'pp_phonebook_first_launch_v1';

type PhonebookCache = { rows: PhonebookRow[]; loadedAt: number };

let phonebookCache: PhonebookCache | null = null;
let backgroundLoadPromise: Promise<void> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

async function loadPhonebookFromDisk(): Promise<PhonebookCache | null> {
  try {
    const raw = await AsyncStorage.getItem(PHONEBOOK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rows?: PhonebookRow[]; loadedAt?: number };
    if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) return null;
    return {
      rows: parsed.rows,
      loadedAt: typeof parsed.loadedAt === 'number' ? parsed.loadedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

async function savePhonebookToDisk(rows: PhonebookRow[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PHONEBOOK_STORAGE_KEY,
      JSON.stringify({ v: 1, rows, loadedAt: Date.now() })
    );
  } catch {
    /* depolama dolu / izin — sessiz */
  }
}

export function hasUsablePhonebookCache(): boolean {
  return Boolean(phonebookCache && phonebookCache.rows.length > 0);
}

export function getPhonebookMemoryCache(): PhonebookRow[] {
  return phonebookCache?.rows ?? [];
}

export async function warmPhonebookCacheFromDisk(): Promise<PhonebookRow[] | null> {
  if (hasUsablePhonebookCache()) {
    return phonebookCache!.rows;
  }
  const fromDisk = await loadPhonebookFromDisk();
  if (fromDisk?.rows?.length) {
    phonebookCache = fromDisk;
    return fromDisk.rows;
  }
  return null;
}

export async function checkContactsPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
  }
  const perm = await Contacts.checkPermission();
  return perm === 'authorized' || perm === 'limited';
}

/**
 * İzin diyaloğu kullanıcı yanıtını bekler — zaman aşımı yok.
 * Android: doğrudan READ_CONTACTS (sistem penceresi).
 * iOS: Contacts API (sistem penceresi, süresiz bekleme).
 */
export async function ensureContactsPermission(): Promise<void> {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
    if (r !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error(ERR_CONTACTS_PERMISSION);
    }
    return;
  }
  let perm = await Contacts.checkPermission();
  if (perm === 'authorized' || perm === 'limited') return;
  perm = await Contacts.requestPermission();
  if (perm !== 'authorized' && perm !== 'limited') {
    throw new Error(ERR_CONTACTS_PERMISSION);
  }
}

function mapNativeContacts(list: Contact[]): PhonebookRow[] {
  const rows: PhonebookRow[] = [];
  for (const c of list || []) {
    const name = (c.displayName || `${c.givenName || ''} ${c.familyName || ''}`).trim();
    const num = c.phoneNumbers?.[0]?.number || '';
    if (!name || !num) continue;
    rows.push({
      recordID: String(c.recordID || c.rawContactId || Math.random()),
      displayName: name,
      phoneNumber: num,
    });
  }
  rows.sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
  return rows;
}

async function readContactsFromDevice(): Promise<PhonebookRow[]> {
  const list = await withTimeout(
    Contacts.getAllWithoutPhotos(),
    READ_CONTACTS_MS,
    'Rehber okuması çok uzun sürdü. Kişi sayısı çok fazlaysa bir süre sonra tekrar deneyin.'
  );
  return mapNativeContacts(list || []);
}

function persistPhonebookRows(rows: PhonebookRow[]): void {
  phonebookCache = { rows, loadedAt: Date.now() };
  // Büyük rehber JSON.stringify + AsyncStorage JS thread'i kilitlemesin
  InteractionManager.runAfterInteractions(() => {
    void savePhonebookToDisk(rows);
  });
}

export type LoadPhonebookOptions = {
  force?: boolean;
  requestPermission?: boolean;
};

export type LoadPhonebookResult =
  | { ok: true; rows: PhonebookRow[]; fromCache: boolean }
  | { ok: false; error: string };

/** Rehber picker ve arka plan ön yükleme için ortak okuma. */
export async function loadPhonebookContacts(opts: LoadPhonebookOptions = {}): Promise<LoadPhonebookResult> {
  const { force = false, requestPermission = true } = opts;

  if (!force && hasUsablePhonebookCache()) {
    return { ok: true, rows: phonebookCache!.rows, fromCache: true };
  }

  if (!force) {
    const fromDisk = await warmPhonebookCacheFromDisk();
    if (fromDisk?.length) {
      return { ok: true, rows: fromDisk, fromCache: true };
    }
  }

  try {
    if (requestPermission) {
      await ensureContactsPermission();
    } else {
      const granted = await checkContactsPermission();
      if (!granted) {
        return { ok: false, error: ERR_CONTACTS_PERMISSION };
      }
    }

    const rows = await readContactsFromDevice();
    persistPhonebookRows(rows);
    return { ok: true, rows, fromCache: false };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Rehber okunamadı.';
    return { ok: false, error: msg || 'Rehber okunamadı.' };
  }
}

/** Tek seferlik arka plan okuma — eşzamanlı çağrılar aynı promise'i paylaşır. */
export function refreshPhonebookInBackground(force = false): Promise<void> {
  if (backgroundLoadPromise) return backgroundLoadPromise;

  backgroundLoadPromise = (async () => {
    try {
      await loadPhonebookContacts({ force, requestPermission: false });
    } catch {
      /* best-effort */
    } finally {
      backgroundLoadPromise = null;
    }
  })();

  return backgroundLoadPromise;
}

/**
 * Uygulama ilk kez açıldığında rehber iznini ister ve arka planda yükler.
 * İzin reddedilirse sessiz kalır; picker mevcut akışı korur.
 */
export async function maybePreloadPhonebookOnFirstLaunch(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(FIRST_LAUNCH_PROMPT_KEY);
    if (done) return;
    await AsyncStorage.setItem(FIRST_LAUNCH_PROMPT_KEY, '1');

    await warmPhonebookCacheFromDisk();

    if (await checkContactsPermission()) {
      void refreshPhonebookInBackground();
      return;
    }

    try {
      await ensureContactsPermission();
      void refreshPhonebookInBackground();
    } catch {
      /* İzin verilmedi — rehber picker'da tekrar istenecek */
    }
  } catch {
    /* best-effort */
  }
}
