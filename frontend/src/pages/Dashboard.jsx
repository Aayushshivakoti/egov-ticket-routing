import React, { useState, useEffect } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import CitizenDashboard from '../components/CitizenDashboard';
import DeptAdminDashboard from '../components/DeptAdminDashboard';
import SupervisorDashboard from '../components/SupervisorDashboard';
import ReportTableView from '../components/ReportTableView';
import ProofRequestsView from '../components/ProofRequestsView';
import { LogOut, Cpu, User, Loader } from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { status } = useParams();
  const [tickets, setTickets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stats summary for the cards
  const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, resolved: 0 });

  const calculateStats = (ticketList) => {
    const s = { total: ticketList.length, pending: 0, in_progress: 0, resolved: 0 };
    ticketList.forEach(t => {
      if (t.status === 'pending') s.pending += 1;
      else if (t.status === 'in_progress') s.in_progress += 1;
      else if (t.status === 'resolved') s.resolved += 1;
    });
    setStats(s);
  };

  const getApiStatusParams = () => {
    if (!status || status === 'total') return '';
    if (status === 'pending') return '?status=pending';
    if (status === 'in-progress') return '?status=in_progress';
    if (status === 'resolved') return '?status=resolved';
    return '';
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const statusQuery = getApiStatusParams();
      const [filteredTicketsRes, deptsResponse, allTicketsRes] = await Promise.all([
        api.get(`/tickets${statusQuery}`),
        api.get('/departments'),
        api.get('/tickets')
      ]);

      setTickets(filteredTicketsRes.data);
      setDepartments(deptsResponse.data);
      calculateStats(allTicketsRes.data);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataSilent = async () => {
    try {
      const statusQuery = getApiStatusParams();
      const [filteredTicketsRes, deptsResponse, allTicketsRes] = await Promise.all([
        api.get(`/tickets${statusQuery}`),
        api.get('/departments'),
        api.get('/tickets')
      ]);

      setTickets(filteredTicketsRes.data);
      setDepartments(deptsResponse.data);
      calculateStats(allTicketsRes.data);
    } catch (err) {
      console.error("Failed to silently load updates:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, status]);

  useEffect(() => {
    if (!user) return;
    
    // Connect to WebSocket updates server
    const wsUrl = `ws://${window.location.hostname}:8000/api/ws`;
    console.log("Connecting to WebSocket updates channel:", wsUrl);
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log("WebSocket connection established.");
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket update message received:", data);
        if (data.event === "ticket_updated") {
          console.log(`Ticket ID ${data.ticket_id} updated. Initiating background refresh...`);
          fetchDataSilent();
        }
      } catch (err) {
        console.warn("WebSocket raw message received:", event.data);
      }
    };
    
    socket.onclose = () => {
      console.log("WebSocket connection closed.");
    };
    
    return () => {
      socket.close();
    };
  }, [user]);



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
      processing: 'bg-purple-950/40 text-purple-400 border border-purple-800/50',
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
          statusFilter={status}
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
          statusFilter={status}
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

        {/* Global Summary Stats Card Grid as Navigation Tabs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <NavLink 
            to="/admin/reports/total" 
            className={({ isActive }) => `p-5 border rounded-2xl flex items-center justify-between transition-colors ${isActive ? 'bg-slate-800 border-indigo-500 shadow-lg shadow-indigo-900/20' : 'bg-slate-900 border-slate-800/80 hover:bg-slate-800/50'}`}
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Reports</p>
              <h3 className="text-2xl font-black mt-1 text-slate-200" id="stat-total">{stats.total}</h3>
            </div>
          </NavLink>

          <NavLink 
            to="/admin/reports/pending" 
            className={({ isActive }) => `p-5 border rounded-2xl flex items-center justify-between transition-colors ${isActive ? 'bg-slate-800 border-yellow-500 shadow-lg shadow-yellow-900/20' : 'bg-slate-900 border-slate-800/80 hover:bg-slate-800/50'}`}
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Assign</p>
              <h3 className="text-2xl font-black mt-1 text-yellow-400" id="stat-pending">{stats.pending}</h3>
            </div>
          </NavLink>

          <NavLink 
            to="/admin/reports/in-progress" 
            className={({ isActive }) => `p-5 border rounded-2xl flex items-center justify-between transition-colors ${isActive ? 'bg-slate-800 border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-slate-900 border-slate-800/80 hover:bg-slate-800/50'}`}
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress</p>
              <h3 className="text-2xl font-black mt-1 text-blue-400" id="stat-progress">{stats.in_progress}</h3>
            </div>
          </NavLink>

          <NavLink 
            to="/admin/reports/resolved" 
            className={({ isActive }) => `p-5 border rounded-2xl flex items-center justify-between transition-colors ${isActive ? 'bg-slate-800 border-emerald-500 shadow-lg shadow-emerald-900/20' : 'bg-slate-900 border-slate-800/80 hover:bg-slate-800/50'}`}
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resolved</p>
              <h3 className="text-2xl font-black mt-1 text-emerald-400" id="stat-resolved">{stats.resolved}</h3>
            </div>
          </NavLink>
        </section>

        {/* Loading state indicator */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 text-slate-500 gap-3 border border-slate-900 rounded-2xl bg-slate-900/10">
            <Loader className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest">Loading Analytics...</span>
          </div>
        ) : (
          <>
            {status ? (
              <ReportTableView 
                statusFilter={status}
                tickets={tickets}
                departments={departments}
                getPriorityBadge={getPriorityBadge}
                getStatusBadge={getStatusBadge}
                getDepartmentName={getDepartmentName}
                onRefresh={fetchData}
              />
            ) : (
              renderDashboardByRole()
            )}

            {/* Citizen Proof Requests Tracking (Only when viewing specific reports) */}
            {status && user && user.role !== 'citizen' && (
              <section className="mt-8 p-6 bg-slate-900 border border-slate-800 rounded-2xl">
                <ProofRequestsView />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
