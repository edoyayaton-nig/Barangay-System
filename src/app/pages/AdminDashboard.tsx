import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart as RechartsBarChart,
  Bar as RechartsBar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import {
  FileText,
  Users,
  FolderOpen,
  BarChart,
  LogOut,
  Search,
  CheckCircle,
  CheckCircle2,
  Clock,
  Shield,
  Heart,
  UserPlus,
  PlusCircle,
  Trash2,
  Home,
  Menu,
  X,
  Filter,
  Check,
  RefreshCcw,
  Activity,
  AlertCircle,
  Printer,
  Download,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  RotateCcw,
  AlertTriangle,
  Tag,
  Archive,
  InboxIcon,
  Settings,
  Sliders,
  Database,
  UserCircle,
  MapPin,
  Phone,
  Mail,
  KeyRound,
  MessageSquare,
  Send,
  Bell,
  FileWarning,
  ShieldCheck,
  Edit3,
  Building2,
  Key,
  History,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Sparkles,
  ShieldAlert,
  User,
  ChevronDown,
  Camera,
  HardDrive,
  Layers,
  Server,
  Copy,
  ExternalLink,
  UserCog
} from 'lucide-react';
import { apiService, DocumentRequest, Resident, SystemUser, UserPermissions, hasUserPermission, PendingResident, ActivityLog, ClinicSchedule, HealthAppointment, PopulationStats, BarangayOverviewItem, HouseholdGroup, CensusAnalytics } from '../../services/api';
import { ID_TYPES } from '../../utils/idTypes';
import { validatePasswordComplexity } from '../../utils/passwordValidation';
import SystemMessenger from '../components/SystemMessenger';
import ResidentProfileModal from '../components/ResidentProfileModal';
import DocumentPrintModal from '../components/DocumentPrintModal';
import DocumentInfoModal from '../components/DocumentInfoModal';
import PendingApplicantReviewModal from '../components/PendingApplicantReviewModal';
import UserPermissionsModal from '../components/UserPermissionsModal';
import ImageViewerModal from '../components/ImageViewerModal';
import ProfileSettingsView from '../components/ProfileSettingsView';
import SystemNoticeBanner from '../components/SystemNoticeBanner';
import NotificationSettingsPanel from '../components/NotificationSettingsPanel';
import { exportToCsv, printOfficialReport, downloadOfficialPdf } from '../../utils/exportCsv';
import { BUTUAN_BARANGAYS, getBarangayContact, getBarangayEmail } from '../../utils/barangays';
import { PIANING_LOGO_BASE64, BUTUAN_LOGO_BASE64 } from '../components/officialLogos';
import {
  sendResidentApprovalEmail,
  sendResidentCorrectionEmail,
  sendDocumentReadyEmail,
  sendEmailNotification,
  dispatchResidentNotification,
  getEmailJsConfig,
  saveEmailJsConfig,
  EmailJsConfig
} from '../../services/emailJsService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

const getDynamicAge = (dobString?: string): number => {
  if (!dobString) return 0;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // User session state — initialized synchronously from localStorage to prevent session flash/reset on refresh
  const [user, setUser] = useState<any>(() => {
    try {
      const stored = localStorage.getItem('barangay_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isVisitorMode, setIsVisitorMode] = useState(false);

  // Barangay isolation & role helpers
  // IMPORTANT: user.barangay MUST always be set for all roles except super_mega_admin.
  // Never fall back to a hardcoded barangay — that would leak cross-barangay data.
  const userBarangay = user?.barangay || '';
  const currentAdminBarangay = (user?.barangay || '').toLowerCase().trim();
  const isSuperMegaAdmin = user?.role === 'super_mega_admin';
  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';


  const getGreetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatName = (str?: string) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Global Profile Update Listener
  useEffect(() => {
    const handleProfileSync = (e: any) => {
      if (e.detail) setUser(e.detail);
    };
    window.addEventListener('user-profile-updated', handleProfileSync);
    return () => window.removeEventListener('user-profile-updated', handleProfileSync);
  }, []);

  // Scroll main content area to top whenever the active sidebar tab changes
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeTab]);

  // Dynamic Data States
  const [documents, setDocuments] = useState<DocumentRequest[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [pendingResidents, setPendingResidents] = useState<any[]>([]);
  const [clinicSchedules, setClinicSchedules] = useState<ClinicSchedule[]>([]);
  const [appointments, setAppointments] = useState<HealthAppointment[]>([]);

  // Staff Schedule Creator Modal State
  const [isPostScheduleModalOpen, setIsPostScheduleModalOpen] = useState(false);
  const [newScheduleTitle, setNewScheduleTitle] = useState('');
  const [newScheduleServiceType, setNewScheduleServiceType] = useState('Pre-Marriage Counseling (PMC)');
  const [newScheduleDay, setNewScheduleDay] = useState('Every Wednesday');
  const [newScheduleTime, setNewScheduleTime] = useState('8:30 AM - 11:30 AM');
  const [newScheduleLocation, setNewScheduleLocation] = useState('Barangay Pianing Health Center');
  const [newScheduleSlots, setNewScheduleSlots] = useState('20');
  const [newScheduleBhw, setNewScheduleBhw] = useState('');
  const [stats, setStats] = useState({
    pendingDocs: 0,
    processedToday: 0,
    totalResidents: 0,
    activeRecords: 0
  });

  // Resident Profile Modal
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState<number | null>(null);

  const openResidentProfile = (id: number) => {
    setSelectedResidentId(id);
    setProfileModalOpen(true);
  };

  // Print Document Certificate Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedPrintDoc, setSelectedPrintDoc] = useState<DocumentRequest | null>(null);

  // Submitted ID Photo Preview Modal State
  const [selectedIdPreview, setSelectedIdPreview] = useState<string | null>(null);

  // Document Info / Details Modal State
  const [selectedInfoDoc, setSelectedInfoDoc] = useState<DocumentRequest | null>(null);
  const [isDocInfoOpen, setIsDocInfoOpen] = useState(false);

  // Pending Resident Applicant Review Modal State
  const [selectedApplicantForReview, setSelectedApplicantForReview] = useState<PendingResident | null>(null);
  const [isApplicantReviewOpen, setIsApplicantReviewOpen] = useState(false);
  const [isApprovingApplicant, setIsApprovingApplicant] = useState(false);

  const openDocInfo = (doc: DocumentRequest) => {
    setSelectedInfoDoc(doc);
    setIsDocInfoOpen(true);
  };

  const openPrintModal = (doc: DocumentRequest) => {
    setSelectedPrintDoc(doc);
    setPrintModalOpen(true);
  };

  const openApplicantReview = (applicant: PendingResident) => {
    setSelectedApplicantForReview(applicant);
    setIsApplicantReviewOpen(true);
  };

  // Search & Filter
  const [docSearch, setDocSearch] = useState('');
  const [docStatusFilter, setDocStatusFilter] = useState('all');
  const [docTypeFilter, setDocTypeFilter] = useState('all');
  const [residentSearch, setResidentSearch] = useState('');
  const [approvalSearch, setApprovalSearch] = useState('');
  const [residentStatusTab, setResidentStatusTab] = useState<'all' | 'verified' | 'unverified'>('all');
  const [residentPurokFilter, setResidentPurokFilter] = useState<string>('all');

  // Activity Logs & Audit Trail State
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logActionTypeFilter, setLogActionTypeFilter] = useState('All');
  const [logRoleFilter, setLogRoleFilter] = useState('All');

  // Barangay Settings sub-tab: 'archive' | 'notifications'
  const [settingsSubTab, setSettingsSubTab] = useState<'archive' | 'notifications'>('archive');

  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [isAddResidentOpen, setIsAddResidentOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  // Issue Document State
  const [selectedResidentForDoc, setSelectedResidentForDoc] = useState<string>('');
  const [newDocResidentId, setNewDocResidentId] = useState<number | null>(null);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState('');
  const [newDocGender, setNewDocGender] = useState<'Male' | 'Female' | ''>('');
  const [newDocCivilStatus, setNewDocCivilStatus] = useState('');
  const [newDocPurok, setNewDocPurok] = useState('');
  const [newDocAge, setNewDocAge] = useState('');
  const [newDocAddress, setNewDocAddress] = useState('');
  const [newDocPurpose, setNewDocPurpose] = useState('');
  const [newDocDuration, setNewDocDuration] = useState('');
  const [newDocExtraFields, setNewDocExtraFields] = useState<Record<string, string>>({});

  const [newResFirstName, setNewResFirstName] = useState('');
  const [newResMiddleName, setNewResMiddleName] = useState('');
  const [newResLastName, setNewResLastName] = useState('');
  const [newResBarangay, setNewResBarangay] = useState<string>(user?.barangay || 'Pianing');
  const [newResDOB, setNewResDOB] = useState('');
  const [newResPurok, setNewResPurok] = useState('');
  const [newResGender, setNewResGender] = useState<'Male' | 'Female' | ''>('');
  const [newResPhone, setNewResPhone] = useState('');
  const [newResCivilStatus, setNewResCivilStatus] = useState('');
  const [newResYearsOfResidency, setNewResYearsOfResidency] = useState('');
  const [newResIdType, setNewResIdType] = useState('');
  const [newResIdPhoto, setNewResIdPhoto] = useState<string | null>(null);
  const [newResIdFileName, setNewResIdFileName] = useState('');

  // Population Demographics & Census State
  const [populationStats, setPopulationStats] = useState<PopulationStats | null>(null);
  const [selectedCensusPurok, setSelectedCensusPurok] = useState<string>('all');
  const [censusStats, setCensusStats] = useState<CensusAnalytics | null>(null);
  const [censusHouseholds, setCensusHouseholds] = useState<HouseholdGroup[]>([]);
  const [censusViewMode, setCensusViewMode] = useState<'households' | 'table'>('households');
  const [expandedHouseholds, setExpandedHouseholds] = useState<Record<string, boolean>>({});

  // Add Resident / Household Modal Extension
  const [addResidentMode, setAddResidentMode] = useState<'new_household' | 'existing_household'>('new_household');
  const [newResHouseholdNum, setNewResHouseholdNum] = useState('');
  const [newResFamilyName, setNewResFamilyName] = useState('');
  const [newResIsHead, setNewResIsHead] = useState(true);
  const [newResRelationship, setNewResRelationship] = useState('Head');
  const [newResEmployment, setNewResEmployment] = useState('');

  // Dedicated Resident System User Account Creation Modal State
  const [isCreateResidentUserOpen, setIsCreateResidentUserOpen] = useState(false);
  const [resAccCensusSearch, setResAccCensusSearch] = useState('');
  const [resAccFirstName, setResAccFirstName] = useState('');
  const [resAccMiddleName, setResAccMiddleName] = useState('');
  const [resAccLastName, setResAccLastName] = useState('');
  const [resAccEmail, setResAccEmail] = useState('');
  const [resAccPassword, setResAccPassword] = useState('');
  const [resAccShowPassword, setResAccShowPassword] = useState(false);
  const [resAccConfirmPassword, setResAccConfirmPassword] = useState('');
  const [resAccShowConfirmPassword, setResAccShowConfirmPassword] = useState(false);
  const [resAccPhone, setResAccPhone] = useState('');
  const [resAccDOB, setResAccDOB] = useState('');
  const [resAccGender, setResAccGender] = useState<'Male' | 'Female' | ''>('');
  const [resAccCivilStatus, setResAccCivilStatus] = useState('');
  const [resAccEmployment, setResAccEmployment] = useState('');
  const [resAccResidencyYears, setResAccResidencyYears] = useState('');
  const [resAccPurok, setResAccPurok] = useState('');
  const [resAccCity, setResAccCity] = useState('Butuan City');
  const [resAccHouseholdNum, setResAccHouseholdNum] = useState('');
  const [resAccBarangay, setResAccBarangay] = useState<string>(user?.barangay || 'Pianing');
  const [resAccIdType, setResAccIdType] = useState('');
  const [resAccIdPhoto, setResAccIdPhoto] = useState<string | null>(null);
  const [resAccIdFileName, setResAccIdFileName] = useState('');
  const [resAccLinkedCensusId, setResAccLinkedCensusId] = useState<number | null>(null);
  const [resAccCensusMatch, setResAccCensusMatch] = useState<Resident | null>(null);
  const [isCreatingResAccount, setIsCreatingResAccount] = useState(false);
  const resAccFileInputRef = useRef<HTMLInputElement | null>(null);

  const getDynamicAge = (dobString: string): number | null => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  };

  const handleResAccFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type', { description: 'Please upload an image (PNG, JPG, JPEG).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large', { description: 'Max image size is 5MB.' });
      return;
    }

    setResAccIdFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setResAccIdPhoto(reader.result as string);
      toast.success('Valid ID attached', { description: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleClearResAccIdPhoto = () => {
    setResAccIdPhoto(null);
    setResAccIdFileName('');
    if (resAccFileInputRef.current) resAccFileInputRef.current.value = '';
  };

  // Searchable Household Selector State (Census Add Resident Modal)
  const [householdSearchQuery, setHouseholdSearchQuery] = useState('');
  const [isHouseholdDropdownOpen, setIsHouseholdDropdownOpen] = useState(false);

  // Super Admin 86-Barangay Command Hub State
  const [barangaysOverview, setBarangaysOverview] = useState<BarangayOverviewItem[]>([]);
  const [barangaySearch, setBarangaySearch] = useState('');
  const [barangayStatusFilter, setBarangayStatusFilter] = useState<'all' | 'active' | 'unstaffed'>('all');

  // Super Admin Diagnostics & Backup State
  const [dbStats, setDbStats] = useState<{ table: string; count: number; status: string }[]>([]);
  const [gatewayHealth, setGatewayHealth] = useState<any>(null);
  const [maintenanceMode, setMaintenanceMode] = useState<{ enabled: boolean; message: string }>({ enabled: false, message: '' });
  const [isBackingUp, setIsBackingUp] = useState(false);

  // New User Form State (First, Middle, Last Name)
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserMiddleName, setNewUserMiddleName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPass, setShowNewUserPass] = useState(false);
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState('');
  const [showNewUserConfirmPass, setShowNewUserConfirmPass] = useState(false);
  const [newUserRole, setNewUserRole] = useState<'superadmin' | 'admin' | 'staff' | 'bhw' | 'nurse' | 'resident'>('staff');
  const [newUserBarangay, setNewUserBarangay] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserEmployeeId, setNewUserEmployeeId] = useState('');
  const [newUserJobTitle, setNewUserJobTitle] = useState('');

  const generateSecureStaffPassword = () => {
    const charsUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const charsLower = 'abcdefghjkmnpqrstuvwxyz';
    const charsNums = '23456789';
    const charsSpecial = '!@#$%^&*';
    
    let pass = '';
    pass += charsUpper.charAt(Math.floor(Math.random() * charsUpper.length));
    pass += charsLower.charAt(Math.floor(Math.random() * charsLower.length));
    pass += charsNums.charAt(Math.floor(Math.random() * charsNums.length));
    pass += charsSpecial.charAt(Math.floor(Math.random() * charsSpecial.length));
    
    const all = charsUpper + charsLower + charsNums + charsSpecial;
    for (let i = 0; i < 6; i++) {
      pass += all.charAt(Math.floor(Math.random() * all.length));
    }
    setNewUserPassword(pass);
    setShowNewUserPass(true);
    navigator.clipboard?.writeText(pass);
    toast.success('Generated strong password & copied to clipboard!', {
      description: pass
    });
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  // User Directory tab & filter states
  const [userCategoryTab, setUserCategoryTab] = useState<'all' | 'officials' | 'residents' | 'archived'>('all');
  const [userBarangayFilter, setUserBarangayFilter] = useState('all');
  const [userSearchText, setUserSearchText] = useState('');

  // Edit User Modal State (Super Admin & Admin)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserCurrentPassword, setEditUserCurrentPassword] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserConfirmPassword, setEditUserConfirmPassword] = useState('');
  const [showEditUserCurrentPass, setShowEditUserCurrentPass] = useState(false);
  const [showEditUserPass, setShowEditUserPass] = useState(false);
  const [showEditUserConfirmPass, setShowEditUserConfirmPass] = useState(false);
  const [editUserRole, setEditUserRole] = useState<'superadmin' | 'admin' | 'staff' | 'bhw' | 'nurse' | 'resident'>('staff');
  const [editUserBarangay, setEditUserBarangay] = useState('Pianing');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserStatus, setEditUserStatus] = useState<'Active' | 'Inactive' | 'Archived'>('Active');

  // Cryptographically secure password generator
  const generateSecurePassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%&*';
    const all = upper + lower + digits + symbols;
    
    const getRandomChar = (charset: string) => {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return charset[array[0] % charset.length];
    };

    const pwd = [
      getRandomChar(upper),
      getRandomChar(upper),
      getRandomChar(lower),
      getRandomChar(lower),
      getRandomChar(digits),
      getRandomChar(digits),
      getRandomChar(symbols),
      getRandomChar(all),
      getRandomChar(all),
      getRandomChar(all),
    ];
    for (let i = pwd.length - 1; i > 0; i--) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      const j = array[0] % (i + 1);
      [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
    }
    return pwd.join('');
  };

  // Reset Password Modal State
  const [resetPassUser, setResetPassUser] = useState<SystemUser | null>(null);
  const [isResetPassOpen, setIsResetPassOpen] = useState(false);
  const [newPassVal, setNewPassVal] = useState('');
  const [newPassConfirmVal, setNewPassConfirmVal] = useState('');
  const [showNewPassConfirm, setShowNewPassConfirm] = useState(false);

  // Permanent Delete Confirm Dialog States in Archive
  const [deleteUserConfirmOpen, setDeleteUserConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [deleteResidentConfirmOpen, setDeleteResidentConfirmOpen] = useState(false);
  const [residentToDelete, setResidentToDelete] = useState<Resident | null>(null);
  const [isDeletingResident, setIsDeletingResident] = useState(false);

  const handlePermanentDeleteUser = (u: SystemUser) => {
    setUserToDelete(u);
    setDeleteUserConfirmOpen(true);
  };

  const executePermanentDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      await apiService.deleteUser(userToDelete.id);
      toast.success(`Account for ${userToDelete.name} has been permanently deleted.`);
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setDeleteUserConfirmOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to permanently delete user account.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handlePermanentDeleteResident = (res: Resident) => {
    setResidentToDelete(res);
    setDeleteResidentConfirmOpen(true);
  };

  const executePermanentDeleteResident = async () => {
    if (!residentToDelete) return;
    setIsDeletingResident(true);
    try {
      await apiService.purgeResident(residentToDelete.id);
      toast.success(`Resident record for ${residentToDelete.first_name} ${residentToDelete.last_name} has been permanently purged.`);
      setResidents(prev => prev.filter(r => r.id !== residentToDelete.id));
      setDeleteResidentConfirmOpen(false);
      setResidentToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to permanently purge resident record.');
    } finally {
      setIsDeletingResident(false);
    }
  };

  // Admin Profile Modal State
  const [isAdminProfileOpen, setIsAdminProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [showProfilePass, setShowProfilePass] = useState(false);

  // Staff Info Viewer Modal State (When admin clicks staff name)
  const [selectedStaffInfo, setSelectedStaffInfo] = useState<SystemUser | null>(null);
  const staffFileInputRef = useRef<HTMLInputElement>(null);

  // Main content scroll container ref — used to auto-scroll to top on tab change
  const mainContentRef = useRef<HTMLElement>(null);

  // SMS Correction Notice Modal State (Notify applicant regarding ID, Birthday, Name, or Address discrepancy)
  const [smsApplicantModal, setSmsApplicantModal] = useState<PendingResident | null>(null);
  const [smsNoticeReason, setSmsNoticeReason] = useState('Invalid / Blurry ID Photo');
  const [smsCustomMessage, setSmsCustomMessage] = useState('');
  const [smsMarkAsRejected, setSmsMarkAsRejected] = useState(true);
  const [smsSending, setSmsSending] = useState(false);

  // Email & EmailJS Integration State
  // Initializer reads barangay from localStorage so that config is loaded per-barangay, not globally
  const [emailJsSettings, setEmailJsSettings] = useState<EmailJsConfig>(() => {
    try {
      const stored = localStorage.getItem('barangay_user');
      const u = stored ? JSON.parse(stored) : null;
      const brgy = u?.barangay || '';
      return getEmailJsConfig(brgy || undefined);
    } catch {
      return getEmailJsConfig();
    }
  });
  const [emailJsTestTarget, setEmailJsTestTarget] = useState('');
  const [emailJsTestSending, setEmailJsTestSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ configured: boolean; mode: string; message: string; user: string | null } | null>(null);
  const [emailTestTarget, setEmailTestTarget] = useState('');
  const [emailTestLoading, setEmailTestLoading] = useState(false);
  const [overdueData, setOverdueData] = useState<{ overdueImmunizations: any[]; overdueMaternalVisits: any[] } | null>(null);
  const [overdueLoading, setOverdueLoading] = useState(false);
  const [announcementEmailTitle, setAnnouncementEmailTitle] = useState('');
  const [announcementEmailBody, setAnnouncementEmailBody] = useState('');
  const [announcementEmailLoading, setAnnouncementEmailLoading] = useState(false);

  const handleSaveEmailJsSettings = (e: React.FormEvent) => {
    e.preventDefault();
    // Scope the saved config to this specific barangay so it doesn't bleed into other barangays
    saveEmailJsConfig(emailJsSettings, userBarangay || undefined);
    toast.success('EmailJS settings saved successfully!');
  };

  const handleSendEmailJsTest = async () => {
    if (!emailJsTestTarget.includes('@')) {
      toast.error('Please enter a valid recipient email address.');
      return;
    }
    setEmailJsTestSending(true);
    try {
      const res = await sendEmailNotification({
        to_name: 'Resident Constituent',
        to_email: emailJsTestTarget.trim(),
        subject: '🧪 [Test] Barangay Pianing Smart System EmailJS Test',
        message: 'Mabuhay! This is an automated test message from the Barangay Pianing Smart Governance System powered by EmailJS (Service ID: service_6nk2ylj). If you received this email, automated resident notifications for approvals, clearance pick-up, and correction notices are active and working!',
        barangay: user?.barangay || 'Pianing',
        status: 'Operational'
      });
      if (res.success) {
        toast.success(`✅ Live test email sent to ${emailJsTestTarget}!`, {
          description: res.message
        });
      } else {
        toast.error(`Email delivery failed: ${res.message}`);
      }
    } catch (err: any) {
      toast.error(`Failed to send test email: ${err?.message || 'Error'}`);
    } finally {
      setEmailJsTestSending(false);
    }
  };

  const loadEmailStatus = async () => {
    try {
      const status = await apiService.getEmailStatus();
      setEmailStatus(status);
    } catch (err) {
      console.warn('Email status fetch failed');
    }
  };

  const loadOverdueData = async () => {
    setOverdueLoading(true);
    try {
      const data = await apiService.getOverdueRecords();
      setOverdueData(data);
    } catch (err) {
      console.warn('Overdue data fetch failed');
    } finally {
      setOverdueLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!emailTestTarget.includes('@')) { toast.error('Enter a valid email address.'); return; }
    setEmailTestLoading(true);
    try {
      const result = await apiService.sendTestEmail(emailTestTarget);
      if (result.success) {
        toast.success(result.simulated ? '✅ Test email logged (simulation mode – configure .env to send live emails)' : '✅ Test email sent successfully!');
      } else {
        toast.error(`Email failed: ${result.error}`);
      }
    } catch (err) {
      toast.error('Email test failed. Check server connection.');
    } finally {
      setEmailTestLoading(false);
    }
  };

  const handleSendAnnouncementEmail = async () => {
    if (!announcementEmailTitle.trim() || !announcementEmailBody.trim()) {
      toast.error('Title and body are required.'); return;
    }
    setAnnouncementEmailLoading(true);
    try {
      // Collect all resident emails from loaded residents list
      const recipients = residents
        .filter(r => r.email && r.email.includes('@'))
        .map(r => ({ email: r.email!, name: `${r.first_name} ${r.last_name}` }));

      if (recipients.length === 0) {
        toast.error('No residents with email addresses found.'); return;
      }

      const result = await apiService.sendAnnouncementEmail({
        recipients,
        title: announcementEmailTitle,
        body: announcementEmailBody,
        sender: user?.name || 'Barangay Administration',
      });
      toast.success(`📧 Announcement sent! ${result.sent}/${result.total} delivered.`);
      setAnnouncementEmailTitle('');
      setAnnouncementEmailBody('');
    } catch (err) {
      toast.error('Failed to send announcement email.');
    } finally {
      setAnnouncementEmailLoading(false);
    }
  };

  // Category Management (Super Admin only)
  const [categories, setCategories] = useState<any[]>([
    { id: 1, name: 'Barangay Clearance', department: 'Barangay', description: 'Employment, legal transactions, identity verification', status: 'Active' },
    { id: 2, name: 'Certificate of Residency', department: 'Barangay', description: 'Proof of resident living in the barangay', status: 'Active' },
    { id: 3, name: 'Certificate of Indigency', department: 'Barangay', description: 'Financial, educational, and medical assistance', status: 'Active' },
    { id: 4, name: 'Business Permit', department: 'Barangay', description: 'Commercial sari-sari store & local business operations', status: 'Active' },
    { id: 5, name: 'Barangay ID', department: 'Barangay', description: 'Official community resident identification card', status: 'Active' },
    { id: 6, name: 'Good Moral Clearance', department: 'Barangay', description: 'Official character clearance for PRC board exams & school', status: 'Active' },
    { id: 7, name: 'Business Clearance', department: 'Barangay', description: 'Barangay commercial permit for sari-sari stores & businesses', status: 'Active' },
    { id: 8, name: 'Business Retirement Certificate', department: 'Barangay', description: 'Official certification for closure or retirement of business', status: 'Active' },
    { id: 9, name: 'Certificate of Employment', department: 'Barangay', description: 'Barangay employment certificate & first time jobseeker aid', status: 'Active' },
    { id: 10, name: 'Certificate of Land Occupancy', department: 'Barangay', description: 'Proof of actual physical occupancy & lot possession', status: 'Active' },
    { id: 11, name: 'Barangay Activity Permit', department: 'Barangay', description: 'Permit for events, product sampling, promotions & gatherings', status: 'Active' }
  ]);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newCategoryDept, setNewCategoryDept] = useState('Barangay');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Category Manager Filtering & Search
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [categoryDeptFilter, setCategoryDeptFilter] = useState<string>('all');

  // Super Admin Granular Permissions Modal
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<SystemUser | null>(null);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);

  const handleOpenPermissions = (targetUser: SystemUser) => {
    setSelectedUserForPermissions(targetUser);
    setIsPermissionsModalOpen(true);
  };

  const handleSavePermissions = async (userId: number, permissions: UserPermissions) => {
    await apiService.updateUser(userId, { permissions });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions } : u));
    // If the updated user is currently logged in, sync session storage
    if (user && user.id === userId) {
      const updatedUser = { ...user, permissions };
      setUser(updatedUser);
      try {
        localStorage.setItem('barangay_user', JSON.stringify(updatedUser));
      } catch {}
    }
  };

  const handleToggleCategoryStatus = async (catName: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      await apiService.updateCategory(catName, newStatus);
      setCategories(prev => prev.map(c => c.name === catName ? { ...c, status: newStatus } : c));
      toast.success(`Category '${catName}' is now ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update category status');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }
    setIsCreatingCategory(true);
    try {
      const created = await apiService.createCategory({
        name: newCategoryName.trim(),
        department: newCategoryDept.trim() || 'Barangay',
        description: newCategoryDesc.trim() || undefined
      });
      setCategories(prev => [...prev, created]);
      toast.success(`Category '${newCategoryName.trim()}' created successfully`);
      setIsAddCategoryOpen(false);
      setNewCategoryName('');
      setNewCategoryDesc('');
      setNewCategoryDept('Barangay');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create category');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (cat: any) => {
    if (!window.confirm(`Are you sure you want to remove the category '${cat.name}'?`)) return;
    try {
      await apiService.deleteCategory(cat.name);
      setCategories(prev => prev.filter(c => c.name !== cat.name));
      toast.success(`Category '${cat.name}' removed successfully`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete category');
    }
  };

  // Load Data with option for silent background synchronization (no visual flashing)
  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // Data isolation: super_mega_admin sees all (undefined = no filter).
      // ALL other roles (superadmin, admin, staff, nurse, bhw) are STRICTLY scoped to their own barangay.
      const activeBarangayParam = isSuperMegaAdmin ? undefined : userBarangay || undefined;
      const [docsData, resData, usersData, statsData, pendingData, catData, logsData, schedData, aptsData, popData, cStats, hhData] = await Promise.all([
        apiService.getDocuments(activeBarangayParam),
        apiService.getResidents(activeBarangayParam, selectedCensusPurok),
        apiService.getUsers(),
        apiService.getAdminStats(activeBarangayParam),
        apiService.getPendingResidents(activeBarangayParam),
        apiService.getCategories().catch(() => []),
        apiService.getActivityLogs().catch(() => []),
        apiService.getClinicSchedules(activeBarangayParam).catch(() => []),
        apiService.getAppointments({ barangay: activeBarangayParam }).catch(() => []),
        apiService.getPopulationStats(activeBarangayParam).catch(() => null),
        apiService.getCensusStats(activeBarangayParam, selectedCensusPurok).catch(() => null),
        apiService.getHouseholds(activeBarangayParam, selectedCensusPurok).catch(() => [])
      ]);
      setDocuments(docsData);
      setResidents(resData);
      setUsers(usersData);
      setStats(statsData);
      setPendingResidents(pendingData || []);
      if (popData) setPopulationStats(popData);
      if (cStats) setCensusStats(cStats);
      if (hhData) setCensusHouseholds(hhData);
      if (schedData) setClinicSchedules(schedData);
      if (aptsData) setAppointments(aptsData);
      if (catData && catData.length > 0) {
        setCategories(catData.filter((c: any) => c.department !== 'Health Center'));
      }
      if (logsData) {
        setActivityLogs(logsData);
      }

      // Only the platform-level super_mega_admin can see all 86 barangays overview and system diagnostics
      if (isSuperMegaAdmin) {
        apiService.getBarangaysOverview().then(data => setBarangaysOverview(data || [])).catch(() => {});
        apiService.getDatabaseStats().then(data => setDbStats(data?.tables || [])).catch(() => {});
        apiService.getGatewaysHealth().then(data => setGatewayHealth(data || null)).catch(() => {});
        apiService.getMaintenanceMode().then(data => setMaintenanceMode(data || { enabled: false, message: '' })).catch(() => {});
      }
    } catch (err) {
      if (showLoading) {
        toast.error('Failed to load dashboard data');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduleTitle || !newScheduleDay || !newScheduleTime) {
      toast.error('Please fill in title, day of week, and time slot.');
      return;
    }

    try {
      const created = await apiService.createClinicSchedule({
        title: newScheduleTitle,
        service_type: newScheduleServiceType,
        day_of_week: newScheduleDay,
        time_slot: newScheduleTime,
        location: newScheduleLocation || 'Barangay Pianing Health Center',
        slots_available: Number(newScheduleSlots) || 20,
        bhw_in_charge: newScheduleBhw || user?.name || 'Assigned Staff',
        barangay: userBarangay || 'Pianing',
        created_by: user?.name || 'Staff'
      });

      setClinicSchedules(prev => [created, ...prev]);
      toast.success('Available Schedule Published!', {
        description: 'Residents can now choose this schedule when booking appointments.'
      });

      setIsPostScheduleModalOpen(false);
      setNewScheduleTitle('');
    } catch (err) {
      toast.error('Failed to publish schedule.');
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm('Are you sure you want to remove this available schedule?')) return;
    try {
      await apiService.deleteClinicSchedule(id);
      setClinicSchedules(prev => prev.filter(s => s.id !== id));
      toast.success('Schedule removed successfully.');
    } catch {
      toast.error('Failed to delete schedule.');
    }
  };

  const loadLogs = async (showToast = false) => {
    setLogsLoading(true);
    try {
      const data = await apiService.getActivityLogs({
        // Superadmin and Barangay staff: always scoped strictly to their own barangay
        barangay: userBarangay,
        action_type: logActionTypeFilter !== 'All' ? logActionTypeFilter : undefined,
        role: logRoleFilter !== 'All' ? logRoleFilter : undefined,
        search: logSearch || undefined
      });
      setActivityLogs(data);
      if (showToast) {
        toast.success('Activity logs refreshed');
      }
    } catch (err) {
      if (showToast) {
        toast.error('Failed to refresh activity logs');
      }
    } finally {
      setLogsLoading(false);
    }
  };

  const handlePrintAuditReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print reports.');
      return;
    }
    const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Filter displayed logs — strictly scoped to userBarangay
    const displayedLogs = activityLogs.filter(log => {
      if (userBarangay && log.barangay && !log.barangay.toLowerCase().includes(userBarangay.toLowerCase())) {
        return false;
      }
      if (logActionTypeFilter !== 'All' && (log.action_type || 'General') !== logActionTypeFilter) {
        return false;
      }
      if (logRoleFilter !== 'All' && log.user_role?.toLowerCase() !== logRoleFilter.toLowerCase()) {
        return false;
      }
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase();
        const match = log.user_name?.toLowerCase().includes(q) ||
          log.action?.toLowerCase().includes(q) ||
          log.details?.toLowerCase().includes(q) ||
          log.user_role?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    const rowsHtml = displayedLogs.map((l, i) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-size: 8.5pt;">${i + 1}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">
          <strong style="color: #0f172a;">${l.user_name}</strong><br/>
          <span style="font-size: 8pt; color: #64748b; text-transform: uppercase;">${l.user_role || 'STAFF'} &bull; ${l.barangay || 'Pianing'}</span>
        </td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">
          <strong style="color: #1e3a8a;">${l.action}</strong><br/>
          <span style="font-size: 8pt; color: #475569;">${l.details || 'Operational record'}</span>
        </td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">
          <span style="font-size: 7.5pt; font-weight: bold; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: #334155; text-transform: uppercase;">
            ${l.action_type || 'General'}
          </span>
        </td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 8.5pt; white-space: nowrap; color: #475569;">
          ${l.timestamp}
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>System Audit & Activity Logs Report - ${today}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 15px; line-height: 1.5; }
            .hdr-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px; }
            .hdr-logo-box { width: 75px; height: 75px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
            .hdr-logo { width: 100%; height: 100%; object-fit: contain; }
            .header-text { text-align: center; flex: 1; padding: 0 10px; }
            .header-text h4 { margin: 0; font-size: 10pt; text-transform: uppercase; font-weight: normal; color: #475569; letter-spacing: 0.5px; }
            .header-text h3 { margin: 2px 0; font-size: 10.5pt; font-weight: 600; color: #334155; }
            .header-text h2 { margin: 3px 0 1px 0; font-size: 12.5pt; font-weight: bold; color: #0f172a; text-transform: uppercase; }
            .header-text h1 { margin: 3px 0 0 0; font-size: 15pt; font-weight: 900; letter-spacing: 1px; color: #1e3a8a; text-transform: uppercase; }
            .header-text p { margin: 3px 0 0 0; font-size: 8.5pt; color: #64748b; font-style: italic; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-family: sans-serif; font-size: 8.5pt; }
            th { background: #0f172a; color: white; padding: 8px; border: 1px solid #0f172a; text-align: left; font-size: 8pt; text-transform: uppercase; }
            td { padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 8pt; color: #334155; }
            .footer { margin-top: 35px; display: flex; justify-content: space-between; align-items: flex-end; font-family: sans-serif; font-size: 8.5pt; }
            .seal-box { border: 2px double #1e3a8a; border-radius: 50%; width: 75px; height: 75px; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 6.5pt; font-weight: bold; color: #1e3a8a; text-transform: uppercase; margin: 0 auto; }
            .sig-block { text-align: center; width: 220px; }
            .sig-line { border-top: 1px solid #0f172a; margin-top: 35px; padding-top: 4px; font-weight: bold; text-transform: uppercase; font-size: 9.5pt; }
            .sig-title { font-size: 8.5pt; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="hdr-container">
            <div class="hdr-logo-box"><img src="${BUTUAN_LOGO_BASE64}" class="hdr-logo" alt="City of Butuan Seal" /></div>
            <div class="header-text">
              <h4>Republic of the Philippines</h4>
              <h3>Province of Agusan del Norte • City of Butuan</h3>
              <h2>BARANGAY PIANING</h2>
              <h1>OFFICIAL AUDIT TRAIL &amp; SYSTEM ACTIVITY LOGS</h1>
              <p>Barangay Pianing, Butuan City &bull; Generated: ${today} &bull; Total Filtered Records: ${displayedLogs.length}</p>
            </div>
            <div class="hdr-logo-box"><img src="${PIANING_LOGO_BASE64}" class="hdr-logo" alt="Barangay Pianing Seal" /></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">#</th>
                <th style="width: 180px;">Actor / System User</th>
                <th>Action &amp; Context Details</th>
                <th style="width: 110px; text-align: center;">Category</th>
                <th style="width: 140px;">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding: 25px; color: #64748b;">No activity logs recorded matching the specified criteria.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            <div class="sig-block">
              <div class="sig-title" style="margin-bottom: 35px; font-weight: bold; text-align: left;">GENERATED BY:</div>
              <div class="sig-line">${user?.name || 'Administrator'}</div>
              <div class="sig-title">${user?.role === 'superadmin' ? 'Super Administrator' : user?.role === 'admin' ? 'Barangay Administrator' : 'Barangay Staff'} &bull; Pianing</div>
            </div>
            <div class="seal-box">
              OFFICIAL SEAL<br/>BARANGAY PIANING<br/>BUTUAN CITY
            </div>
            <div class="sig-block">
              <div class="sig-title" style="margin-bottom: 35px; font-weight: bold; text-align: left;">CERTIFIED &amp; APPROVED:</div>
              <div class="sig-line">HON. VIRGENIA S. GOLANDRINA</div>
              <div class="sig-title">Punong Barangay</div>
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('barangay_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        if (parsed.role === 'resident') {
          toast.error('Access Denied', {
            description: 'Resident accounts cannot access the Barangay Admin Portal.'
          });
          navigate('/resident');
          return;
        } else if (parsed.role !== 'admin' && parsed.role !== 'superadmin' && parsed.role !== 'staff') {
          toast.error('Access Denied', {
            description: 'You do not have administrative permission to view this portal.'
          });
          navigate('/login');
          return;
        }
      } catch (e) {}
    } else {
      toast.error('Authentication Required', {
        description: 'Please sign in with your administrative account.'
      });
      navigate('/login');
      return;
    }
    // Initial load with visible loading bar
    loadData(true);

    // Silent background synchronization every 30 seconds (no progress bar flicker or button lock)
    const autoSyncTimer = setInterval(() => {
      loadData(false);
    }, 30000);

    // Instant real-time synchronization with Nurse, BHW, and Resident actions
    let syncChannel: BroadcastChannel | null = null;
    try {
      syncChannel = new BroadcastChannel('barangay_health_sync');
      syncChannel.onmessage = (event) => {
        if (event.data?.type === 'HEALTH_DATA_SYNC') {
          loadData(false);
        }
      };
    } catch {}

    // Debounced window focus sync (silent, max once every 10s)
    let lastFocusSync = 0;
    const handleTabVisibility = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && now - lastFocusSync > 10000) {
        lastFocusSync = now;
        loadData(false);
      }
    };
    window.addEventListener('focus', handleTabVisibility);
    document.addEventListener('visibilitychange', handleTabVisibility);

    return () => {
      clearInterval(autoSyncTimer);
      window.removeEventListener('focus', handleTabVisibility);
      document.removeEventListener('visibilitychange', handleTabVisibility);
      if (syncChannel) {
        syncChannel.close();
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'records') {
      const activeBarangayParam = isSuperMegaAdmin ? undefined : (userBarangay || undefined);
      apiService.getCensusStats(activeBarangayParam, selectedCensusPurok).then(data => {
        if (data) setCensusStats(data);
      }).catch(() => {});
      apiService.getHouseholds(activeBarangayParam, selectedCensusPurok).then(data => {
        if (data) setCensusHouseholds(data);
      }).catch(() => {});
      apiService.getResidents(activeBarangayParam, selectedCensusPurok).then(data => {
        if (data) setResidents(data);
      }).catch(() => {});
    }
  }, [selectedCensusPurok, activeTab, isSuperMegaAdmin, userBarangay]);

  useEffect(() => {
    if (activeTab === 'logs' || (activeTab === 'overview' && isSuperAdmin)) {
      loadLogs();
    }
  }, [activeTab, isSuperAdmin]);

  const setNewDocField = (key: string, val: string) => {
    setNewDocExtraFields(prev => ({ ...prev, [key]: val }));
  };

  const handleSelectResidentForDoc = (val: string) => {
    setSelectedResidentForDoc(val);
    if (val === 'manual' || !val) {
      setNewDocResidentId(null);
      setNewDocName('');
      setNewDocGender('');
      setNewDocCivilStatus('');
      setNewDocPurok('');
      setNewDocAge('');
      setNewDocAddress('');
      return;
    }
    const r = residents.find(res => String(res.id) === val);
    if (r) {
      setNewDocResidentId(r.id);
      setNewDocName(`${r.first_name} ${r.last_name}`.trim());
      setNewDocGender((r.gender === 'Female' ? 'Female' : r.gender === 'Male' ? 'Male' : '') as any);
      setNewDocCivilStatus(r.civil_status || '');
      setNewDocPurok(r.purok ? (r.purok.startsWith('Purok') ? r.purok : `Purok ${r.purok}`) : '');
      setNewDocAge(r.age ? String(r.age) : '');
      setNewDocAddress(r.address || `Purok ${r.purok || ''}, Barangay ${r.barangay || 'Pianing'}, Butuan City`);
    }
  };

  const handleNewDocTypeChange = (type: string) => {
    setNewDocType(type);
    if (type === 'Certificate of Land Occupancy' || type === 'Land Occupancy' || type === 'Actual Occupancy') {
      setNewDocExtraFields(prev => ({
        ...prev,
        'Land Area': prev['Land Area'] || 'Nine Hundred Thirty-One (931)',
        'Lot Number': prev['Lot Number'] || '1005',
        'Survey Info': prev['Survey Info'] || 'PLS-74',
        'Occupancy Since': prev['Occupancy Since'] || "1970's"
      }));
      setNewDocPurpose('whatever legal purposes it may serve best');
    } else if (type === 'Certificate of Employment') {
      setNewDocExtraFields(prev => ({
        ...prev,
        'Job Position': prev['Job Position'] || 'Barangay Worker',
        'Employer': prev['Employer'] || 'Barangay Pianing',
        'Start Date': prev['Start Date'] || 'January 2024',
        'End Date': prev['End Date'] || 'Present'
      }));
      setNewDocPurpose('statutory and official verification requirements');
    } else if (type === 'Business Clearance' || type === 'Business Permit') {
      setNewDocExtraFields(prev => ({
        ...prev,
        'Business Name': prev['Business Name'] || '',
        'Nature of Business': prev['Nature of Business'] || 'General Merchandise / Retail'
      }));
      setNewDocPurpose('Business Permit application');
    } else if (type === 'Certificate of Residency') {
      setNewDocExtraFields(prev => ({
        ...prev,
        'Duration of Residence': prev['Duration of Residence'] || '5 years'
      }));
      setNewDocPurpose('whatever legal purpose it may serve best');
    } else if (type === 'Good Moral Clearance') {
      setNewDocPurpose('employment application');
    }
  };

  const handleSaveAndPrintDoc = async (markAsCompleted = false) => {
    if (!newDocType) {
      toast.error('Please select a document type');
      return;
    }
    if (!newDocName.trim()) {
      toast.error('Resident name is required');
      return;
    }

    let finalPurpose = newDocPurpose;
    if (newDocType === 'Certificate of Land Occupancy' || newDocType === 'Actual Occupancy') {
      finalPurpose = 'whatever legal purposes it may serve best';
    } else if (newDocType === 'Certificate of Employment') {
      finalPurpose = 'statutory and official verification requirements';
    }

    const payloadExtra: Record<string, string> = {
      ...newDocExtraFields,
      'Gender': newDocGender,
      'Civil Status': newDocCivilStatus,
      'Purok / Location': newDocPurok,
      'Home Address': newDocAddress || `Purok ${newDocPurok}, Barangay Pianing, Butuan City`,
      'Age': newDocAge
    };

    try {
      const created = await apiService.createDocument({
        resident_id: newDocResidentId || undefined,
        resident_name: newDocName.trim(),
        document_type: newDocType,
        purpose: finalPurpose || 'Official Barangay Document',
        extra_fields: payloadExtra,
        status: markAsCompleted ? 'Completed' : 'Pending',
        processed_by: markAsCompleted ? (user?.name || 'Barangay Administrator') : undefined
      });

      const augmentedDoc = {
        ...created,
        resident_address: newDocAddress || `Purok ${newDocPurok}, Barangay Pianing, Butuan City`,
        resident_civil_status: newDocCivilStatus,
        resident_gender: newDocGender,
        resident_age: newDocAge,
        extra_fields: JSON.stringify(payloadExtra),
        status: markAsCompleted ? 'Completed' : 'Pending',
        processed_by: markAsCompleted ? (user?.name || 'Barangay Administrator') : undefined,
        processed_at: markAsCompleted ? new Date().toLocaleTimeString() : undefined
      };

      setDocuments([augmentedDoc as any, ...documents]);
      setIsAddDocOpen(false);

      if (markAsCompleted) {
        setStats(prev => ({ ...prev, processedToday: prev.processedToday + 1, activeRecords: prev.activeRecords + 1 }));
        toast.success(`Document Issued & Archived!`, {
          description: `Request Code: ${created.request_code} has been marked Completed and saved to Archive.`
        });
        openPrintModal(augmentedDoc as any);
      } else {
        setStats(prev => ({ ...prev, pendingDocs: prev.pendingDocs + 1, activeRecords: prev.activeRecords + 1 }));
        toast.success('Document request added to active queue', {
          description: `Request Code: ${created.request_code}`
        });
      }

      // Reset form
      setSelectedResidentForDoc('');
      setNewDocResidentId(null);
      setNewDocName('');
      setNewDocType('');
      setNewDocGender('');
      setNewDocCivilStatus('');
      setNewDocPurok('');
      setNewDocAge('');
      setNewDocAddress('');
      setNewDocPurpose('');
      setNewDocDuration('');
      setNewDocExtraFields({});
    } catch (err) {
      toast.error('Could not issue document request');
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSaveAndPrintDoc(false);
  };

  const handleUpdateDocStatus = async (id: number, currentStatus: string) => {
    // Status flow: Pending → Processing → Ready for Pickup → Completed
    let nextStatus: string;
    if (currentStatus === 'Pending') nextStatus = 'Processing';
    else if (currentStatus === 'Processing') nextStatus = 'Ready for Pickup';
    else if (currentStatus === 'Ready for Pickup') nextStatus = 'Completed';
    else return; // Already completed, no action

    const targetDoc = documents.find(d => d.id === id);
    const resName = targetDoc?.resident_name || 'Resident';

    try {
      await apiService.updateDocumentStatus(id, nextStatus, user?.name || 'Admin Juan');
      setDocuments(documents.map(d => d.id === id ? { ...d, status: nextStatus as any, processed_at: new Date().toLocaleTimeString(), processed_by: user?.name || 'Admin Juan' } : d));
      loadData(false);
      
      if (nextStatus === 'Completed') {
        toast.success(`Document Completed & Archived`, {
          description: `Archived for ${resName}`
        });
      } else if (nextStatus === 'Ready for Pickup') {
        toast.success(`Document Ready for Pickup`, {
          description: `Signed & prepared for ${resName}`
        });
      } else {
        toast.info(`Document in Processing`, {
          description: `Preparing clearance for ${resName}`
        });
      }

      // Automated In-App & EmailJS Notification to Resident's Gmail on Document Status Change
      const residentMatch = residents.find(r => r.id === targetDoc?.resident_id || `${r.first_name} ${r.last_name}`.toLowerCase().trim() === (resName || '').toLowerCase().trim());
      const resEmail = (targetDoc as any)?.resident_email || (targetDoc as any)?.email || residentMatch?.email;

      if (resEmail && targetDoc) {
        let notifTitle = `📄 Document Status: ${targetDoc.document_type}`;
        let badgeColor: 'blue' | 'indigo' | 'emerald' | 'amber' | 'red' = 'indigo';
        let statusMsg = `Your ${targetDoc.document_type} (Tracking Code: ${targetDoc.request_code}) is now in status: ${nextStatus}.`;

        if (nextStatus === 'Ready for Pickup') {
          notifTitle = `🎉 Ready for Pick-Up: ${targetDoc.document_type}`;
          badgeColor = 'indigo';
          statusMsg = `Your requested ${targetDoc.document_type} (${targetDoc.request_code}) is now PRINTED, SIGNED, and READY FOR PICKUP at the Barangay Hall. Please bring a valid ID and processing fee when claiming.`;
        } else if (nextStatus === 'Completed') {
          notifTitle = `✅ Document Claimed: ${targetDoc.document_type}`;
          badgeColor = 'emerald';
          statusMsg = `Your ${targetDoc.document_type} (${targetDoc.request_code}) has been officially claimed and marked as COMPLETED. Thank you!`;
        } else if (nextStatus === 'Processing') {
          notifTitle = `⏳ Processing: ${targetDoc.document_type}`;
          badgeColor = 'amber';
          statusMsg = `Your ${targetDoc.document_type} (${targetDoc.request_code}) is currently being prepared and processed by the Barangay Office.`;
        }

        dispatchResidentNotification({
          residentEmail: resEmail,
          residentName: resName,
          type: 'document',
          title: notifTitle,
          message: statusMsg,
          statusBadge: nextStatus,
          badgeColor,
          refCode: targetDoc.request_code,
          barangay: targetDoc.barangay || user?.barangay || 'Pianing'
        }).then(res => {
          if (res.email) {
            toast.info(`📧 Status update emailed to ${resEmail}`);
          }
        }).catch(() => {});
      }

      loadData();
    } catch (err) {
      toast.error('Failed to update document status');
    }
  };

  const handleArchiveDoc = async (id: number) => {
    try {
      await apiService.deleteDocument(id);
      setDocuments(documents.filter(d => d.id !== id));
      toast.success('Document request archived');
    } catch (err) {
      toast.error('Archive failed');
    }
  };

  const handleApproveResident = async (id: number) => {
    try {
      const applicant = pendingResidents.find(r => r.id === id);
      await apiService.approveResident(id, user?.name || 'Admin Juan');
      toast.success('Resident application approved! Account is now Verified.');

      // Automated In-App & EmailJS Notification to Resident's Gmail on Verification
      if (applicant && applicant.email) {
        const applicantName = applicant.name || `${applicant.first_name || ''} ${applicant.last_name || ''}`.trim() || 'Resident';
        dispatchResidentNotification({
          residentEmail: applicant.email,
          residentName: applicantName,
          type: 'account',
          title: '🎉 Account Verified & Approved',
          message: `Mabuhay ${applicantName}! Your Barangay ${applicant.barangay || user?.barangay || 'Pianing'} resident account has been officially approved and verified by the Barangay Administration. You can now log in to the portal to request clearances, certificates, and access healthcare appointments.`,
          statusBadge: 'Verified',
          badgeColor: 'emerald',
          barangay: applicant.barangay || user?.barangay || 'Pianing'
        }).then(res => {
          if (res.email) {
            toast.info(`📧 Verification email dispatched to ${applicant.email}`);
          }
        }).catch(() => {});
      }

      loadData();
    } catch (err) {
      toast.error('Failed to approve resident');
    }
  };

  const handleOpenRejectModal = (applicant: PendingResident) => {
    setSmsApplicantModal(applicant);
    const applicantName = applicant.name || `${applicant.first_name || ''} ${applicant.last_name || ''}`.trim() || 'Resident';
    setSmsNoticeReason('Invalid / Blurry ID Photo');
    setSmsCustomMessage(`Submitted Government ID photo is blurry or illegible. Please re-upload a clear photo of your valid ID.`);
    setSmsMarkAsRejected(true);
  };

  const handleNoticeReasonChange = (reason: string, applicant: PendingResident) => {
    setSmsNoticeReason(reason);
    switch (reason) {
      case 'Invalid / Blurry ID Photo':
        setSmsCustomMessage(`Submitted Government ID photo is blurry or illegible. Please re-upload a clear photo of your valid ID.`);
        break;
      case 'Name Mismatch':
        setSmsCustomMessage(`The registered name does not match the name on your submitted Government ID. Please check and correct your details.`);
        break;
      case 'Birthday Discrepancy':
        setSmsCustomMessage(`The Date of Birth provided does not match your official Government ID document. Please verify and register with your exact birthday.`);
        break;
      case 'Address Discrepancy':
        setSmsCustomMessage(`Your Purok/Barangay address could not be verified in the resident registry. Please bring proof of residency.`);
        break;
      case 'Custom Reason':
      default:
        setSmsCustomMessage(`Application requires revision: `);
        break;
    }
  };

  const handleSendSmsNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsApplicantModal) return;
    const applicant = smsApplicantModal;
    const phone = applicant.phone || '09170000000';
    const applicantName = applicant.name || `${applicant.first_name || ''} ${applicant.last_name || ''}`.trim() || 'Resident';
    const cause = smsCustomMessage.trim() || smsNoticeReason;

    setSmsSending(true);
    try {
      // 1. Mark resident as rejected with specific cause saved in database
      await apiService.rejectResident(applicant.id, cause);

      // 2. Dispatch automated in-app notification & EmailJS to resident's Gmail
      if (applicant.email) {
        dispatchResidentNotification({
          residentEmail: applicant.email,
          residentName: applicantName,
          type: 'account',
          title: '⚠️ Notice: ID Verification / Correction Required',
          message: `Hello ${applicantName}, your account application for Barangay ${applicant.barangay || user?.barangay || 'Pianing'} requires revision. Discrepancy details: "${cause}". Please log in to your portal to re-upload a clear photo of your valid Government ID.`,
          statusBadge: 'Action Needed',
          badgeColor: 'red',
          barangay: applicant.barangay || user?.barangay || 'Pianing'
        }).then(res => {
          if (res.email) {
            toast.info(`📧 Correction notice emailed to ${applicant.email}`);
          }
        }).catch(() => {});
      }

      // 3. If SMS checkbox was selected by admin
      if (smsMarkAsRejected && phone && phone !== '09170000000') {
        try {
          await apiService.sendNotification({
            recipient_name: applicantName,
            recipient_phone: phone,
            type: 'Barangay Announcement',
            message: `Barangay Notice: Hello ${applicantName}, your account application was rejected. Cause: ${cause}. Please update your profile or re-upload your ID.`
          });
        } catch {}
      }

      toast.warning(`Application rejected: ${applicantName} notified`, {
        description: `Rejection cause has been sent to the resident's portal notification center and email.`
      });
      setSmsApplicantModal(null);
      loadData();
    } catch {
      toast.error('Failed to reject application');
    } finally {
      setSmsSending(false);
    }
  };

  const handleRejectResident = (id: number) => {
    const applicant = pendingResidents.find(r => r.id === id);
    if (applicant) {
      handleOpenRejectModal(applicant);
    } else {
      apiService.rejectResident(id).then(() => {
        toast.warning('Resident application marked for correction.');
        loadData();
      });
    }
  };

  const handleRejectWithDirectReason = async (id: number, reason: string) => {
    try {
      const applicant = pendingResidents.find(r => r.id === id);
      await apiService.rejectResident(id, reason);
      toast.warning('Correction / Resubmission notice dispatched to resident.', {
        description: `Reason: ${reason}`
      });

      // Automated In-App & EmailJS Notification to Resident's Gmail
      if (applicant && applicant.email) {
        const applicantName = applicant.name || `${applicant.first_name || ''} ${applicant.last_name || ''}`.trim() || 'Resident';
        dispatchResidentNotification({
          residentEmail: applicant.email,
          residentName: applicantName,
          type: 'account',
          title: '⚠️ Notice: ID Verification / Correction Required',
          message: `Hello ${applicantName}, your account application for Barangay ${applicant.barangay || user?.barangay || 'Pianing'} requires revision. Reason: "${reason}". Please log in to your portal to re-upload a clear copy of your valid Government ID.`,
          statusBadge: 'Action Needed',
          badgeColor: 'red',
          barangay: applicant.barangay || user?.barangay || 'Pianing'
        }).then(res => {
          if (res.email) {
            toast.info(`📧 Correction instructions emailed to ${applicant.email}`);
          }
        }).catch(() => {});
      }

      loadData();
    } catch {
      toast.error('Failed to dispatch resubmission notice');
    }
  };

  const handleToggleResidentVerification = async (res: Resident) => {
    const isCurrentlyVerified = res.verification_status === 'Verified';
    const nextStatus = isCurrentlyVerified ? 'Unverified' : 'Verified';
    try {
      if (isCurrentlyVerified) {
        await apiService.unverifyResident(res.id, 'Unverified');
        toast.warning(`${res.first_name} ${res.last_name} is now UNVERIFIED. (Account remains intact in database)`);
      } else {
        await apiService.approveResident(res.id, user?.name);
        toast.success(`${res.first_name} ${res.last_name} has been VERIFIED.`);

        // Dispatch Email notification on verification toggle
        if (res.email) {
          const resName = `${res.first_name || ''} ${res.last_name || ''}`.trim() || 'Resident';
          dispatchResidentNotification({
            residentEmail: res.email,
            residentName: resName,
            type: 'account',
            title: '🎉 Account Verified & Approved',
            message: `Mabuhay ${resName}! Your Barangay ${res.barangay || user?.barangay || 'Antongalon'} resident account has been officially approved and verified by the Barangay Administration. You can now log in to the portal to request clearances, certificates, and access healthcare appointments.`,
            statusBadge: 'Verified',
            badgeColor: 'emerald',
            barangay: res.barangay || user?.barangay || 'Antongalon'
          }).then(notifyRes => {
            if (notifyRes.email) {
              toast.info(`📧 Verification email dispatched to ${res.email}`);
            }
          }).catch(() => {});
        }
      }
      loadData();
    } catch {
      toast.error('Failed to update verification status.');
    }
  };

  const handlePurgeResident = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this account registration? This action cannot be undone.')) return;
    try {
      await apiService.purgeResident(id);
      toast.success('Registration record purged successfully.');
      loadData();
    } catch {
      toast.error('Failed to delete registration record.');
    }
  };

  const handleCreateResident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResFirstName.trim() || !newResLastName.trim()) {
      toast.error('First Name and Last Name are required');
      return;
    }
    if (!newResDOB) {
      toast.error('Date of Birth is required');
      return;
    }
    if (!newResPhone.trim()) {
      toast.error('Contact Number is required');
      return;
    }
    const rawPhone = newResPhone.trim().replace(/\D/g, '');
    let cleanPhone = rawPhone;
    if (cleanPhone.startsWith('639')) {
      cleanPhone = '0' + cleanPhone.slice(2);
    } else if (cleanPhone.startsWith('9') && cleanPhone.length === 10) {
      cleanPhone = '0' + cleanPhone;
    }
    if (!/^09\d{9}$/.test(cleanPhone)) {
      toast.error('Please enter a valid Philippine mobile contact number (e.g. 09XXXXXXXXX)');
      return;
    }
    if (!newResPurok.trim()) {
      toast.error('Purok / Street Address is required');
      return;
    }

    // Auto-build address from dynamic purok + selected barangay
    const adminBarangay = newResBarangay || user?.barangay || 'Pianing';
    const autoAddress = `${newResPurok.trim()}, Barangay ${adminBarangay}, Butuan City`;
    try {
      const cleanPurokNum = (newResPurok || '1').replace(/purok\s*/i, '').trim();
      await apiService.createResident({
        first_name: newResFirstName.trim(),
        middle_name: newResMiddleName.trim(),
        last_name: newResLastName.trim(),
        barangay: adminBarangay,
        date_of_birth: newResDOB,
        gender: newResGender,
        civil_status: newResCivilStatus,
        years_of_residency: newResYearsOfResidency.trim() || undefined,
        address: autoAddress,
        purok: cleanPurokNum,
        phone: cleanPhone,
        id_type: newResIdType || 'Philippine National ID (PhilSys)',
        submitted_id: newResIdPhoto || undefined,
        household_number: newResHouseholdNum.trim() || undefined,
        family_name: newResFamilyName.trim() || newResLastName.trim(),
        is_head_of_household: newResIsHead,
        relationship_to_head: newResRelationship.trim() || (newResIsHead ? 'Head' : 'Member'),
        employment_status: newResEmployment as any
      });
      // Reload to avoid duplicates (never manually push) and refresh superadmin analytics
      await loadData();
      const freshResidents = await apiService.getResidents(user?.barangay, selectedCensusPurok);
      setResidents(freshResidents);
      setStats(prev => ({ ...prev, totalResidents: freshResidents.length }));
      apiService.getCensusStats(user?.barangay, selectedCensusPurok).then(data => { if (data) setCensusStats(data); }).catch(() => {});
      apiService.getHouseholds(user?.barangay, selectedCensusPurok).then(data => { if (data) setCensusHouseholds(data); }).catch(() => {});
      toast.success('Resident registered in Population Census successfully');
      try {
        const ch = new BroadcastChannel('barangay_health_sync');
        ch.postMessage({ type: 'HEALTH_DATA_SYNC', timestamp: Date.now() });
        ch.close();
      } catch {}
      setIsAddResidentOpen(false);
      resetAddResidentForm();
    } catch (err) {
      toast.error('Could not register resident');
    }
  };

  // Reset resident demographic & identity input fields
  const resetResidentFields = () => {
    setNewResFirstName('');
    setNewResMiddleName('');
    setNewResLastName('');
    setNewResDOB('');
    setNewResGender('');
    setNewResCivilStatus('');
    setNewResYearsOfResidency('');
    setNewResPhone('');
    setNewResEmployment('');
    setNewResIdType('');
    setNewResIdPhoto(null);
    setNewResIdFileName('');
  };

  // Full reset of Census Add Resident Modal form state
  const resetAddResidentForm = (targetPurok?: string) => {
    const p = targetPurok || (selectedCensusPurok === 'all' ? '1' : selectedCensusPurok);
    const cleanP = p.replace(/purok\s*/i, '').trim() || '1';
    const existingInP = censusHouseholds.filter(h => 
      (h.purok || '').replace(/purok\s*/i, '').trim() === cleanP || 
      (h.household_number || '').includes(`HH-P${cleanP}`)
    );
    const autoHh = `HH-P${cleanP}-${String(existingInP.length + 1).padStart(3, '0')}`;
    
    setAddResidentMode('new_household');
    setNewResPurok(cleanP);
    setNewResHouseholdNum(autoHh);
    setNewResFamilyName('');
    setNewResIsHead(true);
    setNewResRelationship('Head');
    setHouseholdSearchQuery('');
    setIsHouseholdDropdownOpen(false);
    resetResidentFields();
  };

  // Auto-reset add resident modal form whenever switching sidebar tabs
  useEffect(() => {
    if (!isAddResidentOpen) {
      resetAddResidentForm();
    }
  }, [activeTab]);

  // Filtered households for the searchable combobox in Census Add Resident modal
  const filteredHouseholdsList = useMemo(() => {
    const q = householdSearchQuery.trim().toLowerCase();
    return censusHouseholds.filter(h => {
      const matchPurok = !newResPurok || newResPurok === 'all' || h.purok.includes(newResPurok) || h.household_number.includes(`HH-P${newResPurok}`);
      if (!q) return matchPurok;
      const hNum = (h.household_number || '').toLowerCase();
      const fName = (h.family_name || '').toLowerCase();
      const headName = (h.head_name || '').toLowerCase();
      const purokStr = (h.purok || '').toLowerCase();
      const combined = `${hNum} ${fName} ${headName} ${purokStr}`;
      
      const matchText = hNum.includes(q) ||
        fName.includes(q) ||
        headName.includes(q) ||
        purokStr.includes(q) ||
        combined.includes(q) ||
        (hNum && q.includes(hNum)) ||
        (fName && q.includes(fName));
      return matchPurok && matchText;
    });
  }, [censusHouseholds, householdSearchQuery, newResPurok]);

  // Census search matches for resident system user account creation
  const censusMatches = useMemo(() => {
    const q = (resAccCensusSearch || `${resAccFirstName} ${resAccLastName}`).trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return residents.filter(r => {
      const fn = (r.first_name || '').toLowerCase();
      const ln = (r.last_name || '').toLowerCase();
      const mn = (r.middle_name || '').toLowerCase();
      const full = `${fn} ${mn} ${ln}`.trim();
      const hh = (r.household_number || '').toLowerCase();
      return fn.includes(q) || ln.includes(q) || full.includes(q) || hh.includes(q);
    }).slice(0, 6);
  }, [resAccCensusSearch, resAccFirstName, resAccLastName, residents]);

  // Auto-fill census information for resident account creation
  const applyCensusMatch = (r: Resident) => {
    setResAccCensusMatch(r);
    setResAccLinkedCensusId(r.id);
    setResAccFirstName(r.first_name || '');
    setResAccMiddleName(r.middle_name || '');
    setResAccLastName(r.last_name || '');
    if (r.date_of_birth) {
      setResAccDOB(r.date_of_birth.split('T')[0]);
    }
    if (r.gender === 'Male' || r.gender === 'Female') {
      setResAccGender(r.gender);
    }
    if (r.civil_status) {
      setResAccCivilStatus(r.civil_status);
    }
    if ((r as any).employment_status) {
      setResAccEmployment((r as any).employment_status);
    }
    if ((r as any).years_of_residency) {
      setResAccResidencyYears(String((r as any).years_of_residency));
    }
    if ((r as any).id_type) {
      setResAccIdType((r as any).id_type);
    }
    if ((r as any).submitted_id) {
      setResAccIdPhoto((r as any).submitted_id);
      setResAccIdFileName('Census_Verified_ID.jpg');
    }
    if (r.purok) {
      const cleanP = r.purok.replace(/purok\s*/i, '').trim();
      setResAccPurok(cleanP || '1');
    }
    if (r.household_number) {
      setResAccHouseholdNum(r.household_number);
    }
    if (r.barangay) {
      setResAccBarangay(r.barangay);
    }
    if (r.phone) {
      setResAccPhone(r.phone);
    }
    if (!resAccEmail) {
      if (r.email && r.email.includes('@')) {
        setResAccEmail(r.email);
      } else {
        const cleanF = (r.first_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanL = (r.last_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        setResAccEmail(`${cleanF}.${cleanL}@resident.barangay.ph`);
      }
    }
    toast.success(`Matched Census Record: ${r.first_name} ${r.last_name}! Demographic details auto-filled.`);
  };

  // Check if system user account already exists
  const existingResidentUserAccount = useMemo(() => {
    if (!resAccEmail && (!resAccFirstName || !resAccLastName)) return null;
    return users.find(u => {
      const matchEmail = resAccEmail && u.email?.toLowerCase().trim() === resAccEmail.toLowerCase().trim();
      const matchName = resAccFirstName && resAccLastName && u.name?.toLowerCase().trim() === `${resAccFirstName.trim()} ${resAccLastName.trim()}`.toLowerCase();
      return matchEmail || matchName;
    });
  }, [resAccEmail, resAccFirstName, resAccLastName, users]);

  // Handle resident system user creation
  const handleCreateResidentUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resAccFirstName.trim() || !resAccLastName.trim()) {
      toast.error('First Name and Last Name are required.');
      return;
    }
    if (!resAccEmail.trim()) {
      toast.error('Resident Email is required for portal login.');
      return;
    }
    if (!resAccPassword.trim()) {
      toast.error('Password is required for resident account.');
      return;
    }

    if (resAccPassword.trim() !== resAccConfirmPassword.trim()) {
      toast.error('Passwords do not match. Please re-enter and confirm.');
      return;
    }

    let cleanPhone = resAccPhone.trim().replace(/\D/g, '');
    if (cleanPhone.startsWith('639')) {
      cleanPhone = '0' + cleanPhone.slice(2);
    } else if (cleanPhone.startsWith('9') && cleanPhone.length === 10) {
      cleanPhone = '0' + cleanPhone;
    }
    if (cleanPhone && !/^09\d{9}$/.test(cleanPhone)) {
      toast.error('Please enter a valid Philippine mobile number (e.g. 09XXXXXXXXX) or leave blank.');
      return;
    }

    const passCheck = validatePasswordComplexity(resAccPassword);
    if (!passCheck.isValid) {
      toast.error('Password does not meet security requirements', {
        description: passCheck.error || 'Password must be at least 6 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character.'
      });
      return;
    }

    setIsCreatingResAccount(true);
    try {
      const fullName = `${resAccFirstName.trim()}${resAccMiddleName.trim() ? ' ' + resAccMiddleName.trim() : ''} ${resAccLastName.trim()}`;
      const assignedBarangay = resAccBarangay || user?.barangay || 'Pianing';
      const cleanPurokNum = resAccPurok.replace(/purok\s*/i, '').trim() || '1';
      const fullAddress = `Purok ${cleanPurokNum}, Barangay ${assignedBarangay}, ${resAccCity || 'Butuan City'}`;

      await apiService.createUser({
        name: fullName,
        email: resAccEmail.trim().toLowerCase(),
        password: resAccPassword.trim(),
        role: 'resident',
        status: 'Active',
        barangay: assignedBarangay,
        phone: cleanPhone || undefined,
        created_by: user?.name || 'Administrator',
        first_name: resAccFirstName.trim(),
        middle_name: resAccMiddleName.trim() || undefined,
        last_name: resAccLastName.trim(),
        household_number: resAccHouseholdNum.trim() || undefined,
        purok: cleanPurokNum,
        address: fullAddress,
        gender: resAccGender,
        civil_status: resAccCivilStatus,
        employment_status: resAccEmployment,
        years_of_residency: resAccResidencyYears.trim() || undefined,
        date_of_birth: resAccDOB || undefined,
        id_type: resAccIdType,
        submitted_id: resAccIdPhoto || undefined,
        verification_status: 'Verified',
        resident_id: resAccLinkedCensusId || undefined
      } as any);

      if (resAccLinkedCensusId) {
        try {
          await apiService.updateResident(resAccLinkedCensusId, {
            email: resAccEmail.trim().toLowerCase(),
            phone: cleanPhone || undefined,
            verification_status: 'Verified',
            household_number: resAccHouseholdNum.trim() || undefined,
            purok: cleanPurokNum,
            address: fullAddress,
            id_type: resAccIdType,
            submitted_id: resAccIdPhoto || undefined
          });
        } catch (linkErr) {
          console.warn('Census link sync notice:', linkErr);
        }
      }

      toast.success(`Resident portal account created for ${fullName}!`, {
        description: `Login Email: ${resAccEmail.trim().toLowerCase()} • Access: Verified Resident`
      });

      setIsCreateResidentUserOpen(false);
      setResAccCensusSearch('');
      setResAccFirstName('');
      setResAccMiddleName('');
      setResAccLastName('');
      setResAccEmail('');
      setResAccPassword('');
      setResAccConfirmPassword('');
      setResAccShowConfirmPassword(false);
      setResAccPhone('');
      setResAccDOB('');
      setResAccGender('');
      setResAccCivilStatus('');
      setResAccEmployment('');
      setResAccResidencyYears('');
      setResAccPurok('');
      setResAccCity('Butuan City');
      setResAccHouseholdNum('');
      setResAccIdType('');
      setResAccIdPhoto(null);
      setResAccIdFileName('');
      setResAccLinkedCensusId(null);
      setResAccCensusMatch(null);

      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create resident account');
    } finally {
      setIsCreatingResAccount(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } catch {
      toast.error('Could not refresh data. Please check connection.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);
  const handleRefreshMetrics = async () => {
    setIsRefreshingMetrics(true);
    try {
      const p = await apiService.getPopulationStats(isSuperAdmin ? undefined : user?.barangay).catch(() => null);
      if (p) setPopulationStats(p);
    } catch {
      toast.error('Could not refresh metrics');
    } finally {
      setIsRefreshingMetrics(false);
    }
  };

  const [isRefreshingCensus, setIsRefreshingCensus] = useState(false);
  const handleRefreshCensus = async () => {
    setIsRefreshingCensus(true);
    try {
      const freshResidents = await apiService.getResidents(user?.barangay, selectedCensusPurok);
      setResidents(freshResidents);
      setStats(prev => ({ ...prev, totalResidents: freshResidents.length }));
      const [cStats, cHouseholds] = await Promise.all([
        apiService.getCensusStats(user?.barangay, selectedCensusPurok).catch(() => null),
        apiService.getHouseholds(user?.barangay, selectedCensusPurok).catch(() => [])
      ]);
      if (cStats) setCensusStats(cStats);
      if (cHouseholds) setCensusHouseholds(cHouseholds);
    } catch {
      toast.error('Could not refresh census records');
    } finally {
      setIsRefreshingCensus(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserFirstName.trim() || !newUserLastName.trim() || !newUserEmail.trim()) {
      toast.error('First Name, Last Name, and Email are required');
      return;
    }

    let cleanPhone = newUserPhone.trim().replace(/\D/g, '');
    if (cleanPhone.startsWith('639')) {
      cleanPhone = '0' + cleanPhone.slice(2);
    } else if (cleanPhone.startsWith('9') && cleanPhone.length === 10) {
      cleanPhone = '0' + cleanPhone;
    }
    if (!cleanPhone) {
      toast.error('Mobile Phone Number is required.');
      return;
    }
    if (!/^09\d{9}$/.test(cleanPhone)) {
      toast.error('Please enter a valid Philippine mobile contact number (e.g. 09XXXXXXXXX).');
      return;
    }

    const cleanFirst = newUserFirstName.trim();
    const cleanMiddle = newUserMiddleName.trim();
    const cleanLast = newUserLastName.trim();
    const fullName = `${cleanFirst} ${cleanMiddle ? cleanMiddle + ' ' : ''}${cleanLast}`.trim();
    const assignedBarangay = user?.barangay || 'Pianing';

    // Role Access Rule: Only Super Admin can create Barangay Admin accounts
    if (newUserRole === 'admin' && !isSuperAdmin) {
      toast.error('Access Restricted: Only Super Admin can create Barangay Administrator accounts. You may create Staff, BHW, and Nurse accounts.');
      return;
    }

    // 1 Admin per Barangay rule check
    if (newUserRole === 'admin') {
      const existingAdmin = users.find(u =>
        u.role === 'admin' &&
        u.status === 'Active' &&
        (u.barangay || 'Pianing').toLowerCase().trim() === assignedBarangay.toLowerCase().trim()
      );
      if (existingAdmin) {
        toast.error(`Barangay ${assignedBarangay} already has an active Administrator (${existingAdmin.name}). Only 1 Admin per Barangay is allowed.`);
        return;
      }
    }

    if (newUserPassword.trim() !== newUserConfirmPassword.trim()) {
      toast.error('Passwords do not match. Please re-enter and confirm.');
      return;
    }

    const passCheck = validatePasswordComplexity(newUserPassword);
    if (!passCheck.isValid) {
      toast.error('Password does not meet security requirements', {
        description: passCheck.error || 'Password must be at least 6 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character.'
      });
      return;
    }

    try {
      const created = await apiService.createUser({
        name: fullName,
        email: newUserEmail.trim(),
        password: newUserPassword.trim(),
        role: newUserRole === 'resident' ? 'staff' : newUserRole,
        status: 'Active',
        barangay: assignedBarangay,
        phone: cleanPhone,
        employee_id: newUserEmployeeId.trim() || undefined,
        job_title: newUserJobTitle.trim() || undefined,
        created_by: user?.name || 'Administrator'
      } as any);
      setUsers([created, ...users]);
      toast.success(`${newUserRole === 'admin' ? 'Administrator' : newUserRole.toUpperCase()} account created for Barangay ${assignedBarangay}`);
      setIsAddUserOpen(false);
      setNewUserFirstName('');
      setNewUserMiddleName('');
      setNewUserLastName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserConfirmPassword('');
      setShowNewUserConfirmPass(false);
      setNewUserPhone('');
      setNewUserEmployeeId('');
      setNewUserJobTitle('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add user account');
    }
  };

  const handleUpdateAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileNewPassword) {
      if (!profileCurrentPassword) {
        toast.error('Current password is required to set a new password');
        return;
      }
      if (profileNewPassword !== profileConfirmPassword) {
        toast.error('New passwords do not match');
        return;
      }
      if (profileNewPassword.length < 4) {
        toast.error('New password must be at least 4 characters');
        return;
      }
      // verify current password
      try {
        const verify = await apiService.login(user.email, profileCurrentPassword);
        if (!verify?.success) {
          toast.error('Incorrect current password');
          return;
        }
      } catch {
        toast.error('Could not verify current password');
        return;
      }
    }

    try {
      await apiService.updateProfile({
        id: user?.id,
        email: user?.email,
        name: profileName.trim() !== user?.name ? profileName.trim() : undefined,
        phone: profilePhone.trim() || undefined,
        password: profileNewPassword || undefined
      });

      const updated = {
        ...user,
        name: profileName.trim() || user?.name,
        phone: profilePhone.trim() || user?.phone
      };
      setUser(updated);
      localStorage.setItem('barangay_user', JSON.stringify(updated));
      toast.success('Admin Profile & Security updated successfully!');
      setIsAdminProfileOpen(false);
    } catch (err) {
      toast.error('Failed to update profile');
    }
  };

  const handleArchiveUser = async (u: SystemUser) => {
    const isArchived = u.status === 'Archived';
    const nextStatus = isArchived ? 'Active' : 'Archived';
    try {
      await apiService.updateUser(u.id, { status: nextStatus });
      setUsers(users.map(item => item.id === u.id ? { ...item, status: nextStatus } : item));
      toast.success(isArchived ? `${u.name} account has been restored to Active.` : `${u.name} account has been moved to Archived.`);
    } catch (err) {
      toast.error('Archive action failed');
    }
  };

  const handleActivateUser = async (u: SystemUser) => {
    try {
      await apiService.updateUser(u.id, { status: 'Active' });
      setUsers(users.map(item => item.id === u.id ? { ...item, status: 'Active' } : item));
      toast.success(`${u.name} account is now ACTIVE and can log in.`);
    } catch {
      toast.error('Failed to activate account');
    }
  };

  const handleDeactivateUser = async (u: SystemUser) => {
    try {
      await apiService.updateUser(u.id, { status: 'Inactive' });
      setUsers(users.map(item => item.id === u.id ? { ...item, status: 'Inactive' } : item));
      toast.warning(`${u.name} account is now DEACTIVATED (login access blocked).`);
    } catch {
      toast.error('Failed to deactivate account');
    }
  };

  const handleToggleUserStatus = async (u: SystemUser) => {
    const nextStatus = u.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await apiService.updateUser(u.id, { status: nextStatus });
      setUsers(users.map(item => item.id === u.id ? { ...item, status: nextStatus } : item));
      toast.success(`Account status for ${u.name} set to ${nextStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const getStaffRoleConfig = (role?: string) => {
    const r = (role || '').toLowerCase();
    if (r === 'superadmin') {
      return {
        badge: 'bg-purple-50 text-purple-800 border-purple-200',
        accent: 'text-purple-600',
        bgAccent: 'bg-purple-50 border-purple-200 text-purple-800',
        btn: 'bg-purple-600 hover:bg-purple-700',
        title: 'Super Administrator',
        station: 'Central Governance Dock',
        tier: 'Tier 1 Central Administration'
      };
    }
    if (r === 'admin') {
      return {
        badge: 'bg-blue-50 text-blue-800 border-blue-200',
        accent: 'text-blue-600',
        bgAccent: 'bg-blue-50 border-blue-200 text-blue-800',
        btn: 'bg-blue-600 hover:bg-blue-700',
        title: 'Barangay Administrator',
        station: 'Executive Hall Station',
        tier: 'Tier 2 Executive Governance'
      };
    }
    if (r === 'nurse') {
      return {
        badge: 'bg-teal-50 text-teal-800 border-teal-200',
        accent: 'text-teal-600',
        bgAccent: 'bg-teal-50 border-teal-200 text-teal-800',
        btn: 'bg-teal-600 hover:bg-teal-700',
        title: 'Public Health Nurse (EHR)',
        station: 'Health Center Clinic',
        tier: 'Tier 3 Clinical Healthcare'
      };
    }
    if (r === 'bhw') {
      return {
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        accent: 'text-emerald-600',
        bgAccent: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        btn: 'bg-emerald-600 hover:bg-emerald-700',
        title: 'Barangay Health Worker',
        station: 'Community Health Unit',
        tier: 'Tier 3 Field Community Health'
      };
    }
    if (r === 'resident') {
      return {
        badge: 'bg-sky-50 text-sky-800 border-sky-200',
        accent: 'text-sky-600',
        bgAccent: 'bg-sky-50 border-sky-200 text-sky-800',
        btn: 'bg-sky-600 hover:bg-sky-700',
        title: 'Barangay Resident Citizen',
        station: 'Community Resident Registry',
        tier: 'Resident Citizen Portal'
      };
    }
    return {
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      accent: 'text-amber-600',
      bgAccent: 'bg-amber-50 border-amber-200 text-amber-800',
      btn: 'bg-amber-600 hover:bg-amber-700',
      title: 'Barangay Staff Officer',
      station: 'Municipal Front Desk',
      tier: 'Tier 4 Administrative Operations'
    };
  };

  const handleOpenUserProfile = (u: SystemUser) => {
    let userDetails: any = { ...u };
    const matchingRes = residents.find(r => 
      (u.id && r.id === u.id) || 
      (r.email && u.email && r.email.toLowerCase().trim() === u.email.toLowerCase().trim())
    );
    if (matchingRes) {
      userDetails = {
        ...matchingRes,
        ...u,
        first_name: u.first_name || matchingRes.first_name,
        middle_name: u.middle_name || matchingRes.middle_name,
        last_name: u.last_name || matchingRes.last_name,
        address: u.address || matchingRes.address,
        phone: u.phone || matchingRes.phone,
        date_of_birth: u.date_of_birth || matchingRes.date_of_birth,
        gender: u.gender || matchingRes.gender,
        civil_status: u.civil_status || matchingRes.civil_status,
        purok: u.purok || matchingRes.purok,
        household_number: u.household_number || matchingRes.household_number,
        submitted_id: u.submitted_id || matchingRes.submitted_id,
        verification_status: u.verification_status || matchingRes.verification_status,
        profile_photo: u.profile_photo || (matchingRes as any).profile_photo || null
      };
    }
    setSelectedStaffInfo(userDetails);
  };

  const handleStaffPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStaffInfo) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Selected image file is too large (max 10MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_DIM = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context failure');
          ctx.drawImage(img, 0, 0, width, height);

          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

          await apiService.updateUser(selectedStaffInfo.id, { profile_photo: optimizedDataUrl });
          
          setSelectedStaffInfo((prev: any) => prev ? { ...prev, profile_photo: optimizedDataUrl } : null);
          setUsers(prev => prev.map(u => u.id === selectedStaffInfo.id ? { ...u, profile_photo: optimizedDataUrl } : u));
          
          if (user && user.id === selectedStaffInfo.id) {
            const updatedSelf = { ...user, profile_photo: optimizedDataUrl };
            setUser(updatedSelf);
            window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: updatedSelf }));
          }

          toast.success(`Profile photo updated for ${selectedStaffInfo.name}!`);
        } catch (err) {
          toast.error('Failed to process and update profile photo.');
        }
      };
      img.src = uploadEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveStaffPhoto = async () => {
    if (!selectedStaffInfo) return;
    try {
      await apiService.updateUser(selectedStaffInfo.id, { profile_photo: null });
      setSelectedStaffInfo((prev: any) => prev ? { ...prev, profile_photo: null } : null);
      setUsers(prev => prev.map(u => u.id === selectedStaffInfo.id ? { ...u, profile_photo: null } : u));
      
      if (user && user.id === selectedStaffInfo.id) {
        const updatedSelf = { ...user, profile_photo: null };
        setUser(updatedSelf);
        window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: updatedSelf }));
      }
      toast.success(`Profile photo removed for ${selectedStaffInfo.name}.`);
    } catch {
      toast.error('Failed to remove profile photo.');
    }
  };

  const handleOpenEditUser = (u: SystemUser) => {
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserEmail(u.email);
    setEditUserPassword('');
    setEditUserConfirmPassword('');
    setShowEditUserPass(false);
    setShowEditUserConfirmPass(false);
    setEditUserRole(u.role);
    setEditUserBarangay(u.barangay || 'Pianing');
    setEditUserPhone(u.phone || '');
    setEditUserStatus(u.status || 'Active');
    setIsEditUserOpen(true);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    let cleanEditPhone = editUserPhone.trim().replace(/\D/g, '');
    if (cleanEditPhone.startsWith('639')) {
      cleanEditPhone = '0' + cleanEditPhone.slice(2);
    } else if (cleanEditPhone.startsWith('9') && cleanEditPhone.length === 10) {
      cleanEditPhone = '0' + cleanEditPhone;
    }
    if (!cleanEditPhone) {
      toast.error('Mobile Phone Number is required.');
      return;
    }
    if (!/^09\d{9}$/.test(cleanEditPhone)) {
      toast.error('Please enter a valid Philippine mobile contact number (e.g. 09XXXXXXXXX).');
      return;
    }

    // 1 Admin per Barangay rule check
    if (editUserRole === 'admin') {
      const existingAdmin = users.find(u =>
        u.id !== editingUser.id &&
        u.role === 'admin' &&
        u.status === 'Active' &&
        (u.barangay || 'Pianing').toLowerCase().trim() === editUserBarangay.toLowerCase().trim()
      );
      if (existingAdmin) {
        toast.error(`Barangay ${editUserBarangay} already has an active Administrator (${existingAdmin.name}). Only 1 Admin per Barangay is allowed.`);
        return;
      }
    }

    if (editUserPassword.trim()) {
      if (editUserPassword.trim() !== editUserConfirmPassword.trim()) {
        toast.error('New passwords do not match. Please re-enter and confirm.');
        return;
      }
      // Must provide current password before setting a new one
      if (!editUserCurrentPassword.trim()) {
        toast.error('Please enter the current password before setting a new password.');
        return;
      }
      // Verify current password via login attempt
      try {
        await apiService.login(editingUser.email, editUserCurrentPassword.trim());
      } catch {
        toast.error('Current password is incorrect. Please enter the correct current password.');
        return;
      }
      const passCheck = validatePasswordComplexity(editUserPassword.trim());
      if (!passCheck.isValid) {
        toast.error('New password does not meet security requirements', {
          description: passCheck.error
        });
        return;
      }
    }

    try {
      await apiService.updateUser(editingUser.id, {
        name: editUserName.trim(),
        email: editUserEmail.trim(),
        role: editUserRole,
        barangay: editUserBarangay,
        phone: cleanEditPhone,
        status: editUserStatus,
        password: editUserPassword.trim() ? editUserPassword.trim() : undefined
      });
      setUsers(users.map(u => u.id === editingUser.id ? {
        ...u,
        name: editUserName.trim(),
        email: editUserEmail.trim(),
        role: editUserRole,
        barangay: editUserBarangay,
        phone: cleanEditPhone,
        status: editUserStatus
      } : u));
      
      if (editUserPassword.trim() && editingUser.role === 'superadmin') {
        toast.success(`Superadmin Password Changed! New Password: ${editUserPassword.trim()}`, { duration: 10000 });
      } else {
        toast.success('User details updated successfully');
      }
      
      setIsEditUserOpen(false);
      setEditingUser(null);
      setEditUserCurrentPassword('');
      setEditUserPassword('');
      setEditUserConfirmPassword('');
      setShowEditUserConfirmPass(false);
    } catch {
      toast.error('Failed to update user details');
    }
  };

  const handleOpenResetPassword = (u: SystemUser) => {
    setResetPassUser(u);
    setNewPassVal('');
    setNewPassConfirmVal('');
    setIsResetPassOpen(true);
  };

  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassUser) return;

    if (newPassVal.trim() !== newPassConfirmVal.trim()) {
      toast.error('Passwords do not match. Please re-enter and confirm.');
      return;
    }
    
    const passCheck = validatePasswordComplexity(newPassVal);
    if (!passCheck.isValid) {
      toast.error('Password does not meet security requirements', {
        description: passCheck.error
      });
      return;
    }
    
    try {
      const res = await apiService.resetUserPassword(resetPassUser.id, newPassVal);
      if (resetPassUser.role === 'superadmin') {
        toast.success(`Superadmin Password successfully reset! New Password: ${newPassVal}`, { duration: 10000 });
      } else {
        toast.success(res?.message || `Password successfully reset to: ${newPassVal}`);
      }
      setIsResetPassOpen(false);
      setResetPassUser(null);
      setNewPassVal('');
      setNewPassConfirmVal('');
    } catch {
      toast.error('Failed to reset user password');
    }
  };

  const handleExportUsersCsv = () => {
    const dataToExport = users
      .filter(u => {
        if (isSuperAdmin) return true;
        if (user?.role === 'admin') {
          if (u.role === 'superadmin' || u.role === 'resident') return false;
          const uBrgy = (u.barangay || (u.email?.toLowerCase().includes('anticala') ? 'Anticala' : 'Pianing')).toLowerCase().trim();
          if (uBrgy !== currentAdminBarangay) return false;
          return true;
        }
        return false;
      })
      .map(u => ({
        ID: u.id,
        Name: u.name,
        Email: u.email,
        Role: u.role.toUpperCase(),
        Barangay: u.barangay || 'Pianing',
        Phone: u.phone || '—',
        Status: u.status,
        Last_Login: (u as any).last_login ? new Date((u as any).last_login).toLocaleString() : 'Never',
        Verification: (u as any).verification_status || 'Verified'
      }));
    downloadOfficialPdf({
      title: 'Barangay User Directory',
      subtitle: `Official System User Directory — Barangay ${user?.barangay || 'Pianing'}`,
      filename: `Barangay_User_Directory_${new Date().toISOString().slice(0, 10)}`,
      barangay: user?.barangay || 'Pianing',
      orientation: 'landscape',
      preparedBy: user?.name || 'Administrator',
      preparedByTitle: user?.role === 'superadmin' ? 'Super Administrator' : user?.role === 'staff' ? 'Barangay Staff' : 'Barangay Administrator',
      tables: [{
        title: 'Authorized User Accounts',
        headers: ['ID', 'Name', 'Email', 'Role', 'Barangay', 'Status', 'Last Login'],
        rows: dataToExport.map(u => [u.ID, u.Name, u.Email, u.Role, u.Barangay, u.Status, u.Last_Login])
      }]
    });
    toast.success('User directory PDF downloaded');
  };

  const handleExportResidentsCsv = () => {
    const dataToExport = barangayResidents.map(r => ({
      ID: r.id,
      Name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || (r as any).name || 'Resident',
      Email: r.email || '—',
      Phone: r.phone || '—',
      Address: r.address || '—',
      Purok: r.purok || '—',
      Gender: r.gender || '—',
      Civil_Status: r.civil_status || '—',
      Verification: r.verification_status || (r as any).status || 'Unverified'
    }));
    downloadOfficialPdf({
      title: 'Barangay Registered Residents Directory',
      subtitle: `Official Resident & Citizen Directory — Barangay ${user?.barangay || 'Pianing'}`,
      filename: `Barangay_Residents_Directory_${new Date().toISOString().slice(0, 10)}`,
      barangay: user?.barangay || 'Pianing',
      orientation: 'landscape',
      preparedBy: user?.name || 'Administrator',
      preparedByTitle: 'Barangay Administrator',
      tables: [{
        title: 'Registered Residents',
        headers: ['ID', 'Name', 'Phone', 'Purok', 'Gender', 'Status'],
        rows: dataToExport.map(r => [r.ID, r.Name, r.Phone, r.Purok, r.Gender, r.Verification])
      }]
    });
    toast.success('Resident directory PDF exported');
  };

  const handleLogout = () => {
    localStorage.removeItem('barangay_user');
    toast.info('Logged out of Admin Portal');
    navigate('/login');
  };

  // Check if a system user account is visible to the current administrator
  const isUserForAdmin = (u: SystemUser) => {
    if (isSuperMegaAdmin) return true;
    if (u.role === 'superadmin' && !isSuperAdmin) return false;
    const adminBrgy = (user?.barangay || '').toLowerCase().trim();
    const uBrgy = (u.barangay || '').toLowerCase().trim();
    if (!adminBrgy) return true;
    return uBrgy === adminBrgy;
  };

  // Check if an address or record belongs to current admin's barangay
  const belongsToMyBarangay = (itemAddressOrBarangay?: string, itemEmail?: string, itemBarangay?: string) => {
    if (isSuperMegaAdmin) return true;
    if (!currentAdminBarangay) return true;

    // Direct barangay field match
    if (itemBarangay) {
      const bLower = itemBarangay.toLowerCase().trim();
      return bLower === currentAdminBarangay || bLower.includes(currentAdminBarangay);
    }

    // Direct address field check
    if (itemAddressOrBarangay) {
      const target = itemAddressOrBarangay.toLowerCase().trim();
      return target.includes(currentAdminBarangay);
    }

    // Email check
    if (itemEmail) {
      const targetEm = itemEmail.toLowerCase().trim();
      if (targetEm.includes(currentAdminBarangay)) return true;
    }

    return false;
  };

  // Filtered lists — Documents tab shows ONLY active requests for this barangay
  const isDocForMyBarangay = (doc: DocumentRequest) => {
    if (isSuperMegaAdmin) return true;
    if (!currentAdminBarangay) return true;

    // 1. Direct barangay check
    const docB = ((doc as any).barangay || '').toLowerCase().trim();
    if (docB) {
      return docB === currentAdminBarangay || docB.includes(currentAdminBarangay);
    }

    // 2. Match with resident registry
    const res = residents.find(r => 
      (doc.resident_id && r.id === doc.resident_id) || 
      ((doc as any).email && r.email && r.email.toLowerCase() === (doc as any).email.toLowerCase()) ||
      (`${r.first_name} ${r.last_name}`.toLowerCase().trim() === (doc.resident_name || '').toLowerCase().trim())
    );
    if (res) {
      return belongsToMyBarangay(res.address || (res as any).barangay, res.email, (res as any).barangay);
    }

    // 3. Match with user accounts (including restored users)
    const matchedUser = users.find(u =>
      (doc.resident_id && u.id === doc.resident_id) ||
      ((doc as any).email && u.email && u.email.toLowerCase() === (doc as any).email.toLowerCase()) ||
      (u.name && u.name.toLowerCase().trim() === (doc.resident_name || '').toLowerCase().trim())
    );
    if (matchedUser) {
      return isUserForAdmin(matchedUser);
    }

    // 4. Resident address check
    if ((doc as any).resident_address) {
      return belongsToMyBarangay((doc as any).resident_address, (doc as any).email, (doc as any).barangay);
    }

    return false;
  };

  const barangayDocs = documents.filter(isDocForMyBarangay);
  const activeDocuments = barangayDocs.filter(doc => doc.status === 'Pending' || doc.status === 'Processing' || doc.status === 'Ready for Pickup');
  const filteredDocuments = activeDocuments.filter(doc => {
    const matchesSearch = doc.resident_name.toLowerCase().includes(docSearch.toLowerCase()) ||
                          doc.request_code.toLowerCase().includes(docSearch.toLowerCase()) ||
                          doc.document_type.toLowerCase().includes(docSearch.toLowerCase());
    const matchesType = docTypeFilter === 'all' || doc.document_type.toLowerCase().includes(docTypeFilter.toLowerCase());
    const matchesStatus = docStatusFilter === 'all' || doc.status.toLowerCase() === docStatusFilter.toLowerCase();
    return matchesSearch && matchesType && matchesStatus;
  });

  // Archive lists — processed/completed records that moved out of the active queue
  const [archiveCategory, setArchiveCategory] = useState<'docs' | 'residents' | 'accounts' | 'all'>('docs');
  const [archiveDocSearch, setArchiveDocSearch] = useState('');
  const [archiveDocTypeFilter, setArchiveDocTypeFilter] = useState('all');
  const [archiveResidentSearch, setArchiveResidentSearch] = useState('');
  const [archiveResidentStatusFilter, setArchiveResidentStatusFilter] = useState('all');
  const [archiveUserSearch, setArchiveUserSearch] = useState('');
  const archivedDocuments = barangayDocs.filter(doc => doc.status === 'Completed');
  const filteredArchivedDocs = archivedDocuments.filter(doc => {
    const matchesSearch = doc.resident_name.toLowerCase().includes(archiveDocSearch.toLowerCase()) ||
                          doc.request_code.toLowerCase().includes(archiveDocSearch.toLowerCase()) ||
                          doc.document_type.toLowerCase().includes(archiveDocSearch.toLowerCase());
    const matchesType = archiveDocTypeFilter === 'all' || doc.document_type === archiveDocTypeFilter;
    return matchesSearch && matchesType;
  });

  // Resident Records — strictly verified inhabitants (excludes pending/unverified applicants)
  const verifiedResidents = residents.filter(res => 
    (res.verification_status === 'Verified' || (res as any).status === 'Verified' || (!res.verification_status && (res as any).status !== 'Pending')) &&
    res.verification_status !== 'Pending' && res.verification_status !== 'Pending_Review' && (res as any).status !== 'Pending'
  );
  const barangayResidents = verifiedResidents.filter(res => belongsToMyBarangay(res.address || (res as any).barangay));
  const filteredResidents = barangayResidents.filter(res =>
    `${res.first_name} ${res.last_name}`.toLowerCase().includes(residentSearch.toLowerCase()) ||
    (res.address || '').toLowerCase().includes(residentSearch.toLowerCase()) ||
    (res.email || '').toLowerCase().includes(residentSearch.toLowerCase()) ||
    (res.phone || '').toLowerCase().includes(residentSearch.toLowerCase())
  );

  // Census Inhabitants Roster — strictly isolated by barangay, selected census purok, and search
  const censusFilteredResidents = barangayResidents.filter(res => {
    if (selectedCensusPurok !== 'all') {
      const cleanP = selectedCensusPurok.replace(/purok\s*/i, '').trim();
      const rPurok = (res.purok || '').toString().replace(/purok\s*/i, '').trim();
      if (rPurok !== cleanP) {
        const addrLower = (res.address || '').toLowerCase();
        if (!addrLower.includes(`purok ${cleanP}`) && !addrLower.includes(`purok ${cleanP} `)) {
          return false;
        }
      }
    }
    const q = residentSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      `${res.first_name} ${res.last_name}`.toLowerCase().includes(q) ||
      (res.address || '').toLowerCase().includes(q) ||
      (res.household_number || '').toLowerCase().includes(q) ||
      (res.family_name || '').toLowerCase().includes(q) ||
      (res.phone || '').toLowerCase().includes(q)
    );
  });

  // Pending resident approvals — strictly isolated by barangay
  const myPendingResidents = pendingResidents
    .filter(res => belongsToMyBarangay(res.address || (res as any).barangay, res.email, (res as any).barangay))
    .filter(res => {
      if (!approvalSearch.trim()) return true;
      const q = approvalSearch.toLowerCase();
      return (
        (res.name || `${res.first_name || ''} ${res.last_name || ''}`).toLowerCase().includes(q) ||
        String(res.id).includes(q) ||
        (res.email || '').toLowerCase().includes(q) ||
        (res.address || '').toLowerCase().includes(q)
      );
    });

  // Dynamic Barangay-scoped Stats
  const brgyPendingDocsCount = barangayDocs.filter(d => d.status === 'Pending' || d.status === 'Processing' || d.status === 'Ready for Pickup').length;
  const brgyProcessedCount = barangayDocs.filter(d => d.status === 'Completed').length;
  const brgyTotalResidentsCount = barangayResidents.length;
  const brgyActiveRecordsCount = barangayDocs.length;

  // Dynamic Monthly Issuance Volume Stats (computed from live database documents)
  const monthlyIssuanceStats = useMemo(() => {
    const target = isSuperAdmin ? documents : barangayDocs;
    const currentYear = new Date().getFullYear();
    const months = [
      { key: 0, label: 'Jan' },
      { key: 1, label: 'Feb' },
      { key: 2, label: 'Mar' },
      { key: 3, label: 'Apr' },
      { key: 4, label: 'May' },
      { key: 5, label: 'Jun' },
      { key: 6, label: 'Jul' },
      { key: 7, label: 'Aug' },
      { key: 8, label: 'Sep' },
      { key: 9, label: 'Oct' },
      { key: 10, label: 'Nov' },
      { key: 11, label: 'Dec' },
    ];
    const counts = Array(12).fill(0);

    target.forEach(doc => {
      const rawDate = doc.requested_at || (doc as any).created_at;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          counts[d.getMonth()]++;
        }
      }
    });

    const total = counts.reduce((acc, c) => acc + c, 0);
    const highest = Math.max(...counts, 0);
    const maxScale = highest <= 10 ? 10 : Math.ceil(highest / 10) * 10;

    return {
      total: total || target.length,
      maxScale,
      year: currentYear,
      bars: months.map(m => ({
        month: m.label,
        val: counts[m.key]
      }))
    };
  }, [isSuperAdmin, documents, barangayDocs]);

  // Dynamic available barangays from database registry + client tenants with Butuan fallback
  const availableBarangays = useMemo(() => {
    const set = new Set<string>();
    if (barangaysOverview && barangaysOverview.length > 0) {
      barangaysOverview.forEach(b => {
        const clean = (b.name || (b as any).barangay || '').replace(/^Barangay\s+/i, '').trim();
        if (clean) set.add(clean);
      });
    }
    BUTUAN_BARANGAYS.forEach(b => set.add(b));
    return Array.from(set).sort();
  }, [barangaysOverview]);

  const verifiedAccountsCount = barangayResidents.length;
  const [quickSearch, setQuickSearch] = useState('');

  const menuItems = [
    { id: 'overview', label: 'Dashboard', icon: Home },
    // Staff Management: Only Superadmin can manage staff — Admin cannot
    ...(isSuperAdmin ? [{ id: 'users', label: 'Staff Management', icon: UserCog }] : []),
    ...(isSuperAdmin || hasUserPermission(user, 'can_manage_residents') ? [{ id: 'residents', label: 'Resident Management', icon: Users }] : []),
    ...(isSuperAdmin || hasUserPermission(user, 'can_verify_residents') ? [{
      id: 'approvals',
      label: 'Pending Approvals',
      icon: UserCheck,
      badge: myPendingResidents.length > 0 ? myPendingResidents.length : undefined,
      badgeColor: 'bg-red-600 text-white'
    }] : []),
    ...(isSuperAdmin || hasUserPermission(user, 'can_process_documents') ? [{
      id: 'documents',
      label: 'Document Processing',
      icon: InboxIcon,
      badge: brgyPendingDocsCount > 0 ? brgyPendingDocsCount : undefined,
      badgeColor: 'bg-red-600 text-white'
    }] : []),
    // Census & Demographics: available to Superadmin, Admin, and Staff
    ...(isSuperAdmin || isAdmin || isStaff || hasUserPermission(user, 'can_view_census') ? [{ id: 'records', label: 'Census & Demographics', icon: Database }] : []),
    ...(isSuperAdmin || hasUserPermission(user, 'can_generate_reports') ? [{ id: 'reports', label: 'Analytics & Reports', icon: BarChart }] : []),
    // Activity Logs: Available to Superadmin (strictly scoped to their barangay) and permitted staff
    ...(isSuperAdmin || hasUserPermission(user, 'can_view_logs') ? [{ id: 'logs', label: 'Activity Logs', icon: History }] : []),
    // Category Manager: REMOVED from Superadmin — Super Mega Admin only (via hasUserPermission explicit grant)
    ...(hasUserPermission(user, 'can_manage_categories') && !isSuperAdmin ? [{ id: 'categories', label: 'Category Manager', icon: Tag }] : []),
    // System & Backup: REMOVED from Superadmin — Super Mega Admin only
    ...(hasUserPermission(user, 'can_access_system') && !isSuperAdmin ? [{ id: 'system', label: 'System & Backup', icon: Database }] : []),
    { id: 'profile-settings', label: 'Profile Settings', icon: UserCircle },
    // Barangay Settings (Archive + Notifications) — SuperAdmin only
    ...(isSuperAdmin ? [{ id: 'settings', label: 'Barangay Settings', icon: Settings }] : []),
  ];


  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col font-sans">
      {/* System Notice Banner (System Down / Maintenance / Advisory) */}
      <SystemNoticeBanner />

      {/* Top Navbar matching clean branding on pure white background (#FFFFFF) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-3 sm:px-6 py-2.5 shadow-xs">
        <div className="flex items-center justify-between w-full">
          {/* Left: Burger Button for CP/Tablet + Official Barangay Logo Branding */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Burger menu button: visible ONLY on cellphone and tablet (< 1024px) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl cursor-pointer lg:hidden focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              aria-label="Open mobile navigation menu"
              title="Navigation Menu"
            >
              <Menu size={22} />
            </button>

            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('overview')}>
              <div className="w-9 h-9 rounded-full overflow-hidden bg-white shadow-xs border border-slate-200 flex items-center justify-center shrink-0">
                <img src="/assets/pianing-logo.png" alt="Barangay Pianing" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="text-sm sm:text-base font-bold text-slate-900 block leading-tight">Barangay Pianing</span>
                <span className="text-[10px] sm:text-xs text-slate-500 font-medium hidden sm:block">Smart Barangay Portal — Butuan City</span>
              </div>
            </div>
          </div>

          {/* Right: Notification Log and User Avatar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Activity Log Link (Super Admin only) */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="System Activity Logs"
              >
                <History size={18} />
              </button>
            )}

            {/* User Avatar Profile Menu */}
            <div className="relative flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <button
                onClick={() => setActiveTab('profile-settings')}
                className="flex items-center gap-2 p-1 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer group"
                title="Admin Profile Settings"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 group-hover:border-blue-400 overflow-hidden shrink-0">
                  {user?.profile_photo ? (
                    <img src={user.profile_photo} alt={user?.name || 'Admin'} className="w-full h-full object-cover" />
                  ) : (
                    <User size={18} />
                  )}
                </div>
                <div className="hidden md:block text-left">
                  <span className="text-xs font-bold text-slate-900 block leading-tight">{user?.name || 'Barangay Admin'}</span>
                  <span className="text-[10px] text-blue-600 font-medium">Administrator</span>
                </div>
                <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-700 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile/Tablet Slide-over Navigation Drawer with Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col py-4 border-r border-slate-200 lg:hidden transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <img src="/assets/pianing-logo.png" alt="Barangay Pianing" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block leading-tight">Barangay Pianing</span>
              <span className="text-[10px] text-blue-600 font-medium">{isSuperAdmin ? 'Super Admin' : 'Admin Portal'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setMobileMenuOpen(false);
                  if ((item as any).action) {
                    (item as any).action();
                  } else if ((item as any).isRoute) {
                    navigate((item as any).isRoute);
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/80 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.icon ? (
                    <item.icon size={18} className={`shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-500'}`} />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1 mr-0.5 ${isActive ? 'bg-blue-700' : 'bg-slate-400'}`} />
                  )}
                  <span className="truncate">{item.label}</span>
                </div>
                {(item as any).badge !== undefined && (
                  <span className="ml-auto min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    {(item as any).badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-3 px-3 border-t border-slate-200">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer"
          >
            <LogOut size={18} className="shrink-0 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Global Animated Sync Progress Bar */}
      {(isRefreshing || loading) && (
        <div className="w-full h-1 bg-blue-100 overflow-hidden sticky top-[57px] z-30">
          <div className="w-full h-full bg-blue-600 animate-pulse origin-left" />
        </div>
      )}

      {/* Full-width container flush to the left of the viewport (no side margin gap) */}
      <div className="flex-1 flex w-full">
        {/* Permanent Desktop Sidebar Navigation - Flush to the left edge (hidden on mobile/tablet) */}
        <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col py-4 sticky top-[57px] h-[calc(100vh-57px)]">
          <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if ((item as any).action) {
                      (item as any).action();
                    } else if ((item as any).isRoute) {
                      navigate((item as any).isRoute);
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100/80 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.icon ? (
                      <item.icon size={18} className={`shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-500'}`} />
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1 mr-0.5 ${isActive ? 'bg-blue-700' : 'bg-slate-400'}`} />
                    )}
                    <span className="truncate">{item.label}</span>
                  </div>
                  {(item as any).badge !== undefined && (
                    <span className="ml-auto min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      {(item as any).badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Fixed Bottom Logout */}
          <div className="mt-auto pt-3 px-3 border-t border-slate-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer group"
              title="Sign out of account"
            >
              <LogOut size={18} className="shrink-0 text-rose-500 group-hover:text-rose-700" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main ref={mainContentRef} className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
          {/* Removed visitor mode alert per user request */}
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Super Admin Command Banner - Clean Formal Card */}
              {isSuperAdmin && (
                <div className="bg-white rounded-2xl p-5 sm:p-6 text-slate-900 shadow-xs border border-slate-200 relative overflow-hidden">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10.5px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                          <ShieldCheck size={13} className="text-blue-600" />
                          Super Administrator Command Desk
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-600 font-medium flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400" />
                          Central Governance Desk
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        {getGreetingTime()}, {formatName(user?.name) || 'Super Administrator'}
                      </h3>
                      <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                        Central administrative portal across all 86 Barangays in Butuan City. System audit streams, administrative access permissions, and municipal resident catalogs are active and synchronized.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveTab('users');
                          setNewUserFirstName('');
                          setNewUserMiddleName('');
                          setNewUserLastName('');
                          setNewUserEmail('');
                          setNewUserPassword('');
                          setNewUserConfirmPassword('');
                          setNewUserPhone('');
                          setShowNewUserPass(false);
                          setShowNewUserConfirmPass(false);
                          setNewUserRole('staff');
                          setIsAddUserOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-8.5 px-3.5 gap-1.5 shadow-xs cursor-pointer rounded-xl"
                      >
                        <UserPlus size={14} />
                        Add Staff
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setActiveTab('logs')}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold h-8.5 px-3.5 gap-1.5 shadow-xs cursor-pointer rounded-xl"
                      >
                        <History size={14} />
                        Audit History
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveTab('categories')}
                        className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold h-8.5 px-3.5 gap-1.5 shadow-xs cursor-pointer rounded-xl"
                      >
                        <Tag size={14} />
                        Categories
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Barangay Admin & Staff Welcome Banner - Clean Formal Card */}
              {!isSuperAdmin && (
                <div className="bg-white rounded-2xl p-5 sm:p-6 text-slate-900 shadow-xs border border-slate-200 relative overflow-hidden">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10.5px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                          <ShieldCheck size={13} className="text-blue-600" />
                          {isStaff ? 'Barangay Staff / Clerk' : 'Barangay Administrator'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-600 font-medium flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400" />
                          Barangay {userBarangay}, Butuan City
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        {getGreetingTime()}, {formatName(user?.name) || (isStaff ? 'Staff Member' : 'Administrator')}
                      </h3>
                      <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                        Welcome to the Barangay {userBarangay} Executive Governance Portal. You have <strong>{myPendingResidents.length}</strong> resident {myPendingResidents.length === 1 ? 'application' : 'applications'} awaiting accreditation and <strong>{brgyPendingDocsCount}</strong> clearance {brgyPendingDocsCount === 1 ? 'request' : 'requests'} queued for processing.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                      <Button
                        size="sm"
                        onClick={() => setActiveTab('approvals')}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold h-9 px-4 gap-2 shadow-xs cursor-pointer rounded-xl transition-all"
                      >
                        <UserCheck size={15} />
                        <span>Review Applicants</span>
                        {myPendingResidents.length > 0 && (
                          <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                            {myPendingResidents.length}
                          </span>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setActiveTab('documents')}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-9 px-4 gap-2 shadow-xs cursor-pointer rounded-xl transition-all"
                      >
                        <InboxIcon size={15} />
                        <span>Process Documents</span>
                        {brgyPendingDocsCount > 0 && (
                          <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                            {brgyPendingDocsCount}
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Dashboard Sub-Header with Jurisdiction Badge & Quick Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h2>
                  <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 border-slate-300">
                    {isSuperAdmin ? 'Central Jurisdiction' : `Barangay ${userBarangay}`}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualRefresh}
                    disabled={isRefreshing || loading}
                    className="gap-1.5 text-xs cursor-pointer hover:bg-slate-50 border-slate-200 shadow-xs"
                    title="Refresh all records"
                  >
                    <RefreshCcw size={13} className={isRefreshing || loading ? "animate-spin text-blue-600" : ""} />
                    <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </Button>

                  {(isSuperAdmin || hasUserPermission(user, 'can_create_document')) && (
                    <Dialog open={isAddDocOpen} onOpenChange={setIsAddDocOpen}>
                      <DialogTrigger asChild>
                        <Button
                          onClick={() => {
                            setSelectedResidentForDoc('');
                            setNewDocResidentId(null);
                            setNewDocName('');
                            setNewDocType('');
                            setNewDocGender('');
                            setNewDocCivilStatus('');
                            setNewDocPurok('');
                            setNewDocAge('');
                            setNewDocAddress('');
                            setNewDocPurpose('');
                            setNewDocDuration('');
                            setNewDocExtraFields({});
                            setIsAddDocOpen(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-xs cursor-pointer"
                        >
                          <PlusCircle size={15} />
                          New Document Request
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white">
                        <DialogHeader>
                          <DialogTitle>Issue New Clearance / Certificate</DialogTitle>
                          <DialogDescription className="text-xs">Create a new document request in the database.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateDocument} className="space-y-4 py-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Resident Name</Label>
                            <Input value={newDocName} onChange={e => setNewDocName(e.target.value)} placeholder="e.g. Juan Dela Cruz" required />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Document Type</Label>
                            <Select value={newDocType} onValueChange={setNewDocType}>
                              <SelectTrigger className="w-full"><SelectValue placeholder="Select Document Type" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Barangay Clearance">Barangay Clearance</SelectItem>
                                <SelectItem value="Certificate of Residency">Certificate of Residency</SelectItem>
                                <SelectItem value="Business Permit">Business Permit</SelectItem>
                                <SelectItem value="Certificate of Indigency">Certificate of Indigency</SelectItem>
                                <SelectItem value="Barangay ID">Barangay ID</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Purpose</Label>
                            <Input value={newDocPurpose} onChange={e => setNewDocPurpose(e.target.value)} placeholder="e.g. Employment / Local Permit" />
                          </div>
                          <DialogFooter>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Save Request</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              {/* Main 2-Column Dashboard Grid matching screenshot design */}
              <div className="flex flex-col lg:flex-row gap-5 items-start">
                {/* Left Column: Metric Cards & Document Issuance Volume */}
                <div className="w-full lg:w-[350px] xl:w-[380px] space-y-4 shrink-0">
                  {/* Card 1: Registered Inhabitants & Accreditation Progress */}
                  <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                          <Users size={20} />
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Civil Census Inhabitants</span>
                          <span className="text-2xl font-extrabold text-slate-900 leading-tight">
                            {(populationStats?.total_population ?? brgyTotalResidentsCount ?? barangayResidents.length ?? 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 font-bold border-slate-200">
                        Registry
                      </Badge>
                    </div>

                    <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                        <span className="text-[10px] text-slate-500 block font-medium">Verified Accounts</span>
                        <span className="text-base font-bold text-emerald-700 block">
                          {verifiedAccountsCount}
                        </span>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                        <span className="text-[10px] text-slate-500 block font-medium">Pending Review</span>
                        <span className="text-base font-bold text-amber-700 block">
                          {myPendingResidents.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Portal Verification Coverage</span>
                        <span className="font-bold text-slate-800">
                          {Math.min(100, Math.round((verifiedAccountsCount / Math.max(residents.length, 1)) * 100))}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.round((verifiedAccountsCount / Math.max(residents.length, 1)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Document Processing Pipeline */}
                  <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                          <FileText size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Document Clearances</span>
                          <span className="text-2xl font-extrabold text-slate-900 leading-tight">
                            {brgyPendingDocsCount + brgyProcessedCount}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('documents')}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        View Queue &rarr;
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="bg-amber-50/70 border border-amber-200/60 rounded-lg p-2.5">
                        <span className="text-[10px] text-amber-700 font-semibold block uppercase">Active In Queue</span>
                        <span className="text-lg font-bold text-amber-900">{brgyPendingDocsCount}</span>
                      </div>
                      <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-lg p-2.5">
                        <span className="text-[10px] text-emerald-700 font-semibold block uppercase">Completed / Issued</span>
                        <span className="text-lg font-bold text-emerald-900">{brgyProcessedCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Monthly Issuance Volume (Dynamic Real Database Metrics) */}
                  <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Monthly Issuance Volume</h4>
                        <p className="text-[11px] text-slate-500">Official clearances &amp; certificates ({monthlyIssuanceStats.year})</p>
                      </div>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-mono">
                        {monthlyIssuanceStats.total} Total
                      </span>
                    </div>

                    {/* Chart Container with dedicated Y-axis column to prevent overflow clipping */}
                    <div className="flex h-44 pt-2 pb-6">
                      {/* Left Column: Y-Axis Ticks neatly enclosed with dedicated margin */}
                      <div className="w-8 pr-2 flex flex-col justify-between text-right text-[10px] text-slate-400 font-mono select-none">
                        <span>{monthlyIssuanceStats.maxScale}</span>
                        <span>{Math.round(monthlyIssuanceStats.maxScale * 0.75)}</span>
                        <span>{Math.round(monthlyIssuanceStats.maxScale * 0.5)}</span>
                        <span>{Math.round(monthlyIssuanceStats.maxScale * 0.25)}</span>
                        <span>0</span>
                      </div>

                      {/* Right Column: Chart Canvas & Vertical Bars */}
                      <div className="flex-1 relative border-b border-l border-slate-200">
                        {/* Horizontal Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                          <div className="border-t border-slate-100 w-full" />
                          <div className="border-t border-slate-100 w-full" />
                          <div className="border-t border-slate-100 w-full" />
                          <div className="border-t border-slate-100 w-full" />
                          <div className="w-full" />
                        </div>

                        {/* Vertical Dynamic Bars */}
                        <div className="flex items-end justify-between h-full px-1 gap-1 relative z-10">
                          {monthlyIssuanceStats.bars.map((bar, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                              <div
                                className={`w-full max-w-[14px] rounded-t-sm transition-all cursor-pointer shadow-2xs ${
                                  bar.val > 0
                                    ? 'bg-slate-800 group-hover:bg-blue-600'
                                    : 'bg-slate-200/60 group-hover:bg-slate-300'
                                }`}
                                style={{ height: `${Math.max(bar.val > 0 ? 8 : 3, (bar.val / monthlyIssuanceStats.maxScale) * 100)}%` }}
                                title={`${bar.month}: ${bar.val} requests processed`}
                              />
                              <span className="text-[9px] text-slate-500 font-medium absolute -bottom-5 select-none">{bar.month}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Dynamic Role Content (Super Admin Audit Stream vs Barangay Document Processing) */}
                <div className="flex-1 min-w-0 w-full">
                  {isSuperAdmin ? (
                    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <History size={18} className="text-indigo-600" />
                            Live System Activity &amp; Audit Stream
                          </h3>
                          <p className="text-xs text-slate-500">Real-time chronicle of logins, registrations, approvals, and certificate issuances across Butuan City.</p>
                        </div>
                        <button
                          onClick={() => setActiveTab('logs')}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                          View Full Audit Log
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50/90 text-slate-600 font-semibold">
                              <th className="py-3 px-4 rounded-l-lg">User / Actor</th>
                              <th className="py-3 px-4">Action &amp; Details</th>
                              <th className="py-3 px-4">Barangay</th>
                              <th className="py-3 px-4 rounded-r-lg text-right">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activityLogs.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-10 text-center text-slate-400">
                                  <History size={28} className="mx-auto mb-1.5 opacity-30 text-indigo-400" />
                                  <p className="font-semibold text-slate-600">No activity logs recorded yet.</p>
                                  <p className="text-[11px] text-slate-400">Events will appear here as administrators and residents use the system.</p>
                                </td>
                              </tr>
                            ) : (
                              activityLogs.slice(0, 7).map((log, idx) => {
                                const role = (log.user_role || '').toLowerCase();
                                const badgeColor = 
                                  role === 'superadmin' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                  role === 'admin' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                                  role === 'staff' ? 'bg-sky-100 text-sky-800 border-sky-200' :
                                  role === 'bhw' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                  'bg-slate-100 text-slate-700 border-slate-200';
                                
                                const timeStr = log.timestamp 
                                  ? new Date(log.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                                  : 'Just now';

                                return (
                                  <tr key={`dash-log-${log.id || idx}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-3 px-4">
                                      <div className="font-semibold text-slate-900">{log.user_name || 'System'}</div>
                                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase mt-0.5 ${badgeColor}`}>
                                        {log.user_role || 'Staff'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="font-medium text-slate-800">{log.action}</div>
                                      {log.details && (
                                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{log.details}</div>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 font-medium text-slate-600">
                                      Barangay {log.barangay || 'Pianing'}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-slate-500 whitespace-nowrap">
                                      {timeStr}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-base font-bold text-slate-900">Recent Document Requests</h3>
                        <button
                          onClick={() => setActiveTab('documents')}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
                        >
                          View portal
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50/90 text-slate-600 font-semibold">
                              <th className="py-3 px-4 rounded-l-lg">Request ID</th>
                              <th className="py-3 px-4">Resident Name</th>
                              <th className="py-3 px-4">Document Type</th>
                              <th className="py-3 px-4">Date</th>
                              <th className="py-3 px-4 rounded-r-lg text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {barangayDocs.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-slate-400">
                                  No document requests available.
                                </td>
                              </tr>
                            ) : (
                              barangayDocs.slice(0, 8).map((doc, idx) => {
                                const isCompleted = doc.status === 'Completed';
                                const displayDate = doc.requested_at
                                  ? new Date(doc.requested_at).toLocaleDateString('en-GB')
                                  : '03/03/2024';
                                const displayCode = doc.request_code.replace('DOC-', '') || `125633${idx}`;

                                return (
                                  <tr key={`dash-doc-${doc.id || doc.request_code || idx}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">{displayCode}</td>
                                    <td className="py-3.5 px-4 font-semibold text-slate-900">{doc.resident_name}</td>
                                    <td className="py-3.5 px-4 text-slate-600">{doc.document_type}</td>
                                    <td className="py-3.5 px-4 text-slate-500">{displayDate}</td>
                                    <td className="py-3.5 px-4 text-right">
                                      {isCompleted ? (
                                        <span className="inline-block bg-blue-600 text-white font-medium text-xs px-3.5 py-1 rounded-md shadow-xs">
                                          Completed
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => openDocInfo(doc)}
                                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-1 rounded-md transition-colors cursor-pointer shadow-xs"
                                        >
                                          View
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* COMMUNITY CENSUS & CIVIL DEMOGRAPHICS REGISTRY */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                          Civil Demographic Registry
                        </span>
                        <span className="text-xs text-slate-500 font-medium">• Barangay {user?.barangay || 'Pianing'}</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1 tracking-tight">
                        Community Census &amp; Civil Demographics Registry
                      </h3>
                      <p className="text-xs text-slate-500">
                        Official civil registry demographic distribution and portal registration statistics for Barangay {user?.barangay || 'Pianing'}, Butuan City.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshMetrics}
                        disabled={isRefreshingMetrics}
                        className="text-xs gap-1.5 h-8 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs rounded-lg transition-all"
                      >
                        <RefreshCcw size={12} className={isRefreshingMetrics ? "animate-spin text-blue-600" : "text-slate-500"} />
                        <span>{isRefreshingMetrics ? 'Refreshing...' : 'Refresh Metrics'}</span>
                      </Button>
                    </div>
                  </div>

                  {/* 4 Core Demographic Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Population */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2 hover:border-slate-300 transition-colors">
                      <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Civil Census Inhabitants</span>
                        <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center">
                          <Users size={15} className="text-blue-600" />
                        </div>
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {(populationStats?.total_population ?? residents.length).toLocaleString()}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Official barangay civil registry records
                      </p>
                    </div>

                    {/* Portal Registration Rate */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2 hover:border-slate-300 transition-colors">
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Portal Registration Coverage</span>
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center">
                          <CheckCircle size={15} className="text-emerald-600" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                          {populationStats?.adoption_rate ?? 0}%
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          ({populationStats?.online_registered ?? 0} registered citizens)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, populationStats?.adoption_rate ?? 0)}%` }}
                        />
                      </div>
                    </div>

                    {/* Voting Age Population (18+) */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2 hover:border-slate-300 transition-colors">
                      <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Voting Age Citizens (18+)</span>
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center">
                          <ShieldCheck size={15} className="text-indigo-600" />
                        </div>
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {(populationStats?.registered_voters ?? 0).toLocaleString()}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Adult citizens eligible for local elections
                      </p>
                    </div>

                    {/* Seniors & Minor Priority Groups */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2 hover:border-slate-300 transition-colors">
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Priority Demographic Groups</span>
                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <Users size={15} className="text-slate-700 dark:text-slate-300" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Seniors (60+)</span>
                          <span className="text-base font-extrabold text-slate-900 dark:text-white">
                            {(populationStats?.senior_citizens ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Minors (&lt;18)</span>
                          <span className="text-base font-extrabold text-slate-900 dark:text-white">
                            {(populationStats?.minors_children ?? 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 pt-0.5">Healthcare &amp; social assistance beneficiaries</p>
                    </div>
                  </div>

                  {/* Gender & Purok Density Breakdown Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                    {/* Gender Demographic Distribution */}
                    <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Gender Distribution</span>
                        <span className="text-[11px] text-slate-500">Civil Registry Data</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700">
                          <span className="text-[11px] text-blue-600 font-semibold block">Male</span>
                          <span className="text-xl font-bold text-slate-900 dark:text-white">
                            {(populationStats?.gender?.male ?? 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {populationStats?.total_population ? Math.round(((populationStats.gender.male) / populationStats.total_population) * 100) : 0}% of residents
                          </span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700">
                          <span className="text-[11px] text-pink-600 font-semibold block">Female</span>
                          <span className="text-xl font-bold text-slate-900 dark:text-white">
                            {(populationStats?.gender?.female ?? 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {populationStats?.total_population ? Math.round(((populationStats.gender.female) / populationStats.total_population) * 100) : 0}% of residents
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Purok Residential Distribution */}
                    <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Purok Population Density</span>
                        <span className="text-[11px] text-slate-500">Zonal Resident Counts</span>
                      </div>
                      <div className="space-y-2">
                        {((populationStats?.purok_distribution && populationStats.purok_distribution.length > 0)
                          ? populationStats.purok_distribution
                          : [1, 2, 3, 4, 5, 6].map(p => ({
                              purok: `Purok ${p}`,
                              count: residents.filter(r => (r.purok || '').toString().includes(String(p))).length
                            }))
                        ).map((pItem, pIdx) => {
                          const totalPop = populationStats?.total_population || residents.length || 0;
                          const pct = totalPop > 0 ? Math.round((pItem.count / totalPop) * 100) : 0;
                          return (
                            <div key={`purok-dist-${pIdx}`} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{pItem.purok}</span>
                                <span className="font-mono text-slate-500 font-bold">{pItem.count} residents ({pct}%)</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PENDING APPROVALS */}
          {activeTab === 'approvals' && (
            <div className="space-y-6">
              {/* Citizen Identity Verification Header - Clean Executive White Card */}
              <div className="bg-white text-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200/90 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl shrink-0">
                      <ShieldCheck size={26} className="text-slate-800" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                          Barangay {user?.barangay || 'Pianing'} — Citizen Identity Verification &amp; Accreditation Desk
                        </h2>
                        <Badge className="bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                          {myPendingResidents.length} Pending Review
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 max-w-2xl mt-1 leading-relaxed">
                        Review and authenticate submitted Government IDs from registered residents of Barangay {user?.barangay || 'Pianing'}. Verified citizens receive official accreditation to request clearances, certifications, and civic services.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualRefresh}
                      disabled={isRefreshing || loading}
                      className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs gap-1.5 cursor-pointer h-9 px-3.5 rounded-xl shadow-xs transition-all"
                    >
                      <RefreshCcw size={13} className={isRefreshing || loading ? "animate-spin text-blue-600" : "text-slate-500"} />
                      <span>{isRefreshing ? 'Refreshing...' : 'Refresh List'}</span>
                    </Button>
                  </div>
                </div>

                {/* KPI Summary Counter Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5">
                    <span className="text-[11px] text-slate-500 font-medium block">Pending Verification Queue</span>
                    <span className="text-2xl font-extrabold text-slate-900 block mt-0.5">{myPendingResidents.length}</span>
                    <span className="text-[10px] text-amber-700 font-medium mt-0.5 block">Awaiting identity validation</span>
                  </div>
                  <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5">
                    <span className="text-[11px] text-slate-500 font-medium block">Accredited Citizen Accounts</span>
                    <span className="text-2xl font-extrabold text-slate-900 block mt-0.5">{verifiedAccountsCount}</span>
                    <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block">Verified barangay residents</span>
                  </div>
                </div>
              </div>

              {/* Action Bar: Search Input & Quick Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs">
                <div className="relative flex-1 w-full sm:max-w-md">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search applicant name, reference code, email, or address..."
                    value={approvalSearch}
                    onChange={e => setApprovalSearch(e.target.value)}
                    className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 rounded-xl"
                  />
                  {approvalSearch && (
                    <button
                      onClick={() => setApprovalSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium px-2">
                  <span>Showing <strong>{myPendingResidents.length}</strong> applicant{myPendingResidents.length !== 1 ? 's' : ''} in queue</span>
                </div>
              </div>

              {/* Refined Resident Verification Table */}
              <Card className="border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="w-full text-left min-w-[760px]">
                      <TableHeader>
                        <TableRow className="bg-slate-50/90 border-b border-slate-200">
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pl-4 py-3.5">Applicant Citizen</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3.5">Application Ref</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3.5">Submitted Date</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3.5">Verification Status</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pr-4 py-3.5 text-right">Review Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100">
                        {myPendingResidents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-16">
                              <div className="flex flex-col items-center justify-center max-w-md mx-auto text-slate-400">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-3 shadow-2xs border border-slate-200">
                                  <ShieldCheck size={24} />
                                </div>
                                <h4 className="text-sm font-bold text-slate-800">No Pending Verifications</h4>
                                <p className="text-xs text-slate-500 mt-1 text-center leading-relaxed">
                                  {approvalSearch ? `No applicants match your search "${approvalSearch}".` : 'There are currently zero pending resident identity verifications for this barangay. New registrations will automatically appear here in real time.'}
                                </p>
                                {approvalSearch && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setApprovalSearch('')}
                                    className="mt-3 text-xs h-8 border-slate-300 hover:bg-slate-50 cursor-pointer"
                                  >
                                    Clear Search
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          myPendingResidents.map((r, idx) => (
                            <TableRow key={`pending-res-${r.id}-${idx}`} className="text-xs hover:bg-slate-50/80 transition-colors">
                              <TableCell className="pl-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                                    {(r.name || r.first_name || 'R').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-900 block text-xs">
                                      {formatName(r.name || `${r.first_name || ''} ${r.last_name || ''}`.trim())}
                                    </span>
                                    <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                                      {r.email || r.address || 'Resident Applicant'}
                                    </span>
                                    {(r.claimed_at || (r as any).is_claimed || (r as any).linked_user_id) && (
                                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5">
                                        ✓ Census Record Linked
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-slate-600 text-xs font-bold">
                                <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-mono text-[11px]">
                                  APP-#{r.id}
                                </span>
                              </TableCell>
                              <TableCell className="text-slate-600 text-[11px]">
                                {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent'}
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                                  <Clock size={12} className="text-amber-600" />
                                  Pending Review
                                </span>
                              </TableCell>
                              <TableCell className="pr-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openApplicantReview(r)}
                                    className="h-8 px-3 text-xs gap-1.5 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg cursor-pointer shadow-2xs"
                                    title="Preview complete applicant profile, contact details, address, and submitted ID"
                                  >
                                    <Eye size={13} className="text-slate-500" />
                                    <span>Preview Info</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveResident(r.id)}
                                    className="h-8 px-3.5 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs cursor-pointer"
                                    title="Approve and verify resident account"
                                  >
                                    <Check size={13} />
                                    <span>Approve</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handlePurgeResident(r.id)}
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                    title="Permanently remove invalid or spam record"
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: DOCUMENT PROCESSING — Active (Pending/Processing) only */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              {/* Document Services Header - Clean White Card */}
              <div className="bg-white text-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl shrink-0">
                      <InboxIcon size={26} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                          Barangay {user?.barangay || 'Pianing'} — Document Clearance &amp; Issuance Desk
                        </h2>
                        <Badge className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] uppercase font-bold tracking-wider">
                          {activeDocuments.length} In Active Queue
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 max-w-2xl mt-1 leading-relaxed">
                        Process official constituent requests for Barangay Clearance, Certificate of Residency, Indigency, and Business Permits. Once certified and claimed, records move automatically to the <button onClick={() => { setActiveTab('settings'); setSettingsSubTab('archive'); }} className="underline font-bold text-blue-600 hover:text-blue-800 cursor-pointer">Archive Repository</button>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* KPI Summary Counter Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
                  <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 shadow-2xs">
                    <p className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider">Total Documents Issued</p>
                    <p className="text-2xl font-black text-emerald-700 mt-0.5">
                      {(stats as any)?.totalIssued ?? documents.filter(d => d.status === 'Completed').length}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[11px] text-slate-500 font-medium">Total Active Queue</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{activeDocuments.length}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[11px] text-amber-700 font-medium">Pending Review</p>
                    <p className="text-2xl font-bold text-amber-600 mt-0.5">
                      {activeDocuments.filter(d => d.status === 'Pending').length}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[11px] text-indigo-700 font-medium">In Preparation</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-0.5">
                      {activeDocuments.filter(d => d.status === 'Processing').length}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[11px] text-blue-700 font-medium">Ready for Pickup</p>
                    <p className="text-2xl font-bold text-blue-600 mt-0.5">
                      {activeDocuments.filter(d => d.status === 'Ready for Pickup').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Active Document Applications</h2>
                  <p className="text-xs text-slate-500">Manage and certify active barangay clearances, residency certificates, and business permits.</p>
                </div>

                {(isSuperAdmin || hasUserPermission(user, 'can_create_document')) && (
                  <Dialog open={isAddDocOpen} onOpenChange={setIsAddDocOpen}>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => {
                          setSelectedResidentForDoc('');
                          setNewDocResidentId(null);
                          setNewDocName('');
                          setNewDocType('');
                          setNewDocGender('');
                          setNewDocCivilStatus('');
                          setNewDocPurok('');
                          setNewDocAge('');
                          setNewDocAddress('');
                          setNewDocPurpose('');
                          setNewDocDuration('');
                          setNewDocExtraFields({});
                          setIsAddDocOpen(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm cursor-pointer"
                      >
                      <PlusCircle size={15} />
                      Issue Document Request
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold text-slate-900">Issue &amp; Process Barangay Document</DialogTitle>
                      <DialogDescription className="text-xs text-slate-500">
                        Fill in document parameters, auto-fill resident profile, and print or archive directly into completed records.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateDocument} className="space-y-4 py-2 text-xs">
                      {/* 1. Select Resident or Manual Walk-in */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-700">Select Resident (Auto-fills Demographics)</Label>
                        <Select value={selectedResidentForDoc} onValueChange={handleSelectResidentForDoc}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Select Resident / Walk-in Constituent..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            <SelectItem value="manual">✍️ Manual / Walk-in Constituent</SelectItem>
                            {residents.map(r => (
                              <SelectItem key={`res-opt-${r.id}`} value={String(r.id)}>
                                {r.first_name} {r.last_name} ({r.purok ? (r.purok.startsWith('Purok') ? r.purok : `Purok ${r.purok}`) : 'Pianing'} • {r.gender})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 2. Resident Profile Card */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">Resident Information</span>
                          <span className="text-[10px] text-slate-400">Used for certificate variables</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-600">Full Name <span className="text-red-500">*</span></Label>
                            <Input
                              value={newDocName}
                              onChange={e => setNewDocName(e.target.value)}
                              placeholder="e.g. Juan Dela Cruz"
                              required
                              className="h-8 text-xs bg-white"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-slate-600">Gender</Label>
                              <Select value={newDocGender} onValueChange={(v: any) => setNewDocGender(v)}>
                                <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Select Gender" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Male">Male</SelectItem>
                                  <SelectItem value="Female">Female</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-slate-600">Civil Status</Label>
                              <Select value={newDocCivilStatus} onValueChange={setNewDocCivilStatus}>
                                <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Select Civil Status" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Single">Single</SelectItem>
                                  <SelectItem value="Married">Married</SelectItem>
                                  <SelectItem value="Widowed">Widowed</SelectItem>
                                  <SelectItem value="Separated">Separated</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-600">Purok / Zone</Label>
                            <Select value={newDocPurok} onValueChange={setNewDocPurok}>
                              <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Select Purok" /></SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6].map(p => (
                                  <SelectItem key={`purok-doc-${p}`} value={`Purok ${p}`}>Purok {p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-600">Age / Date of Birth</Label>
                            <Input
                              value={newDocAge}
                              onChange={e => setNewDocAge(e.target.value)}
                              placeholder="e.g. 28 yrs old"
                              className="h-8 text-xs bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 3. Document Type Selection */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-700">Document Type <span className="text-red-500">*</span></Label>
                        <Select value={newDocType} onValueChange={handleNewDocTypeChange}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Document Type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Barangay Clearance">Barangay Clearance</SelectItem>
                            <SelectItem value="Certificate of Residency">Certificate of Residency</SelectItem>
                            <SelectItem value="Certificate of Indigency">Certificate of Indigency</SelectItem>
                            <SelectItem value="Good Moral Clearance">Good Moral Clearance</SelectItem>
                            <SelectItem value="Business Clearance">Business Clearance</SelectItem>
                            <SelectItem value="Business Permit">Business Permit</SelectItem>
                            <SelectItem value="Certificate of Employment">Certificate of Employment</SelectItem>
                            <SelectItem value="Certificate of Land Occupancy">Certificate of Land Occupancy (Actual Occupancy)</SelectItem>
                            <SelectItem value="Barangay ID">Barangay ID</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 4. Dynamic Document Fields (Matches Resident Portal exactly) */}
                      {/* For Certificate of Land Occupancy */}
                      {(newDocType === 'Certificate of Land Occupancy' || newDocType === 'Actual Occupancy') && (
                        <div className="space-y-2.5 bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                          <span className="font-bold text-amber-900 text-[11px] uppercase tracking-wide">Land Occupancy Details</span>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-700">Parcel Land Area (in Words &amp; Figures) <span className="text-red-500">*</span></Label>
                            <Input
                              value={newDocExtraFields['Land Area'] || ''}
                              onChange={e => setNewDocField('Land Area', e.target.value)}
                              placeholder="e.g. Nine Hundred Thirty-One (931)"
                              required
                              className="h-8 text-xs bg-white"
                            />
                            <p className="text-[10px] text-slate-400">e.g. Nine Hundred Thirty-One (931)</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-700">Lot Number (Lot #) <span className="text-red-500">*</span></Label>
                              <Input
                                value={newDocExtraFields['Lot Number'] || ''}
                                onChange={e => setNewDocField('Lot Number', e.target.value)}
                                placeholder="e.g. 1005"
                                required
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-700">Survey Info</Label>
                              <Input
                                value={newDocExtraFields['Survey Info'] || ''}
                                onChange={e => setNewDocField('Survey Info', e.target.value)}
                                placeholder="e.g. PLS-74"
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-700">Year Started <span className="text-red-500">*</span></Label>
                            <Input
                              value={newDocExtraFields['Occupancy Since'] || ''}
                              onChange={e => setNewDocField('Occupancy Since', e.target.value)}
                              placeholder="e.g. 1970's (or 1995)"
                              required
                              className="h-8 text-xs bg-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* For Certificate of Employment */}
                      {newDocType === 'Certificate of Employment' && (
                        <div className="space-y-2.5 bg-blue-50/70 border border-blue-200 rounded-xl p-3">
                          <span className="font-bold text-blue-900 text-[11px] uppercase tracking-wide">Employment Details</span>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-700">Job Position <span className="text-red-500">*</span></Label>
                              <Input
                                value={newDocExtraFields['Job Position'] || ''}
                                onChange={e => setNewDocField('Job Position', e.target.value)}
                                placeholder="e.g. Barangay Tanod"
                                required
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-700">Employer / Office <span className="text-red-500">*</span></Label>
                              <Input
                                value={newDocExtraFields['Employer'] || ''}
                                onChange={e => setNewDocField('Employer', e.target.value)}
                                placeholder="e.g. Barangay Pianing"
                                required
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-700">Start Date <span className="text-red-500">*</span></Label>
                              <Input
                                value={newDocExtraFields['Start Date'] || ''}
                                onChange={e => setNewDocField('Start Date', e.target.value)}
                                placeholder="e.g. January 2022"
                                required
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-700">End Date <span className="text-red-500">*</span></Label>
                              <Input
                                value={newDocExtraFields['End Date'] || ''}
                                onChange={e => setNewDocField('End Date', e.target.value)}
                                placeholder="e.g. Present"
                                required
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* For Business Clearance / Permit */}
                      {(newDocType === 'Business Clearance' || newDocType === 'Business Permit') && (
                        <div className="space-y-2 bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                          <span className="font-bold text-emerald-900 text-[11px] uppercase tracking-wide">Business Details</span>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-700">Business / Store Name <span className="text-red-500">*</span></Label>
                              <Input
                                value={newDocExtraFields['Business Name'] || ''}
                                onChange={e => setNewDocField('Business Name', e.target.value)}
                                placeholder="e.g. Dela Cruz Store"
                                required
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-700">Nature of Business</Label>
                              <Input
                                value={newDocExtraFields['Nature of Business'] || ''}
                                onChange={e => setNewDocField('Nature of Business', e.target.value)}
                                placeholder="e.g. Sari-sari / Retail"
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* For Certificate of Residency */}
                      {newDocType === 'Certificate of Residency' && (
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-700">Years of Residency / Living in Barangay</Label>
                          <Input
                            value={newDocExtraFields['Duration of Residence'] || ''}
                            onChange={e => setNewDocField('Duration of Residence', e.target.value)}
                            placeholder="e.g. 5 years (or since 2019)"
                            className="h-8 text-xs"
                          />
                        </div>
                      )}

                      {/* Purpose */}
                      {newDocType !== 'Certificate of Employment' && newDocType !== 'Certificate of Land Occupancy' && newDocType !== 'Actual Occupancy' && (
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-slate-700">
                            {newDocType === 'Good Moral Clearance' ? 'Purpose / Application To Support' : 'State Purpose'} <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={newDocPurpose}
                            onChange={e => setNewDocPurpose(e.target.value)}
                            placeholder={newDocType === 'Good Moral Clearance' ? 'e.g. Employment application / PRC Board Examination' : 'e.g. Bank Account / Loan / School Requirement'}
                            required
                            className="h-8 text-xs"
                          />
                        </div>
                      )}

                      <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleSaveAndPrintDoc(false)}
                          className="text-xs border-slate-300 hover:bg-slate-50 w-full sm:w-auto"
                        >
                          Save to Active Queue (Pending)
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleSaveAndPrintDoc(true)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm w-full sm:w-auto"
                        >
                          <Printer size={13} />
                          Save, Print &amp; Archive (Completed)
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                )}
              </div>

              {/* Action Bar: Category Pills, Search, and PDF Export */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                {/* Document Type Category Filter Pills */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
                  {[
                    { id: 'all', label: 'All Documents', count: activeDocuments.length },
                    { id: 'Clearance', label: 'Clearance', count: activeDocuments.filter(d => d.document_type.includes('Clearance')).length },
                    { id: 'Residency', label: 'Residency', count: activeDocuments.filter(d => d.document_type.includes('Residency')).length },
                    { id: 'Indigency', label: 'Indigency', count: activeDocuments.filter(d => d.document_type.includes('Indigency')).length },
                    { id: 'Business', label: 'Business', count: activeDocuments.filter(d => d.document_type.includes('Business')).length }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setDocTypeFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        docTypeFilter === tab.id
                          ? 'bg-white text-blue-700 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        docTypeFilter === tab.id ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Search Bar & PDF Export */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search code or resident name..."
                      value={docSearch}
                      onChange={e => setDocSearch(e.target.value)}
                      className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 rounded-xl"
                    />
                    {docSearch && (
                      <button
                        onClick={() => setDocSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <Button
                    onClick={() => {
                      downloadOfficialPdf({
                        title: 'Active Document Requests',
                        subtitle: `Barangay ${user?.barangay || 'Pianing'} — Active Clearance Queue`,
                        filename: `Barangay_Clearance_Requests_${new Date().toISOString().slice(0, 10)}`,
                        preparedBy: user?.name || 'Admin',
                        preparedByTitle: 'Barangay Administrator',
                        tables: [{
                          title: 'Document Requests Queue',
                          headers: ['Code', 'Resident', 'Document Type', 'Purpose', 'Status', 'Requested At'],
                          rows: filteredDocuments.map(d => [d.request_code || '-', d.resident_name || '-', d.document_type || '-', d.purpose || '-', d.status || '-', d.requested_at || '-'])
                        }]
                      });
                      toast.success('Document requests PDF downloaded');
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 h-9 border-slate-300 hover:bg-slate-50 rounded-xl cursor-pointer shrink-0"
                  >
                    <Download size={14} /> Download PDF
                  </Button>
                </div>
              </div>

              {/* Full Document Table */}
              <Card className="border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="w-full text-left border-collapse min-w-[760px]">
                      <TableHeader>
                        <TableRow className="bg-slate-50/90 border-b border-slate-200">
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pl-4 py-3.5 w-32">Request Code</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3.5 w-48">Resident Name</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3.5 min-w-[180px]">Document Type</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3.5 w-32">Lifecycle Status</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3.5 w-28">Requested Date</TableHead>
                          <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pr-4 py-3.5 text-right w-44">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100">
                        {filteredDocuments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-16">
                              <div className="flex flex-col items-center justify-center max-w-md mx-auto text-slate-400">
                                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-xs border border-blue-100">
                                  <InboxIcon size={28} />
                                </div>
                                <h4 className="text-sm font-bold text-slate-800">No active document requests</h4>
                                <p className="text-xs text-slate-500 mt-1 text-center leading-relaxed">
                                  {docSearch || docTypeFilter !== 'all'
                                    ? 'No document requests matched your active filters or search term.'
                                    : 'The active clearance queue is completely clear! Any new document requests submitted by citizens will appear here in real time.'}
                                </p>
                                {(docSearch || docTypeFilter !== 'all') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { setDocSearch(''); setDocTypeFilter('all'); }}
                                    className="mt-3 text-xs h-8 border-slate-300 hover:bg-slate-50 cursor-pointer"
                                  >
                                    Clear Filters
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredDocuments.map((doc, idx) => {
                            const formattedDate = doc.requested_at
                              ? (() => {
                                  try {
                                    const d = new Date(doc.requested_at);
                                    return isNaN(d.getTime()) ? doc.requested_at : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                  } catch {
                                    return doc.requested_at;
                                  }
                                })()
                              : 'Today';

                            return (
                              <TableRow key={`filter-doc-${doc.id}-${idx}`} className="text-xs hover:bg-slate-50/80 transition-colors">
                                <TableCell className="pl-4 py-3 font-mono font-bold text-blue-600">
                                  <button
                                    onClick={() => openDocInfo(doc)}
                                    className="hover:underline cursor-pointer flex items-center gap-1 font-mono font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md text-[11px]"
                                    title="Click to view full details"
                                  >
                                    {doc.request_code}
                                  </button>
                                </TableCell>
                                <TableCell className="font-semibold text-slate-900">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0 border border-slate-200">
                                      {doc.resident_name ? doc.resident_name.charAt(0).toUpperCase() : 'R'}
                                    </div>
                                    <button
                                      onClick={() => openDocInfo(doc)}
                                      className="hover:text-blue-600 hover:underline text-left cursor-pointer font-bold text-xs"
                                    >
                                      {doc.resident_name}
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell className="text-slate-700 font-medium">
                                  <span className="font-semibold text-slate-800">{doc.document_type}</span>
                                  {doc.purpose && (
                                    <span className="block text-[11px] text-slate-400 truncate max-w-[240px]">
                                      {doc.purpose}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge className={
                                    doc.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold' :
                                    doc.status === 'Ready for Pickup' ? 'bg-blue-50 text-blue-700 border border-blue-300 font-semibold flex items-center gap-1 w-fit' :
                                    doc.status === 'Processing' ? 'bg-indigo-50 text-indigo-700 border border-indigo-300 font-semibold flex items-center gap-1 w-fit' :
                                    'bg-amber-50 text-amber-700 border border-amber-300 font-semibold flex items-center gap-1 w-fit'
                                  }>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      doc.status === 'Completed' ? 'bg-emerald-500' :
                                      doc.status === 'Ready for Pickup' ? 'bg-blue-500 animate-pulse' :
                                      doc.status === 'Processing' ? 'bg-indigo-500 animate-pulse' :
                                      'bg-amber-500 animate-pulse'
                                    }`} />
                                    {doc.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-slate-500 text-xs">
                                  {formattedDate}
                                </TableCell>
                                <TableCell className="text-right pr-4">
                                  <div className="flex justify-end items-center gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openDocInfo(doc)}
                                      className="h-8 px-2.5 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 gap-1 rounded-xl cursor-pointer shadow-2xs"
                                      title="View details & update status"
                                    >
                                      <Eye size={12} /> View Info
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openPrintModal(doc)}
                                      className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                                      title="Print Certificate"
                                    >
                                      <Printer size={13} />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleArchiveDoc(doc.id)}
                                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                                      title="Archive request"
                                    >
                                      <Archive size={13} />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB: BARANGAY SETTINGS — Archive + Notifications (SuperAdmin only) */}
          {activeTab === 'settings' && isSuperAdmin && (
            <div className="space-y-6">
              {/* Settings Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Settings className="text-indigo-600" size={22} />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Barangay Settings</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage your barangay's completed records archive and configure notification gateways (Email & SMS).
                  </p>
                </div>
              </div>

              {/* Sub-tab Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('archive')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    settingsSubTab === 'archive'
                      ? 'bg-white dark:bg-slate-800 text-indigo-700 shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                  }`}
                >
                  <Archive size={14} />
                  Archive & Records
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('notifications')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    settingsSubTab === 'notifications'
                      ? 'bg-white dark:bg-slate-800 text-indigo-700 shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                  }`}
                >
                  <Bell size={14} />
                  Notification Settings
                </button>
              </div>

              {/* ── ARCHIVE SUB-TAB ── */}
              {settingsSubTab === 'archive' && (
            <div className="space-y-6">
              {/* Archive Sub-header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Archive className="text-emerald-600" size={20} />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Completed Records Archive</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Central archive for all approved/completed clearance documents, residency certificates, and verified resident accounts.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    downloadOfficialPdf({
                      title: 'Completed Documents Archive',
                      subtitle: `Barangay ${user?.barangay || 'Pianing'} — Archived & Completed Records`,
                      filename: `Barangay_Archived_Documents_${new Date().toISOString().slice(0, 10)}`,
                      preparedBy: user?.name || 'Admin',
                      preparedByTitle: 'Barangay Administrator',
                      tables: [{
                        title: 'Completed Document Records',
                        headers: ['Code', 'Resident', 'Document Type', 'Purpose', 'Status', 'Completed At'],
                        rows: archivedDocuments.map(d => [d.request_code || '-', d.resident_name || '-', d.document_type || '-', d.purpose || '-', d.status || '-', d.processed_at || d.requested_at || '-'])
                      }]
                    });
                    toast.success('Archived documents PDF downloaded');
                  }}
                  variant="outline" size="sm" className="text-xs gap-1.5 border-slate-300"
                >
                  <Download size={14} /> Download Archive (PDF)
                </Button>
              </div>

              {/* Data Migration Callout Banner - Clean White Card */}
              <div className="bg-white rounded-2xl p-4 text-slate-800 shadow-xs flex items-start gap-3 border border-slate-200">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Database size={20} />
                </div>
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    📥 Automated Archive Workflow Active
                  </h4>
                  <p className="text-slate-500 leading-relaxed">
                    When you click <strong>Approve / Complete</strong> on a pending document request, the item is removed from the active <strong>Document Processing</strong> tab and moved here to <strong>Settings &amp; Data Archive</strong> for permanent record storage and printing.
                  </p>
                </div>
              </div>

              {/* Interactive Clickable Archive Stats Banner with Dynamic Tab Switching */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setArchiveCategory('docs')}
                  className={`rounded-2xl p-4 flex items-center justify-between text-left transition-all cursor-pointer group ${
                    archiveCategory === 'docs'
                      ? 'bg-emerald-100/90 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                      : 'bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 hover:border-emerald-300 hover:shadow-xs hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 transition-colors">
                      <CheckCircle size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-emerald-700">Completed Documents</p>
                      <h3 className="text-xl font-bold text-emerald-900">{archivedDocuments.length}</h3>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all shrink-0 ${
                    archiveCategory === 'docs'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-700 bg-emerald-200/60 group-hover:bg-emerald-600 group-hover:text-white'
                  }`}>
                    {archiveCategory === 'docs' ? 'Active ✓' : 'View Only →'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setArchiveCategory('residents')}
                  className={`rounded-2xl p-4 flex items-center justify-between text-left transition-all cursor-pointer group ${
                    archiveCategory === 'residents'
                      ? 'bg-blue-100/90 border-2 border-blue-500 shadow-md ring-2 ring-blue-500/30'
                      : 'bg-blue-50 hover:bg-blue-100/80 border border-blue-200 hover:border-blue-300 hover:shadow-xs hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 group-hover:bg-blue-200 text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                      <UserCheck size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-blue-700">Verified Residents</p>
                      <h3 className="text-xl font-bold text-blue-900">
                        {residents.filter(r => (r as any).verification_status === 'Verified').length}
                      </h3>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all shrink-0 ${
                    archiveCategory === 'residents'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-blue-700 bg-blue-200/60 group-hover:bg-blue-600 group-hover:text-white'
                  }`}>
                    {archiveCategory === 'residents' ? 'Active ✓' : 'View Only →'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setArchiveCategory('accounts')}
                  className={`rounded-2xl p-4 flex items-center justify-between text-left transition-all cursor-pointer group ${
                    archiveCategory === 'accounts'
                      ? 'bg-rose-100/90 border-2 border-rose-500 shadow-md ring-2 ring-rose-500/30'
                      : 'bg-rose-50 hover:bg-rose-100/80 border border-rose-200 hover:border-rose-300 hover:shadow-xs hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 group-hover:bg-rose-200 text-rose-600 flex items-center justify-center shrink-0 transition-colors">
                      <Archive size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-rose-700">Archived Accounts</p>
                      <h3 className="text-xl font-bold text-rose-900">
                        {users.filter(u => isUserForAdmin(u) && u.status === 'Archived').length}
                      </h3>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all shrink-0 ${
                    archiveCategory === 'accounts'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-700 bg-rose-200/60 group-hover:bg-rose-600 group-hover:text-white'
                  }`}>
                    {archiveCategory === 'accounts' ? 'Active ✓' : 'View Only →'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setArchiveCategory('all')}
                  className={`rounded-2xl p-4 flex items-center justify-between text-left transition-all cursor-pointer group ${
                    archiveCategory === 'all'
                      ? 'bg-slate-100 border-2 border-slate-700 shadow-md ring-2 ring-slate-700/30'
                      : 'bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-slate-300 hover:shadow-xs hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 transition-colors">
                      <FolderOpen size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-600">Total Archive Entries</p>
                      <h3 className="text-xl font-bold text-slate-900">
                        {archivedDocuments.length + residents.length + users.filter(u => isUserForAdmin(u) && u.status === 'Archived').length}
                      </h3>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all shrink-0 ${
                    archiveCategory === 'all'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-700 bg-slate-200/60 group-hover:bg-slate-700 group-hover:text-white'
                  }`}>
                    {archiveCategory === 'all' ? 'All Active ✓' : 'View All →'}
                  </span>
                </button>
              </div>

              {/* Archived Documents Section */}
              {(archiveCategory === 'docs' || archiveCategory === 'all') && (
              <Card id="completed-docs-section" className="border-slate-200 bg-white shadow-xs scroll-mt-6">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="text-emerald-600" size={18} />
                      Completed Document Requests
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">All approved clearances, certificates, and permits</CardDescription>
                  </div>
                  <Badge className="bg-emerald-600 text-white text-xs">{archivedDocuments.length} Completed</Badge>
                </CardHeader>
                {/* Archive Doc Filters */}
                <div className="px-6 pb-3 flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <Input
                      placeholder="Search archived documents by resident or request code..."
                      value={archiveDocSearch}
                      onChange={e => setArchiveDocSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <Select value={archiveDocTypeFilter} onValueChange={setArchiveDocTypeFilter}>
                    <SelectTrigger className="w-52 h-8 text-xs"><SelectValue placeholder="Filter by type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Document Types</SelectItem>
                      <SelectItem value="Barangay Clearance">Barangay Clearance</SelectItem>
                      <SelectItem value="Certificate of Residency">Certificate of Residency</SelectItem>
                      <SelectItem value="Business Permit">Business Permit</SelectItem>
                      <SelectItem value="Barangay ID">Barangay ID</SelectItem>
                      <SelectItem value="Certificate of Indigency">Certificate of Indigency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-emerald-50/50">
                        <TableHead className="text-xs">Request Code</TableHead>
                        <TableHead className="text-xs">Resident Name</TableHead>
                        <TableHead className="text-xs">Document Type</TableHead>
                        <TableHead className="text-xs">Purpose</TableHead>
                        <TableHead className="text-xs">Processed At</TableHead>
                        <TableHead className="text-xs">Processed By</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredArchivedDocs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-xs py-10 text-slate-400">
                            <Archive size={30} className="mx-auto mb-2 opacity-30" />
                            No completed documents found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredArchivedDocs.map((doc, idx) => (
                          <TableRow key={`archived-doc-${doc.id}-${idx}`} className="text-xs hover:bg-emerald-50/30">
                            <TableCell>
                              <button
                                onClick={() => openDocInfo(doc)}
                                className="font-mono font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                {doc.request_code}<Eye size={11} className="opacity-60" />
                              </button>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">
                              <button onClick={() => openResidentProfile(doc.resident_id || 1)} className="hover:underline text-indigo-700 cursor-pointer">
                                {doc.resident_name}
                              </button>
                            </TableCell>
                            <TableCell>{doc.document_type}</TableCell>
                            <TableCell className="text-slate-500 max-w-[130px] truncate">{doc.purpose || '-'}</TableCell>
                            <TableCell className="text-slate-400 text-[11px]">
                              {doc.processed_at ? new Date(doc.processed_at).toLocaleDateString() : 'Today'}
                            </TableCell>
                            <TableCell className="text-slate-500">{doc.processed_by || 'Admin'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                <Button size="sm" variant="outline" onClick={() => openDocInfo(doc)} className="h-7 text-[11px] gap-1 cursor-pointer">
                                  <Eye size={12} /> View
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openPrintModal(doc)} className="h-7 text-[11px] gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50 cursor-pointer">
                                  <Printer size={12} /> Print
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              )}

              {/* Verified & Processed Residents Archive */}
              {(archiveCategory === 'residents' || archiveCategory === 'all') && (
              <Card id="verified-residents-section" className="border-slate-200 bg-white shadow-xs scroll-mt-6">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <UserCheck className="text-blue-600" size={18} />
                      Verified &amp; Processed Resident Accounts
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Full list of resident profiles reviewed and approved by the Barangay Administrator</CardDescription>
                  </div>
                  <Badge className="bg-blue-600 text-white text-xs">
                    {residents.filter(r => (r as any).verification_status === 'Verified').length} Verified
                  </Badge>
                </CardHeader>
                {/* Search & Filter */}
                <div className="px-6 pb-3 flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <Input
                      placeholder="Search verified residents by name, phone, or address..."
                      value={archiveResidentSearch}
                      onChange={e => setArchiveResidentSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <Select value={archiveResidentStatusFilter} onValueChange={setArchiveResidentStatusFilter}>
                    <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Verification Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Verified">Verified Only</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Pending_Review">Pending Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-blue-50/50">
                        <TableHead className="text-xs">Full Name</TableHead>
                        <TableHead className="text-xs">Contact</TableHead>
                        <TableHead className="text-xs">Address</TableHead>
                        <TableHead className="text-xs">Barangay</TableHead>
                        <TableHead className="text-xs">Verification</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {residents
                        .filter(res => {
                          const matchesStatus = archiveResidentStatusFilter === 'all' || (res as any).verification_status === archiveResidentStatusFilter;
                          if (!matchesStatus) return false;
                          if (archiveResidentSearch.trim()) {
                            const q = archiveResidentSearch.toLowerCase();
                            const matchName = `${res.first_name} ${res.last_name}`.toLowerCase().includes(q);
                            const matchPhone = ((res as any).phone || '').toLowerCase().includes(q);
                            const matchAddr = (res.address || '').toLowerCase().includes(q);
                            return matchName || matchPhone || matchAddr;
                          }
                          return true;
                        })
                        .length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-xs py-8 text-slate-400">
                            No resident records match your search.
                          </TableCell>
                        </TableRow>
                      ) : (
                        residents
                          .filter(res => {
                            const matchesStatus = archiveResidentStatusFilter === 'all' || (res as any).verification_status === archiveResidentStatusFilter;
                            if (!matchesStatus) return false;
                            if (archiveResidentSearch.trim()) {
                              const q = archiveResidentSearch.toLowerCase();
                              const matchName = `${res.first_name} ${res.last_name}`.toLowerCase().includes(q);
                              const matchPhone = ((res as any).phone || '').toLowerCase().includes(q);
                              const matchAddr = (res.address || '').toLowerCase().includes(q);
                              return matchName || matchPhone || matchAddr;
                            }
                            return true;
                          })
                          .map((res, idx) => (
                            <TableRow key={`res-ov-${res.id}-${idx}`} className="text-xs hover:bg-blue-50/20">
                              <TableCell className="font-semibold text-slate-900">
                                <button onClick={() => openResidentProfile(res.id)} className="hover:underline text-indigo-700 cursor-pointer">
                                  {res.first_name} {res.last_name}
                                </button>
                              </TableCell>
                              <TableCell className="text-slate-600">{(res as any).phone || '—'}</TableCell>
                              <TableCell className="text-slate-500 max-w-[140px] truncate">{res.address}</TableCell>
                              <TableCell>
                                <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                  {res.barangay || 'Pianing'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  (res as any).verification_status === 'Verified'
                                    ? 'bg-emerald-600 text-white'
                                    : (res as any).verification_status === 'Rejected'
                                    ? 'bg-red-100 text-red-700 border-red-300'
                                    : 'bg-amber-100 text-amber-800 border-amber-300'
                                }>
                                  {(res as any).verification_status || 'Verified'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button size="sm" variant="outline" onClick={() => openResidentProfile(res.id)} className="h-7 text-[11px] gap-1 cursor-pointer">
                                    <Eye size={12} /> Profile
                                  </Button>
                                  {isSuperAdmin && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handlePermanentDeleteResident(res)}
                                      className="h-7 px-2.5 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer text-[11px] font-bold gap-1 shadow-xs"
                                      title="Permanently purge resident record"
                                    >
                                      <Trash2 size={12} /> Delete
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              )}

              {/* Archived User Accounts Section */}
              {(archiveCategory === 'accounts' || archiveCategory === 'all') && (
              <Card id="archived-accounts-section" className="border-slate-200 bg-white shadow-xs scroll-mt-6">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Archive className="text-rose-600" size={18} />
                      Archived User &amp; Resident Accounts
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Soft-deleted user accounts. Login access is disabled, but all historical medical and document records remain preserved.
                    </CardDescription>
                  </div>
                  <Badge className="bg-rose-600 text-white text-xs">
                    {users.filter(u => isUserForAdmin(u) && u.status === 'Archived').length} Archived
                  </Badge>
                </CardHeader>
                {/* Search */}
                <div className="px-6 pb-3">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <Input
                      placeholder="Search archived accounts by name or email..."
                      value={archiveUserSearch}
                      onChange={e => setArchiveUserSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                </div>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-rose-50/50">
                        <TableHead className="text-xs">User ID</TableHead>
                        <TableHead className="text-xs">Full Name</TableHead>
                        <TableHead className="text-xs">Email Address</TableHead>
                        <TableHead className="text-xs">Account Role</TableHead>
                        <TableHead className="text-xs">Barangay</TableHead>
                        <TableHead className="text-xs">Contact</TableHead>
                        <TableHead className="text-xs">Account Status</TableHead>
                        <TableHead className="text-xs text-right">Restore Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users
                        .filter(u => {
                          if (!isUserForAdmin(u)) return false;
                          if (u.status !== 'Archived') return false;
                          if (archiveUserSearch.trim()) {
                            const q = archiveUserSearch.toLowerCase();
                            const matchName = (u.name || '').toLowerCase().includes(q);
                            const matchEmail = (u.email || '').toLowerCase().includes(q);
                            const matchPhone = (u.phone || '').toLowerCase().includes(q);
                            return matchName || matchEmail || matchPhone;
                          }
                          return true;
                        })
                        .length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-xs py-10 text-slate-400">
                            <Archive size={28} className="mx-auto mb-2 opacity-30 text-rose-500" />
                            No archived user accounts found. Active accounts that are archived will appear here.
                          </TableCell>
                        </TableRow>
                      ) : (
                        users
                          .filter(u => {
                            if (!isUserForAdmin(u)) return false;
                            if (u.status !== 'Archived') return false;
                            if (archiveUserSearch.trim()) {
                              const q = archiveUserSearch.toLowerCase();
                              const matchName = (u.name || '').toLowerCase().includes(q);
                              const matchEmail = (u.email || '').toLowerCase().includes(q);
                              const matchPhone = (u.phone || '').toLowerCase().includes(q);
                              return matchName || matchEmail || matchPhone;
                            }
                            return true;
                          })
                          .map((u, idx) => (
                            <TableRow key={`arch-user-${u.id}-${idx}`} className="text-xs hover:bg-rose-50/30 bg-rose-50/10">
                              <TableCell className="font-mono text-slate-400 font-semibold">#{u.id}</TableCell>
                              <TableCell className="font-bold text-slate-800">{u.name}</TableCell>
                              <TableCell className="font-mono text-slate-600">{u.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-rose-300 text-rose-700 bg-rose-50 font-semibold text-[10px]">
                                  {u.role.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                  {u.barangay || 'Pianing'}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-slate-600">{u.phone || '—'}</TableCell>
                              <TableCell>
                                <Badge className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold">
                                  Archived
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => handleArchiveUser(u)}
                                    className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer text-[11px] font-bold gap-1 shadow-xs"
                                    title="Restore user account to Active"
                                  >
                                    <RotateCcw size={12} />
                                    Restore
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handlePermanentDeleteUser(u)}
                                    className="h-7 px-2.5 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer text-[11px] font-bold gap-1 shadow-xs"
                                    title="Permanently delete user account"
                                  >
                                    <Trash2 size={12} />
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              )}
            </div>
          )}

              {/* ── NOTIFICATION SETTINGS SUB-TAB ── */}
              {/* PERMANENT DELETE USER CONFIRMATION DIALOG */}
              <Dialog open={deleteUserConfirmOpen} onOpenChange={setDeleteUserConfirmOpen}>
                <DialogContent className="max-w-md bg-white border border-rose-200 p-6 rounded-2xl shadow-xl">
                  <DialogHeader>
                    <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-2">
                      <Trash2 size={22} />
                    </div>
                    <DialogTitle className="text-base font-bold text-slate-900">
                      Permanently Delete User Account?
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 mt-1">
                      Are you sure you want to permanently remove <strong className="text-slate-800">{userToDelete?.name}</strong> (<span className="font-mono">{userToDelete?.email}</span>)?
                      This account and its login credentials will be irreversibly purged from the system.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 mt-2">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                    <span><strong>Warning:</strong> This action cannot be undone. Historical audit logs will retain the user name for audit compliance.</span>
                  </div>
                  <DialogFooter className="mt-4 flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteUserConfirmOpen(false)}
                      className="text-xs h-8"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isDeletingUser}
                      onClick={executePermanentDeleteUser}
                      className="text-xs h-8 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={13} />
                      {isDeletingUser ? 'Deleting...' : 'Permanently Delete'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* PERMANENT DELETE RESIDENT CONFIRMATION DIALOG */}
              <Dialog open={deleteResidentConfirmOpen} onOpenChange={setDeleteResidentConfirmOpen}>
                <DialogContent className="max-w-md bg-white border border-rose-200 p-6 rounded-2xl shadow-xl">
                  <DialogHeader>
                    <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-2">
                      <Trash2 size={22} />
                    </div>
                    <DialogTitle className="text-base font-bold text-slate-900">
                      Permanently Purge Resident Record?
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 mt-1">
                      Are you sure you want to permanently purge the resident record for <strong className="text-slate-800">{residentToDelete?.first_name} {residentToDelete?.last_name}</strong>?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 mt-2">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                    <span><strong>Warning:</strong> This constituent record and associated census registration data will be permanently removed.</span>
                  </div>
                  <DialogFooter className="mt-4 flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteResidentConfirmOpen(false)}
                      className="text-xs h-8"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isDeletingResident}
                      onClick={executePermanentDeleteResident}
                      className="text-xs h-8 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={13} />
                      {isDeletingResident ? 'Purging...' : 'Permanently Purge'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {settingsSubTab === 'notifications' && (
                <NotificationSettingsPanel />
              )}

            </div>
          )}

          {/* TAB 3: POPULATIONS & HOUSEHOLD CENSUS REGISTRY */}
          {activeTab === 'records' && (
            <div className="space-y-6">
              {/* Header with Title, Actions & View Mode Toggle */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Populations</h2>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {censusStats?.total_population ?? filteredResidents.length} Inhabitants
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Barangay {user?.barangay || 'Pianing'} • Civil Inhabitants & Household Registry</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
                  {/* View Mode Switcher */}
                  <div className="inline-flex rounded-lg p-1 bg-slate-100 border border-slate-200 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setCensusViewMode('households')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        censusViewMode === 'households' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Households
                    </button>
                    <button
                      type="button"
                      onClick={() => setCensusViewMode('table')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        censusViewMode === 'table' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Inhabitants Table
                    </button>
                  </div>

                  <Button
                    onClick={() => {
                      const activePurokLabel = selectedCensusPurok === 'all' ? 'All Puroks (1 to 6)' : `Purok ${selectedCensusPurok}`;
                      downloadOfficialPdf({
                        title: 'Barangay Population & Household Census Report',
                        subtitle: `Barangay ${userBarangay || 'Pianing'}, Butuan City — ${activePurokLabel}`,
                        filename: `Barangay_${(userBarangay || 'Pianing').replace(/\s+/g, '_')}_Population_Census_${selectedCensusPurok === 'all' ? 'All_Puroks' : 'Purok_' + selectedCensusPurok}`,
                        barangay: userBarangay || 'Pianing',
                        orientation: 'landscape',
                        preparedBy: user?.name || 'Admin',
                        preparedByTitle: 'Barangay Civil Registrar / Administrator',
                        stats: [
                          { label: 'Total Households', value: censusStats?.total_households ?? censusHouseholds.length },
                          { label: 'Total Families', value: censusStats?.total_families ?? censusHouseholds.length },
                          { label: 'Total Population', value: censusStats?.total_population ?? censusFilteredResidents.length },
                          { label: 'Senior Citizens', value: `${censusStats?.senior_citizens?.total ?? 0} (M: ${censusStats?.senior_citizens?.male ?? 0}, F: ${censusStats?.senior_citizens?.female ?? 0})` },
                          { label: 'Children / Minors', value: censusStats?.children_count ?? 0 },
                          { label: 'Employment Rate', value: `${censusStats?.employment?.rate_percentage ?? 80}% (${censusStats?.employment?.employed ?? 0} Employed / ${censusStats?.employment?.unemployed ?? 0} Unemployed)` }
                        ],
                        tables: [{
                          title: `Civil Inhabitants Roster (${activePurokLabel})`,
                          headers: ['ID', 'Household #', 'Family Name', 'Full Name', 'Age', 'Gender', 'Purok', 'Employment'],
                          rows: censusFilteredResidents.map(r => [
                            r.id,
                            r.household_number || `HH-P${r.purok || '1'}-${r.id}`,
                            r.family_name || r.last_name,
                            `${r.first_name} ${r.middle_name ? r.middle_name + ' ' : ''}${r.last_name}`,
                            `${(r as any).age ?? 25} yo`,
                            r.gender || 'N/A',
                            `Purok ${r.purok || '1'}`,
                            r.employment_status || 'Employed'
                          ])
                        }]
                      });
                      toast.success('Population Census PDF downloaded');
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs h-9 gap-1.5 border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer rounded-lg font-medium"
                  >
                    <Download size={13} className="text-slate-600" />
                    Download PDF
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshCensus}
                    disabled={isRefreshingCensus}
                    className="text-xs h-9 gap-1.5 border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer rounded-lg transition-all"
                  >
                    <RefreshCcw size={13} className={isRefreshingCensus ? "animate-spin text-blue-600" : "text-slate-500"} />
                    <span>{isRefreshingCensus ? 'Refreshing...' : 'Refresh'}</span>
                  </Button>

                  <Button
                    onClick={() => {
                      setNewResBarangay(user?.barangay || 'Pianing');
                      resetAddResidentForm();
                      setIsAddResidentOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs shadow-xs h-9 cursor-pointer font-semibold"
                  >
                    + Register Resident
                  </Button>
                </div>
              </div>

              {/* 6 Clean Demographic Statistic Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="border-slate-200/90 bg-white shadow-xs rounded-xl hover:border-slate-300 transition-colors">
                  <CardContent className="p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Households</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                      {censusStats?.total_households ?? censusHouseholds.length}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Residential units</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/90 bg-white shadow-xs rounded-xl hover:border-slate-300 transition-colors">
                  <CardContent className="p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Families</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                      {censusStats?.total_families ?? censusHouseholds.length}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Family clusters</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/90 bg-white shadow-xs rounded-xl hover:border-slate-300 transition-colors">
                  <CardContent className="p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Population</p>
                    <p className="text-2xl font-black text-blue-600 tracking-tight mt-1">
                      {censusStats?.total_population ?? filteredResidents.length}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Active inhabitants</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/90 bg-white shadow-xs rounded-xl hover:border-slate-300 transition-colors">
                  <CardContent className="p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Seniors (60+)</p>
                    <p className="text-2xl font-black text-amber-700 tracking-tight mt-1">
                      {censusStats?.senior_citizens?.total ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                      M: {censusStats?.senior_citizens?.male ?? 0} • F: {censusStats?.senior_citizens?.female ?? 0}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/90 bg-white shadow-xs rounded-xl hover:border-slate-300 transition-colors">
                  <CardContent className="p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Children (&lt;18)</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                      {censusStats?.children_count ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Minors & dependents</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/90 bg-white shadow-xs rounded-xl hover:border-slate-300 transition-colors">
                  <CardContent className="p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Employment</p>
                    <p className="text-2xl font-black text-emerald-700 tracking-tight mt-1">
                      {censusStats?.employment?.employed ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                      {censusStats?.employment?.unemployed ?? 0} Unemployed ({censusStats?.employment?.rate_percentage ?? 0}%)
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Clean Segmented Purok Filter Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-100/80 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setSelectedCensusPurok('all')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCensusPurok === 'all'
                      ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <span>All Puroks</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${selectedCensusPurok === 'all' ? 'bg-blue-50 text-blue-700 font-bold' : 'bg-slate-200/80 text-slate-600'}`}>
                    {censusStats?.total_population ?? censusFilteredResidents.length}
                  </span>
                </button>
                {[1, 2, 3, 4, 5, 6].map(p => {
                  const pData = censusStats?.purok_breakdown?.find(b => b.purok.includes(String(p)));
                  const count = pData ? pData.population : 0;
                  const isSelected = selectedCensusPurok === String(p);
                  return (
                    <button
                      key={`purok-btn-${p}`}
                      type="button"
                      onClick={() => setSelectedCensusPurok(String(p))}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      <span>Purok {p}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'bg-slate-200/80 text-slate-600'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                <Input
                  placeholder="Search resident name, family, or household #..."
                  value={residentSearch}
                  onChange={e => setResidentSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-white border-slate-200 rounded-xl"
                />
              </div>

              {/* VIEW 1: HOUSEHOLDS DIRECTORY VIEW */}
              {censusViewMode === 'households' && (
                <div className="space-y-3">
                  {censusHouseholds
                    .filter(hh => {
                      if (selectedCensusPurok !== 'all') {
                        const cleanP = selectedCensusPurok.replace(/purok\s*/i, '').trim();
                        if (!hh.purok.includes(cleanP) && !hh.household_number.includes(`HH-P${cleanP}`)) {
                          return false;
                        }
                      }
                      const q = residentSearch.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        hh.household_number.toLowerCase().includes(q) ||
                        hh.family_name.toLowerCase().includes(q) ||
                        (hh.head_name || '').toLowerCase().includes(q) ||
                        hh.members.some(m => `${m.first_name} ${m.last_name}`.toLowerCase().includes(q))
                      );
                    })
                    .map((hh) => {
                      const isExpanded = Boolean(expandedHouseholds[hh.household_number]);
                      return (
                        <Card key={hh.household_number} className="border-slate-200/80 bg-white shadow-xs rounded-xl overflow-hidden hover:border-slate-300 transition-all">
                          <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                                  {hh.household_number}
                                </span>
                                <h3 className="text-sm font-bold text-slate-900">{hh.family_name} Family</h3>
                                <span className="text-xs text-slate-500 font-medium">• {hh.purok}</span>
                              </div>
                              <p className="text-xs text-slate-500">
                                Head of Family: <strong className="text-slate-800">{hh.head_name || 'Not Designated'}</strong>
                              </p>
                              {/* Demographic indicators per household */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80">
                                  {hh.total_members} {hh.total_members === 1 ? 'Member' : 'Members'}
                                </span>
                                {hh.seniors_count > 0 ? (
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300">
                                    {hh.seniors_count} Senior Citizen(s)
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200/70">
                                    0 Seniors
                                  </span>
                                )}
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200/70">
                                  {hh.employed_count} Employed • {hh.unemployed_count} Unemployed
                                </span>
                                {hh.children_count > 0 && (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/80">
                                    {hh.children_count} Minor(s)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-stretch sm:self-auto">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  resetResidentFields();
                                  setAddResidentMode('existing_household');
                                  const cleanP = (hh.purok || '1').replace(/purok\s*/i, '').trim();
                                  setNewResPurok(cleanP);
                                  setNewResHouseholdNum(hh.household_number);
                                  setNewResFamilyName(hh.family_name);
                                  setNewResIsHead(false);
                                  setNewResRelationship('Son');
                                  setHouseholdSearchQuery(`${hh.household_number} - ${hh.family_name} Family`);
                                  setIsHouseholdDropdownOpen(false);
                                  setIsAddResidentOpen(true);
                                }}
                                className="h-8 text-xs font-semibold text-blue-700 border-blue-200 hover:bg-blue-50 cursor-pointer shadow-xs rounded-lg"
                              >
                                + Add Member
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setExpandedHouseholds(prev => ({
                                    ...prev,
                                    [hh.household_number]: !prev[hh.household_number]
                                  }));
                                }}
                                className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs rounded-lg flex items-center gap-1.5"
                              >
                                <span>{isExpanded ? 'Hide' : 'View Members'} ({hh.members.length})</span>
                                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </Button>
                            </div>
                          </div>

                          {/* Expanded Members Table */}
                          {isExpanded && (
                            <div className="border-t border-slate-100 bg-slate-50/50 p-3 overflow-x-auto">
                              <Table className="w-full text-left border-collapse text-xs">
                                <TableHeader>
                                  <TableRow className="border-b border-slate-200">
                                    <TableHead className="py-2 text-slate-600 font-semibold">Name & Role</TableHead>
                                    <TableHead className="py-2 text-slate-600 font-semibold">Relationship</TableHead>
                                    <TableHead className="py-2 text-slate-600 font-semibold">Age & Category</TableHead>
                                    <TableHead className="py-2 text-slate-600 font-semibold">Gender</TableHead>
                                    <TableHead className="py-2 text-slate-600 font-semibold">Birthday</TableHead>
                                    <TableHead className="py-2 text-slate-600 font-semibold">Employment</TableHead>
                                    <TableHead className="py-2 text-right text-slate-600 font-semibold pr-2">Action</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-slate-100">
                                  {hh.members.map((m) => (
                                    <TableRow key={`hh-mem-${m.id}`} className="hover:bg-white transition-colors">
                                      <TableCell className="py-2">
                                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                          <span>{m.first_name} {m.middle_name ? m.middle_name + ' ' : ''}{m.last_name}</span>
                                          {m.is_head_of_household && (
                                            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded">Head</span>
                                          )}
                                        </div>
                                        {m.phone && <span className="text-[10px] text-slate-400 font-mono block">{m.phone}</span>}
                                      </TableCell>
                                      <TableCell className="py-2 text-slate-700">{m.relationship_to_head || (m.is_head_of_household ? 'Head' : 'Member')}</TableCell>
                                      <TableCell className="py-2">
                                        <span className="font-bold text-slate-900">{m.age != null ? `${m.age} yo` : '—'}</span>
                                        {m.is_senior && (
                                          <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">Senior</span>
                                        )}
                                        {m.is_child && (
                                          <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">Child</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-2 text-slate-700">{m.gender || '—'}</TableCell>
                                      <TableCell className="py-2 font-mono text-slate-600">
                                        {m.date_of_birth ? new Date(m.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                      </TableCell>
                                      <TableCell className="py-2">
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                          m.employment_status === 'Employed' || m.employment_status === 'Self-Employed'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : m.employment_status === 'Unemployed'
                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                            : 'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}>
                                          {m.employment_status || 'Employed'}
                                        </span>
                                      </TableCell>
                                      <TableCell className="py-2 text-right pr-2">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => openResidentProfile(m.id)}
                                          className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 cursor-pointer font-semibold"
                                        >
                                          View Profile
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </Card>
                      );
                    })}

                  {censusHouseholds.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                      No households registered for this selection.
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: ALL INHABITANTS TABLE VIEW */}
              {censusViewMode === 'table' && (
                <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table className="w-full text-left border-collapse min-w-[900px]">
                        <TableHeader>
                          <TableRow className="bg-slate-50/80 border-b border-slate-200">
                            <TableHead className="w-14 pl-4 text-xs font-semibold text-slate-600">ID</TableHead>
                            <TableHead className="w-44 text-xs font-semibold text-slate-600">Household & Family</TableHead>
                            <TableHead className="w-56 text-xs font-semibold text-slate-600">Full Name</TableHead>
                            <TableHead className="w-28 text-xs font-semibold text-slate-600">Age & Category</TableHead>
                            <TableHead className="w-20 text-xs font-semibold text-slate-600">Gender</TableHead>
                            <TableHead className="w-28 text-xs font-semibold text-slate-600">Birthday</TableHead>
                            <TableHead className="w-24 text-xs font-semibold text-slate-600">Purok</TableHead>
                            <TableHead className="w-32 text-xs font-semibold text-slate-600">Employment</TableHead>
                            <TableHead className="w-24 text-xs font-semibold text-slate-600 text-right pr-4">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-slate-100">
                          {censusFilteredResidents.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center py-12 text-slate-400 text-xs">
                                No inhabitants found matching criteria.
                              </TableCell>
                            </TableRow>
                          ) : (
                            censusFilteredResidents.map((res, idx) => (
                              <TableRow key={`res-rec-${res.id}-${idx}`} className="text-xs hover:bg-slate-50/80 transition-colors">
                                <TableCell className="pl-4 font-mono text-slate-500 font-semibold">#{res.id}</TableCell>
                                <TableCell>
                                  <span className="font-mono text-[11px] font-bold text-slate-700 block">
                                    {res.household_number || `HH-P${res.purok || '1'}-${res.id}`}
                                  </span>
                                  <span className="text-[11px] text-slate-500">{res.family_name || res.last_name} Family</span>
                                </TableCell>
                                <TableCell>
                                  <button
                                    onClick={() => openResidentProfile(res.id)}
                                    className="font-bold text-slate-900 hover:text-blue-600 hover:underline transition-colors text-left block cursor-pointer"
                                  >
                                    {res.first_name} {res.last_name}
                                  </button>
                                  {res.phone && <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{res.phone}</span>}
                                </TableCell>
                                <TableCell>
                                  <span className="font-bold text-slate-800">{(res as any).age ?? 25} yo</span>
                                  {(res as any).is_senior && (
                                    <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">Senior</span>
                                  )}
                                  {(res as any).is_child && (
                                    <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">Child</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-slate-700">{res.gender || '-'}</TableCell>
                                <TableCell className="font-mono text-slate-600">
                                  {res.date_of_birth ? new Date(res.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                </TableCell>
                                <TableCell className="text-slate-700 font-semibold">Purok {res.purok || '1'}</TableCell>
                                <TableCell>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                    res.employment_status === 'Employed' || res.employment_status === 'Self-Employed'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : res.employment_status === 'Unemployed'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}>
                                    {res.employment_status || 'Employed'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right pr-4">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openResidentProfile(res.id)}
                                    className="h-7 px-2.5 text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50 border-slate-200 rounded-lg cursor-pointer font-semibold"
                                  >
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* TAB 4: USER DIRECTORY & SYSTEM ACCOUNTS CONTROL */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Executive Header Banner - Soft Clean White Card */}
              {isSuperAdmin ? (
                <div className="bg-white text-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200 space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-violet-50 border border-violet-200 rounded-xl shrink-0">
                        <ShieldCheck size={26} className="text-violet-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-slate-900">
                            User Management &amp; Personnel Control Center
                          </h2>
                        </div>
                        <p className="text-xs text-slate-500 max-w-2xl mt-1 leading-relaxed">
                          Official directory of municipal personnel, officials, and health workers across all barangays. Manage permissions, reset credentials, and track roles.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <Button
                        size="sm"
                        onClick={handleExportUsersCsv}
                        variant="outline"
                        className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs gap-1.5 cursor-pointer h-9 px-3 rounded-xl transition-all"
                      >
                        <Download size={14} />
                        Export Personnel (CSV)
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => loadData()}
                        variant="outline"
                        className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs gap-1.5 cursor-pointer h-9 px-3 rounded-xl transition-all"
                      >
                        <RefreshCcw size={14} />
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-[11px] text-slate-500 font-medium">Total Personnel</p>
                      <p className="text-2xl font-bold text-slate-900 mt-0.5">{users.filter(u => u.role !== 'resident').length}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-[11px] text-indigo-700 font-medium">Admins &amp; Officials</p>
                      <p className="text-2xl font-bold text-indigo-600 mt-0.5">
                        {users.filter(u => u.role === 'admin' || u.role === 'superadmin').length}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-[11px] text-teal-700 font-medium">Health Staff (BHW/Nurse)</p>
                      <p className="text-2xl font-bold text-teal-600 mt-0.5">
                        {users.filter(u => u.role === 'bhw' || u.role === 'nurse').length}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-[11px] text-emerald-700 font-medium">Staff &amp; Clerks</p>
                      <p className="text-2xl font-bold text-emerald-600 mt-0.5">
                        {users.filter(u => u.role === 'staff').length}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white text-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200 space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl shrink-0">
                        <UserCog size={26} className="text-indigo-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                            Barangay {user?.barangay || 'Pianing'} — Official Personnel Directory
                          </h2>
                          <Badge className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] uppercase font-bold tracking-wider">
                            Staff &amp; Officials
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 max-w-2xl mt-1 leading-relaxed">
                          Official directory of barangay administrators, staff clerks, and health workers for Barangay {user?.barangay || 'Pianing'}. (Civilian residents are managed in the Resident Management section).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <Button
                        size="sm"
                        onClick={handleExportUsersCsv}
                        variant="outline"
                        className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs gap-1.5 cursor-pointer h-9 px-3 rounded-xl transition-all"
                      >
                        <Download size={14} />
                        Export Personnel (CSV)
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleManualRefresh}
                        disabled={isRefreshing || loading}
                        variant="outline"
                        className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs gap-1.5 cursor-pointer h-9 px-3 rounded-xl transition-all"
                      >
                        <RefreshCcw size={13} className={isRefreshing || loading ? "animate-spin text-indigo-600" : ""} />
                        <span>{isRefreshing ? 'Refreshing...' : 'Refresh List'}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Summary Metric Counters for Barangay Admin */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-[11px] text-slate-500 font-medium">Total Personnel</p>
                      <p className="text-2xl font-bold text-slate-900 mt-0.5">
                        {users.filter(u => isUserForAdmin(u) && u.role !== 'resident' && u.status !== 'Archived').length}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-[11px] text-indigo-700 font-medium">Administrators</p>
                      <p className="text-2xl font-bold text-indigo-600 mt-0.5">
                        {users.filter(u => isUserForAdmin(u) && u.role === 'admin' && u.status !== 'Archived').length}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-[11px] text-teal-700 font-medium">Health Staff (BHW &amp; Nurse)</p>
                      <p className="text-2xl font-bold text-teal-600 mt-0.5">
                        {users.filter(u => isUserForAdmin(u) && (u.role === 'bhw' || u.role === 'nurse') && u.status !== 'Archived').length}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <p className="text-[11px] text-blue-700 font-medium">Clerks &amp; Staff</p>
                      <p className="text-2xl font-bold text-blue-600 mt-0.5">
                        {users.filter(u => isUserForAdmin(u) && u.role === 'staff' && u.status !== 'Archived').length}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Bar: Category Segregation Tabs, Search & Filters */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
                {/* Specific Category Tabs for Personnel */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap w-full lg:w-auto">
                  <button
                    onClick={() => setUserCategoryTab('all')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      userCategoryTab === 'all'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users size={14} />
                    All Personnel
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 font-mono font-bold">
                      {users.filter(u => isUserForAdmin(u) && u.role !== 'resident' && u.status !== 'Archived').length}
                    </span>
                  </button>
                  <button
                    onClick={() => setUserCategoryTab('officials')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      userCategoryTab === 'officials'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Building2 size={14} />
                    Officials &amp; Admins
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono font-bold">
                      {users.filter(u => isUserForAdmin(u) && u.status !== 'Archived' && (u.role === 'admin' || u.role === 'superadmin')).length}
                    </span>
                  </button>
                  <button
                    onClick={() => setUserCategoryTab('health' as any)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      (userCategoryTab as any) === 'health'
                        ? 'bg-white text-teal-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Heart size={14} />
                    Health (BHW/Nurse)
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-mono font-bold">
                      {users.filter(u => isUserForAdmin(u) && u.status !== 'Archived' && (u.role === 'bhw' || u.role === 'nurse')).length}
                    </span>
                  </button>
                  <button
                    onClick={() => setUserCategoryTab('staff' as any)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      (userCategoryTab as any) === 'staff'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UserCheck size={14} />
                    Staff &amp; Clerks
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono font-bold">
                      {users.filter(u => isUserForAdmin(u) && u.status !== 'Archived' && u.role === 'staff').length}
                    </span>
                  </button>
                  <button
                    onClick={() => setUserCategoryTab('archived')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      userCategoryTab === 'archived'
                        ? 'bg-white text-rose-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Archive size={14} />
                    Archived
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono font-bold">
                      {users.filter(u => isUserForAdmin(u) && u.role !== 'resident' && u.status === 'Archived').length}
                    </span>
                  </button>
                </div>

                {/* Filters & Add Button */}
                <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                  {/* Search Bar */}
                  <div className="relative flex-1 sm:w-56">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search name, email, phone..."
                      value={userSearchText}
                      onChange={e => setUserSearchText(e.target.value)}
                      className="pl-9 pr-7 h-8.5 text-xs bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                    />
                    {userSearchText && (
                      <button
                        type="button"
                        onClick={() => setUserSearchText('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title="Clear search"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Searchable Barangay Filter (Super Admin) */}
                  {isSuperAdmin && (
                    <div className="relative">
                      <Input
                        list="user-accounts-barangay-list"
                        placeholder="Search Barangay..."
                        value={userBarangayFilter === 'all' ? '' : userBarangayFilter}
                        onChange={e => setUserBarangayFilter(e.target.value.trim() || 'all')}
                        className="h-8.5 text-xs w-44 bg-slate-50 border-slate-200 rounded-xl"
                      />
                      <datalist id="user-accounts-barangay-list">
                        <option value="all">All Barangays</option>
                        {availableBarangays.map(b => (
                          <option key={b} value={b}>Barangay {b}</option>
                        ))}
                      </datalist>
                    </div>
                  )}

                  {/* Add User Dialog */}
                  {(isSuperAdmin || user?.role === 'admin') && (
                    <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                      <DialogTrigger asChild>
                        <Button
                          onClick={() => {
                            setNewUserFirstName('');
                            setNewUserMiddleName('');
                            setNewUserLastName('');
                            setNewUserEmail('');
                            setNewUserPassword('');
                            setNewUserConfirmPassword('');
                            setNewUserPhone('');
                            setShowNewUserPass(false);
                            setShowNewUserConfirmPass(false);
                            setNewUserRole('staff');
                            setIsAddUserOpen(true);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5 shadow-xs cursor-pointer"
                        >
                          <UserPlus size={14} />
                          Add Staff
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white max-w-xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-slate-900 mt-1">
                            <UserPlus className="text-indigo-600" size={18} />
                            Add Staff Member
                          </DialogTitle>
                          <DialogDescription className="text-xs text-slate-500">
                            Create official credentials and role-based access for barangay personnel.
                          </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleCreateUser} className="space-y-3 py-2" autoComplete="off">

                          {/* Full Name Row: First, Middle, Last */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs font-semibold">First Name <span className="text-red-500">*</span></Label>
                              <Input
                                value={newUserFirstName}
                                onChange={e => setNewUserFirstName(e.target.value)}
                                placeholder="e.g. Maria"
                                required
                                className="h-9 text-xs mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold">Middle Name</Label>
                              <Input
                                value={newUserMiddleName}
                                onChange={e => setNewUserMiddleName(e.target.value)}
                                placeholder="e.g. Clara"
                                className="h-9 text-xs mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold">Last Name <span className="text-red-500">*</span></Label>
                              <Input
                                value={newUserLastName}
                                onChange={e => setNewUserLastName(e.target.value)}
                                placeholder="e.g. Santos"
                                required
                                className="h-9 text-xs mt-1"
                              />
                            </div>
                          </div>

                          {/* Contact Info Row: Work Email & Contact Number */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs font-semibold">Official Work Email <span className="text-red-500">*</span></Label>
                              <Input
                                type="email"
                                value={newUserEmail}
                                onChange={e => setNewUserEmail(e.target.value)}
                                placeholder="e.g. maria.santos@pianing.gov.ph"
                                autoComplete="off"
                                required
                                className="h-9 text-xs mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold">Contact Mobile Number <span className="text-red-500">*</span></Label>
                              <Input
                                value={newUserPhone}
                                onChange={e => {
                                  setNewUserPhone(e.target.value.replace(/[^0-9+]/g, '').slice(0, 13));
                                }}
                                placeholder="09XXXXXXXXX"
                                required
                                inputMode="tel"
                                autoComplete="off"
                                className="h-9 text-xs font-mono mt-1"
                              />
                            </div>
                          </div>

                          {/* Role Row */}
                          <div>
                            <Label className="text-xs font-semibold">System Role / Permissions <span className="text-red-500">*</span></Label>
                            <Select
                              value={newUserRole === 'resident' || (!isSuperAdmin && newUserRole === 'admin') ? 'staff' : newUserRole}
                              onValueChange={(val: 'admin' | 'staff' | 'bhw' | 'nurse') => setNewUserRole(val)}
                            >
                              <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {isSuperAdmin && <SelectItem value="admin">Barangay Admin (Full Local Control)</SelectItem>}
                                <SelectItem value="staff">Barangay Staff / Records Clerk</SelectItem>
                                <SelectItem value="bhw">BHW (Community Health Worker)</SelectItem>
                                <SelectItem value="nurse">Nurse (Health Center Nurse)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Password & Confirm Password Container */}
                          <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs font-bold text-slate-800">Account Access Password <span className="text-red-500">*</span></Label>
                                <div className="relative mt-1">
                                  <Input
                                    type={showNewUserPass ? "text" : "password"}
                                    value={newUserPassword}
                                    onChange={e => setNewUserPassword(e.target.value)}
                                    placeholder="Enter account password"
                                    autoComplete="new-password"
                                    required
                                    minLength={6}
                                    className="h-9 text-xs font-mono pr-8 bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowNewUserPass(!showNewUserPass)}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    tabIndex={-1}
                                    title={showNewUserPass ? "Hide password" : "Show password"}
                                  >
                                    {showNewUserPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs font-bold text-slate-800">Confirm Password <span className="text-red-500">*</span></Label>
                                <div className="relative mt-1">
                                  <Input
                                    type={showNewUserConfirmPass ? "text" : "password"}
                                    value={newUserConfirmPassword}
                                    onChange={e => setNewUserConfirmPassword(e.target.value)}
                                    placeholder="Re-enter password"
                                    autoComplete="new-password"
                                    required
                                    minLength={6}
                                    className="h-9 text-xs font-mono pr-8 bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowNewUserConfirmPass(!showNewUserConfirmPass)}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    tabIndex={-1}
                                    title={showNewUserConfirmPass ? "Hide password" : "Show password"}
                                  >
                                    {showNewUserConfirmPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </div>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500">
                              Must contain at least 6 characters with uppercase, lowercase, number, and special character.
                            </p>
                          </div>

                          <DialogFooter className="pt-2">
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold w-full h-9 shadow-xs cursor-pointer">
                              Authorize &amp; Create Staff Account
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              {/* Interactive User Table */}
              <Card className="border-slate-200/80 bg-white shadow-xs rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 border-b border-slate-200 hover:bg-slate-50/80">
                          <TableHead className="text-xs font-bold text-slate-700 w-16">ID</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Account Name</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Email Address</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Role</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Barangay</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Contact Phone</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Verification</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Last Login</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Status</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700 text-right pr-4 w-[240px] min-w-[240px] shrink-0">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filtered = users.filter(u => {
                            // 1. Role & Barangay permission check: strictly personnel only (no civilian residents)
                            if (u.role === 'resident') return false;
                            if (!isUserForAdmin(u)) return false;

                            // 2. Category Tab filter
                            if (userCategoryTab === 'archived') {
                              if (u.status !== 'Archived') return false;
                            } else {
                              if (u.status === 'Archived') return false;
                              if (userCategoryTab === 'officials' && u.role !== 'admin' && u.role !== 'superadmin') return false;
                              if ((userCategoryTab as any) === 'health' && u.role !== 'bhw' && u.role !== 'nurse') return false;
                              if ((userCategoryTab as any) === 'staff' && u.role !== 'staff') return false;
                            }

                            // 3. Super Admin Barangay dropdown filter
                            if (isSuperAdmin && userBarangayFilter !== 'all') {
                              const uBrgy = (u.barangay || '').toLowerCase();
                              if (!uBrgy.includes(userBarangayFilter.toLowerCase())) return false;
                            }

                            // 4. Search text filter
                            if (userSearchText.trim()) {
                              const q = userSearchText.toLowerCase();
                              const matchName = u.name?.toLowerCase().includes(q);
                              const matchEmail = u.email?.toLowerCase().includes(q);
                              const matchPhone = u.phone?.toLowerCase().includes(q);
                              if (!matchName && !matchEmail && !matchPhone) return false;
                            }

                            return true;
                          });

                          if (filtered.length === 0) {
                            return (
                              <TableRow>
                                <TableCell colSpan={10} className="py-14 text-center">
                                  <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 shadow-xs">
                                      <Users size={22} />
                                    </div>
                                    <div className="space-y-1">
                                      <h4 className="text-sm font-bold text-slate-800">No user accounts found</h4>
                                      <p className="text-xs text-slate-500 leading-relaxed">
                                        {userSearchText.trim()
                                          ? `No records matching "${userSearchText}". Try checking for spelling errors or clearing your search.`
                                          : userCategoryTab === 'archived'
                                          ? "There are no archived accounts. Deleted or deactivated personnel will be listed here."
                                          : "No user accounts registered under this category yet."}
                                      </p>
                                    </div>
                                    {userSearchText.trim() && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setUserSearchText('')}
                                        className="text-xs h-8 px-3 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                                      >
                                        Clear Search Filter
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          }

                          return filtered.map((u, idx) => (
                            <TableRow key={`user-${u.id}-${u.email}-${idx}`} className={`text-xs hover:bg-slate-50/80 transition-colors ${u.status === 'Archived' ? 'bg-rose-50/30 opacity-80' : ''}`}>
                              <TableCell className="font-mono text-slate-400 font-bold">#{u.id}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <div
                                    onClick={() => handleOpenUserProfile(u)}
                                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-xs border overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-400 hover:scale-105 transition-all ${
                                      u.role === 'superadmin' ? 'bg-violet-100 text-violet-700 border-violet-200' :
                                      u.role === 'admin' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                                      u.role === 'nurse' ? 'bg-teal-100 text-teal-700 border-teal-200' :
                                      u.role === 'bhw' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                      u.role === 'staff' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                      'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                    title="Click to view full user profile & dossier"
                                  >
                                    {u.profile_photo ? (
                                      <img src={u.profile_photo} alt={u.name} className="w-full h-full object-cover" />
                                    ) : (
                                      u.name ? u.name.charAt(0).toUpperCase() : 'U'
                                    )}
                                  </div>
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenUserProfile(u)}
                                      className="font-bold text-slate-900 hover:text-indigo-600 transition-colors text-left block cursor-pointer"
                                      title="Click to view full user profile & dossier"
                                    >
                                      {u.name}
                                    </button>
                                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                      {u.employee_id && (
                                        <span className="text-[9px] bg-slate-100 text-slate-700 font-mono px-1.5 py-0.2 rounded font-bold border border-slate-200">
                                          {u.employee_id}
                                        </span>
                                      )}
                                      {u.job_title && (
                                        <span className="text-[10px] text-slate-500 font-medium">
                                          {u.job_title}
                                        </span>
                                      )}
                                      {u.role === 'superadmin' && <span className="text-[10px] text-violet-600 font-medium">City Administrator</span>}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-slate-600">{u.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={
                                  u.role === 'superadmin' ? 'border-violet-300 text-violet-700 bg-violet-50 font-bold text-[10px]' :
                                  u.role === 'admin' ? 'border-indigo-300 text-indigo-700 bg-indigo-50 font-bold text-[10px]' :
                                  u.role === 'nurse' ? 'border-teal-300 text-teal-700 bg-teal-50 font-bold text-[10px]' :
                                  u.role === 'bhw' ? 'border-emerald-300 text-emerald-700 bg-emerald-50 font-bold text-[10px]' :
                                  u.role === 'staff' ? 'border-blue-300 text-blue-700 bg-blue-50 font-bold text-[10px]' :
                                  'border-slate-300 text-slate-700 bg-slate-50 font-semibold text-[10px]'
                                }>
                                  {u.role === 'superadmin' ? 'SUPER ADMIN' : u.role === 'admin' ? 'BARANGAY ADMIN' : u.role === 'nurse' ? 'HEALTH NURSE' : u.role === 'bhw' ? 'BHW WORKER' : u.role === 'staff' ? 'STAFF / CLERK' : 'RESIDENT'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg text-[11px] border border-slate-200/60">
                                  <MapPin size={11} className="text-indigo-600 shrink-0" />
                                  {u.barangay || 'Pianing'}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-slate-600">
                                {u.phone && !u.phone.includes('@') ? u.phone : '—'}
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  (u as any).verification_status === 'Verified' ? 'bg-emerald-600 text-white text-[10px] font-bold' :
                                  (u as any).verification_status === 'Rejected' ? 'bg-red-100 text-red-700 border border-red-300 text-[10px]' :
                                  (u as any).verification_status === 'Pending_Review' || (u as any).verification_status === 'Unverified' ? 'bg-amber-100 text-amber-800 border border-amber-300 text-[10px]' :
                                  'bg-emerald-600 text-white text-[10px] font-bold'
                                }>
                                  {(u as any).verification_status === 'Pending_Review' || (u as any).verification_status === 'Unverified' ? 'Pending' : (u as any).verification_status || 'Verified'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-[11px] font-mono text-slate-500">
                                  {(u as any).last_login && (u as any).last_login !== 'Never'
                                    ? new Date((u as any).last_login).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                    : 'Never'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <button
                                  onClick={() => (isSuperAdmin || user?.role === 'admin') && handleToggleUserStatus(u)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                                    u.status === 'Active'
                                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                      : u.status === 'Archived'
                                      ? 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'
                                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                  }`}
                                  title="Click to toggle Active / Inactive status"
                                >
                                  <span className={`w-2 h-2 rounded-full ${
                                    u.status === 'Active' ? 'bg-emerald-500 animate-pulse' :
                                    u.status === 'Archived' ? 'bg-violet-500' : 'bg-amber-500'
                                  }`} />
                                  {u.status || 'Active'}
                                </button>
                              </TableCell>
                              <TableCell className="text-right pr-4 py-2.5 whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                                  {/* View Profile Button */}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleOpenUserProfile(u)}
                                    className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 cursor-pointer text-[11px] font-semibold gap-1 rounded-lg border border-indigo-100"
                                    title="View full user profile & credentials"
                                  >
                                    <Eye size={12} />
                                    <span className="hidden sm:inline">Profile</span>
                                  </Button>

                                  {/* Permissions Button for Super Admin */}
                                  {isSuperAdmin && u.role !== 'resident' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleOpenPermissions(u)}
                                      className="h-7 px-2 text-purple-700 hover:text-purple-900 hover:bg-purple-100/70 border border-purple-200 cursor-pointer text-[11px] font-semibold gap-1 rounded-lg transition-all"
                                      title={`Configure form and module permissions for ${u.name}`}
                                    >
                                      <Sliders size={12} className="text-purple-600" />
                                      <span className="hidden sm:inline">Permissions</span>
                                    </Button>
                                  )}

                                  {/* Edit User Button */}
                                  {(isSuperAdmin || (user?.role === 'admin' && (u.role === 'staff' || u.role === 'bhw'))) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleOpenEditUser(u)}
                                      className="h-7 px-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer text-[11px] gap-1 rounded-lg"
                                      title="Edit user details"
                                    >
                                      <Edit3 size={12} />
                                      <span className="hidden xl:inline">Edit</span>
                                    </Button>
                                  )}



                                  {/* Activate / Deactivate Button */}
                                  {(isSuperAdmin || (user?.role === 'admin' && (u.role === 'staff' || u.role === 'bhw'))) && (
                                    u.status === 'Active' ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeactivateUser(u)}
                                        className="h-7 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-100/60 cursor-pointer text-[11px] font-semibold gap-1 rounded-lg"
                                        title="Deactivate account (disable login)"
                                      >
                                        <UserX size={12} />
                                        Deactivate
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleActivateUser(u)}
                                        className="h-7 px-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60 cursor-pointer text-[11px] font-semibold gap-1 rounded-lg"
                                        title="Activate account (enable login)"
                                      >
                                        <UserCheck size={12} />
                                        Activate
                                      </Button>
                                    )
                                  )}

                                  {/* Archive / Restore Button */}
                                  {(isSuperAdmin || (user?.role === 'admin' && u.role !== 'superadmin')) ? (
                                    u.status === 'Archived' ? (
                                      <Button
                                        size="sm"
                                        variant={userCategoryTab === 'archived' ? 'default' : 'ghost'}
                                        onClick={() => handleArchiveUser(u)}
                                        className={userCategoryTab === 'archived'
                                          ? 'h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer text-[11px] font-bold gap-1.5 shadow-xs rounded-lg'
                                          : 'h-7 px-2 text-indigo-600 hover:bg-indigo-50 cursor-pointer text-[11px] font-semibold gap-1 rounded-lg'}
                                        title="Restore user account to Active"
                                      >
                                        <RotateCcw size={12} />
                                        Restore Account
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          if (confirm(`Move ${u.name} (${u.email}) to Archived? Login access will be disabled and the record will be preserved.`)) {
                                            handleArchiveUser(u);
                                          }
                                        }}
                                        className="h-7 px-2 text-rose-600 hover:bg-rose-50 cursor-pointer text-[11px] font-semibold gap-1 rounded-lg"
                                        title="Archive user account"
                                      >
                                        <Archive size={12} />
                                        Archive
                                      </Button>
                                    )
                                  ) : (
                                    <span className="text-slate-300 text-[10px] italic pr-1">Protected</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* EDIT USER MODAL */}
              <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
                <DialogContent className="bg-white max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-900">
                      <Edit3 className="text-indigo-600" size={18} />
                      Edit User Account Details
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Update official profile, role permissions, and barangay assignments.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveEditUser} className="space-y-3 py-2">
                    <div>
                      <Label className="text-xs font-semibold">Full Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={editUserName}
                        onChange={e => setEditUserName(e.target.value)}
                        required
                        className="h-9 text-xs"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Email Address <span className="text-red-500">*</span></Label>
                      <Input
                        type="email"
                        value={editUserEmail}
                        onChange={e => setEditUserEmail(e.target.value)}
                        required
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs font-semibold">System Role</Label>
                        <Select
                          value={editUserRole}
                          onValueChange={(val: 'superadmin' | 'admin' | 'staff' | 'bhw' | 'resident') => setEditUserRole(val)}
                        >
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {isSuperAdmin && (
                              <>
                                <SelectItem value="superadmin">Super Admin</SelectItem>
                                <SelectItem value="admin">Barangay Admin</SelectItem>
                              </>
                            )}
                            <SelectItem value="staff">Barangay Staff / Clerk</SelectItem>
                            <SelectItem value="bhw">BHW (Health Worker)</SelectItem>
                            <SelectItem value="nurse">Nurse (Health Center Nurse)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Account Status</Label>
                        <Select
                          value={editUserStatus}
                          onValueChange={(val: 'Active' | 'Inactive' | 'Archived') => setEditUserStatus(val)}
                        >
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive (Deactivated)</SelectItem>
                            <SelectItem value="Archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs font-semibold">Assigned Barangay</Label>
                        {isSuperAdmin || user?.role === 'superadmin' ? (
                          <>
                            <Input
                              list="edit-user-barangay-datalist"
                              value={editUserBarangay}
                              onChange={e => setEditUserBarangay(e.target.value)}
                              placeholder="Type Barangay (e.g. Pianing)"
                              className="h-9 text-xs bg-white"
                            />
                            <datalist id="edit-user-barangay-datalist">
                              {availableBarangays.map(b => (
                                <option key={b} value={b}>Barangay {b}</option>
                              ))}
                            </datalist>
                          </>
                        ) : (
                          <Input
                            value={editUserBarangay || user?.barangay || 'Pianing'}
                            onChange={e => setEditUserBarangay(e.target.value)}
                            placeholder="e.g. Pianing"
                            className="h-9 text-xs bg-white"
                          />
                        )}
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Contact Number <span className="text-red-500">*</span></Label>
                        <Input
                          value={editUserPhone}
                          onChange={e => setEditUserPhone(e.target.value.replace(/[^0-9+]/g, '').slice(0, 13))}
                          placeholder="09XXXXXXXXX"
                          required
                          inputMode="tel"
                          className="h-9 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Password Change Section */}
                    <div className="border border-slate-200 rounded-xl p-3 space-y-3 bg-slate-50">
                      <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        🔐 Change Password (Optional)
                      </p>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Current Password <span className="text-red-500">*</span></Label>
                        <p className="text-[10px] text-slate-400 mb-1">Required to verify identity before changing password</p>
                        <div className="relative">
                          <Input
                            type={showEditUserCurrentPass ? "text" : "password"}
                            value={editUserCurrentPassword}
                            onChange={e => setEditUserCurrentPassword(e.target.value)}
                            placeholder="Enter current password to authorize change"
                            className="h-9 text-xs font-mono pr-8 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowEditUserCurrentPass(!showEditUserCurrentPass)}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            tabIndex={-1}
                          >
                            {showEditUserCurrentPass ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">New Password</Label>
                        <div className="relative mt-1">
                          <Input
                            type={showEditUserPass ? "text" : "password"}
                            value={editUserPassword}
                            onChange={e => setEditUserPassword(e.target.value)}
                            placeholder="Leave blank to keep current password"
                            className="h-9 text-xs font-mono pr-8 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowEditUserPass(!showEditUserPass)}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            tabIndex={-1}
                          >
                            {showEditUserPass ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">8+ chars, uppercase, number &amp; special symbol required</p>
                      </div>
                      {editUserPassword && (
                        <div>
                          <Label className="text-xs font-semibold text-slate-700">Confirm New Password <span className="text-red-500">*</span></Label>
                          <div className="relative mt-1">
                            <Input
                              type={showEditUserConfirmPass ? "text" : "password"}
                              value={editUserConfirmPassword}
                              onChange={e => setEditUserConfirmPassword(e.target.value)}
                              placeholder="Re-enter new password to confirm"
                              className="h-9 text-xs font-mono pr-8 bg-white"
                              required={!!editUserPassword}
                            />
                            <button
                              type="button"
                              onClick={() => setShowEditUserConfirmPass(!showEditUserConfirmPass)}
                              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showEditUserConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Need to override user password directly?</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (editingUser) {
                              const target = editingUser;
                              setIsEditUserOpen(false);
                              handleOpenResetPassword(target);
                            }
                          }}
                          className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-50 cursor-pointer gap-1 font-medium"
                        >
                          <Key size={12} className="text-amber-600" />
                          Reset Password
                        </Button>
                      </div>
                    </div>

                    <DialogFooter className="pt-3">
                      <Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)} className="text-xs">
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* RESET PASSWORD MODAL */}
              <Dialog open={isResetPassOpen} onOpenChange={setIsResetPassOpen}>
                <DialogContent className="bg-white max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-900">
                      <Key className="text-amber-600" size={18} />
                      Reset User Password
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Set a new temporary or permanent password for <strong>{resetPassUser?.name}</strong> ({resetPassUser?.email}).
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleExecuteResetPassword} className="space-y-3 py-2">
                    <div>
                      <Label className="text-xs font-semibold">New Password <span className="text-red-500">*</span></Label>
                      <Input
                        type="password"
                        value={newPassVal}
                        onChange={e => setNewPassVal(e.target.value)}
                        required
                        placeholder="Enter new password"
                        className="h-9 text-xs font-mono mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Confirm New Password <span className="text-red-500">*</span></Label>
                      <Input
                        type="password"
                        value={newPassConfirmVal}
                        onChange={e => setNewPassConfirmVal(e.target.value)}
                        required
                        placeholder="Re-enter new password"
                        className="h-9 text-xs font-mono mt-1"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Must meet complexity requirements: 6+ characters with uppercase, lowercase, number, and special character.
                    </p>
                    <DialogFooter className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsResetPassOpen(false);
                          setNewPassVal('');
                          setNewPassConfirmVal('');
                        }}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                        Reset Password
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* TAB: RESIDENT MANAGEMENT — DEDICATED CITIZEN ACCOUNTS & VERIFICATION DESK */}
          {activeTab === 'residents' && (
            <div className="space-y-6">
              {/* Executive Header Banner - Clean Soft White Card */}
              <div className="bg-white text-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl shrink-0">
                      <Users size={26} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                          Barangay {user?.barangay || 'Pianing'} — Resident Management Desk
                        </h2>
                        <Badge className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] uppercase font-bold tracking-wider">
                          Constituent Registry
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 max-w-2xl mt-1 leading-relaxed">
                        Official directory of registered citizens and household inhabitants in Barangay {user?.barangay || 'Pianing'}. Review verification documents, view 360° demographic profiles, and track residency status.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <Button
                      size="sm"
                      onClick={handleExportResidentsCsv}
                      variant="outline"
                      className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs gap-1.5 cursor-pointer h-9 px-3 rounded-xl transition-all"
                    >
                      <Download size={14} />
                      Export Residents (CSV)
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setResAccBarangay(user?.barangay || 'Pianing');
                        setResAccCensusMatch(null);
                        setResAccLinkedCensusId(null);
                        setResAccCensusSearch('');
                        setResAccFirstName('');
                        setResAccMiddleName('');
                        setResAccLastName('');
                        setResAccDOB('');
                        setResAccGender('');
                        setResAccCivilStatus('');
                        setResAccEmployment('');
                        setResAccResidencyYears('');
                        setResAccPurok('');
                        setResAccHouseholdNum('');
                        setResAccIdType('');
                        setResAccIdPhoto(null);
                        setResAccIdFileName('');
                        setResAccEmail('');
                        setResAccPassword('');
                        setResAccConfirmPassword('');
                        setResAccShowPassword(false);
                        setResAccShowConfirmPassword(false);
                        setResAccPhone('');
                        setIsCreateResidentUserOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 font-semibold h-9 px-3 rounded-xl shadow-xs cursor-pointer"
                    >
                      <UserPlus size={14} />
                      Create Resident Account
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleManualRefresh}
                      disabled={isRefreshing || loading}
                      variant="outline"
                      className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs gap-1.5 cursor-pointer h-9 px-3 rounded-xl transition-all"
                    >
                      <RefreshCcw size={13} className={isRefreshing || loading ? "animate-spin text-blue-600" : ""} />
                      <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                    </Button>
                  </div>
                </div>

                {/* KPI Summary Metric Counters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[11px] text-slate-500 font-medium">Registered Residents</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{barangayResidents.length}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[11px] text-emerald-700 font-medium">Verified Residents</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-0.5">{verifiedAccountsCount}</p>
                  </div>
                </div>
              </div>

              {/* Action Bar: Purok Select & Search only */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-1.5">
                  <Users size={15} className="text-blue-600 shrink-0" />
                  <span className="text-sm font-bold text-slate-800">All Residents</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-mono font-bold text-slate-600">
                    {barangayResidents.length}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                  {/* Purok Filter Dropdown */}
                  <select
                    value={residentPurokFilter}
                    onChange={e => setResidentPurokFilter(e.target.value)}
                    className="h-8.5 text-xs px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white cursor-pointer"
                  >
                    <option value="all">All Puroks (1 to 6)</option>
                    {[1, 2, 3, 4, 5, 6].map(p => (
                      <option key={p} value={`Purok ${p}`}>Purok {p}</option>
                    ))}
                  </select>

                  {/* Search Bar */}
                  <div className="relative flex-1 sm:w-56">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search resident name, phone..."
                      value={residentSearch}
                      onChange={e => setResidentSearch(e.target.value)}
                      className="pl-9 pr-7 h-8.5 text-xs bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                    />
                    {residentSearch && (
                      <button
                        type="button"
                        onClick={() => setResidentSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title="Clear search"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Resident Accounts Table */}
              <Card className="border-slate-200/80 bg-white shadow-xs rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 border-b border-slate-200">
                          <TableHead className="text-xs font-bold text-slate-700 w-16">ID</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Resident Name</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Contact Number</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Purok / Address</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Gender / Status</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700">Verification</TableHead>
                          <TableHead className="text-xs font-bold text-slate-700 text-right pr-4">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const resList = barangayResidents.filter(r => {
                            // 1. Status tab filter
                            const isVer = r.verification_status === 'Verified' || (r as any).status === 'Verified';
                            if (residentStatusTab === 'verified' && !isVer) return false;
                            if (residentStatusTab === 'unverified' && isVer) return false;

                            // 2. Purok filter — normalize: "Purok 3" → "3", match against r.purok or r.address
                            if (residentPurokFilter !== 'all') {
                              const filterDigit = residentPurokFilter.replace(/purok\s*/i, '').trim();
                              const resPurok = (r.purok || '').toLowerCase().replace(/purok\s*/i, '').trim();
                              const addrPurokMatch = (r.address || '').match(/purok\s*([0-9]+)/i);
                              const addrPurok = addrPurokMatch ? addrPurokMatch[1] : '';
                              if (resPurok !== filterDigit && addrPurok !== filterDigit && !resPurok.startsWith(filterDigit)) return false;
                            }

                            // 3. Search filter
                            if (residentSearch.trim()) {
                              const q = residentSearch.toLowerCase();
                              const name = `${r.first_name || ''} ${r.last_name || ''} ${(r as any).name || ''}`.toLowerCase();
                              const phone = (r.phone || (r as any).contact_number || '').toLowerCase();
                              const email = (r.email || '').toLowerCase();
                              const addr = (r.address || r.purok || '').toLowerCase();
                              if (!name.includes(q) && !phone.includes(q) && !email.includes(q) && !addr.includes(q)) {
                                return false;
                              }
                            }

                            return true;
                          });

                          if (resList.length === 0) {
                            return (
                              <TableRow>
                                <TableCell colSpan={7} className="py-14 text-center">
                                  <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                                      <Users size={22} />
                                    </div>
                                    <div className="space-y-1">
                                      <h4 className="text-sm font-bold text-slate-800">No resident records found</h4>
                                      <p className="text-xs text-slate-500 leading-relaxed">
                                        {residentSearch.trim()
                                          ? `No resident matches "${residentSearch}". Check spelling or clear filters.`
                                          : "No residents found under the selected status/purok filter."}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          }

                          return resList.map((res) => {
                            const isVerified = res.verification_status === 'Verified' || (res as any).status === 'Verified';
                            const fullName = `${res.first_name || ''} ${res.last_name || ''}`.trim() || (res as any).name || 'Resident';

                            return (
                              <TableRow key={res.id} className="text-xs hover:bg-slate-50/70 transition-colors">
                                <TableCell className="font-mono text-slate-500 font-bold">#{res.id}</TableCell>
                                <TableCell className="cursor-pointer" onClick={() => openResidentProfile(res.id)}>
                                  <div className="font-bold text-slate-900 hover:text-indigo-600 hover:underline transition-colors">{fullName}</div>
                                  <div className="text-[11px] text-slate-400">{res.email || 'No email registered'}</div>
                                </TableCell>
                                <TableCell className="font-mono text-slate-600">
                                  {res.phone || (res as any).contact_number || '—'}
                                </TableCell>
                                <TableCell>
                                  <span className="font-medium text-slate-800">{res.purok || 'Purok —'}</span>
                                  <span className="text-[11px] text-slate-400 block truncate max-w-xs">{res.address || `Brgy. ${user?.barangay || 'Pianing'}`}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-slate-700">{res.gender || '—'}</span>
                                  <span className="text-slate-400 block text-[11px]">{res.civil_status || 'Single'}</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className={`text-[10px] font-bold border-0 ${isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {isVerified ? '✓ Verified' : '⏳ Unverified'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-4">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openResidentProfile(res.id)}
                                      className="h-7 px-2.5 text-[11px] gap-1 border-slate-200 hover:bg-blue-50 hover:text-blue-700 cursor-pointer rounded-lg font-semibold"
                                      title="Open full constituent profile"
                                    >
                                      <User size={12} />
                                      User Info
                                    </Button>
                                    {!isVerified ? (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => handleToggleResidentVerification(res)}
                                          className="h-7 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer rounded-lg font-semibold shadow-xs"
                                          title="Approve and verify citizen account"
                                        >
                                          <CheckCircle2 size={12} />
                                          Verify
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            const applicantMatch = myPendingResidents.find(p => p.id === res.id) || (res as any);
                                            openApplicantReview(applicantMatch);
                                          }}
                                          className="h-7 px-2.5 text-[11px] gap-1 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer rounded-lg font-semibold shadow-xs"
                                          title="Review government ID and applicant details"
                                        >
                                          <Eye size={12} />
                                          Review ID
                                        </Button>
                                      </>
                                    ) : (
                                      isSuperAdmin && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleToggleResidentVerification(res)}
                                          className="h-7 px-2 text-[11px] text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer rounded-lg font-medium"
                                          title="Revoke verification status"
                                        >
                                          Unverify
                                        </Button>
                                      )
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}



          {/* TAB 5: SYSTEM REPORTS */}
          {activeTab === 'reports' && (() => {
            const targetResidents = isSuperMegaAdmin ? residents : barangayResidents;
            const targetDocs = isSuperMegaAdmin ? documents : barangayDocs;

            return (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {isSuperMegaAdmin ? 'City-Wide System & Administrative Reports' : `Barangay ${userBarangay || 'Pianing'} Administrative Reports`}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isSuperMegaAdmin
                      ? 'Consolidated city-wide analytics, resident registry, and database export center across all Butuan City barangays.'
                      : `Official Barangay ${userBarangay || 'Pianing'}, Butuan City analytics, population registry, and report export center.`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => {
                      downloadOfficialPdf({
                        title: isSuperMegaAdmin ? 'City-Wide Clearance Requests Log' : `Barangay ${userBarangay || 'Pianing'} Clearance Requests Log`,
                        subtitle: `All clearance & certificate requests — Generated ${new Date().toLocaleDateString()}`,
                        filename: `Barangay_${(userBarangay || 'Pianing').replace(/\s+/g, '_')}_Clearance_Requests_${new Date().toISOString().slice(0, 10)}`,
                        barangay: userBarangay || 'Pianing',
                        preparedBy: user?.name || 'Administrator',
                        preparedByTitle: user?.role === 'superadmin' ? 'Super Administrator' : user?.role === 'staff' ? 'Barangay Staff' : 'Barangay Administrator',
                        stats: [
                          { label: 'Total Requests', value: targetDocs.length },
                          { label: 'Completed', value: targetDocs.filter(d => d.status === 'Completed').length },
                          { label: 'Pending', value: targetDocs.filter(d => d.status === 'Pending').length }
                        ],
                        tables: [{
                          title: 'Document Clearance Requests',
                          headers: ['Code', 'Resident', 'Document Type', 'Purpose', 'Status', 'Date'],
                          rows: targetDocs.map(d => [d.request_code || '', d.resident_name || '', d.document_type || '', d.purpose || '', d.status || '', d.requested_at || 'Recent'])
                        }]
                      });
                      toast.success('Clearance log PDF downloaded');
                    }}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-slate-300"
                  >
                    <Download size={13} /> Download Clearances (PDF)
                  </Button>

                  <Button
                    onClick={() => {
                      downloadOfficialPdf({
                        title: isSuperMegaAdmin ? 'City-Wide Resident Demographic Registry' : `Barangay ${userBarangay || 'Pianing'} Resident Demographic Registry`,
                        subtitle: `${isSuperMegaAdmin ? 'All Butuan City Barangays' : `Barangay ${userBarangay || 'Pianing'}`} resident census — Generated ${new Date().toLocaleDateString()}`,
                        filename: `Barangay_${(userBarangay || 'Pianing').replace(/\s+/g, '_')}_Resident_Demographics_${new Date().toISOString().slice(0, 10)}`,
                        barangay: userBarangay || 'Pianing',
                        preparedBy: user?.name || 'Administrator',
                        preparedByTitle: user?.role === 'superadmin' ? 'Super Administrator' : user?.role === 'staff' ? 'Barangay Staff' : 'Barangay Administrator',
                        stats: [
                          { label: 'Total Residents', value: targetResidents.length }
                        ],
                        tables: [{
                          title: 'Resident Demographics',
                          headers: ['ID', 'First Name', 'Last Name', 'Gender', 'Address', 'Phone', 'Email'],
                          colWidths: [5, 12, 15, 8, 25, 15, 20],
                          rows: targetResidents.map(r => [r.id, r.first_name, r.last_name, r.gender, r.address, r.phone || 'N/A', r.email || 'N/A'])
                        }]
                      });
                      toast.success('Resident registry PDF downloaded');
                    }}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-slate-300"
                  >
                    <Download size={13} /> Download Residents (PDF)
                  </Button>
                  <Button
                    onClick={() => {
                      printOfficialReport({
                        title: isSuperMegaAdmin ? 'City-Wide System & Administrative Report' : `Barangay ${userBarangay || 'Pianing'} Administrative Report`,
                        subtitle: `Barangay ${userBarangay || 'Pianing'}, Butuan City, Agusan del Norte • Administrative Operations & Registry`,
                        department: 'Office of the Barangay Captain • Administrative Division',
                        preparedBy: user?.name || 'Admin Juan Dela Cruz',
                        preparedByTitle: user?.role === 'superadmin' ? 'Super Administrator' : user?.role === 'staff' ? 'Barangay Staff / Clerk' : 'Barangay Administrator',
                        stats: [
                          { label: 'Total Residents', value: targetResidents.length, color: '#2563eb' },
                          { label: 'Clearance Requests', value: targetDocs.length, color: '#4f46e5' },
                          { label: 'Completed Clearances', value: targetDocs.filter(d => d.status === 'Completed').length, color: '#059669' },
                          { label: 'Pending Approvals', value: myPendingResidents.length, color: '#d97706' }
                        ],
                        tables: [
                          {
                            title: 'Recent Document Clearances & Certification Issuances',
                            headers: ['Control Code', 'Resident Applicant', 'Document Type', 'Status', 'Date'],
                            rows: targetDocs.slice(0, 10).map(d => [
                              d.request_code,
                              d.resident_name,
                              d.document_type,
                              d.status,
                              d.requested_at || 'Recent'
                            ])
                          },
                          {
                            title: 'Barangay Resident Demographic Sample',
                            headers: ['Resident ID', 'Full Name', 'Gender', 'Purok / Address', 'Contact'],
                            rows: targetResidents.slice(0, 10).map(r => [
                              `#${r.id}`,
                              `${r.first_name} ${r.last_name}`,
                              r.gender,
                              r.address,
                              r.phone || 'N/A'
                            ])
                          }
                        ]
                      });
                    }}
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-semibold"
                  >
                    <Printer size={13} /> Print Official System Report
                  </Button>
                </div>
              </div>

              {/* ═══ LIVE ROLE-BASED ANALYTICS (SUPER ADMIN & BARANGAY ADMIN) ═══ */}
              <div className="space-y-5">
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-indigo-900/40 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                        <BarChart className="text-indigo-400" size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">
                            {isSuperMegaAdmin ? 'City-Wide Municipal Analytics & Master Oversight' : `Barangay ${userBarangay || 'Pianing'} Administrative Intelligence`}
                          </h3>
                          <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {isSuperMegaAdmin ? 'Super Mega Administrator Scope' : isSuperAdmin ? 'Barangay Captain Scope' : 'Barangay Administrator Scope'}
                          </span>
                        </div>
                        <p className="text-xs text-indigo-200/80 mt-0.5">
                          {isSuperMegaAdmin
                            ? 'Consolidated operational metrics across all 86 Butuan City barangays, municipal clearance throughput, staff distribution, and audit activity.'
                            : `Real-time demographic indicators, clearance issuance pipeline, resident verification velocity, and civil census registry for Barangay ${userBarangay || 'Pianing'}.`}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-800/40">
                      Live Synchronized
                    </span>
                  </div>
                </div>

                {/* KPI Matrix Row */}
                {(() => {
                  const targetResidents = isSuperAdmin
                    ? residents
                    : residents.filter(r => (r.barangay || '').toLowerCase().includes((userBarangay || '').toLowerCase()));
                  const targetDocs = isSuperAdmin
                    ? documents
                    : documents.filter(d => (d.barangay || '').toLowerCase().includes((userBarangay || '').toLowerCase()));

                  const totalPop = targetResidents.length;
                  const maleCount = targetResidents.filter(r => r.gender === 'Male').length;
                  const femaleCount = targetResidents.filter(r => r.gender === 'Female').length;
                  const seniorCount = targetResidents.filter(r => {
                    if (!r.date_of_birth) return false;
                    const age = Math.floor((Date.now() - new Date(r.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                    return age >= 60;
                  }).length;
                  const minorCount = targetResidents.filter(r => {
                    if (!r.date_of_birth) return false;
                    const age = Math.floor((Date.now() - new Date(r.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                    return age < 18;
                  }).length;

                  const totalClearances = targetDocs.length;
                  const completedClearances = targetDocs.filter(d => d.status === 'Completed').length;
                  const pendingClearances = targetDocs.filter(d => d.status === 'Pending').length;
                  const inProgressClearances = targetDocs.filter(d => d.status === 'Processing' || d.status === 'Ready for Pickup').length;
                  const completionRate = totalClearances > 0 ? Math.round((completedClearances / totalClearances) * 100) : 100;

                  const verifiedResidents = targetResidents.filter(r => r.verification_status === 'Verified').length;
                  const pendingVerifications = targetResidents.filter(r => r.verification_status === 'Pending' || !r.verification_status).length;
                  const verificationRate = totalPop > 0 ? Math.round((verifiedResidents / totalPop) * 100) : 0;

                  const activeUsers = users.length;
                  const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'superadmin').length;
                  const clinicalStaff = users.filter(u => u.role === 'nurse' || u.role === 'bhw').length;

                  return (
                    <>
                      {/* Top Metric Cards */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-600">
                              {isSuperAdmin ? 'Total City Population' : 'Barangay Population'}
                            </span>
                            <Users size={16} className="text-blue-600" />
                          </div>
                          <p className="text-3xl font-extrabold text-slate-900">{totalPop}</p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span>M: <strong className="text-blue-700">{maleCount}</strong></span>
                            <span>•</span>
                            <span>F: <strong className="text-pink-700">{femaleCount}</strong></span>
                            <span>•</span>
                            <span>Seniors: <strong className="text-amber-700">{seniorCount}</strong></span>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-600">Clearances Issued</span>
                            <FileText size={16} className="text-emerald-600" />
                          </div>
                          <p className="text-3xl font-extrabold text-slate-900">{completedClearances}</p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span className="text-emerald-700 font-bold">{completionRate}% fulfillment</span>
                            <span>•</span>
                            <span>{pendingClearances} pending</span>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-600">
                              {isSuperAdmin ? 'Staff Directory' : 'Citizen Verification'}
                            </span>
                            {isSuperAdmin ? <UserCheck size={16} className="text-purple-600" /> : <ShieldCheck size={16} className="text-indigo-600" />}
                          </div>
                          <p className="text-3xl font-extrabold text-slate-900">
                            {isSuperAdmin ? activeUsers : `${verificationRate}%`}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            {isSuperAdmin ? (
                              <span>{adminUsers} Admins • {clinicalStaff} Healthcare Staff</span>
                            ) : (
                              <span>{verifiedResidents} Verified • {pendingVerifications} Pending</span>
                            )}
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-600">
                              {isSuperAdmin ? 'Security Audit Events' : 'Civil Households'}
                            </span>
                            <Activity size={16} className="text-amber-600" />
                          </div>
                          <p className="text-3xl font-extrabold text-slate-900">
                            {isSuperAdmin ? activityLogs.length : (censusStats?.total_households ?? censusHouseholds.length)}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            {isSuperAdmin ? (
                              <span className="text-emerald-700 font-semibold">100% Audit Logging Active</span>
                            ) : (
                              <span>{censusStats?.total_families ?? censusHouseholds.length} Families registered</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Visual Breakdown Grid */}
                      {(() => {
                        const clearanceTypes = [
                          { label: 'Barangay Clearance', key: 'barangay clearance', color: '#3B82F6' },
                          { label: 'Certificate of Indigency', key: 'indigency', color: '#10B981' },
                          { label: 'Certificate of Residency', key: 'residency', color: '#6366F1' },
                          { label: 'Business Clearance / Permit', key: 'business', color: '#F59E0B' },
                          { label: 'First Time Jobseeker Assistance', key: 'jobseeker', color: '#8B5CF6' },
                        ];

                        const clearanceChartData = clearanceTypes.map(item => {
                          const count = targetDocs.filter(d => (d.document_type || '').toLowerCase().includes(item.key)).length;
                          return {
                            name: item.label,
                            value: count,
                            color: item.color,
                          };
                        });
                        const hasClearanceData = clearanceChartData.some(d => d.value > 0);

                        const purokChartData = ['1', '2', '3', '4', '5', '6', '7', '8'].map(pNum => {
                          const count = targetResidents.filter(r => (r.purok || '').replace(/purok\s*/i, '').trim() === pNum).length;
                          const pct = targetResidents.length > 0 ? Math.round((count / targetResidents.length) * 100) : 0;
                          return {
                            purok: `Purok ${pNum}`,
                            shortPurok: `P${pNum}`,
                            count,
                            pct,
                          };
                        });

                        const municipalChartData = (() => {
                          const countsMap: Record<string, number> = {};
                          residents.forEach(r => {
                            const b = (r.barangay || 'Pianing').replace(/^Barangay\s+/i, '').trim();
                            if (b) {
                              countsMap[b] = (countsMap[b] || 0) + 1;
                            }
                          });

                          // Ensure known client and key Butuan barangays exist
                          ['Pianing', 'Libertad', 'Ampayon', 'Doongan', 'Villa Kananga', 'Baan Riverside'].forEach(b => {
                            if (countsMap[b] === undefined) countsMap[b] = 0;
                          });

                          const totalR = residents.length;
                          const colors = ['#4F46E5', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#475569'];

                          return Object.entries(countsMap)
                            .map(([name, count]) => ({
                              name,
                              count,
                              pct: totalR > 0 ? Math.round((count / totalR) * 100) : 0,
                              color: '#4F46E5'
                            }))
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 8)
                            .map((item, idx) => ({
                              ...item,
                              color: colors[idx % colors.length]
                            }));
                        })();

                        return (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Left: Document Clearances Breakdown — Donut Chart */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                              <div>
                                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                                  <span className="flex items-center gap-2">
                                    <FileText size={16} className="text-indigo-600" />
                                    Clearance Requests by Document Type
                                  </span>
                                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                                    {totalClearances} Total
                                  </span>
                                </h4>

                                {!hasClearanceData ? (
                                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center">
                                    <FileText size={32} className="mb-2 opacity-40" />
                                    <p className="text-xs">No clearance requests recorded yet</p>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center my-2">
                                    {/* Donut Chart with Center Total */}
                                    <div className="sm:col-span-5 relative flex items-center justify-center" style={{ height: 180 }}>
                                      <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                          <RechartsTooltip
                                            content={({ active, payload }) => {
                                              if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                const pct = totalClearances > 0 ? ((data.value / totalClearances) * 100).toFixed(1) : '0.0';
                                                return (
                                                  <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-lg text-xs">
                                                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                                      {data.name}
                                                    </div>
                                                    <div className="text-slate-500 mt-1">
                                                      <span className="font-extrabold text-slate-900">{data.value}</span> requests ({pct}%)
                                                    </div>
                                                  </div>
                                                );
                                              }
                                              return null;
                                            }}
                                          />
                                          <Pie
                                            data={clearanceChartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={46}
                                            outerRadius={72}
                                            paddingAngle={3}
                                            dataKey="value"
                                            stroke="#ffffff"
                                            strokeWidth={2}
                                          >
                                            {clearanceChartData.map((entry) => (
                                              <Cell key={`clearance-cell-${entry.name}`} fill={entry.color} />
                                            ))}
                                          </Pie>
                                        </PieChart>
                                      </ResponsiveContainer>
                                      {/* Donut Hole Center Badge */}
                                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-xl font-black text-slate-900 leading-none">{totalClearances}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total</span>
                                      </div>
                                    </div>

                                    {/* Color-coded Breakdown List */}
                                    <div className="sm:col-span-7 space-y-1.5">
                                      {clearanceChartData.map(item => {
                                        const pct = totalClearances > 0 ? Math.round((item.value / totalClearances) * 100) : 0;
                                        return (
                                          <div key={item.name} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: item.color }} />
                                              <span className="text-slate-700 font-medium truncate">{item.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <span className="font-bold text-slate-900">{item.value}</span>
                                              <span className="text-slate-400 text-[11px] min-w-[34px] text-right">({pct}%)</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Status Pipeline Pills */}
                              <div className="grid grid-cols-4 gap-2 pt-3 mt-3 border-t border-slate-100 text-center">
                                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                                  <span className="text-[10px] text-emerald-700 font-bold block uppercase">Completed</span>
                                  <span className="text-sm font-extrabold text-emerald-800">{completedClearances}</span>
                                </div>
                                <div className="p-2 bg-blue-50 rounded-xl border border-blue-200">
                                  <span className="text-[10px] text-blue-700 font-bold block uppercase">In Progress</span>
                                  <span className="text-sm font-extrabold text-blue-800">{inProgressClearances}</span>
                                </div>
                                <div className="p-2 bg-amber-50 rounded-xl border border-amber-200">
                                  <span className="text-[10px] text-amber-700 font-bold block uppercase">Pending</span>
                                  <span className="text-sm font-extrabold text-amber-800">{pendingClearances}</span>
                                </div>
                                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                                  <span className="text-[10px] text-slate-600 font-bold block uppercase">Avg Turnaround</span>
                                  <span className="text-sm font-extrabold text-slate-800">15 min</span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Role-Specific Distribution — Standard Bar Chart */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                                <div>
                                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                      <MapPin size={16} className="text-blue-600" />
                                      Purok Population Density — Brgy. {userBarangay}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                                      {targetResidents.length} Inhabitants
                                    </span>
                                  </h4>

                                  <div style={{ width: '100%', height: 180 }} className="my-2 overflow-hidden">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <RechartsBarChart
                                        data={purokChartData}
                                        margin={{ top: 12, right: 15, left: 10, bottom: 0 }}
                                      >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                        <XAxis
                                          dataKey="shortPurok"
                                          stroke="#94A3B8"
                                          fontSize={11}
                                          tickLine={false}
                                          axisLine={{ stroke: '#E2E8F0' }}
                                        />
                                        <YAxis
                                          stroke="#94A3B8"
                                          fontSize={11}
                                          tickLine={false}
                                          axisLine={{ stroke: '#E2E8F0' }}
                                          allowDecimals={false}
                                          width={34}
                                        />
                                        <RechartsTooltip
                                          cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                                          content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                              const data = payload[0].payload;
                                              return (
                                                <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-lg text-xs">
                                                  <p className="font-bold text-slate-900">{data.purok}</p>
                                                  <p className="text-slate-500 mt-0.5">
                                                    <span className="font-extrabold text-blue-600">{data.count}</span> residents ({data.pct}%)
                                                  </p>
                                                </div>
                                              );
                                            }
                                            return null;
                                          }}
                                        />
                                        <RechartsBar dataKey="count" fill="#2563EB" radius={[5, 5, 0, 0]} barSize={22}>
                                          {purokChartData.map((entry, idx) => (
                                            <Cell key={`purok-bar-${idx}`} fill={entry.count > 0 ? (idx % 2 === 0 ? '#2563EB' : '#3B82F6') : '#E2E8F0'} />
                                          ))}
                                        </RechartsBar>
                                      </RechartsBarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-slate-100 text-xs">
                                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                    <span className="text-slate-500 text-[11px] block font-medium">Senior Citizens (60+)</span>
                                    <span className="font-extrabold text-slate-900 text-sm">{seniorCount} <span className="text-slate-400 font-normal text-xs">({totalPop > 0 ? Math.round((seniorCount / totalPop) * 100) : 0}%)</span></span>
                                  </div>
                                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                    <span className="text-slate-500 text-[11px] block font-medium">Children / Minors (0-17)</span>
                                    <span className="font-extrabold text-slate-900 text-sm">{minorCount} <span className="text-slate-400 font-normal text-xs">({totalPop > 0 ? Math.round((minorCount / totalPop) * 100) : 0}%)</span></span>
                                  </div>
                                </div>
                              </div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
              </div>

              {/* Data Export Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-indigo-200 bg-indigo-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      <FolderOpen size={16} className="text-indigo-600" />
                      Resident Registry Dataset
                    </CardTitle>
                    <CardDescription className="text-[11px] text-indigo-700">Demographic census & resident records</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-slate-600 mb-3">Total registered residents: <strong>{residents.length}</strong> in database.</p>
                    <Button
                      onClick={() => {
                        downloadOfficialPdf({
                          title: 'Resident Census Report',
                          subtitle: `Full demographic census — ${new Date().toLocaleDateString()}`,
                          filename: `Resident_Census_Report_${new Date().toISOString().slice(0, 10)}`,
                          preparedBy: user?.name || 'Administrator',
                          preparedByTitle: user?.role === 'superadmin' ? 'Super Administrator' : 'Barangay Administrator',
                          stats: [{ label: 'Total Residents', value: residents.length }],
                          tables: [{
                            title: 'Full Resident Census',
                            headers: ['ID', 'Full Name', 'Gender', 'Address', 'Phone'],
                            rows: residents.map(r => [r.id, `${r.first_name} ${r.last_name}`, r.gender, r.address, r.phone || 'N/A'])
                          }]
                        });
                        toast.success('Resident census PDF downloaded');
                      }}
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-7 text-indigo-700 border-indigo-300 hover:bg-indigo-100"
                    >
                      <Download size={12} className="mr-1" /> Download Full Census (PDF)
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <FileText size={16} className="text-emerald-600" />
                      Document Clearances Log
                    </CardTitle>
                    <CardDescription className="text-[11px] text-emerald-700">Clearances, permits & certificate requests</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-slate-600 mb-3">Total processed requests: <strong>{documents.length}</strong> documents.</p>
                    <Button
                      onClick={() => {
                        downloadOfficialPdf({
                          title: 'Document Clearances Master List',
                          subtitle: `All clearance & certificate issuances — ${new Date().toLocaleDateString()}`,
                          filename: `Document_Clearances_Master_${new Date().toISOString().slice(0, 10)}`,
                          preparedBy: user?.name || 'Administrator',
                          preparedByTitle: user?.role === 'superadmin' ? 'Super Administrator' : 'Barangay Administrator',
                          stats: [
                            { label: 'Total', value: documents.length },
                            { label: 'Completed', value: documents.filter(d => d.status === 'Completed').length }
                          ],
                          tables: [{
                            title: 'Clearance Requests Master',
                            headers: ['Code', 'Applicant', 'Document Type', 'Purpose', 'Status', 'Processed By'],
                            rows: documents.map(d => [d.request_code || '', d.resident_name || '', d.document_type || '', d.purpose || '', d.status || '', d.processed_by || 'Pending'])
                          }]
                        });
                        toast.success('Clearances master PDF downloaded');
                      }}
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-7 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                    >
                      <Download size={12} className="mr-1" /> Download Clearances (PDF)
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Users size={16} className="text-blue-600" />
                      System User Accounts
                    </CardTitle>
                    <CardDescription className="text-[11px] text-blue-700">Administrator, BHW & staff account list</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-slate-600 mb-3">Active authorized accounts: <strong>{users.length}</strong> users.</p>
                    <Button
                      onClick={() => {
                        downloadOfficialPdf({
                          title: 'System User Accounts Directory',
                          subtitle: `All authorized staff, BHW & admin accounts — ${new Date().toLocaleDateString()}`,
                          filename: `System_User_Accounts_${new Date().toISOString().slice(0, 10)}`,
                          preparedBy: user?.name || 'Administrator',
                          preparedByTitle: user?.role === 'superadmin' ? 'Super Administrator' : 'Barangay Administrator',
                          stats: [
                            { label: 'Total Accounts', value: users.length },
                            { label: 'Active', value: users.filter(u => u.status === 'Active').length }
                          ],
                          tables: [{
                            title: 'System User Accounts',
                            headers: ['ID', 'Full Name', 'Email', 'Role', 'Barangay', 'Status', 'Last Login'],
                            rows: users.map(u => [u.id, u.name, u.email, u.role.toUpperCase(), u.barangay || 'Pianing', u.status, (u as any).last_login ? new Date((u as any).last_login).toLocaleDateString() : 'Never'])
                          }]
                        });
                        toast.success('User accounts PDF downloaded');
                      }}
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-7 text-blue-700 border-blue-300 hover:bg-blue-100"
                    >
                      <Download size={12} className="mr-1" /> Download User Accounts (PDF)
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-slate-200 bg-white">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FolderOpen className="text-indigo-600" size={18} />
                      Database Records Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Total Resident Demographics</span>
                      <span className="font-bold font-mono text-indigo-600">{residents.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Total Document Clearance Requests</span>
                      <span className="font-bold font-mono text-indigo-600">{documents.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Completed Clearances</span>
                      <span className="font-bold font-mono text-emerald-600">{documents.filter(d => d.status === 'Completed').length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span>System User Accounts</span>
                      <span className="font-bold font-mono text-blue-600">{users.length}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Activity className="text-emerald-600" size={18} />
                      Health & Administrative Status Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <h4 className="font-bold text-xs text-emerald-900">Service Performance</h4>
                      <p className="text-[11px] text-emerald-700 mt-1">Average document processing turn-around time: 15 minutes.</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <h4 className="font-bold text-xs text-blue-900">Barangay Pianing Database Driver Health</h4>
                      <p className="text-[11px] text-blue-700 mt-1">Active MySQL2 connection pool with automatic error recovery.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            );
          })()}

          {/* TAB 8: CATEGORY MANAGER (SUPER ADMIN FREEDOM & DELEGABLE ACCESS) */}
          {activeTab === 'categories' && (isSuperAdmin || hasUserPermission(user, 'can_manage_categories')) && (() => {
            const availableDepartments = ['all', ...Array.from(new Set(categories.map(c => c.department || 'Barangay')))];

            // Filter categories based on department, status, and search query
            const filteredCategories = categories.filter(cat => {
              if (categoryDeptFilter !== 'all' && (cat.department || 'Barangay') !== categoryDeptFilter) return false;
              if (categoryStatusFilter !== 'all' && cat.status !== categoryStatusFilter) return false;
              if (categorySearch.trim()) {
                const q = categorySearch.toLowerCase().trim();
                const matchName = cat.name.toLowerCase().includes(q);
                const matchDesc = (cat.description || '').toLowerCase().includes(q);
                const matchDept = (cat.department || '').toLowerCase().includes(q);
                const matchId = String(cat.id || '').includes(q);
                if (!matchName && !matchDesc && !matchDept && !matchId) return false;
              }
              return true;
            });

            // Department-scoped categories for metric cards
            const currentDeptCategories = categoryDeptFilter === 'all'
              ? categories
              : categories.filter(c => (c.department || 'Barangay') === categoryDeptFilter);
            const totalCount = currentDeptCategories.length;
            const activeCount = currentDeptCategories.filter(c => c.status === 'Active').length;
            const inactiveCount = currentDeptCategories.filter(c => c.status === 'Inactive').length;

            return (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-purple-300">
                        {isSuperAdmin ? 'SUPER ADMIN UNRESTRICTED' : 'DELEGATED ACCESS'}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">Service &amp; Clearance Architecture</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      Document &amp; Service Category Manager
                    </h2>
                    <p className="text-xs text-slate-500">
                      Super Admin has full authority over all service categories across any department or jurisdiction. Create, activate, deactivate, or filter services in real time.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        setNewCategoryName('');
                        setNewCategoryDesc('');
                        setNewCategoryDept('Barangay');
                        setIsAddCategoryOpen(true);
                      }}
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-xs"
                    >
                      <PlusCircle size={14} /> Add Category
                    </Button>
                    <Button
                      onClick={() => loadData()}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 border-slate-300 cursor-pointer"
                    >
                      <RefreshCcw size={13} className={loading ? "animate-spin" : ""} /> Refresh Status
                    </Button>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card className="border-purple-200 bg-purple-50/50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-purple-700 uppercase">
                          Total Services {categoryDeptFilter !== 'all' ? `(${categoryDeptFilter})` : ''}
                        </p>
                        <p className="text-2xl font-bold text-purple-900">{totalCount}</p>
                      </div>
                      <Tag size={28} className="text-purple-500 opacity-60" />
                    </CardContent>
                  </Card>

                  <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-emerald-700 uppercase">Active Categories</p>
                        <p className="text-2xl font-bold text-emerald-900">{activeCount}</p>
                      </div>
                      <CheckCircle size={28} className="text-emerald-500 opacity-60" />
                    </CardContent>
                  </Card>

                  <Card className="border-rose-200 bg-rose-50/50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-rose-700 uppercase">Deactivated Categories</p>
                        <p className="text-2xl font-bold text-rose-900">{inactiveCount}</p>
                      </div>
                      <AlertTriangle size={28} className="text-rose-500 opacity-60" />
                    </CardContent>
                  </Card>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  {/* Status Pills */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
                    <button
                      onClick={() => setCategoryStatusFilter('all')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        categoryStatusFilter === 'all'
                          ? 'bg-white text-purple-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Statuses ({totalCount})
                    </button>
                    <button
                      onClick={() => setCategoryStatusFilter('Active')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        categoryStatusFilter === 'Active'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Active Only ({activeCount})
                    </button>
                    <button
                      onClick={() => setCategoryStatusFilter('Inactive')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        categoryStatusFilter === 'Inactive'
                          ? 'bg-white text-rose-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Deactivated Only ({inactiveCount})
                    </button>
                  </div>

                  {/* Department & Real-Time Search */}
                  <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                    <div className="w-40 sm:w-48">
                      <Select value={categoryDeptFilter} onValueChange={setCategoryDeptFilter}>
                        <SelectTrigger className="h-8 text-xs bg-white border-slate-200">
                          <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          {availableDepartments.filter(d => d !== 'all').map(d => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="relative flex-1 sm:w-60">
                      <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                      <Input
                        value={categorySearch}
                        onChange={e => setCategorySearch(e.target.value)}
                        placeholder="Search category, ID, purpose..."
                        className="h-8 text-xs pl-8 pr-7 bg-white border-slate-200"
                      />
                      {categorySearch && (
                        <button
                          onClick={() => setCategorySearch('')}
                          className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {(categorySearch || categoryStatusFilter !== 'all' || categoryDeptFilter !== 'all') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCategorySearch('');
                          setCategoryStatusFilter('all');
                          setCategoryDeptFilter('all');
                        }}
                        className="h-8 text-xs px-2.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>

                {/* Categories Table */}
                <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
                  <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Tag className="text-purple-600" size={18} />
                        Service &amp; Clearance Categories Directory
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {isSuperAdmin
                          ? 'Super Admin master catalog: Configure document rules across all departments and local governments.'
                          : 'Manage document types authorized for your department.'}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[11px] font-mono font-semibold bg-purple-50 text-purple-700 border-purple-200">
                      Showing {filteredCategories.length} of {totalCount} categories
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 text-xs">
                          <TableHead className="font-bold">Service Category Name</TableHead>
                          <TableHead className="font-bold">Department / Portal</TableHead>
                          <TableHead className="font-bold">Description / Purpose</TableHead>
                          <TableHead className="font-bold text-center">Status</TableHead>
                          <TableHead className="font-bold text-right">Quick Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCategories.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-12 text-center text-slate-500">
                              <div className="flex flex-col items-center justify-center space-y-2">
                                <Tag size={32} className="text-slate-300" />
                                <p className="text-sm font-bold text-slate-700">No categories match your filter</p>
                                <p className="text-xs text-slate-400">Try changing your search keywords, status filter, or department selection.</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setCategorySearch('');
                                    setCategoryStatusFilter('all');
                                    setCategoryDeptFilter('all');
                                  }}
                                  className="h-8 text-xs cursor-pointer mt-2"
                                >
                                  Reset All Filters
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCategories.map((cat, idx) => {
                            const isActive = cat.status === 'Active';
                            return (
                              <TableRow key={`cat-${cat.id || idx}-${cat.name}`} className="text-xs hover:bg-slate-50/80">
                                <TableCell className="font-semibold text-slate-900 flex items-center gap-2 py-3">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    isActive ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-500'
                                  }`}>
                                    <FileText size={14} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-xs">{cat.name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">ID: #{cat.id || idx + 1}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-[10px] font-semibold ${
                                    cat.department === 'Health Center'
                                      ? 'bg-teal-50 text-teal-700 border-teal-300'
                                      : 'bg-indigo-50 text-indigo-700 border-indigo-300'
                                  }`}>
                                    {cat.department || 'Barangay'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-slate-600 max-w-xs truncate text-[11px]">
                                  {cat.description || 'Standard public service & document issuance.'}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                    isActive
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                    {isActive ? 'Active' : 'Deactivated'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {isActive ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleToggleCategoryStatus(cat.name, cat.status)}
                                        className="h-7 px-2.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 cursor-pointer text-[11px] font-semibold gap-1"
                                        title="Deactivate service"
                                      >
                                        <UserX size={12} />
                                        Deactivate
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleToggleCategoryStatus(cat.name, cat.status)}
                                        className="h-7 px-2.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer text-[11px] font-semibold gap-1"
                                        title="Activate service"
                                      >
                                        <CheckCircle size={12} />
                                        Activate
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteCategory(cat)}
                                      className="h-7 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer text-[11px]"
                                      title={`Delete category '${cat.name}'`}
                                    >
                                      <Trash2 size={13} />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Add Category Modal with Super Admin Freedom */}
                <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
                  <DialogContent className="bg-white max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Tag className="text-purple-600" size={18} />
                        Add Document Clearance Category
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500">
                        {isSuperAdmin
                          ? 'Super Admin Freedom: Create document categories across any department or municipal jurisdiction.'
                          : 'Add a new official document clearance category.'}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateCategory} className="space-y-4 py-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Document / Category Name <span className="text-red-500">*</span></Label>
                        <Input
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          placeholder="e.g. Certificate of Low Income"
                          required
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Department / Service Area <span className="text-red-500">*</span></Label>
                        <Select value={newCategoryDept} onValueChange={setNewCategoryDept}>
                          <SelectTrigger className="h-9 text-xs bg-white">
                            <SelectValue placeholder="Select Department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Barangay">Barangay</SelectItem>
                            <SelectItem value="Health">Health</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Description / Purpose</Label>
                        <Textarea
                          value={newCategoryDesc}
                          onChange={e => setNewCategoryDesc(e.target.value)}
                          placeholder="e.g. Certificate for educational, medical, utility subsidies and local financial assistance"
                          rows={3}
                          className="text-xs"
                        />
                      </div>
                      <DialogFooter className="gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAddCategoryOpen(false)}
                          className="text-xs cursor-pointer"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isCreatingCategory}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5 cursor-pointer shadow-xs"
                        >
                          {isCreatingCategory ? <RefreshCcw size={13} className="animate-spin" /> : <PlusCircle size={13} />}
                          <span>Save Category</span>
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            );
          })()}

          {/* TAB: AUDIT TRAIL & ACTIVITY HISTORY LOGS (Superadmin: Barangay-scoped / Delegated staff access) */}
          {activeTab === 'logs' && (isSuperAdmin || hasUserPermission(user, 'can_view_logs')) && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                      isSuperAdmin 
                        ? 'bg-purple-100 text-purple-800 border-purple-300' 
                        : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                    }`}>
                      {isSuperAdmin ? 'SUPER ADMIN & ADMIN AUDIT' : 'BARANGAY AUDIT TRAIL'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">Live Activity Stream</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {isSuperAdmin ? `History Logs — Barangay ${userBarangay}` : 'Activity History Logs'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Comprehensive chronological record of staff actions, certificate issuances, resident verifications, and security events.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => loadLogs(true)}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-slate-300 cursor-pointer"
                  >
                    <RefreshCcw size={13} className={logsLoading ? "animate-spin" : ""} /> Refresh Logs
                  </Button>
                  <Button
                    onClick={handlePrintAuditReport}
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                  >
                    <Printer size={13} /> Print Official Audit Report
                  </Button>
                </div>
              </div>

              {/* Metric Stat Cards */}
              {(() => {
                const scopedLogs = activityLogs.filter(log => {
                  // Strictly scoped to their own barangay only
                  if (userBarangay) {
                    if (!log.barangay || !log.barangay.toLowerCase().includes(userBarangay.toLowerCase())) return false;
                  }
                  return true;
                });
                const docEventsCount = scopedLogs.filter(l => l.action_type === 'Document').length;
                const residentEventsCount = scopedLogs.filter(l => l.action_type === 'Resident').length;
                const systemSecurityCount = scopedLogs.filter(l => ['Category', 'User', 'Security', 'System'].includes(l.action_type || '')).length;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card className="border-indigo-200 bg-indigo-50/40">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-indigo-700 uppercase">Total Logged Events</p>
                          <p className="text-2xl font-bold text-indigo-950">{scopedLogs.length}</p>
                          <p className="text-[10px] text-indigo-600 mt-0.5">Across recorded history</p>
                        </div>
                        <History size={26} className="text-indigo-500 opacity-60" />
                      </CardContent>
                    </Card>

                    <Card className="border-blue-200 bg-blue-50/40">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-blue-700 uppercase">Document Transactions</p>
                          <p className="text-2xl font-bold text-blue-950">{docEventsCount}</p>
                          <p className="text-[10px] text-blue-600 mt-0.5">Certificates & Clearances</p>
                        </div>
                        <FileText size={26} className="text-blue-500 opacity-60" />
                      </CardContent>
                    </Card>

                    <Card className="border-emerald-200 bg-emerald-50/40">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-emerald-700 uppercase">Resident Verifications</p>
                          <p className="text-2xl font-bold text-emerald-950">{residentEventsCount}</p>
                          <p className="text-[10px] text-emerald-600 mt-0.5">Approvals & Rejections</p>
                        </div>
                        <UserCheck size={26} className="text-emerald-500 opacity-60" />
                      </CardContent>
                    </Card>

                    <Card className="border-purple-200 bg-purple-50/40">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-purple-700 uppercase">Security &amp; System</p>
                          <p className="text-2xl font-bold text-purple-950">{systemSecurityCount}</p>
                          <p className="text-[10px] text-purple-600 mt-0.5">Categories, Logins &amp; Users</p>
                        </div>
                        <ShieldCheck size={26} className="text-purple-500 opacity-60" />
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              {/* Filters & Search Control Bar */}
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                    {/* Search Bar */}
                    <div className="relative w-full md:w-80">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                      <Input
                        placeholder="Search actor, action, details..."
                        value={logSearch}
                        onChange={e => setLogSearch(e.target.value)}
                        className="pl-8 h-9 text-xs"
                      />
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                      {/* Action Type Filter */}
                      <Select value={logActionTypeFilter} onValueChange={setLogActionTypeFilter}>
                        <SelectTrigger className="h-9 text-xs w-36">
                          <SelectValue placeholder="Action Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Event Types</SelectItem>
                          <SelectItem value="Document">📄 Document</SelectItem>
                          <SelectItem value="Resident">👤 Resident</SelectItem>
                          <SelectItem value="Category">⚙️ Category</SelectItem>
                          <SelectItem value="User">👥 User Account</SelectItem>
                          <SelectItem value="Health">🏥 Health</SelectItem>
                          <SelectItem value="Security">🛡️ Security</SelectItem>
                          <SelectItem value="System">🔔 System</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* User Role Filter */}
                      <Select value={logRoleFilter} onValueChange={setLogRoleFilter}>
                        <SelectTrigger className="h-9 text-xs w-32">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Roles</SelectItem>
                          <SelectItem value="superadmin">Super Admin</SelectItem>
                          <SelectItem value="admin">Barangay Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="bhw">BHW</SelectItem>
                          <SelectItem value="resident">Resident</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Scoped Barangay Indicator */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <MapPin size={13} className="text-indigo-600 shrink-0" />
                        <span>Barangay {userBarangay}</span>
                      </div>

                      {(logSearch || logActionTypeFilter !== 'All' || logRoleFilter !== 'All') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLogSearch('');
                            setLogActionTypeFilter('All');
                            setLogRoleFilter('All');
                          }}
                          className="h-9 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 cursor-pointer"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Logs Table */}
              <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row justify-between items-center">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <History className="text-indigo-600" size={18} />
                      Activity &amp; Operational Audit Trail
                    </CardTitle>
                    <CardDescription className="text-xs">
                      All administrative transactions are immutably logged with timestamp and user attribution.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {(() => {
                      const displayed = activityLogs.filter(log => {
                        if (userBarangay && (!log.barangay || !log.barangay.toLowerCase().includes(userBarangay.toLowerCase()))) return false;
                        if (logActionTypeFilter !== 'All' && (log.action_type || 'General') !== logActionTypeFilter) return false;
                        if (logRoleFilter !== 'All' && log.user_role?.toLowerCase() !== logRoleFilter.toLowerCase()) return false;
                        if (logSearch.trim()) {
                          const q = logSearch.toLowerCase();
                          const match = log.user_name?.toLowerCase().includes(q) || log.action?.toLowerCase().includes(q) || log.details?.toLowerCase().includes(q);
                          if (!match) return false;
                        }
                        return true;
                      });
                      return `${displayed.length} Events Showing`;
                    })()}
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                     <div className="overflow-x-auto">
                    <Table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '190px' }} />
                        <col />
                        <col style={{ width: '115px' }} />
                        <col style={{ width: '125px' }} />
                        <col style={{ width: '155px' }} />
                      </colgroup>
                      <TableHeader>
                        <TableRow className="bg-slate-50 text-xs border-b border-slate-200">
                          <TableHead className="font-bold text-slate-700 text-left px-3 py-3 w-[190px]">Actor / User</TableHead>
                          <TableHead className="font-bold text-slate-700 text-left px-3 py-3">Event &amp; Action</TableHead>
                          <TableHead className="font-bold text-slate-700 text-center px-2 py-3 w-[115px]">Category</TableHead>
                          <TableHead className="font-bold text-slate-700 text-center px-2 py-3 w-[125px]">Barangay Scope</TableHead>
                          <TableHead className="font-bold text-slate-700 text-right px-3 py-3 w-[155px]">Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const displayedLogs = activityLogs.filter(log => {
                            if (userBarangay && (!log.barangay || !log.barangay.toLowerCase().includes(userBarangay.toLowerCase()))) return false;
                            if (logActionTypeFilter !== 'All' && (log.action_type || 'General') !== logActionTypeFilter) return false;
                            if (logRoleFilter !== 'All' && log.user_role?.toLowerCase() !== logRoleFilter.toLowerCase()) return false;
                            if (logSearch.trim()) {
                              const q = logSearch.toLowerCase();
                              const match = log.user_name?.toLowerCase().includes(q) || log.action?.toLowerCase().includes(q) || log.details?.toLowerCase().includes(q);
                              if (!match) return false;
                            }
                            return true;
                          });

                          if (displayedLogs.length === 0) {
                            return (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                                  <History size={36} className="mx-auto mb-2 opacity-30 text-indigo-400" />
                                  <p className="font-semibold text-sm text-slate-600">No activity logs found</p>
                                  <p className="text-xs text-slate-400 mt-1">Try clearing filters or search queries to see all logs.</p>
                                </TableCell>
                              </TableRow>
                            );
                          }

                          return displayedLogs.map((log, idx) => {
                            const role = (log.user_role || '').toLowerCase();
                            const actionType = log.action_type || 'General';

                            // Role badge styling
                            const roleBadgeColor = 
                              role === 'superadmin' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                              role === 'admin' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                              role === 'staff' ? 'bg-sky-100 text-sky-800 border-sky-300' :
                              role === 'bhw' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                              'bg-slate-100 text-slate-800 border-slate-300';

                            // Action badge styling
                            const actionBadgeColor =
                              actionType === 'Document' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              actionType === 'Resident' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              actionType === 'Category' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              actionType === 'User' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              actionType === 'Health' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                              actionType === 'Security' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-slate-100 text-slate-700 border-slate-200';

                            return (
                              <TableRow key={`log-${log.id || idx}`} className="text-xs hover:bg-slate-50/80 transition-colors">
                                {/* Actor */}
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                      role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                                      role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                                      role === 'bhw' ? 'bg-emerald-100 text-emerald-700' :
                                      role === 'staff' ? 'bg-sky-100 text-sky-700' :
                                      'bg-slate-200 text-slate-700'
                                    }`}>
                                      {log.user_name ? log.user_name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900">{log.user_name || 'System Actor'}</p>
                                      <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold border ${roleBadgeColor}`}>
                                        {log.user_role ? log.user_role.toUpperCase() : 'USER'}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Action & Details */}
                                <TableCell className="max-w-md py-3 pr-4 break-words">
                                  <p className="font-bold text-slate-900 leading-snug">{log.action}</p>
                                  {log.details && (
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed break-words">{log.details}</p>
                                  )}
                                </TableCell>

                                {/* Category */}
                                <TableCell className="text-center py-3">
                                  <Badge variant="outline" className={`text-[10px] font-semibold ${actionBadgeColor}`}>
                                    {actionType}
                                  </Badge>
                                </TableCell>

                                {/* Scope */}
                                <TableCell className="text-center py-3">
                                  <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {log.barangay || 'Pianing'}
                                  </span>
                                </TableCell>

                                {/* Timestamp */}
                                <TableCell className="text-right py-3 whitespace-nowrap text-slate-500 text-[11px]">
                                  <div className="flex items-center justify-end gap-1 font-mono">
                                    <Clock size={11} className="text-slate-400" />
                                    <span>{log.timestamp}</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB: 86-BARANGAY MUNICIPAL COMMAND HUB (Super Admin Only) */}
          {activeTab === 'barangays' && isSuperAdmin && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-100 text-indigo-800 border border-indigo-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                      MUNICIPAL REGISTRY
                    </span>
                    <span className="text-xs text-slate-500 font-mono">86 Administrative Jurisdictions</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    Butuan City Barangay Administration Hub
                  </h2>
                  <p className="text-xs text-slate-500">
                    Centralized municipal registry of all 86 Barangays in Butuan City, assigned local administrators, census population, and document activity.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const b = await apiService.getBarangaysOverview();
                        setBarangaysOverview(b || []);
                        toast.success('Barangay registry refreshed');
                      } catch {
                        toast.error('Failed to refresh barangay list');
                      }
                    }}
                    className="text-xs gap-1.5 h-8 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <RefreshCcw size={12} />
                    <span>Refresh Hub</span>
                  </Button>
                </div>
              </div>

              {/* Status KPI Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-slate-200 bg-white shadow-xs">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Total Barangays</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">86</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Butuan City, Agusan del Norte</p>
                    </div>
                    <Building2 size={28} className="text-blue-500 opacity-60" />
                  </CardContent>
                </Card>
                <Card className="border-slate-200 bg-white shadow-xs">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Active Staffed Barangays</p>
                      <p className="text-2xl font-black text-emerald-600 mt-1">
                        {barangaysOverview.filter(b => b.status === 'Active').length || 2}
                      </p>
                      <p className="text-[10px] text-emerald-600 mt-0.5">Assigned Barangay Administrators</p>
                    </div>
                    <CheckCircle size={28} className="text-emerald-500 opacity-60" />
                  </CardContent>
                </Card>
                <Card className="border-slate-200 bg-white shadow-xs">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Unstaffed / Standby</p>
                      <p className="text-2xl font-black text-slate-700 mt-1">
                        {Math.max(0, 86 - (barangaysOverview.filter(b => b.status === 'Active').length || 2))}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Ready for Administrator Assignment</p>
                    </div>
                    <ShieldAlert size={28} className="text-amber-500 opacity-60" />
                  </CardContent>
                </Card>
              </div>

              {/* Search & Filter Toolbar */}
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="relative w-full sm:w-80">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                      <Input
                        placeholder="Search barangay name, admin, or contact..."
                        value={barangaySearch}
                        onChange={e => setBarangaySearch(e.target.value)}
                        className="pl-8 h-9 text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <Button
                        size="sm"
                        variant={barangayStatusFilter === 'all' ? 'default' : 'outline'}
                        onClick={() => setBarangayStatusFilter('all')}
                        className={`text-xs h-8 cursor-pointer ${barangayStatusFilter === 'all' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'text-slate-600'}`}
                      >
                        All (86)
                      </Button>
                      <Button
                        size="sm"
                        variant={barangayStatusFilter === 'active' ? 'default' : 'outline'}
                        onClick={() => setBarangayStatusFilter('active')}
                        className={`text-xs h-8 cursor-pointer ${barangayStatusFilter === 'active' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-slate-600'}`}
                      >
                        Staffed
                      </Button>
                      <Button
                        size="sm"
                        variant={barangayStatusFilter === 'unstaffed' ? 'default' : 'outline'}
                        onClick={() => setBarangayStatusFilter('unstaffed')}
                        className={`text-xs h-8 cursor-pointer ${barangayStatusFilter === 'unstaffed' ? 'bg-slate-800 hover:bg-slate-900 text-white' : 'text-slate-600'}`}
                      >
                        Unstaffed
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Barangays Directory Table */}
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Building2 className="text-indigo-600" size={17} />
                    86 Butuan City Barangays Directory
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 text-xs">
                          <TableHead className="font-bold">Barangay Name</TableHead>
                          <TableHead className="font-bold">Status</TableHead>
                          <TableHead className="font-bold">Assigned Administrator</TableHead>
                          <TableHead className="font-bold text-center">Census Residents</TableHead>
                          <TableHead className="font-bold text-center">Pending Approvals</TableHead>
                          <TableHead className="font-bold text-center">Docs Issued</TableHead>
                          <TableHead className="font-bold">Official Hotline</TableHead>
                          <TableHead className="font-bold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const list = (barangaysOverview.length > 0 ? barangaysOverview : BUTUAN_BARANGAYS.map((bName, idx) => ({
                            id: idx + 1,
                            name: bName,
                            status: bName === 'Pianing' || bName === 'Anticala' ? 'Active' : 'Unstaffed' as any,
                            admin: bName === 'Pianing' ? { id: 2, name: 'Admin Juan Dela Cruz', email: 'admin@pianing.gov.ph', phone: '0917-123-4567' } : null,
                            total_residents: bName === 'Pianing' ? residents.length : 0,
                            pending_approvals: bName === 'Pianing' ? pendingResidents.length : 0,
                            total_documents: bName === 'Pianing' ? documents.length : 0,
                            office_address: `Barangay Hall, ${bName}, Butuan City`,
                            hotline: '0917-123-4567'
                          }))).filter(b => {
                            if (barangayStatusFilter === 'active' && b.status !== 'Active') return false;
                            if (barangayStatusFilter === 'unstaffed' && b.status === 'Active') return false;
                            if (barangaySearch.trim()) {
                              const q = barangaySearch.toLowerCase();
                              return b.name.toLowerCase().includes(q) || (b.admin?.name || '').toLowerCase().includes(q) || (b.admin?.email || '').toLowerCase().includes(q);
                            }
                            return true;
                          });

                          return list.map((item, bIdx) => (
                            <TableRow key={`b-row-${item.id}-${bIdx}`} className="text-xs hover:bg-slate-50/60">
                              <TableCell className="font-bold text-slate-900">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[10px] font-black text-indigo-700">
                                    {item.name.charAt(0)}
                                  </div>
                                  <span>{item.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                  item.status === 'Active'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {item.status === 'Active' ? 'Staffed' : 'Unstaffed'}
                                </span>
                              </TableCell>
                              <TableCell>
                                {item.admin ? (
                                  <div>
                                    <p className="font-semibold text-slate-800">{item.admin.name}</p>
                                    <p className="text-[11px] text-slate-400 font-mono">{item.admin.email}</p>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">No Admin Assigned</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center font-bold text-slate-800">
                                {item.total_residents}
                              </TableCell>
                              <TableCell className="text-center">
                                {item.pending_approvals > 0 ? (
                                  <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                    {item.pending_approvals}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center font-mono text-slate-600">
                                {item.total_documents}
                              </TableCell>
                              <TableCell className="text-slate-500 font-mono text-[11px]">
                                {item.hotline}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (item.admin) {
                                      toast.info(`Assigned Administrator: ${item.admin.name} (${item.admin.email})`);
                                    } else {
                                      setActiveTab('users');
                                      setNewUserRole('admin');
                                      setNewUserBarangay(item.name);
                                      setIsAddUserOpen(true);
                                      toast.info(`Assign an administrator for Barangay ${item.name}`);
                                    }
                                  }}
                                  className="h-7 text-[11px] gap-1 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  {item.admin ? 'Details' : 'Assign Admin'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB: SYSTEM DIAGNOSTICS & 1-CLICK DATABASE BACKUP (Super Admin Only) */}
          {activeTab === 'system' && isSuperAdmin && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-800 border border-purple-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                      MAINTENANCE &amp; DIAGNOSTICS
                    </span>
                    <span className="text-xs text-slate-500 font-mono">Full System Integrity</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    System Diagnostics &amp; 1-Click Database Backup
                  </h2>
                  <p className="text-xs text-slate-500">
                    Direct live MySQL database table health inspector, 1-click SQL/JSON backup exports, and maintenance mode controls.
                  </p>
                </div>

                {/* 1-Click Backup Export Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href="http://localhost:5000/api/system/database/backup?format=sql"
                    download="smart_db_backup.sql"
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-sm transition-colors"
                  >
                    <Download size={14} />
                    <span>Download .SQL Backup</span>
                  </a>
                  <a
                    href="http://localhost:5000/api/system/database/backup?format=json"
                    download="smart_db_backup.json"
                    className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-sm transition-colors"
                  >
                    <Download size={14} />
                    <span>Download JSON Snapshot</span>
                  </a>
                </div>
              </div>

              {/* Maintenance Mode & Gateways Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Maintenance Mode Controller */}
                <Card className="border-slate-200 bg-white shadow-xs lg:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sliders size={16} className="text-amber-600" />
                        <span>Maintenance Mode</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        maintenanceMode.enabled
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {maintenanceMode.enabled ? 'MAINTENANCE ACTIVE' : 'SYSTEM LIVE'}
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Lock resident portal during scheduled maintenance or database migrations.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Announcement Message</Label>
                      <Textarea
                        value={maintenanceMode.message}
                        onChange={e => setMaintenanceMode(prev => ({ ...prev, message: e.target.value }))}
                        placeholder="Maintenance notification shown to users..."
                        className="text-xs h-20"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={async () => {
                        const newStatus = !maintenanceMode.enabled;
                        try {
                          await apiService.toggleMaintenanceMode(newStatus, maintenanceMode.message);
                          setMaintenanceMode(prev => ({ ...prev, enabled: newStatus }));
                          toast.success(`Maintenance Mode is now ${newStatus ? 'ENABLED' : 'DISABLED'}`);
                        } catch {
                          toast.error('Failed to toggle maintenance mode');
                        }
                      }}
                      className={`w-full text-xs font-semibold h-8 cursor-pointer ${
                        maintenanceMode.enabled
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      }`}
                    >
                      {maintenanceMode.enabled ? 'Deactivate Maintenance (Resume Live)' : 'Activate Maintenance Mode'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Live Communication & Database Gateways */}
                <Card className="border-slate-200 bg-white shadow-xs lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Server size={16} className="text-indigo-600" />
                      Infrastructure &amp; Notification Gateways
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Active operational status of core external APIs and data persistence layer.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* MySQL Database Gateway */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">MySQL Database</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <p className="text-[11px] font-mono text-slate-600">Host: localhost:3306</p>
                        <p className="text-[11px] font-mono text-slate-600">Schema: smart_db</p>
                        <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.2 rounded">
                          Connected (Pool Active)
                        </span>
                      </div>

                      {/* iProg SMS Gateway */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">iProg SMS API</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">Provider: iProgTech Gateway</p>
                        <p className="text-[11px] font-mono text-slate-500">Latency: 24ms</p>
                        <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.2 rounded">
                          Live Sending Ready
                        </span>
                      </div>

                      {/* Gmail / EmailJS Gateway */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">Gmail / EmailJS</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">Service: service_6nk2ylj</p>
                        <p className="text-[11px] font-mono text-slate-500">SMTP: smtp.gmail.com</p>
                        <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.2 rounded">
                          Direct Dispatch Online
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 14 MySQL Relational Tables Health Grid */}
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Database size={16} className="text-purple-600" />
                      MySQL Schema Table Health &amp; Row Counts
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Live table integrity across all 14 relational data tables in smart_db.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const res = await apiService.getDatabaseStats().catch(() => null);
                      if (res?.tables) setDbStats(res.tables);
                      toast.success('Database table statistics refreshed');
                    }}
                    className="text-xs gap-1 h-8 border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <RefreshCcw size={12} />
                    <span>Refresh Stats</span>
                  </Button>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {(dbStats.length > 0 ? dbStats : [
                      { table: 'users', count: users.length, status: 'Healthy' },
                      { table: 'residents', count: residents.length, status: 'Healthy' },
                      { table: 'document_requests', count: documents.length, status: 'Healthy' },
                      { table: 'document_categories', count: categories.length, status: 'Healthy' },
                      { table: 'health_appointments', count: appointments.length, status: 'Healthy' },
                      { table: 'clinic_schedules', count: clinicSchedules.length, status: 'Healthy' },
                      { table: 'child_health_records', count: 12, status: 'Healthy' },
                      { table: 'maternal_records', count: 8, status: 'Healthy' },
                      { table: 'immunizations', count: 15, status: 'Healthy' },
                      { table: 'activity_logs', count: activityLogs.length, status: 'Healthy' },
                      { table: 'messages', count: 6, status: 'Healthy' },
                      { table: 'sms_notifications', count: 18, status: 'Healthy' },
                      { table: 'user_notifications', count: 24, status: 'Healthy' },
                      { table: 'faq_knowledge', count: 12, status: 'Healthy' },
                    ]).map((tableItem, tIdx) => (
                      <div
                        key={`table-health-${tIdx}`}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-800 truncate" title={tableItem.table}>
                            {tableItem.table}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        </div>
                        <div className="flex items-baseline justify-between pt-1">
                          <span className="text-lg font-extrabold text-slate-900 font-mono">
                            {tableItem.count.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">rows</span>
                        </div>
                        <span className="inline-block text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded font-semibold">
                          {tableItem.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}



          {/* Dedicated Profile Settings Tab View */}
          {activeTab === 'profile-settings' && (
            <ProfileSettingsView
              user={user}
              onProfileUpdated={(updated) => setUser(updated)}
            />
          )}

        </main>
      </div>

      {/* Intra-System Messenger (floating, Staff Chat) */}
      <SystemMessenger
        currentUserRole={user?.role === 'superadmin' ? 'superadmin' : user?.role === 'staff' ? 'staff' : 'admin'}
        currentUserName={user?.name || "Admin Juan Dela Cruz"}
        currentUserEmail={user?.email}
        currentUserId={user?.id}
        currentUserBarangay={user?.barangay || (user?.email?.toLowerCase().includes('anticala') ? 'Anticala' : user?.address?.toLowerCase().includes('anticala') ? 'Anticala' : (isSuperMegaAdmin ? 'All (City-Wide)' : 'Pianing'))}
      />

      {/* Resident 360° Profile Modal */}
      <ResidentProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        residentId={selectedResidentId}
        canVerify={isSuperAdmin || hasUserPermission(user, 'can_verify_residents')}
        onStatusUpdated={loadData}
        currentUserName={user?.name}
      />

      {/* Register Resident / Add Resident Modal */}
      <Dialog
        open={isAddResidentOpen}
        onOpenChange={(open) => {
          setIsAddResidentOpen(open);
          if (!open) {
            resetAddResidentForm();
          }
        }}
      >
        <DialogContent className="bg-white max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Register Resident / Household</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Add a citizen to the official Barangay {newResBarangay || user?.barangay || 'Pianing'} Population &amp; Household Census Registry.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateResident} className="space-y-4 py-2">
            {/* Step 1: Purok & Household Assignment */}
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Household &amp; Purok Assignment</span>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setAddResidentMode('new_household');
                      const cleanP = (newResPurok || '1').replace(/purok\s*/i, '').trim();
                      const existingInP = censusHouseholds.filter(h => 
                        (h.purok || '').replace(/purok\s*/i, '').trim() === cleanP || 
                        (h.household_number || '').includes(`HH-P${cleanP}`)
                      );
                      setNewResHouseholdNum(`HH-P${cleanP}-${String(existingInP.length + 1).padStart(3, '0')}`);
                      setNewResFamilyName('');
                      setHouseholdSearchQuery('');
                      setIsHouseholdDropdownOpen(false);
                      setNewResIsHead(true);
                      setNewResRelationship('Head');
                    }}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${addResidentMode === 'new_household' ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-200 text-slate-700'}`}
                  >
                    New Household
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddResidentMode('existing_household');
                      setNewResIsHead(false);
                      setNewResRelationship('Spouse');
                      const p = (newResPurok || '1').replace(/purok\s*/i, '').trim();
                      const hhInP = censusHouseholds.filter(h => 
                        (h.purok || '').replace(/purok\s*/i, '').trim() === p || 
                        (h.household_number || '').includes(`HH-P${p}`)
                      );
                      if (hhInP.length > 0) {
                        setNewResHouseholdNum(hhInP[0].household_number);
                        setNewResFamilyName(hhInP[0].family_name);
                        setHouseholdSearchQuery(`${hhInP[0].household_number} - ${hhInP[0].family_name} Family`);
                      } else {
                        setNewResHouseholdNum('');
                        setNewResFamilyName('');
                        setHouseholdSearchQuery('');
                      }
                      setIsHouseholdDropdownOpen(false);
                    }}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${addResidentMode === 'existing_household' ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-200 text-slate-700'}`}
                  >
                    Existing Household
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <Label className="text-xs font-semibold">Purok *</Label>
                  <Select
                    value={newResPurok}
                    onValueChange={(val) => {
                      setNewResPurok(val);
                      const cleanP = val.replace(/purok\s*/i, '').trim();
                      if (addResidentMode === 'new_household') {
                        const existingInP = censusHouseholds.filter(h => 
                          (h.purok || '').replace(/purok\s*/i, '').trim() === cleanP || 
                          (h.household_number || '').includes(`HH-P${cleanP}`)
                        );
                        setNewResHouseholdNum(`HH-P${cleanP}-${String(existingInP.length + 1).padStart(3, '0')}`);
                      } else {
                        const hhInP = censusHouseholds.filter(h => 
                          (h.purok || '').replace(/purok\s*/i, '').trim() === cleanP || 
                          (h.household_number || '').includes(`HH-P${cleanP}`)
                        );
                        if (hhInP.length > 0) {
                          setNewResHouseholdNum(hhInP[0].household_number);
                          setNewResFamilyName(hhInP[0].family_name);
                          setHouseholdSearchQuery(`${hhInP[0].household_number} - ${hhInP[0].family_name} Family`);
                        } else {
                          setNewResHouseholdNum('');
                          setNewResFamilyName('');
                          setHouseholdSearchQuery('');
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="text-xs bg-white"><SelectValue placeholder="Select Purok" /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map(p => (
                        <SelectItem key={`p-sel-${p}`} value={String(p)}>Purok {p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {addResidentMode === 'new_household' ? (
                  <>
                    <div>
                      <Label className="text-xs font-semibold">Household Number</Label>
                      <Input
                        value={newResHouseholdNum}
                        onChange={e => setNewResHouseholdNum(e.target.value)}
                        placeholder="e.g. HH-P1-001"
                        className="text-xs bg-white font-mono"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Family Name</Label>
                      <Input
                        value={newResFamilyName}
                        onChange={e => setNewResFamilyName(e.target.value)}
                        placeholder="e.g. Dela Cruz"
                        className="text-xs bg-white"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="sm:col-span-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-slate-800">Search &amp; Select Household *</Label>
                        {newResHouseholdNum && (
                          <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Selected: {newResHouseholdNum}
                          </span>
                        )}
                      </div>
                      
                      <div className="relative">
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                          <Input
                            value={householdSearchQuery}
                            onChange={(e) => {
                              setHouseholdSearchQuery(e.target.value);
                              setIsHouseholdDropdownOpen(true);
                            }}
                            onFocus={() => setIsHouseholdDropdownOpen(true)}
                            placeholder="Type family name, household #, or head of family..."
                            className="text-xs pl-8 pr-8 bg-white border-slate-300 focus:border-blue-500 rounded-lg"
                          />
                          {householdSearchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setHouseholdSearchQuery('');
                                setIsHouseholdDropdownOpen(false);
                              }}
                              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        {/* Searchable dropdown list */}
                        {isHouseholdDropdownOpen && (
                          <div className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
                            {filteredHouseholdsList.length > 0 ? (
                              filteredHouseholdsList.map(h => (
                                <button
                                  type="button"
                                  key={h.household_number}
                                  onClick={() => {
                                    setNewResHouseholdNum(h.household_number);
                                    setNewResFamilyName(h.family_name);
                                    const pClean = (h.purok || '').replace(/purok\s*/i, '').trim();
                                    if (pClean) setNewResPurok(pClean);
                                    setHouseholdSearchQuery(`${h.household_number} - ${h.family_name} Family`);
                                    setIsHouseholdDropdownOpen(false);
                                  }}
                                  className={`w-full text-left p-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between cursor-pointer ${
                                    newResHouseholdNum === h.household_number ? 'bg-blue-50 font-semibold' : ''
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-xs font-bold text-blue-700">{h.household_number}</span>
                                      <span className="text-xs font-medium text-slate-800">• {h.family_name} Family</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      Head: <span className="text-slate-700 font-medium">{h.head_name || 'Not Recorded'}</span> • Purok {h.purok} ({h.total_members || h.members?.length || 1} members)
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="text-[10px] text-slate-600 shrink-0 ml-2">
                                    Purok {h.purok}
                                  </Badge>
                                </button>
                              ))
                            ) : (
                              <div className="p-3 text-center text-xs text-slate-500">
                                No matching households found for &ldquo;{householdSearchQuery}&rdquo;.
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {newResHouseholdNum && (
                        <div className="p-2 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Home size={14} className="text-blue-600 shrink-0" />
                            <div>
                              <span className="font-mono font-bold text-blue-900">{newResHouseholdNum}</span>
                              <span className="text-slate-700 ml-1.5">({newResFamilyName || 'Family'} Family)</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            Assigned
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <Label className="text-xs font-semibold">Relationship to Household Head</Label>
                  <Select
                    value={newResRelationship}
                    onValueChange={(val) => {
                      setNewResRelationship(val);
                      // Auto-uncheck & disable head checkbox for dependent relations
                      const dependentRelations = ['Spouse', 'Son', 'Daughter', 'Parent', 'Grandparent', 'Grandson', 'Granddaughter', 'Relative', 'Other'];
                      if (dependentRelations.includes(val)) {
                        setNewResIsHead(false);
                      } else if (val === 'Head') {
                        setNewResIsHead(true);
                      }
                    }}
                  >
                    <SelectTrigger className="text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Head">Head of Family</SelectItem>
                      <SelectItem value="Spouse">Spouse</SelectItem>
                      <SelectItem value="Son">Son</SelectItem>
                      <SelectItem value="Daughter">Daughter</SelectItem>
                      <SelectItem value="Parent">Parent</SelectItem>
                      <SelectItem value="Grandparent">Grandparent</SelectItem>
                      <SelectItem value="Grandson">Grandson</SelectItem>
                      <SelectItem value="Granddaughter">Granddaughter</SelectItem>
                      <SelectItem value="Relative">Relative</SelectItem>
                      <SelectItem value="Other">Other / Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="is_head_checkbox"
                    checked={newResIsHead}
                    disabled={['Spouse', 'Son', 'Daughter', 'Parent', 'Grandparent', 'Grandson', 'Granddaughter', 'Relative', 'Other'].includes(newResRelationship)}
                    onChange={e => {
                      setNewResIsHead(e.target.checked);
                      if (e.target.checked) setNewResRelationship('Head');
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <label htmlFor="is_head_checkbox" className={`text-xs font-semibold cursor-pointer ${['Spouse', 'Son', 'Daughter', 'Parent', 'Grandparent', 'Grandson', 'Granddaughter', 'Relative', 'Other'].includes(newResRelationship) ? 'text-slate-400' : 'text-slate-700'}`}>
                    Set as Primary Head of Household
                  </label>
                </div>
              </div>
            </div>

            {/* Step 2: Member Personal Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-semibold">First Name *</Label>
                <Input value={newResFirstName} onChange={e => setNewResFirstName(e.target.value)} placeholder="e.g. Juan" required className="text-xs" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Middle Name</Label>
                <Input value={newResMiddleName} onChange={e => setNewResMiddleName(e.target.value)} placeholder="e.g. Perez" className="text-xs" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Last Name *</Label>
                <Input
                  value={newResLastName}
                  onChange={e => {
                    setNewResLastName(e.target.value);
                    if (addResidentMode === 'new_household' && !newResFamilyName) {
                      setNewResFamilyName(e.target.value);
                    }
                  }}
                  placeholder="e.g. Dela Cruz"
                  required
                  className="text-xs"
                />
              </div>
            </div>

            {/* Birthday, Computed Age & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-semibold">Date of Birth *</Label>
                <Input type="date" value={newResDOB} onChange={e => setNewResDOB(e.target.value)} required className="text-xs" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Gender *</Label>
                <Select value={newResGender} onValueChange={(val: any) => setNewResGender(val)}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Select Gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other / Non-Binary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Civil Status</Label>
                <Select value={newResCivilStatus} onValueChange={setNewResCivilStatus}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Select Civil Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                    <SelectItem value="Separated">Separated</SelectItem>
                    <SelectItem value="Live-In">Live-In / Common Law</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dynamic Age & Sector Detection Banner */}
            {newResDOB && getDynamicAge(newResDOB) !== null && (() => {
              const age = getDynamicAge(newResDOB)!;
              return (
                <div className="text-xs p-2.5 rounded-lg border flex items-center justify-between bg-slate-50 border-slate-200">
                  <div>
                    <span className="text-slate-500">Calculated Age: </span>
                    <strong className="text-slate-800">{age} years old</strong>
                  </div>
                  {age >= 60 ? (
                    <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[11px] border border-amber-300">
                      Senior Citizen (60+) — Auto-tallied in Household
                    </span>
                  ) : age < 18 ? (
                    <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px] border border-blue-300">
                      Child / Minor (&lt;18)
                    </span>
                  ) : (
                    <span className="bg-slate-200 text-slate-700 font-medium px-2 py-0.5 rounded text-[11px]">
                      Adult (18-59)
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Employment Status & Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Employment Status *</Label>
                <Select value={newResEmployment} onValueChange={setNewResEmployment}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Select Employment Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Employed">Employed (Have Work)</SelectItem>
                    <SelectItem value="Self-Employed">Self-Employed / Business</SelectItem>
                    <SelectItem value="Unemployed">Unemployed (Looking for work)</SelectItem>
                    <SelectItem value="Student">Student</SelectItem>
                    <SelectItem value="Retired">Retired / Pensioner</SelectItem>
                    <SelectItem value="Minor">Dependent Minor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Contact Number *</Label>
                <Input
                  value={newResPhone}
                  onChange={e => setNewResPhone(e.target.value.replace(/[^0-9+]/g, '').slice(0, 13))}
                  placeholder="09XXXXXXXXX"
                  className="text-xs font-mono"
                  inputMode="tel"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full text-xs font-bold h-9 shadow-xs">
                Save to Population Registry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dedicated Resident User Account Creation Modal with Census Auto-Fill */}
      <Dialog open={isCreateResidentUserOpen} onOpenChange={setIsCreateResidentUserOpen}>
        <DialogContent className="bg-white max-w-2xl max-h-[88vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-600">
                  <UserPlus size={18} />
                </div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Create Resident System Account
                </DialogTitle>
              </div>
              <Badge className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] uppercase font-bold tracking-wider">
                Resident Portal Access Only
              </Badge>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Provision a digital citizen portal account for Barangay {resAccBarangay || user?.barangay || 'Pianing'}. Type the resident&apos;s name to auto-fill verified demographic details from the Census Registry.
            </DialogDescription>
          </DialogHeader>

          {/* Existing Account Warning */}
          {existingResidentUserAccount && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">Existing Account Notice</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  A system account already exists for <strong className="font-semibold">{existingResidentUserAccount.name}</strong> ({existingResidentUserAccount.email}). Role: <span className="uppercase font-mono font-bold">{existingResidentUserAccount.role}</span> • Status: <span className="font-semibold">{existingResidentUserAccount.status}</span>.
                </p>
              </div>
            </div>
          )}

          {/* Census Search & Auto-Fill Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Search size={14} className="text-blue-600" />
                <Label className="text-xs font-bold text-slate-800">
                  Search Barangay Census to Auto-Fill
                </Label>
              </div>
              {resAccCensusMatch && (
                <button
                  type="button"
                  onClick={() => {
                    // Full reset of all census-autofilled fields
                    setResAccCensusMatch(null);
                    setResAccLinkedCensusId(null);
                    setResAccCensusSearch('');
                    setResAccFirstName('');
                    setResAccMiddleName('');
                    setResAccLastName('');
                    setResAccDOB('');
                    setResAccGender('');
                    setResAccCivilStatus('');
                    setResAccPhone('');
                    setResAccEmail('');
                    setResAccPurok('');
                    setResAccHouseholdNum('');
                    setResAccEmployment('');
                    setResAccResidencyYears('');
                    setResAccIdType('');
                    setResAccIdPhoto(null);
                    setResAccIdFileName('');
                    if (resAccFileInputRef.current) resAccFileInputRef.current.value = '';
                  }}
                  className="text-[11px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                >
                  Unlink Census Record
                </button>
              )}
            </div>

            {!resAccCensusMatch ? (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                  <Input
                    value={resAccCensusSearch}
                    onChange={e => setResAccCensusSearch(e.target.value)}
                    placeholder="Type name (e.g. Maria, Juan, Santos) or household #..."
                    className="text-xs pl-8 bg-white border-slate-300 focus:border-blue-500 rounded-lg"
                  />
                  {resAccCensusSearch && (
                    <button
                      type="button"
                      onClick={() => setResAccCensusSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Census Auto-fill suggestions */}
                {censusMatches.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1 bg-slate-50">
                      Matching Inhabitants in Census ({censusMatches.length})
                    </p>
                    {censusMatches.map(r => (
                      <div
                        key={r.id}
                        className="p-2 flex items-center justify-between hover:bg-blue-50 transition-colors gap-2"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {r.first_name} {r.middle_name ? r.middle_name + ' ' : ''}{r.last_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Household: <span className="font-mono text-blue-600 font-medium">{r.household_number || 'N/A'}</span> • Purok {r.purok || '1'} • Gender: {r.gender}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => applyCensusMatch(r)}
                          className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg shadow-2xs shrink-0 cursor-pointer"
                        >
                          Auto-Fill
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-emerald-100 rounded-full text-emerald-700">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-950">
                      Linked to Census: {resAccCensusMatch.first_name} {resAccCensusMatch.last_name}
                    </p>
                    <p className="text-[11px] text-emerald-800">
                      Household: <span className="font-mono font-semibold">{resAccCensusMatch.household_number || 'HH-N/A'}</span> • Purok {resAccCensusMatch.purok || '1'} • Verified Inhabitant
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                  Census Verified
                </Badge>
              </div>
            )}
          </div>

          <form onSubmit={handleCreateResidentUser} autoComplete="off" className="space-y-4 pt-1">
            {/* Step 1: Login Credentials */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <KeyRound size={14} className="text-blue-600" />
                Step 1: Resident Portal Login Credentials
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Login Email Address *</Label>
                  <div className="relative mt-1">
                    <Mail size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                    <Input
                      type="email"
                      name="res_reg_portal_login_email"
                      autoComplete="new-off"
                      value={resAccEmail}
                      onChange={e => setResAccEmail(e.target.value)}
                      placeholder="citizen@resident.barangay.ph"
                      className="text-xs pl-8 bg-white border-slate-300"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Used by the resident to sign into their portal.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">Initial Password *</Label>
                    <button
                      type="button"
                      onClick={() => setResAccShowPassword(prev => !prev)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                    >
                      {resAccShowPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <Input
                      type={resAccShowPassword ? 'text' : 'password'}
                      name="res_reg_portal_login_pass"
                      autoComplete="new-password"
                      value={resAccPassword}
                      onChange={e => setResAccPassword(e.target.value)}
                      placeholder="Enter resident password"
                      className="text-xs font-mono bg-white border-slate-300"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Min. 8 chars with uppercase, lowercase, digit &amp; symbol.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">Confirm Password *</Label>
                    <button
                      type="button"
                      onClick={() => setResAccShowConfirmPassword(prev => !prev)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                    >
                      {resAccShowConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <Input
                      type={resAccShowConfirmPassword ? 'text' : 'password'}
                      name="res_reg_portal_confirm_pass"
                      autoComplete="new-password"
                      value={resAccConfirmPassword}
                      onChange={e => setResAccConfirmPassword(e.target.value)}
                      placeholder="Re-enter password to confirm"
                      className="text-xs font-mono bg-white border-slate-300"
                      required
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">Mobile Contact Number *</Label>
                  <div className="relative mt-1">
                    <Phone size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                    <Input
                      type="tel"
                      value={resAccPhone}
                      onChange={e => setResAccPhone(e.target.value.replace(/[^0-9+]/g, '').slice(0, 13))}
                      placeholder="09XXXXXXXXX"
                      className="text-xs pl-8 font-mono bg-white border-slate-300"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Philippine 11-digit mobile number for SMS notifications.</p>
                </div>
              </div>
            </div>

            {/* Step 2: Citizen Demographics & Profile */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users size={14} className="text-blue-600" />
                Step 2: Resident Demographics &amp; Profile
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">First Name *</Label>
                  <Input
                    value={resAccFirstName}
                    onChange={e => {
                      setResAccFirstName(e.target.value);
                      if (!resAccCensusMatch && e.target.value.length >= 2) {
                        setResAccCensusSearch(e.target.value);
                      }
                    }}
                    placeholder="e.g. Juan"
                    className="text-xs mt-1 bg-white border-slate-300"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Middle Name</Label>
                  <Input
                    value={resAccMiddleName}
                    onChange={e => setResAccMiddleName(e.target.value)}
                    placeholder="e.g. Ramos"
                    className="text-xs mt-1 bg-white border-slate-300"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Last Name *</Label>
                  <Input
                    value={resAccLastName}
                    onChange={e => {
                      setResAccLastName(e.target.value);
                      if (!resAccCensusMatch && e.target.value.length >= 2) {
                        setResAccCensusSearch(`${resAccFirstName} ${e.target.value}`);
                      }
                    }}
                    placeholder="e.g. Dela Cruz"
                    className="text-xs mt-1 bg-white border-slate-300"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">Date of Birth</Label>
                    {resAccDOB && getDynamicAge(resAccDOB) !== null && (
                      <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                        {getDynamicAge(resAccDOB)} yrs
                      </span>
                    )}
                  </div>
                  <Input
                    type="date"
                    value={resAccDOB}
                    onChange={e => setResAccDOB(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="text-xs mt-1 bg-white border-slate-300"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Gender</Label>
                  <Select value={resAccGender} onValueChange={(val: any) => setResAccGender(val)}>
                    <SelectTrigger className="text-xs mt-1 bg-white border-slate-300"><SelectValue placeholder="Select Gender" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Civil Status</Label>
                  <Select value={resAccCivilStatus} onValueChange={setResAccCivilStatus}>
                    <SelectTrigger className="text-xs mt-1 bg-white border-slate-300"><SelectValue placeholder="Select Civil Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                      <SelectItem value="Widowed">Widowed</SelectItem>
                      <SelectItem value="Separated">Separated</SelectItem>
                      <SelectItem value="Live-In">Live-In / Common Law</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Employment Status</Label>
                  <Select value={resAccEmployment} onValueChange={setResAccEmployment}>
                    <SelectTrigger className="text-xs mt-1 bg-white border-slate-300"><SelectValue placeholder="Select Employment Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Employed">Employed</SelectItem>
                      <SelectItem value="Self-Employed">Self-Employed / Business</SelectItem>
                      <SelectItem value="Unemployed">Unemployed</SelectItem>
                      <SelectItem value="Student">Student</SelectItem>
                      <SelectItem value="Retired">Retired</SelectItem>
                      <SelectItem value="Minor">Dependent Minor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Years of Residency</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={resAccResidencyYears}
                    onChange={e => setResAccResidencyYears(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 5"
                    className="text-xs mt-1 bg-white border-slate-300"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Location Assignment */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 size={14} className="text-blue-600" />
                Step 3: Location Details
              </span>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Purok *</Label>
                <Select value={resAccPurok} onValueChange={setResAccPurok}>
                  <SelectTrigger className="text-xs mt-1 bg-white border-slate-300">
                    <SelectValue placeholder="Select Purok" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(p => (
                      <SelectItem key={`p-${p}`} value={String(p)}>Purok {p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Step 4: Valid Government ID & Upload */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-blue-600" />
                Step 4: Valid Government ID &amp; Document Photo
              </span>

              <div className="space-y-2.5">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Valid Government ID Type *</Label>
                  <Select value={resAccIdType} onValueChange={setResAccIdType}>
                    <SelectTrigger className="text-xs mt-1 bg-white border-slate-300">
                      <SelectValue placeholder="Select Government ID Type" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {ID_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 block mb-1">
                    Government ID Photo Upload
                  </Label>
                  <input
                    type="file"
                    ref={resAccFileInputRef}
                    onChange={handleResAccFileChange}
                    accept="image/*"
                    className="hidden"
                  />

                  {!resAccIdPhoto ? (
                    <div
                      onClick={() => resAccFileInputRef.current?.click()}
                      className="border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/20 rounded-xl p-3 text-center cursor-pointer transition-all group"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-1 group-hover:scale-105 transition-transform">
                        <Camera size={16} />
                      </div>
                      <p className="text-xs font-semibold text-slate-700">Click to attach or capture resident valid ID photo</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">PNG, JPG, or JPEG up to 5MB (PhilSys, Driver's License, Voter's, etc.)</p>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={resAccIdPhoto}
                          alt="ID Preview"
                          className="w-12 h-9 object-cover rounded-lg border border-blue-300 shadow-2xs shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-blue-950 truncate">
                            {resAccIdFileName || resAccIdType}
                          </p>
                          <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-600" /> Valid ID Photo Attached
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearResAccIdPhoto}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full cursor-pointer transition-colors"
                        title="Remove photo"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateResidentUserOpen(false)}
                className="text-xs h-9 font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingResAccount}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold h-9 shadow-xs cursor-pointer flex-1 gap-1.5"
              >
                {isCreatingResAccount ? (
                  <>
                    <RefreshCcw size={14} className="animate-spin" />
                    <span>Creating Resident Account...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={15} />
                    <span>Create Resident Account &amp; Grant Access</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Official Document Print & Download Modal */}
      <DocumentPrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        document={selectedPrintDoc}
        onStatusUpdated={() => loadData(false)}
      />

      {/* Document Info / Specifics Viewer Modal */}
      <DocumentInfoModal
        isOpen={isDocInfoOpen}
        onClose={() => setIsDocInfoOpen(false)}
        document={selectedInfoDoc}
        onUpdateStatus={(id, status) => handleUpdateDocStatus(id, status)}
        onPrint={(doc) => openPrintModal(doc)}
        canEdit={true}
      />

      {/* Submitted Government ID Photo Full-View Inspection Modal with Zoom, Rotate, and Download */}
      <ImageViewerModal
        isOpen={!!selectedIdPreview}
        onClose={() => setSelectedIdPreview(null)}
        imageUrl={selectedIdPreview}
        title="Submitted Resident Government ID"
        subtitle="Official Philippine Government ID / Cedula Verification Document"
        fileName="resident-submitted-id.png"
      />

      {/* ═══ FULL USER & OFFICIAL EXECUTIVE PROFILE MODAL ════════════════════ */}
      <Dialog open={!!selectedStaffInfo} onOpenChange={(open) => !open && setSelectedStaffInfo(null)}>
        <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border border-slate-200 shadow-2xl">
          {selectedStaffInfo && (() => {
            const roleCfg = getStaffRoleConfig(selectedStaffInfo.role);
            const userInitials = selectedStaffInfo.name
              ? selectedStaffInfo.name.split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
              : 'U';
            const fullName = selectedStaffInfo.first_name
              ? `${selectedStaffInfo.first_name} ${selectedStaffInfo.middle_name ? selectedStaffInfo.middle_name + ' ' : ''}${selectedStaffInfo.last_name || ''}`
              : selectedStaffInfo.name;

            const canEdit = isSuperAdmin || (user?.role === 'admin' && (selectedStaffInfo.role === 'staff' || selectedStaffInfo.role === 'bhw' || selectedStaffInfo.role === 'resident'));

            const copyText = (val: string, label: string) => {
              if (!val) return;
              navigator.clipboard.writeText(val);
              toast.success(`${label} copied to clipboard!`);
            };

            return (
              <div className="flex flex-col">
                {/* Modal Header */}
                <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl border ${roleCfg.bgAccent}`}>
                      {selectedStaffInfo.role === 'superadmin' ? <Shield size={18} /> :
                       selectedStaffInfo.role === 'admin' ? <Building2 size={18} /> :
                       selectedStaffInfo.role === 'nurse' ? <Heart size={18} /> :
                       selectedStaffInfo.role === 'bhw' ? <Activity size={18} /> :
                       selectedStaffInfo.role === 'resident' ? <UserCircle size={18} /> :
                       <FileText size={18} />}
                    </div>
                    <div>
                      <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                        {selectedStaffInfo.role === 'resident' ? 'Resident Citizen Profile' : 'Personnel & Official Profile'}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500">
                        {selectedStaffInfo.role === 'resident'
                          ? 'Official demographic record, civil status, and residency identification.'
                          : 'Operational credentials, municipal jurisdiction, and assigned authorities.'}
                      </DialogDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs font-semibold px-2.5 py-0.5 border ${roleCfg.badge}`}>
                    {selectedStaffInfo.role === 'superadmin' ? 'SUPER ADMIN' :
                     selectedStaffInfo.role === 'admin' ? 'BARANGAY ADMIN' :
                     selectedStaffInfo.role === 'nurse' ? 'HEALTH NURSE' :
                     selectedStaffInfo.role === 'bhw' ? 'BHW WORKER' :
                     selectedStaffInfo.role === 'staff' ? 'STAFF / CLERK' : 'RESIDENT'}
                  </Badge>
                </div>

                <div className="p-5 sm:p-6 space-y-5 text-xs">
                  {/* ── Executive Hero Card ── */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                      {/* Photo / Avatar & Info */}
                      <div className="flex items-center gap-4 sm:gap-5">
                        <div className="relative group/avatar shrink-0">
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden bg-slate-50 border-2 border-slate-200 shadow-sm flex items-center justify-center">
                            {selectedStaffInfo.profile_photo ? (
                              <img
                                src={selectedStaffInfo.profile_photo}
                                alt={selectedStaffInfo.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center text-2xl font-bold tracking-wider ${roleCfg.bgAccent}`}>
                                {userInitials}
                              </div>
                            )}
                          </div>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => staffFileInputRef.current?.click()}
                              className="absolute inset-0 bg-slate-900/40 text-white flex flex-col items-center justify-center rounded-3xl opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer backdrop-blur-[2px]"
                              title="Upload or change profile photo"
                            >
                              <Camera size={18} />
                              <span className="text-[10px] font-semibold mt-0.5">Change</span>
                            </button>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                              {fullName}
                            </h3>
                            <Badge className={
                              selectedStaffInfo.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold'
                                : selectedStaffInfo.status === 'Archived'
                                ? 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 font-bold'
                                : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-bold'
                            }>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                selectedStaffInfo.status === 'Active' ? 'bg-emerald-500 animate-pulse' :
                                selectedStaffInfo.status === 'Archived' ? 'bg-violet-500' : 'bg-amber-500'
                              }`} />
                              {selectedStaffInfo.status || 'Active'}
                            </Badge>
                            {selectedStaffInfo.role === 'resident' && (
                              <Badge variant="outline" className={
                                selectedStaffInfo.verification_status === 'Verified' ? 'border-emerald-300 text-emerald-700 bg-emerald-50 font-semibold' :
                                selectedStaffInfo.verification_status === 'Rejected' ? 'border-rose-300 text-rose-700 bg-rose-50 font-semibold' :
                                'border-amber-300 text-amber-800 bg-amber-50 font-semibold'
                              }>
                                {selectedStaffInfo.verification_status || 'Verified'}
                              </Badge>
                            )}
                          </div>

                          {/* Quick Photo Upload Actions */}
                          {canEdit && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <button
                                type="button"
                                onClick={() => staffFileInputRef.current?.click()}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                                title="Upload or change profile photo"
                              >
                                <Camera size={11} />
                                <span>{selectedStaffInfo.profile_photo ? 'Change Photo' : 'Upload Photo'}</span>
                              </button>
                              {selectedStaffInfo.profile_photo && (
                                <button
                                  type="button"
                                  onClick={handleRemoveStaffPhoto}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                                  title="Remove profile photo"
                                >
                                  <Trash2 size={11} />
                                  <span>Remove</span>
                                </button>
                              )}
                              <input
                                ref={staffFileInputRef}
                                type="file"
                                accept="image/png, image/jpeg, image/jpg, image/webp"
                                onChange={handleStaffPhotoUpload}
                                className="hidden"
                              />
                            </div>
                          )}

                          <div className="text-xs text-slate-500 mt-2 flex items-center gap-2.5 flex-wrap font-medium">
                            <button
                              type="button"
                              onClick={() => copyText(selectedStaffInfo.email, 'Email')}
                              className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors cursor-pointer bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/80"
                              title="Click to copy email"
                            >
                              <Mail size={12} className="text-slate-400" />
                              <span className="font-mono">{selectedStaffInfo.email}</span>
                              <Copy size={10} className="text-slate-400 ml-0.5" />
                            </button>

                            {selectedStaffInfo.phone && !selectedStaffInfo.phone.includes('@') && (
                              <button
                                type="button"
                                onClick={() => copyText(selectedStaffInfo.phone || '', 'Phone')}
                                className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors cursor-pointer bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/80"
                                title="Click to copy phone"
                              >
                                <Phone size={12} className="text-slate-400" />
                                <span className="font-mono">{selectedStaffInfo.phone}</span>
                                <Copy size={10} className="text-slate-400 ml-0.5" />
                              </button>
                            )}

                            <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/80">
                              <MapPin size={12} className="text-slate-400" />
                              <span>Barangay {selectedStaffInfo.barangay || 'Pianing'}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Top Right Badge / Clearance Pill */}
                      <div className="text-xs text-slate-500 bg-slate-50 px-3.5 py-2.5 rounded-2xl border border-slate-200/80 shrink-0 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                          <ShieldCheck size={14} className={roleCfg.accent} />
                          <span>Badge #{selectedStaffInfo.employee_id || selectedStaffInfo.id || 'N/A'}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <CheckCircle size={12} className="text-emerald-600" />
                          <span>Official System Profile</span>
                        </p>
                      </div>
                    </div>

                    {/* 4-Tile Quick Highlights Bar */}
                    <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Official Designation</span>
                        <span className="font-bold text-slate-800 mt-0.5 block truncate">{selectedStaffInfo.job_title || roleCfg.title}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Assigned Station</span>
                        <span className="font-bold text-slate-800 mt-0.5 block truncate">Brgy. {selectedStaffInfo.barangay || 'Pianing'} {roleCfg.station}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Clearance Level</span>
                        <span className="font-bold text-slate-800 mt-0.5 block truncate">{roleCfg.tier}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Security Status</span>
                        <span className="font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                          <CheckCircle size={12} /> {selectedStaffInfo.status === 'Active' ? 'Active & Protected' : selectedStaffInfo.status || 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Official Profile Credentials Card ── */}
                  <Card className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                    <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/40 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${roleCfg.bgAccent}`}>
                          <UserCircle size={15} />
                        </div>
                        <h4 className="font-bold text-slate-900 text-xs">Official Profile Credentials &amp; Identifiers</h4>
                      </div>
                      <span className="font-mono text-slate-400 text-[10px]">ID #{selectedStaffInfo.id}</span>
                    </div>

                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Full Legal Name</span>
                          <span className="font-bold text-slate-800 text-xs block mt-0.5">{fullName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Official Email</span>
                          <span className="font-mono font-medium text-slate-800 text-xs block mt-0.5 truncate">{selectedStaffInfo.email}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Contact Mobile</span>
                          <span className="font-mono font-medium text-slate-800 text-xs block mt-0.5">
                            {selectedStaffInfo.phone && !selectedStaffInfo.phone.includes('@') ? selectedStaffInfo.phone : 'None specified'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Assigned Barangay</span>
                          <span className="font-medium text-slate-800 text-xs block mt-0.5">Barangay {selectedStaffInfo.barangay || 'Pianing'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Employee Badge #</span>
                          <span className="font-mono font-medium text-slate-800 text-xs block mt-0.5">
                            {selectedStaffInfo.employee_id || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Last Active Session</span>
                          <span className="font-mono font-medium text-slate-700 text-xs block mt-0.5">
                            {selectedStaffInfo.last_login && selectedStaffInfo.last_login !== 'Never'
                              ? new Date(selectedStaffInfo.last_login).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : 'Never logged in'}
                          </span>
                        </div>
                        {selectedStaffInfo.address && (
                          <div className="sm:col-span-2 md:col-span-3">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Station / Registered Address</span>
                            <span className="font-medium text-slate-800 text-xs block mt-0.5">{selectedStaffInfo.address}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* ── Operational Responsibilities OR Resident Demographics ── */}
                  {selectedStaffInfo.role === 'resident' ? (
                    <Card className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                      <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200">
                            <User size={15} />
                          </div>
                          <h4 className="font-bold text-slate-900 text-xs">Civil &amp; Demographic Details</h4>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-sky-200 text-sky-700 bg-sky-50">
                          {selectedStaffInfo.purok ? (selectedStaffInfo.purok.startsWith('Purok') ? selectedStaffInfo.purok : `Purok ${selectedStaffInfo.purok}`) : 'Purok 1'}
                        </Badge>
                      </div>

                      <CardContent className="p-4 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Date of Birth</span>
                            <span className="font-medium text-slate-800 text-xs block mt-0.5">
                              {selectedStaffInfo.date_of_birth
                                ? `${new Date(selectedStaffInfo.date_of_birth).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}${(() => {
                                    const d = new Date(selectedStaffInfo.date_of_birth);
                                    if (isNaN(d.getTime())) return '';
                                    const diff = Date.now() - d.getTime();
                                    const age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
                                    return ` (${age} yrs old)`;
                                  })()}`
                                : 'Not specified'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Gender</span>
                            <span className="font-medium text-slate-800 text-xs block mt-0.5">{selectedStaffInfo.gender || 'Not specified'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Civil Status</span>
                            <span className="font-medium text-slate-800 text-xs block mt-0.5">{selectedStaffInfo.civil_status || 'Single'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Household #</span>
                            <span className="font-mono font-medium text-slate-800 text-xs block mt-0.5">{selectedStaffInfo.household_number || 'N/A'}</span>
                          </div>
                        </div>

                        {/* Government ID Preview Row */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600 font-medium">Government ID Document:</span>
                            {selectedStaffInfo.submitted_id ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                Uploaded &amp; Available
                              </Badge>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No ID photo attached</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {selectedStaffInfo.submitted_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                type="button"
                                onClick={() => setSelectedIdPreview(selectedStaffInfo.submitted_id || null)}
                                className="h-8 text-xs font-semibold rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 cursor-pointer gap-1.5"
                              >
                                <Eye size={13} />
                                <span>View ID Document</span>
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              type="button"
                              onClick={() => {
                                const residentId = selectedStaffInfo.id;
                                setSelectedStaffInfo(null);
                                openResidentProfile(residentId);
                              }}
                              className="h-8 text-xs font-semibold rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 cursor-pointer gap-1.5"
                            >
                              <ExternalLink size={13} />
                              <span>Open User Info Dossier</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                      <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${roleCfg.bgAccent}`}>
                            <ShieldCheck size={15} />
                          </div>
                          <h4 className="font-bold text-slate-900 text-xs">Operational Scope &amp; Role Responsibilities</h4>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-600 bg-white">
                          Official Scope
                        </Badge>
                      </div>

                      <CardContent className="p-4">
                        <ul className="space-y-2 text-xs text-slate-600">
                          {selectedStaffInfo.role === 'superadmin' && (
                            <>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-violet-600 shrink-0 mt-0.5" />
                                <span>Full city-wide central governance across all 86 barangays in Butuan City.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-violet-600 shrink-0 mt-0.5" />
                                <span>Create, authorize, and govern Barangay Executive Administrators.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-violet-600 shrink-0 mt-0.5" />
                                <span>Master document template catalog, system audit logs, and city demographics.</span>
                              </li>
                            </>
                          )}
                          {selectedStaffInfo.role === 'admin' && (
                            <>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                                <span>Executive administration and operational jurisdiction over Barangay {selectedStaffInfo.barangay || 'Pianing'}.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                                <span>Approve resident registrations, verify identity documents, and issue official clearances.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                                <span>Direct oversight of Barangay Staff, clerks, and Barangay Health Workers (BHW).</span>
                              </li>
                            </>
                          )}
                          {selectedStaffInfo.role === 'staff' && (
                            <>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-blue-600 shrink-0 mt-0.5" />
                                <span>Process and issue official Barangay Clearances, Certificates of Residency, and Indigency.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-blue-600 shrink-0 mt-0.5" />
                                <span>Register walk-in residents and verify demographic information in the census database.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-blue-600 shrink-0 mt-0.5" />
                                <span>Operational communication and document dispatch via Barangay Staff Messenger.</span>
                              </li>
                            </>
                          )}
                          {selectedStaffInfo.role === 'bhw' && (
                            <>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                                <span>Community health census mapping and family profiling for Barangay {selectedStaffInfo.barangay || 'Pianing'}.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                                <span>Field vital signs monitoring, maternal care follow-ups, and child immunization tracking.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                                <span>Coordinate medical referrals and community health schedules with the Health Center Nurse.</span>
                              </li>
                            </>
                          )}
                          {selectedStaffInfo.role === 'nurse' && (
                            <>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-teal-600 shrink-0 mt-0.5" />
                                <span>Health Center clinical intake, medical consultations, and EHR patient history records.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-teal-600 shrink-0 mt-0.5" />
                                <span>Prenatal examinations, pediatric vaccine administration, and pharmacy inventory control.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle size={14} className="text-teal-600 shrink-0 mt-0.5" />
                                <span>Clinical appointment approvals, physician consultations, and health summary reporting.</span>
                              </li>
                            </>
                          )}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Modal Footer / Actions */}
                <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-mono">Account #{selectedStaffInfo.id}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] text-slate-500">
                      Brgy. {selectedStaffInfo.barangay || 'Pianing'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Edit User Button */}
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => {
                          const target = selectedStaffInfo;
                          setSelectedStaffInfo(null);
                          handleOpenEditUser(target);
                        }}
                        className="h-8 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer gap-1.5"
                      >
                        <Edit3 size={13} />
                        <span>Edit Details</span>
                      </Button>
                    )}

                    {/* Reset Password Button */}
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => {
                          const target = selectedStaffInfo;
                          setSelectedStaffInfo(null);
                          handleOpenResetPassword(target);
                        }}
                        className="h-8 text-xs font-semibold rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 cursor-pointer gap-1.5"
                      >
                        <Key size={13} />
                        <span>Reset Password</span>
                      </Button>
                    )}

                    {/* Toggle Status Button */}
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => {
                          const target = selectedStaffInfo;
                          handleToggleUserStatus(target);
                          setSelectedStaffInfo({
                            ...target,
                            status: target.status === 'Active' ? 'Inactive' : 'Active'
                          });
                        }}
                        className={`h-8 text-xs font-semibold rounded-xl cursor-pointer gap-1.5 ${
                          selectedStaffInfo.status === 'Active'
                            ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {selectedStaffInfo.status === 'Active' ? (
                          <>
                            <UserX size={13} />
                            <span>Deactivate</span>
                          </>
                        ) : (
                          <>
                            <UserCheck size={13} />
                            <span>Activate</span>
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      type="button"
                      onClick={() => setSelectedStaffInfo(null)}
                      className="h-8 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Applicant Registration Rejection & Notification Modal */}
      <Dialog open={!!smsApplicantModal} onOpenChange={(open) => !open && setSmsApplicantModal(null)}>
        <DialogContent className="bg-white dark:bg-slate-900 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle size={18} />
              Reject Resident Application
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Specify the discrepancy cause. The applicant will be notified immediately on their resident portal.
            </DialogDescription>
          </DialogHeader>

          {smsApplicantModal && (
            <form onSubmit={handleSendSmsNotice} className="space-y-4 py-2 text-xs">
              {/* Applicant Card */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Applicant Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {smsApplicantModal.name || `${smsApplicantModal.first_name || ''} ${smsApplicantModal.last_name || ''}`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Mobile Phone</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1">
                    <Phone size={11} className="text-indigo-600" />
                    {smsApplicantModal.phone && !smsApplicantModal.phone.includes('@') ? smsApplicantModal.phone : '09171234567'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Provided Birthday</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono font-medium">
                    {smsApplicantModal.date_of_birth && smsApplicantModal.date_of_birth !== '0000-00-00'
                      ? new Date(smsApplicantModal.date_of_birth).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Submitted ID</span>
                  {smsApplicantModal.submitted_id ? (
                    <button
                      type="button"
                      onClick={() => setSelectedIdPreview(smsApplicantModal.submitted_id || null)}
                      className="text-[11px] text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={11} /> View ID Document
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[11px] italic">None attached</span>
                  )}
                </div>
              </div>

              {/* Quick Issue Reason Selector */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Discrepancy Cause / Rejection Reason
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {[
                    { key: 'Invalid / Blurry ID Photo', label: '📸 Blurry / Invalid ID' },
                    { key: 'Name Mismatch', label: '🏷️ Name Mismatch' },
                    { key: 'Birthday Discrepancy', label: '🎂 Birthday Mismatch' },
                    { key: 'Address Discrepancy', label: '📍 Address Issue' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleNoticeReasonChange(opt.key, smsApplicantModal)}
                      className={`p-2 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer ${
                        smsNoticeReason === opt.key
                          ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950 dark:border-red-500'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:border-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rejection Cause Message Textarea */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Detailed Reason for Applicant <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {smsCustomMessage.length} characters
                  </span>
                </div>
                <textarea
                  value={smsCustomMessage}
                  onChange={e => setSmsCustomMessage(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none leading-relaxed"
                  placeholder="Explain why the registration cannot be approved and what the resident should correct..."
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  This explanation will be displayed prominently on the resident's portal and notification center.
                </p>
              </div>

              {/* Notification Option Box */}
              <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>Portal In-App Notification: <strong>Active (Always sent to resident)</strong></span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <input
                    type="checkbox"
                    id="markRejectedCheckbox"
                    checked={smsMarkAsRejected}
                    onChange={e => setSmsMarkAsRejected(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="markRejectedCheckbox" className="text-xs text-slate-600 dark:text-slate-400 font-medium cursor-pointer">
                    Also send SMS text alert to applicant mobile number
                  </label>
                </div>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSmsApplicantModal(null)}
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={smsSending || !smsCustomMessage.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5 shadow-sm cursor-pointer"
                >
                  <X size={13} />
                  {smsSending ? 'Processing Rejection...' : 'Confirm Rejection & Notify'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Pending Applicant Review Modal */}
      {selectedApplicantForReview && (
        <PendingApplicantReviewModal
          applicant={selectedApplicantForReview}
          isOpen={isApplicantReviewOpen}
          onClose={() => {
            setIsApplicantReviewOpen(false);
            setSelectedApplicantForReview(null);
          }}
          onApprove={async (id: number) => {
            setIsApprovingApplicant(true);
            try {
              await apiService.approveResident(id, user?.name || 'Admin');
              toast.success('Resident account approved and verified!');
              setIsApplicantReviewOpen(false);
              setSelectedApplicantForReview(null);
              loadData();
            } catch {
              toast.error('Failed to approve resident');
            } finally {
              setIsApprovingApplicant(false);
            }
          }}
          onRejectWithReason={async (id: number, reason: string) => {
            await handleRejectWithDirectReason(id, reason);
            setIsApplicantReviewOpen(false);
            setSelectedApplicantForReview(null);
          }}
          approving={isApprovingApplicant}
        />
      )}

      {/* Super Admin User Permissions Modal */}
      <UserPermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => {
          setIsPermissionsModalOpen(false);
          setSelectedUserForPermissions(null);
        }}
        user={selectedUserForPermissions}
        onSave={handleSavePermissions}
      />
    </div>
  );
}
