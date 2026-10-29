import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_SETUP, ruleChanged, buildLibrary, defaultRulesFor, nextRuleId, runnable } from '../data/checkLibrary';
import { RulesTable } from './EngagementForm';
import RuleEditor from './RuleEditor';
import { Button, Card, CardHead, cap, body, h2, muted, page } from '../components/ui';
import { useActivity } from '../lib/activity';

const EMPTY = { rules: {}, overrides: {}, custom: [] };

// The firm's check library: defaults for new engagements, edits to the built-in rules, and new rules.
export default function CheckRulesTab({ store }) {
  const { log } = useActivity();
  const [saved, setSaved] = useState(undefined); // undefined while loading, null = never saved
  const [cfg, setCfg] = useState(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(null); // { rule, isNew }
  const [busy, setBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [msg, setMsg] = useState({ kind: '', text: '' });

  useEffect(() => {
    if (!store) return undefined;
    return store.subscribeConfig(c => {
      setSaved(c);
      setDirty(d => { if (!d) setCfg(c || EMPTY); return d; });
    });
  }, [store]);

  const library = useMemo(() => buildLibrary(cfg), [cfg]);
  const rules = useMemo(() => ({ ...defaultRulesFor(library), ...cfg.rules }), [library, cfg.rules]);
  const setup = { ...DEFAULT_SETUP, rules };

  const persist = async (next, text) => {
    setBusy(true); setEditError('');
    try { await store.saveConfig(next); setCfg(next); setDirty(false); setMsg({ kind: 'ok', text }); return true; }
    catch (e) { setEditError(`Not saved: ${e.message}`); return false; }
    finally { setBusy(false); }
  };

  const setRule = (id, patch) => { setCfg(c => ({ ...c, rules: { ...c.rules, [id]: { ...rules[id], ...patch } } })); setDirty(true); setMsg({ kind: '', text: '' }); };
  const reset = () => { setCfg(c => ({ ...c, rules: {} })); setDirty(true); setMsg({ kind: '', text: '' }); };
  async function saveAll() {
    setBusy(true);
    try {
      await store.saveConfig({ ...cfg, rules }); setDirty(false); setMsg({ kind: 'ok', text: 'Check rules saved. New engagements start from these rules.' });
      const before = { ...defaultRulesFor(buildLibrary(saved)), ...(saved?.rules || {}) };
      const changes = library.flatMap(r => {
        const a = before[r.id] || {}, b = rules[r.id] || {}, out = [];
        if (!!a.on !== !!b.on) out.push(`${r.id} ${b.on ? 'on' : 'off'}`);
        if (a.tol !== b.tol || a.tolKind !== b.tolKind) out.push(`${r.id} tolerance ${b.tol}${b.tolKind === 'pct' ? '%' : ''}`);
        return out;
      });
      log('Check rules', 'Saved the default check rules', changes.join(' · ') || 'No changes');
    }
    catch (e) { setMsg({ kind: 'err', text: `The check rules were not saved: ${e.message}` }); }
    finally { setBusy(false); }
  }

  const addRule = () => {
    setMsg({ kind: '', text: '' }); setEditError('');
    setEditing({ isNew: true, rule: { id: nextRuleId(library), name: '', desc: '', version: 'v1.0', status: 'draft', engine: 'custom-tieout', tol: 1, tolKind: 'abs', builtIn: false } });
  };
  const editRule = r => { setMsg({ kind: '', text: '' }); setEditError(''); setEditing({ isNew: false, rule: r }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  async function saveRule(r) {
    const { builtIn, ...body } = r;
    let next;
    if (builtIn) {
      const { name, desc, version, status, tol, tolKind } = body;
      next = { ...cfg, rules, overrides: { ...cfg.overrides, [r.id]: { name, desc, version, status, tol, tolKind } } };
    } else {
      const { partial, gap, impl, approvedBy, ...def } = body; // keep only the fields a firm rule uses
      const exists = cfg.custom.some(x => x.id === r.id);
      const defaults = { on: r.status === 'active' && runnable(r), tol: r.tol, tolKind: r.tolKind };
      next = { ...cfg, rules: { ...rules, [r.id]: exists ? { ...rules[r.id], tolKind: r.tolKind } : defaults },
        custom: exists ? cfg.custom.map(x => (x.id === r.id ? def : x)) : [...cfg.custom, def] };
    }
    if (await persist(next, `${r.id} ${r.name} was ${editing.isNew ? 'added to the library' : 'saved'}.`)) {
      const old = editing.rule, fields = ['name', 'desc', 'version', 'status', 'tol', 'tolKind', 'engine'].filter(k => String(old[k] ?? '') !== String(r[k] ?? ''));
      if (JSON.stringify(old.def || {}) !== JSON.stringify(r.def || {})) fields.push('definition');
      log('Check rules', editing.isNew ? `Added rule ${r.id} ${r.name}` : `Edited rule ${r.id} ${r.name}`,
        editing.isNew ? `${r.status} · ${r.engine}` : [old.version !== r.version && `Version ${old.version} → ${r.version}`, fields.filter(f => f !== 'version').length && `Changed: ${fields.filter(f => f !== 'version').join(', ')}`].filter(Boolean).join(' · ') || 'No changes');
      setEditing(null);
    }
  }
  async function deleteRule() {
    const id = editing.rule.id, { [id]: _gone, ...restRules } = rules;
    if (await persist({ ...cfg, rules: restRules, custom: cfg.custom.filter(x => x.id !== id) }, `${id} was deleted from the library.`)) {
      log('Check rules', `Deleted rule ${id} ${editing.rule.name}`, `${editing.rule.version} · ${editing.rule.engine}`);
      setEditing(null);
    }
  }

  const on = library.filter(r => runnable(r) && rules[r.id]?.on).length;
  const firm = library.filter(r => !r.builtIn).length;
  const changed = library.filter(r => ruleChanged(setup, r)).length;

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 680 }}>
          <div style={h2}>Check Rules</div>
          <div style={{ ...body, ...muted, marginTop: 6 }}>The firm’s check library. Add rules, edit existing ones, and set which run by default. New engagements start from these rules; Managers can still adjust them for a single engagement.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button kind="secondary" disabled={busy || !!editing} onClick={reset}>Reset Defaults</Button>
          <Button size="lg" disabled={busy || !!editing || !store} onClick={addRule}>Add Rule</Button>
        </div>
      </div>

      {msg.text && <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ ...cap, background: msg.kind === 'err' ? 'rgba(255,71,71,0.1)' : 'var(--snow-status-complete-bg)', borderRadius: 8, padding: '10px 14px' }}>{msg.text}</div>}

      {editing && <RuleEditor key={editing.rule.id} rule={editing.rule} isNew={editing.isNew} busy={busy} error={editError}
        onSave={saveRule} onCancel={() => setEditing(null)} onDelete={deleteRule} />}

      <Card>
        <CardHead title={`Check Library (${library.length} rules)`} aside={saved === undefined ? 'Loading…' : saved ? 'Firm library saved' : 'Using the library defaults'} />
        <div style={{ ...body, marginTop: 8 }}>
          {on} rule{on === 1 ? '' : 's'} on by default{firm ? `, ${firm} added by the firm` : ''}.{changed > 0 && ` ${changed} default tolerance${changed === 1 ? ' differs' : 's differ'} from the approved value.`}
        </div>
        <RulesTable setup={setup} setRule={setRule} library={library} onEdit={editing ? undefined : editRule} editingId={editing?.rule.id} />
      </Card>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', background: 'var(--snow-primary-light)', borderRadius: 16, padding: '16px 24px' }}>
        <div style={{ ...cap, ...muted }}>{dirty ? 'You have unsaved changes to the defaults.' : 'Defaults saved. Rule edits save when you click Save Rule.'}</div>
        <Button size="lg" disabled={busy || !dirty || !store} onClick={saveAll}>{busy ? 'Saving…' : 'Save Defaults'}</Button>
      </div>
    </div>
  );
}
