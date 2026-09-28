export const MEAL_SLOTS = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'almuerzo', label: 'Almuerzo' },
  { id: 'merienda', label: 'Media tarde' },
  { id: 'post', label: 'Post-entreno' },
  { id: 'cena', label: 'Cena' },
  { id: 'snacks', label: 'Postre / picoteo' },
];

export const CARDIO_TYPES = [
  { id: 'bici', label: 'Bici' },
  { id: 'caminata', label: 'Caminata' },
  { id: 'cinta', label: 'Cinta' },
  { id: 'correr', label: 'Correr' },
  { id: 'otro', label: 'Otro' },
];

export function cardioLabel(entry) {
  return CARDIO_TYPES.find((t) => t.id === entry.type)?.label || 'Actividad';
}

export const DEFAULT_TARGETS = {
  kcalMin: 2300,
  kcalMax: 2500,
  proteinG: 170,
  sleepH: 7,
  bedtime: '00:30',
  stepsPerDay: 8000,
  strengthPerWeek: 5,
  cardioMinPerWeek: 180,
  cheatPerWeek: 1,
};

export const DEFAULT_SUPPLEMENTS = [
  { id: 'multi', name: 'Multivitamínico' },
  { id: 'omega3', name: 'Omega 3' },
  { id: 'creatina', name: 'Creatina' },
  { id: 'colageno', name: 'Colágeno' },
  { id: 'magnesio', name: 'Citrato de magnesio' },
];

export const DEFAULT_TEMPLATES = [
  { id: 'tpl-tostadas', short: 'Tostadas + huevos', text: '2 tostadas integrales + queso crema light + 2 huevos revueltos', protein: 21, kcal: 310, slots: ['desayuno', 'merienda', 'cena'] },
  { id: 'tpl-tostadas-pollo', short: 'Tostadas + huevos + pollo', text: '2 tostadas integrales + queso crema light + 2 huevos revueltos + pollo + zanahoria', protein: 52, kcal: 500, slots: ['desayuno', 'almuerzo', 'cena'] },
  { id: 'tpl-yogur-15', short: 'Yogur + 1,5 scoop', text: 'Yogur griego natural (20 g prot) + 1 scoop y medio de whey', protein: 57, kcal: 395, slots: ['post', 'merienda'] },
  { id: 'tpl-pollo-zanahoria', short: 'Pollo con zanahoria', text: 'Pollo con zanahoria', protein: 56, kcal: 330, slots: ['almuerzo', 'cena'] },
  { id: 'tpl-cafe', short: 'Café negro', text: 'Café negro', protein: 0, kcal: 5, slots: ['desayuno', 'merienda'] },
  { id: 'tpl-yogur-scoop', short: 'Yogur + scoop', text: 'Yogur griego sin endulzar + 1 scoop de whey', protein: 45, kcal: 320, slots: ['post', 'merienda', 'snacks'] },
  { id: 'tpl-scoop', short: 'Scoop whey', text: '1 scoop Creatine & Whey', protein: 25, kcal: 147, slots: ['post'] },
  { id: 'tpl-lomo', short: 'Lomo + queso + huevo', text: '200 g de lomo + 1 porción de queso proteico + 1 huevo', protein: 68, kcal: 520, slots: ['almuerzo', 'cena'] },
  { id: 'tpl-pollo', short: 'Pollo + verduras', text: '200 g de pollo + verduras', protein: 60, kcal: 380, slots: ['almuerzo', 'cena'] },
  { id: 'tpl-arroz', short: 'Arroz (1 taza)', text: 'Arroz cocido (1 taza)', protein: 4, kcal: 200, slots: ['almuerzo', 'cena'] },
  { id: 'tpl-fideos', short: 'Fideos prot. + carne', text: 'Fideos proteicos + carne + verduras (1 plato)', protein: 45, kcal: 620, slots: ['almuerzo', 'cena'] },
  { id: 'tpl-vianda', short: 'Vianda 450', text: 'Vianda 450 kcal', protein: 30, kcal: 450, slots: ['almuerzo', 'cena'] },
  { id: 'tpl-atun', short: 'Lata de atún', text: 'Atún al natural (1 lata)', protein: 30, kcal: 140, slots: ['almuerzo', 'cena'] },
  { id: 'tpl-shawarma', short: 'Shawarma', text: 'Shawarma grande de carne y verduras (sin salsas)', protein: 45, kcal: 650, slots: ['almuerzo', 'cena'] },
  { id: 'tpl-palta', short: '1/4 palta', text: '1/4 de palta', protein: 1, kcal: 80, slots: ['desayuno', 'almuerzo', 'cena'] },
  { id: 'tpl-pancakes', short: 'Pancakes Molé', text: 'Pancakes proteicos Molé (1 porción)', protein: 17, kcal: 188, slots: ['desayuno', 'merienda'] },
  { id: 'tpl-manzana', short: 'Manzana', text: 'Manzana verde', protein: 0, kcal: 80, slots: ['merienda', 'snacks'] },
  { id: 'tpl-banana', short: 'Banana', text: 'Banana', protein: 1, kcal: 100, slots: ['merienda', 'post', 'snacks'] },
  { id: 'tpl-frutos', short: 'Frutos secos', text: 'Frutos secos (1 puñado)', protein: 5, kcal: 180, slots: ['merienda', 'snacks'] },
  { id: 'tpl-choco', short: '1 cuadradito choco', text: '1 cuadradito de chocolate', protein: 0, kcal: 30, slots: ['post', 'snacks'] },
  { id: 'tpl-pororo', short: 'Pororó cine', text: 'Pororó (cine)', protein: 3, kcal: 400, slots: ['snacks'] },
];

// Lo que se carga con "Mi día típico"; se puede reemplazar desde la pantalla Día.
export const DEFAULT_TYPICAL = {
  meals: {
    desayuno: ['tpl-cafe', 'tpl-tostadas-pollo'],
    merienda: ['tpl-cafe'],
    post: ['tpl-yogur-15'],
  },
  supplements: ['multi', 'omega3', 'creatina', 'colageno', 'magnesio'],
};

export function typicalFromDefaults() {
  const byId = Object.fromEntries(DEFAULT_TEMPLATES.map((t) => [t.id, t]));
  const meals = {};
  for (const [slot, ids] of Object.entries(DEFAULT_TYPICAL.meals)) {
    meals[slot] = ids.map((id) => ({ text: byId[id].text, protein: byId[id].protein, kcal: byId[id].kcal }));
  }
  return { meals, supplements: Object.fromEntries(DEFAULT_TYPICAL.supplements.map((id) => [id, true])) };
}

const ex = (name, sets, reps) => ({ name, sets, reps: String(reps) });

export const DEFAULT_ROUTINES = [
  {
    id: 'pierna',
    name: 'Pierna',
    exercises: [
      ex('Sentadilla libre', 5, 10),
      ex('Sentadilla búlgara con mancuernas', 3, 13),
      ex('Peso muerto rumano', 3, 12),
      ex('Zancadas caminando', 2, '13 c/pierna'),
      ex('Hip thrust con barra', 4, 11),
      ex('Elevación de talones con barra', 3, 20),
    ],
  },
  {
    id: 'tiron',
    name: 'Tirón (espalda + bíceps)',
    exercises: [
      ex('Remo con barra', 7, 12),
      ex('Remo inclinado con mancuernas', 5, 14),
      ex('Curl con barra Z', 4, 14),
      ex('Curl inclinado con mancuernas', 3, 17),
      ex('Face pulls / vuelos posteriores', 3, 18),
    ],
  },
  {
    id: 'empuje',
    name: 'Empuje (pecho + hombro + tríceps)',
    exercises: [
      ex('Press banca plano con barra', 6, 10),
      ex('Press inclinado con mancuernas', 3, 12),
      ex('Fondos en paralelas', 3, 13),
      ex('Press militar con barra', 5, 7),
      ex('Elevaciones laterales con mancuernas', 3, 16),
      ex('Press francés con barra Z', 3, 13),
    ],
  },
  {
    id: 'brazos',
    name: 'Brazos + core',
    exercises: [
      ex('Curl martillo', 3, 17),
      ex('Curl banco Scott', 3, 18),
      ex('Extensión de tríceps sobre la cabeza', 3, 15),
      ex('Patada de tríceps', 3, 18),
      ex('Crunch declinado con carga', 3, 16),
      ex('Plancha con carga / dead bugs', 4, 16),
      ex('Lumbares', 4, 10),
    ],
  },
  {
    id: 'full',
    name: 'Full body',
    exercises: [
      ex('Peso muerto convencional / rack pull', 4, 10),
      ex('Sentadilla búlgara', 3, 13),
      ex('Remo con mancuerna a una mano', 3, 14),
      ex('Press inclinado con mancuernas', 3, 14),
      ex('Curl con barra Z', 4, 15),
      ex('Farmer hold', 4, '40 s'),
    ],
  },
];
