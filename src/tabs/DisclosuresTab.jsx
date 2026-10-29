import React, { useMemo, useState } from 'react';
import { Button, Card, Pill, Segmented, cap, body, h2, muted, page, RING } from '../components/ui';
import { suggestLocation, checklistSummary } from '../lib/disclosures';

const A = { yes: ['Yes', 'var(--snow-status-complete-bg)'], no: ['No', 'rgba(255,71,71,0.14)'], na: ['N/A', 'var(--snow-ink-5)'] };

// The disclosure checklist (CHK-13) for this fund: the reviewer answers each item Yes, No or N/A with a
// reference. Suggestions come from a search of the draft for each item's keywords (no AI).
export default function DisclosuresTab({ framework, list, state, cy, canAnswer, onAnswer, signed }) {
  const [view, setView] = useState('open');
  const [refs, setRefs] = useState({});
  const items = state?.framework === framework ? state.items : list?.items || [];
  const answers = state?.framework === framework ? state.answers : {};
  const sum = checklistSummary({ items }, { answers });
  const hints = useMemo(() => Object.fromEntries(items.map(i => [i.id, suggestLocation(i, cy)])), [items, cy]);
  const shown = items.filter(i => view === 'all' || (view === 'open' ? !answers[i.id]?.answer : view === 'no' ? answers[i.id]?.answer === 'no' : !!answers[i.id]?.answer));
  const sections = [...new Set(shown.map(i => i.section))];

  if (!framework || framework === 'Other' || !list) return (
    <div style={page}><div style={h2}>Disclosures</div>
      <Card><div style={body}>{!framework ? 'The client’s accounting framework isn’t set, so there is no checklist to complete. A Manager sets it on the client’s entity (Engagement › Edit Entity).' : framework === 'Other' ? 'The client’s framework is “Other”, so there is no built-in checklist. Ask the Administrator to add one, or set the framework to FRS 102 or IFRS.' : 'No checklist is available for this framework.'}</div></Card></div>);

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><div style={h2}>Disclosures</div><Pill bg="var(--snow-primary-purple)">{framework}</Pill>{(state?.version || list.version) === 'starter' && <Pill bg="var(--snow-status-approved-bg)">Starter checklist</Pill>}</div>
          <div style={{ ...cap, ...muted, marginTop: 4 }}>{sum.answered} of {sum.total} answered · {sum.no} “No” · checklist version {state?.version || list.version}{(state?.version || list.version) === 'starter' ? ' · a short generic list: the Administrator should replace it with the firm’s checklist' : ''}</div>
        </div>
        <Segmented value={view} onChange={setView} options={[['open', `To Answer (${sum.unanswered})`], ['no', `No (${sum.no})`], ['done', 'Answered'], ['all', 'All']]} />
      </div>
      {signed && <div role="status" style={{ ...cap, background: 'var(--snow-ink-5)', borderRadius: 8, padding: '8px 12px' }}>The review is signed off; the checklist is read-only.</div>}
      {!shown.length && <Card><div style={{ ...body, ...muted }}>{view === 'open' ? 'Every item has been answered.' : 'No items in this view.'}</div></Card>}
      {sections.map(sec => (
        <Card key={sec}>
          <div style={{ ...body, fontWeight: 600 }}>{sec}</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
            {shown.filter(i => i.section === sec).map(i => {
              const a = answers[i.id], h = hints[i.id];
              return (
                <div key={i.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,1.6fr) minmax(220px,1.2fr) auto', gap: 14, alignItems: 'start', padding: '12px 0', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.06)' }}>
                  <div>
                    <div style={body}><span style={{ ...cap, ...muted, marginRight: 6 }}>{i.ref}</span>{i.text}</div>
                    <div style={{ ...cap, marginTop: 4, color: h ? '#2E6B12' : 'var(--snow-black-40)' }}>{h ? <>Possibly in <b>{h.where}</b>: “{h.snippet}”</> : 'Nothing found in the draft for this item’s keywords.'}</div>
                    {a && <div style={{ ...cap, ...muted, marginTop: 4 }}>{A[a.answer][0]} · {a.by?.name} · {new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{a.ref ? ` · ${a.ref}` : ''}</div>}
                  </div>
                  <input className="input" aria-label={`Reference for ${i.ref}`} placeholder="Where disclosed (e.g. Note 5), or why N/A" disabled={!canAnswer}
                    value={refs[i.id] ?? a?.ref ?? (h && !a ? h.where : '')} onChange={e => setRefs(x => ({ ...x, [i.id]: e.target.value }))} />
                  <div role="group" aria-label={`Answer for ${i.ref}`} style={{ display: 'flex', gap: 6 }}>
                    {Object.entries(A).map(([k, [label, bg]]) => (
                      <button key={k} type="button" disabled={!canAnswer} aria-pressed={a?.answer === k}
                        onClick={() => onAnswer(i, k, refs[i.id] ?? a?.ref ?? (h ? h.where : ''))}
                        style={{ height: 32, minWidth: 48, padding: '0 10px', borderRadius: 8, border: 0, font: 'inherit', fontSize: 13, cursor: canAnswer ? 'pointer' : 'default', boxShadow: RING,
                          background: a?.answer === k ? bg : '#fff', fontWeight: a?.answer === k ? 600 : 400 }}>{label}</button>))}
                  </div>
                </div>);
            })}
          </div>
        </Card>
      ))}
      <div style={{ ...cap, ...muted, maxWidth: 900 }}>Each “No” raises a review point for the preparer. If CHK-13 is on, the Manager can sign off only when every item is answered.</div>
    </div>
  );
}
