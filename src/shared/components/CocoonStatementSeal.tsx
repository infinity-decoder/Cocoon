/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface CocoonStatementSealProps {
  size?: number;
  className?: string;
}

export default function CocoonStatementSeal({ size = 110, className = '' }: CocoonStatementSealProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none pointer-events-none transform -rotate-12 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible filter drop-shadow-sm"
      >
        <defs>
          {/* Top curved path for E-STATEMENT */}
          <path
            id="seal-top-curve"
            d="M 68,250 A 182,182 0 0,1 432,250"
            fill="none"
          />
          {/* Bottom curved path for COCOON */}
          <path
            id="seal-bottom-curve"
            d="M 432,250 A 182,182 0 0,1 68,250"
            fill="none"
          />
          {/* 5-pointed Star definition */}
          <g id="seal-white-star">
            <polygon
              points="0,-18 5.5,-5.5 19,-5.5 8,3.5 12,17 0,8.5 -12,17 -8,3.5 -19,-5.5 -5.5,-5.5"
              fill="#FFFFFF"
            />
          </g>
        </defs>

        {/* 1. Outermost thick crimson circular border */}
        <circle cx="250" cy="250" r="236" fill="#FFFFFF" stroke="#A30006" strokeWidth="13" />

        {/* 2. Concentric inner thin circular ring */}
        <circle cx="250" cy="250" r="222" fill="none" stroke="#A30006" strokeWidth="3.5" />

        {/* 3. Central crimson red solid circle disc */}
        <circle cx="250" cy="250" r="145" fill="#A30006" />

        {/* 4. Top Arched Bold Text: E-STATEMENT */}
        <text
          fill="#A30006"
          fontFamily="Impact, 'Arial Black', -apple-system, sans-serif"
          fontWeight="900"
          fontSize="49"
          letterSpacing="4"
        >
          <textPath href="#seal-top-curve" startOffset="50%" textAnchor="middle">
            E-STATEMENT
          </textPath>
        </text>

        {/* 5. Bottom Arched Bold Text: COCOON */}
        <text
          fill="#A30006"
          fontFamily="Impact, 'Arial Black', -apple-system, sans-serif"
          fontWeight="900"
          fontSize="52"
          letterSpacing="6"
        >
          <textPath href="#seal-bottom-curve" startOffset="50%" textAnchor="middle">
            COCOON
          </textPath>
        </text>

        {/* 6. Top 3 white stars on crimson disc */}
        <g transform="translate(192, 142)">
          <use href="#seal-white-star" transform="scale(0.85)" />
        </g>
        <g transform="translate(250, 130)">
          <use href="#seal-white-star" transform="scale(0.95)" />
        </g>
        <g transform="translate(308, 142)">
          <use href="#seal-white-star" transform="scale(0.85)" />
        </g>

        {/* 7. Bottom 3 white stars on crimson disc */}
        <g transform="translate(192, 358)">
          <use href="#seal-white-star" transform="scale(0.85)" />
        </g>
        <g transform="translate(250, 370)">
          <use href="#seal-white-star" transform="scale(0.95)" />
        </g>
        <g transform="translate(308, 358)">
          <use href="#seal-white-star" transform="scale(0.85)" />
        </g>

        {/* 8. Overlapping Tilted White Rectangular Banner with "CONFIDENTIAL" */}
        <g transform="rotate(-11.5, 250, 250)">
          {/* Outer Banner Frame with thick crimson border */}
          <rect
            x="12"
            y="196"
            width="476"
            height="108"
            rx="14"
            fill="#FFFFFF"
            stroke="#A30006"
            strokeWidth="11"
          />
          {/* Inner thin border line */}
          <rect
            x="22"
            y="205"
            width="456"
            height="90"
            rx="9"
            fill="none"
            stroke="#A30006"
            strokeWidth="3.5"
          />
          {/* Heavy bold "CONFIDENTIAL" */}
          <text
            x="250"
            y="273"
            fill="#A30006"
            fontFamily="Impact, 'Arial Black', sans-serif"
            fontWeight="900"
            fontSize="68"
            letterSpacing="2.5"
            textAnchor="middle"
          >
            CONFIDENTIAL
          </text>
        </g>
      </svg>
    </div>
  );
}
