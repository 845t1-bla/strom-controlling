/**
 * Datumslogik ohne Zeitzonen-/Sommerzeitfallen:
 * Ein "Tag" ist die Anzahl Tage seit 1970-01-01 (UTC), berechnet aus einem YYYY-MM-DD-String.
 */
const MS_PRO_TAG = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

export function toTag(datum: string): number {
  const [y, m, d] = datum.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PRO_TAG);
}

export function tagZuDatum(tag: number): string {
  return new Date(tag * MS_PRO_TAG).toISOString().slice(0, 10);
}

export function heute(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function heuteTag(): number {
  return toTag(heute());
}

export function jahrBeginnTag(jahr: number): number {
  return toTag(`${jahr}-01-01`);
}

export function jahrVonTag(tag: number): number {
  return new Date(tag * MS_PRO_TAG).getUTCFullYear();
}

/** Lokale Mitternacht als Zeitstempel – für Diagramm-Zeitachsen. */
export function tagZuLokalMs(tag: number): number {
  const [y, m, d] = tagZuDatum(tag).split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Zeitstempel (lokal) → Tag inkl. Tagesbruchteil – für Hover auf Diagrammen. */
export function lokalMsZuTag(ms: number): number {
  const dt = new Date(ms);
  const basis = toTag(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
  const mitternacht = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  return basis + (ms - mitternacht) / MS_PRO_TAG;
}

export function istGueltigesDatum(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return tagZuDatum(toTag(s)) === s;
}
