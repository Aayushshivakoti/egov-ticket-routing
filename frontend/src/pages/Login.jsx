import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { ShieldCheck, UserCheck, Users, Mail, Lock, AlertCircle, Cpu, User, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';

const Login = ({ initialRegister = false, onBackToHome }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Registration States
  const [isRegister, setIsRegister] = useState(initialRegister);
  const [step, setStep] = useState(1);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState('citizen');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regDeptId, setRegDeptId] = useState('');
  const [successModal, setSuccessModal] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail) => {
    setEmail(quickEmail);
    setPassword('password123');
  };

  const validateStep1 = () => {
    if (!regName.trim()) {
      setError('Full name is required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }
    setError('');
    return true;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Input Validations
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        department_id: regRole === 'dept_admin' && regDeptId ? parseInt(regDeptId) : null
      };

      await api.post('/auth/register', payload);
      setSuccessModal(true);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModal(false);
    setIsRegister(false);
    setEmail(regEmail); // Prefill email in login
    setPassword('');
    // Reset registration forms
    setStep(1);
    setRegName('');
    setRegEmail('');
    setRegRole('citizen');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegDeptId('');
  };

  const presets = [
    { label: 'Super Admin', email: 'admin@egov.gov.np', icon: ShieldCheck, color: 'border-rose-500/30 text-rose-400 bg-rose-950/20' },
    { label: 'Electricity Admin', email: 'electricity_admin@egov.gov.np', icon: UserCheck, color: 'border-yellow-500/30 text-yellow-400 bg-yellow-950/20' },
    { label: 'Water Dept Admin', email: 'water_admin@egov.gov.np', icon: UserCheck, color: 'border-cyan-500/30 text-cyan-400 bg-cyan-950/20' },
    { label: 'Citizen (Hari)', email: 'hari@gmail.com', icon: Users, color: 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl -z-10 animate-pulse delay-700"></div>

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-2xl p-8 shadow-2xl relative">
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            className="absolute top-4 left-4 text-xs font-semibold text-slate-500 hover:text-slate-350 transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-none"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Gateway
          </button>
        )}
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-gradient-to-tr from-blue-600 to-emerald-500 rounded-xl shadow-lg shadow-blue-500/20 mb-3 flex items-center justify-center">
            <Cpu className="w-8 h-8 text-white animate-spin-slow" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            {isRegister ? 'Create Account' : 'E-Gov Helpdesk'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isRegister ? 'Register your public credentials' : 'Intelligent Ticket Routing Portal'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-950/40 border border-rose-800 text-rose-200 rounded-xl text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {!isRegister ? (
          /* LOGIN PANEL */
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  placeholder="citizen@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-blue-600/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-500">Don't have an account? </span>
              <button
                type="button"
                onClick={() => { setIsRegister(true); setStep(1); setError(''); }}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Sign Up
              </button>
            </div>

            {/* Quick Login Presets */}
            <div className="mt-8 border-t border-slate-800/80 pt-6">
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                Quick Session Testing
              </p>
              <div className="grid grid-cols-2 gap-3">
                {presets.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.email}
                      type="button"
                      onClick={() => handleQuickLogin(preset.email)}
                      className={`flex flex-col items-start p-3 border rounded-xl transition-all hover:scale-[1.02] text-left cursor-pointer ${preset.color}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">{preset.label}</span>
                      </div>
                      <span className="text-[10px] opacity-75 truncate w-full">{preset.email}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </form>
        ) : (
          /* MULTI-STEP SIGNUP PANEL */
          <div className="space-y-6">
            
            {/* Step Progress Line */}
            <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>1</span>
                <span className="text-xs font-semibold text-slate-300">Details</span>
              </div>
              <div className="h-0.5 w-16 bg-slate-800 flex-1 mx-4">
                <div className={`h-full bg-blue-600 transition-all duration-305 ${step === 2 ? 'w-full' : 'w-0'}`} />
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>2</span>
                <span className="text-xs font-semibold text-slate-400">Settings</span>
              </div>
            </div>

            {step === 1 ? (
              /* REGISTRATION STEP 1: Details */
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Hari Bahadur"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" />
                    <input
                      type="email"
                      placeholder="hari@gmail.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  Continue to Step 2
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* REGISTRATION STEP 2: Role & Security */
              <form onSubmit={handleRegisterSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Account Role</label>
                  <div className="w-full px-4 py-3 bg-slate-950/40 border border-slate-800 rounded-xl text-slate-400 text-sm font-semibold select-none">
                    Citizen (General Public)
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" />
                    <input
                      type="password"
                      placeholder="At least 6 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" />
                    <input
                      type="password"
                      placeholder="Repeat password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(''); }}
                    className="flex-1 py-3 px-4 bg-slate-950 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-slate-200 font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-2 py-3 px-4 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    {loading ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            )}

            <div className="text-center pt-2 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(''); }}
                className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Back to Sign In
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Success Account Creation Alert Modal */}
      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <div className="mx-auto w-12 h-12 bg-emerald-950/50 border border-emerald-800/40 rounded-xl text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-100">Registration Complete</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Your civic helpdesk profile has been successfully created. You can now login.
              </p>
            </div>
            <button
              onClick={handleSuccessClose}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-blue-500/10"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Login;
