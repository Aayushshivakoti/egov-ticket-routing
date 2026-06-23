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

// Create a custom SVG icon for markers to support dynamic colors
const createCustomIcon = (color) => {
  const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="white"></circle>
    </svg>
  `;
  
  return L.divIcon({
    className: 'custom-pin',
    html: svgTemplate,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

const AdminMapDashboard = ({ tickets, departments, getDepartmentName, getPriorityBadge, getStatusBadge }) => {
  // Filter tickets with valid coordinates and not resolved
  const activeMapTickets = tickets.filter(
    t => t.latitude !== null && t.longitude !== null && t.status !== 'resolved'
  );

  const [mapCenter, setMapCenter] = useState([27.7172, 85.3240]); // Kathmandu default

  useEffect(() => {
    if (activeMapTickets.length > 0) {
      // Calculate center based on all points if desired, or just use default.
      // For simplicity, sticking to Kathmandu or the first ticket's location.
      const first = activeMapTickets[0];
      setMapCenter([first.latitude, first.longitude]);
    }
  }, [activeMapTickets.length]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h2 className="font-extrabold text-base text-slate-200">Live Spatial Dashboard</h2>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Water</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Electricity</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Waste</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Roads</span>
        </div>
      </div>

      <div className="h-[450px] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-xl relative z-0">
        <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {/* Render individual pins */}
          {activeMapTickets.map((ticket) => {
            const deptName = getDepartmentName ? getDepartmentName(ticket.assigned_department_id) : 'Unassigned';
            const color = getDeptColor(deptName);
            
            return (
              <Marker 
                key={ticket.id} 
                position={[ticket.latitude, ticket.longitude]}
                icon={createCustomIcon(color)}
              >
                <Popup className="custom-popup">
                  <div className="p-1 space-y-2 min-w-[200px]">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[10px] font-mono font-bold text-slate-500">#T-{ticket.id}</span>
                      {getPriorityBadge && getPriorityBadge(ticket.priority)}
                    </div>
                    <h3 className="font-bold text-sm text-slate-800 leading-tight">{ticket.title}</h3>
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
          
          {/* Simple Density Representation (Heatmap abstraction) */}
          {activeMapTickets.map((ticket) => {
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
        
        {activeMapTickets.length === 0 && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center text-slate-400 gap-3">
            <MapPin className="w-10 h-10 text-slate-600" />
            <p className="text-sm font-bold uppercase tracking-widest">No Active Geolocation Data</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMapDashboard;
