import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  RefreshCcw,
  Download,
  ChevronDown,
  Building2,
  FileText,
  MapPin,
  Sparkles
} from 'lucide-react';
import { apiService, Resident, HouseholdGroup, CensusAnalytics } from '../../services/api';
import { exportToCsv, downloadOfficialPdf } from '../../utils/exportCsv';
import ResidentProfileModal from './ResidentProfileModal';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import { toast } from 'sonner';

interface CensusEntryTabProps {
  user: any;
  onSync?: () => void;
  accentColor?: 'blue' | 'teal';
}

export default function CensusEntryTab({
  user,
  onSync,
  accentColor = 'blue'
}: CensusEntryTabProps) {
  const barangay = user?.barangay || 'Pianing';

  // Data state
  const [residents, setResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<HouseholdGroup[]>([]);
  const [censusStats, setCensusStats] = useState<CensusAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // View state
  const [censusViewMode, setCensusViewMode] = useState<'households' | 'table'>('households');
  const [selectedPurok, setSelectedPurok] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedHouseholds, setExpandedHouseholds] = useState<Record<string, boolean>>({});

  // Profile modal state
  const [selectedResidentId, setSelectedResidentId] = useState<number | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Registration modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [addMode, setAddMode] = useState<'new_household' | 'existing_household'>('new_household');

  // Registration form fields
  const [fFirstName, setFFirstName] = useState('');
  const [fMiddleName, setFMiddleName] = useState('');
  const [fLastName, setFLastName] = useState('');
  const [fDob, setFDob] = useState('');
  const [fGender, setFGender] = useState<'Male' | 'Female' | 'Other'>('Female');
  const [fCivilStatus, setFCivilStatus] = useState('Single');
  const [fPurok, setFPurok] = useState('1');
  const [fAddress, setFAddress] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fEmployment, setFEmployment] = useState<
    'Employed' | 'Unemployed' | 'Self-Employed' | 'Student' | 'Retired' | 'Minor'
  >('Employed');
  const [fYearsResidency, setFYearsResidency] = useState('');
  const [fHouseholdNum, setFHouseholdNum] = useState('');
  const [fFamilyName, setFFamilyName] = useState('');
  const [fIsHead, setFIsHead] = useState(true);
  const [fRelationship, setFRelationship] = useState('Head');

  // Accent styling
  const accent =
    accentColor === 'teal'
      ? {
          bg: 'bg-teal-600',
          hover: 'hover:bg-teal-700',
          light: 'bg-teal-50',
          text: 'text-teal-600',
          border: 'border-teal-200',
          pillActive: 'bg-white text-teal-700 shadow-xs border border-teal-200/60 font-bold',
          badgeActive: 'bg-teal-50 text-teal-700 font-bold',
        }
      : {
          bg: 'bg-blue-600',
          hover: 'hover:bg-blue-700',
          light: 'bg-blue-50',
          text: 'text-blue-600',
          border: 'border-blue-200',
          pillActive: 'bg-white text-blue-700 shadow-xs border border-slate-200/60 font-bold',
          badgeActive: 'bg-blue-50 text-blue-700 font-bold',
        };

  // Auto-generate standardized household number: HH-P{purok}-{count+1}
  const computeAutoHouseholdNum = (
    purokVal: string,
    hhList: HouseholdGroup[] = households,
    resList: Resident[] = residents
  ) => {
    const cleanP = (purokVal || '1').replace(/purok\s*/i, '').trim();
    const existingInP = hhList.filter(
      h =>
        (h.purok || '').replace(/purok\s*/i, '').trim() === cleanP ||
        (h.household_number || '').includes(`HH-P${cleanP}`)
    );
    const resInP = resList.filter(
      r =>
        (r.purok || '').replace(/purok\s*/i, '').trim() === cleanP &&
        r.household_number
    );
    const count = Math.max(
      existingInP.length,
      new Set(resInP.map(r => r.household_number)).size
    );
    return `HH-P${cleanP}-${String(count + 1).padStart(3, '0')}`;
  };

  // Load all census data dynamically
  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [resData, hhData, statsData] = await Promise.all([
        apiService.getResidents(barangay, selectedPurok).catch(() => []),
        apiService.getHouseholds(barangay, selectedPurok).catch(() => []),
        apiService.getCensusStats(barangay, selectedPurok).catch(() => null),
      ]);
      setResidents(Array.isArray(resData) ? resData : []);
      setHouseholds(Array.isArray(hhData) ? hhData : []);
      if (statsData) setCensusStats(statsData);
    } catch {
      // silent catch for resilient UI
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);

    // Real-time synchronization broadcast channel listener
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('barangay_health_sync');
      channel.onmessage = event => {
        if (event.data?.type === 'HEALTH_DATA_SYNC') {
          loadData(false);
        }
      };
    } catch {}

    // Polling fail-safe every 5 seconds
    const interval = setInterval(() => {
      loadData(false);
    }, 5000);

    return () => {
      if (channel) channel.close();
      clearInterval(interval);
    };
  }, [barangay, selectedPurok]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData(false);
    setIsRefreshing(false);
    toast.success('Census records refreshed');
  };

  // Open Registration Modal
  const openAddModal = () => {
    resetForm();
    const p = selectedPurok === 'all' ? '1' : selectedPurok;
    setFPurok(p);
    const autoHh = computeAutoHouseholdNum(p, households, residents);
    setFHouseholdNum(autoHh);
    setIsAddOpen(true);
  };

  // Reset form
  const resetForm = () => {
    setFFirstName('');
    setFMiddleName('');
    setFLastName('');
    setFDob('');
    setFGender('Female');
    setFCivilStatus('Single');
    setFPurok('1');
    setFAddress('');
    setFPhone('');
    setFEmail('');
    setFEmployment('Employed');
    setFYearsResidency('');
    setAddMode('new_household');
    const autoHh = computeAutoHouseholdNum('1', households, residents);
    setFHouseholdNum(autoHh);
    setFFamilyName('');
    setFIsHead(true);
    setFRelationship('Head');
  };

  const handlePurokChange = (newPurok: string) => {
    setFPurok(newPurok);
    if (addMode === 'new_household') {
      const autoHh = computeAutoHouseholdNum(newPurok, households, residents);
      setFHouseholdNum(autoHh);
    } else {
      const cleanP = newPurok.replace(/purok\s*/i, '').trim();
      const inP = households.filter(
        h =>
          (h.purok || '').includes(cleanP) ||
          (h.household_number || '').includes(`HH-P${cleanP}`)
      );
      if (inP.length > 0) {
        setFHouseholdNum(inP[0].household_number);
        setFFamilyName(inP[0].family_name);
      }
    }
  };

  // Save new resident to Census
  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fFirstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!fLastName.trim()) {
      toast.error('Last name is required');
      return;
    }
    setIsSaving(true);
    try {
      const finalHhNum =
        fHouseholdNum.trim() ||
        computeAutoHouseholdNum(fPurok || '1', households, residents);
      const fullAddress =
        fAddress.trim() ||
        `Purok ${fPurok || '1'}, Brgy. ${barangay}, Butuan City`;

      const newResident = await apiService.createResident({
        first_name: fFirstName.trim(),
        middle_name: fMiddleName.trim() || undefined,
        last_name: fLastName.trim(),
        date_of_birth: fDob || undefined,
        gender: fGender,
        civil_status: fCivilStatus,
        purok: fPurok.trim() || '1',
        barangay: barangay,
        address: fullAddress,
        phone: fPhone.trim() || undefined,
        email: fEmail.trim() || undefined,
        employment_status: fEmployment,
        years_of_residency: fYearsResidency.trim() || undefined,
        household_number: finalHhNum,
        family_name: fFamilyName.trim() || `${fLastName.trim()} Family`,
        is_head_of_household: fIsHead,
        relationship_to_head: fRelationship,
        verification_status: 'Verified',
      });

      setResidents(prev => [newResident, ...prev]);
      toast.success(
        `${fFirstName} ${fLastName} added to Census (${finalHhNum})! Synchronized across all portals.`
      );
      setIsAddOpen(false);
      resetForm();

      if (onSync) onSync();
      try {
        const ch = new BroadcastChannel('barangay_health_sync');
        ch.postMessage({ type: 'HEALTH_DATA_SYNC', timestamp: Date.now() });
        ch.close();
      } catch {}

      loadData(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add resident. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered residents list
  const filteredResidents = useMemo(() => {
    return residents.filter(r => {
      // Purok filter
      if (selectedPurok !== 'all') {
        const cleanP = selectedPurok.replace(/purok\s*/i, '').trim();
        const rP = (r.purok || '').replace(/purok\s*/i, '').trim();
        if (rP !== cleanP && !(r.address || '').toLowerCase().includes(`purok ${cleanP}`)) {
          return false;
        }
      }

      // Search query
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const fullName = `${r.first_name || ''} ${r.middle_name || ''} ${r.last_name || ''}`.toLowerCase();
      const hhNum = (r.household_number || '').toLowerCase();
      const famName = (r.family_name || '').toLowerCase();
      const phone = (r.phone || '').toLowerCase();
      return (
        fullName.includes(q) ||
        hhNum.includes(q) ||
        famName.includes(q) ||
        phone.includes(q)
      );
    });
  }, [residents, selectedPurok, search]);

  // Filtered households list
  const filteredHouseholds = useMemo(() => {
    return households.filter(hh => {
      // Purok filter
      if (selectedPurok !== 'all') {
        const cleanP = selectedPurok.replace(/purok\s*/i, '').trim();
        if (
          !hh.purok.includes(cleanP) &&
          !hh.household_number.includes(`HH-P${cleanP}`)
        ) {
          return false;
        }
      }

      // Search query
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const matchNum = hh.household_number.toLowerCase().includes(q);
      const matchFam = hh.family_name.toLowerCase().includes(q);
      const matchHead = (hh.head_name || '').toLowerCase().includes(q);
      const matchMember = hh.members?.some(m =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q)
      );
      return matchNum || matchFam || matchHead || matchMember;
    });
  }, [households, selectedPurok, search]);

  // Export Census to CSV
  const handleExportCsv = () => {
    if (filteredResidents.length === 0) {
      toast.info('No census records to export');
      return;
    }
    const rows = filteredResidents.map(r => ({
      'Resident ID': r.id,
      'Household Number': r.household_number || `HH-P${r.purok || '1'}-${r.id}`,
      'Family Name': r.family_name || r.last_name,
      'First Name': r.first_name,
      'Middle Name': r.middle_name || '',
      'Last Name': r.last_name,
      'Age': (r as any).age ?? '',
      'Gender': r.gender || '',
      'Civil Status': r.civil_status || '',
      'Purok': r.purok || '',
      'Barangay': r.barangay || barangay,
      'Phone': r.phone || '',
      'Employment Status': r.employment_status || 'Employed',
      'Head of Household': r.is_head_of_household ? 'Yes' : 'No',
      'Relationship to Head': r.relationship_to_head || '',
    }));
    exportToCsv(
      `Barangay_${barangay}_Population_Census_${selectedPurok === 'all' ? 'All_Puroks' : 'Purok_' + selectedPurok}_${new Date().toISOString().slice(0, 10)}.csv`,
      rows
    );
    toast.success('Census CSV exported successfully');
  };

  // Export Census to PDF
  const handleExportPdf = () => {
    const activePurokLabel =
      selectedPurok === 'all'
        ? 'All Puroks (1 to 7)'
        : `Purok ${selectedPurok}`;

    downloadOfficialPdf({
      title: 'Barangay Population & Household Census Report',
      subtitle: `Barangay ${barangay}, Butuan City — ${activePurokLabel}`,
      filename: `Barangay_${barangay}_Population_Census_${selectedPurok === 'all' ? 'All_Puroks' : 'Purok_' + selectedPurok}`,
      barangay: barangay,
      orientation: 'landscape',
      preparedBy: user?.name || 'Healthcare Worker',
      preparedByTitle:
        user?.role === 'nurse'
          ? 'Public Health Nurse'
          : user?.role === 'bhw'
          ? 'Barangay Health Worker'
          : 'Barangay Civil Registrar',
      department: 'Barangay Health Center & Civil Registry',
      stats: [
        {
          label: 'Total Households',
          value: censusStats?.total_households ?? filteredHouseholds.length,
        },
        {
          label: 'Total Families',
          value: censusStats?.total_families ?? filteredHouseholds.length,
        },
        {
          label: 'Total Population',
          value: censusStats?.total_population ?? filteredResidents.length,
        },
        {
          label: 'Senior Citizens',
          value: `${censusStats?.senior_citizens?.total ?? 0} (M: ${censusStats?.senior_citizens?.male ?? 0}, F: ${censusStats?.senior_citizens?.female ?? 0})`,
        },
        {
          label: 'Children / Minors',
          value: censusStats?.children_count ?? 0,
        },
        {
          label: 'Employment Rate',
          value: `${censusStats?.employment?.rate_percentage ?? 80}% (${censusStats?.employment?.employed ?? 0} Employed / ${censusStats?.employment?.unemployed ?? 0} Unemployed)`,
        },
      ],
      tables: [
        {
          title: `Civil Inhabitants Roster (${activePurokLabel})`,
          headers: [
            'ID',
            'Household #',
            'Family Name',
            'Full Name',
            'Age',
            'Gender',
            'Purok',
            'Employment',
          ],
          rows: filteredResidents.map(r => [
            r.id,
            r.household_number || `HH-P${r.purok || '1'}-${r.id}`,
            r.family_name || r.last_name,
            `${r.first_name} ${r.middle_name ? r.middle_name + ' ' : ''}${r.last_name}`,
            `${(r as any).age ?? 25} yo`,
            r.gender || 'N/A',
            `Purok ${r.purok || '1'}`,
            r.employment_status || 'Employed',
          ]),
        },
      ],
    });
    toast.success('Population Census PDF downloaded');
  };

  return (
    <div className="space-y-6">
      {/* ═══ TOP HEADER & VIEW CONTROLS ═══ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Populations
            </h2>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${accent.light} ${accent.text} border ${accent.border}`}>
              {censusStats?.total_population ?? filteredResidents.length} Inhabitants
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Barangay {barangay} • Civil Inhabitants &amp; Household Registry
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          {/* View Mode Switcher */}
          <div className="inline-flex rounded-lg p-1 bg-slate-100 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCensusViewMode('households')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                censusViewMode === 'households'
                  ? accent.pillActive
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Households
            </button>
            <button
              type="button"
              onClick={() => setCensusViewMode('table')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                censusViewMode === 'table'
                  ? accent.pillActive
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Inhabitants Table
            </button>
          </div>

          <Button
            onClick={handleExportPdf}
            variant="outline"
            size="sm"
            className="text-xs h-9 gap-1.5 border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer rounded-lg font-medium"
          >
            <Download size={13} className="text-slate-600" />
            Download PDF
          </Button>

          <Button
            onClick={handleExportCsv}
            variant="outline"
            size="sm"
            className="text-xs h-9 gap-1.5 border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer rounded-lg font-medium"
          >
            <Download size={13} className="text-slate-600" />
            Download CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs h-9 gap-1.5 border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer rounded-lg transition-all"
          >
            <RefreshCcw
              size={13}
              className={
                isRefreshing
                  ? `animate-spin ${accent.text}`
                  : 'text-slate-500'
              }
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>

          <Button
            onClick={openAddModal}
            className={`${accent.bg} ${accent.hover} text-white text-xs shadow-xs h-9 cursor-pointer font-semibold rounded-lg`}
          >
            + Register Resident
          </Button>
        </div>
      </div>

      {/* ═══ 6 CLEAN DEMOGRAPHIC STATISTIC CARDS ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-slate-200/90 bg-white shadow-xs rounded-xl hover:border-slate-300 transition-colors">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Households
            </p>
            <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              {censusStats?.total_households ?? filteredHouseholds.length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              Residential units
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 bg-white shadow-xs rounded-xl hover:border-slate-300 transition-colors">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Families
            </p>
            <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              {censusStats?.total_families ?? filteredHouseholds.length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              Family clusters
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 bg-white shadow-xs rounded-xl hover:border-slate-300 transition-colors">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Population
            </p>
            <p className={`text-2xl font-black ${accent.text} tracking-tight mt-1`}>
              {censusStats?.total_population ?? filteredResidents.length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              Active inhabitants
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 bg-white shadow-xs rounded-xl hover:border-slate-300 transition-colors">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Seniors (60+)
            </p>
            <p className="text-2xl font-black text-amber-700 tracking-tight mt-1">
              {censusStats?.senior_citizens?.total ?? 0}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              M: {censusStats?.senior_citizens?.male ?? 0} • F:{' '}
              {censusStats?.senior_citizens?.female ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 bg-white shadow-xs rounded-xl hover:border-slate-300 transition-colors">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Children (&lt;18)
            </p>
            <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              {censusStats?.children_count ?? 0}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              Minors &amp; dependents
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 bg-white shadow-xs rounded-xl hover:border-slate-300 transition-colors">
          <CardContent className="p-3.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Employment
            </p>
            <p className="text-2xl font-black text-emerald-700 tracking-tight mt-1">
              {censusStats?.employment?.employed ?? 0}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              {censusStats?.employment?.unemployed ?? 0} Unemployed (
              {censusStats?.employment?.rate_percentage ?? 0}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ CLEAN SEGMENTED PUROK FILTER STRIP ═══ */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-100/80 rounded-xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setSelectedPurok('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedPurok === 'all'
              ? accent.pillActive
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <span>All Puroks</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              selectedPurok === 'all'
                ? accent.badgeActive
                : 'bg-slate-200/80 text-slate-600'
            }`}
          >
            {censusStats?.total_population ?? residents.length}
          </span>
        </button>

        {[1, 2, 3, 4, 5, 6, 7].map(p => {
          const pData = censusStats?.purok_breakdown?.find(b =>
            b.purok.includes(String(p))
          );
          const count = pData
            ? pData.population
            : residents.filter(
                r =>
                  (r.purok || '').replace(/purok\s*/i, '').trim() === String(p)
              ).length;
          const isSelected = selectedPurok === String(p);

          return (
            <button
              key={`purok-btn-${p}`}
              type="button"
              onClick={() => setSelectedPurok(String(p))}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? accent.pillActive
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span>Purok {p}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isSelected
                    ? accent.badgeActive
                    : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ═══ SEARCH BAR ═══ */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
        <Input
          placeholder="Search resident name, family, or household #..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-xs bg-white border-slate-200 rounded-xl"
        />
      </div>

      {/* ═══ VIEW 1: HOUSEHOLDS DIRECTORY VIEW ═══ */}
      {censusViewMode === 'households' && (
        <div className="space-y-3">
          {filteredHouseholds.map(hh => {
            const isExpanded = Boolean(expandedHouseholds[hh.household_number]);

            return (
              <Card
                key={hh.household_number}
                className="border-slate-200/80 bg-white shadow-xs rounded-xl overflow-hidden hover:border-slate-300 transition-all"
              >
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                        {hh.household_number}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        {hh.family_name} Family
                      </h3>
                      <span className="text-xs text-slate-500 font-medium">
                        • {hh.purok}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Head of Family:{' '}
                      <strong className="text-slate-800">
                        {hh.head_name || 'Not Designated'}
                      </strong>
                    </p>

                    {/* Demographic indicators per household */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${accent.light} ${accent.text} border ${accent.border}`}>
                        {hh.total_members}{' '}
                        {hh.total_members === 1 ? 'Member' : 'Members'}
                      </span>
                      {hh.seniors_count > 0 ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300">
                          {hh.seniors_count} Senior Citizen(s)
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200/70">
                          0 Seniors
                        </span>
                      )}
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200/70">
                        {hh.employed_count} Employed • {hh.unemployed_count}{' '}
                        Unemployed
                      </span>
                      {hh.children_count > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/80">
                          {hh.children_count} Minor(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-stretch sm:self-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAddMode('existing_household');
                        setFHouseholdNum(hh.household_number);
                        setFFamilyName(hh.family_name);
                        setFPurok(hh.purok.replace(/purok\s*/i, '').trim());
                        setFIsHead(false);
                        setFRelationship('Son');
                        setIsAddOpen(true);
                      }}
                      className={`h-8 text-xs font-semibold ${accent.text} border-slate-300 hover:${accent.light} cursor-pointer shadow-xs rounded-lg`}
                    >
                      + Add Member
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setExpandedHouseholds(prev => ({
                          ...prev,
                          [hh.household_number]: !prev[hh.household_number],
                        }));
                      }}
                      className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs rounded-lg flex items-center gap-1.5"
                    >
                      <span>
                        {isExpanded ? 'Hide' : 'View Members'} (
                        {hh.members?.length || 0})
                      </span>
                      <ChevronDown
                        size={14}
                        className={`text-slate-400 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </Button>
                  </div>
                </div>

                {/* Expanded Members Table */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-3 overflow-x-auto">
                    <Table className="w-full text-left border-collapse text-xs">
                      <TableHeader>
                        <TableRow className="border-b border-slate-200">
                          <TableHead className="py-2 text-slate-600 font-semibold">
                            Name &amp; Role
                          </TableHead>
                          <TableHead className="py-2 text-slate-600 font-semibold">
                            Relationship
                          </TableHead>
                          <TableHead className="py-2 text-slate-600 font-semibold">
                            Age &amp; Category
                          </TableHead>
                          <TableHead className="py-2 text-slate-600 font-semibold">
                            Gender
                          </TableHead>
                          <TableHead className="py-2 text-slate-600 font-semibold">
                            Birthday
                          </TableHead>
                          <TableHead className="py-2 text-slate-600 font-semibold">
                            Employment
                          </TableHead>
                          <TableHead className="py-2 text-right text-slate-600 font-semibold pr-2">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100">
                        {(hh.members || []).map(m => (
                          <TableRow
                            key={`hh-mem-${m.id}`}
                            className="hover:bg-white transition-colors"
                          >
                            <TableCell className="py-2">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>
                                  {m.first_name}{' '}
                                  {m.middle_name ? m.middle_name + ' ' : ''}
                                  {m.last_name}
                                </span>
                                {m.is_head_of_household && (
                                  <span className={`text-[10px] ${accent.light} ${accent.text} font-bold px-1.5 py-0.2 rounded border ${accent.border}`}>
                                    Head
                                  </span>
                                )}
                              </div>
                              {m.phone && (
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  {m.phone}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-slate-700">
                              {m.relationship_to_head ||
                                (m.is_head_of_household ? 'Head' : 'Member')}
                            </TableCell>
                            <TableCell className="py-2">
                              <span className="font-bold text-slate-900">
                                {m.age != null ? `${m.age} yo` : '—'}
                              </span>
                              {m.is_senior && (
                                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                  Senior
                                </span>
                              )}
                              {m.is_child && (
                                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                                  Child
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-slate-700">
                              {m.gender || '—'}
                            </TableCell>
                            <TableCell className="py-2 font-mono text-slate-600">
                              {m.date_of_birth
                                ? new Date(m.date_of_birth).toLocaleDateString(
                                    'en-US',
                                    {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    }
                                  )
                                : '—'}
                            </TableCell>
                            <TableCell className="py-2">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                  m.employment_status === 'Employed' ||
                                  m.employment_status === 'Self-Employed'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : m.employment_status === 'Unemployed'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {m.employment_status || 'Employed'}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 text-right pr-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedResidentId(m.id);
                                  setIsProfileOpen(true);
                                }}
                                className={`h-6 px-2 text-xs ${accent.text} hover:${accent.light} cursor-pointer font-semibold`}
                              >
                                View Profile
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            );
          })}

          {filteredHouseholds.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
              No households registered for this selection.
            </div>
          )}
        </div>
      )}

      {/* ═══ VIEW 2: ALL INHABITANTS TABLE VIEW ═══ */}
      {censusViewMode === 'table' && (
        <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full text-left border-collapse min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-slate-50/80 border-b border-slate-200">
                    <TableHead className="w-14 pl-4 text-xs font-semibold text-slate-600">
                      ID
                    </TableHead>
                    <TableHead className="w-44 text-xs font-semibold text-slate-600">
                      Household &amp; Family
                    </TableHead>
                    <TableHead className="w-56 text-xs font-semibold text-slate-600">
                      Full Name
                    </TableHead>
                    <TableHead className="w-28 text-xs font-semibold text-slate-600">
                      Age &amp; Category
                    </TableHead>
                    <TableHead className="w-20 text-xs font-semibold text-slate-600">
                      Gender
                    </TableHead>
                    <TableHead className="w-28 text-xs font-semibold text-slate-600">
                      Birthday
                    </TableHead>
                    <TableHead className="w-24 text-xs font-semibold text-slate-600">
                      Purok
                    </TableHead>
                    <TableHead className="w-32 text-xs font-semibold text-slate-600">
                      Employment
                    </TableHead>
                    <TableHead className="w-24 text-xs font-semibold text-slate-600 text-right pr-4">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {filteredResidents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-12 text-slate-400 text-xs"
                      >
                        No inhabitants found matching criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResidents.map((res, idx) => (
                      <TableRow
                        key={`res-rec-${res.id}-${idx}`}
                        className="text-xs hover:bg-slate-50/80 transition-colors"
                      >
                        <TableCell className="pl-4 font-mono text-slate-500 font-semibold">
                          #{res.id}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-[11px] font-bold text-slate-700 block">
                            {res.household_number ||
                              `HH-P${res.purok || '1'}-${res.id}`}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {res.family_name || res.last_name} Family
                          </span>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedResidentId(res.id);
                              setIsProfileOpen(true);
                            }}
                            className={`font-bold text-slate-900 hover:${accent.text} hover:underline transition-colors text-left block cursor-pointer`}
                          >
                            {res.first_name} {res.last_name}
                          </button>
                          {res.phone && (
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              {res.phone}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-slate-900">
                            {(res as any).age != null
                              ? `${(res as any).age} yo`
                              : '—'}
                          </span>
                          {(res as any).is_senior && (
                            <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                              Senior
                            </span>
                          )}
                          {(res as any).is_child && (
                            <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                              Child
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {res.gender || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-slate-600">
                          {res.date_of_birth
                            ? new Date(res.date_of_birth).toLocaleDateString(
                                'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                }
                              )
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-slate-700">
                            Purok {res.purok || '1'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                              res.employment_status === 'Employed' ||
                              res.employment_status === 'Self-Employed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : res.employment_status === 'Unemployed'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {res.employment_status || 'Employed'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedResidentId(res.id);
                              setIsProfileOpen(true);
                            }}
                            className={`h-6 px-2 text-xs ${accent.text} hover:${accent.light} cursor-pointer font-semibold`}
                          >
                            View Profile
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ OFFICIAL RESIDENT PROFILE MODAL ═══ */}
      <ResidentProfileModal
        residentId={selectedResidentId}
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          setSelectedResidentId(null);
        }}
        currentUserName={user?.name}
      />

      {/* ═══ COMPREHENSIVE RESIDENT REGISTRATION MODAL ═══ */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-white max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl ${accent.light} ${accent.text} flex items-center justify-center shrink-0 border ${accent.border}`}>
                <UserPlus size={20} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Register Resident to Census
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Add citizen to official Barangay {barangay} Population &amp; Household Registry.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleAddResident} className="space-y-4 pt-3">
            {/* Household Mode Switcher */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <Label className="text-xs font-bold text-slate-700">
                Household Assignment Mode
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode('new_household');
                    const autoHh = computeAutoHouseholdNum(fPurok || '1', households, residents);
                    setFHouseholdNum(autoHh);
                    setFIsHead(true);
                    setFRelationship('Head');
                  }}
                  className={`p-2 rounded-lg text-xs font-semibold border transition-all text-left cursor-pointer ${
                    addMode === 'new_household'
                      ? `${accent.light} ${accent.text} ${accent.border} border-2`
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <p className="font-bold">New Household</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Auto-generate sequence ID</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAddMode('existing_household');
                    const cleanP = (fPurok || '1').replace(/purok\s*/i, '').trim();
                    const inP = households.filter(h => (h.purok || '').includes(cleanP));
                    if (inP.length > 0) {
                      setFHouseholdNum(inP[0].household_number);
                      setFFamilyName(inP[0].family_name);
                    }
                    setFIsHead(false);
                    setFRelationship('Son');
                  }}
                  className={`p-2 rounded-lg text-xs font-semibold border transition-all text-left cursor-pointer ${
                    addMode === 'existing_household'
                      ? `${accent.light} ${accent.text} ${accent.border} border-2`
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <p className="font-bold">Join Existing Household</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Select existing family in Purok</p>
                </button>
              </div>

              {addMode === 'new_household' ? (
                <div className="pt-1 flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-600">Auto-Generated Household Number:</span>
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {fHouseholdNum || computeAutoHouseholdNum(fPurok || '1', households, residents)}
                  </span>
                </div>
              ) : (
                <div className="pt-1 space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-600">Select Household / Family</Label>
                  <Select
                    value={fHouseholdNum}
                    onValueChange={(val) => {
                      setFHouseholdNum(val);
                      const found = households.find(h => h.household_number === val);
                      if (found) {
                        setFFamilyName(found.family_name);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Select existing household..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {households
                        .filter(h => {
                          const cleanP = (fPurok || '1').replace(/purok\s*/i, '').trim();
                          return (h.purok || '').includes(cleanP) || (h.household_number || '').includes(`HH-P${cleanP}`);
                        })
                        .map(h => (
                          <SelectItem key={h.household_number} value={h.household_number}>
                            {h.household_number} — {h.family_name} Family ({h.purok})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Name Fields */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Citizen Name
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">First Name *</Label>
                  <Input
                    value={fFirstName}
                    onChange={e => setFFirstName(e.target.value)}
                    placeholder="e.g. Juan"
                    required
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Middle Name</Label>
                  <Input
                    value={fMiddleName}
                    onChange={e => setFMiddleName(e.target.value)}
                    placeholder="e.g. Dela"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Last Name *</Label>
                  <Input
                    value={fLastName}
                    onChange={e => setFLastName(e.target.value)}
                    placeholder="e.g. Cruz"
                    required
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Demographics */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Date of Birth</Label>
                <Input
                  type="date"
                  value={fDob}
                  onChange={e => setFDob(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Gender</Label>
                <Select
                  value={fGender}
                  onValueChange={v => setFGender(v as any)}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Civil Status</Label>
                <Select
                  value={fCivilStatus}
                  onValueChange={setFCivilStatus}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                    <SelectItem value="Separated">Separated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location & Household details */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Purok *</Label>
                <Select value={fPurok} onValueChange={handlePurokChange}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map(p => (
                      <SelectItem key={p} value={String(p)}>
                        Purok {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Family Name</Label>
                <Input
                  value={fFamilyName}
                  onChange={e => setFFamilyName(e.target.value)}
                  placeholder={fLastName ? `${fLastName} Family` : 'Family Name'}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Relationship to Head</Label>
                <Select
                  value={fRelationship}
                  onValueChange={setFRelationship}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Head">Head</SelectItem>
                    <SelectItem value="Spouse">Spouse</SelectItem>
                    <SelectItem value="Son">Son</SelectItem>
                    <SelectItem value="Daughter">Daughter</SelectItem>
                    <SelectItem value="Parent">Parent</SelectItem>
                    <SelectItem value="Sibling">Sibling</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contact & Employment */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Contact Mobile Phone</Label>
                <Input
                  value={fPhone}
                  onChange={e => setFPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="09XXXXXXXXX"
                  maxLength={11}
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">Employment Status</Label>
                <Select
                  value={fEmployment}
                  onValueChange={v => setFEmployment(v as any)}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Employed">Employed</SelectItem>
                    <SelectItem value="Self-Employed">Self-Employed</SelectItem>
                    <SelectItem value="Unemployed">Unemployed</SelectItem>
                    <SelectItem value="Student">Student</SelectItem>
                    <SelectItem value="Retired">Retired</SelectItem>
                    <SelectItem value="Minor">Minor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Address */}
            <div>
              <Label className="text-xs">Residential Street Address</Label>
              <Input
                value={fAddress}
                onChange={e => setFAddress(e.target.value)}
                placeholder={`Purok ${fPurok}, Brgy. ${barangay}, Butuan City`}
                className="h-8 text-xs mt-1"
              />
            </div>

            {/* Head of Household Checkbox */}
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                id="is-head-cb"
                checked={fIsHead}
                onChange={e => {
                  setFIsHead(e.target.checked);
                  if (e.target.checked) setFRelationship('Head');
                }}
                className="rounded border-slate-300 cursor-pointer"
              />
              <label
                htmlFor="is-head-cb"
                className="text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Designate as Primary Head of Household
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className={`${accent.bg} ${accent.hover} text-white text-xs h-9 font-semibold`}
              >
                {isSaving ? 'Registering...' : 'Register to Census'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
