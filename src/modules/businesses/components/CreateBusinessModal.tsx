/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Building2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { BusinessType } from '../../../domain/businesses/Business';
import { CreateBusinessWorkspaceParams } from '../../../application/services/WorkspaceService';

interface CreateBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: CreateBusinessWorkspaceParams) => Promise<void>;
  theme: AppTheme;
}

export function CreateBusinessModal({
  isOpen,
  onClose,
  onSubmit,
  theme
}: CreateBusinessModalProps) {
  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('retail');
  const [currencyCode, setCurrencyCode] = useState('PKR');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Business Name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        businessType,
        currencyCode: currencyCode.trim().toUpperCase(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        taxId: taxId.trim() || undefined,
        invoicePrefix: invoicePrefix.trim().toUpperCase() || 'INV'
      });
      triggerHapticFeedback();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create business workspace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 backdrop-blur-sm cursor-pointer"
          style={{ backgroundColor: theme.overlay }}
        />

        {/* Modal Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md max-h-[90vh] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border flex flex-col gap-4 overflow-hidden z-10 text-left"
          style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: theme.borderSubtle }}>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono tracking-widest font-bold uppercase" style={{ color: theme.primary }}>
                New Workspace Setup
              </span>
              <h2 className="text-lg font-black mt-0.5 flex items-center gap-2" style={{ color: theme.textPrimary }}>
                <Building2 size={18} style={{ color: theme.primary }} />
                Register Business
              </h2>
            </div>
            <button
              onClick={() => {
                triggerHapticFeedback();
                onClose();
              }}
              className="p-2 rounded-xl transition-colors cursor-pointer"
              style={{ backgroundColor: theme.surfaceMuted, color: theme.textPrimary }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Explainer Box */}
            <div className="p-3.5 rounded-2xl border flex gap-3 text-xs" style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle, color: theme.textSecondary }}>
              <ShieldCheck size={20} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Creates an independent, fully isolated business environment with its own Chart of Accounts, customers, suppliers, inventory, and invoices.
              </span>
            </div>

            {/* Business Name */}
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                Business Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Apex Supermarket"
                className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
              />
            </div>

            {/* Business Type */}
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                Business Model / Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={businessType}
                onChange={e => setBusinessType(e.target.value as BusinessType)}
                className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
              >
                <option value="retail" style={{ backgroundColor: theme.surfaceElevated, color: theme.textPrimary }}>Retail (POS / Storefront)</option>
                <option value="wholesale" style={{ backgroundColor: theme.surfaceElevated, color: theme.textPrimary }}>Wholesale (B2B Bulk)</option>
                <option value="services" style={{ backgroundColor: theme.surfaceElevated, color: theme.textPrimary }}>Services & Consulting</option>
                <option value="distributor" style={{ backgroundColor: theme.surfaceElevated, color: theme.textPrimary }}>Distribution & Supply</option>
                <option value="general" style={{ backgroundColor: theme.surfaceElevated, color: theme.textPrimary }}>General Commercial</option>
              </select>
            </div>

            {/* Currency & Invoice Prefix */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                  Base Currency
                </label>
                <input
                  type="text"
                  value={currencyCode}
                  onChange={e => setCurrencyCode(e.target.value.toUpperCase())}
                  placeholder="PKR"
                  maxLength={5}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm font-mono focus:outline-none"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                  Invoice Prefix
                </label>
                <input
                  type="text"
                  value={invoicePrefix}
                  onChange={e => setInvoicePrefix(e.target.value.toUpperCase())}
                  placeholder="INV"
                  maxLength={8}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm font-mono focus:outline-none"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                />
              </div>
            </div>

            {/* Tax ID */}
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                Tax / NTN Registration (Optional)
              </label>
              <input
                type="text"
                value={taxId}
                onChange={e => setTaxId(e.target.value)}
                placeholder="e.g. 1234567-8"
                className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
              />
            </div>

            {/* Contact Phone & Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="shop@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                Store / Office Address (Optional)
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Market Plaza, Lahore"
                className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                {isSubmitting ? 'Initializing Workspace...' : 'Create & Launch Business'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
