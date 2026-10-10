/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface CocoonStatementSealProps {
  size?: number;
  className?: string;
}

export default function CocoonStatementSeal({ size = 110, className = '' }: CocoonStatementSealProps) {
  // Arched text letters rendered using rotated SVG text nodes (100% compatible with html2canvas and Android WebView)
  const topChars = [
    { char: 'E', angle: -48 },
    { char: '-', angle: -38 },
    { char: 'S', angle: -28 },
    { char: 'T', angle: -19 },
    { char: 'A', angle: -10 },
    { char: 'T', angle: 0 },
    { char: 'E', angle: 10 },
    { char: 'M', angle: 21 },
    { char: 'E', angle: 31 },
    { char: 'N', angle: 41 },
    { char: 'T', angle: 50 },
  ];

  const bottomChars = [
    { char: 'C', angle: 26 },
    { char: 'O', angle: 16 },
    { char: 'C', angle: 5 },
    { char: 'O', angle: -5 },
    { char: 'O', angle: -16 },
    { char: 'N', angle: -26 },
  ];

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

        {/* 4. Top Arched Bold Text: E-STATEMENT (standard rotated text, html2canvas safe) */}
        <g fill="#A30006" fontFamily="Impact, 'Arial Black', sans-serif" fontWeight="900" fontSize="42">
          {topChars.map((item, idx) => (
            <text
              key={`top-${idx}`}
              x="250"
              y="68"
              textAnchor="middle"
              transform={`rotate(${item.angle}, 250, 250)`}
            >
              {item.char}
            </text>
          ))}
        </g>

        {/* 5. Bottom Arched Bold Text: COCOON (standard rotated text, html2canvas safe) */}
        <g fill="#A30006" fontFamily="Impact, 'Arial Black', sans-serif" fontWeight="900" fontSize="44">
          {bottomChars.map((item, idx) => (
            <text
              key={`bottom-${idx}`}
              x="250"
              y="456"
              textAnchor="middle"
              transform={`rotate(${item.angle}, 250, 250)`}
            >
              {item.char}
            </text>
          ))}
        </g>

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
