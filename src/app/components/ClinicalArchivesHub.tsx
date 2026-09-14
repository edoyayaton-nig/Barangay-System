import React, { useState, useEffect } from 'react';
import {
  Archive,
  Search,
  Calendar,
  Stethoscope,
  Heart,
  Baby,
  Printer,
  Download,
  FileText,
  User,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
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
  const [activeCategory, setActiveCategory] = useState<'consultations' | 'maternal' | 'immunizations' | 'schedules'>('consultations');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [archivesData, setArchivesData] = useState<{
    consultations: any[];
    maternal: any[];
    immunizations: any[];
    schedules: any[];
  }>({
    consultations: [],
    maternal: [],
    immunizations: [],
    schedules: []
  });

  useEffect(() => {
    loadArchives();
  }, []);

  const loadArchives = async () => {
    setLoading(true);
    try {
      const data = await apiService.getClinicalArchives();
      setArchivesData(data);
    } catch (err: any) {
      toast.error('Failed to load clinical archives');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintCertificate = (item: any) => {
    printOfficialReport({
      title: 'BARANGAY HEALTH CENTER MEDICAL CERTIFICATE',
      subtitle: `Clinical Health Record Archive — Barangay ${barangay}`,
      preparedBy: item.attending_worker || 'Healthcare Worker',
      preparedByTitle: 'Barangay Healthcare Personnel',
      department: 'Barangay Health Center',
      stats: [
        { label: 'Patient Name', value: item.patient_name || item.child_name || item.mother_name, color: '#0d9488' },
        { label: 'Date of Record', value: item.encounter_date || item.date_administered || 'Archived', color: '#2563eb' }
      ],
      tables: [{
        title: 'Clinical Encounter Specifics',
        headers: ['Detail Field', 'Record Information'],
        rows: [
          ['Patient Name', item.patient_name || item.child_name || item.mother_name || 'N/A'],
          ['Contact Phone', item.contact_number || item.parent_phone || 'N/A'],
          ['Age / Gender', `${item.age || '—'} / ${item.gender || 'Female'}`],
          ['Encounter Type', item.program_type || 'Consultation'],
          ['Vital Signs', `BP: ${item.bp || '120/80'} | Temp: ${item.temp || '36.5'}°C | Wt: ${item.weight || '—'}kg`],
          ['Chief Complaint', item.chief_complaint || 'N/A'],
          ['Clinical Diagnosis', item.diagnosis || 'Health assessment completed'],
          ['Prescriptions & Treatment', item.prescribed_meds || item.treatment || 'Counseling given'],
          ['Attending Staff', item.attending_worker || 'Healthcare Officer']
        ]
      }]
    });
    toast.success('Medical Certificate generated for printing!');
  };

  return (
    <div className="space-y-4">
      {/* ═══ ARCHIVES HEADER ═══ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Archive className="text-teal-700" size={20} />
              Barangay {barangay} — Clinical Archives &amp; EHR Records
            </h2>
            <Badge className="bg-teal-100 text-teal-800 border-teal-300 text-[10px] font-bold">
              Permanent Records
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Centralized historical repository of completed consultations, maternal deliveries, completed immunizations, and past schedules.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <Input
              placeholder="Search archive by patient name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 text-xs pl-8 bg-white border-slate-200"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadArchives}
            className="h-9 text-xs border-slate-300 gap-1.5 cursor-pointer"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ═══ ARCHIVE CATEGORY PILLS ═══ */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'consultations', label: 'Consultations Archive', icon: Stethoscope, count: archivesData.consultations.length },
          { id: 'maternal', label: 'Completed Maternal Archive', icon: Heart, count: archivesData.maternal.length },
          { id: 'immunizations', label: 'FIC Immunizations Archive', icon: Baby, count: archivesData.immunizations.length },
          { id: 'schedules', label: 'Past Clinic Schedules', icon: Calendar, count: archivesData.schedules.length }
        ].map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <cat.icon size={15} />
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isActive ? 'bg-teal-800 text-teal-100' : 'bg-slate-100 text-slate-600'
              }`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ═══ ARCHIVE CONTENT TABLE ═══ */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Patient Name / Record</TableHead>
                <TableHead className="text-xs">Service Category</TableHead>
                <TableHead className="text-xs">Date of Encounter</TableHead>
                <TableHead className="text-xs">Clinical Summary / Details</TableHead>
                <TableHead className="text-xs">Attending Personnel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeCategory === 'consultations' && (
                archivesData.consultations.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-xs text-slate-400">No archived consultations yet.</TableCell></TableRow>
                ) : (
                  archivesData.consultations
                    .filter(c => !searchQuery || (c.patient_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((c, idx) => (
                      <TableRow key={idx} className="text-xs hover:bg-slate-50/70">
                        <TableCell>
                          <div className="font-bold text-slate-800">{c.patient_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{c.contact_number || 'No contact'} · {c.purok}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px]">
                            {c.program_type || 'Consultation'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-slate-600">
                          {c.encounter_date ? new Date(c.encounter_date).toLocaleDateString() : 'Recent'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          <span className="font-semibold text-slate-700">{c.diagnosis || 'Completed'}</span>
                          <span className="text-slate-400 ml-1">({c.prescribed_meds || c.treatment || 'Advised'})</span>
                        </TableCell>
                        <TableCell className="text-slate-600">{c.attending_worker || 'Nurse'}</TableCell>
                      </TableRow>
                    ))
                )
              )}

              {activeCategory === 'maternal' && (
                archivesData.maternal.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-xs text-slate-400">No completed maternal records in archive.</TableCell></TableRow>
                ) : (
                  archivesData.maternal
                    .filter(m => !searchQuery || (m.mother_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((m, idx) => (
                      <TableRow key={idx} className="text-xs hover:bg-slate-50/70">
                        <TableCell>
                          <div className="font-bold text-slate-800">{m.mother_name}</div>
                          <div className="text-[11px] text-slate-400">Age: {m.age || '—'} · Gravida: {m.gravida || 1}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 text-[10px]">
                            Maternal Care
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-slate-600">
                          {m.created_at ? new Date(m.created_at).toLocaleDateString() : 'Archived'}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-slate-700">EDD: {m.edd || 'Completed'}</span>
                          <span className="text-slate-400 ml-1">· FHR: {m.fetal_heart_rate || '140'} bpm</span>
                        </TableCell>
                        <TableCell className="text-slate-600">{m.attending_nurse || 'Nurse'}</TableCell>
                      </TableRow>
                    ))
                )
              )}

              {activeCategory === 'immunizations' && (
                archivesData.immunizations.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-xs text-slate-400">No fully completed immunizations archived.</TableCell></TableRow>
                ) : (
                  archivesData.immunizations
                    .filter(i => !searchQuery || (i.child_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((i, idx) => (
                      <TableRow key={idx} className="text-xs hover:bg-slate-50/70">
                        <TableCell>
                          <div className="font-bold text-slate-800">{i.child_name}</div>
                          <div className="text-[11px] text-slate-400">Phone: {i.parent_phone || '—'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                            {i.vaccine_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-slate-600">
                          {i.date_administered ? new Date(i.date_administered).toLocaleDateString() : 'Completed'}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 size={12} /> Dose {i.dose_number} Completed
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600">{i.administered_by || 'BHW'}</TableCell>
                      </TableRow>
                    ))
                )
              )}

              {activeCategory === 'schedules' && (
                archivesData.schedules.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-xs text-slate-400">No past schedules found.</TableCell></TableRow>
                ) : (
                  archivesData.schedules.map((s, idx) => (
                    <TableRow key={idx} className="text-xs hover:bg-slate-50/70">
                      <TableCell className="font-bold text-slate-800">{s.title}</TableCell>
                      <TableCell><Badge variant="outline">{s.service_type}</Badge></TableCell>
                      <TableCell className="font-mono text-slate-600">{s.day || 'Concluded'}</TableCell>
                      <TableCell className="text-slate-600">{s.location || 'Health Center'}</TableCell>
                      <TableCell className="text-slate-600">{s.assigned_bhw || 'Healthcare Team'}</TableCell>
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
