import { MEAL_SLOTS, cardioLabel } from './defaults.js';
import {
  alertsFor, dayTotals, rangeMetrics, sleepOf, weightTrend,
} from './metrics.js';
import { isDayEmpty } from './store.js';
import {
  agoText, fmtDMY, fmtDow, fmtHours, fmtLong, fmtNum, fmtRange, isNum, planWeek, plural,
} from './utils.js';

const LEVEL = { good: '[OK]', warn: '[OJO]', info: '[INFO]' };

function itemText(i) {
  const extra = [
    isNum(i.protein) ? `${fmtNum(i.protein)} g P` : '',
    isNum(i.kcal) ? `${fmtNum(i.kcal)} kcal` : '',
  ].filter(Boolean).join(', ');
  return `${i.text || '(sin descripción)'}${extra ? ` [${extra}]` : ''}`;
}

function kgText(kg) {
  if (kg === null || kg === undefined || String(kg).trim() === '') return '';
  return /^\d+([.,]\d+)?$/.test(String(kg).trim()) ? ` @${kg} kg` : ` @${kg}`;
}

function exerciseText(e) {
  return `${e.name} ${e.sets ?? '?'}x${e.reps || '?'}${kgText(e.kg)}`;
}

function cardioText(c) {
  const parts = [
    `${cardioLabel(c)}: ${c.minutes ?? '?'} min`,
    c.kcal ? `${fmtNum(c.kcal)} kcal` : '',
    c.hr ? `pulso prom. ${c.hr} ppm` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function dayLines(state, iso) {
  const day = state.days[iso];
  const lines = [`### ${fmtLong(iso)}${day?.cheat ? ' · PERMITIDO' : ''}`];
  if (!day || isDayEmpty(day)) return [...lines, '- (sin datos)'];

  for (const slot of MEAL_SLOTS) {
    const items = day.meals[slot.id].filter((i) => i.text || i.protein != null || i.kcal != null);
    if (items.length) lines.push(`- ${slot.label}: ${items.map(itemText).join(' + ')}`);
  }
  const t = dayTotals(day);
  if (t.protein !== null || t.kcal !== null) {
    const bits = [t.protein !== null ? `~${fmtNum(t.protein)} g de proteína` : '', t.kcal !== null ? `~${fmtNum(t.kcal)} kcal` : ''].filter(Boolean);
    const missing = t.items - t.withP;
    lines.push(`- Total estimado: ${bits.join(' · ')}${missing > 0 ? ` (${plural(missing, 'ítem', 'ítems')} sin gramos)` : ''}`);
  }
  const taken = state.supplements.filter((s) => day.supplements[s.id]).map((s) => s.name);
  if (taken.length) lines.push(`- Suplementos: ${taken.join(', ')}`);
  for (const s of day.strength) {
    const exercises = s.exercises.filter((e) => e.name).map(exerciseText).join('; ');
    lines.push(`- Fuerza${s.name ? ` (${s.name})` : ''}: ${exercises || 'sin ejercicios cargados'}${s.notes ? ` · Notas: ${s.notes}` : ''}`);
  }
  day.cardio.forEach((c) => lines.push(`- ${cardioText(c)}`));
  if (day.pushups.max != null || day.pushups.total != null) {
    lines.push(`- Flexiones: ${[day.pushups.max != null ? `máx. ${day.pushups.max} en 1 serie` : '', day.pushups.total != null ? `total ${day.pushups.total}` : ''].filter(Boolean).join(' · ')}`);
  }
  const sleep = sleepOf(day);
  if (sleep.hours !== null || sleep.bed || sleep.wake) {
    const bits = [
      sleep.bed && sleep.wake ? `${sleep.bed} → ${sleep.wake}` : '',
      sleep.hours !== null ? fmtHours(sleep.hours) : '',
      isNum(sleep.quality) ? `calidad ${sleep.quality}/5` : '',
      isNum(sleep.napMin) ? `siesta ${sleep.napMin} min` : '',
    ].filter(Boolean);
    lines.push(`- Sueño: ${bits.join(' · ')}`);
  }
  const body = [
    isNum(day.weight) ? `peso ${fmtNum(day.weight, 2)} kg` : '',
    isNum(day.steps) ? `${fmtNum(day.steps)} pasos` : '',
    isNum(day.energy) ? `energía ${day.energy}/10` : '',
    isNum(day.hunger) ? `hambre ${day.hunger}/10` : '',
  ].filter(Boolean);
  if (body.length) lines.push(`- Cuerpo: ${body.join(' · ')}`);
  if ((day.notes || '').trim()) lines.push(`- Notas: ${day.notes.trim()}`);
  return lines;
}

export function buildReport(state, from, to, { detail = true } = {}) {
  const m = rangeMetrics(state, from, to);
  const p = state.profile;
  const t = state.targets;
  const trend = weightTrend(state);
  const week = planWeek(from, p.planStart);
  const L = [];

  L.push(`# HealthTrust · ${fmtRange(from, to)}${week ? ` · semana ${week} del plan` : ''}`);
  L.push('');
  const profile = [
    p.name,
    isNum(p.age) ? `${p.age} años` : '',
    isNum(p.heightCm) ? `${p.heightCm} cm` : '',
    isNum(p.goalWeightKg) ? `objetivo ${fmtNum(p.goalWeightKg, 1)} kg` : '',
  ].filter(Boolean).join(' · ');
  if (profile) L.push(`**Perfil:** ${profile}`);
  L.push(`**Objetivos por día:** ${fmtNum(t.kcalMin)}–${fmtNum(t.kcalMax)} kcal · ${t.proteinG} g de proteína · ${t.sleepH} h de sueño (acostarme antes de las ${t.bedtime}) · ${fmtNum(t.stepsPerDay)} pasos`);
  L.push(`**Objetivos por semana:** ${t.strengthPerWeek} sesiones de fuerza · ${t.cardioMinPerWeek} min de cardio · máximo ${t.cheatPerWeek} permitido`);
  if (trend) {
    const bits = [
      `último ${fmtNum(trend.last.kg, 2)} kg el ${fmtDMY(trend.last.date)} (${agoText(trend.daysSinceLast)})`,
      `inicial ${fmtNum(trend.first.kg, 2)} kg el ${fmtDMY(trend.first.date)}`,
    ];
    if (trend.slopeWeek !== null) bits.push(`tendencia ${trend.slopeWeek > 0 ? '+' : ''}${fmtNum(trend.slopeWeek, 2)} kg/semana`);
    if (trend.eta) bits.push(`llegada estimada al objetivo: ${fmtDMY(trend.eta)}`);
    L.push(`**Peso:** ${bits.join(' · ')}`);
  }

  L.push('');
  L.push('## Resumen del período');
  L.push(`- Días cargados: ${m.logged} de ${m.totalDays}`);
  L.push(`- Fuerza: ${plural(m.strength, 'sesión', 'sesiones')}${m.strengthNames.length ? ` (${m.strengthNames.join(', ')})` : ''}`);
  const byType = Object.entries(m.cardioByType).map(([type, min]) => `${cardioLabel({ type })} ${min}`).join(', ');
  L.push(`- Cardio: ${m.cardioMin} min${byType ? ` (${byType})` : ''}${m.cardioKcal ? ` · ${fmtNum(m.cardioKcal)} kcal quemadas` : ''}`);
  L.push(`- Proteína estimada: ${m.proteinAvg !== null ? `~${fmtNum(m.proteinAvg)} g/día (promedio de ${plural(m.proteinDays, 'día completo', 'días completos')})` : 'sin días completos'}`);
  L.push(`- Calorías estimadas: ${m.kcalAvg !== null ? `~${fmtNum(m.kcalAvg)} kcal/día (promedio de ${plural(m.kcalDays, 'día completo', 'días completos')})` : 'sin días completos'}`);
  L.push(`- Desayuno con proteína: ${m.breakfastProtein} de ${plural(m.mealDays, 'día', 'días')} con comidas`);
  L.push(`- Permitidos: ${m.cheatDates.length}${m.cheatDates.length ? ` (${m.cheatDates.map(fmtDow).join(', ')})` : ''}`);
  const sleepBits = [
    m.sleepAvg !== null ? `${fmtHours(m.sleepAvg)} de promedio (${plural(m.sleepNights, 'noche', 'noches')})` : 'sin datos',
    m.bedAvg ? `me acuesto ~${m.bedAvg}` : '',
    m.lateNights ? `${plural(m.lateNights, 'noche', 'noches')} después de las ${m.lateLimit}` : '',
  ].filter(Boolean);
  L.push(`- Sueño: ${sleepBits.join(' · ')}`);
  if (m.stepsAvg !== null) L.push(`- Pasos: ${fmtNum(m.stepsAvg)} de promedio`);
  if (m.pushMax !== null) L.push(`- Flexiones: máx. ${m.pushMax} en 1 serie (${fmtDow(m.pushDate)})`);
  if (m.energyAvg !== null || m.hungerAvg !== null) {
    L.push(`- Energía ${m.energyAvg !== null ? fmtNum(m.energyAvg, 1) : '—'}/10 · Hambre ${m.hungerAvg !== null ? fmtNum(m.hungerAvg, 1) : '—'}/10`);
  }
  if (state.supplements.length && m.trackedDays) {
    L.push(`- Suplementos: ${state.supplements.map((s) => `${s.name} ${m.supp[s.id]}/${m.trackedDays}`).join(' · ')}`);
  }

  L.push('');
  L.push('## Alertas automáticas');
  alertsFor(state, m).forEach((a) => L.push(`- ${LEVEL[a.level]} ${a.text}`));

  if (detail) {
    L.push('');
    L.push('## Día a día');
    for (const iso of m.dates) {
      L.push('');
      L.push(...dayLines(state, iso));
    }
  }

  L.push('');
  L.push('_Generado con HealthTrust. Proteína y calorías son estimaciones._');
  return L.join('\n');
}
