// Sign-in for the app, through the api: passwords are checked and roles enforced there. The no-server demo
// mode that kept accounts in the browser was retired (ADR 0007); without the api the app says so.
async function call(path, method = 'GET', body) {
  const r = await fetch(path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const out = await r.json().catch(() => null);
  if (!r.ok) throw new Error(out?.error?.message || out?.error || `Request failed (${r.status})`); // the api answers { error: { code, message } }
  return out;
}

const serverAuth = {
  mode: 'server',
  status: () => call('/api/auth/status'),
  me: async () => (await call('/api/auth/me')).user,
  setup: async d => (await call('/api/auth/setup', 'POST', d)).user,
  login: async (username, password) => (await call('/api/auth/login', 'POST', { username, password })).user,
  logout: () => call('/api/auth/logout', 'POST'),
  listUsers: async () => (await call('/api/users')).users,
  createUser: async d => (await call('/api/users', 'POST', d)).user,
  resetAvailable: false,
  forgot: login => call('/api/auth/forgot', 'POST', { login }),
  resetPassword: (token, password) => call('/api/auth/reset', 'POST', { token, password }),
  updateUser: async (id, patch) => (await call('/api/users/' + id, 'PATCH', patch)).user,
  listPeople: async () => (await call('/api/people')).people,
  aiStatus: () => call('/api/ai/status'),
  billingGet: () => call('/api/billing'),
  billingAct: action => call('/api/billing', 'POST', { action }),
  billingIntegrations: () => call('/api/billing/integrations'),
  billingEmail: payload => call('/api/billing/email', 'POST', payload),
  billingFxRefresh: () => call('/api/billing/fx-refresh', 'POST', {}),
  xeroConnect: () => call('/api/xero/connect'),
  xeroDisconnect: () => call('/api/xero/disconnect', 'POST', {}),
  xeroSend: invoiceId => call('/api/xero/invoice', 'POST', { invoiceId }),
  getAiSettings: () => call('/api/ai/settings'),
  saveAiSettings: settings => call('/api/ai/settings', 'PUT', { settings }),
  testAi: () => call('/api/ai/test', 'POST', {}),
  getPermissions: async () => (await call('/api/permissions')).matrix,
  savePermissions: async matrix => (await call('/api/permissions', 'PUT', { matrix })).matrix
};

// The api must answer; there is no other backend.
export async function connectAuth() {
  let r;
  try { r = await fetch('/api/auth/status', { credentials: 'same-origin' }); } catch { r = null; }
  const j = r && r.ok ? await r.json().catch(() => null) : null;
  if (!j || typeof j.setupRequired !== 'boolean') throw new Error('The FS Review server cannot be reached. Check your connection, or ask an Administrator whether the server is running.');
  serverAuth.resetAvailable = !!j.resetAvailable;
  return serverAuth;
}
