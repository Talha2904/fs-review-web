import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useActivity } from '../lib/activity';
import { saveFile } from '../lib/download';
import { Button, Card, CardHead, Pill, cap, body, h2, muted, page } from '../components/ui';

const CATEGORIES = ['Sign-in', 'Users', 'Check rules', 'Engagements', 'Documents', 'Analysis', 'Review points', 'Sign-off', 'AI', 'Activity log'];
const TINT = { 'Sign-in': 'var(--snow-ink-5)', Users: 'var(--snow-primary-purple)', 'Check rules': 'var(--snow-primary-blue)', Engagements: 'var(--snow-status-complete-bg)',
  Documents: 'var(--snow-ink-5)', Analysis: 'var(--snow-status-approved-bg)', 'Review points': 'rgba(255,71,71,0.1)', 'Activity log': 'var(--snow-ink-5)', 'Sign-off': 'var(--snow-status-complete-bg)', AI: '#EEF1FB' };
const GRID = '150px minmax(170px,1fr) 128px minmax(320px,2.4fr)';
const GRID_ALL = '150px minmax(150px,1fr) minmax(130px,0.9fr) 128px minmax(300px,2.2fr)'; // with a Fund column
const when = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

// fund: { id, name } shows one fund's entries (review workspace); without it, every entry (Administrators).
export default function ActivityLogTab({ fund = null }) {
  const scoped = !!fund;
  const { list, log } = useActivity();
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('');
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');
  const [fundFilter, setFundFilter] = useState('');
  const [limit, setLimit] = useState(200);
  const load = () => { setError(''); list(scoped ? { engagementId: fund.id } : {}).then(setEntries).catch(e => setError(e.message)); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const people = useMemo(() => [...new Map((entries || []).filter(e => e.actor).map(e => [e.actor.username, e.actor.name])).entries()], [entries]);
  const shown = useMemo(() => (entries || []).filter(e =>
    (!cat || e.category === cat) && (!who || (who === '_none' ? !e.actor : e.actor?.username === who))
    && (!fundFilter || (fundFilter === '_none' ? !e.engagementId : e.engagementId === fundFilter))
    && (!q || `${e.summary} ${e.details} ${e.actor?.name || ''} ${e.fundName || ''}`.toLowerCase().includes(q.toLowerCase()))), [entries, cat, who, q, fundFilter]);
  const funds = useMemo(() => [...new Map((entries || []).filter(e => e.engagementId).map(e => [e.engagementId, e.fundName || 'Unnamed fund'])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [entries]);
  const grid = scoped ? GRID : GRID_ALL, cols = scoped ? ['Time', 'Person', 'Activity', 'What happened'] : ['Time', 'Person', 'Fund', 'Activity', 'What happened'];

  // Exports the entries currently shown (after any filters), newest first, as an Excel workbook.
  async function exportXlsx() {
    setExporting(true); setError(''); setNotice('');
    try {
      const rows = shown.map(e => ({
        Time: new Date(e.at), Person: e.actor?.name || 'Not signed in', Username: e.actor?.username || '', Role: e.actor?.role || '', Fund: e.fundName || '',
        Activity: e.category, 'What happened': e.summary, Details: e.details || '', 'IP address': e.ip || ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows, { dateNF: 'yyyy-mm-dd hh:mm:ss' });
      ws['!cols'] = [20, 22, 18, 14, 26, 14, 56, 60, 16].map(wch => ({ wch }));
      ws['!autofilter'] = { ref: ws['!ref'] };
      const filters = [scoped && `Fund: ${fund.name}`, !scoped && fundFilter && `Fund: ${fundFilter === '_none' ? 'Not about a fund' : (funds.find(f => f[0] === fundFilter)?.[1] || '')}`, cat && `Activity: ${cat}`, who && `Person: ${who === '_none' ? 'Not signed in' : who}`, q && `Search: ${q}`].filter(Boolean);
      const about = XLSX.utils.aoa_to_sheet([
        ['FS Review Activity Log'], ['Exported', new Date().toLocaleString('en-GB')], ['Entries', rows.length],
        ['Filters', filters.join('; ') || 'None (all entries)'], ['Source', 'Server log']
      ]);
      about['!cols'] = [{ wch: 12 }, { wch: 60 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Activity Log');
      XLSX.utils.book_append_sheet(wb, about, 'About this export');
      const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const slug = scoped ? '-' + fund.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
      const name = `fs-review-activity-log${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const result = await saveFile(name, blob);
      if (result === 'saved') {
        log('Activity log', `Exported ${scoped ? `the ${fund.name} activity log` : 'the activity log'} (${rows.length} entr${rows.length === 1 ? 'y' : 'ies'})`, filters.join(' · ') || 'All entries', scoped ? { engagementId: fund.id, fundName: fund.name } : {});
        setNotice(`Exported ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} to ${name}.`);
      }
    } catch (e) { setError(`The log was not exported: ${e.message}`); }
    finally { setExporting(false); }
  }

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 680 }}>
          <div style={h2}>Activity Log</div>
          <div style={{ ...body, ...muted, marginTop: 6 }}>{scoped ? <>Everything recorded for <b style={{ color: 'var(--snow-black-100)' }}>{fund.name}</b>: engagement changes, documents, analyses and review points, newest first.</> : 'Every sign-in, user change, check rule change, engagement, document, analysis and review point action across all funds, newest first.'} Entries cannot be edited or deleted.
</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button kind="secondary" onClick={load}>Refresh</Button>
          <Button kind="secondary" disabled={exporting || !shown.length} onClick={exportXlsx}>{exporting ? 'Preparing…' : 'Export Log (.xlsx)'}</Button>
        </div>
      </div>

      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Field label="Activity">
            <select className="input" value={cat} onChange={e => setCat(e.target.value)}><option value="">All activity</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Person">
            <select className="input" value={who} onChange={e => setWho(e.target.value)}>
              <option value="">Everyone</option>{people.map(([u, n]) => <option key={u} value={u}>{n} ({u})</option>)}<option value="_none">Not signed in</option>
            </select>
          </Field>
          {!scoped && (
            <Field label="Fund">
              <select className="input" value={fundFilter} onChange={e => setFundFilter(e.target.value)}>
                <option value="">All funds</option>{funds.map(([id, n]) => <option key={id} value={id}>{n}</option>)}<option value="_none">Not about a fund</option>
              </select>
            </Field>
          )}
          <Field label="Search"><input className="input" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Fund, rule, review point…" /></Field>
        </div>
      </Card>

      {notice && <div role="status" style={{ ...cap, background: 'var(--snow-status-complete-bg)', borderRadius: 8, padding: '10px 14px' }}>{notice}</div>}
      {error && <div role="alert" style={{ ...cap, background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '10px 14px' }}>{error}</div>}

      <Card>
        <CardHead title="Entries" aside={entries ? `${shown.length} of ${entries.length}` : 'Loading…'} />
        {entries && !shown.length ? <div style={{ ...body, ...muted, marginTop: 12 }}>{entries.length ? 'No entries match these filters.' : 'Nothing has been recorded yet.'}</div> : (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 14, padding: '8px 12px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)', minWidth: scoped ? 860 : 980 }}>
              {cols.map(c => <div key={c} style={{ ...cap, ...muted }}>{c}</div>)}
            </div>
            {shown.slice(0, limit).map(e => (
              <div key={e.id} className="log-row" style={{ display: 'grid', gridTemplateColumns: grid, gap: 14, padding: '10px 12px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)', minWidth: scoped ? 860 : 980, alignItems: 'start' }}>
                <div style={{ ...cap, fontVariantNumeric: 'tabular-nums' }}>{when(e.at)}</div>
                <div>{e.actor ? <><div style={body}>{e.actor.name}</div><div style={{ ...cap, ...muted }}>{e.actor.role}</div></> : <div style={{ ...cap, ...muted }}>Not signed in</div>}</div>
                {!scoped && <div style={{ ...cap, overflowWrap: 'anywhere' }}>{e.fundName || <span style={muted}>—</span>}</div>}
                <div><Pill bg={TINT[e.category] || 'var(--snow-ink-5)'}>{e.category}</Pill></div>
                <div><div style={body}>{e.summary}</div>{(e.details || e.ip) && <div style={{ ...cap, ...muted, marginTop: 2, overflowWrap: 'anywhere' }}>{[e.details, e.ip && `IP ${e.ip}`].filter(Boolean).join(' · ')}</div>}</div>
              </div>
            ))}
            {shown.length > limit && <div style={{ marginTop: 12 }}><Button size="sm" kind="secondary" onClick={() => setLimit(l => l + 200)}>Show More</Button></div>}
          </div>
        )}
      </Card>
    </div>
  );
}

const Field = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ ...cap, ...muted }}>{label}</span>{children}</label>
);
