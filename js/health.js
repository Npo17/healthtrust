import { rangeMetrics, weightTrend } from './metrics.js';
import { isDayEmpty } from './store.js';
import {
  addDays, agoText, fmtHours, fmtNum, isNum, plural, todayISO,
} from './utils.js';

const CARBS = /arroz|papa|batata|fideo|pasta|tostada|\bpan\b|avena|quinoa|lenteja|garbanzo|choclo|tarta|empanada|pizza|wrap|tortilla|banana|fruta|cereal|chorip/i;
const LEG_DAYS_PER_WEEK = 2;

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

function mealText(day, slots) {
  return slots.flatMap((s) => day.meals[s] || []).map((i) => i.text || '').join(' ');
}

// Puntajes de 0 a 100 por área y la acción concreta para mejorar cada una.
export function healthReport(state, days = 14) {
  const to = todayISO();
  const from = addDays(to, -(days - 1));
  const m = rangeMetrics(state, from, to);
  const t = state.targets;
  const weeks = days / 7;
  const logged = m.dates.map((d) => state.days[d]).filter((d) => d && !isDayEmpty(d));
  const areas = {};
  const add = (id, label, pct, status, tip = '', details = []) => {
    areas[id] = { id, label, pct: pct === null ? null : clamp(pct), status, tip, details };
  };

  if (m.sleepNights) {
    const late = m.lateNights / m.sleepNights;
    add('sueno', 'Sueño', (m.sleepAvg / t.sleepH) * 100 - late * 25,
      `${fmtHours(m.sleepAvg)} de promedio${m.bedAvg ? `, te acostás ~${m.bedAvg}` : ''}.`,
      m.sleepAvg < t.sleepH - 0.25 || m.lateNights
        ? `Acostate antes de las ${t.bedtime}${m.lateNights ? ` (${m.lateNights} de ${m.sleepNights} noches te dormiste tarde)` : ''} y apuntá a ${t.sleepH} h. Dormir poco sube el hambre y baja la fuerza.`
        : '');
  } else {
    add('sueno', 'Sueño', null, 'Sin datos de sueño.', 'Cargá a qué hora te acostaste y te levantaste: es lo que más explica tu energía.');
  }

  const strengthGoal = Math.round(t.strengthPerWeek * weeks);
  const kgLogged = logged.some((d) => d.strength.some((s) => s.exercises.some((e) => String(e.kg ?? '').trim())));
  add('fuerza', 'Fuerza', (m.strength / strengthGoal) * 100,
    `${m.strength} de ${strengthGoal} sesiones en ${days} días.`,
    m.strength < strengthGoal
      ? `Te faltaron ${plural(strengthGoal - m.strength, 'sesión', 'sesiones')}. Si no llegás a la rutina completa, hacé una versión corta de 30 minutos.`
      : kgLogged ? '' : 'Anotá los kilos de cada ejercicio: sin eso no podemos ver si estás progresando o estancado.');

  const legSessions = logged.flatMap((d) => d.strength)
    .filter((s) => ['pierna', 'full'].includes(s.routineId) || /pierna|full/i.test(s.name || '')).length;
  const legGoal = Math.round(LEG_DAYS_PER_WEEK * weeks);
  add('piernas', 'Piernas', (legSessions / legGoal) * 100,
    `${plural(legSessions, 'sesión', 'sesiones')} de pierna o full body.`,
    legSessions < legGoal ? `Hacé piernas ${LEG_DAYS_PER_WEEK} veces por semana: son los músculos más grandes y los que más calorías queman.` : '');

  const cardioGoal = Math.round(t.cardioMinPerWeek * weeks);
  add('cardio', 'Cardio', (m.cardioMin / cardioGoal) * 100,
    `${m.cardioMin} de ${cardioGoal} min${m.cardioKcal ? ` · ${fmtNum(m.cardioKcal)} kcal quemadas` : ''}.`,
    m.cardioMin < cardioGoal ? `Te faltan ${cardioGoal - m.cardioMin} min: sumá 2 bicis de 40 min por semana a ritmo cómodo (pulso 120–140).` : '');

  const trend = weightTrend(state);
  if (trend && isNum(trend.goal) && trend.first.kg > trend.goal) {
    const left = trend.last.kg - trend.goal;
    const tips = [];
    if (trend.daysSinceLast > 7) tips.push(`Tu último pesaje fue ${agoText(trend.daysSinceLast)}: pesate en ayunas una vez por semana.`);
    if (trend.slopeWeek !== null && trend.slopeWeek > -0.2 && left > 0) tips.push('Venís bajando lento: el promedio semanal manda, así que sostené el permitido en una sola comida.');
    add('peso', 'Panza / peso', ((trend.first.kg - trend.last.kg) / (trend.first.kg - trend.goal)) * 100,
      `${fmtNum(trend.last.kg, 2)} kg · ${left > 0 ? `faltan ${fmtNum(left, 1)} kg para ${fmtNum(trend.goal, 0)}` : 'objetivo alcanzado'}.`,
      tips.join(' '));
  } else {
    add('peso', 'Panza / peso', null, 'Sin pesajes o sin objetivo.', 'Cargá tu peso en ayunas y tu peso objetivo en Ajustes.');
  }

  const enough = (n) => n > 0 && n >= Math.min(3, m.mealDays);
  if (enough(m.proteinDays)) {
    add('proteina', 'Proteína', (m.proteinAvg / t.proteinG) * 100,
      `~${fmtNum(m.proteinAvg)} g por día (meta ${t.proteinG} g).`,
      m.proteinAvg < t.proteinG - 10 ? `Te faltan ~${fmtNum(t.proteinG - m.proteinAvg)} g por día: un yogur con scoop o 150 g más de pollo en la cena lo resuelven.` : '');
  } else {
    add('proteina', 'Proteína', null, 'Faltan comidas con gramos.', 'Usá los botones de comidas frecuentes: ya traen la proteína estimada.');
  }

  if (enough(m.kcalDays)) {
    let pct = 100;
    let tip = '';
    if (m.kcalAvg < t.kcalMin) {
      pct = 100 - ((t.kcalMin - m.kcalAvg) / t.kcalMin) * 150;
      tip = `Estás ~${fmtNum(t.kcalMin - m.kcalAvg)} kcal por debajo del mínimo: un déficit tan grande da cansancio y frena el músculo. Sumá 1 taza de arroz o papa en la cena (+250 kcal) y una banana antes de entrenar.`;
    } else if (m.kcalAvg > t.kcalMax) {
      pct = 100 - ((m.kcalAvg - t.kcalMax) / t.kcalMax) * 200;
      tip = `Estás ~${fmtNum(m.kcalAvg - t.kcalMax)} kcal arriba del máximo: revisá picoteos y salsas.`;
    }
    add('calorias', 'Calorías', pct, `~${fmtNum(m.kcalAvg)} kcal por día (meta ${fmtNum(t.kcalMin)}–${fmtNum(t.kcalMax)}).`, tip);
  } else {
    add('calorias', 'Calorías', null, 'Faltan días completos.', 'Cargá almuerzo o cena con sus calorías para calcular el promedio.');
  }

  const mainDays = logged.filter((d) => mealText(d, ['almuerzo', 'cena']).trim());
  const carbDays = mainDays.filter((d) => CARBS.test(mealText(d, ['almuerzo', 'cena', 'post'])));
  if (mainDays.length) {
    add('carbos', 'Carbohidratos', (carbDays.length / mainDays.length / 0.8) * 100,
      `${carbDays.length} de ${plural(mainDays.length, 'día', 'días')} con carbohidratos en almuerzo, post o cena.`,
      carbDays.length / mainDays.length < 0.8 ? 'Sumá arroz, papa, batata o fideos en la comida después de entrenar: rendís más y bajás el antojo de dulce a la noche.' : '');
  } else {
    add('carbos', 'Carbohidratos', null, 'Sin almuerzos ni cenas cargados.', 'Cargá almuerzo y cena para ver si te faltan carbohidratos.');
  }

  if (m.trackedDays && state.supplements.length) {
    const details = state.supplements.map((s) => ({ name: s.name, pct: clamp((m.supp[s.id] / m.trackedDays) * 100), count: `${m.supp[s.id]}/${m.trackedDays}` }));
    const low = details.filter((d) => d.pct < 90);
    add('suplementos', 'Suplementos', details.reduce((a, d) => a + d.pct, 0) / details.length,
      low.length ? `Te olvidás: ${low.map((d) => `${d.name} (${d.count})`).join(', ')}.` : 'Todos los días, perfecto.',
      low.length ? `Dejá ${low.map((d) => d.name.toLowerCase()).join(' y ')} al lado del café para tomarlo en el desayuno. La creatina funciona si se toma todos los días.` : '',
      details);
  } else {
    add('suplementos', 'Suplementos', null, 'Sin suplementos marcados.', 'Marcá los suplementos de cada día (hay un botón "Marcar todos").');
  }

  const past = m.dates.filter((d) => d < to);
  const loggedPast = past.filter((d) => !isDayEmpty(state.days[d])).length;
  add('registro', 'Constancia al cargar', past.length ? (loggedPast / past.length) * 100 : null,
    `${loggedPast} de ${plural(past.length, 'día cargado', 'días cargados')}.`,
    loggedPast < past.length ? 'Con 1 minuto por día alcanza: tocá "Mi día típico" y ajustá lo que cambió.' : '');

  const scored = Object.values(areas).filter((a) => a.pct !== null);
  const overall = scored.length ? clamp(scored.reduce((a, b) => a + b.pct, 0) / scored.length) : null;
  return { from, to, days, areas, overall };
}

export function levelOf(pct) {
  if (pct === null) return 'none';
  if (pct >= 80) return 'good';
  if (pct >= 50) return 'mid';
  return 'bad';
}
