// Utilidades de formato (español de España). Sin dependencias.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
export const toCents = (x) => Math.round(x * 100);

/** 1234.5 -> "1.234,50 €" (con signo opcional) */
export function eur(n, { sign = false } = {}) {
  let v = Number(n) || 0;
  if (Math.abs(v) < 0.005) v = 0;
  const [i, d] = Math.abs(v).toFixed(2).split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const s = v < 0 ? '−' : sign && v > 0 ? '+' : '';
  return `${s}${grouped},${d} €`;
}

export const pct = (x) => `${(x * 100).toFixed(1).replace('.', ',')} %`;
export const dmy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
export const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const monthKey = (iso) => iso.slice(0, 7);
export const monthLabel = (k) => `${MESES[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;
export const monthShort = (k) => MESES_CORTOS[+k.slice(5, 7) - 1];

export function addMonths(k, n) {
  const y = +k.slice(0, 4);
  const m = +k.slice(5, 7) - 1 + n;
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
