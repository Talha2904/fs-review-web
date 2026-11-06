import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, CardHead, InfoTip, Pill, STATUS_LABEL, cap, body, h2, muted, page } from '../components/ui';
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
export default function ConsolidatedTab({ focus, canRun, onOpenPoint, onOpenFund }) {
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
  const fundOf = id => funds.find(f => f.engagementId === id);
  const nameOf = id => fundOf(id)?.fundName || 'another fund';

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
            ['With no match', unmatched.length, unmatched.length ? '#E9B949' : '#AEB9C9'], ['Shared points', common.length, '#14213D']].map(([k, v, c]) => (
            <div key={k} className="kpi" style={{ '--c': c }}><div className="kpi-k">{k}</div><div className={'kpi-v' + (k === 'Differ' && v ? ' is-alert' : '')}>{v}</div></div>))}
        </div>

        {(result.summary || result.aiNote) && (
          <Card>
            {result.summary && <div style={body}>{result.summary}</div>}
            {result.aiNote && <div style={{ ...cap, ...muted, marginTop: result.summary ? 8 : 0 }}>{result.aiNote}</div>}
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

        {unmatched.length > 0 && (
          <Card>
            <CardHead title="Lines with no match" info="A balance or related-party line in one fund that may be owed to or by another entity in the group (it names one, or a related party such as the manager), with no line to pair it with. The other side may be missing, worded differently, or netted off; with AI on, Claude pairs lines named by role." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {unmatched.map(c => (
                <div key={c.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
                  <span style={body}><strong>{c.fundName}</strong>: {c.label} <span style={{ ...cap, ...muted }}>({c.where}{c.mentions?.length ? ` · names ${c.mentions.map(nameOf).join(', ')}` : ''})</span></span>
                  <span style={body}>{money(c.amount, c.currency)}</span>
                </div>))}
            </div>
          </Card>)}

        <Card>
          <CardHead title="Shared points" info="Review points that are the same matter in two or more funds: the same check, the same title, or (with AI) the same issue worded differently. Each fund’s point is still cleared in that fund." />
          {!common.length ? <div style={{ ...body, ...muted, marginTop: 8 }}>No open matter recurs across these funds.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              {common.map(g => (
                <div key={g.key} style={{ borderTop: '1px solid var(--snow-ink-5)', paddingTop: 10 }}>
                  <div style={{ ...body, fontWeight: 600 }}>{g.title}{g.matchedBy === 'ai' && <span style={{ ...cap, ...muted, fontWeight: 400 }}> · grouped by AI</span>}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {g.points.map(p => (
                      <button key={p.engagementId + p.ref} type="button" className="link" onClick={() => onOpenPoint(p.engagementId, p.ref)} title={p.title}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={cap}>{p.fundName} · {p.ref}</span>
                        <Pill>{STATUS_LABEL[p.status] || p.status}</Pill>
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
