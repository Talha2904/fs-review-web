import React from 'react';
import { cap, body, muted } from './ui';

// Fixed to the window height. The header and the signed-in user are pinned; the navigation and
// fund details sit between them and scroll only if a window is too short to show everything.
export default function Sidebar({ tabs, tab, onTab, meta, user, onSignOut, navTitle = 'Review', subtitle = 'Fund reporting' }) {
  const wide = new Set(['Entity', 'Fund', 'Engagement', 'Year End', 'Preparer', 'Reviewer', 'Manager']); // values that need the full width
  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '0 8px', flex: '0 0 auto' }}>
        <img src="/pa-mark.png" alt="Project Accountants" style={{ width: 28, height: 28 }} />
        <div>
          <div style={{ ...body, fontWeight: 600 }}>FS Review</div>
          <div style={{ ...cap, ...muted }}>{subtitle}</div>
        </div>
      </div>

      <div className="sidebar-middle">
        <nav aria-label={navTitle} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ ...cap, ...muted, padding: '6px 8px' }}>{navTitle}</div>
          {tabs.map(t => {
            if (t.section) return <div key={t.id} style={{ ...cap, ...muted, padding: '14px 8px 6px' }}>{t.section}</div>;
            const on = tab === t.id;
            return (
              <button type="button" key={t.id} className={'side-item' + (t.locked ? '' : ' hov')} disabled={t.locked} aria-current={on ? 'page' : undefined}
                onClick={() => onTab(t.id)} style={{ background: on ? 'var(--snow-ink-5)' : 'transparent', color: t.locked ? 'var(--snow-black-20)' : 'var(--snow-black-100)' }}>
                <span style={{ width: 4, height: 16, borderRadius: 8, background: on ? 'var(--snow-black-100)' : 'transparent' }} />
                <span style={{ flex: 1 }}>{t.label}</span>
                <span style={{ ...cap, ...muted }}>{t.locked ? '' : t.count}</span>
              </button>
            );
          })}
        </nav>

        {meta.length > 0 && (
          <dl className="side-meta">
            {meta.map(m => (
              <div key={m.k} style={{ gridColumn: wide.has(m.k) ? '1 / -1' : 'auto', minWidth: 0 }}>
                <dt className="side-meta-k">{m.k}</dt>
                <dd className="side-meta-v">{m.v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {user && (
        <div className="side-user">
          <div aria-hidden="true" className="side-avatar">{user.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="side-name" title={user.name}>{user.name}</div>
            <div className="side-role">{user.role}</div>
          </div>
          <button type="button" className="side-signout" aria-label="Sign out" title="Sign out" onClick={onSignOut}>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3.5 H4.5 a1 1 0 0 0 -1 1 V15.5 a1 1 0 0 0 1 1 H8" />
              <path d="M8.5 10 H17" />
              <path d="M13.5 6.5 L17 10 L13.5 13.5" />
            </svg>
          </button>
        </div>
      )}
    </aside>
  );
}
