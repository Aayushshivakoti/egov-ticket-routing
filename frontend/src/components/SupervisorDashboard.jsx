import React from 'react';
import api from '../services/api';
import { Inbox, Cpu, BarChart3, PieChart, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

const SupervisorDashboard = ({ tickets, departments, onRefresh, getPriorityBadge, getStatusBadge, getDepartmentName }) => {
  
  // Calculate SVG charts statistics
  const getDeptCounts = () => {
    const counts = {};
    departments.forEach(d => {
      counts[d.name] = 0;
    });
    tickets.forEach(t => {
      const name = getDepartmentName(t.assigned_department_id);
      if (name in counts) {
        counts[name] += 1;
      } else {
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return counts;
  };

  const getStatusCounts = () => {
    const counts = { pending: 0, in_progress: 0, resolved: 0 };
    tickets.forEach(t => {
      if (t.status in counts) {
        counts[t.status] += 1;
      }
    });
    return counts;
  };

  const deptCounts = getDeptCounts();
  const statusCounts = getStatusCounts();
  const maxDeptVal = Math.max(...Object.values(deptCounts), 1); // Avoid division by zero

  const handleDepartmentOverride = async (ticketId, newDeptId) => {
    try {
      await api.patch(`/tickets/${ticketId}`, {
        assigned_department_id: newDeptId ? parseInt(newDeptId) : null,
        ai_confidence: 1.0 // Indicate manual override confidence
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
      
      {/* Analytics Charts Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Department Distribution (SVG Bar Chart) */}
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
                  {/* SVG progress bar */}
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

        {/* Status Breakdown (SVG Doughnut Chart / Progress Ring Visualization) */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-base text-slate-200">Incident Resolution Metrics</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            {/* SVG Doughnut diagram */}
            <div className="flex justify-center relative">
              <svg width="140" height="140" viewBox="0 0 40 40" className="transform -rotate-90">
                {/* Background Ring */}
                <circle cx="20" cy="20" r="15.915" fill="transparent" stroke="#0f172a" strokeWidth="4" />
                
                {/* Pending Arc (Yellow) */}
                <circle 
                  cx="20" cy="20" r="15.915" fill="transparent" stroke="#facc15" strokeWidth="4"
                  strokeDasharray={`${(statusCounts.pending / (tickets.length || 1)) * 100} ${100 - ((statusCounts.pending / (tickets.length || 1)) * 100)}`}
                  strokeDashoffset="0"
                />
                
                {/* In Progress Arc (Blue) */}
                <circle 
                  cx="20" cy="20" r="15.915" fill="transparent" stroke="#3b82f6" strokeWidth="4"
                  strokeDasharray={`${(statusCounts.in_progress / (tickets.length || 1)) * 100} ${100 - ((statusCounts.in_progress / (tickets.length || 1)) * 100)}`}
                  strokeDashoffset={`-${(statusCounts.pending / (tickets.length || 1)) * 100}`}
                />

                {/* Resolved Arc (Emerald) */}
                <circle 
                  cx="20" cy="20" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="4"
                  strokeDasharray={`${(statusCounts.resolved / (tickets.length || 1)) * 100} ${100 - ((statusCounts.resolved / (tickets.length || 1)) * 100)}`}
                  strokeDashoffset={`-${((statusCounts.pending + statusCounts.in_progress) / (tickets.length || 1)) * 100}`}
                />
              </svg>
              {/* Centered label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-slate-100">{tickets.length}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Total</span>
              </div>
            </div>

            {/* Legends list */}
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
