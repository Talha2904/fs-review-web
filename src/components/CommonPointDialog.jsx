import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Select from './Select';
import { Button, Field, cap, body, muted } from './ui';
import { fmtDate } from '../lib/format';
import { reviewStore } from '../lib/reviewStore';

// A common review point: one matter raised in several related funds at once (entities with the same Client name,
// funds with the same year end). Each fund gets its own copy to respond to and clear; the copies share one thread.
// `focus` picks the group to start on: { entityName } (the Portfolio's client filter) or { groupKey, yearEnd }.
const keyOf = g => `${g.groupKey}|${g.yearEnd}`;

export default function CommonPointDialog({ focus, onClose, onRaised, onOpenPoint }) {
  const [groups, setGroups] = useState(null), [key, setKey] = useState(''), [chosen, setChosen] = useState([]);
  const [title, setTitle] = useState(''), [basis, setBasis] = useState(''), [pri, setPri] = useState('Medium');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(null);
  const [notFound, setNotFound] = useState('');
  const sending = useRef(false); // one raise per click, even before the button re-renders as busy

  useEffect(() => {
    let gone = false;
    reviewStore.consolidatedGroups().then(r => {
      if (gone) return;
      const list = r.groups || [];
      const start = list.find(g => (focus?.groupKey ? g.groupKey === focus.groupKey && g.yearEnd === focus.yearEnd
        : focus?.entityName ? g.funds.some(f => f.entityName === focus.entityName) : false));
      setGroups(list);
      if (start) pick(start);
      else if (focus?.entityName) setNotFound(focus.entityName);
    }, e => { if (!gone) { setError(e.message); setGroups([]); } });
    return () => { gone = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // every fund that can take a point is chosen to start with; signed-off funds cannot
  const pick = g => { if (!g) { setKey(''); setChosen([]); return; } setKey(keyOf(g)); setChosen(g.funds.filter(f => !f.locked).map(f => f.engagementId)); };
  const group = groups?.find(g => keyOf(g) === key) || null;
  const toggle = id => setChosen(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]));
  const nameOf = id => group?.funds.find(f => f.engagementId === id)?.fundName || 'A fund';

  const raise = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true); setError('');
    try {
      const out = await reviewStore.raiseCommonPoint(chosen, { title: title.trim(), ...(basis.trim() ? { basis: basis.trim() } : {}), pri });
      onRaised?.(out, out.points.map(p => nameOf(p.engagementId)));
      setDone(out.points);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); sending.current = false; }
  };

  if (done) return (
    <Modal title="Common review point raised" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
      <div style={body}>Raised in {done.length} funds. Each fund responds to and clears its own copy.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
        {done.map(p => (
          <button key={p.id} type="button" className="link" style={{ ...body, textAlign: 'left' }} onClick={() => { onClose(); onOpenPoint?.(p.engagementId, p.ref); }}>
            {nameOf(p.engagementId)} · {p.ref}
          </button>))}
      </div>
    </Modal>
  );

  const canRaise = group && chosen.length >= 2 && title.trim() && !busy;
  return (
    <Modal title="Common review point" width={520} onClose={onClose} footer={<>
      <Button kind="secondary" onClick={onClose}>Cancel</Button>
      <Button disabled={!canRaise} onClick={raise}>{busy ? 'Raising…' : `Raise in ${chosen.length} fund${chosen.length === 1 ? '' : 's'}`}</Button>
    </>}>
      <div style={{ ...cap, ...muted }}>One matter raised in several related funds. Each fund gets its own copy to respond to and clear; comments show in one thread.</div>
      {groups === null && <div style={{ ...body, ...muted, marginTop: 12 }}>Loading…</div>}
      {groups && !groups.length && !error && (
        <div style={{ ...body, marginTop: 12 }}>No group of related funds yet. Give related entities the same Client name under Edit Entity; their funds with the same year end form a group.</div>)}
      {groups && groups.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {notFound && <div role="status" style={{ ...cap, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>{notFound} is not in a group of related funds. Choose the group to raise the point in.</div>}
          <Field label="Group">
            <Select className="input" value={key} onChange={e => pick(groups.find(g => keyOf(g) === e.target.value))}>
              {!group && <option value="">Choose a group…</option>}
              {groups.map(g => <option key={keyOf(g)} value={keyOf(g)}>{g.groupName} · {g.yearEnd ? fmtDate(g.yearEnd) : 'no year end'} · {g.funds.length} funds</option>)}
            </Select>
          </Field>
        </div>)}
      {group && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
          <div role="group" aria-label="Funds">
            <div style={{ ...cap, ...muted, marginBottom: 4 }}>Funds</div>
            {group.funds.map(f => (
              <label key={f.engagementId} className={'share-fund' + (f.locked ? ' is-locked' : '')}>
                <input type="checkbox" disabled={f.locked} checked={chosen.includes(f.engagementId)} onChange={() => toggle(f.engagementId)} />
                <span style={{ minWidth: 0 }}><span style={body}>{f.fundName}</span><span style={{ ...cap, ...muted, display: 'block' }}>{f.entityName}{f.locked ? ' · signed off, so nothing can be added' : ''}</span></span>
              </label>))}
          </div>
          <Field label="Title">
            <input className="input" value={title} maxLength={500} onChange={e => setTitle(e.target.value)} placeholder="The matter, in one line" />
          </Field>
          <Field label="Details" hint="Optional.">
            <textarea className="input" rows={3} maxLength={5000} style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }} value={basis} onChange={e => setBasis(e.target.value)} placeholder="What needs to be done or explained" />
          </Field>
          <Field label="Priority">
            <Select className="input" value={pri} onChange={e => setPri(e.target.value)}>
              <option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
            </Select>
          </Field>
        </div>)}
      {error && <div role="alert" style={{ ...cap, marginTop: 12, background: 'var(--snow-status-rejected-bg)', borderRadius: 8, padding: '8px 10px' }}>{error}</div>}
    </Modal>
  );
}
