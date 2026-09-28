import { levelOf } from './health.js';
import { esc } from './utils.js';

const COLORS = {
  good: '#22c55e', mid: '#f59e0b', bad: '#ef4444', none: '#3a4d75',
};

// Figura en coordenadas locales (0–200 de ancho), desplazada al centro del SVG.
const OX = 130;
const PARTS = {
  head: '<circle cx="100" cy="38" r="24"/>',
  neck: '<rect x="90" y="60" width="20" height="14" rx="4"/>',
  chest: '<path d="M52,80 Q100,68 148,80 L142,150 Q100,158 58,150 Z"/>',
  arms: '<path d="M52,80 Q36,86 34,104 L28,170 Q26,196 30,214 L42,214 Q44,190 46,172 L56,112 Z"/><path d="M148,80 Q164,86 166,104 L172,170 Q174,196 170,214 L158,214 Q156,190 154,172 L144,112 Z"/>',
  belly: '<path d="M58,150 Q100,158 142,150 L136,212 Q100,222 64,212 Z"/>',
  hips: '<path d="M64,212 Q100,222 136,212 L140,236 L60,236 Z"/>',
  legs: '<path d="M60,236 L98,236 L94,322 L90,388 L70,388 L68,322 Z"/><path d="M140,236 L102,236 L106,322 L110,388 L130,388 L132,322 Z"/>',
  heart: '<path d="M118,114 C111,107 105,102 109,96 C112,92 117,94 118,98 C119,94 124,92 127,96 C131,102 125,107 118,114 Z"/>',
};

const LABELS = [
  { id: 'sueno', side: 'left', y: 44, to: [OX + 78, 40] },
  { id: 'fuerza', side: 'left', y: 130, to: [OX + 40, 130] },
  { id: 'peso', side: 'left', y: 205, to: [OX + 80, 188] },
  { id: 'piernas', side: 'left', y: 310, to: [OX + 80, 310] },
  { id: 'cardio', side: 'right', y: 80, to: [OX + 124, 102] },
  { id: 'proteina', side: 'right', y: 150, to: [OX + 136, 140] },
  { id: 'calorias', side: 'right', y: 205, to: [OX + 128, 185] },
  { id: 'carbos', side: 'right', y: 260, to: [OX + 124, 205] },
  { id: 'suplementos', side: 'right', y: 320, to: [OX + 168, 200] },
];

export function bodyFigure(report) {
  const a = report.areas;
  const fill = (id) => COLORS[levelOf(a[id]?.pct ?? null)];
  const part = (name, id, extra = '') => `<g fill="${id ? fill(id) : '#24324f'}" ${extra}>${PARTS[name]}</g>`;

  const figure = `<g transform="translate(${OX},0)" class="body-parts">
    ${part('head', 'sueno')}
    ${part('neck', null)}
    ${part('arms', 'fuerza')}
    ${part('chest', 'fuerza')}
    ${part('belly', 'peso')}
    ${part('hips', null)}
    ${part('legs', 'piernas')}
    <g fill="${fill('cardio')}" stroke="#0b1220" stroke-width="2">${PARTS.heart}</g>
  </g>`;

  const labels = LABELS.map(({ id, side, y, to }) => {
    const area = a[id];
    if (!area) return '';
    const left = side === 'left';
    const x = left ? 112 : 348;
    const anchor = left ? 'end' : 'start';
    const pct = area.pct === null ? 's/d' : `${area.pct}%`;
    const color = COLORS[levelOf(area.pct)];
    return `<g class="body-label">
      <line x1="${left ? x + 4 : x - 4}" y1="${y - 6}" x2="${to[0]}" y2="${to[1]}" stroke="${color}" stroke-width="1.2" opacity=".7"/>
      <circle cx="${to[0]}" cy="${to[1]}" r="3" fill="${color}"/>
      <text x="${x}" y="${y - 12}" text-anchor="${anchor}" class="bl-name">${esc(area.label)}</text>
      <text x="${x}" y="${y + 10}" text-anchor="${anchor}" class="bl-pct" fill="${color}">${pct}</text>
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 460 400" class="body-svg" role="img" aria-label="Estado por área del cuerpo">${figure}${labels}</svg>`;
}
