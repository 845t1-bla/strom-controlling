import type { Ablesung, Anlage, Daten, Tarif, Zaehlerwechsel } from '../lib/types';

export interface Nutzer {
  uid: string;
  email: string | null;
}

export interface AuthDienst {
  beobachten(cb: (n: Nutzer | null) => void): () => void;
  anmelden(email: string, passwort: string): Promise<void>;
  abmelden(): Promise<void>;
}

/** Datenzugriff – Firestore in Produktion, localStorage im Demo-Modus. */
export interface Repo {
  beobachten(cb: (d: Daten) => void, fehler: (e: Error) => void): () => void;
  ablesungSpeichern(a: Ablesung): Promise<void>;
  ablesungLoeschen(id: string): Promise<void>;
  tarifSpeichern(t: Tarif): Promise<void>;
  tarifLoeschen(id: string): Promise<void>;
  wechselSpeichern(w: Zaehlerwechsel): Promise<void>;
  wechselLoeschen(id: string): Promise<void>;
  anlageSpeichern(a: Anlage): Promise<void>;
  allesErsetzen(d: Daten): Promise<void>;
}

export interface Backend {
  modus: 'firebase' | 'demo';
  auth: AuthDienst;
  repo(uid: string): Repo;
  /** Nur Demo: Beispieldaten neu erzeugen. */
  zuruecksetzen?: () => void;
}

export const neueId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
