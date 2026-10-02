import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaLocationArrow, FaSpinner, FaUser, FaEnvelope, FaPhoneAlt, FaLock, FaExclamationCircle, FaArrowRight } from 'react-icons/fa';
import { authService } from '../services/api';
import AuthShell from '../components/AuthShell';

const SignUpPage = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    address: '',
     city: '',
  state: '',
  pincode: '',
    password: '',
    confirmPassword: '',
  });

  const handleAutoDetectLocation = async () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude: lat, longitude: lng } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const p = data.address || {};
          const parts = [
            p.road || p.hamlet || p.village,
            p.suburb || p.neighbourhood,
            p.city || p.town || p.county,
            p.state,
            p.postcode,
          ].filter(Boolean);
          const resolved = parts.join(', ') || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setFormData(prev => ({
  ...prev,
  address: resolved,
  city: p.city || p.town || p.village || p.county || '',
  state: p.state || '',
  pincode: p.postcode || '',
}));
        } catch {
          setGeoError('Could not fetch address. Please type it manually.');
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location access denied. Please type your address manually.');
        } else {
          setGeoError('Unable to detect location. Please type your address manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Basic client-side validation
    if (!formData.city.trim()) {
  setError('City is required');
  setLoading(false);
  return;
}

if (!formData.state.trim()) {
  setError('State is required');
  setLoading(false);
  return;
}

if (!/^\d{6}$/.test(formData.pincode)) {
  setError('Pincode must be 6 digits');
  setLoading(false);
  return;
}
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (formData.name.length < 5) {
      setError('Full name must be at least 5 characters');
      setLoading(false);
      return;
    }

    const phoneDigits = formData.phoneNumber.replace(/[\s-]/g, '');
    if (!/^\d{10,15}$/.test(phoneDigits)) {
      setError('Phone number must be 10-15 digits');
      setLoading(false);
      return;
    }

    try {
      const response = await authService.signup(formData);
      
      if (response && response.success) {
        // Sign up successful, redirect to sign in
        navigate('/signin', { state: { message: 'Account created successfully! Please sign in.' } });
      } else {
        setError(response?.message || 'Signup failed');
      }
    } catch (err) {
      const errorMessage = err?.message || 'Error during signup';
      setError(errorMessage);
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const strength = (() => {
    const p = formData.password;
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
    return p ? Math.max(1, s) : 0;
  })();
  const strengthMeta = [null, ['Weak', 'bg-rose-500'], ['Fair', 'bg-amber-500'], ['Good', 'bg-lime-500'], ['Strong', 'bg-emerald-500']][strength];

  const Field = ({ label, icon: Icon, right, children, full }) => (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="label-premium">{label}</label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />}
        {children}
        {right}
      </div>
    </div>
  );
  const inputCls = (icon = true) => `input-premium !py-3.5 ${icon ? '!pl-11' : ''}`;

  return (
    <AuthShell
      wide
      title="Create your account"
      subtitle="Join EIRS Technology — it only takes a minute."
      footer={<>Already have an account? <Link to="/signin" className="font-bold text-brand-600 hover:text-brand-700">Sign in</Link></>}
    >
      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"><FaExclamationCircle className="mt-0.5 shrink-0" />{error}</div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <Field label="Full name" icon={FaUser} full>
          <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} required placeholder="Your full name" className={inputCls()} style={{ margin: 0 }} />
        </Field>
        <Field label="Email" icon={FaEnvelope}>
          <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} required placeholder="you@example.com" className={inputCls()} style={{ margin: 0 }} />
        </Field>
        <Field label="Phone number" icon={FaPhoneAlt}>
          <input type="tel" id="phoneNumber" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} required placeholder="10-digit mobile" className={inputCls()} style={{ margin: 0 }} />
        </Field>

        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label-premium !mb-0">Address</label>
            <button type="button" onClick={handleAutoDetectLocation} disabled={geoLoading} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 transition hover:bg-brand-100">
              {geoLoading ? <FaSpinner className="animate-spin" /> : <FaLocationArrow />} {geoLoading ? 'Detecting…' : 'Auto-detect'}
            </button>
          </div>
          <textarea id="address" name="address" rows={2} value={formData.address} onChange={handleInputChange} required placeholder="House no., street, area" className="input-premium resize-none" style={{ margin: 0 }} />
          {geoError && <p className="mt-1.5 text-xs font-semibold text-amber-600">{geoError}</p>}
        </div>

        <Field label="City"><input type="text" id="city" name="city" value={formData.city} onChange={handleInputChange} required placeholder="City" className={inputCls(false)} style={{ margin: 0 }} /></Field>
        <Field label="State"><input type="text" id="state" name="state" value={formData.state} onChange={handleInputChange} required placeholder="State" className={inputCls(false)} style={{ margin: 0 }} /></Field>
        <Field label="Pincode" full><input type="text" inputMode="numeric" id="pincode" name="pincode" maxLength={6} value={formData.pincode} onChange={handleInputChange} required placeholder="6-digit pincode" className={inputCls(false)} style={{ margin: 0 }} /></Field>

        <Field
          label="Password"
          icon={FaLock}
          right={<button type="button" onClick={() => setShowPassword((p) => !p)} aria-label="Toggle password" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-700">{showPassword ? <FaEyeSlash /> : <FaEye />}</button>}
        >
          <input type={showPassword ? 'text' : 'password'} id="password" name="password" value={formData.password} onChange={handleInputChange} required placeholder="Min 6 characters" className={`${inputCls()} !pr-12`} style={{ margin: 0 }} />
        </Field>
        <Field
          label="Confirm password"
          icon={FaLock}
          right={<button type="button" onClick={() => setShowConfirmPassword((p) => !p)} aria-label="Toggle confirm password" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-700">{showConfirmPassword ? <FaEyeSlash /> : <FaEye />}</button>}
        >
          <input type={showConfirmPassword ? 'text' : 'password'} id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} required placeholder="Re-enter password" className={`${inputCls()} !pr-12`} style={{ margin: 0 }} />
        </Field>

        {strengthMeta && (
          <div className="sm:col-span-2 -mt-2">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full transition ${i <= strength ? strengthMeta[1] : 'bg-slate-200'}`} />)}
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">Password strength: {strengthMeta[0]}</p>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-brand !py-3.5 text-base sm:col-span-2">
          {loading ? 'Creating account…' : <>Create account <FaArrowRight className="text-sm" /></>}
        </button>
      </form>
    </AuthShell>
  );
};

export default SignUpPage;
