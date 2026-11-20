// Almacén local de prueba (localStorage). Misma interfaz que supabase.js.
import { DEFAULT_CATEGORIES, DEFAULT_RULES } from '../lib/defaults.js';

const KEY = 'ahorro_local_v1';
const ME = { id: 'local-user', email: 'local@prueba', name: 'Yo' };
const uuid = () => crypto.randomUUID();

function seed() {
  const categories = DEFAULT_CATEGORIES.map((c) => ({ id: uuid(), budget: null, ...c }));
  const byName = Object.fromEntries(categories.map((c) => [c.name, c.id]));
  return {
    profiles: [{ id: ME.id, display_name: ME.name }],
    accounts: [
      { id: uuid(), name: 'Cuenta personal', scope: 'personal', type: 'cuenta', owner_id: ME.id },
      { id: uuid(), name: 'Tarjeta personal', scope: 'personal', type: 'tarjeta', owner_id: ME.id },
      { id: uuid(), name: 'Cuenta conjunta', scope: 'conjunta', type: 'cuenta', owner_id: null },
      { id: uuid(), name: 'Tarjeta conjunta', scope: 'conjunta', type: 'tarjeta', owner_id: null }
    ],
    categories,
    rules: DEFAULT_RULES.map((r, i) => ({ id: uuid(), keyword: r.keyword, category_id: byName[r.category], priority: (i + 1) * 10 })),
    transactions: []
  };
}

export function createLocalStore() {
  let db;
  try {
    db = JSON.parse(localStorage.getItem(KEY));
  } catch {
    db = null;
  }
  if (!db) db = seed();
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  save();

  return {
    mode: 'local',
    async getSession() { return { user: { id: ME.id, email: ME.email } }; },
    async signIn() { return { user: { id: ME.id, email: ME.email } }; },
    async signOut() {},
    onAuthChange() {},

    async loadAll() { return structuredClone(db); },

    async existingHashes(accountId, from, to) {
      return new Set(db.transactions.filter((t) => t.account_id === accountId && t.tx_date >= from && t.tx_date <= to).map((t) => t.hash));
    },

    async insertTransactions(rows) {
      const have = new Set(db.transactions.map((t) => `${t.account_id}|${t.hash}`));
      const out = [];
      for (const r of rows) {
        const k = `${r.account_id}|${r.hash}`;
        if (have.has(k)) continue;
        have.add(k);
        const row = { id: uuid(), category_manual: false, balance: null, uploaded_by: ME.id, created_at: new Date().toISOString(), ...r };
        db.transactions.push(row);
        out.push(row);
      }
      save();
      return structuredClone(out);
    },

    async updateTransaction(id, patch) {
      const t = db.transactions.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
      save();
    },

    async bulkSetCategory(ids, categoryId) {
      const set = new Set(ids);
      db.transactions.forEach((t) => { if (set.has(t.id)) { t.category_id = categoryId; t.category_manual = false; } });
      save();
    },

    async deleteTransactions(ids) {
      const set = new Set(ids);
      db.transactions = db.transactions.filter((t) => !set.has(t.id));
      save();
    },

    async saveCategory(cat) {
      if (cat.id) {
        Object.assign(db.categories.find((c) => c.id === cat.id), cat);
        save();
        return structuredClone(db.categories.find((c) => c.id === cat.id));
      }
      const row = { id: uuid(), budget: null, color: '#5B6560', ...cat };
      db.categories.push(row);
      save();
      return structuredClone(row);
    },

    async deleteCategory(id, reassignTo) {
      db.transactions.forEach((t) => { if (t.category_id === id) t.category_id = reassignTo || null; });
      db.rules = db.rules.filter((r) => r.category_id !== id);
      db.categories = db.categories.filter((c) => c.id !== id);
      save();
    },

    async saveRule(rule) {
      if (rule.id) {
        Object.assign(db.rules.find((r) => r.id === rule.id), rule);
        save();
        return structuredClone(db.rules.find((r) => r.id === rule.id));
      }
      const row = { id: uuid(), priority: 100, ...rule };
      db.rules.push(row);
      save();
      return structuredClone(row);
    },

    async deleteRule(id) {
      db.rules = db.rules.filter((r) => r.id !== id);
      save();
    },

    async resetAll() { localStorage.removeItem(KEY); db = seed(); save(); }
  };
}
