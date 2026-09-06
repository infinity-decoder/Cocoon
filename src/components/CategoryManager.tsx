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
import { Category } from '../types';

// Large set of highly recognizable icons from Lucide for the Icon Picker
export const CATEGORY_ICONS_MAP: Record<string, React.ComponentType<any>> = {
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
  currencySymbol,
  themeCardBg,
  themeBorder,
  themeRadius
}: CategoryManagerProps) {
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Home');
  const [selectedColor, setSelectedColor] = useState(HARMONIOUS_COLORS[0]);

  const filteredCategories = categories.filter(c => c.type === activeTab && c.isEnabled);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddCategory({
      name: name.trim(),
      type: activeTab,
      icon: selectedIcon,
      color: selectedColor
    });

    // Reset Form
    setName('');
    setSelectedIcon('Home');
    setSelectedColor(HARMONIOUS_COLORS[0]);
    setShowAddForm(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 font-sans">
        {/* Click outside backdrop to close */}
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
          <div className="p-4.5 border-b flex justify-between items-center" style={{ borderColor: themeBorder }}>
            <div>
              <h3 className="text-base font-black text-white font-display">Category Manager</h3>
              <p className="text-[11px] text-neutral-400 font-mono">Customize custom tags & visual icons</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab switches */}
          <div className="grid grid-cols-2 gap-1 p-2 bg-black/20" style={{ borderColor: themeBorder }}>
            <button
              onClick={() => {
                setActiveTab('expense');
                setShowAddForm(false);
              }}
              className={`py-2 text-xs font-bold tracking-wide rounded-xl uppercase transition-all cursor-pointer ${
                activeTab === 'expense'
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 font-extrabold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Expense Categories
            </button>
            <button
              onClick={() => {
                setActiveTab('income');
                setShowAddForm(false);
              }}
              className={`py-2 text-xs font-bold tracking-wide rounded-xl uppercase transition-all cursor-pointer ${
                activeTab === 'income'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-extrabold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Income Categories
            </button>
          </div>

          {/* Body List or Add Form */}
          <div className="flex-1 overflow-y-auto p-4.5 space-y-4">
            {!showAddForm ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {filteredCategories.map((cat) => {
                    const IconComponent = CATEGORY_ICONS_MAP[cat.icon] || Home;
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white/3 border border-white/5 group hover:border-white/10 transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8.5 h-8.5 rounded-xl flex items-center justify-center text-white"
                            style={{ backgroundColor: cat.color }}
                          >
                            <IconComponent size={16} strokeWidth={2.5} />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-[12px] font-bold text-white truncate max-w-[100px]">{cat.name}</span>
                            <span className="text-[9px] text-neutral-400 font-mono">
                              {cat.isCustom ? 'Custom' : 'System'}
                            </span>
                          </div>
                        </div>

                        {cat.isCustom && (
                          <button
                            onClick={() => onDeleteCategory(cat.id)}
                            className="p-1.5 hover:bg-rose-500/20 rounded-lg text-neutral-400 hover:text-rose-400 cursor-pointer transition-colors"
                            title="Delete custom category"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Custom Category Trigger */}
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full py-3.5 rounded-2xl border border-dashed border-white/10 hover:border-white/20 text-neutral-400 hover:text-white flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer bg-white/2 hover:bg-white/4 mt-4"
                >
                  <Plus size={16} />
                  Add Custom Category
                </button>
              </>
            ) : (
              // Add custom category Form View
              <form onSubmit={handleSave} className="space-y-4.5 text-left">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-neutral-400 mb-1.5">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Biryani Treat, Petrol, Chai"
                    className="w-full px-4 py-3 bg-white/4 border border-white/10 rounded-xl text-white text-xs font-medium focus:outline-none focus:border-emerald-500/50 animate-none"
                  />
                </div>

                {/* Color swatches picker */}
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-neutral-400 mb-1.5">
                    Select Swatch Color
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {HARMONIOUS_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className="aspect-square rounded-xl flex items-center justify-center relative cursor-pointer transform active:scale-90 transition-transform"
                        style={{ backgroundColor: color }}
                      >
                        {selectedColor === color && (
                          <div className="w-5 h-5 rounded-full bg-black/30 flex items-center justify-center text-white">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lucide Icon Picker grid */}
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-wider text-neutral-400 mb-1.5">
                    Select Vector Icon
                  </label>
                  <div className="grid grid-cols-6 gap-2 max-h-[140px] overflow-y-auto p-1.5 bg-black/20 rounded-xl border border-white/5">
                    {Object.keys(CATEGORY_ICONS_MAP).map((iconName) => {
                      const IconComponent = CATEGORY_ICONS_MAP[iconName];
                      const isSelected = selectedIcon === iconName;
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setSelectedIcon(iconName)}
                          className={`aspect-square rounded-xl flex items-center justify-center cursor-pointer border transition-all ${
                            isSelected 
                              ? 'bg-emerald-500 border-emerald-400 text-white animate-none' 
                              : 'bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10'
                          }`}
                        >
                          <IconComponent size={16} strokeWidth={2.5} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Controls */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="py-3 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-300 hover:text-white text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-white text-xs font-bold transition-all cursor-pointer text-center shadow-lg"
                  >
                    Save Category
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
