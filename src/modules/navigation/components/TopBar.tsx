/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bell, Menu, Building2, User, ChevronDown } from 'lucide-react';
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
  onOpenSidebar,
  onOpenWorkspaceSelector
}: TopBarProps) {
  return (
    <div className="pt-6 px-4.5 flex justify-between items-center z-10" style={{ color: theme.textPrimary }}>
      <div className="cursor-pointer" onClick={onHomeClick}>
        <CocoonLogo size={36} showText={true} />
      </div>

      <div className="flex items-center gap-2">
        {/* Visible Active Workspace Label & Quick Switcher */}
        {onOpenWorkspaceSelector && (
          <button
            onClick={() => {
              triggerHapticFeedback();
              onOpenWorkspaceSelector();
            }}
            className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
              isBusinessMode
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25'
                : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
            }`}
            title="Switch Workspace Context"
          >
            {isBusinessMode ? (
              <Building2 size={13} className="text-blue-400 shrink-0" />
            ) : (
              <User size={13} className="text-emerald-400 shrink-0" />
            )}
            <span className="max-w-[100px] truncate text-[11px]">
              {activeWorkspaceName || 'Personal'}
            </span>
            <ChevronDown size={11} className="text-neutral-500 shrink-0" />
          </button>
        )}

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
