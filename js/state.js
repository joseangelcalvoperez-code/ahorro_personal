// Estado global de la app (una sola instancia, sin framework).
import { monthsAvailable } from './lib/stats.js';

export const S = {
  store: null,
  user: null,
  data: { profiles: [], accounts: [], categories: [], rules: [], transactions: [] },
  scope: 'personal', // 'personal' | 'conjunta' | 'todo'
  month: null, // 'AAAA-MM'
  accountsById: new Map(),
  catsById: new Map(),
  profilesById: new Map(),
  mov: { q: '', cat: '', all: false }
};

export const SCOPES = [
  ['personal', 'Mi cuenta'],
  ['conjunta', 'Conjunta'],
  ['todo', 'Todo']
];

export function index() {
  S.accountsById = new Map(S.data.accounts.map((a) => [a.id, a]));
  S.catsById = new Map(S.data.categories.map((c) => [c.id, c]));
  S.profilesById = new Map(S.data.profiles.map((p) => [p.id, p]));
  if (!S.month) S.month = monthsAvailable(S.data.transactions)[0] || new Date().toISOString().slice(0, 7);
}

export async function refresh() {
  S.data = await S.store.loadAll();
  index();
}

export const accountLabel = (a) =>
  a.scope === 'conjunta' ? (a.type === 'cuenta' ? 'Cuenta conjunta' : 'Tarjeta conjunta') : a.type === 'cuenta' ? 'Mi cuenta' : 'Mi tarjeta';

export const personName = (id) => S.profilesById.get(id)?.display_name || 'Alguien';
export const otherPerson = () => S.data.profiles.find((p) => p.id !== S.user?.id) || null;

export const ctx = () => ({ accountsById: S.accountsById, catsById: S.catsById, scope: S.scope, month: S.month });
