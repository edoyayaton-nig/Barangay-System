import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Stethoscope,
  Heart,
  Baby,
  Pill,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  UserCheck,
  Calendar,
  Activity,
  User,
  MapPin,
  Phone,
  Sparkles,
  History,
  Check,
  Edit2,
  Plus,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import { apiService, InventoryItem } from '../../services/api';
import { toast } from 'sonner';

interface SmartClinicalIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdRecord?: any) => void;
  barangay?: string;
  attendingWorker?: string;
  workerRole?: string;
  availableInventory?: InventoryItem[];
}

interface PrescribedItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity?: number;
  unit?: string;
}

export default function SmartClinicalIntakeModal({
  isOpen,
  onClose,
  onSuccess,
  barangay = 'Pianing',
  attendingWorker = 'Healthcare Worker',
  workerRole = 'nurse'
}: SmartClinicalIntakeModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [availableInventory, setAvailableInventory] = useState<InventoryItem[]>([]);
  const [matchedPatient, setMatchedPatient] = useState<any | null>(null);
  const [isVerifiedSame, setIsVerifiedSame] = useState<boolean | null>(null);
  const [previousEncounter, setPreviousEncounter] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      apiService.getInventory(barangay)
        .then(res => setAvailableInventory(Array.isArray(res) ? res : []))
        .catch(() => setAvailableInventory([]));
    }
  }, [isOpen, barangay]);

  // Demographics
  const [patientName, setPatientName] = useState('');
  const [gender, setGender] = useState<'Female' | 'Male'>('Female');
  const [birthday, setBirthday] = useState('');
  const [age, setAge] = useState('');
  const [civilStatus, setCivilStatus] = useState('Single');
  const [purok, setPurok] = useState('Purok 1');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Triage Vitals (Starts empty for fresh user entry)
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [temp, setTemp] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [heartRate, setHeartRate] = useState('');

  // Primary Program Selection
  const [selectedProgram, setSelectedProgram] = useState<'Consultation' | 'Prenatal' | 'Family Planning' | 'NIP Immunization'>('Consultation');

  // Specialized Consultation Sub-Programs
  const [consultProgram, setConsultProgram] = useState<
    'General Consultation' | 'Adolescent Health' | 'Family Planning' | 'Teenage Pregnancy Prevention' | 'NTP (TB-DOTS)'
  >('General Consultation');

  // General Consultation
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [prescribedList, setPrescribedList] = useState<PrescribedItem[]>([]);
  const [medInputName, setMedInputName] = useState('');
  const [medInputDosage, setMedInputDosage] = useState('');
  const [medInputQty, setMedInputQty] = useState('1'); // Unrestricted freedom
  const [medInputFreq, setMedInputFreq] = useState('');
  const [medInputDuration, setMedInputDuration] = useState('');
  const [medInputInstructions, setMedInputInstructions] = useState('');

  const defaultInventory: InventoryItem[] = [
    { id: 1, item_name: 'Paracetamol 500mg', category: 'Essential Medicine', stock: 800, unit: 'tablets', expiry_date: '2027-05-30', status: 'In Stock' },
    { id: 2, item_name: 'Amoxicillin 500mg', category: 'Essential Medicine', stock: 500, unit: 'capsules', expiry_date: '2027-04-15', status: 'In Stock' },
    { id: 3, item_name: 'Mefenamic Acid 500mg', category: 'Essential Medicine', stock: 250, unit: 'capsules', expiry_date: '2026-11-20', status: 'In Stock' },
    { id: 4, item_name: 'Cetirizine 10mg', category: 'Essential Medicine', stock: 300, unit: 'tablets', expiry_date: '2026-12-15', status: 'In Stock' },
    { id: 5, item_name: 'Salbutamol Nebule 2.5mg', category: 'Essential Medicine', stock: 60, unit: 'nebules', expiry_date: '2026-10-01', status: 'In Stock' },
    { id: 6, item_name: 'Oral Rehydration Salts (ORS)', category: 'Essential Medicine', stock: 150, unit: 'sachets', expiry_date: '2027-08-01', status: 'In Stock' },
    { id: 7, item_name: 'Ferrous Sulfate + Folic Acid', category: 'Maternal Vitamin', stock: 1200, unit: 'tablets', expiry_date: '2027-01-01', status: 'In Stock' },
    { id: 8, item_name: 'Calcium Carbonate 500mg', category: 'Maternal Vitamin', stock: 850, unit: 'tablets', expiry_date: '2026-12-31', status: 'In Stock' },
  ];

  const activeCatalog = availableInventory && availableInventory.length > 0 ? availableInventory : defaultInventory;
  const selectedIntakeInvItem = useMemo(() => {
    if (!medInputName) return null;
    const lower = medInputName.trim().toLowerCase();
    return activeCatalog.find(i => i.item_name.trim().toLowerCase() === lower) ||
      activeCatalog.find(i => i.item_name.toLowerCase().includes(lower) || lower.includes(i.item_name.toLowerCase())) ||
      null;
  }, [medInputName, activeCatalog]);

  // Auto-detect strength/dosage in selected medicine name
  const isDosageInName = useMemo(() => {
    if (!medInputName) return false;
    return /\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|nebules?)\b/i.test(medInputName);
  }, [medInputName]);

  const extractedDosage = useMemo(() => {
    if (!medInputName) return '';
    const match = medInputName.match(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|nebules?)\b/i);
    return match ? match[0] : '';
  }, [medInputName]);

  // Adolescent Health Consultation fields
  const [adolescentStage, setAdolescentStage] = useState('');
  const [adolescentFocus, setAdolescentFocus] = useState('');
  const [adolescentGuardian, setAdolescentGuardian] = useState('');
  const [adolescentNotes, setAdolescentNotes] = useState('');

  // Teenage Pregnancy Prevention fields
  const [teenRiskAssessment, setTeenRiskAssessment] = useState('');
  const [teenCounselingTopic, setTeenCounselingTopic] = useState('');
  const [teenSupportReferred, setTeenSupportReferred] = useState('');

  // NTP (TB-DOTS) fields
  const [tbSputumStatus, setTbSputumStatus] = useState('');
  const [tbCategory, setTbCategory] = useState('');
  const [tbPhase, setTbPhase] = useState('');
  const [tbAdherencePartner, setTbAdherencePartner] = useState('');

  // Prenatal fields
  const [lmp, setLmp] = useState('');
  const [edd, setEdd] = useState('');
  const [aogWeeks, setAogWeeks] = useState('');
  const [gravida, setGravida] = useState('');
  const [para, setPara] = useState('');
  const [fetalHeartRate, setFetalHeartRate] = useState('');
  const [fundicHeight, setFundicHeight] = useState('');

  // Family Planning fields
  const [fpMethod, setFpMethod] = useState('');
  const [fpClientType, setFpClientType] = useState('');
  const [fpNextSupply, setFpNextSupply] = useState('');

  // NIP Immunization fields
  const [vaccineName, setVaccineName] = useState('');
  const [customVaccine, setCustomVaccine] = useState('');
  const [doseNumber, setDoseNumber] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');

  // Follow-up
  const [nextVisitDate, setNextVisitDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-compute Age from Birthday
  useEffect(() => {
    if (birthday) {
      const birth = new Date(birthday);
      const now = new Date();
      let computed = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        computed--;
      }
      setAge(computed >= 0 ? String(computed) : '');
    }
  }, [birthday]);

  // Auto-compute EDD and AOG from LMP
  useEffect(() => {
    if (lmp) {
      const lmpDate = new Date(lmp);
      if (!isNaN(lmpDate.getTime())) {
        const eddDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);
        setEdd(eddDate.toISOString().split('T')[0]);
        const diffDays = Math.floor((Date.now() - lmpDate.getTime()) / (1000 * 60 * 60 * 24));
        const weeks = Math.floor(diffDays / 7);
        setAogWeeks(weeks > 0 ? `${weeks} weeks` : '1 week');
      }
    }
  }, [lmp]);

  // Search patients
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      setIsSearching(true);
      const timeout = setTimeout(() => {
        apiService.searchPatients(searchQuery)
          .then(res => setSearchResults(res.patients || []))
          .catch(() => setSearchResults([]))
          .finally(() => setIsSearching(false));
      }, 300);
      return () => clearTimeout(timeout);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const selectMatchedPatient = (p: any) => {
    setMatchedPatient(p);
    setPatientName(p.name);
    setGender(p.gender || 'Female');
    setBirthday(p.date_of_birth ? p.date_of_birth.split('T')[0] : '');
    setCivilStatus(p.civil_status || 'Single');
    setPurok(p.purok || 'Purok 1');
    setPhone(p.phone || '');
    setEmail(p.email || '');
    setPreviousEncounter(p.previous_encounter || null);
    setIsVerifiedSame(null);
  };

  const getBpCategory = (sys: string, dia: string) => {
    const s = parseInt(sys, 10);
    const d = parseInt(dia, 10);
    if (isNaN(s) || isNaN(d)) return { label: 'Incomplete', color: 'bg-slate-100 text-slate-700' };
    if (s >= 180 || d >= 120) return { label: 'Hypertensive Alert', color: 'bg-red-600 text-white animate-pulse' };
    if (s >= 140 || d >= 90) return { label: 'Stage 2 HTN', color: 'bg-red-100 text-red-800 font-bold' };
    if (s >= 130 || d >= 80) return { label: 'Stage 1 HTN', color: 'bg-amber-100 text-amber-800 font-semibold' };
    if (s >= 120 && d < 80) return { label: 'Elevated BP', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Normal BP', color: 'bg-emerald-100 text-emerald-800 font-semibold' };
  };

  const addPrescriptionItem = () => {
    if (!medInputName.trim()) {
      toast.error('Please enter or select medication name');
      return;
    }
    const qtyNum = parseInt(medInputQty, 10);
    if (isNaN(qtyNum) || qtyNum < 1) {
      toast.error('Please enter a valid quantity of at least 1 unit');
      return;
    }
    if (selectedIntakeInvItem && selectedIntakeInvItem.stock < qtyNum) {
      toast.error(`Stock limit exceeded: only ${selectedIntakeInvItem.stock} ${selectedIntakeInvItem.unit || 'units'} available in inventory`);
      return;
    }
    const item: PrescribedItem = {
      id: String(Date.now()),
      name: medInputName.trim(),
      dosage: medInputDosage.trim() || (isDosageInName ? extractedDosage : ''),
      frequency: medInputFreq.trim() || 'As directed',
      duration: medInputDuration.trim() || 'Course completion',
      instructions: medInputInstructions.trim(),
      quantity: qtyNum,
      unit: selectedIntakeInvItem?.unit || 'units'
    };
    setPrescribedList(prev => [...prev, item]);
    setMedInputName('');
    setMedInputDosage('');
    setMedInputFreq('');
    setMedInputQty('1');
    toast.success(`Added ${qtyNum}x ${item.name} to prescription`);
  };

  const removePrescriptionItem = (id: string) => {
    setPrescribedList(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      toast.error('Patient name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanSys = bpSystolic.replace(/\D/g, '');
      const cleanDia = bpDiastolic.replace(/\D/g, '');
      const bpValue = (cleanSys && cleanDia) ? `${cleanSys}/${cleanDia} mmHg` : (cleanSys || cleanDia ? `${cleanSys || cleanDia} mmHg` : '');

      // Determine program label and diagnosis/treatment synthesis
      const actualProgram = selectedProgram === 'Consultation' ? consultProgram : selectedProgram;

      const formattedRx = prescribedList.length > 0
        ? prescribedList.map(m => `${m.name} ${m.dosage} (Qty: ${m.quantity || 1} ${m.unit || 'units'}) [${m.frequency}, ${m.duration}]${m.instructions ? ` - ${m.instructions}` : ''}`).join('; ')
        : treatment;

      let finalChiefComplaint = chiefComplaint;
      let finalDiagnosis = diagnosis;
      let finalTreatment = formattedRx || treatment;

      if (actualProgram === 'Adolescent Health') {
        finalChiefComplaint = chiefComplaint || `Adolescent Health Check (${adolescentStage})`;
        finalDiagnosis = diagnosis || `Adolescent Wellness Evaluation - ${adolescentFocus}`;
        finalTreatment = treatment || `Guidance provided: ${adolescentFocus}. ${adolescentGuardian}. Notes: ${adolescentNotes}`;
      } else if (actualProgram === 'Teenage Pregnancy Prevention') {
        finalChiefComplaint = chiefComplaint || 'Adolescent Reproductive Health & Teenage Pregnancy Prevention';
        finalDiagnosis = diagnosis || `Risk Assessment: ${teenRiskAssessment}`;
        finalTreatment = treatment || `Counseling provided: ${teenCounselingTopic}. Peer Support: ${teenSupportReferred}`;
      } else if (actualProgram === 'NTP (TB-DOTS)') {
        finalChiefComplaint = chiefComplaint || 'Tuberculosis Clinical Evaluation & DOTS Adherence';
        finalDiagnosis = diagnosis || `TB Status: ${tbSputumStatus} (${tbCategory})`;
        finalTreatment = treatment || `Regimen: ${tbPhase}. Treatment Partner: ${tbAdherencePartner}`;
      } else if (actualProgram === 'Family Planning') {
        finalChiefComplaint = chiefComplaint || `Family Planning Service (${fpMethod})`;
        finalDiagnosis = diagnosis || `Family Planning Method: ${fpMethod} (${fpClientType})`;
        finalTreatment = treatment || `Provided: ${fpMethod}. Next Resupply: ${fpNextSupply || 'Scheduled'}`;
      }

      const activeVaccine = customVaccine.trim() || vaccineName;

      const payload = {
        patient_name: patientName.trim(),
        contact_number: phone.trim(),
        email: email.trim() || undefined,
        gender,
        date_of_birth: birthday || undefined,
        age: age ? String(age) : undefined,
        civil_status: civilStatus,
        purok,
        barangay,
        service_type: actualProgram,
        program_type: actualProgram,
        bp: bpValue,
        temp: `${temp} °C`,
        weight: weight ? `${weight} kg` : undefined,
        height: height ? `${height} cm` : undefined,
        heart_rate: heartRate ? `${heartRate} bpm` : '75 bpm',
        chief_complaint: finalChiefComplaint || 'Routine Health Visit',
        diagnosis: finalDiagnosis || 'Assessment Complete',
        treatment: finalTreatment,
        prescribed_meds: formattedRx || finalTreatment,
        prescriptions: prescribedList.map(p => ({
          ...p,
          quantity: p.quantity || 1
        })),
        lmp: lmp || undefined,
        edd: edd || undefined,
        aog_weeks: aogWeeks || undefined,
        gravida,
        para,
        fetal_heart_rate: fetalHeartRate,
        fundic_height: fundicHeight,
        method_chosen: fpMethod,
        client_type: fpClientType,
        next_supply_date: fpNextSupply || nextVisitDate || undefined,
        vaccine_name: activeVaccine,
        dose_number: doseNumber,
        due_date: nextDueDate || nextVisitDate || undefined,
        next_visit_date: nextVisitDate || undefined,
        attending_worker: attendingWorker
      };

      const res = await apiService.submitClinicalIntake(payload);
      const createdRecord = (res as any)?.record || {
        id: Date.now(),
        patient_name: patientName.trim(),
        contact_number: phone.trim(),
        age: age || '—',
        gender,
        barangay,
        service_type: actualProgram,
        bp: bpValue,
        temp: `${temp} °C`,
        weight: weight ? `${weight} kg` : '—',
        heart_rate: heartRate ? `${heartRate} bpm` : '75 bpm',
        chief_complaint: finalChiefComplaint,
        diagnosis: finalDiagnosis,
        treatment: finalTreatment,
        attending_nurse: attendingWorker,
        consultation_date: new Date().toISOString().split('T')[0],
        status: 'Completed'
      };

      toast.success(`Clinical intake for ${patientName} saved successfully!`, {
        description: `Program: ${actualProgram} | Instant sync to Health Registry`
      });

      try {
        const ch = new BroadcastChannel('barangay_health_sync');
        ch.postMessage({ type: 'HEALTH_DATA_SYNC', timestamp: Date.now() });
        ch.close();
      } catch {}

      if (onSuccess) onSuccess(createdRecord);
      handleReset();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit clinical intake');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setMatchedPatient(null);
    setIsVerifiedSame(null);
    setPreviousEncounter(null);
    setSearchQuery('');
    setPatientName('');
    setPhone('');
    setEmail('');
    setBirthday('');
    setAge('');
    setChiefComplaint('');
    setDiagnosis('');
    setTreatment('');
    setPrescribedList([]);
    setNextVisitDate('');
  };

  const bpStatus = getBpCategory(bpSystolic, bpDiastolic);

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) { handleReset(); onClose(); } }}>
      <DialogContent 
        onPointerDownOutside={(e) => e.preventDefault()}
        className="max-w-2xl max-h-[92vh] overflow-y-auto bg-white p-0 shadow-2xl rounded-2xl border border-slate-200"
      >
        {/* Clean White Clinical Header */}
        <div className="p-5 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                EHR Clinical Intake
              </span>
              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                <MapPin size={12} className="text-teal-600" /> Barangay {barangay} Health Center
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium">Attending: {attendingWorker}</span>
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 mt-1.5 flex items-center gap-2">
            <Stethoscope className="text-teal-600" size={20} />
            Patient Health Intake &amp; Program Registry
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            Register patient demographics, record vital signs, and assign to General, Adolescent, Family Planning, or NIP.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Quick Patient Search / Returning Recall */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Search size={14} className="text-teal-600" />
                Returning Patient Lookup / Record Recall
              </Label>
              <span className="text-[10px] text-slate-400">Search by Name or Mobile Phone</span>
            </div>

            <div className="relative">
              <Input
                placeholder="Type name (e.g. Maria Santos) or phone to look up existing records..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 text-xs bg-white pr-8 rounded-xl border-slate-200"
              />
              {isSearching && (
                <div className="absolute right-2.5 top-2.5">
                  <span className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin block" />
                </div>
              )}
            </div>

            {searchResults.length > 0 && !matchedPatient && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 mt-1">
                {searchResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => selectMatchedPatient(p)}
                    className="p-2.5 hover:bg-teal-50/70 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{p.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {p.gender} · {p.purok} · Phone: {p.phone || 'No phone'}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-teal-50 text-teal-700 text-[10px] font-semibold border-teal-200">
                      Select Patient
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {matchedPatient && (
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
                    <UserCheck size={16} className="text-emerald-600" />
                    Existing Patient Found: {matchedPatient.name}
                  </div>
                  <Badge className="bg-emerald-600 text-white text-[10px]">Record Linked</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] text-emerald-800 bg-white/70 p-2 rounded-lg border border-emerald-100">
                  <div><span className="font-semibold text-slate-500">Gender/Age:</span> {gender} ({age || '—'} yrs)</div>
                  <div><span className="font-semibold text-slate-500">Purok:</span> {purok}</div>
                  <div><span className="font-semibold text-slate-500">Phone:</span> {phone || 'None'}</div>
                </div>

                {isVerifiedSame === null ? (
                  <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60">
                    <span className="text-[11px] text-slate-600 font-medium">Are these details still accurate?</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => { setIsVerifiedSame(true); toast.success('Patient confirmed!'); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 gap-1 font-semibold cursor-pointer rounded-lg"
                      >
                        <Check size={12} /> Confirm &amp; Keep
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setIsVerifiedSame(false)}
                        className="text-xs h-7 gap-1 border-slate-300 text-slate-600 cursor-pointer rounded-lg"
                      >
                        <Edit2 size={12} /> Edit Details
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={13} /> Details verified. Ready for clinical encounter.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 1: Demographics */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <User size={14} className="text-teal-600" />
              1. Patient Demographics &amp; Contact
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2 relative">
                <Label className="text-xs font-semibold text-slate-700">Full Patient Name <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    value={patientName}
                    onChange={e => {
                      const clean = e.target.value.replace(/[0-9]/g, '');
                      setPatientName(clean);
                      setSearchQuery(clean);
                      setShowNameSuggestions(true);
                    }}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowNameSuggestions(true);
                    }}
                    placeholder="Type name (matches database automatically)"
                    required
                    className="h-9 text-xs mt-1 bg-white rounded-xl border-slate-200"
                  />
                  {isSearching && (
                    <span className="absolute right-2.5 top-3 text-[10px] text-teal-600 font-semibold animate-pulse">
                      Searching...
                    </span>
                  )}
                </div>

                {/* Auto-suggest dropdown beneath patient name */}
                {showNameSuggestions && searchResults.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-teal-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                    <div className="p-1.5 bg-teal-50/80 text-[10px] font-bold text-teal-800 flex items-center justify-between px-3">
                      <span>Found in Registry ({searchResults.length})</span>
                      <button
                        type="button"
                        onClick={() => setShowNameSuggestions(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    {searchResults.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          selectMatchedPatient(p);
                          setShowNameSuggestions(false);
                          toast.success(`Loaded details for ${p.name}`);
                        }}
                        className="w-full text-left p-2.5 hover:bg-teal-50/60 transition-colors flex items-center justify-between text-xs cursor-pointer group"
                      >
                        <div>
                          <span className="font-bold text-slate-800 group-hover:text-teal-700 block">{p.name}</span>
                          <span className="text-[10px] text-slate-500 block">
                            {p.gender} · {p.purok || 'Pianing'} · {p.phone || 'No phone'}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[9px] bg-white border-teal-300 text-teal-700 shrink-0">
                          Auto-Fill
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Gender <span className="text-red-500">*</span></Label>
                <Select value={gender} onValueChange={(v: any) => setGender(v)}>
                  <SelectTrigger className="h-9 text-xs mt-1 bg-white rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Birthday</Label>
                <Input
                  type="date"
                  value={birthday}
                  onChange={e => setBirthday(e.target.value)}
                  className="h-9 text-xs mt-1 bg-white rounded-xl border-slate-200"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Age (Yrs)</Label>
                <Input
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder="Age"
                  className="h-9 text-xs mt-1 bg-slate-50 font-semibold rounded-xl border-slate-200"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Civil Status</Label>
                <Select value={civilStatus} onValueChange={setCivilStatus}>
                  <SelectTrigger className="h-9 text-xs mt-1 bg-white rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                    <SelectItem value="Separated">Separated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Purok / Zone</Label>
                <Select value={purok} onValueChange={setPurok}>
                  <SelectTrigger className="h-9 text-xs mt-1 bg-white rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5', 'Purok 6'].map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Contact Mobile Phone <span className="text-red-500">*</span></Label>
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="09XXXXXXXXX (11 digits)"
                  required
                  maxLength={11}
                  className="h-9 text-xs font-mono mt-1 bg-white rounded-xl border-slate-200"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Email Address (Optional)</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. patient@gmail.com"
                  className="h-9 text-xs mt-1 bg-white rounded-xl border-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Vitals with Dual BP Inputs */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Activity size={14} className="text-rose-500" />
                2. Triage Vital Signs
              </h4>
              <Badge className={`text-[10px] border-0 ${bpStatus.color}`}>
                {bpStatus.label}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Dual BP input */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <Label className="text-[11px] font-semibold text-slate-600 block">BP (Systolic / Diastolic)</Label>
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    value={bpSystolic}
                    onChange={e => setBpSystolic(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    placeholder="120"
                    maxLength={3}
                    className="h-8 text-xs font-mono text-center bg-white rounded-lg border-slate-200"
                  />
                  <span className="text-slate-400 font-bold">/</span>
                  <Input
                    value={bpDiastolic}
                    onChange={e => setBpDiastolic(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    placeholder="80"
                    maxLength={3}
                    className="h-8 text-xs font-mono text-center bg-white rounded-lg border-slate-200"
                  />
                  <span className="text-[10px] text-slate-400">mmHg</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <Label className="text-[11px] font-semibold text-slate-600 block">Body Temp (°C)</Label>
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    value={temp}
                    onChange={e => setTemp(e.target.value)}
                    placeholder="36.5"
                    className="h-8 text-xs font-mono text-center bg-white rounded-lg border-slate-200"
                  />
                  <span className="text-[10px] text-slate-400">°C</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <Label className="text-[11px] font-semibold text-slate-600 block">Weight (kg)</Label>
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder="54"
                    className="h-8 text-xs font-mono text-center bg-white rounded-lg border-slate-200"
                  />
                  <span className="text-[10px] text-slate-400">kg</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <Label className="text-[11px] font-semibold text-slate-600 block">Heart Rate (bpm)</Label>
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    value={heartRate}
                    onChange={e => setHeartRate(e.target.value)}
                    placeholder="75"
                    className="h-8 text-xs font-mono text-center bg-white rounded-lg border-slate-200"
                  />
                  <span className="text-[10px] text-slate-400">bpm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Primary Program Selection */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              3. Purpose of Visit / Primary Health Program
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'Consultation', label: 'Consultation', icon: Stethoscope, desc: 'Medical & Specialized' },
                { id: 'Prenatal', label: 'Prenatal Check', icon: Heart, desc: 'Maternal Care' },
                { id: 'Family Planning', label: 'Family Planning', icon: Pill, desc: 'Supplies & Contraception' },
                { id: 'NIP Immunization', label: 'NIP Vaccine', icon: Baby, desc: 'Child Immunization' }
              ].map(prog => {
                const isSelected = selectedProgram === prog.id;
                return (
                  <button
                    type="button"
                    key={prog.id}
                    onClick={() => setSelectedProgram(prog.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/80 shadow-xs ring-2 ring-teal-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <prog.icon size={18} className={isSelected ? 'text-teal-700' : 'text-slate-500'} />
                      {isSelected && <CheckCircle2 size={14} className="text-teal-600" />}
                    </div>
                    <div className="mt-2">
                      <p className={`text-xs font-bold ${isSelected ? 'text-teal-900' : 'text-slate-800'}`}>{prog.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{prog.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* If Consultation: Show Specialized Sub-Programs */}
            {selectedProgram === 'Consultation' && (
              <div className="p-3.5 bg-teal-50/50 border border-teal-200 rounded-2xl space-y-3 mt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-teal-600" />
                    Specialized Consultation Program
                  </Label>
                  <span className="text-[10px] text-teal-700 font-medium">Select matching clinical program</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'General Consultation', label: 'General Consultation', color: 'teal' },
                    { id: 'Adolescent Health', label: 'Adolescent Health', color: 'purple' },
                    { id: 'Family Planning', label: 'Family Planning', color: 'emerald' },
                    { id: 'Teenage Pregnancy Prevention', label: 'Teenage Prevention', color: 'rose' },
                    { id: 'NTP (TB-DOTS)', label: 'NTP (TB-DOTS)', color: 'amber' }
                  ].map(p => {
                    const isSubSel = consultProgram === p.id;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setConsultProgram(p.id as any)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold text-left transition-all cursor-pointer border ${
                          isSubSel
                            ? 'bg-white text-teal-900 border-teal-500 shadow-xs ring-2 ring-teal-500/20'
                            : 'bg-teal-50/70 text-slate-700 border-teal-200/80 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{p.label}</span>
                          {isSubSel && <Check size={13} className="text-teal-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-Program: Adolescent Health */}
                {consultProgram === 'Adolescent Health' && (
                  <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2.5 text-xs">
                    <p className="font-bold text-purple-900 flex items-center gap-1">
                      <User size={13} className="text-purple-600" /> Adolescent Health Clinical Assessment
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-700">Pubertal Stage</Label>
                        <Select value={adolescentStage} onValueChange={setAdolescentStage}>
                          <SelectTrigger className="h-8 text-xs bg-white mt-1"><SelectValue placeholder="Select pubertal stage..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Early Adolescent (10-14 yrs)">Early Adolescent (10-14 yrs)</SelectItem>
                            <SelectItem value="Mid Adolescent (15-17 yrs)">Mid Adolescent (15-17 yrs)</SelectItem>
                            <SelectItem value="Late Adolescent (18-24 yrs)">Late Adolescent (18-24 yrs)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-700">Counseling Focus</Label>
                        <Select value={adolescentFocus} onValueChange={setAdolescentFocus}>
                          <SelectTrigger className="h-8 text-xs bg-white mt-1"><SelectValue placeholder="Select counseling focus..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pubertal Guidance & Mental Wellness">Pubertal Guidance &amp; Mental Wellness</SelectItem>
                            <SelectItem value="Nutrition & Healthy Lifestyle">Nutrition &amp; Healthy Lifestyle</SelectItem>
                            <SelectItem value="Substance Use Prevention">Substance Use Prevention</SelectItem>
                            <SelectItem value="Stress & Peer Counseling">Stress &amp; Peer Counseling</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-Program: Teenage Pregnancy Prevention */}
                {consultProgram === 'Teenage Pregnancy Prevention' && (
                  <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2.5 text-xs">
                    <p className="font-bold text-rose-900 flex items-center gap-1">
                      <ShieldCheck size={13} className="text-rose-600" /> Teenage Pregnancy Prevention Counseling
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-700">Risk Assessment</Label>
                        <Select value={teenRiskAssessment} onValueChange={setTeenRiskAssessment}>
                          <SelectTrigger className="h-8 text-xs bg-white mt-1"><SelectValue placeholder="Select risk assessment..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Low Risk / Preventive Counseling">Low Risk / Preventive Counseling</SelectItem>
                            <SelectItem value="Moderate Risk / Sexually Active Youth">Moderate Risk / Sexually Active</SelectItem>
                            <SelectItem value="High Risk / Out of School Youth">High Risk / Out of School Youth</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-700">Counseling Given</Label>
                        <Select value={teenCounselingTopic} onValueChange={setTeenCounselingTopic}>
                          <SelectTrigger className="h-8 text-xs bg-white mt-1"><SelectValue placeholder="Select counseling given..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Abstinence & Dual Protection Counseling">Abstinence &amp; Dual Protection</SelectItem>
                            <SelectItem value="Adolescent Reproductive Health Rights">Reproductive Health Education</SelectItem>
                            <SelectItem value="Contraceptive Counseling for High-Risk">Contraceptive Counseling</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-Program: NTP (TB-DOTS) */}
                {consultProgram === 'NTP (TB-DOTS)' && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5 text-xs">
                    <p className="font-bold text-amber-900 flex items-center gap-1">
                      <Activity size={13} className="text-amber-600" /> National TB Control Program (NTP / TB-DOTS)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-700">Sputum / GeneXpert Status</Label>
                        <Select value={tbSputumStatus} onValueChange={setTbSputumStatus}>
                          <SelectTrigger className="h-8 text-xs bg-white mt-1"><SelectValue placeholder="Select sputum status..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GeneXpert Positive (MTB Detected)">GeneXpert Positive (MTB Detected)</SelectItem>
                            <SelectItem value="GeneXpert Negative (Not Detected)">GeneXpert Negative (Not Detected)</SelectItem>
                            <SelectItem value="GeneXpert / AFB Pending">GeneXpert / AFB Pending</SelectItem>
                            <SelectItem value="Clinically Diagnosed TB">Clinically Diagnosed TB</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-700">Treatment Phase</Label>
                        <Select value={tbPhase} onValueChange={setTbPhase}>
                          <SelectTrigger className="h-8 text-xs bg-white mt-1"><SelectValue placeholder="Select treatment phase..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Intensive Phase (2 Months RHZE)">Intensive Phase (2 Mos RHZE)</SelectItem>
                            <SelectItem value="Continuation Phase (4 Months RH)">Continuation Phase (4 Mos RH)</SelectItem>
                            <SelectItem value="Preventive Therapy (TPT)">Preventive Therapy (TPT)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Chief Complaint & Diagnosis for Consultation */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Chief Complaint / Primary Symptoms <span className="text-red-500">*</span></Label>
                  <Input
                    value={chiefComplaint}
                    onChange={e => setChiefComplaint(e.target.value)}
                    placeholder="e.g. Mild dry cough, fever for 3 days, headaches"
                    required={selectedProgram === 'Consultation'}
                    className="h-9 text-xs mt-1 bg-white rounded-xl border-slate-200"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Clinical Assessment / Diagnosis</Label>
                  <Input
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Upper Respiratory Infection / Tension Headache"
                    className="h-9 text-xs mt-1 bg-white rounded-xl border-slate-200"
                  />
                </div>

                {/* Dynamic Multi-Medicine Prescription Builder */}
                <div className="bg-white border border-teal-200/80 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                      <Pill size={14} className="text-teal-600" />
                      Dynamic Prescription Builder
                    </Label>
                    <span className="text-[10px] text-slate-400">Add multiple medications</span>
                  </div>

                  {/* Step 1: Select Medicine from Inventory */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[11px] flex items-center justify-center font-bold">1</span>
                        Choose Medicine:
                      </Label>
                      {selectedIntakeInvItem ? (
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
                          selectedIntakeInvItem.stock <= 0
                            ? 'bg-rose-100 text-rose-700'
                            : selectedIntakeInvItem.stock <= 20
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {selectedIntakeInvItem.stock <= 0 ? 'Out of Stock' : `In Stock: ${selectedIntakeInvItem.stock} ${selectedIntakeInvItem.unit || 'units'}`}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Select medicine to verify stock</span>
                      )}
                    </div>

                    <Select
                      value={medInputName}
                      onValueChange={(val) => {
                        setMedInputName(val);
                        setMedInputQty('1');
                        const match = val.match(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|nebules?)\b/i);
                        if (match) {
                          setMedInputDosage(match[0]);
                        } else {
                          setMedInputDosage('');
                        }
                      }}
                    >
                      <SelectTrigger className="h-9.5 text-xs bg-white rounded-xl border-slate-200 shadow-xs focus:ring-2 focus:ring-teal-500">
                        <SelectValue placeholder="Select medication from inventory..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {activeCatalog
                          .filter(i => i.category === 'Essential Medicine' || i.category === 'Maternal Vitamin')
                          .map(med => (
                            <SelectItem key={med.id} value={med.item_name} disabled={med.stock <= 0}>
                              <div className="flex items-center justify-between gap-3 w-full text-xs py-1">
                                <span className="font-semibold text-slate-800">{med.item_name}</span>
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                  med.stock <= 0
                                    ? 'bg-red-50 text-red-600'
                                    : med.stock <= 20
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                  {med.stock <= 0 ? '0 (Out)' : `${med.stock} ${med.unit || 'units'}`}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Step 2: Choose Quantity (Dynamic limit based on selected medicine) */}
                  <div className={`border rounded-xl p-3 space-y-2.5 transition-all ${
                    selectedIntakeInvItem ? 'bg-teal-50/40 border-teal-200' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between text-xs">
                      <Label className="font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[11px] flex items-center justify-center font-bold">2</span>
                        Quantity to Dispense:
                      </Label>
                      {selectedIntakeInvItem && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          Available: <strong className="text-teal-700 font-mono">{selectedIntakeInvItem.stock}</strong> {selectedIntakeInvItem.unit || 'units'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-24">
                        <Input
                          type="number"
                          min="1"
                          max={selectedIntakeInvItem ? selectedIntakeInvItem.stock : undefined}
                          value={medInputQty}
                          onChange={e => setMedInputQty(e.target.value)}
                          placeholder="1"
                          disabled={!selectedIntakeInvItem || selectedIntakeInvItem.stock <= 0}
                          className="h-8.5 text-xs bg-white rounded-lg border-teal-300 font-mono font-bold text-center shadow-2xs focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {['1', '2', '5', '10', '14', '20', '30'].map(q => (
                          <button
                            type="button"
                            key={q}
                            disabled={!selectedIntakeInvItem || (selectedIntakeInvItem.stock < parseInt(q, 10))}
                            onClick={() => setMedInputQty(q)}
                            className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all font-semibold ${
                              !selectedIntakeInvItem || (selectedIntakeInvItem.stock < parseInt(q, 10))
                                ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                                : medInputQty === q
                                ? 'bg-teal-600 text-white border-teal-600 font-bold shadow-xs cursor-pointer'
                                : 'bg-white hover:bg-teal-50 text-slate-700 border-slate-200 cursor-pointer'
                            }`}
                          >
                            {q}
                          </button>
                        ))}
                        {selectedIntakeInvItem && selectedIntakeInvItem.stock > 0 && (
                          <button
                            type="button"
                            onClick={() => setMedInputQty(String(selectedIntakeInvItem.stock))}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold cursor-pointer transition-colors"
                          >
                            Max ({selectedIntakeInvItem.stock})
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                          Dosage / Strength {isDosageInName && <span className="text-[10px] text-teal-600 font-normal">(Auto-locked from item)</span>}
                        </Label>
                        <Input
                          value={medInputDosage}
                          onChange={e => setMedInputDosage(e.target.value)}
                          disabled={isDosageInName}
                          placeholder="e.g. 500mg"
                          className={`h-8 text-xs rounded-lg border-slate-200 shadow-2xs ${isDosageInName ? 'bg-slate-100 text-slate-700 cursor-not-allowed font-medium' : 'bg-white'}`}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Frequency & Instructions</Label>
                        <Input
                          value={medInputFreq}
                          onChange={e => setMedInputFreq(e.target.value)}
                          placeholder="e.g., Take 1 tablet every 8 hours after meals"
                          className="h-8 text-xs bg-white rounded-lg border-slate-200 shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Continue ("then continue") */}
                  <div>
                    <Button
                      type="button"
                      onClick={addPrescriptionItem}
                      disabled={!medInputName.trim()}
                      className={`w-full text-xs h-9 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all ${
                        medInputName.trim()
                          ? 'bg-teal-600 hover:bg-teal-700 text-white'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <Plus size={14} />
                      {medInputName.trim()
                        ? `Continue (Add ${medInputQty || 1}x ${medInputName}) →`
                        : 'Choose a medicine above, then set quantity & continue'}
                    </Button>
                  </div>

                  {/* Prescribed Items Table */}
                  {prescribedList.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {prescribedList.map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{idx + 1}. {item.name} {item.dosage}</span>
                              <Badge className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-mono font-bold px-1.5 py-0">
                                Qty: {item.quantity || 1} {item.unit || ''}
                              </Badge>
                            </div>
                            <span className="text-slate-500 text-[11px] block">{item.frequency} for {item.duration}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePrescriptionItem(item.id)}
                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Program 2: Prenatal Expanded */}
            {selectedProgram === 'Prenatal' && (
              <div className="p-3.5 bg-pink-50/50 border border-pink-200 rounded-2xl space-y-2.5 mt-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-pink-900">
                  <Heart size={15} className="text-pink-600" />
                  Maternal Health &amp; Prenatal Check-up Entry
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs font-semibold">LMP (Last Period) <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={lmp}
                      onChange={e => setLmp(e.target.value)}
                      required={selectedProgram === 'Prenatal'}
                      className="h-9 text-xs mt-1 bg-white rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Estimated Due (EDD)</Label>
                    <Input
                      value={edd}
                      readOnly
                      placeholder="Auto computed"
                      className="h-9 text-xs mt-1 bg-pink-50/70 font-semibold rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Gestation (AOG)</Label>
                    <Input
                      value={aogWeeks}
                      readOnly
                      placeholder="Auto computed"
                      className="h-9 text-xs mt-1 bg-pink-50/70 font-semibold rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs font-semibold">Gravida (G)</Label>
                    <Input value={gravida} onChange={e => setGravida(e.target.value)} placeholder="e.g. 1" className="h-9 text-xs mt-1 bg-white text-center font-mono rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Para (P)</Label>
                    <Input value={para} onChange={e => setPara(e.target.value)} placeholder="e.g. 0" className="h-9 text-xs mt-1 bg-white text-center font-mono rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Fetal Heart (bpm)</Label>
                    <Input value={fetalHeartRate} onChange={e => setFetalHeartRate(e.target.value)} placeholder="140" className="h-9 text-xs mt-1 bg-white text-center font-mono rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Fundic Ht (cm)</Label>
                    <Input value={fundicHeight} onChange={e => setFundicHeight(e.target.value)} placeholder="20" className="h-9 text-xs mt-1 bg-white text-center font-mono rounded-xl" />
                  </div>
                </div>
              </div>
            )}

            {/* Program 3: Family Planning Expanded */}
            {selectedProgram === 'Family Planning' && (
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-2.5 mt-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-900">
                  <Pill size={15} className="text-indigo-600" />
                  Family Planning (FP) Service Intake
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold">FP Method Provided <span className="text-red-500">*</span></Label>
                    <Select value={fpMethod} onValueChange={setFpMethod}>
                      <SelectTrigger className="h-9 text-xs mt-1 bg-white rounded-xl"><SelectValue placeholder="Select FP method..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DMPA Injectable (Depo)">DMPA Injectable (Depo-Provera 3-Month)</SelectItem>
                        <SelectItem value="Oral Contraceptive Pills (Combined)">Oral Contraceptive Pills (Combined)</SelectItem>
                        <SelectItem value="Progestin-Only Pills (POP)">Progestin-Only Pills (POP)</SelectItem>
                        <SelectItem value="Subdermal Implants (Implanon)">Subdermal Implants (3-Year Implanon)</SelectItem>
                        <SelectItem value="Intrauterine Device (IUD)">Intrauterine Device (IUD)</SelectItem>
                        <SelectItem value="Male Condoms">Male Condoms (Supply Distribution)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Client Status</Label>
                    <Select value={fpClientType} onValueChange={setFpClientType}>
                      <SelectTrigger className="h-9 text-xs mt-1 bg-white rounded-xl"><SelectValue placeholder="Select client status..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Current User">Current User (Resupply / Routine)</SelectItem>
                        <SelectItem value="New Acceptor">New Acceptor (First Time)</SelectItem>
                        <SelectItem value="Method Switch">Method Switch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Program 4: NIP Immunization Expanded */}
            {selectedProgram === 'NIP Immunization' && (
              <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-2.5 mt-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900">
                  <Baby size={15} className="text-blue-600" />
                  National Immunization Program (NIP) Record
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold">Vaccine Administered <span className="text-red-500">*</span></Label>
                    <Select value={vaccineName} onValueChange={setVaccineName}>
                      <SelectTrigger className="h-9 text-xs mt-1 bg-white rounded-xl"><SelectValue placeholder="Select vaccine..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BCG (Birth)">
                          BCG {availableInventory.find(i => i.item_name.toLowerCase().includes('bcg')) ? `(Stock: ${availableInventory.find(i => i.item_name.toLowerCase().includes('bcg'))?.stock} vials)` : ''}
                        </SelectItem>
                        <SelectItem value="Hepatitis B (Birth)">
                          Hepatitis B {availableInventory.find(i => i.item_name.toLowerCase().includes('hepatitis')) ? `(Stock: ${availableInventory.find(i => i.item_name.toLowerCase().includes('hepatitis'))?.stock} vials)` : ''}
                        </SelectItem>
                        <SelectItem value="Pentavalent (DPT-HepB-Hib)">
                          Pentavalent {availableInventory.find(i => i.item_name.toLowerCase().includes('pentavalent')) ? `(Stock: ${availableInventory.find(i => i.item_name.toLowerCase().includes('pentavalent'))?.stock} vials)` : ''}
                        </SelectItem>
                        <SelectItem value="Oral Polio Vaccine (OPV)">
                          Oral Polio (OPV) {availableInventory.find(i => i.item_name.toLowerCase().includes('polio')) ? `(Stock: ${availableInventory.find(i => i.item_name.toLowerCase().includes('polio'))?.stock} vials)` : ''}
                        </SelectItem>
                        <SelectItem value="Inactivated Polio (IPV)">
                          Inactivated Polio (IPV)
                        </SelectItem>
                        <SelectItem value="Pneumococcal Conjugate (PCV)">
                          PCV 13 {availableInventory.find(i => i.item_name.toLowerCase().includes('pcv')) ? `(Stock: ${availableInventory.find(i => i.item_name.toLowerCase().includes('pcv'))?.stock} vials)` : ''}
                        </SelectItem>
                        <SelectItem value="Measles, Mumps, Rubella (MMR)">
                          Measles-Rubella (MR) {availableInventory.find(i => i.item_name.toLowerCase().includes('measles')) ? `(Stock: ${availableInventory.find(i => i.item_name.toLowerCase().includes('measles'))?.stock} vials)` : ''}
                        </SelectItem>
                        <SelectItem value="Other">Other / Custom Vaccine</SelectItem>
                      </SelectContent>
                    </Select>
                    {vaccineName === 'Other' && (
                      <Input
                        value={customVaccine}
                        onChange={e => setCustomVaccine(e.target.value)}
                        placeholder="Enter custom vaccine name..."
                        className="h-8 text-xs mt-1.5 bg-white rounded-lg"
                      />
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Dose Number</Label>
                    <Select value={doseNumber} onValueChange={setDoseNumber}>
                      <SelectTrigger className="h-9 text-xs mt-1 bg-white rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Dose 1</SelectItem>
                        <SelectItem value="2">Dose 2</SelectItem>
                        <SelectItem value="3">Dose 3</SelectItem>
                        <SelectItem value="Booster">Booster Dose</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Automated Next Visit Date */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar size={14} className="text-teal-600" />
                  Next Revisit / Due Date (Automated 1-Day Reminder)
                </Label>
                <span className="text-[10px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded-full">
                  SMS Ready
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Input
                    type="date"
                    value={nextVisitDate}
                    onChange={e => setNextVisitDate(e.target.value)}
                    className="h-9 text-xs bg-white rounded-xl border-slate-200"
                  />
                </div>
                <div className="text-[11px] text-slate-500 flex items-center">
                  <span>Patient will receive an automatic SMS reminder 1 day prior to revisit.</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold w-full h-10 shadow-md cursor-pointer gap-2 rounded-xl"
            >
              {isSubmitting ? (
                <span>Recording Clinical Intake...</span>
              ) : (
                <>
                  <Send size={14} /> Complete Clinical Intake &amp; Dispatch Record
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
