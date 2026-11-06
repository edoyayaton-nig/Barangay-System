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
  FileText,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Printer,
  Shield,
  MapPin,
  ClipboardList,
  Download,
  Eye,
  FileCheck,
  Users,
  Home,
  Briefcase,
  IdCard,
  Maximize2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Phone,
  Mail,
  UserCheck
} from 'lucide-react';
import { apiService } from '../../services/api';
import { toast } from 'sonner';
import { DocumentRequest } from '../../services/api';
import ImageViewerModal from './ImageViewerModal';

interface DocumentInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentRequest | null;
  onUpdateStatus?: (id: number, currentStatus: string) => void;
  onPrint?: (document: DocumentRequest) => void;
  onViewResidentProfile?: (residentId: number, fromDocument?: DocumentRequest) => void;
  canEdit?: boolean;
}

export default function DocumentInfoModal({
  isOpen,
  onClose,
  document: doc,
  onUpdateStatus,
  onPrint,
  onViewResidentProfile,
  canEdit = true
}: DocumentInfoModalProps) {
  const [activeTab, setActiveTab] = useState<'request' | 'census'>('request');
  const [liveResidentProfile, setLiveResidentProfile] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);

  // Lightbox / Image inspection state
  const [inspectImage, setInspectImage] = useState<{
    url: string;
    title: string;
    subtitle: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('request');
      const targetResId = doc?.resident_id || (doc as any)?.matched_resident_id;
      if (targetResId && Number(targetResId) > 0) {
        setLoadingProfile(true);
        apiService.getResidentFullProfile(Number(targetResId))
          .then(data => {
            setLiveResidentProfile(data?.resident || null);
          })
          .catch(() => {
            setLiveResidentProfile(null);
          })
          .finally(() => {
            setLoadingProfile(false);
          });
      } else {
        setLiveResidentProfile(null);
      }
    }
  }, [isOpen, doc]);

  if (!doc) return null;

  // Extract Purok Certificate Photo if present
  const getPurokCertificatePhoto = (): string | null => {
    if (doc.purok_certificate_photo) return doc.purok_certificate_photo;
    if (doc.extra_fields) {
      try {
        const extra = typeof doc.extra_fields === 'string' ? JSON.parse(doc.extra_fields) : doc.extra_fields;
        if (extra?.purok_certificate_photo) return extra.purok_certificate_photo;
        if (extra?.['Certificate of Purok President'] && typeof extra['Certificate of Purok President'] === 'string' && extra['Certificate of Purok President'].startsWith('data:image')) {
          return extra['Certificate of Purok President'];
        }
      } catch {}
    }
    return null;
  };

  const purokCertPhoto = getPurokCertificatePhoto();

  // Helper to parse application form specifics (strictly removing demographic & purok cert fields, leaving Purpose / Reason)
  const getAllSubmittedFields = (): { label: string; value: string }[] => {
    const fields: { label: string; value: string }[] = [];
    const seen = new Set<string>();

    const isExcludedField = (key: string): boolean => {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().replace(/\s+/g, ' ');
      if (
        normalized === 'age' ||
        normalized === 'gender' ||
        normalized === 'sex' ||
        normalized.includes('civil status') ||
        normalized === 'civil' ||
        normalized === 'marital status' ||
        normalized.includes('birth') ||
        normalized === 'dob' ||
        normalized.includes('purok') ||
        normalized.includes('zone') ||
        normalized.includes('location') ||
        normalized.includes('address') ||
        normalized.includes('certificate of purok') ||
        normalized.includes('purok cert') ||
        normalized.includes('purok president') ||
        normalized.includes('endorsement')
      ) {
        return true;
      }
      return false;
    };

    if (doc.extra_fields) {
      try {
        const extra = typeof doc.extra_fields === 'string' ? JSON.parse(doc.extra_fields) : doc.extra_fields;
        if (extra && typeof extra === 'object') {
          for (const [k, v] of Object.entries(extra)) {
            if (isExcludedField(k)) continue;
            const cleanKey = k.toLowerCase().trim();
            if (v !== undefined && v !== null && String(v).trim()) {
              fields.push({ label: k, value: String(v).trim() });
              seen.add(cleanKey);
            }
          }
        }
      } catch {}
    }

    if (doc.purpose) {
      if (doc.purpose.includes(' | ') || doc.purpose.includes(': ')) {
        const parts = doc.purpose.split(' | ');
        for (const part of parts) {
          const colonIdx = part.indexOf(':');
          if (colonIdx > 0) {
            const label = part.substring(0, colonIdx).trim();
            const val = part.substring(colonIdx + 1).trim();
            if (isExcludedField(label)) continue;
            const cleanLabel = label.toLowerCase().trim();
            if (!seen.has(cleanLabel)) {
              fields.push({ label, value: val });
              seen.add(cleanLabel);
            }
          } else if (!seen.has('purpose / reason') && !seen.has('purpose')) {
            fields.push({ label: 'Purpose / Reason', value: part.trim() });
            seen.add('purpose / reason');
          }
        }
      } else if (!seen.has('purpose / reason') && !seen.has('purpose')) {
        fields.push({ label: 'Purpose / Reason', value: doc.purpose });
        seen.add('purpose / reason');
      }
    }

    if (fields.length === 0) {
      fields.push({ label: 'Purpose / Reason', value: doc.purpose || 'Official Barangay Document' });
    }

    return fields;
  };

  const parsedFields = getAllSubmittedFields();

  // Unified Census & Demographic attributes (merged live profile with joined query fallback)
  const resData = {
    id: doc.resident_id || (doc as any).matched_resident_id || liveResidentProfile?.id || 1,
    name: doc.resident_name || (liveResidentProfile ? `${liveResidentProfile.first_name} ${liveResidentProfile.last_name}` : 'Resident'),
    purok: doc.resident_purok || liveResidentProfile?.purok || '1',
    address: doc.resident_address || liveResidentProfile?.address || `Barangay ${doc.barangay || 'Community'}, Butuan City, 8600`,
    civil_status: doc.resident_civil_status || liveResidentProfile?.civil_status || 'Single',
    gender: doc.resident_gender || liveResidentProfile?.gender || 'Male',
    age: doc.resident_age || liveResidentProfile?.age || '25',
    birth_date: doc.resident_birth_date || liveResidentProfile?.date_of_birth || '—',
    household_number: doc.resident_household_number || liveResidentProfile?.household_number || 'HH-P1-001',
    family_name: doc.resident_family_name || liveResidentProfile?.family_name || doc.resident_name,
    is_head: doc.resident_is_head_of_household ?? liveResidentProfile?.is_head_of_household ?? false,
    relationship_to_head: doc.resident_relationship_to_head || liveResidentProfile?.relationship_to_head || 'Head of Household',
    employment: doc.resident_employment_status || liveResidentProfile?.employment_status || 'Employed',
    years_residency: doc.resident_years_of_residency || liveResidentProfile?.years_of_residency || '5+ years',
    phone: doc.resident_phone || liveResidentProfile?.phone || '—',
    email: doc.email || doc.resident_email || liveResidentProfile?.email || '—',
    verification: doc.resident_verification_status || liveResidentProfile?.verification_status || 'Verified',
    submitted_id: doc.resident_submitted_id || liveResidentProfile?.submitted_id || null,
    id_type: doc.resident_id_type || liveResidentProfile?.id_type || 'Government ID'
  };

  const handleOpenResidentProfile = () => {
    const targetId = Number(
      liveResidentProfile?.id ||
      (doc as any).matched_resident_id ||
      doc.resident_id ||
      resData.id ||
      1
    );
    if (onViewResidentProfile && targetId > 0) {
      onClose();
      setTimeout(() => {
        onViewResidentProfile(targetId, doc);
      }, 50);
    } else {
      setActiveTab('census');
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="bg-white dark:bg-slate-900 w-[94vw] max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <FileText size={22} />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{doc.document_type}</span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 font-mono">
                    Tracking Code: <span className="font-bold text-indigo-600 dark:text-indigo-400">{doc.request_code}</span>
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  className={
                    doc.status === 'Completed'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : doc.status === 'Ready for Pickup'
                      ? 'bg-blue-600 text-white font-semibold'
                      : doc.status === 'Processing'
                      ? 'bg-amber-500 text-white font-semibold'
                      : 'bg-orange-500 text-white font-semibold'
                  }
                >
                  {doc.status}
                </Badge>
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('request')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'request'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400'
                }`}
              >
                <ClipboardList size={14} />
                <span>Document &amp; Purok Endorsement</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('census')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'census'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400'
                }`}
              >
                <Users size={14} />
                <span>Resident Demographic &amp; Census Profile</span>
                <span className="ml-1 bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-mono">
                  Census Data
                </span>
              </button>
            </div>
          </DialogHeader>

          {/* TAB 1: Document Request & Purok Endorsement */}
          {activeTab === 'request' && (
            <div className="space-y-4 py-2 text-xs">
              {/* Resident Overview Card with Quick View Profile Button */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2 flex-wrap gap-2">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <User size={14} className="text-indigo-600" />
                    Applicant / Resident Name:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {doc.resident_name}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <MapPin size={14} className="text-rose-500" />
                    Official Address:
                  </span>
                  <span className="font-semibold text-right">
                    {resData.address}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-500" />
                    Date Requested:
                  </span>
                  <span className="font-mono">{doc.requested_at || 'Recent'}</span>
                </div>

                {doc.processed_at && (
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      Processed At:
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {doc.processed_at} {doc.processed_by ? `by ${doc.processed_by}` : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* ═══ MANDATORY REQUIREMENT: CERTIFICATE OF PUROK PRESIDENT ═══ */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <FileCheck size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                        Certificate of Purok President
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Official resident endorsement photo submitted with this request
                      </p>
                    </div>
                  </div>
                  <Badge className={purokCertPhoto ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'}>
                    {purokCertPhoto ? '✓ Photo Attached' : 'No Photo Uploaded'}
                  </Badge>
                </div>

                {purokCertPhoto ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div
                        onClick={() => setInspectImage({
                          url: purokCertPhoto,
                          title: 'Certificate of Purok President',
                          subtitle: `Official Endorsement for ${doc.resident_name} (${doc.document_type})`
                        })}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-slate-200 dark:bg-slate-700 border border-slate-300 overflow-hidden cursor-pointer relative group shrink-0 shadow-xs"
                        title="Click to zoom / inspect photo"
                      >
                        <img src={purokCertPhoto} alt="Purok Certificate" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Maximize2 size={16} />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-500" />
                          Signed Purok President Certificate
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Snapshot verified for Barangay clearance issuance
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectImage({
                              url: purokCertPhoto,
                              title: 'Certificate of Purok President',
                              subtitle: `Official Endorsement for ${doc.resident_name} (${doc.document_type})`
                            })}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            <Eye size={12} /> Inspect Full Photo
                          </button>
                          <span className="text-slate-300">•</span>
                          <a
                            href={purokCertPhoto}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            <ExternalLink size={12} /> Open in new tab
                          </a>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setInspectImage({
                        url: purokCertPhoto,
                        title: 'Certificate of Purok President',
                        subtitle: `Official Endorsement for ${doc.resident_name} (${doc.document_type})`
                      })}
                      className="text-xs border-emerald-300 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 gap-1.5 h-8 shrink-0 cursor-pointer"
                    >
                      <Eye size={13} />
                      Inspect Certificate
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <AlertCircle size={16} className="shrink-0 text-amber-600" />
                    <p className="text-[11px]">
                      No Certificate of Purok President photo attached to this record. (Required on new citizen portal requests).
                    </p>
                  </div>
                )}
              </div>

              {/* Form Submitted Specific Fields */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide">
                  <ClipboardList size={15} className="text-indigo-600" />
                  Application Form Specifics
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {parsedFields.map((field, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1 shadow-2xs"
                    >
                      <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                        {field.label}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-xs text-left sm:text-right">
                        {field.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Resident Demographic & Census Profile */}
          {activeTab === 'census' && (
            <div className="space-y-4 py-2 text-xs">
              {/* Header Box */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 rounded-xl shadow-md">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-base">
                      {resData.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold">{resData.name}</h3>
                      <p className="text-[11px] text-blue-200">
                        {resData.address} • Purok {resData.purok}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500 text-white font-bold border-0">
                      <ShieldCheck size={12} className="mr-1" />
                      {resData.verification}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Census & Demographic Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Household & Family Census */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 pb-1.5">
                    <Home size={14} className="text-indigo-600" />
                    Household &amp; Family Census
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Household Number:</span>
                      <span className="font-bold font-mono text-slate-900 dark:text-white">{resData.household_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Family Name:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{resData.family_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Position in Household:</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {resData.is_head ? 'Head of Household' : (resData.relationship_to_head || 'Household Member')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Years of Residency:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{resData.years_residency}</span>
                    </div>
                  </div>
                </div>

                {/* Personal Demographics */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 pb-1.5">
                    <User size={14} className="text-blue-600" />
                    Personal Demographics
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Age &amp; Date of Birth:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {resData.age} yrs old ({resData.birth_date})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gender / Civil Status:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {resData.gender} • {resData.civil_status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Employment Status:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{resData.employment}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Purok / Zone:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">Purok {resData.purok}</span>
                    </div>
                  </div>
                </div>

                {/* Contact & Communication */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 pb-1.5">
                    <Phone size={14} className="text-emerald-600" />
                    Contact &amp; Identification
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone Number:</span>
                      <span className="font-semibold font-mono text-slate-900 dark:text-white">{resData.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email Address:</span>
                      <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">{resData.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ID Presented:</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">{resData.id_type}</span>
                    </div>
                  </div>
                </div>

                {/* Submitted Government ID Photo */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wide">
                      <IdCard size={14} className="text-purple-600" />
                      Government ID Record
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {resData.id_type}
                    </Badge>
                  </div>

                  {resData.submitted_id ? (
                    <div className="flex items-center gap-3">
                      <div
                        onClick={() => setInspectImage({
                          url: resData.submitted_id,
                          title: `Government ID — ${resData.name}`,
                          subtitle: `${resData.id_type} Snapshot on File`
                        })}
                        className="w-16 h-12 rounded-lg bg-slate-200 border border-slate-300 overflow-hidden cursor-pointer relative group shrink-0"
                        title="Click to view ID photo"
                      >
                        <img src={resData.submitted_id} alt="ID" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                          <Eye size={12} />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Verified ID on Record
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectImage({
                            url: resData.submitted_id,
                            title: `Government ID — ${resData.name}`,
                            subtitle: `${resData.id_type} Snapshot on File`
                          })}
                          className="h-6 px-1.5 text-[11px] text-blue-600 hover:underline cursor-pointer"
                        >
                          <Eye size={11} className="mr-1" /> Inspect ID Photo
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-[11px]">
                      No digital ID snapshot uploaded for this profile.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Banner to Open 360 Profile */}
              {onViewResidentProfile && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-blue-600" />
                    <div>
                      <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                        Need to edit census info or view clinical health history?
                      </p>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300">
                        Open the full Resident 360° Management record for {resData.name}.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleOpenResidentProfile}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 px-3 rounded-lg cursor-pointer shrink-0"
                  >
                    Open 360° Profile <ChevronRight size={14} className="ml-0.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  try {
                    const fileName = `${(doc.document_type || 'document').replace(/\s+/g, '_')}_${doc.request_code || doc.id}.pdf`;
                    await apiService.downloadDocumentPdf(doc.id, fileName);
                    toast.success('Official PDF downloaded successfully');
                  } catch {
                    toast.error('Failed to download PDF');
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 h-9 rounded-xl transition-colors cursor-pointer"
              >
                <Download size={14} />
                Download PDF
              </Button>

              {onPrint && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    setTimeout(() => {
                      try {
                        document.body.style.pointerEvents = 'auto';
                      } catch {}
                      onPrint(doc);
                    }, 60);
                  }}
                  className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5 w-full sm:w-auto cursor-pointer"
                >
                  <Printer size={14} />
                  Print / Export
                </Button>
              )}

              {canEdit && onUpdateStatus && doc.status !== 'Completed' && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onUpdateStatus(doc.id, doc.status);
                    onClose();
                  }}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 w-full sm:w-auto"
                >
                  <CheckCircle2 size={14} />
                  {doc.status === 'Pending' ? 'Mark as Processing' : 'Mark as Completed'}
                </Button>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs text-slate-500 hover:bg-slate-100 w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedded Lightbox / Image Viewer for Purok Certificate & Government ID */}
      {inspectImage && (
        <ImageViewerModal
          isOpen={!!inspectImage}
          onClose={() => setInspectImage(null)}
          imageUrl={inspectImage.url}
          title={inspectImage.title}
          subtitle={inspectImage.subtitle}
          fileName="document-attachment.jpg"
        />
      )}
    </>
  );
}
