import { S, refresh } from '../state.js';
import { categorize } from '../lib/categorize.js';
import { esc } from '../lib/format.js';
import { $, $$, modal, toast } from '../ui.js';

const KINDS = [
  ['gasto', 'Gasto'],
  ['ingreso', 'Ingreso'],
  ['aportacion', 'Aportación a la conjunta'],
  ['transferencia', 'Transferencia interna']
];

const kindSelect = (v, cls = '') => `<select class="${cls}" aria-label="Tipo">${KINDS.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
const catSelect = (v, cls = '', label = 'Categoría') => `<select class="${cls}" aria-label="${label}">${S.data.categories.map((c) => `<option value="${c.id}" ${c.id === v ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;

export function renderCategorias(root) {
  const count = (id) => S.data.transactions.filter((t) => t.category_id === id).length;
  const rules = [...S.data.rules].sort((a, b) => a.priority - b.priority);
  root.innerHTML = `
    <div class="pagehead"><div><p class="eyebrow">Ahorro en pareja</p><h1>Categorías y reglas</h1></div>
      <div class="note">Compartidas con tu pareja: un cambio lo ven los dos.</div></div>
    <div class="stackcards">
      <section class="card"><h2>Categorías</h2>
        <div class="tablewrap"><table>
          <thead><tr><th>Nombre</th><th>Tipo</th><th>Color</th><th class="r">Presupuesto/mes</th><th class="r">Mov.</th><th><span class="sr">Borrar</span></th></tr></thead>
          <tbody>${S.data.categories.map((c) => `<tr data-id="${c.id}">
            <td><input class="f-name" value="${esc(c.name)}" aria-label="Nombre"></td>
            <td>${kindSelect(c.kind, 'f-kind')}</td>
            <td><input class="f-color" type="color" value="${esc(c.color)}" aria-label="Color"></td>
            <td class="r"><input class="f-budget" type="number" min="0" step="1" value="${c.budget ?? ''}" aria-label="Presupuesto mensual" placeholder="—"></td>
            <td class="r muted">${count(c.id)}</td>
            <td><button class="icon delcat" aria-label="Borrar categoría ${esc(c.name)}">×</button></td></tr>`).join('')}</tbody>
        </table></div>
        <form id="newcat" class="inline"><label class="sr" for="ncn">Nueva categoría</label>
          <input id="ncn" placeholder="Nueva categoría" required>${kindSelect('gasto', 'nck')}<button class="btn" type="submit">Añadir</button></form>
        <p class="small muted">Las de tipo «Transferencia interna» no cuentan como gasto ni como ingreso. «Aportación» es salida en tu cuenta e ingreso en la conjunta.</p>
      </section>
      <section class="card"><h2>Reglas automáticas</h2>
        <p class="small muted">Si el concepto contiene la palabra, se asigna la categoría. Gana la regla con menor número.</p>
        <div class="tablewrap"><table>
          <thead><tr><th class="r">Nº</th><th>Contiene</th><th>Categoría</th><th><span class="sr">Borrar</span></th></tr></thead>
          <tbody>${rules.map((r) => `<tr data-id="${r.id}">
            <td class="r"><input class="f-prio" type="number" value="${r.priority}" aria-label="Prioridad" style="width:5em"></td>
            <td><input class="f-kw" value="${esc(r.keyword)}" aria-label="Palabra clave"></td>
            <td>${catSelect(r.category_id, 'f-rcat')}</td>
            <td><button class="icon delrule" aria-label="Borrar regla ${esc(r.keyword)}">×</button></td></tr>`).join('')}</tbody>
        </table></div>
        <form id="newrule" class="inline"><label class="sr" for="nrk">Palabra clave</label>
          <input id="nrk" placeholder="Contiene…" required>${catSelect(S.data.categories[0]?.id, 'nrc')}<button class="btn" type="submit">Añadir regla</button></form>
        <button id="reapply" class="btn ghost" type="button">Reaplicar reglas a movimientos no tocados a mano</button>
      </section>
    </div>`;

  const rerender = () => renderCategorias(root);
  const run = async (fn, okMsg) => { try { await fn(); if (okMsg) toast(okMsg); } catch (ex) { toast(ex.message, 'error'); } };

  // edición en línea de categorías
  $$('tr[data-id]', root).forEach((tr) => {
    const id = tr.dataset.id;
    if ($('.f-name', tr)) {
      const save = () => run(async () => {
        const cat = S.catsById.get(id);
        const b = $('.f-budget', tr).value;
        const next = { id, name: $('.f-name', tr).value.trim() || cat.name, kind: $('.f-kind', tr).value, color: $('.f-color', tr).value, budget: b === '' ? null : Number(b) };
        Object.assign(cat, await S.store.saveCategory(next));
      }, 'Guardado');
      $$('input,select', tr).forEach((el) => el.addEventListener('change', save));
      $('.delcat', tr).addEventListener('click', () => run(async () => {
        const cat = S.catsById.get(id);
        const others = S.data.categories.filter((c) => c.id !== id);
        const n = count(id);
        const form = await modal({ title: `Borrar «${cat.name}»`, confirm: 'Borrar',
          bodyHTML: `<p>${n} movimiento(s) usan esta categoría y se borrarán sus reglas.</p>
            <label for="to">Pasar sus movimientos a</label>
            <select id="to" name="to"><option value="">Sin categoría</option>${others.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>` });
        if (!form) return;
        await S.store.deleteCategory(id, form.elements.to.value || null);
        await refresh(); rerender();
      }));
    } else {
      const save = () => run(async () => {
        const next = { id, keyword: $('.f-kw', tr).value.trim(), category_id: $('.f-rcat', tr).value, priority: Number($('.f-prio', tr).value) || 100 };
        if (!next.keyword) return;
        Object.assign(S.data.rules.find((r) => r.id === id), await S.store.saveRule(next));
      }, 'Guardado');
      $$('input,select', tr).forEach((el) => el.addEventListener('change', save));
      $('.delrule', tr).addEventListener('click', () => run(async () => { await S.store.deleteRule(id); await refresh(); rerender(); }));
    }
  });

  $('#newcat', root).addEventListener('submit', (e) => { e.preventDefault(); run(async () => {
    await S.store.saveCategory({ name: $('#ncn', root).value.trim(), kind: $('.nck', root).value, color: '#5B6560' });
    await refresh(); rerender();
  }, 'Categoría creada'); });

  $('#newrule', root).addEventListener('submit', (e) => { e.preventDefault(); run(async () => {
    const max = Math.max(0, ...S.data.rules.map((r) => r.priority));
    await S.store.saveRule({ keyword: $('#nrk', root).value.trim(), category_id: $('.nrc', root).value, priority: max + 10 });
    await refresh(); rerender();
  }, 'Regla creada'); });

  $('#reapply', root).addEventListener('click', () => run(async () => {
    const byCat = new Map();
    for (const t of S.data.transactions) {
      if (t.category_manual) continue;
      const next = categorize(t.concept, S.data.rules);
      if (next !== t.category_id) byCat.set(next, [...(byCat.get(next) || []), t.id]);
    }
    let n = 0;
    for (const [cat, ids] of byCat) { await S.store.bulkSetCategory(ids, cat); n += ids.length; }
    await refresh(); rerender();
    toast(n ? `${n} movimiento(s) recategorizados` : 'No había nada que cambiar');
  }));
}
