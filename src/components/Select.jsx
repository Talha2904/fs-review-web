import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// The app's own dropdown, in place of the browser's <select> (whose open list cannot be styled). It takes the same
// props and <option>/<optgroup> children as a <select> and calls onChange with { target: { value } }, so a screen
// swaps one for the other without other changes. Keyboard and screen readers work as for a select: the button is a
// combobox, the list a listbox; arrows, Home/End, Page Up/Down, typing a letter, Enter or Space, Escape and Tab.
// The list opens below (or above, when there is more room) and stays inside the window on a phone.

const textOf = c => React.Children.toArray(c).map(x => (typeof x === 'string' || typeof x === 'number' ? String(x) : React.isValidElement(x) ? textOf(x.props.children) : '')).join('');

function optionsOf(children, group = null, out = []) {
  React.Children.toArray(children).forEach(ch => {
    if (!React.isValidElement(ch)) return;
    if (ch.type === 'option') {
      const label = textOf(ch.props.children);
      out.push({ value: ch.props.value !== undefined ? String(ch.props.value) : label, label, disabled: !!ch.props.disabled, group });
    } else if (ch.type === 'optgroup') optionsOf(ch.props.children, ch.props.label, out);
    else if (ch.type === React.Fragment) optionsOf(ch.props.children, group, out);
  });
  return out;
}

// consecutive options of one <optgroup> (or of none), in order: rendered as listbox groups
function runs(options) {
  const out = [];
  options.forEach((o, i) => {
    const last = out[out.length - 1];
    if (last && last.group === o.group) last.items.push(i); else out.push({ group: o.group, items: [i] });
  });
  return out;
}

const Chevron = () => (
  <svg className="cselect-chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export default function Select({ value, onChange, children, disabled, className = '', style, id, ...aria }) {
  const options = useMemo(() => optionsOf(children), [children]);
  const current = String(value ?? '');
  // like a select, a value that matches no option shows the first one
  const selIndex = Math.max(0, options.findIndex(o => o.value === current));
  const selected = options[selIndex];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selIndex);
  const [place, setPlace] = useState(null);
  const btn = useRef(null), list = useRef(null), typed = useRef({ s: '', t: 0 });
  const uid = useId().replace(/:/g, '');
  const listId = `cs-${uid}`, optId = i => `cs-${uid}-${i}`, btnId = id || `cs-${uid}-btn`;
  const autoWidth = style?.width === 'auto';

  const enabled = i => options[i] && !options[i].disabled;
  const step = (from, dir) => { for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (enabled(i)) return i; return from; };
  const isDisabled = () => disabled || !!btn.current?.disabled;
  const choose = i => {
    if (!enabled(i) || isDisabled()) { setOpen(false); return; }
    setOpen(false);
    if (options[i].value !== current) onChange?.({ target: { value: options[i].value }, currentTarget: { value: options[i].value } });
  };
  const show = () => { if (!isDisabled() && options.length) { setActive(enabled(selIndex) ? selIndex : step(-1, 1)); setOpen(true); } };
  // typing letters finds the next option that starts with them (as a select does)
  const find = key => {
    const now = Date.now(), t = typed.current;
    t.s = (now - t.t > 700 ? '' : t.s) + key.toLowerCase(); t.t = now;
    const from = open ? active : selIndex;
    const order = [...options.keys()].map(k => (from + (t.s.length === 1 ? 1 : 0) + k) % options.length);
    return order.find(i => enabled(i) && options[i].label.toLowerCase().startsWith(t.s));
  };

  const onKeyDown = e => {
    const k = e.key;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k)) { e.preventDefault(); show(); }
      else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { const i = find(k); if (i != null) choose(i); }
      return;
    }
    const page = 8;
    if (k === 'ArrowDown') setActive(a => step(a, 1));
    else if (k === 'ArrowUp') setActive(a => step(a, -1));
    else if (k === 'Home') setActive(step(-1, 1));
    else if (k === 'End') setActive(step(options.length, -1));
    else if (k === 'PageDown') setActive(a => { let i = a; for (let n = 0; n < page; n++) i = step(i, 1); return i; });
    else if (k === 'PageUp') setActive(a => { let i = a; for (let n = 0; n < page; n++) i = step(i, -1); return i; });
    else if (k === 'Enter' || k === ' ') choose(active);
    else if (k === 'Tab') { setOpen(false); return; }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { const i = find(k); if (i != null) setActive(i); }
    else return;
    e.preventDefault();
  };

  // place the list under the button (or above it when there is more room there), inside the window
  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      const r = btn.current.getBoundingClientRect();
      const vw = document.documentElement.clientWidth, vh = window.innerHeight, gap = 4, edge = 8;
      const natural = list.current ? list.current.scrollHeight : 0;
      const below = vh - r.bottom - gap - edge, above = r.top - gap - edge;
      const up = natural > below && above > below;
      const maxHeight = Math.max(0, Math.min(natural || 320, 320, up ? above : below));
      const minWidth = Math.min(r.width, vw - 2 * edge);
      const width = list.current ? Math.min(Math.max(list.current.scrollWidth, minWidth), vw - 2 * edge) : minWidth;
      const left = Math.max(edge, Math.min(r.left, vw - edge - width));
      setPlace({ left, minWidth, maxWidth: vw - 2 * edge, maxHeight, ...(up ? { bottom: vh - r.top + gap } : { top: r.bottom + gap }) });
    };
    measure();
    // the page or a dialog scrolling under it, or the window resizing, would leave it behind: close it
    const onScroll = e => { if (!list.current?.contains(e.target)) setOpen(false); };
    const onDown = e => { if (!btn.current?.contains(e.target) && !list.current?.contains(e.target)) setOpen(false); };
    // Escape closes the list, not the dialog it sits in
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); setOpen(false); } };
    window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', measure);
    document.addEventListener('pointerdown', onDown); window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', measure);
      document.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey, true);
    };
  }, [open, options.length]);
  useEffect(() => { if (!open) setPlace(null); }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  // keep the highlighted option in view by scrolling the list only (scrollIntoView could move the page under it)
  useEffect(() => {
    const ul = list.current, el = open && document.getElementById(optId(active));
    if (!ul || !el) return;
    if (el.offsetTop < ul.scrollTop) ul.scrollTop = el.offsetTop - 4;
    else if (el.offsetTop + el.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = el.offsetTop + el.offsetHeight - ul.clientHeight + 4;
  }, [open, active, place]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button ref={btn} type="button" id={btnId} className={'input cselect ' + className} style={style} disabled={disabled}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optId(active) : undefined} {...aria}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKeyDown} onBlur={() => setOpen(false)}>
        <span className="cselect-val">
          {/* width:auto sizes to the longest option, as a select does: every label sits in one cell, only the chosen one shows */}
          {autoWidth ? options.map((o, i) => <span key={i} aria-hidden={i !== selIndex} className={i === selIndex ? '' : 'cselect-sizer'}>{o.label}</span>) : <span>{selected?.label ?? ''}</span>}
        </span>
        <Chevron />
      </button>
      {open && createPortal(
        <ul ref={list} id={listId} role="listbox" className="cselect-list" aria-labelledby={btnId} tabIndex={-1}
          style={place ? place : { visibility: 'hidden', top: 0, left: 0 }}
          onMouseDown={e => e.preventDefault() /* the button keeps focus */}
          onClick={e => e.stopPropagation() /* a click here is not a click on whatever holds the control */}>
          {runs(options).map(({ group, items }, gi) => {
            const opts = items.map(i => {
              const o = options[i];
              return (
                <li key={i} id={optId(i)} role="option" aria-selected={i === selIndex} aria-disabled={o.disabled || undefined}
                  className={'cselect-opt' + (i === active ? ' is-active' : '') + (group ? ' in-group' : '')}
                  onMouseMove={() => { if (!o.disabled && i !== active) setActive(i); }} onClick={() => choose(i)}>
                  <span className="cselect-opt-label">{o.label}</span>
                  {i === selIndex && <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.5 6 10.5l5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </li>
              );
            });
            return group ? (
              <li key={'g' + gi} role="presentation">
                <div id={`${listId}-g${gi}`} className="cselect-group" aria-hidden="true">{group}</div>
                <ul role="group" aria-labelledby={`${listId}-g${gi}`} className="cselect-sub">{opts}</ul>
              </li>
            ) : <React.Fragment key={'n' + gi}>{opts}</React.Fragment>;
          })}
        </ul>, document.body)}
    </>
  );
}
