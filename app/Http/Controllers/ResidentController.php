<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\ClinicalEncounter;
use App\Models\DocumentRequest;
use App\Models\HealthAppointment;
use App\Models\Immunization;
use App\Models\MaternalRecord;
use App\Models\Resident;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\EmailService;
use App\Services\SmsService;
use Illuminate\Http\Request;

class ResidentController extends Controller
{
    public function index(Request $request)
    {
        $query = Resident::query();

        $barangay = $request->input('barangay');
        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $query->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
        }

        $purok = $request->input('purok');
        if (!empty($purok) && !str_contains(strtolower($purok), 'all')) {
            $query->where('purok', $purok);
        }

        $search = $request->input('search');
        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('address', 'like', "%{$search}%");
            });
        }

        $residents = $query->orderBy('last_name')->get();
        return response()->json($residents);
    }

    public function censusLookup(Request $request)
    {
        $barangay = trim((string)$request->input('barangay', ''));
        $search = trim((string)$request->input('search', ''));

        if (empty($barangay)) {
            return response()->json([
                'success' => false,
                'error' => 'Barangay is required to search census records.',
                'results' => []
            ], 400);
        }

        $norm = AuthController::normalizeBarangayName($barangay);
        $query = Resident::query();
        $query->where(function ($q) use ($norm) {
            $q->whereRaw('LOWER(barangay) = ?', [strtolower($norm)])
              ->orWhereRaw('LOWER(address) LIKE ?', ['%' . strtolower($norm) . '%']);
        });

        if (!empty($search)) {
            $searchClean = trim(preg_replace('/\s+/', ' ', $search));
            $terms = array_filter(explode(' ', $searchClean));
            $query->where(function ($q) use ($searchClean, $terms) {
                $q->whereRaw("CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) LIKE ?", ["%{$searchClean}%"])
                  ->orWhereRaw("CONCAT(COALESCE(first_name, ''), ' ', COALESCE(middle_name, ''), ' ', COALESCE(last_name, '')) LIKE ?", ["%{$searchClean}%"])
                  ->orWhereRaw("CONCAT(COALESCE(last_name, ''), ', ', COALESCE(first_name, '')) LIKE ?", ["%{$searchClean}%"])
                  ->orWhere('first_name', 'like', "%{$searchClean}%")
                  ->orWhere('last_name', 'like', "%{$searchClean}%");

                if (count($terms) > 1) {
                    $q->orWhere(function ($sub) use ($terms) {
                        foreach ($terms as $t) {
                            $sub->where(function ($termQ) use ($t) {
                                $termQ->where('first_name', 'like', "%{$t}%")
                                      ->orWhere('middle_name', 'like', "%{$t}%")
                                      ->orWhere('last_name', 'like', "%{$t}%");
                            });
                        }
                    });
                }
            });
        }

        $residents = $query->orderBy('last_name')->limit(30)->get();

        $userEmails = User::whereNotNull('email')->pluck('email')->map(fn($e) => strtolower(trim($e)))->toArray();
        $userIds = User::pluck('id')->toArray();

        $mapped = $residents->map(function ($r) use ($userEmails, $userIds) {
            $hasAccount = false;
            if (!empty($r->linked_user_id) && in_array($r->linked_user_id, $userIds)) {
                $hasAccount = true;
            } elseif (!empty($r->email) && in_array(strtolower(trim($r->email)), $userEmails)) {
                $hasAccount = true;
            }

            return [
                'id' => $r->id,
                'first_name' => $r->first_name,
                'middle_name' => $r->middle_name,
                'last_name' => $r->last_name,
                'date_of_birth' => $r->date_of_birth,
                'gender' => $r->gender,
                'civil_status' => $r->civil_status,
                'address' => $r->address,
                'purok' => $r->purok,
                'barangay' => $r->barangay,
                'city' => $r->city,
                'phone' => $r->phone,
                'email' => $r->email,
                'household_number' => $r->household_number,
                'is_census_only' => (bool)$r->is_census_only,
                'verification_status' => $r->verification_status,
                'has_account' => $hasAccount,
            ];
        });

        return response()->json([
            'success' => true,
            'barangay' => $norm,
            'count' => count($mapped),
            'results' => $mapped,
        ]);
    }

    public function getPending(Request $request)
    {
        $query = Resident::where(function ($q) {
            $q->where('verification_status', 'Pending_Review')
              ->orWhere('verification_status', 'Pending');
        });

        $barangay = $request->input('barangay');
        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all') && !str_contains(strtolower($barangay), 'city-wide')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $query->where(function ($q) use ($norm) {
                $q->whereRaw('LOWER(barangay) = ?', [strtolower($norm)])
                  ->orWhereRaw('LOWER(address) LIKE ?', ['%' . strtolower($norm) . '%']);
            });
        }

        $pending = $query->orderBy('submitted_at', 'desc')->get();
        return response()->json($pending);
    }

    public function fullProfile($id)
    {
        $resident = Resident::find($id);
        if (!$resident) {
            return response()->json(['error' => 'Resident not found'], 404);
        }

        $email = strtolower($resident->email ?? '');
        $user = !empty($email) ? User::whereRaw('LOWER(email) = ?', [$email])->first() : null;

        $docRequests = DocumentRequest::where(function ($q) use ($id, $email) {
            $q->where('resident_id', $id);
            if (!empty($email)) {
                $q->orWhereRaw('LOWER(email) = ?', [$email]);
            }
        })->get();
        foreach ($docRequests as $doc) {
            if (empty($doc->purok_certificate_photo) && !empty($doc->extra_fields)) {
                $extra = json_decode($doc->extra_fields, true);
                if (is_array($extra) && !empty($extra['purok_certificate_photo'])) {
                    $doc->purok_certificate_photo = $extra['purok_certificate_photo'];
                }
            }
        }

        $maternal = MaternalRecord::where('resident_id', $id)
            ->orWhereRaw('LOWER(mother_name) = ?', [strtolower("{$resident->first_name} {$resident->last_name}")])
            ->get();

        $childName = "{$resident->first_name} {$resident->last_name}";
        $immunizations = Immunization::whereRaw('LOWER(child_name) = ?', [strtolower($childName)])->get();

        $appointments = HealthAppointment::where('resident_id', $id)
            ->orWhereRaw('LOWER(resident_email) = ?', [$email])
            ->get();

        $consultations = ClinicalEncounter::whereRaw('LOWER(patient_name) = ?', [strtolower($childName)])->get();

        return response()->json([
            'resident' => $resident,
            'user' => $user,
            'documents' => $docRequests,
            'maternal' => $maternal,
            'immunizations' => $immunizations,
            'appointments' => $appointments,
            'consultations' => $consultations,
        ]);
    }

    public function store(Request $request)
    {
        $firstName = trim((string)$request->input('first_name', ''));
        $lastName = trim((string)$request->input('last_name', ''));
        $barangay = AuthController::normalizeBarangayName($request->input('barangay'));
        $email = strtolower(trim((string)$request->input('email', '')));

        $submittedId = $request->input('submitted_id');
        $idPath = AuthController::saveBase64Image($submittedId, 'census_id');

        $resident = Resident::create([
            'first_name' => $firstName,
            'middle_name' => trim((string)$request->input('middle_name', '')),
            'last_name' => $lastName,
            'date_of_birth' => $request->input('date_of_birth', '2000-01-01'),
            'gender' => $request->input('gender', 'Male'),
            'civil_status' => $request->input('civil_status', 'Single'),
            'address' => (string)$request->input('address', ''),
            'purok' => (string)$request->input('purok', '1'),
            'barangay' => $barangay,
            'city' => 'Butuan City',
            'phone' => (string)$request->input('phone', ''),
            'email' => $email,
            'employment_status' => $request->input('employment_status', 'Employed'),
            'submitted_id' => $idPath,
            'household_number' => $request->input('household_number'),
            'family_name' => $request->input('family_name'),
            'is_head_of_household' => $request->input('is_head_of_household', 0),
            'relationship_to_head' => $request->input('relationship_to_head', 'Member'),
            'is_census_only' => $request->input('is_census_only', 1),
            'years_of_residency' => $request->input('years_of_residency', '5'),
            'verification_status' => $request->input('verification_status', 'Verified'),
        ]);

        ActivityLog::create([
            'user_name' => 'BHW / Worker',
            'user_role' => 'bhw',
            'action' => "Recorded demographic census resident: {$firstName} {$lastName} ({$barangay})",
        ]);

        return response()->json([
            'success' => true,
            'resident' => $resident,
        ], 201);
    }

    public function resubmit(Request $request)
    {
        $email = strtolower(trim((string)$request->input('email', '')));
        $resident = Resident::whereRaw('LOWER(email) = ?', [$email])->first();

        $submittedId = $request->input('submitted_id');
        $idPath = AuthController::saveBase64Image($submittedId, 'resubmitted_id');

        $updateData = [
            'verification_status' => 'Pending_Review',
            'rejection_reason' => null,
            'submitted_at' => now(),
        ];
        if (!empty($idPath)) {
            $updateData['submitted_id'] = $idPath;
        }

        if ($resident) {
            $resident->update($updateData);
        }

        User::whereRaw('LOWER(email) = ?', [$email])->update([
            'verification_status' => 'Pending_Review',
            'rejection_reason' => null,
            'submitted_id' => $idPath ?: ($resident ? $resident->submitted_id : null),
        ]);

        ActivityLog::create([
            'user_name' => $resident ? "{$resident->first_name} {$resident->last_name}" : 'Resident',
            'user_role' => 'resident',
            'action' => "Resubmitted ID verification documents: {$email}",
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Your ID verification has been resubmitted and is under review.',
            'resident' => $resident,
        ]);
    }

    public function approve(Request $request, $id)
    {
        $resident = Resident::find($id);
        $user = null;

        if (!$resident) {
            $user = User::find($id);
            if ($user) {
                $resident = Resident::whereRaw('LOWER(email) = ?', [strtolower($user->email)])
                    ->orWhere('linked_user_id', $user->id)
                    ->first();
            }
        } else {
            if (!empty($resident->email)) {
                $user = User::whereRaw('LOWER(email) = ?', [strtolower($resident->email)])->first();
            }
        }

        if (!$resident && !$user) {
            return response()->json(['error' => 'Resident record not found'], 404);
        }

        $resBarangay = $resident?->barangay ?: ($user?->barangay ?: 'Pianing');
        $normBarangay = AuthController::normalizeBarangayName($resBarangay);

        // Security Guard: Check if an active administrator (superadmin or admin) exists for this resident's barangay
        $hasBarangayOfficial = User::whereIn('role', ['admin', 'superadmin'])
            ->where('status', 'Active')
            ->where(function ($q) use ($normBarangay) {
                $clean = strtolower($normBarangay);
                $q->whereRaw('LOWER(barangay) = ?', [$clean])
                  ->orWhereRaw('LOWER(barangay) LIKE ?', ["%{$clean}%"]);
            })
            ->exists();

        if (!$hasBarangayOfficial) {
            return response()->json([
                'error' => "Cannot approve resident: No active Barangay Admin or Superadmin account exists for Barangay {$normBarangay}. Please deploy a Barangay Official for {$normBarangay} first.",
                'no_barangay_officials' => true,
                'barangay' => $normBarangay
            ], 422);
        }

        if ($resident) {
            $resident->update([
                'verification_status' => 'Verified',
                'rejection_reason' => null,
            ]);
        }

        if ($user) {
            $user->update([
                'verification_status' => 'Verified',
                'rejection_reason' => null,
            ]);
        }

        $email = $resident?->email ?: ($user?->email ?: '');
        $phone = $resident?->phone ?: ($user?->phone ?: '');
        $name = $resident ? "{$resident->first_name} {$resident->last_name}" : ($user?->name ?: 'Resident');
        $barangay = $resident?->barangay ?: ($user?->barangay ?: 'Pianing');

        ActivityLog::create([
            'user_name' => $request->input('approved_by', 'Barangay Administrator'),
            'user_role' => 'admin',
            'action' => "Approved citizen identity verification: {$name} ({$barangay})",
        ]);

        // Dispatch notifications across all 3 channels: In-App, Email, SMS
        if (!empty($email)) {
            EmailService::sendVerificationNoticeEmail($email, $name, 'Verified', null, $barangay);
            try {
                UserNotification::create([
                    'recipient_email' => $email,
                    'type' => 'Verification',
                    'title' => 'Account Verified!',
                    'message' => "Welcome {$name}! Your Barangay {$barangay} account has been officially APPROVED and VERIFIED. You can now access all services online.",
                    'is_read' => 0,
                    'created_at' => now(),
                ]);
            } catch (\Throwable $ne) {}
        }
        if (!empty($phone)) {
            SmsService::sendLiveSms(
                $phone,
                "Barangay {$barangay}: Hello {$name}! Your resident account has been officially APPROVED and VERIFIED. You can now request clearances, book appointments, and access all services online."
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Resident applicant verified successfully.',
            'resident' => $resident ?: $user,
        ]);
    }

    public function unverify(Request $request, $id)
    {
        $resident = Resident::find($id);
        $user = null;
        if (!$resident) {
            $user = User::find($id);
            if ($user) {
                $resident = Resident::whereRaw('LOWER(email) = ?', [strtolower($user->email)])->first();
            }
        }

        if ($resident) $resident->update(['verification_status' => 'Unverified']);
        if ($user) $user->update(['verification_status' => 'Unverified']);

        return response()->json(['success' => true, 'resident' => $resident ?: $user]);
    }

    public function reject(Request $request, $id)
    {
        $resident = Resident::find($id);
        $user = null;
        if (!$resident) {
            $user = User::find($id);
            if ($user) {
                $resident = Resident::whereRaw('LOWER(email) = ?', [strtolower($user->email)])->first();
            }
        }

        if (!$resident && !$user) {
            return response()->json(['error' => 'Resident record not found'], 404);
        }

        $reason = $request->input('rejection_reason', 'Uploaded Government ID is blurry or unreadable. Please upload a clear photo.');

        if ($resident) {
            $resident->update([
                'verification_status' => 'Rejected',
                'rejection_reason' => $reason,
            ]);
        }
        if ($user) {
            $user->update([
                'verification_status' => 'Rejected',
                'rejection_reason' => $reason,
            ]);
        }

        $email = $resident?->email ?: ($user?->email ?: '');
        $name = $resident ? "{$resident->first_name} {$resident->last_name}" : ($user?->name ?: 'Resident');
        $barangay = $resident?->barangay ?: ($user?->barangay ?: 'Pianing');

        ActivityLog::create([
            'user_name' => $request->input('rejected_by', 'Barangay Administrator'),
            'user_role' => 'admin',
            'action' => "Rejected applicant identity verification: {$name}. Reason: {$reason}",
        ]);

        if (!empty($email)) {
            EmailService::sendVerificationNoticeEmail($email, $name, 'Rejected', $reason, $barangay);
        }

        return response()->json([
            'success' => true,
            'message' => 'Resident applicant rejected.',
            'resident' => $resident ?: $user,
        ]);
    }

    public function update(Request $request, $id)
    {
        $resident = Resident::find($id);
        if (!$resident) {
            return response()->json(['error' => 'Resident not found'], 404);
        }

        $data = $request->all();
        if ($request->has('submitted_id')) {
            $data['submitted_id'] = AuthController::saveBase64Image($request->input('submitted_id'), 'resident_id');
        }

        $resident->update($data);
        return response()->json(['success' => true, 'resident' => $resident]);
    }

    public function purge($id)
    {
        $resident = Resident::find($id);
        if (!$resident) {
            return response()->json(['error' => 'Resident not found'], 404);
        }

        $resident->delete();
        return response()->json(['success' => true, 'message' => 'Resident record deleted']);
    }
}
