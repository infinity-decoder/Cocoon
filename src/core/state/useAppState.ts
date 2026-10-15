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
import { loadAppState, getInitialState, initDatabaseAndMigrate } from '../storage/storageAdapter';
import { sqlitePool } from '../../infrastructure/database/sqliteConnectionPool';
import { databaseService, DatabaseErrorState } from '../../infrastructure/database/DatabaseService';
import { 
  PersonalFinanceService, 
  SummaryQueryService, 
  TransactionQueryService 
} from '../../application/services';
import { exportBackupAsJson, importBackupFromJson } from '../storage/backupService';
import { DEFAULT_CATEGORIES, DEFAULT_SUBCATEGORIES, DEFAULT_WALLETS, DEFAULT_SETTINGS } from '../constants';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { PREBUILT_THEMES, AppTheme } from '../theme';
import { triggerHapticFeedback } from '../utils/haptics';
import { 
  computeFinancialTotals, 
  computeCategoryBreakdown, 
  computeDoughnutSegments, 
  checkBudgetThreshold 
} from '../../modules/dashboard/calculations';

export function useAppState() {
  // 1. Core local-first App State loaded from authoritative SQLite store
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

  // Note: Continuous full-state localStorage writing is eliminated.
  // Targeted SQLite writes in PersonalFinanceService guarantee atomic persistence
  // without periodic disk writes or serialization bottlenecks.

  // 2. Database safety and error monitoring
  const [databaseError, setDatabaseError] = useState<DatabaseErrorState>(() => databaseService.getErrorState());

  useEffect(() => {
    const unsub = databaseService.subscribeErrorState(errState => {
      setDatabaseError(errState);
    });
    return unsub;
  }, []);

  const handleDatabaseRetry = useCallback(async () => {
    try {
      await databaseService.resetErrorAndRetry();
      const migratedState = await initDatabaseAndMigrate();
      setState(migratedState);
    } catch (err) {
      console.error('Retry connection failed:', err);
    }
  }, []);

  // Bootstrap SQLite database and zero-loss migration on initial mount
  useEffect(() => {
    initDatabaseAndMigrate()
      .then(migratedState => {
        setState(migratedState);
      })
      .catch(err => {
        console.warn('SQLite initialization and migration runner notice:', err);
      });
  }, []);

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
            triggerHapticFeedback();
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  // 13. Financial mutator actions via PersonalFinanceService
  const handleAddTransaction = useCallback(async (newTxData: Partial<Transaction>) => {
    triggerHapticFeedback();

    const finalAmount = Number(newTxData.amount) || 0;
    const walletId = newTxData.walletId || (state.wallets[0]?.id || 'w-cash');

    try {
      const conn = await databaseService.getInitializedConnection();
      const createdTx = await PersonalFinanceService.addTransaction(conn, {
        id: newTxData.id,
        type: (newTxData.type || 'expense') as Transaction['type'],
        amount: finalAmount,
        currency: state.settings.currencySymbol,
        date: newTxData.date || new Date().toISOString(),
        note: newTxData.note || '',
        category: newTxData.category || 'Uncategorized',
        subCategory: newTxData.subCategory,
        walletId,
        toWalletId: newTxData.toWalletId,
        paymentMethod: newTxData.paymentMethod || 'Cash',
        attachment: newTxData.attachment,
        isRecurring: newTxData.isRecurring || false,
        recurrence: newTxData.recurrence,
        savingsGoalId: newTxData.savingsGoalId
      });

      // Update state upon verified database commit
      const isIncome = createdTx.type === 'income' || createdTx.type === 'savings_withdraw';
      const updatedWallets = state.wallets.map(w => {
        if (createdTx.type === 'transfer') {
          if (w.id === createdTx.walletId) return { ...w, balance: w.balance - finalAmount };
          if (w.id === createdTx.toWalletId) return { ...w, balance: w.balance + finalAmount };
        } else if (w.id === createdTx.walletId) {
          return { ...w, balance: isIncome ? w.balance + finalAmount : w.balance - finalAmount };
        }
        return w;
      });

      const updatedTransactions = [createdTx, ...state.transactions];
      setState(prev => ({
        ...prev,
        transactions: updatedTransactions,
        wallets: updatedWallets
      }));

      // Check category budget via SummaryQueryService
      if (createdTx.type === 'expense') {
        SummaryQueryService.checkBudgetThreshold(
          conn,
          createdTx.category,
          currentMonth,
          state.categories,
          state.budgets
        ).then(result => {
          if (!result) return;
          if (result.exceeded) {
            setActiveAlert({
              title: 'Strict Cap Exceeded!',
              desc: `Warning: You have fully exceeded your monthly budget cap of ${state.settings.currencySymbol} ${result.budgetAmount.toLocaleString()} for "${createdTx.category}"!`
            });
          } else if (result.ratio >= 0.8) {
            setActiveAlert({
              title: 'Cap Alert threshold',
              desc: `Alert: You spent ${Math.round(result.ratio * 100)}% of your monthly budget of ${state.settings.currencySymbol} ${result.budgetAmount.toLocaleString()} for "${createdTx.category}"!`
            });
          }
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error('Failed to commit transaction:', err);
      setActiveAlert({
        title: 'Transaction Error',
        desc: err?.message || 'Failed to save transaction to database.'
      });
    }
  }, [state.settings.currencySymbol, state.wallets, state.transactions, state.categories, state.budgets, currentMonth]);

  const handleDeleteTransaction = useCallback(async (id: string) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      await PersonalFinanceService.deleteTransaction(conn, id);

      setState(prev => {
        const tx = prev.transactions.find(t => t.id === id);
        if (!tx) return prev;

        const isIncome = tx.type === 'income' || tx.type === 'savings_withdraw';
        const amt = tx.amount;

        const updatedWallets = prev.wallets.map(w => {
          if (tx.type === 'transfer') {
            if (w.id === tx.walletId) return { ...w, balance: w.balance + amt };
            if (w.id === tx.toWalletId) return { ...w, balance: w.balance - amt };
          } else if (w.id === tx.walletId) {
            return {
              ...w,
              balance: isIncome ? w.balance - amt : w.balance + amt
            };
          }
          return w;
        });

        return {
          ...prev,
          transactions: prev.transactions.filter(t => t.id !== id),
          wallets: updatedWallets
        };
      });
    } catch (err: any) {
      console.error('Failed to delete transaction:', err);
      setActiveAlert({
        title: 'Delete Failed',
        desc: err?.message || 'Failed to remove transaction.'
      });
    }
  }, []);

  const handleEditTransaction = useCallback(async (id: string, updatedData: Partial<Transaction>) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      const updatedTx = await PersonalFinanceService.editTransaction(conn, {
        id,
        amount: updatedData.amount,
        note: updatedData.note,
        category: updatedData.category,
        subCategory: updatedData.subCategory,
        date: updatedData.date,
        paymentMethod: updatedData.paymentMethod
      });

      setState(prev => {
        const oldTx = prev.transactions.find(t => t.id === id);
        const diff = (updatedTx.amount || 0) - (oldTx?.amount || 0);

        const updatedWallets = prev.wallets.map(w => {
          if (diff !== 0 && oldTx && w.id === oldTx.walletId) {
            const isIncome = oldTx.type === 'income' || oldTx.type === 'savings_withdraw';
            return {
              ...w,
              balance: isIncome ? w.balance + diff : w.balance - diff
            };
          }
          return w;
        });

        return {
          ...prev,
          wallets: updatedWallets,
          transactions: prev.transactions.map(t => t.id === id ? { ...t, ...updatedTx } : t)
        };
      });
    } catch (err: any) {
      console.error('Failed to edit transaction:', err);
      setActiveAlert({
        title: 'Edit Failed',
        desc: err?.message || 'Could not update transaction.'
      });
    }
  }, []);

  const handleSetBudget = useCallback(async (categoryId: string, amount: number, rollover: boolean) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      const budget = await PersonalFinanceService.setBudget(conn, categoryId, amount, rollover, currentMonth);

      setState(prev => {
        const existing = prev.budgets.find(b => b.categoryId === categoryId);
        const updatedBudgets = existing
          ? prev.budgets.map(b => b.categoryId === categoryId ? { ...b, amount, rollover } : b)
          : [...prev.budgets, budget];

        return { ...prev, budgets: updatedBudgets };
      });
    } catch (err: any) {
      console.error('Failed to set budget:', err);
      setActiveAlert({ title: 'Budget Error', desc: err?.message || 'Could not save budget.' });
    }
  }, [currentMonth]);

  const handleDeleteBudget = useCallback(async (budgetId: string) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      await PersonalFinanceService.deleteBudget(conn, budgetId);
      setState(prev => ({
        ...prev,
        budgets: prev.budgets.filter(b => b.id !== budgetId)
      }));
    } catch (err: any) {
      console.error('Failed to delete budget:', err);
      setActiveAlert({ title: 'Delete Failed', desc: err?.message || 'Could not delete budget.' });
    }
  }, []);

  const handleTransferToSavings = useCallback(async (goalId: string, amount: number, fromWalletId?: string) => {
    triggerHapticFeedback();
    const effectiveWalletId = fromWalletId || state.wallets[0]?.id || 'wallet-bank';

    try {
      const conn = await databaseService.getInitializedConnection();
      const res = await PersonalFinanceService.transferToSavings(
        conn,
        goalId,
        amount,
        effectiveWalletId,
        state.settings.currencySymbol
      );

      setState(prev => {
        const updatedWallets = prev.wallets.map(w => {
          if (w.id === effectiveWalletId) return { ...w, balance: w.balance - amount };
          return w;
        });

        const goalExists = prev.savingsGoals.some(g => g.id === res.goal.id);
        const updatedGoals = goalExists
          ? prev.savingsGoals.map(g => g.id === res.goal.id ? res.goal : g)
          : [res.goal, ...prev.savingsGoals];

        return {
          ...prev,
          wallets: updatedWallets,
          savingsGoals: updatedGoals,
          transactions: [res.transaction, ...prev.transactions]
        };
      });
    } catch (err: any) {
      console.error('Failed to transfer to savings:', err);
      setActiveAlert({ title: 'Vault Transfer Error', desc: err?.message || 'Failed to transfer funds to vault.' });
    }
  }, [state.wallets, state.settings.currencySymbol]);

  const handleWithdrawFromSavings = useCallback(async (goalId: string, amount: number, toWalletId?: string) => {
    triggerHapticFeedback();
    const effectiveWalletId = toWalletId || state.wallets[0]?.id || 'wallet-bank';

    try {
      const conn = await databaseService.getInitializedConnection();
      const res = await PersonalFinanceService.withdrawFromSavings(
        conn,
        goalId,
        amount,
        effectiveWalletId,
        state.settings.currencySymbol
      );

      setState(prev => {
        const updatedWallets = prev.wallets.map(w => {
          if (w.id === effectiveWalletId) return { ...w, balance: w.balance + amount };
          return w;
        });

        const updatedGoals = prev.savingsGoals.map(g => g.id === res.goal.id ? res.goal : g);

        return {
          ...prev,
          wallets: updatedWallets,
          savingsGoals: updatedGoals,
          transactions: [res.transaction, ...prev.transactions]
        };
      });
    } catch (err: any) {
      console.error('Failed to withdraw from savings:', err);
      setActiveAlert({ title: 'Vault Withdrawal Error', desc: err?.message || 'Failed to withdraw from vault.' });
    }
  }, [state.wallets, state.settings.currencySymbol]);

  const handleAddSavingsGoal = useCallback(async (goalData: Omit<SavingsGoal, 'id' | 'currentAmount'>) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      const newGoal = await PersonalFinanceService.addSavingsGoal(conn, goalData);
      setState(prev => ({
        ...prev,
        savingsGoals: [...prev.savingsGoals, newGoal]
      }));
    } catch (err: any) {
      console.error('Failed to add savings goal:', err);
      setActiveAlert({ title: 'Goal Error', desc: err?.message || 'Could not save savings goal.' });
    }
  }, []);

  const handleEditSavingsGoal = useCallback(async (goalId: string, updatedData: Partial<SavingsGoal>) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      const updated = await PersonalFinanceService.editSavingsGoal(conn, goalId, updatedData);
      setState(prev => ({
        ...prev,
        savingsGoals: prev.savingsGoals.map(g => g.id === goalId ? updated : g)
      }));
    } catch (err: any) {
      console.error('Failed to edit savings goal:', err);
      setActiveAlert({ title: 'Goal Error', desc: err?.message || 'Could not update savings goal.' });
    }
  }, []);

  const handleDeleteSavingsGoal = useCallback(async (goalId: string) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      await PersonalFinanceService.deleteSavingsGoal(conn, goalId);

      setState(prev => {
        const goalToDelete = prev.savingsGoals.find(g => g.id === goalId);
        if (!goalToDelete || goalId === 'savings') return prev;
        const salvagedAmount = goalToDelete.currentAmount || 0;
        let savingsFound = false;

        let nextGoals = prev.savingsGoals
          .filter(g => g.id !== goalId)
          .map(g => {
            if (g.id === 'savings') {
              savingsFound = true;
              return { ...g, currentAmount: g.currentAmount + salvagedAmount };
            }
            return g;
          });

        if (!savingsFound && salvagedAmount > 0) {
          nextGoals = [
            { id: 'savings', name: 'Savings', targetAmount: 0, currentAmount: salvagedAmount, color: '#10B981' },
            ...nextGoals
          ];
        }

        return {
          ...prev,
          savingsGoals: nextGoals
        };
      });
    } catch (err: any) {
      console.error('Failed to delete savings goal:', err);
      setActiveAlert({ title: 'Goal Error', desc: err?.message || 'Could not delete savings goal.' });
    }
  }, []);

  const handleAddCategory = useCallback(async (catData: Omit<Category, 'id' | 'isCustom' | 'isEnabled'>) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      const newCat = await PersonalFinanceService.addCategory(conn, catData);
      setState(prev => ({
        ...prev,
        categories: [...prev.categories, newCat]
      }));
    } catch (err: any) {
      console.error('Failed to add category:', err);
      setActiveAlert({ title: 'Category Error', desc: err?.message || 'Could not save category.' });
    }
  }, []);

  const handleDeleteCategory = useCallback(async (id: string) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      await PersonalFinanceService.deleteCategory(conn, id);
      setState(prev => ({
        ...prev,
        categories: prev.categories.filter(c => c.id !== id),
        subCategories: prev.subCategories.filter(sc => sc.parentId !== id)
      }));
    } catch (err: any) {
      console.error('Failed to delete category:', err);
      setActiveAlert({ title: 'Category Error', desc: err?.message || 'Could not delete category.' });
    }
  }, []);

  const handleAddSubCategory = useCallback(async (subCatData: Omit<Category, 'id' | 'isCustom' | 'isEnabled'>) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      const newSubCat = await PersonalFinanceService.addSubCategory(conn, subCatData);
      setState(prev => ({
        ...prev,
        subCategories: [...prev.subCategories, newSubCat]
      }));
      return newSubCat;
    } catch (err: any) {
      console.error('Failed to add subcategory:', err);
      setActiveAlert({ title: 'Subcategory Error', desc: err?.message || 'Could not save subcategory.' });
    }
  }, []);

  const handleDeleteSubCategory = useCallback(async (id: string) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      await PersonalFinanceService.deleteSubCategory(conn, id);
      setState(prev => ({
        ...prev,
        subCategories: prev.subCategories.filter(sc => sc.id !== id)
      }));
    } catch (err: any) {
      console.error('Failed to delete subcategory:', err);
      setActiveAlert({ title: 'Subcategory Error', desc: err?.message || 'Could not delete subcategory.' });
    }
  }, []);

  const handleFactoryReset = useCallback(async () => {
    triggerHapticFeedback();
    try {
      localStorage.clear();
      sessionStorage.clear();
      const conn = await databaseService.getInitializedConnection();
      await PersonalFinanceService.resetPersonalData(conn);
    } catch (dbErr) {
      console.warn('SQLite clear error on reset:', dbErr);
    }

    const fresh: AppState = {
      transactions: [],
      categories: DEFAULT_CATEGORIES,
      subCategories: DEFAULT_SUBCATEGORIES,
      wallets: DEFAULT_WALLETS.map(w => ({ ...w, balance: 0 })),
      budgets: [],
      savingsGoals: [{ id: 'savings', name: 'Savings', targetAmount: 0, currentAmount: 0, color: '#10B981' }],
      reminders: [],
      settings: {
        ...DEFAULT_SETTINGS,
        userName: '',
        userEmail: '',
        userPhone: '',
        userAddress: '',
        pinCode: undefined,
        vaultPassword: undefined
      }
    };

    setState(fresh);
    setAvatar('');
    setActiveThemeId('emerald');
    localStorage.setItem('cocoon_theme_id', 'emerald');
    localStorage.setItem('finflow_theme_id', 'emerald');
    setIsLocked(false);
    setEnteredPin('');
    setActiveTab(0);

    addNotification(
      'Factory Reset Complete',
      'All local transactions, vault entries, personal details, and data have been wiped clean.',
      'system'
    );
  }, [addNotification]);

  const handleExportBackup = useCallback(async () => {
    triggerHapticFeedback();
    const backupStr = exportBackupAsJson(state);
    const filename = 'cocoon_backup.json';

    try {
      if (Capacitor.isNativePlatform()) {
        // Native Android / iOS via Capacitor
        // 1. Write file to Documents directory
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: backupStr,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });

        // 2. Open Android system save / share sheet so user can store directly in Downloads folder
        try {
          await Share.share({
            title: 'Cocoon Database Backup',
            text: 'Offline encrypted database backup for Cocoon Financial Tracker.',
            url: writeResult.uri,
            dialogTitle: 'Save cocoon_backup to Downloads'
          });
        } catch {
          // Share dialog dismissed or completed
        }

        addNotification(
          'Backup File Saved',
          'Database backup "cocoon_backup.json" created successfully in Documents and ready in Downloads.',
          'backup_export'
        );
      } else {
        // Web browser / AI Studio fallback
        const blob = new Blob([backupStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', url);
        downloadAnchor.setAttribute('download', filename);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
        URL.revokeObjectURL(url);

        addNotification(
          'Backup Exported Successfully',
          'Database backup "cocoon_backup.json" downloaded to your device downloads folder.',
          'backup_export'
        );
      }
    } catch (err: any) {
      console.error('Export backup error:', err);
      // Fallback to data URI
      try {
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(backupStr);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataUri);
        downloadAnchor.setAttribute('download', filename);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
      } catch (fallbackErr) {
        console.error('Fallback export error:', fallbackErr);
      }
      addNotification(
        'Backup Export Notice',
        'Database backup was prepared as cocoon_backup.json.',
        'backup_export'
      );
    }
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
      addNotification(
        'Restoration Failed',
        err?.message || 'Restoration failed. Please check file formatting.',
        'system'
      );
    }
  }, [addNotification]);

  const handleUpdateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      await PersonalFinanceService.updateSettings(conn, updates);
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, ...updates }
      }));
    } catch (err: any) {
      console.error('Failed to update settings:', err);
      setActiveAlert({ title: 'Settings Error', desc: err?.message || 'Could not save settings.' });
    }
  }, []);

  const handleSetVaultPassword = useCallback(async (pwd: string) => {
    triggerHapticFeedback();
    try {
      const conn = await databaseService.getInitializedConnection();
      await PersonalFinanceService.updateSettings(conn, { vaultPassword: pwd });
      setState(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          vaultPassword: pwd
        }
      }));
      addNotification(
        'Vault Security Activated',
        'Your personal savings are now locked behind a secure Vault passcode.',
        'backup_export'
      );
    } catch (err: any) {
      console.error('Failed to set vault password:', err);
      setActiveAlert({ title: 'Vault Error', desc: err?.message || 'Could not set vault password.' });
    }
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
    isSettingsOpen,
    setIsSettingsOpen,
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
    handleEditSavingsGoal,
    handleDeleteSavingsGoal,
    handleAddCategory,
    handleDeleteCategory,
    handleAddSubCategory,
    handleDeleteSubCategory,
    handleFactoryReset,
    handleExportBackup,
    handleImportBackup,
    handleUpdateSettings,
    handleSetVaultPassword,
    databaseError,
    handleDatabaseRetry
  };
}
