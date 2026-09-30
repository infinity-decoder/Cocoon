/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import { AppTheme } from '../../../core/theme';

interface NetBalanceCardProps {
  netBalance: number;
  balanceRevealed: boolean;
  currencySymbol: string;
  theme: AppTheme;
  onToggleReveal: () => void;
}

export default function NetBalanceCard({
  netBalance,
  balanceRevealed,
  currencySymbol,
  theme,
  onToggleReveal
}: NetBalanceCardProps) {
  return (
    <div 
      className={`p-5 border flex flex-col gap-4 relative overflow-hidden text-left ${theme.radius}`}
      style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
    >
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold">
            Net Liquid Balance
          </span>
          <p className="text-[10px] text-neutral-500 font-mono">
            Auto-computed: Month Income minus Expense
          </p>
        </div>
        {/* Animated privacy eye button */}
        <button
          onClick={onToggleReveal}
          className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition-all text-emerald-400 cursor-pointer flex items-center justify-center"
        >
          {balanceRevealed ? (
            <Eye size={16} className="text-emerald-400 transition-transform" />
          ) : (
            <EyeOff size={16} className="text-neutral-400 animate-pulse transition-transform" />
          )}
        </button>
      </div>

      <div className="relative h-11 flex items-center">
        <AnimatePresence mode="wait">
          {balanceRevealed ? (
            <motion.div
              key="revealed-balance"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="flex items-baseline gap-1.5"
            >
              <span className={`text-3xl font-black font-mono tracking-tight ${netBalance >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                {currencySymbol} {netBalance.toLocaleString()}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="hidden-balance"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-2.5 text-neutral-400"
            >
              {/* Animated Privacy dots pattern */}
              <div className="flex gap-2.5 items-center">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <motion.div 
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-neutral-600/70"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 1, 0.5]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.15
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 font-medium">
                Locked (Tap Eye)
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
