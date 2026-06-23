import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Inbox, Cpu, Eye, X, ArrowLeft } from 'lucide-react';
import api from '../services/api';

const ReportTableView = ({ statusFilter, tickets, getPriorityBadge, getStatusBadge }) => {
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
                  <th className="py-4 px-4">AI Score</th>
                  <th className="py-4 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-4 px-4 font-mono font-bold text-xs text-slate-400">#T-{ticket.id}</td>
                    <td className="py-4 px-4 max-w-xs">
                      <p className="font-bold text-slate-200">{ticket.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                    </td>
                    <td className="py-4 px-4">{getPriorityBadge(ticket.priority)}</td>
                    <td className="py-4 px-4 font-mono text-xs text-emerald-400">
                      {ticket.ai_confidence !== null ? `${(ticket.ai_confidence * 100).toFixed(0)}%` : 'Manual'}
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(ticket.status)}</td>
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
