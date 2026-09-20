import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
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
  Sparkles,
  Lock,
  Calendar,
  MapPin
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onProfileUpdated?: (updatedUser: any) => void;
}

export default function ProfileSettingsModal({
  isOpen,
  onClose,
  user,
  onProfileUpdated
}: ProfileSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [purok, setPurok] = useState('1');
  const [civilStatus, setCivilStatus] = useState('Single');
  const [gender, setGender] = useState('Female');
  const [dob, setDob] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [saving, setSaving] = useState(false);

  // Track previous isOpen state so we ONLY reset when modal opens, NOT on background polling updates
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current && user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      
      // Extract purok cleanly
      let initialPurok = '1';
      if (user.purok) {
        initialPurok = String(user.purok).replace(/purok\s*/i, '').trim();
      } else if (user.address) {
        const match = user.address.match(/purok\s*([^,]+)/i);
        if (match) initialPurok = match[1].trim();
      }
      setPurok(initialPurok || '1');
      setCivilStatus(user.civil_status || 'Single');
      setGender(user.gender || 'Female');
      setDob(user.date_of_birth ? (typeof user.date_of_birth === 'string' ? user.date_of_birth.split('T')[0] : '') : '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveTab('profile');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, user]);

  const getRoleBadgeColor = (role?: string) => {
    const r = (role || '').toLowerCase();
    if (r === 'superadmin') return 'bg-purple-100 text-purple-800 border-purple-200';
    if (r === 'admin') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (r === 'nurse') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (r === 'bhw') return 'bg-teal-100 text-teal-800 border-teal-200';
    return 'bg-amber-100 text-amber-800 border-amber-200';
  };

  const getInitials = (nameStr?: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return nameStr.slice(0, 2).toUpperCase();
  };

  // Compute age from dob
  const calculatedAge = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Official name cannot be empty');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error('Email address cannot be empty');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error('Invalid Email Format', { description: 'Please enter a valid email address (e.g. user@gmail.com).' });
      return;
    }

    const isChangingEmail = Boolean(user?.email && cleanEmail !== user.email.toLowerCase());

    // If changing password OR changing email, verify current password
    if (newPassword || isChangingEmail) {
      if (!currentPassword) {
        toast.error(
          isChangingEmail
            ? 'Current password required to authorize email change'
            : 'Current password is required to change your password'
        );
        return;
      }
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          toast.error('New passwords do not match');
          return;
        }
        if (newPassword.length < 6) {
          toast.error('New password must be at least 6 characters');
          return;
        }
      }
      try {
        const verify = await apiService.login(user.email, currentPassword);
        if (!verify?.user) {
          toast.error('Incorrect current password');
          return;
        }
      } catch {
        toast.error('Incorrect current password or server unavailable');
        return;
      }
    }

    const cleanPurok = purok.replace(/purok\s*/i, '').trim();
    const formattedAddress = `${cleanPurok ? `Purok ${cleanPurok}, ` : ''}Barangay ${user?.barangay || 'Pianing'}, ${user?.city || 'Butuan City'}`;

    setSaving(true);
    try {
      const res = await apiService.updateProfile({
        id: user?.id,
        email: user?.email,
        new_email: isChangingEmail ? cleanEmail : undefined,
        name: name.trim() !== user?.name ? name.trim() : undefined,
        phone: phone.trim() || undefined,
        password: newPassword || undefined,
        purok: cleanPurok || undefined,
        gender: gender || undefined,
        civil_status: civilStatus || undefined,
        date_of_birth: dob || undefined,
        address: formattedAddress,
      });

      if (res && res.success === false) {
        throw new Error(res.message || 'Failed to update profile');
      }

      const updated = {
        ...user,
        email: isChangingEmail ? cleanEmail : user?.email,
        name: name.trim() || user?.name,
        phone: phone.trim() || user?.phone,
        purok: cleanPurok || user?.purok,
        gender: gender || user?.gender,
        civil_status: civilStatus || user?.civil_status,
        date_of_birth: dob || user?.date_of_birth,
        age: calculatedAge !== null ? calculatedAge : user?.age,
        address: formattedAddress,
      };
      localStorage.setItem('barangay_user', JSON.stringify(updated));

      if (isChangingEmail) {
        toast.success('Email & Profile Updated!', {
          description: `Your official login email is now ${cleanEmail}. Please use it next time you sign in.`
        });
      } else {
        toast.success('Profile settings updated successfully!');
      }

      if (onProfileUpdated) onProfileUpdated(updated);
      window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: updated }));
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg bg-white p-0 overflow-hidden shadow-2xl rounded-2xl border border-slate-200">
        {/* Clean, Soft & Eye-Friendly Header */}
        <div className="bg-white border-b border-slate-200 p-6 text-slate-900 relative">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-xl font-bold text-teal-800 tracking-wider shrink-0 shadow-xs">
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight truncate">
                  {user?.name || 'Resident Profile'}
                </h2>
                <Badge className={`text-[10px] font-bold px-2 py-0.5 border ${getRoleBadgeColor(user?.role)}`}>
                  {(user?.role || 'Resident').toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
                <Mail size={12} className="text-slate-400" />
                {email || user?.email || 'resident@barangay.gov.ph'}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                <span className="flex items-center gap-1 font-semibold text-slate-700">
                  <Building size={11} className="text-teal-600" />
                  Barangay {user?.barangay || 'Pianing'}
                </span>
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <ShieldCheck size={11} />
                  {user?.verification_status || 'Verified Account'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-5 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'profile'
                  ? 'bg-teal-50 text-teal-900 border border-teal-200 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <User size={13} />
              Personal Info
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'security'
                  ? 'bg-teal-50 text-teal-900 border border-teal-200 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Lock size={13} />
              Password &amp; Security
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(85vh-140px)] overflow-y-auto">
          {activeTab === 'profile' ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Official Full Name <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                    required
                    className="pl-9 h-10 text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Appears on official clearances, permits, and clinical EHR records.</p>
              </div>

              {/* Email Address Input & Change Email Workflow */}
              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Email Address (Login &amp; Official Notices) <span className="text-red-500">*</span></span>
                  {user?.email && email.trim().toLowerCase() !== user.email.toLowerCase() && (
                    <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Changing Email
                    </span>
                  )}
                </Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. resident@gmail.com"
                    required
                    className="pl-9 h-10 text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Used for signing in and receiving document clearances, clinic reminders, and barangay advisories.</p>

                {/* Password confirmation prompt when changing email */}
                {user?.email && email.trim().toLowerCase() !== user.email.toLowerCase() && (
                  <div className="mt-2.5 p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                      <Lock size={13} className="text-amber-600" />
                      <span>Authorize Email Change</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-snug">
                      You are changing your official login email to <strong>{email.trim()}</strong>. Enter your current password to authorize this credential change:
                    </p>
                    <div className="relative">
                      <Input
                        type={showCurrentPass ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password to authorize"
                        className="h-9 text-xs pr-9 bg-white border-amber-300 focus:border-amber-500 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(p => !p)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        tabIndex={-1}
                      >
                        {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Contact Mobile Phone
                  </Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <Input
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="09XXXXXXXXX"
                      maxLength={11}
                      className="pl-9 h-10 text-xs font-mono bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <MapPin size={12} className="text-teal-600" /> Purok / Zone <span className="text-red-500">*</span>
                  </Label>
                  <div className="mt-1.5">
                    <Select value={purok} onValueChange={setPurok}>
                      <SelectTrigger className="h-10 text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl">
                        <SelectValue placeholder="Select Purok" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7].map(num => (
                          <SelectItem key={num} value={String(num)}>
                            Purok {num}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Gender
                  </Label>
                  <div className="mt-1.5">
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger className="h-10 text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl">
                        <SelectValue placeholder="Select Gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Civil Status
                  </Label>
                  <div className="mt-1.5">
                    <Select value={civilStatus} onValueChange={setCivilStatus}>
                      <SelectTrigger className="h-10 text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl">
                        <SelectValue placeholder="Select Civil Status" />
                      </SelectTrigger>
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

              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Date of Birth</span>
                  {calculatedAge !== null && (
                    <span className="text-[11px] font-mono text-teal-700 font-bold">
                      Age: {calculatedAge} years old
                    </span>
                  )}
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="h-10 text-xs bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl"
                  />
                </div>
              </div>

              {/* Locked Jurisdiction Badges - Protected by Law / LGU */}
              <div className="pt-2">
                <div className="p-3.5 bg-slate-100/80 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock size={12} className="text-amber-600" /> Protected Jurisdiction
                    </span>
                    <Badge variant="outline" className="text-[9px] bg-white border-slate-300 text-slate-600">
                      Locked
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-semibold">Barangay</span>
                      <span className="font-bold text-slate-800 mt-0.5 block truncate">
                        Barangay {user?.barangay || 'Pianing'}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-semibold">City / Municipality</span>
                      <span className="font-bold text-slate-800 mt-0.5 block truncate">
                        {user?.city || 'Butuan City'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    Barangay and City jurisdictions are verified against the official registry and cannot be modified online.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 flex items-start gap-2.5">
                <ShieldCheck className="text-indigo-600 flex-shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="font-bold">Protect Your Clinical Account</p>
                  <p className="text-[11px] text-indigo-700 mt-0.5">Use at least 6 characters including numbers and letters. Leave blank if you do not want to change your password.</p>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Current Password
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password to verify"
                    className="h-10 text-xs pr-9 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(p => !p)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    New Password
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min. 6 chars"
                      className="h-10 text-xs pr-9 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(p => !p)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Confirm Password
                  </Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="h-10 text-xs mt-1.5 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs font-semibold h-10 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-10 px-6 rounded-xl shadow-md cursor-pointer transition-all hover:shadow-indigo-200"
            >
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
