import { MEAL_SLOTS, cardioLabel } from '../defaults.js';
import { isDayEmpty } from '../store.js';
import {
  alertsFor, dayTotals, rangeMetrics, sleepOf,
} from '../metrics.js';
import {
  addDays, esc, fmtHours, fmtNum, fmtRange, fmtShort, isoWeek, isValidISO, planWeek, todayISO, weekDays, weekStart,
} from '../utils.js';
import { alertsHtml, stat } from './shared.js';

function currentWeek(ctx) {
  const w = ctx.params.get('w');
  return weekStart(isValidISO(w) ? w : todayISO());
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function rows(state) {
  const supps = state.supplements;
  return [
    ...MEAL_SLOTS.map((slot) => [slot.label, (d) => (d.meals[slot.id] || []).filter((i) => i.text).map((i) => esc(i.text)).join(' + ')]),
    ['Permitido', (d) => (d.cheat ? '<span class="tag warn">Permitido</span>' : '')],
    ['Proteína / kcal', (d) => {
      const t = dayTotals(d);
      return [t.protein !== null ? `~${fmtNum(t.protein)} g` : '', t.kcal !== null ? `~${fmtNum(t.kcal)} kcal` : ''].filter(Boolean).join('<br>');
    }],
    ['Fuerza', (d) => d.strength.map((s) => `<b>${esc(s.name || 'Fuerza')}</b>${s.exercises.filter((e) => e.name).map((e) => `<br><span class="muted">${esc(`${e.name} ${e.sets ?? '?'}x${e.reps || '?'}${e.kg ? ` @${e.kg}` : ''}`)}</span>`).join('')}`).join('<br>')],
    ['Cardio', (d) => d.cardio.map((c) => `${esc(cardioLabel(c))} ${c.minutes ?? '?'} min${c.kcal ? ` · ${fmtNum(c.kcal)} kcal` : ''}`).join('<br>')],
    ['Flexiones', (d) => [d.pushups.max != null ? `máx ${d.pushups.max}` : '', d.pushups.total != null ? `total ${d.pushups.total}` : ''].filter(Boolean).join('<br>')],
    ['Sueño', (d) => {
      const s = sleepOf(d);
      if (s.hours === null) return '';
      return `${fmtHours(s.hours)}${s.bed && s.wake ? `<br><span class="muted">${esc(s.bed)}–${esc(s.wake)}</span>` : ''}`;
    }],
    ['Suplementos', (d) => {
      const taken = supps.filter((s) => d.supplements[s.id]);
      return taken.length ? `${taken.length}/${supps.length}<br><span class="muted">${esc(taken.map((s) => s.name).join(', '))}</span>` : '';
    }],
    ['Peso', (d) => (d.weight != null ? `${fmtNum(d.weight, 2)} kg` : '')],
    ['Pasos', (d) => (d.steps != null ? fmtNum(d.steps) : '')],
    ['Energía / hambre', (d) => (d.energy != null || d.hunger != null ? `${d.energy ?? '—'} / ${d.hunger ?? '—'}` : '')],
    ['Notas', (d) => esc(d.notes || '')],
  ];
}

export function render(ctx) {
  const { state } = ctx;
  const start = currentWeek(ctx);
  const end = addDays(start, 6);
  const days = weekDays(start);
  const today = todayISO();
  const m = rangeMetrics(state, start, end);
  const t = state.targets;
  const n = planWeek(start, state.profile.planStart);

  const head = days.map((iso) => `<th class="${iso === today ? 'today' : ''}"><a href="#/hoy?d=${iso}">${cap(fmtShort(iso))}</a></th>`).join('');
  const body = rows(state).map(([label, fn]) => {
    const cells = days.map((iso) => {
      const d = state.days[iso];
      return d && !isDayEmpty(d) ? fn(d) : '';
    });
    if (!cells.some(Boolean)) return '';
    return `<tr><th>${label}</th>${cells.map((html, i) => `<td class="${days[i] === today ? 'today' : ''}">${html || '<span class="muted">—</span>'}</td>`).join('')}</tr>`;
  }).join('');

  return `
  <section class="daybar">
    <button class="icon-btn" data-action="week-nav" data-delta="-7" aria-label="Semana anterior">‹</button>
    <div class="daybar-center"><h1>${n ? `Semana ${n}` : `Semana ${isoWeek(start)}`}</h1><div class="muted small">${fmtRange(start, end)}</div></div>
    <button class="icon-btn" data-action="week-nav" data-delta="7" aria-label="Semana siguiente">›</button>
  </section>
  <div class="row gap wrap center">
    <a class="btn" href="#/coach?from=${start}&to=${end}">Copiar para el coach</a>    ${start !== weekStart(today) ? '<button class="btn ghost" data-action="week-today">Ir a esta semana</button>' : ''}
  </div>
  <div class="stats">
    ${stat(`${m.strength}/${t.strengthPerWeek}`, 'sesiones de fuerza')}
    ${stat(`${m.cardioMin} min`, `cardio / ${t.cardioMinPerWeek}`)}
    ${stat(m.proteinAvg !== null ? `${fmtNum(m.proteinAvg)} g` : '—', `proteína prom. / ${t.proteinG}`)}
    ${stat(m.kcalAvg !== null ? fmtNum(m.kcalAvg) : '—', 'kcal prom.')}
    ${stat(fmtHours(m.sleepAvg), `sueño prom. / ${t.sleepH} h`)}
    ${stat(`${m.cheatDates.length}`, `permitidos / ${t.cheatPerWeek}`)}
  </div>
  <section class="card"><h2>Qué te falta y qué va bien</h2><div class="spaced">${alertsHtml(alertsFor(state, m))}</div></section>
  <section class="card flush">
    <div class="card-head pad"><h2>Planilla semanal</h2><span class="muted small">Tocá un día para editarlo</span></div>
    ${body ? `<div class="table-wrap"><table class="week-table"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>` : '<p class="muted pad-text">Todavía no cargaste nada esta semana. Andá a <a href="#/hoy">Día</a> y tocá "Mi día típico".</p>'}
  </section>`;
}

export const actions = {
  'week-nav': (el, ctx) => ctx.go('semana', { w: addDays(currentWeek(ctx), Number(el.dataset.delta)) }),
  'week-today': (el, ctx) => ctx.go('semana'),
};
