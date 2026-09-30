/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Plus, Trash2, Check,
  Home, ShoppingCart, Car, Smartphone, Zap, Award, Heart, Camera, Laptop, Gift,
  Coffee, Briefcase, Utensils, BookOpen, DollarSign, Music, Gamepad, Smile, Compass,
  Tv, HeartHandshake, Activity, Baby, Scale, Dumbbell,
  Pizza, CupSoda, Cake, Soup, Shirt, Watch, Sparkles, Pill, Stethoscope, PartyPopper,
  Hammer, ShoppingBag, Pencil, Bus, Plane, Footprints, Shield, Film,
  TrendingUp, Percent, RotateCcw, CreditCard, Droplet, Wifi, Fuel
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
  TrendingUp, Percent, RotateCcw, CreditCard, Droplet, Wifi, Fuel
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
  onAddCategory: (category: Omit<Category, 'id' | 'isCustom' | 'isEnabled'>) => void;
  onDeleteCategory: (id: string) => void;
  currencySymbol: string;
  themeCardBg: string;
  themeBorder: string;
  themeRadius: string;
}

export default function CategoryManager({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onDeleteCategory,
  themeCardBg,
  themeBorder,
  themeRadius
}: CategoryManagerProps) {
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [isAdding, setIsAdding] = useState(false);
  
  // New Category Form state
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(HARMONIOUS_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState('ShoppingCart');

  if (!isOpen) return null;

  const currentCategories = categories.filter(c => c.type === activeTab);

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a category name');
      return;
    }
    
    onAddCategory({
      name: name.trim(),
      type: activeTab,
      icon: selectedIcon,
      color: selectedColor
    });

    // Reset Form
    setName('');
    setSelectedColor(HARMONIOUS_COLORS[0]);
    setSelectedIcon('ShoppingCart');
    setIsAdding(false);
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
          <div className="flex justify-between items-center p-5 border-b" style={{ borderColor: themeBorder }}>
            <div className="flex flex-col text-left">
              <span className="text-xs text-neutral-400 font-mono tracking-widest uppercase">Customization</span>
              <h2 className="text-base font-bold text-white">Manage Categories</h2>
            </div>
            <button
              onClick={() => {
                triggerHapticFeedback();
                onClose();
              }}
              className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Type Switcher Tabs */}
          <div className="flex p-3 gap-2 border-b" style={{ borderColor: themeBorder }}>
            <button
              onClick={() => {
                triggerHapticFeedback();
                setActiveTab('expense');
                setIsAdding(false);
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
              onClick={() => {
                triggerHapticFeedback();
                setActiveTab('income');
                setIsAdding(false);
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

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 scrollbar-none text-left">
            {isAdding ? (
              /* ADD NEW CATEGORY VIEW */
              <div className="flex flex-col gap-5">
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
                      placeholder="e.g. Pet Care, Online Games"
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
                  <div className="grid grid-cols-6 gap-2 max-h-44 overflow-y-auto p-1 bg-white/2 rounded-2xl border" style={{ borderColor: themeBorder }}>
                    {Object.entries(CATEGORY_ICONS_MAP).map(([iconName, IconComponent]) => (
                      <button
                        key={iconName}
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

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      triggerHapticFeedback();
                      setIsAdding(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-neutral-400 hover:text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      triggerHapticFeedback();
                      handleSave();
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-95"
                  >
                    Save Category
                  </button>
                </div>
              </div>
            ) : (
              /* CATEGORIES LIST VIEW */
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    triggerHapticFeedback();
                    setIsAdding(true);
                  }}
                  className="w-full py-3 rounded-2xl border border-dashed border-white/20 hover:border-white/40 flex items-center justify-center gap-2 text-xs font-bold text-neutral-300 hover:text-white transition-all cursor-pointer bg-white/2 mb-2"
                >
                  <Plus size={16} /> Add Custom {activeTab === 'expense' ? 'Expense' : 'Income'} Category
                </button>

                {currentCategories.map(cat => {
                  const Icon = CATEGORY_ICONS_MAP[cat.icon] || Home;
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white/2 border border-white/5 hover:bg-white/4 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: cat.color }}
                        >
                          <Icon size={18} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">{cat.name}</span>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {cat.isCustom ? 'Custom Category' : 'Default Pre-configured'}
                          </span>
                        </div>
                      </div>

                      {cat.isCustom && (
                        <button
                          onClick={() => {
                            triggerHapticFeedback();
                            if (confirm(`Delete custom category "${cat.name}"?`)) {
                              onDeleteCategory(cat.id);
                            }
                          }}
                          className="p-2 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Delete category"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
