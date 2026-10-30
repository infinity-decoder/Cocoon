/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, ArrowRightLeft, Award, ShieldAlert, 
  ArrowUpRight, ArrowDownRight, Lock, Key, Delete,
  X, Check, Pencil, Trash2, ShieldCheck, Wallet, Sparkles, HelpCircle,
  ArrowLeft
} from 'lucide-react';
import { SavingsGoal, Wallet as WalletType } from '../../../core/types';
import { motion, AnimatePresence } from 'motion/react';
import { AnimatedTicker } from '../../../shared/components';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { useTheme } from '../../../core/theme';

interface SavingsTabProps {
  savingsGoals: SavingsGoal[];
  wallets: WalletType[];
  currencySymbol: string;
  onTransferToSavings: (goalId: string, amount: number, fromWalletId?: string) => void;
  onWithdrawFromSavings: (goalId: string, amount: number, toWalletId?: string) => void;
  onAddGoal: (goal: Omit<SavingsGoal, 'id' | 'currentAmount'>) => void;
  onEditGoal?: (goalId: string, updatedData: Partial<SavingsGoal>) => void;
  onDeleteGoal?: (goalId: string) => void;
  onBack?: () => void;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
  themePrimary: string;
  vaultPassword?: string;
  onSetVaultPassword: (password: string) => void;
}

const HARMONIOUS_GOAL_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#EF4444', // Red
  '#06B6D4'  // Cyan
];

export default function SavingsTab({
  savingsGoals,
  currencySymbol,
  onTransferToSavings,
  onWithdrawFromSavings,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
  onBack,
  themeCardBg,
  themeBorder,
  vaultPassword,
  onSetVaultPassword
}: SavingsTabProps) {
  const { theme } = useTheme();
  // Vault Isolation PIN locks state
  const [vaultSessionUnlocked, setVaultSessionUnlocked] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [errMessage, setErrMessage] = useState('');

  // Change PIN modal state
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [changePinOld, setChangePinOld] = useState('');
  const [changePinNew, setChangePinNew] = useState('');
  const [changePinConfirm, setChangePinConfirm] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');

  // Transfer Modal (Deposit / Withdraw)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferType, setTransferType] = useState<'deposit' | 'withdraw'>('deposit');
  const [selectedGoalId, setSelectedGoalId] = useState('savings');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferError, setTransferError] = useState('');

  // Add goal sheet state
  const [showAddGoalSheet, setShowAddGoalSheet] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalColor, setGoalColor] = useState(HARMONIOUS_GOAL_COLORS[2]);
  const [goalDeadline, setGoalDeadline] = useState('');
  const [addGoalError, setAddGoalError] = useState('');

  // Edit goal modal state
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editGoalError, setEditGoalError] = useState('');

  // Delete goal confirmation modal state
  const [deletingGoal, setDeletingGoal] = useState<SavingsGoal | null>(null);

  // Spinning vault animation state
  const [isVaultSpinning, setIsVaultSpinning] = useState(false);

  // Confetti trigger goal ID
  const [completedGoalName, setCompletedGoalName] = useState<string | null>(null);

  // Separation: General Savings (vault holding fund) and targeted user goals
  const generalSavings = savingsGoals.find(g => g.id === 'savings' || g.name.toLowerCase() === 'savings') || {
    id: 'savings',
    name: 'Savings',
    targetAmount: 0,
    currentAmount: 0,
    color: '#10B981'
  };

  const targetGoals = savingsGoals.filter(g => g.id !== 'savings' && g.name.toLowerCase() !== 'savings');

  // Total saved across the entire vault (general savings + all active goals)
  const totalSaved = savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0);

  // Quick Open Transfer Helpers
  const openDepositModal = (preselectedGoalId?: string) => {
    triggerHapticFeedback();
    setTransferType('deposit');
    setSelectedGoalId(preselectedGoalId || 'savings');
    setTransferAmount('');
    setTransferError('');
    setShowTransferModal(true);
  };

  const openWithdrawModal = (preselectedGoalId?: string) => {
    triggerHapticFeedback();
    setTransferType('withdraw');
    // Preselect general savings if it has funds, or the requested goal, or first goal with funds
    if (preselectedGoalId) {
      setSelectedGoalId(preselectedGoalId);
    } else if (generalSavings.currentAmount > 0) {
      setSelectedGoalId('savings');
    } else {
      const firstWithFunds = targetGoals.find(g => g.currentAmount > 0);
      setSelectedGoalId(firstWithFunds ? firstWithFunds.id : 'savings');
    }
    setTransferAmount('');
    setTransferError('');
    setShowTransferModal(true);
  };

  // Submit Deposit or Withdraw
  const handleTransferSubmit = () => {
    triggerHapticFeedback();
    setTransferError('');
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError('Please enter a valid transfer amount greater than 0.');
      return;
    }

    if (transferType === 'withdraw') {
      const sourceGoal = savingsGoals.find(g => g.id === selectedGoalId) || (selectedGoalId === 'savings' ? generalSavings : null);
      if (!sourceGoal || sourceGoal.currentAmount < amt) {
        setTransferError(`Insufficient funds. Maximum available in ${sourceGoal?.name || 'Vault'} is ${currencySymbol}${(sourceGoal?.currentAmount || 0).toLocaleString()}.`);
        return;
      }
    }

    // Trigger visual vault door spin
    setIsVaultSpinning(true);
    setTimeout(() => {
      setIsVaultSpinning(false);
    }, 2500);

    const goalBefore = savingsGoals.find(g => g.id === selectedGoalId);

    if (transferType === 'deposit') {
      onTransferToSavings(selectedGoalId, amt);
      
      // Check if newly 100% saved on a target goal to trigger confetti celebration!
      if (goalBefore && goalBefore.targetAmount > 0 && 
          (goalBefore.currentAmount + amt >= goalBefore.targetAmount) && 
          (goalBefore.currentAmount < goalBefore.targetAmount)) {
        setCompletedGoalName(goalBefore.name);
        setTimeout(() => setCompletedGoalName(null), 5000);
      }
    } else {
      onWithdrawFromSavings(selectedGoalId, amt);
    }

    setTransferAmount('');
    setShowTransferModal(false);
  };

  // Submit New Goal
  const handleAddGoalSubmit = () => {
    triggerHapticFeedback();
    setAddGoalError('');
    const target = parseFloat(goalTarget);
    if (!goalName.trim() || isNaN(target) || target <= 0) {
      setAddGoalError('Please enter a valid goal name and target amount greater than 0.');
      return;
    }

    onAddGoal({
      name: goalName.trim(),
      targetAmount: target,
      color: goalColor,
      deadline: goalDeadline || undefined
    });

    setGoalName('');
    setGoalTarget('');
    setGoalDeadline('');
    setAddGoalError('');
    setShowAddGoalSheet(false);
  };

  // Open Edit Goal Modal
  const handleOpenEditGoal = (goal: SavingsGoal) => {
    triggerHapticFeedback();
    setEditingGoal(goal);
    setEditName(goal.name);
    setEditTarget(goal.targetAmount.toString());
    setEditColor(goal.color || HARMONIOUS_GOAL_COLORS[0]);
    setEditDeadline(goal.deadline || '');
    setEditGoalError('');
  };

  // Save Goal Edits
  const handleSaveGoalEdit = () => {
    if (!editingGoal || !onEditGoal) return;
    triggerHapticFeedback();
    setEditGoalError('');

    const target = parseFloat(editTarget);
    if (!editName.trim() || isNaN(target) || target <= 0) {
      setEditGoalError('Please enter a valid goal name and target amount greater than 0.');
      return;
    }

    onEditGoal(editingGoal.id, {
      name: editName.trim(),
      targetAmount: target,
      color: editColor,
      deadline: editDeadline || undefined
    });

    setEditingGoal(null);
    setEditGoalError('');
  };

  // Confirm and Execute Goal Deletion
  const handleConfirmDeleteGoal = () => {
    if (!deletingGoal || !onDeleteGoal) return;
    triggerHapticFeedback();

    onDeleteGoal(deletingGoal.id);
    setDeletingGoal(null);
  };

  // Submit Changed Vault PIN
  const handleChangePinSubmit = () => {
    triggerHapticFeedback();
    setChangePinError('');

    if (changePinOld !== vaultPassword) {
      setChangePinError('Current PIN is incorrect.');
      return;
    }

    if (changePinNew.length !== 4 || !/^\d{4}$/.test(changePinNew)) {
      setChangePinError('New PIN must be exactly 4 numeric digits.');
      return;
    }

    if (changePinNew !== changePinConfirm) {
      setChangePinError('New PIN and confirmation do not match.');
      return;
    }

    onSetVaultPassword(changePinNew);
    setChangePinSuccess('Vault PIN successfully updated!');
    setTimeout(() => {
      setChangePinSuccess('');
      setShowChangePinModal(false);
      setChangePinOld('');
      setChangePinNew('');
      setChangePinConfirm('');
    }, 1200);
  };

  // PIN Keypad Handlers
  const handleSetupPinPress = (digit: string) => {
    triggerHapticFeedback();
    setErrMessage('');
    if (setupStep === 'create') {
      if (setupPin.length < 4) {
        const next = setupPin + digit;
        setSetupPin(next);
        if (next.length === 4) {
          setSetupStep('confirm');
        }
      }
    } else {
      if (confirmPin.length < 4) {
        const next = confirmPin + digit;
        setConfirmPin(next);
        if (next.length === 4) {
          if (next === setupPin) {
            onSetVaultPassword(next);
            setVaultSessionUnlocked(true);
            setSetupPin('');
            setConfirmPin('');
          } else {
            setErrMessage('PINs do not match. Try again.');
            setConfirmPin('');
            setSetupPin('');
            setSetupStep('create');
          }
        }
      }
    }
  };

  const handleSetupPinBackspace = () => {
    triggerHapticFeedback();
    if (setupStep === 'create') {
      setSetupPin(p => p.slice(0, -1));
    } else {
      setConfirmPin(p => p.slice(0, -1));
    }
  };

  const handleUnlockPinPress = (digit: string) => {
    triggerHapticFeedback();
    setErrMessage('');
    if (inputPin.length < 4) {
      const next = inputPin + digit;
      setInputPin(next);
      if (next.length === 4) {
        if (next === vaultPassword) {
          setVaultSessionUnlocked(true);
          setInputPin('');
        } else {
          setErrMessage('Incorrect PIN code.');
          setInputPin('');
        }
      }
    }
  };

  const handleUnlockPinBackspace = () => {
    triggerHapticFeedback();
    setInputPin(p => p.slice(0, -1));
  };

  // If password is set but session is not unlocked
  if (vaultPassword && !vaultSessionUnlocked) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-2 select-none">
        <div 
          className="w-full max-w-sm p-5 sm:p-6 rounded-[28px] border text-center flex flex-col items-center gap-3.5 shadow-2xl relative transition-colors"
          style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
        >
          {/* Top navigation row with Back to Home and close button */}
          <div className="w-full flex items-center justify-between pb-2 border-b" style={{ borderColor: theme.borderSubtle }}>
            {onBack ? (
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback();
                  onBack();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.borderSubtle,
                  color: theme.textPrimary
                }}
              >
                <ArrowLeft size={14} style={{ color: theme.primary }} />
                <span>Back to Home</span>
              </button>
            ) : <div />}

            <span className="text-[10px] font-mono uppercase tracking-widest font-bold" style={{ color: theme.textSecondary }}>Savings Vault</span>

            {onBack && (
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback();
                  onBack();
                }}
                className="p-1.5 rounded-xl border cursor-pointer transition-all active:scale-90 shadow-sm"
                style={{
                  backgroundColor: theme.dangerBg,
                  borderColor: `${theme.danger}35`,
                  color: theme.danger
                }}
                title="Close Vault"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div 
            className="p-3 rounded-full border mt-1"
            style={{
              backgroundColor: `${theme.primary}18`,
              borderColor: `${theme.primary}35`,
              color: theme.primary
            }}
          >
            <Lock size={24} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-base sm:text-lg font-extrabold tracking-tight" style={{ color: theme.textPrimary }}>Vault Locked</h3>
            <p className="text-xs max-w-[240px] leading-relaxed mx-auto mt-1" style={{ color: theme.textSecondary }}>
              Enter your secure 4-digit Vault passcode.
            </p>
          </div>

          {/* PIN Indicators */}
          <div className="flex gap-3 justify-center py-1">
            {[0, 1, 2, 3].map((idx) => (
              <div 
                key={idx} 
                className="w-3.5 h-3.5 rounded-full border transition-all duration-150"
                style={
                  idx < inputPin.length
                    ? {
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                        transform: 'scale(1.1)',
                        boxShadow: `0 0 10px ${theme.primary}80`
                      }
                    : {
                        backgroundColor: 'transparent',
                        borderColor: theme.borderSubtle
                      }
                }
              />
            ))}
          </div>

          {errMessage && (
            <span 
              className="text-[11px] font-bold font-mono tracking-wide px-3 py-1 rounded-full border"
              style={{
                backgroundColor: theme.dangerBg,
                borderColor: `${theme.danger}40`,
                color: theme.danger
              }}
            >
              {errMessage}
            </span>
          )}

          {/* Balanced, comfortable numeric keypad grid */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[260px] pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <button
                key={k}
                onClick={() => handleUnlockPinPress(k)}
                className="h-13 sm:h-14 rounded-2xl text-lg font-mono flex items-center justify-center cursor-pointer font-bold select-none border transition-all active:scale-95 shadow-sm"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.borderSubtle,
                  color: theme.textPrimary
                }}
              >
                {k}
              </button>
            ))}
            <button
              onClick={() => {
                triggerHapticFeedback();
                setInputPin('');
                setErrMessage('');
              }}
              className="h-13 sm:h-14 rounded-2xl text-xs font-mono flex items-center justify-center cursor-pointer font-bold select-none border transition-all active:scale-95"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.textSecondary
              }}
            >
              CLEAR
            </button>
            <button
              onClick={() => handleUnlockPinPress('0')}
              className="h-13 sm:h-14 rounded-2xl text-lg font-mono flex items-center justify-center cursor-pointer font-bold select-none border transition-all active:scale-95 shadow-sm"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              0
            </button>
            <button
              onClick={handleUnlockPinBackspace}
              className="h-13 sm:h-14 rounded-2xl text-base font-mono flex items-center justify-center cursor-pointer font-bold select-none border transition-all active:scale-95"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.danger
              }}
            >
              <Delete size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If password NOT set yet:
  if (!vaultPassword) {
    const currentLen = setupStep === 'create' ? setupPin.length : confirmPin.length;
    return (
      <div className="w-full flex flex-col items-center justify-center py-2 select-none">
        <div 
          className="w-full max-w-sm p-5 sm:p-6 rounded-[28px] border text-center flex flex-col items-center gap-3.5 shadow-2xl relative transition-colors"
          style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
        >
          {/* Top navigation row with Back to Home and close button */}
          <div className="w-full flex items-center justify-between pb-2 border-b" style={{ borderColor: theme.borderSubtle }}>
            {onBack ? (
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback();
                  onBack();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.borderSubtle,
                  color: theme.textPrimary
                }}
              >
                <ArrowLeft size={14} style={{ color: theme.primary }} />
                <span>Back to Home</span>
              </button>
            ) : <div />}

            <span className="text-[10px] font-mono uppercase tracking-widest font-bold" style={{ color: theme.textSecondary }}>Savings Vault</span>

            {onBack && (
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback();
                  onBack();
                }}
                className="p-1.5 rounded-xl border cursor-pointer transition-all active:scale-90 shadow-sm"
                style={{
                  backgroundColor: theme.dangerBg,
                  borderColor: `${theme.danger}35`,
                  color: theme.danger
                }}
                title="Close Vault"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div 
            className="p-3 rounded-full border mt-1"
            style={{
              backgroundColor: `${theme.primary}18`,
              borderColor: `${theme.primary}35`,
              color: theme.primary
            }}
          >
            <Key size={24} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-base sm:text-lg font-extrabold tracking-tight" style={{ color: theme.textPrimary }}>Secure Your Vault</h3>
            <p className="text-xs max-w-[240px] leading-relaxed mx-auto mt-1" style={{ color: theme.textSecondary }}>
              {setupStep === 'create' 
                ? 'Create a secure 4-digit passcode for your personal Vault.' 
                : 'Confirm your secure 4-digit passcode.'}
            </p>
          </div>

          {/* PIN Indicators */}
          <div className="flex gap-3 justify-center py-1">
            {[0, 1, 2, 3].map((idx) => (
              <div 
                key={idx} 
                className="w-3.5 h-3.5 rounded-full border transition-all duration-150"
                style={
                  idx < currentLen
                    ? {
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                        transform: 'scale(1.1)',
                        boxShadow: `0 0 10px ${theme.primary}80`
                      }
                    : {
                        backgroundColor: 'transparent',
                        borderColor: theme.borderSubtle
                      }
                }
              />
            ))}
          </div>

          {errMessage && (
            <span 
              className="text-[11px] font-bold font-mono tracking-wide px-3 py-1 rounded-full border"
              style={{
                backgroundColor: theme.dangerBg,
                borderColor: `${theme.danger}40`,
                color: theme.danger
              }}
            >
              {errMessage}
            </span>
          )}

          {/* Balanced numeric keypad grid */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[260px] pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <button
                key={k}
                onClick={() => handleSetupPinPress(k)}
                className="h-13 sm:h-14 rounded-2xl text-lg font-mono flex items-center justify-center cursor-pointer font-bold select-none border transition-all active:scale-95 shadow-sm"
                style={{
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.borderSubtle,
                  color: theme.textPrimary
                }}
              >
                {k}
              </button>
            ))}
            <button
              onClick={() => {
                triggerHapticFeedback();
                setSetupPin('');
                setConfirmPin('');
                setSetupStep('create');
                setErrMessage('');
              }}
              className="h-13 sm:h-14 rounded-2xl text-xs font-mono flex items-center justify-center cursor-pointer font-bold select-none border transition-all active:scale-95"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.textSecondary
              }}
            >
              RESET
            </button>
            <button
              onClick={() => handleSetupPinPress('0')}
              className="h-13 sm:h-14 rounded-2xl text-lg font-mono flex items-center justify-center cursor-pointer font-bold select-none border transition-all active:scale-95 shadow-sm"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              0
            </button>
            <button
              onClick={handleSetupPinBackspace}
              className="h-13 sm:h-14 rounded-2xl text-base font-mono flex items-center justify-center cursor-pointer font-bold select-none border transition-all active:scale-95"
              style={{
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.borderSubtle,
                color: theme.danger
              }}
            >
              <Delete size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden flex flex-col gap-4 select-none relative" style={{ color: theme.textPrimary }}>
      {/* Top Vault Navigation & Control Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: theme.borderSubtle }}>
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            if (onBack) onBack();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 border rounded-2xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm shrink-0"
          style={{
            backgroundColor: theme.surfaceMuted,
            borderColor: theme.borderSubtle,
            color: theme.textPrimary
          }}
        >
          <ArrowLeft size={14} style={{ color: theme.primary }} />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {vaultPassword && (
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setVaultSessionUnlocked(false);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 border rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
              style={{
                backgroundColor: theme.warningBg,
                borderColor: `${theme.warning}35`,
                color: theme.warning
              }}
              title="Lock Vault"
            >
              <Lock size={12} style={{ color: theme.warning }} />
              <span>Lock</span>
            </button>
          )}

          {vaultPassword && (
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setChangePinOld('');
                setChangePinNew('');
                setChangePinConfirm('');
                setChangePinError('');
                setChangePinSuccess('');
                setShowChangePinModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 border rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
              style={{
                backgroundColor: `${theme.primary}18`,
                borderColor: `${theme.primary}35`,
                color: theme.primary
              }}
              title="Change Vault PIN"
            >
              <Key size={12} style={{ color: theme.primary }} />
              <span>Change PIN</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback();
              if (onBack) onBack();
            }}
            className="p-1.5 rounded-xl border cursor-pointer transition-all active:scale-90 shadow-sm shrink-0"
            style={{
              backgroundColor: theme.dangerBg,
              borderColor: `${theme.danger}35`,
              color: theme.danger
            }}
            title="Close Vault"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Visual Celebration Confetti Overlay */}
      <AnimatePresence>
        {completedGoalName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-99 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative w-40 h-40 flex items-center justify-center mb-4">
              <Award size={80} className="text-yellow-400 animate-bounce" />
              <div className="absolute w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping left-10 top-10" />
              <div className="absolute w-2 h-2 rounded-full bg-blue-400 animate-ping right-8 bottom-12" />
              <div className="absolute w-3 h-3 rounded-full bg-emerald-400 animate-ping left-14 bottom-8" />
            </div>
            <span className="text-xl font-extrabold text-white font-display">Goal Fully Met!</span>
            <span className="text-sm text-neutral-300 mt-2 max-w-xs leading-relaxed">
              Congratulations! You saved 100% for <span className="text-emerald-400 font-bold">"{completedGoalName}"</span>. Your discipline is paying off!
            </span>
            <button
              onClick={() => setCompletedGoalName(null)}
              className="mt-6 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 font-bold text-xs rounded-full cursor-pointer text-white flex items-center gap-1.5 shadow-lg shadow-emerald-500/30"
            >
              <Check size={14} /> Close Celebration
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D-Like Isometric Animated Vault Door Centerpiece */}
      <div 
        className="w-full p-5 rounded-[28px] border bg-gradient-to-b from-neutral-900 to-neutral-950 flex flex-col items-center gap-4 relative overflow-hidden shadow-xl" 
        style={{ borderColor: themeBorder }}
      >
        <div className="absolute top-2.5 left-3 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono tracking-widest uppercase text-emerald-400 flex items-center gap-1">
          <ShieldCheck size={11} /> Vault Protection Active
        </div>

        {/* Isometric SVG Vault Door */}
        <div className="relative w-36 h-36 flex items-center justify-center mt-3">
          <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="vault-metallic" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#94A3B8" />
                <stop offset="50%" stopColor="#475569" />
                <stop offset="100%" stopColor="#1E293B" />
              </linearGradient>
              <radialGradient id="inner-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Glowing active field */}
            <circle cx="60" cy="60" r="55" fill="url(#inner-glow)" className={isVaultSpinning ? 'animate-pulse' : ''} />

            {/* Heavy outer door bezel */}
            <circle cx="60" cy="60" r="48" fill="#1E293B" stroke="#475569" strokeWidth="4" />
            
            {/* Rivets around the bezel */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, idx) => {
              const rad = (deg * Math.PI) / 180;
              const x = 60 + 42 * Math.cos(rad);
              const y = 60 + 42 * Math.sin(rad);
              return <circle key={idx} cx={x} cy={y} r="2" fill="#94A3B8" />;
            })}

            {/* Rotating wheel door handle */}
            <g className={isVaultSpinning ? 'animate-vault-spin' : ''} style={{ transformOrigin: '60px 60px' }}>
              <circle cx="60" cy="60" r="32" fill="url(#vault-metallic)" stroke="#1E293B" strokeWidth="2.5" />
              <line x1="60" y1="20" x2="60" y2="100" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
              <line x1="20" y1="60" x2="100" y2="60" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
              <circle cx="60" cy="20" r="5" fill="#64748B" stroke="#94A3B8" />
              <circle cx="60" cy="100" r="5" fill="#64748B" stroke="#94A3B8" />
              <circle cx="20" cy="60" r="5" fill="#64748B" stroke="#94A3B8" />
              <circle cx="100" cy="60" r="5" fill="#64748B" stroke="#94A3B8" />
              <circle cx="60" cy="60" r="12" fill="#0F172A" stroke="#94A3B8" strokeWidth="2" />
              <circle cx="60" cy="60" r="6" fill="#10B981" />
            </g>
          </svg>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[10px] text-neutral-400 tracking-wider font-mono uppercase">
            Total Vault Assets
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <AnimatedTicker
              value={totalSaved}
              currencySymbol={currencySymbol}
              className="text-2xl font-black font-display text-emerald-400"
            />
          </div>
        </div>

        {/* TRANSFER OPERATIONS ACTION ROW */}
        <div className="grid grid-cols-2 gap-3 w-full border-t border-white/5 pt-4 mt-1">
          <button
            type="button"
            onClick={() => openDepositModal('savings')}
            className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-2xl text-emerald-400 text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
          >
            <ArrowUpRight size={15} /> Deposit to Vault
          </button>
          
          <button
            type="button"
            onClick={() => openWithdrawModal()}
            className="py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 rounded-2xl text-rose-400 text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
          >
            <ArrowDownRight size={15} /> Withdraw / Fund
          </button>
        </div>
      </div>

      {/* --- MASTER VAULT HOLDING FUND: SAVINGS --- */}
      <div 
        className="p-4 rounded-2xl border flex flex-col gap-3 relative overflow-hidden shadow-md transition-colors"
        style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }}
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight" style={{ color: theme.textPrimary }}>Savings</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Primary Reserve
                </span>
              </div>
              <span className="text-[10px] mt-0.5 leading-tight" style={{ color: theme.textSecondary }}>
                General vault reserve & preserved money from deleted goals
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-baseline pt-1 border-t" style={{ borderColor: theme.borderSubtle }}>
          <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Unallocated Savings:</span>
          <span className="text-lg font-extrabold font-mono text-emerald-400">
            {currencySymbol}{generalSavings.currentAmount.toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => openDepositModal('savings')}
            className="py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-emerald-400 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
          >
            <ArrowUpRight size={13} /> Deposit to Savings
          </button>
          <button
            type="button"
            disabled={generalSavings.currentAmount <= 0}
            onClick={() => openWithdrawModal('savings')}
            className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 ${
              generalSavings.currentAmount > 0
                ? 'bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 cursor-pointer'
                : 'border cursor-not-allowed opacity-50'
            }`}
            style={
              generalSavings.currentAmount <= 0
                ? {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textMuted
                  }
                : undefined
            }
          >
            <ArrowDownRight size={13} /> Withdraw from Savings
          </button>
        </div>
      </div>

      {/* --- TARGET SAVINGS GOALS SECTION --- */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-semibold tracking-wider uppercase font-mono" style={{ color: theme.textSecondary }}>
            Target Goals ({targetGoals.length})
          </span>
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback();
              setShowAddGoalSheet(true);
            }}
            className="text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
            style={{ color: theme.primary }}
          >
            <Plus size={14} /> New Goal
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {targetGoals.map(goal => {
            const ratio = goal.targetAmount > 0 ? Math.min(goal.currentAmount / goal.targetAmount, 1) : 0;
            const percentage = Math.round(ratio * 100);
            
            let badgeText = 'Starting Out';
            let badgeColor = 'bg-neutral-800 text-neutral-400 border-neutral-700/50';

            if (percentage >= 100) {
              badgeText = 'Goal Smashed!';
              badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse';
            } else if (percentage >= 75) {
              badgeText = 'Almost There!';
              badgeColor = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
            } else if (percentage >= 50) {
              badgeText = 'Halfway Star!';
              badgeColor = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
            } else if (percentage >= 25) {
              badgeText = 'Gaining Pace';
              badgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
            }

            return (
              <div 
                key={goal.id}
                className="p-4 rounded-2xl border flex flex-col gap-3 relative overflow-hidden shadow-md transition-colors"
                style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }}
              >
                {/* Header with Title and Action Buttons (Edit & Delete) */}
                <div className="flex justify-between items-start">
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-bold tracking-tight" style={{ color: theme.textPrimary }}>{goal.name}</span>
                    {goal.deadline && (
                      <span className="text-[10px] font-mono mt-0.5" style={{ color: theme.textSecondary }}>
                        Target deadline: {goal.deadline}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wide ${badgeColor}`}>
                      {badgeText}
                    </span>

                    {/* Edit Goal Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditGoal(goal)}
                      className="p-1.5 rounded-lg border transition-colors cursor-pointer"
                      style={{
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.borderSubtle,
                        color: theme.textPrimary
                      }}
                      title="Edit Goal"
                    >
                      <Pencil size={13} style={{ color: theme.primary }} />
                    </button>

                    {/* Delete Goal Button */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHapticFeedback();
                        setDeletingGoal(goal);
                      }}
                      className="p-1.5 rounded-lg transition-colors cursor-pointer border"
                      style={{
                        backgroundColor: theme.dangerBg,
                        borderColor: `${theme.danger}35`,
                        color: theme.danger
                      }}
                      title="Delete Goal"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Amount details */}
                <div className="flex justify-between items-baseline text-xs font-mono">
                  <span style={{ color: theme.textSecondary }}>
                    Saved: <span className="font-bold" style={{ color: theme.textPrimary }}>{currencySymbol}{goal.currentAmount.toLocaleString()}</span>
                  </span>
                  <span style={{ color: theme.textMuted }}>
                    Target: {currencySymbol}{goal.targetAmount.toLocaleString()} ({percentage}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 rounded-full overflow-hidden relative border" style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: goal.color }}
                  />
                  <div className="absolute inset-y-0 left-[25%] border-r" style={{ borderColor: theme.borderSubtle }} />
                  <div className="absolute inset-y-0 left-[50%] border-r" style={{ borderColor: theme.borderSubtle }} />
                  <div className="absolute inset-y-0 left-[75%] border-r" style={{ borderColor: theme.borderSubtle }} />
                </div>

                {/* Quick Goal Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t" style={{ borderColor: theme.borderSubtle }}>
                  <button
                    type="button"
                    onClick={() => openDepositModal(goal.id)}
                    className="py-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-400 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <ArrowUpRight size={12} /> Add to Goal
                  </button>
                  <button
                    type="button"
                    disabled={goal.currentAmount <= 0}
                    onClick={() => openWithdrawModal(goal.id)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                      goal.currentAmount > 0
                        ? 'bg-rose-500/10 hover:bg-rose-500/15 text-rose-400 cursor-pointer'
                        : 'border opacity-50 cursor-not-allowed'
                    }`}
                    style={
                      goal.currentAmount <= 0
                        ? {
                            backgroundColor: theme.surfaceMuted,
                            borderColor: theme.borderSubtle,
                            color: theme.textMuted
                          }
                        : undefined
                    }
                  >
                    <ArrowDownRight size={12} /> Withdraw
                  </button>
                </div>
              </div>
            );
          })}

          {targetGoals.length === 0 && (
            <div className="text-center py-8 text-neutral-400 bg-white/3 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-2">
              <Sparkles size={24} className="text-emerald-400/60" />
              <span className="text-sm font-medium text-neutral-300">No specific target goals created yet.</span>
              <span className="text-xs text-neutral-500 max-w-xs">
                You can deposit directly to general "Savings", or create dedicated targets for cars, gadgets, travel, and more.
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback();
                  setShowAddGoalSheet(true);
                }}
                className="mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus size={14} /> Create First Goal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* --- VAULT TRANSFER MODAL (DEPOSIT / WITHDRAW) --- */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showTransferModal && (
          <div 
            className="fixed inset-0 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none"
            style={{ backgroundColor: theme.overlay }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 border rounded-[28px] flex flex-col gap-4 text-left shadow-2xl transition-colors"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: theme.borderSubtle }}>
                <span className="text-base font-bold capitalize flex items-center gap-2" style={{ color: theme.textPrimary }}>
                  {transferType === 'deposit' ? (
                    <ArrowUpRight size={18} style={{ color: theme.primary }} />
                  ) : (
                    <ArrowDownRight size={18} className="text-rose-400" />
                  )}
                  Vault {transferType === 'deposit' ? 'Deposit' : 'Withdrawal'}
                </span>
                <button 
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferError('');
                  }} 
                  className="p-1.5 rounded-full transition-colors cursor-pointer border"
                  style={{
                    backgroundColor: theme.dangerBg,
                    borderColor: `${theme.danger}35`,
                    color: theme.danger
                  }}
                  title="Cancel"
                >
                  <X size={15} />
                </button>
              </div>

              {transferError && (
                <div 
                  className="p-3 rounded-xl border text-xs font-medium flex items-center gap-2"
                  style={{
                    backgroundColor: theme.dangerBg,
                    borderColor: `${theme.danger}40`,
                    color: theme.danger
                  }}
                >
                  <ShieldAlert size={16} className="shrink-0 text-rose-400" />
                  <span>{transferError}</span>
                </div>
              )}

              {/* Source/Origin Information */}
              {transferType === 'deposit' ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Source of Funds</span>
                  <div 
                    className="flex items-center gap-2.5 border rounded-xl px-3.5 py-2.5 text-xs"
                    style={{
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.borderSubtle,
                      color: theme.textPrimary
                    }}
                  >
                    <Wallet size={16} style={{ color: theme.primary }} className="shrink-0" />
                    <span className="font-semibold" style={{ color: theme.textPrimary }}>Main App Income / Balance</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Withdraw From (Vault Source)</span>
                  <select
                    value={selectedGoalId}
                    onChange={(e) => setSelectedGoalId(e.target.value)}
                    className="border rounded-xl px-3 py-2.5 text-sm focus:outline-none cursor-pointer"
                    style={{
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary
                    }}
                  >
                    {/* General Savings option */}
                    <option value="savings">
                      Savings (General Vault) - {currencySymbol}{generalSavings.currentAmount.toLocaleString()} available
                    </option>
                    {/* Active target goals */}
                    {targetGoals.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} - {currencySymbol}{g.currentAmount.toLocaleString()} available
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Destination Information */}
              {transferType === 'deposit' ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Deposit Into (Vault Destination)</span>
                  <select
                    value={selectedGoalId}
                    onChange={(e) => setSelectedGoalId(e.target.value)}
                    className="border rounded-xl px-3 py-2.5 text-sm focus:outline-none cursor-pointer"
                    style={{
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary
                    }}
                  >
                    <option value="savings">Savings (General Vault Reserve)</option>
                    {targetGoals.map(g => (
                      <option key={g.id} value={g.id}>
                        Goal: {g.name} ({currencySymbol}{g.currentAmount.toLocaleString()} saved)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Destination</span>
                  <div 
                    className="flex items-center gap-2.5 border rounded-xl px-3.5 py-2.5 text-xs"
                    style={{
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.borderSubtle,
                      color: theme.textPrimary
                    }}
                  >
                    <Wallet size={16} style={{ color: theme.primary }} className="shrink-0" />
                    <span className="font-semibold" style={{ color: theme.textPrimary }}>Main App Income / Balance</span>
                  </div>
                </div>
              )}

              {/* Amount Entry */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Amount to Transfer</span>
                  {transferType === 'withdraw' && (() => {
                    const currentSelected = savingsGoals.find(g => g.id === selectedGoalId) || (selectedGoalId === 'savings' ? generalSavings : null);
                    return currentSelected ? (
                      <button
                        type="button"
                        onClick={() => setTransferAmount(currentSelected.currentAmount.toString())}
                        className="text-[10px] font-bold cursor-pointer"
                        style={{ color: theme.primary }}
                      >
                        Max: {currencySymbol}{currentSelected.currentAmount.toLocaleString()}
                      </button>
                    ) : null;
                  })()}
                </div>
                <div 
                  className="flex items-center gap-2 border rounded-xl px-3.5 py-2.5"
                  style={{
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder
                  }}
                >
                  <span className="font-mono font-bold" style={{ color: theme.textSecondary }}>{currencySymbol}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="bg-transparent flex-1 text-sm font-mono outline-none"
                    style={{ color: theme.textPrimary }}
                    autoFocus
                  />
                </div>
              </div>

              {transferType === 'withdraw' && (
                <div 
                  className="p-3 border rounded-xl text-[10px] leading-relaxed flex gap-2"
                  style={{
                    backgroundColor: theme.warningBg,
                    borderColor: `${theme.warning}40`,
                    color: theme.warning
                  }}
                >
                  <ShieldAlert size={16} className="shrink-0 text-amber-400" />
                  <span>Withdrawn funds will be immediately credited back to your Main App Income / Balance.</span>
                </div>
              )}

              {/* Buttons: Cancel and Action */}
              <div className="grid grid-cols-2 gap-3 mt-1 pt-2 border-t" style={{ borderColor: theme.borderSubtle }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="py-2.5 border rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTransferSubmit}
                  className="py-2.5 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md"
                  style={{
                    backgroundColor: transferType === 'deposit' ? theme.primary : theme.danger,
                    color: '#FFFFFF'
                  }}
                >
                  {transferType === 'deposit' ? (
                    <>
                      <ArrowUpRight size={15} /> Complete Deposit
                    </>
                  ) : (
                    <>
                      <ArrowDownRight size={15} /> Complete Withdrawal
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* --- ADD NEW SAVINGS GOAL MODAL --- */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showAddGoalSheet && (
          <div 
            className="fixed inset-0 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none"
            style={{ backgroundColor: theme.overlay }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 border rounded-[28px] flex flex-col gap-4 text-left shadow-2xl transition-colors"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: theme.borderSubtle }}>
                <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: theme.textPrimary }}>
                  <Plus size={16} style={{ color: theme.primary }} /> New Vault Goal
                </span>
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddGoalSheet(false);
                    setAddGoalError('');
                  }} 
                  className="p-1.5 rounded-full transition-colors cursor-pointer border"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
                  title="Cancel"
                >
                  <X size={15} />
                </button>
              </div>

              {addGoalError && (
                <div 
                  className="p-3 border rounded-xl text-xs font-medium flex items-center gap-2"
                  style={{
                    backgroundColor: theme.dangerBg,
                    borderColor: `${theme.danger}40`,
                    color: theme.danger
                  }}
                >
                  <ShieldAlert size={16} className="shrink-0 text-rose-400" />
                  <span>{addGoalError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Goal Name</span>
                <input
                  type="text"
                  placeholder="e.g. Dream Electric Car, Laptop..."
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="border rounded-xl px-3 py-2 text-sm focus:outline-none transition-colors"
                  style={{
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary
                  }}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Target Amount ({currencySymbol})</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="2500"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none transition-colors"
                    style={{
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary
                    }}
                  />
                </div>
                
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Deadline (Optional)</span>
                  <input
                    type="date"
                    value={goalDeadline}
                    onChange={(e) => setGoalDeadline(e.target.value)}
                    className="border rounded-xl px-2.5 py-2 text-xs focus:outline-none cursor-pointer transition-colors"
                    style={{
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary
                    }}
                  />
                </div>
              </div>

              {/* Theme Color selector */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Theme Progress Color</span>
                <div className="flex gap-2.5 flex-wrap pt-1">
                  {HARMONIOUS_GOAL_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setGoalColor(color)}
                      className={`w-7 h-7 rounded-full border border-white/20 transition-transform ${goalColor === color ? 'scale-125 ring-2 ring-white' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t" style={{ borderColor: theme.borderSubtle }}>
                <button
                  type="button"
                  onClick={() => setShowAddGoalSheet(false)}
                  className="py-2.5 border rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddGoalSubmit}
                  className="py-2.5 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.primary,
                    color: theme.textOnPrimary || '#FFFFFF'
                  }}
                >
                  <Check size={14} strokeWidth={3} /> Create Goal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* --- EDIT SAVINGS GOAL MODAL --- */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {editingGoal && (
          <div 
            className="fixed inset-0 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none"
            style={{ backgroundColor: theme.overlay }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 border rounded-[28px] flex flex-col gap-4 text-left shadow-2xl transition-colors"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: theme.borderSubtle }}>
                <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: theme.textPrimary }}>
                  <Pencil size={15} style={{ color: theme.primary }} /> Edit Goal Details
                </span>
                <button 
                  type="button"
                  onClick={() => {
                    setEditingGoal(null);
                    setEditGoalError('');
                  }} 
                  className="p-1.5 rounded-full transition-colors cursor-pointer border"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
                  title="Cancel"
                >
                  <X size={15} />
                </button>
              </div>

              {editGoalError && (
                <div 
                  className="p-3 border rounded-xl text-xs font-medium flex items-center gap-2"
                  style={{
                    backgroundColor: theme.dangerBg,
                    borderColor: `${theme.danger}40`,
                    color: theme.danger
                  }}
                >
                  <ShieldAlert size={16} className="shrink-0 text-rose-400" />
                  <span>{editGoalError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Goal Name</span>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="border rounded-xl px-3 py-2 text-sm focus:outline-none transition-colors"
                  style={{
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Target ({currencySymbol})</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={editTarget}
                    onChange={(e) => setEditTarget(e.target.value)}
                    className="border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none transition-colors"
                    style={{
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary
                    }}
                  />
                </div>
                
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Deadline (Optional)</span>
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="border rounded-xl px-2.5 py-2 text-xs focus:outline-none cursor-pointer transition-colors"
                    style={{
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary
                    }}
                  />
                </div>
              </div>

              {/* Theme Color selector */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>Theme Progress Color</span>
                <div className="flex gap-2.5 flex-wrap pt-1">
                  {HARMONIOUS_GOAL_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditColor(color)}
                      className={`w-7 h-7 rounded-full border border-white/20 transition-transform ${editColor === color ? 'scale-125 ring-2 ring-white' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t" style={{ borderColor: theme.borderSubtle }}>
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="py-2.5 border rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGoalEdit}
                  className="py-2.5 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.primary,
                    color: theme.textOnPrimary || '#FFFFFF'
                  }}
                >
                  <Check size={14} strokeWidth={3} /> Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* --- DELETE GOAL CONFIRMATION DIALOG --- */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deletingGoal && (
          <div 
            className="fixed inset-0 backdrop-blur-md z-60 flex items-center justify-center p-4 select-none"
            style={{ backgroundColor: theme.overlay }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 border rounded-[28px] flex flex-col gap-4 text-left shadow-2xl transition-colors"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="p-3 rounded-2xl border shrink-0"
                  style={{
                    backgroundColor: theme.dangerBg,
                    borderColor: `${theme.danger}40`,
                    color: theme.danger
                  }}
                >
                  <Trash2 size={24} />
                </div>
                <div className="flex flex-col">
                  <h4 className="text-base font-bold" style={{ color: theme.textPrimary }}>Delete Vault Goal</h4>
                  <span className="text-xs" style={{ color: theme.textSecondary }}>"{deletingGoal.name}"</span>
                </div>
              </div>

              {/* Crucial Guarantee Note */}
              <div 
                className="p-3.5 border rounded-2xl flex flex-col gap-1 text-xs leading-relaxed"
                style={{
                  backgroundColor: `${theme.primary}12`,
                  borderColor: `${theme.primary}30`,
                  color: theme.textPrimary
                }}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs" style={{ color: theme.primary }}>
                  <ShieldCheck size={15} /> Safe Assets Guarantee
                </div>
                <span style={{ color: theme.textSecondary }}>
                  Deleting this goal will <strong>NOT</strong> delete or remove your money. Any saved funds (
                  <strong style={{ color: theme.textPrimary }}>{currencySymbol}{deletingGoal.currentAmount.toLocaleString()}</strong>
                  ) will automatically be preserved in your vault under <strong>'Savings'</strong>.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setDeletingGoal(null)}
                  className="py-2.5 border rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteGoal}
                  className="py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.danger
                  }}
                >
                  <Trash2 size={14} /> Delete & Keep Funds
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* --- CHANGE VAULT PIN MODAL --- */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showChangePinModal && (
          <div 
            className="fixed inset-0 backdrop-blur-md z-[95] flex items-center justify-center p-4 select-none"
            style={{ backgroundColor: theme.overlay }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 border rounded-[28px] flex flex-col gap-4 text-left shadow-2xl transition-colors"
              style={{
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                color: theme.textPrimary
              }}
            >
              <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: theme.borderSubtle }}>
                <div className="flex items-center gap-2.5">
                  <div 
                    className="p-2 rounded-xl border"
                    style={{
                      backgroundColor: `${theme.primary}18`,
                      borderColor: `${theme.primary}35`,
                      color: theme.primary
                    }}
                  >
                    <Key size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>Change Vault Passcode</span>
                    <span className="text-[10px]" style={{ color: theme.textSecondary }}>Update your 4-digit security PIN</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setShowChangePinModal(false);
                  }} 
                  className="p-1.5 rounded-full transition-colors cursor-pointer border"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
                  title="Cancel"
                >
                  <X size={15} />
                </button>
              </div>

              {changePinSuccess && (
                <div 
                  className="p-3 border rounded-xl text-xs font-bold flex items-center gap-2"
                  style={{
                    backgroundColor: theme.successBg,
                    borderColor: `${theme.success}40`,
                    color: theme.success
                  }}
                >
                  <Check size={16} /> {changePinSuccess}
                </div>
              )}

              {changePinError && (
                <div 
                  className="p-3 border rounded-xl text-xs font-medium flex items-center gap-2"
                  style={{
                    backgroundColor: theme.dangerBg,
                    borderColor: `${theme.danger}40`,
                    color: theme.danger
                  }}
                >
                  <ShieldAlert size={16} className="shrink-0 text-rose-400" /> {changePinError}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: theme.textSecondary }}>Current 4-Digit Passcode</label>
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    placeholder="••••"
                    value={changePinOld}
                    onChange={(e) => setChangePinOld(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="border rounded-xl px-3.5 py-2.5 text-base text-center font-mono tracking-widest focus:outline-none transition-colors"
                    style={{
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary
                    }}
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: theme.textSecondary }}>New 4-Digit Passcode</label>
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    placeholder="••••"
                    value={changePinNew}
                    onChange={(e) => setChangePinNew(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="border rounded-xl px-3.5 py-2.5 text-base text-center font-mono tracking-widest focus:outline-none transition-colors"
                    style={{
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: theme.textSecondary }}>Confirm New Passcode</label>
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    placeholder="••••"
                    value={changePinConfirm}
                    onChange={(e) => setChangePinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="border rounded-xl px-3.5 py-2.5 text-base text-center font-mono tracking-widest focus:outline-none transition-colors"
                    style={{
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t" style={{ borderColor: theme.borderSubtle }}>
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setShowChangePinModal(false);
                  }}
                  className="py-2.5 border rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.borderSubtle,
                    color: theme.textSecondary
                  }}
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleChangePinSubmit}
                  className="py-2.5 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                  style={{
                    backgroundColor: theme.primary,
                    color: theme.textOnPrimary || '#FFFFFF'
                  }}
                >
                  <Check size={14} strokeWidth={3} /> Update PIN
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

