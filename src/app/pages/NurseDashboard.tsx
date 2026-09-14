import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Stethoscope, Heart, Baby, Activity, CalendarCheck, Clock,
  CheckCircle2, PlusCircle, RefreshCcw, LogOut, MapPin, Pill,
  Syringe, Calendar, Check, X, Menu, Phone, Edit2, Trash2, Bell,
  AlertTriangle, Send, Package, ClipboardList, UserPlus, Save, Archive, Eye, User,
  Sparkles, Filter, ShieldCheck, UserCheck, ChevronRight, UserCircle, Plus,
  Search, CalendarPlus
} from 'lucide-react';
import {
  apiService, ImmunizationRecord, MaternalRecord,
  HealthAppointment, ClinicSchedule, Resident, SmsNotification
} from '../../services/api';
import PatientDetailModal, { PatientRecordData } from '../components/PatientDetailModal';
import SmartClinicalIntakeModal from '../components/SmartClinicalIntakeModal';
import GmailNotificationHub from '../components/GmailNotificationHub';
import ClinicalArchivesHub from '../components/ClinicalArchivesHub';
import ProfileSettingsView from '../components/ProfileSettingsView';
import SmsDetailsModal from '../components/SmsDetailsModal';
import BatchSmsReminderModal, { DuePatientItem } from '../components/BatchSmsReminderModal';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

// ── Interfaces ─────────────────────────────────────────────────────────────

interface ClinicalConsultation {
  id: number | string;
  patient_name: string;
  contact_number: string;
  age: number | string;
  gender: string;
  barangay: string;
  service_type: string;
  program_type?: string;
  bp: string; temp: string; weight: string; heart_rate: string;
  chief_complaint: string; diagnosis: string; treatment: string;
  prescribed_meds?: string;
  attending_nurse: string; consultation_date: string;
  status?: string;
}

interface InventoryItem {
  id: number | string;
  item_name: string;
  category: string;
  stock: number;
  unit: string;
  expiry_date: string;
  status: string;
}

interface PrenatalRecord {
  id: number | string;
  patient_name: string;
  contact_number: string;
  age: number | string;
  barangay: string;
  gravida: string; para: string;
  lmp: string; edd: string; aog_weeks: string;
  bp: string; weight: string; temp: string;
  fetal_heart_rate: string; fundic_height: string;
  next_visit_date: string; next_visit_note: string;
  prescribed_meds: string; attending_nurse: string;
  visit_date: string; visit_number: number;
  sms_sent: boolean;
}

interface ImmunRecord {
  id: number | string;
  child_name: string;
  contact_number: string;
  age_months: string;
  gender?: string;
  guardian: string;
  barangay: string;
  weight?: string;
  height?: string;
  temp?: string;
  vaccine_given: string;
  dose_number: string;
  batch_number?: string;
  date_given: string;
  next_due_date: string;
  remarks?: string;
  attending_nurse: string;
  sms_sent: boolean;
}

interface WeeklySchedule {
  id: number | string;
  title: string;
  service_type: string;
  day: string;
  time_slot: string;
  location: string;
  assigned_to: string;
  posted_date: string;
}

interface EncounterArchive {
  id: number | string;
  patient_name: string;
  contact_number: string;
  encounter_type: string;
  details: string;
  date: string;
  attending: string;
}

interface PrescribedMedItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function NurseDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'consultations' | 'maternal' | 'immunizations' | 'schedule' | 'inventory' | 'archives' | 'sms' | 'profile'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // User session
  const [user, setUser] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('barangay_user') || 'null'); } catch { return null; }
  });
  const nurseBarangay = user?.barangay || 'Pianing';
  const nurseName = user?.name || 'Nurse Maria Santos, RN';

  // Auth guard
  useEffect(() => {
    const stored = localStorage.getItem('barangay_user');
    if (!stored) { navigate('/login'); return; }
    try {
      const role = (JSON.parse(stored)?.role || '').toLowerCase().trim();
      if (role !== 'nurse') navigate('/login');
    } catch { navigate('/login'); }
  }, [navigate]);

  // Global Profile Update Listener
  useEffect(() => {
    const handleProfileSync = (e: any) => {
      if (e.detail) setUser(e.detail);
    };
    window.addEventListener('user-profile-updated', handleProfileSync);
    return () => window.removeEventListener('user-profile-updated', handleProfileSync);
  }, []);

  // API Data States
  const [appointments, setAppointments] = useState<HealthAppointment[]>([]);

  // Appointments Management State
  const [apptSearch, setApptSearch] = useState('');
  const [apptStatusFilter, setApptStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Completed' | 'Cancelled'>('all');
  const [apptServiceFilter, setApptServiceFilter] = useState<string>('all');
  const [isApptModalOpen, setIsApptModalOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<HealthAppointment | null>(null);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('09:00 AM');
  const [schedNotes, setSchedNotes] = useState('');
  const [isSchedulingLoading, setIsSchedulingLoading] = useState(false);
  const [apptToCompleteId, setApptToCompleteId] = useState<number | null>(null);

  // Clinical Intake, Notifications & Profile Modal States
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBatchSmsOpen, setIsBatchSmsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SmsNotification[]>([]);
  const [selectedSms, setSelectedSms] = useState<SmsNotification | null>(null);
  const [isSendSmsModalOpen, setIsSendSmsModalOpen] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composePhone, setComposePhone] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeType, setComposeType] = useState('Health Alert');

  // Filter States
  const [consFilterProgram, setConsFilterProgram] = useState<string>('All');
  const [maternalFilterVisit, setMaternalFilterVisit] = useState<'all' | '1st' | '2nd' | '3rd' | 'due'>('all');
  const [immunFilterDose, setImmunFilterDose] = useState<'all' | 'dose1' | 'dose2' | 'dose3' | 'due'>('all');

  // 360 Patient Modal
  const [selectedPatientModal, setSelectedPatientModal] = useState<PatientRecordData | null>(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);

  // Clinical Consultations State (with rich baseline records)
  const [consultations, setConsultations] = useState<ClinicalConsultation[]>([
    {
      id: 101,
      patient_name: 'Elena Ramos-Santos',
      contact_number: '09171234567',
      age: 28,
      gender: 'Female',
      barangay: nurseBarangay,
      service_type: 'General Consultation',
      program_type: 'General Consultation',
      bp: '118/76 mmHg',
      temp: '36.5 °C',
      weight: '56.4 kg',
      heart_rate: '78 bpm',
      chief_complaint: 'Mild headache and fatigue for 2 days',
      diagnosis: 'Tension headache, mild physical strain',
      treatment: 'Paracetamol 500mg TID PRN; Adequate rest and hydration',
      prescribed_meds: 'Paracetamol 500mg TID',
      attending_nurse: nurseName,
      consultation_date: '2026-03-02',
      status: 'Completed'
    },
    {
      id: 102,
      patient_name: 'Joshua Kyle Dela Cruz',
      contact_number: '09182345678',
      age: 16,
      gender: 'Male',
      barangay: nurseBarangay,
      service_type: 'Adolescent Health',
      program_type: 'Adolescent Health',
      bp: '112/74 mmHg',
      temp: '36.6 °C',
      weight: '52.0 kg',
      heart_rate: '74 bpm',
      chief_complaint: 'Routine youth health assessment & pubertal guidance',
      diagnosis: 'Normal adolescent development, mild exam anxiety',
      treatment: 'Adolescent lifestyle counseling, stress management education',
      prescribed_meds: 'Multivitamins with Zinc 1 tab OD',
      attending_nurse: nurseName,
      consultation_date: '2026-03-03',
      status: 'Completed'
    },
    {
      id: 103,
      patient_name: 'Clarisse Anne Mendoza',
      contact_number: '09193456789',
      age: 26,
      gender: 'Female',
      barangay: nurseBarangay,
      service_type: 'Family Planning',
      program_type: 'Family Planning',
      bp: '115/75 mmHg',
      temp: '36.4 °C',
      weight: '51.5 kg',
      heart_rate: '76 bpm',
      chief_complaint: 'Family planning consultation and Depo resupply',
      diagnosis: 'Current user, tolerated DMPA injectable without side effects',
      treatment: 'DMPA 150mg/mL IM right deltoid; return for next injection on schedule',
      prescribed_meds: 'DMPA Injectable (Depo-Provera)',
      attending_nurse: nurseName,
      consultation_date: '2026-03-04',
      status: 'Completed'
    },
    {
      id: 104,
      patient_name: 'Angelica Rose Bautista',
      contact_number: '09204567890',
      age: 17,
      gender: 'Female',
      barangay: nurseBarangay,
      service_type: 'Teenage Pregnancy Prevention',
      program_type: 'Teenage Pregnancy Prevention',
      bp: '110/70 mmHg',
      temp: '36.5 °C',
      weight: '48.0 kg',
      heart_rate: '72 bpm',
      chief_complaint: 'Adolescent reproductive health counseling',
      diagnosis: 'Adolescent reproductive health assessment, healthy youth markers',
      treatment: 'Comprehensive sexual health education, abstinence & protection counseling',
      prescribed_meds: 'Iron + Folic Acid supplement 1 tab OD',
      attending_nurse: nurseName,
      consultation_date: '2026-03-04',
      status: 'Completed'
    },
    {
      id: 105,
      patient_name: 'Danilo C. Ocampo',
      contact_number: '09215678901',
      age: 52,
      gender: 'Male',
      barangay: nurseBarangay,
      service_type: 'NTP (TB-DOTS)',
      program_type: 'NTP (TB-DOTS)',
      bp: '124/82 mmHg',
      temp: '36.7 °C',
      weight: '58.0 kg',
      heart_rate: '80 bpm',
      chief_complaint: 'Persistent cough for 3 weeks, low grade afternoon fever',
      diagnosis: 'Presumptive Pulmonary Tuberculosis - GeneXpert pending',
      treatment: 'Sputum collected for GeneXpert test; Infection control counseling',
      prescribed_meds: 'Cough expectorant, awaiting GeneXpert confirmation',
      attending_nurse: nurseName,
      consultation_date: '2026-03-05',
      status: 'Completed'
    }
  ]);

  // Prenatal Records State (with 2nd Visit tracking)
  const [prenatalRecords, setPrenatalRecords] = useState<PrenatalRecord[]>([
    {
      id: 201,
      patient_name: 'Elena Ramos-Santos',
      contact_number: '09171234567',
      age: 28,
      barangay: nurseBarangay,
      gravida: 'G2',
      para: 'P1',
      lmp: '2025-10-15',
      edd: '2026-07-22',
      aog_weeks: '20',
      bp: '116/74',
      weight: '58.2',
      temp: '36.5',
      fetal_heart_rate: '146 bpm',
      fundic_height: '20 cm',
      next_visit_date: '2026-03-12',
      next_visit_note: '2nd Trimester Follow-up Ultrasound Review',
      prescribed_meds: 'FeSO4 60mg + Folic Acid 400mcg daily',
      attending_nurse: nurseName,
      visit_date: '2026-02-12',
      visit_number: 2,
      sms_sent: false
    },
    {
      id: 202,
      patient_name: 'Maricel Gomez-Tolentino',
      contact_number: '09278901234',
      age: 24,
      barangay: nurseBarangay,
      gravida: 'G1',
      para: 'P0',
      lmp: '2025-11-20',
      edd: '2026-08-27',
      aog_weeks: '15',
      bp: '110/70',
      weight: '53.0',
      temp: '36.6',
      fetal_heart_rate: '152 bpm',
      fundic_height: '15 cm',
      next_visit_date: '2026-03-06',
      next_visit_note: 'Routine 2nd Visit Maternal Check-up',
      prescribed_meds: 'Calcium Carbonate 500mg + FeSO4',
      attending_nurse: nurseName,
      visit_date: '2026-02-06',
      visit_number: 2,
      sms_sent: false
    },
    {
      id: 203,
      patient_name: 'Jessica Alcantara',
      contact_number: '09187654321',
      age: 31,
      barangay: nurseBarangay,
      gravida: 'G3',
      para: 'P2',
      lmp: '2025-08-01',
      edd: '2026-05-08',
      aog_weeks: '30',
      bp: '135/88',
      weight: '64.5',
      temp: '36.7',
      fetal_heart_rate: '140 bpm',
      fundic_height: '30 cm',
      next_visit_date: '2026-03-01', // Overdue
      next_visit_note: '3rd Trimester Gestational BP & Fundic Growth',
      prescribed_meds: 'Methyldopa 250mg BID, FeSO4',
      attending_nurse: nurseName,
      visit_date: '2026-02-15',
      visit_number: 3,
      sms_sent: false
    }
  ]);

  // Immunization Records State (with Dose 2 tracking)
  const [immunRecords, setImmunRecords] = useState<ImmunRecord[]>([
    {
      id: 301,
      child_name: 'Baby Liam Kenneth Diaz',
      contact_number: '09151234567',
      age_months: '4',
      gender: 'Male',
      guardian: 'Maria Diaz',
      barangay: nurseBarangay,
      weight: '6.9 kg',
      height: '63 cm',
      temp: '36.6 °C',
      vaccine_given: 'Pentavalent (DPT-HepB-Hib)',
      dose_number: 'Dose 2',
      batch_number: 'LOT-2026-P2',
      date_given: '2026-02-15',
      next_due_date: '2026-03-15',
      remarks: 'Tolerated Dose 2 well, mild local erythema subsided',
      attending_nurse: nurseName,
      sms_sent: false
    },
    {
      id: 302,
      child_name: 'Baby Sofia Grace Reyes',
      contact_number: '09281234567',
      age_months: '2',
      gender: 'Female',
      guardian: 'Lyn Reyes',
      barangay: nurseBarangay,
      weight: '4.8 kg',
      height: '56 cm',
      temp: '36.5 °C',
      vaccine_given: 'Oral Polio Vaccine (OPV)',
      dose_number: 'Dose 1',
      batch_number: 'LOT-2026-OPV1',
      date_given: '2026-02-10',
      next_due_date: '2026-03-10',
      remarks: 'Cleared for routine vaccination, no adverse reactions',
      attending_nurse: nurseName,
      sms_sent: false
    },
    {
      id: 303,
      child_name: 'Baby Ethan Joshua Ramos',
      contact_number: '09179876543',
      age_months: '4',
      gender: 'Male',
      guardian: 'Claire Ramos',
      barangay: nurseBarangay,
      weight: '7.1 kg',
      height: '64 cm',
      temp: '36.5 °C',
      vaccine_given: 'Pneumococcal Conjugate (PCV13)',
      dose_number: 'Dose 2',
      batch_number: 'LOT-2026-PCV2',
      date_given: '2026-01-28',
      next_due_date: '2026-02-28', // Overdue
      remarks: 'Dose 2 scheduled; mother notified of catch-up day',
      attending_nurse: nurseName,
      sms_sent: false
    }
  ]);

  // Inventory State
  const [inventory, setInventory] = useState<InventoryItem[]>([
    { id: 1, item_name: 'Pentavalent Vaccine (DPT-HepB-Hib)', category: 'Vaccine (EPI)', stock: 45, unit: 'vials', expiry_date: '2026-06-30', status: 'In Stock' },
    { id: 2, item_name: 'PCV 13 (Pneumococcal Conjugate)', category: 'Vaccine (EPI)', stock: 32, unit: 'vials', expiry_date: '2026-09-30', status: 'In Stock' },
    { id: 3, item_name: 'Measles-Rubella (MR) Vaccine', category: 'Vaccine (EPI)', stock: 8, unit: 'vials', expiry_date: '2026-03-15', status: 'Low Stock' },
    { id: 4, item_name: 'Ferrous Sulfate + Folic Acid', category: 'Maternal Vitamin', stock: 1200, unit: 'tablets', expiry_date: '2027-01-01', status: 'In Stock' },
    { id: 5, item_name: 'Calcium Carbonate 500mg', category: 'Maternal Vitamin', stock: 850, unit: 'tablets', expiry_date: '2026-12-31', status: 'In Stock' },
    { id: 6, item_name: 'Paracetamol 500mg Tablet', category: 'Essential Medicine', stock: 600, unit: 'tablets', expiry_date: '2027-06-30', status: 'In Stock' },
    { id: 7, item_name: 'Oral Rehydration Salts (ORS)', category: 'Pediatric Supply', stock: 0, unit: 'packets', expiry_date: '2026-08-01', status: 'Out of Stock' },
  ]);

  // Weekly Schedule State
  const [weeklySchedules, setWeeklySchedules] = useState<WeeklySchedule[]>([
    { id: 1, title: 'Prenatal & Maternal Care Clinic', service_type: 'Prenatal Care', day: 'Every Monday & Thursday', time_slot: '8:00 AM – 12:00 PM & 1:00 PM – 4:00 PM', location: `Barangay ${nurseBarangay} Health Center`, assigned_to: nurseName, posted_date: '2026-03-01' },
    { id: 2, title: 'EPI Child Immunization Day', service_type: 'Child Immunization', day: 'Every Wednesday', time_slot: '8:00 AM – 12:00 PM', location: `Barangay ${nurseBarangay} Health Center`, assigned_to: nurseName, posted_date: '2026-03-01' },
    { id: 3, title: 'Adolescent Health & General Consultation', service_type: 'General Consultation', day: 'Every Tuesday & Friday', time_slot: '8:00 AM – 12:00 PM & 1:00 PM – 4:00 PM', location: `Barangay ${nurseBarangay} Health Center`, assigned_to: nurseName, posted_date: '2026-03-01' },
  ]);

  // Encounters Archive Log
  const [archives, setArchives] = useState<EncounterArchive[]>([
    { id: 1, patient_name: 'Elena Ramos-Santos', contact_number: '09171234567', encounter_type: 'Prenatal Consultation', details: 'AOG 20 Wks. FeSO4 prescribed.', date: '2026-03-02', attending: nurseName },
    { id: 2, patient_name: 'Baby Liam Kenneth Diaz', contact_number: '09151234567', encounter_type: 'Immunization (Pentavalent-2)', details: 'Dose 2 administered successfully.', date: '2026-02-15', attending: nurseName },
  ]);

  // Modals state
  const [isNewConsultOpen, setIsNewConsultOpen] = useState(false);
  const [isNewPrenatalOpen, setIsNewPrenatalOpen] = useState(false);
  const [isNewImmunOpen, setIsNewImmunOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isEditInventoryOpen, setIsEditInventoryOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isEditScheduleOpen, setIsEditScheduleOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WeeklySchedule | null>(null);

  // ══ Consult Form State ══
  const [cName, setCName] = useState('');
  const [cNameSearchResults, setCNameSearchResults] = useState<any[]>([]);
  const [showCNameSuggestions, setShowCNameSuggestions] = useState(false);
  const [isCNameSearching, setIsCNameSearching] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [restockTargetItem, setRestockTargetItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState('20');
  const [cPhone, setCPhone] = useState('');
  const [cAge, setCAge] = useState('');
  const [cGender, setCGender] = useState<'Male'|'Female'>('Female');
  const [cProgram, setCProgram] = useState<'General Consultation' | 'Adolescent Health' | 'Family Planning' | 'Teenage Pregnancy Prevention' | 'NTP (TB-DOTS)'>('General Consultation');
  // Fixed Dual BP Inputs
  const [cBpSys, setCBpSys] = useState('120');
  const [cBpDia, setCBpDia] = useState('80');
  const [cTemp, setCTemp] = useState('36.5');
  const [cWeight, setCWeight] = useState('');
  const [cHR, setCHR] = useState('75');
  const [cComplaint, setCComplaint] = useState('');
  const [cDiagnosis, setCDiagnosis] = useState('');
  // Dynamic Prescription Builder
  const [cPrescriptions, setCPrescriptions] = useState<PrescribedMedItem[]>([]);
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('500mg');
  const [medFreq, setMedFreq] = useState('3x daily after meals');
  const [medDuration, setMedDuration] = useState('7 days');
  const [medInst, setMedInst] = useState('Take with plenty of water');
  // Specialized Program Fields
  const [cAdolescentStage, setCAdolescentStage] = useState('Mid Adolescent (15-17 yrs)');
  const [cAdolescentFocus, setCAdolescentFocus] = useState('Pubertal Guidance & Mental Wellness');
  const [cTeenSchool, setCTeenSchool] = useState('Enrolled in High School');
  const [cTeenRisk, setCTeenRisk] = useState('Low Risk / Preventive Counseling');
  const [cTeenGuardian, setCTeenGuardian] = useState('Accompanied by Guardian');
  const [cFpClientType, setCFpClientType] = useState('New Acceptor');
  const [cFpMethod, setCFpMethod] = useState('DMPA Injectable (Depo)');
  const [cFpLmp, setCFpLmp] = useState('');
  const [cFpNextSupply, setCFpNextSupply] = useState('');
  const [cFpNotes, setCFpNotes] = useState('');
  const [cTbRegNo, setCTbRegNo] = useState('');
  const [cTbCategory, setCTbCategory] = useState('New Pulmonary Case');
  const [cTbSputum, setCTbSputum] = useState('GeneXpert / AFB Pending');
  const [cTbPhase, setCTbPhase] = useState('Intensive Phase (2 Months RHZE)');
  const [cTbPartner, setCTbPartner] = useState('');

  // ══ Prenatal Form State ══
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pAge, setPAge] = useState('');
  const [pGravida, setPGravida] = useState('G1');
  const [pPara, setPPara] = useState('P0');
  const [pLmp, setPLmp] = useState('');
  const [pEdd, setPEdd] = useState('');
  const [pAog, setPAog] = useState('');
  const [pVisitNum, setPVisitNum] = useState('2'); // default 2nd visit
  // Fixed Dual BP Inputs
  const [pBpSys, setPBpSys] = useState('120');
  const [pBpDia, setPBpDia] = useState('80');
  const [pWeight, setPWeight] = useState('');
  const [pTemp, setPTemp] = useState('36.5');
  const [pFhr, setPFhr] = useState('');
  const [pFh, setPFh] = useState('');
  const [pNextDate, setPNextDate] = useState('');
  const [pNextNote, setPNextNote] = useState('');
  const [pMeds, setPMeds] = useState('FeSO4 + Folic Acid 400mcg daily');

  // ══ Immunization Form State ══
  const [iChild, setIChild] = useState('');
  const [iPhone, setIPhone] = useState('');
  const [iAge, setIAge] = useState('');
  const [iGender, setIGender] = useState('Male');
  const [iGuardian, setIGuardian] = useState('');
  const [iWeight, setIWeight] = useState('');
  const [iHeight, setIHeight] = useState('');
  const [iVaccine, setIVaccine] = useState('Pentavalent (DPT-HepB-Hib)');
  const [iCustomVaccine, setICustomVaccine] = useState('');
  const [iDose, setIDose] = useState('Dose 2'); // Highlighted 2nd dose
  const [iBatch, setIBatch] = useState('');
  const [iDateGiven, setIDateGiven] = useState(new Date().toISOString().split('T')[0]);
  const [iNextDue, setINextDue] = useState('');
  const [iRemarks, setIRemarks] = useState('Cleared for routine vaccination');

  // ══ Inventory & Schedule Form States ══
  const [invName, setInvName] = useState('');
  const [invCat, setInvCat] = useState('Vaccine (EPI)');
  const [invStock, setInvStock] = useState('');
  const [invUnit, setInvUnit] = useState('vials');
  const [invExpiry, setInvExpiry] = useState('');
  const [invFilter, setInvFilter] = useState<'all' | 'vaccine' | 'medicine'>('all');
  const [sTitle, setSTitle] = useState('');
  const [sService, setSService] = useState('Prenatal Care');
  const [sDay, setSDay] = useState('Every Monday');
  const [sTime, setSTime] = useState('8:00 AM – 12:00 PM & 1:00 PM – 4:00 PM');
  const [sLocation, setSLocation] = useState(`Barangay ${nurseBarangay} Health Center`);

  // Helper: Live BP category
  const getBpCategory = (sys: string, dia: string) => {
    const s = parseInt(sys, 10);
    const d = parseInt(dia, 10);
    if (isNaN(s) || isNaN(d)) return { label: 'Incomplete', color: 'bg-slate-100 text-slate-700' };
    if (s >= 180 || d >= 120) return { label: 'Crisis / Alert', color: 'bg-red-600 text-white animate-pulse' };
    if (s >= 140 || d >= 90) return { label: 'Stage 2 HTN', color: 'bg-red-100 text-red-800 font-bold' };
    if (s >= 130 || d >= 80) return { label: 'Stage 1 HTN', color: 'bg-amber-100 text-amber-800 font-semibold' };
    if (s >= 120 && d < 80) return { label: 'Elevated BP', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Normal BP', color: 'bg-emerald-100 text-emerald-800 font-semibold' };
  };

  // Add medicine to prescription
  const handleAddMedToRx = () => {
    if (!medName.trim()) {
      toast.error('Enter medication name');
      return;
    }
    const item: PrescribedMedItem = {
      id: String(Date.now()),
      name: medName.trim(),
      dosage: medDose.trim(),
      frequency: medFreq.trim(),
      duration: medDuration.trim(),
      instructions: medInst.trim()
    };
    setCPrescriptions(prev => [...prev, item]);
    setMedName('');
    toast.success(`Added ${item.name} to prescription`);
  };

  // Load API data dynamically from backend
  const loadData = async () => {
    setLoading(true);
    try {
      const [apts, schedules, notifs, liveCons, liveMat, liveImm, liveInv] = await Promise.all([
        apiService.getAppointments({ barangay: nurseBarangay }).catch(() => []),
        apiService.getClinicSchedules(nurseBarangay).catch(() => []),
        apiService.getNotifications().catch(() => []),
        apiService.getConsultations(nurseBarangay).catch(() => []),
        apiService.getMaternalRecords().catch(() => []),
        apiService.getImmunizations().catch(() => []),
        apiService.getInventory(nurseBarangay).catch(() => [])
      ]);
      setAppointments(apts);
      setNotifications(notifs);
      if (liveInv && Array.isArray(liveInv) && liveInv.length > 0) {
        setInventory(liveInv);
      }

      if (liveCons && liveCons.length > 0) {
        setConsultations(liveCons.map((c: any) => ({
          id: c.id,
          patient_name: c.patient_name,
          contact_number: c.contact_number || '',
          age: c.age || '—',
          gender: c.gender || 'Female',
          barangay: c.barangay || nurseBarangay,
          service_type: c.program_type || c.service_type || 'General Consultation',
          program_type: c.program_type || c.service_type || 'General Consultation',
          bp: c.bp || '120/80',
          temp: c.temp || '36.5',
          weight: c.weight ? `${c.weight} kg` : '—',
          heart_rate: c.heart_rate ? `${c.heart_rate} bpm` : '78 bpm',
          chief_complaint: c.chief_complaint || 'Routine Health Visit',
          diagnosis: c.diagnosis || 'Assessment Complete',
          treatment: c.treatment || 'Health counseling advised.',
          prescribed_meds: c.prescribed_meds || c.treatment || '',
          attending_nurse: c.attending_nurse || c.attending_worker || nurseName,
          consultation_date: c.consultation_date ? String(c.consultation_date).split('T')[0] : (c.encounter_date ? String(c.encounter_date).split('T')[0] : new Date().toISOString().split('T')[0]),
          status: c.status || 'Completed'
        })));
      }

      if (liveMat && liveMat.length > 0) {
        setPrenatalRecords(liveMat.map((m: any) => ({
          id: m.id,
          patient_name: m.mother_name || m.patient_name,
          contact_number: m.contact_number || m.mother_phone || '',
          age: m.age || '—',
          barangay: m.barangay || nurseBarangay,
          gravida: m.gravida || 'G1',
          para: m.para || 'P0',
          lmp: m.lmp ? String(m.lmp).split('T')[0] : (m.last_visit ? String(m.last_visit).split('T')[0] : '2026-01-10'),
          edd: m.expected_due_date ? String(m.expected_due_date).split('T')[0] : (m.edd ? String(m.edd).split('T')[0] : '2026-10-15'),
          aog_weeks: m.aog_weeks || '20',
          bp: m.bp || '120/80',
          weight: m.weight || '58',
          temp: m.temp || '36.5',
          fetal_heart_rate: m.fetal_heart_rate || '142',
          fundic_height: m.fundic_height || '21',
          next_visit_date: m.next_visit ? String(m.next_visit).split('T')[0] : (m.next_visit_date ? String(m.next_visit_date).split('T')[0] : ''),
          next_visit_note: m.notes || 'Routine follow-up',
          prescribed_meds: m.prescribed_meds || 'FeSO4 + Folic Acid',
          attending_nurse: m.attending_nurse || nurseName,
          visit_date: m.last_visit ? String(m.last_visit).split('T')[0] : new Date().toISOString().split('T')[0],
          visit_number: m.visit_number || (String(m.notes || '').includes('2nd') ? 2 : 1),
          sms_sent: Boolean(m.sms_sent)
        })));
      }

      if (liveImm && liveImm.length > 0) {
        setImmunRecords(liveImm.map((i: any) => ({
          id: i.id,
          child_name: i.child_name,
          contact_number: i.parent_phone || i.contact_number || '',
          age_months: i.age_months ? String(i.age_months) : '6',
          gender: (i.gender || i.sex || 'Male') as any,
          guardian: i.guardian_name || i.guardian || i.parent_name || 'Guardian',
          barangay: i.barangay || nurseBarangay,
          weight: i.weight_kg || i.weight || '7.5',
          height: i.height_cm || i.height || '65',
          temp: '36.5',
          vaccine_given: i.vaccine_name || i.vaccine_given || 'Pentavalent (DPT-HepB-Hib)',
          dose_number: String(i.dose_number).includes('Dose') ? i.dose_number : `Dose ${i.dose_number || 1}`,
          batch_number: i.batch_lot || i.batch_number || 'LOT-2026-X9',
          date_given: i.date_administered ? String(i.date_administered).split('T')[0] : (i.date_given || new Date().toISOString().split('T')[0]),
          next_due_date: i.due_date ? String(i.due_date).split('T')[0] : (i.next_due_date || ''),
          remarks: i.remarks || 'Cleared for routine vaccination',
          attending_nurse: i.administered_by || i.attending_nurse || nurseName,
          sms_sent: Boolean(i.sms_sent)
        })));
      }

      if (schedules && schedules.length > 0) {
        setWeeklySchedules(schedules.map((s: any) => ({
          id: s.id,
          title: s.title,
          service_type: s.service_type,
          day: s.day_of_week || s.day,
          time_slot: s.time_slot,
          location: s.location || `Barangay ${nurseBarangay} Health Center`,
          assigned_to: s.bhw_in_charge || s.assigned_to || nurseName,
          posted_date: s.posted_date || new Date().toISOString().split('T')[0]
        })));
      }
    } catch { toast.error('Failed to refresh records'); } finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, []);

  // Due alerts calculation
  const overduePrenatal = useMemo(() =>
    prenatalRecords.filter(r => r.next_visit_date && new Date(r.next_visit_date) <= new Date()), [prenatalRecords]);

  const overdueImmun = useMemo(() =>
    immunRecords.filter(r => r.next_due_date && new Date(r.next_due_date) <= new Date()), [immunRecords]);

  const upcomingPrenatal = useMemo(() =>
    prenatalRecords.filter(r => {
      if (!r.next_visit_date) return false;
      const diff = (new Date(r.next_visit_date).getTime() - Date.now()) / 86400000;
      return diff > 0 && diff <= 7;
    }), [prenatalRecords]);

  const upcomingImmun = useMemo(() =>
    immunRecords.filter(r => {
      if (!r.next_due_date) return false;
      const diff = (new Date(r.next_due_date).getTime() - Date.now()) / 86400000;
      return diff > 0 && diff <= 7;
    }), [immunRecords]);

  // Combined Due Patients List for Safe Batch SMS Modal
  const duePatientsList = useMemo<DuePatientItem[]>(() => {
    const list: DuePatientItem[] = [];
    overduePrenatal.forEach(p => {
      list.push({
        id: `mat-${p.id}`,
        name: p.patient_name,
        phone: p.contact_number,
        service: 'Prenatal Check-up',
        detail: `Visit #${p.visit_number} (${p.aog_weeks} wks)`,
        dueDate: p.next_visit_date,
        isOverdue: true,
        category: 'maternal'
      });
    });
    upcomingPrenatal.forEach(p => {
      if (!list.find(item => item.name === p.patient_name)) {
        list.push({
          id: `mat-up-${p.id}`,
          name: p.patient_name,
          phone: p.contact_number,
          service: 'Prenatal Check-up',
          detail: `Visit #${p.visit_number}`,
          dueDate: p.next_visit_date,
          isOverdue: false,
          category: 'maternal'
        });
      }
    });
    overdueImmun.forEach(i => {
      list.push({
        id: `imm-${i.id}`,
        name: i.child_name,
        phone: i.contact_number,
        service: 'Child Immunization',
        detail: `${i.vaccine_given} (${i.dose_number})`,
        dueDate: i.next_due_date,
        isOverdue: true,
        category: 'immunization'
      });
    });
    upcomingImmun.forEach(i => {
      if (!list.find(item => item.name === i.child_name)) {
        list.push({
          id: `imm-up-${i.id}`,
          name: i.child_name,
          phone: i.contact_number,
          service: 'Child Immunization',
          detail: `${i.vaccine_given} (${i.dose_number})`,
          dueDate: i.next_due_date,
          isOverdue: false,
          category: 'immunization'
        });
      }
    });
    return list;
  }, [overduePrenatal, upcomingPrenatal, overdueImmun, upcomingImmun]);

  // Open 360 Patient Profile Modal
  const openPatient360 = (name: string, phone: string, barangay?: string) => {
    const patientCons = consultations.filter(c => c.patient_name.toLowerCase() === name.toLowerCase()).map(c => ({
      id: c.id, date: c.consultation_date, service_type: c.service_type, vitals: `BP: ${c.bp}, Temp: ${c.temp}`,
      complaint: c.chief_complaint, diagnosis: c.diagnosis, treatment: c.treatment, attending: c.attending_nurse
    }));

    const patientPrenatal = prenatalRecords.filter(p => p.patient_name.toLowerCase() === name.toLowerCase()).map(p => ({
      id: p.id, date: p.visit_date, gravida: p.gravida, para: p.para, lmp: p.lmp, edd: p.edd, aog: p.aog_weeks,
      bp: p.bp, fhr: p.fetal_heart_rate, next_visit: p.next_visit_date, meds: p.prescribed_meds, attending: p.attending_nurse
    }));

    const patientImmun = immunRecords.filter(i => i.child_name.toLowerCase() === name.toLowerCase()).map(i => ({
      id: i.id, vaccine: i.vaccine_given, dose: i.dose_number, date_given: i.date_given, next_due: i.next_due_date,
      batch_number: i.batch_number, attending: i.attending_nurse
    }));

    setSelectedPatientModal({
      id: Date.now(),
      name,
      contact_number: phone,
      barangay: barangay || nurseBarangay,
      consultations: patientCons,
      prenatal: patientPrenatal,
      immunizations: patientImmun
    });
    setIsPatientModalOpen(true);
  };

  const handleLogReturnVisitFromModal = (pData: PatientRecordData) => {
    setCName(pData.name);
    setCPhone(pData.contact_number || '');
    setCAge(pData.age ? String(pData.age) : '');
    setCGender((pData.gender as any) || 'Female');
    setCProgram('General Consultation');
    setCBpSys('120');
    setCBpDia('80');
    setCTemp(pData.temp || '36.5');
    setCWeight(pData.weight ? String(pData.weight) : '');
    setCHR('78');
    setCComplaint('Follow-up Checkup / Return Visit');
    setCDiagnosis('');
    setCPrescriptions([]);
    setIsPatientModalOpen(false);
    setIsNewConsultOpen(true);
    toast.info(`Pre-filled return visit consultation for ${pData.name}`);
  };

  // ══ Submit Handlers with Immediate Optimistic Updates ══

  const handleCreateConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) { toast.error('Patient name is required'); return; }

    const cleanSys = cBpSys.replace(/\D/g, '') || '120';
    const cleanDia = cBpDia.replace(/\D/g, '') || '80';
    const bpString = `${cleanSys}/${cleanDia} mmHg`;

    const formattedRx = cPrescriptions.length > 0
      ? cPrescriptions.map(m => `${m.name} ${m.dosage} (${m.frequency}, ${m.duration}) - ${m.instructions}`).join('; ')
      : 'Health counseling advised.';

    let finalComplaint = cComplaint;
    let finalDiagnosis = cDiagnosis;
    let finalTreatment = formattedRx;

    if (cProgram === 'Adolescent Health') {
      finalComplaint = cComplaint || `Adolescent Health Consultation (${cAdolescentStage}, ${cTeenSchool})`;
      finalDiagnosis = cDiagnosis || `Youth Assessment: ${cAdolescentFocus}`;
      finalTreatment = formattedRx !== 'Health counseling advised.' ? formattedRx : `Adolescent counseling provided on ${cAdolescentFocus}.`;
    } else if (cProgram === 'Teenage Pregnancy Prevention') {
      finalComplaint = cComplaint || `Teenage Pregnancy Prevention Counseling (${cTeenSchool})`;
      finalDiagnosis = cDiagnosis || `Risk Assessment: ${cTeenRisk}. Guardian Status: ${cTeenGuardian}`;
      finalTreatment = formattedRx !== 'Health counseling advised.' ? formattedRx : 'Adolescent reproductive health counseling, dual protection education, and youth center support.';
    } else if (cProgram === 'NTP (TB-DOTS)') {
      finalComplaint = cComplaint || `TB-DOTS Encounter (Reg #${cTbRegNo || 'Pending'}) - ${cTbCategory}`;
      finalDiagnosis = cDiagnosis || `Sputum Status: ${cTbSputum} | DOT Partner: ${cTbPartner || 'Assigned BHW'}`;
      finalTreatment = formattedRx !== 'Health counseling advised.' ? formattedRx : `Treatment Regimen: ${cTbPhase}`;
    } else if (cProgram === 'Family Planning') {
      finalComplaint = cComplaint || `Family Planning Consultation (${cFpClientType})${cFpLmp ? ' - LMP: ' + cFpLmp : ''}`;
      finalDiagnosis = cDiagnosis || `Method Selected: ${cFpMethod} (${cFpClientType})`;
      finalTreatment = formattedRx !== 'Health counseling advised.' ? formattedRx : `Supplied: ${cFpMethod}. Next Supply/Injection: ${cFpNextSupply || 'Scheduled'}. ${cFpNotes ? 'Notes: ' + cFpNotes : ''}`;
    }

    const optimisticConsult: ClinicalConsultation = {
      id: Date.now(),
      patient_name: cName.trim(),
      contact_number: cPhone.trim(),
      age: cAge || '—',
      gender: cGender,
      barangay: nurseBarangay,
      service_type: cProgram,
      program_type: cProgram,
      bp: bpString,
      temp: `${cTemp} °C`,
      weight: cWeight ? `${cWeight} kg` : '—',
      heart_rate: cHR ? `${cHR} bpm` : '78 bpm',
      chief_complaint: finalComplaint || 'Routine Health Visit',
      diagnosis: finalDiagnosis || 'Assessment Complete',
      treatment: finalTreatment,
      prescribed_meds: formattedRx,
      attending_nurse: nurseName,
      consultation_date: new Date().toISOString().split('T')[0],
      status: 'Completed'
    };

    // Immediate UI update
    setConsultations(prev => [optimisticConsult, ...prev]);

    try {
      await apiService.createConsultation({
        patient_name: cName.trim(),
        contact_number: cPhone.trim(),
        age: cAge || '—',
        gender: cGender,
        barangay: nurseBarangay,
        service_type: cProgram,
        program_type: cProgram,
        bp: bpString,
        temp: `${cTemp} °C`,
        weight: cWeight ? `${cWeight} kg` : 'N/A',
        heart_rate: cHR ? `${cHR} bpm` : '78 bpm',
        chief_complaint: finalComplaint || 'Routine Health Visit',
        diagnosis: finalDiagnosis || 'Assessment Complete',
        treatment: finalTreatment,
        prescribed_meds: formattedRx,
        prescriptions: cPrescriptions,
        attending_nurse: nurseName,
        consultation_date: new Date().toISOString().split('T')[0],
        status: 'Completed'
      } as any);

      // Locally decrement stock for each prescribed item
      if (cPrescriptions.length > 0) {
        setInventory(prev => prev.map(invItem => {
          const match = cPrescriptions.find(p => p.name.toLowerCase().includes(invItem.item_name.toLowerCase()) || invItem.item_name.toLowerCase().includes(p.name.toLowerCase()));
          if (match) {
            const newStock = Math.max(0, invItem.stock - 1);
            return {
              ...invItem,
              stock: newStock,
              status: newStock === 0 ? 'Out of Stock' : newStock < 10 ? 'Low Stock' : 'In Stock'
            };
          }
          return invItem;
        }));
      }

      toast.success('Consultation recorded & medicine deducted from stock!');
      setIsNewConsultOpen(false);
      setCName(''); setCPhone(''); setCAge(''); setCComplaint(''); setCDiagnosis(''); setCPrescriptions([]);

      if (apptToCompleteId) {
        try {
          await apiService.updateAppointment(apptToCompleteId, {
            status: 'Completed',
            bhw_notes: `Consultation completed by ${nurseName}. Assessment: ${finalDiagnosis || 'Assessment Complete'}. Treatment: ${finalTreatment}`,
            user_name: nurseName,
            user_role: 'nurse'
          });
          setAppointments(prev => prev.map(a => a.id === apptToCompleteId ? {
            ...a,
            status: 'Completed',
            bhw_notes: `Consultation completed by ${nurseName}. Assessment: ${finalDiagnosis || 'Assessment Complete'}. Treatment: ${finalTreatment}`
          } : a));
        } catch (e) {
          console.warn('Auto-completing appointment failed:', e);
        }
        setApptToCompleteId(null);
      }

      loadData();
    } catch {
      toast.error('Could not save to remote server (cached locally)');
    }
  };

  const handleCreatePrenatal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) { toast.error('Patient name is required'); return; }
    if (!pPhone.trim()) { toast.error('Contact number is required for SMS reminders'); return; }
    if (!pLmp) { toast.error('Last Menstrual Period (LMP) is required'); return; }
    if (!pNextDate) { toast.error('Next visit date is required'); return; }

    const cleanSys = pBpSys.replace(/\D/g, '') || '120';
    const cleanDia = pBpDia.replace(/\D/g, '') || '80';
    const bpString = `${cleanSys}/${cleanDia}`;

    const optimisticRecord: PrenatalRecord = {
      id: Date.now(),
      patient_name: pName.trim(),
      contact_number: pPhone.trim(),
      age: pAge ? Number(pAge) || 25 : 25,
      barangay: nurseBarangay,
      gravida: pGravida,
      para: pPara,
      lmp: pLmp,
      edd: pEdd,
      aog_weeks: pAog || '18',
      bp: bpString,
      weight: pWeight || '56.0',
      temp: pTemp || '36.5',
      fetal_heart_rate: pFhr ? `${pFhr} bpm` : '144 bpm',
      fundic_height: pFh ? `${pFh} cm` : '18 cm',
      next_visit_date: pNextDate,
      next_visit_note: pNextNote || `Visit #${pVisitNum} Follow-up`,
      prescribed_meds: pMeds,
      attending_nurse: nurseName,
      visit_date: new Date().toISOString().split('T')[0],
      visit_number: Number(pVisitNum) || 2,
      sms_sent: false
    };

    // Immediate UI update
    setPrenatalRecords(prev => [optimisticRecord, ...prev]);

    try {
      await apiService.createMaternalRecord({
        mother_name: pName.trim(),
        contact_number: pPhone.trim(),
        age: pAge ? Number(pAge) || 25 : 25,
        barangay: nurseBarangay,
        gravida: pGravida,
        para: pPara,
        lmp: pLmp,
        edd: pEdd,
        aog_weeks: pAog,
        bp: bpString,
        weight: pWeight,
        temp: pTemp,
        fetal_heart_rate: pFhr,
        fundic_height: pFh,
        next_visit: pNextDate,
        next_visit_date: pNextDate,
        notes: `Visit #${pVisitNum}. ${pNextNote || ''}`,
        prescribed_meds: pMeds,
        attending_nurse: nurseName
      });

      toast.success(`Prenatal record for ${pName} saved & archived!`);
      setIsNewPrenatalOpen(false);
      setPName(''); setPPhone(''); setPAge(''); setPLmp(''); setPEdd(''); setPAog('');
      setPBpSys('120'); setPBpDia('80'); setPWeight(''); setPFhr(''); setPFh('');
      setPNextDate(''); setPNextNote('');
      loadData();
    } catch {
      toast.error('Saved to local view (server offline)');
    }
  };

  const handleCreateImmun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iChild.trim()) { toast.error("Child's full name is required"); return; }
    if (!iPhone.trim()) { toast.error('Guardian contact number is required'); return; }
    if (!iGuardian.trim()) { toast.error('Guardian name is required'); return; }

    const activeVaccine = iCustomVaccine.trim() || iVaccine;

    const optimisticRecord: ImmunRecord = {
      id: Date.now(),
      child_name: iChild.trim(),
      contact_number: iPhone.trim(),
      age_months: iAge || '6',
      gender: iGender,
      guardian: iGuardian.trim(),
      barangay: nurseBarangay,
      weight: iWeight ? `${iWeight} kg` : '7.5 kg',
      height: iHeight ? `${iHeight} cm` : '65 cm',
      temp: '36.5',
      vaccine_given: activeVaccine,
      dose_number: iDose,
      batch_number: iBatch || `LOT-${new Date().getFullYear()}-EPI`,
      date_given: iDateGiven,
      next_due_date: iNextDue,
      remarks: iRemarks || 'Cleared for routine vaccination',
      attending_nurse: nurseName,
      sms_sent: false
    };

    // Immediate UI update
    setImmunRecords(prev => [optimisticRecord, ...prev]);

    try {
      await apiService.createImmunization({
        child_name: iChild.trim(),
        parent_phone: iPhone.trim(),
        contact_number: iPhone.trim(),
        age_months: iAge || '6',
        gender: iGender,
        guardian_name: iGuardian.trim(),
        barangay: nurseBarangay,
        weight_kg: iWeight || '7.5',
        height_cm: iHeight || '65',
        vaccine_name: activeVaccine,
        dose_number: iDose,
        batch_lot: iBatch || `LOT-${new Date().getFullYear()}-EPI`,
        date_administered: iDateGiven,
        date_given: iDateGiven,
        due_date: iNextDue || iDateGiven,
        next_due_date: iNextDue,
        remarks: iRemarks || 'Cleared for routine vaccination',
        administered_by: nurseName,
        status: iDateGiven ? 'Completed' : 'Scheduled'
      });

      // Deduct vaccine from local inventory stock
      setInventory(prev => prev.map(item => {
        if (item.item_name.toLowerCase().includes(activeVaccine.toLowerCase()) || activeVaccine.toLowerCase().includes(item.item_name.toLowerCase())) {
          const updatedStock = Math.max(0, item.stock - 1);
          return {
            ...item,
            stock: updatedStock,
            status: updatedStock === 0 ? 'Out of Stock' : updatedStock < 10 ? 'Low Stock' : 'In Stock'
          };
        }
        return item;
      }));

      toast.success(`Immunization for ${iChild} recorded & archived! Vaccine stock updated.`);
      setIsNewImmunOpen(false);
      setIChild(''); setIPhone(''); setIAge(''); setIGuardian('');
      setICustomVaccine(''); setINextDue('');
      loadData();
    } catch {
      toast.error('Saved to local view (server offline)');
    }
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName.trim()) { toast.error('Item name is required'); return; }
    const qty = parseInt(invStock) || 0;
    const payload: Partial<InventoryItem> = {
      barangay: nurseBarangay,
      item_name: invName.trim(),
      category: invCat,
      stock: qty,
      unit: invUnit,
      expiry_date: invExpiry,
      status: qty === 0 ? 'Out of Stock' : qty < 10 ? 'Low Stock' : 'In Stock'
    };
    try {
      const saved = await apiService.addInventoryItem(payload);
      setInventory(prev => [saved, ...prev.filter(i => i.id !== saved.id)]);
      toast.success(`${invName} saved to inventory!`);
    } catch {
      setInventory(prev => [{ id: Date.now(), ...payload } as any, ...prev]);
      toast.success(`${invName} added to local inventory`);
    }
    setIsInventoryOpen(false);
    setInvName(''); setInvCat('Vaccine (EPI)'); setInvStock(''); setInvUnit('vials'); setInvExpiry('');
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTargetItem) return;
    const addAmount = parseInt(restockQty) || 0;
    if (addAmount <= 0) {
      toast.error('Please enter a valid stock quantity to add');
      return;
    }
    const newStock = restockTargetItem.stock + addAmount;
    const newStatus = newStock === 0 ? 'Out of Stock' : newStock < 10 ? 'Low Stock' : 'In Stock';
    try {
      await apiService.updateInventoryItem(restockTargetItem.id, {
        stock: newStock,
        status: newStatus
      });
      setInventory(prev => prev.map(i => i.id === restockTargetItem.id ? { ...i, stock: newStock, status: newStatus } : i));
      toast.success(`Successfully added +${addAmount} ${restockTargetItem.unit} to ${restockTargetItem.item_name}!`);
    } catch {
      setInventory(prev => prev.map(i => i.id === restockTargetItem.id ? { ...i, stock: newStock, status: newStatus } : i));
      toast.info(`Stock updated (+${addAmount})`);
    }
    setIsRestockOpen(false);
    setRestockTargetItem(null);
  };

  const handleUpdateInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const qty = editingItem.stock;
    const status = qty === 0 ? 'Out of Stock' : qty < 10 ? 'Low Stock' : 'In Stock';
    try {
      await apiService.updateInventoryItem(editingItem.id, { ...editingItem, status });
    } catch {}
    setInventory(prev => prev.map(i => i.id === editingItem.id ? {
      ...editingItem,
      status
    } : i));
    toast.success('Inventory item updated!');
    setIsEditInventoryOpen(false); setEditingItem(null);
  };

  const handleDeleteInventory = async (id: number | string) => {
    try {
      await apiService.deleteInventoryItem(id);
    } catch {}
    setInventory(prev => prev.filter(i => i.id !== id));
    toast.success('Inventory item removed');
  };

  const handlePostSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sTitle.trim()) { toast.error('Title is required'); return; }
    const newSch: WeeklySchedule = {
      id: Date.now(), title: sTitle.trim(), service_type: sService,
      day: sDay, time_slot: sTime, location: sLocation, assigned_to: nurseName,
      posted_date: new Date().toISOString().split('T')[0]
    };
    setWeeklySchedules(prev => [newSch, ...prev]);
    try {
      const created = await apiService.createClinicSchedule({
        title: sTitle.trim(),
        service_type: sService,
        day_of_week: sDay,
        time_slot: sTime,
        location: sLocation,
        bhw_in_charge: nurseName,
        barangay: nurseBarangay,
        created_by: nurseName
      });
      if (created && created.id) {
        setWeeklySchedules(prev => prev.map(s => s.id === newSch.id ? { ...s, id: created.id } : s));
      }
    } catch {}
    toast.success('Weekly clinic schedule posted!');
    setIsScheduleOpen(false);
    setSTitle('');
  };

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;
    setWeeklySchedules(prev => prev.map(s => s.id === editingSchedule.id ? editingSchedule : s));
    try {
      if (typeof editingSchedule.id === 'number') {
        await apiService.updateClinicSchedule(editingSchedule.id, {
          title: editingSchedule.title,
          service_type: editingSchedule.service_type,
          day_of_week: editingSchedule.day,
          time_slot: editingSchedule.time_slot,
          location: editingSchedule.location,
          bhw_in_charge: editingSchedule.assigned_to,
          barangay: nurseBarangay
        });
      }
    } catch {}
    toast.success('Schedule updated!');
    setIsEditScheduleOpen(false); setEditingSchedule(null);
  };

  const handleDeleteSchedule = async (id: number | string) => {
    setWeeklySchedules(prev => prev.filter(s => s.id !== id));
    try {
      if (typeof id === 'number') {
        await apiService.deleteClinicSchedule(id);
      }
    } catch {}
    toast.success('Schedule removed');
  };

  const handleSendCustomSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeRecipient || !composePhone || !composeMessage) {
      toast.error('Recipient name, phone, and message are required');
      return;
    }
    try {
      await apiService.sendNotification({
        recipient_name: composeRecipient,
        recipient_phone: composePhone,
        type: composeType,
        message: composeMessage,
        status: 'Sent'
      });
      toast.success(`SMS alert dispatched to ${composeRecipient}!`);
      setIsSendSmsModalOpen(false);
      setComposeRecipient(''); setComposePhone(''); setComposeMessage('');
      loadData();
    } catch {
      toast.error('Failed to dispatch SMS');
    }
  };

  // ═══ Appointment Handlers ══════════════════════════════════════════════
  const handleOpenApptModal = (apt: HealthAppointment) => {
    setSelectedAppt(apt);
    const rawDate = apt.scheduled_date || apt.preferred_date || new Date().toISOString().slice(0, 10);
    setSchedDate(typeof rawDate === 'string' ? rawDate.split('T')[0] : new Date(rawDate).toISOString().slice(0, 10));
    setSchedTime(apt.scheduled_time || '09:00 AM');
    setSchedNotes(apt.bhw_notes || `Confirmed slot for ${apt.service_type}. Please bring a valid ID and yellow card.`);
    setIsApptModalOpen(true);
  };

  const handleConfirmAppt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppt) return;
    setIsSchedulingLoading(true);
    try {
      await apiService.updateAppointment(selectedAppt.id, {
        status: 'Approved',
        scheduled_date: schedDate,
        scheduled_time: schedTime,
        bhw_notes: schedNotes,
        attending_bhw: `${nurseName} (RN)`,
        user_name: nurseName,
        user_role: 'nurse'
      });
      toast.success('Appointment Confirmed & Scheduled!', {
        description: `Auto-notification sent to ${selectedAppt.resident_name} for ${schedDate} at ${schedTime}.`
      });
      setIsApptModalOpen(false);
      setSelectedAppt(null);
      loadData();
    } catch {
      toast.error('Failed to update appointment schedule');
    } finally {
      setIsSchedulingLoading(false);
    }
  };

  const handleUpdateApptStatus = async (id: number, newStatus: 'Completed' | 'Cancelled') => {
    try {
      await apiService.updateAppointment(id, {
        status: newStatus,
        attending_bhw: `${nurseName} (RN)`,
        user_name: nurseName,
        user_role: 'nurse'
      });
      toast.success(`Appointment marked as ${newStatus}`);
      loadData();
    } catch {
      toast.error(`Failed to update appointment status to ${newStatus}`);
    }
  };

  const handleStartConsultationFromAppt = async (apt: HealthAppointment) => {
    setApptToCompleteId(apt.id);
    setCName(apt.resident_name);
    setCPhone(apt.resident_phone || '');
    setCComplaint(`Booked Appointment (${apt.service_type})${apt.resident_notes ? `: ${apt.resident_notes}` : ''}`);
    setCBpSys('120');
    setCBpDia('80');
    setCTemp('36.5');
    setCHR('75');

    // Auto-fill Age & Gender from patient / resident registry
    try {
      const res = await apiService.searchPatients(apt.resident_name);
      const match = res?.patients?.find((p: any) => 
        p.name.toLowerCase().includes(apt.resident_name.toLowerCase()) || 
        apt.resident_name.toLowerCase().includes(p.name.toLowerCase())
      ) || res?.patients?.[0];

      if (match) {
        if (match.phone && !apt.resident_phone) setCPhone(match.phone);
        if (match.gender) setCGender(match.gender === 'Male' ? 'Male' : 'Female');
        if (match.age !== undefined && match.age !== null && match.age !== '') {
          setCAge(String(match.age));
        } else if (match.date_of_birth) {
          const calculatedAge = Math.floor((Date.now() - new Date(match.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          setCAge(String(calculatedAge));
        }
      }
    } catch {}

    // Map service_type to appropriate Consultation Program
    const s = (apt.service_type || '').toLowerCase();
    if (s.includes('adolescent')) {
      setCProgram('Adolescent Health');
    } else if (s.includes('family') || s.includes('planning')) {
      setCProgram('Family Planning');
    } else if (s.includes('tb') || s.includes('dots')) {
      setCProgram('NTP (TB-DOTS)');
    } else if (s.includes('teen') || s.includes('pregnancy')) {
      setCProgram('Teenage Pregnancy Prevention');
    } else {
      setCProgram('General Consultation');
    }

    setIsNewConsultOpen(true);
  };

  const menuItems = [
    { id: 'overview', label: 'Clinical Overview', icon: Activity },
    { id: 'consultations', label: 'Patient Consultations', icon: Stethoscope },
    { id: 'maternal', label: 'Prenatal & Maternal', icon: Heart },
    { id: 'immunizations', label: 'EPI Immunizations', icon: Baby },
    { id: 'schedule', label: 'Weekly Schedule', icon: CalendarCheck },
    { id: 'appointments', label: 'Resident Appointments', icon: CalendarCheck, badge: appointments.filter(a => a.status === 'Pending').length || undefined, badgeColor: 'bg-violet-600 text-white' },
    { id: 'inventory', label: 'Vaccines & Medicine Supply', icon: Pill },
    { id: 'archives', label: 'Clinical Archives & EHR', icon: Archive },
    { id: 'sms', label: 'Gmail Notification Hub', icon: Bell },
    { id: 'profile', label: 'Profile Settings', icon: UserCircle },
  ];

  // Filtered lists
  const filteredConsultations = useMemo(() => {
    return consultations.filter(c => {
      const matchSearch = !search || c.patient_name.toLowerCase().includes(search.toLowerCase()) || c.contact_number.includes(search);
      const matchProg = consFilterProgram === 'All' || (c.program_type || c.service_type || '').toLowerCase().includes(consFilterProgram.toLowerCase());
      return matchSearch && matchProg;
    });
  }, [consultations, search, consFilterProgram]);

  const filteredMaternal = useMemo(() => {
    return prenatalRecords.filter(r => {
      const matchSearch = !search || r.patient_name.toLowerCase().includes(search.toLowerCase()) || r.contact_number.includes(search);
      if (!matchSearch) return false;
      if (maternalFilterVisit === '1st') return r.visit_number === 1;
      if (maternalFilterVisit === '2nd') return r.visit_number === 2;
      if (maternalFilterVisit === '3rd') return r.visit_number >= 3;
      if (maternalFilterVisit === 'due') {
        const isOverdue = r.next_visit_date && new Date(r.next_visit_date) <= new Date();
        const isDueSoon = r.next_visit_date && (new Date(r.next_visit_date).getTime() - Date.now()) / 86400000 <= 7;
        return isOverdue || isDueSoon;
      }
      return true;
    });
  }, [prenatalRecords, search, maternalFilterVisit]);

  const filteredImmun = useMemo(() => {
    return immunRecords.filter(r => {
      const matchSearch = !search || r.child_name.toLowerCase().includes(search.toLowerCase()) || r.contact_number.includes(search);
      if (!matchSearch) return false;
      if (immunFilterDose === 'dose1') return r.dose_number.includes('1');
      if (immunFilterDose === 'dose2') return r.dose_number.includes('2');
      if (immunFilterDose === 'dose3') return r.dose_number.includes('3') || r.dose_number.toLowerCase().includes('booster');
      if (immunFilterDose === 'due') {
        const isOverdue = r.next_due_date && new Date(r.next_due_date) <= new Date();
        const isDueSoon = r.next_due_date && (new Date(r.next_due_date).getTime() - Date.now()) / 86400000 <= 7;
        return isOverdue || isDueSoon;
      }
      return true;
    });
  }, [immunRecords, search, immunFilterDose]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      const q = apptSearch.toLowerCase().trim();
      const matchSearch = !q ||
        (a.resident_name || '').toLowerCase().includes(q) ||
        (a.appointment_code || '').toLowerCase().includes(q) ||
        (a.service_type || '').toLowerCase().includes(q) ||
        (a.resident_phone || '').includes(q);
      const matchStatus = apptStatusFilter === 'all' || a.status === apptStatusFilter;
      const matchService = apptServiceFilter === 'all' || (a.service_type || '').toLowerCase().includes(apptServiceFilter.toLowerCase());
      return matchSearch && matchStatus && matchService;
    });
  }, [appointments, apptSearch, apptStatusFilter, apptServiceFilter]);

  const cBpStatus = getBpCategory(cBpSys, cBpDia);
  const pBpStatus = getBpCategory(pBpSys, pBpDia);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col font-sans">
      {/* Top Header Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-3 sm:px-6 py-2.5 shadow-xs">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl cursor-pointer lg:hidden focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
              aria-label="Open mobile navigation menu"
            >
              <Menu size={22} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-white shadow-xs border border-teal-200 flex items-center justify-center shrink-0">
                <img src="/assets/pianing-logo.png" alt="Barangay Pianing" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-slate-900">Barangay {nurseBarangay} Health Center</h1>
                  <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-bold px-1.5">Nurse Portal</Badge>
                </div>
                <span className="text-xs text-slate-500 font-medium hidden sm:block">Primary Healthcare Clinical EHR &amp; Due Scheduler</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Nurse Station Active
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col py-4 border-r border-slate-200 lg:hidden transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-white shadow-xs border border-teal-200 flex items-center justify-center shrink-0">
              <img src="/assets/pianing-logo.png" alt="Barangay Pianing" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Health Center</span>
              <span className="text-[10px] text-teal-700 font-semibold">Nurse Clinical Portal</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {menuItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (item.action) {
                    item.action();
                  } else {
                    setActiveTab(item.id as any);
                  }
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-50 text-teal-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={17} className={`shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {(item as any).badge !== undefined && (
                  <span className={`${(item as any).badgeColor || 'bg-violet-600 text-white'} text-[10px] font-extrabold px-1.5 py-0.2 rounded-full`}>
                    {(item as any).badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-3 px-3 border-t border-slate-200">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              localStorage.removeItem('barangay_user');
              navigate('/login');
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
          >
            <LogOut size={18} className="shrink-0 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Layout Container */}
      <div className="flex-1 flex w-full">
        {/* Permanent Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col py-4 sticky top-[57px] h-[calc(100vh-57px)]">
          <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
            {menuItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.action) {
                      item.action();
                    } else {
                      setActiveTab(item.id as any);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200/80 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={17} className={`shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.id === 'maternal' && overduePrenatal.length > 0 && (
                    <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                      {overduePrenatal.length}
                    </span>
                  )}
                  {item.id === 'immunizations' && overdueImmun.length > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                      {overdueImmun.length}
                    </span>
                  )}
                  {(item as any).badge !== undefined && (
                    <span className={`${(item as any).badgeColor || 'bg-violet-600 text-white'} text-[10px] font-extrabold px-1.5 py-0.2 rounded-full`}>
                      {(item as any).badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-3 px-3 border-t border-slate-200">
            <button
              onClick={() => { localStorage.removeItem('barangay_user'); navigate('/login'); }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer group"
            >
              <LogOut size={18} className="shrink-0 text-rose-500 group-hover:text-rose-700" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content View */}
        <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">

          {/* ═══ OVERVIEW ═══════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Executive Overview Header Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
                        Primary Care Operations
                      </Badge>
                      <span className="text-xs text-slate-500 font-medium">Barangay {nurseBarangay} Health Center</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                      <Stethoscope className="text-teal-600" size={20} />
                      Clinical Health Command &amp; Registry
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl">
                      Real-time maternal tracking, EPI immunization registry, specialized youth &amp; TB programs, and safe automated SMS reminders.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      onClick={() => setIsBatchSmsOpen(true)}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer rounded-xl h-9 px-3.5 transition-all"
                    >
                      <Send size={13} className="text-amber-700" />
                      <span>Review &amp; Send Due SMS ({duePatientsList.length})</span>
                    </Button>
                    <Button
                      onClick={() => setIsNewConsultOpen(true)}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer rounded-xl h-9 px-3.5"
                    >
                      <PlusCircle size={14} /> + New Consultation
                    </Button>
                  </div>
                </div>

                {/* Overdue Urgent Alert Ribbon inside Banner */}
                {duePatientsList.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-700 bg-amber-50/70 p-3 rounded-xl border border-amber-200/80">
                    <span className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                      <span><strong>{overduePrenatal.length} Maternal</strong> and <strong>{overdueImmun.length} Child Immunization</strong> records are currently overdue.</span>
                    </span>
                    <button
                      onClick={() => setIsBatchSmsOpen(true)}
                      className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer text-xs shrink-0"
                    >
                      Open Safe Batch Dispatcher &rarr;
                    </button>
                  </div>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Consultations Recorded', value: consultations.length, icon: Stethoscope, color: 'teal', action: () => setActiveTab('consultations') },
                  { label: 'Maternal Patients', value: prenatalRecords.length, icon: Heart, color: 'pink', action: () => setActiveTab('maternal') },
                  { label: 'Child Immunizations', value: immunRecords.length, icon: Syringe, color: 'blue', action: () => setActiveTab('immunizations') },
                  { label: 'Overdue / Due Soon', value: duePatientsList.length, icon: Clock, color: 'amber', action: () => setIsBatchSmsOpen(true) },
                ].map((s, i) => (
                  <Card key={i} className="bg-white border border-slate-200 rounded-2xl shadow-xs cursor-pointer hover:shadow-md transition-shadow" onClick={s.action}>
                    <CardContent className="p-4 flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{s.label}</p>
                        <h3 className="text-2xl font-black mt-1 text-slate-900">{s.value}</h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                        <s.icon size={20} className={s.color === 'teal' ? 'text-teal-600' : s.color === 'pink' ? 'text-pink-600' : s.color === 'blue' ? 'text-blue-600' : 'text-amber-600'} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Quick Actions Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => setIsIntakeOpen(true)}
                  className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-2xl hover:shadow-md hover:border-teal-300 transition-all cursor-pointer text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">+ Add Patient</span>
                    <span className="text-[10px] text-slate-400">Intake &amp; Register</span>
                  </div>
                </button>

                <button
                  onClick={() => { setActiveTab('maternal'); setIsNewPrenatalOpen(true); }}
                  className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-2xl hover:shadow-md hover:border-pink-300 transition-all cursor-pointer text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center shrink-0">
                    <Heart size={18} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Prenatal Record</span>
                    <span className="text-[10px] text-slate-400">Log 2nd/3rd Visit</span>
                  </div>
                </button>

                <button
                  onClick={() => { setActiveTab('immunizations'); setIsNewImmunOpen(true); }}
                  className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-2xl hover:shadow-md hover:border-blue-300 transition-all cursor-pointer text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Baby size={18} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Child Vaccine</span>
                    <span className="text-[10px] text-slate-400">Record Dose 1/2/3</span>
                  </div>
                </button>

                <button
                  onClick={() => setIsBatchSmsOpen(true)}
                  className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-2xl hover:shadow-md hover:border-amber-300 transition-all cursor-pointer text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Send size={18} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Batch Due SMS</span>
                    <span className="text-[10px] text-slate-400">Preview &amp; Send</span>
                  </div>
                </button>
              </div>

              {/* Due Patients Section */}
              {duePatientsList.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Clock className="text-amber-600" size={16} /> Patients Scheduled / Due This Week
                      </h3>
                      <p className="text-xs text-slate-500">Mothers and infant guardians requiring follow-up clinical visits.</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setIsBatchSmsOpen(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 rounded-xl cursor-pointer"
                    >
                      <Send size={12} /> Dispatch Batch SMS Reminders
                    </Button>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {duePatientsList.slice(0, 5).map((p, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.category === 'maternal' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                            {p.category === 'maternal' ? <Heart size={14} /> : <Baby size={14} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{p.name}</span>
                              <Badge variant="outline" className={`text-[9px] py-0 px-1 border-0 ${p.detail.includes('2nd') ? 'bg-purple-100 text-purple-800 font-bold' : 'bg-slate-100 text-slate-700'}`}>
                                {p.detail}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500">Phone: {p.phone || 'No phone'} · Due: {p.dueDate}</p>
                          </div>
                        </div>
                        <Badge className={`text-[10px] border-0 ${p.isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {p.isOverdue ? 'Overdue' : 'Due Soon'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ CONSULTATIONS TAB ══════════════════════════════════════════ */}
          {activeTab === 'consultations' && (
            <div className="space-y-4">
              {/* Clean White Consultations Header Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-bold px-2 py-0.5 uppercase">
                      Clinical Encounters
                    </Badge>
                    <span className="text-xs text-slate-500 font-medium">Barangay {nurseBarangay}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Stethoscope className="text-teal-600" size={20} /> Patient Consultations &amp; Specialized Programs
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    General consultations, adolescent health checks, family planning counseling, and TB-DOTS clinical records.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setIsIntakeOpen(true)}
                    variant="outline"
                    className="border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold gap-1.5 rounded-xl cursor-pointer"
                  >
                    <UserPlus size={14} className="text-slate-500" /> + Add Patient
                  </Button>
                  <Button
                    onClick={() => setIsNewConsultOpen(true)}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer rounded-xl h-9 px-4"
                  >
                    <PlusCircle size={14} /> + New Consultation
                  </Button>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'All', label: 'All Programs' },
                    { id: 'General Consultation', label: 'General' },
                    { id: 'Adolescent Health', label: 'Adolescent' },
                    { id: 'Family Planning', label: 'Family Planning' },
                    { id: 'Teenage Pregnancy Prevention', label: 'Teenage Prevention' },
                    { id: 'NTP (TB-DOTS)', label: 'NTP (TB-DOTS)' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setConsFilterProgram(p.id)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer border ${
                        consFilterProgram === p.id
                          ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="w-64">
                  <Input
                    placeholder="Search patient or phone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-8 text-xs bg-white rounded-xl border-slate-200"
                  />
                </div>
              </div>

              {/* Consultations Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-bold text-slate-700">Patient Details</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Program / Service</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Vitals &amp; Category</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Chief Complaint &amp; Diagnosis</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Prescription / Management</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Date</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConsultations.map((c, idx) => {
                      const prog = c.program_type || c.service_type || 'General Consultation';
                      const badgeStyle = prog.includes('Adolescent')
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : prog.includes('Family Planning')
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : prog.includes('Teenage')
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : prog.includes('TB-DOTS') || prog.includes('NTP')
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-teal-100 text-teal-800 border-teal-200';

                      return (
                        <TableRow key={`cons-${c.id}-${idx}`} className="text-xs hover:bg-slate-50/70 transition-colors">
                          <TableCell>
                            <button
                              onClick={() => openPatient360(c.patient_name, c.contact_number, c.barangay)}
                              className="font-bold text-slate-900 hover:text-teal-700 text-left cursor-pointer flex items-center gap-1.5"
                            >
                              <User size={13} className="text-teal-600" />
                              {c.patient_name}
                            </button>
                            <span className="text-[11px] text-slate-500 block ml-4.5">
                              {c.age} yrs · {c.gender} · <span className="font-mono">{c.contact_number || 'No phone'}</span>
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge className={`text-[10px] font-bold border ${badgeStyle}`}>
                              {prog}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <span className="font-mono font-semibold text-slate-800">{c.bp}</span>
                            <span className="text-[10px] text-slate-400 block">{c.temp} · {c.weight}</span>
                          </TableCell>

                          <TableCell className="max-w-[200px]">
                            <p className="font-semibold text-slate-800 truncate" title={c.chief_complaint}>{c.chief_complaint}</p>
                            <p className="text-[11px] text-slate-500 truncate" title={c.diagnosis}>{c.diagnosis}</p>
                          </TableCell>

                          <TableCell className="max-w-[200px]">
                            <span className="text-[11px] text-teal-900 bg-teal-50/70 px-2 py-0.5 rounded border border-teal-200/50 block truncate" title={c.prescribed_meds || c.treatment}>
                              {c.prescribed_meds || c.treatment || 'Routine care advised'}
                            </span>
                          </TableCell>

                          <TableCell className="text-slate-500 font-mono text-[11px]">
                            {c.consultation_date}
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPatient360(c.patient_name, c.contact_number, c.barangay)}
                              className="text-[10px] h-7 px-2 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer rounded-lg"
                            >
                              View 360°
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredConsultations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-xs py-10 text-slate-400">
                          No consultations match the selected filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ═══ PRENATAL & MATERNAL TAB ════════════════════════════════════ */}
          {activeTab === 'maternal' && (
            <div className="space-y-4">
              {/* Clean White Maternal Header Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-pink-50 text-pink-800 border-pink-200 text-[10px] font-bold px-2 py-0.5 uppercase">
                      Maternal Health &amp; Safe Motherhood
                    </Badge>
                    <span className="text-xs text-slate-500 font-medium">Barangay {nurseBarangay}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Heart className="text-pink-600" size={20} /> Prenatal &amp; Maternal Registry (2nd Visit Tracking)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track LMP, EDD, AOG weeks, fundic height, fetal heart tones, and scheduled 2nd visit follow-ups.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setIsBatchSmsOpen(true)}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer rounded-xl h-9 px-3.5"
                  >
                    <Send size={13} className="text-amber-700" />
                    <span>Send Due Reminders ({overduePrenatal.length})</span>
                  </Button>
                  <Button
                    onClick={() => setIsNewPrenatalOpen(true)}
                    className="bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer rounded-xl h-9 px-4"
                  >
                    <PlusCircle size={14} /> + New Prenatal Record
                  </Button>
                </div>
              </div>

              {/* Filter Pills with 2nd Visit highlight */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all', label: 'All Mothers' },
                    { id: '1st', label: '1st Visit' },
                    { id: '2nd', label: '⭐ 2nd Visit' },
                    { id: '3rd', label: '3rd+ Visit' },
                    { id: 'due', label: '⚠️ Overdue / Due Soon' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setMaternalFilterVisit(f.id as any)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer border ${
                        maternalFilterVisit === f.id
                          ? f.id === '2nd'
                            ? 'bg-purple-800 text-white border-purple-800 shadow-xs'
                            : 'bg-pink-700 text-white border-pink-700 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="w-64">
                  <Input
                    placeholder="Search mother or phone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-8 text-xs bg-white rounded-xl border-slate-200"
                  />
                </div>
              </div>

              {/* Maternal Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-bold text-slate-700">Mother Patient</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Visit Number</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">AOG / EDD</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Vitals &amp; FHR</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Next Scheduled Visit</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Schedule Status</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaternal.map((r, idx) => {
                      const isOverdue = r.next_visit_date && new Date(r.next_visit_date) <= new Date();
                      const isDueSoon = r.next_visit_date && !isOverdue && (new Date(r.next_visit_date).getTime() - Date.now()) / 86400000 <= 7;
                      const isSecondVisit = r.visit_number === 2;

                      return (
                        <TableRow key={`prn-${r.id}-${idx}`} className={`text-xs hover:bg-slate-50/70 transition-colors ${isOverdue ? 'bg-red-50/40' : isDueSoon ? 'bg-amber-50/40' : ''}`}>
                          <TableCell>
                            <button
                              onClick={() => openPatient360(r.patient_name, r.contact_number, r.barangay)}
                              className="font-bold text-slate-900 hover:text-pink-700 text-left cursor-pointer flex items-center gap-1.5"
                            >
                              <Heart size={13} className="text-pink-600" />
                              {r.patient_name}
                            </button>
                            <span className="text-[11px] text-slate-500 block ml-4.5">
                              {r.age} yrs · {r.gravida} {r.para} · <span className="font-mono">{r.contact_number}</span>
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge className={`text-[10px] font-bold border ${isSecondVisit ? 'bg-purple-100 text-purple-900 border-purple-300' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                              {isSecondVisit ? '⭐ 2nd Visit' : `Visit #${r.visit_number}`}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <span className="font-bold text-slate-800">{r.aog_weeks} wks AOG</span>
                            <span className="text-[10px] text-slate-400 block font-mono">EDD: {r.edd || '—'}</span>
                          </TableCell>

                          <TableCell>
                            <span className="font-mono font-semibold text-slate-800">BP: {r.bp}</span>
                            <span className="text-[10px] text-slate-500 block">FHR: {r.fetal_heart_rate} · Fundic: {r.fundic_height}</span>
                          </TableCell>

                          <TableCell>
                            <span className={`font-semibold font-mono ${isOverdue ? 'text-red-700' : isDueSoon ? 'text-amber-700' : 'text-slate-800'}`}>
                              {r.next_visit_date}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">{r.next_visit_note}</span>
                          </TableCell>

                          <TableCell>
                            <Badge className={`text-[10px] border-0 font-bold ${isOverdue ? 'bg-red-100 text-red-700' : isDueSoon ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {isOverdue ? 'Overdue' : isDueSoon ? 'Due Soon' : 'On Track'}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPatient360(r.patient_name, r.contact_number, r.barangay)}
                                className="text-[10px] h-7 px-2 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer rounded-lg"
                              >
                                360° Profile
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredMaternal.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-xs py-10 text-slate-400">
                          No maternal records match the selected filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ═══ IMMUNIZATIONS TAB ══════════════════════════════════════════ */}
          {activeTab === 'immunizations' && (
            <div className="space-y-4">
              {/* Clean White Immunizations Header Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-bold px-2 py-0.5 uppercase">
                      National Immunization Program
                    </Badge>
                    <span className="text-xs text-slate-500 font-medium">Barangay {nurseBarangay}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                    <Syringe className="text-blue-600" size={20} /> EPI Child Immunization Registry (Dose 2 Tracking)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    DOH standard child vaccination records, dynamic vaccine types, batch tracking, and reminder scheduling.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setIsBatchSmsOpen(true)}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer rounded-xl h-9 px-3.5"
                  >
                    <Send size={13} className="text-amber-700" />
                    <span>Send Due Reminders ({overdueImmun.length})</span>
                  </Button>
                  <Button
                    onClick={() => setIsNewImmunOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer rounded-xl h-9 px-4"
                  >
                    <PlusCircle size={14} /> + Record Child Vaccination
                  </Button>
                </div>
              </div>

              {/* Filter Pills with Dose 2 Highlight */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all', label: 'All Doses' },
                    { id: 'dose1', label: 'Dose 1' },
                    { id: 'dose2', label: '⭐ Dose 2' },
                    { id: 'dose3', label: 'Dose 3 / Booster' },
                    { id: 'due', label: '⚠️ Overdue / Due Soon' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setImmunFilterDose(f.id as any)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer border ${
                        immunFilterDose === f.id
                          ? f.id === 'dose2'
                            ? 'bg-purple-800 text-white border-purple-800 shadow-xs'
                            : 'bg-blue-700 text-white border-blue-700 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="w-64">
                  <Input
                    placeholder="Search child or guardian phone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-8 text-xs bg-white rounded-xl border-slate-200"
                  />
                </div>
              </div>

              {/* Immunization Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-bold text-slate-700">Child Patient</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Vaccine &amp; Dose</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Batch / Lot #</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Date Administered</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Next Due Date</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Observations / Remarks</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredImmun.map((r, idx) => {
                      const isOverdue = r.next_due_date && new Date(r.next_due_date) <= new Date();
                      const isDueSoon = r.next_due_date && !isOverdue && (new Date(r.next_due_date).getTime() - Date.now()) / 86400000 <= 7;
                      const isDose2 = r.dose_number.includes('2');

                      return (
                        <TableRow key={`imm-${r.id}-${idx}`} className={`text-xs hover:bg-slate-50/70 transition-colors ${isOverdue ? 'bg-red-50/40' : isDueSoon ? 'bg-amber-50/40' : ''}`}>
                          <TableCell>
                            <button
                              onClick={() => openPatient360(r.child_name, r.contact_number, r.barangay)}
                              className="font-bold text-slate-900 hover:text-blue-700 text-left cursor-pointer flex items-center gap-1.5"
                            >
                              <Baby size={13} className="text-blue-600" />
                              {r.child_name}
                            </button>
                            <span className="text-[11px] text-slate-500 block ml-4.5">
                              {r.age_months} mos · Guardian: {r.guardian} · <span className="font-mono">{r.contact_number}</span>
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="font-bold text-slate-900 block">{r.vaccine_given}</span>
                            <Badge className={`text-[9px] font-bold border mt-0.5 ${isDose2 ? 'bg-purple-100 text-purple-900 border-purple-300' : 'bg-blue-100 text-blue-900 border-blue-200'}`}>
                              {r.dose_number}
                            </Badge>
                          </TableCell>

                          <TableCell className="font-mono text-slate-600 text-[11px]">
                            {r.batch_number || 'LOT-2026-X9'}
                          </TableCell>

                          <TableCell className="font-mono text-slate-600 text-[11px]">
                            {r.date_given}
                          </TableCell>

                          <TableCell>
                            <span className={`font-semibold font-mono ${isOverdue ? 'text-red-700' : isDueSoon ? 'text-amber-700' : 'text-slate-800'}`}>
                              {r.next_due_date || 'Completed Series'}
                            </span>
                            {isOverdue && <span className="text-[10px] text-red-600 block font-bold">⚠️ Overdue</span>}
                          </TableCell>

                          <TableCell className="max-w-[200px]">
                            <span className="text-[11px] text-slate-600 truncate block" title={r.remarks}>
                              {r.remarks || 'Cleared for routine vaccination'}
                            </span>
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPatient360(r.child_name, r.contact_number, r.barangay)}
                              className="text-[10px] h-7 px-2 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer rounded-lg"
                            >
                              360° Profile
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredImmun.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-xs py-10 text-slate-400">
                          No child immunization records match the selected filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ═══ WEEKLY SCHEDULE TAB ════════════════════════════════════════ */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <CalendarCheck className="text-violet-600" size={20} /> Weekly Clinic Schedule &amp; Operating Hours
                  </h2>
                  <p className="text-xs text-slate-500">Official health center consultation hours (no slot limits)</p>
                </div>
                <Button onClick={() => setIsScheduleOpen(true)} className="bg-violet-600 hover:bg-violet-700 text-white text-xs gap-1.5 cursor-pointer rounded-xl">
                  <PlusCircle size={14} /> Post Weekly Schedule
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {weeklySchedules.map((s, idx) => (
                  <Card key={`sch-${s.id}-${idx}`} className="border border-slate-200 bg-white rounded-2xl shadow-xs hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{s.title}</p>
                          <Badge className="bg-violet-100 text-violet-800 text-[10px] border-0 mt-1">{s.service_type}</Badge>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingSchedule(s); setIsEditScheduleOpen(true); }} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg cursor-pointer">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDeleteSchedule(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-2 font-semibold text-slate-800"><Calendar size={13} className="text-violet-600" />{s.day}</div>
                        <div className="flex items-center gap-2 text-violet-700 font-mono"><Clock size={13} className="text-violet-600" />{s.time_slot}</div>
                        <div className="flex items-center gap-2"><MapPin size={13} className="text-violet-600" />{s.location}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500"><UserPlus size={13} className="text-violet-600" />Attending: {s.assigned_to}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ═══ RESIDENT APPOINTMENTS TAB ═════════════════════════════════ */}
          {activeTab === 'appointments' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <CalendarCheck className="text-violet-600" size={20} /> Resident Appointment Requests &amp; Reservations
                  </h2>
                  <p className="text-xs text-slate-500">
                    Review and confirm resident appointment requests for consultations, prenatal care, immunizations, and family planning.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={loadData}
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 h-8 border-slate-300 hover:bg-slate-50 cursor-pointer"
                  >
                    <RefreshCcw size={13} /> Refresh
                  </Button>
                </div>
              </div>

              {/* Quick Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Pending Review</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-amber-600">
                      {appointments.filter(a => a.status === 'Pending').length}
                    </span>
                    <span className="text-[11px] text-slate-400">awaiting schedule</span>
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Confirmed Slots</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-emerald-600">
                      {appointments.filter(a => a.status === 'Approved').length}
                    </span>
                    <span className="text-[11px] text-slate-400">ready for visit</span>
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Completed Visits</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-blue-600">
                      {appointments.filter(a => a.status === 'Completed').length}
                    </span>
                    <span className="text-[11px] text-slate-400">consultations done</span>
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Bookings</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-violet-600">
                      {appointments.length}
                    </span>
                    <span className="text-[11px] text-slate-400">all-time requests</span>
                  </div>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <Input
                    placeholder="Search resident name, ref code, service..."
                    value={apptSearch}
                    onChange={e => setApptSearch(e.target.value)}
                    className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={apptServiceFilter} onValueChange={setApptServiceFilter}>
                    <SelectTrigger className="w-[180px] h-9 text-xs bg-slate-50 border-slate-200 rounded-xl">
                      <SelectValue placeholder="All Services" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      <SelectItem value="Prenatal">Prenatal Check-up</SelectItem>
                      <SelectItem value="Immunization">EPI Immunization</SelectItem>
                      <SelectItem value="General Consultation">General Consultation</SelectItem>
                      <SelectItem value="Family Planning">Family Planning</SelectItem>
                      <SelectItem value="Adolescent">Adolescent Health</SelectItem>
                      <SelectItem value="TB-DOTS">NTP (TB-DOTS)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={apptStatusFilter} onValueChange={v => setApptStatusFilter(v as any)}>
                    <SelectTrigger className="w-[130px] h-9 text-xs bg-slate-50 border-slate-200 rounded-xl">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Appointments Registry Table */}
              <Card className="border-slate-200 bg-white rounded-2xl shadow-xs overflow-hidden">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CalendarCheck className="text-violet-600" size={16} />
                      Incoming Resident Appointments ({filteredAppointments.length})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80">
                          <TableHead className="text-xs">Ref Code</TableHead>
                          <TableHead className="text-xs">Resident Details</TableHead>
                          <TableHead className="text-xs">Service Requested</TableHead>
                          <TableHead className="text-xs">Requested Window</TableHead>
                          <TableHead className="text-xs">Confirmed Slot</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAppointments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-xs py-12 text-slate-400">
                              <CalendarCheck className="mx-auto mb-2 text-slate-300" size={28} />
                              <p className="font-semibold">No appointment records found</p>
                              <p className="text-[11px] mt-1 text-slate-400">Residents can book slots from the Resident Portal clinic schedule.</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAppointments.map(apt => (
                            <TableRow key={apt.id} className="text-xs hover:bg-slate-50/60 transition-colors">
                              <TableCell className="font-mono font-bold text-violet-700">
                                {apt.appointment_code}
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold text-slate-900">{apt.resident_name}</div>
                                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                  <Phone size={10} /> {apt.resident_phone || 'No phone provided'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold text-slate-800">{apt.service_type}</div>
                                {apt.resident_notes && (
                                  <div className="text-[11px] text-slate-500 italic max-w-xs truncate mt-0.5" title={apt.resident_notes}>
                                    Note: &ldquo;{apt.resident_notes}&rdquo;
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-slate-600">
                                <div className="flex items-center gap-1 font-medium">
                                  <Calendar size={12} className="text-slate-400" />
                                  {apt.preferred_date}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {apt.preferred_time || 'Morning'}
                                </div>
                              </TableCell>
                              <TableCell>
                                {apt.scheduled_date ? (
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-emerald-800 flex items-center gap-1">
                                      <Calendar size={12} className="text-emerald-600" />
                                      {apt.scheduled_date}
                                    </div>
                                    <div className="text-[11px] text-emerald-700 font-mono flex items-center gap-1">
                                      <Clock size={11} className="text-emerald-600" />
                                      {apt.scheduled_time || '09:00 AM'}
                                    </div>
                                    {apt.bhw_notes && (
                                      <div className="text-[10px] text-slate-500 italic max-w-[200px] truncate" title={apt.bhw_notes}>
                                        Inst: {apt.bhw_notes}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                                    <Clock size={10} /> Needs Scheduling
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  apt.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border-0' :
                                  apt.status === 'Completed' ? 'bg-blue-100 text-blue-800 border-0' :
                                  apt.status === 'Cancelled' ? 'bg-rose-100 text-rose-800 border-0' :
                                  'bg-amber-100 text-amber-800 border-0'
                                }>
                                  {apt.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  {apt.status === 'Pending' && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleOpenApptModal(apt)}
                                      className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1 rounded-lg cursor-pointer font-semibold shadow-xs"
                                    >
                                      <Check size={12} /> Confirm Slot
                                    </Button>
                                  )}

                                  {apt.status === 'Approved' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleOpenApptModal(apt)}
                                        className="h-7 text-[11px] border-violet-200 text-violet-700 hover:bg-violet-50 gap-1 rounded-lg cursor-pointer"
                                        title="Edit slot date & time"
                                      >
                                        <Edit2 size={11} /> Edit
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handleStartConsultationFromAppt(apt)}
                                        className="h-7 text-[11px] bg-teal-600 hover:bg-teal-700 text-white gap-1 rounded-lg cursor-pointer shadow-xs"
                                        title="Open consultation form pre-filled with resident info"
                                      >
                                        <Stethoscope size={11} /> Consult
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handleUpdateApptStatus(apt.id, 'Completed')}
                                        className="h-7 text-[11px] bg-blue-600 hover:bg-blue-700 text-white gap-1 rounded-lg cursor-pointer shadow-xs"
                                      >
                                        <CheckCircle2 size={11} /> Complete
                                      </Button>
                                    </>
                                  )}

                                  {apt.status !== 'Cancelled' && apt.status !== 'Completed' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleUpdateApptStatus(apt.id, 'Cancelled')}
                                      className="h-7 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                                    >
                                      Cancel
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══ INVENTORY TAB ═══════════════════════════════════════════════ */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Pill className="text-emerald-600" size={20} /> Vaccines &amp; Medicine Inventory
                  </h2>
                  <p className="text-xs text-slate-500">Live stock tracking for maternal vitamins, EPI vaccines, and clinic medicines</p>
                </div>
                <Button onClick={() => setIsInventoryOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 cursor-pointer rounded-xl">
                  <PlusCircle size={14} /> Add Inventory Item
                </Button>
              </div>

              {/* Filter Pills */}
              <div className="flex gap-2 flex-wrap">
                {(['all', 'vaccine', 'medicine'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setInvFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                      invFilter === f
                        ? f === 'vaccine'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : f === 'medicine'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                          : 'bg-slate-800 text-white border-slate-800 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {f === 'all' ? '🗂 All Items' : f === 'vaccine' ? '💉 Vaccines' : '💊 Medicine'}
                  </button>
                ))}
                <span className="text-xs text-slate-400 self-center ml-1">
                  {(() => {
                    const filtered = inventory.filter(i =>
                      invFilter === 'vaccine'
                        ? i.category === 'Vaccine (EPI)' || i.category === 'Pediatric Supply'
                        : invFilter === 'medicine'
                        ? ['Essential Medicine', 'Maternal Vitamin', 'Family Planning', 'TB-DOTS Supply', 'Other'].includes(i.category)
                        : true
                    );
                    return `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;
                  })()}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-bold text-slate-700">Item Name</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Category</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Stock on Hand</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Expiration</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Status</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory
                      .filter(i =>
                        invFilter === 'vaccine'
                          ? i.category === 'Vaccine (EPI)' || i.category === 'Pediatric Supply'
                          : invFilter === 'medicine'
                          ? ['Essential Medicine', 'Maternal Vitamin', 'Family Planning', 'TB-DOTS Supply', 'Other'].includes(i.category)
                          : true
                      )
                      .map(item => (
                      <TableRow key={item.id} className="text-xs hover:bg-slate-50/70">
                        <TableCell className="font-bold text-slate-900">{item.item_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{item.category}</Badge></TableCell>
                        <TableCell className="font-bold font-mono">{item.stock} {item.unit}</TableCell>
                        <TableCell className="font-mono text-slate-500">{item.expiry_date}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] border-0 ${item.status === 'In Stock' ? 'bg-emerald-100 text-emerald-800' : item.status === 'Low Stock' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRestockTargetItem(item);
                                setRestockQty('20');
                                setIsRestockOpen(true);
                              }}
                              className="h-7 text-[11px] px-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200 cursor-pointer rounded-lg font-medium flex items-center gap-1"
                            >
                              <PlusCircle size={12} /> Restock
                            </Button>
                            <button onClick={() => handleDeleteInventory(item.id)} className="p-1 text-slate-400 hover:text-red-600 cursor-pointer transition-colors" title="Delete item">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ═══ HISTORICAL ARCHIVES ═════════════════════════════════════════ */}
          {activeTab === 'archives' && (
            <ClinicalArchivesHub
              barangay={nurseBarangay}
              onSelectPatient={(name, phone) => openPatient360(name, phone || '')}
            />
          )}

          {/* ═══ GMAIL-STYLE SMS NOTIFICATIONS ═════════════════════════════════ */}
          {activeTab === 'sms' && (
            <div className="space-y-4">
              <GmailNotificationHub
                notifications={notifications}
                onRefresh={loadData}
                onOpenDetails={n => setSelectedSms(n)}
                onOpenCompose={() => setIsSendSmsModalOpen(true)}
                currentUserRole="nurse"
                barangay={nurseBarangay}
              />
            </div>
          )}
          {/* ═══ PROFILE SETTINGS DEDICATED TAB ═════════════════════════════ */}
          {activeTab === 'profile' && (
            <ProfileSettingsView
              user={user}
              onProfileUpdated={(updated) => setUser(updated)}
            />
          )}
        </main>
      </div>

      {/* ─── MODALS ──────────────────────────────────────────────────────────── */}

      {/* Safe Batch SMS Preview & Confirmation Modal */}
      <BatchSmsReminderModal
        isOpen={isBatchSmsOpen}
        onClose={() => setIsBatchSmsOpen(false)}
        duePatients={duePatientsList}
        barangay={nurseBarangay}
        attendingName={nurseName}
        onBatchSent={(sentIds) => {
          setPrenatalRecords(prev => prev.map(p => sentIds.includes(`mat-${p.id}`) ? { ...p, sms_sent: true } : p));
          setImmunRecords(prev => prev.map(i => sentIds.includes(`imm-${i.id}`) ? { ...i, sms_sent: true } : i));
          loadData();
        }}
      />

      {/* 360 Patient Details Modal */}
      <PatientDetailModal
        isOpen={isPatientModalOpen}
        onClose={() => setIsPatientModalOpen(false)}
        patient={selectedPatientModal}
        onSendSmsSuccess={() => toast.success('SMS notification sent to patient')}
        onLogReturnVisit={handleLogReturnVisitFromModal}
      />

      {/* Smart Clinical Intake Modal (Unified + Auto-sync) */}
      <SmartClinicalIntakeModal
        isOpen={isIntakeOpen}
        onClose={() => setIsIntakeOpen(false)}
        onSuccess={(created) => {
          if (created) {
            setConsultations(prev => [created, ...prev]);
          }
          loadData();
        }}
        barangay={nurseBarangay}
        attendingWorker={nurseName}
        workerRole="nurse"
      />

      {/* SMS Details & View Modal */}
      <SmsDetailsModal
        isOpen={!!selectedSms}
        onClose={() => setSelectedSms(null)}
        notification={selectedSms}
      />

      {/* New Consultation Modal with Clean White Header & Dynamic Program Selection */}
      <Dialog open={isNewConsultOpen} onOpenChange={setIsNewConsultOpen}>
        <DialogContent className="bg-white max-w-xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl shadow-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100 bg-white">
            <div className="flex items-center justify-between">
              <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Clinical Encounter
              </span>
              <span className="text-xs text-slate-400 font-medium">Brgy. {nurseBarangay}</span>
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900 mt-1.5 flex items-center gap-2">
              <Stethoscope className="text-teal-600" size={18} /> Record Patient Consultation
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Select program below to display relevant clinical assessment and consultation fields.
            </DialogDescription>
          </div>

          <form onSubmit={handleCreateConsultation} className="p-6 space-y-4">
            {/* Patient Demographics */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2 relative">
                <Label className="text-xs font-semibold text-slate-700">Patient Name <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    value={cName}
                    onChange={e => {
                      const clean = e.target.value.replace(/[0-9]/g, '');
                      setCName(clean);
                      if (clean.trim().length >= 2) {
                        setIsCNameSearching(true);
                        apiService.searchPatients(clean)
                          .then(res => {
                            setCNameSearchResults(res.patients || []);
                            setShowCNameSuggestions(true);
                          })
                          .catch(() => setCNameSearchResults([]))
                          .finally(() => setIsCNameSearching(false));
                      } else {
                        setCNameSearchResults([]);
                        setShowCNameSuggestions(false);
                      }
                    }}
                    onFocus={() => {
                      if (cNameSearchResults.length > 0) setShowCNameSuggestions(true);
                    }}
                    placeholder="Type name (matches database automatically, numbers blocked)"
                    required
                    className="h-9 text-xs mt-1 rounded-xl border-slate-200 focus:border-teal-500"
                  />
                  {isCNameSearching && (
                    <span className="absolute right-2.5 top-3 text-[10px] text-teal-600 font-semibold animate-pulse">
                      Searching...
                    </span>
                  )}
                </div>

                {/* Auto-suggest dropdown beneath patient name */}
                {showCNameSuggestions && cNameSearchResults.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-teal-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                    <div className="p-1.5 bg-teal-50/80 text-[10px] font-bold text-teal-800 flex items-center justify-between px-3">
                      <span>Found in Registry ({cNameSearchResults.length})</span>
                      <button
                        type="button"
                        onClick={() => setShowCNameSuggestions(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    {cNameSearchResults.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setCName(p.name);
                          if (p.phone) setCPhone(p.phone);
                          if (p.gender) setCGender(p.gender as any);
                          if (p.age !== undefined && p.age !== null && p.age !== '') {
                            setCAge(String(p.age));
                          } else if (p.date_of_birth) {
                            const calculatedAge = Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                            setCAge(String(calculatedAge));
                          }
                          setShowCNameSuggestions(false);
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
                <Label className="text-xs font-semibold text-slate-700">Contact Mobile Phone <span className="text-red-500">*</span></Label>
                <Input value={cPhone} onChange={e => setCPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="09XXXXXXXXX" required maxLength={11} className="h-9 text-xs font-mono mt-1 rounded-xl border-slate-200 focus:border-teal-500" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Age</Label>
                <Input value={cAge} onChange={e => setCAge(e.target.value)} placeholder="e.g. 28" className="h-9 text-xs mt-1 rounded-xl border-slate-200 focus:border-teal-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Gender</Label>
                <Select value={cGender} onValueChange={v => setCGender(v as any)}>
                  <SelectTrigger className="h-9 text-xs mt-1 rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Female">Female</SelectItem><SelectItem value="Male">Male</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Consultation Program</Label>
                <Select value={cProgram} onValueChange={(v: any) => setCProgram(v)}>
                  <SelectTrigger className="h-9 text-xs mt-1 rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General Consultation">General Medical Consultation</SelectItem>
                    <SelectItem value="Family Planning">Family Planning Counseling</SelectItem>
                    <SelectItem value="Adolescent Health">Adolescent Health Consultation</SelectItem>
                    <SelectItem value="Teenage Pregnancy Prevention">Teenage Pregnancy Prevention</SelectItem>
                    <SelectItem value="NTP (TB-DOTS)">NTP (TB-DOTS Program)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* DYNAMIC PROGRAM-SPECIFIC FORM CONTENT */}

            {/* Program 1: General Medical Consultation */}
            {cProgram === 'General Consultation' && (
              <div className="space-y-3.5">
                {/* Triage Vital Signs */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">Triage Vital Signs</p>
                    <Badge className={`text-[9px] border-0 ${cBpStatus.color}`}>{cBpStatus.label}</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-1">
                      <Label className="text-[10px]">BP (Sys / Dia)</Label>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Input
                          value={cBpSys}
                          onChange={e => setCBpSys(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          placeholder="120"
                          maxLength={3}
                          className="h-8 text-xs font-mono text-center bg-white rounded-lg"
                        />
                        <span className="text-slate-400 font-bold">/</span>
                        <Input
                          value={cBpDia}
                          onChange={e => setCBpDia(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          placeholder="80"
                          maxLength={3}
                          className="h-8 text-xs font-mono text-center bg-white rounded-lg"
                        />
                      </div>
                    </div>
                    <div><Label className="text-[10px]">Temp (°C)</Label><Input value={cTemp} onChange={e => setCTemp(e.target.value)} placeholder="36.5" className="h-8 text-xs bg-white rounded-lg mt-0.5" /></div>
                    <div><Label className="text-[10px]">Weight (kg)</Label><Input value={cWeight} onChange={e => setCWeight(e.target.value)} placeholder="54" className="h-8 text-xs bg-white rounded-lg mt-0.5" /></div>
                    <div><Label className="text-[10px]">HR (bpm)</Label><Input value={cHR} onChange={e => setCHR(e.target.value)} placeholder="76" className="h-8 text-xs bg-white rounded-lg mt-0.5" /></div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Chief Complaint / Symptoms <span className="text-red-500">*</span></Label>
                  <Input value={cComplaint} onChange={e => setCComplaint(e.target.value)} placeholder="e.g. Headache, fever, productive cough" required className="h-9 text-xs mt-1 rounded-xl" />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Clinical Diagnosis</Label>
                  <Input value={cDiagnosis} onChange={e => setCDiagnosis(e.target.value)} placeholder="e.g. Upper respiratory tract infection" className="h-9 text-xs mt-1 rounded-xl" />
                </div>

                {/* Dynamic Prescription Builder */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Pill size={13} className="text-teal-600" />
                      Dynamic Prescription Builder
                    </Label>
                    <span className="text-[10px] text-slate-400">Add multiple meds</span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {['Paracetamol 500mg', 'Amoxicillin 500mg', 'Mefenamic Acid 500mg', 'Cetirizine 10mg', 'Salbutamol', 'ORS'].map(m => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setMedName(m)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white hover:bg-teal-50 text-slate-700 border border-slate-200 cursor-pointer"
                      >
                        + {m}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Select value={medName} onValueChange={setMedName}>
                        <SelectTrigger className="h-8 text-xs bg-white rounded-lg border-slate-200">
                          <SelectValue placeholder={medName || "Select medicine from stock..."} />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {inventory
                            .filter(i => i.category === 'Essential Medicine' || i.category === 'Maternal Vitamin')
                            .map(med => (
                              <SelectItem key={med.id} value={med.item_name} disabled={med.stock <= 0}>
                                <div className="flex items-center justify-between gap-2 w-full text-xs">
                                  <span>{med.item_name}</span>
                                  <span className={`text-[10px] font-mono font-bold ${med.stock <= 0 ? 'text-red-500' : med.stock < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    ({med.stock} {med.unit})
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Button type="button" onClick={handleAddMedToRx} size="sm" className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs h-8 rounded-lg cursor-pointer gap-1">
                        <Plus size={12} /> Add Med
                      </Button>
                    </div>
                  </div>

                  {cPrescriptions.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {cPrescriptions.map((item, i) => (
                        <div key={item.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{i + 1}. {item.name} {item.dosage}</span>
                            <span className="text-[11px] text-slate-500 block">{item.frequency} for {item.duration}</span>
                          </div>
                          <button type="button" onClick={() => setCPrescriptions(prev => prev.filter(p => p.id !== item.id))} className="text-red-500 hover:text-red-700 cursor-pointer p-1">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Program 2: Family Planning Counseling */}
            {cProgram === 'Family Planning' && (
              <div className="space-y-3.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Heart size={14} className="text-teal-600" /> Family Planning &amp; Reproductive Care
                  </span>
                  <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-[10px]">DOH Program</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Client Classification</Label>
                    <Select value={cFpClientType} onValueChange={setCFpClientType}>
                      <SelectTrigger className="h-9 text-xs bg-white mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New Acceptor">New Acceptor</SelectItem>
                        <SelectItem value="Current User (Routine Supply)">Current User (Routine Supply)</SelectItem>
                        <SelectItem value="Method Switcher">Method Switcher</SelectItem>
                        <SelectItem value="Medical Restart">Medical Restart</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Contraceptive Method</Label>
                    <Select value={cFpMethod} onValueChange={setCFpMethod}>
                      <SelectTrigger className="h-9 text-xs bg-white mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DMPA Injectable (Depo)">DMPA Injectable (Depo-Provera)</SelectItem>
                        <SelectItem value="Combined Oral Contraceptive (COC) Pills">Oral Contraceptive Pills (COC)</SelectItem>
                        <SelectItem value="Progestin-Only Pills (POP - Lactating)">Progestin-Only Pills (POP)</SelectItem>
                        <SelectItem value="Subdermal Implant (Implanon)">Subdermal Implant (3-yr)</SelectItem>
                        <SelectItem value="Intrauterine Device (IUD)">Intrauterine Device (IUD)</SelectItem>
                        <SelectItem value="Barrier / Condoms">Barrier / Condoms</SelectItem>
                        <SelectItem value="Standard Days Method (SDM / Natural)">Standard Days Method (Natural)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Last Menstrual Period (LMP)</Label>
                    <Input type="date" value={cFpLmp} onChange={e => setCFpLmp(e.target.value)} className="h-9 text-xs bg-white mt-1 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Next Supply / Injection Date</Label>
                    <Input type="date" value={cFpNextSupply} onChange={e => setCFpNextSupply(e.target.value)} className="h-9 text-xs bg-white mt-1 rounded-xl" />
                  </div>
                </div>

                {/* Quick BP & Weight Triage */}
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">Physical Eligibility Check</span>
                    <Badge className={`text-[9px] border-0 ${cBpStatus.color}`}>{cBpStatus.label}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-[10px]">Blood Pressure (Sys / Dia)</Label>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Input value={cBpSys} onChange={e => setCBpSys(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="120" maxLength={3} className="h-8 text-xs font-mono text-center bg-slate-50 rounded-lg" />
                        <span className="text-slate-400 font-bold">/</span>
                        <Input value={cBpDia} onChange={e => setCBpDia(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="80" maxLength={3} className="h-8 text-xs font-mono text-center bg-slate-50 rounded-lg" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">Weight (kg)</Label>
                      <Input value={cWeight} onChange={e => setCWeight(e.target.value)} placeholder="52" className="h-8 text-xs bg-slate-50 rounded-lg mt-0.5" />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Counseling Notes / Side Effects Discussed</Label>
                  <Input value={cFpNotes} onChange={e => setCFpNotes(e.target.value)} placeholder="e.g. Mild spotting discussed, advised hydration and prompt return if unusual pain." className="h-9 text-xs bg-white mt-1 rounded-xl" />
                </div>
              </div>
            )}

            {/* Program 3: Adolescent Health Consultation */}
            {cProgram === 'Adolescent Health' && (
              <div className="space-y-3.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <User size={14} className="text-purple-600" /> Adolescent Health &amp; Guidance
                  </span>
                  <Badge className="bg-purple-50 text-purple-800 border-purple-200 text-[10px]">Youth Wellness</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Age / Pubertal Stage</Label>
                    <Select value={cAdolescentStage} onValueChange={setCAdolescentStage}>
                      <SelectTrigger className="h-9 text-xs bg-white mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Early Adolescent (10-14 yrs)">Early Adolescent (10-14 yrs)</SelectItem>
                        <SelectItem value="Mid Adolescent (15-17 yrs)">Mid Adolescent (15-17 yrs)</SelectItem>
                        <SelectItem value="Late Adolescent (18-24 yrs)">Late Adolescent (18-24 yrs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">School / Education Status</Label>
                    <Select value={cTeenSchool} onValueChange={setCTeenSchool}>
                      <SelectTrigger className="h-9 text-xs bg-white mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Enrolled in High School">Enrolled in High School</SelectItem>
                        <SelectItem value="Enrolled in College/Vocational">Enrolled in College/Vocational</SelectItem>
                        <SelectItem value="Out of School Youth (OSY)">Out of School Youth (OSY)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Assessment &amp; Counseling Area</Label>
                  <Select value={cAdolescentFocus} onValueChange={setCAdolescentFocus}>
                    <SelectTrigger className="h-9 text-xs bg-white mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pubertal Guidance & Mental Wellness">Pubertal Guidance &amp; Mental Wellness</SelectItem>
                      <SelectItem value="Physical Growth & Nutrition Counseling">Physical Growth &amp; Nutrition Counseling</SelectItem>
                      <SelectItem value="Substance, Smoking & Screen Exposure">Substance, Smoking &amp; Screen Exposure</SelectItem>
                      <SelectItem value="Reproductive Health & Safe Behaviors">Reproductive Health &amp; Safe Behaviors</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1">
                  <span className="text-[11px] font-bold text-slate-700">Vital Signs Check</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-[10px]">BP (Sys / Dia)</Label>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Input value={cBpSys} onChange={e => setCBpSys(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="110" maxLength={3} className="h-8 text-xs font-mono text-center bg-slate-50 rounded-lg" />
                        <span className="text-slate-400 font-bold">/</span>
                        <Input value={cBpDia} onChange={e => setCBpDia(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="70" maxLength={3} className="h-8 text-xs font-mono text-center bg-slate-50 rounded-lg" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px]">Weight (kg)</Label>
                      <Input value={cWeight} onChange={e => setCWeight(e.target.value)} placeholder="50" className="h-8 text-xs bg-slate-50 rounded-lg mt-0.5" />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Counseling Summary &amp; Recommendations</Label>
                  <Input value={cComplaint} onChange={e => setCComplaint(e.target.value)} placeholder="e.g. Addressed exam stress, encouraged 8hrs sleep and balanced nutrition." className="h-9 text-xs bg-white mt-1 rounded-xl" />
                </div>
              </div>
            )}

            {/* Program 4: Teenage Pregnancy Prevention */}
            {cProgram === 'Teenage Pregnancy Prevention' && (
              <div className="space-y-3.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-rose-600" /> Teenage Pregnancy Prevention &amp; Education
                  </span>
                  <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-[10px]">Adolescent Program</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Risk Assessment</Label>
                    <Select value={cTeenRisk} onValueChange={setCTeenRisk}>
                      <SelectTrigger className="h-9 text-xs bg-white mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low Risk / Preventive Counseling">Low Risk / Preventive Counseling</SelectItem>
                        <SelectItem value="Sexually Active Youth">Sexually Active Youth</SelectItem>
                        <SelectItem value="High Risk / Out of School">High Risk / Out of School</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Guardian Attendance</Label>
                    <Select value={cTeenGuardian} onValueChange={setCTeenGuardian}>
                      <SelectTrigger className="h-9 text-xs bg-white mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Accompanied by Guardian">Accompanied by Guardian</SelectItem>
                        <SelectItem value="Confidential Youth Encounter">Confidential Youth Encounter</SelectItem>
                        <SelectItem value="Referred by School Guidance">Referred by School Guidance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Guidance Module Provided</Label>
                  <Input value="Comprehensive Sexuality Education, Abstinence & Dual Protection" readOnly className="h-9 text-xs bg-white mt-1 rounded-xl text-slate-600" />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Youth Support Plan &amp; Facility Referral</Label>
                  <Input value={cComplaint} onChange={e => setCComplaint(e.target.value)} placeholder="e.g. Enrolled in Peer Wellness Club; scheduled monthly check-in." className="h-9 text-xs bg-white mt-1 rounded-xl" />
                </div>
              </div>
            )}

            {/* Program 5: NTP (TB-DOTS) */}
            {cProgram === 'NTP (TB-DOTS)' && (
              <div className="space-y-3.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Activity size={14} className="text-amber-600" /> National TB Control Program (NTP / TB-DOTS)
                  </span>
                  <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">Infectious Disease</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">TB Case Registration No.</Label>
                    <Input value={cTbRegNo} onChange={e => setCTbRegNo(e.target.value)} placeholder="e.g. TB-2026-0042" className="h-9 text-xs bg-white mt-1 rounded-xl font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Case Category</Label>
                    <Select value={cTbCategory} onValueChange={setCTbCategory}>
                      <SelectTrigger className="h-9 text-xs bg-white mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New Pulmonary Case">New Pulmonary Case</SelectItem>
                        <SelectItem value="Relapse / Retreatment">Relapse / Retreatment</SelectItem>
                        <SelectItem value="Extrapulmonary TB">Extrapulmonary TB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Sputum / GeneXpert Status</Label>
                    <Select value={cTbSputum} onValueChange={setCTbSputum}>
                      <SelectTrigger className="h-9 text-xs bg-white mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GeneXpert / AFB Pending">GeneXpert Pending</SelectItem>
                        <SelectItem value="Positive (MTB Detected)">Positive (MTB Detected)</SelectItem>
                        <SelectItem value="Negative (Not Detected)">Negative (Not Detected)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Treatment Phase</Label>
                    <Select value={cTbPhase} onValueChange={setCTbPhase}>
                      <SelectTrigger className="h-9 text-xs bg-white mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Intensive Phase (2 Months RHZE)">Intensive Phase (2 Months RHZE)</SelectItem>
                        <SelectItem value="Continuation Phase (4 Months RH)">Continuation Phase (4 Months RH)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Directly Observed Treatment (DOT) Supporter</Label>
                  <Input value={cTbPartner} onChange={e => setCTbPartner(e.target.value)} placeholder="e.g. BHW Rosa Mendoza / Family Supporter" className="h-9 text-xs bg-white mt-1 rounded-xl" />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsNewConsultOpen(false)} className="text-xs rounded-xl border-slate-200">Cancel</Button>
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white text-xs gap-1 font-bold cursor-pointer rounded-xl px-4 shadow-xs">
                <Check size={13} /> Save Encounter Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Prenatal Modal with Fixed Dual BP & 2nd Visit Tracking */}
      <Dialog open={isNewPrenatalOpen} onOpenChange={setIsNewPrenatalOpen}>
        <DialogContent className="bg-white max-w-2xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl shadow-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100 bg-white">
            <div className="flex items-center justify-between">
              <span className="bg-pink-50 text-pink-800 border border-pink-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Maternal Care
              </span>
              <span className="text-xs text-slate-400 font-medium">Brgy. {nurseBarangay}</span>
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900 mt-1.5 flex items-center gap-2">
              <Heart className="text-pink-600" size={18} /> New Prenatal / Maternal Record (2nd Visit Tracking)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Record gestational parameters, fundic height, fetal heart tones, and scheduled revisit reminders.
            </DialogDescription>
          </div>

          <form onSubmit={handleCreatePrenatal} className="p-6 space-y-3.5">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2">
                <Label className="text-xs font-semibold">Mother's Full Name <span className="text-red-500">*</span></Label>
                <Input value={pName} onChange={e => setPName(e.target.value)} placeholder="Full name" required className="h-9 text-xs mt-1 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Age</Label>
                <Input value={pAge} onChange={e => setPAge(e.target.value)} placeholder="e.g. 28" className="h-9 text-xs mt-1 rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-semibold">Contact Mobile Phone <span className="text-red-500">*</span></Label>
                <Input value={pPhone} onChange={e => setPPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="09XXXXXXXXX" required maxLength={11} className="h-9 text-xs font-mono mt-1 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Visit Number</Label>
                <Select value={pVisitNum} onValueChange={setPVisitNum}>
                  <SelectTrigger className="h-9 text-xs mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1st Visit (1st Trimester Initial)</SelectItem>
                    <SelectItem value="2">⭐ 2nd Visit (Mid-Gestation Follow-up)</SelectItem>
                    <SelectItem value="3">3rd Visit (Late 2nd Trimester)</SelectItem>
                    <SelectItem value="4">4th Visit (3rd Trimester Pre-delivery)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div><Label className="text-xs font-semibold">Gravida</Label><Input value={pGravida} onChange={e => setPGravida(e.target.value)} placeholder="G1" className="h-9 text-xs mt-1 rounded-xl font-mono text-center" /></div>
              <div><Label className="text-xs font-semibold">Para</Label><Input value={pPara} onChange={e => setPPara(e.target.value)} placeholder="P0" className="h-9 text-xs mt-1 rounded-xl font-mono text-center" /></div>
              <div><Label className="text-xs font-semibold">LMP <span className="text-red-500">*</span></Label><Input type="date" value={pLmp} onChange={e => setPLmp(e.target.value)} required className="h-9 text-xs mt-1 rounded-xl" /></div>
              <div><Label className="text-xs font-semibold">EDD</Label><Input type="date" value={pEdd} onChange={e => setPEdd(e.target.value)} className="h-9 text-xs mt-1 rounded-xl" /></div>
            </div>

            {/* FIXED DUAL BP INPUTS & FETAL ASSESSMENT */}
            <div className="bg-pink-50/60 border border-pink-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-pink-900 uppercase tracking-wide">Vitals &amp; Fetal Assessment</p>
                <Badge className={`text-[9px] border-0 ${pBpStatus.color}`}>{pBpStatus.label}</Badge>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-[10px]">BP (Sys/Dia)</Label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Input
                      value={pBpSys}
                      onChange={e => setPBpSys(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      placeholder="120"
                      maxLength={3}
                      className="h-8 text-xs font-mono text-center bg-white rounded-lg"
                    />
                    <span className="text-slate-400 font-bold">/</span>
                    <Input
                      value={pBpDia}
                      onChange={e => setPBpDia(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      placeholder="80"
                      maxLength={3}
                      className="h-8 text-xs font-mono text-center bg-white rounded-lg"
                    />
                  </div>
                </div>
                <div><Label className="text-[10px]">Weight (kg)</Label><Input value={pWeight} onChange={e => setPWeight(e.target.value)} placeholder="56.5" className="h-8 text-xs bg-white rounded-lg mt-0.5" /></div>
                <div><Label className="text-[10px]">Temp (°C)</Label><Input value={pTemp} onChange={e => setPTemp(e.target.value)} placeholder="36.5" className="h-8 text-xs bg-white rounded-lg mt-0.5" /></div>
                <div><Label className="text-[10px]">FHR (bpm)</Label><Input value={pFhr} onChange={e => setPFhr(e.target.value)} placeholder="148" className="h-8 text-xs bg-white rounded-lg mt-0.5" /></div>
                <div><Label className="text-[10px]">Fundic Ht (cm)</Label><Input value={pFh} onChange={e => setPFh(e.target.value)} placeholder="22" className="h-8 text-xs bg-white rounded-lg mt-0.5" /></div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Prescribed Medicines &amp; Supplements</Label>
              <Input value={pMeds} onChange={e => setPMeds(e.target.value)} placeholder="e.g. FeSO4 60mg + Folic Acid 400mcg daily" className="h-9 text-xs mt-1 rounded-xl" />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-semibold">Next Visit Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={pNextDate} onChange={e => setPNextDate(e.target.value)} required className="h-9 text-xs mt-1 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Next Visit Note</Label>
                <Input value={pNextNote} onChange={e => setPNextNote(e.target.value)} placeholder="e.g. 2nd Trimester Routine Follow-up" className="h-9 text-xs mt-1 rounded-xl" />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsNewPrenatalOpen(false)} className="text-xs rounded-xl">Cancel</Button>
              <Button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold gap-1 cursor-pointer rounded-xl px-4">
                <Save size={13} /> Save Maternal Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Child Immunization Modal with Dynamic Vaccines & Dynamic Remarks */}
      <Dialog open={isNewImmunOpen} onOpenChange={setIsNewImmunOpen}>
        <DialogContent className="bg-white max-w-xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl shadow-xl border border-slate-200">
          <div className="p-5 border-b border-slate-100 bg-white">
            <div className="flex items-center justify-between">
              <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Child Immunization (EPI)
              </span>
              <span className="text-xs text-slate-400 font-medium">Brgy. {nurseBarangay}</span>
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900 mt-1.5 flex items-center gap-2">
              <Baby className="text-blue-600" size={18} /> Record Child Immunization (DOH Standard)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Dynamic vaccine selection, batch recording, dose 2 tracking, and automated reminder alerts.
            </DialogDescription>
          </div>

          <form onSubmit={handleCreateImmun} className="p-6 space-y-3.5">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2">
                <Label className="text-xs font-semibold">Child's Full Name <span className="text-red-500">*</span></Label>
                <Input value={iChild} onChange={e => setIChild(e.target.value)} placeholder="Full name of child" required className="h-9 text-xs mt-1 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Sex</Label>
                <Select value={iGender} onValueChange={setIGender}>
                  <SelectTrigger className="h-9 text-xs mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-semibold">Guardian Name <span className="text-red-500">*</span></Label>
                <Input value={iGuardian} onChange={e => setIGuardian(e.target.value)} placeholder="Parent/Guardian" required className="h-9 text-xs mt-1 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Guardian Phone <span className="text-red-500">*</span></Label>
                <Input value={iPhone} onChange={e => setIPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="09XXXXXXXXX" required maxLength={11} className="h-9 text-xs font-mono mt-1 rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs font-semibold">Age (Months)</Label><Input value={iAge} onChange={e => setIAge(e.target.value)} placeholder="e.g. 4" className="h-9 text-xs mt-1 rounded-xl" /></div>
              <div><Label className="text-xs font-semibold">Weight (kg)</Label><Input value={iWeight} onChange={e => setIWeight(e.target.value)} placeholder="e.g. 6.8" className="h-9 text-xs mt-1 rounded-xl" /></div>
              <div><Label className="text-xs font-semibold">Height (cm)</Label><Input value={iHeight} onChange={e => setIHeight(e.target.value)} placeholder="e.g. 62" className="h-9 text-xs mt-1 rounded-xl" /></div>
            </div>

            {/* DYNAMIC VACCINE TYPE SELECTOR */}
            <div className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <Label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Syringe size={13} className="text-blue-600" /> Vaccine Type &amp; Dose Number
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Select value={iVaccine} onValueChange={setIVaccine}>
                    <SelectTrigger className="h-9 text-xs bg-white rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {/* Dynamic vaccines from live inventory */}
                      {inventory
                        .filter(i => i.category === 'Vaccine (EPI)' || i.category === 'Pediatric Supply')
                        .map(v => (
                          <SelectItem key={v.id} value={v.item_name} disabled={v.stock <= 0}>
                            <div className="flex items-center justify-between gap-3 w-full text-xs">
                              <span>{v.item_name}</span>
                              <span className={`text-[10px] font-mono font-bold ${v.stock <= 0 ? 'text-red-500' : v.stock < 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                ({v.stock} {v.unit})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      {/* Fallback standard vaccines if inventory is empty */}
                      {inventory.filter(i => i.category === 'Vaccine (EPI)' || i.category === 'Pediatric Supply').length === 0 && (
                        <>
                          <SelectItem value="BCG (Birth)">BCG (Birth)</SelectItem>
                          <SelectItem value="Hepatitis B (Birth)">Hepatitis B (Birth)</SelectItem>
                          <SelectItem value="Pentavalent (DPT-HepB-Hib)">Pentavalent (DPT-HepB-Hib)</SelectItem>
                          <SelectItem value="Oral Polio Vaccine (OPV)">OPV (Oral Polio)</SelectItem>
                          <SelectItem value="Inactivated Polio (IPV)">IPV (Inactivated Polio)</SelectItem>
                          <SelectItem value="Pneumococcal Conjugate (PCV13)">PCV13 Conjugate</SelectItem>
                          <SelectItem value="Measles, Mumps, Rubella (MMR)">MMR Vaccine</SelectItem>
                          <SelectItem value="Rotavirus">Rotavirus</SelectItem>
                        </>
                      )}
                      <SelectItem value="Other">Other / Custom Vaccine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={iDose} onValueChange={setIDose}>
                    <SelectTrigger className="h-9 text-xs bg-white rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dose 1">Dose 1 (Initial)</SelectItem>
                      <SelectItem value="Dose 2">⭐ Dose 2 (Secondary)</SelectItem>
                      <SelectItem value="Dose 3">Dose 3 (Tertiary)</SelectItem>
                      <SelectItem value="Booster 1">Booster Dose 1</SelectItem>
                      <SelectItem value="Single Dose">Single Dose</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {iVaccine === 'Other' && (
                <div className="pt-1">
                  <Input
                    value={iCustomVaccine}
                    onChange={e => setICustomVaccine(e.target.value)}
                    placeholder="Type custom vaccine name (e.g. Japanese Encephalitis, HPV)..."
                    className="h-8 text-xs bg-white rounded-lg border-slate-200"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs font-semibold">Batch / Lot #</Label><Input value={iBatch} onChange={e => setIBatch(e.target.value)} placeholder="e.g. LOT-2026-X9" className="h-9 text-xs font-mono mt-1 rounded-xl" /></div>
              <div><Label className="text-xs font-semibold">Date Administered</Label><Input type="date" value={iDateGiven} onChange={e => setIDateGiven(e.target.value)} className="h-9 text-xs mt-1 rounded-xl" /></div>
              <div><Label className="text-xs font-semibold">Next Due Date</Label><Input type="date" value={iNextDue} onChange={e => setINextDue(e.target.value)} className="h-9 text-xs mt-1 rounded-xl" /></div>
            </div>

            {/* DYNAMIC REMARKS WITH QUICK TAG PILLS */}
            <div className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800">Dynamic Remarks &amp; Observations</Label>
                <span className="text-[10px] text-slate-400">Click pill to append</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  'Cleared / No adverse reaction',
                  'Mild low-grade fever / Given Paracetamol',
                  'Left deltoid / Normal erythema',
                  'Catch-up dose administered'
                ].map(tag => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => setIRemarks(prev => prev ? `${prev}. ${tag}` : tag)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white hover:bg-blue-100 text-slate-700 border border-slate-200 cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
              <textarea
                value={iRemarks}
                onChange={e => setIRemarks(e.target.value)}
                rows={2}
                className="w-full text-xs p-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none mt-1"
                placeholder="Post-vaccine observation notes..."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsNewImmunOpen(false)} className="text-xs rounded-xl">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1 cursor-pointer rounded-xl px-4">
                <Check size={13} /> Save Immunization Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Inventory Modal */}
      <Dialog open={isInventoryOpen} onOpenChange={setIsInventoryOpen}>
        <DialogContent className="bg-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900"><Package className="text-emerald-600" size={18} /> Add Inventory Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddInventory} className="space-y-3 py-2">
            <div><Label className="text-xs font-semibold">Item Name <span className="text-red-500">*</span></Label><Input value={invName} onChange={e => setInvName(e.target.value)} placeholder="e.g. Pentavalent Vaccine" required className="h-9 text-xs mt-1 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs font-semibold">Category</Label>
                <Select value={invCat} onValueChange={setInvCat}>
                  <SelectTrigger className="h-9 text-xs mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Vaccine (EPI)', 'Maternal Vitamin', 'Essential Medicine', 'Pediatric Supply', 'Family Planning', 'TB-DOTS Supply', 'Other'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs font-semibold">Unit</Label>
                <Select value={invUnit} onValueChange={setInvUnit}>
                  <SelectTrigger className="h-9 text-xs mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['vials', 'tablets', 'capsules', 'packets', 'bottles', 'ampoules', 'units'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs font-semibold">Stock Quantity <span className="text-red-500">*</span></Label><Input type="number" min="0" value={invStock} onChange={e => setInvStock(e.target.value)} placeholder="e.g. 45" required className="h-9 text-xs mt-1 rounded-xl" /></div>
              <div><Label className="text-xs font-semibold">Expiry Date</Label><Input type="date" value={invExpiry} onChange={e => setInvExpiry(e.target.value)} className="h-9 text-xs mt-1 rounded-xl" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsInventoryOpen(false)} className="text-xs rounded-xl">Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 font-bold cursor-pointer rounded-xl"><Check size={13} /> Save Item</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Restock Inventory Modal */}
      <Dialog open={isRestockOpen} onOpenChange={setIsRestockOpen}>
        <DialogContent className="bg-white max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <PlusCircle className="text-emerald-600" size={18} /> Restock Item
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Add new stock received from RHU or DOH supply allocation.
            </DialogDescription>
          </DialogHeader>
          {restockTargetItem && (
            <form onSubmit={handleRestockSubmit} className="space-y-3 py-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <p className="text-xs font-bold text-slate-800">{restockTargetItem.item_name}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Current Stock:</span>
                  <span className="font-mono font-bold text-slate-900">{restockTargetItem.stock} {restockTargetItem.unit}</span>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Quantity to Add ({restockTargetItem.unit}) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="1"
                  value={restockQty}
                  onChange={e => setRestockQty(e.target.value)}
                  placeholder="e.g. 20"
                  required
                  className="h-9 text-xs mt-1 rounded-xl font-mono"
                  autoFocus
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsRestockOpen(false)} className="text-xs rounded-xl">Cancel</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 font-bold cursor-pointer rounded-xl">
                  <Check size={13} /> Confirm Restock
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Post Weekly Schedule Modal */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="bg-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900"><CalendarCheck className="text-violet-600" size={18} /> Post Weekly Clinic Schedule</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePostSchedule} className="space-y-3 py-2">
            <div><Label className="text-xs font-semibold">Clinic Title <span className="text-red-500">*</span></Label><Input value={sTitle} onChange={e => setSTitle(e.target.value)} placeholder="e.g. Prenatal Care Clinic" required className="h-9 text-xs mt-1 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs font-semibold">Service Type</Label>
                <Select value={sService} onValueChange={setSService}>
                  <SelectTrigger className="h-9 text-xs mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Prenatal Care', 'Child Immunization', 'General Consultation', 'Adolescent Health', 'Family Planning'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs font-semibold">Day of Week</Label>
                <Select value={sDay} onValueChange={setSDay}>
                  <SelectTrigger className="h-9 text-xs mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Every Monday', 'Every Tuesday', 'Every Wednesday', 'Every Thursday', 'Every Friday', 'Every Monday & Thursday', 'Every Tuesday & Friday'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs font-semibold">Operating Hours / Time Slot</Label><Input value={sTime} onChange={e => setSTime(e.target.value)} placeholder="8:00 AM – 12:00 PM" className="h-9 text-xs mt-1 rounded-xl" /></div>
            <div><Label className="text-xs font-semibold">Location</Label><Input value={sLocation} onChange={e => setSLocation(e.target.value)} className="h-9 text-xs mt-1 rounded-xl" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsScheduleOpen(false)} className="text-xs rounded-xl">Cancel</Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white text-xs gap-1 font-bold cursor-pointer rounded-xl"><Check size={13} /> Post Schedule</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Modal */}
      <Dialog open={isEditScheduleOpen} onOpenChange={setIsEditScheduleOpen}>
        <DialogContent className="bg-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900"><Edit2 className="text-violet-600" size={18} /> Edit Clinic Operating Hours</DialogTitle>
          </DialogHeader>
          {editingSchedule && (
            <form onSubmit={handleUpdateSchedule} className="space-y-3 py-2">
              <div><Label className="text-xs font-semibold">Title</Label><Input value={editingSchedule.title} onChange={e => setEditingSchedule({ ...editingSchedule, title: e.target.value })} className="h-9 text-xs mt-1 rounded-xl" /></div>
              <div><Label className="text-xs font-semibold">Day</Label><Input value={editingSchedule.day} onChange={e => setEditingSchedule({ ...editingSchedule, day: e.target.value })} className="h-9 text-xs mt-1 rounded-xl" /></div>
              <div><Label className="text-xs font-semibold">Operating Hours</Label><Input value={editingSchedule.time_slot} onChange={e => setEditingSchedule({ ...editingSchedule, time_slot: e.target.value })} className="h-9 text-xs mt-1 rounded-xl" /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditScheduleOpen(false)} className="text-xs rounded-xl">Cancel</Button>
                <Button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white text-xs gap-1 font-bold cursor-pointer rounded-xl"><Save size={13} /> Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Compose Custom SMS Alert Modal */}
      <Dialog open={isSendSmsModalOpen} onOpenChange={setIsSendSmsModalOpen}>
        <DialogContent className="bg-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Send className="text-teal-600" size={18} /> Compose SMS Alert
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendCustomSms} className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Recipient Patient Name <span className="text-red-500">*</span></Label>
              <Input value={composeRecipient} onChange={e => setComposeRecipient(e.target.value)} placeholder="e.g. Maria Clara Santos" required className="h-9 text-xs mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Mobile Phone (11 Digits) <span className="text-red-500">*</span></Label>
              <Input value={composePhone} onChange={e => setComposePhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="09XXXXXXXXX" required maxLength={11} className="h-9 text-xs font-mono mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Message Text <span className="text-red-500">*</span></Label>
              <textarea value={composeMessage} onChange={e => setComposeMessage(e.target.value)} rows={3} required placeholder="Barangay Health Center: Reminder regarding your clinic appointment..." className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-teal-500" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSendSmsModalOpen(false)} className="text-xs rounded-xl">Cancel</Button>
              <Button type="submit" className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold gap-1.5 cursor-pointer rounded-xl">
                <Send size={13} /> Dispatch SMS
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm & Schedule Appointment Modal */}
      <Dialog open={isApptModalOpen} onOpenChange={setIsApptModalOpen}>
        <DialogContent className="bg-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <CalendarCheck className="text-violet-600" size={20} />
              Confirm &amp; Schedule Resident Appointment
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Set the confirmed date, time slot, and preparation notes. The resident will receive automated notifications.
            </DialogDescription>
          </DialogHeader>
          {selectedAppt && (
            <form onSubmit={handleConfirmAppt} className="space-y-3.5 py-2">
              <div className="p-3 bg-violet-50/70 border border-violet-200/80 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-violet-950 text-sm">{selectedAppt.resident_name}</span>
                  <Badge className="bg-violet-200 text-violet-900 border-0 font-mono text-[10px]">
                    {selectedAppt.appointment_code}
                  </Badge>
                </div>
                <p className="text-slate-600 flex items-center gap-1.5 font-medium">
                  <Stethoscope size={13} className="text-violet-600" /> {selectedAppt.service_type}
                </p>
                {selectedAppt.resident_phone && (
                  <p className="text-slate-500 font-mono text-[11px] flex items-center gap-1.5">
                    <Phone size={12} className="text-violet-600" /> {selectedAppt.resident_phone}
                  </p>
                )}
                <p className="text-slate-500 text-[11px]">
                  <strong>Requested Window:</strong> 📅 {selectedAppt.preferred_date} {selectedAppt.preferred_time ? `(${selectedAppt.preferred_time})` : ''}
                </p>
                {selectedAppt.resident_notes && (
                  <p className="text-[11px] text-slate-600 bg-white/80 p-2 rounded-lg border border-violet-100 italic">
                    &ldquo;{selectedAppt.resident_notes}&rdquo;
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Confirmed Date <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={schedDate}
                    onChange={e => setSchedDate(e.target.value)}
                    required
                    className="h-9 text-xs mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Confirmed Time Slot <span className="text-red-500">*</span></Label>
                  <Select value={schedTime} onValueChange={setSchedTime}>
                    <SelectTrigger className="h-9 text-xs mt-1 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="08:00 AM">08:00 AM - Morning First Batch</SelectItem>
                      <SelectItem value="09:00 AM">09:00 AM - Morning Regular</SelectItem>
                      <SelectItem value="10:00 AM">10:00 AM - Mid Morning</SelectItem>
                      <SelectItem value="11:00 AM">11:00 AM - Late Morning</SelectItem>
                      <SelectItem value="01:30 PM">01:30 PM - Afternoon Session</SelectItem>
                      <SelectItem value="02:30 PM">02:30 PM - Mid Afternoon</SelectItem>
                      <SelectItem value="03:30 PM">03:30 PM - Late Afternoon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Nurse Instructions / Prep Notes for Resident</Label>
                <textarea
                  value={schedNotes}
                  onChange={e => setSchedNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Please bring valid ID, PhilHealth card, and maternal booklet if applicable. Fasting required for lab work."
                  className="w-full mt-1 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsApptModalOpen(false)} className="text-xs rounded-xl">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSchedulingLoading}
                  className="bg-violet-600 hover:bg-violet-700 text-white text-xs gap-1.5 font-bold cursor-pointer rounded-xl"
                >
                  <Check size={14} /> {isSchedulingLoading ? 'Saving...' : 'Confirm Slot & Notify'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
