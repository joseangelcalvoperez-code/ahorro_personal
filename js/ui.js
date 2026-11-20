// Piezas de interfaz compartidas: selector de ámbito/mes, avisos y ventanas modales.
import { S, SCOPES } from './state.js';
import { monthsAvailable } from './lib/stats.js';
import { addMonths, esc, monthLabel } from './lib/format.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = msg;
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  box.appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 7000 : 3500);
}

/** Ventana modal con formulario. Devuelve el <form> al aceptar o null al cancelar. */
export function modal({ title, bodyHTML, confirm = 'Aceptar', cancel = 'Cancelar' }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<form method="dialog" class="dlg">
      <h2>${esc(title)}</h2>
      <div class="dlg-body">${bodyHTML}</div>
      <div class="dlg-actions">
        <button type="button" class="btn ghost" value="cancel">${esc(cancel)}</button>
        <button type="submit" class="btn" value="ok">${esc(confirm)}</button>
      </div></form>`;
    document.body.appendChild(dlg);
    const form = $('form', dlg);
    let result = null;
    $('button[value=cancel]', dlg).addEventListener('click', () => dlg.close());
    form.addEventListener('submit', () => { result = form; });
    dlg.addEventListener('close', () => { resolve(result); setTimeout(() => dlg.remove(), 0); });
    dlg.showModal();
  });
}

function monthOptions() {
  const set = new Set(monthsAvailable(S.data.transactions));
  set.add(S.month);
  set.add(new Date().toISOString().slice(0, 7));
  return [...set].sort().reverse();
}

/** Pestañas Mi cuenta / Conjunta / Todo + selector de mes. */
export function controlsHTML({ withMonth = true } = {}) {
  const tabs = SCOPES.map(([k, label]) => `<button type="button" class="tab" data-scope="${k}" aria-pressed="${S.scope === k}">${esc(label)}</button>`).join('');
  const month = withMonth
    ? `<div class="monthpick">
         <button type="button" class="icon" data-m="-1" aria-label="Mes anterior">‹</button>
         <label class="sr" for="month">Mes</label>
         <select id="month">${monthOptions().map((m) => `<option value="${m}" ${m === S.month ? 'selected' : ''}>${esc(monthLabel(m))}</option>`).join('')}</select>
         <button type="button" class="icon" data-m="1" aria-label="Mes siguiente">›</button>
       </div>`
    : '';
  return `<div class="controls"><div class="tabs" role="group" aria-label="Ámbito">${tabs}</div>${month}</div>`;
}

export function bindControls(root, rerender) {
  $$('[data-scope]', root).forEach((b) => b.addEventListener('click', () => { S.scope = b.dataset.scope; rerender(); }));
  $$('[data-m]', root).forEach((b) => b.addEventListener('click', () => { S.month = addMonths(S.month, +b.dataset.m); rerender(); }));
  const sel = $('#month', root);
  if (sel) sel.addEventListener('change', () => { S.month = sel.value; rerender(); });
}
