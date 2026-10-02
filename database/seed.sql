-- =========================================================
-- Smart Barangay System - MySQL Seed Data (Clean Production Base)
-- Zero Mock Data in Staff Management, Resident Management, Census & Health
-- =========================================================

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `users`;
TRUNCATE TABLE `residents`;
TRUNCATE TABLE `document_requests`;
TRUNCATE TABLE `maternal_records`;
TRUNCATE TABLE `immunizations`;
TRUNCATE TABLE `sms_notifications`;
TRUNCATE TABLE `activity_logs`;
TRUNCATE TABLE `messages`;
TRUNCATE TABLE `health_appointments`;
TRUNCATE TABLE `faq_knowledge`;
SET FOREIGN_KEY_CHECKS = 1;

-- Core System Administrative Accounts Only (Password: '123')
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `status`, `verification_status`, `barangay`, `phone`, `last_login`) VALUES
(99, 'Super Mega Admin', 'supermegaadmin@barangay.gov', '123', 'super_mega_admin', 'Active', 'Verified', 'All (City-Wide)', '09179998877', NOW()),
(1, 'Super Admin Rodrigo Lim', 'superadmin@barangay.gov', '123', 'superadmin', 'Active', 'Verified', 'Pianing', '09171112233', NOW()),
(2, 'Barangay Admin Juan Dela Cruz', 'admin@barangay.gov', '123', 'admin', 'Active', 'Verified', 'Pianing', '09171234567', NOW()),
(3, 'BHW Maria Santos', 'bhw@barangay.gov', '123', 'bhw', 'Active', 'Verified', 'Pianing', '09181234567', NOW()),
(5, 'Nurse Ligaya Santos', 'nurse@barangay.gov', '123', 'nurse', 'Active', 'Verified', 'Pianing', '09201234567', NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `email` = VALUES(`email`), `role` = VALUES(`role`), `verification_status` = VALUES(`verification_status`);

-- Residents: Clean (0 records)
-- Document Requests: Clean (0 records)
-- Maternal Records: Clean (0 records)
-- Immunizations: Clean (0 records)
-- Health Appointments: Clean (0 records)
-- Activity Logs: Clean (0 records)
-- System Messages: Clean (0 records)

-- FAQ Knowledge Base for Resident Automated Chatbot & Help Center
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
