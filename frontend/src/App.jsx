import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import AllGrievances from './pages/AllGrievances';
import api from './services/api';
import { 
  Cpu, Loader, Shield, FileSpreadsheet, Sparkles, X, Mail, Lock, 
  AlertCircle, CheckCircle2, User, ArrowRight, ArrowLeft, Eye, 
  Building2, Users, FileText, ExternalLink, Clock, Send
} from 'lucide-react';

const AppContent = () => {
  const { user, loading, login } = useAuth();
  
  // Modals state
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  
  // Public data state
  const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, resolved: 0 });
  const [feed, setFeed] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState('home'); // 'home' or 'all-grievances'
  const [requestingProof, setRequestingProof] = useState(null);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Citizen registration form state
  const [regStep, setRegStep] = useState(1);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [showRegSuccess, setShowRegSuccess] = useState(false);
  
  // Proof details state
  const [selectedProof, setSelectedProof] = useState(null);
  const [loadingProof, setLoadingProof] = useState(false);

  // Fetch public statistics & masked ticket logs feed
  const fetchPublicData = async () => {
    try {
      const [statsRes, feedRes, deptsRes] = await Promise.all([
        api.get('/tickets/public/stats'),
        api.get('/tickets/public/feed?limit=8'),
        api.get('/departments')
      ]);
      setStats(statsRes.data);
      setFeed(feedRes.data);
      setDepartments(deptsRes.data);
    } catch (err) {
      console.error("Failed to load public portal metrics:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!user) {
      fetchPublicData();
    }
  }, [user]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      setLoginModalOpen(false);
      // Reset fields
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      setLoginError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');
    
    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match.');
      return;
    }
    
    setRegLoading(true);
    try {
      await api.post('/auth/register', {
        name: regName,
        email: regEmail,
        password: regPassword,
        role: 'citizen'
      });
      setShowRegSuccess(true);
    } catch (err) {
      setRegError(err.response?.data?.detail || err.message || 'Failed to register account.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleRegSuccessClose = () => {
    setShowRegSuccess(false);
    setRegisterModalOpen(false);
    setLoginEmail(regEmail); // Pre-fill registered email in unified login modal
    setLoginPassword('');
    // Reset registration wizard
    setRegStep(1);
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setRegConfirmPassword('');
    setLoginModalOpen(true);
  };

  const handleViewProof = async (ticketId) => {
    setLoadingProof(true);
    try {
      const res = await api.get(`/tickets/public/${ticketId}/proof`);
      setSelectedProof(res.data);
      setProofModalOpen(true);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to retrieve grievance resolution proof metadata.');
    } finally {
      setLoadingProof(false);
    }
  };

  const handleRequestProof = async (ticketId) => {
    setRequestingProof(ticketId);
    try {
      await api.post(`/tickets/${ticketId}/request-proof`);
      alert('Proof request sent successfully! The department has been notified.');
      fetchPublicData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to request proof.');
    } finally {
      setRequestingProof(null);
    }
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.id === deptId);
    return dept ? dept.name : 'AI Routing...';
  };

  const getStatusBadge = (s) => {
    const styles = {
      processing: 'bg-purple-950/40 text-purple-400 border border-purple-800/50',
      pending: 'bg-yellow-950/40 text-yellow-400 border border-yellow-800/50',
      in_progress: 'bg-blue-950/40 text-blue-400 border border-blue-800/50',
      resolved: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50',
      sla_violated: 'bg-rose-950/40 text-rose-400 border border-rose-800/50'
    };
    return (
      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${styles[s] || ''}`}>
        {s.replace('_', ' ')}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const filteredFeed = feed.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center gap-4 text-slate-100">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center animate-pulse">
          <Cpu className="w-10 h-10 text-blue-500 animate-spin-slow" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          <Loader className="w-4 h-4 animate-spin text-blue-500" />
          <span>Synchronizing Session...</span>
        </div>
      </div>
    );
  }

  // Active user session immediately loads corresponding dashboard layout
  if (user) {
    return <Dashboard />;
  }

  // All Grievances page (full database view)
  if (currentPage === 'all-grievances') {
    return (
      <AllGrievances
        onBack={() => setCurrentPage('home')}
        departments={departments}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden font-sans flex flex-col justify-between">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl -z-10 animate-pulse delay-700"></div>

      {/* Header / Navbar */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-emerald-500 rounded-lg shadow-md shadow-blue-500/10 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-base leading-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                E-Gov Ticket Routing Portal
              </h1>
              <p className="text-[9px] text-slate-500 tracking-wider font-semibold uppercase">
                Intelligent Citizen Helpdesk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setLoginModalOpen(true)}
              className="px-4 py-2 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setRegStep(1);
                setRegisterModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 cursor-pointer"
            >
              Register as Citizen
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-grow flex flex-col justify-center gap-14">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-xs font-bold select-none">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            Empowered by Explainable Machine Learning
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight bg-gradient-to-r from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
            Smart, Transparent E-Governance Grievance Routing
          </h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
             Nepal's municipal grievance helpline. File civic issues (Electricity, Water, Infrastructure, Waste) and watch our Hybrid ML pipeline analyze, classify, and automatically route tickets to corresponding departmental admins in seconds.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={() => {
                setRegStep(1);
                setRegisterModalOpen(true);
              }}
              className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold rounded-xl text-sm transition-all duration-350 shadow-lg shadow-blue-600/15 cursor-pointer transform hover:scale-[1.02]"
            >
              File a Grievance
            </button>
            <button
              onClick={() => setLoginModalOpen(true)}
              className="px-6 py-3.5 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl text-sm font-bold transition-all cursor-pointer"
            >
              Track Existing Report
            </button>
          </div>
        </div>

        {/* Analytics Counter Section */}
        <section className="space-y-4">
          <div className="text-center space-y-1">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Executive Summary</h3>
            <p className="text-lg font-black text-slate-200">Live Infrastructure Analytics</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-slate-900 border border-slate-800/80 rounded-2xl flex flex-col justify-between shadow-lg">
              <span className="text-[10px] font-semibold text-slate-550 uppercase tracking-wider">Total Grievances</span>
              <h4 className="text-3xl font-black mt-2 text-slate-200" id="public-stat-total">
                {loadingData ? '...' : stats.total}
              </h4>
            </div>
            <div className="p-5 bg-slate-900 border border-slate-800/80 rounded-2xl flex flex-col justify-between shadow-lg">
              <span className="text-[10px] font-semibold text-slate-550 uppercase tracking-wider">Pending Assign</span>
              <h4 className="text-3xl font-black mt-2 text-yellow-450" id="public-stat-pending">
                {loadingData ? '...' : stats.pending}
              </h4>
            </div>
            <div className="p-5 bg-slate-900 border border-slate-800/80 rounded-2xl flex flex-col justify-between shadow-lg">
              <span className="text-[10px] font-semibold text-slate-550 uppercase tracking-wider">In Progress</span>
              <h4 className="text-3xl font-black mt-2 text-blue-450" id="public-stat-progress">
                {loadingData ? '...' : stats.in_progress}
              </h4>
            </div>
            <div className="p-5 bg-slate-900 border border-slate-800/80 rounded-2xl flex flex-col justify-between shadow-lg">
              <span className="text-[10px] font-semibold text-slate-550 uppercase tracking-wider">Resolved Cases</span>
              <h4 className="text-3xl font-black mt-2 text-emerald-450" id="public-stat-resolved">
                {loadingData ? '...' : stats.resolved}
              </h4>
            </div>
          </div>
        </section>

        {/* Public Transparency Feed */}
        <section className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-400" />
              <h3 className="font-extrabold text-lg text-slate-200">Latest Public Grievances</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative max-w-xs w-full">
                <input
                  type="text"
                  placeholder="Search ticket logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all text-xs font-semibold"
                />
              </div>
              <button
                onClick={() => setCurrentPage('all-grievances')}
                className="px-3 py-1.5 bg-blue-950/40 hover:bg-blue-900/40 border border-blue-900/30 text-blue-400 hover:text-blue-300 rounded-lg text-[10px] font-bold tracking-wide transition-all cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View All Grievances
              </button>
            </div>
          </div>

          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3 border border-slate-900 rounded-xl bg-slate-900/10">
              <Loader className="w-6 h-6 animate-spin text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Loading Transparency Feed...</span>
            </div>
          ) : filteredFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-650 gap-2 border border-dashed border-slate-800 rounded-xl">
              <p className="text-xs font-bold text-slate-450">No ticket records found</p>
              <p className="text-[10px] text-slate-600">The public records database did not yield matching logs.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" id="transparency-feed-table">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-550 uppercase tracking-widest bg-slate-950/20">
                    <th className="py-4 px-4 w-14">ID</th>
                    <th className="py-4 px-4">Subject</th>
                    <th className="py-4 px-4">Routed Department</th>
                    <th className="py-4 px-4">Resolution Status</th>
                    <th className="py-4 px-4">Date Filed</th>
                    <th className="py-4 px-4 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {filteredFeed.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/40 transition-colors font-medium">
                      <td className="py-4 px-4 font-mono text-[10px] text-slate-500 font-bold">
                        #T-{row.id}
                      </td>
                      <td className="py-4 px-4 text-slate-200">
                        {row.title}
                      </td>
                      <td className="py-4 px-4 text-slate-400 font-semibold">
                        {getDepartmentName(row.assigned_department_id)}
                      </td>
                      <td className="py-4 px-4">
                        {getStatusBadge(row.status)}
                        {row.sla_violated && (
                          <span className="ml-1 px-1.5 py-0.5 bg-rose-950/60 text-rose-400 border border-rose-800/50 text-[8px] font-extrabold uppercase rounded-full">SLA</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-500">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {row.status === 'resolved' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {row.has_proof ? (
                              <button
                                onClick={() => handleViewProof(row.id)}
                                disabled={loadingProof}
                                className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-950/80 border border-emerald-900/30 text-emerald-450 hover:text-emerald-400 rounded-lg text-[10px] font-bold tracking-wide transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View Proof & Report
                              </button>
                            ) : (
                              <>
                                {row.proof_requested_at ? (
                                  <span className="px-3 py-1.5 bg-amber-950/30 border border-amber-900/20 text-amber-500 rounded-lg text-[10px] font-bold tracking-wide inline-flex items-center gap-1 select-none animate-pulse">
                                    <Clock className="w-3.5 h-3.5" />
                                    Proof Requested — Awaiting
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleRequestProof(row.id)}
                                    disabled={requestingProof === row.id}
                                    className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-lg text-[10px] font-extrabold tracking-wide transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shadow-lg shadow-rose-500/15 animate-pulse hover:animate-none"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    {requestingProof === row.id ? 'Sending...' : 'Request Resolution Proof'}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-650 font-bold italic select-none">Pending closure</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500 font-semibold tracking-wider uppercase">
          <p>© 2026 E-Governance Helpdesk Portal. Government of Nepal.</p>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-slate-400 transition-colors">Terms of Service</a>
            <a href="#help" className="hover:text-slate-400 transition-colors">Documentation</a>
          </div>
        </div>
      </footer>

      {/* 1. Unified Login Modal Overlay */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl p-8 shadow-2xl relative">
            <button 
              onClick={() => {
                setLoginModalOpen(false);
                setLoginError('');
              }}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="flex flex-col items-center mb-8">
              <div className="p-3 bg-gradient-to-tr from-blue-600 to-emerald-500 rounded-xl shadow-lg mb-3 flex items-center justify-center">
                <Cpu className="w-8 h-8 text-white animate-spin-slow" />
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Unified Portal Access
              </h3>
              <p className="text-xs text-slate-400 mt-1">Sign in as Citizen, Dept Admin, or Supervisor</p>
            </div>

            {loginError && (
              <div className="mb-5 p-3.5 bg-rose-950/40 border border-rose-800/60 text-rose-300 rounded-xl text-xs flex items-center gap-2.5 font-medium animate-pulse">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 text-rose-450" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="login-email">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="citizen@gmail.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="login-password">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
                  <input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold rounded-xl transition-all duration-300 shadow-md shadow-blue-500/10 disabled:opacity-50 cursor-pointer text-xs mt-2"
              >
                {loginLoading ? 'Authenticating...' : 'Sign In'}
              </button>

              <div className="text-center pt-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">New citizen? </span>
                <button
                  type="button"
                  onClick={() => {
                    setLoginModalOpen(false);
                    setRegStep(1);
                    setRegisterModalOpen(true);
                  }}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-350 transition-colors uppercase tracking-widest"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Citizen Registration Modal Overlay */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl p-8 shadow-2xl relative">
            <button 
              onClick={() => {
                setRegisterModalOpen(false);
                setRegError('');
              }}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="flex flex-col items-center mb-6">
              <div className="p-3 bg-gradient-to-tr from-blue-600 to-emerald-500 rounded-xl shadow-lg mb-3 flex items-center justify-center">
                <User className="w-8 h-8 text-white animate-pulse" />
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Citizen Account Registration
              </h3>
              <p className="text-xs text-slate-400 mt-1">Submit authentic civic complaints</p>
            </div>

            {regError && (
              <div className="mb-5 p-3.5 bg-rose-950/40 border border-rose-800/60 text-rose-300 rounded-xl text-xs flex items-center gap-2.5 font-medium animate-pulse">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 text-rose-450" />
                <span>{regError}</span>
              </div>
            )}

            {/* Step Progress Line */}
            <div className="flex items-center justify-between px-4 pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-bold ${regStep >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>1</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Bio Details</span>
              </div>
              <div className="h-0.5 bg-slate-800 flex-1 mx-4">
                <div className={`h-full bg-blue-600 transition-all duration-300 ${regStep === 2 ? 'w-full' : 'w-0'}`} />
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-bold ${regStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>2</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Security</span>
              </div>
            </div>

            {regStep === 1 ? (
              /* REGISTRATION STEP 1 */
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="reg-name">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
                    <input
                      id="reg-name"
                      type="text"
                      placeholder="e.g. Suman Adhikari"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500 transition-all text-xs font-semibold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="reg-email">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
                    <input
                      id="reg-email"
                      type="email"
                      placeholder="suman@gmail.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500 transition-all text-xs font-semibold"
                      required
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (regName.trim() && regEmail.trim()) {
                      setRegStep(2);
                      setRegError('');
                    } else {
                      setRegError('Name and Email are required.');
                    }
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-md shadow-blue-500/10 mt-2"
                >
                  Continue to Step 2
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* REGISTRATION STEP 2 */
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Account Role</label>
                  <div className="w-full px-4 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-slate-400 text-xs font-semibold select-none">
                    Citizen (General Public)
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="reg-password">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
                    <input
                      id="reg-password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500 transition-all text-xs font-semibold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="reg-confirm">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-500" />
                    <input
                      id="reg-confirm"
                      type="password"
                      placeholder="Repeat password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none focus:border-blue-500 transition-all text-xs font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRegStep(1);
                      setRegError('');
                    }}
                    className="flex-1 py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-slate-250 font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={regLoading}
                    className="flex-2 py-2.5 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer text-xs shadow-md shadow-emerald-500/10"
                  >
                    {regLoading ? 'Registering...' : 'Create Account'}
                  </button>
                </div>
              </form>
            )}

            <div className="text-center pt-2 border-t border-slate-800/60 mt-5">
              <button
                type="button"
                onClick={() => {
                  setRegisterModalOpen(false);
                  setLoginModalOpen(true);
                }}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-widest"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Interactive Proof Gallery Modal Overlay */}
      {proofModalOpen && selectedProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setProofModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="flex items-center gap-2 text-emerald-400 font-bold border-b border-slate-800/60 pb-3">
              <CheckCircle2 className="w-5 h-5 animate-pulse" />
              <h3 className="text-base font-black">Grievance Resolution Audit Gallery</h3>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <h4 className="text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Grievance Title</h4>
                <p className="text-xs font-bold text-slate-200">{selectedProof.title}</p>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Closure Remarks / Remarks from Officials</h4>
                <p className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-slate-300 text-xs whitespace-pre-line leading-relaxed">
                  {selectedProof.remarks || 'No resolution remarks were recorded.'}
                </p>
              </div>

              {selectedProof.attachments && selectedProof.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Resolution Proof Media Gallery ({selectedProof.attachments.length})</h4>
                  <div className="space-y-4">
                    {selectedProof.attachments.map((att) => {
                      const fullUrl = `http://localhost:8000${att.file_path}`;
                      return (
                        <div key={att.id} className="relative bg-slate-950/60 border border-slate-850 rounded-xl overflow-hidden p-4 flex flex-col items-center justify-center min-h-[160px]">
                          {att.file_type === 'photo' ? (
                            <img 
                              src={fullUrl} 
                              alt="Resolution Proof" 
                              className="max-h-[220px] object-contain rounded-lg shadow-md border border-slate-850"
                            />
                          ) : att.file_type === 'video' ? (
                            <video 
                              src={fullUrl} 
                              controls 
                              className="max-h-[220px] w-full rounded-lg shadow-md border border-slate-850"
                            />
                          ) : att.file_type === 'audio' ? (
                            <div className="flex flex-col items-center justify-center p-4 w-full gap-2 bg-slate-900/40 rounded-lg border border-slate-850">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Official Audio Clip</span>
                              <audio 
                                src={fullUrl} 
                                controls 
                                className="w-full"
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Registration Alert Modal Overlay */}
      {showRegSuccess && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <div className="mx-auto w-12 h-12 bg-emerald-950/50 border border-emerald-800/40 rounded-xl text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-100">Registration Complete</h3>
              <p className="text-xs text-slate-450 mt-2 leading-relaxed">
                Your civic helpdesk profile has been successfully created. You can now login.
              </p>
            </div>
            <button
              onClick={handleRegSuccessClose}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-blue-500/10 cursor-pointer"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
