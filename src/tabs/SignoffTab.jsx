import React, { useState } from 'react';
import { fmt } from '../lib/format';
import { slotDefs } from '../data/sampleFund';
import { Button, Card, CardHead, Pill, PriPill, cap, body, h2, muted, page, RING } from '../components/ui';
import { PointStatus } from './ScheduleTab';
import { contentChanges } from '../lib/reviewStore';

const when = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const slotName = id => slotDefs.find(d => d.id === id)?.name || id;
const STATE = {
  none: null,
  returned: ['Returned to reviewer', 'var(--snow-status-approved-bg)'],
  resubmitted: ['Resubmitted for sign-off', 'var(--snow-primary-blue)'],
  signed: ['Signed off', 'var(--snow-status-complete-bg)'],
  'manager-signed': ['Awaiting partner sign-off', 'var(--snow-primary-blue)'],
  unlocked: ['Unlocked after sign-off', 'var(--snow-status-approved-bg)']
};

// Works out what the Manager needs to see before signing off. Pure, so the summary saved with the
// sign-off is exactly what was on screen.
export function signoffSummary({ review, points, messages, checks, vm, checklist = null }) {
  const run = review.latestRun, cy = review.current.cy;
  const rows = points.map(p => {
    const thread = messages.filter(m => m.pointId === p.id);
    const responses = thread.filter(m => m.kind === 'response');
    return { ref: p.ref, pri: p.pri, title: p.title, status: p.status, clearedBy: p.clearedBy?.name || '', clearedAt: p.clearedAt,
      responses: responses.length, reopened: thread.filter(m => m.kind === 'reopen').length, lastResponse: responses.slice(-1)[0]?.text || '' };
  });
  const overrides = Object.values(review.current).filter(v => v.confirmation).map(v => ({ slot: v.slot, version: v.version, fileName: v.fileName, status: v.validation?.status, by: v.confirmation.by?.name, reason: v.confirmation.reason }));
  const differences = (checks || []).filter(c => c.result === 'Difference').map(c => ({ rule: c.rule, name: c.name, diff: c.diff }));
  const investigate = (vm?.rows || []).filter(r => r.band === 'Investigate' && !r.sub).map(r => r.label);
  const draftAnalysed = run ? !contentChanges(review, run).some(c => c.slot === 'cy') : false;
  const attention = [
    ...rows.filter(r => r.status === 'cleared' && r.responses === 0 && r.pri === 'High').map(r => `${r.ref} (High) was cleared without a response from the preparer.`),
    ...overrides.map(o => `${slotName(o.slot)} v${o.version} was confirmed despite a ${o.status === 'mismatch' ? 'mismatch' : 'check'}${o.reason ? `: “${o.reason}”` : ''}.`),
    ...(!draftAnalysed && cy ? [`The latest draft (v${cy.version}) was attached after the last analysis; it has not been analysed.`] : []),
    ...(differences.length ? [`${differences.length} check${differences.length === 1 ? '' : 's'} still show a difference in the latest analysis.`] : []),
    ...(investigate.length ? [`${investigate.length} variance${investigate.length === 1 ? ' is' : 's are'} still marked to investigate.`] : [])
  ];
  const notCleared = rows.filter(r => r.status !== 'cleared');
  const blockers = [
    ...(!run ? ['The analysis has not been run.'] : []),
    ...(review.workflow.state !== 'ready' ? ['The documents are not marked ready for review.'] : []),
    ...(notCleared.length ? [`${notCleared.length} review point${notCleared.length === 1 ? ' is' : 's are'} not cleared (${notCleared.map(r => r.ref).join(', ')}).`] : []),
    ...(checklist && !checklist.available ? ['The disclosure checklist is on, but the client’s accounting framework isn’t set.'] : []),
    ...(checklist && checklist.available && checklist.unanswered ? [`The disclosure checklist has ${checklist.unanswered} item${checklist.unanswered === 1 ? '' : 's'} not answered.`] : []),
    ...(review.signoff?.state === 'returned' ? ['The review was returned to the reviewer and has not been resubmitted.'] : [])
  ];
  return { rows, overrides, differences, investigate, draftAnalysed, attention, blockers, run: run ? { version: run.version, by: run.by?.name, at: run.at } : null };
}

export default function SignoffTab({ reports = [], reportActions, review, summary, canSignoff, canResubmit, actions, partnerRequired = false, canPartner = false }) {
  const s = review.signoff, awaitingPartner = s.state === 'manager-signed', signed = s.state === 'signed' || awaitingPartner;
  const [text, setText] = useState(''), [ack, setAck] = useState(false), [busy, setBusy] = useState(false);
  const ready = !summary.blockers.length && !signed;
  const go = fn => async () => { setBusy(true); await fn(text.trim()); setText(''); setAck(false); setBusy(false); };
  const has = text.trim().length >= 5;
  const st = STATE[s.state];

  return (
    <div style={page}>
      <div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><div style={h2}>Sign-off</div>{st && <Pill bg={st[1]}>{st[0]}</Pill>}</div>
        <div style={{ ...body, ...muted, marginTop: 6, maxWidth: 760 }}>{partnerRequired ? 'The Manager signs off first, which locks the engagement; the Partner then gives the final sign-off or returns it.' : 'The Manager’s final review: the cleared points, document overrides, the draft that was analysed and anything still showing in the analysis. Signing off locks the engagement.'}</div>
      </div>

      <div role="status" style={{ ...body, borderRadius: 12, padding: '14px 18px', background: signed ? 'var(--snow-status-complete-bg)' : ready ? 'var(--snow-primary-blue)' : 'var(--snow-status-approved-bg)' }}>
        {awaitingPartner ? <>Signed off by the Manager, <b>{s.by?.name}</b>, on {when(s.at)}. The engagement is locked and waiting for the Partner’s sign-off.<div style={{ marginTop: 6 }}>“{s.text}”</div></>
          : signed ? <>Signed off by <b>{s.by?.name}</b> on {when(s.at)}{partnerRequired ? ' (Partner sign-off)' : ''}. The engagement is locked.<div style={{ marginTop: 6 }}>“{s.text}”</div></>
          : ready ? <>Ready for Manager sign-off. All {summary.rows.length} review points are cleared.</>
          : <>Not ready for sign-off yet:<ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{summary.blockers.map(b => <li key={b}>{b}</li>)}</ul></>}
        {s.state === 'returned' && <div style={{ marginTop: 8 }}>Returned to the reviewer by <b>{s.by?.name}</b> on {when(s.at)}: “{s.text}”</div>}
        {s.state === 'resubmitted' && <div style={{ marginTop: 8 }}>Resubmitted by <b>{s.by?.name}</b> on {when(s.at)}{s.text ? `: “${s.text}”` : ''}.</div>}
      </div>

      {summary.attention.length > 0 && (
        <Card>
          <CardHead title="Needs Your Attention" aside={`${summary.attention.length} item${summary.attention.length === 1 ? '' : 's'}`} />
          <ul style={{ ...body, margin: '10px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>{summary.attention.map(a => <li key={a}>{a}</li>)}</ul>
          <div style={{ ...cap, ...muted, marginTop: 10 }}>These don’t block sign-off, but you confirm you have considered them when you sign.</div>
        </Card>
      )}

      <Card>
        <CardHead title="Review Points" aside={`${summary.rows.filter(r => r.status === 'cleared').length} of ${summary.rows.length} cleared`} />
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '78px minmax(240px,2fr) 110px 150px 90px minmax(220px,2fr)', gap: 12, padding: '8px 4px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)', minWidth: 940 }}>
            {['Point', 'Title', 'Status', 'Cleared by', 'Rounds', 'Last response'].map(c => <div key={c} style={{ ...cap, ...muted }}>{c}</div>)}
          </div>
          {summary.rows.map(r => (
            <div key={r.ref} style={{ display: 'grid', gridTemplateColumns: '78px minmax(240px,2fr) 110px 150px 90px minmax(220px,2fr)', gap: 12, padding: '10px 4px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)', minWidth: 940, alignItems: 'start' }}>
              <div><div style={{ ...body, fontWeight: 600 }}>{r.ref}</div><PriPill pri={r.pri} /></div>
              <div style={body}>{r.title}</div>
              <div><PointStatus status={r.status} /></div>
              <div style={cap}>{r.clearedBy || '—'}<div style={muted}>{when(r.clearedAt)}</div></div>
              <div style={cap}>{r.responses} response{r.responses === 1 ? '' : 's'}{r.reopened ? `, ${r.reopened} reopened` : ''}</div>
              <div style={{ ...cap, ...muted, overflowWrap: 'anywhere' }}>{r.lastResponse || (r.status === 'cleared' ? 'Cleared without a response.' : '—')}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <Card style={{ flex: '1 1 360px' }}>
          <CardHead title="Documents" />
          <ul style={{ ...cap, listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {slotDefs.map(d => { const v = review.current[d.id]; return (
              <li key={d.id}><b>{d.name}</b>: {v ? `v${v.version} · ${v.fileName}${v.sample ? ' (sample)' : ''}${v.confirmation ? ` · confirmed by ${v.confirmation.by?.name}` : ''}` : <span style={muted}>not attached</span>}</li>); })}
          </ul>
        </Card>
        <Card style={{ flex: '1 1 360px' }}>
          <CardHead title="Latest Analysis" />
          {summary.run ? (
            <div style={{ ...cap, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>Draft v{summary.run.version} analysed by {summary.run.by} on {when(summary.run.at)}.</div>
              <div>{summary.draftAnalysed ? '✓ The latest draft was analysed.' : '! A newer draft has been attached since; it was not analysed.'}</div>
              <div>{summary.differences.length ? `${summary.differences.length} check${summary.differences.length === 1 ? '' : 's'} still show a difference: ${summary.differences.map(d => `${d.name} (£${fmt(Math.abs(d.diff))})`).join('; ')}.` : '✓ No checks show a difference.'}</div>
              <div>{summary.investigate.length ? `${summary.investigate.length} variance${summary.investigate.length === 1 ? '' : 's'} marked to investigate: ${summary.investigate.join(', ')}.` : '✓ No variances are marked to investigate.'}</div>
            </div>
          ) : <div style={{ ...cap, ...muted, marginTop: 10 }}>No analysis has been run.</div>}
        </Card>
      </div>

      <Card>
        <CardHead title="Review Report" />
        <div style={{ ...cap, ...muted, marginTop: 6 }}>The permanent record of this review: documents and their fingerprints, checks, every point with its thread, the disclosure checklist, the sign-offs and the use of AI. It is made at the final sign-off{partnerRequired ? ' (the Partner’s)' : ''}; a new version is made each time the review is signed off again.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {reports.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', ...cap }}>
              <b>Version {r.version}</b><span>signed off by {r.signedBy?.name || '—'} · {when(r.signedAt || r.at)}</span><span style={{ ...muted }}>SHA-256 {r.sha256.slice(0, 12)}…</span>
              <Button size="sm" kind="secondary" onClick={() => reportActions.download(r)}>Download PDF</Button>
            </div>))}
          {!reports.length && <span style={{ ...cap }}>No report yet: it is made when the review is signed off.</span>}
          <span><Button size="sm" kind="secondary" onClick={() => reportActions.draft()}>Download Draft Report</Button></span>
        </div>
      </Card>
      <Card>
        <CardHead title={awaitingPartner && canPartner ? 'Partner Decision' : signed ? 'Unlock' : 'Your Decision'} />
        {awaitingPartner && canPartner ? (
          <Decision label="Partner conclusion (required to sign off; also used as the reason when returning)" text={text} setText={setText}>
            <Button disabled={busy || !has} onClick={go(actions.partnerSignOff)}>Partner Sign-off</Button>
            <Button kind="secondary" disabled={busy || !has} onClick={go(actions.returnToReviewer)}>Return to Reviewer</Button>
          </Decision>
        ) : signed ? (
          canSignoff ? <Decision label="Why does this need to be unlocked? (required)" text={text} setText={setText}>
            <Button kind="secondary" disabled={busy || !has} onClick={go(actions.unlock)}>Unlock Engagement</Button>
          </Decision> : <div style={{ ...cap, ...muted, marginTop: 8 }}>Only someone whose role may sign off can unlock the engagement.</div>
        ) : canSignoff ? (
          <Decision label={ready ? 'Conclusion (required for sign-off; also used as the reason when returning)' : 'Reason for returning to the reviewer'} text={text} setText={setText}>
            {ready && summary.attention.length > 0 && (
              <label style={{ ...cap, display: 'flex', gap: 8, alignItems: 'center', flexBasis: '100%' }}>
                <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} /> I have considered the {summary.attention.length} item{summary.attention.length === 1 ? '' : 's'} needing attention.
              </label>
            )}
            <Button disabled={busy || !ready || !has || (summary.attention.length > 0 && !ack)} onClick={go(actions.signOff)}>{partnerRequired ? 'Sign Off (Manager)' : 'Sign Off'}</Button>
            <Button kind="secondary" disabled={busy || !has} onClick={go(actions.returnToReviewer)}>Return to Reviewer</Button>
          </Decision>
        ) : s.state === 'returned' && canResubmit ? (
          <Decision label="What was done? (optional)" text={text} setText={setText}>
            <Button disabled={busy} onClick={go(actions.resubmit)}>Resubmit for Sign-off</Button>
          </Decision>
        ) : <div style={{ ...cap, ...muted, marginTop: 8 }}>{ready ? 'Waiting for a Manager to sign off.' : 'Sign-off becomes available to the Manager once the items above are resolved.'}</div>}
      </Card>

      {s.history?.length > 0 && (
        <Card>
          <CardHead title="Sign-off History" />
          <ul style={{ ...cap, listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {s.history.slice().reverse().map((h, i) => <li key={i}><b>{(STATE[h.state] || ['—'])[0]}</b> by {h.by?.name} · {when(h.at)}{h.text ? `: “${h.text}”` : ''}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}

const Decision = ({ label, text, setText, children }) => (
  <div style={{ marginTop: 10 }}>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ ...cap, ...muted }}>{label}</span>
      <textarea className="input" rows={3} aria-label="Decision note" style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} />
    </label>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>{children}</div>
  </div>
);
