/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, Search, Barcode, Camera, Plus, Minus, Trash2, 
  CreditCard, DollarSign, Split, AlertCircle, CheckCircle2, User, 
  Users, RefreshCw, X, ShieldAlert, ArrowRight, ArrowLeft
} from 'lucide-react';
import { SqliteConnectionPool } from '../../../infrastructure/database/sqliteConnectionPool';
import { HardwareBarcodeScannerService } from '../../../infrastructure/barcode/HardwareBarcodeScannerService';
import { ProductRecord } from '../../../infrastructure/database/repositories/ProductRepository';
import { PartyRecord } from '../../../infrastructure/database/repositories/PartyRepository';
import { AccountRecord } from '../../../infrastructure/database/repositories/AccountRepository';
import { SaleService, CompleteSaleInput, CompleteSaleResult, SplitPaymentLine } from '../../../application/services/SaleService';
import { InventoryService } from '../../../application/services/InventoryService';
import { triggerHapticFeedback } from '../../../core/utils/haptics';
import { generateEntityId } from '../../../domain/primitives/EntityId';
import { BarcodeCameraScannerModal } from './BarcodeCameraScannerModal';
import { ReceiptModal, ReceiptData } from './ReceiptModal';

export interface CartLine {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  packageUnit: string;
  unitPriceScaled: bigint;
  discountScaled: bigint;
  taxRatePercent: number;
  currentStock: number;
  canonicalUnit: string;
}

interface POSScreenProps {
  workspaceId: string;
  currencySymbol: string;
  parties: PartyRecord[];
  products: ProductRecord[];
  accounts: AccountRecord[];
  onSaleCompleted?: () => void;
  onBackToDashboard?: () => void;
}

export function POSScreen({
  workspaceId,
  currencySymbol,
  parties,
  products: initialProducts,
  accounts,
  onSaleCompleted,
  onBackToDashboard
}: POSScreenProps) {
  // Products & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [productsList, setProductsList] = useState<ProductRecord[]>(initialProducts);
  const [visibleProductCount, setVisibleProductCount] = useState(30);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isWalkIn, setIsWalkIn] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Checkout modal state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'full_cash' | 'full_bank' | 'split' | 'credit' | 'partial'>('full_cash');
  const [partialCashAmount, setPartialCashAmount] = useState<string>('');
  const [splitPayments, setSplitPayments] = useState<Array<{ method: 'cash' | 'bank'; amount: string; accountId: string }>>([
    { method: 'cash', amount: '', accountId: '' },
    { method: 'bank', amount: '', accountId: '' }
  ]);
  const [cashierName, setCashierName] = useState('Counter 1');
  const [checkoutNotes, setCheckoutNotes] = useState('');

  // Negative-stock policy: 'block' | 'warn' | 'allow'
  const [negativeStockPolicy, setNegativeStockPolicy] = useState<'block' | 'warn' | 'allow'>('block');

  // Line Discount & Tax editor state
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineDiscountInput, setLineDiscountInput] = useState<string>('');
  const [lineTaxInput, setLineTaxInput] = useState<string>('');

  // Processing, idempotency & error state
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Receipt modal state
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Debounce search query to prevent typing lag and database lock churn
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setVisibleProductCount(30);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Filter customers
  const customers = useMemo(() => {
    return parties.filter(p => (p.type === 'customer' || p.type === 'both') && p.isActive);
  }, [parties]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Accounts lookups
  const cashAccounts = useMemo(() => {
    return accounts.filter(a => a.accountCode === '1010' || a.subCategory === 'cash' || a.type === 'asset');
  }, [accounts]);

  const bankAccounts = useMemo(() => {
    return accounts.filter(a => a.accountCode === '1020' || a.subCategory === 'bank');
  }, [accounts]);

  // Load / search products from database with stale request cancellation guard
  useEffect(() => {
    let isStale = false;
    const fetchCatalog = async () => {
      try {
        const pool = SqliteConnectionPool.getInstance();
        const conn = await pool.getConnection();
        const results = await SaleService.searchProductsForPOS(conn, workspaceId, debouncedSearchQuery);
        if (!isStale) {
          setProductsList(results);
        }
      } catch {
        if (!isStale) {
          // Fallback to in-memory filter
          if (!debouncedSearchQuery.trim()) {
            setProductsList(initialProducts);
          } else {
            const q = debouncedSearchQuery.toLowerCase();
            setProductsList(initialProducts.filter(p => 
              p.name.toLowerCase().includes(q) ||
              p.sku?.toLowerCase().includes(q) ||
              p.barcode?.toLowerCase().includes(q)
            ));
          }
        }
      }
    };

    fetchCatalog();
    return () => {
      isStale = true;
    };
  }, [debouncedSearchQuery, workspaceId, initialProducts]);

  // Windowed visible catalog slice for high-volume responsiveness
  const displayedProducts = useMemo(() => {
    return productsList.slice(0, visibleProductCount);
  }, [productsList, visibleProductCount]);

  // Hardware wedge scanner integration (laser & bluetooth handheld barcode guns)
  useEffect(() => {
    const scanner = HardwareBarcodeScannerService.getInstance();
    const unsubscribe = scanner.subscribe((result) => {
      if (result.code) {
        handleBarcodeScanned(result.code);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [workspaceId]);

  // Formatter helper
  const formatScaled = (scaledVal?: bigint | number) => {
    if (scaledVal === undefined || scaledVal === null) return '0.00';
    const num = Number(scaledVal) / 10000;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Add product to cart
  const addProductToCart = (product: ProductRecord, overrideQuantity = 1) => {
    triggerHapticFeedback();
    setErrorMessage(null);

    // Inactive product validation
    if (!product.isActive) {
      setErrorMessage(`Cannot add inactive product "${product.name}" to cart.`);
      return;
    }

    // Stock availability checks based on negativeStockPolicy
    if (product.currentStockQuantity <= 0) {
      if (negativeStockPolicy === 'block') {
        setErrorMessage(`Cannot add "${product.name}": Product is out of stock (0 ${product.unit} available). Blocked by negative-stock policy.`);
        return;
      } else if (negativeStockPolicy === 'warn') {
        setWarningMessage(`Stock availability warning: "${product.name}" has 0 ${product.unit} on hand.`);
      }
    }

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.productId === product.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        const nextQty = copy[existingIdx].quantity + overrideQuantity;
        if (nextQty > product.currentStockQuantity && negativeStockPolicy === 'block') {
          setErrorMessage(`Cannot add more "${product.name}": Only ${product.currentStockQuantity} ${product.unit} available in stock.`);
          return prev;
        } else if (nextQty > product.currentStockQuantity && negativeStockPolicy === 'warn') {
          setWarningMessage(`Stock availability warning: Cart quantity (${nextQty}) exceeds available stock (${product.currentStockQuantity}).`);
        }
        copy[existingIdx] = {
          ...copy[existingIdx],
          quantity: nextQty
        };
        return copy;
      }

      return [
        ...prev,
        {
          id: generateEntityId('cline'),
          productId: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          quantity: overrideQuantity,
          packageUnit: product.unit,
          unitPriceScaled: product.salePriceScaled,
          discountScaled: 0n,
          taxRatePercent: product.taxRatePercent || 0,
          currentStock: product.currentStockQuantity,
          canonicalUnit: product.unit
        }
      ];
    });
  };

  // Handle barcode scanned from camera or wedge
  const handleBarcodeScanned = async (scannedBarcode: string) => {
    triggerHapticFeedback();
    setErrorMessage(null);
    setWarningMessage(null);

    try {
      const pool = SqliteConnectionPool.getInstance();
      const conn = await pool.getConnection();

      const lookup = await InventoryService.lookupBarcode(conn, workspaceId, scannedBarcode);
      if (lookup) {
        if (!lookup.product.isActive) {
          setErrorMessage(`Product "${lookup.product.name}" associated with barcode "${scannedBarcode}" is inactive.`);
          return;
        }
        addProductToCart(lookup.product, lookup.barcodeRecord.conversionFactor || 1);
      } else {
        // Fallback: search products by barcode field
        const matches = await SaleService.searchProductsForPOS(conn, workspaceId, scannedBarcode);
        if (matches.length > 0) {
          if (!matches[0].isActive) {
            setErrorMessage(`Product "${matches[0].name}" with barcode "${scannedBarcode}" is inactive.`);
            return;
          }
          addProductToCart(matches[0], 1);
        } else {
          setErrorMessage(`Unknown barcode: "${scannedBarcode}". No matching product found in store inventory.`);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error looking up barcode.');
    }
  };

  // Cart operations
  const updateCartLineQty = (lineId: string, delta: number) => {
    triggerHapticFeedback();
    setCart(prev => {
      return prev
        .map(line => {
          if (line.id !== lineId) return line;
          const nextQty = line.quantity + delta;
          return nextQty > 0 ? { ...line, quantity: nextQty } : null;
        })
        .filter(Boolean) as CartLine[];
    });
  };

  const removeCartLine = (lineId: string) => {
    triggerHapticFeedback();
    setCart(prev => prev.filter(line => line.id !== lineId));
  };

  const clearCart = () => {
    triggerHapticFeedback();
    setCart([]);
    setErrorMessage(null);
    setWarningMessage(null);
  };

  const updateCartLineDiscountAndTax = (lineId: string, discountVal: string, taxVal: string) => {
    triggerHapticFeedback();
    const dNum = parseFloat(discountVal || '0');
    const tNum = parseFloat(taxVal || '0');
    setCart(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      return {
        ...l,
        discountScaled: BigInt(Math.max(0, Math.round((isNaN(dNum) ? 0 : dNum) * 10000))),
        taxRatePercent: Math.max(0, isNaN(tNum) ? 0 : tNum)
      };
    }));
    setEditingLineId(null);
  };

  // Cart calculations
  const cartTotals = useMemo(() => {
    let subtotalScaled = 0n;
    let discountScaled = 0n;
    let taxScaled = 0n;

    for (const line of cart) {
      const lineSub = BigInt(Math.round(line.quantity * Number(line.unitPriceScaled)));
      const net = lineSub - line.discountScaled;
      const tax = BigInt(Math.round(Number(net) * (line.taxRatePercent / 100)));

      subtotalScaled += lineSub;
      discountScaled += line.discountScaled;
      taxScaled += tax;
    }

    const totalScaled = subtotalScaled - discountScaled + taxScaled;
    return { subtotalScaled, discountScaled, taxScaled, totalScaled };
  }, [cart]);

  // Open Checkout Dialog
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    triggerHapticFeedback();
    setErrorMessage(null);
    setWarningMessage(null);

    // Stock availability warning check
    const lowStockItems = cart.filter(line => line.quantity > line.currentStock);
    if (lowStockItems.length > 0) {
      if (negativeStockPolicy === 'block') {
        setErrorMessage(
          `Insufficient stock: ${lowStockItems.map(i => `"${i.name}" (requested ${i.quantity}, available ${i.currentStock})`).join(', ')}. Sale blocked by negative-stock policy.`
        );
        return;
      } else if (negativeStockPolicy === 'warn') {
        setWarningMessage(
          `Stock availability warning: ${lowStockItems.map(i => `"${i.name}" (requested ${i.quantity}, available ${i.currentStock})`).join(', ')}.`
        );
      }
    }

    // Generate fresh idempotency key per checkout attempt
    setIdempotencyKey(generateEntityId('idemp'));
    setPaymentType('full_cash');
    setPartialCashAmount('');
    setIsCheckoutOpen(true);
  };

  // Perform atomic checkout
  const handleExecuteCheckout = async () => {
    if (isSubmitting) return; // Prevent double click
    triggerHapticFeedback();
    setIsSubmitting(true);
    setErrorMessage(null);
    setWarningMessage(null);

    try {
      if ((paymentType === 'credit' || paymentType === 'partial') && isWalkIn) {
        throw new Error('Walk-in cash customers cannot purchase on credit. Please select a registered customer to track accounts receivable.');
      }

      const pool = SqliteConnectionPool.getInstance();
      const conn = await pool.getConnection();

      // Build payment inputs
      let paidScaled: bigint | undefined = undefined;
      let splitList: SplitPaymentLine[] | undefined = undefined;

      if (paymentType === 'partial') {
        const val = parseFloat(partialCashAmount || '0');
        if (isNaN(val) || val <= 0) {
          throw new Error('Please enter a valid partial payment amount.');
        }
        paidScaled = BigInt(Math.round(val * 10000));
      } else if (paymentType === 'split') {
        splitList = splitPayments
          .filter(p => parseFloat(p.amount || '0') > 0)
          .map(p => ({
            method: p.method,
            accountId: p.accountId || (p.method === 'bank' ? bankAccounts[0]?.id : cashAccounts[0]?.id) || cashAccounts[0]?.id,
            amountScaled: BigInt(Math.round(parseFloat(p.amount) * 10000)),
            notes: `POS Split ${p.method} Payment`
          }));

        if (splitList.length === 0) {
          throw new Error('Please enter at least one split payment amount.');
        }
      }

      const input: CompleteSaleInput = {
        idempotencyKey,
        customerId: isWalkIn ? null : selectedCustomerId,
        customerName: isWalkIn ? 'Walk-in Cash Customer' : selectedCustomer?.name,
        paymentType,
        depositAccountId: paymentType === 'full_bank' ? bankAccounts[0]?.id : cashAccounts[0]?.id,
        paidAmountScaled: paidScaled,
        payments: splitList,
        negativeStockPolicy, // Configurable negative-stock policy
        isWalkIn,
        cashierName,
        notes: checkoutNotes,
        items: cart.map(line => ({
          productId: line.productId,
          description: line.name,
          quantity: line.quantity,
          packageUnit: line.packageUnit,
          unitPriceScaled: line.unitPriceScaled,
          discountScaled: line.discountScaled,
          taxRatePercent: line.taxRatePercent
        }))
      };

      const result: CompleteSaleResult = await SaleService.completeSale(conn, workspaceId, input);

      // Successfully committed!
      setIsCheckoutOpen(false);
      setCart([]);
      setReceiptData(result.receiptData);
      setIsReceiptOpen(true);

      if (result.warnings && result.warnings.length > 0) {
        setWarningMessage(result.warnings.join(' '));
      }

      if (onSaleCompleted) {
        onSaleCompleted();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Checkout failed. Any database operations were safely rolled back.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 select-none pb-4">
      {/* 1. TOP HEADER & BARCODE SEARCH BAR */}
      <div className="flex items-center justify-between gap-2 bg-neutral-900 border border-white/10 p-3 rounded-2xl shadow-lg">
        {onBackToDashboard && (
          <button
            onClick={() => {
              triggerHapticFeedback();
              onBackToDashboard();
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
        )}

        {/* Live Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, SKU, or barcode (or scan gun)..."
            className="w-full bg-neutral-800 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Camera Scanner Trigger */}
        <button
          onClick={() => {
            triggerHapticFeedback();
            setIsCameraScannerOpen(true);
          }}
          className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-xs font-bold text-blue-400 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
        >
          <Camera size={14} />
          Scan
        </button>
      </div>

      {/* ERROR / WARNING BANNERS */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 shadow-lg"
          >
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1 text-[11px] font-medium leading-relaxed">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-neutral-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}

        {warningMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2 shadow-lg"
          >
            <ShieldAlert size={16} className="flex-shrink-0 mt-0.5 text-amber-400" />
            <div className="flex-1 text-[11px] font-medium leading-relaxed">{warningMessage}</div>
            <button
              onClick={() => setWarningMessage(null)}
              className="text-neutral-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. MAIN POS SPLIT: PRODUCT CATALOG GRID & CART DRAWER */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* LEFT: PRODUCTS CATALOG (7 COLS) */}
        <div className="md:col-span-7 flex flex-col bg-neutral-900 border border-white/10 rounded-2xl p-3 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Store Catalog ({productsList.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-none max-h-[380px] md:max-h-full">
            {productsList.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                No products found matching "{searchQuery}".
              </div>
            ) : (
              <>
                {displayedProducts.map(prod => {
                  const isOutOfStock = prod.currentStockQuantity <= 0;
                  return (
                    <div
                      key={prod.id}
                      onClick={() => addProductToCart(prod)}
                      className="p-3 bg-neutral-950/50 hover:bg-white/5 border border-white/5 hover:border-blue-500/30 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
                    >
                      <div className="flex flex-col gap-0.5 text-left">
                        <div className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                          {prod.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
                          {prod.sku && <span>SKU: {prod.sku}</span>}
                          {prod.barcode && <span>BAR: {prod.barcode}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs font-bold text-white font-mono">
                            {currencySymbol} {formatScaled(prod.salePriceScaled)}
                          </div>
                          <div className={`text-[10px] font-mono ${isOutOfStock ? 'text-rose-400' : 'text-neutral-500'}`}>
                            {prod.currentStockQuantity} {prod.unit}
                          </div>
                        </div>

                        <button
                          className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all cursor-pointer"
                          title="Add to cart"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {productsList.length > visibleProductCount && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback();
                      setVisibleProductCount(prev => prev + 30);
                    }}
                    className="w-full py-2.5 bg-neutral-800/80 hover:bg-neutral-700/80 active:bg-neutral-700 border border-white/10 rounded-xl text-xs font-bold text-neutral-300 transition-all cursor-pointer shadow-sm"
                  >
                    Load More Products ({productsList.length - visibleProductCount} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT: CURRENT ACTIVE CART (5 COLS) */}
        <div className="md:col-span-5 flex flex-col bg-neutral-900 border border-white/10 rounded-2xl p-3 shadow-xl flex-1">
          {/* Customer Selection Bar */}
          <div className="pb-3 border-b border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-400">
              <span className="flex items-center gap-1.5">
                <User size={14} className="text-blue-400" />
                Customer
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsWalkIn(true)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    isWalkIn ? 'bg-blue-600 text-white' : 'bg-white/5 text-neutral-400'
                  }`}
                >
                  Walk-in (Cash)
                </button>
                <button
                  onClick={() => setIsWalkIn(false)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    !isWalkIn ? 'bg-blue-600 text-white' : 'bg-white/5 text-neutral-400'
                  }`}
                >
                  Registered
                </button>
              </div>
            </div>

            {!isWalkIn && (
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                className="w-full bg-neutral-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="">-- Choose Registered Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 scrollbar-none min-h-[160px] max-h-[220px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500 text-xs gap-2">
                <ShoppingBag size={28} className="opacity-40" />
                <span>Cart is empty. Tap products or scan barcode to add.</span>
              </div>
            ) : (
              cart.map(line => {
                const lineTotal = BigInt(Math.round(line.quantity * Number(line.unitPriceScaled))) - line.discountScaled;
                const isOverStock = line.quantity > line.currentStock;
                const isEditingThisLine = editingLineId === line.id;

                return (
                  <div
                    key={line.id}
                    className="p-2.5 bg-neutral-950/50 border border-white/5 rounded-xl flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{line.name}</span>
                          {isOverStock && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono font-bold flex-shrink-0">
                              Low Stock ({line.currentStock})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-2 mt-0.5">
                          <span>{currencySymbol} {formatScaled(line.unitPriceScaled)} / {line.packageUnit}</span>
                          {line.discountScaled > 0n && (
                            <span className="text-emerald-400 font-bold">-{currencySymbol}{formatScaled(line.discountScaled)}</span>
                          )}
                          {line.taxRatePercent > 0 && (
                            <span className="text-neutral-500">+{line.taxRatePercent}% tax</span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditingThisLine) {
                                setEditingLineId(null);
                              } else {
                                setEditingLineId(line.id);
                                setLineDiscountInput(line.discountScaled > 0n ? (Number(line.discountScaled) / 10000).toFixed(2) : '');
                                setLineTaxInput(line.taxRatePercent > 0 ? String(line.taxRatePercent) : '');
                              }
                            }}
                            className="text-[9.5px] text-blue-400 hover:text-blue-300 underline cursor-pointer"
                          >
                            {isEditingThisLine ? 'Close' : 'Discount/Tax'}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateCartLineQty(line.id, -1)}
                          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="font-mono font-bold text-xs text-white w-6 text-center">
                          {line.quantity}
                        </span>
                        <button
                          onClick={() => updateCartLineQty(line.id, 1)}
                          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="text-right font-mono font-bold text-xs text-white min-w-[55px]">
                        {currencySymbol} {formatScaled(lineTotal)}
                      </div>

                      <button
                        onClick={() => removeCartLine(line.id)}
                        className="p-1 text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Inline Line Discount & Tax Editor */}
                    {isEditingThisLine && (
                      <div className="p-2 bg-neutral-900 border border-white/10 rounded-lg flex items-center gap-2 mt-1">
                        <div className="flex-1">
                          <label className="text-[9px] text-neutral-400 block">Line Disc ({currencySymbol})</label>
                          <input
                            type="number"
                            step="0.01"
                            value={lineDiscountInput}
                            onChange={e => setLineDiscountInput(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-neutral-950 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[9px] text-neutral-400 block">Tax Rate (%)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={lineTaxInput}
                            onChange={e => setLineTaxInput(e.target.value)}
                            placeholder="0"
                            className="w-full bg-neutral-950 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => updateCartLineDiscountAndTax(line.id, lineDiscountInput, lineTaxInput)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded mt-3 cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Summary & Checkout Trigger */}
          <div className="pt-3 border-t border-white/10 flex flex-col gap-2 mt-auto">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-neutral-400 text-[11px]">
                <span>Subtotal:</span>
                <span className="font-mono text-white">
                  {currencySymbol} {formatScaled(cartTotals.subtotalScaled)}
                </span>
              </div>
              {cartTotals.discountScaled > 0n && (
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Discount:</span>
                  <span className="font-mono text-emerald-400">
                    -{currencySymbol} {formatScaled(cartTotals.discountScaled)}
                  </span>
                </div>
              )}
              {cartTotals.taxScaled > 0n && (
                <div className="flex justify-between text-neutral-400 text-[11px]">
                  <span>Tax:</span>
                  <span className="font-mono text-white">
                    +{currencySymbol} {formatScaled(cartTotals.taxScaled)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm text-white pt-1 border-t border-white/5">
                <span>Total:</span>
                <span className="font-mono text-emerald-400">
                  {currencySymbol} {formatScaled(cartTotals.totalScaled)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-neutral-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={handleOpenCheckout}
                disabled={cart.length === 0}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                Checkout ({cart.length})
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CHECKOUT MODAL (Cash, Bank, Split, Credit & Partial Payments) */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col my-auto"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-neutral-950/60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Payment & Settlement</h3>
                    <p className="text-[11px] text-neutral-400">Choose payment method & finalize sale</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCheckoutOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-none">
                {/* Total Due Banner */}
                <div className="p-3 bg-neutral-950 border border-white/5 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-400">Amount Payable:</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {currencySymbol} {formatScaled(cartTotals.totalScaled)}
                  </span>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentType('full_cash')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                        paymentType === 'full_cash'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                          : 'bg-white/5 text-neutral-300 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <DollarSign size={16} />
                      Full Cash
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentType('full_bank')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                        paymentType === 'full_bank'
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                          : 'bg-white/5 text-neutral-300 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <CreditCard size={16} />
                      Bank / Card
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentType('split')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                        paymentType === 'split'
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
                          : 'bg-white/5 text-neutral-300 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <Split size={16} />
                      Split Payment
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentType('credit')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                        paymentType === 'credit'
                          ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20'
                          : 'bg-white/5 text-neutral-300 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <Users size={16} />
                      Full Credit (A/R)
                    </button>
                  </div>
                </div>

                {/* Split Payments Options */}
                {paymentType === 'split' && (
                  <div className="p-3 bg-neutral-950/70 border border-white/5 rounded-2xl space-y-2.5">
                    <div className="text-[11px] font-bold text-neutral-400">Split Payment Allocation:</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-neutral-500">Cash Amount ({currencySymbol})</label>
                        <input
                          type="number"
                          step="0.01"
                          value={splitPayments[0].amount}
                          onChange={e => {
                            const val = e.target.value;
                            setSplitPayments(prev => [
                              { ...prev[0], amount: val },
                              prev[1]
                            ]);
                          }}
                          placeholder="0.00"
                          className="w-full bg-neutral-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500">Bank/Card Amount ({currencySymbol})</label>
                        <input
                          type="number"
                          step="0.01"
                          value={splitPayments[1].amount}
                          onChange={e => {
                            const val = e.target.value;
                            setSplitPayments(prev => [
                              prev[0],
                              { ...prev[1], amount: val }
                            ]);
                          }}
                          placeholder="0.00"
                          className="w-full bg-neutral-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Partial Payment Amount */}
                {paymentType === 'partial' && (
                  <div className="p-3 bg-neutral-950/70 border border-white/5 rounded-2xl space-y-2">
                    <label className="text-[11px] font-bold text-neutral-400">Cash Received Now ({currencySymbol})</label>
                    <input
                      type="number"
                      step="0.01"
                      value={partialCashAmount}
                      onChange={e => setPartialCashAmount(e.target.value)}
                      placeholder="Amount received..."
                      className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                )}

                {/* Configurable Negative-Stock Policy */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                      Negative-Stock Policy
                    </label>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      Current: {negativeStockPolicy}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNegativeStockPolicy('block')}
                      className={`p-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                        negativeStockPolicy === 'block'
                          ? 'bg-rose-600/30 text-rose-300 border-rose-500'
                          : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      Block (Strict)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNegativeStockPolicy('warn')}
                      className={`p-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                        negativeStockPolicy === 'warn'
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500'
                          : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      Warn Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setNegativeStockPolicy('allow')}
                      className={`p-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                        negativeStockPolicy === 'allow'
                          ? 'bg-blue-600/30 text-blue-300 border-blue-500'
                          : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      Allow All
                    </button>
                  </div>
                </div>

                {/* Walk-in warning if credit chosen */}
                {(paymentType === 'credit' || paymentType === 'partial') && isWalkIn && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>Credit sales require choosing a registered customer to track accounts receivable.</span>
                  </div>
                )}

                {/* Cashier & Notes */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-500">Cashier Terminal</label>
                    <input
                      type="text"
                      value={cashierName}
                      onChange={e => setCashierName(e.target.value)}
                      className="w-full bg-neutral-950 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500">Notes (Optional)</label>
                    <input
                      type="text"
                      value={checkoutNotes}
                      onChange={e => setCheckoutNotes(e.target.value)}
                      placeholder="Order notes..."
                      className="w-full bg-neutral-950 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 bg-neutral-950/60 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  disabled={isSubmitting}
                  className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCheckout}
                  disabled={isSubmitting || ((paymentType === 'credit' || paymentType === 'partial') && isWalkIn)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Committing Transaction...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      Complete & Post Sale
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. CAMERA SCANNER MODAL */}
      <BarcodeCameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onBarcodeDetected={handleBarcodeScanned}
      />

      {/* 5. RECEIPT PREVIEW & SHARE MODAL */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receiptData={receiptData}
      />
    </div>
  );
}
