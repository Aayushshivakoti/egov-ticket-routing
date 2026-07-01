import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Inbox, Eye, Cpu, X, FileText, CheckCircle2, Loader, UserPlus, Bell, AlertTriangle, Trash2, Navigation, MapPin, MessageSquare, PlusCircle, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProofRequestsView from './ProofRequestsView';
import ClarificationModal from './ClarificationModal';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

// Department color mapping helper
const DEPT_COLORS = {
  'water': '#3b82f6', // blue
  'electricity': '#ef4444', // red
  'roads': '#f59e0b', // amber
  'waste': '#10b981', // emerald
  'default': '#8b5cf6' // purple
};

const getDeptColor = (deptName) => {
  if (!deptName) return DEPT_COLORS.default;
  const lower = deptName.toLowerCase();
  if (lower.includes('water')) return DEPT_COLORS.water;
  if (lower.includes('electric') || lower.includes('power')) return DEPT_COLORS.electricity;
  if (lower.includes('road') || lower.includes('transport')) return DEPT_COLORS.roads;
  if (lower.includes('waste') || lower.includes('sanitation')) return DEPT_COLORS.waste;
  return DEPT_COLORS.default;
};

// Create a custom SVG icon for markers with sequence numbers
const createNumberedIcon = (num, color) => {
  const htmlTemplate = `
    <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: relative; z-index: 10;">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      </svg>
      <span style="position: absolute; top: 4px; font-size: 10px; font-weight: 900; color: white; font-family: sans-serif; text-shadow: 0 1px 2px rgba(0,0,0,0.8); z-index: 20;">
        ${num}
      </span>
    </div>
  `;
  return L.divIcon({
    className: 'custom-numbered-pin',
    html: htmlTemplate,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

const createOperatorStartIcon = () => {
  const htmlTemplate = `
    <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
      <span style="position: absolute; display: inline-flex; height: 28px; width: 28px; border-radius: 9999px; background-color: #3b82f6; opacity: 0.55; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
      <div style="position: relative; z-index: 10; width: 14px; height: 14px; background-color: #3b82f6; border: 2.5px solid white; border-radius: 9999px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
    </div>
  `;
  return L.divIcon({
    className: 'custom-operator-start',
    html: htmlTemplate,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

const DeptAdminDashboard = ({ tickets, onRefresh, getPriorityBadge, getStatusBadge, getDepartmentName, statusFilter, view = 'overview' }) => {
  const { user } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Department Assigned Chats states
  const [assignedChats, setAssignedChats] = useState([]);
  const [loadingAssignedChats, setLoadingAssignedChats] = useState(true);
  const [activeDeptChat, setActiveDeptChat] = useState(null);
  const [deptChatInput, setDeptChatInput] = useState('');
  const [deptEscalateModal, setDeptEscalateModal] = useState(false);
  const [deptEscalateTitle, setDeptEscalateTitle] = useState('');

  const isDeptHead = user?.role === 'dept_admin' && user?.dept_role === 'Department Head';

  const fetchAssignedChats = async () => {
    if (!isDeptHead) return;
    try {
      const res = await api.get('/chat/dept/sessions');
      setAssignedChats(res.data);
      if (activeDeptChat) {
        const updated = res.data.find(s => s.id === activeDeptChat.id);
        if (updated) {
          setActiveDeptChat(updated);
        }
      }
    } catch (err) {
      console.error("Failed to load department assigned chats:", err);
    } finally {
      setLoadingAssignedChats(false);
    }
  };

  useEffect(() => {
    if (isDeptHead) {
      fetchAssignedChats();
      const interval = setInterval(fetchAssignedChats, 4000);
      return () => clearInterval(interval);
    }
  }, [activeDeptChat, isDeptHead]);

  const handleSendDeptMessage = async (e) => {
    e.preventDefault();
    if (!deptChatInput.trim() || !activeDeptChat) return;
    const text = deptChatInput;
    setDeptChatInput('');
    try {
      await api.post(`/chat/dept/sessions/${activeDeptChat.id}/message`, { message: text });
      fetchAssignedChats();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeptEscalate = async (e) => {
    e.preventDefault();
    if (!activeDeptChat) return;
    try {
      const res = await api.post(`/chat/dept/sessions/${activeDeptChat.id}/escalate`, {
        title: deptEscalateTitle || `Department Case: ${activeDeptChat.citizen_name}`
      });
      setDeptEscalateModal(false);
      setDeptEscalateTitle('');
      fetchAssignedChats();
      onRefresh(); // Refresh tickets list on department dashboard
      alert(`Formal Ticket #${res.data.id} opened successfully and routed!`);
    } catch (err) {
      console.error(err);
      alert("Failed to escalate chat session.");
    }
  };

  // Field Operator Route states
  const [routeTickets, setRouteTickets] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [userLocation, setUserLocation] = useState([27.7172, 85.3240]);
  const [hasLocation, setHasLocation] = useState(false);

  const isFieldOperator = user?.dept_role === 'Field Operator';

  const fetchRoute = async (lat, lng) => {
    setLoadingRoute(true);
    setRouteError(null);
    try {
      const res = await api.get(`/tickets/operator/route?lat=${lat}&lng=${lng}`);
      setRouteTickets(res.data);
    } catch (err) {
      console.error("Failed to load optimized route:", err);
      setRouteError("Failed to calculate optimized route.");
    } finally {
      setLoadingRoute(false);
    }
  };

  useEffect(() => {
    if (isFieldOperator) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setUserLocation([lat, lng]);
            setHasLocation(true);
            fetchRoute(lat, lng);
          },
          (err) => {
            console.warn("Geolocation warning:", err);
            fetchRoute(27.7172, 85.3240);
          }
        );
      } else {
        fetchRoute(27.7172, 85.3240);
      }
    }
  }, [user, tickets]);
  const [selectedClarificationTicket, setSelectedClarificationTicket] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusVal, setStatusVal] = useState('pending');
  const [remarksVal, setRemarksVal] = useState('');
  const [reportVal, setReportVal] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [updating, setUpdating] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [proofFiles, setProofFiles] = useState([]);

  // Department Head Personnel state
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Notification alerts state
  const [notifications, setNotifications] = useState([]);

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
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  const fetchDeptEmployees = async () => {
    if (!user?.department_id) return;
    setLoadingEmployees(true);
    try {
      const res = await api.get(`/departments/${user.department_id}/employees`);
      setEmployees(res.data);
    } catch (err) {
      console.error("Failed to load department employees:", err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    if (user?.dept_role === 'Department Head') {
      fetchDeptEmployees();
    }
    fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const res = await api.get('/tickets/notifications?category=proof_request');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleOpenModal = (ticket) => {
    setSelectedTicket(ticket);
    setStatusVal(ticket.status);
    setRemarksVal(ticket.remarks || '');
    setReportVal(ticket.report || '');
    setAssignedStaffId(ticket.assigned_employee_id || '');
    setActiveMediaIndex(0);
    setProofFiles([]);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedTicket(null);
    setProofFiles([]);
    setReportVal('');
    setAssignedStaffId('');
    setModalOpen(false);
  };

  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    if (statusVal === 'resolved') {
      if (!reportVal.trim()) {
        alert("A text resolution report is mandatory when status is set to Resolved.");
        return;
      }
      if (proofFiles.length === 0) {
        alert("Resolution proof is mandatory when status is set to Resolved. Please upload a media file.");
        return;
      }
    }

    setUpdating(true);

    try {
      if (user?.dept_role === 'Department Head') {
        await api.post(`/tickets/${selectedTicket.id}/assign`, {
          assigned_employee_id: assignedStaffId ? parseInt(assignedStaffId) : null
        });
      }

      const formData = new FormData();
      formData.append('status', statusVal);
      formData.append('remarks', remarksVal);
      if (statusVal === 'resolved') {
        formData.append('report', reportVal);
        proofFiles.forEach((file) => {
          formData.append('files', file);
        });
      }

      await api.put(`/tickets/${selectedTicket.id}/status`, formData);
      
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

  if (view === 'chats') {
    return (
      <div className="space-y-6">
        {/* Department Assigned Citizen Chats */}
        {isDeptHead && (
          <section className="p-6 bg-slate-900 border border-slate-800 rounded-2xl transition-all duration-300">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              <h2 className="font-extrabold text-base text-slate-200">Citizen Support Communications</h2>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-auto">
                {assignedChats.length} assigned threads
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
              {/* Chat list */}
              <div className="lg:col-span-1 border border-slate-855 rounded-xl overflow-y-auto bg-slate-950/20 divide-y divide-slate-855/60 p-2 space-y-2">
                {loadingAssignedChats ? (
                  <div className="flex items-center justify-center h-full text-slate-500 gap-2">
                    <Loader className="w-4 h-4 animate-spin text-indigo-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Loading Chats...</span>
                  </div>
                ) : assignedChats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2 text-center p-4">
                    <MessageSquare className="w-6 h-6 text-slate-655" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No assigned citizen chats</p>
                  </div>
                ) : (
                  assignedChats.map((session) => {
                    const isActive = activeDeptChat && activeDeptChat.id === session.id;
                    return (
                      <button
                        key={session.id}
                        onClick={() => setActiveDeptChat(session)}
                        className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 cursor-pointer border ${
                          isActive 
                            ? 'bg-indigo-950/20 border-indigo-500/50 shadow-md shadow-indigo-500/5' 
                            : 'bg-transparent border-transparent hover:bg-slate-900/40 hover:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">{session.citizen_name}</span>
                          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                            session.status === 'assigned' ? 'bg-blue-950/40 text-blue-400 border border-blue-900/30' :
                            session.status === 'escalated' ? 'bg-purple-950/40 text-purple-400 border border-purple-900/30' :
                            'bg-slate-900 text-slate-400'
                          }`}>
                            {session.status}
                          </span>
                        </div>
                        {session.associated_ticket_id && (
                          <p className="text-[9px] font-bold text-purple-400 font-mono">
                            Ticket: #T-{session.associated_ticket_id}
                          </p>
                        )}
                        <span className="text-[8px] text-slate-550 font-bold">
                          {new Date(session.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Chat Body */}
              <div className="lg:col-span-2 border border-slate-855 rounded-xl overflow-hidden bg-slate-950/10 flex flex-col h-full">
                {!activeDeptChat ? (
                  <div className="flex-grow flex flex-col justify-center items-center gap-2 text-slate-500 text-center p-6">
                    <MessageSquare className="w-8 h-8 text-slate-700 animate-pulse" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Select Chat Thread</h4>
                      <p className="text-[10px] text-slate-550 mt-1 max-w-xs">
                        Answer citizen questions in real-time or escalate the chat to a formal grievance ticket.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full justify-between">
                    <div className="p-3 bg-slate-900/60 border-b border-slate-850 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{activeDeptChat.citizen_name}</h4>
                        <p className="text-[9px] font-semibold text-slate-500 mt-0.5">Session: {activeDeptChat.session_token.slice(0, 8)}...</p>
                      </div>

                      {activeDeptChat.status !== 'escalated' && (
                        <button
                          onClick={() => {
                            setDeptEscalateTitle(`Department Escalation: ${activeDeptChat.citizen_name}`);
                            setDeptEscalateModal(true);
                          }}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-bold transition-all shadow-md cursor-pointer flex items-center gap-1"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Escalate to Case</span>
                        </button>
                      )}
                    </div>

                    {/* Messages list */}
                    <div className="flex-grow p-4 overflow-y-auto space-y-3 bg-slate-950/20">
                      {activeDeptChat.messages && activeDeptChat.messages.map((msg) => {
                        const isDept = msg.sender_role === "admin" || msg.sender_role === "department";
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col max-w-[80%] ${isDept ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                          >
                            <span className="text-[8px] text-slate-505 font-bold uppercase mb-1">
                              {msg.sender_name} ({msg.sender_role})
                            </span>
                            <div
                              className={`p-3 rounded-2xl text-xs leading-relaxed ${
                                isDept
                                  ? 'bg-gradient-to-br from-indigo-600 to-purple-650 text-white rounded-tr-none'
                                  : 'bg-slate-855 border border-slate-800 text-slate-200 rounded-tl-none'
                              }`}
                            >
                              {msg.message}
                            </div>
                            <span className="text-[8px] text-slate-600 mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <form onSubmit={handleSendDeptMessage} className="p-3 border-t border-slate-855 bg-slate-900/30 flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Type reply to citizen..."
                        value={deptChatInput}
                        onChange={(e) => setDeptChatInput(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-955 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 text-xs"
                      />
                      <button
                        type="submit"
                        className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center"
                      >
                        <Send className="w-4 h-4 text-white" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Dept Escalation Modal */}
        {deptEscalateModal && activeDeptChat && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-955/80 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
            <div className="w-full max-w-md bg-slate-900 border border-slate-855 rounded-2xl p-6 shadow-2xl space-y-4 relative">
              <button
                onClick={() => setDeptEscalateModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-505 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 text-purple-400 font-bold border-b border-slate-800/60 pb-3">
                <PlusCircle className="w-5 h-5 animate-pulse" />
                <h3 className="text-base font-black">Escalate Chat to Ticket</h3>
              </div>

              <form onSubmit={handleDeptEscalate} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Grievance Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Broken Water Main Line"
                    value={deptEscalateTitle}
                    onChange={(e) => setDeptEscalateTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-205 placeholder-slate-650 focus:outline-none focus:border-purple-500 text-xs font-semibold"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-purple-500/10 cursor-pointer"
                >
                  Create Formal Case & Dispatch
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Alerts for Department Head */}
      {notifications.length > 0 && (
        <section className="p-5 bg-gradient-to-r from-amber-950/20 to-slate-900 border border-amber-900/30 rounded-2xl">
          <div className="flex items-center gap-2 mb-3 border-b border-amber-900/20 pb-2">
            <Bell className="w-5 h-5 text-amber-400 animate-pulse" />
            <h2 className="font-extrabold text-sm text-amber-300 uppercase tracking-wider">Proof Request Alerts</h2>
            <span className="ml-auto px-2 py-0.5 bg-amber-600 text-white text-[9px] font-extrabold rounded-full">{notifications.filter(n => !n.is_read).length}</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {notifications.filter(n => !n.is_read).map((notif) => (
              <div key={notif.id} className="flex items-start gap-3 p-3 bg-slate-950/40 border border-amber-900/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-200 font-medium leading-relaxed">{notif.message}</p>
                  <p className="text-[9px] text-slate-500 font-semibold mt-1">
                    {new Date(notif.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {notif.ticket_id && (
                  <span className="text-[9px] font-mono font-bold text-amber-500 whitespace-nowrap">#T-{notif.ticket_id}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Field Operator Optimized Navigation Route Panel */}
      {isFieldOperator && routeTickets.length > 0 && (
        <section className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-400 animate-pulse" />
              <h2 className="font-extrabold text-base text-slate-200">Your Optimized Service Route (TSP)</h2>
            </div>
            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 border border-slate-850 rounded-xl">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
              {routeTickets.filter(t => t.latitude !== null && t.longitude !== null).length} stops
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map Column */}
            <div className="lg:col-span-2 h-[380px] rounded-xl overflow-hidden border border-slate-800 relative z-0">
              <MapContainer center={userLocation} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {/* Operator Start Point */}
                <Marker position={userLocation} icon={createOperatorStartIcon()}>
                  <Popup>
                    <div className="p-1 font-sans text-xs">
                      <p className="font-bold text-slate-800">Your Starting Point</p>
                      <p className="text-slate-500 mt-0.5">{hasLocation ? "Accurate Geolocation" : "Kathmandu Center (Fallback)"}</p>
                    </div>
                  </Popup>
                </Marker>

                {/* Route Tickets Pins */}
                {routeTickets.filter(t => t.latitude !== null && t.longitude !== null).map((ticket, index) => {
                  const deptName = getDepartmentName ? getDepartmentName(ticket.assigned_department_id) : 'Unassigned';
                  const color = getDeptColor(deptName);
                  return (
                    <Marker
                      key={`route-pin-${ticket.id}`}
                      position={[ticket.latitude, ticket.longitude]}
                      icon={createNumberedIcon(index + 1, color)}
                    >
                      <Popup className="custom-popup">
                        <div className="p-1 space-y-2 min-w-[200px] max-w-[240px]">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-[10px] font-mono font-bold text-slate-500">Stop #{index + 1} • #T-{ticket.id}</span>
                            {getPriorityBadge && getPriorityBadge(ticket.priority)}
                          </div>
                          <h3 className="font-bold text-sm text-slate-850 leading-tight">{ticket.title}</h3>
                          <p className="text-xs text-slate-600 line-clamp-2">{ticket.description}</p>
                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{deptName}</span>
                            {getStatusBadge && getStatusBadge(ticket.status)}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Draw Dotted Route Connection Lines */}
                <Polyline
                  positions={[
                    userLocation,
                    ...routeTickets.filter(t => t.latitude !== null && t.longitude !== null).map(t => [t.latitude, t.longitude])
                  ]}
                  color="#3b82f6"
                  weight={3.5}
                  dashArray="6, 12"
                />
              </MapContainer>
            </div>

            {/* List Column */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              <p className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider text-left">Navigation Sequence</p>
              <div className="space-y-2.5">
                {routeTickets.map((ticket, index) => {
                  const hasCoords = ticket.latitude !== null && ticket.longitude !== null;
                  const deptName = getDepartmentName ? getDepartmentName(ticket.assigned_department_id) : 'Unassigned';
                  const color = getDeptColor(deptName);
                  
                  return (
                    <div 
                      key={`seq-${ticket.id}`} 
                      className={`p-3 bg-slate-950 border border-slate-855 rounded-xl flex items-center gap-3 hover:border-slate-800 transition-all ${
                        !hasCoords ? 'opacity-55' : ''
                      }`}
                    >
                      {hasCoords ? (
                        <div 
                          className="w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center border shrink-0 shadow-sm"
                          style={{ backgroundColor: `${color}15`, borderColor: color, color: color }}
                        >
                          {index + 1}
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-855 text-slate-600 flex items-center justify-center shrink-0">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                      )}
                      
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-mono text-slate-500 font-bold">#T-{ticket.id}</span>
                          {getPriorityBadge && getPriorityBadge(ticket.priority)}
                        </div>
                        <p className="font-bold text-xs text-slate-200 truncate mt-0.5">{ticket.title}</p>
                        <p className="text-[9px] text-slate-500 font-semibold truncate mt-0.5">{ticket.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-400" />
            <h2 className="font-extrabold text-lg text-slate-200" id="admin-table-title">
              {statusFilter === 'pending' ? 'Pending Assignments' : 
               statusFilter === 'in-progress' ? 'In-Progress Cases' : 
               statusFilter === 'resolved' ? 'Resolved Cases' : 
               'Incoming Grievances Log'}
            </h2>
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
                {tickets.filter(t => t.status !== 'Under Re-evaluation').map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-900/60 transition-colors admin-ticket-row">
                    <td className="py-4 px-4 font-mono font-bold text-xs text-slate-400">
                      #T-{ticket.id}
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-bold text-slate-200">{ticket.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                      {ticket.reasoning_keywords && ticket.reasoning_keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                          <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-purple-400" /> Routing Keywords:
                          </span>
                          {ticket.reasoning_keywords.map((k) => (
                            <span key={k} className="px-1.5 py-0.5 bg-purple-950/40 text-purple-400 border border-purple-900/30 rounded text-[9px] font-mono font-bold">
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
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
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(ticket)}
                          className="px-3 py-1.5 bg-slate-950 border border-slate-850 hover:bg-slate-850 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all admin-view-btn"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Resolve Case
                        </button>
                        <button
                          onClick={() => handleDeleteTicket(ticket.id)}
                          className="px-2 py-1.5 bg-rose-950/20 border border-rose-900/30 hover:bg-rose-900/40 text-rose-400 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
                          title="Delete Ticket"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

              {selectedTicket.reasoning_keywords && selectedTicket.reasoning_keywords.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                    Explainable AI (XAI) Routing Diagnosis
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {selectedTicket.reasoning_keywords.map((k) => (
                      <span key={k} className="px-2.5 py-1 bg-purple-950/40 text-purple-400 border border-purple-800/40 rounded-xl text-xs font-mono font-bold tracking-wide">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                <div className="border-t border-slate-800 pt-4 mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Evidence Attachments ({selectedTicket.attachments.length})
                  </h4>
                  <div className="relative bg-slate-950/60 border border-slate-850 rounded-xl overflow-hidden p-4 flex flex-col items-center justify-center min-h-[220px]">
                    {(() => {
                      const att = selectedTicket.attachments[activeMediaIndex];
                      const fullUrl = `http://localhost:8000${att.file_path}`;
                      return (
                        <div className="w-full flex flex-col items-center relative">
                          {att.is_proof && (
                            <span className="absolute top-2 right-2 px-2.5 py-1 bg-emerald-950/80 text-emerald-450 border border-emerald-800/40 text-[9px] font-extrabold uppercase rounded-lg z-10 select-none">
                              Resolution Proof
                            </span>
                          )}
                          {att.file_type === 'photo' ? (
                            <img 
                              src={fullUrl} 
                              alt="Attachment" 
                              className="max-h-[260px] object-contain rounded-lg shadow-md border border-slate-850"
                            />
                          ) : att.file_type === 'video' ? (
                            <video 
                              src={fullUrl} 
                              controls 
                              className="max-h-[260px] w-full rounded-lg shadow-md border border-slate-850"
                            />
                          ) : att.file_type === 'audio' ? (
                            <div className="flex flex-col items-center justify-center p-6 w-full gap-3 bg-slate-900/40 rounded-lg border border-slate-850">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Audio Evidence clip</span>
                              <audio 
                                src={fullUrl} 
                                controls 
                                className="w-full max-w-md"
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}

                    {selectedTicket.attachments.length > 1 && (
                      <>
                        <button 
                          type="button"
                          onClick={() => setActiveMediaIndex((prev) => (prev === 0 ? selectedTicket.attachments.length - 1 : prev - 1))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-slate-950/80 hover:bg-slate-850 border border-slate-850 rounded-full text-slate-300 hover:text-slate-100 transition-all cursor-pointer font-bold"
                        >
                          &larr;
                        </button>
                        <button 
                          type="button"
                          onClick={() => setActiveMediaIndex((prev) => (prev === selectedTicket.attachments.length - 1 ? 0 : prev + 1))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-950/80 hover:bg-slate-850 border border-slate-850 rounded-full text-slate-300 hover:text-slate-100 transition-all cursor-pointer font-bold"
                        >
                          &rarr;
                        </button>
                      </>
                    )}
                  </div>

                  {selectedTicket.attachments.length > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      {selectedTicket.attachments.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveMediaIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-all ${idx === activeMediaIndex ? 'bg-blue-500 scale-125' : 'bg-slate-700 hover:bg-slate-500'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                  <div className="sm:col-span-1 space-y-3">
                    <div>
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
                        <option value="Under Re-evaluation">Under Re-evaluation</option>
                      </select>
                    </div>

                    {user?.dept_role === 'Department Head' && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2" htmlFor="modal-assignee">
                          Assign Officer / Staff
                        </label>
                        <select
                          id="modal-assignee"
                          value={assignedStaffId}
                          onChange={(e) => setAssignedStaffId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 transition-all text-xs font-semibold"
                        >
                          <option value="">Unassigned</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.dept_role || 'Staff'})</option>
                          ))}
                        </select>
                      </div>
                    )}
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
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 transition-all text-xs h-28 resize-none"
                    />
                  </div>
                </div>

                {statusVal === 'resolved' && (
                  <div className="pt-2 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Resolution Text Report (Mandatory)
                      </label>
                      <textarea
                        placeholder="Provide a detailed text report explaining the resolution steps..."
                        value={reportVal}
                        onChange={(e) => setReportVal(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 transition-all text-xs h-20 resize-none font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Resolution Media Proof (Mandatory)
                      </label>
                      <div className="p-4 bg-slate-950 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-500/50 transition-all relative">
                        <input
                          id="proof-upload-input"
                          type="file"
                          multiple
                          onChange={(e) => {
                            if (e.target.files) {
                              setProofFiles(Array.from(e.target.files));
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          required
                          accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/mp4,audio/m4a"
                        />
                        <FileText className="w-8 h-8 text-blue-500 animate-pulse" />
                        <p className="text-xs text-slate-300 font-bold text-center">
                          Drag & drop or click to upload proof
                        </p>
                        <p className="text-[10px] text-slate-500 text-center font-medium">
                          Supported: Images, MP4/MOV Videos, MP3/WAV/M4A Audios
                        </p>
                      </div>
                    </div>
                    {proofFiles.length > 0 && (
                      <div className="mt-3 bg-slate-950/40 border border-slate-850 p-3 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Selected Proof Files</span>
                        {proofFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between text-xs text-slate-350 bg-slate-900 border border-slate-800/60 px-3 py-1.5 rounded-lg">
                            <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono">{(file.size / 1024).toFixed(0)} KB</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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

      {/* Department Head Personnel Panel */}
      {user?.dept_role === 'Department Head' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
            <UserPlus className="w-5 h-5 text-emerald-400" />
            <h2 className="font-extrabold text-base text-slate-200">Department Staff Management</h2>
          </div>
          {loadingEmployees ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
              <Loader className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-[9px] font-bold uppercase tracking-widest">Loading Personnel...</span>
            </div>
          ) : employees.length === 0 ? (
            <p className="text-xs text-slate-500">No other employees in this department.</p>
          ) : (
            <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-950/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-950/40 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="py-2.5 px-3">Name & Email</th>
                    <th className="py-2.5 px-3">Employee ID</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-855/60 text-xs">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-950/10">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-200">{emp.name}</p>
                        <p className="text-[10px] text-slate-505">{emp.email}</p>
                      </td>
                      <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                        {emp.employee_id_or_passport || 'N/A'}
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={emp.dept_role || ''}
                          onChange={async (e) => {
                            try {
                              const res = await api.put(`/departments/employees/${emp.id}/role`, {
                                dept_role: e.target.value
                              });
                              alert(res.data.detail || 'Role change requested!');
                              fetchDeptEmployees();
                            } catch (err) {
                              alert(err.response?.data?.detail || 'Failed to request role change.');
                            }
                          }}
                          className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-350 focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">Select Role</option>
                          <option value="Department Head">Department Head</option>
                          <option value="Field Operator">Field Operator</option>
                          <option value="Support Rep">Support Rep</option>
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full ${
                          emp.status === 'active' ? 'bg-emerald-950/40 text-emerald-450 border border-emerald-900/40' : 'bg-rose-950/40 text-rose-455 border border-rose-900/40'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500 italic">
                        Approval Pipeline Active
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Reopened Cases Panel */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="font-extrabold text-lg text-slate-200">Reopened Cases (Clarification Required)</h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{tickets.filter(t => t.status === 'Under Re-evaluation').length} case(s)</span>
        </div>

        {tickets.filter(t => t.status === 'Under Re-evaluation').length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600 border border-dashed border-slate-800 rounded-xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-xs font-bold text-emerald-400">All Clear</p>
            <p className="text-[10px] text-slate-600 mt-1">No reopened cases requiring clarification.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tickets.filter(t => t.status === 'Under Re-evaluation').map((t) => (
              <div key={t.id} className="border border-slate-800 bg-slate-950 rounded-xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-1">Ticket #T-{t.id}</span>
                    <h3 className="font-bold text-sm text-slate-200">{t.title}</h3>
                  </div>
                  <button 
                    onClick={() => setSelectedClarificationTicket(t)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    View & Respond
                  </button>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{t.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Citizen Proof Requests Tracking */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mt-6">
        <ProofRequestsView />
      </section>

      {selectedClarificationTicket && (
        <ClarificationModal
          ticket={selectedClarificationTicket}
          onClose={() => setSelectedClarificationTicket(null)}
          onRefresh={onRefresh}
          currentUserRole="dept_admin"
        />
      )}
    </div>
  );
};

export default DeptAdminDashboard;
