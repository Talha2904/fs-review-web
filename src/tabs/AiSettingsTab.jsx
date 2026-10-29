import React, { useEffect, useState } from 'react';
import { AI_STEPS, MODELS, normalizeAi } from '../lib/aiOptions';
import { Button, Card, CardHead, Pill, cap, body, h2, muted, page } from '../components/ui';

const when = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export default function AiSettingsTab({ auth, me }) {
  const [saved, setSaved] = useState(null), [key, setKey] = useState(null), [draft, setDraft] = useState(null);
  const [msg, setMsg] = useState({ kind: '', text: '' }), [busy, setBusy] = useState(false), [test, setTest] = useState(null);
  const [policy, setPolicy] = useState(false);

  const load = () => auth.getAiSettings().then(r => { setSaved(r.settings); setDraft(r.settings); setKey(r.key); setPolicy(!!r.settings.acknowledgement); })
    .catch(e => setMsg({ kind: 'err', text: e.message }));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!draft) return <div style={page}><div style={h2}>AI Settings</div><div style={{ ...body, ...muted }}>{msg.text || 'Loading…'}</div></div>;

  const set = patch => { setDraft(d => ({ ...d, ...patch })); setMsg({ kind: '', text: '' }); };
  const view = (x, ack) => JSON.stringify({ on: !!x.enabled && ack, steps: x.steps, model: x.model, ack });
  const dirty = view(draft, policy) !== view(saved, !!saved.acknowledgement);
  async function save() {
    setBusy(true);
    try {
      const ack = policy ? (saved.acknowledgement && !saved.acknowledgement.pending ? saved.acknowledgement : { by: me.name, userId: me.id, at: new Date().toISOString() }) : null;
      const r = await auth.saveAiSettings({ ...draft, enabled: draft.enabled && policy, acknowledgement: ack });
      setSaved(r.settings); setDraft(r.settings); setKey(r.key); setMsg({ kind: 'ok', text: 'AI settings saved. They apply to the next analysis.' });
    } catch (e) { setMsg({ kind: 'err', text: `Not saved: ${e.message}` }); }
    finally { setBusy(false); }
  }
  async function runTest() {
    setTest({ state: 'running' });
    try { const r = await auth.testAi(); setTest({ state: 'ok', text: `Connected. ${r.model} answered in ${r.ms} ms.` }); }
    catch (e) { setTest({ state: 'err', text: e.message }); }
  }
  const status = !key?.configured ? ['No API key on the server', 'rgba(255,71,71,0.12)']
    : saved.enabled ? ['AI is on', 'var(--snow-status-complete-bg)'] : ['AI is off', 'var(--snow-status-approved-bg)'];

  return (
    <div style={page}>
      <div style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><div style={h2}>AI Settings</div><Pill bg={status[1]}>{status[0]}</Pill></div>
        <div style={{ ...body, ...muted, marginTop: 6 }}>Control where the app uses AI (Claude). Every number is still recalculated by the app’s own code, and every point is cleared by a person; AI reads documents and drafts text. Every AI call is recorded in the Activity Log.</div>
      </div>
      {msg.text && <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ ...cap, borderRadius: 8, padding: '10px 14px', background: msg.kind === 'err' ? 'rgba(255,71,71,0.1)' : 'var(--snow-status-complete-bg)' }}>{msg.text}</div>}

      <Card>
        <CardHead title="Connection" />
        <div style={{ ...body, marginTop: 10 }}>
          API key: {key?.configured ? <><b>configured on the server</b> <span style={muted}>(ending …{key.last4})</span></> : <b>not configured</b>}
        </div>
        <div style={{ ...cap, ...muted, marginTop: 6, maxWidth: 720 }}>The key is never entered or shown in the app. It is set on the server as <code>ANTHROPIC_API_KEY</code> (in <code>.env</code> or your hosting provider’s secret settings), and only its last four characters are displayed here.</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
          <Button kind="secondary" disabled={test?.state === 'running'} onClick={runTest}>{test?.state === 'running' ? 'Testing…' : 'Test Connection'}</Button>
          {test && test.state !== 'running' && <span role={test.state === 'err' ? 'alert' : 'status'} style={{ ...cap, color: test.state === 'err' ? '#B42318' : '#2E6B12' }}>{test.text}</span>}
        </div>
      </Card>

      <Card>
        <CardHead title="Use of AI" />
        <label style={{ ...body, display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer' }}>
          <input type="checkbox" className="perm-check" checked={policy} onChange={e => { setPolicy(e.target.checked); if (!e.target.checked) set({ enabled: false }); }} />
          <span>Our firm’s policy allows client documents and figures to be sent to Anthropic for processing by Claude, for clients that have not opted out.
            {saved.acknowledgement && !saved.acknowledgement.pending && <span style={{ ...cap, ...muted, display: 'block', marginTop: 2 }}>Confirmed by {saved.acknowledgement.by} · {when(saved.acknowledgement.at)}</span>}</span>
        </label>
        <label style={{ ...body, display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, cursor: policy ? 'pointer' : 'default', opacity: policy ? 1 : 0.55 }}>
          <button type="button" role="switch" aria-checked={draft.enabled && policy} disabled={!policy} className={'switch' + (draft.enabled && policy ? ' on' : '')} onClick={() => set({ enabled: !draft.enabled })} aria-label="Use AI"><span /></button>
          <b>Use AI</b> <span style={{ ...cap, ...muted }}>{policy ? 'The firm-wide switch. Off stops every AI call.' : 'Confirm the policy above first.'}</span>
        </label>
        <div style={{ ...cap, ...muted, marginTop: 10 }}>A client can also be excluded from AI on its Entity (Engagement › Edit Entity › AI permitted).</div>
      </Card>

      <Card>
        <CardHead title="Where AI Is Used" />
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          {AI_STEPS.map(s => {
            const on = draft.steps[s.id];
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 12, padding: '12px 0', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.06)', opacity: draft.enabled && policy ? 1 : 0.6 }}>
                <button type="button" role="switch" aria-checked={on} aria-label={s.label} className={'switch' + (on ? ' on' : '')} onClick={() => set({ steps: { ...draft.steps, [s.id]: !on } })}><span /></button>
                <div>
                  <div style={{ ...body, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ ...cap, ...muted, marginTop: 2 }}>{s.desc}</div>
                  {!on && <div style={{ ...cap, marginTop: 4 }}>When off: {s.off}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHead title="Model" />
        <div role="radiogroup" aria-label="Claude model" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {MODELS.map(m => (
            <label key={m.id} style={{ ...body, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '8px 10px', borderRadius: 10, background: draft.model === m.id ? 'var(--snow-primary-light)' : 'transparent' }}>
              <input type="radio" name="model" checked={draft.model === m.id} onChange={() => set({ model: m.id })} style={{ marginTop: 3 }} />
              <span><b>{m.name}</b> <code style={{ ...cap, ...muted }}>{m.id}</code><span style={{ ...cap, ...muted, display: 'block' }}>{m.note}</span></span>
            </label>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', background: 'var(--snow-primary-light)', borderRadius: 16, padding: '16px 24px' }}>
        <div style={{ ...cap, ...muted }}>{dirty ? 'You have unsaved changes.' : 'No unsaved changes.'} Changes are recorded in the Activity Log.</div>
        <Button size="lg" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save AI Settings'}</Button>
      </div>
    </div>
  );
}
