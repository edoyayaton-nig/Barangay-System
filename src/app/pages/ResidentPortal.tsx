import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  FileText,
  UserCheck,
  AlertTriangle,
  LogOut,
  Building2,
  Heart,
  ArrowRight,
  Shield,
  Activity,
  CheckCircle2,
  Settings,
  User,
  Clock,
  Phone,
  Mail,
  CalendarPlus,
  Calendar,
  MapPin,
  X,
  Lock
} from 'lucide-react';
import { getBarangayContact, getBarangayEmail } from '../../utils/barangays';
import { apiService, DocumentRequest, ClinicSchedule } from '../../services/api';
import BarangayChatbot from '../components/BarangayChatbot';
import ProfileSettingsModal from '../components/ProfileSettingsModal';
import TermsAndPrivacyModal from '../components/TermsAndPrivacyModal';
import SuperAdminNavigationDock from '../components/SuperAdminNavigationDock';
import SystemNoticeBanner from '../components/SystemNoticeBanner';
import { getUpcomingOperatingDates, formatOperatingDaysSummary } from '../../utils/scheduleDateUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';

function formatApptDate(dateStr?: string) {
  if (!dateStr) return '';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10) - 1;
    const da = parseInt(parts[2], 10);
    const d = new Date(yr, mo, da);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return clean;
}

export default function ResidentPortal() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentRequest[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Clinic Reservation State
  const [clinicSchedules, setClinicSchedules] = useState<ClinicSchedule[]>([]);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ClinicSchedule | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Available dates strictly restricted to the schedule's operating days
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

  const residentBrgy = user?.barangay || (() => {
    if (user?.address) {
      const match = user.address.match(/Barangay\s+([^,]+)/i);
      if (match) return match[1].trim();
      if (user.address.toLowerCase().includes('anticala')) return 'Anticala';
    }
    return 'Pianing';
  })();

  const loadData = async (currentUser?: any) => {
    try {
      const data = await apiService.getDocuments();
      const loggedInUser = currentUser || user;
      if (loggedInUser?.name || loggedInUser?.email || loggedInUser?.id) {
        const uEmail = (loggedInUser.email || '').toLowerCase().trim();
        const uId = loggedInUser.id;
        const uName = (loggedInUser.name || '').toLowerCase().trim();
        const matched = data.filter(d => {
          const dEmail = ((d as any).email || '').toLowerCase().trim();
          if (uEmail && dEmail && dEmail === uEmail) return true;
          if (uId && d.resident_id && d.resident_id === uId) return true;
          if (uName && d.resident_name && d.resident_name.toLowerCase().trim() === uName) return true;
          return false;
        });
        const uniqueDocs = new Map();
        for (const doc of matched) {
          const key = doc.id ? `id-${doc.id}` : (doc.request_code ? `code-${doc.request_code}` : JSON.stringify(doc));
          if (!uniqueDocs.has(key)) {
            uniqueDocs.set(key, doc);
          }
        }
        setDocuments(Array.from(uniqueDocs.values()));
      } else {
        // Visitor: show sample docs
        setDocuments(data.slice(0, 3));
      }
    } catch (e) {
      toast.error('Failed to load document requests');
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('barangay_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.role === 'superadmin' || parsed.role === 'admin' || parsed.role === 'staff') {
          navigate('/admin');
          return;
        }
        if (parsed.role === 'bhw') {
          navigate('/bhw');
          return;
        }
        setUser(parsed);
        setIsVerified(parsed.verification_status === 'Verified');
        loadData(parsed);

        // Live-check if admin has approved the account since last login, and sync date_of_birth / age
        if (parsed.email) {
          apiService.checkVerificationStatus(parsed.email).then(result => {
            const liveUser = (result as any)?.user || result;
            if (liveUser) {
              const liveStatus = liveUser.verification_status;
              const hasChanged = liveStatus && liveStatus !== parsed.verification_status;
              const cleanDob = liveUser.date_of_birth ? (typeof liveUser.date_of_birth === 'string' ? liveUser.date_of_birth.split('T')[0] : liveUser.date_of_birth) : (parsed.date_of_birth || '');
              const updated = {
                ...parsed,
                ...liveUser,
                date_of_birth: cleanDob,
                age: liveUser.age !== undefined && liveUser.age !== null && liveUser.age !== '' ? liveUser.age : parsed.age
              };
              setUser(updated);
              setIsVerified(updated.verification_status === 'Verified');
              localStorage.setItem('barangay_user', JSON.stringify(updated));
              if (hasChanged && liveStatus === 'Verified') {
                toast.success('Account Verified!', {
                  description: 'Your Barangay ID was approved. You can now request documents.'
                });
              }
            }
          }).catch(() => {});
        }
      } catch (e) {
        loadData();
      }
    } else {
      setIsVerified(false);
      loadData();
    }
  }, []);

  // Load clinic schedules when user/barangay resolves
  useEffect(() => {
    if (residentBrgy) {
      apiService.getClinicSchedules(residentBrgy).then(s => setClinicSchedules(s.filter(sc => sc.status === 'Active'))).catch(() => {});
      
      const fetchBookings = () => {
        apiService.getAppointments({ barangay: residentBrgy }).then((apts: any[]) => {
          if (user?.name || user?.email || user?.id) {
            const uId = user?.id;
            const uName = (user?.name || '').toLowerCase().trim();
            const uEmail = (user?.email || '').toLowerCase().trim();
            const mine = apts.filter((a: any) => {
              if (uId && a.resident_id === uId) return true;
              if (uEmail && a.resident_email && a.resident_email.toLowerCase() === uEmail) return true;
              if (uName && a.resident_name && a.resident_name.toLowerCase().includes(uName)) return true;
              if (uName && a.patient_name && a.patient_name.toLowerCase().includes(uName)) return true;
              return false;
            });
            setMyBookings(mine);
          }
        }).catch(() => {});
      };

      fetchBookings();
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchBookings();
        }
      }, 4000);

      return () => clearInterval(interval);
    }
  }, [residentBrgy, user?.id, user?.name, user?.email]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) {
      toast.error('Residency Verification Required', {
        description: 'Only verified residents can book health center appointments. Your residency account is currently awaiting verification by Barangay Officials.'
      });
      return;
    }
    if (!selectedSchedule) return;
    if (!bookingDate) { toast.error('Please select a preferred date'); return; }
    setIsBookingLoading(true);
    try {
      const apt = await apiService.createAppointment({
        resident_name: user?.name || 'Resident',
        resident_phone: user?.phone || user?.contact_number || '',
        resident_email: user?.email || '',
        barangay: residentBrgy,
        resident_id: user?.id,
        service_type: selectedSchedule.service_type || selectedSchedule.title,
        preferred_date: bookingDate,
        resident_notes: bookingNotes,
        status: 'Pending',
      } as any);
      setMyBookings(prev => [apt, ...prev]);
      toast.success(`Appointment booked for ${bookingDate}! The nurse will confirm your slot.`);
      try {
        const ch = new BroadcastChannel('barangay_health_sync');
        ch.postMessage({ type: 'HEALTH_DATA_SYNC', timestamp: Date.now() });
        ch.close();
      } catch {}
      setIsBookingOpen(false);
      setBookingDate('');
      setBookingNotes('');
      setSelectedSchedule(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to book appointment. Please verify your resident account status.');
    } finally {
      setIsBookingLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans relative">
      {/* System Notice Banner (System Down / Maintenance / Advisory) */}
      <SystemNoticeBanner />

      {/* Super Admin Unified Ecosystem Switcher */}
      <SuperAdminNavigationDock currentRole={user?.role} />

      {/* Top Navbar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-white shadow-xs border border-indigo-200 flex items-center justify-center">
              <img src="/assets/pianing-logo.png" alt={`Barangay ${residentBrgy}`} className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Barangay {residentBrgy}</h1>
              <span className="text-xs text-indigo-600 font-semibold">Resident Portal Gateway</span>
            </div>
          </div>

          {/* Quick Barangay Contact Pill in Navbar */}
          <div className="hidden md:flex items-center gap-3 text-xs bg-indigo-50/70 border border-indigo-200/80 px-3 py-1.5 rounded-xl">
            <a href={`tel:${getBarangayContact(residentBrgy).replace(/[^0-9+]/g, '')}`} className="flex items-center gap-1.5 text-indigo-800 hover:text-indigo-950 font-medium transition-colors cursor-pointer" title="Barangay Official Hotline">
              <Phone size={13} className="text-indigo-600 shrink-0" />
              <span className="font-mono font-bold text-[11px]">{getBarangayContact(residentBrgy)}</span>
            </a>
            <span className="text-indigo-300">|</span>
            <a href={`mailto:${getBarangayEmail(residentBrgy)}`} className="flex items-center gap-1.5 text-indigo-800 hover:text-indigo-950 font-medium transition-colors cursor-pointer" title="Official Barangay Gmail">
              <Mail size={13} className="text-indigo-600 shrink-0" />
              <span className="truncate max-w-[200px] text-[11px]">{getBarangayEmail(residentBrgy)}</span>
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-1.5 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400"
              >
                <Settings size={14} />
                <span>Profile Settings</span>
              </Button>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={() => { toast.info('Logged out'); navigate('/login'); }}
              className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Personalized Welcome Banner for Authenticated Resident */}
        {user && user.role === 'resident' ? (
          <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-sm border border-teal-800/40 relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-teal-500/20 text-teal-300 border border-teal-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Official Resident Account
                  </span>
                  <span className="text-[11px] text-teal-200/90 font-mono">
                    • Barangay {residentBrgy} • {user.purok || 'Purok 1'}
                  </span>
                  {isVerified ? (
                    <span className="text-[11px] text-emerald-300 font-bold flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <CheckCircle2 size={12} /> Verified Citizen
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-300 font-bold flex items-center gap-1 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                      <Clock size={12} /> Verification Under Review
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
                  Welcome back, {user.name || 'Resident'}! 👋
                </h2>
                <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                  Official self-service desk for Barangay {residentBrgy}. Request clearances, monitor processing status, and book community health visits.
                </p>
              </div>

              {/* Quick Help Hotline */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`tel:${getBarangayContact(residentBrgy).replace(/[^0-9+]/g, '')}`}
                  className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs"
                >
                  <Phone size={13} />
                  <span>{getBarangayContact(residentBrgy)}</span>
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* Official Barangay Helpdesk & Contact Banner for Guests */
          <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-teal-800/40 relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-teal-500/20 text-teal-300 border border-teal-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Barangay {residentBrgy} Official Helpdesk
                  </span>
                  <span className="text-slate-300 text-[11px] flex items-center gap-1">
                    <Clock size={12} className="text-teal-400" /> Mon - Fri: 8:00 AM - 5:00 PM
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Barangay {residentBrgy} Official Assistance Desk
                </h2>
                <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                  For questions regarding document clearances, pickup verification, or community health services:
                </p>
              </div>

              {/* Quick Contact Buttons */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto shrink-0">
                <a
                  href={`tel:${getBarangayContact(residentBrgy).replace(/[^0-9+]/g, '')}`}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Phone size={13} />
                  <span>{getBarangayContact(residentBrgy)}</span>
                </a>
                <a
                  href={`mailto:${getBarangayEmail(residentBrgy)}`}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-medium px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Mail size={13} />
                  <span className="truncate max-w-[200px]">{getBarangayEmail(residentBrgy)}</span>
                </a>
              </div>
            </div>
          </div>
        )}
        {/* Account Verification Warning Banner */}
        {!user || user.role !== 'resident' ? (
          <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-800">Visitor Mode (Preview)</h3>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-800 border-slate-300 text-[10px]">
                    Visitor
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                  You are currently viewing the resident hub. Sign in to request official clearances or health certificates.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/login')}
              className="bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs h-9 px-4 shrink-0 shadow-sm"
            >
              Sign In / Register
            </Button>
          </div>
        ) : !isVerified ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-amber-900">Verification Pending Review</h3>
                  <Badge variant="secondary" className="bg-amber-200 text-amber-900 border-amber-300 text-[10px]">
                    Pending
                  </Badge>
                </div>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed max-w-2xl">
                  Your uploaded ID is under review by the Barangay Admin. Document requests will be unlocked once approved.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-amber-100/80 border border-amber-300 text-amber-900 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0">
              <Clock size={15} className="animate-spin text-amber-700" />
              <span>Awaiting Barangay Admin Approval</span>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <span className="font-bold">Account Status: Verified Resident</span>
            </div>
            <Badge className="bg-emerald-600">Online Requests Unlocked</Badge>
          </div>
        )}

        {/* Portal Selection Cards Header */}
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Resident Portals</h2>
          <p className="text-xs text-slate-500">Select a portal below to request documents specific to that department.</p>
        </div>

        {/* Two Resident Portals */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Card 1: Barangay Portal */}
          <Card className="border-indigo-200 bg-gradient-to-br from-white to-indigo-50/50 hover:shadow-lg transition-all duration-200 flex flex-col justify-between">
            <CardHeader>
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-2 shadow-md">
                <Building2 size={24} />
              </div>
              <CardTitle className="text-lg font-bold text-slate-900">Barangay Portal</CardTitle>
              <CardDescription className="text-xs text-slate-600 leading-relaxed">
                Request official barangay clearances, residency certificates, business permits, certificates of indigency, and barangay IDs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700">Barangay Clearance</Badge>
                <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700">Residency Cert</Badge>
                <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700">Business Permit</Badge>
                <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700">Indigency Cert</Badge>
                <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700">Barangay ID</Badge>
              </div>
              <Button
                onClick={() => navigate('/resident/barangay')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-10 shadow-sm flex items-center justify-center gap-1.5"
              >
                Enter Barangay Portal
                <ArrowRight size={15} />
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Health Center Portal */}
          <Card className="border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 hover:shadow-lg transition-all duration-200 flex flex-col justify-between">
            <CardHeader>
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-md">
                <Heart size={24} />
              </div>
              <CardTitle className="text-lg font-bold text-slate-900">Health Center Portal</CardTitle>
              <CardDescription className="text-xs text-slate-600 leading-relaxed">
                Request health center documents including medical certificates, health clearances, child immunization records, and maternal care records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">Medical Cert</Badge>
                <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">Health Clearance</Badge>
                <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">Immunization Record</Badge>
                <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">Prenatal Record</Badge>
                <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">Postnatal Record</Badge>
              </div>
              <Button
                onClick={() => navigate('/resident/health')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-10 shadow-sm flex items-center justify-center gap-1.5"
              >
                Enter Health Center Portal
                <ArrowRight size={15} />
              </Button>
            </CardContent>
          </Card>
        </div>


        {/* Civic Privacy & Security Footer */}
        <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 flex flex-wrap items-center justify-center gap-4 text-center">
          <span className="flex items-center gap-1.5"><Shield size={14} className="text-indigo-600" /> Authorized Resident Access Only</span>
          <span>•</span>
          <span>Barangay {residentBrgy} Citizen Portal</span>
          <span>•</span>
          <span>Republic Act No. 10173 (Data Privacy Act)</span>
        </div>
      </main>

      {/* Embedded Floating Resident Assistant Chatbot */}
      <BarangayChatbot />

      {/* Resident Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onProfileUpdated={(updated) => setUser(updated)}
      />

      {/* Clinic Appointment Booking Modal */}
      {isBookingOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-violet-100 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm flex items-center gap-2"><CalendarPlus size={16} /> Reserve a Slot</h2>
                  <p className="text-violet-200 text-[11px] mt-0.5">{selectedSchedule.title || selectedSchedule.service_type}</p>
                </div>
                <button onClick={() => setIsBookingOpen(false)} className="p-1 hover:bg-white/20 rounded-lg cursor-pointer transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>
            <form onSubmit={handleBookAppointment} className="p-5 space-y-4">
              {!isVerified && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Residency Verification Required</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Your resident profile is awaiting Barangay Admin approval. Appointment booking unlocks once your residency is verified.
                    </p>
                  </div>
                </div>
              )}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-xs space-y-1.5">
                <p className="font-bold text-violet-900">{selectedSchedule.title || selectedSchedule.service_type}</p>
                <p className="text-slate-600 flex items-center gap-1.5"><Clock size={12} /> {selectedSchedule.day_of_week || (selectedSchedule as any).day} · {selectedSchedule.time_slot}</p>
                {selectedSchedule.location && <p className="text-slate-600 flex items-center gap-1.5"><MapPin size={12} /> {selectedSchedule.location}</p>}
              </div>
              {/* Resident Info Preview */}
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Patient Name</span>
                  <p className="font-bold text-slate-900 truncate">{user?.name || 'Resident'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Contact Phone</span>
                  <p className="font-bold text-slate-800 font-mono truncate">{user?.phone || user?.contact_number || 'None provided'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Barangay</span>
                  <p className="font-medium text-slate-800">Brgy. {residentBrgy}</p>
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

              {/* Operating Date Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    Preferred Date <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200">
                    {formatOperatingDaysSummary(selectedSchedule.day_of_week || (selectedSchedule as any).day)} Only
                  </span>
                </div>

                <select
                  required
                  value={bookingDate}
                  onChange={e => setBookingDate(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-200 outline-none transition-all cursor-pointer"
                >
                  {availableOperatingDates.map((d, i) => (
                    <option key={d.dateStr} value={d.dateStr}>
                      {d.label} {i === 0 ? '— (Next Available Slot)' : ''}
                    </option>
                  ))}
                </select>

                {/* Quick-Pick Date Pills */}
                <div className="pt-0.5">
                  <span className="text-[10px] text-slate-400 block mb-1">Quick Select Date:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableOperatingDates.slice(0, 4).map(d => (
                      <button
                        key={d.dateStr}
                        type="button"
                        onClick={() => setBookingDate(d.dateStr)}
                        className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer font-medium ${
                          bookingDate === d.dateStr
                            ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {d.formatted}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-slate-400">
                  This service operates strictly on: <span className="font-semibold text-slate-600">{formatOperatingDaysSummary(selectedSchedule.day_of_week || (selectedSchedule as any).day)}</span>.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Notes / Reason for Visit (Optional)</label>
                <textarea
                  value={bookingNotes}
                  onChange={e => setBookingNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Monthly prenatal checkup, child immunization schedule..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-200 outline-none transition-all resize-none"
                />
              </div>

              <p className="text-[10px] text-slate-400 text-center">
                By booking, you agree to our{' '}
                <button
                  type="button"
                  onClick={() => setIsTermsOpen(true)}
                  className="text-violet-700 font-semibold underline cursor-pointer hover:text-violet-800"
                >
                  Privacy Policy &amp; Terms
                </button>
              </p>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setIsBookingOpen(false)} className="flex-1 text-xs rounded-xl cursor-pointer">Cancel</Button>
                <Button type="submit" disabled={isBookingLoading || !bookingDate || !isVerified} className={`flex-1 text-xs rounded-xl font-semibold gap-1.5 ${!isVerified ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white cursor-pointer'}`}>
                  {isBookingLoading ? 'Booking...' : !isVerified ? <><Lock size={14} /> Verification Required</> : <><CalendarPlus size={14} /> Confirm Reservation</>}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TermsAndPrivacyModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />
    </div>
  );
}
