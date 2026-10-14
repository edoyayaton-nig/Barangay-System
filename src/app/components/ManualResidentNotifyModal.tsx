import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Send,
  Mail,
  Smartphone,
  Bell,
  Search,
  User,
  Sparkles,
  CheckCircle2,
  FileText,
  Heart,
  Baby,
  ShieldCheck,
  Megaphone,
  X,
  Loader2,
  Building2
} from 'lucide-react';
import { dispatchResidentNotification } from '../../services/emailJsService';
import { toast } from 'sonner';

export interface ResidentRecipient {
  id?: number | string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  contact_number?: string;
  barangay?: string;
  purok?: string;
}

interface ManualResidentNotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultResident?: ResidentRecipient | null;
  currentSenderRole: 'superadmin' | 'admin' | 'nurse' | 'bhw';
  currentSenderName: string;
  currentSenderBarangay?: string;
  residentsList?: ResidentRecipient[];
  initialCategory?: 'general' | 'document' | 'health' | 'account';
  onSent?: (result: { inApp: boolean; email: boolean; sms: boolean }) => void;
}

type PresetKey = 'custom' | 'document_ready' | 'verification' | 'immunization' | 'prenatal' | 'clinic' | 'assembly';

export default function ManualResidentNotifyModal({
  isOpen,
  onClose,
  defaultResident,
  currentSenderRole,
  currentSenderName,
  currentSenderBarangay = 'Pianing',
  residentsList = [],
  initialCategory = 'general',
  onSent
}: ManualResidentNotifyModalProps) {
  // Recipient form state
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientBarangay, setRecipientBarangay] = useState(currentSenderBarangay);

  // Search & resident picker
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingResident, setIsSearchingResident] = useState(false);

  // Channels
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [sendInApp, setSendInApp] = useState(true);

  // Message content
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('custom');

  // Sending status
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Helper to extract clean display name
  const resolveFullName = (r?: ResidentRecipient | null): string => {
    if (!r) return '';
    if (r.name && r.name.trim()) return r.name.trim();
    const parts = [r.first_name, r.last_name].filter(Boolean);
    return parts.join(' ').trim();
  };

  // Helper to extract phone number
  const resolvePhone = (r?: ResidentRecipient | null): string => {
    if (!r) return '';
    return r.phone || r.contact_number || '';
  };

  // Preset templates generator
  const applyPreset = (key: PresetKey, nameArg?: string) => {
    setSelectedPreset(key);
    const targetName = (nameArg || recipientName || 'Resident').trim();
    const brgy = recipientBarangay || currentSenderBarangay || 'Pianing';

    switch (key) {
      case 'document_ready':
        setSubject(`Document Ready for Claiming – Barangay ${brgy}`);
        setMessage(
          `Good day ${targetName}! Your requested Barangay Document has been verified, stamped, and is now READY FOR CLAIMING at the Barangay ${brgy} Hall. Please bring a valid ID. Office hours: 8:00 AM – 5:00 PM.`
        );
        break;

      case 'verification':
        setSubject(`Barangay Account Verification Notice – Barangay ${brgy}`);
        setMessage(
          `Hello ${targetName}, this is an official update regarding your Barangay ${brgy} citizen account verification. Please verify your credentials or submit the required proof of residency at the Barangay Hall.`
        );
        break;

      case 'immunization':
        setSubject(`Child Immunization (EPI) Schedule Alert – Barangay ${brgy}`);
        setMessage(
          `Health Center Advisory: Hello ${targetName}, your child is scheduled for an upcoming immunization visit at Barangay ${brgy} Health Center. Please bring your child's Mother & Child immunization booklet.`
        );
        break;

      case 'prenatal':
        setSubject(`Maternal Health Checkup Reminder – Barangay ${brgy}`);
        setMessage(
          `Health Center Advisory: Hello ${targetName}, this is a gentle reminder for your scheduled prenatal checkup at Barangay ${brgy} Primary Clinic. Please bring your maternal checkup card.`
        );
        break;

      case 'clinic':
        setSubject(`Barangay Health Center Consultation Notice – Barangay ${brgy}`);
        setMessage(
          `Good day ${targetName}! The Barangay ${brgy} Health Center is conducting medical consultations and wellness checkups. Primary care services and free maintenance medicines are available for all residents.`
        );
        break;

      case 'assembly':
        setSubject(`Important Community Announcement – Barangay ${brgy}`);
        setMessage(
          `Official Notice to all residents: Barangay ${brgy} Administration invites you to the upcoming community assembly. For inquiries, you may visit the Barangay Hall or reply to this notice.`
        );
        break;

      case 'custom':
      default:
        setSubject(`Official Notice from Barangay ${brgy}`);
        setMessage('');
        break;
    }
  };

  // Sync recipient when modal opens or defaultResident changes
  useEffect(() => {
    if (isOpen) {
      if (defaultResident) {
        const name = resolveFullName(defaultResident);
        setRecipientName(name);
        setRecipientEmail(defaultResident.email || '');
        setRecipientPhone(resolvePhone(defaultResident));
        setRecipientBarangay(defaultResident.barangay || currentSenderBarangay);
        setIsSearchingResident(false);
      } else {
        setRecipientName('');
        setRecipientEmail('');
        setRecipientPhone('');
        setRecipientBarangay(currentSenderBarangay);
        setIsSearchingResident(residentsList.length > 0);
      }

      // Apply initial category preset
      if (initialCategory === 'document') {
        applyPreset('document_ready', resolveFullName(defaultResident));
      } else if (initialCategory === 'health') {
        if (currentSenderRole === 'nurse') {
          applyPreset('immunization', resolveFullName(defaultResident));
        } else {
          applyPreset('prenatal', resolveFullName(defaultResident));
        }
      } else if (initialCategory === 'account') {
        applyPreset('verification', resolveFullName(defaultResident));
      } else {
        applyPreset('assembly', resolveFullName(defaultResident));
      }
    }
  }, [isOpen, defaultResident]);

  // Filtered residents list
  const filteredResidents = useMemo(() => {
    if (!searchQuery.trim()) return residentsList.slice(0, 8);
    const q = searchQuery.toLowerCase().trim();
    return residentsList.filter(r => {
      const name = resolveFullName(r).toLowerCase();
      const email = (r.email || '').toLowerCase();
      const phone = resolvePhone(r);
      const purok = (r.purok || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q) || purok.includes(q);
    }).slice(0, 10);
  }, [residentsList, searchQuery]);

  const selectResident = (r: ResidentRecipient) => {
    const name = resolveFullName(r);
    setRecipientName(name);
    setRecipientEmail(r.email || '');
    setRecipientPhone(resolvePhone(r));
    setRecipientBarangay(r.barangay || currentSenderBarangay);
    setIsSearchingResident(false);
    setSearchQuery('');

    if (selectedPreset !== 'custom') {
      applyPreset(selectedPreset, name);
    }
  };

  // Character and SMS segment calculation
  const charCount = message.length;
  const smsSegments = charCount === 0 ? 0 : Math.ceil(charCount / 160);

  // Role display badge
  const getRoleLabel = () => {
    switch (currentSenderRole) {
      case 'superadmin': return { title: 'Super Administrator', color: 'bg-violet-600 text-white' };
      case 'admin': return { title: 'Barangay Administrator', color: 'bg-indigo-600 text-white' };
      case 'nurse': return { title: 'Health Center Nurse', color: 'bg-teal-600 text-white' };
      case 'bhw': return { title: 'Barangay Health Worker', color: 'bg-emerald-600 text-white' };
      default: return { title: 'Barangay Official', color: 'bg-slate-700 text-white' };
    }
  };

  const roleMeta = getRoleLabel();

  // Handle Manual Dispatch
  const handleSendNotification = async () => {
    if (!recipientName.trim()) {
      toast.error('Recipient name is required');
      return;
    }

    if (!sendEmail && !sendSms && !sendInApp) {
      toast.error('Please select at least one delivery channel (Email, SMS, or In-App)');
      return;
    }

    if (sendEmail && (!recipientEmail || !recipientEmail.includes('@'))) {
      toast.error('A valid email address is required to dispatch via EmailJS');
      return;
    }

    if (sendSms && (!recipientPhone || recipientPhone.trim().length < 10)) {
      toast.error('A valid mobile phone number is required to dispatch via iProg SMS');
      return;
    }

    if (!subject.trim()) {
      toast.error('Please enter a notification subject');
      return;
    }

    if (!message.trim()) {
      toast.error('Please enter a message body');
      return;
    }

    setIsSending(true);

    try {
      const fullSignature = `— ${currentSenderName} (${roleMeta.title}), Barangay ${recipientBarangay || currentSenderBarangay}`;
      const fullBody = `${message.trim()}\n\n${fullSignature}`;

      const res = await dispatchResidentNotification({
        residentEmail: recipientEmail.trim(),
        residentName: recipientName.trim(),
        phone: recipientPhone.trim(),
        type: selectedPreset === 'document_ready' ? 'document' : (selectedPreset === 'immunization' || selectedPreset === 'prenatal' || selectedPreset === 'clinic' ? 'health' : 'system'),
        title: subject.trim(),
        message: fullBody,
        statusBadge: selectedPreset === 'document_ready' ? 'Ready' : (selectedPreset === 'verification' ? 'Notice' : 'Advisory'),
        badgeColor: selectedPreset === 'document_ready' ? 'emerald' : 'indigo',
        barangay: recipientBarangay || currentSenderBarangay,
        sendEmail: sendEmail,
        sendSms: sendSms,
      });

      const channelReports: string[] = [];
      if (res.email) channelReports.push('Email (EmailJS 200 OK)');
      if (res.sms) channelReports.push('SMS (iProg Gateway Queued)');
      if (res.inApp) channelReports.push('In-App Notification Center');

      if (channelReports.length > 0) {
        toast.success(`Notification successfully sent to ${recipientName}!`, {
          description: `Delivered via: ${channelReports.join(', ')}`,
          duration: 5000
        });
        if (onSent) onSent(res);
        onClose();
      } else {
        toast.warning('Dispatched with warnings. Please verify recipient email or mobile number.');
      }
    } catch (err: any) {
      console.error('Manual notification dispatch error:', err);
      toast.error(err?.message || 'Failed to dispatch manual notification');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white border-b border-slate-800 relative">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 p-0.5 shadow-lg flex items-center justify-center">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                  <Send className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold tracking-tight text-white">
                    Manual Resident Notification
                  </DialogTitle>
                  <Badge className={`text-xs px-2 py-0.5 font-medium ${roleMeta.color}`}>
                    {roleMeta.title}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-slate-300 mt-1">
                  Send real-time <strong>SMS</strong> (iProg Gateway), <strong>Email</strong> (EmailJS Live), and <strong>In-App</strong> notices directly to any resident.
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. Recipient Selection Card */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-500" />
                Target Resident Recipient
              </Label>
              {residentsList.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                  onClick={() => setIsSearchingResident(!isSearchingResident)}
                >
                  <Search className="w-3.5 h-3.5 mr-1" />
                  {isSearchingResident ? 'Close Picker' : 'Choose from Registry'}
                </Button>
              )}
            </div>

            {/* Resident Registry Search Dropdown */}
            {isSearchingResident && (
              <div className="space-y-2 border border-indigo-200 dark:border-indigo-900 rounded-lg p-3 bg-white dark:bg-slate-900 shadow-sm">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <Input
                    placeholder="Search resident by name, email, phone, or purok..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredResidents.length === 0 ? (
                    <p className="text-xs text-slate-400 p-3 text-center">No matching residents found.</p>
                  ) : (
                    filteredResidents.map((r, idx) => (
                      <button
                        key={r.id || idx}
                        type="button"
                        onClick={() => selectResident(r)}
                        className="w-full text-left p-2.5 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-md transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                            {resolveFullName(r).charAt(0).toUpperCase() || 'R'}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">
                              {resolveFullName(r)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {r.email || 'No email'} • {resolvePhone(r) || 'No phone'}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-slate-500">
                          {r.barangay || currentSenderBarangay}
                        </Badge>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Recipient Details Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Resident Full Name *
                </Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="h-9 text-xs mt-1 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Recipient Email *</span>
                  {recipientEmail && recipientEmail.includes('@') && (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Valid
                    </span>
                  )}
                </Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="e.g. resident@gmail.com"
                  className="h-9 text-xs mt-1 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Mobile Number *</span>
                  {recipientPhone && recipientPhone.trim().length >= 10 && (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Valid
                    </span>
                  )}
                </Label>
                <Input
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="e.g. 09171234567"
                  className="h-9 text-xs mt-1 bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          </div>

          {/* 2. Dispatch Channels Multi-Select */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Active Delivery Channels
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* EmailJS Toggle */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  sendEmail
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">EmailJS Live</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Direct inbox delivery via connected Gmail service.
                  </p>
                </div>
              </label>

              {/* iProg SMS Toggle */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  sendSms
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sendSms}
                  onChange={(e) => setSendSms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">iProg SMS Gateway</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Live Philippine SMS network dispatch.
                  </p>
                </div>
              </label>

              {/* In-App Notification Center Toggle */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  sendInApp
                    ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30'
                    : 'border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sendInApp}
                  onChange={(e) => setSendInApp(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">In-App Notification</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Permanent notification in resident portal.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* 3. Quick Message Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Quick Preset Templates
              </Label>
              <button
                type="button"
                onClick={() => applyPreset('custom')}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
              >
                Clear to Custom
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={selectedPreset === 'document_ready' ? 'default' : 'outline'}
                className="h-7 text-xs rounded-lg gap-1.5"
                onClick={() => applyPreset('document_ready')}
              >
                <FileText className="w-3.5 h-3.5" />
                Document Ready
              </Button>

              <Button
                type="button"
                size="sm"
                variant={selectedPreset === 'verification' ? 'default' : 'outline'}
                className="h-7 text-xs rounded-lg gap-1.5"
                onClick={() => applyPreset('verification')}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Verification Notice
              </Button>

              <Button
                type="button"
                size="sm"
                variant={selectedPreset === 'immunization' ? 'default' : 'outline'}
                className="h-7 text-xs rounded-lg gap-1.5"
                onClick={() => applyPreset('immunization')}
              >
                <Baby className="w-3.5 h-3.5" />
                Immunization (EPI)
              </Button>

              <Button
                type="button"
                size="sm"
                variant={selectedPreset === 'prenatal' ? 'default' : 'outline'}
                className="h-7 text-xs rounded-lg gap-1.5"
                onClick={() => applyPreset('prenatal')}
              >
                <Heart className="w-3.5 h-3.5" />
                Prenatal Checkup
              </Button>

              <Button
                type="button"
                size="sm"
                variant={selectedPreset === 'clinic' ? 'default' : 'outline'}
                className="h-7 text-xs rounded-lg gap-1.5"
                onClick={() => applyPreset('clinic')}
              >
                <Building2 className="w-3.5 h-3.5" />
                Clinic Notice
              </Button>

              <Button
                type="button"
                size="sm"
                variant={selectedPreset === 'assembly' ? 'default' : 'outline'}
                className="h-7 text-xs rounded-lg gap-1.5"
                onClick={() => applyPreset('assembly')}
              >
                <Megaphone className="w-3.5 h-3.5" />
                Community Advisory
              </Button>
            </div>
          </div>

          {/* 4. Subject and Message Body */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Notice Subject *
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Document Ready for Pickup"
                className="h-9 text-xs mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Message Body *
                </Label>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>{charCount} characters</span>
                  <span>•</span>
                  <span className={smsSegments > 1 ? 'text-amber-500 font-semibold' : ''}>
                    {smsSegments} SMS {smsSegments === 1 ? 'credit' : 'credits'}
                  </span>
                </div>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your official notice or announcement to the resident here..."
                className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
              />
              <p className="text-[11px] text-slate-400 mt-1 italic">
                Signature automatically appended: &ldquo;— {currentSenderName} ({roleMeta.title}), Barangay {recipientBarangay || currentSenderBarangay}&rdquo;
              </p>
            </div>
          </div>

          {/* 5. Live Preview Toggle */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
            >
              {showPreview ? 'Hide Live Delivery Preview' : 'Show Live Delivery Preview'}
            </button>

            {showPreview && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* SMS Preview */}
                <div className="border border-emerald-200 dark:border-emerald-950 rounded-xl p-3 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold mb-2">
                    <Smartphone className="w-3.5 h-3.5" />
                    SMS Preview (To: {recipientPhone || 'No Phone'})
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40 shadow-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans text-[11px]">
                    Barangay {recipientBarangay || currentSenderBarangay}: {message || '(Empty message)'}
                    {'\n\n'}— {currentSenderName} ({roleMeta.title})
                  </div>
                </div>

                {/* Email Preview */}
                <div className="border border-indigo-200 dark:border-indigo-950 rounded-xl p-3 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs">
                  <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-bold mb-2">
                    <Mail className="w-3.5 h-3.5" />
                    Email Preview (To: {recipientEmail || 'No Email'})
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40 shadow-sm text-slate-800 dark:text-slate-200 text-[11px] space-y-1">
                    <p className="font-semibold text-indigo-600 dark:text-indigo-400">
                      Subject: {subject || '(Empty subject)'}
                    </p>
                    <p className="text-slate-500 text-[10px]">From: Barangay {recipientBarangay || currentSenderBarangay} Administration</p>
                    <hr className="my-1 border-slate-200 dark:border-slate-800" />
                    <p className="whitespace-pre-wrap">{message || '(Empty message)'}</p>
                    <p className="text-[10px] text-slate-400 italic pt-1">
                      — {currentSenderName} ({roleMeta.title})
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Channels:</span>
            {sendEmail && <Badge variant="secondary" className="text-[10px]">EmailJS</Badge>}
            {sendSms && <Badge variant="secondary" className="text-[10px]">iProg SMS</Badge>}
            {sendInApp && <Badge variant="secondary" className="text-[10px]">In-App</Badge>}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSending}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendNotification}
              disabled={isSending}
              className="text-xs h-9 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-md font-semibold gap-1.5"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Dispatching...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Send Notification Now
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
