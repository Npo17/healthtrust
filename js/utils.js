export const DAY_MS = 86400000;

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function parseNum(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Acepta minutos ("62") o el formato del reloj: "1:02:24" (h:mm:ss) o "45:30" (mm:ss).
export function parseDuration(value) {
  const s = String(value ?? '').trim();
  if (!s.includes(':')) return parseNum(s);
  const parts = s.split(':').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  const [h, m, sec] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  return Math.round(h * 60 + m + sec / 60);
}

export function numValue(n) {
  return n === null || n === undefined || n === '' ? '' : String(n).replace('.', ',');
}

export function fmtNum(n, decimals = 0) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtHours(hours) {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return '—';
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function agoText(days) {
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

export const sum = (arr) => arr.reduce((a, b) => a + b, 0);
export const avg = (arr) => (arr.length ? sum(arr) / arr.length : null);
export const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (o[keys[i]] == null) o[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}

export function download(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const todayISO = () => toISO(new Date());

export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function isValidISO(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromISO(s).getTime());
}

export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function diffDays(a, b) {
  return Math.round((fromISO(b) - fromISO(a)) / DAY_MS);
}

export function weekStart(iso) {
  const d = fromISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}

export function weekDays(start) {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DOW_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MON_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function fmtDow(iso) {
  return DOW[fromISO(iso).getDay()];
}

export function fmtShort(iso) {
  const d = fromISO(iso);
  return `${DOW[d.getDay()]} ${d.getDate()}`;
}

export function fmtLong(iso) {
  const d = fromISO(iso);
  return `${DOW_LONG[d.getDay()]} ${d.getDate()} de ${MON_LONG[d.getMonth()]}`;
}

export function fmtDM(iso) {
  const d = fromISO(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function fmtDMY(iso) {
  return `${fmtDM(iso)}/${iso.slice(0, 4)}`;
}

export function fmtRange(a, b) {
  const da = fromISO(a);
  const db = fromISO(b);
  if (da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear()) {
    return `${da.getDate()}–${db.getDate()} ${MON[db.getMonth()]} ${db.getFullYear()}`;
  }
  return `${da.getDate()} ${MON[da.getMonth()]} – ${db.getDate()} ${MON[db.getMonth()]} ${db.getFullYear()}`;
}

export function planWeek(iso, planStart) {
  if (!isValidISO(planStart)) return null;
  const n = Math.floor(diffDays(weekStart(planStart), weekStart(iso)) / 7) + 1;
  return n >= 1 ? n : null;
}

export function isoWeek(iso) {
  const d = fromISO(iso);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / DAY_MS + 1) / 7);
}

export function timeToMin(t) {
  if (!/^\d{1,2}:\d{2}$/.test(t || '')) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minToTime(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function sleepHours(bed, wake) {
  const b = timeToMin(bed);
  const w = timeToMin(wake);
  if (b === null || w === null) return null;
  let diff = w - b;
  if (diff <= 0) diff += 1440;
  return diff / 60;
}
