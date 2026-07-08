import RNFS from 'react-native-fs';

export type IncomingShareImageFile = {
  path: string;
  mimeType: string;
  fileName?: string;
};

export type IncomingShareImagePayload = {
  base64: string;
  mimeType: string;
  fileName?: string;
  sourcePath?: string;
};

function normalizeFsPath(path: string): string {
  return String(path || '').trim().replace(/^file:\/\//, '');
}

export async function readIncomingShareImageFile(
  file: IncomingShareImageFile,
): Promise<IncomingShareImagePayload | null> {
  const fsPath = normalizeFsPath(file.path);
  if (!fsPath) return null;

  const exists = await RNFS.exists(fsPath);
  if (!exists) return null;

  const base64 = await RNFS.readFile(fsPath, 'base64');
  if (!base64) return null;

  return {
    base64,
    mimeType: file.mimeType || 'image/jpeg',
    fileName: file.fileName,
    sourcePath: file.path,
  };
}

export async function cleanupIncomingShareImageFile(path?: string | null): Promise<void> {
  if (!path) return;
  try {
    const fsPath = normalizeFsPath(path);
    if (fsPath && (await RNFS.exists(fsPath))) {
      await RNFS.unlink(fsPath);
    }
  } catch {
    /* best-effort */
  }
}
