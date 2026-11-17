import { Icon } from '../components/Icon';

export function Setup() {
  return (
    <div className="zentriert">
      <div className="glas login" style={{ maxWidth: 520 }}>
        <div className="marke" style={{ marginBottom: 14 }}>
          <span className="marke-logo">
            <Icon name="blitz" />
          </span>
          <span>
            Strom-Controlling
            <small>Einrichtung</small>
          </span>
        </div>
        <h2 style={{ marginTop: 0 }}>Firebase ist noch nicht verbunden</h2>
        <p className="text-muted">
          Trage die Web-Konfiguration deines Firebase-Projekts in <code>src/firebase-config.ts</code> ein. Die
          Schritte stehen in der <code>README.md</code>.
        </p>
        <p className="text-muted klein">
          Zum Ausprobieren ohne Firebase: <code>npm run dev:demo</code> startet die App mit Beispieldaten.
        </p>
      </div>
    </div>
  );
}
