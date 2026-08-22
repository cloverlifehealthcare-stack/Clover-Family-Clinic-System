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
