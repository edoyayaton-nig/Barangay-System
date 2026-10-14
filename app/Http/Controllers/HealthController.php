<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\ClinicalEncounter;
use App\Models\ClinicSchedule;
use App\Models\FamilyPlanningRecord;
use App\Models\HealthAppointment;
use App\Models\Immunization;
use App\Models\Inventory;
use App\Models\MaternalRecord;
use App\Models\Resident;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\EmailService;
use App\Services\SchedulingService;
use App\Services\SmsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    public function getImmunizations(Request $request)
    {
        $query = Immunization::query();
        $barangay = $request->input('barangay');
        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $query->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
        }
        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function createImmunization(Request $request)
    {
        $childName = trim((string)$request->input('child_name', ''));
        $vaccineName = trim((string)$request->input('vaccine_name', 'Pentavalent'));
        $doseNumberStr = (string)$request->input('dose_number', '1');
        preg_match('/\d+/', $doseNumberStr, $m);
        $doseNumber = isset($m[0]) ? (int)$m[0] : 1;

        $dateAdministered = $request->input('date_administered', date('Y-m-d'));
        $nextDueDate = $request->input('next_due_date');

        if (empty($nextDueDate) && !empty($dateAdministered)) {
            $nextCalc = SchedulingService::computeNextDose($vaccineName, $doseNumber, $dateAdministered);
            if ($nextCalc && !empty($nextCalc['dueDate'])) {
                $nextDueDate = $nextCalc['dueDate'];
            } else {
                $nextDueDate = date('Y-m-d', strtotime("{$dateAdministered} +28 days"));
            }
        }

        $barangay = AuthController::normalizeBarangayName($request->input('barangay'));

        $record = Immunization::create([
            'child_name' => $childName,
            'parent_phone' => (string)$request->input('guardian_phone', $request->input('parent_phone', '')),
            'vaccine_name' => $vaccineName,
            'dose_number' => $doseNumber,
            'status' => $request->input('status', 'Completed'),
            'date_administered' => $dateAdministered,
            'due_date' => $nextDueDate ?: date('Y-m-d', strtotime('+30 days')),
            'administered_by' => $request->input('administered_by', 'Nurse Maria Santos'),
            'barangay' => $barangay,
        ]);

        ActivityLog::create([
            'user_name' => $request->input('administered_by', 'Healthcare Worker'),
            'user_role' => 'nurse',
            'action' => "Administered EPI vaccine: {$vaccineName} (Dose {$doseNumber}) to {$childName}",
        ]);

        return response()->json([
            'success' => true,
            'id' => $record->id,
            'record' => $record,
        ], 201);
    }

    public function updateImmunization(Request $request, $id)
    {
        $rec = Immunization::find($id);
        if (!$rec) return response()->json(['error' => 'Record not found'], 404);
        $rec->update($request->all());
        return response()->json(['success' => true, 'record' => $rec]);
    }

    public function getMaternal(Request $request)
    {
        $query = MaternalRecord::query();
        $barangay = $request->input('barangay');
        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $query->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
        }
        $records = $query->orderBy('created_at', 'desc')->get();
        return response()->json($records);
    }

    public function createMaternal(Request $request)
    {
        $motherName = trim((string)$request->input('mother_name', ''));
        $residentId = $request->input('resident_id');

        if (empty($residentId)) {
            $res = Resident::whereRaw('LOWER(CONCAT(first_name, " ", last_name)) = ?', [strtolower($motherName)])->first();
            $residentId = $res ? $res->id : 1;
        }

        $lastVisit = $request->input('visit_date', date('Y-m-d'));
        $nextVisit = $request->input('next_visit_date');

        if (empty($nextVisit)) {
            $calc = SchedulingService::computeNextMaternalVisit($lastVisit, 16, $request->input('risk_level', 'Low'));
            $nextVisit = $calc['nextVisitDate'];
        }

        $barangay = AuthController::normalizeBarangayName($request->input('barangay', 'Pianing'));

        $record = MaternalRecord::create([
            'resident_id' => $residentId,
            'mother_name' => $motherName,
            'age' => (int)$request->input('age', 25),
            'barangay' => $barangay,
            'pregnancy_status' => $request->input('pregnancy_status', 'Prenatal - 2nd Trimester'),
            'expected_due_date' => $request->input('expected_due_date'),
            'last_visit' => $lastVisit,
            'next_visit' => $nextVisit,
            'risk_level' => $request->input('risk_level', 'Low'),
            'notes' => $request->input('notes', $request->input('risk_factors', '')),
        ]);

        ActivityLog::create([
            'user_name' => 'Nurse / Healthcare Worker',
            'user_role' => 'nurse',
            'action' => "Recorded maternal prenatal examination: {$motherName}",
        ]);

        return response()->json([
            'success' => true,
            'id' => $record->id,
            'record' => $record,
        ], 201);
    }

    public function getConsultations(Request $request)
    {
        $query = ClinicalEncounter::query();
        $barangay = $request->input('barangay');
        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $query->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
        }
        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function createConsultation(Request $request)
    {
        $patientName = trim((string)$request->input('patient_name', ''));
        $barangay = AuthController::normalizeBarangayName($request->input('barangay'));

        $encounter = ClinicalEncounter::create([
            'patient_name' => $patientName,
            'contact_number' => (string)$request->input('patient_phone', $request->input('contact_number', '')),
            'age' => (string)$request->input('age', '—'),
            'gender' => $request->input('gender', 'Female'),
            'civil_status' => $request->input('civil_status', 'Single'),
            'barangay' => $barangay,
            'purok' => $request->input('purok', 'Purok 1'),
            'program_type' => $request->input('program_type', 'General Consultation'),
            'bp' => $request->input('blood_pressure', $request->input('bp', '120/80')),
            'temp' => (string)$request->input('temperature_c', $request->input('temp', '36.5')),
            'weight' => (string)$request->input('weight_kg', $request->input('weight', '')),
            'height' => (string)$request->input('height_cm', $request->input('height', '')),
            'chief_complaint' => $request->input('chief_complaint', 'Routine Visit'),
            'diagnosis' => $request->input('diagnosis', ''),
            'treatment' => $request->input('treatment_prescription', $request->input('treatment', '')),
            'prescribed_meds' => $request->input('treatment_prescription', $request->input('prescribed_meds', '')),
            'attending_worker' => $request->input('attending_worker', 'Nurse Maria Santos'),
            'encounter_date' => $request->input('encounter_date', date('Y-m-d')),
            'next_visit_date' => $request->input('revisit_date', $request->input('next_visit_date')),
            'status' => 'Completed',
        ]);

        // Auto-dispense and deduct inventory if prescription list provided
        if ($request->has('prescriptions') && is_array($request->input('prescriptions'))) {
            foreach ($request->input('prescriptions') as $rx) {
                if (!empty($rx['name'])) {
                    $qty = isset($rx['quantity']) ? (int)$rx['quantity'] : 1;
                    $inv = Inventory::where('item_name', $rx['name']);
                    if (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) {
                        $inv->whereRaw('LOWER(barangay) = ?', [strtolower($barangay)]);
                    }
                    $invItem = $inv->first();
                    if ($invItem) {
                        $newStock = max(0, $invItem->stock - $qty);
                        $invItem->update([
                            'stock' => $newStock,
                            'status' => $newStock === 0 ? 'Out of Stock' : ($newStock < 10 ? 'Low Stock' : 'In Stock')
                        ]);
                    }
                }
            }
        }

        ActivityLog::create([
            'user_name' => $request->input('attending_worker', 'Nurse'),
            'user_role' => 'nurse',
            'action' => "Recorded clinical consultation encounter: {$patientName} ({$barangay})",
        ]);

        return response()->json([
            'success' => true,
            'id' => $encounter->id,
            'encounter' => $encounter,
            'record' => $encounter,
        ], 201);
    }

    public function getAppointments(Request $request)
    {
        $query = HealthAppointment::query();
        $barangay = $request->input('barangay');
        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $query->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
        }

        $email = $request->input('resident_email');
        if (!empty($email)) {
            $query->whereRaw('LOWER(resident_email) = ?', [strtolower($email)]);
        }

        $residentId = $request->input('resident_id');
        if (!empty($residentId)) {
            $query->where('resident_id', $residentId);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public static function getPreciseClinicLocation(?string $barangay = null): string
    {
        $brgy = $barangay ? AuthController::normalizeBarangayName($barangay) : 'Pianing';
        return "Barangay {$brgy} Health Center & Primary Clinic (Purok 1, Barangay {$brgy}, Butuan City)";
    }

    public function createAppointment(Request $request)
    {
        $residentName = trim((string)$request->input('resident_name', ''));
        $serviceType = $request->input('service_type', 'Consultation');
        $barangay = AuthController::normalizeBarangayName($request->input('barangay'));
        $preferredDate = $request->input('preferred_date', date('Y-m-d', strtotime('+1 day')));
        $preferredTime = $request->input('preferred_time', 'Morning (8:00 AM - 11:30 AM)');

        $aptCode = 'APT-' . date('Y') . '-' . rand(100, 999);

        // Find resident phone & email if not provided in request
        $resId = $request->input('resident_id');
        $phone = (string)$request->input('resident_phone', '');
        $email = (string)$request->input('resident_email', '');

        if ($resId && (empty($phone) || empty($email))) {
            $r = Resident::find($resId);
            if ($r) {
                if (empty($phone)) $phone = (string)($r->phone ?: '');
                if (empty($email)) $email = (string)($r->email ?: '');
            }
        }
        if (empty($phone) && !empty($email)) {
            $u = User::whereRaw('LOWER(email) = ?', [strtolower($email)])->first();
            if ($u && !empty($u->phone)) $phone = (string)$u->phone;
        }

        $apt = HealthAppointment::create([
            'appointment_code' => $aptCode,
            'resident_id' => $resId,
            'resident_name' => $residentName,
            'resident_phone' => $phone,
            'resident_email' => $email,
            'barangay' => $barangay,
            'service_type' => $serviceType,
            'preferred_date' => $preferredDate,
            'preferred_time' => $preferredTime,
            'status' => 'Pending',
            'resident_notes' => $request->input('resident_notes'),
        ]);

        ActivityLog::create([
            'user_name' => $residentName,
            'user_role' => 'resident',
            'action' => "Booked clinic appointment: {$serviceType} ({$aptCode})",
        ]);

        $clinicLoc = self::getPreciseClinicLocation($barangay);

        // Send In-App notification
        if (!empty($email)) {
            try {
                UserNotification::create([
                    'recipient_email' => $email,
                    'type' => 'Health',
                    'title' => "Appointment Booked: {$serviceType}",
                    'message' => "Your clinic appointment for {$serviceType} has been requested for {$preferredDate} ({$preferredTime}) at {$clinicLoc}. Reference Code: {$aptCode}.",
                    'ref_code' => $aptCode,
                    'is_read' => 0,
                    'created_at' => now(),
                ]);
            } catch (\Throwable $ne) {}

            EmailService::sendAppointmentStatusEmail(
                $email,
                $residentName,
                $serviceType,
                $preferredDate,
                $preferredTime,
                'Pending (Booked)',
                "Clinic Location: {$clinicLoc}",
                $barangay
            );
        }

        // Send live SMS via iProg SMS Gateway
        if (!empty($phone)) {
            SmsService::sendLiveSms(
                $phone,
                "Barangay Health Center: Hello {$residentName}! Your appointment for {$serviceType} is BOOKED for {$preferredDate} ({$preferredTime}) at {$clinicLoc}. Ref: {$aptCode}."
            );
        }

        return response()->json([
            'success' => true,
            'id' => $apt->id,
            'appointment' => $apt,
            'appointment_code' => $aptCode,
            'clinic_location' => $clinicLoc,
        ], 201);
    }

    public function updateAppointment(Request $request, $id)
    {
        $apt = HealthAppointment::find($id);
        if (!$apt) return response()->json(['error' => 'Appointment not found'], 404);

        $newStatus = $request->input('status', $apt->status);
        $scheduledDate = $request->input('scheduled_date', $apt->scheduled_date ?: $apt->preferred_date);
        $scheduledTime = $request->input('scheduled_time', $apt->scheduled_time ?: $apt->preferred_time);
        $bhwNotes = $request->input('bhw_notes', $apt->bhw_notes);

        $apt->update([
            'status' => $newStatus,
            'scheduled_date' => $scheduledDate,
            'scheduled_time' => $scheduledTime,
            'bhw_notes' => $bhwNotes,
            'attending_bhw' => $request->input('attending_bhw', $apt->attending_bhw),
        ]);

        ActivityLog::create([
            'user_name' => $request->input('user_name', 'Healthcare Staff'),
            'user_role' => $request->input('user_role', 'nurse'),
            'action' => "Updated appointment {$apt->appointment_code} to {$newStatus}",
        ]);

        $clinicLoc = self::getPreciseClinicLocation($apt->barangay);
        $phone = $apt->resident_phone;
        if (empty($phone) && $apt->resident_id) {
            $r = Resident::find($apt->resident_id);
            if ($r && $r->phone) $phone = $r->phone;
        }
        if (empty($phone) && !empty($apt->resident_email)) {
            $u = User::whereRaw('LOWER(email) = ?', [strtolower($apt->resident_email)])->first();
            if ($u && $u->phone) $phone = $u->phone;
        }

        if (!empty($apt->resident_email)) {
            EmailService::sendAppointmentStatusEmail(
                $apt->resident_email,
                $apt->resident_name,
                $apt->service_type,
                $scheduledDate,
                $scheduledTime,
                $newStatus,
                "{$bhwNotes}. Location: {$clinicLoc}",
                $apt->barangay
            );

            try {
                UserNotification::create([
                    'recipient_email' => $apt->resident_email,
                    'type' => 'Health',
                    'title' => "Appointment {$newStatus}: {$apt->service_type}",
                    'message' => "Your appointment for {$apt->service_type} has been {$newStatus} for {$scheduledDate} ({$scheduledTime}) at {$clinicLoc}. Ref: {$apt->appointment_code}.",
                    'ref_code' => $apt->appointment_code,
                    'is_read' => 0,
                    'created_at' => now(),
                ]);
            } catch (\Throwable $ne) {}
        }

        if (!empty($phone)) {
            if ($newStatus === 'Approved') {
                SmsService::sendLiveSms(
                    $phone,
                    "Barangay Health Center: Hello {$apt->resident_name}! Your appointment for {$apt->service_type} is CONFIRMED for {$scheduledDate} ({$scheduledTime}) at {$clinicLoc}. Please bring a valid ID. Ref: {$apt->appointment_code}."
                );
            } elseif ($newStatus === 'Completed') {
                SmsService::sendLiveSms(
                    $phone,
                    "Barangay Health Center: Hello {$apt->resident_name}! Your appointment for {$apt->service_type} on {$scheduledDate} has been marked as COMPLETED. Stay healthy!"
                );
            }
        }

        return response()->json(['success' => true, 'appointment' => $apt]);
    }

    public function deleteAppointment($id)
    {
        $apt = HealthAppointment::find($id);
        if (!$apt) return response()->json(['error' => 'Appointment not found'], 404);
        $apt->delete();
        return response()->json(['success' => true, 'message' => 'Appointment cancelled']);
    }

    public function getClinicSchedules(Request $request)
    {
        $query = ClinicSchedule::query();
        $barangay = $request->input('barangay');
        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $query->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
        }
        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function createClinicSchedule(Request $request)
    {
        $barangay = AuthController::normalizeBarangayName($request->input('barangay'));
        $schedule = ClinicSchedule::create([
            'title' => (string)$request->input('title', 'Community Clinic Schedule'),
            'service_type' => (string)$request->input('service_type', 'General Consultation'),
            'day_of_week' => (string)$request->input('day_of_week', 'Monday - Friday'),
            'time_slot' => (string)$request->input('time_slot', '8:00 AM - 12:00 PM'),
            'location' => (string)$request->input('location', "Barangay {$barangay} Health Center"),
            'slots_available' => (int)$request->input('slots_available', 20),
            'bhw_in_charge' => (string)$request->input('bhw_in_charge', 'Nurse Maria Santos'),
            'status' => 'Active',
            'barangay' => $barangay,
            'created_by' => (string)$request->input('created_by', 'Healthcare Staff'),
        ]);

        ActivityLog::create([
            'user_name' => 'Nurse / Staff',
            'user_role' => 'nurse',
            'action' => "Published clinic schedule: {$schedule->title} ({$barangay})",
        ]);

        return response()->json(['success' => true, 'schedule' => $schedule], 201);
    }

    public function updateClinicSchedule(Request $request, $id)
    {
        $s = ClinicSchedule::find($id);
        if (!$s) return response()->json(['error' => 'Schedule not found'], 404);
        $s->update($request->all());
        return response()->json(['success' => true, 'schedule' => $s]);
    }

    public function deleteClinicSchedule($id)
    {
        $s = ClinicSchedule::find($id);
        if (!$s) return response()->json(['error' => 'Schedule not found'], 404);
        $s->delete();
        return response()->json(['success' => true, 'message' => 'Schedule deleted']);
    }

    public function searchPatients(Request $request)
    {
        $q = trim((string)$request->input('q', $request->input('search', '')));
        if (empty($q)) {
            return response()->json([
                'patients' => [],
                'results' => [],
            ]);
        }

        $barangay = $request->input('barangay');
        $normBarangay = (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) 
            ? AuthController::normalizeBarangayName($barangay) 
            : null;

        $terms = array_filter(preg_split('/\s+/', $q));

        $residentQuery = Resident::query();
        if ($normBarangay) {
            $residentQuery->where(function ($bQuery) use ($normBarangay) {
                $bQuery->whereRaw('LOWER(barangay) = ?', [strtolower($normBarangay)])
                       ->orWhereRaw('LOWER(address) LIKE ?', ['%' . strtolower($normBarangay) . '%']);
            });
        }

        $residentQuery->where(function ($query) use ($q, $terms) {
            $query->where('phone', 'like', "%{$q}%")
                  ->orWhere('email', 'like', "%{$q}%")
                  ->orWhere('id', $q);

            $query->orWhereRaw("CONCAT_WS(' ', first_name, middle_name, last_name) LIKE ?", ["%{$q}%"])
                  ->orWhereRaw("CONCAT_WS(' ', first_name, last_name) LIKE ?", ["%{$q}%"]);

            if (count($terms) > 1) {
                $query->orWhere(function ($subQ) use ($terms) {
                    foreach ($terms as $term) {
                        $subQ->where(function ($termQ) use ($term) {
                            $termQ->where('first_name', 'like', "%{$term}%")
                                  ->orWhere('middle_name', 'like', "%{$term}%")
                                  ->orWhere('last_name', 'like', "%{$term}%");
                        });
                    }
                });
            } else {
                $query->orWhere('first_name', 'like', "%{$q}%")
                      ->orWhere('last_name', 'like', "%{$q}%");
            }
        });

        $residents = $residentQuery->limit(15)->get();

        $results = [];
        $seenNames = [];

        foreach ($residents as $r) {
            $fullName = trim("{$r->first_name} " . ($r->middle_name ? "{$r->middle_name} " : "") . $r->last_name);
            $lowerName = strtolower($fullName);
            $seenNames[$lowerName] = true;

            $lastEncounter = ClinicalEncounter::whereRaw('LOWER(patient_name) = ?', [$lowerName])
                ->orderBy('created_at', 'desc')->first();

            $age = null;
            if (!empty($r->date_of_birth)) {
                try {
                    $age = \Carbon\Carbon::parse($r->date_of_birth)->age;
                } catch (\Throwable $e) {}
            }

            $purokClean = $r->purok ? (str_starts_with(strtolower($r->purok), 'purok') ? $r->purok : "Purok {$r->purok}") : 'Purok 1';

            $results[] = [
                'id' => $r->id,
                'resident_id' => $r->id,
                'name' => $fullName,
                'first_name' => $r->first_name,
                'middle_name' => $r->middle_name ?: '',
                'last_name' => $r->last_name,
                'gender' => $r->gender ?: 'Female',
                'date_of_birth' => $r->date_of_birth ?: '',
                'birthdate' => $r->date_of_birth ?: '',
                'age' => $age !== null ? (string)$age : '',
                'civil_status' => $r->civil_status ?: 'Single',
                'purok' => $purokClean,
                'barangay' => $r->barangay ?: ($normBarangay ?: 'Pianing'),
                'phone' => $r->phone ?: '',
                'email' => $r->email ?: '',
                'last_encounter' => $lastEncounter,
                'previous_encounter' => $lastEncounter,
                'resident' => $r,
            ];
        }

        // Also search existing clinical encounters in this barangay for previous records
        $encQuery = ClinicalEncounter::where(function ($eq) use ($q) {
            $eq->where('patient_name', 'like', "%{$q}%")
               ->orWhere('contact_number', 'like', "%{$q}%");
        });
        if ($normBarangay) {
            $encQuery->whereRaw('LOWER(barangay) = ?', [strtolower($normBarangay)]);
        }
        $encounters = $encQuery->orderBy('created_at', 'desc')->limit(10)->get();

        foreach ($encounters as $enc) {
            $lowerEncName = strtolower(trim($enc->patient_name));
            if (!empty($lowerEncName) && !isset($seenNames[$lowerEncName])) {
                $seenNames[$lowerEncName] = true;
                $purokClean = $enc->purok ? (str_starts_with(strtolower($enc->purok), 'purok') ? $enc->purok : "Purok {$enc->purok}") : 'Purok 1';

                $results[] = [
                    'id' => 'enc_' . $enc->id,
                    'resident_id' => null,
                    'name' => $enc->patient_name,
                    'first_name' => $enc->patient_name,
                    'middle_name' => '',
                    'last_name' => '',
                    'gender' => $enc->gender ?: 'Female',
                    'date_of_birth' => '',
                    'birthdate' => '',
                    'age' => $enc->age ?: '',
                    'civil_status' => $enc->civil_status ?: 'Single',
                    'purok' => $purokClean,
                    'barangay' => $enc->barangay ?: ($normBarangay ?: 'Pianing'),
                    'phone' => $enc->contact_number ?: '',
                    'email' => '',
                    'last_encounter' => $enc,
                    'previous_encounter' => $enc,
                    'resident' => null,
                ];
            }
        }

        return response()->json([
            'patients' => $results,
            'results' => $results,
        ]);
    }

    public function intake(Request $request)
    {
        $program = $request->input('program_type', 'Consultation');
        $patientName = trim((string)$request->input('patient_name', ''));
        $barangay = AuthController::normalizeBarangayName($request->input('barangay'));

        if (str_contains(strtolower($program), 'prenatal') || str_contains(strtolower($program), 'maternal')) {
            return $this->createMaternal($request);
        } elseif (str_contains(strtolower($program), 'immunization') || str_contains(strtolower($program), 'nip')) {
            return $this->createImmunization($request);
        } else {
            return $this->createConsultation($request);
        }
    }

    public function clinicalArchives(Request $request)
    {
        $barangay = $request->input('barangay');
        $norm = !empty($barangay) && !str_contains(strtolower($barangay), 'all') ? AuthController::normalizeBarangayName($barangay) : null;

        $encQuery = ClinicalEncounter::query();
        $matQuery = MaternalRecord::query();
        $immQuery = Immunization::query();
        $schQuery = ClinicSchedule::query();

        if ($norm) {
            $encQuery->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
            $matQuery->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
            $immQuery->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
            $schQuery->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
        }

        return response()->json([
            'consultations' => $encQuery->orderBy('created_at', 'desc')->get(),
            'maternal' => $matQuery->orderBy('created_at', 'desc')->get(),
            'immunizations' => $immQuery->orderBy('created_at', 'desc')->get(),
            'schedules' => $schQuery->orderBy('created_at', 'desc')->get(),
        ]);
    }

    public function runReminders(Request $request = null)
    {
        $threeDaysAhead = date('Y-m-d', strtotime('+3 days'));
        $tomorrow = date('Y-m-d', strtotime('+1 day'));

        $sent3DayCount = 0;
        $sent1DayCount = 0;
        $emailsSent = 0;

        // 1. 3-DAY ADVANCE REMINDERS (Strictly required: Inform resident 3 days before booking with precise location)
        $threeDayAppointments = HealthAppointment::where('scheduled_date', $threeDaysAhead)
            ->whereIn('status', ['Approved', 'Confirmed', 'Pending'])
            ->get();

        foreach ($threeDayAppointments as $apt) {
            $clinicLoc = self::getPreciseClinicLocation($apt->barangay);
            $phone = $apt->resident_phone;
            if (empty($phone) && $apt->resident_id) {
                $r = Resident::find($apt->resident_id);
                if ($r && !empty($r->phone)) $phone = $r->phone;
            }
            if (empty($phone) && !empty($apt->resident_email)) {
                $u = User::whereRaw('LOWER(email) = ?', [strtolower($apt->resident_email)])->first();
                if ($u && !empty($u->phone)) $phone = $u->phone;
            }

            // In-App Notification (Notification Center)
            if (!empty($apt->resident_email)) {
                try {
                    UserNotification::create([
                        'recipient_email' => $apt->resident_email,
                        'type' => 'Health',
                        'title' => "⏰ 3-Day Reminder: {$apt->service_type} Appointment",
                        'message' => "Reminder: You have an upcoming appointment for {$apt->service_type} in 3 days on {$apt->scheduled_date} ({$apt->scheduled_time}) at {$clinicLoc}. Reference: {$apt->appointment_code}. Please arrive 10 minutes early.",
                        'ref_code' => $apt->appointment_code,
                        'is_read' => 0,
                        'created_at' => now(),
                    ]);
                } catch (\Throwable $ne) {}

                // Email Notification
                EmailService::sendEmail([
                    'to' => $apt->resident_email,
                    'subject' => "⏰ [3-Day Reminder] Upcoming Appointment – {$apt->service_type}",
                    'text' => "Dear {$apt->resident_name},\n\nThis is a friendly reminder that you have a scheduled appointment for {$apt->service_type} in 3 days on {$apt->scheduled_date} at {$apt->scheduled_time}.\n\nPrecise Location: {$clinicLoc}\nReference Code: {$apt->appointment_code}\n\nPlease bring your Barangay ID and health records. Arrive 10 minutes prior to your schedule.\n\nBarangay Health Services",
                    'recipientName' => $apt->resident_name,
                    'barangay' => $apt->barangay,
                ]);
                $emailsSent++;
            }

            // SMS Notification via iProg SMS Gateway
            if (!empty($phone)) {
                SmsService::sendLiveSms(
                    $phone,
                    "3-Day Reminder: Hello {$apt->resident_name}! You have an upcoming appointment for {$apt->service_type} on {$apt->scheduled_date} ({$apt->scheduled_time}) at {$clinicLoc}. Ref: {$apt->appointment_code}. Please arrive 10 mins early."
                );
                $sent3DayCount++;
            }
        }

        // 2. 1-DAY ADVANCE REMINDERS
        $tomorrowAppointments = HealthAppointment::where('scheduled_date', $tomorrow)
            ->whereIn('status', ['Approved', 'Confirmed'])
            ->get();

        foreach ($tomorrowAppointments as $apt) {
            $clinicLoc = self::getPreciseClinicLocation($apt->barangay);
            $phone = $apt->resident_phone;
            if (empty($phone) && $apt->resident_id) {
                $r = Resident::find($apt->resident_id);
                if ($r && !empty($r->phone)) $phone = $r->phone;
            }

            if (!empty($phone)) {
                SmsService::sendLiveSms(
                    $phone,
                    "Tomorrow Reminder: Hello {$apt->resident_name}! Your appointment for {$apt->service_type} is scheduled for tomorrow at {$apt->scheduled_time} at {$clinicLoc}. Ref: {$apt->appointment_code}."
                );
                $sent1DayCount++;
            }
        }

        // 3. PRENATAL & MATERNAL REGISTRY REMINDERS (Advance notice before next scheduled visit)
        $maternalReminders = MaternalRecord::where(function($q) use ($threeDaysAhead, $tomorrow) {
                $q->where('next_visit', $threeDaysAhead)
                  ->orWhere('next_visit_date', $threeDaysAhead)
                  ->orWhere('next_visit', $tomorrow)
                  ->orWhere('next_visit_date', $tomorrow);
            })
            ->where(function($q) {
                $q->whereNull('sms_sent')->orWhere('sms_sent', 0);
            })
            ->get();

        $maternalSentCount = 0;
        foreach ($maternalReminders as $mat) {
            $clinicLoc = self::getPreciseClinicLocation($mat->barangay);
            $phone = (string)($mat->contact_number ?: '');
            $email = '';

            if ($mat->resident_id) {
                $r = Resident::find($mat->resident_id);
                if ($r) {
                    if (empty($phone) && !empty($r->phone)) $phone = (string)$r->phone;
                    if (!empty($r->email)) $email = (string)$r->email;
                }
            }
            if (empty($phone) || empty($email)) {
                $r = Resident::whereRaw('LOWER(CONCAT(first_name, " ", last_name)) = ?', [strtolower(trim($mat->mother_name))])->first();
                if ($r) {
                    if (empty($phone) && !empty($r->phone)) $phone = (string)$r->phone;
                    if (empty($email) && !empty($r->email)) $email = (string)$r->email;
                }
            }
            if (empty($email) && !empty($phone)) {
                $u = User::where('phone', $phone)->first();
                if ($u && !empty($u->email)) $email = (string)$u->email;
            }

            $visitDate = $mat->next_visit_date ?: ($mat->next_visit ?: $threeDaysAhead);
            $is3Day = ($mat->next_visit === $threeDaysAhead || $mat->next_visit_date === $threeDaysAhead);
            $timePrefix = $is3Day ? "in 3 days on" : "tomorrow on";
            $visitNum = $mat->visit_number ? " (Visit #{$mat->visit_number})" : "";

            if (!empty($email)) {
                try {
                    UserNotification::create([
                        'recipient_email' => $email,
                        'type' => 'Health',
                        'title' => "⏰ Maternal Visit Reminder: {$mat->mother_name}",
                        'message' => "Reminder: Your scheduled prenatal check-up{$visitNum} is due {$timePrefix} {$visitDate} at {$clinicLoc}. Please bring your maternal health record booklet.",
                        'ref_code' => "MAT-{$mat->id}",
                        'is_read' => 0,
                        'created_at' => now(),
                    ]);
                } catch (\Throwable $ne) {}

                EmailService::sendEmail([
                    'to' => $email,
                    'subject' => "⏰ [Maternal Health Reminder] Upcoming Prenatal Check-up – {$mat->mother_name}",
                    'text' => "Dear {$mat->mother_name},\n\nThis is a friendly reminder that your scheduled prenatal check-up{$visitNum} is due {$timePrefix} {$visitDate}.\n\nPrecise Location: {$clinicLoc}\n\nPlease bring your Mother & Child Health Record. Arrive on your scheduled morning or afternoon session.\n\nBarangay Health Services",
                    'recipientName' => $mat->mother_name,
                    'barangay' => $mat->barangay,
                ]);
                $emailsSent++;
            }

            if (!empty($phone)) {
                SmsService::sendLiveSms(
                    $phone,
                    "Maternal Notice: Hello {$mat->mother_name}! Your prenatal checkup{$visitNum} is scheduled {$timePrefix} {$visitDate} at {$clinicLoc}. Please bring your health booklet. Ref: MAT-{$mat->id}"
                );
                $maternalSentCount++;
            }

            $mat->update(['sms_sent' => 1]);
        }

        // 4. EPI CHILD IMMUNIZATION REGISTRY REMINDERS (Advance notice before next vaccine due date)
        $immunReminders = Immunization::where(function($q) use ($threeDaysAhead, $tomorrow) {
                $q->where('due_date', $threeDaysAhead)
                  ->orWhere('due_date', $tomorrow);
            })
            ->where(function($q) {
                $q->whereNull('sms_sent')->orWhere('sms_sent', 0);
            })
            ->where('status', '!=', 'Completed')
            ->get();

        $immunSentCount = 0;
        foreach ($immunReminders as $imm) {
            $clinicLoc = self::getPreciseClinicLocation($imm->barangay);
            $phone = (string)($imm->parent_phone ?: '');
            $email = '';
            $guardianName = $imm->guardian_name ?: 'Parent / Guardian';

            if (!empty($imm->guardian_name)) {
                $r = Resident::whereRaw('LOWER(CONCAT(first_name, " ", last_name)) = ?', [strtolower(trim($imm->guardian_name))])->first();
                if ($r) {
                    if (empty($phone) && !empty($r->phone)) $phone = (string)$r->phone;
                    if (!empty($r->email)) $email = (string)$r->email;
                }
            }

            $dueDate = $imm->due_date ?: $threeDaysAhead;
            $is3Day = ($imm->due_date === $threeDaysAhead);
            $timePrefix = $is3Day ? "in 3 days on" : "tomorrow on";
            $doseStr = $imm->dose_number ? " (Dose {$imm->dose_number})" : "";

            if (!empty($email)) {
                try {
                    UserNotification::create([
                        'recipient_email' => $email,
                        'type' => 'Health',
                        'title' => "💉 EPI Vaccination Due Reminder: {$imm->child_name}",
                        'message' => "Reminder: {$imm->child_name}'s next vaccination for {$imm->vaccine_name}{$doseStr} is due {$timePrefix} {$dueDate} at {$clinicLoc}. Please bring immunization booklet.",
                        'ref_code' => "IMM-{$imm->id}",
                        'is_read' => 0,
                        'created_at' => now(),
                    ]);
                } catch (\Throwable $ne) {}

                EmailService::sendEmail([
                    'to' => $email,
                    'subject' => "💉 [EPI Immunization Reminder] Next Vaccine Dose for {$imm->child_name}",
                    'text' => "Dear {$guardianName},\n\nThis is a friendly reminder that {$imm->child_name}'s next vaccination for {$imm->vaccine_name}{$doseStr} is due {$timePrefix} {$dueDate}.\n\nPrecise Location: {$clinicLoc}\n\nPlease bring your child's Immunization Record Card (Bakuna Card).\n\nBarangay Health Services",
                    'recipientName' => $guardianName,
                    'barangay' => $imm->barangay,
                ]);
                $emailsSent++;
            }

            if (!empty($phone)) {
                SmsService::sendLiveSms(
                    $phone,
                    "EPI Vaccine Notice: Hello {$guardianName}! {$imm->child_name}'s next dose of {$imm->vaccine_name}{$doseStr} is due {$timePrefix} {$dueDate} at {$clinicLoc}. Please bring immunization card."
                );
                $immunSentCount++;
            }

            $imm->update(['sms_sent' => 1]);
        }

        return response()->json([
            'success' => true,
            'message' => "Successfully processed health reminders: {$sent3DayCount} 3-day appointment SMS, {$sent1DayCount} 1-day appointment SMS, {$maternalSentCount} maternal checkup SMS, {$immunSentCount} child immunization SMS, and {$emailsSent} reminder emails dispatched.",
            'three_day_sms_count' => $sent3DayCount,
            'one_day_sms_count' => $sent1DayCount,
            'maternal_sms_count' => $maternalSentCount,
            'immunization_sms_count' => $immunSentCount,
            'emails_sent' => $emailsSent,
            'total_reminders_dispatched' => $sent3DayCount + $sent1DayCount + $maternalSentCount + $immunSentCount + $emailsSent,
        ]);
    }

    public function markSmsSent(Request $request)
    {
        $maternalIds = $request->input('maternalIds', []);
        $immunizationIds = $request->input('immunizationIds', []);

        if (!empty($maternalIds)) {
            $cleanMatIds = array_map(function($id) {
                return (int)preg_replace('/[^\d]/', '', (string)$id);
            }, $maternalIds);
            $cleanMatIds = array_filter($cleanMatIds);
            if (!empty($cleanMatIds)) {
                MaternalRecord::whereIn('id', $cleanMatIds)->update(['sms_sent' => 1]);
            }
        }
        if (!empty($immunizationIds)) {
            $cleanImmIds = array_map(function($id) {
                return (int)preg_replace('/[^\d]/', '', (string)$id);
            }, $immunizationIds);
            $cleanImmIds = array_filter($cleanImmIds);
            if (!empty($cleanImmIds)) {
                Immunization::whereIn('id', $cleanImmIds)->update(['sms_sent' => 1]);
            }
        }

        return response()->json(['success' => true, 'message' => 'SMS reminder marked as sent']);
    }
}
