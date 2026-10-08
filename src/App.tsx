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
  HelpSupportModal 
} from './modules/navigation';

export default function App() {
  const app = useAppState();

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
        {/* APP LOCK PIN BARRIER */}
        <LockScreen
          isLocked={app.isLocked}
          enteredPin={app.enteredPin}
          onKeyPress={app.handlePinKeyPress}
          onBackspace={app.handlePinBackspace}
          onClear={app.handlePinClear}
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

        {/* BRAND TOP BAR (Cocoon Logo & Notification/Hamburger Triggers) */}
        <TopBar
          theme={app.activeTheme}
          hasUnreadNotifications={app.notifications.some(n => n.unread)}
          onHomeClick={() => app.setActiveTab(0)}
          onToggleNotifications={() => app.setIsNotificationsOpen(prev => !prev)}
          onOpenSidebar={() => app.setIsSidebarOpen(true)}
        />

        {/* APP MAIN VIEW BODY (Framer-motion fade layout) */}
        <div className="flex-1 overflow-y-auto px-4.5 pt-4 pb-28 scrollbar-none flex flex-col gap-5">
          <AnimatePresence mode="wait">
            {app.activeTab === 0 && (
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

        {/* --- DUAL TRANSACTION FORM MODAL SHEET --- */}
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

      </div>
    </div>
  );
}
