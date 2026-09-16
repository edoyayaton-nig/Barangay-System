import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Camera,
  RefreshCw,
  ArrowLeft,
  Search,
  User,
  CheckCheck
} from 'lucide-react';
import { apiService } from '../../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

interface SystemMessengerProps {
  currentUserRole: 'superadmin' | 'admin' | 'staff' | 'bhw' | 'resident';
  currentUserName: string;
  currentUserEmail?: string;
  currentUserId?: number;
  currentUserBarangay?: string;
}

// Only barangay staff roles — superadmin and residents are excluded from 1-to-1 chat
const BARANGAY_STAFF_ROLES = ['admin', 'staff', 'bhw'];

const getRoleBadge = (role: string) => {
  switch (role?.toLowerCase()) {
    case 'superadmin': return { label: 'Super Admin', color: 'bg-violet-600', text: 'text-violet-700', bg: 'bg-violet-50' };
    case 'admin':      return { label: 'Admin', color: 'bg-indigo-600', text: 'text-indigo-700', bg: 'bg-indigo-50' };
    case 'bhw':        return { label: 'BHW', color: 'bg-emerald-600', text: 'text-emerald-700', bg: 'bg-emerald-50' };
    case 'staff':      return { label: 'Staff', color: 'bg-amber-600', text: 'text-amber-700', bg: 'bg-amber-50' };
    default:           return { label: 'Staff', color: 'bg-slate-500', text: 'text-slate-700', bg: 'bg-slate-50' };
  }
};

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'ST';

const formatMessageTime = (rawTime?: string | number | Date) => {
  if (!rawTime) return '';
  const d = new Date(rawTime);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const isPast24Hours = diffMs > 24 * 60 * 60 * 1000;

  const timePart = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isPast24Hours) {
    const datePart = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${datePart}, ${timePart}`;
  }
  return timePart;
};

const getChatStorageKey = (nameA?: string, nameB?: string) => {
  const cleanA = (nameA || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
  const cleanB = (nameB || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
  return `chat_seen_${cleanA}_to_${cleanB}`;
};

const AVATAR_STORAGE_KEY = 'barangay_staff_avatars';

const getStoredAvatars = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(AVATAR_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

export default function SystemMessenger({ currentUserRole, currentUserName, currentUserEmail, currentUserId, currentUserBarangay }: SystemMessengerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [avatars, setAvatars] = useState<Record<string, string>>(getStoredAvatars);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // The barangay of the current user
  const myBarangay = currentUserBarangay || 'Pianing';
  // Compute whether this user is allowed to use the chat (checked after all hooks)
  const isBrgyStaff = BARANGAY_STAFF_ROLES.includes((currentUserRole || '').toLowerCase());

  const fetchMessages = async () => {
    try {
      const data = await apiService.getMessages();
      if (Array.isArray(data)) {
        setAllMessages(data);
      }
    } catch {
      // silent
    }
  };

  const fetchMembers = async () => {
    try {
      const users = await apiService.getUsers();
      if (!Array.isArray(users)) return;
      
      // Strict barangay isolation: ONLY staff/BHW/Admin of the SAME barangay
      const myNameLower = (currentUserName || '').toLowerCase().trim();
      const myEmailLower = (currentUserEmail || '').toLowerCase().trim();
      const myRoleLower = (currentUserRole || '').toLowerCase().trim();
      const myBrgyLower = (myBarangay || 'Pianing').toLowerCase().trim();
      
      const staffList = users.filter(u => {
        const uRole = (u.role || '').toLowerCase().trim();
        if (!BARANGAY_STAFF_ROLES.includes(uRole)) return false;
        
        // Exclude self by ID
        if (currentUserId && u.id && u.id === currentUserId) return false;
        
        // Exclude self by Email
        const uEmail = (u.email || '').toLowerCase().trim();
        if (myEmailLower && uEmail === myEmailLower) return false;
        
        // Exclude self only if BOTH exact name AND role match
        const uName = (u.name || '').toLowerCase().trim();
        if (myNameLower && uName === myNameLower && uRole === myRoleLower) return false;
        
        const uBrgy = (u.barangay || '').toLowerCase().trim();
        // Match same barangay, city-wide, or default Pianing
        return !uBrgy || uBrgy === myBrgyLower || uBrgy.includes(myBrgyLower) || myBrgyLower.includes(uBrgy) || uBrgy.includes('all');
      });

      setStaffMembers(staffList);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchMembers();
    const interval = setInterval(() => {
      fetchMessages();
      fetchMembers();
    }, 3000);
    return () => clearInterval(interval);
  }, [currentUserName, currentUserEmail, currentUserId, myBarangay]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (selectedContact) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [selectedContact, allMessages]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Photo must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const updated = { ...avatars, [currentUserName]: base64 };
      setAvatars(updated);
      localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(updated));
      toast.success('Profile photo updated!');
    };
    reader.readAsDataURL(file);
  };

  // Get conversation messages between current user and selected contact
  const activeConversationMessages = selectedContact ? allMessages.filter(m => {
    const sName = (m.sender_name || '').toLowerCase().trim();
    const rName = (m.recipient_name || '').toLowerCase().trim();
    const myName = (currentUserName || '').toLowerCase().trim();
    const otherName = (selectedContact.name || '').toLowerCase().trim();

    const isMatch = (sName === myName && rName === otherName) ||
                    (sName === otherName && rName === myName) ||
                    (sName.includes(myName) && rName.includes(otherName)) ||
                    (sName.includes(otherName) && rName.includes(myName));

    return isMatch;
  }) : [];

  // Helper to get last message with a contact and its timestamp
  const getContactLastMessage = (contactName: string) => {
    const otherName = (contactName || '').toLowerCase().trim();
    const myName = (currentUserName || '').toLowerCase().trim();

    const thread = allMessages.filter(m => {
      const sName = (m.sender_name || '').toLowerCase().trim();
      const rName = (m.recipient_name || '').toLowerCase().trim();

      const isMatch = (sName === myName && rName === otherName) ||
                      (sName === otherName && rName === myName) ||
                      (sName.includes(myName) && rName.includes(otherName)) ||
                      (sName.includes(otherName) && rName.includes(myName));

      return isMatch;
    });

    if (thread.length === 0) return null;
    return thread[thread.length - 1];
  };

  // Sort staff members so whomever you had the most recent message with is at the TOP!
  const sortedStaffMembers = [...staffMembers].sort((a, b) => {
    const lastA = getContactLastMessage(a.name);
    const lastB = getContactLastMessage(b.name);

    if (!lastA && !lastB) return 0;
    if (!lastA) return 1;
    if (!lastB) return -1;

    const timeA = new Date(lastA.timestamp || 0).getTime();
    const timeB = new Date(lastB.timestamp || 0).getTime();
    return timeB - timeA; // Newest first
  });

  const filteredStaffMembers = sortedStaffMembers.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const markContactAsSeen = (contactName: string) => {
    if (!contactName || !currentUserName) return;
    const key = getChatStorageKey(contactName, currentUserName);
    const now = Date.now();
    localStorage.setItem(key, String(now));
    localStorage.setItem(`chat_last_seen_${contactName}_to_${currentUserName}`, String(now));
  };

  const isMessageUnread = (m: any, myName: string) => {
    if (!m) return false;
    const rClean = (m.recipient_name || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
    const myClean = (myName || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
    if (!rClean || !myClean) return false;
    if (rClean !== myClean && !rClean.includes(myClean) && !myClean.includes(rClean)) return false;
    
    const sClean = (m.sender_name || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
    if (sClean === myClean) return false; // Own message

    const key = getChatStorageKey(m.sender_name, myName);
    const lastSeenStr = localStorage.getItem(key);
    const msgTime = new Date(m.timestamp || m.sent_at || 0).getTime();

    if (!lastSeenStr) {
      const legacyVal = parseInt(localStorage.getItem(`chat_last_seen_${m.sender_name}_to_${myName}`) || '0', 10);
      if (legacyVal > 0) {
        if (legacyVal > 1000000000000) return msgTime > legacyVal;
        return (Number(m.id) || 0) > legacyVal;
      }
      // If no record exists at all, only mark as unread if the message arrived in the last 24 hours
      const ageMs = Date.now() - msgTime;
      return ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000;
    }

    const lastSeenTime = parseInt(lastSeenStr, 10);
    return msgTime > lastSeenTime;
  };

  // Automatically mark current active contact conversation as seen
  useEffect(() => {
    if (selectedContact) {
      markContactAsSeen(selectedContact.name);
    }
  }, [selectedContact, allMessages]);

  // Total unread count across all 1-to-1 chats directed to current user
  const totalUnreadCount = allMessages.filter(m => isMessageUnread(m, currentUserName)).length;

  const handleSelectContact = (contact: any) => {
    setSelectedContact(contact);
    markContactAsSeen(contact.name);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact || sending) return;
    const msgText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const tempMsg = {
      id: Date.now(),
      sender_name: currentUserName,
      sender_role: currentUserRole,
      recipient_name: selectedContact.name,
      recipient_role: selectedContact.role || 'staff',
      barangay: myBarangay,
      message: msgText,
      timestamp: new Date().toISOString()
    };

    setAllMessages(prev => [...prev, tempMsg]);

    try {
      await apiService.sendMessage({
        sender_name: currentUserName,
        sender_role: currentUserRole,
        recipient_name: selectedContact.name,
        recipient_role: selectedContact.role || 'staff',
        barangay: myBarangay,
        message: msgText
      });
      fetchMessages();
    } catch {
      toast.error('Failed to deliver message');
    } finally {
      setSending(false);
    }
  };

  const myAvatar = avatars[currentUserName];
  const { label: myRoleLabel, color: myRoleColor } = getRoleBadge(currentUserRole);

  // Enforce barangay staff role AFTER all hooks (React Rules of Hooks)
  if (!isBrgyStaff) return null;

  return (
    <>
      {/* Floating Staff Messenger Trigger */}
      <button
        onClick={() => { setIsOpen(o => !o); if (!isOpen) { fetchMessages(); fetchMembers(); } }}
        className="fixed bottom-5 right-5 z-40 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-full shadow-lg border border-slate-700/60 flex items-center gap-2.5 cursor-pointer transition-all hover:shadow-xl active:scale-95"
        title={`Barangay ${myBarangay} Staff Communications`}
      >
        <div className="relative flex items-center justify-center">
          <MessageSquare size={16} className="text-slate-200" />
          {totalUnreadCount > 0 && (
            <span className="absolute -top-2.5 -right-2.5 bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center shadow border-2 border-slate-900">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </span>
          )}
        </div>
        <span className="text-xs font-semibold tracking-wide">Staff Chat</span>
      </button>

      {/* Chat Popup Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-full max-w-sm sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ height: '540px' }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white px-3.5 py-3 flex items-center justify-between shrink-0 shadow-xs">
            {selectedContact ? (
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setSelectedContact(null)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  title="Back to all staff"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className={`w-8 h-8 rounded-full ${getRoleBadge(selectedContact.role).color} text-white text-[11px] font-bold flex items-center justify-center overflow-hidden shrink-0`}>
                  {avatars[selectedContact.name]
                    ? <img src={avatars[selectedContact.name]} className="w-full h-full object-cover" />
                    : getInitials(selectedContact.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold leading-tight truncate">{selectedContact.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-indigo-100 font-medium">{getRoleBadge(selectedContact.role).label}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">
                    {currentUserRole === 'superadmin' ? 'Staff Communications' : `Barangay ${myBarangay}`}
                  </h3>
                  <p className="text-[10px] text-indigo-100 opacity-90 font-medium">Internal Staff Directory</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1">
              <button
                onClick={() => { fetchMessages(); fetchMembers(); }}
                className="p-1.5 hover:bg-white/20 rounded-lg text-indigo-100 transition-colors cursor-pointer"
                title="Refresh messages"
              >
                <RefreshCw size={13} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                title="Close chat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* VIEW 1: Staff Directory / Recent Conversations List */}
          {!selectedContact ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
              {/* Search Bar */}
              <div className="p-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search staff or health worker..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Staff List (Sorted so newest conversation is at the TOP) */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredStaffMembers.length === 0 ? (
                  <div className="text-center text-slate-400 py-12 text-xs">
                    <User className="mx-auto text-slate-300 mb-1" size={24} />
                    <p className="font-semibold text-slate-500">No staff members found</p>
                    <p className="text-[10px] text-slate-400">Barangay staff in {myBarangay} will appear here.</p>
                  </div>
                ) : (
                  filteredStaffMembers.map(member => {
                    const lastMsg = getContactLastMessage(member.name);
                    const av = avatars[member.name];
                    const { label: roleLabel, color: roleColor } = getRoleBadge(member.role);
                    const hasUnread = lastMsg && isMessageUnread(lastMsg, currentUserName);
                    const timeStr = lastMsg ? formatMessageTime(lastMsg.timestamp || lastMsg.sent_at) : '';

                    return (
                      <button
                        key={member.id || member.name}
                        onClick={() => handleSelectContact(member)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 transition-all text-left group cursor-pointer shadow-2xs"
                      >
                        {/* Contact Avatar */}
                        <div className={`relative w-10 h-10 rounded-full ${roleColor} text-white text-xs font-bold flex items-center justify-center overflow-hidden shrink-0 shadow-xs`}>
                          {av ? <img src={av} className="w-full h-full object-cover" /> : getInitials(member.name)}
                          {hasUnread && (
                            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
                          )}
                        </div>

                        {/* Name, Role & Last Message */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                              {member.name}
                            </h4>
                            {timeStr && (
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">{timeStr}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                              {lastMsg ? (
                                (lastMsg.sender_name?.toLowerCase() === currentUserName.toLowerCase() ? 'You: ' : '') + lastMsg.message
                              ) : (
                                <span className="italic text-slate-400">Click to start 1-on-1 chat</span>
                              )}
                            </p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${roleColor} text-white shrink-0`}>
                              {roleLabel}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* My Profile Quick Bar */}
              <div className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group cursor-pointer"
                    title="Change profile photo"
                  >
                    <div className={`w-7 h-7 rounded-full ${myRoleColor} text-white text-[10px] font-bold flex items-center justify-center overflow-hidden`}>
                      {myAvatar ? <img src={myAvatar} className="w-full h-full object-cover" /> : getInitials(currentUserName)}
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera size={10} className="text-white" />
                    </div>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  <div>
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block leading-tight">{currentUserName}</span>
                    <span className="text-[9px] text-slate-400">Logged In as {myRoleLabel}</span>
                  </div>
                </div>
                <Badge className={`text-[9px] ${myRoleColor} text-white`}>{myBarangay}</Badge>
              </div>
            </div>
          ) : (
            /* VIEW 2: Active 1-on-1 Chat Conversation Screen */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {activeConversationMessages.length === 0 ? (
                  <div className="text-center text-slate-400 py-16 text-xs space-y-2">
                    <div className={`w-12 h-12 rounded-full ${getRoleBadge(selectedContact.role).color} text-white mx-auto flex items-center justify-center text-sm font-bold shadow-md`}>
                      {avatars[selectedContact.name]
                        ? <img src={avatars[selectedContact.name]} className="w-full h-full object-cover rounded-full" />
                        : getInitials(selectedContact.name)}
                    </div>
                    <p className="font-bold text-slate-700 dark:text-slate-300">Direct Chat with {selectedContact.name}</p>
                    <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                      Send a message to coordinate barangay tasks or health clearances.
                    </p>
                  </div>
                ) : (
                  activeConversationMessages.map((msg, idx) => {
                    const isMe = (msg.sender_name || '').toLowerCase() === currentUserName.toLowerCase();
                    const senderAvatar = isMe ? myAvatar : avatars[selectedContact.name];
                    const roleColor = isMe ? myRoleColor : getRoleBadge(selectedContact.role).color;
                    const initials = getInitials(msg.sender_name || 'S');
                    const timeStr = formatMessageTime(msg.timestamp || msg.sent_at) || 'now';

                    return (
                      <div key={msg.id || idx} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <div className={`w-7 h-7 rounded-full ${roleColor} text-white text-[10px] font-bold flex items-center justify-center shrink-0 overflow-hidden self-end shadow-2xs`}>
                          {senderAvatar
                            ? <img src={senderAvatar} className="w-full h-full object-cover" />
                            : initials}
                        </div>
                        <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`px-3 py-2 rounded-2xl text-[12px] leading-relaxed shadow-xs ${
                            isMe
                              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-tr-none'
                              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-tl-none'
                          }`}>
                            {msg.message}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 px-1">
                            <span className="text-[9px] text-slate-400 font-mono">{timeStr}</span>
                            {isMe && <CheckCheck size={11} className="text-indigo-400" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-2.5 shrink-0">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder={`Message ${selectedContact.name?.split(' ')[0]}...`}
                    className="text-xs h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    disabled={sending}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sending || !newMessage.trim()}
                    className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    <Send size={14} />
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
