import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Feld, Karte, Modal, Segment, ZahlEingabe } from '../components/ui';
import { neueId } from '../data/repo';
import { useApp } from '../kontext';
import { backupJson, backupLesen, csvAblesungen, csvIntervalle, herunterladen } from '../lib/backup';
import { heute, istGueltigesDatum } from '../lib/dates';
import { fmtDatum, fmtStand, parseZahl, ZAEHLER_KURZ, ZAEHLER_LABEL, zahlZuEingabe } from '../lib/format';
import type { Daten, Zaehler, Zaehlerwechsel } from '../lib/types';
import { ZAEHLER } from '../lib/types';
import { DatumsKachel } from './Ablesungen';

export function Einstellungen() {
  const { daten, aw, repo, ausfuehren, theme, setTheme, backend, nutzer, toast } = useApp();
  const [wechselModal, setWechselModal] = useState<Zaehlerwechsel | 'neu' | null>(null);
  const [wiederherstellen, setWiederherstellen] = useState<Daten | null>(null);
  const dateiRef = useRef<HTMLInputElement>(null);

  const stempel = heute();
  const wechsel = [...daten.zaehlerwechsel].sort((a, b) => b.datum.localeCompare(a.datum));

  const dateiGewaehlt = async (f: File | undefined) => {
    if (!f) return;
    try {
      setWiederherstellen(backupLesen(await f.text()));
    } catch (e) {
      toast((e as Error).message, 'fehler');
    } finally {
      if (dateiRef.current) dateiRef.current.value = '';
    }
  };

  return (
    <>
      <header className="seitenkopf">
        <div>
          <h1>Einstellungen</h1>
          <p className="unter">Anlage, Zählerwechsel, Darstellung und Datensicherung</p>
        </div>
      </header>

      <div className="einstellungen">
        <AnlageKarte key={JSON.stringify(daten.anlage)} />

        <Karte
          titel="Zählerwechsel"
          unter="Wenn ein Zähler neu bei 0 beginnt (Zählertausch, neuer Wechselrichter)"
          rechts={
            <button className="btn klein" onClick={() => setWechselModal('neu')}>
              <Icon name="plus" size={16} /> Erfassen
            </button>
          }
        >
          {wechsel.length === 0 ? (
            <p className="text-muted klein" style={{ margin: 0 }}>
              Keine Zählerwechsel erfasst.
            </p>
          ) : (
            <div className="liste">
              {wechsel.map((w) => (
                <button key={w.id} type="button" className="zeile" onClick={() => setWechselModal(w)}>
                  <DatumsKachel datum={w.datum} />
                  <div>
                    <b>{ZAEHLER_LABEL[w.zaehler]}</b>
                    <div className="zeile-notiz">
                      {fmtDatum(w.datum)} · alt bis {fmtStand(w.endstandAlt)} · neu ab {fmtStand(w.startstandNeu)}
                    </div>
                  </div>
                  <Icon name="stift" size={16} />
                </button>
              ))}
            </div>
          )}
        </Karte>

        <Karte titel="Darstellung">
          <Segment
            label="Farbschema"
            wert={theme}
            onChange={setTheme}
            optionen={[
              { wert: 'dark', label: 'Dunkel' },
              { wert: 'light', label: 'Hell' },
            ]}
          />
          <p className="klein text-muted" style={{ marginBottom: 0 }}>
            Wird pro Gerät gespeichert.
          </p>
        </Karte>

        <Karte titel="Datensicherung" unter="Lade regelmäßig ein Backup herunter, z. B. nach jeder 10. Ablesung.">
          <div style={{ display: 'grid', gap: 10 }}>
            <button
              className="btn"
              onClick={() => herunterladen(`strom-backup-${stempel}.json`, backupJson(daten), 'application/json')}
            >
              <Icon name="download" /> Backup herunterladen (JSON)
            </button>
            <button className="btn" onClick={() => dateiRef.current?.click()}>
              <Icon name="upload" /> Backup einspielen …
            </button>
            <input
              ref={dateiRef}
              type="file"
              accept="application/json,.json"
              className="versteckt"
              onChange={(e) => dateiGewaehlt(e.target.files?.[0])}
            />
            <div className="trenner" style={{ margin: '4px 0' }} />
            <button
              className="btn"
              onClick={() => herunterladen(`strom-ablesungen-${stempel}.csv`, csvAblesungen(daten), 'text/csv;charset=utf-8')}
            >
              <Icon name="download" /> Ablesungen als CSV (Excel)
            </button>
            <button
              className="btn"
              onClick={() => herunterladen(`strom-intervalle-${stempel}.csv`, csvIntervalle(aw), 'text/csv;charset=utf-8')}
            >
              <Icon name="download" /> Ausgewertete Intervalle als CSV
            </button>
          </div>
        </Karte>

        <Karte titel="Konto">
          <p style={{ marginTop: 0 }}>
            {backend.modus === 'demo' ? 'Demo-Modus (ohne Login)' : <>Angemeldet als <b>{nutzer.email}</b></>}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {backend.modus === 'firebase' && (
              <button className="btn" onClick={() => backend.auth.abmelden()}>
                <Icon name="abmelden" /> Abmelden
              </button>
            )}
            {backend.zuruecksetzen && (
              <button className="btn" onClick={() => backend.zuruecksetzen?.()}>
                Beispieldaten zurücksetzen
              </button>
            )}
          </div>
        </Karte>

        <Karte titel="Ablese-Tipps">
          <ul className="klein text-muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>Alle drei Werte möglichst gleichzeitig ablesen, ideal abends nach Sonnenuntergang.</li>
            <li>Bei Tarifwechsel am Stichtag ablesen, dann wird exakt statt anteilig aufgeteilt.</li>
            <li>Kurze Abstände (2–4 Wochen) machen die Diagramme aussagekräftiger.</li>
            <li>Fehlt ein Wert, einfach leer lassen. Die App rechnet nur, was sich ableiten lässt.</li>
          </ul>
        </Karte>
      </div>

      {wechselModal && (
        <WechselModal wechsel={wechselModal === 'neu' ? undefined : wechselModal} onClose={() => setWechselModal(null)} />
      )}
      {wiederherstellen && (
        <Modal titel="Backup einspielen?" onClose={() => setWiederherstellen(null)}>
          <p style={{ marginTop: 0 }}>
            Alle aktuellen Daten werden durch die Sicherung <b>ersetzt</b>:
          </p>
          <table className="tabelle">
            <thead>
              <tr>
                <th />
                <th className="num">Aktuell</th>
                <th className="num">Sicherung</th>
              </tr>
            </thead>
            <tbody>
              {(['ablesungen', 'tarife', 'zaehlerwechsel'] as const).map((k) => (
                <tr key={k}>
                  <td>{{ ablesungen: 'Ablesungen', tarife: 'Tarife', zaehlerwechsel: 'Zählerwechsel' }[k]}</td>
                  <td className="num">{daten[k].length}</td>
                  <td className="num">{wiederherstellen[k].length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="klein text-muted">Tipp: Lade vorher ein Backup des aktuellen Stands herunter.</p>
          <div className="aktionen">
            <button className="btn" onClick={() => setWiederherstellen(null)}>
              Abbrechen
            </button>
            <button
              className="btn gefahr"
              onClick={() => {
                ausfuehren(repo.allesErsetzen(wiederherstellen), 'Backup eingespielt');
                setWiederherstellen(null);
              }}
            >
              Ersetzen
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function AnlageKarte() {
  const { daten, repo, ausfuehren } = useApp();
  const [bezeichnung, setBezeichnung] = useState(daten.anlage.bezeichnung ?? '');
  const [kosten, setKosten] = useState(zahlZuEingabe(daten.anlage.anschaffungskostenEur));
  const [inbetrieb, setInbetrieb] = useState(daten.anlage.inbetriebnahme ?? '');

  const kostenZahl = parseZahl(kosten);
  const kostenFehler = kostenZahl !== null && (Number.isNaN(kostenZahl) || kostenZahl < 0) ? 'Keine gültige Zahl' : undefined;
  const datumFehler = inbetrieb && !istGueltigesDatum(inbetrieb) ? 'Ungültiges Datum' : undefined;

  return (
    <Karte titel="Anlage" unter="Für die Amortisationsrechnung">
      <form
        className="formular"
        onSubmit={(e) => {
          e.preventDefault();
          if (kostenFehler || datumFehler) return;
          ausfuehren(
            repo.anlageSpeichern({
              bezeichnung: bezeichnung.trim(),
              anschaffungskostenEur: kostenZahl as number | null,
              inbetriebnahme: inbetrieb || null,
            }),
            'Anlage gespeichert',
          );
        }}
      >
        <Feld label="Bezeichnung">
          <input className="eingabe" value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)} placeholder="z. B. Balkonkraftwerk 800 W" />
        </Feld>
        <div className="zwei-spalten">
          <Feld label="Anschaffungskosten" fehler={kostenFehler} hilfe="inkl. Montage/Zubehör">
            <ZahlEingabe wert={kosten} onChange={setKosten} einheit="€" placeholder="649" />
          </Feld>
          <Feld label="Inbetriebnahme" fehler={datumFehler}>
            <input className="eingabe" type="date" value={inbetrieb} onChange={(e) => setInbetrieb(e.target.value)} />
          </Feld>
        </div>
        <div className="aktionen">
          <button type="submit" className="btn primaer" disabled={!!(kostenFehler || datumFehler)}>
            Speichern
          </button>
        </div>
      </form>
    </Karte>
  );
}

function WechselModal({ wechsel, onClose }: { wechsel?: Zaehlerwechsel; onClose: () => void }) {
  const { repo, ausfuehren } = useApp();
  const [zaehler, setZaehler] = useState<Zaehler>(wechsel?.zaehler ?? 'bezug');
  const [datum, setDatum] = useState(wechsel?.datum ?? heute());
  const [alt, setAlt] = useState(zahlZuEingabe(wechsel?.endstandAlt));
  const [neu, setNeu] = useState(zahlZuEingabe(wechsel?.startstandNeu ?? 0));
  const [loeschFrage, setLoeschFrage] = useState(false);

  const altZahl = parseZahl(alt);
  const neuZahl = parseZahl(neu);
  const ungueltig = (v: number | null) => (v === null ? 'Pflichtfeld' : Number.isNaN(v) || v < 0 ? 'Keine gültige Zahl' : undefined);
  const datumFehler = istGueltigesDatum(datum) ? undefined : 'Ungültiges Datum';
  const fehler = !!(datumFehler || ungueltig(altZahl) || ungueltig(neuZahl));

  return (
    <Modal titel={wechsel ? 'Zählerwechsel bearbeiten' : 'Zählerwechsel erfassen'} onClose={onClose}>
      <form
        className="formular"
        onSubmit={(e) => {
          e.preventDefault();
          if (fehler) return;
          ausfuehren(
            repo.wechselSpeichern({
              id: wechsel?.id ?? neueId(),
              datum,
              zaehler,
              endstandAlt: altZahl as number,
              startstandNeu: neuZahl as number,
            }),
            'Zählerwechsel gespeichert',
          );
          onClose();
        }}
      >
        <Feld label="Zähler">
          <select className="eingabe" value={zaehler} onChange={(e) => setZaehler(e.target.value as Zaehler)}>
            {ZAEHLER.map((z) => (
              <option key={z} value={z}>
                {ZAEHLER_LABEL[z]}
              </option>
            ))}
          </select>
        </Feld>
        <Feld label="Datum des Wechsels" fehler={datumFehler} hilfe="Ablesungen ab diesem Tag gehören zum neuen Zähler.">
          <input className="eingabe" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </Feld>
        <div className="zwei-spalten">
          <Feld label={`Endstand alter ${ZAEHLER_KURZ[zaehler]}-Zähler`} fehler={ungueltig(altZahl) !== 'Pflichtfeld' ? ungueltig(altZahl) : undefined}>
            <ZahlEingabe wert={alt} onChange={setAlt} einheit="kWh" />
          </Feld>
          <Feld label="Startstand neuer Zähler" fehler={ungueltig(neuZahl) !== 'Pflichtfeld' ? ungueltig(neuZahl) : undefined}>
            <ZahlEingabe wert={neu} onChange={setNeu} einheit="kWh" />
          </Feld>
        </div>
        <div className="aktionen">
          {wechsel &&
            (loeschFrage ? (
              <span className="links" style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn gefahr"
                  onClick={() => {
                    ausfuehren(repo.wechselLoeschen(wechsel.id), 'Zählerwechsel gelöscht');
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
