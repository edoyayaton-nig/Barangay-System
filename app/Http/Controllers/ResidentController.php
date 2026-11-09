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
use Illuminate\Support\Facades\Hash;

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

    public static function calculateCensusSimilarity($applicant, $census): array
    {
        $appFirstName = strtolower(trim((string)($applicant->first_name ?? $applicant['first_name'] ?? '')));
        $appLastName = strtolower(trim((string)($applicant->last_name ?? $applicant['last_name'] ?? '')));
        $appMiddleName = strtolower(trim((string)($applicant->middle_name ?? $applicant['middle_name'] ?? '')));
        $appFullName = trim("{$appFirstName} {$appLastName}");
        $appPurok = trim((string)($applicant->purok ?? $applicant['purok'] ?? ''));
        $appDob = trim((string)($applicant->date_of_birth ?? $applicant['date_of_birth'] ?? ''));
        $appGender = strtolower(trim((string)($applicant->gender ?? $applicant['gender'] ?? '')));
        $appAddress = strtolower(trim((string)($applicant->address ?? $applicant['address'] ?? '')));

        $cenFirstName = strtolower(trim((string)($census->first_name ?? '')));
        $cenLastName = strtolower(trim((string)($census->last_name ?? '')));
        $cenMiddleName = strtolower(trim((string)($census->middle_name ?? '')));
        $cenFullName = trim("{$cenFirstName} {$cenLastName}");
        $cenPurok = trim((string)($census->purok ?? ''));
        $cenDob = trim((string)($census->date_of_birth ?? ''));
        $cenGender = strtolower(trim((string)($census->gender ?? '')));
        $cenAddress = strtolower(trim((string)($census->address ?? '')));

        // 1. Name Similarity (up to 60 points)
        $namePercent = 0;
        similar_text($appFullName, $cenFullName, $namePercent);

        if (!empty($appMiddleName) || !empty($cenMiddleName)) {
            $appFullMid = trim("{$appFirstName} {$appMiddleName} {$appLastName}");
            $cenFullMid = trim("{$cenFirstName} {$cenMiddleName} {$cenLastName}");
            $midPercent = 0;
            similar_text($appFullMid, $cenFullMid, $midPercent);
            $namePercent = max($namePercent, $midPercent);
        }

        // Soundex / Metaphone check for phonetic equivalence
        if (!empty($appLastName) && !empty($cenLastName) && soundex($appLastName) === soundex($cenLastName)) {
            if (!empty($appFirstName) && !empty($cenFirstName) && soundex($appFirstName) === soundex($cenFirstName)) {
                $namePercent = max($namePercent, 82);
            }
        }

        $nameScore = ($namePercent / 100) * 60;

        // 2. Purok / Street Match (up to 15 points)
        $purokScore = 0;
        $appPurokNum = preg_replace('/[^0-9]/', '', $appPurok);
        $cenPurokNum = preg_replace('/[^0-9]/', '', $cenPurok);
        if (!empty($appPurokNum) && !empty($cenPurokNum) && $appPurokNum === $cenPurokNum) {
            $purokScore = 15;
        } elseif (!empty($appPurokNum) && str_contains($cenAddress, "purok {$appPurokNum}")) {
            $purokScore = 13;
        } elseif (!empty($appPurok) && !empty($cenPurok)) {
            $pPercent = 0;
            similar_text(strtolower($appPurok), strtolower($cenPurok), $pPercent);
            $purokScore = ($pPercent / 100) * 10;
        }

        // 3. Date of Birth Match (up to 15 points)
        $dobScore = 0;
        if (!empty($appDob) && !empty($cenDob) && $appDob !== '2000-01-01' && $cenDob !== '2000-01-01') {
            if ($appDob === $cenDob) {
                $dobScore = 15;
            } else {
                $appYear = substr($appDob, 0, 4);
                $cenYear = substr($cenDob, 0, 4);
                if ($appYear === $cenYear && !empty($appYear)) {
                    $dobScore = 8;
                }
            }
        }

        // 4. Gender & Address Token Overlap (up to 10 points)
        $extraScore = 0;
        if (!empty($appGender) && !empty($cenGender) && $appGender === $cenGender) {
            $extraScore += 4;
        }
        if (!empty($appAddress) && !empty($cenAddress)) {
            $addrPercent = 0;
            similar_text($appAddress, $cenAddress, $addrPercent);
            $extraScore += ($addrPercent / 100) * 6;
        }

        $totalScore = (int)round(min(100, $nameScore + $purokScore + $dobScore + $extraScore));

        // Discrepancy details
        $discrepancies = [];
        $appOrigFirst = $applicant->first_name ?? $applicant['first_name'] ?? '';
        $appOrigLast = $applicant->last_name ?? $applicant['last_name'] ?? '';
        $appOrigAddr = $applicant->address ?? $applicant['address'] ?? '';
        if ($appFullName !== $cenFullName) {
            $discrepancies[] = "Name variation: Inputted '{$appOrigFirst} {$appOrigLast}' vs Census record '{$census->first_name} {$census->last_name}'";
        }
        if (!empty($appPurokNum) && !empty($cenPurokNum) && $appPurokNum !== $cenPurokNum) {
            $discrepancies[] = "Purok mismatch: Inputted 'Purok {$appPurokNum}' vs Official Census 'Purok {$cenPurokNum}'";
        }
        if (!empty($appDob) && !empty($cenDob) && $appDob !== $cenDob) {
            $discrepancies[] = "Birthdate difference: Inputted '{$appDob}' vs Census record '{$cenDob}'";
        }
        if (!empty($appOrigAddr) && !empty($census->address) && strtolower(trim($appOrigAddr)) !== strtolower(trim($census->address))) {
            $discrepancies[] = "Address variation: Inputted '{$appOrigAddr}' vs Census '{$census->address}'";
        }

        return [
            'score' => $totalScore,
            'name_similarity' => (int)round($namePercent),
            'discrepancies' => $discrepancies,
        ];
    }

    public function getPending(Request $request)
    {
        $query = Resident::where(function ($q) {
            $q->where('verification_status', 'Pending_Review')
              ->orWhere('verification_status', 'Pending')
              ->orWhere('verification_status', 'Correction_Required')
              ->orWhere('verification_status', 'Rejected');
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

        // Cross-reference each pending application against official census records
        $pendingIds = $pending->pluck('id')->toArray();
        $censusPool = Resident::whereNotIn('id', $pendingIds)
            ->where(function ($q) {
                $q->where('is_census_only', 1)
                  ->orWhere('verification_status', 'Verified');
            })
            ->get();

        $enriched = $pending->map(function ($p) use ($censusPool) {
            $bestScore = 0;
            $bestCensus = null;
            $bestDiscrepancies = [];

            $pBarangay = strtolower(AuthController::normalizeBarangayName($p->barangay));
            $candidates = $censusPool->filter(function ($c) use ($pBarangay) {
                $cBarangay = strtolower(AuthController::normalizeBarangayName($c->barangay));
                return empty($pBarangay) || empty($cBarangay) || $pBarangay === $cBarangay;
            });
            if ($candidates->isEmpty()) {
                $candidates = $censusPool;
            }

            foreach ($candidates as $c) {
                $sim = self::calculateCensusSimilarity($p, $c);
                if ($sim['score'] > $bestScore) {
                    $bestScore = $sim['score'];
                    $bestCensus = $c;
                    $bestDiscrepancies = $sim['discrepancies'];
                }
            }

            $pArray = $p->toArray();
            // Minimum threshold for "Has Record": 55% similarity
            $hasRecord = ($bestScore >= 55 && $bestCensus !== null);
            $pArray['census_match_status'] = $hasRecord ? 'has_record' : 'no_record';
            $pArray['similarity_score'] = $bestScore;
            $pArray['closest_census_record'] = $hasRecord ? $bestCensus : null;
            $pArray['similarity_discrepancies'] = $bestDiscrepancies;

            return $pArray;
        });

        return response()->json($enriched);
    }

    public function censusSimilarity($id)
    {
        $applicant = Resident::find($id);
        if (!$applicant) {
            return response()->json(['error' => 'Applicant not found'], 404);
        }

        $censusPool = Resident::where('id', '!=', $applicant->id)
            ->where(function ($q) {
                $q->where('is_census_only', 1)
                  ->orWhere('verification_status', 'Verified');
            })
            ->get();

        $results = [];
        foreach ($censusPool as $c) {
            $sim = self::calculateCensusSimilarity($applicant, $c);
            if ($sim['score'] >= 25) {
                $results[] = [
                    'resident' => $c,
                    'score' => $sim['score'],
                    'name_similarity' => $sim['name_similarity'],
                    'discrepancies' => $sim['discrepancies'],
                ];
            }
        }

        usort($results, fn($a, $b) => $b['score'] <=> $a['score']);
        $topCandidates = array_slice($results, 0, 6);

        $best = $topCandidates[0] ?? null;
        $hasRecord = ($best && $best['score'] >= 55);

        return response()->json([
            'applicant' => $applicant,
            'census_match_status' => $hasRecord ? 'has_record' : 'no_record',
            'similarity_score' => $best['score'] ?? 0,
            'closest_census_record' => $best['resident'] ?? null,
            'discrepancies' => $best['discrepancies'] ?? [],
            'candidates' => $topCandidates,
        ]);
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
        $province = (string)$request->input('province', 'Agusan del Norte');
        $zipCode = (string)$request->input('zip_code', '8600');
        $city = (string)$request->input('city', 'Butuan City');
        $phone = (string)$request->input('phone', '');
        $purok = (string)$request->input('purok', '1');
        $address = (string)$request->input('address', '');

        $submittedId = $request->input('submitted_id');
        $idPath = AuthController::saveBase64Image($submittedId, 'census_id');

        $resident = Resident::create([
            'first_name' => $firstName,
            'middle_name' => trim((string)$request->input('middle_name', '')),
            'last_name' => $lastName,
            'date_of_birth' => $request->input('date_of_birth', '2000-01-01'),
            'gender' => $request->input('gender', 'Male'),
            'civil_status' => $request->input('civil_status', 'Single'),
            'address' => $address,
            'purok' => $purok,
            'barangay' => $barangay,
            'city' => $city,
            'province' => $province,
            'zip_code' => $zipCode,
            'phone' => $phone,
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

        // When a citizen is censused, automatically provision an account
        $generatedPassword = 'Brgy@' . date('Y') . '!' . mt_rand(100, 999);
        $linkedUser = null;
        if (!empty($email)) {
            $linkedUser = User::whereRaw('LOWER(email) = ?', [$email])->first();
            if (!$linkedUser) {
                $userFields = [
                    'name' => trim("{$firstName} {$lastName}"),
                    'email' => $email,
                    'password_hash' => Hash::make($generatedPassword),
                    'role' => 'resident',
                    'status' => 'Active',
                    'verification_status' => 'Verified',
                    'civil_status' => $request->input('civil_status', 'Single'),
                    'phone' => $phone,
                    'address' => $address,
                    'barangay' => $barangay,
                    'city' => $city,
                    'province' => $province,
                    'zip_code' => $zipCode,
                ];
                if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'purok')) {
                    $userFields['purok'] = $purok;
                }
                $linkedUser = User::create($userFields);
            }
            $resident->linked_user_id = $linkedUser->id;
            $resident->save();

            // Automatically send credentials via EmailService / Laravel Mail
            try {
                EmailService::sendCredentialNoticeEmail($email, "{$firstName} {$lastName}", $generatedPassword, $barangay);
            } catch (\Throwable $e) {}

            // Also send SMS credentials if phone is provided
            if (!empty($phone)) {
                try {
                    \App\Services\SmsService::sendLiveSms(
                        $phone,
                        "Barangay {$barangay}: Welcome {$firstName}! Your resident account has been created. Login Email: {$email}, Password: {$generatedPassword}."
                    );
                } catch (\Throwable $e) {}
            }
        }

        ActivityLog::create([
            'user_name' => 'BHW / Worker',
            'user_role' => 'bhw',
            'action' => "Recorded demographic census resident: {$firstName} {$lastName} ({$barangay})",
        ]);

        return response()->json([
            'success' => true,
            'resident' => $resident,
            'user_created' => (bool)$linkedUser,
            'account_email' => $email ?: null,
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

        $linkCensusId = $request->input('link_census_id');
        $cen = null;
        if (!empty($linkCensusId)) {
            $cen = Resident::find($linkCensusId);
        }

        // Auto-match census record if not explicitly provided but matching census inhabitant exists
        if (!$cen && $resident && empty($resident->household_number)) {
            $cen = Resident::where('id', '!=', $resident->id)
                ->where(function ($q) use ($resident) {
                    $q->where(function ($sub) use ($resident) {
                        $sub->whereRaw('LOWER(first_name) = ?', [strtolower(trim($resident->first_name))])
                            ->whereRaw('LOWER(last_name) = ?', [strtolower(trim($resident->last_name))]);
                    });
                })
                ->whereNotNull('household_number')
                ->first();
        }

        if ($cen) {
            // THE OFFICIAL CENSUS RECORD IS ABSOLUTE AND FIXED.
            // Under no circumstances do we overwrite official census fields:
            // (first_name, middle_name, last_name, date_of_birth, gender, civil_status, address, purok, household_number, family_name, family_role)
            // It only receives account verification linkage and contact credentials:
            $cleanP = trim(str_ireplace('purok', '', (string)($cen->purok ?: '1'))) ?: '1';
            $cenHh = !empty($cen->household_number) ? $cen->household_number : "P{$cleanP}-H{$cen->id}";

            $cen->update([
                'household_number' => $cenHh,
                'linked_user_id' => $user?->id ?: ($cen->linked_user_id ?: $resident?->linked_user_id),
                'verification_status' => 'Verified',
                'is_census_only' => 0,
                'phone' => $resident?->phone ?: ($user?->phone ?: $cen->phone),
                'email' => $resident?->email ?: ($user?->email ?: $cen->email),
                'submitted_id' => $resident?->submitted_id ?: ($user?->submitted_id ?: $cen->submitted_id),
                'id_type' => $resident?->id_type ?: ($user?->id_type ?: $cen->id_type),
                'rejection_reason' => null,
            ]);

            // Synchronize the user account to match the authoritative, verified census identity
            if ($user) {
                $userUpdate = [
                    'verification_status' => 'Verified',
                    'rejection_reason' => null,
                    'name' => trim("{$cen->first_name} " . (!empty($cen->middle_name) ? "{$cen->middle_name} " : "") . "{$cen->last_name}"),
                    'address' => $cen->address,
                    'barangay' => $cen->barangay,
                ];
                if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'purok')) {
                    $userUpdate['purok'] = $cen->purok;
                }
                $user->update($userUpdate);
            }

            // If the applicant record was a separate temporary resident row created during registration:
            if ($resident && $resident->id !== $cen->id) {
                // Re-link any document requests or appointments from temporary row to official census row
                DB::table('document_requests')->where('resident_id', $resident->id)->update(['resident_id' => $cen->id]);
                DB::table('appointments')->where('resident_id', $resident->id)->update(['resident_id' => $cen->id]);
                $resident->delete();
            }

            $activeResident = $cen;
        } else {
            // Standalone resident verified directly (e.g. added by admin or verified without prior census row)
            $cleanP = trim(str_ireplace('purok', '', (string)($resident?->purok ?: '1'))) ?: '1';
            $hhNum = !empty($resident?->household_number) ? $resident->household_number : "P{$cleanP}-H{$resident->id}";

            if ($resident) {
                $resident->update([
                    'household_number' => $hhNum,
                    'verification_status' => 'Verified',
                    'is_census_only' => 0,
                    'rejection_reason' => null,
                ]);
            }

            if ($user) {
                $user->update([
                    'verification_status' => 'Verified',
                    'rejection_reason' => null,
                ]);
            }

            $activeResident = $resident ?: $user;
        }

        $email = $activeResident?->email ?: ($user?->email ?: '');
        $phone = $activeResident?->phone ?: ($user?->phone ?: '');
        $name = ($activeResident instanceof Resident) ? "{$activeResident->first_name} {$activeResident->last_name}" : ($user?->name ?: 'Resident');
        $barangay = $activeResident?->barangay ?: ($user?->barangay ?: 'Pianing');

        // Resolve or retrieve the staged credentials to dispatch to the resident upon approval
        $sendPassword = $user?->staged_password ?: ($resident?->staged_password ?: ($cen?->staged_password ?: null));
        if (empty($sendPassword)) {
            $sendPassword = 'Brgy@' . date('Y') . '!' . mt_rand(100, 999);
        }

        if ($user) {
            $user->password_hash = Hash::make($sendPassword);
            $user->status = 'Active';
            $user->verification_status = 'Verified';
            $user->staged_password = null; // Clear after delivery
            $user->save();
        }
        if ($resident) {
            $resident->staged_password = null;
            $resident->save();
        }
        if ($cen) {
            $cen->staged_password = null;
            $cen->save();
        }

        ActivityLog::create([
            'user_name' => $request->input('approved_by', 'Barangay Administrator'),
            'user_role' => 'admin',
            'action' => "Approved citizen identity verification and dispatched login credentials: {$name} ({$barangay})",
        ]);

        // Dispatch official login credentials across all channels: In-App, Email, SMS upon Admin Approval!
        if (!empty($email)) {
            try {
                EmailService::sendCredentialNoticeEmail($email, $name, $sendPassword, $barangay);
            } catch (\Throwable $e) {}

            try {
                EmailService::sendVerificationNoticeEmail($email, $name, 'Verified', null, $barangay);
            } catch (\Throwable $e) {}

            try {
                UserNotification::create([
                    'recipient_email' => $email,
                    'type' => 'Verification',
                    'title' => 'Account Verified & Credentials Issued!',
                    'message' => "Welcome {$name}! Your Barangay {$barangay} account has been officially APPROVED. Your Login Email: {$email} | Temporary Password: {$sendPassword}. You can now sign in to access all services online.",
                    'is_read' => 0,
                    'created_at' => now(),
                ]);
            } catch (\Throwable $ne) {}
        }

        if (!empty($phone)) {
            try {
                SmsService::sendLiveSms(
                    $phone,
                    "Barangay {$barangay}: Mabuhay {$name}! Your resident account has been officially APPROVED. Your Login Credentials -> Email: {$email} | Temporary Password: {$sendPassword}. Sign in now at your barangay portal."
                );
            } catch (\Throwable $e) {}
        }

        return response()->json([
            'success' => true,
            'message' => 'Resident applicant verified and login credentials dispatched successfully to resident email and phone.',
            'resident' => $activeResident ?: ($resident ?: $user),
            'credentials_sent' => true,
            'generated_password' => $sendPassword,
            'email' => $email,
            'phone' => $phone,
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
        } else {
            if ($resident->linked_user_id) {
                $user = User::find($resident->linked_user_id);
            }
            if (!$user && !empty($resident->email)) {
                $user = User::whereRaw('LOWER(email) = ?', [strtolower($resident->email)])->first();
            }
        }

        if (!$resident && !$user) {
            return response()->json(['error' => 'Resident record not found'], 404);
        }

        $reason = $request->input('rejection_reason') ?: $request->input('reason') ?: 'Uploaded Government ID is blurry or unreadable. Please upload a clear photo.';

        // Use 'Correction_Required' / 'Rejected' status — NEVER delete the user submission!
        if ($resident) {
            $resident->update([
                'verification_status' => 'Correction_Required',
                'rejection_reason' => $reason,
            ]);
        }
        if ($user) {
            $user->update([
                'verification_status' => 'Correction_Required',
                'rejection_reason' => $reason,
            ]);
        }

        $email = $resident?->email ?: ($user?->email ?: '');
        $name = $resident ? "{$resident->first_name} {$resident->last_name}" : ($user?->name ?: 'Resident');
        $barangay = $resident?->barangay ?: ($user?->barangay ?: 'Pianing');

        ActivityLog::create([
            'user_name' => $request->input('rejected_by', 'Barangay Administrator'),
            'user_role' => 'admin',
            'action' => "Requested correction on resident identity verification: {$name}. Reason: {$reason}",
        ]);

        // STRICT POLICY: Exactly 1 Email, exactly 1 SMS, and exactly 1 In-App notification!
        if (!empty($email)) {
            EmailService::sendVerificationNoticeEmail($email, $name, 'Correction_Required', $reason, $barangay);
        }

        $phone = $resident?->phone ?: ($user?->phone ?: '');
        if (!empty($phone)) {
            SmsService::sendLiveSms(
                $phone,
                "Barangay {$barangay}: Hello {$name}, your resident application requires revision. Reason: {$reason}. Please log in to re-upload your ID."
            );
        }

        // Strictly record 1 In-App Notification to resident's notification center
        if (!empty($email)) {
            try {
                \App\Models\UserNotification::create([
                    'recipient_email' => $email,
                    'type' => 'account',
                    'title' => '⚠️ Notice: ID Verification / Correction Required',
                    'message' => "Hello {$name}, your account application for Barangay {$barangay} requires revision. Reason: \"{$reason}\". Please log in to your portal to re-upload a clear copy of your valid Government ID.",
                    'ref_code' => "APP-{$id}",
                    'is_read' => 0,
                    'created_at' => now(),
                ]);
            } catch (\Throwable $e) {}
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
