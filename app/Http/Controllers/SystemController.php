<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\BarangaySetting;
use App\Models\Broadcast;
use App\Models\ClinicSchedule;
use App\Models\ClinicalEncounter;
use App\Models\DocumentCategory;
use App\Models\DocumentRequest;
use App\Models\FaqKnowledge;
use App\Models\HealthAppointment;
use App\Models\Immunization;
use App\Models\Inventory;
use App\Models\MaternalRecord;
use App\Models\Message;
use App\Models\Resident;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\EmailService;
use App\Services\SmsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SystemController extends Controller
{
    public const ALL_86_BUTUAN_BARANGAYS = [
        'Pianing', 'Anticala', 'Agao Poblacion', 'Agusan Pequeño', 'Ambago', 'Amparo', 'Ampayon', 'Antongalon', 'Aupagan', 'Baan Km 3', 'Baan Riverside', 'Babag', 'Bading', 'Banza', 'Baobaoan', 'Basag', 'Bayanihan', 'Bilay', 'Bit-os', 'Bitan-agan', 'Bobon', 'Bonbon', 'Bugabus', 'Buhangin', 'Cabcabon', 'Camayahan', 'Dagohoy', 'Dankias', 'De Oro', 'Diego Silang', 'Doongan', 'Dumalagan', 'Golden Ribbon', 'Holy Redeemer', 'Humabon', 'Imadejas', 'Kinamlutan', 'Lapu-lapu', 'Lemon', 'Libertad', 'Limaha', 'Los Angeles', 'Lumbocan', 'Maguinda', 'Mahay', 'Mahogany', 'Maibu', 'Mandamo', 'Manila de Bugabus', 'Maon', 'Masao', 'Maug', 'New Society Village', 'Nong-nong', 'Obrero', 'Ong Yiu', 'Pagatpatan', 'Pangabugan', 'Pangaylan IP', 'Pinamanculan', 'Port Poyohon', 'Pigdaulan', 'Rajahnath', 'San Ignacio', 'San Mateo', 'San Vicente', 'Santa Cruz', 'Santo Niño', 'Silongan', 'Sumilihon', 'Tagabaca', 'Taguibo', 'Taligaman', 'Tandag', 'Tiniwisan', 'Tungao', 'Urduja', 'Villa Kananga', 'Bonifacio', 'Dulag', 'Florida', 'Guinabsan', 'New Manat', 'Riverside', 'Salvacion', 'Tuburan'
    ];

    public function statsAdmin(Request $request)
    {
        $barangay = $request->input('barangay');
        $docQuery = DocumentRequest::query();
        $resQuery = Resident::query();

        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all') && !str_contains(strtolower($barangay), 'city-wide')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $docQuery->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
            $resQuery->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
        }

        $pendingDocs = (clone $docQuery)->where('status', 'Pending')->count();
        $processedToday = (clone $docQuery)->where('status', 'Completed')->whereDate('processed_at', date('Y-m-d'))->count();
        $totalIssued = (clone $docQuery)->where('status', 'Completed')->count();
        $totalResidents = $resQuery->count();
        $activeRecords = $docQuery->count();

        return response()->json([
            'pendingDocs' => $pendingDocs,
            'processedToday' => $processedToday,
            'totalIssued' => $totalIssued,
            'totalResidents' => $totalResidents,
            'activeRecords' => $activeRecords,
        ]);
    }

    public function statsBhw(Request $request)
    {
        $barangay = $request->input('barangay');
        $immQuery = Immunization::query();
        $matQuery = MaternalRecord::query();

        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all') && !str_contains(strtolower($barangay), 'city-wide')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $immQuery->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
            $matQuery->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
        }

        $childrenMonitored = (clone $immQuery)->distinct('child_name')->count('child_name');
        $maternalRecords = $matQuery->count();
        $vaccinationsMonth = (clone $immQuery)->where('status', 'Completed')->count();
        $overdueImmunizations = (clone $immQuery)->where('status', 'Overdue')->count();

        return response()->json([
            'childrenMonitored' => $childrenMonitored,
            'maternalRecords' => $maternalRecords,
            'vaccinationsMonth' => $vaccinationsMonth,
            'overdueImmunizations' => $overdueImmunizations,
        ]);
    }

    public function getSettings(Request $request)
    {
        $rawBrgy = (string)$request->input('barangay', '');
        $cleanBrgy = trim(preg_replace('/^barangay\s+/i', '', $rawBrgy));

        if (!empty($cleanBrgy)) {
            $setting = BarangaySetting::whereRaw("LOWER(TRIM(REPLACE(barangay_name, 'Barangay ', ''))) = ?", [strtolower($cleanBrgy)])->first();
            if ($setting) return response()->json($setting);

            return response()->json([
                'barangay_name' => $cleanBrgy,
                'municipality' => 'Butuan City',
                'province' => 'Agusan del Norte',
                'emailjs_service_id' => '',
                'emailjs_template_id' => '',
                'emailjs_public_key' => '',
                'emailjs_private_key' => '',
                'sms_api_key' => '',
                'sms_sender_name' => '',
            ]);
        }

        $default = BarangaySetting::whereRaw("LOWER(TRIM(REPLACE(barangay_name, 'Barangay ', ''))) = 'pianing'")->first();
        if ($default) return response()->json($default);

        return response()->json([
            'barangay_name' => 'Pianing',
            'municipality' => 'Butuan City',
            'province' => 'Agusan del Norte',
            'emailjs_service_id' => env('VITE_EMAILJS_SERVICE_ID', 'service_6nk2ylj'),
            'emailjs_template_id' => env('VITE_EMAILJS_TEMPLATE_ID', 'template_tjcwzij'),
            'emailjs_public_key' => env('VITE_EMAILJS_PUBLIC_KEY', ''),
            'emailjs_private_key' => env('VITE_EMAILJS_PRIVATE_KEY', ''),
            'sms_api_key' => '',
            'sms_sender_name' => 'BrgySystem',
        ]);
    }

    public function getAllSettings()
    {
        return response()->json(BarangaySetting::orderBy('barangay_name')->get());
    }

    public function saveSettings(Request $request)
    {
        $name = trim((string)$request->input('barangay_name', ''));
        if (empty($name)) {
            return response()->json(['success' => false, 'message' => 'Barangay name is required.'], 400);
        }

        $clean = trim(preg_replace('/^barangay\s+/i', '', $name));
        $setting = BarangaySetting::whereRaw("LOWER(TRIM(REPLACE(barangay_name, 'Barangay ', ''))) = ?", [strtolower($clean)])->first();

        $data = [
            'barangay_name' => $clean,
            'municipality' => $request->input('municipality', 'Butuan City'),
            'province' => $request->input('province', 'Agusan del Norte'),
            'emailjs_service_id' => $request->input('emailjs_service_id', ''),
            'emailjs_template_id' => $request->input('emailjs_template_id', ''),
            'emailjs_public_key' => $request->input('emailjs_public_key', ''),
            'emailjs_private_key' => $request->input('emailjs_private_key', ''),
            'sms_api_key' => $request->input('sms_api_key', ''),
            'sms_sender_name' => $request->input('sms_sender_name', ''),
        ];

        if ($setting) {
            $setting->update($data);
        } else {
            $setting = BarangaySetting::create($data);
        }

        return response()->json(['success' => true, 'settings' => $setting]);
    }

    public function testEmail(Request $request)
    {
        $email = $request->input('email', 'admin@barangay.gov');
        $res = EmailService::sendEmail([
            'to' => $email,
            'subject' => 'Test Email Verification',
            'text' => 'This is a test notification from the Smart Barangay System.',
        ]);
        return response()->json($res);
    }

    public function testSms(Request $request)
    {
        $phone = $request->input('phone', '09171234567');
        $res = SmsService::sendLiveSms($phone, 'Test SMS notification from Smart Barangay System.');
        return response()->json($res);
    }

    public function getActivityLogs(Request $request)
    {
        $query = ActivityLog::query();
        if ($request->filled('barangay') && !str_contains(strtolower($request->input('barangay')), 'all')) {
            $query->whereRaw('LOWER(barangay) = ?', [strtolower($request->input('barangay'))]);
        }
        if ($request->filled('action_type') && !str_contains(strtolower($request->input('action_type')), 'all')) {
            $query->whereRaw('LOWER(action_type) = ?', [strtolower($request->input('action_type'))]);
        }
        if ($request->filled('role') && !str_contains(strtolower($request->input('role')), 'all')) {
            $query->whereRaw('LOWER(user_role) = ?', [strtolower($request->input('role'))]);
        }
        if ($request->filled('search')) {
            $s = '%' . strtolower($request->input('search')) . '%';
            $query->where(function($q) use ($s) {
                $q->whereRaw('LOWER(user_name) LIKE ?', [$s])
                  ->orWhereRaw('LOWER(action) LIKE ?', [$s])
                  ->orWhereRaw('LOWER(details) LIKE ?', [$s]);
            });
        }
        $logs = $query->orderBy('timestamp', 'desc')->limit(500)->get();
        return response()->json($logs);
    }

    public function createActivityLog(Request $request)
    {
        $log = ActivityLog::create([
            'user_name' => $request->input('user_name', 'System User'),
            'user_role' => $request->input('user_role', 'staff'),
            'action' => $request->input('action', 'Action performed'),
            'action_type' => $request->input('action_type', 'General'),
            'barangay' => $request->input('barangay', 'Pianing'),
            'details' => $request->input('details', null),
            'timestamp' => now(),
        ]);
        return response()->json(['success' => true, 'log' => $log], 201);
    }

    public function dbStatus()
    {
        try {
            DB::connection()->getPdo();
            $tables = DB::select('SHOW TABLES');
            return response()->json([
                'connected' => true,
                'status' => 'Online',
                'database' => env('DB_DATABASE', 'smart_db'),
                'tables' => array_map(fn($t) => array_values((array)$t)[0], $tables),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'connected' => false,
                'status' => 'Offline',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getMessages(Request $request)
    {
        $query = Message::query();
        $barangay = $request->input('barangay');
        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) {
            $norm = AuthController::normalizeBarangayName($barangay);
            $query->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
        }
        return response()->json($query->orderBy('timestamp', 'desc')->limit(50)->get());
    }

    public function createMessage(Request $request)
    {
        $msg = Message::create([
            'sender_name' => $request->input('sender_name', 'Staff'),
            'sender_role' => $request->input('sender_role', 'staff'),
            'sender_email' => $request->input('sender_email', ''),
            'recipient_name' => $request->input('recipient_name', ''),
            'recipient_role' => $request->input('recipient_role', 'all'),
            'recipient_email' => $request->input('recipient_email', ''),
            'barangay' => AuthController::normalizeBarangayName($request->input('barangay')),
            'message' => $request->input('message', ''),
            'timestamp' => now(),
        ]);
        return response()->json(['success' => true, 'message' => $msg], 201);
    }

    public function getNotifications(Request $request)
    {
        $email = $request->input('email', $request->input('user_email', ''));
        if (!empty($email)) {
            $query = UserNotification::query();
            $query->whereRaw('LOWER(recipient_email) = ?', [strtolower($email)]);
            return response()->json($query->orderBy('created_at', 'desc')->get());
        }

        // When no recipient email is specified, return system SMS dispatch history
        try {
            $smsList = DB::table('sms_notifications')->orderBy('sent_at', 'desc')->limit(100)->get();
            return response()->json($smsList);
        } catch (\Throwable $e) {
            return response()->json([]);
        }
    }

    public function markNotificationRead($id)
    {
        $notif = UserNotification::find($id);
        if ($notif) $notif->update(['is_read' => 1]);
        return response()->json(['success' => true]);
    }

    public function markAllNotificationsRead(Request $request)
    {
        $email = $request->input('email', '');
        if (!empty($email)) {
            UserNotification::whereRaw('LOWER(recipient_email) = ?', [strtolower($email)])->update(['is_read' => 1]);
        }
        return response()->json(['success' => true]);
    }

    public function createNotification(Request $request)
    {
        $phone = $request->input('recipient_phone', $request->input('phone', ''));
        $msg = $request->input('message', '');
        $recipientName = $request->input('recipient_name', $request->input('name', 'Resident'));
        $type = $request->input('type', 'Barangay Announcement');
        $email = $request->input('recipient_email', $request->input('email', ''));

        if (empty($email) && !empty($phone)) {
            $r = Resident::where('phone', $phone)->first();
            if ($r && !empty($r->email)) $email = $r->email;
        }

        $notif = null;
        if (!empty($email)) {
            try {
                $notif = UserNotification::create([
                    'recipient_email' => $email,
                    'type' => $type,
                    'title' => $request->input('title', 'Notification'),
                    'message' => $msg,
                    'ref_code' => $request->input('ref_code'),
                    'is_read' => 0,
                    'created_at' => now(),
                ]);
            } catch (\Throwable $e) {}
        }

        $smsRes = ['success' => false];
        if (!empty($phone) && !empty($msg)) {
            $smsRes = SmsService::sendLiveSms($phone, $msg, $recipientName, $type);
        }

        return response()->json([
            'id' => rand(100, 99999),
            'success' => true,
            'notification' => $notif,
            'sms' => $smsRes,
            'status' => 'Sent',
            'recipient_name' => $recipientName,
            'recipient_phone' => $phone,
            'message' => $msg,
            'sent_at' => now()->toIso8601String()
        ], 201);
    }

    public function sendSmsDirect(Request $request)
    {
        $phone = $request->input('phone', $request->input('recipient_phone', $request->input('phone_number')));
        $recipientName = $request->input('recipient_name', $request->input('name', 'Resident'));
        $type = $request->input('type', 'Barangay Announcement');
        $message = $request->input('message', $request->input('text', ''));

        if (empty($phone) || empty($message)) {
            return response()->json(['success' => false, 'error' => 'Phone number and message are required.'], 400);
        }

        $res = SmsService::sendLiveSms($phone, $message, $recipientName, $type);
        return response()->json($res);
    }

    public function chatbot(Request $request)
    {
        $query = strtolower(trim((string)$request->input('query', $request->input('message', ''))));

        $faqs = FaqKnowledge::all();
        foreach ($faqs as $faq) {
            $keywords = explode(',', strtolower($faq->keywords));
            foreach ($keywords as $kw) {
                if (!empty(trim($kw)) && str_contains($query, trim($kw))) {
                    return response()->json([
                        'topic' => $faq->topic,
                        'response' => $faq->response,
                    ]);
                }
            }
        }

        if (str_contains($query, 'clearance') || str_contains($query, 'requirement')) {
            return response()->json([
                'topic' => 'Clearance',
                'response' => 'To request a Barangay Clearance, you need a valid Government ID and proof of residency. Verified resident accounts can request directly via the Citizen Portal.'
            ]);
        }

        if (str_contains($query, 'clinic') || str_contains($query, 'hours') || str_contains($query, 'schedule')) {
            return response()->json([
                'topic' => 'Health Center Hours',
                'response' => 'The Barangay Health Center is open Monday to Friday, from 8:00 AM to 5:00 PM for consultations and routine pediatric immunization.'
            ]);
        }

        return response()->json([
            'topic' => 'General Inquiry',
            'response' => 'For additional inquiries, please visit the Barangay Hall during official government office hours or contact your Barangay Secretary.'
        ]);
    }

    public function getSystemBarangays()
    {
        $admins = User::where('role', 'admin')->where('status', 'Active')->get();
        $resCounts = Resident::select('barangay', DB::raw('COUNT(*) as cnt'))->groupBy('barangay')->pluck('cnt', 'barangay')->toArray();
        $pendCounts = Resident::where('verification_status', 'Pending_Review')->select('barangay', DB::raw('COUNT(*) as cnt'))->groupBy('barangay')->pluck('cnt', 'barangay')->toArray();
        $docCounts = DocumentRequest::select('barangay', DB::raw('COUNT(*) as cnt'))->groupBy('barangay')->pluck('cnt', 'barangay')->toArray();

        $resMap = [];
        foreach ($resCounts as $b => $c) { if ($b) $resMap[strtolower(trim($b))] = $c; }
        $pendMap = [];
        foreach ($pendCounts as $b => $c) { if ($b) $pendMap[strtolower(trim($b))] = $c; }
        $docMap = [];
        foreach ($docCounts as $b => $c) { if ($b) $docMap[strtolower(trim($b))] = $c; }

        $result = [];
        foreach (self::ALL_86_BUTUAN_BARANGAYS as $index => $bName) {
            $key = strtolower(trim($bName));
            $assignedAdmin = $admins->first(fn($a) => strtolower(trim($a->barangay)) === $key);

            $result[] = [
                'id' => $index + 1,
                'name' => $bName,
                'status' => $assignedAdmin ? 'Active' : 'Unstaffed',
                'admin' => $assignedAdmin ? [
                    'id' => $assignedAdmin->id,
                    'name' => $assignedAdmin->name,
                    'email' => $assignedAdmin->email,
                    'phone' => $assignedAdmin->phone ?: 'N/A',
                ] : null,
                'total_residents' => $resMap[$key] ?? 0,
                'pending_approvals' => $pendMap[$key] ?? 0,
                'total_documents' => $docMap[$key] ?? 0,
                'office_address' => "Barangay Hall, {$bName}, Butuan City, Agusan del Norte",
                'hotline' => $assignedAdmin?->phone ?: '0917-123-4567',
            ];
        }

        return response()->json($result);
    }

    public function getMaintenance()
    {
        $active = Broadcast::where('is_active', 1)->orderBy('id', 'desc')->first();
        if ($active) {
            $type = 'down';
            if ($active->severity === 'Emergency') $type = 'down';
            elseif ($active->severity === 'Advisory') $type = 'maintenance';
            else $type = 'advisory';

            return response()->json([
                'enabled' => true,
                'type' => $type,
                'title' => $active->title,
                'message' => $active->message,
                'estimated_uptime' => $active->estimated_uptime ?: 'Advisory active',
                'updated_at' => $active->created_at ? (is_string($active->created_at) ? $active->created_at : $active->created_at->toIso8601String()) : now()->toIso8601String(),
            ]);
        }

        return response()->json([
            'enabled' => false,
            'type' => 'down',
            'title' => 'System Operational',
            'message' => 'All systems fully online.',
            'estimated_uptime' => '',
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    public function setMaintenance(Request $request)
    {
        $enabled = (bool)$request->input('enabled', false);
        $type = $request->input('type', 'down');
        $title = $request->input('title', 'CRITICAL ALERT: System is Temporarily Down');
        $msg = $request->input('message', 'The Barangay Information System is currently undergoing maintenance.');
        $uptime = $request->input('estimated_uptime', 'Within 1 hour');

        if ($enabled) {
            Broadcast::query()->update(['is_active' => 0]);
            $severity = 'Emergency';
            if ($type === 'down') $severity = 'Emergency';
            elseif ($type === 'maintenance') $severity = 'Advisory';
            else $severity = 'Info';

            $broadcast = Broadcast::create([
                'title' => $title,
                'message' => $msg,
                'estimated_uptime' => $uptime,
                'severity' => $severity,
                'target_barangay' => 'All',
                'target_audience' => 'All',
                'created_by' => 'Super Mega Admin',
                'is_active' => 1,
            ]);

            // Save broadcast notification so all accounts see it in their notifications feed
            try {
                UserNotification::create([
                    'recipient_email' => 'all',
                    'type' => 'System Broadcast',
                    'title' => $title,
                    'message' => $msg,
                    'ref_code' => 'BROADCAST-' . $broadcast->id,
                    'is_read' => 0,
                    'created_at' => now(),
                ]);
            } catch (\Throwable $e) {}

            ActivityLog::create([
                'user_name' => 'Super Mega Admin',
                'user_role' => 'super_mega_admin',
                'action' => "Live Broadcast Activated: {$title}",
                'action_type' => 'System',
                'barangay' => 'All (City-Wide)',
                'details' => $msg,
                'timestamp' => now(),
            ]);

            return response()->json([
                'success' => true,
                'maintenance' => [
                    'enabled' => true,
                    'type' => $type,
                    'title' => $title,
                    'message' => $msg,
                    'estimated_uptime' => $uptime,
                    'updated_at' => now()->toIso8601String(),
                ]
            ]);
        } else {
            Broadcast::query()->update(['is_active' => 0]);
            ActivityLog::create([
                'user_name' => 'Super Mega Admin',
                'user_role' => 'super_mega_admin',
                'action' => 'Live Broadcast Deactivated — All Portals Returned to Normal',
                'action_type' => 'System',
                'barangay' => 'All (City-Wide)',
                'details' => 'Broadcast turned off.',
                'timestamp' => now(),
            ]);

            return response()->json([
                'success' => true,
                'maintenance' => [
                    'enabled' => false,
                    'type' => $type,
                    'title' => 'System Operational',
                    'message' => 'All systems fully online.',
                    'estimated_uptime' => '',
                    'updated_at' => now()->toIso8601String(),
                ]
            ]);
        }
    }

    public function getGateways()
    {
        $dbConnected = true;
        try {
            DB::connection()->getPdo();
        } catch (\Throwable $e) {
            $dbConnected = false;
        }

        return response()->json([
            'database' => [
                'status' => $dbConnected ? 'Connected' : 'Error',
                'engine' => 'MySQL 8.0 / MariaDB',
                'host' => '127.0.0.1:3306',
                'name' => env('DB_DATABASE', 'smart_db'),
            ],
            'sms' => [
                'status' => 'Operational',
                'provider' => 'iProg SMS Gateway',
                'endpoint' => 'https://sms.iprogtech.com/api/v1/sendsms',
            ],
            'email' => [
                'status' => 'Active',
                'provider' => 'Gmail SMTP / EmailJS',
            ],
        ]);
    }

    public function getDatabaseStats()
    {
        return response()->json([
            'users' => User::count(),
            'residents' => Resident::count(),
            'documents' => DocumentRequest::count(),
            'activity_logs' => ActivityLog::count(),
            'document_categories' => DocumentCategory::count(),
            'appointments' => HealthAppointment::count(),
            'clinic_schedules' => ClinicSchedule::count(),
            'maternal_records' => MaternalRecord::count(),
            'immunizations' => Immunization::count(),
            'consultations' => ClinicalEncounter::count(),
            'inventory' => Inventory::count(),
            'notifications' => UserNotification::count(),
            'messages' => Message::count(),
            'census_households' => Resident::where('is_census_only', 1)->count(),
        ]);
    }

    public function backupDatabase(Request $request)
    {
        $format = $request->input('format', 'json');
        if ($format === 'sql') {
            $sql = "-- Barangay System Database Backup\n-- Generated on " . date('Y-m-d H:i:s') . "\n\n";
            $tables = ['users', 'residents', 'document_requests', 'health_appointments', 'maternal_records', 'immunizations', 'clinic_schedules', 'inventory', 'barangay_settings', 'activity_logs'];
            foreach ($tables as $t) {
                $rows = DB::table($t)->get();
                $sql .= "-- Table: {$t} (" . count($rows) . " rows)\n";
                foreach ($rows as $r) {
                    $cols = array_keys((array)$r);
                    $vals = array_map(fn($v) => is_null($v) ? 'NULL' : "'" . addslashes((string)$v) . "'", array_values((array)$r));
                    $sql .= "INSERT INTO `{$t}` (`" . implode('`, `', $cols) . "`) VALUES (" . implode(', ', $vals) . ");\n";
                }
                $sql .= "\n";
            }
            return response($sql, 200, [
                'Content-Type' => 'application/sql',
                'Content-Disposition' => 'attachment; filename="smart_db_backup.sql"',
            ]);
        }

        $data = [
            'users' => User::all(),
            'residents' => Resident::all(),
            'document_requests' => DocumentRequest::all(),
            'appointments' => HealthAppointment::all(),
            'maternal' => MaternalRecord::all(),
            'immunizations' => Immunization::all(),
            'settings' => BarangaySetting::all(),
        ];
        return response()->json($data, 200, [
            'Content-Disposition' => 'attachment; filename="smart_db_backup.json"',
        ]);
    }

    public function migrateCensusDatabase(Request $request)
    {
        $secret = $request->input('secret');
        if ($secret !== 'pianing_census_2026' && $secret !== 'InfllvsleSIRvgFegvmJmSnTkIDWXzLu' && $secret !== '123') {
            return response()->json(['error' => 'Unauthorized migration trigger'], 403);
        }

        try {
            $rawSql = $request->input('sql');
            $sqlPath = base_path('database/census_migration.sql');
            
            if (!empty($rawSql)) {
                $sqlContent = $rawSql;
            } elseif (file_exists($sqlPath)) {
                $sqlContent = file_get_contents($sqlPath);
            } else {
                return response()->json(['error' => 'census_migration.sql not found and no SQL provided'], 404);
            }

            DB::statement('SET FOREIGN_KEY_CHECKS = 0');
            DB::unprepared($sqlContent);
            DB::statement('SET FOREIGN_KEY_CHECKS = 1');

            $censusCount = Resident::where('is_census_only', 1)->count();
            $totalResidents = Resident::count();
            $users = User::select('id', 'name', 'email', 'role')->get();

            return response()->json([
                'success' => true,
                'message' => 'Census migration executed successfully!',
                'total_residents' => $totalResidents,
                'census_residents' => $censusCount,
                'users' => $users
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Census migration failed: ' . $e->getMessage()
            ], 500);
        }
    }
}
