// Genera supabase/02_seed.sql a partir de js/lib/defaults.js (fuente única de categorías y reglas).
// Uso: npm run seed
import { writeFileSync } from 'node:fs';
import { DEFAULT_CATEGORIES, DEFAULT_RULES } from '../js/lib/defaults.js';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const cats = DEFAULT_CATEGORIES.map((c) => `    (${q(c.name)}, ${q(c.kind)}, ${q(c.color)})`).join(',\n');
const rules = DEFAULT_RULES.map((r, i) => `    (${q(r.keyword)}, ${q(r.category)}, ${(i + 1) * 10})`).join(',\n');

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
