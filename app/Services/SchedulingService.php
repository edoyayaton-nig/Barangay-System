<?php

namespace App\Services;

class SchedulingService
{
    /**
     * Philippine DOH Expanded Program on Immunization (EPI) vaccine schedule.
     */
    public const VACCINE_SCHEDULE = [
        'BCG' => [
            ['dose' => 1, 'label' => 'At birth', 'offsetDays' => 0],
        ],
        'Hepatitis B' => [
            ['dose' => 1, 'label' => 'At birth', 'offsetDays' => 0],
            ['dose' => 2, 'label' => '6 weeks', 'offsetDays' => 42],
            ['dose' => 3, 'label' => '10 weeks', 'offsetDays' => 70],
            ['dose' => 4, 'label' => '14 weeks', 'offsetDays' => 98],
        ],
        'DPT' => [
            ['dose' => 1, 'label' => '6 weeks', 'offsetDays' => 42],
            ['dose' => 2, 'label' => '10 weeks', 'offsetDays' => 70],
            ['dose' => 3, 'label' => '14 weeks', 'offsetDays' => 98],
            ['dose' => 4, 'label' => 'DPT Booster (18 months)', 'offsetDays' => 548],
        ],
        'DPT Booster' => [
            ['dose' => 1, 'label' => '18 months', 'offsetDays' => 548],
        ],
        'OPV' => [
            ['dose' => 1, 'label' => '6 weeks', 'offsetDays' => 42],
            ['dose' => 2, 'label' => '10 weeks', 'offsetDays' => 70],
            ['dose' => 3, 'label' => '14 weeks', 'offsetDays' => 98],
        ],
        'Pentavalent' => [
            ['dose' => 1, 'label' => '6 weeks', 'offsetDays' => 42],
            ['dose' => 2, 'label' => '10 weeks', 'offsetDays' => 70],
            ['dose' => 3, 'label' => '14 weeks', 'offsetDays' => 98],
        ],
        'MMR' => [
            ['dose' => 1, 'label' => '9 months', 'offsetDays' => 274],
            ['dose' => 2, 'label' => '12 months', 'offsetDays' => 365],
        ],
        'Varicella' => [
            ['dose' => 1, 'label' => '12 months', 'offsetDays' => 365],
            ['dose' => 2, 'label' => '4-6 years', 'offsetDays' => 1461],
        ],
        'Pneumococcal (PCV)' => [
            ['dose' => 1, 'label' => '6 weeks', 'offsetDays' => 42],
            ['dose' => 2, 'label' => '10 weeks', 'offsetDays' => 70],
            ['dose' => 3, 'label' => '14 weeks', 'offsetDays' => 98],
        ],
        'Rotavirus' => [
            ['dose' => 1, 'label' => '6 weeks', 'offsetDays' => 42],
            ['dose' => 2, 'label' => '10 weeks', 'offsetDays' => 70],
            ['dose' => 3, 'label' => '14 weeks', 'offsetDays' => 98],
        ],
        'Influenza' => [
            ['dose' => 1, 'label' => '6 months', 'offsetDays' => 182],
            ['dose' => 2, 'label' => '7 months', 'offsetDays' => 210],
            ['dose' => 3, 'label' => 'Annual', 'offsetDays' => 547],
        ],
        'Typhoid' => [
            ['dose' => 1, 'label' => '2 years', 'offsetDays' => 730],
        ],
    ];

    public const MIN_INTERVAL_DAYS = 28;

    public static function addDays(string $dateStr, int $days): string
    {
        return date('Y-m-d', strtotime("{$dateStr} +{$days} days"));
    }

    public static function formatDate(?string $dateStr): string
    {
        if (empty($dateStr)) return '';
        return date('F j, Y', strtotime($dateStr));
    }

    /**
     * Compute the next dose schedule after a vaccine dose is marked as Completed.
     */
    public static function computeNextDose(string $vaccineName, int $currentDose, string $dateAdministered, ?string $birthDate = null): ?array
    {
        $vName = null;
        foreach (self::VACCINE_SCHEDULE as $k => $v) {
            if (strcasecmp($k, $vaccineName) === 0) {
                $vName = $k;
                break;
            }
        }

        if (!$vName) {
            return null;
        }

        $schedule = self::VACCINE_SCHEDULE[$vName];
        $nextDoseNum = $currentDose + 1;
        $nextDoseMeta = null;

        foreach ($schedule as $s) {
            if ($s['dose'] === $nextDoseNum) {
                $nextDoseMeta = $s;
                break;
            }
        }

        if (!$nextDoseMeta) {
            return [
                'vaccine' => $vName,
                'isComplete' => true,
                'message' => "All {$currentDose} doses for {$vName} are complete.",
                'nextDose' => null,
                'dueDate' => null,
            ];
        }

        $currentMeta = null;
        foreach ($schedule as $s) {
            if ($s['dose'] === $currentDose) {
                $currentMeta = $s;
                break;
            }
        }

        $minNextDate = self::addDays($dateAdministered, self::MIN_INTERVAL_DAYS);

        if ($birthDate) {
            $scheduleDueDate = self::addDays($birthDate, $nextDoseMeta['offsetDays']);
            $dueDate = (strtotime($scheduleDueDate) > strtotime($minNextDate)) ? $scheduleDueDate : $minNextDate;
        } else {
            $intervalDays = $currentMeta ? ($nextDoseMeta['offsetDays'] - $currentMeta['offsetDays']) : self::MIN_INTERVAL_DAYS;
            $intervalDays = max($intervalDays, self::MIN_INTERVAL_DAYS);
            $dueDate = self::addDays($dateAdministered, $intervalDays);
        }

        return [
            'vaccine' => $vName,
            'isComplete' => false,
            'nextDose' => $nextDoseNum,
            'label' => $nextDoseMeta['label'],
            'dueDate' => $dueDate,
            'dueDateFormatted' => self::formatDate($dueDate),
            'minIntervalDays' => self::MIN_INTERVAL_DAYS,
            'message' => "Next dose ({$nextDoseMeta['label']}) is scheduled for " . self::formatDate($dueDate) . '.',
        ];
    }

    /**
     * Compute the full childhood vaccination timeline from a birth date.
     */
    public static function getFullVaccineSchedule(string $birthDate): array
    {
        $timeline = [];
        foreach (self::VACCINE_SCHEDULE as $vName => $doses) {
            foreach ($doses as $d) {
                $dueDate = self::addDays($birthDate, $d['offsetDays']);
                $timeline[] = [
                    'vaccine' => $vName,
                    'dose' => $d['dose'],
                    'label' => $d['label'],
                    'dueDate' => $dueDate,
                    'dueDateFormatted' => self::formatDate($dueDate),
                    'offsetDays' => $d['offsetDays'],
                ];
            }
        }

        usort($timeline, fn($a, $b) => strcmp($a['dueDate'], $b['dueDate']));
        return $timeline;
    }

    /**
     * Compute next maternal care visit based on WHO 8-contact model.
     */
    public static function computeNextMaternalVisit(string $lastVisitDate, ?int $gestationalWeeks = null, ?string $riskLevel = 'Low'): array
    {
        $weeks = $gestationalWeeks ?? 12;

        if ($riskLevel === 'High') {
            $intervalDays = 14;
            $reason = 'High-risk pregnancy: bi-weekly follow-up required.';
        } elseif ($weeks < 28) {
            $intervalDays = 28;
            $reason = '1st & 2nd trimester: monthly routine prenatal visit.';
        } elseif ($weeks < 36) {
            $intervalDays = 14;
            $reason = '3rd trimester (28-36 weeks): bi-weekly visit for close monitoring.';
        } else {
            $intervalDays = 7;
            $reason = 'Term pregnancy (36+ weeks): weekly visit until delivery.';
        }

        $nextDate = self::addDays($lastVisitDate, $intervalDays);
        $nextWeeks = $weeks + (int)round($intervalDays / 7);

        return [
            'nextVisitDate' => $nextDate,
            'nextVisitDateFormatted' => self::formatDate($nextDate),
            'estimatedGestationalWeeks' => $nextWeeks,
            'intervalDays' => $intervalDays,
            'reason' => $reason,
            'riskLevel' => $riskLevel,
        ];
    }

    /**
     * Generate full prenatal care schedule from Last Menstrual Period (LMP) or Expected Due Date (EDD).
     */
    public static function getFullPrenatalSchedule(?string $lmp = null, ?string $edd = null): array
    {
        if (!$lmp && !$edd) {
            return [];
        }

        if (!$lmp && $edd) {
            $lmp = self::addDays($edd, -280);
        }

        $visits = [
            ['contact' => 1, 'weeks' => 12, 'label' => 'Contact 1 (First Trimester)', 'offsetDays' => 84],
            ['contact' => 2, 'weeks' => 20, 'label' => 'Contact 2 (Second Trimester)', 'offsetDays' => 140],
            ['contact' => 3, 'weeks' => 26, 'label' => 'Contact 3 (Second Trimester)', 'offsetDays' => 182],
            ['contact' => 4, 'weeks' => 30, 'label' => 'Contact 4 (Third Trimester)', 'offsetDays' => 210],
            ['contact' => 5, 'weeks' => 34, 'label' => 'Contact 5 (Third Trimester)', 'offsetDays' => 238],
            ['contact' => 6, 'weeks' => 36, 'label' => 'Contact 6 (Third Trimester)', 'offsetDays' => 252],
            ['contact' => 7, 'weeks' => 38, 'label' => 'Contact 7 (Near Term)', 'offsetDays' => 266],
            ['contact' => 8, 'weeks' => 40, 'label' => 'Contact 8 (Term / Delivery)', 'offsetDays' => 280],
        ];

        return array_map(function ($v) use ($lmp) {
            $dueDate = self::addDays($lmp, $v['offsetDays']);
            return [
                'contact' => $v['contact'],
                'gestationalWeeks' => $v['weeks'],
                'label' => $v['label'],
                'dueDate' => $dueDate,
                'dueDateFormatted' => self::formatDate($dueDate),
            ];
        }, $visits);
    }
}
