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
  const [regCity, setRegCity] = useState('Butuan City');
  const [regEmployment, setRegEmployment] = useState('Employed');
  const [regIdType, setRegIdType] = useState('');
  const [regIdPhoto, setRegIdPhoto] = useState<string | null>(null);
  const [regIdFileName, setRegIdFileName] = useState<string>('');
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [regTermsAgreed, setRegTermsAgreed] = useState(false);
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [verificationScreenState, setVerificationScreenState] = useState<'idle' | 'verifying' | 'success'>('idle');
  const [verifyingStep, setVerifyingStep] = useState<number>(1);
  const [submittedAppCode, setSubmittedAppCode] = useState<string>('');
  const [termsModalTab, setTermsModalTab] = useState<'privacy' | 'terms'>('privacy');
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dynamically resolved official barangays for selected city/municipality in Agusan del Norte
  const cityBarangays = getBarangaysForCity(regCity || 'Butuan City');

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
    setRegBarangay('Pianing');
    setRegCity('Butuan City');
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

    if (regConfirmPassword && regPassword !== regConfirmPassword) {
      toast.error('Passwords do not match', { description: 'Please make sure your password and confirm password match exactly.' });
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

    const effectiveCity = (regCity || 'Butuan City').trim();
    const effectiveBarangay = (regBarangay || 'Pianing').trim();

    if (!effectiveCity) {
      toast.error('City / Municipality required', { description: 'Please select your City or Municipality in Agusan del Norte.' });
      return;
    }

    if (!effectiveBarangay) {
      toast.error('Barangay required', { description: `Please select your Barangay in ${effectiveCity}.` });
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
    const canonicalBarangay = normalizeBarangay(effectiveBarangay);
    const canonicalCity = effectiveCity;
    const cleanPurokNum = regPurok.replace(/purok\s*/i, '').trim();
    const formattedPurok = cleanPurokNum ? `Purok ${cleanPurokNum}` : (regPurok.trim() || 'Purok 1');
    const fullAddress = `${formattedPurok}, Barangay ${canonicalBarangay}, ${canonicalCity}`;
    const fullName = `${formattedFirstName}${formattedMiddleName ? ' ' + formattedMiddleName : ''} ${formattedLastName}`;

    setLoading(true);
    setVerificationScreenState('verifying');
    setVerifyingStep(1);
    setTimeout(() => setVerifyingStep(2), 900);
    setTimeout(() => setVerifyingStep(3), 1900);
    try {
      const regRes = await apiService.register({
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

      const appRef = 'APP-2026-' + (regRes?.id || regRes?.user?.id || Math.floor(1000 + Math.random() * 9000));
      setSubmittedAppCode(appRef);
      setTimeout(() => {
        setVerificationScreenState('success');
      }, 2600);
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
    setRegBarangay('Pianing');
    setRegCity('Butuan City');
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
        <div className={`w-full bg-white dark:bg-slate-900 border border-[#D5E2E8] dark:border-[#223A50] shadow-[0_12px_36px_-6px_rgba(23,59,94,0.12)] rounded-3xl p-6 sm:p-8 transition-all ${
          activeTab === 'login' ? 'max-w-[420px]' : (residentMode === 'choose' ? 'max-w-2xl' : 'max-w-xl')
        }`}>
          {/* Card Header matching Screenshot with Logo */}
          <div className="text-center pb-4">
            <div className="mx-auto w-12 h-12 rounded-full overflow-hidden bg-white shadow-md border-2 border-[#173B5E]/30 flex items-center justify-center mb-2.5">
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
                    ? 'bg-gradient-to-r from-[#173B5E] to-[#006B66] text-white shadow-md'
                    : 'text-slate-500 hover:text-[#006B66]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('register')}
                className={`px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-gradient-to-r from-[#173B5E] to-[#006B66] text-white shadow-md'
                    : 'text-slate-500 hover:text-[#006B66]'
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
                  Email Address <span className="text-[#B42318] font-bold">*</span>
                </label>
                <input
                  type="email"
                  name="login_user_email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. name@email.com"
                  required
                  className="w-full h-10 px-4 bg-slate-50/80 border border-[#D5E2E8] rounded-full text-xs text-slate-800 focus:bg-white focus:border-[#006B66] focus:ring-2 focus:ring-[#006B66]/20 outline-none transition-all shadow-inner"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Password <span className="text-[#B42318] font-bold">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-[10.5px] font-bold text-[#006B66] hover:text-[#005753] hover:underline cursor-pointer"
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
                    className="w-full h-10 px-4 pr-10 bg-slate-50/80 border border-[#D5E2E8] rounded-full text-xs text-slate-800 focus:bg-white focus:border-[#006B66] focus:ring-2 focus:ring-[#006B66]/20 outline-none transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-[#006B66] cursor-pointer"
                    tabIndex={-1}
                  >
                    {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#006B66] hover:bg-[#005753] text-white font-bold text-xs shadow-[0_6px_20px_-2px_rgba(0,107,102,0.35)] hover:shadow-[0_10px_28px_-2px_rgba(0,107,102,0.45)] transition-all rounded-full mt-3 cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Sign In to Portal'}
                <ArrowRight size={14} className="ml-1.5" />
              </Button>
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

          {/* ── EXISTING RESIDENT WORKFLOW (Refill Complete Census Data & Verify) ── */}
          {activeTab === 'register' && residentMode === 'existing' && (
            <form onSubmit={handleRegister} className="space-y-4" autoComplete="off">
              {/* Header Navigation with Back button & Badge */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResidentMode('choose')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back to Options
                </button>

                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 inline-flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  Existing Resident Census Verification
                </span>
              </div>

              {/* Informational Guidance Callout */}
              <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl text-[11px] text-blue-950 dark:text-blue-200 flex items-start gap-2.5">
                <Building2 size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="font-bold block">Census Inhabitant Profile Refill</strong>
                  <span>
                    Please refill your complete census information and attach your valid Government ID. Upon submission, the system will verify your data with the official database, and the Barangay Admin will confirm your application.
                  </span>
                </div>
              </div>

              {/* SECTION 1: Personal Demographic Details */}
              <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block flex items-center gap-1.5">
                  <UserCheck size={13} className="text-blue-600" />
                  1. Personal Information
                </span>

                {/* Name Fields (First, Middle, Last) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      First Name <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value.replace(/[0-9]/g, ''))}
                      placeholder="e.g. Maria"
                      required
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Middle Name <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={regMiddleName}
                      onChange={(e) => setRegMiddleName(e.target.value.replace(/[0-9]/g, ''))}
                      placeholder="e.g. Clara"
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Last Name <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value.replace(/[0-9]/g, ''))}
                      placeholder="e.g. Santos"
                      required
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                    />
                  </div>
                </div>

                {/* DOB, Gender, Civil Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Date of Birth <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="date"
                      value={regDob}
                      onChange={(e) => setRegDob(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      required
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Gender <span className="text-red-500 font-bold">*</span>
                    </label>
                    <select
                      value={regGender}
                      onChange={(e) => setRegGender(e.target.value as any)}
                      required
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600 cursor-pointer"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Civil Status <span className="text-red-500 font-bold">*</span>
                    </label>
                    <select
                      value={regCivilStatus}
                      onChange={(e) => setRegCivilStatus(e.target.value as any)}
                      required
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600 cursor-pointer"
                    >
                      <option value="">Select Civil Status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                      <option value="Live-In">Live-In</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Census Address & Demographics */}
              <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block flex items-center gap-1.5">
                  <MapPin size={13} className="text-blue-600" />
                  2. Census Address &amp; Demographics
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Purok / Street <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={regPurok}
                      onChange={(e) => setRegPurok(e.target.value)}
                      placeholder="e.g. Purok 1 or Mahogany St"
                      required
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Barangay Jurisdiction <span className="text-slate-400 font-normal">(Default: Pianing)</span>
                    </label>
                    <select
                      value={regBarangay || 'Pianing'}
                      onChange={(e) => setRegBarangay(e.target.value)}
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-[#D5E2E8] dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:border-[#006B66] cursor-pointer"
                    >
                      {cityBarangays.map((b) => (
                        <option key={b} value={b}>
                          Barangay {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      City / Municipality <span className="text-red-500 font-bold">*</span>
                    </label>
                    <select
                      value={regCity || 'Butuan City'}
                      onChange={(e) => {
                        const newCity = e.target.value;
                        setRegCity(newCity);
                        const bgys = getBarangaysForCity(newCity);
                        if (newCity === 'Butuan City') {
                          setRegBarangay('Pianing');
                        } else if (bgys.length > 0) {
                          setRegBarangay(bgys[0]);
                        }
                      }}
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-[#D5E2E8] dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:border-[#006B66] cursor-pointer"
                    >
                      {AGUSAN_DEL_NORTE_LGUS.map((lgu) => (
                        <option key={lgu.name} value={lgu.name}>
                          {lgu.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Years of Residency
                    </label>
                    <input
                      type="text"
                      value={regResidencyYears}
                      onChange={(e) => setRegResidencyYears(e.target.value)}
                      placeholder="e.g. 5 Years"
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Employment Status
                    </label>
                    <select
                      value={regEmployment}
                      onChange={(e) => setRegEmployment(e.target.value)}
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600 cursor-pointer"
                    >
                      <option value="Employed">Employed</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Unemployed">Unemployed</option>
                      <option value="Student">Student</option>
                      <option value="Retired">Retired</option>
                      <option value="Housewife/Househusband">Housewife / Househusband</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Account Credentials & Contact */}
              <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block flex items-center gap-1.5">
                  <Lock size={13} className="text-blue-600" />
                  3. Contact &amp; Security Credentials
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Email Address <span className="text-red-500 font-bold">*</span> <span className="text-slate-400 font-normal">(Gmail preferred)</span>
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value.toLowerCase().trim())}
                      placeholder="e.g. resident@gmail.com"
                      required
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Mobile Phone Number <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="09171234567"
                      maxLength={11}
                      required
                      className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Create Password <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min. 8 chars, 1 Upper, 1 Number, 1 Symbol"
                        required
                        className="w-full h-9 pl-3 pr-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 cursor-pointer"
                      >
                        {showRegPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Confirm Password <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        required
                        className="w-full h-9 pl-3 pr-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 cursor-pointer"
                      >
                        {showRegConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Valid Government ID Upload */}
              <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block flex items-center gap-1.5">
                  <CreditCard size={13} className="text-blue-600" />
                  4. Government ID Document Verification <span className="text-red-500 font-bold">*</span>
                </span>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Select Valid Government ID Type <span className="text-red-500 font-bold">*</span>
                  </label>
                  <select
                    value={regIdType}
                    onChange={(e) => setRegIdType(e.target.value)}
                    required
                    className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="">Select ID Type (PhilSys, Driver's License, etc.)</option>
                    {ID_TYPES.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ID Photo Upload Container */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Upload ID Photo (Front or Both Sides) <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />

                  {regIdPhoto ? (
                    <div className="p-3 bg-white dark:bg-slate-900 border-2 border-emerald-300 dark:border-emerald-700/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={regIdPhoto}
                          alt="Government ID"
                          className="w-14 h-11 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {regIdFileName || 'Government_ID_Attached.jpg'}
                          </p>
                          <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Image Validated &amp; Ready
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearIdPhoto}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl text-center cursor-pointer transition-all bg-white dark:bg-slate-900/60 hover:bg-blue-50/40 group"
                    >
                      <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                        <Camera size={18} />
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Click or Tap to Upload Government ID
                      </p>
                      <p className="text-[10.5px] text-slate-400 mt-0.5">
                        PNG, JPG, or JPEG up to 15MB (Auto-compressed for fast verification)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 5: Terms & Privacy Agreement */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="reg_existing_terms"
                  checked={regTermsAgreed}
                  onChange={(e) => setRegTermsAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="reg_existing_terms" className="text-xs text-slate-600 dark:text-slate-300 leading-snug cursor-pointer">
                  I certify that all information submitted is true and correct, and I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => { setTermsModalTab('privacy'); setIsTermsOpen(true); }}
                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    Data Privacy Policy
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => { setTermsModalTab('terms'); setIsTermsOpen(true); }}
                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    Terms of Service
                  </button>
                  .
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !regTermsAgreed}
                className={`w-full h-11 font-bold text-xs shadow-md transition-all rounded-xl mt-2 flex items-center justify-center gap-2 cursor-pointer ${
                  !regTermsAgreed
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
                }`}
              >
                {loading ? (
                  'Verifying Census Data...'
                ) : !regTermsAgreed ? (
                  <>
                    <Lock size={13} className="opacity-60" />
                    Accept Terms &amp; Privacy Policy to Submit
                  </>
                ) : (
                  <>
                    Submit Application &amp; Verify Census
                    <ArrowRight size={14} />
                  </>
                )}
              </Button>
            </form>
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

            {/* ── FULL SCREEN VERIFICATION & CONFIRMATION OVERLAY ── */}
      {verificationScreenState !== 'idle' && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#151824] border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-center space-y-5 relative overflow-hidden">
            {verificationScreenState === 'verifying' ? (
              <div className="py-6 space-y-6">
                {/* Pulsing Scanner Radar Icon */}
                <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                  <div className="absolute inset-2 rounded-full bg-blue-500/30 animate-pulse" />
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/40 relative z-10">
                    <RefreshCw size={32} className="animate-spin" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Verifying Resident Information...
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Please hold on while the system cross-references your inputted census profile with the Barangay Inhabitant Database.
                  </p>
                </div>

                {/* Animated Verification Milestones */}
                <div className="space-y-2.5 max-w-sm mx-auto text-left text-xs bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    {verifyingStep >= 1 ? (
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 animate-spin shrink-0" />
                    )}
                    <span className={verifyingStep >= 1 ? "text-slate-800 dark:text-slate-200 font-semibold" : "text-slate-400"}>
                      Checking civil registry &amp; demographic parameters
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {verifyingStep >= 2 ? (
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 animate-spin shrink-0" />
                    )}
                    <span className={verifyingStep >= 2 ? "text-slate-800 dark:text-slate-200 font-semibold" : "text-slate-400"}>
                      Cross-referencing Barangay Census Inhabitant records
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {verifyingStep >= 3 ? (
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 animate-spin shrink-0" />
                    )}
                    <span className={verifyingStep >= 3 ? "text-slate-800 dark:text-slate-200 font-semibold" : "text-slate-400"}>
                      Encrypting Government ID &amp; registering application
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Success State */
              <div className="py-4 space-y-5 animate-in zoom-in-95 duration-300">
                {/* Glowing Check Icon */}
                <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/35 relative z-10">
                    <CheckCircle2 size={44} className="stroke-[2.5]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-block">
                    ✓ Application Submitted Successfully
                  </span>

                  {/* EXACT MESSAGE REQUESTED BY USER */}
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white leading-snug">
                    Your application has been sent! Please wait for the admin to confirm it.
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                    Your census profile, credentials, and Government ID have been forwarded to the <strong>Barangay {regBarangay || 'Pianing'} Administration</strong> verification queue. The admin will verify your record against the database.
                  </p>
                </div>

                {/* Application Reference Card */}
                <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-left space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-500 font-medium text-[11px]">Application Reference Code</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                      {submittedAppCode || 'APP-2026-PENDING'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium text-[11px]">Accreditation Status</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                      Pending Admin Approval
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium text-[11px]">Notification Channels</span>
                    <span className="text-slate-700 dark:text-slate-300 text-[11px]">
                      SMS &amp; Email Notice upon Approval
                    </span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="space-y-2 pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setVerificationScreenState('idle');
                      setResidentMode('choose');
                      setActiveTab('login');
                    }}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    Return to Sign In
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationScreenState('idle');
                      navigate('/');
                    }}
                    className="w-full h-9 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Go to Homepage
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
