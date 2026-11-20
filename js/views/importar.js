import { S, accountLabel, refresh } from '../state.js';
import { parseRows } from '../lib/parser.js';
import { withHashes } from '../lib/hash.js';
import { categorize, suggestKeyword } from '../lib/categorize.js';
import { readSheet } from '../lib/xls.js';
import { dm, esc, eur, monthKey } from '../lib/format.js';
import { $, $$, toast } from '../ui.js';

// Estado del asistente (vive mientras no salgas de la pantalla)
let imp = { accountId: null, fileName: '', rows: null, error: '', done: null, remember: true, busy: false };

const kindOf = (id) => S.catsById.get(id)?.kind;

function accountOptions() {
  const order = (a) => (a.scope === 'personal' ? 0 : 1) * 2 + (a.type === 'cuenta' ? 0 : 1);
  return [...S.data.accounts].sort((a, b) => order(a) - order(b))
    .map((a) => `<option value="${a.id}" ${a.id === imp.accountId ? 'selected' : ''}>${esc(accountLabel(a))}</option>`).join('');
}

async function handleFile(file, root) {
  imp.rows = null; imp.error = ''; imp.done = null; imp.fileName = file.name; imp.busy = true;
  render(root);
  try {
    const account = S.accountsById.get(imp.accountId);
    const parsed = parseRows(await readSheet(file));
    if (parsed.kind !== account.type) {
      const want = parsed.kind === 'cuenta' ? 'una cuenta' : 'una tarjeta';
      throw new Error(`Este archivo es de ${want}, pero has elegido "${accountLabel(account)}". Elige ${want} en el paso 1.`);
    }
    if (parsed.rows.length === 0) throw new Error('El archivo no contiene movimientos.');
    const hashed = await withHashes(account.id, parsed.rows);
    const dates = hashed.map((r) => r.date).sort();
    const known = await S.store.existingHashes(account.id, dates[0], dates.at(-1));
    imp.rows = hashed.map((r) => ({
      ...r,
      dup: known.has(r.hash),
      category_id: categorize(r.concept, S.data.rules),
      changed: false
    }));
    imp.skipped = parsed.errors.length;
  } catch (ex) {
    imp.error = ex.message;
  }
  imp.busy = false;
  render(root);
}

function summary() {
  const nuevos = imp.rows.filter((r) => !r.dup);
  return {
    nuevos: nuevos.length,
    dups: imp.rows.length - nuevos.length,
    internas: nuevos.filter((r) => ['transferencia', 'aportacion'].includes(kindOf(r.category_id))).length,
    sinCat: nuevos.filter((r) => !r.category_id).length
  };
}

async function confirmImport(root) {
  const nuevos = imp.rows.filter((r) => !r.dup);
  imp.busy = true; render(root);
  try {
    const inserted = await S.store.insertTransactions(nuevos.map((r) => ({
      account_id: imp.accountId, tx_date: r.date, concept: r.concept, amount: r.amount, balance: r.balance,
      category_id: r.category_id, category_manual: r.changed, hash: r.hash
    })));
    let reglas = 0;
    if (imp.remember) {
      const have = new Set(S.data.rules.map((x) => x.keyword.toUpperCase()));
      for (const r of nuevos.filter((x) => x.changed && x.category_id)) {
        const keyword = suggestKeyword(r.concept);
        if (!keyword || have.has(keyword)) continue;
        have.add(keyword);
        await S.store.saveRule({ keyword, category_id: r.category_id, priority: 5 });
        reglas++;
      }
    }
    const account = S.accountsById.get(imp.accountId);
    imp.done = { nuevos: inserted.length, dups: imp.rows.length - nuevos.length + (nuevos.length - inserted.length), reglas, month: monthKey(nuevos.map((r) => r.date).sort().at(-1) || imp.rows[0].date), scope: account.scope };
    imp.rows = null;
    await refresh();
  } catch (ex) {
    imp.error = ex.message;
  }
  imp.busy = false;
  render(root);
}

export function renderImportar(root) {
  if (!imp.accountId) imp.accountId = S.data.accounts.find((a) => a.scope === 'personal' && a.type === 'cuenta')?.id || S.data.accounts[0]?.id;
  render(root);
}

function render(root) {
  const s = imp.rows ? summary() : null;
  root.innerHTML = `
    <div class="pagehead"><div><p class="eyebrow">Ahorro en pareja</p><h1>Importar movimientos</h1></div></div>
    <div class="row">
      <section class="card grow"><p class="step">PASO 1</p>
        <label for="acc"><strong>¿A qué cuenta o tarjeta pertenece el archivo?</strong></label>
        <select id="acc">${accountOptions()}</select>
        <p class="small muted">Solo ves tus cuentas y las conjuntas.</p></section>
      <section class="card grow-2 drop" id="drop"><p class="step">PASO 2</p>
        <strong>Elige el archivo .xls del banco</strong>
        <p class="small muted">Se lee en tu navegador. Solo se guardan fecha, concepto e importe, con los números de tarjeta enmascarados.</p>
        <div><label class="btn" for="file">Elegir archivo</label>
        <input id="file" type="file" accept=".xls,.xlsx" class="sr"> <span class="small muted">${esc(imp.fileName)}</span></div>
      </section>
    </div>
    ${imp.busy ? '<div class="banner">Procesando…</div>' : ''}
    ${imp.error ? `<div class="banner err" role="alert">${esc(imp.error)}</div>` : ''}
    ${imp.done ? `<div class="banner ok" role="status"><strong>Importación terminada:</strong> ${imp.done.nuevos} movimiento(s) nuevos${imp.done.dups ? `, ${imp.done.dups} ya estaban y se han ignorado` : ''}${imp.done.reglas ? `, ${imp.done.reglas} regla(s) nuevas guardadas` : ''}. <a href="#/panel" id="goto">Ver el panel</a></div>` : ''}
    ${s ? `
    <div class="stats">
      <div class="stat good"><b>${s.nuevos}</b> movimientos nuevos</div>
      <div class="stat"><b>${s.dups}</b> duplicados ignorados</div>
      <div class="stat"><b>${s.internas}</b> transferencias internas detectadas</div>
      <div class="stat ${s.sinCat ? 'warn' : ''}"><b>${s.sinCat}</b> sin categoría: revísalos</div>
    </div>
    <section class="card"><p class="step">PASO 3 · Revisa y confirma</p>
      <div class="tablewrap"><table>
        <thead><tr><th>Fecha</th><th>Concepto</th><th>Tratamiento</th><th>Categoría</th><th class="r">Importe</th></tr></thead>
        <tbody>${imp.rows.map((r, i) => {
          const k = kindOf(r.category_id);
          const trat = r.dup ? 'Ya importado' : k === 'transferencia' || k === 'aportacion' ? 'Transferencia interna' : r.amount < 0 || k === 'gasto' ? (k === 'ingreso' ? 'Ingreso' : 'Gasto') : 'Ingreso';
          return `<tr class="${r.dup ? 'dup' : ''}" data-i="${i}"><td class="muted nowrap">${dm(r.date)}</td><td>${esc(r.concept)}</td>
            <td><span class="pill ${r.dup ? 'grey' : k === 'transferencia' || k === 'aportacion' ? 'blue' : ''}">${trat}</span></td>
            <td>${r.dup ? '<span class="muted small">—</span>' : `<select class="cat ${r.category_id ? '' : 'needs'}" aria-label="Categoría de ${esc(r.concept)}"><option value="">Sin categoría</option>${S.data.categories.map((c) => `<option value="${c.id}" ${c.id === r.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`}</td>
            <td class="r amt ${r.amount > 0 ? 'pos' : ''}">${eur(r.amount, { sign: true })}</td></tr>`;
        }).join('')}</tbody></table></div>
      <div class="actions">
        <label class="check"><input id="rem" type="checkbox" ${imp.remember ? 'checked' : ''}> Recordar mis cambios de categoría (crear reglas)</label>
        <button id="ok" class="btn" ${s.nuevos === 0 || imp.busy ? 'disabled' : ''}>${s.nuevos === 0 ? 'No hay nada nuevo que importar' : `Confirmar e importar ${s.nuevos} movimientos`}</button>
      </div></section>` : ''}`;

  $('#acc', root).addEventListener('change', (e) => { imp = { ...imp, accountId: e.target.value, rows: null, error: '', done: null, fileName: '' }; render(root); });
  $('#file', root).addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0], root); });
  const drop = $('#drop', root);
  ['dragover', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], root); }));
  $$('select.cat', root).forEach((sel) => sel.addEventListener('change', () => {
    const r = imp.rows[+sel.closest('tr').dataset.i];
    r.category_id = sel.value || null; r.changed = true;
    render(root);
  }));
  const rem = $('#rem', root); if (rem) rem.addEventListener('change', () => { imp.remember = rem.checked; });
  const ok = $('#ok', root); if (ok) ok.addEventListener('click', () => confirmImport(root));
  const go = $('#goto', root); if (go) go.addEventListener('click', () => { S.month = imp.done.month; S.scope = imp.done.scope; });
}
