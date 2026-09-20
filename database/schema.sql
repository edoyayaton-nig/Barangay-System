-- =========================================================
-- Smart Barangay System - MySQL Database Schema (DDL)
-- Administrative Management and Public Health Monitoring
-- =========================================================
-- NOTE: If you want to change the database name for XAMPP / phpMyAdmin,
-- change `smart_barangay_db` below and update `DB_NAME` in your `.env` file!

-- Note: Targets the currently selected database (e.g. railway or smart_db)

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `faq_knowledge`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `sms_notifications`;
DROP TABLE IF EXISTS `immunizations`;
DROP TABLE IF EXISTS `child_health_records`;
DROP TABLE IF EXISTS `maternal_records`;
DROP TABLE IF EXISTS `document_requests`;
DROP TABLE IF EXISTS `residents`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. System Users (Super Mega Admin, Super Admin, Barangay Admin, Barangay Staff, Nurse, BHW, Resident)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'resident',
  `status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  `verification_status` ENUM('Verified', 'Unverified', 'Pending_Review', 'Rejected') NOT NULL DEFAULT 'Verified',
  `civil_status` ENUM('Single', 'Married', 'Widowed', 'Separated') DEFAULT 'Single',
  `phone` VARCHAR(20) DEFAULT '',
  `address` VARCHAR(255) DEFAULT '',
  `barangay` VARCHAR(100) DEFAULT 'Pianing',
  `last_login` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Residents Demographic Records
CREATE TABLE IF NOT EXISTS `residents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(50) NOT NULL,
  `middle_name` VARCHAR(50) DEFAULT '',
  `last_name` VARCHAR(50) NOT NULL,
  `date_of_birth` DATE NULL DEFAULT '2000-01-01',
  `gender` ENUM('Male', 'Female', 'Other') DEFAULT 'Male',
  `civil_status` ENUM('Single', 'Married', 'Widowed', 'Separated') DEFAULT 'Single',
  `address` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) DEFAULT '',
  `email` VARCHAR(100) DEFAULT '',
  `submitted_id` LONGTEXT NULL,
  `submitted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `years_of_residency` VARCHAR(50) DEFAULT NULL COMMENT 'How many years resident has lived in barangay',
  `verification_status` ENUM('Verified', 'Unverified', 'Pending_Review', 'Rejected') DEFAULT 'Pending_Review',
  `rejection_reason` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Document Clearance & Certificate Requests
CREATE TABLE IF NOT EXISTS `document_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `request_code` VARCHAR(20) NOT NULL UNIQUE,
  `resident_id` INT NOT NULL,
  `resident_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) DEFAULT '',
  `document_type` VARCHAR(100) NOT NULL,
  `purpose` VARCHAR(255) DEFAULT '',
  `status` ENUM('Pending', 'Processing', 'Completed', 'Rejected') NOT NULL DEFAULT 'Pending',
  `requested_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `processed_at` DATETIME NULL,
  `processed_by` VARCHAR(100) DEFAULT '',
  `remarks` TEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Maternal Healthcare Records
CREATE TABLE IF NOT EXISTS `maternal_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `resident_id` INT NOT NULL,
  `mother_name` VARCHAR(100) NOT NULL,
  `age` INT NOT NULL,
  `pregnancy_status` VARCHAR(100) NOT NULL, -- e.g., Prenatal - 1st Trimester, Postnatal - 2 weeks
  `expected_due_date` DATE NULL,
  `last_visit` DATE NOT NULL,
  `next_visit` DATE NOT NULL,
  `risk_level` ENUM('Low', 'Moderate', 'High') DEFAULT 'Low',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`resident_id`) REFERENCES `residents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Child Health & Growth Records
CREATE TABLE IF NOT EXISTS `child_health_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `child_name` VARCHAR(100) NOT NULL,
  `mother_id` INT NULL,
  `mother_name` VARCHAR(100) DEFAULT '',
  `date_of_birth` DATE NOT NULL,
  `gender` ENUM('Male', 'Female') NOT NULL,
  `weight_kg` DECIMAL(4,2) DEFAULT NULL,
  `height_cm` DECIMAL(5,2) DEFAULT NULL,
  `blood_type` VARCHAR(5) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Immunization & Vaccine Logs
CREATE TABLE IF NOT EXISTS `immunizations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `child_name` VARCHAR(100) NOT NULL,
  `parent_phone` VARCHAR(20) DEFAULT '',
  `vaccine_name` VARCHAR(100) NOT NULL, -- BCG, Hepatitis B, DPT, Polio, MMR
  `dose_number` INT DEFAULT 1,
  `status` ENUM('Completed', 'Scheduled', 'Overdue') NOT NULL DEFAULT 'Scheduled',
  `date_administered` DATE NULL,
  `due_date` DATE NOT NULL,
  `days_overdue` INT DEFAULT 0,
  `administered_by` VARCHAR(100) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. SMS Notification Logs
CREATE TABLE IF NOT EXISTS `sms_notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `recipient_name` VARCHAR(100) NOT NULL,
  `recipient_phone` VARCHAR(20) NOT NULL,
  `type` ENUM('Immunization Reminder', 'Document Ready', 'Barangay Announcement', 'Maternal Checkup Alert') NOT NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('Sent', 'Failed', 'Pending') DEFAULT 'Sent',
  `sent_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Barangay Activity Audit Logs
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_name` VARCHAR(100) NOT NULL,
  `user_role` VARCHAR(50) NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Intra-System Messenger (Barangay Admin <-> BHW/Staff Chat)
CREATE TABLE IF NOT EXISTS `messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sender_name` VARCHAR(100) NOT NULL,
  `sender_role` ENUM('superadmin', 'admin', 'staff', 'bhw', 'resident') NOT NULL,
  `recipient_role` ENUM('admin', 'staff', 'bhw', 'all') NOT NULL DEFAULT 'all',
  `message` TEXT NOT NULL,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. FAQ Chatbot Knowledge Base
CREATE TABLE IF NOT EXISTS `faq_knowledge` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `topic` VARCHAR(100) NOT NULL,
  `keywords` TEXT NOT NULL,
  `response` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Broadcasts (Emergency Alerts, Advisories, Public Announcements)
CREATE TABLE IF NOT EXISTS `broadcasts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `severity` ENUM('Emergency', 'Advisory', 'Info') NOT NULL DEFAULT 'Info',
  `target_barangay` VARCHAR(100) NOT NULL DEFAULT 'All',
  `target_audience` ENUM('All', 'Residents', 'Staff') NOT NULL DEFAULT 'All',
  `created_by` VARCHAR(100) NOT NULL DEFAULT 'Super Admin',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Family Planning Records (Health Center)
CREATE TABLE IF NOT EXISTS `family_planning_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `patient_name` VARCHAR(255) NOT NULL,
  `contact_number` VARCHAR(50) DEFAULT '',
  `age` VARCHAR(20) DEFAULT '',
  `barangay` VARCHAR(100) DEFAULT 'Pianing',
  `purok` VARCHAR(100) DEFAULT 'Purok 1',
  `method_chosen` VARCHAR(100) NOT NULL,
  `client_type` ENUM('New Acceptor', 'Current User', 'Method Switch') DEFAULT 'New Acceptor',
  `date_given` DATE DEFAULT (CURRENT_DATE),
  `next_supply_date` DATE NOT NULL,
  `attending_worker` VARCHAR(255) DEFAULT 'Healthcare Worker',
  `remarks` TEXT DEFAULT NULL,
  `status` ENUM('Active', 'Completed', 'Archived') DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. User Notifications (In-App Alerts)
CREATE TABLE IF NOT EXISTS `user_notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `recipient_email` VARCHAR(100) NOT NULL,
  `type` VARCHAR(100) NOT NULL DEFAULT 'System',
  `title` VARCHAR(255) NOT NULL DEFAULT '',
  `message` TEXT NOT NULL,
  `ref_code` VARCHAR(50) DEFAULT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_recipient` (`recipient_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


