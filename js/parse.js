import { parseNum, uid } from './utils.js';

export function norm(s) {
  return [...String(s ?? '')].map((c) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()).join('');
}

const key = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim();

// Valores por unidad (o por porción típica); `g` = gramos de la porción típica para poder escalar "200 g de pollo".
const FOODS = [
  [/huevo/, 6.5, 75],
  [/tostada|rebanada|pan integral/, 3, 70],
  [/yogur/, 20, 150],
  [/scoop|whey|proteina en polvo/, 25, 130],
  [/ribs|costilla|asado|vacio|chorizo/, 45, 800],
  [/hamburguesa|burger|whopper/, 30, 600],
  [/pechuga|pollo/, 60, 330, 200],
  [/lomo|bife|nalga|carne|cuadril|peceto/, 52, 400, 200],
  [/atun/, 30, 140],
  [/milanesa/, 30, 350],
  [/empanada/, 8, 300],
  [/pizza/, 12, 290],
  [/arroz|papa|batata/, 4, 200],
  [/fideo/, 12, 400],
  [/queso crema/, 2, 50],
  [/queso/, 7, 90],
  [/banana/, 1, 100],
  [/manzana|pera|naranja|mandarina/, 0, 80],
  [/palta/, 1, 80],
  [/zanahoria|lechuga|tomate|verdura|ensalada|brocoli|zapallito|espinaca/, 1, 30],
  [/cafe|mate|te |coca zero|agua/, 0, 5],
];

function qtyOf(n) {
  if (/^(medio|media)\b/.test(n)) return 0.5;
  const m = n.match(/^(\d+(?:[.,]\d+)?)(?![\d.,])(?!\s*(g|gr|gramos|kg)\b)/);
  return m ? parseNum(m[1]) : 1;
}

// Suma aproximada por alimento; solo devuelve valores si reconoce todas las partes.
function guess(text) {
  let protein = 0;
  let kcal = 0;
  for (const part of norm(text).split(/\s*\+\s*|,\s*/).filter(Boolean)) {
    const food = FOODS.find(([re]) => re.test(part));
    if (!food) return null;
    const [, p, k, portion] = food;
    const grams = part.match(/(\d+)\s*(g|gr|gramos)\b/);
    const factor = portion && grams ? Number(grams[1]) / portion : qtyOf(part);
    protein += p * factor;
    kcal += k * factor;
  }
  return { protein: Math.round(protein), kcal: Math.round(kcal / 5) * 5 };
}

// Proteína y kcal para un texto: primero lo que ya cargó otros días con ese mismo texto, después las comidas frecuentes.
export function estimate(state, text) {
  const k = key(text);
  if (!k) return { protein: null, kcal: null };
  const days = Object.keys(state.days).sort().reverse();
  for (const d of days) {
    for (const items of Object.values(state.days[d].meals)) {
      const hit = items.find((i) => key(i.text) === k && (i.protein != null || i.kcal != null));
      if (hit) return { protein: hit.protein, kcal: hit.kcal };
    }
  }
  let best = null;
  for (const t of state.templates) {
    const names = [key(t.text), key(t.short)].filter(Boolean);
    if (names.includes(k)) return { protein: t.protein ?? null, kcal: t.kcal ?? null };
    const inside = names.find((n) => n.length >= 6 && k.includes(n));
    if (inside && (!best || inside.length > best.len)) best = { len: inside.length, t };
  }
  if (best) return { protein: best.t.protein ?? null, kcal: best.t.kcal ?? null };
  return guess(text) || { protein: null, kcal: null };
}

export function foodItem(state, text) {
  return { id: uid(), text: text.trim(), ...estimate(state, text) };
}

const SLOTS = [
  ['desayuno', /^desayun\w*/],
  ['almuerzo', /^almuer\w*/],
  ['merienda', /^(media tarde|merienda\w*)/],
  ['post', /^post[\s-]?entren\w*/],
  ['cena', /^cen[aeo]\w*/],
  ['snacks', /^(postre|picoteo|snacks?|bajon)\b/],
];

const SUPPS = [
  ['multi', /multivit/], ['omega3', /omega/], ['creatina', /creatin/], ['colageno', /colag/], ['magnesio', /magnes/],
];

const CARDIO = [
  ['bici', /\b(bici|bicicleta|spinning)\b/], ['caminata', /\b(caminata|camine|caminar)\b/],
  ['cinta', /\bcinta\b/], ['correr', /\b(corr\w*|running)\b/],
];

const NOTE = /\b(no se|me siento|siento|estoy|sexo|dormi mal|cansad)/;

function minutesOf(n) {
  const clock = n.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  if (clock) {
    const [h, m, s] = clock[3] !== undefined ? [+clock[1], +clock[2], +clock[3]] : [0, +clock[1], +clock[2]];
    return Math.round(h * 60 + m + s / 60);
  }
  let min = 0;
  if (/\bmedia hora\b/.test(n)) min += 30;
  if (/\buna hora\b/.test(n)) min += 60;
  const h = n.match(/(\d+(?:[.,]\d+)?)\s*(h|hs|hora|horas)\b/);
  if (h) min += parseNum(h[1]) * 60;
  const m = n.match(/(\d+)\s*(min|mins|minutos)\b/);
  if (m) min += Number(m[1]);
  return min ? Math.round(min) : null;
}

function supplementId(state, n) {
  const hit = SUPPS.find(([, re]) => re.test(n));
  const id = hit ? hit[0] : state.supplements.find((s) => n.includes(key(s.name).split(' ')[0]))?.id;
  return state.supplements.some((s) => s.id === id) ? id : null;
}

function guessRoutine(state, exercises) {
  let best = null;
  for (const r of state.routines) {
    const names = r.exercises.map((e) => key(e.name).split(' ').slice(0, 2).join(' '));
    const score = exercises.filter((e) => names.some((n) => key(e.name).startsWith(n))).length;
    if (score && (!best || score > best.score)) best = { score, r };
  }
  return best ? best.r : null;
}

// Convierte el día escrito en texto libre (como en un Excel o un mensaje) en comidas, suplementos, entreno, cardio, etc.
export function parseDayText(state, text) {
  const out = { items: [], supplements: {}, cardio: [], exercises: [], cheat: false, weight: null, bed: '', wake: '', notes: [] };
  let slot = null;

  for (const raw of String(text || '').split(/\r?\n/)) {
    let line = raw.replace(/^\s*[-•*·]+\s*/, '').trim();
    if (!line) continue;
    let n = norm(line);

    const header = SLOTS.find(([, re]) => re.test(n));
    if (header) {
      slot = header[0];
      const len = n.match(header[1])[0].length;
      line = line.slice(len).replace(/^\s*[:\-–]\s*/, '').trim();
      n = norm(line);
      if (!line) continue;
    }

    if (NOTE.test(n)) { out.notes.push(line); continue; }

    const bed = n.match(/acost\w*\D*(\d{1,2})[:.](\d{2})/);
    const wake = n.match(/levant\w*\D*(\d{1,2})[:.](\d{2})/);
    if (bed || wake) {
      if (bed) out.bed = `${bed[1].padStart(2, '0')}:${bed[2]}`;
      if (wake) out.wake = `${wake[1].padStart(2, '0')}:${wake[2]}`;
      continue;
    }
    const weight = n.match(/^(peso|me pes\w*)\D*(\d{2,3}(?:[.,]\d+)?)/);
    if (weight) { out.weight = parseNum(weight[2]); continue; }

    const food = [];
    const parts = line.split(/\s*[,+]\s*/).flatMap((p) => {
      const subs = p.split(/\s+y\s+/);
      return subs.length > 1 && subs.some((x) => supplementId(state, norm(x)) || CARDIO.some(([, re]) => re.test(norm(x)))) ? subs : [p];
    });
    for (const part of parts) {
      const p = part.trim();
      const pn = norm(p);
      if (!p) continue;
      const supp = supplementId(state, pn);
      if (supp) { out.supplements[supp] = true; continue; }
      const cardio = CARDIO.find(([, re]) => re.test(pn));
      const minutes = cardio ? minutesOf(pn) : null;
      if (cardio && minutes) {
        const kcal = pn.match(/(\d+)\s*(kcal|cal|calorias)\b/);
        const hr = pn.match(/(\d+)\s*(ppm|bpm)\b/);
        out.cardio.push({ id: uid(), type: cardio[0], minutes, kcal: kcal ? Number(kcal[1]) : null, hr: hr ? Number(hr[1]) : null });
        continue;
      }
      const sets = pn.match(/(\d+)\s*[x×]\s*(\d+)/);
      if (sets) {
        const kg = pn.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
        out.exercises.push({ name: p.slice(0, sets.index).replace(/[\s:–-]+$/, '').trim(), sets: Number(sets[1]), reps: sets[2], kg: kg ? kg[1] : '' });
        continue;
      }
      if (/\bpermitido\b/.test(pn)) {
        out.cheat = true;
        out.items.push({ slot: slot === 'almuerzo' ? 'almuerzo' : 'cena', ...foodItem(state, 'Permitido') });
        continue;
      }
      food.push(p);
    }
    if (food.length) out.items.push({ slot: slot || 'desayuno', ...foodItem(state, food.join(' + ')) });
  }
  return out;
}

export function applyParsed(state, day, parsed) {
  parsed.items.forEach(({ slot, ...item }) => day.meals[slot].push(item));
  Object.keys(parsed.supplements).forEach((id) => { day.supplements[id] = true; });
  day.cardio.push(...parsed.cardio);
  if (parsed.exercises.length) {
    const routine = guessRoutine(state, parsed.exercises);
    day.strength.push({ id: uid(), routineId: routine ? routine.id : '', name: routine ? routine.name : 'Fuerza', exercises: parsed.exercises, notes: '' });
  }
  if (parsed.cheat) day.cheat = true;
  if (parsed.weight) day.weight = parsed.weight;
  if (parsed.bed) { day.sleep.bed = parsed.bed; day.sleep.source = 'manual'; day.sleep.hours = null; }
  if (parsed.wake) { day.sleep.wake = parsed.wake; day.sleep.source = 'manual'; day.sleep.hours = null; }
  if (parsed.notes.length) day.notes = [day.notes, ...parsed.notes].filter(Boolean).join('\n');
}
