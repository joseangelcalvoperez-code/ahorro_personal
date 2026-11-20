// Lector de los Excel de movimientos del banco (cuenta y tarjeta).
// Trabaja sobre una matriz de celdas (array de filas), no sobre el archivo:
// así se puede probar sin navegador. La lectura del .xls real está en xls.js.
import { round2 } from './format.js';

/** Mayúsculas, sin tildes y con espacios colapsados. Sirve para comparar y para la huella. */
export function normKey(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Enmascara números largos (tarjetas): 1234567890120000 -> ****0000. */
export function maskConcept(s) {
  return String(s ?? '')
    .replace(/\d{12,19}/g, (m) => `****${m.slice(-4)}`)
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? round2(v) : null;
  if (v == null) return null;
  let s = String(v).trim().replace(/[\s€]/g, '').replace('−', '-');
  if (s === '') return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : null;
}

const pad = (n) => String(n).padStart(2, '0');

/** dd/mm/aaaa | serie de Excel | Date -> "AAAA-MM-DD" (o null). */
export function parseDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const m = String(v).trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = `20${y}`;
  const dd = +d;
  const mm = +mo;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${y}-${pad(mm)}-${pad(dd)}`;
}

/** Localiza la fila de cabecera y las columnas. kind = 'cuenta' si hay columna de saldo, si no 'tarjeta'. */
export function detectLayout(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 60); i++) {
    const cells = (aoa[i] || []).map((c) => normKey(c).toLowerCase());
    const fecha = cells.indexOf('fecha');
    const concepto = cells.findIndex((c) => c.startsWith('concepto'));
    const importe = cells.findIndex((c) => c.startsWith('importe'));
    if (fecha >= 0 && concepto >= 0 && importe >= 0) {
      const saldo = cells.findIndex((c) => c === 'saldo');
      const fechaValor = cells.findIndex((c) => c === 'fecha valor');
      return { headerRow: i, cols: { fecha, concepto, importe, saldo, fechaValor }, kind: saldo >= 0 ? 'cuenta' : 'tarjeta' };
    }
  }
  return null;
}

/**
 * @returns {{kind:'cuenta'|'tarjeta', rows:Array, errors:Array}}
 * rows: { line, date, valueDate, concept, amount, balance }
 */
export function parseRows(aoa) {
  const layout = detectLayout(aoa);
  if (!layout) throw new Error('No reconozco el formato: no encuentro las columnas fecha, concepto e importe.');
  const { headerRow, cols, kind } = layout;
  const rows = [];
  const errors = [];
  for (let i = headerRow + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    if (r.every((c) => c == null || String(c).trim() === '')) continue;
    const date = parseDate(r[cols.fecha]);
    const amount = parseAmount(r[cols.importe]);
    const concept = maskConcept(r[cols.concepto]);
    if (!date || amount == null || !concept) {
      errors.push({ line: i + 1, reason: !date ? 'fecha no válida' : amount == null ? 'importe no válido' : 'sin concepto' });
      continue;
    }
    rows.push({
      line: i + 1,
      date,
      valueDate: cols.fechaValor >= 0 ? parseDate(r[cols.fechaValor]) : null,
      concept,
      amount,
      balance: cols.saldo >= 0 ? parseAmount(r[cols.saldo]) : null
    });
  }
  return { kind, rows, errors };
}
