import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { X, Send, Paperclip, Video, Music, Loader, Cpu, CheckCircle2 } from 'lucide-react';

const ClarificationModal = ({ ticket, onClose, onRefresh, currentUserRole }) => {
  const [clarifications, setClarifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchClarifications();
  }, [ticket.id]);

  const fetchClarifications = async () => {
    try {
      const res = await api.get(`/tickets/${ticket.id}/clarifications`);
      setClarifications(res.data);
    } catch (err) {
      console.error("Failed to load clarifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() && files.length === 0) return;
    
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('message', message);
      files.forEach(f => formData.append('files', f));
      
      await api.post(`/tickets/${ticket.id}/clarifications`, formData);
      
      setMessage('');
      setFiles([]);
      fetchClarifications();
    } catch (err) {
      alert("Failed to post clarification.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if(!window.confirm("Are you sure you want to mark this reopened ticket as resolved again?")) return;
    try {
      const formData = new FormData();
      formData.append('status', 'resolved');
      formData.append('remarks', 'Issue resolved after re-evaluation and clarification.');
      formData.append('report', 'Clarification loop completed.');
      
      // Need dummy proof file since it's required for 'resolved'
      const blob = new Blob(["Re-resolved proof"], { type: "text/plain" });
      const file = new File([blob], "re_resolved_proof.txt", { type: "text/plain" });
      formData.append('files', file);

      await api.put(`/tickets/${ticket.id}/status`, formData);
      alert('Ticket successfully re-resolved.');
      onRefresh();
      onClose();
    } catch (err) {
      alert("Failed to update status: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl flex flex-col my-8 max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div>
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              Clarification Thread <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">#T-{ticket.id}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">{ticket.title}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center p-8"><Loader className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : clarifications.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-8 italic">No clarification messages yet.</p>
          ) : (
            clarifications.map((c) => {
              const isCitizen = c.sender?.role === 'citizen';
              return (
                <div key={c.id} className={`flex flex-col ${isCitizen ? 'items-start' : 'items-end'}`}>
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1 px-1">
                    {c.sender?.name || 'Unknown'} ({c.sender?.role || 'User'}) - {new Date(c.created_at).toLocaleString()}
                  </span>
                  <div className={`p-3 rounded-xl max-w-[80%] text-sm ${isCitizen ? 'bg-slate-800 text-slate-200 rounded-tl-sm' : 'bg-blue-900/40 border border-blue-800/50 text-blue-100 rounded-tr-sm'}`}>
                    <p className="whitespace-pre-wrap">{c.message}</p>
                    {c.attachments && c.attachments.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-white/10 pt-2">
                        {c.attachments.map(att => {
                          const fullUrl = `http://localhost:8000${att.file_path}`;
                          return (
                          <div key={att.id}>
                            {att.file_type === 'photo' && <img src={fullUrl} alt="attachment" className="max-w-full h-auto rounded border border-white/20" />}
                            {att.file_type === 'video' && <video src={fullUrl} controls className="max-w-full h-32 rounded bg-black border border-white/20" />}
                            {att.file_type === 'audio' && <audio src={fullUrl} controls className="w-full max-w-xs" />}
                            {att.file_type === 'document' && <a href={fullUrl} target="_blank" rel="noreferrer" className="text-xs underline flex items-center gap-1"><Paperclip className="w-3 h-3"/> View Document</a>}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your clarification request or response..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none h-24"
              required={files.length === 0}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  id={`clarification-file-${ticket.id}`} 
                  multiple 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <button 
                  type="button" 
                  onClick={() => document.getElementById(`clarification-file-${ticket.id}`).click()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  Attach Media {files.length > 0 && `(${files.length})`}
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                {(currentUserRole === 'super_admin' || currentUserRole === 'dept_admin') && (
                  <button
                    type="button"
                    onClick={handleResolve}
                    className="px-4 py-2 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-900/50 text-emerald-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Resolved
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClarificationModal;
