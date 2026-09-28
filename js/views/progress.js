import { barChart, lineChart } from '../charts.js';
import {
  bestPushups, exerciseProgress, rangeMetrics, sleepOf, weightTrend,
} from '../metrics.js';
import { ensureDay } from '../store.js';
import {
  addDays, agoText, dateRange, esc, fmtDM, fmtDMY, fmtNum, fmtRange, isNum, isValidISO, parseNum, planWeek, round, todayISO, weekStart,
} from '../utils.js';
import { stat } from './shared.js';
import { healthReport, levelOf } from '../health.js';
import { bodyFigure } from '../body.js';

function signed(n, decimals) {
  return `${n > 0 ? '+' : ''}${fmtNum(n, decimals)}`;
}

function weightCard(state) {
  const tr = weightTrend(state);
  const goal = isNum(state.profile.goalWeightKg) ? state.profile.goalWeightKg : null;
  const points = tr ? tr.series.map((p) => ({ date: p.date, y: p.kg })) : [];
  const projection = tr?.eta && goal !== null ? { date: tr.eta, y: goal } : null;
  const statsBlock = tr ? `<div class="stats">
      ${stat(fmtNum(tr.first.kg, 2), `inicial · ${fmtDM(tr.first.date)}`)}
      ${stat(fmtNum(tr.last.kg, 2), `último · ${fmtDM(tr.last.date)}`)}
      ${stat(signed(tr.last.kg - tr.first.kg, 2), 'kg de cambio')}
      ${stat(goal !== null ? fmtNum(Math.max(0, tr.last.kg - goal), 2) : '—', goal !== null ? `kg para llegar a ${fmtNum(goal, 1)}` : 'sin objetivo cargado')}
      ${stat(tr.slopeWeek !== null ? signed(tr.slopeWeek, 2) : '—', 'kg por semana (tendencia)')}
      ${stat(tr.eta ? fmtDMY(tr.eta) : '—', 'llegada estimada')}
    </div>` : '';
  const list = tr ? `<details><summary>Ver todos los pesajes (${tr.series.length})</summary>
      <table class="simple"><thead><tr><th>Fecha</th><th>Peso</th><th></th></tr></thead><tbody>
      ${[...tr.series].reverse().map((p) => `<tr><td>${fmtDMY(p.date)}</td><td>${fmtNum(p.kg, 2)} kg</td><td><button class="link small" data-action="weight-del" data-date="${p.date}">Borrar</button></td></tr>`).join('')}
      </tbody></table></details>` : '';

  return `<section class="card">
    <div class="card-head"><h2>Peso</h2>${tr ? `<span class="muted small">último pesaje: ${agoText(tr.daysSinceLast)}</span>` : ''}</div>
    ${statsBlock}
    ${lineChart({ points, goal, projection, unit: 'kg' })}
    <div class="row gap wrap align-end">
      <label class="field"><span>Fecha</span><input type="date" id="w-date" value="${todayISO()}"></label>
      <label class="field"><span>Peso (kg, en ayunas)</span><input type="text" inputmode="decimal" id="w-kg" placeholder="83,4"></label>
      <button class="btn" data-action="weight-add">Guardar pesaje</button>
    </div>
    ${list}
  </section>`;
}

function exerciseCell(e) {
  return `${esc(`${e.sets ?? '?'}x${e.reps || '?'}${e.kg ? ` @${e.kg}` : ''}`)}<br><span class="muted small">${fmtDM(e.date)}</span>`;
}

export function render(ctx) {
  const { state } = ctx;
  const today = todayISO();
  const thisWeek = weekStart(today);
  const weeks = Array.from({ length: 10 }, (_, i) => addDays(thisWeek, -7 * (9 - i)));
  const weekLabel = (w) => {
    const n = planWeek(w, state.profile.planStart);
    return n ? `S${n}` : fmtDM(w);
  };
  const perWeek = weeks.map((w) => ({ w, m: rangeMetrics(state, w, addDays(w, 6)) }));
  const sleepDays = dateRange(addDays(today, -13), today);
  const push = bestPushups(state);
  const progress = exerciseProgress(state);

  const progressTable = progress.length ? `<div class="table-wrap"><table class="simple">
      <thead><tr><th>Ejercicio</th><th>Primera vez</th><th>Última vez</th><th>Mejor kg</th></tr></thead>
      <tbody>${progress.map((p) => `<tr><td>${esc(p.name)}</td><td>${exerciseCell(p.entries[0])}</td><td>${exerciseCell(p.entries[p.entries.length - 1])}</td><td>${p.bestKg !== null ? `${fmtNum(p.bestKg, 1)} kg` : '—'}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="muted">Cuando cargues la misma rutina dos veces vas a ver acá cómo suben series, reps y kilos.</p>';

  const report = healthReport(state, 14);
  const order = Object.values(report.areas).sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1));
  const areaRow = (a) => {
    const lvl = levelOf(a.pct);
    const details = a.details.length ? `<div class="chips small-chips">${a.details.map((d) => `<span class="chip lvl-${levelOf(d.pct)}">${esc(d.name)} ${d.count}</span>`).join('')}</div>` : '';
    return `<li class="area lvl-${lvl}">
      <div class="area-head"><b>${esc(a.label)}</b><span class="area-pct">${a.pct === null ? 'sin datos' : `${a.pct}%`}</span></div>
      <span class="bar"><i style="width:${a.pct ?? 0}%"></i></span>
      <p class="muted small">${esc(a.status)}</p>
      ${a.tip ? `<p class="area-tip">${esc(a.tip)}</p>` : ''}
      ${details}
    </li>`;
  };

  return `
  <h1 class="page-title">Progreso</h1>
  <section class="card">
    <div class="card-head"><h2>Tu estado</h2><span class="muted small">últimos 14 días</span></div>
    <div class="overall lvl-${levelOf(report.overall)}"><span class="overall-pct">${report.overall ?? '—'}%</span><span class="muted small">puntaje general</span></div>
    ${bodyFigure(report)}
    <p class="hint center-text">Verde: bien (80% o más) · Amarillo: a mejorar · Rojo: prioridad · Gris: faltan datos</p>
  </section>
  <section class="card">
    <h2>Qué te falta mejorar</h2>
    <ul class="areas">${order.map(areaRow).join('')}</ul>
  </section>
  ${weightCard(state)}
  <section class="card">
    <div class="card-head"><h2>Cardio por semana</h2><span class="muted small">objetivo ${state.targets.cardioMinPerWeek} min</span></div>
    ${barChart({ bars: perWeek.map(({ w, m }) => ({ label: weekLabel(w), value: m.cardioMin, title: fmtRange(w, addDays(w, 6)) })), target: state.targets.cardioMinPerWeek, unit: 'min' })}
  </section>
  <section class="card">
    <div class="card-head"><h2>Sesiones de fuerza por semana</h2><span class="muted small">objetivo ${state.targets.strengthPerWeek}</span></div>
    ${barChart({ bars: perWeek.map(({ w, m }) => ({ label: weekLabel(w), value: m.strength, title: fmtRange(w, addDays(w, 6)) })), target: state.targets.strengthPerWeek, unit: 'sesiones' })}
  </section>
  <section class="card">
    <div class="card-head"><h2>Sueño, últimos 14 días</h2><span class="muted small">objetivo ${state.targets.sleepH} h</span></div>
    ${barChart({ bars: sleepDays.map((iso) => ({ label: String(Number(iso.slice(8))), value: state.days[iso] ? (sleepOf(state.days[iso]).hours || 0) : 0, title: fmtDM(iso) })), target: state.targets.sleepH, unit: 'h' })}
  </section>
  <section class="card">
    <div class="card-head"><h2>Récords y progresión de fuerza</h2></div>
    <p>Flexiones: ${push ? `<b>${push.max}</b> en una serie (${fmtDMY(push.date)})` : 'sin registros todavía'}</p>
    ${progressTable}
  </section>`;
}

export const actions = {
  'weight-add': (el, ctx) => {
    const date = document.getElementById('w-date').value;
    const kg = parseNum(document.getElementById('w-kg').value);
    if (!isValidISO(date) || kg === null || kg < 30 || kg > 300) { ctx.toast('Revisá la fecha y el peso.'); return; }
    ensureDay(ctx.state, date).weight = round(kg, 2);
    ctx.commit();
    ctx.toast('Pesaje guardado.');
  },
  'weight-del': (el, ctx) => {
    const day = ctx.state.days[el.dataset.date];
    if (!day || !window.confirm('¿Borrar este pesaje?')) return;
    day.weight = null;
    ctx.commit();
  },
};
