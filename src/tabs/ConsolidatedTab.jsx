import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, CardHead, InfoTip, Pill, STATUS_LABEL, cap, body, h2, h3, muted, page } from '../components/ui';
import { fmt, fmtDate, sym, whenOf, plural } from '../lib/format';
import { reviewStore } from '../lib/reviewStore';
import { useLive } from '../lib/useLive';
import Select from '../components/Select';

// The Consolidated Review (meeting point 2): every fund of the entities that share a Client name and year end,
// reviewed together on the api from each fund's latest analysis. This screen picks the group, starts a review,
// follows it while it runs, and shows the balances between the funds and the review points they share.
const STEPS = ['Reading each fund’s latest analysis', 'Matching balances between entities', 'AI review of what needs judgement', 'Saving the review'];
const LINK = {
  agrees: ['Agrees', 'var(--snow-status-complete-bg)'],
  differs: ['Differs', 'var(--snow-status-rejected-bg)'],
  'different-currency': ['Different currencies', 'var(--snow-status-approved-bg)'],
  'no-amount': ['No amount to compare', 'var(--snow-ink-5)']
};
const keyOf = g => (g ? `${g.groupKey}|${g.yearEnd}` : '');
const money = (v, cur) => (v == null ? '—' : sym(cur) + fmt(v));
const alertBox = { ...cap, background: 'var(--snow-status-rejected-bg)', borderRadius: 8, padding: '8px 12px' };

// `focus`: opened from a fund or an entity ({ engagementId } or { entityName }); its group is chosen if it has one.
export default function ConsolidatedTab({ focus, canRun, canLink, onOpenPoint, onOpenFund, onCommonPoint }) {
  const [groupsData, groupsError] = useLive(() => reviewStore.consolidatedGroups(), null);
  const groups = groupsData?.groups || null;
  const [key, setKey] = useState('');
  const [notFound, setNotFound] = useState('');
  // choose the group: the one the screen was opened for (once per opening, so a group picked here afterwards
  // stays picked when the list refreshes), else keep the current one, else the first
  const applied = useRef(null);
  useEffect(() => {
    if (!groups) return;
    const fresh = focus && applied.current !== focus;
    const wanted = fresh && groups.find(g => g.funds.some(f => (focus.engagementId ? f.engagementId === focus.engagementId : f.entityName === focus.entityName)));
    if (fresh) { applied.current = focus; setNotFound(wanted ? '' : focus.label || 'This fund'); }
    setKey(k => (wanted ? keyOf(wanted) : groups.some(g => keyOf(g) === k) ? k : keyOf(groups[0])));
  }, [groups, focus]);
  const group = groups?.find(g => keyOf(g) === key) || null;

  const [data, loadError, reload] = useLive(() => (group ? reviewStore.consolidatedReview(group.groupKey, group.yearEnd) : Promise.resolve(null)), null, [key]);
  const [starting, setStarting] = useState(false), [startError, setStartError] = useState('');
  useEffect(() => setStartError(''), [key]);

  const latest = data?.latest;
  const busy = starting || latest?.status === 'queued' || latest?.status === 'running';
  const funds = data?.group?.funds || group?.funds || [];
  const analysed = funds.filter(f => f.analysed).length;
  const result = data?.review?.result || null;
  // only a note that the AI step failed is shown; the model's name and "AI matched…" lines are not
  const aiNote = result?.aiNote && !result.aiNote.startsWith('AI (') ? result.aiNote : '';
  const fundOf = id => funds.find(f => f.engagementId === id);
  const nameOf = id => fundOf(id)?.fundName || 'another fund';

  // link one recurring matter's points into one shared point (one thread; each fund still clears its own)
  const [linking, setLinking] = useState(''), [linkError, setLinkError] = useState({});
  const lockedFund = id => !!funds.find(f => f.engagementId === id)?.locked;
  const linkable = g => g.points.filter(p => p.pointId && !lockedFund(p.engagementId));
  const link = async g => {
    setLinking(g.key); setLinkError(e => ({ ...e, [g.key]: '' }));
    try { await reviewStore.linkShared(linkable(g).map(p => p.pointId)); reload(); }
    catch (e) { setLinkError(x => ({ ...x, [g.key]: e.message })); }
    finally { setLinking(''); }
  };
  const run = async () => {
    setStarting(true); setStartError('');
    try { await reviewStore.startConsolidated(group.groupKey, group.yearEnd); reload(); }
    catch (e) { setStartError(e.message); }
    finally { setStarting(false); }
  };
  const runBlock = !canRun ? 'Your role can view the Consolidated Review but not run it.'
    : analysed < 2 ? 'At least two funds in the group need a completed analysis.' : '';

  const links = result?.links || [], unmatched = result?.unmatched || [], common = result?.groups || [];
  const differing = links.filter(l => l.status === 'differs').length;

  return (
    <div style={page}>
      <div style={{ maxWidth: 760 }}>
        <div style={h2}>Consolidated Review<InfoTip label="About the Consolidated Review">
          Funds are grouped when their entities have the same Client name (Edit Entity) and the same year end. The review reads each fund’s latest analysis, never the documents again: the app pairs balances that name each other and works out every difference. Where AI is on and the clients permit it, Claude also pairs balances named by role (such as “the manager”) and groups review points worded differently. Only what the app could not match is sent, and only for funds whose client permits AI: fund and entity names and types, line labels (which can be a short sentence from a related-party note), amounts, and review point titles. The documents themselves are not sent.
        </InfoTip></div>
        <div style={{ ...body, ...muted, marginTop: 6 }}>Related funds reviewed together: the balances between them and the points they share.</div>
        {groupsError && <div role="alert" style={{ ...alertBox, marginTop: 8 }}>The groups could not be loaded: {groupsError}</div>}
      </div>

      {notFound && <div role="status" style={{ ...cap, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '10px 14px' }}>
        {notFound} is not in a group yet. A group needs two or more funds with the same year end whose entities have the same Client name.</div>}

      {groups && !groups.length && (
        <Card><div style={body}>No groups yet.</div>
          <div style={{ ...cap, ...muted, marginTop: 4 }}>Give related entities the same Client name under Edit Entity. Their funds with the same year end then appear here as one group.</div></Card>
      )}

      {group && (
        <Card>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <Select className="input" style={{ width: 'auto', maxWidth: '100%' }} aria-label="Group" value={key} onChange={e => { setKey(e.target.value); setNotFound(''); }}>
              {groups.map(g => <option key={keyOf(g)} value={keyOf(g)}>{g.groupName} · {g.yearEnd ? fmtDate(g.yearEnd) : 'no year end'} · {plural(g.funds.length, 'fund')}</option>)}
            </Select>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {runBlock && <span style={{ ...cap, ...muted }}>{runBlock}</span>}
              {onCommonPoint && <Button kind="secondary" onClick={() => onCommonPoint(group)}>Common Review Point</Button>}
              <Button disabled={busy || !!runBlock} onClick={run}>{busy ? 'Running…' : data?.review ? 'Run again' : 'Run the review'}</Button>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {funds.map(f => (
              <button key={f.engagementId} type="button" className="link" onClick={() => onOpenFund(f.engagementId)} title={`${f.entityName} · open this fund`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={cap}>{f.fundName}</span>
                <Pill bg={f.analysed ? 'var(--snow-status-complete-bg)' : 'var(--snow-ink-5)'}>{f.analysed ? 'Analysed' : 'Not analysed'}</Pill>
              </button>))}
          </div>
          {data?.review && <div style={{ ...cap, ...muted, marginTop: 10 }}>Last run {whenOf(data.review.finishedAt)} by {data.review.requestedBy?.name}.</div>}
          {loadError && <div role="alert" style={{ ...alertBox, marginTop: 10 }}>The review could not be loaded: {loadError}</div>}
          {startError && <div role="alert" style={{ ...alertBox, marginTop: 10 }}>{startError}</div>}
          {busy && (
            <div role="status" style={{ ...cap, background: 'var(--snow-primary-blue)', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
              {latest && ['queued', 'running'].includes(latest.status)
                ? `Step ${Math.min(latest.step + 1, latest.total)} of ${latest.total}: ${STEPS[Math.min(latest.step, STEPS.length - 1)]}…`
                : 'Starting the review…'}
            </div>)}
          {data?.review?.withheld && !busy && (
            <div role="status" style={{ ...cap, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
              The last review read a fund that has since been deleted, so its results are hidden. Run it again to review the funds now in the group.
            </div>)}
          {latest?.status === 'failed' && !busy && <div role="alert" style={{ ...alertBox, marginTop: 10 }}>The last run did not complete: {latest.error}</div>}
          {data?.stale && !busy && (
            <div role="status" style={{ ...cap, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
              Out of date. {[
                data.stale.changed.length && `Analysed since the last run: ${data.stale.changed.join(', ')}.`,
                data.stale.added.length && `Added to the group: ${data.stale.added.join(', ')}.`,
                data.stale.removed.length && `No longer in the group: ${data.stale.removed.join(', ')}.`
              ].filter(Boolean).join(' ')} Run it again to bring it up to date.
            </div>)}
        </Card>
      )}

      {result && (<>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 12 }}>
          {[['Balances between funds', links.length, '#3FB8C9'], ['Differ', differing, differing ? 'var(--pa-red)' : '#AEB9C9'],
            ['With no match', unmatched.length, unmatched.length ? '#E9B949' : '#AEB9C9'], ['Recurring matters', common.length, '#14213D']].map(([k, v, c]) => (
            <div key={k} className="kpi" style={{ '--c': c }}><div className="kpi-k">{k}</div><div className={'kpi-v' + (k === 'Differ' && v ? ' is-alert' : '')}>{v}</div></div>))}
        </div>

        {(result.summary || aiNote) && (
          <Card>
            {result.summary && <>
              <div style={{ ...cap, ...muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>Key finding</div>
              <div style={{ ...body, marginTop: 4 }}>{result.summary}</div>
            </>}
            {aiNote && <div style={{ ...cap, ...muted, marginTop: result.summary ? 8 : 0 }}>{aiNote}</div>}
          </Card>)}

        <Card>
          <CardHead title="Balances between funds" info="Each row is one balance seen from both sides: what one fund says another owes it, against what that fund records. The difference is the gap between the two amounts, worked out by the app; amounts within 1 of each other agree." />
          {!links.length ? <div style={{ ...body, ...muted, marginTop: 8 }}>No balances between these funds were found.</div> : (
            <div className="dt" style={{ '--cols': 'minmax(200px,1.4fr) minmax(200px,1.4fr) 120px 150px', '--min': '760px', marginTop: 8 }}>
              <div className="dt-head">{['Fund and line', 'Other side', 'Difference', 'Status'].map(c => <span key={c} style={{ ...cap, ...muted }}>{c}</span>)}</div>
              {links.map((l, i) => (
                <div key={i} className="row dt-row">
                  <Side c={l.a} />
                  <span data-label="Other side"><Side c={l.b} inline /></span>
                  <span data-label="Difference" style={{ ...body, fontWeight: l.status === 'differs' ? 600 : 400, color: l.status === 'differs' ? 'var(--pa-red)' : undefined }}>
                    {l.difference == null ? '—' : money(Math.abs(l.difference), l.a.currency)}</span>
                  <span data-label="Status" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                    <Pill bg={LINK[l.status]?.[1]}>{LINK[l.status]?.[0] || l.status}</Pill>
                    {l.matchedBy === 'ai' && <span style={{ ...cap, ...muted }}>Paired by AI{l.relationship ? `: ${l.relationship}` : ''}{l.note ? `. ${l.note}` : ''}</span>}
                  </span>
                </div>))}
            </div>)}
        </Card>

        {result.groupBalances && <GroupBalances g={result.groupBalances} />}

        {unmatched.length > 0 && (
          <UnmatchedCard rows={unmatched} nameOf={nameOf} />)}

        <Card>
          <CardHead title="Recurring matters" info="Review points that are the same matter in two or more funds: the same check, the same title, or (with AI) the same issue worded differently. Link them as one common review point to read their comments in one thread; each fund still responds to and clears its own point. Statuses are as they are now." />
          {!common.length ? <div style={{ ...body, ...muted, marginTop: 8 }}>No open matter recurs across these funds.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              {common.map(g => (
                <div key={g.key} style={{ borderTop: '1px solid var(--snow-ink-5)', paddingTop: 10 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ ...body, fontWeight: 600 }}>{g.title}{g.matchedBy === 'ai' && <span style={{ ...cap, ...muted, fontWeight: 400 }}> · grouped by AI</span>}</div>
                    {(() => {
                      const live = g.points.filter(p => p.pointId), open = linkable(g);
                      const ids = new Set(live.map(p => p.sharedGroupId));
                      if (live.length >= 2 && ids.size === 1 && !ids.has(null)) return <Pill bg="var(--snow-primary-purple)">Common review point</Pill>;
                      return canLink && open.length >= 2 && new Set(open.map(p => p.engagementId)).size === open.length
                        ? <Button size="sm" kind="secondary" disabled={linking === g.key} onClick={() => link(g)}>{linking === g.key ? 'Linking…' : 'Link as one common point'}</Button> : null;
                    })()}
                  </div>
                  {canLink && g.points.some(p => p.pointId && lockedFund(p.engagementId)) && linkable(g).length >= 2 && !g.points.every(p => p.sharedGroupId && p.sharedGroupId === g.points[0].sharedGroupId) && (
                    <div style={{ ...cap, ...muted, marginTop: 4 }}>Signed off, so not linked: {[...new Set(g.points.filter(p => lockedFund(p.engagementId)).map(p => p.fundName))].join(', ')}.</div>)}
                  {linkError[g.key] && <div role="alert" style={{ ...alertBox, marginTop: 6 }}>{linkError[g.key]}</div>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {g.points.map(p => (
                      <button key={p.engagementId + p.ref} type="button" className="link" disabled={p.status === 'removed'} onClick={() => onOpenPoint(p.engagementId, p.ref)} title={p.title}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={cap}>{p.fundName} · {p.ref}</span>
                        <Pill>{p.status === 'removed' ? 'No longer in the fund' : STATUS_LABEL[p.status] || ({ responded: 'Responded', reopened: 'Reopened' })[p.status] || p.status}</Pill>
                      </button>))}
                  </div>
                </div>))}
            </div>)}
        </Card>
      </>)}
    </div>
  );
}

// One side of a balance: the fund, the line, where it was found, and the amount in that fund's currency.
function Side({ c, inline }) {
  return (
    <span className={inline ? undefined : 'dt-main'} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span style={{ ...cap, ...muted }}>{c.fundName}</span>
      <span style={{ ...body, overflowWrap: 'anywhere' }}>{c.label} <strong>{money(c.amount, c.currency)}</strong></span>
      <span style={{ ...cap, ...muted }}>{c.where}</span>
    </span>
  );
}

const SIDE = { receivable: 'Owed to the fund', payable: 'Owed by the fund', flow: 'Income or charge' };

// "Lines with no match" starts collapsed: the header is a button that shows the line count and opens the table.
// The ⓘ sits beside the button, not inside it, so it keeps working on its own. The table stays mounted while
// hidden, so its filters and sort survive collapsing.
function UnmatchedCard({ rows, nameOf }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <button type="button" aria-expanded={open} aria-controls="unmatched-body" onClick={() => setOpen(o => !o)}
            style={{ ...h3, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: 0, color: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
            <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true" style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', flex: 'none' }}>
              <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Lines with no match
          </button>
          <InfoTip label="About Lines with no match">A balance or related-party line in one fund that may be owed to or by another entity in the group (it names one, or a related party such as the manager), with no line to pair it with. The other side may be missing, worded differently, or netted off; with AI on, Claude pairs lines named by role.</InfoTip>
        </div>
        <span style={{ ...cap, ...muted }}>{plural(rows.length, 'line')}</span>
      </div>
      <div id="unmatched-body" hidden={!open}><Unmatched rows={rows} nameOf={nameOf} /></div>
    </Card>
  );
}

// The lines with no match as a table: filter by fund and side, sort by amount, and the total of what is shown.
function Unmatched({ rows, nameOf }) {
  const [fund, setFund] = useState(''), [side, setSide] = useState(''), [sort, setSort] = useState('');
  const fundsIn = useMemo(() => [...new Map(rows.map(c => [c.engagementId, c.fundName])).entries()], [rows]);
  const cur = rows[0]?.currency;
  const oneCur = rows.every(c => c.currency === cur);
  const shown = useMemo(() => {
    const list = rows.filter(c => (!fund || c.engagementId === fund) && (!side || c.side === side));
    if (sort) list.sort((x, y) => (sort === 'desc' ? -1 : 1) * (Math.abs(x.amount ?? 0) - Math.abs(y.amount ?? 0)));
    return list;
  }, [rows, fund, side, sort]);
  const sum = list => list.reduce((t, c) => t + Math.abs(c.amount ?? 0), 0);
  const th = { ...cap, ...muted };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...cap, ...muted }}>{plural(shown.length, 'line')} shown</span>
        {(
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Select className="input" style={{ width: 'auto', maxWidth: '100%' }} aria-label="Fund" value={fund} onChange={e => setFund(e.target.value)}>
              <option value="">All funds</option>{fundsIn.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
            <Select className="input" style={{ width: 'auto', maxWidth: '100%' }} aria-label="Side" value={side} onChange={e => setSide(e.target.value)}>
              <option value="">All sides</option><option value="receivable">Owed to the fund</option><option value="payable">Owed by the fund</option><option value="flow">Income or charge</option>
            </Select>
          </div>)}
      </div>
      {(
        <div className="dt" style={{ '--cols': 'minmax(180px,1.2fr) minmax(220px,1.8fr) 150px 140px', '--min': '720px', marginTop: 0 }}>
          <div className="dt-head">
            <span style={th}>Fund</span><span style={th}>Line</span><span style={th}>Side</span>
            <button type="button" className="link" style={{ ...th, textAlign: 'right' }} onClick={() => setSort(s => (s === 'desc' ? 'asc' : 'desc'))}
              aria-label="Sort by amount">Amount {sort === 'desc' ? '↓' : sort === 'asc' ? '↑' : '↕'}</button>
          </div>
          {!shown.length && <div style={{ ...body, ...muted, padding: '10px 0' }}>No line matches these filters.</div>}
          {shown.map(c => (
            <div key={c.id} className="row dt-row">
              <span className="dt-main" style={{ ...body, fontWeight: 600, overflowWrap: 'anywhere' }}>{c.fundName}</span>
              <span data-label="Line" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ ...body, overflowWrap: 'anywhere' }}>{c.label}</span>
                <span style={{ ...cap, ...muted }}>{c.where}{c.mentions?.length ? ` · names ${c.mentions.map(nameOf).join(', ')}` : ' · names no fund'}</span>
              </span>
              <span data-label="Side" style={cap}>{SIDE[c.side] || c.side}</span>
              <span data-label="Amount" style={{ ...body, textAlign: 'right' }}>{money(c.amount, c.currency)}</span>
            </div>))}
          {shown.length > 1 && oneCur && side && (
            <div className="dt-row" style={{ fontWeight: 600 }}>
              <span className="dt-main" style={body}>Total shown</span><span /><span />
              <span data-label="Total" style={{ ...body, textAlign: 'right' }}>{money(sum(shown), cur)}</span>
            </div>)}
        </div>
      )}
    </div>
  );
}

// Balances with "the group" that name no fund: inside one group each is another member's balance, so what the
// group is owed and what it owes should agree. The app adds them up; a difference is shown, never explained away.
function GroupBalances({ g }) {
  const cur = g.currency;
  const [label, bg] = g.status === 'agrees' ? ['Agrees', 'var(--snow-status-complete-bg)'] : g.status === 'differs' ? ['Differs', 'var(--snow-status-rejected-bg)'] : ['Different currencies', 'var(--snow-status-approved-bg)'];
  return (
    <Card>
      <CardHead title="Balances with the group" info="Lines such as “Due from group entities” name no fund, but every fund here is in the same group, so each is a balance with another member. Lines naming another fund here are counted too. Added up across the group, what the funds are owed by the group should equal what they owe to it; the difference is worked out by the app. Balances with group entities outside this review (such as a parent above them) also show as a difference." />
      {cur == null ? <div style={{ ...body, marginTop: 8 }}>The funds use different currencies, so the group totals are not added up. Each fund’s balances are in its own currency.</div> : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', alignItems: 'center', marginTop: 8 }}>
        <span style={body}>Owed to the funds by the group: <strong>{money(g.owedTo, cur)}</strong></span>
        <span style={body}>Owed by the funds to the group: <strong>{money(g.owedBy, cur)}</strong></span>
        {g.difference != null && <span style={{ ...body, color: g.status === 'differs' ? 'var(--pa-red)' : undefined }}>Difference: <strong>{money(Math.abs(g.difference), cur)}</strong></span>}
        <Pill bg={bg}>{label}</Pill>
      </div>)}
      {g.status === 'differs' && <div style={{ ...cap, ...muted, marginTop: 6 }}>A difference means a balance is recorded on one side only, recorded at different amounts, or owed to or by a group entity outside this review.</div>}
      {g.notAnalysed?.length > 0 && (
        <div role="status" style={{ ...cap, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
          Not analysed, so missing from these totals: {g.notAnalysed.join(', ')}. Analyse {g.notAnalysed.length === 1 ? 'it' : 'them'} and run the review again.
        </div>)}
      <div className="dt" style={{ '--cols': 'minmax(200px,1.6fr) 170px 170px', '--min': '560px', marginTop: 10 }}>
        <div className="dt-head">{['Fund', 'Owed to the fund', 'Owed by the fund'].map(c => <span key={c} style={{ ...cap, ...muted }}>{c}</span>)}</div>
        {g.funds.map(f => (
          <div key={f.engagementId} className="row dt-row">
            <span className="dt-main" style={{ ...body, fontWeight: 600, overflowWrap: 'anywhere' }}>{f.fundName}</span>
            <span data-label="Owed to the fund" style={body}>{f.owedTo ? money(f.owedTo, f.currency || cur) : '—'}</span>
            <span data-label="Owed by the fund" style={body}>{f.owedBy ? money(f.owedBy, f.currency || cur) : '—'}</span>
          </div>))}
        {cur != null && <div className="dt-row" style={{ fontWeight: 600 }}>
          <span className="dt-main" style={body}>Group total</span>
          <span data-label="Owed to the funds" style={body}>{money(g.owedTo, cur)}</span>
          <span data-label="Owed by the funds" style={body}>{money(g.owedBy, cur)}</span>
        </div>}
      </div>
    </Card>
  );
}
