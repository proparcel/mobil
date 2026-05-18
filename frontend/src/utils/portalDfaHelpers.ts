export type DfaRow = { label?: string; value?: string; [key: string]: unknown };

export function buildDfaRowsFromSteps(steps: unknown[], _areaM2?: number): DfaRow[] {
  if (!Array.isArray(steps)) return [];
  return steps.map((s: any) => ({
    label: s?.label ?? s?.title ?? '',
    value: s?.value ?? s?.amount ?? '',
  }));
}

export function formatTotalAppliedPercent(_steps: unknown[]): string {
  return '';
}

export function getPortalDfaPriceFooter(_rows: DfaRow[]): { unit?: string; total?: string } {
  return {};
}
