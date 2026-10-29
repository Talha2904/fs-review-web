// Engagement storage: entities (clients), engagements (funds), the firm's check-rule template and the
// disclosure checklists all live on the api (Postgres) and are shared by everyone.
// The screens use the same store interface as before: subscribe*, save, saveEntity, saveConfig.
// Lists are refreshed after every save, when the window regains focus, and every 20 seconds, so a
// colleague's change shows up without a reload. (Server-sent events replace the timer in Phase 3.)
import { withDefaults } from '../data/checkLibrary';

const ACTIVE_KEY = 'fs-review-active-engagement';
const POLL_MS = 20000;

export const newId = (prefix = 'eng') => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

// An entity is the legal entity the funds belong to (an ICAV, SICAV, unit trust and so on).
// Engagements link to it by entityId, so renaming an entity never breaks the link.
export const ENTITY_FIELDS = { name: '', client: '', legalForm: '', jurisdiction: '', yearEnd: '', administrator: '', auditor: '',
  aiPermitted: null, aiBasis: '', aiDecidedBy: null, aiDecidedAt: null, // the client's AI decision (see lib/aiDecision.js)
  framework: '', ruleOverrides: {}, partnerSignoff: false, umbrella: false, billingEmail: '' }; // accounting framework (picks the disclosure checklist); the client's check rule overrides
const toEntity = e => ({ ...ENTITY_FIELDS, ...e });
const plain = v => JSON.parse(JSON.stringify(v)); // strips undefined

async function call(path, method = 'GET', body) {
  const r = await fetch(path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const out = await r.json().catch(() => null);
  if (!r.ok) throw new Error(out?.error?.message || out?.error || `Request failed (${r.status})`); // the api answers { error: { code, message } }
  return out;
}

// A small list cache: subscribers get the current value at once and again after every refresh.
function feed(load) {
  const listeners = new Set();
  let value = null, timer = null, loading = null;
  const refresh = async () => {
    if (loading) return loading;
    loading = load().then(v => { value = v; listeners.forEach(fn => fn.onList(v)); }, e => listeners.forEach(fn => fn.onError?.(e.message))).finally(() => { loading = null; });
    return loading;
  };
  const start = () => { if (!timer) { timer = setInterval(refresh, POLL_MS); window.addEventListener('focus', refresh); } };
  const stop = () => { if (timer && !listeners.size) { clearInterval(timer); timer = null; window.removeEventListener('focus', refresh); } };
  return {
    subscribe(onList, onError) {
      const l = { onList, onError }; listeners.add(l); start();
      if (value !== null) onList(value); else refresh();
      return () => { listeners.delete(l); stop(); };
    },
    refresh
  };
}

function apiStore() {
  const engagements = feed(async () => (await call('/api/engagements')).engagements.map(withDefaults));
  const entities = feed(async () => (await call('/api/entities')).entities.map(toEntity));
  // The firm config the screens expect: { rules, overrides, custom, checklists } or null when never saved.
  const config = feed(async () => {
    const [{ config: rules }, { checklists }] = await Promise.all([call('/api/config/check-rules'), call('/api/config/checklists')]);
    if (!rules && !Object.keys(checklists || {}).length) return null;
    return { rules: rules?.rules || {}, overrides: rules?.overrides || {}, custom: rules?.custom || [], checklists: checklists || {} };
  });
  return {
    mode: 'server',
    subscribeEntities: (onList, onError) => entities.subscribe(onList, onError),
    async saveEntity(ent) {
      const e = plain(ent);
      await call(e.id ? `/api/entities/${encodeURIComponent(e.id)}` : '/api/entities', e.id ? 'PUT' : 'POST', e);
      await entities.refresh();
    },
    subscribeConfig: (onConfig, onError) => config.subscribe(c => onConfig(c), onError),
    // The Administration screens save the whole config; only the parts that changed are sent.
    async saveConfig(cfg) {
      const next = plain(cfg), before = (await config.refresh(), cfgNow());
      const { checklists = {}, ...rules } = next;
      if (JSON.stringify(rules) !== JSON.stringify({ rules: before?.rules || {}, overrides: before?.overrides || {}, custom: before?.custom || [] }))
        await call('/api/config/check-rules', 'PUT', { config: rules });
      for (const [fw, list] of Object.entries(checklists))
        if (JSON.stringify(list.items) !== JSON.stringify(before?.checklists?.[fw]?.items)) await call(`/api/config/checklists/${encodeURIComponent(fw)}`, 'PUT', { items: list.items });
      await config.refresh();
    },
    subscribe: (onList, onError) => engagements.subscribe(onList, onError),
    async save(eng) {
      const e = plain(eng);
      await call(e.id ? `/api/engagements/${encodeURIComponent(e.id)}` : '/api/engagements', e.id ? 'PUT' : 'POST', e);
      await engagements.refresh();
    },
    refreshAll: () => Promise.all([engagements.refresh(), entities.refresh(), config.refresh()])
  };
  function cfgNow() { let v = null; const off = config.subscribe(c => { v = c; }); off(); return v; }
}

export async function connectStore() {
  const store = apiStore();
  await migrateLocalStorage(store);
  return store;
}

// One-time move of data a browser saved before the api existed (the old localStorage store).
// Runs only when the server has nothing yet; a refusal (no permission) is silently skipped.
const LEGACY = { engagements: 'fs-review-engagements-v1', entities: 'fs-review-entities-v1', rules: 'fs-review-check-rules-v1', done: 'fs-review-migrated-to-api' };
async function migrateLocalStorage(store) {
  let read;
  try { if (localStorage.getItem(LEGACY.done)) return; read = k => JSON.parse(localStorage.getItem(k) || 'null'); } catch { return; }
  const ents = read(LEGACY.entities) || [], engs = read(LEGACY.engagements) || [], rules = read(LEGACY.rules);
  if (!ents.length && !engs.length && !rules) { try { localStorage.setItem(LEGACY.done, '1'); } catch { /* ignore */ } return; }
  try {
    const [{ entities }, { engagements }] = await Promise.all([call('/api/entities'), call('/api/engagements')]);
    if (!entities.length && !engagements.length) {
      for (const e of ents) await store.saveEntity(e);
      for (const e of engs) await store.save(e);
      if (rules) await store.saveConfig(rules.rules || rules.custom || rules.overrides ? rules : { rules, overrides: {}, custom: [] });
    }
    localStorage.setItem(LEGACY.done, '1');
  } catch { /* not signed in or not allowed: try again next time */ }
}

// Which engagement this person is reviewing is a per-browser choice.
export const loadActiveId = () => { try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; } };
export const saveActiveId = id => { try { localStorage.setItem(ACTIVE_KEY, id || ''); } catch { /* ignore */ } };
