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
  activeWorkspaceName?: string;
  isBusinessMode?: boolean;
  onHomeClick: () => void;
  onToggleNotifications: () => void;
  onOpenSidebar: () => void;
  onOpenWorkspaceSelector?: () => void;
}

export default function TopBar({
  theme,
  hasUnreadNotifications,
  activeWorkspaceName,
  isBusinessMode,
  onHomeClick,
  onToggleNotifications,
  onOpenSidebar
}: TopBarProps) {
  return (
    <div className="pt-6 px-4.5 flex justify-between items-center z-10" style={{ color: theme.textPrimary }}>
      <div className="cursor-pointer" onClick={onHomeClick}>
        <CocoonLogo size={36} showText={true} />
      </div>

      <div className="flex items-center gap-2.5">
        <button 
          onClick={() => {
            triggerHapticFeedback();
            onToggleNotifications();
          }}
          className="p-2.5 min-w-[44px] min-h-[44px] bg-white/5 border rounded-2xl hover:bg-white/10 active:bg-white/15 cursor-pointer relative transition-all flex items-center justify-center shadow-sm"
          style={{ borderColor: theme.border, color: theme.textPrimary }}
          title="In-App Notifications"
        >
          <Bell size={18} />
          {hasUnreadNotifications && (
            <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#A9E547] animate-pulse border border-[#101E37]" />
          )}
        </button>

        {/* Sidebar Trigger ☰ */}
        <button
          onClick={() => {
            triggerHapticFeedback();
            onOpenSidebar();
          }}
          className="p-2.5 min-w-[44px] min-h-[44px] bg-white/5 border rounded-2xl hover:bg-white/10 active:bg-white/15 cursor-pointer transition-all flex items-center justify-center shadow-sm"
          style={{ borderColor: theme.border, color: theme.textPrimary }}
          title="Navigation Menu"
        >
          <Menu size={18} />
        </button>
      </div>
    </div>
  );
}
