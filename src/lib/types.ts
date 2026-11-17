export type Zaehler = 'pv' | 'bezug' | 'einspeisung';
export const ZAEHLER: readonly Zaehler[] = ['pv', 'bezug', 'einspeisung'];

/** Eine Ablesung: kumulierte Stände in kWh. Leere Felder = null. */
export interface Ablesung {
  id: string;
  datum: string; // YYYY-MM-DD
  pv: number | null;
  bezug: number | null;
  einspeisung: number | null;
  notiz?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Tarif {
  id: string;
  gueltigAb: string; // YYYY-MM-DD, gilt bis zum Tag vor dem nächsten Tarif
  arbeitspreisCt: number; // ct/kWh brutto
  grundpreisEurMonat: number; // €/Monat brutto
  anbieter?: string;
  tarifname?: string;
}

export interface Zaehlerwechsel {
  id: string;
  datum: string; // ab diesem Tag zählt der neue Zähler
  zaehler: Zaehler;
  endstandAlt: number;
  startstandNeu: number;
}

export interface Anlage {
  bezeichnung?: string;
  anschaffungskostenEur: number | null;
  inbetriebnahme: string | null;
}

export interface Daten {
  ablesungen: Ablesung[];
  tarife: Tarif[];
  zaehlerwechsel: Zaehlerwechsel[];
  anlage: Anlage;
}

export const LEERE_ANLAGE: Anlage = { bezeichnung: '', anschaffungskostenEur: null, inbetriebnahme: null };
