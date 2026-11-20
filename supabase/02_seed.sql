-- Ahorro en pareja · datos iniciales (GENERADO por scripts/gen-seed.mjs: no editar a mano)
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
    ('Vivienda', 'gasto', '#2B5C8A'),
    ('Alimentación', 'gasto', '#1F6B52'),
    ('Restauración', 'gasto', '#B4570B'),
    ('Suministros', 'gasto', '#7A6A1E'),
    ('Transporte', 'gasto', '#6B4C9A'),
    ('Salud', 'gasto', '#A33A3A'),
    ('Ropa', 'gasto', '#8A2B5C'),
    ('Ocio y suscripciones', 'gasto', '#2B7A8A'),
    ('Seguros', 'gasto', '#5B6560'),
    ('Otros', 'gasto', '#8A8F8C'),
    ('Ingresos', 'ingreso', '#1F6B52'),
    ('Aportación a la conjunta', 'aportacion', '#2B5C8A'),
    ('Liquidación de tarjeta', 'transferencia', '#4A5A8A'),
    ('Ahorro e inversión', 'transferencia', '#3A7A5C')
  on conflict (name) do nothing;

  -- reglas automáticas iniciales (solo si aún no hay ninguna)
  if not exists (select 1 from public.rules) then
    insert into public.rules (keyword, category_id, priority)
    select v.keyword, c.id, v.priority
    from (values
      ('TARJ.CRDTO', 'Liquidación de tarjeta', 10),
      ('APORTACION', 'Aportación a la conjunta', 20),
      ('PATRIMONIO', 'Ahorro e inversión', 30),
      ('NOMINA', 'Ingresos', 40),
      ('BIDEGI', 'Transporte', 50),
      ('AUTOPISTA', 'Transporte', 60),
      ('PEAJE', 'Transporte', 70),
      ('COMPRA EN E.S', 'Transporte', 80),
      ('COMPRA EN E S', 'Transporte', 90),
      ('GASOLINERA', 'Transporte', 100),
      ('FARMACIA', 'Salud', 110),
      ('FISIOTERAPIA', 'Salud', 120),
      ('SEG AUTOS', 'Seguros', 130),
      ('SEGUROS', 'Seguros', 140),
      ('ALCAMPO', 'Alimentación', 150),
      ('MERCADONA', 'Alimentación', 160),
      ('EROSKI', 'Alimentación', 170),
      ('LIDL', 'Alimentación', 180),
      ('CARREFOUR', 'Alimentación', 190),
      ('SUPERMERCADO', 'Alimentación', 200),
      ('CAFE', 'Restauración', 210),
      ('CERVECERIA', 'Restauración', 220),
      ('GASTROBAR', 'Restauración', 230),
      ('RESTAURA', 'Restauración', 240),
      ('AMAZON PRIME', 'Ocio y suscripciones', 250),
      ('ITUNES', 'Ocio y suscripciones', 260),
      ('NETFLIX', 'Ocio y suscripciones', 270),
      ('SPOTIFY', 'Ocio y suscripciones', 280),
      ('PULL & BEAR', 'Ropa', 290),
      ('ZARA', 'Ropa', 300),
      ('ELECTRICIDAD', 'Suministros', 310),
      ('IBERDROLA', 'Suministros', 320)
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
