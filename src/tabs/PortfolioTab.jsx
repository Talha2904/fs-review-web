import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button, Card, Pill, CountUp, cap, body, h2, muted, page } from '../components/ui';
import { fmtDate } from '../lib/format';
import { saveFile } from '../lib/download';
import { reviewStore } from '../lib/reviewStore';
import { useLive } from '../lib/useLive';
import Select from '../components/Select';

// The stage a fund's review has reached, who it is waiting for, and the screen to open.
const STAGES = [
  ['Not started', 'var(--snow-ink-5)', 'preparer', 'docs', '#AEB9C9'],
  ['Preparing documents', 'var(--snow-ink-5)', 'preparer', 'docs', '#E9B949'],
  ['Sent back to preparer', 'var(--snow-status-approved-bg)', 'preparer', 'docs', '#D2952A'],
  ['Ready to analyse', 'var(--snow-primary-blue)', 'reviewer', 'docs', '#3FB8C9'],
  ['In review', 'var(--snow-primary-blue)', 'preparer', 'sched', '#4F86D3'],
  ['Returned to reviewer', 'var(--snow-status-approved-bg)', 'reviewer', 'signoff', '#D2952A'],
  ['Ready for sign-off', 'var(--snow-primary-purple)', 'manager', 'signoff', '#8DBB3A'],
  ['Awaiting partner', 'var(--snow-primary-purple)', 'partner', 'signoff', '#76AC3C'],
  ['Signed off', 'var(--snow-status-complete-bg)', null, 'signoff', '#5E9E2F']
];
const STAGE = Object.fromEntries(STAGES.map(([n, bg, owner, tab, ink], i) => [n, { bg, owner, tab, ink, order: i }]));
const ago = iso => { if (!iso) return '—'; const d = Math.floor((Date.now() - new Date(iso)) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };

export default function PortfolioTab({ engagements, user, onOpen, onConsolidated, onCommonPoint }) {
  const [view, setView] = useState('all'), [stageF, setStageF] = useState(''), [clientF, setClientF] = useState(''), [q, setQ] = useState('');
  // worked out on the api (GET /api/portfolio): stages, who each fund waits for, open and overdue points
  const [data, loadError] = useLive(() => reviewStore.portfolio(), null);
  const rows = useMemo(() => {
    const byId = Object.fromEntries((engagements || []).map(e => [e.id, e]));
    return (data?.rows || []).filter(r => byId[r.engagementId]).map(r => ({ ...r, id: r.engagementId, eng: byId[r.engagementId], mine: r.teamIds, last: r.lastActivityAt }));
  }, [data, engagements]);
  const shown = rows.filter(r => (view === 'all' || r.mine.includes(user.id)) && (!stageF || r.stage === stageF) && (!clientF || r.client === clientF)
    && (!q || `${r.client} ${r.fund}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.overdue - a.overdue) || (STAGE[a.stage].order - STAGE[b.stage].order) || a.fund.localeCompare(b.fund));
  const count = n => rows.filter(r => r.stage === n).length;
  const tiles = [
    ['Funds', rows.length, ''], ['In progress', rows.filter(r => !['Signed off', 'Not started'].includes(r.stage)).length, ''],
    ['Ready for sign-off', count('Ready for sign-off'), 'Waiting for a Manager'], ['Awaiting partner', count('Awaiting partner'), 'Waiting for a Partner'],
    ['Signed off', count('Signed off'), ''], ['Open points', rows.reduce((a, r) => a + r.open, 0), `${rows.reduce((a, r) => a + r.responded, 0)} responded, waiting for review`],
    ['Overdue points', rows.reduce((a, r) => a + r.overdue, 0), `in ${rows.filter(r => r.overdue).length} fund${rows.filter(r => r.overdue).length === 1 ? '' : 's'}`]];
  const maxStage = Math.max(1, ...STAGES.map(([n]) => count(n)));
  const clients = [...new Set(rows.map(r => r.client))].sort();
  const exportX = async () => {
    const data = shown.map(r => ({ Client: r.client, Fund: r.fund, 'Year end': r.yearEnd, Stage: r.stage, 'Waiting for': r.ownerName, Preparer: r.team.preparer, Reviewer: r.team.reviewer, Manager: r.team.manager, Partner: r.team.partner,
      'Open points': r.open, 'Responded points': r.responded, 'Overdue points': r.overdue, 'Last activity': r.last ? new Date(r.last).toLocaleString('en-GB') : '' }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Portfolio');
    await saveFile(`portfolio-${new Date().toLocaleDateString('en-CA')}.xlsx`, new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]));
  };
  const grid = 'minmax(170px,1.3fr) minmax(150px,1.1fr) 104px 170px 150px 70px 70px 70px 100px';

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 760 }}>
          <div style={h2}>Portfolio</div>
          <div style={{ ...body, ...muted, marginTop: 6 }}>Click a fund to open it.</div>
          {loadError && <div role="alert" style={{ ...cap, marginTop: 8, background: 'var(--snow-status-rejected-bg)', borderRadius: 8, padding: '8px 12px' }}>The portfolio could not be loaded: {loadError}</div>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {/* opens on the client chosen in the filter below, when there is one */}
          <Button kind="secondary" onClick={() => onConsolidated(clientF === 'No client' ? '' : clientF)}>Consolidated Review</Button>
          {onCommonPoint && <Button kind="secondary" onClick={() => onCommonPoint(clientF)}>Common Review Point</Button>}
          <Button kind="secondary" onClick={exportX}>Export (.xlsx)</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 12 }}>
        {tiles.map(([k, v, x]) => {
          // tiles that are a stage filter the table below; pressing again clears it
          const st = STAGE[k] ? k : null, alert = k === 'Overdue points' && v > 0;
          const inner = <><div className="kpi-k">{k}</div><div className={'kpi-v' + (alert ? ' is-alert' : '')}><CountUp value={v} /></div>{x && <div className="kpi-x">{x}</div>}</>;
          return st ? <button key={k} type="button" className="kpi is-link" aria-pressed={stageF === st} style={{ '--c': STAGE[st].ink }} onClick={() => setStageF(stageF === st ? '' : st)}>{inner}</button>
            : <div key={k} className="kpi" style={{ '--c': alert ? 'var(--pa-red)' : { Funds: '#14213D', 'In progress': '#3FB8C9', 'Open points': '#E9B949' }[k] || '#AEB9C9' }}>{inner}</div>;
        })}
      </div>

      <Card>
        <div style={{ ...body, fontWeight: 600 }}>Funds by stage</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 10 }}>
          {STAGES.map(([n, , , , ink], i) => (
            <button key={n} type="button" className={'stage-row' + (stageF && stageF !== n ? ' is-dim' : '')} onClick={() => setStageF(stageF === n ? '' : n)} aria-pressed={stageF === n} style={{ '--c': ink, '--i': i }}>
              <span className="stage-name">{n}</span>
              <span className="stage-track"><span className="stage-fill" style={{ width: `${data ? (count(n) / maxStage) * 100 : 0}%` }} /></span>
              <span className="stage-n">{count(n)}</span>
            </button>))}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <Select className="input" style={{ width: 'auto' }} aria-label="Which funds" value={view} onChange={e => setView(e.target.value)}><option value="all">All funds</option><option value="mine">My funds</option></Select>
          <Select className="input" style={{ width: 'auto' }} aria-label="Stage" value={stageF} onChange={e => setStageF(e.target.value)}><option value="">All stages</option>{STAGES.map(([n]) => <option key={n} value={n}>{n}</option>)}</Select>
          <Select className="input" style={{ width: 'auto' }} aria-label="Client" value={clientF} onChange={e => setClientF(e.target.value)}><option value="">All clients</option>{clients.map(c => <option key={c} value={c}>{c}</option>)}</Select>
          <input className="input" style={{ width: 220, maxWidth: '100%' }} aria-label="Search funds" placeholder="Search client or fund" value={q} onChange={e => setQ(e.target.value)} />
          <span style={{ ...cap, ...muted, marginLeft: 'auto' }}>{shown.length} of {rows.length} funds</span>
        </div>
        <div className="dt" style={{ '--cols': grid, '--min': '1080px' }}>
          <div className="dt-head">
            {['Client', 'Fund', 'Year end', 'Stage', 'Waiting for', 'Open', 'Overdue', 'Responded', 'Last activity'].map(c => <span key={c} style={{ ...cap, ...muted }}>{c}</span>)}
          </div>
          {!shown.length && <div style={{ ...body, ...muted, padding: 12 }}>No funds in this view.</div>}
          {shown.map(r => (
            <button key={r.id} type="button" className="row dt-row" onClick={() => onOpen(r.eng, STAGE[r.stage].tab)} aria-label={`Open ${r.fund}`}
              style={{ border: 0, background: 'transparent', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <span className="dt-hide-sm" style={{ ...cap, overflowWrap: 'anywhere' }}>{r.client}</span>
              <span className="dt-main" style={{ ...body, fontWeight: 600 }}>{r.fund}<span className="sm-only" style={{ ...cap, ...muted, display: 'block', fontWeight: 400 }}>{r.client}</span></span>
              <span data-label="Year end" style={cap}>{r.yearEnd ? fmtDate(r.yearEnd) : '—'}</span>
              <span data-label="Stage"><Pill bg={STAGE[r.stage].bg}><span className="stage-dot" style={{ background: STAGE[r.stage].ink }} />{r.stage}</Pill></span>
              <span data-label="Waiting for" style={cap}>{r.ownerName}</span>
              <span data-label="Open" style={body}>{r.open || '—'}</span>
              <span data-label="Overdue" style={{ ...body, color: r.overdue ? 'var(--pa-red)' : undefined, fontWeight: r.overdue ? 600 : 400 }}>{r.overdue || '—'}</span>
              <span data-label="Responded" style={body}>{r.responded || '—'}</span>
              <span data-label="Last activity" style={{ ...cap, ...muted }}>{ago(r.last)}</span>
            </button>))}
        </div>
      </Card>
    </div>
  );
}
