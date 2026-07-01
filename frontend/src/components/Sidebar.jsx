import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, AlertCircle, Play, CheckCircle2, 
  LogOut, Cpu, User, Map, MessageSquare, Building2
} from 'lucide-react';

const Sidebar = ({ user, logout }) => {
  const menuItems = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard, exact: true },
    { name: 'Total Reports', path: '/admin/reports/total', icon: FileText },
    { name: 'Pending Assign', path: '/admin/reports/pending', icon: AlertCircle, color: 'text-yellow-400' },
    { name: 'In Progress', path: '/admin/reports/in-progress', icon: Play, color: 'text-blue-400' },
    { name: 'Resolved', path: '/admin/reports/resolved', icon: CheckCircle2, color: 'text-emerald-400' },
  ];

  if (user?.role === 'super_admin' || user?.dept_role === 'Department Head') {
    menuItems.push({ name: 'Live Support Chat', path: '/admin/chats', icon: MessageSquare, color: 'text-indigo-400' });
  }

  if (user?.role === 'super_admin') {
    menuItems.push({ name: 'Departments & Staff', path: '/admin/departments', icon: Building2, color: 'text-teal-400' });
  }

  return (
    <aside className="w-64 bg-slate-900/60 border-r border-slate-800 backdrop-blur-md flex flex-col justify-between h-screen sticky top-0 shrink-0 z-30 select-none">
      {/* Brand Logo & Name */}
      <div className="p-6 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-blue-600 to-emerald-500 rounded-lg shadow-md shadow-blue-500/10 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm leading-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              E-Gov Helpdesk
            </h1>
            <p className="text-[9px] text-slate-500 tracking-wider font-semibold uppercase">
              Control Panel
            </p>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
            <User className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-left overflow-hidden">
            <p className="text-xs font-bold text-slate-200 truncate">{user?.name}</p>
            <p className="text-[9px] text-slate-500 font-extrabold uppercase truncate tracking-wide">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-1.5 mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.exact}
                className={({ isActive }) => `relative flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 border overflow-hidden select-none hover:scale-[1.02] active:scale-[0.98] ${
                  isActive 
                    ? 'bg-slate-800/90 border-slate-750/80 text-white shadow-md shadow-blue-500/5' 
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 hover:border-slate-800'
                }`}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-blue-500 to-emerald-400 rounded-r-lg shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                    )}
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-blue-400' : (item.color || 'text-slate-400')}`} />
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Logout Footer Button */}
      <div className="p-6 border-t border-slate-800">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 bg-slate-950/40 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-900/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
