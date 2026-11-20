// Genera supabase/02_seed.sql y supabase/03_actualizar_categorias.sql a partir de js/lib/defaults.js (fuente única de categorías y reglas).
// Uso: npm run seed
import { writeFileSync } from 'node:fs';
import { DEFAULT_CATEGORIES, DEFAULT_RULES, RENAMED_CATEGORIES } from '../js/lib/defaults.js';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const cats = DEFAULT_CATEGORIES.map((c) => `    (${q(c.name)}, ${q(c.kind)}, ${q(c.color)})`).join(',\n');
const rules = DEFAULT_RULES.map((r) => `    (${q(r.keyword)}, ${q(r.category)}, ${r.priority})`).join(',\n');

const sql = `-- Ahorro en pareja · datos iniciales (GENERADO por scripts/gen-seed.mjs: no editar a mano)
--
-- Antes de ejecutarlo:
--   1) Authentication > Users > Add user: crea los DOS usuarios (correo + contraseña, "Auto Confirm").
--   2) Authentication > Sign In / Providers > desactiva "Allow new users to sign up".
--   3) Copia el UUID de cada usuario y sustitúyelo en la última línea de este archivo.

create or replace function public.seed_household(uid1 uuid, name1 text, uid2 uuid, name2 text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  u uuid;
begin
  insert into public.profiles (id, display_name) values (uid1, name1), (uid2, name2)
    on conflict (id) do update set display_name = excluded.display_name;

  -- cuenta y tarjeta personales de cada uno
  foreach u in array array[uid1, uid2] loop
    if not exists (select 1 from public.accounts where owner_id = u and type = 'cuenta') then
      insert into public.accounts (name, scope, type, owner_id) values ('Cuenta personal', 'personal', 'cuenta', u);
    end if;
    if not exists (select 1 from public.accounts where owner_id = u and type = 'tarjeta') then
      insert into public.accounts (name, scope, type, owner_id) values ('Tarjeta personal', 'personal', 'tarjeta', u);
    end if;
  end loop;

  -- cuenta y tarjeta conjuntas
  if not exists (select 1 from public.accounts where scope = 'conjunta' and type = 'cuenta') then
    insert into public.accounts (name, scope, type) values ('Cuenta conjunta', 'conjunta', 'cuenta');
  end if;
  if not exists (select 1 from public.accounts where scope = 'conjunta' and type = 'tarjeta') then
    insert into public.accounts (name, scope, type) values ('Tarjeta conjunta', 'conjunta', 'tarjeta');
  end if;

  -- categorías compartidas
  insert into public.categories (name, kind, color) values
${cats}
  on conflict (name) do nothing;

  -- reglas automáticas iniciales (solo si aún no hay ninguna)
  if not exists (select 1 from public.rules) then
    insert into public.rules (keyword, category_id, priority)
    select v.keyword, c.id, v.priority
    from (values
${rules.replace(/^ {4}/gm, '      ')}
    ) as v (keyword, category_name, priority)
    join public.categories c on c.name = v.category_name;
  end if;
end;
$fn$;

-- Solo el administrador (SQL Editor) puede ejecutarla; nunca desde la app.
revoke execute on function public.seed_household(uuid, text, uuid, text) from public, anon, authenticated;

-- >>> SUSTITUYE los dos UUID y los nombres, y ejecuta esta línea:
select public.seed_household(
  '00000000-0000-0000-0000-000000000001', 'Tu nombre',
  '00000000-0000-0000-0000-000000000002', 'Nombre de tu pareja'
);
`;

writeFileSync(new URL('../supabase/02_seed.sql', import.meta.url), sql);
console.log('supabase/02_seed.sql generado');

// ---------- migración para bases de datos ya creadas con la primera versión ----------
const OLD_KEYWORDS = ['TARJ.CRDTO', 'APORTACION', 'PATRIMONIO', 'NOMINA', 'BIDEGI', 'AUTOPISTA', 'PEAJE', 'COMPRA EN E.S', 'COMPRA EN E S', 'GASOLINERA', 'FARMACIA', 'FISIOTERAPIA', 'SEG AUTOS', 'SEGUROS', 'ALCAMPO', 'MERCADONA', 'EROSKI', 'LIDL', 'CARREFOUR', 'SUPERMERCADO', 'CAFE', 'CERVECERIA', 'GASTROBAR', 'RESTAURA', 'AMAZON PRIME', 'ITUNES', 'NETFLIX', 'SPOTIFY', 'PULL & BEAR', 'ZARA', 'ELECTRICIDAD', 'IBERDROLA'];
const renames = RENAMED_CATEGORIES.map(([from, to]) => `  update public.categories set name = ${q(to)}
    where name = ${q(from)} and not exists (select 1 from public.categories where name = ${q(to)});`).join('\n');
const allKeywords = [...new Set([...OLD_KEYWORDS, ...DEFAULT_RULES.map((r) => r.keyword)])].map(q).join(', ');

const migration = `-- Ahorro en pareja · actualización de categorías y reglas (GENERADO por scripts/gen-seed.mjs)
--
-- Para bases de datos creadas con la primera versión. Se puede ejecutar más de una vez.
-- Qué hace:
--   1) Renombra categorías antiguas conservando sus movimientos.
--   2) Crea las categorías nuevas y actualiza el tipo de las existentes (no toca tus colores ni presupuestos).
--   3) Sustituye las reglas automáticas por defecto por las nuevas. Tus reglas propias se conservan
--      (las que tengan una palabra clave distinta de las de este archivo).
--
-- Después, en la app: Categorías y reglas > «Reaplicar reglas a movimientos no tocados a mano».

do $mig$
begin
${renames}

  insert into public.categories (name, kind, color) values
${cats}
  on conflict (name) do update set kind = excluded.kind;

  delete from public.rules where keyword in (${allKeywords});

  insert into public.rules (keyword, category_id, priority)
  select v.keyword, c.id, v.priority
  from (values
${rules.replace(/^ {4}/gm, '    ')}
  ) as v (keyword, category_name, priority)
  join public.categories c on c.name = v.category_name;
end
$mig$;
`;

writeFileSync(new URL('../supabase/03_actualizar_categorias.sql', import.meta.url), migration);
console.log('supabase/03_actualizar_categorias.sql generado');
