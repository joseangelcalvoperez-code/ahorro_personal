import { CONFIG } from './config.js';
import { S, refresh } from './state.js';
import { esc } from './lib/format.js';
import { $, toast } from './ui.js';
import { renderLogin } from './views/login.js';
import { renderPanel } from './views/panel.js';
import { renderMovimientos } from './views/movimientos.js';
import { renderImportar } from './views/importar.js';
import { renderCategorias } from './views/categorias.js';

const ROUTES = {
  panel: ['Panel', renderPanel],
  movimientos: ['Movimientos', renderMovimientos],
  importar: ['Importar', renderImportar],
  categorias: ['Categorías', renderCategorias]
};

const root = $('#app');
const nav = $('#nav');

async function makeStore() {
  if (CONFIG.url && CONFIG.anonKey) {
    const { createSupabaseStore } = await import('./store/supabase.js');
    return createSupabaseStore(CONFIG);
  }
  const { createLocalStore } = await import('./store/local.js');
  return createLocalStore();
}

function route() {
  if (!S.user) return;
  const key = (location.hash.replace(/^#\//, '') || 'panel').split('?')[0];
  const [, render] = ROUTES[key] || ROUTES.panel;
  const active = ROUTES[key] ? key : 'panel';
  nav.innerHTML = Object.entries(ROUTES).map(([k, [label]]) => `<a href="#/${k}" ${k === active ? 'aria-current="page"' : ''}>${label}</a>`).join('') +
    `<span class="who">${esc(S.profilesById.get(S.user.id)?.display_name || S.user.email)}</span><button id="out" class="btn ghost small">Salir</button>`;
  $('#out').addEventListener('click', async () => { await S.store.signOut(); location.hash = ''; location.reload(); });
  render(root);
}

async function enter(session) {
  S.user = session.user;
  root.innerHTML = '<p class="muted center">Cargando…</p>';
  try {
    await refresh();
  } catch (ex) {
    root.innerHTML = `<div class="banner err" role="alert">No se pudieron cargar los datos: ${esc(ex.message)}</div>`;
    return;
  }
  if (S.data.profiles.length === 0 || (S.store.mode === 'supabase' && !S.data.profiles.some((p) => p.id === S.user.id))) {
    root.innerHTML = `<div class="banner err" role="alert">Tu usuario existe, pero no está dado de alta en la app. Ejecuta supabase/02_seed.sql con tu UUID (ver README).</div>`;
    return;
  }
  $('#modebanner').hidden = S.store.mode !== 'local';
  route();
}

async function boot() {
  S.store = await makeStore();
  window.addEventListener('hashchange', route);
  const session = await S.store.getSession();
  if (!session) {
    nav.innerHTML = '';
    renderLogin(root, enter);
    return;
  }
  await enter(session);
}

boot().catch((ex) => {
  root.innerHTML = `<div class="banner err" role="alert">Error al arrancar: ${esc(ex.message)}</div>`;
  toast(ex.message, 'error');
});
