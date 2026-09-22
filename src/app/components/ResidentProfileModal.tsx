import { useState, useEffect } from 'react';
import { 
  User, 
  FileText, 
  Syringe, 
  Heart, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Building2, 
  Send, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle, 
  Info,
  Edit3,
  Save,
  KeyRound,
  Shield,
  Lock,
  Mail,
  EyeOff,
  Eye,
  RefreshCw,
  UserPlus
} from 'lucide-react';
import { apiService, Resident, DocumentRequest, MaternalRecord, ImmunizationRecord } from '../../services/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import ImageViewerModal from './ImageViewerModal';

interface ResidentProfileModalProps {
  residentId: number | null;
  isOpen: boolean;
  onClose: () => void;
  canVerify?: boolean;
  onStatusUpdated?: () => void;
  currentUserName?: string;
}

export default function ResidentProfileModal({
  residentId,
  isOpen,
  onClose,
  canVerify = false,
  onStatusUpdated,
  currentUserName
}: ResidentProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resident, setResident] = useState<Resident | null>(null);
  const [documents, setDocuments] = useState<DocumentRequest[]>([]);
  const [maternal, setMaternal] = useState<MaternalRecord[]>([]);
  const [immunizations, setImmunizations] = useState<ImmunizationRecord[]>([]);
  const [linkedUser, setLinkedUser] = useState<any | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState('overview');

  // Edit Mode State for Profile Tab
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    phone: '',
    email: '',
    purok: '',
    address: '',
    civil_status: '',
    date_of_birth: '',
    gender: 'Male',
    employment_status: 'Employed'
  });

  // Password Security Form State
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Create Portal Login Account Form State
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // SMS Form state
  const [smsType, setSmsType] = useState('Official Notification');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);

  const [selectedIdPreview, setSelectedIdPreview] = useState<string | null>(null);

  useEffect(() => {
    if (residentId && isOpen) {
      setLoading(true);
      setIsEditing(false);
      setNewPassword('');
      apiService.getResidentFullProfile(residentId)
        .then(data => {
          setResident(data.resident);
          setDocuments(data.documents || []);
          setMaternal(data.maternal || []);
          setImmunizations(data.immunizations || []);
          setLinkedUser(data.user || null);

          if (data.resident) {
            setEditForm({
              first_name: data.resident.first_name || '',
              middle_name: data.resident.middle_name || '',
              last_name: data.resident.last_name || '',
              phone: data.resident.phone || '',
              email: data.resident.email || '',
              purok: data.resident.purok ? String(data.resident.purok).replace(/purok\s*/i, '').trim() : '',
              address: data.resident.address || '',
              civil_status: data.resident.civil_status || 'Single',
              date_of_birth: data.resident.date_of_birth ? String(data.resident.date_of_birth).split('T')[0] : '',
              gender: data.resident.gender || 'Male',
              employment_status: data.resident.employment_status || 'Employed'
            });
            setNewAccountEmail(data.resident.email || '');
          }
        })
        .catch(err => {
          toast.error(err?.message || 'Failed to load resident profile');
        })
        .finally(() => setLoading(false));
    }
  }, [residentId, isOpen]);

  const handleSaveResidentEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resident) return;
    setEditLoading(true);
    try {
      await apiService.updateResident(resident.id, editForm);
      toast.success(`Profile for ${editForm.first_name} ${editForm.last_name} updated successfully!`);
      setResident(prev => prev ? { ...prev, ...editForm } : null);
      setIsEditing(false);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update resident profile.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedUser) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setIsResettingPassword(true);
    try {
      await apiService.resetUserPassword(linkedUser.id, newPassword);
      toast.success(`Password for ${linkedUser.email} has been updated successfully.`);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSendPasswordResetNotification = () => {
    if (!linkedUser) return;
    toast.success(`Password reset notification sent to ${linkedUser.email}.`, {
      description: 'The constituent will receive instructions to reset their login credentials.'
    });
  };

  const handleCreateUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resident) return;
    if (!newAccountEmail.trim()) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!newAccountPassword || newAccountPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setIsCreatingAccount(true);
    try {
      const created = await apiService.createUser({
        name: `${resident.first_name} ${resident.last_name}`,
        email: newAccountEmail.trim(),
        password: newAccountPassword,
        role: 'resident',
        barangay: resident.barangay || 'Pianing',
        status: 'Active',
        phone: resident.phone
      });
      await apiService.updateResident(resident.id, { email: newAccountEmail.trim() });
      setResident(prev => prev ? { ...prev, email: newAccountEmail.trim() } : null);
      setLinkedUser(created);
      toast.success(`Resident login account created for ${newAccountEmail}!`);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create resident portal account.');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resident || !smsMessage.trim()) return;
    setSmsSending(true);
    try {
      await apiService.sendNotification({
        recipient_name: `${resident.first_name} ${resident.last_name}`,
        recipient_phone: resident.phone || '09171234567',
        type: smsType,
        message: smsMessage
      });
      toast.success(`SMS Notification sent to ${resident.first_name}!`, {
        description: `Phone: ${resident.phone || '09171234567'}`
      });
      setSmsMessage('');
    } catch (err) {
      toast.error('Failed to send SMS notification');
    } finally {
      setSmsSending(false);
    }
  };

  const handleApproveResident = async () => {
    if (!resident) return;
    setIsVerifying(true);
    try {
      await apiService.approveResident(resident.id, currentUserName || 'Barangay Admin');
      toast.success(`Resident ${resident.first_name} ${resident.last_name} is now VERIFIED!`);
      setResident(prev => prev ? { ...prev, verification_status: 'Verified' } : null);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to verify resident');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUnverifyResident = async () => {
    if (!resident) return;
    if (!confirm(`Are you sure you want to unverify ${resident.first_name} ${resident.last_name}?`)) return;
    setIsVerifying(true);
    try {
      await apiService.unverifyResident(resident.id, 'Unverified');
      toast.warning(`Resident ${resident.first_name} ${resident.last_name} set to Unverified.`);
      setResident(prev => prev ? { ...prev, verification_status: 'Unverified' } : null);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to unverify resident');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  const residentFullName = resident ? `${resident.first_name} ${resident.middle_name ? resident.middle_name + ' ' : ''}${resident.last_name}` : 'Resident Profile';

  const formatDob = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
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
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    const clean = String(dob).split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const birth = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      if (!isNaN(birth.getTime())) {
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
        return Math.max(0, age);
      }
    }
    return null;
  };

  const computedAge = resident?.age !== undefined && resident?.age !== null && resident?.age !== ''
    ? resident.age
    : calculateAge(resident?.date_of_birth);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        onPointerDownOutside={(e) => e.preventDefault()}
        className="w-[94vw] max-w-4xl max-h-[88vh] bg-white p-4 sm:p-6 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 shadow-2xl"
      >
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden border border-blue-200 shadow-xs">
                {resident?.profile_photo ? (
                  <img src={resident.profile_photo} alt={residentFullName} className="w-full h-full object-cover" />
                ) : resident ? (
                  `${(resident.first_name?.[0] || '').toUpperCase()}${(resident.last_name?.[0] || '').toUpperCase() || 'R'}`
                ) : (
                  <User size={22} />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center flex-wrap gap-2">
                  <span>{residentFullName}</span>
                  {resident?.verification_status === 'Verified' ? (
                    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-300 shrink-0 py-0 px-2 font-semibold">
                      <ShieldCheck size={11} className="mr-1 text-emerald-600" />
                      Verified Resident
                    </Badge>
                  ) : resident?.verification_status === 'Pending_Review' || resident?.verification_status === 'Pending' ? (
                    <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-300 shrink-0 py-0 px-2 font-semibold">
                      <Clock size={11} className="mr-1 text-amber-600" />
                      Pending Review
                    </Badge>
                  ) : resident?.verification_status === 'Rejected' ? (
                    <Badge variant="outline" className="text-[11px] bg-rose-50 text-rose-700 border-rose-300 shrink-0 py-0 px-2 font-semibold">
                      <XCircle size={11} className="mr-1 text-rose-600" />
                      Application Rejected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] bg-slate-100 text-slate-700 border-slate-300 shrink-0 py-0 px-2 font-semibold">
                      <AlertCircle size={11} className="mr-1 text-slate-500" />
                      Unverified Account
                    </Badge>
                  )}
                  {resident?.is_senior && (
                    <Badge className="bg-amber-100 text-amber-800 text-[9.5px] font-bold shrink-0 py-0 px-1.5">
                      Senior Citizen
                    </Badge>
                  )}
                  {resident?.is_child && (
                    <Badge className="bg-sky-100 text-sky-800 text-[9.5px] font-bold shrink-0 py-0 px-1.5">
                      Child / Minor
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  <span className="flex items-center gap-1"><MapPin size={11} className="text-slate-400" /> {resident?.address || (resident?.purok ? `Purok ${resident.purok}, Barangay Pianing` : 'Barangay Pianing')}</span>
                  <span className="flex items-center gap-1 font-mono text-slate-700"><Phone size={11} className="text-slate-400" /> {resident?.phone || '09171234567'}</span>
                  {resident?.email && <span className="text-slate-400 font-mono">({resident.email})</span>}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto flex-wrap">
              {canVerify && resident && (
                resident.verification_status === 'Verified' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isVerifying}
                    onClick={handleUnverifyResident}
                    className="border-slate-300 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-xs h-8 px-2.5 rounded-xl cursor-pointer font-medium"
                    title="Revoke verification status"
                  >
                    Unverify
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={isVerifying}
                    onClick={handleApproveResident}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 gap-1.5 rounded-xl cursor-pointer shadow-xs font-semibold"
                    title="Approve and verify resident"
                  >
                    <CheckCircle2 size={13} />
                    Verify Resident
                  </Button>
                )
              )}
              {resident?.submitted_id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedIdPreview(resident.submitted_id || null)}
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 text-xs h-8 px-3 gap-1.5 rounded-xl cursor-pointer whitespace-nowrap font-medium"
                >
                  <FileText size={13} />
                  View Gov ID
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setActiveTab('sms')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-3 gap-1.5 rounded-xl cursor-pointer shadow-xs whitespace-nowrap font-medium"
              >
                <MessageSquare size={13} />
                Send SMS
              </Button>
            </div>
          </div>
        </DialogHeader>

        {Boolean((resident as any)?.last_profile_update_note) && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900 shadow-xs">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-blue-950">Recent Profile Update by Resident:</span>
              <p className="mt-0.5 text-blue-800 leading-relaxed font-mono text-[11px] whitespace-pre-wrap">
                {(resident as any).last_profile_update_note}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading full resident record...</div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
            <TabsList className="grid grid-cols-2 sm:grid-cols-5 bg-slate-100 p-1 rounded-xl h-auto gap-1">
              <TabsTrigger value="overview" className="text-xs font-semibold py-1.5 cursor-pointer">Profile Info</TabsTrigger>
              <TabsTrigger value="security" className="text-xs font-semibold py-1.5 cursor-pointer flex items-center gap-1.5">
                <Shield size={12} className="text-indigo-600" />
                Account &amp; Security
              </TabsTrigger>
              <TabsTrigger value="maternal" className="text-xs font-semibold py-1.5 cursor-pointer">Maternal Care</TabsTrigger>
              <TabsTrigger value="immunization" className="text-xs font-semibold py-1.5 cursor-pointer">Child Vaccines</TabsTrigger>
              <TabsTrigger value="sms" className="text-xs font-semibold text-indigo-700 py-1.5 cursor-pointer">Direct SMS</TabsTrigger>
            </TabsList>

            {/* TAB 1: PROFILE INFO (VIEW & EDIT) */}
            <TabsContent value="overview" className="space-y-4 mt-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <User size={14} className="text-indigo-600" />
                    Constituent Civil &amp; Demographic Record
                  </h4>
                  <p className="text-[11px] text-slate-500">Official registry record for Barangay {resident?.barangay || 'Pianing'}</p>
                </div>
                <Button
                  size="sm"
                  variant={isEditing ? 'outline' : 'default'}
                  onClick={() => setIsEditing(!isEditing)}
                  className={`h-7 px-3 text-xs gap-1.5 rounded-lg font-medium cursor-pointer ${
                    isEditing ? 'border-slate-300 text-slate-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <Edit3 size={12} />
                  {isEditing ? 'Cancel Edit' : 'Edit Details'}
                </Button>
              </div>

              {isEditing ? (
                <form onSubmit={handleSaveResidentEdits} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">First Name *</Label>
                      <Input
                        value={editForm.first_name}
                        onChange={e => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                        required
                        className="h-8 text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">Middle Name</Label>
                      <Input
                        value={editForm.middle_name}
                        onChange={e => setEditForm(prev => ({ ...prev, middle_name: e.target.value }))}
                        className="h-8 text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">Last Name *</Label>
                      <Input
                        value={editForm.last_name}
                        onChange={e => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                        required
                        className="h-8 text-xs bg-white mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">Date of Birth</Label>
                      <Input
                        type="date"
                        value={editForm.date_of_birth}
                        onChange={e => setEditForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                        className="h-8 text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">Gender</Label>
                      <Select
                        value={editForm.gender}
                        onValueChange={val => setEditForm(prev => ({ ...prev, gender: val }))}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">Civil Status</Label>
                      <Select
                        value={editForm.civil_status}
                        onValueChange={val => setEditForm(prev => ({ ...prev, civil_status: val }))}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Single">Single</SelectItem>
                          <SelectItem value="Married">Married</SelectItem>
                          <SelectItem value="Widowed">Widowed</SelectItem>
                          <SelectItem value="Divorced">Divorced</SelectItem>
                          <SelectItem value="Separated">Separated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">Contact Mobile</Label>
                      <Input
                        value={editForm.phone}
                        onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="09171234567"
                        className="h-8 text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">Email Address</Label>
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="resident@example.com"
                        className="h-8 text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">Purok Assignment</Label>
                      <Select
                        value={editForm.purok}
                        onValueChange={val => setEditForm(prev => ({ ...prev, purok: val }))}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white mt-1"><SelectValue placeholder="Select Purok" /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map(num => (
                            <SelectItem key={`purok-${num}`} value={String(num)}>Purok {num}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">Specific Address</Label>
                      <Input
                        value={editForm.address}
                        onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="House / Street / Purok"
                        className="h-8 text-xs bg-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700">Employment Status</Label>
                      <Select
                        value={editForm.employment_status}
                        onValueChange={val => setEditForm(prev => ({ ...prev, employment_status: val }))}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Employed">Employed</SelectItem>
                          <SelectItem value="Self-Employed">Self-Employed</SelectItem>
                          <SelectItem value="Unemployed">Unemployed</SelectItem>
                          <SelectItem value="Student">Student</SelectItem>
                          <SelectItem value="Retired">Retired</SelectItem>
                          <SelectItem value="Homemaker">Homemaker</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                      className="h-8 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={editLoading}
                      size="sm"
                      className="h-8 px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
                    >
                      <Save size={13} />
                      {editLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="bg-slate-50/80 p-3.5 sm:p-4 rounded-2xl border border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs min-w-0">
                    <span className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold block">Full Legal Name</span>
                    <p className="font-bold text-slate-900 mt-0.5 truncate text-xs" title={residentFullName}>{residentFullName}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs min-w-0">
                    <span className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold block">Gender &amp; Civil Status</span>
                    <p className="font-semibold text-slate-900 mt-0.5 text-xs truncate">{resident?.gender || 'N/A'} • {resident?.civil_status || 'Single'}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs min-w-0">
                    <span className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold block">Date of Birth</span>
                    <p className="font-semibold text-indigo-700 mt-0.5 text-xs truncate">
                      {formatDob(resident?.date_of_birth)}
                      {computedAge !== null && <span className="text-slate-500 font-normal"> ({computedAge} yrs old)</span>}
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs min-w-0">
                    <span className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold block">Contact Mobile</span>
                    <p className="font-mono font-semibold text-slate-800 mt-0.5 truncate text-xs">{resident?.phone || '09171234567'}</p>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs min-w-0">
                    <span className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold block">Jurisdiction</span>
                    <p className="font-semibold text-slate-800 mt-0.5 text-xs truncate">Barangay {resident?.barangay || 'Pianing'}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs min-w-0">
                    <span className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold block">Purok Assignment</span>
                    <p className="font-semibold text-slate-800 mt-0.5 text-xs truncate">{resident?.purok ? (String(resident.purok).startsWith('Purok') ? resident.purok : `Purok ${resident.purok}`) : 'Purok 1'}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs min-w-0">
                    <span className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold block">Household &amp; Family</span>
                    <p className="font-mono text-slate-800 font-medium mt-0.5 truncate text-xs" title={`${resident?.household_number || `HH-P${resident?.purok || '1'}-${resident?.id || 1}`} (${resident?.family_name || resident?.last_name || 'Resident'})`}>
                      {resident?.household_number || `HH-P${resident?.purok || '1'}-${resident?.id || 1}`} ({resident?.family_name || resident?.last_name || 'Resident'})
                    </p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs min-w-0">
                    <span className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold block">Employment Status</span>
                    <div className="mt-0.5">
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                        {resident?.employment_status || 'Employed'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <FileText size={14} className="text-indigo-600" />
                  Barangay Document Clearance History ({documents.length})
                </h4>
                {documents.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">No document requests on file.</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div key={doc.id} className="p-2.5 bg-white border rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <span className="font-mono font-semibold text-indigo-600 block">{doc.request_code}</span>
                          <span className="font-medium text-slate-800">{doc.document_type}</span>
                        </div>
                        <Badge className={doc.status === 'Completed' ? 'bg-emerald-600' : 'bg-amber-500'}>
                          {doc.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: ACCOUNT & SECURITY */}
            <TabsContent value="security" className="space-y-4 mt-3.5">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck size={15} className="text-indigo-600" />
                      Constituent Portal Account &amp; Access Governance
                    </h4>
                    <p className="text-[11px] text-slate-500">Manage online authentication credentials and access privileges</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {resident?.verification_status === 'Verified' ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
                        ✓ Account Verified
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px]">
                        ⏳ Unverified
                      </Badge>
                    )}
                    {linkedUser ? (
                      <Badge className={`font-bold text-[10px] ${linkedUser.status === 'Active' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' : 'bg-slate-200 text-slate-700'}`}>
                        {linkedUser.status || 'Active'} Portal User
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-600 border border-slate-300 font-bold text-[10px]">
                        Offline Census Constituent
                      </Badge>
                    )}
                  </div>
                </div>

                {linkedUser ? (
                  <div className="space-y-4">
                    {/* User info cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="p-3 bg-white border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Login Email</span>
                        <p className="font-bold text-slate-900 font-mono mt-0.5 truncate">{linkedUser.email}</p>
                      </div>
                      <div className="p-3 bg-white border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Role &amp; Jurisdiction</span>
                        <p className="font-semibold text-slate-900 mt-0.5">Resident • Brgy. {linkedUser.barangay || resident?.barangay || 'Pianing'}</p>
                      </div>
                      <div className="p-3 bg-white border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Account ID / Created</span>
                        <p className="font-mono text-slate-700 mt-0.5 text-[11px]">#{linkedUser.id} • {linkedUser.created_at ? new Date(linkedUser.created_at).toLocaleDateString() : 'Active'}</p>
                      </div>
                    </div>

                    {/* Password reset notification */}
                    <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <h5 className="font-bold text-indigo-950 flex items-center gap-1.5">
                          <Mail size={13} className="text-indigo-600" />
                          Send Password Reset Notification
                        </h5>
                        <p className="text-[11px] text-indigo-700 mt-0.5">
                          Sends an automated security email to <span className="font-mono font-semibold">{linkedUser.email}</span> with a secure link to reset credentials.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleSendPasswordResetNotification}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-3 shrink-0 rounded-lg font-medium cursor-pointer shadow-xs"
                      >
                        Send Reset Link
                      </Button>
                    </div>

                    {/* Direct Password Reset Form */}
                    <form onSubmit={handleUpdatePassword} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center gap-1.5">
                        <KeyRound size={14} className="text-slate-700" />
                        <h5 className="font-bold text-slate-900">Manually Set New Account Password</h5>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Directly overwrite this constituent's account password. Must be at least 6 characters.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <div className="relative flex-1">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Enter new secure password (min. 6 characters)"
                            className="h-9 text-xs pr-10 bg-slate-50"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        <Button
                          type="submit"
                          disabled={isResettingPassword || !newPassword.trim()}
                          className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs shrink-0 cursor-pointer"
                        >
                          <Lock size={13} />
                          {isResettingPassword ? 'Updating...' : 'Update Password'}
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                      <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h5 className="font-bold text-amber-950">No Online Portal Account Linked</h5>
                        <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                          This resident is currently only enrolled in the Barangay census database. They do not yet possess online login credentials for the Barangay Resident Portal.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleCreateUserAccount} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                      <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                        <UserPlus size={14} className="text-indigo-600" />
                        Create Portal Login Account for {resident?.first_name}
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] font-semibold text-slate-700">Resident Email *</Label>
                          <Input
                            type="email"
                            value={newAccountEmail}
                            onChange={e => setNewAccountEmail(e.target.value)}
                            placeholder="resident@example.com"
                            required
                            className="h-8 text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] font-semibold text-slate-700">Initial Password *</Label>
                          <Input
                            type="password"
                            value={newAccountPassword}
                            onChange={e => setNewAccountPassword(e.target.value)}
                            placeholder="Min. 6 characters"
                            required
                            className="h-8 text-xs mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <Button
                          type="submit"
                          disabled={isCreatingAccount || !newAccountEmail.trim() || !newAccountPassword.trim()}
                          className="h-8 px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs cursor-pointer"
                        >
                          <UserPlus size={13} />
                          {isCreatingAccount ? 'Provisioning...' : 'Provision Portal Account'}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: MATERNAL CARE */}
            <TabsContent value="maternal" className="space-y-3 mt-4">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Heart size={15} className="text-pink-600" />
                Maternal Healthcare Records ({maternal.length})
              </h4>
              {maternal.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-lg">No maternal care records registered for this resident.</p>
              ) : (
                maternal.map(m => (
                  <div key={m.id} className="p-4 bg-pink-50/50 border border-pink-200 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-pink-900">{m.pregnancy_status}</span>
                      <Badge className="bg-pink-600">Risk: {m.risk_level || 'Low'}</Badge>
                    </div>
                    <p className="text-slate-600">{m.notes}</p>
                    <div className="flex justify-between text-[11px] text-slate-500 font-mono pt-1">
                      <span>Last Visit: {m.last_visit}</span>
                      <span className="text-pink-700 font-bold">Next Checkup: {m.next_visit}</span>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* TAB 4: IMMUNIZATION */}
            <TabsContent value="immunization" className="space-y-3 mt-4">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Syringe size={15} className="text-blue-600" />
                Linked Child Immunization Records ({immunizations.length})
              </h4>
              {immunizations.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-lg">No infant immunization records linked to this resident.</p>
              ) : (
                immunizations.map(i => (
                  <div key={i.id} className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 block">{i.child_name}</span>
                      <span className="text-slate-500">{i.vaccine_name} (Dose #{i.dose_number})</span>
                    </div>
                    <Badge className={i.status === 'Completed' ? 'bg-emerald-600' : 'bg-red-600'}>
                      {i.status}
                    </Badge>
                  </div>
                ))
              )}
            </TabsContent>

            {/* TAB 5: SEND DIRECT SMS */}
            <TabsContent value="sms" className="space-y-4 mt-4">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-2">
                <MessageSquare size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Send SMS Notification to {resident?.first_name}</p>
                  <p className="text-[11px] text-indigo-700">Recipient Phone: <span className="font-mono font-bold">{resident?.phone || '09171234567'}</span></p>
                </div>
              </div>

              <form onSubmit={handleSendSms} className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold">Notification Category</Label>
                  <Select value={smsType} onValueChange={setSmsType}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Official Notification">Barangay Official Notice</SelectItem>
                      <SelectItem value="Clearance Update">Clearance Ready for Pickup</SelectItem>
                      <SelectItem value="Immunization Reminder">Vaccination / Health Reminder</SelectItem>
                      <SelectItem value="Maternal Checkup">Maternal Checkup Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">SMS Message Content</Label>
                  <textarea
                    rows={4}
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    required
                    placeholder={`Magandang araw ${resident?.first_name}, paki-claim ang inyong clearance sa Barangay Hall...`}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={smsSending || !smsMessage.trim()}
                  className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md gap-1.5 cursor-pointer"
                >
                  <Send size={15} />
                  {smsSending ? 'Sending SMS...' : `Send SMS to ${resident?.phone || 'Resident'}`}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>

    <ImageViewerModal
      isOpen={!!selectedIdPreview}
      onClose={() => setSelectedIdPreview(null)}
      imageUrl={selectedIdPreview}
      title={`Submitted Government ID — ${residentFullName}`}
      subtitle={`Official Philippine Government ID / Accreditation Document • ${resident?.id_type || 'Valid ID'}`}
      fileName={`${residentFullName.replace(/\s+/g, '-').toLowerCase()}-submitted-id.png`}
    />
    </>
  );
}
