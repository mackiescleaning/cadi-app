import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { DataProvider }    from './context/DataContext';
import { InvoiceProvider } from './context/InvoiceContext';
import { ClientProvider }  from './context/ClientContext';
import ErrorBoundary       from './components/ErrorBoundary';
import AppLayout           from './components/layout/AppLayout';
import ProtectedRoute      from './components/layout/ProtectedRoute';
import CookieConsent       from './components/CookieConsent';
import IdleWarningBanner   from './components/IdleWarningBanner';
import { getConsent, initFullStory } from './lib/fullstory';

// ─── Core bundle — loaded on every session ────────────────────────────────────
import Login      from './pages/auth/Login';
import Signup     from './pages/auth/Signup';
import Dashboard  from './pages/Dashboard';
import Scheduler  from './pages/Scheduler';
import MoneyTracker from './pages/MoneyTracker';
import Customers  from './pages/Customers';
import Payments   from './pages/Payments';
import Settings   from './pages/Settings';
import Onboarding from './pages/Onboarding';

// ─── Lazy — loaded only when first visited ────────────────────────────────────
const Calculator          = lazy(() => import('./pages/Calculator'));
const BusinessLab         = lazy(() => import('./pages/BusinessLab'));
const AnnualReview        = lazy(() => import('./pages/AnnualReview'));
const AccountsTab         = lazy(() => import('./components/AccountsTab'));
const InvoiceSettings     = lazy(() => import('./pages/InvoiceSettings'));
const InvoiceGenerator    = lazy(() => import('./pages/InvoiceGenerator'));
const Quotes              = lazy(() => import('./pages/Quotes'));
const Services            = lazy(() => import('./pages/Services'));
const CatalogueEditor      = lazy(() => import('./pages/CatalogueEditor'));
const MenuPreview          = lazy(() => import('./pages/MenuPreview'));
const OnboardingMigration  = lazy(() => import('./pages/OnboardingMigration'));
const Staff               = lazy(() => import('./pages/Staff'));
const InboxPage           = lazy(() => import('./pages/Inbox'));
const ProUpgradePage      = lazy(() => import('./components/ui/ProUpgrade'));
const BankingSettings     = lazy(() => import('./pages/BankingSettings'));
const FinancialWalkthrough = lazy(() => import('./pages/FinancialWalkthrough'));
const WeeklyReport        = lazy(() => import('./pages/WeeklyReport'));
const SiteSurvey          = lazy(() => import('./pages/SiteSurvey'));

// Front Desk
const SalesManagerPage      = lazy(() => import('./pages/front-desk/SalesManagerPage'));
const ReviewAgentPage       = lazy(() => import('./pages/front-desk/ReviewAgentPage'));
const OperationsManagerPage = lazy(() => import('./pages/front-desk/OperationsManagerPage'));
const ComingSoonAgent       = lazy(() => import('./pages/front-desk/ComingSoonAgent'));
const WidgetSetupWizard     = lazy(() => import('./pages/front-desk/WidgetSetupWizard'));

// Connect (earn)
const EarnLanding    = lazy(() => import('./pages/EarnLanding'));
const EarnMarketplace = lazy(() => import('./pages/earn/EarnMarketplace'));
const EarnPipeline   = lazy(() => import('./pages/earn/EarnPipeline'));
const EarnCompletion = lazy(() => import('./pages/earn/EarnCompletion'));
const EarnConnections = lazy(() => import('./pages/earn/EarnConnections'));
const EarnReputation = lazy(() => import('./pages/earn/EarnReputation'));
const EarnEarnings   = lazy(() => import('./pages/earn/EarnEarnings'));
const EarnComms      = lazy(() => import('./pages/earn/EarnComms'));
const EarnInvoice    = lazy(() => import('./pages/earn/EarnInvoice'));

// Auth & misc
const Confirm     = lazy(() => import('./pages/auth/Confirm'));
const Privacy     = lazy(() => import('./pages/Privacy'));
const Terms       = lazy(() => import('./pages/Terms'));
const InviteAccept = lazy(() => import('./pages/InviteAccept'));
const FmApply     = lazy(() => import('./pages/FmApply'));

// Staff portal
const StaffLogin     = lazy(() => import('./pages/StaffLogin'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));

// Callbacks
const HmrcCallback              = lazy(() => import('./pages/HmrcCallback'));
const GocardlessCallback        = lazy(() => import('./pages/GocardlessCallback'));
const GoCardlessPaymentCallback = lazy(() => import('./pages/GoCardlessPaymentCallback'));
const StripeCallback            = lazy(() => import('./pages/StripeCallback'));
const YapilyCallback            = lazy(() => import('./pages/TruelayerCallback'));

// FM Ops Portal — live (subcontractor network co-ordination)
const FmOpsLayout      = lazy(() => import('./components/fm-ops/FmOpsLayout'));
const FmOpsOverview    = lazy(() => import('./pages/fm-ops/FmOpsOverview'));
const FmOpsContracts        = lazy(() => import('./pages/fm-ops/FmOpsContracts'));
const FmOpsContractNew      = lazy(() => import('./pages/fm-ops/FmOpsContractNew'));
const FmOpsContractDetail   = lazy(() => import('./pages/fm-ops/FmOpsContractDetail'));
const FmOpsSites       = lazy(() => import('./pages/fm-ops/FmOpsSites'));
const FmOpsContractors = lazy(() => import('./pages/fm-ops/FmOpsContractors'));
const FmOpsMarketplace = lazy(() => import('./pages/fm-ops/FmOpsMarketplace'));
const FmOpsSchedule    = lazy(() => import('./pages/fm-ops/FmOpsSchedule'));
const FmOpsApproval    = lazy(() => import('./pages/fm-ops/FmOpsApproval'));
const FmOpsAccounts    = lazy(() => import('./pages/fm-ops/FmOpsAccounts'));
const FmOpsTeam        = lazy(() => import('./pages/fm-ops/FmOpsTeam'));
const AdminFmApplications = lazy(() => import('./pages/AdminFmApplications'));

// Demo portals — large, very infrequently visited
const DemoLanding         = lazy(() => import('./pages/DemoLanding'));
const FmDemoApp           = lazy(() => import('./pages/fm-demo/FmDemoApp'));
const FmOpsExteriorWireframe = lazy(() => import('./pages/fm-demo/wireframe/FmOpsExteriorWireframe'));
const FmOpsPortalWireframe   = lazy(() => import('./pages/fm-demo/wireframe/FmOpsPortalWireframe'));
const CadiConnectTabWireframe = lazy(() => import('./pages/fm-demo/wireframe/CadiConnectTabWireframe'));
const ClientDemoApp       = lazy(() => import('./pages/client-demo/ClientDemoApp'));
const EmployedStaffDemo   = lazy(() => import('./pages/staff-demo/EmployedStaffDemo'));
const OperativePortalDemo = lazy(() => import('./pages/operative-demo/OperativePortalDemo'));
const SchedulerPreview    = lazy(() => import('./pages/SchedulerPreview'));

// ─── Suspense fallback ────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white border border-gray-200 shadow-sm">
        <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold text-gray-600">Loading...</span>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    if (getConsent() === 'accepted') initFullStory();
  }, []);

  return (
    <ErrorBoundary>
    <DataProvider>
    <InvoiceProvider>
    <ClientProvider>
    <Router>
      <CookieConsent />
      <IdleWarningBanner />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Auth */}
        <Route path="/login"      element={<Login />} />
        <Route path="/signup"     element={<Signup />} />
        <Route path="/onboarding"           element={<Onboarding />} />

        {/* Staff PIN login & dashboard — no auth required */}
        <Route path="/staff-login/:token" element={<StaffLogin />} />
        <Route path="/staff-login"        element={<StaffLogin />} />
        <Route path="/staff-dashboard"    element={<StaffDashboard />} />

        {/* Auth callbacks — outside ProtectedRoute so redirects land correctly */}
        <Route path="/auth/confirm"                element={<Confirm />} />
        <Route path="/hmrc/callback"               element={<HmrcCallback />} />
        <Route path="/gocardless/callback"         element={<GocardlessCallback />} />
        <Route path="/gocardless/payment-callback" element={<GoCardlessPaymentCallback />} />
        <Route path="/stripe/callback"             element={<StripeCallback />} />
        <Route path="/yapily/callback"              element={<YapilyCallback />} />

        {/* Invite accept — public, handles own auth */}
        <Route path="/invite/:token" element={<InviteAccept />} />

        {/* FM application — public landing for prospective FMs */}
        <Route path="/apply/fm" element={<FmApply />} />

        {/* Legal — public, no auth required */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms"   element={<Terms />} />

        {/* Demo portals — public, no auth, separate apps */}
        <Route path="/demo"              element={<DemoLanding />} />
        <Route path="/fm-demo/*"         element={<FmDemoApp />} />
        <Route path="/wireframe/fm-ops-exterior" element={<FmOpsExteriorWireframe />} />
        <Route path="/wireframe/fm-ops-portal"   element={<FmOpsPortalWireframe />} />
        <Route path="/wireframe/cadi-connect-tab" element={<CadiConnectTabWireframe />} />
        <Route path="/client-demo/*"     element={<ClientDemoApp />} />
        <Route path="/staff-demo"        element={<EmployedStaffDemo />} />
        <Route path="/operative-demo"    element={<OperativePortalDemo />} />
        <Route path="/scheduler-preview" element={<SchedulerPreview />} />

        {/* FM Ops Portal — facilities-management partners co-ordinating subs */}
        <Route path="/fm-ops" element={
          <ProtectedRoute>
            <FmOpsLayout />
          </ProtectedRoute>
        }>
          <Route index            element={<Navigate to="/fm-ops/overview" replace />} />
          <Route path="overview"    element={<FmOpsOverview />} />
          <Route path="contracts"        element={<FmOpsContracts />} />
          <Route path="contracts/new"    element={<FmOpsContractNew />} />
          <Route path="contracts/:id"    element={<FmOpsContractDetail />} />
          <Route path="sites"       element={<FmOpsSites />} />
          <Route path="contractors" element={<FmOpsContractors />} />
          <Route path="marketplace" element={<FmOpsMarketplace />} />
          <Route path="schedule"    element={<FmOpsSchedule />} />
          <Route path="approval"    element={<FmOpsApproval />} />
          <Route path="accounts"    element={<FmOpsAccounts />} />
          <Route path="team"        element={<FmOpsTeam />} />
        </Route>

        {/* Cadi admin — FM application review queue */}
        <Route path="/admin/fm-applications" element={
          <ProtectedRoute>
            <AdminFmApplications />
          </ProtectedRoute>
        } />

        {/* Manager app */}
        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="calculator" element={<Calculator />} />
          <Route path="scheduler"  element={<Scheduler />} />
          <Route path="customers"  element={<Customers />} />
          <Route path="onboarding/customers" element={<OnboardingMigration />} />
          <Route path="money"      element={<MoneyTracker />} />
          <Route path="scaling"       element={<BusinessLab />} />
          <Route path="business-lab"  element={<BusinessLab />} />
          <Route path="payments"   element={<Payments />} />
          <Route path="invoices"   element={<Navigate to="/payments?tab=invoices" replace />} />
          <Route path="quotes"     element={<Navigate to="/payments?tab=quotes" replace />} />
          <Route path="staff"      element={<Staff />} />
          <Route path="review"     element={<AnnualReview />} />
          <Route path="accounts"   element={<AccountsTab />} />
          <Route path="settings"         element={<Settings />} />
          <Route path="settings/invoice" element={<InvoiceSettings />} />
          {/* Front Desk hub */}
          <Route path="front-desk"                      element={<InboxPage />} />
          <Route path="front-desk/sales-manager"        element={<SalesManagerPage />} />
          <Route path="front-desk/sales-manager/setup"  element={<WidgetSetupWizard />} />
          <Route
            path="front-desk/review-agent"
            element={
              <ComingSoonAgent
                name="Review Agent"
                accent="#059669"
                tagline="Automatically asks every happy customer for a Google review the moment a job is marked complete."
                bullets={[
                  'Smart timing — sends only after a positive job rating',
                  'Templated SMS + email with a one-tap review link',
                  'Tracks responses and feeds them back into your reputation score',
                ]}
              />
            }
          />
          <Route
            path="front-desk/operations-manager"
            element={
              <ComingSoonAgent
                name="Operations Manager"
                accent="#C2410C"
                tagline="An always-on dispatcher that watches your schedule, your team and your money flow — and nudges you before things slip."
                bullets={[
                  'Auto reminders for upcoming jobs, no-shows and check-ins',
                  'Matches incoming payments to invoices and flags shortfalls',
                  'Surfaces team availability gaps before they become problems',
                ]}
              />
            }
          />
          {/* Legacy /inbox redirect */}
          <Route path="inbox" element={<Navigate to="/front-desk" replace />} />
          {/* /services IS the catalogue — one clean view, fed by onboarding,
              tightly coupled to Front Desk. The legacy busy Services page is
              kept available at /services/legacy in case we ever need to fall
              back, but nothing in the app links there. */}
          <Route path="services"           element={<CatalogueEditor />} />
          <Route path="services/catalogue" element={<Navigate to="/services" replace />} />
          <Route path="services/legacy"    element={<Services />} />
          <Route path="menu/preview"      element={<MenuPreview />} />
          <Route path="upgrade"  element={<ProUpgradePage />} />
          {/* Legacy earn → connect redirects */}
          <Route path="earn"   element={<Navigate to="/connect" replace />} />
          <Route path="earn/*" element={<Navigate to="/connect" replace />} />
          {/* Connect */}
          <Route path="connect"             element={<EarnLanding />} />
          <Route path="connect/marketplace" element={<EarnMarketplace />} />
          <Route path="connect/pipeline"    element={<EarnPipeline />} />
          <Route path="connect/completion"  element={<EarnCompletion />} />
          <Route path="connect/connections" element={<EarnConnections />} />
          <Route path="connect/reputation"  element={<EarnReputation />} />
          <Route path="connect/earnings"    element={<EarnEarnings />} />
          <Route path="connect/comms"       element={<EarnComms />} />
          <Route path="connect/invoice"     element={<EarnInvoice />} />
          {/* Phase 2 */}
          <Route path="banking/connect" element={<BankingSettings />} />
          <Route path="walkthrough"     element={<FinancialWalkthrough />} />
          <Route path="reports/:id"     element={<WeeklyReport />} />
          {/* Commercial site survey */}
          <Route path="survey/:surveyId" element={<SiteSurvey />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
    </Router>
    </ClientProvider>
    </InvoiceProvider>
    </DataProvider>
    </ErrorBoundary>
  );
}

export default App;
