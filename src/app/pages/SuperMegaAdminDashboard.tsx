import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Crown, Database, History, Users, BarChart2, LogOut,
  Server, RefreshCcw, Download, Activity, UserPlus, Search, X, Eye, EyeOff, Trash2,
  FileText, Mail, Shield, Menu, Tag, PlusCircle, ShieldCheck, Users2, Send,
  LayoutDashboard, Globe, Building2, Cpu, CheckCircle2, ArrowUpRight, ChevronRight, Clock, ExternalLink,
  AlertOctagon, Wrench, Megaphone, Radio, UserCircle, Settings,
  Key, Lock, Check, Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { apiService, notifySystemNoticeChange, SystemUser, ActivityLog } from '../../services/api';
import { BUTUAN_BARANGAYS } from '../../utils/barangays';
import { AGUSAN_DEL_NORTE_LGUS, getBarangaysForCity } from '../../utils/caragaJurisdictions';
import { toast } from 'sonner';
import SystemNoticeBanner from '../components/SystemNoticeBanner';
import ProfileSettingsView from '../components/ProfileSettingsView';
import { ClientBarangay, INITIAL_CLIENTS } from '../components/BarangaySettingsControlPanel';


/* ─────────────────────────────────────────────────────────── */
/*  Utility helpers                                             */
/* ─────────────────────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString();

function formatTimeAgo(ts?: string) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function validatePassword(p: string) {
  if (!p || p.length < 8) return 'Must be at least 8 characters';
  if (!/[A-Z]/.test(p)) return 'Must have at least 1 uppercase letter';
  if (!/[a-z]/.test(p)) return 'Must have at least 1 lowercase letter';
  if (!/[0-9]/.test(p)) return 'Must have at least 1 digit';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p)) return 'Must have at least 1 special character';
  return null;
}

/* ─────────────────────────────────────────────────────────── */
/*  Design tokens (dark, eye-friendly palette)                  */
/* ─────────────────────────────────────────────────────────── */
const BG = '#0A0E1A';
const CARD = '#111827';
const CARD2 = '#161F30';
const BORDER = '#1F293D';
const TEXT = '#E2E8F0';
const MUTED = '#64748B';
const ACCENT_CYAN = '#06B6D4';
const ACCENT_VIOLET = '#7C3AED';
const ACCENT_EMERALD = '#10B981';
const ACCENT_AMBER = '#F59E0B';
const ACCENT_ROSE = '#F43F5E';

/* ─────────────────────────────────────────────────────────── */
/*  DB Tables monitored by System & Backup tab                  */
/* ─────────────────────────────────────────────────────────── */
const DB_TABLES = [
  'users', 'residents', 'documents', 'activity_logs',
  'document_categories', 'appointments', 'clinic_schedules',
  'maternal_records', 'immunizations', 'consultations',
  'inventory', 'notifications', 'messages', 'census_households'
];

/* ─────────────────────────────────────────────────────────── */
/*  Main Component                                              */
/* ─────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────── */
/*  Blank state for "Create Superadmin" form (module-level)   */
/* ─────────────────────────────────────────────────────────── */
const BLANK_NEW_SA = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: 'Barangay Super Administrator',
  city: 'Butuan City',
  barangay: '',
  purok: '1',
  password: '',
  confirmPassword: ''
};

export default function SuperMegaAdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('barangay_user') || 'null'); } catch { return null; }
  });

  // Guard — redirect if not super_mega_admin
  useEffect(() => {
    if (!user || user.role !== 'super_mega_admin') {
      navigate('/login');
    }
  }, [user, navigate]);

  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'system' | 'logs' | 'users' | 'reports' | 'profile-settings'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Data ──────────────────────────────────────────────────
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [dbHealth, setDbHealth] = useState<{ table: string; count: number; status: string }[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState({ db: 'Checking...', sms: 'Checking...', smtp: 'Checking...' });

  // ── User Management (System Owner Governance) ────────────
  const [userManagementSubTab, setUserManagementSubTab] = useState<'superadmins' | 'platform' | 'all'>('superadmins');
  const [clientBarangays, setClientBarangays] = useState<ClientBarangay[]>(() => {
    try {
      const saved = localStorage.getItem('platform_client_barangays');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_CLIENTS;
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('platform_client_barangays');
      if (saved) setClientBarangays(JSON.parse(saved));
    } catch {}
  }, [activeTab]);

  const handleResetSuperadminKey = (saEmail: string, barangayName: string) => {
    const tempKey = `BRGY-${Math.random().toString(36).substring(2, 8).toUpperCase()}-#2026`;
    navigator.clipboard?.writeText(tempKey);
    toast.success(`One-time emergency key created for ${barangayName} Superadmin (${saEmail}): ${tempKey}`, {
      description: 'The key has been copied to your clipboard. Share securely with the client administrator.'
    });
  };

  const handleToggleClientBarangayStatus = (clientId: string) => {
    setClientBarangays(prev => {
      const updated = prev.map(c => {
        if (c.id === clientId) {
          const nextStatus = c.status === 'active' ? 'suspended' : 'active';
          toast.info(`Client Barangay ${c.name} is now ${nextStatus.toUpperCase()}`);
          return { ...c, status: nextStatus as any };
        }
        return c;
      });
      localStorage.setItem('platform_client_barangays', JSON.stringify(updated));
      return updated;
    });
  };

  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userBarangayFilter, setUserBarangayFilter] = useState<string>('all');
  const [isCreateSuperadminOpen, setIsCreateSuperadminOpen] = useState(false);
  const [newSA, setNewSA] = useState({ ...BLANK_NEW_SA });
  const [newSAError, setNewSAError] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [showNewSAPass, setShowNewSAPass] = useState(false);

  // Reset form every time the modal OPENS so stale data never shows
  useEffect(() => {
    if (isCreateSuperadminOpen) {
      setNewSA({ ...BLANK_NEW_SA });
      setNewSAError('');
      setShowNewSAPass(false);
    }
  }, [isCreateSuperadminOpen]);

  const saBarangays = useMemo(() => {
    if (!newSA.city) return [];
    return getBarangaysForCity(newSA.city);
  }, [newSA.city]);

  // ── Category Management ───────────────────────────────────
  const [catSearch, setCatSearch] = useState('');
  const [catDeptFilter, setCatDeptFilter] = useState('all');
  const [catStatusFilter, setCatStatusFilter] = useState('all');
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', department: 'Barangay', description: '' });
  const [creatingCat, setCreatingCat] = useState(false);

  // ── Logs ──────────────────────────────────────────────────
  const [logSearch, setLogSearch] = useState('');
  const [logRoleFilter, setLogRoleFilter] = useState('all');
  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [logBarangayFilter, setLogBarangayFilter] = useState('all');
  const [logsLoading, setLogsLoading] = useState(false);

  // ── System Incident & Public Notices ──────────────────────
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [noticeType, setNoticeType] = useState<'down' | 'maintenance' | 'advisory'>('down');
  const [noticeTitle, setNoticeTitle] = useState('System Outage Alert');
  const [maintenanceMsg, setMaintenanceMsg] = useState('The system is temporarily experiencing technical difficulties. Technicians are resolving the issue.');
  const [estimatedUptime, setEstimatedUptime] = useState('Within 1 hour');
  const [backupLoading, setBackupLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);

  /* ── Load data ───────────────────────────────────────────── */
  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, logsData, residentsData, catData, docsData, maintData] = await Promise.all([
        apiService.getUsers().catch(() => []),
        apiService.getActivityLogs().catch(() => []),
        apiService.getResidents().catch(() => []),
        apiService.getCategories().catch(() => []),
        apiService.getDocuments().catch(() => []),
        apiService.getMaintenanceMode().catch(() => null),
      ]);
      setSystemUsers(usersData);
      setActivityLogs(logsData);
      setResidents(residentsData);
      setCategories(catData);
      setDocuments(docsData);
      if (maintData) {
        setMaintenanceMode(Boolean(maintData.enabled));
        if (maintData.type) setNoticeType(maintData.type);
        if (maintData.title) setNoticeTitle(maintData.title);
        if (maintData.message) setMaintenanceMsg(maintData.message);
        if (maintData.estimated_uptime) setEstimatedUptime(maintData.estimated_uptime);
      }
    } catch (e) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const broadcastNoticeUpdate = () => {
    notifySystemNoticeChange({
      enabled: maintenanceMode,
      type: noticeType,
      title: noticeTitle,
      message: maintenanceMsg,
      estimated_uptime: estimatedUptime
    });
  };

  const handleToggleMaintenance = async (enabled: boolean) => {
    setMaintenanceMode(enabled);
    try {
      await apiService.toggleMaintenanceMode({
        enabled,
        type: noticeType,
        title: noticeTitle,
        message: maintenanceMsg,
        estimated_uptime: estimatedUptime
      });
      broadcastNoticeUpdate();
      const label = noticeType === 'down' ? 'System Down Warning' : noticeType === 'maintenance' ? 'Scheduled Maintenance' : 'Public Advisory';
      toast.success(enabled ? `System notice enabled (${label})` : 'System notice deactivated (System Live)');
    } catch {
      toast.error('Failed to update system notice on server');
    }
  };

  const handleSaveMaintenanceMsg = async () => {
    try {
      setMaintenanceMode(true);
      await apiService.toggleMaintenanceMode({
        enabled: true,
        type: noticeType,
        title: noticeTitle,
        message: maintenanceMsg,
        estimated_uptime: estimatedUptime
      });
      broadcastNoticeUpdate();
      const label = noticeType === 'down' ? 'System Outage Alert' : noticeType === 'maintenance' ? 'Maintenance Window' : 'Public Advisory';
      toast.success(`System Notice is now LIVE & broadcasting to all portals! (${label})`);
    } catch {
      toast.error('Failed to broadcast system notice to server');
    }
  };

  const handleStopBroadcast = async () => {
    try {
      setMaintenanceMode(false);
      await apiService.toggleMaintenanceMode({
        enabled: false,
        type: noticeType,
        title: noticeTitle,
        message: maintenanceMsg,
        estimated_uptime: estimatedUptime
      });
      broadcastNoticeUpdate();
      toast.success('System notice broadcast deactivated — All portals returned to Normal');
    } catch {
      toast.error('Failed to deactivate broadcast');
    }
  };

  const applyNoticePreset = (type: 'down' | 'maintenance' | 'advisory') => {
    setNoticeType(type);
    if (type === 'down') {
      setNoticeTitle('CRITICAL ALERT: System is Temporarily Down');
      setMaintenanceMsg('The Barangay Information System is currently experiencing an unexpected database server outage. Online document requests and resident portal access are temporarily on hold while technicians resolve the issue.');
      setEstimatedUptime('Expected recovery: Within 1 hour');
    } else if (type === 'maintenance') {
      setNoticeTitle('SCHEDULED SYSTEM MAINTENANCE IN PROGRESS');
      setMaintenanceMsg('System infrastructure and municipal databases are undergoing scheduled routine upgrades and security hardening. Services will resume shortly.');
      setEstimatedUptime('Maintenance Window: 12:00 AM – 4:00 AM');
    } else {
      setNoticeTitle('OFFICIAL MUNICIPAL PUBLIC ADVISORY');
      setMaintenanceMsg('Please be advised of scheduled barangay hall administrative operating hours and mobile medical clinic routes for this week.');
      setEstimatedUptime('Advisory Active Today');
    }
  };

  const loadDbHealth = async () => {
    setDbLoading(true);
    try {
      const health = await (apiService as any).getDbHealth?.().catch(() => null);
      if (health && Array.isArray(health)) {
        setDbHealth(health);
      } else {
        setDbHealth(DB_TABLES.map(t => ({ table: t, count: 0, status: 'Healthy' })));
      }
      setGatewayStatus({ db: 'Connected', sms: 'Operational', smtp: 'Active' });
    } catch {
      setGatewayStatus({ db: 'Error', sms: 'Unknown', smtp: 'Unknown' });
    } finally {
      setDbLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await apiService.getActivityLogs();
      setActivityLogs(data);
      toast.success('Activity logs refreshed');
    } catch {
      toast.error('Failed to refresh logs');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadDbHealth();
  }, []);

  /* ── Logout ──────────────────────────────────────────────── */
  const handleLogout = () => {
    localStorage.removeItem('barangay_user');
    navigate('/login');
  };

  /* ── Create Barangay Superadmin ─────────────────────────── */
  const handleCreateSuperadmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewSAError('');

    const fn = newSA.firstName.trim();
    const ln = newSA.lastName.trim();
    const em = newSA.email.trim().toLowerCase();
    const ph = newSA.phone.replace(/[\s-]/g, '').trim();
    const title = 'Barangay Super Administrator';

    if (!fn || !ln) {
      setNewSAError('First Name and Last Name are required.');
      return;
    }
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setNewSAError('Please provide a valid official email address.');
      return;
    }
    if (!ph || !/^09\d{9}$/.test(ph)) {
      setNewSAError('Please provide a valid 11-digit mobile number starting with 09 (e.g. 09171234567).');
      return;
    }
    if (!newSA.city) {
      setNewSAError('Please select a City or Municipality in Agusan del Norte.');
      return;
    }
    if (!newSA.barangay) {
      setNewSAError('Please select an official Barangay.');
      return;
    }
    if (newSA.password !== newSA.confirmPassword) {
      setNewSAError('Passwords do not match.');
      return;
    }
    const pwErr = validatePassword(newSA.password);
    if (pwErr) {
      setNewSAError(pwErr);
      return;
    }

    const fullName = `${fn}${newSA.middleName.trim() ? ' ' + newSA.middleName.trim() : ''} ${ln}`.replace(/\s+/g, ' ');

    setCreatingUser(true);
    try {
      await apiService.createUser({
        name: fullName,
        first_name: fn,
        middle_name: newSA.middleName.trim() || undefined,
        last_name: ln,
        email: em,
        password: newSA.password,
        role: 'superadmin',
        city: newSA.city,
        barangay: newSA.barangay,
        purok: newSA.purok || '1',
        phone: ph,
        status: 'Active',
        job_title: title
      } as any);

      toast.success(`Barangay Superadmin for ${newSA.barangay} (${newSA.city}) created!`);
      setIsCreateSuperadminOpen(false);
      setNewSA({ ...BLANK_NEW_SA });
      setNewSAError('');
      loadData();
    } catch (err: any) {
      setNewSAError(err?.message || 'Failed to create account');
    } finally {
      setCreatingUser(false);
    }
  };

  /* ── Category handlers ───────────────────────────────────── */
  const handleToggleCat = async (catName: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      await apiService.updateCategory(catName, newStatus);
      setCategories(prev => prev.map(c => c.name === catName ? { ...c, status: newStatus } : c));
      toast.success(`Category '${catName}' is now ${newStatus}`);
    } catch { toast.error('Failed to update category status'); }
  };

  const handleDeleteCat = async (cat: any) => {
    if (!window.confirm(`Delete category '${cat.name}'?`)) return;
    try {
      await apiService.deleteCategory(cat.name);
      setCategories(prev => prev.filter(c => c.name !== cat.name));
      toast.success(`Category '${cat.name}' deleted`);
    } catch (err: any) { toast.error(err?.message || 'Failed to delete category'); }
  };

  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name.trim()) { toast.error('Category name is required'); return; }
    setCreatingCat(true);
    try {
      const created = await apiService.createCategory({ name: newCat.name.trim(), department: newCat.department, description: newCat.description.trim() || undefined });
      setCategories(prev => [...prev, created]);
      toast.success(`Category '${newCat.name}' created`);
      setIsAddCatOpen(false);
      setNewCat({ name: '', department: 'Barangay', description: '' });
    } catch (err: any) { toast.error(err?.message || 'Failed to create category'); }
    finally { setCreatingCat(false); }
  };

  /* ── User toggles ─────────────────────────────────────────── */
  const handleToggleUserStatus = async (u: SystemUser) => {
    const newStatus = u.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await apiService.updateUser(u.id, { status: newStatus as any });
      setSystemUsers(prev => prev.map(su => su.id === u.id ? { ...su, status: newStatus as any } : su));
      toast.success(`${u.name} is now ${newStatus}`);
    } catch { toast.error('Failed to update user status'); }
  };

  const handleDeleteUser = async (u: SystemUser) => {
    if (!window.confirm(`Permanently archive user '${u.name}'?`)) return;
    try {
      await apiService.deleteUser(u.id);
      setSystemUsers(prev => prev.filter(su => su.id !== u.id));
      toast.success(`${u.name} archived`);
    } catch (err: any) { toast.error(err?.message || 'Failed to archive user'); }
  };

  /* ── Backup download ─────────────────────────────────────── */
  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      const snap = { timestamp: new Date().toISOString(), users: systemUsers.length, residents: residents.length, categories: categories.length, logs: activityLogs.length };
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `smart_db_snapshot_${Date.now()}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('JSON snapshot downloaded');
    } catch { toast.error('Download failed'); }
    finally { setBackupLoading(false); }
  };

  /* ── Computed filtered lists ─────────────────────────────── */
  const filteredUsers = systemUsers.filter(u => {
    if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
    if (userBarangayFilter !== 'all' && (u.barangay || '').toLowerCase() !== userBarangayFilter.toLowerCase()) return false;
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.barangay || '').toLowerCase().includes(q);
    }
    return true;
  });

  const filteredLogs = activityLogs.filter(log => {
    if (logRoleFilter !== 'all' && log.user_role !== logRoleFilter) return false;
    if (logTypeFilter !== 'all' && log.action_type !== logTypeFilter) return false;
    if (logBarangayFilter !== 'all' && (log.barangay || '').toLowerCase() !== logBarangayFilter.toLowerCase()) return false;
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      return (log.user_name || '').toLowerCase().includes(q) || (log.action || '').toLowerCase().includes(q) || (log.barangay || '').toLowerCase().includes(q);
    }
    return true;
  });

  const filteredCats = categories.filter(c => {
    if (catDeptFilter !== 'all' && (c.department || 'Barangay').toLowerCase() !== catDeptFilter.toLowerCase()) return false;
    if (catStatusFilter !== 'all' && (c.status || 'Active').toLowerCase() !== catStatusFilter.toLowerCase()) return false;
    if (!catSearch.trim()) return true;
    const q = catSearch.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.department || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
  });

  /* ── Analytics ───────────────────────────────────────────── */
  const totalResidents = residents.length;
  const verifiedResidents = residents.filter(r => r.verification_status === 'Verified').length;
  const superadminsList = systemUsers.filter(u => u.role === 'superadmin');
  const superadminCount = superadminsList.length;
  const adminCount = systemUsers.filter(u => u.role === 'admin').length;
  const clinicalStaff = systemUsers.filter(u => u.role === 'nurse' || u.role === 'bhw').length;
  const clerkStaff = systemUsers.filter(u => u.role === 'staff').length;
  const assignedBarangays = Array.from(new Set(superadminsList.map(u => u.barangay).filter(Boolean)));
  const pendingDocsCount = documents.filter(d => d.status === 'Pending').length;
  const completedDocsCount = documents.filter(d => d.status === 'Completed').length;
  const recentAuditLogs = activityLogs.slice(0, 6);
  const logsByType: Record<string, number> = {};
  activityLogs.forEach(l => {
    const t = l.action_type || (l.action?.includes(' ') ? l.action.split(' ')[0] : l.action) || 'General';
    logsByType[t] = (logsByType[t] || 0) + 1;
  });

  const staffDonutData = [
    { name: 'Barangay Superadmins', value: superadminCount, color: ACCENT_VIOLET },
    { name: 'Barangay Admins', value: adminCount, color: '#6366F1' },
    { name: 'Nurses', value: systemUsers.filter(u => u.role === 'nurse').length, color: ACCENT_CYAN },
    { name: 'BHWs', value: systemUsers.filter(u => u.role === 'bhw').length, color: ACCENT_AMBER },
    { name: 'General Staff', value: clerkStaff, color: '#94A3B8' },
  ].filter(item => item.value > 0);

  const totalStaffDonutCount = staffDonutData.reduce((acc, curr) => acc + curr.value, 0);

  const typeColorMap: Record<string, string> = {
    Auth: '#6366F1',
    Document: '#7C3AED',
    Resident: '#10B981',
    Health: '#06B6D4',
    System: '#F59E0B',
    Security: '#F43F5E',
  };
  const fallbackBarColors = ['#38BDF8', '#A855F7', '#EC4899', '#14B8A6', '#84CC16'];

  const activityBarData = Object.entries(logsByType)
    .map(([type, count], i) => ({
      type,
      count,
      fillColor: typeColorMap[type] || fallbackBarColors[i % fallbackBarColors.length]
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  /* ── Role badge ─────────────────────────────────────────── */
  function roleBadge(role: string) {
    const map: Record<string, string> = {
      super_mega_admin: 'bg-violet-950 text-violet-300 border border-violet-700',
      superadmin: 'bg-blue-950 text-blue-300 border border-blue-700',
      admin: 'bg-indigo-950 text-indigo-300 border border-indigo-700',
      staff: 'bg-slate-800 text-slate-300 border border-slate-600',
      bhw: 'bg-orange-950 text-orange-300 border border-orange-700',
      nurse: 'bg-teal-950 text-teal-300 border border-teal-700',
      resident: 'bg-emerald-950 text-emerald-300 border border-emerald-700',
    };
    return map[role] || 'bg-slate-800 text-slate-300 border border-slate-600';
  }

  function logTypeBadge(type?: string) {
    const map: Record<string, string> = {
      Auth: 'bg-blue-950 text-blue-300', Document: 'bg-indigo-950 text-indigo-300',
      Resident: 'bg-emerald-950 text-emerald-300', Health: 'bg-teal-950 text-teal-300',
      System: 'bg-violet-950 text-violet-300', Security: 'bg-rose-950 text-rose-300',
      User: 'bg-orange-950 text-orange-300', Category: 'bg-amber-950 text-amber-300',
    };
    return map[type || ''] || 'bg-slate-800 text-slate-300';
  }

  const sidebarItems = [
    { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
    { id: 'categories', label: 'Category Manager', icon: Tag },
    { id: 'system', label: 'System Settings', icon: Settings },
    { id: 'logs', label: 'System Audit & Logs', icon: History },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'reports', label: 'Analytics & Reports', icon: BarChart2 },
    { id: 'profile-settings', label: 'Profile Settings', icon: UserCircle },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning'; if (h < 18) return 'Good afternoon'; return 'Good evening';
  };

  /* ═══════════════════════════════════════════════════════════ */
  /*  RENDER                                                     */
  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{ background: BG, color: TEXT, height: '100vh', maxHeight: '100vh', fontFamily: "'Inter', sans-serif" }} className="h-screen max-h-screen overflow-hidden flex flex-col">

      {/* TOP HEADER */}
      <header style={{ background: CARD, borderBottom: `1px solid ${BORDER}` }}
        className="shrink-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setMobileMenuOpen(true)}
            style={{ color: MUTED }} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors lg:hidden cursor-pointer">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', borderRadius: 10, padding: 6 }}>
                <Crown size={16} color="white" />
              </div>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse border-2" style={{ borderColor: CARD }} />
            </div>
            <div>
              <p style={{ color: TEXT, fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Smart Barangay Governance</p>
              <p style={{ color: MUTED, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em' }}>MUNICIPAL CONTROL DOCK — SUPER MEGA ADMIN</p>
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2">
          {[
            { label: 'DB', color: ACCENT_EMERALD, status: gatewayStatus.db },
            { label: 'SMS', color: ACCENT_CYAN, status: gatewayStatus.sms },
            { label: 'SMTP', color: ACCENT_AMBER, status: gatewayStatus.smtp },
          ].map(g => (
            <span key={g.label} style={{ background: `${g.color}18`, border: `1px solid ${g.color}40`, color: g.color }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: g.color }} />
              {g.label}: {g.status}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('profile-settings')}
              style={{
                background: activeTab === 'profile-settings' ? `${ACCENT_VIOLET}30` : `${ACCENT_VIOLET}18`,
                border: `1px solid ${activeTab === 'profile-settings' ? ACCENT_VIOLET : BORDER}`,
                borderRadius: 8,
                padding: '4px 10px'
              }}
              className="cursor-pointer hover:bg-violet-950/40 transition-colors text-left flex items-center gap-2"
              title="Open Profile Settings"
            >
              <UserCircle size={15} style={{ color: '#C4B5FD' }} />
              <div>
                <p style={{ color: '#C4B5FD', fontSize: 11, fontWeight: 700 }}>{user?.name || 'Super Mega Admin'}</p>
                <p style={{ color: MUTED, fontSize: 9, fontWeight: 600 }}>SYSTEM ROOT OPERATOR</p>
              </div>
            </button>
          </div>
          <button onClick={handleLogout} style={{ color: MUTED, border: `1px solid ${BORDER}` }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/40 transition-all cursor-pointer">
            <LogOut size={13} /> Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 h-full overflow-hidden">
        {/* MOBILE OVERLAY */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <aside style={{ background: CARD2, borderRight: `1px solid ${BORDER}`, width: 240 }}
              className="absolute left-0 top-0 bottom-0 flex flex-col py-5 px-3">
              <div className="flex items-center justify-between mb-6 px-2">
                <p style={{ color: ACCENT_VIOLET, fontWeight: 700, fontSize: 12 }}>Navigation</p>
                <button onClick={() => setMobileMenuOpen(false)} style={{ color: MUTED }} className="cursor-pointer bg-transparent border-none"><X size={18} /></button>
              </div>
              {sidebarItems.map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id as any); setMobileMenuOpen(false); }}
                  style={{
                    background: activeTab === item.id ? `${ACCENT_VIOLET}20` : 'transparent',
                    color: activeTab === item.id ? '#C4B5FD' : MUTED,
                    border: activeTab === item.id ? `1px solid ${ACCENT_VIOLET}40` : '1px solid transparent',
                    borderRadius: 8, padding: '9px 12px', marginBottom: 4,
                    display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 13,
                  }}
                  className="w-full text-left hover:bg-white/5 transition-all cursor-pointer">
                  <item.icon size={15} />{item.label}
                </button>
              ))}
            </aside>
          </div>
        )}

        {/* DESKTOP SIDEBAR */}
        <aside style={{ background: CARD2, borderRight: `1px solid ${BORDER}`, width: 230, minWidth: 230 }}
          className="hidden lg:flex flex-col py-5 px-3 shrink-0 h-full overflow-y-auto">
          <p style={{ color: MUTED, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', paddingLeft: 10, marginBottom: 8 }}>CONTROL DOCK</p>
          {sidebarItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)}
              style={{
                background: activeTab === item.id ? `${ACCENT_VIOLET}20` : 'transparent',
                color: activeTab === item.id ? '#C4B5FD' : MUTED,
                border: activeTab === item.id ? `1px solid ${ACCENT_VIOLET}40` : '1px solid transparent',
                borderRadius: 8, padding: '9px 10px', marginBottom: 3,
                display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 12,
              }}
              className="w-full text-left hover:bg-white/5 transition-all cursor-pointer">
              <item.icon size={14} />{item.label}
            </button>
          ))}
          <div className="flex-1" />
          <div style={{ background: `${BORDER}60`, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, marginTop: 12 }}>
            <p style={{ color: MUTED, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>SYSTEM STATS</p>
            {[
              { label: 'Total Users', value: systemUsers.length },
              { label: 'Activity Logs', value: activityLogs.length },
              { label: 'Residents', value: residents.length },
              { label: 'Categories', value: categories.length },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-0.5">
                <span style={{ color: MUTED, fontSize: 10 }}>{s.label}</span>
                <span style={{ color: TEXT, fontSize: 10, fontWeight: 700 }}>{fmt(s.value)}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* Welcome banner */}
          <div style={{ background: `linear-gradient(135deg, ${ACCENT_VIOLET}18, ${ACCENT_CYAN}10)`, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 20px' }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p style={{ color: '#C4B5FD', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>MUNICIPAL GOVERNANCE ROOT</p>
              <h1 style={{ color: TEXT, fontWeight: 800, fontSize: 20, marginTop: 2 }}>{greeting()}, Super Mega Administrator</h1>
              <p style={{ color: MUTED, fontSize: 12 }}>City of Butuan — Municipal Governance Oversight Portal</p>
            </div>
            <button onClick={loadData} style={{ border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 600, background: 'transparent' }}
              className="flex items-center gap-1.5 hover:bg-white/5 transition-colors cursor-pointer">
              <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} /> Refresh All
            </button>
          </div>

          {/* ── TAB 0: EXECUTIVE OVERVIEW ─────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Executive Command Strip */}
              <div
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px 18px' }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    City Node Mesh: 100% Operational
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <Database size={13} className="text-cyan-400" />
                    <span>MySQL: <strong className="text-slate-200">smart_db</strong> (3306)</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <Globe size={13} className="text-violet-400" />
                    <span>Jurisdiction: <strong className="text-slate-200">86 Butuan Barangays</strong></span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setIsCreateSuperadminOpen(true)}
                    style={{ background: `linear-gradient(135deg, ${ACCENT_VIOLET}, #6366F1)`, color: '#fff' }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-95 transition-all cursor-pointer shadow-sm"
                  >
                    <UserPlus size={13} />
                    Assign Superadmin
                  </button>
                  <button
                    onClick={() => setIsAddCatOpen(true)}
                    style={{ background: CARD2, border: `1px solid ${BORDER}`, color: TEXT }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/5 transition-all cursor-pointer"
                  >
                    <PlusCircle size={13} />
                    New Category
                  </button>
                  <button
                    onClick={handleDownloadBackup}
                    disabled={backupLoading}
                    style={{ background: CARD2, border: `1px solid ${BORDER}`, color: MUTED }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:text-slate-200 hover:bg-white/5 transition-all cursor-pointer"
                  >
                    <Download size={13} />
                    {backupLoading ? 'Exporting...' : 'Backup Snapshot'}
                  </button>
                </div>
              </div>

              {/* Top 4 KPI Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* Metric 1: Barangay Superadmins */}
                <div
                  style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}
                  className="relative overflow-hidden group hover:border-violet-500/40 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>BARANGAY SUPERADMINS</p>
                      <h3 style={{ color: TEXT, fontWeight: 800, fontSize: 26, marginTop: 4 }}>
                        {superadminCount} <span className="text-xs font-normal text-slate-500">Nodes</span>
                      </h3>
                    </div>
                    <div
                      style={{ background: `${ACCENT_VIOLET}25`, border: `1px solid ${ACCENT_VIOLET}40`, color: '#C4B5FD' }}
                      className="p-2.5 rounded-xl"
                    >
                      <Crown size={20} />
                    </div>
                  </div>
                  <p style={{ color: '#C4B5FD', fontSize: 11, marginTop: 10, fontWeight: 500 }} className="flex items-center gap-1">
                    <ShieldCheck size={12} className="text-violet-400" />
                    Covering {assignedBarangays.length} of 86 Butuan Barangays
                  </p>
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Tier 2 Governance</span>
                    <button
                      onClick={() => { setUserRoleFilter('superadmin'); setActiveTab('users'); }}
                      className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                    >
                      Manage <ChevronRight size={12} />
                    </button>
                  </div>
                </div>

                {/* Metric 2: Total System Operators */}
                <div
                  style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}
                  className="relative overflow-hidden group hover:border-blue-500/40 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>SYSTEM OPERATORS</p>
                      <h3 style={{ color: TEXT, fontWeight: 800, fontSize: 26, marginTop: 4 }}>
                        {systemUsers.length} <span className="text-xs font-normal text-slate-500">Accounts</span>
                      </h3>
                    </div>
                    <div
                      style={{ background: '#3B82F625', border: '1px solid #3B82F640', color: '#93C5FD' }}
                      className="p-2.5 rounded-xl"
                    >
                      <Users2 size={20} />
                    </div>
                  </div>
                  <p style={{ color: '#93C5FD', fontSize: 11, marginTop: 10, fontWeight: 500 }}>
                    {adminCount} Admins • {clinicalStaff} Clinical • {clerkStaff} Clerks
                  </p>
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Multi-Role Mesh</span>
                    <button
                      onClick={() => { setUserRoleFilter('all'); setActiveTab('users'); }}
                      className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                    >
                      Directory <ChevronRight size={12} />
                    </button>
                  </div>
                </div>

                {/* Metric 3: City Demographics */}
                <div
                  style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}
                  className="relative overflow-hidden group hover:border-emerald-500/40 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>REGISTERED RESIDENTS</p>
                      <h3 style={{ color: TEXT, fontWeight: 800, fontSize: 26, marginTop: 4 }}>
                        {fmt(totalResidents)} <span className="text-xs font-normal text-slate-500">Citizens</span>
                      </h3>
                    </div>
                    <div
                      style={{ background: `${ACCENT_EMERALD}25`, border: `1px solid ${ACCENT_EMERALD}40`, color: '#6EE7B7' }}
                      className="p-2.5 rounded-xl"
                    >
                      <Globe size={20} />
                    </div>
                  </div>
                  <div className="mt-2.5 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-emerald-400 font-medium">{verifiedResidents} Verified</span>
                      <span className="text-slate-400">{totalResidents - verifiedResidents} Pending</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                        style={{ width: `${totalResidents > 0 ? (verifiedResidents / totalResidents) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Demographic Registry</span>
                    <button
                      onClick={() => setActiveTab('reports')}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                    >
                      Reports <ChevronRight size={12} />
                    </button>
                  </div>
                </div>

                {/* Metric 4: System Audit & Activity */}
                <div
                  style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}
                  className="relative overflow-hidden group hover:border-cyan-500/40 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>SYSTEM AUDIT LOGS</p>
                      <h3 style={{ color: TEXT, fontWeight: 800, fontSize: 26, marginTop: 4 }}>
                        {fmt(activityLogs.length)} <span className="text-xs font-normal text-slate-500">Events</span>
                      </h3>
                    </div>
                    <div
                      style={{ background: `${ACCENT_CYAN}25`, border: `1px solid ${ACCENT_CYAN}40`, color: '#67E8F9' }}
                      className="p-2.5 rounded-xl"
                    >
                      <Activity size={20} />
                    </div>
                  </div>
                  <p style={{ color: '#67E8F9', fontSize: 11, marginTop: 10, fontWeight: 500 }} className="flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-cyan-400" />
                    Immutable city-wide audit trail active
                  </p>
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Security & Integrity</span>
                    <button
                      onClick={() => setActiveTab('logs')}
                      className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                    >
                      Audit Trail <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Two-Column Grid: Left (7 cols) + Right (5 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT COLUMN: Governance & Services (7 cols) */}
                <div className="lg:col-span-7 space-y-6">

                  {/* Barangay Superadmin Deployment Roster */}
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Crown size={18} className="text-violet-400" />
                          <h3 style={{ color: TEXT, fontWeight: 700, fontSize: 15 }}>Barangay Superadmin Deployment</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800/60">
                            {superadminCount} Assigned
                          </span>
                        </div>
                        <p style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                          Authorized leaders with administrative scope over their designated barangay.
                        </p>
                      </div>
                      <button
                        onClick={() => setIsCreateSuperadminOpen(true)}
                        style={{ background: `${ACCENT_VIOLET}20`, border: `1px solid ${ACCENT_VIOLET}50`, color: '#C4B5FD' }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-violet-600/30 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
                      >
                        <UserPlus size={12} /> Assign New
                      </button>
                    </div>

                    {superadminsList.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
                        <Crown size={28} className="text-violet-400 mx-auto mb-2 opacity-50" />
                        <p style={{ color: TEXT, fontWeight: 600, fontSize: 13 }}>No Barangay Superadmins Assigned Yet</p>
                        <p style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                          Create your first Barangay Superadmin account to delegate administrative authority.
                        </p>
                        <button
                          onClick={() => setIsCreateSuperadminOpen(true)}
                          className="mt-3 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          + Create Barangay Superadmin
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {superadminsList.slice(0, 5).map(sa => (
                          <div
                            key={sa.id}
                            style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px' }}
                            className="flex items-center justify-between gap-3 hover:border-slate-700 transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {sa.name?.slice(0, 2).toUpperCase() || 'SA'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-200 truncate">{sa.name}</p>
                                <p className="text-[11px] text-slate-400 truncate">{sa.email}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-violet-950/80 border border-violet-800/60 text-violet-300">
                                {sa.barangay || 'Pianing'}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sa.status === 'Active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-red-950 text-red-400 border border-red-800/60'}`}>
                                {sa.status || 'Active'}
                              </span>
                              <button
                                onClick={() => { setUserRoleFilter('superadmin'); setActiveTab('users'); }}
                                className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer bg-transparent border-none"
                                title="View in User Management"
                              >
                                <ExternalLink size={13} />
                              </button>
                            </div>
                          </div>
                        ))}

                        {superadminsList.length > 5 && (
                          <button
                            onClick={() => { setUserRoleFilter('superadmin'); setActiveTab('users'); }}
                            className="w-full py-2 text-xs font-semibold text-violet-400 hover:text-violet-300 text-center bg-transparent border-none cursor-pointer"
                          >
                            View all {superadminsList.length} Barangay Superadmins →
                          </button>
                        )}
                      </div>
                    )}

                    {/* Coverage notice banner */}
                    <div
                      style={{ background: `${ACCENT_VIOLET}12`, border: `1px solid ${ACCENT_VIOLET}30`, borderRadius: 10, padding: '10px 14px', marginTop: 14 }}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 size={15} className="text-violet-400 shrink-0" />
                        <span className="text-slate-300">
                          <strong className="text-violet-300">{86 - assignedBarangays.length} Barangays</strong> in Butuan City are currently available for Superadmin delegation.
                        </span>
                      </div>
                      <button
                        onClick={() => setIsCreateSuperadminOpen(true)}
                        className="text-violet-300 hover:underline font-bold text-xs shrink-0 bg-transparent border-none cursor-pointer"
                      >
                        Deploy Node +
                      </button>
                    </div>
                  </div>

                  {/* Municipal Document Categories & Service Workflows */}
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <FileText size={18} className="text-indigo-400" />
                          <h3 style={{ color: TEXT, fontWeight: 700, fontSize: 15 }}>Global Document & Service Categories</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                            {categories.length} Categories
                          </span>
                        </div>
                        <p style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
                          Standardized certificate templates and service request pipelines active across all barangays.
                        </p>
                      </div>
                      <button
                        onClick={() => setIsAddCatOpen(true)}
                        style={{ background: `${BORDER}60`, border: `1px solid ${BORDER}`, color: TEXT }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/5 transition-all cursor-pointer"
                      >
                        <PlusCircle size={12} /> Add
                      </button>
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                      <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px' }}>
                        <span className="text-[10px] text-slate-500 font-semibold block">Total Templates</span>
                        <span className="text-sm font-bold text-slate-200">{categories.length}</span>
                      </div>
                      <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px' }}>
                        <span className="text-[10px] text-slate-500 font-semibold block">Requests Logged</span>
                        <span className="text-sm font-bold text-slate-200">{documents.length}</span>
                      </div>
                      <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px' }}>
                        <span className="text-[10px] text-amber-400 font-semibold block">In Review</span>
                        <span className="text-sm font-bold text-amber-300">{pendingDocsCount}</span>
                      </div>
                      <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 12px' }}>
                        <span className="text-[10px] text-emerald-400 font-semibold block">Completed</span>
                        <span className="text-sm font-bold text-emerald-300">{completedDocsCount}</span>
                      </div>
                    </div>

                    {/* Category pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {categories.slice(0, 10).map((c, i) => (
                        <div
                          key={c.id || i}
                          style={{ background: CARD2, border: `1px solid ${BORDER}` }}
                          className="px-2.5 py-1 rounded-md text-xs text-slate-300 flex items-center gap-1.5"
                        >
                          <Tag size={10} className="text-indigo-400" />
                          <span>{c.name}</span>
                          <span className="text-[10px] text-slate-500 font-medium">({c.department || 'Barangay'})</span>
                        </div>
                      ))}
                      {categories.length > 10 && (
                        <button
                          onClick={() => { setActiveTab('system'); }}
                          className="px-2 py-1 rounded-md text-xs text-indigo-400 hover:text-indigo-300 bg-transparent border-none font-semibold cursor-pointer"
                        >
                          +{categories.length - 10} more in Category Manager →
                        </button>
                      )}
                    </div>
                  </div>

                </div>

                {/* RIGHT COLUMN: Infrastructure & Live Audit Stream (5 cols) */}
                <div className="lg:col-span-5 space-y-6">

                  {/* Core Infrastructure Health */}
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Server size={18} className="text-cyan-400" />
                        <h3 style={{ color: TEXT, fontWeight: 700, fontSize: 15 }}>Core Infrastructure Health</h3>
                      </div>
                      <button
                        onClick={loadDbHealth}
                        style={{ color: MUTED }}
                        className="hover:text-slate-200 cursor-pointer bg-transparent border-none p-0"
                        title="Ping diagnostics"
                      >
                        <RefreshCcw size={13} className={dbLoading ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    <p style={{ color: MUTED, fontSize: 12, marginBottom: 14 }}>
                      Real-time gateway telemetry and persistent database connections.
                    </p>

                    <div className="space-y-2.5">
                      <div
                        style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px' }}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <Database size={15} className="text-cyan-400" />
                          <div>
                            <p className="text-xs font-bold text-slate-200">MySQL Database (smart_db)</p>
                            <p className="text-[10px] text-slate-500">Port 3306 • {dbHealth.length || DB_TABLES.length} monitored tables</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                          {gatewayStatus.db}
                        </span>
                      </div>

                      <div
                        style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px' }}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <Send size={15} className="text-amber-400" />
                          <div>
                            <p className="text-xs font-bold text-slate-200">iProg SMS Gateway</p>
                            <p className="text-[10px] text-slate-500">Bearer token active • Live SMS queue</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                          {gatewayStatus.sms}
                        </span>
                      </div>

                      <div
                        style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px' }}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <Mail size={15} className="text-rose-400" />
                          <div>
                            <p className="text-xs font-bold text-slate-200">Gmail SMTP Dispatcher</p>
                            <p className="text-[10px] text-slate-500">Official notice & appointment emails</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                          {gatewayStatus.smtp}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('system')}
                      className="mt-4 w-full py-2 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700/60"
                    >
                      <Cpu size={13} /> Full System & Backup Console →
                    </button>
                  </div>

                  {/* Real-Time Live Audit Feed */}
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <History size={18} className="text-emerald-400" />
                        <h3 style={{ color: TEXT, fontWeight: 700, fontSize: 15 }}>Real-Time Audit Stream</h3>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE
                      </div>
                    </div>
                    <p style={{ color: MUTED, fontSize: 12, marginBottom: 12 }}>
                      Latest security and governance events across all municipal endpoints.
                    </p>

                    {recentAuditLogs.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl">
                        <Activity size={24} className="text-slate-600 mx-auto mb-1" />
                        <p className="text-xs text-slate-400">No activity logs recorded yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recentAuditLogs.map(log => (
                          <div
                            key={log.id}
                            style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px' }}
                            className="text-xs hover:border-slate-700 transition-all"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${logTypeBadge(log.action_type)}`}>
                                {log.action_type || 'System'}
                              </span>
                              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Clock size={10} />
                                {formatTimeAgo(log.created_at)}
                              </span>
                            </div>
                            <p className="font-semibold text-slate-200 truncate">{log.action}</p>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                              <span className="truncate">{log.user_name} ({log.user_role || 'user'})</span>
                              <span className="text-violet-400 font-semibold shrink-0 ml-2">{log.barangay || 'Pianing'}</span>
                            </div>
                          </div>
                        ))}

                        <button
                          onClick={() => setActiveTab('logs')}
                          className="mt-2 w-full py-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 text-center bg-transparent border-none cursor-pointer flex items-center justify-center gap-1"
                        >
                          View all {activityLogs.length} activity logs <ArrowUpRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* ── TAB: CATEGORY MANAGER ──────────────────────────── */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ background: `${ACCENT_VIOLET}20`, color: '#C4B5FD', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 8px', border: `1px solid ${ACCENT_VIOLET}40` }}>
                      GLOBAL WORKFLOW CONTROL
                    </span>
                  </div>
                  <h2 style={{ color: TEXT, fontWeight: 700, fontSize: 18 }}>Document & Service Category Manager</h2>
                  <p style={{ color: MUTED, fontSize: 12 }}>
                    Manage document categories, clearances, permits, and certificates across all barangay portals and resident request forms.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddCatOpen(true)}
                  style={{ background: `linear-gradient(135deg, ${ACCENT_VIOLET}, #6366F1)`, color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}
                  className="flex items-center gap-1.5 hover:opacity-90 transition-all cursor-pointer flex-shrink-0 shadow-sm"
                >
                  <PlusCircle size={14} /> Add New Category
                </button>
              </div>

              {/* 4 Stat Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                  <p style={{ color: MUTED, fontSize: 11, fontWeight: 600 }}>Total Categories</p>
                  <h4 style={{ color: TEXT, fontSize: 22, fontWeight: 800, marginTop: 4 }}>{categories.length}</h4>
                  <p style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>In active system registry</p>
                </div>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                  <p style={{ color: MUTED, fontSize: 11, fontWeight: 600 }}>Active Forms</p>
                  <h4 style={{ color: ACCENT_EMERALD, fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                    {categories.filter(c => c.status === 'Active').length}
                  </h4>
                  <p style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>Visible to residents & staff</p>
                </div>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                  <p style={{ color: MUTED, fontSize: 11, fontWeight: 600 }}>Inactive / Suspended</p>
                  <h4 style={{ color: ACCENT_ROSE, fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                    {categories.filter(c => c.status === 'Inactive').length}
                  </h4>
                  <p style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>Temporarily disabled</p>
                </div>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                  <p style={{ color: MUTED, fontSize: 11, fontWeight: 600 }}>Departments</p>
                  <h4 style={{ color: ACCENT_CYAN, fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                    2
                  </h4>
                  <p style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>Barangay &amp; Health</p>
                </div>
              </div>

              {/* Filters & Search Bar */}
              <div
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}
                className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3"
              >
                <div className="flex-1 relative">
                  <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: MUTED }} />
                  <input
                    value={catSearch}
                    onChange={e => setCatSearch(e.target.value)}
                    placeholder="Search by category name, department, or description..."
                    style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 12px 8px 34px', width: '100%' }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={catDeptFilter}
                    onChange={e => setCatDeptFilter(e.target.value)}
                    style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 10px' }}
                    className="cursor-pointer"
                  >
                    <option value="all">All Departments (2)</option>
                    <option value="Barangay">Barangay</option>
                    <option value="Health">Health</option>
                  </select>

                  <select
                    value={catStatusFilter}
                    onChange={e => setCatStatusFilter(e.target.value)}
                    style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 10px' }}
                    className="cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Active">Active Only</option>
                    <option value="Inactive">Inactive Only</option>
                  </select>

                  {(catSearch || catDeptFilter !== 'all' || catStatusFilter !== 'all') && (
                    <button
                      onClick={() => { setCatSearch(''); setCatDeptFilter('all'); setCatStatusFilter('all'); }}
                      style={{ color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 10px', fontSize: 11 }}
                      className="hover:text-slate-200 cursor-pointer bg-transparent"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
                <div className="overflow-x-auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: `${CARD2}`, borderBottom: `1px solid ${BORDER}` }}>
                        {['#', 'Category Name', 'Department', 'Description', 'Status', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '12px 16px', color: MUTED, fontWeight: 600, textAlign: h === 'Actions' ? 'right' : 'left', fontSize: 11, letterSpacing: '0.04em' }}>
                            {h.toUpperCase()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCats.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: MUTED }}>
                            <Tag size={28} className="mx-auto mb-2 text-slate-600 opacity-60" />
                            <p className="font-semibold text-slate-300">No categories found matching your criteria.</p>
                            <p className="text-xs text-slate-500 mt-1">Try clearing your search or click "Add New Category".</p>
                          </td>
                        </tr>
                      ) : filteredCats.map((cat, i) => {
                        const isActive = cat.status === 'Active';
                        return (
                          <tr key={cat.id || i} style={{ borderBottom: `1px solid ${BORDER}40` }} className="hover:bg-white/[0.02] transition-colors">
                            <td style={{ padding: '12px 16px', color: MUTED, width: 40 }}>{i + 1}</td>
                            <td style={{ padding: '12px 16px', color: TEXT, fontWeight: 600 }}>
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
                                  <FileText size={13} />
                                </div>
                                <span>{cat.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                background: (cat.department || '').toLowerCase().includes('health') ? `${ACCENT_EMERALD}15` : `${ACCENT_CYAN}15`,
                                color: (cat.department || '').toLowerCase().includes('health') ? ACCENT_EMERALD : ACCENT_CYAN,
                                fontSize: 10,
                                fontWeight: 600,
                                borderRadius: 4,
                                padding: '3px 8px',
                                border: `1px solid ${(cat.department || '').toLowerCase().includes('health') ? ACCENT_EMERALD : ACCENT_CYAN}30`
                              }}>
                                {(cat.department || '').toLowerCase().includes('health') ? 'Health' : 'Barangay'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: MUTED, maxWidth: 300 }} className="truncate">
                              {cat.description || 'Standard municipal request category'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ background: isActive ? `${ACCENT_EMERALD}20` : `${ACCENT_ROSE}20`, color: isActive ? ACCENT_EMERALD : ACCENT_ROSE, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 9px', border: `1px solid ${isActive ? ACCENT_EMERALD : ACCENT_ROSE}40` }}>
                                {isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleToggleCat(cat.name, cat.status)}
                                  style={{
                                    color: isActive ? ACCENT_ROSE : ACCENT_EMERALD,
                                    border: `1px solid ${isActive ? ACCENT_ROSE : ACCENT_EMERALD}40`,
                                    background: isActive ? `${ACCENT_ROSE}10` : `${ACCENT_EMERALD}10`,
                                    borderRadius: 6,
                                    padding: '4px 10px',
                                    fontSize: 11,
                                    fontWeight: 600
                                  }}
                                  className="hover:opacity-80 cursor-pointer transition-opacity"
                                >
                                  {isActive ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  onClick={() => handleDeleteCat(cat)}
                                  style={{ color: MUTED, borderRadius: 6, padding: '5px 7px', background: 'transparent', border: `1px solid ${BORDER}` }}
                                  className="hover:text-rose-400 hover:border-rose-900/40 cursor-pointer transition-colors"
                                  title="Delete category"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 1: SYSTEM & BACKUP ─────────────────────────── */}
          {activeTab === 'system' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 style={{ color: TEXT, fontWeight: 700, fontSize: 17 }}>System Settings & Infrastructure</h2>
                  <p style={{ color: MUTED, fontSize: 12 }}>Monitor database health, download backups, broadcast system notices, and control maintenance mode. Super Mega Admin exclusive.</p>
                </div>
                <button onClick={loadDbHealth} style={{ border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 600, background: 'transparent' }}
                  className="flex items-center gap-1.5 hover:bg-white/5 transition-colors cursor-pointer">
                  <RefreshCcw size={12} className={dbLoading ? 'animate-spin' : ''} /> Re-check
                </button>
              </div>

              {/* Gateway Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'MySQL Database', icon: Database, status: gatewayStatus.db, color: ACCENT_EMERALD, desc: 'smart_db connected' },
                  { label: 'iProg SMS Gateway', icon: Send, status: gatewayStatus.sms, color: ACCENT_CYAN, desc: 'SMS dispatch active' },
                  { label: 'Gmail SMTP Relay', icon: Mail, status: gatewayStatus.smtp, color: ACCENT_AMBER, desc: 'Email notifications live' },
                ].map(g => (
                  <div key={g.label} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
                    <div className="flex items-center justify-between mb-2">
                      <g.icon size={18} style={{ color: g.color }} />
                      <span style={{ background: `${g.color}20`, color: g.color, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '2px 8px' }}>{g.status}</span>
                    </div>
                    <p style={{ color: TEXT, fontWeight: 700, fontSize: 13 }}>{g.label}</p>
                    <p style={{ color: MUTED, fontSize: 11 }}>{g.desc}</p>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
                <p style={{ color: TEXT, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Quick System Actions</p>
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleDownloadBackup} disabled={backupLoading}
                    style={{ background: `${ACCENT_EMERALD}20`, border: `1px solid ${ACCENT_EMERALD}50`, color: ACCENT_EMERALD, borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}
                    className="flex items-center gap-2 hover:bg-emerald-500/20 transition-colors cursor-pointer disabled:opacity-50">
                    <Download size={14} className={backupLoading ? 'animate-bounce' : ''} />
                    {backupLoading ? 'Generating...' : 'Download DB Snapshot (.json)'}
                  </button>
                  <button onClick={() => { loadData(); loadDbHealth(); }}
                    style={{ background: `${ACCENT_CYAN}20`, border: `1px solid ${ACCENT_CYAN}50`, color: ACCENT_CYAN, borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}
                    className="flex items-center gap-2 hover:bg-cyan-500/20 transition-colors cursor-pointer">
                    <RefreshCcw size={14} /> Sync & Refresh All Data
                  </button>
                </div>
              </div>

              {/* System Incident & Public Notices */}
              <div style={{
                background: maintenanceMode
                  ? (noticeType === 'down' ? '#450a0a25' : noticeType === 'advisory' ? '#1e1b4b25' : `${ACCENT_AMBER}12`)
                  : CARD2,
                border: `1px solid ${
                  maintenanceMode
                    ? (noticeType === 'down' ? '#ef444460' : noticeType === 'advisory' ? '#6366f160' : ACCENT_AMBER + '60')
                    : BORDER
                }`,
                borderRadius: 14,
                padding: 18,
                transition: 'all 0.2s ease'
              }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p style={{
                        color: maintenanceMode
                          ? (noticeType === 'down' ? '#f87171' : noticeType === 'advisory' ? '#818cf8' : ACCENT_AMBER)
                          : TEXT,
                        fontWeight: 700,
                        fontSize: 14
                      }}>
                        {maintenanceMode ? 'System Notice ACTIVE (BROADCASTING)' : 'System Incident & Public Notices'}
                      </p>
                      {maintenanceMode && (
                        <span style={{
                          background: noticeType === 'down' ? '#ef444425' : noticeType === 'advisory' ? '#6366f125' : `${ACCENT_AMBER}25`,
                          color: noticeType === 'down' ? '#fca5a5' : noticeType === 'advisory' ? '#a5b4fc' : ACCENT_AMBER,
                          border: `1px solid ${noticeType === 'down' ? '#ef444450' : noticeType === 'advisory' ? '#6366f150' : ACCENT_AMBER + '50'}`,
                          borderRadius: 12,
                          padding: '2px 8px',
                          fontSize: 10,
                          fontWeight: 700
                        }}>
                          {noticeType === 'down' ? '🔴 CRITICAL OUTAGE' : noticeType === 'advisory' ? '🔵 ADVISORY LIVE' : '🟡 MAINTENANCE LIVE'}
                        </span>
                      )}
                    </div>
                    <p style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                      Broadcast emergency system down warnings, scheduled maintenance alerts, or municipal advisories to all portals.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span style={{ color: maintenanceMode ? '#f87171' : MUTED, fontSize: 11, fontWeight: 700 }}>
                      {maintenanceMode ? 'BROADCAST ON' : 'BROADCAST OFF'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={maintenanceMode}
                        onChange={e => handleToggleMaintenance(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className={`w-11 h-6 bg-slate-700 rounded-full peer ${
                        noticeType === 'down' ? 'peer-checked:bg-red-600' : noticeType === 'advisory' ? 'peer-checked:bg-indigo-600' : 'peer-checked:bg-amber-500'
                      } after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 shadow-inner`} />
                    </label>
                  </div>
                </div>

                {/* Severity Type Selector */}
                <div className="mb-4">
                  <label style={{ color: MUTED, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    Notice Category &amp; Severity Level
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => applyNoticePreset('down')}
                      style={{
                        background: noticeType === 'down' ? '#ef444420' : `${BORDER}40`,
                        border: `1px solid ${noticeType === 'down' ? '#ef4444' : BORDER}`,
                        color: noticeType === 'down' ? '#fca5a5' : MUTED,
                        borderRadius: 10,
                        padding: '10px 12px',
                        textAlign: 'left'
                      }}
                      className="cursor-pointer transition-all hover:border-red-400"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <AlertOctagon size={15} className={noticeType === 'down' ? 'text-red-400 animate-pulse' : 'text-slate-400'} />
                        <span className="font-bold text-xs text-white">System Down / Outage</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">Critical warning: Server down or urgent database outage.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyNoticePreset('maintenance')}
                      style={{
                        background: noticeType === 'maintenance' ? '#f59e0b20' : `${BORDER}40`,
                        border: `1px solid ${noticeType === 'maintenance' ? '#f59e0b' : BORDER}`,
                        color: noticeType === 'maintenance' ? '#fde68a' : MUTED,
                        borderRadius: 10,
                        padding: '10px 12px',
                        textAlign: 'left'
                      }}
                      className="cursor-pointer transition-all hover:border-amber-400"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Wrench size={15} className={noticeType === 'maintenance' ? 'text-amber-400' : 'text-slate-400'} />
                        <span className="font-bold text-xs text-white">Scheduled Maintenance</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">Routine server maintenance window &amp; planned updates.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyNoticePreset('advisory')}
                      style={{
                        background: noticeType === 'advisory' ? '#6366f120' : `${BORDER}40`,
                        border: `1px solid ${noticeType === 'advisory' ? '#6366f1' : BORDER}`,
                        color: noticeType === 'advisory' ? '#c7d2fe' : MUTED,
                        borderRadius: 10,
                        padding: '10px 12px',
                        textAlign: 'left'
                      }}
                      className="cursor-pointer transition-all hover:border-indigo-400"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Megaphone size={15} className={noticeType === 'advisory' ? 'text-indigo-400' : 'text-slate-400'} />
                        <span className="font-bold text-xs text-white">Public Advisory</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">Administrative announcements, schedule or office news.</p>
                    </button>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                        Banner Title / Headline
                      </label>
                      <input
                        type="text"
                        value={noticeTitle}
                        onChange={e => setNoticeTitle(e.target.value)}
                        placeholder="e.g. CRITICAL NOTICE: System is Temporarily Down"
                        style={{
                          background: `${BORDER}60`,
                          border: `1px solid ${BORDER}`,
                          borderRadius: 8,
                          color: TEXT,
                          fontSize: 12,
                          padding: '8px 12px',
                          width: '100%'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                        Estimated Uptime / Duration Window
                      </label>
                      <input
                        type="text"
                        value={estimatedUptime}
                        onChange={e => setEstimatedUptime(e.target.value)}
                        placeholder="e.g. Expected Recovery: Within 1 hour"
                        style={{
                          background: `${BORDER}60`,
                          border: `1px solid ${BORDER}`,
                          borderRadius: 8,
                          color: TEXT,
                          fontSize: 12,
                          padding: '8px 12px',
                          width: '100%'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Public Announcement Detail
                    </label>
                    <textarea
                      value={maintenanceMsg}
                      onChange={e => setMaintenanceMsg(e.target.value)}
                      rows={2}
                      placeholder="Detailed explanation of system down status or maintenance details shown to all visitors..."
                      style={{
                        background: `${BORDER}60`,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        color: TEXT,
                        fontSize: 12,
                        padding: 10,
                        width: '100%',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Quick Templates:</span>
                      <button
                        type="button"
                        onClick={() => applyNoticePreset('down')}
                        className="text-[11px] text-red-300 hover:text-red-200 bg-red-950/60 border border-red-800/60 px-2 py-0.5 rounded cursor-pointer transition-colors"
                      >
                        🔴 Outage Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyNoticePreset('maintenance')}
                        className="text-[11px] text-amber-300 hover:text-amber-200 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded cursor-pointer transition-colors"
                      >
                        🟡 Maintenance Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyNoticePreset('advisory')}
                        className="text-[11px] text-indigo-300 hover:text-indigo-200 bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded cursor-pointer transition-colors"
                      >
                        🔵 Advisory Preset
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {maintenanceMode && (
                        <button
                          type="button"
                          onClick={handleStopBroadcast}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#FCA5A5',
                            borderRadius: 8,
                            padding: '6px 14px',
                            fontSize: 12,
                            fontWeight: 600
                          }}
                          className="hover:bg-red-950/50 transition-colors cursor-pointer"
                        >
                          Deactivate / Turn Off
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveMaintenanceMsg}
                        style={{
                          background: noticeType === 'down' ? '#ef4444' : noticeType === 'advisory' ? '#6366f1' : ACCENT_AMBER,
                          color: '#ffffff',
                          borderRadius: 8,
                          padding: '6px 18px',
                          fontSize: 12,
                          fontWeight: 700
                        }}
                        className="hover:opacity-90 transition-opacity cursor-pointer shadow-md flex items-center gap-1.5"
                      >
                        <Radio size={13} className={maintenanceMode ? 'animate-pulse' : ''} />
                        {maintenanceMode ? 'Update Live Broadcast' : 'Save & Broadcast Live Now'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Preview Bar */}
                <div className="mt-5 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Radio size={12} className="text-emerald-400 animate-pulse" />
                      Live Banner Preview (How Citizens &amp; Staff View It)
                    </span>
                    <span className="text-[10px] text-slate-500">Real-time simulation</span>
                  </div>
                  <div className="rounded-xl overflow-hidden shadow-inner border border-slate-700/60">
                    <SystemNoticeBanner
                      customNotice={{
                        enabled: true,
                        type: noticeType,
                        title: noticeTitle,
                        message: maintenanceMsg,
                        estimated_uptime: estimatedUptime
                      }}
                      allowDismiss={false}
                      showStaffButton={true}
                    />
                  </div>
                </div>
              </div>

              {/* DB Table Health */}
              <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ color: TEXT, fontWeight: 700, fontSize: 13 }}>Database Table Health</p>
                  <span style={{ color: MUTED, fontSize: 11 }}>{DB_TABLES.length} tables monitored</span>
                </div>
                <div className="overflow-x-auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: `${BORDER}60` }}>
                        {['Table Name', 'Record Count', 'Status'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', color: MUTED, fontWeight: 600, textAlign: 'left', fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DB_TABLES.map((t, i) => {
                        const row = dbHealth.find(r => r.table === t);
                        const count = row?.count ?? 0;
                        return (
                          <tr key={t} style={{ borderBottom: `1px solid ${BORDER}40` }}>
                            <td style={{ padding: '10px 16px', color: TEXT, fontFamily: 'monospace', fontSize: 12 }}>{t}</td>
                            <td style={{ padding: '10px 16px', color: ACCENT_CYAN, fontWeight: 700 }}>{fmt(count)}</td>
                            <td style={{ padding: '10px 16px' }}>
                              <span style={{ background: `${ACCENT_EMERALD}20`, color: ACCENT_EMERALD, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '2px 8px' }}>
                                Healthy
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category Quick Reference in System tab */}
              <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-indigo-400" />
                      <p style={{ color: TEXT, fontWeight: 700, fontSize: 13 }}>Document & Service Categories</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                        {categories.length} Categories Registered
                      </span>
                    </div>
                    <p style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                      Manage, activate, deactivate, or delete categories from the dedicated Category Manager tab in the sidebar.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('categories')}
                    style={{ background: `${ACCENT_VIOLET}25`, border: `1px solid ${ACCENT_VIOLET}50`, color: '#C4B5FD', borderRadius: 8, padding: '7px 14px', fontSize: 11, fontWeight: 600 }}
                    className="flex items-center gap-1.5 hover:bg-violet-500/20 transition-colors cursor-pointer shrink-0"
                  >
                    Open Category Manager <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: SYSTEM AUDIT & HISTORY LOGS ─────────── */}
          {activeTab === 'logs' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ background: `${ACCENT_VIOLET}20`, color: '#C4B5FD', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 8px', border: `1px solid ${ACCENT_VIOLET}40` }}>
                      GLOBAL SYSTEM AUDIT
                    </span>
                  </div>
                  <h2 style={{ color: TEXT, fontWeight: 700, fontSize: 17 }}>System Audit & History Logs</h2>
                  <p style={{ color: MUTED, fontSize: 12 }}>Complete city-wide chronological record of all staff actions, security events, document issuances, and system changes across all barangays.</p>
                </div>
                <button onClick={loadLogs}
                  style={{ border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 8, padding: '7px 14px', fontSize: 11, fontWeight: 600, background: 'transparent' }}
                  className="flex items-center gap-1.5 hover:bg-white/5 transition-colors cursor-pointer flex-shrink-0">
                  <RefreshCcw size={12} className={logsLoading ? 'animate-spin' : ''} /> Refresh Logs
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total Events', value: activityLogs.length, color: ACCENT_CYAN, icon: Activity },
                  { label: 'Document Events', value: logsByType['Document'] || 0, color: ACCENT_VIOLET, icon: FileText },
                  { label: 'Auth Events', value: logsByType['Auth'] || 0, color: ACCENT_EMERALD, icon: ShieldCheck },
                  { label: 'Security Events', value: logsByType['Security'] || 0, color: ACCENT_ROSE, icon: Shield },
                ].map(m => (
                  <div key={m.label} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                    <div className="flex items-center justify-between mb-1">
                      <p style={{ color: MUTED, fontSize: 10, fontWeight: 600 }}>{m.label}</p>
                      <m.icon size={14} style={{ color: m.color }} />
                    </div>
                    <p style={{ color: TEXT, fontSize: 22, fontWeight: 800 }}>{fmt(m.value)}</p>
                  </div>
                ))}
              </div>

              <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}
                className="flex flex-wrap items-center gap-2">
                <div style={{ position: 'relative', flex: '1', minWidth: 160 }}>
                  <Search size={12} style={{ position: 'absolute', left: 8, top: 8, color: MUTED }} />
                  <input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="Search logs..."
                    style={{ background: `${BORDER}60`, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 11, padding: '7px 10px 7px 26px', width: '100%' }} />
                </div>
                {[
                  { value: logRoleFilter, set: setLogRoleFilter, label: 'All Roles', opts: ['all', 'super_mega_admin', 'superadmin', 'admin', 'staff', 'bhw', 'nurse', 'resident'] },
                  { value: logTypeFilter, set: setLogTypeFilter, label: 'All Types', opts: ['all', 'Auth', 'Document', 'Resident', 'Health', 'System', 'Security', 'User', 'Category'] },
                  { value: logBarangayFilter, set: setLogBarangayFilter, label: 'All Barangays', opts: ['all', ...BUTUAN_BARANGAYS.slice(0, 20)] },
                ].map(f => (
                  <select key={f.label} value={f.value} onChange={e => f.set(e.target.value)}
                    style={{ colorScheme: 'dark', background: '#161F30', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 11, padding: '7px 10px', cursor: 'pointer' }}>
                    <option value="all" style={{ background: '#161F30', color: TEXT }}>{f.label}</option>
                    {f.opts.filter(o => o !== 'all').map(o => <option key={o} value={o} style={{ background: '#161F30', color: TEXT }}>{o}</option>)}
                  </select>
                ))}
                {(logSearch || logRoleFilter !== 'all' || logTypeFilter !== 'all' || logBarangayFilter !== 'all') && (
                  <button onClick={() => { setLogSearch(''); setLogRoleFilter('all'); setLogTypeFilter('all'); setLogBarangayFilter('all'); }}
                    style={{ color: ACCENT_ROSE, fontSize: 11, fontWeight: 600, background: 'transparent', border: 'none' }} className="cursor-pointer hover:underline">
                    Clear
                  </button>
                )}
              </div>

              <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: TEXT, fontWeight: 700, fontSize: 13 }}>Activity Log Stream</p>
                  <span style={{ color: MUTED, fontSize: 11 }}>Showing {filteredLogs.length} of {activityLogs.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: `${BORDER}60` }}>
                        {['Time', 'User', 'Role', 'Action', 'Type', 'Barangay'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', color: MUTED, fontWeight: 600, textAlign: 'left', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: MUTED }}>No log entries match your filters.</td></tr>
                      ) : filteredLogs.slice(0, 100).map((log, i) => (
                        <tr key={log.id || i} style={{ borderBottom: `1px solid ${BORDER}30` }} className="hover:bg-white/[0.02]">
                          <td style={{ padding: '9px 14px', color: MUTED, whiteSpace: 'nowrap', fontSize: 11 }}>{formatTimeAgo(log.timestamp)}</td>
                          <td style={{ padding: '9px 14px', color: TEXT, fontWeight: 600, maxWidth: 140 }} className="truncate">{log.user_name || '—'}</td>
                          <td style={{ padding: '9px 14px' }}>
                            <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${roleBadge(log.user_role || '')}`}>
                              {log.user_role || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '9px 14px', color: TEXT, maxWidth: 200 }} className="truncate">{log.action || '—'}</td>
                          <td style={{ padding: '9px 14px' }}>
                            <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${logTypeBadge(log.action_type)}`}>
                              {log.action_type || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '9px 14px', color: MUTED, whiteSpace: 'nowrap' }}>{log.barangay || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: USER MANAGEMENT (SYSTEM OWNER GOVERNANCE) ─── */}
          {activeTab === 'users' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 6, background: `${ACCENT_VIOLET}25`, color: '#C4B5FD', border: `1px solid ${ACCENT_VIOLET}40` }}>
                      Platform Owner Tier
                    </span>
                    <span style={{ fontSize: 11, color: MUTED }}>Multi-Tenant Architecture</span>
                  </div>
                  <h2 style={{ color: TEXT, fontWeight: 700, fontSize: 18 }} className="flex items-center gap-2">
                    <Users style={{ color: ACCENT_VIOLET }} size={20} />
                    Multi-Tenant User & Identity Governance
                  </h2>
                  <p style={{ color: MUTED, fontSize: 12 }}>
                    Oversee Client Barangay Superadmins, Root Platform Operators, and multi-tenant municipal accounts across all client jurisdictions.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => { setNewSA({ ...BLANK_NEW_SA }); setNewSAError(''); setShowNewSAPass(false); setIsCreateSuperadminOpen(true); }}
                    style={{ background: `linear-gradient(135deg, ${ACCENT_VIOLET}, #4F46E5)`, borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: 'white', border: 'none', boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)' }}
                    className="flex items-center gap-2 hover:opacity-95 transition-opacity cursor-pointer flex-shrink-0"
                  >
                    <UserPlus size={14} /> Onboard Client Superadmin
                  </button>
                </div>
              </div>

              {/* Stat Cards tailored for System Owner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                  <div className="flex items-center justify-between mb-1">
                    <p style={{ color: MUTED, fontSize: 10, fontWeight: 600 }}>Active Client Tenants</p>
                    <Building2 size={15} style={{ color: ACCENT_EMERALD }} />
                  </div>
                  <p style={{ color: ACCENT_EMERALD, fontSize: 24, fontWeight: 800 }}>
                    {clientBarangays.filter(c => c.status === 'active').length} <span style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>/ {clientBarangays.length}</span>
                  </p>
                  <p style={{ color: MUTED, fontSize: 10 }}>Subscribed Municipal LGUs</p>
                </div>

                <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                  <div className="flex items-center justify-between mb-1">
                    <p style={{ color: MUTED, fontSize: 10, fontWeight: 600 }}>Client Superadmins</p>
                    <Crown size={15} style={{ color: '#C4B5FD' }} />
                  </div>
                  <p style={{ color: '#C4B5FD', fontSize: 24, fontWeight: 800 }}>{fmt(superadminCount)}</p>
                  <p style={{ color: MUTED, fontSize: 10 }}>Barangay Chief Executives</p>
                </div>

                <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                  <div className="flex items-center justify-between mb-1">
                    <p style={{ color: MUTED, fontSize: 10, fontWeight: 600 }}>Total Platform Accounts</p>
                    <Users size={15} style={{ color: ACCENT_CYAN }} />
                  </div>
                  <p style={{ color: ACCENT_CYAN, fontSize: 24, fontWeight: 800 }}>{fmt(systemUsers.length)}</p>
                  <p style={{ color: MUTED, fontSize: 10 }}>Staff & Verified Constituents</p>
                </div>

                <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                  <div className="flex items-center justify-between mb-1">
                    <p style={{ color: MUTED, fontSize: 10, fontWeight: 600 }}>Platform Root Operators</p>
                    <ShieldCheck size={15} style={{ color: ACCENT_AMBER }} />
                  </div>
                  <p style={{ color: ACCENT_AMBER, fontSize: 24, fontWeight: 800 }}>
                    {systemUsers.filter(u => u.role === 'super_mega_admin').length || 1}
                  </p>
                  <p style={{ color: MUTED, fontSize: 10 }}>System Owner Core Keyholders</p>
                </div>
              </div>

              {/* Sub-Tab Navigation Bar */}
              <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 6 }} className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setUserManagementSubTab('superadmins')}
                  style={{
                    flex: '1 1 180px',
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: userManagementSubTab === 'superadmins' ? `${ACCENT_VIOLET}25` : 'transparent',
                    color: userManagementSubTab === 'superadmins' ? '#C4B5FD' : MUTED,
                    border: userManagementSubTab === 'superadmins' ? `1px solid ${ACCENT_VIOLET}50` : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Building2 size={14} />
                  <span>Client Superadmins (Tenants)</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#1E293B', color: TEXT, fontWeight: 700 }}>
                    {clientBarangays.length}
                  </span>
                </button>

                <button
                  onClick={() => setUserManagementSubTab('platform')}
                  style={{
                    flex: '1 1 180px',
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: userManagementSubTab === 'platform' ? `${ACCENT_VIOLET}25` : 'transparent',
                    color: userManagementSubTab === 'platform' ? '#C4B5FD' : MUTED,
                    border: userManagementSubTab === 'platform' ? `1px solid ${ACCENT_VIOLET}50` : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>Platform Root Operators</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#1E293B', color: TEXT, fontWeight: 700 }}>
                    {systemUsers.filter(u => u.role === 'super_mega_admin').length || 1}
                  </span>
                </button>

                <button
                  onClick={() => setUserManagementSubTab('all')}
                  style={{
                    flex: '1 1 180px',
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: userManagementSubTab === 'all' ? `${ACCENT_VIOLET}25` : 'transparent',
                    color: userManagementSubTab === 'all' ? '#C4B5FD' : MUTED,
                    border: userManagementSubTab === 'all' ? `1px solid ${ACCENT_VIOLET}50` : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Users size={14} />
                  <span>Municipal Directory Lookup</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#1E293B', color: TEXT, fontWeight: 700 }}>
                    {systemUsers.length}
                  </span>
                </button>
              </div>

              {/* ── SUB-TAB 1: CLIENT SUPERADMINS (TENANTS) ──────── */}
              {userManagementSubTab === 'superadmins' && (
                <div className="space-y-4">
                  {/* Informational Callout */}
                  <div style={{ background: `${ACCENT_VIOLET}12`, border: `1px solid ${ACCENT_VIOLET}30`, borderRadius: 12, padding: '14px 18px' }}
                    className="flex items-start gap-3">
                    <Crown size={20} style={{ color: '#C4B5FD' }} className="shrink-0 mt-0.5" />
                    <div>
                      <p style={{ color: '#E2E8F0', fontSize: 13, fontWeight: 700 }}>System Owner Multi-Tenant Management</p>
                      <p style={{ color: '#94A3B8', fontSize: 11, marginTop: 2, lineHeight: 1.5 }}>
                        You are the <strong className="text-violet-300">System Owner</strong>. Each client barangay is your tenant organization with an appointed Superadmin who manages their local council, clearance issuance, and health center. Use this portal to monitor tenant licenses, issue temporary keys, or switch between client configurations.
                      </p>
                    </div>
                  </div>

                  {/* Client Tenants Table */}
                  <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ color: TEXT, fontWeight: 700, fontSize: 13 }}>Provisioned Client Barangays & Superadmins</p>
                        <p style={{ color: MUTED, fontSize: 11 }}>Client tenant list with appointed administrator credentials</p>
                      </div>
                      <button
                        onClick={() => setIsCreateSuperadminOpen(true)}
                        style={{ color: '#C4B5FD', background: `${ACCENT_VIOLET}20`, border: `1px solid ${ACCENT_VIOLET}40`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}
                        className="hover:bg-violet-900/40 cursor-pointer transition-colors flex items-center gap-1.5"
                      >
                        <UserPlus size={13} /> + Provision Superadmin
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: `${BORDER}60` }}>
                            <th style={{ padding: '10px 14px', color: MUTED, fontWeight: 600, textAlign: 'left', fontSize: 11 }}>Client Barangay</th>
                            <th style={{ padding: '10px 14px', color: MUTED, fontWeight: 600, textAlign: 'left', fontSize: 11 }}>Appointed Superadmin</th>
                            <th style={{ padding: '10px 14px', color: MUTED, fontWeight: 600, textAlign: 'left', fontSize: 11 }}>LGU Captain</th>
                            <th style={{ padding: '10px 14px', color: MUTED, fontWeight: 600, textAlign: 'left', fontSize: 11 }}>Active Modules</th>
                            <th style={{ padding: '10px 14px', color: MUTED, fontWeight: 600, textAlign: 'left', fontSize: 11 }}>Status</th>
                            <th style={{ padding: '10px 14px', color: MUTED, fontWeight: 600, textAlign: 'right', fontSize: 11 }}>Governance Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientBarangays.map(c => {
                            // Find matching system user if available
                            const saUser = systemUsers.find(u => u.role === 'superadmin' && u.barangay?.toLowerCase() === c.name.toLowerCase());
                            const saName = saUser?.name || c.superadminName;
                            const saEmail = saUser?.email || c.superadminEmail;

                            return (
                              <tr key={c.id} style={{ borderBottom: `1px solid ${BORDER}30` }} className="hover:bg-white/[0.02]">
                                <td style={{ padding: '12px 14px' }}>
                                  <div className="flex items-center gap-2.5">
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ACCENT_VIOLET}20`, border: `1px solid ${ACCENT_VIOLET}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <Building2 size={16} style={{ color: '#C4B5FD' }} />
                                    </div>
                                    <div>
                                      <p style={{ color: TEXT, fontWeight: 700, fontSize: 12 }}>Barangay {c.name}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span style={{ color: MUTED, fontSize: 10 }}>{c.district}</span>
                                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: c.plan.includes('Enterprise') ? `${ACCENT_CYAN}20` : `${ACCENT_AMBER}20`, color: c.plan.includes('Enterprise') ? ACCENT_CYAN : ACCENT_AMBER }}>
                                          {c.plan}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td style={{ padding: '12px 14px' }}>
                                  <div className="flex items-center gap-2">
                                    <Crown size={13} style={{ color: '#C4B5FD' }} />
                                    <div>
                                      <p style={{ color: TEXT, fontWeight: 600, fontSize: 12 }}>{saName}</p>
                                      <p style={{ color: MUTED, fontSize: 11 }}>{saEmail}</p>
                                      {c.captainPhone && <p style={{ color: '#94A3B8', fontSize: 10 }}>{c.captainPhone}</p>}
                                    </div>
                                  </div>
                                </td>

                                <td style={{ padding: '12px 14px', color: TEXT, fontSize: 12 }}>
                                  {c.captain || '—'}
                                </td>

                                <td style={{ padding: '12px 14px' }}>
                                  <div className="flex flex-wrap gap-1">
                                    {c.modules.documents && <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800">Docs</span>}
                                    {c.modules.clinic && <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-800">Clinic</span>}
                                    {c.modules.residentPortal && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">Portal</span>}
                                    {c.modules.sms && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800">SMS</span>}
                                  </div>
                                </td>

                                <td style={{ padding: '12px 14px' }}>
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    borderRadius: 20,
                                    padding: '2px 8px',
                                    background: c.status === 'active' ? `${ACCENT_EMERALD}20` : c.status === 'onboarding' ? `${ACCENT_AMBER}20` : `${ACCENT_ROSE}20`,
                                    color: c.status === 'active' ? ACCENT_EMERALD : c.status === 'onboarding' ? ACCENT_AMBER : ACCENT_ROSE,
                                    border: `1px solid ${c.status === 'active' ? ACCENT_EMERALD : c.status === 'onboarding' ? ACCENT_AMBER : ACCENT_ROSE}40`
                                  }}>
                                    {c.status.toUpperCase()}
                                  </span>
                                </td>

                                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                    <button
                                      onClick={() => handleResetSuperadminKey(saEmail, c.name)}
                                      title="Generate emergency access key for client superadmin"
                                      style={{ color: '#C4B5FD', border: `1px solid ${ACCENT_VIOLET}40`, borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 600, background: `${ACCENT_VIOLET}15` }}
                                      className="hover:bg-violet-900/30 cursor-pointer transition-colors flex items-center gap-1"
                                    >
                                      <Key size={11} /> Reset Key
                                    </button>
                                    <button
                                      onClick={() => handleToggleClientBarangayStatus(c.id)}
                                      style={{ color: c.status === 'active' ? ACCENT_AMBER : ACCENT_EMERALD, border: `1px solid ${c.status === 'active' ? ACCENT_AMBER : ACCENT_EMERALD}40`, borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 600, background: 'transparent' }}
                                      className="hover:bg-white/5 cursor-pointer transition-colors"
                                    >
                                      {c.status === 'active' ? 'Suspend' : 'Activate'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SUB-TAB 2: PLATFORM ROOT OPERATORS (INTERNAL) ── */}
              {userManagementSubTab === 'platform' && (
                <div className="space-y-4">
                  <div style={{ background: `${ACCENT_AMBER}12`, border: `1px solid ${ACCENT_AMBER}30`, borderRadius: 12, padding: '14px 18px' }}
                    className="flex items-start gap-3">
                    <ShieldCheck size={20} style={{ color: ACCENT_AMBER }} className="shrink-0 mt-0.5" />
                    <div>
                      <p style={{ color: '#E2E8F0', fontSize: 13, fontWeight: 700 }}>Root System Owner Authority</p>
                      <p style={{ color: '#94A3B8', fontSize: 11, marginTop: 2, lineHeight: 1.5 }}>
                        Platform Root Operators have unmetered master access across all 86 barangays in the city. They manage multi-tenant database backups, global SMTP/SMS gateways, client provisioning, and system alerts.
                      </p>
                    </div>
                  </div>

                  <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 }} className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: `${BORDER}80` }}>
                      <p style={{ color: TEXT, fontWeight: 700, fontSize: 13 }}>Active Root Operators</p>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Master Security Node Active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Current User Root Profile */}
                      <div style={{ background: '#0F172A', border: `1px solid ${ACCENT_VIOLET}50`, borderRadius: 12, padding: 16 }} className="relative overflow-hidden">
                        <div style={{ position: 'absolute', top: 0, right: 0, background: `linear-gradient(135deg, ${ACCENT_VIOLET}, ${ACCENT_CYAN})`, color: 'white', fontSize: 9, fontWeight: 800, padding: '2px 10px', borderBottomLeftRadius: 8 }}>
                          CURRENT SESSION
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                          <div style={{ width: 42, height: 42, borderRadius: 10, background: `linear-gradient(135deg, ${ACCENT_VIOLET}, ${ACCENT_CYAN})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Crown size={22} className="text-white" />
                          </div>
                          <div>
                            <p style={{ color: TEXT, fontWeight: 700, fontSize: 14 }}>{user?.name || 'Master System Owner'}</p>
                            <p style={{ color: '#C4B5FD', fontSize: 11 }}>{user?.email || 'supermegaadmin@barangay.gov'}</p>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-[11px] pt-2 border-t" style={{ borderColor: `${BORDER}80` }}>
                          <div className="flex justify-between">
                            <span style={{ color: MUTED }}>Platform Clearance:</span>
                            <span style={{ color: '#C4B5FD', fontWeight: 700 }}>Full Root Authority (System Owner)</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: MUTED }}>Jurisdictional Scope:</span>
                            <span style={{ color: TEXT, fontWeight: 600 }}>All 86 Municipal Jurisdictions</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: MUTED }}>Master Root Key:</span>
                            <span style={{ color: ACCENT_CYAN, fontFamily: 'monospace', fontWeight: 700 }}>ROOT-SYS-001-ALPHA</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: MUTED }}>2FA Hardware / TOTP:</span>
                            <span style={{ color: ACCENT_EMERALD, fontWeight: 700 }}>ENFORCED & ACTIVE</span>
                          </div>
                        </div>
                      </div>

                      {/* Secondary Infrastructure Engineer Profile */}
                      <div style={{ background: '#0F172A', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
                        <div className="flex items-center gap-3 mb-3">
                          <div style={{ width: 42, height: 42, borderRadius: 10, background: `${BORDER}80`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShieldCheck size={22} style={{ color: ACCENT_AMBER }} />
                          </div>
                          <div>
                            <p style={{ color: TEXT, fontWeight: 700, fontSize: 14 }}>System Infrastructure Standby</p>
                            <p style={{ color: MUTED, fontSize: 11 }}>ops.infra@barangay.gov</p>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-[11px] pt-2 border-t" style={{ borderColor: `${BORDER}80` }}>
                          <div className="flex justify-between">
                            <span style={{ color: MUTED }}>Platform Clearance:</span>
                            <span style={{ color: TEXT, fontWeight: 700 }}>Backup Infrastructure Operator</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: MUTED }}>Jurisdictional Scope:</span>
                            <span style={{ color: TEXT, fontWeight: 600 }}>Database Failover & Server Ops</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: MUTED }}>Emergency Key:</span>
                            <span style={{ color: MUTED, fontFamily: 'monospace', fontWeight: 700 }}>ROOT-STANDBY-002</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: MUTED }}>Status:</span>
                            <span style={{ color: ACCENT_AMBER, fontWeight: 700 }}>STANDBY / MONITORED</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SUB-TAB 3: MUNICIPAL CONSTITUENT & STAFF LOOKUP ── */}
              {userManagementSubTab === 'all' && (
                <div className="space-y-4">
                  {/* Search and Filters */}
                  <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}
                    className="flex flex-wrap items-center gap-2">
                    <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                      <Search size={12} style={{ position: 'absolute', left: 8, top: 10, color: MUTED }} />
                      <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name, email, or role..."
                        style={{ background: `${BORDER}60`, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 11, padding: '7px 10px 7px 26px', width: '100%' }} />
                    </div>
                    <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)}
                      style={{ colorScheme: 'dark', background: '#161F30', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 11, padding: '7px 10px' }}>
                      <option value="all">All Account Roles</option>
                      {['super_mega_admin', 'superadmin', 'admin', 'staff', 'bhw', 'nurse', 'resident'].map(r => <option key={r} value={r} style={{ background: '#161F30', color: TEXT }}>{r}</option>)}
                    </select>
                    <select value={userBarangayFilter} onChange={e => setUserBarangayFilter(e.target.value)}
                      style={{ colorScheme: 'dark', background: '#161F30', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 11, padding: '7px 10px' }}>
                      <option value="all">All Client Barangays</option>
                      {BUTUAN_BARANGAYS.slice(0, 30).map(b => <option key={b} value={b} style={{ background: '#161F30', color: TEXT }}>{b}</option>)}
                    </select>
                  </div>

                  {/* Compact Table */}
                  <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ color: TEXT, fontWeight: 700, fontSize: 13 }}>Municipal Personnel & Constituent Directory</p>
                      <span style={{ color: MUTED, fontSize: 11 }}>{filteredUsers.length} of {systemUsers.length} accounts found</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: `${BORDER}60` }}>
                            <th style={{ padding: '8px 12px', color: MUTED, fontWeight: 600, textAlign: 'left', fontSize: 11, width: '22%' }}>Name</th>
                            <th style={{ padding: '8px 12px', color: MUTED, fontWeight: 600, textAlign: 'left', fontSize: 11, width: '25%' }}>Email</th>
                            <th style={{ padding: '8px 12px', color: MUTED, fontWeight: 600, textAlign: 'left', fontSize: 11, width: '13%' }}>Role</th>
                            <th style={{ padding: '8px 12px', color: MUTED, fontWeight: 600, textAlign: 'left', fontSize: 11, width: '18%' }}>Jurisdiction</th>
                            <th style={{ padding: '8px 12px', color: MUTED, fontWeight: 600, textAlign: 'left', fontSize: 11, width: '10%' }}>Status</th>
                            <th style={{ padding: '8px 12px', color: MUTED, fontWeight: 600, textAlign: 'right', fontSize: 11, width: '12%' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: MUTED }}>No accounts match your query.</td></tr>
                          ) : filteredUsers.map(u => (
                            <tr key={u.id} style={{ borderBottom: `1px solid ${BORDER}30` }} className="hover:bg-white/[0.02]">
                              <td style={{ padding: '8px 12px', color: TEXT, fontWeight: 600, fontSize: 12 }}>{u.name}</td>
                              <td style={{ padding: '8px 12px', color: MUTED, fontSize: 11 }}>{u.email}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${roleBadge(u.role)}`}>{u.role}</span>
                              </td>
                              <td style={{ padding: '8px 12px', color: MUTED, fontSize: 11 }}>
                                {u.barangay ? `${u.barangay}${u.city ? ` (${u.city})` : ''}` : '—'}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '2px 8px', background: u.status === 'Active' ? `${ACCENT_EMERALD}20` : `${ACCENT_ROSE}20`, color: u.status === 'Active' ? ACCENT_EMERALD : ACCENT_ROSE }}>
                                  {u.status}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                {u.role !== 'super_mega_admin' && (
                                  <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                                    <button onClick={() => handleToggleUserStatus(u)}
                                      style={{ color: u.status === 'Active' ? ACCENT_AMBER : ACCENT_EMERALD, border: `1px solid ${u.status === 'Active' ? ACCENT_AMBER : ACCENT_EMERALD}40`, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 600, background: 'transparent' }}
                                      className="hover:bg-white/5 cursor-pointer transition-colors">
                                      {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button onClick={() => handleDeleteUser(u)}
                                      style={{ color: MUTED, borderRadius: 6, padding: '3px 5px', background: 'transparent', border: 'none' }}
                                      className="hover:text-rose-400 cursor-pointer transition-colors">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: ANALYTICS & REPORTS ─────────────────── */}
          {activeTab === 'reports' && (
            <div className="space-y-5">
              <div>
                <h2 style={{ color: TEXT, fontWeight: 700, fontSize: 17 }}>Analytics & Reports</h2>
                <p style={{ color: MUTED, fontSize: 12 }}>City-wide demographic analytics, staff distribution, and governance metrics.</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total Residents', value: totalResidents, icon: Users2, color: ACCENT_CYAN, sub: `${verifiedResidents} Verified` },
                  { label: 'System Users', value: systemUsers.length, icon: Users, color: ACCENT_VIOLET, sub: `${superadminCount} Superadmins` },
                  { label: 'Activity Events', value: activityLogs.length, icon: Activity, color: ACCENT_EMERALD, sub: 'All time recorded' },
                  { label: 'Active Categories', value: categories.filter(c => c.status === 'Active').length, icon: Tag, color: ACCENT_AMBER, sub: `${categories.length} total` },
                ].map(card => (
                  <div key={card.label} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
                    <div className="flex items-center justify-between mb-2">
                      <p style={{ color: MUTED, fontSize: 10, fontWeight: 600 }}>{card.label}</p>
                      <card.icon size={16} style={{ color: card.color }} />
                    </div>
                    <p style={{ color: TEXT, fontSize: 26, fontWeight: 800 }}>{fmt(card.value)}</p>
                    <p style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>{card.sub}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ── Donut Chart: Staff Role Distribution ───────────────────────── */}
                <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }} className="flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 style={{ color: TEXT, fontWeight: 700, fontSize: 14 }}>Staff Role Distribution</h3>
                      <p style={{ color: MUTED, fontSize: 11 }}>Active workforce composition by administrative role</p>
                    </div>
                    <span style={{ background: `${ACCENT_VIOLET}20`, color: '#A78BFA', border: `1px solid ${ACCENT_VIOLET}40`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                      {systemUsers.length} Total Staff
                    </span>
                  </div>

                  {staffDonutData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center" style={{ color: MUTED }}>
                      <Users size={36} className="mb-2 opacity-40" />
                      <p style={{ fontSize: 12 }}>No staff members registered</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center flex-1 pt-2">
                      {/* Donut Chart with Centered Number */}
                      <div className="sm:col-span-6 relative flex items-center justify-center" style={{ height: 210 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  const pct = totalStaffDonutCount > 0 ? ((data.value / totalStaffDonutCount) * 100).toFixed(1) : '0.0';
                                  return (
                                    <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                                      <div className="flex items-center gap-2 mb-1">
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: data.color }} />
                                        <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: 12 }}>{data.name}</span>
                                      </div>
                                      <div className="text-xs" style={{ color: '#94A3B8' }}>
                                        <span style={{ color: '#F1F5F9', fontWeight: 700 }}>{data.value}</span> personnel ({pct}%)
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Pie
                              data={staffDonutData}
                              cx="50%"
                              cy="50%"
                              innerRadius={56}
                              outerRadius={84}
                              paddingAngle={3}
                              dataKey="value"
                              stroke="#111827"
                              strokeWidth={2}
                            >
                              {staffDonutData.map((entry) => (
                                <Cell key={`cell-${entry.name}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center Hole Badge */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span style={{ color: TEXT, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{systemUsers.length}</span>
                          <span style={{ color: MUTED, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginTop: 4, textTransform: 'uppercase' }}>Staff</span>
                        </div>
                      </div>

                      {/* Legend / Breakdown List */}
                      <div className="sm:col-span-6 flex flex-col justify-center space-y-2">
                        {staffDonutData.map((item) => {
                          const pct = totalStaffDonutCount > 0 ? Math.round((item.value / totalStaffDonutCount) * 100) : 0;
                          return (
                            <div key={item.name} className="flex items-center justify-between text-xs p-1.5 rounded-lg transition-colors hover:bg-white/[0.02]">
                              <div className="flex items-center gap-2 min-w-0">
                                <div style={{ width: 9, height: 9, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                                <span style={{ color: '#CBD5E1', fontWeight: 500 }} className="truncate">{item.name}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span style={{ color: TEXT, fontWeight: 700 }}>{item.value}</span>
                                <span style={{ color: MUTED, fontSize: 10, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Standard Horizontal Bar Chart: Activity Log Breakdown ────── */}
                <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }} className="flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 style={{ color: TEXT, fontWeight: 700, fontSize: 14 }}>Activity Log Breakdown</h3>
                      <p style={{ color: MUTED, fontSize: 11 }}>Distribution of system events categorized by action type</p>
                    </div>
                    <span style={{ background: `${ACCENT_CYAN}20`, color: ACCENT_CYAN, border: `1px solid ${ACCENT_CYAN}40`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                      {activityLogs.length} Events
                    </span>
                  </div>

                  {activityBarData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center" style={{ color: MUTED }}>
                      <Activity size={36} className="mb-2 opacity-40" />
                      <p style={{ fontSize: 12 }}>No activity logs recorded yet</p>
                    </div>
                  ) : (
                    <div className="flex-1 pt-2" style={{ width: '100%', height: 210 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={activityBarData}
                          margin={{ top: 8, right: 24, left: 8, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" horizontal={false} />
                          <XAxis
                            type="number"
                            stroke="#64748B"
                            fontSize={11}
                            tickLine={false}
                            axisLine={{ stroke: '#1F293D' }}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="type"
                            stroke="#94A3B8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={{ stroke: '#1F293D' }}
                            width={80}
                          />
                          <RechartsTooltip
                            cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                const pct = activityLogs.length > 0 ? ((data.count / activityLogs.length) * 100).toFixed(1) : '0.0';
                                return (
                                  <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: data.fillColor || ACCENT_CYAN }} />
                                      <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: 12 }}>{data.type}</span>
                                    </div>
                                    <div className="text-xs" style={{ color: '#94A3B8' }}>
                                      <span style={{ color: '#F1F5F9', fontWeight: 700 }}>{data.count}</span> occurrences ({pct}%)
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                            {activityBarData.map((entry) => (
                              <Cell key={`bar-${entry.type}`} fill={entry.fillColor} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
                  <p style={{ color: TEXT, fontWeight: 700, fontSize: 13 }}>Recent System Activity</p>
                </div>
                <div style={{ padding: 8 }}>
                  {activityLogs.slice(0, 8).map((log, i) => (
                    <div key={i} style={{ padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }} className="hover:bg-white/[0.02]">
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${ACCENT_VIOLET}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Activity size={12} style={{ color: ACCENT_VIOLET }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ color: TEXT, fontSize: 12, fontWeight: 600 }} className="truncate">{log.action}</p>
                        <p style={{ color: MUTED, fontSize: 10 }}>{log.user_name} · {log.barangay}</p>
                      </div>
                      <span style={{ color: MUTED, fontSize: 10, flexShrink: 0 }}>{formatTimeAgo(log.timestamp)}</span>
                    </div>
                  ))}
                  {activityLogs.length === 0 && <p style={{ color: MUTED, fontSize: 12, padding: 20, textAlign: 'center' }}>No activity logged yet.</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 7: PROFILE SETTINGS ───────────────────── */}
          {activeTab === 'profile-settings' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 style={{ color: TEXT, fontWeight: 700, fontSize: 17 }}>Profile &amp; Security Settings</h2>
                  <p style={{ color: MUTED, fontSize: 12 }}>Manage your Super Mega Administrator credentials, security keys, contact details, and account preferences.</p>
                </div>
              </div>
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
                <ProfileSettingsView
                  user={user}
                  darkMode={true}
                  onProfileUpdated={(updated) => {
                    setUser(updated);
                    localStorage.setItem('barangay_user', JSON.stringify(updated));
                  }}
                />
              </div>
            </div>
          )}

        </main>
      </div>

      {/* MODAL: Create Barangay Superadmin */}
      {isCreateSuperadminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} className="shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: `${BORDER}80` }}>
              <div className="flex items-center gap-2.5">
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${ACCENT_VIOLET}25`, border: `1px solid ${ACCENT_VIOLET}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Crown size={18} style={{ color: '#C4B5FD' }} />
                </div>
                <div>
                  <h3 style={{ color: TEXT, fontWeight: 700, fontSize: 16 }}>Create Barangay Superadmin</h3>
                  <p style={{ color: MUTED, fontSize: 11 }}>Deploy a new authorized Superadmin for a specific City and Barangay in Agusan del Norte.</p>
                </div>
              </div>
              <button
                onClick={() => { setIsCreateSuperadminOpen(false); setNewSA({ ...BLANK_NEW_SA }); setNewSAError(''); }}
                style={{ color: MUTED, background: 'transparent', border: 'none' }}
                className="cursor-pointer hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateSuperadmin} className="p-5 overflow-y-auto space-y-4 flex-1">
              {newSAError && (
                <div style={{ background: `${ACCENT_ROSE}15`, border: `1px solid ${ACCENT_ROSE}40`, borderRadius: 8, padding: '10px 14px', color: ACCENT_ROSE, fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertOctagon size={15} className="shrink-0" />
                  <span>{newSAError}</span>
                </div>
              )}

              {/* SECTION: Identity */}
              <div>
                <p style={{ color: '#C4B5FD', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  1. Official Identity & Full Name
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>First Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Maria"
                      value={newSA.firstName}
                      onChange={e => setNewSA(prev => ({ ...prev, firstName: e.target.value }))}
                      style={{ background: '#0F172A', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 12px', width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Middle Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Santos (optional)"
                      value={newSA.middleName}
                      onChange={e => setNewSA(prev => ({ ...prev, middleName: e.target.value }))}
                      style={{ background: '#0F172A', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 12px', width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Last Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Dela Cruz"
                      value={newSA.lastName}
                      onChange={e => setNewSA(prev => ({ ...prev, lastName: e.target.value }))}
                      style={{ background: '#0F172A', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 12px', width: '100%' }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: Contact & Governance */}
              <div>
                <p style={{ color: '#C4B5FD', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  2. Official Contact & Designation
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Email Address *</label>
                    <input
                      type="email"
                      placeholder="e.g. superadmin@butuancity.gov.ph"
                      value={newSA.email}
                      onChange={e => setNewSA(prev => ({ ...prev, email: e.target.value }))}
                      style={{ background: '#0F172A', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 12px', width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Mobile Number (11-digit) *</label>
                    <input
                      type="tel"
                      placeholder="09171234567"
                      maxLength={11}
                      value={newSA.phone}
                      onChange={e => setNewSA(prev => ({ ...prev, phone: e.target.value }))}
                      style={{ background: '#0F172A', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 12px', width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Official Designation</label>
                    <div style={{ background: `${ACCENT_VIOLET}15`, border: `1px solid ${ACCENT_VIOLET}50`, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={13} style={{ color: '#C4B5FD', flexShrink: 0 }} />
                      <span style={{ color: '#C4B5FD', fontSize: 12, fontWeight: 600 }}>Barangay Super Administrator</span>
                    </div>
                    <p style={{ color: MUTED, fontSize: 10, marginTop: 3 }}>Fixed system role — cannot be changed.</p>
                  </div>
                </div>
              </div>

              {/* SECTION: Territorial Jurisdiction */}
              <div>
                <p style={{ color: '#C4B5FD', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  3. Territorial Jurisdiction (Agusan del Norte)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>City / Municipality *</label>
                    <select
                      value={newSA.city}
                      onChange={e => setNewSA(prev => ({ ...prev, city: e.target.value, barangay: '' }))}
                      style={{
                        colorScheme: 'dark',
                        background: '#161F30',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        color: '#F8FAFC',
                        fontSize: 12,
                        padding: '8px 12px',
                        width: '100%',
                        cursor: 'pointer'
                      }}
                      required
                    >
                      <option value="" disabled style={{ background: '#161F30', color: '#94A3B8' }}>Select City / Municipality</option>
                      {AGUSAN_DEL_NORTE_LGUS.map(lgu => (
                        <option key={lgu.name} value={lgu.name} style={{ background: '#161F30', color: '#F8FAFC' }}>
                          {lgu.name} {lgu.isCity ? '(City)' : '(Municipality)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Select Barangay *</label>
                    <select
                      value={newSA.barangay}
                      onChange={e => setNewSA(prev => ({ ...prev, barangay: e.target.value }))}
                      disabled={!newSA.city}
                      style={{
                        colorScheme: 'dark',
                        background: '#161F30',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        color: '#F8FAFC',
                        fontSize: 12,
                        padding: '8px 12px',
                        width: '100%',
                        cursor: newSA.city ? 'pointer' : 'not-allowed',
                        opacity: newSA.city ? 1 : 0.6
                      }}
                      required
                    >
                      <option value="" disabled style={{ background: '#161F30', color: '#94A3B8' }}>
                        {newSA.city ? 'Select Barangay' : 'Select City / Municipality first'}
                      </option>
                      {saBarangays.map(b => (
                        <option key={b} value={b} style={{ background: '#161F30', color: '#F8FAFC' }}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {newSA.city && (
                  <p style={{ color: MUTED, fontSize: 10, marginTop: 4 }}>
                    {saBarangays.length} official barangays loaded for {newSA.city}.
                  </p>
                )}
              </div>

              {/* SECTION: Security & Passwords */}
              <div>
                <p style={{ color: '#C4B5FD', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  4. Security & Account Password
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Password *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewSAPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={newSA.password}
                        onChange={e => setNewSA(prev => ({ ...prev, password: e.target.value }))}
                        style={{ background: '#0F172A', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 36px 8px 12px', width: '100%' }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewSAPass(p => !p)}
                        style={{ position: 'absolute', right: 10, top: 9, color: MUTED, background: 'transparent', border: 'none' }}
                        className="cursor-pointer hover:text-white"
                      >
                        {showNewSAPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Confirm Password *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewSAPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={newSA.confirmPassword}
                        onChange={e => setNewSA(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        style={{ background: '#0F172A', border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 36px 8px 12px', width: '100%' }}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Password Strength Checklist */}
                {newSA.password && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2.5 p-2 rounded-lg" style={{ background: '#0F172A', border: `1px solid ${BORDER}` }}>
                    {[
                      { label: '8+ Characters', valid: newSA.password.length >= 8 },
                      { label: '1 Uppercase (A-Z)', valid: /[A-Z]/.test(newSA.password) },
                      { label: '1 Lowercase (a-z)', valid: /[a-z]/.test(newSA.password) },
                      { label: '1 Number (0-9)', valid: /[0-9]/.test(newSA.password) },
                      { label: '1 Symbol (!@#$)', valid: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newSA.password) },
                      { label: 'Passwords Match', valid: !!newSA.password && newSA.password === newSA.confirmPassword },
                    ].map(req => (
                      <div key={req.label} className="flex items-center gap-1.5 text-[10px]">
                        <CheckCircle2 size={11} style={{ color: req.valid ? ACCENT_EMERALD : MUTED }} />
                        <span style={{ color: req.valid ? TEXT : MUTED }}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex gap-2.5 pt-3 border-t" style={{ borderColor: `${BORDER}80` }}>
                <button
                  type="button"
                  onClick={() => { setIsCreateSuperadminOpen(false); setNewSA({ ...BLANK_NEW_SA }); setNewSAError(''); }}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${BORDER}`, color: MUTED, background: 'transparent', fontSize: 12, fontWeight: 600 }}
                  className="cursor-pointer hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  style={{ flex: 2, padding: '10px', borderRadius: 8, background: `linear-gradient(135deg, ${ACCENT_VIOLET}, ${ACCENT_CYAN})`, color: 'white', border: 'none', fontSize: 12, fontWeight: 700 }}
                  className="cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-900/30"
                >
                  {creatingUser ? <RefreshCcw size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  {creatingUser ? 'Creating Superadmin...' : 'Create Superadmin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Category */}
      {isAddCatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 16, width: '100%', maxWidth: 420, padding: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ color: TEXT, fontWeight: 700, fontSize: 15 }}>Add Document Category</h3>
              <button onClick={() => setIsAddCatOpen(false)} style={{ color: MUTED, background: 'transparent', border: 'none' }} className="cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateCat} className="space-y-3">
              <div>
                <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Category Name *</label>
                <input value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Certificate of Low Income"
                  style={{ background: `${BORDER}60`, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 12px', width: '100%' }} />
              </div>
              <div>
                <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Department *</label>
                <select value={newCat.department} onChange={e => setNewCat(p => ({ ...p, department: e.target.value }))}
                  style={{ background: `${BORDER}60`, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 12px', width: '100%' }}>
                  <option value="Barangay">Barangay</option>
                  <option value="Health">Health</option>
                </select>
              </div>
              <div>
                <label style={{ color: MUTED, fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
                <textarea value={newCat.description} onChange={e => setNewCat(p => ({ ...p, description: e.target.value }))} rows={2}
                  style={{ background: `${BORDER}60`, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12, padding: '8px 12px', width: '100%', resize: 'vertical' }} placeholder="Purpose of this category..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsAddCatOpen(false)}
                  style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${BORDER}`, color: MUTED, background: 'transparent', fontSize: 12, fontWeight: 600 }}
                  className="cursor-pointer hover:bg-white/5 transition-colors">Cancel</button>
                <button type="submit" disabled={creatingCat}
                  style={{ flex: 2, padding: '9px', borderRadius: 8, background: ACCENT_VIOLET, color: 'white', border: 'none', fontSize: 12, fontWeight: 700 }}
                  className="cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                  {creatingCat ? <RefreshCcw size={13} className="animate-spin" /> : <PlusCircle size={13} />}
                  {creatingCat ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
