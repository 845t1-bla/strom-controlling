import type { Anlage, Daten } from '../lib/types';
import type { Backend, Repo } from './repo';
import { beispielDaten } from './seed';

const SCHLUESSEL = 'strom-controlling-demo-v1';

function laden(): Daten {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (roh) return JSON.parse(roh) as Daten;
  } catch {
    /* localStorage nicht verfügbar → frische Beispieldaten */
  }
  return beispielDaten();
}

export function demoBackend(): Backend {
  let daten = laden();
  const hoerer = new Set<(d: Daten) => void>();
  const speichern = (neu: Daten) => {
    daten = neu;
    try {
      localStorage.setItem(SCHLUESSEL, JSON.stringify(daten));
    } catch {
      /* ignorieren */
    }
    hoerer.forEach((h) => h(daten));
  };
  const upsert = <T extends { id: string }>(liste: T[], e: T) => [...liste.filter((x) => x.id !== e.id), e];

  const repo: Repo = {
    beobachten(cb) {
      hoerer.add(cb);
      queueMicrotask(() => cb(daten));
      return () => hoerer.delete(cb);
    },
    async ablesungSpeichern(a) {
      speichern({ ...daten, ablesungen: upsert(daten.ablesungen, a) });
    },
    async ablesungLoeschen(id) {
      speichern({ ...daten, ablesungen: daten.ablesungen.filter((a) => a.id !== id) });
    },
    async tarifSpeichern(t) {
      speichern({ ...daten, tarife: upsert(daten.tarife, t) });
    },
    async tarifLoeschen(id) {
      speichern({ ...daten, tarife: daten.tarife.filter((t) => t.id !== id) });
    },
    async wechselSpeichern(w) {
      speichern({ ...daten, zaehlerwechsel: upsert(daten.zaehlerwechsel, w) });
    },
    async wechselLoeschen(id) {
      speichern({ ...daten, zaehlerwechsel: daten.zaehlerwechsel.filter((w) => w.id !== id) });
    },
    async anlageSpeichern(a: Anlage) {
      speichern({ ...daten, anlage: a });
    },
    async allesErsetzen(d) {
      speichern(d);
    },
  };

  return {
    modus: 'demo',
    auth: {
      beobachten(cb) {
        queueMicrotask(() => cb({ uid: 'demo', email: 'demo@lokal' }));
        return () => {};
      },
      async anmelden() {},
      async abmelden() {},
    },
    repo: () => repo,
    zuruecksetzen: () => speichern(beispielDaten()),
  };
}
