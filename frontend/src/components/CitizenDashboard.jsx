import React, { useState } from 'react';
import api from '../services/api';
import { PlusCircle, Inbox, Cpu, Loader, AlertTriangle, CheckCircle2 } from 'lucide-react';

const CitizenDashboard = ({ tickets, departments, onRefresh, getPriorityBadge, getStatusBadge, getDepartmentName }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description) return;
    setSubmitting(true);
    setSubmissionResult(null);

    try {
      const response = await api.post('/tickets/create', {
        title,
        description,
        priority
      });

      const newTicket = response.data;
      setTitle('');
      setDescription('');
      setPriority('medium');
      
      const dept = departments.find(d => d.id === newTicket.assigned_department_id);
      setSubmissionResult({
        ...newTicket,
        dept_name: dept ? dept.name : 'Unassigned'
      });

      onRefresh();
    } catch (err) {
      console.error("Ticket submission error:", err);
      const msg = err.response?.data?.detail || "Failed to submit ticket";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Ticket Submission Form Column */}
      <div className="lg:col-span-4 space-y-6">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-6">
            <PlusCircle className="w-5 h-5 text-emerald-400" />
            <h2 className="font-extrabold text-lg text-slate-200" id="citizen-form-title">File Public Grievance</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby="citizen-form-title">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2" htmlFor="ticket-title">
                Subject / Title
              </label>
              <input
                id="ticket-title"
                type="text"
                placeholder="Brief title summarizing the issue"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2" htmlFor="ticket-desc">
                Description
              </label>
              <textarea
                id="ticket-desc"
                placeholder="Provide specific details (e.g. location, severity, keywords like pipe, pothole, electricity, garbage...)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm h-32 resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2" htmlFor="ticket-priority">
                Priority Selection
              </label>
              <select
                id="ticket-priority"
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
              id="citizen-submit-btn"
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 disabled:opacity-50"
            >
              {submitting ? 'Auto Routing...' : 'Dispatch Ticket'}
            </button>
          </form>
        </div>

        {/* Dynamic AI Routing Diagnosis Result */}
        {submissionResult && (
          <div className="p-6 bg-slate-900 border border-emerald-500/20 rounded-2xl relative overflow-hidden animate-fade-in shadow-xl shadow-emerald-500/5" id="ai-result-panel">
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
                <p className="text-base font-extrabold text-slate-200 mt-0.5" id="ai-assigned-dept">{submissionResult.dept_name}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Confidence Level</p>
                  <p className="text-sm font-bold text-slate-300 mt-0.5" id="ai-confidence-value">
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

      {/* Ticket History Table Column */}
      <div className="lg:col-span-8 space-y-6">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Inbox className="w-5 h-5 text-blue-400" />
              <h2 className="font-extrabold text-lg text-slate-200">Your Submitted Grievances</h2>
            </div>
            <span className="text-xs text-slate-500 font-semibold">{tickets.length} records</span>
          </div>

          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-4 border border-dashed border-slate-800 rounded-xl">
              <p className="text-sm font-bold text-slate-400">No tickets found</p>
              <p className="text-xs text-slate-600">Your grievance history log is currently empty.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950/20">
                    <th className="py-4 px-4 w-16">ID</th>
                    <th className="py-4 px-4">Subject</th>
                    <th className="py-4 px-4">Priority</th>
                    <th className="py-4 px-4">Routed Department</th>
                    <th className="py-4 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-900/60 transition-colors citizen-ticket-row">
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
                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-300 text-xs">
                          {getDepartmentName(ticket.assigned_department_id)}
                        </span>
                        {ticket.ai_confidence !== null && (
                          <span className="text-[9px] text-slate-500 block">
                            AI Confidence: {(ticket.ai_confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {getStatusBadge(ticket.status)}
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
  );
};

export default CitizenDashboard;
