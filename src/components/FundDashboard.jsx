import React, { useState } from 'react';
import { runnable } from '../data/checkLibrary';
import { useLibrary } from '../lib/library';
import { fmt, fmtDate, sym } from '../lib/format';
import { Button, cap, body, muted } from './ui';
import { personName } from '../lib/people';

// Summary of the engagement under review, shown at the top of every tab.
export default function FundDashboard({ aiLabel = '', aiWhy = '', engagement, entity, people = [], docsAttached, openPoints, done, onChange, locked }) {
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
    ['Documents', `${docsAttached} of 5`],
    ['Points open', done ? String(openPoints) : 'Not analysed'],
    ['AI assistance', aiLabel, aiWhy]
  ];
  return (
    <div style={{ padding: '12px var(--gutter) 0' }}>
      <section aria-label="Engagement under review" style={{ background: 'var(--snow-primary-purple)', borderRadius: 16, padding: '16px var(--card-pad)', display: 'flex', flexWrap: 'wrap', gap: '16px 32px', alignItems: 'center' }}>
        <div style={{ flex: '1 1 260px', minWidth: 'min(220px, 100%)' }}>
          <div style={{ ...cap, ...muted }}>{entity ? entity.name : 'In review'}</div>
          <div style={{ fontSize: 22, lineHeight: '30px', fontWeight: 600, marginTop: 2 }}>{f.name}</div>
          <div style={{ ...body, ...muted }}>Year ended {fmtDate(f.yearEnd)}</div>
          <button type="button" className="link fd-toggle" aria-expanded={open} aria-controls="fd-facts" onClick={() => setOpen(o => !o)} style={{ ...cap, marginTop: 6, textDecoration: 'underline' }}>{open ? 'Hide details' : 'Show details'}</button>
        </div>
        <dl id="fd-facts" className={'fd-facts' + (open ? ' is-open' : '')} style={{ flex: '3 1 560px', margin: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(min(112px, 100%), 1fr))', gap: '12px 20px' }}>
          {facts.map(([k, v, why]) => (
            <div key={k} style={{ minWidth: 0 }}>
              <dt style={{ ...cap, ...muted }}>{k}</dt>
              <dd style={{ ...body, fontWeight: 600, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={why || v}>{v}</dd>
            </div>
          ))}
        </dl>
        <Button size="sm" kind="secondary" disabled={locked} onClick={onChange}>Change Engagement</Button>
      </section>
    </div>
  );
}
