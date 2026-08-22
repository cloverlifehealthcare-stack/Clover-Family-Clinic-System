import { useNavigate } from 'react-router-dom';
import { PatientPicker } from '../../components/PatientPicker';

export function AnimalBiteLandingPage() {
  const navigate = useNavigate();
  return (
    <PatientPicker
      title="Animal Bite Center"
      description="Select a patient to view or start an animal bite record."
      onPick={(patient) => navigate(`/patients/${patient.id}/animal-bite-records`)}
    />
  );
}
