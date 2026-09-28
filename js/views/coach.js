import { buildReport } from '../report.js';
import {
  addDays, download, esc, isValidISO, todayISO, weekStart,
} from '../utils.js';

function range(ctx) {
  let from = ctx.params.get('from');
  let to = ctx.params.get('to');
  if (!isValidISO(from) || !isValidISO(to) || from > to) {
    from = weekStart(todayISO());
    to = addDays(from, 6);
  }
  return { from, to, detail: ctx.params.get('detail') !== '0' };
}

export function render(ctx) {
  const { from, to, detail } = range(ctx);
  const text = buildReport(ctx.state, from, to, { detail });
  const today = todayISO();
  const thisWeek = weekStart(today);
  const presets = [
    ['Esta semana', thisWeek, addDays(thisWeek, 6)],
    ['Semana pasada', addDays(thisWeek, -7), addDays(thisWeek, -1)],
    ['Últimos 14 días', addDays(today, -13), today],
    ['Últimos 30 días', addDays(today, -29), today],
  ];
  return `
  <h1 class="page-title">Reporte para el coach</h1>
  <section class="card">
    <p>Copiá este texto y pegalo en el chat con tu coach. Lleva todo lo que cargaste (comidas, fuerza, cardio, sueño, peso, suplementos y alertas), así las recomendaciones salen de datos reales.</p>
    <div class="chips">${presets.map(([label, a, b]) => `<button class="chip${a === from && b === to ? ' active' : ''}" data-action="coach-range" data-from="${a}" data-to="${b}">${label}</button>`).join('')}</div>
    <div class="row gap wrap align-end spaced">
      <label class="field"><span>Desde</span><input type="date" id="coach-from" value="${from}" data-change="coach-dates"></label>
      <label class="field"><span>Hasta</span><input type="date" id="coach-to" value="${to}" data-change="coach-dates"></label>
      <label class="check${detail ? ' on' : ''}"><input type="checkbox" data-change="coach-detail"${detail ? ' checked' : ''}> Detalle día por día</label>
    </div>
    <div class="row gap wrap spaced">
      <button class="btn" data-action="coach-copy">Copiar reporte</button>
      ${typeof navigator.share === 'function' ? '<button class="btn ghost" data-action="coach-share">Compartir</button>' : ''}
      <button class="btn ghost" data-action="coach-download">Descargar .md</button>
    </div>
    <textarea id="coach-text" class="report" readonly rows="20">${esc(text)}</textarea>
  </section>`;
}

const detailParam = (ctx) => (range(ctx).detail ? '' : '0');

export const actions = {
  'coach-range': (el, ctx) => ctx.go('coach', { from: el.dataset.from, to: el.dataset.to, detail: detailParam(ctx) }),
  'coach-dates': (el, ctx) => {
    const from = document.getElementById('coach-from').value;
    const to = document.getElementById('coach-to').value;
    if (isValidISO(from) && isValidISO(to) && from <= to) ctx.go('coach', { from, to, detail: detailParam(ctx) });
  },
  'coach-detail': (el, ctx) => {
    const { from, to } = range(ctx);
    ctx.go('coach', { from, to, detail: el.checked ? '' : '0' });
  },
  'coach-copy': async (el, ctx) => {
    const area = document.getElementById('coach-text');
    try {
      await navigator.clipboard.writeText(area.value);
    } catch {
      area.select();
      document.execCommand('copy');
    }
    ctx.toast('Reporte copiado. Pegalo en el chat con tu coach.');
  },
  'coach-share': async () => {
    try {
      await navigator.share({ title: 'HealthTrust', text: document.getElementById('coach-text').value });
    } catch {
      // El usuario canceló el menú de compartir.
    }
  },
  'coach-download': (el, ctx) => {
    const { from, to } = range(ctx);
    download(`healthtrust-${from}_${to}.md`, document.getElementById('coach-text').value, 'text/markdown');
  },
};
