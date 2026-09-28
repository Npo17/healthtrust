import { esc } from '../utils.js';

export function stat(value, label, extra = '') {
  return `<div class="stat"><span class="stat-val">${value}</span><span class="stat-lbl">${label}</span>${extra}</div>`;
}

export function alertsHtml(alerts) {
  if (!alerts.length) return '<p class="muted">Sin datos todavía.</p>';
  return `<ul class="alerts">${alerts.map((a) => `<li class="${a.level}">${esc(a.text)}</li>`).join('')}</ul>`;
}
