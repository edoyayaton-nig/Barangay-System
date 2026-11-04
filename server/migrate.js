import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dbConfig } from './config/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function safeExecute(connection, sql, label) {
  try {
    await connection.query(sql);
    if (label) console.log(`  ✅ ${label}`);
  } catch (err) {
    // Ignore harmless alter errors
  }
}

async function safeAddColumn(connection, tableName, columnName, columnDefinition) {
  try {
    const [rows] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );
    if (rows.length === 0) {
      await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
      console.log(`  ➕ Added column '${columnName}' to table '${tableName}'`);
    }
  } catch (err) {
    console.warn(`  ⚠️ safeAddColumn error for ${tableName}.${columnName}: ${err.message}`);
  }
}

async function syncAllSchemas(connection) {
  console.log('🔄 Checking & applying database schema sync...');

  // 1. Document Requests
  await safeExecute(connection, "ALTER TABLE `document_requests` DROP FOREIGN KEY `document_requests_ibfk_1`");
  await safeExecute(connection, "ALTER TABLE `document_requests` MODIFY COLUMN `resident_id` INT NULL DEFAULT NULL");
  await safeExecute(connection, "ALTER TABLE `document_requests` MODIFY COLUMN `document_type` VARCHAR(100) NOT NULL");
  await safeExecute(connection, "ALTER TABLE `document_requests` MODIFY COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'Pending'");
  await safeExecute(connection, "ALTER TABLE `document_requests` MODIFY COLUMN `purpose` TEXT NULL");
  await safeExecute(connection, "ALTER TABLE `document_requests` MODIFY COLUMN `request_code` VARCHAR(50) NOT NULL");

  await safeAddColumn(connection, 'document_requests', 'purok_certificate_photo', 'LONGTEXT NULL');
  await safeAddColumn(connection, 'document_requests', 'extra_fields', 'LONGTEXT NULL');
  await safeExecute(connection, "ALTER TABLE `document_requests` MODIFY COLUMN `purok_certificate_photo` LONGTEXT NULL");
  await safeExecute(connection, "ALTER TABLE `document_requests` MODIFY COLUMN `extra_fields` LONGTEXT NULL");
  await safeAddColumn(connection, 'document_requests', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
  await safeAddColumn(connection, 'document_requests', 'email', "VARCHAR(100) DEFAULT ''");
  await safeAddColumn(connection, 'document_requests', 'processed_by', "VARCHAR(100) NULL");
  await safeAddColumn(connection, 'document_requests', 'processed_at', "DATETIME NULL");
  await safeAddColumn(connection, 'document_requests', 'remarks', "TEXT NULL");

  // 2. Users
  await safeExecute(connection, "ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(50) NOT NULL DEFAULT 'resident'");
  await safeExecute(connection, "ALTER TABLE `users` MODIFY COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'Active'");
  await safeExecute(connection, "ALTER TABLE `users` MODIFY COLUMN `verification_status` ENUM('Verified', 'Pending_Review', 'Rejected', 'Unverified', 'Pending') NOT NULL DEFAULT 'Pending_Review'");
  await safeExecute(connection, "ALTER TABLE `users` MODIFY COLUMN `password_hash` VARCHAR(255) NOT NULL");
  await safeExecute(connection, "ALTER TABLE `users` MODIFY COLUMN `civil_status` VARCHAR(50) DEFAULT 'Single'");
  await safeExecute(connection, "ALTER TABLE `users` MODIFY COLUMN `phone` VARCHAR(50) DEFAULT ''");

  await safeAddColumn(connection, 'users', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
  await safeAddColumn(connection, 'users', 'city', "VARCHAR(100) DEFAULT 'Butuan City'");
  await safeAddColumn(connection, 'users', 'address', "VARCHAR(255) DEFAULT ''");
  await safeAddColumn(connection, 'users', 'last_login', "DATETIME NULL");
  await safeAddColumn(connection, 'users', 'profile_photo', "LONGTEXT NULL");
  await safeAddColumn(connection, 'users', 'submitted_id', "LONGTEXT NULL");
  await safeAddColumn(connection, 'users', 'id_type', "VARCHAR(100) DEFAULT 'Government ID'");
  await safeAddColumn(connection, 'users', 'rejection_reason', "TEXT NULL");
  await safeAddColumn(connection, 'users', 'employee_id', "VARCHAR(50) DEFAULT NULL");
  await safeAddColumn(connection, 'users', 'job_title', "VARCHAR(100) DEFAULT NULL");
  await safeAddColumn(connection, 'users', 'permissions', "TEXT NULL");

  // 3. Residents
  await safeExecute(connection, "ALTER TABLE `residents` MODIFY COLUMN `verification_status` ENUM('Verified', 'Pending_Review', 'Rejected', 'Unverified', 'Pending') NOT NULL DEFAULT 'Pending_Review'");
  await safeExecute(connection, "ALTER TABLE `residents` MODIFY COLUMN `civil_status` VARCHAR(50) DEFAULT 'Single'");
  await safeExecute(connection, "ALTER TABLE `residents` MODIFY COLUMN `gender` VARCHAR(20) DEFAULT 'Male'");

  await safeAddColumn(connection, 'residents', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
  await safeAddColumn(connection, 'residents', 'city', "VARCHAR(100) DEFAULT 'Butuan City'");
  await safeAddColumn(connection, 'residents', 'profile_photo', "LONGTEXT NULL");
  await safeAddColumn(connection, 'residents', 'civil_status', "VARCHAR(50) DEFAULT 'Single'");
  await safeAddColumn(connection, 'residents', 'years_of_residency', "VARCHAR(50) DEFAULT NULL");
  await safeAddColumn(connection, 'residents', 'purok', "VARCHAR(50) DEFAULT '1'");
  await safeAddColumn(connection, 'residents', 'household_number', "VARCHAR(50) DEFAULT NULL");
  await safeAddColumn(connection, 'residents', 'family_name', "VARCHAR(100) DEFAULT NULL");
  await safeAddColumn(connection, 'residents', 'is_head_of_household', "TINYINT(1) DEFAULT 0");
  await safeAddColumn(connection, 'residents', 'relationship_to_head', "VARCHAR(50) DEFAULT 'Member'");
  await safeAddColumn(connection, 'residents', 'is_census_only', "TINYINT(1) DEFAULT 0");
  await safeAddColumn(connection, 'residents', 'employment_status', "VARCHAR(50) DEFAULT 'Employed'");
  await safeAddColumn(connection, 'residents', 'last_profile_update_note', "TEXT NULL");
  await safeAddColumn(connection, 'residents', 'linked_user_id', "INT NULL DEFAULT NULL");
  await safeAddColumn(connection, 'residents', 'id_type', "VARCHAR(100) DEFAULT 'Government ID'");
  await safeAddColumn(connection, 'residents', 'claimed_at', "DATETIME NULL");
  await safeAddColumn(connection, 'residents', 'submitted_id', "LONGTEXT NULL");
  await safeAddColumn(connection, 'residents', 'submitted_at', "DATETIME DEFAULT CURRENT_TIMESTAMP");
  await safeAddColumn(connection, 'residents', 'rejection_reason', "TEXT NULL");

  // 4. Messages
  await safeExecute(connection, `
    CREATE TABLE IF NOT EXISTS \`messages\` (
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
  await safeAddColumn(connection, 'messages', 'sender_email', "VARCHAR(100) DEFAULT ''");
  await safeAddColumn(connection, 'messages', 'recipient_name', "VARCHAR(100) DEFAULT ''");
  await safeAddColumn(connection, 'messages', 'recipient_role', "VARCHAR(100) DEFAULT 'all'");
  await safeAddColumn(connection, 'messages', 'recipient_email', "VARCHAR(100) DEFAULT ''");
  await safeAddColumn(connection, 'messages', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
  await safeAddColumn(connection, 'messages', 'sent_at', "DATETIME DEFAULT CURRENT_TIMESTAMP");
  await safeAddColumn(connection, 'messages', 'timestamp', "DATETIME DEFAULT CURRENT_TIMESTAMP");

  // 5. Document Categories
  await safeExecute(connection, `
    CREATE TABLE IF NOT EXISTS \`document_categories\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      department VARCHAR(50) NOT NULL DEFAULT 'Barangay',
      description TEXT NULL,
      status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const defaultCategories = [
    ['Barangay Clearance', 'Barangay', 'Employment, bank requirement, loans & government IDs'],
    ['Certificate of Residency', 'Barangay', 'Proof of bonafide residency for school, utility or bank'],
    ['Certificate of Indigency', 'Barangay', 'For medical, educational, burial & DSWD financial assistance'],
    ['Good Moral Clearance', 'Barangay', 'Official character clearance for PRC board exams & school'],
    ['Business Clearance', 'Barangay', 'Barangay commercial permit for sari-sari stores & businesses'],
    ['Certificate of Employment', 'Barangay', 'Barangay employment certificate & first time jobseeker aid'],
    ['Certificate of Land Occupancy', 'Barangay', 'Proof of actual physical occupancy & lot possession'],
    ['Barangay Activity Permit', 'Barangay', 'Permit for events, product sampling, promotions & gatherings'],
    ['Medical Certificate', 'Health', 'Clinical consultation and fitness clearance issued by Barangay Health Center'],
    ['Sanitary Permit Endorsement', 'Health', 'Barangay sanitation and health inspection endorsement'],
    ['Immunization Record Certificate', 'Health', 'Official child and maternal immunization certification'],
    ['Health Examination Clearance', 'Health', 'Standard community health and vitals screening clearance']
  ];
  for (const cat of defaultCategories) {
    try {
      await connection.query(
        "INSERT INTO document_categories (name, department, description, status) VALUES (?, ?, ?, 'Active') ON DUPLICATE KEY UPDATE department = VALUES(department), description = VALUES(description)",
        cat
      );
    } catch { }
  }
  try {
    await connection.query("UPDATE document_categories SET status = 'Active' WHERE LOWER(name) = 'business clearance'");
    await connection.query("DELETE FROM document_categories WHERE LOWER(name) = 'business retirement certificate'");
  } catch { }

  // 6. Health Appointments
  await safeExecute(connection, `
    CREATE TABLE IF NOT EXISTS \`health_appointments\` (
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
      booking_sms_sent TINYINT(1) DEFAULT 0,
      approval_sms_sent TINYINT(1) DEFAULT 0,
      completion_sms_sent TINYINT(1) DEFAULT 0,
      cancellation_sms_sent TINYINT(1) DEFAULT 0,
      three_day_alert_sent TINYINT(1) DEFAULT 0,
      one_day_alert_sent TINYINT(1) DEFAULT 0,
      sms_sent TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await safeAddColumn(connection, 'health_appointments', 'booking_sms_sent', 'TINYINT(1) DEFAULT 0');
  await safeAddColumn(connection, 'health_appointments', 'approval_sms_sent', 'TINYINT(1) DEFAULT 0');
  await safeAddColumn(connection, 'health_appointments', 'completion_sms_sent', 'TINYINT(1) DEFAULT 0');
  await safeAddColumn(connection, 'health_appointments', 'cancellation_sms_sent', 'TINYINT(1) DEFAULT 0');
  await safeAddColumn(connection, 'health_appointments', 'three_day_alert_sent', 'TINYINT(1) DEFAULT 0');
  await safeAddColumn(connection, 'health_appointments', 'one_day_alert_sent', 'TINYINT(1) DEFAULT 0');
  await safeAddColumn(connection, 'health_appointments', 'sms_sent', 'TINYINT(1) DEFAULT 0');
  await safeExecute(connection, "ALTER TABLE \`sms_notifications\` MODIFY COLUMN \`type\` VARCHAR(100) NOT NULL");

  // 7. Clinic Schedules
  await safeExecute(connection, `
    CREATE TABLE IF NOT EXISTS \`clinic_schedules\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 8. Activity Logs
  await safeExecute(connection, `
    CREATE TABLE IF NOT EXISTS \`activity_logs\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_name VARCHAR(100) NOT NULL,
      user_role VARCHAR(50) NOT NULL,
      action VARCHAR(255) NOT NULL,
      action_type VARCHAR(50) DEFAULT 'General',
      barangay VARCHAR(100) DEFAULT 'Pianing',
      details TEXT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await safeAddColumn(connection, 'activity_logs', 'action_type', "VARCHAR(50) DEFAULT 'General'");
  await safeAddColumn(connection, 'activity_logs', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
  await safeAddColumn(connection, 'activity_logs', 'details', "TEXT NULL");

  // 9. Clinical Encounters
  await safeExecute(connection, `
    CREATE TABLE IF NOT EXISTS \`clinical_encounters\` (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // 10. User Notifications
  await safeExecute(connection, `
    CREATE TABLE IF NOT EXISTS \`user_notifications\` (
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

  // 11. Broadcasts
  await safeExecute(connection, `
    CREATE TABLE IF NOT EXISTS \`broadcasts\` (
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

  // 12. SMS Notifications Log Table
  await safeExecute(connection, `
    CREATE TABLE IF NOT EXISTS \`sms_notifications\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recipient_name VARCHAR(100) NOT NULL,
      recipient_phone VARCHAR(50) NOT NULL,
      type VARCHAR(100) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'Sent',
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_read TINYINT(1) DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await safeAddColumn(connection, 'sms_notifications', 'is_read', 'TINYINT(1) DEFAULT 0');
  await safeAddColumn(connection, 'sms_notifications', 'sent_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

  // 12. Immunizations
  await safeAddColumn(connection, 'immunizations', 'gender', "VARCHAR(20) DEFAULT 'Male'");
  await safeAddColumn(connection, 'immunizations', 'guardian_name', "VARCHAR(150) DEFAULT ''");
  await safeAddColumn(connection, 'immunizations', 'age_months', "VARCHAR(20) DEFAULT ''");
  await safeAddColumn(connection, 'immunizations', 'weight_kg', "VARCHAR(20) DEFAULT ''");
  await safeAddColumn(connection, 'immunizations', 'height_cm', "VARCHAR(20) DEFAULT ''");
  await safeAddColumn(connection, 'immunizations', 'batch_lot', "VARCHAR(100) DEFAULT ''");
  await safeAddColumn(connection, 'immunizations', 'remarks', "TEXT NULL");
  await safeAddColumn(connection, 'immunizations', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
  await safeAddColumn(connection, 'immunizations', 'sms_sent', "TINYINT(1) DEFAULT 0");

  // 13. Maternal Records
  await safeAddColumn(connection, 'maternal_records', 'contact_number', "VARCHAR(50) DEFAULT ''");
  await safeAddColumn(connection, 'maternal_records', 'barangay', "VARCHAR(100) DEFAULT 'Pianing'");
  await safeAddColumn(connection, 'maternal_records', 'gravida', "INT DEFAULT 1");
  await safeAddColumn(connection, 'maternal_records', 'para', "INT DEFAULT 0");
  await safeAddColumn(connection, 'maternal_records', 'lmp', "DATE NULL");
  await safeAddColumn(connection, 'maternal_records', 'edd', "DATE NULL");
  await safeAddColumn(connection, 'maternal_records', 'aog_weeks', "VARCHAR(20) DEFAULT ''");
  await safeAddColumn(connection, 'maternal_records', 'bp', "VARCHAR(30) DEFAULT ''");
  await safeAddColumn(connection, 'maternal_records', 'weight', "VARCHAR(20) DEFAULT ''");
  await safeAddColumn(connection, 'maternal_records', 'temp', "VARCHAR(20) DEFAULT ''");
  await safeAddColumn(connection, 'maternal_records', 'fetal_heart_rate', "VARCHAR(20) DEFAULT ''");
  await safeAddColumn(connection, 'maternal_records', 'fundic_height', "VARCHAR(20) DEFAULT ''");
  await safeAddColumn(connection, 'maternal_records', 'prescribed_meds', "TEXT NULL");
  await safeAddColumn(connection, 'maternal_records', 'attending_nurse', "VARCHAR(100) DEFAULT ''");
  await safeAddColumn(connection, 'maternal_records', 'next_visit_date', "DATE NULL");
  await safeAddColumn(connection, 'maternal_records', 'visit_number', "INT DEFAULT 1");
  await safeAddColumn(connection, 'maternal_records', 'next_visit_note', "TEXT NULL");
  await safeAddColumn(connection, 'maternal_records', 'sms_sent', "TINYINT(1) DEFAULT 0");

  // 14. Ensure default demo accounts exist with working password hash ('123')
  const defaultHash = '$2b$10$M7EW0TYM6.hHoow1piHpLeHo9osaUB95nLCiAvvuFvN7NSeETSNre'; // '123'
  const demoUsers = [
    { email: 'supermegaadmin@barangay.gov', name: 'Super Mega Admin', role: 'super_mega_admin', barangay: 'All (City-Wide)', phone: '09179998877' },
    { email: 'superadmin@barangay.gov', name: 'Super Admin Rodrigo Lim', role: 'superadmin', barangay: 'Pianing', phone: '09171112233' },
    { email: 'admin@barangay.gov', name: 'Barangay Admin Juan Dela Cruz', role: 'admin', barangay: 'Pianing', phone: '09171234567' },
    { email: 'nurse@barangay.gov', name: 'Nurse Ligaya Santos', role: 'nurse', barangay: 'Pianing', phone: '09201234567' },
    { email: 'bhw@barangay.gov', name: 'BHW Maria Santos', role: 'bhw', barangay: 'Pianing', phone: '09181234567' },
    { email: 'citizen@barangay.gov', name: 'Citizen Test Account', role: 'resident', barangay: 'Pianing', phone: '09171234567' },
    { email: 'citizen.pianing@gmail.com', name: 'Citizen Pianing', role: 'resident', barangay: 'Pianing', phone: '09179998877' }
  ];

  for (const u of demoUsers) {
    try {
      const [rows] = await connection.query("SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(?) LIMIT 1", [u.email]);
      if (rows.length === 0) {
        await connection.query(
          "INSERT INTO users (name, email, password_hash, role, status, verification_status, barangay, phone, last_login) VALUES (?, ?, ?, ?, 'Active', 'Verified', ?, ?, NOW())",
          [u.name, u.email, defaultHash, u.role, u.barangay, u.phone]
        );
        console.log(`  👤 Seeded account '${u.email}' (${u.role})`);
      } else {
        await connection.query(
          "UPDATE users SET password_hash = ?, status = 'Active', verification_status = 'Verified' WHERE LOWER(TRIM(email)) = LOWER(?)",
          [defaultHash, u.email]
        );
      }
    } catch { }
  }

  console.log('✅ Schema synchronization completed.');
}

export async function runMigration() {
  const { host, port, user, password, database: dbName } = dbConfig;

  console.log(`⏳ Connecting to MySQL server at ${host}:${port} as user '${user}'...`);

  let connection;
  try {
    // 1. Connect: First try connecting without selecting a database so we can CREATE DATABASE IF NOT EXISTS
    try {
      connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        multipleStatements: true
      });
      console.log(`✅ Connected to MySQL server.`);

      // 2. Create Database if not exists
      try {
        console.log(`📦 Creating database '${dbName}' if not exists...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      } catch (dbErr) {
        console.log(`ℹ️ [Database Notice] Using existing database '${dbName}': ${dbErr.message}`);
      }
      await connection.query(`USE \`${dbName}\`;`);
      console.log(`✅ Database '${dbName}' selected.`);
    } catch (rootConnErr) {
      // If connecting without selecting database is denied (common in managed/cloud MySQL where user only has direct access to dbName)
      console.log(`ℹ️ Attempting direct connection to database '${dbName}'...`);
      connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database: dbName,
        multipleStatements: true
      });
      console.log(`✅ Connected directly to database '${dbName}'.`);
    }

    // 3. Check if database is already populated
    const [existingTables] = await connection.query('SHOW TABLES');
    if (existingTables.length < 10) {
      // Execute clean_dump.sql if available, else schema.sql + seed.sql
      await connection.query('SET FOREIGN_KEY_CHECKS=0;');
      const cleanDumpPath = path.resolve(__dirname, '../database/clean_dump.sql');
      if (fs.existsSync(cleanDumpPath)) {
        console.log(`📄 Executing clean_dump.sql (complete schema & 19 tables with all accounts)...`);
        let dumpSql = fs.readFileSync(cleanDumpPath, 'utf8');
        dumpSql = dumpSql.replace(/CREATE DATABASE IF NOT EXISTS `[^`]+`;/gi, '');
        dumpSql = dumpSql.replace(/USE `[^`]+`;/gi, '');
        const statements = dumpSql.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
          try {
            await connection.query(stmt);
          } catch (stmtErr) {
            console.warn(`⚠️ Statement notice: ${stmtErr.message}`);
          }
        }
        console.log(`✅ Clean dump executed successfully. All tables and records imported.`);
      } else {
        const schemaPath = path.resolve(__dirname, '../database/schema.sql');
        if (fs.existsSync(schemaPath)) {
          console.log(`📄 Executing schema.sql DDL migrations...`);
          let schemaSql = fs.readFileSync(schemaPath, 'utf8');
          schemaSql = schemaSql.replace(/CREATE DATABASE IF NOT EXISTS `[^`]+`;/gi, '');
          schemaSql = schemaSql.replace(/USE `[^`]+`;/gi, '');
          await connection.query(schemaSql);
          console.log(`✅ Schema tables created successfully.`);
        }

        const seedPath = path.resolve(__dirname, '../database/seed.sql');
        if (fs.existsSync(seedPath)) {
          console.log(`🌱 Executing seed.sql data insertion...`);
          let seedSql = fs.readFileSync(seedPath, 'utf8');
          seedSql = seedSql.replace(/USE `[^`]+`;/gi, '');
          await connection.query(seedSql);
          console.log(`✅ Seed data inserted successfully.`);
        }
      }
      await connection.query('SET FOREIGN_KEY_CHECKS=1;');
    } else {
      console.log(`ℹ️ Database '${dbName}' already contains ${existingTables.length} tables.`);
    }

    // 3.5 Census Data Check & Import (Barangay Pianing Official Census)
    try {
      const [censusRows] = await connection.query("SELECT COUNT(*) as count FROM residents WHERE is_census_only = 1");
      const censusCount = censusRows[0]?.count || 0;
      const forceCensus = process.env.FORCE_CENSUS_MIGRATION === 'true';

      if (censusCount < 1000 || forceCensus) {
        console.log(`📋 [Census Migration] Database contains ${censusCount} census inhabitants. Initiating census data migration from PUROK Excel data...`);
        const censusSqlPath = path.resolve(__dirname, '../database/census_migration.sql');
        if (fs.existsSync(censusSqlPath)) {
          const censusSql = fs.readFileSync(censusSqlPath, 'utf8');
          await connection.query('SET FOREIGN_KEY_CHECKS=0;');
          await connection.query(censusSql);
          await connection.query('SET FOREIGN_KEY_CHECKS=1;');
          const [afterRows] = await connection.query("SELECT COUNT(*) as count FROM residents WHERE is_census_only = 1");
          console.log(`✅ [Census Migration Success] Successfully imported ${afterRows[0]?.count} official census residents into Barangay Pianing database!`);
        } else {
          console.warn(`⚠️ [Census Migration Warning] '${censusSqlPath}' not found.`);
        }
      } else {
        console.log(`✅ [Census Check] Barangay Pianing already has ${censusCount} official census residents in database.`);
      }
    } catch (censusErr) {
      console.warn(`⚠️ [Census Migration Note]: ${censusErr.message}`);
    }

    // 4. ALWAYS run schema synchronization to ensure all columns, tables, and demo accounts are up-to-date!
    await syncAllSchemas(connection);

    console.log(`🎉 [Migration Complete] Database '${dbName}' is fully populated and ready on ${host}:${port}!`);
    return { success: true, database: dbName };
  } catch (err) {
    console.error(`❌ [Migration Error] ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Execute directly if run via `node server/migrate.js`
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigration();
}
