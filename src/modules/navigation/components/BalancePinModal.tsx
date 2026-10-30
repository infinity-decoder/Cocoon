/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { Lock, X } from 'lucide-react';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { useTheme } from '../../../core/theme';

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
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 backdrop-blur-md z-[99] flex items-center justify-center p-4 select-none"
        style={{ backgroundColor: theme.overlay }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-sm p-6 border rounded-[28px] text-center flex flex-col items-center gap-5 shadow-2xl transition-colors"
          style={{
            backgroundColor: theme.surfaceElevated,
            borderColor: theme.borderSubtle,
            color: theme.textPrimary
          }}
        >
          <div className="flex justify-between items-center w-full pb-1 border-b" style={{ borderColor: theme.borderSubtle }}>
            <span className="text-xs font-black uppercase tracking-widest font-mono" style={{ color: theme.textSecondary }}>
              Balance Unlock
            </span>
            <button 
              onClick={onClose} 
              className="p-1 rounded-lg cursor-pointer transition-colors"
              style={{ color: theme.textSecondary }}
            >
              <X size={16} />
            </button>
          </div>

          <div 
            className="p-3 rounded-full border transition-colors"
            style={{
              backgroundColor: `${theme.primary}18`,
              borderColor: `${theme.primary}35`,
              color: theme.primary
            }}
          >
            <Lock size={28} />
          </div>

          <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-extrabold tracking-tight" style={{ color: theme.textPrimary }}>
              Security Verification
            </h3>
            <p className="text-[11px] max-w-[220px] leading-relaxed mx-auto" style={{ color: theme.textSecondary }}>
              Please enter your 4-digit App lock PIN to temporarily reveal net balance.
            </p>
          </div>

          {/* PIN dots */}
          <div className="flex gap-4.5 justify-center py-1">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = idx < pinInput.length;
              return (
                <div 
                  key={idx} 
                  className="w-3.5 h-3.5 rounded-full border transition-all duration-150"
                  style={
                    isFilled
                      ? {
                          backgroundColor: theme.primary,
                          borderColor: theme.primary,
                          boxShadow: `0 0 10px ${theme.primary}80`,
                          transform: 'scale(1.1)'
                        }
                      : {
                          backgroundColor: 'transparent',
                          borderColor: theme.borderSubtle
                        }
                  } 
                />
              );
            })}
          </div>

          {error && (
            <span 
              className="text-[10px] font-bold font-mono tracking-wide px-3 py-1 rounded-full border"
              style={{
                backgroundColor: theme.dangerBg,
                borderColor: `${theme.danger}40`,
                color: theme.danger
              }}
            >
              {error}
            </span>
          )}

          {/* Numeric keypad grid */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[220px] pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <button
                key={k}
                onClick={() => onKeyPress(k)}
                className="w-14 h-14 rounded-full text-sm font-mono flex items-center justify-center cursor-pointer font-bold select-none border transition-all active:scale-90 shadow-sm"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.borderSubtle,
                  color: theme.textPrimary
                }}
              >
                {k}
              </button>
            ))}
            <button
              onClick={() => {
                triggerHapticFeedback();
                onClear();
              }}
              className="w-14 h-14 rounded-full text-[10px] font-mono flex items-center justify-center cursor-pointer font-bold select-none border transition-all active:scale-90"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.textSecondary
              }}
            >
              Clear
            </button>
            <button
              onClick={() => onKeyPress('0')}
              className="w-14 h-14 rounded-full text-sm font-mono flex items-center justify-center cursor-pointer font-bold select-none border transition-all active:scale-90 shadow-sm"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              0
            </button>
            <button
              onClick={() => {
                triggerHapticFeedback();
                onBackspace();
              }}
              className="w-14 h-14 rounded-full text-sm font-mono flex items-center justify-center cursor-pointer font-bold select-none border transition-all active:scale-90"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.textSecondary
              }}
            >
              &larr;
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

