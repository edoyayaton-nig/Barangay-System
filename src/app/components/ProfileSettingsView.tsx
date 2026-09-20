import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import {
  UserCircle,
  Phone,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Building,
  CheckCircle2,
  Mail,
  User,
  Lock,
  Save,
  RotateCcw,
  Camera,
  Trash2,
  IdCard,
  Check,
  Crown
} from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

interface ProfileSettingsViewProps {
  user: any;
  onProfileUpdated?: (updatedUser: any) => void;
  darkMode?: boolean;
}

export default function ProfileSettingsView({ user, onProfileUpdated, darkMode }: ProfileSettingsViewProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDark = darkMode ?? (user?.role === 'super_mega_admin');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setProfilePhoto(user.profile_photo || user.avatar || null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [user]);

  const getRoleConfig = (role?: string) => {
    const r = (role || '').toLowerCase();
    if (r === 'super_mega_admin') {
      return {
        badge: 'bg-violet-950/80 text-violet-300 border-violet-700',
        accent: 'text-violet-400',
        bgAccent: 'bg-violet-950/60 border-violet-800 text-violet-300',
        btn: 'bg-violet-600 hover:bg-violet-700 shadow-violet-900/50',
        title: 'System Owner & Master Operator',
        station: 'Platform Central Control Dock (Host Provider)',
        clearance: 'Full Root Authority (System Owner)',
        badgeLabel: 'Master Root Key #001',
        profileType: 'Root Platform Operator',
        credentialsTitle: 'System Owner Profile & Access Keys',
        credentialsDesc: 'Master credentials for platform infrastructure, root auditing, and client tenant management.',
        nameHelper: 'Displayed on system advisories, platform release notes, and municipal audit logs.',
        emailHelper: 'Primary master root login for system administration and emergency disaster recovery.',
        mobileHelper: 'Direct emergency hotline for high-severity uptime alerts and security incident notices.',
        jurisdiction: 'Central System Host — All Registered Client Barangays',
        jurisdictionHelper: 'Full platform-level access across all client barangay tenants.'
      };
    }
    if (r === 'superadmin') {
      return {
        badge: isDark ? 'bg-purple-950/80 text-purple-300 border-purple-700' : 'bg-purple-50 text-purple-800 border-purple-200',
        accent: isDark ? 'text-purple-400' : 'text-purple-600',
        bgAccent: isDark ? 'bg-purple-950/60 border-purple-800 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-800',
        btn: 'bg-purple-600 hover:bg-purple-700 shadow-purple-900/40',
        title: 'Barangay Chief Executive Administrator',
        station: `Barangay ${user?.barangay || 'Pianing'} Central Office`,
        clearance: 'Barangay Head Administrator',
        badgeLabel: `Official Super Admin #${user?.employee_id || user?.id || '01'}`,
        profileType: 'Barangay Executive Profile',
        credentialsTitle: 'Executive Profile Credentials',
        credentialsDesc: 'Official administrative credentials for barangay governance, certificate signing, and staff oversight.',
        nameHelper: 'Appears on official barangay certificates, clearances, and municipal governance records.',
        emailHelper: 'Primary institutional email used for portal administration and official constituent communications.',
        mobileHelper: 'Official mobile number for barangay administrative notices and emergency broadcasts.',
        jurisdiction: `Barangay ${user?.barangay || 'Pianing'} Jurisdiction`,
        jurisdictionHelper: `Executive administrative authority over Barangay ${user?.barangay || 'Pianing'}.`
      };
    }
    if (r === 'admin') {
      return {
        badge: isDark ? 'bg-blue-950/80 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-800 border-blue-200',
        accent: isDark ? 'text-blue-400' : 'text-blue-600',
        bgAccent: isDark ? 'bg-blue-950/60 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800',
        btn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/40',
        title: 'Barangay Administrator',
        station: `Barangay ${user?.barangay || 'Pianing'} Hall Station`,
        clearance: 'Administrative Staff Access',
        badgeLabel: `Staff Badge #${user?.employee_id || user?.id || 'ADM-01'}`,
        profileType: 'Administrative Staff Profile',
        credentialsTitle: 'Official Administrative Profile',
        credentialsDesc: 'Authorized staff credentials for processing document requests and community registrations.',
        nameHelper: 'Displayed on processed certificates and administrative approval records.',
        emailHelper: 'Used for administrative portal sign-in and official dispatch notifications.',
        mobileHelper: 'Mobile phone for urgent administrative notices.',
        jurisdiction: `Barangay ${user?.barangay || 'Pianing'} Municipal Desk`,
        jurisdictionHelper: `Stationed at Barangay ${user?.barangay || 'Pianing'}.`
      };
    }
    if (r === 'nurse') {
      return {
        badge: 'bg-teal-50 text-teal-800 border-teal-200',
        accent: 'text-teal-600',
        bgAccent: 'bg-teal-50 border-teal-200 text-teal-800',
        btn: 'bg-teal-600 hover:bg-teal-700',
        title: 'Public Health Nurse (EHR)',
        station: `Barangay ${user?.barangay || 'Pianing'} Health Center`,
        clearance: 'Clinical Healthcare Access',
        badgeLabel: `Nurse ID #${user?.employee_id || user?.id || 'NUR-01'}`,
        profileType: 'Healthcare Practitioner Profile',
        credentialsTitle: 'Official Clinical Credentials',
        credentialsDesc: 'Authorized practitioner identity across official EHR records, consultations, and prescriptions.',
        nameHelper: 'Appears on official consultation records, vaccine logs, and medical clearances.',
        emailHelper: 'Institutional email for clinic schedules and health advisory dispatch.',
        mobileHelper: 'Contact number for clinic emergencies and maternal follow-ups.',
        jurisdiction: `Barangay ${user?.barangay || 'Pianing'} Health Center`,
        jurisdictionHelper: `Clinical station in Barangay ${user?.barangay || 'Pianing'}.`
      };
    }
    if (r === 'bhw') {
      return {
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        accent: 'text-emerald-600',
        bgAccent: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        btn: 'bg-emerald-600 hover:bg-emerald-700',
        title: 'Barangay Health Worker',
        station: `Barangay ${user?.barangay || 'Pianing'} Health Unit`,
        clearance: 'Community Health Worker Access',
        badgeLabel: `BHW Badge #${user?.employee_id || user?.id || 'BHW-01'}`,
        profileType: 'Community Health Profile',
        credentialsTitle: 'Community Health Worker Credentials',
        credentialsDesc: 'Identity used for maternal mapping, community census, and household health visits.',
        nameHelper: 'Appears on community health forms and resident outreach records.',
        emailHelper: 'Contact email for barangay health worker announcements.',
        mobileHelper: 'Mobile phone for field coordination and household visits.',
        jurisdiction: `Barangay ${user?.barangay || 'Pianing'} Health Unit`,
        jurisdictionHelper: `Community healthcare assignment in Barangay ${user?.barangay || 'Pianing'}.`
      };
    }
    return {
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      accent: 'text-amber-600',
      bgAccent: 'bg-amber-50 border-amber-200 text-amber-800',
      btn: 'bg-amber-600 hover:bg-amber-700',
      title: 'Barangay Staff Officer',
      station: `Barangay ${user?.barangay || 'Pianing'} Municipal Desk`,
      clearance: 'Official Staff Access',
      badgeLabel: `Badge #${user?.employee_id || user?.id || 'STAFF-01'}`,
      profileType: 'Verified System Profile',
      credentialsTitle: 'Official Profile Credentials',
      credentialsDesc: 'Staff credentials used across municipal service processing.',
      nameHelper: 'Appears on official transaction receipts and processing records.',
      emailHelper: 'Primary email used for municipal portal sign-in.',
      mobileHelper: 'Mobile number for emergency notifications and system alerts.',
      jurisdiction: `Barangay ${user?.barangay || 'Pianing'} Municipal Desk`,
      jurisdictionHelper: `Municipal desk in Barangay ${user?.barangay || 'Pianing'}.`
    };
  };

  const roleConfig = getRoleConfig(user?.role);

  const getInitials = (nameStr?: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return nameStr.slice(0, 2).toUpperCase();
  };

  // Image Upload with Client-Side Canvas Optimization
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, or WEBP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size too large. Please select an image under 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setProfilePhoto(compressedDataUrl);
          toast.success('Profile photo ready to save');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setProfilePhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.info('Photo marked for removal. Click Save to apply.');
  };

  const calculatePasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const passStrength = calculatePasswordStrength(newPassword);
  const getStrengthLabel = (score: number) => {
    switch (score) {
      case 1: return { label: 'Weak', color: 'bg-rose-500', text: 'text-rose-500' };
      case 2: return { label: 'Fair', color: 'bg-amber-500', text: 'text-amber-500' };
      case 3: return { label: 'Good', color: 'bg-blue-500', text: 'text-blue-500' };
      case 4: return { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-500' };
      default: return { label: 'Too Short', color: 'bg-slate-300', text: 'text-slate-400' };
    }
  };
  const strengthInfo = getStrengthLabel(passStrength);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter your official name');
      return;
    }

    if (!email.trim()) {
      toast.error('Email address is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        toast.error('New password must be at least 6 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('New passwords do not match');
        return;
      }
      if (!currentPassword) {
        toast.error('Current password is required to set a new password');
        return;
      }
    }

    const emailChanged = user?.email && email.trim().toLowerCase() !== user.email.toLowerCase();
    if (emailChanged && !currentPassword && !newPassword) {
      toast.error('Please enter your current password to authorize changing your login email');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        profile_photo: profilePhoto
      };

      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      if (emailChanged) {
        payload.current_password = currentPassword;
      }

      const updated = await apiService.updateUserProfile(payload);

      const currentUser = JSON.parse(localStorage.getItem('barangay_user') || '{}');
      const merged = { ...currentUser, ...updated, profile_photo: profilePhoto };
      localStorage.setItem('barangay_user', JSON.stringify(merged));

      if (onProfileUpdated) {
        onProfileUpdated(merged);
      }

      toast.success('Profile settings updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile settings. Please verify current password.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setProfilePhoto(user.profile_photo || user.avatar || null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.info('Form reverted to current settings');
    }
  };

  // Theme styling tokens based on isDark
  const theme = {
    card: isDark ? 'bg-[#111827] border-[#1F293D] text-[#E2E8F0]' : 'bg-white border-slate-200 text-slate-900',
    subCard: isDark ? 'bg-[#161F30] border-[#1F293D] text-[#E2E8F0]' : 'bg-slate-50/70 border-slate-200/70 text-slate-800',
    headerBg: isDark ? 'bg-[#161F30]/90 border-[#1F293D]' : 'bg-slate-50/40 border-slate-100',
    input: isDark ? 'bg-[#0F172A] border-[#1F293D] text-[#E2E8F0] placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500' : 'bg-white border-slate-200 text-slate-900 focus:border-teal-500 focus:ring-teal-500',
    inputDisabled: isDark ? 'bg-[#0B1120] border-[#1F293D] text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed',
    label: isDark ? 'text-slate-300' : 'text-slate-700',
    muted: isDark ? 'text-slate-400' : 'text-slate-500',
    divider: isDark ? 'border-[#1F293D]' : 'border-slate-100',
    heading: isDark ? 'text-white' : 'text-slate-900',
    btnOutline: isDark ? 'border-[#1F293D] text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50',
    badgeBox: isDark ? 'bg-[#161F30] border-[#1F293D] text-slate-300' : 'bg-slate-50 border-slate-200/80 text-slate-500',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hidden File Input for Avatar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* ═══ TOP IDENTITY HERO CARD ══════════════════════════════════════ */}
      <div className={`border rounded-3xl p-6 shadow-sm transition-all ${theme.card}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar / Photo with Hover Overlay */}
            <div className="relative group shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-inner border border-violet-500/20 flex items-center justify-center bg-gradient-to-br from-violet-600/30 to-cyan-600/30">
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt={name || 'Profile'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-violet-600/20 text-violet-300 text-2xl font-bold font-mono">
                    {getInitials(name || user?.name)}
                  </div>
                )}
              </div>

              {/* Upload trigger overlay button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`absolute -bottom-1 -right-1 p-2 rounded-xl border shadow-sm cursor-pointer transition-transform hover:scale-105 ${
                  isDark ? 'bg-[#161F30] hover:bg-[#1E293B] text-slate-200 border-[#1F293D]' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Upload photo"
              >
                <Camera size={14} />
              </button>
            </div>

            {/* Profile Identity Details */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${theme.heading}`}>
                  {name || user?.name || 'Administrator'}
                </h1>
                <Badge className={`text-xs font-semibold px-2.5 py-0.5 border ${roleConfig.badge}`}>
                  {(user?.role || 'Staff').toUpperCase()}
                </Badge>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full font-medium">
                  <CheckCircle2 size={12} /> Active Account
                </span>
              </div>

              <p className={`text-xs mt-1.5 flex items-center gap-2 flex-wrap font-medium ${theme.muted}`}>
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-slate-400" /> {email || user?.email || 'admin@barangay.gov.ph'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Building size={13} className="text-slate-400" /> {user?.barangay ? `Barangay ${user.barangay}` : 'City-Wide Platform Host'}
                </span>
              </p>

              {/* Photo Action Buttons */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className={`h-8 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer ${theme.btnOutline}`}
                >
                  <Camera size={13} className={roleConfig.accent} />
                  <span>{profilePhoto ? 'Change Photo' : 'Upload Photo'}</span>
                </Button>

                {profilePhoto && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRemovePhoto}
                    className="h-8 text-xs font-semibold rounded-xl border-rose-500/30 text-rose-400 hover:bg-rose-950/40 gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Remove Photo</span>
                  </Button>
                )}

                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  PNG, JPG, or WEBP (auto-optimized)
                </span>
              </div>
            </div>
          </div>

          {/* Account ID / Clearance Pill */}
          <div className={`text-xs px-4 py-3 rounded-2xl border shrink-0 space-y-1 ${theme.badgeBox}`}>
            <div className={`flex items-center gap-1.5 font-bold ${theme.heading}`}>
              {user?.role === 'super_mega_admin' ? (
                <Crown size={14} className="text-amber-400" />
              ) : (
                <IdCard size={14} className={roleConfig.accent} />
              )}
              <span>{roleConfig.badgeLabel}</span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400" />
              <span>{roleConfig.profileType}</span>
            </p>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className={`mt-6 pt-5 border-t grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs ${theme.divider}`}>
          <div className={`p-3 rounded-xl border ${theme.subCard}`}>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Official Designation</span>
            <span className={`font-bold mt-0.5 block truncate ${theme.heading}`}>{user?.job_title || roleConfig.title}</span>
          </div>
          <div className={`p-3 rounded-xl border ${theme.subCard}`}>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Assigned Station</span>
            <span className={`font-bold mt-0.5 block truncate ${theme.heading}`}>{roleConfig.station}</span>
          </div>
          <div className={`p-3 rounded-xl border ${theme.subCard}`}>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Clearance Level</span>
            <span className={`font-bold mt-0.5 block truncate ${theme.heading}`}>{roleConfig.clearance}</span>
          </div>
          <div className={`p-3 rounded-xl border ${theme.subCard}`}>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Security Status</span>
            <span className="font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
              <CheckCircle2 size={12} /> Protected
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ═══ SECTION 1: PROFILE INFORMATION ════════════════════════════════ */}
        <Card className={`border rounded-3xl shadow-sm overflow-hidden ${theme.card}`}>
          <div className={`border-b p-5 flex items-center justify-between ${theme.headerBg}`}>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${roleConfig.bgAccent}`}>
                <UserCircle size={17} />
              </div>
              <div>
                <h2 className={`text-sm font-bold ${theme.heading}`}>{roleConfig.credentialsTitle}</h2>
                <p className={`text-[11px] ${theme.muted}`}>{roleConfig.credentialsDesc}</p>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Step 1 of 2</span>
          </div>

          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className={`text-xs font-semibold ${theme.label}`}>Official Full Name <span className="text-red-500">*</span></Label>
                <div className="relative mt-1.5">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Maria Santos"
                    required
                    className={`pl-10 h-10 text-xs rounded-xl ${theme.input}`}
                  />
                </div>
                <p className={`text-[11px] mt-1 ${theme.muted}`}>{roleConfig.nameHelper}</p>
              </div>

              <div>
                <Label className={`text-xs font-semibold ${theme.label}`}>Contact Mobile Phone</Label>
                <div className="relative mt-1.5">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                    className={`pl-10 h-10 text-xs font-mono rounded-xl ${theme.input}`}
                  />
                </div>
                <p className={`text-[11px] mt-1 ${theme.muted}`}>{roleConfig.mobileHelper}</p>
              </div>

              <div>
                <Label className={`text-xs font-semibold flex items-center justify-between ${theme.label}`}>
                  <span>Official Email Address (Login ID) <span className="text-red-500">*</span></span>
                  {user?.email && email.trim().toLowerCase() !== user.email.toLowerCase() && (
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/60">
                      Changing Email
                    </span>
                  )}
                </Label>
                <div className="relative mt-1.5">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@barangay.gov.ph"
                    required
                    className={`pl-10 h-10 text-xs rounded-xl ${theme.input}`}
                  />
                </div>
                <p className={`text-[11px] mt-1 ${theme.muted}`}>{roleConfig.emailHelper}</p>

                {/* Password confirmation prompt when changing email */}
                {user?.email && email.trim().toLowerCase() !== user.email.toLowerCase() && (
                  <div className={`mt-2.5 p-3.5 border rounded-xl space-y-2 ${isDark ? 'bg-amber-950/40 border-amber-800/60' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                      <Lock size={13} className="text-amber-400" />
                      <span>Authorize Email Credential Change</span>
                    </div>
                    <p className={`text-[11px] leading-snug ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>
                      Changing your official login email to <strong>{email.trim()}</strong> requires your current password to authorize.
                    </p>
                    <div className="relative">
                      <Input
                        type={showCurrentPass ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Current account password"
                        className={`h-9 text-xs pr-9 rounded-lg ${theme.input}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(p => !p)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                        tabIndex={-1}
                      >
                        {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label className={`text-xs font-semibold ${theme.label}`}>Jurisdiction &amp; Platform Station Assignment</Label>
                <div className="relative mt-1.5">
                  <Building size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={roleConfig.jurisdiction}
                    readOnly
                    disabled
                    className={`pl-10 h-10 text-xs rounded-xl ${theme.inputDisabled}`}
                  />
                </div>
                <p className={`text-[11px] mt-1 ${theme.muted}`}>{roleConfig.jurisdictionHelper}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ SECTION 2: SECURITY & PASSWORD PROTECTION ═════════════════════ */}
        <Card className={`border rounded-3xl shadow-sm overflow-hidden ${theme.card}`}>
          <div className={`border-b p-5 flex items-center justify-between ${theme.headerBg}`}>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${roleConfig.bgAccent}`}>
                <KeyRound size={17} />
              </div>
              <div>
                <h2 className={`text-sm font-bold ${theme.heading}`}>Security &amp; Password Management</h2>
                <p className={`text-[11px] ${theme.muted}`}>Protect your institutional access with strong credential encryption</p>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Leave blank to keep unchanged</span>
          </div>

          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className={`text-xs font-semibold ${theme.label}`}>Current Password</Label>
                <div className="relative mt-1.5">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className={`pl-10 pr-9 h-10 text-xs rounded-xl ${theme.input}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <Label className={`text-xs font-semibold ${theme.label}`}>New Password</Label>
                <div className="relative mt-1.5">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className={`pl-10 pr-9 h-10 text-xs rounded-xl ${theme.input}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <Label className={`text-xs font-semibold ${theme.label}`}>Confirm New Password</Label>
                <div className="relative mt-1.5">
                  <ShieldCheck size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className={`pl-10 h-10 text-xs rounded-xl ${theme.input}`}
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Password Strength Indicator */}
            {newPassword && (
              <div className={`p-4 border rounded-2xl space-y-2.5 ${theme.subCard}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-semibold flex items-center gap-1.5 ${theme.label}`}>
                    <ShieldCheck size={14} className={strengthInfo.text} />
                    Password Strength: <strong className={strengthInfo.text}>{strengthInfo.label}</strong>
                  </span>
                  {confirmPassword && (
                    <span className={`font-semibold ${newPassword === confirmPassword ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </span>
                  )}
                </div>

                {/* 4-Level Strength Progress Bars */}
                <div className="grid grid-cols-4 gap-1.5 h-1.5">
                  <div className={`rounded-full transition-all ${passStrength >= 1 ? strengthInfo.color : (isDark ? 'bg-slate-700' : 'bg-slate-200')}`} />
                  <div className={`rounded-full transition-all ${passStrength >= 2 ? strengthInfo.color : (isDark ? 'bg-slate-700' : 'bg-slate-200')}`} />
                  <div className={`rounded-full transition-all ${passStrength >= 3 ? strengthInfo.color : (isDark ? 'bg-slate-700' : 'bg-slate-200')}`} />
                  <div className={`rounded-full transition-all ${passStrength >= 4 ? strengthInfo.color : (isDark ? 'bg-slate-700' : 'bg-slate-200')}`} />
                </div>

                {/* Checklist Pills */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                  <span className={`inline-flex items-center gap-1 ${newPassword.length >= 6 ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                    {newPassword.length >= 6 ? <Check size={12} /> : '•'} At least 6 characters
                  </span>
                  <span className={`inline-flex items-center gap-1 ${newPassword.length >= 8 ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                    {newPassword.length >= 8 ? <Check size={12} /> : '•'} 8+ characters recommended
                  </span>
                  <span className={`inline-flex items-center gap-1 ${/[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                    {/[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword) ? <Check size={12} /> : '•'} Contains number or symbol
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ ACTION BAR ════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className={`text-xs gap-1.5 rounded-2xl cursor-pointer h-10 px-4 ${theme.btnOutline}`}
          >
            <RotateCcw size={13} /> Reset Changes
          </Button>

          <Button
            type="submit"
            disabled={saving}
            className={`${roleConfig.btn} text-white text-xs font-bold gap-2 px-6 h-10 rounded-2xl cursor-pointer transition-all hover:shadow-md`}
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save size={14} /> Save Profile Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
