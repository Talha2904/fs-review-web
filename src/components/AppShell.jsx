import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';

// The frame every signed-in area shares: sidebar, top bar with the breadcrumb and actions, then the screen.
// Below 1024px the sidebar becomes a drawer opened from the top bar; choosing a screen, Escape or the scrim closes it.
export default function AppShell({ sidebar, root, crumb, actions, children }) {
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = e => { if (e.key === 'Escape') setNavOpen(false); };
    const wide = window.matchMedia('(min-width: 1024px)');
    const onWide = () => { if (wide.matches) setNavOpen(false); };
    document.addEventListener('keydown', onKey);
    wide.addEventListener('change', onWide);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const opener = document.activeElement;
    document.querySelector('#app-sidebar [aria-current="page"], #app-sidebar .side-item:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey); wide.removeEventListener('change', onWide); document.body.style.overflow = overflow;
      if (document.activeElement?.closest?.('#app-sidebar')) opener?.focus?.();
    };
  }, [navOpen]);

  return (
    <div className="shell">
      <Sidebar {...sidebar} open={navOpen} onTab={t => { setNavOpen(false); sidebar.onTab(t); }} />
      {navOpen && <div className="shell-scrim" aria-hidden="true" onClick={() => setNavOpen(false)} />}
      <main className="shell-main">
        <header className="topbar">
          <button type="button" className="nav-toggle" aria-label="Open menu" aria-expanded={navOpen} aria-controls="app-sidebar" onClick={() => setNavOpen(true)}>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 5.5h14M3 10h14M3 14.5h14" /></svg>
          </button>
          <div className="crumb">
            <span className="crumb-root">{root}</span><span className="crumb-root crumb-sep">/</span><span className="crumb-here">{crumb}</span>
          </div>
          {actions && <div className="topbar-actions">{actions}</div>}
        </header>
        {children}
      </main>
    </div>
  );
}
