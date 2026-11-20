import { normKey } from './parser.js';

// Sintaxis de las palabras clave de las reglas:
//   TEXTO   -> el concepto CONTIENE el texto (sin mayúsculas ni tildes). "CAFE" casa con "CAFETERIA".
//   =TEXTO  -> solo PALABRAS COMPLETAS. "=BAR" casa con "BAR GULI" pero no con "BARAKALDO";
//              "=E S" casa con "E.S HERNANI" y "E S ALCAMPO" (los signos de puntuación valen como espacio).
const words = (s) => s.replace(/[^A-Z0-9&]+/g, ' ').trim();

export function matches(normConcept, keyword) {
  const raw = String(keyword ?? '').trim();
  const exact = raw.startsWith('=');
  const k = normKey(exact ? raw.slice(1) : raw);
  if (!k) return false;
  if (!exact) return normConcept.includes(k);
  const w = words(k);
  return !!w && ` ${words(normConcept)} `.includes(` ${w} `);
}

/** Devuelve el id de la primera regla (por prioridad) que casa con el concepto, o null. */
export function categorize(concept, rules) {
  const c = normKey(concept);
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const r of sorted) if (matches(c, r.keyword)) return r.category_id;
  return null;
}

/** Palabra clave sugerida al corregir una categoría a mano: sin "COMPRA EN", sin números, 3 palabras. */
export function suggestKeyword(concept) {
  const words3 = normKey(concept)
    .replace(/^COMPRA EN /, '')
    .split(' ')
    .filter((w) => w && !/^[\d*./-]+$/.test(w) && w !== '-');
  return words3.slice(0, 3).join(' ');
}
