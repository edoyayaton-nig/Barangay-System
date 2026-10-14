<?php

namespace App\Http\Controllers;

use App\Models\Immunization;
use App\Models\MaternalRecord;
use App\Services\SchedulingService;
use Illuminate\Http\Request;

class SchedulingController extends Controller
{
    public function getVaccines()
    {
        return response()->json(SchedulingService::VACCINE_SCHEDULE);
    }

    public function nextDose(Request $request)
    {
        $vaccine = (string)$request->input('vaccine_name', 'Pentavalent');
        $dose = (int)$request->input('current_dose', 1);
        $date = (string)$request->input('date_administered', date('Y-m-d'));
        $birthDate = $request->input('birth_date');

        $result = SchedulingService::computeNextDose($vaccine, $dose, $date, $birthDate);
        return response()->json($result ?: ['error' => 'Unknown vaccine']);
    }

    public function fullVaccineSchedule(Request $request)
    {
        $birthDate = (string)$request->input('birth_date', date('Y-m-d'));
        return response()->json(SchedulingService::getFullVaccineSchedule($birthDate));
    }

    public function nextMaternalVisit(Request $request)
    {
        $lastVisit = (string)$request->input('last_visit_date', date('Y-m-d'));
        $weeks = (int)$request->input('gestational_weeks', 16);
        $risk = (string)$request->input('risk_level', 'Low');

        return response()->json(SchedulingService::computeNextMaternalVisit($lastVisit, $weeks, $risk));
    }

    public function fullPrenatalSchedule(Request $request)
    {
        $lmp = $request->input('lmp');
        $edd = $request->input('edd');
        return response()->json(SchedulingService::getFullPrenatalSchedule($lmp, $edd));
    }

    public function getOverdue()
    {
        $today = date('Y-m-d');
        $immunizations = Immunization::where('due_date', '<', $today)
            ->where('status', '!=', 'Completed')
            ->get();

        $maternal = MaternalRecord::where('next_visit', '<', $today)
            ->get();

        return response()->json([
            'overdue_immunizations' => $immunizations,
            'overdue_maternal' => $maternal,
        ]);
    }
}
