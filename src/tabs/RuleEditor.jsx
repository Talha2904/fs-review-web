import React, { useState } from 'react';
import { FIGURES, formulaText } from '../data/checkLibrary';
import { Button, Card, CardHead, Segmented, cap, body, muted } from '../components/ui';

const STATUSES = [['active', 'Active · pilot'], ['draft', 'Draft / Pending'], ['proposed', 'Proposed']];
const ENGINES = [['custom-tieout', 'Tie-out of figures'], ['custom-narrative', 'Claude narrative check'], ['none', 'Not automated']];
const ENGINE_HELP = {
  'custom-tieout': 'Adds and subtracts figures the app extracts from the documents and compares the result with a stated figure, within the tolerance.',
  'custom-narrative': 'An instruction added to the Claude narrative review of real documents. Matters it finds are raised as review points. It does not run on the sample documents.',
  none: 'Recorded in the library for reference only. The app does not run it.'
};

// Edits one rule. Built-in rules: wording, version, status and approved tolerance (how they run is code).
// Firm rules: everything, including how they run.
export default function RuleEditor({ rule, isNew, busy, error, onSave, onCancel, onDelete }) {
  const [r, setR] = useState(() => ({
    ...rule,
    def: rule.engine === 'custom-tieout' ? { terms: [{ sign: 1, key: '' }], stated: '', ...(rule.def || {}) } : rule.def || {}
  }));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = patch => setR(x => ({ ...x, ...patch }));
  const setDef = patch => setR(x => ({ ...x, def: { ...x.def, ...patch } }));
  const custom = !rule.builtIn;
  const tolEditable = ['abs', 'pct'].includes(r.tolKind);

  const changeEngine = engine => setR(x => ({
    ...x, engine,
    tolKind: engine === 'custom-tieout' ? (['abs', 'pct'].includes(x.tolKind) ? x.tolKind : 'abs') : engine === 'custom-narrative' ? 'exact' : 'completeness',
    tol: engine === 'custom-tieout' ? (x.tol ?? 1) : null,
    def: engine === 'custom-tieout' ? { terms: [{ sign: 1, key: '' }], stated: '' } : engine === 'custom-narrative' ? { instruction: '' } : {}
  }));

  const terms = r.def?.terms || [];
  const problem = !r.name?.trim() ? 'Enter the rule name.'
    : !r.desc?.trim() ? 'Enter a short description of what the rule tests.'
    : r.engine === 'custom-tieout' && (!terms.length || terms.some(t => !t.key)) ? 'Choose a figure for every line of the calculation.'
    : r.engine === 'custom-tieout' && !r.def?.stated ? 'Choose the figure the calculation is compared with.'
    : r.engine === 'custom-narrative' && (r.def?.instruction || '').trim().length < 15 ? 'Write the instruction for Claude, in a sentence or two.'
    : tolEditable && (r.tol == null || r.tol < 0) ? 'Enter a tolerance of zero or more.' : '';

  const save = () => onSave({
    ...r, name: r.name.trim(), desc: r.desc.trim(), version: (r.version || '').trim() || 'v1.0',
    def: r.engine === 'custom-narrative' ? { instruction: r.def.instruction.trim() } : r.def
  });

  return (
    <Card style={{ boxShadow: 'inset 0 0 0 2px var(--snow-black-100)' }}>
      <CardHead title={isNew ? `New rule ${r.id}` : `Edit ${r.id}`} aside={custom ? 'Firm rule' : 'Built-in rule'} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 16 }}>
        <Field label="Rule name"><input className="input" value={r.name || ''} onChange={e => set({ name: e.target.value })} placeholder="For example, Note 4 agrees to the balance sheet" /></Field>
        <Field label="Version"><input className="input" value={r.version || ''} onChange={e => set({ version: e.target.value })} placeholder="v1.0" /></Field>
        <Field label="Status">
          <select className="input" value={r.status} onChange={e => set({ status: e.target.value })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
      </div>
      <div style={{ marginTop: 14 }}>
        <Field label="Description"><input className="input" value={r.desc || ''} onChange={e => set({ desc: e.target.value })} placeholder="What the rule tests, in one sentence" /></Field>
      </div>

      <div style={{ marginTop: 20, paddingTop: 16, boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.1)' }}>
        <div style={{ ...body, fontWeight: 600 }}>How the app runs it</div>
        {custom ? (
          <>
            <div style={{ marginTop: 8 }}><Segmented options={ENGINES} value={r.engine} onChange={changeEngine} /></div>
            <div style={{ ...cap, ...muted, marginTop: 8, maxWidth: 680 }}>{ENGINE_HELP[r.engine]}</div>

            {r.engine === 'custom-tieout' && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ ...cap, ...muted }}>Calculation</span>
                {terms.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select className="input" style={{ width: 64 }} aria-label={`Sign of line ${i + 1}`} value={t.sign}
                      onChange={e => setDef({ terms: terms.map((x, j) => (j === i ? { ...x, sign: +e.target.value } : x)) })}>
                      <option value={1}>+</option><option value={-1}>−</option>
                    </select>
                    <FigureSelect inRow value={t.key} label={`Figure on line ${i + 1}`} onChange={key => setDef({ terms: terms.map((x, j) => (j === i ? { ...x, key } : x)) })} />
                    {terms.length > 1 && <button type="button" className="link" style={{ ...cap, ...muted }} onClick={() => setDef({ terms: terms.filter((_, j) => j !== i) })}>Remove</button>}
                  </div>
                ))}
                <div><Button size="sm" kind="secondary" onClick={() => setDef({ terms: [...terms, { sign: 1, key: '' }] })}>Add Figure</Button></div>
                <span style={{ ...cap, ...muted, marginTop: 6 }}>Compared with</span>
                <FigureSelect value={r.def?.stated || ''} label="Figure compared with" onChange={stated => setDef({ stated })} />
                {!problem && <div style={{ ...cap, background: 'var(--snow-primary-light)', borderRadius: 8, padding: '8px 12px', marginTop: 4 }}>{formulaText(r.def)}</div>}
              </div>
            )}

            {r.engine === 'custom-narrative' && (
              <div style={{ marginTop: 14 }}>
                <Field label="Instruction for Claude">
                  <textarea className="input" rows={3} style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }} value={r.def?.instruction || ''}
                    onChange={e => setDef({ instruction: e.target.value })} placeholder="For example, check that the audit report is dated after the reporting date and before the date the accounts were approved." />
                </Field>
              </div>
            )}
          </>
        ) : (
          <div style={{ ...cap, ...muted, marginTop: 6, maxWidth: 680 }}>Built-in rule: how it runs is part of the app’s code. {r.partial || r.gap || ''}</div>
        )}
      </div>

      {tolEditable && (
        <div style={{ marginTop: 20, paddingTop: 16, boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.1)', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Approved tolerance" hint="Engagements whose tolerance differs from this are flagged.">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={cap}>±</span>
              <input className="input" type="number" min={0} step={r.tolKind === 'pct' ? 0.1 : 1} style={{ width: 110 }} value={r.tol ?? ''} onChange={e => set({ tol: e.target.value === '' ? null : Number(e.target.value) })} />
              {(r.engine === 'custom-tieout' || r.id === 'CHK-10')
                ? <select className="input" style={{ width: 56 }} aria-label="Tolerance unit" value={r.tolKind} onChange={e => set({ tolKind: e.target.value })}><option value="abs">£</option><option value="pct">%</option></select>
                : <span style={cap}>£</span>}
            </div>
          </Field>
        </div>
      )}

      {(problem || error) && <div role={error ? 'alert' : undefined} style={{ ...cap, marginTop: 16, ...(error ? { background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '8px 12px' } : muted) }}>{error || problem}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          {custom && !isNew && (confirmDelete
            ? <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><span style={cap}>Delete {r.id}? Engagements stop running it.</span>
                <Button size="sm" disabled={busy} onClick={onDelete}>Delete Rule</Button><Button size="sm" kind="secondary" onClick={() => setConfirmDelete(false)}>Keep</Button></span>
            : <Button size="sm" kind="secondary" onClick={() => setConfirmDelete(true)}>Delete Rule</Button>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button kind="secondary" onClick={onCancel}>Cancel</Button>
          <Button disabled={busy || !!problem} onClick={save}>{busy ? 'Saving…' : isNew ? 'Add Rule' : 'Save Rule'}</Button>
        </div>
      </div>
    </Card>
  );
}

const FigureSelect = ({ value, onChange, label, inRow }) => (
  <select className="input" style={inRow ? { flex: '1 1 320px', maxWidth: 460 } : { width: '100%', maxWidth: 460 }} aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
    <option value="">Choose a figure</option>
    {FIGURES.map(f => <option key={f.key} value={f.key}>{f.list ? `${f.label} (sum)` : f.label}</option>)}
  </select>
);

const Field = ({ label, hint, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ ...cap, ...muted }}>{label}</span>
    {children}
    {hint && <span style={{ ...cap, ...muted }}>{hint}</span>}
  </label>
);
