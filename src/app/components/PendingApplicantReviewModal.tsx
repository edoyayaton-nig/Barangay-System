import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import {
  UserCheck,
  User,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ZoomIn,
  ZoomOut,
  Send,
  RotateCcw,
  RotateCw,
  Maximize2,
  Clock,
  ShieldAlert,
  Info
} from 'lucide-react';
import { PendingResident } from '../../services/api';
import ImageViewerModal from './ImageViewerModal';

interface PendingApplicantReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicant: PendingResident | null;
  onApprove: (id: number) => void;
  onRejectWithReason: (id: number, reason: string) => void;
  onPurge?: (id: number) => void;
  approving?: boolean;
}

const CORRECTION_OPTIONS = [
  {
    key: 'blurry_id',
    label: '📸 Blurry / Illegible ID',
    description: 'Photo is blurry or text cannot be clearly read',
    defaultMsg: 'Your submitted Government ID photo is blurry or illegible. Please retake a clear photo in good lighting so that your name, birthdate, and ID number are clearly visible.'
  },
  {
    key: 'name_mismatch',
    label: '🏷️ Name Discrepancy',
    description: 'Name on ID does not match registered name',
    defaultMsg: 'The name on your submitted Government ID does not match the name you registered with. Please ensure your legal first, middle, and last name match your official government ID.'
  },
  {
    key: 'birthday_mismatch',
    label: '🎂 Birthday Discrepancy',
    description: 'Date of Birth does not match official ID',
    defaultMsg: 'The Date of Birth on your registration does not match your submitted Government ID. Please check and correct your birthdate.'
  },
  {
    key: 'address_issue',
    label: '📍 Address Verification',
    description: 'Address could not be verified in this barangay',
    defaultMsg: 'Your registered address could not be verified as belonging to this barangay. Please ensure you selected the correct barangay and bring proof of residency if needed.'
  },
  {
    key: 'expired_id',
    label: '⌛ Expired ID',
    description: 'Submitted Government ID is no longer valid',
    defaultMsg: 'The Government ID you submitted appears to be expired. Please resubmit using a currently valid government-issued ID (PhilSys, Passport, Driver\'s License, UMID, Voter\'s ID, etc.).'
  },
  {
    key: 'missing_back',
    label: '📋 Incomplete ID (Back Side Missing)',
    description: 'Back side of ID is required',
    defaultMsg: 'The back side of your Government ID is required. Please resubmit showing both front and back clearly.'
  },
  {
    key: 'custom',
    label: '✏️ Other Reason',
    description: 'Specify a custom reason',
    defaultMsg: ''
  }
];

export default function PendingApplicantReviewModal({
  isOpen,
  onClose,
  applicant,
  onApprove,
  onRejectWithReason,
  onPurge,
  approving = false
}: PendingApplicantReviewModalProps) {
  const [showResubmitPanel, setShowResubmitPanel] = useState(false);
  const [selectedReasonKey, setSelectedReasonKey] = useState('blurry_id');
  const [customMessage, setCustomMessage] = useState(CORRECTION_OPTIONS[0].defaultMsg);
  const [isZoomed, setIsZoomed] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!applicant) return null;

  const fullName = applicant.name || `${applicant.first_name || ''} ${applicant.middle_name ? applicant.middle_name + ' ' : ''}${applicant.last_name || ''}`.trim() || 'Resident Applicant';

  // Compute age from DOB if available
  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const diff = Date.now() - birth.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const age = calculateAge(applicant.date_of_birth);

  const handleReasonSelect = (key: string) => {
    setSelectedReasonKey(key);
    const opt = CORRECTION_OPTIONS.find(o => o.key === key);
    if (opt && opt.defaultMsg) {
      setCustomMessage(opt.defaultMsg);
    } else {
      setCustomMessage('');
    }
  };

  const handleSendResubmitNotice = () => {
    if (!customMessage.trim()) return;
    onRejectWithReason(applicant.id, customMessage.trim());
    setShowResubmitPanel(false);
    onClose();
  };

  const handleApproveClick = () => {
    onApprove(applicant.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        onPointerDownOutside={(e) => e.preventDefault()}
        className="bg-white dark:bg-slate-900 w-[92vw] max-w-3xl max-h-[85vh] overflow-y-auto shadow-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5"
      >
        {/* Header */}
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900 overflow-hidden shadow-xs">
                {applicant.profile_photo ? (
                  <img src={applicant.profile_photo} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  <UserCheck size={20} />
                )}
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Resident Applicant Review
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-semibold text-blue-600">APP-#{applicant.id}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {applicant.submitted_at ? new Date(applicant.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent Application'}
                  </span>
                </DialogDescription>
              </div>
            </div>

            <Badge className="w-fit bg-amber-50 text-amber-700 border-amber-200 text-xs px-2.5 py-1 font-semibold rounded-lg">
              Pending Review &amp; Verification
            </Badge>
          </div>
        </DialogHeader>

        {/* 2-Column Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-3">
          {/* Left Column: Full Applicant Demographic & Contact Profile */}
          <div className="space-y-3.5 text-xs">
            {/* Personal Details Card */}
            <div className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                <User size={14} className="text-blue-600" />
                <span>Personal Information</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2">
                  <span className="text-[11px] text-slate-400 block font-medium">Full Legal Name</span>
                  <p className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{fullName}</p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Date of Birth</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    {applicant.date_of_birth ? new Date(applicant.date_of_birth).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not specified'}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Calculated Age</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {age !== null ? `${age} years old` : '—'}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Gender</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {applicant.gender || 'Not specified'}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Civil Status</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {applicant.civil_status || 'Single'}
                  </p>
                </div>

                {applicant.years_of_residency && (
                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-400 block font-medium">Length of Residency</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {applicant.years_of_residency}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Contact & Address Card */}
            <div className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                <MapPin size={14} className="text-blue-600" />
                <span>Contact &amp; Location</span>
              </div>

              <div className="space-y-2.5">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Mobile Phone</span>
                  <p className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                    <Phone size={12} className="text-emerald-600" />
                    {applicant.phone || 'No phone provided'}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Email Address</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5 break-all">
                    <Mail size={12} className="text-blue-600 shrink-0" />
                    {applicant.email || 'No email provided'}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Registered Address</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-1 leading-relaxed bg-white dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-800">
                    {applicant.address || `Barangay ${applicant.barangay || 'Pianing'}, Butuan City`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Submitted Government ID Document Viewer */}
          <div className="space-y-3 text-xs flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <FileText size={14} className="text-blue-600" />
                <span>Submitted Government ID</span>
              </div>

              {applicant.submitted_id && !imageError && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setRotation(r => (r + 90) % 360)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                    title="Rotate 90 degrees"
                  >
                    <RotateCw size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsZoomed(!isZoomed)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                    title={isZoomed ? "Zoom out" : "Zoom in"}
                  >
                    {isZoomed ? <ZoomOut size={13} /> : <ZoomIn size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsViewerOpen(true)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors cursor-pointer"
                    title="Open full-screen viewer"
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* ID Image Container with Clean Light Canvas */}
            <div className="flex-1 min-h-[260px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-center p-3 overflow-hidden relative group">
              {applicant.submitted_id && !imageError ? (
                <div className="w-full h-full flex items-center justify-center overflow-auto max-h-[360px]">
                  <img
                    src={applicant.submitted_id}
                    alt="Government ID"
                    onError={() => setImageError(true)}
                    style={{ transform: `rotate(${rotation}deg)` }}
                    className={`max-h-full max-w-full object-contain rounded-lg transition-transform duration-200 cursor-pointer shadow-xs ${
                      isZoomed ? 'scale-125' : 'scale-100'
                    }`}
                    onClick={() => setIsViewerOpen(true)}
                    title="Click to view full-screen"
                  />
                  <span className="absolute bottom-2.5 right-2.5 bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-xs pointer-events-none flex items-center gap-1">
                    <Maximize2 size={10} /> Click to expand
                  </span>
                </div>
              ) : (
                <div className="text-center p-6 space-y-2 text-slate-400">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No Valid ID Photo Attached</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                      {imageError ? 'The attached image file could not be loaded.' : 'The resident registered without uploading a digital copy of their Government ID.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 italic text-center">
              Accepted IDs: PhilSys National ID, Driver's License, Passport, UMID, Postal ID, Voter's ID.
            </p>
          </div>
        </div>

        {/* Resubmit / Correction Notice Panel */}
        {showResubmitPanel && (
          <div className="mt-2 p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-3.5 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-xs">
                <AlertTriangle size={14} className="text-amber-600" />
                Request ID Correction / Resubmission
              </span>
              <button
                type="button"
                onClick={() => setShowResubmitPanel(false)}
                className="text-amber-700 hover:text-amber-900 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 block mb-1.5">
                Select Common Issue:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {CORRECTION_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleReasonSelect(opt.key)}
                    className={`p-2 text-left rounded-lg border text-xs transition-colors cursor-pointer ${
                      selectedReasonKey === opt.key
                        ? 'bg-amber-100/90 border-amber-400 text-amber-950 dark:bg-amber-900/60 dark:text-amber-100 font-semibold shadow-2xs'
                        : 'bg-white/80 dark:bg-slate-800 hover:bg-amber-50/50 border-amber-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-amber-900 dark:text-amber-200 block mb-1">
                Instructions for Resident *
              </Label>
              <textarea
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                rows={3}
                required
                placeholder="Explain clearly what the resident needs to correct or resubmit..."
                className="w-full p-2.5 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none leading-relaxed"
              />
              <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1">
                <Info size={11} /> This notice will appear on the resident's portal when they log in.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-amber-200/80">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowResubmitPanel(false)}
                className="h-8 text-xs border-amber-300 text-amber-900 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!customMessage.trim()}
                onClick={handleSendResubmitNotice}
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 shadow-xs cursor-pointer"
              >
                <Send size={12} />
                Send Correction Notice
              </Button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        {!showResubmitPanel && (
          <DialogFooter className="gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between">
            {onPurge ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Permanently remove applicant account for ${fullName}?`)) {
                    onPurge(applicant.id);
                    onClose();
                  }
                }}
                className="text-red-600 hover:bg-red-50 hover:text-red-700 text-xs cursor-pointer mr-auto"
                title="Permanently remove spam or fake registration"
              >
                <XCircle size={14} className="mr-1" />
                Purge Account
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowResubmitPanel(true)}
                className="text-xs border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold gap-1.5 cursor-pointer h-8.5"
              >
                <RotateCcw size={13} className="text-amber-600" />
                Request Correction
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={approving}
                onClick={handleApproveClick}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-xs cursor-pointer h-8.5"
              >
                <CheckCircle2 size={14} />
                {approving ? 'Verifying...' : 'Accept & Verify Resident'}
              </Button>
            </div>
          </DialogFooter>
        )}

        {/* Interactive Full Screen Image Viewer Modal */}
        <ImageViewerModal
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          imageUrl={applicant.submitted_id || null}
          title={`Government ID — ${fullName}`}
          subtitle={`Applicant Verification • Barangay ${applicant.barangay || 'Pianing'}`}
          fileName={`${fullName.replace(/\s+/g, '-').toLowerCase()}-submitted-id.png`}
        />
      </DialogContent>
    </Dialog>
  );
}
