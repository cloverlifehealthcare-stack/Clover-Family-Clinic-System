// Mirrors backend/src/utils/age.js — used here only to decide whether to show the
// guardian fields as required; the backend is still the actual source of truth and
// re-validates this itself regardless of what the form sends.
export function isMinor(dateOfBirth) {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age < 18;
}
