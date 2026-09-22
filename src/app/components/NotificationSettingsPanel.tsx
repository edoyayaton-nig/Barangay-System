import React, { useState, useEffect } from 'react';
import {
  Save, Eye, EyeOff, Send, CheckCircle2, AlertCircle, RefreshCw,
  Building, Mail, Smartphone, Sparkles, ExternalLink, ShieldCheck,
  RotateCcw, Info, Copy, Check, Code2, Key, HelpCircle, Layers, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { saveEmailJsConfig } from '../../services/emailJsService';

interface BarangaySettings {
  barangay_name: string;
  municipality: string;
  province: string;
  emailjs_service_id: string;
  emailjs_template_id: string;
  emailjs_public_key: string;
  emailjs_private_key: string;
  sms_api_key: string;
  sms_sender_name: string;
}

const DEFAULT_SETTINGS: BarangaySettings = {
  barangay_name: '',
  municipality: 'Butuan City',
  province: 'Agusan del Norte',
  emailjs_service_id: '',
  emailjs_template_id: '',
  emailjs_public_key: '',
  emailjs_private_key: '',
  sms_api_key: '',
  sms_sender_name: '',
};

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

export default function NotificationSettingsPanel() {
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('barangay_user') || '{}'); } catch { return {}; }
  })();
  const userBarangay = (currentUser?.barangay || 'Pianing').replace(/^Barangay\s+/i, '').trim();

  const [activeSubTab, setActiveSubTab] = useState<'gateways' | 'variables' | 'identity'>('gateways');
  const [settings, setSettings] = useState<BarangaySettings>(() => {
    try {
      if (userBarangay) {
        const cached = localStorage.getItem(`barangay_notification_settings_${userBarangay.toLowerCase()}`);
        if (cached) return { ...DEFAULT_SETTINGS, barangay_name: userBarangay, ...JSON.parse(cached) };
      }
    } catch {}
    return {
      ...DEFAULT_SETTINGS,
      barangay_name: userBarangay,
      sms_sender_name: ''
    };
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showSmsKey, setShowSmsKey] = useState(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  useEffect(() => {
    const targetBrgy = userBarangay;
    if (!targetBrgy) return;
    setLoading(true);

    fetch(`${API_BASE}/api/settings?barangay=${encodeURIComponent(targetBrgy)}`)
      .then((r) => {
        if (!r.ok) throw new Error('API ' + r.status);
        return r.json();
      })
      .then((data) => {
        if (data && typeof data === 'object') {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data,
            barangay_name: targetBrgy,
            sms_sender_name: data.sms_sender_name || ''
          });
          try {
            localStorage.setItem(`barangay_notification_settings_${targetBrgy.toLowerCase()}`, JSON.stringify({
              ...data,
              barangay_name: targetBrgy
            }));
          } catch {}
        }
      })
      .catch(() => {
        // Fallback to local cache for this specific barangay
        try {
          const cached = localStorage.getItem(`barangay_notification_settings_${targetBrgy.toLowerCase()}`);
          if (cached) {
            setSettings(prev => ({ ...prev, ...JSON.parse(cached), barangay_name: targetBrgy }));
          }
        } catch {}
      })
      .finally(() => setLoading(false));
  }, [userBarangay]);

  const handleChange = (field: keyof BarangaySettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopyTag = (tag: string) => {
    navigator.clipboard?.writeText(tag);
    setCopiedTag(tag);
    toast.success(`Copied ${tag} to clipboard!`, {
      description: 'Paste this variable directly into your EmailJS template editor.'
    });
    setTimeout(() => setCopiedTag(null), 2500);
  };

  const handleSave = async () => {
    const targetBrgy = userBarangay;
    if (!targetBrgy) {
      toast.error('Barangay name is required.');
      return;
    }
    setSaving(true);
    const payload = {
      ...settings,
      barangay_name: targetBrgy
    };

    // 1. Immediately synchronize EmailJS service config locally strictly for this specific barangay
    saveEmailJsConfig({
      serviceId: settings.emailjs_service_id.trim(),
      templateId: settings.emailjs_template_id.trim(),
      publicKey: settings.emailjs_public_key.trim(),
    }, targetBrgy);

    // 2. Persist to local cache strictly for this specific barangay
    try {
      localStorage.setItem(`barangay_notification_settings_${targetBrgy.toLowerCase()}`, JSON.stringify(payload));
    } catch {}

    // 3. Persist to MySQL backend for this specific barangay
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Credentials for Barangay ${targetBrgy} saved successfully.`);
      } else {
        toast.error(data.message || 'Failed to save settings.');
      }
    } catch {
      toast.success(`Settings for Barangay ${targetBrgy} updated successfully (Active Locally).`);
    } finally {
      setSaving(false);
    }
  };

  const TEMPLATE_VARIABLES = [
    { tag: '{{name}}', alt: '{{to_name}}', desc: 'Full Name of the constituent recipient', sample: 'Juan Dela Cruz' },
    { tag: '{{to_email}}', alt: '{{email}}', desc: 'Recipient constituent Gmail address', sample: 'juan.delacruz@gmail.com' },
    { tag: '{{title}}', alt: '{{subject}}', desc: 'Notification subject / alert headline', sample: 'Your Barangay Clearance is Ready for Pickup' },
    { tag: '{{message}}', alt: '', desc: 'Official notice body text and claiming instructions', sample: 'Your requested document has been certified. Please bring a valid ID upon pickup at the Barangay Hall.' },
    { tag: '{{document_type}}', alt: '', desc: 'Official document name (Clearance, Indigency, Permit)', sample: 'Barangay Clearance' },
    { tag: '{{request_code}}', alt: '{{tracking_number}}', desc: 'Unique transaction tracking reference code', sample: 'BC-2026-0921' },
    { tag: '{{barangay}}', alt: '{{barangay_name}}', desc: 'Official Barangay jurisdiction name', sample: `Barangay ${settings.barangay_name || 'Pianing'}` },
    { tag: '{{status}}', alt: '', desc: 'Current transaction status of the request', sample: 'Ready for Pickup' },
    { tag: '{{time}}', alt: '', desc: 'Date and time when the notice was dispatched', sample: 'September 21, 2026, 09:30 AM' },
    { tag: '{{from_name}}', alt: '', desc: 'Administrative office signature line', sample: `Office of Barangay ${settings.barangay_name || 'Pianing'}` },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
        <RefreshCw size={24} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ TOP HERO BANNER ═══════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full -translate-y-24 translate-x-24 blur-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 uppercase tracking-wide">
                Barangay Executive Desk
              </span>
              <span className="text-xs text-blue-200 font-mono">Unique EmailJS & Gateway Architecture</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Barangay Notification &amp; Gateway Settings</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Connect your barangay&apos;s unique EmailJS service and SMS gateway credentials. Design and brand your custom email layout directly in EmailJS while the system injects constituent data dynamically.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
            >
              <Save size={14} />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>

        {/* Sub-tab Switcher Pills */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSubTab('gateways')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'gateways'
                ? 'bg-white text-indigo-950 shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Mail size={14} /> 1. EmailJS &amp; Gateway Credentials
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('variables')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'variables'
                ? 'bg-white text-indigo-950 shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Code2 size={14} /> 2. EmailJS Template Guide &amp; Variables
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('identity')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'identity'
                ? 'bg-white text-indigo-950 shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Building size={14} /> 3. Barangay Letterhead &amp; Identity
          </button>
        </div>
      </div>

      {/* ═══ SUB-TAB 1: EMAILJS & GATEWAY CREDENTIALS (PRIMARY) ═══════════ */}
      {activeSubTab === 'gateways' && (
        <div className="space-y-6">
          {/* Informational Callout */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="text-indigo-600 shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="text-xs font-bold text-indigo-950">Independent EmailJS Service for Each Barangay</h4>
                <p className="text-xs text-indigo-800/80 mt-0.5 leading-relaxed">
                  Every barangay enters their own unique EmailJS credentials below. This ensures your barangay has its own dedicated email quota, separate sender reputation, and custom layout. You design and edit the template directly in your EmailJS dashboard.
                </p>
              </div>
            </div>
            <a
              href="https://dashboard.emailjs.com/admin/templates"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-2xs"
            >
              <span>Open EmailJS Editor</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* EmailJS Credentials Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                    <Mail size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">EmailJS Service Credentials</h3>
                    <p className="text-[11px] text-slate-500">Official constituent email dispatch integration</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  settings.emailjs_service_id && settings.emailjs_template_id && settings.emailjs_public_key
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {settings.emailjs_service_id && settings.emailjs_template_id && settings.emailjs_public_key ? 'CONFIGURED' : 'PENDING SETUP'}
                </span>
              </div>

              <div className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">EmailJS Service ID <span className="text-red-500">*</span></label>
                    <span className="text-[10px] text-slate-400">e.g. service_v7jmjaw</span>
                  </div>
                  <input
                    type="text"
                    value={settings.emailjs_service_id}
                    onChange={(e) => handleChange('emailjs_service_id', e.target.value)}
                    placeholder="service_xxxxxxx"
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 font-mono bg-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Found in EmailJS &gt; Email Services &gt; Service ID.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">EmailJS Template ID <span className="text-red-500">*</span></label>
                    <span className="text-[10px] text-slate-400">e.g. template_acyd0bm</span>
                  </div>
                  <input
                    type="text"
                    value={settings.emailjs_template_id}
                    onChange={(e) => handleChange('emailjs_template_id', e.target.value)}
                    placeholder="template_xxxxxxx"
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 font-mono bg-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Found in EmailJS &gt; Email Templates &gt; Settings &gt; Template ID.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Public API Key <span className="text-red-500">*</span></label>
                    <span className="text-[10px] text-slate-400">e.g. cyoSyIWGAKpalaKEQ</span>
                  </div>
                  <input
                    type="text"
                    value={settings.emailjs_public_key}
                    onChange={(e) => handleChange('emailjs_public_key', e.target.value)}
                    placeholder="Public API Key"
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 font-mono bg-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Found in EmailJS &gt; Account &gt; Public Key.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Private API Key (Optional)</label>
                    <span className="text-[10px] text-slate-400">For secure backend relay</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPrivateKey ? 'text' : 'password'}
                      value={settings.emailjs_private_key}
                      onChange={(e) => handleChange('emailjs_private_key', e.target.value)}
                      placeholder="Private API Key"
                      className="w-full h-9 pl-3 pr-9 text-xs rounded-xl border border-slate-200 font-mono bg-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPrivateKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>


                {/* Save EmailJS Credentials */}
                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <Save size={13} />
                    <span>{saving ? 'Saving Credentials...' : 'Save EmailJS Credentials'}</span>
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1.5 text-center">Credentials are stored per-barangay and isolated from other barangays.</p>
                </div>
              </div>
            </div>

            {/* SMS Gateway Credentials Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <Smartphone size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">SMS Gateway Configuration</h3>
                    <p className="text-[11px] text-slate-500">Telco SMS broadcast API (Semaphore / iProg)</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  OPERATIONAL
                </span>
              </div>

              <div className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">SMS Sender Name / Mask</label>
                    <span className="text-[10px] text-slate-400">Max 11 chars</span>
                  </div>
                  <input
                    type="text"
                    value={settings.sms_sender_name}
                    onChange={(e) => handleChange('sms_sender_name', e.target.value)}
                    placeholder="Optional sender name (max 11 chars)"
                    maxLength={11}
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 font-mono bg-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Official sender name shown on constituent mobile phones.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">SMS API Token / Key</label>
                  </div>
                  <div className="relative">
                    <input
                      type={showSmsKey ? 'text' : 'password'}
                      value={settings.sms_api_key}
                      onChange={(e) => handleChange('sms_api_key', e.target.value)}
                      placeholder="Enter API token from SMS Gateway provider"
                      className="w-full h-9 pl-3 pr-9 text-xs rounded-xl border border-slate-200 font-mono bg-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmsKey(!showSmsKey)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showSmsKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Leave empty to use the system default SMS gateway.</p>
                </div>


                {/* Save SMS Credentials */}
                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <Save size={13} />
                    <span>{saving ? 'Saving...' : 'Save SMS Gateway Credentials'}</span>
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1.5 text-center">SMS settings are stored per-barangay and will not affect other barangays.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SUB-TAB 2: EMAILJS TEMPLATE GUIDE & VARIABLES ═══════════════ */}
      {activeSubTab === 'variables' && (
        <div className="space-y-6">
          {/* Quick Step Guide */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Code2 className="text-indigo-600" size={16} />
                  How to Build Your Email Template in EmailJS
                </h3>
                <p className="text-xs text-slate-500">
                  Design the layout in EmailJS once; our system automatically injects dynamic resident data whenever a notification triggers.
                </p>
              </div>
              <a
                href="https://dashboard.emailjs.com/admin/templates"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors"
              >
                <span>Go to EmailJS Dashboard</span>
                <ExternalLink size={12} />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mb-2">1</span>
                <h5 className="text-xs font-bold text-slate-800">Create Template in EmailJS</h5>
                <p className="text-[11px] text-slate-500 mt-1">
                  Log in to your EmailJS dashboard, click <strong>Email Templates &gt; Create New Template</strong>, and add your official Barangay logo and header.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mb-2">2</span>
                <h5 className="text-xs font-bold text-slate-800">Insert Variable Tags</h5>
                <p className="text-[11px] text-slate-500 mt-1">
                  Use the variable tags below (like <code className="text-indigo-600 font-bold">&#123;&#123;name&#125;&#125;</code> and <code className="text-indigo-600 font-bold">&#123;&#123;message&#125;&#125;</code>) in your EmailJS subject line and body.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mb-2">3</span>
                <h5 className="text-xs font-bold text-slate-800">Save &amp; Connect Template ID</h5>
                <p className="text-[11px] text-slate-500 mt-1">
                  Copy your Template ID from EmailJS and paste it into the <strong>Gateway Credentials</strong> tab. That&apos;s all!
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Variables Reference Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Dynamic Template Variables (Click to Copy)</h3>
                <p className="text-xs text-slate-500">
                  These placeholders are filled dynamically with actual constituent and document details on dispatch.
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                10 PARAMETERS AVAILABLE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TEMPLATE_VARIABLES.map((v) => {
                const isCopied = copiedTag === v.tag;
                return (
                  <div
                    key={v.tag}
                    className="p-3.5 rounded-2xl border border-slate-200/90 hover:border-indigo-300 transition-colors bg-white flex items-start justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-mono">
                          {v.tag}
                        </code>
                        {v.alt && (
                          <span className="text-[10px] text-slate-400 font-mono">or {v.alt}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 font-medium">{v.desc}</p>
                      <p className="text-[11px] text-slate-400 font-mono">Sample: &ldquo;{v.sample}&rdquo;</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyTag(v.tag)}
                      title="Copy variable tag"
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                        isCopied
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border-slate-200'
                      }`}
                    >
                      {isCopied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sample EmailJS Layout Blueprint */}
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Example EmailJS Template Blueprint</h4>
            <div className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden font-mono text-xs">
              <div className="bg-slate-100 p-3 border-b border-slate-200 text-slate-600 space-y-1">
                <p><strong>To:</strong> &#123;&#123;to_email&#125;&#125;</p>
                <p><strong>Subject:</strong> [&#123;&#123;barangay&#125;&#125;] &#123;&#123;title&#125;&#125;</p>
              </div>
              <div className="p-5 font-sans space-y-3 leading-relaxed text-slate-800">
                <p>Dear <strong>&#123;&#123;name&#125;&#125;</strong>,</p>
                <p>
                  Your requested <strong>&#123;&#123;document_type&#125;&#125;</strong> (Reference #<strong>&#123;&#123;request_code&#125;&#125;</strong>) is now <strong>&#123;&#123;status&#125;&#125;</strong>.
                </p>
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900">
                  &#123;&#123;message&#125;&#125;
                </div>
                <p className="text-[11px] text-slate-500">
                  Dispatched on &#123;&#123;time&#125;&#125; &bull; &#123;&#123;from_name&#125;&#125;
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SUB-TAB 3: BARANGAY IDENTITY ══════════════════════════════════ */}
      {activeSubTab === 'identity' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building className="text-indigo-600" size={16} />
                Official Barangay Letterhead Details
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                This identity is automatically supplied to your EmailJS <code className="text-indigo-600 font-bold font-mono">&#123;&#123;barangay&#125;&#125;</code> and <code className="text-indigo-600 font-bold font-mono">&#123;&#123;from_name&#125;&#125;</code> parameters.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Barangay Jurisdiction <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock size={10} /> Locked to Account Jurisdiction
                  </span>
                </div>
                <input
                  type="text"
                  value={`Barangay ${userBarangay}`}
                  readOnly
                  disabled
                  className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 bg-slate-100 text-slate-700 font-bold cursor-not-allowed select-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">Official jurisdiction assigned to this Super Administrator account.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Municipality / City</label>
                  <input
                    type="text"
                    value={settings.municipality}
                    onChange={(e) => handleChange('municipality', e.target.value)}
                    placeholder="e.g. Butuan City"
                    className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Province</label>
                  <input
                    type="text"
                    value={settings.province}
                    onChange={(e) => handleChange('province', e.target.value)}
                    placeholder="e.g. Agusan del Norte"
                    className="w-full h-10 px-3.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-start gap-3">
                <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-900 leading-relaxed">
                  <strong>Multi-Barangay Guarantee:</strong> Any email or SMS sent from your barangay will always be branded with <strong>Barangay {settings.barangay_name || 'Pianing'}</strong>, {settings.municipality || 'Butuan City'}, using your own unique EmailJS service.
                </div>
              </div>
            </div>
          </div>

          {/* Right Preview Card */}
          <div className="lg:col-span-5 bg-slate-50 rounded-3xl p-6 border border-slate-200/80 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Letterhead Live Preview</h4>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden p-1">
                <img src="/assets/pianing-logo.png" alt="Barangay Seal" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Republic of the Philippines</p>
                <p className="text-xs text-slate-600 font-medium">Province of {settings.province || 'Agusan del Norte'}</p>
                <p className="text-xs text-slate-600 font-medium">{settings.municipality || 'City of Butuan'}</p>
                <h3 className="text-base font-bold text-indigo-950 mt-1">BARANGAY {settings.barangay_name ? settings.barangay_name.toUpperCase() : 'PIANING'}</h3>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-mono">
                Office of the Sangguniang Barangay
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
