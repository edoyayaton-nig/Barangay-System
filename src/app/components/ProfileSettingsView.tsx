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
  Check
} from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

interface ProfileSettingsViewProps {
  user: any;
  onProfileUpdated?: (updatedUser: any) => void;
}

export default function ProfileSettingsView({ user, onProfileUpdated }: ProfileSettingsViewProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setProfilePhoto(user.profile_photo || user.avatar || null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [user]);

  const getRoleConfig = (role?: string) => {
    const r = (role || '').toLowerCase();
    if (r === 'superadmin') {
      return {
        badge: 'bg-purple-50 text-purple-800 border-purple-200',
        accent: 'text-purple-600',
        bgAccent: 'bg-purple-50 border-purple-200 text-purple-800',
        btn: 'bg-purple-600 hover:bg-purple-700',
        title: 'Super Administrator',
        station: 'City-Wide Central Governance Dock'
      };
    }
    if (r === 'admin') {
      return {
        badge: 'bg-blue-50 text-blue-800 border-blue-200',
        accent: 'text-blue-600',
        bgAccent: 'bg-blue-50 border-blue-200 text-blue-800',
        btn: 'bg-blue-600 hover:bg-blue-700',
        title: 'Barangay Administrator',
        station: `Barangay ${user?.barangay || 'Pianing'} Hall Station`
      };
    }
    if (r === 'nurse') {
      return {
        badge: 'bg-teal-50 text-teal-800 border-teal-200',
        accent: 'text-teal-600',
        bgAccent: 'bg-teal-50 border-teal-200 text-teal-800',
        btn: 'bg-teal-600 hover:bg-teal-700',
        title: 'Public Health Nurse (EHR)',
        station: `Barangay ${user?.barangay || 'Pianing'} Health Center`
      };
    }
    if (r === 'bhw') {
      return {
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        accent: 'text-emerald-600',
        bgAccent: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        btn: 'bg-emerald-600 hover:bg-emerald-700',
        title: 'Barangay Health Worker',
        station: `Barangay ${user?.barangay || 'Pianing'} Health Unit`
      };
    }
    return {
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      accent: 'text-amber-600',
      bgAccent: 'bg-amber-50 border-amber-200 text-amber-800',
      btn: 'bg-amber-600 hover:bg-amber-700',
      title: 'Barangay Staff Officer',
      station: `Barangay ${user?.barangay || 'Pianing'} Municipal Desk`
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
      toast.error('File size exceeds 10MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400; // Optimal 400x400 avatar
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setProfilePhoto(compressedDataUrl);
          toast.success('Photo ready! Click "Save Profile Settings" to apply changes.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = () => {
    setProfilePhoto(null);
    toast.info('Photo removed. Click "Save Profile Settings" to confirm.');
  };

  const handleReset = () => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setProfilePhoto(user.profile_photo || user.avatar || null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    toast.info('Form reset to saved profile');
  };

  // Password Strength Calculation (0 - 4)
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
    if (score <= 1) return { label: 'Weak', color: 'bg-rose-500', text: 'text-rose-600' };
    if (score === 2) return { label: 'Fair', color: 'bg-amber-500', text: 'text-amber-600' };
    if (score === 3) return { label: 'Good', color: 'bg-blue-500', text: 'text-blue-600' };
    return { label: 'Strong & Compliant', color: 'bg-emerald-500', text: 'text-emerald-600' };
  };

  const strengthInfo = getStrengthLabel(passStrength);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Official full name cannot be empty');
      return;
    }

    if (newPassword) {
      if (!currentPassword) {
        toast.error('Current password is required to change your password');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('New passwords do not match');
        return;
      }
      if (newPassword.length < 6) {
        toast.error('New password must be at least 6 characters');
        return;
      }
      try {
        const verify = await apiService.login(user.email, currentPassword);
        if (!verify?.user) {
          toast.error('Incorrect current password');
          return;
        }
      } catch {
        toast.error('Incorrect current password or authentication server unavailable');
        return;
      }
    }

    setSaving(true);
    try {
      await apiService.updateProfile({
        id: user?.id,
        email: user?.email,
        name: name.trim() !== user?.name ? name.trim() : undefined,
        phone: phone.trim() || undefined,
        password: newPassword || undefined,
        profile_photo: profilePhoto !== (user?.profile_photo || null) ? (profilePhoto ?? '') : undefined
      });

      const updated = {
        ...user,
        name: name.trim() || user?.name,
        phone: phone.trim() || user?.phone,
        profile_photo: profilePhoto
      };

      localStorage.setItem('barangay_user', JSON.stringify(updated));
      toast.success('Profile settings & photo updated successfully!');

      if (onProfileUpdated) onProfileUpdated(updated);

      // Broadcast globally to all header navbars, tabs, and drawers
      window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: updated }));

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12">
      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* ═══ MODERN EXECUTIVE HERO HEADER CARD ════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Avatar & Photo Upload Interaction */}
          <div className="flex items-center gap-5">
            <div className="relative group shrink-0">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-slate-50 border-2 border-slate-200 shadow-sm cursor-pointer flex items-center justify-center transition-all group-hover:border-teal-400 group-hover:shadow-md"
                title="Click to upload/change photo"
              >
                {profilePhoto && typeof profilePhoto === 'string' && profilePhoto.trim().length > 0 && profilePhoto !== 'null' && profilePhoto !== 'undefined' ? (
                  <img
                    src={profilePhoto}
                    alt={name || 'User'}
                    className="w-full h-full object-cover"
                    onError={() => setProfilePhoto(null)}
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center text-2xl font-bold tracking-wider ${roleConfig.bgAccent}`}>
                    {getInitials(name || user?.name)}
                  </div>
                )}
                {/* Camera Overlay on Hover */}
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex flex-col items-center justify-center text-white gap-1 cursor-pointer">
                  <Camera size={22} className="drop-shadow-sm" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                </div>
              </div>

              {/* Floating Camera Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-teal-600 rounded-xl border border-slate-200 shadow-sm cursor-pointer transition-transform hover:scale-105"
                title="Upload photo"
              >
                <Camera size={14} />
              </button>
            </div>

            {/* Profile Identity Details */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {name || user?.name || 'Healthcare Officer'}
                </h1>
                <Badge className={`text-xs font-semibold px-2.5 py-0.5 border ${roleConfig.badge}`}>
                  {(user?.role || 'Staff').toUpperCase()}
                </Badge>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium">
                  <CheckCircle2 size={12} /> Active Account
                </span>
              </div>

              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap font-medium">
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-slate-400" /> {user?.email || 'officer@barangay.gov.ph'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Building size={13} className="text-slate-400" /> Barangay {user?.barangay || 'Pianing'}
                </span>
              </p>

              {/* Photo Action Buttons */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 text-xs font-semibold rounded-xl border-slate-200 gap-1.5 text-slate-700 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
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
                    className="h-8 text-xs font-semibold rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1.5 cursor-pointer"
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
          <div className="text-xs text-slate-500 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200/80 shrink-0 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <IdCard size={14} className={roleConfig.accent} />
              <span>Badge #{user?.employee_id || user?.id || 'STAFF-01'}</span>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-600" />
              <span>Verified System Profile</span>
            </p>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Official Designation</span>
            <span className="font-bold text-slate-800 mt-0.5 block truncate">{user?.job_title || roleConfig.title}</span>
          </div>
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Assigned Station</span>
            <span className="font-bold text-slate-800 mt-0.5 block truncate">Brgy. {user?.barangay || 'Pianing'} Unit</span>
          </div>
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Clearance Level</span>
            <span className="font-bold text-slate-800 mt-0.5 block">Official Staff Access</span>
          </div>
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Security Status</span>
            <span className="font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
              <CheckCircle2 size={12} /> Protected
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ═══ SECTION 1: OFFICIAL PROFILE INFORMATION ═══════════════════════ */}
        <Card className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 p-5 bg-slate-50/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${roleConfig.bgAccent}`}>
                <UserCircle size={17} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Official Profile Credentials</h2>
                <p className="text-[11px] text-slate-500">Legal name and contact used across official EHR records and dispatch</p>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Step 1 of 2</span>
          </div>

          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Official Full Name <span className="text-red-500">*</span></Label>
                <div className="relative mt-1.5">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Maria Santos, RN"
                    required
                    className="pl-10 h-10 text-xs rounded-xl border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">This name will appear on official consultation records, receipts, and clinical entries.</p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Contact Mobile Phone</Label>
                <div className="relative mt-1.5">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                    className="pl-10 h-10 text-xs font-mono rounded-xl border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">11-digit mobile number for emergency notifications and system alerts.</p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Official Email Address (Login ID)</Label>
                <div className="relative mt-1.5">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={user?.email || ''}
                    readOnly
                    disabled
                    className="pl-10 h-10 text-xs rounded-xl bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Managed securely by Municipal System Administrator.</p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Jurisdiction &amp; Health Station Assignment</Label>
                <div className="relative mt-1.5">
                  <Building size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={`Barangay ${user?.barangay || 'Pianing'} — ${roleConfig.title}`}
                    readOnly
                    disabled
                    className="pl-10 h-10 text-xs rounded-xl bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Official municipal health unit assignment.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ SECTION 2: SECURITY & PASSWORD PROTECTION ═════════════════════ */}
        <Card className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 p-5 bg-slate-50/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${roleConfig.bgAccent}`}>
                <KeyRound size={17} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Security &amp; Password Management</h2>
                <p className="text-[11px] text-slate-500">Protect your institutional access with strong credential encryption</p>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Leave blank to keep unchanged</span>
          </div>

          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Current Password</Label>
                <div className="relative mt-1.5">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="pl-10 pr-9 h-10 text-xs rounded-xl border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">New Password</Label>
                <div className="relative mt-1.5">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="pl-10 pr-9 h-10 text-xs rounded-xl border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Confirm New Password</Label>
                <div className="relative mt-1.5">
                  <ShieldCheck size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="pl-10 h-10 text-xs rounded-xl border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Password Strength Indicator */}
            {newPassword && (
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck size={14} className={strengthInfo.text} />
                    Password Strength: <strong className={strengthInfo.text}>{strengthInfo.label}</strong>
                  </span>
                  {confirmPassword && (
                    <span className={`font-semibold ${newPassword === confirmPassword ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </span>
                  )}
                </div>

                {/* 4-Level Strength Progress Bars */}
                <div className="grid grid-cols-4 gap-1.5 h-1.5">
                  <div className={`rounded-full transition-all ${passStrength >= 1 ? strengthInfo.color : 'bg-slate-200'}`} />
                  <div className={`rounded-full transition-all ${passStrength >= 2 ? strengthInfo.color : 'bg-slate-200'}`} />
                  <div className={`rounded-full transition-all ${passStrength >= 3 ? strengthInfo.color : 'bg-slate-200'}`} />
                  <div className={`rounded-full transition-all ${passStrength >= 4 ? strengthInfo.color : 'bg-slate-200'}`} />
                </div>

                {/* Checklist Pills */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                  <span className={`inline-flex items-center gap-1 ${newPassword.length >= 6 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                    {newPassword.length >= 6 ? <Check size={12} /> : '•'} At least 6 characters
                  </span>
                  <span className={`inline-flex items-center gap-1 ${newPassword.length >= 8 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                    {newPassword.length >= 8 ? <Check size={12} /> : '•'} 8+ characters recommended
                  </span>
                  <span className={`inline-flex items-center gap-1 ${/[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
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
            className="text-xs gap-1.5 rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer h-10 px-4"
          >
            <RotateCcw size={13} /> Reset Changes
          </Button>

          <Button
            type="submit"
            disabled={saving}
            className={`${roleConfig.btn} text-white text-xs font-bold gap-2 px-6 h-10 rounded-2xl shadow-xs cursor-pointer transition-all hover:shadow-md`}
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
