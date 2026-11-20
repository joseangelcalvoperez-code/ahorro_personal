import { S, ctx, accountLabel, otherPerson, personName } from '../state.js';
import { computeStats, trend } from '../lib/stats.js';
import { addMonths, dm, esc, eur, monthLabel, monthShort, pct } from '../lib/format.js';
import { bindControls, controlsHTML } from '../ui.js';

function kpis(st, scope) {
  const rate = st.tasa == null ? '—' : `${pct(st.tasa)} de los ingresos`;
  if (scope === 'personal') {
    return [
      ['Ingresos', eur(st.ingresos), 'Nómina y otros ingresos'],
      ['Gastos', eur(st.gastos), 'Cuenta y tarjeta'],
      ['Aportación a la conjunta', eur(st.aportaciones), 'Transferencia interna'],
      ['Ahorro del mes', eur(st.ahorro), rate, true]
    ];
  }
  if (scope === 'conjunta') {
    const other = otherPerson();
    const n = S.data.transactions.filter((t) => t.tx_date.startsWith(S.month) && S.accountsById.get(t.account_id)?.scope === 'conjunta' && other && t.uploaded_by === other.id).length;
    return [
      ['Ingresos', eur(st.ingresos), 'Aportaciones de los dos y otros'],
      ['Gastos', eur(st.gastos), 'Cuenta y tarjeta conjuntas'],
      [other ? `Subidos por ${personName(other.id)}` : 'Aportaciones', other ? String(n) : eur(st.aportaciones), other ? 'movimientos este mes' : 'este mes'],
      ['Saldo generado', eur(st.ahorro), rate, true]
    ];
  }
  return [
    ['Ingresos', eur(st.ingresos), 'Tuyos + aportación de tu pareja'],
    ['Gastos', eur(st.gastos), 'Personal + conjunta'],
    ['Transferencias internas', eur(st.aportaciones), 'No cuentan como gasto'],
    ['Ahorro del mes', eur(st.ahorro), rate, true]
  ];
}

export function renderPanel(root) {
  const c = ctx();
  const st = computeStats(S.data.transactions, c);
  const tr = trend(S.data.transactions, c, 6);
  const maxAbs = Math.max(1, ...tr.map((t) => Math.abs(t.ahorro)));
  const maxCat = Math.max(1, ...st.categorias.map((x) => x.amount));
  const budgetOf = (name) => S.data.categories.find((x) => x.name === name)?.budget;
  const recent = S.data.transactions
    .filter((t) => t.tx_date.startsWith(S.month) && (S.scope === 'todo' || S.accountsById.get(t.account_id)?.scope === S.scope))
    .sort((a, b) => (a.tx_date < b.tx_date ? 1 : a.tx_date > b.tx_date ? -1 : 0))
    .slice(0, 8);
  const empty = S.data.transactions.length === 0;

  root.innerHTML = `
    <div class="pagehead">
      <div><p class="eyebrow">Ahorro en pareja</p><h1>${esc(monthLabel(S.month))}</h1></div>
      ${controlsHTML()}
    </div>
    ${empty ? `<div class="banner">Aún no hay movimientos. <a href="#/importar">Importa tu primer Excel</a> para empezar.</div>` : ''}
    <div class="kpis">
      ${kpis(st, S.scope).map(([label, value, note, accent]) => `
        <div class="card kpi"><div class="muted">${esc(label)}</div>
          <div class="kpi-v ${accent ? (st.ahorro < 0 ? 'neg' : 'pos') : ''}">${esc(value)}</div>
          <div class="muted small">${esc(note)}</div></div>`).join('')}
    </div>
    <div class="row">
      <section class="card grow">
        <h2>Gastos por categoría</h2>
        ${st.categorias.length === 0 ? '<p class="muted">Sin gastos este mes.</p>' : st.categorias.map((x) => {
          const b = budgetOf(x.name);
          const over = b && x.amount > b;
          return `<div class="bar"><div class="bar-name">${esc(x.name)}</div>
            <div class="bar-track"><div class="bar-fill ${over ? 'over' : ''}" style="width:${Math.round((x.amount / maxCat) * 100)}%"></div></div>
            <div class="bar-val">${eur(x.amount)}${b ? `<span class="small ${over ? 'warn' : 'muted'}"> / ${eur(b)}${over ? ' · excedido' : ''}</span>` : ''}</div></div>`;
        }).join('')}
        ${st.sinCategoria ? `<p class="small muted">${st.sinCategoria} movimiento(s) sin categoría. <a href="#/movimientos">Revisar</a></p>` : ''}
      </section>
      <section class="card grow">
        <h2>Ahorro de los últimos 6 meses</h2>
        <div class="chart" role="img" aria-label="Ahorro mensual: ${tr.map((t) => `${monthShort(t.month)} ${eur(t.ahorro)}`).join(', ')}">
          ${tr.map((t, i) => `<div class="col"><div class="small muted">${eur(t.ahorro)}</div>
            <div class="colbar ${t.ahorro < 0 ? 'neg' : ''} ${i === 5 ? 'now' : ''}" style="height:${Math.max(3, Math.round((Math.abs(t.ahorro) / maxAbs) * 130))}px"></div>
            <div class="small">${monthShort(t.month)}</div></div>`).join('')}
        </div>
        <p class="small muted">Ahorro = ingresos − gastos reales. Las transferencias entre tus cuentas no cuentan como gasto.</p>
      </section>
    </div>
    <section class="card">
      <h2>Últimos movimientos</h2>
      ${recent.length === 0 ? '<p class="muted">Sin movimientos este mes.</p>' : `
      <div class="tablewrap"><table>
        <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th class="r">Importe</th></tr></thead>
        <tbody>${recent.map((t) => `<tr><td class="muted">${dm(t.tx_date)}</td>
          <td>${esc(t.concept)}<div class="small muted">${esc(accountLabel(S.accountsById.get(t.account_id)))}</div></td>
          <td><span class="pill">${esc(S.catsById.get(t.category_id)?.name || 'Sin categoría')}</span></td>
          <td class="r amt ${t.amount > 0 ? 'pos' : ''}">${eur(t.amount, { sign: true })}</td></tr>`).join('')}</tbody>
      </table></div>`}
    </section>
    ${st.tarjetaMes > 0 ? `<div class="banner ok"><strong>Tarjeta de ${esc(monthLabel(S.month))}:</strong> ${eur(st.tarjetaMes)} en compras, que se cargarán el 1 de ${esc(monthLabel(addMonths(S.month, 1)))}. Ya están repartidas por categorías, así que el cargo no se cuenta dos veces.</div>` : ''}
  `;
  bindControls(root, () => renderPanel(root));
}
