import React, { useState } from 'react';
import Modal from './Modal';
import { Button, cap, muted } from './ui';
import { ENTITY_FIELDS } from '../lib/engagements';

const LEGAL_FORMS = ['ICAV', 'SICAV', 'Unit trust', 'Investment company', 'Limited partnership', 'Common contractual fund', 'Other'];
const JURISDICTIONS = ['Ireland', 'Luxembourg', 'United Kingdom', 'Cayman Islands', 'Jersey', 'Guernsey', 'Pakistan', 'United Arab Emirates', 'Singapore'];
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Adds or edits an entity. Names must be unique (ignoring case and spacing) so funds are never
// linked to a look-alike duplicate.
export default function EntityModal({ entity, entities, onSave, onClose, fundCount = 0, me }) {
  const isNew = !entity?.id;
  const [e, setE] = useState({ ...ENTITY_FIELDS, ...(entity || {}) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = k => ev => { setE(x => ({ ...x, [k]: ev.target.value })); setError(''); };
  const duplicate = entities.find(x => x.id !== e.id && norm(x.name) === norm(e.name));
  const decided = e.aiDecidedAt ? e.aiPermitted : null; // a decision only counts once recorded
  const [choice, setChoice] = useState(decided === null ? null : decided ? 'yes' : 'no');
  const problem = !e.name.trim() ? 'Enter the entity’s name.' : duplicate ? `An entity called “${duplicate.name}” already exists. Add the fund to that one instead.`
    : !choice ? 'Record whether the client permits AI.' : e.aiBasis.trim().length < 3 ? 'Enter the basis for the AI decision, for example the engagement letter and its date.' : '';

  async function submit(ev) {
    ev.preventDefault();
    if (problem) return setError(problem);
    setBusy(true); setError('');
    const clean = Object.fromEntries(Object.entries(e).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
    const permitted = choice === 'yes', changed = !entity?.aiDecidedAt || entity.aiPermitted !== permitted || (entity.aiBasis || '') !== clean.aiBasis;
    const decision = changed ? { aiPermitted: permitted, aiDecidedBy: me ? { id: me.id, name: me.name } : null, aiDecidedAt: new Date().toISOString() } : {};
    try { await onSave({ ...clean, ...decision }); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Modal title={isNew ? 'Add Entity' : `Edit ${entity.name}`} onClose={onClose} width={560}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ ...cap, ...muted }}>The legal entity the funds belong to, such as an ICAV umbrella. Its funds are listed under it.
          {!isNew && fundCount > 0 && (fundCount === 1 ? ' Changes apply to its fund.' : ` Changes apply to all ${fundCount} of its funds.`)}</div>
        <Field label="Entity name"><input className="input" value={e.name} onChange={set('name')} placeholder="For example, Meridian Funds ICAV" autoFocus /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <Field label="Client name" hint="The firm you report to, if different"><input className="input" value={e.client} onChange={set('client')} placeholder="For example, Meridian Asset Management" /></Field>
          <Field label="Legal form">
            <select className="input" value={e.legalForm} onChange={set('legalForm')}>
              <option value="">Choose…</option>{LEGAL_FORMS.map(f => <option key={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Jurisdiction">
            <input className="input" list="jurisdictions" value={e.jurisdiction} onChange={set('jurisdiction')} placeholder="For example, Ireland" />
            <datalist id="jurisdictions">{JURISDICTIONS.map(j => <option key={j} value={j} />)}</datalist>
          </Field>
          <Field label="Financial year end" hint="New funds under this entity start with this date">
            <input className="input" type="date" value={e.yearEnd} onChange={set('yearEnd')} />
          </Field>
          <Field label="Administrator"><input className="input" value={e.administrator} onChange={set('administrator')} /></Field>
          <Field label="Auditor"><input className="input" value={e.auditor} onChange={set('auditor')} /></Field>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ ...cap, ...muted }}>Billing contact email (for invoices)</span>
          <input className="input" type="email" aria-label="Billing contact email" value={e.billingEmail || ''} onChange={set('billingEmail')} placeholder="accounts@client.com" />
        </label>
        <fieldset style={{ border: 0, margin: 0, padding: '12px 14px', background: 'var(--snow-primary-light)', borderRadius: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <legend style={{ ...cap, fontWeight: 600, padding: 0, float: 'left', marginBottom: 6 }}>Review settings for this client</legend>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, clear: 'both' }}>
            <span style={{ ...cap, ...muted }}>Accounting framework</span>
            <select className="input" aria-label="Accounting framework" value={e.framework || ''} onChange={ev => setE(x => ({ ...x, framework: ev.target.value }))}>
              <option value="">Not set</option><option value="FRS 102">FRS 102</option><option value="IFRS">IFRS</option><option value="Other">Other</option>
            </select>
            <span style={{ ...cap, ...muted }}>Chooses the disclosure checklist (CHK-13) for this client’s funds.</span>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...cap, ...muted }}>Disclosure checklist (CHK-13)</span>
            <select className="input" aria-label="Disclosure checklist setting for this client" value={e.ruleOverrides?.['CHK-13'] ? (e.ruleOverrides['CHK-13'].on ? 'on' : 'off') : ''}
              onChange={ev => setE(x => { const o = { ...(x.ruleOverrides || {}) }; if (ev.target.value) o['CHK-13'] = { on: ev.target.value === 'on' }; else delete o['CHK-13']; return { ...x, ruleOverrides: o }; })}>
              <option value="">Follow the firm’s template</option><option value="on">Always on for this client</option><option value="off">Always off for this client</option>
            </select>
            <span style={{ ...cap, ...muted }}>A fund can still override this in its own settings.</span>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...cap, ...muted }}>Partner sign-off</span>
            <select className="input" aria-label="Partner sign-off for this client" value={e.partnerSignoff ? 'on' : ''} onChange={ev => setE(x => ({ ...x, partnerSignoff: ev.target.value === 'on' }))}>
              <option value="">Not required: the Manager signs off last</option><option value="on">Required after the Manager’s sign-off</option>
            </select>
            <span style={{ ...cap, ...muted }}>A fund can override this.</span>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...cap, ...muted }}>Financial statements</span>
            <select className="input" aria-label="How the client's financial statements are prepared" value={e.umbrella ? 'on' : ''} onChange={ev => setE(x => ({ ...x, umbrella: ev.target.value === 'on' }))}>
              <option value="">Separate accounts for each fund</option><option value="on">Umbrella accounts covering all its funds</option>
            </select>
            <span style={{ ...cap, ...muted }}>With umbrella accounts, each fund’s figures are read from its own column or section.</span>
          </label>
        </fieldset>
        <fieldset style={{ border: 0, margin: 0, padding: '12px 14px', background: 'var(--snow-primary-light)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ ...cap, fontWeight: 600, padding: 0, float: 'left', marginBottom: 6 }}>Does the client permit AI in the review? (required)</legend>
          <label style={{ ...cap, display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', clear: 'both' }}>
            <input type="radio" name="ai" checked={choice === 'yes'} onChange={() => { setChoice('yes'); setError(''); }} style={{ marginTop: 2 }} />
            <span><b>AI permitted.</b> The review may use AI as set under AI Settings.</span>
          </label>
          <label style={{ ...cap, display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="radio" name="ai" checked={choice === 'no'} onChange={() => { setChoice('no'); setError(''); }} style={{ marginTop: 2 }} />
            <span><b>AI not permitted.</b> The client’s funds are reviewed without AI: documents can be checked, but real documents can’t be analysed automatically.</span>
          </label>
          <Field label="Basis for the decision (required)" hint="For example: engagement letter dated 1 March 2026, clause 9.">
            <input className="input" value={e.aiBasis || ''} onChange={set('aiBasis')} placeholder="Engagement letter, client email, board minute…" />
          </Field>
          {entity?.aiDecidedAt && <span style={{ ...cap, ...muted }}>Last recorded by {entity.aiDecidedBy?.name || '—'} on {new Date(entity.aiDecidedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.</span>}
          {entity && !entity.aiDecidedAt && <span style={{ ...cap }}>No decision has been recorded for this client yet, so its funds are currently reviewed without AI.</span>}
        </fieldset>
        {(error || (e.name && duplicate)) && <div role="alert" style={{ ...cap, background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '8px 12px' }}>{error || problem}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button kind="secondary" onClick={onClose}>Cancel</Button>
          <button type="submit" className="btn btn-primary" style={{ height: 36, padding: '0 16px' }} disabled={busy || !!problem}>{busy ? 'Saving…' : isNew ? 'Add Entity' : 'Save Entity'}</button>
        </div>
      </form>
    </Modal>
  );
}

const Field = ({ label, hint, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ ...cap, ...muted }}>{label}</span>
    {children}
    {hint && <span style={{ ...cap, ...muted }}>{hint}</span>}
  </label>
);
