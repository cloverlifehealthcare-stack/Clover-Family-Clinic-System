import { useState } from 'react';
import * as authApi from '../api/auth';
import { useAuth } from '../auth/AuthContext';

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ contactNumber: profile?.contact_number || '', address: profile?.address || '' });
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await authApi.updateMe(form);
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!profile) {
    return <p>Loading…</p>;
  }

  return (
    <div>
      <h1>My Profile</h1>

      <section className="record-section">
        <h2>On file</h2>
        <div className="plain-list">
          <p>
            <strong>Patient code:</strong> {profile.patient_code}
          </p>
          <p>
            <strong>Name:</strong> {profile.first_name} {profile.middle_name} {profile.last_name}
          </p>
          <p>
            <strong>Date of birth:</strong> {profile.date_of_birth}
          </p>
          <p>
            <strong>Portal email:</strong> {profile.portalEmail}
          </p>
        </div>
        <p className="page-description">
          Name, date of birth, and login email can&rsquo;t be changed here — please contact the clinic directly for
          corrections to identity information.
        </p>
      </section>

      <section className="record-section">
        <h2>Contact information</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          {saved && <p>Saved.</p>}
          <div className="form-grid">
            <label>
              Contact number
              <input value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} />
            </label>
            <label className="field-wide">
              Address
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
          </div>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </section>
    </div>
  );
}
