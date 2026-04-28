

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
import Confirm from './pages/auth/Confirm';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';


import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ProUpgradePage from './components/ui/ProUpgrade';
import TrainingStaff from './pages/TrainingStaff';
import AnnualReview from './pages/AnnualReview';
import AccountsTab from './components/AccountsTab';
import Onboarding from './pages/Onboarding';
import { DataProvider } from './context/DataContext';
import { InvoiceProvider } from './context/InvoiceContext';
import ErrorBoundary from './components/ErrorBoundary';


function App() {
  return (
    <ErrorBoundary>
    <DataProvider>
    <InvoiceProvider>
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Staff PIN login & dashboard — no auth required */}
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route path="/staff-dashboard" element={<StaffDashboard />} />

        {/* Auth callbacks — outside ProtectedRoute so redirects land correctly */}
        <Route path="/auth/confirm" element={<Confirm />} />
        <Route path="/hmrc/callback" element={<HmrcCallback />} />

        {/* Legal — public, no auth required */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

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
          <Route path="routes" element={<RoutePlanner />} />
          <Route path="invoices" element={<InvoiceGenerator />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="staff" element={<TrainingStaff />} />
          <Route path="review" element={<AnnualReview />} />
          <Route path="accounts" element={<AccountsTab />} />
          <Route path="settings" element={<Settings />} />
          <Route path="upgrade" element={<ProUpgradePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
    </InvoiceProvider>
    </DataProvider>
    </ErrorBoundary>
  );
}

export default App;
