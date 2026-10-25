/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

// Core State & Utilities
import { useAppState } from './core/state';
import { PAYMENT_METHODS } from './core/constants';
import { triggerHapticFeedback } from './core/utils/haptics';

// Feature Modules
import { DashboardTab } from './modules/dashboard';
import { TransactionsTab, TransactionFormModal } from './modules/transactions';
import { SavingsTab } from './modules/savings';
import { ProfileTab, SettingsModal } from './modules/settings';
import { AnalysisTab } from './modules/analysis';
import { BudgetManager } from './modules/budgets';
import { CategoryManager } from './modules/categories';
import { 
  TopBar, 
  BottomNav, 
  SidebarMenu, 
  LockScreen, 
  NotificationsModal, 
  BalancePinModal, 
  HelpSupportModal,
  DatabaseRecoveryModal
} from './modules/navigation';

// Business Workspaces & Isolation Modules
import { 
  WorkspaceProvider, 
  useWorkspace, 
  WorkspaceSelectorModal, 
  CreateBusinessModal, 
  CreatePartyModal, 
  CreateProductModal, 
  CreateDocumentModal, 
  BusinessDashboardTab 
} from './modules/businesses';
import { DEFAULT_PERSONAL_WORKSPACE_ID } from './infrastructure/database/migrations/002_business_workspaces_ledger_parties';

function AppContent() {
  const app = useAppState();
  const ws = useWorkspace();

  return (
    <div 
      className={`min-h-screen w-full flex items-center justify-center transition-all duration-300 ${app.activeTheme.fontFamily}`}
      style={{ backgroundColor: app.activeTheme.background, color: app.activeTheme.textPrimary }}
    >
      {/* SCREEN FRAME WRAPPER */}
      <div 
        className="w-full max-w-md h-screen md:max-h-[880px] md:h-[880px] md:rounded-[40px] md:shadow-[0_25px_60px_rgba(0,0,0,0.5)] md:border relative overflow-hidden flex flex-col justify-between"
        style={{ backgroundColor: app.activeTheme.background, borderColor: app.activeTheme.border }}
      >
        {/* DATABASE ZERO-LOSS RECOVERY BARRIER */}
        <DatabaseRecoveryModal
          errorState={app.databaseError}
          onRetry={app.handleDatabaseRetry}
          theme={app.activeTheme}
        />

        {/* APP LOCK PIN BARRIER */}
        <LockScreen
          isLocked={app.isLocked}
          enteredPin={app.enteredPin}
          onKeyPress={app.handlePinKeyPress}
          onBackspace={app.handlePinBackspace}
          onClear={app.handlePinClear}
          lockoutSeconds={app.lockoutSeconds}
          errorMessage={app.lockError}
        />

        {/* IN-APP ALERTS WARNING BANNER */}
        <AnimatePresence>
          {app.activeAlert && (
            <motion.div
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              className="absolute top-4 inset-x-4 bg-rose-500 border border-rose-600 text-white p-4 rounded-2xl shadow-2xl z-[80] flex gap-3 select-none"
            >
              <AlertTriangle className="flex-shrink-0 animate-bounce" size={20} />
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold font-display uppercase tracking-wider">{app.activeAlert.title}</span>
                <span className="text-[11px] mt-0.5 leading-relaxed opacity-90">{app.activeAlert.desc}</span>
              </div>
              <button 
                onClick={() => app.setActiveAlert(null)}
                className="ml-auto text-xs font-extrabold underline self-start cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* IN-APP NOTIFICATIONS OVERLAY */}
        <NotificationsModal
          isOpen={app.isNotificationsOpen}
          notifications={app.notifications}
          theme={app.activeTheme}
          onClose={() => app.setIsNotificationsOpen(false)}
          onMarkAllRead={app.markAllNotificationsRead}
          onClearAll={app.clearAllNotifications}
        />

        {/* BRAND TOP BAR */}
        <TopBar
          theme={app.activeTheme}
          hasUnreadNotifications={app.notifications.some(n => n.unread)}
          onHomeClick={() => app.setActiveTab(0)}
          onToggleNotifications={() => app.setIsNotificationsOpen(prev => !prev)}
          onOpenSidebar={() => app.setIsSidebarOpen(true)}
        />

        {/* APP MAIN VIEW BODY (Framer-motion fade layout) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4.5 pt-4 pb-28 scrollbar-none flex flex-col gap-5">
          <AnimatePresence mode="wait">
            {app.activeTab === 0 && (
              ws.isBusinessMode ? (
                <motion.div
                  key={`biz-tab-${ws.currentWorkspace.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <BusinessDashboardTab
                    workspace={ws.currentWorkspace}
                    summary={ws.businessSummary}
                    parties={ws.parties}
                    products={ws.products}
                    documents={ws.documents}
                    accounts={ws.accounts}
                    currencySymbol={ws.currentWorkspace.currencyCode === 'PKR' ? '₨' : ws.currentWorkspace.currencyCode}
                    theme={app.activeTheme}
                    onReturnToPersonal={() => {
                      ws.switchWorkspace(DEFAULT_PERSONAL_WORKSPACE_ID);
                      app.setActiveTab(0);
                    }}
                    onOpenWorkspaceSelector={() => ws.setIsWorkspaceSelectorOpen(true)}
                    onOpenCreateParty={() => ws.setIsCreatePartyOpen(true)}
                    onOpenCreateProduct={() => ws.setIsCreateProductOpen(true)}
                    onOpenCreateDocument={() => ws.setIsCreateDocumentOpen(true)}
                    onArchiveWorkspace={(id) => ws.archiveWorkspace(id)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="personal-dashboard-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <DashboardTab
                    netBalance={app.financialTotals.netLiquidBalance}
                    balanceRevealed={app.balanceRevealed}
                    currencySymbol={app.state.settings.currencySymbol}
                    theme={app.activeTheme}
                    onToggleBalanceReveal={app.handleToggleBalanceReveal}
                    dashboardToggle={app.dashboardToggle}
                    onToggleDashboardView={app.toggleDashboardView}
                    categoryBreakdown={app.categoryBreakdown}
                    doughnutSegments={app.doughnutSegments}
                    monthIncome={app.financialTotals.monthIncome}
                    activeDoughnutIndex={app.activeDoughnutIndex}
                    onSelectDoughnutIndex={app.setActiveDoughnutIndex}
                    allCategories={app.state.categories}
                    budgets={app.state.budgets}
                  />
                </motion.div>
              )
            )}

            {app.activeTab === 1 && (
              <motion.div
                key="history-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <TransactionsTab
                  transactions={app.state.transactions}
                  categories={app.state.categories}
                  paymentMethods={[...PAYMENT_METHODS]}
                  currencySymbol={app.state.settings.currencySymbol}
                  onDeleteTransaction={app.handleDeleteTransaction}
                  onEditTransaction={app.handleEditTransaction}
                  onAddNotification={app.addNotification}
                  onBack={() => {
                    triggerHapticFeedback();
                    app.setActiveTab(0);
                  }}
                  userProfile={{
                    userName: app.state.settings.userName,
                    userEmail: app.state.settings.userEmail,
                    userPhone: app.state.settings.userPhone,
                    userAddress: app.state.settings.userAddress
                  }}
                  onUpdateProfile={app.handleUpdateSettings}
                  themeCardBg={app.activeTheme.cardBg}
                  themeBorder={app.activeTheme.border}
                  themeRadius={app.activeTheme.radius}
                  themePrimary={app.activeTheme.primary}
                />
              </motion.div>
            )}

            {app.activeTab === 2 && (
              <motion.div
                key="savings-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <SavingsTab
                  savingsGoals={app.state.savingsGoals}
                  wallets={app.state.wallets}
                  currencySymbol={app.state.settings.currencySymbol}
                  onTransferToSavings={app.handleTransferToSavings}
                  onWithdrawFromSavings={app.handleWithdrawFromSavings}
                  onAddGoal={app.handleAddSavingsGoal}
                  onEditGoal={app.handleEditSavingsGoal}
                  onDeleteGoal={app.handleDeleteSavingsGoal}
                  onBack={() => {
                    triggerHapticFeedback();
                    app.setActiveTab(0);
                  }}
                  themeCardBg={app.activeTheme.cardBg}
                  themeBorder={app.activeTheme.border}
                  themeRadius={app.activeTheme.radius}
                  themePrimary={app.activeTheme.primary}
                  vaultPassword={app.state.settings.vaultPassword}
                  onSetVaultPassword={app.handleSetVaultPassword}
                />
              </motion.div>
            )}

            {app.activeTab === 3 && (
              <motion.div
                key="profile-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <ProfileTab
                  settings={app.state.settings}
                  onChangeSettings={app.handleUpdateSettings}
                  avatar={app.avatar}
                  onChangeAvatar={app.updateAvatar}
                  onFactoryReset={app.handleFactoryReset}
                  onExportBackup={app.handleExportBackup}
                  onImportBackup={app.handleImportBackup}
                  activeThemeId={app.activeThemeId}
                  onSelectTheme={app.selectTheme}
                  onBack={() => {
                    triggerHapticFeedback();
                    app.setActiveTab(0);
                  }}
                  themeCardBg={app.activeTheme.cardBg}
                  themeBorder={app.activeTheme.border}
                  themeRadius={app.activeTheme.radius}
                  themePrimary={app.activeTheme.primary}
                  onOpenWorkspaceSelector={() => ws.setIsWorkspaceSelectorOpen(true)}
                  activeWorkspaceName={ws.currentWorkspace.name}
                  isBusinessMode={ws.isBusinessMode}
                />
              </motion.div>
            )}

            {app.activeTab === 4 && (
              <motion.div
                key="analysis-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <AnalysisTab
                  transactions={app.state.transactions}
                  categories={app.state.categories}
                  currencySymbol={app.state.settings.currencySymbol}
                  themeCardBg={app.activeTheme.cardBg}
                  themeBorder={app.activeTheme.border}
                  themeRadius={app.activeTheme.radius}
                  themePrimary={app.activeTheme.primary}
                  onDeleteTransaction={app.handleDeleteTransaction}
                  onEditTransaction={app.handleEditTransaction}
                  onBack={() => {
                    triggerHapticFeedback();
                    app.setActiveTab(0);
                  }}
                />
              </motion.div>
            )}

            {app.activeTab === 5 && (
              <motion.div
                key="budget-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <BudgetManager
                  isOpen={true}
                  isInline={true}
                  onClose={() => {
                    triggerHapticFeedback();
                    app.setActiveTab(0);
                  }}
                  budgets={app.state.budgets}
                  categories={app.state.categories}
                  transactions={app.state.transactions}
                  currencySymbol={app.state.settings.currencySymbol}
                  onSetBudget={app.handleSetBudget}
                  onDeleteBudget={app.handleDeleteBudget}
                  themeCardBg={app.activeTheme.cardBg}
                  themeBorder={app.activeTheme.border}
                  themeRadius={app.activeTheme.radius}
                />
              </motion.div>
            )}

            {app.activeTab === 6 && (
              <motion.div
                key="add-expense-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <TransactionFormModal
                  isOpen={true}
                  isInline={true}
                  type="expense"
                  onClose={() => {
                    triggerHapticFeedback();
                    app.setActiveTab(0);
                  }}
                  onSave={(data) => {
                    app.handleAddTransaction(data);
                    app.setActiveTab(0);
                  }}
                  categories={app.state.categories}
                  subCategories={app.state.subCategories}
                  onAddCategory={app.handleAddCategory}
                  onAddSubCategory={app.handleAddSubCategory}
                  wallets={app.state.wallets}
                  paymentMethods={[...PAYMENT_METHODS]}
                  currencySymbol={app.state.settings.currencySymbol}
                  themeRadius={app.activeTheme.radius}
                  themePrimary={app.activeTheme.primary}
                  themeCardBg={app.activeTheme.cardBg}
                  themeBorder={app.activeTheme.border}
                />
              </motion.div>
            )}

            {app.activeTab === 7 && (
              <motion.div
                key="add-income-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <TransactionFormModal
                  isOpen={true}
                  isInline={true}
                  type="income"
                  onClose={() => {
                    triggerHapticFeedback();
                    app.setActiveTab(0);
                  }}
                  onSave={(data) => {
                    app.handleAddTransaction(data);
                    app.setActiveTab(0);
                  }}
                  categories={app.state.categories}
                  subCategories={app.state.subCategories}
                  onAddCategory={app.handleAddCategory}
                  onAddSubCategory={app.handleAddSubCategory}
                  wallets={app.state.wallets}
                  paymentMethods={[...PAYMENT_METHODS]}
                  currencySymbol={app.state.settings.currencySymbol}
                  themeRadius={app.activeTheme.radius}
                  themePrimary={app.activeTheme.primary}
                  themeCardBg={app.activeTheme.cardBg}
                  themeBorder={app.activeTheme.border}
                />
              </motion.div>
            )}

            {app.activeTab === 8 && (
              <motion.div
                key="categories-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <CategoryManager
                  isOpen={true}
                  isInline={true}
                  onClose={() => {
                    triggerHapticFeedback();
                    app.setActiveTab(0);
                  }}
                  categories={app.state.categories}
                  subCategories={app.state.subCategories}
                  onAddCategory={app.handleAddCategory}
                  onDeleteCategory={app.handleDeleteCategory}
                  onAddSubCategory={app.handleAddSubCategory}
                  onDeleteSubCategory={app.handleDeleteSubCategory}
                  currencySymbol={app.state.settings.currencySymbol}
                  themeCardBg={app.activeTheme.cardBg}
                  themeBorder={app.activeTheme.border}
                  themeRadius={app.activeTheme.radius}
                />
              </motion.div>
            )}

            {app.activeTab === 9 && (
              <motion.div
                key="settings-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <SettingsModal
                  isOpen={true}
                  isInline={true}
                  onClose={() => {
                    triggerHapticFeedback();
                    app.setActiveTab(0);
                  }}
                  settings={app.state.settings}
                  onChangeSettings={app.handleUpdateSettings}
                  onFactoryReset={app.handleFactoryReset}
                  onExportBackup={app.handleExportBackup}
                  onImportBackup={app.handleImportBackup}
                  themeCardBg={app.activeTheme.cardBg}
                  themeBorder={app.activeTheme.border}
                  themeRadius={app.activeTheme.radius}
                />
              </motion.div>
            )}

            {app.activeTab === 10 && (
              <motion.div
                key="help-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <HelpSupportModal
                  isOpen={true}
                  isInline={true}
                  onClose={() => {
                    triggerHapticFeedback();
                    app.setActiveTab(0);
                  }}
                  themeCardBg={app.activeTheme.cardBg}
                  themeBorder={app.activeTheme.border}
                  themeRadius={app.activeTheme.radius}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* --- FLOATING SLEEK TELEGRAM-STYLE GLASSY BOTTOM NAVIGATION BAR --- */}
        <BottomNav
          activeTab={app.activeTab}
          theme={app.activeTheme}
          avatar={app.avatar}
          isRadialOpen={app.isRadialOpen}
          onSelectTab={(tab) => {
            app.setActiveTab(tab);
            app.setIsRadialOpen(false);
          }}
          onToggleRadial={() => app.setIsRadialOpen(!app.isRadialOpen)}
          onSelectRadialAction={(tab) => {
            app.setActiveTab(tab);
            app.setIsRadialOpen(false);
          }}
        />

        {/* --- DUAL TRANSACTION FORM MODAL SHEET (PERSONAL FINANCE CONTEXT) --- */}
        <TransactionFormModal
          isOpen={app.isTxModalOpen}
          type={app.txModalType}
          onClose={() => app.setIsTxModalOpen(false)}
          onSave={app.handleAddTransaction}
          categories={app.state.categories}
          subCategories={app.state.subCategories}
          onAddCategory={app.handleAddCategory}
          onAddSubCategory={app.handleAddSubCategory}
          wallets={app.state.wallets}
          paymentMethods={[...PAYMENT_METHODS]}
          currencySymbol={app.state.settings.currencySymbol}
          themeRadius={app.activeTheme.radius}
          themePrimary={app.activeTheme.primary}
          themeCardBg={app.activeTheme.cardBg}
          themeBorder={app.activeTheme.border}
        />

        {/* --- BUDGET CAPS MANAGER PANEL --- */}
        <BudgetManager
          isOpen={app.isBudgetOpen}
          onClose={() => app.setIsBudgetOpen(false)}
          budgets={app.state.budgets}
          categories={app.state.categories}
          transactions={app.state.transactions}
          currencySymbol={app.state.settings.currencySymbol}
          onSetBudget={app.handleSetBudget}
          onDeleteBudget={app.handleDeleteBudget}
          themeCardBg={app.activeTheme.cardBg}
          themeBorder={app.activeTheme.border}
          themeRadius={app.activeTheme.radius}
        />

        {/* --- SLIDING SIDEBAR NAVIGATION PANEL (☰) --- */}
        <SidebarMenu
          isOpen={app.isSidebarOpen}
          onClose={() => app.setIsSidebarOpen(false)}
          onOpenCategories={() => app.setActiveTab(8)}
          onOpenLedger={() => app.setActiveTab(1)}
          onOpenSavings={() => app.setActiveTab(2)}
          onOpenSettings={() => app.setActiveTab(9)}
          onOpenHelp={() => app.setActiveTab(10)}
          onOpenBusinessManagement={() => ws.setIsWorkspaceSelectorOpen(true)}
          activeWorkspaceName={ws.currentWorkspace.name}
          isBusinessMode={ws.isBusinessMode}
          activeThemeId={app.activeThemeId}
          themeCardBg={app.activeTheme.cardBg}
          themeBorder={app.activeTheme.border}
        />

        {/* --- BALANCES PIN AUTHORIZATION PROMPT --- */}
        <BalancePinModal
          isOpen={app.showBalancePinPrompt}
          pinInput={app.balancePinInput}
          error={app.balancePinError}
          onClose={() => app.setShowBalancePinPrompt(false)}
          onKeyPress={app.handleBalancePinKeyPress}
          onClear={app.handleBalancePinClear}
          onBackspace={app.handleBalancePinBackspace}
        />

        {/* --- WORKSPACE SELECTOR MODAL --- */}
        <WorkspaceSelectorModal
          isOpen={ws.isWorkspaceSelectorOpen}
          onClose={() => ws.setIsWorkspaceSelectorOpen(false)}
          workspaces={ws.availableWorkspaces}
          activeWorkspaceId={ws.activeWorkspaceId}
          onSelectWorkspace={(id) => {
            ws.switchWorkspace(id);
            app.setActiveTab(0);
          }}
          onOpenCreateBusiness={() => ws.setIsCreateBusinessOpen(true)}
          onArchiveWorkspace={(id) => ws.archiveWorkspace(id)}
          onUnarchiveWorkspace={(id) => ws.unarchiveWorkspace(id)}
          theme={app.activeTheme}
        />

        {/* --- CREATE BUSINESS MODAL --- */}
        <CreateBusinessModal
          isOpen={ws.isCreateBusinessOpen}
          onClose={() => ws.setIsCreateBusinessOpen(false)}
          onSubmit={async (params) => {
            await ws.createBusiness(params);
            app.setActiveTab(0);
          }}
          theme={app.activeTheme}
        />

        {/* --- CREATE PARTY MODAL (SCOPED TO ACTIVE BUSINESS) --- */}
        <CreatePartyModal
          isOpen={ws.isCreatePartyOpen}
          workspaceName={ws.currentWorkspace.name}
          currencySymbol={ws.currentWorkspace.currencyCode === 'PKR' ? '₨' : ws.currentWorkspace.currencyCode}
          existingParties={ws.parties}
          onClose={() => ws.setIsCreatePartyOpen(false)}
          onSubmit={async (params) => {
            await ws.createParty(params);
          }}
          theme={app.activeTheme}
        />

        {/* --- CREATE PRODUCT MODAL (SCOPED TO ACTIVE BUSINESS) --- */}
        <CreateProductModal
          isOpen={ws.isCreateProductOpen}
          workspaceName={ws.currentWorkspace.name}
          currencySymbol={ws.currentWorkspace.currencyCode === 'PKR' ? '₨' : ws.currentWorkspace.currencyCode}
          onClose={() => ws.setIsCreateProductOpen(false)}
          onSubmit={async (params) => {
            await ws.createProduct(params);
          }}
          theme={app.activeTheme}
        />

        {/* --- CREATE DOCUMENT MODAL (SCOPED TO ACTIVE BUSINESS) --- */}
        <CreateDocumentModal
          isOpen={ws.isCreateDocumentOpen}
          workspaceName={ws.currentWorkspace.name}
          currencySymbol={ws.currentWorkspace.currencyCode === 'PKR' ? '₨' : ws.currentWorkspace.currencyCode}
          parties={ws.parties}
          products={ws.products}
          onClose={() => ws.setIsCreateDocumentOpen(false)}
          onSubmit={async (params) => {
            await ws.createDocument(params);
          }}
          theme={app.activeTheme}
        />

      </div>
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AppContent />
    </WorkspaceProvider>
  );
}
