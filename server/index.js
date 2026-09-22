import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { testConnection, getPool, getStatus } from './config/db.js';
import { sendLiveSms, formatPhoneNumber } from './services/smsService.js';
import {
  sendEmail,
  sendDocumentStatusEmail,
  sendImmunizationReminderEmail,
  sendMaternalReminderEmail,
  sendRegistrationEmail,
  sendVerificationNoticeEmail,
  sendAnnouncementEmail,
  sendAppointmentStatusEmail,
  sendDirectNotificationEmail,
  sendProfileUpdateEmail,
} from './services/emailService.js';
import { jsPDF } from 'jspdf';
import {
  computeNextDose,
  computeNextMaternalVisit,
  getFullVaccineSchedule,
  getFullPrenatalSchedule,
  getOverdueImmunizations,
  getOverdueMaternalVisits,
  VACCINE_SCHEDULE,
} from './services/schedulingService.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// -------------------------------------------------------------
// Password Hashing & Verification Utilities (Bcrypt)
// -------------------------------------------------------------
async function hashPassword(plainPassword) {
  if (!plainPassword) return '';
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(String(plainPassword), salt);
}

async function verifyPassword(inputPassword, storedHashOrPlain) {
  if (!inputPassword || !storedHashOrPlain) return false;
  if (storedHashOrPlain.startsWith('$2a$') || storedHashOrPlain.startsWith('$2b$') || storedHashOrPlain.startsWith('$2y$')) {
    return await bcrypt.compare(String(inputPassword), storedHashOrPlain);
  }
  // Fallback for existing legacy plain-text passwords
  return String(inputPassword) === String(storedHashOrPlain);
}

function validatePasswordComplexity(password) {
  if (!password || typeof password !== 'string' || password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least 1 uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least 1 lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least 1 numeric digit (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least 1 special character (e.g. @, $, !, %, *, #, ?, &).' };
  }
  return { isValid: true };
}

function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>?/gm, '').trim();
}

function toTitleCase(str) {
  if (!str) return '';
  return str.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function normalizeBarangayName(str) {
  if (!str) return 'Pianing';
  let clean = str.trim()
    .replace(/^barangay\s+/i, '')
    .replace(/^brgy\.?\s+/i, '')
    .replace(/,\s*butuan(\s+city)?/i, '')
    .trim();
  if (!clean) return 'Pianing';
  if (clean.toLowerCase() === 'pianing') return 'Pianing';
  if (clean.toLowerCase() === 'anticala') return 'Anticala';
  if (clean.toLowerCase() === 'bit-os' || clean.toLowerCase() === 'bitos') return 'Bit-os';
  return toTitleCase(clean);
}

// Serve compiled Vite frontend in production mode
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// In-Memory Fallback Store (active if MySQL is unavailable)
let mockData = {
  users: [
    { id: 99, name: 'Super Mega Admin', email: 'supermegaadmin@barangay.gov', role: 'super_mega_admin', status: 'Active', barangay: 'All (City-Wide)', phone: '09179998877', password_hash: '123', last_login: 'Never' },
    { id: 1, name: 'Super Admin Rodrigo Lim', email: 'superadmin@barangay.gov', role: 'superadmin', status: 'Active', barangay: 'Pianing', phone: '09171112233', password_hash: '123', last_login: 'Never' },
    { id: 2, name: 'Barangay Admin Juan Dela Cruz', email: 'admin@barangay.gov', role: 'admin', status: 'Active', barangay: 'Pianing', phone: '09171234567', password_hash: '123', last_login: 'Never' },
    { id: 3, name: 'BHW Maria Santos', email: 'bhw@barangay.gov', role: 'bhw', status: 'Active', barangay: 'Pianing', phone: '09181234567', password_hash: '123', last_login: 'Never' },
    { id: 4, name: 'Staff Ana Reyes', email: 'staff@barangay.gov', role: 'staff', status: 'Active', barangay: 'Pianing', phone: '09191234567', password_hash: '123', last_login: 'Never' },
    { id: 5, name: 'Nurse Ligaya Santos', email: 'nurse@barangay.gov', role: 'nurse', status: 'Active', barangay: 'Pianing', phone: '09201234567', password_hash: '123', last_login: 'Never' },
    { id: 6, name: 'Resident Juan Dela Cruz', email: 'resident@gmail.com', role: 'resident', status: 'Active', barangay: 'Pianing', phone: '09211234567', verification_status: 'Verified', password_hash: '123', last_login: 'Never' }
  ],

  residents: [],
  documents: [],
  maternal: [
    { id: 1, mother_name: 'Elena Ramos-Santos', patient_name: 'Elena Ramos-Santos', contact_number: '09171234567', age: 28, barangay: 'Pianing', gravida: 2, para: 1, lmp: '2026-01-10', edd: '2026-10-17', aog_weeks: '24', bp: '118/76', weight: '56.4', temp: '36.5', fetal_heart_rate: '148', fundic_height: '22', next_visit: '2026-09-18', next_visit_date: '2026-09-18', notes: 'Routine 2nd Trimester Check-up', prescribed_meds: 'FeSO4 60mg + Folic Acid 400mcg', attending_nurse: 'Nurse Maria Santos', last_visit: '2026-08-20', visit_number: 2, risk_level: 'Low', pregnancy_status: 'Prenatal - 2nd Trimester', status: 'Active' },
    { id: 2, mother_name: 'Maricel Bautista', patient_name: 'Maricel Bautista', contact_number: '09189876543', age: 34, barangay: 'Pianing', gravida: 4, para: 3, lmp: '2025-12-15', edd: '2026-09-22', aog_weeks: '36', bp: '135/88', weight: '68.2', temp: '36.6', fetal_heart_rate: '152', fundic_height: '34', next_visit: '2026-09-10', next_visit_date: '2026-09-10', notes: '3rd Trimester Monitoring — High Blood Pressure Check', prescribed_meds: 'Methyldopa 250mg BID, Calcium Carbonate 500mg', attending_nurse: 'Nurse Maria Santos', last_visit: '2026-09-01', visit_number: 4, risk_level: 'Moderate', pregnancy_status: 'Prenatal - 3rd Trimester', status: 'Active' }
  ],
  immunizations: [
    { id: 1, child_name: 'Baby Liam Kenneth Diaz', parent_phone: '09151234567', contact_number: '09151234567', age_months: '6', gender: 'Male', guardian_name: 'Maria Diaz', barangay: 'Pianing', weight_kg: '7.8', height_cm: '66', vaccine_name: 'Pentavalent (DPT-HepB-Hib)', dose_number: 2, batch_lot: 'LOT-2026-X9', date_administered: '2026-08-15', date_given: '2026-08-15', due_date: '2026-09-15', next_due_date: '2026-09-15', remarks: 'Tolerated well, no adverse reactions', administered_by: 'Nurse Maria Santos', status: 'Completed' },
    { id: 2, child_name: 'Baby Sofia Grace Reyes', parent_phone: '09281234567', contact_number: '09281234567', age_months: '2', gender: 'Female', guardian_name: 'Lyn Reyes', barangay: 'Pianing', weight_kg: '4.5', height_cm: '54', vaccine_name: 'BCG', dose_number: 1, batch_lot: 'LOT-2026-BCG1', date_administered: '2026-07-10', date_given: '2026-07-10', due_date: '2026-08-10', next_due_date: '2026-08-10', remarks: 'Scar forming on left deltoid', administered_by: 'Nurse Maria Santos', status: 'Completed' },
    { id: 3, child_name: 'Baby Ethan Gabriel Tan', parent_phone: '09193334455', contact_number: '09193334455', age_months: '4', gender: 'Male', guardian_name: 'Sarah Tan', barangay: 'Pianing', weight_kg: '6.2', height_cm: '62', vaccine_name: 'Oral Polio Vaccine (OPV)', dose_number: 2, batch_lot: 'LOT-2026-OPV2', date_administered: '2026-08-01', date_given: '2026-08-01', due_date: '2026-09-08', next_due_date: '2026-09-08', remarks: 'Scheduled for 2nd visit dose', administered_by: 'Nurse Maria Santos', status: 'Scheduled' }
  ],
  consultations: [
    { id: 1, patient_name: 'Elena Ramos-Santos', contact_number: '09171234567', phone: '09171234567', age: '28', gender: 'Female', civil_status: 'Married', barangay: 'Pianing', purok: 'Purok 1', program_type: 'Prenatal Care', service_type: 'Prenatal Care', bp: '118/76 mmHg', temp: '36.5 °C', weight: '56.4 kg', heart_rate: '78 bpm', chief_complaint: 'Routine 2nd Trimester follow-up checkup', diagnosis: 'IUP 24 Weeks AOG, Cephalic, Normal vitals', treatment: 'FeSO4 60mg + Folic Acid 400mcg daily', prescribed_meds: 'FeSO4 60mg + Folic Acid 400mcg', attending_nurse: 'Nurse Maria Santos', attending_worker: 'Nurse Maria Santos', consultation_date: '2026-09-04', encounter_date: '2026-09-04', status: 'Completed' },
    { id: 2, patient_name: 'Roberto Manalo', contact_number: '09289876543', phone: '09289876543', age: '58', gender: 'Male', civil_status: 'Married', barangay: 'Pianing', purok: 'Purok 2', program_type: 'General Consultation', service_type: 'General Consultation', bp: '135/85 mmHg', temp: '36.7 °C', weight: '68.0 kg', heart_rate: '82 bpm', chief_complaint: 'Occipital headache and dizziness monitoring', diagnosis: 'Stage 1 Hypertension, well-controlled', treatment: 'Amlodipine 5mg OD, low-sodium dietary advice', prescribed_meds: 'Amlodipine 5mg OD x 30 days', attending_nurse: 'Nurse Maria Santos', attending_worker: 'Nurse Maria Santos', consultation_date: '2026-09-04', encounter_date: '2026-09-04', status: 'Completed' },
    { id: 3, patient_name: 'Angelica Mae Cruz', contact_number: '09165556677', phone: '09165556677', age: '17', gender: 'Female', civil_status: 'Single', barangay: 'Pianing', purok: 'Purok 3', program_type: 'Adolescent Health', service_type: 'Adolescent Health Consultation', bp: '110/70 mmHg', temp: '36.4 °C', weight: '48.0 kg', heart_rate: '74 bpm', chief_complaint: 'Adolescent health wellness & nutritional guidance', diagnosis: 'Healthy adolescent, mild iron deficiency anemia risk', treatment: 'Health counseling on balanced diet and hydration', prescribed_meds: 'Multivitamins with Iron 1 tab OD', attending_nurse: 'Nurse Maria Santos', attending_worker: 'Nurse Maria Santos', consultation_date: '2026-09-03', encounter_date: '2026-09-03', status: 'Completed' },
    { id: 4, patient_name: 'Clarissa Fernandez', contact_number: '09178889900', phone: '09178889900', age: '26', gender: 'Female', civil_status: 'Married', barangay: 'Pianing', purok: 'Purok 4', program_type: 'Family Planning', service_type: 'Family Planning Services', bp: '115/75 mmHg', temp: '36.5 °C', weight: '53.0 kg', heart_rate: '76 bpm', chief_complaint: 'DMPA Injectable 3-month contraceptive refill', diagnosis: 'Family Planning Acceptor — DMPA Depo-Provera', treatment: 'DMPA 150mg IM administered at right deltoid', prescribed_meds: 'DMPA Injectable 150mg/mL vial', attending_nurse: 'Nurse Maria Santos', attending_worker: 'Nurse Maria Santos', consultation_date: '2026-09-02', encounter_date: '2026-09-02', next_visit_date: '2026-12-02', status: 'Completed' },
    { id: 5, patient_name: 'Danilo Villanueva', contact_number: '09224445566', phone: '09224445566', age: '46', gender: 'Male', civil_status: 'Married', barangay: 'Pianing', purok: 'Purok 1', program_type: 'NTP (TB-DOTS)', service_type: 'NTP (National TB-DOTS Program)', bp: '120/80 mmHg', temp: '37.1 °C', weight: '55.0 kg', heart_rate: '80 bpm', chief_complaint: 'Chronic productive cough for 3 weeks with night sweats', diagnosis: 'Presumptive Pulmonary Tuberculosis — Sputum GeneXpert requested', treatment: 'Specimen collected for GeneXpert, TB health protocol counseling', prescribed_meds: 'TB Diagnostic Evaluation / Sputum Specimen', attending_nurse: 'Nurse Maria Santos', attending_worker: 'Nurse Maria Santos', consultation_date: '2026-09-01', encounter_date: '2026-09-01', next_visit_date: '2026-09-08', status: 'Completed' }
  ],
  logs: [
    { id: 1, user_name: 'Super Admin Rodrigo Lim', user_role: 'superadmin', action: 'System Security Audit & Baseline Validation', action_type: 'Security', barangay: 'All (City-Wide)', details: 'Validated active services and role isolation protocols across all 86 barangays.', timestamp: '09/04/2026 08:30 AM' },
    { id: 2, user_name: 'Barangay Captain Juan Dela Cruz', user_role: 'admin', action: 'Approved Resident Registration', action_type: 'Resident', barangay: 'Pianing', details: 'Verified resident account with government ID verification.', timestamp: '09/04/2026 09:15 AM' },
    { id: 3, user_name: 'Barangay Clerk Ana Reyes', user_role: 'staff', action: 'Issued Barangay ID DOC-2026-004', action_type: 'Document', barangay: 'Pianing', details: 'Official photo ID generated and released.', timestamp: '09/04/2026 09:45 AM' },
    { id: 4, user_name: 'Nurse Maria Santos', user_role: 'bhw', action: 'Recorded Infant Immunization (BCG)', action_type: 'Health', barangay: 'Pianing', details: 'Completed BCG dose 1 administration at Pianing Health Center.', timestamp: '09/04/2026 10:00 AM' },
    { id: 5, user_name: 'Super Admin Rodrigo Lim', user_role: 'superadmin', action: 'System Health & Connectivity Check', action_type: 'System', barangay: 'All (City-Wide)', details: 'Live database and SMS gateway operational status checked.', timestamp: '09/04/2026 10:30 AM' }
  ],
  pendingRegistrations: [],
  appointments: [],
  clinicSchedules: [],
  faq: [
    { topic: 'Clearance', keywords: ['clearance', 'requirement', 'document', 'how to request'], response: 'To request a Barangay Clearance, you need a valid Government ID and proof of residency. Unverified resident accounts must be approved by the Barangay Administrator first.' },
    { topic: 'Hours', keywords: ['hours', 'open', 'schedule', 'time', 'health center', 'clinic'], response: 'The Barangay Health Center is open Monday to Friday, from 8:00 AM to 5:00 PM.' },
    { topic: 'Vaccine', keywords: ['vaccine', 'immunization', 'baby', 'infant', 'bcg', 'polio', 'mmr'], response: 'Free infant immunization is available at the Barangay Health Center. Please bring your Mother-Baby Handbook.' },
    { topic: 'Business Permit', keywords: ['business', 'permit', 'store', 'sari-sari'], response: 'Barangay Business Clearance requirements: DTI Registration, Lease/Property agreement, and Owner Valid ID.' }
  ],
  inventory: [
    { id: 1, barangay: 'Pianing', item_name: 'Pentavalent Vaccine (DPT-HepB-Hib)', category: 'Vaccine (EPI)', stock: 45, unit: 'vials', expiry_date: '2026-06-30', status: 'In Stock', updated_at: '2026-09-01' },
    { id: 2, barangay: 'Pianing', item_name: 'PCV 13 (Pneumococcal Conjugate)', category: 'Vaccine (EPI)', stock: 32, unit: 'vials', expiry_date: '2026-09-30', status: 'In Stock', updated_at: '2026-09-01' },
    { id: 3, barangay: 'Pianing', item_name: 'Measles-Rubella (MR) Vaccine', category: 'Vaccine (EPI)', stock: 8, unit: 'vials', expiry_date: '2026-03-15', status: 'Low Stock', updated_at: '2026-09-01' },
    { id: 4, barangay: 'Pianing', item_name: 'BCG Vaccine', category: 'Vaccine (EPI)', stock: 25, unit: 'vials', expiry_date: '2026-08-20', status: 'In Stock', updated_at: '2026-09-01' },
    { id: 5, barangay: 'Pianing', item_name: 'Hepatitis B Vaccine', category: 'Vaccine (EPI)', stock: 30, unit: 'vials', expiry_date: '2026-11-15', status: 'In Stock', updated_at: '2026-09-01' },
    { id: 6, barangay: 'Pianing', item_name: 'Oral Polio Vaccine (OPV)', category: 'Vaccine (EPI)', stock: 40, unit: 'vials', expiry_date: '2026-10-10', status: 'In Stock', updated_at: '2026-09-01' },
    { id: 7, barangay: 'Pianing', item_name: 'Ferrous Sulfate + Folic Acid', category: 'Maternal Vitamin', stock: 1200, unit: 'tablets', expiry_date: '2027-01-01', status: 'In Stock', updated_at: '2026-09-01' },
    { id: 8, barangay: 'Pianing', item_name: 'Calcium Carbonate 500mg', category: 'Maternal Vitamin', stock: 850, unit: 'tablets', expiry_date: '2026-12-31', status: 'In Stock', updated_at: '2026-09-01' },
    { id: 9, barangay: 'Pianing', item_name: 'Amoxicillin 500mg', category: 'Essential Medicine', stock: 500, unit: 'capsules', expiry_date: '2027-04-15', status: 'In Stock', updated_at: '2026-09-01' },
    { id: 10, barangay: 'Pianing', item_name: 'Paracetamol 500mg', category: 'Essential Medicine', stock: 800, unit: 'tablets', expiry_date: '2027-05-30', status: 'In Stock', updated_at: '2026-09-01' },
    { id: 11, barangay: 'Pianing', item_name: 'Cetirizine 10mg', category: 'Essential Medicine', stock: 300, unit: 'tablets', expiry_date: '2026-12-15', status: 'In Stock', updated_at: '2026-09-01' },
    { id: 12, barangay: 'Pianing', item_name: 'Mefenamic Acid 500mg', category: 'Essential Medicine', stock: 250, unit: 'capsules', expiry_date: '2026-11-20', status: 'In Stock', updated_at: '2026-09-01' },
    { id: 13, barangay: 'Pianing', item_name: 'Salbutamol Nebule 2.5mg', category: 'Essential Medicine', stock: 60, unit: 'nebules', expiry_date: '2026-10-01', status: 'In Stock', updated_at: '2026-09-01' },
    { id: 14, barangay: 'Pianing', item_name: 'Oral Rehydration Salts (ORS)', category: 'Essential Medicine', stock: 150, unit: 'sachets', expiry_date: '2027-08-01', status: 'In Stock', updated_at: '2026-09-01' }
  ]
};

// -------------------------------------------------------------
// Database Health & Connectivity Endpoint & Schema Migration
// -------------------------------------------------------------
// Safe column adder compatible with all MySQL and MariaDB versions
async function safeAddColumn(pool, tableName, columnName, columnDef) {
  try {
    const [cols] = await pool.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [tableName, columnName]
    );
    if (!cols || cols.length === 0) {
      await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDef}`);
    }
  } catch (e) {
    // ignore
  }
}

async function safeCreateIndex(pool, tableName, indexName, columns) {
  try {
    const [rows] = await pool.query(
      "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
      [tableName, indexName]
    );
    if (!rows || rows.length === 0) {
      await pool.query(`CREATE INDEX \`${indexName}\` ON \`${tableName}\` (${columns})`);
    }
  } catch (e) {
    // ignore
  }
}

async function migrateDatabase() {
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query("ALTER TABLE users ADD COLUMN rejection_reason TEXT NULL");
    } catch {}
    try {
      await pool.query("ALTER TABLE residents ADD COLUMN rejection_reason TEXT NULL");
    } catch {}
    try {
      await pool.query("ALTER TABLE document_requests DROP FOREIGN KEY document_requests_ibfk_1");
    } catch {}
    try {
      await pool.query("ALTER TABLE document_requests MODIFY COLUMN document_type VARCHAR(100) NOT NULL");
      await pool.query("ALTER TABLE document_requests MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending'");
    } catch {}
    try {
      await pool.query("ALTER TABLE document_requests MODIFY COLUMN resident_id INT NULL DEFAULT 1");
    } catch {}
    try {
      await pool.query("UPDATE users SET phone = '09171234567' WHERE phone LIKE '%@%' OR phone = '' OR phone IS NULL");
    } catch {}

    // Safe column additions and modifications
    try {
      // CRITICAL: ensure role is VARCHAR(50) to allow 'nurse', 'bhw', etc.
      await pool.query("ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'resident'");
      await pool.query("ALTER TABLE users MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Active'");
      await pool.query("ALTER TABLE users MODIFY COLUMN verification_status ENUM('Verified', 'Pending_Review', 'Rejected', 'Unverified', 'Pending') NOT NULL DEFAULT 'Pending_Review'");
      await pool.query("ALTER TABLE residents MODIFY COLUMN verification_status ENUM('Verified', 'Pending_Review', 'Rejected', 'Unverified', 'Pending') NOT NULL DEFAULT 'Pending_Review'");
      await pool.query("ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NOT NULL");
    } catch {}

    // Ensure Super Mega Admin user exists in MySQL
    try {
      const defaultHash = await hashPassword('123');
      const [superMegaRows] = await pool.query(
        "SELECT id FROM users WHERE LOWER(TRIM(email)) = 'supermegaadmin@barangay.gov' LIMIT 1"
      );
      if (superMegaRows.length === 0) {
        await pool.query(
          "INSERT INTO users (name, email, password_hash, role, status, verification_status, barangay, phone, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
          ['Super Mega Admin', 'supermegaadmin@barangay.gov', defaultHash, 'super_mega_admin', 'Active', 'Verified', 'All (City-Wide)', '09179998877']
        );
        console.log('✅ [Seed] Created Super Mega Admin user in MySQL');
      } else {
        await pool.query(
          "UPDATE users SET name = 'Super Mega Admin', role = 'super_mega_admin', password_hash = ?, status = 'Active' WHERE LOWER(TRIM(email)) = 'supermegaadmin@barangay.gov'",
          [defaultHash]
        );
      }
      await pool.query("UPDATE users SET name = 'Super Mega Admin' WHERE role = 'super_mega_admin'");

      // Ensure password for ONLY the specific default SEED demo accounts is set to 123.
      // IMPORTANT: Do NOT use role IN (...) here — that would overwrite custom passwords
      // for newly created superadmins/staff accounts every server restart.
      await pool.query(
        "UPDATE users SET password_hash = ? WHERE LOWER(TRIM(email)) IN ('supermegaadmin@barangay.gov', 'admin@barangay.gov', 'superadmin@barangay.gov', 'juan.admin@barangay.gov', 'staff@barangay.gov', 'bhw@barangay.gov', 'nurse@barangay.gov')",
        [defaultHash]
      );
    } catch (seedErr) {
      console.warn('[Seed Warning] Error seeding super mega admin:', seedErr.message);
    }

    // Repair: if any users have empty role, set to 'staff' as a safe default
    try {
      await pool.query("UPDATE users SET role = 'staff' WHERE role IS NULL OR role = ''");
    } catch {}

    // Document requests columns
    await safeAddColumn(pool, 'document_requests', 'email', "VARCHAR(100) DEFAULT ''");
    await safeAddColumn(pool, 'document_requests', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
    await safeAddColumn(pool, 'document_requests', 'extra_fields', "TEXT NULL");
    await safeAddColumn(pool, 'document_requests', 'processed_by', "VARCHAR(100) NULL");
    await safeAddColumn(pool, 'document_requests', 'processed_at', "DATETIME NULL");

    // Users columns
    await safeAddColumn(pool, 'users', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
    await safeAddColumn(pool, 'users', 'city', "VARCHAR(100) DEFAULT 'Butuan City'");
    await safeAddColumn(pool, 'users', 'phone', "VARCHAR(50) DEFAULT ''");
    await safeAddColumn(pool, 'users', 'address', "VARCHAR(255) DEFAULT ''");
    await safeAddColumn(pool, 'users', 'civil_status', "ENUM('Single', 'Married', 'Widowed', 'Separated') DEFAULT 'Single'");
    await safeAddColumn(pool, 'users', 'last_login', "DATETIME NULL");
    await safeAddColumn(pool, 'users', 'profile_photo', "LONGTEXT NULL");
    await safeAddColumn(pool, 'users', 'employee_id', "VARCHAR(50) DEFAULT NULL");
    await safeAddColumn(pool, 'users', 'job_title', "VARCHAR(100) DEFAULT NULL");
    await safeAddColumn(pool, 'users', 'permissions', "TEXT NULL");

    // Residents columns
    await safeAddColumn(pool, 'residents', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
    await safeAddColumn(pool, 'residents', 'city', "VARCHAR(100) DEFAULT 'Butuan City'");
    await safeAddColumn(pool, 'residents', 'profile_photo', "LONGTEXT NULL");
    await safeAddColumn(pool, 'residents', 'first_name', "VARCHAR(50) NOT NULL DEFAULT ''");
    await safeAddColumn(pool, 'residents', 'middle_name', "VARCHAR(50) DEFAULT ''");
    await safeAddColumn(pool, 'residents', 'last_name', "VARCHAR(50) NOT NULL DEFAULT ''");
    await safeAddColumn(pool, 'residents', 'civil_status', "VARCHAR(50) DEFAULT 'Single'");
    await safeAddColumn(pool, 'residents', 'years_of_residency', "VARCHAR(50) DEFAULT NULL");
    await safeAddColumn(pool, 'residents', 'purok', "VARCHAR(50) DEFAULT '1'");
    await safeAddColumn(pool, 'residents', 'date_of_birth', "DATE NULL");
    await safeAddColumn(pool, 'residents', 'household_number', "VARCHAR(50) DEFAULT NULL");
    await safeAddColumn(pool, 'residents', 'family_name', "VARCHAR(100) DEFAULT NULL");
    await safeAddColumn(pool, 'residents', 'is_head_of_household', "TINYINT(1) DEFAULT 0");
    await safeAddColumn(pool, 'residents', 'relationship_to_head', "VARCHAR(50) DEFAULT 'Member'");
    await safeAddColumn(pool, 'residents', 'employment_status', "VARCHAR(50) DEFAULT 'Employed'");
    await safeAddColumn(pool, 'residents', 'last_profile_update_note', "TEXT NULL");

    // SMS notifications columns
    await safeAddColumn(pool, 'sms_notifications', 'is_read', "TINYINT(1) DEFAULT 0");

    // Messages table schema migration
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sender_name VARCHAR(100) NOT NULL,
          sender_role VARCHAR(50) NOT NULL,
          sender_email VARCHAR(100) DEFAULT '',
          recipient_name VARCHAR(100) DEFAULT '',
          recipient_role VARCHAR(100) DEFAULT 'all',
          recipient_email VARCHAR(100) DEFAULT '',
          barangay VARCHAR(100) DEFAULT 'Pianing',
          message TEXT NOT NULL,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await safeAddColumn(pool, 'messages', 'sender_email', "VARCHAR(100) DEFAULT ''");
      await safeAddColumn(pool, 'messages', 'recipient_name', "VARCHAR(100) DEFAULT ''");
      await safeAddColumn(pool, 'messages', 'recipient_role', "VARCHAR(100) DEFAULT 'all'");
      await safeAddColumn(pool, 'messages', 'recipient_email', "VARCHAR(100) DEFAULT ''");
      await safeAddColumn(pool, 'messages', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
      await safeAddColumn(pool, 'messages', 'sent_at', "DATETIME DEFAULT CURRENT_TIMESTAMP");
      await safeAddColumn(pool, 'messages', 'timestamp', "DATETIME DEFAULT CURRENT_TIMESTAMP");
      await pool.query("ALTER TABLE messages MODIFY COLUMN recipient_role VARCHAR(100) DEFAULT 'all'");
    } catch {}

    // Performance & Concurrency Indexes
    await safeCreateIndex(pool, 'document_requests', 'idx_doc_status', 'status');
    await safeCreateIndex(pool, 'document_requests', 'idx_doc_barangay', 'barangay');
    await safeCreateIndex(pool, 'residents', 'idx_res_purok', 'purok');
    await safeCreateIndex(pool, 'residents', 'idx_res_barangay', 'barangay');
    await safeCreateIndex(pool, 'residents', 'idx_res_email', 'email');
    await safeCreateIndex(pool, 'users', 'idx_users_email', 'email');
    await safeCreateIndex(pool, 'users', 'idx_users_role', 'role');
    await safeCreateIndex(pool, 'messages', 'idx_msg_barangay', 'barangay');
    await safeCreateIndex(pool, 'sms_notifications', 'idx_sms_read', 'is_read');

    // Document & Service Categories schema migration
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS document_categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          department VARCHAR(50) NOT NULL DEFAULT 'Barangay',
          description TEXT NULL,
          status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      const defaultCategories = [
        { name: 'Barangay Clearance', department: 'Barangay', description: 'Employment, bank requirement, loans & government IDs' },
        { name: 'Certificate of Residency', department: 'Barangay', description: 'Proof of bonafide residency for school, utility or bank' },
        { name: 'Certificate of Indigency', department: 'Barangay', description: 'For medical, educational, burial & DSWD financial assistance' },
        { name: 'Good Moral Clearance', department: 'Barangay', description: 'Official character clearance for PRC board exams & school' },
        { name: 'Business Clearance', department: 'Barangay', description: 'Barangay commercial permit for sari-sari stores & businesses' },
        { name: 'Business Retirement Certificate', department: 'Barangay', description: 'Official certification for closure or retirement of business' },
        { name: 'Certificate of Employment', department: 'Barangay', description: 'Barangay employment certificate & first time jobseeker aid' },
        { name: 'Certificate of Land Occupancy', department: 'Barangay', description: 'Proof of actual physical occupancy & lot possession' },
        { name: 'Barangay Activity Permit', department: 'Barangay', description: 'Permit for events, product sampling, promotions & gatherings' },
        { name: 'Medical Certificate', department: 'Health', description: 'Clinical consultation and fitness clearance issued by Barangay Health Center' },
        { name: 'Sanitary Permit Endorsement', department: 'Health', description: 'Barangay sanitation and health inspection endorsement' },
        { name: 'Immunization Record Certificate', department: 'Health', description: 'Official child and maternal immunization certification' },
        { name: 'Health Examination Clearance', department: 'Health', description: 'Standard community health and vitals screening clearance' }
      ];

      for (const cat of defaultCategories) {
        await pool.query(
          "INSERT INTO document_categories (name, department, description, status) VALUES (?, ?, ?, 'Active') ON DUPLICATE KEY UPDATE department = VALUES(department), description = VALUES(description)",
          [cat.name, cat.department, cat.description]
        );
      }

      // Strictly normalize departments to only 'Barangay' and 'Health'
      await pool.query("UPDATE document_categories SET department = 'Health' WHERE department IN ('Health Center', 'Health', 'Medical', 'Clinical')");
      await pool.query("UPDATE document_categories SET department = 'Barangay' WHERE department NOT IN ('Health')");
    } catch (e) {
      console.warn('Category table migration warning:', e.message);
    }

    // Activity / Audit Logs schema migration
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_name VARCHAR(100) NOT NULL,
          user_role VARCHAR(50) NOT NULL,
          action VARCHAR(255) NOT NULL,
          action_type VARCHAR(50) DEFAULT 'General',
          barangay VARCHAR(100) DEFAULT 'Pianing',
          details TEXT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await safeAddColumn(pool, 'activity_logs', 'action_type', "VARCHAR(50) DEFAULT 'General'");
      await safeAddColumn(pool, 'activity_logs', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
      await safeAddColumn(pool, 'activity_logs', 'details', "TEXT NULL");

      // Seed sample activity logs if table is empty
      const [existingLogs] = await pool.query("SELECT COUNT(*) as count FROM activity_logs");
      if (existingLogs && existingLogs[0]?.count === 0) {
        const seedLogs = [
          ['Super Admin Rodrigo Lim', 'superadmin', 'Configured Document Service Categories', 'Category', 'All (City-Wide)', 'Updated active status for Barangay Clearance and Good Moral Clearance'],
          ['Barangay Captain Juan Dela Cruz', 'admin', 'Approved Resident Registration', 'Resident', 'Pianing', 'Verified resident account for Juan Dela Cruz with valid Postal ID'],
          ['Barangay Clerk Ana Reyes', 'staff', 'Completed Barangay ID DOC-004', 'Document', 'Pianing', 'Issued official community ID card for Ana Reyes'],
          ['Nurse Maria Santos', 'bhw', 'Administered BCG Vaccine', 'Health', 'Pianing', 'Administered BCG Dose 1 to Baby Maria Santos at Health Center'],
          ['Super Admin Rodrigo Lim', 'superadmin', 'Created Barangay Administrator Account', 'User', 'Pianing', 'Generated administrative credentials for Captain Juan Dela Cruz'],
          ['Barangay Captain Juan Dela Cruz', 'admin', 'Processed Certificate of Residency DOC-002', 'Document', 'Pianing', 'Validated residency records for Maria Santos (Purok 2)'],
          ['Barangay Clerk Ana Reyes', 'staff', 'Broadcasted Health Alert SMS', 'System', 'Pianing', 'Sent SMS notification regarding upcoming immunization schedule to 45 registered parents'],
          ['Admin Roberto Garcia', 'admin', 'Approved Business Clearance DOC-003', 'Document', 'Anticala', 'Approved commercial permit for Pedro Garcia Sari-Sari Store'],
          ['Super Admin Rodrigo Lim', 'superadmin', 'System Security Audit Completed', 'Security', 'All (City-Wide)', 'Zero security anomalies detected across Pianing & Anticala nodes']
        ];
        for (const log of seedLogs) {
          await pool.query(
            "INSERT INTO activity_logs (user_name, user_role, action, action_type, barangay, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, NOW() - INTERVAL FLOOR(RAND()*72) HOUR)",
            log
          );
        }
      }
    } catch (e) {
      console.warn('Activity logs migration warning:', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // Health Center Appointments Table Migration
    // ─────────────────────────────────────────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS health_appointments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          appointment_code VARCHAR(50) NOT NULL UNIQUE,
          resident_id INT NULL,
          resident_name VARCHAR(100) NOT NULL,
          resident_phone VARCHAR(50) DEFAULT '',
          resident_email VARCHAR(100) DEFAULT '',
          barangay VARCHAR(100) DEFAULT 'Pianing',
          service_type VARCHAR(100) NOT NULL,
          preferred_date DATE NOT NULL,
          preferred_time VARCHAR(100) DEFAULT 'Morning (8:00 AM - 11:30 AM)',
          scheduled_date DATE NULL,
          scheduled_time VARCHAR(100) NULL,
          status ENUM('Pending', 'Approved', 'Completed', 'Cancelled', 'Rescheduled') DEFAULT 'Pending',
          bhw_notes TEXT NULL,
          resident_notes TEXT NULL,
          attending_bhw VARCHAR(100) DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await safeAddColumn(pool, 'health_appointments', 'resident_email', "VARCHAR(100) DEFAULT ''");
      await safeAddColumn(pool, 'health_appointments', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
      await safeAddColumn(pool, 'health_appointments', 'bhw_notes', "TEXT NULL");
      await safeAddColumn(pool, 'health_appointments', 'resident_notes', "TEXT NULL");
      await safeAddColumn(pool, 'health_appointments', 'attending_bhw', "VARCHAR(100) DEFAULT ''");

      const [existingApts] = await pool.query("SELECT COUNT(*) as count FROM health_appointments");
      if (existingApts && existingApts[0]?.count === 0) {
        const seedApts = [
          ['APT-2026-001', 1, 'Juan Dela Cruz', '09171234567', 'resident@gmail.com', 'Pianing', 'Pre-Marriage Counseling (PMC)', '2026-09-02', 'Morning (8:00 AM - 11:30 AM)', '2026-09-02', '09:00 AM', 'Approved', 'Confirmed slot for couple counseling seminar. Please bring Certificate of No Marriage (CENOMAR) and valid IDs.', 'Applying for marriage license at Butuan City Hall.', 'Nurse Maria Santos'],
          ['APT-2026-002', 2, 'Maria Santos', '09182345678', 'maria.santos@gmail.com', 'Pianing', 'Prenatal Check-up', '2026-09-03', 'Morning (8:00 AM - 11:30 AM)', '2026-09-03', '10:00 AM', 'Approved', '3rd Trimester prenatal check-up scheduled.', 'Routine monthly checkup.', 'Nurse Maria Santos'],
          ['APT-2026-003', 5, 'Teresa Ramos', '09215678901', 'teresa.ramos@gmail.com', 'Pianing', 'Child Immunization', '2026-09-04', 'Afternoon (1:00 PM - 4:00 PM)', null, null, 'Pending', '', 'Hepatitis B 2nd dose for infant.', '']
        ];
        for (const apt of seedApts) {
          await pool.query(
            "INSERT INTO health_appointments (appointment_code, resident_id, resident_name, resident_phone, resident_email, barangay, service_type, preferred_date, preferred_time, scheduled_date, scheduled_time, status, bhw_notes, resident_notes, attending_bhw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            apt
          );
        }
      }
    } catch (e) {
      console.warn('Health appointments migration warning:', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // Health Center Clinic Schedules Table Migration (Posted by BHW / Admin)
    // ─────────────────────────────────────────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS clinic_schedules (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(150) NOT NULL,
          service_type VARCHAR(100) NOT NULL,
          day_of_week VARCHAR(100) NOT NULL,
          time_slot VARCHAR(100) NOT NULL,
          location VARCHAR(150) DEFAULT 'Barangay Pianing Health Center',
          slots_available INT DEFAULT 20,
          bhw_in_charge VARCHAR(100) DEFAULT 'Nurse Maria Santos',
          status ENUM('Active', 'Suspended') DEFAULT 'Active',
          barangay VARCHAR(100) DEFAULT 'Pianing',
          created_by VARCHAR(100) DEFAULT 'BHW Maria',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      const [existingSchedules] = await pool.query("SELECT COUNT(*) as count FROM clinic_schedules");
      if (existingSchedules && existingSchedules[0]?.count === 0) {
        const seedSchedules = [
          ['Pre-Marriage Counseling (PMC) Seminar', 'Pre-Marriage Counseling (PMC)', 'Every Wednesday', '8:30 AM - 11:30 AM', 'Barangay Pianing Health Center - Conference Room', 15, 'Nurse Maria Santos & PopCom Officer', 'Active', 'Pianing', 'Nurse Maria Santos'],
          ['Expanded Child Immunization Day', 'Child Immunization', 'Every Thursday', '8:00 AM - 3:00 PM', 'Barangay Health Center - Immunization Ward', 40, 'Nurse Maria Santos', 'Active', 'Pianing', 'Nurse Maria Santos'],
          ['Maternal & Prenatal Care Clinic', 'Prenatal Check-up', 'Every Tuesday & Friday', '9:00 AM - 4:00 PM', 'Barangay Health Center - Maternal Room', 25, 'Midwife Elena Gomez', 'Active', 'Pianing', 'Nurse Maria Santos'],
          ['Family Planning & Responsible Parenthood', 'Family Planning', 'Monday to Friday', '1:00 PM - 4:30 PM', 'Barangay Health Center - Counseling Office', 20, 'Nurse Maria Santos', 'Active', 'Pianing', 'Nurse Maria Santos'],
          ['General Medical & Senior Citizen Check-up', 'General Consultation', 'Every Monday', '8:00 AM - 12:00 PM', 'Barangay Health Center - Consultation Room', 30, 'Municipal Health Officer & BHWs', 'Active', 'Pianing', 'Barangay Captain Juan Dela Cruz']
        ];
        for (const sch of seedSchedules) {
          await pool.query(
            "INSERT INTO clinic_schedules (title, service_type, day_of_week, time_slot, location, slots_available, bhw_in_charge, status, barangay, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            sch
          );
        }
      }
    } catch (e) {
      console.warn('Clinic schedules migration warning:', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // Immunizations & Maternal Records DOH Standard Migration
    // ─────────────────────────────────────────────────────────────
    try {
      await safeAddColumn(pool, 'immunizations', 'gender', "VARCHAR(20) DEFAULT 'Male'");
      await safeAddColumn(pool, 'immunizations', 'guardian_name', "VARCHAR(150) DEFAULT ''");
      await safeAddColumn(pool, 'immunizations', 'age_months', "VARCHAR(20) DEFAULT ''");
      await safeAddColumn(pool, 'immunizations', 'weight_kg', "VARCHAR(20) DEFAULT ''");
      await safeAddColumn(pool, 'immunizations', 'height_cm', "VARCHAR(20) DEFAULT ''");
      await safeAddColumn(pool, 'immunizations', 'batch_lot', "VARCHAR(100) DEFAULT ''");
      await safeAddColumn(pool, 'immunizations', 'remarks', "TEXT NULL");
      await safeAddColumn(pool, 'immunizations', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");

      await safeAddColumn(pool, 'maternal_records', 'contact_number', "VARCHAR(50) DEFAULT ''");
      await safeAddColumn(pool, 'maternal_records', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
      await safeAddColumn(pool, 'maternal_records', 'gravida', "INT DEFAULT 1");
      await safeAddColumn(pool, 'maternal_records', 'para', "INT DEFAULT 0");
      await safeAddColumn(pool, 'maternal_records', 'lmp', "DATE NULL");
      await safeAddColumn(pool, 'maternal_records', 'edd', "DATE NULL");
      await safeAddColumn(pool, 'maternal_records', 'aog_weeks', "VARCHAR(20) DEFAULT ''");
      await safeAddColumn(pool, 'maternal_records', 'bp', "VARCHAR(30) DEFAULT ''");
      await safeAddColumn(pool, 'maternal_records', 'weight', "VARCHAR(20) DEFAULT ''");
      await safeAddColumn(pool, 'maternal_records', 'temp', "VARCHAR(20) DEFAULT ''");
      await safeAddColumn(pool, 'maternal_records', 'fetal_heart_rate', "VARCHAR(20) DEFAULT ''");
      await safeAddColumn(pool, 'maternal_records', 'fundic_height', "VARCHAR(20) DEFAULT ''");
      await safeAddColumn(pool, 'maternal_records', 'prescribed_meds', "TEXT NULL");
      await safeAddColumn(pool, 'maternal_records', 'attending_nurse', "VARCHAR(100) DEFAULT ''");
      await safeAddColumn(pool, 'maternal_records', 'next_visit_date', "DATE NULL");
    } catch (e) {
      console.warn('Immunizations/Maternal columns migration warning:', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // Clinical Encounters & Consultations Table Migration
    // ─────────────────────────────────────────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS clinical_encounters (
          id INT AUTO_INCREMENT PRIMARY KEY,
          patient_name VARCHAR(150) NOT NULL,
          contact_number VARCHAR(50) DEFAULT '',
          age VARCHAR(20) DEFAULT '—',
          gender VARCHAR(20) DEFAULT 'Female',
          civil_status VARCHAR(50) DEFAULT 'Single',
          barangay VARCHAR(100) DEFAULT 'Pianing',
          purok VARCHAR(100) DEFAULT 'Purok 1',
          program_type VARCHAR(100) DEFAULT 'General Consultation',
          bp VARCHAR(30) DEFAULT '120/80',
          temp VARCHAR(20) DEFAULT '36.5',
          weight VARCHAR(20) DEFAULT '',
          height VARCHAR(20) DEFAULT '',
          heart_rate VARCHAR(20) DEFAULT '',
          chief_complaint VARCHAR(255) DEFAULT 'Routine Health Visit',
          diagnosis TEXT NULL,
          treatment TEXT NULL,
          prescribed_meds TEXT NULL,
          attending_worker VARCHAR(100) DEFAULT 'Nurse Maria Santos',
          encounter_date DATE NULL,
          next_visit_date DATE NULL,
          status VARCHAR(50) DEFAULT 'Completed',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query("ALTER TABLE clinical_encounters MODIFY COLUMN program_type VARCHAR(100) DEFAULT 'General Consultation'");

      // Inventory Table for Medicines & Vaccines
      await pool.query(`
        CREATE TABLE IF NOT EXISTS inventory (
          id INT AUTO_INCREMENT PRIMARY KEY,
          barangay VARCHAR(100) NOT NULL DEFAULT 'Pianing',
          item_name VARCHAR(150) NOT NULL,
          category VARCHAR(100) NOT NULL DEFAULT 'Essential Medicine',
          stock INT NOT NULL DEFAULT 0,
          unit VARCHAR(50) NOT NULL DEFAULT 'units',
          expiry_date VARCHAR(50) NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'In Stock',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Seed default inventory items if table is empty
      const [invCount] = await pool.query("SELECT COUNT(*) AS total FROM inventory");
      if (invCount[0]?.total === 0 && mockData.inventory) {
        for (const item of mockData.inventory) {
          await pool.query(
            "INSERT INTO inventory (barangay, item_name, category, stock, unit, expiry_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [item.barangay || 'Pianing', item.item_name, item.category, item.stock, item.unit, item.expiry_date, item.status]
          );
        }
      }
    } catch (e) {
      console.warn('clinical_encounters / inventory migration warning:', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // Barangay Settings Table (per-barangay email/SMS config)
    // ─────────────────────────────────────────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS barangay_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          barangay_name VARCHAR(150) NOT NULL DEFAULT 'My Barangay',
          municipality VARCHAR(150) DEFAULT '',
          province VARCHAR(150) DEFAULT '',
          emailjs_service_id VARCHAR(100) DEFAULT '',
          emailjs_template_id VARCHAR(100) DEFAULT '',
          emailjs_public_key VARCHAR(200) DEFAULT '',
          emailjs_private_key VARCHAR(200) DEFAULT '',
          sms_api_key VARCHAR(300) DEFAULT '',
          sms_sender_name VARCHAR(50) DEFAULT 'BrgySystem',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      const [sc] = await pool.query('SELECT COUNT(*) AS total FROM barangay_settings');
      if (sc[0]?.total === 0) {
        await pool.query(
          'INSERT INTO barangay_settings (barangay_name, municipality, province, emailjs_service_id, emailjs_template_id, emailjs_public_key, emailjs_private_key, sms_api_key, sms_sender_name) VALUES (?,?,?,?,?,?,?,?,?)',
          [
            process.env.VITE_BARANGAY_NAME || 'Barangay Pianing',
            '', '',
            process.env.VITE_EMAILJS_SERVICE_ID || '',
            process.env.VITE_EMAILJS_TEMPLATE_ID || '',
            process.env.VITE_EMAILJS_PUBLIC_KEY || '',
            process.env.VITE_EMAILJS_PRIVATE_KEY || '',
            process.env.SEMAPHORE_API_KEY || '',
            'BrgySystem'
          ]
        );
        console.log('[Settings] Seeded default barangay_settings from .env');
      }
    } catch (e) {
      console.warn('Barangay settings migration warning:', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // Broadcasts, Family Planning, User Notifications
    // ─────────────────────────────────────────────────────────────
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS broadcasts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          severity ENUM('Emergency', 'Advisory', 'Info') NOT NULL DEFAULT 'Info',
          target_barangay VARCHAR(100) NOT NULL DEFAULT 'All',
          target_audience ENUM('All', 'Residents', 'Staff') NOT NULL DEFAULT 'All',
          created_by VARCHAR(100) NOT NULL DEFAULT 'Super Admin',
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS family_planning_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          patient_name VARCHAR(255) NOT NULL,
          contact_number VARCHAR(50) DEFAULT '',
          age VARCHAR(20) DEFAULT '',
          barangay VARCHAR(100) DEFAULT 'Pianing',
          purok VARCHAR(100) DEFAULT 'Purok 1',
          method_chosen VARCHAR(100) NOT NULL,
          client_type ENUM('New Acceptor', 'Current User', 'Method Switch') DEFAULT 'New Acceptor',
          date_given DATE DEFAULT (CURRENT_DATE),
          next_supply_date DATE NOT NULL,
          attending_worker VARCHAR(255) DEFAULT 'Healthcare Worker',
          remarks TEXT DEFAULT NULL,
          status ENUM('Active', 'Completed', 'Archived') DEFAULT 'Active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_notifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          recipient_email VARCHAR(100) NOT NULL,
          type VARCHAR(100) NOT NULL DEFAULT 'System',
          title VARCHAR(255) NOT NULL DEFAULT '',
          message TEXT NOT NULL,
          ref_code VARCHAR(50) DEFAULT NULL,
          is_read TINYINT(1) NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_recipient (recipient_email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch (e) {
      console.warn('Additional tables migration warning:', e.message);
    }
  }
}
setTimeout(migrateDatabase, 1000);

// ─────────────────────────────────────────────────────────────────────────────
// Barangay Settings API Routes (SuperAdmin + SuperMegaAdmin only)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/settings — fetch current barangay settings (strictly isolated per barangay jurisdiction)
app.get('/api/settings', async (req, res) => {
  const pool = getPool();
  const rawBrgy = (req.query.barangay || '').toString().trim();
  const cleanBrgy = rawBrgy.replace(/^Barangay\s+/i, '').trim();

  if (pool && getStatus().connected) {
    try {
      if (cleanBrgy) {
        const [rows] = await pool.query(
          "SELECT * FROM barangay_settings WHERE LOWER(TRIM(REPLACE(barangay_name, 'Barangay ', ''))) = LOWER(TRIM(?)) LIMIT 1",
          [cleanBrgy]
        );
        if (rows && rows.length > 0) return res.json(rows[0]);

        // If specific barangay requested but not in DB yet, return clean isolated blank settings for that barangay
        return res.json({
          barangay_name: cleanBrgy,
          municipality: 'Butuan City',
          province: 'Agusan del Norte',
          emailjs_service_id: '',
          emailjs_template_id: '',
          emailjs_public_key: '',
          emailjs_private_key: '',
          sms_api_key: '',
          sms_sender_name: `Brgy${cleanBrgy.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7)}`
        });
      }

      // No specific barangay requested — default to Pianing row if exists, else blank
      const [rows] = await pool.query("SELECT * FROM barangay_settings WHERE LOWER(TRIM(REPLACE(barangay_name, 'Barangay ', ''))) = 'pianing' LIMIT 1");
      if (rows && rows.length > 0) return res.json(rows[0]);
    } catch (e) {
      console.warn('[Settings GET] DB error:', e.message);
    }
  }

  // Fallback if DB is unavailable
  if (cleanBrgy && cleanBrgy.toLowerCase() !== 'pianing') {
    return res.json({
      barangay_name: cleanBrgy,
      municipality: 'Butuan City',
      province: 'Agusan del Norte',
      emailjs_service_id: '',
      emailjs_template_id: '',
      emailjs_public_key: '',
      emailjs_private_key: '',
      sms_api_key: '',
      sms_sender_name: `Brgy${cleanBrgy.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7)}`
    });
  }

  return res.json({
    barangay_name: cleanBrgy || (process.env.VITE_BARANGAY_NAME || 'Pianing').replace(/^Barangay\s+/i, ''),
    municipality: 'Butuan City',
    province: 'Agusan del Norte',
    emailjs_service_id: process.env.VITE_EMAILJS_SERVICE_ID || '',
    emailjs_template_id: process.env.VITE_EMAILJS_TEMPLATE_ID || '',
    emailjs_public_key: process.env.VITE_EMAILJS_PUBLIC_KEY || '',
    emailjs_private_key: process.env.VITE_EMAILJS_PRIVATE_KEY || '',
    sms_api_key: process.env.SEMAPHORE_API_KEY || '',
    sms_sender_name: 'BrgyPianing'
  });
});

// GET /api/settings/all — fetch all barangay settings (SuperMegaAdmin multi-tenant overview)
app.get('/api/settings/all', async (req, res) => {
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [rows] = await pool.query('SELECT * FROM barangay_settings ORDER BY barangay_name ASC');
      return res.json(rows || []);
    } catch (e) {
      console.warn('[Settings GET all] DB error:', e.message);
    }
  }
  return res.json([]);
});

// POST /api/settings — save barangay settings (strictly scoped by normalized barangay_name)
app.post('/api/settings', async (req, res) => {
  const { barangay_name, municipality, province, emailjs_service_id, emailjs_template_id, emailjs_public_key, emailjs_private_key, sms_api_key, sms_sender_name } = req.body;
  if (!barangay_name || !barangay_name.trim()) {
    return res.status(400).json({ success: false, message: 'Barangay name is required.' });
  }
  const cleanBrgy = barangay_name.trim().replace(/^Barangay\s+/i, '').trim();
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [existing] = await pool.query(
        "SELECT id FROM barangay_settings WHERE LOWER(TRIM(REPLACE(barangay_name, 'Barangay ', ''))) = LOWER(TRIM(?)) LIMIT 1",
        [cleanBrgy]
      );
      const mCity = municipality || 'Butuan City';
      const mProv = province || 'Agusan del Norte';
      const mSender = sms_sender_name || `Brgy${cleanBrgy.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7)}`;

      if (existing && existing.length > 0) {
        await pool.query(
          'UPDATE barangay_settings SET barangay_name=?, municipality=?, province=?, emailjs_service_id=?, emailjs_template_id=?, emailjs_public_key=?, emailjs_private_key=?, sms_api_key=?, sms_sender_name=?, updated_at=NOW() WHERE id=?',
          [cleanBrgy, mCity, mProv, emailjs_service_id||'', emailjs_template_id||'', emailjs_public_key||'', emailjs_private_key||'', sms_api_key||'', mSender, existing[0].id]
        );
      } else {
        await pool.query(
          'INSERT INTO barangay_settings (barangay_name, municipality, province, emailjs_service_id, emailjs_template_id, emailjs_public_key, emailjs_private_key, sms_api_key, sms_sender_name) VALUES (?,?,?,?,?,?,?,?,?)',
          [cleanBrgy, mCity, mProv, emailjs_service_id||'', emailjs_template_id||'', emailjs_public_key||'', emailjs_private_key||'', sms_api_key||'', mSender]
        );
      }
      return res.json({ success: true, message: `Settings for Barangay ${cleanBrgy} saved successfully.` });
    } catch (e) {
      console.error('[Settings POST] DB error:', e.message);
      return res.status(500).json({ success: false, message: 'Failed to save settings.' });
    }
  }
  return res.status(503).json({ success: false, message: 'Database not connected.' });
});

// POST /api/settings/test-email — send a live test email using saved credentials
app.post('/api/settings/test-email', async (req, res) => {
  const { to, barangay_name, emailjs_service_id, emailjs_template_id, emailjs_public_key, emailjs_private_key } = req.body;
  if (!to || !emailjs_service_id || !emailjs_template_id || !emailjs_public_key) {
    return res.status(400).json({ success: false, message: 'Missing required EmailJS credentials or recipient email.' });
  }
  try {
    const payload = {
      service_id: emailjs_service_id,
      template_id: emailjs_template_id,
      user_id: emailjs_public_key,
      template_params: {
        to_email: to, email: to,
        to_name: 'Admin',
        name: barangay_name || 'Barangay',
        title: 'Test Notification — Settings Verified',
        message: `This is a test email from ${barangay_name || 'your Barangay System'}. Your email notification settings are working correctly.`,
        time: new Date().toLocaleString('en-PH'),
        barangay_name: barangay_name || 'Barangay',
        from_name: `${barangay_name || 'Barangay'} Administration`
      }
    };
    if (emailjs_private_key) payload.accessToken = emailjs_private_key;
    const ejRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await ejRes.text();
    if (ejRes.ok) return res.json({ success: true, message: `Test email sent to ${to}.` });
    return res.status(400).json({ success: false, message: `EmailJS error: ${text}` });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/settings/test-sms — send a live test SMS using saved Semaphore credentials
app.post('/api/settings/test-sms', async (req, res) => {
  const { phone, barangay_name, sms_api_key, sms_sender_name } = req.body;
  if (!phone || !sms_api_key) {
    return res.status(400).json({ success: false, message: 'Missing phone number or SMS API key.' });
  }
  try {
    const params = new URLSearchParams({
      apikey: sms_api_key,
      number: phone,
      message: `[${barangay_name || 'Barangay System'}] SMS notification settings are working correctly. This is a test message.`,
      sendername: sms_sender_name || 'BrgySystem'
    });
    const smsRes = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const data = await smsRes.json();
    if (smsRes.ok) return res.json({ success: true, message: `Test SMS sent to ${phone}.` });
    return res.status(400).json({ success: false, message: JSON.stringify(data) });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Document & Service Category Management Endpoints (Two Departments: Barangay & Health)
const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Barangay Clearance', department: 'Barangay', description: 'Employment, bank requirement, loans & government IDs', status: 'Active' },
  { id: 2, name: 'Certificate of Residency', department: 'Barangay', description: 'Proof of bonafide residency for school, utility or bank', status: 'Active' },
  { id: 3, name: 'Certificate of Indigency', department: 'Barangay', description: 'For medical, educational, burial & DSWD financial assistance', status: 'Active' },
  { id: 4, name: 'Good Moral Clearance', department: 'Barangay', description: 'Official character clearance for PRC board exams & school', status: 'Active' },
  { id: 5, name: 'Business Clearance', department: 'Barangay', description: 'Barangay commercial permit for sari-sari stores & businesses', status: 'Active' },
  { id: 6, name: 'Business Retirement Certificate', department: 'Barangay', description: 'Official certification for closure or retirement of business', status: 'Active' },
  { id: 7, name: 'Certificate of Employment', department: 'Barangay', description: 'Barangay employment certificate & first time jobseeker aid', status: 'Active' },
  { id: 8, name: 'Certificate of Land Occupancy', department: 'Barangay', description: 'Proof of actual physical occupancy & lot possession', status: 'Active' },
  { id: 9, name: 'Barangay Activity Permit', department: 'Barangay', description: 'Permit for events, product sampling, promotions & gatherings', status: 'Active' },
  { id: 10, name: 'Medical Certificate', department: 'Health', description: 'Clinical consultation and fitness clearance issued by Barangay Health Center', status: 'Active' },
  { id: 11, name: 'Sanitary Permit Endorsement', department: 'Health', description: 'Barangay sanitation and health inspection endorsement', status: 'Active' },
  { id: 12, name: 'Immunization Record Certificate', department: 'Health', description: 'Official child and maternal immunization certification', status: 'Active' },
  { id: 13, name: 'Health Examination Clearance', department: 'Health', description: 'Standard community health and vitals screening clearance', status: 'Active' }
];
let inMemoryCategories = [...DEFAULT_CATEGORIES];

app.get('/api/categories', async (req, res) => {
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [rows] = await pool.query("SELECT * FROM document_categories ORDER BY department ASC, id ASC");
      if (rows && rows.length > 0) return res.json(rows);
    } catch (err) {
      console.warn('MySQL categories fetch error:', err.message);
    }
  }
  return res.json(inMemoryCategories);
});

app.post('/api/categories', async (req, res) => {
  const { name, department, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required.' });
  }

  const cleanName = name.trim();
  const cleanDept = (department || 'Barangay').trim();
  const cleanDesc = (description || '').trim();

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [existing] = await pool.query("SELECT id FROM document_categories WHERE LOWER(name) = LOWER(?)", [cleanName]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: `Category '${cleanName}' already exists.` });
      }
      const [result] = await pool.query(
        "INSERT INTO document_categories (name, department, description, status) VALUES (?, ?, ?, 'Active')",
        [cleanName, cleanDept, cleanDesc]
      );
      await logActivity({
        user_name: 'Super Admin',
        user_role: 'superadmin',
        action: `Created Category: ${cleanName}`,
        action_type: 'Category',
        barangay: 'All (City-Wide)',
        details: `Super Administrator added new document category: ${cleanName}`
      });
      return res.status(201).json({ success: true, id: result.insertId, name: cleanName, department: cleanDept, description: cleanDesc, status: 'Active' });
    } catch (err) {
      console.warn('MySQL create category error:', err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  const exists = inMemoryCategories.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
  if (exists) {
    return res.status(409).json({ success: false, message: `Category '${cleanName}' already exists.` });
  }
  const newCat = { id: Date.now(), name: cleanName, department: cleanDept, description: cleanDesc, status: 'Active' };
  inMemoryCategories.push(newCat);
  return res.status(201).json({ success: true, ...newCat });
});

app.put('/api/categories/:name', async (req, res) => {
  const { name } = req.params;
  const { status } = req.body;
  const cleanStatus = status === 'Inactive' ? 'Inactive' : 'Active';

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query(
        "UPDATE document_categories SET status = ? WHERE LOWER(name) = LOWER(?)",
        [cleanStatus, name]
      );
      return res.json({ success: true, message: `Category '${name}' is now ${cleanStatus}.` });
    } catch (err) {
      console.warn('MySQL category status update error:', err.message);
    }
  }

  const cat = inMemoryCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (cat) {
    cat.status = cleanStatus;
  }
  return res.json({ success: true, message: `Category '${name}' is now ${cleanStatus}.` });
});

app.delete('/api/categories/:name', async (req, res) => {
  const { name } = req.params;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query("DELETE FROM document_categories WHERE LOWER(name) = LOWER(?)", [name]);
      await logActivity({
        user_name: 'Super Admin',
        user_role: 'superadmin',
        action: `Deleted Category: ${name}`,
        action_type: 'Category',
        barangay: 'All (City-Wide)',
        details: `Super Administrator removed document category: ${name}`
      });
      return res.json({ success: true, message: `Category '${name}' removed successfully.` });
    } catch (err) {
      console.warn('MySQL delete category error:', err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  inMemoryCategories = inMemoryCategories.filter(c => c.name.toLowerCase() !== name.toLowerCase());
  return res.json({ success: true, message: `Category '${name}' removed successfully.` });
});

// -------------------------------------------------------------
// Activity Logs & Audit Trail Endpoints & Logging Helper
// -------------------------------------------------------------
async function logActivity(data) {
  if (!data) return;
  const user_name = data.user_name || data.userName || 'System User';
  const user_role = data.user_role || data.userRole || 'staff';
  const action = data.action || 'System Action';
  const action_type = data.action_type || data.actionType || 'General';
  const barangay = data.barangay || 'Pianing';
  const details = data.details || '';

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query(
        "INSERT INTO activity_logs (user_name, user_role, action, action_type, barangay, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, NOW())",
        [user_name, user_role, action, action_type, barangay, details]
      );
      return;
    } catch (err) {
      console.warn('MySQL logActivity error:', err.message);
    }
  }

  // in-memory fallback
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const newLog = {
    id: (mockData.logs && mockData.logs.length > 0 ? Math.max(...mockData.logs.map(l => l.id || 0)) : 0) + 1,
    user_name,
    user_role,
    action,
    action_type,
    barangay,
    details,
    timestamp: `${dateStr} ${timeStr}`
  };
  if (!mockData.logs) mockData.logs = [];
  mockData.logs.unshift(newLog);
}

app.get('/api/activity-logs', async (req, res) => {
  const { barangay, action_type, search, role } = req.query;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let query = "SELECT * FROM activity_logs WHERE 1=1";
      const params = [];
      if (barangay && barangay !== 'All' && barangay !== 'All (City-Wide)') {
        query += " AND (barangay = ? OR barangay = 'All (City-Wide)')";
        params.push(barangay);
      }
      if (action_type && action_type !== 'All') {
        query += " AND action_type = ?";
        params.push(action_type);
      }
      if (role && role !== 'All') {
        query += " AND LOWER(user_role) = LOWER(?)";
        params.push(role);
      }
      if (search) {
        query += " AND (user_name LIKE ? OR action LIKE ? OR details LIKE ?)";
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      query += " ORDER BY id DESC LIMIT 1000";
      const [rows] = await pool.query(query, params);
      return res.json(rows || []);
    } catch (err) {
      console.warn('MySQL fetch activity_logs error:', err.message);
    }
  }

  // in-memory fallback
  let logs = [...mockData.logs];
  if (barangay && barangay !== 'All' && barangay !== 'All (City-Wide)') {
    logs = logs.filter(l => !l.barangay || l.barangay === barangay || l.barangay === 'All (City-Wide)');
  }
  if (action_type && action_type !== 'All') {
    logs = logs.filter(l => l.action_type === action_type);
  }
  if (role && role !== 'All') {
    logs = logs.filter(l => l.user_role?.toLowerCase() === role.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(l =>
      l.user_name?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.details?.toLowerCase().includes(q)
    );
  }
  return res.json(logs);
});

app.post('/api/activity-logs', async (req, res) => {
  const { user_name, user_role, action, action_type, barangay, details } = req.body;
  if (!action) return res.status(400).json({ success: false, message: 'Action description is required' });
  await logActivity({ user_name, user_role, action, action_type, barangay, details });
  return res.json({ success: true, message: 'Activity log recorded successfully' });
});

app.get('/api/db-status', async (req, res) => {
  const connResult = await testConnection();
  if (connResult.connected) await migrateDatabase();
  res.json({
    ...connResult,
    mode: connResult.connected ? 'MySQL Database Connected' : 'In-Memory Engine (Fallback Mode)',
    timestamp: new Date().toISOString()
  });
});

// -------------------------------------------------------------
// Authentication
// -------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  const password = (req.body?.password || '').trim();

  if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });
  if (!password) return res.status(400).json({ success: false, message: 'Password is required.' });

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  // Email alias resolution (clean format vs legacy format)
  const emailAliases = {
    'supermegaadmin@barangay.gov': ['supermegaadmin@barangay.gov'],
    'admin@barangay.gov': ['admin@barangay.gov', 'juan.admin@barangay.gov'],
    'staff@barangay.gov': ['staff@barangay.gov', 'ana.staff@barangay.gov', 'pedro.staff@barangay.gov'],
    'bhw@barangay.gov': ['bhw@barangay.gov', 'maria.bhw@barangay.gov', 'ligaya.bhw@barangay.gov'],
    'resident@gmail.com': ['resident@gmail.com', 'juan.resident@gmail.com'],
    'superadmin@barangay.gov': ['superadmin@barangay.gov'],
    'juan.admin@barangay.gov': ['admin@barangay.gov', 'juan.admin@barangay.gov'],
    'ana.staff@barangay.gov': ['staff@barangay.gov', 'ana.staff@barangay.gov'],
    'maria.bhw@barangay.gov': ['bhw@barangay.gov', 'maria.bhw@barangay.gov'],
    'juan.resident@gmail.com': ['resident@gmail.com', 'juan.resident@gmail.com'],
  };
  const searchEmails = emailAliases[cleanEmail] || [cleanEmail];

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let [rows] = await pool.query(
        'SELECT * FROM users WHERE LOWER(TRIM(email)) IN (?) OR LOWER(TRIM(email)) = ?',
        [searchEmails, cleanEmail]
      );

      // Fallback: If not in users table yet, check if registered in residents table
      if (rows.length === 0) {
        const [resFind] = await pool.query(
          'SELECT * FROM residents WHERE LOWER(TRIM(email)) = ? LIMIT 1',
          [cleanEmail]
        );
        if (resFind.length > 0) {
          const r = resFind[0];
          const newHashed = await hashPassword(cleanPass || '123');
          await pool.query(
            "INSERT INTO users (name, email, password_hash, role, status, verification_status, barangay, phone, last_login) VALUES (?, ?, ?, 'resident', 'Active', ?, ?, ?, NOW())",
            [`${r.first_name} ${r.last_name}`, cleanEmail, newHashed, r.verification_status || 'Verified', r.barangay || 'Pianing', r.phone || '']
          );
          const [newRows] = await pool.query('SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1', [cleanEmail]);
          rows = newRows;
        }
      }

      // Fallback 2: If not in users or residents, check mockData predefined users
      if (rows.length === 0) {
        const mockUser = mockData.users.find(u => searchEmails.includes(u.email.toLowerCase()));
        if (mockUser) {
          const newHashed = await hashPassword('123');
          await pool.query(
            "INSERT INTO users (name, email, password_hash, role, status, verification_status, barangay, phone, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
            [mockUser.name, mockUser.email, newHashed, mockUser.role, mockUser.status || 'Active', 'Verified', mockUser.barangay || 'All (City-Wide)', mockUser.phone || '09179998877']
          );
          const [newRows] = await pool.query('SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1', [cleanEmail]);
          rows = newRows;
        }
      }

      if (rows.length > 0) {
        const user = rows[0];
        let isMatch = await verifyPassword(cleanPass, user.password_hash);
        // Master password override: 123, 123456, Admin123!, Password123!
        if (!isMatch && (cleanPass === '123' || cleanPass === '123456' || cleanPass === 'Admin123!' || cleanPass === 'Password123!')) {
          isMatch = true;
        }
        if (!isMatch) {
          return res.status(401).json({ success: false, message: 'Invalid password. Please check your credentials.' });
        }

        // Auto-upgrade legacy plain-text password to bcrypt hash
        if (user.password_hash && !user.password_hash.startsWith('$2a$') && !user.password_hash.startsWith('$2b$') && !user.password_hash.startsWith('$2y$')) {
          try {
            const newHash = await hashPassword(cleanPass);
            await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, user.id]);
          } catch {}
        }

        // Check if account is deactivated or archived
        if (user.status === 'Inactive') {
          return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact the Barangay Administrator.' });
        }
        if (user.status === 'Archived') {
          return res.status(403).json({ success: false, message: 'Your account has been archived. Please contact the Barangay Administrator.' });
        }

        await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

        // Fetch phone, address, date_of_birth, age, civil_status, and live verification_status from residents table
        const [resRows] = await pool.query(
          'SELECT * FROM residents WHERE LOWER(email) = LOWER(?) OR CONCAT(LOWER(first_name), " ", LOWER(last_name)) = LOWER(?) LIMIT 1',
          [user.email, user.name || '']
        );
        if (resRows.length > 0) {
          user.phone = resRows[0].phone || '';
          user.address = resRows[0].address || '';
          user.purok = resRows[0].purok || '';
          if (!user.purok && (user.address || resRows[0].address)) {
            const pMatch = (user.address || resRows[0].address || '').match(/purok\s*([0-9A-Za-z]+)/i);
            if (pMatch) user.purok = pMatch[1];
          }
          if (!user.city && (user.address || resRows[0].address)) {
            const addr = user.address || resRows[0].address || '';
            const parts = addr.split(',').map(s => s.trim());
            if (parts.length >= 3) {
              user.city = parts[parts.length - 1];
            }
          }
          user.first_name = resRows[0].first_name || '';
          user.middle_name = resRows[0].middle_name || '';
          user.last_name = resRows[0].last_name || '';
          
          let cleanDob = '';
          if (resRows[0].date_of_birth) {
            try {
              const d = new Date(resRows[0].date_of_birth);
              if (!isNaN(d.getTime())) {
                const yr = d.getFullYear();
                const mo = String(d.getMonth() + 1).padStart(2, '0');
                const da = String(d.getDate()).padStart(2, '0');
                cleanDob = `${yr}-${mo}-${da}`;
              }
            } catch {}
          }
          user.date_of_birth = cleanDob;
          user.civil_status = resRows[0].civil_status || 'Single';
          user.gender = resRows[0].gender || 'Male';
          user.age = cleanDob ? Math.floor((Date.now() - new Date(cleanDob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : '';
          user.years_of_residency = resRows[0].years_of_residency || '';
          // Strictly respect the live database status from residents table
          if (resRows[0].verification_status) {
            user.verification_status = resRows[0].verification_status;
          }
        }
        // Never expose password hash to client
        delete user.password_hash;
        if (user.permissions && typeof user.permissions === 'string') {
          try { user.permissions = JSON.parse(user.permissions); } catch {}
        }
        logActivity({
          user_name: user.name || user.email,
          user_role: user.role || 'resident',
          action: `User Logged In (${(user.role || 'user').toUpperCase()})`,
          action_type: 'Auth',
          barangay: user.barangay || 'Pianing',
          details: `User ${user.email} successfully logged into the system.`
        }).catch(() => {});
        return res.json({ success: true, user, message: 'Authentication successful' });
      } else {
        return res.status(401).json({ success: false, message: 'No account found with that email address.' });
      }
    } catch (err) {
      console.warn('MySQL auth query error:', err.message);
    }
  }

  const user = mockData.users.find(u => searchEmails.includes(u.email.toLowerCase()));
  if (user) {
    let isMatch = await verifyPassword(password, user.password_hash || '123');
    // Master password override: 123 for demo accounts
    if (!isMatch && (cleanPass === '123' || cleanPass === '123456' || cleanPass === 'Admin123!' || cleanPass === 'Password123!')) {
      isMatch = true;
    }
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password. Please check your credentials.' });
    }
    user.last_login = new Date().toLocaleString();
    // Merge phone and purok from mockData residents
    const res_rec = mockData.residents.find(r => r.email && r.email.toLowerCase() === user.email.toLowerCase());
    if (res_rec) {
      user.phone = res_rec.phone || '';
      user.address = res_rec.address || '';
      user.purok = res_rec.purok || '';
      if (!user.purok && (user.address || res_rec.address)) {
        const pMatch = (user.address || res_rec.address || '').match(/purok\s*([0-9A-Za-z]+)/i);
        if (pMatch) user.purok = pMatch[1];
      }
      if (!user.city && (user.address || res_rec.address)) {
        const addr = user.address || res_rec.address || '';
        const parts = addr.split(',').map(s => s.trim());
        if (parts.length >= 3) {
          user.city = parts[parts.length - 1];
        }
      }
    }
    const safeUser = { ...user };
    delete safeUser.password_hash;
    logActivity({
      user_name: user.name || user.email,
      user_role: user.role || 'resident',
      action: `User Logged In (${(user.role || 'user').toUpperCase()})`,
      action_type: 'Auth',
      barangay: user.barangay || 'Pianing',
      details: `User ${user.email} logged into the system.`
    }).catch(() => {});
    return res.json({ success: true, user: safeUser, message: 'Login successful' });
  }

  return res.status(401).json({ success: false, message: 'No account found with that email address.' });
});

// Resident Account Registration
app.post('/api/auth/register', async (req, res) => {
  const { name, first_name, middle_name, last_name, date_of_birth, gender, civil_status, email, password, role, address, phone, submitted_id, years_of_residency, employment_status } = req.body;
  
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const firstName = toTitleCase(first_name || (name ? name.trim().split(' ')[0] : '') || 'Resident');
  const lastName = toTitleCase(last_name || (name ? name.trim().split(' ').slice(1).join(' ') : '') || 'Resident');
  const middleName = toTitleCase(middle_name || '');
  const fullName = toTitleCase(name || `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim());
  const dob = date_of_birth || '2000-01-01';
  const userGender = toTitleCase(gender || 'Male');
  const userCivilStatus = toTitleCase(civil_status || 'Single');
  const userEmployment = toTitleCase(employment_status || req.body.employment || 'Employed');

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ success: false, message: 'First name, last name, and email are required.' });
  }

  if (role === 'resident' || !role) {
    if (!submitted_id || !String(submitted_id).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Valid Government ID photo is strictly required to register. Residents cannot proceed without uploading a valid ID.'
      });
    }
  }

  if (password) {
    const passCheck = validatePasswordComplexity(password);
    if (!passCheck.isValid) {
      return res.status(400).json({ success: false, message: passCheck.message });
    }
  }

  const cleanEmail = email.trim().toLowerCase();
  const rawPassword = password || 'Admin123!';
  const hashedPassword = await hashPassword(rawPassword);
  const userRole = role || 'resident';
  
  // DYNAMIC LOCATION ROUTING: Read resident's selected barangay (defaults to Pianing)
  const userBarangay = normalizeBarangayName(req.body.barangay || 'Pianing');
  const userCity = (req.body.city || 'Butuan City').trim();
  const rawPurok = (req.body.purok || '').toString().trim();
  const cleanPurokNum = rawPurok.replace(/purok\s*/i, '').trim();
  const formattedPurok = cleanPurokNum ? `Purok ${cleanPurokNum}` : (rawPurok || 'Purok 1');

  let residentAddress = address || `${formattedPurok}, Barangay ${userBarangay}, ${userCity}`;
  if (!residentAddress.toLowerCase().includes(userBarangay.toLowerCase())) {
    residentAddress = `${residentAddress.split(',')[0].trim()}, Barangay ${userBarangay}, ${userCity}`;
  }

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      // 1 GMAIL PER ACCOUNT: Check if email is already registered in users table
      const [existingUsers] = await pool.query(
        "SELECT id, email, role, verification_status FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1",
        [cleanEmail]
      );
      if (existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'This email address is already registered. Each resident must use a unique Gmail address. Please sign in or use a different email.'
        });
      }

      // 2. CIVIC TRIAD DE-DUPLICATION & AUTO-MERGING:
      // Match by First Name + Last Name + Date of Birth + Barangay (tolerant of any casing/spelling of Pianing)
      const [matchedResidents] = await pool.query(
        `SELECT id, first_name, last_name, date_of_birth, barangay, email, phone, verification_status, linked_user_id 
         FROM residents 
         WHERE LOWER(TRIM(first_name)) = LOWER(TRIM(?)) 
           AND LOWER(TRIM(last_name)) = LOWER(TRIM(?)) 
           AND date_of_birth = ? 
           AND (
             LOWER(TRIM(barangay)) = LOWER(TRIM(?))
             OR LOWER(REPLACE(REPLACE(TRIM(barangay), 'barangay ', ''), 'brgy. ', '')) = LOWER(?)
             OR LOWER(TRIM(barangay)) LIKE CONCAT('%', LOWER(?), '%')
           ) 
         LIMIT 1`,
        [firstName, lastName, dob, userBarangay, userBarangay, userBarangay]
      );

      let residentIdToUse;
      let isClaimedExisting = false;

      if (matchedResidents.length > 0) {
        const existingRec = matchedResidents[0];
        // If this record is already claimed by a verified user with a different email, protect against duplicate accounts:
        if (existingRec.linked_user_id) {
          const [claimedUser] = await pool.query("SELECT id, email FROM users WHERE id = ? LIMIT 1", [existingRec.linked_user_id]);
          if (claimedUser.length > 0 && claimedUser[0].email.toLowerCase() !== cleanEmail) {
            return res.status(409).json({
              success: false,
              message: `A verified resident profile already exists under the name ${fullName} (${dob}) in Barangay ${userBarangay}. To prevent duplicate resident profiles, please contact the Barangay Office directly with your physical ID.`
            });
          }
        }

        // Case: Existing offline / census record found! AUTO-MERGE & LINK:
        residentIdToUse = existingRec.id;
        isClaimedExisting = true;

        // Create the user login account
        const [userResult] = await pool.query(
          "INSERT INTO users (name, email, password_hash, role, status, verification_status, barangay, phone, address, last_login) VALUES (?, ?, ?, ?, 'Active', 'Pending_Review', ?, ?, ?, NOW())",
          [fullName, cleanEmail, hashedPassword, userRole, userBarangay, phone || '', residentAddress]
        );
        const newUserId = userResult.insertId;

        // Update existing resident record with new email, phone, ID photo, employment_status, and linked_user_id
        await pool.query(
          "UPDATE residents SET email = ?, phone = ?, submitted_id = ?, id_type = ?, employment_status = ?, verification_status = 'Pending_Review', submitted_at = NOW(), claimed_at = NOW(), linked_user_id = ?, rejection_reason = NULL WHERE id = ?",
          [cleanEmail, phone || existingRec.phone || '', submitted_id, req.body.id_type || 'Government ID', userEmployment, newUserId, residentIdToUse]
        );

        if (years_of_residency) {
          try {
            await pool.query("UPDATE residents SET years_of_residency = ? WHERE id = ?", [years_of_residency.trim(), residentIdToUse]);
          } catch {}
        }

        // Log audit event
        logActivity({
          user_name: fullName,
          user_role: 'resident',
          action: 'Claimed Census Profile & Registered Account',
          action_type: 'Registration',
          barangay: userBarangay,
          details: `Resident online account ${cleanEmail} claimed existing census record #${residentIdToUse} in Barangay ${userBarangay}`
        }).catch(() => {});

        sendRegistrationEmail({
          to: cleanEmail,
          fullName,
          role: userRole
        }).catch(e => console.warn('[Email] Registration email error:', e.message));

        return res.status(201).json({
          success: true,
          is_claimed: true,
          user: { id: residentIdToUse, name: fullName, first_name: firstName, middle_name: middleName, last_name: lastName, date_of_birth: dob, gender: userGender, civil_status: userCivilStatus, employment_status: userEmployment, email: cleanEmail, role: userRole, verification_status: 'Pending_Review', submitted_id, phone, address: residentAddress, city: userCity, purok: existingRec.purok || cleanPurokNum || '1', barangay: userBarangay, years_of_residency: years_of_residency || '' },
          message: 'Existing resident profile linked successfully! Your submitted ID is under review by the Barangay Admin.'
        });
      }

      // Case: No existing resident found. Create brand new user & resident record
      const [userResult] = await pool.query(
        "INSERT INTO users (name, email, password_hash, role, status, verification_status, barangay, phone, address, last_login) VALUES (?, ?, ?, ?, 'Active', 'Pending_Review', ?, ?, ?, NOW())",
        [fullName, cleanEmail, hashedPassword, userRole, userBarangay, phone || '', residentAddress]
      );
      const newUserId = userResult.insertId;

      const [resResult] = await pool.query(
        "INSERT INTO residents (first_name, middle_name, last_name, date_of_birth, gender, civil_status, employment_status, address, purok, barangay, phone, email, verification_status, submitted_id, id_type, submitted_at, linked_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending_Review', ?, ?, NOW(), ?)",
        [firstName, middleName, lastName, dob, userGender, userCivilStatus, userEmployment, residentAddress, cleanPurokNum || '1', userBarangay, phone || '', cleanEmail, submitted_id, req.body.id_type || 'Government ID', newUserId]
      );
      residentIdToUse = resResult.insertId;

      if (years_of_residency && residentIdToUse) {
        try {
          await pool.query("UPDATE residents SET years_of_residency = ? WHERE id = ?", [years_of_residency.trim(), residentIdToUse]);
        } catch {}
      }

      sendRegistrationEmail({
        to: cleanEmail,
        fullName,
        role: userRole
      }).catch(e => console.warn('[Email] Registration email error:', e.message));

      logActivity({
        user_name: fullName,
        user_role: 'resident',
        action: 'New Resident Account Registered',
        action_type: 'Registration',
        barangay: userBarangay,
        details: `Created new resident account for ${cleanEmail} in Barangay ${userBarangay}. Status: Pending_Review.`
      }).catch(() => {});

      return res.status(201).json({
        success: true,
        is_claimed: false,
        user: { id: residentIdToUse, name: fullName, first_name: firstName, middle_name: middleName, last_name: lastName, date_of_birth: dob, gender: userGender, civil_status: userCivilStatus, employment_status: userEmployment, email: cleanEmail, role: userRole, verification_status: 'Pending_Review', submitted_id, phone, address: residentAddress, city: userCity, purok: cleanPurokNum || '1', barangay: userBarangay, years_of_residency: years_of_residency || '' },
        message: 'Account created! Your submitted ID is under review by the Barangay Admin.'
      });
    } catch (err) {
      console.warn('MySQL register error:', err.message);
    }
  }

  // Fallback: check unique in mockData
  const existsInMock = mockData.users.some(u => u.email && u.email.toLowerCase() === cleanEmail);
  if (existsInMock) {
    return res.status(409).json({
      success: false,
      message: 'This email address is already registered. Each resident must use a unique Gmail address.'
    });
  }

  // Civic Triad lookup in mockData
  const matchedMock = mockData.residents.find(r => 
    r.first_name && r.first_name.toLowerCase().trim() === firstName.toLowerCase().trim() &&
    r.last_name && r.last_name.toLowerCase().trim() === lastName.toLowerCase().trim() &&
    r.date_of_birth === dob &&
    r.barangay && r.barangay.toLowerCase().trim() === userBarangay.toLowerCase().trim()
  );

  if (matchedMock) {
    if (matchedMock.linked_user_id) {
      return res.status(409).json({
        success: false,
        message: `A verified resident profile already exists under the name ${fullName} (${dob}) in Barangay ${userBarangay}. To prevent duplicate resident profiles, please contact the Barangay Office directly with your physical ID.`
      });
    }
    const newUserId = Date.now();
    matchedMock.email = cleanEmail;
    matchedMock.phone = phone || matchedMock.phone;
    matchedMock.submitted_id = submitted_id;
    matchedMock.employment_status = userEmployment;
    matchedMock.verification_status = 'Pending_Review';
    matchedMock.linked_user_id = newUserId;
    mockData.users.push({
      id: newUserId,
      name: fullName,
      email: cleanEmail,
      password_hash: hashedPassword,
      role: userRole,
      status: 'Active',
      barangay: userBarangay,
      address: residentAddress,
      city: userCity,
      verification_status: 'Pending_Review',
      last_login: new Date().toLocaleString()
    });

    logActivity({
      user_name: fullName,
      user_role: 'resident',
      action: 'Claimed Census Profile & Registered Account',
      action_type: 'Registration',
      barangay: userBarangay,
      details: `Resident online account ${cleanEmail} claimed existing census record #${matchedMock.id} in Barangay ${userBarangay}`
    }).catch(() => {});

    sendRegistrationEmail({
      to: cleanEmail,
      fullName,
      role: userRole
    }).catch(e => console.warn('[Email] Registration email error:', e.message));

    return res.status(201).json({
      success: true,
      is_claimed: true,
      user: { id: matchedMock.id, name: fullName, first_name: firstName, middle_name: middleName, last_name: lastName, date_of_birth: dob, gender: userGender, civil_status: userCivilStatus, employment_status: userEmployment, email: cleanEmail, role: userRole, verification_status: 'Pending_Review', submitted_id, phone, address: residentAddress, city: userCity, purok: matchedMock.purok || cleanPurokNum || '1', barangay: userBarangay },
      message: 'Existing resident profile linked successfully! Your submitted ID is under review by the Barangay Admin.'
    });
  }

  const newPending = {
    id: Date.now(),
    name: fullName,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    date_of_birth: dob,
    gender: userGender,
    civil_status: userCivilStatus,
    employment_status: userEmployment,
    email: email.toLowerCase(),
    phone: phone || '',
    address: residentAddress,
    purok: cleanPurokNum || '1',
    barangay: userBarangay,
    submitted_id: submitted_id || null,
    submitted_at: new Date().toLocaleString(),
    verification_status: 'Pending_Review'
  };
  mockData.pendingRegistrations.unshift(newPending);
  mockData.users.push({
    id: newPending.id,
    name: fullName,
    email: email.toLowerCase(),
    password_hash: hashedPassword,
    role: userRole,
    status: 'Active',
    barangay: userBarangay,
    address: residentAddress,
    city: userCity,
    verification_status: 'Pending_Review',
    last_login: new Date().toLocaleString()
  });
  mockData.residents.unshift({
    id: newPending.id,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    date_of_birth: dob,
    gender: userGender,
    civil_status: userCivilStatus,
    employment_status: userEmployment,
    address: residentAddress,
    purok: cleanPurokNum || '1',
    barangay: userBarangay,
    phone: phone || '',
    email: email.toLowerCase(),
    verification_status: 'Pending_Review',
    submitted_id: submitted_id || null
  });

  logActivity({
    user_name: fullName,
    user_role: 'resident',
    action: 'New Resident Account Registered',
    action_type: 'Registration',
    barangay: userBarangay,
    details: `Created new resident account for ${cleanEmail} in Barangay ${userBarangay}. Status: Pending_Review.`
  }).catch(() => {});

  sendRegistrationEmail({
    to: cleanEmail,
    fullName,
    role: userRole
  }).catch(e => console.warn('[Email] Registration email error:', e.message));

  res.status(201).json({
    success: true,
    user: { id: newPending.id, name: fullName, first_name: firstName, middle_name: middleName, last_name: lastName, date_of_birth: dob, gender: userGender, civil_status: userCivilStatus, employment_status: userEmployment, email, role: userRole, verification_status: 'Pending_Review', submitted_id, phone, address: residentAddress, city: userCity, purok: cleanPurokNum || '1', barangay: userBarangay },
    message: 'Account created! Your submitted ID is under review by the Barangay Admin.'
  });

});

// Check live verification status for resident
app.get('/api/auth/check-status', async (req, res) => {
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.json({ verification_status: 'Pending_Review' });
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [rows] = await pool.query(
        "SELECT id, CONCAT(first_name, ' ', last_name) AS name, first_name, middle_name, last_name, date_of_birth, TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) as age, civil_status, gender, email, phone, address, purok, barangay, verification_status, rejection_reason, submitted_id FROM residents WHERE LOWER(email) = LOWER(?) LIMIT 1",
        [email]
      );
      if (rows.length > 0) {
        const r = rows[0];
        if (!r.purok && r.address) {
          const pMatch = r.address.match(/purok\s*([0-9A-Za-z]+)/i);
          if (pMatch) r.purok = pMatch[1];
        }
        if (r.date_of_birth) {
          try {
            const d = new Date(r.date_of_birth);
            if (!isNaN(d.getTime())) {
              const yr = d.getFullYear();
              const mo = String(d.getMonth() + 1).padStart(2, '0');
              const da = String(d.getDate()).padStart(2, '0');
              r.date_of_birth = `${yr}-${mo}-${da}`;
            }
          } catch {}
        }
        return res.json(r);
      }
      const [uRows] = await pool.query(
        "SELECT id, name, email, phone, barangay, verification_status, rejection_reason FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
        [email]
      );
      if (uRows.length > 0) {
        return res.json(uRows[0]);
      }
    } catch (err) {
      console.warn('check-status error:', err.message);
    }
  }
  const pending = mockData.pendingRegistrations.find(r => r.email && r.email.toLowerCase() === email);
  if (pending) return res.json(pending);
  const u = mockData.users.find(u => u.email && u.email.toLowerCase() === email);
  if (u) return res.json(u);
  res.json({ verification_status: 'Pending_Review' });
});

// GET pending resident registrations (for Admin approval)
app.get('/api/residents/pending', async (req, res) => {
  const { barangay } = req.query;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let query = `
        SELECT 
          COALESCE(r.id, u.id) AS id,
          COALESCE(CONCAT(r.first_name, ' ', r.last_name), u.name) AS name,
          r.first_name,
          r.middle_name,
          r.last_name,
          r.date_of_birth,
          COALESCE(r.email, u.email) AS email,
          COALESCE(r.phone, u.phone) AS phone,
          COALESCE(r.address, CONCAT('Barangay ', COALESCE(u.barangay, 'Pianing'))) AS address,
          COALESCE(r.barangay, u.barangay, 'Pianing') AS barangay,
          r.submitted_id,
          COALESCE(r.submitted_at, u.created_at) AS submitted_at,
          COALESCE(r.verification_status, u.verification_status, 'Pending_Review') AS verification_status,
          COALESCE(r.rejection_reason, u.rejection_reason) AS rejection_reason
        FROM users u
        LEFT JOIN residents r ON LOWER(u.email) = LOWER(r.email)
        WHERE (u.role = 'resident' OR r.id IS NOT NULL)
          AND u.status != 'Archived'
          AND (
            LOWER(COALESCE(r.verification_status, u.verification_status, '')) NOT IN ('verified')
            OR COALESCE(r.verification_status, u.verification_status) IS NULL
          )
      `;
      const params = [];
      if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
        // Strict barangay match — only fall back to address when barangay column is empty
        query += ` AND (
          (COALESCE(r.barangay, u.barangay, '') != '' AND LOWER(COALESCE(r.barangay, u.barangay, '')) = LOWER(?))
          OR
          (COALESCE(r.barangay, u.barangay, '') = '' AND LOWER(COALESCE(r.address, '')) LIKE LOWER(?))
        )`;
        params.push(barangay.trim(), `%${barangay.trim()}%`);
      }
      query += ` ORDER BY u.id DESC`;
      const [rows] = await pool.query(query, params);
      return res.json(rows);
    } catch (err) {
      console.warn('MySQL pending residents error:', err.message);
    }
  }
  let pending = mockData.pendingRegistrations.filter(r => r.verification_status !== 'Verified');
  if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
    pending = pending.filter(r => (r.barangay || r.address || '').toLowerCase().includes(barangay.toLowerCase()));
  }
  res.json(pending);
});

// Resubmit verification details & updated ID
app.put('/api/residents/resubmit', async (req, res) => {
  const { id, email, submitted_id, first_name, middle_name, last_name, address, phone } = req.body;
  if (!email && !id) {
    return res.status(400).json({ success: false, message: 'Resident email or ID is required.' });
  }

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const updates = [
        "verification_status = 'Pending_Review'",
        "rejection_reason = NULL"
      ];
      const params = [];
      if (submitted_id) { updates.push("submitted_id = ?"); params.push(submitted_id); }
      if (first_name) { updates.push("first_name = ?"); params.push(first_name); }
      if (middle_name !== undefined) { updates.push("middle_name = ?"); params.push(middle_name); }
      if (last_name) { updates.push("last_name = ?"); params.push(last_name); }
      if (address) { updates.push("address = ?"); params.push(address); }
      if (phone) { updates.push("phone = ?"); params.push(phone); }

      let clause = "id = ?";
      let clauseParam = id;
      if (!id && email) {
        clause = "LOWER(email) = LOWER(?)";
        clauseParam = email.trim();
      }
      params.push(clauseParam);

      await pool.query(`UPDATE residents SET ${updates.join(', ')} WHERE ${clause}`, params);

      // Also update users table verification_status
      if (email) {
        await pool.query("UPDATE users SET verification_status = 'Pending_Review', rejection_reason = NULL WHERE LOWER(email) = LOWER(?)", [email.trim()]);
      } else if (id) {
        const [rRows] = await pool.query("SELECT email FROM residents WHERE id = ?", [id]);
        if (rRows[0]?.email) {
          await pool.query("UPDATE users SET verification_status = 'Pending_Review', rejection_reason = NULL WHERE LOWER(email) = LOWER(?)", [rRows[0].email]);
        }
      }

      return res.json({
        success: true,
        message: 'Your verification details have been resubmitted successfully! The Barangay Admin will review your updated ID.'
      });
    } catch (err) {
      console.warn('MySQL resubmit error:', err.message);
    }
  }

  // Mock data fallback
  const pending = mockData.pendingRegistrations.find(r => (id && String(r.id) === String(id)) || (email && r.email.toLowerCase() === email.toLowerCase()));
  if (pending) {
    pending.verification_status = 'Pending_Review';
    pending.rejection_reason = null;
    if (submitted_id) pending.submitted_id = submitted_id;
    if (address) pending.address = address;
    if (phone) pending.phone = phone;
  }
  const u = mockData.users.find(u => (id && u.id === id) || (email && u.email.toLowerCase() === email.toLowerCase()));
  if (u) {
    u.verification_status = 'Pending_Review';
    u.rejection_reason = null;
  }
  res.json({
    success: true,
    message: 'Your verification details have been resubmitted successfully! The Barangay Admin will review your updated ID.'
  });
});

// Approve resident registration
app.put('/api/residents/:id/approve', async (req, res) => {
  const { id } = req.params;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let targetEmail = null;
      let targetName = 'Resident';
      let targetPhone = '09171234567';
      let targetBarangay = 'Antongalon';

      // Check residents table first
      const [rRows] = await pool.query("SELECT first_name, last_name, email, phone, barangay FROM residents WHERE id = ?", [id]);
      if (rRows.length > 0) {
        targetEmail = rRows[0].email;
        targetName = `${rRows[0].first_name} ${rRows[0].last_name}`.trim();
        targetPhone = rRows[0].phone || targetPhone;
        targetBarangay = rRows[0].barangay || targetBarangay;
        await pool.query("UPDATE residents SET verification_status = 'Verified', rejection_reason = NULL WHERE id = ?", [id]);
      } else {
        // Fallback check users table
        const [uRows] = await pool.query("SELECT name, email, phone, barangay FROM users WHERE id = ?", [id]);
        if (uRows.length > 0) {
          targetEmail = uRows[0].email;
          targetName = uRows[0].name;
          targetPhone = uRows[0].phone || targetPhone;
          targetBarangay = uRows[0].barangay || targetBarangay;
        }
      }

      if (targetEmail) {
        await pool.query("UPDATE users SET verification_status = 'Verified', rejection_reason = NULL WHERE LOWER(email) = LOWER(?)", [targetEmail]);
        await pool.query("UPDATE residents SET verification_status = 'Verified', rejection_reason = NULL WHERE LOWER(email) = LOWER(?)", [targetEmail]);

        // If not in residents table, insert so records sync
        const [checkRes] = await pool.query("SELECT id FROM residents WHERE LOWER(email) = LOWER(?)", [targetEmail]);
        if (checkRes.length === 0) {
          const nameParts = targetName.split(' ');
          const fName = nameParts[0] || targetName;
          const lName = nameParts.slice(1).join(' ') || 'Resident';
          try {
            await pool.query(
              "INSERT INTO residents (first_name, last_name, email, phone, address, barangay, verification_status) VALUES (?, ?, ?, ?, ?, ?, 'Verified')",
              [fName, lName, targetEmail.toLowerCase(), targetPhone, `Barangay ${targetBarangay}`, targetBarangay]
            );
          } catch {}
        }
      }

      // Auto-dispatch SMS notification via iProg Gateway
      try {
        const smsMsg = `Welcome ${targetName}! Your Barangay resident account application has been VERIFIED. You can now request clearances, business permits, and health services online.`;
        await pool.query(
          "INSERT INTO sms_notifications (recipient_name, recipient_phone, type, message, status) VALUES (?, ?, 'Account Verified', ?, 'Sent')",
          [targetName, targetPhone, smsMsg]
        );
        sendLiveSms(targetPhone, smsMsg).catch(e => console.warn('iProg SMS error:', e.message));
      } catch (smsErr) {
        console.warn('Auto SMS dispatch warning:', smsErr.message);
      }

      // Auto-dispatch matching Email notification
      if (targetEmail && targetEmail.includes('@')) {
        sendVerificationNoticeEmail({
          to: targetEmail,
          fullName: targetName,
          status: 'Verified',
          barangay: targetBarangay
        }).catch(e => console.warn('[Email] Verification approval error:', e.message));
      }

      return res.json({ success: true, message: 'Resident account approved and verified successfully.' });
    } catch (err) {
      console.warn('MySQL approve error:', err.message);
    }
  }
  // Fallback: update in mockData
  const idx = mockData.pendingRegistrations.findIndex(r => String(r.id) === String(id));
  if (idx !== -1) {
    mockData.pendingRegistrations[idx].verification_status = 'Verified';
    mockData.pendingRegistrations[idx].rejection_reason = null;
    const email = mockData.pendingRegistrations[idx].email;
    const u = mockData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (u) {
      u.verification_status = 'Verified';
      u.rejection_reason = null;
    }
    if (email) {
      sendVerificationNoticeEmail({
        to: email,
        fullName: mockData.pendingRegistrations[idx].first_name + ' ' + mockData.pendingRegistrations[idx].last_name,
        status: 'Verified',
      }).catch(() => {});
    }
  }
  const rIdx = mockData.residents.findIndex(r => String(r.id) === String(id));
  if (rIdx !== -1) {
    mockData.residents[rIdx].verification_status = 'Verified';
    mockData.residents[rIdx].rejection_reason = null;
  }
  res.json({ success: true, message: 'Resident account approved and verified successfully.' });
});

// Unverify resident registration (Set to Unverified or Pending_Review without deleting)
app.put('/api/residents/:id/unverify', async (req, res) => {
  const { id } = req.params;
  const { status = 'Unverified', reason } = req.body || {};
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let targetEmail = null;
      const [rRows] = await pool.query("SELECT email FROM residents WHERE id = ?", [id]);
      if (rRows.length > 0) {
        targetEmail = rRows[0].email;
        await pool.query("UPDATE residents SET verification_status = ?, rejection_reason = ? WHERE id = ?", [status, reason || null, id]);
      } else {
        const [uRows] = await pool.query("SELECT email FROM users WHERE id = ?", [id]);
        if (uRows.length > 0) targetEmail = uRows[0].email;
      }
      if (targetEmail) {
        await pool.query("UPDATE users SET verification_status = ?, rejection_reason = ? WHERE LOWER(email) = LOWER(?)", [status, reason || null, targetEmail]);
        await pool.query("UPDATE residents SET verification_status = ?, rejection_reason = ? WHERE LOWER(email) = LOWER(?)", [status, reason || null, targetEmail]);
      }
      return res.json({ success: true, message: `Resident verification status set to ${status}.` });
    } catch (err) {
      console.warn('MySQL unverify error:', err.message);
    }
  }
  const r = mockData.residents.find(r => String(r.id) === String(id));
  if (r) {
    r.verification_status = status;
    r.rejection_reason = reason || null;
    const u = mockData.users.find(u => u.email.toLowerCase() === (r.email || '').toLowerCase());
    if (u) {
      u.verification_status = status;
      u.rejection_reason = reason || null;
    }
  }
  res.json({ success: true, message: `Resident verification status set to ${status}.` });
});

// Reject / Request Correction for resident registration (Wrong ID / Correction needed)
app.put('/api/residents/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { reason, remarks } = req.body || {};
  const rejectionCause = reason || remarks || 'Submitted Government ID or registration details require correction.';
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let targetEmail = null;
      let targetPhone = null;
      let residentName = 'Resident';

      const [rows] = await pool.query("SELECT email, first_name, last_name, phone FROM residents WHERE id = ?", [id]);
      if (rows.length > 0) {
        targetEmail = rows[0].email;
        targetPhone = rows[0].phone;
        residentName = `${rows[0].first_name} ${rows[0].last_name}`.trim();
        await pool.query("UPDATE residents SET verification_status = 'Rejected', rejection_reason = ? WHERE id = ?", [rejectionCause, id]);
      } else {
        const [uRows] = await pool.query("SELECT name, email, phone FROM users WHERE id = ?", [id]);
        if (uRows.length > 0) {
          targetEmail = uRows[0].email;
          targetPhone = uRows[0].phone;
          residentName = uRows[0].name;
        }
      }

      if (targetEmail) {
        await pool.query("UPDATE users SET verification_status = 'Rejected', rejection_reason = ? WHERE LOWER(email) = LOWER(?)", [rejectionCause, targetEmail]);
        await pool.query("UPDATE residents SET verification_status = 'Rejected', rejection_reason = ? WHERE LOWER(email) = LOWER(?)", [rejectionCause, targetEmail]);
      }

      // Send SMS notice to resident explaining the correction required
      if (targetPhone) {
        try {
          const smsMsg = `Barangay Notice for ${residentName}: Your verification requires correction: "${rejectionCause}". Please log in to your resident portal to resubmit a clear ID photo.`;
          sendLiveSms(targetPhone, smsMsg).catch(e => console.warn('iProg SMS rejection notice error:', e.message));
          await pool.query(
            "INSERT INTO sms_notifications (recipient_name, recipient_phone, type, message, status) VALUES (?, ?, 'ID Correction Notice', ?, 'Sent')",
            [residentName, targetPhone, smsMsg]
          );
        } catch {}
      }

      // Send matching Email notice to resident with exact cause & fix steps
      if (targetEmail && targetEmail.includes('@')) {
        sendVerificationNoticeEmail({
          to: targetEmail,
          fullName: residentName,
          status: 'Rejected',
          reason: rejectionCause
        }).catch(e => console.warn('[Email] Verification rejection email error:', e.message));
      }

      return res.json({ success: true, message: 'Notice sent to resident. The resident can now resubmit a corrected ID on their portal.' });
    } catch (err) {
      console.warn('MySQL reject error:', err.message);
    }
  }
  const idx = mockData.pendingRegistrations.findIndex(r => String(r.id) === String(id));
  if (idx !== -1) {
    mockData.pendingRegistrations[idx].verification_status = 'Rejected';
    mockData.pendingRegistrations[idx].rejection_reason = rejectionCause;
    const email = mockData.pendingRegistrations[idx].email;
    const u = mockData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (u) {
      u.verification_status = 'Rejected';
      u.rejection_reason = rejectionCause;
    }
    if (email) {
      sendVerificationNoticeEmail({
        to: email,
        fullName: mockData.pendingRegistrations[idx].first_name + ' ' + mockData.pendingRegistrations[idx].last_name,
        status: 'Rejected',
        reason: rejectionCause
      }).catch(() => {});
    }
  }
  const rIdx = mockData.residents.findIndex(r => String(r.id) === String(id));
  if (rIdx !== -1) {
    mockData.residents[rIdx].verification_status = 'Rejected';
    mockData.residents[rIdx].rejection_reason = rejectionCause;
  }
  res.json({ success: true, message: 'Notice sent to resident. The resident can now resubmit a corrected ID on their portal.' });
});

// Admin Delete / Purge Fake Account
app.delete('/api/residents/:id/purge', async (req, res) => {
  const { id } = req.params;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let targetEmail = null;
      const [rows] = await pool.query("SELECT email FROM residents WHERE id = ?", [id]);
      if (rows.length > 0) {
        targetEmail = rows[0].email;
        await pool.query("DELETE FROM residents WHERE id = ?", [id]);
      } else {
        const [uRows] = await pool.query("SELECT email FROM users WHERE id = ?", [id]);
        if (uRows.length > 0) {
          targetEmail = uRows[0].email;
        }
      }

      if (targetEmail) {
        await pool.query("DELETE FROM users WHERE LOWER(email) = LOWER(?)", [targetEmail]);
        await pool.query("DELETE FROM residents WHERE LOWER(email) = LOWER(?)", [targetEmail]);
      } else {
        await pool.query("DELETE FROM users WHERE id = ?", [id]);
      }

      return res.json({ success: true, message: 'Registration record permanently purged.' });
    } catch (err) {
      console.warn('MySQL purge error:', err.message);
    }
  }
  mockData.pendingRegistrations = mockData.pendingRegistrations.filter(r => String(r.id) !== String(id));
  mockData.residents = mockData.residents.filter(r => String(r.id) !== String(id));
  res.json({ success: true, message: 'Registration record permanently purged.' });
});

// Update resident details (email, phone, verification_status, household_number, purok, etc.)
app.put('/api/residents/:id', async (req, res) => {
  const { id } = req.params;
  const { email, phone, verification_status, household_number, purok, civil_status, gender, date_of_birth, address } = req.body;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const updates = [];
      const params = [];
      if (email !== undefined) { updates.push('email = ?'); params.push(email); }
      if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
      if (verification_status !== undefined) { updates.push('verification_status = ?'); params.push(verification_status); }
      if (household_number !== undefined) { updates.push('household_number = ?'); params.push(household_number); }
      if (purok !== undefined) { updates.push('purok = ?'); params.push(purok); }
      if (civil_status !== undefined) { updates.push('civil_status = ?'); params.push(civil_status); }
      if (gender !== undefined) { updates.push('gender = ?'); params.push(gender); }
      if (date_of_birth !== undefined) { updates.push('date_of_birth = ?'); params.push(date_of_birth); }
      if (address !== undefined) { updates.push('address = ?'); params.push(address); }

      if (updates.length > 0) {
        params.push(id);
        await pool.query(`UPDATE residents SET ${updates.join(', ')} WHERE id = ?`, params);
      }
      return res.json({ success: true, message: 'Resident updated successfully.' });
    } catch (err) {
      console.warn('MySQL update resident error:', err.message);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  const r = (mockData.residents || []).find(x => String(x.id) === String(id));
  if (r) {
    Object.assign(r, req.body);
  }
  res.json({ success: true, message: 'Resident updated successfully.' });
});

// PUT /api/users/profile - Profile Settings (name, phone, photo, password, address, civil_status, purok)
app.put('/api/users/profile', async (req, res) => {
  const { id, email, new_email, newEmail, password, phone, address, name, first_name, middle_name, last_name, date_of_birth, gender, civil_status, submitted_id, profile_photo, purok } = req.body;
  const fullName = name || (first_name ? `${first_name} ${middle_name ? middle_name + ' ' : ''}${last_name || ''}`.trim() : undefined);
  const cleanCurrentEmail = (email || '').trim().toLowerCase();
  const cleanNewEmail = (new_email || newEmail || '').trim().toLowerCase();
  const isEmailChange = Boolean(cleanNewEmail && cleanNewEmail !== cleanCurrentEmail);

  if (isEmailChange) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanNewEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address format.' });
    }
  }

  if (password) {
    const passCheck = validatePasswordComplexity(password);
    if (!passCheck.isValid) {
      return res.status(400).json({ success: false, message: passCheck.message });
    }
  }

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      // Accurately resolve target user and resident IDs
      let targetUserId = 0;
      let targetResidentId = 0;

      if (cleanCurrentEmail) {
        const [uRows] = await pool.query("SELECT id FROM users WHERE LOWER(email) = ?", [cleanCurrentEmail]);
        if (uRows.length > 0) targetUserId = uRows[0].id;

        const [rRows] = await pool.query("SELECT id, linked_user_id FROM residents WHERE LOWER(email) = ?", [cleanCurrentEmail]);
        if (rRows.length > 0) {
          targetResidentId = rRows[0].id;
          if (!targetUserId && rRows[0].linked_user_id) targetUserId = rRows[0].linked_user_id;
        }
      }

      if (!targetUserId && id) {
        const [rRows] = await pool.query("SELECT linked_user_id FROM residents WHERE id = ?", [id]);
        if (rRows.length > 0 && rRows[0].linked_user_id) {
          targetUserId = rRows[0].linked_user_id;
          targetResidentId = id;
        } else {
          const [uRows] = await pool.query("SELECT id FROM users WHERE id = ?", [id]);
          if (uRows.length > 0) targetUserId = uRows[0].id;
        }
      }

      if (!targetResidentId && id) {
        const [rRows] = await pool.query("SELECT id FROM residents WHERE id = ? OR linked_user_id = ?", [id, targetUserId || id]);
        if (rRows.length > 0) targetResidentId = rRows[0].id;
      }

      let curRes = null;
      let curUser = null;
      if (cleanCurrentEmail) {
        const [cr] = await pool.query("SELECT * FROM residents WHERE LOWER(email) = ? LIMIT 1", [cleanCurrentEmail]);
        if (cr && cr.length > 0) curRes = cr[0];
        const [cu] = await pool.query("SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1", [cleanCurrentEmail]);
        if (cu && cu.length > 0) curUser = cu[0];
      }
      if (!curRes && targetResidentId) {
        const [cr] = await pool.query("SELECT * FROM residents WHERE id = ? LIMIT 1", [targetResidentId]);
        if (cr && cr.length > 0) curRes = cr[0];
      }
      if (!curUser && targetUserId) {
        const [cu] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [targetUserId]);
        if (cu && cu.length > 0) curUser = cu[0];
      }

      // Compute field-level diff for admin and resident audit
      const changedFields = [];
      if (isEmailChange) {
        changedFields.push(`Email (${cleanCurrentEmail} -> ${cleanNewEmail})`);
      }
      if (phone && curRes?.phone && phone !== curRes.phone) {
        changedFields.push(`Phone (${curRes.phone} -> ${phone})`);
      } else if (phone && !curRes?.phone) {
        changedFields.push(`Phone (${phone})`);
      }
      if (purok && curRes?.purok && String(purok).replace(/purok\s*/i, '') !== String(curRes.purok).replace(/purok\s*/i, '')) {
        changedFields.push(`Purok (${curRes.purok} -> ${purok})`);
      }
      if (civil_status && curRes?.civil_status && civil_status !== curRes.civil_status) {
        changedFields.push(`Civil Status (${curRes.civil_status} -> ${civil_status})`);
      }
      if (address && curRes?.address && address !== curRes.address) {
        changedFields.push(`Address (${address})`);
      }
      if (date_of_birth && curRes?.date_of_birth && date_of_birth !== String(curRes.date_of_birth).split('T')[0]) {
        changedFields.push(`Birth Date (${date_of_birth})`);
      }

      const diffSummary = changedFields.length > 0 ? changedFields.join(', ') : 'Personal details updated.';
      const updateNote = `Updated on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${diffSummary}`;

      if (isEmailChange) {
        const [dupUsers] = await pool.query(
          "SELECT id FROM users WHERE LOWER(email) = ? AND id != ?",
          [cleanNewEmail, targetUserId || 0]
        );
        if (dupUsers.length > 0) {
          return res.status(400).json({ success: false, message: 'This email address is already registered to another account.' });
        }
        const [dupResidents] = await pool.query(
          "SELECT id FROM residents WHERE LOWER(email) = ? AND id != ?",
          [cleanNewEmail, targetResidentId || 0]
        );
        if (dupResidents.length > 0) {
          return res.status(400).json({ success: false, message: 'This email address is already registered to another resident.' });
        }
      }

      if (targetUserId) {
        if (password) {
          const hashedPassword = await hashPassword(password);
          await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [hashedPassword, targetUserId]);
        }
        if (fullName) {
          await pool.query("UPDATE users SET name = ? WHERE id = ?", [fullName, targetUserId]);
        }
        if (phone) {
          await pool.query("UPDATE users SET phone = ? WHERE id = ?", [phone, targetUserId]);
        }
        if (address) {
          await pool.query("UPDATE users SET address = ? WHERE id = ?", [address, targetUserId]);
        }
        if (profile_photo !== undefined) {
          await pool.query("UPDATE users SET profile_photo = ? WHERE id = ?", [profile_photo || null, targetUserId]);
        }
        if (isEmailChange) {
          await pool.query("UPDATE users SET email = ? WHERE id = ?", [cleanNewEmail, targetUserId]);
        }
      }

      if (isEmailChange) {
        // Also cascade email updates across related tables
        if (targetResidentId || targetUserId) {
          await pool.query("UPDATE document_requests SET email = ? WHERE resident_id = ? OR LOWER(email) = ?", [cleanNewEmail, targetResidentId || targetUserId, cleanCurrentEmail]).catch(() => {});
          await pool.query("UPDATE health_appointments SET resident_email = ? WHERE resident_id = ? OR LOWER(resident_email) = ?", [cleanNewEmail, targetResidentId || targetUserId, cleanCurrentEmail]).catch(() => {});
        } else {
          await pool.query("UPDATE document_requests SET email = ? WHERE LOWER(email) = ?", [cleanNewEmail, cleanCurrentEmail]).catch(() => {});
          await pool.query("UPDATE health_appointments SET resident_email = ? WHERE LOWER(resident_email) = ?", [cleanNewEmail, cleanCurrentEmail]).catch(() => {});
        }
        await pool.query("UPDATE clinical_consultations SET patient_email = ? WHERE LOWER(patient_email) = ?", [cleanNewEmail, cleanCurrentEmail]).catch(() => {});
        await pool.query("UPDATE maternal_health_records SET patient_email = ? WHERE LOWER(patient_email) = ?", [cleanNewEmail, cleanCurrentEmail]).catch(() => {});
        await pool.query("UPDATE child_immunization_records SET parent_email = ? WHERE LOWER(parent_email) = ?", [cleanNewEmail, cleanCurrentEmail]).catch(() => {});
      }

      // Update residents table
      const updates = [];
      const params = [];
      if (isEmailChange) { updates.push('email = ?'); params.push(cleanNewEmail); }
      if (first_name) { updates.push('first_name = ?'); params.push(first_name); }
      if (middle_name !== undefined) { updates.push('middle_name = ?'); params.push(middle_name); }
      if (last_name) { updates.push('last_name = ?'); params.push(last_name); }
      if (date_of_birth) { updates.push('date_of_birth = ?'); params.push(date_of_birth); }
      if (gender) { updates.push('gender = ?'); params.push(gender); }
      if (civil_status) { updates.push('civil_status = ?'); params.push(civil_status); }
      if (phone) { updates.push('phone = ?'); params.push(phone); }
      if (purok) { updates.push('purok = ?'); params.push(purok); }
      if (address) { updates.push('address = ?'); params.push(address); }
      if (profile_photo !== undefined) { updates.push('profile_photo = ?'); params.push(profile_photo || null); }
      updates.push('last_profile_update_note = ?');
      params.push(updateNote);

      // Handle submitted_id: only update when explicitly provided in payload
      if ('submitted_id' in req.body) {
        const sidVal = submitted_id === null ? null : submitted_id;
        updates.push('submitted_id = ?');
        params.push(sidVal);
        if (targetUserId) {
          await pool.query("UPDATE users SET verification_status = 'Pending_Review' WHERE id = ?", [targetUserId]);
        }
      }
      if (updates.length > 0 && targetResidentId) {
        params.push(targetResidentId);
        await pool.query(`UPDATE residents SET ${updates.join(', ')} WHERE id = ?`, params);
      } else if (updates.length > 0 && cleanCurrentEmail) {
        params.push(cleanCurrentEmail);
        await pool.query(`UPDATE residents SET ${updates.join(', ')} WHERE LOWER(email) = ?`, params);
      }

      // Log activity
      logActivity({
        user_name: fullName || curUser?.name || 'Resident',
        user_role: curUser?.role || 'resident',
        action: 'Updated Profile Information',
        action_type: 'Resident',
        barangay: curRes?.barangay || curUser?.barangay || 'Pianing',
        details: updateNote
      }).catch(() => {});

      // Insert admin alert into messages
      try {
        await pool.query(
          "INSERT INTO messages (sender_name, sender_role, sender_email, recipient_name, recipient_role, recipient_email, barangay, message, sent_at, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
          [
            fullName || curUser?.name || 'Resident',
            'resident',
            cleanNewEmail || cleanCurrentEmail,
            'Barangay Administrator',
            'admin',
            '',
            curRes?.barangay || curUser?.barangay || 'Pianing',
            `Resident ${fullName || curUser?.name || 'Resident'} updated profile: ${diffSummary}`
          ]
        );
      } catch (mErr) {}

      // Dispatch email notification to resident
      const notifyEmail = cleanNewEmail || cleanCurrentEmail;
      if (notifyEmail && notifyEmail.includes('@')) {
        sendProfileUpdateEmail({
          to: notifyEmail,
          fullName: fullName || curUser?.name || 'Resident',
          changes: diffSummary,
          date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
        }).catch(e => console.warn('Profile email notification error:', e.message));
      }

      return res.json({ 
        success: true, 
        message: isEmailChange ? 'Email and profile settings updated successfully.' : 'Profile settings updated successfully.',
        email: isEmailChange ? cleanNewEmail : (cleanCurrentEmail || undefined),
        profile_photo: profile_photo || null,
        date_of_birth,
        gender,
        civil_status,
        purok,
        address,
        age: date_of_birth ? Math.floor((Date.now() - new Date(date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : undefined
      });
    } catch (err) {
      console.warn('MySQL update profile error:', err.message);
    }
  }

  // Mock data fallback
  const diffSummary = isEmailChange ? `Email changed to ${cleanNewEmail}` : 'Profile information updated.';
  const updateNote = `Updated on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${diffSummary}`;

  if (isEmailChange) {
    const dup = mockData.users.some(u => u.id !== id && u.email.toLowerCase() === cleanNewEmail);
    if (dup) {
      return res.status(400).json({ success: false, message: 'This email address is already in use by another account.' });
    }
  }
  const user = mockData.users.find(u => (id && u.id === id) || (email && u.email.toLowerCase() === cleanCurrentEmail));
  if (user) {
    if (isEmailChange) user.email = cleanNewEmail;
    if (password) user.password_hash = password;
    if (fullName) user.name = fullName;
    if (phone) user.phone = phone;
    if (purok) user.purok = purok;
    if (address) user.address = address;
    if (gender) user.gender = gender;
    if (civil_status) user.civil_status = civil_status;
    if (date_of_birth) user.date_of_birth = date_of_birth;
    if ('submitted_id' in req.body) user.submitted_id = submitted_id;
    if (profile_photo !== undefined) user.profile_photo = profile_photo || null;
  }
  const resident = mockData.residents.find(r => (id && r.id === id) || (email && r.email.toLowerCase() === cleanCurrentEmail));
  if (resident) {
    if (isEmailChange) resident.email = cleanNewEmail;
    if (first_name) resident.first_name = first_name;
    if (middle_name !== undefined) resident.middle_name = middle_name;
    if (last_name) resident.last_name = last_name;
    if (date_of_birth) resident.date_of_birth = date_of_birth;
    resident.last_profile_update_note = updateNote;
    if (gender) resident.gender = gender;
    if (civil_status) resident.civil_status = civil_status;
    if (phone) resident.phone = phone;
    if (purok) resident.purok = purok;
    if (address) resident.address = address;
    if ('submitted_id' in req.body) resident.submitted_id = submitted_id;
    if (profile_photo !== undefined) resident.profile_photo = profile_photo || null;
  }

  const notifyEmail = isEmailChange ? cleanNewEmail : cleanCurrentEmail;
  if (notifyEmail && notifyEmail.includes('@')) {
    sendProfileUpdateEmail({
      to: notifyEmail,
      fullName: fullName || user?.name || 'Resident',
      changes: diffSummary,
      date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
    }).catch(e => console.warn('Profile email notification error:', e.message));
  }
  if (isEmailChange && mockData.document_requests) {
    mockData.document_requests.forEach(d => {
      if (d.resident_id === id || (d.email && d.email.toLowerCase() === cleanCurrentEmail)) {
        d.email = cleanNewEmail;
      }
    });
  }
  res.json({ 
    success: true, 
    email: isEmailChange ? cleanNewEmail : (cleanCurrentEmail || undefined),
    profile_photo: profile_photo || null, 
    message: isEmailChange ? 'Email and profile settings updated successfully.' : 'Profile settings updated successfully.' 
  });
});

// -------------------------------------------------------------
// System Users Management Endpoints (Super Admin & Staff Directory)
// -------------------------------------------------------------
app.get('/api/users', async (req, res) => {
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [rows] = await pool.query(`
        SELECT u.id, u.name, u.email, u.role, u.status, u.barangay, COALESCE(u.city, 'Butuan City') AS city, u.phone, u.employee_id, u.job_title, u.last_login, u.created_at, u.permissions,
               COALESCE(u.profile_photo, r.profile_photo) AS profile_photo,
               COALESCE(r.verification_status, u.verification_status, 'Verified') AS verification_status,
               r.first_name, r.last_name, r.middle_name, r.address, r.date_of_birth,
               r.gender, r.civil_status, r.purok, r.household_number, r.submitted_id, r.years_of_residency
        FROM users u
        LEFT JOIN residents r ON LOWER(u.email) = LOWER(r.email)
        ORDER BY u.id ASC
      `);
      const formatted = (rows || []).map(r => {
        let perms = r.permissions;
        if (perms && typeof perms === 'string') {
          try { perms = JSON.parse(perms); } catch {}
        }
        return { ...r, permissions: perms || null };
      });
      return res.json(formatted);
    } catch (err) {
      console.warn('MySQL users fetch error:', err.message);
    }
  }
  // Exclude password_hash in fallback response
  const sanitized = (mockData.users || []).map(u => {
    const r = (mockData.residents || []).find(res => (res.email || '').toLowerCase() === (u.email || '').toLowerCase());
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status || 'Active',
      barangay: u.barangay || 'Pianing',
      city: u.city || r?.city || 'Butuan City',
      phone: u.phone || (r?.phone || ''),
      employee_id: u.employee_id || null,
      job_title: u.job_title || null,
      last_login: u.last_login || null,
      created_at: u.created_at || new Date().toISOString(),
      profile_photo: u.profile_photo || r?.profile_photo || null,
      verification_status: u.verification_status || (r?.verification_status || 'Verified'),
      first_name: r?.first_name || '',
      middle_name: r?.middle_name || '',
      last_name: r?.last_name || '',
      address: r?.address || '',
      date_of_birth: r?.date_of_birth || '',
      gender: r?.gender || 'Male',
      civil_status: r?.civil_status || 'Single',
      purok: r?.purok || '',
      household_number: r?.household_number || '',
      submitted_id: r?.submitted_id || null,
      years_of_residency: r?.years_of_residency || '',
      permissions: u.permissions || null
    };
  });
  return res.json(sanitized);
});

app.post('/api/users', async (req, res) => {
  const { name, email, password, role, barangay, city, phone, status, employee_id, job_title, created_by } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const userRole = role || 'staff';
  const userBarangay = (barangay || 'Pianing').trim();
  const userCity = (city || 'Butuan City').trim();
  const userPhone = phone || '';
  const userEmployeeId = employee_id ? String(employee_id).trim() : null;
  const userJobTitle = job_title ? String(job_title).trim() : null;

  if (password) {
    const passCheck = validatePasswordComplexity(password);
    if (!passCheck.isValid) {
      return res.status(400).json({ success: false, message: passCheck.message });
    }
  }

  const pool = getPool();

  // 1 Admin per Barangay rule check
  if (userRole === 'admin') {
    if (pool && getStatus().connected) {
      try {
        const [existingAdmins] = await pool.query(
          "SELECT id, name FROM users WHERE role = 'admin' AND status = 'Active' AND LOWER(barangay) = LOWER(?)",
          [userBarangay]
        );
        if (existingAdmins.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Barangay ${userBarangay} already has an active Administrator (${existingAdmins[0].name}). Only 1 Admin per Barangay is allowed.`
          });
        }
      } catch {}
    } else {
      const existing = (mockData.users || []).find(u => u.role === 'admin' && u.status === 'Active' && (u.barangay || 'Pianing').toLowerCase() === userBarangay.toLowerCase());
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Barangay ${userBarangay} already has an active Administrator (${existing.name}). Only 1 Admin per Barangay is allowed.`
        });
      }
    }
  }

  if (pool && getStatus().connected) {
    try {
      const [existing] = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", [cleanEmail]);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'An account with this email already exists. Each account must have a unique email.' });
      }

      const rawPassword = password || 'Admin123!';
      const hashedPassword = await hashPassword(rawPassword);
      const userStatus = status || 'Active';

      const [result] = await pool.query(
        "INSERT INTO users (name, email, password_hash, role, barangay, city, phone, status, verification_status, employee_id, job_title, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Verified', ?, ?, NOW())",
        [name.trim(), cleanEmail, hashedPassword, userRole, userBarangay, userCity, userPhone, userStatus, userEmployeeId, userJobTitle]
      );

      // If superadmin role, ensure a clean, isolated barangay_settings row exists for their barangay
      if (userRole === 'superadmin' && userBarangay) {
        try {
          const cleanB = userBarangay.replace(/^Barangay\s+/i, '').trim();
          const [existingSettings] = await pool.query(
            'SELECT id FROM barangay_settings WHERE LOWER(barangay_name) = LOWER(?) OR LOWER(barangay_name) = LOWER(?) LIMIT 1',
            [cleanB, `Barangay ${cleanB}`]
          );
          if (!existingSettings || existingSettings.length === 0) {
            await pool.query(
              `INSERT INTO barangay_settings (barangay_name, municipality, province, emailjs_service_id, emailjs_template_id, emailjs_public_key, emailjs_private_key, sms_api_key, sms_sender_name, created_at, updated_at)
               VALUES (?, ?, ?, '', '', '', '', '', ?, NOW(), NOW())`,
              [`Barangay ${cleanB}`, userCity || 'Butuan City', 'Agusan del Norte', `Brgy${cleanB.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7)}`]
            );
            console.log(`[Settings] Created isolated barangay_settings row for ${cleanB}`);
          }
        } catch (settingsErr) {
          console.warn('Superadmin barangay_settings init warning:', settingsErr.message);
        }
      }

      // If resident role, link with existing census record or insert new resident
      if (userRole === 'resident') {
        const nameParts = name.trim().split(' ');
        const firstName = req.body.first_name || nameParts[0] || name.trim();
        const lastName = req.body.last_name || nameParts.slice(1).join(' ') || 'Resident';
        const householdNum = req.body.household_number || null;
        const purokVal = req.body.purok ? String(req.body.purok) : null;
        const genderVal = req.body.gender || null;
        const civilStatusVal = req.body.civil_status || null;
        const dobVal = req.body.date_of_birth || null;
        const residentId = req.body.resident_id || null;

        try {
          let targetResId = residentId;
          if (!targetResId) {
            const [existingRes] = await pool.query(
              "SELECT id FROM residents WHERE (LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)) OR LOWER(email) = LOWER(?) LIMIT 1",
              [firstName, lastName, cleanEmail]
            );
            if (existingRes && existingRes.length > 0) {
              targetResId = existingRes[0].id;
            }
          }

          if (targetResId) {
            await pool.query(
              `UPDATE residents SET 
                email = ?, 
                phone = COALESCE(NULLIF(phone, ''), ?), 
                verification_status = 'Verified',
                household_number = COALESCE(household_number, ?),
                purok = COALESCE(purok, ?)
              WHERE id = ?`,
              [cleanEmail, userPhone, householdNum, purokVal, targetResId]
            );
          } else {
            await pool.query(
              `INSERT INTO residents 
                (first_name, last_name, email, phone, address, barangay, verification_status, household_number, purok, gender, civil_status, date_of_birth) 
              VALUES (?, ?, ?, ?, ?, ?, 'Verified', ?, ?, ?, ?, ?)`,
              [firstName, lastName, cleanEmail, userPhone, `Barangay ${userBarangay}`, userBarangay, householdNum, purokVal, genderVal, civilStatusVal, dobVal]
            );
          }
        } catch (e) {
          console.warn('Resident census link error:', e.message);
        }
      }

      sendRegistrationEmail({
        to: cleanEmail,
        fullName: name.trim(),
        role: userRole,
        tempPassword: password || 'Admin123!'
      }).catch(e => console.warn('[Email] User creation email error:', e.message));

      logActivity({
        user_name: created_by || 'Super Administrator',
        user_role: 'superadmin',
        action: `Created ${userRole.toUpperCase()} Account: ${name.trim()}`,
        action_type: 'User',
        barangay: userBarangay,
        details: `Created new ${userRole} account for ${cleanEmail} in Barangay ${userBarangay}.`
      }).catch(() => {});

      const newUser = {
        id: result.insertId,
        name: name.trim(),
        email: cleanEmail,
        role: userRole,
        barangay: userBarangay,
        city: userCity,
        phone: userPhone,
        status: userStatus,
        employee_id: userEmployeeId,
        job_title: userJobTitle,
        last_login: new Date().toISOString(),
        verification_status: 'Verified'
      };

      return res.status(201).json(newUser);
    } catch (err) {
      console.warn('MySQL create user error:', err.message);
    }
  }

  // Fallback in-memory
  const existingMock = (mockData.users || []).find(u => u.email && u.email.toLowerCase() === cleanEmail);
  if (existingMock) {
    return res.status(400).json({ success: false, message: 'An account with this email already exists. Each account must have a unique email.' });
  }

  const newId = Date.now();
  const rawPassword = password || 'Admin123!';
  const hashedPassword = await hashPassword(rawPassword);
  const newUser = {
    id: newId,
    name: name.trim(),
    email: cleanEmail,
    password_hash: hashedPassword,
    role: userRole,
    barangay: userBarangay,
    city: userCity,
    phone: userPhone,
    status: status || 'Active',
    employee_id: userEmployeeId,
    job_title: userJobTitle,
    last_login: new Date().toISOString(),
    verification_status: 'Verified'
  };
  mockData.users.push(newUser);

  sendRegistrationEmail({
    to: cleanEmail,
    fullName: name.trim(),
    role: userRole,
    tempPassword: password || 'Admin123!'
  }).catch(e => console.warn('[Email] User creation email error:', e.message));

  logActivity({
    user_name: created_by || 'Super Administrator',
    user_role: 'superadmin',
    action: `Created ${userRole.toUpperCase()} Account: ${name.trim()}`,
    action_type: 'User',
    barangay: userBarangay,
    details: `Created new ${userRole} account for ${cleanEmail} in Barangay ${userBarangay}.`
  }).catch(() => {});

  return res.status(201).json(newUser);
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, role, barangay, phone, status, verification_status, password, employee_id, job_title, profile_photo, permissions } = req.body;

  if (password) {
    const passCheck = validatePasswordComplexity(password);
    if (!passCheck.isValid) {
      return res.status(400).json({ success: false, message: passCheck.message });
    }
  }

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const updates = [];
      const params = [];
      if (name) { updates.push('name = ?'); params.push(name.trim()); }
      if (email) { updates.push('email = ?'); params.push(email.trim().toLowerCase()); }
      if (role) { updates.push('role = ?'); params.push(role); }
      if (barangay !== undefined) { updates.push('barangay = ?'); params.push(barangay); }
      if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
      if (status) { updates.push('status = ?'); params.push(status); }
      if (verification_status) { updates.push('verification_status = ?'); params.push(verification_status); }
      if (employee_id !== undefined) { updates.push('employee_id = ?'); params.push(employee_id); }
      if (job_title !== undefined) { updates.push('job_title = ?'); params.push(job_title); }
      if (profile_photo !== undefined) { updates.push('profile_photo = ?'); params.push(profile_photo); }
      if (permissions !== undefined) {
        updates.push('permissions = ?');
        params.push(permissions ? JSON.stringify(permissions) : null);
      }
      if (password) {
        const hashedPassword = await hashPassword(password);
        updates.push('password_hash = ?');
        params.push(hashedPassword);
      }

      if (updates.length > 0) {
        params.push(id);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      // Sync verification_status, phone, or profile_photo to residents table if applicable
      if (verification_status || phone || email || profile_photo !== undefined) {
        const [uRows] = await pool.query("SELECT email FROM users WHERE id = ?", [id]);
        const targetEmail = email || uRows[0]?.email;
        if (targetEmail) {
          const resUpdates = [];
          const resParams = [];
          if (verification_status) { resUpdates.push('verification_status = ?'); resParams.push(verification_status); }
          if (phone) { resUpdates.push('phone = ?'); resParams.push(phone); }
          if (profile_photo !== undefined) { resUpdates.push('profile_photo = ?'); resParams.push(profile_photo); }
          if (resUpdates.length > 0) {
            resParams.push(targetEmail.toLowerCase());
            await pool.query(`UPDATE residents SET ${resUpdates.join(', ')} WHERE LOWER(email) = LOWER(?)`, resParams);
          }
        }
      }

      logActivity({
        user_name: 'Administrator',
        user_role: 'admin',
        action: `Updated User Account #${id}`,
        action_type: 'User',
        barangay: barangay || 'Pianing',
        details: `Updated settings for account #${id} (Name: ${name || 'N/A'}, Role: ${role || 'N/A'}, Status: ${status || 'N/A'}).`
      }).catch(() => {});

      return res.json({ success: true, message: 'User updated successfully.' });
    } catch (err) {
      console.warn('MySQL update user error:', err.message);
    }
  }

  // Mock data fallback
  const user = mockData.users.find(u => String(u.id) === String(id));
  if (user) {
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (barangay !== undefined) user.barangay = barangay;
    if (phone !== undefined) user.phone = phone;
    if (status) user.status = status;
    if (verification_status) user.verification_status = verification_status;
    if (password) user.password_hash = password;
    if (employee_id !== undefined) user.employee_id = employee_id;
    if (job_title !== undefined) user.job_title = job_title;
    if (profile_photo !== undefined) user.profile_photo = profile_photo;
    if (permissions !== undefined) user.permissions = permissions;

    // Sync to resident mock data
    if (user.email) {
      const resRecord = (mockData.residents || []).find(r => (r.email || '').toLowerCase() === user.email.toLowerCase());
      if (resRecord && profile_photo !== undefined) {
        resRecord.profile_photo = profile_photo;
      }
    }
  }

  logActivity({
    user_name: 'Administrator',
    user_role: 'admin',
    action: `Updated User Account #${id}`,
    action_type: 'User',
    barangay: barangay || 'Pianing',
    details: `Updated settings for account #${id}.`
  }).catch(() => {});

  return res.json({ success: true, message: 'User updated successfully.' });
});

app.post('/api/users/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (newPassword) {
    const passCheck = validatePasswordComplexity(newPassword);
    if (!passCheck.isValid) {
      return res.status(400).json({ success: false, message: passCheck.message });
    }
  }

  const resetPass = newPassword || 'Admin123!';

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const hashedReset = await hashPassword(resetPass);
      await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [hashedReset, id]);
      logActivity({
        user_name: 'Administrator',
        user_role: 'admin',
        action: `Reset Password for User #${id}`,
        action_type: 'Security',
        barangay: 'All (City-Wide)',
        details: `Reset password for user account ID #${id}.`
      }).catch(() => {});
      return res.json({ success: true, message: `Password reset to '${resetPass}' successfully.` });
    } catch (err) {
      console.warn('MySQL reset password error:', err.message);
    }
  }

  const user = mockData.users.find(u => String(u.id) === String(id));
  if (user) {
    user.password_hash = resetPass;
  }
  logActivity({
    user_name: 'Administrator',
    user_role: 'admin',
    action: `Reset Password for User #${id}`,
    action_type: 'Security',
    barangay: 'All (City-Wide)',
    details: `Reset password for user account ID #${id}.`
  }).catch(() => {});
  return res.json({ success: true, message: `Password reset to '${resetPass}' successfully.` });
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      // Soft-archive instead of hard-delete to preserve history
      await pool.query("UPDATE users SET status = 'Archived' WHERE id = ?", [id]);
      logActivity({
        user_name: 'Administrator',
        user_role: 'admin',
        action: `Archived User Account #${id}`,
        action_type: 'User',
        barangay: 'All (City-Wide)',
        details: `Archived account #${id} to maintain audit trail.`
      }).catch(() => {});
      return res.json({ success: true, message: 'User account archived successfully.' });
    } catch (err) {
      console.warn('MySQL delete user error:', err.message);
    }
  }

  const u = mockData.users.find(u => String(u.id) === String(id));
  if (u) {
    u.status = 'Archived';
  }
  logActivity({
    user_name: 'Administrator',
    user_role: 'admin',
    action: `Archived User Account #${id}`,
    action_type: 'User',
    barangay: 'All (City-Wide)',
    details: `Archived account #${id}.`
  }).catch(() => {});
  return res.json({ success: true, message: 'User account archived successfully.' });
});

// Intra-System Messenger Endpoints (Staff Chat)
app.get('/api/messages', async (req, res) => {
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [rows] = await pool.query("SELECT * FROM messages ORDER BY id ASC");
      const formatted = (rows || []).map(r => ({
        ...r,
        timestamp: r.timestamp || r.sent_at || new Date().toISOString()
      }));
      return res.json(formatted);
    } catch (err) {
      console.warn('MySQL messages fetch error:', err.message);
    }
  }
  return res.json(mockData.messages || []);
});

app.post('/api/messages', async (req, res) => {
  const { sender_name, sender_role, sender_email, recipient_name, recipient_role, recipient_email, message, barangay } = req.body || {};
  const targetRecipientName = recipient_name || '';
  const targetRecipientRole = recipient_role || 'all';
  const targetSenderEmail = sender_email || '';
  const targetRecipientEmail = recipient_email || '';
  let targetBarangay = barangay || 'Pianing';

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      // Look up barangay from users table if not passed
      if (!barangay && (sender_name || recipient_name)) {
        try {
          const [uRows] = await pool.query(
            "SELECT barangay FROM users WHERE LOWER(name) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1",
            [sender_name || '', recipient_name || '']
          );
          if (uRows.length > 0 && uRows[0].barangay) targetBarangay = uRows[0].barangay;
        } catch {}
      }

      const [result] = await pool.query(
        "INSERT INTO messages (sender_name, sender_role, sender_email, recipient_name, recipient_role, recipient_email, barangay, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [sender_name || 'Staff', sender_role || 'staff', targetSenderEmail, targetRecipientName, targetRecipientRole, targetRecipientEmail, targetBarangay, message || '']
      );
      return res.status(201).json({
        id: result.insertId,
        sender_name: sender_name || 'Staff',
        sender_role: sender_role || 'staff',
        sender_email: targetSenderEmail,
        recipient_name: targetRecipientName,
        recipient_role: targetRecipientRole,
        recipient_email: targetRecipientEmail,
        barangay: targetBarangay,
        message: message || '',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.warn('MySQL message insert error:', err.message);
    }
  }

  // Fallback to mockData
  const newMsg = {
    id: Date.now(),
    sender_name: sender_name || 'Staff',
    sender_role: sender_role || 'staff',
    sender_email: targetSenderEmail,
    recipient_name: targetRecipientName,
    recipient_role: targetRecipientRole,
    recipient_email: targetRecipientEmail,
    barangay: targetBarangay,
    message: message || '',
    timestamp: new Date().toISOString()
  };
  mockData.messages = mockData.messages || [];
  mockData.messages.push(newMsg);
  return res.status(201).json(newMsg);
});

// Full Resident Profile Details (Demographics + Clearance History + Health Records)
app.get('/api/residents/:id/full-profile', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();

  if (pool && getStatus().connected) {
    try {
      const [[resident]] = await pool.query("SELECT * FROM residents WHERE id = ?", [id]);
      if (resident) {
        let user = null;
        if (resident.email) {
          try {
            const [[userRow]] = await pool.query("SELECT id, name, email, role, status, created_at, last_login, profile_photo FROM users WHERE LOWER(email) = LOWER(?)", [resident.email]);
            if (userRow) {
              user = userRow;
              if (userRow.profile_photo && !resident.profile_photo) {
                resident.profile_photo = userRow.profile_photo;
              }
            }
          } catch {}
        }
        const [documents] = await pool.query("SELECT * FROM document_requests WHERE resident_id = ?", [id]);
        const [maternal] = await pool.query("SELECT * FROM maternal_records WHERE resident_id = ?", [id]);
        const [immunizations] = await pool.query("SELECT * FROM immunizations WHERE child_name LIKE ?", [`%${resident.first_name}%`]);
        return res.json({ resident, documents, maternal, immunizations, user });
      }
    } catch (err) {
      console.warn('MySQL full-profile error:', err.message);
    }
  }

  const resident = mockData.residents.find(r => r.id === id) || mockData.residents[0];
  let user = null;
  if (resident && resident.email) {
    const matchedUser = (mockData.users || []).find(u => (u.email || '').toLowerCase() === resident.email.toLowerCase());
    if (matchedUser) {
      user = matchedUser;
      if (matchedUser.profile_photo && !resident.profile_photo) {
        resident.profile_photo = matchedUser.profile_photo;
      }
    }
  }
  const documents = mockData.documents.filter(d => d.resident_id === resident?.id || d.resident_name.includes(resident?.first_name || ''));
  const maternal = mockData.maternal.filter(m => m.resident_id === resident?.id || m.mother_name.includes(resident?.first_name || ''));
  const immunizations = mockData.immunizations.filter(i => i.child_name.includes(resident?.first_name || '') || i.child_name.includes(resident?.last_name || ''));

  res.json({ resident, documents, maternal, immunizations, user });
});

// GET /api/auth/check-status?email=xxx  — live verification status for resident portals
app.get('/api/auth/check-status', async (req, res) => {
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ success: false, message: 'Email required.' });

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let userRows = [];
      let resRows = [];
      try {
        const [u] = await pool.query('SELECT * FROM users WHERE LOWER(email) = ?', [email]);
        userRows = u;
      } catch (e) {
        console.warn('user query fallback in check-status:', e.message);
      }
      try {
        const [r] = await pool.query('SELECT * FROM residents WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
        resRows = r;
      } catch (e) {
        console.warn('resident query fallback in check-status:', e.message);
      }

      if (userRows.length > 0 || resRows.length > 0) {
        const user = userRows[0] || { id: resRows[0]?.id || 1, email, role: 'resident', name: `${resRows[0]?.first_name || 'Resident'} ${resRows[0]?.last_name || ''}`.trim() };
        
        // If either residents table OR users table is Verified, sync both and report Verified
        let effectiveStatus = user.verification_status || 'Pending_Review';
        let rejectionCause = user.rejection_reason || '';

        if (resRows.length > 0) {
          user.phone = resRows[0].phone || '';
          user.address = resRows[0].address || '';
          user.purok = resRows[0].purok || '';
          if (!user.purok && (user.address || resRows[0].address)) {
            const pMatch = (user.address || resRows[0].address || '').match(/purok\s*([0-9A-Za-z]+)/i);
            if (pMatch) user.purok = pMatch[1];
          }
          user.first_name = resRows[0].first_name || '';
          user.middle_name = resRows[0].middle_name || '';
          user.last_name = resRows[0].last_name || '';
          rejectionCause = resRows[0].resident_rejection_reason || user.rejection_reason || '';

          if (resRows[0].resident_ver_status === 'Verified' || effectiveStatus === 'Verified') {
            effectiveStatus = 'Verified';
            try {
              await pool.query("UPDATE users SET verification_status = 'Verified' WHERE LOWER(email) = LOWER(?)", [email]);
              await pool.query("UPDATE residents SET verification_status = 'Verified' WHERE LOWER(email) = LOWER(?)", [email]);
            } catch {}
          } else if (resRows[0].resident_ver_status === 'Rejected' || effectiveStatus === 'Rejected') {
            effectiveStatus = 'Rejected';
          }
        }
        user.verification_status = effectiveStatus;
        user.rejection_reason = rejectionCause;
        return res.json({ success: true, user });
      }
    } catch (err) {
      console.warn('check-status error:', err.message);
    }
  }

  // Fallback: check mockData
  const user = mockData.users.find(u => u.email.toLowerCase() === email);
  const res_rec = mockData.residents.find(r => r.email && r.email.toLowerCase() === email);
  if (user || res_rec) {
    const combined = user || { id: res_rec.id, email, role: 'resident', name: `${res_rec.first_name} ${res_rec.last_name}` };
    if (res_rec) {
      combined.phone = res_rec.phone || '';
      combined.address = res_rec.address || '';
      combined.purok = res_rec.purok || '';
      if (!combined.purok && (combined.address || res_rec.address)) {
        const pMatch = (combined.address || res_rec.address || '').match(/purok\s*([0-9A-Za-z]+)/i);
        if (pMatch) combined.purok = pMatch[1];
      }
      if (res_rec.verification_status === 'Verified' || combined.verification_status === 'Verified') {
        combined.verification_status = 'Verified';
        if (user) user.verification_status = 'Verified';
        res_rec.verification_status = 'Verified';
      }
    }
    return res.json({ success: true, user: combined });
  }
  res.status(404).json({ success: false, message: 'User not found.' });
});

// -------------------------------------------------------------
// Statistics Endpoints
// -------------------------------------------------------------
app.get('/api/stats/admin', async (req, res) => {
  const { barangay } = req.query;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let docWhere = "";
      let resWhere = "";
      const params = [];
      if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
        docWhere = " AND (LOWER(barangay) = LOWER(?) OR resident_name LIKE ?)";
        resWhere = " WHERE (LOWER(barangay) = LOWER(?) OR LOWER(address) LIKE ?)";
        params.push(barangay.trim(), `%${barangay.trim()}%`);
      }

      const [[pendingDocs]] = await pool.query(`SELECT COUNT(*) as count FROM document_requests WHERE status = 'Pending'${docWhere}`, params);
      const [[processedDocs]] = await pool.query(`SELECT COUNT(*) as count FROM document_requests WHERE status = 'Completed' AND DATE(processed_at) = CURDATE()${docWhere}`, params);
      const [[totalCompleted]] = await pool.query(`SELECT COUNT(*) as count FROM document_requests WHERE status = 'Completed'${docWhere}`, params);
      const verifiedClause = resWhere ? `${resWhere} AND LOWER(COALESCE(verification_status, 'verified')) = 'verified'` : ` WHERE LOWER(COALESCE(verification_status, 'verified')) = 'verified'`;
      const [[totalResidents]] = await pool.query(`SELECT COUNT(*) as count FROM residents${verifiedClause}`, resWhere ? [barangay.trim(), `%${barangay.trim()}%`] : []);
      const [[activeRecords]] = await pool.query(`SELECT COUNT(*) as count FROM document_requests WHERE 1=1${docWhere}`, params);
      return res.json({
        pendingDocs: pendingDocs.count,
        processedToday: processedDocs.count,
        totalIssued: totalCompleted.count,
        totalResidents: totalResidents.count,
        activeRecords: activeRecords.count
      });
    } catch (err) {
      console.warn('MySQL stats query error:', err.message);
    }
  }

  let docs = mockData.documents;
  let resList = mockData.residents;
  if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
    docs = docs.filter(d => (d.barangay || '').toLowerCase() === barangay.toLowerCase());
    resList = resList.filter(r => (r.barangay || r.address || '').toLowerCase().includes(barangay.toLowerCase()));
  }

  res.json({
    pendingDocs: docs.filter(d => d.status === 'Pending').length,
    processedToday: docs.filter(d => d.status === 'Completed').length,
    totalIssued: docs.filter(d => d.status === 'Completed').length,
    totalResidents: resList.length,
    activeRecords: docs.length
  });
});

app.get('/api/stats/bhw', async (req, res) => {
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [[children]] = await pool.query("SELECT COUNT(DISTINCT child_name) as count FROM immunizations");
      const [[maternal]] = await pool.query("SELECT COUNT(*) as count FROM maternal_records");
      const [[vaccinationsMonth]] = await pool.query("SELECT COUNT(*) as count FROM immunizations WHERE status = 'Completed'");
      const [[overdue]] = await pool.query("SELECT COUNT(*) as count FROM immunizations WHERE status = 'Overdue'");
      return res.json({
        childrenMonitored: children.count || 245,
        maternalRecords: maternal.count || 89,
        vaccinationsMonth: vaccinationsMonth.count || 156,
        overdueImmunizations: overdue.count || 12
      });
    } catch (err) {
      console.warn('MySQL bhw stats query error:', err.message);
    }
  }

  res.json({
    childrenMonitored: 245,
    maternalRecords: mockData.maternal.length,
    vaccinationsMonth: mockData.immunizations.filter(i => i.status === 'Completed').length,
    overdueImmunizations: mockData.immunizations.filter(i => i.status === 'Overdue').length
  });
});

// -------------------------------------------------------------
// Official Document PDF Generator (jsPDF Node-Safe Vector Engine)
// -------------------------------------------------------------
function generateDocumentPdf(doc) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 215.9mm
  const margin = 20;
  const contentWidth = pageWidth - margin * 2; // 175.9mm

  // Parse extra fields
  let extra = {};
  try {
    if (doc.extra_fields) {
      extra = typeof doc.extra_fields === 'string' ? JSON.parse(doc.extra_fields) : doc.extra_fields;
    }
  } catch (e) {}

  const residentName = (doc.resident_name || 'Resident').toUpperCase();
  const address = doc.resident_address || doc.address || `Barangay ${doc.barangay || 'Pianing'}, Butuan City`;
  const civilStatus = doc.resident_civil_status || doc.civil_status || 'Single';
  const purpose = doc.purpose || 'Personal / Official Requirement';
  const brgyName = (doc.barangay || 'Pianing').toUpperCase();

  // Letterhead
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(60, 60, 60);
  pdf.text('Republic of the Philippines', pageWidth / 2, 22, { align: 'center' });
  pdf.text('Province of Agusan del Norte', pageWidth / 2, 26.5, { align: 'center' });
  pdf.text('City of Butuan', pageWidth / 2, 31, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(20, 20, 20);
  pdf.text(`BARANGAY ${brgyName}`, pageWidth / 2, 36.5, { align: 'center' });
  pdf.setFontSize(10);
  pdf.text('OFFICE OF THE PUNONG BARANGAY', pageWidth / 2, 41.5, { align: 'center' });

  // Divider lines
  pdf.setDrawColor(37, 99, 235);
  pdf.setLineWidth(0.8);
  pdf.line(margin, 45, pageWidth - margin, 45);

  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.3);
  pdf.line(margin, 46.5, pageWidth - margin, 46.5);

  // Document Title
  let docType = (doc.document_type || 'CERTIFICATE').trim();
  let docTitle = docType.toUpperCase();
  if (docTitle === 'BUSINESS CLEARANCE') docTitle = 'BARANGAY BUSINESS CLEARANCE';
  if (docTitle.includes('LAND OCCUPANCY')) docTitle = 'CERTIFICATE OF LAND OCCUPANCY';
  if (docTitle.includes('RESIDENCY')) docTitle = 'CERTIFICATE OF RESIDENCY';
  if (docTitle.includes('INDIGENCY')) docTitle = 'CERTIFICATE OF INDIGENCY';

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text(docTitle, pageWidth / 2, 59, { align: 'center' });

  // Tracking info & Date
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(90, 90, 90);
  const refCode = doc.request_code || `DOC-${doc.id || Date.now()}`;
  pdf.text(`Control / Reference No.: ${refCode}`, margin, 68);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  pdf.text(`Date Issued: ${dateStr}`, pageWidth - margin, 68, { align: 'right' });

  // Salutation
  let y = 81;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(20, 20, 20);
  pdf.text('TO WHOM IT MAY CONCERN:', margin, y);

  y += 9;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.5);
  pdf.setTextColor(30, 30, 30);

  let bodyParagraphs = [];

  if (docTitle === 'CERTIFICATE OF RESIDENCY') {
    bodyParagraphs.push(
      `This is to certify that ${residentName}, Filipino citizen, of legal age, ${civilStatus}, is a bona fide resident of ${address}.`,
      `According to the official census and civil registry records of this Barangay, the aforementioned individual is a permanent and peaceful resident of good moral character and standing in the community, with no derogatory record or civil citation filed against their person.`,
      `This certification is issued upon the formal request of the interested party for the purpose of: ${purpose.toUpperCase()} and for whatever lawful purpose it may serve.`
    );
  } else if (docTitle === 'BARANGAY BUSINESS CLEARANCE') {
    const bizName = (extra['Business Name'] || extra['business_name'] || 'COMMERCIAL ESTABLISHMENT').toUpperCase();
    const bizNature = extra['Nature of Business'] || extra['business_type'] || 'General Merchandise';
    const bizLoc = extra['Business Address'] || extra['business_location'] || address;

    bodyParagraphs.push(
      `This is to certify that Barangay Business Clearance is hereby granted to:`,
      `Business Establishment: ${bizName}\nNature / Line of Business: ${bizNature}\nOperating Address: ${bizLoc}\nRegistered Owner / Operator: ${residentName}`,
      `This clearance is issued pursuant to the provisions of Section 152 of Republic Act No. 7160 (The Local Government Code of 1991), following verification that the aforementioned commercial enterprise complies with all applicable Barangay ordinances, public safety, sanitation, and zoning standards.`,
      `Purpose: ${purpose.toUpperCase()}`
    );
  } else if (docTitle === 'CERTIFICATE OF LAND OCCUPANCY') {
    const lotNum = extra['Lot Number'] || extra['lot_number'] || 'N/A';
    const landArea = extra['Approximate Land Area'] || extra['land_area'] || 'N/A';
    const surveyInfo = extra['Survey / Cadastral Info'] || extra['survey_info'] || 'N/A';
    const occSince = extra['Occupancy Since'] || extra['occupancy_since'] || 'N/A';
    const landLocation = extra['Land / Property Location'] || extra['land_location'] || address;

    bodyParagraphs.push(
      `This is to certify that ${residentName}, Filipino citizen, of legal age, ${civilStatus}, residing at ${address}, is the actual and physical occupant and possessor of a parcel of land situated at:`,
      `Property Location: ${landLocation}\nCadastral / Lot Number: ${lotNum}\nApproximate Land Area: ${landArea}\nSurvey / Boundary Details: ${surveyInfo}\nOccupancy Duration: ${occSince}`,
      `This further certifies that, based on official barangay records, ocular verification, and testimony of neighboring residents, the subject real property has been openly, peacefully, and continuously occupied by the applicant without active adverse claimant, contest, or boundary dispute pending before the Lupong Tagapamayapa.`,
      `This certification is issued upon the request of ${residentName} for the purpose of: ${purpose.toUpperCase()} and for whatever legal intents it may serve.`
    );
  } else if (docTitle === 'CERTIFICATE OF INDIGENCY') {
    bodyParagraphs.push(
      `This is to certify that ${residentName}, Filipino, of legal age, ${civilStatus}, residing at ${address}, belongs to an indigent family whose income falls below the poverty threshold in this community.`,
      `This further certifies that the above-named individual has been verified by the Barangay Council as eligible to receive social assistance, medical subsidy, legal representation, and humanitarian aid.`,
      `This certification is issued upon their request for the purpose of: ${purpose.toUpperCase()}.`
    );
  } else {
    bodyParagraphs.push(
      `This is to certify that ${residentName}, Filipino citizen, of legal age, ${civilStatus}, residing at ${address}, is a bona fide resident of Barangay ${doc.barangay || 'Pianing'}, Butuan City.`,
      `Based on the records on file in this office, the applicant has displayed good moral conduct, is a law-abiding citizen, and has NOT been convicted of any crime or penalized for community violations.`,
      `This official document is issued upon personal request for the purpose of: ${purpose.toUpperCase()}.`
    );
  }

  for (const para of bodyParagraphs) {
    const lines = pdf.splitTextToSize(para, contentWidth);
    pdf.text(lines, margin, y);
    y += lines.length * 5.6 + 3.5;
  }

  y += 3;
  const day = now.getDate();
  const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const issuanceText = `Issued this ${day}th day of ${monthYear} at the Office of the Punong Barangay, Barangay ${doc.barangay || 'Pianing'}, Butuan City, Agusan del Norte, Philippines.`;
  const issLines = pdf.splitTextToSize(issuanceText, contentWidth);
  pdf.text(issLines, margin, y);

  y += 22;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text("Applicant's Signature:", margin, y);
  pdf.line(margin, y + 10, margin + 50, y + 10);

  const sigRightX = pageWidth - margin - 55;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('HON. JUAN DELA CRUZ', sigRightX + 27, y + 6, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text('Punong Barangay', sigRightX + 27, y + 11, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text('(NOT VALID WITHOUT OFFICIAL DRY SEAL)', sigRightX + 27, y + 16, { align: 'center' });

  return Buffer.from(pdf.output('arraybuffer'));
}

// -------------------------------------------------------------
// PDF Download & Generation Endpoints
// -------------------------------------------------------------
app.get('/api/documents/:id/pdf', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  let doc = null;

  if (pool && getStatus().connected) {
    try {
      const [rows] = await pool.query(`
        SELECT d.*,
               COALESCE(r.address, '') AS resident_address,
               COALESCE(r.civil_status, 'Single') AS resident_civil_status,
               COALESCE(r.gender, '') AS resident_gender,
               r.date_of_birth AS resident_birth_date
        FROM document_requests d
        LEFT JOIN residents r ON (d.resident_id = r.id OR (d.email != '' AND LOWER(d.email) = LOWER(r.email)))
        WHERE d.id = ?
        LIMIT 1
      `, [id]);
      if (rows.length > 0) doc = rows[0];
    } catch (err) {
      console.warn('MySQL PDF fetch error:', err.message);
    }
  }

  if (!doc) {
    doc = (mockData.documents || []).find(d => d.id === id);
  }

  if (!doc) {
    return res.status(404).json({ error: 'Document request not found' });
  }

  try {
    const pdfBuffer = generateDocumentPdf(doc);
    const safeType = (doc.document_type || 'Document').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeCode = (doc.request_code || id).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeType}_${safeCode}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF Generation Error:', err);
    return res.status(500).json({ error: 'Failed to generate PDF file', details: err.message });
  }
});

app.post('/api/documents/generate-pdf', async (req, res) => {
  const doc = req.body;
  if (!doc || !doc.document_type) {
    return res.status(400).json({ error: 'Document data with document_type required' });
  }

  try {
    const pdfBuffer = generateDocumentPdf(doc);
    const safeType = (doc.document_type || 'Document').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeType}_Preview.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF Direct Generation Error:', err);
    return res.status(500).json({ error: 'Failed to generate PDF file', details: err.message });
  }
});

// -------------------------------------------------------------
// Documents CRUD
// -------------------------------------------------------------
app.get('/api/documents', async (req, res) => {
  const { barangay, email, resident_id } = req.query;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let query = `
        SELECT d.*, 
               COALESCE(r.address, '') AS resident_address,
               COALESCE(r.civil_status, 'Single') AS resident_civil_status,
               COALESCE(r.gender, '') AS resident_gender,
               r.date_of_birth AS resident_birth_date,
               TIMESTAMPDIFF(YEAR, r.date_of_birth, CURDATE()) AS resident_age
        FROM document_requests d
        LEFT JOIN residents r ON (
          (d.resident_id > 0 AND d.resident_id = r.id)
          OR ((d.resident_id IS NULL OR d.resident_id = 0) AND d.email != '' AND LOWER(d.email) = LOWER(r.email))
        )
      `;
      const params = [];
      const whereConditions = [];

      if (email || resident_id) {
        const userOrs = [];
        if (email) {
          userOrs.push(`LOWER(d.email) = LOWER(?)`);
          params.push(email.trim());
        }
        if (resident_id) {
          userOrs.push(`d.resident_id = ?`);
          params.push(Number(resident_id));
        }
        whereConditions.push(`(${userOrs.join(' OR ')})`);
      } else if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
        whereConditions.push(`(
          LOWER(COALESCE(d.barangay, '')) = LOWER(?)
          OR LOWER(COALESCE(d.barangay, '')) LIKE LOWER(?)
          OR LOWER(COALESCE(r.barangay, '')) = LOWER(?)
          OR (LOWER(?) = 'pianing' AND (d.barangay IS NULL OR d.barangay = ''))
        )`);
        params.push(barangay.trim(), `%${barangay.trim()}%`, barangay.trim(), barangay.trim());
      }

      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      query += ` ORDER BY d.id DESC`;
      const [rows] = await pool.query(query, params);
      const seenDocIds = new Set();
      const uniqueRows = [];
      for (const row of rows) {
        if (!seenDocIds.has(row.id)) {
          seenDocIds.add(row.id);
          uniqueRows.push(row);
        }
      }
      return res.json(uniqueRows);
    } catch (err) {
      console.warn('MySQL documents fetch error:', err.message);
    }
  }
  let docs = mockData.documents;
  if (email || resident_id) {
    const targetEmail = (email || '').toLowerCase().trim();
    const targetResId = resident_id ? Number(resident_id) : null;
    docs = docs.filter(d => {
      if (targetEmail && (d.email || '').toLowerCase() === targetEmail) return true;
      if (targetResId && d.resident_id === targetResId) return true;
      return false;
    });
  } else if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
    const bLower = barangay.toLowerCase().trim();
    docs = docs.filter(d => {
      const docB = (d.barangay || '').toLowerCase();
      if (docB === bLower || docB.includes(bLower)) return true;
      if (bLower === 'pianing' && (!docB)) return true;
      return false;
    });
  }
  res.json(docs);
});

app.post('/api/documents', async (req, res) => {
  const { resident_name, resident_id, email, document_type, purpose, barangay, extra_fields } = req.body;
  const safeResidentName = sanitizeInput(resident_name) || 'Resident';
  const safePurpose = sanitizeInput(purpose) || 'Personal Requirement';
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const requestCode = `DOC-${Date.now().toString().slice(-4)}${randNum}`;
  let docBarangay = barangay || 'Pianing';
  
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      // Check if this document category is deactivated by Super Admin
      try {
        const [catRows] = await pool.query("SELECT status FROM document_categories WHERE LOWER(name) = LOWER(?) LIMIT 1", [document_type]);
        if (catRows.length > 0 && catRows[0].status === 'Inactive') {
          return res.status(400).json({
            success: false,
            message: `The '${document_type}' service category has been temporarily deactivated by the Super Administrator.`
          });
        }
      } catch {}

      let matchedResidentId = resident_id || 1;
      let residentAddress = '';
      let residentCivilStatus = 'Single';
      if (resident_id || resident_name || email) {
        try {
          const [resRows] = await pool.query(
            "SELECT id, address, civil_status FROM residents WHERE id = ? OR LOWER(email) = LOWER(?) OR CONCAT(LOWER(first_name), ' ', LOWER(last_name)) = LOWER(?) LIMIT 1",
            [resident_id || 0, email || '', resident_name || '']
          );
          if (resRows.length > 0) {
            matchedResidentId = resRows[0].id;
            residentAddress = resRows[0].address || '';
            residentCivilStatus = resRows[0].civil_status || 'Single';
            if (resRows[0].address && resRows[0].address.toLowerCase().includes('anticala')) {
              docBarangay = 'Anticala';
            }
          }
        } catch {}
      }

      const docStatus = req.body.status || 'Pending';
      const processedBy = req.body.processed_by || (docStatus === 'Completed' ? 'Barangay Administrator' : null);
      const processedAt = docStatus === 'Completed' ? new Date().toISOString() : null;

      const safeResidentName = sanitizeInput(resident_name) || 'Resident';
      const safePurpose = sanitizeInput(purpose) || 'Personal Requirement';
      const extraFieldsStr = typeof extra_fields === 'object' ? JSON.stringify(extra_fields) : (extra_fields || null);

      const [result] = await pool.query(
        "INSERT INTO document_requests (request_code, resident_id, resident_name, email, document_type, purpose, status, barangay, extra_fields, processed_by, processed_at, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
        [requestCode, matchedResidentId, safeResidentName, email || '', document_type, safePurpose, docStatus, docBarangay, extraFieldsStr, processedBy, docStatus === 'Completed' ? new Date() : null]
      );
      const newDoc = {
        id: result.insertId,
        request_code: requestCode,
        resident_id: matchedResidentId,
        resident_name: safeResidentName,
        email: email || '',
        barangay: docBarangay,
        document_type,
        purpose: safePurpose,
        extra_fields: extraFieldsStr,
        resident_address: residentAddress,
        resident_civil_status: residentCivilStatus,
        status: docStatus,
        processed_by: processedBy,
        processed_at: processedAt,
        requested_at: new Date().toISOString()
      };

      // Auto-dispatch email notification to resident upon request submission
      if (email && email.includes('@')) {
        sendDocumentStatusEmail({
          to: email,
          recipientName: safeResidentName,
          documentType: document_type,
          requestCode,
          status: docStatus,
          message: 'Your document request has been submitted and is currently pending review.'
        }).catch(e => console.warn('[Email] Document request email error:', e.message));
      }

      logActivity({
        user_name: resident_name || 'Resident',
        user_role: 'resident',
        action: `Submitted Document Request: ${document_type}`,
        action_type: 'Document',
        barangay: docBarangay,
        details: `Requested ${document_type} (Purpose: ${purpose || 'Personal Requirement'}). Tracking: ${requestCode}`
      }).catch(() => {});

      return res.status(201).json(newDoc);
    } catch (err) {
      console.warn('MySQL document insert error:', err.message);
    }
  }

  const docStatus = req.body.status || 'Pending';
  const processedBy = req.body.processed_by || (docStatus === 'Completed' ? 'Barangay Administrator' : null);
  const newDoc = {
    id: Date.now(),
    request_code: requestCode,
    resident_id: resident_id || 1,
    resident_name: safeResidentName,
    email: email || '',
    barangay: docBarangay,
    document_type,
    purpose: safePurpose,
    extra_fields: typeof extra_fields === 'object' ? JSON.stringify(extra_fields) : (extra_fields || null),
    status: docStatus,
    processed_by: processedBy,
    processed_at: docStatus === 'Completed' ? new Date().toISOString() : null,
    requested_at: new Date().toISOString()
  };
  mockData.documents.unshift(newDoc);

  if (email && email.includes('@')) {
    sendDocumentStatusEmail({
      to: email,
      recipientName: safeResidentName,
      documentType: document_type,
      requestCode,
      status: docStatus,
      message: 'Your document request has been submitted and is currently pending review.'
    }).catch(e => console.warn('[Email] Document request email error:', e.message));
  }

  logActivity({
    user_name: resident_name || 'Resident',
    user_role: 'resident',
    action: `Submitted Document Request: ${document_type}`,
    action_type: 'Document',
    barangay: docBarangay,
    details: `Requested ${document_type} (Purpose: ${purpose || 'Personal Requirement'}). Tracking: ${requestCode}`
  }).catch(() => {});

  res.status(201).json(newDoc);
});

app.put('/api/documents/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { status, processed_by } = req.body;

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      // Get document request info
      const [docRows] = await pool.query("SELECT * FROM document_requests WHERE id = ?", [id]);
      const docData = docRows[0];

      await pool.query(
        "UPDATE document_requests SET status = ?, processed_at = NOW(), processed_by = ? WHERE id = ?",
        [status, processed_by || 'Barangay Office', id]
      );

      // Auto-dispatch SMS notification to resident
      if (docData) {
        try {
          const recipientName = docData.resident_name || 'Resident';
          let phone = '09171234567';

          // Look up resident phone
          if (docData.resident_id) {
            const [rRows] = await pool.query("SELECT phone FROM residents WHERE id = ?", [docData.resident_id]);
            if (rRows[0]?.phone) phone = rRows[0].phone;
          }
          if (phone === '09171234567' && docData.resident_name) {
            const [nameRows] = await pool.query("SELECT phone FROM residents WHERE CONCAT(first_name, ' ', last_name) LIKE ? OR first_name LIKE ?", [`%${docData.resident_name}%`, `%${docData.resident_name}%`]);
            if (nameRows[0]?.phone) phone = nameRows[0].phone;
          }

          let smsMsg = '';
          let alertType = 'Document Update';

          if (status === 'Ready for Pickup') {
            smsMsg = `Good day ${recipientName}! Your requested ${docData.document_type} (Ref: ${docData.request_code}) has been SIGNED and is now READY FOR PICKUP at the Barangay Hall. Please bring a valid ID and your reference number. Office hours: Monday-Friday, 8AM-5PM.`;
            alertType = 'Document Ready';
          } else if (status === 'Completed') {
            smsMsg = `Good day ${recipientName}! Your ${docData.document_type} (Ref: ${docData.request_code}) has been marked as CLAIMED. Thank you for visiting the Barangay Hall.`;
            alertType = 'Document Completed';
          } else if (status === 'Processing') {
            smsMsg = `Good day ${recipientName}! Your requested ${docData.document_type} (Ref: ${docData.request_code}) is now being PROCESSED by ${processed_by || 'Barangay Staff'}. You will receive another text once ready for pickup.`;
            alertType = 'Document Processing';
          } else {
            smsMsg = `Update on your ${docData.document_type} (Ref: ${docData.request_code}): Status updated to ${status}.`;
            alertType = 'Document Update';
          }
          
          await pool.query(
            "INSERT INTO sms_notifications (recipient_name, recipient_phone, type, message, status) VALUES (?, ?, ?, ?, 'Sent')",
            [recipientName, phone, alertType, smsMsg]
          );
          // Dispatch live SMS via iProgTech Gateway
          sendLiveSms(phone, smsMsg).catch(e => console.warn('iProg SMS document text error:', e.message));
          console.log(`[Auto-SMS] Dispatched to ${recipientName} (${phone}): ${smsMsg}`);

          // Auto-dispatch Email notification if resident has an email on file
          const residentEmail = docData.email || null;
          if (residentEmail && residentEmail.includes('@')) {
            sendDocumentStatusEmail({
              to: residentEmail,
              recipientName,
              documentType: docData.document_type,
              requestCode:  docData.request_code,
              status,
            }).catch(e => console.warn('[Email] Document email error:', e.message));
            console.log(`[Auto-Email] Document status email sent to ${residentEmail}`);
          } else {
            // Try to look up email from residents table
            try {
              const [emailRows] = await pool.query("SELECT email FROM residents WHERE id = ? OR CONCAT(first_name,' ',last_name) LIKE ?", [docData.resident_id, `%${docData.resident_name}%`]);
              const foundEmail = emailRows[0]?.email;
              if (foundEmail && foundEmail.includes('@')) {
                sendDocumentStatusEmail({
                  to: foundEmail,
                  recipientName,
                  documentType: docData.document_type,
                  requestCode:  docData.request_code,
                  status,
                }).catch(e => console.warn('[Email] Document email error:', e.message));
                console.log(`[Auto-Email] Document status email sent to ${foundEmail}`);
              }
            } catch (emailLookupErr) { /* no email found, skip */ }
          }
        } catch (smsErr) {
          console.warn('Auto SMS/Email dispatch warning:', smsErr.message);
        }
      }

      logActivity({
        user_name: processed_by || 'Barangay Office',
        user_role: 'staff',
        action: `Updated Document Status: ${docData?.document_type || 'Document'} (${status})`,
        action_type: 'Document',
        barangay: docData?.barangay || 'Pianing',
        details: `Set status of request ${docData?.request_code || id} (${docData?.resident_name || 'Resident'}) to ${status}.`
      }).catch(() => {});

      return res.json({ success: true, message: 'Document request updated. Auto SMS & email sent to resident.' });
    } catch (err) {
      console.warn('MySQL document update error:', err.message);
    }
  }

  const doc = mockData.documents.find(d => d.id === id);
  if (doc) {
    doc.status = status;
    doc.processed_at = new Date().toLocaleString();
    doc.processed_by = processed_by || 'Admin User';
    logActivity({
      user_name: processed_by || 'Barangay Office',
      user_role: 'staff',
      action: `Updated Document Status: ${doc.document_type || 'Document'} (${status})`,
      action_type: 'Document',
      barangay: doc.barangay || 'Pianing',
      details: `Set status of request ${doc.request_code || id} (${doc.resident_name || 'Resident'}) to ${status}.`
    }).catch(() => {});
    return res.json(doc);
  }
  res.status(404).json({ error: 'Document not found' });
});

app.delete('/api/documents/:id', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query("DELETE FROM document_requests WHERE id = ?", [id]);
      logActivity({
        user_name: 'Barangay Administrator',
        user_role: 'admin',
        action: `Deleted Document Request #${id}`,
        action_type: 'Document',
        barangay: 'Pianing',
        details: `Permanently removed document request #${id}.`
      }).catch(() => {});
      return res.json({ success: true });
    } catch (err) {
      console.warn('MySQL document delete error:', err.message);
    }
  }
  mockData.documents = mockData.documents.filter(d => d.id !== id);
  logActivity({
    user_name: 'Barangay Administrator',
    user_role: 'admin',
    action: `Deleted Document Request #${id}`,
    action_type: 'Document',
    barangay: 'Pianing',
    details: `Permanently removed document request #${id}.`
  }).catch(() => {});
  res.json({ success: true });
});

// -------------------------------------------------------------
// Residents CRUD
// -------------------------------------------------------------
// -------------------------------------------------------------
// Residents CRUD & Population Census
// -------------------------------------------------------------
app.get('/api/residents', async (req, res) => {
  const { barangay, purok } = req.query;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let query = `
        SELECT r.*,
               TIMESTAMPDIFF(YEAR, r.date_of_birth, CURDATE()) AS age
        FROM residents r 
      `;
      const params = [];
      const whereClauses = [];
      if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
        // Strict barangay match: use barangay column when present, fall back to address only when barangay is NULL/empty
        whereClauses.push(`(
          (r.barangay IS NOT NULL AND r.barangay != '' AND LOWER(r.barangay) = LOWER(?))
          OR
          (COALESCE(r.barangay, '') = '' AND LOWER(r.address) LIKE LOWER(?))
        )`);
        params.push(barangay.trim(), `%${barangay.trim()}%`);
      }
      if (purok && purok.toLowerCase() !== 'all') {
        const cleanP = purok.toString().replace(/purok\s*/i, '').trim();
        whereClauses.push(`(r.purok = ? OR r.purok = ? OR LOWER(r.address) LIKE ?)`);
        params.push(cleanP, `Purok ${cleanP}`, `%purok ${cleanP}%`);
      }
      const cleanIncludePending = req.query.include_pending === 'true';
      if (!cleanIncludePending) {
        // Only include explicitly verified residents — do NOT treat NULL as verified
        whereClauses.push(`LOWER(COALESCE(r.verification_status, '')) IN ('verified', 'active')`);
      }
      if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      query += ` ORDER BY r.purok ASC, r.household_number ASC, r.is_head_of_household DESC, r.id DESC`;
      const [rows] = await pool.query(query, params);
      
      const parsedRows = (rows || []).map(r => {
        let p = r.purok;
        if (!p && r.address) {
          const match = r.address.match(/purok\s*([0-9A-Za-z_-]+)/i);
          if (match) p = match[1];
        }
        const cleanP = (p || '1').toString().replace(/purok\s*/i, '').trim();
        const age = r.age != null ? Number(r.age) : (r.date_of_birth ? Math.max(0, new Date().getFullYear() - new Date(r.date_of_birth).getFullYear()) : 25);
        return {
          ...r,
          age,
          purok: cleanP,
          barangay: r.barangay || (r.address && r.address.toLowerCase().includes('anticala') ? 'Anticala' : 'Pianing'),
          civil_status: r.civil_status || 'Single',
          household_number: r.household_number || `HH-P${cleanP}-${String(r.id).padStart(3, '0')}`,
          family_name: r.family_name || r.last_name || 'Resident',
          is_head_of_household: Boolean(r.is_head_of_household),
          relationship_to_head: r.relationship_to_head || 'Member',
          employment_status: r.employment_status || (age >= 60 ? 'Retired' : (age < 18 ? 'Student' : 'Employed')),
          is_senior: age >= 60,
          is_child: age < 18
        };
      });

      return res.json(parsedRows);
    } catch (err) {
      console.warn('MySQL residents fetch error:', err.message);
    }
  }
  let fallback = (mockData.residents || []).map(r => {
    let p = r.purok;
    if (!p && r.address) {
      const match = r.address.match(/purok\s*([0-9A-Za-z_-]+)/i);
      if (match) p = match[1];
    }
    const cleanP = (p || '1').toString().replace(/purok\s*/i, '').trim();
    const age = r.age != null ? Number(r.age) : (r.date_of_birth ? Math.max(0, new Date().getFullYear() - new Date(r.date_of_birth).getFullYear()) : 25);
    return {
      ...r,
      purok: cleanP,
      barangay: r.barangay || 'Pianing',
      civil_status: r.civil_status || 'Single',
      age,
      household_number: r.household_number || `HH-P${cleanP}-${String(r.id).padStart(3, '0')}`,
      family_name: r.family_name || r.last_name || 'Resident',
      is_head_of_household: Boolean(r.is_head_of_household),
      relationship_to_head: r.relationship_to_head || 'Member',
      employment_status: r.employment_status || (age >= 60 ? 'Retired' : (age < 18 ? 'Student' : 'Employed')),
      is_senior: age >= 60,
      is_child: age < 18
    };
  });
  if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
    fallback = fallback.filter(r => (r.barangay || r.address || '').toLowerCase().includes(barangay.toLowerCase()));
  }
  if (purok && purok.toLowerCase() !== 'all') {
    const cleanP = purok.toString().replace(/purok\s*/i, '').trim();
    fallback = fallback.filter(r => r.purok === cleanP);
  }
  res.json(fallback);
});

// -------------------------------------------------------------
// Census Analytics Endpoint (Households, Families, Seniors, Employment)
// -------------------------------------------------------------
app.get('/api/census/stats', async (req, res) => {
  const { barangay, purok } = req.query;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let whereClauses = [];
      let params = [];
      if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
        // Strict barangay match for census stats — same logic as residents endpoint
        whereClauses.push(`(
          (barangay IS NOT NULL AND barangay != '' AND LOWER(barangay) = LOWER(?))
          OR
          (COALESCE(barangay, '') = '' AND LOWER(address) LIKE LOWER(?))
        )`);
        params.push(barangay.trim(), `%${barangay.trim()}%`);
      }
      if (purok && purok.toLowerCase() !== 'all') {
        const cleanP = purok.toString().replace(/purok\s*/i, '').trim();
        whereClauses.push(`(purok = ? OR purok = ? OR LOWER(address) LIKE ?)`);
        params.push(cleanP, `Purok ${cleanP}`, `%purok ${cleanP}%`);
      }
      // Restrict to verified residents only
      whereClauses.push(`LOWER(COALESCE(verification_status, '')) IN ('verified', 'active')`);

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const [summary] = await pool.query(`
        SELECT 
          COUNT(*) AS total_population,
          COUNT(DISTINCT NULLIF(household_number, '')) AS total_households,
          COUNT(DISTINCT NULLIF(family_name, '')) AS total_families,
          SUM(CASE WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) >= 60 THEN 1 ELSE 0 END) AS total_seniors,
          SUM(CASE WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) >= 60 AND gender = 'Male' THEN 1 ELSE 0 END) AS senior_male,
          SUM(CASE WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) >= 60 AND gender = 'Female' THEN 1 ELSE 0 END) AS senior_female,
          SUM(CASE WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) < 18 THEN 1 ELSE 0 END) AS total_children,
          SUM(CASE WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) >= 18 AND TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) < 60 THEN 1 ELSE 0 END) AS total_adults,
          SUM(CASE WHEN employment_status IN ('Employed', 'Self-Employed') THEN 1 ELSE 0 END) AS total_employed,
          SUM(CASE WHEN employment_status = 'Unemployed' THEN 1 ELSE 0 END) AS total_unemployed
        FROM residents
        ${whereSql}
      `, params);

      const [purokGroupRows] = await pool.query(`
        SELECT 
          REPLACE(LOWER(purok), 'purok', '') AS p_num,
          COUNT(*) AS population,
          COUNT(DISTINCT NULLIF(household_number, '')) AS households,
          SUM(CASE WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) >= 60 THEN 1 ELSE 0 END) AS seniors,
          SUM(CASE WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) < 18 THEN 1 ELSE 0 END) AS children,
          SUM(CASE WHEN employment_status IN ('Employed', 'Self-Employed') THEN 1 ELSE 0 END) AS employed,
          SUM(CASE WHEN employment_status = 'Unemployed' THEN 1 ELSE 0 END) AS unemployed
        FROM residents
        WHERE LOWER(COALESCE(verification_status, '')) IN ('verified', 'active')
        ${barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')
          ? `AND ((barangay IS NOT NULL AND barangay != '' AND LOWER(barangay) = LOWER(?)) OR (COALESCE(barangay,'') = '' AND LOWER(address) LIKE LOWER(?)))`
          : ''}
        GROUP BY p_num
      `, barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide') ? [barangay.trim(), `%${barangay.trim()}%`] : []);

      const purokMap = {};
      for (let i = 1; i <= 6; i++) {
        purokMap[i.toString()] = {
          purok: `Purok ${i}`,
          population: 0,
          households: 0,
          seniors: 0,
          children: 0,
          employed: 0,
          unemployed: 0
        };
      }
      purokGroupRows.forEach(r => {
        const key = (r.p_num || '').toString().trim();
        if (purokMap[key]) {
          purokMap[key].population = Number(r.population) || 0;
          purokMap[key].households = Number(r.households) || 0;
          purokMap[key].seniors = Number(r.seniors) || 0;
          purokMap[key].children = Number(r.children) || 0;
          purokMap[key].employed = Number(r.employed) || 0;
          purokMap[key].unemployed = Number(r.unemployed) || 0;
        }
      });

      const row = summary[0] || {};
      const totalPop = Number(row.total_population) || 0;
      const totalHH = Number(row.total_households) || (totalPop > 0 ? Math.ceil(totalPop / 3) : 0);
      const totalFam = Number(row.total_families) || totalHH;
      const seniorTotal = Number(row.total_seniors) || 0;
      const seniorM = Number(row.senior_male) || 0;
      const seniorF = Number(row.senior_female) || (seniorTotal - seniorM);
      const children = Number(row.total_children) || 0;
      const adults = Number(row.total_adults) || 0;
      const employed = Number(row.total_employed) || 0;
      const unemployed = Number(row.total_unemployed) || 0;
      const rate = (employed + unemployed) > 0 ? Math.round((employed / (employed + unemployed)) * 100) : 80;

      return res.json({
        success: true,
        barangay: barangay || 'Pianing',
        purok: purok || 'all',
        total_households: totalHH,
        total_families: totalFam,
        total_population: totalPop,
        senior_citizens: {
          total: seniorTotal,
          male: seniorM,
          female: seniorF
        },
        children_count: children,
        adults_count: adults,
        employment: {
          employed,
          unemployed,
          rate_percentage: rate
        },
        purok_breakdown: Object.values(purokMap)
      });
    } catch (err) {
      console.warn('MySQL census stats error:', err.message);
    }
  }

  // Fallback mock stats dynamically computed from resident records
  let fallbackResidents = mockData.residents || [];
  if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
    fallbackResidents = fallbackResidents.filter(r => (r.barangay || '').toLowerCase() === barangay.toLowerCase().trim());
  }
  if (purok && purok.toLowerCase() !== 'all') {
    const cleanP = purok.toString().replace(/purok\s*/i, '').trim();
    fallbackResidents = fallbackResidents.filter(r => {
      const rp = (r.purok || '').toString().replace(/purok\s*/i, '').trim();
      return rp === cleanP || (r.address || '').toLowerCase().includes(`purok ${cleanP}`.toLowerCase());
    });
  }

  const totalPop = fallbackResidents.length;
  const nowYear = new Date().getFullYear();
  const getAge = (dob) => {
    if (!dob) return 25;
    const y = parseInt(dob.split('-')[0], 10);
    return isNaN(y) ? 25 : nowYear - y;
  };

  const seniors = fallbackResidents.filter(r => getAge(r.date_of_birth) >= 60);
  const seniorM = seniors.filter(r => (r.gender || 'Male') === 'Male').length;
  const seniorF = seniors.length - seniorM;
  const children = fallbackResidents.filter(r => getAge(r.date_of_birth) < 18).length;
  const adults = fallbackResidents.filter(r => getAge(r.date_of_birth) >= 18 && getAge(r.date_of_birth) < 60).length;
  const employed = fallbackResidents.filter(r => r.employment_status === 'Employed' || r.employment_status === 'Self-Employed').length;
  const unemployed = fallbackResidents.filter(r => r.employment_status === 'Unemployed').length;
  const rate = (employed + unemployed) > 0 ? Math.round((employed / (employed + unemployed)) * 100) : 0;
  const totalHH = totalPop > 0 ? Math.ceil(totalPop / 3) : 0;

  return res.json({
    success: true,
    barangay: barangay || 'Pianing',
    purok: purok || 'all',
    total_households: totalHH,
    total_families: totalHH,
    total_population: totalPop,
    senior_citizens: { total: seniors.length, male: seniorM, female: seniorF },
    children_count: children,
    adults_count: adults,
    employment: { employed, unemployed, rate_percentage: rate },
    purok_breakdown: [1, 2, 3, 4, 5, 6].map(i => {
      const pRes = fallbackResidents.filter(r => {
        const rp = (r.purok || '').toString().replace(/purok\s*/i, '').trim();
        return rp === String(i) || (r.address || '').toLowerCase().includes(`purok ${i}`.toLowerCase());
      });
      const pCount = pRes.length;
      return {
        purok: `Purok ${i}`,
        population: pCount,
        households: pCount > 0 ? Math.ceil(pCount / 3) : 0,
        seniors: pRes.filter(r => getAge(r.date_of_birth) >= 60).length,
        children: pRes.filter(r => getAge(r.date_of_birth) < 18).length,
        employed: pRes.filter(r => r.employment_status === 'Employed' || r.employment_status === 'Self-Employed').length,
        unemployed: pRes.filter(r => r.employment_status === 'Unemployed').length
      };
    })
  });
});

// -------------------------------------------------------------
// Census Households Grouping Endpoint
// -------------------------------------------------------------
app.get('/api/census/households', async (req, res) => {
  const { barangay, purok } = req.query;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let whereClauses = [];
      let params = [];
      // Always restrict to verified residents only
      whereClauses.push(`LOWER(COALESCE(r.verification_status, '')) IN ('verified', 'active')`);
      if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
        // Strict barangay match — only fall back to address when barangay column is NULL/empty
        whereClauses.push(`(
          (r.barangay IS NOT NULL AND r.barangay != '' AND LOWER(r.barangay) = LOWER(?))
          OR
          (COALESCE(r.barangay, '') = '' AND LOWER(r.address) LIKE LOWER(?))
        )`);
        params.push(barangay.trim(), `%${barangay.trim()}%`);
      }
      if (purok && purok.toLowerCase() !== 'all') {
        const cleanP = purok.toString().replace(/purok\s*/i, '').trim();
        whereClauses.push(`(r.purok = ? OR r.purok = ? OR LOWER(r.address) LIKE ?)`);
        params.push(cleanP, `Purok ${cleanP}`, `%purok ${cleanP}%`);
      }

      const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

      const [rows] = await pool.query(`
        SELECT r.*,
               TIMESTAMPDIFF(YEAR, r.date_of_birth, CURDATE()) AS age
        FROM residents r
        ${whereSql}
        ORDER BY r.purok ASC, r.household_number ASC, r.is_head_of_household DESC, r.id ASC
      `, params);

      // Group by household_number
      const hhMap = new Map();
      rows.forEach(r => {
        const cleanP = (r.purok || '1').toString().replace(/purok\s*/i, '').trim();
        const hhNum = r.household_number || `HH-P${cleanP}-${String(r.id).padStart(3, '0')}`;
        const age = r.age != null ? Number(r.age) : (r.date_of_birth ? Math.max(0, new Date().getFullYear() - new Date(r.date_of_birth).getFullYear()) : 25);
        const isSenior = age >= 60;
        const isChild = age < 18;
        const emp = r.employment_status || (isSenior ? 'Retired' : (isChild ? 'Student' : 'Employed'));

        const memberObj = {
          ...r,
          age,
          purok: cleanP,
          is_senior: isSenior,
          is_child: isChild,
          employment_status: emp,
          is_head_of_household: Boolean(r.is_head_of_household)
        };

        if (!hhMap.has(hhNum)) {
          hhMap.set(hhNum, {
            household_number: hhNum,
            purok: `Purok ${cleanP}`,
            barangay: r.barangay || 'Pianing',
            family_name: r.family_name || r.last_name || 'Resident',
            head_name: r.is_head_of_household ? `${r.first_name} ${r.last_name}` : '',
            total_members: 0,
            seniors_count: 0,
            seniors_male: 0,
            seniors_female: 0,
            children_count: 0,
            employed_count: 0,
            unemployed_count: 0,
            members: []
          });
        }

        const hh = hhMap.get(hhNum);
        hh.total_members += 1;
        if (!hh.head_name || r.is_head_of_household) {
          hh.head_name = `${r.first_name} ${r.last_name}`;
        }
        if (isSenior) {
          hh.seniors_count += 1;
          if (r.gender === 'Female') hh.seniors_female += 1;
          else hh.seniors_male += 1;
        }
        if (isChild) hh.children_count += 1;
        if (emp === 'Employed' || emp === 'Self-Employed') hh.employed_count += 1;
        if (emp === 'Unemployed') hh.unemployed_count += 1;
        hh.members.push(memberObj);
      });

      return res.json(Array.from(hhMap.values()));
    } catch (err) {
      console.warn('MySQL census households error:', err.message);
    }
  }

  res.json([]);
});

// -------------------------------------------------------------
// Register New Resident / Census Intake
// -------------------------------------------------------------
app.post('/api/residents', async (req, res) => {
  const { 
    first_name, middle_name, last_name, date_of_birth, gender, civil_status, 
    years_of_residency, address, purok, phone, email, password, id_type, submitted_id,
    household_number, family_name, is_head_of_household, relationship_to_head, employment_status
  } = req.body;
  const rawPassword = password || '123';
  const cleanFirst = (first_name || '').trim();
  const cleanLast = (last_name || '').trim();
  const cleanMiddle = (middle_name || '').trim();
  const fullName = `${cleanFirst} ${cleanMiddle ? cleanMiddle + ' ' : ''}${cleanLast}`.trim();
  const residentEmail = email && email.trim() ? email.toLowerCase().trim() : null;
  const residentBarangay = (req.body.barangay || (address && address.toLowerCase().includes('anticala') ? 'Anticala' : 'Pianing')).trim();
  const residentPurok = (purok || '1').toString().replace(/purok\s*/i, '').trim();
  const residentAddress = address || `Purok ${residentPurok}, Barangay ${residentBarangay}, Butuan City`;

  const cleanFamilyName = (family_name || cleanLast || 'Resident').trim();
  const cleanHH = (household_number || `HH-P${residentPurok}-${Date.now().toString().slice(-4)}`).trim();
  const isHead = is_head_of_household ? 1 : 0;
  const relToHead = (relationship_to_head || (isHead ? 'Head' : 'Member')).trim();
  const cleanEmp = (employment_status || 'Employed').trim();

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let linkedUserId = null;
      // 1. Only create user login record if email is provided (account creation)
      if (residentEmail) {
        const [existing] = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", [residentEmail]);
        if (existing.length > 0) {
          return res.status(400).json({ success: false, message: 'An account with this email already exists. Each resident must use a unique Gmail address.' });
        }

        const hashedPassword = await hashPassword(rawPassword);
        const [userRes] = await pool.query(
          "INSERT INTO users (name, email, password_hash, role, status, verification_status, barangay, phone, last_login) VALUES (?, ?, ?, 'resident', 'Active', 'Verified', ?, ?, NOW()) ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), verification_status = 'Verified', barangay = VALUES(barangay)",
          [fullName, residentEmail, hashedPassword, residentBarangay, phone || '']
        );
        linkedUserId = userRes.insertId;
      }

      // 2. Insert into residents table with all census and civic fields
      const [result] = await pool.query(
        `INSERT INTO residents (
          first_name, middle_name, last_name, date_of_birth, gender, civil_status, 
          years_of_residency, address, purok, barangay, phone, email, id_type, 
          submitted_id, verification_status, linked_user_id,
          household_number, family_name, is_head_of_household, relationship_to_head, employment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Verified', ?, ?, ?, ?, ?, ?)`,
        [
          cleanFirst, cleanMiddle, cleanLast, date_of_birth || '2000-01-01', gender || 'Male', civil_status || 'Single',
          years_of_residency || null, residentAddress, residentPurok, residentBarangay, phone || '', residentEmail, id_type || 'Government ID',
          submitted_id || null, linkedUserId || null,
          cleanHH, cleanFamilyName, isHead, relToHead, cleanEmp
        ]
      );

      logActivity({
        user_name: 'Barangay Staff',
        user_role: 'staff',
        action: `Enrolled Resident: ${fullName}`,
        action_type: 'Resident',
        barangay: residentBarangay,
        details: `Enrolled resident ${fullName} (Household: ${cleanHH}, Purok: ${residentPurok}, Barangay: ${residentBarangay}).`
      }).catch(() => {});

      return res.status(201).json({ 
        id: result.insertId, 
        ...req.body, 
        address: residentAddress, 
        barangay: residentBarangay, 
        purok: residentPurok,
        email: residentEmail, 
        household_number: cleanHH,
        family_name: cleanFamilyName,
        is_head_of_household: Boolean(isHead),
        relationship_to_head: relToHead,
        employment_status: cleanEmp,
        verification_status: 'Verified' 
      });
    } catch (err) {
      console.warn('MySQL resident insert error:', err.message);
    }
  }

  if (residentEmail) {
    const existing = (mockData.users || []).find(u => u.email && u.email.toLowerCase() === residentEmail.toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists. Each resident must use a unique Gmail address.' });
    }
  }

  const newRes = {
    id: mockData.residents.length + 1,
    first_name: cleanFirst,
    middle_name: cleanMiddle,
    last_name: cleanLast,
    date_of_birth: date_of_birth || '2000-01-01',
    gender: gender || 'Male',
    civil_status: civil_status || 'Single',
    years_of_residency: years_of_residency || '',
    address: residentAddress,
    purok: residentPurok,
    barangay: residentBarangay,
    phone: phone || '',
    email: residentEmail,
    id_type: id_type || 'Government ID',
    submitted_id: submitted_id || null,
    household_number: cleanHH,
    family_name: cleanFamilyName,
    is_head_of_household: Boolean(isHead),
    relationship_to_head: relToHead,
    employment_status: cleanEmp,
    verification_status: 'Verified'
  };
  mockData.residents.unshift(newRes);
  if (residentEmail) {
    mockData.users.push({
      id: Date.now(),
      name: fullName,
      email: residentEmail,
      password_hash: rawPassword,
      role: 'resident',
      status: 'Active',
      barangay: residentBarangay,
      verification_status: 'Verified',
      phone: phone || ''
    });
  }

  logActivity({
    user_name: 'Barangay Staff',
    user_role: 'staff',
    action: `Enrolled Resident: ${fullName}`,
    action_type: 'Resident',
    barangay: residentBarangay,
    details: `Enrolled resident ${fullName} (Household: ${cleanHH}, Purok: ${residentPurok}, Barangay: ${residentBarangay}).`
  }).catch(() => {});

  res.status(201).json(newRes);
});

// -------------------------------------------------------------
// Health Monitoring: Immunizations
// -------------------------------------------------------------
app.get('/api/immunizations', async (req, res) => {
  const pool = getPool();
  const barangay = req.query.barangay;
  if (pool && getStatus().connected) {
    try {
      let query = "SELECT * FROM immunizations";
      const params = [];
      if (barangay) {
        query += " WHERE LOWER(TRIM(barangay)) = LOWER(TRIM(?))";
        params.push(barangay);
      }
      query += " ORDER BY id DESC";
      const [rows] = await pool.query(query, params);
      return res.json(rows);
    } catch (err) {
      console.warn('MySQL immunizations fetch error:', err.message);
    }
  }
  const result = barangay
    ? mockData.immunizations.filter(r => (r.barangay || '').toLowerCase() === barangay.toLowerCase())
    : mockData.immunizations;
  res.json(result);
});

// Helper to automatically dispense and reduce inventory stock on hand
async function dispenseInventoryItem(itemName, qty = 1, brgy = 'Pianing') {
  if (!itemName) return;
  const pool = getPool();
  const cleanName = itemName.trim();
  const quantity = Math.max(1, parseInt(qty) || 1);

  if (pool && getStatus().connected) {
    try {
      // Find closest matching inventory item in this barangay
      const [rows] = await pool.query(
        "SELECT id, item_name, stock FROM inventory WHERE barangay = ? AND (LOWER(item_name) LIKE LOWER(?) OR LOWER(?) LIKE CONCAT('%', LOWER(item_name), '%')) LIMIT 1",
        [brgy, `%${cleanName}%`, cleanName]
      );
      if (rows && rows.length > 0) {
        const item = rows[0];
        const newStock = Math.max(0, item.stock - quantity);
        const newStatus = newStock === 0 ? 'Out of Stock' : newStock < 10 ? 'Low Stock' : 'In Stock';
        await pool.query(
          "UPDATE inventory SET stock = ?, status = ? WHERE id = ?",
          [newStock, newStatus, item.id]
        );
      }
    } catch (e) {
      console.warn('DB dispense error:', e.message);
    }
  }

  // Also update in-memory mockData store
  if (mockData.inventory) {
    const item = mockData.inventory.find(i =>
      (i.barangay === brgy || !i.barangay) &&
      (i.item_name.toLowerCase().includes(cleanName.toLowerCase()) || cleanName.toLowerCase().includes(i.item_name.toLowerCase()))
    );
    if (item) {
      item.stock = Math.max(0, item.stock - quantity);
      item.status = item.stock === 0 ? 'Out of Stock' : item.stock < 10 ? 'Low Stock' : 'In Stock';
      item.updated_at = new Date().toISOString().split('T')[0];
    }
  }
}

app.post('/api/immunizations', async (req, res) => {
  const {
    child_name,
    gender,
    sex,
    guardian_name,
    parent_name,
    guardian,
    parent_phone,
    contact_number,
    phone,
    age_months,
    age,
    weight_kg,
    weight,
    height_cm,
    height,
    vaccine_name,
    vaccine_type,
    vaccine_given,
    dose_number,
    dose,
    batch_lot,
    batch_number,
    date_administered,
    date_given,
    due_date,
    next_due_date,
    remarks,
    administered_by,
    attending_nurse,
    status,
    barangay
  } = req.body;

  const childName = (child_name || '').trim();
  const childGender = gender || sex || 'Male';
  const guardianName = (guardian_name || parent_name || guardian || '').trim();
  const parentPhone = (parent_phone || contact_number || phone || '').trim();
  const ageMonths = age_months !== undefined && age_months !== null ? String(age_months) : (age || '');
  const weightKg = weight_kg || weight || '';
  const heightCm = height_cm || height || '';
  const vaccineName = vaccine_name || vaccine_type || vaccine_given || 'Pentavalent (DPT-HepB-Hib)';
  const doseNumber = dose_number || dose || 'Dose 1';
  const batchLot = batch_lot || batch_number || `LOT-${new Date().getFullYear()}-EPI`;
  const givenDate = date_administered || date_given || (status === 'Completed' ? new Date().toISOString().split('T')[0] : null);
  const nextDueDate = due_date || next_due_date || null;
  const observation = remarks || 'Cleared for routine vaccination';
  const worker = administered_by || attending_nurse || 'Nurse Maria Santos';
  const immStatus = status || (givenDate ? 'Completed' : 'Scheduled');
  const brgy = barangay || 'Pianing';

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [result] = await pool.query(
        `INSERT INTO immunizations 
         (child_name, gender, guardian_name, parent_phone, age_months, weight_kg, height_cm, vaccine_name, dose_number, batch_lot, status, date_administered, due_date, administered_by, remarks, barangay) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [childName, childGender, guardianName, parentPhone, ageMonths, weightKg, heightCm, vaccineName, doseNumber, batchLot, immStatus, givenDate, nextDueDate, worker, observation, brgy]
      );

      // Auto-archive into clinical_encounters
      try {
        await pool.query(`
          INSERT INTO clinical_encounters
          (patient_name, contact_number, age, gender, civil_status, barangay, purok, program_type, weight, height, chief_complaint, diagnosis, treatment, attending_worker, encounter_date, next_visit_date, status)
          VALUES (?, ?, ?, ?, 'Child', ?, 'Purok 1', 'NIP Immunization', ?, ?, 'Routine EPI Immunization', ?, ?, ?, CURDATE(), ?, 'Completed')
        `, [
          `${childName} (Guardian: ${guardianName || 'Parent'})`,
          parentPhone,
          ageMonths ? `${ageMonths} mos` : '',
          childGender,
          brgy,
          weightKg,
          heightCm,
          `Vaccine: ${vaccineName} (${doseNumber})`,
          `Batch: ${batchLot}. ${observation}`,
          worker,
          nextDueDate
        ]);
      } catch (archErr) {
        console.warn('Immunization auto-archive warning:', archErr.message);
      }

      // Auto-dispatch SMS + Email reminder on new immunization schedule
      if (parentPhone) {
        try {
          const smsMsg = `Barangay Health Center Alert: Recorded ${vaccineName} (${doseNumber}) for child ${childName}. Next due date: ${nextDueDate || 'as advised'}. Contact: Pianing Health Center.`;
          await pool.query(
            "INSERT INTO sms_notifications (recipient_name, recipient_phone, type, message, status) VALUES (?, ?, 'Immunization Reminder', ?, 'Sent')",
            [childName, parentPhone, smsMsg]
          );
          sendLiveSms(parentPhone, smsMsg).catch(e => console.warn('iProg SMS immunization error:', e.message));

          // Email reminder if parent_email provided
          const parentEmail = req.body.parent_email || null;
          if (parentEmail && parentEmail.includes('@')) {
            sendImmunizationReminderEmail({
              to:          parentEmail,
              childName:   childName,
              parentName:  guardianName || '',
              vaccineName: vaccineName,
              doseNumber:  doseNumber,
              dueDate:     nextDueDate || 'this week',
            }).catch(e => console.warn('[Email] Immunization reminder email error:', e.message));
          }
        } catch (smsErr) {
          console.warn('Auto SMS dispatch warning:', smsErr.message);
        }
      }

      const created = {
        id: result.insertId,
        child_name: childName,
        gender: childGender,
        guardian_name: guardianName,
        parent_phone: parentPhone,
        age_months: ageMonths,
        weight_kg: weightKg,
        height_cm: heightCm,
        vaccine_name: vaccineName,
        dose_number: doseNumber,
        batch_lot: batchLot,
        status: immStatus,
        date_administered: givenDate,
        due_date: nextDueDate,
        administered_by: worker,
        remarks: observation,
        barangay: brgy
      };

      if (!mockData.immunizations) mockData.immunizations = [];
      mockData.immunizations.unshift(created);

      // Auto-deduct vaccine units from inventory stock
      if (immStatus === 'Completed' || givenDate) {
        const vaccineQty = parseInt(req.body.dose_count || req.body.quantity || 1, 10) || 1;
        dispenseInventoryItem(vaccineName, vaccineQty, brgy).catch(e => console.warn('Vaccine dispense error:', e.message));
      }

      return res.status(201).json(created);
    } catch (err) {
      console.warn('MySQL immunization insert error:', err.message);
    }
  }

  const newImm = {
    id: (mockData.immunizations?.length || 0) + 1,
    child_name: childName,
    gender: childGender,
    guardian_name: guardianName,
    parent_phone: parentPhone,
    age_months: ageMonths,
    weight_kg: weightKg,
    height_cm: heightCm,
    vaccine_name: vaccineName,
    dose_number: doseNumber,
    batch_lot: batchLot,
    status: immStatus,
    date_administered: givenDate,
    due_date: nextDueDate,
    days_overdue: 0,
    administered_by: worker,
    remarks: observation,
    barangay: brgy
  };
  if (!mockData.immunizations) mockData.immunizations = [];
  mockData.immunizations.unshift(newImm);

  // Auto-deduct vaccine units from inventory stock
  if (immStatus === 'Completed' || givenDate) {
    const vaccineQty = parseInt(req.body.dose_count || req.body.quantity || 1, 10) || 1;
    dispenseInventoryItem(vaccineName, vaccineQty, brgy).catch(e => console.warn('Vaccine dispense error:', e.message));
  }

  res.status(201).json(newImm);
});

app.put('/api/immunizations/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { status, administered_by } = req.body;
  const today = new Date().toISOString().split('T')[0];

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query(
        "UPDATE immunizations SET status = ?, date_administered = CURDATE(), administered_by = ? WHERE id = ?",
        [status, administered_by || 'BHW Maria', id]
      );

      // ── AUTO-SCHEDULING: When dose is marked Completed, compute & insert next dose ──
      let nextDoseInfo = null;
      if (status === 'Completed') {
        const [immRows] = await pool.query("SELECT * FROM immunizations WHERE id = ?", [id]);
        const imm = immRows[0];
        if (imm) {
          const next = computeNextDose(imm.vaccine_name, imm.dose_number, today);
          nextDoseInfo = next;
          if (next.hasNext) {
            try {
              const [nextResult] = await pool.query(
                "INSERT INTO immunizations (child_name, parent_phone, vaccine_name, dose_number, status, due_date) VALUES (?, ?, ?, ?, 'Scheduled', ?)",
                [imm.child_name, imm.parent_phone || '', imm.vaccine_name, next.nextDose, next.nextDueDate]
              );
              console.log(`[Auto-Schedule] Created ${imm.vaccine_name} Dose ${next.nextDose} for ${imm.child_name} on ${next.nextDueDate}`);

              // Auto-SMS next dose reminder
              if (imm.parent_phone) {
                const nextSms = `Barangay Health Center: ${imm.child_name}'s next ${imm.vaccine_name} (Dose ${next.nextDose}) has been AUTO-SCHEDULED for ${next.displayDate}. Please bring your Baby Health Card.`;
                pool.query("INSERT INTO sms_notifications (recipient_name, recipient_phone, type, message, status) VALUES (?, ?, 'Auto-Schedule Reminder', ?, 'Sent')",
                  [imm.child_name, imm.parent_phone, nextSms]).catch(() => {});
                sendLiveSms(imm.parent_phone, nextSms).catch(e => console.warn('[SMS] Auto-schedule SMS error:', e.message));
              }

              // Auto-Email next dose reminder
              const parentEmail = req.body.parent_email || imm.parent_email || null;
              if (parentEmail && parentEmail.includes('@')) {
                sendImmunizationReminderEmail({
                  to:          parentEmail,
                  childName:   imm.child_name,
                  parentName:  req.body.parent_name || '',
                  vaccineName: imm.vaccine_name,
                  doseNumber:  next.nextDose,
                  dueDate:     next.displayDate,
                }).catch(e => console.warn('[Email] Auto-schedule email error:', e.message));
                console.log(`[Auto-Email] Next dose reminder sent to ${parentEmail}`);
              }
            } catch (schedErr) {
              console.warn('[Auto-Schedule] Could not create next dose:', schedErr.message);
            }
          }
        }
      }

      return res.json({ success: true, nextDose: nextDoseInfo });
    } catch (err) {
      console.warn('MySQL immunization update error:', err.message);
    }
  }

  // ── In-memory fallback ──
  const imm = mockData.immunizations.find(i => i.id === id);
  if (imm) {
    imm.status = status;
    imm.date_administered = today;
    imm.administered_by = administered_by || 'BHW Maria';
    imm.days_overdue = 0;

    // Auto-schedule next dose in mock data
    let nextDoseInfo = null;
    if (status === 'Completed') {
      const next = computeNextDose(imm.vaccine_name, imm.dose_number, today);
      nextDoseInfo = next;
      if (next.hasNext) {
        const nextMock = {
          id: mockData.immunizations.length + 1,
          child_name:    imm.child_name,
          parent_phone:  imm.parent_phone || '',
          vaccine_name:  imm.vaccine_name,
          dose_number:   next.nextDose,
          status:        'Scheduled',
          due_date:      next.nextDueDate,
          days_overdue:  0,
          administered_by: '',
          date_administered: null,
        };
        mockData.immunizations.unshift(nextMock);
        console.log(`[Auto-Schedule Mock] Created ${imm.vaccine_name} Dose ${next.nextDose} on ${next.nextDueDate}`);
      }
    }

    return res.json({ ...imm, nextDose: nextDoseInfo });
  }
  res.status(404).json({ error: 'Record not found' });
});

// -------------------------------------------------------------
// Health Monitoring: Maternal Records
// -------------------------------------------------------------
app.get('/api/maternal', async (req, res) => {
  const pool = getPool();
  const barangay = req.query.barangay;
  if (pool && getStatus().connected) {
    try {
      let query = "SELECT * FROM maternal_records";
      const params = [];
      if (barangay) {
        query += " WHERE LOWER(TRIM(barangay)) = LOWER(TRIM(?))";
        params.push(barangay);
      }
      query += " ORDER BY id DESC";
      const [rows] = await pool.query(query, params);
      return res.json(rows);
    } catch (err) {
      console.warn('MySQL maternal fetch error:', err.message);
    }
  }
  const result = barangay
    ? (mockData.maternal || []).filter(r => (r.barangay || '').toLowerCase() === barangay.toLowerCase())
    : (mockData.maternal || []);
  res.json(result);
});

app.post('/api/maternal', async (req, res) => {
  const {
    mother_name,
    patient_name,
    age,
    pregnancy_status,
    expected_due_date,
    last_visit,
    next_visit,
    risk_level,
    notes,
    mother_email,
    mother_phone,
    contact_number,
    barangay,
    gravida,
    para,
    lmp,
    edd,
    aog_weeks,
    bp,
    weight,
    temp,
    fetal_heart_rate,
    fundic_height,
    prescribed_meds,
    attending_nurse,
    next_visit_date
  } = req.body;

  // ── AUTO-SCHEDULING: compute next visit if not provided ──
  let computedNextVisit = next_visit;
  let scheduleInfo = null;
  if (!next_visit && pregnancy_status) {
    const auto = computeNextMaternalVisit(pregnancy_status, last_visit, expected_due_date);
    computedNextVisit = auto.nextVisit;
    scheduleInfo = auto;
    console.log(`[Auto-Schedule Maternal] Next visit auto-set to ${auto.nextVisit} (${auto.interval}) for ${mother_name || patient_name}`);
  }

  const momName = (mother_name || patient_name || '').trim();
  const phone = contact_number || mother_phone || '';
  const brgy = barangay || 'Pianing';
  const lastVisit = last_visit || lmp || new Date().toISOString().split('T')[0];
  const nextVisit = next_visit || next_visit_date || computedNextVisit || null;
  const nurse = attending_nurse || 'Nurse Maria Santos';

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let resId = req.body.resident_id;
      if (!resId && momName) {
        const [matched] = await pool.query(
          "SELECT id FROM residents WHERE LOWER(CONCAT(first_name, ' ', last_name)) = LOWER(?) OR LOWER(first_name) = LOWER(?) LIMIT 1",
          [momName, momName]
        );
        resId = matched[0]?.id;
      }
      if (!resId) {
        const [anyRes] = await pool.query("SELECT id FROM residents ORDER BY id ASC LIMIT 1");
        resId = anyRes[0]?.id || 2;
      }

      const validNextVisit = nextVisit || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

      const [result] = await pool.query(
        `INSERT INTO maternal_records 
         (resident_id, mother_name, age, pregnancy_status, expected_due_date, last_visit, next_visit, risk_level, notes, contact_number, barangay, gravida, para, lmp, edd, aog_weeks, bp, weight, temp, fetal_heart_rate, fundic_height, prescribed_meds, attending_nurse, next_visit_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resId, momName, Number(age) || 25, pregnancy_status || '1st Trimester', expected_due_date || edd || null,
          lastVisit, validNextVisit, risk_level || 'Low', notes || `AOG: ${aog_weeks || '—'} wks. Meds: ${prescribed_meds || 'Vitamins'}`,
          phone, brgy, Number(gravida) || 1, Number(para) || 0, lmp || null, edd || null,
          aog_weeks || '', bp || '120/80', weight || '', temp || '36.5',
          fetal_heart_rate || '', fundic_height || '', prescribed_meds || '', nurse, validNextVisit
        ]
      );

      // Auto-archive in clinical_encounters
      try {
        await pool.query(`
          INSERT INTO clinical_encounters
          (patient_name, contact_number, age, gender, civil_status, barangay, purok, program_type, bp, temp, weight, chief_complaint, diagnosis, treatment, prescribed_meds, attending_worker, encounter_date, next_visit_date, status)
          VALUES (?, ?, ?, 'Female', 'Married', ?, 'Purok 1', 'Prenatal', ?, ?, ?, 'Routine Prenatal Consultation', ?, ?, ?, ?, CURDATE(), ?, 'Completed')
        `, [
          momName, phone, age || '25', brgy, bp || '120/80', temp || '36.5', weight || '',
          `Prenatal Care (${pregnancy_status || 'Routine'}). Gravida: ${gravida || 1}, Para: ${para || 0}`,
          `AOG: ${aog_weeks || '—'} wks. FHR: ${fetal_heart_rate || 'Normal'}. Fundic Height: ${fundic_height || 'Normal'}`,
          prescribed_meds || 'Iron + Folic Acid', nurse, nextVisit
        ]);
      } catch (archErr) {
        console.warn('Maternal auto-archive warning:', archErr.message);
      }

      // Auto-Email maternal reminder if email provided
      if (mother_email && mother_email.includes('@')) {
        sendMaternalReminderEmail({
          to:              mother_email,
          motherName:      momName,
          nextVisit:       nextVisit || 'to be scheduled',
          pregnancyStatus: pregnancy_status || 'Prenatal Care',
          riskLevel:       risk_level || 'Low',
          notes:           scheduleInfo?.recommendation || notes || '',
        }).catch(e => console.warn('[Email] Maternal reminder email error:', e.message));
      }

      // Auto-dispense maternal medicine / vitamins from inventory
      if (prescribed_meds) {
        const pQty = parseInt(req.body.med_quantity || req.body.quantity || 30, 10) || 1;
        dispenseInventoryItem(prescribed_meds, pQty, brgy).catch(e => console.warn('Maternal dispense error:', e.message));
      }

      const created = {
        id: result.insertId,
        mother_name: momName,
        age: Number(age) || 25,
        pregnancy_status: pregnancy_status || '1st Trimester',
        expected_due_date: expected_due_date || edd || null,
        last_visit: lastVisit,
        next_visit: nextVisit,
        risk_level: risk_level || 'Low',
        notes: notes || '',
        contact_number: phone,
        barangay: brgy,
        gravida,
        para,
        lmp,
        edd,
        aog_weeks,
        bp,
        weight,
        temp,
        fetal_heart_rate,
        fundic_height,
        prescribed_meds,
        attending_nurse: nurse,
        next_visit_date: nextVisit,
        auto_schedule: scheduleInfo,
      };

      if (!mockData.maternal) mockData.maternal = [];
      mockData.maternal.unshift(created);

      return res.status(201).json(created);
    } catch (err) {
      console.warn('MySQL maternal insert error:', err.message);
    }
  }

  const newMaternal = {
    id: Date.now(),
    mother_name,
    age: age || 25,
    pregnancy_status: pregnancy_status || 'Prenatal',
    expected_due_date: expected_due_date || edd || null,
    last_visit: lastVisit,
    next_visit: nextVisit,
    risk_level: risk_level || 'Low',
    notes: notes || '',
    contact_number: phone,
    barangay: brgy,
    gravida,
    para,
    lmp,
    edd,
    aog_weeks,
    bp,
    weight,
    temp,
    fetal_heart_rate,
    fundic_height,
    prescribed_meds,
    attending_nurse: nurse,
    next_visit_date: nextVisit,
  };
  if (!mockData.maternal) mockData.maternal = [];
  mockData.maternal.unshift(newMaternal);
  return res.status(201).json(newMaternal);
});

// -------------------------------------------------------------
// Clinical Consultations Endpoints
// -------------------------------------------------------------
app.get('/api/consultations', async (req, res) => {
  const pool = getPool();
  const brgy = req.query.barangay;
  const program = req.query.program_type;
  if (pool && getStatus().connected) {
    try {
      let query = "SELECT * FROM clinical_encounters WHERE 1=1";
      const params = [];
      if (program && program !== 'All') {
        query += " AND LOWER(program_type) = LOWER(?)";
        params.push(program);
      }
      if (brgy && brgy !== 'All' && !brgy.toLowerCase().includes('city-wide')) {
        query += " AND LOWER(barangay) = LOWER(?)";
        params.push(brgy);
      }
      query += " ORDER BY encounter_date DESC, id DESC";
      const [rows] = await pool.query(query, params);
      return res.json(rows);
    } catch (err) {
      console.warn('MySQL consultations fetch error:', err.message);
    }
  }
  let results = mockData.consultations || [];
  if (brgy && brgy !== 'All' && !brgy.toLowerCase().includes('city-wide')) {
    results = results.filter(c => (c.barangay || '').toLowerCase() === brgy.toLowerCase());
  }
  if (program && program !== 'All') {
    results = results.filter(c => (c.program_type || '').toLowerCase() === program.toLowerCase());
  }
  res.json(results);
});

app.post('/api/consultations', async (req, res) => {
  const {
    patient_name,
    contact_number,
    phone,
    age,
    gender,
    civil_status,
    barangay,
    purok,
    program_type,
    service_type,
    bp,
    temp,
    weight,
    height,
    heart_rate,
    chief_complaint,
    diagnosis,
    treatment,
    prescribed_meds,
    attending_nurse,
    attending_worker,
    consultation_date,
    next_visit_date,
    status
  } = req.body;

  const name = (patient_name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Patient name is required' });
  }

  const phoneNum = contact_number || phone || '';
  const worker = attending_nurse || attending_worker || 'Nurse Maria Santos';
  const brgy = barangay || 'Pianing';
  const encDate = consultation_date || new Date().toISOString().split('T')[0];
  const stat = status || 'Completed';
  const progType = program_type || service_type || 'General Consultation';

  let formattedMeds = prescribed_meds || '';
  if (!formattedMeds && Array.isArray(req.body.prescriptions) && req.body.prescriptions.length > 0) {
    formattedMeds = req.body.prescriptions.map(p => {
      const qStr = `(Qty: ${p.quantity || 1} ${p.unit || 'units'})`;
      const freq = p.frequency ? ` - ${p.frequency}` : '';
      const dur = p.duration ? ` x ${p.duration}` : '';
      return `${p.name} ${p.dosage || ''}${freq}${dur} ${qStr}`.trim();
    }).join('; ');
  }

  const newRecord = {
    id: Date.now(),
    patient_name: name,
    contact_number: phoneNum,
    age: age || '—',
    gender: gender || 'Female',
    civil_status: civil_status || 'Single',
    barangay: brgy,
    purok: purok || 'Purok 1',
    program_type: progType,
    service_type: progType,
    bp: bp || '120/80',
    temp: temp || '36.5',
    weight: weight || '',
    height: height || '',
    heart_rate: heart_rate || '',
    chief_complaint: chief_complaint || 'Routine Health Visit',
    diagnosis: diagnosis || 'Assessment Complete',
    treatment: treatment || 'Health counseling advised.',
    prescribed_meds: formattedMeds,
    attending_nurse: worker,
    attending_worker: worker,
    consultation_date: encDate,
    encounter_date: encDate,
    next_visit_date: next_visit_date || null,
    status: stat
  };

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [result] = await pool.query(`
        INSERT INTO clinical_encounters 
        (patient_name, contact_number, age, gender, civil_status, barangay, purok, program_type, bp, temp, weight, height, heart_rate, chief_complaint, diagnosis, treatment, prescribed_meds, attending_worker, encounter_date, next_visit_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        name, phoneNum, age || '—', gender || 'Female', civil_status || 'Single',
        brgy, purok || 'Purok 1', progType, bp || '120/80', temp || '36.5', weight || '', height || '', heart_rate || '',
        chief_complaint || 'Routine Health Visit', diagnosis || 'Assessment Complete', treatment || 'Health counseling advised.',
        formattedMeds || '', worker, encDate, next_visit_date || null, stat
      ]);
      newRecord.id = result.insertId;
    } catch (err) {
      console.warn('MySQL consultation insert error:', err.message);
    }
  }

  if (!mockData.consultations) mockData.consultations = [];
  mockData.consultations.unshift(newRecord);

  // Auto-deduct any prescribed medications from inventory
  if (req.body.prescriptions && Array.isArray(req.body.prescriptions)) {
    for (const rx of req.body.prescriptions) {
      if (rx && rx.name) {
        dispenseInventoryItem(rx.name, rx.quantity || rx.qty || 1, brgy).catch(e => console.warn('Consultation dispense error:', e.message));
      }
    }
  } else if (prescribed_meds) {
    const medsList = prescribed_meds.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    for (const medStr of medsList) {
      dispenseInventoryItem(medStr, 1, brgy).catch(e => console.warn('Consultation dispense error:', e.message));
    }
  }

  return res.status(201).json(newRecord);
});

// -------------------------------------------------------------
// Inventory Management Endpoints (Medicines & Vaccines for Nurse & BHW)
// -------------------------------------------------------------
app.get('/api/inventory', async (req, res) => {
  const brgy = req.query.barangay || 'Pianing';
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [rows] = await pool.query('SELECT * FROM inventory WHERE barangay = ? ORDER BY category, item_name', [brgy]);
      if (rows && rows.length > 0) return res.json(rows);
    } catch (e) {
      console.warn('Inventory fetch warning:', e.message);
    }
  }
  const items = (mockData.inventory || []).filter(i => !i.barangay || i.barangay === brgy);
  res.json(items);
});

app.post('/api/inventory', async (req, res) => {
  const { item_name, category, stock, unit, expiry_date, barangay } = req.body;
  const name = (item_name || '').trim();
  if (!name) return res.status(400).json({ error: 'Item name is required' });
  const brgy = barangay || 'Pianing';
  const qty = parseInt(stock) || 0;
  const cat = category || 'Essential Medicine';
  const u = unit || 'units';
  const exp = expiry_date || '';
  const stat = qty === 0 ? 'Out of Stock' : qty < 10 ? 'Low Stock' : 'In Stock';

  const pool = getPool();
  let createdId = Date.now();
  if (pool && getStatus().connected) {
    try {
      const [existing] = await pool.query('SELECT id, stock FROM inventory WHERE barangay = ? AND LOWER(item_name) = LOWER(?)', [brgy, name]);
      if (existing && existing.length > 0) {
        const newStock = existing[0].stock + qty;
        const newStat = newStock === 0 ? 'Out of Stock' : newStock < 10 ? 'Low Stock' : 'In Stock';
        await pool.query('UPDATE inventory SET stock = ?, status = ?, expiry_date = COALESCE(?, expiry_date) WHERE id = ?', [newStock, newStat, exp || null, existing[0].id]);
        return res.json({ message: 'Item restocked successfully', id: existing[0].id, item_name: name, stock: newStock, status: newStat });
      }
      const [result] = await pool.query(
        'INSERT INTO inventory (barangay, item_name, category, stock, unit, expiry_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [brgy, name, cat, qty, u, exp, stat]
      );
      createdId = result.insertId;
    } catch (e) {
      console.warn('DB inventory insert warning:', e.message);
    }
  }

  if (!mockData.inventory) mockData.inventory = [];
  const existingMock = mockData.inventory.find(i => (i.barangay === brgy || !i.barangay) && i.item_name.toLowerCase() === name.toLowerCase());
  if (existingMock) {
    existingMock.stock += qty;
    existingMock.status = existingMock.stock === 0 ? 'Out of Stock' : existingMock.stock < 10 ? 'Low Stock' : 'In Stock';
    if (exp) existingMock.expiry_date = exp;
    return res.json({ message: 'Item restocked successfully', ...existingMock });
  }

  const newItem = {
    id: createdId,
    barangay: brgy,
    item_name: name,
    category: cat,
    stock: qty,
    unit: u,
    expiry_date: exp,
    status: stat,
    updated_at: new Date().toISOString().split('T')[0]
  };
  mockData.inventory.unshift(newItem);
  res.status(201).json(newItem);
});

app.put('/api/inventory/:id', async (req, res) => {
  const id = req.params.id;
  const { stock, item_name, category, unit, expiry_date, status } = req.body;
  const qty = parseInt(stock);
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query(
        'UPDATE inventory SET stock = COALESCE(?, stock), status = COALESCE(?, status), expiry_date = COALESCE(?, expiry_date) WHERE id = ?',
        [isNaN(qty) ? null : qty, status || null, expiry_date || null, id]
      );
    } catch (e) {
      console.warn('DB inventory update warning:', e.message);
    }
  }
  if (mockData.inventory) {
    const item = mockData.inventory.find(i => String(i.id) === String(id));
    if (item) {
      if (!isNaN(qty)) item.stock = qty;
      if (status) item.status = status;
      else if (!isNaN(qty)) item.status = qty === 0 ? 'Out of Stock' : qty < 10 ? 'Low Stock' : 'In Stock';
      if (expiry_date) item.expiry_date = expiry_date;
      if (item_name) item.item_name = item_name;
      if (category) item.category = category;
      if (unit) item.unit = unit;
      return res.json(item);
    }
  }
  res.json({ success: true });
});

app.delete('/api/inventory/:id', async (req, res) => {
  const id = req.params.id;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query('DELETE FROM inventory WHERE id = ?', [id]);
    } catch (e) {
      console.warn('DB inventory delete warning:', e.message);
    }
  }
  if (mockData.inventory) {
    mockData.inventory = mockData.inventory.filter(i => String(i.id) !== String(id));
  }
  res.json({ success: true, message: 'Item deleted' });
});

app.post('/api/inventory/dispense', async (req, res) => {
  const { item_name, quantity, barangay } = req.body;
  const qty = parseInt(quantity) || 1;
  const brgy = barangay || 'Pianing';
  await dispenseInventoryItem(item_name, qty, brgy);
  res.json({ success: true, message: `Dispensed ${qty} unit(s) of ${item_name}` });
});

// -------------------------------------------------------------
// Health Appointments Endpoints (Pre-Marriage, Prenatal, Immunization, etc.)
// -------------------------------------------------------------
app.get('/api/appointments', async (req, res) => {
  const { resident_id, email, status, barangay } = req.query;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let query = "SELECT * FROM health_appointments WHERE 1=1";
      const params = [];

      if (resident_id) {
        query += " AND resident_id = ?";
        params.push(resident_id);
      }
      if (email) {
        query += " AND (LOWER(resident_email) = LOWER(?) OR resident_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER(?)))";
        params.push(email, email);
      }
      if (status && status !== 'all') {
        query += " AND status = ?";
        params.push(status);
      }
      if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
        query += " AND LOWER(barangay) = LOWER(?)";
        params.push(barangay);
      }

      query += " ORDER BY id DESC";
      const [rows] = await pool.query(query, params);
      const cleanRows = rows.map(r => ({
        ...r,
        preferred_date: r.preferred_date ? (typeof r.preferred_date === 'string' ? r.preferred_date.split('T')[0] : `${r.preferred_date.getFullYear()}-${String(r.preferred_date.getMonth() + 1).padStart(2, '0')}-${String(r.preferred_date.getDate()).padStart(2, '0')}`) : null,
        scheduled_date: r.scheduled_date ? (typeof r.scheduled_date === 'string' ? r.scheduled_date.split('T')[0] : `${r.scheduled_date.getFullYear()}-${String(r.scheduled_date.getMonth() + 1).padStart(2, '0')}-${String(r.scheduled_date.getDate()).padStart(2, '0')}`) : null
      }));
      return res.json(cleanRows);
    } catch (err) {
      console.warn('MySQL appointments fetch error:', err.message);
    }
  }

  // In-Memory Fallback
  let results = [...(mockData.appointments || [])];
  if (resident_id) {
    results = results.filter(a => String(a.resident_id) === String(resident_id));
  }
  if (email) {
    const em = email.toLowerCase().trim();
    results = results.filter(a => (a.resident_email || '').toLowerCase().trim() === em);
  }
  if (status && status !== 'all') {
    results = results.filter(a => a.status === status);
  }
  if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
    results = results.filter(a => (a.barangay || 'Pianing').toLowerCase() === barangay.toLowerCase());
  }
  res.json(results);
});

app.post('/api/appointments', async (req, res) => {
  const {
    resident_id,
    resident_name,
    resident_phone,
    resident_email,
    barangay,
    service_type,
    preferred_date,
    preferred_time,
    resident_notes,
    status
  } = req.body;

  // Identification requirement: resident_id or resident_email must be present
  const cleanEmail = (resident_email || '').trim().toLowerCase();
  if (!resident_id && !cleanEmail) {
    return res.status(400).json({
      success: false,
      message: 'Resident identification (ID or email) is required to schedule an appointment.'
    });
  }

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      // ─── STRICT RESIDENT VERIFICATION ENFORCEMENT ───
      // Online clinic appointment booking is strictly restricted to verified residents of the Barangay.
      let residentRecord = null;

      if (resident_id) {
        const [rRows] = await pool.query(
          "SELECT id, verification_status, email FROM residents WHERE id = ? LIMIT 1",
          [resident_id]
        );
        if (rRows.length > 0) {
          residentRecord = rRows[0];
        } else {
          const [uRows] = await pool.query(
            "SELECT id, verification_status, email FROM users WHERE id = ? LIMIT 1",
            [resident_id]
          );
          if (uRows.length > 0) residentRecord = uRows[0];
        }
      }

      if (!residentRecord && cleanEmail) {
        const [rRows] = await pool.query(
          "SELECT id, verification_status, email FROM residents WHERE LOWER(email) = ? LIMIT 1",
          [cleanEmail]
        );
        if (rRows.length > 0) {
          residentRecord = rRows[0];
        } else {
          const [uRows] = await pool.query(
            "SELECT id, verification_status, email FROM users WHERE LOWER(email) = ? LIMIT 1",
            [cleanEmail]
          );
          if (uRows.length > 0) residentRecord = uRows[0];
        }
      }

      if (!residentRecord) {
        return res.status(403).json({
          success: false,
          message: 'Account verification required. No registered resident account was found for this identification. Please register and submit your Barangay ID for verification before booking clinic appointments.'
        });
      }

      const vStatus = residentRecord.verification_status;
      if (vStatus !== 'Verified') {
        const readableStatus = (vStatus === 'Pending_Review' || vStatus === 'Pending')
          ? 'pending review by Barangay Officials'
          : vStatus === 'Rejected'
          ? 'rejected due to invalid or illegible ID'
          : 'unverified';
        return res.status(403).json({
          success: false,
          message: `Residency verification required. Your resident account is currently ${readableStatus}. Only residents verified by Barangay Officials can schedule health center appointments.`
        });
      }

      const aptCode = `APT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      const cleanPrefDate = preferred_date ? preferred_date.split('T')[0] : null;
      const safeResidentName = sanitizeInput(resident_name) || 'Resident';
      const safeNotes = sanitizeInput(resident_notes || '');

      // Concurrency & Double Booking Protection: check if resident already has an active booking for this service and date
      if (cleanPrefDate && service_type && (cleanEmail || resident_id || residentRecord?.id)) {
        const [existingApt] = await pool.query(
          `SELECT id, appointment_code FROM health_appointments 
           WHERE (LOWER(resident_email) = LOWER(?) OR resident_id = ?) 
             AND preferred_date = ? 
             AND LOWER(service_type) = LOWER(?) 
             AND status IN ('Pending', 'Approved') 
           LIMIT 1`,
          [cleanEmail, resident_id || residentRecord?.id || 0, cleanPrefDate, service_type.trim()]
        );
        if (existingApt.length > 0) {
          return res.status(409).json({
            success: false,
            message: `You already have an active appointment (${existingApt[0].appointment_code}) booked for ${service_type} on ${cleanPrefDate}.`
          });
        }
      }

      const [result] = await pool.query(
        `INSERT INTO health_appointments 
         (appointment_code, resident_id, resident_name, resident_phone, resident_email, barangay, service_type, preferred_date, preferred_time, resident_notes, status, scheduled_date, scheduled_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          aptCode,
          resident_id || residentRecord.id || null,
          safeResidentName,
          resident_phone || '',
          cleanEmail,
          barangay || 'Pianing',
          service_type,
          cleanPrefDate,
          preferred_time || 'Morning',
          safeNotes,
          status || 'Pending',
          cleanPrefDate,
          preferred_time || '09:00 AM'
        ]
      );

      const [rows] = await pool.query("SELECT * FROM health_appointments WHERE id = ?", [result.insertId]);
      const created = rows[0] || {
        id: result.insertId,
        appointment_code: aptCode,
        resident_name,
        service_type,
        preferred_date: cleanPrefDate,
        scheduled_date: cleanPrefDate,
        status: status || 'Pending'
      };
      if (created.preferred_date && typeof created.preferred_date !== 'string') {
        created.preferred_date = `${created.preferred_date.getFullYear()}-${String(created.preferred_date.getMonth() + 1).padStart(2, '0')}-${String(created.preferred_date.getDate()).padStart(2, '0')}`;
      }
      if (created.scheduled_date && typeof created.scheduled_date !== 'string') {
        created.scheduled_date = `${created.scheduled_date.getFullYear()}-${String(created.scheduled_date.getMonth() + 1).padStart(2, '0')}-${String(created.scheduled_date.getDate()).padStart(2, '0')}`;
      }

      return res.status(201).json(created);
    } catch (err) {
      console.warn('MySQL appointment create error:', err.message);
    }
  }

  // Fallback in memory verification check
  const memUser = (mockData.users || []).find(u => (resident_id && u.id === resident_id) || (cleanEmail && (u.email || '').toLowerCase() === cleanEmail));
  const memRes = (mockData.residents || []).find(r => (resident_id && r.id === resident_id) || (cleanEmail && (r.email || '').toLowerCase() === cleanEmail));
  const memPending = (mockData.pendingRegistrations || []).find(p => (resident_id && p.id === resident_id) || (cleanEmail && (p.email || '').toLowerCase() === cleanEmail));
  const memRecord = memRes || memUser || memPending;

  if (!memRecord) {
    return res.status(403).json({
      success: false,
      message: 'Account verification required. Please register and submit your Barangay ID for verification before booking clinic appointments.'
    });
  }

  if (memRecord.verification_status !== 'Verified') {
    return res.status(403).json({
      success: false,
      message: 'Residency verification required. Your account is not verified. Only residents verified by Barangay Officials can schedule health center appointments.'
    });
  }

  const aptCode = `APT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const cleanPrefDate = preferred_date ? preferred_date.split('T')[0] : null;

  if (cleanPrefDate && service_type && (cleanEmail || resident_id || memRecord?.id)) {
    const existingMem = (mockData.appointments || []).find(a =>
      ((cleanEmail && (a.resident_email || '').toLowerCase() === cleanEmail) || (resident_id && a.resident_id === resident_id)) &&
      a.preferred_date === cleanPrefDate &&
      (a.service_type || '').toLowerCase() === service_type.toLowerCase() &&
      (a.status === 'Pending' || a.status === 'Approved')
    );
    if (existingMem) {
      return res.status(409).json({
        success: false,
        message: `You already have an active appointment (${existingMem.appointment_code}) booked for ${service_type} on ${cleanPrefDate}.`
      });
    }
  }

  const newApt = {
    id: (mockData.appointments?.length || 0) + 1,
    appointment_code: aptCode,
    resident_id: resident_id || memRecord.id || null,
    resident_name: sanitizeInput(resident_name) || 'Resident',
    resident_phone: resident_phone || '',
    resident_email: cleanEmail,
    barangay: barangay || 'Pianing',
    service_type,
    preferred_date: cleanPrefDate,
    preferred_time: preferred_time || 'Morning',
    scheduled_date: cleanPrefDate,
    scheduled_time: preferred_time || '09:00 AM',
    resident_notes: sanitizeInput(resident_notes || ''),
    status: status || 'Pending',
    attending_bhw: 'Nurse Maria Santos (RN)',
    created_at: new Date().toISOString()
  };
  mockData.appointments = mockData.appointments || [];
  mockData.appointments.unshift(newApt);
  res.status(201).json(newApt);
});

app.put('/api/appointments/:id', async (req, res) => {
  const id = Number(req.params.id);
  const {
    status,
    scheduled_date,
    scheduled_time,
    bhw_notes,
    attending_bhw,
    user_name,
    user_role
  } = req.body;

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [existingRows] = await pool.query("SELECT * FROM health_appointments WHERE id = ?", [id]);
      const apt = existingRows[0];
      const cleanSchedDate = scheduled_date ? (typeof scheduled_date === 'string' ? scheduled_date.split('T')[0] : scheduled_date) : null;

      await pool.query(
        `UPDATE health_appointments 
         SET status = COALESCE(?, status),
             scheduled_date = COALESCE(?, scheduled_date),
             scheduled_time = COALESCE(?, scheduled_time),
             bhw_notes = COALESCE(?, bhw_notes),
             attending_bhw = COALESCE(?, attending_bhw)
         WHERE id = ?`,
        [status, cleanSchedDate, scheduled_time || null, bhw_notes, attending_bhw, id]
      );

      if (apt) {
        const finalStatus = status || apt.status;
        const finalDate = cleanSchedDate || apt.scheduled_date || apt.preferred_date;
        const finalTime = scheduled_time || apt.scheduled_time || apt.preferred_time;

        // Auto-dispatch SMS & Email notifications on confirmation / status change
        if (apt.resident_phone) {
          let smsText = `Barangay Health Center Update: Your appointment for ${apt.service_type} (Ref: ${apt.appointment_code}) is ${finalStatus.toUpperCase()}.`;
          if (finalStatus === 'Approved') {
            smsText = `Barangay Health Center: Your ${apt.service_type} appointment is CONFIRMED for ${finalDate} at ${finalTime}. Please bring a valid ID.`;
          }
          sendLiveSms(apt.resident_phone, smsText).catch(() => {});
        }

        if (apt.resident_email && apt.resident_email.includes('@')) {
          sendAppointmentStatusEmail({
            to: apt.resident_email,
            recipientName: apt.resident_name,
            serviceType: apt.service_type,
            appointmentCode: apt.appointment_code,
            status: finalStatus,
            scheduledDate: finalDate,
            scheduledTime: finalTime,
            bhwNotes: bhw_notes || apt.bhw_notes,
            attendingBhw: attending_bhw || apt.attending_bhw
          }).catch(() => {});
        }

        // Activity log
        logActivity({
          userName: user_name || 'BHW Maria Santos',
          userRole: user_role || 'bhw',
          action: `Updated Health Appointment (${apt.appointment_code})`,
          actionType: 'Health',
          barangay: apt.barangay || 'Pianing',
          details: `Set status to ${finalStatus} for ${apt.resident_name} (${apt.service_type})`
        });
      }

      const [updatedRows] = await pool.query("SELECT * FROM health_appointments WHERE id = ?", [id]);
      const updatedApt = updatedRows[0] || {};
      if (updatedApt.preferred_date && typeof updatedApt.preferred_date !== 'string') {
        updatedApt.preferred_date = `${updatedApt.preferred_date.getFullYear()}-${String(updatedApt.preferred_date.getMonth() + 1).padStart(2, '0')}-${String(updatedApt.preferred_date.getDate()).padStart(2, '0')}`;
      }
      if (updatedApt.scheduled_date && typeof updatedApt.scheduled_date !== 'string') {
        updatedApt.scheduled_date = `${updatedApt.scheduled_date.getFullYear()}-${String(updatedApt.scheduled_date.getMonth() + 1).padStart(2, '0')}-${String(updatedApt.scheduled_date.getDate()).padStart(2, '0')}`;
      }

      return res.json({ success: true, message: 'Appointment updated successfully.', ...updatedApt, appointment: updatedApt });
    } catch (err) {
      console.warn('MySQL appointment update error:', err.message);
    }
  }

  // In-memory fallback
  const apt = (mockData.appointments || []).find(a => a.id === id);
  if (apt) {
    if (status) apt.status = status;
    if (scheduled_date) apt.scheduled_date = scheduled_date;
    if (scheduled_time) apt.scheduled_time = scheduled_time;
    if (bhw_notes !== undefined) apt.bhw_notes = bhw_notes;
    if (attending_bhw) apt.attending_bhw = attending_bhw;
    return res.json(apt);
  }
  res.status(404).json({ error: 'Appointment not found' });
});

app.delete('/api/appointments/:id', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query("DELETE FROM health_appointments WHERE id = ?", [id]);
      return res.json({ success: true });
    } catch (err) {
      console.warn('MySQL appointment delete error:', err.message);
    }
  }
  mockData.appointments = (mockData.appointments || []).filter(a => a.id !== id);
  res.json({ success: true });
});

// -------------------------------------------------------------
// Clinic Schedules Endpoints (Posted by BHW / Admin)
// -------------------------------------------------------------
app.get('/api/clinic-schedules', async (req, res) => {
  const { barangay } = req.query;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let query = "SELECT * FROM clinic_schedules WHERE 1=1";
      const params = [];
      if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
        query += " AND LOWER(barangay) = LOWER(?)";
        params.push(barangay);
      }
      query += " ORDER BY id ASC";
      const [rows] = await pool.query(query, params);
      return res.json(rows);
    } catch (err) {
      console.warn('MySQL clinic schedules fetch error:', err.message);
    }
  }
  let results = [...(mockData.clinicSchedules || [])];
  if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
    results = results.filter(s => (s.barangay || 'Pianing').toLowerCase() === barangay.toLowerCase());
  }
  res.json(results);
});

app.post('/api/clinic-schedules', async (req, res) => {
  const {
    title,
    service_type,
    day_of_week,
    time_slot,
    location,
    slots_available,
    bhw_in_charge,
    barangay,
    created_by
  } = req.body;

  const bgy = barangay || 'Pianing';

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [result] = await pool.query(
        `INSERT INTO clinic_schedules 
         (title, service_type, day_of_week, time_slot, location, slots_available, bhw_in_charge, status, barangay, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)`,
        [title, service_type, day_of_week, time_slot, location || 'Barangay Health Center', slots_available || 20, bhw_in_charge || 'BHW on Duty', bgy, created_by || 'BHW Staff']
      );

      logActivity({
        userName: created_by || 'Health Center Staff',
        userRole: 'bhw',
        action: `Published Clinic Schedule: ${title}`,
        actionType: 'Health',
        barangay: bgy,
        details: `Added new regular clinic schedule for ${service_type} (${day_of_week}, ${time_slot})`
      });

      return res.status(201).json({ id: result.insertId, status: 'Active', ...req.body });
    } catch (err) {
      console.warn('MySQL clinic schedule insert error:', err.message);
    }
  }

  const newSch = {
    id: (mockData.clinicSchedules?.length || 0) + 1,
    title,
    service_type,
    day_of_week,
    time_slot,
    location: location || 'Barangay Health Center',
    slots_available: Number(slots_available) || 20,
    bhw_in_charge: bhw_in_charge || 'BHW on Duty',
    status: 'Active',
    barangay: bgy,
    created_by: created_by || 'BHW Staff',
    created_at: new Date().toISOString().split('T')[0]
  };

  mockData.clinicSchedules = mockData.clinicSchedules || [];
  mockData.clinicSchedules.push(newSch);
  res.status(201).json(newSch);
});

app.put('/api/clinic-schedules/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { title, service_type, day_of_week, time_slot, location, slots_available, bhw_in_charge, status } = req.body;

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query(
        `UPDATE clinic_schedules 
         SET title = COALESCE(?, title),
             service_type = COALESCE(?, service_type),
             day_of_week = COALESCE(?, day_of_week),
             time_slot = COALESCE(?, time_slot),
             location = COALESCE(?, location),
             slots_available = COALESCE(?, slots_available),
             bhw_in_charge = COALESCE(?, bhw_in_charge),
             status = COALESCE(?, status)
         WHERE id = ?`,
        [title, service_type, day_of_week, time_slot, location, slots_available, bhw_in_charge, status, id]
      );
      return res.json({ success: true });
    } catch (err) {
      console.warn('MySQL clinic schedule update error:', err.message);
    }
  }

  const sch = (mockData.clinicSchedules || []).find(s => s.id === id);
  if (sch) {
    if (title) sch.title = title;
    if (service_type) sch.service_type = service_type;
    if (day_of_week) sch.day_of_week = day_of_week;
    if (time_slot) sch.time_slot = time_slot;
    if (location) sch.location = location;
    if (slots_available !== undefined) sch.slots_available = slots_available;
    if (bhw_in_charge) sch.bhw_in_charge = bhw_in_charge;
    if (status) sch.status = status;
    return res.json(sch);
  }
  res.status(404).json({ error: 'Schedule not found' });
});

app.delete('/api/clinic-schedules/:id', async (req, res) => {
  const id = Number(req.params.id);
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query("DELETE FROM clinic_schedules WHERE id = ?", [id]);
      return res.json({ success: true });
    } catch (err) {
      console.warn('MySQL clinic schedule delete error:', err.message);
    }
  }
  mockData.clinicSchedules = (mockData.clinicSchedules || []).filter(s => s.id !== id);
  res.json({ success: true });
});

// -------------------------------------------------------------
// SMS Notifications
// -------------------------------------------------------------
app.get('/api/notifications', async (req, res) => {
  const { department, role } = req.query;
  const isHealth = department === 'health' || role === 'bhw' || role === 'nurse';
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let query = "SELECT * FROM sms_notifications";
      if (isHealth) {
        query += " WHERE type NOT IN ('Account Verified', 'ID Correction Notice', 'Clearance Ready', 'Document Ready', 'Permit Approved') AND message NOT LIKE '%clearances, business permits%' AND message NOT LIKE '%resident account application%'";
      }
      query += " ORDER BY id DESC";
      const [rows] = await pool.query(query);
      return res.json(rows);
    } catch (err) {
      console.warn('MySQL notifications fetch error:', err.message);
    }
  }
  let results = [...(mockData.notifications || [])];
  if (isHealth) {
    results = results.filter(n => {
      const t = (n.type || '').toLowerCase();
      const m = (n.message || '').toLowerCase();
      return !t.includes('account verified') && !t.includes('id correction') && !t.includes('clearance') && !t.includes('permit') && !m.includes('clearances, business permits') && !m.includes('resident account application');
    });
  }
  res.json(results);
});

// Mark single notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
  const { id } = req.params;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query("UPDATE sms_notifications SET is_read = 1 WHERE id = ?", [id]);
      return res.json({ success: true, message: 'Notification marked as read.' });
    } catch (err) {
      console.warn('MySQL mark notification read error:', err.message);
    }
  }
  const notif = (mockData.notifications || []).find(n => String(n.id) === String(id));
  if (notif) notif.is_read = 1;
  return res.json({ success: true, message: 'Notification marked as read.' });
});

// Mark all notifications as read
app.put('/api/notifications/mark-all-read', async (req, res) => {
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      await pool.query("UPDATE sms_notifications SET is_read = 1");
      return res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) {
      console.warn('MySQL mark all notifications read error:', err.message);
    }
  }
  (mockData.notifications || []).forEach(n => { n.is_read = 1; });
  return res.json({ success: true, message: 'All notifications marked as read.' });
});

app.post('/api/notifications', async (req, res) => {
  const { recipient_name, recipient_phone, recipient_email, type, message } = req.body;
  
  // 1. Dispatch live SMS via iProgTech Gateway
  sendLiveSms(recipient_phone, message).catch(e => console.warn('iProg SMS dispatch error:', e.message));

  // 2. Simultaneously dispatch Email to recipient if email is provided or in database
  (async () => {
    try {
      let targetEmail = recipient_email;
      if (!targetEmail) {
        // Look up resident email by phone or name
        const pool = getPool();
        if (pool && getStatus().connected) {
          const [uRows] = await pool.query(
            "SELECT email FROM users WHERE (phone = ? OR name = ?) AND email IS NOT NULL LIMIT 1",
            [recipient_phone, recipient_name]
          );
          if (uRows && uRows.length > 0 && uRows[0].email) {
            targetEmail = uRows[0].email;
          }
        }
        if (!targetEmail) {
          const matchedUser = mockData.users.find(u => 
            (u.phone && recipient_phone && u.phone.includes(recipient_phone.slice(-7))) ||
            (u.name && recipient_name && u.name.toLowerCase() === recipient_name.toLowerCase())
          );
          if (matchedUser && matchedUser.email) {
            targetEmail = matchedUser.email;
          }
        }
      }

      if (targetEmail && targetEmail.includes('@')) {
        await sendDirectNotificationEmail({
          to: targetEmail,
          recipientName: recipient_name,
          type: type || 'Barangay Notification',
          message: message
        });
        console.log(`📧 [Auto-Email Dual Dispatch] Sent synchronized email to ${targetEmail}`);
      }
    } catch (emailErr) {
      console.warn('Dual email dispatch error:', emailErr.message);
    }
  })();

  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [result] = await pool.query(
        "INSERT INTO sms_notifications (recipient_name, recipient_phone, type, message, status) VALUES (?, ?, ?, ?, 'Sent')",
        [recipient_name, recipient_phone, type, message]
      );
      return res.status(201).json({ id: result.insertId, recipient_name, recipient_phone, recipient_email, type, message, status: 'Sent', sent_at: new Date().toISOString() });
    } catch (err) {
      console.warn('MySQL SMS insert error:', err.message);
    }
  }

  const newSms = { id: mockData.notifications.length + 1, recipient_name, recipient_phone, recipient_email, type, message, status: 'Sent', sent_at: new Date().toLocaleString() };
  mockData.notifications.unshift(newSms);
  res.status(201).json(newSms);
});

// Intercom Messages (Barangay <-> Health Center staff chat)
// Note: Handled above in Intra-System Messenger Endpoints (/api/messages)

// -------------------------------------------------------------
// AI Chatbot — Knowledge-Based FAQ Engine
// -------------------------------------------------------------
const knowledgeBase = [
  // Document requirements
  {
    keywords: ['clearance', 'barangay clearance', 'police clearance', 'nbi clearance'],
    topic: 'Barangay Clearance',
    answer: `📄 *Barangay Clearance Requirements:*\n\n✅ Valid Government-Issued ID (PhilSys, Passport, Driver\'s License, Voter\'s ID, SSS, or GSIS)\n✅ Community Tax Certificate (Cedula) — available at Barangay Hall\n✅ Proof of Residency (utility bill or lease contract)\n✅ Duly accomplished request form\n\n🕐 *Processing Time:* Same day (1–2 hours)\n💰 *Fee:* Php 50.00\n📍 *Where:* Barangay Hall, Room 1 – Document Section\n\nYou can also submit your request online via the *Barangay Portal* in this system!`
  },
  {
    keywords: ['residency', 'certificate of residency', 'proof of residence'],
    topic: 'Certificate of Residency',
    answer: `🏠 *Certificate of Residency Requirements:*\n\n✅ Valid Government ID with address\n✅ Utility bill (electricity/water) — not older than 3 months\n✅ Lease contract (if renting)\n✅ 2 pcs 1x1 ID photo\n\n🕐 *Processing Time:* 1–2 hours\n💰 *Fee:* Php 50.00\n\nYou can submit this request directly from the *Barangay Portal* in this system!`
  },
  {
    keywords: ['business permit', 'business', 'store', 'sari-sari', 'permit'],
    topic: 'Business Permit',
    answer: `🏪 *Barangay Business Permit Requirements:*\n\n✅ DTI Registration (for sole proprietorship) or SEC Registration (for corporations)\n✅ Lease/Property Title or Owner\'s Consent Letter\n✅ Valid Owner Government ID\n✅ Community Tax Certificate (Cedula)\n\n🕐 *Processing Time:* 1–2 business days\n💰 *Fee:* Php 200.00 – Php 500.00 (based on business type)\n\n📍 Submit your request at *Room 1, Barangay Hall* or via the Barangay Portal online!`
  },
  {
    keywords: ['indigency', 'certificate of indigency', 'poor', 'financial assistance'],
    topic: 'Certificate of Indigency',
    answer: `📋 *Certificate of Indigency Requirements:*\n\n✅ Valid ID of the requesting resident\n✅ Proof of residency in the barangay\n✅ Recommendation letter (for scholarship applications)\n\n🕐 *Processing Time:* Same day\n💰 *Fee:* FREE (no charge)\n\nThis document is free for indigent residents. Available at Barangay Hall, Room 1.`
  },
  {
    keywords: ['barangay id', 'id card', 'identification'],
    topic: 'Barangay ID',
    answer: `🪪 *Barangay ID Requirements:*\n\n✅ Proof of residency (2 months minimum)\n✅ 2 pcs 2x2 ID photos\n✅ Valid government ID for verification\n✅ Accomplished application form\n\n🕐 *Processing Time:* 3–5 business days\n💰 *Fee:* Php 50.00\n\nThe Barangay ID is accepted as valid identification within government agencies.`
  },
  // Health Center
  {
    keywords: ['health center', 'clinic', 'bhw', 'health worker', 'nurse', 'doctor', 'health'],
    topic: 'Health Center',
    answer: `🏥 *Barangay Health Center Information:*\n\n🕐 *Operating Hours:* Monday – Friday, 8:00 AM – 5:00 PM\n📍 *Location:* Barangay Hall Annex Building\n\n*Services Available:*\n💊 Free consultations & medical checkups\n💉 Infant immunization (Wednesdays & Fridays, 8AM–12PM)\n🤰 Prenatal & postnatal care\n📋 Medical certificates & health clearances\n🩺 Blood pressure & blood sugar monitoring\n\nFor health documents, use the *Health Center Portal* in this system!`
  },
  {
    keywords: ['vaccine', 'vaccination', 'immunization', 'bcg', 'polio', 'mmr', 'hepatitis', 'dpt', 'infant', 'baby', 'child'],
    topic: 'Immunization',
    answer: `💉 *Free Infant Immunization Schedule:*\n\n📅 *Schedule:* Every Wednesday & Friday, 8:00 AM – 12:00 PM\n📍 *Location:* Barangay Health Center\n\n*Available Free Vaccines:*\n• BCG (Bacillus Calmette-Guérin)\n• Hepatitis B\n• DPT (Diphtheria, Pertussis, Tetanus)\n• Oral Polio Vaccine (OPV)\n• MMR (Measles, Mumps, Rubella)\n\n📋 *Please bring:* Mother-Baby Handbook / Immunization Card\n\nFor missed doses or overdue vaccines, contact the Barangay Health Center immediately.`
  },
  {
    keywords: ['prenatal', 'pregnant', 'pregnancy', 'maternal', 'postnatal', 'mother', 'baby checkup', 'ob'],
    topic: 'Maternal Health',
    answer: `🤰 *Maternal & Prenatal Care Services:*\n\n*Prenatal Visits:*\n• 1st Trimester: Every 4 weeks\n• 2nd Trimester: Every 3 weeks\n• 3rd Trimester: Every 2 weeks\n\n*What to Bring:*\n📋 Mother-Baby Handbook\n📋 Previous checkup records\n\n*Postnatal Care:*\n• Newborn checkup within 72 hours of birth\n• Follow-up at 1 week, 1 month, and 2 months\n\n🏥 *Location:* Barangay Health Center (8AM–5PM, Mon-Fri)\n\nFor high-risk pregnancies, immediate consultation with BHW Nurse Maria Santos is recommended.`
  },
  // System usage
  {
    keywords: ['register', 'sign up', 'create account', 'new account', 'how to register'],
    topic: 'Account Registration',
    answer: `📝 *How to Register a Resident Account:*\n\n1. Go to the *Login Page* of Smart Barangay System\n2. Click *"Register as Resident"* tab\n3. Fill in your full name, email address, phone number, and address\n4. Upload a photo of your valid Government ID\n5. Click *"Register Account"*\n\n⏳ Your account will be in *Pending Review* status.\nThe Barangay Admin will verify your ID and activate your account.\n\n📧 You will be notified once your account is verified and you can start requesting documents!`
  },
  {
    keywords: ['request document', 'how to request', 'submit request', 'online request'],
    topic: 'Requesting Documents',
    answer: `📋 *How to Request a Document Online:*\n\n1. Log in to your *Resident Account*\n2. Choose the portal: *Barangay Portal* or *Health Center Portal*\n3. Click *"Request Document"* button\n4. Select document type and enter your purpose\n5. Click *"Submit Request"*\n\n📍 You can also visit the *Barangay Hall* in person.\n\n⚠️ *Note:* Your account must be *Verified* by the Barangay Admin before you can submit online requests. Unverified accounts are locked.`
  },
  {
    keywords: ['print', 'download', 'certificate', 'print document', 'get certificate'],
    topic: 'Printing Documents',
    answer: `🖨️ *How to Print or Download Your Document:*\n\n1. Log in and go to your portal (Barangay or Health Center)\n2. Find your document in the *"My Document Requests"* table\n3. Click the *"Print / Export"* button on the right side\n4. A document preview will appear\n5. Click *"Print Official Copy"* to print, or *"Download File"* to save\n\n📋 For completed requests, you can pick up physical copies at the Barangay Hall between 8AM–5PM.`
  },
  {
    keywords: ['track', 'status', 'check status', 'pending', 'processing', 'completed'],
    topic: 'Document Status',
    answer: `🔍 *Document Request Status Meanings:*\n\n🟡 *Pending* — Your request has been submitted and is waiting for staff review\n🔵 *Processing* — Staff is actively preparing your document\n✅ *Completed* — Your document is ready for pickup or printing\n❌ *Rejected* — The request was not approved (contact Barangay Office)\n\nYou can track your document status anytime by logging into your *Resident Account* and visiting the portal where you submitted the request.`
  },
  {
    keywords: ['fee', 'how much', 'cost', 'price', 'payment'],
    topic: 'Fees & Payment',
    answer: `💰 *Barangay Document Fees:*\n\n• Barangay Clearance — Php 50.00\n• Certificate of Residency — Php 50.00\n• Business Permit — Php 200–500 (varies)\n• Certificate of Indigency — **FREE**\n• Barangay ID — Php 50.00\n\n🏥 *Health Center Services (All FREE):*\n• Medical certificates\n• Health clearances\n• Immunizations\n• Prenatal & postnatal care\n\n💳 *Payment:* Cash only at the Barangay Hall cashier.`
  },
  {
    keywords: ['hours', 'open', 'schedule', 'office hours', 'time', 'when'],
    topic: 'Office Hours',
    answer: `🕐 *Barangay Hall Office Hours:*\n📅 Monday – Friday: 8:00 AM – 5:00 PM\n📅 Saturday: 8:00 AM – 12:00 PM\n❌ Sunday & Holidays: Closed\n\n🏥 *Health Center Hours:*\n📅 Monday – Friday: 8:00 AM – 5:00 PM\n💉 Immunizations: Wednesday & Friday, 8:00 AM – 12:00 PM\n\n📞 *Emergency Contact:* Barangay Hotline: (02) 1234-5678`
  },
  {
    keywords: ['contact', 'phone', 'address', 'location', 'where', 'how to reach', 'pianing', 'butuan'],
    topic: 'Contact Information',
    answer: `📞 *Barangay Pianing, Butuan City Contact Information:*\n\n🏛️ *Barangay Hall:* Barangay Pianing, Butuan City, Agusan del Norte, Philippines 8600\n📞 *Hotline:* (085) 341-2345 / 0917-123-4567\n📧 *Email:* info@barangaypianing.gov.ph\n\n👤 *Key Officials:*\n• Punong Barangay / Captain: Hon. Juan Dela Cruz — (0917) 123-4567\n• Barangay Secretary: Ana Reyes — (0918) 234-5678\n• BHW Nurse: Maria Santos — (0919) 345-6789\n\n🕐 *Office Hours:* Mon–Fri, 8:00 AM – 5:00 PM | Sat, 8:00 AM – 12:00 PM`
  },
  {
    keywords: ['verify', 'verification', 'approve account', 'account verified', 'unverified'],
    topic: 'Account Verification',
    answer: `✅ *Account Verification Process:*\n\nAfter registering, your account goes through verification:\n\n1. You upload your Government ID during registration\n2. Barangay Admin reviews your submitted ID\n3. Your account status changes from *Pending* to *Verified*\n\n⏳ *Verification Time:* Usually within 1–2 business days\n\n⚠️ Until verified, you cannot submit document requests online.\n\nIf your verification is taking too long, visit the Barangay Hall in person with your original government ID.`
  },
  {
    keywords: ['sms', 'notification', 'text message', 'alert'],
    topic: 'SMS Notifications',
    answer: `📱 *SMS Notification Service:*\n\nThe Barangay sends SMS alerts for:\n• Document request status updates\n• Immunization reminders for your child\n• Barangay announcements\n• Health center appointment reminders\n\nTo receive SMS notifications, make sure your registered mobile number is correct. Contact the Barangay Office to update your phone number.`
  }
];

function findBestAnswer(question) {
  const q = question.toLowerCase().trim();
  const words = q.split(/\s+/);
  let bestMatch = null;
  let bestScore = 0;

  for (const kb of knowledgeBase) {
    let score = 0;
    for (const keyword of kb.keywords) {
      const kw = keyword.toLowerCase();
      // Exact phrase match
      if (q.includes(kw)) {
        score += kw.length * 3;
      }
      // Word match
      if (words.includes(kw)) {
        score += 10;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = kb;
    }
  }

  // Only return if score is meaningful
  if (bestScore >= 6) {
    return bestMatch;
  }
  return null;
}

app.post('/api/chatbot', async (req, res) => {
  const { question } = req.body || {};
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }

  // 1. Use rich built-in knowledge base first for comprehensive, formatted answers
  const match = findBestAnswer(question);
  if (match) {
    return res.json({ answer: match.answer, topic: match.topic, source: 'knowledge_base' });
  }

  // 2. Try MySQL FAQ if custom entries exist
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      const [rows] = await pool.query('SELECT * FROM faq_knowledge');
      const q = question.toLowerCase();
      for (const row of rows) {
        const keywords = (row.keywords || '').toLowerCase().split(',').map(k => k.trim());
        if (keywords.some(k => k && q.includes(k))) {
          return res.json({ answer: row.response, topic: row.topic, source: 'database' });
        }
      }
    } catch (err) {
      console.warn('FAQ DB query error:', err.message);
    }
  }

  // 3. Fallback in-memory FAQ
  const q = question.toLowerCase();
  const faqMatch = mockData.faq.find(f => f.keywords.some(k => q.includes(k)));
  if (faqMatch) {
    return res.json({ answer: faqMatch.response, topic: faqMatch.topic, source: 'faq' });
  }

  // 4. Default helpful fallback response
  return res.json({
    answer: `🤔 I'm not sure about that specific question. Here's what I can help you with:\n\n📄 *Document Requests* — Barangay Clearance, Residency, Business Permit, Indigency Cert, Barangay ID\n🏥 *Health Services* — Immunizations, Prenatal care, Medical certificates\n🕐 *Office Hours* — Mon–Fri 8AM–5PM\n📞 *Contact* — (02) 1234-5678\n\nTry asking: "How to get Barangay Clearance?" or "What vaccines are free?"`,
    topic: 'General',
    source: 'fallback'
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULING API ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/scheduling/vaccines – return full vaccine schedule list
app.get('/api/scheduling/vaccines', (req, res) => {
  const list = Object.entries(VACCINE_SCHEDULE).map(([name, doses]) => ({
    vaccine: name,
    totalDoses: doses.length,
    doses,
  }));
  res.json(list);
});

// POST /api/scheduling/next-dose – compute next dose after completing one
// Body: { vaccine_name, completed_dose, administered_date }
app.post('/api/scheduling/next-dose', (req, res) => {
  const { vaccine_name, completed_dose, administered_date } = req.body;
  if (!vaccine_name || !completed_dose) {
    return res.status(400).json({ error: 'vaccine_name and completed_dose are required.' });
  }
  const result = computeNextDose(vaccine_name, Number(completed_dose), administered_date);
  res.json(result);
});

// POST /api/scheduling/full-vaccine-schedule – get complete vaccine schedule from birth date
// Body: { vaccine_name, birth_date }
app.post('/api/scheduling/full-vaccine-schedule', (req, res) => {
  const { vaccine_name, birth_date } = req.body;
  if (!vaccine_name || !birth_date) {
    return res.status(400).json({ error: 'vaccine_name and birth_date are required.' });
  }
  const schedule = getFullVaccineSchedule(vaccine_name, birth_date);
  res.json(schedule);
});

// POST /api/scheduling/next-maternal-visit – compute next prenatal/postnatal visit
// Body: { pregnancy_status, last_visit, expected_due_date }
app.post('/api/scheduling/next-maternal-visit', (req, res) => {
  const { pregnancy_status, last_visit, expected_due_date } = req.body;
  if (!pregnancy_status) {
    return res.status(400).json({ error: 'pregnancy_status is required.' });
  }
  const result = computeNextMaternalVisit(pregnancy_status, last_visit, expected_due_date);
  res.json(result);
});

// POST /api/scheduling/full-prenatal-schedule – generate complete prenatal visit schedule
// Body: { first_visit_date, expected_due_date }
app.post('/api/scheduling/full-prenatal-schedule', (req, res) => {
  const { first_visit_date, expected_due_date } = req.body;
  if (!first_visit_date || !expected_due_date) {
    return res.status(400).json({ error: 'first_visit_date and expected_due_date are required.' });
  }
  const schedule = getFullPrenatalSchedule(first_visit_date, expected_due_date);
  res.json(schedule);
});

// GET /api/scheduling/overdue – get all overdue immunizations + maternal visits
app.get('/api/scheduling/overdue', async (req, res) => {
  const pool = getPool();
  let immunizations = mockData.immunizations;
  let maternal = mockData.maternal;

  if (pool && getStatus().connected) {
    try {
      const [immRows] = await pool.query("SELECT * FROM immunizations WHERE status != 'Completed'");
      const [matRows] = await pool.query("SELECT * FROM maternal_records");
      immunizations = immRows;
      maternal = matRows;
    } catch (err) {
      console.warn('Overdue fetch DB error:', err.message);
    }
  }

  res.json({
    overdueImmunizations: getOverdueImmunizations(immunizations),
    overdueMaternalVisits: getOverdueMaternalVisits(maternal),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL API ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/email/test – send a test email to verify SMTP config
app.post('/api/email/test', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Email recipient (to) is required.' });
  const result = await sendEmail({
    to,
    subject: '[Barangay Pianing] Email System Test',
    html: `<div style="font-family:Arial,sans-serif;padding:20px;"><h2 style="color:#1e3a5f;">✅ Email System Active</h2><p>This is a test message from the <strong>Smart Barangay Management System</strong>.</p><p>If you received this, your email notification system is correctly configured.</p><hr/><p style="color:#6b7280;font-size:12px;">Barangay Pianing, Butuan City</p></div>`,
    text: 'Email test from Barangay Pianing Smart System. Configuration is working correctly.',
  });
  res.json(result);
});

// POST /api/email/announcement – broadcast an announcement email to multiple recipients
// Body: { recipients: [{ email, name }], title, body, sender }
app.post('/api/email/announcement', async (req, res) => {
  const { recipients, title, body: bodyText, sender } = req.body;
  if (!recipients?.length || !title || !bodyText) {
    return res.status(400).json({ error: 'recipients, title, and body are required.' });
  }

  const results = await Promise.allSettled(
    recipients.map(r =>
      sendAnnouncementEmail({
        to:            r.email,
        recipientName: r.name || 'Resident',
        title,
        body:          bodyText,
        sender,
      })
    )
  );

  const sent     = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
  const failed   = results.length - sent;

  res.json({ total: results.length, sent, failed });
});

// POST /api/email/send – generic send-email endpoint
// Body: { to, subject, html, text }
app.post('/api/email/send', async (req, res) => {
  const { to, subject, html, text } = req.body;
  if (!to || !subject) return res.status(400).json({ error: 'to and subject are required.' });
  const result = await sendEmail({ to, subject, html, text });
  res.json(result);
});

// GET /api/email/status – check whether email SMTP is configured
app.get('/api/email/status', (req, res) => {
  const configured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS &&
    !process.env.EMAIL_USER.includes('your_gmail') &&
    !process.env.EMAIL_PASS.includes('your_app_password'));
  res.json({
    configured,
    host:       process.env.EMAIL_HOST || 'smtp.gmail.com',
    port:       process.env.EMAIL_PORT || '465',
    user:       configured ? process.env.EMAIL_USER : null,
    mode:       configured ? 'live' : 'simulation',
    message:    configured
      ? `Email configured via ${process.env.EMAIL_HOST || 'smtp.gmail.com'}`
      : 'Email running in simulation mode. Set EMAIL_USER and EMAIL_PASS in .env to enable live sending.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POPULATION DEMOGRAPHICS & CENSUS PROFILING API
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/stats/population', async (req, res) => {
  const barangay = req.query.barangay;
  const pool = getPool();
  if (pool && getStatus().connected) {
    try {
      let filterSql = '';
      let filterParams = [];
      if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
        filterSql = ' WHERE LOWER(barangay) = LOWER(?) ';
        filterParams = [barangay.trim()];
      }

      const [totalRows] = await pool.query(`SELECT COUNT(*) as total FROM residents ${filterSql}`, filterParams);
      const total = totalRows[0]?.total || 0;

      const [onlineRows] = await pool.query(
        `SELECT COUNT(*) as online_cnt FROM residents ${filterSql ? filterSql + ' AND' : ' WHERE'} email IS NOT NULL AND email != '' AND email NOT LIKE '%@resident.local'`,
        filterParams
      );
      const online = onlineRows[0]?.online_cnt || 0;

      const [votersRows] = await pool.query(
        `SELECT COUNT(*) as cnt FROM residents ${filterSql ? filterSql + ' AND' : ' WHERE'} TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) >= 18`,
        filterParams
      );
      const voters = votersRows[0]?.cnt || 0;

      const [seniorsRows] = await pool.query(
        `SELECT COUNT(*) as cnt FROM residents ${filterSql ? filterSql + ' AND' : ' WHERE'} TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) >= 60`,
        filterParams
      );
      const seniors = seniorsRows[0]?.cnt || 0;

      const [minorsRows] = await pool.query(
        `SELECT COUNT(*) as cnt FROM residents ${filterSql ? filterSql + ' AND' : ' WHERE'} TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) < 18`,
        filterParams
      );
      const minors = minorsRows[0]?.cnt || 0;

      const [maleRows] = await pool.query(
        `SELECT COUNT(*) as cnt FROM residents ${filterSql ? filterSql + ' AND' : ' WHERE'} gender = 'Male'`,
        filterParams
      );
      const [femaleRows] = await pool.query(
        `SELECT COUNT(*) as cnt FROM residents ${filterSql ? filterSql + ' AND' : ' WHERE'} gender = 'Female'`,
        filterParams
      );

      const [purokRows] = await pool.query(
        `SELECT COALESCE(NULLIF(purok, ''), '1') as purok_name, COUNT(*) as count FROM residents ${filterSql} GROUP BY purok_name ORDER BY purok_name ASC`,
        filterParams
      );

      return res.json({
        success: true,
        barangay: barangay || 'All',
        total_population: total,
        online_registered: online,
        adoption_rate: total > 0 ? Math.round((online / total) * 100) : 0,
        registered_voters: voters,
        senior_citizens: seniors,
        minors_children: minors,
        gender: {
          male: maleRows[0]?.cnt || 0,
          female: femaleRows[0]?.cnt || 0,
          other: Math.max(0, total - (maleRows[0]?.cnt || 0) - (femaleRows[0]?.cnt || 0))
        },
        purok_distribution: purokRows.map(p => ({
          purok: `Purok ${p.purok_name}`.replace(/Purok\s+Purok/i, 'Purok'),
          count: p.count
        }))
      });
    } catch (err) {
      console.warn('Population stats DB error:', err.message);
    }
  }

  // Fallback Mock Population Calculation
  let fallbackResidents = mockData.residents || [];
  if (barangay && barangay.toLowerCase() !== 'all' && !barangay.toLowerCase().includes('city-wide')) {
    fallbackResidents = fallbackResidents.filter(r => (r.barangay || '').toLowerCase() === barangay.toLowerCase().trim());
  }
  const total = fallbackResidents.length;
  const online = fallbackResidents.filter(r => r.email && !r.email.includes('@resident.local')).length;
  const nowYear = new Date().getFullYear();
  const getAge = (dob) => {
    if (!dob) return 25;
    const y = parseInt(dob.split('-')[0], 10);
    return isNaN(y) ? 25 : nowYear - y;
  };
  const voters = fallbackResidents.filter(r => getAge(r.date_of_birth) >= 18).length;
  const seniors = fallbackResidents.filter(r => getAge(r.date_of_birth) >= 60).length;
  const minors = fallbackResidents.filter(r => getAge(r.date_of_birth) < 18).length;
  const males = fallbackResidents.filter(r => (r.gender || 'Male') === 'Male').length;
  const females = fallbackResidents.filter(r => (r.gender || '') === 'Female').length;

  res.json({
    success: true,
    barangay: barangay || 'All',
    total_population: total,
    online_registered: online,
    adoption_rate: total > 0 ? Math.round((online / total) * 100) : 0,
    registered_voters: voters,
    senior_citizens: seniors,
    minors_children: minors,
    gender: { male: males, female: females, other: Math.max(0, total - males - females) },
    purok_distribution: [1, 2, 3, 4, 5, 6].map(i => ({
      purok: `Purok ${i}`,
      count: fallbackResidents.filter(r => (r.purok || '').toString().replace(/purok\s*/i, '').trim() === String(i) || (r.address || '').toLowerCase().includes(`purok ${i}`.toLowerCase())).length
    }))
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN: 86-BARANGAY MUNICIPAL COMMAND & REGISTRY HUB
// ─────────────────────────────────────────────────────────────────────────────
const ALL_86_BUTUAN_BARANGAYS = [
  'Pianing', 'Anticala', 'Agao Poblacion', 'Agusan Pequeño', 'Ambago', 'Amparo', 'Ampayon', 'Antongalon', 'Aupagan', 'Baan Km 3', 'Baan Riverside', 'Babag', 'Bading', 'Banza', 'Baobaoan', 'Basag', 'Bayanihan', 'Bilay', 'Bit-os', 'Bitan-agan', 'Bobon', 'Bonbon', 'Bugabus', 'Buhangin', 'Cabcabon', 'Camayahan', 'Dagohoy', 'Dankias', 'De Oro', 'Diego Silang', 'Doongan', 'Dumalagan', 'Golden Ribbon', 'Holy Redeemer', 'Humabon', 'Imadejas', 'Kinamlutan', 'Lapu-lapu', 'Lemon', 'Libertad', 'Limaha', 'Los Angeles', 'Lumbocan', 'Maguinda', 'Mahay', 'Mahogany', 'Maibu', 'Mandamo', 'Manila de Bugabus', 'Maon', 'Masao', 'Maug', 'New Society Village', 'Nong-nong', 'Obrero', 'Ong Yiu', 'Pagatpatan', 'Pangabugan', 'Pangaylan IP', 'Pinamanculan', 'Port Poyohon', 'Pigdaulan', 'Rajahnath', 'San Ignacio', 'San Mateo', 'San Vicente', 'Santa Cruz', 'Santo Niño', 'Silongan', 'Sumilihon', 'Tagabaca', 'Taguibo', 'Taligaman', 'Tandag', 'Tiniwisan', 'Tungao', 'Urduja', 'Villa Kananga', 'Bonifacio', 'Dulag', 'Florida', 'Guinabsan', 'New Manat', 'Riverside', 'Salvacion', 'Tuburan'
];

app.get('/api/system/barangays', async (req, res) => {
  const pool = getPool();
  let adminUsers = [];
  let residentsCounts = {};
  let pendingCounts = {};
  let documentsCounts = {};

  if (pool && getStatus().connected) {
    try {
      const [admins] = await pool.query("SELECT id, name, email, phone, barangay, status FROM users WHERE role = 'admin' AND status = 'Active'");
      adminUsers = admins || [];

      const [resCounts] = await pool.query("SELECT barangay, COUNT(*) as cnt FROM residents GROUP BY barangay");
      (resCounts || []).forEach(r => { if (r.barangay) residentsCounts[r.barangay.toLowerCase().trim()] = r.cnt; });

      const [pendCounts] = await pool.query("SELECT barangay, COUNT(*) as cnt FROM residents WHERE verification_status = 'Pending_Review' GROUP BY barangay");
      (pendCounts || []).forEach(r => { if (r.barangay) pendingCounts[r.barangay.toLowerCase().trim()] = r.cnt; });

      const [docCounts] = await pool.query("SELECT barangay, COUNT(*) as cnt FROM document_requests GROUP BY barangay");
      (docCounts || []).forEach(r => { if (r.barangay) documentsCounts[r.barangay.toLowerCase().trim()] = r.cnt; });
    } catch (err) {
      console.warn('System barangays DB error:', err.message);
    }
  }

  const result = ALL_86_BUTUAN_BARANGAYS.map((bName, index) => {
    const key = bName.toLowerCase().trim();
    const assignedAdmin = adminUsers.find(a => a.barangay && a.barangay.toLowerCase().trim() === key);
    return {
      id: index + 1,
      name: bName,
      status: assignedAdmin ? 'Active' : 'Unstaffed',
      admin: assignedAdmin ? {
        id: assignedAdmin.id,
        name: assignedAdmin.name,
        email: assignedAdmin.email,
        phone: assignedAdmin.phone || 'N/A'
      } : null,
      total_residents: residentsCounts[key] || 0,
      pending_approvals: pendingCounts[key] || 0,
      total_documents: documentsCounts[key] || 0,
      office_address: `Barangay Hall, ${bName}, Butuan City, Agusan del Norte`,
      hotline: assignedAdmin?.phone || '0917-123-4567'
    };
  });

  res.json(result);
});


// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN: SYSTEM DIAGNOSTICS, MAINTENANCE & 1-CLICK BACKUP
// ─────────────────────────────────────────────────────────────────────────────
const MAINTENANCE_FILE = path.join(__dirname, 'data', 'maintenance.json');

function loadMaintenanceState() {
  try {
    if (fs.existsSync(MAINTENANCE_FILE)) {
      const raw = fs.readFileSync(MAINTENANCE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        enabled: Boolean(parsed.enabled),
        type: parsed.type || 'down',
        title: parsed.title || (parsed.type === 'down' ? 'System Outage Alert' : 'System Notice'),
        message: parsed.message || 'The system is temporarily experiencing technical difficulties. Technicians are resolving the issue.',
        estimated_uptime: parsed.estimated_uptime || 'Within 1 hour',
        updated_at: parsed.updated_at || new Date().toISOString()
      };
    }
  } catch (err) {
    console.error('Failed to load maintenance state file:', err);
  }
  return {
    enabled: false,
    type: 'down',
    title: 'System Outage Alert',
    message: 'The system is temporarily experiencing technical difficulties. Technicians are resolving the issue.',
    estimated_uptime: 'Within 1 hour',
    updated_at: new Date().toISOString()
  };
}

function saveMaintenanceState(state) {
  try {
    const dir = path.dirname(MAINTENANCE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save maintenance state file:', err);
  }
}

let systemMaintenanceMode = loadMaintenanceState();

app.get('/api/system/maintenance', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json(systemMaintenanceMode);
});

app.post('/api/system/maintenance', async (req, res) => {
  const { enabled, message, type, title, estimated_uptime } = req.body;
  systemMaintenanceMode.enabled = Boolean(enabled);
  if (message !== undefined) systemMaintenanceMode.message = message;
  if (type !== undefined) systemMaintenanceMode.type = type;
  if (title !== undefined) systemMaintenanceMode.title = title;
  if (estimated_uptime !== undefined) systemMaintenanceMode.estimated_uptime = estimated_uptime;
  systemMaintenanceMode.updated_at = new Date().toISOString();
  saveMaintenanceState(systemMaintenanceMode);

  const noticeTypeLabel = systemMaintenanceMode.type === 'down'
    ? 'Critical System Outage (System Down)'
    : systemMaintenanceMode.type === 'advisory'
      ? 'Public Advisory'
      : 'Scheduled Maintenance';

  logActivity({
    user_name: 'Super Mega Admin',
    user_role: 'super_mega_admin',
    action: systemMaintenanceMode.enabled ? `Activated Notice: ${noticeTypeLabel}` : 'Deactivated System Notice',
    action_type: 'System',
    barangay: 'All (City-Wide)',
    details: `System Notice (${noticeTypeLabel}) set to ${systemMaintenanceMode.enabled ? 'Active' : 'Disabled'}. Title: "${systemMaintenanceMode.title || ''}". Message: ${systemMaintenanceMode.message || ''}`
  }).catch(() => {});

  res.json({ success: true, maintenance: systemMaintenanceMode });
});

app.get('/api/system/gateways', async (req, res) => {
  const pool = getPool();
  const dbConnected = pool && getStatus().connected;
  res.json({
    database: {
      status: dbConnected ? 'Connected' : 'Simulation Mode',
      engine: 'MySQL 8.0 / MariaDB',
      host: 'localhost:3306',
      name: 'smart_db'
    },
    sms: {
      provider: 'iProg SMS Gateway',
      status: 'Active',
      endpoint: 'https://sms.iprogtech.com/api/v1/sendsms',
      latency: '24ms'
    },
    email: {
      provider: 'Gmail / EmailJS API',
      status: 'Active',
      service_id: 'service_6nk2ylj',
      host: 'smtp.gmail.com'
    }
  });
});

app.get('/api/system/database/stats', async (req, res) => {
  const pool = getPool();
  const tables = [
    'users', 'residents', 'document_requests', 'document_categories',
    'health_appointments', 'clinic_schedules', 'child_health_records',
    'maternal_records', 'immunizations', 'activity_logs', 'messages',
    'sms_notifications', 'user_notifications', 'broadcasts', 'faq_knowledge'
  ];

  const tableStats = [];
  if (pool && getStatus().connected) {
    try {
      for (const t of tables) {
        try {
          const [rows] = await pool.query(`SELECT COUNT(*) as count FROM \`${t}\``);
          tableStats.push({ table: t, count: rows[0]?.count || 0, status: 'Healthy' });
        } catch {
          tableStats.push({ table: t, count: 0, status: 'Table Not Created' });
        }
      }
      return res.json({ success: true, connected: true, tables: tableStats });
    } catch (err) {
      console.warn('DB stats error:', err.message);
    }
  }

  // Mock table stats
  tables.forEach(t => {
    tableStats.push({ table: t, count: (mockData[t] || []).length || 10, status: 'Simulated' });
  });
  res.json({ success: true, connected: false, tables: tableStats });
});

// 1-Click Database Backup (.sql / .json)
app.get('/api/system/database/backup', async (req, res) => {
  const format = (req.query.format || 'sql').toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const pool = getPool();

  const tables = [
    'users', 'residents', 'document_requests', 'document_categories',
    'health_appointments', 'clinic_schedules', 'child_health_records',
    'maternal_records', 'immunizations', 'activity_logs', 'messages',
    'sms_notifications', 'user_notifications', 'broadcasts', 'faq_knowledge'
  ];

  if (format === 'json') {
    const exportData = {
      meta: {
        system: 'Barangay Pianing Smart System',
        database: 'smart_db',
        exported_at: new Date().toISOString(),
        version: '1.0.0'
      },
      tables: {}
    };

    if (pool && getStatus().connected) {
      for (const t of tables) {
        try {
          let [rows] = await pool.query(`SELECT * FROM \`${t}\``);
          if (t === 'users') {
            rows = (rows || []).map(u => {
              const safe = { ...u };
              delete safe.password_hash;
              return safe;
            });
          }
          exportData.tables[t] = rows;
        } catch {
          exportData.tables[t] = [];
        }
      }
    } else {
      tables.forEach(t => {
        let rows = mockData[t] || [];
        if (t === 'users') {
          rows = rows.map(u => {
            const safe = { ...u };
            delete safe.password_hash;
            return safe;
          });
        }
        exportData.tables[t] = rows;
      });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="smart_db_backup_${timestamp}.json"`);
    return res.send(JSON.stringify(exportData, null, 2));
  }

  // Default: SQL format dump
  let sqlDump = `-- SMART BARANGAY SYSTEM DATABASE BACKUP\n-- Database: smart_db\n-- Timestamp: ${new Date().toISOString()}\n-- Generated for: Super Administrator\n\nSET FOREIGN_KEY_CHECKS=0;\n\n`;

  if (pool && getStatus().connected) {
    try {
      for (const t of tables) {
        try {
          const [createRows] = await pool.query(`SHOW CREATE TABLE \`${t}\``);
          const createStmt = createRows[0]?.['Create Table'] || '';
          sqlDump += `-- --------------------------------------------------------\n-- Table structure for table \`${t}\`\n-- --------------------------------------------------------\n\nDROP TABLE IF EXISTS \`${t}\`;\n${createStmt};\n\n`;

          const [dataRows] = await pool.query(`SELECT * FROM \`${t}\``);
          if (dataRows.length > 0) {
            sqlDump += `-- Dumping data for table \`${t}\`\nINSERT INTO \`${t}\` VALUES\n`;
            const valueLines = dataRows.map(row => {
              const rowCopy = { ...row };
              if (t === 'users' && 'password_hash' in rowCopy) {
                rowCopy.password_hash = '$2a$10$PROTECTED_HASH_REDACTED';
              }
              const vals = Object.values(rowCopy).map(val => {
                if (val === null) return 'NULL';
                if (typeof val === 'number') return val;
                if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
              });
              return `(${vals.join(', ')})`;
            });
            sqlDump += valueLines.join(',\n') + ';\n\n';
          }
        } catch (tableErr) {
          sqlDump += `-- Skipped table \`${t}\`: ${tableErr.message}\n\n`;
        }
      }
      sqlDump += `SET FOREIGN_KEY_CHECKS=1;\n-- BACKUP COMPLETE\n`;
    } catch (err) {
      sqlDump += `-- Backup generation error: ${err.message}\n`;
    }
  } else {
    sqlDump += `-- [SIMULATION MODE] MySQL not connected.\n`;
  }

  res.setHeader('Content-Type', 'application/sql');
  res.setHeader('Content-Disposition', `attachment; filename="smart_db_backup_${timestamp}.sql"`);
  res.send(sqlDump);
});

// -------------------------------------------------------------
// Automated 1-Day Advance Scheduler (SMS & Email Reminders)
// -------------------------------------------------------------
async function runOneDayAdvanceScheduler() {
  const pool = getPool();
  let dispatchedCount = 0;
  if (!pool || !getStatus().connected) return { dispatchedCount };

  try {
    // 1. Appointments tomorrow
    const [apts] = await pool.query(`
      SELECT * FROM health_appointments 
      WHERE (DATE(preferred_date) = CURDATE() + INTERVAL 1 DAY OR DATE(scheduled_date) = CURDATE() + INTERVAL 1 DAY)
        AND (one_day_alert_sent = 0 OR one_day_alert_sent IS NULL)
        AND status IN ('Approved', 'Scheduled', 'Pending')
    `);

    for (const apt of apts) {
      const patientPhone = apt.resident_phone;
      const patientName = apt.resident_name;
      const service = apt.service_type || 'Consultation';
      const time = apt.scheduled_time || apt.preferred_time || 'Morning';
      
      const smsText = `Barangay Pianing Health Center: Reminder! Your ${service} appointment is TOMORROW at ${time}. Please bring your ID and health records.`;
      
      if (patientPhone) {
        await sendLiveSms(patientPhone, smsText).catch(() => {});
        await pool.query(
          "INSERT INTO sms_notifications (recipient_name, recipient_phone, type, message, status, sent_at) VALUES (?, ?, '1-Day Advance Reminder', ?, 'Sent', NOW())",
          [patientName, patientPhone, smsText]
        ).catch(() => {});
      }
      
      if (apt.resident_email && apt.resident_email.includes('@')) {
        sendImmunizationReminderEmail({
          to: apt.resident_email,
          childName: patientName,
          parentName: patientName,
          vaccineName: service,
          doseNumber: 1,
          dueDate: 'Tomorrow'
        }).catch(() => {});
      }

      await pool.query("UPDATE health_appointments SET one_day_alert_sent = 1 WHERE id = ?", [apt.id]).catch(() => {});
      dispatchedCount++;
    }

    // 2. Maternal records with next_visit_date tomorrow
    const [matList] = await pool.query(`
      SELECT * FROM maternal_records 
      WHERE DATE(next_visit_date) = CURDATE() + INTERVAL 1 DAY
        AND (one_day_alert_sent = 0 OR one_day_alert_sent IS NULL)
    `);

    for (const mat of matList) {
      const patientPhone = mat.contact_number;
      const patientName = mat.mother_name;
      const smsText = `Barangay Health Center: Dear ${patientName}, your Prenatal Check-up is TOMORROW. Please bring your Mother-Baby Book. Stay safe!`;

      if (patientPhone) {
        await sendLiveSms(patientPhone, smsText).catch(() => {});
        await pool.query(
          "INSERT INTO sms_notifications (recipient_name, recipient_phone, type, message, status, sent_at) VALUES (?, ?, '1-Day Advance Reminder', ?, 'Sent', NOW())",
          [patientName, patientPhone, smsText]
        ).catch(() => {});
      }
      await pool.query("UPDATE maternal_records SET one_day_alert_sent = 1 WHERE id = ?", [mat.id]).catch(() => {});
      dispatchedCount++;
    }

    // 3. Immunizations due tomorrow
    const [immList] = await pool.query(`
      SELECT * FROM immunizations 
      WHERE DATE(due_date) = CURDATE() + INTERVAL 1 DAY
        AND status = 'Scheduled'
        AND (one_day_alert_sent = 0 OR one_day_alert_sent IS NULL)
    `);

    for (const imm of immList) {
      const patientPhone = imm.parent_phone;
      const childName = imm.child_name;
      const vaccine = imm.vaccine_name;
      const dose = imm.dose_number || 1;
      const smsText = `Barangay Health Center: Reminder! ${childName}'s ${vaccine} (Dose ${dose}) is due TOMORROW. Free immunization available at the Health Center.`;

      if (patientPhone) {
        await sendLiveSms(patientPhone, smsText).catch(() => {});
        await pool.query(
          "INSERT INTO sms_notifications (recipient_name, recipient_phone, type, message, status, sent_at) VALUES (?, ?, '1-Day Advance Reminder', ?, 'Sent', NOW())",
          [childName, patientPhone, smsText]
        ).catch(() => {});
      }
      await pool.query("UPDATE immunizations SET one_day_alert_sent = 1 WHERE id = ?", [imm.id]).catch(() => {});
      dispatchedCount++;
    }

    // 4. Family planning resupply tomorrow
    const [fpList] = await pool.query(`
      SELECT * FROM family_planning_records 
      WHERE DATE(next_supply_date) = CURDATE() + INTERVAL 1 DAY
        AND status = 'Active'
    `);

    for (const fp of fpList) {
      const patientPhone = fp.contact_number;
      const patientName = fp.patient_name;
      const method = fp.method_chosen;
      const smsText = `Barangay Health Center: Dear ${patientName}, your Family Planning (${method}) resupply/injection is scheduled for TOMORROW. Free supplies ready.`;

      if (patientPhone) {
        await sendLiveSms(patientPhone, smsText).catch(() => {});
        await pool.query(
          "INSERT INTO sms_notifications (recipient_name, recipient_phone, type, message, status, sent_at) VALUES (?, ?, '1-Day Advance Reminder', ?, 'Sent', NOW())",
          [patientName, patientPhone, smsText]
        ).catch(() => {});
      }
      dispatchedCount++;
    }

  } catch (err) {
    console.warn('[1-Day Scheduler] Error:', err.message);
  }

  return { dispatchedCount };
}

// Run scheduler every 6 hours automatically
setInterval(() => {
  runOneDayAdvanceScheduler().catch(() => {});
}, 6 * 60 * 60 * 1000);

// -------------------------------------------------------------
// Returning Patient Search & History Endpoint
// -------------------------------------------------------------
app.get('/api/patients/search', async (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  const pool = getPool();

  if (!query) {
    return res.json({ patients: [] });
  }

  if (pool && getStatus().connected) {
    try {
      // Find matching residents or past clinical encounter patients
      const [residents] = await pool.query(`
        SELECT id, first_name, middle_name, last_name, gender, date_of_birth, civil_status, address, purok, phone, email
        FROM residents
        WHERE LOWER(CONCAT(first_name, ' ', COALESCE(middle_name, ''), ' ', last_name)) LIKE ?
           OR phone LIKE ?
        LIMIT 10
      `, [`%${query}%`, `%${query}%`]);

      const formatted = [];
      for (const r of residents) {
        const fullName = `${r.first_name} ${r.middle_name ? r.middle_name + ' ' : ''}${r.last_name}`.trim();
        // Lookup most recent past clinical encounter
        const [recentEncounter] = await pool.query(`
          SELECT * FROM clinical_encounters 
          WHERE LOWER(patient_name) = LOWER(?)
          ORDER BY encounter_date DESC, id DESC LIMIT 1
        `, [fullName]);

        formatted.push({
          id: r.id,
          name: fullName,
          first_name: r.first_name,
          middle_name: r.middle_name,
          last_name: r.last_name,
          gender: r.gender || 'Female',
          date_of_birth: r.date_of_birth,
          civil_status: r.civil_status || 'Single',
          address: r.address || r.purok || 'Purok 1',
          purok: r.purok || 'Purok 1',
          phone: r.phone || '',
          email: r.email || '',
          previous_encounter: recentEncounter.length > 0 ? recentEncounter[0] : null
        });
      }

      return res.json({ patients: formatted });
    } catch (err) {
      console.warn('MySQL patient search error:', err.message);
    }
  }

  // Fallback mock search
  const mockMatches = (mockData.residents || [])
    .filter(r => `${r.first_name} ${r.last_name}`.toLowerCase().includes(query) || (r.phone && r.phone.includes(query)))
    .slice(0, 10)
    .map(r => ({
      id: r.id,
      name: `${r.first_name} ${r.last_name}`.trim(),
      gender: r.gender || 'Female',
      date_of_birth: r.date_of_birth,
      civil_status: r.civil_status || 'Single',
      address: r.address || 'Pianing',
      purok: r.purok || 'Purok 1',
      phone: r.phone || '',
      email: r.email || '',
      previous_encounter: null
    }));

  res.json({ patients: mockMatches });
});

// -------------------------------------------------------------
// Unified Clinical Intake Endpoint (Vitals + 4 Programs)
// -------------------------------------------------------------
app.post('/api/patients/intake', async (req, res) => {
  const {
    patient_name,
    contact_number,
    age,
    gender,
    civil_status,
    purok,
    barangay,
    email,
    bp,
    temp,
    weight,
    height,
    heart_rate,
    program_type,
    // Consultation
    chief_complaint,
    diagnosis,
    treatment,
    prescribed_meds,
    // Prenatal
    lmp,
    edd,
    aog_weeks,
    gravida,
    para,
    fetal_heart_rate,
    fundic_height,
    // Family Planning
    method_chosen,
    client_type,
    next_supply_date,
    // NIP
    vaccine_name,
    dose_number,
    due_date,
    // Follow-up
    next_visit_date,
    attending_worker
  } = req.body;

  if (!patient_name || !program_type) {
    return res.status(400).json({ success: false, message: 'Patient name and program type are required.' });
  }

  const pool = getPool();
  const worker = attending_worker || 'Healthcare Worker';
  const brgy = barangay || 'Pianing';

  if (pool && getStatus().connected) {
    try {
      // 1. Insert into clinical_encounters (EHR encounter log)
      const [result] = await pool.query(`
        INSERT INTO clinical_encounters 
        (patient_name, contact_number, age, gender, civil_status, barangay, purok, program_type, bp, temp, weight, height, heart_rate, chief_complaint, diagnosis, treatment, prescribed_meds, attending_worker, encounter_date, next_visit_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, 'Completed')
      `, [
        patient_name.trim(), contact_number || '', age || '', gender || 'Female', civil_status || 'Single', brgy, purok || 'Purok 1',
        program_type, bp || '120/80', temp || '36.5', weight || '', height || '', heart_rate || '',
        chief_complaint || '', diagnosis || '', treatment || '', prescribed_meds || '', worker, next_visit_date || null
      ]);

      const encounterId = result.insertId;

      // 2. Program-specific persistence
      if (program_type === 'Prenatal') {
        await pool.query(`
          INSERT INTO maternal_records 
          (mother_name, contact_number, age, barangay, gravida, para, lmp, edd, aog_weeks, bp, weight, temp, fetal_heart_rate, fundic_height, next_visit_date, attending_nurse)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          patient_name.trim(), contact_number || '', age || '', brgy, gravida || 1, para || 0,
          lmp || '2026-01-01', edd || '2026-10-01', aog_weeks || '', bp || '', weight || '', temp || '',
          fetal_heart_rate || '', fundic_height || '', next_visit_date || null, worker
        ]).catch(() => {});
      } else if (program_type === 'NIP Immunization') {
        await pool.query(`
          INSERT INTO immunizations 
          (child_name, parent_phone, vaccine_name, dose_number, status, date_administered, due_date, administered_by)
          VALUES (?, ?, ?, ?, 'Completed', CURDATE(), ?, ?)
        `, [
          patient_name.trim(), contact_number || '', vaccine_name || 'Pentavalent', dose_number || 1,
          due_date || next_visit_date || null, worker
        ]).catch(() => {});
      } else if (program_type === 'Family Planning') {
        await pool.query(`
          INSERT INTO family_planning_records 
          (patient_name, contact_number, age, barangay, purok, method_chosen, client_type, date_given, next_supply_date, attending_worker)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?)
        `, [
          patient_name.trim(), contact_number || '', age || '', brgy, purok || 'Purok 1',
          method_chosen || 'DMPA Injectable', client_type || 'Current User', next_supply_date || next_visit_date || '2026-12-01', worker
        ]).catch(() => {});
      }

      // 3. Live SMS Dispatch
      if (contact_number) {
        let smsText = `Barangay Pianing Health Center: Hello ${patient_name}, your ${program_type} on ${new Date().toLocaleDateString()} has been recorded.`;
        if (next_visit_date) {
          smsText += ` Next visit scheduled: ${next_visit_date}.`;
        }
        sendLiveSms(contact_number, smsText).catch(() => {});
        pool.query(
          "INSERT INTO sms_notifications (recipient_name, recipient_phone, type, message, status, sent_at) VALUES (?, ?, ?, ?, 'Sent', NOW())",
          [patient_name, contact_number, `${program_type} Confirmation`, smsText]
        ).catch(() => {});
      }

      const newConsultationRecord = {
        id: encounterId,
        patient_name: patient_name.trim(),
        contact_number: contact_number || '',
        phone: contact_number || '',
        age: age || '—',
        gender: gender || 'Female',
        civil_status: civil_status || 'Single',
        barangay: brgy,
        purok: purok || 'Purok 1',
        program_type: program_type,
        service_type: program_type,
        bp: bp || '120/80',
        temp: temp || '36.5',
        weight: weight || '',
        height: height || '',
        heart_rate: heart_rate || '',
        chief_complaint: chief_complaint || `${program_type} Intake`,
        diagnosis: diagnosis || 'Clinical Evaluation Complete',
        treatment: treatment || 'Routine care advised.',
        prescribed_meds: prescribed_meds || '',
        attending_nurse: worker,
        attending_worker: worker,
        consultation_date: new Date().toISOString().split('T')[0],
        encounter_date: new Date().toISOString().split('T')[0],
        next_visit_date: next_visit_date || null,
        status: 'Completed'
      };

      if (!mockData.consultations) mockData.consultations = [];
      mockData.consultations.unshift(newConsultationRecord);

      // Auto-dispense medications / vaccines from inventory
      if (vaccine_name) {
        dispenseInventoryItem(vaccine_name, 1, brgy).catch(() => {});
      }
      if (req.body.prescriptions && Array.isArray(req.body.prescriptions)) {
        for (const rx of req.body.prescriptions) {
          if (rx?.name) dispenseInventoryItem(rx.name, rx.quantity || 1, brgy).catch(() => {});
        }
      } else if (prescribed_meds) {
        const medsList = prescribed_meds.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
        for (const medStr of medsList) {
          dispenseInventoryItem(medStr, 1, brgy).catch(() => {});
        }
      }

      return res.status(201).json({
        success: true,
        encounterId,
        record: newConsultationRecord,
        message: `Clinical intake for ${patient_name} completed successfully.`,
        patient_name,
        program_type
      });
    } catch (err) {
      console.warn('MySQL intake error:', err.message);
    }
  }

  // In-memory fallback
  const intakeFallbackEncounter = {
    id: Date.now(),
    patient_name: patient_name.trim(),
    contact_number: contact_number || '',
    phone: contact_number || '',
    age: age || '—',
    gender: gender || 'Female',
    civil_status: civil_status || 'Single',
    barangay: brgy,
    purok: purok || 'Purok 1',
    program_type: program_type,
    service_type: program_type,
    bp: bp || '120/80',
    temp: temp || '36.5',
    weight: weight || '',
    height: height || '',
    heart_rate: heart_rate || '',
    chief_complaint: chief_complaint || `${program_type} Clinical Intake`,
    diagnosis: diagnosis || 'Evaluation Complete',
    treatment: treatment || 'Routine care advised.',
    prescribed_meds: prescribed_meds || '',
    attending_nurse: worker,
    attending_worker: worker,
    consultation_date: new Date().toISOString().split('T')[0],
    encounter_date: new Date().toISOString().split('T')[0],
    next_visit_date: next_visit_date || null,
    status: 'Completed'
  };

  if (!mockData.consultations) mockData.consultations = [];
  mockData.consultations.unshift(intakeFallbackEncounter);

  if (program_type === 'Prenatal') {
    if (!mockData.maternal) mockData.maternal = [];
    mockData.maternal.unshift({
      id: Date.now(),
      patient_name: patient_name.trim(),
      mother_name: patient_name.trim(),
      contact_number: contact_number || '',
      phone: contact_number || '',
      age: age || 24,
      barangay: brgy,
      gravida: gravida || 1,
      para: para || 0,
      lmp: lmp || '2026-01-01',
      edd: edd || '2026-10-01',
      aog_weeks: aog_weeks || '16 weeks',
      bp: bp || '115/75',
      weight: weight || '55 kg',
      temp: temp || '36.6°C',
      fetal_heart_rate: fetal_heart_rate || '142 bpm',
      fundic_height: fundic_height || '18 cm',
      prescribed_meds: prescribed_meds || 'Ferrous Sulfate + Folic Acid 1 tab OD',
      attending_nurse: worker,
      next_visit_date: next_visit_date || '2026-04-10'
    });
  } else if (program_type === 'NIP Immunization') {
    if (!mockData.immunizations) mockData.immunizations = [];
    mockData.immunizations.unshift({
      id: Date.now(),
      patient_name: patient_name.trim(),
      child_name: patient_name.trim(),
      parent_phone: contact_number || '',
      contact_number: contact_number || '',
      vaccine_name: vaccine_name || 'Pentavalent',
      dose_number: dose_number || 1,
      status: 'Completed',
      date_administered: new Date().toISOString().split('T')[0],
      due_date: due_date || next_visit_date || '2026-04-15',
      next_due_date: due_date || next_visit_date || '2026-04-15',
      administered_by: worker,
      remarks: 'Administered normally'
    });
  }

  // Auto-dispense medications / vaccines from inventory
  if (vaccine_name) {
    dispenseInventoryItem(vaccine_name, 1, brgy).catch(() => {});
  }
  if (req.body.prescriptions && Array.isArray(req.body.prescriptions)) {
    for (const rx of req.body.prescriptions) {
      if (rx?.name) dispenseInventoryItem(rx.name, rx.quantity || 1, brgy).catch(() => {});
    }
  } else if (prescribed_meds) {
    const medsList = prescribed_meds.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    for (const medStr of medsList) {
      dispenseInventoryItem(medStr, 1, brgy).catch(() => {});
    }
  }

  res.status(201).json({
    success: true,
    encounterId: intakeFallbackEncounter.id,
    record: intakeFallbackEncounter,
    message: `Clinical intake for ${patient_name} recorded (in-memory mode).`,
    patient_name,
    program_type
  });
});

// -------------------------------------------------------------
// Archives Hub Endpoint
// -------------------------------------------------------------
app.get('/api/archives/clinical', async (req, res) => {
  const pool = getPool();
  const { barangay } = req.query;
  const brgy = barangay ? String(barangay).trim().toLowerCase() : null;

  if (pool && getStatus().connected) {
    try {
      let consultQuery = "SELECT * FROM clinical_encounters WHERE 1=1";
      let maternalQuery = "SELECT * FROM maternal_records WHERE 1=1";
      let immQuery = "SELECT * FROM immunizations WHERE status = 'Completed'";
      let schedQuery = "SELECT * FROM clinic_schedules WHERE 1=1";
      let apptQuery = "SELECT * FROM health_appointments WHERE status IN ('Completed', 'Cancelled', 'No Show')";
      const params = [];

      if (brgy) {
        consultQuery += " AND LOWER(COALESCE(barangay, 'pianing')) LIKE ?";
        maternalQuery += " AND LOWER(COALESCE(barangay, 'pianing')) LIKE ?";
        immQuery += " AND LOWER(COALESCE(barangay, 'pianing')) LIKE ?";
        schedQuery += " AND LOWER(COALESCE(barangay, 'pianing')) LIKE ?";
        apptQuery += " AND LOWER(COALESCE(barangay, 'pianing')) LIKE ?";
        params.push(`%${brgy}%`);
      }

      const [consultations] = await pool.query(`${consultQuery} ORDER BY encounter_date DESC, id DESC LIMIT 100`, params);
      const [maternal] = await pool.query(`${maternalQuery} ORDER BY id DESC LIMIT 100`, params);
      const [immunizations] = await pool.query(`${immQuery} ORDER BY id DESC LIMIT 100`, params);
      const [schedules] = await pool.query(`${schedQuery} ORDER BY id DESC LIMIT 50`, params);
      const [appointments] = await pool.query(`${apptQuery} ORDER BY id DESC LIMIT 100`, params);

      return res.json({ consultations, maternal, immunizations, schedules, appointments });
    } catch (err) {
      console.warn('MySQL clinical archives fetch error:', err.message);
    }
  }

  let mockApts = (mockData.appointments || []).filter(a => a.status === 'Completed' || a.status === 'Cancelled' || a.status === 'No Show');
  let mockImm = (mockData.immunizations || []).filter(i => i.status === 'Completed');
  let mockMat = mockData.maternal || [];
  let mockSched = mockData.clinicSchedules || [];
  let mockConsult = mockData.consultations || [];

  if (brgy) {
    mockApts = mockApts.filter(a => (a.barangay || 'pianing').toLowerCase().includes(brgy));
    mockImm = mockImm.filter(i => (i.barangay || 'pianing').toLowerCase().includes(brgy));
    mockMat = mockMat.filter(m => (m.barangay || 'pianing').toLowerCase().includes(brgy));
    mockSched = mockSched.filter(s => (s.barangay || 'pianing').toLowerCase().includes(brgy));
    mockConsult = mockConsult.filter(c => (c.barangay || 'pianing').toLowerCase().includes(brgy));
  }

  res.json({
    consultations: mockConsult,
    maternal: mockMat,
    immunizations: mockImm,
    schedules: mockSched,
    appointments: mockApts
  });
});

// Manual 1-Day Scheduler Trigger (for testing & immediate dispatch)
app.post('/api/scheduler/run-1day-reminders', async (req, res) => {
  const result = await runOneDayAdvanceScheduler();
  res.json({ success: true, ...result });
});

// Serve static assets from Vite production build
app.use(express.static(path.resolve(__dirname, '../dist')));

// Handle React SPA wildcard routing in production
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.resolve(__dirname, '../dist/index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Start Server
app.listen(PORT, async () => {
  console.log(`🚀 Smart Barangay System Express API running on http://localhost:${PORT}`);
  const statusRes = await testConnection();
  if (statusRes.connected) {
    console.log(`✅ [MySQL] Connected successfully to ${statusRes.host}:${statusRes.port}/${statusRes.database}`);
    // If connected to a fresh database with 0 tables (e.g. Railway deploy), auto-create all tables and seed data!
    try {
      const pool = getPool();
      const [tableRows] = await pool.query("SHOW TABLES");
      if (!tableRows || tableRows.length === 0) {
        console.log(`📦 [Migration] Empty database detected on fresh deployment. Automatically running schema.sql and seed.sql...`);
        const { runMigration } = await import('./migrate.js');
        await runMigration();
      }
    } catch (tblErr) {
      console.warn('[Migration Check] Notice:', tblErr.message);
    }
    // Always run schema migration on startup to ensure columns are correct
    try {
      await migrateDatabase();
      console.log('✅ [Migration] Database schema verified and up-to-date.');
    } catch (migErr) {
      console.warn('[Migration] Warning:', migErr.message);
    }
  } else {
    console.log(`ℹ️ [MySQL Status] Attempting automatic migration & setup for database '${process.env.DB_NAME || 'smart_db'}'...`);
    const { runMigration } = await import('./migrate.js');
    const migRes = await runMigration();
    if (migRes.success) {
      await testConnection();
    } else {
      console.log(`ℹ️ [Note] ${migRes.error}. System running seamlessly with built-in memory storage engine.`);
    }
  }
});
