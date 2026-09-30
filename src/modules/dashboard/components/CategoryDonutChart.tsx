/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { BarChart2 } from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { DoughnutSegmentItem } from '../calculations';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface CategoryDonutChartProps {
  segments: DoughnutSegmentItem[];
  totalAmount: number;
  monthIncome: number;
  dashboardToggle: 'expense' | 'income';
  activeSegmentIndex: number | null;
  onSegmentChange: (index: number | null) => void;
  theme: AppTheme;
}

export default function CategoryDonutChart({
  segments,
  totalAmount,
  monthIncome,
  dashboardToggle,
  activeSegmentIndex,
  onSegmentChange,
  theme
}: CategoryDonutChartProps) {
  if (totalAmount <= 0) {
    return (
      <div 
        className={`p-10 border border-dashed flex flex-col items-center justify-center text-center ${theme.radius}`}
        style={{ backgroundColor: `${theme.cardBg}22`, borderColor: theme.border }}
      >
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 mb-3">
          <BarChart2 size={20} />
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest font-mono text-neutral-400">Empty Ledger</span>
        <span className="text-[9px] text-neutral-500 font-mono leading-relaxed mt-1 px-4">
          No transactions recorded for this period. Tap the central (+) button below to add custom items.
        </span>
      </div>
    );
  }

  return (
    <div 
      className={`p-4 border flex flex-col items-center justify-center relative select-none cursor-default ${theme.radius}`}
      style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
      onClick={() => onSegmentChange(null)}
    >
      <div className="relative w-full max-w-[220px] aspect-square flex items-center justify-center">
        <svg viewBox="0 0 240 240" className="w-full h-full overflow-hidden">
          {/* Background track */}
          <circle 
            cx="120" 
            cy="120" 
            r="80" 
            fill="transparent" 
            stroke="rgba(255,255,255,0.03)" 
            strokeWidth="12" 
          />
          {/* Colored donut segments */}
          {(() => {
            let accumulatedPercent = 0;
            return segments.map((item, index) => {
              const isActive = activeSegmentIndex === index;
              const isAnyActive = activeSegmentIndex !== null;
              
              const r = isActive ? 85 : 80;
              const strokeWidth = isActive ? 16 : 12;
              const opacity = isActive ? 1.0 : (isAnyActive ? 0.3 : 0.95);
              
              const circumference = 2 * Math.PI * r;
              const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
              
              const strokeDashoffset = (0.25 - accumulatedPercent / 100) * circumference;
              accumulatedPercent += item.percentage;
              
              return (
                <circle
                  key={index}
                  cx="120"
                  cy="120"
                  r={r}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  opacity={opacity}
                  className="transition-all duration-200 ease-out cursor-pointer"
                  style={{ transformOrigin: '120px 120px' }}
                  onMouseEnter={() => {
                    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
                      triggerHapticFeedback();
                      onSegmentChange(index);
                    }
                  }}
                  onMouseLeave={() => {
                    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
                      onSegmentChange(null);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHapticFeedback();
                    onSegmentChange(activeSegmentIndex === index ? null : index);
                  }}
                />
              );
            });
          })()}
        </svg>

        {/* Center details mask inside the donut hole */}
        <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none select-none max-w-[130px] w-[130px] h-[130px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSegmentIndex === null ? 'default' : `segment-${activeSegmentIndex}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex flex-col items-center justify-center text-center w-full px-1"
            >
              {activeSegmentIndex === null ? (
                <>
                  <span className="text-[9px] font-mono tracking-widest text-neutral-400 uppercase font-black leading-tight">
                    {dashboardToggle === 'expense' ? 'Spent Ratio' : 'Earned'}
                  </span>
                  <span className="text-lg font-black font-mono mt-1 text-white leading-tight">
                    {dashboardToggle === 'expense' 
                      ? (monthIncome > 0 
                          ? `${((totalAmount / monthIncome) * 100).toFixed(1)}%` 
                          : (totalAmount > 0 ? 'N/A' : '0%'))
                      : `₨ ${totalAmount.toLocaleString()}`}
                  </span>
                  <span className="text-[7px] font-mono text-neutral-500 mt-1 whitespace-nowrap">
                    Hover / Tap segment
                  </span>
                </>
              ) : (
                (() => {
                  const activeItem = segments[activeSegmentIndex];
                  if (!activeItem) return null;
                  return (
                    <>
                      <span 
                        className="text-[10px] font-sans tracking-wide uppercase font-extrabold truncate max-w-[120px] leading-tight transition-colors duration-150" 
                        style={{ color: activeItem.color }}
                      >
                        {activeItem.name}
                      </span>
                      <span 
                        className="text-xl font-black font-mono mt-1 leading-tight transition-colors duration-150"
                        style={{ color: activeItem.color }}
                      >
                        {activeItem.percentage.toFixed(1)}%
                      </span>
                      <span className="text-[8px] font-mono text-neutral-400 mt-0.5 whitespace-nowrap">
                        ₨ {activeItem.amount.toLocaleString()}
                      </span>
                    </>
                  );
                })()
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
