// Review storage: every read and write of an engagement's review goes through here, and all of it now
// lives on the api (Postgres and object storage), shared by everyone: documents and their versions,
// the ready-for-review workflow, analysis jobs and runs (the analysis itself runs on the api), review points with their threads and
// evidence, disclosure checklist answers, sign-offs and review reports.
//
// GET /api/engagements/:id/review returns the whole snapshot in the shape the screens use. Changes made
// by colleagues arrive through the api's event stream (/api/events) and refresh it. Files (documents,
// evidence, reports) are fetched on demand and kept in memory for this tab.

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'v-' + Date.now().toString(36) + Math.random().toString(36).slice(2));

// ---- the api ---------------------------------------------------------------------------------
async function call(path, method = 'GET', body, form = null) {
  const r = await fetch(path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: form || (body ? JSON.stringify(body) : undefined) });
  const out = await r.json().catch(() => null);
  if (!r.ok) throw new Error(out?.error?.message || out?.error || `Request failed (${r.status})`);
  return out;
}
async function fetchBytes(path) {
  const r = await fetch(path, { credentials: 'same-origin' });
  if (!r.ok) return null;
  return r.blob();
}

// ---- caches --------------------------------------------------------------------------------
const server = new Map();       // engagementId -> snapshot from the api
const fileBlobs = new Map();    // versionId -> File
const evidenceBlobs = new Map(); // evidenceId -> File
const reportBytes = new Map();  // reportId -> Uint8Array
const loading = new Map();      // engagementId -> in-flight load
const reloadAfter = new Set();  // engagementIds changed again while a load was in flight
const listeners = new Map();    // engagementId -> Set(callback)
const allListeners = new Set(); // callbacks with every fund's snapshot (rarely needed now; the api computes the portfolio and bell)
const changeListeners = new Set(); // callbacks told that something changed somewhere (to refetch the portfolio and bell)
let allLoaded = false, stream = null, pollTimer = null;

const EMPTY = id => ({ engagementId: id, versions: [], current: {}, workflow: { engagementId: id, state: 'preparing', by: null, at: null, reason: '', history: [] },
  signoff: { engagementId: id, state: 'none', by: null, at: null, text: '', summary: null, history: [] }, points: [], messages: [], checklist: null, reports: [], latestRun: null, analysisJob: null });
const snapshot = id => server.get(id) || EMPTY(id);
const snapshotAll = () => Object.fromEntries([...server.keys()].map(id => [id, snapshot(id)]));
function emit(id) { (listeners.get(id) || []).forEach(cb => cb(snapshot(id))); emitAll(); }
function emitAll() { if (allListeners.size) { const all = snapshotAll(); allListeners.forEach(cb => cb(all)); } }

async function fetchFile(v) {
  if (v.sample || fileBlobs.has(v.id)) return;
  try {
    const blob = await fetchBytes(`/api/documents/${encodeURIComponent(v.id)}/file`);
    if (blob) { fileBlobs.set(v.id, new File([blob], v.fileName, { type: blob.type || 'application/octet-stream' })); emit(v.engagementId); }
  } catch { /* offline: the screens show the version without its bytes */ }
}
function remember(snap, full = true) {
  server.set(snap.engagementId, snap);
  if (full) {
    Object.values(snap.current || {}).forEach(v => { fetchFile(v); });
  }
}
async function load(id) {
  // a change during a load is fetched once that load finishes, so the last change is never missed
  if (loading.has(id)) { reloadAfter.add(id); return loading.get(id); }
  const p = call(`/api/engagements/${encodeURIComponent(id)}/review`).then(snap => { remember(snap); emit(id); return snap; })
    .catch(e => { console.warn('review load', e.message); return server.get(id) || null; })
    .finally(() => { loading.delete(id); if (reloadAfter.delete(id)) load(id); });
  loading.set(id, p);
  return p;
}
async function loadAll() {
  try {
    const { reviews } = await call('/api/reviews');
    // the listing leaves each run's result out; a fund that is open in this tab keeps its full snapshot
    Object.values(reviews).forEach(s => { if (!listeners.has(s.engagementId)) remember(s, false); });
    allLoaded = true;
    emitAll();
  } catch (e) { console.warn('reviews load', e.message); }
}
// Live updates: the api's event stream names the engagement that changed; a timer covers proxies that block it.
function connect() {
  if (stream || typeof EventSource === 'undefined') return;
  try {
    stream = new EventSource('/api/events', { withCredentials: true });
    stream.addEventListener('change', ev => {
      try {
        const e = JSON.parse(ev.data);
        changeListeners.forEach(cb => cb(e));
        // an analysis step: update the job in place; the finished job brings the new run and points, so reload then
        const snap = e.engagementId && server.get(e.engagementId);
        if (e.topic === 'analysis_jobs' && snap && ['queued', 'running'].includes(e.data?.status)) {
          server.set(e.engagementId, { ...snap, analysisJob: { ...(snap.analysisJob?.id === e.data.jobId ? snap.analysisJob : { id: e.data.jobId }), status: e.data.status, step: e.data.step, total: e.data.total } });
          emit(e.engagementId);
        } else if (e.engagementId && listeners.has(e.engagementId)) load(e.engagementId);
        else if (allListeners.size) loadAll();
      } catch { /* ignore */ }
    });
    stream.onerror = () => { /* the browser reconnects on its own; the timer keeps us fresh meanwhile */ };
  } catch { stream = null; }
  if (!pollTimer) pollTimer = setInterval(() => { listeners.forEach((_, id) => load(id)); if (allListeners.size) loadAll(); }, 30000);
}
const after = async (engagementId, promise) => { const out = await promise; await load(engagementId); return out; };
const engagementOfVersion = versionId => { for (const s of server.values()) if (s.versions.some(v => v.id === versionId)) return s.engagementId; return null; };
const engagementOfPoint = pointId => { for (const s of server.values()) if (s.points.some(p => p.id === pointId)) return s.engagementId; return null; };
const person = p => (p ? { id: p.id, name: p.name, role: p.role || '' } : null);

export const reviewStore = {
  mode: 'server',
  subscribe(engagementId, cb) {
    if (!listeners.has(engagementId)) listeners.set(engagementId, new Set());
    listeners.get(engagementId).add(cb); cb(snapshot(engagementId));
    connect(); load(engagementId);
    return () => listeners.get(engagementId)?.delete(cb);
  },
  get: async engagementId => { await load(engagementId); return snapshot(engagementId); },
  // Told of every change anywhere (from the event stream); returns the function that stops it.
  onChange(cb) { changeListeners.add(cb); connect(); return () => changeListeners.delete(cb); },
  // Worked out on the api: every fund's stage and who it waits for, and this person's bell.
  portfolio: () => call('/api/portfolio'),
  notifications: () => call('/api/notifications'),
  subscribeAll(cb) { allListeners.add(cb); cb(snapshotAll()); connect(); if (!allLoaded) loadAll(); return () => allListeners.delete(cb); },
  fileOf: versionId => fileBlobs.get(versionId) || null,

  // ---- documents ----
  // The same content as the current version makes no new version; the api says so with `unchanged`.
  // responseTo: the id of the open point a revised document answers (allowed while the documents are marked ready).
  async addVersion({ engagementId, slot, fileName, sample = false, file = null, responseTo = null }) {
    let out;
    if (sample || !file) out = await call(`/api/engagements/${encodeURIComponent(engagementId)}/documents/sample`, 'POST', { slot, name: fileName });
    else {
      const form = new FormData(); form.append('slot', slot); if (responseTo) form.append('responseTo', responseTo); form.append('file', file, fileName);
      out = await call(`/api/engagements/${encodeURIComponent(engagementId)}/documents`, 'POST', null, form);
      fileBlobs.set(out.version.id, file);
    }
    await load(engagementId);
    return out.version;
  },
  async setValidation(versionId, validation) {
    const { version } = await call(`/api/documents/${encodeURIComponent(versionId)}/validation`, 'PUT', { validation });
    await load(version.engagementId);
  },
  async setReadWith(versionId, { mode }) {
    const { version } = await call(`/api/documents/${encodeURIComponent(versionId)}/read-with`, 'PUT', { mode });
    await load(version.engagementId);
  },
  async confirm(versionId, { reason }) {
    const { version } = await call(`/api/documents/${encodeURIComponent(versionId)}/confirm`, 'POST', { reason: reason || '' });
    await load(version.engagementId);
  },
  remove: (engagementId, slot) => after(engagementId, call(`/api/engagements/${encodeURIComponent(engagementId)}/documents/${encodeURIComponent(slot)}`, 'DELETE')),
  setWorkflow: (engagementId, { state, reason = '' }) => after(engagementId, call(`/api/engagements/${encodeURIComponent(engagementId)}/workflow`, 'PUT', { state, reason })),

  // ---- analysis: runs on the api as a background job; its steps arrive on the event stream ----
  // mode 'full' analyses the current documents; 'nextDraft' re-tests the last analysis's points on a new draft.
  async startAnalysis(engagementId, mode = 'full') {
    const { job } = await after(engagementId, call(`/api/engagements/${encodeURIComponent(engagementId)}/analysis-jobs`, 'POST', { mode }));
    return job;
  },

  // ---- disclosure checklist ----
  async answerChecklist(engagementId, { list, framework, itemId, answer, ref }) {
    const { checklist } = await after(engagementId, call(`/api/engagements/${encodeURIComponent(engagementId)}/checklist/answers/${encodeURIComponent(itemId)}`, 'PUT',
      { framework, version: list?.version, items: list?.items, answer, ref: ref || '' }));
    return checklist;
  },

  // ---- review reports: one per final sign-off, earlier versions kept ----
  async addReport(engagementId, { bytes }) {
    const form = new FormData(); form.append('file', new Blob([bytes], { type: 'application/pdf' }), 'report.pdf');
    const { report } = await after(engagementId, call(`/api/engagements/${encodeURIComponent(engagementId)}/reports`, 'POST', null, form));
    reportBytes.set(report.id, bytes);
    return report;
  },
  reportFile: id => reportBytes.get(id) || null,
  async fetchReport(id) {
    if (!reportBytes.has(id)) { const blob = await fetchBytes(`/api/reports/${encodeURIComponent(id)}/file`); if (blob) reportBytes.set(id, new Uint8Array(await blob.arrayBuffer())); }
    return reportBytes.get(id) || null;
  },

  // ---- sign-off: the api checks readiness, enforces who may sign, and tells Finance ----
  async setSignoff(engagementId, { state, text = '', summary = null }) {
    await after(engagementId, call(`/api/engagements/${encodeURIComponent(engagementId)}/signoff`, 'POST', { state, text, summary }));
  },
  signoffOf: engagementId => snapshot(engagementId).signoff?.state || 'none',
  isLocked: engagementId => ['signed', 'manager-signed'].includes(snapshot(engagementId).signoff?.state),

  // ---- review points ----
  async raisePoint(engagementId, content, { assignee }) {
    const { point } = await after(engagementId, call(`/api/engagements/${encodeURIComponent(engagementId)}/points`, 'POST', { content, assignee: person(assignee) }));
    return point;
  },
  async setPointMeta(pointId, { type, dueDate }) {
    const { point } = await call(`/api/points/${encodeURIComponent(pointId)}/meta`, 'PUT', { ...(type !== undefined ? { type } : {}), ...(dueDate !== undefined ? { dueDate } : {}) });
    await load(point.engagementId);
  },
  async assignPoint(pointId, { assignee }) {
    const { point } = await call(`/api/points/${encodeURIComponent(pointId)}/assignee`, 'PUT', { assignee: person(assignee) });
    await load(point.engagementId);
  },
  async comment(pointId, { text }) {
    await call(`/api/points/${encodeURIComponent(pointId)}/comments`, 'POST', { text });
    const id = engagementOfPoint(pointId); if (id) await load(id);
  },
  async addEvidence({ pointId, fileName, file }) {
    const form = new FormData(); form.append('file', file, fileName);
    const { evidence } = await call(`/api/points/${encodeURIComponent(pointId)}/evidence`, 'POST', null, form);
    evidenceBlobs.set(evidence.id, file);
    return evidence;
  },
  evidenceFile: id => evidenceBlobs.get(id) || null,
  async fetchEvidence(id, fileName) {
    if (!evidenceBlobs.has(id)) { const blob = await fetchBytes(`/api/evidence/${encodeURIComponent(id)}/file`); if (blob) evidenceBlobs.set(id, new File([blob], fileName || 'evidence')); }
    return evidenceBlobs.get(id) || null;
  },
  // kind: 'response' (-> responded), 'reopen' (-> reopened), 'clear' (-> cleared)
  async act(pointId, { kind, text = '', attachments = [] }) {
    const { point } = await call(`/api/points/${encodeURIComponent(pointId)}/act`, 'POST', { kind, text, attachments });
    await load(point.engagementId);
  },

  engagementOfVersion,
  newId: uid
};

// What makes two versions "the same document": their content fingerprint (SHA-256), never the file
// name. Built-in samples have no file, so they are identified by their sample name.
export const contentKey = v => (v ? (v.sha256 || (v.sample ? 'sample:' + v.fileName : 'id:' + v.id)) : null);
// The documents an analysis read, compared with what is attached now, by content.
export function contentChanges(review, run) {
  if (!run) return [];
  const byId = Object.fromEntries(review.versions.map(v => [v.id, v]));
  const before = Object.fromEntries(Object.entries(run.documentVersions || {}).map(([k, id]) => [k, byId[id]]));
  const slots = [...new Set([...Object.keys(before), ...Object.keys(review.current)])];
  return slots.filter(k => contentKey(before[k]) !== contentKey(review.current[k])).map(k => ({ slot: k, before: before[k] || null, now: review.current[k] || null }));
}

export const isCleared = v => !!v && (v.validation?.status === 'recognised' || v.validation?.status === 'sample' || !!v.confirmation || v.readWith === 'ai');
