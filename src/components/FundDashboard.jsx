import React, { useState } from 'react';
import { runnable } from '../data/checkLibrary';
import { useLibrary } from '../lib/library';
import { fmt, fmtDate, sym } from '../lib/format';
import { Button } from './ui';
import { slotDefs } from '../data/sampleFund';
import { personName } from '../lib/people';

// Summary of the engagement under review, shown at the top of every tab.
export default function FundDashboard({ aiLabel = '', aiWhy = '', engagement, entity, people = [], docsAttached, openPoints, done, onChange, onConsolidated, locked }) {
  const LIBRARY = useLibrary();
  const [open, setOpen] = useState(false);
  const f = engagement.fund;
  const checks = LIBRARY.filter(r => runnable(r) && engagement.rules?.[r.id]?.on).length;
  const facts = [
    ['Preparer', personName(f, 'preparer', people) || '—'],
    ['Reviewer', personName(f, 'reviewer', people) || '—'],
    ['Manager', personName(f, 'manager', people) || '—'],
    ['Review threshold', sym() + fmt(engagement.threshold)],
    ['Checks running', `${checks} of ${LIBRARY.length}`],
    ['Documents', `${docsAttached} of ${slotDefs.length}`],
    ['Points open', done ? String(openPoints) : 'Not analysed'],
    ['AI assistance', aiLabel, aiWhy]
  ];
  return (
    <div style={{ padding: '16px var(--gutter) 0' }}>
      <section aria-label="Engagement under review" className="fund-band">
        <div className="fund-id">
          <div className="fund-entity">{entity ? entity.name : 'In review'}</div>
          <h1 className="fund-name">{f.name}</h1>
          <div className="fund-year">Year ended {fmtDate(f.yearEnd)}</div>
          <button type="button" className="link fd-toggle" aria-expanded={open} aria-controls="fd-facts" onClick={() => setOpen(o => !o)}>{open ? 'Hide details' : 'Show details'}</button>
        </div>
        <dl id="fd-facts" className={'fd-facts' + (open ? ' is-open' : '')}>
          {facts.map(([k, v, why]) => (
            <div key={k} className="fund-fact">
              <dt>{k}</dt>
              <dd title={why || v}>{k === 'AI assistance' && <span className={'fact-dot ' + (aiLabel === 'Enabled' ? 'is-on' : '')} aria-hidden="true" />}{v}</dd>
              {k === 'Documents' && <span className="fact-meter" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <i key={i} className={i < docsAttached ? 'is-on' : ''} style={{ '--i': i }} />)}</span>}
            </div>
          ))}
        </dl>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {onConsolidated && <Button size="sm" kind="secondary" onClick={onConsolidated}>Consolidated<span className="hide-sm">&nbsp;Review</span></Button>}
          <Button size="sm" kind="secondary" disabled={locked} onClick={onChange}>Change<span className="hide-sm">&nbsp;Engagement</span></Button>
        </div>
      </section>
    </div>
  );
}
