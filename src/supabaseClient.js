// ============================================================
// Shim de compatibilidade com @supabase/supabase-js
// Redireciona todas as chamadas para o backend próprio em /api
// ============================================================

const API_BASE = '/api';
const TOKEN_KEY = 'admin_cesca_token';
const SESSION_KEY = 'admin_cesca_session';

// Listeners de auth state change
const authListeners = [];

function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredSession(session) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(TOKEN_KEY, session.access_token);
  } else {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
  authListeners.forEach(cb => cb(session ? 'SIGNED_IN' : 'SIGNED_OUT', session));
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return res.json();
}

// ============================================================
// Query Builder — implementa a interface encadeada do Supabase
// ============================================================
class QueryBuilder {
  constructor(table) {
    this._table = table;
    this._select = '*';
    this._filters = {};
    this._order = {};
    this._single = false;
    this._maybeSingle = false;
    this._upsert = false;
    this._onConflict = null;
    this._method = 'GET';
    this._body = null;
    this._returnSelect = false;
  }

  select(cols = '*') {
    this._select = cols;
    this._returnSelect = true;
    return this;
  }

  insert(data) {
    this._method = 'POST';
    this._body = data;
    return this;
  }

  update(data) {
    this._method = 'PATCH';
    this._body = data;
    return this;
  }

  delete() {
    this._method = 'DELETE';
    return this;
  }

  upsert(data, opts = {}) {
    this._method = 'POST';
    this._body = data;
    this._upsert = true;
    this._onConflict = opts.onConflict || null;
    return this;
  }

  eq(col, val) { this._filters[`eq.${col}`] = val; return this; }
  neq(col, val) { this._filters[`neq.${col}`] = val; return this; }
  gte(col, val) { this._filters[`gte.${col}`] = val; return this; }
  lte(col, val) { this._filters[`lte.${col}`] = val; return this; }
  gt(col, val) { this._filters[`gt.${col}`] = val; return this; }
  lt(col, val) { this._filters[`lt.${col}`] = val; return this; }
  like(col, val) { this._filters[`like.${col}`] = val; return this; }
  ilike(col, val) { this._filters[`ilike.${col}`] = val; return this; }
  is(col, val) { this._filters[`is.${col}`] = val === null ? 'null' : String(val); return this; }
  in(col, vals) { this._filters[`in.${col}`] = `(${vals.join(',')})`; return this; }

  order(col, opts = {}) {
    this._order[`order.${col}`] = opts.ascending === false ? 'desc' : 'asc';
    if (opts.nullsFirst) this._order.nullsFirst = 'true';
    return this;
  }

  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }
  limit(n) { this._filters.limit = n; return this; }

  then(resolve, reject) {
    return this._execute().then(resolve, reject);
  }

  async _execute() {
    const params = new URLSearchParams({
      select: this._select,
      ...this._filters,
      ...this._order,
      ...(this._single ? { single: 'true' } : {}),
      ...(this._maybeSingle ? { maybeSingle: 'true' } : {}),
      ...(this._upsert ? { upsert: 'true' } : {}),
      ...(this._onConflict ? { onConflict: this._onConflict } : {}),
    });

    const path = `/data/${this._table}?${params.toString()}`;

    if (this._method === 'GET') {
      return apiFetch(path);
    }

    if (this._method === 'POST') {
      return apiFetch(path, {
        method: 'POST',
        body: JSON.stringify(this._body),
      });
    }

    if (this._method === 'PATCH') {
      return apiFetch(path, {
        method: 'PATCH',
        body: JSON.stringify(this._body),
      });
    }

    if (this._method === 'DELETE') {
      return apiFetch(path, { method: 'DELETE' });
    }
  }
}

// ============================================================
// Auth shim
// ============================================================
const auth = {
  async signInWithPassword({ email, password }) {
    const result = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (result.data?.session) setStoredSession(result.data.session);
    return result;
  },

  async signOut() {
    await apiFetch('/auth/logout', { method: 'POST' });
    setStoredSession(null);
    return { error: null };
  },

  async getSession() {
    const session = getStoredSession();
    if (!session) return { data: { session: null }, error: null };
    // Validate token is not expired
    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        setStoredSession(null);
        return { data: { session: null }, error: null };
      }
    } catch {
      setStoredSession(null);
      return { data: { session: null }, error: null };
    }
    return { data: { session }, error: null };
  },

  async getUser() {
    const session = getStoredSession();
    if (!session) return { data: { user: null }, error: null };
    return { data: { user: session.user }, error: null };
  },

  onAuthStateChange(callback) {
    authListeners.push(callback);
    // Fire immediately with current state
    const session = getStoredSession();
    setTimeout(() => callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session), 0);
    return {
      data: {
        subscription: {
          unsubscribe() {
            const idx = authListeners.indexOf(callback);
            if (idx > -1) authListeners.splice(idx, 1);
          },
        },
      },
    };
  },

  async signUp({ email, password, options }) {
    return apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, options }),
    });
  },

  async updateUser({ password }) {
    const result = await apiFetch('/auth/user', {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    });
    return result;
  },

  async verifyInvite(token) {
    const result = await apiFetch('/auth/verify-invite', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    if (result.data?.session) setStoredSession(result.data.session);
    return result;
  },
};

// ============================================================
// Functions shim
// ============================================================
const functions = {
  async invoke(name, { body } = {}) {
    return apiFetch(`/functions/${name}`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    });
  },
};

// ============================================================
// Cliente principal (substitui createClient do Supabase)
// ============================================================
export const supabase = {
  auth,
  functions,
  from(table) {
    return new QueryBuilder(table);
  },
};
