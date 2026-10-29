import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import DocumentsTab from './tabs/DocumentsTab';
import AnalysisTab from './tabs/AnalysisTab';
import VarianceTab from './tabs/VarianceTab';
import ScheduleTab from './tabs/ScheduleTab';
import VersionsTab from './tabs/VersionsTab';
import EngagementList from './tabs/EngagementList';
import EngagementForm from './tabs/EngagementForm';
import { DEFAULT_SETUP, NEW_ENGAGEMENT, ruleOn, settingsSignature, buildLibrary, defaultRulesFor } from './data/checkLibrary';
import { effectiveRules, overridesOf, withOverrides } from './lib/ruleTemplate';
import { LibraryContext } from './lib/library';
import { connectStore, newId } from './lib/engagements';
import FundDashboard from './components/FundDashboard';
import EntityModal from './components/EntityModal';
import NotificationBell from './components/NotificationBell';
import { useLive } from './lib/useLive';
import { personName } from './lib/people';
import { fundAi, AI_LABEL, AI_REASON, entityAi } from './lib/aiDecision';
import { partnerRequired, umbrellaFor, LOCKED_STATES } from './lib/engagementOptions';
import { reviewStore, isCleared, contentKey, contentChanges } from './lib/reviewStore';
import { pdfText, xlsxContent, sha256 } from './lib/docText';
import { validateDocument } from './lib/recognize';
import { parseTrialBalance } from './lib/tbReader';
import { parseInvestmentSchedule } from './lib/isReader';
import { parseFinancialPdf } from './lib/fsReader';
import { NO_SERVER, setAiContext, apiPost } from './lib/api';
import { ocrPdf, isScanned } from './lib/ocr';
import { validateFile } from './lib/validateFile';
import { extOf } from './lib/fileRules';
import LoginPage from './tabs/LoginPage';
import AdminConsole from './tabs/AdminConsole';
import ActivityLogTab from './tabs/ActivityLogTab';
import SignoffTab, { signoffSummary } from './tabs/SignoffTab';
import DisclosuresTab from './tabs/DisclosuresTab';
import PortfolioTab from './tabs/PortfolioTab';
import { reviewReport } from './lib/reviewReport';
import { saveFile } from './lib/download';
import { checklistFor, checklistSummary } from './lib/disclosures';
import { connectAuth } from './lib/auth';
import { ActivityContext, makeActivity, useActivity } from './lib/activity';
import { can, canClearPoint, isAdminArea, isFinanceArea, setPermissions, getPermissions } from './lib/roles';
import FinanceConsole from './tabs/FinanceConsole';
import { slotDefs } from './data/sampleFund';
import { withSetup, varianceOpts } from './lib/pipeline';
import { runChecks, rankPoints, varianceModel } from './lib/review';
import { fmt, fmtDate, pctLabel, sym, setCurrency, gbp, whenOf } from './lib/format';
import { Pill, cap, body, muted, STATUS_LABEL } from './components/ui';

// Fund details, thresholds and the checks to run live in each engagement (src/data/checkLibrary.js).
const CONFIG = { showFlags: true, showAgentPass: true };
const REQUIRED = ['cy', 'py', 'tb', 'is'];
const CRUMB = { portfolio: 'Portfolio', users: 'Users', engagement: 'Engagement', docs: 'Documents', analysis: 'Analysis', var: 'Variance Analysis', sched: 'Review Points', vers: 'Version Comparison', disc: 'Disclosures', signoff: 'Sign-off', activity: 'Activity Log' };

function Workspace({ user, auth, onSignOut }) {
  const { log: logRaw } = useActivity();
  const canEditEng = can(user, 'engagements.edit'), canRun = can(user, 'analysis.run'), canRaise0 = can(user, 'points.raise'), canRespond0 = can(user, 'points.respond'), canSignoff = can(user, 'review.signoff'),
    canResubmit = can(user, 'points.clear') || can(user, 'points.clearAny'), canAttach = can(user, 'documents.attach');
  // Engagements: the saved list, which one is under review, and the form being edited.
  const [store, setStore] = useState(null);
  const [engagements, setEngagements] = useState(null); // null while loading
  const [loadError, setLoadError] = useState('');
  const [canWrite, setCanWrite] = useState(true);
  const [activeId, setActiveId] = useState(''); // every session starts on the listing with nothing in review
  const [draft, setDraft] = useState(null);             // null = showing the listing
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [entities, setEntities] = useState(null); // null while loading
  const [entityModal, setEntityModal] = useState(null); // { entity, onCreated } while the entity form is open
  const [people, setPeople] = useState([]); // staff directory for the preparer, reviewer and manager lists
  useEffect(() => { auth.listPeople().then(setPeople).catch(() => setPeople([])); }, [auth]);
  const [firmConfig, setFirmConfig] = useState(null); // the Administrator's check library, if saved
  const library = useMemo(() => buildLibrary(firmConfig), [firmConfig]);
  useEffect(() => {
    let unsub, unsubRules, unsubEnt, gone = false;
    connectStore().then(async st => {
      if (gone) return;
      setStore(st);
      unsubRules = st.subscribeConfig(c => setFirmConfig(c));
      unsubEnt = st.subscribeEntities(list => setEntities(list), msg => setLoadError(msg));
      unsub = st.subscribe(list => { setEngagements(list); setLoadError(''); }, msg => setLoadError(msg));
    });
    return () => { gone = true; unsub?.(); unsubRules?.(); unsubEnt?.(); };
  }, []);
  const active = useMemo(() => (engagements || []).find(e => e.id === activeId) || null, [engagements, activeId]);
  const entityOf = e => (entities || []).find(x => x.id === e?.entityId) || null;
  const activeEntity = entityOf(active);
  // Every entry made here is tagged with the fund in review, unless the caller names another fund (or none).
  const log = (category, summary, details = '', meta = {}) => logRaw(category, summary, details, { engagementId: active?.id || null, fundName: active?.fund?.name || null, ...meta });
  const fundMeta = e => ({ engagementId: e.id, fundName: e.fund?.name || null });
  // The firm's rule template applies live; an engagement stores only its overrides.
  const ruleTemplate = useMemo(() => ({ ...defaultRulesFor(library), ...(firmConfig?.rules || {}) }), [library, firmConfig]);
  // Rules apply in three levels: the firm template, then the client's (entity's) overrides, then the fund's.
  const baseFor = e => withOverrides(ruleTemplate, (entities || []).find(x => x.id === e?.entityId)?.ruleOverrides);
  const rulesOf = e => effectiveRules(e, baseFor(e));
  const setup = useMemo(() => (active ? { ...active, rules: effectiveRules(active, baseFor(active)) } : DEFAULT_SETUP), [active, ruleTemplate, entities]); // eslint-disable-line react-hooks/exhaustive-deps
  setCurrency(active?.fund?.currency || 'GBP'); // every amount in the review is shown in the fund's presentation currency
  const [ranWith, setRanWith] = useState('');
  const th = setup.threshold;
  const [tab, setTab] = useState('engagement');

  const startRules = () => ({ ...ruleTemplate });
  // A new fund can be started from an entity's Add Fund button, which links it and fills its year end.
  const openEngagement = (e, entityId = null) => {
    const ent = (entities || []).find(x => x.id === entityId);
    setDraft(e ? { ...e, rules: rulesOf(e) } : { ...NEW_ENGAGEMENT, entityId: ent?.id || '', fund: { ...NEW_ENGAGEMENT.fund, yearEnd: ent?.yearEnd || '' }, rules: baseFor({ entityId: ent?.id }) }); // the client's settings over the firm template
    setSaveError(''); setNotice('');
  };
  async function saveEntity(ent) {
    const isNew = !ent.id, now = new Date().toISOString();
    const before = (entities || []).find(x => x.id === ent.id);
    const saved = { ...ent, id: ent.id || newId('ent'), createdAt: ent.createdAt || now, savedAt: now };
    await store.saveEntity(saved); // errors are shown in the entity form
    const labels = { name: 'name', client: 'client', legalForm: 'legal form', jurisdiction: 'jurisdiction', yearEnd: 'year end', administrator: 'administrator', auditor: 'auditor' };
    const changed = before ? Object.keys(labels).filter(k => (before[k] || '') !== (saved[k] || '')).map(k => labels[k]) : [];
    log('Engagements', isNew ? `Created entity ${saved.name}` : `Updated entity ${saved.name}`,
      isNew ? [saved.client && `Client ${saved.client}`, saved.legalForm, saved.jurisdiction].filter(Boolean).join(' · ') : `Changed: ${changed.join(', ') || 'nothing'}${before && before.name !== saved.name ? ` · renamed from ${before.name}` : ''}`, { engagementId: null, fundName: null });
    if (saved.aiDecidedAt && saved.aiDecidedAt !== before?.aiDecidedAt)
      log('Engagements', `Recorded the AI decision for ${saved.name}: ${saved.aiPermitted ? 'AI permitted' : 'AI not permitted'}`, `Basis: ${saved.aiBasis}`, { engagementId: null, fundName: null });
    const cb = entityModal?.onCreated;
    setEntityModal(null);
    if (cb) cb(saved); else setNotice(isNew ? `${saved.name} was added. Click Add Fund under it to add its funds.` : `${saved.name} was saved.`);
  }
  const closeEngagement = () => { setDraft(null); setSaveError(''); };
  async function saveEngagement() {
    const isNew = !draft.id;
    const now = new Date().toISOString();
    const { rules: draftRules, ...rest } = draft;
    const eng = { ...rest, ruleOverrides: overridesOf(draftRules, baseFor(draft)), id: draft.id || newId(), createdAt: draft.createdAt || now, savedAt: now };
    setSaving(true); setSaveError('');
    try {
      await store.save(eng);
      const prev = (engagements || []).find(x => x.id === eng.id), ent = entityOf(eng);
      log('Engagements', `${isNew ? 'Created' : 'Updated'} engagement ${eng.fund.name}`,
        `Entity ${ent?.name || '—'} · year end ${fmtDate(eng.fund.yearEnd)} · threshold ${sym(eng.fund?.currency)}${fmt(eng.threshold)} · ${library.filter(r => rulesOf(eng)[r.id]?.on).length} checks on · ${Object.keys(eng.ruleOverrides).length} override${Object.keys(eng.ruleOverrides).length === 1 ? '' : 's'} of the firm template`, fundMeta(eng));
      if (!!prev?.aiOff !== !!eng.aiOff) log('Engagements', `${eng.aiOff ? 'Turned AI off' : 'Turned AI back on'} for ${eng.fund.name}`, eng.aiOff ? `Basis: ${eng.aiOffBasis || '—'}` : '', fundMeta(eng));
      if (prev && prev.entityId !== eng.entityId) log('Engagements', `Moved ${eng.fund.name} to entity ${ent?.name || '—'}`, `From ${entityOf(prev)?.name || 'no entity'}`, fundMeta(eng));
      setDraft(null);
      setNotice(eng.id === activeId ? `${eng.fund.name} was saved. Its new settings apply to the review.`
        : `${eng.fund.name} ${isNew ? 'was added to the listing' : 'was saved'}. Click In Review to start reviewing it.`);
    } catch (e) {
      setSaveError(e.message);
      if (/permission/.test(e.message)) setCanWrite(false);
    } finally { setSaving(false); }
  }
  // Putting a different engagement in review starts a clean review, so documents and
  // results from one fund are never shown against another.
  const activate = id => {
    const switching = activeId && activeId !== id && (result || Object.keys(files).length);
    if (switching) { setResult(null); setTray([]); setSel(null); setPhase('idle'); setStep(0); setError(''); setRanWith(''); }
    setActiveId(id);
    const target = engagements.find(x => x.id === id);
    log('Engagements', `Put ${target?.fund?.name || 'an engagement'} in review`, '', target ? fundMeta(target) : {});
    setNotice('');
    setTab('docs'); // selecting a fund takes the reviewer straight to its documents
  };
  // Documents and workflow for the fund in review come from the review store (in memory for now).
  const EMPTY_REVIEW = { versions: [], current: {}, workflow: { state: 'preparing', history: [] }, points: [], messages: [], signoff: { state: 'none', history: [] }, latestRun: null };
  const [review, setReview] = useState(EMPTY_REVIEW);
  useEffect(() => (active ? reviewStore.subscribe(active.id, setReview) : (setReview(EMPTY_REVIEW), undefined)), [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const files = useMemo(() => Object.fromEntries(Object.entries(review.current).map(([slot, v]) =>
    [slot, { name: v.fileName, file: reviewStore.fileOf(v.id), sample: v.sample, versionId: v.id, sha256: v.sha256, readWith: v.readWith || null }])), [review]);
  const wf = review.workflow;
  // Once the Manager signs off, the review is locked: no document, point or analysis changes until unlocked.
  // Locked once the Manager signs off; final when signed (by the Partner, where the client or fund requires it).
  const signed = LOCKED_STATES.includes(review.signoff?.state), finalSigned = review.signoff?.state === 'signed';
  const partnerReq = partnerRequired(active, activeEntity), canPartner = can(user, 'review.partnerSignoff');
  // Umbrella accounts: this fund's figures are read from its own column or section of the client's
  // umbrella documents; the other umbrella funds of the same client tell the reader where sections end.
  const isUmbrella = umbrellaFor(active, activeEntity);
  const umbName = isUmbrella ? (active?.umbrellaName || active?.fund?.name || '') : '';
  const umbSiblings = isUmbrella ? (engagements || []).filter(e => e.entityId === active?.entityId && e.id !== active?.id && umbrellaFor(e, activeEntity)) : [];
  const umbrella = isUmbrella ? { name: umbName, names: [umbName, ...umbSiblings.map(e => e.umbrellaName || e.fund?.name).filter(Boolean)] } : null;
  const canRaise = canRaise0 && !signed, canRespond = canRespond0 && !signed;
  // Show the fund's latest saved analysis when someone opens it (another user, or after switching funds).
  useEffect(() => {
    const run = review.latestRun;
    if (run?.result && run.result !== result) { setResult(run.result); setAnalysedAt(whenOf(run.analysedAt)); setRanWith(run.settingsSig); setPhase('done'); setSel(s => s || run.result.points[0]?.ref || null); }
  }, [review.latestRun?.id, !!review.latestRun?.result]); // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState('idle');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  // The analysis runs on the api. Everyone with the fund open follows its latest job, including one a
  // colleague started; the tab that started it opens the results (or shows the reason it failed).
  const job = review.analysisJob;
  const [startedJob, setStartedJob] = useState(null);
  useEffect(() => {
    if (!job) return;
    if (job.status === 'queued' || job.status === 'running') { setPhase('running'); setStep(job.step || 0); return; }
    if (phase === 'running') setPhase(review.latestRun ? 'done' : 'idle');
    if (job.id !== startedJob) return;
    setStartedJob(null);
    if (job.status === 'failed') { setError(job.error || 'The analysis could not be completed.'); setTab('docs'); }
    else { setTab(job.mode === 'nextDraft' ? 'vers' : 'analysis'); setSel(review.latestRun?.result?.points?.[0]?.ref || null); }
  }, [job?.id, job?.status, job?.step, review.latestRun?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [analysedAt, setAnalysedAt] = useState('');
  const [docSel, setDocSel] = useState('cy');
  const [tray, setTray] = useState([]);
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState('all');
  const [varFilter, setVarFilter] = useState('all');

  const allPresent = REQUIRED.every(k => review.current[k]);
  const allCleared = Object.values(review.current).every(isCleared) && !Object.values(review.current).some(v => v.validation?.status === 'checking');
  const ready = wf.state === 'ready' && allPresent && allCleared; // the analysis runs only on documents marked ready
  const done = !!result;

  const fundName = active?.fund?.name || '';
  const slotName = id => slotDefs.find(d => d.id === id)?.name || id;
  // The analysis runs again only when a document has changed since the last run: a new version,
  // a removed document or a newly added one. Settings changes do not count.
  const lastRun = review.latestRun;
  const docChanges = useMemo(() => contentChanges(review, lastRun).map(({ slot, before, now }) =>
    !before ? `${slotName(slot)} was added (v${now.version})` : !now ? `${slotName(slot)} was removed` : `${slotName(slot)} changed from v${before.version} to v${now.version}`
  ), [lastRun, review]); // eslint-disable-line react-hooks/exhaustive-deps
  const rerunBlocked = !!lastRun && docChanges.length === 0;
  // Documents that need AI to be read: real files, except a trial balance the app can read itself.
  const realDocs = Object.values(review.current).some(v => !v.sample && (!v.validation?.localReadable || v.readWith === 'ai'));
  // What AI may do for this fund: the server's key, the Administrator's settings, and the client's permission.
  const [aiStatus, setAiStatus] = useState(null);
  useEffect(() => { auth.aiStatus().then(setAiStatus).catch(() => setAiStatus(null)); }, [auth, active?.id]);
  const fundAiState = fundAi(active, activeEntity); // permitted | not-permitted | undecided | off-for-fund
  const clientAllowsAi = fundAiState === 'permitted';
  const aiOn = !!aiStatus?.serverKey && !!aiStatus?.enabled && clientAllowsAi;
  const aiFlags = Object.fromEntries(['extract', 'narrative', 'explain', 'version'].map(k => [k, aiOn && aiStatus?.steps?.[k] !== false]));
  useEffect(() => { setAiContext({ engagementId: active?.id || null, fundName: active?.fund?.name || null, aiAllowed: clientAllowsAi, currency: active?.fund?.currency || 'GBP', umbrella: umbrella ? umbName : null }); }, [active?.id, clientAllowsAi, active?.fund?.currency, umbName]); // eslint-disable-line react-hooks/exhaustive-deps // eslint-disable-line react-hooks/exhaustive-deps
  const readBlock = !clientAllowsAi ? `${AI_REASON[fundAiState]} Real documents can be attached and checked but not analysed; the built-in sample documents can still be analysed.`
    : !aiStatus?.serverKey ? 'No Claude API key is configured on the server, so real documents can’t be analysed. An Administrator can check this under AI Settings.'
    : !aiStatus?.enabled ? 'AI is turned off, so real documents can be attached and checked but not analysed. An Administrator can turn it on under AI Settings.'
    : !aiFlags.extract ? 'Reading real documents is turned off under AI Settings, so real documents can be checked but not analysed.' : '';
  const blockedReason = realDocs ? readBlock : '';
  const needsServer = !!blockedReason;
  const editable = canAttach && wf.state !== 'ready' && !signed;
  const STATUS_WORD = { recognised: 'Recognised', check: 'Needs a check', mismatch: 'Mismatch' };
  // Reads the file, applies the recognition rules (no AI) and stores the result on the version.
  async function validateVersion(rec, file, slot, others) {
    let validation;
    try {
      let content = extOf(file.name) === 'pdf' ? await pdfText(file) : await xlsxContent(file);
      // A scanned PDF has no text layer: read it with OCR on the app's server (no AI).
      let ocrNote = null;
      if (extOf(file.name) === 'pdf' && isScanned(content)) {
        {
          await reviewStore.setValidation(rec.id, { status: 'checking', summary: 'Reading scanned pages (OCR)…', checks: [] });
          try {
            content = await ocrPdf(file, { sha256: rec.sha256, post: apiPost });
            const c = content.ocr.confidence;
            ocrNote = c >= 70 ? { result: 'ok', label: 'Scanned', detail: `Scanned PDF read with OCR on the app’s server (${content.ocr.pages} pages, ${c}% confidence). No AI.` }
              : { result: 'warn', label: 'Scanned', detail: `Scanned PDF read with OCR, but the confidence is low (${c}%), so some figures may be misread. Choose whether to read it with AI, keep the OCR reading, or use a clearer scan.`, ocrLow: c };
          } catch (e) { ocrNote = { result: 'warn', label: 'Scanned', detail: `This PDF is scanned and OCR didn’t work (${e.message}).` }; }
        }
      }
      const dup = Object.entries(others).find(([s, v]) => s !== slot && v.sha256 && v.sha256 === rec.sha256)?.[0] || null;
      validation = validateDocument(content, extOf(file.name), {
        slot, fundName, entityName: activeEntity?.name || '', yearEnd: active?.fund?.yearEnd || '',
        otherFundNames: (engagements || []).filter(e => e.id !== active?.id).map(e => e.fund?.name).filter(Boolean), duplicateOf: dup });
      if (ocrNote?.ocrLow) validation.ocrLow = ocrNote.ocrLow;
      if (ocrNote) { validation.checks = [ocrNote, ...validation.checks.filter(c => !(c.label === 'Document type' && /scanned/.test(c.detail)))]; if (ocrNote.result === 'warn' && validation.status === 'recognised') { validation.status = 'check'; validation.summary = 'Needs a check: scanned'; } }
      // A trial balance in a recognised Excel layout is read by the app itself: no AI needed.
      if (slot === 'tb' && extOf(file.name) === 'xlsx') {
        const local = parseTrialBalance(content.sheets);
        validation.localReadable = !!local;
        if (local) validation.checks = [...validation.checks, { result: 'ok', label: 'Reading', detail: `Can be read without AI: ${local.local.accounts} accounts${local.local.statedTotals ? ' and a totals row' : ''}.` }];
      }
      // A digitally produced PDF of the statements or supporting information can often be read too.
      if (['cy', 'py', 'sup'].includes(slot) && extOf(file.name) === 'pdf') {
        const local = parseFinancialPdf(content, slot, slot === 'sup' ? null : umbrella);
        validation.localReadable = !!local;
        const NAMES = { ca: 'asset lines', cl: 'liability lines', pyNA: 'opening net assets', pyOpenNA: 'prior-year opening net assets', subs: 'subscriptions', reds: 'redemptions', ops: 'result for the year',
          income: 'income lines', sciExp: 'expenses', exp: 'expense note', statedNote4: 'investment note total', hier: 'fair value hierarchy', mgmtCharged: 'management fee charged', mgmtRate: 'management fee rate' };
        if (local) validation.checks = [...validation.checks, { result: 'ok', label: 'Reading', detail: local.local.missing.length
          ? `Can be read without AI (${local.meta.replace('read without AI · ', '')}), but these weren’t found: ${local.local.missing.map(k => NAMES[k] || k).join(', ')}. AI reads it fully when available.`
          : `Can be read without AI: ${local.meta.replace('read without AI · ', '')}${slot === 'cy' ? '; every figure the checks need was found' : ''}.` }];
      }
      // Likewise an investment schedule: asset classes as printed, or added up from the holdings.
      if (slot === 'is' && extOf(file.name) === 'xlsx') {
        const local = parseInvestmentSchedule(content.sheets);
        validation.localReadable = !!local;
        if (local) {
          const L = local.local;
          validation.checks = [...validation.checks, { result: 'ok', label: 'Reading', detail: `Can be read without AI: ${L.classes} asset class${L.classes === 1 ? '' : 'es'}${L.holdings ? `, ${L.holdings} holdings` : ''}, total ${sym() + Math.round(L.total).toLocaleString('en-GB')}.` }];
          if (!L.totalAgrees) validation.checks.push({ result: 'warn', label: 'Schedule total', detail: `The schedule’s own total (${sym()}${Math.round(L.statedTotal).toLocaleString('en-GB')}) differs from the sum of its lines (${sym()}${Math.round(L.total).toLocaleString('en-GB')}).` });
          if (validation.status === 'recognised' && !L.totalAgrees) { validation.status = 'check'; validation.summary = 'Needs a check: schedule total'; }
        }
      }
    } catch (e) {
      validation = { status: 'check', recognisedAs: null, confidence: 'unsure', period: null, summary: 'Needs a check: the file could not be read',
        checks: [{ result: 'warn', label: 'Reading the file', detail: `The file could not be read for checking (${e.message}).` }] };
    }
    await reviewStore.setValidation(rec.id, validation);
    log('Documents', `Checked ${slotName(slot)} v${rec.version}: ${STATUS_WORD[validation.status]}`, validation.summary);
    return validation;
  }
  // A file whose content is identical to the current version is not a new version, whatever its
  // name; returns a note for the card. Matching an older version is recorded as "same content as vN".
  async function attach(id, f) {
    if (!editable) return '';
    const hash = f.sample ? '' : await sha256(f.file);
    const key = f.sample ? 'sample:' + f.name : hash, cur = review.current[id];
    if (cur && contentKey(cur) === key) {
      log('Documents', `No new version of ${slotName(id)}: ${f.name} has the same content as v${cur.version}`);
      return `“${f.name}” has the same content as v${cur.version}${cur.fileName !== f.name ? ` (${cur.fileName})` : ''}, so nothing changed and no new version was made.`;
    }
    const earlier = review.versions.filter(v => v.slot === id && contentKey(v) === key).pop();
    const rec = await reviewStore.addVersion({ engagementId: active.id, slot: id, fileName: f.name, size: f.file?.size || 0, sha256: hash, sample: !!f.sample, file: f.file || null, user, sameAs: earlier?.version || null });
    log('Documents', `Attached ${slotName(id)} v${rec.version}: ${f.name}${f.sample ? ' (sample)' : ''}${earlier ? ` (same content as v${earlier.version})` : ''}`);
    if (!f.sample) await validateVersion(rec, f.file, id, review.current);
    return earlier ? `Same content as v${earlier.version}, so this restores that version as v${rec.version}.` : '';
  }
  const detach = async id => { if (!editable) return; await reviewStore.remove(active.id, id, { user }); log('Documents', `Removed ${slotName(id)}`); };
  const attachAll = async () => {
    if (!editable) return;
    for (const d of slotDefs) if (contentKey(review.current[d.id]) !== 'sample:' + d.sample) await reviewStore.addVersion({ engagementId: active.id, slot: d.id, fileName: d.sample, sample: true, user });
    log('Documents', 'Attached all sample documents');
  };
  // Umbrella documents are shared: copy the draft, signed accounts and supporting information from a
  // sister fund of the same client (same files, so no re-reading unless the content differs).
  const SHARED = ['cy', 'py', 'sup'];
  // the sister funds' reviews, loaded only when this fund is an umbrella fund
  const [sisterReviews, setSisterReviews] = useState({});
  const sisterIds = umbSiblings.map(e => e.id).join(',');
  useEffect(() => {
    if (!sisterIds) return setSisterReviews({});
    const offs = sisterIds.split(',').map(id => reviewStore.subscribe(id, snap => setSisterReviews(prev => ({ ...prev, [id]: snap }))));
    return () => offs.forEach(off => off());
  }, [sisterIds]);
  const umbSources = isUmbrella ? umbSiblings.map(e => {
    const cur = sisterReviews[e.id]?.current || {};
    const slots = SHARED.filter(s => cur[s] && !cur[s].sample && contentKey(cur[s]) !== contentKey(review.current[s]));
    return { id: e.id, name: e.fund?.name, slots, versions: slots.map(s => `${slotName(s)} v${cur[s].version}`) };
  }).filter(x => x.slots.length) : [];
  async function copyUmbrellaDocs(src) {
    if (!editable) return;
    const snap = await reviewStore.get(src.id);
    for (const slot of src.slots) {
      const v = snap.current[slot], file = reviewStore.fileOf(v.id); if (!file) continue;
      const earlier = review.versions.filter(x => x.slot === slot && contentKey(x) === contentKey(v)).pop();
      const rec = await reviewStore.addVersion({ engagementId: active.id, slot, fileName: v.fileName, size: v.size, sha256: v.sha256, file, user, sameAs: earlier?.version || null });
      log('Documents', `Attached ${slotName(slot)} v${rec.version}: ${v.fileName} (umbrella document from ${src.name})`);
      await validateVersion(rec, file, slot, review.current);
    }
  }
  // Low OCR confidence: the user may choose to have this document read by AI instead (if allowed).
  const readWithAi = async v => {
    if (!((canAttach || canRun) && !signed) || !aiFlags.extract) return;
    await reviewStore.setReadWith(v.id, { mode: 'ai', user });
    log('Documents', `Chose AI to read ${slotName(v.slot)} v${v.version} (OCR confidence ${v.validation?.ocrLow}%)`, v.fileName);
  };
  const confirmDoc = async (v, reason) => {
    if (!((canAttach || canRun) && !signed)) return;
    await reviewStore.confirm(v.id, { user, reason });
    log('Documents', `Confirmed ${slotName(v.slot)} v${v.version} after a ${v.validation.status === 'mismatch' ? 'mismatch' : 'check'}`, `${v.validation.summary}${reason ? ` · Reason: ${reason}` : ''}`);
  };
  const markReady = async () => { await reviewStore.setWorkflow(active.id, { state: 'ready', user }); log('Documents', 'Marked the documents ready for review', `${Object.keys(review.current).length} documents`); };
  const sendBack = async reason => { await reviewStore.setWorkflow(active.id, { state: 'returned', user, reason }); log('Documents', 'Sent the documents back to the preparer', reason); };
  // Next draft on Version Comparison: stored as a new version, checked, and analysed only if it passes.
  async function attachNextDraft(f) {
    const hash = await sha256(f.file), cur = review.current.cy;
    if (cur && contentKey(cur) === hash) return `“${f.name}” has the same content as the current draft (v${cur.version}), so there is nothing new to analyse.`;
    const rec = await reviewStore.addVersion({ engagementId: active.id, slot: 'cy', fileName: f.name, size: f.file.size, sha256: hash, file: f.file, user });
    log('Documents', `Attached Current Year Draft Financial Statements v${rec.version}: ${f.name}`);
    const v = await validateVersion(rec, f.file, 'cy', review.current);
    if (v.status === 'mismatch') return v.summary;
    analyse({ ...f, sha256: hash, localReadable: !!v.localReadable }); return '';
  }

  async function analyse(nextDraft) {
    if (!canRun) return;
    if (!nextDraft && rerunBlocked) return; // nothing has changed since the last analysis
    if (!nextDraft && blockedReason) return setError(blockedReason);
    if (nextDraft && !nextDraft.sample && !nextDraft.localReadable && readBlock) return setError(readBlock);
    if (nextDraft) {
      if (nextDraft.sample) await reviewStore.addVersion({ engagementId: active.id, slot: 'cy', fileName: nextDraft.name, sample: true, user });
      setTab('docs');
    }
    setPhase('running'); setStep(0); setError('');
    try {
      // the api checks again, runs it in the background and logs it; its steps arrive on the event stream
      const started = await reviewStore.startAnalysis(active.id, nextDraft ? 'nextDraft' : 'full');
      setStartedJob(started.id);
    } catch (e) {
      setError(e.message); setPhase(result ? 'done' : 'idle'); setTab('docs');
    }
  }

  // Review points live in the review store with their owner, assignee and thread.
  const points = useMemo(() => rankPoints(review.points.map(p => ({ ...p.content, ref: p.ref, id: p.id, status: p.status, source: p.source, type: p.type || 'change', dueDate: p.dueDate || null,
    assignedTo: p.assignedTo, raisedBy: p.raisedBy, raisedAt: p.raisedAt, clearedBy: p.clearedBy, clearedAt: p.clearedAt, updatedAt: p.updatedAt }))), [review]);
  const openPoints = points.filter(p => p.status !== 'cleared');
  // Checks re-run instantly when the engagement changes; review points refresh on the next analysis.
  // CHK-13: the disclosure checklist for the client's framework (copied into the review when first answered)
  const clFramework = activeEntity?.framework || '';
  const clList = checklistFor(clFramework, firmConfig);
  const clOn = ruleOn(setup, 'CHK-13');
  const clState = review.checklist?.framework === clFramework ? review.checklist : null;
  const clSum = checklistSummary(clState || clList, clState);
  const checks = useMemo(() => {
    if (!result) return [];
    const out = runChecks(withSetup(result.K, setup), setup, result.docs, library);
    if (clOn) out.push({ id: 'disc', rule: 'CHK-13', name: 'Disclosure checklist complete', area: 'Disclosures', refs: `${clFramework || 'No framework'} checklist`, anchor: '', count: true,
      follow: 'Add the missing disclosures, or explain why they are not required.', comp: null, stated: null,
      ...(!clList ? { diff: null, result: 'Not tested', detail: 'Set the client’s accounting framework to FRS 102 or IFRS on its entity' }
        : clSum.unanswered ? { diff: null, result: 'Not tested', detail: `${clSum.answered} of ${clSum.total} items answered on the Disclosures tab` }
        : clSum.no ? { diff: clSum.no, result: 'Difference', detail: `${clSum.no} disclosure${clSum.no === 1 ? '' : 's'} answered “No”: ${clSum.noItems.slice(0, 2).map(i => i.text).join('; ')}${clSum.no > 2 ? '…' : ''}` }
        : { diff: 0, result: 'Agrees', detail: `All ${clSum.total} items answered; no missing disclosures` }) });
    return out;
  }, [result, setup, library, clOn, clList, clSum.answered, clSum.no, clFramework]); // eslint-disable-line react-hooks/exhaustive-deps
  const varianceOn = ruleOn(setup, 'CHK-11');
  const stale = done && ranWith && ranWith !== settingsSignature(setup);
  const K = result?.K || {};
  const growth = K.pyNA && K.statedNA ? K.statedNA / K.pyNA - 1 : 0;
  const avgGrowth = K.pyOpenNA && K.pyNA && K.statedNA ? (K.pyNA + K.statedNA) / (K.pyOpenNA + K.pyNA) - 1 : null;
  const vm = useMemo(() => (result && varianceOn ? varianceModel(result.docs.cy, result.varNotes, th, growth, varianceOpts(setup)) : { rows: [], groups: [] }), [result, growth, setup, varianceOn, th]);
  const fails = checks.filter(c => c.result === 'Difference').length;
  const investigate = vm.rows.filter(r => r.band === 'Investigate').length;

  const pick = item => setTray(t => t.some(x => x.id === item.id) ? t.filter(x => x.id !== item.id) : [...t, item].slice(-4));
  const preparerOf = () => people.find(x => x.id === active?.fund?.preparerId && x.active && x.role === 'Preparer') || null;
  const pointName = id => review.points.find(p => p.id === id);
  const pushPoint = async p => {
    if (!canRaise) return;
    const prefix = p.ref.replace(/\d+$/, ''), n = review.points.filter(x => x.ref.startsWith(prefix)).length + 1;
    const content = { ...p, ref: prefix + n }, assignee = preparerOf();
    await reviewStore.raisePoint(active.id, content, { user, assignee });
    setTab('sched'); setSel(content.ref);
    log('Review points', `Raised ${content.ref}: ${content.title}`, assignee ? `Assigned to ${assignee.name}` : 'Not assigned');
  };
  const pointActions = {
    // A response can carry a revised document (a new version of that document, checked as usual, even
    // while the documents are locked) and supporting evidence kept with the point.
    respond: async (pt, text, att = {}) => {
      const attachments = [];
      if (att.revised?.file) {
        const { slot, file } = att.revised;
        const why = await validateFile(slot, file, slotName(slot)); if (why) throw new Error(why);
        const hash = await sha256(file), cur = review.current[slot];
        if (cur && contentKey(cur) === hash) throw new Error(`“${file.name}” has the same content as the current ${slotName(slot)} (v${cur.version}), so it isn’t a revision.`);
        const earlier = review.versions.filter(v => v.slot === slot && contentKey(v) === hash).pop();
        const rec = await reviewStore.addVersion({ engagementId: active.id, slot, fileName: file.name, size: file.size, sha256: hash, file, user, sameAs: earlier?.version || null, responseTo: pt.id });
        log('Documents', `Attached ${slotName(slot)} v${rec.version}: ${file.name} (with the response to ${pt.ref})`);
        await validateVersion(rec, file, slot, review.current);
        attachments.push({ type: 'version', slot, versionId: rec.id, version: rec.version, fileName: file.name });
      }
      for (const f of att.evidence || []) {
        if (!/\.(pdf|xlsx|xls|csv|docx|doc|png|jpe?g|msg|eml|txt)$/i.test(f.name)) throw new Error(`“${f.name}” isn’t a supported evidence file (PDF, Excel, CSV, Word, image, email or text).`);
        if (f.size > 25 * 1048576) throw new Error(`“${f.name}” is larger than 25 MB.`);
        const e = await reviewStore.addEvidence({ engagementId: active.id, pointId: pt.id, fileName: f.name, size: f.size, sha256: await sha256(f), file: f, user });
        attachments.push({ type: 'evidence', id: e.id, fileName: f.name, size: f.size });
      }
      await reviewStore.act(pt.id, { kind: 'response', user, text, attachments });
      log('Review points', `${pt.ref}: responded`, text + (attachments.length ? ` · ${attachments.map(a => (a.type === 'version' ? `revised ${slotName(a.slot)} v${a.version}` : `evidence ${a.fileName}`)).join(', ')}` : ''));
    },
    reopen: async (pt, text) => { await reviewStore.act(pt.id, { kind: 'reopen', user, text }); log('Review points', `${pt.ref}: reopened`, text); },
    clear: async (pt, text) => { await reviewStore.act(pt.id, { kind: 'clear', user, text }); log('Review points', `${pt.ref}: cleared`, text || pt.title); },
    comment: async (pt, text) => { await reviewStore.comment(pt.id, { user, text }); log('Review points', `${pt.ref}: comment`, text); },
    meta: async (pt, patch) => { await reviewStore.setPointMeta(pt.id, { ...patch, user }); log('Review points', `${pt.ref}: ${patch.type ? `type ${patch.type}` : patch.dueDate ? `due ${patch.dueDate}` : 'due date removed'}`); },
    assign: async (pt, personId) => { const a = people.find(x => x.id === personId) || null; await reviewStore.assignPoint(pt.id, { assignee: a, user }); log('Review points', `${pt.ref}: ${a ? `assigned to ${a.name}` : 'unassigned'}`); }
  };
  const waitingForMe = pt => (canRespond && ['open', 'reopened'].includes(pt.status) && (!pt.assignedTo || pt.assignedTo.id === user.id))
    || (pt.status === 'responded' && canClearPoint(user, pt));
  const myQueue = points.filter(waitingForMe);

  const addFromTray = () => {
    if (!tray.length) return;
    const vals = tray.map(t => t.value);
    const amount = tray.length === 2 ? Math.abs(vals[0] - vals[1]) : vals.reduce((a, b) => a + b, 0);
    const basis = tray.length === 2
      ? `Difference of ${fmt(amount)} between ${tray[0].label} (${fmt(vals[0])}) and ${tray[1].label} (${fmt(vals[1])}). Raised from the tie-out tray; no explanation on file.`
      : `Cast of ${tray.length} selected figures totals ${fmt(amount)}: ${tray.map(t => t.label).join('; ')}.`;
    pushPoint({ ref: 'RP-M1', pri: 'Medium', area: 'Reviewer', doc: docSel, title: 'Difference identified on tie-out', basis, amount,
      refs: tray.map(t => t.src).join(' · '), follow: 'Obtain the administrator’s explanation and supporting evidence for the difference, and agree the corrected figure to source.',
      status: 'open', agent: 'new', agentNote: 'Raised manually by the reviewer on this version.' });
    setTray([]);
  };

  const raiseVariance = r => pushPoint({
    ref: 'RP-V1', pri: r.pri, area: 'Variance', doc: 'cy',
    title: 'Variance on ' + r.label.charAt(0).toLowerCase() + r.label.slice(1),
    basis: `${r.label} moved from ${sym()}${fmt(r.py)} to ${sym()}${fmt(r.cy)} (${pctLabel(r.pct)}). ${r.note}`,
    amount: Math.abs(r.delta), refs: r.group, follow: r.action,
    status: 'open', agent: 'new', agentNote: 'Raised from the variance analysis on this version.'
  });
  const raised = label => review.points.some(p => p.content.area === 'Variance' && (p.content.basis || '').startsWith(label));

  // Alerts and notifications across every fund, for the bell.
  // worked out on the api (GET /api/notifications) with the same rules the browser used
  const [notes] = useLive(() => reviewStore.notifications(), { actions: [], actionCount: 0, updates: [] });
  const SEEN_KEY = 'fs-review-notifications-seen-' + user.id;
  const [seenAt, setSeenAt] = useState(() => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; } });
  const markSeen = () => { const t = new Date().toISOString(); setSeenAt(t); try { localStorage.setItem(SEEN_KEY, t); } catch { /* per-session only */ } };
  const goToNotice = item => {
    if (item.engagementId !== activeId) activate(item.engagementId);
    setDraft(null); setTab(item.tab);
    if (item.ref) setSel(item.ref);
  };
  const summary = useMemo(() => signoffSummary({ review, points, messages: review.messages, checks, vm, checklist: clOn ? { framework: clFramework, available: !!clList, ...clSum } : null }), [review, points, checks, vm, clOn, clSum.answered, clSum.total]); // eslint-disable-line react-hooks/exhaustive-deps
  const signoffReady = !summary.blockers.length && !signed;
  const signoffBadge = (canSignoff && signoffReady) || (review.signoff?.state === 'returned' && canResubmit) || (review.signoff?.state === 'manager-signed' && canPartner) ? 1 : '';
  // CHK-02: the trial balance mapping is saved on the engagement; the check runs again straight away.
  async function saveTbMap(map, res) {
    if (!(canAttach || canRun) || signed) throw new Error('Your role cannot change the mapping, or the review is signed off.');
    await store.save({ ...active, tbMap: map, tbMapBy: { id: user.id, name: user.name }, tbMapAt: new Date().toISOString(), savedAt: new Date().toISOString() });
    log('Analysis', `Saved the trial balance mapping for ${fundName}`, `${res.mappedCount} of ${res.accounts.length} accounts mapped · ${res.results.filter(r => r.ok).length} of ${res.results.length} lines agree${res.unmapped.length ? ` · ${res.unmapped.length} not mapped` : ''}`);
  }
  // Answering the checklist; a "No" raises a review point for the preparer.
  const answerDisclosure = async (item, answer, ref) => {
    if (!canRaise || !clList) return;
    const before = clState?.answers?.[item.id]?.answer;
    await reviewStore.answerChecklist(active.id, { list: clList, framework: clFramework, itemId: item.id, answer, ref, user });
    log('Review points', `Disclosure checklist ${item.ref}: ${answer === 'na' ? 'N/A' : answer === 'yes' ? 'Yes' : 'No'}`, `${item.text}${ref ? ` · ${ref}` : ''}`);
    if (answer === 'no' && before !== 'no') {
      const n = review.points.filter(p => p.ref.startsWith('RP-D')).length + 1;
      await reviewStore.raisePoint(active.id, { ref: `RP-D${n}`, title: `Disclosure missing: ${item.text}`, pri: 'Medium', area: 'Disclosures', refs: `${clFramework} ${item.ref}`, rule: 'CHK-13',
        basis: `${clFramework} ${item.ref}: ${item.text}. Answered “No” on the disclosure checklist${ref ? ` (${ref})` : ''}.`, follow: 'Add the disclosure, or explain why it is not required.' }, { user, assignee: preparerOf() });
    }
  };
  // ---- the review report: made at the final sign-off; a DRAFT can be made at any time ----
  async function buildReport(draft) {
    const snap = await reviewStore.get(active.id);
    const r = snap.latestRun?.result || {}, reads = r.aiReads || { read: [], reused: [], local: [] }, skipped = r.aiSkipped || [];
    const allSample = Object.values(snap.current).every(v => v.sample);
    const names = list => list.map(slotName).join(', ') || 'none';
    const aiSummary = allSample ? 'The built-in sample documents were used; no AI was used.'
      : !fundAi(active, activeEntity).allowed ? `AI was not used for this fund: ${AI_REASON[fundAi(active, activeEntity).reason] || 'not permitted'}.`
      : `AI model ${aiStatus?.model || '—'}. Documents read by AI: ${names(reads.read)}${reads.reused.length ? `; earlier AI readings reused: ${names(reads.reused)}` : ''}. Read by the application without AI: ${names(reads.local)}.`
        + (skipped.length ? ` Run without AI: ${skipped.join(', ')}.` : ' Narrative points and variance explanations drafted by AI are marked as such.');
    const ocr = Object.entries(snap.current).filter(([, v]) => (v.validation?.checks || []).some(c => c.label === 'Scanned' && /OCR/.test(c.detail))).map(([s]) => slotName(s));
    const team = Object.fromEntries(['preparer', 'reviewer', 'manager', 'partner'].map(k => [k, personName(active.fund, k, people)]));
    const checklist = clOn && clList ? (clState ? { framework: clFramework, version: clState.version, items: clState.items, answers: clState.answers } : { framework: clFramework, version: clList.version, items: clList.items, answers: {} }) : null;
    const overrides = [...Object.keys(activeEntity?.ruleOverrides || {}).map(id => `${id} (client)`), ...Object.keys(active.ruleOverrides || {}).map(id => `${id} (fund)`)];
    const version = (snap.reports || []).length + 1;
    return reviewReport({ eng: { ...active, fund: { ...active.fund, ...team } }, entity: activeEntity, snap, checks, slotName, checklist, money: gbp, draft, version, user,
      ai: { summary: aiSummary, ocr }, options: { partner: partnerReq, umbrella: isUmbrella ? umbName : '', overrides } });
  }
  async function finalReport() {
    try {
      const bytes = await buildReport(false), hash = await sha256(new Blob([bytes]));
      const snap = await reviewStore.get(active.id), fin = [...(snap.signoff.history || [])].reverse().find(h => h.state === 'signed');
      const rec = await reviewStore.addReport(active.id, { bytes, sha256: hash, user, signedBy: fin?.by, signedAt: fin?.at });
      log('Sign-off', `Review report v${rec.version} generated for ${fundName}`, `SHA-256 ${hash.slice(0, 16)}…`);
    } catch (e) { setNotice(`Signed off, but the review report could not be made: ${e.message}`); }
  }
  const reportName = n => `Review report - ${fundName} - ${n}.pdf`;
  const reportActions = {
    draft: async () => { const bytes = await buildReport(true); await saveFile(reportName('DRAFT'), new Blob([bytes], { type: 'application/pdf' })); log('Sign-off', `Downloaded a draft review report for ${fundName}`); },
    download: async rep => { const b = await reviewStore.fetchReport(rep.id); if (b) await saveFile(reportName(`v${rep.version}`), new Blob([b], { type: 'application/pdf' })); }
  };
  const signoffActions = {
    signOff: async text => {
      if (partnerReq) {   // the Manager's sign-off locks the review and passes it to the Partner
        await reviewStore.setSignoff(active.id, { state: 'manager-signed', user, text, summary });
        return log('Sign-off', `Manager signed off ${fundName}; awaiting partner sign-off`, text);
      }
      await reviewStore.setSignoff(active.id, { state: 'signed', user, text, summary });
      log('Sign-off', `Signed off the review of ${fundName}`, text);
      await finalReport();
    },
    partnerSignOff: async text => {
      if (!canPartner) return;
      await reviewStore.setSignoff(active.id, { state: 'signed', user, text, summary });
      log('Sign-off', `Partner signed off the review of ${fundName}`, text);
      await finalReport();
    },
    returnToReviewer: async text => { await reviewStore.setSignoff(active.id, { state: 'returned', user, text }); log('Sign-off', 'Returned the review to the reviewer', text); },
    resubmit: async text => { await reviewStore.setSignoff(active.id, { state: 'resubmitted', user, text }); log('Sign-off', 'Resubmitted the review for sign-off', text); },
    unlock: async text => {
      await reviewStore.setSignoff(active.id, { state: 'unlocked', user, text });
      log('Sign-off', 'Unlocked the review after sign-off', text);
    }
  };
  const tabs = [
    { id: 'portfolio', label: 'Portfolio', count: '' },
    { id: 'engagement', label: 'Engagement', count: engagements?.length || '' },
    { id: 'docs', label: 'Documents', count: `${Object.keys(review.current).length}/5` },
    { id: 'analysis', label: 'Analysis', count: done ? fails : '' },
    { id: 'var', label: 'Variance Analysis', count: done && varianceOn ? investigate : '' },
    { id: 'sched', label: 'Review Points', count: myQueue.length || '' }, // points waiting for the signed-in person
    { id: 'vers', label: 'Version Comparison', count: '' },
    ...(clOn ? [{ id: 'disc', label: 'Disclosures', count: done && clSum.unanswered ? clSum.unanswered : '' }] : []),
    { id: 'signoff', label: 'Sign-off', count: signoffBadge },
    { id: 'activity', label: 'Activity Log', count: '' }
  ].map(t => ({ ...t, locked: ['engagement', 'portfolio'].includes(t.id) ? false : !active ? true : ['docs', 'activity'].includes(t.id) || (t.id === 'sched' && points.length) ? false : !done }))
;

  const missing = REQUIRED.filter(k => !files[k]).length;
  const reads = result?.aiReads;
  const analysisSub = done ? `The file was analysed on ${analysedAt}. ${openPoints.length} review points are open and ${fails} of ${checks.length} checks show a difference.`
    + (reads && (reads.read.length || reads.reused.length) ? ` AI read ${reads.read.length} document${reads.read.length === 1 ? '' : 's'}; ${reads.reused.length} unchanged document${reads.reused.length === 1 ? ' was' : 's were'} reused without AI.` : '')
    + (reads?.local?.length ? ` Read by the app without AI: ${reads.local.map(s => ({ cy: 'draft statements', py: 'signed statements', tb: 'trial balance', is: 'investment schedule', sup: 'supporting information' })[s]).join(', ')}.` : '') : '';

  return (
    <LibraryContext.Provider value={library}>
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'stretch' }}>
      <Sidebar tabs={tabs} tab={tab} onTab={setTab} user={user} onSignOut={onSignOut} meta={tab === 'portfolio' ? [] : active ? [
        { k: 'Entity', v: activeEntity?.name || '—' }, { k: 'Fund', v: active.fund.name || '—' }, { k: 'Year End', v: fmtDate(active.fund.yearEnd) },
        { k: 'Preparer', v: personName(active.fund, 'preparer', people) || '—' }, { k: 'Reviewer', v: personName(active.fund, 'reviewer', people) || '—' },
        { k: 'Manager', v: personName(active.fund, 'manager', people) || '—' }, { k: 'Threshold', v: sym() + fmt(active.threshold) }
      ] : []} />

      <main style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ minHeight: 68, padding: '12px 28px', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)' }}>
          <div style={{ ...body, display: 'flex', gap: 8 }}>
            <span style={muted}>Financial Statement Review</span><span style={{ color: 'var(--snow-black-20)' }}>/</span><span style={{ fontWeight: 600 }}>{CRUMB[tab]}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {finalSigned && tab !== 'portfolio' && <Pill bg="var(--snow-status-complete-bg)">Signed off</Pill>}
            {review.signoff?.state === 'manager-signed' && tab !== 'portfolio' && <Pill bg="var(--snow-primary-blue)">Awaiting partner</Pill>}
            <NotificationBell actions={notes.actions} actionCount={notes.actionCount ?? notes.actions.length} updates={notes.updates} seenAt={seenAt} onSeen={markSeen} onGo={goToNotice} />
          </div>
        </header>

        {active && !['engagement', 'users', 'portfolio'].includes(tab) && <FundDashboard aiLabel={aiOn ? 'Enabled' : 'Off'} aiWhy={aiOn ? `AI assistance is enabled (${aiStatus?.model || 'Claude'}).` : !clientAllowsAi ? AI_REASON[fundAiState] : !aiStatus?.serverKey ? 'Off: no API key on the server.' : 'Off: AI is turned off under AI Settings.'} engagement={setup} entity={activeEntity} people={people} docsAttached={Object.keys(files).length} openPoints={openPoints.length} done={done}
          locked={phase === 'running'} onChange={() => { setDraft(null); setTab('engagement'); }} />}

        <div style={{ padding: '12px 28px 0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '10px 14px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--snow-status-approved)' }} />
            <span style={cap}>Review assistance only. This tool supports the reviewer's judgement; it does not establish that the financial statements are complete or correct.</span>
          </div>
        </div>

        {stale && canRun && !['engagement', 'users'].includes(tab) && (
          <div style={{ padding: '12px 28px 0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', background: 'var(--snow-primary-blue)', borderRadius: 8, padding: '10px 14px' }}>
              <span style={cap}>The engagement settings have changed since this analysis ran. The checks table already reflects them; review points come from the last analysis and are refreshed the next time a document changes.</span>
            </div>
          </div>
        )}

        {result?.aiSkipped?.length > 0 && ['analysis', 'var', 'sched', 'vers'].includes(tab) && (
          <div style={{ padding: '12px 28px 0' }}>
            <div role="status" style={{ ...cap, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '10px 14px' }}>
              This analysis ran without AI for: {result.aiSkipped.join(', ')}. The recalculation checks and variance arithmetic ran as normal.
            </div>
          </div>
        )}
        {tab === 'portfolio' && <PortfolioTab engagements={engagements || []} user={user}
          onOpen={(e, t) => { if (e.id !== activeId) activate(e.id); setDraft(null); setTab(t); }} />}
        {tab === 'engagement' && !draft && <EngagementList rulesOf={rulesOf} engagements={engagements} activeId={activeId} mode={store?.mode} loadError={loadError} notice={notice} locked={phase === 'running'} canWrite={canWrite && canEditEng} entities={entities} people={people} onAdd={entityId => openEngagement(null, entityId)} onOpen={e => openEngagement(e)} onActivate={activate}
          onAddEntity={() => setEntityModal({ entity: null })} onEditEntity={ent => setEntityModal({ entity: ent })} />}
        {entityModal && <EntityModal me={user} entity={entityModal.entity} entities={entities || []} onSave={saveEntity} onClose={() => setEntityModal(null)}
          fundCount={entityModal.entity ? (engagements || []).filter(x => x.entityId === entityModal.entity.id).length : 0} />}
        {tab === 'engagement' && draft && <EngagementForm setup={draft} onChange={setDraft} isNew={!draft.id} locked={phase === 'running'} saving={saving} error={saveError} template={draft ? baseFor(draft) : ruleTemplate} firmTemplate={ruleTemplate} signedOff={!!draft?.id && reviewStore.isLocked(draft.id)} canWrite={canWrite && canEditEng && !(draft?.id && reviewStore.isLocked(draft.id))} entityList={entities || []} entities={entities || []} people={people} onAddEntity={onCreated => setEntityModal({ entity: null, onCreated })} onSave={saveEngagement} onCancel={closeEngagement}
          onReset={() => setDraft(d => ({ ...DEFAULT_SETUP, rules: startRules(), fund: d.fund, id: d.id, createdAt: d.createdAt, savedAt: d.savedAt }))} />}
        {tab === 'docs' && active && <DocumentsTab aiForReading={aiFlags.extract} aiWhyNot={readBlock} onReadWithAi={readWithAi} umbrella={isUmbrella ? { name: umbName, entity: activeEntity?.name, sources: umbSources } : null} onCopyUmbrella={copyUmbrellaDocs} files={files} review={review} editable={editable} canConfirm={(canAttach || canRun) && !signed} signed={signed} canSendBack={canRun && !signed} onConfirm={confirmDoc} onMarkReady={markReady} onSendBack={sendBack} attach={attach} detach={detach} attachAll={attachAll} ready={ready} phase={phase} step={step} error={error} analysisSub={analysisSub} onAnalyse={() => analyse()} rerun={{ blocked: rerunBlocked, changes: docChanges, at: whenOf(lastRun?.analysedAt) }} blockedReason={blockedReason} canRun={canRun && !signed} canAttach={canAttach} role={user.role}
          onRejected={(d, file, why) => log('Documents', `Refused a file for ${d.name}: ${file.name}`, why)} />}
        {tab === 'analysis' && done && <AnalysisTab result={result} checks={checks} openPoints={openPoints} files={files} docSel={docSel} setDocSel={setDocSel} tray={tray} pick={pick} clearTray={() => setTray([])} addFromTray={addFromTray} sel={sel} setSel={setSel} goto={setTab} showFlags={CONFIG.showFlags} analysedAt={analysedAt} canRaise={canRaise}
          tbOn={ruleOn(setup, 'CHK-02')} tbMap={active?.tbMap || {}} tbTol={setup.rules?.['CHK-02']?.tol ?? 1} canMap={(canAttach || canRun) && !signed} onSaveMap={saveTbMap} />}
        {tab === 'var' && done && <VarianceTab aiNotes={Object.values(result.varNotes || {}).some(n => n?.aiDrafted)} canEditPoints={canRaise} enabled={varianceOn} mode={setup.varianceMode} goSetup={() => { setDraft(null); setTab('engagement'); }} model={vm} filter={varFilter} setFilter={setVarFilter} raised={raised} onRaise={raiseVariance} threshold={th} growth={growth} avgGrowth={avgGrowth} />}
        {tab === 'sched' && points.length > 0 && <ScheduleTab points={points} messages={review.messages} user={user} people={people} sel={sel} setSel={setSel} actions={pointActions} waitingForMe={waitingForMe}
          canRaise={canRaise} canRespond={canRespond} locked={signed} threshold={th} version={result?.version} />}
        {tab === 'disc' && done && clOn && <DisclosuresTab framework={clFramework} list={clList} state={clState} cy={result.docs?.cy} signed={signed} canAnswer={canRaise} onAnswer={answerDisclosure} />}
        {tab === 'signoff' && done && <SignoffTab reports={review.reports || []} reportActions={reportActions} review={review} summary={summary} partnerRequired={partnerReq} canPartner={canPartner} canSignoff={canSignoff} canResubmit={canResubmit} actions={signoffActions} />}
        {tab === 'activity' && active && <ActivityLogTab key={active.id} fund={{ id: active.id, name: active.fund.name }} />}
        {tab === 'vers' && done && <VersionsTab result={result} points={points} running={phase === 'running'} onNextDraft={analyse} onAttachNextDraft={attachNextDraft} nextDraftBlock="" canRun={canRun && !signed}
          onRejected={(d, file, why) => log('Documents', `Refused a file for ${d.name}: ${file.name}`, why)} />}
      </main>
    </div>
    </LibraryContext.Provider>
  );
}

// Sign-in gate: shows the login page until someone is signed in, then the workspace.
export default function App() {
  const [auth, setAuth] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [user, setUser] = useState(undefined); // undefined = checking
  const [startError, setStartError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setStartError('');
    connectAuth().then(async a => {
      setAuth(a);
      try { const m = await a.getPermissions().catch(() => null); if (m) setPermissions(m); } catch { /* keep defaults */ }
      try { const [st, me] = await Promise.all([a.status(), a.me()]); setSetupRequired(st.setupRequired); setUser(me); }
      catch { setUser(null); }
    }, e => setStartError(e.message));
  }, [attempt]);
  const signOut = async () => { try { await auth.logout(); } catch { /* signed out locally either way */ } setSetupRequired(false); setUser(null); };

  const activity = useMemo(() => (auth && user ? makeActivity() : null), [auth, user]);
  if (startError) return (
    <div role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', ...body }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <p>{startError}</p>
        <button type="button" className="btn" onClick={() => setAttempt(n => n + 1)}>Try Again</button>
      </div>
    </div>
  );
  if (!auth || user === undefined) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', ...body, ...muted }}>Loading…</div>;
  if (!user) return <LoginPage matrix={getPermissions()} auth={auth} setupRequired={setupRequired} onSignedIn={u => { setSetupRequired(false); setUser(u); }} />;
  return (
    <ActivityContext.Provider value={activity}>
      {isAdminArea(user) ? <AdminConsole key={user.id} user={user} auth={auth} onSignOut={signOut} />
        : isFinanceArea(user) ? <FinanceConsole key={user.id} user={user} auth={auth} onSignOut={signOut} />
        : <Workspace key={user.id} user={user} auth={auth} onSignOut={signOut} />}
    </ActivityContext.Provider>
  );
}
