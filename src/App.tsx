import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon, type IconName } from './components/Icon';
import type { Backend, Nutzer } from './data/repo';
import { Kontext, useApp, type AppKontext, type Route, type Theme } from './kontext';
import { auswerten } from './lib/calc';
import type { Ablesung, Daten } from './lib/types';
import { AblesungModal } from './views/AblesungModal';
import { Ablesungen } from './views/Ablesungen';
import { Dashboard } from './views/Dashboard';
import { Einstellungen } from './views/Einstellungen';
import { Login } from './views/Login';
import { Setup } from './views/Setup';
import { Tarife } from './views/Tarife';

export default function App({ backend }: { backend: Backend | null }) {
  if (!backend) return <Setup />;
  return <MitBackend backend={backend} />;
}

function Laden({ text = 'Lade …' }: { text?: string }) {
  return (
    <div className="zentriert">
      <div className="marke">
        <span className="marke-logo">
          <Icon name="blitz" />
        </span>
        <span className="text-muted">{text}</span>
      </div>
    </div>
  );
}

function MitBackend({ backend }: { backend: Backend }) {
  const [nutzer, setNutzer] = useState<Nutzer | null | undefined>(undefined);
  useEffect(() => backend.auth.beobachten(setNutzer), [backend]);
  if (nutzer === undefined) return <Laden />;
  if (!nutzer) return <Login auth={backend.auth} />;
  return <Angemeldet backend={backend} nutzer={nutzer} />;
}

const ROUTEN: { route: Route; hash: string; label: string; icon: IconName }[] = [
  { route: 'dashboard', hash: '#/', label: 'Übersicht', icon: 'raster' },
  { route: 'ablesungen', hash: '#/ablesungen', label: 'Ablesungen', icon: 'liste' },
  { route: 'tarife', hash: '#/tarife', label: 'Tarife', icon: 'tarif' },
  { route: 'einstellungen', hash: '#/einstellungen', label: 'Einstellungen', icon: 'zahnrad' },
];

function routeAusHash(): Route {
  return ROUTEN.find((r) => r.hash === window.location.hash)?.route ?? 'dashboard';
}

function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#e8edf7' : '#050816');
    try {
      localStorage.setItem('strom-theme', theme);
    } catch {
      /* ignorieren */
    }
  }, [theme]);
  return [theme, setTheme];
}

function Angemeldet({ backend, nutzer }: { backend: Backend; nutzer: Nutzer }) {
  const repo = useMemo(() => backend.repo(nutzer.uid), [backend, nutzer.uid]);
  const [daten, setDaten] = useState<Daten | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(routeAusHash);
  const [theme, setTheme] = useTheme();
  const [toastText, setToastText] = useState<{ text: string; art: 'ok' | 'fehler' } | null>(null);
  const [modal, setModal] = useState<{ ablesung?: Ablesung } | null>(null);

  useEffect(() => repo.beobachten(setDaten, (e) => setLadeFehler(e.message)), [repo]);
  useEffect(() => {
    const f = () => setRoute(routeAusHash());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  useEffect(() => {
    if (!toastText) return;
    const t = setTimeout(() => setToastText(null), 3500);
    return () => clearTimeout(t);
  }, [toastText]);

  const toast = useCallback((text: string, art: 'ok' | 'fehler' = 'ok') => setToastText({ text, art }), []);
  const navigiere = useCallback((r: Route) => {
    window.location.hash = ROUTEN.find((x) => x.route === r)!.hash;
    window.scrollTo({ top: 0 });
  }, []);
  const ausfuehren = useCallback(
    (p: Promise<unknown>, erfolg?: string) => {
      if (erfolg) toast(erfolg);
      p.catch((e: Error) => toast(`Speichern fehlgeschlagen: ${e.message}`, 'fehler'));
    },
    [toast],
  );

  const aw = useMemo(() => (daten ? auswerten(daten) : null), [daten]);

  if (ladeFehler)
    return (
      <div className="zentriert">
        <div className="glas login">
          <h2>Kein Zugriff auf die Daten</h2>
          <p className="text-muted">{ladeFehler}</p>
          <p className="klein text-muted">
            Prüfe die Firestore-Regeln: Die dort eingetragene UID muss zu deinem Login passen (siehe README).
          </p>
          <button className="btn" onClick={() => backend.auth.abmelden()}>
            Abmelden
          </button>
        </div>
      </div>
    );
  if (!daten || !aw) return <Laden text="Daten werden geladen …" />;

  const ctx: AppKontext = {
    backend,
    repo,
    nutzer,
    daten,
    aw,
    theme,
    setTheme,
    toast,
    navigiere,
    ablesungOeffnen: (a) => setModal({ ablesung: a }),
    ausfuehren,
  };

  return (
    <Kontext.Provider value={ctx}>
      <div className="app">
        <nav className="glas nav" aria-label="Hauptnavigation">
          <div className="marke">
            <span className="marke-logo">
              <Icon name="blitz" />
            </span>
            <span>
              Strom-Controlling
              <small>Balkon-PV</small>
            </span>
          </div>
          {ROUTEN.map((r) => (
            <a key={r.route} href={r.hash} className={`nav-link ${route === r.route ? 'aktiv' : ''}`}>
              <Icon name={r.icon} />
              <span>{r.label}</span>
            </a>
          ))}
          <div className="nav-fuss">
            <ThemeSchalter />
          </div>
        </nav>

        <main className="inhalt">
          <div className="mobil-kopf">
            <div className="marke">
              <span className="marke-logo">
                <Icon name="blitz" />
              </span>
              <span>
                Strom-Controlling
                <small>Balkon-PV</small>
              </span>
            </div>
            <ThemeSchalter kompakt />
          </div>
          {backend.modus === 'demo' && (
            <div className="chip warn" style={{ marginBottom: 10 }}>
              <span className="led" /> Demo-Modus · Daten nur lokal in diesem Browser
            </div>
          )}
          {route === 'dashboard' && <Dashboard />}
          {route === 'ablesungen' && <Ablesungen />}
          {route === 'tarife' && <Tarife />}
          {route === 'einstellungen' && <Einstellungen />}
        </main>

        {(route === 'dashboard' || route === 'ablesungen') && (
          <button className="fab" onClick={() => setModal({})} aria-label="Neue Ablesung">
            <Icon name="plus" size={26} stroke={2.4} />
          </button>
        )}
        {modal && <AblesungModal ablesung={modal.ablesung} onClose={() => setModal(null)} />}
        {toastText && <div className={`glas toast ${toastText.art === 'fehler' ? 'fehler' : ''}`}>{toastText.text}</div>}
      </div>
    </Kontext.Provider>
  );
}

function ThemeSchalter({ kompakt = false }: { kompakt?: boolean }) {
  const { theme, setTheme } = useApp();
  const ziel = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className={kompakt ? 'btn icon' : 'btn'}
      style={kompakt ? undefined : { width: '100%' }}
      onClick={() => setTheme(ziel)}
      aria-label={ziel === 'light' ? 'Helles Design' : 'Dunkles Design'}
    >
      <Icon name={ziel === 'light' ? 'sonne' : 'mond'} />
      {!kompakt && (ziel === 'light' ? 'Hell' : 'Dunkel')}
    </button>
  );
}
