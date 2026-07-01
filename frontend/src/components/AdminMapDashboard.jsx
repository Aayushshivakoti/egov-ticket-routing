import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Info, AlertTriangle, Layers } from 'lucide-react';

// Department color mapping
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

// Create a custom SVG icon for markers to support dynamic colors and master case badge
const createCustomIcon = (color, isMaster = false, childCount = 0, priority = '') => {
  const isHigh = priority === 'high' || priority === 'critical';
  let htmlTemplate = '';
  
  const pulseClass = isHigh ? 'animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;' : '';
  const shadowClass = isHigh ? `filter: drop-shadow(0 0 6px ${color});` : '';

  if (isMaster && childCount > 0) {
    htmlTemplate = `
      <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; display: inline-flex; height: 32px; width: 32px; border-radius: 9999px; background-color: ${color}; opacity: 0.45; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: relative; z-index: 10; ${shadowClass}">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3" fill="white"></circle>
        </svg>
        <span style="position: absolute; top: -4px; right: -4px; background-color: #ef4444; border: 1.5px solid white; color: white; border-radius: 9999px; width: 17px; height: 17px; font-size: 8px; font-weight: 900; display: flex; align-items: center; justify-content: center; z-index: 100;" class="shadow-md">
          ${childCount + 1}
        </span>
      </div>
    `;
    return L.divIcon({
      className: 'custom-pin-master',
      html: htmlTemplate,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  } else {
    htmlTemplate = `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        ${isHigh ? `<span style="position: absolute; display: inline-flex; height: 24px; width: 24px; border-radius: 9999px; background-color: ${color}; opacity: 0.55; ${pulseClass}"></span>` : ''}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: relative; z-index: 10; ${shadowClass}">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3" fill="white"></circle>
        </svg>
      </div>
    `;
    return L.divIcon({
      className: 'custom-pin',
      html: htmlTemplate,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -24],
    });
  }
};

const AdminMapDashboard = ({ tickets, departments, getDepartmentName, getPriorityBadge, getStatusBadge }) => {
  // Filter active, non-resolved tickets with coordinates. 
  // Exclude child tickets so overlapping duplicates are consolidated under the Master Ticket.
  const activeMapTickets = tickets.filter(
    t => t.latitude !== null && t.longitude !== null && t.status !== 'resolved' && !t.parent_ticket_id
  );

  const [mapCenter, setMapCenter] = useState([27.7172, 85.3240]); // Kathmandu default
  
  // Dynamic Map Filters State
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamically Filtered Tickets
  const filteredTickets = activeMapTickets.filter(t => {
    if (selectedDepartment && String(t.assigned_department_id) !== String(selectedDepartment)) return false;
    if (selectedPriority && t.priority !== selectedPriority) return false;
    if (searchQuery) {
      const matchQuery = searchQuery.toLowerCase();
      const inTitle = t.title.toLowerCase().includes(matchQuery);
      const inDesc = t.description.toLowerCase().includes(matchQuery);
      if (!inTitle && !inDesc) return false;
    }
    return true;
  });

  useEffect(() => {
    if (filteredTickets.length > 0) {
      const first = filteredTickets[0];
      setMapCenter([first.latitude, first.longitude]);
    }
  }, [filteredTickets.length]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h2 className="font-extrabold text-base text-slate-200">Live Spatial Dashboard</h2>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Water</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Electricity</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Waste</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Roads</span>
        </div>
      </div>

      <div className="h-[480px] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-xl relative z-0">
        
        {/* Floating Glass Filter Card overlay */}
        <div className="absolute top-4 left-4 z-[1000] backdrop-blur-md bg-slate-900/80 border border-slate-800 rounded-xl p-3 w-64 shadow-2xl flex flex-col gap-2.5 text-left select-none">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Map Filter Control</span>
            <button 
              onClick={() => { setSelectedDepartment(''); setSelectedPriority(''); setSearchQuery(''); }} 
              className="text-[8px] font-black uppercase text-blue-400 hover:text-blue-300"
            >
              Reset
            </button>
          </div>
          
          {/* Keyword Search */}
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by keywords..."
            className="w-full text-[11px] bg-slate-950/60 border border-slate-850 rounded-lg px-2 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-700"
          />
          
          {/* Department Selection */}
          <div className="flex flex-col gap-1">
            <label className="text-[8px] font-extrabold uppercase text-slate-500 tracking-wider">Department</label>
            <select 
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
              className="bg-slate-950/60 border border-slate-850 rounded-lg px-1.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-slate-700 w-full"
            >
              <option value="">All Departments</option>
              {departments && departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          
          {/* Priority Levels */}
          <div className="flex flex-col gap-1">
            <label className="text-[8px] font-extrabold uppercase text-slate-500 tracking-wider">Priority</label>
            <div className="flex gap-1">
              {['low', 'medium', 'high', 'critical'].map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPriority(selectedPriority === p ? '' : p)}
                  className={`px-1 py-0.5 rounded text-[8px] font-black uppercase transition-all flex-1 border ${
                    selectedPriority === p 
                      ? p === 'critical' || p === 'high' ? 'bg-red-950/40 text-red-400 border-red-800' : 'bg-blue-950/45 text-blue-400 border-blue-800'
                      : 'bg-slate-950/40 text-slate-500 border-slate-850 hover:border-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {/* Render individual pins */}
          {filteredTickets.map((ticket) => {
            const deptName = getDepartmentName ? getDepartmentName(ticket.assigned_department_id) : 'Unassigned';
            const color = getDeptColor(deptName);
            
            // Find child tickets linked to this Master Ticket
            const childList = tickets.filter(t => t.parent_ticket_id === ticket.id);
            const isMaster = childList.length > 0;
            
            return (
              <Marker 
                key={ticket.id} 
                position={[ticket.latitude, ticket.longitude]}
                icon={createCustomIcon(color, isMaster, childList.length, ticket.priority)}
              >
                <Popup className="custom-popup">
                  <div className="p-1 space-y-2 min-w-[220px] max-w-[280px]">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {isMaster ? 'Master Incident' : `#T-${ticket.id}`}
                      </span>
                      {getPriorityBadge && getPriorityBadge(ticket.priority)}
                    </div>
                    <h3 className="font-bold text-sm text-slate-850 leading-tight">{ticket.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{ticket.description}</p>
                    
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{deptName}</span>
                      {getStatusBadge && getStatusBadge(ticket.status)}
                    </div>

                    {/* Consolidated sub-tickets list */}
                    {isMaster && (
                      <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200">
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1 mb-1 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          Consolidated Area Case
                        </p>
                        <p className="text-[9px] text-slate-500 font-semibold mb-2">
                          Combines {childList.length + 1} duplicate complaints reported locally:
                        </p>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] space-y-0.5 font-sans border-l-2 border-l-rose-500">
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-slate-600">#T-{ticket.id} (Master)</span>
                              <span className="text-slate-400 text-[8px]">{new Date(ticket.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="font-semibold text-slate-800 truncate">{ticket.title}</p>
                          </div>
                          {childList.map(c => (
                            <div key={c.id} className="p-2 bg-slate-55 border border-slate-200 rounded-lg text-[10px] space-y-0.5 font-sans">
                              <div className="flex items-center justify-between font-bold">
                                <span className="text-slate-500">#T-{c.id}</span>
                                <span className="text-slate-400 text-[8px]">{new Date(c.created_at).toLocaleDateString()}</span>
                              </div>
                              <p className="font-semibold text-slate-700 truncate">{c.title}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
          
          {/* Simple Density Representation (Heatmap abstraction) */}
          {filteredTickets.map((ticket) => {
            const deptName = getDepartmentName ? getDepartmentName(ticket.assigned_department_id) : 'Unassigned';
            const color = getDeptColor(deptName);
            return (
              <CircleMarker
                key={`circle-${ticket.id}`}
                center={[ticket.latitude, ticket.longitude]}
                radius={30}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.1,
                  color: color,
                  weight: 0
                }}
              />
            );
          })}
        </MapContainer>
        
        {filteredTickets.length === 0 && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center text-slate-400 gap-3">
            <MapPin className="w-10 h-10 text-slate-600 animate-bounce" />
            <p className="text-sm font-bold uppercase tracking-widest">No Active Geolocation Matches</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMapDashboard;
