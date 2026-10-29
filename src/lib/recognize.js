import { sym } from './format';
// Document recognition by fixed rules: no AI, no network. Given a document's text, works out which
// of the five documents it is, which period it covers and which fund it mentions, and compares that
// with the slot it was attached to and the engagement in review. Pure functions, so the same rules
// can run on the server later.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const iso = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null);
export const norm = s => String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'%£$€.\-/ \n]/g, ' ').replace(/[ \t]+/g, ' ');
const has = (t, words) => words.filter(w => t.includes(w)).length;
const fmtDay = isoDate => { const [y, m, d] = isoDate.split('-').map(Number); return `${d} ${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`; };
export const minusYear = isoDate => { const [y, m, d] = isoDate.split('-').map(Number); return iso(y - 1, m, m === 2 && d === 29 ? 28 : d); };

// The reporting date: the date that most often follows "year ended", "period ended" or "as at".
export function findPeriod(text) {
  const t = norm(text), counts = new Map();
  const month = `(${MONTHS.join('|')})`;
  const patterns = [
    [new RegExp(`(\\d{1,2})(?:st|nd|rd|th)? ${month},? (\\d{4})`, 'g'), m => iso(+m[3], MONTHS.indexOf(m[2]) + 1, +m[1])],
    [new RegExp(`${month} (\\d{1,2})(?:st|nd|rd|th)?,? (\\d{4})`, 'g'), m => iso(+m[3], MONTHS.indexOf(m[1]) + 1, +m[2])],
    [/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g, m => iso(+m[3], +m[2], +m[1])],
    [/\b(\d{4})-(\d{2})-(\d{2})\b/g, m => iso(+m[1], +m[2], +m[3])]
  ];
  for (const [re, toIso] of patterns) for (const m of t.matchAll(re)) {
    const before = t.slice(Math.max(0, m.index - 45), m.index);
    if (!/(year ended|period ended|year to|as at|as of|at)\s*$/.test(before.trim() + ' ') && !/(year ended|period ended|as at|as of)/.test(before)) continue;
    const d = toIso(m); if (d) counts.set(d, (counts.get(d) || 0) + 1);
  }
  let best = null, n = 0;
  for (const [d, c] of counts) if (c > n) { best = d; n = c; }
  return best;
}

// Scores for each document type a file of this format could be.
export function scoreDocument({ text, sheets }, format, expectedCy) {
  const t = norm(text);
  if (format === 'pdf') {
    const st = has(t, ['statement of financial position', 'statement of comprehensive income', 'statement of changes in net assets', 'notes to the financial statements', 'balance sheet', 'income statement', 'statement of net assets']);
    const draft = (/\bdraft\b/.test(t) ? 2 : 0) + has(t, ['subject to audit', 'not yet been approved', 'not for distribution']);
    const signed = has(t, ["independent auditor", "auditor's report", 'true and fair view', 'statutory audit firm']) + (/approved by the board( of directors)? on \d/.test(t) ? 1 : 0);
    const support = has(t, ['minutes of', 'board meeting', 'present:', 'in attendance', 'prospectus', 'supplement', 'investment manager commentary', 'company secretary']);
    const fs = st >= 2, period = findPeriod(text);
    const s = {
      cy: fs ? 4 + (draft ? 2 : 0) - (signed >= 2 && !draft ? 3 : 0) : 0,
      py: fs ? 4 + (signed >= 2 ? 2 : 0) - (draft ? 2 : 0) : 0,
      sup: Math.max(0, support * 1.5 - st * 2) + (st === 0 && support >= 2 ? 3 : 0)
    };
    if (fs && period && expectedCy) { if (period === expectedCy) s.cy += 3; else if (period === minusYear(expectedCy)) s.py += 3; }
    return { scores: s, period, signals: { statements: st, draft, signed, support } };
  }
  const header = (sheets || []).flatMap(sh => sh.rows.slice(0, 15)).map(r => r.map(c => norm(c)).join(' | '));
  const anyRow = re => header.some(h => re.test(h));
  const s = {
    tb: (t.includes('trial balance') ? 3 : 0) + (anyRow(/\bdebit\b/) && anyRow(/\bcredit\b/) ? 4 : 0) + (anyRow(/\baccount\b/) ? 1 : 0),
    is: (/(custodian|valuation report|portfolio valuation|schedule of investments)/.test(t) ? 2 : 0) + (anyRow(/market value/) ? 3 : 0)
      + (anyRow(/(quantity|nominal|holding)/) ? 1 : 0) + (anyRow(/(security|isin|issuer)/) ? 1 : 0) + (anyRow(/\bprice\b/) ? 1 : 0)
  };
  return { scores: s, period: findPeriod(text), signals: {} };
}

// Debits against credits, from the first sheet with Debit and Credit columns.
export function trialBalanceTotals(sheets) {
  for (const sh of sheets || []) {
    const hi = sh.rows.findIndex(r => r.some(c => /^debit/i.test(String(c ?? '').trim())) && r.some(c => /^credit/i.test(String(c ?? '').trim())));
    if (hi < 0) continue;
    const dc = sh.rows[hi].findIndex(c => /^debit/i.test(String(c ?? '').trim())), cc = sh.rows[hi].findIndex(c => /^credit/i.test(String(c ?? '').trim()));
    let dr = 0, cr = 0, stated = null;
    for (const r of sh.rows.slice(hi + 1)) {
      const label = r.filter(c => typeof c === 'string').join(' ').toLowerCase();
      const d = typeof r[dc] === 'number' ? r[dc] : 0, c = typeof r[cc] === 'number' ? r[cc] : 0;
      if (/\btotal/.test(label)) { if (d || c) stated = { dr: d, cr: c }; break; }
      dr += d; cr += c;
    }
    if (!dr && !cr) return null;
    return { dr: Math.round(dr), cr: Math.round(cr), stated };
  }
  return null;
}

const SLOT_NAMES = { cy: 'Current Year Draft Financial Statements', py: 'Prior Year Signed Financial Statements', tb: 'Trial Balance', is: 'Investment Schedule', sup: 'Supporting Information' };
export const slotName = id => SLOT_NAMES[id] || id;
const money = n => sym() + Math.round(n).toLocaleString('en-GB');

/**
 * Validates one document against its slot and engagement.
 * content: { text, sheets?, pageCount? }  format: 'pdf' | 'xlsx'
 * ctx: { slot, fundName, entityName, yearEnd (ISO), otherFundNames: [], duplicateOf: slot id | null }
 * Returns { status: 'recognised' | 'check' | 'mismatch', recognisedAs, confidence, period, checks: [{ result: 'ok'|'warn'|'fail', label, detail }], summary }
 */
export function validateDocument(content, format, ctx) {
  const checks = [], add = (result, label, detail) => checks.push({ result, label, detail });
  const t = norm(content.text);
  const scanned = format === 'pdf' && t.replace(/\s/g, '').length < 120;

  if (ctx.duplicateOf) add('fail', 'Duplicate', `This is the same file as the ${slotName(ctx.duplicateOf)}.`);

  // 1. What document is it?
  const { scores, period } = scoreDocument(content, format, ctx.yearEnd);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestId, best] = ranked[0], second = ranked[1]?.[1] ?? 0;
  const recognisedAs = scanned || best < 3 ? null : bestId;
  const confidence = !recognisedAs ? 'unsure' : best - second >= 4 ? 'strong' : best - second >= 2 ? 'likely' : 'unsure';
  if (scanned) add('warn', 'Document type', 'No readable text was found (it may be a scanned image), so the document could not be checked.');
  else if (!recognisedAs) add('warn', 'Document type', `Couldn’t tell what this document is. Confirm it is the ${slotName(ctx.slot)}.`);
  else if (recognisedAs !== ctx.slot && confidence !== 'unsure') add('fail', 'Document type', `This looks like the ${slotName(recognisedAs)}, not the ${slotName(ctx.slot)}.`);
  else if (recognisedAs !== ctx.slot) add('warn', 'Document type', `This may be the ${slotName(recognisedAs)} rather than the ${slotName(ctx.slot)}.`);
  else add(confidence === 'unsure' ? 'warn' : 'ok', 'Document type', `Looks like the ${slotName(ctx.slot)}${confidence === 'strong' ? '' : ' (probable match)'}.`);

  // 2. Which fund? The fund or its entity counts, so umbrella accounts are accepted.
  if (!scanned) {
    const n = s => norm(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const flat = ' ' + n(content.text) + ' ';
    const mentions = name => name && n(name).length >= 3 && flat.includes(' ' + n(name) + ' ');
    const others = (ctx.otherFundNames || []).filter(o => mentions(o) && !n(ctx.fundName).includes(n(o)) && !n(o).includes(n(ctx.fundName)));
    if (mentions(ctx.fundName)) add('ok', 'Fund', `Mentions ${ctx.fundName}.`);
    else if (mentions(ctx.entityName)) add('ok', 'Fund', `Mentions ${ctx.entityName}, the fund’s entity.`);
    else if (others.length) add('fail', 'Fund', `Mentions ${others[0]}, not ${ctx.fundName}.`);
    else add('warn', 'Fund', `Doesn’t mention ${ctx.fundName}${ctx.entityName ? ` or ${ctx.entityName}` : ''}.`);
  }

  // 3. Which period? Supporting information is not tied to one date.
  if (!scanned && ctx.slot !== 'sup' && ctx.yearEnd) {
    const expected = ctx.slot === 'py' ? minusYear(ctx.yearEnd) : ctx.yearEnd;
    if (!period) add('warn', 'Reporting date', `Couldn’t find the reporting date. Expected ${fmtDay(expected)}.`);
    else if (period === expected) add('ok', 'Reporting date', `${fmtDay(period)}, as expected.`);
    else add('fail', 'Reporting date', `Dated ${fmtDay(period)}; expected ${fmtDay(expected)}.`);
  }

  // 4. Trial balance arithmetic.
  if (ctx.slot === 'tb' && format === 'xlsx') {
    const tb = trialBalanceTotals(content.sheets);
    if (!tb) add('warn', 'Debits and credits', 'Couldn’t find Debit and Credit columns to add up.');
    else if (tb.dr === tb.cr) add('ok', 'Debits and credits', `Debits equal credits (${money(tb.dr)}).`);
    else add('warn', 'Debits and credits', `Debits ${money(tb.dr)} and credits ${money(tb.cr)} differ by ${money(Math.abs(tb.dr - tb.cr))}.`);
  }

  const status = checks.some(c => c.result === 'fail') ? 'mismatch' : checks.some(c => c.result === 'warn') ? 'check' : 'recognised';
  const summary = status === 'recognised' ? `Recognised as the ${slotName(ctx.slot)}${period ? ` · ${fmtDay(period)}` : ''}`
    : status === 'mismatch' ? checks.find(c => c.result === 'fail').detail : 'Needs a check: ' + checks.filter(c => c.result === 'warn').map(c => c.label.toLowerCase()).join(', ');
  return { status, recognisedAs, confidence, period, checks, summary };
}
