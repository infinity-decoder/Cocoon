/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { Lock, Delete } from 'lucide-react';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

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
  const isLockedOut = lockoutSeconds > 0;

  return (
    <AnimatePresence>
      {isLocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-[#0D1726] z-[99] flex flex-col justify-between p-8 text-white select-none"
        >
          <div className="flex flex-col items-center mt-8 gap-2 text-center">
            <div className={`p-4 rounded-full border transition-all ${
              isLockedOut ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-[#E74425]/15 border-[#E74425]/30 text-[#E74425]'
            }`}>
              <Lock size={32} className={isLockedOut ? 'animate-bounce' : 'animate-pulse'} />
            </div>
            <span className="text-lg font-black mt-2 tracking-tight">Cocoon Secure Lock</span>
            <span className="text-xs text-neutral-400 font-mono">
              {isLockedOut ? 'Rate limit cooldown enforced' : 'PBKDF2 Cryptographic Validation'}
            </span>

            {isLockedOut ? (
              <div className="mt-3 px-4 py-2 bg-rose-500/20 border border-rose-500/40 rounded-2xl flex flex-col items-center">
                <span className="text-xs font-bold text-rose-300">Too many failed attempts</span>
                <span className="text-sm font-black font-mono text-white mt-0.5">
                  Try again in {lockoutSeconds}s
                </span>
              </div>
            ) : errorMessage ? (
              <div className="mt-2 text-xs font-bold text-rose-400 animate-shake">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="flex gap-4">
              {[0, 1, 2, 3].map((idx) => (
                <div 
                  key={idx} 
                  className={`w-4 h-4 rounded-full border transition-all ${
                    isLockedOut
                      ? 'border-neutral-700 bg-neutral-800'
                      : enteredPin.length > idx
                        ? 'bg-[#E74425] border-[#E74425] scale-125 shadow-[0_0_12px_#E74425]'
                        : 'border-white/30 bg-transparent'
                  }`} 
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
                className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-lg font-bold flex items-center justify-center cursor-pointer select-none transition-all"
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
              className="w-16 h-16 rounded-full bg-white/2 hover:bg-white/5 text-xs font-bold flex items-center justify-center cursor-pointer transition-all"
            >
              Clear
            </button>

            <button
              disabled={isLockedOut}
              onClick={() => onKeyPress('0')}
              className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-lg font-bold flex items-center justify-center cursor-pointer select-none transition-all"
            >
              0
            </button>

            <button
              disabled={isLockedOut}
              onClick={onBackspace}
              className="w-16 h-16 rounded-full bg-white/2 hover:bg-white/5 flex items-center justify-center text-rose-400 cursor-pointer transition-all"
            >
              <Delete size={20} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
