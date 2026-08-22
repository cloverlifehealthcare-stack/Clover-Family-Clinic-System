import { useNavigate } from 'react-router-dom';
import { PatientPicker } from '../../components/PatientPicker';

export function BillingLandingPage() {
  const navigate = useNavigate();
  return (
    <PatientPicker
      title="Billing"
      description="Select a patient to view or create a billing statement."
      onPick={(patient) => navigate(`/patients/${patient.id}/billing-statements`)}
    />
  );
}
