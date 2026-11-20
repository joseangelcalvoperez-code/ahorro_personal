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
    ('Hipoteca o alquiler', 'gasto', '#2B5C8A'),
    ('Comunidad y gastos de vivienda', 'gasto', '#4A6FA5'),
    ('Suministros y telecom', 'gasto', '#7A6A1E'),
    ('Alimentación', 'gasto', '#1F6B52'),
    ('Restauración', 'gasto', '#B4570B'),
    ('Transporte', 'gasto', '#6B4C9A'),
    ('Salud', 'gasto', '#A33A3A'),
    ('Cuidado personal', 'gasto', '#C06C84'),
    ('Ropa', 'gasto', '#8A2B5C'),
    ('Hogar y equipamiento', 'gasto', '#5C7A2B'),
    ('Compras online', 'gasto', '#2B7A8A'),
    ('Ocio y suscripciones', 'gasto', '#3A6FA0'),
    ('Formación y estudios', 'gasto', '#4A7A8A'),
    ('Regalos', 'gasto', '#B0508A'),
    ('Seguros', 'gasto', '#5B6560'),
    ('Impuestos y tasas', 'gasto', '#7A5230'),
    ('Comisiones bancarias', 'gasto', '#8A8F8C'),
    ('Efectivo', 'gasto', '#6A6A3A'),
    ('Bizum y varios', 'gasto', '#7A8A9A'),
    ('Otros', 'gasto', '#9A9A8A'),
    ('Nómina', 'ingreso', '#1F6B52'),
    ('Otros ingresos', 'ingreso', '#3A7A5C'),
    ('Aportación a la conjunta', 'aportacion', '#2B5C8A'),
    ('Liquidación de tarjeta', 'transferencia', '#4A5A8A'),
    ('Ahorro e inversión', 'transferencia', '#3A7A5C'),
    ('Compra de vivienda y extraordinarios', 'transferencia', '#6A5A8A')
  on conflict (name) do nothing;

  -- reglas automáticas iniciales (solo si aún no hay ninguna)
  if not exists (select 1 from public.rules) then
    insert into public.rules (keyword, category_id, priority)
    select v.keyword, c.id, v.priority
    from (values
      ('TARJ.CRDTO', 'Liquidación de tarjeta', 10),
      ('PAGO RECIBO', 'Liquidación de tarjeta', 20),
      ('APORTACION', 'Aportación a la conjunta', 30),
      ('TRASPASO A', 'Ahorro e inversión', 40),
      ('TRASPASO DE', 'Ahorro e inversión', 50),
      ('PATRIMONIO', 'Ahorro e inversión', 60),
      ('CAMPANA NOMINA', 'Otros ingresos', 70),
      ('HAZTE CLIENTE', 'Otros ingresos', 80),
      ('NOMINA', 'Nómina', 90),
      ('DISP. PTM', 'Compra de vivienda y extraordinarios', 100),
      ('PROV FONDOS', 'Compra de vivienda y extraordinarios', 110),
      ('TASACION', 'Compra de vivienda y extraordinarios', 120),
      ('NOTARIA', 'Compra de vivienda y extraordinarios', 130),
      ('REGISTRO DE LA PROPIEDAD', 'Compra de vivienda y extraordinarios', 140),
      ('COMPRAVENTA', 'Compra de vivienda y extraordinarios', 150),
      ('CUOTA PTMO', 'Hipoteca o alquiler', 160),
      ('CUOTA PRESTAMO', 'Hipoteca o alquiler', 170),
      ('HIPOTECA', 'Hipoteca o alquiler', 180),
      ('ALQUILER', 'Hipoteca o alquiler', 190),
      ('COMUNIDAD', 'Comunidad y gastos de vivienda', 200),
      ('MOVISTAR PLUS', 'Ocio y suscripciones', 210),
      ('DESC.CAMPANA', 'Seguros', 220),
      ('PAGO AGRUP', 'Seguros', 230),
      ('SEGUROS', 'Seguros', 240),
      ('=SEG', 'Seguros', 250),
      ('SEGURO', 'Seguros', 260),
      ('MAPFRE', 'Seguros', 270),
      ('MUTUA', 'Seguros', 280),
      ('IBERDROLA', 'Suministros y telecom', 290),
      ('ENDESA', 'Suministros y telecom', 300),
      ('NATURGY', 'Suministros y telecom', 310),
      ('ELECTRICIDAD', 'Suministros y telecom', 320),
      ('VODAFONE', 'Suministros y telecom', 330),
      ('MOVISTAR', 'Suministros y telecom', 340),
      ('ORANGE', 'Suministros y telecom', 350),
      ('TELEFONICA', 'Suministros y telecom', 360),
      ('=DIGI', 'Suministros y telecom', 370),
      ('=AGUA', 'Suministros y telecom', 380),
      ('=LUZ', 'Suministros y telecom', 390),
      ('GAS NATURAL', 'Suministros y telecom', 400),
      ('IMPUESTO', 'Impuestos y tasas', 410),
      ('CIRCULACION', 'Impuestos y tasas', 420),
      ('HACIENDA', 'Impuestos y tasas', 430),
      ('AEAT', 'Impuestos y tasas', 440),
      ('TRIBUT', 'Impuestos y tasas', 450),
      ('AYUNTAMIENTO', 'Impuestos y tasas', 460),
      ('=IBI', 'Impuestos y tasas', 470),
      ('=DGT', 'Impuestos y tasas', 480),
      ('=TASA', 'Impuestos y tasas', 490),
      ('LIQ. DE', 'Comisiones bancarias', 500),
      ('LIQUIDACI', 'Comisiones bancarias', 510),
      ('COMISION', 'Comisiones bancarias', 520),
      ('INTERESES', 'Comisiones bancarias', 530),
      ('PAGO CAJERO', 'Efectivo', 540),
      ('CAJERO', 'Efectivo', 550),
      ('REINTEGRO', 'Efectivo', 560),
      ('AUTOPISTA', 'Transporte', 570),
      ('PEAJE', 'Transporte', 580),
      ('=VIAT', 'Transporte', 590),
      ('=VIA T', 'Transporte', 600),
      ('GASOLINERA', 'Transporte', 610),
      ('=E S', 'Transporte', 620),
      ('REPSOL', 'Transporte', 630),
      ('CEPSA', 'Transporte', 640),
      ('PETRONOR', 'Transporte', 650),
      ('GALP', 'Transporte', 660),
      ('=BP', 'Transporte', 670),
      ('SHELL', 'Transporte', 680),
      ('PARKING', 'Transporte', 690),
      ('RENFE', 'Transporte', 700),
      ('=METRO', 'Transporte', 710),
      ('=BUS', 'Transporte', 720),
      ('TAXI', 'Transporte', 730),
      ('UBER', 'Transporte', 740),
      ('CABIFY', 'Transporte', 750),
      ('BLABLACAR', 'Transporte', 760),
      ('=ITV', 'Transporte', 770),
      ('FARMACIA', 'Salud', 780),
      ('FISIOTERAPIA', 'Salud', 790),
      ('CLINICA', 'Salud', 800),
      ('DENTAL', 'Salud', 810),
      ('DENTISTA', 'Salud', 820),
      ('OPTICA', 'Salud', 830),
      ('MEDICO', 'Salud', 840),
      ('HOSPITAL', 'Salud', 850),
      ('GAFAS', 'Salud', 860),
      ('PELUQUERIA', 'Cuidado personal', 870),
      ('JEAN LOUIS', 'Cuidado personal', 880),
      ('PRIMOR', 'Cuidado personal', 890),
      ('SEPHORA', 'Cuidado personal', 900),
      ('DOUGLAS', 'Cuidado personal', 910),
      ('PERFUMERIA', 'Cuidado personal', 920),
      ('BARBER', 'Cuidado personal', 930),
      ('COLAGENO', 'Cuidado personal', 940),
      ('CREMA', 'Cuidado personal', 950),
      ('ESTETICA', 'Cuidado personal', 960),
      ('=ZARA', 'Ropa', 970),
      ('PULL & BEAR', 'Ropa', 980),
      ('PULL&BEAR', 'Ropa', 990),
      ('BERSHKA', 'Ropa', 1000),
      ('STRADIVARIUS', 'Ropa', 1010),
      ('MASSIMO DUTTI', 'Ropa', 1020),
      ('SPRINGFIELD', 'Ropa', 1030),
      ('PRIMARK', 'Ropa', 1040),
      ('=MANGO', 'Ropa', 1050),
      ('OYSHO', 'Ropa', 1060),
      ('KIABI', 'Ropa', 1070),
      ('DECATHLON', 'Ropa', 1080),
      ('ZAPATERIA', 'Ropa', 1090),
      ('CAMISETA', 'Ropa', 1100),
      ('=H&M', 'Ropa', 1110),
      ('LEFTIES', 'Ropa', 1120),
      ('VINTED', 'Ropa', 1130),
      ('LEROY', 'Hogar y equipamiento', 1140),
      ('BRICO', 'Hogar y equipamiento', 1150),
      ('IKEA', 'Hogar y equipamiento', 1160),
      ('CASAVIVA', 'Hogar y equipamiento', 1170),
      ('MEDIA MARKT', 'Hogar y equipamiento', 1180),
      ('MEDIAMARKT', 'Hogar y equipamiento', 1190),
      ('FERRETERIA', 'Hogar y equipamiento', 1200),
      ('CONFORAMA', 'Hogar y equipamiento', 1210),
      ('MUEBLE', 'Hogar y equipamiento', 1220),
      ('FUNDA', 'Hogar y equipamiento', 1230),
      ('BAZAR', 'Hogar y equipamiento', 1240),
      ('FNAC', 'Hogar y equipamiento', 1250),
      ('PCCOMPONENTES', 'Hogar y equipamiento', 1260),
      ('WORTEN', 'Hogar y equipamiento', 1270),
      ('=AKI', 'Hogar y equipamiento', 1280),
      ('ITUNES', 'Ocio y suscripciones', 1290),
      ('AMAZON PRIME', 'Ocio y suscripciones', 1300),
      ('NETFLIX', 'Ocio y suscripciones', 1310),
      ('SPOTIFY', 'Ocio y suscripciones', 1320),
      ('=HBO', 'Ocio y suscripciones', 1330),
      ('DISNEY', 'Ocio y suscripciones', 1340),
      ('YOUTUBE', 'Ocio y suscripciones', 1350),
      ('OPENAI', 'Ocio y suscripciones', 1360),
      ('CHATGPT', 'Ocio y suscripciones', 1370),
      ('CHATLY', 'Ocio y suscripciones', 1380),
      ('SUSCRIPCION', 'Ocio y suscripciones', 1390),
      ('=CINE', 'Ocio y suscripciones', 1400),
      ('CINES', 'Ocio y suscripciones', 1410),
      ('CINEMA', 'Ocio y suscripciones', 1420),
      ('TEATRO', 'Ocio y suscripciones', 1430),
      ('CONCIERTO', 'Ocio y suscripciones', 1440),
      ('ENTRADA', 'Ocio y suscripciones', 1450),
      ('FUNICULAR', 'Ocio y suscripciones', 1460),
      ('LIBRO', 'Ocio y suscripciones', 1470),
      ('LIBRERIA', 'Ocio y suscripciones', 1480),
      ('STEAM', 'Ocio y suscripciones', 1490),
      ('PLAYSTATION', 'Ocio y suscripciones', 1500),
      ('NINTENDO', 'Ocio y suscripciones', 1510),
      ('GIMNASIO', 'Ocio y suscripciones', 1520),
      ('POLIDEPORTIVO', 'Ocio y suscripciones', 1530),
      ('=GYM', 'Ocio y suscripciones', 1540),
      ('MERCADONA', 'Alimentación', 1550),
      ('EROSKI', 'Alimentación', 1560),
      ('=LIDL', 'Alimentación', 1570),
      ('=ALDI', 'Alimentación', 1580),
      ('CARREFOUR', 'Alimentación', 1590),
      ('ALCAMPO', 'Alimentación', 1600),
      ('=DIA', 'Alimentación', 1610),
      ('SUPERMERCADO', 'Alimentación', 1620),
      ('=SUPER', 'Alimentación', 1630),
      ('MINIMARKET', 'Alimentación', 1640),
      ('MERKACHINA', 'Alimentación', 1650),
      ('MERKA CHINA', 'Alimentación', 1660),
      ('HIPERMERCADO', 'Alimentación', 1670),
      ('PANADERIA', 'Alimentación', 1680),
      ('CARNICERIA', 'Alimentación', 1690),
      ('PESCADERIA', 'Alimentación', 1700),
      ('FRUTERIA', 'Alimentación', 1710),
      ('VERDULERIA', 'Alimentación', 1720),
      ('CAFE', 'Restauración', 1730),
      ('KAFE', 'Restauración', 1740),
      ('=BAR', 'Restauración', 1750),
      ('TABERNA', 'Restauración', 1760),
      ('RESTAURA', 'Restauración', 1770),
      ('GASTROBAR', 'Restauración', 1780),
      ('PIZZA', 'Restauración', 1790),
      ('PIZZERIA', 'Restauración', 1800),
      ('MCDONALD', 'Restauración', 1810),
      ('MC DONALD', 'Restauración', 1820),
      ('BURGER', 'Restauración', 1830),
      ('KEBAB', 'Restauración', 1840),
      ('GELATERIA', 'Restauración', 1850),
      ('HELADERIA', 'Restauración', 1860),
      ('STREET FOOD', 'Restauración', 1870),
      ('HOSTELERIA', 'Restauración', 1880),
      ('CAFFE', 'Restauración', 1890),
      ('TAGLIATELLA', 'Restauración', 1900),
      ('STARBUCKS', 'Restauración', 1910),
      ('TELEPIZZA', 'Restauración', 1920),
      ('DOMINO', 'Restauración', 1930),
      ('=VIPS', 'Restauración', 1940),
      ('GINOS', 'Restauración', 1950),
      ('FOSTERS', 'Restauración', 1960),
      ('CERVECERIA', 'Restauración', 1970),
      ('SIDRERIA', 'Restauración', 1980),
      ('ASADOR', 'Restauración', 1990),
      ('COMIDA', 'Restauración', 2000),
      ('=CENA', 'Restauración', 2010),
      ('HAMBURGUESA', 'Restauración', 2020),
      ('PECHUGAS', 'Restauración', 2030),
      ('BOCATA', 'Restauración', 2040),
      ('PINTXO', 'Restauración', 2050),
      ('AMAZON', 'Compras online', 2060),
      ('WALLAPOP', 'Compras online', 2070),
      ('ALIEXPRESS', 'Compras online', 2080),
      ('=TEMU', 'Compras online', 2090),
      ('SHEIN', 'Compras online', 2100),
      ('EBAY', 'Compras online', 2110),
      ('PAYPAL', 'Compras online', 2120),
      ('MATRICULA', 'Formación y estudios', 2130),
      ('UNIVERSIDAD', 'Formación y estudios', 2140),
      ('ACADEMIA', 'Formación y estudios', 2150),
      ('REGALO', 'Regalos', 2160),
      ('CUMPLE', 'Regalos', 2170),
      ('DEVOLUCION', 'Otros', 9000),
      ('BIZUM', 'Bizum y varios', 9010),
      ('OP.NET', 'Bizum y varios', 9020)
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
