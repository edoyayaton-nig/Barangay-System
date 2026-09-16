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
import { Switch } from './ui/switch';
import { SystemUser, UserPermissions } from '../../services/api';
import {
  Shield,
  Sliders,
  FileText,
  UserCheck,
  Users,
  Heart,
  BarChart,
  History,
  Tag,
  Database,
  Building2,
  Lock,
  CheckCircle2,
  RefreshCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

interface UserPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SystemUser | null;
  onSave: (userId: number, permissions: UserPermissions) => Promise<void>;
}

export default function UserPermissionsModal({
  isOpen,
  onClose,
  user,
  onSave
}: UserPermissionsModalProps) {
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize permissions state whenever the user changes or modal opens
  useEffect(() => {
    if (user) {
      const role = user.role;
      const initial: UserPermissions = {
        can_create_document: user.permissions?.can_create_document ?? (role === 'admin' || role === 'staff'),
        can_process_documents: user.permissions?.can_process_documents ?? (role === 'admin' || role === 'staff'),
        can_manage_categories: user.permissions?.can_manage_categories ?? false,
        can_verify_residents: user.permissions?.can_verify_residents ?? (role === 'admin' || role === 'staff'),
        can_manage_residents: user.permissions?.can_manage_residents ?? (role === 'admin' || role === 'staff'),
        can_view_census: user.permissions?.can_view_census ?? (role === 'admin'),
        can_access_health: user.permissions?.can_access_health ?? (role === 'bhw' || role === 'nurse' || role === 'admin'),
        can_generate_reports: user.permissions?.can_generate_reports ?? (role === 'admin'),
        can_view_logs: user.permissions?.can_view_logs ?? false,
        can_manage_users: user.permissions?.can_manage_users ?? (role === 'admin'),
        can_access_system: user.permissions?.can_access_system ?? false,
      };
      setPermissions(initial);
    }
  }, [user, isOpen]);

  if (!user) return null;

  const handleToggle = (key: keyof UserPermissions, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Quick Preset Actions
  const applyRoleDefaults = () => {
    const role = user.role;
    setPermissions({
      can_create_document: role === 'admin' || role === 'staff',
      can_process_documents: role === 'admin' || role === 'staff',
      can_manage_categories: false,
      can_verify_residents: role === 'admin' || role === 'staff',
      can_manage_residents: role === 'admin' || role === 'staff',
      can_view_census: role === 'admin',
      can_access_health: role === 'bhw' || role === 'nurse' || role === 'admin',
      can_generate_reports: role === 'admin',
      can_view_logs: false,
      can_manage_users: role === 'admin',
      can_access_system: false,
    });
    toast.info('Reset to standard role defaults');
  };

  const applyGrantAll = () => {
    setPermissions({
      can_create_document: true,
      can_process_documents: true,
      can_manage_categories: true,
      can_verify_residents: true,
      can_manage_residents: true,
      can_view_census: true,
      can_access_health: true,
      can_generate_reports: true,
      can_view_logs: true,
      can_manage_users: true,
      can_access_system: true,
    });
    toast.success('All module permissions granted');
  };

  const applyReadOnly = () => {
    setPermissions({
      can_create_document: false,
      can_process_documents: false,
      can_manage_categories: false,
      can_verify_residents: false,
      can_manage_residents: true,
      can_view_census: true,
      can_access_health: false,
      can_generate_reports: true,
      can_view_logs: true,
      can_manage_users: false,
      can_access_system: false,
    });
    toast.info('Applied View & Audit Only access');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(user.id, permissions);
      toast.success(`Access permissions updated for ${user.name}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabel =
    user.role === 'admin' ? 'Barangay Administrator' :
      user.role === 'staff' ? 'Barangay Records Clerk' :
        user.role === 'bhw' ? 'Barangay Health Worker' :
          user.role === 'nurse' ? 'Health Center Nurse' :
            user.role === 'superadmin' ? 'Super Administrator' : 'System User';

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-slate-200">
        {/* Header with Personnel Dossier */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 font-bold text-sm shadow-xs">
                {user.profile_photo ? (
                  <img src={user.profile_photo} alt={user.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{user.name}</h3>
                  <Badge variant="outline" className="text-[10px] font-bold border-purple-300 text-purple-700 bg-purple-50">
                    {roleLabel}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 font-mono">
                  {user.email} • Barangay {user.barangay || 'Pianing'}
                </p>
              </div>
            </div>
          </div>

          {/* Super Admin Notice */}
          <div className="mt-3.5 flex items-start gap-2 bg-purple-50/80 border border-purple-200/80 rounded-xl p-2.5 text-xs text-purple-900">
            <Shield size={16} className="text-purple-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-[11px] uppercase tracking-wide text-purple-800">
                Super Admin Free-Will Access Control
              </p>
              <p className="text-[11px] text-purple-700 leading-relaxed">
                Toggle access to specific desks, clearance forms, and management features for this account. Custom toggles override the default role behavior.
              </p>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500">Quick Presets:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyRoleDefaults}
              className="h-7 text-[11px] border-slate-200 hover:bg-slate-100 cursor-pointer font-medium rounded-lg"
            >
              <RefreshCcw size={11} className="mr-1" />
              Role Defaults
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyGrantAll}
              className="h-7 text-[11px] border-emerald-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer font-medium rounded-lg"
            >
              <CheckCircle2 size={11} className="mr-1" />
              Grant Full Access
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyReadOnly}
              className="h-7 text-[11px] border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer font-medium rounded-lg"
            >
              <Lock size={11} className="mr-1" />
              View &amp; Audit Only
            </Button>
          </div>
        </div>

        {/* Form Body with Granular Switch Toggles */}
        <form onSubmit={handleFormSubmit} className="p-5 space-y-5">
          {/* Group 1: Document Clearance & Issuance Services */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <FileText size={15} className="text-indigo-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Document &amp; Clearance Services
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* can_process_documents */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <p className="text-xs font-bold text-slate-800">Document Processing Desk</p>
                  <p className="text-[11px] text-slate-500">
                    Authorize user to view incoming document queues, change status (Processing, Ready, Completed), and print certificates.
                  </p>
                </div>
                <Switch
                  checked={Boolean(permissions.can_process_documents)}
                  onCheckedChange={val => handleToggle('can_process_documents', val)}
                />
              </div>

              {/* can_create_document */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <p className="text-xs font-bold text-slate-800">Issue Document / Direct Clearance Form</p>
                  <p className="text-[11px] text-slate-500">
                    Allow staff to open the "+ New Document Request" walk-in issuance form to file clearances on behalf of residents.
                  </p>
                </div>
                <Switch
                  checked={Boolean(permissions.can_create_document)}
                  onCheckedChange={val => handleToggle('can_create_document', val)}
                />
              </div>

              {/* can_manage_categories */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-purple-200 bg-purple-50/20 hover:border-purple-300 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-purple-950">Category Manager Access</p>
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[9px] font-bold">Delegable</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Grant this staff member permission to create, edit, activate, or deactivate official document clearance categories.
                  </p>
                </div>
                <Switch
                  checked={Boolean(permissions.can_manage_categories)}
                  onCheckedChange={val => handleToggle('can_manage_categories', val)}
                />
              </div>
            </div>
          </div>

          {/* Group 2: Resident & Civic Governance */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <Users size={15} className="text-blue-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Resident &amp; Civic Governance
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* can_verify_residents */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-200 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <p className="text-xs font-bold text-slate-800">Citizen Identity Verification Desk</p>
                  <p className="text-[11px] text-slate-500">
                    Review submitted government IDs and approve or reject resident registration applications.
                  </p>
                </div>
                <Switch
                  checked={Boolean(permissions.can_verify_residents)}
                  onCheckedChange={val => handleToggle('can_verify_residents', val)}
                />
              </div>

              {/* can_manage_residents */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-200 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <p className="text-xs font-bold text-slate-800">Resident Records Catalog &amp; Dossiers</p>
                  <p className="text-[11px] text-slate-500">
                    Search, view 360 dossiers, and maintain civilian resident registry profiles in the barangay.
                  </p>
                </div>
                <Switch
                  checked={Boolean(permissions.can_manage_residents)}
                  onCheckedChange={val => handleToggle('can_manage_residents', val)}
                />
              </div>

              {/* can_view_census */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-200 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <p className="text-xs font-bold text-slate-800">Community Census &amp; Demographics</p>
                  <p className="text-[11px] text-slate-500">
                    View purok-level population breakdowns, household grouping clusters, and demographic ratios.
                  </p>
                </div>
                <Switch
                  checked={Boolean(permissions.can_view_census)}
                  onCheckedChange={val => handleToggle('can_view_census', val)}
                />
              </div>
            </div>
          </div>

          {/* Group 3: Health & Clinical Services */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <Heart size={15} className="text-teal-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Health &amp; Clinical Services
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* can_access_health */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-teal-200 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <p className="text-xs font-bold text-slate-800">Health Center Intake &amp; Appointments</p>
                  <p className="text-[11px] text-slate-500">
                    Manage patient appointments, clinical consultations, medicine inventory, and immunization tracking.
                  </p>
                </div>
                <Switch
                  checked={Boolean(permissions.can_access_health)}
                  onCheckedChange={val => handleToggle('can_access_health', val)}
                />
              </div>
            </div>
          </div>

          {/* Group 4: Administration, Reports & Security */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <Sliders size={15} className="text-violet-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                System Administration &amp; Security
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* can_generate_reports */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-violet-200 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <p className="text-xs font-bold text-slate-800">System Reports &amp; Official Exports</p>
                  <p className="text-[11px] text-slate-500">
                    Export personnel, resident data, clearance transaction summaries to CSV and official print templates.
                  </p>
                </div>
                <Switch
                  checked={Boolean(permissions.can_generate_reports)}
                  onCheckedChange={val => handleToggle('can_generate_reports', val)}
                />
              </div>

              {/* can_view_logs */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-violet-200 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-slate-800">Security &amp; Activity Audit Stream</p>
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[9px] font-bold">Audit</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Authorize user to view system activity logs, credential updates, and historical administrative actions.
                  </p>
                </div>
                <Switch
                  checked={Boolean(permissions.can_view_logs)}
                  onCheckedChange={val => handleToggle('can_view_logs', val)}
                />
              </div>

              {/* can_manage_users */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-violet-200 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <p className="text-xs font-bold text-slate-800">Staff Account Management</p>
                  <p className="text-[11px] text-slate-500">
                    Create new staff accounts, reset passwords, or activate/deactivate personnel within the barangay.
                  </p>
                </div>
                <Switch
                  checked={Boolean(permissions.can_manage_users)}
                  onCheckedChange={val => handleToggle('can_manage_users', val)}
                />
              </div>

              {/* can_access_system */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-violet-200 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <p className="text-xs font-bold text-slate-800">Municipal Diagnostics &amp; System Backup</p>
                  <p className="text-[11px] text-slate-500">
                    Allow access to database health diagnostics, maintenance mode controls, and backup utilities.
                  </p>
                </div>
                <Switch
                  checked={Boolean(permissions.can_access_system)}
                  onCheckedChange={val => handleToggle('can_access_system', val)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="border-slate-200 text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold h-9 px-4 gap-1.5 shadow-xs cursor-pointer"
            >
              {isSaving ? <RefreshCcw size={13} className="animate-spin" /> : <Shield size={13} />}
              Save Access Permissions
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
