

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Dashboard from './pages/Dashboard';
import InventoryPage from './pages/Inventory';
import Calculator from './pages/Calculator';
import Scheduler from './pages/Scheduler';
import SchedulerPreview from './pages/SchedulerPreview';
import Customers from './pages/Customers';
import MoneyTracker from './pages/MoneyTracker';
import Settings from './pages/Settings';
import BusinessLab from './pages/BusinessLab';
import RoutePlanner from './pages/RoutePlanner';
import StaffLogin from './pages/StaffLogin';
import StaffDashboard from './pages/StaffDashboard';

import InvoiceGenerator from './pages/InvoiceGenerator';
import Quotes from './pages/Quotes';
import HmrcCallback from './pages/HmrcCallback';
import GocardlessCallback from './pages/GocardlessCallback';
import TruelayerCallback from './pages/TruelayerCallback';
import Confirm from './pages/auth/Confirm';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';

import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ProUpgradePage from './components/ui/ProUpgrade';
import InboxPage from './pages/Inbox';
import SalesManagerPage      from './pages/front-desk/SalesManagerPage';
import ReviewAgentPage       from './pages/front-desk/ReviewAgentPage';
import OperationsManagerPage from './pages/front-desk/OperationsManagerPage';
import WidgetSetupWizard     from './pages/front-desk/WidgetSetupWizard';
import Services from './pages/Services';
import TrainingStaff from './pages/TrainingStaff';
import AnnualReview from './pages/AnnualReview';
import AccountsTab from './components/AccountsTab';
import Onboarding from './pages/Onboarding';
import EarnLanding      from './pages/EarnLanding';
import EarnMarketplace  from './pages/earn/EarnMarketplace';
import EarnPipeline     from './pages/earn/EarnPipeline';
import EarnCompletion   from './pages/earn/EarnCompletion';
import EarnConnections  from './pages/earn/EarnConnections';
import EarnReputation   from './pages/earn/EarnReputation';
import EarnEarnings     from './pages/earn/EarnEarnings';
import EarnComms        from './pages/earn/EarnComms';
import FmDemoApp from './pages/fm-demo/FmDemoApp';
import ClientDemoApp from './pages/client-demo/ClientDemoApp';
import InvoiceSettings from './pages/InvoiceSettings';
import Payments from './pages/Payments';
import StripeCallback from './pages/StripeCallback';
import GoCardlessPaymentCallback from './pages/GoCardlessPaymentCallback';
import BankingSettings from './pages/BankingSettings';
import FinancialWalkthrough from './pages/FinancialWalkthrough';
import WeeklyReport from './pages/WeeklyReport';
import { DataProvider } from './context/DataContext';
import { InvoiceProvider } from './context/InvoiceContext';
import { ClientProvider } from './context/ClientContext';
import InviteAccept from './pages/InviteAccept';
import ErrorBoundary from './components/ErrorBoundary';


function App() {
  return (
    <ErrorBoundary>
    <DataProvider>
    <InvoiceProvider>
    <ClientProvider>
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Staff PIN login & dashboard — no auth required */}
        <Route path="/staff-login/:token" element={<StaffLogin />} />
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route path="/staff-dashboard" element={<StaffDashboard />} />

        {/* Auth callbacks — outside ProtectedRoute so redirects land correctly */}
        <Route path="/auth/confirm" element={<Confirm />} />
        <Route path="/hmrc/callback" element={<HmrcCallback />} />
        <Route path="/gocardless/callback" element={<GocardlessCallback />} />
        <Route path="/gocardless/payment-callback" element={<GoCardlessPaymentCallback />} />
        <Route path="/stripe/callback" element={<StripeCallback />} />
        <Route path="/truelayer/callback" element={<TruelayerCallback />} />

        {/* Invite accept — public, handles own auth */}
        <Route path="/invite/:token" element={<InviteAccept />} />

        {/* Legal — public, no auth required */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        {/* Demo portals — public, no auth, separate apps */}
        <Route path="/fm-demo/*" element={<FmDemoApp />} />
        <Route path="/client-demo/*" element={<ClientDemoApp />} />

        {/* Scheduler redesign preview — static mock, no auth required */}
        <Route path="/scheduler-preview" element={<SchedulerPreview />} />

        {/* Manager app */}
        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="calculator" element={<Calculator />} />
          <Route path="scheduler" element={<Scheduler />} />
          <Route path="customers" element={<Customers />} />
          <Route path="money" element={<MoneyTracker />} />
          <Route path="scaling" element={<BusinessLab />} />
          <Route path="business-lab" element={<BusinessLab />} />
          <Route path="routes" element={<RoutePlanner />} />
          <Route path="payments" element={<Payments />} />
          <Route path="invoices" element={<Navigate to="/payments?tab=invoices" replace />} />
          <Route path="quotes" element={<Navigate to="/payments?tab=quotes" replace />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="staff" element={<TrainingStaff />} />
          <Route path="review" element={<AnnualReview />} />
          <Route path="accounts" element={<AccountsTab />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/invoice" element={<InvoiceSettings />} />
          {/* Front Desk hub */}
          <Route path="front-desk" element={<InboxPage />} />
          <Route path="front-desk/sales-manager"      element={<SalesManagerPage />} />
          <Route path="front-desk/sales-manager/setup" element={<WidgetSetupWizard />} />
          <Route path="front-desk/review-agent"       element={<ReviewAgentPage />} />
          <Route path="front-desk/operations-manager" element={<OperationsManagerPage />} />
          {/* Legacy /inbox redirect */}
          <Route path="inbox" element={<Navigate to="/front-desk" replace />} />
          <Route path="services" element={<Services />} />
          <Route path="upgrade" element={<ProUpgradePage />} />
          {/* Earn */}
          <Route path="earn"             element={<EarnLanding />} />
          <Route path="earn/marketplace" element={<EarnMarketplace />} />
          <Route path="earn/pipeline"    element={<EarnPipeline />} />
          <Route path="earn/completion"  element={<EarnCompletion />} />
          <Route path="earn/connections" element={<EarnConnections />} />
          <Route path="earn/reputation"  element={<EarnReputation />} />
          <Route path="earn/earnings"    element={<EarnEarnings />} />
          <Route path="earn/comms"       element={<EarnComms />} />
          {/* Phase 2 */}
          <Route path="banking/connect"  element={<BankingSettings />} />
          <Route path="walkthrough"      element={<FinancialWalkthrough />} />
          <Route path="reports/:id"      element={<WeeklyReport />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
    </ClientProvider>
    </InvoiceProvider>
    </DataProvider>
    </ErrorBoundary>
  );
}

export default App;
