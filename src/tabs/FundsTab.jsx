import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Field, InfoTip, Pill, REDBG, Segmented, body, cap, h2, muted, page } from '../components/ui';
import Select from '../components/Select';
import DeleteFundDialog from '../components/DeleteFundDialog';
import { fmtDate } from '../lib/format';

const GRID_LIVE = 'minmax(200px,2fr) minmax(160px,1.4fr) 120px 120px';
const when = iso => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const has = (text, q) => String(text || '').toLowerCase().includes(q);

// Funds for whoever holds "Delete and restore funds" (Administrators, unless granted to another role): delete a fund
// (a soft delete, confirmed by typing its name) and restore deleted ones with everything they had.
// `initial`: 'live' or 'deleted'; `onBack`: shown when opened from the Engagements screen.
export default function FundsTab({ store, initial = 'live', onBack = null }) {
  const [view, setView] = useState(initial);
  const [engagements, setEngagements] = useState(null);
  const [entities, setEntities] = useState(null);
  const [deleted, setDeleted] = useState(null);
  const [q, setQ] = useState('');
  const [client, setClient] = useState('');
  const [msg, setMsg] = useState({ kind: '', text: '' });
  const [deleting, setDeleting] = useState(null);
  const [restoring, setRestoring] = useState('');

  useEffect(() => {
    if (!store) return undefined;
    const a = store.subscribe(setEngagements, e => setMsg({ kind: 'err', text: e }));
    const b = store.subscribeEntities(setEntities, e => setMsg({ kind: 'err', text: e }));
    return () => { a(); b(); };
  }, [store]);
  const loadDeleted = () => store?.deletedFunds().then(setDeleted, e => setMsg({ kind: 'err', text: e.message }));
  useEffect(() => { loadDeleted(); }, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  const entityOf = useMemo(() => new Map((entities || []).map(e => [e.id, e])), [entities]);
  const clientOf = id => { const e = entityOf.get(id); return e ? (e.client || e.name || '') : ''; };
  const clients = useMemo(() => [...new Set([...(engagements || []).map(e => clientOf(e.entityId)), ...(deleted || []).map(d => d.clientName || d.entityName)].filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [engagements, deleted, entityOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const query = q.trim().toLowerCase();
  const live = useMemo(() => (engagements || [])
    .map(e => ({ e, ent: entityOf.get(e.entityId) || null, client: clientOf(e.entityId) }))
    .filter(x => (!client || x.client === client) && (!query || has(x.e.fund?.name, query) || has(x.ent?.name, query) || has(x.client, query)))
    .sort((a, b) => a.client.localeCompare(b.client) || (a.e.fund?.name || '').localeCompare(b.e.fund?.name || '') || (b.e.fund?.yearEnd || '').localeCompare(a.e.fund?.yearEnd || '')),
  [engagements, entityOf, client, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const gone = useMemo(() => (deleted || []).filter(d => (!client || (d.clientName || d.entityName) === client)
    && (!query || has(d.fundName, query) || has(d.entityName, query) || has(d.clientName, query) || has(d.reason, query))), [deleted, client, query]);

  const onDelete = async (fund, typed, reason) => {
    await store.deleteFund(fund.id, typed, reason);
    setDeleting(null);
    setMsg({ kind: 'ok', text: `${fund.fund?.name || 'The fund'} was deleted. It can be restored from Deleted funds.` });
    loadDeleted();
  };
  const onRestore = async d => {
    setRestoring(d.id); setMsg({ kind: '', text: '' });
    try {
      await store.restoreFund(d.id);
      setMsg({ kind: 'ok', text: `${d.fundName} was restored with its documents, review points and sign-off.` });
      await loadDeleted();
    } catch (e) { setMsg({ kind: 'err', text: e.message }); }
    setRestoring('');
  };

  const counts = [['live', `Funds${engagements ? ` (${engagements.length})` : ''}`], ['deleted', `Deleted funds${deleted ? ` (${deleted.length})` : ''}`]];
  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 720 }}>
          <div style={h2}>Funds</div>
          <div style={{ ...body, ...muted, marginTop: 6 }}>
            Delete a fund set up by mistake or no longer reviewed, and restore it if needed. A deleted fund is hidden everywhere in the app but nothing is erased.
            <InfoTip label="About deleting funds">A fund cannot be deleted while its analysis or its group’s Consolidated Review is running. Billing is not changed: a deleted fund’s AI usage can still be invoiced, and Finance sees it marked Deleted. Each delete and restore is in the Activity Log.</InfoTip>
          </div>
        </div>
        {onBack && <Button kind="secondary" onClick={onBack}>Back to Engagements</Button>}
      </div>

      {msg.text && <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ ...cap, background: msg.kind === 'err' ? REDBG : 'var(--snow-status-complete-bg)', borderRadius: 8, padding: '10px 14px' }}>{msg.text}</div>}

      <Segmented options={counts} value={view} onChange={setView} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 240px', maxWidth: 360 }}>
          <Field label="Search"><input className="input" type="search" placeholder="Fund, entity or client" value={q} onChange={e => setQ(e.target.value)} /></Field>
        </div>
        <div style={{ flex: '1 1 200px', maxWidth: 360 }}>
          <Field label="Client">
            <Select className="input" value={client} onChange={e => setClient(e.target.value)}>
              <option value="">All clients</option>{clients.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      {view === 'live' ? (
        <Card>
          {engagements === null || entities === null ? <div style={{ ...body, ...muted }}>Loading funds…</div>
            : !live.length ? <div style={{ ...body, ...muted }}>{(engagements || []).length ? 'No fund matches.' : 'There are no funds.'}</div> : (
              <div className="dt" style={{ '--cols': GRID_LIVE, '--min': '640px', marginTop: 0 }}>
                <div className="dt-head">{['Fund', 'Client and entity', 'Year end', ''].map((c, i) => <div key={i}>{c}</div>)}</div>
                {live.map(({ e, ent, client: c }) => (
                  <div key={e.id} className="dt-row">
                    <div className="dt-main" style={{ ...body, fontWeight: 600, overflowWrap: 'anywhere' }}>{e.fund?.name || 'Untitled fund'}</div>
                    <div data-label="Client and entity" style={{ ...cap, overflowWrap: 'anywhere' }}>{c || '—'}{ent && ent.name !== c && <div style={muted}>{ent.name}</div>}</div>
                    <div data-label="Year end" style={body}>{fmtDate(e.fund?.yearEnd)}</div>
                    <div className="dt-end" style={{ justifyContent: 'flex-end' }}>
                      <Button size="sm" kind="secondary" onClick={() => { setMsg({ kind: '', text: '' }); setDeleting(e); }}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </Card>
      ) : (
        <Card>
          {deleted === null ? <div style={{ ...body, ...muted }}>Loading deleted funds…</div>
            : !gone.length ? <div style={{ ...body, ...muted }}>{deleted.length ? 'No deleted fund matches.' : 'No funds have been deleted.'}</div> : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {gone.map(d => {
                  const who = d.clientName || d.entityName;
                  return (
                    <div key={d.id} className="dt-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', alignItems: 'center' }}>
                      <div style={{ flex: '2 1 240px', minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ ...body, fontWeight: 600, overflowWrap: 'anywhere' }}>{d.fundName}</span><Pill bg={REDBG}>Deleted</Pill>
                        </div>
                        <div style={{ ...cap, ...muted, marginTop: 2, overflowWrap: 'anywhere' }}>
                          {[who, d.entityName && d.entityName !== who ? d.entityName : '', `Year end ${fmtDate(d.yearEnd)}`].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div style={{ ...cap, flex: '2 1 220px', minWidth: 0, overflowWrap: 'anywhere' }}>
                        Deleted by {d.deletedBy?.name || '—'} on {when(d.deletedAt)}
                        <div style={muted}>{d.reason ? `Reason: ${d.reason}` : 'No reason given'}</div>
                      </div>
                      <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
                        <Button size="sm" disabled={!!restoring} onClick={() => onRestore(d)}>{restoring === d.id ? 'Restoring…' : 'Restore'}</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </Card>
      )}

      {deleting && <DeleteFundDialog fund={deleting} onDelete={onDelete} onClose={() => setDeleting(null)} />}
    </div>
  );
}
