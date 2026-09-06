/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  ShieldCheck, Plus, ArrowRightLeft, Sparkles, Award, ShieldAlert, 
  ArrowUpRight, ArrowDownRight, Lock, Unlock, Key, Vault, Delete 
} from 'lucide-react';
import { SavingsGoal, Wallet } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import AnimatedTicker from './AnimatedTicker';

interface SavingsTabProps {
  savingsGoals: SavingsGoal[];
  wallets: Wallet[];
  currencySymbol: string;
  onTransferToSavings: (goalId: string, amount: number, fromWalletId: string) => void;
  onWithdrawFromSavings: (goalId: string, amount: number, toWalletId: string) => void;
  onAddGoal: (goal: Omit<SavingsGoal, 'id' | 'currentAmount'>) => void;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
  themePrimary: string;
  vaultPassword?: string;
  onSetVaultPassword: (password: string) => void;
}

import { triggerHapticFeedback } from '../utils/haptics';

export default function SavingsTab({
  savingsGoals,
  wallets,
  currencySymbol,
  onTransferToSavings,
  onWithdrawFromSavings,
  onAddGoal,
  themeCardBg,
  themeBorder,
  themeRadius,
  themePrimary,
  vaultPassword,
  onSetVaultPassword
}: SavingsTabProps) {
  // Vault Isolation PIN locks state
  const [vaultSessionUnlocked, setVaultSessionUnlocked] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [errMessage, setErrMessage] = useState('');

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferType, setTransferType] = useState<'deposit' | 'withdraw'>('deposit');
  const [selectedGoalId, setSelectedGoalId] = useState(savingsGoals[0]?.id || '');
  const [transferAmount, setTransferAmount] = useState('');
  const [fromWalletId, setFromWalletId] = useState(wallets[0]?.id || '');

  // Add goal sheet state
  const [showAddGoalSheet, setShowAddGoalSheet] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalColor, setGoalColor] = useState('#8B5CF6');
  const [goalDeadline, setGoalDeadline] = useState('');

  // Spinning vault state
  const [isVaultSpinning, setIsVaultSpinning] = useState(false);

  // Confetti trigger goal ID
  const [completedGoalName, setCompletedGoalName] = useState<string | null>(null);

  // Safe variables
  const activeGoal = savingsGoals.find(g => g.id === selectedGoalId);

  // Total saved
  const totalSaved = savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0);

  const handleTransferSubmit = () => {
    triggerHapticFeedback();
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    // Trigger visual vault spin
    setIsVaultSpinning(true);
    setTimeout(() => {
      setIsVaultSpinning(false);
    }, 2500);

    const goalBefore = savingsGoals.find(g => g.id === selectedGoalId);

    if (transferType === 'deposit') {
      onTransferToSavings(selectedGoalId, amt, fromWalletId);
      
      // Check if newly 100% saved to trigger confetti celebration!
      if (goalBefore && (goalBefore.currentAmount + amt >= goalBefore.targetAmount) && (goalBefore.currentAmount < goalBefore.targetAmount)) {
        setCompletedGoalName(goalBefore.name);
        setTimeout(() => setCompletedGoalName(null), 5000); // clear after 5s
      }
    } else {
      onWithdrawFromSavings(selectedGoalId, amt, fromWalletId); // here fromWalletId is the target wallet
    }

    setTransferAmount('');
    setShowTransferModal(false);
  };

  const handleAddGoalSubmit = () => {
    triggerHapticFeedback();
    const target = parseFloat(goalTarget);
    if (!goalName.trim() || isNaN(target) || target <= 0) {
      alert('Please fill out all fields with valid values.');
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
    setShowAddGoalSheet(false);
  };

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
      <div className="w-full flex flex-col items-center justify-center py-8 select-none">
        <div 
          className="w-full max-w-sm p-6 rounded-[28px] border text-center flex flex-col items-center gap-5"
          style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}
        >
          <div className="p-4 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">
            <Lock size={36} />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-lg font-extrabold text-white tracking-tight">Vault Isolated</h3>
            <p className="text-xs text-neutral-400 max-w-[240px] leading-relaxed mx-auto">
              Please enter your secure Vault passcode to access your savings goals.
            </p>
          </div>

          {/* PIN Indicators */}
          <div className="flex gap-4.5 justify-center py-2">
            {[0, 1, 2, 3].map((idx) => (
              <div 
                key={idx} 
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                  idx < inputPin.length 
                    ? 'bg-purple-500 border-purple-400 scale-110 shadow-[0_0_8px_rgba(139,92,246,0.6)]' 
                    : 'bg-transparent border-neutral-600'
                }`}
              />
            ))}
          </div>

          {errMessage && (
            <span className="text-[10px] text-rose-400 font-bold font-mono tracking-wide bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 animate-bounce">
              {errMessage}
            </span>
          )}

          {/* Numeric keypad grid */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[240px] pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <button
                key={k}
                onClick={() => handleUnlockPinPress(k)}
                className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-lg font-mono flex items-center justify-center cursor-pointer font-bold select-none text-white border border-white/5 transition-all active:scale-90"
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
              className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 text-xs font-mono flex items-center justify-center cursor-pointer font-bold select-none text-neutral-400 border border-white/5 transition-all"
            >
              C
            </button>
            <button
              onClick={() => handleUnlockPinPress('0')}
              className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 text-lg font-mono flex items-center justify-center cursor-pointer font-bold select-none text-white border border-white/5 transition-all active:scale-90"
            >
              0
            </button>
            <button
              onClick={handleUnlockPinBackspace}
              className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 text-lg font-mono flex items-center justify-center cursor-pointer font-bold select-none text-neutral-400 border border-white/5 transition-all"
            >
              <Delete size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If password NOT set:
  if (!vaultPassword) {
    const currentLen = setupStep === 'create' ? setupPin.length : confirmPin.length;
    return (
      <div className="w-full flex flex-col items-center justify-center py-8 select-none">
        <div 
          className="w-full max-w-sm p-6 rounded-[28px] border text-center flex flex-col items-center gap-5"
          style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}
        >
          <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
            <Key size={36} />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-lg font-extrabold text-white tracking-tight">Secure Your Vault</h3>
            <p className="text-xs text-neutral-400 max-w-[240px] leading-relaxed mx-auto">
              {setupStep === 'create' 
                ? 'Create a secure 4-digit passcode for your personal Vault.' 
                : 'Confirm your secure 4-digit passcode.'}
            </p>
          </div>

          {/* PIN Indicators */}
          <div className="flex gap-4.5 justify-center py-2">
            {[0, 1, 2, 3].map((idx) => (
              <div 
                key={idx} 
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                  idx < currentLen 
                    ? 'bg-emerald-500 border-emerald-400 scale-110 shadow-[0_0_8px_rgba(16,185,129,0.6)]' 
                    : 'bg-transparent border-neutral-600'
                }`}
              />
            ))}
          </div>

          {errMessage && (
            <span className="text-[10px] text-rose-400 font-bold font-mono tracking-wide bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              {errMessage}
            </span>
          )}

          {/* Numeric keypad grid */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[240px] pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <button
                key={k}
                onClick={() => handleSetupPinPress(k)}
                className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-lg font-mono flex items-center justify-center cursor-pointer font-bold select-none text-white border border-white/5 transition-all active:scale-90"
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
              className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 text-xs font-mono flex items-center justify-center cursor-pointer font-bold select-none text-neutral-400 border border-white/5 transition-all"
            >
              C
            </button>
            <button
              onClick={() => handleSetupPinPress('0')}
              className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 text-lg font-mono flex items-center justify-center cursor-pointer font-bold select-none text-white border border-white/5 transition-all active:scale-90"
            >
              0
            </button>
            <button
              onClick={handleSetupPinBackspace}
              className="w-16 h-16 rounded-full bg-white/5 hover:bg-white/10 text-lg font-mono flex items-center justify-center cursor-pointer font-bold select-none text-neutral-400 border border-white/5 transition-all"
            >
              <Delete size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5 select-none relative">
      {/* Visual Celebration Confetti Overlay */}
      <AnimatePresence>
        {completedGoalName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-99 flex flex-col items-center justify-center p-6 text-center"
          >
            {/* Standard CSS Fireworks / Confetti particles */}
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
              className="mt-6 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 font-bold text-xs rounded-full cursor-pointer text-white"
            >
              Close Celebration
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D-Like Isometric Animated Vault Door Centerpiece */}
      <div className={`w-full p-5 rounded-[28px] border bg-gradient-to-b from-neutral-900 to-neutral-950 flex flex-col items-center gap-4 relative overflow-hidden`} style={{ borderColor: themeBorder }}>
        <div className="absolute top-2.5 left-3 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono tracking-widest uppercase">
          Vault Protection Active
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

            {/* The primary rotating wheel door handle */}
            <g className={isVaultSpinning ? 'animate-vault-spin' : ''} style={{ transformOrigin: '60px 60px' }}>
              {/* Spinning wheel spoke plate */}
              <circle cx="60" cy="60" r="32" fill="url(#vault-metallic)" stroke="#1E293B" strokeWidth="2.5" />
              
              {/* Spokes */}
              <line x1="60" y1="20" x2="60" y2="100" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
              <line x1="20" y1="60" x2="100" y2="60" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
              
              {/* Spokes tips handles */}
              <circle cx="60" cy="20" r="5" fill="#64748B" stroke="#94A3B8" />
              <circle cx="60" cy="100" r="5" fill="#64748B" stroke="#94A3B8" />
              <circle cx="20" cy="60" r="5" fill="#64748B" stroke="#94A3B8" />
              <circle cx="100" cy="60" r="5" fill="#64748B" stroke="#94A3B8" />

              {/* Central hub cap */}
              <circle cx="60" cy="60" r="12" fill="#0F172A" stroke="#94A3B8" strokeWidth="2" />
              <circle cx="60" cy="60" r="6" fill="#10B981" />
            </g>
          </svg>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[10px] text-neutral-400 tracking-wider font-mono">Isolated Vault Assets</span>
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
            onClick={() => {
              setTransferType('deposit');
              setShowTransferModal(true);
              triggerHapticFeedback();
            }}
            className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 rounded-2xl text-emerald-400 text-xs font-bold tracking-wide flex items-center justify-center gap-1 cursor-pointer"
          >
            <ArrowUpRight size={14} /> Deposit to Vault
          </button>
          
          <button
            onClick={() => {
              setTransferType('withdraw');
              setShowTransferModal(true);
              triggerHapticFeedback();
            }}
            className="py-2.5 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 rounded-2xl text-rose-400 text-xs font-bold tracking-wide flex items-center justify-center gap-1 cursor-pointer"
          >
            <ArrowDownRight size={14} /> Withdraw/Fund
          </button>
        </div>
      </div>

      {/* SAVINGS GOALS (GAMIFIED STACKED LIST WITH achievement badges) */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-semibold tracking-wider opacity-60 uppercase">
            Active Vault Goals
          </span>
          <button
            onClick={() => setShowAddGoalSheet(true)}
            className="text-xs text-emerald-400 font-bold flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Plus size={14} /> New Goal
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {savingsGoals.map(goal => {
            const ratio = goal.targetAmount > 0 ? Math.min(goal.currentAmount / goal.targetAmount, 1) : 0;
            const percentage = Math.round(ratio * 100);
            
            // Custom descriptive gamified achievement badges requested
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
                className="p-4 rounded-2xl border border-white/5 flex flex-col gap-3 relative overflow-hidden"
                style={{ backgroundColor: themeCardBg }}
              >
                {/* Horizontal status line */}
                <div className="flex justify-between items-center">
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-bold tracking-tight text-white">{goal.name}</span>
                    {goal.deadline && (
                      <span className="text-[9px] text-neutral-400 font-mono mt-0.5">Target deadline: {goal.deadline}</span>
                    )}
                  </div>
                  
                  {/* Gamified badge */}
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wide ${badgeColor}`}>
                    {badgeText}
                  </span>
                </div>

                {/* Accumulated Balance line */}
                <div className="flex justify-between items-baseline text-xs font-mono">
                  <span className="text-neutral-400">
                    Saved: <span className="font-bold text-white">{currencySymbol}{goal.currentAmount.toLocaleString()}</span>
                  </span>
                  <span className="text-neutral-500">
                    Goal: {currencySymbol}{goal.targetAmount.toLocaleString()}
                  </span>
                </div>

                {/* Custom stacked visual progress gauge */}
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: goal.color }}
                  />
                  {/* Progress lines markers */}
                  <div className="absolute inset-y-0 left-[25%] border-r border-white/10" />
                  <div className="absolute inset-y-0 left-[50%] border-r border-white/10" />
                  <div className="absolute inset-y-0 left-[75%] border-r border-white/10" />
                </div>
              </div>
            );
          })}

          {savingsGoals.length === 0 && (
            <div className="text-center py-8 text-neutral-500">
              No active goals in your vault yet.
            </div>
          )}
        </div>
      </div>

      {/* --- VAULT TRANSFER POPUP DIALOG --- */}
      <AnimatePresence>
        {showTransferModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-[24px] flex flex-col gap-4 text-white"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-base font-bold capitalize flex items-center gap-1">
                  <ArrowRightLeft size={16} className="text-emerald-400" />
                  Vault {transferType}
                </span>
                <button onClick={() => setShowTransferModal(false)} className="text-neutral-400 hover:text-white">
                  Close
                </button>
              </div>

              {/* Goal Selector */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-400">Select Target Goal</span>
                <select
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                >
                  {savingsGoals.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({currencySymbol}{g.currentAmount})</option>
                  ))}
                </select>
              </div>

              {/* Amount Entry */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-400">Amount to Transfer ({currencySymbol})</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="bg-neutral-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono"
                />
              </div>

              {/* Wallet Origin/Destination */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-400">
                  {transferType === 'deposit' ? 'Deduct from Wallet' : 'Credit back to Wallet'}
                </span>
                <select
                  value={fromWalletId}
                  onChange={(e) => setFromWalletId(e.target.value)}
                  className="bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                >
                  {wallets.filter(w => w.type !== 'savings').map(w => (
                    <option key={w.id} value={w.id}>{w.name} (Bal: {currencySymbol}{w.balance})</option>
                  ))}
                </select>
              </div>

              {transferType === 'withdraw' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-[10px] leading-relaxed flex gap-2">
                  <ShieldAlert size={16} className="flex-shrink-0" />
                  <span>Withdrawals from Savings to fund Checkings will be clearly logged in logs to maintain dual-integrity records.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferSubmit}
                  className="py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-bold text-white cursor-pointer"
                >
                  Complete Transfer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ADD NEW SAVINGS GOAL CABINET --- */}
      <AnimatePresence>
        {showAddGoalSheet && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-neutral-900 border border-white/10 rounded-[24px] flex flex-col gap-4 text-white"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-sm font-bold">New Vault Goal</span>
                <button onClick={() => setShowAddGoalSheet(false)} className="text-neutral-400 hover:text-white">
                  <Plus className="rotate-45" size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-400">Goal Name / Fund Target</span>
                <input
                  type="text"
                  placeholder="e.g. Dream Electric Car, Laptop..."
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-neutral-400">Target amount ({currencySymbol})</span>
                  <input
                    type="number"
                    placeholder="2500"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="bg-neutral-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
                
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-neutral-400">Deadline (Optional)</span>
                  <input
                    type="date"
                    value={goalDeadline}
                    onChange={(e) => setGoalDeadline(e.target.value)}
                    className="bg-neutral-800 border border-white/10 rounded-xl px-2 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Theme Color selector for goal progress bar */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-400">Theme bar color</span>
                <div className="flex gap-2.5 flex-wrap">
                  {['#8B5CF6', '#10B981', '#3B82F6', '#EC4899', '#EF4444', '#14B8A6'].map(color => (
                    <button
                      key={color}
                      onClick={() => setGoalColor(color)}
                      className={`w-7 h-7 rounded-full border border-white/20 transition-transform ${goalColor === color ? 'scale-125 ring-2 ring-white' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleAddGoalSubmit}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold text-sm text-white mt-2 cursor-pointer"
              >
                Create Vault Goal
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
