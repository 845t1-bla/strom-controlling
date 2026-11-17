import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  TimeScale,
  Tooltip,
  type ChartConfiguration,
  type ScriptableContext,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { de } from 'date-fns/locale';
import { useEffect, useRef } from 'react';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  LinearScale,
  TimeScale,
  CategoryScale,
  Filler,
  Tooltip,
);
Chart.defaults.font.family =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', Inter, Roboto, system-ui, sans-serif";
Chart.defaults.font.size = 11;

export const DATUM_ADAPTER = { date: { locale: de } };

export interface Farben {
  pv: string;
  ev: string;
  einsp: string;
  bezug: string;
  geld: string;
  violett: string;
  text: string;
  muted: string;
  grid: string;
  bg: string;
}

export function farben(): Farben {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    pv: v('--c-pv'),
    ev: v('--c-ev'),
    einsp: v('--c-einsp'),
    bezug: v('--c-bezug'),
    geld: v('--c-geld'),
    violett: v('--c-violett'),
    text: v('--text-2'),
    muted: v('--muted'),
    grid: v('--grid'),
    bg: v('--bg'),
  };
}

export function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Vertikaler Farbverlauf für Flächen; `nachUnten` = Fläche unterhalb der Nulllinie. */
export function verlauf(farbe: string, stark = 0.5, schwach = 0.03, nachUnten = false) {
  return (ctx: ScriptableContext<'line'>) => {
    const { chart } = ctx;
    const bereich = chart.chartArea;
    if (!bereich) return rgba(farbe, stark);
    const g = chart.ctx.createLinearGradient(0, bereich.top, 0, bereich.bottom);
    g.addColorStop(0, rgba(farbe, nachUnten ? schwach : stark));
    g.addColorStop(1, rgba(farbe, nachUnten ? stark : schwach));
    return g;
  };
}

export function tooltipStil(f: Farben) {
  return {
    backgroundColor: rgba(f.bg.startsWith('#') ? f.bg : '#050816', 0.92),
    titleColor: f.text,
    bodyColor: f.text,
    borderColor: f.grid,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 10,
    boxPadding: 4,
    usePointStyle: true,
  };
}

export function achse(f: Farben) {
  return {
    grid: { color: f.grid, drawTicks: false },
    border: { display: false },
    ticks: { color: f.muted, padding: 8 },
  };
}

export function zeitAchse(f: Farben) {
  const a = achse(f);
  return {
    type: 'time' as const,
    adapters: DATUM_ADAPTER,
    time: {
      tooltipFormat: 'dd.MM.yyyy',
      displayFormats: { day: 'dd.MM.', week: 'dd.MM.', month: 'MMM yy', quarter: 'MMM yy', year: 'yyyy' },
    },
    ...a,
    ticks: { ...a.ticks, maxRotation: 0, autoSkip: true, autoSkipPadding: 14 },
  };
}

/** Erzeugt das Diagramm neu, sobald sich `deps` ändern (Daten, Zeitraum, Theme). */
export function useChart(bauen: (f: Farben) => ChartConfiguration | null, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const config = bauen(farben());
    if (!config) return;
    const chart = new Chart(ref.current, config);
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
