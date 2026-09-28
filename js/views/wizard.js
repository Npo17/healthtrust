import { CARDIO_TYPES, MEAL_SLOTS } from '../defaults.js';
import { emptyDay, ensureDay } from '../store.js';
import { dayTotals, sleepOf } from '../metrics.js';
import { foodItem } from '../parse.js';
import {
  addDays, agoText, clone, diffDays, esc, fmtHours, fmtLong, fmtNum, fromISO, isValidISO, numValue, todayISO, uid,
} from '../utils.js';
import { lastSession } from './day.js';

const QUESTIONS = {
  desayuno: '¿Qué desayunaste?',
  almuerzo: '¿Qué almorzaste?',
  merienda: '¿Qué comiste a la tarde?',
  post: '¿Comiste algo post-entreno?',
  cena: '¿Qué cenaste?',
  snacks: '¿Picaste algo o comiste postre?',
};

const ALL_STEPS = [
  ...MEAL_SLOTS.map((s) => s.id),
  'suplementos', 'fuerza', 'cardio', 'sueno', 'peso', 'cierre',
];

export const isWeighDay = (iso, day) => fromISO(iso).getDay() === 6 || day?.weight != null;

// El pesaje es semanal (sábado en ayunas): los demás días no se pregunta.
function stepsFor(state, iso) {
  return ALL_STEPS.filter((s) => s !== 'peso' || isWeighDay(iso, state.days[iso]));
}

const hasFood = (day, slot) => (day.meals[slot] || []).some((i) => i.text);

// Primer paso que todavía no tiene nada cargado, para retomar donde quedó.
export function firstPending(state, iso) {
  const day = state.days[iso];
  const STEPS = stepsFor(state, iso);
  if (!day) return STEPS[0];
  const done = {
    suplementos: state.supplements.every((s) => day.supplements[s.id]),
    fuerza: day.strength.length > 0,
    cardio: day.cardio.length > 0,
    sueno: Boolean(day.sleep.bed && day.sleep.wake),
    peso: day.weight != null,
  };
  return STEPS.find((s) => (QUESTIONS[s] ? !hasFood(day, s) : !done[s])) || 'cierre';
}

function params(ctx) {
  const d = ctx.params.get('d');
  const s = ctx.params.get('s');
  const iso = isValidISO(d) ? d : todayISO();
  const steps = stepsFor(ctx.state, iso);
  return { iso, steps, step: steps.includes(s) ? s : steps[0] };
}

function macro(item) {
  const parts = [];
  if (item.protein != null) parts.push(`${fmtNum(item.protein)} g prot`);
  if (item.kcal != null) parts.push(`${fmtNum(item.kcal)} kcal`);
  return parts.length ? parts.join(' · ') : 'sin datos';
}

function frequentFoods(ctx, slot) {
  const count = new Map();
  Object.values(ctx.state.days).forEach((d) => (d.meals[slot] || []).forEach((i) => {
    if (i.text && (i.protein != null || i.kcal != null)) count.set(i.text, (count.get(i.text) || 0) + 1);
  }));
  const fromHistory = [...count.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([text]) => text);
  const fromTemplates = ctx.state.templates.filter((t) => t.slots?.includes(slot)).map((t) => t.text);
  const seen = new Set();
  return [...fromHistory, ...fromTemplates].filter((t) => !seen.has(t) && seen.add(t)).slice(0, 6);
}

function shortName(ctx, text) {
  return ctx.state.templates.find((t) => t.text === text)?.short || text;
}

function mealStep(ctx, day, iso, slot) {
  const items = day.meals[slot] || [];
  const prev = ctx.state.days[addDays(iso, -1)]?.meals?.[slot] || [];
  const picks = frequentFoods(ctx, slot).filter((t) => !items.some((i) => i.text === t));
  return {
    body: `
      ${items.length ? `<ul class="picked">${items.map((it, i) => `<li><span><strong>${esc(it.text)}</strong><small>${macro(it)}</small></span><button class="icon-btn danger" data-action="meal-del" data-i="${i}" aria-label="Quitar">×</button></li>`).join('')}</ul>` : ''}
      <div class="write-row">
        <input id="w-food" type="text" data-enter="meal-write" placeholder="Escribilo como en tu Excel y apretá Enter" autocomplete="off">
        <button class="btn" data-action="meal-write">Agregar</button>
      </div>
      ${picks.length || prev.length ? `<div class="big-chips">
        ${prev.length && !items.length ? '<button class="chip add" data-action="meal-yesterday">Igual que ayer</button>' : ''}
        ${picks.map((t) => `<button class="chip" data-action="meal-pick" data-text="${esc(t)}">${esc(shortName(ctx, t))}</button>`).join('')}
      </div>` : ''}`,
    next: items.length ? 'Siguiente' : 'No comí nada',
  };
}

function supplementsStep(ctx, day) {
  const list = ctx.state.supplements;
  const all = list.every((s) => day.supplements[s.id]);
  return {
    body: `<div class="big-checks">${list.map((s) => `<label class="check${day.supplements[s.id] ? ' on' : ''}"><input type="checkbox" data-path="days.${ctx.iso}.supplements.${s.id}"${day.supplements[s.id] ? ' checked' : ''}> ${esc(s.name)}</label>`).join('')}</div>
      ${all ? '' : '<button class="btn wide" data-action="supp-all">Tomé todos</button>'}`,
    next: 'Siguiente',
  };
}

function strengthStep(ctx, day) {
  const sessions = day.strength.map((s, i) => `<div class="picked-session">
      <div class="row gap center-y"><strong class="grow">${esc(s.name || 'Fuerza')}</strong><button class="icon-btn danger" data-action="strength-del" data-i="${i}" aria-label="Quitar">×</button></div>
      <ul class="compact">${s.exercises.filter((e) => e.name).map((e) => `<li>${esc(e.name)} · ${e.sets ?? '?'}×${esc(e.reps || '?')}${e.kg ? ` · ${esc(e.kg)} kg` : ''}</li>`).join('')}</ul>
    </div>`).join('');
  return {
    body: `${sessions}
      ${sessions ? '<p class="hint">Copié los números de la última vez. Si cambiaste algo, ajustalo en <a href="#/hoy?d=' + ctx.iso + '&full=1">el detalle del día</a>.</p>' : ''}
      <div class="big-chips">${ctx.state.routines.map((r) => `<button class="chip" data-action="strength-add" data-id="${esc(r.id)}">${esc(r.name)}</button>`).join('')}</div>`,
    next: sessions ? 'Siguiente' : 'No entrené',
  };
}

function cardioStep(ctx, day) {
  const rows = day.cardio.map((c, i) => {
    const p = `days.${ctx.iso}.cardio.${i}`;
    const label = CARDIO_TYPES.find((t) => t.id === c.type)?.label || 'Cardio';
    return `<div class="cardio-card">
      <div class="row gap center-y"><strong class="grow">${label}</strong><button class="icon-btn danger" data-action="cardio-del" data-i="${i}" aria-label="Quitar">×</button></div>
      <div class="row gap">
        <label class="field"><span>Duración</span><input type="text" inputmode="numeric" data-dur data-path="${p}.minutes" value="${numValue(c.minutes)}" placeholder="1:02:24 o 60"></label>
        <label class="field"><span>Calorías</span><input type="text" inputmode="numeric" data-num data-path="${p}.kcal" value="${numValue(c.kcal)}" placeholder="del reloj"></label>
        <label class="field"><span>Pulso prom.</span><input type="text" inputmode="numeric" data-num data-path="${p}.hr" value="${numValue(c.hr)}" placeholder="opcional"></label>
      </div>
    </div>`;
  }).join('');
  return {
    body: `${rows}
      <div class="big-chips">${CARDIO_TYPES.map((t) => `<button class="chip" data-action="cardio-add" data-type="${t.id}">${rows ? '+ ' : ''}${t.label}</button>`).join('')}</div>`,
    next: rows ? 'Siguiente' : 'No hice',
  };
}

function sleepStep(ctx, day) {
  const p = `days.${ctx.iso}.sleep`;
  return {
    body: `<p class="hint">La noche que terminó este día.</p>
      <div class="row gap">
        <label class="field"><span>Me acosté</span><input type="time" data-path="${p}.bed" value="${esc(day.sleep.bed)}"></label>
        <label class="field"><span>Me levanté</span><input type="time" data-path="${p}.wake" value="${esc(day.sleep.wake)}"></label>
      </div>
      <p class="big-number" data-live="sleep">${fmtHours(sleepOf(day).hours)}</p>`,
    next: 'Siguiente',
  };
}

function lastWeight(state, iso) {
  const d = Object.keys(state.days).filter((k) => k < iso && state.days[k].weight != null).sort().pop();
  return d ? `Último: ${fmtNum(state.days[d].weight, 2)} kg (${agoText(diffDays(d, iso))}).` : '';
}

function weightStep(ctx, day) {
  return {
    body: `<p class="hint">En ayunas, después del baño. ${lastWeight(ctx.state, ctx.iso)}</p>
      <label class="mini big"><input type="text" inputmode="decimal" data-num data-path="days.${ctx.iso}.weight" value="${numValue(day.weight)}" placeholder="—"><span>kg</span></label>`,
    next: day.weight != null ? 'Siguiente' : 'No me pesé',
  };
}

function closeStep(ctx, day) {
  const t = dayTotals(day);
  return {
    body: `<div class="big-chips">
        <button class="chip${day.cheat ? ' active' : ''}" data-action="cheat" data-on="1">Fue día de permitido</button>
        <button class="chip${!day.cheat ? ' active' : ''}" data-action="cheat" data-on="">Día normal</button>
      </div>
      <textarea data-path="days.${ctx.iso}.notes" rows="3" placeholder="¿Algo más? Cómo te sentiste, molestias, antojos... (opcional)">${esc(day.notes)}</textarea>
      <div class="stats">
        <div class="stat"><span class="stat-val">${t.protein !== null ? `${fmtNum(t.protein)} g` : '—'}</span><span class="stat-lbl">proteína</span></div>
        <div class="stat"><span class="stat-val">${t.kcal !== null ? fmtNum(t.kcal) : '—'}</span><span class="stat-lbl">kcal</span></div>
        <div class="stat"><span class="stat-val">${t.cardioMin ? `${t.cardioMin} min` : '—'}</span><span class="stat-lbl">cardio</span></div>
      </div>`,
    next: 'Terminar',
  };
}

const TITLES = { suplementos: '¿Tomaste los suplementos?', fuerza: '¿Entrenaste fuerza?', cardio: '¿Hiciste bici u otro cardio?', sueno: '¿A qué hora te acostaste y te levantaste?', peso: 'Es sábado: ¿cuánto pesaste en ayunas?', cierre: '¿Cómo fue el día?' };

export function render(ctx) {
  const { iso, step, steps: STEPS } = params(ctx);
  ctx.iso = iso;
  const day = ctx.state.days[iso] || emptyDay();
  const i = STEPS.indexOf(step);
  const builders = { suplementos: supplementsStep, fuerza: strengthStep, cardio: cardioStep, sueno: sleepStep, peso: weightStep, cierre: closeStep };
  const { body, next } = QUESTIONS[step] ? mealStep(ctx, day, iso, step) : builders[step](ctx, day);
  const pct = Math.round(((i + 1) / STEPS.length) * 100);
  return `<section class="wizard">
    <div class="wiz-top">
      <a class="link small" href="#/hoy?d=${iso}">✕ Salir</a>
      <span class="muted small">${esc(fmtLong(iso))} · ${i + 1} de ${STEPS.length}</span>
    </div>
    <div class="wiz-bar"><i style="width:${pct}%"></i></div>
    <h1 class="wiz-q">${QUESTIONS[step] || TITLES[step]}</h1>
    <div class="wiz-body">${body}</div>
    <div class="wiz-nav">
      ${i > 0 ? '<button class="btn ghost" data-action="back">Atrás</button>' : '<span></span>'}
      <button class="btn" data-action="next">${next} →</button>
    </div>
  </section>`;
}

export function onEnter() {
  const input = document.getElementById('w-food');
  if (input && window.matchMedia('(pointer: fine)').matches) input.focus();
}

function dayOf(ctx) {
  return ensureDay(ctx.state, params(ctx).iso);
}

function goStep(ctx, delta) {
  const { iso, step, steps } = params(ctx);
  const target = steps[steps.indexOf(step) + delta];
  if (!target) {
    ctx.go('hoy', { d: iso });
    ctx.toast('Día cargado. ¡Bien ahí!');
    return;
  }
  ctx.go('cargar', { d: iso, s: target });
}

export const actions = {
  next: (el, ctx) => {
    const input = document.getElementById('w-food');
    if (input?.value.trim()) actions['meal-write'](el, ctx);
    goStep(ctx, 1);
  },
  back: (el, ctx) => goStep(ctx, -1),

  'meal-write': (el, ctx) => {
    const input = document.getElementById('w-food');
    const text = input?.value.trim();
    if (!text) return;
    dayOf(ctx).meals[params(ctx).step].push(foodItem(ctx.state, text));
    ctx.commit({ focus: 'w-food' });
  },
  'meal-pick': (el, ctx) => {
    dayOf(ctx).meals[params(ctx).step].push(foodItem(ctx.state, el.dataset.text));
    ctx.commit();
  },
  'meal-yesterday': (el, ctx) => {
    const { iso, step } = params(ctx);
    const prev = ctx.state.days[addDays(iso, -1)]?.meals?.[step] || [];
    dayOf(ctx).meals[step].push(...prev.map((i) => ({ ...clone(i), id: uid() })));
    ctx.commit();
  },
  'meal-del': (el, ctx) => {
    dayOf(ctx).meals[params(ctx).step].splice(Number(el.dataset.i), 1);
    ctx.commit();
  },

  'supp-all': (el, ctx) => {
    const day = dayOf(ctx);
    ctx.state.supplements.forEach((s) => { day.supplements[s.id] = true; });
    ctx.save();
    goStep(ctx, 1);
  },

  'strength-add': (el, ctx) => {
    const { iso } = params(ctx);
    const routine = ctx.state.routines.find((r) => r.id === el.dataset.id);
    if (!routine) return;
    const last = lastSession(ctx.state, iso, routine.id);
    const exercises = (last ? last.exercises : routine.exercises).map((e) => ({ name: e.name, sets: e.sets ?? null, reps: e.reps ?? '', kg: e.kg ?? '' }));
    dayOf(ctx).strength.push({ id: uid(), routineId: routine.id, name: routine.name, exercises, notes: '' });
    ctx.commit();
  },
  'strength-del': (el, ctx) => {
    dayOf(ctx).strength.splice(Number(el.dataset.i), 1);
    ctx.commit();
  },

  'cardio-add': (el, ctx) => {
    const list = dayOf(ctx).cardio;
    list.push({ id: uid(), type: el.dataset.type || 'otro', minutes: null, kcal: null, hr: null });
    ctx.commit({ focus: `days.${params(ctx).iso}.cardio.${list.length - 1}.minutes` });
  },
  'cardio-del': (el, ctx) => {
    dayOf(ctx).cardio.splice(Number(el.dataset.i), 1);
    ctx.commit();
  },

  cheat: (el, ctx) => {
    dayOf(ctx).cheat = Boolean(el.dataset.on);
    ctx.commit();
  },
};
