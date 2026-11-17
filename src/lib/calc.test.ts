import { describe, expect, it } from 'vitest';
import {
  amortisation,
  auswerten,
  clip,
  euro,
  grundpreis,
  jahresWerte,
  kennzahlen,
  kostenReihe,
  summe,
  wert,
} from './calc';
import { toTag } from './dates';
import { beispielDaten } from '../data/seed';
import { backupJson, backupLesen, csvAblesungen } from './backup';
import { parseZahl } from './format';
import type { Ablesung, Daten, Tarif, Zaehlerwechsel } from './types';

let n = 0;
const ab = (datum: string, pv: number | null, bezug: number | null, einspeisung: number | null): Ablesung => ({
  id: `a${++n}`,
  datum,
  pv,
  bezug,
  einspeisung,
  createdAt: n,
});
const tarif = (gueltigAb: string, ct: number, gp = 0): Tarif => ({
  id: `t${gueltigAb}`,
  gueltigAb,
  arbeitspreisCt: ct,
  grundpreisEurMonat: gp,
});
const daten = (ablesungen: Ablesung[], tarife: Tarif[] = [], zaehlerwechsel: Zaehlerwechsel[] = []): Daten => ({
  ablesungen,
  tarife,
  zaehlerwechsel,
  anlage: { anschaffungskostenEur: null, inbetriebnahme: null },
});

describe('Grundrechnung', () => {
  it('berechnet Deltas, Eigenverbrauch, Gesamtverbrauch, Quote und Autarkie', () => {
    const aw = auswerten(daten([ab('2026-01-01', 100, 1000, 10), ab('2026-01-11', 120, 1030, 15)]));
    expect(aw.hinweise).toEqual([]);
    const [i] = aw.iv.alle;
    expect(i.tage).toBe(10);
    expect(wert.erzeugung(i)).toBeCloseTo(20);
    expect(wert.einspeisung(i)).toBeCloseTo(5);
    expect(wert.bezug(i)).toBeCloseTo(30);
    expect(wert.eigenverbrauch(i)).toBeCloseTo(15);
    expect(wert.gesamtverbrauch(i)).toBeCloseTo(45);

    const k = kennzahlen(aw, -Infinity, Infinity);
    expect(k.quote).toBeCloseTo(15 / 20);
    expect(k.autarkie).toBeCloseTo(15 / 45);
  });

  it('nutzt bei Teil-Ablesungen je Kennzahl nur passende Ablesungen', () => {
    const aw = auswerten(
      daten([ab('2026-01-01', 100, 1000, 10), ab('2026-01-05', null, 1012, null), ab('2026-01-11', 120, 1030, 15)]),
    );
    expect(aw.iv.bezug.map((i) => i.tage)).toEqual([4, 6]);
    expect(aw.iv.pvEinsp.map((i) => i.tage)).toEqual([10]);
    expect(aw.iv.alle.map((i) => i.tage)).toEqual([10]);
    expect(summe(aw.iv.bezug, wert.bezug)).toBeCloseTo(30);
  });

  it('zählt bei mehreren Ablesungen am selben Tag die zuletzt erfasste und warnt', () => {
    const aw = auswerten(daten([ab('2026-01-01', 100, 1000, 10), ab('2026-01-01', 101, 1001, 10), ab('2026-01-11', 120, 1030, 15)]));
    expect(aw.iv.alle).toHaveLength(1);
    expect(wert.erzeugung(aw.iv.alle[0])).toBeCloseTo(19);
    expect(aw.hinweise.some((h) => h.art === 'warnung')).toBe(true);
  });
});

describe('Zählerwechsel', () => {
  it('setzt die Reihe über den Wechsel hinweg fort', () => {
    const aw = auswerten(
      daten(
        [ab('2026-01-01', null, 1000, null), ab('2026-02-01', null, 50, null)],
        [],
        [{ id: 'w', datum: '2026-01-15', zaehler: 'bezug', endstandAlt: 1100, startstandNeu: 0 }],
      ),
    );
    expect(aw.hinweise).toEqual([]);
    expect(summe(aw.iv.bezug, wert.bezug)).toBeCloseTo(150);
  });

  it('meldet einen fallenden Stand ohne Wechsel als Fehler und ignoriert ihn', () => {
    const aw = auswerten(
      daten([ab('2026-01-01', null, 1000, null), ab('2026-01-10', null, 900, null), ab('2026-01-20', null, 1040, null)]),
    );
    expect(aw.hinweise.filter((h) => h.art === 'fehler')).toHaveLength(1);
    expect(aw.iv.bezug).toHaveLength(1);
    expect(summe(aw.iv.bezug, wert.bezug)).toBeCloseTo(40);
  });
});

describe('Validierung', () => {
  it('meldet mehr Einspeisung als Erzeugung', () => {
    const aw = auswerten(daten([ab('2026-01-01', 100, 1000, 10), ab('2026-01-11', 105, 1030, 20)]));
    expect(aw.hinweise.some((h) => h.art === 'fehler' && h.text.includes('eingespeist'))).toBe(true);
    expect(wert.eigenverbrauch(aw.iv.pvEinsp[0])).toBe(0);
  });
});

describe('Tarife und Geld', () => {
  // 10.12.2025 → 20.01.2026 = 41 Tage; 22 Tage im alten, 19 Tage im neuen Tarif
  const lauf = () =>
    auswerten(
      daten([ab('2025-12-10', 0, 0, 0), ab('2026-01-20', 41, 0, 0)], [tarif('2025-01-01', 30, 10), tarif('2026-01-01', 40, 20)]),
    );

  it('teilt einen Tarifwechsel mitten im Intervall tageweise auf', () => {
    const aw = lauf();
    const r = euro(aw.iv.pvEinsp, aw.perioden, wert.eigenverbrauch);
    expect(r.eur).toBeCloseTo(22 * 0.3 + 19 * 0.4);
    expect(r.ohneTarifKwh).toBeCloseTo(0);
  });

  it('teilt Jahreswerte an der Jahresgrenze anteilig auf', () => {
    const jw = jahresWerte(lauf());
    expect(jw.map((j) => j.jahr)).toEqual([2025, 2026]);
    expect(jw[0].erzeugung?.kwh).toBeCloseTo(22);
    expect(jw[0].erzeugung?.anteilig).toBe(true);
    expect(jw[1].erzeugung?.kwh).toBeCloseTo(19);
    expect(jw[0].ersparnis?.eur).toBeCloseTo(22 * 0.3);
  });

  it('weist kWh ohne Tarif aus', () => {
    const aw = auswerten(daten([ab('2026-01-01', 0, 0, 0), ab('2026-01-11', 10, 0, 0)], [tarif('2026-01-06', 30)]));
    const r = euro(aw.iv.pvEinsp, aw.perioden, wert.eigenverbrauch);
    expect(r.eur).toBeCloseTo(5 * 0.3);
    expect(r.ohneTarifKwh).toBeCloseTo(5);
  });

  it('rechnet den Grundpreis tageweise (12 €/Monat über 365 Tage = 144 €)', () => {
    const aw = auswerten(daten([], [tarif('2025-01-01', 30, 12)]));
    expect(grundpreis(aw.perioden, toTag('2025-01-01'), toTag('2026-01-01'))).toBeCloseTo(144);
  });

  it('vergleicht Kosten mit und ohne PV', () => {
    const aw = auswerten(daten([ab('2026-01-01', 0, 0, 0), ab('2026-01-11', 20, 30, 5)], [tarif('2025-01-01', 30, 0)]));
    const r = kostenReihe(aw.iv.alle, aw.perioden).at(-1)!;
    expect(r.mitPv).toBeCloseTo(30 * 0.3);
    expect(r.ohnePv).toBeCloseTo(45 * 0.3);
  });
});

describe('Zeitfenster', () => {
  it('schneidet Intervalle anteilig zu', () => {
    const aw = auswerten(daten([ab('2026-01-01', 0, 0, 0), ab('2026-01-11', 10, 20, 0)]));
    const c = clip(aw.iv.alle, toTag('2026-01-06'), toTag('2026-02-01'));
    expect(c[0].tage).toBe(5);
    expect(c[0].anteilig).toBe(true);
    expect(wert.erzeugung(c[0])).toBeCloseTo(5);
  });
});

describe('Amortisation', () => {
  it('prognostiziert bei < 12 Monaten Daten mit dem Gesamtdurchschnitt und markiert unsicher', () => {
    // 100 Tage, 100 kWh Eigenverbrauch à 30 ct = 30 € → 0,30 €/Tag; Kosten 60 € → noch 100 Tage
    const aw = auswerten(daten([ab('2026-01-01', 0, 0, 0), ab('2026-04-11', 100, 0, 0)], [tarif('2025-01-01', 30)]));
    const am = amortisation(aw.iv.pvEinsp, aw.perioden, 60)!;
    expect(am.gespart).toBeCloseTo(30);
    expect(am.anteil).toBeCloseTo(0.5);
    expect(am.unsicher).toBe(true);
    expect(am.prognose).toBe('2026-07-20');
  });

  it('nutzt die letzten 365 Tage, wenn genug Daten vorliegen', () => {
    const aw = auswerten(
      daten(
        [ab('2024-01-01', 0, 0, 0), ab('2025-01-01', 366, 0, 0), ab('2026-01-01', 1096, 0, 0)],
        [tarif('2020-01-01', 10)],
      ),
    );
    const am = amortisation(aw.iv.pvEinsp, aw.perioden, 1000)!;
    expect(am.unsicher).toBe(false);
    expect(am.rateProTag).toBeCloseTo(0.2); // 730 kWh / 365 Tage × 0,10 €
  });

  it('erkennt das Amortisationsdatum, wenn die Kosten schon eingespielt sind', () => {
    const aw = auswerten(daten([ab('2026-01-01', 0, 0, 0), ab('2026-01-11', 100, 0, 0)], [tarif('2025-01-01', 100)]));
    const am = amortisation(aw.iv.pvEinsp, aw.perioden, 50)!;
    expect(am.amortisiertAm).toBe('2026-01-06');
    expect(am.prognose).toBeUndefined();
  });
});

describe('Demo-Daten', () => {
  it('sind fehlerfrei und decken alle Kennzahlen ab', () => {
    const aw = auswerten(beispielDaten());
    expect(aw.hinweise.filter((h) => h.art === 'fehler')).toEqual([]);
    expect(aw.iv.alle.length).toBeGreaterThan(10);
    const k = kennzahlen(aw, -Infinity, Infinity);
    expect(k.erzeugung!.kwh).toBeGreaterThan(1000);
    expect(k.quote!).toBeGreaterThan(0.5);
    expect(k.quote!).toBeLessThan(0.95);
  });
});

describe('Backup', () => {
  it('übersteht JSON-Export und -Import verlustfrei', () => {
    const d = beispielDaten();
    expect(backupLesen(backupJson(d))).toEqual({
      ...d,
      ablesungen: d.ablesungen.map((a) => ({ ...a, notiz: a.notiz ?? '', updatedAt: undefined })),
      tarife: d.tarife.map((t) => ({ ...t, anbieter: t.anbieter ?? '', tarifname: t.tarifname ?? '' })),
    });
  });

  it('lehnt fremde Dateien verständlich ab', () => {
    expect(() => backupLesen('{"foo":1}')).toThrow('keine Strom-Controlling-Sicherung');
    expect(() => backupLesen('kein json')).toThrow('kein gültiges JSON');
  });

  it('erzeugt Excel-taugliches CSV mit BOM, Semikolon und Dezimalkomma', () => {
    const csv = csvAblesungen(daten([ab('2026-01-01', 12.5, 1000, null)]));
    expect(csv.startsWith('﻿Datum;')).toBe(true);
    expect(csv).toContain('2026-01-01;12,5;1000,0;;');
  });
});

describe('parseZahl', () => {
  it('versteht deutsche und englische Schreibweise', () => {
    expect(parseZahl('1.234,5')).toBe(1234.5);
    expect(parseZahl('1234,5')).toBe(1234.5);
    expect(parseZahl('1234.5')).toBe(1234.5);
    expect(parseZahl(' ')).toBeNull();
    expect(parseZahl('abc')).toBeNaN();
  });
});
