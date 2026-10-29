// Billing: the same rules as the api's shared/src/billing.ts, which applies every change. The screens here use
// the read-only helpers (totals, invoice status, recovery, unbilled usage).
// State: { settings, events: { [engagementId]: signOffEvent }, invoices: [invoice], seq, creditSeq }
// Every change goes through applyBilling(state, action, ctx), which validates it and returns the new
// state plus a short description for the activity log. Amounts are in pence (integers) to avoid
// rounding drift; screens divide by 100.

export const DEFAULT_BILLING = {
  firmName: '', firmAddress: '', vatNumber: '',
  currency: 'GBP', invoicePrefix: 'INV-', paymentTermsDays: 30, vatRate: 20,
  defaultFee: 0,            // pence; the professional fee suggested on a new invoice
  usdToGbp: null,           // AI prices are in US dollars; Finance sets the conversion rate
  aiMarkupPct: 0,           // recharge AI cost at cost plus this percentage
  rates: {},                // { modelId: { in: USD per million input tokens, out: USD per million output tokens } }
  fxDate: null, fxSource: '', // when and where the USD to GBP rate came from (manual or the daily rates service)
  lockDate: null,           // ISO date: nothing can be issued, paid, credited or written off on or before it
  emailSubject: 'Invoice {number} from {firm}', emailMessage: 'Please find attached invoice {number} for {fund}, due on {due}.',
  xero: { accountCode: '200', taxType: 'OUTPUT2' } // Xero sales account and tax rate for invoice lines
};
export const EMPTY_BILLING = { settings: DEFAULT_BILLING, events: {}, invoices: [], seq: 0, creditSeq: 0 };

const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'b-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const day = iso => iso.slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso); d.setUTCDate(d.getUTCDate() + Number(n || 0)); return d.toISOString(); };
const bad = msg => { throw new Error(msg); };
export const money = p => '£' + ((p || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---- AI usage and its cost ----------------------------------------------------------------
// usage: [{ id, at, engagementId, model, input, output, step }] (from the AI calls the server logged)
export function rateFor(settings, model) {
  const key = Object.keys(settings.rates || {}).find(k => model === k || String(model || '').startsWith(k));
  const r = key ? settings.rates[key] : null;
  return r && (Number(r.in) > 0 || Number(r.out) > 0) ? r : null;
}
// Cost of one call in pence, or null when its model has no rate or no exchange rate is set.
export function usageCost(settings, u) {
  const r = rateFor(settings, u.model);
  if (!r || !(Number(settings.usdToGbp) > 0)) return null;
  const usd = (u.input / 1e6) * Number(r.in) + (u.output / 1e6) * Number(r.out);
  return Math.round(usd * Number(settings.usdToGbp) * 100);
}
// Usage for a fund that is not on an issued invoice, nor already on another draft.
export function unbilledUsage(state, usage, engagementId, exceptInvoiceId = null) {
  const taken = new Set(state.invoices.filter(i => i.id !== exceptInvoiceId && ['draft', 'issued'].includes(i.status)).flatMap(i => i.usageIds || []));
  return usage.filter(u => u.engagementId === engagementId && !taken.has(u.id));
}
export function aiSummary(settings, list) {
  const priced = list.map(u => usageCost(settings, u));
  const missing = priced.some(c => c === null);
  const cost = priced.reduce((a, c) => a + (c || 0), 0);
  const charge = Math.round(cost * (1 + Number(settings.aiMarkupPct || 0) / 100));
  return { calls: list.length, input: list.reduce((a, u) => a + u.input, 0), output: list.reduce((a, u) => a + u.output, 0), cost, charge, missing,
    models: [...new Set(list.map(u => u.model))] };
}
const aiLine = (settings, list) => {
  const s = aiSummary(settings, list);
  return { id: uid(), kind: 'ai', description: `AI-assisted review: ${s.calls} AI call${s.calls === 1 ? '' : 's'} (${s.input.toLocaleString('en-GB')} input and ${s.output.toLocaleString('en-GB')} output tokens)`,
    amount: s.missing ? 0 : s.charge, costAtCost: s.cost, markupPct: Number(settings.aiMarkupPct || 0), unpriced: s.missing, usageCount: s.calls, adjustReason: '' };
};

// ---- totals and status -------------------------------------------------------------------
export function totals(inv) {
  const net = inv.lines.reduce((a, l) => a + Math.round(Number(l.amount) || 0), 0);
  const vat = Math.round(net * Number(inv.vatRate || 0) / 100);
  const gross = net + vat;
  const paid = (inv.payments || []).reduce((a, p) => a + p.amount, 0);
  const writtenOff = (inv.writeOffs || []).reduce((a, w) => a + w.amount, 0);
  const credited = (inv.creditNotes || []).reduce((a, c) => a + c.amount, 0);
  return { net, vat, gross, paid, writtenOff, credited, outstanding: inv.status === 'issued' ? Math.max(0, gross - paid - writtenOff - credited) : 0 };
}
export function invoiceStatus(inv, today = new Date().toISOString()) {
  if (inv.status === 'draft') return 'Draft';
  if (inv.status === 'cancelled') return 'Cancelled';
  const t = totals(inv);
  if (t.outstanding === 0) return t.credited >= t.gross ? 'Credited' : t.writtenOff > 0 && t.paid < t.gross ? (t.paid ? 'Paid (part written off)' : 'Written off') : t.paid ? 'Paid' : t.credited ? 'Credited' : 'Paid';
  if (day(inv.dueDate) < day(today)) return t.paid || t.credited ? 'Overdue (part settled)' : 'Overdue';
  return t.credited ? 'Part credited' : t.paid ? 'Part paid' : 'Issued';
}
export const daysOverdue = (inv, today = new Date().toISOString()) =>
  inv.status === 'issued' && totals(inv).outstanding > 0 ? Math.max(0, Math.floor((new Date(day(today)) - new Date(day(inv.dueDate))) / 864e5)) : 0;

// ---- the actions ---------------------------------------------------------------------------
// ctx: { user: {id, name, role}, usage: [...], now: ISO }
export function applyBilling(state, action, ctx) {
  const s = { ...EMPTY_BILLING, ...state, settings: { ...DEFAULT_BILLING, ...(state?.settings || {}) } };
  const now = ctx.now || new Date().toISOString(), by = ctx.user ? { id: ctx.user.id, name: ctx.user.name } : null;
  const find = id => s.invoices.find(i => i.id === id) || bad('That invoice no longer exists.');
  const replace = inv => s.invoices.map(i => (i.id === inv.id ? inv : i));
  const a = action || {};
  // Period lock: nothing dated on or before the lock date can be created or changed.
  const lockedOn = iso => s.settings.lockDate && day(iso) <= s.settings.lockDate;
  const guard = (iso, what) => { if (lockedOn(iso)) bad(`The period up to ${s.settings.lockDate} is locked, so ${what} can’t be dated ${day(iso)}.`); };
  switch (a.type) {
    case 'settings': {
      const x = a.settings || {};
      const settings = { ...s.settings, ...x,
        paymentTermsDays: Math.max(0, Math.round(Number(x.paymentTermsDays ?? s.settings.paymentTermsDays))),
        vatRate: Math.max(0, Number(x.vatRate ?? s.settings.vatRate)), aiMarkupPct: Number(x.aiMarkupPct ?? s.settings.aiMarkupPct),
        defaultFee: Math.max(0, Math.round(Number(x.defaultFee ?? s.settings.defaultFee))),
        usdToGbp: x.usdToGbp === '' || x.usdToGbp == null ? null : Number(x.usdToGbp) };
      if (settings.usdToGbp !== null && !(settings.usdToGbp > 0)) bad('The USD to GBP rate must be more than zero.');
      return { state: { ...s, settings }, log: 'Changed the billing settings' };
    }
    case 'signoff': case 'unlock': {
      const e = a.event || bad('No sign-off details were received.');
      const prev = s.events[e.engagementId] || { history: [] };
      const ev = { ...prev, ...e, state: a.type === 'signoff' ? 'signed' : 'unlocked', at: now, history: [...(prev.history || []), { state: a.type, by, at: now }] };
      return { state: { ...s, events: { ...s.events, [e.engagementId]: ev } }, log: a.type === 'signoff' ? `Signed off ${e.fundName}: ready to invoice` : `${e.fundName} was unlocked after sign-off`, engagement: e };
    }
    case 'createDraft': {
      const ev = s.events[a.engagementId] || bad('That fund has not been signed off.');
      if (ev.state !== 'signed') bad('That fund was unlocked after sign-off. It can be invoiced once it is signed off again.');
      if (s.invoices.some(i => i.engagementId === a.engagementId && i.status === 'draft')) bad('There is already a draft invoice for this fund.');
      const usage = unbilledUsage(s, ctx.usage || [], a.engagementId);
      const supplementary = s.invoices.some(i => i.engagementId === a.engagementId && i.status === 'issued');
      const lines = [];
      if (!supplementary) lines.push({ id: uid(), kind: 'fee', description: `Financial statement review: ${ev.fundName}, year ended ${ev.yearEndLabel || ev.yearEnd || ''}`.trim(), amount: s.settings.defaultFee, adjustReason: '' });
      if (usage.length || !supplementary) lines.push(aiLine(s.settings, usage));
      const inv = { id: uid(), status: 'draft', kind: supplementary ? 'supplementary' : 'standard', engagementId: ev.engagementId, fundName: ev.fundName, entityName: ev.entityName,
        clientName: ev.clientName || ev.entityName, email: ev.billingEmail || '', yearEnd: ev.yearEnd, signedBy: ev.signedBy, signedAt: ev.signedAt, lines, usageIds: usage.map(u => u.id),
        vatRate: s.settings.vatRate, termsDays: s.settings.paymentTermsDays, notes: '', createdBy: by, createdAt: now, payments: [], writeOffs: [], history: [{ what: 'Draft created', by, at: now }] };
      return { state: { ...s, invoices: [...s.invoices, inv] }, log: `Created a ${supplementary ? 'supplementary ' : ''}draft invoice for ${ev.fundName}`, engagement: ev, invoice: inv };
    }
    case 'updateDraft': {
      const inv = find(a.id); if (inv.status !== 'draft') bad('Only a draft invoice can be changed.');
      const lines = (a.lines || inv.lines).map(l => ({ ...l, amount: Math.round(Number(l.amount) || 0), description: String(l.description || '').trim() }));
      if (lines.some(l => !l.description)) bad('Every line needs a description.');
      if (lines.some(l => l.amount < 0)) bad('Line amounts can’t be negative. Reduce a line instead and give the reason.');
      const ai = lines.find(l => l.kind === 'ai'), wasAi = inv.lines.find(l => l.kind === 'ai');
      if (ai && wasAi && ai.amount !== wasAi.amount && ai.amount < (wasAi.calcAmount ?? wasAi.amount) && !String(ai.adjustReason || '').trim()) bad('Give a reason for reducing the AI usage charge.');
      const upd = { ...inv, lines, vatRate: Number(a.vatRate ?? inv.vatRate), termsDays: Math.round(Number(a.termsDays ?? inv.termsDays)), notes: a.notes ?? inv.notes,
        history: [...inv.history, { what: 'Draft updated', by, at: now }] };
      return { state: { ...s, invoices: replace(upd) }, log: `Updated the draft invoice for ${inv.fundName}`, invoice: upd };
    }
    case 'refreshAi': {
      const inv = find(a.id); if (inv.status !== 'draft') bad('Only a draft invoice can be refreshed.');
      const usage = unbilledUsage(s, ctx.usage || [], inv.engagementId, inv.id), line = aiLine(s.settings, usage);
      const others = inv.lines.filter(l => l.kind !== 'ai');
      const upd = { ...inv, lines: [...others, { ...line, calcAmount: line.amount }], usageIds: usage.map(u => u.id), history: [...inv.history, { what: 'AI usage recalculated', by, at: now }] };
      return { state: { ...s, invoices: replace(upd) }, log: `Recalculated AI usage on the draft invoice for ${inv.fundName}`, invoice: upd };
    }
    case 'issue': {
      const inv = find(a.id); if (inv.status !== 'draft') bad('This invoice has already been issued.');
      const ai = inv.lines.find(l => l.kind === 'ai');
      if (ai?.unpriced && ai.usageCount) bad('Set the AI prices and the USD to GBP rate under Billing Settings, then recalculate the AI usage.');
      if (totals(inv).gross <= 0) bad('An invoice must be for more than £0.00.');
      guard(now, 'an invoice');
      const seq = s.seq + 1, number = `${s.settings.invoicePrefix}${new Date(now).getUTCFullYear()}-${String(seq).padStart(4, '0')}`;
      const upd = { ...inv, status: 'issued', number, issuedAt: now, issuedBy: by, dueDate: addDays(now, inv.termsDays), settingsAtIssue: { firmName: s.settings.firmName, firmAddress: s.settings.firmAddress, vatNumber: s.settings.vatNumber },
        history: [...inv.history, { what: `Issued as ${number}`, by, at: now }] };
      return { state: { ...s, seq, invoices: replace(upd) }, log: `Issued invoice ${number} for ${inv.fundName}`, details: money(totals(upd).gross), invoice: upd };
    }
    case 'payment': {
      const inv = find(a.id); if (inv.status !== 'issued') bad('Payments can only be recorded against an issued invoice.');
      const amount = Math.round(Number(a.amount) || 0), t = totals(inv);
      if (amount <= 0) bad('Enter the amount received.'); if (amount > t.outstanding) bad(`That is more than the ${money(t.outstanding)} outstanding.`);
      guard(a.date || now, 'a payment');
      const upd = { ...inv, payments: [...inv.payments, { id: uid(), amount, date: a.date || day(now), reference: String(a.reference || '').trim(), by, at: now }],
        history: [...inv.history, { what: `Payment of ${money(amount)} recorded`, by, at: now }] };
      return { state: { ...s, invoices: replace(upd) }, log: `Recorded a payment of ${money(amount)} on ${inv.number}`, details: a.reference || '', invoice: upd };
    }
    case 'writeOff': {
      const inv = find(a.id); if (inv.status !== 'issued') bad('Only an issued invoice can be written off.');
      const amount = Math.round(Number(a.amount) || 0), t = totals(inv);
      if (amount <= 0 || amount > t.outstanding) bad(`Write off between £0.01 and ${money(t.outstanding)}.`);
      if (String(a.reason || '').trim().length < 5) bad('Give the reason for the write-off.');
      guard(now, 'a write-off');
      const upd = { ...inv, writeOffs: [...inv.writeOffs, { id: uid(), amount, reason: a.reason.trim(), by, at: now }], history: [...inv.history, { what: `${money(amount)} written off`, by, at: now }] };
      return { state: { ...s, invoices: replace(upd) }, log: `Wrote off ${money(amount)} on ${inv.number}`, details: a.reason, invoice: upd };
    }
    case 'cancel': {
      const inv = find(a.id);
      if (String(a.reason || '').trim().length < 5) bad('Give the reason for cancelling.');
      if (inv.status === 'draft') return { state: { ...s, invoices: s.invoices.filter(i => i.id !== inv.id) }, log: `Discarded the draft invoice for ${inv.fundName}`, details: a.reason };
      if (inv.status !== 'issued') bad('This invoice is already cancelled.');
      if ((inv.payments || []).length) bad('A paid or part-paid invoice can’t be cancelled. Write off the balance instead.');
      if (lockedOn(inv.issuedAt)) bad(`This invoice was issued in a locked period (up to ${s.settings.lockDate}). Issue a credit note instead.`);
      guard(now, 'a cancellation');
      const creditSeq = s.creditSeq + 1, credit = `CN-${new Date(now).getUTCFullYear()}-${String(creditSeq).padStart(4, '0')}`;
      const upd = { ...inv, status: 'cancelled', creditNote: credit, cancelReason: a.reason.trim(), cancelledAt: now, cancelledBy: by, history: [...inv.history, { what: `Cancelled by credit note ${credit}`, by, at: now }] };
      return { state: { ...s, creditSeq, invoices: replace(upd) }, log: `Cancelled ${inv.number} with credit note ${credit}`, details: `${a.reason} · its AI usage can be billed again`, invoice: upd };
    }
    case 'creditNote': {   // a partial (or full) credit against an issued invoice, with its own number
      const inv = find(a.id); if (inv.status !== 'issued') bad('A credit note can only be raised against an issued invoice.');
      const amount = Math.round(Number(a.amount) || 0), t = totals(inv);
      if (amount <= 0 || amount > t.outstanding) bad(`Credit between £0.01 and ${money(t.outstanding)}.`);
      if (String(a.reason || '').trim().length < 5) bad('Give the reason for the credit note.');
      guard(now, 'a credit note');
      const creditSeq = s.creditSeq + 1, number = `CN-${new Date(now).getUTCFullYear()}-${String(creditSeq).padStart(4, '0')}`;
      const vat = Math.round(amount * Number(inv.vatRate || 0) / (100 + Number(inv.vatRate || 0)));
      const cn = { id: uid(), number, amount, net: amount - vat, vat, reason: a.reason.trim(), by, at: now };
      const upd = { ...inv, creditNotes: [...(inv.creditNotes || []), cn], history: [...inv.history, { what: `Credit note ${number} for ${money(amount)}`, by, at: now }] };
      return { state: { ...s, creditSeq, invoices: replace(upd) }, log: `Raised credit note ${number} for ${money(amount)} against ${inv.number}`, details: a.reason, invoice: upd };
    }
    case 'setLock': {
      const d = a.lockDate || null;
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) bad('Enter the lock date as a date.');
      if (d && d > day(now)) bad('The lock date can’t be in the future.');
      if (String(a.reason || '').trim().length < 5) bad('Give the reason for changing the lock date.');
      return { state: { ...s, settings: { ...s.settings, lockDate: d } }, log: d ? `Locked billing up to ${d}` : 'Removed the billing lock date', details: a.reason };
    }
    case 'fxUpdate': {
      if (!(Number(a.rate) > 0)) bad('The exchange rate must be more than zero.');
      return { state: { ...s, settings: { ...s.settings, usdToGbp: Number(a.rate), fxDate: a.date || day(now), fxSource: a.source || 'manual' } }, log: `Updated the USD to GBP rate to ${a.rate}`, details: `${a.source || 'manual'} · ${a.date || day(now)}` };
    }
    case 'emailed': {
      const inv = find(a.id);
      const upd = { ...inv, emails: [...(inv.emails || []), { to: a.to, at: now, by }], history: [...inv.history, { what: `Emailed to ${a.to}`, by, at: now }] };
      return { state: { ...s, invoices: replace(upd) }, log: `Emailed ${inv.number} to ${a.to}`, invoice: upd };
    }
    case 'xeroSynced': {
      const inv = find(a.id);
      const upd = { ...inv, xero: { invoiceId: a.xeroInvoiceId, status: a.status || 'AUTHORISED', at: now }, history: [...inv.history, { what: `Sent to Xero (${a.status || 'AUTHORISED'})`, by, at: now }] };
      return { state: { ...s, invoices: replace(upd) }, log: `Sent ${inv.number} to Xero`, invoice: upd };
    }
    default: return bad('Unknown billing action.');
  }
}

// ---- recovery ------------------------------------------------------------------------------
export function recovery(state, usage, today = new Date().toISOString()) {
  const issued = state.invoices.filter(i => i.status === 'issued');
  const t = issued.map(i => ({ inv: i, ...totals(i), overdue: daysOverdue(i, today) }));
  const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
  const aiLines = issued.flatMap(i => i.lines.filter(l => l.kind === 'ai'));
  const billedUsageIds = new Set(issued.flatMap(i => i.usageIds || []));
  const unbilled = usage.filter(u => u.engagementId && !billedUsageIds.has(u.id));
  const unbilledCost = unbilled.reduce((a, u) => a + (usageCost(state.settings, u) || 0), 0);
  const aging = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 };
  t.forEach(x => { if (!x.outstanding) return; const d = x.overdue; aging[d === 0 ? 'current' : d <= 30 ? 'd30' : d <= 60 ? 'd60' : d <= 90 ? 'd90' : 'd90p'] += x.outstanding; });
  const clients = {};
  t.forEach(x => { const c = clients[x.inv.clientName] ||= { client: x.inv.clientName, invoices: 0, billed: 0, collected: 0, writtenOff: 0, credited: 0, outstanding: 0, overdue: 0, aiCost: 0, aiBilled: 0 };
    c.invoices++; c.billed += x.gross; c.collected += x.paid; c.writtenOff += x.writtenOff; c.credited += x.credited; c.outstanding += x.outstanding; if (x.overdue) c.overdue += x.outstanding;
    x.inv.lines.filter(l => l.kind === 'ai').forEach(l => { c.aiCost += l.costAtCost || 0; c.aiBilled += l.amount || 0; }); });
  const aiCost = aiLines.reduce((a, l) => a + (l.costAtCost || 0), 0), aiBilled = aiLines.reduce((a, l) => a + (l.amount || 0), 0);
  return {
    billed: sum(t, 'gross'), collected: sum(t, 'paid'), writtenOff: sum(t, 'writtenOff'), credited: sum(t, 'credited'), outstanding: sum(t, 'outstanding'),
    overdue: t.filter(x => x.overdue && x.outstanding).reduce((a, x) => a + x.outstanding, 0),
    cashRecovery: sum(t, 'gross') - sum(t, 'credited') ? sum(t, 'paid') / (sum(t, 'gross') - sum(t, 'credited')) : null,
    aiCost, aiBilled, aiRecovery: aiCost ? aiBilled / aiCost : null, unbilledCalls: unbilled.length, unbilledCost,
    aging, clients: Object.values(clients).sort((a, b) => b.outstanding - a.outstanding)
  };
}
