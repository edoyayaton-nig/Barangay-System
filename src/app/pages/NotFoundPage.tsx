import React from 'react';
import { useNavigate } from 'react-router';
import { ShieldAlert, Home, FileText, Activity, LogIn, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F5F8FA] flex flex-col justify-between font-sans text-[#1C2B36]">
      {/* Civic Top Navigation Header */}
      <header className="bg-white border-b border-[#D5E2E8] px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white border border-[#D5E2E8] shadow-xs flex items-center justify-center shrink-0">
              <img src="/assets/pianing-logo.png" alt="Barangay Pianing" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-sm font-bold text-[#1C2B36] block leading-tight">Barangay Pianing</span>
              <span className="text-[11px] text-[#526374] font-medium">Smart Public Health &amp; Civic Governance Portal</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="text-xs font-semibold text-[#1C2B36] border-[#D5E2E8] hover:bg-[#E9F4F2] hover:border-[#006B66] hover:text-[#006B66] cursor-pointer hidden sm:flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Homepage
          </Button>
        </div>
      </header>

      {/* Main 404 Display Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full bg-white border border-[#D5E2E8] rounded-3xl p-8 sm:p-10 shadow-sm text-center">
          {/* Badge Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#E9F4F2] border border-[#006B66]/30 flex items-center justify-center text-[#006B66] mb-6 shadow-xs">
            <ShieldAlert size={32} />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D8A443]/20 border border-[#D8A443]/40 text-[#915500] text-[11px] font-bold tracking-wide uppercase mb-3">
            HTTP Error 404
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2B36] tracking-tight mb-2">
            Page Not Found
          </h1>
          <p className="text-sm text-[#526374] mb-2 font-medium">
            Hindi Matagpuan ang Hinahanap na Pahina
          </p>
          <p className="text-xs sm:text-sm text-[#526374] leading-relaxed mb-8 max-w-md mx-auto">
            The municipal link, document tracking path, or portal address you followed does not exist or has been relocated to a secure URL.
          </p>

          {/* Quick Action Navigation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6 text-left">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 p-3 bg-[#F5F8FA] hover:bg-[#E9F4F2]/70 border border-[#D5E2E8] hover:border-[#173B5E]/40 rounded-xl transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#173B5E] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Home size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1C2B36] block group-hover:text-[#173B5E]">Official Homepage</span>
                <span className="text-[10.5px] text-[#526374]">Public announcements &amp; info</span>
              </div>
            </button>

            <button
              onClick={() => navigate('/resident/barangay')}
              className="flex items-center gap-3 p-3 bg-[#F5F8FA] hover:bg-[#E9F4F2]/70 border border-[#D5E2E8] hover:border-[#006B66]/40 rounded-xl transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#006B66] text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileText size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1C2B36] block group-hover:text-[#006B66]">Barangay Portal</span>
                <span className="text-[10.5px] text-[#526374]">Civil documents &amp; clearances</span>
              </div>
            </button>

            <button
              onClick={() => navigate('/resident/health')}
              className="flex items-center gap-3 p-3 bg-[#F5F8FA] hover:bg-[#E9F4F2]/70 border border-[#D5E2E8] hover:border-[#006B66]/40 rounded-xl transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#006B66] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Activity size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1C2B36] block group-hover:text-[#006B66]">Health Center</span>
                <span className="text-[10.5px] text-[#526374]">Clinic schedules &amp; appointments</span>
              </div>
            </button>

            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-3 p-3 bg-[#F5F8FA] hover:bg-[#E9F4F2]/70 border border-[#D5E2E8] hover:border-[#173B5E]/40 rounded-xl transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#173B5E] text-white flex items-center justify-center shrink-0 shadow-xs">
                <LogIn size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1C2B36] block group-hover:text-[#173B5E]">Sign In</span>
                <span className="text-[10.5px] text-[#526374]">Resident &amp; Official portal</span>
              </div>
            </button>
          </div>

          <p className="text-[11px] text-[#526374]">
            Republic of the Philippines &bull; City of Butuan &bull; Barangay Pianing
          </p>
        </div>
      </main>

      {/* Official Footer */}
      <footer className="bg-white border-t border-[#D5E2E8] py-4 px-4 text-center text-xs text-[#526374]">
        &copy; {new Date().getFullYear()} Barangay Pianing Management System &bull; All Rights Reserved.
      </footer>
    </div>
  );
}
