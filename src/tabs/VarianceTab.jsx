import React, { useState } from 'react';
import { gbp, signedGbp, pctLabel, fmt, sym } from '../lib/format';
import { Button, Card, CardHead, Pill, PriPill, Segmented, Tile, BAND_BG, cap, body, h2, muted, page } from '../components/ui';

const GRID = 'minmax(180px,2.2fr) minmax(100px,1fr) minmax(100px,1fr) minmax(100px,1fr) 78px 112px';
const COLS = ['Financial statement line', 'Current year draft', 'Prior year signed', 'Movement', 'Movement %', 'Assessment'];

export default function VarianceTab({ aiNotes = false, canEditPoints = true, enabled = true, mode = 'library', goSetup, model, filter, setFilter, raised, onRaise, openPoint, threshold, growth, avgGrowth }) {
  // lines being raised right now (so a second click can't raise twice) and the last error, by line
  const [raising, setRaising] = useState({});
  const [raiseError, setRaiseError] = useState({});
  // the point just raised for a line, shown until the refreshed review includes it
  const [justRaised, setJustRaised] = useState({});
  if (!enabled) return (
    <div style={page}>
      <Card>
        <div style={h2}>Variance Analysis</div>
        <div style={{ ...body, ...muted, marginTop: 8, maxWidth: 620 }}>CHK-11 year-on-year variances is switched off in the engagement under review, so no lines were compared. Switch it on in the engagement and run the analysis again to see the variance review.</div>
        <Button kind="secondary" style={{ marginTop: 16 }} onClick={goSetup}>Open Engagements</Button>
      </Card>
    </div>
  );
  const flagged = model.rows.filter(r => r.band !== 'Expected');
  const investigate = model.rows.filter(r => r.band === 'Investigate');
  const byDelta = (a, b) => Math.abs(b.delta) - Math.abs(a.delta);
  const directors = investigate.slice().sort(byDelta);
  // The largest movement the analysis flagged: the first matter for the Directors, else the largest line
  // outside expectation. Lines within expectation (such as average net assets in a highlights note) are not
  // movements to report, so the tile always names a line listed on this page.
  const biggest = directors.find(r => !r.sub) || flagged.filter(r => !r.sub).sort(byDelta)[0];
  const groups = model.groups.filter(g => filter === 'all' || g.rows.some(r => r.band !== 'Expected'));

  // The tiles and the matters take the reader to the lines they are about. A line's row is found by its label;
  // it is briefly highlighted so the eye lands on it.
  // a row id from the line label, made unique even where two labels differ only in punctuation or accents
  const rowIds = new Map();
  model.rows.forEach((r, i) => rowIds.set(r.label, `var-row-${i}`));
  const rowId = label => rowIds.get(label) || '';
  // after React has drawn any filter change (a timer, not an animation frame, so it also runs in a background tab)
  const goTo = (id, flash = false) => setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const block = flash ? 'center' : 'start';
    el.scrollIntoView({ behavior: 'smooth', block });
    // where smooth scrolling is unavailable or was interrupted, land on the line anyway
    setTimeout(() => { const r = el.getBoundingClientRect(); if (r.top < 0 || r.top > window.innerHeight - 40) el.scrollIntoView({ block }); }, 900);
    // a repeat click restarts the highlight; only the latest click removes it
    if (flash) { clearTimeout(el._flash); el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash'); el._flash = setTimeout(() => el.classList.remove('is-flash'), 2000); }
  }, 50);
  // Raises the line as a review point and stays here; the row then links to the point.
  const raise = async r => {
    if (raising[r.label]) return;
    setRaising(m => ({ ...m, [r.label]: true }));
    setRaiseError(m => ({ ...m, [r.label]: '' }));
    try { const saved = await onRaise(r); if (saved) setJustRaised(m => ({ ...m, [r.label]: saved })); }
    catch (e) { setRaiseError(m => ({ ...m, [r.label]: e.message || 'The point could not be raised.' })); }
    finally { setRaising(m => ({ ...m, [r.label]: false })); }
  };
  const showLines = f => { setFilter(f); goTo('var-lines'); };
  const showLine = r => { if (filter !== 'all' && r.band === 'Expected') setFilter('all'); goTo(rowId(r.label), true); };

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 680 }}>
          <div style={h2}>Variance Analysis</div>
          <div style={{ ...body, ...muted, marginTop: 6 }}>{mode === 'library' ? 'Every comparative line in the draft is set against the signed prior year. Under CHK-11 every movement at or above the review threshold is listed for explanation, and lines far from the net-asset expectation are put forward for investigation.' : 'Every comparative line in the draft is set against the signed prior year, sized against the review threshold and read against the movement in net assets. Only material lines outside the expectation band are listed.'}</div>
        </div>
        <Segmented options={[['all', 'All Lines'], ['flagged', 'Outside Expectation']]} value={filter} onChange={setFilter} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <Tile flex="1 1 200px" bg="var(--snow-primary-blue)" label="Lines Compared" value={model.rows.length} sub="prior year to draft"
          onClick={model.rows.length ? () => showLines('all') : undefined} title="Show every line compared" />
        <Tile flex="1 1 200px" bg="var(--snow-primary-purple)" label="Outside Expectation" value={flagged.length} sub="flagged by the analysis"
          onClick={flagged.length ? () => showLines('flagged') : undefined} title="Show only the lines outside expectation" />
        <Tile flex="1 1 200px" bg="var(--snow-status-rejected-bg)" label="For Investigation" value={investigate.length} sub="director attention"
          onClick={directors.length ? () => goTo('var-matters') : undefined} title="Go to the matters for the Directors" />
        <Tile flex="1 1 200px" bg="var(--snow-primary-light)" label="Largest Movement" value={biggest ? (biggest.pct != null ? pctLabel(biggest.pct) : signedGbp(biggest.delta)) : '—'}
          sub={biggest ? (biggest.pct != null ? `${biggest.label} · ${signedGbp(biggest.delta)}` : biggest.label) : 'no lines outside expectation'}
          onClick={biggest ? () => showLine(biggest) : undefined} title={biggest ? `Go to ${biggest.label}` : undefined} />
      </div>

      <div id="var-matters" className="var-anchor"><Card>
        <CardHead title="Matters for the Directors" aside={`${directors.length} matter${directors.length === 1 ? '' : 's'} for the Board`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {directors.map(d => (
            <div key={d.label} className={'matter is-' + (d.pri || 'Low').toLowerCase()}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'start' }}>
                <div style={{ ...body, fontWeight: 600 }}>{d.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}><span style={{ ...body, whiteSpace: 'nowrap' }}>{signedGbp(d.delta)} · {pctLabel(d.pct)}</span><PriPill pri={d.pri} /></div>
              </div>
              <div style={{ ...cap, marginTop: 6, maxWidth: 900 }}>{d.note}</div>
              <div style={{ ...cap, marginTop: 6, maxWidth: 900 }}><span style={muted}>Suggested work — </span>{d.action}</div>
              <button type="button" className="link" style={{ ...cap, marginTop: 8 }} onClick={() => showLine(d)}>Show the line ↓</button>
            </div>
          ))}
        </div>
      </Card></div>

      <div id="var-lines" className="var-anchor" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* what the table below shows, so a tile that changed the filter is visibly different where it lands */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div role="status" style={body}>{filter === 'all' ? <>Showing <b>all {model.rows.length} lines</b> compared</> : <>Showing the <b>{flagged.length} lines outside expectation</b> · {model.rows.length - flagged.length} lines within expectation are hidden</>}</div>
        <Segmented options={[['all', 'All Lines'], ['flagged', 'Outside Expectation']]} value={filter} onChange={setFilter} />
      </div>
      {groups.map(g => (
        <Card key={g.title}>
          <CardHead title={g.title} aside={filter === 'all' ? `${g.rows.length} lines` : `${g.rows.filter(r => r.band !== 'Expected').length} of ${g.rows.length} lines`} />
          <div className="dt" style={{ '--cols': GRID, '--min': '680px' }}>
            <div className="dt-head">
              {COLS.map(c => <div key={c} style={{ ...cap, ...muted }}>{c}</div>)}
            </div>
            {g.rows.filter(r => filter === 'all' || r.band !== 'Expected').map(r => {
              const point = raised(r.label) || justRaised[r.label] || null;
              const num = { ...body, fontWeight: r.sub ? 600 : 400 };
              const dl = { ...body, fontWeight: r.band === 'Investigate' ? 600 : 400 };
              return (
                <div key={r.label} id={rowId(r.label)} className={'var-row is-' + r.band.toLowerCase()}>
                  <div className="dt-row" style={{ alignItems: 'baseline', boxShadow: 'none' }}>
                    <div className="dt-main">
                      <div style={{ ...body, fontWeight: r.sub ? 600 : 400 }}>{r.label}</div>
                      <div style={{ ...cap, ...muted, marginTop: 2 }}>{r.expect}</div>
                    </div>
                    <div data-label="Current year draft" className="num" style={num}>{gbp(r.cy)}</div>
                    <div data-label="Prior year signed" className="num" style={num}>{gbp(r.py)}</div>
                    <div data-label="Movement" className="num" style={dl}>{signedGbp(r.delta)}</div>
                    <div data-label="Movement %" className="num" style={dl}>{pctLabel(r.pct)}<MoveBar pct={r.pct} /></div>
                    <div data-label="Assessment"><Pill bg={BAND_BG[r.band]}>{r.band}</Pill></div>
                  </div>
                  {r.band !== 'Expected' && (r.note || point || canEditPoints) && (
                    <div style={{ padding: '0 12px 10px', maxWidth: 860, ...cap }}>
                      {r.note && <div>{aiNotes && <span style={{ fontSize: 11, background: 'var(--snow-status-pending-bg)', borderRadius: 999, padding: '1px 8px', marginRight: 6 }}>Drafted by AI</span>}{r.note}</div>}
                      {r.action && <div style={{ marginTop: 6 }}><span style={muted}>Suggested work — </span>{r.action}</div>}
                      {/* optional on both Investigate and Explain lines; nothing is raised automatically */}
                      {point
                        ? <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><Pill bg="var(--snow-status-complete-bg)">Raised {point.ref}</Pill>{openPoint && <button type="button" className="link" style={cap} onClick={() => openPoint(point.ref)}>Open point</button>}</div>
                        : canEditPoints && <Button size="sm" disabled={!!raising[r.label]} style={{ marginTop: 10 }} onClick={() => raise(r)}>{raising[r.label] ? 'Raising…' : 'Raise Review Point'}</Button>}
                      {raiseError[r.label] && <div role="alert" style={{ ...cap, marginTop: 8, background: 'var(--snow-status-rejected-bg)', borderRadius: 8, padding: '6px 10px' }}>{raiseError[r.label]}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      </div>

      <div style={{ ...cap, ...muted, maxWidth: 900 }}>
        {investigate.length} of {model.rows.length} lines require investigation · threshold {sym()}{fmt(threshold)} · net assets {pctLabel(growth * 100)}{avgGrowth != null ? ` · average net assets ${pctLabel(avgGrowth * 100)}` : ''}
      </div>
    </div>
  );
}

// The size and direction of a movement, as a bar either side of zero (capped at 100%).
function MoveBar({ pct }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const w = Math.min(100, Math.abs(pct)) / 2;
  return <span className="move-bar" aria-hidden="true"><i className={pct < 0 ? 'is-down' : 'is-up'} style={{ width: `${w}%`, [pct < 0 ? 'right' : 'left']: '50%' }} /></span>;
}
