import React from 'react';
import { fmt, gbp } from '../lib/format';
import { PointStatus } from './ScheduleTab';
import TbMapModal from '../components/TbMapModal';
import { checkTbMapping } from '../lib/tbMapping';
import { Button, Card, CardHead, Pill, PriPill, Tile, cap, body, h3, muted, page, RING, REDBG } from '../components/ui';

const CHECK_GRID = 'minmax(260px,1fr) 130px 130px 130px 120px';
const CHIP = { Agrees: 'var(--snow-status-complete-bg)', Difference: REDBG, 'Not tested': 'var(--snow-ink-5)' };
const flagBox = on => ({ background: on ? 'var(--snow-status-approved-bg)' : 'transparent', borderRadius: on ? 8 : 0 });

export default function AnalysisTab(p) {
  const { result, checks, openPoints, files, docSel, setDocSel, tray, pick, clearTray, addFromTray, sel, setSel, goto, showFlags, analysedAt, canRaise = true, tbMap = {}, tbOn = false, canMap = false, onSaveMap, tbTol = 1 } = p;
  const [mapping, setMapping] = React.useState(false);
  const tbRes = React.useMemo(() => (tbOn && result?.docs?.tb && result?.docs?.cy ? checkTbMapping(result.docs, tbMap, tbTol) : null), [tbOn, result, tbMap, tbTol]);
  const fails = checks.filter(c => c.result === 'Difference').length;
  const count = pri => openPoints.filter(x => x.pri === pri).length;
  const hi = count('High');
  const docIds = ['cy', 'py', 'tb', 'is', 'sup'].filter(id => files[id] && result.docs[id]);
  const cur = docIds.includes(docSel) ? docSel : docIds[0];
  const doc = result.docs[cur];
  const refKey = { is: 'IS-', sup: 'SUP-', tb: 'TB ', py: 'Prior year', cy: 'Note' }[cur];
  const docPoints = openPoints.filter(x => (x.doc || 'cy') === cur || (x.refs || '').includes(refKey));
  const vals = tray.map(t => t.value);

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <Tile bg={REDBG} label="High Priority" value={hi} sub="points open" />
        <Tile bg="var(--snow-status-approved-bg)" label="Medium" value={count('Medium')} sub="points open" />
        <Tile bg="var(--snow-primary-light)" label="Low" value={count('Low')} sub="points open" />
        <Tile bg="var(--snow-primary-blue)" label="Checks Differ" value={fails} sub={`of ${checks.length}`} />
        <Card style={{ flex: '1 1 300px', minWidth: 260 }}>
          <div style={{ ...body, fontWeight: 600 }}>{hi ? `${hi} high priority point${hi === 1 ? '' : 's'} to clear` : 'No high priority points outstanding'}</div>
          <div style={{ ...cap, ...muted, marginTop: 8 }}>Analysed {analysedAt}. {files.sup ? 'Supporting information was used to corroborate movements.' : 'No supporting information was provided, so movements could not be corroborated.'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <Button size="sm" onClick={() => goto('sched')}>Open Review Points</Button>
            <Button size="sm" kind="secondary" onClick={() => goto('var')}>Variance Analysis</Button>
            <Button size="sm" kind="secondary" onClick={() => goto('docs')}>Documents</Button>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Recalculations and Cross-references" aside={`${fails} of ${checks.length} show a difference · checks set in the engagement`} />
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: CHECK_GRID, gap: 16, padding: '8px 12px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)', minWidth: 820 }}>
            {['Check', 'Computed', 'Per Accounts', 'Difference', 'Result'].map(c => <div key={c} style={{ ...cap, ...muted }}>{c}</div>)}
          </div>
          {checks.map(c => (
            <div key={c.id} className="row" style={{ display: 'grid', gridTemplateColumns: CHECK_GRID, gap: 16, alignItems: 'center', padding: '10px 12px', minHeight: 40, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)', minWidth: 820 }}>
              <div><div style={body}><span style={{ ...cap, ...muted, marginRight: 8 }}>{c.rule}</span>{c.name}</div><div style={{ ...cap, ...muted, marginTop: 2 }}>{c.detail}</div></div>
              <div style={{ ...body, textAlign: 'right' }}>{fmt(c.comp)}</div>
              <div style={{ ...body, textAlign: 'right' }}>{fmt(c.stated)}</div>
              <div style={{ ...body, textAlign: 'right', fontWeight: c.result === 'Difference' ? 600 : 400, color: c.result === 'Difference' ? 'var(--snow-black-100)' : 'var(--snow-black-40)' }}>{c.result === 'Difference' ? (c.count ? `${c.diff} found` : fmt(Math.abs(c.diff))) : '—'}</div>
              <div><Pill bg={CHIP[c.result]}>{c.result}</Pill></div>
            </div>
          ))}
        </div>
      </Card>

      {tbRes && (
        <Card>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={h3}>Trial Balance Mapping <span style={{ ...cap, ...muted, fontWeight: 400 }}>CHK-02</span></div>
              <div style={{ ...cap, ...muted, marginTop: 4 }}>
                {tbRes.mappedCount ? `${tbRes.mappedCount} of ${tbRes.accounts.length} accounts mapped · ${tbRes.results.filter(r => r.ok).length} of ${tbRes.results.length} statement lines agree${tbRes.unmapped.length ? ` · ${tbRes.unmapped.length} with a balance not mapped` : ''}`
                  : `None of the ${tbRes.accounts.length} trial balance accounts is mapped yet, so CHK-02 can’t run. Map them once; the mapping is saved with this fund.`}
              </div>
            </div>
            <Button kind={tbRes.mappedCount ? 'secondary' : 'primary'} onClick={() => setMapping(true)}>{canMap ? (tbRes.mappedCount ? 'Edit Mapping' : 'Map Trial Balance') : 'View Mapping'}</Button>
          </div>
        </Card>
      )}
      {mapping && <TbMapModal docs={result.docs} map={tbMap} tol={tbTol} canEdit={canMap} onSave={onSaveMap} onClose={() => setMapping(false)} />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: '0 1 232px', minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 16 }}>
          <div style={{ ...cap, ...muted, padding: '0 4px 4px' }}>Review File</div>
          {docIds.map(id => {
            const d = result.docs[id], on = cur === id;
            return (
              <div key={id} className="hov" onClick={() => setDocSel(id)} style={{ background: on ? 'var(--snow-ink-5)' : 'transparent', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={body}>{d.name}</span>
                  <Pill bg={on ? '#fff' : 'var(--snow-ink-5)'} style={muted}>{id === 'cy' ? 'v' + result.version : d.tag}</Pill>
                </div>
                <div style={{ ...cap, ...muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{files[id].name}</div>
              </div>
            );
          })}
        </div>

        <Card style={{ flex: '1 1 520px', minWidth: 300 }}>
          <CardHead title={doc.title} aside={doc.meta} />
          <div style={{ ...cap, ...muted, paddingBottom: 16, marginTop: 6, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)' }}>Click any figure to add it to the tie-out tray. Highlighted lines carry a review point.</div>
          {doc.blocks.map((b, bi) => (
            <div key={bi} style={{ marginTop: 24 }}>
              {b.k === 'head' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)' }}>
                  <div style={{ ...body, fontWeight: 600 }}>{b.title}</div><div style={{ ...cap, ...muted }}>{b.sub}</div>
                </div>
              )}
              {b.k === 'para' && (() => { const on = showFlags && b.flag; return (
                <div style={{ ...flagBox(on), padding: on ? 16 : '4px 0', maxWidth: 780 }}>
                  <div style={body}>{b.text}</div>
                  {on && <div onClick={() => setSel(b.flag)} style={{ ...cap, marginTop: 10, display: 'inline-flex', cursor: 'pointer', background: '#fff', boxShadow: RING, padding: '2px 10px', borderRadius: 18 }}>{b.flag} — flagged for review</div>}
                </div>
              ); })()}
              {b.k === 'table' && <DocTable b={b} bi={bi} cur={cur} doc={doc} tray={tray} pick={pick} setSel={setSel} showFlags={showFlags} />}
            </div>
          ))}
        </Card>

        <div style={{ flex: '1 1 320px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 16 }}>
          <Card tint="var(--snow-primary-light)">
            <CardHead small title="Tie-out Tray" aside={tray.length ? `${tray.length} of 4 selected` : ''} />
            {!tray.length && <div style={{ ...cap, ...muted, marginTop: 8 }}>Empty. Click a figure in any document — pick two to compute the difference, or several to cast a total.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
              {tray.map((t, i) => (
                <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0,1fr) auto 16px', gap: 8, alignItems: 'baseline', padding: '8px 12px', background: '#fff', borderRadius: 8, ...cap }}>
                  <span style={muted}>{String.fromCharCode(65 + i)}</span><span>{t.label}</span><span style={{ textAlign: 'right' }}>{t.display}</span>
                  <span onClick={() => pick(t)} style={{ ...muted, cursor: 'pointer', textAlign: 'center' }}>×</span>
                </div>
              ))}
            </div>
            {tray.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tray.length === 2 && <>
                  <Res k="A − B (difference)" v={fmt(vals[0] - vals[1])} big />
                  <Res k="B as % of A" v={vals[0] ? (100 * vals[1] / vals[0]).toFixed(2) + '%' : '—'} />
                </>}
                <Res k={tray.length === 2 ? 'A + B (cast)' : 'Cast of selection'} v={fmt(vals.reduce((a, b) => a + b, 0))} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {canRaise && <Button size="sm" onClick={addFromTray}>Raise Review Point</Button>}
                  <Button size="sm" kind="secondary" onClick={clearTray}>Clear</Button>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <CardHead small title="Points on This Document" aside={`${docPoints.length} open`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {docPoints.map(x => {
                const on = sel === x.ref;
                return (
                  <div key={x.ref} onClick={() => setSel(on ? null : x.ref)} style={{ background: on ? 'var(--snow-primary-light)' : '#fff', boxShadow: on ? 'none' : RING, borderRadius: 8, padding: '12px 14px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ ...cap, ...muted }}>{x.ref}</span><PriPill pri={x.pri} /></div>
                    <div style={{ ...body, marginTop: 4 }}>{x.title}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, gap: 10 }}><span style={{ ...cap, ...muted }}>{(x.refs || '').split(' · ')[0]}</span><span style={body}>{gbp(x.amount)}</span></div>
                    {on && (
                      <div style={{ marginTop: 12, paddingTop: 12, boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.1)', ...cap }}>
                        <div>{x.basis}</div>
                        <div style={{ marginTop: 8 }}><span style={muted}>Follow-up — </span>{x.follow}</div>
                        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><PointStatus status={x.status} /><Button size="sm" kind="secondary" onClick={() => { setSel(x.ref); goto('sched'); }}>Open Point</Button></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const Res = ({ k, v, big }) => (
  <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
    <span style={{ ...cap, ...muted }}>{k}</span><span style={big ? h3 : body}>{v}</span>
  </div>
);

function DocTable({ b, bi, cur, doc, tray, pick, setSel, showFlags }) {
  const nc = b.cols.length;
  const grid = `minmax(180px,1fr) repeat(${nc},minmax(96px,120px))`;
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, padding: '8px 12px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)', minWidth: 480 }}>
        <div style={{ ...cap, ...muted }}>{b.label || ''}</div>
        {b.cols.map(c => <div key={c} style={{ ...cap, ...muted, textAlign: 'right' }}>{c}</div>)}
      </div>
      {b.rows.map((r, ri) => {
        const on = showFlags && r.flag;
        return (
          <div key={ri} className="row" style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, alignItems: 'baseline', padding: '8px 12px', minWidth: 480, minHeight: 40, ...flagBox(on), boxShadow: r.b ? 'inset 0 1px 0 rgba(0,0,0,0.2)' : r.h ? 'none' : 'inset 0 -1px 0 rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: r.h ? 12 : 14, lineHeight: r.h ? '18px' : '20px', fontWeight: r.b || r.h ? 600 : 400, color: r.h ? 'var(--snow-black-40)' : 'inherit', paddingTop: r.h ? 8 : 0 }}>
              <span>{r.l}</span>
              {r.ref && <span style={{ marginLeft: 8, fontSize: 12, ...muted }}>{r.ref}</span>}
              {on && <span onClick={() => setSel(r.flag)} style={{ ...cap, marginLeft: 8, background: '#fff', boxShadow: RING, padding: '1px 8px', borderRadius: 18, cursor: 'pointer' }}>{r.flag}</span>}
            </div>
            {(r.v || []).map((v, ci) => {
              const dp = ci === 1 && r.dp2 ? 2 : (r.dp || 0);
              const id = `${cur}:${bi}:${ri}:${ci}`;
              const picked = tray.some(t => t.id === id);
              const item = { id, value: v, label: r.l + (nc > 1 ? ' · ' + b.cols[ci] : ''), display: fmt(v, dp), src: `${doc.tag || ''} ${String(r.ref || r.l).slice(0, 22)}` };
              return (
                <div key={ci} onClick={v != null ? () => pick(item) : undefined}
                  style={{ ...body, textAlign: 'right', padding: '2px 6px', borderRadius: 4, cursor: v != null ? 'pointer' : 'default', fontWeight: r.b ? 600 : 400, background: picked ? 'var(--snow-primary-blue)' : 'transparent', boxShadow: picked ? 'inset 0 0 0 1px rgba(0,0,0,0.2)' : 'none' }}>
                  {fmt(v, dp)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
