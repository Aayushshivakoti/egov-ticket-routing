import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Cpu, Loader } from 'lucide-react';

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center gap-4 text-slate-100">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center animate-pulse">
          <Cpu className="w-10 h-10 text-blue-500 animate-spin-slow" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          <Loader className="w-4 h-4 animate-spin text-blue-500" />
          <span>Synchronizing Session...</span>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <Login />;
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
