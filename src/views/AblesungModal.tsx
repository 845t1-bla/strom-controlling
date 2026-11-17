import { useState } from 'react';
import { Feld, Modal, ZahlEingabe } from '../components/ui';
import { neueId } from '../data/repo';
import { useApp } from '../kontext';
import { heute, istGueltigesDatum, toTag } from '../lib/dates';
import { fmtDatum, fmtKwh, fmtStand, parseZahl, ZAEHLER_LABEL, zahlZuEingabe } from '../lib/format';
import type { Ablesung, Zaehler } from '../lib/types';
import { ZAEHLER } from '../lib/types';

/** Obergrenzen pro Tag, ab denen wir nachfragen (Balkon-PV ≈ max. 6–7 kWh/Tag). */
const MAX_PRO_TAG: Record<Zaehler, number> = { pv: 8, einspeisung: 8, bezug: 60 };

export function AblesungModal({ ablesung, onClose }: { ablesung?: Ablesung; onClose: () => void }) {
  const { daten, repo, ausfuehren } = useApp();
  const [datum, setDatum] = useState(ablesung?.datum ?? heute());
  const [werte, setWerte] = useState<Record<Zaehler, string>>({
    pv: zahlZuEingabe(ablesung?.pv),
    bezug: zahlZuEingabe(ablesung?.bezug),
    einspeisung: zahlZuEingabe(ablesung?.einspeisung),
  });
  const [notiz, setNotiz] = useState(ablesung?.notiz ?? '');
  const [loeschFrage, setLoeschFrage] = useState(false);

  const andere = daten.ablesungen.filter((a) => a.id !== ablesung?.id);
  const datumOk = istGueltigesDatum(datum);
  const datumFehler = !datumOk ? 'Ungültiges Datum' : datum > heute() ? 'Das Datum liegt in der Zukunft.' : undefined;

  const pruefe = (z: Zaehler) => {
    const v = parseZahl(werte[z]);
    if (v === null) return { v, hilfe: 'leer lassen, wenn nicht abgelesen' };
    if (Number.isNaN(v)) return { v, fehler: 'Keine gültige Zahl' };
    if (v < 0) return { v, fehler: 'Darf nicht negativ sein' };
    if (!datumOk) return { v };

    const vorher = andere
      .filter((a) => a[z] != null && a.datum <= datum)
      .sort((a, b) => b.datum.localeCompare(a.datum) || (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
    const nachher = andere
      .filter((a) => a[z] != null && a.datum > datum)
      .sort((a, b) => a.datum.localeCompare(b.datum))[0];
    const wechselZwischen = (von: string, bis: string) =>
      daten.zaehlerwechsel.some((w) => w.zaehler === z && w.datum > von && w.datum <= bis);

    if (vorher && !wechselZwischen(vorher.datum, datum)) {
      const alt = vorher[z] as number;
      if (v < alt)
        return {
          v,
          warnung: `Kleiner als am ${fmtDatum(vorher.datum)} (${fmtStand(alt)}). Zählerwechsel? Dann unter Einstellungen erfassen.`,
        };
      const tage = toTag(datum) - toTag(vorher.datum);
      if (tage > 0 && (v - alt) / tage > MAX_PRO_TAG[z])
        return { v, warnung: `Ungewöhnlich hoch: ${fmtKwh((v - alt) / tage)} kWh pro Tag seit ${fmtDatum(vorher.datum)}.` };
    }
    if (nachher && !wechselZwischen(datum, nachher.datum) && v > (nachher[z] as number))
      return {
        v,
        warnung: `Größer als die spätere Ablesung vom ${fmtDatum(nachher.datum)} (${fmtStand(nachher[z] as number)}).`,
      };
    if (vorher) {
      const diff = v - (vorher[z] as number);
      return {
        v,
        hilfe: wechselZwischen(vorher.datum, datum)
          ? `Zählerwechsel seit ${fmtDatum(vorher.datum)} wird berücksichtigt`
          : `+${fmtKwh(diff)} kWh seit ${fmtDatum(vorher.datum)} (${fmtStand(vorher[z] as number)})`,
      };
    }
    return { v, hilfe: 'Erster Wert für diesen Zähler' };
  };

  const pruefung = Object.fromEntries(ZAEHLER.map((z) => [z, pruefe(z)])) as Record<Zaehler, ReturnType<typeof pruefe>>;
  const keinWert = ZAEHLER.every((z) => pruefung[z].v === null);
  const fehlerVorhanden = !!datumFehler || keinWert || ZAEHLER.some((z) => 'fehler' in pruefung[z] && pruefung[z].fehler);

  const speichern = () => {
    if (fehlerVorhanden) return;
    const jetzt = Date.now();
    const zahl = (z: Zaehler) => (pruefung[z].v as number | null) ?? null;
    const neu: Ablesung = {
      id: ablesung?.id ?? neueId(),
      datum,
      pv: zahl('pv'),
      bezug: zahl('bezug'),
      einspeisung: zahl('einspeisung'),
      notiz: notiz.trim(),
      createdAt: ablesung?.createdAt ?? jetzt,
      updatedAt: jetzt,
    };
    ausfuehren(repo.ablesungSpeichern(neu), 'Ablesung gespeichert');
    onClose();
  };

  return (
    <Modal titel={ablesung ? 'Ablesung bearbeiten' : 'Neue Ablesung'} onClose={onClose}>
      <form
        className="formular"
        onSubmit={(e) => {
          e.preventDefault();
          speichern();
        }}
      >
        {!ablesung && (
          <p className="klein text-muted" style={{ margin: 0 }}>
            Tipp: Lies alle drei Werte möglichst gleichzeitig ab, am besten abends nach Sonnenuntergang. Dann
            stimmt der Eigenverbrauch exakt.
          </p>
        )}
        <Feld label="Datum" fehler={datumFehler}>
          <input className="eingabe" type="date" value={datum} max={heute()} onChange={(e) => setDatum(e.target.value)} />
        </Feld>
        {ZAEHLER.map((z) => {
          const p = pruefung[z];
          return (
            <Feld
              key={z}
              label={ZAEHLER_LABEL[z]}
              hilfe={'hilfe' in p ? p.hilfe : undefined}
              warnung={'warnung' in p ? p.warnung : undefined}
              fehler={'fehler' in p ? p.fehler : undefined}
            >
              <ZahlEingabe
                name={z}
                wert={werte[z]}
                einheit="kWh"
                placeholder="z. B. 1234,5"
                onChange={(v) => setWerte((w) => ({ ...w, [z]: v }))}
              />
            </Feld>
          );
        })}
        {keinWert && <p className="fehlertext klein" style={{ margin: 0, color: 'var(--c-fehler)' }}>Mindestens einen Wert eintragen.</p>}
        <Feld label="Notiz (optional)">
          <input className="eingabe" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Jahresabrechnung" />
        </Feld>
        <div className="aktionen">
          {ablesung &&
            (loeschFrage ? (
              <span className="links" style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn gefahr"
                  onClick={() => {
                    ausfuehren(repo.ablesungLoeschen(ablesung.id), 'Ablesung gelöscht');
                    onClose();
                  }}
                >
                  Wirklich löschen
                </button>
                <button type="button" className="btn geist" onClick={() => setLoeschFrage(false)}>
                  Nein
                </button>
              </span>
            ) : (
              <button type="button" className="btn gefahr links" onClick={() => setLoeschFrage(true)}>
                Löschen
              </button>
            ))}
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn primaer" disabled={fehlerVorhanden}>
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}
