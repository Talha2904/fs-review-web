import React, { useEffect, useMemo, useState } from 'react';
import { gbp, fmt, signedGbp, sym } from '../lib/format';

// What correcting a point changes (from the AI review): profit before tax, tax and net assets.
const effects = p => [
  p.pbtEffect != null && `profit before tax ${p.pbtEffect ? signedGbp(p.pbtEffect) : 'unchanged'}`,
  p.taxEffect != null && p.taxEffect !== 0 && `tax ${signedGbp(p.taxEffect)}`,
  p.netAssetsEffect != null && `net assets ${p.netAssetsEffect ? signedGbp(p.netAssetsEffect) : 'unchanged'}`
].filter(Boolean).join(' · ');
import { can, canClearPoint } from '../lib/roles';
import { Button, Card, Pill, PriPill, Segmented, FileButton, InfoTip, cap, body, h2, h3, muted, page, RING, LOCKED_NOTE } from '../components/ui';
import { slotDefs } from '../data/sampleFund';
import { SLOT_RULES, ACCEPT } from '../lib/fileRules';
import { reviewStore } from '../lib/reviewStore';
import { saveFile } from '../lib/download';
import Select from '../components/Select';
import Modal from '../components/Modal';

const ST = { open: ['Open', 'var(--snow-status-approved-bg)'], responded: ['Responded', 'var(--snow-primary-blue)'], reopened: ['Reopened', 'var(--snow-status-rejected-bg)'], cleared: ['Cleared', 'var(--snow-status-complete-bg)'] };
export const PointStatus = ({ status }) => <Pill bg={(ST[status] || ST.open)[1]}>{(ST[status] || ST.open)[0]}</Pill>;
export const TYPES = { change: 'Needs a change', explain: 'Needs an explanation', info: 'For information' };
const today = () => new Date().toISOString().slice(0, 10);
export const isOverdue = p => p.dueDate && p.status !== 'cleared' && p.dueDate < today();
const dayLabel = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const KIND = { raise: 'Raised', assign: 'Assigned', comment: 'Comment', response: 'Response', reopen: 'Reopened', clear: 'Cleared', note: 'App note' };
const when = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const initials = n => String(n || 'App').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

export default function ScheduleTab({ engagementId, shared = { points: [], messages: [] }, fundNameOf = () => 'Another fund', onOpenFundPoint, points, messages, user, people, sel, setSel, focus = null, onFocused, actions, waitingForMe, canRaise, canRespond, locked = false, threshold, version }) {
  const mine = points.filter(waitingForMe);
  // Opened on a particular point (`focus`, from a flagged line or the activity log): start on a view that
  // lists it and bring it into view.
  const [view, setView] = useState(() => (mine.length && (!focus || mine.some(p => p.ref === focus)) ? 'mine' : 'all'));
  useEffect(() => {
    if (!focus) return;
    requestAnimationFrame(() => document.querySelector('.point-row[aria-current="true"]')?.scrollIntoView({ block: 'nearest' }));
    onFocused?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [copied, setCopied] = useState(false);
  const rows = points.filter(p => view === 'all' ? true : view === 'mine' ? waitingForMe(p) : view === 'overdue' ? isOverdue(p) : view === 'preparer' ? ['open', 'reopened'].includes(p.status) : p.status === view);
  const overdueCount = points.filter(isOverdue).length;
  const current = points.find(p => p.ref === sel) || rows[0] || null;
  useEffect(() => { if (current && current.ref !== sel) setSel(current.ref); }, [current?.ref]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = s => points.filter(p => s === 'preparer' ? ['open', 'reopened'].includes(p.status) : p.status === s).length;
  // the other funds' copies of a shared point (each fund keeps and clears its own)
  const siblingsOf = p => (p.sharedGroupId ? shared.points.filter(x => x.sharedGroupId === p.sharedGroupId) : []);

  const copy = () => {
    const head = ['Ref', 'Priority', 'Area', 'Point', 'Amount', 'Status', 'Assigned to', 'Raised by', 'Cleared by'];
    const text = [head, ...points.map(r => [r.ref, r.pri, r.area, r.title, r.amount ?? '', (ST[r.status] || ST.open)[0], r.assignedTo?.name || '', r.raisedBy?.name || '', r.clearedBy?.name || ''])].map(r => r.join('\t')).join('\n');
    navigator.clipboard?.writeText(text); setCopied(true);
  };

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={h2}>Review Points</div>
          <div style={{ ...cap, ...muted, marginTop: 4 }}>{points.length} points · {count('preparer')} with the preparer · {count('responded')} responded · {count('cleared')} cleared{version ? ` · draft v${version}` : ''} · threshold {sym()}{fmt(threshold)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', maxWidth: '100%', minWidth: 0 }}>
          <Segmented value={view} onChange={setView} options={[['mine', `Waiting for Me (${mine.length})`], ['preparer', 'With Preparer'], ['responded', 'Responded'], ...(overdueCount ? [['overdue', `Overdue (${overdueCount})`]] : []), ['cleared', 'Cleared'], ['all', 'All']]} />
          <Button size="sm" kind="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy Schedule'}</Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div role="list" aria-label="Review points" style={{ flex: '1 1 380px', minWidth: 'min(320px, 100%)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!rows.length && <Card><div style={{ ...body, ...muted }}>{view === 'mine' ? 'Nothing is waiting for you.' : 'No points in this view.'}</div></Card>}
          {rows.map(p => {
            const on = current?.ref === p.ref, last = messages.filter(m => m.pointId === p.id).slice(-1)[0];
            return (
              <button type="button" role="listitem" key={p.id} onClick={() => { setSel(p.ref); if (!window.matchMedia('(min-width: 1024px)').matches) requestAnimationFrame(() => document.getElementById('point-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }} aria-current={on ? 'true' : undefined} className={`point-row pri-${(p.pri || 'Low').toLowerCase()} st-${p.status}`}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ ...body, fontWeight: 600 }}>{p.ref}</span><PriPill pri={p.pri} /><PointStatus status={p.status} />
                  {waitingForMe(p) && <Pill bg="var(--snow-black-100)"><span style={{ color: '#fff' }}>For you</span></Pill>}
                  {p.type !== 'change' && <Pill bg="var(--snow-ink-5)">{TYPES[p.type]}</Pill>}
                  {siblingsOf(p).length > 0 && <Pill bg="var(--snow-primary-purple)">Shared · {siblingsOf(p).length + 1} funds</Pill>}
                  {p.dueDate && p.status !== 'cleared' && <span style={{ ...cap, color: isOverdue(p) ? 'var(--pa-red)' : 'var(--snow-black-40)', fontWeight: isOverdue(p) ? 600 : 400 }}>{isOverdue(p) ? 'Overdue · ' : 'Due '}{dayLabel(p.dueDate)}</span>}
                </div>
                <div style={{ ...body, marginTop: 6 }}>{p.title}</div>
                <div style={{ ...cap, ...muted, marginTop: 4 }}>{p.assignedTo ? `Assigned to ${p.assignedTo.name}` : 'Not assigned'} · {last ? `${KIND[last.kind].toLowerCase()} ${when(last.at)}` : when(p.raisedAt)}</div>
              </button>
            );
          })}
        </div>

        {current && <PointDetail key={current.id} p={current} thread={messages.filter(m => m.pointId === current.id)} user={user} people={people}
          engagementId={engagementId} siblings={siblingsOf(current)} siblingThread={shared.messages.filter(m => siblingsOf(current).some(x => x.id === m.pointId))}
          fundNameOf={fundNameOf} onOpenFundPoint={onOpenFundPoint}
          actions={actions} canRaise={canRaise} canRespond={canRespond} locked={locked} threshold={threshold} />}
      </div>

    </div>
  );
}

function PointDetail({ p, thread: own, siblings = [], siblingThread = [], engagementId, fundNameOf, onOpenFundPoint, user, people, actions, canRaise, canRespond, locked, threshold }) {
  const [sharing, setSharing] = useState(false), [unsharing, setUnsharing] = useState(false);
  // a shared point's thread: this fund's copy and the other funds' discussion (comments, responses, reopening and
  // clearing; their raise, assignment and app notes concern their own copy), in time order, tagged with the fund
  const thread = siblings.length
    ? [...own, ...siblingThread.filter(m => ['comment', 'response', 'reopen', 'clear'].includes(m.kind))].sort((a, b) => a.at.localeCompare(b.at))
    : own;
  const copyOf = m => siblings.find(x => x.id === m.pointId);
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [revSlot, setRevSlot] = useState(''), [revised, setRevised] = useState(null), [evidenceFiles, setEvidenceFiles] = useState([]);
  const canClear = !locked && canClearPoint(user, p);
  const assignable = useMemo(() => people.filter(x => x.active && can({ role: x.role }, 'points.respond')), [people]);
  const run = fn => async () => {
    setBusy(true); setError('');
    try { await fn(text.trim()); setText(''); setRevised(null); setRevSlot(''); setEvidenceFiles([]); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const has = text.trim().length > 0;
  const buttons = [];
  const responding = canRespond && ['open', 'reopened'].includes(p.status);
  if (responding) buttons.push(<Button key="r" disabled={busy || !has} onClick={run(t => actions.respond(p, t, { revised: revised && revSlot ? { slot: revSlot, file: revised } : null, evidence: evidenceFiles }))}>Send Response</Button>);
  if (canClear && p.status !== 'cleared') buttons.push(<Button key="c" kind={p.status === 'responded' ? 'primary' : 'secondary'} disabled={busy} onClick={run(t => actions.clear(p, t))}>Clear Point</Button>);
  if (canClear && ['responded', 'cleared'].includes(p.status)) buttons.push(<Button key="o" kind="secondary" disabled={busy || !has} onClick={run(t => actions.reopen(p, t))}>Reopen</Button>);
  if (canRaise || canRespond) buttons.push(<Button key="m" kind="secondary" disabled={busy || !has} onClick={run(t => actions.comment(p, t))}>Add Comment</Button>);
  const waiting = locked ? LOCKED_NOTE : p.status === 'cleared' ? `Cleared by ${p.clearedBy?.name} · ${when(p.clearedAt)}.`
    : ['open', 'reopened'].includes(p.status) ? `Waiting for ${p.assignedTo?.name || 'a preparer'} to respond.`
    : `Waiting for ${p.raisedBy?.name || 'the reviewer'} (who raised it) or a Manager to clear or reopen it.`;
  const hint = ['open', 'reopened'].includes(p.status) && canRespond ? 'Explain what you changed or why no change is needed, then send your response.'
    : p.status === 'responded' && canClear ? 'Clear the point if the response is enough. To reopen, say what is still needed.'
    : p.status === 'cleared' && canClear ? 'To reopen this point, say why.' : '';

  return (
    <section id="point-detail" className="point-detail" aria-label={`${p.ref} detail`} style={{ flex: '1.4 1 520px', minWidth: 'min(320px, 100%)', background: '#fff', borderRadius: 16, boxShadow: RING, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span style={h3}>{p.ref}</span><PriPill pri={p.pri} /><PointStatus status={p.status} />{p.aiDrafted && <Pill bg="var(--snow-status-pending-bg)">Drafted by AI</Pill>}</div>
      <div style={{ ...h3, fontWeight: 600, marginTop: 8 }}>{p.title}</div>
      {siblings.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8, ...cap }}>
          <span style={{ fontWeight: 600 }}>Shared with<InfoTip label="About shared points">The same matter in related funds. Comments and responses in any fund show in this thread; each fund responds to and clears its own copy, so this point stays open until it is cleared here.</InfoTip></span>
          {siblings.map(x => (
            <button key={x.id} type="button" className="link" onClick={() => onOpenFundPoint?.(x.engagementId, x.ref)} title={`Open ${x.ref} in ${fundNameOf(x.engagementId)}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>{fundNameOf(x.engagementId)} · {x.ref}</span><PointStatus status={x.status} />
            </button>))}
          {canRaise && !locked && <button type="button" className="link" style={{ ...muted }} disabled={unsharing}
            onClick={async () => { setUnsharing(true); setError(''); try { await actions.unshare(p); } catch (e) { setError(e.message); } finally { setUnsharing(false); } }}>Stop sharing</button>}
        </div>)}
      <div style={{ ...cap, ...muted, marginTop: 4 }}>{[p.kind, p.area, p.refs, p.amount != null && `${gbp(p.amount)} (${p.amount >= threshold ? 'above' : 'below'} threshold)`].filter(Boolean).join(' · ')}</div>
      {p.basis && <div style={{ ...body, marginTop: 12 }}>{p.basis}</div>}
      {p.evidence && <div style={{ ...cap, marginTop: 8 }}><b>Evidence:</b> {p.evidence}</div>}
      {p.fix && <div style={{ ...cap, marginTop: 8 }}><b>Proposed correction:</b> {p.fix}</div>}
      {effects(p) && <div style={{ ...cap, marginTop: 8 }}><b>Effect:</b> {effects(p)}</div>}
      {p.missing && <div style={{ ...cap, marginTop: 8 }}><b>Information needed:</b> {p.missing}</div>}
      {p.follow && <div style={{ ...cap, marginTop: 8 }}><b>Suggested follow-up:</b> {p.follow}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 12, boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.08)', ...cap }}>
        <span><span style={muted}>Raised by</span> {p.raisedBy?.name || '—'} · {when(p.raisedAt)}</span>
        <label style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={muted}>Type</span>
          {canRaise && p.status !== 'cleared' && !locked
            ? <Select className="input" style={{ height: 30, width: 'auto', fontSize: 12 }} value={p.type} onChange={e => actions.meta(p, { type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
            : <b>{TYPES[p.type]}</b>}
        </label>
        <label style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={muted}>Due</span>
          {canRaise && p.status !== 'cleared' && !locked
            ? <input type="date" className="input" style={{ height: 30, width: 'auto', fontSize: 12 }} value={p.dueDate || ''} onChange={e => actions.meta(p, { dueDate: e.target.value || null })} aria-label="Due date" />
            : <b style={{ color: isOverdue(p) ? 'var(--pa-red)' : undefined }}>{p.dueDate ? dayLabel(p.dueDate) + (isOverdue(p) ? ' (overdue)' : '') : 'No due date'}</b>}
        </label>
        <label style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={muted}>Assigned to</span>
          {canRaise && p.status !== 'cleared'
            ? <Select className="input" style={{ height: 30, width: 'auto', fontSize: 12 }} value={p.assignedTo?.id || ''} onChange={e => actions.assign(p, e.target.value)}>
                <option value="">Not assigned</option>
                {p.assignedTo && !assignable.some(x => x.id === p.assignedTo.id) && <option value={p.assignedTo.id}>{p.assignedTo.name}</option>}
                {assignable.map(x => <option key={x.id} value={x.id}>{x.name} ({x.role})</option>)}
              </Select>
            : <b>{p.assignedTo?.name || 'Not assigned'}</b>}
        </label>
      </div>

      <ol aria-label="Thread" className="thread">
        {thread.map(m => (
          <li key={m.id} className={'msg is-' + m.kind}>
            <div aria-hidden="true" className="msg-avatar" style={{
              background: m.kind === 'note' ? 'var(--snow-ink-5)' : m.author?.role === 'Preparer' ? 'var(--snow-status-approved-bg)' : 'var(--snow-primary-purple)' }}>{m.kind === 'note' ? <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 8.5 L6.5 12 L13 4.5" /></svg> : initials(m.author?.name)}</div>
            <div className="msg-body">
              <div style={{ ...cap }}><b>{m.author?.name || 'StatementIQ'}</b>{m.author && <span style={muted}> · {m.author.role}</span>} <span style={muted}>· {when(m.at)}</span>{copyOf(m) && <span style={muted}> · in {fundNameOf(copyOf(m).engagementId)} {copyOf(m).ref}</span>} <Pill bg={m.kind === 'reopen' ? 'var(--snow-status-rejected-bg)' : m.kind === 'clear' ? 'var(--snow-status-complete-bg)' : m.kind === 'response' ? 'var(--snow-primary-blue)' : 'var(--snow-ink-5)'}>{KIND[m.kind]}</Pill></div>
              {m.text && <div style={{ ...body, marginTop: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</div>}
              {(m.attachments || []).length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {m.attachments.map((a, i) => a.type === 'version'
                    ? <span key={i} style={{ ...cap, background: 'var(--snow-primary-blue)', borderRadius: 6, padding: '3px 8px' }}>Revised {slotDefs.find(d => d.id === a.slot)?.name || a.slot} · v{a.version} · {a.fileName}{copyOf(m) ? ` (${fundNameOf(copyOf(m).engagementId)}’s document)` : ''}</span>
                    : <button key={i} type="button" className="link" style={{ ...cap, background: '#fff', borderRadius: 6, padding: '3px 8px', boxShadow: RING }}
                        onClick={async () => { const f = await reviewStore.fetchEvidence(a.id, a.fileName); if (f) saveFile(a.fileName, f); }} title="Download this evidence"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ marginRight: 4, verticalAlign: '-1px' }}><path d="M10.5 4.5 L5.2 9.8 a1.5 1.5 0 0 0 2.1 2.1 L13 6.2 a3 3 0 0 0 -4.2 -4.2 L3.2 7.6 a4.5 4.5 0 0 0 6.4 6.4 L13.5 10" /></svg>{a.fileName}</button>)}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div style={{ ...cap, ...muted, marginTop: 16 }}>{waiting}</div>
      {canRaise && !locked && (
        <div style={{ marginTop: 10 }}>
          <button type="button" className="link" style={cap} onClick={() => setSharing(true)}>{siblings.length ? 'Share with more funds' : 'Share with other funds'}</button>
        </div>)}
      {sharing && <ShareDialog p={p} engagementId={engagementId} have={[engagementId, ...siblings.map(x => x.engagementId)]} onShare={ids => actions.share(p, ids)} onClose={() => setSharing(false)} />}
      {buttons.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...cap, ...muted }}>{hint || 'Message'}</span>
            <textarea className="input" rows={3} aria-label="Message" style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} />
          </label>
          {responding && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--snow-primary-light)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', ...cap }}>
                <span style={{ fontWeight: 600 }}>Revised document<InfoTip label="About revised documents">A revised document becomes the next version of that document and is checked like any upload.</InfoTip></span>
                <Select className="input" aria-label="Document being revised" value={revSlot} onChange={e => { setRevSlot(e.target.value); setRevised(null); }} style={{ height: 32, width: 'auto', fontSize: 12 }}>
                  <option value="">None</option>{slotDefs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                {revSlot && (revised ? <span>{revised.name} <button type="button" className="link" aria-label="Remove revised file" onClick={() => setRevised(null)}>×</button></span>
                  : <FileButton label="Choose File" accept={ACCEPT[SLOT_RULES[revSlot]?.type]} onFile={f => setRevised(f)} />)}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', ...cap }}>
                <span style={{ fontWeight: 600 }}>Evidence<InfoTip label="About evidence">Evidence, such as a reconciliation or a custodian letter, is kept with this point.</InfoTip></span>
                {evidenceFiles.map((f, i) => <span key={i} style={{ background: '#fff', borderRadius: 6, padding: '2px 8px', boxShadow: RING }}>{f.name} <button type="button" className="link" aria-label={`Remove ${f.name}`} onClick={() => setEvidenceFiles(x => x.filter((_, j) => j !== i))}>×</button></span>)}
                <FileButton label="Add Evidence" accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.png,.jpg,.jpeg,.msg,.eml,.txt" onFile={f => setEvidenceFiles(x => [...x, f])} />
              </div>
            </div>
          )}
          {error && <div role="alert" style={{ ...cap, marginTop: 8, background: 'var(--snow-status-rejected-bg)', borderRadius: 8, padding: '8px 10px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>{buttons}</div>
        </div>
      )}
    </section>
  );
}

// Choose the related funds to share a point with: funds of the same group (entities with the same Client name and
// year end) that have no copy yet. Each gets its own copy (SP-1, SP-2 …), cleared in that fund.
function ShareDialog({ p, engagementId, have, onShare, onClose }) {
  const [funds, setFunds] = useState(null), [chosen, setChosen] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let gone = false;
    reviewStore.consolidatedGroups().then(r => {
      if (gone) return;
      const g = (r.groups || []).find(x => x.funds.some(f => f.engagementId === engagementId));
      setFunds(g ? g.funds.filter(f => !have.includes(f.engagementId)) : []);
    }, e => { if (!gone) { setError(e.message); setFunds([]); } });
    return () => { gone = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = id => setChosen(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]));
  const share = async () => {
    setBusy(true); setError('');
    try { await onShare(chosen); onClose(); } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal title={`Share ${p.ref} with other funds`} onClose={onClose} footer={<>
      <Button kind="secondary" onClick={onClose}>Cancel</Button>
      <Button disabled={busy || !chosen.length} onClick={share}>{busy ? 'Sharing…' : `Share with ${chosen.length || ''} fund${chosen.length === 1 ? '' : 's'}`.replace('  ', ' ')}</Button>
    </>}>
      <div style={{ ...cap, ...muted }}>Each fund gets its own copy to respond to and clear; comments show in one thread.</div>
      {funds === null && <div style={{ ...body, ...muted, marginTop: 12 }}>Loading…</div>}
      {funds && !funds.length && !error && <div style={{ ...body, marginTop: 12 }}>No other fund to share with. Points are shared between funds whose entities have the same Client name and year end.</div>}
      {funds && funds.length > 0 && (
        <div role="group" aria-label="Funds" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
          {funds.map(f => (
            <label key={f.engagementId} className={'share-fund' + (f.locked ? ' is-locked' : '')}>
              <input type="checkbox" disabled={f.locked} checked={chosen.includes(f.engagementId)} onChange={() => toggle(f.engagementId)} />
              <span style={{ minWidth: 0 }}><span style={body}>{f.fundName}</span><span style={{ ...cap, ...muted, display: 'block' }}>{f.entityName}{f.locked ? ' · signed off, so nothing can be added' : ''}</span></span>
            </label>))}
        </div>)}
      {error && <div role="alert" style={{ ...cap, marginTop: 12, background: 'var(--snow-status-rejected-bg)', borderRadius: 8, padding: '8px 10px' }}>{error}</div>}
    </Modal>
  );
}
