/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bell, Menu } from 'lucide-react';
import { CocoonLogo } from '../../../shared/components';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface TopBarProps {
  theme: AppTheme;
  hasUnreadNotifications: boolean;
  onHomeClick: () => void;
  onToggleNotifications: () => void;
  onOpenSidebar: () => void;
}

export default function TopBar({
  theme,
  hasUnreadNotifications,
  onHomeClick,
  onToggleNotifications,
  onOpenSidebar
}: TopBarProps) {
  return (
    <div className="pt-6 px-4.5 flex justify-between items-center z-10" style={{ color: theme.textPrimary }}>
      <div className="cursor-pointer" onClick={onHomeClick}>
        <CocoonLogo size={36} showText={true} />
      </div>

      <div className="flex items-center gap-2">
        <button 
          onClick={() => {
            triggerHapticFeedback();
            onToggleNotifications();
          }}
          className="p-2.5 bg-white/5 border rounded-2xl hover:bg-white/10 cursor-pointer relative transition-all"
          style={{ borderColor: theme.border, color: theme.textPrimary }}
          title="In-App Notifications"
        >
          <Bell size={18} />
          {hasUnreadNotifications && (
            <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse border border-neutral-950" />
          )}
        </button>

        {/* Sidebar Trigger ☰ */}
        <button
          onClick={() => {
            triggerHapticFeedback();
            onOpenSidebar();
          }}
          className="p-2.5 bg-white/5 border rounded-2xl hover:bg-white/10 cursor-pointer transition-all"
          style={{ borderColor: theme.border, color: theme.textPrimary }}
        >
          <Menu size={18} />
        </button>
      </div>
    </div>
  );
}
