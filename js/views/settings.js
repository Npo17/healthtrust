import { MEAL_SLOTS } from '../defaults.js';
import { createState, mergeStates, normalizeState } from '../store.js';
import {
  download, esc, fmtDMY, numValue, toISO, todayISO, uid,
} from '../utils.js';

const localDate = (isoTimestamp) => fmtDMY(toISO(new Date(isoTimestamp)));

function field(label, path, value, { type = 'text', num = false, placeholder = '' } = {}) {
  const extra = num ? ' inputmode="decimal" data-num' : '';
  const shown = num ? numValue(value) : esc(value ?? '');
  return `<label class="field"><span>${label}</span><input type="${type}"${extra} data-path="${path}" value="${shown}" placeholder="${esc(placeholder)}"></label>`;
}

function profileCard(state) {
  const p = state.profile;
  return `<section class="card" id="perfil">
    <h2>Perfil</h2>
    <div class="row gap wrap spaced">
      ${field('Nombre', 'profile.name', p.name)}
      ${field('Altura (cm)', 'profile.heightCm', p.heightCm, { num: true })}
      ${field('Edad', 'profile.age', p.age, { num: true })}
      ${field('Peso objetivo (kg)', 'profile.goalWeightKg', p.goalWeightKg, { num: true })}
      ${field('Inicio del plan (semana 1)', 'profile.planStart', p.planStart, { type: 'date' })}
    </div>
    <p class="hint">Con el inicio del plan, la app numera las semanas igual que tu planilla.</p>
  </section>`;
}

function targetsCard(state) {
  const t = state.targets;
  return `<section class="card" id="objetivos">
    <h2>Objetivos</h2>
    <div class="row gap wrap spaced">
      ${field('Kcal mínimo', 'targets.kcalMin', t.kcalMin, { num: true })}
      ${field('Kcal máximo', 'targets.kcalMax', t.kcalMax, { num: true })}
      ${field('Proteína (g/día)', 'targets.proteinG', t.proteinG, { num: true })}
      ${field('Sueño (h)', 'targets.sleepH', t.sleepH, { num: true })}
      ${field('Acostarme antes de', 'targets.bedtime', t.bedtime, { type: 'time' })}
      ${field('Pasos por día', 'targets.stepsPerDay', t.stepsPerDay, { num: true })}
      ${field('Sesiones de fuerza / semana', 'targets.strengthPerWeek', t.strengthPerWeek, { num: true })}
      ${field('Minutos de cardio / semana', 'targets.cardioMinPerWeek', t.cardioMinPerWeek, { num: true })}
      ${field('Permitidos / semana', 'targets.cheatPerWeek', t.cheatPerWeek, { num: true })}
    </div>
  </section>`;
}

function supplementsCard(state) {
  return `<section class="card" id="suplementos">
    <h2>Suplementos</h2>
    <div class="spaced">
      ${state.supplements.map((s, i) => `<div class="item simple"><input type="text" data-path="supplements.${i}.name" value="${esc(s.name)}" placeholder="Nombre" aria-label="Suplemento"><button class="icon-btn danger" data-action="supp-del" data-i="${i}" aria-label="Borrar">×</button></div>`).join('')}
    </div>
    <button class="btn ghost small" data-action="supp-add">+ Suplemento</button>
  </section>`;
}

function templatesCard(state) {
  return `<section class="card" id="comidas">
    <h2>Comidas frecuentes</h2>
    <p class="hint">Aparecen como botones en cada comida del día. Proteína y kcal aproximadas; elegí en qué comidas se muestran.</p>
    ${state.templates.map((t, i) => `<div class="tpl-row">
      <div class="tpl-grid">
        <input class="tpl-text" type="text" data-path="templates.${i}.text" value="${esc(t.text)}" placeholder="Descripción completa" aria-label="Descripción">
        <input class="tpl-short" type="text" data-path="templates.${i}.short" value="${esc(t.short || '')}" placeholder="Nombre corto del botón" aria-label="Nombre corto">
        <label class="mini"><input type="text" inputmode="decimal" data-num data-path="templates.${i}.protein" value="${numValue(t.protein)}" aria-label="Proteína"><span>g prot</span></label>
        <label class="mini"><input type="text" inputmode="decimal" data-num data-path="templates.${i}.kcal" value="${numValue(t.kcal)}" aria-label="Calorías"><span>kcal</span></label>
        <button class="icon-btn danger" data-action="tpl-del" data-i="${i}" aria-label="Borrar">×</button>
      </div>
      <div class="chips small-chips">${MEAL_SLOTS.map((s) => `<button class="chip${t.slots?.includes(s.id) ? ' active' : ''}" data-action="tpl-slot" data-i="${i}" data-slot="${s.id}">${s.label}</button>`).join('')}</div>
    </div>`).join('')}
    <button class="btn ghost small" data-action="tpl-add">+ Comida frecuente</button>
  </section>`;
}

function routinesCard(state) {
  return `<section class="card" id="rutinas">
    <h2>Rutinas de fuerza</h2>
    <p class="hint">Plantillas para cargar rápido. En el día se copian los números de la última vez que hiciste cada rutina.</p>
    ${state.routines.map((r, i) => `<div class="session">
      <div class="session-head"><input class="session-name" type="text" data-path="routines.${i}.name" value="${esc(r.name)}" aria-label="Nombre de la rutina"><button class="icon-btn danger" data-action="routine-del" data-i="${i}" aria-label="Borrar rutina">×</button></div>
      <div class="ex-grid routine ex-head"><span>Ejercicio</span><span>Series</span><span>Reps</span><span></span></div>
      ${r.exercises.map((e, j) => `<div class="ex-grid routine">
        <input type="text" data-path="routines.${i}.exercises.${j}.name" value="${esc(e.name)}" aria-label="Ejercicio">
        <input type="text" inputmode="numeric" data-num data-path="routines.${i}.exercises.${j}.sets" value="${numValue(e.sets)}" aria-label="Series">
        <input type="text" data-path="routines.${i}.exercises.${j}.reps" value="${esc(e.reps)}" aria-label="Repeticiones">
        <button class="icon-btn danger" data-action="rex-del" data-i="${i}" data-j="${j}" aria-label="Borrar ejercicio">×</button>
      </div>`).join('')}
      <button class="btn ghost small" data-action="rex-add" data-i="${i}">+ Ejercicio</button>
    </div>`).join('')}
    <button class="btn ghost small" data-action="routine-add">+ Rutina</button>
  </section>`;
}

function backupCard(state) {
  const last = state.meta.lastBackupAt;
  const days = Object.keys(state.days).length;
  return `<section class="card" id="backup">
    <h2>Backup y datos</h2>
    <p>Tus datos viven solo en este navegador (${days} días cargados). Si borrás los datos del navegador o cambiás de celular se pierden, así que descargá un backup cada tanto. ${last ? `Último backup: ${localDate(last)}.` : '<b>Todavía no hiciste ningún backup.</b>'}</p>
    <div class="row gap wrap spaced">
      <button class="btn" data-action="export-json">Descargar backup (.json)</button>
      <label class="btn ghost file">Importar backup<input type="file" accept=".json,application/json" data-file="backup"></label>
    </div>
    <div class="row gap wrap spaced">
      <label class="check"><input type="radio" name="import-mode" value="merge" checked> Combinar (agrega los días que no tenés)</label>
      <label class="check"><input type="radio" name="import-mode" value="replace"> Reemplazar todo</label>
    </div>
    <p class="hint">Para pasar tus datos a otro dispositivo: descargá el backup acá, mandalo por WhatsApp o Drive e importalo allá.</p>
    <button class="btn danger small" data-action="reset-all">Borrar todos los datos</button>
  </section>`;
}

export function render(ctx) {
  const { state } = ctx;
  return `
  <h1 class="page-title">Ajustes y datos</h1>
  ${profileCard(state)}
  ${targetsCard(state)}
  ${supplementsCard(state)}
  ${templatesCard(state)}
  ${routinesCard(state)}
  ${backupCard(state)}`;
}

export function onEnter(ctx) {
  const section = ctx.params.get('s');
  if (section) document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export const actions = {
  'file-backup': async (files, ctx) => {
    let raw;
    try {
      raw = JSON.parse(await files[0].text());
    } catch {
      throw new Error('El archivo no es un JSON válido.');
    }
    const incoming = normalizeState(raw);
    const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'merge';
    if (mode === 'replace') {
      if (!window.confirm('Esto reemplaza TODOS tus datos actuales por los del archivo. ¿Seguir?')) return;
      ctx.replaceState(incoming);
    } else {
      mergeStates(ctx.state, incoming);
      ctx.commit();
    }
    ctx.toast(`Backup importado: ${Object.keys(incoming.days).length} días.`);
  },

  'export-json': (el, ctx) => {
    ctx.state.meta.lastBackupAt = new Date().toISOString();
    ctx.commit();
    download(`healthtrust-backup-${todayISO()}.json`, JSON.stringify(ctx.state, null, 2), 'application/json');
  },

  'reset-all': (el, ctx) => {
    if (!window.confirm('¿Borrar TODOS los datos de HealthTrust de este dispositivo?')) return;
    if (!window.confirm('Última confirmación: no se puede deshacer. Si lo necesitás, descargá un backup antes.')) return;
    ctx.replaceState(createState());
    ctx.toast('Datos borrados.');
  },

  'supp-add': (el, ctx) => {
    ctx.state.supplements.push({ id: uid(), name: '' });
    ctx.commit({ focus: `supplements.${ctx.state.supplements.length - 1}.name` });
  },
  'supp-del': (el, ctx) => {
    ctx.state.supplements.splice(Number(el.dataset.i), 1);
    ctx.commit();
  },

  'tpl-add': (el, ctx) => {
    ctx.state.templates.push({ id: uid(), short: '', text: '', protein: null, kcal: null, slots: [] });
    ctx.commit({ focus: `templates.${ctx.state.templates.length - 1}.text` });
  },
  'tpl-del': (el, ctx) => {
    ctx.state.templates.splice(Number(el.dataset.i), 1);
    ctx.commit();
  },
  'tpl-slot': (el, ctx) => {
    const tpl = ctx.state.templates[Number(el.dataset.i)];
    const slots = new Set(tpl.slots || []);
    if (slots.has(el.dataset.slot)) slots.delete(el.dataset.slot); else slots.add(el.dataset.slot);
    tpl.slots = MEAL_SLOTS.map((s) => s.id).filter((id) => slots.has(id));
    ctx.commit();
  },

  'routine-add': (el, ctx) => {
    ctx.state.routines.push({ id: uid(), name: '', exercises: [{ name: '', sets: 3, reps: '10' }] });
    ctx.commit({ focus: `routines.${ctx.state.routines.length - 1}.name` });
  },
  'routine-del': (el, ctx) => {
    if (!window.confirm('¿Borrar esta rutina? Los entrenos ya cargados no se tocan.')) return;
    ctx.state.routines.splice(Number(el.dataset.i), 1);
    ctx.commit();
  },
  'rex-add': (el, ctx) => {
    const routine = ctx.state.routines[Number(el.dataset.i)];
    routine.exercises.push({ name: '', sets: 3, reps: '10' });
    ctx.commit({ focus: `routines.${el.dataset.i}.exercises.${routine.exercises.length - 1}.name` });
  },
  'rex-del': (el, ctx) => {
    ctx.state.routines[Number(el.dataset.i)].exercises.splice(Number(el.dataset.j), 1);
    ctx.commit();
  },
};
