import {
  DEFAULT_ROUTINES, DEFAULT_SUPPLEMENTS, DEFAULT_TARGETS, DEFAULT_TEMPLATES, typicalFromDefaults,
} from './defaults.js';
import { clone, isValidISO } from './utils.js';

export const STORAGE_KEY = 'healthtrust:v1';
export const SCHEMA_VERSION = 1;

export function createState() {
  return {
    version: SCHEMA_VERSION,
    profile: { name: '', heightCm: null, age: null, sex: 'M', goalWeightKg: null, planStart: '' },
    targets: clone(DEFAULT_TARGETS),
    supplements: clone(DEFAULT_SUPPLEMENTS),
    templates: clone(DEFAULT_TEMPLATES),
    routines: clone(DEFAULT_ROUTINES),
    typical: typicalFromDefaults(),
    days: {},
    meta: { createdAt: new Date().toISOString(), lastBackupAt: null },
  };
}

export function emptyDay() {
  return {
    meals: { desayuno: [], almuerzo: [], merienda: [], post: [], cena: [], snacks: [] },
    cheat: false,
    supplements: {},
    strength: [],
    cardio: [],
    pushups: { max: null, total: null },
    sleep: { bed: '', wake: '', hours: null, quality: null, napMin: null, score: null, source: '' },
    weight: null,
    steps: null,
    energy: null,
    hunger: null,
    notes: '',
  };
}

export function normalizeDay(raw) {
  const base = emptyDay();
  const day = { ...base, ...(raw || {}) };
  day.meals = { ...base.meals, ...(day.meals || {}) };
  for (const key of Object.keys(base.meals)) {
    if (!Array.isArray(day.meals[key])) day.meals[key] = [];
  }
  day.pushups = { ...base.pushups, ...(day.pushups || {}) };
  day.sleep = { ...base.sleep, ...(day.sleep || {}) };
  day.supplements = day.supplements && typeof day.supplements === 'object' ? day.supplements : {};
  day.strength = Array.isArray(day.strength) ? day.strength : [];
  day.strength.forEach((s) => { if (!Array.isArray(s.exercises)) s.exercises = []; });
  day.cardio = Array.isArray(day.cardio) ? day.cardio : [];
  return day;
}

export function normalizeState(raw) {
  const base = createState();
  if (!raw || typeof raw !== 'object') return base;
  const days = {};
  for (const [iso, day] of Object.entries(raw.days || {})) {
    if (isValidISO(iso)) days[iso] = normalizeDay(day);
  }
  return {
    ...base,
    ...raw,
    version: SCHEMA_VERSION,
    profile: { ...base.profile, ...(raw.profile || {}) },
    targets: { ...base.targets, ...(raw.targets || {}) },
    supplements: Array.isArray(raw.supplements) ? raw.supplements : base.supplements,
    templates: Array.isArray(raw.templates) ? raw.templates : base.templates,
    routines: Array.isArray(raw.routines) ? raw.routines : base.routines,
    typical: raw.typical && raw.typical.meals ? raw.typical : base.typical,
    days,
    meta: { ...base.meta, ...(raw.meta || {}) },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : null);
  } catch (err) {
    console.error(err);
    return createState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

export function ensureDay(state, iso) {
  if (!state.days[iso]) state.days[iso] = emptyDay();
  return state.days[iso];
}

export function isDayEmpty(day) {
  if (!day) return true;
  const hasMeal = Object.values(day.meals || {}).some((list) => (list || []).some((i) => i.text || i.protein != null || i.kcal != null));
  const hasSupp = Object.values(day.supplements || {}).some(Boolean);
  const s = day.sleep || {};
  return !(hasMeal || hasSupp || day.cheat || day.strength?.length || day.cardio?.length
    || day.pushups?.max != null || day.pushups?.total != null
    || s.bed || s.wake || s.hours != null || s.quality != null || s.napMin != null
    || day.weight != null || day.steps != null || day.energy != null || day.hunger != null
    || (day.notes || '').trim());
}

const blank = (v) => v === null || v === undefined || v === '';

// Completa solo lo que falta en el día actual; nunca pisa lo que ya cargaste.
export function mergeDay(mine, other) {
  for (const [slot, items] of Object.entries(other.meals)) {
    if (!(mine.meals[slot] || []).length && items.length) mine.meals[slot] = items;
  }
  for (const key of ['strength', 'cardio']) {
    if (!mine[key].length && other[key].length) mine[key] = other[key];
  }
  for (const [id, taken] of Object.entries(other.supplements)) {
    if (taken && !mine.supplements[id]) mine.supplements[id] = true;
  }
  for (const key of ['weight', 'steps', 'energy', 'hunger']) {
    if (blank(mine[key]) && !blank(other[key])) mine[key] = other[key];
  }
  for (const key of ['max', 'total']) {
    if (blank(mine.pushups[key]) && !blank(other.pushups[key])) mine.pushups[key] = other.pushups[key];
  }
  if (!mine.sleep.bed && !mine.sleep.wake && (other.sleep.bed || other.sleep.wake)) mine.sleep = other.sleep;
  if (!(mine.notes || '').trim() && other.notes) mine.notes = other.notes;
  if (other.cheat) mine.cheat = true;
  return mine;
}

export function mergeStates(current, incoming) {
  for (const [iso, day] of Object.entries(incoming.days)) {
    if (!current.days[iso] || isDayEmpty(current.days[iso])) current.days[iso] = day;
    else mergeDay(current.days[iso], day);
  }
  const ids = new Set(current.templates.map((t) => t.id));
  incoming.templates.forEach((t) => { if (!ids.has(t.id)) current.templates.push(t); });
  for (const [key, value] of Object.entries(incoming.profile)) {
    const mine = current.profile[key];
    if ((mine === null || mine === undefined || mine === '') && value !== null && value !== '') {
      current.profile[key] = value;
    }
  }
  return current;
}
