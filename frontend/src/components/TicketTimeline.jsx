import React from 'react';
import { Check, Clock, AlertTriangle, HelpCircle } from 'lucide-react';

const TicketTimeline = ({ ticket, departmentName }) => {
  const status = ticket.status;

  const steps = [
    {
      key: 'submitted',
      label: 'Grievance Submitted',
      description: 'Your complaint has been successfully registered in the system.',
      isCompleted: true,
      isActive: status === 'processing',
      icon: Check,
      color: 'bg-blue-600',
    },
    {
      key: 'routed',
      label: 'Department Auto-Routed',
      description: ticket.assigned_department_id 
        ? `Routed automatically by AI classification to the "${departmentName}" department.`
        : 'AI classifier analyzing details for automatic dispatch...',
      isCompleted: status !== 'processing',
      isActive: status === 'pending',
      icon: ticket.assigned_department_id ? Check : Clock,
      color: ticket.assigned_department_id ? 'bg-blue-600' : 'bg-slate-700',
    },
    {
      key: 'in_progress',
      label: 'Investigation & Repair',
      description: status === 'in_progress' 
        ? 'Department operators have been dispatched and work is currently in progress.' 
        : (status === 'resolved' || status === 'Under Re-evaluation' ? 'Work and field repairs completed.' : 'Awaiting review and operator assignment.'),
      isCompleted: status === 'resolved' || status === 'Under Re-evaluation',
      isActive: status === 'in_progress',
      icon: (status === 'resolved' || status === 'Under Re-evaluation') ? Check : Clock,
      color: (status === 'resolved' || status === 'Under Re-evaluation') ? 'bg-blue-600' : 'bg-slate-700',
    },
    {
      key: 'resolved',
      label: 'Resolution Proof & Close',
      description: status === 'resolved' 
        ? 'Official resolved. Audit reports and proof media have been published.' 
        : (status === 'Under Re-evaluation' ? 'Citizen requested re-evaluation. Clarification loop active.' : 'Awaiting final resolution reports.'),
      isCompleted: status === 'resolved',
      isActive: status === 'Under Re-evaluation' || status === 'sla_violated',
      icon: status === 'resolved' ? Check : (status === 'Under Re-evaluation' ? HelpCircle : Clock),
      color: status === 'resolved' 
        ? 'bg-emerald-600 border border-emerald-500' 
        : (status === 'Under Re-evaluation' ? 'bg-amber-600 animate-pulse' : 'bg-slate-700'),
    },
  ];

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-6 mt-4 backdrop-blur-md select-none">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Resolution Timeline Tracker
        </h4>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-950/60 border border-slate-800 px-2 py-0.5 rounded uppercase font-bold">
          Status: {status.replace('_', ' ')}
        </span>
      </div>

      <div className="relative pl-8 space-y-5">
        {/* Glowing Progress connecting line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-500 via-indigo-500 to-slate-800 shadow-[0_0_8px_rgba(59,130,246,0.3)]"></div>

        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          return (
            <div key={step.key} className="relative flex flex-col sm:flex-row items-start gap-4 transition-all duration-300">
              {/* Node Indicator bubble with drop shadows */}
              <div className={`absolute -left-[27px] top-0 w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-500 z-10 ${
                step.isCompleted 
                  ? 'bg-blue-900/40 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.25)]' 
                  : (step.isActive 
                    ? 'bg-slate-950 border-indigo-500 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.4)] animate-pulse' 
                    : 'bg-slate-950 border-slate-800/80 text-slate-600')
              }`}>
                <StepIcon className="w-4 h-4" />
              </div>

              {/* Node Details text content wrapped in a glassmorphic card */}
              <div className={`flex-1 p-3 bg-slate-950/30 border border-slate-850 rounded-xl hover:border-slate-800 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 text-left ${
                step.isCompleted ? 'border-slate-800' : (step.isActive ? 'border-indigo-950' : 'border-slate-900/60')
              }`}>
                <h5 className={`text-xs font-extrabold ${
                  step.isCompleted 
                    ? 'text-slate-200' 
                    : (step.isActive ? 'text-indigo-400' : 'text-slate-500')
                }`}>
                  {step.label}
                </h5>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-lg font-medium">
                  {step.description}
                </p>
              </div>

              {/* Date details */}
              {idx === 0 && (
                <div className="text-[9px] text-slate-500 font-mono tracking-wider font-semibold whitespace-nowrap self-start mt-1.5 uppercase">
                  {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {idx === 3 && status === 'resolved' && (
                <div className="text-[9px] text-slate-500 font-mono tracking-wider font-semibold whitespace-nowrap self-start mt-1.5 uppercase">
                  {new Date(ticket.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {status === 'sla_violated' && (
        <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl text-xs flex items-center gap-2.5 text-rose-400 text-left font-semibold">
          <AlertTriangle className="w-4 h-4 animate-bounce" />
          <span>SLA violation flagged. Assigned department failed to respond in the required 24-hour window.</span>
        </div>
      )}
    </div>
  );
};

export default TicketTimeline;
