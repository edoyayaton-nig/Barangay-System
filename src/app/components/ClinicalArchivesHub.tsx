import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  Calendar,
  Stethoscope,
  Heart,
  Baby,
  Printer,
  FileText,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Pill,
  Filter,
  Eye,
  RefreshCw,
  FolderCheck,
  AlertCircle,
  Phone,
  MapPin,
  CalendarCheck,
  ArrowUpDown,
  X
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { apiService } from '../../services/api';
import { printOfficialReport } from '../../utils/exportCsv';
import { toast } from 'sonner';

interface ClinicalArchivesHubProps {
  barangay?: string;
  onSelectPatient?: (name: string, phone?: string) => void;
}

export default function ClinicalArchivesHub({
  barangay = 'Pianing',
  onSelectPatient
}: ClinicalArchivesHubProps) {
  const [activeCategory, setActiveCategory] = useState<
    'all' | 'consultations' | 'maternal' | 'immunizations' | 'appointments'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [archivesData, setArchivesData] = useState<{
    consultations: any[];
    maternal: any[];
    immunizations: any[];
    schedules: any[];
    appointments: any[];
  }>({
    consultations: [],
    maternal: [],
    immunizations: [],
    schedules: [],
    appointments: []
  });

  useEffect(() => {
    loadArchives();
  }, [barangay]);

  const loadArchives = async () => {
    setLoading(true);
    try {
      const data = await apiService.getClinicalArchives(barangay);
      setArchivesData({
        consultations: data.consultations || [],
        maternal: data.maternal || [],
        immunizations: data.immunizations || [],
        schedules: data.schedules || [],
        appointments: data.appointments || []
      });
    } catch (err: any) {
      toast.error('Failed to load clinical records');
    } finally {
      setLoading(false);
    }
  };

  // Metrics calculation
  const totalCompletedAppointments = archivesData.appointments.filter(a => a.status === 'Completed').length;
  const totalCancelledAppointments = archivesData.appointments.filter(a => a.status === 'Cancelled' || a.status === 'No Show').length;
  const totalRecordsCount =
    archivesData.consultations.length +
    archivesData.maternal.length +
    archivesData.immunizations.length +
    archivesData.appointments.length;

  // Unified list of records for "All Records" tab
  const unifiedRecords = useMemo(() => {
    const list: any[] = [];

    archivesData.consultations.forEach(c => {
      list.push({
        ...c,
        recordCategory: 'consultation',
        categoryLabel: c.program_type || 'General Consultation',
        patientName: c.patient_name || 'Anonymous Resident',
        contactPhone: c.contact_number || '',
        recordDate: c.encounter_date || c.created_at || 'Recent',
        status: 'Completed',
        detailsSummary: c.diagnosis ? `Diagnosis: ${c.diagnosis}` : (c.chief_complaint ? `Complaint: ${c.chief_complaint}` : 'Encounter completed'),
        attendingStaff: c.attending_worker || 'Attending Nurse'
      });
    });

    archivesData.maternal.forEach(m => {
      list.push({
        ...m,
        recordCategory: 'maternal',
        categoryLabel: 'Maternal & Prenatal Care',
        patientName: m.mother_name || 'Maternal Patient',
        contactPhone: m.contact_number || '',
        recordDate: m.created_at || 'Recent',
        status: 'Completed',
        detailsSummary: `EDD: ${m.edd || 'Concluded'} · Gravida ${m.gravida || 1} / Para ${m.para || 0}${m.aog_weeks ? ` · ${m.aog_weeks} wks AOG` : ''}`,
        attendingStaff: m.attending_nurse || 'Attending Nurse'
      });
    });

    archivesData.immunizations.forEach(i => {
      list.push({
        ...i,
        recordCategory: 'immunization',
        categoryLabel: `NIP Vaccine: ${i.vaccine_name || i.vaccine_given || 'Standard'}`,
        patientName: i.child_name || 'Infant Record',
        contactPhone: i.parent_phone || i.contact_number || '',
        recordDate: i.date_administered || i.date_given || 'Completed',
        status: 'Completed',
        detailsSummary: `Dose ${i.dose_number || 1} Administered${i.batch_lot || i.batch_number ? ` · Lot: ${i.batch_lot || i.batch_number}` : ''}`,
        attendingStaff: i.administered_by || i.attending_nurse || 'Health Center Staff'
      });
    });

    archivesData.appointments.forEach(a => {
      const isCancelled = a.status === 'Cancelled' || a.status === 'No Show';
      list.push({
        ...a,
        recordCategory: 'appointment',
        categoryLabel: `Appointment: ${a.service_type || 'Clinic Visit'}`,
        patientName: a.resident_name || 'Resident Applicant',
        contactPhone: a.resident_phone || '',
        recordDate: a.scheduled_date || a.preferred_date || 'Appointment Date',
        status: isCancelled ? 'Cancelled' : 'Completed',
        detailsSummary: isCancelled
          ? `Did Not Return / Cancelled: ${a.bhw_notes || 'Patient did not return for scheduled slot'}`
          : `Slot: ${a.scheduled_time || 'Done'} · Attending: ${a.attending_bhw || 'Health Staff'}`,
        attendingStaff: a.attending_bhw || 'Healthcare Officer'
      });
    });

    // Sort by date
    return list.sort((a, b) => {
      const dateA = new Date(a.recordDate).getTime() || 0;
      const dateB = new Date(b.recordDate).getTime() || 0;
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [archivesData, sortOrder]);

  // Filter records
  const filteredRecords = useMemo(() => {
    let result = unifiedRecords;

    if (activeCategory !== 'all') {
      if (activeCategory === 'consultations') {
        result = result.filter(r => r.recordCategory === 'consultation');
      } else if (activeCategory === 'maternal') {
        result = result.filter(r => r.recordCategory === 'maternal');
      } else if (activeCategory === 'immunizations') {
        result = result.filter(r => r.recordCategory === 'immunization');
      } else if (activeCategory === 'appointments') {
        result = result.filter(r => r.recordCategory === 'appointment');
      }
    }

    if (statusFilter !== 'all') {
      result = result.filter(r => {
        if (statusFilter === 'completed') return r.status === 'Completed';
        if (statusFilter === 'cancelled') return r.status === 'Cancelled';
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.patientName || '').toLowerCase().includes(q) ||
        (r.contactPhone || '').toLowerCase().includes(q) ||
        (r.categoryLabel || '').toLowerCase().includes(q) ||
        (r.detailsSummary || '').toLowerCase().includes(q) ||
        (r.appointment_code || '').toLowerCase().includes(q) ||
        (r.prescribed_meds || '').toLowerCase().includes(q) ||
        (r.attendingStaff || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [unifiedRecords, activeCategory, statusFilter, searchQuery]);

  const handleOpenDetailModal = (record: any) => {
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
  };

  const handlePrintCertificate = (item: any) => {
    const pName = item.patientName || item.patient_name || item.child_name || item.mother_name || item.resident_name || 'Resident';
    const cPhone = item.contactPhone || item.contact_number || item.parent_phone || item.resident_phone || 'N/A';
    const sType = item.categoryLabel || item.program_type || item.service_type || 'Clinical Care';
    const rDate = item.recordDate || item.encounter_date || item.date_administered || item.scheduled_date || 'Official Record';
    const staff = item.attendingStaff || item.attending_worker || item.attending_nurse || item.attending_bhw || 'Barangay Healthcare Personnel';

    printOfficialReport({
      title: 'BARANGAY HEALTH CENTER CLINICAL RECORD SUMMARY',
      subtitle: `Official Health Record Dossier — Barangay ${barangay}`,
      preparedBy: staff,
      preparedByTitle: 'Attending Healthcare Officer',
      department: 'Barangay Health Center Records Division',
      stats: [
        { label: 'Patient Name', value: pName, color: '#0d9488' },
        { label: 'Record Status', value: item.status || 'Recorded', color: item.status === 'Cancelled' ? '#e11d48' : '#2563eb' }
      ],
      tables: [{
        title: 'Clinical Encounter & Service Specifics',
        headers: ['Detail Field', 'Record Information'],
        rows: [
          ['Patient / Resident Name', pName],
          ['Contact Phone', cPhone],
          ['Encounter Category', sType],
          ['Encounter Date', String(rDate)],
          ['Status', item.status || 'Completed'],
          ['Clinical Vitals', `BP: ${item.bp || '120/80'} | Temp: ${item.temp || '36.5'}°C | Wt: ${item.weight || '—'}kg`],
          ['Diagnosis / Subject', item.diagnosis || item.chief_complaint || item.detailsSummary || 'General assessment'],
          ['Medications / Prescriptions', item.prescribed_meds || item.treatment || 'Consultation counseling'],
          ['Notes / Remarks', item.bhw_notes || item.remarks || item.detailsSummary || 'Official clinical record'],
          ['Attending Healthcare Staff', staff]
        ]
      }]
    });
    toast.success(`Official Record printed for ${pName}`);
  };

  return (
    <div className="space-y-4">
      {/* ═══ OFFICIAL HEADER ═══ */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-2xs">
              <ClipboardList size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Patient &amp; Clinical Records
                </h2>
                <Badge className="bg-teal-100 text-teal-800 border border-teal-200 text-[10px] font-bold">
                  Barangay {barangay}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanent health registry tracking consultations, maternal dossiers, child immunizations, and resolved appointments.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={loadArchives}
            disabled={loading}
            className="h-9 text-xs border-slate-200 gap-1.5 cursor-pointer bg-white hover:bg-slate-50 text-slate-700 rounded-xl"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh Records
          </Button>
        </div>
      </div>

      {/* ═══ INTERACTIVE STAT METRIC CARDS (Click to Filter) ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Total Records */}
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
            activeCategory === 'all'
              ? 'bg-teal-50/80 border-teal-400 ring-2 ring-teal-600/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold shrink-0">
            <FolderCheck size={18} />
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 font-mono">{totalRecordsCount}</div>
            <div className="text-[11px] font-medium text-slate-500">All Records</div>
          </div>
        </button>

        {/* Consultations */}
        <button
          type="button"
          onClick={() => setActiveCategory('consultations')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
            activeCategory === 'consultations'
              ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-600/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold shrink-0">
            <Stethoscope size={18} />
          </div>
          <div>
            <div className="text-lg font-black text-blue-900 font-mono">{archivesData.consultations.length}</div>
            <div className="text-[11px] font-medium text-slate-500">Consultations</div>
          </div>
        </button>

        {/* Maternal Dossiers */}
        <button
          type="button"
          onClick={() => setActiveCategory('maternal')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
            activeCategory === 'maternal'
              ? 'bg-pink-50/80 border-pink-400 ring-2 ring-pink-600/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-pink-100 text-pink-800 flex items-center justify-center font-bold shrink-0">
            <Heart size={18} />
          </div>
          <div>
            <div className="text-lg font-black text-pink-900 font-mono">{archivesData.maternal.length}</div>
            <div className="text-[11px] font-medium text-slate-500">Maternal Care</div>
          </div>
        </button>

        {/* Immunizations */}
        <button
          type="button"
          onClick={() => setActiveCategory('immunizations')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
            activeCategory === 'immunizations'
              ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-600/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
            <Baby size={18} />
          </div>
          <div>
            <div className="text-lg font-black text-amber-900 font-mono">{archivesData.immunizations.length}</div>
            <div className="text-[11px] font-medium text-slate-500">Immunizations</div>
          </div>
        </button>

        {/* Appointments */}
        <button
          type="button"
          onClick={() => setActiveCategory('appointments')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 col-span-2 sm:col-span-1 ${
            activeCategory === 'appointments'
              ? 'bg-violet-50/80 border-violet-400 ring-2 ring-violet-600/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-800 flex items-center justify-center font-bold shrink-0">
            <CalendarCheck size={18} />
          </div>
          <div>
            <div className="text-lg font-black text-violet-900 font-mono">
              {totalCompletedAppointments + totalCancelledAppointments}
            </div>
            <div className="text-[10px] font-medium text-slate-500">
              Appts ({totalCompletedAppointments} done · {totalCancelledAppointments} cancel)
            </div>
          </div>
        </button>
      </div>

      {/* ═══ FILTER & SEARCH CONTROLS ═══ */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All Records', count: totalRecordsCount },
            { id: 'consultations', label: 'Consultations & Rx', count: archivesData.consultations.length },
            { id: 'maternal', label: 'Maternal Care', count: archivesData.maternal.length },
            { id: 'immunizations', label: 'Child Immunizations', count: archivesData.immunizations.length },
            { id: 'appointments', label: 'Appointment Records', count: archivesData.appointments.length }
          ].map(tab => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                  isActive ? 'bg-teal-800 text-teal-100' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar, Status Filter & Sorting */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-slate-100">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <Input
              placeholder="Search by patient name, phone, diagnosis, or medication..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 text-xs pl-8 pr-8 bg-slate-50 border-slate-200 rounded-xl focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              {[
                { id: 'all', label: 'All Status' },
                { id: 'completed', label: 'Completed' },
                { id: 'cancelled', label: 'Cancelled / Did Not Return' }
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatusFilter(s.id as any)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold whitespace-nowrap ${
                    statusFilter === s.id
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="h-9 px-3 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl flex items-center gap-1.5 cursor-pointer font-medium"
              title={`Sort by Date: ${sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}`}
            >
              <ArrowUpDown size={13} />
              <span className="hidden sm:inline">{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ RECORDS TABLE ═══ */}
      <Card className="border-slate-200 bg-white shadow-xs overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 border-b border-slate-200">
                  <TableHead className="text-xs font-bold text-slate-700 py-3">Patient Dossier</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-3">Service Category</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-3">Record Date</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-3">Clinical Findings &amp; Rx</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-3">Status</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-14">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                        <ClipboardList size={24} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No clinical records found</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {searchQuery || statusFilter !== 'all'
                          ? 'Try resetting your search query or status filter.'
                          : 'Completed encounters and cancelled visits will automatically appear here.'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((rec, idx) => (
                    <TableRow key={idx} className="text-xs hover:bg-slate-50/70 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            rec.recordCategory === 'maternal'
                              ? 'bg-pink-100 text-pink-800'
                              : rec.recordCategory === 'immunization'
                              ? 'bg-amber-100 text-amber-800'
                              : rec.recordCategory === 'appointment'
                              ? 'bg-violet-100 text-violet-800'
                              : 'bg-teal-100 text-teal-800'
                          }`}>
                            {rec.patientName ? rec.patientName.charAt(0).toUpperCase() : 'R'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {rec.patientName}
                              {rec.appointment_code && (
                                <span className="font-mono text-[10px] text-violet-700 bg-violet-50 px-1.5 py-0.2 rounded border border-violet-200">
                                  {rec.appointment_code}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              {rec.contactPhone ? (
                                <>
                                  <Phone size={10} /> {rec.contactPhone}
                                </>
                              ) : (
                                <span className="italic text-slate-400">No contact number</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            rec.recordCategory === 'consultation'
                              ? 'bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-semibold'
                              : rec.recordCategory === 'maternal'
                              ? 'bg-pink-50 text-pink-700 border-pink-200 text-[10px] font-semibold'
                              : rec.recordCategory === 'immunization'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold'
                              : 'bg-violet-50 text-violet-700 border-violet-200 text-[10px] font-semibold'
                          }
                        >
                          {rec.categoryLabel}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-mono text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar size={11} className="text-slate-400" />
                          {rec.recordDate && rec.recordDate.includes('-')
                            ? new Date(rec.recordDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                            : rec.recordDate}
                        </div>
                      </TableCell>

                      <TableCell className="max-w-xs">
                        <div className="font-semibold text-slate-800 truncate" title={rec.detailsSummary}>
                          {rec.detailsSummary}
                        </div>
                        {rec.prescribed_meds && (
                          <div className="text-[10px] text-teal-700 font-mono truncate mt-0.5 flex items-center gap-1" title={rec.prescribed_meds}>
                            <Pill size={10} className="shrink-0" />
                            <span>{rec.prescribed_meds}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Attending: {rec.attendingStaff}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={
                            rec.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800 border-0 font-bold text-[10px]'
                              : 'bg-rose-100 text-rose-800 border-0 font-bold text-[10px]'
                          }
                        >
                          {rec.status === 'Completed' ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 size={11} /> Completed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <XCircle size={11} /> Cancelled / Did Not Return
                            </span>
                          )}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDetailModal(rec)}
                            className="h-7 text-[11px] border-slate-200 text-slate-700 hover:bg-slate-50 gap-1 rounded-lg cursor-pointer font-medium"
                          >
                            <Eye size={11} /> View Record
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePrintCertificate(rec)}
                            className="h-7 text-[11px] text-teal-700 hover:text-teal-800 hover:bg-teal-50 gap-1 rounded-lg cursor-pointer"
                            title="Print official medical record report"
                          >
                            <Printer size={11} /> Print
                          </Button>
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

      {/* ═══ INTERACTIVE RECORD DETAILS MODAL ═══ */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-slate-200 bg-white rounded-3xl shadow-2xl">
          <DialogHeader className="p-5 bg-slate-50/80 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold shadow-2xs">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Clinical Record Dossier
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Official Barangay {barangay} Health Record Details
                  </DialogDescription>
                </div>
              </div>
              {selectedRecord && (
                <Badge
                  className={
                    selectedRecord.status === 'Completed'
                      ? 'bg-emerald-100 text-emerald-800 border-0 font-bold'
                      : 'bg-rose-100 text-rose-800 border-0 font-bold'
                  }
                >
                  {selectedRecord.status === 'Completed' ? 'Official Record' : 'Did Not Return / Cancelled'}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {selectedRecord && (
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              {/* Alert Notice if Patient Did Not Return / Cancelled */}
              {selectedRecord.status === 'Cancelled' && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-xs">
                    <XCircle size={14} className="text-rose-600" /> Patient Did Not Return / Appointment Cancelled
                  </div>
                  <div className="text-[11px] text-rose-700">
                    {selectedRecord.bhw_notes || 'This record was archived because the patient did not show up or cancelled the appointment.'}
                  </div>
                </div>
              )}

              {/* Patient Basic Info Card */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 text-sm">{selectedRecord.patientName}</div>
                  <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 font-semibold">
                    {selectedRecord.categoryLabel}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Contact Phone</span>
                    <span className="font-mono font-medium">{selectedRecord.contactPhone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Record Date</span>
                    <span className="font-mono font-medium">{selectedRecord.recordDate || 'Recorded'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Attending Officer</span>
                    <span className="font-medium text-slate-800">{selectedRecord.attendingStaff || 'Health Personnel'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Jurisdiction</span>
                    <span className="font-medium text-slate-800">Barangay {barangay}</span>
                  </div>
                </div>
              </div>

              {/* Vitals or Encounter Metrics (if present) */}
              {(selectedRecord.bp || selectedRecord.temp || selectedRecord.weight || selectedRecord.heartRate) && (
                <div className="bg-teal-50/50 p-3.5 rounded-2xl border border-teal-100 space-y-2">
                  <span className="text-[11px] font-bold text-teal-900 flex items-center gap-1">
                    <Stethoscope size={13} className="text-teal-700" /> Recorded Vital Signs
                  </span>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-white p-2 rounded-xl border border-teal-100">
                      <div className="text-[10px] text-slate-400">BP</div>
                      <div className="font-bold text-slate-800 font-mono">{selectedRecord.bp || '120/80'}</div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-teal-100">
                      <div className="text-[10px] text-slate-400">Temp</div>
                      <div className="font-bold text-slate-800 font-mono">{selectedRecord.temp || '36.5'}°C</div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-teal-100">
                      <div className="text-[10px] text-slate-400">Weight</div>
                      <div className="font-bold text-slate-800 font-mono">{selectedRecord.weight || '—'} kg</div>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-teal-100">
                      <div className="text-[10px] text-slate-400">Heart Rate</div>
                      <div className="font-bold text-slate-800 font-mono">{selectedRecord.heartRate || '—'} bpm</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Clinical Assessment / Diagnosis / Notes */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-800 text-xs">Summary &amp; Clinical Assessment</div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed">
                  {selectedRecord.detailsSummary || selectedRecord.diagnosis || selectedRecord.chief_complaint || 'Encounter concluded and saved.'}
                </div>
              </div>

              {/* Prescribed Medications / Dispensed Stock */}
              {selectedRecord.prescribed_meds && (
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Pill size={13} className="text-teal-600" /> Prescriptions &amp; Dispensed Quantities
                  </div>
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-emerald-900 font-mono text-xs">
                    {selectedRecord.prescribed_meds}
                  </div>
                </div>
              )}

              {/* Appointment Notes & Remarks */}
              {(selectedRecord.bhw_notes || selectedRecord.resident_notes) && (
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <AlertCircle size={13} className="text-slate-600" /> Staff Remarks &amp; Notes
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 space-y-1">
                    {selectedRecord.resident_notes && (
                      <div><strong>Resident Note:</strong> {selectedRecord.resident_notes}</div>
                    )}
                    {selectedRecord.bhw_notes && (
                      <div><strong>Staff Note:</strong> {selectedRecord.bhw_notes}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDetailModalOpen(false)}
              className="text-xs cursor-pointer rounded-xl"
            >
              Close
            </Button>
            {selectedRecord && (
              <Button
                size="sm"
                onClick={() => {
                  handlePrintCertificate(selectedRecord);
                  setIsDetailModalOpen(false);
                }}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs gap-1.5 cursor-pointer shadow-xs rounded-xl"
              >
                <Printer size={13} /> Print Official Record
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
