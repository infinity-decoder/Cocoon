/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { Transaction } from '../types';
import { motion } from 'motion/react';

interface TrendSparklineProps {
  transactions: Transaction[];
  themePrimaryColor: string;
  currencySymbol?: string;
}

export default function TrendSparkline({
  transactions,
  themePrimaryColor,
  currencySymbol = '$'
}: TrendSparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Generate last 30 days
  const dailyData = Array.from({ length: 30 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - idx));
    const dateStr = d.toISOString().split('T')[0];
    
    // Sum expenses for this specific day
    const dayExpenses = transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(dateStr))
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      date: d,
      displayDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      amount: dayExpenses
    };
  });

  const maxExpense = Math.max(...dailyData.map(d => d.amount), 50); // floor of 50 for layout scale

  // Auto-scroll to the end (most recent day) on load
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, []);

  // Compute SVG Points
  // Each point will be spaced by 50px horizontally
  const pointWidth = 52;
  const paddingY = 15;
  const chartHeight = 80;
  
  const points = dailyData.map((d, index) => {
    const x = index * pointWidth + 20;
    // invert Y since SVG 0 is top
    const y = chartHeight - paddingY - (d.amount / maxExpense) * (chartHeight - paddingY * 2);
    return { x, y, ...d };
  });

  // Generate cubic bezier path for smooth line
  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      // Control points
      const cpX1 = p0.x + pointWidth / 2;
      const cpY1 = p0.y;
      const cpX2 = p1.x - pointWidth / 2;
      const cpY2 = p1.y;
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
  }

  // Generate closed path for gradient fill underneath
  let areaD = '';
  if (points.length > 0) {
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    areaD = `${pathD} L ${endX} ${chartHeight} L ${startX} ${chartHeight} Z`;
  }

  return (
    <div className="w-full flex flex-col gap-1 select-none">
      <div className="flex justify-between items-center px-1">
        <span className="text-xs font-semibold tracking-wider opacity-60 uppercase">
          Spending Trend
        </span>
        <span className="text-[10px] opacity-40 italic">
          Swipe left to see 30-day logs
        </span>
      </div>

      {/* Horizontally scrollable viewport */}
      <div 
        ref={containerRef}
        className="w-full overflow-x-auto scrollbar-none relative py-2 pr-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div 
          className="relative"
          style={{ width: `${points.length * pointWidth + 40}px`, height: `${chartHeight + 15}px` }}
        >
          <svg className="absolute inset-0 w-full h-full overflow-visible">
            <defs>
              <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={themePrimaryColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={themePrimaryColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal helper grid lines */}
            <line x1="0" y1={paddingY} x2={points.length * pointWidth + 40} y2={paddingY} stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
            <line x1="0" y1={chartHeight / 2} x2={points.length * pointWidth + 40} y2={chartHeight / 2} stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
            <line x1="0" y1={chartHeight - paddingY} x2={points.length * pointWidth + 40} y2={chartHeight - paddingY} stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />

            {/* Filled Area */}
            {areaD && (
              <path 
                d={areaD} 
                fill="url(#chart-area-grad)" 
              />
            )}

            {/* Stroke line */}
            {pathD && (
              <path 
                d={pathD} 
                fill="none" 
                stroke={themePrimaryColor} 
                strokeWidth="2.5" 
                strokeLinecap="round"
              />
            )}

            {/* Interactive Nodes and vertical hover guide */}
            {points.map((p, idx) => {
              const isHovered = hoverIndex === idx;
              return (
                <g key={idx}>
                  {/* Invisible capture area for wider pointer inputs */}
                  <rect
                    x={p.x - pointWidth / 2}
                    y="0"
                    width={pointWidth}
                    height={chartHeight + 15}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoverIndex(idx)}
                    onMouseLeave={() => setHoverIndex(null)}
                    onClick={() => setHoverIndex(idx)}
                  />

                  {/* Vertical indicator line */}
                  {isHovered && (
                    <line
                      x1={p.x}
                      y1="0"
                      x2={p.x}
                      y2={chartHeight}
                      stroke={themePrimaryColor}
                      strokeOpacity="0.3"
                      strokeWidth="1"
                    />
                  )}

                  {/* Glowing anchor node */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 5 : 2.5}
                    fill={themePrimaryColor}
                    stroke="#FFF"
                    strokeWidth={isHovered ? 1.5 : 0}
                    className="transition-all duration-150"
                  />
                </g>
              );
            })}
          </svg>

          {/* Render horizontal dates */}
          <div className="absolute bottom-0 left-0 w-full flex text-[9px] opacity-40 font-mono">
            {points.map((p, idx) => (
              <div 
                key={idx} 
                className="absolute text-center transform -translate-x-1/2"
                style={{ left: `${p.x}px`, width: `${pointWidth}px` }}
              >
                {idx % 3 === 0 ? p.displayDate : ''}
              </div>
            ))}
          </div>

          {/* Hover tooltips */}
          {hoverIndex !== null && (
            <div 
              className="absolute bg-neutral-900 border border-neutral-700/50 text-white rounded-lg px-2 py-1 shadow-2xl pointer-events-none text-[10px] font-mono flex flex-col items-center z-10 transition-all duration-100"
              style={{ 
                left: `${Math.min(Math.max(points[hoverIndex].x - 45, 10), points.length * pointWidth - 60)}px`, 
                top: `${Math.max(points[hoverIndex].y - 38, 5)}px` 
              }}
            >
              <div className="font-semibold">{points[hoverIndex].displayDate}</div>
              <div className="text-rose-400 font-bold">{currencySymbol}{points[hoverIndex].amount.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
