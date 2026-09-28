import {
  STORAGE_KEY, ensureDay, loadState, mergeStates, normalizeState, saveState,
} from './store.js';
import { parseDuration, parseNum, setPath } from './utils.js';
import * as dayView from './views/day.js';
import * as weekView from './views/week.js';
import * as progressView from './views/progress.js';
import * as coachView from './views/coach.js';
import * as settingsView from './views/settings.js';

const views = {
  hoy: dayView,
  semana: weekView,
  progreso: progressView,
  coach: coachView,
  ajustes: settingsView,
};

const root = document.getElementById('view');
const saveLabel = document.getElementById('save-state');
const ctx = { state: loadState(), route: 'hoy', params: new URLSearchParams() };

let saveTimer = null;
let liveTimer = null;
let toastTimer = null;

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const ok = saveState(ctx.state);
  saveLabel.textContent = ok ? 'Guardado' : 'Error al guardar';
  saveLabel.classList.toggle('error', !ok);
  if (!ok) toast('No se pudo guardar: el almacenamiento del navegador está lleno.');
}

function saveSoon() {
  saveLabel.textContent = 'Guardando…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

function toast(message, ms = 2800) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function go(route, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();
  const hash = `#/${route}${qs ? `?${qs}` : ''}`;
  if (location.hash === hash) render();
  else location.hash = hash;
}

function parseRoute() {
  const [name, qs] = location.hash.replace(/^#\/?/, '').split('?');
  ctx.route = views[name] ? name : 'hoy';
  ctx.params = new URLSearchParams(qs || '');
}

function render({ focus = null, resetScroll = false } = {}) {
  const active = document.activeElement;
  const key = focus || (active && root.contains(active) ? active.dataset.path || active.id : null);
  let selection = null;
  if (!focus && active && typeof active.selectionStart === 'number') {
    selection = [active.selectionStart, active.selectionEnd];
  }
  const y = resetScroll ? 0 : window.scrollY;
  root.innerHTML = views[ctx.route].render(ctx);
  window.scrollTo(0, y);

  if (key) {
    const safe = key.replace(/["\\]/g, '\\$&');
    const el = root.querySelector(`[data-path="${safe}"]`) || document.getElementById(key);
    if (el) {
      el.focus({ preventScroll: !focus });
      if (selection && typeof el.setSelectionRange === 'function') {
        try { el.setSelectionRange(selection[0], selection[1]); } catch { /* el tipo de input no admite selección */ }
      }
    }
  }
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.route === ctx.route));
}

Object.assign(ctx, {
  toast,
  go,
  render,
  save: saveNow,
  commit(options) {
    saveNow();
    render(options);
  },
  replaceState(next) {
    ctx.state = next;
    saveNow();
    render({ resetScroll: true });
  },
});

function writeValue(el) {
  const path = el.dataset.path;
  const dayMatch = path.match(/^days\.(\d{4}-\d{2}-\d{2})\./);
  if (dayMatch) ensureDay(ctx.state, dayMatch[1]);
  let value;
  if (el.type === 'checkbox') value = el.checked;
  else if ('dur' in el.dataset) value = parseDuration(el.value);
  else if ('num' in el.dataset) value = parseNum(el.value);
  else value = el.value;
  setPath(ctx.state, path, value);
  if (dayMatch && /\.sleep\.(bed|wake)$/.test(path)) {
    const { sleep } = ctx.state.days[dayMatch[1]];
    sleep.source = 'manual';
    sleep.hours = null;
  }
}

// Actualiza solo los bloques marcados con data-live (totales, horas de sueño) sin perder el foco del input.
function refreshLive() {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    const live = root.querySelectorAll('[data-live]');
    if (!live.length) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = views[ctx.route].render(ctx);
    live.forEach((el) => {
      const fresh = tmp.querySelector(`[data-live="${el.dataset.live}"]`);
      if (fresh && fresh.innerHTML !== el.innerHTML) el.innerHTML = fresh.innerHTML;
    });
  }, 150);
}

function actionFor(name) {
  return name ? views[ctx.route].actions?.[name] : null;
}

root.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el || !root.contains(el)) return;
  const handler = actionFor(el.dataset.action);
  if (!handler) return;
  event.preventDefault();
  Promise.resolve(handler(el, ctx, event)).catch((err) => {
    console.error(err);
    toast(`Error: ${err.message}`, 5000);
  });
});

root.addEventListener('input', (event) => {
  const el = event.target;
  if (!el.dataset.path || el.type === 'checkbox' || el.tagName === 'SELECT') return;
  writeValue(el);
  saveSoon();
  refreshLive();
});

root.addEventListener('change', async (event) => {
  const el = event.target;
  if (el.dataset.file) {
    const files = [...(el.files || [])];
    el.value = '';
    const handler = actionFor(`file-${el.dataset.file}`);
    if (!files.length || !handler) return;
    try {
      await handler(files, ctx);
    } catch (err) {
      console.error(err);
      toast(`Error: ${err.message}`, 6000);
    }
    return;
  }
  if (el.dataset.path) {
    writeValue(el);
    saveNow();
    if (el.type === 'checkbox' || el.tagName === 'SELECT' || 'rerender' in el.dataset) render();
    else refreshLive();
    return;
  }
  const handler = actionFor(el.dataset.change);
  if (handler) handler(el, ctx, event);
});

window.addEventListener('hashchange', () => {
  parseRoute();
  render({ resetScroll: true });
  views[ctx.route].onEnter?.(ctx);
});

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  ctx.state = loadState();
  render();
});

window.addEventListener('pagehide', () => { if (saveTimer) saveNow(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && saveTimer) saveNow();
});

const SEED_VERSION = 2;

async function loadHistory() {
  if ((ctx.state.meta.seedVersion || 0) >= SEED_VERSION) return;
  try {
    const res = await fetch('data/historial.json', { cache: 'no-store' });
    if (!res.ok) return;
    mergeStates(ctx.state, normalizeState(await res.json()));
    ctx.state.meta.seedVersion = SEED_VERSION;
    saveNow();
    render();
    toast('Actualicé tu historial con los últimos días.');
  } catch (err) {
    console.error(err);
  }
}

parseRoute();
render({ resetScroll: true });
views[ctx.route].onEnter?.(ctx);
loadHistory();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
