import React, { useId } from 'react';

// The product's "Arc" wordmark (design: "StatementArc Sign In"): the name, then "Ar" in the moving brand gradient,
// then the "c" drawn as an arc with a dot at its open end. Sized by font-size: everything is in em, so the same
// mark serves the sign-in page and the sidebar. `draw` animates the arc being drawn and the dot appearing once.
export default function ArcWordmark({ word, label, draw = false, className = '' }) {
  const id = 'arc' + useId().replace(/:/g, '');
  return (
    <span className={'arc-word' + (draw ? ' is-draw' : '') + (className ? ' ' + className : '')} role="img" aria-label={label || `${word}Arc`}>
      <span className="arc-word-base" aria-hidden="true">{word}</span>
      <span className="arc-word-ar" aria-hidden="true">Ar</span>
      <svg className="arc-word-c" aria-hidden="true" viewBox="0 0 50 54" fill="none" focusable="false">
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="50" y2="54">
            <stop offset="0" stopColor="#8DD08A" />
            <stop offset="1" stopColor="#4FBFB0" />
          </linearGradient>
        </defs>
        <path className="arc-word-path" d="M44 12 A23 23 0 1 0 44 42" stroke={`url(#${id})`} strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray="100" />
        <circle className="arc-word-dot" cx="46" cy="8" r="4.5" />
      </svg>
    </span>
  );
}
