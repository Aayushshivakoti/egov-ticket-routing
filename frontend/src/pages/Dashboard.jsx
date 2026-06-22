import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import CitizenDashboard from '../components/CitizenDashboard';
import DeptAdminDashboard from '../components/DeptAdminDashboard';
import SupervisorDashboard from '../components/SupervisorDashboard';
import { LogOut, Cpu, User, Loader } from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stats summary for the cards
  const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, resolved: 0 });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Run API fetches in parallel using Axios
      const [ticketsResponse, deptsResponse] = await Promise.all([
        api.get('/tickets'),
        api.get('/departments')
      ]);

      setTickets(ticketsResponse.data);
      setDepartments(deptsResponse.data);
      calculateStats(ticketsResponse.data);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ticketList) => {
    const s = { total: ticketList.length, pending: 0, in_progress: 0, resolved: 0 };
    ticketList.forEach(t => {
      if (t.status === 'pending') s.pending += 1;
      else if (t.status === 'in_progress') s.in_progress += 1;
      else if (t.status === 'resolved') s.resolved += 1;
    });
    setStats(s);
  };

  const getPriorityBadge = (p) => {
    const styles = {
      high: 'bg-rose-950/40 text-rose-400 border border-rose-800/50',
      medium: 'bg-amber-950/40 text-amber-400 border border-amber-800/50',
      low: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50'
    };
    return (
      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${styles[p] || ''}`}>
        {p}
      </span>
    );
  };

  const getStatusBadge = (s) => {
    const styles = {
      pending: 'bg-yellow-950/40 text-yellow-400 border border-yellow-800/50',
      in_progress: 'bg-blue-950/40 text-blue-400 border border-blue-800/50',
      resolved: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50'
    };
    return (
      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${styles[s] || ''}`}>
        {s.replace('_', ' ')}
      </span>
    );
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.id === deptId);
    return dept ? dept.name : 'AI Routing...';
  };

  const getDepartmentDescription = () => {
    if (user && user.role === 'dept_admin') {
      const dept = departments.find(d => d.id === user.department_id);
      return dept ? dept.description : '';
    }
    return '';
  };

  const renderDashboardByRole = () => {
    if (user.role === 'super_admin') {
      return (
        <SupervisorDashboard
          tickets={tickets}
          departments={departments}
          onRefresh={fetchData}
          getPriorityBadge={getPriorityBadge}
          getStatusBadge={getStatusBadge}
          getDepartmentName={getDepartmentName}
        />
      );
    } else if (user.role === 'dept_admin') {
      return (
        <DeptAdminDashboard
          tickets={tickets}
          onRefresh={fetchData}
          getPriorityBadge={getPriorityBadge}
          getStatusBadge={getStatusBadge}
          getDepartmentName={getDepartmentName}
        />
      );
    } else {
      return (
        <CitizenDashboard
          tickets={tickets}
          departments={departments}
          onRefresh={fetchData}
          getPriorityBadge={getPriorityBadge}
          getStatusBadge={getStatusBadge}
          getDepartmentName={getDepartmentName}
        />
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* Dashboard Top Header */}
      <header className="border-b border-slate-900 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-emerald-500 rounded-lg shadow-md shadow-blue-500/10 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                E-Gov Ticket Routing Portal
              </h1>
              <p className="text-[10px] text-slate-500 tracking-wider font-semibold uppercase">
                Intelligent Dispatch Center
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl" id="profile-card">
              <User className="w-4 h-4 text-slate-400" />
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-slate-300">{user?.name}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase" id="profile-role">{user?.role.replace('_', ' ')}</p>
              </div>
            </div>
            
            <button 
              id="logout-btn"
              onClick={logout}
              className="p-2.5 bg-slate-900 hover:bg-rose-950/20 hover:border-rose-900/50 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Department banner details */}
        {user?.role === 'dept_admin' && (
          <div className="p-6 bg-gradient-to-r from-blue-950/20 to-slate-900 border border-blue-900/30 rounded-2xl flex items-start gap-4" id="dept-banner">
            <div className="p-3 bg-blue-950/40 border border-blue-900/20 rounded-xl text-blue-400">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-blue-400 uppercase tracking-widest">Assigned Department Control</h3>
              <p className="text-lg font-black text-slate-200 mt-1" id="dept-banner-name">{getDepartmentName(user.department_id)}</p>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">{getDepartmentDescription()}</p>
            </div>
          </div>
        )}

        {/* Global Summary Stats Card Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-900 border border-slate-800/80 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Reports</p>
              <h3 className="text-2xl font-black mt-1 text-slate-200" id="stat-total">{stats.total}</h3>
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800/80 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Assign</p>
              <h3 className="text-2xl font-black mt-1 text-yellow-400" id="stat-pending">{stats.pending}</h3>
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800/80 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress</p>
              <h3 className="text-2xl font-black mt-1 text-blue-400" id="stat-progress">{stats.in_progress}</h3>
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800/80 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resolved</p>
              <h3 className="text-2xl font-black mt-1 text-emerald-400" id="stat-resolved">{stats.resolved}</h3>
            </div>
          </div>
        </section>

        {/* Loading state indicator */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 text-slate-500 gap-3 border border-slate-900 rounded-2xl bg-slate-900/10">
            <Loader className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest">Loading Analytics...</span>
          </div>
        ) : (
          renderDashboardByRole()
        )}

      </main>
    </div>
  );
};

export default Dashboard;
