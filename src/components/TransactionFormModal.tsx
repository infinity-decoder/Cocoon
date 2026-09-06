/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Calendar, Image, FileText, Check, ChevronRight, CornerDownRight, Landmark } from 'lucide-react';
import { Category, Wallet, Transaction, TransactionType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import * as LucideIcons from 'lucide-react';

interface TransactionFormModalProps {
  isOpen: boolean;
  type: TransactionType;
  onClose: () => void;
  onSave: (transactionData: Partial<Transaction>) => void;
  categories: Category[];
  subCategories: Category[];
  wallets: Wallet[];
  paymentMethods: string[];
  currencySymbol: string;
  themeRadius: string;
  themePrimary: string;
  themeCardBg: string;
  themeBorder: string;
  isInline?: boolean;
}

import { triggerHapticFeedback } from '../utils/haptics';

export default function TransactionFormModal({
  isOpen,
  type,
  onClose,
  onSave,
  categories,
  subCategories,
  wallets,
  paymentMethods,
  currencySymbol,
  themeRadius,
  themePrimary,
  themeCardBg,
  themeBorder,
  isInline = false
}: TransactionFormModalProps) {
  // Local form state
  const [amountStr, setAmountStr] = useState('0');
  const [note, setNote] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubCategoryName, setSelectedSubCategoryName] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [selectedToWalletId, setSelectedToWalletId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0] || 'Cash');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
  const [attachmentBase64, setAttachmentBase64] = useState<string>('');

  // Interactive Bottom sheets
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showCustomCatSheet, setShowCustomCatSheet] = useState(false);
  
  // Custom Category State
  const [customCatName, setCustomCatName] = useState('');
  const [customCatColor, setCustomCatColor] = useState('#EC4899');
  const [customCatIcon, setCustomCatIcon] = useState('Heart');

  // Swipe to confirm slider state
  const [sliderProgress, setSliderProgress] = useState(0); // 0 to 100
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Filters categories based on TransactionType
  const filteredCategories = categories.filter(c => c.type === (type === 'income' ? 'income' : 'expense') && c.isEnabled);
  const activeCategory = categories.find(c => c.id === selectedCategoryId);
  const subCatsForActive = subCategories.filter(sc => sc.parentId === selectedCategoryId && sc.isEnabled);

  useEffect(() => {
    if (isOpen) {
      // Set default category
      if (filteredCategories.length > 0) {
        setSelectedCategoryId(filteredCategories[0].id);
      }
      // Reset form variables
      setAmountStr('0');
      setNote('');
      setSelectedSubCategoryName('');
      setAttachmentBase64('');
      setSliderProgress(0);
    }
  }, [isOpen, type]);

  // Draggable slider confirmation handler
  const handleSliderStart = () => {
    isDraggingRef.current = true;
    triggerHapticFeedback();
  };

  const handleSliderMove = (clientX: number) => {
    if (!isDraggingRef.current || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const handleWidth = 54;
    const maxDistance = rect.width - handleWidth;
    const relativeX = clientX - rect.left - handleWidth / 2;
    const progress = Math.min(Math.max((relativeX / maxDistance) * 100, 0), 100);
    setSliderProgress(progress);

    // If fully slid to end, confirm and complete
    if (progress >= 98) {
      isDraggingRef.current = false;
      setSliderProgress(100);
      confirmSave();
    }
  };

  const handleSliderEnd = () => {
    isDraggingRef.current = false;
    if (sliderProgress < 98) {
      // Snap back if not reached the end
      setSliderProgress(0);
    }
  };

  const confirmSave = () => {
    triggerHapticFeedback();
    
    const finalAmount = parseFloat(amountStr) || 0;
    if (finalAmount <= 0) {
      alert('Please enter a valid amount.');
      setSliderProgress(0);
      return;
    }

    onSave({
      type,
      amount: finalAmount,
      date: new Date(date).toISOString(),
      note: note.trim(),
      category: activeCategory?.name || 'Uncategorized',
      subCategory: selectedSubCategoryName || undefined,
      walletId: selectedWalletId,
      toWalletId: type === 'transfer' ? selectedToWalletId : undefined,
      paymentMethod,
      attachment: attachmentBase64 || undefined,
      isRecurring: false,
      recurrence: undefined
    });

    onClose();
  };

  // Base64 file converter for simulated receipts
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentBase64(reader.result as string);
        triggerHapticFeedback();
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isInline && !isOpen) return null;

  const formElement = (
    <div
      className={`w-full ${isInline ? 'p-1' : 'h-[92vh] overflow-y-auto rounded-t-[32px] p-6 shadow-2xl relative'}`}
      style={{ backgroundColor: isInline ? 'transparent' : themeCardBg, color: '#FFF' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-white/5">
        <div className="flex flex-col">
          <span className="text-xs text-neutral-400 font-mono tracking-widest uppercase">
            New Transaction
          </span>
          <span className="text-xl font-bold tracking-tight mt-0.5 capitalize">
            Add {type}
          </span>
        </div>
        {!isInline && (
          <button 
            onClick={onClose}
            className="p-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Form Content */}
      <div className="flex flex-col gap-4 py-4 scrollbar-none">
        {/* LARGE AMOUNT INPUT CONTAINER */}
        <div 
          className="flex flex-col items-center justify-center p-5 bg-white/3 border border-white/5 rounded-2xl relative"
        >
          <span className="text-xs text-neutral-400 uppercase tracking-wider font-mono mb-2">Amount Entry</span>
          <div className="flex items-center justify-center gap-1.5 w-full">
            <span className="text-3xl font-light text-neutral-300 font-mono">{currencySymbol}</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="0"
              value={amountStr === '0' ? '' : amountStr}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setAmountStr('0');
                } else {
                  const parts = val.split('.');
                  if (parts[1] && parts[1].length > 2) {
                    setAmountStr(parseFloat(val).toFixed(2));
                  } else {
                    setAmountStr(val);
                  }
                }
              }}
              className="text-4xl md:text-5xl font-extrabold font-mono tracking-tight text-white bg-transparent outline-none border-none text-center w-full max-w-[240px] placeholder:text-neutral-600 focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />
          </div>
        </div>

        {/* DESCRIPTION/NOTE */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400 font-medium">Description Note</span>
          <div className="flex items-center gap-2 bg-white/3 border border-white/5 rounded-xl px-3 py-2.5">
            <FileText size={16} className="text-neutral-400" />
            <input
              type="text"
              placeholder="e.g. Weekly organic groceries..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-transparent flex-1 text-sm outline-none placeholder:text-neutral-500 text-white"
            />
          </div>
        </div>

        {/* CATEGORY & SUBCATEGORY PICKER */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400 font-medium">Category</span>
            <button
              onClick={() => setShowCategorySheet(true)}
              className="flex items-center justify-between bg-white/3 border border-white/5 hover:bg-white/5 transition-colors rounded-xl px-3 py-2.5 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                {activeCategory && (() => {
                  const IconComponent = (LucideIcons as any)[activeCategory.icon] || LucideIcons.HelpCircle;
                  return (
                    <div 
                      className="p-1 rounded-lg text-white"
                      style={{ backgroundColor: activeCategory.color }}
                    >
                      <IconComponent size={14} />
                    </div>
                  );
                })()}
                <span className="text-sm font-medium text-white truncate">
                  {activeCategory ? activeCategory.name : 'Select'}
                </span>
              </div>
              <ChevronRight size={14} className="text-neutral-400" />
            </button>
          </div>

          {/* Sub-category if active category has subcategories */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400 font-medium">Sub-Category</span>
            <select
              disabled={!selectedCategoryId || subCatsForActive.length === 0}
              value={selectedSubCategoryName}
              onChange={(e) => setSelectedSubCategoryName(e.target.value)}
              className="bg-neutral-900 border border-white/5 text-sm rounded-xl px-3 py-2.5 outline-none text-white cursor-pointer disabled:opacity-40"
            >
              <option value="">None</option>
              {subCatsForActive.map(sc => (
                <option key={sc.id} value={sc.name}>{sc.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* WALLET & PAYMENT METHOD */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400 font-medium">Source Wallet</span>
            <div className="flex items-center gap-2 bg-white/3 border border-white/5 rounded-xl px-3 py-2">
              <Landmark size={14} className="text-neutral-400" />
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="bg-transparent flex-1 text-xs outline-none text-white cursor-pointer"
              >
                {wallets.map(w => (
                  <option key={w.id} value={w.id} className="bg-neutral-900">{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400 font-medium">Payment Method</span>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="bg-neutral-900 border border-white/5 text-xs rounded-xl px-3 py-2.5 outline-none text-white cursor-pointer"
            >
              {paymentMethods.map(pm => (
                <option key={pm} value={pm}>{pm}</option>
              ))}
            </select>
          </div>
        </div>

        {/* DATE & TIME CONTROLLER */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400 font-medium">Date & Time</span>
          <div className="flex items-center gap-2 bg-white/3 border border-white/5 rounded-xl px-3 py-2.5">
            <Calendar size={16} className="text-neutral-400" />
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-sm outline-none text-white cursor-pointer w-full text-left"
            />
          </div>
        </div>

        {/* ATTACHMENT RECEIPTS */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400 font-medium">Receipt Image (Attachment)</span>
          <div className="flex items-center gap-4 bg-white/3 border border-white/5 rounded-xl p-3">
            <label className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs cursor-pointer text-neutral-200">
              <Image size={14} />
              Choose photo / Capture
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {attachmentBase64 ? (
              <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/20">
                <img src={attachmentBase64} alt="Receipt thumbnail" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setAttachmentBase64('')}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-white text-[9px] font-bold"
                >
                  Clear
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-neutral-500">No attachment added yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Button controls instead of slider */}
      <div className="pt-4 border-t border-white/5 flex gap-3.5 w-full">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-sm text-neutral-400 cursor-pointer transition-all active:scale-95 flex items-center justify-center"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirmSave}
          className={`flex-1 py-3 rounded-2xl font-black text-sm text-white shadow-lg cursor-pointer transform active:scale-95 transition-all flex items-center justify-center gap-2 ${
            type === 'income' 
              ? 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_4px_16px_rgba(16,185,129,0.3)]' 
              : 'bg-rose-500 hover:bg-rose-600 shadow-[0_4px_16px_rgba(244,63,94,0.3)]'
          }`}
        >
          <Check size={16} strokeWidth={3} />
          Save {type === 'income' ? 'Income' : 'Expense'}
        </button>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <>
        {isInline ? (
          formElement
        ) : (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="w-full max-w-md h-[92vh] overflow-y-auto rounded-t-[32px] p-6 flex flex-col justify-between shadow-2xl relative"
            style={{ backgroundColor: themeCardBg, color: '#FFF' }}
          >
            {formElement}
          </motion.div>
        </div>
      )}

        {/* --- FULL SCREEN BOTTOM SHEET CATEGORY PICKER --- */}
        {showCategorySheet && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-60 flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              className="w-full max-w-md bg-neutral-900 border-t border-white/10 rounded-t-[32px] p-6 max-h-[85vh] overflow-y-auto flex flex-col"
            >
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <div className="flex flex-col">
                  <span className="text-xs text-neutral-400 font-mono">SELECT CATEGORY</span>
                  <span className="text-base font-bold text-white mt-0.5">Category Directory</span>
                </div>
                <button
                  onClick={() => setShowCustomCatSheet(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-400 text-xs font-bold cursor-pointer"
                >
                  <Plus size={14} /> Add Custom
                </button>
              </div>

              <div className="grid grid-cols-3 gap-y-6 gap-x-3 py-6">
                {filteredCategories.map(cat => {
                  const IconComp = (LucideIcons as any)[cat.icon] || LucideIcons.HelpCircle;
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setSelectedSubCategoryName(''); // reset subcat
                        setShowCategorySheet(false);
                        triggerHapticFeedback();
                      }}
                      className="flex flex-col items-center gap-2 cursor-pointer focus:outline-none"
                    >
                      <div 
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-all shadow-md ${
                          isSelected ? 'ring-4 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: cat.color }}
                      >
                        <IconComp size={24} />
                      </div>
                      <span className="text-[11px] font-medium text-center truncate w-24 text-neutral-300">
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setShowCategorySheet(false)}
                className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-bold text-sm tracking-wide text-neutral-200 cursor-pointer mt-4"
              >
                Close Picker
              </button>
            </motion.div>
          </div>
        )}

        {/* --- ADD CUSTOM CATEGORY SUB-SHEET --- */}
        {showCustomCatSheet && (
          <div className="absolute inset-0 bg-black/90 z-70 flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              className="w-full max-w-md bg-neutral-900 border-t border-white/15 rounded-t-[32px] p-6 flex flex-col gap-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-sm font-bold text-white">Add Custom Category</span>
                <button 
                  onClick={() => setShowCustomCatSheet(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-400">Category Name</span>
                <input
                  type="text"
                  placeholder="e.g. Golf Membership, Subscriptions..."
                  value={customCatName}
                  onChange={(e) => setCustomCatName(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              {/* Color list */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-400">Theme Color</span>
                <div className="flex gap-2 flex-wrap">
                  {['#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#06B6D4'].map(color => (
                    <button
                      key={color}
                      onClick={() => setCustomCatColor(color)}
                      className={`w-7 h-7 rounded-full border border-white/20 transition-transform ${customCatColor === color ? 'scale-125 ring-2 ring-white' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon selector list */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-400">Select Icon</span>
                <div className="flex gap-3 flex-wrap p-2 bg-white/5 rounded-xl">
                  {['Heart', 'Gamepad', 'Coffee', 'Music', 'Tv', 'TrendingUp', 'Gift', 'Smile'].map(iconName => {
                    const IconObj = (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
                    return (
                      <button
                        key={iconName}
                        onClick={() => setCustomCatIcon(iconName)}
                        className={`p-2 rounded-lg border text-white ${customCatIcon === iconName ? 'bg-white/20 border-white' : 'bg-transparent border-transparent'}`}
                      >
                        <IconObj size={18} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!customCatName.trim()) {
                    alert('Please enter a name');
                    return;
                  }
                  categories.push({
                    id: `custom-${Date.now()}`,
                    name: customCatName.trim(),
                    type: type === 'income' ? 'income' : 'expense',
                    icon: customCatIcon,
                    color: customCatColor,
                    isCustom: true,
                    isEnabled: true
                  });
                  setSelectedCategoryId(categories[categories.length - 1].id);
                  setCustomCatName('');
                  setShowCustomCatSheet(false);
                  setShowCategorySheet(false);
                  triggerHapticFeedback();
                }}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold text-sm text-white mt-2 cursor-pointer"
              >
                Create and Select Category
              </button>
            </motion.div>
          </div>
        )}
      </>
    </AnimatePresence>
  );
}
