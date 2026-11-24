import React, { useEffect, useRef, useState } from 'react';
import BrandWordmark from './BrandWordmark';
import { BRAND } from '../lib/brand';

// The review steps take the colours of the login page's review cycle, so the workspace continues it.
export const STEP_COLOR = { docs: '#E9B949', analysis: '#8DBB3A', var: '#3FB8C9', sched: '#4F86D3', vers: '#3FB8C9', disc: '#8DBB3A', signoff: '#A9B6C8' };

// Fixed to the window height, drawn as a floating frosted panel (DiligenceX look). The brand and the user pill are
// pinned; the navigation and fund details sit between them and scroll only if a window is too short.
// Tabs marked `step` carry a coloured dot (hollow while locked), so the review order still shows.
export default function Sidebar({ tabs, tab, onTab, meta, user, onSignOut, navTitle = 'Review', subtitle = BRAND.by, open = false }) {
  const wide = new Set(['Entity', 'Fund', 'Engagement', 'Year End', 'Preparer', 'Reviewer', 'Manager']); // values that need the full width
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const close = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    const esc = e => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const item = t => {
    if (t.section) return <div key={t.id} className="side-section">{t.section}</div>;
    const on = tab === t.id;
    return (
      <button type="button" key={t.id} disabled={t.locked} aria-current={on ? 'page' : undefined} onClick={() => onTab(t.id)}
        className={'side-item' + (t.step ? ' is-step' : '') + (on ? ' is-on' : '')} style={t.step ? { '--c': STEP_COLOR[t.id] || '#A9B6C8' } : undefined}>
        {t.step && <span className="step-node" aria-hidden="true" />}
        <span className="side-label">{t.label}</span>
        {!t.locked && t.count !== '' && t.count != null && <span className="side-count">{t.count}</span>}
      </button>
    );
  };
  const initials = user ? user.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() : '';
  return (
    <aside id="app-sidebar" className={'sidebar' + (open ? ' is-open' : '')}>
      <div className="side-panel">
        <div className="side-brand">
          <img src="/pa-mark.png" alt="Project Accountants" width="36" height="36" />
          <div style={{ minWidth: 0 }}>
            <div className="side-brand-name"><BrandWordmark word={BRAND.word} label={BRAND.name} /></div>
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
          <div className="side-user" ref={menuRef}>
            <button type="button" className="side-user-pill" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}>
              <span aria-hidden="true" className="side-avatar">{initials}</span>
              <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
                <span className="side-name" title={user.name}>{user.name}</span>
                <span className="side-role">{user.role}</span>
              </span>
            </button>
            {menu && (
              <div className="side-menu" role="menu">
                {user.email && <div className="side-menu-email">{user.email}</div>}
                <button type="button" role="menuitem" className="side-menu-item" onClick={() => { setMenu(false); onSignOut(); }}>Sign out</button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
