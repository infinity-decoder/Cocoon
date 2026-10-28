/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface CocoonLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export default function CocoonLogo({ size = 40, className = '', showText = false }: CocoonLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* SVG Vector Icon rebranding with the new Cocoon signature palette */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_4px_12px_rgba(231,68,37,0.25)] select-none"
      >
        {/* Soft squircle background container: Ebony -> DigiKhata Navy -> Asphalt */}
        <rect width="512" height="512" rx="128" fill="url(#cocoonBgGradient)" />

        {/* Radiant central glowing core: Double Spanish White & Wisp Pink */}
        <ellipse cx="256" cy="256" rx="110" ry="145" fill="url(#coreWarmGradient)" />

        {/* Financial growth bar chart: Charcoal -> DigiKhata Navy -> Contessa -> Cinnabar */}
        <g transform="translate(195, 220)">
          {/* Bar 1 */}
          <rect x="0" y="60" width="22" height="45" rx="6" fill="#26282A" opacity="0.9" />
          {/* Bar 2 */}
          <rect x="36" y="35" width="22" height="70" rx="6" fill="#111F49" opacity="0.95" />
          {/* Bar 3 */}
          <rect x="72" y="10" width="22" height="95" rx="6" fill="#C67764" />
          {/* Bar 4 */}
          <rect x="108" y="25" width="22" height="80" rx="6" fill="#E74425" />
        </g>

        {/* Central Currency Coin: Cinnabar & Tangerine glow */}
        <circle cx="256" cy="180" r="32" fill="url(#coinWarmGradient)" filter="url(#dropShadow)" />
        {/* PKR currency symbol on coin */}
        <text
          x="256"
          y="189"
          fontFamily="font-sans, system-ui, sans-serif"
          fontWeight="900"
          fontSize="24"
          fill="#FFFFFF"
          textAnchor="middle"
        >
          ₨
        </text>

        {/* Multi-layered organic wrapping cocoon leaves */}
        {/* Left main wrapping leaf: Cinnabar to Tangerine to Contessa */}
        <path
          d="M256 70C180 130 130 200 145 295C158 375 208 425 256 442C210 410 160 330 175 250C188 180 220 120 256 70Z"
          fill="url(#leafWarmLeft)"
          opacity="0.96"
        />

        {/* Right main wrapping leaf: Double Spanish White to Contessa */}
        <path
          d="M256 70C332 130 382 200 367 295C354 375 304 425 256 442C302 410 352 330 337 250C324 180 292 120 256 70Z"
          fill="url(#leafWarmRight)"
          opacity="0.96"
        />

        {/* Left accent outer leaf overlay for depth */}
        <path
          d="M256 70C200 110 160 170 155 240C150 310 190 380 256 442C180 380 130 300 138 220C144 150 190 100 256 70Z"
          fill="url(#leafWarmOuter)"
          opacity="0.45"
        />

        {/* Spanish White accent leaf veins outline */}
        <path
          d="M256 70C270 120 300 170 330 210M256 150C280 200 310 240 337 270M256 250C280 300 300 350 312 390"
          stroke="#E5CFB4"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* Definitions for new brand palette gradients */}
        <defs>
          <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#191009" floodOpacity="0.35" />
          </filter>

          {/* Background: Ebony -> DigiKhata Navy -> Asphalt */}
          <linearGradient id="cocoonBgGradient" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0D1726" />
            <stop offset="55%" stopColor="#111F49" />
            <stop offset="100%" stopColor="#191009" />
          </linearGradient>

          {/* Core: Wisp Pink to Double Spanish White */}
          <linearGradient id="coreWarmGradient" x1="256" y1="110" x2="256" y2="401" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDF2F3" />
            <stop offset="50%" stopColor="#E5CFB4" />
            <stop offset="100%" stopColor="#C67764" />
          </linearGradient>

          {/* Coin: Tangerine to Cinnabar to Contessa */}
          <linearGradient id="coinWarmGradient" x1="224" y1="148" x2="288" y2="212" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF6B4A" />
            <stop offset="50%" stopColor="#E74425" />
            <stop offset="100%" stopColor="#C67764" />
          </linearGradient>

          {/* Left Leaf: Tangerine to Cinnabar */}
          <linearGradient id="leafWarmLeft" x1="145" y1="70" x2="256" y2="442" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF6B4A" />
            <stop offset="45%" stopColor="#E74425" />
            <stop offset="100%" stopColor="#962915" />
          </linearGradient>

          {/* Right Leaf: Double Spanish White to Contessa */}
          <linearGradient id="leafWarmRight" x1="367" y1="70" x2="256" y2="442" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E5CFB4" />
            <stop offset="50%" stopColor="#C67764" />
            <stop offset="100%" stopColor="#803D2E" />
          </linearGradient>

          {/* Outer Leaf Accent */}
          <linearGradient id="leafWarmOuter" x1="138" y1="70" x2="256" y2="442" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E74425" />
            <stop offset="100%" stopColor="#191009" />
          </linearGradient>
        </defs>
      </svg>

      {showText && (
        <div className="flex flex-col items-start leading-none select-none">
          <span className="text-[22px] font-black tracking-tight text-white font-display">
            cocoon
          </span>
          <span className="text-[8px] tracking-[0.25em] font-bold text-[#E74425] font-mono mt-0.5">
            PLAN. TRACK. GROW.
          </span>
        </div>
      )}
    </div>
  );
}
