import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  FileText,
  UserCheck,
  AlertTriangle,
  Shield,
  LogOut,
  PlusCircle,
  CheckCircle2,
  Lock,
  Building2,
  Heart,
  ArrowRight,
  ArrowLeft,
  Settings,
  Clock,
  Bell,
  Info,
  XCircle,
  X,
  MessageSquare,
  RefreshCw,
  Phone,
  Mail,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  MapPin,
  Stethoscope,
  Syringe,
  Users,
  ShieldCheck,
  Camera,
  Eye,
  FileCheck,
  UploadCloud,
  Maximize2
} from 'lucide-react';
import { getBarangayContact, getBarangayEmail } from '../../utils/barangays';
import { saveStoredUser } from '../../utils/safeStorage';
import { apiService, DocumentRequest, ClinicSchedule, HealthAppointment } from '../../services/api';
import { compressImage } from '../../utils/imageCompressor';
import ImageViewerModal from '../components/ImageViewerModal';
import BarangayChatbot from '../components/BarangayChatbot';
import ProfileSettingsModal from '../components/ProfileSettingsModal';
import TermsAndPrivacyModal from '../components/TermsAndPrivacyModal';
import ResubmitIdModal from '../components/ResubmitIdModal';
import SuperAdminNavigationDock from '../components/SuperAdminNavigationDock';
import SystemNoticeBanner from '../components/SystemNoticeBanner';
import { getUpcomingOperatingDates, formatOperatingDaysSummary } from '../../utils/scheduleDateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '../components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { FloatingInput, FloatingSelect, FloatingTextarea } from '../components/ui/floating-input';
import { notificationStore, PersistentNotification } from '../../services/notificationStore';
import { dispatchResidentNotification } from '../../services/emailJsService';
import ThemeToggle from '../components/ThemeToggle';
import { toast } from 'sonner';

const BARANGAY_DOCS = [
  'Barangay Clearance',
  'Certificate of Residency',
  'Certificate of Indigency',
  'Good Moral Clearance',
  'Business Clearance',
  'Certificate of Employment',
  'Certificate of Land Occupancy',
  'Barangay Activity Permit',
];

const DOC_DESCRIPTIONS: Record<string, string> = {
  'Barangay Clearance':              'For employment, bank requirement, loans & government IDs',
  'Certificate of Residency':        'Proof of bonafide residency for school, utility or bank',
  'Certificate of Indigency':        'For medical, educational, burial & DSWD financial assistance',
  'Good Moral Clearance':            'Official character clearance for PRC board exams & school',
  'Business Clearance':              'Barangay commercial permit for sari-sari stores & businesses',
  'Certificate of Employment':       'Barangay employment certificate & first time jobseeker aid',
  'Certificate of Land Occupancy':   'Proof of actual physical occupancy & lot possession',
  'Barangay Activity Permit':        'Permit for events, product sampling, promotions & gatherings',
};

const DUPLICATE_SUGGESTIONS: Record<string, string> = {
  'Barangay Clearance':              'Your Barangay Clearance request is being processed. Please wait for an SMS notification or visit the Barangay Hall.',
  'Certificate of Residency':        'A Certificate of Residency request is already on file. Visit the Barangay Hall with your valid ID if urgent.',
  'Certificate of Indigency':        'An Indigency Certificate request already exists. Please coordinate with the Barangay Social Welfare office.',
  'Good Moral Clearance':            'Your Good Moral Clearance application is under review by the Barangay Secretary.',
  'Business Clearance':              'Your Business Clearance application is currently under review by Barangay Staff.',
  'Certificate of Employment':       'Your Employment Certification is currently being prepared.',
  'Certificate of Land Occupancy':   'A Land Occupancy certification is being reviewed by the Barangay Council.',
  'Barangay Activity Permit':        'Your Activity Permit request is under evaluation by the Punong Barangay.',
};

function getHealthServiceIcon(serviceType?: string) {
  const s = (serviceType || '').toLowerCase();
  if (s.includes('prenatal') || s.includes('maternal') || s.includes('pregnancy')) return Heart;
  if (s.includes('immun') || s.includes('vaccin') || s.includes('baby') || s.includes('child')) return Syringe;
  if (s.includes('family') || s.includes('planning')) return Users;
  if (s.includes('senior') || s.includes('elderly')) return ShieldCheck;
  return Stethoscope;
}

function getHealthServiceColor(serviceType?: string) {
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

export default function BarangayPortal() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentRequest[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [docType, setDocType] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isRejectionBannerDismissed, setIsRejectionBannerDismissed] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<PersistentNotification[]>([]);

  // Mandatory Purok President Certificate Attachment State
  const [purokCertPhoto, setPurokCertPhoto] = useState<string | null>(null);
  const [purokCertFileName, setPurokCertFileName] = useState('');
  const [purokCertUploading, setPurokCertUploading] = useState(false);
  const [viewingPurokPhoto, setViewingPurokPhoto] = useState<string | null>(null);
  const purokFileInputRef = useRef<HTMLInputElement | null>(null);

  // Health Clinic Schedules and Appointment Booking States
  const [clinicSchedules, setClinicSchedules] = useState<ClinicSchedule[]>([]);
  const [myBookings, setMyBookings] = useState<HealthAppointment[]>([]);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ClinicSchedule | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [isBookingLoading, setIsBookingLoading] = useState(false);
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

  const markNotifRead = (key: string) => {
    if (user?.email) {
      notificationStore.markAsRead(user.email, key);
      setNotifications(notificationStore.getNotifications(user.email));
    }
  };

  const markAllNotifsRead = () => {
    if (user?.email) {
      notificationStore.markAllAsRead(user.email);
      setNotifications(notificationStore.getNotifications(user.email));
      toast.success('All notifications marked as read');
    }
  };

  // Dynamic extra fields per document type
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const setField = (key: string, val: string) => setExtraFields(prev => ({ ...prev, [key]: val }));

  const userBarangay = user?.barangay || (() => {
    if (user?.address) {
      const match = user.address.match(/Barangay\s+([^,]+)/i);
      if (match) return match[1].trim();
      if (user.address.toLowerCase().includes('anticala')) return 'Anticala';
    }
    return 'Pianing';
  })();

  const isCategoryActive = (docName: string) => {
    if (!categories || categories.length === 0) return true;
    const cat = categories.find(c => c.name.toLowerCase() === docName.toLowerCase());
    return cat ? cat.status === 'Active' : true;
  };

  // Extract purok from user address or user object
  const extractPurok = (address?: string): string => {
    if (user?.purok) return user.purok;
    if (!address) return '';
    const match = address.match(/^([^,]+)/); // take everything before the first comma
    return match ? match[1].trim() : address.trim();
  };

  // Calculate age from date_of_birth or birthdate
  const calculateAge = (dobStr?: string, ageNum?: number | string): string => {
    if (ageNum !== undefined && ageNum !== null && ageNum !== '' && !isNaN(Number(ageNum))) {
      return `${ageNum} yrs old`;
    }
    if (!dobStr) return '—';
    try {
      const dob = new Date(dobStr);
      if (isNaN(dob.getTime())) return '—';
      const diff = Date.now() - dob.getTime();
      const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
      return isNaN(age) || age < 0 ? '—' : `${age} yrs old`;
    } catch {
      return '—';
    }
  };

  const handleDocTypeChange = (val: string) => {
    setDocType(val);
    setPurpose('');
    setExtraFields({});
    setPurokCertPhoto(null);
    setPurokCertFileName('');
    if (purokFileInputRef.current) purokFileInputRef.current.value = '';
  };

  const handleOpenDocModal = (type?: string) => {
    if (!isVerified) {
      toast.error('Document requests locked!', {
        description: 'Your account must be verified by Barangay Admin first.',
      });
      return;
    }
    if (type && !isCategoryActive(type)) {
      toast.error('Service Temporarily Suspended', {
        description: `Requests for ${type} have been deactivated by the Super Administrator.`
      });
      return;
    }
    setIsAddDocOpen(true);
    if (type) {
      handleDocTypeChange(type);
    }
  };

  // Reset dialog fully when closed
  const handleDialogOpenChange = (open: boolean) => {
    setIsAddDocOpen(open);
    if (!open) {
      setDocType('');
      setExtraFields({});
      setPurpose('');
      setPurokCertPhoto(null);
      setPurokCertFileName('');
      if (purokFileInputRef.current) purokFileInputRef.current.value = '';
    }
  };

  // Upload and compress Certificate of Purok President
  const handlePurokCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size exceeds limit', { description: 'Please select an image smaller than 15MB.' });
      return;
    }
    setPurokCertUploading(true);
    setPurokCertFileName(file.name);
    try {
      const compressed = await compressImage(file, 1400, 1400, 0.8);
      setPurokCertPhoto(compressed);
      toast.success('Certificate of Purok President attached!');
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        setPurokCertPhoto(reader.result as string);
        toast.success('Certificate of Purok President attached!');
      };
      reader.readAsDataURL(file);
    } finally {
      setPurokCertUploading(false);
    }
  };

  const loadData = async (currentUser?: any) => {
    try {
      const loggedInUser = currentUser || user;
      const uEmail = (loggedInUser?.email || '').toLowerCase().trim();
      const uId = loggedInUser?.id ? Number(loggedInUser.id) : undefined;
      const uName = (loggedInUser?.name || `${loggedInUser?.first_name || ''} ${loggedInUser?.last_name || ''}`).toLowerCase().trim();
      const currentBrgy = loggedInUser?.barangay || 'Pianing';

      const [data, cats, apts, schedules] = await Promise.all([
        apiService.getDocuments(uEmail ? { email: uEmail, resident_id: uId } : undefined),
        apiService.getCategories().catch(() => []),
        apiService.getAppointments({ barangay: currentBrgy }).catch(() => []),
        apiService.getClinicSchedules(currentBrgy).catch(() => [])
      ]);
      if (cats && cats.length > 0) setCategories(cats);

      if (schedules && schedules.length > 0) {
        setClinicSchedules(schedules);
      } else {
        setClinicSchedules([
          {
            id: 1,
            title: 'Prenatal & Maternal Care Clinic',
            service_type: 'Prenatal Care',
            day_of_week: 'Every Monday & Thursday',
            time_slot: '8:00 AM – 12:00 PM & 1:00 PM – 4:00 PM',
            location: `Barangay ${currentBrgy} Health Center`,
            bhw_in_charge: 'Nurse Maria Santos (Duty Nurse)',
            barangay: currentBrgy,
            slots_available: 20,
            status: 'Active'
          },
          {
            id: 2,
            title: 'EPI Child Immunization & Growth Monitoring',
            service_type: 'Child Immunization',
            day_of_week: 'Every Wednesday',
            time_slot: '8:00 AM – 12:00 PM',
            location: `Barangay ${currentBrgy} Health Center`,
            bhw_in_charge: 'Nurse Maria Santos (Duty Nurse)',
            barangay: currentBrgy,
            slots_available: 30,
            status: 'Active'
          },
          {
            id: 3,
            title: 'General Primary Care & Hypertension Screening',
            service_type: 'General Consultation',
            day_of_week: 'Tuesday & Friday',
            time_slot: '8:00 AM – 12:00 PM & 1:00 PM – 4:00 PM',
            location: `Barangay ${currentBrgy} Health Center`,
            bhw_in_charge: 'Nurse Maria Santos (Duty Nurse)',
            barangay: currentBrgy,
            slots_available: 25,
            status: 'Active'
          },
          {
            id: 4,
            title: 'Family Planning, Counseling & Contraceptive Supply',
            service_type: 'Family Planning',
            day_of_week: 'Every 2nd & 4th Friday',
            time_slot: '1:00 PM – 4:00 PM',
            location: `Barangay ${currentBrgy} Health Center`,
            bhw_in_charge: 'Nurse Maria Santos (Duty Nurse)',
            barangay: currentBrgy,
            slots_available: 15,
            status: 'Active'
          }
        ]);
      }

      if (uEmail || uId || uName) {
        const userApts = (apts || []).filter((a: HealthAppointment) => {
          if (uId && a.resident_id && a.resident_id === uId) return true;
          if (uEmail && a.resident_email && a.resident_email.toLowerCase() === uEmail) return true;
          if (uName && a.resident_name && a.resident_name.toLowerCase().includes(uName)) return true;
          return false;
        });
        setMyBookings(userApts);
      } else {
        setMyBookings([]);
      }

      let myDocs: DocumentRequest[] = [];
      if (Array.isArray(data)) {
        if (uEmail || uId || uName) {
          myDocs = data.filter(d => {
            const dEmail = ((d as any).email || '').toLowerCase().trim();
            if (uEmail && dEmail && dEmail === uEmail) return true;
            if (uId && d.resident_id && Number(d.resident_id) === uId) return true;
            const dName = (d.resident_name || '').toLowerCase().trim();
            if (uName && dName && (dName === uName || dName.includes(uName) || uName.includes(dName))) return true;
            return false;
          });
        } else {
          myDocs = data;
        }
      }

      // Deduplicate to ensure no duplicate documents exist in state
      const uniqueDocsMap = new Map();
      for (const doc of myDocs) {
        const key = doc.id ? `id-${doc.id}` : (doc.request_code ? `code-${doc.request_code}` : JSON.stringify(doc));
        if (!uniqueDocsMap.has(key)) {
          uniqueDocsMap.set(key, doc);
        }
      }
      const finalDocs = Array.from(uniqueDocsMap.values());
      setDocuments(finalDocs);

      // Offline-first cache
      if (uEmail) {
        localStorage.setItem(`brgy_cached_docs_${uEmail}`, JSON.stringify(finalDocs));

        // Sync every document status permanently into notificationStore
        finalDocs.forEach(d => {
          let badgeColor: 'blue' | 'indigo' | 'emerald' | 'amber' | 'red' = 'indigo';
          let title = `Document Request: ${d.document_type}`;
          let message = `Tracking Code: ${d.request_code}. Current Status: ${d.status}.`;
          if (d.status === 'Ready for Pickup') {
            badgeColor = 'indigo';
            title = `🎉 Ready for Pick-Up: ${d.document_type}`;
            message = `Your document (${d.request_code}) is approved and signed. Claim at the Barangay Hall.`;
          } else if (d.status === 'Completed') {
            badgeColor = 'emerald';
            title = `Issued & Claimed: ${d.document_type}`;
            message = `Your request (${d.request_code}) was successfully issued and received.`;
          } else if (d.status === 'Processing') {
            badgeColor = 'amber';
            title = `In Preparation: ${d.document_type}`;
            message = `${d.request_code} is currently being prepared by the Barangay Office.`;
          } else if (d.status === 'Pending') {
            badgeColor = 'blue';
            title = `Queued: ${d.document_type}`;
            message = `${d.request_code} is in the verification queue.`;
          } else if (d.status === 'Rejected') {
            badgeColor = 'red';
            title = `Request Rejected: ${d.document_type}`;
            message = `Request for ${d.document_type} (${d.request_code}) was rejected. Reason: ${d.purpose || 'Incomplete details'}`;
          }

          notificationStore.addNotification(uEmail, {
            id: `doc-${d.id || d.request_code}`,
            type: 'document',
            title,
            message,
            ref_code: d.request_code,
            status_badge: d.status,
            badge_color: badgeColor,
            timestamp: (d as any).requested_at || (d as any).processed_at || new Date().toISOString()
          });
        });

        // Sync Account rejection if rejected
        if (loggedInUser?.verification_status === 'Rejected') {
          notificationStore.addNotification(uEmail, {
            id: 'acct-rejected',
            type: 'account',
            title: 'Account Registration Rejected',
            message: loggedInUser?.rejection_reason || 'Submitted Government ID photo is unclear or information does not match.',
            status_badge: 'Action Needed',
            badge_color: 'red',
            action_type: 'resubmit_id'
          });
        }

        setNotifications(notificationStore.getNotifications(uEmail));
      }
    } catch {
      const loggedInUser = currentUser || user;
      const uEmail = (loggedInUser?.email || '').toLowerCase().trim();
      if (uEmail) {
        try {
          const cached = localStorage.getItem(`brgy_cached_docs_${uEmail}`);
          if (cached) setDocuments(JSON.parse(cached));
          setNotifications(notificationStore.getNotifications(uEmail));
        } catch {}
      }
    }
  };

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
        barangay: userBarangay,
        resident_id: user?.id,
        service_type: selectedSchedule.service_type || selectedSchedule.title,
        preferred_date: bookingDate,
        preferred_time: selectedSchedule.time_slot || 'Morning (8:00 AM - 11:30 AM)',
        resident_notes: bookingNotes,
        status: 'Pending',
      } as any);
      setMyBookings(prev => [apt, ...prev]);
      toast.success(`Appointment booked for ${bookingDate}! The health center will confirm your slot.`);
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
      toast.error(err.message || 'Failed to book appointment. Please verify your account status.');
    } finally {
      setIsBookingLoading(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('barangay_user');
    let parsed: any = null;
    if (storedUser) {
      try {
        parsed = JSON.parse(storedUser);
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
      } catch {
        loadData();
      }
    } else {
      loadData();
    }

    // Helper to live-check and sync verification status, date_of_birth, and age from DB
    const syncVerificationStatus = async (currentParsed: any) => {
      if (!currentParsed?.email) return;
      try {
        const result = await apiService.checkVerificationStatus(currentParsed.email);
        const liveUser = (result as any)?.user || result;
        if (liveUser) {
          const stored = JSON.parse(localStorage.getItem('barangay_user') || '{}');
          const hasChanged = liveUser.verification_status && liveUser.verification_status !== stored.verification_status;
          const cleanDob = liveUser.date_of_birth ? (typeof liveUser.date_of_birth === 'string' ? liveUser.date_of_birth.split('T')[0] : liveUser.date_of_birth) : (stored.date_of_birth || '');
          const updated = {
            ...stored,
            ...liveUser,
            date_of_birth: cleanDob,
            age: liveUser.age !== undefined && liveUser.age !== null && liveUser.age !== '' ? liveUser.age : stored.age
          };
          setUser(updated);
          setIsVerified(updated.verification_status === 'Verified');
          saveStoredUser(updated);
          if (hasChanged && liveUser.verification_status === 'Verified') {
            toast.success('Account Verified!', {
              description: 'Your account was approved by Barangay Admin. You can now request documents.'
            });
          } else if (hasChanged && liveUser.verification_status === 'Rejected') {
            toast.error('Application Rejected', {
              description: 'Your registration was rejected. Please contact the Barangay Office.'
            });
          }
        }
      } catch { /* silent */ }
    };

    // Immediately sync on mount
    if (parsed) syncVerificationStatus(parsed);

    // Poll every 4 seconds for live DB changes (e.g. admin approves in phpMyAdmin or database)
    const pollInterval = setInterval(() => {
      const latest = JSON.parse(localStorage.getItem('barangay_user') || '{}');
      if (latest?.email) syncVerificationStatus(latest);
    }, 4000);

    // Also re-sync whenever the browser tab regains focus or window is activated
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const latest = JSON.parse(localStorage.getItem('barangay_user') || '{}');
        if (latest?.email) syncVerificationStatus(latest);
        loadData(latest);
      }
    };
    const handleFocus = () => {
      const latest = JSON.parse(localStorage.getItem('barangay_user') || '{}');
      if (latest?.email) syncVerificationStatus(latest);
      loadData(latest);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleRequestDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) {
      toast.info('Verification In Progress', {
        description: 'Your document request is being submitted and will be verified by Barangay Officials.',
      });
    }

    // --- Duplicate detection: check if resident already has a pending/processing request ---
    const duplicate = documents.find(
      d => d.document_type === docType && (d.status === 'Pending' || d.status === 'Processing')
    );
    if (duplicate) {
      const suggestion = DUPLICATE_SUGGESTIONS[docType] || 'Please visit the Barangay Hall for assistance.';
      toast.warning(`You already have a ${duplicate.status} request for this document.`, {
        description: `Request Code: ${duplicate.request_code} — ${suggestion}`,
        duration: 9000,
      });
      return;
    }

    const isNoPurposeDoc = docType === 'Certificate of Employment' || docType === 'Certificate of Land Occupancy';
    if (!isNoPurposeDoc && !purpose.trim()) {
      toast.error('Please state the purpose of your request');
      return;
    }

    // MANDATORY REQUIREMENT: Certificate of Purok President Photo
    if (!purokCertPhoto) {
      toast.error('Certificate of Purok President Required', {
        description: 'You are required to submit a clear photo of your Certificate / Endorsement from the Purok President before continuing.',
        duration: 6000,
      });
      return;
    }

    // Form specifics (demographic & purok cert are linked directly to resident census profile)
    const autoExtraFields: Record<string, string> = {
      ...extraFields,
    };
    try {
      const defaultDocPurpose = docType === 'Certificate of Land Occupancy'
        ? 'Official Land Actual Occupancy Certification'
        : (docType === 'Certificate of Employment' ? 'Official Employment Certification' : (purpose.trim() || 'Personal Requirement'));

      const created = await apiService.createDocument({
        resident_name: user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Resident',
        resident_id: user?.id,
        email: user?.email || '',
        document_type: docType,
        purpose: defaultDocPurpose,
        barangay: user?.barangay || userBarangay || 'Pianing',
        purok_certificate_photo: purokCertPhoto,
        extra_fields: JSON.stringify(autoExtraFields),
      });

      const nextDocs = [created, ...documents];
      setDocuments(nextDocs);
      setPurokCertPhoto(null);
      setPurokCertFileName('');
      if (user?.email) {
        localStorage.setItem(`brgy_cached_docs_${user.email.toLowerCase().trim()}`, JSON.stringify(nextDocs));
        dispatchResidentNotification({
          residentEmail: user.email,
          residentName: user?.name || 'Resident',
          type: 'document',
          title: `Queued: ${created.document_type}`,
          message: `Request ${created.request_code} has been submitted to the Barangay Office and is queued for verification.`,
          statusBadge: 'Pending',
          badgeColor: 'blue',
          refCode: created.request_code,
          barangay: user?.barangay || userBarangay || 'Pianing',
          sendEmail: false,
          sendSms: false
        }).then(() => {
          setNotifications(notificationStore.getNotifications(user.email));
        }).catch(() => {});
      }
      toast.success('Request submitted!', { description: `Request Code: ${created.request_code}` });
      handleDialogOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Submission failed. Please try again.');
    }
  };

  const statusColor = (s: string) =>
    s === 'Completed' ? 'bg-emerald-600' : s === 'Processing' ? 'bg-blue-500' : s === 'Rejected' ? 'bg-red-500' : 'bg-amber-500';

  return (
    <div className="min-h-dvh w-full max-w-[100vw] overflow-x-hidden bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      {/* Super Admin Unified Ecosystem Switcher */}
      <SuperAdminNavigationDock currentRole={user?.role} />

      {/* Navbar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-3 sm:px-6 py-2 sm:py-2.5 shadow-sm transition-colors">
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/resident')}
              className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl h-8 px-2.5 cursor-pointer shadow-xs"
              title="Back to Portals"
            >
              <ArrowLeft size={13} className="text-slate-600 dark:text-slate-300" />
              <span className="font-semibold">Back</span>
            </Button>
            <div className="w-9 h-9 rounded-full overflow-hidden bg-white shadow-xs border border-[#D5E2E8] flex items-center justify-center">
              <img src="/assets/pianing-logo.png" alt={`Barangay ${userBarangay}`} className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Barangay {userBarangay}</h1>
              <span className="text-xs text-[#006B66] dark:text-[#55EFC4] font-semibold">Resident Portal</span>
            </div>
          </div>

          {/* Quick Barangay Contact Pill in Navbar */}
          <div className="hidden lg:flex items-center gap-3 text-xs bg-[#E9F4F2] dark:bg-[#182C3F] border border-[#006B66]/20 px-3 py-1.5 rounded-xl">
            <a href={`tel:${getBarangayContact(userBarangay).replace(/[^0-9+]/g, '')}`} className="flex items-center gap-1.5 text-[#173B5E] dark:text-[#E9F4F2] hover:text-[#006B66] font-medium transition-colors cursor-pointer" title="Barangay Official Hotline">
              <Phone size={13} className="text-[#006B66] shrink-0" />
              <span className="font-mono font-bold text-[11px]">{getBarangayContact(userBarangay)}</span>
            </a>
            <span className="text-slate-300">|</span>
            <a href={`mailto:${getBarangayEmail(userBarangay)}`} className="flex items-center gap-1.5 text-[#173B5E] dark:text-[#E9F4F2] hover:text-[#006B66] font-medium transition-colors cursor-pointer" title="Official Barangay Gmail">
              <Mail size={13} className="text-[#006B66] shrink-0" />
              <span className="truncate max-w-[200px] text-[11px]">{getBarangayEmail(userBarangay)}</span>
            </a>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle variant="pill" />

            {/* Notification Center Trigger */}
            {user && (
              <Popover open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="relative flex items-center gap-1.5 text-xs border-[#D5E2E8] text-slate-700 hover:bg-[#E9F4F2] cursor-pointer"
                    title="View Document Status & Verification Notifications"
                  >
                    <Bell
                      size={14}
                      className={notifications.filter(n => !n.is_read).length > 0 ? 'text-[#006B66]' : 'text-slate-500'}
                    />
                    <span className="hidden sm:inline">Notifications</span>
                    {notifications.filter(n => !n.is_read).length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-[#B42318] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-xs animate-pulse">
                        {notifications.filter(n => !n.is_read).length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[90vw] sm:w-96 p-0 max-h-[80vh] overflow-hidden rounded-2xl shadow-xl bg-white dark:bg-[#132232] border border-[#D5E2E8] dark:border-[#223A50]">
                  <div className="p-4 border-b border-slate-100 dark:border-[#223A50] flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                        <Bell className="text-[#006B66]" size={16} />
                        Notifications &amp; Status
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Live updates for your document requests &amp; account.
                      </p>
                    </div>
                    <button
                      onClick={markAllNotifsRead}
                      className="text-[11px] text-[#006B66] hover:text-[#005753] font-semibold whitespace-nowrap hover:underline mt-0.5 cursor-pointer"
                      title="Mark all notifications as read"
                    >
                      ✓ Mark Read
                    </button>
                  </div>

                  <div className="p-3 space-y-2 text-xs max-h-[60vh] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <Bell size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-medium text-slate-500">No notifications yet</p>
                        <p className="text-[10px] text-slate-400 mt-1">Updates on document requests will appear here.</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const isRead = notif.is_read;
                        return (
                          <div
                            key={notif.id}
                            onClick={() => markNotifRead(notif.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 ${
                              isRead
                                ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800 opacity-75'
                                : 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`flex items-center gap-1.5 ${isRead ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-bold text-slate-900 dark:text-white'}`}>
                                {!isRead && <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full shrink-0" />}
                                {notif.status_badge === 'Completed' ? (
                                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                ) : notif.status_badge === 'Action Needed' || notif.status_badge === 'Rejected' ? (
                                  <XCircle size={14} className="text-red-600 shrink-0" />
                                ) : (
                                  <Clock size={14} className="text-indigo-600 shrink-0" />
                                )}
                                <span className="truncate max-w-[170px]">{notif.title}</span>
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {notif.status_badge && (
                                  <Badge className={`text-[9px] px-1.5 py-0.5 ${
                                    notif.badge_color === 'emerald' ? 'bg-emerald-600 text-white' :
                                    notif.badge_color === 'red' ? 'bg-red-600 text-white' :
                                    notif.badge_color === 'amber' ? 'bg-amber-600 text-white' :
                                    'bg-indigo-600 text-white'
                                  }`}>
                                    {notif.status_badge}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                              {notif.message}
                            </p>
                            {notif.ref_code && (
                              <p className="text-[10px] text-indigo-600 font-mono">
                                Ref Code: {notif.ref_code}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <Button size="sm" variant="ghost" onClick={markAllNotifsRead} className="text-[11px] h-7 px-2">
                      ✓ Mark all as read
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsNotificationsOpen(false)} className="text-[11px] h-7 px-2">
                      Close
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-1.5 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              >
                <Settings size={14} />
                <span className="hidden sm:inline">Profile Settings</span>
              </Button>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={() => { toast.info('Logged out'); navigate('/login'); }}
              className="flex items-center gap-1.5 text-xs bg-[#B42318] hover:bg-[#912015] h-8 px-2.5 sm:px-3 cursor-pointer"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-5 sm:space-y-6 pb-24 sm:pb-12">
        <SystemNoticeBanner />
        {/* Official Barangay Helpdesk & Contact Banner */}
        <div className="bg-gradient-to-r from-[#173B5E] via-[#0F2740] to-[#006B66] text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-[#006B66]/30 relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-[#006B66]/30 text-[#E9F4F2] border border-[#006B66]/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Barangay {userBarangay} Official Helpdesk
                </span>
                <span className="text-slate-300 text-[11px] flex items-center gap-1">
                  <Clock size={12} className="text-[#D8A443]" /> Mon - Fri: 8:00 AM - 5:00 PM
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Barangay {userBarangay} Official Assistance Desk
              </h2>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                For questions regarding document clearances, pickup verification, or community assistance:
              </p>
            </div>

            {/* Quick Contact Buttons */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto shrink-0">
              <a
                href={`tel:${getBarangayContact(userBarangay).replace(/[^0-9+]/g, '')}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Phone size={13} />
                <span>{getBarangayContact(userBarangay)}</span>
              </a>
              <a
                href={`mailto:${getBarangayEmail(userBarangay)}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-medium px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Mail size={13} />
                <span className="truncate max-w-[200px]">{getBarangayEmail(userBarangay)}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Verification Banner */}
        {!user || user.role !== 'resident' ? (
          <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">Visitor Mode</h3>
                <p className="text-xs text-slate-600 mt-1">Sign in to submit document requests and track their status.</p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate('/login')} className="bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs h-9 px-4 shrink-0">
              Sign In / Register
            </Button>
          </div>
        ) : user?.verification_status === 'Rejected' && !isRejectionBannerDismissed ? (
          /* Prominent Rejection Banner with Cause */
          <div className="relative bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-800 rounded-2xl p-4 sm:p-5 pr-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <button
              type="button"
              onClick={() => setIsRejectionBannerDismissed(true)}
              className="absolute top-3 right-3 text-red-400 hover:text-red-700 dark:hover:text-red-200 p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
              title="Dismiss Notice (will reappear on refresh)"
              aria-label="Dismiss Notice"
            >
              <X size={18} />
            </button>
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
                <XCircle size={22} />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-red-950 dark:text-red-200">ID Verification Notice — Correction Required</h3>
                  <Badge className="bg-red-600 text-white text-[10px]">Action Required</Badge>
                </div>
                <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-red-200 dark:border-red-800 text-xs">
                  <span className="font-bold text-red-900 dark:text-red-300 block mb-0.5">Barangay Admin Notice:</span>
                  <p className="text-red-800 dark:text-red-200 font-medium">
                    {user?.rejection_reason || 'Submitted Government ID photo is blurry or illegible. Please retake the photo in good lighting and ensure the ID details are clearly readable.'}
                  </p>
                </div>
              </div>
            </div>
            <Button size="sm" onClick={() => setIsResubmitModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-9 px-4 shrink-0 cursor-pointer gap-1.5 shadow-sm">
              <RefreshCw size={13} /> Resubmit Valid ID
            </Button>
          </div>
        ) : !isVerified ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-amber-900">Verification Pending</h3>
                  <Badge className="bg-amber-200 text-amber-900 text-[10px]">Pending</Badge>
                </div>
                <p className="text-xs text-amber-800 mt-1">Your Government ID is under review. Document requests are locked until approval.</p>
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
              <span className="font-bold">Account Verified — Requests Unlocked</span>
            </div>
            <Badge className="bg-emerald-600">Active</Badge>
          </div>
        )}

        {/* Portal Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={22} className="text-[#173B5E]" />
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Barangay Document Requests</h2>
            </div>
            <p className="text-xs text-slate-500">Request official barangay documents and track their processing status.</p>
          </div>

          <Dialog open={isAddDocOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button
                disabled={!isVerified}
                className={`text-xs gap-1.5 shadow-sm ${!isVerified ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-[#006B66] hover:bg-[#005753] text-white'}`}
              >
                {!isVerified ? <Lock size={14} /> : <PlusCircle size={15} />}
                Request Barangay Document
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-slate-900 max-w-lg w-full max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl p-4 sm:p-6 pb-[env(safe-area-inset-bottom)] sm:pb-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-600" />
                  {docType ? `Request: ${docType}` : 'Choose Document Type'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {docType
                    ? 'Fill in the required details below, then submit your request.'
                    : 'Select the document you need from the options below.'}
                </DialogDescription>
              </DialogHeader>

              {/* STEP 1: Document type picker — visible only when no type is selected yet */}
              {!docType && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-2">
                  {BARANGAY_DOCS.map((doc) => {
                    const existing = documents.find(
                      d => d.document_type === doc && (d.status === 'Pending' || d.status === 'Processing')
                    );
                    const isActive = isCategoryActive(doc);
                    return (
                      <button
                        key={doc}
                        type="button"
                        disabled={!isActive}
                        onClick={() => isActive && handleDocTypeChange(doc)}
                        className={`relative flex items-start gap-3 text-left p-3.5 rounded-xl border-2 transition-all group ${
                          isActive
                            ? 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer'
                            : 'border-slate-200 bg-slate-100/80 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'
                        }`}>
                          <FileText size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`font-semibold text-xs ${isActive ? 'text-slate-900 group-hover:text-indigo-700' : 'text-slate-500 line-through'}`}>{doc}</p>
                            {!isActive && (
                              <span className="bg-rose-100 text-rose-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-rose-200">
                                Suspended
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{DOC_DESCRIPTIONS[doc]}</p>
                          {existing && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              ⏳ {existing.status} · {existing.request_code}
                            </span>
                          )}
                        </div>
                        {isActive && (
                          <span className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs mt-0.5">→</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* STEP 2: Form — visible only after type is selected */}
              {docType && (
                <form onSubmit={handleRequestDocument} className="space-y-4 py-1">
                  {/* Back button */}
                  <button
                    type="button"
                    onClick={() => { setDocType(''); setExtraFields({}); setPurpose(''); }}
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 mb-1"
                  >
                    ← Change document type
                  </button>

                  {/* Auto-filled info — read only */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Your Information (Auto-filled from your account)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <p className="text-[10px] text-slate-400">Full Name</p>
                        <p className="text-xs font-semibold text-slate-800">{user?.name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Gender</p>
                        <p className="text-xs font-semibold text-slate-800">{user?.gender || 'Male'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Age</p>
                        <p className="text-xs font-semibold text-slate-800">{calculateAge(user?.date_of_birth || user?.birth_date || user?.birthdate, user?.age)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Purok</p>
                        <p className="text-xs font-semibold text-slate-800">{user?.purok || extractPurok(user?.address) || '—'}</p>
                      </div>
                      <div className="col-span-2 sm:col-span-4">
                        <p className="text-[10px] text-slate-400">Address</p>
                        <p className="text-xs font-semibold text-slate-800">{user?.address || `${user?.purok ? user.purok + ', ' : ''}Barangay ${userBarangay}, ${user?.city || 'Butuan City'}`}</p>
                      </div>
                    </div>
                  </div>

                  {/* Residency Duration Field for Certificate of Residency */}
                  {docType === 'Certificate of Residency' && (
                    <FloatingInput
                      label="Years of Residency / Living in Barangay"
                      value={extraFields['Duration of Residence'] ?? (user as any)?.years_of_residency ?? ''}
                      onChange={(e) => setField('Duration of Residence', e.target.value)}
                      placeholder="e.g. 5 years (or since 2019)"
                    />
                  )}

                  {/* Custom Fields for Business Clearance / Business Permit */}
                  {(docType === 'Business Clearance' || docType === 'Business Permit' || docType === 'Business Certificate') && (
                    <div className="space-y-2.5">
                      <FloatingInput
                        label="Store / Business Name"
                        value={extraFields['Business Name'] || ''}
                        onChange={(e) => setField('Business Name', e.target.value)}
                        placeholder="e.g. Maria's Sari-Sari Store"
                        required
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <FloatingInput
                          label="Nature of Business"
                          value={extraFields['Nature of Business'] || ''}
                          onChange={(e) => setField('Nature of Business', e.target.value)}
                          placeholder="e.g. Sari-Sari Store / Retail"
                        />
                        <FloatingInput
                          label="Business Location / Address"
                          value={extraFields['Business Address'] || ''}
                          onChange={(e) => setField('Business Address', e.target.value)}
                          placeholder={`e.g. Purok 3, Barangay ${userBarangay}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Custom Fields for Certificate of Employment */}
                  {docType === 'Certificate of Employment' && (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <FloatingInput
                          label="Job Position / Role"
                          value={extraFields['Job Position'] || ''}
                          onChange={(e) => setField('Job Position', e.target.value)}
                          placeholder="e.g. Store Clerk"
                          required
                        />
                        <FloatingInput
                          label="Employer / Establishment Name"
                          value={extraFields['Employer'] || ''}
                          onChange={(e) => setField('Employer', e.target.value)}
                          placeholder="e.g. Community General Merchandise"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <FloatingInput
                          label="Start Date (From)"
                          value={extraFields['Start Date'] || ''}
                          onChange={(e) => setField('Start Date', e.target.value)}
                          placeholder="e.g. January 2022"
                          required
                        />
                        <FloatingInput
                          label="End Date (To)"
                          value={extraFields['End Date'] || ''}
                          onChange={(e) => setField('End Date', e.target.value)}
                          placeholder="e.g. Present"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Custom Fields for Certificate of Land Occupancy / Actual Occupancy */}
                  {(docType === 'Certificate of Land Occupancy' || docType === 'Land Occupancy' || docType === 'Actual Occupancy') && (
                    <div className="space-y-2.5">
                      <FloatingInput
                        label="Parcel Land Area (in Words and Figures)"
                        value={extraFields['Land Area'] || ''}
                        onChange={(e) => setField('Land Area', e.target.value)}
                        placeholder="e.g. Nine Hundred Thirty-One (931)"
                        required
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <FloatingInput
                          label="Lot Number (Lot #)"
                          value={extraFields['Lot Number'] || ''}
                          onChange={(e) => setField('Lot Number', e.target.value)}
                          placeholder="e.g. 1005"
                          required
                        />
                        <FloatingInput
                          label="Survey / Cadastral Info"
                          value={extraFields['Survey Info'] || ''}
                          onChange={(e) => setField('Survey Info', e.target.value)}
                          placeholder="e.g. PLS-74"
                        />
                      </div>
                      <FloatingInput
                        label="Year Started (Occupancy Period)"
                        value={extraFields['Occupancy Since'] || ''}
                        onChange={(e) => setField('Occupancy Since', e.target.value)}
                        placeholder="e.g. 1970's (or 1995)"
                        required
                      />
                    </div>
                  )}

                  {/* Purpose — only for documents requiring a specific purpose */}
                  {docType !== 'Certificate of Employment' && docType !== 'Certificate of Land Occupancy' && docType !== 'Land Occupancy' && docType !== 'Actual Occupancy' && (
                    <FloatingTextarea
                      label={docType === 'Good Moral Clearance' ? 'Purpose / Application To Support' : 'Purpose of Request'}
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="State specific purpose (e.g. Employment, Loan, School requirements)"
                      required
                      rows={2}
                    />
                  )}

                  {/* ═══ MANDATORY REQUIREMENT: CERTIFICATE OF PUROK PRESIDENT ═══ */}
                  <div className="border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 via-slate-50 to-indigo-50/30 dark:from-indigo-950/30 dark:via-[#1A1D2D] dark:to-[#151824] rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <ShieldCheck size={18} />
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                            Certificate of Purok President <span className="text-red-500 font-bold">*</span>
                          </Label>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Required: Upload or snap a clear photo/scan of your Purok President's Endorsement
                          </p>
                        </div>
                      </div>
                      {purokCertPhoto ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold gap-1 px-2 py-0.5 shadow-2xs">
                          <CheckCircle2 size={11} /> Photo Attached
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-rose-600 border-rose-300 bg-rose-50 text-[10px] font-bold">
                          Required
                        </Badge>
                      )}
                    </div>

                    {purokCertPhoto ? (
                      <div className="border border-emerald-300 bg-white rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            onClick={() => setViewingPurokPhoto(purokCertPhoto)}
                            className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer relative group shrink-0 shadow-2xs"
                            title="Click to zoom full photo"
                          >
                            <img src={purokCertPhoto} alt="Purok President Certificate" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <Eye size={14} />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 flex items-center gap-1 truncate">
                              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                              <span className="truncate">{purokCertFileName || 'Purok_President_Certificate.jpg'}</span>
                            </p>
                            <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                              Ready for submission with this request
                            </p>
                            <button
                              type="button"
                              onClick={() => setViewingPurokPhoto(purokCertPhoto)}
                              className="text-[11px] text-indigo-600 hover:underline font-semibold flex items-center gap-1 mt-1 cursor-pointer"
                            >
                              <Maximize2 size={11} /> View / Zoom Full Photo
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => purokFileInputRef.current?.click()}
                            className="h-8 px-2.5 text-xs text-slate-700 hover:bg-slate-100 font-semibold rounded-lg"
                          >
                            <Camera size={13} className="mr-1 text-slate-500" /> Change
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPurokCertPhoto(null);
                              setPurokCertFileName('');
                              if (purokFileInputRef.current) purokFileInputRef.current.value = '';
                            }}
                            className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg"
                            title="Remove photo"
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => purokFileInputRef.current?.click()}
                        className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/50 rounded-xl p-4 text-center cursor-pointer transition-all shadow-2xs group"
                      >
                        <div className="w-10 h-10 rounded-full bg-indigo-100 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center mx-auto mb-2 transition-colors">
                          <Camera size={18} />
                        </div>
                        <p className="text-xs font-bold text-indigo-900 group-hover:text-indigo-700">
                          Click to upload or take a photo of your Certificate of Purok President
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Supports JPG, PNG, WebP up to 15MB. Ensure signature and seal are visible.
                        </p>
                      </div>
                    )}
                    <input
                      ref={purokFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePurokCertUpload}
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={purokCertUploading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white w-full h-11 rounded-xl font-bold shadow-md transition-all cursor-pointer"
                    >
                      {purokCertUploading ? 'Optimizing Photo...' : 'Submit Request'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Available Documents Info Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {BARANGAY_DOCS.map((doc) => {
            const isActive = isCategoryActive(doc);
            return (
              <div
                key={doc}
                onClick={() => isActive && handleOpenDocModal(doc)}
                className={`bg-white border rounded-xl p-3 text-center transition-all group shadow-xs ${
                  isActive
                    ? 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer hover:shadow-sm'
                    : 'border-slate-200 bg-slate-100/80 opacity-60 cursor-not-allowed'
                }`}
                title={isActive ? `Click to request ${doc}` : `${doc} is temporarily suspended by Super Admin`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2 transition-colors ${
                  isActive
                    ? 'bg-indigo-100 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white'
                    : 'bg-slate-200 text-slate-400'
                }`}>
                  <FileText size={16} />
                </div>
                <p className={`text-[10px] font-semibold leading-tight ${isActive ? 'text-slate-700 group-hover:text-indigo-700' : 'text-slate-500'}`}>{doc}</p>
                {!isActive && (
                  <span className="inline-block mt-1 bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-200">
                    Suspended
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Requests Table */}
        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="text-indigo-600" size={18} />
              My Barangay Document Requests
              <Badge variant="outline" className="ml-auto text-[10px]">{documents.length} Total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table View (>= 768px, hidden md:block) */}
            <div className="hidden md:block w-full overflow-x-auto">
              <Table className="w-full text-left border-collapse min-w-[700px]">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Request Code</TableHead>
                    <TableHead className="text-xs">Document Type</TableHead>
                    <TableHead className="text-xs">Purpose</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Date Submitted</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-xs py-10 text-slate-400">
                        <Building2 className="mx-auto mb-2 text-slate-300" size={28} />
                        No barangay document requests yet. Click <strong>"Request Barangay Document"</strong> above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc, idx) => (
                      <TableRow key={`doc-${doc.id}-${doc.document_type}-${idx}`} className="text-xs">
                        <TableCell className="font-mono font-semibold text-indigo-600">{doc.request_code}</TableCell>
                        <TableCell className="font-semibold text-slate-900">
                          <div>{doc.document_type}</div>
                          {doc.purok_certificate_photo ? (
                            <button
                              type="button"
                              onClick={() => setViewingPurokPhoto(doc.purok_certificate_photo || null)}
                              className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                              title="Click to view submitted Certificate of Purok President"
                            >
                              <FileCheck size={11} className="text-emerald-600" />
                              Purok Cert Attached
                              <Eye size={10} className="ml-0.5 text-emerald-600" />
                            </button>
                          ) : (
                            <span className="inline-block mt-1 text-[10px] text-slate-400">
                              Standard Request
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500">{doc.purpose || '—'}</TableCell>
                        <TableCell>
                          <Badge className={
                            doc.status === 'Completed' ? 'bg-emerald-600 text-white' :
                            doc.status === 'Ready for Pickup' ? 'bg-indigo-600 text-white' :
                            doc.status === 'Processing' ? 'bg-amber-500 text-white' :
                            doc.status === 'Rejected' ? 'bg-red-500 text-white' :
                            'bg-orange-500 text-white'
                          }>
                            {doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-slate-400 text-[11px]">{doc.requested_at || 'Today'}</TableCell>
                        <TableCell className="text-right">
                          {doc.status === 'Ready for Pickup' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md shadow-xs animate-pulse">
                              <CheckCircle2 size={12} className="text-indigo-600" /> Ready for Pickup at Hall
                            </span>
                          ) : doc.status === 'Completed' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                              <CheckCircle2 size={12} /> Claimed / Completed
                            </span>
                          ) : doc.status === 'Processing' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                              <Clock size={12} /> In Preparation
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                              <Clock size={12} /> Queued
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Touch-Friendly Card Stack (< 768px, md:hidden) */}
            <div className="flex flex-col gap-2.5 p-3.5 md:hidden">
              {documents.length === 0 ? (
                <div className="text-center text-xs py-8 text-slate-400">
                  <Building2 className="mx-auto mb-2 text-slate-300" size={28} />
                  No barangay document requests yet. Click <strong>"Request Barangay Document"</strong> above.
                </div>
              ) : (
                documents.map((doc, idx) => (
                  <div key={`mob-res-doc-${doc.id}-${doc.document_type}-${idx}`} className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col gap-2">
                    {/* Top Row: Request Code + Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-indigo-600">
                        {doc.request_code}
                      </span>
                      <Badge className={
                        doc.status === 'Completed' ? 'bg-emerald-600 text-white text-[10px]' :
                        doc.status === 'Ready for Pickup' ? 'bg-indigo-600 text-white text-[10px]' :
                        doc.status === 'Processing' ? 'bg-amber-500 text-white text-[10px]' :
                        doc.status === 'Rejected' ? 'bg-red-500 text-white text-[10px]' :
                        'bg-orange-500 text-white text-[10px]'
                      }>
                        {doc.status}
                      </Badge>
                    </div>

                    {/* Middle Row: Document Type and Purpose */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{doc.document_type}</h4>
                      {doc.purpose && <p className="text-[11px] text-slate-500 mt-0.5">{doc.purpose}</p>}
                    </div>

                    {/* Attachment indicator if present */}
                    {doc.purok_certificate_photo && (
                      <button
                        type="button"
                        onClick={() => setViewingPurokPhoto(doc.purok_certificate_photo || null)}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer w-fit"
                      >
                        <FileCheck size={11} className="text-emerald-600" />
                        Purok Cert Attached
                        <Eye size={10} className="ml-0.5 text-emerald-600" />
                      </button>
                    )}

                    {/* Bottom Row: Date & Lifecycle Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                      <span className="font-mono text-slate-400 text-[10px]">
                        {doc.requested_at || 'Today'}
                      </span>
                      {doc.status === 'Ready for Pickup' ? (
                        <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] animate-pulse">
                          Ready for Pickup at Hall
                        </span>
                      ) : doc.status === 'Completed' ? (
                        <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px]">
                          Claimed / Completed
                        </span>
                      ) : doc.status === 'Processing' ? (
                        <span className="font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[10px]">
                          In Preparation
                        </span>
                      ) : (
                        <span className="text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-[10px]">
                          Queued
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Health Clinic Schedules & Appointment Booking ─── */}
        {/* Referral banner to Health Center Portal */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Heart size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">Need Health Center Services?</h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Check clinic schedules, book appointments, and view your upcoming maternal &amp; immunization revisits.</p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/resident/health')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5 shrink-0 flex items-center gap-1.5"
          >
            Go to Health Center Portal <ArrowRight size={14} />
          </Button>
        </div>
      </main>

      <BarangayChatbot />

      

      <TermsAndPrivacyModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />

      {/* Resident Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onProfileUpdated={(updated) => setUser(updated)}
      />

      {/* Resident ID Resubmission / Correction Modal */}
      <ResubmitIdModal
        isOpen={isResubmitModalOpen}
        onClose={() => setIsResubmitModalOpen(false)}
        user={user}
        onResubmitted={(updated) => {
          setUser(updated);
          setIsVerified(false);
        }}
      />

      {/* Lightbox / Fullscreen Viewer for Certificate of Purok President */}
      <ImageViewerModal
        isOpen={!!viewingPurokPhoto}
        onClose={() => setViewingPurokPhoto(null)}
        imageUrl={viewingPurokPhoto}
        title="Certificate of Purok President"
        subtitle="Official Endorsement Submitted by Resident with Document Request"
        fileName="certificate-of-purok-president.jpg"
      />
    </div>
  );
}
