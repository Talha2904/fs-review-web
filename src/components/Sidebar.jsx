import React from 'react';

// The review steps take the colours of the login page's review cycle, so the workspace continues it.
export const STEP_COLOR = { docs: '#E9B949', analysis: '#8DBB3A', var: '#3FB8C9', sched: '#4F86D3', vers: '#3FB8C9', disc: '#8DBB3A', signoff: '#A9B6C8' };

// Fixed to the window height. The header and the signed-in user are pinned; the navigation and
// fund details sit between them and scroll only if a window is too short to show everything.
// Tabs marked `step` are drawn as the review rail: a connected sequence, hollow while locked.
export default function Sidebar({ tabs, tab, onTab, meta, user, onSignOut, navTitle = 'Review', subtitle = 'Fund reporting', open = false }) {
  const wide = new Set(['Entity', 'Fund', 'Engagement', 'Year End', 'Preparer', 'Reviewer', 'Manager']); // values that need the full width
  const item = (t, i, list) => {
    if (t.section) return <div key={t.id} className="side-section">{t.section}</div>;
    const on = tab === t.id, next = list[i + 1];
    return (
      <button type="button" key={t.id} disabled={t.locked} aria-current={on ? 'page' : undefined} onClick={() => onTab(t.id)}
        className={'side-item' + (t.step ? ' is-step' : '') + (on ? ' is-on' : '')} style={t.step ? { '--c': STEP_COLOR[t.id] || '#A9B6C8' } : undefined}>
        {t.step ? <span className="step-node" aria-hidden="true" /> : <span className="side-bar" aria-hidden="true" />}
        {t.step && next?.step && <span className={'step-line' + (next.locked ? '' : ' is-open')} aria-hidden="true" />}
        <span className="side-label">{t.label}</span>
        {!t.locked && t.count !== '' && t.count != null && <span className="side-count">{t.count}</span>}
      </button>
    );
  };
  return (
    <aside id="app-sidebar" className={'sidebar' + (open ? ' is-open' : '')}>
      <div className="side-brand">
        <img src="/pa-mark.png" alt="Project Accountants" width="30" height="30" />
        <div>
          <div className="side-brand-name">FS Review</div>
          <div className="side-brand-sub">{subtitle}</div>
        </div>
      </div>

      <div className="sidebar-middle">
        <nav aria-label={navTitle} className="side-nav">
          <div className="side-section">{navTitle}</div>
          {tabs.map(item)}
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
