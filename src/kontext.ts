import { createContext, useContext } from 'react';
import type { Backend, Nutzer, Repo } from './data/repo';
import type { Auswertung } from './lib/calc';
import type { Ablesung, Daten } from './lib/types';

export type Theme = 'dark' | 'light';
export type Route = 'dashboard' | 'ablesungen' | 'tarife' | 'einstellungen';

export interface AppKontext {
  backend: Backend;
  repo: Repo;
  nutzer: Nutzer;
  daten: Daten;
  aw: Auswertung;
  theme: Theme;
  setTheme: (t: Theme) => void;
  toast: (text: string, art?: 'ok' | 'fehler') => void;
  navigiere: (r: Route) => void;
  ablesungOeffnen: (a?: Ablesung) => void;
  /** Speichert im Hintergrund; offline landet die Änderung sofort im lokalen Cache. */
  ausfuehren: (p: Promise<unknown>, erfolg?: string) => void;
}

export const Kontext = createContext<AppKontext | null>(null);

export function useApp(): AppKontext {
  const k = useContext(Kontext);
  if (!k) throw new Error('Kontext fehlt');
  return k;
}
