import { extractSmartQueryFromImage, type SmartQueryExtractResponse } from '../../services/smartQueryService';
import { resolveSmartQueryForForm } from './smartQueryResolve';
import { appendSmartQueryDebugLog } from './smartQueryDebugLog';
import type { SidebarSavedQuery } from './sidebarSavedQueries';

export type ShareImageSmartQueryOutcome =
  | { status: 'complete'; seed: SidebarSavedQuery }
  | { status: 'partial'; seed: SidebarSavedQuery; message: string }
  | { status: 'failed'; error: string }
  | { status: 'api_error'; message: string };

export async function applySmartQueryExtractToForm(
  result: SmartQueryExtractResponse,
  channel: 'speech' | 'text' | 'image' = 'image',
): Promise<ShareImageSmartQueryOutcome> {
  const outcome = await resolveSmartQueryForForm(result, {
    channel,
    source: 'modal',
  });

  if (outcome.status === 'complete') {
    await appendSmartQueryDebugLog('flow_success', 'modal', {
      channel,
      summary: outcome.summary,
      mahalleTkgmValue: outcome.payload.mahalleTkgmValue,
    });
    return { status: 'complete', seed: outcome.seed };
  }

  if (outcome.status === 'partial') {
    await appendSmartQueryDebugLog('flow_partial_success', 'modal', {
      channel,
      il: outcome.seed.il,
      ilce: outcome.seed.ilce,
      ada: outcome.seed.ada,
      parsel: outcome.seed.parsel,
    });
    return {
      status: 'partial',
      seed: outcome.seed,
      message: outcome.message,
    };
  }

  return { status: 'failed', error: outcome.error };
}

export async function runShareImageSmartQuery(
  base64: string,
  mimeType: string,
): Promise<ShareImageSmartQueryOutcome> {
  const response = await extractSmartQueryFromImage(base64, mimeType);
  if (!response.ok) {
    return {
      status: 'api_error',
      message: response.error || 'Görsel işlenirken bir hata oluştu.',
    };
  }
  return applySmartQueryExtractToForm(response.data, 'image');
}
