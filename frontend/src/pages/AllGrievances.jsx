import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  FileSpreadsheet, Search, Filter, ArrowLeft, ChevronLeft, ChevronRight,
  Eye, Clock, Loader, CheckCircle2, AlertCircle, X, Send
} from 'lucide-react';

const AllGrievances = ({ onBack, departments }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilters, setStatusFilters] = useState({
    pending: true,
    in_progress: true,
    resolved: true,
    processing: false,
    sla_violated: false
  });

  // Proof modal state
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [selectedProof, setSelectedProof] = useState(null);
  const [loadingProof, setLoadingProof] = useState(false);
  const [requestingProof, setRequestingProof] = useState(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const activeStatuses = Object.entries(statusFilters)
        .filter(([_, active]) => active)
        .map(([status]) => status)
        .join(',');

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (activeStatuses) params.append('status_filter', activeStatuses);
      params.append('page', page);
      params.append('page_size', 20);

      const res = await api.get(`/tickets/public/all?${params.toString()}`);
      setTickets(res.data.tickets);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      console.error('Failed to load all grievances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [page, searchTerm, statusFilters]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchTerm(searchInput);
  };

  const toggleStatusFilter = (status) => {
    setStatusFilters(prev => ({ ...prev, [status]: !prev[status] }));
    setPage(1);
  };

  const getDepartmentName = (deptId) => {
    const dept = departments?.find(d => d.id === deptId);
    return dept ? dept.name : 'AI Routing...';
  };

  const getStatusBadge = (s) => {
    const styles = {
      processing: 'bg-purple-950/40 text-purple-400 border border-purple-800/50',
      pending: 'bg-yellow-950/40 text-yellow-400 border border-yellow-800/50',
      in_progress: 'bg-blue-950/40 text-blue-400 border border-blue-800/50',
      resolved: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50',
      sla_violated: 'bg-rose-950/40 text-rose-400 border border-rose-800/50'
    };
    return (
      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${styles[s] || ''}`}>
        {s.replace('_', ' ')}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const handleViewProof = async (ticketId) => {
    setLoadingProof(true);
    try {
      const res = await api.get(`/tickets/public/${ticketId}/proof`);
      setSelectedProof(res.data);
      setProofModalOpen(true);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to retrieve proof metadata.');
    } finally {
      setLoadingProof(false);
    }
  };

  const handleRequestProof = async (ticketId) => {
    setRequestingProof(ticketId);
    try {
      await api.post(`/tickets/${ticketId}/request-proof`);
      alert('Proof request sent successfully! The department has been notified.');
      fetchTickets();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to request proof.');
    } finally {
      setRequestingProof(null);
    }
  };

  const statusOptions = [
    { key: 'pending', label: 'Pending', color: 'text-yellow-400 border-yellow-800/50' },
    { key: 'in_progress', label: 'In Progress', color: 'text-blue-400 border-blue-800/50' },
    { key: 'resolved', label: 'Resolved', color: 'text-emerald-400 border-emerald-800/50' },
    { key: 'processing', label: 'Processing', color: 'text-purple-400 border-purple-800/50' },
    { key: 'sla_violated', label: 'SLA Violated', color: 'text-rose-400 border-rose-800/50' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl -z-10 animate-pulse delay-700"></div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
                All Public Grievances
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                Complete Transparency Database — {total} Total Records
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by keyword or Ticket ID (e.g. T-5, #12, water supply)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all text-xs font-semibold"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 cursor-pointer"
            >
              Search
            </button>
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setSearchInput(''); setPage(1); }}
                className="px-3 py-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Clear
              </button>
            )}
          </form>

          {/* Status Filter Checkboxes */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <Filter className="w-3.5 h-3.5" />
              Status Filters:
            </div>
            {statusOptions.map(opt => (
              <label
                key={opt.key}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all text-[10px] font-bold uppercase tracking-wide ${
                  statusFilters[opt.key]
                    ? `bg-slate-900 ${opt.color}`
                    : 'bg-slate-950/40 border-slate-800 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={statusFilters[opt.key]}
                  onChange={() => toggleStatusFilter(opt.key)}
                  className="sr-only"
                />
                <span className={`w-2.5 h-2.5 rounded-sm border ${
                  statusFilters[opt.key] ? 'bg-current border-current' : 'border-slate-700'
                }`} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Results Table */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <Loader className="w-6 h-6 animate-spin text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Loading Grievances...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-650 gap-2 border border-dashed border-slate-800 rounded-xl">
              <AlertCircle className="w-8 h-8 text-slate-600 mb-1" />
              <p className="text-xs font-bold text-slate-400">No matching records found</p>
              <p className="text-[10px] text-slate-600">Try adjusting your search criteria or status filters.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" id="all-grievances-table">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-550 uppercase tracking-widest bg-slate-950/20">
                      <th className="py-4 px-4 w-14">ID</th>
                      <th className="py-4 px-4">Title</th>
                      <th className="py-4 px-4">Department</th>
                      <th className="py-4 px-4">State</th>
                      <th className="py-4 px-4">Date Filed</th>
                      <th className="py-4 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-xs">
                    {tickets.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-900/40 transition-colors font-medium">
                        <td className="py-4 px-4 font-mono text-[10px] text-slate-500 font-bold">
                          #T-{row.id}
                        </td>
                        <td className="py-4 px-4 text-slate-200">
                          {row.title}
                        </td>
                        <td className="py-4 px-4 text-slate-400 font-semibold">
                          {getDepartmentName(row.assigned_department_id)}
                        </td>
                        <td className="py-4 px-4">
                          {getStatusBadge(row.status)}
                          {row.sla_violated && (
                            <span className="ml-1 px-1.5 py-0.5 bg-rose-950/60 text-rose-400 border border-rose-800/50 text-[8px] font-extrabold uppercase rounded-full">SLA</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-slate-500">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {row.status === 'resolved' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {row.has_proof ? (
                                <button
                                  onClick={() => handleViewProof(row.id)}
                                  disabled={loadingProof}
                                  className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-950/80 border border-emerald-900/30 text-emerald-450 hover:text-emerald-400 rounded-lg text-[10px] font-bold tracking-wide transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  View Proof & Report
                                </button>
                              ) : (
                                <>
                                  {row.proof_requested_at ? (
                                    <span className="px-3 py-1.5 bg-amber-950/30 border border-amber-900/20 text-amber-500 rounded-lg text-[10px] font-bold tracking-wide inline-flex items-center gap-1 select-none animate-pulse">
                                      <Clock className="w-3.5 h-3.5" />
                                      Proof Requested — Awaiting
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleRequestProof(row.id)}
                                      disabled={requestingProof === row.id}
                                      className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-lg text-[10px] font-extrabold tracking-wide transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shadow-lg shadow-rose-500/15 animate-pulse hover:animate-none"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      {requestingProof === row.id ? 'Sending...' : 'Request Resolution Proof'}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-650 font-bold italic select-none">Pending closure</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Showing page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-lg disabled:opacity-30 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          page === pageNum
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-lg disabled:opacity-30 transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Proof Modal */}
      {proofModalOpen && selectedProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setProofModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="flex items-center gap-2 text-emerald-400 font-bold border-b border-slate-800/60 pb-3">
              <CheckCircle2 className="w-5 h-5 animate-pulse" />
              <h3 className="text-base font-black">Resolution Proof Gallery</h3>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <h4 className="text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Grievance Title</h4>
                <p className="text-xs font-bold text-slate-200">{selectedProof.title}</p>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Closure Remarks</h4>
                <p className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-slate-300 text-xs whitespace-pre-line leading-relaxed">
                  {selectedProof.remarks || 'No resolution remarks were recorded.'}
                </p>
              </div>

              {selectedProof.attachments && selectedProof.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Proof Media ({selectedProof.attachments.length})</h4>
                  <div className="space-y-4">
                    {selectedProof.attachments.map((att) => {
                      const fullUrl = `http://localhost:8000${att.file_path}`;
                      return (
                        <div key={att.id} className="relative bg-slate-950/60 border border-slate-850 rounded-xl overflow-hidden p-4 flex flex-col items-center justify-center min-h-[160px]">
                          {att.file_type === 'photo' ? (
                            <img src={fullUrl} alt="Resolution Proof" className="max-h-[220px] object-contain rounded-lg shadow-md border border-slate-850" />
                          ) : att.file_type === 'video' ? (
                            <video src={fullUrl} controls className="max-h-[220px] w-full rounded-lg shadow-md border border-slate-850" />
                          ) : att.file_type === 'audio' ? (
                            <div className="flex flex-col items-center justify-center p-4 w-full gap-2 bg-slate-900/40 rounded-lg border border-slate-850">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Audio Clip</span>
                              <audio src={fullUrl} controls className="w-full" />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllGrievances;
