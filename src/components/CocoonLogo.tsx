/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface CocoonLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export default function CocoonLogo({ size = 40, className = '', showText = false }: CocoonLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* SVG Vector Icon mimicking the premium 3D cocoon app icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_4px_10px_rgba(16,185,129,0.15)] select-none"
      >
        {/* Soft squircle background container mimicking app icon shape */}
        <rect width="512" height="512" rx="128" fill="url(#cocoonBgGradient)" />

        {/* Golden central glowing core */}
        <ellipse cx="256" cy="256" rx="110" ry="145" fill="url(#coreGoldGradient)" />

        {/* Rising financial growth bar chart inside the core */}
        <g transform="translate(195, 220)">
          {/* Bar 1 */}
          <rect x="0" y="60" width="22" height="45" rx="6" fill="#134E4A" opacity="0.85" />
          {/* Bar 2 */}
          <rect x="36" y="35" width="22" height="70" rx="6" fill="#115E59" opacity="0.9" />
          {/* Bar 3 */}
          <rect x="72" y="10" width="22" height="95" rx="6" fill="#0D9488" />
          {/* Bar 4 */}
          <rect x="108" y="30" width="22" height="75" rx="6" fill="#14B8A6" opacity="0.95" />
        </g>

        {/* Central Currency Gold Coin above chart */}
        <circle cx="256" cy="180" r="32" fill="url(#coinGoldGradient)" filter="url(#dropShadow)" />
        {/* PKR currency symbol on coin */}
        <text
          x="256"
          y="189"
          fontFamily="font-sans, system-ui, sans-serif"
          fontWeight="900"
          fontSize="24"
          fill="#451A03"
          textAnchor="middle"
        >
          ₨
        </text>

        {/* Multi-layered organic wrapping cocoon leaves */}
        {/* Left main wrapping leaf */}
        <path
          d="M256 70C180 130 130 200 145 295C158 375 208 425 256 442C210 410 160 330 175 250C188 180 220 120 256 70Z"
          fill="url(#leafGreenLeft)"
          opacity="0.95"
        />

        {/* Right main wrapping leaf */}
        <path
          d="M256 70C332 130 382 200 367 295C354 375 304 425 256 442C302 410 352 330 337 250C324 180 292 120 256 70Z"
          fill="url(#leafGreenRight)"
          opacity="0.95"
        />

        {/* Left accent outer leaf overlay for depth */}
        <path
          d="M256 70C200 110 160 170 155 240C150 310 190 380 256 442C180 380 130 300 138 220C144 150 190 100 256 70Z"
          fill="url(#leafGreenOuter)"
          opacity="0.4"
        />

        {/* Golden accent leaf veins outline for high-end look */}
        <path
          d="M256 70C270 120 300 170 330 210M256 150C280 200 310 240 337 270M256 250C280 300 300 350 312 390"
          stroke="#FCD34D"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.3"
        />

        {/* Definitions for all gradient styling */}
        <defs>
          <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.25" />
          </filter>

          <linearGradient id="cocoonBgGradient" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#042F2E" /> {/* Very dark teal */}
            <stop offset="50%" stopColor="#0F172A" /> {/* Midnight navy */}
            <stop offset="100%" stopColor="#022C22" /> {/* Dark emerald forest */}
          </linearGradient>

          <linearGradient id="coreGoldGradient" x1="256" y1="110" x2="256" y2="401" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="60%" stopColor="#FEF3C7" />
            <stop offset="100%" stopColor="#FDE68A" />
          </linearGradient>

          <linearGradient id="coinGoldGradient" x1="224" y1="148" x2="288" y2="212" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          <linearGradient id="leafGreenLeft" x1="145" y1="70" x2="256" y2="442" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6EE7B7" /> {/* Mint */}
            <stop offset="40%" stopColor="#10B981" /> {/* Emerald */}
            <stop offset="100%" stopColor="#047857" /> {/* Deep Green */}
          </linearGradient>

          <linearGradient id="leafGreenRight" x1="367" y1="70" x2="256" y2="442" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#A7F3D0" /> {/* Soft mint */}
            <stop offset="50%" stopColor="#14B8A6" /> {/* Teal */}
            <stop offset="100%" stopColor="#0F766E" /> {/* Dark Teal */}
          </linearGradient>

          <linearGradient id="leafGreenOuter" x1="138" y1="70" x2="256" y2="442" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#065F46" />
          </linearGradient>
        </defs>
      </svg>

      {showText && (
        <div className="flex flex-col items-start leading-none select-none">
          <span className="text-[22px] font-black tracking-tight text-white font-display">
            cocoon
          </span>
          <span className="text-[8px] tracking-[0.25em] font-bold text-emerald-400 font-mono mt-0.5">
            PLAN. TRACK. GROW.
          </span>
        </div>
      )}
    </div>
  );
}
