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
}

export default function LockScreen({
  isLocked,
  enteredPin,
  onKeyPress,
  onBackspace,
  onClear
}: LockScreenProps) {
  return (
    <AnimatePresence>
      {isLocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-neutral-950 z-[99] flex flex-col justify-between p-8 text-white select-none"
        >
          <div className="flex flex-col items-center mt-12 gap-2">
            <div className="p-4 bg-white/5 rounded-full border border-white/10 text-emerald-400">
              <Lock size={32} className="animate-pulse" />
            </div>
            <span className="text-lg font-bold mt-2">Cocoon Secure Lock</span>
            <span className="text-xs text-neutral-400 font-mono">Offline cryptographic device validation</span>
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="flex gap-4">
              {[0, 1, 2, 3].map((idx) => (
                <div 
                  key={idx} 
                  className={`w-4 h-4 rounded-full border border-white/30 transition-all ${
                    enteredPin.length > idx ? 'bg-emerald-400 border-emerald-400 scale-125' : 'bg-transparent'
                  }`} 
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-y-4 gap-x-6 max-w-xs mx-auto mb-8 w-full">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
              <button
                key={key}
                onClick={() => onKeyPress(key)}
                className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-lg font-bold flex items-center justify-center cursor-pointer select-none"
              >
                {key}
              </button>
            ))}
            
            <button
              onClick={() => {
                triggerHapticFeedback();
                onClear();
              }}
              className="w-16 h-16 rounded-full bg-white/2 hover:bg-white/5 text-xs font-bold flex items-center justify-center cursor-pointer"
            >
              Clear
            </button>

            <button
              onClick={() => onKeyPress('0')}
              className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-lg font-bold flex items-center justify-center cursor-pointer select-none"
            >
              0
            </button>

            <button
              onClick={onBackspace}
              className="w-16 h-16 rounded-full bg-white/2 hover:bg-white/5 flex items-center justify-center text-rose-400 cursor-pointer"
            >
              <Delete size={20} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
