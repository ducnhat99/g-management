'use client';

import { useId } from 'react';

/** App mark: a plain 9999 gold ring. Inline SVG, so it needs no image file and stays sharp. */
export function GoldRingLogo({ className = 'size-12' }: { className?: string }) {
  // A unique gradient id per copy: with a shared id, a copy inside a hidden (display: none) block
  // would make every other copy's ring render invisible.
  const gradientId = `gold-ring-${useId()}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.45" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="24" fill="none" stroke={`url(#${gradientId})`} strokeWidth="9" />
      <path
        d="M14 22a22 22 0 0 1 14-10"
        fill="none"
        stroke="#fffbeb"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      <text
        x="32"
        y="35.5"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#92400e"
      >
        9999
      </text>
    </svg>
  );
}
