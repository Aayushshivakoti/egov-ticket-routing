import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, UserCheck, Users, Mail, Lock, AlertCircle, Cpu } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail) => {
    setEmail(quickEmail);
    setPassword('password123');
  };

  const presets = [
    { label: 'Super Admin', email: 'admin@egov.gov.np', icon: ShieldCheck, color: 'border-rose-500/30 text-rose-400 bg-rose-950/20' },
    { label: 'Water Dept Admin', email: 'water_admin@egov.gov.np', icon: UserCheck, color: 'border-cyan-500/30 text-cyan-400 bg-cyan-950/20' },
    { label: 'Roads Dept Admin', email: 'roads_admin@egov.gov.np', icon: UserCheck, color: 'border-amber-500/30 text-amber-400 bg-amber-950/20' },
    { label: 'Citizen (Hari)', email: 'hari@gmail.com', icon: Users, color: 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl -z-10 animate-pulse delay-700"></div>

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-2xl p-8 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-gradient-to-tr from-blue-600 to-emerald-500 rounded-xl shadow-lg shadow-blue-500/20 mb-3 flex items-center justify-center">
            <Cpu className="w-8 h-8 text-white animate-spin-slow" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            E-Gov Helpdesk
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Intelligent Ticket Routing Portal
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-950/40 border border-rose-800 text-rose-200 rounded-xl text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type="email"
                placeholder="citizen@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-blue-600/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

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
                  className={`flex flex-col items-start p-3 border rounded-xl transition-all hover:scale-[1.02] text-left ${preset.color}`}
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

      </div>
    </div>
  );
};

export default Login;
