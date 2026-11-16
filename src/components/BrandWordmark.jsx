import React, { useId } from 'react';

// The product's wordmark (design: "StatementX Sign In"): the name, then an X of two crossing strokes in the brand
// gradients, with a light sweeping along each in turn. Sized by font-size: everything is in em, so the same mark
// serves the sign-in page and the sidebar. `draw` draws the two strokes once, one after the other.
export default function BrandWordmark({ word, label, draw = false, className = '' }) {
  const id = 'bw' + useId().replace(/:/g, '');
  return (
    <span className={'brand-word' + (draw ? ' is-draw' : '') + (className ? ' ' + className : '')} role="img" aria-label={label || `${word}X`}>
      <span className="brand-word-base" aria-hidden="true">{word}</span>
      <svg className="brand-word-x" aria-hidden="true" viewBox="0 0 50 54" fill="none" focusable="false">
        <defs>
          <linearGradient id={`${id}a`} gradientUnits="userSpaceOnUse" x1="4" y1="2" x2="46" y2="52">
            <stop offset="0" stopColor="#5BB8D0" />
            <stop offset="1" stopColor="#8DD08A" />
          </linearGradient>
          <linearGradient id={`${id}b`} gradientUnits="userSpaceOnUse" x1="46" y1="2" x2="4" y2="52">
            <stop offset="0" stopColor="#8DD08A" />
            <stop offset="1" stopColor="#4FBFB0" />
          </linearGradient>
        </defs>
        <g>
          <path className="brand-word-stroke is-a" d="M5 3 L45 51" stroke={`url(#${id}a)`} strokeWidth="11" strokeLinecap="round" pathLength="100" strokeDasharray="100" />
          <path className="brand-word-stroke is-b" d="M45 3 L5 51" stroke={`url(#${id}b)`} strokeWidth="11" strokeLinecap="round" pathLength="100" strokeDasharray="100" />
          <path className="brand-word-sweep is-a" d="M5 3 L45 51" stroke="#fff" strokeWidth="11" strokeLinecap="round" pathLength="100" strokeDasharray="14 86" />
          <path className="brand-word-sweep is-b" d="M45 3 L5 51" stroke="#fff" strokeWidth="11" strokeLinecap="round" pathLength="100" strokeDasharray="14 86" />
        </g>
      </svg>
    </span>
  );
}
