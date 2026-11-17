import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Feld, Karte, Modal, ZahlEingabe } from '../components/ui';
import { neueId } from '../data/repo';
import { useApp } from '../kontext';
import { heute, heuteTag, istGueltigesDatum, tagZuDatum } from '../lib/dates';
import { fmtCt, fmtDatum, fmtEur, parseZahl, zahlZuEingabe } from '../lib/format';
import type { Tarif } from '../lib/types';

export function Tarife() {
  const { aw } = useApp();
  const [bearbeiten, setBearbeiten] = useState<Tarif | 'neu' | null>(null);
  const heute_ = heuteTag();
  const perioden = [...aw.perioden].reverse();

  return (
    <>
      <header className="seitenkopf">
        <div>
          <h1>Tarife</h1>
          <p className="unter">Jeder Tarif gilt ab seinem Datum bis zum Beginn des nächsten.</p>
        </div>
        <button className="btn primaer" onClick={() => setBearbeiten('neu')}>
          <Icon name="plus" /> Neuer Tarif
        </button>
      </header>

      {perioden.length === 0 ? (
        <Karte>
          <div className="leer-zustand">
            <Icon name="tarif" size={32} />
            <h2>Noch kein Tarif</h2>
            <p className="text-muted">
              Ohne Tarif kann die App keine Ersparnis berechnen. Lege deinen Strompreis mit dem Datum an, ab dem er gilt.
              Am besten nimmst du den ältesten Tarif, für den du Ablesungen hast.
            </p>
            <button className="btn primaer" onClick={() => setBearbeiten('neu')}>
              Tarif anlegen
            </button>
          </div>
        </Karte>
      ) : (
        <div className="liste">
          {perioden.map((p) => {
            const aktuell = p.vonTag <= heute_ && heute_ < p.bisTag;
            const bis = Number.isFinite(p.bisTag) ? fmtDatum(tagZuDatum(p.bisTag - 1)) : 'heute';
            return (
              <button key={p.tarif.id} type="button" className="zeile" onClick={() => setBearbeiten(p.tarif)}>
                <div className="zeile-datum" style={{ width: 'auto', padding: '0 12px' }}>
                  <div className="mono">
                    <b>{fmtCt(p.tarif.arbeitspreisCt)}</b>
                    <br />
                    <small>ct/kWh</small>
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="werte">
                    <b>
                      {fmtDatum(p.tarif.gueltigAb)} – {bis}
                    </b>
                    {aktuell && (
                      <span className="chip ok">
                        <span className="led" /> aktuell
                      </span>
                    )}
                  </div>
                  <div className="zeile-notiz">
                    Grundpreis {fmtEur(p.tarif.grundpreisEurMonat)}/Monat
                    {(p.tarif.anbieter || p.tarif.tarifname) &&
                      ` · ${[p.tarif.anbieter, p.tarif.tarifname].filter(Boolean).join(' · ')}`}
                  </div>
                </div>
                <Icon name="stift" size={16} />
              </button>
            );
          })}
        </div>
      )}
      {bearbeiten && <TarifModal tarif={bearbeiten === 'neu' ? undefined : bearbeiten} onClose={() => setBearbeiten(null)} />}
    </>
  );
}

function TarifModal({ tarif, onClose }: { tarif?: Tarif; onClose: () => void }) {
  const { daten, repo, ausfuehren } = useApp();
  const [gueltigAb, setGueltigAb] = useState(tarif?.gueltigAb ?? heute());
  const [ap, setAp] = useState(zahlZuEingabe(tarif?.arbeitspreisCt));
  const [gp, setGp] = useState(zahlZuEingabe(tarif?.grundpreisEurMonat));
  const [anbieter, setAnbieter] = useState(tarif?.anbieter ?? '');
  const [name, setName] = useState(tarif?.tarifname ?? '');
  const [loeschFrage, setLoeschFrage] = useState(false);

  const apZahl = parseZahl(ap);
  const gpZahl = parseZahl(gp);
  const datumFehler = !istGueltigesDatum(gueltigAb)
    ? 'Ungültiges Datum'
    : daten.tarife.some((t) => t.id !== tarif?.id && t.gueltigAb === gueltigAb)
      ? 'Ab diesem Datum gilt bereits ein anderer Tarif.'
      : undefined;
  const apFehler = apZahl === null ? 'Pflichtfeld' : Number.isNaN(apZahl) || apZahl <= 0 ? 'Keine gültige Zahl' : undefined;
  const gpFehler = gpZahl !== null && (Number.isNaN(gpZahl) || gpZahl < 0) ? 'Keine gültige Zahl' : undefined;
  const fehler = !!(datumFehler || apFehler || gpFehler);

  const ablesungAmStichtag = daten.ablesungen.some((a) => a.datum === gueltigAb && a.pv != null && a.einspeisung != null);
  const stichtagHilfe = datumFehler
    ? undefined
    : ablesungAmStichtag
      ? '✓ Am Stichtag gibt es eine Ablesung, die Aufteilung ist exakt.'
      : 'Tipp: Lies am Stichtag ab. Sonst wird das Intervall tageweise anteilig auf beide Tarife verteilt.';

  const speichern = () => {
    if (fehler) return;
    const neu: Tarif = {
      id: tarif?.id ?? neueId(),
      gueltigAb,
      arbeitspreisCt: apZahl as number,
      grundpreisEurMonat: (gpZahl as number | null) ?? 0,
      anbieter: anbieter.trim(),
      tarifname: name.trim(),
    };
    ausfuehren(repo.tarifSpeichern(neu), 'Tarif gespeichert');
    onClose();
  };

  return (
    <Modal titel={tarif ? 'Tarif bearbeiten' : 'Neuer Tarif'} onClose={onClose}>
      <form
        className="formular"
        onSubmit={(e) => {
          e.preventDefault();
          speichern();
        }}
      >
        <Feld label="Gültig ab" fehler={datumFehler} hilfe={stichtagHilfe}>
          <input className="eingabe" type="date" value={gueltigAb} onChange={(e) => setGueltigAb(e.target.value)} />
        </Feld>
        <div className="zwei-spalten">
          <Feld label="Arbeitspreis (brutto)" fehler={apFehler !== 'Pflichtfeld' ? apFehler : undefined}>
            <ZahlEingabe wert={ap} onChange={setAp} einheit="ct/kWh" placeholder="31,4" />
          </Feld>
          <Feld label="Grundpreis (brutto)" fehler={gpFehler}>
            <ZahlEingabe wert={gp} onChange={setGp} einheit="€/Mon." placeholder="13,95" />
          </Feld>
        </div>
        <div className="zwei-spalten">
          <Feld label="Anbieter">
            <input className="eingabe" value={anbieter} onChange={(e) => setAnbieter(e.target.value)} />
          </Feld>
          <Feld label="Tarifname">
            <input className="eingabe" value={name} onChange={(e) => setName(e.target.value)} />
          </Feld>
        </div>
        <div className="aktionen">
          {tarif &&
            (loeschFrage ? (
              <span className="links" style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn gefahr"
                  onClick={() => {
                    ausfuehren(repo.tarifLoeschen(tarif.id), 'Tarif gelöscht');
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
          <button type="submit" className="btn primaer" disabled={fehler}>
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}
