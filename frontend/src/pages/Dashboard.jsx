import React, { useState, useEffect } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import CitizenDashboard from '../components/CitizenDashboard';
import DeptAdminDashboard from '../components/DeptAdminDashboard';
import SupervisorDashboard from '../components/SupervisorDashboard';
import ReportTableView from '../components/ReportTableView';
import ProofRequestsView from '../components/ProofRequestsView';
import Sidebar from '../components/Sidebar';
import { LogOut, Cpu, User, Loader, Bell, X } from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { status } = useParams();
  const [tickets, setTickets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  // Stats summary for the cards
  const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, resolved: 0 });

  const calculateStats = (ticketList) => {
    const s = { total: ticketList.length, pending: 0, in_progress: 0, resolved: 0 };
    ticketList.forEach(t => {
      if (t.status === 'pending' || t.status === 'processing') s.pending += 1;
      else if (t.status === 'in_progress') s.in_progress += 1;
      else if (t.status === 'resolved') s.resolved += 1;
    });
    s.total = s.pending + s.in_progress + s.resolved;
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
          
          // Trigger live toast alert
          const deptName = getDepartmentName(data.assigned_department_id);
          const toastMsg = `Grievance ticket #T-${data.ticket_id} status transitioned to "${data.status.replace('_', ' ')}"${data.assigned_department_id ? ` and routed to ${deptName}` : ''}.`;
          
          const newToast = {
            id: Math.random().toString(36).substring(2, 9),
            message: toastMsg,
          };
          
          setToasts(prev => [...prev, newToast]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== newToast.id));
          }, 6000);
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

  const isChatView = window.location.pathname.endsWith('/chats');
  const isDeptsView = window.location.pathname.endsWith('/departments');

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
          view={isChatView ? 'chats' : (isDeptsView ? 'departments' : 'overview')}
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
          view={isChatView ? 'chats' : 'overview'}
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex">
      {/* Sidebar Navigation */}
      <Sidebar user={user} logout={logout} />

      {/* Main Content Workspace */}
      <div className="flex-grow flex flex-col min-h-screen overflow-x-hidden">
        {/* Dashboard Top Header */}
        <header className="border-b border-slate-900 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40 shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-end gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl" id="profile-card">
              <User className="w-4 h-4 text-slate-400" />
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-slate-300">{user?.name}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase" id="profile-role">{user?.role.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Main Workspace */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-grow w-full">
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
          {!isChatView && !isDeptsView && (
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
          )}

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

      {/* Live Toast Notifications Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className="p-4 bg-slate-900/90 border border-indigo-500/30 backdrop-blur-md rounded-2xl shadow-xl flex items-start gap-3 animate-toast-slide select-none"
          >
            <div className="p-2 bg-indigo-950/50 border border-indigo-800/40 rounded-xl text-indigo-400">
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-grow">
              <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Helpdesk Update</h5>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="p-1 hover:bg-slate-850 text-slate-500 hover:text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
