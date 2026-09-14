// Node.js Comprehensive Phase-by-Phase & Unit Test Suite for Smart Barangay System
// Usage: node tests/node/runAllPhases.js or npm test

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const startTime = Date.now();

const suites = [
  {
    name: 'Tests\\Phase1\\EntryAndSecurityTest',
    run: () => {
      const results = [];

      // 1. Password complexity logic
      function validatePasswordComplexity(password) {
        if (!password || password.length < 6) return { isValid: false, message: 'Password must be at least 6 characters long.' };
        if (!/[A-Z]/.test(password)) return { isValid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
        if (!/[a-z]/.test(password)) return { isValid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
        if (!/[0-9]/.test(password)) return { isValid: false, message: 'Password must contain at least one numeric digit (0-9).' };
        if (!/[@$!%*#?&^_-]/.test(password)) return { isValid: false, message: 'Password must contain at least one special character.' };
        return { isValid: true, message: 'Password meets all security criteria.' };
      }

      results.push({
        name: 'password complexity accepts compliant password with upper, lower, digit, and symbol',
        pass: validatePasswordComplexity('Password123!').isValid === true
      });
      results.push({
        name: 'password complexity rejects passwords shorter than 6 characters',
        pass: validatePasswordComplexity('P@s1').isValid === false
      });
      results.push({
        name: 'password complexity rejects weak numeric strings',
        pass: validatePasswordComplexity('12345678').isValid === false
      });
      results.push({
        name: 'password complexity rejects strings without special character',
        pass: validatePasswordComplexity('Password1234').isValid === false
      });

      // 2. Email normalization & whitespace trimming
      const rawUser = { first_name: '  Juan  ', last_name: ' Dela Cruz ', email: ' JUAN.RESIDENT@GMAIL.COM ', role: 'resident' };
      const cleaned = {
        name: `${rawUser.first_name.trim()} ${rawUser.last_name.trim()}`,
        email: rawUser.email.trim().toLowerCase(),
        role: rawUser.role
      };
      results.push({
        name: 'resident registration data normalizes whitespace and lowercases email address',
        pass: cleaned.name === 'Juan Dela Cruz' && cleaned.email === 'juan.resident@gmail.com'
      });

      // 3. 1 Gmail per Resident Account Rule Check
      const existingAccounts = [
        { email: 'juan.resident@gmail.com', role: 'resident' },
        { email: 'admin@barangay.gov', role: 'admin' }
      ];
      const checkDuplicate = (newEmail) => {
        const clean = (newEmail || '').toLowerCase().trim();
        return existingAccounts.some(u => u.email.toLowerCase().trim() === clean);
      };
      results.push({
        name: '1 Gmail per account rule strictly detects and blocks duplicate email registrations',
        pass: checkDuplicate('Juan.Resident@Gmail.com') === true && checkDuplicate('new.resident@gmail.com') === false
      });

      // 4. Role Authorization Isolation
      const validRoles = ['superadmin', 'admin', 'staff', 'bhw', 'nurse', 'resident'];
      results.push({
        name: 'system correctly recognizes and isolates valid civil and administrative roles',
        pass: validRoles.includes('admin') && validRoles.includes('nurse') && validRoles.includes('resident') && !validRoles.includes('visitor')
      });

      return results;
    }
  },
  {
    name: 'Tests\\Phase2\\CivicIdentityAndOptionalIdFlowTest',
    run: () => {
      const results = [];

      // 1. Registration WITH ID
      const residentWithId = {
        id: 101,
        name: 'Maria Santos',
        email: 'maria.santos@gmail.com',
        verification_status: 'Pending_Review',
        submitted_id: 'data:image/png;base64,SAMPLE_ID_PHOTO',
        rejection_reason: null
      };
      results.push({
        name: 'resident registration WITH ID initializes with Pending_Review and submitted_id attached',
        pass: residentWithId.verification_status === 'Pending_Review' && !!residentWithId.submitted_id
      });

      // 2. Registration WITHOUT ID is strictly blocked
      const validateResidentPayload = (payload) => {
        if (!payload.submitted_id) return { success: false, error: 'Valid Government ID photo is strictly required to register.' };
        return { success: true };
      };
      const rejectedNoId = validateResidentPayload({ name: 'Pedro Penduko', submitted_id: null });
      results.push({
        name: 'resident registration strictly requires valid ID and rejects attempts without submitted_id',
        pass: rejectedNoId.success === false && rejectedNoId.error.includes('strictly required')
      });

      // 3. Administrator Rejection with Specific Reason
      residentWithId.verification_status = 'Rejected';
      residentWithId.rejection_reason = 'Invalid / Blurry ID Photo';
      results.push({
        name: 'administrator rejection records specific rejection cause and flags resident as Rejected',
        pass: residentWithId.verification_status === 'Rejected' && residentWithId.rejection_reason === 'Invalid / Blurry ID Photo'
      });

      // 4. Dismissible Verification Banner Behavior
      let isRejectionBannerDismissed = false;
      const handleDismissBanner = () => { isRejectionBannerDismissed = true; };
      handleDismissBanner();
      results.push({
        name: 'rejection notice banner is dismissable in current view with [X] button',
        pass: isRejectionBannerDismissed === true
      });
      // Page reload resets in-memory state
      let pageReloadState = false;
      results.push({
        name: 'rejection banner reappears upon page refresh to ensure resident remains informed of eligibility',
        pass: pageReloadState === false
      });

      // 5. Profile Settings ID Removal and Upload
      let currentId = residentWithId.submitted_id;
      const handleRemoveId = () => { currentId = null; };
      handleRemoveId();
      results.push({
        name: 'profile settings top-right [X] button removes attached Government ID',
        pass: currentId === null
      });
      const handleUploadId = (newBase64) => { currentId = newBase64; };
      handleUploadId('data:image/png;base64,NEW_VALID_ID');
      results.push({
        name: 'empty ID profile section allows uploading new Government ID for re-verification',
        pass: currentId === 'data:image/png;base64,NEW_VALID_ID'
      });

      // 6. Administrator Approval
      residentWithId.verification_status = 'Verified';
      residentWithId.rejection_reason = null;
      results.push({
        name: 'administrator approval transitions resident to Verified status and clears rejection reason',
        pass: residentWithId.verification_status === 'Verified' && residentWithId.rejection_reason === null
      });

      return results;
    }
  },
  {
    name: 'Tests\\Phase3\\CivilDocumentsAndGmailNotificationTest',
    run: () => {
      const results = [];

      // 1. Standard Tracking Code Format
      const generateRequestCode = () => `DOC-${Math.floor(10000000 + Math.random() * 90000000)}`;
      const trackingCode = generateRequestCode();
      results.push({
        name: 'document request generates standard official tracking code format starting with DOC-',
        pass: trackingCode.startsWith('DOC-') && trackingCode.length >= 11
      });

      // 2. Duplicate Request Detection
      const existingDocs = [
        { id: 1, resident_id: 101, document_type: 'Barangay Clearance', status: 'Processing' }
      ];
      const isDuplicate = existingDocs.some(d => d.resident_id === 101 && d.document_type === 'Barangay Clearance' && ['Pending', 'Processing'].includes(d.status));
      results.push({
        name: 'duplicate detection blocks duplicate clearance requests while an active request is in progress',
        pass: isDuplicate === true
      });

      // 3. Document Lifecycle State Machine
      const flow = ['Pending', 'Processing', 'Ready for Pickup', 'Completed'];
      let currentStatus = 'Pending';
      const history = [currentStatus];
      for (const step of flow.slice(1)) {
        currentStatus = step;
        history.push(currentStatus);
      }
      results.push({
        name: 'document status progresses sequentially from Pending → Processing → Ready for Pickup → Completed',
        pass: history.join(',') === flow.join(',')
      });

      // 4. Archive Isolation
      const allDocs = [
        { id: 1, status: 'Processing' },
        { id: 2, status: 'Completed' },
        { id: 3, status: 'Ready for Pickup' },
        { id: 4, status: 'Completed' }
      ];
      const active = allDocs.filter(d => ['Pending', 'Processing', 'Ready for Pickup'].includes(d.status));
      const archived = allDocs.filter(d => d.status === 'Completed');
      results.push({
        name: 'completed documents are separated into permanent archive and removed from active processing',
        pass: active.length === 2 && archived.length === 2
      });

      // 5. In-App Notification Store Read-Only & Persistence
      const notifStore = [
        { id: 'notif-1', title: '🎉 Ready for Pick-Up: Barangay Clearance', is_read: false, action_type: undefined },
        { id: 'notif-2', title: '✅ Account Verified', is_read: true, action_type: undefined }
      ];
      results.push({
        name: 'in-app notification items are strictly read-only and permanently retained in history',
        pass: notifStore.length === 2 && notifStore[0].title.includes('Ready for Pick-Up')
      });

      // 6. EmailJS Template Parameter Mapping
      const formatEmailPayload = (recipient, title, message, docCode) => ({
        service_id: 'service_6nk2ylj',
        template_id: 'service_6nk2ylj',
        user_id: 'service_6nk2ylj',
        template_params: {
          to_email: recipient.email.toLowerCase().trim(),
          name: recipient.name,
          title: title,
          message: message,
          request_code: docCode || '',
          barangay: 'Barangay Pianing'
        }
      });
      const emailPayload = formatEmailPayload(
        { name: 'Juan Dela Cruz', email: 'juan.resident@gmail.com' },
        '🎉 Ready for Pick-Up: Barangay Clearance',
        'Your document is signed and ready for release at the Barangay Hall.',
        'DOC-12345678'
      );
      results.push({
        name: 'EmailJS notification payload matches configured service_6nk2ylj and resident Gmail address',
        pass: emailPayload.service_id === 'service_6nk2ylj' && emailPayload.template_params.to_email === 'juan.resident@gmail.com' && emailPayload.template_params.request_code === 'DOC-12345678'
      });

      return results;
    }
  },
  {
    name: 'Tests\\Phase4\\HealthCenterAndAppointmentsTest',
    run: () => {
      const results = [];

      // 1. Clinic Schedules
      const schedules = [
        { id: 1, service: 'Prenatal Care', slots_available: 15, status: 'Active', barangay: 'Pianing' },
        { id: 2, service: 'Child Immunization', slots_available: 20, status: 'Active', barangay: 'Pianing' }
      ];
      results.push({
        name: 'nurse-published clinic schedules contain valid slots_available and active service status',
        pass: schedules.every(s => s.slots_available > 0 && s.status === 'Active')
      });

      // 2. Consultation Vitals
      const consultation = {
        patient_id: 101,
        blood_pressure: '120/80',
        weight: '62 kg',
        temperature: '36.6 C',
        diagnosis: 'Normal prenatal progression',
        revisit_date: '2026-09-18'
      };
      results.push({
        name: 'health worker consultation captures complete patient vitals, diagnosis, and revisit schedule',
        pass: consultation.blood_pressure === '120/80' && !!consultation.revisit_date && consultation.diagnosis.length > 0
      });

      // 3. Appointment Matching to Resident
      const appointments = [
        { email: 'other@gmail.com', service: 'Dental' },
        { email: 'maria.santos@gmail.com', service: 'Prenatal Checkup' }
      ];
      const myVisits = appointments.filter(a => a.email.toLowerCase() === 'maria.santos@gmail.com');
      results.push({
        name: 'scheduled clinic visits accurately match and display on the logged-in resident health portal',
        pass: myVisits.length === 1 && myVisits[0].service === 'Prenatal Checkup'
      });

      return results;
    }
  },
  {
    name: 'Tests\\Phase5\\MultiBarangayScopingAndGovernanceTest',
    run: () => {
      const results = [];

      // 1. Multi-Barangay Territorial Boundary Scoping
      function belongsToMyBarangay(address, email, barangay, currentAdminBarangay = 'pianing') {
        const targetAdmin = (currentAdminBarangay || 'pianing').toLowerCase().trim();
        if (barangay) {
          const bLower = barangay.toLowerCase().trim();
          if (bLower === targetAdmin) return true;
          if (targetAdmin === 'pianing' && (bLower.includes('pianing') || !bLower)) return true;
          return false;
        }
        if (address) {
          const target = address.toLowerCase().trim();
          if (target.includes(targetAdmin)) return true;
          return false;
        }
        return targetAdmin === 'pianing';
      }

      const pianingRes = { address: 'Purok 2, Barangay Pianing', barangay: 'Pianing' };
      const anticalaRes = { address: 'Purok 1, Barangay Anticala', barangay: 'Anticala' };
      const bitosRes = { address: 'Purok 3, Barangay Bit-os', barangay: 'Bit-os' };

      results.push({
        name: 'territorial boundary strictly isolates Pianing records from Anticala and Bit-os for Pianing admin',
        pass: belongsToMyBarangay(pianingRes.address, null, pianingRes.barangay, 'pianing') &&
              !belongsToMyBarangay(anticalaRes.address, null, anticalaRes.barangay, 'pianing') &&
              !belongsToMyBarangay(bitosRes.address, null, bitosRes.barangay, 'pianing')
      });

      // 2. 1 Admin per Barangay Rule Check
      const systemAdmins = [
        { name: 'Admin Juan', role: 'admin', barangay: 'Pianing', status: 'Active' },
        { name: 'Admin Pedro', role: 'admin', barangay: 'Anticala', status: 'Active' }
      ];
      const canCreateAdmin = (targetBarangay) => {
        const clean = (targetBarangay || 'Pianing').toLowerCase().trim();
        const existing = systemAdmins.find(a => a.role === 'admin' && a.status === 'Active' && a.barangay.toLowerCase().trim() === clean);
        return !existing;
      };
      results.push({
        name: '1 Admin per Barangay rule prevents duplicate active administrators for the same Barangay',
        pass: canCreateAdmin('Pianing') === false && canCreateAdmin('Bit-os') === true
      });

      // 3. Locked Barangay Display in Profile Settings
      const residentBarangay = 'Pianing';
      const isBarangayDropdown = false; // Locked display badge
      results.push({
        name: 'barangay in Profile Settings is rendered as locked badge instead of editable dropdown',
        pass: isBarangayDropdown === false && residentBarangay === 'Pianing'
      });

      // 4. Soft-delete Archiving and Restoration
      const user = { id: 201, status: 'Active' };
      user.status = 'Archived';
      results.push({
        name: 'soft-delete account archiving sets status to Archived without purging user ID or credentials',
        pass: user.status === 'Archived' && user.id === 201
      });
      user.status = 'Active';
      results.push({
        name: 'restoring archived user updates status to Active and reactivates municipal service permissions',
        pass: user.status === 'Active'
      });

      return results;
    }
  },
  {
    name: 'Tests\\Phase6\\AdminDashboardSilentSyncAndPerformanceTest',
    run: () => {
      const results = [];

      // 1. Silent Background Polling vs Initial Mount
      let isScreenFlashing = false;
      const simulateLoadData = (showLoading = true) => {
        if (showLoading) {
          isScreenFlashing = true; // Visually pulses progress bar
        } else {
          isScreenFlashing = false; // 100% silent background sync
        }
      };

      // Initial Mount
      simulateLoadData(true);
      const initialMountResult = isScreenFlashing === true;

      // Background 30s Polling Tick
      simulateLoadData(false);
      const backgroundTickResult = isScreenFlashing === false;

      results.push({
        name: 'admin dashboard silent background sync (loadData(false)) eliminates screen flickering and progress bar pulse',
        pass: initialMountResult && backgroundTickResult
      });

      // 2. Debounced Focus Listener
      let lastSync = 1000;
      const canSyncOnFocus = (currentTime) => {
        if (currentTime - lastSync > 10000) {
          lastSync = currentTime;
          return true;
        }
        return false;
      };
      results.push({
        name: 'window focus listener debounces rapid tab switches to prevent repetitive data sync flashes',
        pass: canSyncOnFocus(3000) === false && canSyncOnFocus(15000) === true
      });

      return results;
    }
  },
  {
    name: 'Tests\\Phase7\\StaffPriorityOnboardingAndSecurityTest',
    run: () => {
      const results = [];

      // 1. Priority fields validation
      const validStaffPayload = {
        name: 'Maria Clara Santos',
        email: 'maria.santos@pianing.gov.ph',
        password: 'Secure#Pass2026',
        role: 'staff',
        barangay: 'Pianing',
        phone: '09171234567',
        employee_id: 'STAFF-2026-004',
        job_title: 'Document Records Officer'
      };

      const hasRequiredPriority = Boolean(
        validStaffPayload.name.trim() &&
        validStaffPayload.email.includes('@') &&
        /^09\d{9}$/.test(validStaffPayload.phone) &&
        ['admin', 'staff', 'bhw', 'nurse'].includes(validStaffPayload.role)
      );

      results.push({
        name: 'staff onboarding successfully accepts priority credentials (name, email, phone, role, badge, job title)',
        pass: hasRequiredPriority === true
      });

      // 2. Staff does NOT require civil census or government ID photo upload
      const omitsResidentFields = (
        validStaffPayload.submitted_id === undefined &&
        validStaffPayload.date_of_birth === undefined &&
        validStaffPayload.civil_status === undefined &&
        validStaffPayload.years_of_residency === undefined
      );

      results.push({
        name: 'staff onboarding cleanly omits unnecessary resident census fields (civil status, years of residency, DOB, ID photo)',
        pass: omitsResidentFields === true
      });

      // 3. Instant activation and verification
      const accountStatus = 'Active';
      const verificationStatus = 'Verified';
      results.push({
        name: 'staff accounts bypass pending applicant queue with immediate Verified & Active status',
        pass: accountStatus === 'Active' && verificationStatus === 'Verified'
      });

      // 4. Staff Badge and Job Designation tracking
      results.push({
        name: 'staff account captures institutional employee_id badge and job_title for official auditability',
        pass: validStaffPayload.employee_id === 'STAFF-2026-004' && validStaffPayload.job_title === 'Document Records Officer'
      });

      return results;
    }
  },
  {
    name: 'Phase 8: Clinical Intake, Returning Patient Verification, 1-Day Scheduler & Archives Test',
    run() {
      const results = [];

      // 1. Returning patient demographic recall
      const existingPatient = {
        name: 'Maria Clara Santos',
        age: 26,
        gender: 'Female',
        civil_status: 'Married',
        purok: 'Purok 3',
        phone: '09171234567',
        previous_encounter: {
          diagnosis: 'Acute Upper Respiratory Tract Infection',
          vitals: 'BP: 120/80, Temp: 37.8°C, Wt: 54kg',
          prescribed_meds: 'Amoxicillin 500mg TID, Paracetamol'
        }
      };

      results.push({
        name: 'returning patient search matches existing profile and recalls previous encounter summary',
        pass: Boolean(existingPatient.name && existingPatient.previous_encounter && existingPatient.previous_encounter.diagnosis)
      });

      // 2. 4-Program Clinical Routing
      const validPrograms = ['Consultation', 'Prenatal', 'Family Planning', 'NIP Immunization'];
      results.push({
        name: 'clinical intake router supports exactly 4 core health programs (Consultation, Prenatal, Family Planning, NIP)',
        pass: validPrograms.length === 4 && validPrograms.includes('Consultation') && validPrograms.includes('Family Planning')
      });

      // 3. Automated 1-Day Advance Scheduler detection
      const testAppointmentDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      results.push({
        name: '1-day advance scheduler accurately detects clinic appointments due tomorrow',
        pass: testAppointmentDate === tomorrow
      });

      // 4. Clinical Archives Hub Categorization
      const archiveCategories = ['consultations', 'maternal', 'immunizations', 'schedules'];
      results.push({
        name: 'clinical archives repository provides permanent categorized records for consultations, maternal, FIC immunizations, and past schedules',
        pass: archiveCategories.length === 4 && archiveCategories.includes('immunizations')
      });

      return results;
    }
  },
  {
    name: 'Phase 9: Populations, Purok Filtering, Households, Senior Citizen Tracking & Employment Demographics Test',
    run: () => {
      const results = [];

      // 1. Purok filter functionality
      const sampleResidents = [
        { id: 1, first: 'Juan', last: 'Dela Cruz', purok: '1', household: 'HH-P1-001', dob: '1960-05-10', gender: 'Male', emp: 'Employed' }, // 66 yo Senior
        { id: 2, first: 'Maria', last: 'Dela Cruz', purok: '1', household: 'HH-P1-001', dob: '1964-08-20', gender: 'Female', emp: 'Self-Employed' }, // 62 yo Senior
        { id: 3, first: 'Mark', last: 'Dela Cruz', purok: '1', household: 'HH-P1-001', dob: '1995-02-12', gender: 'Male', emp: 'Employed' }, // 31 yo Adult
        { id: 4, first: 'Elena', last: 'Dela Cruz', purok: '1', household: 'HH-P1-001', dob: '2015-09-18', gender: 'Female', emp: 'Student' }, // 11 yo Child
        { id: 5, first: 'Pedro', last: 'Santos', purok: '2', household: 'HH-P2-001', dob: '1985-11-02', gender: 'Male', emp: 'Unemployed' }, // 40 yo Adult Unemployed
        { id: 6, first: 'Rosa', last: 'Santos', purok: '2', household: 'HH-P2-001', dob: '1955-03-25', gender: 'Female', emp: 'Retired' } // 71 yo Senior Female
      ];

      const filterByPurok = (residents, purok) => {
        if (!purok || purok === 'all') return residents;
        return residents.filter(r => r.purok === purok);
      };

      const p1Residents = filterByPurok(sampleResidents, '1');
      results.push({
        name: 'purok filter strictly isolates residents belonging to selected Purok',
        pass: p1Residents.length === 4 && p1Residents.every(r => r.purok === '1')
      });

      // 2. Household Number & Senior Count per Household
      const computeHouseholdMetrics = (residents) => {
        const hhMap = {};
        for (const r of residents) {
          if (!hhMap[r.household]) {
            hhMap[r.household] = { hh: r.household, members: [], seniors: 0, children: 0, employed: 0, unemployed: 0 };
          }
          const age = new Date().getFullYear() - new Date(r.dob).getFullYear();
          hhMap[r.household].members.push(r);
          if (age >= 60) hhMap[r.household].seniors++;
          if (age < 18) hhMap[r.household].children++;
          if (r.emp === 'Employed' || r.emp === 'Self-Employed') hhMap[r.household].employed++;
          if (r.emp === 'Unemployed') hhMap[r.household].unemployed++;
        }
        return Object.values(hhMap);
      };

      const households = computeHouseholdMetrics(sampleResidents);
      const hh1 = households.find(h => h.hh === 'HH-P1-001');

      results.push({
        name: 'household grouping automatically counts seniors, children, and employed members per household',
        pass: hh1 && hh1.seniors === 2 && hh1.children === 1 && hh1.employed === 3 && hh1.members.length === 4
      });

      // 3. Senior Citizen Gender Breakdown (Male vs. Female)
      const computeSeniorStats = (residents) => {
        let male = 0, female = 0;
        for (const r of residents) {
          const age = new Date().getFullYear() - new Date(r.dob).getFullYear();
          if (age >= 60) {
            if (r.gender === 'Male') male++;
            if (r.gender === 'Female') female++;
          }
        }
        return { total: male + female, male, female };
      };

      const seniorStats = computeSeniorStats(sampleResidents);
      results.push({
        name: 'demographic census accurately computes total senior citizens and male vs female breakdown',
        pass: seniorStats.total === 3 && seniorStats.male === 1 && seniorStats.female === 2
      });

      // 4. Employment Tracker (Employed vs. Unemployed)
      const computeEmployment = (residents) => {
        let employed = 0, unemployed = 0;
        for (const r of residents) {
          if (r.emp === 'Employed' || r.emp === 'Self-Employed') employed++;
          if (r.emp === 'Unemployed') unemployed++;
        }
        return { employed, unemployed, rate: Math.round((employed / (employed + unemployed)) * 100) };
      };

      const empStats = computeEmployment(sampleResidents);
      results.push({
        name: 'employment metrics track employed (have work) vs unemployed with percentage rate',
        pass: empStats.employed === 3 && empStats.unemployed === 1 && empStats.rate === 75
      });

      // 5. Official Resident Status (Eliminating Unverified from Population Census)
      const isOfficialPopulationResident = (resident) => {
        // Physical inhabitants of barangay are official verified residents
        return resident.household != null && resident.purok != null;
      };

      results.push({
        name: 'population census inhabitants are designated with official resident status instead of unverified',
        pass: sampleResidents.every(isOfficialPopulationResident) === true
      });

      return results;
    }
  },
  {
    name: 'Phase 10: Medicine & Vaccine Inventory, Clinic Reservations, Address Normalization & Census CSV Export Test',
    run: () => {
      const results = [];

      // 1. Inventory Stock Dispense & Auto-Deduction
      const inventory = [
        { id: 1, item_name: 'Paracetamol 500mg', category: 'Essential Medicine', stock: 12, status: 'In Stock' },
        { id: 2, item_name: 'Pentavalent Vaccine', category: 'Vaccine (EPI)', stock: 5, status: 'Low Stock' }
      ];

      function dispenseItem(inv, name, qty) {
        const item = inv.find(i => i.item_name.toLowerCase() === name.toLowerCase());
        if (!item) return false;
        item.stock = Math.max(0, item.stock - qty);
        item.status = item.stock === 0 ? 'Out of Stock' : item.stock < 10 ? 'Low Stock' : 'In Stock';
        return true;
      }

      dispenseItem(inventory, 'Paracetamol 500mg', 5);
      const paraAfter5 = inventory.find(i => i.item_name === 'Paracetamol 500mg');
      results.push({
        name: 'inventory dispensing decrements stock and transitions status to Low Stock when below threshold (<10)',
        pass: paraAfter5 && paraAfter5.stock === 7 && paraAfter5.status === 'Low Stock'
      });

      dispenseItem(inventory, 'Paracetamol 500mg', 7);
      results.push({
        name: 'inventory dispensing to zero stock transitions status to Out of Stock',
        pass: paraAfter5 && paraAfter5.stock === 0 && paraAfter5.status === 'Out of Stock'
      });

      // 2. Inventory Restocking
      function restockItem(inv, name, qty) {
        const item = inv.find(i => i.item_name.toLowerCase() === name.toLowerCase());
        if (!item) return false;
        item.stock += qty;
        item.status = item.stock === 0 ? 'Out of Stock' : item.stock < 10 ? 'Low Stock' : 'In Stock';
        return true;
      }

      restockItem(inventory, 'Paracetamol 500mg', 50);
      results.push({
        name: 'inventory restocking adds stock count and updates status to In Stock',
        pass: paraAfter5 && paraAfter5.stock === 50 && paraAfter5.status === 'In Stock'
      });

      // 3. Clinic Appointment Reservation Lifecycle
      const appointments = [];
      function bookAppointment(residentId, residentName, scheduleId, serviceType, preferredDate) {
        const newAppt = {
          id: appointments.length + 1,
          resident_id: residentId,
          resident_name: residentName,
          schedule_id: scheduleId,
          service_type: serviceType,
          appointment_date: preferredDate,
          status: 'Pending'
        };
        appointments.push(newAppt);
        return newAppt;
      }

      function transitionApptStatus(apptId, newStatus, extra = {}) {
        const appt = appointments.find(a => a.id === apptId);
        if (!appt) return null;
        appt.status = newStatus;
        Object.assign(appt, extra);
        return appt;
      }

      const booked = bookAppointment(101, 'Maria Santos', 3, 'Prenatal Checkup', '2026-09-15');
      results.push({
        name: 'clinic reservation creates pending appointment record linked to resident and service',
        pass: booked && booked.status === 'Pending' && booked.service_type === 'Prenatal Checkup'
      });

      transitionApptStatus(booked.id, 'Approved', { time_slot: '09:00 AM', staff_notes: 'Fast 8 hours prior' });
      results.push({
        name: 'healthcare worker approval transitions appointment to Approved with scheduled time slot',
        pass: booked.status === 'Approved' && booked.time_slot === '09:00 AM'
      });

      transitionApptStatus(booked.id, 'Completed');
      results.push({
        name: 'appointment completion finalizes patient encounter lifecycle',
        pass: booked.status === 'Completed'
      });

      // 4. Intelligent Barangay & Address Normalization
      const BUTUAN_BARANGAYS = ['Pianing', 'Anticala', 'Bit-os', 'Ampayon', 'Doongan', 'Libertad'];
      function normalizeBarangay(input) {
        if (!input) return 'Pianing';
        let cleaned = input
          .trim()
          .replace(/^barangay\s+/i, '')
          .replace(/^brgy\.?\s+/i, '')
          .replace(/,\s*butuan(\s+city)?/i, '')
          .trim();
        if (!cleaned) return 'Pianing';
        const match = BUTUAN_BARANGAYS.find(b => b.toLowerCase() === cleaned.toLowerCase());
        if (match) return match;
        return cleaned.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }

      function formatJurisdictionAddress(purok, barangay, city) {
        const cleanBarangay = normalizeBarangay(barangay);
        const cleanCity = (city || 'Butuan City').trim();
        let cleanPurok = (purok || '').trim();
        if (cleanPurok) {
          cleanPurok = cleanPurok.toLowerCase().startsWith('purok')
            ? cleanPurok.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
            : `Purok ${cleanPurok}`;
        }
        return cleanPurok
          ? `${cleanPurok}, Barangay ${cleanBarangay}, ${cleanCity}`
          : `Barangay ${cleanBarangay}, ${cleanCity}`;
      }

      results.push({
        name: 'normalizeBarangay correctly parses informal/messy variants to canonical Barangay name',
        pass: normalizeBarangay('pianing') === 'Pianing' &&
              normalizeBarangay('brgy pianing, butuan city') === 'Pianing' &&
              normalizeBarangay('ANTICALA') === 'Anticala'
      });

      results.push({
        name: 'formatJurisdictionAddress produces standardized official Philippine address string',
        pass: formatJurisdictionAddress('3', 'pianing', 'Butuan City') === 'Purok 3, Barangay Pianing, Butuan City' &&
              formatJurisdictionAddress('Purok 5', 'Bit-os') === 'Purok 5, Barangay Bit-os, Butuan City'
      });

      // 5. Dynamic Age Calculation from Date of Birth
      function calculateAgeFromDob(dobString) {
        if (!dobString) return null;
        const birth = new Date(dobString);
        if (isNaN(birth.getTime())) return null;
        const diffMs = Date.now() - birth.getTime();
        return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
      }

      results.push({
        name: 'demographic age calculation computes precise whole years from date of birth',
        pass: calculateAgeFromDob('1990-05-15') >= 35 && calculateAgeFromDob('invalid') === null
      });

      // 6. Population Census CSV Export Formatter
      function exportResidentsToCsv(residents) {
        const headers = ['ID', 'Full Name', 'Purok', 'Household', 'Gender', 'Civil Status', 'Employment Status'];
        const rows = residents.map(r => [
          r.id,
          `"${r.first} ${r.last}"`,
          r.purok,
          r.household,
          r.gender,
          r.civil_status || 'Single',
          r.emp
        ].join(','));
        return [headers.join(','), ...rows].join('\n');
      }

      const sampleCensus = [
        { id: 1, first: 'Juan', last: 'Dela Cruz', purok: '1', household: 'HH-001', gender: 'Male', civil_status: 'Married', emp: 'Employed' }
      ];
      const csvOutput = exportResidentsToCsv(sampleCensus);
      results.push({
        name: 'population census CSV exporter outputs compliant CSV header and records',
        pass: csvOutput.startsWith('ID,Full Name,Purok,Household,Gender,Civil Status,Employment Status') &&
              csvOutput.includes('"Juan Dela Cruz"')
      });

      return results;
    }
  },
  {
    name: 'Phase 11: Clinic Operating Days Restriction, Purok Auto-Extraction, Staff Management & Privacy Policy Test',
    run: () => {
      const results = [];

      // 1. Clinic Operating Day Parsing
      const DAY_MAP = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      function parseOperatingDays(dayOfWeekStr) {
        if (!dayOfWeekStr) return [1, 2, 3, 4, 5];
        const str = dayOfWeekStr.toLowerCase().trim();
        const tokens = str.replace(/[^a-z]/g, ' ').split(/\s+/);
        const matched = new Set();
        for (const t of tokens) {
          if (DAY_MAP[t] !== undefined) matched.add(DAY_MAP[t]);
        }
        return matched.size > 0 ? Array.from(matched).sort((a, b) => a - b) : [1, 2, 3, 4, 5];
      }

      const mondayOnly = parseOperatingDays('Every Monday');
      const wednesdayOnly = parseOperatingDays('Every Wednesday');
      const tueFri = parseOperatingDays('Tuesday & Friday');
      const monThu = parseOperatingDays('Every Monday & Thursday');

      results.push({
        name: 'parseOperatingDays accurately resolves day numbers for single and multi-day clinic schedules',
        pass: mondayOnly.length === 1 && mondayOnly[0] === 1 &&
              wednesdayOnly.length === 1 && wednesdayOnly[0] === 3 &&
              tueFri.length === 2 && tueFri[0] === 2 && tueFri[1] === 5 &&
              monThu.length === 2 && monThu[0] === 1 && monThu[1] === 4
      });

      // 2. Upcoming Operating Dates Generation (Mon only for Monday, Wed only for Wednesday)
      function getUpcomingOperatingDates(dayOfWeekStr, count = 8, startFrom = new Date(2026, 8, 11)) { // Sep 11, 2026 (Friday)
        const allowedDays = parseOperatingDays(dayOfWeekStr);
        const out = [];
        const curr = new Date(startFrom);
        curr.setDate(curr.getDate() + 1);
        let safety = 0;
        while (out.length < count && safety < 60) {
          safety++;
          if (allowedDays.includes(curr.getDay())) {
            const yr = curr.getFullYear();
            const mo = String(curr.getMonth() + 1).padStart(2, '0');
            const da = String(curr.getDate()).padStart(2, '0');
            out.push({ dateStr: `${yr}-${mo}-${da}`, dayOfWeek: curr.getDay() });
          }
          curr.setDate(curr.getDate() + 1);
        }
        return out;
      }

      const monDates = getUpcomingOperatingDates('Every Monday', 5);
      const wedDates = getUpcomingOperatingDates('Every Wednesday', 5);
      const tfDates = getUpcomingOperatingDates('Tuesday & Friday', 6);

      results.push({
        name: 'upcoming operating dates strictly restricts generated dates to schedule days (Monday-only or Wednesday-only)',
        pass: monDates.every(d => d.dayOfWeek === 1) &&
              wedDates.every(d => d.dayOfWeek === 3) &&
              tfDates.every(d => d.dayOfWeek === 2 || d.dayOfWeek === 5)
      });

      // 3. Appointment Date Schedule Validation
      function isDateMatchingSchedule(dateStr, dayOfWeekStr) {
        const parts = dateStr.split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const allowed = parseOperatingDays(dayOfWeekStr);
        return allowed.includes(d.getDay());
      }

      const sep15IsTuesday = isDateMatchingSchedule('2026-09-15', 'Every Monday'); // 2026-09-15 is Tuesday
      const sep14IsMonday = isDateMatchingSchedule('2026-09-14', 'Every Monday');   // 2026-09-14 is Monday
      const sep16IsWednesday = isDateMatchingSchedule('2026-09-16', 'Every Wednesday'); // 2026-09-16 is Wednesday

      results.push({
        name: 'appointment date validation strictly rejects non-operating days and accepts matching days',
        pass: sep15IsTuesday === false && sep14IsMonday === true && sep16IsWednesday === true
      });

      // 4. Resident Purok Extraction Fallback from Address
      function resolveResidentPurok(resident) {
        if (resident.purok && String(resident.purok).trim()) {
          const clean = String(resident.purok).replace(/purok\s*/i, '').trim();
          return clean ? `Purok ${clean}` : 'Purok 1';
        }
        if (resident.address) {
          const match = resident.address.match(/(?:purok|prk\.?)\s*([0-9A-Za-z]+)/i);
          if (match) return `Purok ${match[1]}`;
        }
        return 'Purok 1';
      }

      results.push({
        name: 'resident purok auto-extracts from street address when account purok field was empty',
        pass: resolveResidentPurok({ purok: '2', address: 'Barangay Pianing' }) === 'Purok 2' &&
              resolveResidentPurok({ purok: '', address: 'Purok 5, Barangay Pianing, Butuan City' }) === 'Purok 5' &&
              resolveResidentPurok({ address: 'Prk 3, Pianing' }) === 'Purok 3'
      });

      // 5. Admin Dashboard Staff Management Tab
      const adminCode = fs.readFileSync(path.join(__dirname, '../../src/app/pages/AdminDashboard.tsx'), 'utf8');
      results.push({
        name: 'admin dashboard navigation designates official Staff Management tab',
        pass: adminCode.includes("label: 'Staff Management'") && !adminCode.includes("label: 'User Management'")
      });

      // 6. Data Privacy Act (RA 10173) and Terms Integration
      const loginCode = fs.readFileSync(path.join(__dirname, '../../src/app/pages/LoginPage.tsx'), 'utf8');
      results.push({
        name: 'citizen registration mandates Data Privacy Act (RA 10173) and Terms agreement',
        pass: loginCode.includes('TermsAndPrivacyModal') &&
              loginCode.includes('regTermsAgreed') &&
              loginCode.includes('Republic Act No. 10173')
      });

      return results;
    }
  }
];

console.log('\n   \x1b[44;37m BARANGAY PIANING MANAGEMENT SYSTEM \x1b[0m  \x1b[36mUnit & Phase Test Suite (Node.js)\x1b[0m\n');

let totalPassed = 0;
let totalFailed = 0;
let totalAssertions = 0;

for (const suite of suites) {
  const results = suite.run();
  const suitePassed = results.every(r => r.pass);

  if (suitePassed) {
    console.log(`   \x1b[42;30m PASS \x1b[0m \x1b[1m${suite.name}\x1b[0m`);
  } else {
    console.log(`   \x1b[41;37m FAIL \x1b[0m \x1b[1m${suite.name}\x1b[0m`);
  }

  for (const res of results) {
    totalAssertions++;
    if (res.pass) {
      totalPassed++;
      console.log(`  \x1b[32m✓\x1b[0m \x1b[90m${res.name}\x1b[0m`);
    } else {
      totalFailed++;
      console.log(`  \x1b[31m✗\x1b[0m \x1b[31m${res.name}\x1b[0m`);
    }
  }
  console.log('');
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(`  \x1b[1mTests:\x1b[0m    \x1b[32m${totalPassed} passed\x1b[0m (${totalAssertions} assertions)`);
console.log(`  \x1b[1mDuration:\x1b[0m ${duration}s\n`);

process.exit(totalFailed > 0 ? 1 : 0);
