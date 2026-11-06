import React, { useMemo, useState } from 'react';
import { runnable } from '../data/checkLibrary';
import { useLibrary } from '../lib/library';
import { fmt, fmtDate, sym } from '../lib/format';
import { Button, Card, Pill, cap, body, h2, h3, muted, page } from '../components/ui';
import { personName } from '../lib/people';
import { reviewStore } from '../lib/reviewStore';
import { entityAi } from '../lib/aiDecision';

const GRID = 'minmax(200px,2fr) 108px repeat(3, minmax(88px,1fr)) 92px 64px 204px';
const COLS = ['Fund', 'Year end', 'Preparer', 'Reviewer', 'Manager', 'Threshold', 'Checks', ''];
const saved = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const has = (text, q) => String(text || '').toLowerCase().includes(q);

// Funds (engagements) listed under the entity they belong to. Funds whose entity is not set, or
// no longer exists, are kept in a final group so they can be linked.
export default function EngagementList({ rulesOf = e => e.rules || {}, people = [], engagements, entities, activeId, mode, loadError, notice, locked, canWrite, onAdd, onOpen, onActivate, onAddEntity, onEditEntity, onConsolidated }) {
  const LIBRARY = useLibrary();
  const [q, setQ] = useState('');
  const where = mode === 'shared' ? 'Saved engagements are shared with everyone who can open this app.' : 'Saved engagements are shared with everyone who signs in.';

  // entities in a Consolidated Review group: as on the api, entities with the same Client name (else name) whose
  // funds include two or more with the same year end
  const inGroup = useMemo(() => {
    const keyOf = ent => (String(ent.client || '').trim() || String(ent.name || '')).toLowerCase().replace(/\s+/g, ' ').trim();
    const entKey = new Map((entities || []).map(ent => [ent.id, keyOf(ent)]));
    const n = new Map();
    (engagements || []).forEach(g => { const k = entKey.get(g.entityId); if (k != null) { const kk = `${k}|${g.fund?.yearEnd || ''}`; n.set(kk, (n.get(kk) || 0) + 1); } });
    const grouped = new Set([...n].filter(([, c]) => c >= 2).map(([kk]) => kk.slice(0, kk.lastIndexOf('|'))));
    return ent => grouped.has(entKey.get(ent.id));
  }, [entities, engagements]);
  const groups = useMemo(() => {
    const byEntity = new Map((entities || []).map(e => [e.id, []]));
    const unlinked = [];
    (engagements || []).forEach(g => (byEntity.has(g.entityId) ? byEntity.get(g.entityId) : unlinked).push(g));
    const sortFunds = list => list.slice().sort((a, b) => (a.fund?.name || '').localeCompare(b.fund?.name || '') || (b.fund?.yearEnd || '').localeCompare(a.fund?.yearEnd || ''));
    const query = q.trim().toLowerCase();
    const out = (entities || []).slice().sort((a, b) => a.name.localeCompare(b.name)).map(ent => {
      const funds = sortFunds(byEntity.get(ent.id));
      if (!query) return { ent, funds };
      const entityHit = has(ent.name, query) || has(ent.client, query);
      return { ent, funds: entityHit ? funds : funds.filter(f => has(f.fund?.name, query)) , hide: !entityHit && !funds.some(f => has(f.fund?.name, query)) };
    }).filter(g => !g.hide);
    const un = sortFunds(unlinked).filter(f => !query || has(f.fund?.name, query));
    if (un.length) out.push({ ent: null, funds: un });
    return out;
  }, [engagements, entities, q]);

  const loading = engagements === null || entities === null;
  const nothing = !loading && !(engagements || []).length && !(entities || []).length;

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 680 }}>
          <div style={h2}>Engagements</div>
          <div style={{ ...body, ...muted, marginTop: 6 }}>Click In Review on a fund to open its documents and analysis. {mode && where}</div>
        </div>
        {canWrite && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button size="lg" kind="secondary" onClick={onAddEntity}>Add Entity</Button>
            <Button size="lg" onClick={() => onAdd(null)}>Add Engagement</Button>
          </div>
        )}
      </div>

      {notice && <div role="status" style={{ ...cap, background: 'var(--snow-status-complete-bg)', borderRadius: 8, padding: '10px 14px' }}>{notice}</div>}
      {loadError && <div role="alert" style={{ ...cap, background: 'var(--snow-status-rejected-bg)', borderRadius: 8, padding: '10px 14px' }}>{loadError}</div>}

      {loading ? <Card><div style={{ ...body, ...muted }}>Loading engagements…</div></Card> : nothing ? (
        <Card>
          <div style={{ padding: '24px 0', maxWidth: 560 }}>
            <div style={h3}>No entities or engagements yet</div>
            <div style={{ ...body, ...muted, marginTop: 6 }}>Start by adding the entity, such as the ICAV umbrella, then add each of its funds.</div>
            {canWrite ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}><Button onClick={onAddEntity}>Add Entity</Button></div>
              : <div style={{ ...cap, ...muted, marginTop: 12 }}>Your role cannot add entities or engagements.</div>}
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <input className="input" type="search" style={{ maxWidth: 360 }} aria-label="Search entities and funds" placeholder="Search entity, client or fund" value={q} onChange={e => setQ(e.target.value)} />
            <span style={{ ...cap, ...muted }}>{(entities || []).length} entit{(entities || []).length === 1 ? 'y' : 'ies'}, {(engagements || []).length} fund engagement{(engagements || []).length === 1 ? '' : 's'}</span>
          </div>
          {!groups.length && <Card><div style={{ ...body, ...muted }}>Nothing matches “{q}”.</div></Card>}
          {groups.map(({ ent, funds }) => (
            <section key={ent?.id || 'unlinked'} aria-label={ent ? ent.name : 'Not linked to an entity'}>
            <Card style={ent ? undefined : { boxShadow: 'inset 0 0 0 1px var(--snow-status-approved)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={h3}>{ent ? ent.name : 'Not linked to an entity'}</div>
                    {ent?.legalForm && <Pill bg="var(--snow-primary-purple)">{ent.legalForm}</Pill>}
                    {ent && entityAi(ent) === 'not-permitted' && <span title={`The client does not permit AI (${ent.aiBasis || 'basis not recorded'}).`}><Pill bg="var(--snow-status-approved-bg)">AI assistance off</Pill></span>}
                    {ent && entityAi(ent) === 'undecided' && <span title="No AI decision has been recorded for this client. Record it under Edit Entity."><Pill bg="var(--snow-status-rejected-bg)">AI assistance off</Pill></span>}
                  </div>
                  <div style={{ ...cap, ...muted, marginTop: 4 }}>
                    {ent ? [ent.client && `Client: ${ent.client}`, ent.jurisdiction, ent.yearEnd && `Year end ${fmtDate(ent.yearEnd)}`, ent.administrator && `Administrator: ${ent.administrator}`, ent.auditor && `Auditor: ${ent.auditor}`].filter(Boolean).join(' · ') || 'No details added yet'
                      : canWrite ? 'Open each fund and choose the entity it belongs to.' : 'A Manager links these funds to their entity.'}
                  </div>
                </div>
                {ent && (canWrite || (onConsolidated && inGroup(ent))) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {onConsolidated && inGroup(ent) && <Button size="sm" kind="secondary" onClick={() => onConsolidated(ent)}>Consolidated Review</Button>}
                    {canWrite && <Button size="sm" kind="secondary" onClick={() => onEditEntity(ent)}>Edit Entity</Button>}
                    {canWrite && <Button size="sm" onClick={() => onAdd(ent.id)}>Add Fund</Button>}
                  </div>
                )}
              </div>

              {!funds.length ? (
                <div style={{ ...body, ...muted, marginTop: 14 }}>No funds under this entity yet.{canWrite && ' Click Add Fund to add the first one.'}</div>
              ) : (
                <div className="dt" style={{ '--cols': GRID, '--min': '960px' }}>
                  <div className="dt-head">
                    {COLS.map((c, i) => <div key={i} style={{ ...cap, ...muted }}>{c}</div>)}
                  </div>
                  {funds.map(e => {
                    const on = e.id === activeId;
                    const checks = LIBRARY.filter(r => runnable(r) && rulesOf(e)[r.id]?.on).length;
                    return (
                      <div key={e.id} className="row dt-row" style={{ background: on ? 'var(--snow-primary-light)' : 'transparent' }}>
                        <div className="dt-main">
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button type="button" className="link" style={{ ...body, fontWeight: 600, textAlign: 'left' }} onClick={() => onOpen(e)}>{e.fund?.name || 'Untitled fund'}</button>
                            {on && <Pill bg="var(--snow-status-complete-bg)">In review</Pill>}
                            {reviewStore.signoffOf(e.id) === 'signed' && <Pill bg="var(--snow-primary-purple)">Signed off</Pill>}
                            {reviewStore.signoffOf(e.id) === 'manager-signed' && <Pill bg="var(--snow-primary-blue)">Awaiting partner</Pill>}
                            {e.aiOff && <span title={`AI is turned off for this fund (${e.aiOffBasis || 'reason not recorded'}).`}><Pill bg="var(--snow-status-approved-bg)">AI assistance off</Pill></span>}
                          </div>
                          <div style={{ ...cap, ...muted, marginTop: 2 }}>Saved {saved(e.savedAt)}</div>
                        </div>
                        <div data-label="Year end" style={body}>{fmtDate(e.fund?.yearEnd)}</div>
                        <div data-label="Preparer" style={body}>{personName(e.fund, 'preparer', people) || '—'}</div>
                        <div data-label="Reviewer" style={body}>{personName(e.fund, 'reviewer', people) || '—'}</div>
                        <div data-label="Manager" style={body}>{personName(e.fund, 'manager', people) || '—'}</div>
                        <div data-label="Threshold" style={body}>{sym(e.fund?.currency)}{fmt(e.threshold)}</div>
                        <div data-label="Checks" style={body}>{checks} of {LIBRARY.length}</div>
                        <div className="dt-end" style={{ justifyContent: 'flex-end' }}>
                          <Button size="sm" kind="secondary" onClick={() => onOpen(e)}>{canWrite ? 'Open' : 'View'}</Button>
                          <Button size="sm" disabled={on || locked} onClick={() => onActivate(e.id)}>{on ? 'Under Review' : 'In Review'}</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
