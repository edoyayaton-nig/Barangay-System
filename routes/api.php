<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CensusController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\EmailController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ResidentController;
use App\Http\Controllers\SchedulingController;
use App\Http\Controllers\SystemController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Barangay Pianing Smart Governance & Public Health System - API Routes
|--------------------------------------------------------------------------
*/

// System Settings & Connectivity
Route::get('/settings', [SystemController::class, 'getSettings']);
Route::get('/settings/all', [SystemController::class, 'getAllSettings']);
Route::post('/settings', [SystemController::class, 'saveSettings']);
Route::post('/settings/test-email', [SystemController::class, 'testEmail']);
Route::post('/settings/test-sms', [SystemController::class, 'testSms']);

// Document Categories
Route::get('/categories', [DocumentController::class, 'getCategories']);
Route::post('/categories', [DocumentController::class, 'createCategory']);
Route::put('/categories/{name}', [DocumentController::class, 'updateCategory'])->where('name', '.*');
Route::delete('/categories/{name}', [DocumentController::class, 'deleteCategory'])->where('name', '.*');

// Activity Audit Logs
Route::get('/activity-logs', [SystemController::class, 'getActivityLogs']);
Route::post('/activity-logs', [SystemController::class, 'createActivityLog']);

// Database Connectivity Status & Census Migration
Route::get('/db-status', [SystemController::class, 'dbStatus']);
Route::post('/system/migrate-census', [SystemController::class, 'migrateCensusDatabase']);

// Authentication & Identity Verification
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/register', [AuthController::class, 'register']);
Route::get('/auth/check-status', [AuthController::class, 'checkStatus']);

// User Management & Profile
Route::put('/users/profile', [AuthController::class, 'updateProfile']);
Route::get('/users', [AuthController::class, 'getUsers']);
Route::post('/users', [AuthController::class, 'createUser']);
Route::put('/users/{id}', [AuthController::class, 'updateUser']);
Route::post('/users/{id}/reset-password', [AuthController::class, 'resetPassword']);
Route::delete('/users/{id}', [AuthController::class, 'deleteUser']);

// Resident Demographic Records & Applicant Queue
Route::get('/residents', [ResidentController::class, 'index']);
Route::get('/residents/census-lookup', [ResidentController::class, 'censusLookup']);
Route::get('/residents/pending', [ResidentController::class, 'getPending']);
Route::get('/residents/{id}/census-similarity', [ResidentController::class, 'censusSimilarity']);
Route::get('/residents/{id}/full-profile', [ResidentController::class, 'fullProfile']);
Route::post('/residents', [ResidentController::class, 'store']);
Route::put('/residents/resubmit', [ResidentController::class, 'resubmit']);
Route::put('/residents/{id}/approve', [ResidentController::class, 'approve']);
Route::put('/residents/{id}/unverify', [ResidentController::class, 'unverify']);
Route::put('/residents/{id}/reject', [ResidentController::class, 'reject']);
Route::put('/residents/{id}', [ResidentController::class, 'update']);
Route::delete('/residents/{id}/purge', [ResidentController::class, 'purge']);

// Document Clearance & Certificate Requests
Route::get('/documents/{id}/pdf', [DocumentController::class, 'downloadPdf']);
Route::post('/documents/generate-pdf', [DocumentController::class, 'generatePdfDirect']);
Route::get('/documents', [DocumentController::class, 'index']);
Route::post('/documents', [DocumentController::class, 'store']);
Route::put('/documents/{id}', [DocumentController::class, 'update']);
Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);

// Operational Dashboard Statistics
Route::get('/stats/admin', [SystemController::class, 'statsAdmin']);
Route::get('/stats/bhw', [SystemController::class, 'statsBhw']);
Route::get('/stats/population', [CensusController::class, 'population']);

// Demographic Census & Household Analytics
Route::get('/census/stats', [CensusController::class, 'stats']);
Route::get('/census/households', [CensusController::class, 'households']);

// Community Healthcare - EPI Immunization
Route::get('/immunizations', [HealthController::class, 'getImmunizations']);
Route::post('/immunizations', [HealthController::class, 'createImmunization']);
Route::put('/immunizations/{id}', [HealthController::class, 'updateImmunization']);

// Community Healthcare - Maternal Prenatal Care
Route::get('/maternal', [HealthController::class, 'getMaternal']);
Route::post('/maternal', [HealthController::class, 'createMaternal']);
Route::post('/health/mark-sms-sent', [HealthController::class, 'markSmsSent']);

// Community Healthcare - Clinical Encounters / Consultations
Route::get('/consultations', [HealthController::class, 'getConsultations']);
Route::post('/consultations', [HealthController::class, 'createConsultation']);

// Community Healthcare - Clinic Appointments
Route::get('/appointments', [HealthController::class, 'getAppointments']);
Route::post('/appointments', [HealthController::class, 'createAppointment']);
Route::put('/appointments/{id}', [HealthController::class, 'updateAppointment']);
Route::delete('/appointments/{id}', [HealthController::class, 'deleteAppointment']);

// Community Healthcare - Clinic Schedules
Route::get('/clinic-schedules', [HealthController::class, 'getClinicSchedules']);
Route::post('/clinic-schedules', [HealthController::class, 'createClinicSchedule']);
Route::put('/clinic-schedules/{id}', [HealthController::class, 'updateClinicSchedule']);
Route::delete('/clinic-schedules/{id}', [HealthController::class, 'deleteClinicSchedule']);

// Community Healthcare - Patient Intake & EHR Archives
Route::get('/patients/search', [HealthController::class, 'searchPatients']);
Route::post('/patients/intake', [HealthController::class, 'intake']);
Route::get('/archives/clinical', [HealthController::class, 'clinicalArchives']);
Route::post('/scheduler/run-1day-reminders', [HealthController::class, 'runReminders']);
Route::post('/scheduler/run-reminders', [HealthController::class, 'runReminders']);
Route::match(['get', 'post'], '/scheduler/run-3day-reminders', [HealthController::class, 'runReminders']);
Route::match(['get', 'post'], '/health/appointments/run-reminders', [HealthController::class, 'runReminders']);

// Pharmacy & Vaccine Inventory
Route::get('/inventory', [InventoryController::class, 'index']);
Route::post('/inventory', [InventoryController::class, 'store']);
Route::put('/inventory/{id}', [InventoryController::class, 'update']);
Route::delete('/inventory/{id}', [InventoryController::class, 'destroy']);
Route::post('/inventory/dispense', [InventoryController::class, 'dispense']);

// Internal Messenger & In-App Alerts
Route::get('/messages', [SystemController::class, 'getMessages']);
Route::post('/messages', [SystemController::class, 'createMessage']);
Route::get('/notifications', [SystemController::class, 'getNotifications']);
Route::put('/notifications/{id}/read', [SystemController::class, 'markNotificationRead']);
Route::put('/notifications/mark-all-read', [SystemController::class, 'markAllNotificationsRead']);
Route::post('/notifications', [SystemController::class, 'createNotification']);
Route::post('/sms/send', [SystemController::class, 'sendSmsDirect']);
Route::post('/system/test-sms', [SystemController::class, 'testSms']);

// Interactive FAQ Chatbot
Route::post('/chatbot', [SystemController::class, 'chatbot']);

// Multi-Barangay Municipal Governance & System Diagnostics
Route::get('/system/barangays', [SystemController::class, 'getSystemBarangays']);
Route::get('/system/maintenance', [SystemController::class, 'getMaintenance']);
Route::post('/system/maintenance', [SystemController::class, 'setMaintenance']);
Route::get('/system/gateways', [SystemController::class, 'getGateways']);
Route::get('/system/database/stats', [SystemController::class, 'getDatabaseStats']);
Route::get('/system/database/backup', [SystemController::class, 'backupDatabase']);

// Automated Scheduling Engine
Route::get('/scheduling/vaccines', [SchedulingController::class, 'getVaccines']);
Route::post('/scheduling/next-dose', [SchedulingController::class, 'nextDose']);
Route::post('/scheduling/full-vaccine-schedule', [SchedulingController::class, 'fullVaccineSchedule']);
Route::post('/scheduling/next-maternal-visit', [SchedulingController::class, 'nextMaternalVisit']);
Route::post('/scheduling/full-prenatal-schedule', [SchedulingController::class, 'fullPrenatalSchedule']);
Route::get('/scheduling/overdue', [SchedulingController::class, 'getOverdue']);

// Email Broadcast Services
Route::post('/email/test', [EmailController::class, 'test']);
Route::post('/email/announcement', [EmailController::class, 'announcement']);
Route::post('/email/send', [EmailController::class, 'send']);
Route::get('/email/status', [EmailController::class, 'status']);
