import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { ShieldCheck, FileText, CheckCircle2, Lock, Scale, AlertCircle } from 'lucide-react';

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

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl p-0 flex flex-col shadow-2xl border border-slate-200">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
                {activeTab === 'privacy' ? <ShieldCheck className="text-blue-200" size={22} /> : <FileText className="text-blue-200" size={22} />}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white leading-tight">
                  {activeTab === 'privacy' ? 'Data Privacy Policy & Compliance Notice' : 'Terms of Service & Citizen Agreement'}
                </DialogTitle>
                <DialogDescription className="text-xs text-blue-100/90 mt-0.5">
                  Barangay Pianing Electronic Governance &amp; Community Health Information System
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex gap-2 mt-4 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <ShieldCheck size={14} /> Data Privacy (RA 10173)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'terms'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Scale size={14} /> Terms &amp; Conditions
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs text-slate-700 space-y-4 leading-relaxed">
          {activeTab === 'privacy' ? (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5">
                <Lock size={16} className="text-blue-700 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-900 leading-normal">
                  <strong>Philippine Republic Act No. 10173 (Data Privacy Act of 2012):</strong> Barangay Pianing is committed to protecting your personal, civic, and clinical health data in strict compliance with the National Privacy Commission (NPC) statutory standards.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  1. Information We Collect
                </h4>
                <p className="text-slate-600 mb-2">
                  When you register an account, apply for official barangay documents, or book consultations at the Barangay Health Center, we collect:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                  <li><strong>Civic Identity:</strong> Full legal name, date of birth, age, gender, civil status, and household number.</li>
                  <li><strong>Jurisdiction &amp; Residence:</strong> Purok assignment, physical address, and years of residency in Barangay Pianing, Butuan City.</li>
                  <li><strong>Verification Records:</strong> Scanned photo of valid Government-issued ID (e.g. PhilSys, UMID, Voter's ID, Driver's License) strictly used for identity accreditation.</li>
                  <li><strong>Contact Information:</strong> Active Gmail address and Philippine mobile contact number for SMS and email notifications.</li>
                  <li><strong>Clinical &amp; Health Records:</strong> Vital signs, primary consultations, child immunization progress, maternal health, and prescription history.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  2. Purpose &amp; Lawful Processing
                </h4>
                <p className="text-slate-600 mb-1.5">
                  Your personal data is collected and processed exclusively for the following public governance and healthcare mandates:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                  <li>Issuing authenticated Barangay Clearances, Certificates of Residency, and Indigency.</li>
                  <li>Facilitating scheduled appointments with Barangay Public Health Nurses and Barangay Health Workers (BHW).</li>
                  <li>Transmitting real-time SMS and email updates regarding clearance status and health revisit reminders.</li>
                  <li>Compiling anonymized, aggregated population and demographic census figures for municipal resource planning.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  3. Confidentiality &amp; Access Controls
                </h4>
                <p className="text-slate-600">
                  Access to sensitive personal records is strictly segregated using role-based access permissions. Only authorized Barangay Officials, accredited Health Center Nurses, and designated BHWs can view relevant health and clearance records. Passwords are cryptographically hashed using standard Bcrypt algorithms and cannot be read by personnel.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  4. Your Rights as a Data Subject
                </h4>
                <p className="text-slate-600">
                  Under the Data Privacy Act, you have the right to request access to your submitted data, demand rectification of erroneous personal details via Profile Settings, and contest improper processing by contacting the Barangay Data Protection Officer.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900 leading-normal">
                  <strong>Citizen Use Agreement:</strong> By registering and utilizing the Barangay Pianing Management Portal, you agree to comply with truthful disclosures, lawful requests, and respectful usage of public health and administrative facilities.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5">
                  1. Truthful Information &amp; Account Integrity
                </h4>
                <p className="text-slate-600">
                  You certify that all personal records, purok numbers, dates of birth, and uploaded identification documents submitted during registration are genuine and accurate. Submitting fraudulent credentials or falsifying resident identity constitutes grounds for immediate account suspension and referral under Philippine Revised Penal Code provisions on falsification.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5">
                  2. One Resident Per Account Policy
                </h4>
                <p className="text-slate-600">
                  Each resident is entitled to one official account linked to a verified Gmail address and national ID. Shared or duplicate resident accounts are flagged and subject to consolidation by the Barangay Administrator.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5">
                  3. Health Center Appointments &amp; Reservations
                </h4>
                <p className="text-slate-600">
                  Clinic slots are allocated on operating days designated by the Health Center (e.g. Mondays for Maternal Care, Wednesdays for Child Immunization, Tuesdays/Fridays for General Consultation). Residents are requested to arrive punctually. If you cannot attend your scheduled consultation, please cancel or notify your assigned BHW in advance.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5">
                  4. Document Issuance &amp; Official Pickup
                </h4>
                <p className="text-slate-600">
                  Clearances, Indigency Certificates, and Barangay Certifications generated through this system carry official tracking codes. Physical documents must be claimed at the Barangay Hall by the verified applicant or an authorized representative presenting an authorization letter and valid ID.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5">
                  5. System Availability &amp; Modifications
                </h4>
                <p className="text-slate-600">
                  The Barangay Government reserves the right to enhance system features, conduct scheduled maintenance, and adjust operating hours in alignment with municipal directives and emergency health advisories.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex sm:justify-between items-center gap-2">
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Barangay Pianing Official Digital Portal
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs h-8 px-3 rounded-xl cursor-pointer"
            >
              Close
            </Button>
            {onAgree && (
              <Button
                type="button"
                onClick={() => { onAgree(); onClose(); }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold h-8 px-4 rounded-xl cursor-pointer"
              >
                I Understand &amp; Agree
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
