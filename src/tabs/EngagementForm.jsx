import React from 'react';
import { ruleChanged, runnable as isRunnable, formulaText } from '../data/checkLibrary';
import { useLibrary } from '../lib/library';
import { ASSIGNEES } from '../lib/people';
import { entityAi } from '../lib/aiDecision';
import { sameRule } from '../lib/ruleTemplate';
import { fmt, fmtDate, sym, CURRENCIES } from '../lib/format';
import { Button, Card, CardHead, Pill, Segmented, cap, body, h2, muted, page } from '../components/ui';

const STATUS = {
  active: ['Active · pilot', 'var(--snow-status-complete-bg)'],
  draft: ['Draft / Pending', 'var(--snow-status-approved-bg)'],
  proposed: ['Proposed', 'var(--snow-ink-5)']
};
const GRID = '48px 70px minmax(220px,2fr) 150px 118px minmax(200px,1.4fr)';
const COLS = ['Run', 'Check ID', 'Rule', 'Tolerance', 'Status', 'How the app runs it'];
const GRID_EDIT = GRID + ' 64px';

export default function EngagementForm({ setup, onChange, locked, onReset, onSave, onCancel, saving, error, isNew, canWrite, entities = [], onAddEntity, people = [], signedOff = false, template = null, firmTemplate = null }) {
  const set = patch => onChange({ ...setup, ...patch });
  const setFund = patch => set({ fund: { ...setup.fund, ...patch } });
  const setRule = (id, patch) => set({ rules: { ...setup.rules, [id]: { ...setup.rules[id], ...patch } } });

  const LIBRARY = useLibrary();
  const running = LIBRARY.filter(r => isRunnable(r) && setup.rules[r.id]?.on).length;
  const narrativeCover = setup.narrative ? LIBRARY.filter(r => r.engine === 'narrative').length : 0;
  const notBuilt = LIBRARY.filter(r => r.engine === 'none').length;
  const changed = LIBRARY.filter(r => ruleChanged(setup, r)).length;
  const pilot = LIBRARY.filter(r => r.status === 'active').length;
  const entity = entities.find(x => x.id === setup.entityId);
  const missing = [!entity && 'entity', !setup.fund.name.trim() && 'fund name', !setup.fund.yearEnd && 'year end', setup.aiOff && !(setup.aiOffBasis || '').trim() && 'reason for turning AI off'].filter(Boolean);
  // Choosing an entity fills in its year end if the fund has none yet.
  const chooseEntity = id => {
    if (id === '__new') return onAddEntity?.(created => onChange({ ...setup, entityId: created.id, fund: { ...setup.fund, yearEnd: setup.fund.yearEnd || created.yearEnd || '' } }));
    const ent = entities.find(x => x.id === id);
    onChange({ ...setup, entityId: id, fund: { ...setup.fund, yearEnd: setup.fund.yearEnd || ent?.yearEnd || '' } });
  };

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 680 }}>
          <button type="button" onClick={onCancel} className="link" style={{ ...cap, ...muted, marginBottom: 6 }}>‹ Engagements</button>
          <div style={h2}>{isNew ? 'New Engagement' : setup.fund.name || 'Engagement'}</div>
          <div style={{ ...body, ...muted, marginTop: 6 }}>Set the fund details and review parameters, and choose which rules from the check library the analysis runs. Save the engagement to add it to the engagement listing.</div>
        </div>
        {canWrite && <Button kind="secondary" disabled={locked} onClick={onReset}>Reset Checks to Firm Defaults</Button>}
      </div>

      {locked && <div style={{ ...cap, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '10px 14px' }}>The engagement is locked while the analysis runs.</div>}

      <fieldset disabled={locked || !canWrite} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
          <Card style={{ flex: '1 1 320px', minWidth: 280 }}>
            <CardHead title="Fund" aside={entity ? [entity.legalForm, entity.jurisdiction].filter(Boolean).join(' · ') : ''} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
              <Field label="Entity" hint={entity ? (entity.client ? `Client: ${entity.client}` : 'The legal entity this fund belongs to') : 'Choose the legal entity this fund belongs to'}>
                <select className="input" value={entity ? setup.entityId : ''} onChange={e => chooseEntity(e.target.value)} aria-required="true">
                  <option value="" disabled>Choose an entity…</option>
                  {entities.slice().sort((a, b) => a.name.localeCompare(b.name)).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  {onAddEntity && <option value="__new">+ Add a new entity…</option>}
                </select>
              </Field>
              <FundAi entity={entity} setup={setup} onChange={onChange} />
              <Field label="Fund name"><input className="input" value={setup.fund.name} placeholder="Name of the fund" onChange={e => setFund({ name: e.target.value })} /></Field>
              <Field label="Year end" hint={setup.fund.yearEnd ? fmtDate(setup.fund.yearEnd) : 'Select the reporting date'}>
                <input className="input" type="date" value={setup.fund.yearEnd || ''} onChange={e => setFund({ yearEnd: e.target.value })} />
              </Field>
              <FundOptions entity={entity} setup={setup} onChange={onChange} />
              <Field label="Presentation currency" hint="All amounts in this review are shown in it, and CHK-14 checks the draft against it">
                <select className="input" value={setup.fund.currency || 'GBP'} onChange={e => setFund({ currency: e.target.value })}>
                  {Object.entries(CURRENCIES).map(([c, x]) => <option key={c} value={c}>{c} · {x.name}</option>)}
                </select>
              </Field>
              {ASSIGNEES.map(a => <PersonSelect key={a.key} {...a} fund={setup.fund} people={people} onChange={patch => setFund(patch)} />)}
            </div>
          </Card>

          <Card style={{ flex: '2 1 480px', minWidth: 300 }}>
            <CardHead title="Review Parameters" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginTop: 16 }}>
              <Field label={`Review threshold (${sym(setup.fund.currency)})`} hint="Materiality for review points and CHK-11">
                <Num value={setup.threshold} min={0} onChange={v => set({ threshold: v ?? 0 })} />
              </Field>
              <Field label="High priority at" hint={`× threshold, currently ${sym(setup.fund.currency)}${fmt(setup.threshold * setup.highMultiple)}`}>
                <Num value={setup.highMultiple} min={1} step={0.5} onChange={v => set({ highMultiple: v ?? 1 })} />
              </Field>
              <Field label="Management fee rate (% a year)" hint="Leave blank to use the prospectus rate from supporting information">
                <Num value={setup.feeRatePct} min={0} step={0.01} placeholder="From prospectus" onChange={v => set({ feeRatePct: v })} />
              </Field>
              <Field label="Fee period (months)" hint="Period factor in CHK-10">
                <Num value={setup.feeMonths} min={1} max={12} onChange={v => set({ feeMonths: Math.min(12, Math.max(1, v ?? 12)) })} />
              </Field>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.1)' }}>
              <div style={{ ...body, fontWeight: 600 }}>Variance listing (CHK-11)</div>
              <div style={{ marginTop: 8 }}>
                <Segmented value={setup.varianceMode} onChange={v => set({ varianceMode: v })}
                  options={[['library', 'Every material movement'], ['expectation', 'Material and outside expectation']]} />
              </div>
              <div style={{ ...cap, ...muted, marginTop: 8, maxWidth: 640 }}>
                {setup.varianceMode === 'library'
                  ? 'As approved: every line moving by the threshold or more is listed. Lines far from the net-asset expectation are still marked for investigation.'
                  : 'Stricter than the approved rule: a material line is listed only when it is also outside the expectation bands below.'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginTop: 14 }}>
                <Field label="Investigate when off expectation by (%)"><Num value={setup.investigatePct} min={0} onChange={v => set({ investigatePct: v ?? 0 })} /></Field>
                <Field label="Explain when off expectation by (%)"><Num value={setup.explainPct} min={0} onChange={v => set({ explainPct: v ?? 0 })} /></Field>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.1)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <Toggle on={setup.narrative} onChange={on => set({ narrative: on })} label="Narrative review" />
              <div>
                <div style={{ ...body, fontWeight: 600 }}>Narrative review by Claude</div>
                <div style={{ ...cap, ...muted, marginTop: 2, maxWidth: 560 }}>Reads the draft against the prior year and supporting information for stale text, directors, subsequent events and currency labels. Covers CHK-12 and CHK-14 as judgement, not as an exact-match test.</div>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHead title={`Check Library (${LIBRARY.length} rules)`} aside={`${pilot} pilot · ${LIBRARY.length - pilot} proposed`} />
          <div style={{ ...body, marginTop: 8 }}>
            {running} rule{running === 1 ? '' : 's'} will run in the analysis
            {narrativeCover ? `, ${narrativeCover} more are covered by the narrative review` : ''}, and {notBuilt} {notBuilt === 1 ? 'is' : 'are'} not built in the app yet.
            {changed > 0 && <span> {changed} tolerance{changed === 1 ? ' differs' : 's differ'} from the approved version.</span>}
          </div>
          {template && <div style={{ ...cap, ...muted, marginTop: 6 }}>Rules follow the firm’s template, so changes the Administrator makes apply here too. A rule you change here is marked <b>Overridden</b> and keeps your setting; <b>Reset</b> returns it to the template. {Object.keys(setup.rules || {}).filter(id => !sameRule(setup.rules[id], template[id])).length} overridden.</div>}
          <RulesTable setup={setup} setRule={setRule} template={template} firmTemplate={firmTemplate} />
        </Card>
      </fieldset>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', background: 'var(--snow-primary-light)', borderRadius: 16, padding: '16px 24px' }}>
        <div style={{ ...cap, ...muted, maxWidth: 620 }}>
          {error ? <span style={{ color: 'var(--snow-black-100)' }}>The engagement was not saved: {error}</span>
            : signedOff ? 'This engagement is signed off and locked. A Manager can unlock it on the Sign-off tab.'
            : !canWrite ? 'Your role can view this engagement but not change it.'
            : missing.length ? `Add the ${missing.join(' and ')} to save this engagement.`
            : isNew ? 'Saving adds this engagement to the listing. Click In Review there to start reviewing it.'
            : 'Saving updates this engagement in the listing.'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button kind="secondary" onClick={onCancel}>{canWrite ? 'Cancel' : 'Back to Engagements'}</Button>
          {canWrite && <Button size="lg" disabled={locked || saving || missing.length > 0} onClick={onSave}>{saving ? 'Saving…' : 'Save Engagement'}</Button>}
        </div>
      </div>
    </div>
  );
}

// The check library table, shared with the Administrator's Check rules page.
// Pass onEdit (Administrator) to add an Edit action to each row; library overrides the context library.
export function RulesTable({ setup, setRule, onEdit, library, editingId, template = null, firmTemplate = null }) {
  const ctx = useLibrary(), LIBRARY = library || ctx;
  const grid = onEdit ? GRID_EDIT : GRID, minWidth = onEdit ? 930 : 860;
  // A rule added after an engagement was saved has no setting there yet: it starts off.
  const fallback = r => ({ on: false, tol: r.tol, tolKind: r.tolKind });
  const setRuleSafe = (id, patch) => setRule(id, { ...(setup.rules[id] || fallback(LIBRARY.find(x => x.id === id))), ...patch });
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 14, padding: '8px 12px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)', minWidth }}>
        {COLS.concat(onEdit ? [''] : []).map((c, i) => <div key={i} style={{ ...cap, ...muted }}>{c}</div>)}
      </div>
      {LIBRARY.map(r => <RuleRow key={r.id} r={r} s={setup.rules[r.id] || fallback(r)} setup={setup} setRule={setRuleSafe} grid={grid} minWidth={minWidth} onEdit={onEdit} editing={editingId === r.id} template={template} firmTemplate={firmTemplate} />)}
    </div>
  );
}

function RuleRow({ r, s, setup, setRule, grid, minWidth, onEdit, editing, template, firmTemplate }) {
  const fromClient = template && firmTemplate && template[r.id] && firmTemplate[r.id] && !sameRule(template[r.id], firmTemplate[r.id]);
  const overridden = template && template[r.id] && !sameRule(s, template[r.id]);
  const runnable = isRunnable(r);
  const changed = ruleChanged(setup, r);
  const [statusLabel, statusBg] = STATUS[r.status] || STATUS.proposed;
  const off = r.engine === 'custom-narrative' ? !s.on || !setup.narrative : runnable ? !s.on : r.engine === 'narrative' ? !setup.narrative : true;

  let how;
  if (r.engine === 'code') how = ['Recalculation in code', r.partial];
  else if (r.engine === 'variance') how = ['Variance model', 'Results on the Variance Analysis tab.'];
  else if (r.engine === 'narrative') how = ['Claude narrative review', setup.narrative ? 'Judgement, not an exact-match test.' : 'Off: narrative review is switched off above.'];
  else if (r.engine === 'custom-tieout') how = ['Tie-out set by the administrator', formulaText(r.def)];
  else if (r.engine === 'custom-narrative') how = ['Claude narrative review', setup.narrative ? `Firm rule: ${r.def?.instruction || ''}` : 'Off: narrative review is switched off.'];
  else if (!r.builtIn) how = ['Not automated', 'Recorded in the library for reference.'];
  else how = ['Not built yet', r.gap];

  return (
    <div className="row" style={{ display: 'grid', gridTemplateColumns: grid, gap: 14, alignItems: 'start', padding: '12px', minWidth, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)', background: editing ? 'var(--snow-primary-light)' : undefined }}>
      <div>{runnable ? <Toggle on={s.on} onChange={on => setRule(r.id, { on })} label={`Run ${r.id}`} /> : <span style={{ ...cap, ...muted }}>—</span>}</div>
      <div style={{ ...body, fontWeight: 600, opacity: off ? 0.62 : 1 }}>{r.id}</div>
      <div style={{ opacity: off ? 0.62 : 1 }}><div style={body}>{r.name}{!r.builtIn && <span style={{ ...cap, ...muted, marginLeft: 8 }}>Firm rule</span>}</div><div style={{ ...cap, ...muted, marginTop: 2 }}>{r.desc}</div></div>
      <div><Tolerance r={r} s={s} setup={setup} setRule={setRule} editable={runnable} />
        {changed && <div style={{ marginTop: 6 }}><Pill bg="var(--snow-status-approved-bg)">Approved: {tolText(r.tolKind, r.tol, setup)}</Pill></div>}
      </div>
      <div><Pill bg={statusBg}>{statusLabel}</Pill>
        {template && template[r.id] && (overridden
          ? <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}><Pill bg="var(--snow-status-approved-bg)">Overridden</Pill><button type="button" className="link" style={{ ...cap }} onClick={() => setRule(r.id, { ...template[r.id] })} aria-label={`Reset ${r.id} to the firm template`}>Reset</button></div>
          : <div style={{ marginTop: 6 }}><span style={{ ...cap, ...muted }}>{fromClient ? 'Client setting' : 'Template'}</span></div>)}
      </div>
      <div style={{ opacity: off ? 0.62 : 1 }}><div style={cap}>{how[0]}</div>{how[1] && <div style={{ ...cap, ...muted, marginTop: 2, overflowWrap: 'anywhere' }}>{how[1]}</div>}</div>
      {onEdit && <div><button type="button" className="btn btn-secondary" style={{ height: 32, padding: '0 12px' }} onClick={() => onEdit(r)}>Edit</button></div>}
    </div>
  );
}

const tolText = (kind, tol, setup) => kind === 'abs' ? `± ${fmt(tol, 2)}` : kind === 'pct' ? `± ${tol}%`
  : kind === 'threshold' ? `Threshold ${sym(setup.fund?.currency)}${fmt(setup.threshold)}` : kind === 'exact' ? 'Exact match' : 'Completeness';

function Tolerance({ r, s, setup, setRule, editable }) {
  if (!editable || !['abs', 'pct'].includes(s.tolKind)) return <div style={{ ...cap, paddingTop: 2 }}>{tolText(s.tolKind, s.tol, setup)}</div>;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={cap}>±</span>
      {s.tolKind === 'abs' && <span style={cap}>{sym(setup.fund?.currency).trim()}</span>}
      <Num value={s.tol} min={0} step={s.tolKind === 'pct' ? 0.1 : 1} style={{ width: 72 }} aria-label={`${r.id} tolerance`} onChange={v => setRule(r.id, { tol: v ?? 0 })} />
      {r.id === 'CHK-10' || r.engine === 'custom-tieout'
        ? <select className="input" style={{ width: 48, padding: '0 4px' }} value={s.tolKind} onChange={e => setRule(r.id, { tolKind: e.target.value })} aria-label="Tolerance unit">
            <option value="abs">{sym(setup.fund?.currency).trim()}</option><option value="pct">%</option>
          </select>
        : null}
    </div>
  );
}

// Partner sign-off and umbrella accounts follow the client unless this fund overrides them.
function FundOptions({ entity, setup, onChange }) {
  if (!entity) return null;
  const sel = (key, label, onText, offText, clientOn) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ ...cap, ...muted }}>{label}</span>
      <select className="input" aria-label={label} value={setup[key] || ''} onChange={e => onChange({ ...setup, [key]: e.target.value })}>
        <option value="">Follow the client ({clientOn ? onText : offText})</option><option value="on">{onText}</option><option value="off">{offText}</option>
      </select>
    </label>);
  const umb = setup.umbrella === 'on' || (setup.umbrella !== 'off' && entity.umbrella);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, background: 'var(--snow-primary-light)', borderRadius: 8, padding: '8px 10px' }}>
      {sel('partnerSignoff', 'Partner sign-off', 'Required', 'Not required', !!entity.partnerSignoff)}
      {sel('umbrella', 'Financial statements', 'Umbrella accounts', 'Separate accounts', !!entity.umbrella)}
      {umb && <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
        <span style={{ ...cap, ...muted }}>Name of this fund in the umbrella accounts</span>
        <input className="input" aria-label="Name in the umbrella accounts" placeholder={setup.fund?.name || 'As it appears as a column or section heading'} value={setup.umbrellaName || ''} onChange={e => onChange({ ...setup, umbrellaName: e.target.value })} />
        <span style={{ ...cap, ...muted }}>The column or section heading used for this fund. Leave blank to use the fund name.</span>
      </label>}
    </div>);
}

// AI for this fund follows the client's decision; a fund can be opted out, never opted in.
function FundAi({ entity, setup, onChange }) {
  const e = entityAi(entity);
  if (!entity) return null;
  if (e !== 'permitted') return (
    <div style={{ ...cap, background: 'var(--snow-primary-light)', borderRadius: 8, padding: '8px 10px' }}>
      <b>AI:</b> {e === 'undecided' ? 'not decided for this client yet, so this fund is reviewed without AI. Record the decision on the entity.' : 'not permitted by this client, so this fund is reviewed without AI.'}
    </div>);
  return (
    <div style={{ ...cap, background: 'var(--snow-primary-light)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span><b>AI:</b> permitted by this client ({entity.aiBasis}).</span>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!setup.aiOff} onChange={ev => onChange({ ...setup, aiOff: ev.target.checked, aiOffBasis: ev.target.checked ? setup.aiOffBasis || '' : '' })} />
        Don’t use AI for this fund
      </label>
      {setup.aiOff && <input className="input" aria-label="Reason for turning AI off for this fund" placeholder="Reason, for example the client’s instruction for this fund" value={setup.aiOffBasis || ''} onChange={ev => onChange({ ...setup, aiOffBasis: ev.target.value })} />}
    </div>);
}

// A list of active users with the matching role. A value saved earlier is kept visible: a
// deactivated person is marked as such, and a name typed before the lists existed is shown until
// it is replaced.
function PersonSelect({ key: _k, role, label, fund, people, onChange }) {
  const id = fund[`${label.toLowerCase()}Id`] || '', typed = fund[label.toLowerCase()] || '';
  const field = label.toLowerCase();
  const options = people.filter(p => p.role === role && p.active).sort((a, b) => a.name.localeCompare(b.name));
  const current = people.find(p => p.id === id);
  const legacy = !id && typed ? typed : '';
  const value = id || (legacy ? '__legacy' : '');
  const none = !options.length ? ` No active ${role}s are set up yet; an Administrator adds them under Users and Roles.` : '';
  const hint = current && !current.active ? `${current.name} is deactivated. Choose someone else.${none}`
    : current && current.role !== role ? `${current.name} is now ${current.role}. Choose a ${role}.${none}`
    : legacy ? `“${legacy}” was typed before the lists existed. Choose the matching person.${none}`
    : none.trim();
  return (
    <Field label={label} hint={hint}>
      <select className="input" value={value} aria-label={label}
        onChange={e => { const p = people.find(x => x.id === e.target.value); onChange({ [`${field}Id`]: p?.id || '', [field]: p?.name || '' }); }}>
        <option value="">{options.length ? `Choose a ${role}…` : `No ${role}s available`}</option>
        {legacy && <option value="__legacy" disabled>{legacy} (typed earlier)</option>}
        {current && (!current.active || current.role !== role) && <option value={current.id}>{current.name} ({!current.active ? 'deactivated' : current.role})</option>}
        {options.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </Field>
  );
}

const Field = ({ label, hint, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ ...cap, ...muted }}>{label}</span>
    {children}
    {hint && <span style={{ ...cap, ...muted }}>{hint}</span>}
  </label>
);

const Num = ({ value, onChange, style, ...rest }) => (
  <input className="input" type="number" inputMode="decimal" value={value ?? ''} style={style} {...rest}
    onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} />
);

const Toggle = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} className={'switch' + (on ? ' on' : '')} onClick={() => onChange(!on)}>
    <span />
  </button>
);

