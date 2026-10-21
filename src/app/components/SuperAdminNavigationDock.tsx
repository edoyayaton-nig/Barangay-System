import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Crown,
  Tag,
  Users,
  History,
  LogOut
} from 'lucide-react';
import { Button } from './ui/button';

interface SuperAdminNavigationDockProps {
  currentRole?: string;
  onSelectUsersTab?: () => void;
  onSelectCategoryTab?: () => void;
  onSelectLogsTab?: () => void;
  onLogout?: () => void;
}

export default function SuperAdminNavigationDock({
  currentRole,
  onSelectUsersTab,
  onSelectCategoryTab,
  onSelectLogsTab,
  onLogout
}: SuperAdminNavigationDockProps) {
  const navigate = useNavigate();

  if (currentRole !== 'superadmin') return null;

  const handleDefaultLogout = () => {
    localStorage.removeItem('barangay_user');
    navigate('/login');
  };

  return (
    <div className="bg-gradient-to-r from-[#173B5E] via-[#0F2740] to-[#173B5E] text-white border-b border-[#006B66]/30 px-4 py-2 shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Left Badge & Mode */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-[#D8A443]/20 text-[#D8A443] border border-[#D8A443]/40 px-2.5 py-1 rounded-lg text-xs font-bold shadow-inner">
            <Crown size={14} className="text-[#D8A443]" />
            <span>SUPER ADMINISTRATOR</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-[#1D7046] animate-pulse" />
            <span>Master User Directory &amp; System Oversight</span>
          </div>
        </div>

        {/* Action Controls & Prominent Logout Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {onSelectUsersTab && (
            <Button
              size="sm"
              onClick={onSelectUsersTab}
              className="h-7 text-xs font-semibold bg-[#006B66] hover:bg-[#005753] text-white border border-[#006B66]/40 cursor-pointer shadow-xs gap-1.5"
            >
              <Users size={13} />
              <span>User Directory</span>
            </Button>
          )}

          {onSelectCategoryTab && (
            <Button
              size="sm"
              onClick={onSelectCategoryTab}
              className="h-7 text-xs font-semibold bg-[#173B5E] hover:bg-[#0F2740] text-white border border-[#D5E2E8]/20 cursor-pointer shadow-xs gap-1.5"
            >
              <Tag size={13} />
              <span>Category Manager</span>
            </Button>
          )}

          {onSelectLogsTab && (
            <Button
              size="sm"
              onClick={onSelectLogsTab}
              className="h-7 text-xs font-semibold bg-[#182C3F] hover:bg-[#223A50] text-white border border-[#223A50] cursor-pointer shadow-xs gap-1.5"
            >
              <History size={13} />
              <span>Audit Logs</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={onLogout || handleDefaultLogout}
            className="h-7 text-xs font-semibold bg-[#B42318] hover:bg-[#912015] text-white border border-[#B42318]/40 cursor-pointer shadow-sm gap-1.5"
            title="Sign out of Super Administrator account"
          >
            <LogOut size={13} />
            <span>Log Out</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
