import { useNavigate } from 'react-router-dom';
import { PatientPicker } from '../../components/PatientPicker';

export function ConsultationsLandingPage() {
  const navigate = useNavigate();
  return (
    <PatientPicker
      title="Consultations"
      description="Select a patient to view or start a consultation."
      onPick={(patient) => navigate(`/patients/${patient.id}/consultations`)}
    />
  );
}
