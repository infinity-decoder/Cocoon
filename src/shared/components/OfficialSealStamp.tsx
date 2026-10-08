/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface OfficialSealStampProps {
  size?: number;
  className?: string;
}

export default function OfficialSealStamp({ size = 110, className = '' }: OfficialSealStampProps) {
  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none pointer-events-none transform -rotate-12 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          {/* Circular text path for curved text around the top and bottom of the seal */}
          <path
            id="seal-top-arc"
            d="M 30,100 A 70,70 0 0,1 170,100"
            fill="none"
          />
          <path
            id="seal-bottom-arc"
            d="M 170,100 A 70,70 0 0,1 30,100"
            fill="none"
          />
        </defs>

        {/* Subtle red stamp wash background */}
        <circle cx="100" cy="100" r="94" fill="#DC2626" fillOpacity="0.04" />

        {/* Outer serrated / scalloped stamp ring ring */}
        <circle
          cx="100"
          cy="100"
          r="92"
          stroke="#B91C1C"
          strokeWidth="2.5"
          strokeDasharray="4 2"
          strokeLinecap="round"
        />

        {/* Outer solid concentric ring */}
        <circle
          cx="100"
          cy="100"
          r="84"
          stroke="#B91C1C"
          strokeWidth="3.5"
        />

        {/* Inner thin border ring */}
        <circle
          cx="100"
          cy="100"
          r="66"
          stroke="#DC2626"
          strokeWidth="1.5"
        />

        {/* Top curved text along path */}
        <text
          fill="#B91C1C"
          fontSize="11"
          fontWeight="900"
          letterSpacing="3"
          fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        >
          <textPath href="#seal-top-arc" startOffset="50%" textAnchor="middle">
            ★ COCOON FINANCIAL ★
          </textPath>
        </text>

        {/* Bottom curved text along path */}
        <text
          fill="#B91C1C"
          fontSize="9.5"
          fontWeight="800"
          letterSpacing="2.5"
          fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        >
          <textPath href="#seal-bottom-arc" startOffset="50%" textAnchor="middle">
            • OFFICIAL RECORD •
          </textPath>
        </text>

        {/* Center horizontal banner with double lines */}
        <line x1="36" y1="84" x2="164" y2="84" stroke="#B91C1C" strokeWidth="2" />
        <line x1="42" y1="88" x2="158" y2="88" stroke="#DC2626" strokeWidth="1" />

        {/* Center Box background for CONFIDENTIAL */}
        <rect
          x="34"
          y="90"
          width="132"
          height="23"
          rx="3"
          fill="#DC2626"
          fillOpacity="0.12"
        />

        {/* Main "CONFIDENTIAL" text */}
        <text
          x="100"
          y="106"
          textAnchor="middle"
          fill="#B91C1C"
          fontSize="13.5"
          fontWeight="950"
          letterSpacing="3.5"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        >
          CONFIDENTIAL
        </text>

        {/* Center horizontal lower double lines */}
        <line x1="42" y1="115" x2="158" y2="115" stroke="#DC2626" strokeWidth="1" />
        <line x1="36" y1="119" x2="164" y2="119" stroke="#B91C1C" strokeWidth="2" />

        {/* Five-point star markers at sides */}
        <polygon
          points="26,100 28,104 33,104 29,107 31,112 26,109 21,112 23,107 19,104 24,104"
          fill="#B91C1C"
        />
        <polygon
          points="174,100 176,104 181,104 177,107 179,112 174,109 169,112 171,107 167,104 172,104"
          fill="#B91C1C"
        />

        {/* Inner sub-text: AUTHENTIC / SECURE */}
        <text
          x="100"
          y="76"
          textAnchor="middle"
          fill="#DC2626"
          fontSize="8"
          fontWeight="700"
          letterSpacing="1.5"
          fontFamily="ui-monospace, monospace"
        >
          VERIFIED ARCHIVE
        </text>
        <text
          x="100"
          y="131"
          textAnchor="middle"
          fill="#DC2626"
          fontSize="7.5"
          fontWeight="700"
          letterSpacing="1.5"
          fontFamily="ui-monospace, monospace"
        >
          LOCAL SYSTEM
        </text>
      </svg>
    </div>
  );
}
