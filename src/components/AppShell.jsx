import React, { useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import { BRAND } from '../lib/brand';

// The frame every signed-in area shares: sidebar, top bar with the breadcrumb and actions, then the screen.
// Below 1024px the sidebar becomes a drawer opened from the top bar; choosing a screen, Escape or the scrim closes it.
export default function AppShell({ sidebar, root, crumb, actions, children, accent = '#3E7CC4' }) {
  const [navOpen, setNavOpen] = useState(false);
  // When the screen changes its content rises into place, the panels following one another.
  const pageRef = useRef(null);
  useEffect(() => {
    const el = pageRef.current;
    if (!el?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    [...el.querySelectorAll('.fund-band, .kpi, .tile, .card, .dt-row')].slice(0, 14).forEach((n, i) =>
      n.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 40 + i * 35, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'backwards' }));
  }, [crumb]);
  // A ripple from the point where a button is pressed.
  const onPress = e => {
    const b = e.target.closest?.('.btn:not(:disabled)');
    if (!b || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement('span');
    s.className = 'ripple'; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.appendChild(s); s.addEventListener('animationend', () => s.remove());
  };
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
    <div className="shell" style={{ '--accent': accent }} onPointerDown={onPress}>
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
          {(actions || BRAND.prepareFsUrl) && <div className="topbar-actions">
            {/* the next application, in a new tab; shown once its address is set in lib/brand.js */}
            {BRAND.prepareFsUrl && <a className="btn btn-secondary" href={BRAND.prepareFsUrl} target="_blank" rel="noopener noreferrer" style={{ height: 32, padding: '0 14px', textDecoration: 'none' }}>Prepare<span className="hide-sm">&nbsp;FS</span></a>}
            {actions}
          </div>}
        </header>
        <div ref={pageRef} className="shell-page">{children}</div>
      </main>
    </div>
  );
}
