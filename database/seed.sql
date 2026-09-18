-- =========================================================
-- Smart Barangay System - MySQL Seed Data
-- =========================================================

USE `smart_db`;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `users`;
TRUNCATE TABLE `residents`;
TRUNCATE TABLE `document_requests`;
TRUNCATE TABLE `maternal_records`;
TRUNCATE TABLE `immunizations`;
TRUNCATE TABLE `sms_notifications`;
TRUNCATE TABLE `activity_logs`;
TRUNCATE TABLE `messages`;
TRUNCATE TABLE `faq_knowledge`;
SET FOREIGN_KEY_CHECKS = 1;

-- Seed Users (Roles: super_mega_admin, superadmin, admin, staff, nurse, bhw, resident)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `status`, `verification_status`, `last_login`) VALUES
(1, 'Super Admin Rodrigo Lim', 'superadmin@barangay.gov', '123', 'superadmin', 'Active', 'Verified', NOW()),
(2, 'Barangay Captain Juan Dela Cruz', 'admin@barangay.gov', '123', 'admin', 'Active', 'Verified', NOW()),
(3, 'Barangay Clerk Ana Reyes', 'staff@barangay.gov', '123', 'staff', 'Active', 'Verified', NOW() - INTERVAL 1 DAY),
(4, 'Nurse Maria Santos', 'bhw@barangay.gov', '123', 'bhw', 'Active', 'Verified', NOW()),
(5, 'Juan Resident Dela Cruz', 'resident@gmail.com', '123', 'resident', 'Active', 'Verified', NOW() - INTERVAL 1 DAY),
(6, 'Josefina Villanueva', 'josefina@gmail.com', '123', 'resident', 'Active', 'Pending_Review', NOW() - INTERVAL 3 DAY),
(7, 'Nurse Ligaya Santos', 'nurse@barangay.gov', '123', 'nurse', 'Active', 'Verified', NOW()),
(28, 'Super Mega Admin', 'supermegaadmin@barangay.gov', '123', 'super_mega_admin', 'Active', 'Verified', NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `email` = VALUES(`email`), `role` = VALUES(`role`), `verification_status` = VALUES(`verification_status`);

-- Seed Residents
INSERT INTO `residents` (`id`, `first_name`, `middle_name`, `last_name`, `date_of_birth`, `gender`, `civil_status`, `address`, `phone`, `email`, `verification_status`, `submitted_id`) VALUES
(1, 'Juan', 'Perez', 'Dela Cruz', '1988-04-12', 'Male', 'Married', 'Purok 1, Barangay Pianing, Butuan City', '09171234567', 'juan.resident@gmail.com', 'Verified', NULL),
(2, 'Maria', 'Clara', 'Santos', '1992-08-25', 'Female', 'Single', 'Purok 2, Barangay Pianing, Butuan City', '09182345678', 'maria.santos@gmail.com', 'Verified', NULL),
(3, 'Pedro', 'Alcantara', 'Garcia', '1985-11-03', 'Male', 'Married', 'Purok 3, Barangay Pianing, Butuan City', '09193456789', 'pedro.garcia@gmail.com', 'Verified', NULL),
(4, 'Ana', 'Bautista', 'Reyes', '1995-02-14', 'Female', 'Single', 'Purok 4, Barangay Pianing, Butuan City', '09204567890', 'ana.reyes@gmail.com', 'Verified', NULL),
(5, 'Teresa', 'Luna', 'Ramos', '1994-06-18', 'Female', 'Married', 'Purok 5, Barangay Pianing, Butuan City', '09215678901', 'teresa.ramos@gmail.com', 'Verified', NULL),
(6, 'Josefina', '', 'Villanueva', '1996-09-10', 'Female', 'Single', 'Purok 1, Barangay Pianing, Butuan City', '09311234567', 'josefina.resident@gmail.com', 'Pending_Review', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400')
ON DUPLICATE KEY UPDATE `first_name` = VALUES(`first_name`), `verification_status` = VALUES(`verification_status`);

-- Seed Document Requests
INSERT INTO `document_requests` (`id`, `request_code`, `resident_id`, `resident_name`, `document_type`, `purpose`, `status`, `requested_at`, `processed_at`, `processed_by`) VALUES
(1, 'DOC-001', 1, 'Juan Dela Cruz', 'Barangay Clearance', 'Employment Requirements', 'Pending', NOW() - INTERVAL 3 HOUR, NULL, ''),
(2, 'DOC-002', 2, 'Maria Santos', 'Certificate of Residency', 'Bank Account Opening', 'Processing', NOW() - INTERVAL 2 HOUR, NULL, ''),
(3, 'DOC-003', 3, 'Pedro Garcia', 'Business Permit', 'Sari-Sari Store Operation', 'Pending', NOW() - INTERVAL 1 DAY, NULL, ''),
(4, 'DOC-004', 4, 'Ana Reyes', 'Barangay ID', 'Personal Identification', 'Completed', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 4 HOUR, 'Admin Juan')
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- Seed Maternal Records
INSERT INTO `maternal_records` (`id`, `resident_id`, `mother_name`, `age`, `pregnancy_status`, `expected_due_date`, `last_visit`, `next_visit`, `risk_level`, `notes`) VALUES
(1, 5, 'Teresa Ramos', 29, 'Prenatal - 2nd Trimester', '2026-09-15', '2026-05-01', '2026-05-15', 'Low', 'Normal blood pressure. Prescribed prenatal vitamins.'),
(2, 2, 'Rosa Mendez', 31, 'Prenatal - 3rd Trimester', '2026-06-10', '2026-04-28', '2026-05-12', 'Moderate', 'Monitor blood sugar levels twice a week.'),
(3, 4, 'Lucia Torres', 26, 'Postnatal - 2 weeks', NULL, '2026-05-03', '2026-05-17', 'Low', 'Healthy newborn recovery. Exclusive breastfeeding.')
ON DUPLICATE KEY UPDATE `mother_name` = VALUES(`mother_name`);

-- Seed Child Health & Immunizations
INSERT INTO `immunizations` (`id`, `child_name`, `parent_phone`, `vaccine_name`, `dose_number`, `status`, `date_administered`, `due_date`, `days_overdue`, `administered_by`) VALUES
(1, 'Baby Maria Santos', '09182345678', 'BCG', 1, 'Completed', '2026-05-05', '2026-05-05', 0, 'BHW Maria'),
(2, 'Baby Juan Dela Cruz', '09171234567', 'Hepatitis B', 1, 'Completed', '2026-05-04', '2026-05-04', 0, 'BHW Maria'),
(3, 'Baby Ana Reyes', '09204567890', 'DPT', 2, 'Completed', '2026-05-03', '2026-05-03', 0, 'BHW Maria'),
(4, 'Baby Sofia Martinez', '09226789012', 'MMR', 1, 'Overdue', NULL, '2026-04-20', 16, ''),
(5, 'Baby Carlos Lopez', '09237890123', 'DPT Booster', 3, 'Overdue', NULL, '2026-04-25', 11, ''),
(6, 'Baby Elena Cruz', '09248901234', 'Hepatitis B', 2, 'Overdue', NULL, '2026-04-28', 8, '')
ON DUPLICATE KEY UPDATE `child_name` = VALUES(`child_name`);

-- Seed SMS Notifications
INSERT INTO `sms_notifications` (`id`, `recipient_name`, `recipient_phone`, `type`, `message`, `status`, `sent_at`) VALUES
(1, 'Sofia Martinez', '09226789012', 'Immunization Reminder', 'Reminder: Baby Sofia is scheduled for MMR vaccine at Barangay Health Center.', 'Sent', NOW() - INTERVAL 1 DAY),
(2, 'Juan Dela Cruz', '09171234567', 'Document Ready', 'Your Barangay Clearance request DOC-001 is now being processed.', 'Sent', NOW() - INTERVAL 3 HOUR);

-- Seed Activity Logs
INSERT INTO `activity_logs` (`id`, `user_name`, `user_role`, `action`, `timestamp`) VALUES
(1, 'Admin Juan', 'Admin', 'Approved Barangay ID for Ana Reyes (DOC-004)', NOW() - INTERVAL 4 HOUR),
(2, 'BHW Maria', 'BHW', 'Administered BCG vaccine to Baby Maria Santos', NOW() - INTERVAL 1 DAY);

-- Seed System Messages (Barangay Admin <-> BHW Staff)
INSERT INTO `messages` (`id`, `sender_name`, `sender_role`, `recipient_role`, `message`, `timestamp`) VALUES
(1, 'BHW Maria Santos', 'bhw', 'admin', 'Good morning Captain/Admin Juan! We scheduled an immunization drive for Zone 2 this Friday. Please prepare clearance announcements.', NOW() - INTERVAL 2 HOUR),
(2, 'Admin Juan Dela Cruz', 'admin', 'bhw', 'Noted BHW Maria! We will post the announcement on the resident portal and issue SMS alerts today.', NOW() - INTERVAL 1 HOUR);

-- Seed FAQ Knowledge Base for Resident Chatbot
INSERT INTO `faq_knowledge` (`id`, `topic`, `keywords`, `response`) VALUES
(1, 'Barangay Clearance', 'clearance,barangay clearance,police clearance,nbi clearance', '📄 Barangay Clearance Requirements:\n• Valid Government-Issued ID\n• Cedula (Community Tax Certificate)\n• Proof of Residency (utility bill/lease)\nProcessing Time: Same day | Fee: Php 50.00 | Location: Barangay Hall, Room 1'),
(2, 'Certificate of Residency', 'residency,certificate of residency,proof of residence', '🏠 Certificate of Residency Requirements:\n• Valid Government ID\n• Utility bill (electricity/water)\n• 2 pcs 1x1 ID photo\nProcessing Time: 1–2 hours | Fee: Php 50.00 | Submit online or at Barangay Hall.'),
(3, 'Health Center Hours & Services', 'hours,clinic,open,schedule,time,health center,doctor,nurse', '🏥 Barangay Health Center Hours:\n• Monday to Friday: 8:00 AM – 5:00 PM\n• Infant Immunizations: Wednesdays & Fridays (8:00 AM – 12:00 PM)\n• Free consultations, prenatal checkups, and vitals monitoring.'),
(4, 'Free Infant Immunizations', 'vaccine,vaccination,immunization,baby,infant,bcg,polio,mmr,dpt,hepatitis', '💉 Free Infant Vaccines Available:\n• BCG, Hepatitis B, DPT, OPV, and MMR\n• Schedule: Every Wednesday & Friday (8AM–12PM)\n• Please bring your Mother-Baby Handbook / Immunization Card.'),
(5, 'Business Permit', 'business,permit,store,sari-sari,commercial,business permit', '🏪 Barangay Business Permit Requirements:\n• DTI / SEC Registration\n• Lease Contract / Proof of Property Ownership\n• Owner Valid ID & Cedula\nProcessing Time: 1–2 business days | Fee: Php 200–500.'),
(6, 'Certificate of Indigency', 'indigency,certificate of indigency,poor,financial assistance', '📋 Certificate of Indigency:\n• Valid Government ID & Proof of Residency\n• Processing: Same day\n• Fee: FREE of charge for indigent families.'),
(7, 'Account Registration & Verification', 'register,sign up,account,verification,verify,pending review', '📝 Account Verification:\n• Upload valid Government ID during registration.\n• Admin approves account in 1–2 business days.\n• Once verified, document requests unlock automatically.'),
(8, 'How to Print Requested Documents', 'print,download,get certificate,print document,export', '🖨️ How to Print / Download Your Document:\n• Log in to your Resident Portal (Barangay or Health Center).\n• In your requests table, click "Print / Export" on your document.\n• Preview the official certificate and click "Print Official Copy" or "Download File".'),
(9, 'Fees & Payments', 'fee,fees,how much,cost,price,payment', '💰 Document & Service Fees:\n• Barangay Clearance: Php 50.00\n• Residency Certificate: Php 50.00\n• Business Permit: Php 200–500\n• Indigency Certificate: FREE\n• All Health Center Services & Vaccines: FREE')
ON DUPLICATE KEY UPDATE `topic` = VALUES(`topic`), `keywords` = VALUES(`keywords`), `response` = VALUES(`response`);

