import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LogOut, Cpu, PlusCircle, Inbox, Loader, CheckCircle2, AlertTriangle, 
  Hourglass, Building2, User, FileText, ChevronRight, BarChart3, HelpCircle 
} from 'lucide-react';

const Dashboard = () => {
  const { user, token, logout, API_URL } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Citizen form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, resolved: 0 });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTickets(),
        fetchDepartments()
      ]);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_URL}/tickets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
        calculateStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_URL}/departments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
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

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!title || !description) return;
    setSubmitting(true);
    setSubmissionResult(null);

    try {
      const res = await fetch(`${API_URL}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, description, priority })
      });

      if (res.ok) {
        const newTicket = await res.json();
        // Clear fields
        setTitle('');
        setDescription('');
        setPriority('medium');
        
        // Find assigned department name
        const dept = departments.find(d => d.id === newTicket.assigned_department_id);
        setSubmissionResult({
          ...newTicket,
          dept_name: dept ? dept.name : 'Unassigned'
        });

        // Refresh ticket listing
        fetchTickets();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to submit ticket");
      }
    } catch (err) {
      console.error("Ticket submission error:", err);
      alert("Error submitting ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchTickets();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to update status");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDepartmentReassign = async (ticketId, newDeptId) => {
    try {
      const res = await fetch(`${API_URL}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ assigned_department_id: parseInt(newDeptId) })
      });
      if (res.ok) {
        fetchTickets();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to reassign department");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityBadge = (p) => {
    const styles = {
      high: 'bg-rose-950/40 text-rose-400 border border-rose-800/50',
      medium: 'bg-amber-950/40 text-amber-400 border border-amber-800/50',
      low: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50'
    };
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${styles[p] || ''}`}>
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      
      {/* Navigation Bar */}
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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl">
              <User className="w-4 h-4 text-slate-400" />
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-slate-300">{user?.name}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase">{user?.role.replace('_', ' ')}</p>
              </div>
            </div>
            
            <button 
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
        
        {/* Department Info Box for Dept Admins */}
        {user?.role === 'dept_admin' && (
          <div className="p-6 bg-gradient-to-r from-blue-950/20 to-slate-900 border border-blue-900/30 rounded-2xl flex items-start gap-4">
            <Building2 className="w-8 h-8 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-base text-blue-300">Department Administration</h3>
              <p className="text-lg font-extrabold text-slate-200 mt-0.5">{getDepartmentName(user.department_id)}</p>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">{getDepartmentDescription()}</p>
            </div>
          </div>
        )}

        {/* Analytics Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-900 border border-slate-800/80 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tickets</p>
              <h3 className="text-2xl font-black mt-1 text-slate-200">{stats.total}</h3>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Inbox className="w-5 h-5 text-blue-400" />
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800/80 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Routing</p>
              <h3 className="text-2xl font-black mt-1 text-yellow-400">{stats.pending}</h3>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Hourglass className="w-5 h-5 text-yellow-400" />
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800/80 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress</p>
              <h3 className="text-2xl font-black mt-1 text-blue-400">{stats.in_progress}</h3>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Loader className="w-5 h-5 text-blue-400 animate-spin-slow" />
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800/80 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resolved Cases</p>
              <h3 className="text-2xl font-black mt-1 text-emerald-400">{stats.resolved}</h3>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </section>

        {/* Dashboard Actions & Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Citizen Form Left Column */}
          {user?.role === 'citizen' && (
            <div className="lg:col-span-4 space-y-6">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-2 mb-6">
                  <PlusCircle className="w-5 h-5 text-emerald-400" />
                  <h2 className="font-extrabold text-lg text-slate-200">File Public Grievance</h2>
                </div>

                <form onSubmit={handleCreateTicket} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Subject / Title</label>
                    <input
                      type="text"
                      placeholder="Brief title summarizing the issue"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Description</label>
                    <textarea
                      placeholder="Provide specific details (e.g. location, severity, keywords like pipe, pothole, electricity, garbage...)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm h-32 resize-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Priority Selection</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 disabled:opacity-50"
                  >
                    {submitting ? 'Auto Routing...' : 'Dispatch Ticket'}
                  </button>
                </form>
              </div>

              {/* Dynamic Auto Routing AI Result Card */}
              {submissionResult && (
                <div className="p-6 bg-slate-900 border border-emerald-500/20 rounded-2xl relative overflow-hidden animate-fade-in shadow-xl shadow-emerald-500/5">
                  <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 px-3 py-1 font-bold text-[9px] uppercase tracking-widest rounded-bl-xl flex items-center gap-1">
                    <Cpu className="w-3 h-3 animate-pulse" />
                    AI Routed
                  </div>
                  <h3 className="font-bold text-sm text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    Routing Engine Diagnosis
                  </h3>
                  
                  <div className="space-y-3 mt-4">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Identified Department</p>
                      <p className="text-base font-extrabold text-slate-200 mt-0.5">{submissionResult.dept_name}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Confidence Level</p>
                        <p className="text-sm font-bold text-slate-300 mt-0.5">
                          {(submissionResult.ai_confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Reference ID</p>
                        <p className="text-sm font-bold text-slate-300 mt-0.5">#T-{submissionResult.id}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ticket Listing Column */}
          <div className={`${user?.role === 'citizen' ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-6`}>
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-blue-400" />
                  <h2 className="font-extrabold text-lg text-slate-200">
                    {user?.role === 'citizen' ? 'Your Submitted Grievances' : 'Assigned Cases Log'}
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-semibold">{tickets.length} records</span>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                  <Loader className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-xs font-semibold uppercase tracking-widest">Loading Records...</span>
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-4 border border-dashed border-slate-800 rounded-xl">
                  <HelpCircle className="w-10 h-10 text-slate-700" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-400">No tickets found</p>
                    <p className="text-xs text-slate-600 mt-1">There are no reports lodged in this catalog at this time.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950/20">
                        <th className="py-4 px-4 w-16">ID</th>
                        <th className="py-4 px-4">Details</th>
                        <th className="py-4 px-4">Priority</th>
                        <th className="py-4 px-4">Routing Info</th>
                        <th className="py-4 px-4">Status</th>
                        <th className="py-4 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                      {tickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-slate-900/60 transition-colors">
                          <td className="py-4 px-4 font-mono font-bold text-xs text-slate-400">
                            #T-{ticket.id}
                          </td>
                          <td className="py-4 px-4 max-w-xs sm:max-w-sm">
                            <p className="font-bold text-slate-200 truncate">{ticket.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                          </td>
                          <td className="py-4 px-4">
                            {getPriorityBadge(ticket.priority)}
                          </td>
                          <td className="py-4 px-4">
                            {user?.role === 'super_admin' ? (
                              <div className="flex flex-col gap-1.5">
                                <select
                                  value={ticket.assigned_department_id || ''}
                                  onChange={(e) => handleDepartmentReassign(ticket.id, e.target.value)}
                                  className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                                >
                                  <option value="">Unassigned</option>
                                  {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                  ))}
                                </select>
                                {ticket.ai_confidence !== null && (
                                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                                    <Cpu className="w-3 h-3 text-emerald-500" />
                                    AI Confidence: {(ticket.ai_confidence * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-300 text-xs">
                                  {getDepartmentName(ticket.assigned_department_id)}
                                </span>
                                {ticket.ai_confidence !== null && (
                                  <span className="text-[9px] text-slate-500 mt-0.5 font-semibold">
                                    Confidence: {(ticket.ai_confidence * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {getStatusBadge(ticket.status)}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {user?.role === 'dept_admin' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {ticket.status !== 'in_progress' && (
                                  <button
                                    onClick={() => handleStatusChange(ticket.id, 'in_progress')}
                                    className="px-2 py-1 bg-blue-950/50 hover:bg-blue-900/50 text-blue-400 border border-blue-900/30 rounded text-xs transition-all font-semibold"
                                  >
                                    Progress
                                  </button>
                                )}
                                {ticket.status !== 'resolved' && (
                                  <button
                                    onClick={() => handleStatusChange(ticket.id, 'resolved')}
                                    className="px-2 py-1 bg-emerald-950/50 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-900/30 rounded text-xs transition-all font-semibold"
                                  >
                                    Resolve
                                  </button>
                                )}
                              </div>
                            ) : user?.role === 'super_admin' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <select
                                  value={ticket.status}
                                  onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                                  className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="resolved">Resolved</option>
                                </select>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 italic">No action</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
};

export default Dashboard;
