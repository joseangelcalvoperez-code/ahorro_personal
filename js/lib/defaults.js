// Categorías y reglas iniciales GENÉRICAS (conceptos bancarios y cadenas de ámbito nacional).
// Fuente única: la usa el modo local y scripts/gen-seed.mjs, que genera supabase/02_seed.sql y
// supabase/03_actualizar_categorias.sql. Los comercios locales y todo lo específico de cada persona
// NO van aquí: se añaden como reglas desde la pantalla «Categorías y reglas».
//
// kind:
//   gasto         -> cuenta como gasto (un importe positivo lo reduce: devolución, descuento)
//   ingreso       -> cuenta como ingreso
//   aportacion    -> aportación mensual a la conjunta: salida en tu cuenta, ingreso en la conjunta
//   transferencia -> no cuenta: liquidación de tarjeta, traspasos a ahorro, movimientos extraordinarios
//
// Sintaxis de las reglas (ver js/lib/categorize.js):  TEXTO = contiene;  =TEXTO = palabra completa.

export const DEFAULT_CATEGORIES = [
  { name: 'Hipoteca o alquiler', kind: 'gasto', color: '#2B5C8A' },
  { name: 'Comunidad y gastos de vivienda', kind: 'gasto', color: '#4A6FA5' },
  { name: 'Suministros y telecom', kind: 'gasto', color: '#7A6A1E' },
  { name: 'Alimentación', kind: 'gasto', color: '#1F6B52' },
  { name: 'Restauración', kind: 'gasto', color: '#B4570B' },
  { name: 'Transporte', kind: 'gasto', color: '#6B4C9A' },
  { name: 'Salud', kind: 'gasto', color: '#A33A3A' },
  { name: 'Cuidado personal', kind: 'gasto', color: '#C06C84' },
  { name: 'Ropa', kind: 'gasto', color: '#8A2B5C' },
  { name: 'Hogar y equipamiento', kind: 'gasto', color: '#5C7A2B' },
  { name: 'Compras online', kind: 'gasto', color: '#2B7A8A' },
  { name: 'Ocio y suscripciones', kind: 'gasto', color: '#3A6FA0' },
  { name: 'Formación y estudios', kind: 'gasto', color: '#4A7A8A' },
  { name: 'Regalos', kind: 'gasto', color: '#B0508A' },
  { name: 'Seguros', kind: 'gasto', color: '#5B6560' },
  { name: 'Impuestos y tasas', kind: 'gasto', color: '#7A5230' },
  { name: 'Comisiones bancarias', kind: 'gasto', color: '#8A8F8C' },
  { name: 'Efectivo', kind: 'gasto', color: '#6A6A3A' },
  { name: 'Bizum y varios', kind: 'gasto', color: '#7A8A9A' },
  { name: 'Otros', kind: 'gasto', color: '#9A9A8A' },
  { name: 'Nómina', kind: 'ingreso', color: '#1F6B52' },
  { name: 'Otros ingresos', kind: 'ingreso', color: '#3A7A5C' },
  { name: 'Aportación a la conjunta', kind: 'aportacion', color: '#2B5C8A' },
  { name: 'Liquidación de tarjeta', kind: 'transferencia', color: '#4A5A8A' },
  { name: 'Ahorro e inversión', kind: 'transferencia', color: '#3A7A5C' },
  { name: 'Compra de vivienda y extraordinarios', kind: 'transferencia', color: '#6A5A8A' }
];

// Cambios de nombre respecto a la primera versión (para actualizar bases de datos ya creadas).
export const RENAMED_CATEGORIES = [
  ['Vivienda', 'Hipoteca o alquiler'],
  ['Suministros', 'Suministros y telecom'],
  ['Ingresos', 'Nómina']
];

const g = (category, keywords) => keywords.map((keyword) => ({ keyword, category }));

// El ORDEN importa: gana la primera regla que casa. Los respaldos van al final con prioridad fija.
const ORDERED = [
  // --- estructura del banco (lo más importante: evita contar dos veces) ---
  ...g('Liquidación de tarjeta', ['TARJ.CRDTO', 'PAGO RECIBO']), // cargo en la cuenta y abono en la tarjeta
  ...g('Aportación a la conjunta', ['APORTACION']),
  ...g('Ahorro e inversión', ['TRASPASO A', 'TRASPASO DE', 'PATRIMONIO']),
  ...g('Otros ingresos', ['CAMPANA NOMINA', 'HAZTE CLIENTE']),
  ...g('Nómina', ['NOMINA']),
  // --- compra de vivienda y otros movimientos extraordinarios: no cuentan en el ahorro mensual ---
  ...g('Compra de vivienda y extraordinarios', ['DISP. PTM', 'PROV FONDOS', 'TASACION', 'NOTARIA', 'REGISTRO DE LA PROPIEDAD', 'COMPRAVENTA']),
  // --- vivienda ---
  ...g('Hipoteca o alquiler', ['CUOTA PTMO', 'CUOTA PRESTAMO', 'HIPOTECA', 'ALQUILER']),
  ...g('Comunidad y gastos de vivienda', ['COMUNIDAD']),
  // --- suscripciones de TV antes que la operadora de telefonía ---
  ...g('Ocio y suscripciones', ['MOVISTAR PLUS']),
  ...g('Seguros', ['DESC.CAMPANA', 'PAGO AGRUP', 'SEGUROS', '=SEG', 'SEGURO', 'MAPFRE', 'MUTUA']),
  ...g('Suministros y telecom', ['IBERDROLA', 'ENDESA', 'NATURGY', 'ELECTRICIDAD', 'VODAFONE', 'MOVISTAR', 'ORANGE', 'TELEFONICA', '=DIGI', '=AGUA', '=LUZ', 'GAS NATURAL']),
  ...g('Impuestos y tasas', ['IMPUESTO', 'CIRCULACION', 'HACIENDA', 'AEAT', 'TRIBUT', 'AYUNTAMIENTO', '=IBI', '=DGT', '=TASA']),
  ...g('Comisiones bancarias', ['LIQ. DE', 'LIQUIDACI', 'COMISION', 'INTERESES']),
  ...g('Efectivo', ['PAGO CAJERO', 'CAJERO', 'REINTEGRO']),
  // --- transporte (antes que supermercados: una gasolinera de un hipermercado es combustible) ---
  ...g('Transporte', ['AUTOPISTA', 'PEAJE', '=VIAT', '=VIA T', 'GASOLINERA', '=E S', 'REPSOL', 'CEPSA', 'PETRONOR', 'GALP', '=BP', 'SHELL', 'PARKING', 'RENFE', '=METRO', '=BUS', 'TAXI', 'UBER', 'CABIFY', 'BLABLACAR', '=ITV']),
  ...g('Salud', ['FARMACIA', 'FISIOTERAPIA', 'CLINICA', 'DENTAL', 'DENTISTA', 'OPTICA', 'MEDICO', 'HOSPITAL', 'GAFAS']),
  ...g('Cuidado personal', ['PELUQUERIA', 'JEAN LOUIS', 'PRIMOR', 'SEPHORA', 'DOUGLAS', 'PERFUMERIA', 'BARBER', 'COLAGENO', 'CREMA', 'ESTETICA']),
  ...g('Ropa', ['=ZARA', 'PULL & BEAR', 'PULL&BEAR', 'BERSHKA', 'STRADIVARIUS', 'MASSIMO DUTTI', 'SPRINGFIELD', 'PRIMARK', '=MANGO', 'OYSHO', 'KIABI', 'DECATHLON', 'ZAPATERIA', 'CAMISETA', '=H&M', 'LEFTIES', 'VINTED']),
  ...g('Hogar y equipamiento', ['LEROY', 'BRICO', 'IKEA', 'CASAVIVA', 'MEDIA MARKT', 'MEDIAMARKT', 'FERRETERIA', 'CONFORAMA', 'MUEBLE', 'FUNDA', 'BAZAR', 'FNAC', 'PCCOMPONENTES', 'WORTEN', '=AKI']),
  ...g('Ocio y suscripciones', ['ITUNES', 'AMAZON PRIME', 'NETFLIX', 'SPOTIFY', '=HBO', 'DISNEY', 'YOUTUBE', 'OPENAI', 'CHATGPT', 'CHATLY', 'SUSCRIPCION', '=CINE', 'CINES', 'CINEMA', 'TEATRO', 'CONCIERTO', 'ENTRADA', 'FUNICULAR', 'LIBRO', 'LIBRERIA', 'STEAM', 'PLAYSTATION', 'NINTENDO', 'GIMNASIO', 'POLIDEPORTIVO', '=GYM']),
  ...g('Alimentación', ['MERCADONA', 'EROSKI', '=LIDL', '=ALDI', 'CARREFOUR', 'ALCAMPO', '=DIA', 'SUPERMERCADO', '=SUPER', 'MINIMARKET', 'MERKACHINA', 'MERKA CHINA', 'HIPERMERCADO', 'PANADERIA', 'CARNICERIA', 'PESCADERIA', 'FRUTERIA', 'VERDULERIA']),
  ...g('Restauración', ['CAFE', 'KAFE', '=BAR', 'TABERNA', 'RESTAURA', 'GASTROBAR', 'PIZZA', 'PIZZERIA', 'MCDONALD', 'MC DONALD', 'BURGER', 'KEBAB', 'GELATERIA', 'HELADERIA', 'STREET FOOD', 'HOSTELERIA', 'CAFFE', 'TAGLIATELLA', 'STARBUCKS', 'TELEPIZZA', 'DOMINO', '=VIPS', 'GINOS', 'FOSTERS', 'CERVECERIA', 'SIDRERIA', 'ASADOR', 'COMIDA', '=CENA', 'HAMBURGUESA', 'PECHUGAS', 'BOCATA', 'PINTXO']),
  ...g('Compras online', ['AMAZON', 'WALLAPOP', 'ALIEXPRESS', '=TEMU', 'SHEIN', 'EBAY', 'PAYPAL']),
  ...g('Formación y estudios', ['MATRICULA', 'UNIVERSIDAD', 'ACADEMIA']),
  ...g('Regalos', ['REGALO', 'CUMPLE'])
];

export const DEFAULT_RULES = [
  ...ORDERED.map((r, i) => ({ ...r, priority: (i + 1) * 10 })),
  // respaldos: solo se aplican si nada más ha casado
  { keyword: 'DEVOLUCION', category: 'Otros', priority: 9000 },
  { keyword: 'BIZUM', category: 'Bizum y varios', priority: 9010 },
  { keyword: 'OP.NET', category: 'Bizum y varios', priority: 9020 }
];
