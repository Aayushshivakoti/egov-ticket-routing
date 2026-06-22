import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Chart, registerables } from 'chart.js';
import { Inbox, Cpu, BarChart3, PieChart, ShieldAlert, CheckCircle2, AlertTriangle, Loader, Zap, Award, Building2, UserPlus, PlusCircle } from 'lucide-react';

Chart.register(...registerables);

const SupervisorDashboard = ({ tickets, departments, onRefresh, getPriorityBadge, getStatusBadge, getDepartmentName }) => {
  const [telemetry, setTelemetry] = useState(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);

  // Department creation form state
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [creatingDept, setCreatingDept] = useState(false);
  const [deptError, setDeptError] = useState('');
  const [deptSuccess, setDeptSuccess] = useState('');

  // Admin provisioning form state
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDeptId, setAdminDeptId] = useState('');
  const [provisioningAdmin, setProvisioningAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');

  const handleCreateDept = async (e) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    setCreatingDept(true);
    setDeptError('');
    setDeptSuccess('');
    try {
      await api.post('/departments', {
        name: deptName,
        description: deptDesc
      });
      setDeptSuccess(`Department "${deptName}" created successfully!`);
      setDeptName('');
      setDeptDesc('');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      setDeptError(err.response?.data?.detail || 'Failed to create department.');
    } finally {
      setCreatingDept(false);
    }
  };

  const handleProvisionAdmin = async (e) => {
    e.preventDefault();
    if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim() || !adminDeptId) {
      setAdminError('All fields are required.');
      return;
    }
    setProvisioningAdmin(true);
    setAdminError('');
    setAdminSuccess('');
    try {
      await api.post('/auth/provision', {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'dept_admin',
        department_id: parseInt(adminDeptId)
      });
      setAdminSuccess(`Departmental Admin "${adminName}" provisioned successfully!`);
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      setAdminDeptId('');
    } catch (err) {
      console.error(err);
      setAdminError(err.response?.data?.detail || 'Failed to provision admin account.');
    } finally {
      setProvisioningAdmin(false);
    }
  };
  
  const accuracyChartRef = useRef(null);
  const latencyChartRef = useRef(null);
  const confusionChartRef = useRef(null);

  const accuracyChartInst = useRef(null);
  const latencyChartInst = useRef(null);
  const confusionChartInst = useRef(null);

  const fetchTelemetry = async () => {
    try {
      const response = await api.get('/telemetry/metrics');
      setTelemetry(response.data);
    } catch (err) {
      console.error("Failed to load telemetry:", err);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, [tickets]);

  useEffect(() => {
    if (!telemetry) return;

    // 1. Accuracy Line Chart
    if (accuracyChartRef.current) {
      if (accuracyChartInst.current) accuracyChartInst.current.destroy();
      accuracyChartInst.current = new Chart(accuracyChartRef.current, {
        type: 'line',
        data: {
          labels: telemetry.daily_accuracy.map(x => x.date),
          datasets: [{
            label: 'Accuracy (%)',
            data: telemetry.daily_accuracy.map(x => x.accuracy),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#10b981'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 100, grid: { color: '#0f172a' }, ticks: { color: '#64748b' } },
            x: { grid: { color: '#0f172a' }, ticks: { color: '#64748b' } }
          }
        }
      });
    }

    // 2. Latency Bar Chart
    if (latencyChartRef.current) {
      if (latencyChartInst.current) latencyChartInst.current.destroy();
      latencyChartInst.current = new Chart(latencyChartRef.current, {
        type: 'bar',
        data: {
          labels: telemetry.latency_metrics.map(x => x.ticket_id),
          datasets: [{
            label: 'Latency (ms)',
            data: telemetry.latency_metrics.map(x => x.latency_ms),
            backgroundColor: '#3b82f6',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: '#0f172a' }, ticks: { color: '#64748b' } },
            x: { grid: { color: '#0f172a' }, ticks: { color: '#64748b' } }
          }
        }
      });
    }

    // 3. Confusion Matrix Stacked Bar
    if (confusionChartRef.current) {
      if (confusionChartInst.current) confusionChartInst.current.destroy();
      const colors = ['#3b82f6', '#10b981', '#facc15', '#ec4899', '#8b5cf6'];
      const datasets = telemetry.departments.map((dept, idx) => ({
        label: `Pred: ${dept}`,
        data: telemetry.confusion_matrix.map(row => row[idx]),
        backgroundColor: colors[idx % colors.length],
        stack: 'Stack 0'
      }));

      confusionChartInst.current = new Chart(confusionChartRef.current, {
        type: 'bar',
        data: {
          labels: telemetry.departments.map(d => d.split(' ')[0]), // short names
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#64748b', boxWidth: 8, font: { size: 9 } } }
          },
          scales: {
            y: { stacked: true, grid: { color: '#0f172a' }, ticks: { color: '#64748b' } },
            x: { stacked: true, grid: { color: '#0f172a' }, ticks: { color: '#64748b' } }
          }
        }
      });
    }

    return () => {
      if (accuracyChartInst.current) accuracyChartInst.current.destroy();
      if (latencyChartInst.current) latencyChartInst.current.destroy();
      if (confusionChartInst.current) confusionChartInst.current.destroy();
    };
  }, [telemetry]);

  // Calculate standard stats counts
  const getDeptCounts = () => {
    const counts = {};
    departments.forEach(d => { counts[d.name] = 0; });
    tickets.forEach(t => {
      const name = getDepartmentName(t.assigned_department_id);
      if (name in counts) counts[name] += 1;
      else counts[name] = (counts[name] || 0) + 1;
    });
    return counts;
  };

  const getStatusCounts = () => {
    const counts = { pending: 0, in_progress: 0, resolved: 0 };
    tickets.forEach(t => {
      if (t.status in counts) counts[t.status] += 1;
    });
    return counts;
  };

  const deptCounts = getDeptCounts();
  const statusCounts = getStatusCounts();
  const maxDeptVal = Math.max(...Object.values(deptCounts), 1);

  const handleDepartmentOverride = async (ticketId, newDeptId) => {
    try {
      await api.patch(`/tickets/${ticketId}`, {
        assigned_department_id: newDeptId ? parseInt(newDeptId) : null,
        ai_confidence: 1.0
      });
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to override department assignment");
    }
  };

  const handleStatusOverride = async (ticketId, newStatus) => {
    try {
      await api.patch(`/tickets/${ticketId}`, {
        status: newStatus
      });
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Telemetry Dashboard Row */}
      {telemetry && (
        <section className="space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
            <Cpu className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-black bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent uppercase tracking-wider">
              Explainable AI (XAI) & Pipeline Telemetry
            </h2>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-gradient-to-br from-slate-900 to-purple-950/10 border border-purple-900/20 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-purple-950/50 border border-purple-800/30 rounded-xl text-purple-400">
                <Award className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Overall Model Accuracy</p>
                <h4 className="text-2xl font-black text-slate-200 mt-0.5">{telemetry.overall_accuracy}%</h4>
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-slate-900 to-blue-950/10 border border-blue-900/20 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-blue-950/50 border border-blue-800/30 rounded-xl text-blue-400">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Average Ingestion Latency</p>
                <h4 className="text-2xl font-black text-slate-200 mt-0.5">{telemetry.average_latency_ms} ms</h4>
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-slate-900 to-emerald-950/10 border border-emerald-900/20 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-emerald-950/50 border border-emerald-800/30 rounded-xl text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">WebSocket Routing Feed</p>
                <h4 className="text-xs font-bold text-emerald-400 mt-1 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                  Live Sync Connected
                </h4>
              </div>
            </div>
          </div>

          {/* Interactive Chart Canvases */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accuracy Graph */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 block">Daily Classification Accuracy</span>
              <div className="h-56 relative flex-1">
                <canvas ref={accuracyChartRef}></canvas>
              </div>
            </div>

            {/* Ingestion Latency Graph */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 block">System Pipeline Latency (ms)</span>
              <div className="h-56 relative flex-1">
                <canvas ref={latencyChartRef}></canvas>
              </div>
            </div>

            {/* Confusion Matrix Stacked Distribution */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 block">AI Class Confusion Distribution</span>
              <div className="h-64 relative flex-1">
                <canvas ref={confusionChartRef}></canvas>
              </div>
            </div>

            {/* Confusion Matrix Heatmap Grid */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Interactive Confusion Matrix Heatmap</span>
              <span className="text-[10px] text-slate-500 font-semibold mb-4">True class (Rows) vs. AI Predicted class (Columns)</span>
              <div className="overflow-x-auto flex-1">
                <div className="min-w-[480px]">
                  
                  {/* Heatmap Layout */}
                  <div className="grid grid-cols-6 gap-1.5 text-center font-semibold text-xs">
                    <div></div>
                    {telemetry.departments.map(d => (
                      <div key={d} className="text-[9px] text-slate-500 font-bold uppercase tracking-wider py-1 truncate" title={d}>
                        {d.split(' ')[0]}
                      </div>
                    ))}

                    {telemetry.departments.map((trueDept, rowIdx) => (
                      <React.Fragment key={trueDept}>
                        <div className="text-left text-[9px] font-bold text-slate-400 self-center pr-2 truncate" title={trueDept}>
                          {trueDept}
                        </div>
                        {telemetry.confusion_matrix[rowIdx].map((val, colIdx) => {
                          const rowSum = telemetry.confusion_matrix[rowIdx].reduce((a, b) => a + b, 0) || 1;
                          const isDiagonal = rowIdx === colIdx;
                          let bgClass = "bg-slate-950/40 border-slate-900 text-slate-600";
                          if (val > 0) {
                            if (isDiagonal) {
                              bgClass = "bg-emerald-950/45 text-emerald-400 border-emerald-800/40 font-black shadow-inner shadow-emerald-950";
                            } else {
                              bgClass = "bg-rose-950/45 text-rose-400 border-rose-800/40 font-bold";
                            }
                          }
                          return (
                            <div 
                              key={colIdx} 
                              className={`p-2.5 border rounded-xl flex items-center justify-center text-xs transition-all hover:scale-[1.04] ${bgClass}`}
                              title={`True: ${trueDept}, Predicted: ${telemetry.departments[colIdx]} = ${val}`}
                            >
                              {val}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}

                  </div>

                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Analytics Charts Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Department Distribution */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h3 className="font-extrabold text-base text-slate-200">Grievance Loads per Department</h3>
          </div>

          <div className="space-y-4">
            {Object.entries(deptCounts).map(([name, count]) => {
              const percentage = (count / maxDeptVal) * 100;
              return (
                <div key={name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">{name}</span>
                    <span className="font-mono text-slate-400 font-bold">{count} cases</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-base text-slate-200">Incident Resolution Metrics</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            <div className="flex justify-center relative">
              <svg width="140" height="140" viewBox="0 0 40 40" className="transform -rotate-90">
                <circle cx="20" cy="20" r="15.915" fill="transparent" stroke="#0f172a" strokeWidth="4" />
                
                <circle 
                  cx="20" cy="20" r="15.915" fill="transparent" stroke="#facc15" strokeWidth="4"
                  strokeDasharray={`${(statusCounts.pending / (tickets.length || 1)) * 100} ${100 - ((statusCounts.pending / (tickets.length || 1)) * 100)}`}
                  strokeDashoffset="0"
                />
                
                <circle 
                  cx="20" cy="20" r="15.915" fill="transparent" stroke="#3b82f6" strokeWidth="4"
                  strokeDasharray={`${(statusCounts.in_progress / (tickets.length || 1)) * 100} ${100 - ((statusCounts.in_progress / (tickets.length || 1)) * 100)}`}
                  strokeDashoffset={`-${(statusCounts.pending / (tickets.length || 1)) * 100}`}
                />

                <circle 
                  cx="20" cy="20" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="4"
                  strokeDasharray={`${(statusCounts.resolved / (tickets.length || 1)) * 100} ${100 - ((statusCounts.resolved / (tickets.length || 1)) * 100)}`}
                  strokeDashoffset={`-${((statusCounts.pending + statusCounts.in_progress) / (tickets.length || 1)) * 100}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-slate-100">{tickets.length}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Total</span>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-400 rounded-full" />
                <div>
                  <p className="text-xs font-semibold text-slate-300">Pending</p>
                  <p className="text-[10px] text-slate-500 font-mono font-bold">{statusCounts.pending} ({((statusCounts.pending / (tickets.length || 1)) * 100).toFixed(0)}%)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <div>
                  <p className="text-xs font-semibold text-slate-300">In Progress</p>
                  <p className="text-[10px] text-slate-500 font-mono font-bold">{statusCounts.in_progress} ({((statusCounts.in_progress / (tickets.length || 1)) * 100).toFixed(0)}%)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                <div>
                  <p className="text-xs font-semibold text-slate-300">Resolved</p>
                  <p className="text-[10px] text-slate-500 font-mono font-bold">{statusCounts.resolved} ({((statusCounts.resolved / (tickets.length || 1)) * 100).toFixed(0)}%)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* Entity Administration and Provisioning Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create Custom Department Entity */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              <h2 className="font-extrabold text-lg text-slate-200" id="supervisor-dept-title">Create Custom Department</h2>
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              Register new municipal or administrative departments to expand routing destinations for civic complaints.
            </p>
            {deptError && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 text-rose-300 rounded-xl text-xs flex items-center gap-2 font-medium animate-pulse">
                <ShieldAlert className="w-4 h-4 text-rose-450" />
                {deptError}
              </div>
            )}
            {deptSuccess && (
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 rounded-xl text-xs flex items-center gap-2 font-medium animate-pulse">
                <CheckCircle2 className="w-4 h-4 text-emerald-450" />
                {deptSuccess}
              </div>
            )}
            <form onSubmit={handleCreateDept} className="space-y-3 pt-2" id="create-dept-form">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" htmlFor="dept-name">Department Name</label>
                <input
                  id="dept-name"
                  type="text"
                  placeholder="e.g. Telecommunication Systems"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all text-xs font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" htmlFor="dept-desc">Description</label>
                <textarea
                  id="dept-desc"
                  placeholder="Summarize the core duties of this department..."
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all text-xs h-20 resize-none font-medium"
                />
              </div>
              <button
                id="create-dept-btn"
                type="submit"
                disabled={creatingDept}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                {creatingDept ? 'Creating...' : 'Create Department'}
              </button>
            </form>
          </div>
        </div>

        {/* Provision Departmental Admin Accounts */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <h2 className="font-extrabold text-lg text-slate-200" id="supervisor-admin-title">Provision Dept Admin</h2>
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              Register and link new departmental administrative accounts to manage and resolve complaints for designated departments.
            </p>
            {adminError && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 text-rose-300 rounded-xl text-xs flex items-center gap-2 font-medium animate-pulse">
                <ShieldAlert className="w-4 h-4 text-rose-450" />
                {adminError}
              </div>
            )}
            {adminSuccess && (
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 rounded-xl text-xs flex items-center gap-2 font-medium animate-pulse">
                <CheckCircle2 className="w-4 h-4 text-emerald-450" />
                {adminSuccess}
              </div>
            )}
            <form onSubmit={handleProvisionAdmin} className="space-y-3 pt-2" id="provision-admin-form">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" htmlFor="admin-name">Full Name</label>
                  <input
                    id="admin-name"
                    type="text"
                    placeholder="e.g. Ramesh Karki"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all text-xs font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" htmlFor="admin-email">Email Address</label>
                  <input
                    id="admin-email"
                    type="email"
                    placeholder="ramesh@egov.gov.np"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all text-xs font-medium"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" htmlFor="admin-password">Password</label>
                  <input
                    id="admin-password"
                    type="password"
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all text-xs font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" htmlFor="admin-dept">Assigned Dept</label>
                  <select
                    id="admin-dept"
                    value={adminDeptId}
                    onChange={(e) => setAdminDeptId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500 transition-all text-xs font-semibold"
                    required
                  >
                    <option value="">Select Dept...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                id="provision-admin-btn"
                type="submit"
                disabled={provisioningAdmin}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/10 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                {provisioningAdmin ? 'Provisioning...' : 'Provision Admin'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Global tickets table */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-400" />
            <h2 className="font-extrabold text-lg text-slate-200" id="supervisor-table-title">System-Wide Grievance Logs</h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{tickets.length} records</span>
        </div>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-4 border border-dashed border-slate-800 rounded-xl">
            <p className="text-sm font-bold text-slate-400">No tickets found</p>
            <p className="text-xs text-slate-600">The central database contains no public grievances at this time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" aria-labelledby="supervisor-table-title">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950/20">
                  <th className="py-4 px-4 w-16">ID</th>
                  <th className="py-4 px-4">Subject</th>
                  <th className="py-4 px-4">Priority</th>
                  <th className="py-4 px-4">Routing Info & Override</th>
                  <th className="py-4 px-4">Status & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-900/60 transition-colors supervisor-ticket-row">
                    <td className="py-4 px-4 font-mono font-bold text-xs text-slate-400">
                      #T-{ticket.id}
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <p className="font-bold text-slate-200">{ticket.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                      {ticket.reasoning_keywords && ticket.reasoning_keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                          <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Cpu className="w-3.5 h-3.5 text-purple-400" /> AI Reasoning:
                          </span>
                          {ticket.reasoning_keywords.map((k) => (
                            <span key={k} className="px-1.5 py-0.5 bg-purple-950/40 text-purple-400 border border-purple-900/30 rounded text-[9px] font-mono font-bold">
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
                      {ticket.remarks && (
                        <p className="text-[10px] text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 p-1.5 rounded-lg mt-1.5 font-medium leading-normal">
                          Remarks: {ticket.remarks}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {getPriorityBadge(ticket.priority)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1.5">
                        <select
                          id={`dept-override-${ticket.id}`}
                          value={ticket.assigned_department_id || ''}
                          onChange={(e) => handleDepartmentOverride(ticket.id, e.target.value)}
                          className="px-2.5 py-1 bg-slate-950 border border-slate-850 hover:border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-all font-semibold"
                        >
                          <option value="">Unassigned</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        {ticket.ai_confidence !== null && (
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                            AI Confidence: {(ticket.ai_confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(ticket.status)}
                        <select
                          id={`status-override-${ticket.id}`}
                          value={ticket.status}
                          onChange={(e) => handleStatusOverride(ticket.id, e.target.value)}
                          className="px-2.5 py-1 bg-slate-950 border border-slate-850 hover:border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-all font-semibold"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupervisorDashboard;
