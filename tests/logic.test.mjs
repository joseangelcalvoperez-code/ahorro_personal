import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRows, parseDate, parseAmount, maskConcept, detectLayout } from '../js/lib/parser.js';
import { withHashes } from '../js/lib/hash.js';
import { categorize, suggestKeyword } from '../js/lib/categorize.js';
import { computeStats, trend } from '../js/lib/stats.js';
import { DEFAULT_CATEGORIES, DEFAULT_RULES } from '../js/lib/defaults.js';
import { eur, addMonths } from '../js/lib/format.js';

const load = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));

test('fechas e importes', () => {
  assert.equal(parseDate('05/11/2026'), '2026-11-05');
  assert.equal(parseDate('5/1/26'), '2026-01-05');
  assert.equal(parseDate('45000'), null);
  assert.equal(parseDate(46000), '2025-12-09');
  assert.equal(parseDate('31/13/2026'), null);
  assert.equal(parseAmount('-1.234,56'), -1234.56);
  assert.equal(parseAmount('-2,5'), -2.5);
  assert.equal(parseAmount(-30.69), -30.69);
  assert.equal(parseAmount(''), null);
});

test('el número de tarjeta se enmascara', () => {
  assert.equal(maskConcept('TARJ.CRDTO 1234567890120000'), 'TARJ.CRDTO ****0000');
  assert.equal(maskConcept('  RECIBO   X  '), 'RECIBO X');
});

test('cuenta: detecta cabecera, tipo y filas', () => {
  const r = parseRows(load('cuenta'));
  assert.equal(r.kind, 'cuenta');
  assert.equal(r.rows.length, 7);
  assert.equal(r.errors.length, 0);
  assert.equal(r.rows[0].balance, 3000);
  assert.equal(r.rows[5].concept, 'TARJ.CRDTO ****0000');
});

test('tarjeta: sin saldo y con importes como texto', () => {
  const r = parseRows(load('tarjeta'));
  assert.equal(r.kind, 'tarjeta');
  assert.equal(r.rows.length, 5);
  assert.equal(r.rows[1].amount, -2.5);
  assert.equal(r.rows[3].concept, '- IRUN /BIDEGI A-8 GIPU');
  assert.equal(r.rows[0].balance, null);
});

test('archivo que no es de movimientos da error claro', () => {
  assert.throws(() => parseRows([['a', 'b'], [1, 2]]), /No reconozco el formato/);
  assert.equal(detectLayout([['x']]), null);
});

test('huellas: estables, únicas y distinguen repetidos del mismo día', async () => {
  const { rows } = parseRows(load('tarjeta'));
  const a = await withHashes('acc1', rows);
  const b = await withHashes('acc1', rows);
  assert.deepEqual(a.map((x) => x.hash), b.map((x) => x.hash));
  assert.equal(new Set(a.map((x) => x.hash)).size, rows.length); // dos cafés idénticos -> 2 huellas
  const otra = await withHashes('acc2', rows);
  assert.notEqual(a[0].hash, otra[0].hash); // otra cuenta -> otra huella
});

test('subir un archivo solapado solo aporta lo nuevo', async () => {
  const { rows } = parseRows(load('cuenta'));
  const first = await withHashes('acc1', rows.slice(0, 5));
  const second = await withHashes('acc1', rows.slice(3)); // solapa 2 filas
  const known = new Set(first.map((x) => x.hash));
  const nuevos = second.filter((x) => !known.has(x.hash));
  assert.equal(nuevos.length, rows.length - 5);
});

// --- categorías y totales ---
const cats = DEFAULT_CATEGORIES.map((c, i) => ({ id: `c${i}`, ...c }));
const byName = Object.fromEntries(cats.map((c) => [c.name, c]));
const rules = DEFAULT_RULES.map((r, i) => ({ id: `r${i}`, keyword: r.keyword, category_id: byName[r.category].id, priority: i + 1 }));

test('reglas por palabra clave y prioridad', () => {
  const id = (n) => byName[n].id;
  assert.equal(categorize('COMPRA EN E S ALCAMPO IRUN', rules), id('Transporte')); // gasolinera antes que Alcampo
  assert.equal(categorize('COMPRA EN ALCAMPO', rules), id('Alimentación'));
  assert.equal(categorize('TARJ.CRDTO ****0000', rules), id('Liquidación de tarjeta'));
  assert.equal(categorize('COMPRA EN TIENDA SIN REGLA', rules), null);
  assert.equal(categorize('compra en cafe ñandú', rules), id('Restauración'));
  assert.equal(suggestKeyword('COMPRA EN PULL & BEAR 123'), 'PULL & BEAR');
});

async function buildTxs() {
  const accounts = [
    { id: 'p-c', scope: 'personal', type: 'cuenta' },
    { id: 'p-t', scope: 'personal', type: 'tarjeta' },
    { id: 'j-c', scope: 'conjunta', type: 'cuenta' }
  ];
  const txs = [];
  const add = (acc, rows) => rows.forEach((r) => txs.push({ account_id: acc, tx_date: r.date, concept: r.concept, amount: r.amount, category_id: categorize(r.concept, rules) }));
  add('p-c', parseRows(load('cuenta')).rows);
  add('p-t', parseRows(load('tarjeta')).rows);
  // cuenta conjunta: dos aportaciones de 900 en octubre y un gasto de 500
  add('j-c', [
    { date: '2026-10-01', concept: 'APORTACION MES', amount: 900 },
    { date: '2026-10-01', concept: 'APORTACION MES', amount: 900 },
    { date: '2026-10-03', concept: 'ELECTRICIDAD', amount: -500 }
  ]);
  return {
    txs,
    ctx: { accountsById: new Map(accounts.map((a) => [a.id, a])), catsById: new Map(cats.map((c) => [c.id, c])) }
  };
}

test('ahorro personal: ingresos - gastos - aportaciones; tarjeta y traspasos no duplican', async () => {
  const { txs, ctx } = await buildTxs();
  const oct = computeStats(txs, { ...ctx, scope: 'personal', month: '2026-10' });
  // ingresos 2000; gastos: bizum 40 + autopista 30,5 + tarjeta (80,05+5+3,15+57,98)=146,18 -> 216,68
  assert.equal(oct.ingresos, 2000);
  assert.equal(oct.gastos, 216.68);
  assert.equal(oct.ahorro, 1783.32);
  assert.equal(oct.sinCategoria, 3); // los dos bizum y la tienda sin regla
  assert.equal(oct.tarjetaMes, 146.18);
  const nov = computeStats(txs, { ...ctx, scope: 'personal', month: '2026-11' });
  assert.equal(nov.gastos, 0); // TARJ.CRDTO y traspaso a patrimonio no son gasto
  assert.equal(nov.aportaciones, 900);
  assert.equal(nov.ahorro, -900); // sin nómina en noviembre en el ejemplo
});

test('conjunta y todo: la aportación de cada uno es ingreso en la conjunta y no se cuenta dos veces', async () => {
  const { txs, ctx } = await buildTxs();
  const j = computeStats(txs, { ...ctx, scope: 'conjunta', month: '2026-10' });
  assert.equal(j.ingresos, 1800);
  assert.equal(j.gastos, 500);
  assert.equal(j.ahorro, 1300);
  const nov = computeStats(txs, { ...ctx, scope: 'todo', month: '2026-11' });
  assert.equal(nov.ingresos, -900); // tu salida de 900 sin su entrada en la conjunta (aún no subida)
  const oct = computeStats(txs, { ...ctx, scope: 'todo', month: '2026-10' });
  assert.equal(oct.ingresos, 3800); // 2000 + 1800
  assert.equal(oct.gastos, 716.68);
  assert.equal(oct.ahorro, 3083.32);
});

test('tendencia y formato', async () => {
  const { txs, ctx } = await buildTxs();
  const t = trend(txs, { ...ctx, scope: 'personal', month: '2026-10' }, 3);
  assert.deepEqual(t.map((x) => x.month), ['2026-08', '2026-09', '2026-10']);
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(eur(1234.5), '1.234,50 €');
  assert.equal(eur(-5, { sign: true }), '−5,00 €');
  assert.equal(eur(5, { sign: true }), '+5,00 €');
});
