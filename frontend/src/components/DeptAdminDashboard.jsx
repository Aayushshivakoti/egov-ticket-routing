import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Inbox, Eye, Cpu, X, FileText, CheckCircle2, Loader, UserPlus, Bell, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProofRequestsView from './ProofRequestsView';

const DeptAdminDashboard = ({ tickets, onRefresh, getPriorityBadge, getStatusBadge, getDepartmentName, statusFilter }) => {
  const { user } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusVal, setStatusVal] = useState('pending');
  const [remarksVal, setRemarksVal] = useState('');
  const [reportVal, setReportVal] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [updating, setUpdating] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [proofFiles, setProofFiles] = useState([]);

  // Department Head Personnel state
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Notification alerts state
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  const fetchDeptEmployees = async () => {
    if (!user?.department_id) return;
    setLoadingEmployees(true);
    try {
      const res = await api.get(`/departments/${user.department_id}/employees`);
      setEmployees(res.data);
    } catch (err) {
      console.error("Failed to load department employees:", err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    if (user?.dept_role === 'Department Head') {
      fetchDeptEmployees();
    }
    fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const res = await api.get('/tickets/notifications?category=proof_request');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleOpenModal = (ticket) => {
    setSelectedTicket(ticket);
    setStatusVal(ticket.status);
    setRemarksVal(ticket.remarks || '');
    setReportVal(ticket.report || '');
    setAssignedStaffId(ticket.assigned_employee_id || '');
    setActiveMediaIndex(0);
    setProofFiles([]);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedTicket(null);
    setProofFiles([]);
    setReportVal('');
    setAssignedStaffId('');
    setModalOpen(false);
  };

  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    if (statusVal === 'resolved') {
      if (!reportVal.trim()) {
        alert("A text resolution report is mandatory when status is set to Resolved.");
        return;
      }
      if (proofFiles.length === 0) {
        alert("Resolution proof is mandatory when status is set to Resolved. Please upload a media file.");
        return;
      }
    }

    setUpdating(true);

    try {
      if (user?.dept_role === 'Department Head') {
        await api.post(`/tickets/${selectedTicket.id}/assign`, {
          assigned_employee_id: assignedStaffId ? parseInt(assignedStaffId) : null
        });
      }

      const formData = new FormData();
      formData.append('status', statusVal);
      formData.append('remarks', remarksVal);
      if (statusVal === 'resolved') {
        formData.append('report', reportVal);
        proofFiles.forEach((file) => {
          formData.append('files', file);
        });
      }

      await api.put(`/tickets/${selectedTicket.id}/status`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      handleCloseModal();
      onRefresh();
    } catch (err) {
      console.error("Failed to update status:", err);
      const msg = err.response?.data?.detail || "Failed to update ticket status";
      alert(msg);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Alerts for Department Head */}
      {notifications.length > 0 && (
        <section className="p-5 bg-gradient-to-r from-amber-950/20 to-slate-900 border border-amber-900/30 rounded-2xl">
          <div className="flex items-center gap-2 mb-3 border-b border-amber-900/20 pb-2">
            <Bell className="w-5 h-5 text-amber-400 animate-pulse" />
            <h2 className="font-extrabold text-sm text-amber-300 uppercase tracking-wider">Proof Request Alerts</h2>
            <span className="ml-auto px-2 py-0.5 bg-amber-600 text-white text-[9px] font-extrabold rounded-full">{notifications.filter(n => !n.is_read).length}</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {notifications.filter(n => !n.is_read).map((notif) => (
              <div key={notif.id} className="flex items-start gap-3 p-3 bg-slate-950/40 border border-amber-900/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-200 font-medium leading-relaxed">{notif.message}</p>
                  <p className="text-[9px] text-slate-500 font-semibold mt-1">
                    {new Date(notif.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {notif.ticket_id && (
                  <span className="text-[9px] font-mono font-bold text-amber-500 whitespace-nowrap">#T-{notif.ticket_id}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-400" />
            <h2 className="font-extrabold text-lg text-slate-200" id="admin-table-title">
              {statusFilter === 'pending' ? 'Pending Assignments' : 
               statusFilter === 'in-progress' ? 'In-Progress Cases' : 
               statusFilter === 'resolved' ? 'Resolved Cases' : 
               'Incoming Grievances Log'}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{tickets.length} assigned tickets</span>
        </div>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-4 border border-dashed border-slate-800 rounded-xl">
            <p className="text-sm font-bold text-slate-400">All caught up!</p>
            <p className="text-xs text-slate-600">No unresolved grievances are routed to your department at this time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" aria-labelledby="admin-table-title">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950/20">
                  <th className="py-4 px-4 w-16">ID</th>
                  <th className="py-4 px-4">Subject</th>
                  <th className="py-4 px-4">Priority</th>
                  <th className="py-4 px-4">AI Score</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-900/60 transition-colors admin-ticket-row">
                    <td className="py-4 px-4 font-mono font-bold text-xs text-slate-400">
                      #T-{ticket.id}
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-bold text-slate-200">{ticket.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                      {ticket.reasoning_keywords && ticket.reasoning_keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                          <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-purple-400" /> Routing Keywords:
                          </span>
                          {ticket.reasoning_keywords.map((k) => (
                            <span key={k} className="px-1.5 py-0.5 bg-purple-950/40 text-purple-400 border border-purple-900/30 rounded text-[9px] font-mono font-bold">
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {getPriorityBadge(ticket.priority)}
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-emerald-400">
                      {ticket.ai_confidence !== null ? `${(ticket.ai_confidence * 100).toFixed(0)}%` : 'Manual'}
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(ticket.status)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleOpenModal(ticket)}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-850 hover:bg-slate-850 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all admin-view-btn"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Resolve Case
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Details & Actionable Status Modal */}
      {modalOpen && selectedTicket && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-ticket-title"
        >
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative flex flex-col max-h-[90vh]">
            
            {/* Close Button */}
            <button 
              onClick={handleCloseModal}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
              aria-label="Close details"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="border-b border-slate-800 pb-4 mb-4 flex items-center gap-3">
              <div className="p-2 bg-blue-950/50 border border-blue-900/30 rounded-lg text-blue-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Grievance Resolution</p>
                <h3 className="font-extrabold text-base text-slate-200" id="modal-ticket-title">
                  Ticket #T-{selectedTicket.id}
                </h3>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="overflow-y-auto pr-2 space-y-5 flex-1 leading-relaxed text-sm text-slate-300">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Subject</h4>
                <p className="font-bold text-slate-100 text-base">{selectedTicket.title}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Citizen Query</h4>
                <p className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-slate-300 whitespace-pre-line">
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.reasoning_keywords && selectedTicket.reasoning_keywords.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                    Explainable AI (XAI) Routing Diagnosis
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {selectedTicket.reasoning_keywords.map((k) => (
                      <span key={k} className="px-2.5 py-1 bg-purple-950/40 text-purple-400 border border-purple-800/40 rounded-xl text-xs font-mono font-bold tracking-wide">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                <div className="border-t border-slate-800 pt-4 mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Evidence Attachments ({selectedTicket.attachments.length})
                  </h4>
                  <div className="relative bg-slate-950/60 border border-slate-850 rounded-xl overflow-hidden p-4 flex flex-col items-center justify-center min-h-[220px]">
                    {(() => {
                      const att = selectedTicket.attachments[activeMediaIndex];
                      const fullUrl = `http://localhost:8000${att.file_path}`;
                      return (
                        <div className="w-full flex flex-col items-center relative">
                          {att.is_proof && (
                            <span className="absolute top-2 right-2 px-2.5 py-1 bg-emerald-950/80 text-emerald-450 border border-emerald-800/40 text-[9px] font-extrabold uppercase rounded-lg z-10 select-none">
                              Resolution Proof
                            </span>
                          )}
                          {att.file_type === 'photo' ? (
                            <img 
                              src={fullUrl} 
                              alt="Attachment" 
                              className="max-h-[260px] object-contain rounded-lg shadow-md border border-slate-850"
                            />
                          ) : att.file_type === 'video' ? (
                            <video 
                              src={fullUrl} 
                              controls 
                              className="max-h-[260px] w-full rounded-lg shadow-md border border-slate-850"
                            />
                          ) : att.file_type === 'audio' ? (
                            <div className="flex flex-col items-center justify-center p-6 w-full gap-3 bg-slate-900/40 rounded-lg border border-slate-850">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Audio Evidence clip</span>
                              <audio 
                                src={fullUrl} 
                                controls 
                                className="w-full max-w-md"
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}

                    {selectedTicket.attachments.length > 1 && (
                      <>
                        <button 
                          type="button"
                          onClick={() => setActiveMediaIndex((prev) => (prev === 0 ? selectedTicket.attachments.length - 1 : prev - 1))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-slate-950/80 hover:bg-slate-850 border border-slate-850 rounded-full text-slate-300 hover:text-slate-100 transition-all cursor-pointer font-bold"
                        >
                          &larr;
                        </button>
                        <button 
                          type="button"
                          onClick={() => setActiveMediaIndex((prev) => (prev === selectedTicket.attachments.length - 1 ? 0 : prev + 1))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-950/80 hover:bg-slate-850 border border-slate-850 rounded-full text-slate-300 hover:text-slate-100 transition-all cursor-pointer font-bold"
                        >
                          &rarr;
                        </button>
                      </>
                    )}
                  </div>

                  {selectedTicket.attachments.length > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      {selectedTicket.attachments.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveMediaIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-all ${idx === activeMediaIndex ? 'bg-blue-500 scale-125' : 'bg-slate-700 hover:bg-slate-500'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Meta information row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950/20 p-4 border border-slate-850 rounded-xl">
                <div>
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase">Priority</h5>
                  <div className="mt-1">{getPriorityBadge(selectedTicket.priority)}</div>
                </div>
                <div>
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase">Current State</h5>
                  <div className="mt-1">{getStatusBadge(selectedTicket.status)}</div>
                </div>
                <div>
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase">Routed Department</h5>
                  <p className="text-xs font-bold text-slate-300 mt-1">{getDepartmentName(selectedTicket.assigned_department_id)}</p>
                </div>
                <div>
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-emerald-400" />
                    AI Score
                  </h5>
                  <p className="text-xs font-mono font-bold text-emerald-400 mt-1">
                    {selectedTicket.ai_confidence !== null ? `${(selectedTicket.ai_confidence * 100).toFixed(0)}% Match` : 'Override'}
                  </p>
                </div>
              </div>

              {/* Status Update Form */}
              <form onSubmit={handleSaveStatus} className="space-y-4 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2" htmlFor="modal-status">
                        Resolution State
                      </label>
                      <select
                        id="modal-status"
                        value={statusVal}
                        onChange={(e) => setStatusVal(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 transition-all text-xs"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="Under Re-evaluation">Under Re-evaluation</option>
                      </select>
                    </div>

                    {user?.dept_role === 'Department Head' && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2" htmlFor="modal-assignee">
                          Assign Officer / Staff
                        </label>
                        <select
                          id="modal-assignee"
                          value={assignedStaffId}
                          onChange={(e) => setAssignedStaffId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 transition-all text-xs font-semibold"
                        >
                          <option value="">Unassigned</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.dept_role || 'Staff'})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2" htmlFor="modal-remarks">
                      Resolution Remarks / Update Notes
                    </label>
                    <textarea
                      id="modal-remarks"
                      placeholder="Enter status update notes or final resolution remarks..."
                      value={remarksVal}
                      onChange={(e) => setRemarksVal(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 transition-all text-xs h-28 resize-none"
                    />
                  </div>
                </div>

                {statusVal === 'resolved' && (
                  <div className="pt-2 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Resolution Text Report (Mandatory)
                      </label>
                      <textarea
                        placeholder="Provide a detailed text report explaining the resolution steps..."
                        value={reportVal}
                        onChange={(e) => setReportVal(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 transition-all text-xs h-20 resize-none font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Resolution Media Proof (Mandatory)
                      </label>
                      <div className="p-4 bg-slate-950 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-500/50 transition-all relative">
                        <input
                          id="proof-upload-input"
                          type="file"
                          multiple
                          onChange={(e) => {
                            if (e.target.files) {
                              setProofFiles(Array.from(e.target.files));
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          required
                          accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/mp4,audio/m4a"
                        />
                        <FileText className="w-8 h-8 text-blue-500 animate-pulse" />
                        <p className="text-xs text-slate-300 font-bold text-center">
                          Drag & drop or click to upload proof
                        </p>
                        <p className="text-[10px] text-slate-500 text-center font-medium">
                          Supported: Images, MP4/MOV Videos, MP3/WAV/M4A Audios
                        </p>
                      </div>
                    </div>
                    {proofFiles.length > 0 && (
                      <div className="mt-3 bg-slate-950/40 border border-slate-850 p-3 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Selected Proof Files</span>
                        {proofFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between text-xs text-slate-350 bg-slate-900 border border-slate-800/60 px-3 py-1.5 rounded-lg">
                            <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono">{(file.size / 1024).toFixed(0)} KB</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl text-xs font-bold transition-all"
                  >
                    Close
                  </button>
                  <button
                    id="modal-save-btn"
                    type="submit"
                    disabled={updating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {updating ? 'Saving...' : 'Save Resolution'}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* Department Head Personnel Panel */}
      {user?.dept_role === 'Department Head' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
            <UserPlus className="w-5 h-5 text-emerald-400" />
            <h2 className="font-extrabold text-base text-slate-200">Department Staff Management</h2>
          </div>
          {loadingEmployees ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
              <Loader className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-[9px] font-bold uppercase tracking-widest">Loading Personnel...</span>
            </div>
          ) : employees.length === 0 ? (
            <p className="text-xs text-slate-500">No other employees in this department.</p>
          ) : (
            <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-950/20">
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
                    <tr key={emp.id} className="hover:bg-slate-950/10">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-200">{emp.name}</p>
                        <p className="text-[10px] text-slate-505">{emp.email}</p>
                      </td>
                      <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                        {emp.employee_id_or_passport || 'N/A'}
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={emp.dept_role || ''}
                          onChange={async (e) => {
                            try {
                              const res = await api.put(`/departments/employees/${emp.id}/role`, {
                                dept_role: e.target.value
                              });
                              alert(res.data.detail || 'Role change requested!');
                              fetchDeptEmployees();
                            } catch (err) {
                              alert(err.response?.data?.detail || 'Failed to request role change.');
                            }
                          }}
                          className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-350 focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">Select Role</option>
                          <option value="Department Head">Department Head</option>
                          <option value="Field Operator">Field Operator</option>
                          <option value="Support Rep">Support Rep</option>
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full ${
                          emp.status === 'active' ? 'bg-emerald-950/40 text-emerald-450 border border-emerald-900/40' : 'bg-rose-950/40 text-rose-455 border border-rose-900/40'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500 italic">
                        Approval Pipeline Active
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Citizen Proof Requests Tracking */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mt-6">
        <ProofRequestsView />
      </section>
    </div>
  );
};

export default DeptAdminDashboard;
