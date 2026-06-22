import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { PlusCircle, Inbox, Cpu, Loader, AlertTriangle, CheckCircle2, UploadCloud, Mic, Trash2, Video, Music, Image, Paperclip } from 'lucide-react';

const CitizenDashboard = ({ tickets, departments, onRefresh, getPriorityBadge, getStatusBadge, getDepartmentName }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Attachment states
  const [attachments, setAttachments] = useState([]); // [{ id, file, previewUrl, type }]
  const [isDragging, setIsDragging] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioStream, setAudioStream] = useState(null);
  const [recorder, setRecorder] = useState(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((att) => URL.revokeObjectURL(att.previewUrl));
    };
  }, [attachments]);

  const addAttachment = (file) => {
    const fileType = file.type;
    let type = 'photo';
    if (fileType.startsWith('video/')) {
      type = 'video';
    } else if (fileType.startsWith('audio/')) {
      type = 'audio';
    }
    
    // Fallback based on extension
    const ext = file.name.split('.').pop().toLowerCase();
    if (['mp4', 'mov'].includes(ext)) type = 'video';
    else if (['mp3', 'wav', 'm4a', 'webm', 'ogg'].includes(ext)) type = 'audio';
    
    const newAtt = {
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      type
    };
    setAttachments((prev) => [...prev, newAtt]);
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => {
      const target = prev.find(x => x.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(x => x.id !== id);
    });
  };

  // Mic Recording via MediaRecorder API
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      const mediaRecorder = new MediaRecorder(stream);
      setRecorder(mediaRecorder);
      
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const file = new File([blob], `recording-${Date.now()}.wav`, { type: 'audio/wav' });
        addAttachment(file);
      };
      
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Failed to start voice recording:", err);
      alert("Microphone permission denied or device not found.");
    }
  };

  const stopRecording = () => {
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }
    setRecording(false);
  };

  const toggleRecording = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Drag and Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(file => {
        addAttachment(file);
      });
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        addAttachment(file);
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description) return;
    setSubmitting(true);
    setSubmissionResult(null);

    try {
      // Build FormData payload
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('priority', priority);
      
      attachments.forEach((att) => {
        formData.append('files', att.file);
      });

      const response = await api.post('/tickets/create', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const newTicket = response.data;
      setTitle('');
      setDescription('');
      setPriority('medium');
      
      // Clear attachments
      attachments.forEach((att) => URL.revokeObjectURL(att.previewUrl));
      setAttachments([]);

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
      <div className="lg:col-span-5 space-y-6">
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
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-880 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
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
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-880 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm h-28 resize-none"
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
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-880 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>

            {/* Drag and Drop Zone */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Upload Evidence / Media
              </label>
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${isDragging ? 'border-blue-500 bg-blue-950/15' : 'border-slate-800 bg-slate-950/30 hover:border-slate-700'}`}
                onClick={() => document.getElementById('file-upload-input').click()}
              >
                <input 
                  id="file-upload-input" 
                  type="file" 
                  multiple 
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,video/mp4,video/quicktime,audio/*"
                />
                
                <UploadCloud className="w-8 h-8 text-slate-500" />
                <p className="text-xs text-slate-400 font-medium">
                  Drag & drop media files here, or <span className="text-blue-400 font-bold hover:underline">browse</span>
                </p>
                <p className="text-[10px] text-slate-600">
                  Supports Images, Videos (mp4/mov), and Audio (mp3/wav/m4a)
                </p>
              </div>
            </div>

            {/* Mic Recording button */}
            <div className="flex items-center justify-between bg-slate-950/45 border border-slate-850 p-3 rounded-xl">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-300">Live Voice Evidence</span>
                <span className="text-[10px] text-slate-500">Record description directly</span>
              </div>
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-2.5 rounded-full flex items-center justify-center transition-all cursor-pointer ${recording ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse' : 'bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300'}`}
                title={recording ? "Stop Recording" : "Record Description"}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>

            {/* Live Attachments Previews */}
            {attachments.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-850">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Selected Attachments ({attachments.length})</span>
                <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
                  {attachments.map((att) => (
                    <div key={att.id} className="relative bg-slate-950 border border-slate-850 p-2.5 rounded-xl flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        className="absolute top-2.5 right-2.5 p-1 bg-slate-900 hover:bg-rose-950/20 text-slate-500 hover:text-rose-400 border border-slate-800 rounded-lg transition-colors cursor-pointer z-10"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {att.type === 'photo' && (
                        <div className="flex items-center gap-3">
                          <img src={att.previewUrl} alt="Thumbnail" className="w-12 h-12 object-cover rounded-lg border border-slate-800" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-300 truncate">{att.file.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{(att.file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                      )}

                      {att.type === 'video' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Video className="w-5 h-5 text-blue-400" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-300 truncate">{att.file.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{(att.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <video src={att.previewUrl} controls className="w-full max-h-24 object-contain rounded-lg bg-black border border-slate-800" />
                        </div>
                      )}

                      {att.type === 'audio' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Music className="w-5 h-5 text-purple-400" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-300 truncate">{att.file.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{(att.file.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <audio src={att.previewUrl} controls className="w-full max-w-xs" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              id="citizen-submit-btn"
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 disabled:opacity-50 cursor-pointer"
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
      <div className="lg:col-span-7 space-y-6">
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
                        {ticket.attachments && ticket.attachments.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-semibold mt-1.5 bg-slate-950 px-2 py-0.5 border border-slate-850 rounded-lg">
                            <Paperclip className="w-3 h-3 text-slate-400" />
                            {ticket.attachments.length} attachment(s)
                          </span>
                        )}
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
