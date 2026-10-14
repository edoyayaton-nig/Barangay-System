<?php

namespace App\Http\Controllers;

use App\Models\Resident;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CensusController extends Controller
{
    public function stats(Request $request)
    {
        $barangay = $request->input('barangay');
        $purok = $request->input('purok');

        $query = Resident::whereIn(DB::raw("LOWER(COALESCE(verification_status, ''))"), ['verified', 'active']);

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

        if (!empty($purok) && !str_contains(strtolower($purok), 'all')) {
            $cleanP = preg_replace('/purok\s*/i', '', (string)$purok);
            $query->where(function ($q) use ($cleanP) {
                $q->where('purok', $cleanP)
                  ->orWhere('purok', "Purok {$cleanP}")
                  ->orWhereRaw("LOWER(address) LIKE ?", ["%purok {$cleanP}%"]);
            });
        }

        $residents = $query->get();

        $totalPopulation = $residents->count();
        $totalHouseholds = $residents->pluck('household_number')->filter()->unique()->count();
        if ($totalHouseholds === 0 && $totalPopulation > 0) {
            $totalHouseholds = (int)ceil($totalPopulation / 3);
        }
        $totalFamilies = $residents->pluck('family_name')->filter()->unique()->count() ?: $totalHouseholds;

        $now = date('Y');
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

        $purokMap = [];
        for ($i = 1; $i <= 6; $i++) {
            $purokMap[(string)$i] = [
                'purok' => "Purok {$i}",
                'population' => 0,
                'households' => 0,
                'seniors' => 0,
                'children' => 0,
                'employed' => 0,
                'unemployed' => 0,
            ];
        }

        foreach ($residents as $r) {
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
            'total_households' => $totalHouseholds,
            'total_families' => $totalFamilies,
            'total_population' => $totalPopulation,
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

        $query = Resident::whereIn(DB::raw("LOWER(COALESCE(verification_status, ''))"), ['verified', 'active']);

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
            $cleanP = trim(str_ireplace('purok', '', (string)($r->purok ?: '1')));
            $hhNum = $r->household_number ?: "HH-P{$cleanP}-" . str_pad($r->id, 3, '0', STR_PAD_LEFT);
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
        $query = Resident::whereIn(DB::raw("LOWER(COALESCE(verification_status, ''))"), ['verified', 'active']);

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

        $onlineRegistered = $totalPopulation;
        $adoptionRate = $totalPopulation > 0 ? min(100, round(($onlineRegistered / max(1, $totalPopulation)) * 100)) : 85;

        return response()->json([
            'success' => true,
            'barangay' => $barangay ?: 'Pianing',
            'total_population' => $totalPopulation,
            'online_registered' => $onlineRegistered,
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
}
