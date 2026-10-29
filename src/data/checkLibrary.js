// The approved check library. Each rule says which engine runs it:
//   code      — deterministic recalculation in src/lib/review.js (impl lists the check ids)
//   variance  — the variance model in src/lib/review.js
//   narrative — covered by the Claude narrative review (judgement, not an exact-match test)
//   none      — in the library but not built in the app yet
export const LIBRARY = [
  { id: 'CHK-01', name: 'TB balances', desc: 'Total debits equal total credits.', version: 'v1.0', tol: 1, tolKind: 'abs', approvedBy: 'Accounting lead', status: 'active', engine: 'code', impl: ['tb'] },
  { id: 'CHK-02', name: 'TB to statements', desc: 'Mapped TB totals agree to each statement line, and every TB account with a balance is mapped.', version: 'v1.1', tol: 1, tolKind: 'abs', approvedBy: 'Accounting lead', status: 'active', engine: 'code', impl: ['tbmap', 'tbcover'] },
  { id: 'CHK-03', name: 'Casting', desc: 'Recalculated subtotals and totals equal stated.', version: 'v1.0', tol: 1, tolKind: 'abs', approvedBy: 'Accounting lead', status: 'active', engine: 'code', impl: ['bs', 'na', 'inc', 'castall'] },
  { id: 'CHK-04', name: 'Notes tie-out', desc: 'Each note total equals its statement line.', version: 'v1.0', tol: 1, tolKind: 'abs', approvedBy: 'Accounting lead', status: 'active', engine: 'code', impl: ['exp', 'notes'] },
  { id: 'CHK-05', name: 'Prior-year comparatives', desc: 'Comparatives equal the prior-year signed statements.', version: 'v1.0', tol: 1, tolKind: 'abs', approvedBy: 'Accounting lead', status: 'active', engine: 'code', impl: ['cmp'] },
  { id: 'CHK-06', name: 'Net asset movement', desc: 'Opening + subscriptions − redemptions + result − distributions = closing.', version: 'v1.0', tol: 1, tolKind: 'abs', approvedBy: 'Accounting lead', status: 'active', engine: 'code', impl: ['socna'] },
  { id: 'CHK-07', name: 'Investments', desc: 'Investment schedule total equals note and TB.', version: 'v1.0', tol: 1, tolKind: 'abs', approvedBy: 'Accounting lead', status: 'active', engine: 'code', impl: ['note4', 'tbinv'] },
  { id: 'CHK-08', name: 'Fair value hierarchy', desc: 'Level 1 + Level 2 + Level 3 = total investments.', version: 'v1.0', tol: 1, tolKind: 'abs', approvedBy: 'Accounting lead', status: 'active', engine: 'code', impl: ['hier'] },
  { id: 'CHK-10', name: 'Management fee recalculation', desc: 'Rate × average net assets × period = stated fee.', version: 'v1.0', tol: 1, tolKind: 'abs', approvedBy: 'Accounting lead', status: 'active', engine: 'code', impl: ['fee'] },
  { id: 'CHK-11', name: 'Year-on-year variances', desc: 'Movements at or above materiality are listed for explanation.', version: 'v1.0', tol: null, tolKind: 'threshold', approvedBy: 'Accounting lead', status: 'active', engine: 'variance' },
  { id: 'CHK-09', name: 'Income and expense notes', desc: 'Disaggregated revenue tie-out to fee schedule.', version: 'v0.9', tol: 1, tolKind: 'abs', approvedBy: 'Pending review', status: 'draft', engine: 'none', gap: 'Needs a fee schedule document slot and extraction.' },
  { id: 'CHK-12', name: 'Narrative rollover', desc: 'Approval and reporting-period dates in the narrative belong to this year. Director names and other carried-forward wording are covered by the narrative review (AI).', version: 'v1.0', tol: null, tolKind: 'exact', approvedBy: 'Accounting lead', status: 'active', engine: 'code', impl: ['dates'] },
  { id: 'CHK-13', name: 'Disclosure checklist', desc: 'The reviewer completes the disclosure checklist for the client’s framework; every item must be answered before sign-off, and each “No” is a review point.', version: 'v1.0', tol: null, tolKind: 'completeness', approvedBy: 'Accounting lead', status: 'active', engine: 'checklist', defaultOff: true },
  { id: 'CHK-14', name: 'Currency and presentation', desc: 'Every amount with a currency is in the presentation currency.', version: 'v1.0', tol: null, tolKind: 'exact', approvedBy: 'Accounting lead', status: 'active', engine: 'code', impl: ['ccy'] }
];

export const RULE_BY_ID = Object.fromEntries(LIBRARY.map(r => [r.id, r]));
export const RULE_FOR_IMPL = Object.fromEntries(LIBRARY.flatMap(r => (r.impl || []).map(i => [i, r.id])));

export const DEFAULT_SETUP = {
  fund: { name: 'Meridian Global Equity Fund ICAV', yearEnd: '2025-12-31', preparer: '', reviewer: 'A. Whitcombe', manager: '' }, // yearEnd is an ISO date
  threshold: 250000,
  highMultiple: 4,
  feeRatePct: null,        // null = use the prospectus rate extracted from supporting information
  feeMonths: 12,
  varianceMode: 'library', // 'library' = list every material movement · 'expectation' = material AND outside expectation
  investigatePct: 30,
  explainPct: 15,
  narrative: true,
  // Only active rules that the app can run are switched on by default.
  rules: Object.fromEntries(LIBRARY.map(r => [r.id, { on: r.status === 'active' && !r.defaultOff && (r.engine === 'code' || r.engine === 'variance'), tol: r.tol, tolKind: r.tolKind }]))
};

export const ruleOn = (setup, id) => !!setup?.rules?.[id]?.on;
export const ruleChanged = (setup, r) => {
  const s = setup.rules[r.id];
  return s && (s.tol !== r.tol || s.tolKind !== r.tolKind);
};

// A new engagement starts from the library defaults with the fund details blank.
export const NEW_ENGAGEMENT = { ...DEFAULT_SETUP, fund: { name: '', yearEnd: '', currency: 'GBP', preparer: '', reviewer: '', manager: '' } };

// Fills in any settings missing from an engagement saved by an earlier version.
export function withDefaults(e) {
  const fund = { ...NEW_ENGAGEMENT.fund, ...(e?.fund || {}) };
  if (fund.yearEnd && !/^\d{4}-\d{2}-\d{2}$/.test(fund.yearEnd)) fund.yearEnd = ''; // older saves held free text
  return { ...DEFAULT_SETUP, ...e, fund, rules: { ...DEFAULT_SETUP.rules, ...(e?.rules || {}) } };
}

// The settings that change what the analysis produces (fund names and save times do not).
export const settingsSignature = s => JSON.stringify({ ...s, fund: undefined, savedAt: undefined, createdAt: undefined, tbMap: undefined, tbMapBy: undefined, tbMapAt: undefined }); // the TB mapping re-checks live, no new analysis needed

// ---- Firm library: the built-in rules plus the Administrator's edits and new rules -------------
// Saved firm config: { rules: {id: {on, tol, tolKind}}, overrides: {id: {name, desc, version, status, tol, tolKind}}, custom: [rule] }
// A custom rule: { id, name, desc, version, status, tol, tolKind, engine: 'custom-tieout' | 'custom-narrative' | 'none',
//                  def: { terms: [{ sign: 1 | -1, key }], stated: key } | { instruction } }

// Figures the app extracts from the documents (see FIGURE_KEYS in the api's src/application/ai/prompts.ts), usable in tie-out rules.
export const FIGURES = [
  { key: 'ca', label: 'Asset lines (statement of financial position)', list: true },
  { key: 'statedTA', label: 'Total assets, as stated' },
  { key: 'cl', label: 'Liability lines (statement of financial position)', list: true },
  { key: 'statedNA', label: 'Net assets, as stated' },
  { key: 'pyNA', label: 'Net assets at the beginning of the year' },
  { key: 'subs', label: 'Subscriptions' },
  { key: 'reds', label: 'Redemptions' },
  { key: 'ops', label: 'Increase in net assets from operations' },
  { key: 'income', label: 'Investment income lines', list: true },
  { key: 'statedIncome', label: 'Total investment income, as stated' },
  { key: 'exp', label: 'Expense note lines', list: true },
  { key: 'sciExp', label: 'Operating expenses per income statement' },
  { key: 'statedNote4', label: 'Investment note total (Note 4)' },
  { key: 'hier', label: 'Fair value hierarchy levels', list: true },
  { key: 'sched', label: 'Investment schedule lines (custodian)', list: true },
  { key: 'mgmtCharged', label: 'Management fees charged' },
  { key: 'tbDr', label: 'Trial balance total debits' },
  { key: 'tbCr', label: 'Trial balance total credits' }
];
export const FIGURE_BY_KEY = Object.fromEntries(FIGURES.map(f => [f.key, f]));
export const figureLabel = k => FIGURE_BY_KEY[k] ? (FIGURE_BY_KEY[k].list ? 'Sum of ' + FIGURE_BY_KEY[k].label.charAt(0).toLowerCase() + FIGURE_BY_KEY[k].label.slice(1) : FIGURE_BY_KEY[k].label) : k;
export const formulaText = def => def?.terms?.length
  ? def.terms.map((t, i) => `${i ? (t.sign < 0 ? ' − ' : ' + ') : t.sign < 0 ? '− ' : ''}${figureLabel(t.key)}`).join('') + ' against ' + figureLabel(def.stated)
  : '';

export function buildLibrary(config) {
  const ov = config?.overrides || {};
  const builtIn = LIBRARY.map(r => ({ ...r, ...(ov[r.id] || {}), builtIn: true }));
  const custom = (config?.custom || []).map(r => ({ approvedBy: '', ...r, builtIn: false }));
  return [...builtIn, ...custom];
}
export const defaultRulesFor = library => Object.fromEntries(library.map(r => [r.id,
  { on: r.status === 'active' && !r.defaultOff && ['code', 'variance', 'custom-tieout', 'custom-narrative', 'checklist'].includes(r.engine), tol: r.tol, tolKind: r.tolKind }]));
export const runnable = r => ['code', 'variance', 'custom-tieout', 'custom-narrative', 'checklist'].includes(r.engine);
export const nextRuleId = library => 'CHK-' + String(Math.max(0, ...library.map(r => +(/^CHK-(\d+)$/.exec(r.id)?.[1] || 0))) + 1).padStart(2, '0');
