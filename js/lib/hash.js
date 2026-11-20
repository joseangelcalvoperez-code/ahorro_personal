// Huella de cada movimiento para no duplicar al volver a subir un Excel.
// Huella = SHA-256(cuenta | fecha | concepto | importe | saldo | nº de repetición dentro del archivo).
// El nº de repetición distingue dos compras idénticas el mismo día (mismo concepto e importe).
import { normKey } from './parser.js';

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function withHashes(accountId, rows) {
  const seen = new Map();
  const out = [];
  for (const r of rows) {
    const base = [
      accountId,
      r.date,
      normKey(r.concept),
      r.amount.toFixed(2),
      r.balance == null ? '' : r.balance.toFixed(2)
    ].join('|');
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    out.push({ ...r, hash: await sha256Hex(`${base}|${n}`) });
  }
  return out;
}
