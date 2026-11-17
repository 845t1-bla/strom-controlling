import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config';
import type { Ablesung, Anlage, Daten, Tarif, Zaehlerwechsel } from '../lib/types';
import { LEERE_ANLAGE } from '../lib/types';
import type { Backend, Repo } from './repo';

const SAMMLUNGEN = ['ablesungen', 'tarife', 'zaehlerwechsel'] as const;
type Sammlung = (typeof SAMMLUNGEN)[number];

function ohneId<T extends { id: string }>(obj: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = obj;
  return rest;
}

class FirestoreRepo implements Repo {
  constructor(
    private db: Firestore,
    private uid: string,
  ) {}

  private col(name: Sammlung) {
    return collection(this.db, 'users', this.uid, name);
  }
  private anlageDoc() {
    return doc(this.db, 'users', this.uid, 'settings', 'anlage');
  }

  beobachten(cb: (d: Daten) => void, fehler: (e: Error) => void) {
    const stand: Partial<Daten> = {};
    const geladen = new Set<string>();
    const senden = () => {
      if (geladen.size === SAMMLUNGEN.length + 1) {
        cb({
          ablesungen: stand.ablesungen ?? [],
          tarife: stand.tarife ?? [],
          zaehlerwechsel: stand.zaehlerwechsel ?? [],
          anlage: stand.anlage ?? LEERE_ANLAGE,
        });
      }
    };
    const abos = SAMMLUNGEN.map((name) =>
      onSnapshot(
        this.col(name),
        (snap) => {
          (stand as Record<string, unknown>)[name] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          geladen.add(name);
          senden();
        },
        fehler,
      ),
    );
    abos.push(
      onSnapshot(
        this.anlageDoc(),
        (snap) => {
          stand.anlage = snap.exists() ? { ...LEERE_ANLAGE, ...(snap.data() as Anlage) } : LEERE_ANLAGE;
          geladen.add('anlage');
          senden();
        },
        fehler,
      ),
    );
    return () => abos.forEach((u) => u());
  }

  ablesungSpeichern(a: Ablesung) {
    return setDoc(doc(this.col('ablesungen'), a.id), ohneId(a));
  }
  ablesungLoeschen(id: string) {
    return deleteDoc(doc(this.col('ablesungen'), id));
  }
  tarifSpeichern(t: Tarif) {
    return setDoc(doc(this.col('tarife'), t.id), ohneId(t));
  }
  tarifLoeschen(id: string) {
    return deleteDoc(doc(this.col('tarife'), id));
  }
  wechselSpeichern(w: Zaehlerwechsel) {
    return setDoc(doc(this.col('zaehlerwechsel'), w.id), ohneId(w));
  }
  wechselLoeschen(id: string) {
    return deleteDoc(doc(this.col('zaehlerwechsel'), id));
  }
  anlageSpeichern(a: Anlage) {
    return setDoc(this.anlageDoc(), a);
  }

  async allesErsetzen(d: Daten) {
    const ops: ((b: WriteBatch) => void)[] = [];
    for (const name of SAMMLUNGEN) {
      const snap = await getDocs(this.col(name));
      snap.docs.forEach((s) => ops.push((b) => b.delete(s.ref)));
    }
    const neu: Record<Sammlung, { id: string }[]> = {
      ablesungen: d.ablesungen,
      tarife: d.tarife,
      zaehlerwechsel: d.zaehlerwechsel,
    };
    for (const name of SAMMLUNGEN) {
      for (const eintrag of neu[name]) {
        ops.push((b) => b.set(doc(this.col(name), eintrag.id), ohneId(eintrag)));
      }
    }
    ops.push((b) => b.set(this.anlageDoc(), d.anlage));
    for (let k = 0; k < ops.length; k += 400) {
      const batch = writeBatch(this.db);
      ops.slice(k, k + 400).forEach((op) => op(batch));
      await batch.commit();
    }
  }
}

export function firebaseBackend(): Backend {
  const app = initializeApp(firebaseConfig);
  const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return {
    modus: 'firebase',
    auth: {
      beobachten: (cb) => onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null)),
      anmelden: async (email, passwort) => {
        await signInWithEmailAndPassword(auth, email, passwort);
      },
      abmelden: () => signOut(auth),
    },
    repo: (uid) => new FirestoreRepo(db, uid),
  };
}
