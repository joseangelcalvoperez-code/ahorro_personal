import { S, accountLabel, personName } from '../state.js';
import { dmy, esc, eur, monthLabel } from '../lib/format.js';
import { normKey } from '../lib/parser.js';
import { $, $$, bindControls, controlsHTML, modal, toast } from '../ui.js';

const LIMIT = 300;

function catOptions(selected) {
  return `<option value="">Sin categoría</option>` + S.data.categories
    .map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
}

function filtered() {
  const q = normKey(S.mov.q);
  return S.data.transactions
    .filter((t) => {
      const a = S.accountsById.get(t.account_id);
      if (!a) return false;
      if (S.scope !== 'todo' && a.scope !== S.scope) return false;
      if (!S.mov.all && !t.tx_date.startsWith(S.month)) return false;
      if (S.mov.cat === '__none' ? !!t.category_id : S.mov.cat && t.category_id !== S.mov.cat) return false;
      if (q && !normKey(t.concept).includes(q)) return false;
      return true;
    })
    .sort((a, b) => (a.tx_date < b.tx_date ? 1 : a.tx_date > b.tx_date ? -1 : 0));
}

export function renderMovimientos(root) {
  const rows = filtered();
  const shown = rows.slice(0, LIMIT);
  const showWho = S.data.profiles.length > 1;
  root.innerHTML = `
    <div class="pagehead">
      <div><p class="eyebrow">Ahorro en pareja</p><h1>Movimientos</h1></div>
      ${controlsHTML({ withMonth: !S.mov.all })}
    </div>
    <section class="card">
      <div class="filters">
        <div><label for="q">Buscar</label><input id="q" type="search" value="${esc(S.mov.q)}" placeholder="Concepto…"></div>
        <div><label for="fc">Categoría</label>
          <select id="fc"><option value="">Todas</option><option value="__none" ${S.mov.cat === '__none' ? 'selected' : ''}>Sin categoría</option>
          ${S.data.categories.map((c) => `<option value="${c.id}" ${S.mov.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <label class="check"><input id="all" type="checkbox" ${S.mov.all ? 'checked' : ''}> Todos los meses</label>
      </div>
      <p class="small muted">${rows.length} movimiento(s)${S.mov.all ? '' : ` en ${esc(monthLabel(S.month))}`}${rows.length > LIMIT ? ` · mostrando los ${LIMIT} más recientes` : ''}</p>
      ${shown.length === 0 ? '<p class="muted">No hay movimientos con estos filtros.</p>' : `
      <div class="tablewrap"><table>
        <thead><tr><th>Fecha</th><th>Cuenta</th><th>Concepto</th><th>Categoría</th><th class="r">Importe</th>${showWho ? '<th>Subido por</th>' : ''}<th><span class="sr">Acciones</span></th></tr></thead>
        <tbody>${shown.map((t) => {
          const a = S.accountsById.get(t.account_id);
          return `<tr data-id="${t.id}">
            <td class="muted nowrap">${dmy(t.tx_date)}</td>
            <td class="small muted">${esc(accountLabel(a))}</td>
            <td>${esc(t.concept)}</td>
            <td><select class="cat" aria-label="Categoría de ${esc(t.concept)}">${catOptions(t.category_id)}</select></td>
            <td class="r amt ${t.amount > 0 ? 'pos' : ''}">${eur(t.amount, { sign: true })}</td>
            ${showWho ? `<td class="small muted">${esc(t.uploaded_by ? personName(t.uploaded_by) : '')}</td>` : ''}
            <td><button class="icon del" aria-label="Borrar movimiento" title="Borrar">×</button></td></tr>`;
        }).join('')}</tbody>
      </table></div>`}
    </section>`;

  bindControls(root, () => renderMovimientos(root));
  $('#q', root).addEventListener('change', (e) => { S.mov.q = e.target.value; renderMovimientos(root); });
  $('#fc', root).addEventListener('change', (e) => { S.mov.cat = e.target.value; renderMovimientos(root); });
  $('#all', root).addEventListener('change', (e) => { S.mov.all = e.target.checked; renderMovimientos(root); });

  $$('select.cat', root).forEach((sel) => sel.addEventListener('change', async () => {
    const id = sel.closest('tr').dataset.id;
    const category_id = sel.value || null;
    try {
      await S.store.updateTransaction(id, { category_id, category_manual: true });
      const t = S.data.transactions.find((x) => x.id === id);
      Object.assign(t, { category_id, category_manual: true });
      toast('Categoría actualizada');
    } catch (ex) { toast(ex.message, 'error'); }
  }));

  $$('.del', root).forEach((b) => b.addEventListener('click', async () => {
    const id = b.closest('tr').dataset.id;
    const t = S.data.transactions.find((x) => x.id === id);
    const ok = await modal({ title: 'Borrar movimiento', bodyHTML: `<p>${esc(t.concept)} · ${eur(t.amount)}</p><p class="small muted">Si vuelves a subir el Excel, este movimiento volverá a entrar.</p>`, confirm: 'Borrar' });
    if (!ok) return;
    try {
      await S.store.deleteTransactions([id]);
      S.data.transactions = S.data.transactions.filter((x) => x.id !== id);
      renderMovimientos(root);
    } catch (ex) { toast(ex.message, 'error'); }
  }));
}
