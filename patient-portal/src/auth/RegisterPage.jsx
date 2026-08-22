import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth';
import { useAuth } from './AuthContext';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  contactNumber: '',
  email: '',
  password: '',
};

export function RegisterPage() {
  const { status, completeRegistration } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState(null); // set on a 409, cleared once resolved

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  async function submit(confirmDuplicate = false) {
    setError(null);
    setSubmitting(true);
    try {
      const { status: httpStatus, data } = await authApi.register({ ...form, confirmDuplicate });

      if (httpStatus === 201) {
        await completeRegistration(data);
        navigate('/');
        return;
      }
      if (httpStatus === 409 && data.error === 'possible_duplicate') {
        setDuplicates(data.possibleDuplicates);
        return;
      }
      setError((data && (data.message || data.error)) || 'Could not create your account.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    submit(false);
  }

  if (duplicates) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Is this you?</h1>
          <p>
            We found an existing record with this name and date of birth. If you&rsquo;ve visited the clinic before,
            please call us so staff can link your visit history to your new portal account instead of creating a
            separate record:
          </p>
          <ul>
            {duplicates.map((d) => (
              <li key={d.id}>
                {d.patient_code} — {d.last_name}, {d.first_name} {d.middle_name} (DOB {d.date_of_birth})
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button type="button" onClick={() => setDuplicates(null)}>
              Go back
            </button>
            <button type="button" onClick={() => submit(true)} disabled={submitting}>
              This is a different person — create my account anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Create Your Account</h1>
        <p className="login-subtitle">Adult patients (18+) only — see note below.</p>

        {error && <div className="login-error">{error}</div>}

        <label htmlFor="firstName">First name</label>
        <input id="firstName" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />

        <label htmlFor="lastName">Last name</label>
        <input id="lastName" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />

        <label htmlFor="dateOfBirth">Date of birth</label>
        <input
          id="dateOfBirth"
          type="date"
          value={form.dateOfBirth}
          onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          required
        />

        <label htmlFor="contactNumber">Contact number</label>
        <input id="contactNumber" value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} />

        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="username" required />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          autoComplete="new-password"
          minLength={8}
          required
        />

        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create Account'}
        </button>

        <p className="login-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <p className="login-note">
          Under 18? The portal isn&rsquo;t available for self-registration yet — please visit the clinic in person, or
          have a parent/guardian call us directly.
        </p>
      </form>
    </div>
  );
}
