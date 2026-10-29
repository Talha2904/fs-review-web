import React, { useEffect, useRef } from 'react';
import { h3 } from './ui';

// Accessible dialog: focus moves inside on open, Tab stays inside, Escape or the backdrop closes it,
// and focus returns to whatever opened it.
export default function Modal({ title, onClose, children, footer, width = 440 }) {
  const box = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    const focusables = () => [...box.current.querySelectorAll('input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled);
    (focusables()[0] || box.current).focus();
    const onKey = e => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey, true); document.body.style.overflow = overflow; opener?.focus?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} className="modal" style={{ maxWidth: width }}>
        <h2 id="modal-title" style={{ ...h3, margin: 0 }}>{title}</h2>
        <div style={{ marginTop: 16 }}>{children}</div>
        {footer && <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>{footer}</div>}
      </div>
    </div>
  );
}
