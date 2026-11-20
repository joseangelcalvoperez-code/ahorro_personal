import { normKey } from './parser.js';

/** Devuelve el id de la primera regla (por prioridad) cuya palabra clave está en el concepto. */
export function categorize(concept, rules) {
  const c = normKey(concept);
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const r of sorted) {
    const k = normKey(r.keyword);
    if (k && c.includes(k)) return r.category_id;
  }
  return null;
}

/** Palabra clave sugerida al corregir una categoría a mano: sin "COMPRA EN", sin números, 3 palabras. */
export function suggestKeyword(concept) {
  const words = normKey(concept)
    .replace(/^COMPRA EN /, '')
    .split(' ')
    .filter((w) => w && !/^[\d*./-]+$/.test(w) && w !== '-');
  return words.slice(0, 3).join(' ');
}
