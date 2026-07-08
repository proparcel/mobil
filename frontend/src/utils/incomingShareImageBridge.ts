import type { IncomingShareImagePayload } from './incomingShareImage';

type IncomingShareImageHandler = (payload: IncomingShareImagePayload) => void;

let handler: IncomingShareImageHandler | null = null;
let pending: IncomingShareImagePayload | null = null;

export function registerIncomingShareImageHandler(fn: IncomingShareImageHandler | null): void {
  handler = fn;
  if (fn && pending) {
    const payload = pending;
    pending = null;
    fn(payload);
  }
}

export function dispatchIncomingShareImage(payload: IncomingShareImagePayload): boolean {
  if (handler) {
    handler(payload);
    return true;
  }
  pending = payload;
  return false;
}

export function peekPendingIncomingShareImage(): IncomingShareImagePayload | null {
  return pending;
}

export function clearPendingIncomingShareImage(): void {
  pending = null;
}
