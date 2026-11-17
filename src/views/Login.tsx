import { useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { Feld } from '../components/ui';
import type { AuthDienst } from '../data/repo';

function meldung(code: string): string {
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'E-Mail oder Passwort ist falsch.';
  if (code.includes('too-many-requests')) return 'Zu viele Versuche. Bitte kurz warten und erneut probieren.';
  if (code.includes('network-request-failed')) return 'Keine Verbindung zum Server. Bist du online?';
  if (code.includes('invalid-email')) return 'Die E-Mail-Adresse ist ungültig.';
  return 'Anmeldung fehlgeschlagen.';
}

export function Login({ auth }: { auth: AuthDienst }) {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    setFehler(null);
    setLaeuft(true);
    try {
      await auth.anmelden(email.trim(), passwort);
    } catch (err) {
      setFehler(meldung(String((err as { code?: string }).code ?? err)));
      setLaeuft(false);
    }
  };

  return (
    <div className="zentriert">
      <form className="glas login formular" onSubmit={absenden}>
        <div className="marke" style={{ marginBottom: 6 }}>
          <span className="marke-logo">
            <Icon name="blitz" />
          </span>
          <span>
            Strom-Controlling
            <small>Anmelden</small>
          </span>
        </div>
        <Feld label="E-Mail">
          <input
            className="eingabe"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Feld>
        <Feld label="Passwort" fehler={fehler}>
          <input
            className="eingabe"
            type="password"
            autoComplete="current-password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            required
          />
        </Feld>
        <button className="btn primaer" type="submit" disabled={laeuft}>
          {laeuft ? 'Anmelden …' : 'Anmelden'}
        </button>
        <p className="klein text-muted" style={{ margin: 0 }}>
          Du bleibst auf diesem Gerät angemeldet. Konten werden in der Firebase-Konsole angelegt.
        </p>
      </form>
    </div>
  );
}
