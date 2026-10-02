import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaEnvelope, FaMobileAlt, FaLock, FaArrowRight, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { authService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';

const IconInput = ({ icon: Icon, right, ...props }) => (
  <div className="relative">
    <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
    <input {...props} className="input-premium !py-3.5 !pl-11 !pr-12" style={{ margin: 0 }} />
    {right}
  </div>
);

const SignInPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [loginMode, setLoginMode] = useState('email');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(location.state?.message || '');
  const [formData, setFormData] = useState({ email: '', password: '' });

  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    setError('');
  };

  const goHome = (isAdmin) => {
    setTimeout(() => {
      navigate(isAdmin ? '/admin/dashboard' : '/', { state: { message: 'Logged in successfully!' } });
    }, 100);
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage(''); setLoading(true);
    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      setLoading(false);
      return;
    }
    try {
      const response = await authService.signin(formData);
      if (response && response.success) {
        if (response.token) login(response.data, response.token);
        goHome(response.data?.isAdmin);
      } else {
        setError(response?.message || 'Sign in failed');
      }
    } catch (err) {
      setError(err?.message || 'Error during sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    setError(''); setMessage(''); setLoading(true);
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      setLoading(false);
      return;
    }
    try {
      const res = await authService.sendFast2SMSOTP(digits);
      if (res.success) {
        setOtpSent(true);
        setMessage(res.message || 'OTP sent successfully!');
        setCountdown(30);
      } else {
        setError(res.message || 'Failed to send OTP');
      }
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.message || err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError(''); setMessage(''); setLoading(true);
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      setLoading(false);
      return;
    }
    try {
      const digits = phone.replace(/\D/g, '').slice(-10);
      const res = await authService.verifyFast2SMSOTP(digits, otp);
      if (res.success) {
        login(res.data, res.token);
        goHome(res.data?.isAdmin);
      } else {
        setError(res.message || 'OTP verification failed');
      }
    } catch (err) {
      setError(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const resetMobileFlow = () => { setOtpSent(false); setOtp(''); setError(''); setMessage(''); };

  return (
    <AuthShell
      title="Welcome back 👋"
      subtitle="Sign in to track orders, use coupons and manage your account."
      footer={<>New to EIRS? <Link to="/signup" className="font-bold text-brand-600 hover:text-brand-700">Create an account</Link></>}
    >
      {/* tabs */}
      <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1.5">
        {[['email', 'Email', FaEnvelope], ['mobile', 'Mobile OTP', FaMobileAlt]].map(([k, l, Icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => { setLoginMode(k); setError(''); setMessage(''); }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${loginMode === k ? 'bg-white text-brand-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon /> {l}
          </button>
        ))}
      </div>

      {message && (
        <div className="mb-5 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100"><FaCheckCircle className="mt-0.5 shrink-0" />{message}</div>
      )}
      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"><FaExclamationCircle className="mt-0.5 shrink-0" />{error}</div>
      )}

      {loginMode === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="label-premium">Email address</label>
            <IconInput icon={FaEnvelope} type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} required placeholder="you@example.com" autoComplete="email" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="label-premium !mb-0">Password</label>
              <Link to="/forgot-password" className="text-xs font-bold text-brand-600 hover:text-brand-700">Forgot password?</Link>
            </div>
            <IconInput
              icon={FaLock}
              type={showPassword ? 'text' : 'password'}
              id="password" name="password" value={formData.password} onChange={handleInputChange} required placeholder="Enter your password" autoComplete="current-password"
              right={<button type="button" onClick={() => setShowPassword((p) => !p)} aria-label="Toggle password" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-700">{showPassword ? <FaEyeSlash /> : <FaEye />}</button>}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-brand w-full !py-3.5 text-base">
            {loading ? 'Signing in…' : <>Sign in <FaArrowRight className="text-sm" /></>}
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <div>
            <label htmlFor="phone" className="label-premium">Mobile number</label>
            <div className="flex gap-2">
              <span className="grid place-items-center rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-600">+91</span>
              <input id="phone" type="tel" inputMode="numeric" disabled={otpSent} value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }} placeholder="10-digit number" className="input-premium !py-3.5 disabled:bg-slate-50" style={{ margin: 0 }} />
            </div>
          </div>

          {!otpSent ? (
            <button type="button" onClick={handleSendOTP} disabled={loading} className="btn-brand w-full !py-3.5 text-base">{loading ? 'Sending…' : 'Send OTP'}</button>
          ) : (
            <>
              <div>
                <label htmlFor="otp" className="label-premium">Enter OTP</label>
                <input id="otp" type="text" inputMode="numeric" value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="• • • • • •" className="input-premium !py-3.5 text-center text-xl font-extrabold tracking-[.5em]" style={{ margin: 0 }} />
              </div>
              <button type="button" onClick={handleVerifyOTP} disabled={loading} className="btn-brand w-full !py-3.5 text-base">{loading ? 'Verifying…' : 'Verify & sign in'}</button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={resetMobileFlow} className="font-semibold text-slate-500 hover:text-slate-800">← Change number</button>
                <button type="button" onClick={handleSendOTP} disabled={countdown > 0 || loading} className="font-bold text-brand-600 disabled:text-slate-400">{countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}</button>
              </div>
            </>
          )}
        </div>
      )}
    </AuthShell>
  );
};

export default SignInPage;
