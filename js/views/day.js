import { CARDIO_TYPES, MEAL_SLOTS } from '../defaults.js';
import { emptyDay, ensureDay } from '../store.js';
import { dayTotals, sleepOf } from '../metrics.js';
import {
  addDays, clone, esc, fmtHours, fmtLong, fmtNum, isoWeek, isValidISO, numValue, planWeek, todayISO, uid,
} from '../utils.js';
import { firstPending } from './wizard.js';

function currentDate(ctx) {
  const d = ctx.params.get('d');
  return isValidISO(d) ? d : todayISO();
}

function scaleOptions(value, max) {
  let html = '<option value="">—</option>';
  for (let i = 1; i <= max; i += 1) html += `<option value="${i}"${value === i ? ' selected' : ''}>${i}</option>`;
  return html;
}

function numField(path, value, unit, label, cls = '') {
  return `<label class="mini ${cls}"><input type="text" inputmode="decimal" data-num data-path="${path}" value="${numValue(value)}" aria-label="${label}"><span>${unit}</span></label>`;
}

function statsHtml(ctx, day) {
  const t = dayTotals(day);
  const tg = ctx.state.targets;
  const pct = t.protein !== null ? Math.min(100, Math.round((t.protein / tg.proteinG) * 100)) : 0;
  const missing = t.items - t.withP;
  return `
    <div class="stat"><span class="stat-val">${t.protein !== null ? `${fmtNum(t.protein)} g` : '—'}</span><span class="stat-lbl">proteína / ${tg.proteinG} g</span><span class="bar"><i style="width:${pct}%"></i></span></div>
    <div class="stat"><span class="stat-val">${t.kcal !== null ? fmtNum(t.kcal) : '—'}</span><span class="stat-lbl">kcal / ${fmtNum(tg.kcalMin)}–${fmtNum(tg.kcalMax)}</span></div>
    <div class="stat"><span class="stat-val">${t.strength ? 'Sí' : 'No'}</span><span class="stat-lbl">fuerza</span></div>
    <div class="stat"><span class="stat-val">${t.cardioMin ? `${t.cardioMin} min` : '—'}</span><span class="stat-lbl">cardio</span></div>
    <div class="stat"><span class="stat-val">${fmtHours(t.sleepH)}</span><span class="stat-lbl">sueño</span></div>
    ${missing > 0 ? `<p class="stat-note">Estimado: ${missing} ${missing === 1 ? 'comida' : 'comidas'} sin gramos cargados.</p>` : ''}`;
}

function pendingHtml(ctx, day, iso) {
  if (iso > todayISO()) return '';
  const filled = (slot) => (day.meals[slot] || []).some((i) => i.text || i.protein != null || i.kcal != null);
  const missing = [];
  if (!filled('desayuno')) missing.push(['Desayuno', 'sec-comidas']);
  if (!filled('almuerzo') && !filled('cena')) missing.push(['Almuerzo o cena', 'sec-comidas']);
  if (ctx.state.supplements.some((s) => !day.supplements[s.id])) missing.push(['Suplementos', 'sec-suplementos']);
  if (!day.strength.length && !day.cardio.length) missing.push(['Entreno', 'sec-fuerza']);
  if (!day.sleep.bed || !day.sleep.wake) missing.push(['Sueño', 'sec-sueno']);
  if (!missing.length) return '<p class="done-note">Día completo. Todo cargado.</p>';
  return `<div class="pending"><span class="muted">Falta cargar:</span>${missing.map(([label, target]) => `<button class="chip" data-action="scroll-to" data-target="${target}">${label}</button>`).join('')}</div>`;
}

function mealsCard(ctx, day, base) {
  const slots = MEAL_SLOTS.map((slot) => {
    const items = day.meals[slot.id] || [];
    const templates = ctx.state.templates.filter((t) => !t.slots || !t.slots.length || t.slots.includes(slot.id));
    const rows = items.map((it, i) => {
      const p = `${base}.meals.${slot.id}.${i}`;
      return `<div class="item">
        <input class="item-text" type="text" data-path="${p}.text" value="${esc(it.text)}" placeholder="¿Qué comiste?" aria-label="Descripción">
        ${numField(`${p}.protein`, it.protein, 'g prot', 'Proteína en gramos')}
        ${numField(`${p}.kcal`, it.kcal, 'kcal', 'Calorías')}
        <button class="icon-btn danger" data-action="meal-del" data-slot="${slot.id}" data-i="${i}" aria-label="Borrar">×</button>
      </div>`;
    }).join('');
    return `<div class="slot">
      <div class="slot-head"><h3>${slot.label}</h3><button class="link small" data-action="meal-copy" data-slot="${slot.id}">Igual que ayer</button></div>
      ${rows}
      <div class="chips">
        <button class="chip add" data-action="meal-add" data-slot="${slot.id}">+ Escribir</button>
        ${templates.map((t) => `<button class="chip" data-action="meal-tpl" data-slot="${slot.id}" data-id="${esc(t.id)}" title="${esc(t.text)}">${esc(t.short || t.text)}</button>`).join('')}
      </div>
    </div>`;
  }).join('');

  return `<section class="card">
    <div class="card-head">
      <h2>Comidas</h2>
      <label class="toggle${day.cheat ? ' on' : ''}"><input type="checkbox" data-path="${base}.cheat"${day.cheat ? ' checked' : ''}> Permitido</label>
    </div>
    <p class="hint">Tocá un botón para sumar una comida frecuente: ya trae la proteína y las calorías estimadas.</p>
    ${slots}
    <button class="link small" data-action="typical-save">Guardar las comidas y suplementos de este día como "Mi día típico"</button>
  </section>`;
}

function supplementsCard(ctx, day, base) {
  const list = ctx.state.supplements;
  if (!list.length) return '';
  return `<section class="card">
    <div class="card-head"><h2>Suplementos</h2><button class="btn ghost small" data-action="supp-all">Marcar todos</button></div>
    <div class="checks">${list.map((s) => `<label class="check${day.supplements[s.id] ? ' on' : ''}"><input type="checkbox" data-path="${base}.supplements.${s.id}"${day.supplements[s.id] ? ' checked' : ''}> ${esc(s.name)}</label>`).join('')}</div>
  </section>`;
}

function strengthCard(ctx, day, base) {
  const sessions = day.strength.map((s, si) => {
    const p = `${base}.strength.${si}`;
    const rows = s.exercises.map((e, ei) => `<div class="ex-grid">
        <input type="text" data-path="${p}.exercises.${ei}.name" value="${esc(e.name)}" placeholder="Ejercicio" aria-label="Ejercicio">
        <input type="text" inputmode="numeric" data-num data-path="${p}.exercises.${ei}.sets" value="${numValue(e.sets)}" aria-label="Series">
        <input type="text" data-path="${p}.exercises.${ei}.reps" value="${esc(e.reps)}" aria-label="Repeticiones">
        <input type="text" inputmode="decimal" data-path="${p}.exercises.${ei}.kg" value="${esc(e.kg)}" placeholder="—" aria-label="Kilos">
        <button class="icon-btn danger" data-action="ex-del" data-s="${si}" data-e="${ei}" aria-label="Borrar ejercicio">×</button>
      </div>`).join('');
    return `<div class="session">
      <div class="session-head">
        <input class="session-name" type="text" data-path="${p}.name" value="${esc(s.name)}" placeholder="Nombre de la sesión" aria-label="Nombre de la sesión">
        <button class="icon-btn danger" data-action="strength-del" data-s="${si}" aria-label="Borrar sesión">×</button>
      </div>
      <div class="ex-grid ex-head"><span>Ejercicio</span><span>Series</span><span>Reps</span><span>Kg</span><span></span></div>
      ${rows}
      <button class="btn ghost small" data-action="ex-add" data-s="${si}">+ Ejercicio</button>
      <textarea data-path="${p}.notes" rows="2" placeholder="Notas: cómo te sentiste, molestias, qué subiste">${esc(s.notes || '')}</textarea>
    </div>`;
  }).join('');

  return `<section class="card">
    <div class="card-head"><h2>Fuerza</h2></div>
    ${sessions || '<p class="muted">Sin sesión de fuerza cargada.</p>'}
    <div class="chips">
      ${ctx.state.routines.map((r) => `<button class="chip" data-action="strength-add" data-id="${esc(r.id)}">+ ${esc(r.name)}</button>`).join('')}
      <button class="chip add" data-action="strength-add" data-id="">+ Sesión vacía</button>
    </div>
    <p class="hint">Al elegir una rutina se copian series, reps y kilos de la última vez que la hiciste: solo ajustás lo que subiste.</p>
    <div class="pushups">
      <h3>Flexiones</h3>
      <div class="row gap">
        <label class="field"><span>Máx. en 1 serie</span><input type="text" inputmode="numeric" data-num data-path="${base}.pushups.max" value="${numValue(day.pushups.max)}"></label>
        <label class="field"><span>Total del día</span><input type="text" inputmode="numeric" data-num data-path="${base}.pushups.total" value="${numValue(day.pushups.total)}"></label>
      </div>
    </div>
  </section>`;
}

function cardioCard(ctx, day, base) {
  const rows = day.cardio.map((c, i) => {
    const p = `${base}.cardio.${i}`;
    return `<div class="cardio-row">
      <select class="c-type" data-path="${p}.type" aria-label="Tipo">${CARDIO_TYPES.map((t) => `<option value="${t.id}"${t.id === c.type ? ' selected' : ''}>${t.label}</option>`).join('')}</select>
      <label class="mini c-min"><input type="text" inputmode="numeric" data-dur data-rerender data-path="${p}.minutes" value="${numValue(c.minutes)}" placeholder="1:02:24" aria-label="Duración"><span>min</span></label>
      ${numField(`${p}.kcal`, c.kcal, 'kcal', 'Calorías', 'c-kcal')}
      ${numField(`${p}.hr`, c.hr, 'ppm', 'Pulso promedio', 'c-hr')}
      <button class="icon-btn danger c-del" data-action="cardio-del" data-i="${i}" aria-label="Borrar">×</button>
    </div>`;
  }).join('');

  return `<section class="card">
    <div class="card-head"><h2>Cardio</h2></div>
    <p class="hint">Copiá del reloj: duración (en minutos o tal cual, ej. 1:02:24), calorías del entrenamiento y pulso promedio (opcional).</p>
    ${rows ? `<div class="cardio-row cardio-head"><span>Tipo</span><span>Duración</span><span>Calorías</span><span>Pulso prom.</span><span></span></div>${rows}` : '<p class="muted">Sin cardio cargado.</p>'}
    <div class="chips">
      <button class="chip" data-action="cardio-add" data-type="bici">+ Bici</button>
      <button class="chip" data-action="cardio-add" data-type="caminata">+ Caminata</button>
      <button class="chip" data-action="cardio-add" data-type="cinta">+ Cinta</button>
      <button class="chip add" data-action="cardio-add" data-type="otro">+ Otro</button>
    </div>
  </section>`;
}

function sleepCard(ctx, day, base) {
  const s = sleepOf(day);
  return `<section class="card">
    <div class="card-head"><h2>Sueño</h2></div>
    <p class="hint">La noche que termina este día (anoche → hoy).</p>
    <div class="row gap wrap">
      <label class="field"><span>Me acosté</span><input type="time" data-path="${base}.sleep.bed" value="${esc(day.sleep.bed)}"></label>
      <label class="field"><span>Me levanté</span><input type="time" data-path="${base}.sleep.wake" value="${esc(day.sleep.wake)}"></label>
      <div class="field"><span>Horas</span><strong data-live="sleep-hours">${fmtHours(s.hours)}</strong></div>
      <label class="field"><span>Calidad (1–5)</span><select data-num data-path="${base}.sleep.quality">${scaleOptions(day.sleep.quality, 5)}</select></label>
      <label class="field"><span>Siesta (min)</span><input type="text" inputmode="numeric" data-num data-path="${base}.sleep.napMin" value="${numValue(day.sleep.napMin)}"></label>
    </div>
  </section>`;
}

function bodyCard(ctx, day, base) {
  return `<section class="card">
    <div class="card-head"><h2>Cuerpo y sensaciones</h2></div>
    <div class="row gap wrap">
      <label class="field"><span>Peso (kg, en ayunas)</span><input type="text" inputmode="decimal" data-num data-path="${base}.weight" value="${numValue(day.weight)}" placeholder="—"></label>
      <label class="field"><span>Pasos</span><input type="text" inputmode="numeric" data-num data-path="${base}.steps" value="${numValue(day.steps)}" placeholder="—"></label>
      <label class="field"><span>Energía (1–10)</span><select data-num data-path="${base}.energy">${scaleOptions(day.energy, 10)}</select></label>
      <label class="field"><span>Hambre (1–10)</span><select data-num data-path="${base}.hunger">${scaleOptions(day.hunger, 10)}</select></label>
    </div>
    <label class="field block"><span>Notas del día</span><textarea data-path="${base}.notes" rows="3" placeholder="Cómo te sentiste, molestias, eventos, antojos...">${esc(day.notes)}</textarea></label>
  </section>`;
}

function summaryRow(iso, step, label, value) {
  return `<a class="sum-row${value ? '' : ' empty'}" href="#/cargar?d=${iso}&s=${step}">
    <span class="sum-label">${label}</span>
    <span class="sum-value">${value ? esc(value) : 'Sin cargar'}</span>
    <span class="sum-go">›</span>
  </a>`;
}

function summaryHtml(ctx, day, iso) {
  const meals = MEAL_SLOTS.map((slot) => {
    const texts = (day.meals[slot.id] || []).map((i) => i.text).filter(Boolean);
    return texts.length ? summaryRow(iso, slot.id, slot.label, texts.join(' + ')) : '';
  }).join('');
  const supps = ctx.state.supplements.filter((s) => day.supplements[s.id]);
  const suppText = !supps.length ? '' : supps.length === ctx.state.supplements.length ? 'Todos' : supps.map((s) => s.name).join(', ');
  const cardio = day.cardio.map((c) => `${CARDIO_TYPES.find((t) => t.id === c.type)?.label || 'Cardio'} ${c.minutes ?? '?'} min${c.kcal ? ` · ${c.kcal} kcal` : ''}`).join(' + ');
  const sleep = sleepOf(day).hours;
  return `<section class="card flush summary">
    ${meals || summaryRow(iso, 'desayuno', 'Comidas', '')}
    ${summaryRow(iso, 'suplementos', 'Suplementos', suppText)}
    ${summaryRow(iso, 'fuerza', 'Fuerza', day.strength.map((s) => s.name || 'Fuerza').join(' + '))}
    ${summaryRow(iso, 'cardio', 'Cardio', cardio)}
    ${summaryRow(iso, 'sueno', 'Sueño', sleep ? `${fmtHours(sleep)} (${day.sleep.bed || '?'} → ${day.sleep.wake || '?'})` : '')}
    ${summaryRow(iso, 'peso', 'Peso', day.weight != null ? `${fmtNum(day.weight, 2)} kg` : '')}
    ${day.cheat ? summaryRow(iso, 'cierre', 'Permitido', 'Sí') : ''}
  </section>`;
}

function simpleRender(ctx, iso, day) {
  const started = Object.values(day.meals).some((l) => l.length) || day.strength.length || day.cardio.length;
  const next = firstPending(ctx.state, ctx.state.days[iso]);
  return `
  <div class="big-actions">
    <a class="btn big" href="#/cargar?d=${iso}&s=${next}">${started ? 'Seguir cargando' : 'Cargar el día'}<small>Paso a paso, una pregunta por pantalla</small></a>
    <a class="btn ghost big" href="#/escribir?d=${iso}">Escribirlo todo de una<small>Como en tu Excel o en un mensaje</small></a>
  </div>
  <div class="stats" data-live="day-stats">${statsHtml(ctx, day)}</div>
  ${summaryHtml(ctx, day, iso)}
  <p class="center-text"><a class="link small" href="#/hoy?d=${iso}&full=1">Ver todo en detalle (gramos, series, kilos)</a></p>`;
}

export function render(ctx) {
  const iso = currentDate(ctx);
  const day = ctx.state.days[iso] || emptyDay();
  const base = `days.${iso}`;
  const today = todayISO();
  const week = planWeek(iso, ctx.state.profile.planStart);
  const full = ctx.params.get('full') === '1';
  const header = `
  <section class="daybar">
    <button class="icon-btn" data-action="day-nav" data-delta="-1" aria-label="Día anterior">‹</button>
    <div class="daybar-center">
      <h1>${esc(fmtLong(iso))}</h1>
      <div class="muted small">${week ? `Semana ${week} del plan` : `Semana ${isoWeek(iso)}`}${iso === today ? ' · hoy' : ''}</div>
    </div>
    <button class="icon-btn" data-action="day-nav" data-delta="1" aria-label="Día siguiente">›</button>
  </section>
  <div class="row gap wrap center">
    <input type="date" class="date-input" value="${iso}" data-change="day-go" aria-label="Elegir fecha">
    ${iso !== today ? '<button class="btn ghost small" data-action="day-today">Ir a hoy</button>' : ''}
  </div>`;
  if (!full) return header + simpleRender(ctx, iso, day);
  return `${header}
  <p class="center-text"><a class="link small" href="#/hoy?d=${iso}">← Volver al resumen</a></p>
  <div class="stats" data-live="day-stats">${statsHtml(ctx, day)}</div>
  <div class="quick">
    <button class="btn" data-action="typical-load">Mi día típico</button>
    <button class="btn ghost" data-action="yesterday-copy">Copiar comidas de ayer</button>
  </div>
  <div data-live="pending">${pendingHtml(ctx, day, iso)}</div>
  <div id="sec-comidas">${mealsCard(ctx, day, base)}</div>
  <div id="sec-suplementos">${supplementsCard(ctx, day, base)}</div>
  <div id="sec-fuerza">${strengthCard(ctx, day, base)}</div>
  <div id="sec-cardio">${cardioCard(ctx, day, base)}</div>
  <div id="sec-sueno">${sleepCard(ctx, day, base)}</div>
  <div id="sec-cuerpo">${bodyCard(ctx, day, base)}</div>`;
}

function dayOf(ctx) {
  return ensureDay(ctx.state, currentDate(ctx));
}

export function lastSession(state, before, routineId) {
  const dates = Object.keys(state.days).filter((d) => d < before).sort().reverse();
  for (const d of dates) {
    const found = state.days[d].strength.find((s) => s.routineId === routineId);
    if (found) return found;
  }
  return null;
}

function fillEmptySlots(day, meals) {
  let added = 0;
  for (const [slot, items] of Object.entries(meals || {})) {
    if ((day.meals[slot] || []).length || !items.length) continue;
    day.meals[slot] = items.map((i) => ({ id: uid(), text: i.text, protein: i.protein ?? null, kcal: i.kcal ?? null }));
    added += items.length;
  }
  return added;
}

export const actions = {
  'scroll-to': (el) => document.getElementById(el.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  'typical-load': (el, ctx) => {
    const day = dayOf(ctx);
    const { typical } = ctx.state;
    const added = fillEmptySlots(day, typical.meals);
    Object.entries(typical.supplements || {}).forEach(([id, on]) => { if (on) day.supplements[id] = true; });
    ctx.commit();
    ctx.toast(added ? 'Listo: cargué tu día típico. Cambiá solo lo distinto.' : 'Esas comidas ya estaban cargadas; marqué los suplementos.');
  },
  'typical-save': (el, ctx) => {
    const day = dayOf(ctx);
    const meals = {};
    Object.entries(day.meals).forEach(([slot, items]) => {
      const kept = items.filter((i) => i.text).map((i) => ({ text: i.text, protein: i.protein, kcal: i.kcal }));
      if (kept.length) meals[slot] = kept;
    });
    if (!Object.keys(meals).length) { ctx.toast('Primero cargá las comidas de este día.'); return; }
    ctx.state.typical = { meals, supplements: { ...day.supplements } };
    ctx.commit();
    ctx.toast('Guardado como tu día típico.');
  },
  'yesterday-copy': (el, ctx) => {
    const prev = ctx.state.days[addDays(currentDate(ctx), -1)];
    const added = prev ? fillEmptySlots(dayOf(ctx), prev.meals) : 0;
    if (!added) { ctx.toast('No hay comidas de ayer para copiar (o ya cargaste esas comidas).'); return; }
    ctx.commit();
    ctx.toast('Copié las comidas de ayer en las comidas vacías.');
  },

  'day-nav': (el, ctx) => ctx.go('hoy', { d: addDays(currentDate(ctx), Number(el.dataset.delta)), full: ctx.params.get('full') }),
  'day-today': (el, ctx) => ctx.go('hoy'),
  'day-go': (el, ctx) => { if (isValidISO(el.value)) ctx.go('hoy', { d: el.value }); },

  'meal-add': (el, ctx) => {
    const list = dayOf(ctx).meals[el.dataset.slot];
    list.push({ id: uid(), text: '', protein: null, kcal: null });
    ctx.commit({ focus: `days.${currentDate(ctx)}.meals.${el.dataset.slot}.${list.length - 1}.text` });
  },
  'meal-tpl': (el, ctx) => {
    const tpl = ctx.state.templates.find((t) => t.id === el.dataset.id);
    if (!tpl) return;
    dayOf(ctx).meals[el.dataset.slot].push({ id: uid(), text: tpl.text, protein: tpl.protein ?? null, kcal: tpl.kcal ?? null });
    ctx.commit();
  },
  'meal-del': (el, ctx) => {
    dayOf(ctx).meals[el.dataset.slot].splice(Number(el.dataset.i), 1);
    ctx.commit();
  },
  'meal-copy': (el, ctx) => {
    const prev = ctx.state.days[addDays(currentDate(ctx), -1)];
    const items = prev?.meals?.[el.dataset.slot] || [];
    if (!items.length) { ctx.toast('Ayer no cargaste nada en esa comida.'); return; }
    dayOf(ctx).meals[el.dataset.slot].push(...items.map((i) => ({ ...clone(i), id: uid() })));
    ctx.commit();
  },

  'supp-all': (el, ctx) => {
    const day = dayOf(ctx);
    ctx.state.supplements.forEach((s) => { day.supplements[s.id] = true; });
    ctx.commit();
  },

  'strength-add': (el, ctx) => {
    const iso = currentDate(ctx);
    const routine = ctx.state.routines.find((r) => r.id === el.dataset.id);
    let exercises = [{ name: '', sets: null, reps: '', kg: '' }];
    if (routine) {
      const last = lastSession(ctx.state, iso, routine.id);
      exercises = (last ? last.exercises : routine.exercises).map((e) => ({
        name: e.name, sets: e.sets ?? null, reps: e.reps ?? '', kg: e.kg ?? '',
      }));
      if (last) ctx.toast('Copié los números de tu última sesión de esta rutina.');
    }
    dayOf(ctx).strength.push({ id: uid(), routineId: routine ? routine.id : '', name: routine ? routine.name : '', exercises, notes: '' });
    ctx.commit();
  },
  'strength-del': (el, ctx) => {
    if (!window.confirm('¿Borrar esta sesión de fuerza?')) return;
    dayOf(ctx).strength.splice(Number(el.dataset.s), 1);
    ctx.commit();
  },
  'ex-add': (el, ctx) => {
    const session = dayOf(ctx).strength[Number(el.dataset.s)];
    session.exercises.push({ name: '', sets: null, reps: '', kg: '' });
    ctx.commit({ focus: `days.${currentDate(ctx)}.strength.${el.dataset.s}.exercises.${session.exercises.length - 1}.name` });
  },
  'ex-del': (el, ctx) => {
    dayOf(ctx).strength[Number(el.dataset.s)].exercises.splice(Number(el.dataset.e), 1);
    ctx.commit();
  },

  'cardio-add': (el, ctx) => {
    const list = dayOf(ctx).cardio;
    list.push({ id: uid(), type: el.dataset.type || 'otro', minutes: null, kcal: null, hr: null });
    ctx.commit({ focus: `days.${currentDate(ctx)}.cardio.${list.length - 1}.minutes` });
  },
  'cardio-del': (el, ctx) => {
    dayOf(ctx).cardio.splice(Number(el.dataset.i), 1);
    ctx.commit();
  },
};
