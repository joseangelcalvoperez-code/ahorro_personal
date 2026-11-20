// Almacén con Supabase. Misma interfaz que local.js.
// La separación entre lo personal y lo conjunto NO se hace aquí: la imponen las políticas RLS
// de supabase/01_schema.sql. Este código solo pide datos y la base de datos devuelve lo permitido.
const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const PAGE = 1000;
const CHUNK = 400;

function fail(error, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

async function fetchAll(buildQuery) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    fail(error, 'Lectura');
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

export async function createSupabaseStore({ url, anonKey }) {
  const { createClient } = await import(SDK);
  const sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  let userId = null;

  const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

  return {
    mode: 'supabase',

    async getSession() {
      const { data } = await sb.auth.getSession();
      userId = data.session?.user?.id ?? null;
      return data.session ? { user: { id: data.session.user.id, email: data.session.user.email } } : null;
    },

    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error('Correo o contraseña incorrectos.');
      userId = data.user.id;
      return { user: { id: data.user.id, email: data.user.email } };
    },

    async signOut() { await sb.auth.signOut(); userId = null; },
    onAuthChange(cb) { sb.auth.onAuthStateChange((_e, session) => cb(session)); },

    async loadAll() {
      const [profiles, accounts, categories, rules] = await Promise.all(
        ['profiles', 'accounts', 'categories', 'rules'].map(async (t) => {
          const { data, error } = await sb.from(t).select('*');
          fail(error, `Lectura de ${t}`);
          return data;
        })
      );
      const transactions = await fetchAll(() => sb.from('transactions').select('*').order('tx_date', { ascending: false }).order('id'));
      return { profiles, accounts, categories, rules, transactions: transactions.map((t) => ({ ...t, amount: Number(t.amount), balance: t.balance == null ? null : Number(t.balance) })) };
    },

    async existingHashes(accountId, from, to) {
      const rows = await fetchAll(() => sb.from('transactions').select('hash').eq('account_id', accountId).gte('tx_date', from).lte('tx_date', to).order('id'));
      return new Set(rows.map((r) => r.hash));
    },

    async insertTransactions(rows) {
      const out = [];
      for (const part of chunks(rows, CHUNK)) {
        const payload = part.map((r) => ({
          account_id: r.account_id, tx_date: r.tx_date, concept: r.concept, amount: r.amount, balance: r.balance ?? null,
          category_id: r.category_id ?? null, category_manual: !!r.category_manual, hash: r.hash, uploaded_by: userId
        }));
        // ignoreDuplicates: si dos personas suben a la vez lo mismo, la base de datos descarta lo repetido
        const { data, error } = await sb.from('transactions').upsert(payload, { onConflict: 'account_id,hash', ignoreDuplicates: true }).select();
        fail(error, 'Guardado de movimientos');
        out.push(...data.map((t) => ({ ...t, amount: Number(t.amount), balance: t.balance == null ? null : Number(t.balance) })));
      }
      return out;
    },

    async updateTransaction(id, patch) {
      const { error } = await sb.from('transactions').update(patch).eq('id', id);
      fail(error, 'Actualización');
    },

    async bulkSetCategory(ids, categoryId) {
      for (const part of chunks(ids, 200)) {
        const { error } = await sb.from('transactions').update({ category_id: categoryId, category_manual: false }).in('id', part);
        fail(error, 'Actualización');
      }
    },

    async deleteTransactions(ids) {
      for (const part of chunks(ids, 200)) {
        const { error } = await sb.from('transactions').delete().in('id', part);
        fail(error, 'Borrado');
      }
    },

    async saveCategory(cat) {
      const payload = { name: cat.name, kind: cat.kind, color: cat.color, budget: cat.budget ?? null };
      const q = cat.id ? sb.from('categories').update(payload).eq('id', cat.id) : sb.from('categories').insert(payload);
      const { data, error } = await q.select().single();
      fail(error, 'Guardado de categoría');
      return { ...data, budget: data.budget == null ? null : Number(data.budget) };
    },

    async deleteCategory(id, reassignTo) {
      if (reassignTo) {
        const { error } = await sb.from('transactions').update({ category_id: reassignTo }).eq('category_id', id);
        fail(error, 'Reasignación');
      }
      const { error } = await sb.from('categories').delete().eq('id', id);
      fail(error, 'Borrado de categoría');
    },

    async saveRule(rule) {
      const payload = { keyword: rule.keyword, category_id: rule.category_id, priority: rule.priority ?? 100 };
      const q = rule.id ? sb.from('rules').update(payload).eq('id', rule.id) : sb.from('rules').insert(payload);
      const { data, error } = await q.select().single();
      fail(error, 'Guardado de regla');
      return data;
    },

    async deleteRule(id) {
      const { error } = await sb.from('rules').delete().eq('id', id);
      fail(error, 'Borrado de regla');
    }
  };
}
