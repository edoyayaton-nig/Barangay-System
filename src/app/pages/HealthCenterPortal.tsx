import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Heart,
  Building2,
  ArrowRight,
  Stethoscope,
  Activity,
  Clock,
  Settings,
  Bell,
  XCircle,
  Calendar,
  CalendarCheck,
  MapPin,
  Users,
  CheckCircle2,
  Sparkles,
  Check,
  Printer,
  FileText,
  AlertTriangle,
  X,
  LogOut,
  MessageSquare,
  BadgeCheck,
  HeartPulse,
  Syringe,
  ShieldCheck,
  ChevronRight,
  Sparkle,
  Phone,
  Mail,
  CalendarPlus
} from 'lucide-react';
import { getBarangayContact, getBarangayEmail } from '../../utils/barangays';
import { apiService, HealthAppointment, ClinicSchedule } from '../../services/api';
import BarangayChatbot from '../components/BarangayChatbot';
import ProfileSettingsModal from '../components/ProfileSettingsModal';
import TermsAndPrivacyModal from '../components/TermsAndPrivacyModal';
import SuperAdminNavigationDock from '../components/SuperAdminNavigationDock';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { getUpcomingOperatingDates, formatOperatingDaysSummary } from '../../utils/scheduleDateUtils';

interface RevisitHistoryItem {
  id: string | number;
  service_type: string;
  date: string;
  time: string;
  status: 'Upcoming' | 'Completed' | 'Pending' | 'Cancelled';
  provider: string;
  vitals?: { bp?: string; weight?: string; temp?: string; heart_rate?: string };
  notes?: string;
  instructions?: string;
}

// Service icon helper based on service name
function getServiceIcon(serviceType?: string) {
  const s = (serviceType || '').toLowerCase();
  if (s.includes('prenatal') || s.includes('maternal') || s.includes('pregnancy')) return Heart;
  if (s.includes('immun') || s.includes('vaccin') || s.includes('baby') || s.includes('child')) return Syringe;
  if (s.includes('family') || s.includes('planning')) return Users;
  if (s.includes('senior') || s.includes('elderly')) return ShieldCheck;
  return Stethoscope;
}

// Service theme color helper
function getServiceColor(serviceType?: string) {
  const s = (serviceType || '').toLowerCase();
  if (s.includes('prenatal') || s.includes('maternal')) {
    return {
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800',
      iconBg: 'bg-emerald-100 text-emerald-700'
    };
  }
  if (s.includes('immun') || s.includes('vaccin') || s.includes('child')) {
    return {
      gradient: 'from-blue-500 to-cyan-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-800',
      iconBg: 'bg-blue-100 text-blue-700'
    };
  }
  if (s.includes('family')) {
    return {
      gradient: 'from-purple-500 to-indigo-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-800',
      iconBg: 'bg-purple-100 text-purple-700'
    };
  }
  return {
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    iconBg: 'bg-amber-100 text-amber-700'
  };
}

function formatApptDate(dateStr?: string, withWeekday = false) {
  if (!dateStr) return '';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10) - 1;
    const da = parseInt(parts[2], 10);
    const d = new Date(yr, mo, da);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', withWeekday
        ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
        : { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return clean;
}

export default function HealthCenterPortal() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<HealthAppointment[]>([]);
  const [clinicSchedules, setClinicSchedules] = useState<ClinicSchedule[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [isRecordSummaryOpen, setIsRecordSummaryOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isRejectionBannerDismissed, setIsRejectionBannerDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Appointment Booking State
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ClinicSchedule | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [myBookings, setMyBookings] = useState<HealthAppointment[]>([]);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Available dates strictly restricted to the schedule's operating days (Monday only, Wed only, etc.)
  const availableOperatingDates = useMemo(() => {
    return getUpcomingOperatingDates(selectedSchedule?.day_of_week, 10);
  }, [selectedSchedule?.day_of_week]);

  // Automatically update booking date whenever schedule changes
  useEffect(() => {
    if (selectedSchedule) {
      const dates = getUpcomingOperatingDates(selectedSchedule.day_of_week, 10);
      if (dates.length > 0) {
        setBookingDate(dates[0].dateStr);
      }
    }
  }, [selectedSchedule]);

  const loadData = async (currentUser?: any) => {
    setLoading(true);
    try {
      const loggedInUser = currentUser || user;
      const userBarangay = loggedInUser?.barangay || 'Pianing';

      const [apts, schedules] = await Promise.all([
        apiService.getAppointments({ barangay: userBarangay }).catch(() => []),
        apiService.getClinicSchedules(userBarangay).catch(() => [])
      ]);

      if (schedules && schedules.length > 0) {
        setClinicSchedules(schedules);
      } else {
        // Connected default schedules matching Nurse Dashboard
        setClinicSchedules([
          {
            id: 1,
            title: 'Prenatal & Maternal Care Clinic',
            service_type: 'Prenatal Care',
            day_of_week: 'Every Monday & Thursday',
            time_slot: '8:00 AM – 12:00 PM & 1:00 PM – 4:00 PM',
            location: `Barangay ${userBarangay} Health Center`,
            bhw_in_charge: 'Nurse Maria Santos (Duty Nurse)',
            barangay: userBarangay,
            slots_available: 20,
            status: 'Active'
          },
          {
            id: 2,
            title: 'EPI Child Immunization & Growth Monitoring',
            service_type: 'Child Immunization',
            day_of_week: 'Every Wednesday',
            time_slot: '8:00 AM – 12:00 PM',
            location: `Barangay ${userBarangay} Health Center`,
            bhw_in_charge: 'Nurse Maria Santos (Duty Nurse)',
            barangay: userBarangay,
            slots_available: 30,
            status: 'Active'
          },
          {
            id: 3,
            title: 'General Primary Care & Hypertension Screening',
            service_type: 'General Consultation',
            day_of_week: 'Tuesday & Friday',
            time_slot: '8:00 AM – 12:00 PM & 1:00 PM – 4:00 PM',
            location: `Barangay ${userBarangay} Health Center`,
            bhw_in_charge: 'Nurse Maria Santos (Duty Nurse)',
            barangay: userBarangay,
            slots_available: 25,
            status: 'Active'
          },
          {
            id: 4,
            title: 'Family Planning, Counseling & Contraceptive Supply',
            service_type: 'Family Planning',
            day_of_week: 'Every 2nd & 4th Friday',
            time_slot: '1:00 PM – 4:00 PM',
            location: `Barangay ${userBarangay} Health Center`,
            bhw_in_charge: 'Nurse Maria Santos (Duty Nurse)',
            barangay: userBarangay,
            slots_available: 15,
            status: 'Active'
          }
        ]);
      }

      if (loggedInUser?.email || loggedInUser?.id || loggedInUser?.name) {
        const uEmail = (loggedInUser.email || '').toLowerCase().trim();
        const uId = loggedInUser.id;
        const userApts = (apts || []).filter((a: HealthAppointment) => {
          if (uId && a.resident_id && a.resident_id === uId) return true;
          if (uEmail && a.resident_email && a.resident_email.toLowerCase() === uEmail) return true;
          if (loggedInUser.name && a.resident_name && a.resident_name.toLowerCase().includes(loggedInUser.name.toLowerCase())) return true;
          return false;
        });
        setAppointments(userApts);
        setMyBookings(userApts);
      } else {
        setAppointments([]);
        setMyBookings([]);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchedule) return;
    if (!bookingDate) { toast.error('Please select a preferred date'); return; }
    setIsBookingLoading(true);
    try {
      const apt = await apiService.createAppointment({
        resident_name: user?.name || 'Resident',
        resident_phone: user?.phone || user?.contact_number || '',
        resident_email: user?.email || '',
        barangay: user?.barangay || 'Pianing',
        resident_id: user?.id,
        service_type: selectedSchedule.service_type || selectedSchedule.title,
        preferred_date: bookingDate,
        preferred_time: selectedSchedule.time_slot || 'Morning (8:00 AM - 11:30 AM)',
        resident_notes: bookingNotes,
        status: 'Pending',
      } as any);
      setMyBookings(prev => [apt, ...prev]);
      setAppointments(prev => [apt, ...prev]);
      toast.success(`Appointment booked for ${bookingDate}! The nurse will confirm your slot.`);
      setIsBookingOpen(false);
      setBookingDate('');
      setBookingNotes('');
      setSelectedSchedule(null);
    } catch {
      // Optimistic fallback
      const fallbackApt: any = {
        id: Date.now(),
        appointment_code: `APT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        resident_name: user?.name,
        service_type: selectedSchedule.service_type || selectedSchedule.title,
        preferred_date: bookingDate,
        preferred_time: selectedSchedule.time_slot || 'Morning',
        status: 'Pending',
        resident_notes: bookingNotes
      };
      setMyBookings(prev => [fallbackApt, ...prev]);
      setAppointments(prev => [fallbackApt, ...prev]);
      toast.success('Appointment request submitted! The nurse will confirm your slot.');
      setIsBookingOpen(false);
      setBookingDate('');
      setBookingNotes('');
      setSelectedSchedule(null);
    } finally {
      setIsBookingLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('barangay_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.role === 'superadmin' || parsed.role === 'admin' || parsed.role === 'staff') { navigate('/admin'); return; }
        if (parsed.role === 'bhw') { navigate('/bhw'); return; }
        if (parsed.role === 'nurse') { navigate('/nurse'); return; }
        setUser(parsed);
        setIsVerified(parsed.verification_status === 'Verified');
        loadData(parsed);

        if (parsed.email) {
          apiService.checkVerificationStatus(parsed.email).then(result => {
            const liveUser = (result as any)?.user || result;
            if (liveUser) {
              const liveStatus = liveUser.verification_status;
              const hasChanged = liveStatus && liveStatus !== parsed.verification_status;
              const cleanDob = liveUser.date_of_birth ? (typeof liveUser.date_of_birth === 'string' ? liveUser.date_of_birth.split('T')[0] : liveUser.date_of_birth) : (parsed.date_of_birth || '');
              const updated = { ...parsed, ...liveUser, date_of_birth: cleanDob, age: liveUser.age ?? parsed.age };
              setUser(updated);
              setIsVerified(updated.verification_status === 'Verified');
              localStorage.setItem('barangay_user', JSON.stringify(updated));
              if (hasChanged && liveStatus === 'Verified') {
                toast.success('Account Verified!', { description: 'Your health center revisits will now appear here.' });
              }
            }
          }).catch(() => {});
        }
      } catch { loadData(); }
    } else { loadData(); }

    // Silent background polling every 4 seconds to reflect nurse approvals/completions without reloading
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const u = localStorage.getItem('barangay_user');
        if (u) {
          try {
            const parsed = JSON.parse(u);
            loadData(parsed);
          } catch {}
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Only real nurse-assigned appointments / revisits
  const revisitTimeline: RevisitHistoryItem[] = useMemo(() => {
    const list: RevisitHistoryItem[] = [];
    appointments.forEach(a => {
      const visitDate = a.scheduled_date || a.preferred_date;
      list.push({
        id: a.id,
        service_type: a.service_type,
        date: visitDate,
        time: a.scheduled_time || a.preferred_time || 'TBA',
        status: a.status === 'Approved' ? 'Upcoming' : a.status === 'Completed' ? 'Completed' : 'Pending',
        provider: a.attending_bhw || 'Barangay Health Center Nurse',
        instructions: a.bhw_notes || undefined,
        notes: a.resident_notes
      });
    });
    return list.sort((a, b) => {
      if (a.status === 'Upcoming' && b.status !== 'Upcoming') return -1;
      if (b.status === 'Upcoming' && a.status !== 'Upcoming') return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [appointments]);

  const nextUpcomingVisit = useMemo(() =>
    revisitTimeline.find(item => item.status === 'Upcoming' || item.status === 'Pending') || null,
    [revisitTimeline]);

  const daysUntilVisit = useMemo(() => {
    if (!nextUpcomingVisit?.date) return null;
    const cleanDate = String(nextUpcomingVisit.date).split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return null;
    const target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [nextUpcomingVisit]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <SuperAdminNavigationDock currentRole={user?.role} />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-xs border border-emerald-100 bg-white shrink-0">
              <img src="/assets/pianing-logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider leading-none">Barangay {user?.barangay || 'Pianing'}</p>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">Health Center Portal</h1>
            </div>
          </div>

          {/* Quick Barangay Contact Pill in Navbar */}
          <div className="hidden lg:flex items-center gap-3 text-xs bg-emerald-50/70 border border-emerald-200/80 px-3 py-1.5 rounded-xl">
            <a href={`tel:${getBarangayContact(user?.barangay).replace(/[^0-9+]/g, '')}`} className="flex items-center gap-1.5 text-emerald-800 hover:text-emerald-950 font-medium transition-colors cursor-pointer" title="Health Center Hotline">
              <Phone size={13} className="text-emerald-600 shrink-0" />
              <span className="font-mono font-bold text-[11px]">{getBarangayContact(user?.barangay)}</span>
            </a>
            <span className="text-emerald-300">|</span>
            <a href={`mailto:${getBarangayEmail(user?.barangay)}`} className="flex items-center gap-1.5 text-emerald-800 hover:text-emerald-950 font-medium transition-colors cursor-pointer" title="Official Barangay Gmail">
              <Mail size={13} className="text-emerald-600 shrink-0" />
              <span className="truncate max-w-[200px] text-[11px]">{getBarangayEmail(user?.barangay)}</span>
            </a>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={() => setIsNotificationsOpen(true)}
                className="relative w-9 h-9 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 flex items-center justify-center transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell size={16} className="text-slate-600" />
                {nextUpcomingVisit && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 rounded-full text-white text-[9px] font-bold flex items-center justify-center">1</span>
                )}
              </button>
            )}
            {user && (
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                title="Profile Settings"
              >
                <Settings size={16} className="text-slate-600" />
              </button>
            )}
            <button
              onClick={() => navigate('/resident/barangay')}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 sm:px-3 h-8 rounded-xl transition-colors cursor-pointer"
              title="Switch to Barangay Documents Portal"
            >
              <Building2 size={13} className="shrink-0" />
              <span className="hidden xs:inline sm:inline">Documents</span>
              <ArrowRight size={11} className="hidden md:inline" />
            </button>
            <button
              onClick={() => { toast.info('Logged out'); navigate('/login'); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 px-2.5 sm:px-3 h-8 rounded-xl transition-all cursor-pointer"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Official Barangay Helpdesk & Contact Banner */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-emerald-800/40 relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Barangay {user?.barangay || 'Pianing'} Clinic Helpdesk
                </span>
                <span className="text-slate-300 text-[11px] flex items-center gap-1">
                  <Clock size={12} className="text-emerald-400" /> Mon - Fri: 8:00 AM - 5:00 PM
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Barangay {user?.barangay || 'Pianing'} Health Center Assistance
              </h2>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                Need walk-in consultation details, immunization schedules, or maternal health inquiries? Contact the Health Center desk:
              </p>
            </div>

            {/* Quick Contact Buttons */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto shrink-0">
              <a
                href={`tel:${getBarangayContact(user?.barangay).replace(/[^0-9+]/g, '')}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Phone size={13} />
                <span>{getBarangayContact(user?.barangay)}</span>
              </a>
              <a
                href={`mailto:${getBarangayEmail(user?.barangay)}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-medium px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Mail size={13} />
                <span className="truncate max-w-[200px]">{getBarangayEmail(user?.barangay)}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Status Banners */}
        {!user || user.role !== 'resident' ? (
          <div className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-slate-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">Not signed in</p>
                <p className="text-xs text-slate-500">Sign in to view your health revisit schedule.</p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate('/login')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-4 shrink-0">Sign In</Button>
          </div>
        ) : user?.verification_status === 'Rejected' && !isRejectionBannerDismissed ? (
          <div className="relative flex items-center justify-between gap-4 bg-red-50 rounded-2xl border border-red-200 p-4 pr-12">
            <button
              type="button"
              onClick={() => setIsRejectionBannerDismissed(true)}
              className="absolute top-2.5 right-2.5 text-red-400 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
              title="Dismiss Notice"
              aria-label="Dismiss Notice"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <XCircle size={20} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-sm text-red-900">ID Revision Required</p>
                <p className="text-xs text-red-700">{user?.rejection_reason || 'Your Government ID photo was blurry or illegible.'}</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setIsProfileModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 px-4 shrink-0">Update ID</Button>
          </div>
        ) : !isVerified ? (
          <div className="flex items-center gap-3 bg-amber-50 rounded-2xl border border-amber-200 p-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Clock size={20} className="text-amber-600 animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-sm text-amber-900">Account Verification Pending</p>
              <p className="text-xs text-amber-700">Your ID is under review. Health Center revisits will appear once the administrator approves your account.</p>
            </div>
          </div>
        ) : null}

        {/* Hero Welcome Card */}
        {user && isVerified && (
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 shadow-md">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-10 w-64 h-64 bg-teal-300/10 rounded-full blur-2xl" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-xs rounded-full px-3 py-1 text-xs font-semibold text-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  Barangay {user?.barangay || 'Pianing'} Primary Health Center
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Good day, {user?.name?.split(' ')[0] || 'Resident'}! 🌿
                </h2>
                <p className="text-emerald-100 text-sm leading-relaxed max-w-md">
                  {nextUpcomingVisit
                    ? `You have a nurse-assigned revisit coming up. Check the details below.`
                    : `Welcome to the Health Center Portal! Visit the clinic in person, and your nurse will log your visits and follow-ups here.`}
                </p>
              </div>
              <div className="flex sm:flex-col gap-2 sm:items-end shrink-0">
                <div className="bg-white/15 backdrop-blur-xs rounded-2xl px-4 py-3 border border-white/20 text-center min-w-[110px]">
                  <HeartPulse size={20} className="text-emerald-200 mx-auto mb-1" />
                  <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">Account</p>
                  <p className="text-xs font-bold text-white mt-0.5">✓ Verified</p>
                </div>
                <div className="bg-white/15 backdrop-blur-xs rounded-2xl px-4 py-3 border border-white/20 text-center min-w-[110px]">
                  <Activity size={20} className="text-emerald-200 mx-auto mb-1" />
                  <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">Records</p>
                  <p className="text-xs font-bold text-white mt-0.5">{revisitTimeline.length} Visits</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nurse-Assigned Revisit Card */}
        {nextUpcomingVisit ? (
          <div className="bg-white rounded-2xl border-2 border-emerald-300 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-emerald-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarCheck size={16} className="text-white" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Nurse-Assigned Revisit</span>
              </div>
              {daysUntilVisit !== null && (
                <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${daysUntilVisit === 0 ? 'bg-red-500 text-white' : daysUntilVisit <= 3 ? 'bg-amber-400 text-amber-950' : 'bg-emerald-100 text-emerald-900'}`}>
                  {daysUntilVisit === 0 ? '🚨 Due Today!' : daysUntilVisit === 1 ? '⏰ Tomorrow' : `📅 In ${daysUntilVisit} Days`}
                </span>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{nextUpcomingVisit.service_type}</h3>
                {nextUpcomingVisit.notes && <p className="text-xs text-slate-500 mt-0.5">{nextUpcomingVisit.notes}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Scheduled Date', value: formatApptDate(nextUpcomingVisit.date, true), icon: Calendar },
                  { label: 'Time', value: nextUpcomingVisit.time, icon: Clock },
                  { label: 'Attending Nurse', value: nextUpcomingVisit.provider, icon: Stethoscope },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={12} className="text-emerald-600" />
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{label}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{value}</p>
                  </div>
                ))}
              </div>
              {nextUpcomingVisit.instructions && (
                <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                  <Sparkles size={15} className="text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider mb-0.5">Nurse Instructions</p>
                    <p className="text-xs text-emerald-950 leading-relaxed">{nextUpcomingVisit.instructions}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
                <CheckCircle2 size={13} className="text-emerald-600" />
                Please arrive on time. Bring your Mother-Baby book (for prenatal/immunization) or PhilHealth card.
              </div>
            </div>
          </div>
        ) : isVerified ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Heart size={28} />
            </div>
            <div className="text-center sm:text-left flex-1">
              <h3 className="font-bold text-slate-800 text-base">No Follow-Up Visit Scheduled Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-lg leading-relaxed">
                Revisits are assigned directly by your nurse after your in-person visit to the Barangay Health Center. Once scheduled, your follow-up details will automatically appear here.
              </p>
            </div>
            <div className="shrink-0 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Health Center Hours</p>
              <p className="text-xs font-bold text-emerald-950 mt-0.5">Monday to Friday</p>
              <p className="text-[11px] text-emerald-700 font-mono mt-0.5">8:00 AM – 5:00 PM</p>
            </div>
          </div>
        ) : null}

        {/* ─── Dynamic Clinic Schedules (Posted by Nurse) ─── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck className="text-emerald-600" size={18} />
                Weekly Clinic Operating Schedules
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official weekly clinic programs posted by Health Center Staff. Select a schedule below to book your appointment slot.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setSelectedSchedule(clinicSchedules[0] || null);
                  setIsBookingOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 cursor-pointer rounded-xl font-bold shadow-xs"
              >
                <CalendarPlus size={14} /> Book Appointment
              </Button>
            </div>
          </div>

          {/* My Appointment Requests Tracker */}
          {myBookings.length > 0 && (
            <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CalendarPlus className="text-emerald-600" size={15} /> My Clinic Appointment Requests ({myBookings.length})
                </span>
                <span className="text-[10px] text-slate-400">Live Status from Health Station</span>
              </div>
              <div className="space-y-2">
                {myBookings.slice(0, 5).map((b, i) => (
                  <div key={b.id || i} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{b.service_type}</span>
                        {b.appointment_code && (
                          <Badge variant="outline" className="text-[9px] font-mono border-slate-300">
                            {b.appointment_code}
                          </Badge>
                        )}
                      </div>
                      <Badge className={`text-[10px] border-0 shrink-0 ${
                        b.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 font-bold' :
                        b.status === 'Completed' ? 'bg-blue-100 text-blue-800 font-bold' :
                        b.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800 font-bold'
                      }`}>
                        {b.status === 'Approved' ? 'Confirmed Slot' : b.status || 'Pending Review'}
                      </Badge>
                    </div>

                    <div className="text-slate-500 text-[11px] flex items-center gap-2">
                      <span>Requested: <strong>{formatApptDate(b.preferred_date || b.scheduled_date)}</strong></span>
                      {b.preferred_time && <span>• {b.preferred_time}</span>}
                    </div>

                    {(b.status === 'Approved' || b.status === 'Completed') && (b.scheduled_date || b.scheduled_time) && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[11px] text-emerald-900 flex items-center justify-between flex-wrap gap-1">
                        <span className="font-medium flex items-center gap-1.5">
                          <Clock size={12} className="text-emerald-700" />
                          Confirmed Schedule: <strong>{formatApptDate(b.scheduled_date)}</strong> at <strong>{b.scheduled_time || '09:00 AM'}</strong>
                        </span>
                        {b.attending_bhw && (
                          <span className="text-[10px] text-emerald-700 font-semibold">
                            Attending: {b.attending_bhw}
                          </span>
                        )}
                      </div>
                    )}

                    {b.bhw_notes && (
                      <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/80 italic">
                        Nurse Note: &ldquo;{b.bhw_notes}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {clinicSchedules.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <Calendar className="mx-auto text-slate-300" size={32} />
              <p className="font-semibold text-sm text-slate-600">No special clinic schedules posted yet</p>
              <p className="text-xs text-slate-400">The Health Center is open Monday to Friday, 8:00 AM – 5:00 PM for walk-ins.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {clinicSchedules.map(sch => {
                const Icon = getServiceIcon(sch.service_type);
                const colors = getServiceColor(sch.service_type);
                return (
                  <div
                    key={sch.id}
                    className={`bg-white rounded-2xl border ${colors.border} shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between`}
                  >
                    <div className={`h-1.5 w-full bg-gradient-to-r ${colors.gradient}`} />
                    <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className={`w-10 h-10 rounded-xl ${colors.iconBg} flex items-center justify-center shrink-0`}>
                            <Icon size={20} />
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${colors.badge}`}>
                            {sch.service_type || 'Health Service'}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-sm text-slate-900 leading-snug">{sch.title}</h4>
                          <div className={`inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold ${colors.bg} px-2.5 py-1 rounded-lg border ${colors.border} text-slate-800`}>
                            <Clock size={12} className="text-slate-500" />
                            <span>{sch.day_of_week || 'Mon - Fri'} • {sch.time_slot}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1 text-[11px] truncate max-w-[180px]">
                          <MapPin size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate">{sch.location || `Barangay ${user?.barangay || 'Pianing'} Health Center`}</span>
                        </span>
                        <Button
                          size="sm"
                          onClick={() => { setSelectedSchedule(sch); setIsBookingOpen(true); }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 px-2.5 rounded-lg font-semibold gap-1 cursor-pointer shrink-0 shadow-xs"
                        >
                          <CalendarPlus size={12} /> Reserve Slot
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Visit History Timeline ─── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Activity className="text-emerald-600" size={17} />
                My Health Visit History
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Records of your clinical visits and nurse-assigned follow-ups.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-semibold">
                {revisitTimeline.length} Record{revisitTimeline.length !== 1 ? 's' : ''}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRecordSummaryOpen(true)}
                className="text-xs border-slate-200 text-slate-600 hover:bg-slate-50 gap-1.5 cursor-pointer sm:hidden"
              >
                <Printer size={13} />
              </Button>
            </div>
          </div>

          <div className="p-5">
            {revisitTimeline.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                  <MessageSquare size={22} />
                </div>
                <p className="font-semibold text-slate-600 text-sm">No recorded health visits yet</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Visit the Barangay Health Center in person for your checkup or vaccination. Your nurse will log your record and schedule any revisits here.
                </p>
              </div>
            ) : (
              <div className="relative pl-7 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-px before:bg-gradient-to-b before:from-emerald-300 before:via-slate-200 before:to-slate-100">
                {revisitTimeline.map((item, idx) => {
                  const isUpcoming = item.status === 'Upcoming' || item.status === 'Pending';
                  return (
                    <div key={`tl-${item.id}-${idx}`} className="relative">
                      <div className={`absolute -left-7 top-2 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold shadow-xs ${
                        isUpcoming
                          ? 'bg-emerald-600 border-white text-white ring-3 ring-emerald-100 animate-pulse'
                          : 'bg-white border-emerald-500 text-emerald-600'
                      }`}>
                        {isUpcoming ? <Clock size={10} /> : <Check size={10} />}
                      </div>

                      <div className={`rounded-xl border p-3.5 transition-all ${
                        isUpcoming ? 'bg-emerald-50/60 border-emerald-200 shadow-xs' : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isUpcoming ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                              {item.service_type}
                            </span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${isUpcoming ? 'border-emerald-300 text-emerald-800 bg-white' : 'border-slate-200 text-slate-600'}`}>
                              {item.status}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-slate-600 flex items-center gap-1 font-semibold">
                            <Calendar size={11} className="text-slate-400" />
                            {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            <span className="text-slate-400 font-normal">· {item.time}</span>
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 flex items-center gap-1.5">
                          <Stethoscope size={11} className="text-emerald-600 shrink-0" />
                          Attending: <strong className="text-slate-800">{item.provider}</strong>
                        </p>

                        {item.vitals && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 p-2.5 bg-white rounded-lg border border-slate-200 text-[11px]">
                            {item.vitals.bp && <div><p className="text-slate-400 text-[10px]">Blood Pressure</p><strong className="text-slate-800">{item.vitals.bp}</strong></div>}
                            {item.vitals.weight && <div><p className="text-slate-400 text-[10px]">Weight</p><strong className="text-slate-800">{item.vitals.weight}</strong></div>}
                            {item.vitals.temp && <div><p className="text-slate-400 text-[10px]">Temperature</p><strong className="text-slate-800">{item.vitals.temp}</strong></div>}
                            {item.vitals.heart_rate && <div><p className="text-slate-400 text-[10px]">Heart Rate</p><strong className="text-slate-800">{item.vitals.heart_rate}</strong></div>}
                          </div>
                        )}

                        {item.instructions && (
                          <div className="mt-2 bg-white border border-emerald-100 rounded-lg p-2.5">
                            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-0.5">Nurse Instructions</p>
                            <p className="text-xs text-emerald-950 leading-relaxed">{item.instructions}</p>
                          </div>
                        )}
                        {item.notes && !item.instructions && (
                          <p className="text-xs text-slate-500 mt-1.5 italic">"{item.notes}"</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── Bottom CTA ─── */}
        <div className="bg-white border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Need a Barangay Document?</h3>
              <p className="text-xs text-slate-500">Request clearances, certificates of residency, indigency, and more.</p>
            </div>
          </div>
          <Button onClick={() => navigate('/resident/barangay')} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-5 shrink-0 flex items-center gap-1.5 cursor-pointer">
            Barangay Portal <ArrowRight size={13} />
          </Button>
        </div>
      </main>

      <BarangayChatbot />

      {/* ─── Print Record Modal ─── */}
      <Dialog open={isRecordSummaryOpen} onOpenChange={setIsRecordSummaryOpen}>
        <DialogContent className="bg-white max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <FileText className="text-emerald-600" size={17} /> Barangay {user?.barangay || 'Pianing'} — Official Patient Record
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">Summary of consultations and nurse-assigned revisits.</DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 text-xs">
            <div className="text-center border-b border-slate-200 pb-3">
              <p className="text-[10px] uppercase font-bold text-slate-400">Republic of the Philippines • City of Butuan</p>
              <h3 className="font-bold text-sm text-slate-900 mt-0.5">BARANGAY {user?.barangay?.toUpperCase() || 'PIANING'} PRIMARY HEALTH CENTER</h3>
              <p className="text-[10px] text-emerald-800 font-semibold">PATIENT CLINICAL SUMMARY & REVISIT PROFILE</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div><p className="text-slate-400 text-[10px]">Full Name:</p><strong className="text-slate-900">{user?.name || 'Resident Name'}</strong></div>
              <div><p className="text-slate-400 text-[10px]">Contact:</p><strong className="text-slate-900 font-mono">{user?.phone || '—'}</strong></div>
              <div><p className="text-slate-400 text-[10px]">Address:</p><span className="text-slate-700">{user?.address || `Barangay ${user?.barangay || 'Pianing'}, Butuan City`}</span></div>
              <div><p className="text-slate-400 text-[10px]">Status:</p><Badge className="bg-emerald-600 text-white text-[9px]">Verified Resident</Badge></div>
            </div>
            {revisitTimeline.length === 0
              ? <div className="text-center py-6 text-slate-400 text-xs">No recorded visits yet.</div>
              : (
                <div className="space-y-2">
                  <h4 className="font-bold text-xs text-slate-800 border-b pb-1">Visit History</h4>
                  {revisitTimeline.map((item, idx) => (
                    <div key={`pr-${idx}`} className="p-2.5 border rounded-lg bg-white space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-800">{item.service_type}</span>
                        <span className="font-mono text-slate-500">{item.date}</span>
                      </div>
                      <p className="text-slate-500 text-[10px]">Attending: {item.provider}</p>
                      {item.vitals && <p className="text-emerald-800 font-mono text-[10px]">BP {item.vitals.bp || '—'} | Wt: {item.vitals.weight || '—'} | Temp: {item.vitals.temp || '—'}</p>}
                      {item.instructions && <p className="text-slate-600 text-[10px] italic">Notes: {item.instructions}</p>}
                    </div>
                  ))}
                </div>
              )
            }
            <div className="pt-6 flex justify-between items-end text-[10px] text-slate-500">
              <div><div className="w-28 border-b border-slate-400 mb-1" /><span>Patient Signature</span></div>
              <div><div className="w-40 border-b border-slate-400 mb-1 font-bold text-slate-900">Nurse Maria Santos, RN</div><span>Health Center In-Charge</span></div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button size="sm" onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 cursor-pointer"><Printer size={13} /> Print Record</Button>
            <Button size="sm" variant="outline" onClick={() => setIsRecordSummaryOpen(false)} className="text-xs">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Notifications Modal ─── */}
      <Dialog open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
        <DialogContent className="bg-white max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
              <Bell className="text-emerald-600" size={17} /> Health Notifications
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">Your revisit schedule and account updates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-2">
            {nextUpcomingVisit ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    <CalendarCheck size={13} className="text-emerald-600" /> {nextUpcomingVisit.service_type}
                  </span>
                  <Badge className="bg-emerald-600 text-white text-[10px]">Confirmed</Badge>
                </div>
                <p className="text-xs text-emerald-800">
                  <strong>{new Date(nextUpcomingVisit.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                  {' '}at <strong>{nextUpcomingVisit.time}</strong>
                </p>
                {nextUpcomingVisit.instructions && (
                  <p className="text-[11px] text-emerald-700 italic">{nextUpcomingVisit.instructions}</p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs py-8">
                No upcoming revisits. Walk in to the Health Center to get started.
              </div>
            )}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <BadgeCheck size={13} className="text-blue-600" /> Account Verified
                </span>
                <span className="text-[10px] text-slate-400">Active</span>
              </div>
              <p className="text-xs text-slate-500">Your resident account is active and verified by Barangay {user?.barangay || 'Pianing'}.</p>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsNotificationsOpen(false)} className="text-xs">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Make an Appointment / Reserve Slot Modal ─── */}
      <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <CalendarPlus className="text-emerald-600" size={20} />
              Book Clinic Appointment
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Reserve your consultation slot based on Barangay {user?.barangay || 'Pianing'} health center operating schedules.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleBookAppointment} className="space-y-4 pt-2">
            {/* Target Clinic Program */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Health Program / Service</label>
              {clinicSchedules.length > 0 ? (
                <select
                  value={selectedSchedule?.id || clinicSchedules[0]?.id || ''}
                  onChange={(e) => {
                    const found = clinicSchedules.find(s => String(s.id) === e.target.value);
                    if (found) setSelectedSchedule(found);
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  {clinicSchedules.map(sched => (
                    <option key={sched.id} value={sched.id}>
                      {sched.service_type || sched.title} ({sched.day_of_week} • {sched.time_slot})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2.5 bg-slate-100 rounded-xl text-xs text-slate-600">
                  {selectedSchedule?.service_type || selectedSchedule?.title || 'General Consultation'}
                </div>
              )}
            </div>

            {/* Selected Schedule Details Card */}
            {selectedSchedule && (
              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center justify-between text-emerald-900 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-emerald-600" />
                    {selectedSchedule.day_of_week}s, {selectedSchedule.time_slot}
                  </span>
                  <Badge className="bg-emerald-600 text-white text-[10px]">
                    Max {selectedSchedule.slots_available || selectedSchedule.max_slots || 30} slots
                  </Badge>
                </div>
                {(selectedSchedule.location || selectedSchedule.room) && (
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                    <MapPin size={11} /> {selectedSchedule.location || selectedSchedule.room}
                  </p>
                )}
                {(selectedSchedule.bhw_in_charge || selectedSchedule.assigned_staff) && (
                  <p className="text-[11px] text-emerald-700">
                    Assigned: <span className="font-medium">{selectedSchedule.bhw_in_charge || selectedSchedule.assigned_staff}</span>
                  </p>
                )}
                {selectedSchedule.description && (
                  <p className="text-[11px] text-slate-600 italic">
                    {selectedSchedule.description}
                  </p>
                )}
              </div>
            )}

            {/* Resident Info Preview */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Patient Name</span>
                <p className="font-bold text-slate-900 truncate">{user?.name || 'Resident'}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Contact Phone</span>
                <p className="font-bold text-slate-800 font-mono">{user?.phone || user?.contact_number || 'None provided'}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Barangay</span>
                <p className="font-medium text-slate-800">Brgy. {user?.barangay || 'Pianing'}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Purok</span>
                <p className="font-medium text-slate-800">
                  {user?.purok
                    ? (String(user.purok).toLowerCase().startsWith('purok') ? user.purok : `Purok ${user.purok}`)
                    : (user?.address?.match(/purok\s*([0-9A-Za-z]+)/i)?.[0] || 'Purok 1')}
                </p>
              </div>
            </div>

            {/* Preferred Date Strictly Filtered by Schedule's Operating Day */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  Preferred Appointment Date <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {formatOperatingDaysSummary(selectedSchedule?.day_of_week)} Only
                </span>
              </div>

              {/* Operating Dates Dropdown */}
              <select
                required
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
              >
                {availableOperatingDates.map((d, i) => (
                  <option key={d.dateStr} value={d.dateStr}>
                    {d.label} {i === 0 ? '— (Next Available Operating Slot)' : ''}
                  </option>
                ))}
              </select>

              {/* Quick-Pick Date Pills */}
              <div className="pt-0.5">
                <span className="text-[10px] text-slate-400 block mb-1 font-medium">Quick Select Available Slot:</span>
                <div className="flex flex-wrap gap-1.5">
                  {availableOperatingDates.slice(0, 4).map(d => (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => setBookingDate(d.dateStr)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
                        bookingDate === d.dateStr
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {d.formatted}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-slate-400">
                Operating schedule: <span className="font-semibold text-slate-600">{formatOperatingDaysSummary(selectedSchedule?.day_of_week)}</span> ({selectedSchedule?.time_slot || 'Regular Hours'}). Only available operating dates are shown.
              </p>
            </div>

            {/* Reason / Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Symptoms / Reason for Consultation (Optional)
              </label>
              <textarea
                rows={3}
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="Briefly state your concern, symptoms, or medication refill requests..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
              />
            </div>

            <p className="text-[10px] text-slate-400 text-center pt-1">
              By booking an appointment, you agree to our{' '}
              <button
                type="button"
                onClick={() => setIsTermsOpen(true)}
                className="text-emerald-700 font-semibold underline cursor-pointer hover:text-emerald-800"
              >
                Data Privacy Policy &amp; Terms
              </button>
            </p>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBookingOpen(false)}
                className="text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isBookingLoading || !bookingDate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 rounded-xl cursor-pointer"
              >
                {isBookingLoading ? 'Submitting...' : 'Confirm Appointment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TermsAndPrivacyModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onProfileUpdated={(updated) => setUser(updated)}
      />
    </div>
  );
}
