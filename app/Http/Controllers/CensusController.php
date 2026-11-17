<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Resident;
use App\Models\User;
use App\Services\EmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class CensusController extends Controller
{
    public function stats(Request $request)
    {
        $barangay = $request->input('barangay');
        $purok = $request->input('purok');

        $baseQuery = Resident::query();

        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all') && !str_contains(strtolower($barangay), 'city-wide')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $baseQuery->where(function ($q) use ($norm) {
                $q->whereRaw("LOWER(barangay) = ?", [strtolower($norm)])
                  ->orWhere(function ($sub) use ($norm) {
                      $sub->whereNull('barangay')->orWhere('barangay', '')
                          ->whereRaw("LOWER(address) LIKE ?", ['%' . strtolower($norm) . '%']);
                  });
            });
        }

        $allBarangayResidents = $baseQuery->get();

        $now = date('Y');

        // Always compute full purok breakdown across the entire barangay so tab pills never collapse to 0
        $purokMap = [];
        for ($i = 1; $i <= 6; $i++) {
            $purokMap[(string)$i] = [
                'purok' => "Purok {$i}",
                'population' => 0,
                'households' => 0,
                'families' => 0,
                'seniors' => 0,
                'children' => 0,
                'employed' => 0,
                'unemployed' => 0,
            ];
        }

        foreach ($allBarangayResidents as $r) {
            $pNum = trim(str_ireplace('purok', '', (string)$r->purok));
            if (isset($purokMap[$pNum])) {
                $purokMap[$pNum]['population']++;
                $age = !empty($r->date_of_birth) ? max(0, $now - (int)date('Y', strtotime($r->date_of_birth))) : 25;
                if ($age >= 60) $purokMap[$pNum]['seniors']++;
                elseif ($age < 18) $purokMap[$pNum]['children']++;

                if (in_array($r->employment_status, ['Employed', 'Self-Employed'])) {
                    $purokMap[$pNum]['employed']++;
                } elseif ($r->employment_status === 'Unemployed') {
                    $purokMap[$pNum]['unemployed']++;
                }
            }
        }

        foreach ($purokMap as $k => &$pInfo) {
            if ($pInfo['households'] === 0 && $pInfo['population'] > 0) {
                $pInfo['households'] = (int)ceil($pInfo['population'] / 3);
            }
            if ($pInfo['families'] === 0) {
                $pInfo['families'] = $pInfo['households'];
            }
        }
        unset($pInfo);

        // Apply purok filter if requested, or keep full barangay dataset
        $residents = $allBarangayResidents;
        if (!empty($purok) && !str_contains(strtolower($purok), 'all')) {
            $cleanP = preg_replace('/purok\s*/i', '', (string)$purok);
            $residents = $allBarangayResidents->filter(function ($r) use ($cleanP) {
                $rP = trim(str_ireplace('purok', '', (string)$r->purok));
                if ($rP === $cleanP) return true;
                $hh = strtoupper((string)$r->household_number);
                if (str_starts_with($hh, "P{$cleanP}-") || str_contains($hh, "HH-P{$cleanP}")) return true;
                $addr = strtolower((string)$r->address);
                return str_contains($addr, "purok {$cleanP}") || str_contains($addr, "purok {$cleanP} ");
            });
        }

        $totalPopulation = $residents->count();
        $totalHouseholds = $residents->pluck('household_number')->filter()->unique()->count();
        if ($totalHouseholds === 0 && $totalPopulation > 0) {
            $totalHouseholds = (int)ceil($totalPopulation / 3);
        }
        $totalFamilies = $residents->pluck('family_name')->filter()->unique()->count() ?: $totalHouseholds;

        $totalBarangayPopulation = $allBarangayResidents->count();
        $totalBarangayHouseholds = $allBarangayResidents->pluck('household_number')->filter()->unique()->count() ?: 375;
        $totalBarangayFamilies = $allBarangayResidents->pluck('family_name')->filter()->unique()->count() ?: 409;

        $seniors = 0;
        $seniorsMale = 0;
        $seniorsFemale = 0;
        $children = 0;
        $adults = 0;
        $employed = 0;
        $unemployed = 0;

        foreach ($residents as $r) {
            $age = 25;
            if (!empty($r->date_of_birth)) {
                $birthYear = (int)date('Y', strtotime($r->date_of_birth));
                $age = max(0, $now - $birthYear);
            }

            if ($age >= 60) {
                $seniors++;
                if (strtolower($r->gender) === 'female') {
                    $seniorsFemale++;
                } else {
                    $seniorsMale++;
                }
            } elseif ($age < 18) {
                $children++;
            } else {
                $adults++;
            }

            $emp = $r->employment_status;
            if (in_array($emp, ['Employed', 'Self-Employed'])) {
                $employed++;
            } elseif ($emp === 'Unemployed') {
                $unemployed++;
            }
        }

        $totalWorkforce = $employed + $unemployed;
        $rate = $totalWorkforce > 0 ? (int)round(($employed / $totalWorkforce) * 100) : 80;

        $maleCount = 0;
        $femaleCount = 0;
        $otherGenderCount = 0;
        foreach ($residents as $r) {
            $g = strtolower(trim((string)$r->gender));
            if ($g === 'male' || $g === 'm') $maleCount++;
            elseif ($g === 'female' || $g === 'f') $femaleCount++;
            else $otherGenderCount++;
        }

        return response()->json([
            'success' => true,
            'barangay' => $barangay ?: 'Pianing',
            'purok' => $purok ?: 'all',
            'total_households' => (!empty($purok) && !str_contains(strtolower($purok), 'all')) ? $totalHouseholds : $totalBarangayHouseholds,
            'total_families' => (!empty($purok) && !str_contains(strtolower($purok), 'all')) ? $totalFamilies : $totalBarangayFamilies,
            'total_population' => (!empty($purok) && !str_contains(strtolower($purok), 'all')) ? $totalPopulation : $totalBarangayPopulation,
            'total_barangay_households' => $totalBarangayHouseholds,
            'total_barangay_families' => $totalBarangayFamilies,
            'total_barangay_population' => $totalBarangayPopulation,
            'gender' => [
                'male' => $maleCount,
                'female' => $femaleCount,
                'other' => $otherGenderCount,
            ],
            'senior_citizens' => [
                'total' => $seniors,
                'male' => $seniorsMale,
                'female' => $seniorsFemale,
            ],
            'children_count' => $children,
            'adults_count' => $adults,
            'employment' => [
                'employed' => $employed,
                'unemployed' => $unemployed,
                'rate_percentage' => $rate,
            ],
            'purok_breakdown' => array_values($purokMap),
        ]);
    }

    public function households(Request $request)
    {
        $barangay = $request->input('barangay');
        $purok = $request->input('purok');

        $query = Resident::query();

        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all') && !str_contains(strtolower($barangay), 'city-wide')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $query->whereRaw("LOWER(barangay) = ?", [strtolower($norm)]);
        }

        if (!empty($purok) && !str_contains(strtolower($purok), 'all')) {
            $cleanP = preg_replace('/purok\s*/i', '', (string)$purok);
            $query->where(function ($q) use ($cleanP) {
                $q->where('purok', $cleanP)->orWhere('purok', "Purok {$cleanP}");
            });
        }

        $rows = $query->orderBy('purok')->orderBy('household_number')->get();
        $hhMap = [];
        $now = date('Y');

        foreach ($rows as $r) {
            $cleanP = trim(str_ireplace('purok', '', (string)($r->purok ?: '1'))) ?: '1';
            $hhNum = $r->household_number ?: "P{$cleanP}-H{$r->id}";
            $age = !empty($r->date_of_birth) ? max(0, $now - (int)date('Y', strtotime($r->date_of_birth))) : 25;
            $isSenior = $age >= 60;
            $isChild = $age < 18;
            $emp = $r->employment_status ?: ($isSenior ? 'Retired' : ($isChild ? 'Student' : 'Employed'));

            $memberObj = array_merge($r->toArray(), [
                'age' => $age,
                'purok' => $cleanP,
                'is_senior' => $isSenior,
                'is_child' => $isChild,
                'employment_status' => $emp,
                'is_head_of_household' => (bool)$r->is_head_of_household,
            ]);

            if (!isset($hhMap[$hhNum])) {
                $hhMap[$hhNum] = [
                    'household_number' => $hhNum,
                    'purok' => "Purok {$cleanP}",
                    'barangay' => $r->barangay ?: 'Pianing',
                    'family_name' => $r->family_name ?: ($r->last_name ?: 'Resident'),
                    'head_name' => $r->is_head_of_household ? "{$r->first_name} {$r->last_name}" : '',
                    'total_members' => 0,
                    'seniors_count' => 0,
                    'seniors_male' => 0,
                    'seniors_female' => 0,
                    'children_count' => 0,
                    'employed_count' => 0,
                    'unemployed_count' => 0,
                    'members' => [],
                ];
            }

            $hhMap[$hhNum]['total_members']++;
            if (empty($hhMap[$hhNum]['head_name']) || $r->is_head_of_household) {
                $hhMap[$hhNum]['head_name'] = "{$r->first_name} {$r->last_name}";
            }
            if ($isSenior) {
                $hhMap[$hhNum]['seniors_count']++;
                if (strtolower($r->gender) === 'female') $hhMap[$hhNum]['seniors_female']++;
                else $hhMap[$hhNum]['seniors_male']++;
            }
            if ($isChild) $hhMap[$hhNum]['children_count']++;
            if (in_array($emp, ['Employed', 'Self-Employed'])) $hhMap[$hhNum]['employed_count']++;
            if ($emp === 'Unemployed') $hhMap[$hhNum]['unemployed_count']++;
            $hhMap[$hhNum]['members'][] = $memberObj;
        }

        return response()->json(array_values($hhMap));
    }

    public function population(Request $request)
    {
        $barangay = $request->input('barangay');
        $query = Resident::query();

        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all') && !str_contains(strtolower($barangay), 'city-wide')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $query->where(function ($q) use ($norm) {
                $q->whereRaw("LOWER(barangay) = ?", [strtolower($norm)])
                  ->orWhere(function ($sub) use ($norm) {
                      $sub->whereNull('barangay')->orWhere('barangay', '')
                          ->whereRaw("LOWER(address) LIKE ?", ['%' . strtolower($norm) . '%']);
                  });
            });
        }

        $residents = $query->get();
        $totalPopulation = $residents->count();

        $male = 0;
        $female = 0;
        $other = 0;
        $seniors = 0;
        $minors = 0;
        $voters = 0;
        $now = (int)date('Y');
        $purokCounts = [];

        foreach ($residents as $r) {
            $g = strtolower(trim((string)$r->gender));
            if ($g === 'male' || $g === 'm') $male++;
            elseif ($g === 'female' || $g === 'f') $female++;
            else $other++;

            $age = 25;
            if (!empty($r->date_of_birth)) {
                $birthYear = (int)date('Y', strtotime($r->date_of_birth));
                $age = max(0, $now - $birthYear);
            }
            if ($age >= 60) $seniors++;
            if ($age < 18) $minors++;
            if ($age >= 18) $voters++;

            $p = trim(str_ireplace('purok', '', (string)($r->purok ?: '1')));
            $pName = "Purok " . ($p ?: '1');
            $purokCounts[$pName] = ($purokCounts[$pName] ?? 0) + 1;
        }

        $purokDist = [];
        for ($i = 1; $i <= 6; $i++) {
            $pName = "Purok {$i}";
            $purokDist[] = [
                'purok' => $pName,
                'count' => $purokCounts[$pName] ?? 0,
            ];
        }

        // Verified accounts are only residents who have claimed their account and been approved
        $verifiedResidentsCount = $residents->filter(function ($r) {
            return ($r->verification_status === 'Verified') &&
                (!empty($r->linked_user_id) || !empty($r->claimed_at) || (!empty($r->email) && str_contains($r->email, '@')));
        })->count();

        $pendingResidentsCount = $residents->filter(function ($r) {
            return in_array($r->verification_status, ['Pending_Review', 'Pending']) ||
                (!empty($r->claimed_at) && $r->verification_status !== 'Verified');
        })->count();

        $adoptionRate = $totalPopulation > 0 ? min(100, round(($verifiedResidentsCount / max(1, $totalPopulation)) * 100)) : 0;

        return response()->json([
            'success' => true,
            'barangay' => $barangay ?: 'Pianing',
            'total_population' => $totalPopulation,
            'online_registered' => $verifiedResidentsCount,
            'verified_accounts' => $verifiedResidentsCount,
            'pending_verifications' => $pendingResidentsCount,
            'unclaimed_count' => max(0, $totalPopulation - $verifiedResidentsCount - $pendingResidentsCount),
            'adoption_rate' => $adoptionRate,
            'registered_voters' => $voters,
            'senior_citizens' => $seniors,
            'minors_children' => $minors,
            'gender' => [
                'male' => $male,
                'female' => $female,
                'other' => $other,
            ],
            'purok_distribution' => $purokDist,
        ]);
    }

    public static function maskName(string $name): string
    {
        $words = preg_split('/\s+/', trim($name));
        $masked = [];
        foreach ($words as $w) {
            $len = mb_strlen($w);
            if ($len <= 2) {
                $masked[] = mb_substr($w, 0, 1) . '*';
            } else {
                $masked[] = mb_substr($w, 0, 1) . str_repeat('*', min(6, $len - 1));
            }
        }
        return implode(' ', $masked);
    }

    public static function maskPhone(string $phone): string
    {
        $clean = preg_replace('/[^0-9]/', '', $phone);
        if (str_starts_with($clean, '63') && strlen($clean) === 12) {
            $clean = '0' . substr($clean, 2);
        }
        if (strlen($clean) >= 10) {
            $prefix = substr($clean, 0, 4);
            $suffix = substr($clean, -3);
            return "{$prefix} **** {$suffix}";
        }
        return '09** **** ***';
    }

    public static function maskEmail(string $email): string
    {
        $parts = explode('@', trim($email));
        if (count($parts) !== 2) return '******@gmail.com';
        $user = $parts[0];
        $domain = $parts[1];
        $first = mb_substr($user, 0, 1);
        $userMasked = $first . str_repeat('*', max(3, mb_strlen($user) - 1));
        return "{$userMasked}@{$domain}";
    }

    public function publicSearch(Request $request)
    {
        $query = trim((string)$request->input('query', ''));
        $barangay = trim((string)$request->input('barangay', ''));

        if (mb_strlen($query) < 2) {
            return response()->json([
                'success' => true,
                'results' => [],
                'message' => 'Please enter at least 2 characters to search'
            ]);
        }

        $base = Resident::query();

        // Unclaimed census citizens can be searched and claimed.
        // Once an account is claimed or in pending review / verified, it is excluded from public search engine results:
        $base->whereNull('claimed_at')
             ->whereNull('linked_user_id')
             ->where(function ($q) {
                 $q->whereNull('verification_status')
                   ->orWhere('verification_status', 'Unverified')
                   ->orWhereNotIn('verification_status', ['Verified', 'Pending_Review', 'Pending']);
             });

        // Also exclude any records whose email is already an active user in the system
        $existingEmails = User::whereNotNull('email')->where('email', '!=', '')->pluck('email')->map(fn($e) => strtolower(trim($e)))->filter()->toArray();
        if (!empty($existingEmails)) {
            $base->where(function ($q) use ($existingEmails) {
                $q->whereNull('email')
                  ->orWhere('email', '')
                  ->orWhereNotIn(DB::raw('LOWER(email)'), $existingEmails);
            });
        }

        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all') && !str_contains(strtolower($barangay), 'city-wide')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $base->whereRaw("LOWER(barangay) = ?", [strtolower($norm)]);
        }

        // Clean digits for potential phone query
        $digits = preg_replace('/[^0-9]/', '', $query);

        $base->where(function ($q) use ($query, $digits) {
            $lowerQ = strtolower($query);
            $q->whereRaw("LOWER(first_name) LIKE ?", ['%' . $lowerQ . '%'])
              ->orWhereRaw("LOWER(last_name) LIKE ?", ['%' . $lowerQ . '%'])
              ->orWhereRaw("LOWER(middle_name) LIKE ?", ['%' . $lowerQ . '%'])
              ->orWhereRaw("LOWER(family_name) LIKE ?", ['%' . $lowerQ . '%'])
              ->orWhereRaw("LOWER(CONCAT(first_name, ' ', last_name)) LIKE ?", ['%' . $lowerQ . '%'])
              ->orWhereRaw("LOWER(CONCAT(last_name, ' ', first_name)) LIKE ?", ['%' . $lowerQ . '%'])
              ->orWhereRaw("LOWER(CONCAT(first_name, ' ', middle_name, ' ', last_name)) LIKE ?", ['%' . $lowerQ . '%']);

            $words = array_filter(explode(' ', $lowerQ));
            if (count($words) > 1) {
                $q->orWhere(function ($sub) use ($words) {
                    foreach ($words as $w) {
                        $sub->where(function ($wQ) use ($w) {
                            $wQ->whereRaw("LOWER(first_name) LIKE ?", ['%' . $w . '%'])
                               ->orWhereRaw("LOWER(last_name) LIKE ?", ['%' . $w . '%'])
                               ->orWhereRaw("LOWER(middle_name) LIKE ?", ['%' . $w . '%'])
                               ->orWhereRaw("LOWER(family_name) LIKE ?", ['%' . $w . '%']);
                        });
                    }
                });
            }

            if (!empty($digits) && strlen($digits) >= 3) {
                $q->orWhereRaw("REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+63', '0') LIKE ?", ['%' . $digits . '%']);
            }
        });

        $matches = $base->orderBy('last_name')->orderBy('first_name')->limit(12)->get();

        $results = $matches->map(function ($r) {
            $fullName = trim("{$r->first_name} {$r->middle_name} {$r->last_name}");
            $isClaimed = !empty($r->claimed_at);
            $isPending = in_array($r->verification_status, ['Pending_Review', 'Pending']);
            $isVerified = ($r->verification_status === 'Verified') && (!empty($r->linked_user_id) || !empty($r->claimed_at) || !empty($r->email));
            $canClaim = !$isClaimed && empty($r->linked_user_id) && $r->verification_status !== 'Verified' && $r->verification_status !== 'Pending_Review';

            return [
                'id' => $r->id,
                'masked_name' => self::maskName($fullName),
                'masked_phone' => !empty($r->phone) ? self::maskPhone($r->phone) : 'No phone recorded',
                'masked_email' => !empty($r->email) ? self::maskEmail($r->email) : null,
                'barangay' => $r->barangay ?: 'Pianing',
                'purok' => $r->purok ? "Purok " . preg_replace('/purok\s*/i', '', $r->purok) : 'Purok 1',
                'has_email' => !empty($r->email),
                'has_phone' => !empty($r->phone),
                'has_account' => (bool)$r->linked_user_id,
                'is_claimed' => $isClaimed,
                'is_pending' => $isPending,
                'is_verified' => $isVerified,
                'can_claim' => $canClaim,
                'verification_status' => $r->verification_status ?: 'Unverified',
            ];
        });

        return response()->json([
            'success' => true,
            'count' => $results->count(),
            'results' => $results,
        ]);
    }

    public function claimCredentials(Request $request)
    {
        $residentId = $request->input('resident_id');
        $confirmPhone = preg_replace('/[^0-9]/', '', (string)$request->input('confirm_phone', ''));
        $inputEmail = strtolower(trim((string)$request->input('email', '')));

        if (empty($residentId)) {
            return response()->json(['success' => false, 'error' => 'Resident ID is required'], 400);
        }
        if (empty($confirmPhone)) {
            return response()->json(['success' => false, 'error' => 'Phone number confirmation is required'], 400);
        }

        $resident = Resident::find($residentId);
        if (!$resident) {
            return response()->json(['success' => false, 'error' => 'Resident record not found'], 404);
        }

        // Check if already claimed
        if (!empty($resident->claimed_at) || $resident->verification_status === 'Pending_Review' || $resident->verification_status === 'Verified') {
            return response()->json([
                'success' => false,
                'error' => 'This census record has already been claimed and is pending Barangay Admin approval.'
            ], 422);
        }

        $resPhone = preg_replace('/[^0-9]/', '', (string)$resident->phone);
        if (str_starts_with($confirmPhone, '63') && strlen($confirmPhone) === 12) {
            $confirmPhone = '0' . substr($confirmPhone, 2);
        }
        if (str_starts_with($resPhone, '63') && strlen($resPhone) === 12) {
            $resPhone = '0' . substr($resPhone, 2);
        }

        // Compare phones: if resident has phone recorded, it must match
        if (!empty($resPhone) && $confirmPhone !== $resPhone) {
            return response()->json([
                'success' => false,
                'error' => 'The mobile phone number entered does not match the official census record. Please enter the exact phone number registered during census profiling.'
            ], 422);
        }

        // Check email
        $targetEmail = strtolower(trim((string)$resident->email));
        if (empty($targetEmail)) {
            if (!empty($inputEmail) && filter_var($inputEmail, FILTER_VALIDATE_EMAIL)) {
                $targetEmail = $inputEmail;
                $resident->email = $targetEmail;
            } else {
                return response()->json([
                    'success' => false,
                    'requires_email' => true,
                    'error' => 'No email address is linked to this census record. Please enter your Gmail address to receive your login credentials.'
                ], 422);
            }
        }

        if (empty($resident->phone) && !empty($confirmPhone)) {
            $resident->phone = $confirmPhone;
        }

        // Generate default password and stage it (DO NOT SEND AUTOMATICALLY YET)
        $defaultPassword = 'Brgy@' . date('Y') . '!' . mt_rand(100, 999);

        try {
            DB::beginTransaction();

            $user = User::whereRaw('LOWER(email) = ?', [$targetEmail])->first();
            $userFields = [
                'name' => trim("{$resident->first_name} {$resident->last_name}"),
                'email' => $targetEmail,
                'password_hash' => Hash::make($defaultPassword),
                'role' => 'resident',
                'status' => 'Pending',                   // Pending approval!
                'verification_status' => 'Pending_Review',  // Enters pending approval queue!
                'civil_status' => $resident->civil_status ?: 'Single',
                'phone' => $resident->phone ?: $confirmPhone,
                'address' => $resident->address,
                'barangay' => $resident->barangay ?: 'Pianing',
                'city' => $resident->city ?: 'Butuan City',
                'province' => $resident->province ?: 'Agusan del Norte',
                'zip_code' => $resident->zip_code ?: '8600',
                'staged_password' => $defaultPassword,   // Staged until Admin approves!
            ];

            if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'purok')) {
                $userFields['purok'] = $resident->purok ?: '1';
            }
            if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'staged_password')) {
                $userFields['staged_password'] = $defaultPassword;
            } else {
                unset($userFields['staged_password']);
            }

            if (!$user) {
                $user = User::create($userFields);
            } else {
                $user->password_hash = Hash::make($defaultPassword);
                $user->status = 'Pending';
                $user->verification_status = 'Pending_Review';
                if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'staged_password')) {
                    $user->staged_password = $defaultPassword;
                }
                if (!empty($resident->phone)) $user->phone = $resident->phone;
                $user->save();
            }

            // Update resident record into Pending_Review queue
            $resident->linked_user_id = $user->id;
            $resident->claimed_at = now();
            $resident->submitted_at = now();
            $resident->verification_status = 'Pending_Review'; // Place into pending approval queue!
            if (\Illuminate\Support\Facades\Schema::hasColumn('residents', 'staged_password')) {
                $resident->staged_password = $defaultPassword;
            }
            $resident->save();

            ActivityLog::create([
                'user_name' => trim("{$resident->first_name} {$resident->last_name}"),
                'user_role' => 'resident',
                'action' => "Submitted census credential claim for {$targetEmail} (Pending Admin Approval)",
            ]);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'error' => 'Failed to submit credential claim: ' . $e->getMessage()
            ], 500);
        }

        // NOTE: Credentials (email & password) are NOT sent yet.
        // They will be sent upon Admin Approval in ResidentController::approve.

        return response()->json([
            'success' => true,
            'pending_approval' => true,
            'message' => 'Your claim request has been submitted to the Barangay Administration! Your account is now Pending for Approval. Once approved by the administrator, your official login credentials will be delivered to your email and phone.',
            'masked_email' => self::maskEmail($targetEmail),
            'masked_phone' => self::maskPhone($confirmPhone),
            'resident_name' => trim("{$resident->first_name} {$resident->last_name}"),
            'barangay' => $resident->barangay ?: 'Pianing'
        ]);
    }

    /**
     * Parse Excel Name into First, Middle, and Last Name components
     */
    public static function parseExcelName($rawName)
    {
        if (empty($rawName)) {
            return ['first_name' => 'Resident', 'middle_name' => '', 'last_name' => ''];
        }
        $clean = trim(preg_replace('/^[*•#\-\s]+/', '', (string)$rawName));
        $clean = trim(preg_replace('/\[Blank\]/i', '', $clean));
        if (empty($clean)) {
            return ['first_name' => 'Resident', 'middle_name' => '', 'last_name' => ''];
        }

        if (str_contains($clean, ',')) {
            $parts = array_map('trim', explode(',', $clean, 2));
            $lastName = $parts[0] ?? '';
            $remainder = $parts[1] ?? '';
            $words = preg_split('/\s+/', $remainder, -1, PREG_SPLIT_NO_EMPTY);
            if (count($words) <= 1) {
                return [
                    'first_name' => $words[0] ?? $clean,
                    'middle_name' => '',
                    'last_name' => $lastName ?: $clean,
                ];
            }
            $middleName = array_pop($words);
            $firstName = implode(' ', $words);
            return [
                'first_name' => $firstName ?: $middleName,
                'middle_name' => $firstName ? $middleName : '',
                'last_name' => $lastName,
            ];
        } else {
            $words = preg_split('/\s+/', $clean, -1, PREG_SPLIT_NO_EMPTY);
            if (count($words) === 1) {
                return ['first_name' => $words[0], 'middle_name' => '', 'last_name' => ''];
            }
            if (count($words) === 2) {
                return ['first_name' => $words[0], 'middle_name' => '', 'last_name' => $words[1]];
            }
            $lastName = array_pop($words);
            $middleName = array_pop($words);
            $firstName = implode(' ', $words);
            return [
                'first_name' => $firstName,
                'middle_name' => $middleName,
                'last_name' => $lastName,
            ];
        }
    }

    /**
     * Parse Excel Date (serial number, date string, or calculate from fallback age)
     */
    public static function parseExcelDate($val, $fallbackAge = null)
    {
        if (empty($val) || strtolower((string)$val) === '[blank]') {
            if (!empty($fallbackAge) && is_numeric($fallbackAge)) {
                $calcYear = (int)date('Y') - (int)$fallbackAge;
                return "{$calcYear}-06-15";
            }
            return null;
        }
        if (is_numeric($val) && (float)$val > 1000) {
            $serial = (float)$val;
            $utcDays = floor($serial - 25569);
            $timestamp = $utcDays * 86400;
            return gmdate('Y-m-d', $timestamp);
        }
        if (is_string($val)) {
            $trimmed = trim($val);
            $parts = preg_split('/[-\/]/', $trimmed);
            if (count($parts) === 3) {
                $m = (int)$parts[0];
                $d = (int)$parts[1];
                $y = (int)$parts[2];
                if ($y < 100) {
                    $y += ($y > 30 ? 1900 : 2000);
                }
                if ($m >= 1 && $m <= 12 && $d >= 1 && $d <= 31) {
                    return sprintf('%04d-%02d-%02d', $y, $m, $d);
                }
            }
            $time = strtotime($trimmed);
            if ($time !== false && $time > 0) {
                return date('Y-m-d', $time);
            }
        }
        if (!empty($fallbackAge) && is_numeric($fallbackAge)) {
            $calcYear = (int)date('Y') - (int)$fallbackAge;
            return "{$calcYear}-06-15";
        }
        return null;
    }

    /**
     * Import Census Records from Excel with Dynamic Table Column Addition & Auto Account Provisioning
     */
    public function importRecords(Request $request)
    {
        $records = $request->input('records', []);
        $rawColumns = $request->input('new_columns', []);
        $targetBarangay = $request->input('barangay') ?: 'Pianing';
        $autoCreateAccounts = $request->input('auto_create_accounts', true);

        if (empty($records) || !is_array($records)) {
            return response()->json([
                'success' => false,
                'error' => 'No census records provided for import.'
            ], 400);
        }

        // 1. Fetch current database columns of `residents`
        $existingCols = [];
        try {
            $colRows = DB::select("SHOW COLUMNS FROM residents");
            foreach ($colRows as $col) {
                $existingCols[] = strtolower($col->Field);
            }
        } catch (\Throwable $e) {
            // fallback if show columns fails
        }

        // Ensure extra_fields column exists
        if (!in_array('extra_fields', $existingCols)) {
            try {
                DB::statement("ALTER TABLE `residents` ADD COLUMN `extra_fields` LONGTEXT NULL");
                $existingCols[] = 'extra_fields';
            } catch (\Throwable $e) {}
        }

        // 2. Dynamic column addition for any non-standard variables in Excel
        $dynamicallyAdded = [];
        $ignoredKeys = [
            'id', 'created_at', 'updated_at', 'household', 'household_number', 'household_#',
            'line_#', 'line_number', 'full_name', 'name', 'b_date', 'b_date', 'birthdate',
            'sex', 'gender', 'age', 'purok', 'barangay', 'phone', 'email', 'address',
            'employment_status', 'civil_status', 'is_head_of_household', 'relationship_to_head'
        ];

        // Gather all unique keys from records and new_columns
        $allKeys = array_values(array_unique(array_merge($rawColumns, ...array_map('array_keys', array_slice($records, 0, 50)))));

        foreach ($allKeys as $rawKey) {
            $safeKey = strtolower(trim(preg_replace('/[^a-zA-Z0-9_]/', '_', $rawKey), '_'));
            $safeKey = preg_replace('/_+/', '_', $safeKey);

            // Aliases mapping
            if (in_array($safeKey, ['hpn'])) $safeKey = 'hpn';
            elseif (in_array($safeKey, ['dm'])) $safeKey = 'dm';
            elseif (in_array($safeKey, ['fp_method', 'fpmethod', 'fp'])) $safeKey = 'fp_method';
            elseif (in_array($safeKey, ['phic_no', 'philhealth_no', 'philhealth', 'phic'])) $safeKey = 'phic_no';
            elseif (in_array($safeKey, ['nhts'])) $safeKey = 'nhts';
            elseif (in_array($safeKey, ['ips', 'ip'])) $safeKey = 'ips';
            elseif (str_contains($safeKey, 'remark')) $safeKey = 'remarks';
            elseif (str_contains($safeKey, 'note')) $safeKey = 'notes';

            if (empty($safeKey) || in_array($safeKey, $ignoredKeys)) {
                continue;
            }

            if (!in_array($safeKey, $existingCols)) {
                try {
                    $colType = in_array($safeKey, ['remarks', 'notes', 'header_notes', 'marginal_notes']) ? 'TEXT' : 'VARCHAR(255)';
                    DB::statement("ALTER TABLE `residents` ADD COLUMN `{$safeKey}` {$colType} NULL");
                    $existingCols[] = $safeKey;
                    $dynamicallyAdded[] = $safeKey;
                } catch (\Throwable $e) {
                    // Column might already exist or concurrent alter
                }
            }
        }

        // 3. Process and persist records in transactions
        $importedCount = 0;
        $updatedCount = 0;
        $accountsCreated = 0;
        $defaultPassword = 'Brgy@' . date('Y') . '!';

        DB::beginTransaction();
        try {
            foreach ($records as $row) {
                // Determine Raw Name
                $rawName = $row['Full Name'] ?? $row['Name'] ?? $row['name'] ?? $row['full_name'] ?? '';
                $nameParts = self::parseExcelName($rawName);
                $firstName = $nameParts['first_name'];
                $middleName = $nameParts['middle_name'];
                $lastName = $nameParts['last_name'];

                if (empty($firstName) || strtolower($firstName) === 'resident' && empty($lastName)) {
                    continue; // Skip blank or invalid row
                }

                // Purok determination
                $rawPurok = $row['purok'] ?? $row['Purok'] ?? $row['sheet'] ?? '1';
                $cleanPurok = trim(preg_replace('/[^0-9]/', '', (string)$rawPurok)) ?: '1';

                // Age & DOB determination
                $rawAge = $row['Age'] ?? $row['age'] ?? null;
                $cleanAge = null;
                if (!empty($rawAge) && $rawAge !== '[Blank]') {
                    $cleanAge = is_numeric($rawAge) ? (int)$rawAge : (int)preg_replace('/[^0-9]/', '', (string)$rawAge);
                }
                $rawDob = $row['B-Date'] ?? $row['B-date'] ?? $row['b_date'] ?? $row['birthdate'] ?? $row['Date of Birth'] ?? null;
                $dob = self::parseExcelDate($rawDob, $cleanAge);

                // Gender determination
                $rawSex = strtoupper(trim((string)($row['Sex'] ?? $row['Gender'] ?? $row['sex'] ?? '')));
                $gender = (str_starts_with($rawSex, 'F') || $rawSex === 'FEMALE') ? 'Female' : 'Male';

                // Household & Family determination
                $rawHh = $row['Household #'] ?? $row['Household Number'] ?? $row['household_number'] ?? "Household # 1";
                $hhDigits = preg_replace('/[^0-9]/', '', (string)$rawHh) ?: '1';
                $hhNumber = "P{$cleanPurok}-H{$hhDigits}";
                $familyName = !empty($lastName) ? $lastName : ($row['family_name'] ?? 'Resident');

                // Line Number & Head of Household
                $rawLine = $row['Line #'] ?? $row['Line Number'] ?? $row['line_number'] ?? null;
                $lineNum = is_numeric($rawLine) ? (int)$rawLine : (preg_match('/1\b/', (string)$rawLine) ? 1 : 2);
                $isHead = ($lineNum === 1);
                $relToHead = $isHead ? 'Head' : ($row['relationship_to_head'] ?? 'Member');

                // Employment status
                $isSenior = ($cleanAge && $cleanAge >= 60);
                $isChild = ($cleanAge && $cleanAge < 18);
                $empStatus = $row['employment_status'] ?? ($isSenior ? 'Retired' : ($isChild ? 'Student' : 'Employed'));

                // Phone & Email
                $phone = $row['phone'] ?? $row['Phone'] ?? $row['Contact'] ?? '';
                $email = $row['email'] ?? $row['Email'] ?? '';

                // Dynamic Health and Civic variables
                $hpnVal = $row['HPN'] ?? $row['hpn'] ?? null;
                $dmVal = $row['DM'] ?? $row['dm'] ?? null;
                $fpVal = $row['FP Method'] ?? $row['fp_method'] ?? null;
                $phicVal = $row['PHIC NO'] ?? $row['PhilHealth No.'] ?? $row['phic_no'] ?? null;
                $nhtsVal = $row['NHTS'] ?? $row['nhts'] ?? null;
                $ipsVal = $row['IPs'] ?? $row['IPS'] ?? $row['ips'] ?? null;
                $remarksVal = $row['Remarks / Side Notes'] ?? $row['Remarks'] ?? $row['remarks'] ?? null;
                $notesVal = $row['Notes / Marginal Notes'] ?? $row['Notes'] ?? $row['notes'] ?? $row['Top-Level Metadata / Header Notes'] ?? null;

                // Clean '[Blank]' placeholders
                $cleanVal = function($v) {
                    if (is_null($v)) return null;
                    $s = trim((string)$v);
                    return ($s === '[Blank]' || $s === '') ? null : $s;
                };

                $residentData = [
                    'first_name' => $firstName,
                    'middle_name' => $middleName,
                    'last_name' => $lastName,
                    'date_of_birth' => $dob,
                    'gender' => $gender,
                    'civil_status' => $row['civil_status'] ?? 'Single',
                    'address' => "Purok {$cleanPurok}, Barangay {$targetBarangay}, Butuan City",
                    'purok' => $cleanPurok,
                    'barangay' => $targetBarangay,
                    'city' => 'Butuan City',
                    'province' => 'Agusan del Norte',
                    'zip_code' => '8600',
                    'household_number' => $hhNumber,
                    'family_name' => $familyName,
                    'is_head_of_household' => $isHead ? 1 : 0,
                    'relationship_to_head' => $relToHead,
                    'employment_status' => $empStatus,
                    'is_census_only' => 0, // Provisioned resident
                    'verification_status' => 'Unverified',
                ];

                if (!empty($phone)) $residentData['phone'] = $phone;
                if (!empty($email)) $residentData['email'] = $email;

                // Attach dynamically identified fields
                if (in_array('hpn', $existingCols)) $residentData['hpn'] = $cleanVal($hpnVal);
                if (in_array('dm', $existingCols)) $residentData['dm'] = $cleanVal($dmVal);
                if (in_array('fp_method', $existingCols)) $residentData['fp_method'] = $cleanVal($fpVal);
                if (in_array('phic_no', $existingCols)) $residentData['phic_no'] = $cleanVal($phicVal);
                if (in_array('nhts', $existingCols)) $residentData['nhts'] = $cleanVal($nhtsVal);
                if (in_array('ips', $existingCols)) $residentData['ips'] = $cleanVal($ipsVal);
                if (in_array('remarks', $existingCols)) $residentData['remarks'] = $cleanVal($remarksVal);
                if (in_array('notes', $existingCols)) $residentData['notes'] = $cleanVal($notesVal);

                // Any other custom columns passed in row
                foreach ($dynamicallyAdded as $dynCol) {
                    if (isset($row[$dynCol]) && !isset($residentData[$dynCol])) {
                        $residentData[$dynCol] = $cleanVal($row[$dynCol]);
                    }
                }

                // Preserve entire raw row in extra_fields
                if (in_array('extra_fields', $existingCols)) {
                    $residentData['extra_fields'] = json_encode($row);
                }

                // Search for existing resident record to avoid duplicates
                $resident = Resident::whereRaw("LOWER(first_name) = ? AND LOWER(last_name) = ? AND purok = ? AND LOWER(barangay) = ?", [
                    strtolower($firstName),
                    strtolower($lastName),
                    $cleanPurok,
                    strtolower($targetBarangay)
                ])->first();

                if (!$resident) {
                    $resident = Resident::create($residentData);
                    $importedCount++;
                } else {
                    $resident->update($residentData);
                    $updatedCount++;
                }

                // 4. Automatic User Account Creation
                if ($autoCreateAccounts) {
                    $baseSlug = strtolower(preg_replace('/[^a-z0-9]/', '', $firstName) . '.' . preg_replace('/[^a-z0-9]/', '', $lastName));
                    if (empty($baseSlug) || $baseSlug === '.') {
                        $baseSlug = 'resident.' . $resident->id;
                    }
                    $genEmail = "{$baseSlug}.p{$cleanPurok}@resident.barangay.ph";
                    $targetEmail = !empty($resident->email) ? strtolower(trim($resident->email)) : $genEmail;

                    $user = User::whereRaw("LOWER(email) = ?", [$targetEmail])->first();
                    if (!$user) {
                        $userFields = [
                            'name' => trim("{$resident->first_name} {$resident->last_name}"),
                            'email' => $targetEmail,
                            'password_hash' => Hash::make($defaultPassword),
                            'role' => 'resident',
                            'status' => 'Active',
                            'verification_status' => 'Unverified',
                            'civil_status' => $resident->civil_status ?: 'Single',
                            'phone' => $resident->phone ?: '',
                            'address' => $resident->address,
                            'barangay' => $resident->barangay ?: $targetBarangay,
                            'city' => 'Butuan City',
                            'province' => 'Agusan del Norte',
                            'zip_code' => '8600',
                            'staged_password' => $defaultPassword,
                        ];

                        if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'purok')) {
                            $userFields['purok'] = $cleanPurok;
                        }
                        if (!\Illuminate\Support\Facades\Schema::hasColumn('users', 'staged_password')) {
                            unset($userFields['staged_password']);
                        }

                        $user = User::create($userFields);
                        $accountsCreated++;
                    }

                    if ($user && empty($resident->linked_user_id)) {
                        $resident->linked_user_id = $user->id;
                        if (empty($resident->email)) {
                            $resident->email = $targetEmail;
                        }
                        $resident->save();
                    }
                }
            }

            // Log activity
            try {
                ActivityLog::create([
                    'user_name' => 'Barangay Administrator',
                    'user_role' => 'admin',
                    'action' => "Excel Census Import: Imported {$importedCount} new, updated {$updatedCount} residents, provisioned {$accountsCreated} citizen accounts for Barangay {$targetBarangay}.",
                ]);
            } catch (\Throwable $e) {}

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'error' => 'Census import transaction failed: ' . $e->getMessage()
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => "Successfully processed {$importedCount} new and {$updatedCount} updated census residents! Provisioned {$accountsCreated} citizen portal accounts.",
            'imported_count' => $importedCount,
            'updated_count' => $updatedCount,
            'accounts_created' => $accountsCreated,
            'added_columns' => $dynamicallyAdded,
            'barangay' => $targetBarangay,
        ]);
    }
}
