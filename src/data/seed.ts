/**
 * Erzeugt realistische Beispieldaten für den Demo-Modus:
 * 800-W-Balkon-PV ab 15.04.2024, Zählertausch (Zweirichtungszähler) am 02.05.2024,
 * ältere Bezugs-Ablesungen vom alten Zähler, drei Tarife, unregelmäßige Ablesungen.
 */
import { tagZuDatum, toTag } from '../lib/dates';
import type { Ablesung, Daten, Tarif, Zaehlerwechsel } from '../lib/types';

function zufall(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function beispielDaten(): Daten {
  const rnd = zufall(42);
  const start = toTag('2023-01-10');
  const ende = toTag('2026-11-15');
  const pvStart = toTag('2024-04-15');
  const wechselTag = toTag('2024-05-02');

  // kumulierte Werte zu Tagesbeginn
  const kum = { pv: 0, bezug: 18342, einsp: 0 };
  const stand = new Map<number, { pv: number; bezug: number; einsp: number }>();
  for (let t = start; t <= ende; t++) {
    stand.set(t, { ...kum });
    const doy = (t - toTag(`${tagZuDatum(t).slice(0, 4)}-01-01`)) % 365;
    const verbrauch = 6.2 + 1.3 * Math.cos((2 * Math.PI * (doy - 15)) / 365) + (rnd() - 0.5) * 2;
    let pv = 0;
    if (t >= pvStart) {
      const wetter = 0.2 + rnd() * 1.1;
      pv = Math.max(0, 1.8 * (1 + 0.75 * Math.cos((2 * Math.PI * (doy - 172)) / 365)) * wetter);
    }
    const evAnteil = Math.min(0.95, Math.max(0.4, 0.9 - 0.32 * (pv / 3.2)));
    const einsp = t >= wechselTag ? pv * (1 - evAnteil) : 0;
    const ev = pv - einsp;
    kum.pv += pv;
    kum.einsp += einsp;
    kum.bezug += Math.max(0.4, verbrauch - ev);
  }

  const bezugAltEnde = stand.get(wechselTag)!.bezug;
  const einspAm = (t: number) => stand.get(t)!.einsp;

  const ablesungen: Ablesung[] = [];
  let n = 0;
  const add = (t: number, felder: { pv?: boolean; bezug?: boolean; einsp?: boolean }, notiz?: string) => {
    const s = stand.get(t)!;
    const neuerZaehler = t >= wechselTag;
    ablesungen.push({
      id: `demo-a${++n}`,
      datum: tagZuDatum(t),
      pv: felder.pv ? r1(s.pv) : null,
      bezug: felder.bezug ? r1(neuerZaehler ? s.bezug - bezugAltEnde : s.bezug) : null,
      einspeisung: felder.einsp ? r1(einspAm(t)) : null,
      notiz,
      createdAt: n,
    });
  };

  // Altdaten vom alten Zähler (nur Bezug)
  add(toTag('2023-01-10'), { bezug: true }, 'Jahresabrechnung');
  add(toTag('2023-07-03'), { bezug: true });
  add(toTag('2024-01-12'), { bezug: true }, 'Jahresabrechnung');
  add(toTag('2024-04-14'), { bezug: true }, 'Vor Inbetriebnahme PV');

  // Ab Zählertausch: vollständige Ablesungen in unregelmäßigen Abständen
  const fixeTage = new Set([toTag('2026-03-01'), ende]);
  let t = wechselTag;
  add(t, { pv: true, bezug: true, einsp: true }, 'Neuer Zweirichtungszähler');
  while (t < ende) {
    const vorher = t;
    t = Math.min(ende, t + 12 + Math.floor(rnd() * 34));
    for (const f of fixeTage) if (f > vorher && f < t) t = f;
    const nurPv = rnd() < 0.06;
    add(t, nurPv ? { pv: true } : { pv: true, bezug: true, einsp: true }, nurPv ? 'Nur PV-App abgelesen' : undefined);
  }

  const zaehlerwechsel: Zaehlerwechsel[] = [
    { id: 'demo-w1', datum: tagZuDatum(wechselTag), zaehler: 'bezug', endstandAlt: r1(bezugAltEnde), startstandNeu: 0 },
  ];

  const tarife: Tarif[] = [
    { id: 'demo-t1', gueltigAb: '2022-11-01', arbeitspreisCt: 41.2, grundpreisEurMonat: 13.2, anbieter: 'Stadtwerke', tarifname: 'Grundversorgung' },
    { id: 'demo-t2', gueltigAb: '2025-01-01', arbeitspreisCt: 33.9, grundpreisEurMonat: 14.9, anbieter: 'Ökostrom AG', tarifname: 'Natur Plus 24' },
    { id: 'demo-t3', gueltigAb: '2026-03-01', arbeitspreisCt: 31.4, grundpreisEurMonat: 13.95, anbieter: 'Ökostrom AG', tarifname: 'Natur Plus 24' },
  ];

  return {
    ablesungen,
    tarife,
    zaehlerwechsel,
    anlage: { bezeichnung: 'Balkonkraftwerk 800 W', anschaffungskostenEur: 649, inbetriebnahme: '2024-04-15' },
  };
}
