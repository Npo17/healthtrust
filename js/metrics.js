import { MEAL_SLOTS } from './defaults.js';
import { isDayEmpty } from './store.js';
import {
  addDays, agoText, avg, dateRange, diffDays, fmtDMY, fmtHours, fmtNum, isNum, minToTime, plural, round, sleepHours, sum,
  timeToMin, todayISO,
} from './utils.js';

const PROTEIN_WORDS = /huevo|yogur|scoop|whey|prote|pancake|at[uú]n|pollo|carne|lomo|bife|pechuga|nalga|vac[ií]o|entra[ñn]a|cerdo|pescado|merluza/i;
const ZERO_DRINKS = /^(1 )?(caf[eé] negro|caf[eé] helado|mate|t[eé]|agua|soda|coca zero)/i;

const filled = (i) => i.text || i.protein != null || i.kcal != null;

// Café, mate o gaseosa zero no cuentan para decidir si un día tiene todas las comidas con gramos.
function isTrivial(i) {
  if (isNum(i.kcal)) return i.kcal <= 20 && (!isNum(i.protein) || i.protein <= 1);
  return i.protein == null && ZERO_DRINKS.test((i.text || '').trim());
}

export function sleepOf(day) {
  const s = day?.sleep || {};
  const hours = sleepHours(s.bed, s.wake) ?? (isNum(s.hours) ? s.hours : null);
  return { ...s, hours };
}

export function dayTotals(day) {
  let protein = 0;
  let kcal = 0;
  let items = 0;
  let withP = 0;
  let withK = 0;
  let any = false;
  for (const slot of MEAL_SLOTS) {
    for (const it of day.meals[slot.id] || []) {
      if (!filled(it)) continue;
      any = true;
      if (isNum(it.protein)) protein += it.protein;
      if (isNum(it.kcal)) kcal += it.kcal;
      if (isTrivial(it)) continue;
      items += 1;
      if (isNum(it.protein)) withP += 1;
      if (isNum(it.kcal)) withK += 1;
    }
  }
  const hasMain = ['almuerzo', 'cena'].some((id) => (day.meals[id] || []).some(filled));
  const { cardio } = day;
  return {
    protein: withP ? protein : null,
    kcal: withK ? kcal : null,
    any,
    items,
    withP,
    withK,
    completeP: hasMain && items > 0 && withP === items,
    completeK: hasMain && items > 0 && withK === items,
    cardioMin: sum(cardio.map((c) => c.minutes || 0)),
    cardioKcal: sum(cardio.map((c) => c.kcal || 0)),
    strength: day.strength.length > 0,
    sleepH: sleepOf(day).hours,
  };
}

export function breakfastHasProtein(day) {
  const items = day.meals.desayuno || [];
  const grams = sum(items.map((i) => (isNum(i.protein) ? i.protein : 0)));
  return grams >= 15 || items.some((i) => PROTEIN_WORDS.test(i.text || ''));
}

// Minutos después de las 18:00, para promediar horarios de acostarse que cruzan la medianoche.
function bedOffset(time) {
  const m = timeToMin(time);
  return m === null ? null : (m - 18 * 60 + 1440) % 1440;
}

export function rangeMetrics(state, from, to) {
  const dates = dateRange(from, to);
  const entries = dates
    .map((iso) => ({ iso, day: state.days[iso] }))
    .filter((e) => e.day && !isDayEmpty(e.day))
    .map((e) => ({ ...e, t: dayTotals(e.day) }));

  const mealDays = entries.filter((e) => e.t.any);
  const proteinDays = mealDays.filter((e) => e.t.completeP);
  const kcalDays = mealDays.filter((e) => e.t.completeK);
  const trackedDays = entries.filter((e) => e.t.any || Object.values(e.day.supplements).some(Boolean));

  const sleeps = entries.filter((e) => e.t.sleepH != null);
  const beds = entries.map((e) => bedOffset(e.day.sleep?.bed)).filter((m) => m !== null);
  const lateLimit = (bedOffset(state.targets.bedtime) ?? 390) + 30;

  const cardioByType = {};
  for (const e of entries) {
    for (const c of e.day.cardio) {
      cardioByType[c.type] = (cardioByType[c.type] || 0) + (c.minutes || 0);
    }
  }

  const supp = {};
  for (const s of state.supplements) supp[s.id] = trackedDays.filter((e) => e.day.supplements[s.id]).length;

  let pushMax = null;
  let pushDate = null;
  for (const e of entries) {
    const m = e.day.pushups?.max;
    if (isNum(m) && (pushMax === null || m > pushMax)) { pushMax = m; pushDate = e.iso; }
  }

  const steps = entries.map((e) => e.day.steps).filter(isNum);
  const energy = entries.map((e) => e.day.energy).filter(isNum);
  const hunger = entries.map((e) => e.day.hunger).filter(isNum);

  return {
    from,
    to,
    dates,
    totalDays: dates.length,
    logged: entries.length,
    mealDays: mealDays.length,
    trackedDays: trackedDays.length,
    strength: entries.filter((e) => e.t.strength).length,
    strengthNames: entries.flatMap((e) => e.day.strength.map((s) => s.name).filter(Boolean)),
    cardioMin: sum(entries.map((e) => e.t.cardioMin)),
    cardioKcal: sum(entries.map((e) => e.t.cardioKcal)),
    cardioByType,
    proteinAvg: proteinDays.length ? avg(proteinDays.map((e) => e.t.protein)) : null,
    proteinDays: proteinDays.length,
    kcalAvg: kcalDays.length ? avg(kcalDays.map((e) => e.t.kcal)) : null,
    kcalDays: kcalDays.length,
    breakfastProtein: mealDays.filter((e) => breakfastHasProtein(e.day)).length,
    cheatDates: entries.filter((e) => e.day.cheat).map((e) => e.iso),
    supp,
    sleepAvg: sleeps.length ? avg(sleeps.map((e) => e.t.sleepH)) : null,
    sleepNights: sleeps.length,
    bedAvg: beds.length ? minToTime(avg(beds) + 18 * 60) : null,
    lateNights: beds.filter((m) => m > lateLimit).length,
    lateLimit: minToTime(lateLimit + 18 * 60),
    pushMax,
    pushDate,
    stepsAvg: steps.length ? avg(steps) : null,
    energyAvg: energy.length ? avg(energy) : null,
    hungerAvg: hunger.length ? avg(hunger) : null,
  };
}

export function weightSeries(state) {
  return Object.entries(state.days)
    .filter(([, d]) => isNum(d.weight))
    .map(([date, d]) => ({ date, kg: d.weight }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function weightTrend(state) {
  const series = weightSeries(state);
  if (!series.length) return null;
  const first = series[0];
  const last = series[series.length - 1];
  const recent = series.filter((p) => diffDays(p.date, last.date) <= 120);
  let slopeWeek = null;
  if (recent.length >= 2 && diffDays(recent[0].date, last.date) >= 10) {
    const xs = recent.map((p) => diffDays(recent[0].date, p.date));
    const ys = recent.map((p) => p.kg);
    const mx = avg(xs);
    const my = avg(ys);
    let sxy = 0;
    let sxx = 0;
    xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
    if (sxx > 0) slopeWeek = (sxy / sxx) * 7;
  }
  const goal = isNum(state.profile.goalWeightKg) ? state.profile.goalWeightKg : null;
  let eta = null;
  if (goal !== null && slopeWeek !== null && slopeWeek < -0.05 && last.kg > goal) {
    const weeks = (last.kg - goal) / -slopeWeek;
    if (weeks < 104) eta = addDays(last.date, Math.round(weeks * 7));
  }
  return { series, first, last, slopeWeek, goal, eta, daysSinceLast: diffDays(last.date, todayISO()) };
}

export function bestPushups(state) {
  let best = null;
  for (const [date, d] of Object.entries(state.days)) {
    const m = d.pushups?.max;
    if (isNum(m) && (!best || m > best.max)) best = { max: m, date };
  }
  return best;
}

export function exerciseProgress(state) {
  const map = new Map();
  for (const date of Object.keys(state.days).sort()) {
    for (const session of state.days[date].strength) {
      for (const e of session.exercises) {
        const name = (e.name || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (!map.has(key)) map.set(key, { name, entries: [], bestKg: null });
        const rec = map.get(key);
        rec.entries.push({ date, sets: e.sets, reps: e.reps, kg: e.kg });
        const kg = parseFloat(String(e.kg ?? '').replace(',', '.'));
        if (Number.isFinite(kg) && (rec.bestKg === null || kg > rec.bestKg)) rec.bestKg = kg;
      }
    }
  }
  return [...map.values()]
    .filter((r) => r.entries.length >= 2)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function alertsFor(state, m) {
  const t = state.targets;
  const today = todayISO();
  const finished = m.to < today;
  const weeks = m.totalDays / 7;
  const out = [];
  const add = (level, text) => out.push({ level, text });

  if (!m.logged) {
    add('info', 'No hay nada cargado en este período.');
    return out;
  }

  const missing = m.dates.filter((d) => d < today && isDayEmpty(state.days[d])).length;
  if (missing > 0) add('info', `${plural(missing, 'día pasado sin cargar', 'días pasados sin cargar')}. Aunque sea anotá lo principal.`);

  const strengthGoal = Math.max(1, Math.round(t.strengthPerWeek * weeks));
  if (m.strength >= strengthGoal) add('good', `Fuerza: ${m.strength} sesiones (objetivo ${strengthGoal}).`);
  else add(finished ? 'warn' : 'info', `Fuerza: ${m.strength} de ${strengthGoal} sesiones.`);

  const cardioGoal = Math.round(t.cardioMinPerWeek * weeks);
  if (m.cardioMin >= cardioGoal) add('good', `Cardio: ${m.cardioMin} min (objetivo ${cardioGoal}).`);
  else add(finished ? 'warn' : 'info', `Cardio: ${m.cardioMin} de ${cardioGoal} min.`);

  // Con menos de 3 días completos el promedio no es representativo: se informa pero no se juzga.
  const enough = (days) => days > 0 && days >= Math.min(3, m.mealDays);
  const incomplete = m.mealDays - Math.min(m.proteinDays, m.kcalDays);
  if (m.mealDays && incomplete > 0) {
    add('info', `${plural(incomplete, 'día quedó', 'días quedaron')} fuera del promedio de proteína y calorías: falta el almuerzo o la cena, o alguna comida no tiene gramos.`);
  }

  if (enough(m.proteinDays)) {
    if (m.proteinAvg >= t.proteinG - 10) add('good', `Proteína estimada: ~${fmtNum(m.proteinAvg)} g/día (objetivo ${t.proteinG} g).`);
    else add('warn', `Proteína estimada: ~${fmtNum(m.proteinAvg)} g/día, por debajo de ${t.proteinG} g. Sumá una porción de carne o pollo, yogur o un scoop.`);
  } else if (m.mealDays) {
    add('info', `Solo ${plural(m.proteinDays, 'día completo', 'días completos')} con gramos de proteína: no alcanza para sacar un promedio confiable.`);
  }

  if (enough(m.kcalDays)) {
    if (m.kcalAvg < t.kcalMin - 300) add('warn', `Calorías estimadas: ~${fmtNum(m.kcalAvg)} kcal/día, muy por debajo de ${fmtNum(t.kcalMin)}. Si te sentís cansado, sumá carbohidratos alrededor del entreno.`);
    else if (m.kcalAvg > t.kcalMax + 250) add('warn', `Calorías estimadas: ~${fmtNum(m.kcalAvg)} kcal/día, por encima de ${fmtNum(t.kcalMax)}.`);
    else add('good', `Calorías estimadas: ~${fmtNum(m.kcalAvg)} kcal/día, dentro del rango.`);
  }

  if (m.mealDays) {
    const noBreakfast = m.mealDays - m.breakfastProtein;
    if (noBreakfast >= 2) add('warn', `Desayuno sin proteína ${noBreakfast} días. Huevos, yogur o un scoop a la mañana bajan el hambre de la tarde.`);
    else if (noBreakfast === 0 && m.mealDays >= 3) add('good', 'Desayuno con proteína todos los días cargados.');
  }

  const cheatGoal = Math.max(1, Math.round(t.cheatPerWeek * weeks));
  if (m.cheatDates.length > cheatGoal) add('warn', `${plural(m.cheatDates.length, 'permitido', 'permitidos')} (objetivo ${t.cheatPerWeek} por semana).`);
  else if (m.cheatDates.length) add('good', `${plural(m.cheatDates.length, 'permitido', 'permitidos')}, dentro del plan.`);
  if (m.cheatDates.some((d) => m.cheatDates.includes(addDays(d, 1)))) {
    add('warn', 'Dos días seguidos de permitido: el segundo día suele frenar el progreso de toda la semana.');
  }

  if (m.sleepAvg !== null) {
    if (m.sleepAvg < t.sleepH - 0.25) add('warn', `Sueño promedio: ${fmtHours(m.sleepAvg)} (objetivo ${t.sleepH} h).`);
    else add('good', `Sueño promedio: ${fmtHours(m.sleepAvg)}.`);
  }
  if (m.lateNights >= 3) add('warn', `Te acostaste después de las ${m.lateLimit} ${plural(m.lateNights, 'noche', 'noches')}.`);

  if (m.trackedDays) {
    const low = state.supplements.filter((s) => m.supp[s.id] / m.trackedDays < 0.7).map((s) => s.name);
    if (low.length) add('info', `Suplementos con poca constancia: ${low.join(', ')}.`);
  }

  const trend = weightTrend(state);
  if (!trend) add('info', 'Todavía no cargaste ningún peso.');
  else if (trend.daysSinceLast > 14) add('info', `Último pesaje: ${fmtNum(trend.last.kg, 2)} kg el ${fmtDMY(trend.last.date)} (${agoText(trend.daysSinceLast)}).`);

  return out;
}
