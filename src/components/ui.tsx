import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Karte({
  titel,
  unter,
  rechts,
  children,
  className = '',
}: {
  titel?: ReactNode;
  unter?: ReactNode;
  rechts?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glas karte ${className}`}>
      {(titel || rechts) && (
        <div className="karte-kopf">
          <div>
            {titel && <h2 className="karte-titel">{titel}</h2>}
            {unter && <p className="karte-unter">{unter}</p>}
          </div>
          {rechts}
        </div>
      )}
      {children}
    </section>
  );
}

export function Segment<T extends string>({
  wert,
  optionen,
  onChange,
  label,
}: {
  wert: T;
  optionen: { wert: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segment" role="tablist" aria-label={label}>
      {optionen.map((o) => (
        <button
          key={o.wert}
          type="button"
          role="tab"
          aria-selected={o.wert === wert}
          className={o.wert === wert ? 'aktiv' : ''}
          onClick={() => onChange(o.wert)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ titel, onClose, children }: { titel: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    const alt = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = alt;
    };
  }, [onClose]);
  return (
    <div className="modal-hintergrund" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glas modal" role="dialog" aria-modal="true" aria-label={titel}>
        <div className="modal-kopf">
          <h2>{titel}</h2>
          <button type="button" className="btn icon geist" onClick={onClose} aria-label="Schließen">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Feld({
  label,
  hilfe,
  warnung,
  fehler,
  children,
}: {
  label: string;
  hilfe?: ReactNode;
  warnung?: ReactNode;
  fehler?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="feld">
      <span>{label}</span>
      {children}
      {fehler ? (
        <span className="fehlertext">{fehler}</span>
      ) : warnung ? (
        <span className="warnung">{warnung}</span>
      ) : hilfe ? (
        <span className="hilfe">{hilfe}</span>
      ) : null}
    </label>
  );
}

export function ZahlEingabe({
  wert,
  onChange,
  einheit,
  placeholder,
  name,
}: {
  wert: string;
  onChange: (v: string) => void;
  einheit: string;
  placeholder?: string;
  name?: string;
}) {
  return (
    <div className="einheit-wrap">
      <input
        className="eingabe mit-einheit mono"
        inputMode="decimal"
        autoComplete="off"
        name={name}
        value={wert}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="einheit">{einheit}</span>
    </div>
  );
}

/** Kleiner Fortschrittsring für Quoten (0…1). */
export function Ring({ anteil, farbe, groesse = 46 }: { anteil: number; farbe: string; groesse?: number }) {
  const r = 18;
  const u = 2 * Math.PI * r;
  const a = Math.max(0, Math.min(1, anteil));
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 44 44" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--grid)" strokeWidth="5" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={farbe}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${u * a} ${u}`}
        transform="rotate(-90 22 22)"
        style={{ filter: `drop-shadow(0 0 4px ${farbe})` }}
      />
    </svg>
  );
}
