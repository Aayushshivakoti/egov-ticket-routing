import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Loader, CheckCircle2, AlertCircle, Clock, ExternalLink, Upload, File as FileIcon } from 'lucide-react';
import api from '../services/api';

const SlaRing = ({ createdAt, status }) => {
  const [percent, setPercent] = useState(100);
  const [hoursLeft, setHoursLeft] = useState(24);

  useEffect(() => {
    if (status !== 'pending') return;
    const updateTime = () => {
      const created = new Date(createdAt).getTime();
      const now = new Date().getTime();
      const limit = 24 * 60 * 60 * 1000; // 24-hour SLA
      const elapsed = now - created;
      const remaining = limit - elapsed;
      
      const pct = Math.max(0, Math.min(100, (remaining / limit) * 100));
      setPercent(pct);
      setHoursLeft(Math.max(0, remaining / (1000 * 60 * 60)));
    };

    updateTime();
    const interval = setInterval(updateTime, 30000); // tick every 30s
    return () => clearInterval(interval);
  }, [createdAt, status]);

  if (status !== 'pending') return null;

  const radius = 16;
  const stroke = 3;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  let color = '#10b981'; // Green (Safe)
  let textClass = 'text-emerald-400 font-bold';
  let isPulsing = false;
  
  if (hoursLeft <= 3.0) { // Under 3 hours
    color = '#ef4444'; // Red (Urgent)
    textClass = 'text-rose-500 font-black animate-pulse';
    isPulsing = true;
  } else if (hoursLeft <= 12.0) { // Under 12 hours
    color = '#f59e0b'; // Amber (Warning)
    textClass = 'text-amber-400 font-bold';
  }

  return (
    <div className="flex items-center gap-2 mt-2 select-none border border-slate-800/40 bg-slate-950/20 p-2 rounded-xl w-max">
      <div className={`relative flex items-center justify-center ${isPulsing ? 'animate-pulse' : ''}`}>
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            stroke="#1e293b"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-500 ease-in-out"
          />
        </svg>
        <span className="absolute text-[8px] font-black text-slate-400">{percent.toFixed(0)}%</span>
      </div>
      <div className="text-left leading-none">
        <p className={`text-[9px] uppercase tracking-wider ${textClass}`}>
          {hoursLeft <= 0 ? "SLA Breached" : `${hoursLeft.toFixed(1)}h Left`}
        </p>
        <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 inline-block">SLA Clock</span>
      </div>
    </div>
  );
};

const ProofRequestsView = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [uploadingReqId, setUploadingReqId] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const [viewingTicket, setViewingTicket] = useState(null);
  const [ticketLoading, setTicketLoading] = useState(false);

  const fetchProofRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tickets/proof-requests');
      setRequests(res.data);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to load proof requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProofRequests();
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingReqId) return;

    const formData = new FormData();
    formData.append('files', file);

    try {
      setUploadError('');
      await api.post(`/tickets/proof-requests/${uploadingReqId}/fulfill`, formData);
      fetchProofRequests();
    } catch (err) {
      console.error(err);
      setUploadError(err.response?.data?.detail || 'Failed to upload proof');
    } finally {
      setUploadingReqId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleViewTicket = async (ticketId) => {
    setTicketLoading(true);
    try {
      const res = await api.get(`/tickets/${ticketId}`);
      setViewingTicket(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to load ticket details');
    } finally {
      setTicketLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return (
          <span className="px-2.5 py-1 bg-amber-950/40 text-amber-500 border border-amber-800/50 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-max">
            <Clock className="w-3 h-3" /> Awaiting Upload
          </span>
        );
      case 'fulfilled':
        return (
          <span className="px-2.5 py-1 bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-max">
            <CheckCircle2 className="w-3 h-3" /> Proof Uploaded
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-slate-900 text-slate-400 border border-slate-800 rounded-full text-[10px] font-bold uppercase tracking-wider w-max">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-900/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-100">Citizen Proof Requests</h2>
            <p className="text-xs text-slate-400 mt-0.5">Track resolution evidence requests initiated by the public</p>
          </div>
        </div>
        <button 
          onClick={fetchProofRequests}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors"
        >
          Refresh Feed
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/30 border border-rose-900/50 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}
      {uploadError && (
        <div className="p-4 bg-rose-950/30 border border-rose-900/50 rounded-xl flex items-center gap-3 text-rose-400 text-sm mt-4">
          <AlertCircle className="w-5 h-5" />
          <p>{uploadError}</p>
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".jpg,.jpeg,.png,.pdf,.txt,.doc,.docx,.mp4,.mp3,.wav"
      />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
            <Loader className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs font-bold uppercase tracking-widest">Loading Requests...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500 border border-dashed border-slate-800 rounded-2xl m-4 bg-slate-950/50">
            <ShieldCheck className="w-8 h-8 text-slate-700" />
            <p className="text-sm font-bold">No active proof requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/40 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="py-4 px-6">Req ID</th>
                  <th className="py-4 px-6">Linked Ticket</th>
                  <th className="py-4 px-6">Requested By</th>
                  <th className="py-4 px-6">Date Requested</th>
                  <th className="py-4 px-6">Fulfillment Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs text-slate-300">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 font-mono text-slate-500 font-bold">#PR-{req.id}</td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200">{req.ticket_title}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">Ticket #{req.ticket_id}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-medium text-indigo-300">{req.citizen_name}</td>
                    <td className="py-4 px-6 text-slate-400 font-medium">{formatDate(req.created_at)}</td>
                    <td className="py-4 px-6 font-medium">
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(req.status)}
                        {req.status === 'pending' && <SlaRing createdAt={req.created_at} status={req.status} />}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        {req.status === 'pending' && (
                          <button 
                            onClick={() => {
                              setUploadingReqId(req.id);
                              fileInputRef.current?.click();
                            }}
                            className="px-3 py-1.5 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-900/50 text-indigo-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                          >
                            <Upload className="w-3 h-3" /> Upload Proof
                          </button>
                        )}
                        <button 
                          onClick={() => handleViewTicket(req.ticket_id)}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                        >
                          {ticketLoading ? <Loader className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                          View Ticket
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

      {/* Ticket Details Modal */}
      {viewingTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-slate-200">{viewingTicket.title}</h3>
                <p className="text-[10px] font-mono text-slate-500 mt-1">Ticket #{viewingTicket.id} • {formatDate(viewingTicket.created_at)}</p>
              </div>
              <button onClick={() => setViewingTicket(null)} className="p-2 bg-slate-950 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                <AlertCircle className="w-5 h-5 rotate-45" /> {/* Close icon using AlertCircle or X if imported, I will just use standard X shape style or AlertCircle for now */}
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Description</h4>
                <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">{viewingTicket.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Status</h4>
                  <div className="text-sm font-semibold text-slate-300">{viewingTicket.status}</div>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Priority</h4>
                  <div className="text-sm font-semibold text-slate-300">{viewingTicket.priority}</div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => setViewingTicket(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProofRequestsView;
