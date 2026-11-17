/**
 * Rechenkern: reine Funktionen ohne UI- oder Firebase-Abhängigkeit.
 *
 * Konventionen
 * - Ein Tag ist eine ganze Zahl (Tage seit 1970-01-01, siehe dates.ts).
 * - Ein Intervall zwischen zwei Ablesungen ist halboffen [vonTag, bisTag).
 * - Ein Tarif gilt ab gueltigAb (inklusive) bis zum Tag vor dem nächsten Tarif.
 * - Mengen innerhalb eines Intervalls werden nur dort tageweise (gleichmäßig) verteilt,
 *   wo eine Grenze (Tarifwechsel, Jahreswechsel, Zeitraumfilter) mitten im Intervall liegt.
 *   Solche Teilstücke tragen das Flag `anteilig`.
 */
import type { Ablesung, Daten, Tarif, Zaehler, Zaehlerwechsel } from './types';
import { ZAEHLER } from './types';
import { jahrBeginnTag, jahrVonTag, tagZuDatum, toTag } from './dates';
import { fmtDatum, fmtStand, ZAEHLER_KURZ } from './format';

const EPS = 1e-6;
/** Toleranz für "Einspeisung > Erzeugung" (z. B. nicht exakt gleichzeitig abgelesen). */
const EV_TOLERANZ_KWH = 0.05;

export interface Hinweis {
  art: 'fehler' | 'warnung';
  datum: string;
  ablesungId?: string;
  text: string;
}

export type Deltas = Partial<Record<Zaehler, number>>;

export interface Intervall {
  von: string;
  bis: string;
  vonTag: number;
  bisTag: number;
  tage: number;
  d: Deltas;
  anteilig?: boolean;
}

export const SAETZE = {
  pv: ['pv'],
  einspeisung: ['einspeisung'],
  bezug: ['bezug'],
  pvEinsp: ['pv', 'einspeisung'],
  alle: ['pv', 'bezug', 'einspeisung'],
} as const satisfies Record<string, readonly Zaehler[]>;
export type SatzName = keyof typeof SAETZE;

/** Kennzahlen je Intervall. */
export const wert = {
  erzeugung: (i: Intervall) => i.d.pv ?? 0,
  einspeisung: (i: Intervall) => i.d.einspeisung ?? 0,
  bezug: (i: Intervall) => i.d.bezug ?? 0,
  eigenverbrauch: (i: Intervall) => Math.max(0, (i.d.pv ?? 0) - (i.d.einspeisung ?? 0)),
  gesamtverbrauch: (i: Intervall) =>
    (i.d.bezug ?? 0) + Math.max(0, (i.d.pv ?? 0) - (i.d.einspeisung ?? 0)),
};
export type Kennzahl = keyof typeof wert;
type WertFn = (i: Intervall) => number;

export interface TarifPeriode {
  tarif: Tarif;
  vonTag: number;
  bisTag: number; // exklusiv, Infinity für den aktuellen Tarif
}

export interface VirtuellerPunkt {
  id: string;
  datum: string;
  tag: number;
  v: Deltas; // virtuelle (um Zählerwechsel bereinigte) kumulierte Stände
}

export interface Auswertung {
  hinweise: Hinweis[];
  punkte: VirtuellerPunkt[];
  iv: Record<SatzName, Intervall[]>;
  perioden: TarifPeriode[];
  letzteAblesung?: string;
}

// ---------------------------------------------------------------------------
// Aufbereitung

function sortiereAblesungen(ablesungen: Ablesung[]): Ablesung[] {
  return [...ablesungen].sort(
    (a, b) => a.datum.localeCompare(b.datum) || (a.createdAt ?? 0) - (b.createdAt ?? 0),
  );
}

/**
 * Macht aus Rohständen virtuelle, durchgehend steigende Reihen.
 * Ab dem Datum eines Zählerwechsels wird (endstandAlt − startstandNeu) addiert.
 * Fallende Stände werden als Fehler gemeldet und ignoriert.
 */
export function virtualisieren(
  ablesungen: Ablesung[],
  wechsel: Zaehlerwechsel[],
  hinweise: Hinweis[] = [],
): VirtuellerPunkt[] {
  const sortiert = sortiereAblesungen(ablesungen);
  const punkte: VirtuellerPunkt[] = sortiert.map((a) => ({
    id: a.id,
    datum: a.datum,
    tag: toTag(a.datum),
    v: {},
  }));

  for (const z of ZAEHLER) {
    const ws = wechsel.filter((w) => w.zaehler === z).sort((a, b) => a.datum.localeCompare(b.datum));
    let offset = 0;
    let wi = 0;
    let letzter: { wert: number; datum: string } | null = null;

    const wechselAnwenden = (bisDatum: string | null) => {
      while (wi < ws.length && (bisDatum === null || ws[wi].datum <= bisDatum)) {
        const w = ws[wi];
        const altVirtuell = w.endstandAlt + offset;
        if (letzter && altVirtuell < letzter.wert - EPS) {
          hinweise.push({
            art: 'fehler',
            datum: w.datum,
            text: `Zählerwechsel ${ZAEHLER_KURZ[z]} am ${fmtDatum(w.datum)}: Endstand alt (${fmtStand(w.endstandAlt)}) ist kleiner als die Ablesung vom ${fmtDatum(letzter.datum)}.`,
          });
        }
        offset += w.endstandAlt - w.startstandNeu;
        letzter = { wert: Math.max(altVirtuell, letzter?.wert ?? -Infinity), datum: w.datum };
        wi++;
      }
    };

    sortiert.forEach((a, idx) => {
      wechselAnwenden(a.datum);
      const roh = a[z];
      if (roh == null || !Number.isFinite(roh)) return;
      const virtuell = roh + offset;
      if (letzter && virtuell < letzter.wert - EPS) {
        hinweise.push({
          art: 'fehler',
          datum: a.datum,
          ablesungId: a.id,
          text: `${ZAEHLER_KURZ[z]}: Stand ${fmtStand(roh)} am ${fmtDatum(a.datum)} ist kleiner als am ${fmtDatum(letzter.datum)}. Tippfehler oder Zählerwechsel nicht erfasst? Wert wird ignoriert.`,
        });
        return;
      }
      punkte[idx].v[z] = virtuell;
      letzter = { wert: virtuell, datum: a.datum };
    });
    wechselAnwenden(null);
  }
  return punkte;
}

/** Intervalle zwischen aufeinanderfolgenden Ablesungen, die alle Zähler des Satzes enthalten. */
export function intervalleBilden(punkte: VirtuellerPunkt[], satz: readonly Zaehler[]): Intervall[] {
  const geeignet = punkte.filter((p) => satz.every((z) => p.v[z] !== undefined));
  const proTag: VirtuellerPunkt[] = [];
  for (const p of geeignet) {
    if (proTag.length && proTag[proTag.length - 1].tag === p.tag) proTag[proTag.length - 1] = p;
    else proTag.push(p);
  }
  const res: Intervall[] = [];
  for (let k = 1; k < proTag.length; k++) {
    const a = proTag[k - 1];
    const b = proTag[k];
    const d: Deltas = {};
    for (const z of satz) d[z] = (b.v[z] as number) - (a.v[z] as number);
    res.push({ von: a.datum, bis: b.datum, vonTag: a.tag, bisTag: b.tag, tage: b.tag - a.tag, d });
  }
  return res;
}

export function tarifPerioden(tarife: Tarif[], hinweise: Hinweis[] = []): TarifPeriode[] {
  const sortiert = [...tarife].sort((a, b) => a.gueltigAb.localeCompare(b.gueltigAb));
  const eindeutig: Tarif[] = [];
  for (const t of sortiert) {
    if (eindeutig.length && eindeutig[eindeutig.length - 1].gueltigAb === t.gueltigAb) {
      hinweise.push({
        art: 'fehler',
        datum: t.gueltigAb,
        text: `Zwei Tarife gelten ab ${fmtDatum(t.gueltigAb)}. Es wird nur einer berücksichtigt.`,
      });
      eindeutig[eindeutig.length - 1] = t;
    } else eindeutig.push(t);
  }
  return eindeutig.map((t, k) => ({
    tarif: t,
    vonTag: toTag(t.gueltigAb),
    bisTag: k + 1 < eindeutig.length ? toTag(eindeutig[k + 1].gueltigAb) : Infinity,
  }));
}

export function auswerten(daten: Daten): Auswertung {
  const hinweise: Hinweis[] = [];

  const proDatum = new Map<string, number>();
  for (const a of daten.ablesungen) proDatum.set(a.datum, (proDatum.get(a.datum) ?? 0) + 1);
  for (const [datum, n] of proDatum) {
    if (n > 1)
      hinweise.push({
        art: 'warnung',
        datum,
        text: `${n} Ablesungen am ${fmtDatum(datum)}. Pro Zähler zählt die zuletzt erfasste.`,
      });
  }

  const punkte = virtualisieren(daten.ablesungen, daten.zaehlerwechsel, hinweise);
  const iv = Object.fromEntries(
    (Object.keys(SAETZE) as SatzName[]).map((n) => [n, intervalleBilden(punkte, SAETZE[n])]),
  ) as Record<SatzName, Intervall[]>;

  for (const i of iv.pvEinsp) {
    const ev = (i.d.pv ?? 0) - (i.d.einspeisung ?? 0);
    if (ev < -EV_TOLERANZ_KWH) {
      hinweise.push({
        art: 'fehler',
        datum: i.bis,
        text: `${fmtDatum(i.von)} bis ${fmtDatum(i.bis)}: mehr eingespeist (${fmtStand(i.d.einspeisung ?? 0)} kWh) als erzeugt (${fmtStand(i.d.pv ?? 0)} kWh). Ablesung prüfen.`,
      });
    }
  }

  const perioden = tarifPerioden(daten.tarife, hinweise);
  const letzte = sortiereAblesungen(daten.ablesungen).at(-1)?.datum;
  hinweise.sort((a, b) => b.datum.localeCompare(a.datum));
  return { hinweise, punkte, iv, perioden, letzteAblesung: letzte };
}

// ---------------------------------------------------------------------------
// Zeitfenster

/** Schneidet Intervalle auf [a, b) zu; Teilstücke werden tageweise anteilig skaliert. */
export function clip(iv: Intervall[], a: number, b: number): Intervall[] {
  const out: Intervall[] = [];
  for (const i of iv) {
    const s = Math.max(a, i.vonTag);
    const e = Math.min(b, i.bisTag);
    if (e <= s) continue;
    if (s === i.vonTag && e === i.bisTag) {
      out.push(i);
      continue;
    }
    const f = (e - s) / i.tage;
    const d: Deltas = {};
    for (const z of Object.keys(i.d) as Zaehler[]) d[z] = (i.d[z] as number) * f;
    out.push({ von: tagZuDatum(s), bis: tagZuDatum(e), vonTag: s, bisTag: e, tage: e - s, d, anteilig: true });
  }
  return out;
}

export function summe(iv: Intervall[], fn: WertFn): number {
  return iv.reduce((s, i) => s + fn(i), 0);
}

export function tageGesamt(iv: Intervall[]): number {
  return iv.reduce((s, i) => s + i.tage, 0);
}

// ---------------------------------------------------------------------------
// Geld

export interface EuroErgebnis {
  eur: number;
  ohneTarifKwh: number;
}

/** Bewertet die Menge `fn` je Intervall mit dem jeweils gültigen Arbeitspreis (tageweise aufgeteilt). */
export function euro(iv: Intervall[], perioden: TarifPeriode[], fn: WertFn): EuroErgebnis {
  let eur = 0;
  let ohneTarifKwh = 0;
  for (const i of iv) {
    const menge = fn(i);
    let abgedeckt = 0;
    for (const p of perioden) {
      const s = Math.max(p.vonTag, i.vonTag);
      const e = Math.min(p.bisTag, i.bisTag);
      if (e <= s) continue;
      eur += ((menge * (e - s)) / i.tage) * (p.tarif.arbeitspreisCt / 100);
      abgedeckt += e - s;
    }
    ohneTarifKwh += (menge * (i.tage - abgedeckt)) / i.tage;
  }
  return { eur, ohneTarifKwh };
}

/** Grundpreis für [a, b): Tagessatz = Monatspreis × 12 / 365. */
export function grundpreis(perioden: TarifPeriode[], a: number, b: number): number {
  let eur = 0;
  for (const p of perioden) {
    const s = Math.max(p.vonTag, a);
    const e = Math.min(p.bisTag, b);
    if (e > s) eur += ((e - s) * p.tarif.grundpreisEurMonat * 12) / 365;
  }
  return eur;
}

export interface ReihenPunkt {
  tag: number;
  wert: number;
}

/** Kumulierte Ersparnis (Eigenverbrauch × Arbeitspreis) an den Intervallenden. */
export function ersparnisReihe(evIv: Intervall[], perioden: TarifPeriode[]): ReihenPunkt[] {
  if (!evIv.length) return [];
  const res: ReihenPunkt[] = [{ tag: evIv[0].vonTag, wert: 0 }];
  let kum = 0;
  for (const i of evIv) {
    kum += euro([i], perioden, wert.eigenverbrauch).eur;
    res.push({ tag: i.bisTag, wert: kum });
  }
  return res;
}

export interface KostenPunkt {
  tag: number;
  mitPv: number;
  ohnePv: number;
}

/** Kumulierte Stromkosten mit PV (Netzbezug) und fiktiv ohne PV (Gesamtverbrauch), jeweils inkl. Grundpreis. */
export function kostenReihe(alleIv: Intervall[], perioden: TarifPeriode[]): KostenPunkt[] {
  if (!alleIv.length) return [];
  const res: KostenPunkt[] = [{ tag: alleIv[0].vonTag, mitPv: 0, ohnePv: 0 }];
  let mit = 0;
  let ohne = 0;
  for (const i of alleIv) {
    const gp = grundpreis(perioden, i.vonTag, i.bisTag);
    mit += euro([i], perioden, wert.bezug).eur + gp;
    ohne += euro([i], perioden, wert.gesamtverbrauch).eur + gp;
    res.push({ tag: i.bisTag, mitPv: mit, ohnePv: ohne });
  }
  return res;
}

// ---------------------------------------------------------------------------
// Amortisation

export interface Amortisation {
  kosten: number;
  gespart: number;
  anteil: number;
  amortisiertAm?: string;
  prognose?: string;
  rateProTag: number;
  unsicher: boolean;
}

export function amortisation(
  evIv: Intervall[],
  perioden: TarifPeriode[],
  kosten: number | null | undefined,
): Amortisation | null {
  if (!kosten || kosten <= 0 || !evIv.length) return null;
  const ersterTag = evIv[0].vonTag;
  const letzterTag = evIv[evIv.length - 1].bisTag;
  const spanne = letzterTag - ersterTag;

  let kum = 0;
  let amortisiertAm: string | undefined;
  for (const i of evIv) {
    const e = euro([i], perioden, wert.eigenverbrauch).eur;
    if (!amortisiertAm && kum + e >= kosten && e > 0) {
      const tag = i.vonTag + Math.ceil(((kosten - kum) / e) * i.tage);
      amortisiertAm = tagZuDatum(Math.min(tag, i.bisTag));
    }
    kum += e;
  }

  const unsicher = spanne < 365;
  const rateProTag = unsicher
    ? spanne > 0
      ? kum / spanne
      : 0
    : euro(clip(evIv, letzterTag - 365, letzterTag), perioden, wert.eigenverbrauch).eur / 365;

  let prognose: string | undefined;
  if (!amortisiertAm && rateProTag > 0) {
    prognose = tagZuDatum(letzterTag + Math.ceil((kosten - kum) / rateProTag));
  }
  return { kosten, gespart: kum, anteil: kum / kosten, amortisiertAm, prognose, rateProTag, unsicher };
}

// ---------------------------------------------------------------------------
// Kennzahlen für einen Zeitraum und Jahreswerte

export interface Menge {
  kwh: number;
  tage: number;
  anteilig: boolean;
}

export interface Kennzahlen {
  erzeugung?: Menge;
  eigenverbrauch?: Menge;
  einspeisung?: Menge;
  bezug?: Menge;
  gesamtverbrauch?: Menge;
  ersparnis?: { eur: number; ohneTarifKwh: number; tage: number; anteilig: boolean };
  quote?: number;
  autarkie?: number;
}

function menge(iv: Intervall[], fn: WertFn): Menge | undefined {
  if (!iv.length) return undefined;
  return { kwh: summe(iv, fn), tage: tageGesamt(iv), anteilig: iv.some((i) => i.anteilig) };
}

export function kennzahlen(aw: Auswertung, a: number, b: number): Kennzahlen {
  const pv = clip(aw.iv.pv, a, b);
  const ein = clip(aw.iv.einspeisung, a, b);
  const bez = clip(aw.iv.bezug, a, b);
  const pe = clip(aw.iv.pvEinsp, a, b);
  const alle = clip(aw.iv.alle, a, b);

  const k: Kennzahlen = {
    erzeugung: menge(pv, wert.erzeugung),
    einspeisung: menge(ein, wert.einspeisung),
    bezug: menge(bez, wert.bezug),
    eigenverbrauch: menge(pe, wert.eigenverbrauch),
    gesamtverbrauch: menge(alle, wert.gesamtverbrauch),
  };
  if (pe.length) {
    const r = euro(pe, aw.perioden, wert.eigenverbrauch);
    k.ersparnis = { ...r, tage: tageGesamt(pe), anteilig: pe.some((i) => i.anteilig) };
    const erz = summe(pe, wert.erzeugung);
    if (erz > EPS) k.quote = summe(pe, wert.eigenverbrauch) / erz;
  }
  if (alle.length) {
    const gv = summe(alle, wert.gesamtverbrauch);
    if (gv > EPS) k.autarkie = summe(alle, wert.eigenverbrauch) / gv;
  }
  return k;
}

export interface JahresWert extends Kennzahlen {
  jahr: number;
  /** Tage des Jahres, für die PV- und Einspeisewerte vorliegen (Basis für Ersparnis und Quote). */
  abdeckungTage: number;
  tageImJahr: number;
}

export function jahresWerte(aw: Auswertung): JahresWert[] {
  const alleIv = (Object.values(aw.iv) as Intervall[][]).flat();
  if (!alleIv.length) return [];
  const min = Math.min(...alleIv.map((i) => i.vonTag));
  const max = Math.max(...alleIv.map((i) => i.bisTag)) - 1;
  const res: JahresWert[] = [];
  for (let j = jahrVonTag(min); j <= jahrVonTag(max); j++) {
    const a = jahrBeginnTag(j);
    const b = jahrBeginnTag(j + 1);
    res.push({
      jahr: j,
      ...kennzahlen(aw, a, b),
      abdeckungTage: tageGesamt(clip(aw.iv.pvEinsp, a, b)),
      tageImJahr: b - a,
    });
  }
  return res;
}

/** Tarif, der an einem Tag gilt. */
export function tarifAm(perioden: TarifPeriode[], tag: number): Tarif | undefined {
  return perioden.find((p) => p.vonTag <= tag && tag < p.bisTag)?.tarif;
}
