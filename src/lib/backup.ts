import { euro, wert, type Auswertung } from './calc';
import { istGueltigesDatum } from './dates';
import type { Ablesung, Anlage, Daten, Tarif, Zaehler, Zaehlerwechsel } from './types';
import { ZAEHLER } from './types';

export const SCHEMA_VERSION = 1;

export function backupJson(d: Daten): string {
  return JSON.stringify(
    { app: 'strom-controlling', schemaVersion: SCHEMA_VERSION, exportiertAm: new Date().toISOString(), daten: d },
    null,
    2,
  );
}

const istZahl = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const zahlOderNull = (v: unknown) => (istZahl(v) ? v : null);
const text = (v: unknown) => (typeof v === 'string' ? v : '');

function datum(v: unknown, wo: string): string {
  if (typeof v !== 'string' || !istGueltigesDatum(v)) throw new Error(`Ungültiges Datum in ${wo}.`);
  return v;
}

function id(v: unknown, wo: string): string {
  if (typeof v !== 'string' || !v) throw new Error(`Fehlende ID in ${wo}.`);
  return v;
}

/** Liest und prüft eine Sicherung. Wirft eine verständliche Fehlermeldung bei Problemen. */
export function backupLesen(inhalt: string): Daten {
  let obj: { app?: unknown; schemaVersion?: unknown; daten?: Record<string, unknown> };
  try {
    obj = JSON.parse(inhalt);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  if (obj?.app !== 'strom-controlling' || typeof obj.daten !== 'object' || !obj.daten)
    throw new Error('Das ist keine Strom-Controlling-Sicherung.');
  if (istZahl(obj.schemaVersion) && obj.schemaVersion > SCHEMA_VERSION)
    throw new Error('Die Sicherung stammt aus einer neueren App-Version.');
  const d = obj.daten;
  const liste = (k: string) => {
    if (!Array.isArray(d[k])) throw new Error(`"${k}" fehlt in der Sicherung.`);
    return d[k] as Record<string, unknown>[];
  };

  const ablesungen: Ablesung[] = liste('ablesungen').map((a, i) => ({
    id: id(a.id, `Ablesung ${i + 1}`),
    datum: datum(a.datum, `Ablesung ${i + 1}`),
    pv: zahlOderNull(a.pv),
    bezug: zahlOderNull(a.bezug),
    einspeisung: zahlOderNull(a.einspeisung),
    notiz: text(a.notiz),
    createdAt: istZahl(a.createdAt) ? a.createdAt : i,
    updatedAt: istZahl(a.updatedAt) ? a.updatedAt : undefined,
  }));
  const tarife: Tarif[] = liste('tarife').map((t, i) => {
    if (!istZahl(t.arbeitspreisCt)) throw new Error(`Tarif ${i + 1}: Arbeitspreis fehlt.`);
    return {
      id: id(t.id, `Tarif ${i + 1}`),
      gueltigAb: datum(t.gueltigAb, `Tarif ${i + 1}`),
      arbeitspreisCt: t.arbeitspreisCt,
      grundpreisEurMonat: zahlOderNull(t.grundpreisEurMonat) ?? 0,
      anbieter: text(t.anbieter),
      tarifname: text(t.tarifname),
    };
  });
  const zaehlerwechsel: Zaehlerwechsel[] = liste('zaehlerwechsel').map((w, i) => {
    if (!ZAEHLER.includes(w.zaehler as Zaehler)) throw new Error(`Zählerwechsel ${i + 1}: unbekannter Zähler.`);
    if (!istZahl(w.endstandAlt) || !istZahl(w.startstandNeu)) throw new Error(`Zählerwechsel ${i + 1}: Stände fehlen.`);
    return {
      id: id(w.id, `Zählerwechsel ${i + 1}`),
      datum: datum(w.datum, `Zählerwechsel ${i + 1}`),
      zaehler: w.zaehler as Zaehler,
      endstandAlt: w.endstandAlt,
      startstandNeu: w.startstandNeu,
    };
  });
  const a = (d.anlage ?? {}) as Record<string, unknown>;
  const anlage: Anlage = {
    bezeichnung: text(a.bezeichnung),
    anschaffungskostenEur: zahlOderNull(a.anschaffungskostenEur),
    inbetriebnahme: typeof a.inbetriebnahme === 'string' && istGueltigesDatum(a.inbetriebnahme) ? a.inbetriebnahme : null,
  };
  return { ablesungen, tarife, zaehlerwechsel, anlage };
}

// ---------------------------------------------------------------------------
// CSV (Excel, deutsch: Semikolon + Dezimalkomma)

const BOM = '﻿';
const csvZahl = (v: number | null | undefined, stellen = 3) => (v == null ? '' : v.toFixed(stellen).replace('.', ','));
const csvText = (s: string | undefined) => {
  const t = s ?? '';
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const zeilen = (rows: string[][]) => BOM + rows.map((r) => r.join(';')).join('\r\n') + '\r\n';

export function csvAblesungen(d: Daten): string {
  const sortiert = [...d.ablesungen].sort((a, b) => a.datum.localeCompare(b.datum));
  return zeilen([
    ['Datum', 'PV-Gesamtertrag kWh', 'Bezug 1.8.0 kWh', 'Einspeisung 2.8.0 kWh', 'Notiz'],
    ...sortiert.map((a) => [a.datum, csvZahl(a.pv, 1), csvZahl(a.bezug, 1), csvZahl(a.einspeisung, 1), csvText(a.notiz)]),
  ]);
}

export function csvIntervalle(aw: Auswertung): string {
  return zeilen([
    [
      'Von',
      'Bis',
      'Tage',
      'Erzeugung kWh',
      'Eigenverbrauch kWh',
      'Einspeisung kWh',
      'Netzbezug kWh',
      'Gesamtverbrauch kWh',
      'Ersparnis EUR',
    ],
    ...aw.iv.alle.map((i) => [
      i.von,
      i.bis,
      String(i.tage),
      csvZahl(wert.erzeugung(i)),
      csvZahl(wert.eigenverbrauch(i)),
      csvZahl(wert.einspeisung(i)),
      csvZahl(wert.bezug(i)),
      csvZahl(wert.gesamtverbrauch(i)),
      csvZahl(euro([i], aw.perioden, wert.eigenverbrauch).eur, 2),
    ]),
  ]);
}

export function herunterladen(dateiname: string, inhalt: string, mime: string) {
  const url = URL.createObjectURL(new Blob([inhalt], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
