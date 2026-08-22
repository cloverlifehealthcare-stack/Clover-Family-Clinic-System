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
                <ComingSoonPage title="Animal Bite Center" />
              </ProtectedRoute>
            }
          />
          <Route
            path="consultations"
            element={
              <ProtectedRoute permission="patients.history.view">
                <ComingSoonPage title="Consultations" />
              </ProtectedRoute>
            }
          />
          <Route
            path="appointments"
            element={
              <ProtectedRoute permission="appointments.view">
                <ComingSoonPage title="Appointments" />
              </ProtectedRoute>
            }
          />
          <Route
            path="billing"
            element={
              <ProtectedRoute permission="billing.view">
                <ComingSoonPage title="Billing" />
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
