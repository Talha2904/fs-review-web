import React, { useEffect, useRef, useState } from 'react';
import { cap, body, muted } from './ui';

const when = iso => {
  if (!iso) return '';
  const d = new Date(iso), mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return 'just now'; if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// The bell shows how many things need you plus how many updates are new since you last opened it. The api sends
// the newest 50 actions and the total (actionCount); the Portfolio screen shows every fund's open points.
export default function NotificationBell({ actions, actionCount = actions.length, updates, seenAt, onSeen, onGo }) {
  const [open, setOpen] = useState(false);
  const [seenWhenOpened, setSeenWhenOpened] = useState(seenAt);
  const wrap = useRef(null), btn = useRef(null);
  const unread = updates.filter(u => (u.at || '') > (seenAt || '')).length;
  const count = actionCount + unread;

  const toggle = () => {
    if (!open) { setSeenWhenOpened(seenAt); onSeen(); }
    setOpen(o => !o);
  };
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    const onDown = e => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);
  const go = item => { setOpen(false); onGo(item); };

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <button ref={btn} type="button" className="bell" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}
        aria-label={count ? `Notifications: ${actionCount} need your action, ${unread} new update${unread === 1 ? '' : 's'}` : 'Notifications'}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2.2 2.2 0 0 0 4 0" />
        </svg>
        {count > 0 && <span className="bell-badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="bell-panel">
          <div style={{ ...body, fontWeight: 600, padding: '14px 16px 8px' }}>Notifications</div>
          <Section title={`Needs your action (${actionCount})`} empty="Nothing is waiting for you.">
            {actions.map(a => <Item key={a.id} item={a} onGo={go} strong />)}
            {actionCount > actions.length && (
              <div style={{ ...cap, ...muted, padding: '6px 16px 10px' }}>The newest {actions.length} are shown. The Portfolio screen lists every fund’s open points.</div>
            )}
          </Section>
          <Section title="Updates" empty="No updates yet.">
            {updates.map(u => <Item key={u.id} item={u} onGo={go} unread={(u.at || '') > (seenWhenOpened || '')} />)}
          </Section>
        </div>
      )}
    </div>
  );
}

const Section = ({ title, empty, children }) => (
  <div>
    <div style={{ ...cap, ...muted, padding: '8px 16px 4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>{title}</div>
    {React.Children.count(children) ? <ul style={{ listStyle: 'none', margin: 0, padding: '0 8px 8px' }}>{children}</ul>
      : <div style={{ ...cap, ...muted, padding: '4px 16px 12px' }}>{empty}</div>}
  </div>
);

const Item = ({ item, onGo, strong, unread }) => (
  <li>
    <button type="button" className="bell-item" onClick={() => onGo(item)}>
      <span className="bell-dot" style={{ background: strong ? 'var(--snow-black-100)' : unread ? '#2F6FEB' : 'transparent' }} aria-hidden="true" />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ ...body, display: 'block', fontWeight: strong || unread ? 600 : 400 }}>{item.title}{unread && <span className="sr-only"> (new)</span>}</span>
        {item.detail && <span style={{ ...cap, ...muted, display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.detail}</span>}
        <span style={{ ...cap, ...muted, display: 'block', marginTop: 2 }}>{item.fund} · {when(item.at)}</span>
      </span>
    </button>
  </li>
);
