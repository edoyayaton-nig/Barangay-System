import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Baby,
  Syringe,
  Heart,
  Bell,
  BarChart,
  BarChart2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  LogOut,
  Activity,
  Home,
  Menu,
  X,
  PlusCircle,
  CheckCircle2,
  Send,
  RefreshCcw,
  Search,
  PhoneCall,
  Calendar,
  Shield,
  Printer,
  Download,
  FileText,
  Eye,
  Check,
  CalendarCheck,
  MapPin,
  Users,
  CheckCircle,
  Clock,
  Sparkles,
  Archive,
  User,
  UserCheck,
  UserPlus,
  MessageSquare,
  Filter,
  HeartHandshake,
  Pill,
  Trash2,
  Package,
  ClipboardList,
  XCircle
} from 'lucide-react';
import { apiService, ImmunizationRecord, MaternalRecord, SmsNotification, DocumentRequest, HealthAppointment, ClinicSchedule, InventoryItem, Resident } from '../../services/api';
import SystemMessenger from '../components/SystemMessenger';
import ResidentProfileModal from '../components/ResidentProfileModal';
import DocumentPrintModal from '../components/DocumentPrintModal';
import DocumentInfoModal from '../components/DocumentInfoModal';
import SmsDetailsModal from '../components/SmsDetailsModal';
import SmartClinicalIntakeModal from '../components/SmartClinicalIntakeModal';
import GmailNotificationHub from '../components/GmailNotificationHub';
import ClinicalArchivesHub from '../components/ClinicalArchivesHub';
import ProfileSettingsView from '../components/ProfileSettingsView';
import BatchSmsReminderModal, { DuePatientItem } from '../components/BatchSmsReminderModal';
import CensusEntryTab from '../components/CensusEntryTab';
import { exportToCsv, printOfficialReport, downloadOfficialPdf } from '../../utils/exportCsv';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

export default function BhwDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Main content scroll container ref — auto-scroll to top on tab change
  const mainContentRef = useRef<HTMLElement>(null);

  // Scroll to top whenever the active sidebar tab changes
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeTab]);

  // User session state
  const [user, setUser] = useState<any>(null);
  const [isVisitorMode, setIsVisitorMode] = useState(false);

  // Dynamic Data States
  const [immunizations, setImmunizations] = useState<ImmunizationRecord[]>([]);
  const [maternalRecords, setMaternalRecords] = useState<MaternalRecord[]>([]);
  const [notifications, setNotifications] = useState<SmsNotification[]>([]);
  const [documents, setDocuments] = useState<DocumentRequest[]>([]);
  const [appointments, setAppointments] = useState<HealthAppointment[]>([]);
  const [clinicSchedules, setClinicSchedules] = useState<ClinicSchedule[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [bhwMSearchFocus, setBhwMSearchFocus] = useState(false);
  const [bhwCSearchFocus, setBhwCSearchFocus] = useState(false);

  // Clinical Intake & Profile Modal States
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Inventory State & Restock
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [restockTargetItem, setRestockTargetItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState('20');
  const [invName, setInvName] = useState('');
  const [invCat, setInvCat] = useState('Vaccine (EPI)');
  const [invStock, setInvStock] = useState('');
  const [invUnit, setInvUnit] = useState('vials');
  const [invExpiry, setInvExpiry] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('all');

  // Appointments & Schedules Sub-View & Filters
  const [apptSearch, setApptSearch] = useState('');
  const [apptStatusFilter, setApptStatusFilter] = useState('all');
  const [apptServiceFilter, setApptServiceFilter] = useState('all');
  const [selectedApptToSchedule, setSelectedApptToSchedule] = useState<HealthAppointment | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00 AM');
  const [scheduleBhwNotes, setScheduleBhwNotes] = useState('');

  // Post Clinic Schedule Modal State
  const [isPostScheduleOpen, setIsPostScheduleOpen] = useState(false);
  const [newScheduleTitle, setNewScheduleTitle] = useState('');
  const [newScheduleServiceType, setNewScheduleServiceType] = useState('Pre-Marriage Counseling (PMC)');
  const [newScheduleDay, setNewScheduleDay] = useState('Every Wednesday');
  const [newScheduleTime, setNewScheduleTime] = useState('8:30 AM - 11:30 AM');
  const [newScheduleLocation, setNewScheduleLocation] = useState('Barangay Pianing Health Center');
  const [newScheduleSlots, setNewScheduleSlots] = useState('20');
  const [newScheduleBhw, setNewScheduleBhw] = useState('Nurse Maria Santos');

  const [stats, setStats] = useState({
    childrenMonitored: 0,
    maternalRecords: 0,
    vaccinationsMonth: 0,
    overdueImmunizations: 0
  });

  // Document Info Modal State
  const [selectedInfoDoc, setSelectedInfoDoc] = useState<DocumentRequest | null>(null);
  const [isDocInfoOpen, setIsDocInfoOpen] = useState(false);

  // Document Print Modal State
  const [selectedPrintDoc, setSelectedPrintDoc] = useState<DocumentRequest | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const openDocInfo = (doc: DocumentRequest) => {
    setSelectedInfoDoc(doc);
    setIsDocInfoOpen(true);
  };

  const openPrintModal = (doc: DocumentRequest) => {
    setSelectedPrintDoc(doc);
    setPrintModalOpen(true);
  };

  // Resident Profile Modal
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState<number | null>(null);

  const openResidentProfile = (id: number) => {
    setSelectedResidentId(id);
    setProfileModalOpen(true);
  };

  // SMS Details Modal State
  const [selectedSms, setSelectedSms] = useState<SmsNotification | null>(null);
  const [isSmsDetailsOpen, setIsSmsDetailsOpen] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const openSmsDetails = (sms: SmsNotification) => {
    setSelectedSms(sms);
    setIsSmsDetailsOpen(true);
  };

  const handleMarkRead = async (id: number) => {
    try {
      await apiService.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all notifications as read');
    }
  };

  // Search & Filters
  const [immSearch, setImmSearch] = useState('');
  const [maternalSearch, setMaternalSearch] = useState('');
  const [docSearch, setDocSearch] = useState('');
  const [smsSearch, setSmsSearch] = useState('');
  const [smsFilterType, setSmsFilterType] = useState('all');
  const [immFilter, setImmFilter] = useState<'all' | 'dose1' | 'dose2' | 'dose3' | 'overdue'>('all');
  const [maternalFilter, setMaternalFilter] = useState<'all' | '1st' | '2nd' | 'high_risk' | 'due'>('all');

  // Modals state
  const [isAddImmOpen, setIsAddImmOpen] = useState(false);
  const [isAddMaternalOpen, setIsAddMaternalOpen] = useState(false);
  const [isSendSmsOpen, setIsSendSmsOpen] = useState(false);
  const [isBatchSmsOpen, setIsBatchSmsOpen] = useState(false);
  const [batchSmsInitialService, setBatchSmsInitialService] = useState<'Child Immunization' | 'Maternal Health'>('Child Immunization');

  // Child name split (First / Middle / Last)
  const [newChildFirstName, setNewChildFirstName] = useState('');
  const [newChildMiddleName, setNewChildMiddleName] = useState('');
  const [newChildLastName, setNewChildLastName] = useState('');
  const [newChildName, setNewChildName] = useState('');
  const [newChildGender, setNewChildGender] = useState<'Male' | 'Female'>('Male');
  const [newGuardianName, setNewGuardianName] = useState('');
  const [newParentPhone, setNewParentPhone] = useState('');
  const [newChildAge, setNewChildAge] = useState('6');
  const [newChildWeight, setNewChildWeight] = useState('7.8');
  const [newChildHeight, setNewChildHeight] = useState('66');
  const [newVaccineName, setNewVaccineName] = useState('Pentavalent (DPT-HepB-Hib)');
  const [newCustomVaccine, setNewCustomVaccine] = useState('');
  const [newDoseNumber, setNewDoseNumber] = useState('Dose 1');
  const [newBatchLot, setNewBatchLot] = useState(`LOT-${new Date().getFullYear()}-X9`);
  const [newDateGiven, setNewDateGiven] = useState(new Date().toISOString().split('T')[0]);
  const [newDueDate, setNewDueDate] = useState('');
  const [newRemarks, setNewRemarks] = useState('Cleared for routine vaccination');
  const [newImmStatus, setNewImmStatus] = useState('Completed');

  // Maternal Form states
  const [newMotherFirstName, setNewMotherFirstName] = useState('');
  const [newMotherMiddleName, setNewMotherMiddleName] = useState('');
  const [newMotherLastName, setNewMotherLastName] = useState('');
  const [newMotherName, setNewMotherName] = useState('');
  const [newMotherPhone, setNewMotherPhone] = useState('');
  const [newMotherAge, setNewMotherAge] = useState('28');
  const [newMotherVisitType, setNewMotherVisitType] = useState('1st Visit (Initial Booking)');
  const [newMotherGestationalWeeks, setNewMotherGestationalWeeks] = useState('14');
  const [newMotherBpSys, setNewMotherBpSys] = useState('110');
  const [newMotherBpDia, setNewMotherBpDia] = useState('70');
  const [newMotherWeight, setNewMotherWeight] = useState('56');
  const [newMotherFundicHeight, setNewMotherFundicHeight] = useState('16');
  const [newMotherFetalHeartTone, setNewMotherFetalHeartTone] = useState('142');
  const [newMotherIronSupplements, setNewMotherIronSupplements] = useState(true);
  const [newMotherNotes, setNewMotherNotes] = useState('Routine checkup, healthy fetal movement observed.');
  const [newPregnancyStatus, setNewPregnancyStatus] = useState('Prenatal - 1st Trimester');
  const [newNextVisit, setNewNextVisit] = useState('2026-05-20');
  const [newRiskLevel, setNewRiskLevel] = useState<'Low' | 'Moderate' | 'High'>('Low');

  // BP Evaluation Helper
  const getBpCategory = (sysStr: string, diaStr: string) => {
    const s = parseInt(sysStr, 10);
    const d = parseInt(diaStr, 10);
    if (!s || !d || isNaN(s) || isNaN(d)) return { label: 'Incomplete', color: 'bg-slate-100 text-slate-600' };
    if (s > 180 || d > 120) return { label: 'Hypertensive Crisis', color: 'bg-rose-600 text-white animate-pulse' };
    if (s >= 140 || d >= 90) return { label: 'Stage 2 HTN', color: 'bg-rose-500 text-white' };
    if ((s >= 130 && s <= 139) || (d >= 80 && d <= 89)) return { label: 'Stage 1 HTN', color: 'bg-amber-500 text-white' };
    if (s >= 120 && s <= 129 && d < 80) return { label: 'Elevated', color: 'bg-amber-400 text-slate-900' };
    if (s >= 90 && s < 120 && d >= 60 && d < 80) return { label: 'Normal', color: 'bg-emerald-500 text-white' };
    if (s < 90 || d < 60) return { label: 'Low BP', color: 'bg-blue-400 text-white' };
    return { label: 'Recorded', color: 'bg-slate-100 text-slate-700' };
  };

  const [smsRecipientName, setSmsRecipientName] = useState('');
  const [smsPhone, setSmsPhone] = useState('');
  const [smsType, setSmsType] = useState('Immunization Reminder');
  const [smsMessage, setSmsMessage] = useState('');

  const triggerHealthSync = () => {
    try {
      const ch = new BroadcastChannel('barangay_health_sync');
      ch.postMessage({ type: 'HEALTH_DATA_SYNC', timestamp: Date.now() });
      ch.close();
    } catch {}
  };

  const isHealthWorkerNotification = (n: SmsNotification) => {
    const type = (n.type || '').toLowerCase();
    const msg = (n.message || '').toLowerCase();
    // Strictly exclude administrative barangay office notifications (account verification, ID rejection, clearances)
    if (
      type.includes('account verified') ||
      type.includes('id correction') ||
      type.includes('verification') ||
      type.includes('clearance') ||
      type.includes('permit') ||
      type.includes('document ready') ||
      type.includes('pickup') ||
      msg.includes('resident account application') ||
      msg.includes('clearances, business permits') ||
      msg.includes('resubmit your valid id') ||
      msg.includes('application has been verified') ||
      msg.includes('application has been rejected')
    ) {
      return false;
    }
    return true;
  };

  // Load Data with silent real-time background sync support
  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [immData, matData, smsData, statsData, docsData, aptsData, schedulesData, invData, resData] = await Promise.all([
        apiService.getImmunizations().catch(() => []),
        apiService.getMaternalRecords().catch(() => []),
        apiService.getNotifications({ department: 'health', role: 'bhw' }).catch(() => []),
        apiService.getBhwStats().catch(() => null),
        apiService.getDocuments().catch(() => []),
        apiService.getAppointments().catch(() => []),
        apiService.getClinicSchedules().catch(() => []),
        apiService.getInventory(user?.barangay || 'Pianing').catch(() => []),
        apiService.getResidents(user?.barangay || 'Pianing').catch(() => [])
      ]);
      setImmunizations(immData || []);
      setMaternalRecords(matData || []);
      const healthOnlySms = (smsData || []).filter(isHealthWorkerNotification);
      setNotifications(healthOnlySms);
      if (statsData) setStats(statsData);
      setDocuments(docsData || []);
      setAppointments(aptsData || []);
      setClinicSchedules(schedulesData || []);
      setResidents(Array.isArray(resData) ? resData : []);
      if (invData && Array.isArray(invData)) {
        setInventory(invData);
      }
    } catch (err) {
      if (showLoading) toast.error('Failed to load health monitoring data');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleOpenScheduleModal = (apt: HealthAppointment) => {
    setSelectedApptToSchedule(apt);
    setScheduleDate(apt.scheduled_date || apt.preferred_date);
    setScheduleTime(apt.scheduled_time || '09:00 AM');
    setScheduleBhwNotes(apt.bhw_notes || `Confirmed slot for ${apt.service_type}. Please bring a valid ID.`);
    setIsScheduleModalOpen(true);
  };

  const handleApproveAndScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApptToSchedule) return;

    try {
      await apiService.updateAppointment(selectedApptToSchedule.id, {
        status: 'Approved',
        scheduled_date: scheduleDate,
        scheduled_time: scheduleTime,
        bhw_notes: scheduleBhwNotes,
        attending_bhw: user?.name || 'Nurse Maria Santos (BHW)',
        user_name: user?.name || 'Nurse Maria',
        user_role: user?.role || 'bhw'
      });

      toast.success('Appointment Approved & Confirmed!', {
        description: `📲 Auto-SMS & Email sent to ${selectedApptToSchedule.resident_name} for ${scheduleDate} at ${scheduleTime}.`
      });

      setIsScheduleModalOpen(false);
      setSelectedApptToSchedule(null);
      loadData();
      triggerHealthSync();
    } catch (err) {
      toast.error('Failed to update appointment schedule');
    }
  };

  const handleUpdateApptStatus = async (id: number, newStatus: 'Completed' | 'Cancelled', notes?: string) => {
    const apt = appointments.find(a => a.id === id);
    try {
      await apiService.updateAppointment(id, {
        status: newStatus,
        bhw_notes: notes || apt?.bhw_notes || (newStatus === 'Cancelled' ? 'Patient did not return for scheduled slot' : 'Visit completed successfully'),
        attending_bhw: user?.name || 'Nurse Maria Santos (BHW)',
        user_name: user?.name,
        user_role: user?.role
      });
      toast.success(newStatus === 'Cancelled' ? 'Appointment marked as Did Not Return / Cancelled & moved to Records' : `Appointment marked as ${newStatus}`);
      loadData();
      triggerHealthSync();
    } catch {
      toast.error(`Failed to mark appointment as ${newStatus}`);
    }
  };

  const handleCreateClinicSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduleTitle || !newScheduleDay || !newScheduleTime) {
      toast.error('Please fill in title, day of week, and time slot.');
      return;
    }

    try {
      await apiService.createClinicSchedule({
        title: newScheduleTitle,
        service_type: newScheduleServiceType,
        day_of_week: newScheduleDay,
        time_slot: newScheduleTime,
        location: newScheduleLocation || 'Barangay Pianing Health Center',
        slots_available: Number(newScheduleSlots) || 20,
        bhw_in_charge: newScheduleBhw || user?.name || 'Nurse Maria Santos',
        barangay: user?.barangay || 'Pianing',
        created_by: user?.name || 'BHW Staff'
      });

      toast.success('Clinic Schedule Published!', {
        description: 'Residents can now view this official schedule and book appointments.'
      });

      setIsPostScheduleOpen(false);
      setNewScheduleTitle('');
      loadData();
      triggerHealthSync();
    } catch {
      toast.error('Failed to post clinic schedule');
    }
  };

  const handleDeleteClinicSchedule = async (id: number) => {
    if (!confirm('Are you sure you want to remove this published clinic schedule?')) return;
    try {
      await apiService.deleteClinicSchedule(id);
      toast.success('Clinic schedule removed.');
      loadData();
      triggerHealthSync();
    } catch {
      toast.error('Failed to remove schedule');
    }
  };

  const handleUpdateDocStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'Pending' ? 'Processing' : 'Completed';
    const targetDoc = documents.find(d => d.id === id);
    const resName = targetDoc?.resident_name || 'Resident';

    try {
      await apiService.updateDocumentStatus(id, nextStatus, user?.name || 'Nurse Maria (BHW)');
      setDocuments(documents.map(d => d.id === id ? { ...d, status: nextStatus, processed_at: new Date().toLocaleDateString(), processed_by: user?.name || 'Nurse Maria (BHW)' } : d));
      
      if (nextStatus === 'Completed') {
        toast.success(`Health Document Approved & Ready for Release!`, {
          description: `📲 Auto-SMS sent to ${resName}: "Your certificate/clearance is approved & ready for pickup at the Health Center."`
        });
      } else {
        toast.info(`Request marked as ${nextStatus}`, {
          description: `📲 Auto-SMS sent to ${resName}: "Your request is now being processed."`
        });
      }
      loadData();
    } catch {
      toast.error('Failed to update status');
    }
  };

  useEffect(() => {
    // Load user session
    const storedUser = localStorage.getItem('barangay_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const role = (parsed.role || '').toLowerCase().trim();
        if (role !== 'bhw') {
          toast.error('Access Denied', {
            description: 'Admins and unauthorized roles cannot access the BHW Health Center Portal. Only BHW accounts are permitted.'
          });
          if (role === 'superadmin' || role === 'admin' || role === 'staff') {
            navigate('/admin');
          } else if (role === 'nurse') {
            navigate('/nurse');
          } else if (role === 'resident') {
            navigate('/resident');
          } else {
            navigate('/login');
          }
          return;
        }
        setUser(parsed);
      } catch (e) {
        navigate('/login');
        return;
      }
    } else {
      toast.error('Authentication Required', {
        description: 'Please sign in with your BHW account.'
      });
      navigate('/login');
      return;
    }
    loadData();

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('barangay_health_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'HEALTH_DATA_SYNC') {
          loadData(false);
        }
      };
    } catch {}

    const interval = setInterval(() => {
      loadData(false);
    }, 4000);

    return () => {
      if (channel) channel.close();
      clearInterval(interval);
    };
  }, [navigate]);

  // Handlers
  const handleCreateImmunization = async (e: React.FormEvent) => {
    e.preventDefault();
    // Combine split name fields
    const combinedChildName = [newChildFirstName.trim(), newChildMiddleName.trim(), newChildLastName.trim()].filter(Boolean).join(' ') || newChildName.trim();
    if (!combinedChildName) { toast.error("Child's first name and last name are required"); return; }
    if (!newGuardianName.trim()) { toast.error("Guardian name is required"); return; }
    if (!newParentPhone.trim()) { toast.error("Guardian phone number is required"); return; }

    const finalVaccine = newVaccineName === 'Other'
      ? (newCustomVaccine.trim() || 'Custom Vaccine')
      : newVaccineName;

    try {
      const payload: any = {
        child_name: combinedChildName,
        gender: newChildGender,
        guardian_name: newGuardianName.trim(),
        parent_phone: newParentPhone.trim(),
        contact_number: newParentPhone.trim(),
        age_months: newChildAge || '6',
        weight_kg: newChildWeight || '7.8',
        height_cm: newChildHeight || '66',
        vaccine_name: finalVaccine,
        dose_number: newDoseNumber,
        batch_lot: newBatchLot || `LOT-${new Date().getFullYear()}-X9`,
        date_administered: newDateGiven,
        date_given: newDateGiven,
        due_date: newDueDate || newDateGiven,
        next_due_date: newDueDate,
        remarks: newRemarks || 'Cleared for routine vaccination',
        administered_by: user?.name || 'BHW Maria',
        status: newDateGiven ? 'Completed' : 'Scheduled'
      };

      const created = await apiService.createImmunization(payload);

      // Immediate optimistic state update
      const newRec: ImmunizationRecord = {
        id: created?.id || Date.now(),
        child_name: payload.child_name,
        gender: payload.gender,
        guardian_name: payload.guardian_name,
        parent_phone: payload.parent_phone,
        vaccine_name: payload.vaccine_name,
        dose_number: payload.dose_number,
        date_administered: payload.date_administered,
        due_date: payload.due_date,
        status: payload.status,
        batch_lot: payload.batch_lot,
        remarks: payload.remarks,
        administered_by: payload.administered_by,
        barangay: user?.barangay || 'Pianing'
      };
      setImmunizations(prev => [newRec, ...prev]);

      // Deduct vaccine from local inventory stock
      setInventory(prev => prev.map(item => {
        if (item.item_name.toLowerCase().includes(finalVaccine.toLowerCase()) || finalVaccine.toLowerCase().includes(item.item_name.toLowerCase())) {
          const updatedStock = Math.max(0, item.stock - 1);
          return {
            ...item,
            stock: updatedStock,
            status: updatedStock === 0 ? 'Out of Stock' : updatedStock < 10 ? 'Low Stock' : 'In Stock'
          };
        }
        return item;
      }));

      toast.success(`Immunization for ${combinedChildName} saved & archived! Vaccine stock updated.`);
      setIsAddImmOpen(false);
      setNewChildName('');
      setNewChildFirstName('');
      setNewChildMiddleName('');
      setNewChildLastName('');
      setNewGuardianName('');
      setNewParentPhone('');
      setNewCustomVaccine('');
      setNewChildAge('6');
      setNewChildWeight('7.8');
      setNewChildHeight('66');
      setNewBatchLot(`LOT-${new Date().getFullYear()}-X9`);
      setNewDueDate('');
      setNewRemarks('Cleared for routine vaccination');
      loadData();
    } catch (err) {
      toast.error('Could not create immunization record');
    }
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName.trim()) { toast.error('Item name is required'); return; }
    const qty = parseInt(invStock) || 0;
    const payload: Partial<InventoryItem> = {
      barangay: user?.barangay || 'Pianing',
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
      triggerHealthSync();
    } catch {
      setInventory(prev => [{ id: Date.now(), ...payload } as any, ...prev]);
      toast.success(`${invName} added to local inventory`);
      triggerHealthSync();
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
      triggerHealthSync();
    } catch {
      setInventory(prev => prev.map(i => i.id === restockTargetItem.id ? { ...i, stock: newStock, status: newStatus } : i));
      toast.info(`Stock updated (+${addAmount})`);
      triggerHealthSync();
    }
    setIsRestockOpen(false);
    setRestockTargetItem(null);
  };

  const handleDeleteInventory = async (id: number | string) => {
    try {
      await apiService.deleteInventoryItem(id);
    } catch {}
    setInventory(prev => prev.filter(i => i.id !== id));
    toast.success('Inventory item removed');
    triggerHealthSync();
  };

  const handleMarkImmunizationComplete = async (id: number) => {
    try {
      await apiService.updateImmunization(id, 'Completed', user?.name || 'BHW Maria');
      setImmunizations(immunizations.map(i => i.id === id ? { ...i, status: 'Completed', date_administered: new Date().toISOString().split('T')[0], days_overdue: 0 } : i));
      toast.success('Immunization marked as completed');
      loadData();
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const handleCreateMaternalRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const combinedMotherName = [newMotherFirstName.trim(), newMotherMiddleName.trim(), newMotherLastName.trim()].filter(Boolean).join(' ') || newMotherName.trim();
    if (!combinedMotherName) { toast.error("Mother's first and last name are required"); return; }
    
    const bpReading = (newMotherBpSys && newMotherBpDia) ? `${newMotherBpSys}/${newMotherBpDia} mmHg` : '110/70 mmHg';

    try {
      const payload: any = {
        mother_name: combinedMotherName,
        age: Number(newMotherAge) || 25,
        phone: newMotherPhone.trim() || '09171234567',
        contact_number: newMotherPhone.trim() || '09171234567',
        pregnancy_status: newMotherVisitType ? `${newMotherVisitType} (${newPregnancyStatus})` : newPregnancyStatus,
        visit_type: newMotherVisitType,
        blood_pressure: bpReading,
        gestational_age_weeks: newMotherGestationalWeeks,
        weight_kg: newMotherWeight,
        fundic_height: newMotherFundicHeight,
        fetal_heart_tone: newMotherFetalHeartTone,
        iron_supplementation: newMotherIronSupplements ? 'Provided' : 'Not Provided',
        clinical_notes: newMotherNotes,
        last_visit: new Date().toISOString().split('T')[0],
        next_visit: newNextVisit,
        next_visit_date: newNextVisit,
        risk_level: newRiskLevel,
        attending_nurse: user?.name || 'BHW Health Worker'
      };

      const created = await apiService.createMaternalRecord(payload);

      // Immediate optimistic state update
      const newRec: MaternalRecord = {
        id: created?.id || Date.now(),
        mother_name: payload.mother_name,
        age: payload.age,
        pregnancy_status: payload.pregnancy_status,
        last_visit: payload.last_visit,
        next_visit: payload.next_visit,
        risk_level: payload.risk_level,
        attending_nurse: payload.attending_nurse,
        bp: payload.blood_pressure || payload.bp,
        blood_pressure: payload.blood_pressure,
        barangay: user?.barangay || 'Pianing'
      };
      setMaternalRecords(prev => [newRec, ...prev]);

      toast.success(`Maternal record for ${combinedMotherName} added to database!`);
      setIsAddMaternalOpen(false);
      setNewMotherFirstName('');
      setNewMotherMiddleName('');
      setNewMotherLastName('');
      setNewMotherName('');
      setNewMotherPhone('');
      setNewMotherNotes('Routine checkup, healthy fetal movement observed.');
      loadData();
    } catch (err) {
      toast.error('Could not add maternal record');
    }
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsRecipientName || !smsPhone) return;
    try {
      const sent = await apiService.sendNotification({
        recipient_name: smsRecipientName,
        recipient_phone: smsPhone,
        type: smsType,
        message: smsMessage || 'Reminder: Please visit the Barangay Health Center for scheduled checkup/vaccination.'
      });
      setNotifications([sent, ...notifications]);
      toast.success(`SMS Notification dispatched to ${smsPhone}`);
      setIsSendSmsOpen(false);
      setSmsRecipientName('');
      setSmsPhone('');
      setSmsMessage('');
    } catch (err) {
      toast.error('Failed to send SMS alert');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('barangay_user');
    toast.info('Logged out of BHW Portal');
    navigate('/login');
  };

  // Filtered Immunizations
  const filteredImmunizations = immunizations.filter(i => {
    const matchesSearch =
      i.child_name.toLowerCase().includes(immSearch.toLowerCase()) ||
      i.vaccine_name.toLowerCase().includes(immSearch.toLowerCase());
    const doseStr = String(i.dose_number || '').toLowerCase();
    const matchesFilter =
      immFilter === 'all' ? true :
      immFilter === 'dose1' ? doseStr.includes('1') :
      immFilter === 'dose2' ? doseStr.includes('2') :
      immFilter === 'dose3' ? (doseStr.includes('3') || doseStr.includes('booster')) :
      immFilter === 'overdue' ? i.status === 'Overdue' : true;
    return matchesSearch && matchesFilter;
  });

  // Filtered Maternal Records
  const filteredMaternalRecords = maternalRecords.filter(m => {
    const matchesSearch =
      m.mother_name.toLowerCase().includes(maternalSearch.toLowerCase()) ||
      (m.pregnancy_status || '').toLowerCase().includes(maternalSearch.toLowerCase());
    const is2nd = (m.pregnancy_status || '').toLowerCase().includes('2nd') ||
                  ((m as any).visit_type || '').includes('2nd') ||
                  (m as any).visit_number === 2;
    const is1st = (m.pregnancy_status || '').toLowerCase().includes('1st') ||
                  ((m as any).visit_type || '').includes('1st') ||
                  (m as any).visit_number === 1;
    const matchesFilter =
      maternalFilter === 'all' ? true :
      maternalFilter === '1st' ? is1st :
      maternalFilter === '2nd' ? is2nd :
      maternalFilter === 'high_risk' ? m.risk_level === 'High' :
      maternalFilter === 'due' ? (m.next_visit && new Date(m.next_visit) <= new Date(Date.now() + 7 * 86400000)) : true;
    return matchesSearch && matchesFilter;
  });

  // Due SMS Items Pool
  const dueSmsItems: DuePatientItem[] = [
    ...immunizations
      .filter(i => i.status === 'Overdue' || (i.due_date && new Date(i.due_date) <= new Date(Date.now() + 7 * 86400000)))
      .map(i => ({
        id: `imm-${i.id}`,
        name: i.child_name,
        phone: i.parent_phone || '09226789012',
        service: 'Child Immunization',
        detail: `${i.vaccine_name} (${i.dose_number})`,
        dueDate: i.due_date || 'Due Soon',
        isOverdue: i.status === 'Overdue',
        category: 'immunization' as const,
        status: (i.status === 'Overdue' ? 'Overdue' : 'Due Soon') as 'Overdue' | 'Due Soon'
      })),
    ...maternalRecords
      .filter(m => m.risk_level === 'High' || (m.next_visit && new Date(m.next_visit) <= new Date(Date.now() + 7 * 86400000)))
      .map(m => ({
        id: `mat-${m.id}`,
        name: m.mother_name,
        phone: (m as any).phone || (m as any).contact_number || '09171234567',
        service: 'Maternal Health',
        detail: (m as any).visit_type || m.pregnancy_status || 'Routine Visit',
        dueDate: m.next_visit || 'Upcoming',
        isOverdue: m.risk_level === 'High',
        category: 'maternal' as const,
        status: (m.risk_level === 'High' ? 'Overdue' : 'Due Soon') as 'Overdue' | 'Due Soon'
      }))
  ];

  const filteredNotifications = notifications.filter(n => {
    if (!isHealthWorkerNotification(n)) return false;
    const matchesSearch =
      (n.recipient_name || '').toLowerCase().includes(smsSearch.toLowerCase()) ||
      (n.recipient_phone || '').toLowerCase().includes(smsSearch.toLowerCase()) ||
      (n.message || '').toLowerCase().includes(smsSearch.toLowerCase());
    const matchesType = smsFilterType === 'all' || (n.type || '').toLowerCase().includes(smsFilterType.toLowerCase());
    return matchesSearch && matchesType;
  });

  const overdueVaccines = immunizations.filter(i => i.status === 'Overdue');
  const pendingAppointments = appointments.filter(a => (a.status || '').toLowerCase() === 'pending');

  const filteredAppointments = appointments.filter(a => {
    const matchesSearch =
      (a.appointment_code || '').toLowerCase().includes(apptSearch.toLowerCase()) ||
      (a.resident_name || '').toLowerCase().includes(apptSearch.toLowerCase()) ||
      (a.service_type || '').toLowerCase().includes(apptSearch.toLowerCase()) ||
      (a.resident_phone || '').toLowerCase().includes(apptSearch.toLowerCase());
    const matchesStatus = apptStatusFilter === 'all' || (a.status || '').toLowerCase() === apptStatusFilter.toLowerCase();
    const cleanFilterService = apptServiceFilter.toLowerCase();
    const aService = (a.service_type || '').toLowerCase();
    const matchesService = apptServiceFilter === 'all' || 
      aService === cleanFilterService ||
      aService.includes(cleanFilterService) ||
      cleanFilterService.includes(aService);
    return matchesSearch && matchesStatus && matchesService;
  });

  const filteredInventory = inventory.filter(item => {
    const matchesSearch =
      (item.item_name || '').toLowerCase().includes(inventorySearch.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(inventorySearch.toLowerCase());
    const matchesCat = inventoryCategoryFilter === 'all' || item.category === inventoryCategoryFilter;
    return matchesSearch && matchesCat;
  });

  // Auto-fill logic for Maternal Mother Name in BHW
  const bhwMSearchQuery = `${newMotherFirstName} ${newMotherLastName}`.trim().toLowerCase();
  const bhwMatchingMothers = useMemo(() => {
    if (!bhwMSearchQuery || bhwMSearchQuery.length < 2) return [];
    const queryParts = bhwMSearchQuery.split(/\s+/).filter(Boolean);
    return residents.filter(r => {
      const fullName = `${r.first_name} ${r.middle_name ? r.middle_name + ' ' : ''}${r.last_name}`.toLowerCase();
      const matchesAll = queryParts.length > 0 && queryParts.every(part => fullName.includes(part));
      return matchesAll || fullName.includes(bhwMSearchQuery) || (r.last_name || '').toLowerCase().includes(bhwMSearchQuery);
    }).slice(0, 5);
  }, [residents, bhwMSearchQuery]);

  const selectBhwMatchedMother = (m: Resident) => {
    setNewMotherFirstName(m.first_name);
    setNewMotherMiddleName(m.middle_name || '');
    setNewMotherLastName(m.last_name);
    if (m.phone) setNewMotherPhone(m.phone);
    if ((m as any).age != null) {
      setNewMotherAge(String((m as any).age));
    } else if (m.date_of_birth) {
      const ageYears = Math.floor((Date.now() - new Date(m.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (!isNaN(ageYears) && ageYears > 0) setNewMotherAge(String(ageYears));
    }
    toast.success(`Auto-filled details for ${m.first_name} ${m.last_name} from Census Registry!`);
    setBhwMSearchFocus(false);
  };

  // Auto-fill logic for Child Vaccination in BHW
  const bhwCSearchQuery = `${newChildFirstName} ${newChildLastName}`.trim().toLowerCase();
  const bhwMatchingChildren = useMemo(() => {
    if (!bhwCSearchQuery || bhwCSearchQuery.length < 2) return [];
    const queryParts = bhwCSearchQuery.split(/\s+/).filter(Boolean);
    return residents.filter(r => {
      const fullName = `${r.first_name} ${r.middle_name ? r.middle_name + ' ' : ''}${r.last_name}`.toLowerCase();
      const matchesAll = queryParts.length > 0 && queryParts.every(part => fullName.includes(part));
      return matchesAll || fullName.includes(bhwCSearchQuery) || (r.last_name || '').toLowerCase().includes(bhwCSearchQuery);
    }).slice(0, 5);
  }, [residents, bhwCSearchQuery]);

  const selectBhwMatchedChild = (c: Resident) => {
    setNewChildFirstName(c.first_name);
    setNewChildMiddleName(c.middle_name || '');
    setNewChildLastName(c.last_name);
    if (c.gender === 'Female' || c.gender === 'Male') {
      setNewChildGender(c.gender);
    }
    if (c.phone) setNewParentPhone(c.phone);
    if (c.household_number) {
      const familyMembers = residents.filter(r => r.household_number === c.household_number && r.id !== c.id);
      const head = familyMembers.find(m => m.is_head_of_household) || familyMembers[0];
      if (head) {
        setNewGuardianName(`${head.first_name} ${head.last_name}`);
        if (head.phone && !c.phone) setNewParentPhone(head.phone);
      }
    }
    toast.success(`Auto-filled details for ${c.first_name} ${c.last_name} from Census Registry!`);
    setBhwCSearchFocus(false);
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'appointments', label: 'Appointments & Schedules', icon: CalendarCheck },
    { id: 'immunization', label: 'Immunization Tracking', icon: Syringe },
    { id: 'maternal', label: 'Maternal Health', icon: Heart },
    { id: 'inventory', label: 'Vaccines & Medicine Supply', icon: Pill },
    { id: 'records', label: 'Records', icon: ClipboardList },
    { id: 'census', label: 'Populations & Census Registry', icon: Users },
    { id: 'notifications', label: 'Gmail Notification Hub', icon: Bell },
    { id: 'reports', label: 'Health Reports & Analytics', icon: BarChart },
    { id: 'profile', label: 'Profile Settings', icon: UserCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-3 sm:px-6 py-2.5 shadow-xs">
        <div className="flex items-center justify-between w-full">
          {/* Left: Mobile Burger Button + Barangay Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Burger menu button: visible ONLY on cellphone and tablet (< 1024px) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 rounded-xl cursor-pointer lg:hidden focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              aria-label="Open BHW navigation menu"
              title="Navigation Menu"
            >
              <Menu size={22} />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-white shadow-xs border border-blue-200 flex items-center justify-center shrink-0">
                <img src="/assets/pianing-logo.png" alt="Barangay Pianing" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Barangay Pianing</h1>
                <span className="text-xs text-blue-600 font-semibold">BHW Health Portal</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(v => !v)}
                className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <Bell size={18} />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {notifications.filter(n => !n.is_read).length > 99 ? '99+' : notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </button>
              {showNotifDropdown && (
                <div className="absolute right-0 top-10 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Notifications</span>
                    <div className="flex items-center gap-2">
                      {notifications.filter(n => !n.is_read).length > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[10px] text-blue-600 hover:underline font-semibold"
                        >
                          Mark all read
                        </button>
                      )}
                      <button onClick={() => setShowNotifDropdown(false)} className="text-slate-400 hover:text-slate-700">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No notifications yet</p>
                    ) : notifications.slice(0, 8).map(n => (
                      <div
                        key={n.id}
                        className={`flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${!n.is_read ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''}`}
                        onClick={() => { openSmsDetails(n); setShowNotifDropdown(false); }}
                      >
                        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${!n.is_read ? 'bg-blue-500' : 'bg-slate-300'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-semibold truncate ${!n.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                            {n.recipient_name || 'Resident'} — {n.type || 'Notification'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{n.message}</p>
                        </div>
                        {!n.is_read && (
                          <button
                            onClick={e => { e.stopPropagation(); handleMarkRead(n.id); }}
                            className="text-[9px] text-blue-600 hover:underline shrink-0"
                          >
                            Read
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      className="text-xs text-blue-600 hover:underline w-full text-center font-medium"
                      onClick={() => { setActiveTab('notifications'); setShowNotifDropdown(false); }}
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              BHW Station Active
            </span>
          </div>
        </div>
        </div>
      </header>

      {/* Mobile / Tablet Slide-over Navigation Drawer with Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl flex flex-col py-4 border-r border-slate-200 dark:border-slate-800 lg:hidden transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-white border border-blue-200 flex items-center justify-center shrink-0">
              <img src="/assets/pianing-logo.png" alt="Barangay Pianing" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">Barangay Pianing</span>
              <span className="text-[10px] text-blue-600 font-semibold">BHW Health Portal</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if ((item as any).action) {
                    (item as any).action();
                  } else {
                    setActiveTab(item.id);
                  }
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#EBF5FF] text-[#2563EB] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <item.icon size={18} className={`shrink-0 ${isActive ? 'text-[#2563EB]' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-3 px-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
          >
            <LogOut size={18} className="shrink-0 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Full-width container flush to the left of the viewport (no side margin gap) */}
      <div className="flex-1 flex w-full">
        {/* Permanent Desktop Sidebar pinned to left edge (hidden on mobile/tablet) */}
        <aside className="hidden lg:flex w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col py-4 sticky top-[57px] h-[calc(100vh-57px)]">
          <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if ((item as any).action) {
                      (item as any).action();
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#EBF5FF] text-[#2563EB] shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <item.icon size={18} className={`shrink-0 ${isActive ? 'text-[#2563EB]' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Fixed Bottom Logout */}
          <div className="mt-auto pt-3 px-3 border-t border-slate-200/90 dark:border-slate-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer group"
              title="Sign out of account"
            >
              <LogOut size={18} className="shrink-0 text-rose-500 group-hover:text-rose-700" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main ref={mainContentRef} className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
          {isVisitorMode && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-amber-900">Visitor Preview Mode</h3>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    You are currently previewing the Barangay Health Worker (BHW) portal. Recording vaccinations, creating maternal logs, and sending SMS reminders are locked in read-only preview.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => navigate('/login')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9 px-4 shrink-0 shadow-sm"
              >
                Log In as BHW
              </Button>
            </div>
          )}
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Barangay Health Monitoring Dashboard</h2>
                  <p className="text-xs text-slate-500">Maternal care, infant immunization tracking, and resident health alert dispatch.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsIntakeOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm rounded-xl cursor-pointer"
                  >
                    <PlusCircle size={15} />
                    <span>+ Add Patient (Intake)</span>
                  </Button>
                  <Button
                    onClick={() => setIsAddImmOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-sm rounded-xl cursor-pointer"
                  >
                    <Syringe size={15} />
                    <span>Record Vaccination</span>
                  </Button>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-200 bg-white shadow-xs">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <Baby size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Children Monitored</p>
                      <h3 className="text-2xl font-bold text-slate-900">{stats.childrenMonitored}</h3>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-xs">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                      <Heart size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Maternal Records</p>
                      <h3 className="text-2xl font-bold text-slate-900">{stats.maternalRecords}</h3>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-xs">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Syringe size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Vaccinations Completed</p>
                      <h3 className="text-2xl font-bold text-slate-900">{stats.vaccinationsMonth}</h3>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-xs">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Overdue Immunizations</p>
                      <h3 className="text-2xl font-bold text-slate-900">{overdueVaccines.length || stats.overdueImmunizations}</h3>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ═══ SECTION: ACTION REQUIRED - NEW APPOINTMENT REQUESTS ═══ */}
              {pendingAppointments.length > 0 && (
                <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-5 shadow-xs animate-in fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-3 border-b border-amber-200/70">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                      </span>
                      <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                        <CalendarCheck className="text-amber-700" size={17} />
                        New Appointment Requests Awaiting BHW Action ({pendingAppointments.length})
                      </h3>
                    </div>
                    <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold uppercase tracking-wider">
                      Needs Slot Confirmation
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pendingAppointments.slice(0, 6).map(apt => (
                      <div key={`ov-pending-${apt.id}`} className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-all">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-xs text-slate-900 truncate">{apt.resident_name}</span>
                            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                              {apt.appointment_code}
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold text-slate-700">{apt.service_type}</p>
                          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                            <span>📅 Preferred:</span>
                            <strong className="text-slate-700">{apt.preferred_date}</strong>
                            <span>• {apt.preferred_time || 'Morning'}</span>
                          </p>
                          {apt.resident_phone && (
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">📞 {apt.resident_phone}</p>
                          )}
                          {apt.resident_notes && (
                            <p className="text-[10px] text-slate-500 italic mt-1 bg-slate-50 p-1 rounded border border-slate-100 line-clamp-1" title={apt.resident_notes}>
                              "{apt.resident_notes}"
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleOpenScheduleModal(apt)}
                          className="w-full mt-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold h-8 rounded-lg shadow-xs cursor-pointer"
                        >
                          Review &amp; Confirm Slot
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ═══ SECTION: BHW FIELD HEALTH ANALYTICS & COMMUNITY INTELLIGENCE ═══ */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <BarChart2 className="text-emerald-600" size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">BHW Field Analytics &amp; Health Intelligence</h3>
                      <p className="text-xs text-slate-500">Live operational metrics and community coverage status for Barangay {user?.barangay || 'Pianing'}.</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('reports')}
                    className="text-xs h-8 border-slate-200 cursor-pointer rounded-xl text-slate-600 hover:text-slate-900"
                  >
                    View Detailed Reports &rarr;
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* EPI Immunization Progress */}
                  {(() => {
                    const completedDoses = immunizations.filter(i => i.status === 'Completed').length;
                    const totalScheduled = immunizations.length || 1;
                    const rate = Math.min(100, Math.round((completedDoses / totalScheduled) * 100));
                    return (
                      <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-700">EPI Immunization Coverage</span>
                            <Syringe size={15} className="text-blue-600" />
                          </div>
                          <p className="text-2xl font-black text-blue-700">{rate}%</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{completedDoses} administered of {totalScheduled} target doses</p>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 mt-3">
                          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${rate}%` }} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Maternal Health Risk Breakdown */}
                  {(() => {
                    const high = maternalRecords.filter(m => m.risk_level === 'High').length;
                    const moderate = maternalRecords.filter(m => m.risk_level === 'Moderate').length;
                    const low = maternalRecords.filter(m => m.risk_level === 'Low' || !m.risk_level).length;
                    return (
                      <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-700">Maternal Health Risk</span>
                            <Heart size={15} className="text-pink-600" />
                          </div>
                          <p className="text-2xl font-black text-pink-700">{maternalRecords.length}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Mothers currently under active care</p>
                        </div>
                        <div className="flex gap-1.5 mt-3">
                          <span className="text-[10px] bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.5 rounded font-bold">{high} High</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold">{moderate} Mod</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">{low} Low</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Appointment Fulfillment Pipeline */}
                  {(() => {
                    const confirmed = appointments.filter(a => (a.status || '').toLowerCase() === 'approved' || (a.status || '').toLowerCase() === 'completed').length;
                    const total = appointments.length;
                    const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
                    return (
                      <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-700">Appointment Fulfillment</span>
                            <CalendarCheck size={15} className="text-emerald-600" />
                          </div>
                          <p className="text-2xl font-black text-emerald-700">{pct}%</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{confirmed} confirmed of {total} requested visits</p>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 mt-3">
                          <div className="bg-emerald-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Automated SMS Health Alerts */}
                  {(() => {
                    const sent = notifications.filter(n => n.status === 'Sent' || !n.status).length;
                    const pending = notifications.filter(n => n.status === 'Pending').length;
                    return (
                      <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-700">SMS Health Reminders</span>
                            <Bell size={15} className="text-purple-600" />
                          </div>
                          <p className="text-2xl font-black text-purple-700">{notifications.length}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Health alert dispatches sent to residents</p>
                        </div>
                        <div className="flex gap-1.5 mt-3">
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">{sent} Sent</span>
                          {pending > 0 && <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold">{pending} Pending</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB: HEALTH CENTER APPOINTMENTS & CLINIC SCHEDULES */}
          {activeTab === 'appointments' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Health Center Appointments &amp; Schedules</h2>
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      {appointments.length} Total
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Review and confirm resident appointment requests for General Consultation, <strong>Pre-Marriage Counseling (PMC)</strong>, Prenatal Care, Immunizations, and Family Planning.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setIsPostScheduleOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm cursor-pointer"
                  >
                    <PlusCircle size={15} />
                    Post Clinic Schedule
                  </Button>
                </div>
              </div>

              {/* Quick Stat Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Pending Review</span>
                  <span className="text-2xl font-black text-amber-600">
                    {pendingAppointments.length}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Confirmed / Approved</span>
                  <span className="text-2xl font-black text-emerald-600">
                    {appointments.filter(a => (a.status || '').toLowerCase() === 'approved').length}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Completed Visits</span>
                  <span className="text-2xl font-black text-blue-600">
                    {appointments.filter(a => (a.status || '').toLowerCase() === 'completed').length}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Active Clinic Programs</span>
                  <span className="text-2xl font-black text-purple-600">
                    {clinicSchedules.length}
                  </span>
                </div>
              </div>

              {/* ACTION REQUIRED: Pending Appointment Requests Callout */}
              {pendingAppointments.length > 0 && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                      <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                        Action Required: New Incoming Resident Appointment Requests ({pendingAppointments.length})
                      </h3>
                    </div>
                    <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px]">
                      Awaiting Health Worker Confirmation
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pendingAppointments.map(apt => (
                      <div key={`incoming-${apt.id}`} className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-xs text-slate-900 truncate">{apt.resident_name}</span>
                            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                              {apt.appointment_code}
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold text-slate-700">{apt.service_type}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">📅 Preferred: {apt.preferred_date} • ⏰ {apt.preferred_time || 'Morning'}</p>
                          {apt.resident_phone && <p className="text-[10px] text-slate-400 font-mono">📞 {apt.resident_phone}</p>}
                          {apt.resident_notes && (
                            <p className="text-[10px] text-slate-500 italic mt-1 truncate" title={apt.resident_notes}>Note: {apt.resident_notes}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleOpenScheduleModal(apt)}
                          className="mt-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold h-8 rounded-lg shadow-xs cursor-pointer w-full"
                        >
                          Review &amp; Schedule Slot
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-2 justify-between">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <Input
                      placeholder="Search resident name, ref code, or service..."
                      value={apptSearch}
                      onChange={e => setApptSearch(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>

                  <Select value={apptServiceFilter} onValueChange={setApptServiceFilter}>
                    <SelectTrigger className="w-[180px] h-9 text-xs">
                      <SelectValue placeholder="All Services" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      <SelectItem value="General">General Consultation</SelectItem>
                      <SelectItem value="Prenatal">Prenatal Check-up / Care</SelectItem>
                      <SelectItem value="Immunization">Child Immunization</SelectItem>
                      <SelectItem value="Family Planning">Family Planning</SelectItem>
                      <SelectItem value="Pre-Marriage">Pre-Marriage Counseling (PMC)</SelectItem>
                      <SelectItem value="Home Visit">BHW Home Visit</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={apptStatusFilter} onValueChange={setApptStatusFilter}>
                    <SelectTrigger className="w-[130px] h-9 text-xs">
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

              {/* Appointments Table */}
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CalendarCheck className="text-emerald-600" size={16} />
                    Incoming &amp; Confirmed Resident Appointments
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Ref Code</TableHead>
                        <TableHead className="text-xs">Resident Details</TableHead>
                        <TableHead className="text-xs">Program / Service</TableHead>
                        <TableHead className="text-xs">Requested Window</TableHead>
                        <TableHead className="text-xs">Confirmed Slot</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAppointments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-xs py-10 text-slate-400">
                            <CalendarCheck className="mx-auto mb-2 text-slate-300" size={24} />
                            No appointment requests found matching your filter criteria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAppointments.map(apt => (
                          <TableRow key={apt.id} className="text-xs">
                            <TableCell className="font-mono font-bold text-emerald-700">
                              {apt.appointment_code}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-slate-900">{apt.resident_name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{apt.resident_phone || 'No phone'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-slate-800">{apt.service_type}</div>
                              {apt.resident_notes && (
                                <div className="text-[10px] text-slate-500 italic max-w-xs truncate" title={apt.resident_notes}>
                                  Note: {apt.resident_notes}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              <div>📅 {apt.preferred_date}</div>
                              <div className="text-[10px] text-slate-400">{apt.preferred_time}</div>
                            </TableCell>
                            <TableCell>
                              {apt.scheduled_date ? (
                                <div className="font-medium text-emerald-800">
                                  <div>📅 {apt.scheduled_date}</div>
                                  <div className="text-[10px] text-emerald-600 font-mono">⏰ {apt.scheduled_time || 'Morning'}</div>
                                </div>
                              ) : (
                                <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                                  Needs Scheduling
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                apt.status === 'Approved' ? 'bg-emerald-600 text-white' :
                                apt.status === 'Completed' ? 'bg-blue-600 text-white' :
                                apt.status === 'Cancelled' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                              }>
                                {apt.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {apt.status === 'Pending' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenScheduleModal(apt)}
                                    className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                  >
                                    <Check size={12} /> Confirm Schedule
                                  </Button>
                                )}

                                {apt.status === 'Approved' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenScheduleModal(apt)}
                                      className="h-7 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1 rounded-lg cursor-pointer"
                                      title="Reschedule / Edit instructions"
                                    >
                                      Edit Slot
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleUpdateApptStatus(apt.id, 'Completed')}
                                      className="h-7 text-[11px] bg-blue-600 hover:bg-blue-700 text-white gap-1 rounded-lg cursor-pointer shadow-xs"
                                    >
                                      <CheckCircle2 size={12} /> Mark Completed
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUpdateApptStatus(apt.id, 'Cancelled', 'Patient did not return for scheduled slot')}
                                      className="h-7 text-[11px] border-rose-200 text-rose-700 hover:bg-rose-50 gap-1 rounded-lg cursor-pointer font-medium"
                                      title="Mark as Did Not Return / Cancel and move to Records"
                                    >
                                      <XCircle size={11} /> Did Not Return
                                    </Button>
                                  </>
                                )}

                                {apt.status !== 'Cancelled' && apt.status !== 'Completed' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleUpdateApptStatus(apt.id, 'Cancelled', 'Patient did not return for scheduled slot')}
                                    className="h-7 text-[11px] text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg cursor-pointer"
                                    title="Cancel and move to Records"
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
                </CardContent>
              </Card>

              {/* Published Clinic Schedules Section */}
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="text-emerald-600" size={16} />
                      Published Health Center Clinic Schedules (Seen by Residents)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Official schedules published to the resident portal.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setIsPostScheduleOpen(true)}
                    className="h-8 text-xs bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100"
                  >
                    + Add New Schedule
                  </Button>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {clinicSchedules.map(sch => (
                      <div key={sch.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {sch.service_type}
                            </span>
                            <Badge className="bg-emerald-600 text-white text-[10px] font-medium">
                              Active Hours
                            </Badge>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 mt-1">{sch.title}</h4>
                          <div className="space-y-1 mt-2 text-[11px] text-slate-600">
                            <div className="flex items-center gap-1.5 font-medium text-emerald-900">
                              <Clock size={12} className="text-emerald-600 shrink-0" />
                              <span>{sch.day_of_week} ({sch.time_slot})</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <MapPin size={12} className="text-slate-400 shrink-0" />
                              <span>{sch.location}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Users size={12} className="text-slate-400 shrink-0" />
                              <span>In-charge: <strong>{sch.bhw_in_charge}</strong></span>
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteClinicSchedule(sch.id)}
                          className="w-full h-7 text-[10px] text-red-600 hover:bg-red-50"
                        >
                          Remove Published Schedule
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Confirm / Approve Appointment Schedule Modal */}
              <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
                <DialogContent className="bg-white max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-900">
                      <CalendarCheck size={18} className="text-emerald-600" />
                      Confirm &amp; Schedule Appointment
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Set the confirmed date, time slot, and instructions for <strong>{selectedApptToSchedule?.resident_name}</strong>. An automated SMS and Email confirmation will be dispatched immediately.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleApproveAndScheduleAppointment} className="space-y-3.5 py-2 text-xs">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-emerald-950">{selectedApptToSchedule?.service_type}</span>
                        <span className="font-mono text-emerald-800 font-bold">{selectedApptToSchedule?.appointment_code}</span>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        Resident requested: 📅 {selectedApptToSchedule?.preferred_date} ({selectedApptToSchedule?.preferred_time})
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold">Confirmed Date <span className="text-red-500">*</span></Label>
                        <Input
                          type="date"
                          value={scheduleDate}
                          onChange={e => setScheduleDate(e.target.value)}
                          required
                          className="mt-1 h-9 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Confirmed Time Slot <span className="text-red-500">*</span></Label>
                        <Select value={scheduleTime} onValueChange={setScheduleTime}>
                          <SelectTrigger className="mt-1 h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="08:30 AM">08:30 AM (Morning Session)</SelectItem>
                            <SelectItem value="09:30 AM">09:30 AM</SelectItem>
                            <SelectItem value="10:30 AM">10:30 AM</SelectItem>
                            <SelectItem value="01:30 PM">01:30 PM (Afternoon Session)</SelectItem>
                            <SelectItem value="02:30 PM">02:30 PM</SelectItem>
                            <SelectItem value="03:30 PM">03:30 PM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">BHW Instructions &amp; Requirements Note</Label>
                      <textarea
                        value={scheduleBhwNotes}
                        onChange={e => setScheduleBhwNotes(e.target.value)}
                        rows={3}
                        placeholder="e.g. Please bring: (1) Valid IDs of couple, (2) Barangay Residency Certificate, and (3) CENOMAR from PSA. Session starts promptly at 9:00 AM."
                        className="w-full mt-1 px-3 py-2 text-xs rounded-md border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      />
                    </div>

                    <DialogFooter className="gap-2 pt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsScheduleModalOpen(false)} className="text-xs">
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm">
                        <Check size={14} />
                        Approve &amp; Send Confirmation
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Post New Clinic Schedule Modal */}
              <Dialog open={isPostScheduleOpen} onOpenChange={setIsPostScheduleOpen}>
                <DialogContent className="bg-white max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-900">
                      <PlusCircle size={18} className="text-emerald-600" />
                      Post New Clinic Schedule
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Publish a regular weekly health clinic schedule for residents to view and book.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCreateClinicSchedule} className="space-y-3 py-2 text-xs">
                    <div>
                      <Label className="text-xs font-semibold">Schedule Title <span className="text-red-500">*</span></Label>
                      <Input
                        value={newScheduleTitle}
                        onChange={e => setNewScheduleTitle(e.target.value)}
                        placeholder="e.g. Pre-Marriage Counseling (PMC) Weekly Seminar"
                        required
                        className="mt-1 h-9 text-xs"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Health Service / Program</Label>
                      <Select value={newScheduleServiceType} onValueChange={setNewScheduleServiceType}>
                        <SelectTrigger className="mt-1 h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pre-Marriage Counseling (PMC)">Pre-Marriage Counseling (PMC)</SelectItem>
                          <SelectItem value="Prenatal Check-up">Prenatal Check-up</SelectItem>
                          <SelectItem value="Child Immunization">Child Immunization</SelectItem>
                          <SelectItem value="Family Planning &amp; Counseling">Family Planning &amp; Counseling</SelectItem>
                          <SelectItem value="General Medical Consultation">General Medical Consultation</SelectItem>
                          <SelectItem value="BHW Home Visit">BHW Home Visit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs font-semibold">Day of Week <span className="text-red-500">*</span></Label>
                        <Input
                          value={newScheduleDay}
                          onChange={e => setNewScheduleDay(e.target.value)}
                          placeholder="e.g. Every Wednesday"
                          required
                          className="mt-1 h-9 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Operating Time Block <span className="text-red-500">*</span></Label>
                        <Input
                          value={newScheduleTime}
                          onChange={e => setNewScheduleTime(e.target.value)}
                          placeholder="e.g. 10:00 AM - 12:00 PM"
                          required
                          className="mt-1 h-9 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">BHW In-Charge</Label>
                      <Input
                        value={newScheduleBhw}
                        onChange={e => setNewScheduleBhw(e.target.value)}
                        placeholder="Nurse Maria Santos / Duty BHW"
                        className="mt-1 h-9 text-xs"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Location / Room</Label>
                      <Input
                        value={newScheduleLocation}
                        onChange={e => setNewScheduleLocation(e.target.value)}
                        placeholder="Barangay Pianing Health Center - Room 1"
                        className="mt-1 h-9 text-xs"
                      />
                    </div>

                    <DialogFooter className="gap-2 pt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsPostScheduleOpen(false)} className="text-xs">
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm">
                        <PlusCircle size={14} />
                        Publish Schedule
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* TAB 2: IMMUNIZATION TRACKING */}
          {activeTab === 'immunization' && (
            <div className="space-y-5">
              {/* Clean White Immunization Header Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-bold uppercase">
                      DOH National Immunization Program (NIP)
                    </Badge>
                    <span className="text-[10px] text-slate-500 font-medium">Live Synced</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <Syringe className="text-blue-600" size={24} /> Child Immunization Registry
                  </h2>
                  <p className="text-xs text-slate-500 max-w-2xl">
                    Comprehensive pediatric vaccine dose tracking, second-dose scheduling, dynamic observations, and automated parent SMS dispatch.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => {
                      setBatchSmsInitialService('Child Immunization');
                      setIsBatchSmsOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold h-9 px-3 gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Send size={13} />
                    <span>Review Due SMS ({dueSmsItems.filter(i => i.service === 'Child Immunization').length})</span>
                  </Button>

                  <Button
                    onClick={() => {
                      downloadOfficialPdf({
                        title: 'Child Immunization Registry',
                        subtitle: `Official BHW Pediatric Vaccine Registry — ${new Date().toLocaleDateString()}`,
                        filename: `Immunization_Records_${new Date().toISOString().slice(0, 10)}`,
                        preparedBy: user?.name || 'BHW Health Worker',
                        preparedByTitle: 'Barangay Health Worker',
                        department: 'Barangay Health Center',
                        stats: [
                          { label: 'Total Monitored', value: filteredImmunizations.length },
                          { label: 'Overdue Doses', value: filteredImmunizations.filter(i => i.status === 'Overdue').length }
                        ],
                        tables: [{
                          title: 'Vaccine Encounters',
                          headers: ['Child Name', 'Parent Phone', 'Vaccine', 'Dose', 'Status', 'Date Given / Due'],
                          rows: filteredImmunizations.map(i => [
                            i.child_name,
                            i.parent_phone || 'N/A',
                            i.vaccine_name,
                            `Dose #${i.dose_number}`,
                            i.status,
                            i.date_administered || i.due_date || 'N/A'
                          ])
                        }]
                      });
                      toast.success('Immunization PDF registry generated');
                    }}
                    variant="outline"
                    className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9 px-3 gap-1.5 cursor-pointer"
                  >
                    <Download size={13} /> Export PDF
                  </Button>

                  <Button
                    onClick={() => setIsAddImmOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold h-9 px-3.5 gap-1.5 shadow-sm cursor-pointer"
                  >
                    <PlusCircle size={14} /> Record Vaccine
                  </Button>
                </div>
              </div>

              {/* Filter Pills and Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                    <Filter size={12} /> Filter:
                  </span>
                  {[
                    { id: 'all', label: `All Vaccines (${immunizations.length})` },
                    { id: 'dose1', label: 'Dose 1' },
                    { id: 'dose2', label: '⭐ Dose 2' },
                    { id: 'dose3', label: 'Dose 3+ / Boosters' },
                    { id: 'overdue', label: `⚠️ Overdue (${overdueVaccines.length})` },
                  ].map(f => {
                    const isSelected = immFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setImmFilter(f.id as any)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? f.id === 'dose2'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : f.id === 'overdue'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <Input
                    placeholder="Search child or vaccine name..."
                    value={immSearch}
                    onChange={e => setImmSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>

              {/* Immunization Registry Table */}
              <Card className="border-slate-200 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/60">
                          <TableHead className="text-xs font-bold">Child Name &amp; Guardian</TableHead>
                          <TableHead className="text-xs font-bold">Vaccine Formulation</TableHead>
                          <TableHead className="text-xs font-bold">Dose Sequence</TableHead>
                          <TableHead className="text-xs font-bold">Date Given</TableHead>
                          <TableHead className="text-xs font-bold">Next Due Date</TableHead>
                          <TableHead className="text-xs font-bold">Clinical Status</TableHead>
                          <TableHead className="text-xs font-bold text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredImmunizations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-10 text-xs text-slate-400">
                              No immunization records match your query. Click "+ Record Vaccine" to register an encounter.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredImmunizations.map(imm => {
                            const isDose2 = String(imm.dose_number || '').includes('2');
                            return (
                              <TableRow key={imm.id} className="text-xs hover:bg-slate-50/70 transition-colors">
                                <TableCell>
                                  <div className="space-y-0.5">
                                    <button
                                      onClick={() => openResidentProfile(imm.resident_id || 1)}
                                      className="font-bold text-blue-700 hover:text-blue-900 hover:underline transition-colors block text-left"
                                    >
                                      {imm.child_name}
                                    </button>
                                    <p className="text-[11px] text-slate-500">
                                      Guardian: {imm.guardian_name || 'N/A'} • <span className="font-mono">{imm.parent_phone || 'No phone'}</span>
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {imm.vaccine_name}
                                  </span>
                                  {imm.batch_lot && (
                                    <p className="text-[10px] text-slate-400 font-mono">{imm.batch_lot}</p>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isDose2 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                      ⭐ Dose 2
                                    </span>
                                  ) : (
                                    <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                      #{imm.dose_number}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                                  {imm.date_administered || imm.date_given || '-'}
                                </TableCell>
                                <TableCell className="font-mono font-semibold text-[11px]">
                                  <span className={imm.status === 'Overdue' ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                    {imm.due_date || imm.next_due_date || 'N/A'}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge className={
                                    imm.status === 'Completed' ? 'bg-emerald-600 text-white' :
                                    imm.status === 'Overdue' ? 'bg-rose-600 text-white font-bold' : 'bg-blue-600 text-white'
                                  }>
                                    {imm.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {imm.status !== 'Completed' && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleMarkImmunizationComplete(imm.id)}
                                        className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 font-semibold"
                                      >
                                        Mark Done
                                      </Button>
                                    )}
                                    {imm.parent_phone && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSmsRecipientName(imm.guardian_name || imm.child_name);
                                          setSmsPhone(imm.parent_phone || '');
                                          setSmsMessage(`Reminder: Baby ${imm.child_name} is scheduled for ${imm.vaccine_name} (${imm.dose_number}) at Barangay Pianing Health Center. Due: ${imm.due_date || 'this week'}.`);
                                          setIsSendSmsOpen(true);
                                        }}
                                        className="h-7 text-[11px] text-blue-700 border-blue-200 hover:bg-blue-50 px-2 gap-1"
                                      >
                                        <Send size={11} /> SMS
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 3: MATERNAL HEALTH */}
          {activeTab === 'maternal' && (
            <div className="space-y-5">
              {/* Clean White Maternal Header Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-[10px] font-bold uppercase">
                      DOH Maternal Care Guidelines
                    </Badge>
                    <span className="text-[10px] text-slate-500 font-medium">Synchronized with Nurse</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <Heart className="text-rose-600" size={24} /> Maternal Healthcare Monitoring
                  </h2>
                  <p className="text-xs text-slate-500 max-w-2xl">
                    Track prenatal booking, 2nd visit follow-ups, dual blood pressure screening, fundic height, high-risk detection, and iron supplementation.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => {
                      setBatchSmsInitialService('Maternal Health');
                      setIsBatchSmsOpen(true);
                    }}
                    className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold h-9 px-3 gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Send size={13} />
                    <span>Review Due SMS ({dueSmsItems.filter(i => i.service === 'Maternal Health').length})</span>
                  </Button>

                  <Button
                    onClick={() => {
                      downloadOfficialPdf({
                        title: 'Maternal Healthcare Monitoring',
                        subtitle: `Official BHW Maternal Registry — ${new Date().toLocaleDateString()}`,
                        filename: `Maternal_Health_Records_${new Date().toISOString().slice(0, 10)}`,
                        preparedBy: user?.name || 'BHW Health Worker',
                        preparedByTitle: 'Barangay Health Worker',
                        department: 'Barangay Health Center',
                        stats: [
                          { label: 'Total Mothers', value: filteredMaternalRecords.length },
                          { label: 'High Risk', value: filteredMaternalRecords.filter(m => m.risk_level === 'High').length }
                        ],
                        tables: [{
                          title: 'Maternal Health Registry',
                          headers: ['Mother Name', 'Age', 'Visit Type / Status', 'Risk', 'BP Screening', 'Next Visit'],
                          rows: filteredMaternalRecords.map(m => [
                            m.mother_name ?? '',
                            `${m.age ?? ''} yrs`,
                            m.pregnancy_status ?? '',
                            m.risk_level ?? 'Low',
                            (m as any).blood_pressure || 'N/A',
                            m.next_visit ?? 'TBD'
                          ])
                        }]
                      });
                      toast.success('Maternal health PDF exported');
                    }}
                    variant="outline"
                    className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9 px-3 gap-1.5 cursor-pointer"
                  >
                    <Download size={13} /> Export PDF
                  </Button>

                  <Dialog open={isAddMaternalOpen} onOpenChange={setIsAddMaternalOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold h-9 px-3.5 gap-1.5 shadow-sm cursor-pointer">
                        <PlusCircle size={14} /> Add Maternal Record
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200">
                      <DialogHeader className="border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center shrink-0">
                            <Heart size={18} />
                          </div>
                          <div>
                            <DialogTitle className="text-base font-bold text-slate-900">
                              Register Maternal Healthcare Record
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500">
                              Comprehensive prenatal & postnatal monitoring form with dual BP inputs.
                            </DialogDescription>
                          </div>
                        </div>
                      </DialogHeader>

                      <form onSubmit={handleCreateMaternalRecord} className="space-y-3.5 pt-3">
                        <div className="relative">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Patient Identification</p>
                            {bhwMatchingMothers.length > 0 && bhwMSearchFocus && (
                              <span className="text-[10px] text-pink-600 font-semibold animate-pulse">
                                Found in Census Registry ({bhwMatchingMothers.length})
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2.5">
                            <div>
                              <Label className="text-xs font-semibold text-slate-700">First Name <span className="text-rose-500">*</span></Label>
                              <Input
                                value={newMotherFirstName}
                                onChange={e => {
                                  setNewMotherFirstName(e.target.value);
                                  setBhwMSearchFocus(true);
                                }}
                                onFocus={() => setBhwMSearchFocus(true)}
                                placeholder="e.g. Maria"
                                required
                                className="h-9 text-xs mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold text-slate-700">Middle Name</Label>
                              <Input
                                value={newMotherMiddleName}
                                onChange={e => {
                                  setNewMotherMiddleName(e.target.value);
                                  setBhwMSearchFocus(true);
                                }}
                                onFocus={() => setBhwMSearchFocus(true)}
                                placeholder="e.g. Elena"
                                className="h-9 text-xs mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold text-slate-700">Last Name <span className="text-rose-500">*</span></Label>
                              <Input
                                value={newMotherLastName}
                                onChange={e => {
                                  setNewMotherLastName(e.target.value);
                                  setBhwMSearchFocus(true);
                                }}
                                onFocus={() => setBhwMSearchFocus(true)}
                                placeholder="e.g. Gomez"
                                required
                                className="h-9 text-xs mt-1"
                              />
                            </div>
                          </div>

                          {/* Dynamic Mother suggestions dropdown */}
                          {bhwMSearchFocus && bhwMatchingMothers.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-pink-300 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                              <div className="p-1.5 bg-pink-50/90 text-[10px] font-bold text-pink-800 flex items-center justify-between px-3">
                                <span>Matching Inhabitants in Census ({bhwMatchingMothers.length})</span>
                                <button
                                  type="button"
                                  onClick={() => setBhwMSearchFocus(false)}
                                  className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                              {bhwMatchingMothers.map((m: any) => (
                                <button
                                  key={`bhw-mother-match-${m.id}`}
                                  type="button"
                                  onClick={() => selectBhwMatchedMother(m)}
                                  className="w-full text-left p-2.5 hover:bg-pink-50/60 transition-colors flex items-center justify-between text-xs cursor-pointer group"
                                >
                                  <div>
                                    <span className="font-bold text-slate-800 group-hover:text-pink-700 block">
                                      {m.first_name} {m.middle_name ? m.middle_name + ' ' : ''}{m.last_name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 block">
                                      {m.gender} · Purok {m.purok || '1'} · {m.phone || 'No phone recorded'}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="text-[9px] bg-white border-pink-300 text-pink-700 shrink-0">
                                    Auto-Fill
                                  </Badge>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs font-semibold text-slate-700">Mobile Phone Number (SMS Reminders) <span className="text-rose-500">*</span></Label>
                          <Input
                            value={newMotherPhone}
                            onChange={e => setNewMotherPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            placeholder="09XXXXXXXXX"
                            required
                            maxLength={11}
                            className="h-9 text-xs font-mono mt-1"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2.5">
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Age (years)</Label>
                            <Input
                              type="number"
                              value={newMotherAge}
                              onChange={e => setNewMotherAge(e.target.value)}
                              placeholder="e.g. 26"
                              className="h-9 text-xs mt-1 font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Gestational Age (weeks)</Label>
                            <Input
                              value={newMotherGestationalWeeks}
                              onChange={e => setNewMotherGestationalWeeks(e.target.value)}
                              placeholder="e.g. 18"
                              className="h-9 text-xs mt-1 font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Risk Assessment</Label>
                            <Select value={newRiskLevel} onValueChange={(val: any) => setNewRiskLevel(val)}>
                              <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Low">Low Risk</SelectItem>
                                <SelectItem value="Moderate">Moderate Risk</SelectItem>
                                <SelectItem value="High">⚠️ High Risk (Referral)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Visit Type Sequence */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Visit Sequence</Label>
                            <Select value={newMotherVisitType} onValueChange={setNewMotherVisitType}>
                              <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1st Visit (Initial Booking)">1st Visit (Initial Booking)</SelectItem>
                                <SelectItem value="2nd Visit (Follow-up / Ultrasound)">⭐ 2nd Visit (Follow-up / Ultrasound)</SelectItem>
                                <SelectItem value="3rd Visit (3rd Trimester)">3rd Visit (3rd Trimester)</SelectItem>
                                <SelectItem value="4th Visit (Term Preparation)">4th Visit (Term Preparation)</SelectItem>
                                <SelectItem value="Postpartum Checkup (2-6 weeks)">Postpartum Checkup (2-6 weeks)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Pregnancy Trimester</Label>
                            <Select value={newPregnancyStatus} onValueChange={setNewPregnancyStatus}>
                              <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Prenatal - 1st Trimester">Prenatal - 1st Trimester</SelectItem>
                                <SelectItem value="Prenatal - 2nd Trimester">Prenatal - 2nd Trimester</SelectItem>
                                <SelectItem value="Prenatal - 3rd Trimester">Prenatal - 3rd Trimester</SelectItem>
                                <SelectItem value="Postnatal - 2 weeks">Postnatal - 2 weeks</SelectItem>
                                <SelectItem value="Postnatal - 6 weeks">Postnatal - 6 weeks</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Blood Pressure Screening with Live Classification */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              Blood Pressure Screening (mmHg) <span className="text-rose-500">*</span>
                            </Label>
                            {(() => {
                              const bpCat = getBpCategory(newMotherBpSys, newMotherBpDia);
                              return (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bpCat.color}`}>
                                  {bpCat.label}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="Systolic (e.g. 110)"
                                value={newMotherBpSys}
                                onChange={e => setNewMotherBpSys(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                required
                                className="h-9 text-xs text-center font-mono font-bold bg-white"
                              />
                            </div>
                            <span className="text-slate-400 font-bold text-lg">/</span>
                            <div className="flex-1">
                              <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="Diastolic (e.g. 70)"
                                value={newMotherBpDia}
                                onChange={e => setNewMotherBpDia(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                required
                                className="h-9 text-xs text-center font-mono font-bold bg-white"
                              />
                            </div>
                            <span className="text-xs text-slate-500 font-medium font-mono shrink-0">mmHg</span>
                          </div>
                        </div>

                        {/* Maternal Vitals & Iron Supplementation */}
                        <div className="grid grid-cols-3 gap-2.5">
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Weight (kg)</Label>
                            <Input
                              value={newMotherWeight}
                              onChange={e => setNewMotherWeight(e.target.value)}
                              placeholder="e.g. 56"
                              className="h-9 text-xs mt-1 font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Fundic Ht (cm)</Label>
                            <Input
                              value={newMotherFundicHeight}
                              onChange={e => setNewMotherFundicHeight(e.target.value)}
                              placeholder="e.g. 18"
                              className="h-9 text-xs mt-1 font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Fetal Heart (bpm)</Label>
                            <Input
                              value={newMotherFetalHeartTone}
                              onChange={e => setNewMotherFetalHeartTone(e.target.value)}
                              placeholder="e.g. 142"
                              className="h-9 text-xs mt-1 font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-pink-50/60 border border-pink-200 rounded-xl">
                          <div>
                            <span className="text-xs font-bold text-pink-900 block">Iron &amp; Folic Acid Supplementation</span>
                            <span className="text-[10px] text-pink-700">Standard DOH micronutrient packet distributed</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={newMotherIronSupplements}
                            onChange={e => setNewMotherIronSupplements(e.target.checked)}
                            className="w-4 h-4 rounded-md text-pink-600 focus:ring-pink-500 cursor-pointer"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold text-slate-700">Next Scheduled Prenatal Visit</Label>
                          <Input
                            type="date"
                            value={newNextVisit}
                            onChange={e => setNewNextVisit(e.target.value)}
                            required
                            className="h-9 text-xs mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold text-slate-700">Clinical Notes &amp; Findings</Label>
                          <Input
                            value={newMotherNotes}
                            onChange={e => setNewMotherNotes(e.target.value)}
                            placeholder="e.g. Normal fetal movement, no signs of edema or severe headache"
                            className="h-9 text-xs mt-1"
                          />
                        </div>

                        <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsAddMaternalOpen(false)} className="text-xs h-9">
                            Cancel
                          </Button>
                          <Button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs h-9 px-4 gap-1.5 cursor-pointer">
                            <Check size={14} /> Save Maternal Record
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Filter Pills and Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                    <Filter size={12} /> Filter:
                  </span>
                  {[
                    { id: 'all', label: `All Patients (${maternalRecords.length})` },
                    { id: '1st', label: '1st Visit' },
                    { id: '2nd', label: '⭐ 2nd Visit' },
                    { id: 'high_risk', label: '⚠️ High Risk' },
                    { id: 'due', label: 'Due Soon (7 Days)' },
                  ].map(f => {
                    const isSelected = maternalFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setMaternalFilter(f.id as any)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? f.id === '2nd'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : f.id === 'high_risk'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-pink-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <Input
                    placeholder="Search mother name or status..."
                    value={maternalSearch}
                    onChange={e => setMaternalSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>

              {/* Maternal Health Registry Table */}
              <Card className="border-slate-200 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/60">
                          <TableHead className="text-xs font-bold">Mother Full Name</TableHead>
                          <TableHead className="text-xs font-bold">Age &amp; Gestation</TableHead>
                          <TableHead className="text-xs font-bold">Visit Sequence</TableHead>
                          <TableHead className="text-xs font-bold">Blood Pressure</TableHead>
                          <TableHead className="text-xs font-bold">Risk Level</TableHead>
                          <TableHead className="text-xs font-bold">Last Visit</TableHead>
                          <TableHead className="text-xs font-bold">Next Visit Schedule</TableHead>
                          <TableHead className="text-xs font-bold text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMaternalRecords.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-10 text-xs text-slate-400">
                              No maternal records match your query. Click "+ Add Maternal Record" to register an encounter.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredMaternalRecords.map(mat => {
                            const is2nd = (mat.pregnancy_status || '').toLowerCase().includes('2nd') ||
                                          ((mat as any).visit_type || '').includes('2nd') ||
                                          (mat as any).visit_number === 2;
                            const bp = (mat as any).blood_pressure;
                            return (
                              <TableRow key={mat.id} className="text-xs hover:bg-slate-50/70 transition-colors">
                                <TableCell>
                                  <div className="space-y-0.5">
                                    <button
                                      onClick={() => openResidentProfile(mat.resident_id || 1)}
                                      className="font-bold text-blue-700 hover:text-blue-900 hover:underline transition-colors block text-left"
                                    >
                                      {mat.mother_name}
                                    </button>
                                    <p className="text-[11px] text-slate-500 font-mono">
                                      {(mat as any).phone || (mat as any).contact_number || '09171234567'}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{mat.age} yrs</span>
                                  {(mat as any).gestational_age_weeks && (
                                    <p className="text-[10px] text-slate-400 font-mono">{(mat as any).gestational_age_weeks} weeks</p>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {is2nd ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                      ⭐ 2nd Visit
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                      {(mat as any).visit_type || mat.pregnancy_status}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {bp ? (
                                    <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                      {bp}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">110/70 mmHg</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge className={
                                    mat.risk_level === 'High' ? 'bg-rose-600 text-white font-bold' :
                                    mat.risk_level === 'Moderate' ? 'bg-amber-500 text-white font-medium' : 'bg-emerald-600 text-white'
                                  }>
                                    {mat.risk_level || 'Low'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-slate-500 text-[11px]">{mat.last_visit || '-'}</TableCell>
                                <TableCell className="font-mono font-bold text-blue-600 text-[11px]">{mat.next_visit || 'TBD'}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSmsRecipientName(mat.mother_name);
                                      setSmsPhone((mat as any).phone || (mat as any).contact_number || '09171234567');
                                      setSmsMessage(`Reminder: Mrs. ${mat.mother_name}, your prenatal checkup is scheduled at Barangay Pianing Health Center on ${mat.next_visit || 'this week'}. Please bring your mother book.`);
                                      setIsSendSmsOpen(true);
                                    }}
                                    className="h-7 text-[11px] text-pink-700 border-pink-200 hover:bg-pink-50 px-2 gap-1"
                                  >
                                    <Send size={11} /> SMS
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB: VACCINES & MEDICINE SUPPLY */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Pill className="text-emerald-600" size={20} /> Vaccines &amp; Medicine Supply Inventory
                  </h2>
                  <p className="text-xs text-slate-500">Live stock tracking for maternal vitamins, EPI child vaccines, and clinic medications</p>
                </div>
                <Button onClick={() => setIsInventoryOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 cursor-pointer rounded-xl font-semibold shadow-xs">
                  <PlusCircle size={14} /> Add Supply Item
                </Button>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <Input
                    value={inventorySearch}
                    onChange={e => setInventorySearch(e.target.value)}
                    placeholder="Search medicines, vaccines, or category..."
                    className="h-9 text-xs pl-8 bg-slate-50 border-slate-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={inventoryCategoryFilter} onValueChange={setInventoryCategoryFilter}>
                    <SelectTrigger className="h-9 text-xs w-44">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Vaccine (EPI)">Vaccine (EPI)</SelectItem>
                      <SelectItem value="Maternal Vitamin">Maternal Vitamin</SelectItem>
                      <SelectItem value="Essential Medicine">Essential Medicine</SelectItem>
                      <SelectItem value="Pediatric Supply">Pediatric Supply</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/60">
                      <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Item Name</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Category</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Stock on Hand</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Expiration</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Status</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-400">
                          No supply items found. Click "+ Add Supply Item" to record stocks.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInventory.map(item => (
                        <TableRow key={item.id} className="text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <TableCell className="font-bold text-slate-900 dark:text-white">{item.item_name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{item.category}</Badge></TableCell>
                          <TableCell className="font-bold font-mono text-slate-900 dark:text-slate-100">{item.stock} {item.unit}</TableCell>
                          <TableCell className="font-mono text-slate-500">{item.expiry_date || 'N/A'}</TableCell>
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
                              <button
                                onClick={() => handleDeleteInventory(item.id)}
                                className="p-1 text-slate-400 hover:text-red-600 cursor-pointer transition-colors"
                                title="Remove item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* TAB 4: CLINICAL & PATIENT RECORDS */}
          {(activeTab === 'records' || activeTab === 'archives') && (
            <ClinicalArchivesHub
              barangay={user?.barangay || 'Pianing'}
            />
          )}

          {/* TAB 5: GMAIL-STYLE SMS NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <GmailNotificationHub
                notifications={notifications}
                onRefresh={loadData}
                onOpenDetails={openSmsDetails}
                onOpenCompose={() => setIsSendSmsOpen(true)}
                currentUserRole="bhw"
                barangay={user?.barangay || 'Pianing'}
              />
            </div>
          )}

          {/* TAB 5: HEALTH REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Public Health Reports & Analytics</h2>
                  <p className="text-xs text-slate-500">Official Barangay Pianing Health Center reports, vaccination coverage, and maternal monitoring.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => {
                      downloadOfficialPdf({
                        title: 'Child Immunization Report',
                        subtitle: `Full vaccination records — ${new Date().toLocaleDateString()}`,
                        filename: `Child_Immunization_Report_${new Date().toISOString().slice(0, 10)}`,
                        preparedBy: user?.name || 'BHW Health Worker',
                        preparedByTitle: 'Barangay Health Worker',
                        department: 'Barangay Health Center',
                        stats: [
                          { label: 'Total Records', value: immunizations.length },
                          { label: 'Overdue', value: immunizations.filter(i => i.status === 'Overdue').length }
                        ],
                        tables: [{
                          title: 'Immunization Records',
                          headers: ['Child', 'Parent Contact', 'Vaccine', 'Dose', 'Status', 'Date', 'By'],
                          rows: immunizations.map(i => [i.child_name, i.parent_phone || 'N/A', i.vaccine_name, `Dose ${i.dose_number}`, i.status, i.date_administered || 'N/A', i.administered_by || 'BHW Clinic'])
                        }]
                      });
                      toast.success('Immunization report PDF downloaded');
                    }}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-slate-300"
                  >
                    <Download size={13} /> Download Vaccines (PDF)
                  </Button>

                  <Button
                    onClick={() => {
                      downloadOfficialPdf({
                        title: 'Maternal Health Report',
                        subtitle: `Prenatal & postnatal patient records — ${new Date().toLocaleDateString()}`,
                        filename: `Maternal_Health_Report_${new Date().toISOString().slice(0, 10)}`,
                        preparedBy: user?.name || 'BHW Health Worker',
                        preparedByTitle: 'Barangay Health Worker',
                        department: 'Barangay Health Center',
                        stats: [
                          { label: 'Total Patients', value: maternalRecords.length },
                          { label: 'High Risk', value: maternalRecords.filter(m => m.risk_level === 'High').length }
                        ],
                        tables: [{
                          title: 'Maternal Care Records',
                          headers: ['Mother', 'Age', 'Pregnancy Status', 'Due Date', 'Risk Level', 'Notes'],
                          rows: maternalRecords.map(m => [m.mother_name ?? '', String(m.age ?? ''), m.pregnancy_status ?? '', m.expected_due_date ?? 'N/A', m.risk_level ?? '', m.notes ?? ''])
                        }]
                      });
                      toast.success('Maternal health report PDF downloaded');
                    }}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-slate-300"
                  >
                    <Download size={13} /> Download Maternal (PDF)
                  </Button>

                  <Button
                    onClick={() => {
                      printOfficialReport({
                        title: 'Public Health & Immunization Performance Report',
                        subtitle: 'Barangay Pianing Health Center • Comprehensive Child Healthcare & Maternal Program',
                        department: 'Barangay Health Center • Public Health Office',
                        preparedBy: user?.name || 'Nurse Maria Santos',
                        preparedByTitle: 'Barangay Health Worker / Nurse',
                        stats: [
                          { label: 'Children Monitored', value: stats.childrenMonitored, color: '#0284c7' },
                          { label: 'Vaccines This Month', value: stats.vaccinationsMonth, color: '#059669' },
                          { label: 'Overdue Doses', value: stats.overdueImmunizations, color: '#dc2626' },
                          { label: 'Active Maternal Patients', value: maternalRecords.length, color: '#db2777' }
                        ],
                        tables: [
                          {
                            title: 'Recent Child Immunization Deliveries',
                            headers: ['Child Patient', 'Parent Contact', 'Vaccine Administered', 'Dose', 'Status', 'Date'],
                            rows: immunizations.slice(0, 10).map(i => [
                              i.child_name,
                              i.parent_phone || 'N/A',
                              i.vaccine_name,
                              `Dose ${i.dose_number}`,
                              i.status,
                              i.date_administered || i.due_date || 'Recent'
                            ])
                          },
                          {
                            title: 'Maternal Care & High-Risk Pregnancy Monitoring',
                            headers: ['Mother Patient', 'Age', 'Pregnancy Stage', 'Expected Due Date', 'Risk Level', 'Next Visit'],
                            rows: maternalRecords.map(m => [
                              m.mother_name ?? '',
                              String(m.age ?? ''),
                              m.pregnancy_status ?? '',
                              m.expected_due_date ?? 'Postnatal',
                              m.risk_level ?? '',
                              m.next_visit ?? 'TBD'
                            ])
                          }
                        ]
                      });
                    }}
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-semibold"
                  >
                    <Printer size={13} /> Print Official Health Report
                  </Button>
                </div>
              </div>

              {/* Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Baby size={16} className="text-blue-600" />
                      Immunization Dataset
                    </CardTitle>
                    <CardDescription className="text-[11px] text-blue-700">All child vaccine records & overdue logs</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-slate-600 mb-3">Total registered child vaccines: <strong>{immunizations.length}</strong> records.</p>
                    <Button
                      onClick={() => {
                        downloadOfficialPdf({
                          title: 'Overdue Vaccine Alert Report',
                          subtitle: `Children with overdue vaccination doses — ${new Date().toLocaleDateString()}`,
                          filename: `Overdue_Vaccine_Alert_${new Date().toISOString().slice(0, 10)}`,
                          preparedBy: user?.name || 'BHW Health Worker',
                          preparedByTitle: 'Barangay Health Worker',
                          department: 'Barangay Health Center',
                          stats: [{ label: 'Overdue Cases', value: immunizations.filter(i => i.status === 'Overdue').length }],
                          tables: [{
                            title: 'Overdue Vaccine Records',
                            headers: ['Child Name', 'Parent Phone', 'Vaccine', 'Days Overdue'],
                            rows: immunizations.filter(i => i.status === 'Overdue').map(i => [i.child_name, i.parent_phone || 'N/A', i.vaccine_name, i.days_overdue || 'N/A'])
                          }]
                        });
                        toast.success('Overdue vaccine PDF downloaded');
                      }}
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-7 text-blue-700 border-blue-300 hover:bg-blue-100"
                    >
                      <Download size={12} className="mr-1" /> Download Overdue Vaccines (PDF)
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-pink-200 bg-pink-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-pink-900 flex items-center gap-1.5">
                      <Heart size={16} className="text-pink-600" />
                      Maternal Health Registry
                    </CardTitle>
                    <CardDescription className="text-[11px] text-pink-700">Prenatal & postnatal patient monitoring</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-slate-600 mb-3">Active maternal cases: <strong>{maternalRecords.length}</strong> patients.</p>
                    <Button
                      onClick={() => {
                        downloadOfficialPdf({
                          title: 'High-Risk Maternal Patients Report',
                          subtitle: `High & moderate risk pregnancy cases — ${new Date().toLocaleDateString()}`,
                          filename: `High_Risk_Maternal_Patients_${new Date().toISOString().slice(0, 10)}`,
                          preparedBy: user?.name || 'BHW Health Worker',
                          preparedByTitle: 'Barangay Health Worker',
                          department: 'Barangay Health Center',
                          stats: [
                            { label: 'High Risk', value: maternalRecords.filter(m => m.risk_level === 'High').length },
                            { label: 'Moderate Risk', value: maternalRecords.filter(m => m.risk_level === 'Moderate').length }
                          ],
                          tables: [{
                            title: 'High-Risk Maternal Patients',
                            headers: ['Mother', 'Age', 'Status', 'Risk Level', 'Notes'],
                            rows: maternalRecords.filter(m => m.risk_level === 'High' || m.risk_level === 'Moderate').map(m => [m.mother_name ?? '', String(m.age ?? ''), m.pregnancy_status ?? '', m.risk_level ?? '', m.notes ?? ''])
                          }]
                        });
                        toast.success('High-risk maternal PDF downloaded');
                      }}
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-7 text-pink-700 border-pink-300 hover:bg-pink-100"
                    >
                      <Download size={12} className="mr-1" /> Download High-Risk Patients (PDF)
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-purple-200 bg-purple-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Bell size={16} className="text-purple-600" />
                      SMS Health Dispatch Log
                    </CardTitle>
                    <CardDescription className="text-[11px] text-purple-700">SMS notification history & alerts</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-slate-600 mb-3">Total health alerts dispatched: <strong>{notifications.length}</strong> sent.</p>
                    <Button
                      onClick={() => {
                        downloadOfficialPdf({
                          title: 'SMS Health Dispatch Log Report',
                          subtitle: `Health alert notifications dispatched — ${new Date().toLocaleDateString()}`,
                          filename: `SMS_Health_Dispatch_Log_${new Date().toISOString().slice(0, 10)}`,
                          preparedBy: user?.name || 'BHW Health Worker',
                          preparedByTitle: 'Barangay Health Worker',
                          department: 'Barangay Health Center',
                          stats: [{ label: 'Total SMS Sent', value: notifications.length }],
                          tables: [{
                            title: 'SMS Health Dispatch Log',
                            headers: ['Recipient', 'Phone', 'Type', 'Message', 'Status', 'Sent At'],
                            rows: notifications.map(n => [n.recipient_name, n.recipient_phone, n.type || 'General', (n.message || '').substring(0, 40) + '...', n.status || 'Sent', n.sent_at || 'Recent'])
                          }]
                        });
                        toast.success('SMS dispatch log PDF downloaded');
                      }}
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-7 text-purple-700 border-purple-300 hover:bg-purple-100"
                    >
                      <Download size={12} className="mr-1" /> Download SMS Log (PDF)
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-slate-200 bg-white">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Syringe className="text-blue-600" size={18} />
                      Vaccine Coverage Rates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>BCG Vaccine Coverage</span>
                      <span className="font-bold text-emerald-600">98.5%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Hepatitis B Initial Dose</span>
                      <span className="font-bold text-emerald-600">94.2%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>DPT Booster Compliance</span>
                      <span className="font-bold text-amber-600">89.0%</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span>MMR Vaccine Compliance</span>
                      <span className="font-bold text-amber-600">87.5%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Heart className="text-pink-600" size={18} />
                      Maternal Health Program
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Active Prenatal Consultations</span>
                      <span className="font-bold font-mono text-pink-600">{maternalRecords.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Postnatal Care Checks</span>
                      <span className="font-bold font-mono text-emerald-600">34</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span>High Risk Pregnancy Monitoring</span>
                      <span className="font-bold font-mono text-red-600">{maternalRecords.filter(m => m.risk_level === 'High').length}</span>
                    </div>
                  </CardContent>
                </Card>
                </div>

              {/* ─── LIVE ANALYTICS ─────────────────────────────────────────── */}
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 size={18} className="text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">Live Field Health Analytics</h3>
                  <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">BHW Role</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {/* Immunization Compliance */}
                  {(() => {
                    const completed = immunizations.filter(i => i.status === 'Completed').length;
                    const overdue = immunizations.filter(i => i.status === 'Overdue').length;
                    const total = completed + overdue;
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                    return (
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-600">Immunization Compliance</span>
                          <Syringe size={16} className="text-blue-600" />
                        </div>
                        <p className="text-3xl font-extrabold text-slate-900">{pct}%</p>
                        <p className="text-[11px] text-slate-500 mt-1">{completed} completed / {overdue} overdue</p>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                          <div className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}
                  {/* Maternal Risk Distribution */}
                  {(() => {
                    const high = maternalRecords.filter(m => m.risk_level === 'High').length;
                    const moderate = maternalRecords.filter(m => m.risk_level === 'Moderate').length;
                    const low = maternalRecords.filter(m => !m.risk_level || m.risk_level === 'Low').length;
                    return (
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-600">Maternal Risk Distribution</span>
                          <Heart size={16} className="text-pink-600" />
                        </div>
                        <p className="text-3xl font-extrabold text-slate-900">{maternalRecords.length}</p>
                        <p className="text-[11px] text-slate-500 mt-1">Active maternal patients</p>
                        <div className="flex gap-1.5 mt-2">
                          <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded font-semibold">{high} High</span>
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">{moderate} Mod</span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">{low} Low</span>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Appointment Fulfillment */}
                  {(() => {
                    const confirmed = appointments.filter(a => a.status === 'Approved' || a.status === 'Completed').length;
                    const total = appointments.length;
                    const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
                    return (
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-600">Appointment Fulfillment</span>
                          <CalendarCheck size={16} className="text-emerald-600" />
                        </div>
                        <p className="text-3xl font-extrabold text-slate-900">{pct}%</p>
                        <p className="text-[11px] text-slate-500 mt-1">{confirmed} confirmed of {total} total</p>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}
                  {/* SMS Health Dispatch */}
                  {(() => {
                    const sent = notifications.filter(n => n.status === 'Sent' || !n.status).length;
                    const pending = notifications.filter(n => n.status === 'Pending').length;
                    return (
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-600">SMS Health Dispatch</span>
                          <Bell size={16} className="text-purple-600" />
                        </div>
                        <p className="text-3xl font-extrabold text-slate-900">{notifications.length}</p>
                        <p className="text-[11px] text-slate-500 mt-1">Total dispatched</p>
                        <div className="flex gap-1.5 mt-2">
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">{sent} Sent</span>
                          {pending > 0 && <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">{pending} Pending</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Inventory Low Stock Alerts */}
                {inventory.filter(i => i.status === 'Low Stock' || i.status === 'Out of Stock').length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={16} className="text-amber-600" />
                      <h4 className="text-sm font-bold text-amber-900">Low Stock / Out of Stock Alerts</h4>
                      <span className="text-[11px] bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-semibold">
                        {inventory.filter(i => i.status === 'Low Stock' || i.status === 'Out of Stock').length} Items
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {inventory.filter(i => i.status === 'Low Stock' || i.status === 'Out of Stock').map(item => (
                        <div key={item.id} className="flex items-center justify-between bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs">
                          <div>
                            <p className="font-semibold text-slate-800">{item.item_name}</p>
                            <p className="text-slate-500">{item.category}</p>
                          </div>
                          <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${item.status === 'Out of Stock' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {item.stock} {item.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ TAB: CENSUS ENTRY ══════════════════════════════════════════ */}
          {activeTab === 'census' && (
            <CensusEntryTab
              user={user}
              onSync={() => {
                triggerHealthSync();
              }}
            />
          )}

          {/* TAB: PROFILE SETTINGS */}
          {activeTab === 'profile' && (
            <ProfileSettingsView
              user={user}
              onProfileUpdated={(updated) => setUser(updated)}
            />
          )}
        </main>
      </div>

      {/* Intra-System Messenger (floating, Staff Chat) */}
      <SystemMessenger
        currentUserRole="bhw"
        currentUserName={user?.name || "BHW Maria Santos"}
        currentUserEmail={user?.email}
        currentUserId={user?.id}
        currentUserBarangay={user?.barangay || 'Pianing'}
      />

      {/* Resident 360° Profile Modal */}
      <ResidentProfileModal
        residentId={selectedResidentId}
        isOpen={profileModalOpen}
        onClose={() => { setProfileModalOpen(false); setSelectedResidentId(null); }}
      />

      {/* Official Document Print & Download Modal */}
      <DocumentPrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        document={selectedPrintDoc}
      />

      {/* Document Info / Specifics Viewer Modal */}
      <DocumentInfoModal
        isOpen={isDocInfoOpen}
        onClose={() => setIsDocInfoOpen(false)}
        document={selectedInfoDoc}
        onUpdateStatus={(id, status) => handleUpdateDocStatus(id, status)}
        onPrint={(doc) => openPrintModal(doc)}
        canEdit={true}
      />

      {/* SMS Details & Message Viewer Modal */}
      <SmsDetailsModal
        isOpen={isSmsDetailsOpen}
        onClose={() => setIsSmsDetailsOpen(false)}
        notification={selectedSms}
        onComposeReply={(recipient, phone) => {
          setSmsRecipientName(recipient);
          setSmsPhone(phone);
          setIsSendSmsOpen(true);
        }}
      />

      {/* Dynamic Smart Clinical Intake Modal */}
      <SmartClinicalIntakeModal
        isOpen={isIntakeOpen}
        onClose={() => setIsIntakeOpen(false)}
        availableInventory={inventory}
        onSuccess={loadData}
        barangay={user?.barangay || 'Pianing'}
        attendingWorker={user?.name || 'Barangay Health Worker'}
        workerRole="bhw"
      />

      {/* Safe Batch SMS Due Dispatcher Modal */}
      <BatchSmsReminderModal
        isOpen={isBatchSmsOpen}
        onClose={() => setIsBatchSmsOpen(false)}
        initialService={batchSmsInitialService}
        duePatients={dueSmsItems}
        barangay={user?.barangay || 'Pianing'}
        attendingName={user?.name || 'BHW Health Worker'}
        onBatchSent={() => {
          loadData();
        }}
      />

      {/* ═══ MASTER RECORD NEW VACCINATION MODAL ═══ */}
      <Dialog open={isAddImmOpen} onOpenChange={setIsAddImmOpen}>
        <DialogContent className="bg-white max-w-xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl shadow-2xl border border-slate-200">
          <div className="p-5 border-b border-slate-100 bg-white sticky top-0 z-10 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Child Immunization (EPI)
              </span>
              <span className="text-xs text-slate-400 font-medium mr-6">Brgy. {user?.barangay || 'Pianing'}</span>
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900 mt-2 flex items-center gap-2">
              <Baby className="text-emerald-600" size={20} /> Record New Vaccination
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Schedule or record an immunization for a child.
            </DialogDescription>
          </div>

          <form onSubmit={handleCreateImmunization} className="p-5 space-y-4">
            {/* Child Name Fields (Split First / Middle / Last) with Census Autocomplete */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Child Information</p>
                {bhwMatchingChildren.length > 0 && bhwCSearchFocus && (
                  <span className="text-[10px] text-emerald-600 font-semibold animate-pulse">
                    Found in Census Registry ({bhwMatchingChildren.length})
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">First Name <span className="text-rose-500">*</span></Label>
                  <Input
                    value={newChildFirstName}
                    onChange={e => {
                      setNewChildFirstName(e.target.value);
                      setBhwCSearchFocus(true);
                    }}
                    onFocus={() => setBhwCSearchFocus(true)}
                    placeholder="e.g. Baby Maria"
                    required
                    className="h-9 text-xs mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Middle Name</Label>
                  <Input
                    value={newChildMiddleName}
                    onChange={e => {
                      setNewChildMiddleName(e.target.value);
                      setBhwCSearchFocus(true);
                    }}
                    onFocus={() => setBhwCSearchFocus(true)}
                    placeholder="e.g. Grace"
                    className="h-9 text-xs mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Last Name <span className="text-rose-500">*</span></Label>
                  <Input
                    value={newChildLastName}
                    onChange={e => {
                      setNewChildLastName(e.target.value);
                      setBhwCSearchFocus(true);
                    }}
                    onFocus={() => setBhwCSearchFocus(true)}
                    placeholder="e.g. Santos"
                    required
                    className="h-9 text-xs mt-1 rounded-xl"
                  />
                </div>
              </div>

              {/* Dynamic Child Auto-suggest dropdown */}
              {bhwCSearchFocus && bhwMatchingChildren.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-emerald-300 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                  <div className="p-1.5 bg-emerald-50/90 text-[10px] font-bold text-emerald-800 flex items-center justify-between px-3">
                    <span>Matching Minors in Census Registry ({bhwMatchingChildren.length})</span>
                    <button
                      type="button"
                      onClick={() => setBhwCSearchFocus(false)}
                      className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  {bhwMatchingChildren.map((c: any) => (
                    <button
                      key={`bhw-child-match-${c.id}`}
                      type="button"
                      onClick={() => selectBhwMatchedChild(c)}
                      className="w-full text-left p-2.5 hover:bg-emerald-50/60 transition-colors flex items-center justify-between text-xs cursor-pointer group"
                    >
                      <div>
                        <span className="font-bold text-slate-800 group-hover:text-emerald-700 block">
                          {c.first_name} {c.middle_name ? c.middle_name + ' ' : ''}{c.last_name}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {c.gender} · Purok {c.purok || '1'} · {c.date_of_birth || 'No DOB'}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[9px] bg-white border-emerald-300 text-emerald-700 shrink-0">
                        Auto-Fill
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sex & Guardian Details */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Sex <span className="text-rose-500">*</span></Label>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setNewChildGender('Male')}
                    className={`h-9 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      newChildGender === 'Male'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>👦</span> Male
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChildGender('Female')}
                    className={`h-9 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      newChildGender === 'Female'
                        ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>👧</span> Female
                  </button>
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-semibold text-slate-700">Parent / Guardian Name <span className="text-rose-500">*</span></Label>
                <Input
                  value={newGuardianName}
                  onChange={e => setNewGuardianName(e.target.value)}
                  placeholder="e.g. Angela Santos"
                  required
                  className="h-9 text-xs mt-1 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Parent Phone <span className="text-rose-500">*</span></Label>
                <Input
                  value={newParentPhone}
                  onChange={e => setNewParentPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="09182345678"
                  required
                  maxLength={11}
                  className="h-9 text-xs font-mono mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Status</Label>
                <Select value={newImmStatus} onValueChange={setNewImmStatus}>
                  <SelectTrigger className="h-9 text-xs mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Completed">Completed Now</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Physical Vitals */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Age (Months)</Label>
                <Input
                  value={newChildAge}
                  onChange={e => setNewChildAge(e.target.value)}
                  placeholder="e.g. 6"
                  className="h-9 text-xs mt-1 font-mono rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Weight (kg)</Label>
                <Input
                  value={newChildWeight}
                  onChange={e => setNewChildWeight(e.target.value)}
                  placeholder="e.g. 7.8"
                  className="h-9 text-xs mt-1 font-mono rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Height (cm)</Label>
                <Input
                  value={newChildHeight}
                  onChange={e => setNewChildHeight(e.target.value)}
                  placeholder="e.g. 66"
                  className="h-9 text-xs mt-1 font-mono rounded-xl"
                />
              </div>
            </div>

            {/* Vaccine Type & Dose */}
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2.5">
              <Label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Syringe size={14} className="text-emerald-600" /> Vaccine Formulation &amp; Batch
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700">Vaccine Type</Label>
                  <Select value={newVaccineName} onValueChange={setNewVaccineName}>
                    <SelectTrigger className="h-9 text-xs mt-1 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BCG">BCG (Tuberculosis)</SelectItem>
                      <SelectItem value="Hepatitis B">Hepatitis B (Birth Dose)</SelectItem>
                      <SelectItem value="Pentavalent (DPT-HepB-Hib)">Pentavalent (DPT-HepB-Hib)</SelectItem>
                      <SelectItem value="OPV (Oral Polio)">OPV (Oral Polio Vaccine)</SelectItem>
                      <SelectItem value="IPV (Inactivated Polio)">IPV (Inactivated Polio)</SelectItem>
                      <SelectItem value="PCV13">PCV13 (Pneumococcal)</SelectItem>
                      <SelectItem value="MMR (Measles-Mumps-Rubella)">MMR (Measles-Mumps-Rubella)</SelectItem>
                      <SelectItem value="Measles-Rubella (MR)">Measles-Rubella (MR)</SelectItem>
                      <SelectItem value="Vitamin A">Vitamin A Supplementation</SelectItem>
                      <SelectItem value="Other">Other (Custom Vaccine)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold text-slate-700">Dose Number</Label>
                  <Select value={newDoseNumber} onValueChange={setNewDoseNumber}>
                    <SelectTrigger className="h-9 text-xs mt-1 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dose 1">Dose 1</SelectItem>
                      <SelectItem value="Dose 2">⭐ Dose 2 (Follow-up)</SelectItem>
                      <SelectItem value="Dose 3">Dose 3</SelectItem>
                      <SelectItem value="Booster 1">Booster 1</SelectItem>
                      <SelectItem value="Booster 2">Booster 2</SelectItem>
                      <SelectItem value="Single Dose">Single Dose</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold text-slate-700">Batch / Lot #</Label>
                  <Input
                    value={newBatchLot}
                    onChange={e => setNewBatchLot(e.target.value)}
                    placeholder="LOT-2026-X9"
                    className="h-9 text-xs font-mono mt-1 rounded-xl bg-white"
                  />
                </div>
              </div>

              {newVaccineName === 'Other' && (
                <div className="pt-2">
                  <Label className="text-xs font-bold text-emerald-900">Custom Vaccine Name <span className="text-rose-500">*</span></Label>
                  <Input
                    value={newCustomVaccine}
                    onChange={e => setNewCustomVaccine(e.target.value)}
                    placeholder="e.g. Varicella, Typhoid..."
                    required
                    className="h-8 text-xs bg-white mt-1 border-emerald-300 rounded-xl"
                  />
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Date Administered</Label>
                <Input
                  type="date"
                  value={newDateGiven}
                  onChange={e => setNewDateGiven(e.target.value)}
                  className="h-9 text-xs mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Due Date</Label>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="h-9 text-xs mt-1 rounded-xl"
                />
              </div>
            </div>

            {/* Observations & Remarks with Quick Tags */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">Clinical Observations &amp; Remarks</Label>
                <span className="text-[10px] text-slate-400">Quick observation tags:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Cleared for routine vaccination',
                  'Normal post-vaccine reaction observed',
                  'Mild fever reported - paracetamol advised',
                  'Follow-up in 4 weeks scheduled',
                  'Mother educated on exclusive breastfeeding',
                  'Weight and growth on track'
                ].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setNewRemarks(prev => prev ? `${prev}. ${tag}` : tag)}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
              <Input
                value={newRemarks}
                onChange={e => setNewRemarks(e.target.value)}
                placeholder="e.g. Cleared for routine vaccination, advised paracetamol"
                className="h-9 text-xs mt-1 rounded-xl"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddImmOpen(false)}
                className="text-xs h-9 rounded-xl border-slate-200 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-5 gap-1.5 shadow-sm rounded-xl cursor-pointer"
              >
                <Check size={14} /> Save Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Compose SMS Notification Dialog */}
      <Dialog open={isSendSmsOpen} onOpenChange={setIsSendSmsOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Send className="text-blue-600" size={18} />
              Compose SMS Alert
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Directly dispatch an SMS alert to a resident mobile phone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendSms} className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Recipient Name <span className="text-red-500">*</span></Label>
              <Input
                value={smsRecipientName}
                onChange={e => setSmsRecipientName(e.target.value)}
                required
                placeholder="e.g. Sofia Martinez"
                className="h-9 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Mobile Phone Number <span className="text-red-500">*</span></Label>
              <Input
                value={smsPhone}
                onChange={e => setSmsPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                required
                placeholder="09226789012"
                maxLength={11}
                className="h-9 text-xs font-mono mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Alert Type</Label>
              <Select value={smsType} onValueChange={setSmsType}>
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Immunization Reminder">Immunization Reminder</SelectItem>
                  <SelectItem value="Maternal Checkup Alert">Maternal Checkup Alert</SelectItem>
                  <SelectItem value="Document Ready">Document Ready</SelectItem>
                  <SelectItem value="Account Verified">Account Verified</SelectItem>
                  <SelectItem value="Barangay Announcement">Barangay Announcement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">SMS Message <span className="text-red-500">*</span></Label>
              <textarea
                value={smsMessage}
                onChange={e => setSmsMessage(e.target.value)}
                rows={3}
                className="w-full border rounded-md p-2.5 text-xs border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 leading-relaxed"
                placeholder="Reminder: Baby Sofia is scheduled for MMR vaccine at Barangay Health Center tomorrow."
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSendSmsOpen(false)} className="text-xs">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-1.5 cursor-pointer">
                <Send size={13} /> Dispatch SMS Alert
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Supply Inventory Modal */}
      <Dialog open={isInventoryOpen} onOpenChange={setIsInventoryOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Package className="text-emerald-600" size={18} /> Add Supply Item
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Register vaccines, maternal vitamins, or clinic supplies into inventory.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddInventory} className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Item Name <span className="text-red-500">*</span></Label>
              <Input
                value={invName}
                onChange={e => setInvName(e.target.value)}
                placeholder="e.g. Pentavalent Vaccine"
                required
                className="h-9 text-xs mt-1 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Category</Label>
                <Select value={invCat} onValueChange={setInvCat}>
                  <SelectTrigger className="h-9 text-xs mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Vaccine (EPI)', 'Maternal Vitamin', 'Essential Medicine', 'Pediatric Supply', 'Family Planning', 'TB-DOTS Supply', 'Other'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Unit</Label>
                <Select value={invUnit} onValueChange={setInvUnit}>
                  <SelectTrigger className="h-9 text-xs mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['vials', 'tablets', 'capsules', 'packets', 'bottles', 'ampoules', 'units'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Stock Quantity <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  value={invStock}
                  onChange={e => setInvStock(e.target.value)}
                  placeholder="e.g. 50"
                  required
                  className="h-9 text-xs mt-1 rounded-xl font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Expiry Date</Label>
                <Input
                  type="date"
                  value={invExpiry}
                  onChange={e => setInvExpiry(e.target.value)}
                  className="h-9 text-xs mt-1 rounded-xl"
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsInventoryOpen(false)} className="text-xs rounded-xl">Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 font-bold cursor-pointer rounded-xl">
                <Check size={13} /> Save Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Restock Inventory Modal */}
      <Dialog open={isRestockOpen} onOpenChange={setIsRestockOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <PlusCircle className="text-emerald-600" size={18} /> Restock Item
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Add new stock received from RHU or DOH supply allocation.
            </DialogDescription>
          </DialogHeader>
          {restockTargetItem && (
            <form onSubmit={handleRestockSubmit} className="space-y-3 py-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{restockTargetItem.item_name}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Current Stock:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{restockTargetItem.stock} {restockTargetItem.unit}</span>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Quantity to Add ({restockTargetItem.unit}) <span className="text-red-500">*</span></Label>
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
    </div>
  );
}
