/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { databaseService } from '../infrastructure/database/DatabaseService';
import { 
  WorkspaceService, 
  WorkspaceWithProfile, 
  CreateBusinessWorkspaceParams, 
  UpdateBusinessWorkspaceParams 
} from '../application/services/WorkspaceService';
import { DEFAULT_PERSONAL_WORKSPACE_ID } from '../infrastructure/database/migrations/002_business_workspaces_ledger_parties';
import { PartyRecord } from '../infrastructure/database/repositories/PartyRepository';
import { ProductRecord } from '../infrastructure/database/repositories/ProductRepository';
import { DocumentWithLines } from '../infrastructure/database/repositories/DocumentRepository';
import { AccountRecord } from '../infrastructure/database/repositories/AccountRepository';
import { 
  PartyKhataService, 
  RecordPaymentParams 
} from '../application/services/PartyKhataService';
import { 
  PaymentWithAllocations, 
  PaymentRecord 
} from '../infrastructure/database/repositories/PaymentRepository';
import { InterWorkspaceTransferRecord } from '../infrastructure/database/repositories/TransferRepository';
import { 
  InterWorkspaceTransferService, 
  CreateInterWorkspaceTransferParams,
  OwnerDirectSupplierPaymentParams 
} from '../application/services/InterWorkspaceTransferService';
import { 
  PostingService, 
  IntraWorkspaceTransferCommand 
} from '../application/services/PostingService';

export interface WorkspaceContextValue {
  currentWorkspace: WorkspaceWithProfile;
  availableWorkspaces: WorkspaceWithProfile[];
  isBusinessMode: boolean;
  activeWorkspaceId: string;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createBusiness: (params: CreateBusinessWorkspaceParams) => Promise<WorkspaceWithProfile>;
  updateBusiness: (workspaceId: string, params: UpdateBusinessWorkspaceParams) => Promise<WorkspaceWithProfile>;
  archiveWorkspace: (workspaceId: string) => Promise<void>;
  unarchiveWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  // Scoped business data
  businessSummary: {
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
  transfers: InterWorkspaceTransferRecord[];
  createParty: (params: any) => Promise<any>;
  createProduct: (params: any) => Promise<any>;
  createDocument: (params: any) => Promise<any>;
  createCustomAccount: (params: any) => Promise<AccountRecord>;
  recordPayment: (params: RecordPaymentParams) => Promise<PaymentWithAllocations>;
  reversePayment: (paymentId: string, reason: string) => Promise<PaymentRecord>;
  createInterWorkspaceTransfer: (params: CreateInterWorkspaceTransferParams) => Promise<any>;
  createDirectSupplierPayment: (params: OwnerDirectSupplierPaymentParams) => Promise<any>;
  reverseInterWorkspaceTransfer: (transferId: string, reason: string) => Promise<void>;
  createAccountTransfer: (command: IntraWorkspaceTransferCommand) => Promise<any>;
  refreshBusinessData: () => Promise<void>;
  // Modal visibility controls
  isWorkspaceSelectorOpen: boolean;
  setIsWorkspaceSelectorOpen: (open: boolean) => void;
  isCreateBusinessOpen: boolean;
  setIsCreateBusinessOpen: (open: boolean) => void;
  isCreatePartyOpen: boolean;
  setIsCreatePartyOpen: (open: boolean) => void;
  isCreateProductOpen: boolean;
  setIsCreateProductOpen: (open: boolean) => void;
  isCreateDocumentOpen: boolean;
  setIsCreateDocumentOpen: (open: boolean) => void;
  isTransferModalOpen: boolean;
  setIsTransferModalOpen: (open: boolean) => void;
  isChartOfAccountsOpen: boolean;
  setIsChartOfAccountsOpen: (open: boolean) => void;
}

const DEFAULT_PERSONAL_FALLBACK: WorkspaceWithProfile = {
  id: DEFAULT_PERSONAL_WORKSPACE_ID,
  name: 'Personal Workspace',
  type: 'personal',
  currencyCode: 'PKR',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceWithProfile[]>([DEFAULT_PERSONAL_FALLBACK]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    return localStorage.getItem('cocoon_active_workspace_id') || DEFAULT_PERSONAL_WORKSPACE_ID;
  });

  // Scoped business records
  const [businessSummary, setBusinessSummary] = useState<WorkspaceContextValue['businessSummary']>(null);
  const [parties, setParties] = useState<PartyRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentWithLines[]>([]);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [transfers, setTransfers] = useState<InterWorkspaceTransferRecord[]>([]);

  // Modals
  const [isWorkspaceSelectorOpen, setIsWorkspaceSelectorOpen] = useState(false);
  const [isCreateBusinessOpen, setIsCreateBusinessOpen] = useState(false);
  const [isCreatePartyOpen, setIsCreatePartyOpen] = useState(false);
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [isCreateDocumentOpen, setIsCreateDocumentOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isChartOfAccountsOpen, setIsChartOfAccountsOpen] = useState(false);

  // Load workspaces list from SQLite
  const refreshWorkspaces = useCallback(async () => {
    try {
      const conn = await databaseService.getInitializedConnection();
      const list = await WorkspaceService.listWorkspaces(conn, true);
      if (list.length > 0) {
        setAvailableWorkspaces(list);
      }
    } catch (err) {
      console.warn('Workspace loading notice:', err);
    }
  }, []);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const currentWorkspace = useMemo(() => {
    const found = availableWorkspaces.find(w => w.id === activeWorkspaceId);
    return found || availableWorkspaces.find(w => w.type === 'personal') || DEFAULT_PERSONAL_FALLBACK;
  }, [availableWorkspaces, activeWorkspaceId]);

  const isBusinessMode = currentWorkspace.type === 'business';

  // Load scoped business data whenever active workspace changes
  const refreshBusinessData = useCallback(async () => {
    try {
      const conn = await databaseService.getInitializedConnection();
      const [sum, pts, prods, docs, accs, xfers] = await Promise.all([
        isBusinessMode ? WorkspaceService.getBusinessSummary(conn, currentWorkspace.id) : Promise.resolve(null),
        isBusinessMode ? WorkspaceService.getParties(conn, currentWorkspace.id) : Promise.resolve([]),
        isBusinessMode ? WorkspaceService.getProducts(conn, currentWorkspace.id) : Promise.resolve([]),
        isBusinessMode ? WorkspaceService.getDocuments(conn, currentWorkspace.id) : Promise.resolve([]),
        WorkspaceService.getAccounts(conn, currentWorkspace.id),
        InterWorkspaceTransferService.getTransfers(conn, currentWorkspace.id, { page: 1, pageSize: 50 }).then(res => res.transfers)
      ]);

      setBusinessSummary(sum);
      setParties(pts);
      setProducts(prods);
      setDocuments(docs);
      setAccounts(accs);
      setTransfers(xfers);
    } catch (err) {
      console.error('Failed to load scoped business data:', err);
    }
  }, [isBusinessMode, currentWorkspace.id]);

  useEffect(() => {
    refreshBusinessData();
  }, [refreshBusinessData]);

  // Switch workspace
  const switchWorkspace = useCallback(async (workspaceId: string) => {
    try {
      const conn = await databaseService.getInitializedConnection();
      const ws = await WorkspaceService.validateWorkspaceAccess(conn, workspaceId, true);
      setActiveWorkspaceId(ws.id);
      localStorage.setItem('cocoon_active_workspace_id', ws.id);
    } catch (err) {
      console.error('Could not switch workspace:', err);
    }
  }, []);

  // Create Business
  const createBusiness = useCallback(async (params: CreateBusinessWorkspaceParams) => {
    const conn = await databaseService.getInitializedConnection();
    const created = await WorkspaceService.createBusinessWorkspace(conn, params);
    await refreshWorkspaces();
    setActiveWorkspaceId(created.id);
    localStorage.setItem('cocoon_active_workspace_id', created.id);
    return created;
  }, [refreshWorkspaces]);

  // Update Business
  const updateBusiness = useCallback(async (workspaceId: string, params: UpdateBusinessWorkspaceParams) => {
    const conn = await databaseService.getInitializedConnection();
    const updated = await WorkspaceService.updateBusinessWorkspace(conn, workspaceId, params);
    await refreshWorkspaces();
    return updated;
  }, [refreshWorkspaces]);

  // Archive Workspace
  const archiveWorkspace = useCallback(async (workspaceId: string) => {
    const conn = await databaseService.getInitializedConnection();
    await WorkspaceService.archiveWorkspace(conn, workspaceId);
    await refreshWorkspaces();
    if (activeWorkspaceId === workspaceId) {
      setActiveWorkspaceId(DEFAULT_PERSONAL_WORKSPACE_ID);
      localStorage.setItem('cocoon_active_workspace_id', DEFAULT_PERSONAL_WORKSPACE_ID);
    }
  }, [refreshWorkspaces, activeWorkspaceId]);

  // Unarchive Workspace
  const unarchiveWorkspace = useCallback(async (workspaceId: string) => {
    const conn = await databaseService.getInitializedConnection();
    await WorkspaceService.unarchiveWorkspace(conn, workspaceId);
    await refreshWorkspaces();
  }, [refreshWorkspaces]);

  // Scoped Actions
  const createParty = useCallback(async (params: any) => {
    const conn = await databaseService.getInitializedConnection();
    const party = await PartyKhataService.createParty(conn, currentWorkspace.id, params);
    await refreshBusinessData();
    return party;
  }, [currentWorkspace.id, refreshBusinessData]);

  const createProduct = useCallback(async (params: any) => {
    const conn = await databaseService.getInitializedConnection();
    const prod = await WorkspaceService.createProduct(conn, currentWorkspace.id, params);
    await refreshBusinessData();
    return prod;
  }, [currentWorkspace.id, refreshBusinessData]);

  const createDocument = useCallback(async (params: any) => {
    const conn = await databaseService.getInitializedConnection();
    const doc = await WorkspaceService.createDocument(conn, currentWorkspace.id, params);
    await refreshBusinessData();
    return doc;
  }, [currentWorkspace.id, refreshBusinessData]);

  const createCustomAccount = useCallback(async (params: any) => {
    const conn = await databaseService.getInitializedConnection();
    const acc = await WorkspaceService.createAccount(conn, currentWorkspace.id, params);
    await refreshBusinessData();
    return acc;
  }, [currentWorkspace.id, refreshBusinessData]);

  const recordPayment = useCallback(async (params: RecordPaymentParams) => {
    const conn = await databaseService.getInitializedConnection();
    const payment = await PartyKhataService.recordPayment(conn, currentWorkspace.id, params);
    await refreshBusinessData();
    return payment;
  }, [currentWorkspace.id, refreshBusinessData]);

  const reversePayment = useCallback(async (paymentId: string, reason: string) => {
    const conn = await databaseService.getInitializedConnection();
    const reversed = await PartyKhataService.reversePayment(conn, currentWorkspace.id, paymentId, reason);
    await refreshBusinessData();
    return reversed;
  }, [currentWorkspace.id, refreshBusinessData]);

  // Inter-Workspace Transfers
  const createInterWorkspaceTransfer = useCallback(async (params: CreateInterWorkspaceTransferParams) => {
    const conn = await databaseService.getInitializedConnection();
    const result = await InterWorkspaceTransferService.recordTransfer(conn, params);
    await refreshBusinessData();
    return result;
  }, [refreshBusinessData]);

  const createDirectSupplierPayment = useCallback(async (params: OwnerDirectSupplierPaymentParams) => {
    const conn = await databaseService.getInitializedConnection();
    const result = await InterWorkspaceTransferService.recordOwnerDirectSupplierPayment(conn, params);
    await refreshBusinessData();
    return result;
  }, [refreshBusinessData]);

  const reverseInterWorkspaceTransfer = useCallback(async (transferId: string, reason: string) => {
    const conn = await databaseService.getInitializedConnection();
    await InterWorkspaceTransferService.reverseTransfer(conn, transferId, reason);
    await refreshBusinessData();
  }, [refreshBusinessData]);

  // Intra-Workspace Transfers
  const createAccountTransfer = useCallback(async (command: IntraWorkspaceTransferCommand) => {
    const conn = await databaseService.getInitializedConnection();
    const result = await PostingService.postAccountTransfer(conn, command);
    await refreshBusinessData();
    return result;
  }, [refreshBusinessData]);

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        availableWorkspaces,
        isBusinessMode,
        activeWorkspaceId,
        switchWorkspace,
        createBusiness,
        updateBusiness,
        archiveWorkspace,
        unarchiveWorkspace,
        refreshWorkspaces,
        businessSummary,
        parties,
        products,
        documents,
        accounts,
        transfers,
        createParty,
        createProduct,
        createDocument,
        createCustomAccount,
        recordPayment,
        reversePayment,
        createInterWorkspaceTransfer,
        createDirectSupplierPayment,
        reverseInterWorkspaceTransfer,
        createAccountTransfer,
        refreshBusinessData,
        isWorkspaceSelectorOpen,
        setIsWorkspaceSelectorOpen,
        isCreateBusinessOpen,
        setIsCreateBusinessOpen,
        isCreatePartyOpen,
        setIsCreatePartyOpen,
        isCreateProductOpen,
        setIsCreateProductOpen,
        isCreateDocumentOpen,
        setIsCreateDocumentOpen,
        isTransferModalOpen,
        setIsTransferModalOpen,
        isChartOfAccountsOpen,
        setIsChartOfAccountsOpen
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
