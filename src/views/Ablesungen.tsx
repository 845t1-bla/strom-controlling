import { Fragment } from 'react';
import { Icon } from '../components/Icon';
import { Karte } from '../components/ui';
import { useApp } from '../kontext';
import { fmtDatum, fmtStand, ZAEHLER_KURZ } from '../lib/format';
import type { Ablesung, Zaehler, Zaehlerwechsel } from '../lib/types';
import { ZAEHLER } from '../lib/types';

export const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const FARBE: Record<Zaehler, string> = {
  pv: 'var(--c-pv)',
  bezug: 'var(--c-bezug)',
  einspeisung: 'var(--c-einsp)',
};

type Eintrag = { art: 'ablesung'; a: Ablesung } | { art: 'wechsel'; w: Zaehlerwechsel };

export function DatumsKachel({ datum }: { datum: string }) {
  const [, m, d] = datum.split('-');
  return (
    <div className="zeile-datum">
      <div>
        <b>{Number(d)}</b>
        <br />
        <small>{MONATE[Number(m) - 1]}</small>
      </div>
    </div>
  );
}

export function Ablesungen() {
  const { daten, aw, ablesungOeffnen, navigiere } = useApp();

  const eintraege: Eintrag[] = [
    ...daten.ablesungen.map((a) => ({ art: 'ablesung' as const, a })),
    ...daten.zaehlerwechsel.map((w) => ({ art: 'wechsel' as const, w })),
  ].sort((x, y) => {
    const dx = x.art === 'ablesung' ? x.a.datum : x.w.datum;
    const dy = y.art === 'ablesung' ? y.a.datum : y.w.datum;
    return dy.localeCompare(dx) || (x.art === 'wechsel' ? -1 : 1);
  });

  const fehlerJeAblesung = new Map<string, string[]>();
  for (const h of aw.hinweise) {
    if (h.ablesungId) fehlerJeAblesung.set(h.ablesungId, [...(fehlerJeAblesung.get(h.ablesungId) ?? []), h.text]);
  }

  let letztesJahr = '';
  return (
    <>
      <header className="seitenkopf">
        <div>
          <h1>Ablesungen</h1>
          <p className="unter">
            {daten.ablesungen.length} Ablesungen · Stände in kWh, kumuliert
          </p>
        </div>
        <button className="btn primaer" onClick={() => ablesungOeffnen()}>
          <Icon name="plus" /> Neue Ablesung
        </button>
      </header>

      {eintraege.length === 0 ? (
        <Karte>
          <div className="leer-zustand">
            <Icon name="liste" size={32} />
            <h2>Noch keine Ablesungen</h2>
            <p className="text-muted">
              Trage PV-Gesamtertrag und Zählerstände ein. Ältere Werte (z. B. aus Jahresabrechnungen) kannst du mit ihrem
              damaligen Datum nachtragen.
            </p>
          </div>
        </Karte>
      ) : (
        <div className="liste">
          {eintraege.map((e) => {
            const datum = e.art === 'ablesung' ? e.a.datum : e.w.datum;
            const jahr = datum.slice(0, 4);
            const trenner = jahr !== letztesJahr;
            letztesJahr = jahr;
            const key = e.art === 'ablesung' ? e.a.id : `w-${e.w.id}`;
            return (
              <Fragment key={key}>
                {trenner && <div className="jahr-trenner">{jahr}</div>}
                {e.art === 'ablesung' ? (
                  <button type="button" className="zeile" onClick={() => ablesungOeffnen(e.a)}>
                    <DatumsKachel datum={e.a.datum} />
                    <div style={{ minWidth: 0 }}>
                      <div className="werte">
                        {ZAEHLER.map((z) => (
                          <span key={z} className="wert-paar">
                            <i style={{ background: FARBE[z] }} />
                            <span className="text-muted">{ZAEHLER_KURZ[z]}</span>
                            {e.a[z] != null ? <b className="mono">{fmtStand(e.a[z] as number)}</b> : <span className="leer">–</span>}
                          </span>
                        ))}
                      </div>
                      {e.a.notiz && <div className="zeile-notiz">{e.a.notiz}</div>}
                      {fehlerJeAblesung.get(e.a.id)?.map((t) => (
                        <div key={t} className="zeile-notiz" style={{ color: 'var(--c-fehler)' }}>
                          {t}
                        </div>
                      ))}
                    </div>
                    <Icon name="stift" size={16} />
                  </button>
                ) : (
                  <button type="button" className="zeile" onClick={() => navigiere('einstellungen')}>
                    <DatumsKachel datum={e.w.datum} />
                    <div>
                      <div className="werte">
                        <span className="wert-paar">
                          <Icon name="tausch" size={15} />
                          <b>Zählerwechsel {ZAEHLER_KURZ[e.w.zaehler]}</b>
                        </span>
                      </div>
                      <div className="zeile-notiz">
                        Alt bis {fmtStand(e.w.endstandAlt)} · neu ab {fmtStand(e.w.startstandNeu)} · {fmtDatum(e.w.datum)}
                      </div>
                    </div>
                    <Icon name="zahnrad" size={16} />
                  </button>
                )}
              </Fragment>
            );
          })}
        </div>
      )}
    </>
  );
}
