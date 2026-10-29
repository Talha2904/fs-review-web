import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button, Card, Pill, cap, body, h2, h3, muted, page, RING } from '../components/ui';
import { fmtDate } from '../lib/format';
import { saveFile } from '../lib/download';
import { reviewStore } from '../lib/reviewStore';
import { useLive } from '../lib/useLive';

// The stage a fund's review has reached, who it is waiting for, and the screen to open.
const STAGES = [
  ['Not started', 'var(--snow-ink-5)', 'preparer', 'docs'],
  ['Preparing documents', 'var(--snow-ink-5)', 'preparer', 'docs'],
  ['Sent back to preparer', 'var(--snow-status-approved-bg)', 'preparer', 'docs'],
  ['Ready to analyse', 'var(--snow-primary-blue)', 'reviewer', 'docs'],
  ['In review', 'var(--snow-primary-blue)', 'preparer', 'sched'],
  ['Returned to reviewer', 'var(--snow-status-approved-bg)', 'reviewer', 'signoff'],
  ['Ready for sign-off', 'var(--snow-primary-purple)', 'manager', 'signoff'],
  ['Awaiting partner', 'var(--snow-primary-purple)', 'partner', 'signoff'],
  ['Signed off', 'var(--snow-status-complete-bg)', null, 'signoff']
];
const STAGE = Object.fromEntries(STAGES.map(([n, bg, owner, tab], i) => [n, { bg, owner, tab, order: i }]));
const ago = iso => { if (!iso) return '—'; const d = Math.floor((Date.now() - new Date(iso)) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };

export default function PortfolioTab({ engagements, user, onOpen }) {
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
    await saveFile(`portfolio-${today()}.xlsx`, new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]));
  };
  const grid = 'minmax(170px,1.3fr) minmax(150px,1.1fr) 104px 170px 150px 70px 70px 70px 100px';

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 760 }}>
          <div style={h2}>Portfolio</div>
          <div style={{ ...body, ...muted, marginTop: 6 }}>Every fund’s review: where it has reached, who it is waiting for, and its open and overdue points. Click a fund to open it.{loadError ? ` The portfolio could not be loaded: ${loadError}` : ''}</div>
        </div>
        <Button kind="secondary" onClick={exportX}>Export (.xlsx)</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {tiles.map(([k, v, x]) => <div key={k} style={{ background: '#fff', boxShadow: RING, borderRadius: 14, padding: 14 }}><div style={{ ...cap, ...muted }}>{k}</div><div style={{ ...h3, marginTop: 4, color: k === 'Overdue points' && v ? '#B42318' : undefined }}>{v}</div>{x && <div style={{ ...cap, ...muted, marginTop: 2 }}>{x}</div>}</div>)}
      </div>

      <Card>
        <div style={{ ...body, fontWeight: 600 }}>Funds by stage</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {STAGES.map(([n, bg]) => (
            <button key={n} type="button" onClick={() => setStageF(stageF === n ? '' : n)} aria-pressed={stageF === n}
              style={{ display: 'grid', gridTemplateColumns: '180px 1fr 36px', gap: 10, alignItems: 'center', border: 0, background: stageF === n ? 'var(--snow-primary-light)' : 'transparent', borderRadius: 8, padding: '3px 6px', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
              <span style={cap}>{n}</span>
              <span style={{ height: 12, borderRadius: 6, background: 'var(--snow-ink-5)' }}><span style={{ display: 'block', height: 12, borderRadius: 6, width: `${(count(n) / maxStage) * 100}%`, background: bg === 'var(--snow-ink-5)' ? '#B8BEC9' : bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} /></span>
              <span style={{ ...cap, textAlign: 'right' }}>{count(n)}</span>
            </button>))}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <select className="input" style={{ width: 'auto' }} aria-label="Which funds" value={view} onChange={e => setView(e.target.value)}><option value="all">All funds</option><option value="mine">My funds</option></select>
          <select className="input" style={{ width: 'auto' }} aria-label="Stage" value={stageF} onChange={e => setStageF(e.target.value)}><option value="">All stages</option>{STAGES.map(([n]) => <option key={n} value={n}>{n}</option>)}</select>
          <select className="input" style={{ width: 'auto' }} aria-label="Client" value={clientF} onChange={e => setClientF(e.target.value)}><option value="">All clients</option>{clients.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <input className="input" style={{ width: 220 }} aria-label="Search funds" placeholder="Search client or fund" value={q} onChange={e => setQ(e.target.value)} />
          <span style={{ ...cap, ...muted, marginLeft: 'auto' }}>{shown.length} of {rows.length} funds</span>
        </div>
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 10, padding: '8px 10px', minWidth: 1080, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)' }}>
            {['Client', 'Fund', 'Year end', 'Stage', 'Waiting for', 'Open', 'Overdue', 'Responded', 'Last activity'].map(c => <span key={c} style={{ ...cap, ...muted }}>{c}</span>)}
          </div>
          {!shown.length && <div style={{ ...body, ...muted, padding: 12 }}>No funds in this view.</div>}
          {shown.map(r => (
            <button key={r.id} type="button" className="row" onClick={() => onOpen(r.eng, STAGE[r.stage].tab)} aria-label={`Open ${r.fund}`}
              style={{ display: 'grid', gridTemplateColumns: grid, gap: 10, alignItems: 'center', padding: '10px', minWidth: 1080, width: '100%', border: 0, background: 'transparent', font: 'inherit', textAlign: 'left', cursor: 'pointer', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)' }}>
              <span style={{ ...cap, overflowWrap: 'anywhere' }}>{r.client}</span>
              <span style={{ ...body, fontWeight: 600 }}>{r.fund}</span>
              <span style={cap}>{r.yearEnd ? fmtDate(r.yearEnd) : '—'}</span>
              <span><Pill bg={STAGE[r.stage].bg}>{r.stage}</Pill></span>
              <span style={cap}>{r.ownerName}</span>
              <span style={body}>{r.open || '—'}</span>
              <span style={{ ...body, color: r.overdue ? '#B42318' : undefined, fontWeight: r.overdue ? 600 : 400 }}>{r.overdue || '—'}</span>
              <span style={body}>{r.responded || '—'}</span>
              <span style={{ ...cap, ...muted }}>{ago(r.last)}</span>
            </button>))}
        </div>
      </Card>
    </div>
  );
}
