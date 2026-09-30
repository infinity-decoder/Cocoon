/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { Home as HomeIcon, Landmark, BarChart2, Plus, Minus } from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface BottomNavProps {
  activeTab: number;
  theme: AppTheme;
  avatar: string;
  isRadialOpen: boolean;
  onSelectTab: (tabIndex: number) => void;
  onToggleRadial: () => void;
  onSelectRadialAction: (tabIndex: number) => void;
}

const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2310B981"/><stop offset="100%" stop-color="%233B82F6"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g)"/><circle cx="50" cy="37" r="18" fill="%23ffffff"/><path d="M20,80 C20,60 30,55 50,55 C70,55 80,60 80,80 Z" fill="%23ffffff"/></svg>`;

export default function BottomNav({
  activeTab,
  theme,
  avatar,
  isRadialOpen,
  onSelectTab,
  onToggleRadial,
  onSelectRadialAction
}: BottomNavProps) {
  return (
    <div 
      className="absolute bottom-4 inset-x-4 max-w-sm sm:max-w-md mx-auto h-[60px] rounded-[24px] border flex items-center justify-between px-6 z-[45] select-none shadow-2xl backdrop-blur-xl transition-all"
      style={{ backgroundColor: `${theme.cardBg}CC`, borderColor: `${theme.border}40` }}
    >
      {/* Button 1: Home */}
      <button 
        onClick={() => {
          triggerHapticFeedback();
          onSelectTab(0);
        }}
        className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
          activeTab === 0 ? 'text-emerald-400 scale-110 font-black' : 'text-neutral-400 hover:text-white'
        }`}
      >
        <HomeIcon size={18} strokeWidth={theme.iconStrokeWidth} />
        <span className="text-[8px] uppercase font-mono tracking-widest font-black">Home</span>
      </button>

      {/* Button 2: Budget */}
      <button 
        onClick={() => {
          triggerHapticFeedback();
          onSelectTab(5);
        }}
        className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
          activeTab === 5 ? 'text-amber-400 scale-110 font-black' : 'text-neutral-400 hover:text-white'
        }`}
      >
        <Landmark size={18} strokeWidth={theme.iconStrokeWidth} className={activeTab === 5 ? 'text-amber-400' : ''} />
        <span className="text-[8px] uppercase font-mono tracking-widest font-black">Budget</span>
      </button>

      {/* Button 3: Rotating Big Plus Radial Trigger */}
      <div className="relative w-11 h-11 flex items-center justify-center z-[46]">
        <AnimatePresence>
          {isRadialOpen && (
            <>
              {/* Backdrop mask */}
              <div 
                onClick={onToggleRadial}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 cursor-pointer"
              />
              
              {/* EXPENSE Radial option */}
              <motion.div
                initial={{ y: 0, opacity: 0, scale: 0.5 }}
                animate={{ y: -68, opacity: 1, scale: 1 }}
                exit={{ y: 0, opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', damping: 15 }}
                className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-50 pointer-events-auto"
              >
                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onSelectRadialAction(6);
                  }}
                  className="w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white shadow-lg border border-white/10 cursor-pointer transform active:scale-90 transition-transform"
                >
                  <Minus size={18} strokeWidth={3} />
                </button>
                <span className="text-[8px] font-black text-white bg-neutral-900/95 px-2 py-0.5 rounded-full border border-white/10 tracking-widest font-mono shadow-md">
                  EXPENSE
                </span>
              </motion.div>
              
              {/* INCOME Radial option */}
              <motion.div
                initial={{ y: 0, opacity: 0, scale: 0.5 }}
                animate={{ y: -130, opacity: 1, scale: 1 }}
                exit={{ y: 0, opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', damping: 15 }}
                className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-50 pointer-events-auto"
              >
                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    onSelectRadialAction(7);
                  }}
                  className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-lg border border-white/10 cursor-pointer transform active:scale-90 transition-transform"
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
                <span className="text-[8px] font-black text-white bg-neutral-900/95 px-2 py-0.5 rounded-full border border-white/10 tracking-widest font-mono shadow-md">
                  INCOME
                </span>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <button
          onClick={() => {
            triggerHapticFeedback();
            onToggleRadial();
          }}
          className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg cursor-pointer relative z-50 border border-white/10 transform transition-all active:scale-95 duration-200 ${
            isRadialOpen 
              ? 'bg-rose-500 text-white shadow-[0_4px_16px_rgba(244,63,94,0.4)] animate-[pulse_2s_infinite]' 
              : 'bg-emerald-500 text-white shadow-[0_4px_16px_rgba(16,185,129,0.4)]'
          }`}
          style={{ transform: isRadialOpen ? 'rotate(135deg)' : 'none' }}
        >
          <Plus size={22} strokeWidth={3} />
        </button>
      </div>

      {/* Button 4: Analysis */}
      <button 
        onClick={() => {
          triggerHapticFeedback();
          onSelectTab(4);
        }}
        className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
          activeTab === 4 ? 'text-cyan-400 scale-110 font-black' : 'text-neutral-400 hover:text-white'
        }`}
      >
        <BarChart2 size={18} strokeWidth={theme.iconStrokeWidth} className={activeTab === 4 ? 'text-cyan-400' : ''} />
        <span className="text-[8px] uppercase font-mono tracking-widest font-black">Analysis</span>
      </button>

      {/* Button 5: Profile */}
      <button 
        onClick={() => {
          triggerHapticFeedback();
          onSelectTab(3);
        }}
        className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
          activeTab === 3 ? 'text-emerald-400 scale-110 font-black' : 'text-neutral-400 hover:text-white'
        }`}
      >
        <div className={`w-5 h-5 rounded-full overflow-hidden border transition-all shrink-0 ${
          activeTab === 3 ? 'border-emerald-400 ring-2 ring-emerald-500/20' : 'border-neutral-500'
        }`}>
          <img 
            src={avatar || DEFAULT_AVATAR} 
            alt="Profile Avatar" 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer"
          />
        </div>
        <span className="text-[8px] uppercase font-mono tracking-widest font-black">Profile</span>
      </button>
    </div>
  );
}
