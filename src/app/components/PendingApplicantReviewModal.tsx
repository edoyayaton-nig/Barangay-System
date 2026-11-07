import React, { useState, useEffect } from 'react';
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
  Info,
  Building2,
  Sparkles,
  Search,
  Check,
  AlertCircle
} from 'lucide-react';
import { PendingResident, Resident, apiService, CensusSimilarityResult, CensusSimilarityCandidate } from '../../services/api';
import ImageViewerModal from './ImageViewerModal';

interface PendingApplicantReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicant: PendingResident | null;
  onApprove: (id: number, linkCensusId?: number) => void;
  onRejectWithReason: (id: number, reason: string) => void;
  onPurge?: (id: number) => void;
  approving?: boolean;
  allResidents?: Resident[];
}

const CORRECTION_OPTIONS = [
  {
    key: 'purok_address_mismatch',
    label: '📍 Purok / Address Discrepancy',
    description: 'Inputted Purok or address does not match official census database',
    defaultMsg: 'Your inputted Purok / address differs from our official Barangay Census record. Please verify your exact street and purok assignment.'
  },
  {
    key: 'name_mismatch',
    label: '🏷️ Name Discrepancy',
    description: 'Name on ID does not match registered name or census',
    defaultMsg: 'The legal name on your submitted Government ID does not match your registration or the Barangay census record. Please ensure your legal full name is accurate.'
  },
  {
    key: 'blurry_id',
    label: '📸 Blurry / Illegible ID',
    description: 'Photo is blurry or text cannot be clearly read',
    defaultMsg: 'Your submitted Government ID photo is blurry or illegible. Please retake a clear photo in good lighting so that your name, birthdate, and ID number are clearly visible.'
  },
  {
    key: 'birthday_mismatch',
    label: '🎂 Birthday Discrepancy',
    description: 'Date of Birth does not match official ID or census',
    defaultMsg: 'The Date of Birth on your registration does not match your submitted Government ID or census record. Please correct your birthdate.'
  },
  {
    key: 'expired_id',
    label: '⌛ Expired ID',
    description: 'Submitted Government ID is no longer valid',
    defaultMsg: 'The Government ID you submitted appears to be expired. Please resubmit using a currently valid government-issued ID (PhilSys, Passport, Driver\'s License, UMID, Voter\'s ID, etc.).'
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
  approving = false,
  allResidents = []
}: PendingApplicantReviewModalProps) {
  const [showResubmitPanel, setShowResubmitPanel] = useState(false);
  const [selectedReasonKey, setSelectedReasonKey] = useState('purok_address_mismatch');
  const [customMessage, setCustomMessage] = useState(CORRECTION_OPTIONS[0].defaultMsg);
  const [isZoomed, setIsZoomed] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Similarity Search State
  const [similarityData, setSimilarityData] = useState<CensusSimilarityResult | null>(null);
  const [isLoadingSimilarity, setIsLoadingSimilarity] = useState(false);
  const [useOfficialCensusAddress, setUseOfficialCensusAddress] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !applicant) {
      setSimilarityData(null);
      setShowResubmitPanel(false);
      setImageError(false);
      return;
    }

    // Attempt to load live similarity from backend
    setIsLoadingSimilarity(true);
    apiService.getCensusSimilarity(applicant.id)
      .then((res) => {
        setSimilarityData(res);
      })
      .catch(() => {
        // Fallback: calculate client-side similarity if allResidents provided
        if (allResidents && allResidents.length > 0) {
          const appFirst = (applicant.first_name || '').toLowerCase().trim();
          const appLast = (applicant.last_name || '').toLowerCase().trim();
          const appFull = `${appFirst} ${appLast}`.trim();
          const appPurok = (applicant.purok || '').replace(/\D/g, '');

          const candidates: CensusSimilarityCandidate[] = allResidents
            .filter(r => r.id !== applicant.id)
            .map(r => {
              const rFirst = (r.first_name || '').toLowerCase().trim();
              const rLast = (r.last_name || '').toLowerCase().trim();
              const rFull = `${rFirst} ${rLast}`.trim();
              const rPurok = (r.purok || '').replace(/\D/g, '');

              let score = 0;
              let nameSim = 0;
              if (appFull && rFull) {
                if (appFull === rFull) {
                  nameSim = 100;
                } else if (appLast === rLast) {
                  nameSim = 75;
                } else if (appFull.includes(rLast) || rFull.includes(appLast)) {
                  nameSim = 60;
                }
              }
              score += (nameSim * 0.6);

              if (appPurok && rPurok && appPurok === rPurok) {
                score += 20;
              }

              if (applicant.date_of_birth && r.date_of_birth && applicant.date_of_birth === r.date_of_birth) {
                score += 20;
              }

              const discrepancies: string[] = [];
              if (appPurok && rPurok && appPurok !== rPurok) {
                discrepancies.push(`Inputted 'Purok ${appPurok}' vs Database 'Purok ${rPurok}'`);
              }
              if (applicant.address && r.address && applicant.address.toLowerCase() !== r.address.toLowerCase()) {
                discrepancies.push(`Inputted address differs from official census: ${r.address}`);
              }

              return {
                resident: r,
                score: Math.min(100, Math.round(score)),
                name_similarity: nameSim,
                discrepancies
              };
            })
            .filter(c => c.score >= 30)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

          const best = candidates[0] || null;
          const hasRecord = best && best.score >= 55;

          setSimilarityData({
            applicant,
            census_match_status: hasRecord ? 'has_record' : 'no_record',
            similarity_score: best ? best.score : 0,
            closest_census_record: best ? best.resident : null,
            discrepancies: best ? best.discrepancies : [],
            candidates
          });
        }
      })
      .finally(() => {
        setIsLoadingSimilarity(false);
      });
  }, [isOpen, applicant, allResidents]);

  if (!applicant) return null;

  const fullName = applicant.name || `${applicant.first_name || ''} ${applicant.middle_name ? applicant.middle_name + ' ' : ''}${applicant.last_name || ''}`.trim() || 'Resident Applicant';

  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const diff = Date.now() - birth.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const age = calculateAge(applicant.date_of_birth);

  // Active Census Match Candidate
  const activeCandidate = similarityData?.candidates?.[0] || (similarityData?.closest_census_record ? {
    resident: similarityData.closest_census_record,
    score: similarityData.similarity_score || 0,
    name_similarity: 100,
    discrepancies: similarityData.discrepancies || []
  } : null);

  const matchedResident = activeCandidate?.resident || null;
  const matchScore = activeCandidate?.score || similarityData?.similarity_score || applicant.similarity_score || 0;
  const hasCensusRecord = (similarityData?.census_match_status === 'has_record') || (applicant.census_match_status === 'has_record') || (matchScore >= 55);

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

  const handleApproveWithLink = () => {
    const linkId = hasCensusRecord && matchedResident ? matchedResident.id : undefined;
    onApprove(applicant.id, linkId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        onPointerDownOutside={(e) => e.preventDefault()}
        className="bg-white dark:bg-[#151824] w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6"
      >
        {/* Header */}
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900 shadow-xs">
                {applicant.profile_photo ? (
                  <img src={applicant.profile_photo} alt={fullName} className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <UserCheck size={24} />
                )}
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>Resident Application Review &amp; Census Reconciliation</span>
                  {hasCensusRecord ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 size={12} /> Has Record ({matchScore}% Match)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      <AlertCircle size={12} /> No Census Record Found
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">APP-#{applicant.id}</span>
                  <span>•</span>
                  <span>{applicant.barangay ? `Barangay ${applicant.barangay}` : 'Barangay'}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {applicant.submitted_at ? new Date(applicant.submitted_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent Submission'}
                  </span>
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasCensusRecord ? (
                <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 text-xs px-3 py-1 font-bold rounded-xl shadow-xs">
                  ✓ Database Record Matched
                </Badge>
              ) : (
                <Badge className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-xs px-3 py-1 font-bold rounded-xl shadow-xs">
                  ⚠ Unmatched Census
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* ── TWO-CONTAINER FRONT SCREEN (APPLICANT vs CLOSEST CENSUS RECORD) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 py-4">
          
          {/* CONTAINER 1 (LEFT): USER'S APPLICATION DATA */}
          <div className="bg-slate-50/90 dark:bg-slate-800/50 p-4 rounded-3xl border-2 border-slate-200 dark:border-slate-700/80 space-y-4 shadow-xs flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                      User's Submitted Application
                    </h4>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Data inputted by citizen during registration</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                  Citizen Input
                </span>
              </div>

              {/* Personal Demographic Fields */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="col-span-2 bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[10.5px] text-slate-400 font-medium block">Submitted Legal Name</span>
                  <p className="font-extrabold text-slate-900 dark:text-white text-sm mt-0.5">{fullName}</p>
                </div>

                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[10.5px] text-slate-400 font-medium block">Date of Birth</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    {applicant.date_of_birth ? new Date(applicant.date_of_birth).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[10.5px] text-slate-400 font-medium block">Age &amp; Gender</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {age !== null ? `${age} yrs` : '—'} • {applicant.gender || '—'}
                  </p>
                </div>

                {/* Inputted Address & Purok */}
                <div className="col-span-2 bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] text-slate-400 font-medium block">Inputted Address &amp; Purok</span>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded">
                      Purok {applicant.purok || '1'}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                    {applicant.address || `Purok ${applicant.purok || '1'}, ${applicant.barangay ? `Barangay ${applicant.barangay}` : 'Barangay'}`}
                  </p>
                </div>

                {/* Contact details */}
                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[10.5px] text-slate-400 font-medium block">Mobile Phone</span>
                  <p className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1 truncate">
                    <Phone size={11} className="text-emerald-600" />
                    {applicant.phone || 'None'}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[10.5px] text-slate-400 font-medium block">Email Address</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1 truncate" title={applicant.email}>
                    <Mail size={11} className="text-blue-600 shrink-0" />
                    {applicant.email || 'None'}
                  </p>
                </div>
              </div>

              {/* Submitted Government ID Card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <FileText size={13} className="text-blue-600" />
                    Submitted Government ID ({applicant.id_type || 'ID Document'})
                  </span>
                  {applicant.submitted_id && !imageError && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setRotation(r => (r + 90) % 360)}
                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Rotate 90°"
                      >
                        <RotateCw size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsZoomed(!isZoomed)}
                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded transition-colors"
                        title={isZoomed ? "Zoom out" : "Zoom in"}
                      >
                        {isZoomed ? <ZoomOut size={12} /> : <ZoomIn size={12} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsViewerOpen(true)}
                        className="p-1 text-blue-600 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 rounded transition-colors font-bold text-[10.5px] flex items-center gap-0.5"
                        title="Full Screen Viewer"
                      >
                        <Maximize2 size={11} /> Expand
                      </button>
                    </div>
                  )}
                </div>

                <div className="h-44 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center p-2 overflow-hidden relative group">
                  {applicant.submitted_id && !imageError ? (
                    <img
                      src={applicant.submitted_id}
                      alt="Government ID"
                      onError={() => setImageError(true)}
                      style={{ transform: `rotate(${rotation}deg)` }}
                      className={`max-h-full max-w-full object-contain rounded-xl transition-transform duration-200 cursor-pointer shadow-xs ${
                        isZoomed ? 'scale-125' : 'scale-100'
                      }`}
                      onClick={() => setIsViewerOpen(true)}
                      title="Click to expand full screen"
                    />
                  ) : (
                    <div className="text-center p-3 text-slate-400">
                      <ShieldAlert size={20} className="mx-auto mb-1 text-slate-400" />
                      <p className="font-semibold text-xs text-slate-600 dark:text-slate-400">
                        {imageError ? 'Could not render ID image' : 'No ID Photo Attached'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60 text-[10.5px] text-slate-500">
              <span>Application ID: <strong>APP-#{applicant.id}</strong> • Role: Citizen Resident</span>
            </div>
          </div>

          {/* CONTAINER 2 (RIGHT): CLOSEST CENSUS RECORD IN DATABASE */}
          <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-3xl border-2 border-blue-200 dark:border-blue-800/70 space-y-4 shadow-xs flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-blue-100 dark:border-blue-800/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-950 dark:text-blue-200">
                      Closest Database Census Record
                    </h4>
                    <span className="text-[10px] text-blue-700 dark:text-blue-400">Live census registry similarity comparison</span>
                  </div>
                </div>

                {hasCensusRecord ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                    <Sparkles size={11} /> {matchScore}% Match
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    No Record
                  </span>
                )}
              </div>

              {/* Matched Census Record Content */}
              {matchedResident ? (
                <div className="space-y-3">
                  {/* Census Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2 bg-white dark:bg-slate-900/90 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] text-slate-400 font-medium">Official Census Record Name</span>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded">
                          Official Inhabitant
                        </span>
                      </div>
                      <p className="font-extrabold text-slate-900 dark:text-white text-sm mt-0.5">
                        {matchedResident.first_name} {matchedResident.middle_name ? `${matchedResident.middle_name} ` : ''}{matchedResident.last_name}
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900/90 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60">
                      <span className="text-[10.5px] text-slate-400 font-medium block">Census Birthdate</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {matchedResident.date_of_birth ? new Date(matchedResident.date_of_birth).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900/90 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60">
                      <span className="text-[10.5px] text-slate-400 font-medium block">Civil Status &amp; Gender</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {matchedResident.civil_status || 'Single'} • {matchedResident.gender || '—'}
                      </p>
                    </div>

                    {/* Official Census Address */}
                    <div className="col-span-2 bg-white dark:bg-slate-900/90 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] text-slate-400 font-medium block">Official Census Registered Address</span>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded">
                          Purok {matchedResident.purok || '1'}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white mt-1 leading-relaxed">
                        {matchedResident.address || `Purok ${matchedResident.purok || '1'}, ${matchedResident.barangay ? `Barangay ${matchedResident.barangay}` : 'Barangay'}`}
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900/90 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60">
                      <span className="text-[10.5px] text-slate-400 font-medium block">Household Number</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {matchedResident.household_number || `P${(matchedResident.purok || '1').toString().replace(/purok\s*/i, '').trim() || '1'}-H${matchedResident.id}`}
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900/90 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60">
                      <span className="text-[10.5px] text-slate-400 font-medium block">Census Reference ID</span>
                      <p className="font-mono font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                        #CENSUS-{matchedResident.id}
                      </p>
                    </div>
                  </div>

                  {/* ── DISCREPANCY RECONCILIATION HIGHLIGHT BOX ── */}
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                      <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Comparison &amp; Discrepancy Reconciliation</span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-amber-950 dark:text-amber-200">
                      {/* Check Purok discrepancy */}
                      {applicant.purok !== matchedResident.purok && (
                        <div className="p-1.5 bg-white/80 dark:bg-slate-900/70 rounded-lg border border-amber-200 dark:border-amber-800/60">
                          <strong className="text-amber-900 dark:text-amber-300">Purok Discrepancy:</strong> Applicant typed <em>"Purok {applicant.purok || '1'}"</em>, but official database has <strong>"Purok {matchedResident.purok || '1'}"</strong>.
                        </div>
                      )}

                      {/* Check address discrepancy */}
                      {applicant.address && matchedResident.address && applicant.address.toLowerCase() !== matchedResident.address.toLowerCase() && (
                        <div className="p-1.5 bg-white/80 dark:bg-slate-900/70 rounded-lg border border-amber-200 dark:border-amber-800/60">
                          <strong className="text-amber-900 dark:text-amber-300">Full Address Discrepancy:</strong> Database has complete recorded location: <strong>"{matchedResident.address}"</strong>.
                        </div>
                      )}

                      {/* Discrepancy summary list */}
                      {activeCandidate?.discrepancies && activeCandidate.discrepancies.length > 0 ? (
                        <ul className="list-disc list-inside space-y-0.5 text-[10.5px] text-amber-800 dark:text-amber-300">
                          {activeCandidate.discrepancies.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-emerald-700 dark:text-emerald-400 font-semibold text-[10.5px]">
                          ✓ All census fields closely match applicant registration details.
                        </p>
                      )}
                    </div>

                    {/* Option to adopt official census address */}
                    <div className="pt-2 border-t border-amber-200/80 dark:border-amber-800/60 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="adopt_census_addr"
                        checked={useOfficialCensusAddress}
                        onChange={(e) => setUseOfficialCensusAddress(e.target.checked)}
                        className="rounded border-amber-400 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="adopt_census_addr" className="text-[10.5px] text-amber-950 dark:text-amber-200 font-medium cursor-pointer">
                        Link &amp; adopt official Census Address upon approving this resident
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                /* No matching census record found */
                <div className="p-6 bg-white dark:bg-slate-900/80 border-2 border-dashed border-amber-300 dark:border-amber-700/60 rounded-2xl text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                      No Matching Record in Barangay Census
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
                      We searched <strong>{applicant.barangay ? `Barangay ${applicant.barangay}` : 'Barangay'}</strong> census records for &ldquo;{fullName}&rdquo;, but found no existing census entry.
                    </p>
                  </div>
                  <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl text-[10.5px] text-amber-900 dark:text-amber-200 border border-amber-200 text-left">
                    💡 <strong>Recommendation:</strong> Request the applicant to visit the Barangay Hall for in-person census profiling or reject if fraudulent.
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-blue-200/70 dark:border-blue-800/60 text-[10.5px] text-blue-700 dark:text-blue-400 flex items-center justify-between">
              <span>Jurisdiction: {applicant.barangay ? `Barangay ${applicant.barangay}` : 'Barangay'}</span>
              <span>Census Engine v2.4</span>
            </div>
          </div>
        </div>

        {/* Resubmit Correction Panel */}
        {showResubmitPanel && (
          <div className="mt-3 p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-2xl space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-amber-600" />
                Request Correction &amp; ID Resubmission
              </span>
              <button
                type="button"
                onClick={() => setShowResubmitPanel(false)}
                className="text-xs text-amber-700 hover:text-amber-900 font-bold"
              >
                ✕ Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CORRECTION_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleReasonSelect(opt.key)}
                  className={`p-2 rounded-xl text-left border transition-all text-xs cursor-pointer ${
                    selectedReasonKey === opt.key
                      ? 'bg-amber-100 dark:bg-amber-900/60 border-amber-500 font-bold text-amber-950 dark:text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <p className="text-xs truncate">{opt.label}</p>
                </button>
              ))}
            </div>

            <div>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
                required
                placeholder="Explain what the resident needs to correct (e.g. Purok / address discrepancy)..."
                className="w-full p-2.5 text-xs rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowResubmitPanel(false)}
                className="h-8 text-xs border-amber-300 text-amber-900"
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

        {/* Modal Action Controls Footer */}
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
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs cursor-pointer mr-auto"
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
                className="text-xs border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-semibold gap-1.5 cursor-pointer h-9 px-3.5 rounded-xl"
              >
                <RotateCcw size={13} className="text-amber-600" />
                Request Correction
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={approving}
                onClick={handleApproveWithLink}
                className={`text-xs font-bold gap-1.5 shadow-md cursor-pointer h-9 px-4 rounded-xl transition-all ${
                  hasCensusRecord
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
                }`}
              >
                <CheckCircle2 size={14} />
                {approving ? 'Verifying...' : hasCensusRecord ? 'Confirm Census Match & Approve' : 'Approve Citizen Account'}
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
          subtitle={applicant.barangay ? `Applicant Verification • Barangay ${applicant.barangay}` : 'Applicant Verification'}
          fileName={`${fullName.replace(/\s+/g, '-').toLowerCase()}-submitted-id.png`}
        />
      </DialogContent>
    </Dialog>
  );
}
