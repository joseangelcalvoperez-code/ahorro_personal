import { S } from '../state.js';
import { $, toast } from '../ui.js';

export function renderLogin(root, onSignedIn) {
  root.innerHTML = `
    <section class="login card">
      <p class="eyebrow">Ahorro en pareja</p>
      <h1>Entrar</h1>
      <form id="f" class="stack">
        <label for="email">Correo</label>
        <input id="email" type="email" autocomplete="username" required>
        <label for="pw">Contraseña</label>
        <input id="pw" type="password" autocomplete="current-password" required>
        <button class="btn" type="submit">Entrar</button>
        <p id="err" class="error" role="alert" hidden></p>
      </form>
      <p class="muted small">Acceso solo para los dos usuarios autorizados.</p>
    </section>`;
  $('#f', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#err', root);
    err.hidden = true;
    try {
      const session = await S.store.signIn($('#email', root).value.trim(), $('#pw', root).value);
      await onSignedIn(session);
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });
}
