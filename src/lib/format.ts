import type { Zaehler } from './types';

const zahl = (min: number, max: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max });

const nf0 = zahl(0, 0);
const nf1 = zahl(1, 1);
const nf2 = zahl(2, 2);
const nfStand = zahl(0, 3);
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const fmtKwh = (v: number, stellen: 0 | 1 | 2 = 1) =>
  (stellen === 0 ? nf0 : stellen === 1 ? nf1 : nf2).format(v);
export const fmtStand = (v: number) => nfStand.format(v);
export const fmtEur = (v: number) => eur.format(v);
export const fmtCt = (v: number) => nf2.format(v);
export const fmtProz = (anteil: number) => `${nf0.format(anteil * 100)} %`;

export function fmtDatum(datum: string): string {
  const [y, m, d] = datum.split('-');
  return `${d}.${m}.${y}`;
}

export function fmtDatumKurz(datum: string): string {
  const [y, m, d] = datum.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

/** Akzeptiert "1.234,5", "1234,5", "1234.5", "1234". Leer → null, ungültig → NaN. */
export function parseZahl(eingabe: string): number | null {
  const s = eingabe.trim().replace(/\s/g, '');
  if (s === '') return null;
  let norm = s;
  if (s.includes(',')) norm = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return NaN;
  return Number(norm);
}

/** Zahl → Eingabetext mit Dezimalkomma (ohne Tausenderpunkte). */
export function zahlZuEingabe(v: number | null | undefined): string {
  if (v == null) return '';
  return String(v).replace('.', ',');
}

export const ZAEHLER_LABEL: Record<Zaehler, string> = {
  pv: 'PV-Gesamtertrag',
  bezug: 'Bezug (1.8.0)',
  einspeisung: 'Einspeisung (2.8.0)',
};

export const ZAEHLER_KURZ: Record<Zaehler, string> = {
  pv: 'PV',
  bezug: 'Bezug',
  einspeisung: 'Einspeisung',
};
