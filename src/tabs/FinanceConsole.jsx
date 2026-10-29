import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import NotificationBell from '../components/NotificationBell';
import { Button, Card, CardHead, Pill, cap, body, h2, h3, muted, page, RING } from '../components/ui';
import { totals, invoiceStatus, daysOverdue, recovery, unbilledUsage, aiSummary, money, DEFAULT_BILLING } from '../lib/billing';
import { MODELS } from '../lib/aiOptions';
import { saveFile } from '../lib/download';
import { invoicePdf, toBase64 } from '../lib/invoicePdf';

const CRUMB = { ready: 'Ready to Invoice', invoices: 'Invoices', recovery: 'Recovery', settings: 'Billing Settings' };
const STATUS_BG = { Draft: 'var(--snow-ink-5)', Issued: 'var(--snow-primary-blue)', 'Part paid': 'var(--snow-primary-blue)', Paid: 'var(--snow-status-complete-bg)',
  'Paid (part written off)': 'var(--snow-status-complete-bg)', 'Written off': 'var(--snow-ink-5)', Overdue: 'rgba(255,71,71,0.14)', 'Overdue (part settled)': 'rgba(255,71,71,0.14)', Cancelled: 'var(--snow-ink-5)', Credited: 'var(--snow-ink-5)', 'Part credited': 'var(--snow-primary-blue)' };
const d = iso => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const toP = v => Math.round(parseFloat(String(v).replace(/[£,\s]/g, '')) * 100) || 0;   // pounds typed -> pence
const fromP = p => ((p || 0) / 100).toFixed(2);
const pct = x => (x == null ? '—' : `${Math.round(x * 100)}%`);

export default function FinanceConsole({ user, auth, onSignOut }) {
  const [tab, setTab] = useState('ready');
  const [data, setData] = useState(null), [msg, setMsg] = useState({ kind: '', text: '' }), [open, setOpen] = useState(null);
  const load = () => auth.billingGet().then(setData).catch(e => setMsg({ kind: 'err', text: e.message }));
  const [integ, setInteg] = useState(null);
  const loadInteg = () => auth.billingIntegrations().then(setInteg).catch(() => setInteg(null));
  useEffect(() => { load(); loadInteg(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // server-side extras (email, rates, Xero) return the new billing state; keep it
  const extra = async (fn, ok) => { setMsg({ kind: '', text: '' }); try { const r = await fn(); if (r?.state) setData(d => ({ ...d, state: r.state })); if (ok) setMsg({ kind: 'ok', text: ok }); return r || true; } catch (e) { setMsg({ kind: 'err', text: e.message }); return null; } };
  const act = async (action, ok) => {
    setMsg({ kind: '', text: '' });
    try { const r = await auth.billingAct(action); setData(r); if (ok) setMsg({ kind: 'ok', text: ok }); return r; }
    catch (e) { setMsg({ kind: 'err', text: e.message }); return null; }
  };
  const st = data?.state, usage = data?.usage || [];
  const queue = useMemo(() => !st ? [] : Object.values(st.events).filter(e => e.state === 'signed').map(e => {
    const invs = st.invoices.filter(i => i.engagementId === e.engagementId);
    const issued = invs.some(i => i.status === 'issued'), draft = invs.find(i => i.status === 'draft');
    const unbilled = unbilledUsage(st, usage, e.engagementId);
    return { e, issued, draft, unbilled, ai: aiSummary(st.settings, unbilled) };
  }).filter(x => !x.issued || x.unbilled.length || x.draft), [st, usage]);
  const unlockedAfter = st ? Object.values(st.events).filter(e => e.state === 'unlocked' && st.invoices.some(i => i.engagementId === e.engagementId && i.status === 'issued')) : [];
  const overdue = st ? st.invoices.filter(i => daysOverdue(i) > 0) : [];
  const tabs = [{ id: 'ready', label: 'Ready to Invoice', count: queue.length || '' }, { id: 'invoices', label: 'Invoices', count: overdue.length ? `${overdue.length} overdue` : '' },
    { id: 'recovery', label: 'Recovery', count: '' }, { id: 'settings', label: 'Billing Settings', count: '' }];
  const notes = { actions: [
      ...queue.filter(x => !x.draft).map(x => ({ id: 'q' + x.e.engagementId, title: x.issued ? `Unbilled AI usage on ${x.e.fundName}` : `${x.e.fundName} is ready to invoice`, detail: `Signed off by ${x.e.signedBy || '—'}`, fund: x.e.clientName || x.e.entityName, at: x.e.at, go: 'ready' })),
      ...overdue.map(i => ({ id: 'o' + i.id, title: `${i.number} is ${daysOverdue(i)} days overdue`, detail: `${money(totals(i).outstanding)} outstanding`, fund: i.clientName, at: i.dueDate, go: 'invoices', inv: i.id })),
      ...unlockedAfter.map(e => ({ id: 'u' + e.engagementId, title: `${e.fundName} was unlocked after invoicing`, detail: 'Check whether a supplementary invoice will be needed', fund: e.clientName || e.entityName, at: e.at, go: 'ready' }))],
    updates: [] };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'stretch' }}>
      <Sidebar tabs={tabs} tab={open ? 'invoices' : tab} onTab={t => { setOpen(null); setTab(t); setMsg({ kind: '', text: '' }); }} user={user} onSignOut={onSignOut} meta={[]} navTitle="Billing" subtitle="Finance" />
      <main style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ minHeight: 68, padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)' }}>
          <div style={{ ...body, display: 'flex', gap: 8 }}><span style={muted}>Billing</span><span style={{ color: 'var(--snow-black-20)' }}>/</span><span style={{ fontWeight: 600 }}>{open ? 'Invoice' : CRUMB[tab]}</span></div>
          <NotificationBell actions={notes.actions} updates={notes.updates} seenAt="" onSeen={() => {}} onGo={n => { setTab(n.go); setOpen(n.inv || null); }} />
        </header>
        <div style={page}>
          {msg.text && <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ ...cap, borderRadius: 8, padding: '10px 14px', background: msg.kind === 'err' ? 'rgba(255,71,71,0.1)' : 'var(--snow-status-complete-bg)' }}>{msg.text}</div>}
          {!st ? <div style={{ ...body, ...muted }}>Loading…</div>
            : open ? <InvoiceDetail inv={st.invoices.find(i => i.id === open)} st={st} usage={usage} act={act} extra={extra} auth={auth} integ={integ} onBack={() => setOpen(null)} />
            : tab === 'ready' ? <Ready queue={queue} unlocked={unlockedAfter} st={st} onCreate={async x => { if (x.draft) return setOpen(x.draft.id); const r = await act({ type: 'createDraft', engagementId: x.e.engagementId }, 'Draft invoice created.'); if (r) setOpen(r.state.invoices[r.state.invoices.length - 1].id); }} />
            : tab === 'invoices' ? <Invoices st={st} onOpen={setOpen} />
            : tab === 'recovery' ? <Recovery st={st} usage={usage} />
            : <Settings st={st} act={act} extra={extra} auth={auth} integ={integ} reloadInteg={loadInteg} />}
        </div>
      </main>
    </div>
  );
}

// ---- Ready to Invoice ----------------------------------------------------------------------
function Ready({ queue, unlocked, st, onCreate }) {
  return (<>
    <div><div style={h2}>Ready to Invoice</div><div style={{ ...body, ...muted, marginTop: 6, maxWidth: 760 }}>Funds appear here when a Manager signs off the review. Each invoice includes the professional fee and the fund’s AI usage as a separate line. AI usage after an invoice was issued appears again here for a supplementary invoice.</div></div>
    {unlocked.length > 0 && <div role="status" style={{ ...cap, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '10px 14px' }}>Unlocked after invoicing: {unlocked.map(e => e.fundName).join(', ')}. If it is signed off again, any new AI usage will appear here for a supplementary invoice.</div>}
    <Card>
      {!queue.length ? <div style={{ ...body, ...muted }}>Nothing is waiting to be invoiced.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <Row head cols={['Client', 'Fund', 'Year end', 'Signed off', 'AI usage to bill', '']} />
          {queue.map(x => (
            <Row key={x.e.engagementId} cols={[
              <div><div style={{ ...body, fontWeight: 600 }}>{x.e.clientName || x.e.entityName}</div><div style={{ ...cap, ...muted }}>{x.e.entityName}</div></div>,
              <div><div style={body}>{x.e.fundName}</div>{x.issued && <Pill bg="var(--snow-primary-blue)">Supplementary</Pill>}</div>,
              <span style={body}>{x.e.yearEndLabel || d(x.e.yearEnd)}</span>,
              <div style={cap}>{x.e.signedBy || '—'}<div style={muted}>{d(x.e.signedAt)}</div></div>,
              <div style={cap}>{x.ai.calls} call{x.ai.calls === 1 ? '' : 's'}<div style={muted}>{x.ai.calls ? (x.ai.missing ? 'Prices not set' : `${money(x.ai.cost)} at cost`) : 'No AI used'}</div></div>,
              <Button size="sm" onClick={() => onCreate(x)}>{x.draft ? 'Open Draft' : 'Create Invoice'}</Button>]} />
          ))}
        </div>)}
      {!Object.keys(st.settings.rates || {}).length && <div style={{ ...cap, ...muted, marginTop: 12 }}>AI prices are not set yet. Enter them under Billing Settings so AI usage can be charged.</div>}
    </Card>
  </>);
}
const GRID6 = 'minmax(180px,1.4fr) minmax(160px,1.2fr) 120px 140px 150px 130px';
const Row = ({ cols, head }) => (
  <div style={{ display: 'grid', gridTemplateColumns: GRID6, gap: 12, alignItems: 'center', padding: head ? '8px 10px' : '12px 10px', minWidth: 900, boxShadow: head ? 'inset 0 -1px 0 rgba(0,0,0,0.1)' : 'inset 0 -1px 0 rgba(0,0,0,0.05)' }}>
    {cols.map((c, i) => <div key={i} style={head ? { ...cap, ...muted } : { minWidth: 0 }}>{c}</div>)}
  </div>);

// ---- Invoices list -------------------------------------------------------------------------
function Invoices({ st, onOpen }) {
  const [f, setF] = useState('all');
  const list = st.invoices.slice().reverse().filter(i => f === 'all' || (f === 'open' ? i.status === 'issued' && totals(i).outstanding > 0 : f === 'overdue' ? daysOverdue(i) > 0 : i.status === f));
  const grid = '140px minmax(180px,1.4fr) 110px 110px 120px 120px 150px';
  const exportList = async () => {
    const rows = st.invoices.filter(i => i.status !== 'draft').map(i => { const t = totals(i); return { Invoice: i.number, Client: i.clientName, Fund: i.fundName, Issued: d(i.issuedAt), Due: d(i.dueDate), Net: t.net / 100, VAT: t.vat / 100, Total: t.gross / 100, Paid: t.paid / 100, 'Written off': t.writtenOff / 100, Outstanding: t.outstanding / 100, Status: invoiceStatus(i), 'Days overdue': daysOverdue(i) }; });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Invoices');
    await saveFile(`invoices-${new Date().toISOString().slice(0, 10)}.xlsx`, new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]));
  };
  return (<>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <div style={h2}>Invoices</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select className="input" style={{ width: 180 }} aria-label="Show" value={f} onChange={e => setF(e.target.value)}>
          <option value="all">All invoices</option><option value="draft">Drafts</option><option value="open">Unpaid</option><option value="overdue">Overdue</option><option value="cancelled">Cancelled</option>
        </select>
        <Button kind="secondary" onClick={exportList}>Export (.xlsx)</Button>
        <Button kind="secondary" onClick={() => xeroCsv(st)}>Export for Xero (.csv)</Button>
      </div>
    </div>
    <Card>
      {!list.length ? <div style={{ ...body, ...muted }}>No invoices in this view.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, padding: '8px 10px', minWidth: 900, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)' }}>{['Invoice', 'Client / fund', 'Issued', 'Due', 'Total', 'Outstanding', 'Status'].map(c => <div key={c} style={{ ...cap, ...muted }}>{c}</div>)}</div>
          {list.map(i => { const t = totals(i), s = invoiceStatus(i); return (
            <button type="button" key={i.id} className="row" onClick={() => onOpen(i.id)} style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, alignItems: 'center', padding: '12px 10px', minWidth: 900, width: '100%', border: 0, background: 'transparent', font: 'inherit', textAlign: 'left', cursor: 'pointer', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)' }}>
              <span style={{ ...body, fontWeight: 600 }}>{i.number || 'Draft'}{i.kind === 'supplementary' && <span style={{ ...cap, ...muted, display: 'block', fontWeight: 400 }}>Supplementary</span>}</span>
              <span><span style={body}>{i.clientName}</span><span style={{ ...cap, ...muted, display: 'block' }}>{i.fundName}</span></span>
              <span style={cap}>{d(i.issuedAt)}</span><span style={cap}>{d(i.dueDate)}</span>
              <span style={body}>{money(t.gross)}</span><span style={{ ...body, fontWeight: t.outstanding ? 600 : 400 }}>{i.status === 'issued' ? money(t.outstanding) : '—'}</span>
              <span><Pill bg={STATUS_BG[s]}>{s}</Pill>{daysOverdue(i) > 0 && <span style={{ ...cap, color: '#B42318', marginLeft: 6 }}>{daysOverdue(i)} days</span>}{i.xero && <span style={{ ...cap, ...muted, marginLeft: 6 }}>In Xero</span>}</span>
            </button>); })}
        </div>)}
    </Card>
  </>);
}

// ---- One invoice: edit the draft, then issue, collect and recover ----------------------------
function InvoiceDetail({ inv, st, usage, act, extra, auth, integ, onBack }) {
  const [lines, setLines] = useState(inv?.lines || []);
  const [vatRate, setVat] = useState(inv?.vatRate ?? 20), [terms, setTerms] = useState(inv?.termsDays ?? 30), [notes, setNotes] = useState(inv?.notes || '');
  const [modal, setModal] = useState(null);
  useEffect(() => { if (inv) { setLines(inv.lines); setVat(inv.vatRate); setTerms(inv.termsDays); setNotes(inv.notes || ''); } }, [inv?.id, inv?.history?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!inv) return <Card><div style={body}>This invoice no longer exists. <button type="button" className="link" onClick={onBack}>Back to invoices</button></div></Card>;
  const draft = inv.status === 'draft', view = draft ? { ...inv, lines, vatRate } : inv, t = totals(view), s = invoiceStatus(inv);
  const setLine = (id, patch) => setLines(ls => ls.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const saveDraft = () => act({ type: 'updateDraft', id: inv.id, lines, vatRate: Number(vatRate), termsDays: Number(terms), notes }, 'Draft saved.');
  const ai = view.lines.find(l => l.kind === 'ai'), aiUsage = usage.filter(u => (inv.usageIds || []).includes(u.id));
  const exportInvoice = async () => {
    const f = inv.settingsAtIssue || st.settings;
    const aoa = [[f.firmName || 'Invoice'], [f.firmAddress || ''], [f.vatNumber ? `VAT number: ${f.vatNumber}` : ''], [], ['Invoice', inv.number || 'Draft'], ['Date', d(inv.issuedAt)], ['Due', d(inv.dueDate)], ['Bill to', inv.clientName],
      ['Fund', inv.fundName], [], ['Description', 'Amount (£)'], ...inv.lines.map(l => [l.description, l.amount / 100]), [], ['Net', t.net / 100], [`VAT at ${inv.vatRate}%`, t.vat / 100], ['Total', t.gross / 100]];
    if (inv.notes) aoa.push([], [inv.notes]);
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 80 }, { wch: 16 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
    if (aiUsage.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aiUsage.map(u => ({ Date: d(u.at), Step: u.step, Model: u.model, 'Input tokens': u.input, 'Output tokens': u.output }))), 'AI usage detail');
    await saveFile(`${inv.number || 'draft-invoice'}.xlsx`, new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]));
  };

  return (<>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <div>
        <button type="button" className="link" style={{ ...cap, ...muted }} onClick={onBack}>‹ Invoices</button>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}><div style={h2}>{inv.number || 'Draft invoice'}</div><Pill bg={STATUS_BG[s]}>{s}</Pill>{inv.kind === 'supplementary' && <Pill bg="var(--snow-primary-blue)">Supplementary</Pill>}</div>
        <div style={{ ...body, ...muted, marginTop: 4 }}>{inv.clientName} · {inv.fundName} · signed off by {inv.signedBy || '—'} on {d(inv.signedAt)}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button kind="secondary" onClick={async () => saveFile(`${inv.number || 'draft-invoice'}.pdf`, new Blob([await invoicePdf(draft ? { ...inv, lines, vatRate } : inv, st.settings)], { type: 'application/pdf' }))}>{draft ? 'Preview PDF' : 'Download PDF'}</Button>
        {!draft && inv.status !== 'cancelled' && <Button kind="secondary" onClick={() => setModal('email')}>Email Invoice</Button>}
        {inv.status === 'issued' && !inv.xero && integ?.xero?.connected && <Button kind="secondary" onClick={() => extra(() => auth.xeroSend(inv.id), 'Sent to Xero as an authorised sales invoice.')}>Send to Xero</Button>}
        <Button kind="secondary" onClick={exportInvoice}>Export (.xlsx)</Button>
      </div>
    </div>
    {(inv.xero || (inv.emails || []).length > 0) && <div style={{ ...cap, ...muted }}>{inv.xero ? `In Xero (${inv.xero.status}) since ${d(inv.xero.at)}. ` : ''}{(inv.emails || []).map(e => `Emailed to ${e.to} on ${d(e.at)} by ${e.by?.name}`).join(' · ')}</div>}

    <Card>
      <CardHead title="Lines" aside={draft ? 'Amounts in £, before VAT' : `Issued ${d(inv.issuedAt)} · due ${d(inv.dueDate)}`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        {view.lines.map(l => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 36px', gap: 10, alignItems: 'start', padding: 12, borderRadius: 10, background: l.kind === 'ai' ? '#F4F6FD' : 'var(--snow-primary-light)' }}>
            <div>
              {draft ? <input className="input" aria-label="Line description" value={l.description} onChange={e => setLine(l.id, { description: e.target.value })} /> : <div style={body}>{l.description}</div>}
              {l.kind === 'ai' && <div style={{ ...cap, ...muted, marginTop: 6 }}>{l.unpriced && l.usageCount ? 'AI prices or the USD to GBP rate are not set, so this line can’t be charged yet.' : `${money(l.costAtCost)} at cost${l.markupPct ? ` plus ${l.markupPct}% = ${money(Math.round((l.costAtCost || 0) * (1 + l.markupPct / 100)))}` : ''}`}{l.usageCount === 0 && ' No AI was used on this fund.'}</div>}
              {draft && l.kind === 'ai' && <input className="input" style={{ marginTop: 6 }} aria-label="Reason for changing the AI charge" placeholder="Reason, if you reduce the AI charge" value={l.adjustReason || ''} onChange={e => setLine(l.id, { adjustReason: e.target.value })} />}
              {!draft && l.adjustReason && <div style={{ ...cap, ...muted, marginTop: 4 }}>Adjusted: {l.adjustReason}</div>}
            </div>
            {draft ? <input className="input" aria-label="Line amount in pounds" inputMode="decimal" value={l._raw ?? fromP(l.amount)} onChange={e => setLine(l.id, { _raw: e.target.value, amount: toP(e.target.value) })} style={{ textAlign: 'right' }} />
              : <div style={{ ...body, textAlign: 'right' }}>{money(l.amount)}</div>}
            {draft && l.kind === 'other' ? <button type="button" className="link" aria-label="Remove line" onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))} style={{ ...body, ...muted }}>×</button> : <span />}
          </div>))}
      </div>
      {draft && <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button size="sm" kind="secondary" onClick={() => setLines(ls => [...ls, { id: 'n' + Date.now(), kind: 'other', description: '', amount: 0 }])}>Add Line</Button>
        <Button size="sm" kind="secondary" onClick={() => act({ type: 'refreshAi', id: inv.id }, 'AI usage recalculated from the latest usage and prices.')}>Recalculate AI Usage</Button>
      </div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 6, marginTop: 16, paddingTop: 12, boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.1)', ...body }}>
        <span>Net</span><span style={{ textAlign: 'right' }}>{money(t.net)}</span>
        <span>VAT at {draft ? <input className="input" aria-label="VAT rate" style={{ width: 64, display: 'inline-block', height: 28 }} value={vatRate} onChange={e => setVat(e.target.value)} /> : inv.vatRate}%</span><span style={{ textAlign: 'right' }}>{money(t.vat)}</span>
        <b>Total</b><b style={{ textAlign: 'right' }}>{money(t.gross)}</b>
        {!draft && <>{t.credited > 0 && <><span>Credited</span><span style={{ textAlign: 'right' }}>{money(t.credited)}</span></>}<span>Paid</span><span style={{ textAlign: 'right' }}>{money(t.paid)}</span>{t.writtenOff > 0 && <><span>Written off</span><span style={{ textAlign: 'right' }}>{money(t.writtenOff)}</span></>}<b>Outstanding</b><b style={{ textAlign: 'right' }}>{money(t.outstanding)}</b></>}
      </div>
      {draft && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 14 }}>
        <label style={{ ...cap, display: 'flex', flexDirection: 'column', gap: 4 }}><span style={muted}>Payment terms (days)</span><input className="input" value={terms} onChange={e => setTerms(e.target.value)} /></label>
        <label style={{ ...cap, display: 'flex', flexDirection: 'column', gap: 4 }}><span style={muted}>Note on the invoice (optional)</span><input className="input" value={notes} onChange={e => setNotes(e.target.value)} /></label>
      </div>}
    </Card>

    {draft ? (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Button kind="secondary" onClick={() => setModal('discard')}>Discard Draft</Button>
        <Button kind="secondary" onClick={saveDraft}>Save Draft</Button>
        <Button onClick={async () => { const r = await act({ type: 'updateDraft', id: inv.id, lines, vatRate: Number(vatRate), termsDays: Number(terms), notes }); if (r) act({ type: 'issue', id: inv.id }, 'Invoice issued. Its lines are now locked.'); }}>Issue Invoice</Button>
      </div>
    ) : inv.status === 'issued' && (
      <Card>
        <CardHead title="Recovery" aside={daysOverdue(inv) ? `${daysOverdue(inv)} days overdue` : t.outstanding ? `Due ${d(inv.dueDate)}` : 'Settled'} />
        {(inv.payments || []).length > 0 && <ul style={{ ...cap, margin: '10px 0 0', paddingLeft: 18 }}>{inv.payments.map(p => <li key={p.id}>{money(p.amount)} received {d(p.date)}{p.reference ? ` · ${p.reference}` : ''} · recorded by {p.by?.name}</li>)}</ul>}
        {(inv.writeOffs || []).length > 0 && <ul style={{ ...cap, margin: '6px 0 0', paddingLeft: 18 }}>{inv.writeOffs.map(w => <li key={w.id}>{money(w.amount)} written off: {w.reason} · {w.by?.name}</li>)}</ul>}
        {(inv.creditNotes || []).length > 0 && <ul style={{ ...cap, margin: '6px 0 0', paddingLeft: 18 }}>{inv.creditNotes.map(c => <li key={c.id}>Credit note {c.number}: {money(c.amount)} ({money(c.net)} net + {money(c.vat)} VAT) · {c.reason} · {c.by?.name}, {d(c.at)}</li>)}</ul>}
        {t.outstanding > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Button onClick={() => setModal('payment')}>Record Payment</Button>
          <Button kind="secondary" onClick={() => setModal('credit')}>Raise Credit Note</Button>
          <Button kind="secondary" onClick={() => setModal('writeoff')}>Write Off</Button>
          {!(inv.payments || []).length && <Button kind="secondary" onClick={() => setModal('cancel')}>Cancel with Credit Note</Button>}
        </div>}
      </Card>
    )}
    {inv.status === 'cancelled' && <div role="status" style={{ ...cap, background: 'var(--snow-ink-5)', borderRadius: 8, padding: '10px 14px' }}>Cancelled by credit note {inv.creditNote} on {d(inv.cancelledAt)}: {inv.cancelReason}. Its AI usage can be billed again.</div>}
    <Card><CardHead title="History" /><ul style={{ ...cap, margin: '10px 0 0', paddingLeft: 18 }}>{inv.history.slice().reverse().map((h, i) => <li key={i}>{h.what} · {h.by?.name} · {new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</li>)}</ul></Card>

    {modal === 'payment' && <Form title="Record a payment" fields={[['amount', 'Amount received (£)', fromP(t.outstanding)], ['date', 'Date received', new Date().toISOString().slice(0, 10), 'date'], ['reference', 'Reference (bank or remittance)', '']]} button="Record Payment"
      onClose={() => setModal(null)} onSubmit={async v => { const r = await act({ type: 'payment', id: inv.id, amount: toP(v.amount), date: v.date, reference: v.reference }, 'Payment recorded.'); if (r) setModal(null); }} />}
    {modal === 'credit' && <Form title="Raise a credit note" fields={[['amount', 'Amount to credit, including VAT (£)', ''], ['reason', 'Reason (required)', '']]} button="Raise Credit Note"
      onClose={() => setModal(null)} onSubmit={async v => { const r = await act({ type: 'creditNote', id: inv.id, amount: toP(v.amount), reason: v.reason }, 'Credit note raised.'); if (r) setModal(null); }} />}
    {modal === 'email' && <EmailForm inv={inv} st={st} integ={integ} onClose={() => setModal(null)} onSend={async v => {
      const pdf = toBase64(await invoicePdf(inv, st.settings));
      const r = await extra(() => auth.billingEmail({ invoiceId: inv.id, to: v.to, cc: v.cc, subject: v.subject, message: v.message, pdf, fileName: `${inv.number}.pdf` }), `Invoice emailed to ${v.to}.`);
      if (r) setModal(null); }} />}
    {modal === 'writeoff' && <Form title="Write off" fields={[['amount', 'Amount to write off (£)', fromP(t.outstanding)], ['reason', 'Reason (required)', '']]} button="Write Off"
      onClose={() => setModal(null)} onSubmit={async v => { const r = await act({ type: 'writeOff', id: inv.id, amount: toP(v.amount), reason: v.reason }, 'Amount written off.'); if (r) setModal(null); }} />}
    {modal === 'cancel' && <Form title="Cancel with a credit note" fields={[['reason', 'Reason (required)', '']]} button="Cancel Invoice"
      onClose={() => setModal(null)} onSubmit={async v => { const r = await act({ type: 'cancel', id: inv.id, reason: v.reason }, 'Invoice cancelled with a credit note.'); if (r) setModal(null); }} />}
    {modal === 'discard' && <Form title="Discard this draft" fields={[['reason', 'Reason (required)', '']]} button="Discard Draft"
      onClose={() => setModal(null)} onSubmit={async v => { const r = await act({ type: 'cancel', id: inv.id, reason: v.reason }, 'Draft discarded.'); if (r) { setModal(null); onBack(); } }} />}
  </>);
}

const fill = (tpl, inv, st) => String(tpl || '').replace(/\{number\}/g, inv.number || '').replace(/\{firm\}/g, st.settings.firmName || 'us').replace(/\{fund\}/g, inv.fundName || '').replace(/\{due\}/g, d(inv.dueDate));
function EmailForm({ inv, st, integ, onClose, onSend }) {
  const [v, setV] = useState({ to: inv.email || '', cc: '', subject: fill(st.settings.emailSubject, inv, st), message: fill(st.settings.emailMessage, inv, st) });
  const ok = integ?.email?.configured;
  return (
    <Modal title={`Email ${inv.number}`} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (ok) onSend(v); }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!ok && <div role="status" style={{ ...cap, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '8px 10px' }}>Email isn’t set up on the server yet (SMTP settings). Download the PDF and send it from your email instead.</div>}
        {[['to', 'To (separate several with commas)'], ['cc', 'Cc (optional)'], ['subject', 'Subject']].map(([k, label]) => (
          <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ ...cap, ...muted }}>{label}</span><input className="input" value={v[k]} onChange={e => setV(x => ({ ...x, [k]: e.target.value }))} /></label>))}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ ...cap, ...muted }}>Message</span><textarea className="input" rows={4} style={{ height: 'auto', padding: '8px 10px' }} value={v.message} onChange={e => setV(x => ({ ...x, message: e.target.value }))} /></label>
        <span style={{ ...cap, ...muted }}>The invoice PDF is attached{integ?.email?.from ? `; sent from ${integ.email.from}` : ''}.</span>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><Button kind="secondary" onClick={onClose}>Cancel</Button><button type="submit" className="btn btn-primary" style={{ height: 36, padding: '0 16px' }} disabled={!ok || !v.to.trim()}>Send Email</button></div>
      </form>
    </Modal>);
}
// Xero's sales invoice import file (Business › Invoices › Import), one row per invoice line; amounts exclude VAT.
async function xeroCsv(st) {
  const esc = x => `"${String(x ?? '').replace(/"/g, '""')}"`, dmy = iso => { const t = new Date(iso); return `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`; };
  const head = ['*ContactName', 'EmailAddress', '*InvoiceNumber', 'Reference', '*InvoiceDate', '*DueDate', '*Description', '*Quantity', '*UnitAmount', '*AccountCode', '*TaxType', 'Currency'];
  const rows = st.invoices.filter(i => i.status === 'issued' && !i.xero).flatMap(i => i.lines.map(l => [i.clientName, i.email || '', i.number, i.fundName, dmy(i.issuedAt), dmy(i.dueDate), l.description, 1, (l.amount / 100).toFixed(2), st.settings.xero?.accountCode || '200', st.settings.xero?.taxType || '20% (VAT on Income)', 'GBP']));
  await saveFile(`xero-invoices-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([[head, ...rows].map(r => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv' }));
}

function Form({ title, fields, button, onClose, onSubmit }) {
  const [v, setV] = useState(Object.fromEntries(fields.map(([k, , dflt]) => [k, dflt])));
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); onSubmit(v); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fields.map(([k, label, , type]) => (
          <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ ...cap, ...muted }}>{label}</span>
            <input className="input" type={type || 'text'} value={v[k]} onChange={e => setV(x => ({ ...x, [k]: e.target.value }))} /></label>))}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><Button kind="secondary" onClick={onClose}>Cancel</Button><button type="submit" className="btn btn-primary" style={{ height: 36, padding: '0 16px' }}>{button}</button></div>
      </form>
    </Modal>);
}

// ---- Recovery report -----------------------------------------------------------------------
function Recovery({ st, usage }) {
  const r = recovery(st, usage);
  const tiles = [['Billed', money(r.billed)], ['Collected', money(r.collected), r.cashRecovery == null ? '' : `${pct(r.cashRecovery)} of billed`], ['Outstanding', money(r.outstanding)],
    ['Overdue', money(r.overdue)], ['Credited', money(r.credited || 0)], ['Written off', money(r.writtenOff)], ['AI recovery', pct(r.aiRecovery), `${money(r.aiBilled)} billed on ${money(r.aiCost)} cost`], ['Unbilled AI', money(r.unbilledCost), `${r.unbilledCalls} call${r.unbilledCalls === 1 ? '' : 's'} not yet invoiced`]];
  const exportR = async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Measure', 'Value'], ...tiles.map(([k, v, x]) => [k, x ? `${v} (${x})` : v]),
      [], ['Ageing of outstanding', ''], ['Not yet due', r.aging.current / 100], ['1–30 days overdue', r.aging.d30 / 100], ['31–60 days', r.aging.d60 / 100], ['61–90 days', r.aging.d90 / 100], ['Over 90 days', r.aging.d90p / 100]]), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.clients.map(c => ({ Client: c.client, Invoices: c.invoices, Billed: c.billed / 100, Collected: c.collected / 100, 'Written off': c.writtenOff / 100, Outstanding: c.outstanding / 100, Overdue: c.overdue / 100, 'AI cost': c.aiCost / 100, 'AI billed': c.aiBilled / 100 }))), 'By client');
    await saveFile(`recovery-${new Date().toISOString().slice(0, 10)}.xlsx`, new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]));
  };
  const ages = [['Not yet due', r.aging.current], ['1–30 days', r.aging.d30], ['31–60 days', r.aging.d60], ['61–90 days', r.aging.d90], ['Over 90 days', r.aging.d90p]];
  const maxAge = Math.max(1, ...ages.map(a => a[1]));
  return (<>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
      <div><div style={h2}>Recovery</div><div style={{ ...body, ...muted, marginTop: 6 }}>Cash collected against invoices, what is still owed and for how long, and how much of the AI cost was recharged.</div></div>
      <Button kind="secondary" onClick={exportR}>Export (.xlsx)</Button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
      {tiles.map(([k, v, x]) => <div key={k} style={{ background: '#fff', boxShadow: RING, borderRadius: 14, padding: 16 }}><div style={{ ...cap, ...muted }}>{k}</div><div style={{ ...h3, marginTop: 4 }}>{v}</div>{x && <div style={{ ...cap, ...muted, marginTop: 2 }}>{x}</div>}</div>)}
    </div>
    <Card>
      <CardHead title="Ageing of Outstanding" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {ages.map(([k, v]) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px', gap: 10, alignItems: 'center', ...cap }}>
          <span>{k}</span><span style={{ height: 12, borderRadius: 6, background: 'var(--snow-ink-5)' }}><span style={{ display: 'block', height: 12, borderRadius: 6, width: `${(v / maxAge) * 100}%`, background: k === 'Not yet due' ? '#4F86D3' : '#D92D20' }} /></span><span style={{ textAlign: 'right' }}>{money(v)}</span></div>)}
      </div>
    </Card>
    <Card>
      <CardHead title="By Client" />
      {!r.clients.length ? <div style={{ ...body, ...muted, marginTop: 10 }}>No invoices issued yet.</div> : (
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          {[['Client', 'Billed', 'Collected', 'Outstanding', 'Overdue', 'AI cost', 'AI billed'], ...r.clients.map(c => [c.client, money(c.billed), money(c.collected), money(c.outstanding), money(c.overdue), money(c.aiCost), money(c.aiBilled)])].map((row, i) =>
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1.6fr) repeat(6, minmax(100px,1fr))', gap: 10, padding: '9px 6px', minWidth: 860, boxShadow: i ? 'inset 0 -1px 0 rgba(0,0,0,0.05)' : 'inset 0 -1px 0 rgba(0,0,0,0.1)', ...(i ? body : { ...cap, ...muted }) }}>{row.map((c, j) => <span key={j} style={{ textAlign: j ? 'right' : 'left' }}>{c}</span>)}</div>)}
        </div>)}
    </Card>
  </>);
}

// ---- Billing settings ----------------------------------------------------------------------
function Settings({ st, act, extra, auth, integ, reloadInteg }) {
  const [lock, setLock] = useState(st.settings.lockDate || ''), [lockWhy, setLockWhy] = useState('');
  const [s, setS] = useState({ ...DEFAULT_BILLING, ...st.settings });
  const set = (k, v) => setS(x => ({ ...x, [k]: v }));
  const rate = (m, k, v) => setS(x => ({ ...x, rates: { ...x.rates, [m]: { ...(x.rates?.[m] || {}), [k]: v } } }));
  const F = ({ k, label, hint, ...p }) => (<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ ...cap, ...muted }}>{label}</span><input className="input" value={s[k] ?? ''} onChange={e => set(k, e.target.value)} {...p} />{hint && <span style={{ ...cap, ...muted }}>{hint}</span>}</label>);
  const save = () => act({ type: 'settings', settings: { ...s, defaultFee: toP(s._fee ?? fromP(s.defaultFee)), usdToGbp: s.usdToGbp === '' ? null : s.usdToGbp,
    rates: Object.fromEntries(Object.entries(s.rates || {}).map(([m, r]) => [m, { in: Number(r.in) || 0, out: Number(r.out) || 0 }]).filter(([, r]) => r.in || r.out)) } }, 'Billing settings saved.');
  return (<>
    <div><div style={h2}>Billing Settings</div><div style={{ ...body, ...muted, marginTop: 6 }}>Invoice details, payment terms and the prices used to charge AI usage.</div></div>
    <Card><CardHead title="On the Invoice" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
        {F({ k: 'firmName', label: 'Firm name' })}{F({ k: 'firmAddress', label: 'Firm address' })}{F({ k: 'vatNumber', label: 'VAT number' })}
        {F({ k: 'invoicePrefix', label: 'Invoice number prefix', hint: 'For example INV- gives INV-2026-0001' })}{F({ k: 'paymentTermsDays', label: 'Payment terms (days)' })}{F({ k: 'vatRate', label: 'VAT rate (%)' })}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ ...cap, ...muted }}>Default professional fee (£)</span><input className="input" value={s._fee ?? fromP(s.defaultFee)} onChange={e => set('_fee', e.target.value)} /><span style={{ ...cap, ...muted }}>Suggested on new invoices; can be changed on each one</span></label>
      </div></Card>
    <Card><CardHead title="AI Usage Charges" />
      <div style={{ ...cap, ...muted, marginTop: 8, maxWidth: 760 }}>Enter each model’s current prices from Anthropic’s pricing page (US dollars per million tokens). AI cost is converted to pounds at your rate, then the markup is added. Until a model has prices and a rate is set, its usage shows on invoices without a charge.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
        {F({ k: 'usdToGbp', label: 'USD to GBP rate', placeholder: 'e.g. the rate on your invoice date' })}{F({ k: 'aiMarkupPct', label: 'AI markup (%)', hint: '0 recharges AI at cost' })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {MODELS.map(m => <div key={m.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) 170px 170px', gap: 10, alignItems: 'end' }}>
          <span style={body}><b>{m.name}</b> <code style={{ ...cap, ...muted }}>{m.id}</code></span>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ ...cap, ...muted }}>Input ($ per 1M tokens)</span><input className="input" aria-label={`${m.name} input price`} value={s.rates?.[m.id]?.in ?? ''} onChange={e => rate(m.id, 'in', e.target.value)} /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ ...cap, ...muted }}>Output ($ per 1M tokens)</span><input className="input" aria-label={`${m.name} output price`} value={s.rates?.[m.id]?.out ?? ''} onChange={e => rate(m.id, 'out', e.target.value)} /></label>
        </div>)}
      </div></Card>
    <Card><CardHead title="Exchange Rate" />
      <div style={{ ...cap, marginTop: 8 }}>Current USD to GBP rate: <b>{st.settings.usdToGbp ?? 'not set'}</b>{st.settings.fxDate ? ` · ${st.settings.fxSource || 'manual'}, ${st.settings.fxDate}` : ''}.</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <Button kind="secondary" onClick={() => extra(() => auth.billingFxRefresh(), 'Rate updated from the European Central Bank’s daily reference rates.')}>Update Rate Now</Button>
        <span style={{ ...cap, ...muted }}>{integ?.fx?.auto ? 'Also updated automatically twice a day.' : 'Fetched by the server from the European Central Bank’s daily reference rates.'} Issued invoices keep the rate they were charged at.</span>
      </div></Card>
    <Card><CardHead title="Period Lock" />
      <div style={{ ...cap, marginTop: 8 }}>{st.settings.lockDate ? <>Locked up to <b>{d(st.settings.lockDate)}</b>: no invoice, payment, credit note or write-off can be dated on or before it.</> : 'No lock date. Set one when a month is closed so its billing can’t change.'}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ ...cap, ...muted }}>Lock date</span><input className="input" type="date" aria-label="Lock date" value={lock} onChange={e => setLock(e.target.value)} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 220 }}><span style={{ ...cap, ...muted }}>Reason (required)</span><input className="input" aria-label="Reason for the lock date" value={lockWhy} onChange={e => setLockWhy(e.target.value)} placeholder="e.g. October 2026 closed" /></label>
        <Button onClick={async () => { const r = await act({ type: 'setLock', lockDate: lock || null, reason: lockWhy }, lock ? `Billing locked up to ${lock}.` : 'Lock date removed.'); if (r) setLockWhy(''); }}>{lock ? 'Set Lock Date' : 'Remove Lock'}</Button>
      </div></Card>
    <Card><CardHead title="Email" />
      <div style={{ ...cap, marginTop: 8 }}>{integ?.email?.configured ? `Invoices are emailed from ${integ.email.from}.` : 'Not set up: the server needs SMTP_HOST and MAIL_FROM, plus SMTP_PORT, SMTP_USER and SMTP_PASS if the mail server requires them.'} Templates can use {'{number}'}, {'{firm}'}, {'{fund}'} and {'{due}'}.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 10 }}>{F({ k: 'emailSubject', label: 'Subject' })}{F({ k: 'emailMessage', label: 'Message' })}</div></Card>
    <Card><CardHead title="Xero" />
      <div style={{ ...cap, marginTop: 8 }}>{!integ?.xero?.configured ? 'Not set up: create an app at developer.xero.com and set XERO_CLIENT_ID, XERO_CLIENT_SECRET and XERO_REDIRECT_URI on the server. Until then, use Export for Xero (.csv).'
        : integ.xero.connected ? <>Connected to <b>{integ.xero.tenantName}</b>. Issued invoices can be sent to Xero as authorised sales invoices.</> : 'Ready to connect.'}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {integ?.xero?.configured && !integ.xero.connected && <Button onClick={async () => { const r = await extra(() => auth.xeroConnect()); if (r?.url) window.location.href = r.url; }}>Connect Xero</Button>}
        {integ?.xero?.connected && <Button kind="secondary" onClick={async () => { await extra(() => auth.xeroDisconnect(), 'Xero disconnected.'); reloadInteg(); }}>Disconnect</Button>}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ ...cap, ...muted }}>Sales account code</span><input className="input" aria-label="Xero account code" value={s.xero?.accountCode || ''} onChange={e => set('xero', { ...(s.xero || {}), accountCode: e.target.value })} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ ...cap, ...muted }}>Tax type</span><input className="input" aria-label="Xero tax type" value={s.xero?.taxType || ''} onChange={e => set('xero', { ...(s.xero || {}), taxType: e.target.value })} /></label>
      </div></Card>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button size="lg" onClick={save}>Save Billing Settings</Button></div>
  </>);
}
