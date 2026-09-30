/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { Lock, X } from 'lucide-react';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface BalancePinModalProps {
  isOpen: boolean;
  pinInput: string;
  error: string;
  onClose: () => void;
  onKeyPress: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
}

export default function BalancePinModal({
  isOpen,
  pinInput,
  error,
  onClose,
  onKeyPress,
  onClear,
  onBackspace
}: BalancePinModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99] flex items-center justify-center p-4 select-none">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-[28px] text-center flex flex-col items-center gap-5 text-white"
        >
          <div className="flex justify-between items-center w-full pb-1 border-b border-white/5">
            <span className="text-xs font-black uppercase tracking-widest font-mono text-neutral-400">Balance Unlock</span>
            <button 
              onClick={onClose} 
              className="text-neutral-500 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
            <Lock size={28} />
          </div>

          <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-extrabold tracking-tight">Security Verification</h3>
            <p className="text-[11px] text-neutral-400 max-w-[220px] leading-relaxed mx-auto">
              Please enter your 4-digit App lock PIN to temporarily reveal net balance.
            </p>
          </div>

          {/* PIN dots */}
          <div className="flex gap-4.5 justify-center py-1">
            {[0, 1, 2, 3].map((idx) => (
              <div 
                key={idx} 
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                  idx < pinInput.length 
                    ? 'bg-emerald-500 border-emerald-400 scale-110 shadow-[0_0_8px_rgba(16,185,129,0.6)]' 
                    : 'bg-transparent border-neutral-600'
                }`} 
              />
            ))}
          </div>

          {error && (
            <span className="text-[10px] text-rose-400 font-bold font-mono tracking-wide bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              {error}
            </span>
          )}

          {/* Numeric keypad grid */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[220px] pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <button
                key={k}
                onClick={() => onKeyPress(k)}
                className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-sm font-mono flex items-center justify-center cursor-pointer font-bold select-none text-white border border-white/5 transition-all active:scale-90"
              >
                {k}
              </button>
            ))}
            <button
              onClick={() => {
                triggerHapticFeedback();
                onClear();
              }}
              className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 text-[10px] font-mono flex items-center justify-center cursor-pointer font-bold select-none text-neutral-400 border border-white/5 transition-all"
            >
              Clear
            </button>
            <button
              onClick={() => onKeyPress('0')}
              className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 text-sm font-mono flex items-center justify-center cursor-pointer font-bold select-none text-white border border-white/5 transition-all active:scale-90"
            >
              0
            </button>
            <button
              onClick={() => {
                triggerHapticFeedback();
                onBackspace();
              }}
              className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 text-sm font-mono flex items-center justify-center cursor-pointer font-bold select-none text-neutral-400 border border-white/5 transition-all"
            >
              &larr;
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
