import React, { useEffect, useMemo, useState } from 'react';
import { gbp, fmt } from '../lib/format';
import { can, canClearPoint } from '../lib/roles';
import { Button, Card, Pill, PriPill, Segmented, FileButton, cap, body, h2, h3, muted, page, RING } from '../components/ui';
import { slotDefs } from '../data/sampleFund';
import { SLOT_RULES, ACCEPT } from '../lib/fileRules';
import { reviewStore } from '../lib/reviewStore';
import { saveFile } from '../lib/download';

const ST = { open: ['Open', 'var(--snow-status-approved-bg)'], responded: ['Responded', 'var(--snow-primary-blue)'], reopened: ['Reopened', 'rgba(255,71,71,0.14)'], cleared: ['Cleared', 'var(--snow-status-complete-bg)'] };
export const PointStatus = ({ status }) => <Pill bg={(ST[status] || ST.open)[1]}>{(ST[status] || ST.open)[0]}</Pill>;
export const TYPES = { change: 'Needs a change', explain: 'Needs an explanation', info: 'For information' };
const today = () => new Date().toISOString().slice(0, 10);
export const isOverdue = p => p.dueDate && p.status !== 'cleared' && p.dueDate < today();
const dayLabel = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const KIND = { raise: 'Raised', assign: 'Assigned', comment: 'Comment', response: 'Response', reopen: 'Reopened', clear: 'Cleared', note: 'App note' };
const when = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const initials = n => String(n || 'App').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

export default function ScheduleTab({ points, messages, user, people, sel, setSel, actions, waitingForMe, canRaise, canRespond, locked = false, threshold, version }) {
  const mine = points.filter(waitingForMe);
  const [view, setView] = useState(mine.length ? 'mine' : 'all');
  const [copied, setCopied] = useState(false);
  const rows = points.filter(p => view === 'all' ? true : view === 'mine' ? waitingForMe(p) : view === 'overdue' ? isOverdue(p) : view === 'preparer' ? ['open', 'reopened'].includes(p.status) : p.status === view);
  const overdueCount = points.filter(isOverdue).length;
  const current = points.find(p => p.ref === sel) || rows[0] || null;
  useEffect(() => { if (current && current.ref !== sel) setSel(current.ref); }, [current?.ref]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = s => points.filter(p => s === 'preparer' ? ['open', 'reopened'].includes(p.status) : p.status === s).length;

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
          <div style={{ ...cap, ...muted, marginTop: 4 }}>{points.length} points · {count('preparer')} with the preparer · {count('responded')} responded · {count('cleared')} cleared{version ? ` · draft v${version}` : ''} · threshold £{fmt(threshold)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmented value={view} onChange={setView} options={[['mine', `Waiting for Me (${mine.length})`], ['preparer', 'With Preparer'], ['responded', 'Responded'], ...(overdueCount ? [['overdue', `Overdue (${overdueCount})`]] : []), ['cleared', 'Cleared'], ['all', 'All']]} />
          <Button size="sm" kind="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy Schedule'}</Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div role="list" aria-label="Review points" style={{ flex: '1 1 380px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!rows.length && <Card><div style={{ ...body, ...muted }}>{view === 'mine' ? 'Nothing is waiting for you.' : 'No points in this view.'}</div></Card>}
          {rows.map(p => {
            const on = current?.ref === p.ref, last = messages.filter(m => m.pointId === p.id).slice(-1)[0];
            return (
              <button type="button" role="listitem" key={p.id} onClick={() => setSel(p.ref)} aria-current={on ? 'true' : undefined} className="point-row"
                style={{ textAlign: 'left', border: 0, font: 'inherit', cursor: 'pointer', background: on ? 'var(--snow-primary-light)' : '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: on ? 'inset 0 0 0 2px var(--snow-black-100)' : RING }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ ...body, fontWeight: 600 }}>{p.ref}</span><PriPill pri={p.pri} /><PointStatus status={p.status} />
                  {waitingForMe(p) && <Pill bg="var(--snow-black-100)"><span style={{ color: '#fff' }}>For you</span></Pill>}
                  {p.type !== 'change' && <Pill bg="var(--snow-ink-5)">{TYPES[p.type]}</Pill>}
                  {p.dueDate && p.status !== 'cleared' && <span style={{ ...cap, color: isOverdue(p) ? '#B42318' : 'var(--snow-black-40)', fontWeight: isOverdue(p) ? 600 : 400 }}>{isOverdue(p) ? 'Overdue · ' : 'Due '}{dayLabel(p.dueDate)}</span>}
                </div>
                <div style={{ ...body, marginTop: 6 }}>{p.title}</div>
                <div style={{ ...cap, ...muted, marginTop: 4 }}>{p.assignedTo ? `Assigned to ${p.assignedTo.name}` : 'Not assigned'} · {last ? `${KIND[last.kind].toLowerCase()} ${when(last.at)}` : when(p.raisedAt)}</div>
              </button>
            );
          })}
        </div>

        {current && <PointDetail key={current.id} p={current} thread={messages.filter(m => m.pointId === current.id)} user={user} people={people}
          actions={actions} canRaise={canRaise} canRespond={canRespond} locked={locked} threshold={threshold} />}
      </div>

      <div style={{ ...cap, ...muted, maxWidth: 900 }}>
        Prepared as assistance to the reviewer. The schedule records matters for follow-up; it is not an opinion, and it does not establish that the financial statements are complete or correct.
      </div>
    </div>
  );
}

function PointDetail({ p, thread, user, people, actions, canRaise, canRespond, locked, threshold }) {
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
  const waiting = locked ? 'The review is signed off and locked. A Manager can unlock it on the Sign-off tab.' : p.status === 'cleared' ? `Cleared by ${p.clearedBy?.name} · ${when(p.clearedAt)}.`
    : ['open', 'reopened'].includes(p.status) ? `Waiting for ${p.assignedTo?.name || 'a preparer'} to respond.`
    : `Waiting for ${p.raisedBy?.name || 'the reviewer'} (who raised it) or a Manager to clear or reopen it.`;
  const hint = ['open', 'reopened'].includes(p.status) && canRespond ? 'Explain what you changed or why no change is needed, then send your response.'
    : p.status === 'responded' && canClear ? 'Clear the point if the response is enough. To reopen, say what is still needed.'
    : p.status === 'cleared' && canClear ? 'To reopen this point, say why.' : '';

  return (
    <section aria-label={`${p.ref} detail`} style={{ flex: '1.4 1 520px', minWidth: 320, background: '#fff', borderRadius: 16, boxShadow: RING, padding: 24, position: 'sticky', top: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span style={h3}>{p.ref}</span><PriPill pri={p.pri} /><PointStatus status={p.status} />{p.aiDrafted && <Pill bg="#EEF1FB">Drafted by AI</Pill>}</div>
      <div style={{ ...h3, fontWeight: 600, marginTop: 8 }}>{p.title}</div>
      <div style={{ ...cap, ...muted, marginTop: 4 }}>{[p.area, p.refs, p.amount != null && `${gbp(p.amount)} (${p.amount >= threshold ? 'above' : 'below'} threshold)`].filter(Boolean).join(' · ')}</div>
      {p.basis && <div style={{ ...body, marginTop: 12 }}>{p.basis}</div>}
      {p.follow && <div style={{ ...cap, marginTop: 8 }}><b>Suggested follow-up:</b> {p.follow}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 12, boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.08)', ...cap }}>
        <span><span style={muted}>Raised by</span> {p.raisedBy?.name || '—'} · {when(p.raisedAt)}</span>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={muted}>Type</span>
          {canRaise && p.status !== 'cleared' && !locked
            ? <select className="input" style={{ height: 30, width: 'auto', fontSize: 12 }} value={p.type} onChange={e => actions.meta(p, { type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            : <b>{TYPES[p.type]}</b>}
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={muted}>Due</span>
          {canRaise && p.status !== 'cleared' && !locked
            ? <input type="date" className="input" style={{ height: 30, width: 'auto', fontSize: 12 }} value={p.dueDate || ''} onChange={e => actions.meta(p, { dueDate: e.target.value || null })} aria-label="Due date" />
            : <b style={{ color: isOverdue(p) ? '#B42318' : undefined }}>{p.dueDate ? dayLabel(p.dueDate) + (isOverdue(p) ? ' (overdue)' : '') : 'No due date'}</b>}
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={muted}>Assigned to</span>
          {canRaise && p.status !== 'cleared'
            ? <select className="input" style={{ height: 30, width: 'auto', fontSize: 12 }} value={p.assignedTo?.id || ''} onChange={e => actions.assign(p, e.target.value)}>
                <option value="">Not assigned</option>
                {p.assignedTo && !assignable.some(x => x.id === p.assignedTo.id) && <option value={p.assignedTo.id}>{p.assignedTo.name}</option>}
                {assignable.map(x => <option key={x.id} value={x.id}>{x.name} ({x.role})</option>)}
              </select>
            : <b>{p.assignedTo?.name || 'Not assigned'}</b>}
        </label>
      </div>

      <ol aria-label="Thread" style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {thread.map(m => (
          <li key={m.id} style={{ display: 'flex', gap: 10 }}>
            <div aria-hidden="true" style={{ width: 28, height: 28, flex: '0 0 auto', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 600,
              background: m.kind === 'note' ? 'var(--snow-ink-5)' : m.author?.role === 'Preparer' ? 'var(--snow-status-approved-bg)' : 'var(--snow-primary-purple)' }}>{m.kind === 'note' ? '⚙' : initials(m.author?.name)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ ...cap }}><b>{m.author?.name || 'FS Review'}</b>{m.author && <span style={muted}> · {m.author.role}</span>} <span style={muted}>· {when(m.at)}</span> <Pill bg={m.kind === 'reopen' ? 'rgba(255,71,71,0.12)' : m.kind === 'clear' ? 'var(--snow-status-complete-bg)' : m.kind === 'response' ? 'var(--snow-primary-blue)' : 'var(--snow-ink-5)'}>{KIND[m.kind]}</Pill></div>
              {m.text && <div style={{ ...body, marginTop: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</div>}
              {(m.attachments || []).length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {m.attachments.map((a, i) => a.type === 'version'
                    ? <span key={i} style={{ ...cap, background: 'var(--snow-primary-blue)', borderRadius: 6, padding: '3px 8px' }}>Revised {slotDefs.find(d => d.id === a.slot)?.name || a.slot} · v{a.version} · {a.fileName}</span>
                    : <button key={i} type="button" className="link" style={{ ...cap, background: '#fff', borderRadius: 6, padding: '3px 8px', boxShadow: RING }}
                        onClick={async () => { const f = await reviewStore.fetchEvidence(a.id, a.fileName); if (f) saveFile(a.fileName, f); }} title="Download this evidence">📎 {a.fileName}</button>)}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div style={{ ...cap, ...muted, marginTop: 16 }}>{waiting}</div>
      {buttons.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...cap, ...muted }}>{hint || 'Message'}</span>
            <textarea className="input" rows={3} aria-label="Message" style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} />
          </label>
          {responding && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--snow-primary-light)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', ...cap }}>
                <span style={{ fontWeight: 600 }}>Revised document</span>
                <select className="input" aria-label="Document being revised" value={revSlot} onChange={e => { setRevSlot(e.target.value); setRevised(null); }} style={{ height: 32, width: 'auto', fontSize: 12 }}>
                  <option value="">None</option>{slotDefs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {revSlot && (revised ? <span>{revised.name} <button type="button" className="link" aria-label="Remove revised file" onClick={() => setRevised(null)}>×</button></span>
                  : <FileButton label="Choose File" accept={ACCEPT[SLOT_RULES[revSlot]?.type]} onFile={f => setRevised(f)} />)}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', ...cap }}>
                <span style={{ fontWeight: 600 }}>Evidence</span>
                {evidenceFiles.map((f, i) => <span key={i} style={{ background: '#fff', borderRadius: 6, padding: '2px 8px', boxShadow: RING }}>{f.name} <button type="button" className="link" aria-label={`Remove ${f.name}`} onClick={() => setEvidenceFiles(x => x.filter((_, j) => j !== i))}>×</button></span>)}
                <FileButton label="Add Evidence" accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.png,.jpg,.jpeg,.msg,.eml,.txt" onFile={f => setEvidenceFiles(x => [...x, f])} />
              </div>
              <span style={{ ...cap, ...muted }}>A revised document becomes the next version of that document and is checked like any upload. Evidence, such as a reconciliation or a custodian letter, is kept with this point.</span>
            </div>
          )}
          {error && <div role="alert" style={{ ...cap, marginTop: 8, background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '8px 10px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>{buttons}</div>
        </div>
      )}
    </section>
  );
}
