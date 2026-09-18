import React, { useState, useMemo } from 'react';
import {
  Search,
  Star,
  RefreshCcw,
  CheckSquare,
  Square,
  Mail,
  MailOpen,
  Trash2,
  Send,
  Smartphone,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Inbox
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { SmsNotification, apiService } from '../../services/api';
import { toast } from 'sonner';

interface GmailNotificationHubProps {
  notifications: SmsNotification[];
  onRefresh: () => void;
  onOpenDetails: (n: SmsNotification) => void;
  onOpenCompose: () => void;
  currentUserRole?: string;
  barangay?: string;
}

export default function GmailNotificationHub({
  notifications,
  onRefresh,
  onOpenDetails,
  onOpenCompose,
  currentUserRole = 'nurse',
  barangay = 'Pianing'
}: GmailNotificationHubProps) {
  const [activeFolder, setActiveFolder] = useState<'all' | 'unread' | 'starred' | '1day' | 'consultation' | 'prenatal' | 'nip'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [starredIds, setStarredIds] = useState<number[]>([]);

  // Toggle Star
  const toggleStar = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setStarredIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Toggle Select
  const toggleSelect = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredList.map(n => n.id));
    }
  };

  // Mark selected as read
  const handleMarkSelectedAsRead = async () => {
    if (selectedIds.length === 0) {
      toast.info('No notifications selected');
      return;
    }
    for (const id of selectedIds) {
      await apiService.markNotificationRead(id).catch(() => {});
    }
    toast.success(`Marked ${selectedIds.length} notification(s) as read`);
    setSelectedIds([]);
    onRefresh();
  };

  // Filtered List
  const filteredList = useMemo(() => {
    return notifications.filter(n => {
      // Exclude administrative barangay office notifications for health workers (BHW, Nurse)
      if (currentUserRole === 'nurse' || currentUserRole === 'bhw') {
        const type = (n.type || '').toLowerCase();
        const msg = (n.message || '').toLowerCase();
        if (
          type.includes('account verified') ||
          type.includes('id correction') ||
          type.includes('verification') ||
          type.includes('clearance') ||
          type.includes('permit') ||
          type.includes('document ready') ||
          type.includes('pickup') ||
          msg.includes('resident account application') ||
          msg.includes('clearances, business permits') ||
          msg.includes('resubmit your valid id') ||
          msg.includes('application has been verified') ||
          msg.includes('application has been rejected')
        ) {
          return false;
        }
      }

      // 1. Folder filter
      if (activeFolder === 'unread' && n.is_read) return false;
      if (activeFolder === 'starred' && !starredIds.includes(n.id)) return false;
      if (activeFolder === '1day' && !(n.type || '').includes('1-Day')) return false;
      if (activeFolder === 'consultation' && !(n.type || '').toLowerCase().includes('consultation')) return false;
      if (activeFolder === 'prenatal' && !(n.type || '').toLowerCase().includes('prenatal') && !(n.type || '').toLowerCase().includes('maternal')) return false;
      if (activeFolder === 'nip' && !(n.type || '').toLowerCase().includes('immunization') && !(n.type || '').toLowerCase().includes('vaccine')) return false;

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (n.recipient_name || '').toLowerCase().includes(q);
        const matchPhone = (n.recipient_phone || '').includes(q);
        const matchMsg = (n.message || '').toLowerCase().includes(q);
        const matchType = (n.type || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchMsg && !matchType) return false;
      }

      return true;
    });
  }, [notifications, activeFolder, starredIds, searchQuery, currentUserRole]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => {
      if (currentUserRole === 'nurse' || currentUserRole === 'bhw') {
        const type = (n.type || '').toLowerCase();
        const msg = (n.message || '').toLowerCase();
        if (
          type.includes('account verified') ||
          type.includes('id correction') ||
          type.includes('verification') ||
          type.includes('clearance') ||
          type.includes('permit') ||
          type.includes('document ready') ||
          type.includes('pickup') ||
          msg.includes('resident account application') ||
          msg.includes('clearances, business permits') ||
          msg.includes('resubmit your valid id') ||
          msg.includes('application has been verified') ||
          msg.includes('application has been rejected')
        ) {
          return false;
        }
      }
      return !n.is_read;
    }).length;
  }, [notifications, currentUserRole]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
      {/* ═══ TOP GMAIL ACTION BAR ═══ */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Toolbar Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSelectAll}
            className="h-8 px-2 text-slate-600 hover:bg-slate-200/70 cursor-pointer"
            title={selectedIds.length === filteredList.length ? 'Deselect all' : 'Select all'}
          >
            {selectedIds.length > 0 && selectedIds.length === filteredList.length ? (
              <CheckSquare size={16} className="text-teal-600" />
            ) : (
              <Square size={16} className="text-slate-400" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkSelectedAsRead}
            disabled={selectedIds.length === 0}
            className="h-8 px-2 text-slate-600 hover:bg-slate-200/70 cursor-pointer"
            title="Mark as read"
          >
            <MailOpen size={15} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="h-8 px-2 text-slate-600 hover:bg-slate-200/70 cursor-pointer"
            title="Refresh notifications"
          >
            <RefreshCcw size={14} />
          </Button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <span className="text-xs text-slate-500 font-medium">
            {unreadCount > 0 ? (
              <span className="text-teal-700 font-bold">{unreadCount} unread</span>
            ) : (
              'All read'
            )}
          </span>
        </div>

        {/* Center: Gmail Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2 text-slate-400" size={14} />
          <Input
            placeholder="Search notifications, patients, or message content..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 text-xs pl-8 bg-white border-slate-200 focus:bg-white"
          />
        </div>

        {/* Right: Compose Button */}
        <div>
          <Button
            size="sm"
            onClick={onOpenCompose}
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs h-8 px-3.5 gap-1.5 font-bold shadow-xs cursor-pointer rounded-xl"
          >
            <Plus size={14} />
            <span>Compose SMS Alert</span>
          </Button>
        </div>
      </div>

      {/* ═══ GMAIL FOLDER PILLS ═══ */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-white border-b border-slate-100 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'all', label: 'All Inbox', count: notifications.length },
          { id: 'unread', label: 'Unread', count: unreadCount, badge: true },
          { id: '1day', label: '🔔 1-Day Advance Alerts' },
          { id: 'consultation', label: '🩺 Consultations' },
          { id: 'prenatal', label: '🤰 Prenatal Care' },
          { id: 'nip', label: '💉 NIP Immunization' },
          { id: 'starred', label: '⭐ Starred', count: starredIds.length }
        ].map(tab => {
          const isActive = activeFolder === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFolder(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-teal-100 text-teal-800 border border-teal-300'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  tab.badge ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ GMAIL INBOX MESSAGE ROWS ═══ */}
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {filteredList.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Inbox size={36} className="mx-auto mb-2 text-slate-300 opacity-60" />
            <p className="font-semibold text-slate-600">No notifications in this folder</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Dispatched SMS alerts and automated reminders will appear here.</p>
          </div>
        ) : (
          filteredList.map(n => {
            const isStarred = starredIds.includes(n.id);
            const isSelected = selectedIds.includes(n.id);
            const isUnread = !n.is_read;

            // Generate initials avatar
            const initials = (n.recipient_name || 'Resident')
              .split(' ')
              .map(p => p[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            // Date format
            const formattedTime = n.sent_at
              ? new Date(n.sent_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
              : 'Recent';

            return (
              <div
                key={n.id}
                onClick={() => onOpenDetails(n)}
                className={`group px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors text-xs select-none ${
                  isUnread
                    ? 'bg-white font-bold text-slate-900 hover:bg-teal-50/40'
                    : 'bg-slate-50/40 text-slate-600 hover:bg-slate-100/70 font-normal'
                } ${isSelected ? 'bg-teal-50/80' : ''}`}
              >
                {/* Select Checkbox */}
                <div onClick={e => toggleSelect(e, n.id)} className="text-slate-400 hover:text-slate-600">
                  {isSelected ? (
                    <CheckSquare size={16} className="text-teal-600" />
                  ) : (
                    <Square size={16} />
                  )}
                </div>

                {/* Star Icon */}
                <div onClick={e => toggleStar(e, n.id)} className="text-slate-300 hover:text-amber-500">
                  <Star
                    size={16}
                    className={isStarred ? 'text-amber-400 fill-amber-400' : ''}
                  />
                </div>

                {/* Initials Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                  isUnread
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {initials}
                </div>

                {/* Recipient Name & Contact */}
                <div className="w-40 sm:w-48 truncate shrink-0">
                  <span className={isUnread ? 'text-slate-900 font-bold' : 'text-slate-700'}>
                    {n.recipient_name || 'Resident'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono ml-1.5 hidden sm:inline">
                    {n.recipient_phone || ''}
                  </span>
                </div>

                {/* Category Chip */}
                <div className="shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold py-0 px-1.5 ${
                      (n.type || '').includes('1-Day')
                        ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
                        : (n.type || '').includes('Immunization')
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : (n.type || '').includes('Prenatal') || (n.type || '').includes('Maternal')
                        ? 'bg-pink-50 border-pink-200 text-pink-700'
                        : (n.type || '').includes('Consultation')
                        ? 'bg-teal-50 border-teal-200 text-teal-700'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    {n.type || 'SMS Alert'}
                  </Badge>
                </div>

                {/* Message Snippet */}
                <div className="flex-1 truncate text-[11px] text-slate-500">
                  <span className={isUnread ? 'text-slate-800 font-medium' : 'text-slate-500'}>
                    {n.message || 'Notification message dispatched.'}
                  </span>
                </div>

                {/* Timestamp */}
                <div className="text-[11px] text-slate-400 font-mono shrink-0">
                  {formattedTime}
                </div>

                {/* Hover Quick Actions */}
                <div className="hidden group-hover:flex items-center gap-1 pl-2 shrink-0">
                  <button
                    onClick={async e => {
                      e.stopPropagation();
                      await apiService.markNotificationRead(n.id);
                      toast.success('Marked as read');
                      onRefresh();
                    }}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800"
                    title="Mark as read"
                  >
                    <MailOpen size={14} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onOpenDetails(n);
                    }}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800"
                    title="View details"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
