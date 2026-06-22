import React, { useState } from 'react';
import api from '../services/api';
import { Inbox, Eye, Cpu, X, FileText, CheckCircle2, Loader } from 'lucide-react';

const DeptAdminDashboard = ({ tickets, onRefresh, getPriorityBadge, getStatusBadge, getDepartmentName }) => {
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusVal, setStatusVal] = useState('pending');
  const [remarksVal, setRemarksVal] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleOpenModal = (ticket) => {
    setSelectedTicket(ticket);
    setStatusVal(ticket.status);
    setRemarksVal(ticket.remarks || '');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedTicket(null);
    setModalOpen(false);
  };

  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setUpdating(true);

    try {
      await api.put(`/tickets/${selectedTicket.id}/status`, {
        status: statusVal,
        remarks: remarksVal
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
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-400" />
            <h2 className="font-extrabold text-lg text-slate-200" id="admin-table-title">Incoming Grievances Log</h2>
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
                  <div className="sm:col-span-1">
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
                    </select>
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
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 transition-all text-xs h-16 resize-none"
                    />
                  </div>
                </div>

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
    </div>
  );
};

export default DeptAdminDashboard;
