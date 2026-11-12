import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Shield,
  ArrowRight,
  Phone,
  Mail,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  X,
  AlertCircle,
  Building2,
  LogIn,
  KeyRound,
  Users,
  Loader2,
  RefreshCw,
  Send,
  Sparkles
} from 'lucide-react';
import { apiService, MaskedCensusResult } from '../../services/api';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { BUTUAN_BARANGAYS } from '../../utils/barangays';
import { saveStoredUser } from '../../utils/safeStorage';
import TermsAndPrivacyModal from '../components/TermsAndPrivacyModal';
import SystemNoticeBanner from '../components/SystemNoticeBanner';
import ThemeToggle from '../components/ThemeToggle';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Primary Tab State: 'login' | 'search' (Create Account completely removed)
  const [activeTab, setActiveTab] = useState<'login' | 'search'>('login');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'search' || tabParam === 'register') {
      setActiveTab('search');
    } else {
      setActiveTab('login');
    }
  }, [location.search]);

  // Login Credentials State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Terms & Privacy Modal
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [termsModalTab, setTermsModalTab] = useState<'privacy' | 'terms'>('privacy');
  const [regTermsAgreed, setRegTermsAgreed] = useState(false);

  // ── Public Resident Search Engine State ──────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBarangay, setSearchBarangay] = useState('Barangay Pianing');
  const [searchResults, setSearchResults] = useState<MaskedCensusResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Phone Confirmation & Credential Delivery Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState<MaskedCensusResult | null>(null);
  const [confirmPhone, setConfirmPhone] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<{ masked_email: string; email?: string; message: string } | null>(null);

  // Live Debounced Public Census Search
  useEffect(() => {
    if (activeTab !== 'search') return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const cleanBrgy = searchBarangay === 'all' || searchBarangay === 'All Barangays' ? '' : searchBarangay;
        const res = await apiService.publicSearchCensus(q, cleanBrgy);
        setSearchResults(res.results || []);
        setHasSearched(true);
      } catch (err: any) {
        setSearchError(err?.message || 'Failed to search census database');
      } finally {
        setIsSearching(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [searchQuery, searchBarangay, activeTab]);

  const handleManualSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) {
      toast.error('Search query too short', { description: 'Please type at least 2 characters (name or phone).' });
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      const cleanBrgy = searchBarangay === 'all' || searchBarangay === 'All Barangays' ? '' : searchBarangay;
      const res = await apiService.publicSearchCensus(q, cleanBrgy);
      setSearchResults(res.results || []);
      setHasSearched(true);
    } catch (err: any) {
      setSearchError(err?.message || 'Failed to search census database');
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenClaimModal = (resident: MaskedCensusResult) => {
    setSelectedResident(resident);
    setConfirmPhone('');
    setClaimEmail('');
    setClaimError(null);
    setClaimSuccess(null);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmAndClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResident) return;

    const cleanInputPhone = confirmPhone.replace(/[^0-9]/g, '');
    if (!cleanInputPhone || cleanInputPhone.length < 10) {
      setClaimError('Please enter your complete valid 11-digit mobile number (e.g. 09171234567).');
      return;
    }

    if (!selectedResident.has_email && !claimEmail.trim()) {
      setClaimError('Your census record has no email address. Please provide your Gmail so we can deliver your credentials.');
      return;
    }

    setIsClaiming(true);
    setClaimError(null);

    try {
      const res = await apiService.claimCensusCredentials(
        selectedResident.id,
        cleanInputPhone,
        claimEmail.trim() || undefined
      );

      if (res.success) {
        setClaimSuccess({
          masked_email: res.masked_email || 'your registered email',
          email: res.email,
          message: res.message || 'Claim submitted successfully! Your account is now pending Barangay Admin approval. Once approved, your login credentials will be delivered to your email and phone.'
        });
        toast.success('Claim Submitted — Pending Admin Approval', {
          description: `Application forwarded to Barangay Admin. Once approved, your login credentials will be delivered to ${res.masked_email || 'your Gmail'}.`
        });
        // Immediately remove claimed resident from public search database results
        setSearchResults(prev => prev.filter(r => r.id !== selectedResident.id));
      } else {
        setClaimError(res.error || 'Failed to verify phone number. Please ensure it matches your census record.');
      }
    } catch (err: any) {
      setClaimError(err?.message || 'Server connection error. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

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
          navigate('/resident');
        }
      } else {
        toast.error('Invalid credentials', {
          description: 'Please verify your registered email and password.'
        });
      }
    } catch (err: any) {
      toast.error('Authentication Failed', {
        description: err.message || 'Unable to sign in. Please verify your credentials or check your connection.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] dark:bg-slate-950 flex flex-col font-sans transition-colors">
      <SystemNoticeBanner />

      {/* Top Navbar */}
      <header className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-[#D5E2E8] dark:border-slate-800 px-4 sm:px-8 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-white shadow-xs border border-[#173B5E]/20 flex items-center justify-center p-0.5">
            <img src="/assets/pianing-logo.png" alt="Barangay Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#173B5E] dark:text-white leading-none">Smart Barangay Portal</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Smart Public Health &amp; Admin Portal</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-4 sm:py-6">
        <div
          className={`w-full bg-white dark:bg-slate-900 border border-[#D5E2E8] dark:border-[#223A50] shadow-[0_12px_36px_-6px_rgba(23,59,94,0.12)] rounded-3xl p-6 sm:p-8 transition-all duration-300 ${
            activeTab === 'login' ? 'max-w-[430px]' : 'max-w-2xl'
          }`}
        >
          {/* Header */}
          <div className="text-center pb-4">
            <div className="mx-auto w-12 h-12 rounded-full overflow-hidden bg-white shadow-md border-2 border-[#173B5E]/30 flex items-center justify-center mb-2.5">
              <img src="/assets/pianing-logo.png" alt="Smart Barangay Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Smart Barangay Portal</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Access Barangay Admin, BHW Health Portal, or Resident Services
            </p>
          </div>

          {/* Tab Switcher Capsule: Sign In vs Resident Search Engine */}
          <div className="flex justify-center mb-5">
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200/80 dark:border-slate-700 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'login'
                    ? 'bg-gradient-to-r from-[#173B5E] to-[#006B66] text-white shadow-md'
                    : 'text-slate-500 hover:text-[#006B66] dark:text-slate-400'
                }`}
              >
                <LogIn size={13} />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'search'
                    ? 'bg-gradient-to-r from-[#173B5E] to-[#006B66] text-white shadow-md'
                    : 'text-slate-500 hover:text-[#006B66] dark:text-slate-400'
                }`}
              >
                <Search size={13} />
                Resident Search Engine
              </button>
            </div>
          </div>

          {/* ── TAB 1: SIGN IN ──────────────────────────────────────────────── */}
          {activeTab === 'login' && (
            <div className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-3.5" autoComplete="off">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Email Address <span className="text-[#B42318] font-bold">*</span>
                  </label>
                  <input
                    type="email"
                    name="login_user_email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. name@email.com"
                    required
                    className="w-full h-10 px-4 bg-slate-50/80 dark:bg-slate-800 border border-[#D5E2E8] dark:border-slate-700 rounded-full text-xs text-slate-800 dark:text-white focus:bg-white focus:border-[#006B66] focus:ring-2 focus:ring-[#006B66]/20 outline-none transition-all shadow-inner"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Password <span className="text-[#B42318] font-bold">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotPasswordOpen(true)}
                      className="text-[10.5px] font-bold text-[#006B66] dark:text-teal-400 hover:underline cursor-pointer"
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
                      className="w-full h-10 px-4 pr-10 bg-slate-50/80 dark:bg-slate-800 border border-[#D5E2E8] dark:border-slate-700 rounded-full text-xs text-slate-800 dark:text-white focus:bg-white focus:border-[#006B66] focus:ring-2 focus:ring-[#006B66]/20 outline-none transition-all shadow-inner"
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

              {/* Census resident quick search callout */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                  Already recorded in your Barangay Census?
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('search')}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-[#006B66] dark:text-teal-400 hover:underline cursor-pointer"
                >
                  <Search size={12} />
                  Search your record to claim login credentials &rarr;
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 2: RESIDENT SEARCH ENGINE ───────────────────────────────── */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Shield size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-blue-900 dark:text-blue-300">
                        Official Barangay Census Search Engine
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200">
                        RA 10173 Privacy Protected
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      Search by <strong>Resident Name</strong> or <strong>Phone Number</strong> to check your civil registry status. All demographic details are masked to safeguard citizen privacy. Once found, simply confirm your registered mobile number to receive your login credentials directly in your Gmail.
                    </p>
                  </div>
                </div>
              </div>

              {/* Search Controls */}
              <form onSubmit={handleManualSearch} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Barangay Dropdown Filter */}
                  <div className="sm:col-span-1">
                    <label className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Barangay Jurisdiction
                    </label>
                    <select
                      value={searchBarangay}
                      onChange={(e) => setSearchBarangay(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-[#006B66]/30 outline-none"
                    >
                      <option value="all">All Barangays (Butuan City)</option>
                      <option value="Barangay Pianing">Barangay Pianing (Default)</option>
                      {BUTUAN_BARANGAYS.filter((b) => b !== 'Pianing').map((b) => (
                        <option key={b} value={`Barangay ${b}`}>
                          Barangay {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Input */}
                  <div className="sm:col-span-2">
                    <label className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Search Inhabitant (Name or Phone Number)
                    </label>
                    <div className="relative flex items-center">
                      <Search size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="e.g. Juan dela Cruz or 09171234567"
                        className="w-full h-10 pl-9 pr-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-[#006B66]/30 outline-none"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setSearchResults([]);
                            setHasSearched(false);
                          }}
                          className="absolute right-16 text-slate-400 hover:text-slate-600 p-1"
                        >
                          <X size={13} />
                        </button>
                      )}
                      <Button
                        type="submit"
                        disabled={isSearching || searchQuery.trim().length < 2}
                        className="absolute right-1 h-8 px-3 bg-[#006B66] hover:bg-[#005753] text-white text-[11px] font-bold rounded-lg cursor-pointer"
                      >
                        {isSearching ? <Loader2 size={12} className="animate-spin" /> : 'Search'}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Search Results Area */}
              <div className="space-y-2.5 pt-1">
                {isSearching && (
                  <div className="py-8 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto text-[#006B66] mb-2" />
                    <p className="text-xs">Searching official civil census registry...</p>
                  </div>
                )}

                {searchError && (
                  <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center gap-2.5 text-red-700 dark:text-red-300 text-xs">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{searchError}</span>
                  </div>
                )}

                {!isSearching && hasSearched && searchResults.length === 0 && (
                  <div className="py-8 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
                    <Users size={28} className="mx-auto text-slate-400 mb-2" />
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      No Censused Resident Found
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                      We could not find an official census record matching &ldquo;{searchQuery}&rdquo; in {searchBarangay}.
                      If you are a new resident or have not yet been profiled, please visit your <strong>Barangay Hall</strong> with a valid government ID to conduct your demographic census.
                    </p>
                  </div>
                )}

                {!isSearching && !hasSearched && searchQuery.length < 2 && (
                  <div className="py-8 px-4 text-center border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-slate-50/30 dark:bg-slate-900/30">
                    <Sparkles size={24} className="mx-auto text-[#006B66] mb-2" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Type your Name or Registered Mobile Number to Search
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Enter at least 2 characters to look up your civil registry census profile.
                    </p>
                  </div>
                )}

                {/* Masked Results List */}
                {!isSearching && searchResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Matching Census Records ({searchResults.length})
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={11} /> Masked for privacy
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 max-h-[380px] overflow-y-auto pr-1">
                      {searchResults.map((resident) => (
                        <div
                          key={resident.id}
                          className="p-3.5 bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl hover:border-[#006B66]/60 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">
                                {resident.masked_name}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Censused Resident
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Building2 size={11} className="text-[#006B66]" />
                                Barangay {resident.barangay} ({resident.purok})
                              </span>
                              <span className="flex items-center gap-1">
                                <Phone size={11} className="text-blue-600" />
                                {resident.masked_phone}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail size={11} className="text-amber-600" />
                                {resident.masked_email ? resident.masked_email : 'No email on file'}
                              </span>
                            </div>
                          </div>

                          <Button
                            type="button"
                            onClick={() => handleOpenClaimModal(resident)}
                            className="h-8 px-3.5 bg-gradient-to-r from-[#173B5E] to-[#006B66] hover:from-[#112a43] hover:to-[#005753] text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs whitespace-nowrap self-end sm:self-center flex items-center gap-1.5"
                          >
                            <KeyRound size={12} />
                            Confirm Phone to Claim
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── MODAL: CONFIRM PHONE NUMBER & DELIVER CREDENTIALS ──────────── */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 max-w-sm sm:max-w-md rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <DialogHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[#006B66]/10 border border-[#006B66]/30 flex items-center justify-center text-[#006B66] dark:text-teal-400 mb-2">
              <KeyRound size={22} />
            </div>
            <DialogTitle className="text-slate-900 dark:text-white font-bold text-center text-base">
              Confirm Phone &amp; Claim Citizen Account
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
              Confirm your registered mobile number to submit your account claim for Barangay Admin approval.
            </DialogDescription>
          </DialogHeader>

          {/* Success State */}
          {claimSuccess ? (
            <div className="space-y-4 py-2 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 size={26} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Claim Submitted — Pending Admin Approval</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  Your identity claim has been forwarded to the Barangay Administration. Your account is now in the <strong>Pending for Approval</strong> queue.
                </p>
                <div className="mt-2.5 py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Credentials Destination:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{claimSuccess.masked_email}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700">
                    Once the Barangay Admin verifies and approves your claim, your official login email and default password will be automatically sent to your Gmail and phone.
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setActiveTab('login');
                  if (claimSuccess.email) setEmail(claimSuccess.email);
                }}
                className="w-full h-10 bg-[#006B66] hover:bg-[#005753] text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Return to Sign In &rarr;
              </Button>
            </div>
          ) : (
            <form onSubmit={handleConfirmAndClaim} className="space-y-3.5 pt-1">
              {/* Target resident banner */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Inhabitant:</span>
                  <strong className="text-slate-800 dark:text-white">{selectedResident?.masked_name}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Barangay:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    Barangay {selectedResident?.barangay} ({selectedResident?.purok})
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Census Phone Hint:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{selectedResident?.masked_phone}</span>
                </div>
              </div>

              {/* Error Banner */}
              {claimError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{claimError}</span>
                </div>
              )}

              {/* Confirm Phone Input */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Enter Registered 11-Digit Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="tel"
                    value={confirmPhone}
                    onChange={(e) => setConfirmPhone(e.target.value)}
                    placeholder="09171234567"
                    required
                    maxLength={11}
                    className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-[#006B66]/30 outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Must match the mobile phone registered during your demographic census.
                </p>
              </div>

              {/* If resident has no email on file, ask for Gmail */}
              {!selectedResident?.has_email && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Your Gmail / Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      value={claimEmail}
                      onChange={(e) => setClaimEmail(e.target.value)}
                      placeholder="e.g. name@gmail.com"
                      required
                      className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-[#006B66]/30 outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    Your census record did not include an email. Provide your Gmail to receive credentials.
                  </p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isClaiming || confirmPhone.trim().length < 10}
                  className="h-9 px-4 bg-[#006B66] hover:bg-[#005753] text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  {isClaiming ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  {isClaiming ? 'Submitting Claim...' : 'Submit Claim for Approval'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Forgot Password / Recovery Assistance Modal */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 max-w-sm sm:max-w-md rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xl">
          <DialogHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-2">
              <Shield size={24} />
            </div>
            <DialogTitle className="text-slate-900 dark:text-white font-bold text-center text-lg">
              Account Recovery Assistance
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 text-center mt-1">
              Smart Barangay Citizen &amp; Official Identity Management
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 mt-2">
            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900 rounded-xl space-y-1.5">
              <strong className="text-blue-900 dark:text-blue-300 font-bold block">For Registered Residents:</strong>
              <p>
                To maintain compliance with the Data Privacy Act (RA 10173), password resets require identity verification. You can search your record in the <strong>Resident Search Engine</strong> tab to confirm your phone and receive a password reset to your registered email, or visit your Barangay Hall.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
              <strong className="text-slate-900 dark:text-white font-bold block">For Staff &amp; Health Workers:</strong>
              <p>
                Please contact the <strong>Super Administrator</strong> or Barangay IT Officer to reset your access key.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <Button
              type="button"
              onClick={() => setIsForgotPasswordOpen(false)}
              className="w-full bg-[#006B66] hover:bg-[#005753] text-white font-semibold text-xs rounded-xl cursor-pointer"
            >
              Understood
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Terms & Privacy Modal */}
      <TermsAndPrivacyModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
        initialTab={termsModalTab}
        onAgree={() => {
          setRegTermsAgreed(true);
          setIsTermsOpen(false);
          toast.success('Terms & Data Privacy Policy Reviewed', {
            description: 'You have agreed to Republic Act No. 10173 and Citizen Terms of Service.'
          });
        }}
      />

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
            className="text-[#006B66] dark:text-teal-400 hover:underline font-medium cursor-pointer"
          >
            Privacy Policy &amp; Citizen Terms of Service (RA 10173)
          </button>
        </p>
      </footer>
    </div>
  );
}
