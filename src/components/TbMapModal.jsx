import React, { useMemo, useState } from 'react';
import Modal from './Modal';
import { Button, cap, body, muted } from './ui';
import { tbAccounts, statementLines, suggestMapping, checkTbMapping } from '../lib/tbMapping';
import { fmt } from '../lib/format';

const bal = a => (a.bal >= 0 ? `${fmt(a.bal)} Dr` : `${fmt(-a.bal)} Cr`);

// Map each trial balance account to a line of the primary statements (CHK-02). The result updates
// as you map; saving stores the mapping on the engagement and the check runs again straight away.
export default function TbMapModal({ docs, map, tol = 1, canEdit, onSave, onClose }) {
  const accounts = useMemo(() => tbAccounts(docs?.tb), [docs]);
  const lines = useMemo(() => statementLines(docs?.cy), [docs]);
  const [m, setM] = useState(map || {}), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const res = useMemo(() => checkTbMapping(docs, m, tol), [docs, m, tol]);
  const statements = [...new Set(lines.map(l => l.statement))];
  const lineOf = Object.fromEntries(lines.map(l => [l.key, l]));
  const resultOf = Object.fromEntries(res.results.map(r => [r.key, r]));
  const set = (code, key) => setM(x => { const n = { ...x }; if (key) n[code] = key; else delete n[code]; return n; });
  const suggest = () => setM(x => suggestMapping(accounts, lines, x));
  const changed = JSON.stringify(m) !== JSON.stringify(map || {});
  const agree = res.results.filter(r => r.ok).length;

  return (
    <Modal title="Map the Trial Balance (CHK-02)" onClose={onClose} width={1000}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...cap, ...muted, maxWidth: 820 }}>Choose the statement line each account belongs to. The app adds up each line’s accounts (debits minus credits) and compares the total with the draft. <b>Suggest Mapping</b> fills unmapped accounts by matching names on the same side of the ledger; check each suggestion. No AI is used.</div>
        <div role="status" style={{ ...cap, display: 'flex', gap: 16, flexWrap: 'wrap', background: 'var(--snow-primary-light)', borderRadius: 8, padding: '8px 12px' }}>
          <span><b>{res.mappedCount}</b> of {accounts.length} accounts mapped</span>
          <span><b>{agree}</b> of {res.results.length} lines agree</span>
          {res.unmapped.length > 0 && <span style={{ color: '#B42318' }}>{res.unmapped.length} account{res.unmapped.length === 1 ? '' : 's'} with a balance not mapped</span>}
        </div>
        <div style={{ maxHeight: '52vh', overflow: 'auto', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)', borderRadius: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '70px minmax(200px,1.4fr) 130px minmax(260px,1.6fr) 130px', gap: 10, padding: '8px 12px', position: 'sticky', top: 0, background: '#fff', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)', minWidth: 860, zIndex: 1 }}>
            {['Code', 'Account', 'Balance', 'Statement line', 'Line result'].map(c => <span key={c} style={{ ...cap, ...muted }}>{c}</span>)}
          </div>
          {accounts.map(a => {
            const k = m[a.code], line = lineOf[k], r = resultOf[k];
            const wrongSide = line && a.bal !== 0 && (a.bal > 0 ? 'dr' : 'cr') !== line.side;
            return (
              <div key={a.code} style={{ display: 'grid', gridTemplateColumns: '70px minmax(200px,1.4fr) 130px minmax(260px,1.6fr) 130px', gap: 10, alignItems: 'center', padding: '7px 12px', minWidth: 860, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)', background: !k && a.bal ? '#FFF7F6' : undefined }}>
                <span style={cap}>{a.code}</span>
                <span style={body}>{a.name}</span>
                <span style={{ ...cap, textAlign: 'right' }}>{bal(a)}</span>
                <span>
                  <select className="input" aria-label={`Statement line for ${a.code} ${a.name}`} disabled={!canEdit} value={line ? k : ''} onChange={e => set(a.code, e.target.value)} style={{ height: 32, fontSize: 13 }}>
                    <option value="">Not mapped</option>
                    {statements.map(st => <optgroup key={st} label={st}>{lines.filter(l => l.statement === st).map(l => <option key={l.key} value={l.key}>{l.label}</option>)}</optgroup>)}
                  </select>
                  {wrongSide && <span style={{ ...cap, color: '#8A5A00', display: 'block', marginTop: 2 }}>This account is a {a.bal > 0 ? 'debit' : 'credit'}; the line is usually a {line.side === 'dr' ? 'debit' : 'credit'}.</span>}
                </span>
                <span style={{ ...cap, color: !r ? 'var(--snow-black-40)' : r.ok ? '#2E6B12' : '#B42318' }}>{!r ? '—' : r.ok ? '✓ Agrees' : `✕ Differs by ${fmt(Math.abs(r.diff))}`}</span>
              </div>);
          })}
        </div>
        {res.notCovered.length > 0 && <div style={{ ...cap, ...muted }}>Statement lines with no accounts: {res.notCovered.map(l => l.label).join('; ')}. Calculated results (such as the increase in net assets) are checked by casting and the net asset movement.</div>}
        {error && <div role="alert" style={{ ...cap, background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {canEdit && <Button kind="secondary" onClick={suggest}>Suggest Mapping</Button>}
            {canEdit && <Button kind="secondary" onClick={() => setM({})}>Clear All</Button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button kind="secondary" onClick={onClose}>{canEdit ? 'Cancel' : 'Close'}</Button>
            {canEdit && <Button disabled={busy || !changed} onClick={async () => { setBusy(true); setError(''); try { await onSave(m, res); onClose(); } catch (e) { setError(e.message); setBusy(false); } }}>{busy ? 'Saving…' : 'Save Mapping'}</Button>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
