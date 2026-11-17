import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { AmortisationsDiagramm, EnergieDiagramm, JahresDiagramm, KostenDiagramm, PreisDiagramm } from '../charts/Diagramme';
import { Icon } from '../components/Icon';
import { Karte, Ring, Segment } from '../components/ui';
import { useApp } from '../kontext';
import {
  amortisation,
  clip,
  ersparnisReihe,
  jahresWerte,
  kennzahlen,
  kostenReihe,
  type Menge,
} from '../lib/calc';
import { heute, heuteTag, istGueltigesDatum, jahrBeginnTag, toTag } from '../lib/dates';
import { fmtDatum, fmtEur, fmtKwh, fmtProz } from '../lib/format';

type Zeitraum = 'jahr' | '12m' | 'gesamt' | 'eigen';
const ZR_SCHLUESSEL = 'strom-zeitraum';

function gespeicherterZeitraum(): Zeitraum {
  try {
    const z = localStorage.getItem(ZR_SCHLUESSEL);
    if (z === 'jahr' || z === '12m' || z === 'gesamt' || z === 'eigen') return z;
  } catch {
    /* ignorieren */
  }
  return 'jahr';
}

const monatJahr = (datum: string) =>
  new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date(`${datum}T12:00:00`));

function Kpi({
  label,
  farbe,
  children,
  unter,
}: {
  label: string;
  farbe: string;
  children: ReactNode;
  unter?: ReactNode;
}) {
  return (
    <div className="glas kpi" style={{ '--akzent': farbe } as CSSProperties}>
      <div className="kpi-kopf">
        <span className="kpi-punkt" />
        {label}
      </div>
      {children}
      {unter && <div className="kpi-unter">{unter}</div>}
    </div>
  );
}

function KwhKpi({ label, farbe, m }: { label: string; farbe: string; m?: Menge }) {
  return (
    <Kpi
      label={label}
      farbe={farbe}
      unter={
        m ? (
          <>
            <span>Ø {fmtKwh(m.kwh / m.tage, 2)} kWh/Tag</span>
            <span>{m.tage} Tage</span>
            {m.anteilig && <span className="badge-anteilig">anteilig</span>}
          </>
        ) : (
          <span>keine Daten im Zeitraum</span>
        )
      }
    >
      <div className="kpi-wert">
        {m ? fmtKwh(m.kwh, m.kwh >= 1000 ? 0 : 1) : '–'}
        <span className="einheit">kWh</span>
      </div>
    </Kpi>
  );
}

export function Dashboard() {
  const { daten, aw, navigiere, ablesungOeffnen } = useApp();
  const [zr, setZrRoh] = useState<Zeitraum>(gespeicherterZeitraum);
  const [eigenVon, setEigenVon] = useState(`${heute().slice(0, 4)}-01-01`);
  const [eigenBis, setEigenBis] = useState(heute());
  const setZr = (z: Zeitraum) => {
    setZrRoh(z);
    try {
      localStorage.setItem(ZR_SCHLUESSEL, z);
    } catch {
      /* ignorieren */
    }
  };

  const jahr = Number(heute().slice(0, 4));
  const [a, b] = useMemo((): [number, number] => {
    const h = heuteTag();
    if (zr === 'jahr') return [jahrBeginnTag(jahr), jahrBeginnTag(jahr + 1)];
    if (zr === '12m') return [h - 365, h + 1];
    if (zr === 'eigen' && istGueltigesDatum(eigenVon) && istGueltigesDatum(eigenBis))
      return [toTag(eigenVon), toTag(eigenBis) + 1];
    return [-Infinity, Infinity];
  }, [zr, jahr, eigenVon, eigenBis]);

  const k = useMemo(() => kennzahlen(aw, a, b), [aw, a, b]);
  const pe = useMemo(() => clip(aw.iv.pvEinsp, a, b), [aw, a, b]);
  const bz = useMemo(() => clip(aw.iv.bezug, a, b), [aw, a, b]);
  const kosten = useMemo(() => kostenReihe(clip(aw.iv.alle, a, b), aw.perioden), [aw, a, b]);
  const ersparnis = useMemo(() => ersparnisReihe(aw.iv.pvEinsp, aw.perioden), [aw]);
  const am = useMemo(
    () => amortisation(aw.iv.pvEinsp, aw.perioden, daten.anlage.anschaffungskostenEur),
    [aw, daten.anlage.anschaffungskostenEur],
  );
  const jahre = useMemo(() => jahresWerte(aw), [aw]);

  const hatAuswertung = Object.values(aw.iv).some((iv) => iv.length > 0);
  const tageSeit = aw.letzteAblesung ? heuteTag() - toTag(aw.letzteAblesung) : null;
  const status = tageSeit == null ? null : tageSeit < 35 ? 'ok' : tageSeit < 70 ? 'warn' : 'fehler';
  const seitText =
    tageSeit == null ? '' : tageSeit === 0 ? 'heute' : tageSeit === 1 ? 'gestern' : `vor ${tageSeit} Tagen`;

  const fehler = aw.hinweise.filter((h) => h.art === 'fehler');
  const warnungen = aw.hinweise.filter((h) => h.art === 'warnung');

  if (!hatAuswertung) {
    const schritte = [
      { erledigt: daten.tarife.length > 0, text: 'Stromtarif mit Gültigkeitsdatum anlegen', aktion: () => navigiere('tarife') },
      {
        erledigt: !!daten.anlage.anschaffungskostenEur,
        text: 'Anschaffungskosten der Anlage eintragen',
        aktion: () => navigiere('einstellungen'),
      },
      { erledigt: daten.ablesungen.length > 0, text: 'Erste Ablesung eintragen', aktion: () => ablesungOeffnen() },
      {
        erledigt: false,
        text: 'Zweite Ablesung, ab dann siehst du Auswertungen',
        aktion: () => ablesungOeffnen(),
      },
    ];
    return (
      <>
        <header className="seitenkopf">
          <div>
            <h1>Übersicht</h1>
            <p className="unter">Willkommen im Strom-Controlling</p>
          </div>
        </header>
        <Karte>
          <div className="leer-zustand">
            <span className="marke-logo" style={{ margin: '0 auto', width: 52, height: 52, borderRadius: 16 }}>
              <Icon name="blitz" size={28} />
            </span>
            <h2>In vier Schritten zur Auswertung</h2>
            <p className="text-muted">
              Du trägst ab und zu die Gesamtstände ein. Die App rechnet Erzeugung, Eigenverbrauch und Ersparnis daraus.
            </p>
            <div className="schritte">
              {schritte.map((s, i) => (
                <button
                  key={s.text}
                  type="button"
                  className={`schritt ${s.erledigt ? 'erledigt' : ''}`}
                  onClick={s.aktion}
                  style={{ cursor: 'pointer', width: '100%' }}
                >
                  <span className="schritt-nr">{s.erledigt ? <Icon name="haken" size={16} /> : i + 1}</span>
                  <span style={{ textAlign: 'left' }}>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        </Karte>
      </>
    );
  }

  return (
    <>
      <header className="seitenkopf">
        <div>
          <h1>Übersicht</h1>
          <p className="unter" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {aw.letzteAblesung && (
              <span className={`chip ${status}`}>
                <span className="led" /> Letzte Ablesung {seitText}
              </span>
            )}
            {daten.anlage.bezeichnung && <span>{daten.anlage.bezeichnung}</span>}
          </p>
        </div>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'end', maxWidth: '100%' }}>
          <Segment
            label="Zeitraum"
            wert={zr}
            onChange={setZr}
            optionen={[
              { wert: 'jahr', label: String(jahr) },
              { wert: '12m', label: '12 Monate' },
              { wert: 'gesamt', label: 'Gesamt' },
              { wert: 'eigen', label: 'Eigener' },
            ]}
          />
          {zr === 'eigen' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="eingabe"
                type="date"
                value={eigenVon}
                onChange={(e) => setEigenVon(e.target.value)}
                aria-label="Von"
                style={{ minHeight: 38, padding: '6px 10px' }}
              />
              <span className="text-muted">–</span>
              <input
                className="eingabe"
                type="date"
                value={eigenBis}
                onChange={(e) => setEigenBis(e.target.value)}
                aria-label="Bis"
                style={{ minHeight: 38, padding: '6px 10px' }}
              />
            </div>
          )}
        </div>
      </header>

      {(fehler.length > 0 || warnungen.length > 0) && (
        <details className="glas karte hinweise" open={fehler.length > 0}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            <span style={{ color: fehler.length ? 'var(--c-fehler)' : 'var(--c-warn)' }}>
              {fehler.length > 0 && `${fehler.length} ${fehler.length === 1 ? 'Fehler' : 'Fehler'}`}
              {fehler.length > 0 && warnungen.length > 0 && ' · '}
              {warnungen.length > 0 && `${warnungen.length} ${warnungen.length === 1 ? 'Hinweis' : 'Hinweise'}`}
            </span>{' '}
            <span className="text-muted klein">in deinen Daten</span>
          </summary>
          <div style={{ marginTop: 10 }}>
            {[...fehler, ...warnungen].slice(0, 8).map((h, i) => (
              <div key={i} className={`hinweis ${h.art}`}>
                <Icon name={h.art === 'fehler' ? 'warnung' : 'info'} size={16} />
                <span>{h.text}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="kpi-raster">
        <KwhKpi label="Erzeugung" farbe="var(--c-pv)" m={k.erzeugung} />
        <KwhKpi label="Eigenverbrauch" farbe="var(--c-ev)" m={k.eigenverbrauch} />
        <KwhKpi label="Einspeisung" farbe="var(--c-einsp)" m={k.einspeisung} />
        <KwhKpi label="Netzbezug" farbe="var(--c-bezug)" m={k.bezug} />

        <Kpi
          label="Ersparnis"
          farbe="var(--c-geld)"
          unter={
            k.ersparnis ? (
              <>
                <span>Ø {fmtEur((k.ersparnis.eur / k.ersparnis.tage) * 30.44)}/Monat</span>
                {k.ersparnis.ohneTarifKwh > 0.05 && (
                  <span style={{ color: 'var(--c-warn)' }}>{fmtKwh(k.ersparnis.ohneTarifKwh)} kWh ohne Tarif</span>
                )}
                {k.ersparnis.anteilig && <span className="badge-anteilig">anteilig</span>}
              </>
            ) : (
              <span>keine Daten im Zeitraum</span>
            )
          }
        >
          <div className="kpi-wert" style={{ color: 'var(--c-geld)' }}>
            {k.ersparnis ? fmtEur(k.ersparnis.eur) : '–'}
          </div>
        </Kpi>

        <Kpi label="EV-Quote" farbe="var(--c-ev)" unter={<span title="Eigenverbrauchsquote">vom PV-Strom selbst genutzt</span>}>
          <div className="kpi-ring">
            <Ring anteil={k.quote ?? 0} farbe="var(--c-ev)" />
            <div className="kpi-wert">{k.quote != null ? fmtProz(k.quote) : '–'}</div>
          </div>
        </Kpi>

        <Kpi label="Autarkie" farbe="var(--c-violett)" unter={<span>des Verbrauchs aus eigener PV</span>}>
          <div className="kpi-ring">
            <Ring anteil={k.autarkie ?? 0} farbe="var(--c-violett)" />
            <div className="kpi-wert">{k.autarkie != null ? fmtProz(k.autarkie) : '–'}</div>
          </div>
        </Kpi>

        <Kpi
          label="Amortisation"
          farbe="var(--c-geld)"
          unter={
            !am ? (
              <button className="btn geist klein" style={{ padding: 0, minHeight: 0 }} onClick={() => navigiere('einstellungen')}>
                Anschaffungskosten eintragen →
              </button>
            ) : am.amortisiertAm ? (
              <span style={{ color: 'var(--c-geld)' }}>amortisiert am {fmtDatum(am.amortisiertAm)}</span>
            ) : am.prognose ? (
              <span>
                Prognose: {monatJahr(am.prognose)}
                {am.unsicher && ' (unsicher, < 12 Monate Daten)'}
              </span>
            ) : (
              <span>noch keine Prognose möglich</span>
            )
          }
        >
          <div className="kpi-wert">{am ? fmtProz(am.anteil) : '–'}</div>
          {am && (
            <div className="balken">
              <span style={{ width: `${Math.min(100, am.anteil * 100)}%` }} />
            </div>
          )}
        </Kpi>
      </div>

      <div className="karten-raster">
        <Karte
          className="spanne-2"
          titel="Energiebilanz je Ableseintervall"
          unter="Tagesdurchschnitt pro Intervall. Breite = Dauer, Fläche = Menge. Tippen oder darüberfahren für Details."
        >
          <EnergieDiagramm pe={pe} bz={bz} />
        </Karte>

        <Karte
          titel="Amortisation"
          unter={
            am
              ? `${fmtEur(am.gespart)} von ${fmtEur(am.kosten)} eingespart · seit Beginn der Aufzeichnung`
              : 'Kumulierte Ersparnis seit Beginn der Aufzeichnung'
          }
        >
          <AmortisationsDiagramm reihe={ersparnis} am={am} />
        </Karte>

        <Karte titel="Stromkosten mit vs. ohne PV" unter="Kumuliert im gewählten Zeitraum">
          <KostenDiagramm reihe={kosten} />
        </Karte>

        <Karte className="spanne-2" titel="Jahresvergleich" unter="An Jahresgrenzen werden Intervalle tageweise anteilig aufgeteilt.">
          <JahresDiagramm jahre={jahre} />
        </Karte>

        <Karte className="spanne-2" titel="Strompreis-Verlauf" unter="Arbeitspreis brutto je Tarifzeitraum">
          <PreisDiagramm perioden={aw.perioden} />
        </Karte>
      </div>
    </>
  );
}
