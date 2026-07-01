import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Chart, registerables } from 'chart.js';
import { Inbox, Cpu, BarChart3, PieChart, ShieldAlert, CheckCircle2, AlertTriangle, Loader, Zap, Award, Building2, UserPlus, PlusCircle, UserMinus, Trash2, FolderSync, X, Clock, Send, FileSearch, Bell, FileDown, ShieldCheck, Database, Lock, Unlock, ChevronDown, ChevronUp, RefreshCw, Link, Link2Off, MessageSquare } from 'lucide-react';
import ProofRequestsView from './ProofRequestsView';
import ClarificationModal from './ClarificationModal';

Chart.register(...registerables);

const SupervisorDashboard = ({ tickets, departments, onRefresh, getPriorityBadge, getStatusBadge, getDepartmentName, view = 'overview' }) => {
  const [telemetry, setTelemetry] = useState(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);
  const [selectedClarificationTicket, setSelectedClarificationTicket] = useState(null);
  
  // CSAT state & refs
  const [csatMetrics, setCsatMetrics] = useState([]);
  const [loadingCsat, setLoadingCsat] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const csatChartRef = useRef(null);
  const csatChartInst = useRef(null);

  const handleDownloadPdf = async () => {
    setExportingPdf(true);
    try {
      const response = await api.get('/telemetry/export-pdf', {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'egov_grievance_summary.pdf';
      link.click();
    } catch (err) {
      console.error(err);
      alert('Failed to download PDF summary report.');
    } finally {
      setExportingPdf(false);
    }
  };

  const fetchCsatMetrics = async () => {
    try {
      const response = await api.get('/telemetry/csat');
      setCsatMetrics(response.data);
    } catch (err) {
      console.error("Failed to load CSAT metrics:", err);
    } finally {
      setLoadingCsat(false);
    }
  };

  // Department creation form state
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [creatingDept, setCreatingDept] = useState(false);
  const [deptError, setDeptError] = useState('');
  const [deptSuccess, setDeptSuccess] = useState('');

  // Department Personnel dual-pane state
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // New Employee Modal state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeEmail, setNewEmployeeEmail] = useState('');
  const [newEmployeePassword, setNewEmployeePassword] = useState('');
  const [newEmployeeIdOrPassport, setNewEmployeeIdOrPassport] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [employeeError, setEmployeeError] = useState('');
  const [employeeSuccess, setEmployeeSuccess] = useState('');

  // Transfer Modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [transferTargetDeptId, setTransferTargetDeptId] = useState('');
  const [transferError, setTransferError] = useState('');

  // SLA Violations state
  const [slaViolations, setSlaViolations] = useState([]);
  const [loadingSla, setLoadingSla] = useState(true);

  // Approvals Queue state
  const [pendingChanges, setPendingChanges] = useState([]);
  const [loadingChanges, setLoadingChanges] = useState(false);

  // Compliance Audit Log state
  const [auditLog, setAuditLog] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(true);

  // Cryptographic System Audit Ledger states
  const [systemAuditLogs, setSystemAuditLogs] = useState([]);
  const [loadingSystemAudit, setLoadingSystemAudit] = useState(true);
  const [verifyingChain, setVerifyingChain] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [tamperingRow, setTamperingRow] = useState(false);
  const [collapsedLogs, setCollapsedLogs] = useState({});

  // Live Chat Center states
  const [chatSessions, setChatSessions] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeChatSession, setActiveChatSession] = useState(null);
  const [adminChatInput, setAdminChatInput] = useState('');
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateTitle, setEscalateTitle] = useState('');
  const [escalateDeptId, setEscalateDeptId] = useState('');

  const fetchChatSessions = async () => {
    try {
      const res = await api.get('/chat/admin/sessions');
      setChatSessions(res.data);
      if (activeChatSession) {
        const updated = res.data.find(s => s.id === activeChatSession.id);
        if (updated) {
          setActiveChatSession(updated);
        }
      }
    } catch (err) {
      console.error("Failed to fetch admin chat sessions:", err);
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    fetchChatSessions();
    const interval = setInterval(fetchChatSessions, 4000);
    return () => clearInterval(interval);
  }, [activeChatSession]);

  const handleSendAdminMessage = async (e) => {
    e.preventDefault();
    if (!adminChatInput.trim() || !activeChatSession) return;
    const text = adminChatInput;
    setAdminChatInput('');
    try {
      await api.post(`/chat/admin/sessions/${activeChatSession.id}/message`, { message: text });
      fetchChatSessions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignChatToDept = async (sessionId, deptId) => {
    if (!deptId) return;
    try {
      await api.post(`/chat/admin/sessions/${sessionId}/assign`, { department_id: parseInt(deptId) });
      fetchChatSessions();
      alert("Chat successfully assigned to department.");
    } catch (err) {
      console.error(err);
      alert("Failed to assign chat.");
    }
  };

  const handleEscalateChatToTicket = async (e) => {
    e.preventDefault();
    if (!activeChatSession || !escalateDeptId) return;
    try {
      const res = await api.post(`/chat/admin/sessions/${activeChatSession.id}/escalate`, {
        department_id: parseInt(escalateDeptId),
        title: escalateTitle || `Escalated Case: ${activeChatSession.citizen_name}`
      });
      setEscalateModalOpen(false);
      setEscalateTitle('');
      setEscalateDeptId('');
      fetchChatSessions();
      onRefresh(); // Refresh tickets list on main dashboard
      alert(`Formal Ticket #${res.data.id} opened successfully!`);
    } catch (err) {
      console.error(err);
      alert("Failed to escalate chat to ticket.");
    }
  };

  const fetchPendingChanges = async () => {
    setLoadingChanges(true);
    try {
      const res = await api.get('/departments/role-changes/pending');
      setPendingChanges(res.data);
    } catch (err) {
      console.error("Failed to load pending role changes:", err);
    } finally {
      setLoadingChanges(false);
    }
  };

  const handleApproveChange = async (changeId) => {
    try {
      await api.post(`/departments/role-changes/${changeId}/approve`);
      alert('Role change approved successfully!');
      fetchPendingChanges();
      if (selectedDeptId) fetchEmployees(selectedDeptId);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve role change.');
    }
  };

  const handleRejectChange = async (changeId) => {
    try {
      await api.post(`/departments/role-changes/${changeId}/reject`);
      alert('Role change rejected.');
      fetchPendingChanges();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject role change.');
    }
  };

  const handleRoleChange = async (employeeId, newRole) => {
    if (!newRole) return;
    try {
      const res = await api.put(`/departments/employees/${employeeId}/role`, {
        dept_role: newRole
      });
      alert(res.data.detail || 'Role change processed successfully!');
      fetchPendingChanges();
      fetchEmployees(selectedDeptId);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update employee role.');
    }
  };

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

  const fetchEmployees = async (deptId) => {
    if (!deptId) return;
    setLoadingEmployees(true);
    try {
      const response = await api.get(`/departments/${deptId}/employees`);
      setEmployees(response.data);
    } catch (err) {
      console.error("Failed to load department employees:", err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    if (departments && departments.length > 0 && !selectedDeptId) {
      setSelectedDeptId(departments[0].id);
    }
  }, [departments]);

  useEffect(() => {
    if (selectedDeptId) {
      fetchEmployees(selectedDeptId);
    }
  }, [selectedDeptId]);

  const handleToggleSuspend = async (employee) => {
    try {
      const endpoint = employee.status === 'suspended' ? 'activate' : 'suspend';
      await api.post(`/departments/employees/${employee.id}/${endpoint}`);
      fetchEmployees(selectedDeptId);
    } catch (err) {
      console.error("Failed to toggle suspension:", err);
      alert(err.response?.data?.detail || "Failed to update employee status.");
    }
  };

  const handleRemoveEmployee = async (employeeId) => {
    if (!window.confirm("Are you sure you want to remove this employee account?")) return;
    try {
      await api.delete(`/departments/employees/${employeeId}`);
      fetchEmployees(selectedDeptId);
    } catch (err) {
      console.error("Failed to delete employee:", err);
      alert(err.response?.data?.detail || "Failed to delete employee.");
    }
  };

  const handleTransferEmployee = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !transferTargetDeptId) return;
    setTransferError('');
    try {
      await api.post(`/departments/employees/${selectedEmployee.id}/transfer`, {
        department_id: parseInt(transferTargetDeptId)
      });
      setIsTransferModalOpen(false);
      setSelectedEmployee(null);
      setTransferTargetDeptId('');
      fetchEmployees(selectedDeptId);
    } catch (err) {
      console.error("Failed to transfer employee:", err);
      setTransferError(err.response?.data?.detail || "Failed to transfer employee.");
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!newEmployeeName.trim() || !newEmployeeEmail.trim() || !newEmployeePassword.trim() || !newEmployeeIdOrPassport.trim()) {
      setEmployeeError("All fields are required.");
      return;
    }
    setEmployeeError('');
    setEmployeeSuccess('');
    try {
      await api.post('/auth/provision', {
        name: newEmployeeName,
        email: newEmployeeEmail,
        password: newEmployeePassword,
        role: 'dept_admin',
        department_id: selectedDeptId,
        employee_id_or_passport: newEmployeeIdOrPassport,
        status: 'active',
        dept_role: newEmployeeRole || null
      });
      setEmployeeSuccess(`Employee "${newEmployeeName}" added successfully!`);
      setNewEmployeeName('');
      setNewEmployeeEmail('');
      setNewEmployeePassword('');
      setNewEmployeeIdOrPassport('');
      setNewEmployeeRole('');
      fetchEmployees(selectedDeptId);
      setTimeout(() => {
        setIsEmployeeModalOpen(false);
        setEmployeeSuccess('');
      }, 1500);
    } catch (err) {
      console.error(err);
      setEmployeeError(err.response?.data?.detail || 'Failed to add employee.');
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

  const fetchAuditLog = async () => {
    setLoadingAudit(true);
    try {
      const res = await api.get('/tickets/notifications?category=compliance_audit');
      setAuditLog(res.data);
    } catch (err) {
      console.error('Failed to load compliance audit log:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const fetchSystemAuditLogs = async () => {
    setLoadingSystemAudit(true);
    try {
      const res = await api.get('/audit');
      setSystemAuditLogs(res.data);
    } catch (err) {
      console.error('Failed to load system audit logs:', err);
    } finally {
      setLoadingSystemAudit(false);
    }
  };

  const handleVerifyChain = async () => {
    setVerifyingChain(true);
    setVerifyResult(null);
    try {
      const res = await api.get('/verify');
      setVerifyResult(res.data);
    } catch (err) {
      console.error("Failed to verify audit chain:", err);
      alert(err.response?.data?.detail || "Verification failed");
    } finally {
      setVerifyingChain(false);
    }
  };

  const handleSimulateTampering = async () => {
    if (!window.confirm("WARNING: This will intentionally corrupt a random row in the database SystemAuditLog table to simulate a malicious internal modification. Proceed?")) return;
    setTamperingRow(true);
    try {
      const res = await api.post('/simulate-tamper');
      alert(res.data.message || "Simulated database tampering successful!");
      fetchSystemAuditLogs();
      setTimeout(() => {
        handleVerifyChain();
      }, 500);
    } catch (err) {
      console.error("Failed to simulate tampering:", err);
      alert(err.response?.data?.detail || "Simulation failed");
    } finally {
      setTamperingRow(false);
    }
  };

  const toggleLogCollapse = (id) => {
    setCollapsedLogs(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    fetchTelemetry();
    fetchSlaViolations();
    fetchPendingChanges();
    fetchAuditLog();
    fetchSystemAuditLogs();
    fetchCsatMetrics();
  }, [tickets]);

  const fetchSlaViolations = async () => {
    try {
      const response = await api.get('/tickets/sla-violations');
      setSlaViolations(response.data);
    } catch (err) {
      console.error("Failed to load SLA violations:", err);
    } finally {
      setLoadingSla(false);
    }
  };

  const handleSendExplanationNotice = async (ticketId) => {
    if (!window.confirm('Send an official explanation notice to the defaulting department?')) return;
    try {
      await api.post(`/tickets/${ticketId}/send-explanation-notice`);
      alert('Explanation notice sent successfully.');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to send explanation notice.');
    }
  };

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

  useEffect(() => {
    if (csatMetrics.length === 0) return;
    
    if (csatChartRef.current) {
      if (csatChartInst.current) csatChartInst.current.destroy();
      
      csatChartInst.current = new Chart(csatChartRef.current, {
        type: 'bar',
        data: {
          labels: csatMetrics.map(d => d.department_name.split(' ')[0]),
          datasets: [{
            label: 'CSAT Score (%)',
            data: csatMetrics.map(d => d.csat_score),
            backgroundColor: 'rgba(59, 130, 246, 0.45)',
            borderColor: '#3b82f6',
            borderWidth: 1.5,
            borderRadius: 8,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              min: 0,
              max: 100,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#64748b', font: { size: 9 } }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#64748b', font: { size: 9 } }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    return () => {
      if (csatChartInst.current) csatChartInst.current.destroy();
    };
  }, [csatMetrics]);

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

  if (view === 'chats') {
    return (
      <div className="space-y-8">
        {/* Super Admin Live Chat Center */}
        <section className="p-6 bg-slate-900 border border-slate-800 rounded-2xl transition-all duration-300">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <h2 className="font-extrabold text-base text-slate-200">Live Support Chat Center</h2>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-auto">
              {chatSessions.length} active threads
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[480px]">
            {/* Chat Sessions Sidebar list */}
            <div className="lg:col-span-1 border border-slate-850 rounded-xl overflow-y-auto bg-slate-950/20 divide-y divide-slate-855/60 p-2 space-y-2">
              {loadingChats ? (
                <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                  <Loader className="w-4 h-4 animate-spin text-indigo-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Loading Chats...</span>
                </div>
              ) : chatSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2 text-center p-4">
                  <MessageSquare className="w-6 h-6 text-slate-655" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No active citizen chat requests</p>
                </div>
              ) : (
                chatSessions.map((session) => {
                  const isActive = activeChatSession && activeChatSession.id === session.id;
                  return (
                    <button
                      key={session.id}
                      onClick={() => setActiveChatSession(session)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 cursor-pointer border ${
                        isActive 
                          ? 'bg-indigo-950/20 border-indigo-500/50 shadow-md shadow-indigo-500/5' 
                          : 'bg-transparent border-transparent hover:bg-slate-900/40 hover:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">{session.citizen_name}</span>
                        <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                          session.status === 'unassigned' ? 'bg-rose-950/40 text-rose-400 border border-rose-900/30' :
                          session.status === 'assigned' ? 'bg-blue-950/40 text-blue-400 border border-blue-900/30' :
                          session.status === 'escalated' ? 'bg-purple-950/40 text-purple-400 border border-purple-900/30' :
                          'bg-slate-900 text-slate-400'
                        }`}>
                          {session.status}
                        </span>
                      </div>
                      {session.assigned_department_id && (
                        <p className="text-[9px] font-bold text-blue-400">
                          Routed: {getDepartmentName(session.assigned_department_id)}
                        </p>
                      )}
                      {session.associated_ticket_id && (
                        <p className="text-[9px] font-bold text-purple-400 font-mono">
                          Ticket: #T-{session.associated_ticket_id}
                        </p>
                      )}
                      <span className="text-[8px] text-slate-550 font-bold">
                        {new Date(session.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Chat transcript pane */}
            <div className="lg:col-span-2 border border-slate-850 rounded-xl overflow-hidden bg-slate-955/10 flex flex-col h-full">
              {!activeChatSession ? (
                <div className="flex-grow flex flex-col justify-center items-center gap-2 text-slate-500 text-center p-6">
                  <MessageSquare className="w-8 h-8 text-slate-700 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Select Chat Thread</h4>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
                      Answer citizen questions in real-time or route/escalate their chat session.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full justify-between">
                  {/* Top bar controls */}
                  <div className="p-3 bg-slate-900/60 border-b border-slate-850 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{activeChatSession.citizen_name}</h4>
                      <p className="text-[9px] font-semibold text-slate-505 mt-0.5">Session: {activeChatSession.session_token.slice(0, 8)}...</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Department routing dropdown */}
                      {activeChatSession.status !== 'escalated' && (
                        <div className="flex items-center gap-1 bg-slate-950 border border-slate-850 rounded-xl p-1">
                          <select
                            id={`dept-assign-${activeChatSession.id}`}
                            defaultValue={activeChatSession.assigned_department_id || ""}
                            className="bg-transparent border-none text-[10px] font-bold text-slate-400 focus:outline-none px-2"
                          >
                            <option value="">Assign Dept...</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const selectEl = document.getElementById(`dept-assign-${activeChatSession.id}`);
                              if (selectEl && selectEl.value) {
                                handleAssignChatToDept(activeChatSession.id, selectEl.value);
                              }
                            }}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-bold transition-all shadow-md cursor-pointer"
                          >
                            Route
                          </button>
                        </div>
                      )}

                      {/* Escalate button */}
                      {activeChatSession.status !== 'escalated' && (
                        <button
                          onClick={() => {
                            setEscalateTitle(`Escalated case from ${activeChatSession.citizen_name}`);
                            setEscalateDeptId(activeChatSession.assigned_department_id || '');
                            setEscalateModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-bold transition-all shadow-md shadow-purple-500/10 cursor-pointer flex items-center gap-1"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Escalate Ticket</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages Body */}
                  <div className="flex-grow p-4 overflow-y-auto space-y-3 bg-slate-950/20">
                    {activeChatSession.messages && activeChatSession.messages.map((msg) => {
                      const isAdmin = msg.sender_role === "admin" || msg.sender_role === "department";
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[80%] ${isAdmin ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                        >
                          <span className="text-[8px] text-slate-505 font-bold uppercase mb-1">
                            {msg.sender_name} ({msg.sender_role})
                          </span>
                          <div
                            className={`p-3 rounded-2xl text-xs leading-relaxed ${
                              isAdmin
                                ? 'bg-gradient-to-br from-indigo-600 to-purple-650 text-white rounded-tr-none'
                                : 'bg-slate-850 border border-slate-800 text-slate-200 rounded-tl-none'
                            }`}
                          >
                            {msg.message}
                          </div>
                          <span className="text-[8px] text-slate-600 mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Message input */}
                  <form onSubmit={handleSendAdminMessage} className="p-3 border-t border-slate-850 bg-slate-900/30 flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Type support reply..."
                      value={adminChatInput}
                      onChange={(e) => setAdminChatInput(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-955 border border-slate-800 rounded-xl text-slate-202 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-xs"
                    />
                    <button
                      type="submit"
                      className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center"
                    >
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Escalate Chat to Formal Ticket Modal Overlay */}
        {escalateModalOpen && activeChatSession && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-955/80 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
            <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-2xl space-y-4 relative">
              <button
                onClick={() => setEscalateModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-505 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 text-purple-400 font-bold border-b border-slate-800/60 pb-3">
                <PlusCircle className="w-5 h-5 animate-pulse" />
                <h3 className="text-base font-black">Escalate Chat to Ticket</h3>
              </div>

              <form onSubmit={handleEscalateChatToTicket} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Grievance Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Broken Water Main Line"
                    value={escalateTitle}
                    onChange={(e) => setEscalateTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-205 placeholder-slate-650 focus:outline-none focus:border-purple-500 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Assign Target Department</label>
                  <select
                    required
                    value={escalateDeptId}
                    onChange={(e) => setEscalateDeptId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-205 focus:outline-none focus:border-purple-500 text-xs font-semibold"
                  >
                    <option value="">Select Target Department...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-purple-500/10 cursor-pointer"
                >
                  Create Formal Case & Dispatch
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Role Approvals Queue */}
      {pendingChanges.length > 0 && (
        <section className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl shadow-amber-950/5 animate-pulse-slow">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h2 className="font-extrabold text-base text-slate-200">Role Approvals Queue</h2>
          </div>
          <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-950/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-950/40 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Requested Role</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-855/60 text-xs">
                {pendingChanges.map((change) => (
                  <tr key={change.id} className="hover:bg-slate-950/10">
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-200">{change.user?.name || `User ID: ${change.user_id}`}</p>
                      <p className="text-[10px] text-slate-505 font-mono">{change.user?.email}</p>
                    </td>
                    <td className="py-3 px-3 text-slate-450 font-semibold">
                      {getDepartmentName(change.user?.department_id)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-amber-950/40 text-amber-400 border border-amber-900/40">
                        {change.requested_role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApproveChange(change.id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectChange(change.id)}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-md shadow-rose-500/10 cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Compliance Audit Log */}
      <section className="p-6 bg-slate-900 border border-slate-800 rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:border-slate-700/80 active:scale-[0.99] hover:shadow-xl hover:shadow-slate-950/20">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-cyan-400" />
            <h2 className="font-extrabold text-base text-slate-200">Compliance Audit Log</h2>
          </div>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            {auditLog.length} entries
          </span>
        </div>
        {loadingAudit ? (
          <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
            <Loader className="w-4 h-4 animate-spin text-cyan-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Loading Audit Log...</span>
          </div>
        ) : auditLog.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-2 border border-dashed border-slate-800 rounded-xl">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No pending compliance events</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-950/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-950/40 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="py-2.5 px-3 w-10">
                    <Bell className="w-3.5 h-3.5 text-cyan-500" />
                  </th>
                  <th className="py-2.5 px-3">Audit Event</th>
                  <th className="py-2.5 px-3 w-20">Ticket</th>
                  <th className="py-2.5 px-3 w-36">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-855/60 text-xs">
                {auditLog.map((entry) => (
                  <tr key={entry.id} className={`transition-colors ${entry.is_read ? 'opacity-60' : 'hover:bg-cyan-950/10'}`}>
                    <td className="py-3 px-3">
                      <span className={`w-2.5 h-2.5 rounded-full block ${entry.is_read ? 'bg-slate-700' : 'bg-cyan-400 animate-pulse'}`} />
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-slate-200 font-medium leading-relaxed text-[11px]">{entry.message}</p>
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-slate-400 font-bold">
                      {entry.ticket_id ? `#T-${entry.ticket_id}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-[10px] text-slate-500 font-semibold whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cryptographic Ledger & Database Integrity Audit */}
      <section className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl transition-all duration-300 hover:scale-[1.01] hover:border-slate-700/80 active:scale-[0.99]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-850 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-xl shadow-lg shadow-cyan-500/10">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                Cryptographic Audit Ledger
                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-cyan-950/60 text-cyan-400 border border-cyan-900/30">
                  SHA-256 Chain
                </span>
              </h2>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                Mathematical blockchain-like proof of database integrity.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchSystemAuditLogs}
              disabled={loadingSystemAudit || verifyingChain || tamperingRow}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-white border border-slate-750 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh ledger logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSystemAudit ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
            <button
              onClick={handleSimulateTampering}
              disabled={loadingSystemAudit || verifyingChain || tamperingRow}
              className="px-3.5 py-2 bg-rose-950/30 hover:bg-rose-900/30 text-rose-400 hover:text-rose-300 border border-rose-900/30 hover:border-rose-800/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Simulate database compromise by a rogue admin/DBA"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-450" />
              <span>Simulate DBA Tampering</span>
            </button>
            <button
              onClick={handleVerifyChain}
              disabled={loadingSystemAudit || verifyingChain || tamperingRow}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 flex items-center"
              title="Recalculate hash chain validation sequentially"
            >
              {verifyingChain ? (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  <span>Scanning Chain...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  <span>Verify Integrity</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Verification Alert Banner */}
        {verifyResult && (
          <div className={`p-4 rounded-2xl mb-6 border transition-all animate-fade-in ${
            verifyResult.status === "OK" 
              ? 'bg-emerald-955/20 border-emerald-900/40 text-emerald-400' 
              : 'bg-rose-955/20 border-rose-900/40 text-rose-400 border-dashed animate-pulse-slow'
          }`}>
            <div className="flex items-start gap-3">
              {verifyResult.status === "OK" ? (
                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              )}
              <div>
                <h4 className="font-extrabold text-sm uppercase tracking-wide">
                  System Integrity: {verifyResult.status === "OK" ? "VERIFIED SECURE" : "INTEGRITY BREACH DETECTED!"}
                </h4>
                <p className="text-xs mt-1 text-slate-300 leading-relaxed font-semibold">
                  {verifyResult.message}
                </p>
                {verifyResult.status === "TAMPERED" && (
                  <p className="text-[10px] text-rose-500 font-extrabold uppercase mt-1 tracking-widest font-mono">
                    Compromised Row ID: #{verifyResult.tampered_row_id} | Security Alert level: CRITICAL
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Logs Chain List */}
        {loadingSystemAudit ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2.5">
            <Loader className="w-5 h-5 animate-spin text-cyan-500" />
            <span className="text-[10px] font-black uppercase tracking-widest">Loading Cryptographic Ledger...</span>
          </div>
        ) : systemAuditLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-3 border border-dashed border-slate-800 rounded-2xl bg-slate-950/10">
            <Database className="w-8 h-8 text-slate-700" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No audit logs created yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {systemAuditLogs.map((log, index) => {
              const isTamperedRow = verifyResult && verifyResult.status === "TAMPERED" && log.id === verifyResult.tampered_row_id;
              const isBrokenChainLink = verifyResult && verifyResult.status === "TAMPERED" && log.id > verifyResult.tampered_row_id;
              const isVerifiedSecured = verifyResult && (verifyResult.status === "OK" || (verifyResult.status === "TAMPERED" && log.id < verifyResult.tampered_row_id));
              
              let prettyPayload = "";
              try {
                prettyPayload = JSON.stringify(JSON.parse(log.payload), null, 2);
              } catch {
                prettyPayload = log.payload;
              }

              const isCollapsed = collapsedLogs[log.id] !== false; // collapsed by default

              return (
                <div key={log.id}>
                  {/* Ledger Block */}
                  <div className={`p-4 bg-slate-950/30 border rounded-2xl transition-all ${
                    isTamperedRow
                      ? 'border-rose-500 shadow-lg shadow-rose-500/10 bg-rose-950/10 border-solid'
                      : isBrokenChainLink
                      ? 'border-amber-700/60 bg-slate-950/40 opacity-70 border-dashed'
                      : 'border-slate-850 hover:border-slate-800'
                  }`}>
                    {/* Block Info Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border font-mono text-xs font-black shadow-sm ${
                          isTamperedRow
                            ? 'bg-rose-950 border-rose-800 text-rose-450'
                            : isBrokenChainLink
                            ? 'bg-amber-950/60 border-amber-900/60 text-amber-500'
                            : isVerifiedSecured
                            ? 'bg-emerald-950/60 border-emerald-900/60 text-emerald-450'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}>
                          #{log.id}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-xs text-slate-200">
                            {log.action_performed}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold mt-0.5">
                            <span className="text-slate-400 font-bold">{log.user_name}</span>
                            <span>•</span>
                            <span>
                              {new Date(log.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Block Badges & Actions */}
                      <div className="flex items-center gap-2">
                        {isTamperedRow && (
                          <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md bg-rose-950/60 text-rose-400 border border-rose-900/40 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                            Tampered
                          </span>
                        )}
                        {isBrokenChainLink && (
                          <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md bg-amber-950/60 text-amber-400 border border-amber-900/40 flex items-center gap-1">
                            <Unlock className="w-2.5 h-2.5 text-amber-400" />
                            Broken Ancestor
                          </span>
                        )}
                        {isVerifiedSecured && (
                          <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-emerald-400" />
                            Verified Secure
                          </span>
                        )}
                        {!verifyResult && (
                          <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md bg-slate-900/80 text-slate-400 border border-slate-800 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-slate-400" />
                            Unverified
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleLogCollapse(log.id)}
                          className="p-1 bg-slate-900 hover:bg-slate-800 text-slate-450 hover:text-slate-200 border border-slate-800 rounded-lg transition-all cursor-pointer"
                        >
                          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Payload & Hash Block */}
                    {!isCollapsed && (
                      <div className="mt-4 pt-4 border-t border-slate-900/80 space-y-3.5 text-[11px]">
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 font-sans">Block Payload Data</p>
                          <pre className="p-3 bg-slate-950 border border-slate-850 rounded-xl font-mono text-[10px] text-cyan-400 leading-relaxed overflow-x-auto select-text max-h-48 text-left whitespace-pre-wrap break-all">
                            {prettyPayload}
                          </pre>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 font-mono text-[9px] text-left">
                          <div>
                            <p className="text-[10px] text-slate-505 font-bold uppercase tracking-wider mb-1 font-sans">Previous Link Hash</p>
                            <div className="p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-450 truncate" title={log.previous_row_hash}>
                              {log.previous_row_hash}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-505 font-bold uppercase tracking-wider mb-1 font-sans">Current Block Hash</p>
                            <div className={`p-2.5 bg-slate-950 border rounded-lg truncate ${
                              isTamperedRow ? 'border-rose-900 text-rose-400' : 'border-slate-850 text-slate-450'
                            }`} title={log.current_row_hash}>
                              {log.current_row_hash}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Visual Chain Connector */}
                  {index < systemAuditLogs.length - 1 && (
                    <div className="h-8 flex items-center justify-center relative my-0.5">
                      <div className={`w-0.5 h-full ${
                        isTamperedRow || (verifyResult && verifyResult.status === "TAMPERED" && log.id >= verifyResult.tampered_row_id && systemAuditLogs[index+1].id >= verifyResult.tampered_row_id)
                          ? 'bg-gradient-to-b from-rose-500 to-amber-700 border-dashed border-l border-rose-500/40'
                          : isVerifiedSecured && (verifyResult && (verifyResult.status === "OK" || systemAuditLogs[index+1].id < verifyResult.tampered_row_id))
                          ? 'bg-emerald-500'
                          : 'bg-slate-800'
                      }`} />
                      <div className={`absolute p-1 border rounded-md shadow-sm flex items-center justify-center bg-slate-900 ${
                        isTamperedRow || (verifyResult && verifyResult.status === "TAMPERED" && log.id >= verifyResult.tampered_row_id && systemAuditLogs[index+1].id >= verifyResult.tampered_row_id)
                          ? 'border-rose-900/60 text-rose-450'
                          : isVerifiedSecured && (verifyResult && (verifyResult.status === "OK" || systemAuditLogs[index+1].id < verifyResult.tampered_row_id))
                          ? 'border-emerald-900/60 text-emerald-450'
                          : 'border-slate-850 text-slate-500'
                      }`}>
                        {isTamperedRow || (verifyResult && verifyResult.status === "TAMPERED" && log.id >= verifyResult.tampered_row_id && systemAuditLogs[index+1].id >= verifyResult.tampered_row_id) ? (
                          <Link2Off className="w-3.5 h-3.5 animate-pulse" />
                        ) : (
                          <Link className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Citizen Proof Requests Tracking */}
      <section className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
        <ProofRequestsView />
      </section>
      
      {/* Telemetry Dashboard Row */}
      {telemetry && (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-black bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent uppercase tracking-wider">
                Explainable AI (XAI) & Pipeline Telemetry
              </h2>
            </div>
            
            <button
              onClick={handleDownloadPdf}
              disabled={exportingPdf}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <FileDown className="w-4 h-4" />
              {exportingPdf ? 'Exporting PDF...' : 'Download Executive PDF'}
            </button>
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
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col transition-all duration-300 hover:scale-[1.01] hover:border-slate-700/80 active:scale-[0.99] hover:shadow-xl">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 block">Daily Classification Accuracy</span>
              <div className="h-56 relative flex-1">
                <canvas ref={accuracyChartRef}></canvas>
              </div>
            </div>

            {/* Ingestion Latency Graph */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col transition-all duration-300 hover:scale-[1.01] hover:border-slate-700/80 active:scale-[0.99] hover:shadow-xl">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 block">System Pipeline Latency (ms)</span>
              <div className="h-56 relative flex-1">
                <canvas ref={latencyChartRef}></canvas>
              </div>
            </div>

            {/* Confusion Matrix Stacked Distribution */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col transition-all duration-300 hover:scale-[1.01] hover:border-slate-700/80 active:scale-[0.99] hover:shadow-xl">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 block">AI Class Confusion Distribution</span>
              <div className="h-64 relative flex-1">
                <canvas ref={confusionChartRef}></canvas>
              </div>
            </div>

            {/* Citizen Satisfaction (CSAT) Breakdown */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col transition-all duration-300 hover:scale-[1.01] hover:border-slate-700/80 active:scale-[0.99] hover:shadow-xl">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 block">Citizen Satisfaction Score (CSAT) per Department</span>
              <div className="h-64 relative flex-1">
                {loadingCsat ? (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs bg-slate-900">
                    <Loader className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                    Loading CSAT ratings...
                  </div>
                ) : (
                  <canvas ref={csatChartRef}></canvas>
                )}
              </div>
            </div>

            {/* Confusion Matrix Heatmap Grid */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col transition-all duration-300 hover:scale-[1.01] hover:border-slate-700/80 active:scale-[0.99] hover:shadow-xl">
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
                  strokeDasharray={`${(statusCounts.pending / (tickets.filter(t => t.status !== 'Under Re-evaluation').length || 1)) * 100} ${100 - ((statusCounts.pending / (tickets.filter(t => t.status !== 'Under Re-evaluation').length || 1)) * 100)}`}
                  strokeDashoffset="0"
                />
                
                <circle 
                  cx="20" cy="20" r="15.915" fill="transparent" stroke="#3b82f6" strokeWidth="4"
                  strokeDasharray={`${(statusCounts.in_progress / (tickets.filter(t => t.status !== 'Under Re-evaluation').length || 1)) * 100} ${100 - ((statusCounts.in_progress / (tickets.filter(t => t.status !== 'Under Re-evaluation').length || 1)) * 100)}`}
                  strokeDashoffset={`-${(statusCounts.pending / (tickets.filter(t => t.status !== 'Under Re-evaluation').length || 1)) * 100}`}
                />

                <circle 
                  cx="20" cy="20" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="4"
                  strokeDasharray={`${(statusCounts.resolved / (tickets.filter(t => t.status !== 'Under Re-evaluation').length || 1)) * 100} ${100 - ((statusCounts.resolved / (tickets.filter(t => t.status !== 'Under Re-evaluation').length || 1)) * 100)}`}
                  strokeDashoffset={`-${((statusCounts.pending + statusCounts.in_progress) / (tickets.filter(t => t.status !== 'Under Re-evaluation').length || 1)) * 100}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-slate-100">{tickets.filter(t => t.status !== 'Under Re-evaluation').length}</span>
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
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Create Custom Department Entity */}
        <div className="xl:col-span-1 p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
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

        {/* Advanced Staff Management & Access Control (Dual-Pane) */}
        <div className="xl:col-span-2 p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <h2 className="font-extrabold text-lg text-slate-200" id="supervisor-personnel-title">Department Personnel & Access</h2>
              </div>
              <span className="text-xs text-slate-500 font-semibold">Staff Management</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Panel: Active Departments */}
              <div className="md:col-span-1 space-y-2 border-r border-slate-850 pr-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 block">Select Department</p>
                <div className="space-y-1.5 overflow-y-auto max-h-80">
                  {departments.map((dept) => {
                    const isSelected = selectedDeptId === dept.id;
                    return (
                      <div
                        key={dept.id}
                        onClick={() => setSelectedDeptId(dept.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                          isSelected
                            ? 'bg-blue-950/20 border-blue-900/60 text-blue-400 font-bold'
                            : 'bg-slate-950/20 border-slate-850 text-slate-400 hover:border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-xs truncate">{dept.name}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDeptId(dept.id);
                            setIsEmployeeModalOpen(true);
                          }}
                          className="p-1.5 bg-slate-900 hover:bg-emerald-950/40 text-slate-400 hover:text-emerald-400 border border-slate-800/80 rounded-lg opacity-60 group-hover:opacity-100 transition-all"
                          title="Add New Employee to this department"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Panel: Data Table of Assigned Employees */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Assigned Employees ({employees.length})
                  </span>
                  {selectedDeptId && (
                    <button
                      onClick={() => setIsEmployeeModalOpen(true)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Add Employee
                    </button>
                  )}
                </div>

                {loadingEmployees ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
                    <Loader className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Loading Personnel...</span>
                  </div>
                ) : employees.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-600 border border-dashed border-slate-800 rounded-xl text-center p-4">
                    <UserPlus className="w-8 h-8 text-slate-755 mb-2" />
                    <p className="text-xs font-bold text-slate-400">No employees assigned</p>
                    <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">Provision a departmental admin account to manage this department's queue.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-850 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 bg-slate-950/40 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          <th className="py-2.5 px-3">Name & Email</th>
                          <th className="py-2.5 px-3">Employee ID</th>
                          <th className="py-2.5 px-3">Role</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-855/60 text-xs">
                        {employees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-950/20 employee-row">
                            <td className="py-3 px-3">
                              <p className="font-semibold text-slate-200">{emp.name}</p>
                              <p className="text-[10px] text-slate-500">{emp.email}</p>
                            </td>
                            <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                              {emp.employee_id_or_passport || 'N/A'}
                            </td>
                            <td className="py-3 px-3">
                              <select
                                value={emp.dept_role || ''}
                                onChange={(e) => handleRoleChange(emp.id, e.target.value)}
                                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                              >
                                <option value="">Select Role</option>
                                <option value="Department Head">Department Head</option>
                                <option value="Field Operator">Field Operator</option>
                                <option value="Support Rep">Support Rep</option>
                              </select>
                            </td>
                            <td className="py-3 px-3">
                              {emp.status === 'suspended' ? (
                                <span className="px-2 py-0.5 bg-rose-950/40 text-rose-400 border border-rose-900/40 text-[9px] font-extrabold uppercase rounded-full">
                                  Suspended
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-emerald-950/40 text-emerald-450 border border-emerald-900/40 text-[9px] font-extrabold uppercase rounded-full">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Suspend/Reactivate Toggle */}
                                <button
                                  onClick={() => handleToggleSuspend(emp)}
                                  className={`p-1.5 border rounded-lg transition-all ${
                                    emp.status === 'suspended'
                                      ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-450 hover:bg-emerald-900/20'
                                      : 'bg-rose-950/20 border-rose-900/30 text-rose-450 hover:bg-rose-900/20'
                                  }`}
                                  title={emp.status === 'suspended' ? 'Reactivate Login' : 'Suspend Account'}
                                >
                                  {emp.status === 'suspended' ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  ) : (
                                    <UserMinus className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                {/* Transfer Department */}
                                <button
                                  onClick={() => {
                                    setSelectedEmployee(emp);
                                    setTransferTargetDeptId(emp.department_id || '');
                                    setIsTransferModalOpen(true);
                                  }}
                                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
                                  title="Transfer Department"
                                >
                                  <FolderSync className="w-3.5 h-3.5" />
                                </button>

                                {/* Remove Account */}
                                <button
                                  onClick={() => handleRemoveEmployee(emp.id)}
                                  className="p-1.5 bg-slate-900 hover:bg-rose-950/40 border border-slate-800 text-slate-450 hover:text-rose-450 rounded-lg transition-all"
                                  title="Delete Employee"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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
          </div>
        </div>
      </section>

      {/* Add Employee Modal Overlay */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setIsEmployeeModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-950/50 hover:bg-slate-950 text-slate-400 hover:text-slate-100 rounded-lg border border-slate-850"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-450" /> Add New Employee
              </h3>
              <p className="text-xs text-slate-500">
                Provision a new Departmental Admin account for **{getDepartmentName(selectedDeptId)}**.
              </p>

              {employeeError && (
                <div className="p-3 bg-rose-950/30 border border-rose-900/50 text-rose-400 rounded-xl text-xs flex items-center gap-2 font-medium animate-pulse">
                  <ShieldAlert className="w-4 h-4" /> {employeeError}
                </div>
              )}
              {employeeSuccess && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 rounded-xl text-xs flex items-center gap-2 font-medium animate-pulse">
                  <CheckCircle2 className="w-4 h-4" /> {employeeSuccess}
                </div>
              )}

              <form onSubmit={handleAddEmployee} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    placeholder="e.g. Sabin Shrestha"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 placeholder-slate-700 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newEmployeeEmail}
                    onChange={(e) => setNewEmployeeEmail(e.target.value)}
                    placeholder="sabin@egov.gov.np"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 placeholder-slate-700 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={newEmployeePassword}
                    onChange={(e) => setNewEmployeePassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 placeholder-slate-700 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Employee ID / Passport</label>
                  <input
                    type="text"
                    required
                    value={newEmployeeIdOrPassport}
                    onChange={(e) => setNewEmployeeIdOrPassport(e.target.value)}
                    placeholder="e.g. EMP-98273"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 placeholder-slate-700 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Department Role</label>
                  <select
                    value={newEmployeeRole}
                    onChange={(e) => setNewEmployeeRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="">Select Role (Optional)</option>
                    <option value="Department Head">Department Head</option>
                    <option value="Field Operator">Field Operator</option>
                    <option value="Support Rep">Support Rep</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEmployeeModalOpen(false)}
                    className="px-4 py-2 bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-500/10"
                  >
                    Add Employee
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Department Modal Overlay */}
      {isTransferModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative">
            <button
              onClick={() => {
                setIsTransferModalOpen(false);
                setSelectedEmployee(null);
              }}
              className="absolute top-4 right-4 p-1.5 bg-slate-950/50 hover:bg-slate-950 text-slate-400 hover:text-slate-100 rounded-lg border border-slate-850"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FolderSync className="w-5 h-5 text-blue-400" /> Transfer Employee
              </h3>
              <p className="text-xs text-slate-400">
                Select target department to route employee **{selectedEmployee.name}** and immediately revoke access to previous resources.
              </p>

              {transferError && (
                <div className="p-3 bg-rose-950/30 border border-rose-900/50 text-rose-400 rounded-xl text-xs flex items-center gap-2 font-medium animate-pulse">
                  <ShieldAlert className="w-4 h-4" /> {transferError}
                </div>
              )}

              <form onSubmit={handleTransferEmployee} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Target Department</label>
                  <select
                    required
                    value={transferTargetDeptId}
                    onChange={(e) => setTransferTargetDeptId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-semibold"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTransferModalOpen(false);
                      setSelectedEmployee(null);
                    }}
                    className="px-4 py-2 bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-500/10"
                  >
                    Transfer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SLA Violations Panel */}
      <section className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-rose-400" />
            <h2 className="font-extrabold text-lg text-slate-200">SLA Violations Monitor</h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{slaViolations.length} violation(s)</span>
        </div>

        {loadingSla ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
            <Loader className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Checking SLA Status...</span>
          </div>
        ) : slaViolations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600 border border-dashed border-slate-800 rounded-xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-xs font-bold text-emerald-400">All Clear</p>
            <p className="text-[10px] text-slate-600 mt-1">No SLA violations detected. All proof deadlines met.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-850 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-850 bg-rose-950/10 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="py-2.5 px-3">Ticket ID</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Proof Requested</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-855/60 text-xs">
                {slaViolations.map((v) => (
                  <tr key={v.id} className="hover:bg-rose-950/10 transition-colors">
                    <td className="py-3 px-3 font-mono text-[10px] text-rose-400 font-bold">#T-{v.id}</td>
                    <td className="py-3 px-3 text-slate-200 font-semibold">{v.title}</td>
                    <td className="py-3 px-3 text-slate-400 font-semibold">{v.department_name || 'Unknown'}</td>
                    <td className="py-3 px-3 text-slate-500 text-[10px]">
                      {v.proof_requested_at ? new Date(v.proof_requested_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleSendExplanationNotice(v.id)}
                        className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-900/30 text-rose-400 hover:text-rose-300 rounded-lg text-[10px] font-bold tracking-wide transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send Explanation Notice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>


      {/* Reopened Cases Panel */}
      <section className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="font-extrabold text-lg text-slate-200">Reopened Cases (Clarification Required)</h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{tickets.filter(t => t.status === 'Under Re-evaluation').length} case(s)</span>
        </div>

        {tickets.filter(t => t.status === 'Under Re-evaluation').length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600 border border-dashed border-slate-800 rounded-xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-xs font-bold text-emerald-400">All Clear</p>
            <p className="text-[10px] text-slate-600 mt-1">No reopened cases currently require attention.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.filter(t => t.status === 'Under Re-evaluation').map((t) => (
              <div key={t.id} className="border border-slate-800 bg-slate-950 rounded-xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Ticket #T-{t.id}</span>
                    <h3 className="font-bold text-sm text-slate-200">{t.title}</h3>
                  </div>
                  <button 
                    onClick={() => setSelectedClarificationTicket(t)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    View & Respond
                  </button>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{t.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedClarificationTicket && (
        <ClarificationModal
          ticket={selectedClarificationTicket}
          onClose={() => setSelectedClarificationTicket(null)}
          onRefresh={onRefresh}
          currentUserRole="super_admin"
        />
      )}

    </div>
  );
};

export default SupervisorDashboard;
