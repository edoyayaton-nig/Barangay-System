import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Shield,
  UserCircle,
  Lock,
  ArrowRight,
  UserCheck,
  AlertCircle,
  Building2,
  Heart,
  Phone,
  MapPin,
  CreditCard,
  CheckCircle2,
  Calendar,
  X,
  Camera,
  Mail,
  Home,
  Eye,
  EyeOff,
  Search,
  Check,
  ArrowLeft,
  UserPlus,
  Sparkles,
  BadgeCheck,
  RefreshCw,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { apiService, CensusResidentSearchResult } from '../../services/api';
import { validatePasswordComplexity } from '../../utils/passwordValidation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { FloatingInput, FloatingSelect } from '../components/ui/floating-input';
import { BUTUAN_BARANGAYS, normalizeBarangay, formatJurisdictionAddress } from '../../utils/barangays';
import { AGUSAN_DEL_NORTE_LGUS, getBarangaysForCity } from '../../utils/caragaJurisdictions';
import { saveStoredUser } from '../../utils/safeStorage';
import TermsAndPrivacyModal from '../components/TermsAndPrivacyModal';
import SystemNoticeBanner from '../components/SystemNoticeBanner';
import ThemeToggle from '../components/ThemeToggle';
import { toast } from 'sonner';
import { compressImage } from '../../utils/imageCompressor';

const ID_TYPES = [
  'Philippine National ID (PhilSys)',
  "Driver's License",
  'SSS / UMID Card',
  'PhilHealth ID',
  'TIN ID',
  "Voter's ID / Certificate",
  'Postal ID',
  'Senior Citizen ID',
  'PWD ID',
  'Barangay ID',
  'Passport',
  'Student ID (School-issued)',
  'PRC License',
  'OFW / OWWA ID',
  'Government Office / Employee ID'
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Tab State (allows /login?tab=register)
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'register') {
      setActiveTab('register');
    } else {
      setActiveTab('login');
    }
  }, [location.search]);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Dynamic Register State
  const [residentMode, setResidentMode] = useState<'choose' | 'existing' | 'new'>('choose');

  // Existing Resident Flow State
  const [existingStep, setExistingStep] = useState<1 | 2 | 3>(1);
  const [existingBarangay, setExistingBarangay] = useState('Pianing');
  const [existingFullNameSearch, setExistingFullNameSearch] = useState('');
  const [existingSearchResults, setExistingSearchResults] = useState<CensusResidentSearchResult[]>([]);
  const [isSearchingCensus, setIsSearchingCensus] = useState(false);
  const [hasSearchedCensus, setHasSearchedCensus] = useState(false);
  const [selectedCensusResident, setSelectedCensusResident] = useState<CensusResidentSearchResult | null>(null);

  // Existing Resident account credentials
  const [existingPhone, setExistingPhone] = useState('');
  const [existingEmail, setExistingEmail] = useState('');
  const [existingPassword, setExistingPassword] = useState('');
  const [showExistingPassword, setShowExistingPassword] = useState(false);
  const [existingIdType, setExistingIdType] = useState('');
  const [existingIdPhoto, setExistingIdPhoto] = useState<string | null>(null);
  const [existingIdFileName, setExistingIdFileName] = useState('');
  const [existingTermsAgreed, setExistingTermsAgreed] = useState(false);
  const existingFileInputRef = useRef<HTMLInputElement | null>(null);

  // New Resident Flow State
  const [regFirstName, setRegFirstName] = useState('');
  const [regMiddleName, setRegMiddleName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regDob, setRegDob] = useState('');
  const [regGender, setRegGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [regCivilStatus, setRegCivilStatus] = useState<'Single' | 'Married' | 'Widowed' | 'Separated' | 'Live-In' | ''>('');
  const [regResidencyYears, setRegResidencyYears] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPurok, setRegPurok] = useState('');
  const [regBarangay, setRegBarangay] = useState('Pianing');
  const [regCity, setRegCity] = useState('');
  const [regEmployment, setRegEmployment] = useState('Employed');
  const [regIdType, setRegIdType] = useState('');
  const [regIdPhoto, setRegIdPhoto] = useState<string | null>(null);
  const [regIdFileName, setRegIdFileName] = useState<string>('');
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [regTermsAgreed, setRegTermsAgreed] = useState(false);
  const [termsModalTab, setTermsModalTab] = useState<'privacy' | 'terms'>('privacy');
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dynamically resolved official barangays for selected city/municipality in Agusan del Norte
  const cityBarangays = regCity ? getBarangaysForCity(regCity) : [];

  const clearExistingFlow = () => {
    setExistingStep(1);
    setExistingFullNameSearch('');
    setExistingSearchResults([]);
    setHasSearchedCensus(false);
    setSelectedCensusResident(null);
    setExistingPhone('');
    setExistingEmail('');
    setExistingPassword('');
    setExistingIdType('');
    setExistingIdPhoto(null);
    setExistingIdFileName('');
    setExistingTermsAgreed(false);
    if (existingFileInputRef.current) existingFileInputRef.current.value = '';
  };

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setRegFirstName('');
    setRegMiddleName('');
    setRegLastName('');
    setRegDob('');
    setRegGender('');
    setRegCivilStatus('');
    setRegEmployment('Employed');
    setRegResidencyYears('');
    setRegEmail('');
    setRegPassword('');
    setRegPhone('');
    setRegPurok('');
    setRegBarangay('');
    setRegCity('');
    setRegIdType('');
    setRegIdPhoto(null);
    setRegIdFileName('');
    setRegStep(1);
    setRegTermsAgreed(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    clearExistingFlow();
    setResidentMode('choose');
  };

  const handleTabChange = (val: 'login' | 'register') => {
    setActiveTab(val);
    clearForm();
  };

  // Census live search
  const handleCensusSearch = async (searchTerm?: string) => {
    const term = (searchTerm !== undefined ? searchTerm : existingFullNameSearch).trim();
    if (!existingBarangay) {
      toast.error('Barangay Required', { description: 'Please select a barangay first.' });
      return;
    }
    if (!term || term.length < 2) {
      setExistingSearchResults([]);
      setHasSearchedCensus(false);
      return;
    }

    setIsSearchingCensus(true);
    try {
      const res = await apiService.lookupCensusResidents(existingBarangay, term);
      if (res && res.success) {
        setExistingSearchResults(res.results || []);
        setHasSearchedCensus(true);
      } else {
        setExistingSearchResults([]);
        setHasSearchedCensus(true);
      }
    } catch (err: any) {
      toast.error('Search error', { description: err.message || 'Failed to search census' });
      setExistingSearchResults([]);
      setHasSearchedCensus(true);
    } finally {
      setIsSearchingCensus(false);
    }
  };

  // Auto debounce search for existing resident census
  useEffect(() => {
    if (activeTab !== 'register' || residentMode !== 'existing' || existingStep !== 2) return;
    const term = existingFullNameSearch.trim();
    if (term.length < 2) {
      setExistingSearchResults([]);
      setHasSearchedCensus(false);
      return;
    }
    const timer = setTimeout(() => {
      handleCensusSearch(term);
    }, 350);
    return () => clearTimeout(timer);
  }, [existingFullNameSearch, existingBarangay, residentMode, existingStep, activeTab]);

  const handleSwitchToNewResident = () => {
    if (existingBarangay) {
      setRegBarangay(existingBarangay);
    }
    setResidentMode('new');
    toast.info('Barangay Hall Registration Required', {
      description: `Please proceed to your Barangay Hall to register to Barangay ${existingBarangay || 'Pianing'}.`
    });
  };

  const handleExistingFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type', { description: 'Please upload an image (PNG, JPG, JPEG).' });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File too large', { description: 'Max image size is 15MB.' });
      return;
    }

    setExistingIdFileName(file.name);
    try {
      const compressed = await compressImage(file, 1200, 1200, 0.75);
      setExistingIdPhoto(compressed);
      toast.success('ID image attached', { description: file.name });
    } catch {
      const reader = new FileReader();
      reader.onloadend = () => {
        setExistingIdPhoto(reader.result as string);
        toast.success('ID image attached', { description: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearExistingIdPhoto = () => {
    setExistingIdPhoto(null);
    setExistingIdFileName('');
    if (existingFileInputRef.current) existingFileInputRef.current.value = '';
  };

  const handleExistingRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCensusResident) {
      toast.error('No Resident Selected', { description: 'Please select your census record first.' });
      return;
    }

    if (!existingEmail.trim()) {
      toast.error('Email required', { description: 'Please enter a valid email address.' });
      return;
    }

    const passCheck = validatePasswordComplexity(existingPassword);
    if (!passCheck.isValid) {
      toast.error('Weak Password', { description: passCheck.message });
      return;
    }

    const cleanPhone = existingPhone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('09') || cleanPhone.length !== 11) {
      toast.error('Invalid Contact Number', { description: 'Philippine mobile number must be exactly 11 digits starting with 09 (e.g. 09171234567).' });
      return;
    }

    if (!existingIdType) {
      toast.error('Government ID Type Required', { description: 'Please select a valid Government ID type.' });
      return;
    }

    if (!existingIdPhoto) {
      toast.error('Valid ID Photo Required', { description: 'Please upload a photo of your Government ID.' });
      return;
    }

    if (!existingTermsAgreed) {
      toast.error('Terms & Privacy Agreement Required', {
        description: 'You must review and accept the Terms & Conditions and Data Privacy Policy to create an account.'
      });
      setTermsModalTab('privacy');
      setIsTermsOpen(true);
      return;
    }

    setLoading(true);
    try {
      const regResponse = await apiService.register({
        existing_resident_id: selectedCensusResident.id,
        first_name: selectedCensusResident.first_name,
        middle_name: selectedCensusResident.middle_name,
        last_name: selectedCensusResident.last_name,
        email: existingEmail.trim().toLowerCase(),
        password: existingPassword,
        phone: cleanPhone,
        address: selectedCensusResident.address,
        barangay: selectedCensusResident.barangay || existingBarangay,
        city: selectedCensusResident.city || 'Butuan City',
        purok: selectedCensusResident.purok,
        id_type: existingIdType,
        submitted_id: existingIdPhoto,
        role: 'resident',
      });

      const fullName = `${selectedCensusResident.first_name}${selectedCensusResident.middle_name ? ' ' + selectedCensusResident.middle_name : ''} ${selectedCensusResident.last_name}`;
      const user = {
        name: fullName,
        first_name: selectedCensusResident.first_name,
        middle_name: selectedCensusResident.middle_name,
        last_name: selectedCensusResident.last_name,
        date_of_birth: selectedCensusResident.date_of_birth,
        gender: selectedCensusResident.gender,
        civil_status: selectedCensusResident.civil_status,
        email: existingEmail.trim().toLowerCase(),
        phone: cleanPhone,
        address: selectedCensusResident.address,
        barangay: selectedCensusResident.barangay || existingBarangay,
        city: selectedCensusResident.city || 'Butuan City',
        purok: selectedCensusResident.purok,
        role: 'resident' as const,
        verification_status: 'Pending_Review' as const,
        submitted_id: existingIdPhoto,
        id_type: existingIdType,
        id: regResponse.id || regResponse.user?.id || selectedCensusResident.id,
      };

      saveStoredUser(user);
      toast.success('Registration Submitted!', {
        description: 'Your citizen account is linked to your census record and submitted for verification.'
      });

      clearExistingFlow();
      setIsChoiceModalOpen(true);
    } catch (err: any) {
      toast.error('Registration failed', { description: err.message || 'Could not complete registration.' });
    } finally {
      setLoading(false);
    }
  };

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type', { description: 'Please upload an image (PNG, JPG, JPEG).' });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File too large', { description: 'Max image size is 15MB.' });
      return;
    }

    setRegIdFileName(file.name);
    try {
      const compressed = await compressImage(file, 1200, 1200, 0.75);
      setRegIdPhoto(compressed);
      toast.success('ID image attached', { description: file.name });
    } catch {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRegIdPhoto(reader.result as string);
        toast.success('ID image attached', { description: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearIdPhoto = () => {
    setRegIdPhoto(null);
    setRegIdFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Missing credentials', { description: 'Please enter both email and password.' });
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.login(email.trim(), password);
      if (response && response.user) {
        const u = response.user;
        saveStoredUser(u);
        toast.success(`Welcome back, ${u.name}!`);

        if (u.role === 'super_mega_admin') {
          navigate('/super-mega-admin');
        } else if (u.role === 'superadmin' || u.role === 'admin' || u.role === 'staff') {
          navigate('/admin');
        } else if (u.role === 'nurse') {
          navigate('/nurse');
        } else if (u.role === 'bhw') {
          navigate('/bhw');
        } else {
          setIsChoiceModalOpen(true);
        }
      } else {
        toast.error('Authentication failed', { description: response?.message || 'Invalid email or password.' });
      }
    } catch (err: any) {
      toast.error('Login error', { description: err.message || 'Could not connect to authentication server.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Resident Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regFirstName.trim() || !regLastName.trim()) {
      toast.error('Name required', { description: 'Please provide your First Name and Last Name.' });
      return;
    }

    if (!regEmail.trim()) {
      toast.error('Email required', { description: 'Please enter a valid email address.' });
      return;
    }

    const passCheck = validatePasswordComplexity(regPassword);
    if (!passCheck.isValid) {
      toast.error('Weak Password', { description: passCheck.message });
      return;
    }

    const cleanPhone = regPhone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('09') || cleanPhone.length !== 11) {
      toast.error('Invalid Contact Number', { description: 'Philippine mobile number must be exactly 11 digits starting with 09 (e.g. 09171234567).' });
      return;
    }

    if (!regDob) {
      toast.error('Birthday required', { description: 'Please specify your date of birth.' });
      return;
    }

    const calculatedAge = getDynamicAge(regDob);
    if (calculatedAge === null || calculatedAge < 0) {
      toast.error('Invalid Birthday', { description: 'Please enter a valid past date of birth.' });
      return;
    }

    if (!regGender) {
      toast.error('Gender required', { description: 'Please select your gender.' });
      return;
    }

    if (!regCivilStatus) {
      toast.error('Civil Status required', { description: 'Please select your civil status.' });
      return;
    }

    if (!regPurok.trim()) {
      toast.error('Purok / Street required', { description: 'Please indicate your purok or street.' });
      return;
    }

    if (!regCity.trim()) {
      toast.error('City / Municipality required', { description: 'Please select your City or Municipality in Agusan del Norte.' });
      return;
    }

    if (!regBarangay.trim()) {
      toast.error('Barangay required', { description: `Please select your Barangay in ${regCity || 'Agusan del Norte'}.` });
      return;
    }

    if (!regIdType) {
      toast.error('Government ID Type Required', { description: 'Please select a valid Government ID type to continue registration.' });
      return;
    }

    if (!regIdPhoto) {
      toast.error('Valid ID Photo Required', { description: 'You cannot proceed without uploading a valid Government ID photo.' });
      return;
    }

    if (!regTermsAgreed) {
      toast.error('Terms & Privacy Agreement Required', {
        description: 'You must review and accept the Terms & Conditions and Data Privacy Policy to create an account.'
      });
      setTermsModalTab('privacy');
      setIsTermsOpen(true);
      return;
    }

    const toTitleCase = (str: string) =>
      str ? str.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';

    const formattedFirstName = toTitleCase(regFirstName);
    const formattedMiddleName = toTitleCase(regMiddleName);
    const formattedLastName = toTitleCase(regLastName);
    const canonicalBarangay = normalizeBarangay(regBarangay);
    const canonicalCity = (regCity || 'Butuan City').trim();
    const cleanPurokNum = regPurok.replace(/purok\s*/i, '').trim();
    const formattedPurok = cleanPurokNum ? `Purok ${cleanPurokNum}` : (regPurok.trim() || 'Purok 1');
    const fullAddress = `${formattedPurok}, Barangay ${canonicalBarangay}, ${canonicalCity}`;
    const fullName = `${formattedFirstName}${formattedMiddleName ? ' ' + formattedMiddleName : ''} ${formattedLastName}`;

    setLoading(true);
    try {
      await apiService.register({
        first_name: formattedFirstName,
        middle_name: formattedMiddleName,
        last_name: formattedLastName,
        date_of_birth: regDob,
        gender: regGender,
        civil_status: regCivilStatus,
        employment_status: regEmployment,
        years_of_residency: regResidencyYears.trim() || undefined,
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        phone: cleanPhone,
        address: fullAddress,
        role: 'resident',
        submitted_id: regIdPhoto,
        id_type: regIdType,
        barangay: canonicalBarangay,
        city: canonicalCity,
        purok: cleanPurokNum || regPurok.trim()
      });

      const user = {
        name: fullName,
        first_name: formattedFirstName,
        middle_name: formattedMiddleName,
        last_name: formattedLastName,
        date_of_birth: regDob,
        age: calculatedAge,
        gender: regGender,
        civil_status: regCivilStatus,
        employment_status: regEmployment,
        email: regEmail.trim().toLowerCase(),
        phone: cleanPhone,
        address: fullAddress,
        barangay: canonicalBarangay,
        city: canonicalCity,
        purok: cleanPurokNum || regPurok.trim(),
        role: 'resident',
        verification_status: 'Pending_Review',
        submitted_id: 'submitted',
        id_type: regIdType,
        years_of_residency: regResidencyYears.trim() || undefined
      };

      saveStoredUser(user);

      toast.warning('Account Created (ID Under Review)', {
        description: 'Your resident account and ID have been submitted! Please wait for Admin approval to unlock official clearance requests.'
      });

      clearForm();
      setIsChoiceModalOpen(true);
    } catch (err: any) {
      toast.error('Registration failed', { description: err.message || 'Please try again with a different email.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Ensure all credentials and inputs initialize completely empty with no autofill
    setEmail('');
    setPassword('');
    setRegEmail('');
    setRegPassword('');
    setRegPurok('');
    setRegBarangay('');
    setRegCity('');
  }, []);

  return (
    <div className="min-h-screen bg-white sm:bg-[#FAFAFA] dark:bg-slate-950 flex flex-col justify-between font-sans transition-colors">
      {/* System Outage / Maintenance / Advisory Notice */}
      <SystemNoticeBanner allowDismiss={false} />

      {/* Top Viewport Header: Pinned directly to far Top-Left */}
      <header className="w-full px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white shadow-xs border border-slate-200 shrink-0">
            <img src="/assets/pianing-logo.png" alt="Barangay Pianing Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Barangay Pianing</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Smart Public Health &amp; Admin Portal</p>
          </div>
        </div>
        <ThemeToggle variant="pill" />
      </header>

      {/* Centered Main Login / Signup Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-4 sm:py-6">
        <div className={`w-full bg-white dark:bg-slate-900 border border-[#6458FF]/20 dark:border-slate-800 shadow-[0_12px_36px_-6px_rgba(100,88,255,0.18)] rounded-3xl p-6 sm:p-8 transition-all ${
          activeTab === 'login' ? 'max-w-[420px]' : (residentMode === 'choose' ? 'max-w-2xl' : 'max-w-xl')
        }`}>
          {/* Card Header matching Screenshot with Logo */}
          <div className="text-center pb-4">
            <div className="mx-auto w-12 h-12 rounded-full overflow-hidden bg-white shadow-md border-2 border-[#6458FF]/30 flex items-center justify-center mb-2.5">
              <img src="/assets/pianing-logo.png" alt="Barangay Pianing Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Smart Barangay Portal</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Access Barangay Admin, BHW Health Portal, or Resident Services
            </p>
          </div>

          {/* Tab Switcher Capsule */}
          <div className="flex justify-center mb-5">
            <div className="inline-flex bg-slate-100 p-1.5 rounded-full border border-slate-200/80 shadow-inner">
              <button
                type="button"
                onClick={() => handleTabChange('login')}
                className={`px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-gradient-to-r from-[#6458FF] to-[#00C6FF] text-white shadow-md'
                    : 'text-slate-500 hover:text-[#6458FF]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('register')}
                className={`px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-gradient-to-r from-[#6458FF] to-[#00C6FF] text-white shadow-md'
                    : 'text-slate-500 hover:text-[#6458FF]'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>

          {/* ── TAB 1: LOGIN ─────────────────────────────────── */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5" autoComplete="off" method="post" action="#">
              <input type="text" name="fake_username_fill" className="hidden" tabIndex={-1} autoComplete="off" />
              <input type="password" name="fake_password_fill" className="hidden" tabIndex={-1} autoComplete="new-password" />

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Email Address <span className="text-[#FF6492] font-bold">*</span>
                </label>
                <input
                  type="email"
                  name="login_user_email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. name@email.com"
                  required
                  className="w-full h-10 px-4 bg-slate-50/80 border border-slate-200 rounded-full text-xs text-slate-800 focus:bg-white focus:border-[#6458FF] focus:ring-2 focus:ring-[#6458FF]/20 outline-none transition-all shadow-inner"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Password <span className="text-[#FF6492] font-bold">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-[10.5px] font-bold text-[#6458FF] hover:text-[#5044E5] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    name="login_user_password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-10 px-4 pr-10 bg-slate-50/80 border border-slate-200 rounded-full text-xs text-slate-800 focus:bg-white focus:border-[#6458FF] focus:ring-2 focus:ring-[#6458FF]/20 outline-none transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-[#6458FF] cursor-pointer"
                    tabIndex={-1}
                  >
                    {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-[#6458FF] to-[#00C6FF] hover:opacity-95 text-white font-bold text-xs shadow-[0_6px_20px_-2px_rgba(100,88,255,0.45)] hover:shadow-[0_10px_28px_-2px_rgba(0,198,255,0.55)] transition-all rounded-full mt-3 cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Sign In to Portal'}
                <ArrowRight size={14} className="ml-1.5" />
              </Button>

              {/* Quick One-Click Demo Role Accounts */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 text-center">
                  Quick Access Portals (Password: 123)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: 'Nurse Portal', email: 'nurse@barangay.gov', icon: '🩺', color: 'hover:border-[#00B894] hover:bg-[#00B894]/10 hover:text-[#00B894]' },
                    { label: 'BHW Health', email: 'bhw@barangay.gov', icon: '🌿', color: 'hover:border-[#00B894] hover:bg-[#00B894]/10 hover:text-[#00B894]' },
                    { label: 'Barangay Admin', email: 'admin@barangay.gov', icon: '🏛️', color: 'hover:border-[#6458FF] hover:bg-[#6458FF]/10 hover:text-[#6458FF]' },
                    { label: 'Super Admin', email: 'superadmin@barangay.gov', icon: '🛡️', color: 'hover:border-[#6458FF] hover:bg-[#6458FF]/10 hover:text-[#6458FF]' },
                    { label: 'Super Mega', email: 'supermegaadmin@barangay.gov', icon: '⚡', color: 'hover:border-[#6458FF] hover:bg-[#6458FF]/10 hover:text-[#6458FF]' },
                    { label: 'Citizen Portal', email: 'citizen.pianing@gmail.com', icon: '👤', color: 'hover:border-[#FFA502] hover:bg-[#FFA502]/10 hover:text-[#FFA502]' },
                  ].map(portal => (
                    <button
                      key={portal.email}
                      type="button"
                      onClick={() => {
                        setEmail(portal.email);
                        setPassword('123');
                        toast.info(`Filled credentials for ${portal.label}`);
                      }}
                      className={`px-2.5 py-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200/90 rounded-full flex items-center justify-center gap-1.5 transition-all shadow-xs hover:-translate-y-0.5 cursor-pointer ${portal.color}`}
                    >
                      <span>{portal.icon}</span>
                      <span className="truncate">{portal.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {/* ── TAB 2: REGISTER ─────────────────────────────────────────────── */}
          {activeTab === 'register' && residentMode === 'choose' && (
            <div className="space-y-4">
              <div className="text-center pb-1">
                <h3 className="text-sm font-bold text-slate-800">Choose Citizen Account Type</h3>
                <p className="text-[11.5px] text-slate-500 mt-0.5">
                  Select whether you are already recorded in the Barangay census or registering as a new resident.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Container 1: EXISTING RESIDENT */}
                <div
                  onClick={() => {
                    setResidentMode('existing');
                    setExistingStep(1);
                  }}
                  className="group relative bg-gradient-to-b from-blue-50/70 via-white to-white border-2 border-blue-200/90 hover:border-blue-500 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between hover:-translate-y-0.5"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                        <CheckCircle2 size={11} /> CENSUS RECORD
                      </span>
                      <span className="text-[10px] font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                        Fast Track &rarr;
                      </span>
                    </div>

                    <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 mb-3 group-hover:scale-105 transition-transform">
                      <Building2 size={22} />
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      EXISTING RESIDENT
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Already in the Barangay census or inhabitant registry. Select your barangay and auto-search your record to activate your citizen account.
                    </p>

                    <div className="mt-3.5 pt-3 border-t border-blue-100/80 space-y-1.5 text-[10.5px] text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span>Step 1: Choose your Barangay</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span>Step 2: Auto-search your name in census</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span>Step 3: Upload valid ID &amp; set password</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      setResidentMode('existing');
                      setExistingStep(1);
                    }}
                    className="w-full mt-4 h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs group-hover:shadow-md transition-all cursor-pointer"
                  >
                    Select Existing Resident
                    <ArrowRight size={13} className="ml-1.5" />
                  </Button>
                </div>

                {/* Container 2: NEW RESIDENT */}
                <div
                  onClick={() => {
                    setResidentMode('new');
                  }}
                  className="group relative bg-gradient-to-b from-amber-50/70 via-white to-white dark:from-amber-950/30 dark:via-[#1A1D2D] dark:to-[#151824] border-2 border-amber-200/90 dark:border-amber-800/60 hover:border-amber-500 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between hover:-translate-y-0.5"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                        <Building2 size={11} /> FIRST-TIME
                      </span>
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform">
                        Barangay Hall &rarr;
                      </span>
                    </div>

                    <div className="w-11 h-11 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/25 mb-3 group-hover:scale-105 transition-transform">
                      <Building2 size={22} />
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                      NEW RESIDENT
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      First-time resident or not yet registered in the Barangay census registry. Please proceed to your Barangay Hall to register.
                    </p>

                    <div className="mt-3.5 pt-3 border-t border-amber-100/80 dark:border-slate-800 space-y-1.5 text-[10.5px] text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>In-person census registration required</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Proceed to your Barangay Hall with valid ID</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Activate online account once recorded in census</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      setResidentMode('new');
                    }}
                    className="w-full mt-4 h-9 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs group-hover:shadow-md transition-all cursor-pointer"
                  >
                    Select New Resident Option
                    <ArrowRight size={13} className="ml-1.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── EXISTING RESIDENT WORKFLOW ── */}
          {activeTab === 'register' && residentMode === 'existing' && (
            <div className="space-y-4">
              {/* Header Navigation with Back button & Step Pills */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (existingStep > 1) {
                      setExistingStep((prev) => (prev - 1) as 1 | 2);
                    } else {
                      setResidentMode('choose');
                      clearExistingFlow();
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600 cursor-pointer transition-colors"
                >
                  <ArrowLeft size={14} />
                  {existingStep === 1 ? 'Back to Options' : existingStep === 2 ? 'Back to Barangay' : 'Back to Search'}
                </button>

                {/* Step Pills */}
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold">
                  <span className={`px-2 py-0.5 rounded-full ${existingStep === 1 ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
                    1. Barangay
                  </span>
                  <span className="text-slate-300">&rsaquo;</span>
                  <span className={`px-2 py-0.5 rounded-full ${existingStep === 2 ? 'bg-blue-600 text-white' : existingStep > 2 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                    2. Search Name
                  </span>
                  <span className="text-slate-300">&rsaquo;</span>
                  <span className={`px-2 py-0.5 rounded-full ${existingStep === 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    3. ID &amp; Password
                  </span>
                </div>
              </div>

              {/* Step 1: Select Barangay */}
              {existingStep === 1 && (
                <div className="space-y-3.5 py-1">
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-2.5">
                    <Building2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-blue-950 leading-relaxed">
                      <strong className="font-bold">Step 1: Which Barangay are you registered in?</strong>
                      <p className="text-blue-800 text-[10.5px] mt-0.5">
                        Select your Barangay jurisdiction to search the official local census database.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Barangay Jurisdiction <span className="text-red-500 font-bold">*</span>
                    </label>
                    <select
                      value={existingBarangay}
                      onChange={(e) => {
                        setExistingBarangay(e.target.value);
                        setExistingSearchResults([]);
                        setHasSearchedCensus(false);
                      }}
                      className="w-full h-10 px-3 bg-slate-50/90 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all cursor-pointer"
                    >
                      {BUTUAN_BARANGAYS.map((b) => (
                        <option key={b} value={b}>
                          Barangay {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      if (!existingBarangay) {
                        toast.error('Barangay required', { description: 'Please choose your barangay.' });
                        return;
                      }
                      setExistingStep(2);
                      if (existingFullNameSearch.trim().length >= 2) {
                        handleCensusSearch(existingFullNameSearch);
                      }
                    }}
                    className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                  >
                    Proceed to Census Search in Barangay {existingBarangay}
                    <ArrowRight size={14} />
                  </Button>
                </div>
              )}

              {/* Step 2: Write Full Name & Live Census Search */}
              {existingStep === 2 && (
                <div className="space-y-3.5 py-1">
                  {/* Selected Barangay pill */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <Building2 size={15} className="text-blue-600" />
                      <span className="text-slate-600 text-[11px]">Searching Census in:</span>
                      <strong className="text-blue-900 font-bold text-xs">Barangay {existingBarangay}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExistingStep(1)}
                      className="text-[10.5px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Write your Full Name <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={existingFullNameSearch}
                        onChange={(e) => setExistingFullNameSearch(e.target.value)}
                        placeholder="e.g. Maria Clara Delgado"
                        autoFocus
                        className="w-full h-10 pl-9 pr-10 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-inner"
                      />
                      <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                      {isSearchingCensus ? (
                        <RefreshCw size={15} className="absolute right-3 top-3 text-blue-600 animate-spin" />
                      ) : existingFullNameSearch ? (
                        <button
                          type="button"
                          onClick={() => {
                            setExistingFullNameSearch('');
                            setExistingSearchResults([]);
                            setHasSearchedCensus(false);
                          }}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                        >
                          <X size={15} />
                        </button>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Type your First and Last name as recorded during the Barangay census.
                    </p>
                  </div>

                  {/* NOT FOUND ALERT (Exact note requested by user) */}
                  {hasSearchedCensus && !isSearchingCensus && existingSearchResults.length === 0 && (
                    <div className="p-4 bg-rose-50/90 border-2 border-rose-300 rounded-2xl text-rose-950 space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-xs font-bold text-rose-900 leading-tight">
                            You are not an existing resident please apply for new resident or go to your barangay hall!
                          </h5>
                          <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                            We checked the official census registry of <strong>Barangay {existingBarangay}</strong>, but no record matched &ldquo;{existingFullNameSearch}&rdquo;.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-rose-200/80 flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          onClick={handleSwitchToNewResident}
                          className="flex-1 h-9 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <UserPlus size={13} />
                          Apply for New Resident
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setExistingFullNameSearch('');
                            setHasSearchedCensus(false);
                          }}
                          className="px-3 py-2 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 rounded-xl border border-rose-200 cursor-pointer transition-colors text-center"
                        >
                          Search Another Name
                        </button>
                      </div>
                    </div>
                  )}

                  {/* FOUND RESULTS LIST */}
                  {hasSearchedCensus && !isSearchingCensus && existingSearchResults.length > 0 && (
                    <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                      <p className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Matching Census Records ({existingSearchResults.length}):</span>
                        <span className="text-[10px] text-slate-400 font-normal">Click your name to continue</span>
                      </p>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {existingSearchResults.map((r) => (
                          <div
                            key={r.id}
                            className={`p-3 rounded-2xl border transition-all ${
                              r.has_account
                                ? 'bg-slate-50 border-slate-200 opacity-80'
                                : 'bg-white border-blue-200 hover:border-blue-500 hover:shadow-md cursor-pointer group'
                            }`}
                            onClick={() => {
                              if (r.has_account) {
                                toast.info('Account already active', {
                                  description: 'Please sign in or use Forgot Password for this resident.'
                                });
                                return;
                              }
                              setSelectedCensusResident(r);
                              if (r.phone) setExistingPhone(r.phone);
                              if (r.email) setExistingEmail(r.email);
                              setExistingStep(3);
                              toast.success('Census Record Selected', {
                                description: `Connecting ${r.first_name} ${r.last_name}. Please upload your valid Government ID.`
                              });
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <strong className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                    {r.first_name} {r.middle_name ? `${r.middle_name} ` : ''}{r.last_name}
                                  </strong>
                                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    {r.is_census_only ? '📋 Census Record' : '👤 Resident Record'}
                                  </span>
                                </div>
                                <div className="text-[10.5px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                  <span>Purok {r.purok || '1'}</span>
                                  <span>•</span>
                                  <span>{r.gender || '—'}</span>
                                  <span>•</span>
                                  <span>DOB: {r.date_of_birth || '—'}</span>
                                  {r.household_number && (
                                    <>
                                      <span>•</span>
                                      <span>HH: {r.household_number}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0">
                                {r.has_account ? (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                                    <Lock size={11} /> Already Has Account
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="px-3 py-1.5 bg-blue-50 group-hover:bg-blue-600 text-blue-700 group-hover:text-white rounded-xl text-[11px] font-bold transition-all shadow-xs"
                                  >
                                    Select &rarr;
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Upload Government ID & Set Credentials */}
              {existingStep === 3 && selectedCensusResident && (
                <form onSubmit={handleExistingRegister} className="space-y-3.5 py-1">
                  {/* Confirmed Constituent Summary Banner */}
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">Linked Census Record</p>
                        <h5 className="text-xs font-bold text-emerald-950 truncate">
                          {selectedCensusResident.first_name} {selectedCensusResident.middle_name ? `${selectedCensusResident.middle_name} ` : ''}{selectedCensusResident.last_name}
                        </h5>
                        <p className="text-[10px] text-emerald-700 truncate">
                          Purok {selectedCensusResident.purok || '1'}, Barangay {selectedCensusResident.barangay || existingBarangay}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExistingStep(2)}
                      className="text-[10.5px] font-bold text-emerald-700 hover:text-emerald-900 underline shrink-0 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* 1. Government ID Upload */}
                  <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-800 block">
                        1. Government ID Photo <span className="text-red-500 font-bold">*</span>
                      </label>
                      <span className="text-[10px] font-semibold text-rose-600">Strictly Required</span>
                    </div>

                    <div>
                      <select
                        value={existingIdType}
                        onChange={(e) => setExistingIdType(e.target.value)}
                        required
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-100 outline-none transition-all cursor-pointer"
                      >
                        <option value="">Select Government ID Type *</option>
                        {ID_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {!existingIdPhoto ? (
                      <div
                        onClick={() => existingFileInputRef.current?.click()}
                        className="border-2 border-dashed border-blue-200 hover:border-blue-500 bg-white hover:bg-blue-50/30 rounded-xl p-3 text-center cursor-pointer transition-all group"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-1 group-hover:scale-105 transition-transform">
                          <Camera size={16} />
                        </div>
                        <p className="text-xs font-bold text-slate-700">Click to choose or capture valid ID photo <span className="text-red-500">*</span></p>
                        <p className="text-[9.5px] text-slate-400 mt-0.5">PhilSys, Driver&apos;s License, Voter&apos;s ID, Barangay ID (PNG, JPG up to 15MB)</p>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-white border border-blue-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={existingIdPhoto}
                            alt="ID Preview"
                            className="w-12 h-9 object-cover rounded-lg border border-blue-300 shadow-2xs shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-blue-950 truncate">
                              {existingIdFileName || existingIdType || 'Government ID'}
                            </p>
                            <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle2 size={12} className="text-emerald-600" /> Valid ID Photo Attached
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearExistingIdPhoto}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full cursor-pointer transition-colors"
                          title="Remove photo"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    )}

                    <input
                      ref={existingFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleExistingFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* 2. Phone Number */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      2. Phone Number <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={existingPhone}
                        onChange={(e) => setExistingPhone(e.target.value)}
                        placeholder="09171234567"
                        required
                        maxLength={11}
                        className="w-full h-10 pl-9 pr-3 bg-slate-50/90 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-inner"
                      />
                      <Phone size={15} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      11-digit mobile number starting with 09 (used for SMS alerts and verifications).
                    </p>
                  </div>

                  {/* 3. Email Address */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      3. Email Address <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={existingEmail}
                        onChange={(e) => setExistingEmail(e.target.value)}
                        placeholder="e.g. maria.delgado@gmail.com"
                        required
                        className="w-full h-10 pl-9 pr-3 bg-slate-50/90 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-inner"
                      />
                      <Mail size={15} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Your login email address for the Citizen Portal. Only 1 account per Gmail.
                    </p>
                  </div>

                  {/* 4. Password */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      4. Password <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showExistingPassword ? 'text' : 'password'}
                        value={existingPassword}
                        onChange={(e) => setExistingPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full h-10 pl-9 pr-10 bg-slate-50/90 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-inner"
                      />
                      <Lock size={15} className="absolute left-3 top-3 text-slate-400" />
                      <button
                        type="button"
                        onClick={() => setShowExistingPassword(!showExistingPassword)}
                        className="absolute right-3.5 top-2.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                        tabIndex={-1}
                      >
                        {showExistingPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Must contain at least 8 characters, uppercase, lowercase, number, and special symbol.
                    </p>
                  </div>

                  {/* Data Privacy & Terms Agreement Checkbox */}
                  <div
                    className={`p-3 rounded-2xl border transition-all ${
                      existingTermsAgreed
                        ? 'bg-emerald-50/70 border-emerald-300/80 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id="existing-terms-agree"
                        required
                        checked={existingTermsAgreed}
                        onChange={(e) => setExistingTermsAgreed(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0"
                      />
                      <div className="flex-1 text-[11px] text-slate-700 leading-relaxed select-none">
                        <label htmlFor="existing-terms-agree" className="cursor-pointer">
                          I verify that I am the resident recorded in this census entry, and I agree to the{' '}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setTermsModalTab('terms');
                            setIsTermsOpen(true);
                          }}
                          className="text-blue-700 font-bold underline hover:text-blue-900 cursor-pointer"
                        >
                          Terms &amp; Conditions
                        </button>{' '}
                        and{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setTermsModalTab('privacy');
                            setIsTermsOpen(true);
                          }}
                          className="text-blue-700 font-bold underline hover:text-blue-900 cursor-pointer"
                        >
                          Data Privacy Policy
                        </button>.
                      </div>
                      {existingTermsAgreed && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 border border-emerald-300/60">
                          <CheckCircle2 size={11} /> Accepted
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={loading || !existingTermsAgreed}
                    className={`w-full h-11 font-bold text-xs shadow-md transition-all rounded-xl mt-3 flex items-center justify-center gap-2 cursor-pointer ${
                      !existingTermsAgreed
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {loading ? (
                      'Creating Citizen Account...'
                    ) : !existingTermsAgreed ? (
                      <>
                        <Lock size={13} className="opacity-60" />
                        Accept Terms &amp; Privacy Policy to Create Account
                      </>
                    ) : (
                      <>
                        Create Citizen Account
                        <ArrowRight size={14} />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* ── TAB 2: REGISTER - NEW RESIDENT (In-Person Barangay Hall Requirement) ─────────── */}
          {activeTab === 'register' && residentMode === 'new' && (
            <div className="space-y-4">
              {/* Header Navigation & Badge */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResidentMode('choose')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back to Options
                </button>

                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 inline-flex items-center gap-1">
                  <Building2 size={11} />
                  In-Person Registration Only
                </span>
              </div>

              {/* Barangay Jurisdiction Selector */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-amber-600 dark:text-amber-400" />
                    Select Your Barangay Jurisdiction:
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Butuan City</span>
                </label>
                <select
                  value={regBarangay || existingBarangay || 'Pianing'}
                  onChange={(e) => {
                    setRegBarangay(e.target.value);
                    setExistingBarangay(e.target.value);
                  }}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900/40 outline-none transition-all cursor-pointer"
                >
                  {BUTUAN_BARANGAYS.map((b) => (
                    <option key={b} value={b} className="dark:bg-slate-900 dark:text-white">
                      Barangay {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Main Official Notice Card (Prominently in Front) */}
              <div className="relative overflow-hidden p-6 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-amber-900/15 dark:to-transparent border-2 border-amber-400/90 dark:border-amber-600/70 rounded-2xl shadow-sm text-center space-y-3.5">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Building2 size={28} />
                </div>

                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10.5px] font-extrabold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60">
                    <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
                    Barangay Census Registration Required
                  </div>

                  {/* PROMINENT MESSAGE REQUIRED BY USER */}
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
                    Proceed to your Barangay Hall to register to Barangay {regBarangay || existingBarangay || 'Pianing'}!
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                    Under municipal civil registry policy, brand-new residents cannot fill up an account online. Your initial profiling must be conducted in person at the Barangay Hall.
                  </p>
                </div>

                {/* Important Details Card */}
                <div className="text-left bg-white/90 dark:bg-slate-900/90 p-4 rounded-xl border border-amber-200/90 dark:border-amber-800/60 space-y-2.5 text-xs">
                  <div className="flex items-start gap-2.5">
                    <MapPin size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white font-bold block">Office Location:</strong>
                      <span className="text-slate-600 dark:text-slate-300 text-[11.5px]">
                        Barangay {regBarangay || existingBarangay || 'Pianing'} Hall, Government Center, Butuan City
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Calendar size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white font-bold block">Office Hours:</strong>
                      <span className="text-slate-600 dark:text-slate-300 text-[11.5px]">
                        Monday &ndash; Friday, 8:00 AM &ndash; 5:00 PM (Except official holidays)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <FileText size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-white font-bold block">What to Bring:</strong>
                      <ul className="text-slate-600 dark:text-slate-300 text-[11.5px] list-disc list-inside space-y-0.5 mt-0.5">
                        <li>At least one (1) valid Government-issued ID (PhilSys, Voter's, Driver's License, etc.)</li>
                        <li>Proof of residence (Utility billing, tenancy contract, or Purok endorsement)</li>
                        <li>Latest 2x2 ID photo (optional / if requested by desk)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Next Steps Info */}
                <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-left text-[11px] text-amber-950 dark:text-amber-200 flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Once recorded in the census:</strong> Return to this portal, choose <strong>Existing Resident</strong>, search your name, and create your online password immediately.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <Button
                  type="button"
                  onClick={() => {
                    const targetBrgy = regBarangay || existingBarangay || 'Pianing';
                    setExistingBarangay(targetBrgy);
                    setResidentMode('existing');
                    setExistingStep(1);
                  }}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Search size={14} />
                  Check if Name is in Existing Resident Census
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResidentMode('choose')}
                    className="w-full h-9 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Back to Options
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setResidentMode('choose');
                    }}
                    className="w-full h-9 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="pt-3 text-center border-t border-slate-100 mt-5">
            <button
              onClick={() => navigate('/')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              &larr; Back to Homepage
            </button>
          </div>
        </div>
      </main>

      {/* Portal Choice Modal - Residents Only */}
      <Dialog open={isChoiceModalOpen} onOpenChange={setIsChoiceModalOpen}>
        <DialogContent className="bg-white max-w-sm sm:max-w-md rounded-3xl p-6">
          <DialogHeader className="text-center">
            <DialogTitle className="text-slate-900 font-bold text-center text-lg">Welcome to the Portal!</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 text-center mt-1">
              Select which portal you would like to open:
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3">
            <Button
              onClick={() => { setIsChoiceModalOpen(false); navigate('/resident/barangay'); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex flex-col gap-2.5 py-6 h-auto rounded-2xl shadow-md cursor-pointer"
            >
              <Building2 size={26} />
              <div className="text-center">
                <span className="font-bold text-sm block">Barangay Portal</span>
                <span className="text-[10px] text-indigo-100 font-normal">Clearances, Permits &amp; IDs</span>
              </div>
            </Button>
            <Button
              onClick={() => { setIsChoiceModalOpen(false); navigate('/resident/health'); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex flex-col gap-2.5 py-6 h-auto rounded-2xl shadow-md cursor-pointer"
            >
              <Heart size={26} />
              <div className="text-center">
                <span className="font-bold text-sm block">Health Center Portal</span>
                <span className="text-[10px] text-emerald-100 font-normal">Medical &amp; Vaccine Records</span>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TermsAndPrivacyModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
        initialTab={termsModalTab}
        onAgree={() => {
          setRegTermsAgreed(true);
          toast.success('Terms & Data Privacy Policy Accepted', {
            description: 'You have agreed to Republic Act No. 10173 and Citizen Terms of Service.'
          });
        }}
      />

      {/* Forgot Password / Account Recovery Assistance Modal */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="bg-white max-w-sm sm:max-w-md rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xl">
          <DialogHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-2">
              <Shield size={24} />
            </div>
            <DialogTitle className="text-slate-900 font-bold text-center text-lg">
              Account Recovery Assistance
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 text-center mt-1">
              Barangay Pianing Citizen &amp; Official Identity Management
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs text-slate-600 mt-2">
            <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-1.5">
              <strong className="text-blue-900 font-bold block">For Registered Residents:</strong>
              <p>
                To maintain compliance with the Data Privacy Act (RA 10173), password resets require identity verification. Please visit the <strong>Barangay Pianing Hall</strong> with your valid Government ID, or reach out to our Helpdesk during office hours (Mon–Fri, 8:00 AM – 5:00 PM).
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <strong className="text-slate-900 font-bold block">For Administrative Staff &amp; Healthcare Workers:</strong>
              <p>
                Please contact the <strong>Super Administrator</strong> or Barangay IT Officer to issue a temporary security PIN for your account.
              </p>
            </div>

            <div className="pt-1 flex flex-col gap-2 text-slate-700 font-medium">
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-blue-600 shrink-0" />
                <span>Barangay Hotlines: (085) 342-8890 / 0917-123-4567</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-blue-600 shrink-0" />
                <span>Official Email: support@barangaypianing.gov.ph</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <Button
              type="button"
              onClick={() => setIsForgotPasswordOpen(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl cursor-pointer"
            >
              Understood / Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 dark:text-slate-500 py-3 space-y-1">
        <p>&copy; 2026 Smart Barangay Administrative &amp; Health Management Ecosystem.</p>
        <p className="text-[11px] text-slate-500">
          <button
            type="button"
            onClick={() => {
              setTermsModalTab('privacy');
              setIsTermsOpen(true);
            }}
            className="text-blue-600 hover:underline font-medium cursor-pointer"
          >
            Privacy Policy &amp; Terms of Service (RA 10173)
          </button>
        </p>
      </footer>
    </div>
  );
}
