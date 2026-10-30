/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Plus, Trash2, Check, Tag, ChevronDown, ChevronUp, Layers,
  Home, ShoppingCart, Car, Smartphone, Zap, Award, Heart, Camera, Laptop, Gift,
  Coffee, Briefcase, Utensils, BookOpen, DollarSign, Music, Gamepad, Smile, Compass,
  Tv, HeartHandshake, Activity, Baby, Scale, Dumbbell,
  Pizza, CupSoda, Cake, Soup, Shirt, Watch, Sparkles, Pill, Stethoscope, PartyPopper,
  Hammer, ShoppingBag, Pencil, Bus, Plane, Footprints, Shield, Film,
  TrendingUp, Percent, RotateCcw, CreditCard, Droplet, Wifi, Fuel, Globe,
  ArrowLeft, ShieldAlert
} from 'lucide-react';
import { Category } from '../../../core/types';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { useTheme } from '../../../core/theme';

export type CategoryIconComponent = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number; style?: React.CSSProperties }>;

// Large set of highly recognizable icons from Lucide for the Icon Picker
export const CATEGORY_ICONS_MAP: Record<string, CategoryIconComponent> = {
  Home, ShoppingCart, Car, Smartphone, Zap, Award, Heart, Camera, Laptop, Gift,
  Coffee, Briefcase, Utensils, BookOpen, DollarSign, Music, Gamepad, Smile, Compass,
  Tv, HeartHandshake, Activity, Baby, Scale, Dumbbell,
  Pizza, CupSoda, Cake, Soup, Shirt, Watch, Sparkles, Pill, Stethoscope, PartyPopper,
  Hammer, ShoppingBag, Pencil, Bus, Plane, Footprints, Shield, Film,
  TrendingUp, Percent, RotateCcw, CreditCard, Droplet, Wifi, Fuel, Globe, Tag
};

const HARMONIOUS_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#14B8A6', // Teal
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#64748B', // Slate
  '#B45309'  // Brown/Gold
];

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  isInline?: boolean;
  categories: Category[];
  subCategories?: Category[];
  onAddCategory: (category: Omit<Category, 'id' | 'isCustom' | 'isEnabled'>) => void;
  onDeleteCategory: (id: string) => void;
  onAddSubCategory?: (subCategory: Omit<Category, 'id' | 'isCustom' | 'isEnabled'>) => void;
  onDeleteSubCategory?: (id: string) => void;
  currencySymbol?: string;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
}

export default function CategoryManager({
  isOpen,
  onClose,
  isInline = false,
  categories,
  subCategories = [],
  onAddCategory,
  onDeleteCategory,
  onAddSubCategory,
  onDeleteSubCategory,
  themeCardBg,
  themeBorder,
  themeRadius
}: CategoryManagerProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [viewMode, setViewMode] = useState<'categories' | 'subcategories'>('categories');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingSubCategory, setIsAddingSubCategory] = useState(false);
  
  // New Category Form state
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(HARMONIOUS_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState('ShoppingCart');
  const [catError, setCatError] = useState('');

  // New SubCategory Form state
  const [subCatName, setSubCatName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [subCatError, setSubCatError] = useState('');

  // Expanded category IDs for accordion view
  const [expandedCatIds, setExpandedCatIds] = useState<string[]>([]);

  if (!isOpen) return null;

  // Filter categories and subcategories strictly by active tab (income vs expense)
  const currentCategories = categories.filter(c => c.type === activeTab);
  const currentSubCategories = subCategories.filter(sc => sc.type === activeTab);

  const toggleExpand = (catId: string) => {
    triggerHapticFeedback();
    setExpandedCatIds(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handleSaveCategory = () => {
    if (!name.trim()) {
      setCatError('Please enter a category name');
      return;
    }
    
    triggerHapticFeedback();
    onAddCategory({
      name: name.trim(),
      type: activeTab,
      icon: selectedIcon,
      color: selectedColor
    });

    // Reset Form
    setName('');
    setCatError('');
    setSelectedColor(HARMONIOUS_COLORS[0]);
    setSelectedIcon('ShoppingCart');
    setIsAddingCategory(false);
  };

  const handleSaveSubCategory = () => {
    if (!subCatName.trim()) {
      setSubCatError('Please enter a sub-category name');
      return;
    }

    const parentCat = categories.find(c => c.id === selectedParentId) || currentCategories[0];
    if (!parentCat) {
      setSubCatError('Please select a valid parent category');
      return;
    }

    triggerHapticFeedback();
    if (onAddSubCategory) {
      onAddSubCategory({
        name: subCatName.trim(),
        type: activeTab,
        parentId: parentCat.id,
        color: parentCat.color,
        icon: parentCat.icon
      });
    }

    // Reset Form
    setSubCatName('');
    setSubCatError('');
    setIsAddingSubCategory(false);
  };

  const SelectedIconComp = CATEGORY_ICONS_MAP[selectedIcon] || Home;

  const contentElement = (
    <div className={`w-full flex flex-col gap-3 select-none text-left ${isInline ? 'pb-6' : ''}`}>
      {/* Header */}
      <div className="flex justify-between items-center pb-2.5 border-b gap-3" style={{ borderColor: theme.borderSubtle }}>
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            onClose();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 border rounded-2xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
          style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle, color: theme.textPrimary }}
          title="Back to Home"
        >
          <ArrowLeft size={14} className="text-emerald-400" />
          <span>Back to Home</span>
        </button>
        <div className="flex flex-col text-right">
          <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: theme.textMuted }}>Customization</span>
          <h2 className="text-sm font-bold" style={{ color: theme.textPrimary }}>Categories</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback();
            onClose();
          }}
          className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 border border-rose-500/30 text-rose-400 cursor-pointer transition-all active:scale-90 shadow-sm shrink-0"
          title="Close"
        >
          <X size={15} />
        </button>
      </div>

      {/* Income vs Expense Tabs */}
      <div className="flex p-1.5 gap-2 border-b" style={{ borderColor: theme.borderSubtle }}>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setActiveTab('expense');
                setIsAddingCategory(false);
                setIsAddingSubCategory(false);
              }}
              className="flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border"
              style={activeTab === 'expense' 
                ? { backgroundColor: 'rgba(244, 63, 94, 0.15)', color: '#F43F5E', borderColor: 'rgba(244, 63, 94, 0.3)' } 
                : { backgroundColor: theme.surfaceMuted, color: theme.textSecondary, borderColor: 'transparent' }
              }
            >
              Expense Categories
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setActiveTab('income');
                setIsAddingCategory(false);
                setIsAddingSubCategory(false);
              }}
              className="flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border"
              style={activeTab === 'income' 
                ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981', borderColor: 'rgba(16, 185, 129, 0.3)' } 
                : { backgroundColor: theme.surfaceMuted, color: theme.textSecondary, borderColor: 'transparent' }
              }
            >
              Income Categories
            </button>
          </div>

          {/* Sub-navigation: Categories vs Sub-Categories View */}
          <div className="flex px-4 pt-3 pb-2 gap-2 border-b" style={{ borderColor: theme.borderSubtle }}>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setViewMode('categories');
                setIsAddingCategory(false);
                setIsAddingSubCategory(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border"
              style={viewMode === 'categories'
                ? { backgroundColor: theme.primary, color: theme.textOnPrimary, borderColor: 'transparent' }
                : { backgroundColor: theme.surfaceMuted, color: theme.textSecondary, borderColor: theme.borderSubtle }
              }
            >
              <Layers size={13} /> Main Categories ({currentCategories.length})
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setViewMode('subcategories');
                setIsAddingCategory(false);
                setIsAddingSubCategory(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border"
              style={viewMode === 'subcategories'
                ? { backgroundColor: theme.primary, color: theme.textOnPrimary, borderColor: 'transparent' }
                : { backgroundColor: theme.surfaceMuted, color: theme.textSecondary, borderColor: theme.borderSubtle }
              }
            >
              <Tag size={13} /> Sub-Categories ({currentSubCategories.length})
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 scrollbar-none text-left">
            {/* 1. ADD NEW CATEGORY VIEW */}
            {isAddingCategory ? (
              <div className="flex flex-col gap-5">
                {catError && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-medium flex items-center gap-2">
                    <ShieldAlert size={16} className="shrink-0 text-rose-400" />
                    <span>{catError}</span>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {/* Live Icon Preview */}
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg"
                    style={{ backgroundColor: selectedColor }}
                  >
                    <SelectedIconComp size={28} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-mono tracking-wider mb-1 block" style={{ color: theme.textSecondary }}>Category Name</label>
                    <input
                      type="text"
                      placeholder={activeTab === 'income' ? "e.g. Consulting, Royalties" : "e.g. Pet Care, Online Games"}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Color Swatches */}
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-wider mb-2 block" style={{ color: theme.textSecondary }}>Select Color</label>
                  <div className="flex flex-wrap gap-2.5">
                    {HARMONIOUS_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback();
                          setSelectedColor(c);
                        }}
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
                        style={{ backgroundColor: c }}
                      >
                        {selectedColor === c && <Check size={14} className="text-white drop-shadow" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Icon Grid Picker */}
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-wider mb-2 block" style={{ color: theme.textSecondary }}>Select Icon ({Object.keys(CATEGORY_ICONS_MAP).length} Available)</label>
                  <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1.5 rounded-2xl border" style={{ backgroundColor: theme.inputBg, borderColor: theme.borderSubtle }}>
                    {Object.entries(CATEGORY_ICONS_MAP).map(([iconName, IconComponent]) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback();
                          setSelectedIcon(iconName);
                        }}
                        className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                          selectedIcon === iconName 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 scale-105' 
                            : 'border-transparent hover:opacity-80'
                        }`}
                        style={{ color: selectedIcon === iconName ? undefined : theme.textSecondary }}
                      >
                        <IconComponent size={20} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action buttons with reddish Cancel */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback();
                      setIsAddingCategory(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <X size={14} className="text-rose-400" /> Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCategory}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} strokeWidth={3} /> Save Category
                  </button>
                </div>
              </div>
            ) : isAddingSubCategory ? (
              /* 2. ADD NEW SUBCATEGORY VIEW */
              <div className="flex flex-col gap-4">
                {subCatError && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-medium flex items-center gap-2">
                    <ShieldAlert size={16} className="shrink-0 text-rose-400" />
                    <span>{subCatError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: theme.textSecondary }}>Select Parent Category</label>
                  <select
                    value={selectedParentId || currentCategories[0]?.id || ''}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    className="border text-sm rounded-xl px-3 py-2.5 outline-none cursor-pointer w-full"
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                  >
                    {currentCategories.map(cat => (
                      <option key={cat.id} value={cat.id} style={{ backgroundColor: theme.surfaceElevated, color: theme.textPrimary }}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: theme.textSecondary }}>Sub-Category Name</label>
                  <input
                    type="text"
                    placeholder={activeTab === 'income' ? "e.g. Overtime, Client Retainer, Dividends" : "e.g. Snacks, Drinks, Car Wash"}
                    value={subCatName}
                    onChange={(e) => setSubCatName(e.target.value)}
                    className="border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback();
                      setIsAddingSubCategory(false);
                      setSubCatName('');
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <X size={14} className="text-rose-400" /> Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSubCategory}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} strokeWidth={3} /> Save Sub-Category
                  </button>
                </div>
              </div>
            ) : viewMode === 'categories' ? (
              /* 3. MAIN CATEGORIES LIST VIEW */
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback();
                      setIsAddingCategory(true);
                    }}
                    className="py-2.5 px-3 rounded-2xl border border-dashed flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
                    style={{ borderColor: theme.primary, color: theme.primary, backgroundColor: 'rgba(16, 185, 129, 0.05)' }}
                  >
                    <Plus size={14} /> Add Category
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback();
                      if (currentCategories.length > 0) {
                        setSelectedParentId(currentCategories[0].id);
                      }
                      setIsAddingSubCategory(true);
                    }}
                    className="py-2.5 px-3 rounded-2xl border border-dashed flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
                    style={{ borderColor: theme.borderFocus, color: theme.borderFocus, backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                  >
                    <Plus size={14} /> Add Sub-Category
                  </button>
                </div>

                {currentCategories.map(cat => {
                  const Icon = CATEGORY_ICONS_MAP[cat.icon] || Home;
                  const catSubList = currentSubCategories.filter(sc => sc.parentId === cat.id);
                  const isExpanded = expandedCatIds.includes(cat.id);

                  return (
                    <div
                      key={cat.id}
                      className="flex flex-col rounded-2xl border overflow-hidden transition-all"
                      style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}
                    >
                      <div className="flex items-center justify-between p-3 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div 
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                            style={{ backgroundColor: cat.color }}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-bold truncate" style={{ color: theme.textPrimary }}>{cat.name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono" style={{ color: theme.textMuted }}>
                                {cat.isCustom ? 'Custom' : 'Default'}
                              </span>
                              <span className="text-[10px]" style={{ color: theme.textMuted }}>•</span>
                              <span className="text-[10px] font-mono" style={{ color: theme.primary }}>
                                {catSubList.length} sub-item{catSubList.length === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Quick Add Sub-Category button for this category */}
                          <button
                            type="button"
                            onClick={() => {
                              triggerHapticFeedback();
                              setSelectedParentId(cat.id);
                              setIsAddingSubCategory(true);
                            }}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 border"
                            style={{ color: theme.primary, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                            title="Add subcategory for this category"
                          >
                            <Plus size={11} /> Sub
                          </button>

                          {/* Accordion toggle button */}
                          {catSubList.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(cat.id)}
                              className="p-1.5 rounded-lg transition-colors cursor-pointer"
                              style={{ color: theme.textMuted }}
                              title="Toggle subcategories"
                            >
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                          )}

                          {cat.isCustom && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerHapticFeedback();
                                if (confirm(`Delete custom category "${cat.name}" and its subcategories?`)) {
                                  onDeleteCategory(cat.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete category"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable subcategory drawer */}
                      {isExpanded && catSubList.length > 0 && (
                        <div className="px-4 pb-3 pt-1 border-t flex flex-col gap-1.5" style={{ borderColor: theme.borderSubtle, backgroundColor: theme.inputBg }}>
                          <span className="text-[9px] uppercase font-mono tracking-widest" style={{ color: theme.textMuted }}>
                            Sub-categories of {cat.name}:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {catSubList.map(sc => (
                              <div
                                key={sc.id}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs"
                                style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle, color: theme.textPrimary }}
                              >
                                <Tag size={10} style={{ color: theme.primary }} />
                                <span>{sc.name}</span>
                                {sc.isCustom && onDeleteSubCategory && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHapticFeedback();
                                      if (confirm(`Delete sub-category "${sc.name}"?`)) {
                                        onDeleteSubCategory(sc.id);
                                      }
                                    }}
                                    className="ml-1 text-neutral-500 hover:text-rose-400 cursor-pointer"
                                    title="Delete subcategory"
                                  >
                                    <X size={11} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* 4. DEDICATED SUBCATEGORIES TAB VIEW */
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback();
                    if (currentCategories.length > 0) {
                      setSelectedParentId(currentCategories[0].id);
                    }
                    setIsAddingSubCategory(true);
                  }}
                  className="w-full py-2.5 rounded-2xl border border-dashed flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer mb-1"
                  style={{ borderColor: theme.primary, color: theme.primary, backgroundColor: 'rgba(16, 185, 129, 0.05)' }}
                >
                  <Plus size={16} /> Add Custom {activeTab === 'expense' ? 'Expense' : 'Income'} Sub-Category
                </button>

                {currentSubCategories.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center border border-dashed rounded-2xl" style={{ borderColor: theme.borderSubtle, backgroundColor: theme.surfaceMuted }}>
                    <Tag size={24} style={{ color: theme.textMuted }} className="mb-2" />
                    <span className="text-xs font-bold" style={{ color: theme.textPrimary }}>No Sub-Categories Yet</span>
                    <span className="text-[10px] mt-0.5" style={{ color: theme.textMuted }}>
                      Create subcategories to organize your {activeTab}s with fine detail.
                    </span>
                  </div>
                ) : (
                  currentSubCategories.map(sc => {
                    const parent = categories.find(c => c.id === sc.parentId);
                    return (
                      <div
                        key={sc.id}
                        className="flex items-center justify-between p-3 rounded-2xl border transition-colors"
                        style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div 
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 text-xs shadow-sm"
                            style={{ backgroundColor: parent?.color || sc.color || '#10B981' }}
                          >
                            <Tag size={13} />
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-bold truncate" style={{ color: theme.textPrimary }}>{sc.name}</span>
                            <span className="text-[10px] font-mono mt-0.5 truncate" style={{ color: theme.textSecondary }}>
                              Under: {parent?.name || 'Category'}
                            </span>
                          </div>
                        </div>

                        {sc.isCustom && onDeleteSubCategory && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHapticFeedback();
                              if (confirm(`Delete sub-category "${sc.name}"?`)) {
                                onDeleteSubCategory(sc.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                            title="Delete subcategory"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
    </div>
  );

  if (isInline) {
    return contentElement;
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 backdrop-blur-sm z-[90] flex items-center justify-center p-4" style={{ backgroundColor: theme.overlay }}>
        <div className="absolute inset-0" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={`w-full max-w-md max-h-[85vh] overflow-y-auto p-4 shadow-2xl relative z-[91] border ${themeRadius}`}
          style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
        >
          {contentElement}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
