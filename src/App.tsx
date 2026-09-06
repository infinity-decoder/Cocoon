/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Home as HomeIcon, 
  History as HistoryIcon, 
  Plus, 
  Minus,
  AlertTriangle,
  Bell,
  Lock,
  Delete,
  Menu,
  BarChart2,
  Check,
  Database,
  FileText,
  FileSpreadsheet,
  Trash2,
  X,
  Download,
  Upload,
  Eye,
  EyeOff,
  Landmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Components
import AnimatedGauge from './components/AnimatedGauge';
import TrendSparkline from './components/TrendSparkline';
import QuickStats from './components/QuickStats';
import ActionDock from './components/ActionDock';
import TransactionFormModal from './components/TransactionFormModal';
import TransactionsTab from './components/TransactionsTab';
import SavingsTab from './components/SavingsTab';
import ProfileTab from './components/ProfileTab';
import BudgetManager from './components/BudgetManager';
import CocoonLogo from './components/CocoonLogo';
import SidebarMenu from './components/SidebarMenu';
import CategoryManager, { CATEGORY_ICONS_MAP } from './components/CategoryManager';
import HelpSupportModal from './components/HelpSupportModal';
import AnalysisTab from './components/AnalysisTab';

// Helpers and data
import { AppState, loadAppState, saveAppState, getInitialState, exportBackupAsJson, importBackupFromJson } from './db';
import { triggerHapticFeedback } from './utils/haptics';
import { PREBUILT_THEMES } from './theme';
import { Transaction, Category, Wallet, Budget, SavingsGoal, AppSettings } from './types';

export default function App() {
  // Load initial local-first state
  const [state, setState] = useState<AppState>(() => loadAppState());
  
  // Root Theme
  const [activeThemeId, setActiveThemeId] = useState(() => {
    return localStorage.getItem('cocoon_theme_id') || localStorage.getItem('finflow_theme_id') || 'emerald';
  });

  // Locked passcode barrier
  const [isLocked, setIsLocked] = useState(() => !!loadAppState().settings.pinCode);
  const [enteredPin, setEnteredPin] = useState('');

  // App locks validation
  const handlePinKeyPress = (digit: string) => {
    triggerHapticFeedback();
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + digit;
      setEnteredPin(nextPin);
      
      if (nextPin.length === 4) {
        if (nextPin === state.settings.pinCode) {
          setTimeout(() => {
            setIsLocked(false);
            setEnteredPin('');
          }, 200);
        } else {
          // Reset on wrong code
          setTimeout(() => {
            setEnteredPin('');
            alert('Incorrect PIN Code. Please try again.');
          }, 300);
        }
      }
    }
  };

  const handlePinBackspace = () => {
    triggerHapticFeedback();
    setEnteredPin(enteredPin.slice(0, -1));
  };

  // Nav index tabs: 0: Home/Dashboard, 1: History/Ledger, 2: Savings Vault, 3: Profile/Settings
  const [activeTab, setActiveTab] = useState(0);

  // Dynamic month and dashboard toggle states
  const [currentMonth, setCurrentMonth] = useState(() => {
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  });
  const [dashboardToggle, setDashboardToggle] = useState<'expense' | 'income'>('expense');
  const [activeDoughnutIndex, setActiveDoughnutIndex] = useState<number | null>(null);

  // Reset active segment when dashboard view toggles or month changes
  useEffect(() => {
    setActiveDoughnutIndex(null);
  }, [dashboardToggle, currentMonth]);

  // Profile fields avatar local store
  const [avatar, setAvatar] = useState(() => localStorage.getItem('cocoon_avatar') || localStorage.getItem('finflow_avatar') || '');

  // Modal active states
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);

  // Overlays / Sliding Sidebar States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [categoryTypeToManage, setCategoryTypeToManage] = useState<'expense' | 'income'>('expense');
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // FAB Floating Radial Menu states
  const [isRadialOpen, setIsRadialOpen] = useState(false);

  // In-app alert notifications banner
  const [activeAlert, setActiveAlert] = useState<{ title: string; desc: string } | null>(null);
  const [toastBanner, setToastBanner] = useState<{ title: string; message: string; type: string } | null>(null);

  // Auto-dismiss the floating success toast banner after 7 seconds
  useEffect(() => {
    if (toastBanner) {
      const timer = setTimeout(() => {
        setToastBanner(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [toastBanner]);

  // Balance privacy state hooks
  const [balanceRevealed, setBalanceRevealed] = useState(false);
  const [showBalancePinPrompt, setShowBalancePinPrompt] = useState(false);
  const [balancePinInput, setBalancePinInput] = useState('');
  const [balancePinError, setBalancePinError] = useState('');

  // In-app notifications
  interface InAppNotification {
    id: string;
    title: string;
    message: string;
    timestamp: string;
    type: 'backup_export' | 'backup_import' | 'pdf_export' | 'excel_export' | 'system';
    unread: boolean;
  }

  const [notifications, setNotifications] = useState<InAppNotification[]>(() => {
    try {
      const raw = localStorage.getItem('cocoon_notifications') || localStorage.getItem('finflow_notifications');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Auto-save notifications
  useEffect(() => {
    localStorage.setItem('cocoon_notifications', JSON.stringify(notifications));
    localStorage.setItem('finflow_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (
    title: string,
    message: string,
    type: 'backup_export' | 'backup_import' | 'pdf_export' | 'excel_export' | 'system'
  ) => {
    // Only accept notifications related to backups, restores, or PDF/Excel exports
    const allowedTypes = ['backup_export', 'backup_import', 'pdf_export', 'excel_export'];
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
  };

  // Look up active Theme details
  const activeTheme = useMemo(() => {
    return PREBUILT_THEMES.find(t => t.id === activeThemeId) || PREBUILT_THEMES[0];
  }, [activeThemeId]);

  // Save changes to localStorage on state changes
  useEffect(() => {
    saveAppState(state);
  }, [state]);

  // --- FINANCIAL CALC ENGINE ---
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const currentMonthTransactions = useMemo(() => {
    return state.transactions.filter(t => t.date.startsWith(currentMonth));
  }, [state.transactions, currentMonth]);

  const todayTransactions = useMemo(() => {
    return state.transactions.filter(t => t.date.startsWith(todayStr));
  }, [state.transactions, todayStr]);

  const monthIncome = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.type === 'income' || t.type === 'savings_withdraw')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [currentMonthTransactions]);

  const monthExpense = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.type === 'expense' || t.type === 'savings_deposit')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [currentMonthTransactions]);

  // Calculations for today's boxes
  const todayExpenses = useMemo(() => {
    return todayTransactions
      .filter(t => t.type === 'expense' || t.type === 'savings_deposit')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [todayTransactions]);

  const todayIncome = useMemo(() => {
    return todayTransactions
      .filter(t => t.type === 'income' || t.type === 'savings_withdraw')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [todayTransactions]);

  // Dynamic Month switching helpers
  const handlePrevMonth = () => {
    triggerHapticFeedback();
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    setCurrentMonth(date.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    triggerHapticFeedback();
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month, 1);
    setCurrentMonth(date.toISOString().slice(0, 7));
  };

  // Dynamic category groupings breakdown for the responsive donut chart & spend list
  const categoryBreakdown = useMemo(() => {
    const monthTxs = state.transactions.filter(t => t.date.startsWith(currentMonth));
    const filtered = monthTxs.filter(t => {
      if (dashboardToggle === 'expense') {
        return t.type === 'expense' || t.type === 'savings_deposit';
      } else {
        return t.type === 'income' || t.type === 'savings_withdraw';
      }
    });

    const total = filtered.reduce((sum, t) => sum + t.amount, 0);

    // Group by category name
    const groups: Record<string, { amount: number; color: string; icon: string }> = {};

    filtered.forEach(t => {
      if (!groups[t.category]) {
        // Find category color & icon
        const catMeta = state.categories.find(c => c.name === t.category);
        groups[t.category] = {
          amount: 0,
          color: catMeta?.color || '#64748B',
          icon: catMeta?.icon || 'Home'
        };
      }
      groups[t.category].amount += t.amount;
    });

    // Convert to array
    const list = Object.entries(groups).map(([name, data]) => ({
      name,
      amount: data.amount,
      percentage: total > 0 ? (data.amount / total) * 100 : 0,
      color: data.color,
      icon: data.icon
    }));

    // Sort descending
    list.sort((a, b) => b.amount - a.amount);

    return {
      list,
      total
    };
  }, [state.transactions, state.categories, currentMonth, dashboardToggle]);

  // Slices specifically for the doughnut chart, representing expenses relative to total income
  const doughnutSegments = useMemo(() => {
    if (dashboardToggle === 'income') {
      return categoryBreakdown.list.map(item => ({
        name: item.name,
        amount: item.amount,
        percentage: item.percentage,
        color: item.color,
        icon: item.icon,
        isRemaining: false
      }));
    }

    // For expense:
    if (monthIncome > 0) {
      const list = categoryBreakdown.list.map(item => ({
        name: item.name,
        amount: item.amount,
        percentage: (item.amount / monthIncome) * 100,
        color: item.color,
        icon: item.icon,
        isRemaining: false
      }));

      if (monthIncome > monthExpense) {
        const remainingAmount = monthIncome - monthExpense;
        list.push({
          name: 'Remaining Balance',
          amount: remainingAmount,
          percentage: (remainingAmount / monthIncome) * 100,
          color: 'rgba(20, 184, 166, 0.4)', // beautiful translucent teal
          icon: 'TrendingUp',
          isRemaining: true
        });
      }
      return list;
    }

    // Fallback if monthIncome <= 0:
    return categoryBreakdown.list.map(item => ({
      name: item.name,
      amount: item.amount,
      percentage: item.percentage,
      color: item.color,
      icon: item.icon,
      isRemaining: false
    }));
  }, [categoryBreakdown.list, monthIncome, monthExpense, dashboardToggle]);

  // Trigger Local Budget Over-cap limits checking
  const checkCategoryBudgets = (catName: string, addedAmount: number, updatedTxList: Transaction[]) => {
    const matchingCat = state.categories.find(c => c.name === catName);
    if (!matchingCat) return;

    const budgetLimit = state.budgets.find(b => b.categoryId === matchingCat.id || b.categoryId === matchingCat.name);
    if (!budgetLimit) return;

    const totalSpent = updatedTxList
      .filter(t => t.type === 'expense' && t.category === catName && t.date.startsWith(currentMonth))
      .reduce((sum, t) => sum + t.amount, 0);

    const ratio = totalSpent / budgetLimit.amount;
    
    if (totalSpent >= budgetLimit.amount) {
      setActiveAlert({
        title: 'Strict Cap Exceeded!',
        desc: `Warning: You have fully exceeded your monthly budget cap of ${state.settings.currencySymbol} ${budgetLimit.amount.toLocaleString()} for "${catName}"!`
      });
    } else if (ratio >= 0.8) {
      setActiveAlert({
        title: 'Cap Alert threshold',
        desc: `Alert: You spent ${Math.round(ratio * 100)}% of your monthly budget of ${state.settings.currencySymbol} ${budgetLimit.amount.toLocaleString()} for "${catName}"!`
      });
    }
  };

  // --- ACTIONS MUTATORS ---
  const handleAddTransaction = (newTxData: Partial<Transaction>) => {
    triggerHapticFeedback();
    
    const finalAmount = newTxData.amount || 0;
    const isIncome = newTxData.type === 'income' || newTxData.type === 'savings_withdraw';

    const transactionId = `tx-${Date.now()}`;
    const newTx: Transaction = {
      id: transactionId,
      type: newTxData.type as any,
      amount: finalAmount,
      currency: state.settings.currencySymbol,
      date: newTxData.date || new Date().toISOString(),
      note: newTxData.note || '',
      category: newTxData.category || 'Uncategorized',
      subCategory: newTxData.subCategory,
      walletId: newTxData.walletId || state.wallets[0].id,
      toWalletId: newTxData.toWalletId,
      paymentMethod: newTxData.paymentMethod || 'Cash',
      attachment: newTxData.attachment,
      isRecurring: newTxData.isRecurring || false,
      recurrence: newTxData.recurrence
    };

    // Update Wallet Balances securely
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

    // Trigger Budget cap alert checking
    if (newTx.type === 'expense') {
      checkCategoryBudgets(newTx.category, finalAmount, updatedTransactions);
    }
  };

  const handleDeleteTransaction = (id: string) => {
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
  };

  const handleEditTransaction = (id: string, updatedData: Partial<Transaction>) => {
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
  };

  const handleSetBudget = (categoryId: string, amount: number, rollover: boolean) => {
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
  };

  const handleDeleteBudget = (budgetId: string) => {
    triggerHapticFeedback();
    setState(prev => ({
      ...prev,
      budgets: prev.budgets.filter(b => b.id !== budgetId)
    }));
  };

  const handleTransferToSavings = (goalId: string, amount: number, fromWalletId: string) => {
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
  };

  const handleWithdrawFromSavings = (goalId: string, amount: number, toWalletId: string) => {
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
  };

  const handleAddSavingsGoal = (goalData: Omit<SavingsGoal, 'id' | 'currentAmount'>) => {
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
  };

  // --- CUSTOM CATEGORIES MUTATIONS ---
  const handleAddCategory = (catData: Omit<Category, 'id' | 'isCustom' | 'isEnabled'>) => {
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
  };

  const handleDeleteCategory = (id: string) => {
    triggerHapticFeedback();
    setState(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== id)
    }));
  };

  const handleFactoryReset = () => {
    triggerHapticFeedback();
    localStorage.clear();
    const fresh = getInitialState();
    setState(fresh);
    setAvatar('');
    setActiveThemeId('emerald');
    localStorage.setItem('cocoon_theme_id', 'emerald');
    localStorage.setItem('finflow_theme_id', 'emerald');
    setIsLocked(false);
  };

  const handleExportBackup = () => {
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
  };

  const handleImportBackup = (jsonStr: string) => {
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
  };

  const handleToggleBalanceReveal = () => {
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
  };

  const handleBalancePinKeyPress = (digit: string) => {
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
  };

  return (
    <div 
      className={`min-h-screen w-full flex items-center justify-center transition-all duration-300 ${activeTheme.fontFamily}`}
      style={{ backgroundColor: activeTheme.background, color: activeTheme.textPrimary }}
    >
      {/* SCREEN FRAME WRAPPER */}
      <div 
        className="w-full max-w-md h-screen md:max-h-[880px] md:h-[880px] md:rounded-[40px] md:shadow-[0_25px_60px_rgba(0,0,0,0.5)] md:border relative overflow-hidden flex flex-col justify-between"
        style={{ backgroundColor: activeTheme.background, borderColor: activeTheme.border }}
      >
        {/* APP LOCK PIN BARRIER */}
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
                    onClick={() => handlePinKeyPress(key)}
                    className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-lg font-bold flex items-center justify-center cursor-pointer select-none"
                  >
                    {key}
                  </button>
                ))}
                
                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    setEnteredPin('');
                  }}
                  className="w-16 h-16 rounded-full bg-white/2 hover:bg-white/5 text-xs font-bold flex items-center justify-center cursor-pointer"
                >
                  Clear
                </button>

                <button
                  onClick={() => handlePinKeyPress('0')}
                  className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-lg font-bold flex items-center justify-center cursor-pointer select-none"
                >
                  0
                </button>

                <button
                  onClick={handlePinBackspace}
                  className="w-16 h-16 rounded-full bg-white/2 hover:bg-white/5 flex items-center justify-center text-rose-400 cursor-pointer"
                >
                  <Delete size={20} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* IN-APP ALERTS WARNING BANNER */}
        <AnimatePresence>
          {activeAlert && (
            <motion.div
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              className="absolute top-4 inset-x-4 bg-rose-500 border border-rose-600 text-white p-4 rounded-2xl shadow-2xl z-[80] flex gap-3 select-none"
            >
              <AlertTriangle className="flex-shrink-0 animate-bounce" size={20} />
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold font-display uppercase tracking-wider">{activeAlert.title}</span>
                <span className="text-[11px] mt-0.5 leading-relaxed opacity-90">{activeAlert.desc}</span>
              </div>
              <button 
                onClick={() => setActiveAlert(null)}
                className="ml-auto text-xs font-extrabold underline self-start cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* IN-APP NOTIFICATIONS OVERLAY */}
        <AnimatePresence>
          {isNotificationsOpen && (
            <div className="fixed inset-0 z-[99] overflow-hidden flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsNotificationsOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              />

              {/* Panel Content */}
              <motion.div
                initial={{ scale: 0.95, y: 15, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 15, opacity: 0 }}
                className="w-full max-w-sm rounded-3xl border p-5 shadow-2xl z-10 flex flex-col max-h-[480px] overflow-hidden select-none text-left"
                style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
              >
                {/* Header */}
                <div className="flex justify-between items-center pb-3.5 border-b" style={{ borderColor: activeTheme.border }}>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase text-emerald-400 font-mono tracking-widest">Vault Messages</span>
                    <span className="text-[10px] text-neutral-400 font-mono mt-0.5">Secure offline ledger logs</span>
                  </div>
                  <button
                    onClick={() => {
                      triggerHapticFeedback();
                      setIsNotificationsOpen(false);
                    }}
                    className="p-1.5 rounded-lg bg-white/5 text-neutral-400 hover:text-white cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto py-3 space-y-2 scrollbar-none">
                  {notifications.length === 0 ? (
                    <div className="h-44 flex flex-col items-center justify-center text-center gap-2">
                      <div className="p-3 bg-white/3 rounded-full text-neutral-500 border border-white/5">
                        <Bell size={24} className="opacity-40" />
                      </div>
                      <span className="text-xs font-bold text-neutral-400">All Quiet Here</span>
                      <span className="text-[10px] text-neutral-500 leading-normal max-w-[200px]">
                        Notifications about offline backups, restores, and printable exports will appear here.
                      </span>
                    </div>
                  ) : (
                    notifications.map(notif => {
                      // Get icon based on type
                      let IconComponent = Database;
                      let iconColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
                      if (notif.type === 'backup_export') {
                        IconComponent = Download;
                        iconColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                      } else if (notif.type === 'backup_import') {
                        IconComponent = Upload;
                        iconColor = 'text-teal-400 bg-teal-500/10 border-teal-500/20';
                      } else if (notif.type === 'pdf_export') {
                        IconComponent = FileText;
                        iconColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                      } else if (notif.type === 'excel_export') {
                        IconComponent = FileSpreadsheet;
                        iconColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                      }

                      return (
                        <div 
                          key={notif.id}
                          className={`p-3 rounded-2xl border flex gap-3 transition-all ${
                            notif.unread ? 'bg-white/[0.04]' : 'bg-transparent opacity-75'
                          }`}
                          style={{ borderColor: activeTheme.border }}
                        >
                          <div className={`p-2 rounded-xl border flex-shrink-0 h-9 w-9 flex items-center justify-center ${iconColor}`}>
                            <IconComponent size={16} />
                          </div>
                          <div className="flex flex-col text-left flex-1 min-w-0">
                            <div className="flex justify-between items-baseline gap-2">
                              <span className="text-xs font-bold text-neutral-200 truncate">{notif.title}</span>
                              <span className="text-[9px] font-mono text-neutral-500 whitespace-nowrap">{notif.timestamp}</span>
                            </div>
                            <span className="text-[10px] text-neutral-400 leading-relaxed mt-0.5">{notif.message}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Controls */}
                {notifications.length > 0 && (
                  <div className="pt-3 border-t flex justify-between gap-3 mt-1" style={{ borderColor: activeTheme.border }}>
                    <button
                      onClick={() => {
                        triggerHapticFeedback();
                        setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
                      }}
                      className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-center text-[10px] rounded-xl cursor-pointer transition-colors border border-white/5"
                    >
                      Mark all read
                    </button>
                    <button
                      onClick={() => {
                        triggerHapticFeedback();
                        setNotifications([]);
                      }}
                      className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-center text-[10px] rounded-xl cursor-pointer transition-colors border border-rose-500/20 flex items-center gap-1.5"
                    >
                      <Trash2 size={12} />
                      Clear all
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* BRAND TOP BAR (Cocoon Resized Logo & Hamburger Trigger ☰) */}
        <div className="pt-6 px-4.5 flex justify-between items-center z-10" style={{ color: activeTheme.textPrimary }}>
          <div className="cursor-pointer" onClick={() => setActiveTab(0)}>
            <CocoonLogo size={36} showText={true} />
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                triggerHapticFeedback();
                setIsNotificationsOpen(prev => !prev);
              }}
              className="p-2.5 bg-white/5 border rounded-2xl hover:bg-white/10 cursor-pointer relative transition-all"
              style={{ borderColor: activeTheme.border, color: activeTheme.textPrimary }}
              title="In-App Notifications"
            >
              <Bell size={18} />
              {notifications.some(n => n.unread) && (
                <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse border border-neutral-950" />
              )}
            </button>

            {/* Sidebar Trigger ☰ */}
            <button
              onClick={() => {
                triggerHapticFeedback();
                setIsSidebarOpen(true);
              }}
              className="p-2.5 bg-white/5 border rounded-2xl hover:bg-white/10 cursor-pointer transition-all"
              style={{ borderColor: activeTheme.border, color: activeTheme.textPrimary }}
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        {/* APP MAIN VIEW BODY (Framer-motion fade layout) */}
        <div className="flex-1 overflow-y-auto px-4.5 pt-4 pb-28 scrollbar-none flex flex-col gap-5">
          <AnimatePresence mode="wait">
            {activeTab === 0 && (
              <motion.div
                key="dashboard-tab"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex flex-col gap-4.5"
              >
                {/* DYNAMIC PRIVACY NET BALANCE HERO CARD */}
                <div 
                  className={`p-5 border flex flex-col gap-4 relative overflow-hidden text-left ${activeTheme.radius}`}
                  style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold">
                        Net Liquid Balance
                      </span>
                      <p className="text-[10px] text-neutral-500 font-mono">
                        Auto-computed: Month Income minus Expense
                      </p>
                    </div>
                    {/* Fancy animated eye button */}
                    <button
                      onClick={handleToggleBalanceReveal}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition-all text-emerald-400 cursor-pointer flex items-center justify-center"
                    >
                      {balanceRevealed ? (
                        <Eye size={16} className="text-emerald-400 transition-transform" />
                      ) : (
                        <EyeOff size={16} className="text-neutral-400 animate-pulse transition-transform" />
                      )}
                    </button>
                  </div>

                  <div className="relative h-11 flex items-center">
                    <AnimatePresence mode="wait">
                      {balanceRevealed ? (
                        <motion.div
                          key="revealed-balance"
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="flex items-baseline gap-1.5"
                        >
                          <span className={`text-3xl font-black font-mono tracking-tight ${monthIncome - monthExpense >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                            ₨ {(monthIncome - monthExpense).toLocaleString()}
                          </span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="hidden-balance"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="flex items-center gap-2.5 text-neutral-400"
                        >
                          {/* Beautiful Animated Privacy Eye dots/stripes pattern */}
                          <div className="flex gap-2.5 items-center">
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                              <motion.div 
                                key={i}
                                className="w-2.5 h-2.5 rounded-full bg-neutral-600/70"
                                animate={{
                                  scale: [1, 1.2, 1],
                                  opacity: [0.5, 1, 0.5]
                                }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  delay: i * 0.15
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 font-medium">
                            Locked (Tap Eye)
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* 3. INTERACTIVE OVERVIEW SWITCHER TOGGLE */}
                <div className="flex justify-between items-center px-1 mt-1">
                  <span className="text-xs font-black uppercase tracking-widest font-mono text-neutral-400">
                    {dashboardToggle === 'expense' ? 'Expense Category Overview' : 'Income Category Overview'}
                  </span>
                  <button
                    onClick={() => {
                      triggerHapticFeedback();
                      setDashboardToggle(prev => prev === 'expense' ? 'income' : 'expense');
                    }}
                    className="text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/5 font-mono"
                  >
                    {dashboardToggle === 'expense' ? 'Show Income' : 'Show Expense'}
                  </button>
                </div>

                 {/* 4. DONUT CHART REPRESENTATION */}
                 {categoryBreakdown.total > 0 ? (
                   <div 
                     className={`p-4 border flex flex-col items-center justify-center relative select-none cursor-default ${activeTheme.radius}`}
                     style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
                     onClick={() => setActiveDoughnutIndex(null)}
                   >
                     <div className="relative w-full max-w-[220px] aspect-square flex items-center justify-center">
                       <svg viewBox="0 0 240 240" className="w-full h-full overflow-hidden">
                          {/* Background track */}
                          <circle 
                            cx="120" 
                            cy="120" 
                            r="80" 
                            fill="transparent" 
                            stroke="rgba(255,255,255,0.03)" 
                            strokeWidth="12" 
                          />
                          {/* Colored donut segments */}
                          {(() => {
                            let accumulatedPercent = 0;
                            return doughnutSegments.map((item, index) => {
                              const isActive = activeDoughnutIndex === index;
                              const isAnyActive = activeDoughnutIndex !== null;
                              
                              // Visually emphasize active segment, dim others slightly
                              const r = isActive ? 85 : 80;
                              const strokeWidth = isActive ? 16 : 12;
                              const opacity = isActive ? 1.0 : (isAnyActive ? 0.3 : 0.95);
                              
                              const circumference = 2 * Math.PI * r;
                              const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                              
                              // Offset starting at 12 o'clock, shifting clockwise by accumulatedPercent
                              const strokeDashoffset = (0.25 - accumulatedPercent / 100) * circumference;
                              accumulatedPercent += item.percentage;
                              
                              return (
                                <circle
                                  key={index}
                                  cx="120"
                                  cy="120"
                                  r={r}
                                  fill="transparent"
                                  stroke={item.color}
                                  strokeWidth={strokeWidth}
                                  strokeDasharray={strokeDasharray}
                                  strokeDashoffset={strokeDashoffset}
                                  strokeLinecap="round"
                                  opacity={opacity}
                                  className="transition-all duration-200 ease-out cursor-pointer"
                                  style={{ transformOrigin: '120px 120px' }}
                                  onMouseEnter={() => {
                                    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
                                      triggerHapticFeedback();
                                      setActiveDoughnutIndex(index);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
                                      setActiveDoughnutIndex(null);
                                    }
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHapticFeedback();
                                    setActiveDoughnutIndex(activeDoughnutIndex === index ? null : index);
                                  }}
                                />
                              );
                            });
                          })()}
                        </svg>

                       {/* Center details mask inside the donut hole */}
                       <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none select-none max-w-[130px] w-[130px] h-[130px] overflow-hidden">
                         <AnimatePresence mode="wait">
                           <motion.div
                             key={activeDoughnutIndex === null ? 'default' : `segment-${activeDoughnutIndex}`}
                             initial={{ opacity: 0, scale: 0.9 }}
                             animate={{ opacity: 1, scale: 1 }}
                             exit={{ opacity: 0, scale: 0.9 }}
                             transition={{ duration: 0.15, ease: "easeOut" }}
                             className="flex flex-col items-center justify-center text-center w-full px-1"
                           >
                             {activeDoughnutIndex === null ? (
                               <>
                                 <span className="text-[9px] font-mono tracking-widest text-neutral-400 uppercase font-black leading-tight">
                                   {dashboardToggle === 'expense' ? 'Spent Ratio' : 'Earned'}
                                 </span>
                                 <span className="text-lg font-black font-mono mt-1 text-white leading-tight">
                                   {dashboardToggle === 'expense' 
                                     ? (monthIncome > 0 
                                         ? `${((categoryBreakdown.total / monthIncome) * 100).toFixed(1)}%` 
                                         : (categoryBreakdown.total > 0 ? 'N/A' : '0%'))
                                     : `₨ ${categoryBreakdown.total.toLocaleString()}`}
                                 </span>
                                 <span className="text-[7px] font-mono text-neutral-500 mt-1 whitespace-nowrap">
                                   Hover / Tap segment
                                 </span>
                               </>
                             ) : (
                               (() => {
                                 const activeItem = doughnutSegments[activeDoughnutIndex];
                                 if (!activeItem) return null;
                                 return (
                                   <>
                                     <span 
                                       className="text-[10px] font-sans tracking-wide uppercase font-extrabold truncate max-w-[120px] leading-tight transition-colors duration-150" 
                                       style={{ color: activeItem.color }}
                                     >
                                       {activeItem.name}
                                     </span>
                                     <span 
                                       className="text-xl font-black font-mono mt-1 leading-tight transition-colors duration-150"
                                       style={{ color: activeItem.color }}
                                     >
                                       {activeItem.percentage.toFixed(1)}%
                                     </span>
                                     <span className="text-[8px] font-mono text-neutral-400 mt-0.5 whitespace-nowrap">
                                       ₨ {activeItem.amount.toLocaleString()}
                                     </span>
                                   </>
                                 );
                               })()
                             )}
                           </motion.div>
                         </AnimatePresence>
                       </div>
                     </div>
                   </div>
                 ) : (
                  // EMPTY STATE REPRESENTATION
                  <div 
                    className={`p-10 border border-dashed flex flex-col items-center justify-center text-center ${activeTheme.radius}`}
                    style={{ backgroundColor: `${activeTheme.cardBg}22`, borderColor: activeTheme.border }}
                  >
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 mb-3">
                      <BarChart2 size={20} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest font-mono text-neutral-400">Empty Ledger</span>
                    <span className="text-[9px] text-neutral-500 font-mono leading-relaxed mt-1 px-4">
                      No transactions recorded for this period. Tap the central (+) button below to add custom items.
                    </span>
                  </div>
                )}

                {/* 5. VERTICAL LIST OF SPENT/EARNED CATEGORIES */}
                {categoryBreakdown.list.length > 0 && (
                  <div className="flex flex-col gap-3.5 mt-1.5">
                    {categoryBreakdown.list.map((item, idx) => {
                      const IconComponent = CATEGORY_ICONS_MAP[item.icon] || HomeIcon;
                      // Privacy filter logic for salary/expenses
                      const isPrivacyMasked = dashboardToggle === 'expense' && !balanceRevealed;

                      // Find budget if it's expense
                      const matchingCat = state.categories.find(c => c.name === item.name);
                      const budgetLimit = dashboardToggle === 'expense' && matchingCat 
                        ? state.budgets.find(b => b.categoryId === matchingCat.id || b.categoryId === matchingCat.name) 
                        : undefined;
                      const hasBudget = !!budgetLimit;
                      const budgetAmount = budgetLimit ? budgetLimit.amount : 0;
                      const percentSpent = hasBudget ? (item.amount / budgetAmount) * 100 : 0;

                      return (
                        <div 
                          key={idx} 
                          className="flex flex-col gap-2 p-3.5 bg-white/2 hover:bg-white/4 rounded-2xl border border-white/5 transition-all text-left"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" 
                                style={{ backgroundColor: item.color }}
                              >
                                <IconComponent size={16} strokeWidth={2.5} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-white tracking-wide">{item.name}</span>
                                <span className="text-[9px] text-neutral-400 font-mono mt-0.5">
                                  {dashboardToggle === 'expense' ? (
                                    hasBudget ? (
                                      <span className={percentSpent > 100 ? 'text-rose-400 font-extrabold' : 'text-neutral-400'}>
                                        {percentSpent.toFixed(0)}% of ₨ {budgetAmount.toLocaleString()} budget
                                      </span>
                                    ) : (
                                      'No budget allocated'
                                    )
                                  ) : (
                                    `${item.percentage.toFixed(1)}% of Total`
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end text-right font-mono">
                              <span className="text-xs font-extrabold text-white">
                                {isPrivacyMasked ? '₨ •••••' : `₨ ${item.amount.toLocaleString()}`}
                              </span>
                              {dashboardToggle === 'expense' && hasBudget && percentSpent > 100 && (
                                <span className="text-[7.5px] font-black uppercase text-rose-400 tracking-wider mt-0.5">
                                  Over budget
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Progress bar line */}
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500" 
                              style={{ 
                                backgroundColor: dashboardToggle === 'expense' && hasBudget && percentSpent > 100 ? '#F43F5E' : item.color, 
                                width: `${Math.min(dashboardToggle === 'expense' ? (hasBudget ? percentSpent : 0) : item.percentage, 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 1 && (
              <motion.div
                key="history-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <TransactionsTab
                  transactions={state.transactions}
                  categories={state.categories}
                  paymentMethods={['Cash', 'Credit Card', 'Debit Card', 'Digital Wallet', 'NayaPay', 'Cryptocurrency', 'Bank Transfer', 'Cheque']}
                  currencySymbol={state.settings.currencySymbol}
                  onDeleteTransaction={handleDeleteTransaction}
                  onEditTransaction={handleEditTransaction}
                  onAddNotification={addNotification}
                  themeCardBg={activeTheme.cardBg}
                  themeBorder={activeTheme.border}
                  themeRadius={activeTheme.radius}
                  themePrimary={activeTheme.primary}
                />
              </motion.div>
            )}

            {activeTab === 2 && (
              <motion.div
                key="savings-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <SavingsTab
                  savingsGoals={state.savingsGoals}
                  wallets={state.wallets}
                  currencySymbol={state.settings.currencySymbol}
                  onTransferToSavings={handleTransferToSavings}
                  onWithdrawFromSavings={handleWithdrawFromSavings}
                  onAddGoal={handleAddSavingsGoal}
                  themeCardBg={activeTheme.cardBg}
                  themeBorder={activeTheme.border}
                  themeRadius={activeTheme.radius}
                  themePrimary={activeTheme.primary}
                  vaultPassword={state.settings.vaultPassword}
                  onSetVaultPassword={(pwd) => {
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
                  }}
                />
              </motion.div>
            )}

            {activeTab === 3 && (
              <motion.div
                key="profile-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <ProfileTab
                  settings={state.settings}
                  onChangeSettings={(updates) => {
                    setState(prev => ({
                      ...prev,
                      settings: { ...prev.settings, ...updates }
                    }));
                  }}
                  avatar={avatar}
                  onChangeAvatar={(base64) => {
                    setAvatar(base64);
                    localStorage.setItem('cocoon_avatar', base64);
                    localStorage.setItem('finflow_avatar', base64);
                  }}
                  onFactoryReset={handleFactoryReset}
                  onExportBackup={handleExportBackup}
                  onImportBackup={handleImportBackup}
                  activeThemeId={activeThemeId}
                  onSelectTheme={(id) => {
                    setActiveThemeId(id);
                    localStorage.setItem('cocoon_theme_id', id);
                    localStorage.setItem('finflow_theme_id', id);
                  }}
                  themeCardBg={activeTheme.cardBg}
                  themeBorder={activeTheme.border}
                  themeRadius={activeTheme.radius}
                  themePrimary={activeTheme.primary}
                />
              </motion.div>
            )}

            {activeTab === 4 && (
              <motion.div
                key="analysis-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <AnalysisTab
                  transactions={state.transactions}
                  categories={state.categories}
                  currencySymbol={state.settings.currencySymbol}
                  themeCardBg={activeTheme.cardBg}
                  themeBorder={activeTheme.border}
                  themeRadius={activeTheme.radius}
                  themePrimary={activeTheme.primary}
                  onDeleteTransaction={handleDeleteTransaction}
                  onEditTransaction={handleEditTransaction}
                />
              </motion.div>
            )}

            {activeTab === 5 && (
              <motion.div
                key="budget-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <BudgetManager
                  isOpen={true}
                  isInline={true}
                  onClose={() => {
                    triggerHapticFeedback();
                    setActiveTab(0);
                  }}
                  budgets={state.budgets}
                  categories={state.categories}
                  transactions={state.transactions}
                  currencySymbol={state.settings.currencySymbol}
                  onSetBudget={handleSetBudget}
                  onDeleteBudget={handleDeleteBudget}
                  themeCardBg={activeTheme.cardBg}
                  themeBorder={activeTheme.border}
                  themeRadius={activeTheme.radius}
                />
              </motion.div>
            )}

            {activeTab === 6 && (
              <motion.div
                key="add-expense-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <TransactionFormModal
                  isOpen={true}
                  isInline={true}
                  type="expense"
                  onClose={() => {
                    triggerHapticFeedback();
                    setActiveTab(0);
                  }}
                  onSave={(data) => {
                    handleAddTransaction(data);
                    setActiveTab(0);
                  }}
                  categories={state.categories}
                  subCategories={state.subCategories}
                  wallets={state.wallets}
                  paymentMethods={['Cash', 'Credit Card', 'Debit Card', 'Digital Wallet', 'NayaPay', 'Cryptocurrency', 'Bank Transfer', 'Cheque']}
                  currencySymbol={state.settings.currencySymbol}
                  themeRadius={activeTheme.radius}
                  themePrimary={activeTheme.primary}
                  themeCardBg={activeTheme.cardBg}
                  themeBorder={activeTheme.border}
                />
              </motion.div>
            )}

            {activeTab === 7 && (
              <motion.div
                key="add-income-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <TransactionFormModal
                  isOpen={true}
                  isInline={true}
                  type="income"
                  onClose={() => {
                    triggerHapticFeedback();
                    setActiveTab(0);
                  }}
                  onSave={(data) => {
                    handleAddTransaction(data);
                    setActiveTab(0);
                  }}
                  categories={state.categories}
                  subCategories={state.subCategories}
                  wallets={state.wallets}
                  paymentMethods={['Cash', 'Credit Card', 'Debit Card', 'Digital Wallet', 'NayaPay', 'Cryptocurrency', 'Bank Transfer', 'Cheque']}
                  currencySymbol={state.settings.currencySymbol}
                  themeRadius={activeTheme.radius}
                  themePrimary={activeTheme.primary}
                  themeCardBg={activeTheme.cardBg}
                  themeBorder={activeTheme.border}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* --- FLOATING SLEEK TELEGRAM-STYLE GLASSY BOTTOM NAVIGATION BAR --- */}
        <div 
          className="absolute bottom-4 inset-x-4 max-w-sm sm:max-w-md mx-auto h-[60px] rounded-[24px] border flex items-center justify-between px-6 z-[45] select-none shadow-2xl backdrop-blur-xl transition-all"
          style={{ backgroundColor: `${activeTheme.cardBg}CC`, borderColor: `${activeTheme.border}40` }}
        >
          {/* Button 1: Home */}
          <button 
            onClick={() => {
              triggerHapticFeedback();
              setActiveTab(0);
              setIsRadialOpen(false);
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
              activeTab === 0 ? 'text-emerald-400 scale-110 font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <HomeIcon size={18} strokeWidth={activeTheme.iconStrokeWidth} />
            <span className="text-[8px] uppercase font-mono tracking-widest font-black">Home</span>
          </button>

          {/* Button 2: Budget (triggers inline Outgoing Caps/Budget tab) */}
          <button 
            onClick={() => {
              triggerHapticFeedback();
              setActiveTab(5);
              setIsRadialOpen(false);
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
              activeTab === 5 ? 'text-amber-400 scale-110 font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Landmark size={18} strokeWidth={activeTheme.iconStrokeWidth} className={activeTab === 5 ? 'text-amber-400' : ''} />
            <span className="text-[8px] uppercase font-mono tracking-widest font-black">Budget</span>
          </button>

          {/* Button 3: Rotating Big Plus Radial Trigger aligned perfectly inside the menu bar */}
          <div className="relative w-11 h-11 flex items-center justify-center z-[46]">
            <AnimatePresence>
              {isRadialOpen && (
                <>
                  {/* Backdrop mask */}
                  <div 
                    onClick={() => setIsRadialOpen(false)}
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
                        setActiveTab(6);
                        setIsRadialOpen(false);
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
                        setActiveTab(7);
                        setIsRadialOpen(false);
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
                setIsRadialOpen(!isRadialOpen);
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

          {/* Button 4: Analysis (triggers newly designed dynamic Analysis tab) */}
          <button 
            onClick={() => {
              triggerHapticFeedback();
              setActiveTab(4);
              setIsRadialOpen(false);
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
              activeTab === 4 ? 'text-cyan-400 scale-110 font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <BarChart2 size={18} strokeWidth={activeTheme.iconStrokeWidth} className={activeTab === 4 ? 'text-cyan-400' : ''} />
            <span className="text-[8px] uppercase font-mono tracking-widest font-black">Analysis</span>
          </button>

          {/* Button 5: Profile with Dynamic Avatar Display */}
          <button 
            onClick={() => {
              triggerHapticFeedback();
              setActiveTab(3);
              setIsRadialOpen(false);
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
              activeTab === 3 ? 'text-emerald-400 scale-110 font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <div className={`w-5 h-5 rounded-full overflow-hidden border transition-all shrink-0 ${
              activeTab === 3 ? 'border-emerald-400 ring-2 ring-emerald-500/20' : 'border-neutral-500'
            }`}>
              <img 
                src={avatar || `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2310B981"/><stop offset="100%" stop-color="%233B82F6"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g)"/><circle cx="50" cy="37" r="18" fill="%23ffffff"/><path d="M20,80 C20,60 30,55 50,55 C70,55 80,60 80,80 Z" fill="%23ffffff"/></svg>`} 
                alt="Profile Avatar" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="text-[8px] uppercase font-mono tracking-widest font-black">Profile</span>
          </button>
        </div>

        {/* --- DUAL TRANSACTION FORM MODAL SHEET --- */}
        <TransactionFormModal
          isOpen={isTxModalOpen}
          type={txModalType}
          onClose={() => setIsTxModalOpen(false)}
          onSave={handleAddTransaction}
          categories={state.categories}
          subCategories={state.subCategories}
          wallets={state.wallets}
          paymentMethods={['Cash', 'Credit Card', 'Debit Card', 'Digital Wallet', 'NayaPay', 'Cryptocurrency', 'Bank Transfer', 'Cheque']}
          currencySymbol={state.settings.currencySymbol}
          themeRadius={activeTheme.radius}
          themePrimary={activeTheme.primary}
          themeCardBg={activeTheme.cardBg}
          themeBorder={activeTheme.border}
        />

        {/* --- BUDGET CAPS MANAGER PANEL --- */}
        <BudgetManager
          isOpen={isBudgetOpen}
          onClose={() => setIsBudgetOpen(false)}
          budgets={state.budgets}
          categories={state.categories}
          transactions={state.transactions}
          currencySymbol={state.settings.currencySymbol}
          onSetBudget={handleSetBudget}
          onDeleteBudget={handleDeleteBudget}
          themeCardBg={activeTheme.cardBg}
          themeBorder={activeTheme.border}
          themeRadius={activeTheme.radius}
        />

        {/* --- SLIDING SIDEBAR NAVIGATION PANEL (☰) --- */}
        <SidebarMenu
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onOpenCategories={() => setIsCategoryManagerOpen(true)}
          onOpenLedger={() => setActiveTab(1)}
          onOpenSavings={() => setActiveTab(2)}
          onOpenBudgets={() => {
            triggerHapticFeedback();
            setActiveTab(5);
            setIsSidebarOpen(false);
          }}
          onOpenReports={() => {
            triggerHapticFeedback();
            setActiveTab(4);
          }}
          onOpenHelp={() => setIsHelpOpen(true)}
          activeThemeId={activeThemeId}
          themeCardBg={activeTheme.cardBg}
          themeBorder={activeTheme.border}
        />

        {/* --- CUSTOM CATEGORY MANAGER MODAL --- */}
        <CategoryManager
          isOpen={isCategoryManagerOpen}
          onClose={() => setIsCategoryManagerOpen(false)}
          categories={state.categories}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
          currencySymbol={state.settings.currencySymbol}
          themeCardBg={activeTheme.cardBg}
          themeBorder={activeTheme.border}
          themeRadius={activeTheme.radius}
        />

        {/* --- INTERACTIVE FAQS HELP MODAL --- */}
        <HelpSupportModal
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
          themeCardBg={activeTheme.cardBg}
          themeBorder={activeTheme.border}
          themeRadius={activeTheme.radius}
        />

        {/* --- BALANCES PIN AUTHORIZATION PROMPT --- */}
        <AnimatePresence>
          {showBalancePinPrompt && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99] flex items-center justify-center p-4 select-none">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-[28px] text-center flex flex-col items-center gap-5 text-white"
              >
                <div className="flex justify-between items-center w-full pb-1 border-b border-white/5">
                  <span className="text-xs font-black uppercase tracking-widest font-mono text-neutral-400">Balance Unlock</span>
                  <button 
                    onClick={() => setShowBalancePinPrompt(false)} 
                    className="text-neutral-500 hover:text-white cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                  <Lock size={28} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-extrabold tracking-tight">Security Verification</h3>
                  <p className="text-[11px] text-neutral-400 max-w-[220px] leading-relaxed mx-auto">
                    Please enter your 4-digit App lock PIN to temporarily reveal net balance.
                  </p>
                </div>

                {/* PIN dots */}
                <div className="flex gap-4.5 justify-center py-1">
                  {[0, 1, 2, 3].map((idx) => (
                    <div 
                      key={idx} 
                      className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                        idx < balancePinInput.length 
                          ? 'bg-emerald-500 border-emerald-400 scale-110 shadow-[0_0_8px_rgba(16,185,129,0.6)]' 
                          : 'bg-transparent border-neutral-600'
                      }`}
                    />
                  ))}
                </div>

                {balancePinError && (
                  <span className="text-[10px] text-rose-400 font-bold font-mono tracking-wide bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                    {balancePinError}
                  </span>
                )}

                {/* Numeric keypad grid */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-[220px] pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
                    <button
                      key={k}
                      onClick={() => handleBalancePinKeyPress(k)}
                      className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-sm font-mono flex items-center justify-center cursor-pointer font-bold select-none text-white border border-white/5 transition-all active:scale-90"
                    >
                      {k}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      triggerHapticFeedback();
                      setBalancePinInput('');
                      setBalancePinError('');
                    }}
                    className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 text-[10px] font-mono flex items-center justify-center cursor-pointer font-bold select-none text-neutral-400 border border-white/5 transition-all"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => handleBalancePinKeyPress('0')}
                    className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 text-sm font-mono flex items-center justify-center cursor-pointer font-bold select-none text-white border border-white/5 transition-all active:scale-90"
                  >
                    0
                  </button>
                  <button
                    onClick={() => {
                      triggerHapticFeedback();
                      setBalancePinInput(prev => prev.slice(0, -1));
                    }}
                    className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 text-sm font-mono flex items-center justify-center cursor-pointer font-bold select-none text-neutral-400 border border-white/5 transition-all"
                  >
                    &larr;
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
