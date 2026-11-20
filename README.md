# Ahorro en pareja

App web para controlar el ahorro de dos personas: una cuenta personal y una tarjeta por cabeza, más una cuenta y una tarjeta conjuntas. Los movimientos se cargan desde los Excel (.xls) del banco, se clasifican por categorías y el panel muestra cuánto se ha ahorrado cada mes (ingresos − gastos).

- **Sin servidor propio ni build:** HTML + JavaScript puro. Se publica como web estática.
- **Base de datos:** Supabase (plan gratuito), con acceso para dos usuarios.
- **Privacidad:** cada uno ve lo suyo y lo conjunto; lo impone la base de datos (RLS), no la pantalla.
- **Los Excel no se suben a ningún servidor:** se leen en el navegador. Solo se guardan fecha, concepto, importe y saldo, con los números de tarjeta enmascarados.

## Cómo se calcula el ahorro

| Tipo de categoría | Efecto |
|---|---|
| Gasto | Suma como gasto (una devolución positiva lo reduce) |
| Ingreso | Suma como ingreso |
| Aportación a la conjunta | Salida en tu cuenta personal; **ingreso** en la conjunta |
| Transferencia interna | No cuenta (cargo mensual de la tarjeta, traspaso a ahorro/inversión) |

- Las compras de tarjeta cuentan en su **fecha de compra**. El cargo mensual (`TARJ.CRDTO …`) en la cuenta es una transferencia interna, así que no se duplica.
- **Mi cuenta:** ingresos − gastos − aportación a la conjunta.
- **Conjunta:** aportaciones de los dos y otros ingresos − gastos comunes.
- **Todo:** tus ingresos + aportación de tu pareja − gastos de ambas.

## Duplicados

Cada movimiento tiene una huella SHA-256 de `cuenta | fecha | concepto | importe | saldo | nº de repetición`. La base de datos tiene `unique (account_id, hash)`, así que aunque subas el mismo Excel dos veces, o dos archivos que se solapan, o lo suban los dos a la vez, cada movimiento entra una sola vez. El nº de repetición distingue dos compras idénticas el mismo día. La pantalla de importación muestra cuántos son nuevos y cuántos se ignoran antes de guardar.

## Puesta en marcha (≈ 20 minutos)

### 1. Base de datos en Supabase
1. Crea un proyecto gratuito en <https://supabase.com>.
2. **Authentication → Users → Add user**: crea los dos usuarios (correo + contraseña, marca *Auto Confirm User*).
3. **Authentication → Sign In / Providers**: desactiva *Allow new users to sign up*.
4. **SQL Editor**: ejecuta `supabase/01_schema.sql`.
5. Abre `supabase/02_seed.sql`, sustituye al final los dos UUID (los ves en la lista de usuarios) y los nombres, y ejecútalo.
6. **Project Settings → API**: copia *Project URL* y la clave *anon public* en `js/config.js`. Estas dos claves son públicas por diseño; **nunca** pongas la `service_role`.

### 2. Publicarla (gratis)
**GitHub Pages** (la web queda en `https://<usuario>.github.io/ahorro_personal/`):

1. En el repositorio: *Settings → Pages*.
2. *Build and deployment → Source:* **Deploy from a branch**.
3. *Branch:* `main` y carpeta `/ (root)`. Guardar.
4. En 1–2 minutos aparece la dirección arriba de esa misma pantalla.

Requisito: Pages es gratis solo con repositorio **público**. Con repositorio privado hace falta GitHub Pro (gratis con el GitHub Student Developer Pack). Aunque el repositorio sea privado, la web publicada es accesible por URL; lo que la protege es el inicio de sesión de Supabase.

Alternativa: **Cloudflare Pages**, que admite repositorios privados gratis (*Workers & Pages → Create → Pages → Connect to Git*, sin comando de build y `/` como directorio de salida).

Cada `git push` a `main` vuelve a publicar la web.

### 3. Usarla
1. Entrad los dos con vuestro correo.
2. **Importar:** elige la cuenta o tarjeta, suelta el .xls, revisa categorías y confirma. Puedes subir todo el histórico; las repeticiones se ignoran.
3. **Categorías y reglas:** las categorías y las reglas son compartidas. Al corregir una categoría al importar, puedes dejar marcado *Recordar* y se crea una regla.

## Probarla en local

```bash
npm run serve   # http://localhost:8080
npm test        # pruebas de la lógica
```

Con `js/config.js` vacío arranca en **modo local de prueba** (datos solo en tu navegador, sin usuarios).

## Estructura

```
index.html, css/        interfaz
js/app.js               rutas y arranque
js/views/               panel, movimientos, importar, categorías, login
js/lib/                 parser del Excel, huellas, categorización, cálculo del ahorro
js/store/               supabase.js (real) y local.js (pruebas)
supabase/               esquema y políticas (01) + datos iniciales generados (02)
tests/                  pruebas con datos de ejemplo inventados
```

`supabase/02_seed.sql` se genera con `npm run seed` a partir de `js/lib/defaults.js`; edita ahí las categorías y reglas iniciales.

## Seguridad y datos

- `.gitignore` excluye `*.xls` y `*.xlsx`: **no subas tus extractos al repositorio**.
- Las pruebas usan datos inventados.
- El plan gratuito de Supabase pausa el proyecto tras una semana sin uso; se reactiva con un clic desde su panel.
