/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { PartyRecord } from '../../../infrastructure/database/repositories/PartyRepository';

interface CreatePartyModalProps {
  isOpen: boolean;
  workspaceName: string;
  currencySymbol: string;
  existingParties?: PartyRecord[];
  onClose: () => void;
  onSubmit: (params: {
    name: string;
    type: 'customer' | 'supplier' | 'both';
    companyName?: string;
    contactPersonName?: string;
    contactPersonPhone?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    creditLimitScaled?: bigint;
    openingBalanceScaled?: bigint;
    openingBalanceType?: 'receivable' | 'payable' | 'zero';
    openingBalanceDate?: string;
  }) => Promise<void>;
  theme: AppTheme;
}

export function CreatePartyModal({
  isOpen,
  workspaceName,
  currencySymbol,
  existingParties = [],
  onClose,
  onSubmit,
  theme
}: CreatePartyModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'customer' | 'supplier' | 'both'>('customer');
  const [companyName, setCompanyName] = useState('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactPersonPhone, setContactPersonPhone] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [creditLimit, setCreditLimit] = useState('');

  // Opening balance fields
  const [hasOpeningBalance, setHasOpeningBalance] = useState(false);
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState('');
  const [openingBalanceType, setOpeningBalanceType] = useState<'receivable' | 'payable'>('receivable');
  const [openingBalanceDate, setOpeningBalanceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Duplicate warning detection
  const potentialDuplicate = useMemo(() => {
    const trimmedName = name.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    if (!trimmedName && !trimmedPhone) return null;

    return existingParties.find(p => {
      const nameMatch = trimmedName && p.name.trim().toLowerCase() === trimmedName;
      const phoneMatch = trimmedPhone && p.phone && p.phone.trim() === trimmedPhone;
      return nameMatch || phoneMatch;
    }) || null;
  }, [name, phone, existingParties]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Contact / Party Name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const creditScaled = creditLimit ? BigInt(Math.round(Number(creditLimit) * 10000)) : 0n;
      const obAmountScaled = hasOpeningBalance && openingBalanceAmount
        ? BigInt(Math.round(Number(openingBalanceAmount) * 10000))
        : 0n;

      await onSubmit({
        name: name.trim(),
        type,
        companyName: companyName.trim() || undefined,
        contactPersonName: contactPersonName.trim() || undefined,
        contactPersonPhone: contactPersonPhone.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        creditLimitScaled: creditScaled,
        openingBalanceScaled: obAmountScaled,
        openingBalanceType: hasOpeningBalance && obAmountScaled > 0n ? openingBalanceType : 'zero',
        openingBalanceDate: hasOpeningBalance && obAmountScaled > 0n ? openingBalanceDate : undefined
      });

      triggerHapticFeedback();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create party.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
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
          className="relative w-full max-w-lg max-h-[90vh] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border flex flex-col gap-4 overflow-hidden z-10 text-left"
          style={{ backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, color: theme.textPrimary }}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: theme.borderSubtle }}>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono tracking-widest font-bold uppercase" style={{ color: theme.primary }}>
                Workspace Context: {workspaceName}
              </span>
              <h2 className="text-lg font-black mt-0.5 flex items-center gap-2" style={{ color: theme.textPrimary }}>
                <Users size={18} style={{ color: theme.primary }} />
                Add Customer / Supplier / Distributor
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

            {/* Duplicate Warning Flow */}
            {potentialDuplicate && (
              <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-white">Possible Duplicate Contact Found:</span>
                  <span className="font-mono text-[11px]" style={{ color: theme.textPrimary }}>
                    "{potentialDuplicate.name}" (Role: {potentialDuplicate.type}, Phone: {potentialDuplicate.phone || 'N/A'}) already exists.
                  </span>
                  <span className="text-[10px] text-amber-200/80">
                    If this entity both buys and sells (e.g. distributor), select the <strong>"Both (B2B)"</strong> role below instead of creating duplicate records.
                  </span>
                </div>
              </div>
            )}

            {/* Type selector */}
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                Party Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['customer', 'supplier', 'both'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setType(t);
                      if (t === 'supplier') setOpeningBalanceType('payable');
                      else setOpeningBalanceType('receivable');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-colors cursor-pointer border ${
                      type === t
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'hover:opacity-80'
                    }`}
                    style={type === t ? undefined : { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle, color: theme.textSecondary }}
                  >
                    {t === 'both' ? 'Both (B2B / Distributor)' : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Name & Company */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                  Contact / Trade Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Tariq Traders"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                  Company / Organization
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Tariq Goods Co."
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                />
              </div>
            </div>

            {/* Contact Person Details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                  Contact Person Name
                </label>
                <input
                  type="text"
                  value={contactPersonName}
                  onChange={e => setContactPersonName(e.target.value)}
                  placeholder="e.g. Muhammad Aslam"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                  Contact Person Phone
                </label>
                <input
                  type="tel"
                  value={contactPersonPhone}
                  onChange={e => setContactPersonPhone(e.target.value)}
                  placeholder="0321-7654321"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                />
              </div>
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                  Main Phone / Mobile
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
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="client@mail.com"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                />
              </div>
            </div>

            {/* Credit Limit & Address */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                  Credit Limit ({currencySymbol})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={creditLimit}
                  onChange={e => setCreditLimit(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm font-mono focus:outline-none"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                  Business Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Shop 12, Wholesale Market"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                />
              </div>
            </div>

            {/* OPENING BALANCE PROCESS SECTION */}
            <div className="pt-2 border-t" style={{ borderColor: theme.borderSubtle }}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold" style={{ color: theme.textPrimary }}>
                  <input
                    type="checkbox"
                    checked={hasOpeningBalance}
                    onChange={e => setHasOpeningBalance(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0"
                  />
                  <span>Record Initial Opening Balance</span>
                </label>
                <span className="text-[10px] text-purple-400 font-mono flex items-center gap-1">
                  <Clock size={12} /> Khata Migration
                </span>
              </div>

              {hasOpeningBalance && (
                <div className="p-3.5 rounded-2xl border space-y-3" style={{ backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }}>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOpeningBalanceType('receivable')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer text-left ${
                        openingBalanceType === 'receivable'
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : 'hover:opacity-80'
                      }`}
                      style={openingBalanceType === 'receivable' ? undefined : { backgroundColor: theme.inputBg, borderColor: theme.borderSubtle, color: theme.textSecondary }}
                    >
                      <div className="font-bold">Receivable</div>
                      <div className="text-[9px]" style={{ color: theme.textMuted }}>Customer owes us</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpeningBalanceType('payable')}
                      className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer text-left ${
                        openingBalanceType === 'payable'
                          ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                          : 'hover:opacity-80'
                      }`}
                      style={openingBalanceType === 'payable' ? undefined : { backgroundColor: theme.inputBg, borderColor: theme.borderSubtle, color: theme.textSecondary }}
                    >
                      <div className="font-bold">Payable</div>
                      <div className="text-[9px]" style={{ color: theme.textMuted }}>We owe supplier</div>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold mb-1" style={{ color: theme.textSecondary }}>
                        Amount ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={openingBalanceAmount}
                        onChange={e => setOpeningBalanceAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl border font-mono text-sm focus:outline-none"
                        style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold mb-1" style={{ color: theme.textSecondary }}>
                        As-of Date
                      </label>
                      <input
                        type="date"
                        value={openingBalanceDate}
                        onChange={e => setOpeningBalanceDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none"
                        style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
                      />
                    </div>
                  </div>

                  <p className="text-[10px] leading-relaxed font-sans" style={{ color: theme.textMuted }}>
                    Documented opening-balance process: Creates corresponding double-entry accounting entries against Owner Equity (offset) without distorting current-period sales or purchases.
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: theme.textSecondary }}>
                Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes or terms..."
                className="w-full px-4 py-2 rounded-xl border text-xs focus:outline-none resize-none"
                style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }}
              />
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                {isSubmitting ? 'Saving Contact...' : 'Add to Business Contacts'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
