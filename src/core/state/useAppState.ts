/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  AppState, 
  Transaction, 
  Category, 
  Budget, 
  SavingsGoal, 
  AppSettings, 
  InAppNotification, 
  NotificationType 
} from '../types';
import { loadAppState, saveAppState, getInitialState } from '../storage/storageAdapter';
import { exportBackupAsJson, importBackupFromJson } from '../storage/backupService';
import { PREBUILT_THEMES, AppTheme } from '../theme';
import { triggerHapticFeedback } from '../utils/haptics';
import { 
  computeFinancialTotals, 
  computeCategoryBreakdown, 
  computeDoughnutSegments, 
  checkBudgetThreshold 
} from '../../modules/dashboard/calculations';

export function useAppState() {
  // 1. Core local-first App State
  const [state, setState] = useState<AppState>(() => loadAppState());

  // 2. Active Theme
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    return localStorage.getItem('cocoon_theme_id') || localStorage.getItem('finflow_theme_id') || 'emerald';
  });

  const activeTheme: AppTheme = useMemo(() => {
    return PREBUILT_THEMES.find(t => t.id === activeThemeId) || PREBUILT_THEMES[0];
  }, [activeThemeId]);

  const selectTheme = useCallback((id: string) => {
    setActiveThemeId(id);
    localStorage.setItem('cocoon_theme_id', id);
    localStorage.setItem('finflow_theme_id', id);
  }, []);

  // Auto-save state to local storage on changes
  useEffect(() => {
    saveAppState(state);
  }, [state]);

  // 3. Passcode security lock barrier
  const [isLocked, setIsLocked] = useState<boolean>(() => !!loadAppState().settings.pinCode);
  const [enteredPin, setEnteredPin] = useState<string>('');

  const handlePinKeyPress = useCallback((digit: string) => {
    triggerHapticFeedback();
    setEnteredPin(prev => {
      if (prev.length >= 4) return prev;
      const nextPin = prev + digit;
      if (nextPin.length === 4) {
        if (nextPin === state.settings.pinCode) {
          setTimeout(() => {
            setIsLocked(false);
            setEnteredPin('');
          }, 200);
        } else {
          setTimeout(() => {
            setEnteredPin('');
            alert('Incorrect PIN Code. Please try again.');
          }, 300);
        }
      }
      return nextPin;
    });
  }, [state.settings.pinCode]);

  const handlePinBackspace = useCallback(() => {
    triggerHapticFeedback();
    setEnteredPin(prev => prev.slice(0, -1));
  }, []);

  const handlePinClear = useCallback(() => {
    triggerHapticFeedback();
    setEnteredPin('');
  }, []);

  // 4. Navigation tabs
  // 0: Home/Dashboard, 1: History/Ledger, 2: Savings Vault, 3: Profile/Settings, 4: Analysis, 5: Budget, 6: Add Expense, 7: Add Income
  const [activeTab, setActiveTab] = useState<number>(0);

  // 5. Dynamic month filter
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  });

  const handlePrevMonth = useCallback(() => {
    triggerHapticFeedback();
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    setCurrentMonth(date.toISOString().slice(0, 7));
  }, [currentMonth]);

  const handleNextMonth = useCallback(() => {
    triggerHapticFeedback();
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month, 1);
    setCurrentMonth(date.toISOString().slice(0, 7));
  }, [currentMonth]);

  // 6. Dashboard toggle and doughnut segment selection
  const [dashboardToggle, setDashboardToggle] = useState<'expense' | 'income'>('expense');
  const [activeDoughnutIndex, setActiveDoughnutIndex] = useState<number | null>(null);

  const toggleDashboardView = useCallback(() => {
    setDashboardToggle(prev => (prev === 'expense' ? 'income' : 'expense'));
  }, []);

  // Reset active segment when toggle or month changes
  useEffect(() => {
    setActiveDoughnutIndex(null);
  }, [dashboardToggle, currentMonth]);

  // 7. Profile avatar
  const [avatar, setAvatar] = useState<string>(() => {
    return localStorage.getItem('cocoon_avatar') || localStorage.getItem('finflow_avatar') || '';
  });

  const updateAvatar = useCallback((base64: string) => {
    setAvatar(base64);
    localStorage.setItem('cocoon_avatar', base64);
    localStorage.setItem('finflow_avatar', base64);
  }, []);

  // 8. Modals and Overlays
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [categoryTypeToManage, setCategoryTypeToManage] = useState<'expense' | 'income'>('expense');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isRadialOpen, setIsRadialOpen] = useState(false);

  // 9. In-app alerts & toast banner
  const [activeAlert, setActiveAlert] = useState<{ title: string; desc: string } | null>(null);
  const [toastBanner, setToastBanner] = useState<{ title: string; message: string; type: string } | null>(null);

  useEffect(() => {
    if (toastBanner) {
      const timer = setTimeout(() => {
        setToastBanner(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [toastBanner]);

  // 10. Balance privacy state & PIN unlock prompt
  const [balanceRevealed, setBalanceRevealed] = useState(false);
  const [showBalancePinPrompt, setShowBalancePinPrompt] = useState(false);
  const [balancePinInput, setBalancePinInput] = useState('');
  const [balancePinError, setBalancePinError] = useState('');

  const handleToggleBalanceReveal = useCallback(() => {
    triggerHapticFeedback();
    if (balanceRevealed) {
      setBalanceRevealed(false);
    } else {
      if (state.settings.pinCode) {
        setShowBalancePinPrompt(true);
        setBalancePinInput('');
        setBalancePinError('');
      } else {
        setBalanceRevealed(true);
      }
    }
  }, [balanceRevealed, state.settings.pinCode]);

  const handleBalancePinKeyPress = useCallback((digit: string) => {
    triggerHapticFeedback();
    setBalancePinError('');
    if (balancePinInput.length < 4) {
      const next = balancePinInput + digit;
      setBalancePinInput(next);
      if (next.length === 4) {
        if (next === state.settings.pinCode) {
          setBalanceRevealed(true);
          setShowBalancePinPrompt(false);
          setBalancePinInput('');
        } else {
          setBalancePinError('Incorrect PIN code.');
          setBalancePinInput('');
        }
      }
    }
  }, [balancePinInput, state.settings.pinCode]);

  const handleBalancePinBackspace = useCallback(() => {
    triggerHapticFeedback();
    setBalancePinInput(prev => prev.slice(0, -1));
  }, []);

  const handleBalancePinClear = useCallback(() => {
    triggerHapticFeedback();
    setBalancePinInput('');
    setBalancePinError('');
  }, []);

  // 11. In-app notifications
  const [notifications, setNotifications] = useState<InAppNotification[]>(() => {
    try {
      const raw = localStorage.getItem('cocoon_notifications') || localStorage.getItem('finflow_notifications');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('cocoon_notifications', JSON.stringify(notifications));
    localStorage.setItem('finflow_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = useCallback((
    title: string,
    message: string,
    type: NotificationType
  ) => {
    const allowedTypes: NotificationType[] = ['backup_export', 'backup_import', 'pdf_export', 'excel_export'];
    if (!allowedTypes.includes(type)) {
      return;
    }

    const newNotif: InAppNotification = {
      id: `notif-${Date.now()}`,
      title,
      message,
      timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      type,
      unread: true
    };
    setNotifications(prev => [newNotif, ...prev]);
    setToastBanner({ title, message, type });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    triggerHapticFeedback();
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  }, []);

  const clearAllNotifications = useCallback(() => {
    triggerHapticFeedback();
    setNotifications([]);
  }, []);

  // 12. Financial calculations engine
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const financialTotals = useMemo(() => {
    return computeFinancialTotals(state.transactions, currentMonth, todayStr);
  }, [state.transactions, currentMonth, todayStr]);

  const categoryBreakdown = useMemo(() => {
    return computeCategoryBreakdown(state.transactions, state.categories, currentMonth, dashboardToggle);
  }, [state.transactions, state.categories, currentMonth, dashboardToggle]);

  const doughnutSegments = useMemo(() => {
    return computeDoughnutSegments(
      categoryBreakdown.list,
      financialTotals.monthIncome,
      financialTotals.monthExpense,
      dashboardToggle
    );
  }, [categoryBreakdown.list, financialTotals.monthIncome, financialTotals.monthExpense, dashboardToggle]);

  // Budget cap threshold checker
  const checkCategoryBudgets = useCallback((catName: string, addedAmount: number, updatedTxList: Transaction[]) => {
    const result = checkBudgetThreshold(catName, currentMonth, updatedTxList, state.categories, state.budgets);
    if (!result) return;

    if (result.exceeded) {
      setActiveAlert({
        title: 'Strict Cap Exceeded!',
        desc: `Warning: You have fully exceeded your monthly budget cap of ${state.settings.currencySymbol} ${result.budgetAmount.toLocaleString()} for "${catName}"!`
      });
    } else if (result.ratio >= 0.8) {
      setActiveAlert({
        title: 'Cap Alert threshold',
        desc: `Alert: You spent ${Math.round(result.ratio * 100)}% of your monthly budget of ${state.settings.currencySymbol} ${result.budgetAmount.toLocaleString()} for "${catName}"!`
      });
    }
  }, [currentMonth, state.categories, state.budgets, state.settings.currencySymbol]);

  // 13. Financial mutator actions
  const handleAddTransaction = useCallback((newTxData: Partial<Transaction>) => {
    triggerHapticFeedback();

    const finalAmount = newTxData.amount || 0;
    const isIncome = newTxData.type === 'income' || newTxData.type === 'savings_withdraw';

    const transactionId = `tx-${Date.now()}`;
    const newTx: Transaction = {
      id: transactionId,
      type: (newTxData.type || 'expense') as Transaction['type'],
      amount: finalAmount,
      currency: state.settings.currencySymbol,
      date: newTxData.date || new Date().toISOString(),
      note: newTxData.note || '',
      category: newTxData.category || 'Uncategorized',
      subCategory: newTxData.subCategory,
      walletId: newTxData.walletId || (state.wallets[0]?.id || 'w-cash'),
      toWalletId: newTxData.toWalletId,
      paymentMethod: newTxData.paymentMethod || 'Cash',
      attachment: newTxData.attachment,
      isRecurring: newTxData.isRecurring || false,
      recurrence: newTxData.recurrence
    };

    const updatedWallets = state.wallets.map(w => {
      if (newTx.type === 'transfer') {
        if (w.id === newTx.walletId) {
          return { ...w, balance: w.balance - finalAmount };
        }
        if (w.id === newTx.toWalletId) {
          return { ...w, balance: w.balance + finalAmount };
        }
      } else {
        if (w.id === newTx.walletId) {
          return { 
            ...w, 
            balance: isIncome ? w.balance + finalAmount : w.balance - finalAmount 
          };
        }
      }
      return w;
    });

    const updatedTransactions = [newTx, ...state.transactions];

    setState(prev => ({
      ...prev,
      transactions: updatedTransactions,
      wallets: updatedWallets
    }));

    if (newTx.type === 'expense') {
      checkCategoryBudgets(newTx.category, finalAmount, updatedTransactions);
    }
  }, [state.settings.currencySymbol, state.wallets, state.transactions, checkCategoryBudgets]);

  const handleDeleteTransaction = useCallback((id: string) => {
    triggerHapticFeedback();
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    const isIncome = tx.type === 'income' || tx.type === 'savings_withdraw';
    const amt = tx.amount;

    const updatedWallets = state.wallets.map(w => {
      if (tx.type === 'transfer') {
        if (w.id === tx.walletId) {
          return { ...w, balance: w.balance + amt };
        }
        if (w.id === tx.toWalletId) {
          return { ...w, balance: w.balance - amt };
        }
      } else {
        if (w.id === tx.walletId) {
          return {
            ...w,
            balance: isIncome ? w.balance - amt : w.balance + amt
          };
        }
      }
      return w;
    });

    setState(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== id),
      wallets: updatedWallets
    }));
  }, [state.transactions, state.wallets]);

  const handleEditTransaction = useCallback((id: string, updatedData: Partial<Transaction>) => {
    triggerHapticFeedback();

    const updatedTxList = state.transactions.map(t => {
      if (t.id === id) {
        const diff = (updatedData.amount || t.amount) - t.amount;

        if (diff !== 0) {
          const isIncome = t.type === 'income' || t.type === 'savings_withdraw';

          setState(prev => ({
            ...prev,
            wallets: prev.wallets.map(w => {
              if (w.id === t.walletId) {
                return {
                  ...w,
                  balance: isIncome ? w.balance + diff : w.balance - diff
                };
              }
              return w;
            })
          }));
        }

        return { ...t, ...updatedData };
      }
      return t;
    });

    setState(prev => ({
      ...prev,
      transactions: updatedTxList
    }));
  }, [state.transactions]);

  const handleSetBudget = useCallback((categoryId: string, amount: number, rollover: boolean) => {
    triggerHapticFeedback();

    const existing = state.budgets.find(b => b.categoryId === categoryId);
    let updatedBudgets: Budget[];

    if (existing) {
      updatedBudgets = state.budgets.map(b => 
        b.categoryId === categoryId ? { ...b, amount, rollover } : b
      );
    } else {
      updatedBudgets = [
        ...state.budgets,
        {
          id: `b-${Date.now()}`,
          categoryId,
          amount,
          month: currentMonth,
          rollover
        }
      ];
    }

    setState(prev => ({
      ...prev,
      budgets: updatedBudgets
    }));
  }, [state.budgets, currentMonth]);

  const handleDeleteBudget = useCallback((budgetId: string) => {
    triggerHapticFeedback();
    setState(prev => ({
      ...prev,
      budgets: prev.budgets.filter(b => b.id !== budgetId)
    }));
  }, []);

  const handleTransferToSavings = useCallback((goalId: string, amount: number, fromWalletId: string) => {
    triggerHapticFeedback();

    const updatedWallets = state.wallets.map(w => {
      if (w.id === fromWalletId) {
        return { ...w, balance: w.balance - amount };
      }
      return w;
    });

    const updatedGoals = state.savingsGoals.map(g => {
      if (g.id === goalId) {
        return { ...g, currentAmount: g.currentAmount + amount };
      }
      return g;
    });

    const goal = state.savingsGoals.find(g => g.id === goalId);

    const depositTx: Transaction = {
      id: `tx-dep-${Date.now()}`,
      type: 'savings_deposit',
      amount,
      currency: state.settings.currencySymbol,
      date: new Date().toISOString(),
      note: `Vault goal transfer: "${goal?.name || 'Goal Fund'}"`,
      category: 'Savings Deposit',
      walletId: fromWalletId,
      paymentMethod: 'Bank Transfer',
      isRecurring: false
    };

    setState(prev => ({
      ...prev,
      wallets: updatedWallets,
      savingsGoals: updatedGoals,
      transactions: [depositTx, ...prev.transactions]
    }));
  }, [state.wallets, state.savingsGoals, state.settings.currencySymbol]);

  const handleWithdrawFromSavings = useCallback((goalId: string, amount: number, toWalletId: string) => {
    triggerHapticFeedback();

    const goal = state.savingsGoals.find(g => g.id === goalId);
    if (goal && goal.currentAmount < amount) {
      alert('Insufficient funds inside this vault goal.');
      return;
    }

    const updatedWallets = state.wallets.map(w => {
      if (w.id === toWalletId) {
        return { ...w, balance: w.balance + amount };
      }
      return w;
    });

    const updatedGoals = state.savingsGoals.map(g => {
      if (g.id === goalId) {
        return { ...g, currentAmount: g.currentAmount - amount };
      }
      return g;
    });

    const withdrawTx: Transaction = {
      id: `tx-wdr-${Date.now()}`,
      type: 'savings_withdraw',
      amount,
      currency: state.settings.currencySymbol,
      date: new Date().toISOString(),
      note: `Vault withdrawal to checking: "${goal?.name || 'Goal Fund'}"`,
      category: 'Savings Withdrawal',
      walletId: toWalletId,
      paymentMethod: 'Bank Transfer',
      isRecurring: false
    };

    setState(prev => ({
      ...prev,
      wallets: updatedWallets,
      savingsGoals: updatedGoals,
      transactions: [withdrawTx, ...prev.transactions]
    }));
  }, [state.savingsGoals, state.wallets, state.settings.currencySymbol]);

  const handleAddSavingsGoal = useCallback((goalData: Omit<SavingsGoal, 'id' | 'currentAmount'>) => {
    triggerHapticFeedback();

    const newGoal: SavingsGoal = {
      id: `goal-${Date.now()}`,
      currentAmount: 0,
      ...goalData
    };

    setState(prev => ({
      ...prev,
      savingsGoals: [...prev.savingsGoals, newGoal]
    }));
  }, []);

  const handleAddCategory = useCallback((catData: Omit<Category, 'id' | 'isCustom' | 'isEnabled'>) => {
    triggerHapticFeedback();
    const newCat: Category = {
      id: `cat-custom-${Date.now()}`,
      isCustom: true,
      isEnabled: true,
      ...catData
    };
    setState(prev => ({
      ...prev,
      categories: [...prev.categories, newCat]
    }));
  }, []);

  const handleDeleteCategory = useCallback((id: string) => {
    triggerHapticFeedback();
    setState(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== id)
    }));
  }, []);

  const handleFactoryReset = useCallback(() => {
    triggerHapticFeedback();
    localStorage.clear();
    const fresh = getInitialState();
    setState(fresh);
    setAvatar('');
    setActiveThemeId('emerald');
    localStorage.setItem('cocoon_theme_id', 'emerald');
    localStorage.setItem('finflow_theme_id', 'emerald');
    setIsLocked(false);
  }, []);

  const handleExportBackup = useCallback(() => {
    triggerHapticFeedback();
    const backupStr = exportBackupAsJson(state);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(backupStr);

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataUri);
    downloadAnchor.setAttribute('download', 'cocoon_ledger_backup.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);

    addNotification(
      'Backup Exported Successfully',
      'Your financial ledger has been downloaded directly to your device\'s default "Downloads" folder as cocoon_ledger_backup.json. You can use this file to restore your balance and history anytime.',
      'backup_export'
    );
  }, [state, addNotification]);

  const handleImportBackup = useCallback((jsonStr: string) => {
    try {
      const importedState = importBackupFromJson(jsonStr);
      setState(importedState);
      if (importedState.settings?.accentColor) {
        setActiveThemeId(importedState.settings.accentColor);
      }
      addNotification(
        'Backup Restored Successfully',
        'Your offline secure database records have been fully restored from JSON.',
        'backup_import'
      );
    } catch (err: any) {
      alert(err.message || 'Restoration failed. Please check file formatting.');
    }
  }, [addNotification]);

  const handleUpdateSettings = useCallback((updates: Partial<AppSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates }
    }));
  }, []);

  const handleSetVaultPassword = useCallback((pwd: string) => {
    setState(prev => {
      const updated = {
        ...prev,
        settings: {
          ...prev.settings,
          vaultPassword: pwd
        }
      };
      saveAppState(updated);
      return updated;
    });
    addNotification(
      'Vault Security Activated',
      'Your personal savings are now locked behind a secure Vault passcode.',
      'backup_export'
    );
  }, [addNotification]);

  return {
    state,
    setState,
    activeThemeId,
    activeTheme,
    selectTheme,
    isLocked,
    setIsLocked,
    enteredPin,
    handlePinKeyPress,
    handlePinBackspace,
    handlePinClear,
    activeTab,
    setActiveTab,
    currentMonth,
    setCurrentMonth,
    handlePrevMonth,
    handleNextMonth,
    dashboardToggle,
    setDashboardToggle,
    toggleDashboardView,
    activeDoughnutIndex,
    setActiveDoughnutIndex,
    avatar,
    updateAvatar,
    isTxModalOpen,
    setIsTxModalOpen,
    txModalType,
    setTxModalType,
    isBudgetOpen,
    setIsBudgetOpen,
    isSidebarOpen,
    setIsSidebarOpen,
    isCategoryManagerOpen,
    setIsCategoryManagerOpen,
    categoryTypeToManage,
    setCategoryTypeToManage,
    isHelpOpen,
    setIsHelpOpen,
    isRadialOpen,
    setIsRadialOpen,
    activeAlert,
    setActiveAlert,
    toastBanner,
    setToastBanner,
    balanceRevealed,
    setBalanceRevealed,
    showBalancePinPrompt,
    setShowBalancePinPrompt,
    balancePinInput,
    balancePinError,
    handleToggleBalanceReveal,
    handleBalancePinKeyPress,
    handleBalancePinClear,
    handleBalancePinBackspace,
    notifications,
    isNotificationsOpen,
    setIsNotificationsOpen,
    addNotification,
    markAllNotificationsRead,
    clearAllNotifications,
    financialTotals,
    categoryBreakdown,
    doughnutSegments,
    handleAddTransaction,
    handleDeleteTransaction,
    handleEditTransaction,
    handleSetBudget,
    handleDeleteBudget,
    handleTransferToSavings,
    handleWithdrawFromSavings,
    handleAddSavingsGoal,
    handleAddCategory,
    handleDeleteCategory,
    handleFactoryReset,
    handleExportBackup,
    handleImportBackup,
    handleUpdateSettings,
    handleSetVaultPassword
  };
}
