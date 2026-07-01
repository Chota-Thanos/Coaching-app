import React from "react";

export function WayToIASLogo({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 70"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Yellow road strip */}
      <path
        d="M58 43C65 34 76 22 96 15C88 20 76 34 68 47Z"
        fill="#e5b436"
      />
      {/* Road center dotted line */}
      <path
        d="M62 45C68 37 79 25 93 17"
        stroke="white"
        strokeWidth="1.2"
        strokeDasharray="2 3"
        strokeLinecap="round"
      />

      {/* Blue stylized 'W' */}
      <path
        d="M 15 45 C 8 44 14 58 22 58 C 30 58 38 38 48 38 C 58 38 64 58 72 58 C 80 58 88 38 96 32 C 88 36 82 52 72 52 C 62 52 56 42 48 42 C 40 42 32 52 22 52 C 12 52 22 45 15 45 Z"
        fill="#0f3b8c"
      />

      {/* Gold Star and rays at the top right */}
      <g transform="translate(98, 14)">
        {/* The 5-point star */}
        <polygon
          points="0,-7 2,-2 7.5,-2 3,1.5 5,6.5 0,3 -5,6.5 -3,1.5 -7.5,-2 -2,-2"
          fill="#e5b436"
        />
        {/* Outer glowing rays */}
        <line x1="0" y1="-11" x2="0" y2="-9" stroke="#e5b436" strokeWidth="1" strokeLinecap="round" />
        <line x1="7.8" y1="-7.8" x2="5.6" y2="-5.6" stroke="#e5b436" strokeWidth="1" strokeLinecap="round" />
        <line x1="11" y1="0" x2="9" y2="0" stroke="#e5b436" strokeWidth="1" strokeLinecap="round" />
        <line x1="7.8" y1="7.8" x2="5.6" y2="5.6" stroke="#e5b436" strokeWidth="1" strokeLinecap="round" />
        <line x1="0" y1="11" x2="0" y2="9" stroke="#e5b436" strokeWidth="1" strokeLinecap="round" />
        <line x1="-7.8" y1="7.8" x2="-5.6" y2="-5.6" stroke="#e5b436" strokeWidth="1" strokeLinecap="round" />
        <line x1="-11" y1="0" x2="-9" y2="0" stroke="#e5b436" strokeWidth="1" strokeLinecap="round" />
        <line x1="-7.8" y1="-7.8" x2="-5.6" y2="-5.6" stroke="#e5b436" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  );
}
