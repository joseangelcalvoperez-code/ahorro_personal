// Categorías y reglas iniciales. Fuente única: la usa el modo local y scripts/gen-seed.mjs
// genera con ella supabase/02_seed.sql.
//
// kind:
//   gasto         -> cuenta como gasto (un importe positivo lo reduce: devolución)
//   ingreso       -> cuenta como ingreso
//   aportacion    -> aportación mensual a la conjunta: salida en tu cuenta, ingreso en la conjunta
//   transferencia -> movimiento interno (liquidación de tarjeta, traspaso a ahorro): ni gasto ni ingreso

export const DEFAULT_CATEGORIES = [
  { name: 'Vivienda', kind: 'gasto', color: '#2B5C8A' },
  { name: 'Alimentación', kind: 'gasto', color: '#1F6B52' },
  { name: 'Restauración', kind: 'gasto', color: '#B4570B' },
  { name: 'Suministros', kind: 'gasto', color: '#7A6A1E' },
  { name: 'Transporte', kind: 'gasto', color: '#6B4C9A' },
  { name: 'Salud', kind: 'gasto', color: '#A33A3A' },
  { name: 'Ropa', kind: 'gasto', color: '#8A2B5C' },
  { name: 'Ocio y suscripciones', kind: 'gasto', color: '#2B7A8A' },
  { name: 'Seguros', kind: 'gasto', color: '#5B6560' },
  { name: 'Otros', kind: 'gasto', color: '#8A8F8C' },
  { name: 'Ingresos', kind: 'ingreso', color: '#1F6B52' },
  { name: 'Aportación a la conjunta', kind: 'aportacion', color: '#2B5C8A' },
  { name: 'Liquidación de tarjeta', kind: 'transferencia', color: '#4A5A8A' },
  { name: 'Ahorro e inversión', kind: 'transferencia', color: '#3A7A5C' }
];

// Prioridad: menor número = se evalúa antes.
export const DEFAULT_RULES = [
  { keyword: 'TARJ.CRDTO', category: 'Liquidación de tarjeta' },
  { keyword: 'APORTACION', category: 'Aportación a la conjunta' },
  { keyword: 'PATRIMONIO', category: 'Ahorro e inversión' },
  { keyword: 'NOMINA', category: 'Ingresos' },
  { keyword: 'BIDEGI', category: 'Transporte' },
  { keyword: 'AUTOPISTA', category: 'Transporte' },
  { keyword: 'PEAJE', category: 'Transporte' },
  { keyword: 'COMPRA EN E.S', category: 'Transporte' },
  { keyword: 'COMPRA EN E S', category: 'Transporte' },
  { keyword: 'GASOLINERA', category: 'Transporte' },
  { keyword: 'FARMACIA', category: 'Salud' },
  { keyword: 'FISIOTERAPIA', category: 'Salud' },
  { keyword: 'SEG AUTOS', category: 'Seguros' },
  { keyword: 'SEGUROS', category: 'Seguros' },
  { keyword: 'ALCAMPO', category: 'Alimentación' },
  { keyword: 'MERCADONA', category: 'Alimentación' },
  { keyword: 'EROSKI', category: 'Alimentación' },
  { keyword: 'LIDL', category: 'Alimentación' },
  { keyword: 'CARREFOUR', category: 'Alimentación' },
  { keyword: 'SUPERMERCADO', category: 'Alimentación' },
  { keyword: 'CAFE', category: 'Restauración' },
  { keyword: 'CERVECERIA', category: 'Restauración' },
  { keyword: 'GASTROBAR', category: 'Restauración' },
  { keyword: 'RESTAURA', category: 'Restauración' },
  { keyword: 'AMAZON PRIME', category: 'Ocio y suscripciones' },
  { keyword: 'ITUNES', category: 'Ocio y suscripciones' },
  { keyword: 'NETFLIX', category: 'Ocio y suscripciones' },
  { keyword: 'SPOTIFY', category: 'Ocio y suscripciones' },
  { keyword: 'PULL & BEAR', category: 'Ropa' },
  { keyword: 'ZARA', category: 'Ropa' },
  { keyword: 'ELECTRICIDAD', category: 'Suministros' },
  { keyword: 'IBERDROLA', category: 'Suministros' }
];
