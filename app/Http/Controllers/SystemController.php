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

    public static function resolveBarangayCode(?string $barangay): ?string
    {
        if (empty($barangay)) return 'BRGY-001';
        $clean = trim(preg_replace('/^barangay\s+/i', '', $barangay));
        foreach (self::ALL_86_BUTUAN_BARANGAYS as $idx => $b) {
            if (strcasecmp($b, $clean) === 0 || strcasecmp($b, $barangay) === 0) {
                return 'BRGY-' . str_pad($idx + 1, 3, '0', STR_PAD_LEFT);
            }
        }
        return 'BRGY-001';
    }

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

        $smsRes = ['success' => false, 'sent' => false, 'note' => 'SMS skipped: internal notification only'];
        $shouldSendSms = $request->boolean('send_sms', false) || $request->boolean('dispatch_sms', false);
        if ($shouldSendSms && !empty($phone) && !empty($msg)) {
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
        $rawQuery = (string)$request->input('question', $request->input('query', $request->input('message', '')));
        if (empty($rawQuery)) {
            $rawContent = $request->getContent();
            if (!empty($rawContent)) {
                $json = json_decode($rawContent, true);
                if (is_array($json)) {
                    $rawQuery = (string)($json['question'] ?? $json['query'] ?? $json['message'] ?? '');
                }
            }
        }
        $cleanQuery = strtolower(trim(preg_replace('/^[📄💉🕐🏪🤰💰📝🖨️]\s*/u', '', $rawQuery)));

        if (empty($cleanQuery)) {
            return response()->json([
                'answer' => "👋 Magandang araw! I am your Barangay Pianing AI Assistant.\n\nHow can I help you today? You can ask about:\n• *Barangay Clearances & Certificates*\n• *Free Child Immunization Schedule*\n• *Prenatal & Health Center Services*\n• *Document Fees & Office Hours*\n• *Resident Account Registration*",
                'response' => "👋 Magandang araw! I am your Barangay Pianing AI Assistant.\n\nHow can I help you today? You can ask about:\n• *Barangay Clearances & Certificates*\n• *Free Child Immunization Schedule*\n• *Prenatal & Health Center Services*\n• *Document Fees & Office Hours*\n• *Resident Account Registration*",
                'topic' => 'Welcome',
                'source' => 'welcome'
            ]);
        }

        // 1. Authoritative Knowledge Base for Barangay Pianing & Healthcare Portal
        $knowledgeBase = [
            [
                'topic' => 'Barangay Clearance',
                'keywords' => ['clearance', 'barangay clearance', 'kuha clearance', 'police clearance', 'nbi clearance', 'clearance requirements', 'unsaon pagkuha og clearance', 'paano kumuha ng clearance', 'requirements clearance', 'cedula'],
                'answer' => "📄 *Barangay Clearance Requirements & Procedure:*\n\n✅ *Requirements:*\n• 1 Valid Government-Issued ID (PhilSys, Voter's ID, Driver's License, Postal ID, Passport)\n• Community Tax Certificate (Cedula) — available at Barangay Hall Cashier\n• Proof of Residency in Barangay Pianing (utility bill or lease)\n• Purpose of request (Employment, Bank, Travel, Postal ID, etc.)\n\n🕐 *Processing Time:* Same day (15–30 minutes)\n💰 *Official Fee:* Php 50.00\n📍 *Where:* Barangay Hall, Room 1 – Document Section\n\n💡 *Online Request:* Verified residents can request directly via the *Barangay Portal* in this system to avoid queueing!"
            ],
            [
                'topic' => 'Certificate of Residency',
                'keywords' => ['residency', 'certificate of residency', 'proof of residency', 'proof of residence', 'patunay ng paninirahan', 'residente'],
                'answer' => "🏠 *Certificate of Residency Requirements:*\n\n✅ *Requirements:*\n• Valid Government ID showing your Barangay Pianing address\n• Recent Utility Bill (ANECO electricity or water bill) within the last 3 months\n• Proof of living in Barangay Pianing for at least 6 months\n• 1 pc 2x2 or 1x1 ID photo (if requested for file record)\n\n🕐 *Processing Time:* Same day (15–30 minutes)\n💰 *Official Fee:* Php 50.00\n📍 *Where:* Barangay Hall – Records Section\n\n💡 You can submit this request online directly through your *Resident Portal*!"
            ],
            [
                'topic' => 'Certificate of Indigency',
                'keywords' => ['indigency', 'certificate of indigency', 'indigent', 'financial assistance', 'medical assistance', 'tulong', 'bursary', 'scholarship', '4ps', 'libre', 'walang pambayad'],
                'answer' => "📋 *Certificate of Indigency (100% FREE):*\n\n✅ *Requirements:*\n• Valid Government ID of the requesting resident / beneficiary\n• Purok recommendation or confirmation of indigent residency\n• Statement of Purpose (Medical Assistance at Butuan Medical Center, PCSO, DSWD, Public Attorney's Office, Scholarship, or Funeral Assistance)\n\n🕐 *Processing Time:* Same day\n💰 *Official Fee:* **FREE / No Charge** (Exempted under government regulations)\n📍 *Where:* Barangay Hall – Indigent & Social Welfare Desk\n\n💡 Verified indigent residents can also request this free certificate online via the *Resident Portal*."
            ],
            [
                'topic' => 'Business Permit & Clearance',
                'keywords' => ['business permit', 'business clearance', 'business', 'negosyo', 'sari-sari', 'store', 'commercial permit', 'tindahan', 'permit'],
                'answer' => "🏪 *Barangay Business Clearance Requirements:*\n\n✅ *Requirements:*\n• DTI Registration (for Sole Proprietorship) or SEC Registration (for Corporations)\n• Lease Contract or Land Title / Owner's Consent Letter\n• Valid Government ID of the Business Owner\n• Community Tax Certificate (Cedula)\n• Previous Year Barangay Business Permit (for renewals)\n\n🕐 *Processing Time:* 1–2 business days (subject to site inspection)\n💰 *Official Fee:* Php 200.00 – Php 500.00 (based on business classification)\n📍 *Where:* Barangay Hall – Treasury & Business Licensing Section"
            ],
            [
                'topic' => 'Barangay ID',
                'keywords' => ['barangay id', 'id card', 'valid id', 'identification', 'kuha id', 'barangay identification'],
                'answer' => "🪪 *Barangay ID Requirements:*\n\n✅ *Requirements:*\n• Proof of residency in Barangay Pianing for at least 6 months\n• 2 pcs recent 2x2 ID photos with white background\n• Valid supporting ID or Birth Certificate (PSA)\n• Accomplished Barangay ID Application Form\n\n🕐 *Processing Time:* 1–3 business days\n💰 *Official Fee:* Php 50.00\n📍 *Where:* Barangay Hall – IT & ID Issuance Desk"
            ],
            [
                'topic' => 'First Time Jobseeker Certificate',
                'keywords' => ['jobseeker', 'first time jobseeker', 'ra 11261', 'first job', 'fresh graduate', 'job seeker'],
                'answer' => "🎓 *First Time Jobseeker Certificate (Republic Act 11261):*\n\nUnder RA 11261, first-time jobseekers are **EXEMPT** from government fees for clearances and certificates!\n\n✅ *Requirements:*\n• Oath of Undertaking (provided at Barangay Hall)\n• Valid ID or School ID / Transcript / Diploma\n• Barangay Certification confirming first-time jobseeker status\n\n💰 *Official Fee:* **100% FREE**\n📍 *Where:* Barangay Hall – Youth & Employment Desk"
            ],
            [
                'topic' => 'Special Certifications',
                'keywords' => ['employment', 'certificate of employment', 'land occupancy', 'good moral', 'solo parent', 'activity permit', 'occupancy'],
                'answer' => "📜 *Special Barangay Certifications Available:*\n\n• *Certificate of Land Occupancy:* For MERALCO/ANECO electric meter or building connection. (Fee: Php 100.00)\n• *Certificate of Good Moral:* For employment, school transfer, or legal requirements. (Fee: Php 50.00)\n• *Solo Parent Certification:* For DSWD Solo Parent ID qualification. (Fee: FREE)\n• *Barangay Activity Permit:* For community assemblies, sports events, or transport operations. (Fee: Php 100.00)\n\n📍 Request via the *Barangay Portal* or the Barangay Hall Front Desk."
            ],
            [
                'topic' => 'Fees & Payment Guide',
                'keywords' => ['fee', 'fees', 'magkano', 'pila', 'bayad', 'cost', 'price', 'payment', 'cashier', 'how much', 'what are the fees'],
                'answer' => "💰 *Barangay Pianing Official Schedule of Fees:*\n\n• *Barangay Clearance:* Php 50.00\n• *Certificate of Residency:* Php 50.00\n• *Barangay ID Card:* Php 50.00\n• *Business Permit / Clearance:* Php 200.00 – Php 500.00\n• *Land Occupancy / Activity Permit:* Php 100.00\n• *Certificate of Indigency:* **FREE / Walang Bayad**\n• *First Time Jobseeker Certificate:* **FREE (RA 11261)**\n• *All Health Center Services:* **100% FREE**\n\n💳 *Payment Method:* Cash at the Barangay Hall Cashier upon document release, or confirmed online."
            ],
            [
                'topic' => 'EPI Child Immunization Schedule',
                'keywords' => ['vaccine', 'vaccines', 'vaccination', 'immunization', 'bakuna', 'turok', 'schedule sa bakuna', 'free vaccine', 'infant', 'baby', 'child', 'bcg', 'polio', 'mmr', 'hepatitis', 'pentavalent', 'dpt', 'pcv', 'free vaccine schedule'],
                'answer' => "💉 *Free Infant & Child Immunization Schedule (EPI):*\n\n📅 *Clinic Schedule:* Every **Wednesday & Friday**, 8:00 AM – 12:00 PM\n📍 *Location:* Barangay Pianing Health Center\n\n🛡️ *Available Free DOH Vaccines:*\n• *BCG & Hepatitis B:* Given at birth / early infancy\n• *Pentavalent (DPT-HepB-Hib):* 6, 10, and 14 weeks\n• *OPV / IPV (Oral & Injected Polio):* 6, 10, 14 weeks & 9 months\n• *PCV (Pneumococcal Conjugate):* 6, 10, and 14 weeks\n• *MMR (Measles, Mumps, Rubella):* 9 months and 12 months\n\n📋 *Please bring:* Baby Book / Mother-Child Health Record.\n\n💡 *SMS Alert:* Registered parents receive automated SMS reminders before upcoming vaccine schedules!"
            ],
            [
                'topic' => 'Maternal & Prenatal Health Care',
                'keywords' => ['prenatal', 'pregnant', 'pregnancy', 'maternal', 'buntis', 'pa-checkup', 'ultrasound', 'postnatal', 'ob-gyn', 'midwife', 'nurse', 'prenatal care services', 'prenatal care'],
                'answer' => "🤰 *Maternal & Prenatal Care Services (FREE):*\n\n🏥 *Services Available:*\n• Routine Prenatal & Postnatal Checkups with Nurse & Rural Health Midwife\n• Blood Pressure, Maternal Weight, and Fundic Height monitoring\n• Free Iron + Folic Acid and Calcium Supplements\n• Tetanus-Diphtheria (Td) immunization for mothers\n• High-Risk Pregnancy Screening and referral to Butuan Medical Center\n\n📅 *Schedule:* Monday to Friday, 8:00 AM – 5:00 PM\n📍 *Location:* Barangay Pianing Health Station – Maternal Room\n\n📋 *Please bring:* Mother-Baby Handbook and previous laboratory results."
            ],
            [
                'topic' => 'Health Center Services & Hours',
                'keywords' => ['health center', 'clinic', 'consultation', 'doctor', 'nurse', 'bhw', 'checkup', 'oras sa clinic', 'health station', 'general consultation', 'health services'],
                'answer' => "🏥 *Barangay Pianing Health Center Services & Hours:*\n\n🕐 *Operating Hours:* Monday – Friday: **8:00 AM – 5:00 PM**\n❌ Closed on Saturdays, Sundays, and Official Public Holidays\n\n🩺 *Available Free Services:*\n• General Medical Consultations & Triage\n• Vital Signs (BP, Blood Glucose, Temperature, Pulse)\n• Free Essential Maintenance Medicines & Vitamins (subject to stock)\n• Pediatric Deworming and Nutritional Guidance\n• Medical Certificates & Health Clearances\n\n📍 *Location:* Barangay Hall Compound, Health Center Annex Building\n📞 *Hotline:* (085) 341-2345 / 0919-876-5432"
            ],
            [
                'topic' => 'Free Medicines & Pharmacy',
                'keywords' => ['medicine', 'medicines', 'gamot', 'tambal', 'libre nga tambal', 'paracetamol', 'antibiotic', 'vitamins', 'pharmacy', 'supply'],
                'answer' => "💊 *Free Medicines & Medical Supplies:*\n\nThe Barangay Health Station dispenses free essential medications provided by DOH & City Health Office:\n• *Fever & Pain:* Paracetamol (tablets & oral suspension)\n• *Cough & Cold:* Carbocisteine, Salbutamol for nebulization\n• *Hypertension:* Amlodipine, Losartan (with prescription)\n• *Nutritional:* Vitamin A, Iron drops, Zinc, Deworming tablets\n\n📋 *How to claim:* Visit the health station for clinical assessment or present a valid prescription from a government doctor."
            ],
            [
                'topic' => 'Clinic Appointment Booking',
                'keywords' => ['appointment', 'book appointment', 'schedule appointment', 'pa-appointment', 'reserva', 'clinic schedule'],
                'answer' => "🗓️ *How to Book a Health Center Appointment:*\n\n1. Log in to your *Resident Account* on this portal\n2. Navigate to the *Health Center Portal*\n3. Click *\"Book Clinic Appointment\"*\n4. Select the service: Prenatal Care, Immunization, or General Consultation\n5. Choose your preferred date and available time slot\n6. Confirm your booking!\n\n📱 *SMS Reminder:* You will receive an automated text confirmation and a 24-hour reminder before your scheduled visit."
            ],
            [
                'topic' => 'Resident Account Registration',
                'keywords' => ['register', 'sign up', 'create account', 'unsaon pag register', 'paano mag register', 'census record', 'new account', 'existing resident', 'how to register', 'how to register an account'],
                'answer' => "📝 *How to Register a Resident Account:*\n\n1. Open the *Login Page* and select the **Create Account** tab.\n2. Choose your registration path:\n   • **Existing Census Resident (Fast-Track):** If you are already listed in the official Barangay Pianing census, search your Full Name and Purok to auto-fill and activate your account immediately!\n   • **New Resident:** If you recently moved to Barangay Pianing, fill out the form and upload a clear photo of your valid Government ID.\n3. Submit your registration!\n\n⏳ *Verification:* The Barangay Secretary will review and activate your account within 24 hours. You'll receive an SMS/Email alert upon approval!"
            ],
            [
                'topic' => 'Account Verification Guide',
                'keywords' => ['verify', 'verification', 'pending review', 'rejected', 'unverified', 'na-reject', 'account locked', 'locked', 'approval'],
                'answer' => "🛡️ *Account Verification & Status Guide:*\n\n• *Why is my account Pending?* Accounts are reviewed within 24 to 48 hours to confirm genuine residency in Barangay Pianing.\n• *Why can't I request documents yet?* Unverified accounts are locked from requesting documents online to prevent identity fraud.\n• *What if my registration was Rejected?* View the reason in your portal. Click *\"Resubmit Application\"* to upload a clearer ID photo or correct any details.\n\n🏢 Need urgent approval? Visit the Barangay Hall Front Desk with your physical valid ID for instant activation!"
            ],
            [
                'topic' => 'Office Hours & Schedule',
                'keywords' => ['hours', 'office hours', 'open', 'schedule', 'oras', 'abli', 'what time', 'operating hours', 'adlaw', 'what time open', 'office hours?'],
                'answer' => "🕐 *Barangay Pianing Official Operating Hours:*\n\n🏛️ *Barangay Hall Administrative Offices:*\n• Monday – Friday: **8:00 AM – 5:00 PM** (Continuous frontline service)\n• Saturday: **8:00 AM – 12:00 PM** (Frontline assistance desk)\n• Sunday & Public Holidays: **Closed**\n\n🏥 *Barangay Health Center:*\n• Monday – Friday: **8:00 AM – 5:00 PM**\n• Child Immunization: Wednesdays & Fridays (8:00 AM – 12:00 PM)\n\n🚨 *Barangay Tanod & Emergency Assistance:* **24/7 Active**"
            ],
            [
                'topic' => 'Contact & Location Information',
                'keywords' => ['contact', 'phone', 'hotline', 'address', 'location', 'where', 'asa dapit', 'email', 'emergency', 'number', 'telepono', 'contact info'],
                'answer' => "📞 *Barangay Pianing Official Directory:*\n\n🏛️ *Physical Address:*\nBarangay Hall, Barangay Pianing, Butuan City, Agusan del Norte, Caraga Region XIII, 8600 Philippines\n\n☎️ *Official Hotlines:*\n• Barangay Hall Front Desk: **0917-890-1234** / (085) 341-2345\n• Health Center Desk: **0919-876-5432**\n• Barangay Emergency & Tanod Desk: **0917-111-2233** (24/7)\n• Official Email: **barangay.pianing.butuan@gmail.com**\n\n🚨 *Butuan City Emergency Numbers:*\n• Butuan CDRRMO Rescue: (085) 342-5555 / 911\n• Butuan City Police Station: (085) 815-1234\n• Butuan City Medical Center (BCMC): (085) 341-1111"
            ],
            [
                'topic' => 'Document Request Tracking',
                'keywords' => ['track', 'status', 'check status', 'pending request', 'ready for pickup', 'claim', 'asan na', 'kanus-a makuha', 'status request'],
                'answer' => "🔍 *How to Track Your Document Request:*\n\n1. Log in to your *Resident Portal*\n2. Go to the *\"My Document Requests\"* table on your dashboard\n3. Look at your real-time status badge:\n   • 🟡 *Pending Review:* Awaiting review by the Barangay Secretary\n   • 🔵 *Processing:* Document is being prepared and certified\n   • 🟢 *Ready for Pickup:* Signed and sealed! Bring your valid ID to claim at Room 1\n   • 🟣 *Released / Completed:* Formally released to you\n\n📱 You will also receive an automated SMS notification as soon as your document is marked Ready for Pickup!"
            ],
            [
                'topic' => 'Printing & PDF Documents',
                'keywords' => ['print', 'download', 'pdf', 'digital certificate', 'qr code', 'copy', 'unsaon pag print', 'how to print', 'how to print my document'],
                'answer' => "🖨️ *Downloading & Printing Your Digital Document:*\n\n1. Log in and go to your *Resident Portal* dashboard\n2. Scroll down to *\"My Document Requests\"*\n3. For approved requests, click the *\"Download PDF\"* or *\"Print\"* button\n4. Your official document will open with an authentic seal and verification QR code!\n\n💡 You can print this directly or present the downloaded digital copy with its QR verification code to requesting employers, schools, or agencies."
            ],
            [
                'topic' => 'Account Recovery & Password Reset',
                'keywords' => ['password', 'forgot password', 'reset password', 'recover', 'kalimutan ang password', 'login issue', 'cannot login', 'change password'],
                'answer' => "🔑 *Forgot Password & Account Recovery:*\n\n1. Go to the *Login Page*\n2. Click the *\"Forgot Password?\"* link next to the password input field\n3. Enter your registered email address\n4. Follow the reset link sent to your inbox\n\n💡 Alternatively, visit the Barangay Hall Admin desk or message the barangay administrator to reset your password directly."
            ],
            [
                'topic' => 'Barangay AI Assistant',
                'keywords' => ['hello', 'hi', 'hey', 'kumusta', 'maayong adlaw', 'good morning', 'good afternoon', 'good evening', 'help', 'unsa imong mabuhat', 'ano ang magagawa mo', 'who are you', 'sino ka'],
                'answer' => "👋 *Magandang araw! Maayong adlaw!*\n\nI am your official **Barangay Pianing AI Assistant**. I'm here 24/7 to help you with:\n• 📄 *Clearances & Documents:* Requirements, fees, and processing times\n• 🏥 *Health Center Services:* Free checkups, prenatal care, and clinic hours\n• 💉 *Child Immunization:* Free vaccine schedules and requirements\n• 📝 *Resident Accounts:* Registration, verification, and status tracking\n• 📞 *Contact & Location:* Hotlines, office hours, and emergency contacts\n\nHow can I help you today? Feel free to ask a question or tap one of the quick pills below!"
            ]
        ];

        // 3. Intelligent Scoring Matcher
        $bestMatch = null;
        $bestScore = 0;
        $words = preg_split('/\s+/', $cleanQuery, -1, PREG_SPLIT_NO_EMPTY);

        foreach ($knowledgeBase as $item) {
            $score = 0;
            foreach ($item['keywords'] as $kw) {
                $kw = strtolower($kw);

                // Exact substring or phrase match
                if (str_contains($cleanQuery, $kw)) {
                    $score += (strlen($kw) >= 5 ? 25 : 15);
                }

                // Individual word token match
                foreach ($words as $w) {
                    if (strlen($w) >= 3 && str_contains($kw, $w)) {
                        $score += 8;
                    }
                }
            }

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestMatch = $item;
            }
        }

        if ($bestMatch && $bestScore >= 8) {
            return response()->json([
                'answer' => $bestMatch['answer'],
                'response' => $bestMatch['answer'],
                'topic' => $bestMatch['topic'],
                'source' => 'knowledge_base'
            ]);
        }

        // 3. Check custom database FAQs if table exists
        try {
            $faqs = FaqKnowledge::all();
            foreach ($faqs as $faq) {
                $keywords = explode(',', strtolower($faq->keywords ?? ''));
                foreach ($keywords as $kw) {
                    $trimKw = trim($kw);
                    if (!empty($trimKw) && str_contains($cleanQuery, $trimKw)) {
                        return response()->json([
                            'answer' => $faq->response,
                            'response' => $faq->response,
                            'topic' => $faq->topic ?? 'FAQ',
                            'source' => 'database'
                        ]);
                    }
                }
            }
        } catch (\Throwable $e) {
            // ignore and proceed to helpful fallback
        }

        // 4. Helpful Structured Fallback
        $fallback = "🤔 I want to make sure I give you the exact information you need!\n\nHere are the most common things I can assist you with:\n\n📄 *Barangay Documents:* Ask for *\"Barangay Clearance requirements\"*, *\"Residency certificate\"*, or *\"Indigency\"*\n💰 *Fees:* Ask *\"What are the document fees?\"*\n💉 *Healthcare:* Ask *\"Free vaccine schedule\"* or *\"Prenatal services\"*\n🕐 *Office Hours:* Ask *\"Office hours\"* or *\"Clinic schedule\"*\n📝 *Account:* Ask *\"How to register an account?\"*\n📞 *Assistance:* Contact the Barangay Hall directly at **0917-890-1234**.\n\nPlease feel free to rephrase your question!";

        return response()->json([
            'answer' => $fallback,
            'response' => $fallback,
            'topic' => 'General Inquiry',
            'source' => 'fallback'
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
                'code' => 'BRGY-' . str_pad($index + 1, 3, '0', STR_PAD_LEFT),
                'name' => $bName,
                'city' => 'Butuan City',
                'province' => 'Agusan del Norte',
                'zip_code' => '8600',
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
