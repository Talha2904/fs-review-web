import React, { useState } from 'react';
import { slotDefs, steps } from '../data/sampleFund';
import { Button, FileButton, Pill, Dot, cap, body, h2, h3, muted, page, RING } from '../components/ui';
import Modal from '../components/Modal';
import { SLOT_RULES, ACCEPT } from '../lib/fileRules';
import { validateFile } from '../lib/validateFile';
import { isCleared } from '../lib/reviewStore';

const STATUS = {
  checking: ['Checking…', 'var(--snow-ink-5)'],
  recognised: ['Recognised', 'var(--snow-status-complete-bg)'],
  check: ['Needs a check', 'var(--snow-status-approved-bg)'],
  mismatch: ['Mismatch', 'rgba(255,71,71,0.14)'],
  sample: ['Sample', 'var(--snow-ink-5)']
};
const ICON = { ok: ['✓', '#2E6B12'], warn: ['!', '#8A5A00'], fail: ['✕', '#B42318'] };
const WF = { preparing: ['Preparing', 'var(--snow-ink-5)'], ready: ['Ready for review', 'var(--snow-status-complete-bg)'], returned: ['Sent back to preparer', 'var(--snow-status-approved-bg)'] };
const when = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export default function DocumentsTab({ aiForReading = false, aiWhyNot = '', onReadWithAi, umbrella = null, onCopyUmbrella, files, review, editable, canConfirm = false, signed = false, canSendBack, onConfirm, onMarkReady, onSendBack, attach, detach, attachAll, ready, phase, step, error, analysisSub, onAnalyse, rerun = { blocked: false, changes: [] }, blockedReason = '', canRun = true, canAttach = true, role, onRejected }) {
  const [problems, setProblems] = useState({}); // slot id -> why the last file was refused before upload
  const [infos, setInfos] = useState({});       // slot id -> note from the last upload (e.g. same content)
  const [confirming, setConfirming] = useState(null); // version being confirmed
  const [sendingBack, setSendingBack] = useState(false);
  const tryAttach = async (d, file) => {
    const why = await validateFile(d.id, file, d.name);
    setProblems(p => ({ ...p, [d.id]: why }));
    if (why) { onRejected?.(d, file, why); return; }
    setInfos(p => ({ ...p, [d.id]: '' }));
    const note = await attach(d.id, { name: file.name, file, sample: false });
    setInfos(p => ({ ...p, [d.id]: note || '' }));
  };
  const useSample = async d => { setProblems(p => ({ ...p, [d.id]: '' })); const note = await attach(d.id, { name: d.sample, sample: true }); setInfos(p => ({ ...p, [d.id]: note || '' })); };

  const wf = review.workflow, current = review.current;
  const required = slotDefs.filter(d => d.kind === 'Required');
  const blockers = [
    ...required.filter(d => !current[d.id]).map(d => `${d.name} is not attached.`),
    ...slotDefs.filter(d => current[d.id]?.validation?.status === 'checking').map(d => `${d.name} is still being checked.`),
    ...slotDefs.filter(d => current[d.id] && current[d.id].validation?.status !== 'checking' && !isCleared(current[d.id])).map(d => `${d.name} needs to be confirmed or replaced.`)
  ];

  const running = phase === 'running', done = phase === 'done';
  const heading = running ? 'Analysing the File' : done ? 'Analysis Complete' : ready ? 'Run the Analysis' : wf.state === 'ready' ? 'Documents Ready' : 'Prepare the Documents to Continue';
  const sub = running ? 'Casting the statements, agreeing the notes to supporting schedules and comparing narrative with last year.'
    : done ? analysisSub
    : ready ? (current.sup ? 'All documents are checked and marked ready for review.' : 'The four required documents are checked and marked ready. Without supporting information, movement explanations cannot be corroborated.')
    : 'The analysis runs once the documents are attached, checked and marked ready for review.';

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 660 }}>
          <div style={h2}>Documents</div>
          <div style={{ ...body, ...muted, marginTop: 6 }}>Attach each document. The app checks that it is the right document for this fund and year end, without using AI. Then mark the documents ready for review.</div>
        </div>
        {editable ? <Button kind="secondary" onClick={attachAll}>Use All Sample Documents</Button>
          : <span style={{ ...cap, ...muted, maxWidth: 280 }}>{signed ? 'The review is signed off; documents are locked.' : !canAttach ? 'Your role cannot attach documents.' : 'The documents are locked while marked ready for review.'}</span>}
      </div>

      {umbrella && (
        <div role="status" style={{ ...body, background: 'var(--snow-primary-blue)', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span><b>Umbrella accounts.</b> {umbrella.entity}’s draft, signed accounts and supporting information cover all its funds; this fund’s figures are read from its own column or section, <b>“{umbrella.name}”</b>. The trial balance and investment schedule are this fund’s own.</span>
          {umbrella.sources.map(s => (
            <span key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', ...cap }}>
              <span>{s.name} has {s.versions.join(', ')}{s.versions.length ? ' not attached here' : ''}.</span>
              {editable && <Button size="sm" onClick={() => onCopyUmbrella(s)}>Use These Umbrella Documents</Button>}
            </span>))}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {slotDefs.map(d => {
          const v = current[d.id], earlier = review.versions.filter(x => x.slot === d.id && x.id !== v?.id).reverse();
          const st = v ? (v.confirmation ? ['Confirmed', 'var(--snow-status-complete-bg)'] : v.readWith === 'ai' ? ['Read by AI', 'var(--snow-primary-blue)'] : STATUS[v.validation?.status] || STATUS.checking) : null;
          return (
            <section key={d.id} aria-label={d.name}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file && editable) tryAttach(d, file); }}
              style={{ flex: '1 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', background: v ? 'var(--snow-primary-light)' : '#fff', borderRadius: 16, boxShadow: v ? 'none' : RING, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ ...cap, ...muted }}>{d.kind}</span>
                {st ? <Pill bg={st[1]}>{st[0]}</Pill> : <Pill bg={d.kind === 'Optional' ? 'var(--snow-ink-5)' : 'var(--snow-status-approved-bg)'}>{d.kind === 'Optional' ? 'Optional' : 'Needed'}</Pill>}
              </div>
              <div style={{ ...h3, marginTop: 12 }}>{d.name}</div>
              <div style={{ ...body, ...muted, marginTop: 4 }}>{d.desc}</div>
              <div style={{ ...cap, ...muted, marginTop: 6 }}>Accepts: <b style={{ color: 'var(--snow-black-80)' }}>{SLOT_RULES[d.id]?.label || 'any file'}</b></div>
              {infos[d.id] && <div role="status" style={{ ...cap, marginTop: 10, background: 'var(--snow-primary-blue)', borderRadius: 8, padding: '8px 10px' }}>{infos[d.id]}</div>}
              {problems[d.id] && <div role="alert" style={{ ...cap, marginTop: 10, background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '8px 10px' }}>{problems[d.id]}</div>}

              {v ? (
                <>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 14, padding: '8px 12px', background: '#fff', borderRadius: 8, boxShadow: RING }}>
                    <span style={{ ...cap, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>v{v.version}</b> · {v.fileName}{v.sameAs ? ` · same content as v${v.sameAs}` : ''}</span>
                    {editable && <button type="button" className="link" aria-label={`Remove ${d.name}`} onClick={() => detach(d.id)} style={{ ...body, ...muted, padding: '0 4px' }}>×</button>}
                  </div>
                  <div style={{ ...cap, ...muted, marginTop: 6 }}>Uploaded by {v.uploadedBy?.name || '—'} · {when(v.uploadedAt)}</div>

                  {v.validation?.checks?.length > 0 && (
                    <ul aria-label={`Checks for ${d.name}`} style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {v.validation.checks.map((c, i) => (
                        <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', ...cap }}>
                          <span aria-hidden="true" style={{ width: 16, flex: '0 0 auto', textAlign: 'center', fontWeight: 700, color: ICON[c.result][0] && ICON[c.result][1] }}>{ICON[c.result][0]}</span>
                          <span><span className="sr-only">{c.result === 'ok' ? 'Passed: ' : c.result === 'warn' ? 'Check: ' : 'Problem: '}</span>{c.detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {v.validation?.status === 'sample' && <div style={{ ...cap, ...muted, marginTop: 10 }}>Built-in sample document; not checked.</div>}
                  {v.validation?.status === 'checking' && <div role="status" style={{ ...cap, ...muted, marginTop: 10 }}>Reading the file and checking it…</div>}

                  {v.validation?.ocrLow && !v.confirmation && (
                    <div role="status" style={{ ...cap, marginTop: 10, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {v.readWith === 'ai'
                        ? <span><b>Will be read by AI</b>, chosen by {v.readWithBy?.name} because the OCR confidence was {v.validation.ocrLow}%.</span>
                        : <>
                          <span><b>Low OCR confidence ({v.validation.ocrLow}%).</b> {aiForReading ? 'Read it with AI instead, keep the OCR reading (Confirm Anyway), or replace it with a clearer scan.' : `AI can’t be used here: ${(aiWhyNot || 'AI is not available').split('.')[0]}. Keep the OCR reading (Confirm Anyway), or replace it with a clearer scan.`}</span>
                          {aiForReading && (editable || canConfirm) && <span><Button size="sm" onClick={() => onReadWithAi(v)}>Read with AI</Button></span>}
                        </>}
                    </div>
                  )}
                  {v.confirmation ? (
                    <div style={{ ...cap, marginTop: 10, background: '#fff', borderRadius: 8, padding: '8px 10px', boxShadow: RING }}>
                      Confirmed by <b>{v.confirmation.by?.name}</b> · {when(v.confirmation.at)}{v.confirmation.reason ? <>: “{v.confirmation.reason}”</> : ''}
                    </div>
                  ) : ['check', 'mismatch'].includes(v.validation?.status) && (editable || canConfirm) ? (
                    // confirming changes no document, so it stays available while the documents are locked
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      {editable && <FileButton label="Replace File" accept={ACCEPT[SLOT_RULES[d.id]?.type]} onFile={file => tryAttach(d, file)} />}
                      <Button kind="secondary" onClick={() => setConfirming(v)}>Confirm Anyway</Button>
                    </div>
                  ) : null}
                  {editable && isCleared(v) && !['check', 'mismatch'].includes(v.validation?.status) && (
                    <div style={{ marginTop: 12 }}><FileButton label="Replace File" accept={ACCEPT[SLOT_RULES[d.id]?.type]} onFile={file => tryAttach(d, file)} /></div>
                  )}

                  {earlier.length > 0 && (
                    <details style={{ marginTop: 12 }}>
                      <summary style={{ ...cap, ...muted, cursor: 'pointer' }}>Earlier versions ({earlier.length})</summary>
                      <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {earlier.map(x => (
                          <li key={x.id} style={{ ...cap, ...muted }}>v{x.version} · {x.fileName}{x.sameAs ? ` (same content as v${x.sameAs})` : ''} · {x.uploadedBy?.name} · {when(x.uploadedAt)} · {x.removedAt ? 'removed' : x.confirmation ? 'confirmed' : (STATUS[x.validation?.status] || STATUS.checking)[0].toLowerCase()}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              ) : !editable ? <div style={{ ...cap, ...muted, marginTop: 16 }}>Not attached yet.</div> : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                  <FileButton label="Attach File" accept={ACCEPT[SLOT_RULES[d.id]?.type]} onFile={file => tryAttach(d, file)} />
                  <Button kind="secondary" onClick={() => useSample(d)}>Sample</Button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section aria-label="Document readiness" style={{ background: '#fff', borderRadius: 16, boxShadow: RING, padding: 24, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 640 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><div style={h3}>Ready for Review</div><Pill bg={WF[wf.state][1]}>{WF[wf.state][0]}</Pill></div>
          {wf.state === 'ready' && <div style={{ ...body, marginTop: 6 }}>Marked ready by <b>{wf.by?.name}</b> · {when(wf.at)}. The documents are locked; send them back to change them.</div>}
          {wf.state === 'returned' && <div style={{ ...body, marginTop: 6, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '8px 12px' }}>Sent back by <b>{wf.by?.name}</b> · {when(wf.at)}: “{wf.reason}”</div>}
          {wf.state !== 'ready' && (blockers.length
            ? <ul style={{ ...cap, margin: '10px 0 0', paddingLeft: 18 }}>{blockers.map(b => <li key={b}>{b}</li>)}</ul>
            : <div style={{ ...body, ...muted, marginTop: 6 }}>Every document has passed its checks or been confirmed.</div>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {wf.state !== 'ready' && canAttach && <Button disabled={blockers.length > 0} onClick={onMarkReady}>Mark Ready for Review</Button>}
          {wf.state === 'ready' && canSendBack && !running && <Button kind="secondary" onClick={() => setSendingBack(true)}>Send Back to Preparer</Button>}
        </div>
      </section>

      <div style={{ background: 'var(--snow-primary-blue)', borderRadius: 16, padding: 24, display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 560 }}>
          <div style={h3}>{heading}</div>
          <div style={{ ...body, marginTop: 6 }}>{sub}</div>
          {done && !signed && (rerun.blocked
            ? <div role="status" style={{ ...cap, marginTop: 8, background: '#fff', padding: '8px 12px', borderRadius: 8 }}>Already analysed on {rerun.at}. No document has changed since, so the analysis can’t be run again. Replace a document to run it again.</div>
            : <div role="status" style={{ ...cap, marginTop: 8, background: '#fff', padding: '8px 12px', borderRadius: 8 }}>Documents changed since the last analysis: {rerun.changes.join('; ')}.</div>)}
          {blockedReason && !signed && <div role="status" style={{ ...cap, marginTop: 8, background: 'var(--snow-status-approved-bg)', padding: '8px 12px', borderRadius: 8 }}>{blockedReason}</div>}
          {signed ? <div style={{ ...cap, marginTop: 8, background: '#fff', padding: '8px 12px', borderRadius: 8 }}>The review is signed off and locked. A Manager can unlock it on the Sign-off tab.</div>
            : !canRun && <div style={{ ...cap, marginTop: 8, background: '#fff', padding: '8px 12px', borderRadius: 8 }}>Your role ({role}) cannot run the analysis. Ask someone whose role can.</div>}
          {error && <div style={{ ...cap, marginTop: 8, background: 'rgba(255,71,71,0.1)', padding: '8px 12px', borderRadius: 8 }}>The analysis stopped: {error}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 260 }}>
          {running && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {steps.map((s, i) => (
                <div key={s} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Dot c={i < step ? 'var(--snow-status-complete)' : 'var(--snow-black-20)'} />
                  <span style={{ ...cap, color: i < step ? 'var(--snow-black-100)' : 'var(--snow-black-40)' }}>{s}</span>
                </div>
              ))}
            </div>
          )}
          <Button size="lg" disabled={!ready || running || !canRun || (done && rerun.blocked) || !!blockedReason} onClick={onAnalyse}>{running ? 'Analysing…' : done ? 'Run the Analysis Again' : 'Analyse'}</Button>
        </div>
      </div>

      {confirming && <ConfirmModal v={confirming} name={slotDefs.find(d => d.id === confirming.slot)?.name} onClose={() => setConfirming(null)} onConfirm={async reason => { await onConfirm(confirming, reason); setConfirming(null); }} />}
      {sendingBack && <ReasonModal title="Send back to the preparer" label="What needs to change?" button="Send Back" onClose={() => setSendingBack(false)} onSubmit={async r => { await onSendBack(r); setSendingBack(false); }} />}
    </div>
  );
}

function ConfirmModal({ v, name, onClose, onConfirm }) {
  const mismatch = v.validation.status === 'mismatch';
  return (
    <ReasonModal title={`Confirm the ${name}`} required={mismatch} button="Confirm Document" onClose={onClose} onSubmit={onConfirm}
      label={mismatch ? 'Why is this the right document? (required)' : 'Note (optional)'}
      intro={<>
        <div style={{ ...body }}>{v.fileName} · v{v.version}</div>
        <ul style={{ ...cap, margin: '8px 0 0', paddingLeft: 18 }}>{v.validation.checks.filter(c => c.result !== 'ok').map((c, i) => <li key={i}>{c.detail}</li>)}</ul>
        <div style={{ ...cap, ...muted, marginTop: 8 }}>Confirming records your name and reason in the activity log.</div>
      </>} />
  );
}

function ReasonModal({ title, label, button, required = true, intro, onClose, onSubmit }) {
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
  const ok = !required || reason.trim().length >= 5;
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={async e => { e.preventDefault(); if (!ok) return; setBusy(true); await onSubmit(reason.trim()); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {intro}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ ...cap, ...muted }}>{label}</span>
          <textarea className="input" rows={3} style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }} value={reason} onChange={e => setReason(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button kind="secondary" onClick={onClose}>Cancel</Button>
          <button type="submit" className="btn btn-primary" style={{ height: 36, padding: '0 16px' }} disabled={busy || !ok}>{busy ? 'Saving…' : button}</button>
        </div>
      </form>
    </Modal>
  );
}
