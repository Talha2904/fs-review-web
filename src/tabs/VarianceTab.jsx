import React from 'react';
import { gbp, signedGbp, pctLabel, fmt, sym } from '../lib/format';
import { Button, Card, CardHead, Pill, PriPill, Segmented, Tile, BAND_BG, cap, body, h2, muted, page } from '../components/ui';

const GRID = 'minmax(180px,2.2fr) minmax(100px,1fr) minmax(100px,1fr) minmax(100px,1fr) 78px 112px';
const COLS = ['Financial statement line', 'Current year draft', 'Prior year signed', 'Movement', 'Movement %', 'Assessment'];

export default function VarianceTab({ aiNotes = false, canEditPoints = true, enabled = true, mode = 'library', goSetup, model, filter, setFilter, raised, onRaise, threshold, growth, avgGrowth }) {
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
  const biggest = model.rows.filter(r => !r.sub).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  const directors = investigate.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const groups = model.groups.filter(g => filter === 'all' || g.rows.some(r => r.band !== 'Expected'));

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
        <Tile flex="1 1 200px" bg="var(--snow-primary-blue)" label="Lines Compared" value={model.rows.length} sub="prior year to draft" />
        <Tile flex="1 1 200px" bg="var(--snow-primary-purple)" label="Outside Expectation" value={flagged.length} sub="flagged by the analysis" />
        <Tile flex="1 1 200px" bg="var(--snow-status-rejected-bg)" label="For Investigation" value={investigate.length} sub="director attention" />
        <Tile flex="1 1 200px" bg="var(--snow-primary-light)" label="Largest Movement" value={biggest ? pctLabel(biggest.pct) : '—'} sub={biggest?.label} />
      </div>

      <Card>
        <CardHead title="Matters for the Directors" aside={`${directors.length} matter${directors.length === 1 ? '' : 's'} for the Board`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {directors.map(d => (
            <div key={d.label} style={{ background: 'var(--snow-primary-light)', borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'start' }}>
                <div style={{ ...body, fontWeight: 600 }}>{d.label}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ ...body, whiteSpace: 'nowrap' }}>{signedGbp(d.delta)} · {pctLabel(d.pct)}</span><PriPill pri={d.pri} /></div>
              </div>
              <div style={{ ...cap, marginTop: 6, maxWidth: 900 }}>{d.note}</div>
              <div style={{ ...cap, marginTop: 6, maxWidth: 900 }}><span style={muted}>Suggested work — </span>{d.action}</div>
            </div>
          ))}
        </div>
      </Card>

      {groups.map(g => (
        <Card key={g.title}>
          <CardHead title={g.title} aside={filter === 'all' ? `${g.rows.length} lines` : `${g.rows.filter(r => r.band !== 'Expected').length} of ${g.rows.length} lines`} />
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: 12, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)', minWidth: 680 }}>
              {COLS.map(c => <div key={c} style={{ ...cap, ...muted }}>{c}</div>)}
            </div>
            {g.rows.filter(r => filter === 'all' || r.band !== 'Expected').map(r => {
              const isRaised = raised(r.label);
              const num = { ...body, textAlign: 'right', fontWeight: r.sub ? 600 : 400 };
              const dl = { ...body, textAlign: 'right', fontWeight: r.band === 'Investigate' ? 600 : 400 };
              return (
                <div key={r.label} style={{ padding: '4px 0', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, alignItems: 'baseline', padding: '8px 12px', minWidth: 680 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...body, fontWeight: r.sub ? 600 : 400 }}>{r.label}</div>
                      <div style={{ ...cap, ...muted, marginTop: 2 }}>{r.expect}</div>
                    </div>
                    <div style={num}>{gbp(r.cy)}</div>
                    <div style={num}>{gbp(r.py)}</div>
                    <div style={dl}>{signedGbp(r.delta)}</div>
                    <div style={dl}>{pctLabel(r.pct)}</div>
                    <div><Pill bg={BAND_BG[r.band]}>{r.band}</Pill></div>
                  </div>
                  {r.note && r.band !== 'Expected' && (
                    <div style={{ padding: '0 12px 10px', maxWidth: 860, ...cap }}>
                      <div>{aiNotes && <span style={{ fontSize: 11, background: '#EEF1FB', borderRadius: 999, padding: '1px 8px', marginRight: 6 }}>Drafted by AI</span>}{r.note}</div>
                      <div style={{ marginTop: 6 }}><span style={muted}>Suggested work — </span>{r.action}</div>
                      {r.band === 'Investigate' && canEditPoints && <Button size="sm" disabled={isRaised} style={{ marginTop: 10 }} onClick={() => onRaise(r)}>{isRaised ? 'Raised' : 'Raise Review Point'}</Button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <div style={{ ...cap, ...muted, maxWidth: 900 }}>
        {investigate.length} of {model.rows.length} lines require investigation · threshold {sym()}{fmt(threshold)} · net assets {pctLabel(growth * 100)}{avgGrowth != null ? ` · average net assets ${pctLabel(avgGrowth * 100)}` : ''}
      </div>
    </div>
  );
}
