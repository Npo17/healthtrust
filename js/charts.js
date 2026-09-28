import { DAY_MS, esc, fmtDM, fromISO } from './utils.js';

const fmt = (v) => (Math.round(v * 100) / 100).toLocaleString('es-AR');

function niceStep(range, target = 5) {
  const raw = range / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export function lineChart({ points, goal = null, projection = null, height = 230, unit = '' }) {
  if (!points.length) return '<p class="muted">Todavía no hay datos para graficar.</p>';
  const W = 640;
  const H = height;
  const L = 46;
  const R = 16;
  const T = 14;
  const B = 28;
  const time = (iso) => fromISO(iso).getTime();

  let x0 = time(points[0].date);
  let x1 = time(points[points.length - 1].date);
  if (projection) x1 = Math.max(x1, time(projection.date));
  if (x1 - x0 < 14 * DAY_MS) { x0 -= 7 * DAY_MS; x1 += 7 * DAY_MS; }

  const values = points.map((p) => p.y).concat(goal !== null ? [goal] : []);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const step = niceStep(Math.max(2, hi - lo));
  const y0 = Math.floor((lo - step / 2) / step) * step;
  const y1 = Math.ceil((hi + step / 2) / step) * step;
  const sx = (t) => L + ((t - x0) / (x1 - x0)) * (W - L - R);
  const sy = (v) => T + ((y1 - v) / (y1 - y0)) * (H - T - B);

  let svg = '';
  for (let v = y0; v <= y1 + 1e-9; v += step) {
    svg += `<line x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}" class="grid"/>`;
    svg += `<text x="${L - 6}" y="${sy(v) + 4}" class="axis" text-anchor="end">${fmt(v)}</text>`;
  }
  for (let i = 0; i <= 4; i += 1) {
    const d = new Date(x0 + ((x1 - x0) * i) / 4);
    const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const anchor = i === 0 ? 'start' : i === 4 ? 'end' : 'middle';
    svg += `<text x="${sx(d.getTime())}" y="${H - 8}" class="axis" text-anchor="${anchor}">${label}</text>`;
  }
  if (goal !== null) {
    svg += `<line x1="${L}" x2="${W - R}" y1="${sy(goal)}" y2="${sy(goal)}" class="goal"/>`;
    svg += `<text x="${L + 6}" y="${sy(goal) - 6}" class="goal-label">Objetivo ${fmt(goal)} ${esc(unit)}</text>`;
  }
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(time(p.date)).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  svg += `<path d="${path}" class="line"/>`;
  if (projection) {
    const last = points[points.length - 1];
    svg += `<line x1="${sx(time(last.date))}" y1="${sy(last.y)}" x2="${sx(time(projection.date))}" y2="${sy(projection.y)}" class="proj"/>`;
  }
  svg += points.map((p) => `<circle cx="${sx(time(p.date))}" cy="${sy(p.y)}" r="4" class="dot"><title>${fmtDM(p.date)}: ${fmt(p.y)} ${esc(unit)}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Gráfico de ${esc(unit)}">${svg}</svg>`;
}

export function barChart({ bars, target = null, height = 170, unit = '' }) {
  if (!bars.length) return '';
  const W = 640;
  const H = height;
  const L = 12;
  const R = 12;
  const T = 18;
  const B = 26;
  const max = Math.max(1, target || 0, ...bars.map((b) => b.value || 0)) * 1.12;
  const bw = (W - L - R) / bars.length;
  const sy = (v) => T + (1 - v / max) * (H - T - B);

  let svg = `<line x1="${L}" x2="${W - R}" y1="${sy(0)}" y2="${sy(0)}" class="grid"/>`;
  bars.forEach((b, i) => {
    const v = b.value || 0;
    const x = L + i * bw + bw * 0.18;
    const w = bw * 0.64;
    const cls = target !== null && v >= target ? 'bar ok' : 'bar';
    svg += `<rect x="${x}" y="${sy(v)}" width="${w}" height="${Math.max(0, sy(0) - sy(v))}" rx="3" class="${cls}"><title>${esc(b.title || b.label)}: ${fmt(v)} ${esc(unit)}</title></rect>`;
    if (v) svg += `<text x="${x + w / 2}" y="${sy(v) - 4}" class="axis" text-anchor="middle">${fmt(Math.round(v * 10) / 10)}</text>`;
    svg += `<text x="${x + w / 2}" y="${H - 8}" class="axis" text-anchor="middle">${esc(b.label)}</text>`;
  });
  if (target !== null) svg += `<line x1="${L}" x2="${W - R}" y1="${sy(target)}" y2="${sy(target)}" class="goal"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Gráfico de barras">${svg}</svg>`;
}
