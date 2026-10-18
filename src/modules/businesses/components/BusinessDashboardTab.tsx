/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, Users, Package, FileText, 
  ArrowLeft, Plus, Archive, ShieldCheck, 
  ChevronRight, BookOpen, AlertCircle, ShoppingBag, 
  Truck, ArrowUpRight, ArrowDownLeft, CreditCard,
  RotateCcw, Search, Filter, CheckCircle2,
  ArrowRightLeft, Scale, Layers, Barcode, Sliders, History, Tag, AlertTriangle
} from 'lucide-react';
import { AppTheme } from '../../../core/theme';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { WorkspaceWithProfile } from '../../../application/services/WorkspaceService';
import { PartyRecord } from '../../../infrastructure/database/repositories/PartyRepository';
import { ProductRecord } from '../../../infrastructure/database/repositories/ProductRepository';
import { DocumentWithLines } from '../../../infrastructure/database/repositories/DocumentRepository';
import { AccountRecord } from '../../../infrastructure/database/repositories/AccountRepository';
import { useWorkspace } from '../../../app/WorkspaceContext';
import { 
  PartyStatementModal, 
  RecordPaymentModal, 
  ReversePaymentModal, 
  ControlAccountsReconciliationModal 
} from '../../parties';
import { 
  InterWorkspaceTransferModal, 
  ChartOfAccountsModal, 
  IntraAccountTransferModal 
} from '../../accounting';
import { 
  StockMovementsModal, 
  StockAdjustmentModal, 
  BarcodeScannerModal 
} from '../../inventory/components';

interface BusinessDashboardTabProps {
  workspace: WorkspaceWithProfile;
  summary: {
    customerCount: number;
    supplierCount: number;
    productCount: number;
    documentCount: number;
    accountCount: number;
    totalSalesScaled: bigint;
    totalPurchasesScaled: bigint;
    receivablesScaled: bigint;
    payablesScaled: bigint;
    inventoryValuationScaled: bigint;
  } | null;
  parties: PartyRecord[];
  products: ProductRecord[];
  documents: DocumentWithLines[];
  accounts: AccountRecord[];
  currencySymbol: string;
  theme: AppTheme;
  onReturnToPersonal: () => void;
  onOpenWorkspaceSelector: () => void;
  onOpenCreateParty: () => void;
  onOpenCreateProduct: () => void;
  onOpenCreateDocument: () => void;
  onArchiveWorkspace?: (workspaceId: string) => void;
}

export function BusinessDashboardTab({
  workspace,
  summary,
  parties,
  products,
  documents,
  accounts,
  currencySymbol,
  theme,
  onReturnToPersonal,
  onOpenWorkspaceSelector,
  onOpenCreateParty,
  onOpenCreateProduct,
  onOpenCreateDocument,
  onArchiveWorkspace
}: BusinessDashboardTabProps) {
  const ws = useWorkspace();
  const [activeSection, setActiveSection] = useState<'overview' | 'documents' | 'parties' | 'inventory' | 'accounts'>('overview');
  const [selectedPartyForStatement, setSelectedPartyForStatement] = useState<PartyRecord | null>(null);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentPartyForModal, setPaymentPartyForModal] = useState<PartyRecord | null>(null);
  const [reversalModalData, setReversalModalData] = useState<{
    isOpen: boolean;
    paymentId: string;
    paymentNumber: string;
    amountFormatted: string;
  } | null>(null);
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);
  const [isInterTransferOpen, setIsInterTransferOpen] = useState(false);
  const [isChartOfAccountsOpen, setIsChartOfAccountsOpen] = useState(false);
  const [isIntraTransferOpen, setIsIntraTransferOpen] = useState(false);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [partyRoleFilter, setPartyRoleFilter] = useState<'all' | 'customer' | 'supplier' | 'both'>('all');

  // Inventory & Barcode state
  const [isStockMovementsOpen, setIsStockMovementsOpen] = useState(false);
  const [selectedProductIdForMovements, setSelectedProductIdForMovements] = useState<string | undefined>(undefined);
  const [isStockAdjustmentOpen, setIsStockAdjustmentOpen] = useState(false);
  const [selectedProductIdForAdjustment, setSelectedProductIdForAdjustment] = useState<string | undefined>(undefined);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  const formatScaled = (scaledVal?: bigint) => {
    if (scaledVal === undefined || scaledVal === null) return '0.00';
    const num = Number(scaledVal) / 10000;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const salesInvoices = documents.filter(d => d.documentType === 'sales_invoice');
  const purchaseBills = documents.filter(d => d.documentType === 'purchase_bill');

  return (
    <div className="flex flex-col gap-5 text-left pb-16">
      {/* 1. ACTIVE WORKSPACE CONTEXT HERO HEADER */}
      <div 
        className="p-5 rounded-[28px] border shadow-sm flex flex-col gap-3 relative overflow-hidden"
        style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <Building2 size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono tracking-widest text-blue-400 font-bold uppercase">
                Active Business Workspace
              </span>
              <h1 className="text-xl font-black text-white tracking-tight">
                {workspace.name}
              </h1>
              <div className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5 font-mono">
                <span className="capitalize">{workspace.profile?.businessType || 'General'}</span>
                <span>·</span>
                <span>{workspace.currencyCode}</span>
                {workspace.taxId && (
                  <>
                    <span>·</span>
                    <span>Tax ID: {workspace.taxId}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHapticFeedback();
              onOpenWorkspaceSelector();
            }}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-neutral-300 border border-white/10 transition-colors cursor-pointer"
          >
            Switch
          </button>
        </div>

        {/* Quick Return to Personal Finance Barrier */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <button
            onClick={() => {
              triggerHapticFeedback();
              onReturnToPersonal();
            }}
            className="flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
          >
            <ArrowLeft size={14} />
            Return to Personal Finance
          </button>

          <span className="text-[10px] text-neutral-500 font-mono">
            ID: {workspace.id.slice(0, 16)}...
          </span>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION SECTION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['overview', 'documents', 'parties', 'inventory', 'accounts'] as const).map(sec => (
          <button
            key={sec}
            onClick={() => {
              triggerHapticFeedback();
              setActiveSection(sec);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
              activeSection === sec
                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {sec === 'parties' ? 'Customers & Suppliers' : sec}
          </button>
        ))}
      </div>

      {/* 3. SECTION CONTENT */}
      {activeSection === 'overview' && (
        <div className="flex flex-col gap-4">
          {/* Key Financial Metrics */}
          <div className="grid grid-cols-2 gap-3">
            {/* Total Sales */}
            <div 
              className="p-4 rounded-2xl border flex flex-col gap-1"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
            >
              <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
                <span>Total Sales</span>
                <ArrowUpRight size={16} className="text-emerald-400" />
              </div>
              <span className="text-lg font-black text-white font-mono mt-1">
                {currencySymbol} {formatScaled(summary?.totalSalesScaled)}
              </span>
              <span className="text-[10px] text-neutral-500">
                {salesInvoices.length} posted invoices
              </span>
            </div>

            {/* Total Purchases */}
            <div 
              className="p-4 rounded-2xl border flex flex-col gap-1"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
            >
              <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
                <span>Total Purchases</span>
                <ArrowDownLeft size={16} className="text-blue-400" />
              </div>
              <span className="text-lg font-black text-white font-mono mt-1">
                {currencySymbol} {formatScaled(summary?.totalPurchasesScaled)}
              </span>
              <span className="text-[10px] text-neutral-500">
                {purchaseBills.length} supplier bills
              </span>
            </div>

            {/* Receivables (A/R) */}
            <div 
              className="p-4 rounded-2xl border flex flex-col gap-1"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
            >
              <span className="text-neutral-400 text-xs font-medium">Receivables (A/R)</span>
              <span className="text-lg font-black text-emerald-400 font-mono mt-1">
                {currencySymbol} {formatScaled(summary?.receivablesScaled)}
              </span>
              <span className="text-[10px] text-neutral-500">
                Due from customers
              </span>
            </div>

            {/* Payables (A/P) */}
            <div 
              className="p-4 rounded-2xl border flex flex-col gap-1"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
            >
              <span className="text-neutral-400 text-xs font-medium">Payables (A/P)</span>
              <span className="text-lg font-black text-rose-400 font-mono mt-1">
                {currencySymbol} {formatScaled(summary?.payablesScaled)}
              </span>
              <span className="text-[10px] text-neutral-500">
                Due to suppliers
              </span>
            </div>
          </div>

          {/* Inventory Valuation Card */}
          <div 
            className="p-4 rounded-2xl border flex items-center justify-between"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                <Package size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Stock Valuation</span>
                <span className="text-[10px] text-neutral-400">{products.length} catalog items tracked</span>
              </div>
            </div>
            <span className="text-base font-black text-purple-400 font-mono">
              {currencySymbol} {formatScaled(summary?.inventoryValuationScaled)}
            </span>
          </div>

          {/* Quick Actions Bar */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <button
              onClick={() => {
                triggerHapticFeedback();
                onOpenCreateDocument();
              }}
              className="py-2.5 px-1.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
            >
              <FileText size={16} />
              <span>+ Invoice</span>
            </button>

            <button
              onClick={() => {
                triggerHapticFeedback();
                onOpenCreateParty();
              }}
              className="py-2.5 px-1.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
            >
              <Users size={16} />
              <span>+ Contact</span>
            </button>

            <button
              onClick={() => {
                triggerHapticFeedback();
                setPaymentPartyForModal(null);
                setIsRecordPaymentOpen(true);
              }}
              className="py-2.5 px-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
            >
              <CreditCard size={16} />
              <span>+ Payment</span>
            </button>

            <button
              onClick={() => {
                triggerHapticFeedback();
                setIsReconciliationOpen(true);
              }}
              className="py-2.5 px-1.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
            >
              <ShieldCheck size={16} />
              <span>Reconcile</span>
            </button>

            <button
              onClick={() => {
                triggerHapticFeedback();
                setIsInterTransferOpen(true);
              }}
              className="py-2.5 px-1.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
            >
              <ArrowRightLeft size={16} />
              <span>Transfer</span>
            </button>
          </div>

          {/* Recent Invoices Preview */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                Recent Invoices ({documents.length})
              </span>
              <button
                onClick={() => setActiveSection('documents')}
                className="text-xs text-blue-400 font-bold hover:underline cursor-pointer"
              >
                View All
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-white/10 text-center text-xs text-neutral-500">
                No invoices recorded yet in this business.
              </div>
            ) : (
              documents.slice(0, 4).map(doc => (
                <div
                  key={doc.id}
                  className="p-3.5 rounded-2xl border flex justify-between items-center"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-neutral-400">
                      <FileText size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">
                        {doc.partyName}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {doc.documentNumber} · {doc.issueDate}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-mono font-bold text-white">
                      {currencySymbol} {formatScaled(doc.totalScaled)}
                    </span>
                    <span className="text-[9px] capitalize text-neutral-400 font-mono">
                      {doc.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. DOCUMENTS SECTION */}
      {activeSection === 'documents' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
              Business Documents ({documents.length})
            </span>
            <button
              onClick={() => {
                triggerHapticFeedback();
                onOpenCreateDocument();
              }}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> New Document
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center flex flex-col items-center gap-2">
              <FileText size={28} className="text-neutral-500" />
              <span className="text-xs text-neutral-400">No documents or invoices posted yet.</span>
              <button
                onClick={onOpenCreateDocument}
                className="mt-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-500 text-white cursor-pointer"
              >
                Create First Invoice
              </button>
            </div>
          ) : (
            documents.map(doc => (
              <div
                key={doc.id}
                className="p-4 rounded-2xl border flex flex-col gap-2"
                style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">
                      {doc.partyName}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {doc.documentNumber} · {doc.documentType.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-black font-mono text-white">
                    {currencySymbol} {formatScaled(doc.totalScaled)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[10px] text-neutral-500 font-mono pt-1 border-t border-white/5">
                  <span>Issued: {doc.issueDate}</span>
                  <span>Due: {doc.dueDate}</span>
                  <span className="capitalize text-emerald-400">{doc.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 5. PARTIES & KHATA SECTION */}
      {activeSection === 'parties' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                Contacts & Khata ({parties.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  setIsReconciliationOpen(true);
                }}
                className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 hover:bg-teal-500/25 flex items-center gap-1 cursor-pointer transition-colors"
                title="Verify Khata ledgers against GL Control Accounts"
              >
                <ShieldCheck size={14} /> Reconcile
              </button>

              <button
                onClick={() => {
                  triggerHapticFeedback();
                  setPaymentPartyForModal(null);
                  setIsRecordPaymentOpen(true);
                }}
                className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <CreditCard size={14} /> Record Payment
              </button>

              <button
                onClick={() => {
                  triggerHapticFeedback();
                  onOpenCreateParty();
                }}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500 text-neutral-950 hover:bg-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus size={14} /> Add Contact
              </button>
            </div>
          </div>

          {/* Search & Role Filters */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search contact, phone, or company..."
                value={partySearchQuery}
                onChange={e => setPartySearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>

            <div className="flex gap-1">
              {(['all', 'customer', 'supplier', 'both'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => setPartyRoleFilter(role)}
                  className={`px-2.5 py-2 rounded-xl text-[10px] font-bold capitalize transition-colors cursor-pointer border ${
                    partyRoleFilter === role
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                  }`}
                >
                  {role === 'both' ? 'Both (B2B)' : role}
                </button>
              ))}
            </div>
          </div>

          {/* Parties List */}
          {(() => {
            const filteredParties = parties.filter(p => {
              const query = partySearchQuery.trim().toLowerCase();
              const matchesSearch = !query ||
                p.name.toLowerCase().includes(query) ||
                (p.phone && p.phone.toLowerCase().includes(query)) ||
                (p.companyName && p.companyName.toLowerCase().includes(query));
              const matchesRole = partyRoleFilter === 'all' ||
                p.type === partyRoleFilter ||
                (partyRoleFilter === 'customer' && p.type === 'both') ||
                (partyRoleFilter === 'supplier' && p.type === 'both');
              return matchesSearch && matchesRole;
            });

            if (filteredParties.length === 0) {
              return (
                <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center flex flex-col items-center gap-2">
                  <Users size={28} className="text-neutral-500" />
                  <span className="text-xs text-neutral-400">
                    {parties.length === 0 ? 'No customers or suppliers added yet.' : 'No contacts matching filters.'}
                  </span>
                  {parties.length === 0 && (
                    <button
                      onClick={onOpenCreateParty}
                      className="mt-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500 text-neutral-950 cursor-pointer"
                    >
                      Add First Contact
                    </button>
                  )}
                </div>
              );
            }

            return filteredParties.map(p => (
              <div
                key={p.id}
                onClick={() => {
                  triggerHapticFeedback();
                  setSelectedPartyForStatement(p);
                }}
                className="p-3.5 rounded-2xl border flex flex-col gap-2.5 transition-all hover:border-emerald-500/40 cursor-pointer"
                style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                      <Users size={18} />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{p.name}</span>
                        {p.companyName && (
                          <span className="text-[10px] text-neutral-400">({p.companyName})</span>
                        )}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-bold ${
                          p.type === 'customer'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : p.type === 'supplier'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-purple-500/20 text-purple-300'
                        }`}>
                          {p.type === 'both' ? 'Both (Distributor)' : p.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400 flex items-center gap-1.5 font-mono mt-0.5">
                        {p.phone && <span>{p.phone}</span>}
                        {p.contactPersonName && <span>· Contact: {p.contactPersonName}</span>}
                        {p.address && <span>· {p.address}</span>}
                      </span>
                    </div>
                  </div>

                  {p.creditLimitScaled > 0n && (
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[9px] text-neutral-500 font-mono">Credit Limit</span>
                      <span className="text-xs font-mono font-bold text-neutral-300">
                        {currencySymbol} {formatScaled(p.creditLimitScaled)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[10px] font-mono">
                  <span className="text-neutral-500">
                    {p.openingBalanceScaled > 0n
                      ? `Opening: ${currencySymbol} ${formatScaled(p.openingBalanceScaled)} (${p.openingBalanceType})`
                      : 'Khata active'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHapticFeedback();
                        setPaymentPartyForModal(p);
                        setIsRecordPaymentOpen(true);
                      }}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-400 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <CreditCard size={12} /> Pay / Receive
                    </button>
                    <span className="text-blue-400 font-bold flex items-center gap-0.5 hover:underline">
                      <BookOpen size={12} /> View Statement <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* 6. INVENTORY & PRODUCT CATALOG SECTION */}
      {activeSection === 'inventory' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
              Inventory & Products ({products.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  setIsBarcodeScannerOpen(true);
                }}
                className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25 flex items-center gap-1 cursor-pointer transition-colors"
                title="Scan barcode with camera or hardware wedge"
              >
                <Barcode size={14} /> Scan Barcode
              </button>

              <button
                onClick={() => {
                  triggerHapticFeedback();
                  setSelectedProductIdForAdjustment(undefined);
                  setIsStockAdjustmentOpen(true);
                }}
                className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 flex items-center gap-1 cursor-pointer transition-colors"
                title="Physical count audit or damage adjustment"
              >
                <Sliders size={14} /> Adjust Stock
              </button>

              <button
                onClick={() => {
                  triggerHapticFeedback();
                  setSelectedProductIdForMovements(undefined);
                  setIsStockMovementsOpen(true);
                }}
                className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 flex items-center gap-1 cursor-pointer transition-colors"
                title="View chronological stock movements ledger"
              >
                <History size={14} /> Ledger
              </button>

              <button
                onClick={() => {
                  triggerHapticFeedback();
                  onOpenCreateProduct();
                }}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-500 text-white hover:bg-purple-400 flex items-center gap-1 cursor-pointer transition-colors shadow-md"
              >
                <Plus size={14} /> Add Product
              </button>
            </div>
          </div>

          {/* Search & Stock Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search products by name, SKU, barcode, category, brand..."
                value={productSearchQuery}
                onChange={e => setProductSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border text-xs font-mono bg-neutral-900 text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                style={{ borderColor: theme.border }}
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => {
                    triggerHapticFeedback();
                    setProductStockFilter(filter);
                  }}
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-all capitalize shrink-0 cursor-pointer ${
                    productStockFilter === filter
                      ? 'bg-purple-500 text-white shadow-sm'
                      : 'bg-white/5 text-neutral-400 hover:text-white'
                  }`}
                >
                  {filter.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Product Items List */}
          {(() => {
            const filteredProducts = products.filter(prod => {
              const query = productSearchQuery.trim().toLowerCase();
              const matchesSearch = !query ||
                prod.name.toLowerCase().includes(query) ||
                (prod.sku && prod.sku.toLowerCase().includes(query)) ||
                (prod.barcode && prod.barcode.toLowerCase().includes(query)) ||
                (prod.category && prod.category.toLowerCase().includes(query)) ||
                (prod.brand && prod.brand.toLowerCase().includes(query));

              const isOut = prod.currentStockQuantity <= 0;
              const isLow = prod.currentStockQuantity > 0 && prod.currentStockQuantity <= prod.minStockAlert;
              const isIn = prod.currentStockQuantity > 0;

              if (productStockFilter === 'out_of_stock') return matchesSearch && isOut;
              if (productStockFilter === 'low_stock') return matchesSearch && isLow;
              if (productStockFilter === 'in_stock') return matchesSearch && isIn;
              return matchesSearch;
            });

            if (filteredProducts.length === 0) {
              return (
                <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center flex flex-col items-center gap-2">
                  <Package size={28} className="text-neutral-500" />
                  <span className="text-xs text-neutral-400">
                    {products.length === 0 ? 'No inventory products cataloged yet.' : 'No products match search criteria.'}
                  </span>
                  {products.length === 0 && (
                    <button
                      onClick={onOpenCreateProduct}
                      className="mt-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-500 text-white cursor-pointer"
                    >
                      Add First Product
                    </button>
                  )}
                </div>
              );
            }

            return filteredProducts.map(prod => {
              const isOut = prod.currentStockQuantity <= 0;
              const isLow = prod.currentStockQuantity > 0 && prod.currentStockQuantity <= prod.minStockAlert;

              return (
                <div
                  key={prod.id}
                  className="p-3.5 rounded-2xl border flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-all hover:border-purple-500/40"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      <Package size={18} />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{prod.name}</span>
                        {prod.category && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 font-mono">
                            {prod.category}
                          </span>
                        )}
                        {prod.brand && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-purple-300 font-mono">
                            {prod.brand}
                          </span>
                        )}
                        {isOut ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono font-bold uppercase">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold uppercase">
                            Low Stock (≤ {prod.minStockAlert})
                          </span>
                        ) : null}
                      </div>

                      <div className="text-[10px] text-neutral-400 flex items-center gap-2 font-mono mt-1 flex-wrap">
                        <span className="font-bold text-neutral-200">
                          Stock: {prod.currentStockQuantity} {prod.unit}
                        </span>
                        {prod.sku && <span>· SKU: {prod.sku}</span>}
                        {prod.barcode && <span>· Barcode: {prod.barcode}</span>}
                        {prod.taxRatePercent ? <span>· Tax: {prod.taxRatePercent}%</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                    <div className="flex flex-col sm:items-end">
                      <span className="text-xs font-mono font-bold text-white">
                        {currencySymbol} {formatScaled(prod.salePriceScaled)}
                      </span>
                      <span className="text-[9px] text-neutral-500 font-mono">
                        Avg Cost: {currencySymbol} {formatScaled(prod.weightedAvgCostScaled || prod.costPriceScaled)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          triggerHapticFeedback();
                          setSelectedProductIdForAdjustment(prod.id);
                          setIsStockAdjustmentOpen(true);
                        }}
                        className="p-2 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                        title="Adjust / Audit count"
                      >
                        <Sliders size={14} />
                      </button>

                      <button
                        onClick={() => {
                          triggerHapticFeedback();
                          setSelectedProductIdForMovements(prod.id);
                          setIsStockMovementsOpen(true);
                        }}
                        className="p-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors cursor-pointer"
                        title="View stock movement ledger"
                      >
                        <History size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* 7. CHART OF ACCOUNTS & TRANSFERS SECTION */}
      {activeSection === 'accounts' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
              Chart of Accounts & Transfers
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  setIsIntraTransferOpen(true);
                }}
                className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 flex items-center gap-1 cursor-pointer transition-colors"
                title="Transfer between cash and bank accounts"
              >
                <ArrowRightLeft size={14} /> Cash ↔ Bank
              </button>

              <button
                onClick={() => {
                  triggerHapticFeedback();
                  setIsInterTransferOpen(true);
                }}
                className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/25 flex items-center gap-1 cursor-pointer transition-colors"
                title="Owner Capital, Loans, or Drawings across workspaces"
              >
                <Building2 size={14} /> Inter-Workspace
              </button>

              <button
                onClick={() => {
                  triggerHapticFeedback();
                  setIsChartOfAccountsOpen(true);
                }}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-teal-500 text-neutral-950 hover:bg-teal-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Layers size={14} /> Full Chart & GL
              </button>
            </div>
          </div>

          {/* Accounts List Summary */}
          <div className="space-y-1.5">
            {accounts.slice(0, 8).map(acc => (
              <div
                key={acc.id}
                onClick={() => setIsChartOfAccountsOpen(true)}
                className="p-3 rounded-xl border flex justify-between items-center text-xs cursor-pointer hover:border-teal-500/40 transition-colors"
                style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-teal-400 font-bold bg-white/5 px-2 py-0.5 rounded text-[11px]">
                    {acc.accountCode}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-bold text-white">{acc.name}</span>
                    <span className="text-[10px] text-neutral-400 font-mono capitalize">
                      {acc.subCategory?.replace(/_/g, ' ') || acc.type} · {acc.reportMapping?.replace(/_/g, ' ') || 'Balance Sheet'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono capitalize text-neutral-400 flex items-center gap-1">
                  View GL <ChevronRight size={12} />
                </span>
              </div>
            ))}
            {accounts.length > 8 && (
              <button
                onClick={() => setIsChartOfAccountsOpen(true)}
                className="w-full py-2 rounded-xl text-xs font-mono text-teal-400 hover:underline text-center cursor-pointer"
              >
                + View all {accounts.length} accounts in Chart of Accounts & GL
              </button>
            )}
          </div>

          {/* Linked Inter-Workspace Transfers List */}
          {ws.transfers && ws.transfers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                  Recent Inter-Workspace Transfers ({ws.transfers.length})
                </span>
              </div>

              <div className="space-y-1.5">
                {ws.transfers.slice(0, 5).map(txf => (
                  <div
                    key={txf.id}
                    className="p-3 rounded-xl border flex justify-between items-center text-xs"
                    style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                        <ArrowRightLeft size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-white capitalize">
                          {txf.transferType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {txf.transferNumber} · {txf.transferDate}
                          {txf.note ? ` · ${txf.note}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="font-mono font-bold text-white">
                        {currencySymbol} {formatScaled(txf.amountScaled)}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400 uppercase font-bold">
                        {txf.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Safe Archive Business Button */}
          {onArchiveWorkspace && (
            <div className="pt-4 border-t border-white/5">
              <button
                onClick={() => {
                  triggerHapticFeedback();
                  if (confirm(`Archive ${workspace.name}? All invoices, ledger accounts, and parties will remain securely preserved.`)) {
                    onArchiveWorkspace(workspace.id);
                  }
                }}
                className="w-full py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Archive size={14} />
                Archive this Business Workspace
              </button>
            </div>
          )}
        </div>
      )}

      {/* Khata Statement Modal */}
      {selectedPartyForStatement && (
        <PartyStatementModal
          isOpen={!!selectedPartyForStatement}
          party={selectedPartyForStatement}
          workspaceId={workspace.id}
          currencySymbol={currencySymbol}
          theme={theme}
          onClose={() => setSelectedPartyForStatement(null)}
          onOpenRecordPayment={(p) => {
            setPaymentPartyForModal(p);
            setIsRecordPaymentOpen(true);
          }}
          onOpenReversePayment={(paymentId, paymentNumber, amountFormatted) => {
            setReversalModalData({
              isOpen: true,
              paymentId,
              paymentNumber,
              amountFormatted
            });
          }}
        />
      )}

      {/* Record Payment Modal */}
      {isRecordPaymentOpen && (
        <RecordPaymentModal
          isOpen={isRecordPaymentOpen}
          party={paymentPartyForModal}
          parties={parties}
          documents={documents}
          currencySymbol={currencySymbol}
          theme={theme}
          onClose={() => {
            setIsRecordPaymentOpen(false);
            setPaymentPartyForModal(null);
          }}
          onSubmit={async (params) => {
            await ws.recordPayment(params);
          }}
        />
      )}

      {/* Reverse Payment Modal */}
      {reversalModalData && (
        <ReversePaymentModal
          isOpen={reversalModalData.isOpen}
          paymentId={reversalModalData.paymentId}
          paymentNumber={reversalModalData.paymentNumber}
          amountFormatted={reversalModalData.amountFormatted}
          theme={theme}
          onClose={() => setReversalModalData(null)}
          onConfirm={async (paymentId, reason) => {
            await ws.reversePayment(paymentId, reason);
          }}
        />
      )}

      {/* Control Accounts Reconciliation Modal */}
      {isReconciliationOpen && (
        <ControlAccountsReconciliationModal
          isOpen={isReconciliationOpen}
          workspaceId={workspace.id}
          currencySymbol={currencySymbol}
          theme={theme}
          onClose={() => setIsReconciliationOpen(false)}
        />
      )}

      {/* Inter-Workspace Transfer Modal */}
      {isInterTransferOpen && (
        <InterWorkspaceTransferModal
          isOpen={isInterTransferOpen}
          theme={theme}
          currencySymbol={currencySymbol}
          onClose={() => setIsInterTransferOpen(false)}
        />
      )}

      {/* Full Chart of Accounts & GL Modal */}
      {isChartOfAccountsOpen && (
        <ChartOfAccountsModal
          isOpen={isChartOfAccountsOpen}
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          currencySymbol={currencySymbol}
          theme={theme}
          onClose={() => setIsChartOfAccountsOpen(false)}
        />
      )}

      {/* Intra-Account Cash <-> Bank Modal */}
      {isIntraTransferOpen && (
        <IntraAccountTransferModal
          isOpen={isIntraTransferOpen}
          theme={theme}
          currencySymbol={currencySymbol}
          onClose={() => setIsIntraTransferOpen(false)}
        />
      )}

      {/* Stock Movements Ledger Modal */}
      <StockMovementsModal
        isOpen={isStockMovementsOpen}
        onClose={() => {
          setIsStockMovementsOpen(false);
          setSelectedProductIdForMovements(undefined);
        }}
        productId={selectedProductIdForMovements}
        theme={theme}
      />

      {/* Stock Count & Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isStockAdjustmentOpen}
        onClose={() => {
          setIsStockAdjustmentOpen(false);
          setSelectedProductIdForAdjustment(undefined);
        }}
        preselectedProductId={selectedProductIdForAdjustment}
        theme={theme}
      />

      {/* Fast Barcode Scanner & Lookup Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onOpenCreateWithBarcode={(barcode) => {
          setIsBarcodeScannerOpen(false);
          onOpenCreateProduct();
        }}
        onOpenStockMovement={(productId) => {
          setIsBarcodeScannerOpen(false);
          setSelectedProductIdForMovements(productId);
          setIsStockMovementsOpen(true);
        }}
        onOpenStockAdjustment={(productId) => {
          setIsBarcodeScannerOpen(false);
          setSelectedProductIdForAdjustment(productId);
          setIsStockAdjustmentOpen(true);
        }}
        theme={theme}
      />
    </div>
  );
}
