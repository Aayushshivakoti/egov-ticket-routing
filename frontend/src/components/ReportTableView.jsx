import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Inbox, Cpu, Eye, X, ArrowLeft, Trash2 } from 'lucide-react';
import api from '../services/api';

const ReportTableView = ({ statusFilter, tickets, departments = [], getPriorityBadge, getStatusBadge, getDepartmentName, onRefresh }) => {
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpenModal = (ticket) => {
    setSelectedTicket(ticket);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedTicket(null);
  };

  const handleDepartmentOverride = async (ticketId, newDeptId) => {
    if (!newDeptId) return;
    try {
      await api.patch(`/tickets/${ticketId}`, {
        assigned_department_id: parseInt(newDeptId),
        ai_confidence: 1.0
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to override department assignment");
    }
  };

  const handleStatusOverride = async (ticketId, newStatus) => {
    if (!newStatus) return;
    try {
      await api.patch(`/tickets/${ticketId}`, {
        status: newStatus
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    if (!window.confirm(`Are you sure you want to permanently delete Ticket #T-${ticketId}?`)) return;
    try {
      await api.delete(`/tickets/${ticketId}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      alert("Failed to delete ticket: " + (err.response?.data?.detail || err.message));
    }
  };

  const getTableTitle = () => {
    switch (statusFilter) {
      case 'pending': return 'Pending Assignments';
      case 'in-progress': return 'In-Progress Cases';
      case 'resolved': return 'Resolved Cases';
      default: return 'System-Wide Grievance Logs';
    }
  };

  return (
    <div className="mt-8 space-y-4">
      <NavLink 
        to="/admin"
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </NavLink>

      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-400" />
            <h2 className="font-extrabold text-lg text-slate-200">{getTableTitle()}</h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{tickets.length} records</span>
        </div>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-4 border border-dashed border-slate-800 rounded-xl">
            <p className="text-sm font-bold text-slate-400">No tickets found</p>
            <p className="text-xs text-slate-600">There are no records matching this criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950/20">
                  <th className="py-4 px-4 w-16">ID</th>
                  <th className="py-4 px-4">Subject</th>
                  <th className="py-4 px-4">Priority</th>
                  <th className="py-4 px-4 w-48">Routing Info & Override</th>
                  <th className="py-4 px-4 w-48">Status & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {tickets.filter(t => t.status !== 'Under Re-evaluation').map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-4 px-4 font-mono font-bold text-xs text-slate-400">#T-{ticket.id}</td>
                    <td className="py-4 px-4 max-w-xs">
                      <p className="font-bold text-slate-200">{ticket.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                    </td>
                    <td className="py-4 px-4">{getPriorityBadge(ticket.priority)}</td>
                    <td className="py-4 px-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            AI Score: {ticket.ai_confidence !== null ? `${(ticket.ai_confidence * 100).toFixed(0)}%` : 'Manual'}
                          </span>
                        </div>
                        <select
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
                          value={ticket.assigned_department_id || ''}
                          onChange={(e) => handleDepartmentOverride(ticket.id, e.target.value)}
                        >
                          <option value="">-- AI Routing --</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-2 flex flex-col items-start w-full">
                        <div className="flex w-full items-center justify-between">
                          {getStatusBadge(ticket.status)}
                          <button
                            onClick={() => handleDeleteTicket(ticket.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                            title="Delete Ticket"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <select
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-300 focus:outline-none focus:border-blue-500 transition-colors mt-2"
                          value={ticket.status}
                          onChange={(e) => handleStatusOverride(ticket.id, e.target.value)}
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

export default ReportTableView;
