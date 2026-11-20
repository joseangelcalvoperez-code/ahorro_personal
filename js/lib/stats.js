// Cálculo de ingresos, gastos y ahorro. Todo en céntimos enteros para evitar errores de coma flotante.
//
// Reglas:
//  - gasto: categoría 'gasto' (o sin categoría y negativo). Una devolución (importe positivo) lo reduce.
//  - ingreso: categoría 'ingreso' (o sin categoría y positivo).
//  - aportacion: en tu cuenta personal es una salida; en la conjunta es un ingreso.
//  - transferencia: no cuenta (liquidación de tarjeta, traspasos a ahorro).
//  - Las compras de tarjeta cuentan en su fecha de compra; el cargo mensual en la cuenta es transferencia.
//
// Ahorro del mes:
//   personal -> ingresos - gastos - aportaciones a la conjunta
//   conjunta -> ingresos (aportaciones de los dos) - gastos
//   todo     -> (ingresos propios + aportaciones de los dos - lo que tú sacas de tu cuenta) - gastos
import { addMonths, toCents } from './format.js';

export function effectiveKind(tx, catsById) {
  const c = catsById.get(tx.category_id);
  if (c) return c.kind;
  return tx.amount < 0 ? 'gasto' : 'ingreso';
}

const inScope = (account, scope) => !!account && (scope === 'todo' || account.scope === scope);

export function computeStats(txs, { accountsById, catsById, scope, month }) {
  let ing = 0;
  let gas = 0;
  let apPers = 0;
  let apJoint = 0;
  let cardMonth = 0;
  let sinCategoria = 0;
  const byCat = new Map();

  for (const t of txs) {
    if (!t.tx_date.startsWith(month)) continue;
    const a = accountsById.get(t.account_id);
    if (!inScope(a, scope)) continue;
    const kind = effectiveKind(t, catsById);
    const c = toCents(t.amount);
    if (kind === 'gasto') {
      gas -= c;
      const name = catsById.get(t.category_id)?.name ?? 'Sin categoría';
      byCat.set(name, (byCat.get(name) || 0) - c);
      if (!t.category_id) sinCategoria++;
      if (a.type === 'tarjeta') cardMonth -= c;
    } else if (kind === 'ingreso') {
      ing += c;
      if (!t.category_id) sinCategoria++;
    } else if (kind === 'aportacion') {
      if (a.scope === 'conjunta') {
        ing += c;
        apJoint += c;
      } else {
        apPers -= c;
      }
    }
  }

  let ingresos = ing;
  let ahorro;
  let aportaciones;
  if (scope === 'personal') {
    aportaciones = apPers;
    ahorro = ing - gas - apPers;
  } else if (scope === 'conjunta') {
    aportaciones = apJoint;
    ahorro = ing - gas;
  } else {
    aportaciones = apPers;
    ingresos = ing - apPers;
    ahorro = ingresos - gas;
  }

  const categorias = [...byCat.entries()]
    .filter(([, v]) => v > 0)
    .map(([name, v]) => ({ name, amount: v / 100 }))
    .sort((x, y) => y.amount - x.amount);

  return {
    ingresos: ingresos / 100,
    gastos: gas / 100,
    aportaciones: aportaciones / 100,
    ahorro: ahorro / 100,
    tasa: ingresos > 0 ? ahorro / ingresos : null,
    categorias,
    sinCategoria,
    tarjetaMes: cardMonth / 100
  };
}

/** Ahorro de los últimos n meses terminando en `month`. */
export function trend(txs, ctx, n = 6) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const month = addMonths(ctx.month, -i);
    out.push({ month, ahorro: computeStats(txs, { ...ctx, month }).ahorro });
  }
  return out;
}

export function monthsAvailable(txs) {
  return [...new Set(txs.map((t) => t.tx_date.slice(0, 7)))].sort().reverse();
}
