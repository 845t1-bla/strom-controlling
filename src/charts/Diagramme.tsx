import type { ActiveElement, Chart, ChartEvent, Plugin, TooltipItem } from 'chart.js';
import { useState } from 'react';
import { useApp } from '../kontext';
import type { Amortisation, Intervall, JahresWert, KostenPunkt, ReihenPunkt, TarifPeriode } from '../lib/calc';
import { wert } from '../lib/calc';
import { heuteTag, lokalMsZuTag, tagZuDatum, tagZuLokalMs, toTag } from '../lib/dates';
import { fmtCt, fmtDatum, fmtEur, fmtKwh } from '../lib/format';
import { achse, rgba, tooltipStil, useChart, verlauf, zeitAchse } from './setup';

type Pkt = { x: number; y: number };

/** Stufenpunkte: Wert gilt ab Intervallbeginn bis zum nächsten Punkt (Chart.js stepped: 'before'). */
function stufen(iv: Intervall[], fn: (i: Intervall) => number, vorzeichen = 1): Pkt[] {
  if (!iv.length) return [];
  const pts = iv.map((i) => ({ x: tagZuLokalMs(i.vonTag), y: (vorzeichen * fn(i)) / i.tage }));
  pts.push({ x: tagZuLokalMs(iv[iv.length - 1].bisTag), y: 0 });
  return pts;
}

function Legende({ eintraege }: { eintraege: { farbe: string; label: string; gestrichelt?: boolean }[] }) {
  return (
    <div className="legende">
      {eintraege.map((e) => (
        <span key={e.label}>
          <i
            style={
              e.gestrichelt
                ? { background: 'transparent', borderTop: `2px dashed ${e.farbe}`, height: 0, width: 14, borderRadius: 0 }
                : { background: e.farbe }
            }
          />
          {e.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Energiebilanz: kWh/Tag je echtem Ableseintervall

export function EnergieDiagramm({ pe, bz }: { pe: Intervall[]; bz: Intervall[] }) {
  const { theme } = useApp();
  const [hoverTag, setHoverTag] = useState<number | null>(null);

  const ref = useChart(
    (f) => {
      if (!pe.length && !bz.length) return null;
      let linieX: number | null = null;
      const linie: Plugin<'line'> = {
        id: 'hoverLinie',
        afterDatasetsDraw(chart) {
          if (linieX == null) return;
          const { ctx, chartArea } = chart;
          ctx.save();
          ctx.strokeStyle = rgba(f.text.startsWith('#') ? f.text : '#b4bcd8', 0.5);
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(linieX, chartArea.top);
          ctx.lineTo(linieX, chartArea.bottom);
          ctx.stroke();
          ctx.restore();
        },
      };
      const gemeinsam = { stepped: 'before' as const, pointRadius: 0, pointHitRadius: 0, borderWidth: 1.6, tension: 0 };
      return {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Eigenverbrauch',
              data: stufen(pe, wert.eigenverbrauch),
              borderColor: f.ev,
              backgroundColor: verlauf(f.ev, 0.55, 0.12),
              fill: 'origin',
              stack: 'erzeugung',
              ...gemeinsam,
            },
            {
              label: 'Einspeisung',
              data: stufen(pe, wert.einspeisung),
              borderColor: f.einsp,
              backgroundColor: verlauf(f.einsp, 0.45, 0.08),
              fill: '-1',
              stack: 'erzeugung',
              ...gemeinsam,
            },
            {
              label: 'Netzbezug',
              data: stufen(bz, wert.bezug, -1),
              borderColor: f.bezug,
              backgroundColor: verlauf(f.bezug, 0.45, 0.05, true),
              fill: 'origin',
              stack: 'netz',
              ...gemeinsam,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 350 },
          parsing: false,
          normalized: true,
          interaction: { mode: 'nearest', intersect: false },
          events: ['mousemove', 'mouseout', 'touchstart', 'touchmove', 'click'],
          onHover: (evt: ChartEvent, _els: ActiveElement[], chart: Chart) => {
            if (evt.type === 'mouseout' || evt.x == null) {
              linieX = null;
              setHoverTag(null);
            } else {
              const ms = chart.scales.x.getValueForPixel(evt.x);
              if (ms == null) return;
              linieX = evt.x;
              setHoverTag(lokalMsZuTag(ms));
            }
            chart.draw();
          },
          plugins: { tooltip: { enabled: false }, legend: { display: false } },
          scales: {
            x: zeitAchse(f),
            y: {
              stacked: true,
              ...achse(f),
              ticks: { ...achse(f).ticks, callback: (v: number | string) => fmtKwh(Math.abs(Number(v)), 1) },
              title: { display: true, text: 'kWh / Tag', color: f.muted },
            },
          },
        },
        plugins: [linie],
      } as never;
    },
    [pe, bz, theme],
  );

  const finde = (iv: Intervall[], tag: number | null) =>
    tag == null ? iv[iv.length - 1] : iv.find((i) => i.vonTag <= tag && tag < i.bisTag);
  const ip = finde(pe, hoverTag);
  const ib = finde(bz, hoverTag);

  return (
    <>
      <Legende
        eintraege={[
          { farbe: 'var(--c-ev)', label: 'Eigenverbrauch' },
          { farbe: 'var(--c-einsp)', label: 'Einspeisung' },
          { farbe: 'var(--c-bezug)', label: 'Netzbezug (nach unten)' },
        ]}
      />
      <div className="diagramm hoch" style={{ marginTop: 10 }}>
        <canvas ref={ref} role="img" aria-label="Energiebilanz je Ableseintervall in kWh pro Tag" />
      </div>
      <div className="info-leiste">
        {!ip && !ib && <span className="text-muted">Kein Intervall an dieser Stelle</span>}
        {ip && (
          <>
            <b>
              {fmtDatum(ip.von)} – {fmtDatum(tagZuDatum(ip.bisTag - 1))}
            </b>
            <span className="text-muted">{ip.tage} Tage</span>
            {ip.anteilig && <span className="badge-anteilig">anteilig</span>}
            <span>
              <span style={{ color: 'var(--c-pv)' }}>Erzeugung</span> {fmtKwh(wert.erzeugung(ip))} kWh
              <span className="text-muted"> ({fmtKwh(wert.erzeugung(ip) / ip.tage, 2)}/Tag)</span>
            </span>
            <span>
              <span style={{ color: 'var(--c-ev)' }}>EV</span> {fmtKwh(wert.eigenverbrauch(ip))}
            </span>
            <span>
              <span style={{ color: 'var(--c-einsp)' }}>Einsp.</span> {fmtKwh(wert.einspeisung(ip))}
            </span>
          </>
        )}
        {ib && (
          <span>
            <span style={{ color: 'var(--c-bezug)' }}>Netzbezug</span> {fmtKwh(wert.bezug(ib))} kWh
            <span className="text-muted"> ({fmtKwh(wert.bezug(ib) / ib.tage, 2)}/Tag)</span>
            {(!ip || ib.von !== ip.von || ib.bis !== ip.bis) && (
              <span className="text-muted">
                {' '}
                · {fmtDatum(ib.von)} – {fmtDatum(tagZuDatum(ib.bisTag - 1))}
              </span>
            )}
          </span>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Amortisation: kumulierte Ersparnis vs. Anschaffungskosten

export function AmortisationsDiagramm({ reihe, am }: { reihe: ReihenPunkt[]; am: Amortisation | null }) {
  const { theme } = useApp();
  const ref = useChart(
    (f) => {
      if (reihe.length < 2) return null;
      const pts = reihe.map((p) => ({ x: tagZuLokalMs(p.tag), y: p.wert }));
      const letzter = pts[pts.length - 1];
      const prognoseX = am?.prognose ? tagZuLokalMs(toTag(am.prognose)) : null;
      const endeX = Math.max(letzter.x, prognoseX ?? 0);
      const datasets: object[] = [
        {
          label: 'Ersparnis kumuliert',
          data: pts,
          borderColor: f.geld,
          backgroundColor: verlauf(f.geld, 0.35, 0.02),
          fill: 'origin',
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.15,
        },
      ];
      if (am) {
        datasets.push({
          label: 'Anschaffungskosten',
          data: [
            { x: pts[0].x, y: am.kosten },
            { x: endeX, y: am.kosten },
          ],
          borderColor: f.muted,
          borderDash: [6, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        });
        if (prognoseX) {
          datasets.push({
            label: 'Prognose',
            data: [letzter, { x: prognoseX, y: am.kosten }],
            borderColor: f.geld,
            borderDash: [3, 5],
            borderWidth: 2,
            pointRadius: [0, 4],
            pointBackgroundColor: f.geld,
            fill: false,
          });
        }
      }
      return {
        type: 'line',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 350 },
          interaction: { mode: 'nearest', intersect: false, axis: 'x' },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipStil(f),
              callbacks: { label: (c: TooltipItem<'line'>) => ` ${c.dataset.label}: ${fmtEur(Number(c.parsed.y))}` },
            },
          },
          scales: {
            x: zeitAchse(f),
            y: {
              ...achse(f),
              beginAtZero: true,
              ticks: { ...achse(f).ticks, callback: (v: number | string) => fmtEur(Number(v)).replace(',00', '') },
            },
          },
        },
      } as never;
    },
    [reihe, am, theme],
  );
  if (reihe.length < 2) return <p className="text-muted klein">Noch zu wenige Ablesungen mit PV- und Einspeisewert.</p>;
  return (
    <>
      <Legende
        eintraege={[
          { farbe: 'var(--c-geld)', label: 'Ersparnis kumuliert' },
          ...(am ? [{ farbe: 'var(--muted)', label: 'Anschaffungskosten', gestrichelt: true }] : []),
          ...(am?.prognose ? [{ farbe: 'var(--c-geld)', label: 'Prognose', gestrichelt: true }] : []),
        ]}
      />
      <div className="diagramm" style={{ marginTop: 10 }}>
        <canvas ref={ref} role="img" aria-label="Kumulierte Ersparnis und Anschaffungskosten" />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Kosten mit vs. ohne PV

export function KostenDiagramm({ reihe }: { reihe: KostenPunkt[] }) {
  const { theme } = useApp();
  const ref = useChart(
    (f) => {
      if (reihe.length < 2) return null;
      return {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Ohne PV (fiktiv)',
              data: reihe.map((p) => ({ x: tagZuLokalMs(p.tag), y: p.ohnePv })),
              borderColor: f.violett,
              borderDash: [6, 4],
              borderWidth: 1.8,
              pointRadius: 0,
              fill: false,
            },
            {
              label: 'Mit PV (tatsächlich)',
              data: reihe.map((p) => ({ x: tagZuLokalMs(p.tag), y: p.mitPv })),
              borderColor: f.bezug,
              borderWidth: 2,
              pointRadius: 0,
              fill: { target: 0, above: rgba(f.bezug, 0.1), below: rgba(f.geld, 0.22) },
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 350 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipStil(f),
              callbacks: { label: (c: TooltipItem<'line'>) => ` ${c.dataset.label}: ${fmtEur(Number(c.parsed.y))}` },
            },
          },
          scales: {
            x: zeitAchse(f),
            y: {
              ...achse(f),
              beginAtZero: true,
              ticks: { ...achse(f).ticks, callback: (v: number | string) => fmtEur(Number(v)).replace(',00', '') },
            },
          },
        },
      } as never;
    },
    [reihe, theme],
  );
  if (reihe.length < 2)
    return <p className="text-muted klein">Dafür braucht es mindestens zwei vollständige Ablesungen und einen Tarif.</p>;
  const letzter = reihe[reihe.length - 1];
  return (
    <>
      <Legende
        eintraege={[
          { farbe: 'var(--c-violett)', label: 'Ohne PV (fiktiv)', gestrichelt: true },
          { farbe: 'var(--c-bezug)', label: 'Mit PV' },
          { farbe: 'var(--c-geld)', label: 'Differenz = Ersparnis' },
        ]}
      />
      <div className="diagramm" style={{ marginTop: 10 }}>
        <canvas ref={ref} role="img" aria-label="Kumulierte Stromkosten mit und ohne PV" />
      </div>
      <div className="info-leiste">
        <span>
          Mit PV <b>{fmtEur(letzter.mitPv)}</b>
        </span>
        <span>
          Ohne PV <b>{fmtEur(letzter.ohnePv)}</b>
        </span>
        <span style={{ color: 'var(--c-geld)' }}>
          Differenz <b>{fmtEur(letzter.ohnePv - letzter.mitPv)}</b>
        </span>
        <span className="text-muted">inkl. Grundpreis, nur Zeiträume mit allen drei Werten</span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Jahresvergleich

export function JahresDiagramm({ jahre }: { jahre: JahresWert[] }) {
  const { theme } = useApp();
  const ref = useChart(
    (f) => {
      if (!jahre.length) return null;
      const ds = (label: string, farbe: string, werte: (number | undefined)[]) => ({
        label,
        data: werte.map((v) => v ?? null),
        backgroundColor: rgba(farbe, 0.75),
        borderColor: farbe,
        borderWidth: 1,
        borderRadius: 6,
        maxBarThickness: 34,
      });
      return {
        type: 'bar',
        data: {
          labels: jahre.map((j) => String(j.jahr)),
          datasets: [
            ds('Erzeugung', f.pv, jahre.map((j) => j.erzeugung?.kwh)),
            ds('Eigenverbrauch', f.ev, jahre.map((j) => j.eigenverbrauch?.kwh)),
            ds('Einspeisung', f.einsp, jahre.map((j) => j.einspeisung?.kwh)),
            ds('Netzbezug', f.bezug, jahre.map((j) => j.bezug?.kwh)),
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 350 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipStil(f),
              callbacks: { label: (c: TooltipItem<'line'>) => ` ${c.dataset.label}: ${fmtKwh(Number(c.parsed.y), 0)} kWh` },
            },
          },
          scales: {
            x: { ...achse(f), grid: { display: false } },
            y: { ...achse(f), beginAtZero: true, title: { display: true, text: 'kWh', color: f.muted } },
          },
        },
      } as never;
    },
    [jahre, theme],
  );
  if (!jahre.length) return <p className="text-muted klein">Noch keine Daten.</p>;
  const pct = (v?: number) => (v == null ? '–' : `${Math.round(v * 100)} %`);
  return (
    <>
      <Legende
        eintraege={[
          { farbe: 'var(--c-pv)', label: 'Erzeugung' },
          { farbe: 'var(--c-ev)', label: 'Eigenverbrauch' },
          { farbe: 'var(--c-einsp)', label: 'Einspeisung' },
          { farbe: 'var(--c-bezug)', label: 'Netzbezug' },
        ]}
      />
      <div className="diagramm" style={{ marginTop: 10 }}>
        <canvas ref={ref} role="img" aria-label="Jahresvergleich der Energiemengen" />
      </div>
      <div className="tabelle-wrap">
        <table className="tabelle">
          <thead>
            <tr>
              <th>Jahr</th>
              <th className="num">Erzeugung</th>
              <th className="num">Ersparnis</th>
              <th className="num">EV-Quote</th>
              <th className="num">Autarkie</th>
              <th className="num">Netzbezug</th>
              <th>PV-Daten</th>
            </tr>
          </thead>
          <tbody>
            {[...jahre].reverse().map((j) => (
              <tr key={j.jahr}>
                <td>
                  <b>{j.jahr}</b>
                </td>
                <td className="num">{j.erzeugung ? `${fmtKwh(j.erzeugung.kwh, 0)} kWh` : '–'}</td>
                <td className="num" style={{ color: 'var(--c-geld)' }}>
                  {j.ersparnis ? fmtEur(j.ersparnis.eur) : '–'}
                </td>
                <td className="num">{pct(j.quote)}</td>
                <td className="num">{pct(j.autarkie)}</td>
                <td className="num">{j.bezug ? `${fmtKwh(j.bezug.kwh, 0)} kWh` : '–'}</td>
                <td className="text-muted">
                  {j.abdeckungTage === 0
                    ? 'keine'
                    : j.abdeckungTage >= j.tageImJahr
                      ? 'ganzes Jahr'
                      : `${j.abdeckungTage} von ${j.tageImJahr} Tagen`}
                  {(j.erzeugung?.anteilig || j.bezug?.anteilig) && (
                    <>
                      {' '}
                      <span className="badge-anteilig">anteilig</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Strompreis-Verlauf

export function PreisDiagramm({ perioden }: { perioden: TarifPeriode[] }) {
  const { theme } = useApp();
  const ref = useChart(
    (f) => {
      if (!perioden.length) return null;
      const pts = perioden.map((p) => ({ x: tagZuLokalMs(p.vonTag), y: p.tarif.arbeitspreisCt }));
      const letzte = perioden[perioden.length - 1];
      pts.push({ x: tagZuLokalMs(Math.max(heuteTag(), letzte.vonTag + 30)), y: letzte.tarif.arbeitspreisCt });
      return {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Arbeitspreis',
              data: pts,
              stepped: 'before',
              borderColor: f.pv,
              backgroundColor: verlauf(f.pv, 0.3, 0.02),
              fill: 'origin',
              borderWidth: 2,
              pointRadius: pts.map((_, k) => (k < pts.length - 1 ? 3 : 0)),
              pointBackgroundColor: f.pv,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 350 },
          interaction: { mode: 'nearest', intersect: false, axis: 'x' },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipStil(f),
              callbacks: {
                label: (c: TooltipItem<'line'>) => {
                  const p = perioden[Math.min(c.dataIndex, perioden.length - 1)];
                  return [
                    ` ${fmtCt(p.tarif.arbeitspreisCt)} ct/kWh`,
                    ` Grundpreis ${fmtEur(p.tarif.grundpreisEurMonat)}/Monat`,
                    ...(p.tarif.anbieter ? [` ${p.tarif.anbieter}`] : []),
                  ];
                },
              },
            },
          },
          scales: {
            x: zeitAchse(f),
            y: {
              ...achse(f),
              beginAtZero: true,
              title: { display: true, text: 'ct/kWh', color: f.muted },
            },
          },
        },
      } as never;
    },
    [perioden, theme],
  );
  if (!perioden.length) return <p className="text-muted klein">Noch kein Tarif angelegt.</p>;
  return (
    <div className="diagramm">
      <canvas ref={ref} role="img" aria-label="Verlauf des Arbeitspreises" />
    </div>
  );
}
