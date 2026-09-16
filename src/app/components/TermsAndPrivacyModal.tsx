import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { ShieldCheck, FileText, CheckCircle2, Lock, Scale, AlertCircle, Building2, UserCheck, Check } from 'lucide-react';

interface TermsAndPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'privacy' | 'terms';
  onAgree?: () => void;
}

export default function TermsAndPrivacyModal({
  isOpen,
  onClose,
  initialTab = 'privacy',
  onAgree,
}: TermsAndPrivacyModalProps) {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);

  // Sync tab when opening or when initialTab prop changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white w-[96vw] max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl p-0 flex flex-col shadow-2xl border border-slate-200">
        {/* Formal Civic Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-950 text-white p-5 sm:p-6 shrink-0 relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
                {activeTab === 'privacy' ? (
                  <ShieldCheck className="text-blue-300" size={24} />
                ) : (
                  <Scale className="text-indigo-300" size={24} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 bg-blue-500/30 px-2 py-0.5 rounded-full border border-blue-300/20 inline-block">
                    Republic of the Philippines
                  </span>
                  <span className="text-[10px] text-slate-300 font-medium hidden sm:inline-block">
                    Barangay Pianing • Butuan City
                  </span>
                </div>
                <DialogTitle className="text-base sm:text-lg font-bold text-white leading-tight">
                  {activeTab === 'privacy'
                    ? 'Data Privacy Policy & Statutory Notice'
                    : 'Citizen Terms of Service & Agreement'}
                </DialogTitle>
                <DialogDescription className="text-xs text-blue-100/80 mt-0.5">
                  {activeTab === 'privacy'
                    ? 'Mandated under Republic Act No. 10173 (Philippine Data Privacy Act of 2012)'
                    : 'Barangay Pianing Electronic Governance & Health Center Ecosystem'}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Segmented Tab Bar */}
          <div className="flex bg-black/25 p-1 rounded-xl mt-4 border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-white text-blue-950 shadow-sm'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <ShieldCheck size={15} />
              <span>Data Privacy Policy (RA 10173)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'terms'
                  ? 'bg-white text-blue-950 shadow-sm'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Scale size={15} />
              <span>Terms of Service</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-xs text-slate-700 space-y-4 leading-relaxed bg-slate-50/50">
          {activeTab === 'privacy' ? (
            <div className="space-y-4">
              {/* Statutory Compliance Banner */}
              <div className="p-3.5 bg-blue-50 border border-blue-200/90 rounded-2xl flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                    National Privacy Commission (NPC) Compliance Notice
                  </h4>
                  <p className="text-[11px] text-blue-900/90 mt-0.5 leading-relaxed">
                    Barangay Pianing upholds your constitutional right to personal privacy under <strong>Republic Act No. 10173</strong>. Personal and medical information collected via this portal is stored securely and processed exclusively for legitimate barangay governance and community healthcare.
                  </p>
                </div>
              </div>

              {/* Section 1: Information Collected */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center justify-center">1</span>
                  <span className="uppercase tracking-wide">Personal Information We Collect</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  When you register a resident account, apply for clearances, or schedule healthcare appointments, the system records:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <strong className="text-slate-900 block text-[11px] mb-0.5">Civic &amp; Household Profile</strong>
                    <span className="text-slate-600 text-[10.5px]">Legal name, date of birth, age, gender, civil status, and household number.</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <strong className="text-slate-900 block text-[11px] mb-0.5">Jurisdiction &amp; Residency</strong>
                    <span className="text-slate-600 text-[10.5px]">Purok designation, physical address, and documented years of residency in Pianing.</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <strong className="text-slate-900 block text-[11px] mb-0.5">Accreditation ID Document</strong>
                    <span className="text-slate-600 text-[10.5px]">Clear photographic copy of valid Government ID (PhilSys, UMID, Driver's License, etc.) used strictly for official identity verification.</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                    <strong className="text-slate-900 block text-[11px] mb-0.5">Contact Channels &amp; Clinical Info</strong>
                    <span className="text-slate-600 text-[10.5px]">Active Gmail and Philippine mobile number for SMS notifications, vital signs, maternal checkups, and child vaccine progress.</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Purpose & Lawful Processing */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center justify-center">2</span>
                  <span className="uppercase tracking-wide">Purpose &amp; Lawful Processing</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Your personal records are processed exclusively for lawful public governance and healthcare delivery:
                </p>
                <ul className="space-y-1.5 text-slate-600 text-[11px] pl-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>Issuing authenticated Barangay Clearances, Certificates of Indigency, and Residency with verifiable QR tracking.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>Facilitating health center queues, prenatal consultations, and immunization tracking by accredited Public Health Nurses and BHWs.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>Sending direct SMS and Gmail status alerts regarding clearance ready-for-pickup notices and clinic appointment schedules.</span>
                  </li>
                </ul>
              </div>

              {/* Section 3: Data Security & Strict Access Controls */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center justify-center">3</span>
                  <span className="uppercase tracking-wide">Security &amp; Confidentiality Controls</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  We implement role-based access control (RBAC). Only sworn barangay officials, licensed health center nurses, and designated BHWs can view records within their scope of duty. Resident passwords are encrypted using one-way cryptographic hashing (Bcrypt) and cannot be viewed by administrative personnel. Commercial selling or unauthorized disclosure of resident records is strictly prohibited.
                </p>
              </div>

              {/* Section 4: Citizen Data Subject Rights */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center justify-center">4</span>
                  <span className="uppercase tracking-wide">Your Rights under Section 16, RA 10173</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  As a resident data subject, you have the right to:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px] font-medium text-slate-700">
                  <div className="bg-slate-50 border border-slate-200/70 p-2 rounded-lg text-center">
                    Right to be Informed
                  </div>
                  <div className="bg-slate-50 border border-slate-200/70 p-2 rounded-lg text-center">
                    Right to Access Records
                  </div>
                  <div className="bg-slate-50 border border-slate-200/70 p-2 rounded-lg text-center">
                    Right to Rectify Data
                  </div>
                  <div className="bg-slate-50 border border-slate-200/70 p-2 rounded-lg text-center">
                    Right to File Complaint
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Terms Warning Banner */}
              <div className="p-3.5 bg-indigo-50 border border-indigo-200/90 rounded-2xl flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Scale size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                    Barangay Pianing Citizen Charter &amp; User Agreement
                  </h4>
                  <p className="text-[11px] text-indigo-900/90 mt-0.5 leading-relaxed">
                    By accessing and using this portal, you agree to conduct all transactions truthfully, abide by public service protocols, and uphold the integrity of official barangay and health center records.
                  </p>
                </div>
              </div>

              {/* Section 1: Truthful Information & Accreditation */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold flex items-center justify-center">1</span>
                  <span className="uppercase tracking-wide">Truthful Information &amp; Account Integrity</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  You certify under penalty of law that all personal details, date of birth, purok assignment, and uploaded government identification documents submitted are authentic, current, and belonging to you. Falsifying resident records is punishable under the Philippine Revised Penal Code (Articles 171 &amp; 172) and RA 10175.
                </p>
              </div>

              {/* Section 2: One Resident Per Account Policy */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold flex items-center justify-center">2</span>
                  <span className="uppercase tracking-wide">Single Account Policy &amp; Security</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Each citizen is allocated one personal resident account tied to their verified government ID and mobile number. You are responsible for maintaining the confidentiality of your login credentials. If you suspect unauthorized access, contact the Barangay Office immediately.
                </p>
              </div>

              {/* Section 3: Health Center Consultation Ethics */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold flex items-center justify-center">3</span>
                  <span className="uppercase tracking-wide">Clinic Appointments &amp; Code of Conduct</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Healthcare appointments are scheduled in coordination with clinical availability (e.g. Maternal Health, Child Immunizations, and General Consultations). Residents are expected to arrive punctually on their designated date. If you cannot attend, notify your assigned Barangay Health Worker (BHW) or cancel your slot in the portal.
                </p>
              </div>

              {/* Section 4: Document Clearance Pickup */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold flex items-center justify-center">4</span>
                  <span className="uppercase tracking-wide">Document Clearance Claiming &amp; Releases</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Official certificates and clearances issued through this system are authenticated with unique reference codes. In-person claiming at the Barangay Pianing Hall requires presenting the registered Government ID or an authorized letter of representation.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Clear Acceptance Action */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 shrink-0 space-y-3">
          {onAgree ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>
                  Clicking <strong>Accept &amp; Continue</strong> affirms that you agree to RA 10173 and Citizen Terms.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="text-xs h-9 px-4 rounded-xl text-slate-600 hover:text-slate-800 border-slate-300 cursor-pointer"
                >
                  Review Later
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    onAgree();
                    onClose();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold h-9 px-5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={15} className="stroke-[3]" />
                  <span>Accept &amp; Continue</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-slate-400" />
                Barangay Pianing Official Digital Charter
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="text-xs h-8 px-4 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
