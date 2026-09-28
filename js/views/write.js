import { CARDIO_TYPES, MEAL_SLOTS } from '../defaults.js';
import { ensureDay } from '../store.js';
import { applyParsed, parseDayText } from '../parse.js';
import { esc, fmtLong, fmtNum, isValidISO, todayISO } from '../utils.js';

const PLACEHOLDER = `Desayuno: multivitamínico, omega 3, creatina + café negro
2 tostadas integrales + queso crema + 2 huevos revueltos + pollo
Media tarde: café negro
Press banca 6x10, Press militar 5x7 60kg
Bici 1:02:24 558 kcal 128 ppm
Post entreno: yogur griego + 1 scoop
Cena: pollo con zanahoria
Permitido
Peso 83,4
Me acosté 00:30, me levanté 8:15`;

const drafts = {};
let preview = null;

function isoOf(ctx) {
  const d = ctx.params.get('d');
  return isValidISO(d) ? d : todayISO();
}

function macro(item) {
  if (item.protein == null && item.kcal == null) return '<small class="muted">sin datos: se los pedís al coach</small>';
  return `<small>${item.protein != null ? `${fmtNum(item.protein)} g prot` : ''}${item.protein != null && item.kcal != null ? ' · ' : ''}${item.kcal != null ? `${fmtNum(item.kcal)} kcal` : ''}</small>`;
}

function previewHtml(ctx, p) {
  const supps = ctx.state.supplements.filter((s) => p.supplements[s.id]).map((s) => s.name);
  const rows = [];
  if (p.items.length) {
    rows.push(`<h3>Comidas</h3><ul class="picked">${p.items.map((it, i) => `<li>
      <span><strong>${esc(it.text)}</strong>${macro(it)}</span>
      <select data-change="slot" data-i="${i}" aria-label="Comida">${MEAL_SLOTS.map((s) => `<option value="${s.id}"${s.id === it.slot ? ' selected' : ''}>${s.label}</option>`).join('')}</select>
      <button class="icon-btn danger" data-action="drop" data-kind="items" data-i="${i}" aria-label="Quitar">×</button>
    </li>`).join('')}</ul>`);
  }
  if (supps.length) rows.push(`<h3>Suplementos</h3><p>${supps.map(esc).join(', ')}</p>`);
  if (p.exercises.length) rows.push(`<h3>Fuerza</h3><ul class="compact">${p.exercises.map((e) => `<li>${esc(e.name)} · ${e.sets}×${esc(e.reps)}${e.kg ? ` · ${esc(e.kg)} kg` : ''}</li>`).join('')}</ul>`);
  if (p.cardio.length) rows.push(`<h3>Cardio</h3><ul class="compact">${p.cardio.map((c) => `<li>${CARDIO_TYPES.find((t) => t.id === c.type)?.label}: ${c.minutes} min${c.kcal ? ` · ${c.kcal} kcal` : ''}${c.hr ? ` · ${c.hr} ppm` : ''}</li>`).join('')}</ul>`);
  const extra = [
    p.cheat ? 'Día de permitido' : '',
    p.weight ? `Peso: ${fmtNum(p.weight, 2)} kg` : '',
    p.bed || p.wake ? `Sueño: ${p.bed || '?'} → ${p.wake || '?'}` : '',
    ...p.notes.map((n) => `Nota: ${n}`),
  ].filter(Boolean);
  if (extra.length) rows.push(`<h3>Otros</h3><ul class="compact">${extra.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`);
  if (!rows.length) return '<p class="muted">No encontré nada para cargar. Probá con una cosa por renglón.</p>';
  return `${rows.join('')}
    <div class="wiz-nav">
      <button class="btn ghost" data-action="edit">Corregir texto</button>
      <button class="btn" data-action="save">Guardar en el día →</button>
    </div>`;
}

export function render(ctx) {
  const iso = isoOf(ctx);
  if (preview && preview.iso === iso) {
    return `<section class="wizard">
      <div class="wiz-top"><a class="link small" href="#/hoy?d=${iso}">✕ Salir</a><span class="muted small">${esc(fmtLong(iso))}</span></div>
      <h1 class="wiz-q">¿Está bien así?</h1>
      <p class="hint">Si algo quedó en la comida equivocada, cambiala. Lo que ya tenías cargado en el día se mantiene.</p>
      <div class="wiz-body">${previewHtml(ctx, preview.data)}</div>
    </section>`;
  }
  return `<section class="wizard">
    <div class="wiz-top"><a class="link small" href="#/hoy?d=${iso}">✕ Salir</a><span class="muted small">${esc(fmtLong(iso))}</span></div>
    <h1 class="wiz-q">Escribí tu día como en tu Excel</h1>
    <p class="hint">Una cosa por renglón. Poné "Desayuno:", "Almuerzo:", "Media tarde:", "Post entreno:" o "Cena:" delante y yo lo acomodo. Los suplementos, la bici, los ejercicios (6x10), el peso y el permitido los reconozco solos.</p>
    <textarea id="day-text" class="day-text" rows="12" placeholder="${esc(PLACEHOLDER)}">${esc(drafts[iso] || '')}</textarea>
    <div class="wiz-nav"><span></span><button class="btn" data-action="read">Leer →</button></div>
  </section>`;
}

export function onEnter(ctx) {
  if (!preview || preview.iso !== isoOf(ctx)) document.getElementById('day-text')?.focus();
}

export const actions = {
  read: (el, ctx) => {
    const iso = isoOf(ctx);
    const text = document.getElementById('day-text')?.value || '';
    drafts[iso] = text;
    if (!text.trim()) { ctx.toast('Escribí algo primero.'); return; }
    preview = { iso, data: parseDayText(ctx.state, text) };
    ctx.render({ resetScroll: true });
  },
  edit: (el, ctx) => {
    preview = null;
    ctx.render({ focus: 'day-text', resetScroll: true });
  },
  drop: (el, ctx) => {
    preview.data[el.dataset.kind].splice(Number(el.dataset.i), 1);
    ctx.render();
  },
  slot: (el, ctx) => {
    preview.data.items[Number(el.dataset.i)].slot = el.value;
  },
  save: (el, ctx) => {
    const iso = isoOf(ctx);
    applyParsed(ctx.state, ensureDay(ctx.state, iso), preview.data);
    preview = null;
    delete drafts[iso];
    ctx.save();
    ctx.go('hoy', { d: iso });
    ctx.toast('Listo, cargué tu día.');
  },
};