/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { Lock, Delete } from 'lucide-react';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { useTheme } from '../../../core/theme';

interface LockScreenProps {
  isLocked: boolean;
  enteredPin: string;
  onKeyPress: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  lockoutSeconds?: number;
  errorMessage?: string;
}

export default function LockScreen({
  isLocked,
  enteredPin,
  onKeyPress,
  onBackspace,
  onClear,
  lockoutSeconds = 0,
  errorMessage
}: LockScreenProps) {
  const { theme } = useTheme();
  const isLockedOut = lockoutSeconds > 0;

  return (
    <AnimatePresence>
      {isLocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[99] flex flex-col justify-between p-8 select-none transition-colors"
          style={{ backgroundColor: theme.background, color: theme.textPrimary }}
        >
          <div className="flex flex-col items-center mt-8 gap-2 text-center">
            <div 
              className="p-4 rounded-full border transition-all"
              style={{
                backgroundColor: isLockedOut ? theme.dangerBg : `${theme.primary}18`,
                borderColor: isLockedOut ? `${theme.danger}40` : `${theme.primary}35`,
                color: isLockedOut ? theme.danger : theme.primary
              }}
            >
              <Lock size={32} className={isLockedOut ? 'animate-bounce' : 'animate-pulse'} />
            </div>
            <span className="text-lg font-black mt-2 tracking-tight" style={{ color: theme.textPrimary }}>
              Cocoon Secure Lock
            </span>
            <span className="text-xs font-mono" style={{ color: theme.textSecondary }}>
              {isLockedOut ? 'Rate limit cooldown enforced' : 'PBKDF2 Cryptographic Validation'}
            </span>

            {isLockedOut ? (
              <div 
                className="mt-3 px-4 py-2 border rounded-2xl flex flex-col items-center"
                style={{
                  backgroundColor: theme.dangerBg,
                  borderColor: `${theme.danger}40`
                }}
              >
                <span className="text-xs font-bold" style={{ color: theme.danger }}>Too many failed attempts</span>
                <span className="text-sm font-black font-mono mt-0.5" style={{ color: theme.textPrimary }}>
                  Try again in {lockoutSeconds}s
                </span>
              </div>
            ) : errorMessage ? (
              <div className="mt-2 text-xs font-bold animate-shake" style={{ color: theme.danger }}>
                {errorMessage}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="flex gap-4">
              {[0, 1, 2, 3].map((idx) => (
                <div 
                  key={idx} 
                  className="w-4 h-4 rounded-full border transition-all"
                  style={
                    isLockedOut
                      ? { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }
                      : enteredPin.length > idx
                        ? {
                            backgroundColor: theme.primary,
                            borderColor: theme.primary,
                            transform: 'scale(1.25)',
                            boxShadow: `0 0 12px ${theme.primary}80`
                          }
                        : {
                            backgroundColor: 'transparent',
                            borderColor: theme.borderSubtle
                          }
                  } 
                />
              ))}
            </div>
          </div>

          <div className={`grid grid-cols-3 gap-y-4 gap-x-6 max-w-xs mx-auto mb-8 w-full transition-opacity ${
            isLockedOut ? 'opacity-30 pointer-events-none' : ''
          }`}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
              <button
                key={key}
                disabled={isLockedOut}
                onClick={() => onKeyPress(key)}
                className="w-16 h-16 rounded-full text-lg font-bold flex items-center justify-center cursor-pointer select-none transition-all border active:scale-90 shadow-sm"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.borderSubtle,
                  color: theme.textPrimary
                }}
              >
                {key}
              </button>
            ))}
            
            <button
              disabled={isLockedOut}
              onClick={() => {
                triggerHapticFeedback();
                onClear();
              }}
              className="w-16 h-16 rounded-full text-xs font-bold flex items-center justify-center cursor-pointer transition-all border active:scale-90"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.textSecondary
              }}
            >
              Clear
            </button>

            <button
              disabled={isLockedOut}
              onClick={() => onKeyPress('0')}
              className="w-16 h-16 rounded-full text-lg font-bold flex items-center justify-center cursor-pointer select-none transition-all border active:scale-90 shadow-sm"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              0
            </button>

            <button
              disabled={isLockedOut}
              onClick={onBackspace}
              className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all border active:scale-90"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.danger
              }}
            >
              <Delete size={20} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
