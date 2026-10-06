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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
        {/* Backdrop close */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={`w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative z-[91] border ${themeRadius}`}
          style={{ backgroundColor: themeCardBg, borderColor: themeBorder }}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b gap-3" style={{ borderColor: themeBorder }}>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-xl text-xs font-bold text-neutral-200 hover:text-white cursor-pointer transition-all active:scale-95 shadow-sm"
              title="Back to Home"
            >
              <ArrowLeft size={14} className="text-emerald-400" />
              <span>Back to Home</span>
            </button>
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-neutral-400 font-mono tracking-widest uppercase">Customization</span>
              <h2 className="text-sm font-bold text-white">Categories</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                onClose();
              }}
              className="p-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 transition-colors cursor-pointer"
              title="Close"
            >
              <X size={16} className="text-rose-400" />
            </button>
          </div>

          {/* Income vs Expense Tabs */}
          <div className="flex p-3 gap-2 border-b" style={{ borderColor: themeBorder }}>
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setActiveTab('expense');
                setIsAddingCategory(false);
                setIsAddingSubCategory(false);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'expense' 
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                  : 'text-neutral-400 hover:text-white bg-white/5'
              }`}
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
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'income' 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'text-neutral-400 hover:text-white bg-white/5'
              }`}
            >
              Income Categories
            </button>
          </div>

          {/* Sub-navigation: Categories vs Sub-Categories View */}
          <div className="flex px-4 pt-3 pb-2 gap-2 border-b border-white/5">
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback();
                setViewMode('categories');
                setIsAddingCategory(false);
                setIsAddingSubCategory(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                viewMode === 'categories'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                viewMode === 'subcategories'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
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
                    <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 mb-1 block">Category Name</label>
                    <input
                      type="text"
                      placeholder={activeTab === 'income' ? "e.g. Consulting, Royalties" : "e.g. Pet Care, Online Games"}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/5 border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      style={{ borderColor: themeBorder }}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Color Swatches */}
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 mb-2 block">Select Color</label>
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
                  <label className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 mb-2 block">Select Icon ({Object.keys(CATEGORY_ICONS_MAP).length} Available)</label>
                  <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1 bg-white/2 rounded-2xl border" style={{ borderColor: themeBorder }}>
                    {Object.entries(CATEGORY_ICONS_MAP).map(([iconName, IconComponent]) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback();
                          setSelectedIcon(iconName);
                        }}
                        className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          selectedIcon === iconName 
                            ? 'bg-white/20 text-white border border-white/30 scale-105' 
                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                        }`}
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
                  <label className="text-xs text-neutral-400 font-medium">Select Parent Category</label>
                  <select
                    value={selectedParentId || currentCategories[0]?.id || ''}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    className="bg-neutral-900 border border-white/10 text-sm rounded-xl px-3 py-2.5 text-white outline-none cursor-pointer w-full"
                  >
                    {currentCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-400 font-medium">Sub-Category Name</label>
                  <input
                    type="text"
                    placeholder={activeTab === 'income' ? "e.g. Overtime, Client Retainer, Dividends" : "e.g. Snacks, Drinks, Car Wash"}
                    value={subCatName}
                    onChange={(e) => setSubCatName(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
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
                    className="py-2.5 px-3 rounded-2xl border border-dashed border-emerald-500/30 hover:border-emerald-500/60 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/5 transition-all cursor-pointer"
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
                    className="py-2.5 px-3 rounded-2xl border border-dashed border-blue-500/30 hover:border-blue-500/60 flex items-center justify-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-500/5 transition-all cursor-pointer"
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
                      className="flex flex-col rounded-2xl bg-white/2 border border-white/5 overflow-hidden transition-all"
                    >
                      <div className="flex items-center justify-between p-3 hover:bg-white/4 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div 
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                            style={{ backgroundColor: cat.color }}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-bold text-white truncate">{cat.name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-neutral-500 font-mono">
                                {cat.isCustom ? 'Custom' : 'Default'}
                              </span>
                              <span className="text-[10px] text-neutral-500">•</span>
                              <span className="text-[10px] text-emerald-400/90 font-mono">
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
                            className="px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors cursor-pointer flex items-center gap-1"
                            title="Add subcategory for this category"
                          >
                            <Plus size={11} /> Sub
                          </button>

                          {/* Accordion toggle button */}
                          {catSubList.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(cat.id)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                        <div className="px-4 pb-3 pt-1 border-t border-white/5 bg-black/20 flex flex-col gap-1.5">
                          <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-500">
                            Sub-categories of {cat.name}:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {catSubList.map(sc => (
                              <div
                                key={sc.id}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300 text-xs"
                              >
                                <Tag size={10} className="text-emerald-400" />
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
                  className="w-full py-2.5 rounded-2xl border border-dashed border-emerald-500/30 hover:border-emerald-500/60 flex items-center justify-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/5 transition-all cursor-pointer mb-1"
                >
                  <Plus size={16} /> Add Custom {activeTab === 'expense' ? 'Expense' : 'Income'} Sub-Category
                </button>

                {currentSubCategories.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/1">
                    <Tag size={24} className="text-neutral-500 mb-2" />
                    <span className="text-xs font-bold text-neutral-300">No Sub-Categories Yet</span>
                    <span className="text-[10px] text-neutral-500 mt-0.5">
                      Create subcategories to organize your {activeTab}s with fine detail.
                    </span>
                  </div>
                ) : (
                  currentSubCategories.map(sc => {
                    const parent = categories.find(c => c.id === sc.parentId);
                    return (
                      <div
                        key={sc.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white/2 border border-white/5 hover:bg-white/4 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div 
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 text-xs shadow-sm"
                            style={{ backgroundColor: parent?.color || sc.color || '#10B981' }}
                          >
                            <Tag size={13} />
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-bold text-white truncate">{sc.name}</span>
                            <span className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate">
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
