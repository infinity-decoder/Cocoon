/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import AnimatedTicker from './AnimatedTicker';

interface AnimatedGaugeProps {
  income: number;
  expenses: number;
  currencySymbol?: string;
}

export default function AnimatedGauge({
  income,
  expenses,
  currencySymbol = '$'
}: AnimatedGaugeProps) {
  // Safe math
  const totalIncome = Math.max(0, income);
  const totalExpenses = Math.max(0, expenses);
  const netValue = totalIncome - totalExpenses;
  
  // Color Logic & Percentage
  let percentage = 0;
  if (totalIncome > 0) {
    percentage = (totalExpenses / totalIncome) * 100;
  } else if (totalExpenses > 0) {
    percentage = 100; // negative or no income but has expenses
  }

  // Cap ratio for visual fill
  const visualRatio = Math.min(Math.max(percentage / 100, 0), 1);
  const totalLength = 235.61; // Exact length of SVG path "M 25,100 A 75,75 0 0,1 175,100"
  const strokeDashoffset = totalLength - (visualRatio * totalLength);

  let colorClass = '';
  let gradientId = 'gauge-teal';
  let isDanger = false;

  if (percentage < 70) {
    // Green/Teal Glowing
    colorClass = 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    gradientId = 'gauge-emerald';
  } else if (percentage >= 70 && percentage <= 90) {
    // Amber/Yellow
    colorClass = 'text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    gradientId = 'gauge-amber';
  } else {
    // Coral Red with breathing pulse animation requested
    colorClass = 'text-rose-500 drop-shadow-[0_0_12px_rgba(244,63,94,0.6)] breathing-red-glow rounded-full';
    gradientId = 'gauge-rose';
    isDanger = true;
  }

  return (
    <div className="flex flex-col items-center justify-center relative select-none p-2">
      {/* Semi-circular SVG Container */}
      <div className={`relative w-72 h-44 flex items-center justify-center transition-transform ${isDanger ? 'breathing-red-glow' : ''}`}>
        <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
          <defs>
            {/* Emerald/Teal Gradient */}
            <linearGradient id="gauge-emerald" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            
            {/* Amber Gradient */}
            <linearGradient id="gauge-amber" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>

            {/* Coral/Rose Red Gradient */}
            <linearGradient id="gauge-rose" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F43F5E" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>

            {/* Background Arc Shadow */}
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Background Track */}
          <path
            d="M 25,100 A 75,75 0 0,1 175,100"
            fill="none"
            stroke="rgba(120, 120, 120, 0.12)"
            strokeWidth="11"
            strokeLinecap="round"
          />

          {/* Foreground Active Track */}
          <motion.path
            d="M 25,100 A 75,75 0 0,1 175,100"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={totalLength}
            initial={{ strokeDashoffset: totalLength }}
            animate={{ strokeDashoffset: strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />

          {/* Sparkle Glow Nodes at endpoints */}
          <circle cx="25" cy="100" r="3.5" className="fill-white/80" />
          <circle cx="175" cy="100" r="3.5" className="fill-white/80" />
        </svg>

        {/* Center overlay labels */}
        <div className="absolute top-[35%] flex flex-col items-center justify-center text-center">
          <span className="text-xs font-light tracking-widest text-inherit opacity-60 uppercase">
            Net Situation
          </span>
          <div className="text-2xl font-bold tracking-tight mt-1">
            <span className={netValue >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
              {netValue >= 0 ? '+' : ''}
            </span>
            <AnimatedTicker
              value={netValue}
              currencySymbol={currencySymbol}
              className={`text-3xl font-bold tracking-tight ${netValue >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}
            />
          </div>
          <span className="text-[10px] font-mono opacity-50 mt-1">
            {percentage.toFixed(0)}% Spent
          </span>
        </div>
      </div>
      
      {/* Safety Alert Warning Notification */}
      {percentage > 80 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-[-16px] px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-full text-[10px] tracking-wider font-semibold uppercase flex items-center gap-1 shadow-lg backdrop-blur"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          Budget Danger Threshold Exceeded!
        </motion.div>
      )}
    </div>
  );
}
