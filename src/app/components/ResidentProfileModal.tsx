import { useState, useEffect } from 'react';
import { User, FileText, Syringe, Heart, Phone, MapPin, ShieldCheck, Building2, Send, MessageSquare, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
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

  // SMS Form state
  const [smsType, setSmsType] = useState('Official Notification');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (residentId && isOpen) {
      setLoading(true);
      apiService.getResidentFullProfile(residentId)
        .then(data => {
          setResident(data.resident);
          setDocuments(data.documents || []);
          setMaternal(data.maternal || []);
          setImmunizations(data.immunizations || []);
        })
        .catch(err => {
          toast.error(err?.message || 'Failed to load resident profile');
        })
        .finally(() => setLoading(false));
    }
  }, [residentId, isOpen]);

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

  const [selectedIdPreview, setSelectedIdPreview] = useState<string | null>(null);

  if (!isOpen) return null;

  const residentFullName = resident ? `${resident.first_name} ${resident.middle_name ? resident.middle_name + ' ' : ''}${resident.last_name}` : 'Resident Profile';

  // Clean date of birth formatting without raw ISO timestamp artifacts
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

  // Compute age accurately from date_of_birth
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
        className="w-[92vw] max-w-3xl max-h-[85vh] bg-white p-4 sm:p-5 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 shadow-2xl"
      >
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden border border-blue-200 shadow-xs">
                {resident?.profile_photo ? (
                  <img src={resident.profile_photo} alt={residentFullName} className="w-full h-full object-cover" />
                ) : resident ? (
                  `${(resident.first_name?.[0] || '').toUpperCase()}${(resident.last_name?.[0] || '').toUpperCase() || 'R'}`
                ) : (
                  <User size={20} />
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
                Send Direct SMS
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading full resident record...</div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
            <TabsList className="grid grid-cols-4 bg-slate-100 p-1 rounded-xl h-auto">
              <TabsTrigger value="overview" className="text-xs font-semibold py-1.5 cursor-pointer">Civil Info</TabsTrigger>
              <TabsTrigger value="maternal" className="text-xs font-semibold py-1.5 cursor-pointer">Maternal Care</TabsTrigger>
              <TabsTrigger value="immunization" className="text-xs font-semibold py-1.5 cursor-pointer">Child Vaccines</TabsTrigger>
              <TabsTrigger value="sms" className="text-xs font-semibold text-indigo-700 py-1.5 cursor-pointer">Send SMS</TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW & CLEARANCE HISTORY */}
            <TabsContent value="overview" className="space-y-4 mt-3.5">
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
                  <p className="font-semibold text-slate-800 mt-0.5 text-xs truncate">{resident?.purok ? (resident.purok.startsWith('Purok') ? resident.purok : `Purok ${resident.purok}`) : 'Purok 1'}</p>
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

            {/* TAB 2: MATERNAL CARE */}
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

            {/* TAB 3: IMMUNIZATION */}
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

            {/* TAB 4: SEND DIRECT SMS */}
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
                  className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md gap-1.5"
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
