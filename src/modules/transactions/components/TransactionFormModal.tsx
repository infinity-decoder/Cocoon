/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Calendar, Image, FileText, Check, ChevronRight, Landmark, 
  HelpCircle, Tag, CreditCard, ShieldAlert, Banknote, Smartphone, Coins, Wallet as WalletIcon 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Category, Wallet, Transaction, TransactionType } from '../../../core/types';
import { CATEGORY_ICONS_MAP } from '../../categories';
import { triggerHapticFeedback } from '../../../core/utils/haptics';

interface TransactionFormModalProps {
  isOpen: boolean;
  type: TransactionType;
  onClose: () => void;
  onSave: (transactionData: Partial<Transaction>) => void;
  categories: Category[];
  subCategories: Category[];
  onAddCategory?: (category: Omit<Category, 'id' | 'isCustom' | 'isEnabled'>) => void;
  onAddSubCategory?: (subCategory: Omit<Category, 'id' | 'isCustom' | 'isEnabled'>) => Category | void;
  wallets: Wallet[];
  paymentMethods: string[];
  currencySymbol: string;
  themeRadius: string;
  themePrimary: string;
  themeCardBg: string;
  themeBorder: string;
  isInline?: boolean;
}

export const getPaymentMethodInfo = (method: string) => {
  switch (method.toLowerCase()) {
    case 'cash':
      return { icon: Banknote, color: '#10B981', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' };
    case 'credit card':
      return { icon: CreditCard, color: '#F43F5E', bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-400' };
    case 'debit card':
      return { icon: CreditCard, color: '#3B82F6', bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400' };
    case 'digital wallet':
      return { icon: WalletIcon, color: '#F59E0B', bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400' };
    case 'nayapay':
      return { icon: Smartphone, color: '#EC4899', bg: 'bg-pink-500/15', border: 'border-pink-500/30', text: 'text-pink-400' };
    case 'cryptocurrency':
      return { icon: Coins, color: '#8B5CF6', bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400' };
    case 'bank transfer':
      return { icon: Landmark, color: '#06B6D4', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', text: 'text-cyan-400' };
    case 'cheque':
      return { icon: FileText, color: '#6366F1', bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-400' };
    default:
      return { icon: CreditCard, color: '#10B981', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' };
  }
};

export default function TransactionFormModal({
  isOpen,
  type,
  onClose,
  onSave,
  categories,
  subCategories,
  onAddCategory,
  onAddSubCategory,
  wallets,
  paymentMethods,
  currencySymbol,
  themeCardBg,
  isInline = false
}: TransactionFormModalProps) {
  // Local form state
  const [amountStr, setAmountStr] = useState('0');
  const [note, setNote] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubCategoryName, setSelectedSubCategoryName] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [selectedToWalletId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0] || 'Cash');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
  const [attachmentBase64, setAttachmentBase64] = useState<string>('');

  // Interactive Bottom sheets & modals
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showSubCategorySheet, setShowSubCategorySheet] = useState(false);
  const [showPaymentMethodSheet, setShowPaymentMethodSheet] = useState(false);
  const [showCustomCatSheet, setShowCustomCatSheet] = useState(false);
  const [showAddSubCatModal, setShowAddSubCatModal] = useState(false);
  
  // Custom Category State
  const [customCatName, setCustomCatName] = useState('');
  const [customCatColor, setCustomCatColor] = useState('#EC4899');
  const [customCatIcon, setCustomCatIcon] = useState('Heart');

  // Sub-Category Creation State
  const [newSubCatName, setNewSubCatName] = useState('');
  const [formError, setFormError] = useState('');
  const [subCatError, setSubCatError] = useState('');
  const [customCatError, setCustomCatError] = useState('');

  // Strict separation: Filter categories and subcategories based on TransactionType (income vs expense)
  const categoryType = type === 'income' ? 'income' : 'expense';
  const filteredCategories = categories.filter(c => c.type === categoryType && c.isEnabled);
  const activeCategory = categories.find(c => c.id === selectedCategoryId) || filteredCategories[0];
  
  // Subcategories specifically for the selected category AND matching the transaction type
  const subCatsForActive = subCategories.filter(sc => 
    (sc.parentId === selectedCategoryId || (activeCategory && sc.parentId === activeCategory.id)) && 
    sc.type === categoryType && 
    sc.isEnabled
  );

  useEffect(() => {
    if (isOpen) {
      if (filteredCategories.length > 0) {
        setSelectedCategoryId(filteredCategories[0].id);
      }
      setAmountStr('0');
      setNote('');
      setSelectedSubCategoryName('');
      setAttachmentBase64('');
      setFormError('');
      setSubCatError('');
      setCustomCatError('');
    }
  }, [isOpen, type]);

  const confirmSave = () => {
    triggerHapticFeedback();
    setFormError('');
    
    const finalAmount = parseFloat(amountStr) || 0;
    if (finalAmount <= 0) {
      setFormError('Please enter a valid amount greater than 0.');
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

  // Quick Subcategory submission
  const handleAddSubCategorySubmit = () => {
    if (!newSubCatName.trim()) {
      setSubCatError('Please enter a sub-category name.');
      return;
    }

    const trimmedName = newSubCatName.trim();
    triggerHapticFeedback();

    if (onAddSubCategory && activeCategory) {
      onAddSubCategory({
        name: trimmedName,
        type: categoryType,
        parentId: activeCategory.id,
        color: activeCategory.color || '#10B981',
        icon: activeCategory.icon || 'Tag'
      });
    }

    // Auto-select the newly added subcategory
    setSelectedSubCategoryName(trimmedName);
    setNewSubCatName('');
    setSubCatError('');
    setShowAddSubCatModal(false);
  };

  // Quick Category submission
  const handleAddCategorySubmit = () => {
    if (!customCatName.trim()) {
      setCustomCatError('Please enter a category name.');
      return;
    }

    const trimmedName = customCatName.trim();
    triggerHapticFeedback();

    if (onAddCategory) {
      onAddCategory({
        name: trimmedName,
        type: categoryType,
        icon: customCatIcon,
        color: customCatColor
      });
    } else {
      categories.push({
        id: `custom-${Date.now()}`,
        name: trimmedName,
        type: categoryType,
        icon: customCatIcon,
        color: customCatColor,
        isCustom: true,
        isEnabled: true
      });
    }

    // Find or assign id
    const createdCat = categories.find(c => c.name === trimmedName) || categories[categories.length - 1];
    if (createdCat) {
      setSelectedCategoryId(createdCat.id);
    }
    setCustomCatName('');
    setShowCustomCatSheet(false);
    setShowCategorySheet(false);
  };

  if (!isInline && !isOpen) return null;

  const formElement = (
    <div
      className={`w-full ${isInline ? 'p-1' : 'h-[92vh] overflow-y-auto rounded-t-[32px] p-6 shadow-2xl relative'}`}
      style={{ backgroundColor: isInline ? 'transparent' : themeCardBg, color: '#FFF' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-white/5">
        <div className="flex flex-col text-left">
          <span className="text-xs text-neutral-400 font-mono tracking-widest uppercase">
            New Transaction
          </span>
          <span className="text-xl font-bold tracking-tight mt-0.5 capitalize">
            Add {type}
          </span>
        </div>
        <button 
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            onClose();
          }}
          className="p-2 bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 border border-rose-500/30 text-rose-400 rounded-full transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-sm"
          title="Close page"
          aria-label="Close page"
        >
          <X size={18} className="text-rose-400" />
        </button>
      </div>

      {/* Form Content */}
      <div className="flex flex-col gap-4 py-4 scrollbar-none text-left">
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
                setFormError('');
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

          {formError && (
            <div className="mt-3 p-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-medium flex items-center gap-2">
              <ShieldAlert size={15} className="shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}
        </div>

        {/* DESCRIPTION/NOTE */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400 font-medium">Description Note</span>
          <div className="flex items-center gap-2 bg-white/3 border border-white/5 rounded-xl px-3 py-2.5">
            <FileText size={16} className="text-neutral-400" />
            <input
              type="text"
              placeholder={type === 'income' ? "e.g. Monthly salary, Freelance client deposit..." : "e.g. Weekly organic groceries..."}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-transparent flex-1 text-sm outline-none placeholder:text-neutral-500 text-white"
            />
          </div>
        </div>

        {/* CATEGORY & SUBCATEGORY PICKER */}
        <div className="grid grid-cols-2 gap-3">
          {/* Main Category */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400 font-medium">Category</span>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setShowCategorySheet(true);
              }}
              className="flex items-center justify-between bg-white/3 border border-white/5 hover:bg-white/5 transition-colors rounded-xl px-3 py-2.5 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                {activeCategory && (() => {
                  const IconComponent = CATEGORY_ICONS_MAP[activeCategory.icon] || HelpCircle;
                  return (
                    <div 
                      className="p-1 rounded-lg text-white shrink-0"
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
              <ChevronRight size={14} className="text-neutral-400 shrink-0" />
            </button>
          </div>

          {/* Sub-Category with Custom Bottom Sheet trigger */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-neutral-400 font-medium">Sub-Category</span>
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback();
                  setShowAddSubCatModal(true);
                }}
                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer transition-colors"
                title="Add new subcategory"
              >
                <Plus size={11} /> Add Sub
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setShowSubCategorySheet(true);
              }}
              className="flex items-center justify-between bg-white/3 border border-white/5 hover:bg-white/5 transition-colors rounded-xl px-3 py-2.5 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <div className="p-1 rounded-lg bg-white/10 text-neutral-300 shrink-0">
                  <Tag size={14} />
                </div>
                <span className="text-sm font-medium text-white truncate">
                  {selectedSubCategoryName || 'None (General)'}
                </span>
              </div>
              <ChevronRight size={14} className="text-neutral-400 shrink-0" />
            </button>
          </div>
        </div>

        {/* PAYMENT METHOD (Custom In-App Bottom Sheet Trigger) */}
        {type === 'transfer' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-neutral-400 font-medium">Source Wallet</span>
              <div className="flex items-center gap-2 bg-white/3 border border-white/5 rounded-xl px-3 py-2">
                <Landmark size={14} className="text-neutral-400 shrink-0" />
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
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback();
                  setShowPaymentMethodSheet(true);
                }}
                className="flex items-center justify-between bg-white/3 border border-white/5 hover:bg-white/5 transition-colors rounded-xl px-3 py-2 text-left cursor-pointer"
              >
                <span className="text-xs font-medium text-white truncate">{paymentMethod}</span>
                <ChevronRight size={12} className="text-neutral-400 shrink-0" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400 font-medium">Payment Method</span>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setShowPaymentMethodSheet(true);
              }}
              className="flex items-center justify-between bg-white/3 border border-white/5 hover:bg-white/5 transition-colors rounded-xl px-3 py-2.5 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                {(() => {
                  const info = getPaymentMethodInfo(paymentMethod);
                  const IconC = info.icon;
                  return (
                    <div className={`p-1 rounded-lg ${info.bg} ${info.text} border ${info.border} shrink-0`}>
                      <IconC size={14} />
                    </div>
                  );
                })()}
                <span className="text-sm font-medium text-white truncate">
                  {paymentMethod}
                </span>
              </div>
              <ChevronRight size={14} className="text-neutral-400 shrink-0" />
            </button>
          </div>
        )}

        {/* DATE & TIME CONTROLLER */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400 font-medium">Date & Time</span>
          <div className="flex items-center gap-2 bg-white/3 border border-white/5 rounded-xl px-3 py-2.5">
            <Calendar size={16} className="text-neutral-400 shrink-0" />
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
                  type="button"
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

      {/* Button controls: Cancel is friendly, reddish with red cross */}
      <div className="pt-4 border-t border-white/5 flex gap-3.5 w-full">
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            onClose();
          }}
          className="flex-1 py-3 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-2xl font-bold text-sm text-rose-400 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
        >
          <X size={16} className="text-rose-400" /> Cancel
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
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[85] flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-neutral-900 border-t border-white/10 rounded-t-[32px] p-6 max-h-[85vh] overflow-y-auto flex flex-col text-left"
            >
              {/* Header: Reddish Cancel button in place of the old Add Custom button */}
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <div className="flex flex-col">
                  <span className="text-xs text-neutral-400 font-mono tracking-wider">
                    SELECT {categoryType === 'income' ? 'INCOME' : 'EXPENSE'} CATEGORY
                  </span>
                  <span className="text-base font-bold text-white mt-0.5">Category Directory</span>
                </div>
                {/* Red colored Cancel button with red cross */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setShowCategorySheet(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
                >
                  <X size={14} className="text-rose-400" /> Cancel
                </button>
              </div>

              {/* Category Grid: Existing categories + Add Custom at the end */}
              <div className="grid grid-cols-3 gap-y-6 gap-x-3 py-6">
                {filteredCategories.map(cat => {
                  const IconComp = CATEGORY_ICONS_MAP[cat.icon] || HelpCircle;
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setSelectedSubCategoryName('');
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

                {/* + Add Custom button placed at the end of the category items */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setShowCustomCatSheet(true);
                  }}
                  className="flex flex-col items-center gap-2 cursor-pointer focus:outline-none group"
                >
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-emerald-400 bg-emerald-500/10 border-2 border-dashed border-emerald-500/40 group-hover:border-emerald-400 group-hover:bg-emerald-500/20 transition-all shadow-md group-hover:scale-105">
                    <Plus size={24} />
                  </div>
                  <span className="text-[11px] font-bold text-center truncate w-24 text-emerald-400">
                    + Add Custom
                  </span>
                </button>
              </div>

              {/* Secondary prominent Add Custom button at the end of category section */}
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback();
                  setShowCustomCatSheet(true);
                }}
                className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl font-bold text-sm text-emerald-400 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95 mb-2"
              >
                <Plus size={16} /> Add Custom {categoryType === 'income' ? 'Income' : 'Expense'} Category
              </button>
            </motion.div>
          </div>
        )}

        {/* --- ADD CUSTOM CATEGORY SUB-SHEET --- */}
        {showCustomCatSheet && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[90] flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-neutral-900 border-t border-white/15 rounded-t-[32px] p-6 flex flex-col gap-4 text-left"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-sm font-bold text-white">
                  Add Custom {categoryType === 'income' ? 'Income' : 'Expense'} Category
                </span>
                <button 
                  type="button"
                  onClick={() => setShowCustomCatSheet(false)}
                  className="p-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 transition-colors"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
              </div>

              {customCatError && (
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-medium flex items-center gap-2">
                  <ShieldAlert size={15} className="shrink-0 text-rose-400" />
                  <span>{customCatError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-400">Category Name</span>
                <input
                  type="text"
                  placeholder={categoryType === 'income' ? "e.g. Consulting, Rental, Dividends..." : "e.g. Golf Membership, Subscriptions..."}
                  value={customCatName}
                  onChange={(e) => setCustomCatName(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              {/* Color list */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-400">Theme Color</span>
                <div className="flex gap-2 flex-wrap">
                  {['#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#06B6D4'].map(color => (
                    <button
                      key={color}
                      type="button"
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
                <div className="flex gap-3 flex-wrap p-2 bg-white/5 rounded-xl max-h-36 overflow-y-auto">
                  {['Heart', 'Gamepad', 'Coffee', 'Music', 'Tv', 'TrendingUp', 'Gift', 'Smile', 'Briefcase', 'Laptop', 'Award', 'DollarSign', 'Home', 'Tag'].map(iconName => {
                    const IconObj = CATEGORY_ICONS_MAP[iconName] || HelpCircle;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setCustomCatIcon(iconName)}
                        className={`p-2 rounded-lg border text-white ${customCatIcon === iconName ? 'bg-white/20 border-white' : 'bg-transparent border-transparent'}`}
                      >
                        <IconObj size={18} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomCatSheet(false)}
                  className="flex-1 py-3 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-xl font-bold text-xs text-rose-400 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCategorySubmit}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold text-xs text-white shadow-lg shadow-emerald-500/25 cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Check size={14} strokeWidth={3} /> Save Category
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* --- ADD NEW SUBCATEGORY MODAL --- */}
        {showAddSubCatModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[90] flex items-end justify-center p-4">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-3xl p-5 flex flex-col gap-4 text-left shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-emerald-400">
                    New {categoryType === 'income' ? 'Income' : 'Expense'} Sub-Category
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-bold text-white">Under:</span>
                    {activeCategory && (
                      <span 
                        className="px-2 py-0.5 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-1"
                        style={{ backgroundColor: activeCategory.color }}
                      >
                        <Tag size={12} /> {activeCategory.name}
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowAddSubCatModal(false)}
                  className="p-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 transition-colors"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
              </div>

              {subCatError && (
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-medium flex items-center gap-2">
                  <ShieldAlert size={15} className="shrink-0 text-rose-400" />
                  <span>{subCatError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-neutral-400 font-medium">Sub-Category Name</label>
                <input
                  type="text"
                  placeholder={categoryType === 'income' ? "e.g. Bonus, Upwork, Consulting, Dividend" : "e.g. Groceries, Snacks, Fuel, WiFi"}
                  value={newSubCatName}
                  onChange={(e) => setNewSubCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubCategorySubmit();
                    }
                  }}
                  className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setShowAddSubCatModal(false);
                    setNewSubCatName('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddSubCategorySubmit}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/25 cursor-pointer transition-all active:scale-95"
                >
                  <Check size={14} strokeWidth={3} /> Save Sub-Category
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* --- CUSTOM SUBCATEGORY DIRECTORY SHEET (Matching Category Modal Design) --- */}
        {showSubCategorySheet && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[85] flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-neutral-900 border-t border-white/10 rounded-t-[32px] p-6 max-h-[85vh] overflow-y-auto flex flex-col text-left"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <div className="flex flex-col">
                  <span className="text-xs text-neutral-400 font-mono tracking-wider uppercase">
                    {activeCategory?.name || 'CATEGORY'} SUBCATEGORIES
                  </span>
                  <span className="text-base font-bold text-white mt-0.5">Subcategory Directory</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setShowSubCategorySheet(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
                >
                  <X size={14} className="text-rose-400" /> Cancel
                </button>
              </div>

              {/* Subcategories Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-5">
                {/* Option 1: None (General) */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setSelectedSubCategoryName('');
                    setShowSubCategorySheet(false);
                  }}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                    selectedSubCategoryName === ''
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-white ring-2 ring-emerald-500/40 shadow-lg'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-neutral-200">
                    <Tag size={18} />
                  </div>
                  <span className="text-xs font-bold text-center truncate w-full">
                    None (General)
                  </span>
                </button>

                {/* Subcategories matching active category */}
                {subCatsForActive.map((sc) => {
                  const isSelected = selectedSubCategoryName === sc.name;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => {
                        triggerHapticFeedback();
                        setSelectedSubCategoryName(sc.name);
                        setShowSubCategorySheet(false);
                      }}
                      className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-white ring-2 ring-emerald-500/40 shadow-lg'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
                      }`}
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: activeCategory?.color || '#10B981' }}
                      >
                        <Tag size={18} />
                      </div>
                      <span className="text-xs font-bold text-center truncate w-full">
                        {sc.name}
                      </span>
                    </button>
                  );
                })}

                {/* + Add New Subcategory Tile */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setShowSubCategorySheet(false);
                    setShowAddSubCatModal(true);
                  }}
                  className="p-3.5 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                    <Plus size={20} />
                  </div>
                  <span className="text-xs font-bold text-emerald-400 text-center truncate w-full">
                    + Add New
                  </span>
                </button>
              </div>

              {/* Bottom Add Action Button */}
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback();
                  setShowSubCategorySheet(false);
                  setShowAddSubCatModal(true);
                }}
                className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl font-bold text-sm text-emerald-400 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Plus size={16} /> Create New Subcategory
              </button>
            </motion.div>
          </div>
        )}

        {/* --- CUSTOM PAYMENT METHOD SHEET (Matching Category Modal Design) --- */}
        {showPaymentMethodSheet && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[85] flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-neutral-900 border-t border-white/10 rounded-t-[32px] p-6 max-h-[85vh] overflow-y-auto flex flex-col text-left"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <div className="flex flex-col">
                  <span className="text-xs text-neutral-400 font-mono tracking-wider uppercase">
                    SELECT PAYMENT CHANNEL
                  </span>
                  <span className="text-base font-bold text-white mt-0.5">Payment Method</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    setShowPaymentMethodSheet(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
                >
                  <X size={14} className="text-rose-400" /> Cancel
                </button>
              </div>

              {/* Payment Methods Grid */}
              <div className="grid grid-cols-2 gap-2.5 py-4 max-h-[60vh] overflow-y-auto">
                {paymentMethods.map((pm) => {
                  const isSelected = paymentMethod === pm;
                  const info = getPaymentMethodInfo(pm);
                  const IconC = info.icon;

                  return (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => {
                        triggerHapticFeedback();
                        setPaymentMethod(pm);
                        setShowPaymentMethodSheet(false);
                      }}
                      className={`p-3 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all text-left ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-white ring-2 ring-emerald-500/40 shadow-lg'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
                      }`}
                    >
                      <div 
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${info.bg} ${info.text} border ${info.border} transition-transform ${
                          isSelected ? 'scale-105' : ''
                        }`}
                      >
                        <IconC size={18} />
                      </div>
                      <span className="text-xs font-bold leading-tight line-clamp-2">
                        {pm}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </>
    </AnimatePresence>
  );
}
