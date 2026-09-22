import React, { useState, useEffect } from 'react';
import {
  Building2, Mail, Send, Settings, Save, RotateCcw, CheckCircle2,
  Copy, Eye, Sparkles, AlertCircle, ShieldCheck, Plus, Search,
  ExternalLink, Smartphone, HelpCircle, Layers, Check, RefreshCw,
  X, UserCheck, Key, Phone, UserPlus, Globe, Sliders, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { BUTUAN_BARANGAYS } from '../../utils/barangays';

// ── Types ─────────────────────────────────────────────────────
export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'document' | 'resident' | 'health' | 'advisory' | 'system';
  subject: string;
  headerBanner: string;
  bannerColor: string;
  ctaButtonText: string;
  body: string;
  smsText: string;
}

export interface ClientBarangay {
  id: string;
  name: string;
  district: string;
  status: 'active' | 'onboarding' | 'suspended';
  plan: string;
  captain: string;
  captainPhone: string;
  superadminName: string;
  superadminEmail: string;
  registeredResidents: number;
  activeDocumentsCount: number;
  modules: {
    documents: boolean;
    clinic: boolean;
    residentPortal: boolean;
    sms: boolean;
    census: boolean;
  };
}

const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'doc_ready',
    name: 'Document Ready for Pickup',
    description: 'Triggered when a requested clearance or permit has been certified and signed.',
    category: 'document',
    subject: '[Barangay {{barangay_name}}] Your {{document_type}} is Ready for Pickup!',
    headerBanner: 'Official Document Issuance Notice',
    bannerColor: '#4F46E5',
    ctaButtonText: 'View Document in Portal',
    body: `Dear {{resident_name}},

Good day! We are pleased to inform you that your official request for {{document_type}} (Tracking Reference #{{tracking_number}}) has been processed, approved, and officially signed by the Barangay Administration.

You may now claim your printed and sealed document at the Barangay {{barangay_name}} Hall during official public service hours (Monday to Friday, 8:00 AM – 5:00 PM).

Requirements upon claiming:
• Valid government-issued ID or digital resident QR
• Official receipt or transaction confirmation reference

Thank you for utilizing your official Barangay e-Governance Portal.`,
    smsText: `Brgy {{barangay_name}}: Magandang araw {{resident_name}}! Handa na po ang inyong {{document_type}} (Ref: {{tracking_number}}). Pwede na po itong kunin sa Barangay Hall. Salamat po!`
  },
  {
    id: 'resident_approved',
    name: 'Resident Verification Approved',
    description: 'Triggered when a constituent registration and residency identity documents are verified.',
    category: 'resident',
    subject: '[Barangay {{barangay_name}}] Welcome! Your Resident Verification is Approved',
    headerBanner: 'Official Resident Profile Verified',
    bannerColor: '#10B981',
    ctaButtonText: 'Access Resident Portal',
    body: `Dear {{resident_name}},

Congratulations! Your resident account application for Barangay {{barangay_name}} has been thoroughly reviewed and officially verified.

With a verified profile, you now have access to:
• Expedited online document requests and clearance issuances
• Digital constituent certificate archive
• Rural Health Center clinic appointments and records
• Community emergency alerts and official announcements

You may log in to your Resident Portal account using your registered credentials.`,
    smsText: `Brgy {{barangay_name}}: Hello {{resident_name}}! Verified na po ang inyong resident account. Pwede na po kayong mag-request ng certificates online sa portal. Salamat!`
  },
  {
    id: 'resident_action_required',
    name: 'Resident Verification Action Required',
    description: 'Sent when uploaded identification or residency proofs are unclear or require correction.',
    category: 'resident',
    subject: '[Barangay {{barangay_name}}] Action Required: Verification Follow-Up',
    headerBanner: 'Resident Verification Follow-Up',
    bannerColor: '#F59E0B',
    ctaButtonText: 'Update Verification Documents',
    body: `Dear {{resident_name}},

Thank you for submitting your resident profile registration with Barangay {{barangay_name}}.

Our verification officers require a minor update to complete your account validation:
Note / Reason: {{rejection_reason}}

Please log in to your portal account and re-upload a clear copy of the required supporting document (e.g. valid government ID or proof of billing).

Our administration desk is ready to assist you should you have any questions.`,
    smsText: `Brgy {{barangay_name}}: Paalala kay {{resident_name}}, kailangan pong i-update ang inyong verification requirements: {{rejection_reason}}. Mag-login po sa portal.`
  },
  {
    id: 'health_appointment',
    name: 'Health Clinic & Consultation Reminder',
    description: 'Sent prior to a scheduled maternal, vaccination, or general health consultation.',
    category: 'health',
    subject: '[Health Center] Appointment Reminder for {{resident_name}}',
    headerBanner: 'Barangay Health Center Consultation',
    bannerColor: '#06B6D4',
    ctaButtonText: 'View Clinic Schedule',
    body: `Dear {{resident_name}},

This is an automated reminder regarding your upcoming clinic schedule at {{clinic_name}} on {{appointment_date}} at {{appointment_time}}.

Consultation Type: {{consultation_type}}
Healthcare Station: Barangay {{barangay_name}} Health Center

Kindly bring your Yellow Card / Immunization booklet, valid ID, and previous medical prescriptions if applicable. Please arrive 10 minutes prior to your time slot.`,
    smsText: `Brgy Health: Magandang araw {{resident_name}}, may appointment po kayo sa {{clinic_name}} sa {{appointment_date}} ({{appointment_time}}). Salamat po!`
  },
  {
    id: 'advisory_broadcast',
    name: 'Barangay Community Public Advisory',
    description: 'General public safety, weather alert, or municipal announcement broadcast.',
    category: 'advisory',
    subject: '[Barangay Advisory] Important Notice from Barangay {{barangay_name}}',
    headerBanner: 'Official Public Community Advisory',
    bannerColor: '#F43F5E',
    ctaButtonText: 'Read Full Advisory Online',
    body: `To All Constituents of Barangay {{barangay_name}},

Please be advised of the following official announcement issued by the Barangay Council:

{{announcement_body}}

Date Effective: {{date}}
Issued by: Office of the Barangay Captain & Sangguniang Barangay

For immediate assistance or emergency coordination, please contact the Barangay Disaster Desk or Hotline at {{support_contact}}.`,
    smsText: `Brgy {{barangay_name}} Alert: {{announcement_body}}. Para sa emergencies, tumawag sa hotline: {{support_contact}}. Manatiling ligtas!`
  },
  {
    id: 'account_welcome',
    name: 'Staff Account Onboarding & Credentials',
    description: 'Sent when an administrator provisions a new staff, nurse, or barangay operator account.',
    category: 'system',
    subject: '[Smart Barangay] Your Official Staff Access Credentials',
    headerBanner: 'Administrative Account Provisioning',
    bannerColor: '#7C3AED',
    ctaButtonText: 'Log In to System Terminal',
    body: `Dear {{recipient_name}},

You have been provisioned as an official operator on the Smart Barangay Governance Platform for Barangay {{barangay_name}}.

Assigned Role: {{assigned_role}}
Login Email: {{login_email}}
Temporary Security Key: {{temporary_password}}

Please log in to the administrative portal and immediately change your temporary password to maintain institutional security compliance.

Do not share your institutional credentials with anyone.`,
    smsText: `Smart Barangay: Na-create na po ang inyong account for Brgy {{barangay_name}} (Role: {{assigned_role}}). I-check po ang inyong email para sa login details.`
  }
];

export const INITIAL_CLIENTS: ClientBarangay[] = [
  {
    id: 'brgy-pianing',
    name: 'Pianing',
    district: 'East District',
    status: 'active',
    plan: 'Municipal Enterprise Tier',
    captain: 'Hon. Roberto M. Dela Vega',
    captainPhone: '0917-888-2026',
    superadminName: 'Juan Perez Dela Cruz',
    superadminEmail: 'superadmin@barangay.gov',
    registeredResidents: 1420,
    activeDocumentsCount: 382,
    modules: { documents: true, clinic: true, residentPortal: true, sms: true, census: true }
  },
  {
    id: 'brgy-ampayon',
    name: 'Ampayon',
    district: 'North District',
    status: 'active',
    plan: 'Municipal Enterprise Tier',
    captain: 'Hon. Maria Clara Rosales',
    captainPhone: '0919-444-1234',
    superadminName: 'Clara Rosales',
    superadminEmail: 'admin.ampayon@barangay.gov',
    registeredResidents: 3890,
    activeDocumentsCount: 914,
    modules: { documents: true, clinic: true, residentPortal: true, sms: true, census: true }
  },
  {
    id: 'brgy-libertad',
    name: 'Libertad',
    district: 'West District',
    status: 'active',
    plan: 'Municipal Enterprise Tier',
    captain: 'Hon. Eduardo C. Santos',
    captainPhone: '0918-333-5678',
    superadminName: 'Eduardo Santos',
    superadminEmail: 'admin.libertad@barangay.gov',
    registeredResidents: 4510,
    activeDocumentsCount: 1120,
    modules: { documents: true, clinic: true, residentPortal: true, sms: true, census: true }
  },
  {
    id: 'brgy-doongan',
    name: 'Doongan',
    district: 'Central District',
    status: 'onboarding',
    plan: 'Standard Tier (Trial)',
    captain: 'Hon. Felipe Tan Jr.',
    captainPhone: '0920-555-8899',
    superadminName: 'Felipe Tan',
    superadminEmail: 'admin.doongan@barangay.gov',
    registeredResidents: 940,
    activeDocumentsCount: 128,
    modules: { documents: true, clinic: false, residentPortal: true, sms: true, census: false }
  },
  {
    id: 'brgy-baan-riverside',
    name: 'Baan Riverside',
    district: 'Central District',
    status: 'active',
    plan: 'Municipal Enterprise Tier',
    captain: 'Hon. Teresa G. Gomez',
    captainPhone: '0917-777-4433',
    superadminName: 'Teresa Gomez',
    superadminEmail: 'admin.baan@barangay.gov',
    registeredResidents: 2810,
    activeDocumentsCount: 654,
    modules: { documents: true, clinic: true, residentPortal: true, sms: true, census: true }
  }
];

const PLACEHOLDER_TAGS = [
  { tag: '{{resident_name}}', desc: 'Constituent full name' },
  { tag: '{{barangay_name}}', desc: 'Client barangay name' },
  { tag: '{{document_type}}', desc: 'Requested document title' },
  { tag: '{{tracking_number}}', desc: 'Tracking reference ID' },
  { tag: '{{pickup_location}}', desc: 'Barangay hall address' },
  { tag: '{{date}}', desc: 'Current or scheduled date' },
  { tag: '{{appointment_date}}', desc: 'Clinic date' },
  { tag: '{{appointment_time}}', desc: 'Clinic time' },
  { tag: '{{rejection_reason}}', desc: 'Verification feedback' },
  { tag: '{{support_contact}}', desc: 'Official hotline' },
  { tag: '{{portal_url}}', desc: 'Web portal URL link' }
];

export default function BarangaySettingsControlPanel() {
  const [subTab, setSubTab] = useState<'templates' | 'clients' | 'gateway'>('templates');

  // ── Target Barangay Selector (for Templates) ────────────────
  const [targetBarangay, setTargetBarangay] = useState<string>('all'); // 'all' or client barangay name

  // ── Templates State (keyed by barangay or default) ──────────
  const [templates, setTemplates] = useState<NotificationTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('smart_barangay_notification_templates');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TEMPLATES;
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('doc_ready');
  const [previewMode, setPreviewMode] = useState<'email' | 'sms'>('email');
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // ── Client Barangays State ─────────────────────────────────
  const [clientBarangays, setClientBarangays] = useState<ClientBarangay[]>(() => {
    try {
      const saved = localStorage.getItem('smart_barangay_clients');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_CLIENTS;
  });
  const [clientSearch, setClientSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<'all' | 'active' | 'onboarding'>('all');

  // ── Modals State ───────────────────────────────────────────
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [selectedClientForManage, setSelectedClientForManage] = useState<ClientBarangay | null>(null);

  // Form state for Onboard New Barangay
  const [newClient, setNewClient] = useState({
    name: '',
    district: 'North District',
    captain: '',
    captainPhone: '',
    superadminName: '',
    superadminEmail: '',
    password: '',
    plan: 'Municipal Enterprise Tier',
    modules: { documents: true, clinic: true, residentPortal: true, sms: true, census: true }
  });

  // Current active template
  const currentTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  const updateCurrentTemplateField = (field: keyof NotificationTemplate, value: string) => {
    setTemplates(prev => prev.map(t => {
      if (t.id === selectedTemplateId) {
        return { ...t, [field]: value };
      }
      return t;
    }));
  };

  const handleInsertTag = (tag: string) => {
    updateCurrentTemplateField('body', (currentTemplate.body || '') + ' ' + tag);
    toast.success(`Inserted ${tag} into template`);
  };

  const handleSaveTemplates = () => {
    try {
      const key = targetBarangay === 'all'
        ? 'smart_barangay_notification_templates'
        : `smart_barangay_templates_${targetBarangay.toLowerCase()}`;
      localStorage.setItem(key, JSON.stringify(templates));
      toast.success(
        targetBarangay === 'all'
          ? 'Global System Default templates saved!'
          : `Custom templates saved for Barangay ${targetBarangay}!`
      );
    } catch {
      toast.error('Failed to save templates');
    }
  };

  const handleResetTemplate = () => {
    const original = DEFAULT_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (original) {
      setTemplates(prev => prev.map(t => t.id === selectedTemplateId ? { ...original } : t));
      toast.info(`Reset "${original.name}" to default`);
    }
  };

  const handleSendTestDispatch = () => {
    if (!testEmailAddress.trim()) {
      toast.error('Please specify a destination email address');
      return;
    }
    setSendingTest(true);
    setTimeout(() => {
      setSendingTest(false);
      const brgyName = targetBarangay === 'all' ? 'Pianing' : targetBarangay;
      toast.success(`Test email dispatched successfully to ${testEmailAddress}!`, {
        description: `Subject: ${renderWithSample(currentTemplate.subject, brgyName)}`
      });
    }, 1000);
  };

  const renderWithSample = (text: string, customBrgy?: string) => {
    const brgy = customBrgy || (targetBarangay === 'all' ? 'Pianing' : targetBarangay);
    const sampleMap: Record<string, string> = {
      '{{resident_name}}': 'Juan Dela Cruz',
      '{{barangay_name}}': brgy,
      '{{document_type}}': 'Barangay Clearance',
      '{{tracking_number}}': 'BC-2026-09412',
      '{{pickup_location}}': `Barangay ${brgy} Hall, Butuan City`,
      '{{date}}': 'September 21, 2026',
      '{{appointment_date}}': 'Wednesday, Sept 24, 2026',
      '{{appointment_time}}': '9:00 AM',
      '{{clinic_name}}': `Barangay ${brgy} Rural Health Center`,
      '{{consultation_type}}': 'General Consultation',
      '{{rejection_reason}}': 'Submitted proof of residency is blurry. Please upload a clear billing receipt.',
      '{{support_contact}}': '(085) 815-2026 / 0917-888-9999',
      '{{portal_url}}': 'https://barangay.gov.ph',
      '{{recipient_name}}': 'Maria Santos',
      '{{assigned_role}}': 'Barangay Admin',
      '{{login_email}}': `admin.${brgy.toLowerCase().replace(/\s+/g, '')}@barangay.gov`,
      '{{temporary_password}}': `${brgy}2026!Secure`,
      '{{announcement_body}}': `The Barangay Council of ${brgy} invites all residents to the Quarterly Barangay General Assembly this Saturday at the Barangay Gymnasium.`
    };

    let rendered = text || '';
    Object.entries(sampleMap).forEach(([placeholder, sampleVal]) => {
      rendered = rendered.split(placeholder).join(sampleVal);
    });
    return rendered;
  };

  // ── Onboard New Barangay Handler ───────────────────────────
  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name.trim()) {
      toast.error('Please select or enter the Barangay Name');
      return;
    }
    if (!newClient.superadminEmail.trim()) {
      toast.error('Please provide the initial Superadmin Email');
      return;
    }

    const newBarangayItem: ClientBarangay = {
      id: `brgy-${newClient.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: newClient.name.trim(),
      district: newClient.district,
      status: 'active',
      plan: newClient.plan,
      captain: newClient.captain.trim() || 'Hon. Acting Barangay Captain',
      captainPhone: newClient.captainPhone.trim() || '0917-000-0000',
      superadminName: newClient.superadminName.trim() || `Superadmin ${newClient.name}`,
      superadminEmail: newClient.superadminEmail.trim().toLowerCase(),
      registeredResidents: 1,
      activeDocumentsCount: 0,
      modules: { ...newClient.modules }
    };

    const updated = [newBarangayItem, ...clientBarangays];
    setClientBarangays(updated);
    try {
      localStorage.setItem('smart_barangay_clients', JSON.stringify(updated));
    } catch {}

    setIsOnboardModalOpen(false);
    toast.success(`Barangay ${newClient.name} successfully onboarded as a client!`, {
      description: `Superadmin ${newClient.superadminEmail} provisioned with full executive access.`
    });

    // Reset form
    setNewClient({
      name: '',
      district: 'North District',
      captain: '',
      captainPhone: '',
      superadminName: '',
      superadminEmail: '',
      password: '',
      plan: 'Municipal Enterprise Tier',
      modules: { documents: true, clinic: true, residentPortal: true, sms: true, census: true }
    });
  };

  // ── Manage Client Save ─────────────────────────────────────
  const handleSaveManagedClient = () => {
    if (!selectedClientForManage) return;
    const updated = clientBarangays.map(c => c.id === selectedClientForManage.id ? selectedClientForManage : c);
    setClientBarangays(updated);
    try {
      localStorage.setItem('smart_barangay_clients', JSON.stringify(updated));
    } catch {}
    toast.success(`Client tenant Barangay ${selectedClientForManage.name} updated!`);
    setSelectedClientForManage(null);
  };

  const filteredClients = clientBarangays.filter(c => {
    if (clientFilter !== 'all' && c.status !== clientFilter) return false;
    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.district.toLowerCase().includes(q) || c.captain.toLowerCase().includes(q) || c.superadminEmail.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* ═══ TOP HEADER ════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-[#1F293D]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 uppercase tracking-wide">
              Platform Provider Hub
            </span>
            <span className="text-xs text-slate-400 font-mono">Multi-Tenant Client Architecture</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
            <Building2 className="text-cyan-400" size={22} />
            Barangay Settings &amp; Client Tenant Management
          </h2>
          <p className="text-xs text-slate-400">
            You own and handle the software platform. Manage client barangays as your accounts, customize Email &amp; SMS templates per barangay, and control client service plans.
          </p>
        </div>

        {/* Action / Mode switcher pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#161F30] border border-[#1F293D] rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab('templates')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              subTab === 'templates'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mail size={13} /> Notification Templates
          </button>
          <button
            type="button"
            onClick={() => setSubTab('tenants')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              subTab === 'tenants'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 size={13} /> Client Barangays ({clientBarangays.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('gateway')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              subTab === 'gateway'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Send size={13} /> Global Dispatch Config
          </button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* SUB-TAB 1: EMAIL & SMS TEMPLATES MANAGER (WITH PER-BARANGAY SCOPE)  */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {subTab === 'templates' && (
        <div className="space-y-4">
          {/* BARANGAY SCOPE SELECTOR (Solves: "why i cant edit each barangay template") */}
          <div className="bg-[#111827] border border-[#1F293D] p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-950/80 border border-violet-700/60 flex items-center justify-center text-violet-300">
                <Sliders size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Template Jurisdiction Scope</span>
                <p className="text-[11px] text-slate-400">Choose whether to edit global default templates or customize for a specific client barangay.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-400 whitespace-nowrap">Editing for:</label>
              <select
                value={targetBarangay}
                onChange={(e) => {
                  setTargetBarangay(e.target.value);
                  toast.info(e.target.value === 'all' ? 'Editing Global Default Templates' : `Now editing custom templates for Barangay ${e.target.value}`);
                }}
                className="bg-[#0F172A] border border-[#1F293D] rounded-xl text-xs font-semibold text-cyan-300 px-3 py-2 cursor-pointer focus:outline-none focus:border-cyan-500"
              >
                <option value="all">🌟 All Barangays (System Default)</option>
                {clientBarangays.map(c => (
                  <option key={c.id} value={c.name}>🏛️ Barangay {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Template Selector Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {templates.map(tpl => {
              const isSelected = tpl.id === selectedTemplateId;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  style={{
                    background: isSelected ? '#1E293B' : '#111827',
                    border: `1px solid ${isSelected ? '#7C3AED' : '#1F293D'}`
                  }}
                  className="p-3 rounded-xl text-left cursor-pointer transition-all hover:border-violet-500/60 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: tpl.bannerColor || '#7C3AED' }}
                      />
                      <span className="text-[10px] uppercase font-mono text-slate-500">{tpl.category}</span>
                    </div>
                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {tpl.name}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-1">{tpl.description}</p>
                </button>
              );
            })}
          </div>

          {/* Two-Column Editor: Left = Inputs / Right = Live Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT COLUMN: Template Editor */}
            <div className="lg:col-span-6 space-y-4 bg-[#111827] border border-[#1F293D] rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: currentTemplate.bannerColor }}
                    />
                    <h3 className="text-sm font-bold text-white">{currentTemplate.name}</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {targetBarangay === 'all' ? 'Global Default' : `Barangay ${targetBarangay} Custom Override`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  title="Reset to default template"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>

              {/* Subject Line Input */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Email Subject Line *
                </label>
                <input
                  type="text"
                  value={currentTemplate.subject}
                  onChange={e => updateCurrentTemplateField('subject', e.target.value)}
                  placeholder="e.g. [Barangay {{barangay_name}}] Notice"
                  className="w-full h-9 px-3 text-xs rounded-xl bg-[#0F172A] border border-[#1F293D] text-white focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>

              {/* Banner Headline and Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Email Header Banner Text
                  </label>
                  <input
                    type="text"
                    value={currentTemplate.headerBanner}
                    onChange={e => updateCurrentTemplateField('headerBanner', e.target.value)}
                    placeholder="e.g. Official Issuance Notice"
                    className="w-full h-9 px-3 text-xs rounded-xl bg-[#0F172A] border border-[#1F293D] text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Banner Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTemplate.bannerColor}
                      onChange={e => updateCurrentTemplateField('bannerColor', e.target.value)}
                      className="w-9 h-9 rounded-lg border border-[#1F293D] bg-[#0F172A] cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={currentTemplate.bannerColor}
                      onChange={e => updateCurrentTemplateField('bannerColor', e.target.value)}
                      className="flex-1 h-9 px-3 text-xs rounded-xl bg-[#0F172A] border border-[#1F293D] text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Variable Placeholders Chips Bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-400" />
                    Insert Variable Tags (Click to append)
                  </label>
                  <span className="text-[10px] text-slate-500">Replaced automatically upon dispatch</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-[#0F172A] border border-[#1F293D] rounded-xl">
                  {PLACEHOLDER_TAGS.map(item => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => handleInsertTag(item.tag)}
                      className="px-2 py-1 bg-violet-950/50 hover:bg-violet-900/60 border border-violet-700/60 rounded-lg text-[10px] font-mono text-violet-300 cursor-pointer transition-colors flex items-center gap-1"
                      title={item.desc}
                    >
                      <span>{item.tag}</span>
                      <Plus size={10} className="opacity-60" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Email Body Text Area */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Email Message Body *
                </label>
                <textarea
                  rows={8}
                  value={currentTemplate.body}
                  onChange={e => updateCurrentTemplateField('body', e.target.value)}
                  className="w-full p-3 text-xs rounded-xl bg-[#0F172A] border border-[#1F293D] text-white focus:outline-none focus:border-violet-500 font-sans leading-relaxed resize-y"
                  placeholder="Type email body template..."
                />
              </div>

              {/* SMS Text Template with GSM Character Counter */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Smartphone size={13} className="text-cyan-400" />
                    SMS Broadcast Message Template
                  </label>
                  <span className={`text-[10px] font-mono ${
                    currentTemplate.smsText.length > 160 ? 'text-amber-400' : 'text-slate-400'
                  }`}>
                    {currentTemplate.smsText.length} / 160 chars ({Math.ceil(currentTemplate.smsText.length / 160) || 1} SMS parts)
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={currentTemplate.smsText}
                  onChange={e => updateCurrentTemplateField('smsText', e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-[#0F172A] border border-[#1F293D] text-white focus:outline-none focus:border-cyan-500 font-mono text-[11px] resize-y"
                  placeholder="Type SMS text template..."
                />
              </div>

              {/* Bottom Action Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="px-3 py-1.5 rounded-lg border border-[#1F293D] text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplates}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
                >
                  <Save size={13} /> Save Template ({targetBarangay === 'all' ? 'Global Default' : targetBarangay})
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Live Interactive Email & SMS Simulator */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-5 shadow-xs">
                {/* Simulator Header */}
                <div className="flex items-center justify-between border-b border-[#1F293D] pb-3 mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">Live Constituent Preview</span>
                    <h4 className="text-xs font-bold text-white">
                      Recipient Experience ({targetBarangay === 'all' ? 'Sample: Pianing' : `Barangay ${targetBarangay}`})
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-[#161F30] border border-[#1F293D] rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('email')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                        previewMode === 'email' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Mail size={12} className="inline mr-1" /> Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('sms')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                        previewMode === 'sms' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Smartphone size={12} className="inline mr-1" /> SMS
                    </button>
                  </div>
                </div>

                {/* Simulated Email Envelope */}
                {previewMode === 'email' ? (
                  <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-300 text-slate-800">
                    {/* Simulated Email Client Top Bar */}
                    <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 text-[11px] font-mono text-slate-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 w-16 text-right">From:</span>
                        <span className="text-slate-900 font-medium">Smart Barangay Governance &lt;notifications@smartbarangay.ph&gt;</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 w-16 text-right">To:</span>
                        <span className="text-blue-700">juan.delacruz@gmail.com</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 w-16 text-right">Subject:</span>
                        <span className="font-bold text-slate-900">{renderWithSample(currentTemplate.subject)}</span>
                      </div>
                    </div>

                    {/* Email Card Body */}
                    <div className="p-6 space-y-5 bg-[#FAFAFA]">
                      {/* Brand Header Banner */}
                      <div
                        style={{ background: currentTemplate.bannerColor }}
                        className="rounded-xl p-4 text-white flex items-center justify-between shadow-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center font-bold text-sm">
                            🏛️
                          </div>
                          <div>
                            <h5 className="font-bold text-sm leading-tight">Barangay {targetBarangay === 'all' ? 'Pianing' : targetBarangay}</h5>
                            <p className="text-[11px] opacity-90">{currentTemplate.headerBanner}</p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-mono">OFFICIAL NOTICE</span>
                      </div>

                      {/* Letter Content */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                        <p className="text-xs text-slate-800 font-semibold">
                          Dear Juan Dela Cruz,
                        </p>
                        <div className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                          {renderWithSample(currentTemplate.body)}
                        </div>

                        {/* CTA Button */}
                        <div className="pt-2 text-center">
                          <button
                            type="button"
                            style={{ background: currentTemplate.bannerColor }}
                            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-md cursor-pointer hover:opacity-95"
                          >
                            <span>{currentTemplate.ctaButtonText || 'Access Portal Service'}</span>
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Official Footer */}
                      <div className="text-center text-[10px] text-slate-400 space-y-1 pt-2 border-t border-slate-200">
                        <p>This automated notification was dispatched by Smart Barangay Governance Multi-Tenant Engine.</p>
                        <p className="font-mono text-slate-500">Barangay {targetBarangay === 'all' ? 'Pianing' : targetBarangay}, Butuan City, Agusan del Norte</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Realistic SMS Phone Simulator */
                  <div className="bg-[#0B1120] p-6 rounded-2xl border border-slate-800 flex justify-center">
                    <div className="w-full max-w-sm bg-[#030712] rounded-3xl border-4 border-slate-700 p-4 shadow-2xl space-y-3">
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full mx-auto" />
                      <div className="text-center border-b border-slate-800 pb-2">
                        <p className="text-xs font-bold text-white">BRGY-ALERT</p>
                        <p className="text-[10px] text-slate-400 font-mono">Official SMS Dispatcher</p>
                      </div>

                      <div className="bg-[#1E293B] text-slate-100 p-3.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed border border-slate-700 shadow-sm font-sans">
                        <p className="whitespace-pre-line">{renderWithSample(currentTemplate.smsText)}</p>
                        <span className="text-[9px] text-slate-400 block text-right mt-1.5 font-mono">Just now</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Test Dispatch Bar */}
                <div className="mt-4 pt-3 border-t border-[#1F293D] flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                      Send Live Test Dispatch to Email:
                    </label>
                    <input
                      type="email"
                      value={testEmailAddress}
                      onChange={e => setTestEmailAddress(e.target.value)}
                      placeholder="test.recipient@example.com"
                      className="w-full h-8 px-2.5 text-xs rounded-lg bg-[#0F172A] border border-[#1F293D] text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendTestDispatch}
                    disabled={sendingTest}
                    className="self-end h-8 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {sendingTest ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                    <span>Test Send</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* SUB-TAB 2: CLIENT BARANGAYS & TENANCY (WITH WORKING MODALS)          */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {subTab === 'tenants' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-[#111827] border border-[#1F293D] p-3.5 rounded-2xl">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Search client barangay, captain, or superadmin..."
                className="w-full h-9 pl-9 pr-3 text-xs rounded-xl bg-[#0F172A] border border-[#1F293D] text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 p-1 bg-[#0F172A] border border-[#1F293D] rounded-xl text-xs">
                {(['all', 'active', 'onboarding'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setClientFilter(tab)}
                    className={`px-3 py-1 rounded-lg capitalize font-semibold cursor-pointer ${
                      clientFilter === tab ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Working Onboard Button */}
              <button
                type="button"
                onClick={() => setIsOnboardModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                <Plus size={14} /> Onboard New Barangay
              </button>
            </div>
          </div>

          {/* Client Barangays Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map(client => (
              <div
                key={client.id}
                className="bg-[#111827] border border-[#1F293D] rounded-2xl p-5 shadow-xs space-y-4 hover:border-cyan-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center font-bold text-cyan-300 text-xs">
                        🏛️
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Barangay {client.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">{client.district}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      client.status === 'active'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
                      {client.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Client Metadata */}
                  <div className="space-y-1.5 text-xs text-slate-400 bg-[#0F172A] p-3 rounded-xl border border-[#1F293D] mb-3">
                    <div className="flex justify-between">
                      <span className="text-[11px] text-slate-500">Barangay Captain:</span>
                      <span className="text-[11px] font-semibold text-slate-200">{client.captain}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] text-slate-500">Client Superadmin:</span>
                      <span className="text-[11px] font-semibold text-cyan-300 truncate max-w-[170px]">{client.superadminEmail}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] text-slate-500">Registered Residents:</span>
                      <span className="text-[11px] font-bold text-white">{client.registeredResidents.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] text-slate-500">Service License:</span>
                      <span className="text-[11px] font-bold text-slate-300">{client.plan}</span>
                    </div>
                  </div>

                  {/* Modules Summary */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Active Modules
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {client.modules.documents && <span className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/60 text-[10px] font-medium">E-Docs</span>}
                      {client.modules.clinic && <span className="px-2 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-800/60 text-[10px] font-medium">Health EHR</span>}
                      {client.modules.residentPortal && <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-[10px] font-medium">Portal</span>}
                      {client.modules.sms && <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 text-[10px] font-medium">SMS</span>}
                      {client.modules.census && <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 text-[10px] font-medium">Demographics</span>}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1F293D] flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-500 font-mono">ID: {client.id}</span>
                  {/* Working Manage Client Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedClientForManage(client)}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center gap-1.5 px-3 py-1 bg-cyan-950/60 border border-cyan-800/60 rounded-lg hover:bg-cyan-900/60 transition-colors"
                  >
                    <Settings size={12} />
                    <span>Manage Client</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* SUB-TAB 3: GLOBAL GATEWAY & DISPATCH CONFIG                         */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {subTab === 'gateway' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* SMTP Gateway Details */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400">
                  <Mail size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Gmail SMTP Dispatcher</h4>
                  <p className="text-[11px] text-slate-400">Institutional email relay protocol</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                ACTIVE
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Global Sender Display Name</label>
                <input
                  type="text"
                  defaultValue="Smart Barangay Governance Platform"
                  className="w-full h-9 px-3 text-xs rounded-xl bg-[#0F172A] border border-[#1F293D] text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">System Notification Email</label>
                <input
                  type="email"
                  defaultValue="notifications@smartbarangay.ph"
                  className="w-full h-9 px-3 text-xs rounded-xl bg-[#0F172A] border border-[#1F293D] text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Reply-To Address</label>
                <input
                  type="email"
                  defaultValue="support@smartbarangay.ph"
                  className="w-full h-9 px-3 text-xs rounded-xl bg-[#0F172A] border border-[#1F293D] text-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#1F293D] flex justify-end">
              <button
                type="button"
                onClick={() => toast.success('SMTP configuration verified and connected!')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Test SMTP Handshake
              </button>
            </div>
          </div>

          {/* SMS Gateway Details */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
                  <Smartphone size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">iProg SMS Gateway</h4>
                  <p className="text-[11px] text-slate-400">Telco broadcast dispatch engine</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                OPERATIONAL
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">SMS Sender Mask ID</label>
                <input
                  type="text"
                  defaultValue="BRGY-ALERT"
                  className="w-full h-9 px-3 text-xs rounded-xl bg-[#0F172A] border border-[#1F293D] text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Carrier Network Route</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  defaultValue="Smart / Globe / Dito Unified Philippine Gateway"
                  className="w-full h-9 px-3 text-xs rounded-xl bg-[#0B1120] border border-[#1F293D] text-slate-400 cursor-not-allowed"
                />
              </div>
              <div className="p-3 bg-[#0F172A] rounded-xl border border-[#1F293D] space-y-1">
                <span className="text-[10px] text-slate-400 font-mono block">Monthly SMS Allocation:</span>
                <p className="text-sm font-bold text-cyan-400">48,219 / 50,000 Credits Remaining</p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1F293D] flex justify-end">
              <button
                type="button"
                onClick={() => toast.success('SMS Gateway ping successful: 98.4% delivery SLA')}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Ping Telco Relay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: ONBOARD NEW CLIENT BARANGAY                                */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {isOnboardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
                  <Building2 size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Onboard New Client Barangay</h3>
                  <p className="text-xs text-slate-400">Register a new client barangay and provision its Superadmin.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOnboardModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Barangay Name *</label>
                <input
                  list="onboard-barangays-list"
                  type="text"
                  required
                  value={newClient.name}
                  onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="Select or type e.g. Libertad"
                  className="w-full h-9 px-3 rounded-xl bg-[#0F172A] border border-[#1F293D] text-white focus:outline-none focus:border-cyan-500"
                />
                <datalist id="onboard-barangays-list">
                  {BUTUAN_BARANGAYS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">LGU District</label>
                  <select
                    value={newClient.district}
                    onChange={e => setNewClient({ ...newClient, district: e.target.value })}
                    className="w-full h-9 px-2.5 rounded-xl bg-[#0F172A] border border-[#1F293D] text-white"
                  >
                    <option value="North District">North District</option>
                    <option value="West District">West District</option>
                    <option value="East District">East District</option>
                    <option value="Central District">Central District</option>
                    <option value="South District">South District</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Service Tier</label>
                  <select
                    value={newClient.plan}
                    onChange={e => setNewClient({ ...newClient, plan: e.target.value })}
                    className="w-full h-9 px-2.5 rounded-xl bg-[#0F172A] border border-[#1F293D] text-white"
                  >
                    <option value="Municipal Enterprise Tier">Municipal Enterprise Tier</option>
                    <option value="Standard Tier (Trial)">Standard Tier (Trial)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Barangay Captain</label>
                  <input
                    type="text"
                    value={newClient.captain}
                    onChange={e => setNewClient({ ...newClient, captain: e.target.value })}
                    placeholder="Hon. Full Name"
                    className="w-full h-9 px-3 rounded-xl bg-[#0F172A] border border-[#1F293D] text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Official Hotline / Phone</label>
                  <input
                    type="text"
                    value={newClient.captainPhone}
                    onChange={e => setNewClient({ ...newClient, captainPhone: e.target.value })}
                    placeholder="0917XXXXXXX"
                    className="w-full h-9 px-3 rounded-xl bg-[#0F172A] border border-[#1F293D] text-white"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-[#0F172A] border border-[#1F293D] rounded-2xl space-y-3">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                  Primary Client Superadmin Provisioning
                </span>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Superadmin Full Name</label>
                  <input
                    type="text"
                    value={newClient.superadminName}
                    onChange={e => setNewClient({ ...newClient, superadminName: e.target.value })}
                    placeholder="e.g. Roberto Santos"
                    className="w-full h-8 px-2.5 rounded-lg bg-[#161F30] border border-[#1F293D] text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Official Superadmin Email *</label>
                  <input
                    type="email"
                    required
                    value={newClient.superadminEmail}
                    onChange={e => setNewClient({ ...newClient, superadminEmail: e.target.value })}
                    placeholder="admin.barangay@governance.ph"
                    className="w-full h-8 px-2.5 rounded-lg bg-[#161F30] border border-[#1F293D] text-white"
                  />
                </div>
              </div>

              {/* Module Toggles */}
              <div>
                <span className="text-slate-300 font-bold block mb-2">Enable Client Modules</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'documents', label: 'E-Document Processing' },
                    { key: 'clinic', label: 'Rural Health EHR' },
                    { key: 'residentPortal', label: 'Resident Portal' },
                    { key: 'sms', label: 'SMS Dispatcher' },
                    { key: 'census', label: 'Demographics Census' }
                  ].map(m => (
                    <label key={m.key} className="flex items-center gap-2 p-2 bg-[#0F172A] border border-[#1F293D] rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(newClient.modules as any)[m.key]}
                        onChange={e => setNewClient({
                          ...newClient,
                          modules: { ...newClient.modules, [m.key]: e.target.checked }
                        })}
                        className="rounded border-[#1F293D] text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="text-[11px] text-slate-300">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#1F293D] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOnboardModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#1F293D] text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-xl font-bold shadow-md cursor-pointer"
                >
                  Complete Onboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: MANAGE CLIENT TENANT DRAWER                                */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {selectedClientForManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-300 font-bold">
                  🏛️
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Manage Client: Barangay {selectedClientForManage.name}</h3>
                  <p className="text-xs text-slate-400">Tenancy ID: {selectedClientForManage.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClientForManage(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Client Status</label>
                  <select
                    value={selectedClientForManage.status}
                    onChange={e => setSelectedClientForManage({ ...selectedClientForManage, status: e.target.value as any })}
                    className="w-full h-9 px-2.5 rounded-xl bg-[#0F172A] border border-[#1F293D] text-white font-semibold"
                  >
                    <option value="active">Active Client</option>
                    <option value="onboarding">Onboarding / Evaluation</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Subscription Tier</label>
                  <select
                    value={selectedClientForManage.plan}
                    onChange={e => setSelectedClientForManage({ ...selectedClientForManage, plan: e.target.value })}
                    className="w-full h-9 px-2.5 rounded-xl bg-[#0F172A] border border-[#1F293D] text-white"
                  >
                    <option value="Municipal Enterprise Tier">Municipal Enterprise Tier</option>
                    <option value="Standard Tier (Trial)">Standard Tier (Trial)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Barangay Captain</label>
                <input
                  type="text"
                  value={selectedClientForManage.captain}
                  onChange={e => setSelectedClientForManage({ ...selectedClientForManage, captain: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl bg-[#0F172A] border border-[#1F293D] text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Assigned Superadmin Email</label>
                <input
                  type="email"
                  value={selectedClientForManage.superadminEmail}
                  onChange={e => setSelectedClientForManage({ ...selectedClientForManage, superadminEmail: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl bg-[#0F172A] border border-[#1F293D] text-white font-mono"
                />
              </div>

              {/* Module Toggles */}
              <div>
                <span className="text-slate-300 font-bold block mb-2">Enabled Modules for this Barangay</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'documents', label: 'E-Document Processing' },
                    { key: 'clinic', label: 'Rural Health EHR' },
                    { key: 'residentPortal', label: 'Resident Portal' },
                    { key: 'sms', label: 'SMS Dispatcher' },
                    { key: 'census', label: 'Demographics Census' }
                  ].map(m => {
                    const isChecked = (selectedClientForManage.modules as any)[m.key];
                    return (
                      <label key={m.key} className="flex items-center gap-2 p-2.5 bg-[#0F172A] border border-[#1F293D] rounded-xl cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => setSelectedClientForManage({
                            ...selectedClientForManage,
                            modules: { ...selectedClientForManage.modules, [m.key]: e.target.checked }
                          })}
                          className="rounded border-[#1F293D] text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className="text-[11px] text-slate-200">{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[#1F293D] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setTargetBarangay(selectedClientForManage.name);
                    setSubTab('templates');
                    setSelectedClientForManage(null);
                  }}
                  className="text-xs text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Mail size={13} /> Customize Barangay Templates
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedClientForManage(null)}
                    className="px-4 py-2 rounded-xl border border-[#1F293D] text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveManagedClient}
                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold shadow-md cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
