import React from 'react';
import { useNavigate } from 'react-router';
import { ShieldAlert, Home, FileText, Activity, LogIn, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between font-sans text-slate-800">
      {/* Civic Top Navigation Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
              <img src="/assets/pianing-logo.png" alt="Barangay Pianing" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 block leading-tight">Barangay Pianing</span>
              <span className="text-[11px] text-slate-500 font-medium">Smart Public Health &amp; Civic Governance Portal</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer hidden sm:flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> Back to Homepage
          </Button>
        </div>
      </header>

      {/* Main 404 Display Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm text-center">
          {/* Badge Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 mb-6 shadow-xs">
            <ShieldAlert size={32} />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold tracking-wide uppercase mb-3">
            HTTP Error 404
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-500 mb-2 font-medium">
            Hindi Matagpuan ang Hinahanap na Pahina
          </p>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-8 max-w-md mx-auto">
            The municipal link, document tracking path, or portal address you followed does not exist or has been relocated to a secure URL.
          </p>

          {/* Quick Action Navigation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6 text-left">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 rounded-xl transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Home size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block group-hover:text-blue-700">Official Homepage</span>
                <span className="text-[10.5px] text-slate-500">Public announcements &amp; info</span>
              </div>
            </button>

            <button
              onClick={() => navigate('/resident/barangay')}
              className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 rounded-xl transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileText size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block group-hover:text-emerald-700">Barangay Portal</span>
                <span className="text-[10.5px] text-slate-500">Civil documents &amp; clearances</span>
              </div>
            </button>

            <button
              onClick={() => navigate('/resident/health')}
              className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 rounded-xl transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Activity size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block group-hover:text-rose-700">Health Center</span>
                <span className="text-[10.5px] text-slate-500">Clinic schedules &amp; appointments</span>
              </div>
            </button>

            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 rounded-xl transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                <LogIn size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block group-hover:text-slate-900">Sign In</span>
                <span className="text-[10.5px] text-slate-500">Resident &amp; Official portal</span>
              </div>
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            Republic of the Philippines &bull; City of Butuan &bull; Barangay Pianing
          </p>
        </div>
      </main>

      {/* Official Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Barangay Pianing Management System &bull; All Rights Reserved.
      </footer>
    </div>
  );
}
