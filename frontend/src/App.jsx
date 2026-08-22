import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppShell } from './layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { PatientsListPage } from './pages/patients/PatientsListPage';
import { PatientCreatePage } from './pages/patients/PatientCreatePage';
import { PatientDetailPage } from './pages/patients/PatientDetailPage';
import { PatientEditPage } from './pages/patients/PatientEditPage';
import { AnimalBiteLandingPage } from './pages/animal-bite/AnimalBiteLandingPage';
import { PatientAnimalBiteRecordsPage } from './pages/animal-bite/PatientAnimalBiteRecordsPage';
import { AnimalBiteCreatePage } from './pages/animal-bite/AnimalBiteCreatePage';
import { AnimalBiteDetailPage } from './pages/animal-bite/AnimalBiteDetailPage';
import { ConsultationsLandingPage } from './pages/consultations/ConsultationsLandingPage';
import { PatientConsultationsPage } from './pages/consultations/PatientConsultationsPage';
import { ConsultationCreatePage } from './pages/consultations/ConsultationCreatePage';
import { ConsultationDetailPage } from './pages/consultations/ConsultationDetailPage';
import { AppointmentsListPage } from './pages/appointments/AppointmentsListPage';
import { AppointmentCreatePage } from './pages/appointments/AppointmentCreatePage';
import { AppointmentDetailPage } from './pages/appointments/AppointmentDetailPage';
import { BillingLandingPage } from './pages/billing/BillingLandingPage';
import { PatientBillingPage } from './pages/billing/PatientBillingPage';
import { BillingCreatePage } from './pages/billing/BillingCreatePage';
import { BillingDetailPage } from './pages/billing/BillingDetailPage';
import { InventoryListPage } from './pages/inventory/InventoryListPage';
import { InventoryCreatePage } from './pages/inventory/InventoryCreatePage';
import { InventoryDetailPage } from './pages/inventory/InventoryDetailPage';
import { SchedulingPage } from './pages/scheduling/SchedulingPage';
import { RemindersPage } from './pages/reminders/RemindersPage';
import { FinancialPage } from './pages/financial/FinancialPage';
import { DailyActivityReportPage } from './pages/reports/DailyActivityReportPage';
import { TrendsReportPage } from './pages/reports/TrendsReportPage';
import { AuditLogPage } from './pages/audit/AuditLogPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route
            path="patients"
            element={
              <ProtectedRoute permission="patients.view">
                <PatientsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="patients/new"
            element={
              <ProtectedRoute permission="patients.create">
                <PatientCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="patients/:id"
            element={
              <ProtectedRoute permission="patients.view">
                <PatientDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="patients/:id/edit"
            element={
              <ProtectedRoute permission="patients.edit">
                <PatientEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="animal-bite"
            element={
              <ProtectedRoute permission="patients.history.view">
                <AnimalBiteLandingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="patients/:patientId/animal-bite-records"
            element={
              <ProtectedRoute permission="patients.history.view">
                <PatientAnimalBiteRecordsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="patients/:patientId/animal-bite-records/new"
            element={
              <ProtectedRoute permission="animalbite.assessment.create">
                <AnimalBiteCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="animal-bite-records/:id"
            element={
              <ProtectedRoute permission="patients.history.view">
                <AnimalBiteDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="consultations"
            element={
              <ProtectedRoute permission="patients.history.view">
                <ConsultationsLandingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="patients/:patientId/consultations"
            element={
              <ProtectedRoute permission="patients.history.view">
                <PatientConsultationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="patients/:patientId/consultations/new"
            element={
              <ProtectedRoute permission="consultation.assessment.create">
                <ConsultationCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="consultations/:id"
            element={
              <ProtectedRoute permission="patients.history.view">
                <ConsultationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="appointments"
            element={
              <ProtectedRoute permission="appointments.view">
                <AppointmentsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="appointments/new"
            element={
              <ProtectedRoute permission="appointments.manage">
                <AppointmentCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="appointments/:id"
            element={
              <ProtectedRoute permission="appointments.view">
                <AppointmentDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="billing"
            element={
              <ProtectedRoute permission="billing.view">
                <BillingLandingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="patients/:patientId/billing-statements"
            element={
              <ProtectedRoute permission="billing.view">
                <PatientBillingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="patients/:patientId/billing-statements/new"
            element={
              <ProtectedRoute permission="billing.create">
                <BillingCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="billing/statements/:id"
            element={
              <ProtectedRoute permission="billing.view">
                <BillingDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory"
            element={
              <ProtectedRoute permission="inventory.view">
                <InventoryListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory/new"
            element={
              <ProtectedRoute permission="inventory.adjust">
                <InventoryCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory/:id"
            element={
              <ProtectedRoute permission="inventory.view">
                <InventoryDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="scheduling"
            element={
              <ProtectedRoute permission="scheduling.view">
                <SchedulingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reminders"
            element={
              <ProtectedRoute permission="reminders.view">
                <RemindersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="financial"
            element={
              <ProtectedRoute permission="financial.view">
                <FinancialPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports"
            element={
              <ProtectedRoute permission="reports.view">
                <DailyActivityReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/trends"
            element={
              <ProtectedRoute permission="reports.view">
                <TrendsReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="audit-log"
            element={
              <ProtectedRoute permission="audit.view">
                <AuditLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <ProtectedRoute permission="users.manage">
                <ComingSoonPage title="Staff Accounts" />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
