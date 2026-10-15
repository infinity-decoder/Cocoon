/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Workspace } from '../domain/accounting';

interface WorkspaceContextValue {
  currentWorkspace: Workspace;
  availableWorkspaces: Workspace[];
  isBusinessMode: boolean;
  switchWorkspace: (workspaceId: string) => void;
  registerBusinessWorkspace: (name: string, currencyCode: string, currencySymbol: string) => Workspace;
}

const DEFAULT_PERSONAL_WORKSPACE: Workspace = {
  id: 'personal',
  name: 'Personal Finances',
  type: 'personal',
  currencyCode: 'PKR',
  currencySymbol: '₨',
  createdAt: '2026-01-01T00:00:00.000Z',
  isActive: true
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>(() => {
    try {
      const stored = localStorage.getItem('cocoon_workspaces');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return [DEFAULT_PERSONAL_WORKSPACE];
  });

  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>(() => {
    return localStorage.getItem('cocoon_active_workspace_id') || 'personal';
  });

  const currentWorkspace =
    availableWorkspaces.find(w => w.id === currentWorkspaceId) || availableWorkspaces[0] || DEFAULT_PERSONAL_WORKSPACE;

  const isBusinessMode = currentWorkspace.type === 'business';

  const switchWorkspace = useCallback((workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId);
    localStorage.setItem('cocoon_active_workspace_id', workspaceId);
  }, []);

  const registerBusinessWorkspace = useCallback(
    (name: string, currencyCode = 'PKR', currencySymbol = '₨'): Workspace => {
      const newWs: Workspace = {
        id: `biz-${Date.now()}`,
        name: name.trim(),
        type: 'business',
        currencyCode,
        currencySymbol,
        createdAt: new Date().toISOString(),
        isActive: true
      };

      setAvailableWorkspaces(prev => {
        const updated = [...prev, newWs];
        try {
          localStorage.setItem('cocoon_workspaces', JSON.stringify(updated));
        } catch {
          // LocalStorage save
        }
        return updated;
      });

      return newWs;
    },
    []
  );

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        availableWorkspaces,
        isBusinessMode,
        switchWorkspace,
        registerBusinessWorkspace
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
