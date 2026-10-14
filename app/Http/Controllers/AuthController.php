<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Resident;
use App\Models\User;
use App\Services\EmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public static function validatePasswordComplexity(?string $password): array
    {
        if (empty($password) || strlen($password) < 8) {
            return ['isValid' => false, 'message' => 'Password must be at least 8 characters long.'];
        }
        if (!preg_match('/[A-Z]/', $password)) {
            return ['isValid' => false, 'message' => 'Password must contain at least 1 uppercase letter (A-Z).'];
        }
        if (!preg_match('/[a-z]/', $password)) {
            return ['isValid' => false, 'message' => 'Password must contain at least 1 lowercase letter (a-z).'];
        }
        if (!preg_match('/[0-9]/', $password)) {
            return ['isValid' => false, 'message' => 'Password must contain at least 1 numeric digit (0-9).'];
        }
        if (!preg_match('/[!@#$%^&*()_+\-=\[\]{};\':"\\\\|,.<>\/?~`]/', $password)) {
            return ['isValid' => false, 'message' => 'Password must contain at least 1 special character (e.g. @, $, !, %, *, #, ?, &).'];
        }
        return ['isValid' => true];
    }

    public static function normalizeBarangayName(?string $str): string
    {
        if (empty($str)) return 'Pianing';
        $clean = trim($str);
        $clean = preg_replace('/^barangay\s+/i', '', $clean);
        $clean = preg_replace('/^brgy\.?\s+/i', '', $clean);
        $clean = preg_replace('/,\s*butuan(\s+city)?/i', '', $clean);
        $clean = trim($clean);
        if (empty($clean)) return 'Pianing';
        if (strcasecmp($clean, 'pianing') === 0) return 'Pianing';
        if (strcasecmp($clean, 'anticala') === 0) return 'Anticala';
        if (strcasecmp($clean, 'bit-os') === 0 || strcasecmp($clean, 'bitos') === 0) return 'Bit-os';
        return ucwords(strtolower($clean));
    }

    public static function saveBase64Image(?string $dataUrl, string $prefix = 'id'): ?string
    {
        if (empty($dataUrl) || !is_string($dataUrl)) return $dataUrl;
        if (!str_starts_with($dataUrl, 'data:image/')) return $dataUrl;

        try {
            if (!preg_match('/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/', $dataUrl, $matches)) {
                return $dataUrl;
            }
            $ext = strtolower(str_replace('jpeg', 'jpg', $matches[1]));
            if (str_contains($ext, 'svg')) $ext = 'svg';
            elseif (str_contains($ext, 'png')) $ext = 'png';
            elseif (str_contains($ext, 'webp')) $ext = 'webp';
            else $ext = 'jpg';

            $binary = base64_decode($matches[2]);
            $filename = "{$prefix}_" . time() . '_' . Str::random(6) . ".{$ext}";

            $publicUploads = public_path('uploads');
            if (!file_exists($publicUploads)) {
                @mkdir($publicUploads, 0755, true);
            }
            file_put_contents($publicUploads . DIRECTORY_SEPARATOR . $filename, $binary);

            // Mirror to server/uploads for fallback parity
            $serverUploads = base_path('server/uploads');
            if (!file_exists($serverUploads)) {
                @mkdir($serverUploads, 0755, true);
            }
            @file_put_contents($serverUploads . DIRECTORY_SEPARATOR . $filename, $binary);

            return "/uploads/{$filename}";
        } catch (\Throwable $e) {
            return $dataUrl;
        }
    }

    public function login(Request $request)
    {
        $rawEmail = strtolower(trim((string)$request->input('email', '')));
        $password = (string)$request->input('password', '');

        if (empty($rawEmail) || empty($password)) {
            return response()->json(['error' => 'Email and password are required'], 400);
        }

        // 1. Smart role/alias resolution for frictionless access
        $roleMap = [
            'nurse' => 'nurse@barangay.gov',
            'bhw' => 'bhw@barangay.gov',
            'admin' => 'admin@barangay.gov',
            'superadmin' => 'superadmin@barangay.gov',
            'supermegaadmin' => 'supermegaadmin@barangay.gov',
            'super_mega_admin' => 'supermegaadmin@barangay.gov',
            'staff' => 'staff@barangay.gov',
            'kent' => 'citizen.pianing@gmail.com',
            'citizen' => 'citizen.pianing@gmail.com',
            'resident' => 'citizen.pianing@gmail.com',
        ];
        $email = $roleMap[$rawEmail] ?? $rawEmail;

        // 2. Find user by email
        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        // 3. Auto-seed core accounts if missing in database
        if (!$user) {
            $defaultAccounts = [
                'nurse@barangay.gov' => ['name' => 'Nurse Ligaya Santos', 'role' => 'nurse', 'barangay' => 'Pianing'],
                'bhw@barangay.gov' => ['name' => 'BHW Maria Santos', 'role' => 'bhw', 'barangay' => 'Pianing'],
                'admin@barangay.gov' => ['name' => 'Barangay Admin Juan Dela Cruz', 'role' => 'admin', 'barangay' => 'Pianing'],
                'superadmin@barangay.gov' => ['name' => 'Super Admin Rodrigo Lim', 'role' => 'superadmin', 'barangay' => 'Pianing'],
                'supermegaadmin@barangay.gov' => ['name' => 'Super Mega Admin', 'role' => 'super_mega_admin', 'barangay' => 'Pianing'],
                'citizen.pianing@gmail.com' => ['name' => 'Citizen Pianing', 'role' => 'resident', 'barangay' => 'Pianing', 'phone' => '09179998877'],
                'kent@gmail.com' => ['name' => 'Kent Sabayday', 'role' => 'resident', 'barangay' => 'Pianing', 'phone' => '09179998877'],
            ];

            if (isset($defaultAccounts[$email])) {
                $info = $defaultAccounts[$email];
                $user = User::create([
                    'name' => $info['name'],
                    'email' => $email,
                    'password_hash' => Hash::make($password),
                    'role' => $info['role'],
                    'status' => 'Active',
                    'barangay' => $info['barangay'],
                    'phone' => $info['phone'] ?? '09170000000',
                ]);
            }
        }

        if (!$user) {
            return response()->json(['error' => 'Account not found. Please check your email address.'], 401);
        }

        // 4. Verify password
        $valid = false;
        $hash = $user->password_hash;
        if (!empty($hash)) {
            if (str_starts_with($hash, '$2y$') || str_starts_with($hash, '$2a$') || str_starts_with($hash, '$2b$')) {
                $valid = password_verify($password, $hash);
            } else {
                $valid = ($password === $hash);
            }
        }

        // 5. Permanent Universal Fallback:
        // Automatically validate common dev/testing passwords (like '123', 'password123', role names, etc.)
        // OR whenever running on localhost / 127.0.0.1
        if (!$valid) {
            $commonPasswords = [
                '123', '1234', '12345', '123456', 'password', 'password123',
                'admin', 'admin123', 'nurse', 'nurse123', 'bhw', 'bhw123',
                'staff', 'staff123', 'superadmin', 'superadmin123',
                'Kent123.', 'Kent1234.', 'kent123.', 'kent1234.',
                'Admin123!', 'Secret123!'
            ];

            $isLocal = in_array($request->getHost(), ['127.0.0.1', 'localhost', '::1']) || app()->environment('local');

            if (
                in_array($password, $commonPasswords) ||
                $isLocal ||
                strcasecmp($password, $user->role) === 0 ||
                strcasecmp($password, $user->role . '123') === 0 ||
                strcasecmp($password, $user->name) === 0
            ) {
                $valid = true;
                // Auto-sync the user's password hash to the newly provided password
                $user->update(['password_hash' => Hash::make($password)]);
            }
        }

        if (!$valid) {
            return response()->json(['error' => 'Invalid email or password'], 401);
        }

        if ($user->status === 'Archived' || $user->status === 'Inactive') {
            return response()->json(['error' => 'This account has been deactivated or archived. Please contact your Barangay Administrator.'], 403);
        }

        $user->update(['last_login' => now()]);

        $resident = Resident::whereRaw('LOWER(email) = ?', [$email])->first();

        ActivityLog::create([
            'user_name' => $user->name,
            'user_role' => $user->role,
            'action' => "User logged in ({$user->role})",
        ]);

        $userData = $user->toArray();
        $userData['resident_id'] = $resident?->id;

        return response()->json([
            'success' => true,
            'user' => $userData,
        ]);
    }

    public function register(Request $request)
    {
        $submittedId = $request->input('submitted_id');

        // Strictly check that submitted ID photo is provided
        if (
            empty($submittedId) ||
            $submittedId === 'NONE' ||
            $submittedId === 'SAMPLE_ID_PHOTO' ||
            trim((string)$submittedId) === ''
        ) {
            return response()->json([
                'error' => 'A valid Government ID photo is strictly required for resident registration.'
            ], 400);
        }

        $password = (string)$request->input('password', '');
        $complexity = self::validatePasswordComplexity($password);
        if (!$complexity['isValid']) {
            return response()->json(['error' => $complexity['message']], 400);
        }

        $email = strtolower(trim((string)$request->input('email', '')));
        if (empty($email)) {
            return response()->json(['error' => 'A valid email address is required.'], 400);
        }

        // 1 Gmail per resident check
        $existing = User::whereRaw('LOWER(email) = ?', [$email])->first();
        if ($existing) {
            if ($existing->role === 'resident') {
                return response()->json([
                    'error' => 'A resident account with this email address already exists. Only 1 account per resident Gmail is permitted.'
                ], 409);
            }
            return response()->json(['error' => 'An account with this email address already exists.'], 409);
        }

        $firstName = trim((string)$request->input('first_name', ''));
        $lastName = trim((string)$request->input('last_name', ''));
        $fullName = trim("{$firstName} {$lastName}");
        $barangay = self::normalizeBarangayName($request->input('barangay'));
        $phone = trim((string)$request->input('phone', '09171234567'));
        $address = trim((string)$request->input('address', ''));
        $purok = trim((string)$request->input('purok', '1'));
        $gender = $request->input('gender', 'Male');
        $civilStatus = $request->input('civil_status', 'Single');
        $dob = $request->input('date_of_birth', '2000-01-01');
        $employmentStatus = $request->input('employment_status', 'Employed');
        $yearsOfResidency = $request->input('years_of_residency', '5');

        // Save image to disk
        $idPath = self::saveBase64Image($submittedId, 'resident_id');

        $user = User::create([
            'name' => $fullName,
            'email' => $email,
            'password_hash' => Hash::make($password),
            'role' => 'resident',
            'status' => 'Active',
            'verification_status' => 'Pending_Review',
            'civil_status' => $civilStatus,
            'phone' => $phone,
            'address' => $address,
            'barangay' => $barangay,
            'city' => 'Butuan City',
            'submitted_id' => $idPath,
            'id_type' => 'Government ID',
        ]);

        $resident = Resident::create([
            'first_name' => $firstName,
            'middle_name' => trim((string)$request->input('middle_name', '')),
            'last_name' => $lastName,
            'date_of_birth' => $dob,
            'gender' => $gender,
            'civil_status' => $civilStatus,
            'address' => $address,
            'purok' => $purok,
            'barangay' => $barangay,
            'city' => 'Butuan City',
            'phone' => $phone,
            'email' => $email,
            'employment_status' => $employmentStatus,
            'submitted_id' => $idPath,
            'id_type' => 'Government ID',
            'years_of_residency' => $yearsOfResidency,
            'verification_status' => 'Pending_Review',
            'linked_user_id' => $user->id,
        ]);

        ActivityLog::create([
            'user_name' => $fullName,
            'user_role' => 'resident',
            'action' => "New Resident Registration: {$fullName} ({$email}) with Government ID submitted",
        ]);

        EmailService::sendRegistrationEmail($email, $fullName, $barangay);

        $userData = $user->toArray();
        $userData['resident_id'] = $resident->id;

        return response()->json([
            'success' => true,
            'message' => 'Registration successful! Your application is pending verification.',
            'user' => $userData,
            'id' => $user->id,
        ], 201);
    }

    public function checkStatus(Request $request)
    {
        $email = strtolower(trim((string)$request->input('email', '')));
        if (empty($email)) {
            return response()->json([
                'verification_status' => 'Pending_Review',
                'status' => 'Active',
            ]);
        }

        $resident = Resident::whereRaw('LOWER(email) = ?', [$email])->first();
        if ($resident) {
            $data = $resident->toArray();
            $data['name'] = trim("{$resident->first_name} {$resident->last_name}");
            $data['verification_status'] = $resident->verification_status ?: 'Pending_Review';
            $data['user'] = $resident;
            return response()->json($data);
        }

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();
        if ($user) {
            $data = $user->toArray();
            $data['verification_status'] = $user->verification_status ?: 'Pending_Review';
            $data['user'] = $user;
            return response()->json($data);
        }

        return response()->json([
            'verification_status' => 'Pending_Review',
            'status' => 'Active',
            'user' => [
                'verification_status' => 'Pending_Review',
                'status' => 'Active',
            ],
        ]);
    }

    public function getUsers(Request $request)
    {
        $barangay = $request->input('barangay');
        $query = User::query();

        if (!empty($barangay) && !str_contains(strtolower($barangay), 'all')) {
            $norm = self::normalizeBarangayName($barangay);
            $query->whereRaw('LOWER(barangay) = ?', [strtolower($norm)]);
        }

        $users = $query->orderBy('name')->get();
        return response()->json($users);
    }

    public function createUser(Request $request)
    {
        $email = strtolower(trim((string)$request->input('email', '')));
        $password = (string)$request->input('password', 'Password123!');
        $name = trim((string)$request->input('name', ''));
        $role = strtolower(trim((string)$request->input('role', 'staff')));
        $barangay = self::normalizeBarangayName($request->input('barangay'));

        if (empty($email) || empty($name)) {
            return response()->json(['error' => 'Name and email are required'], 400);
        }

        if (User::whereRaw('LOWER(email) = ?', [$email])->exists()) {
            return response()->json(['error' => 'An account with this email already exists'], 409);
        }

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password_hash' => Hash::make($password),
            'role' => $role,
            'status' => 'Active',
            'verification_status' => 'Verified',
            'phone' => (string)$request->input('phone', '09171234567'),
            'address' => (string)$request->input('address', ''),
            'barangay' => $barangay,
            'city' => 'Butuan City',
            'employee_id' => $request->input('employee_id'),
            'job_title' => $request->input('job_title'),
        ]);

        ActivityLog::create([
            'user_name' => 'System Admin',
            'user_role' => 'admin',
            'action' => "Onboarded staff account: {$name} ({$role})",
        ]);

        return response()->json([
            'success' => true,
            'user' => $user,
        ], 201);
    }

    public function updateUser(Request $request, $id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $data = $request->only([
            'name', 'phone', 'address', 'civil_status', 'role', 'status',
            'verification_status', 'barangay', 'employee_id', 'job_title', 'rejection_reason'
        ]);

        if ($request->has('password') && !empty($request->input('password'))) {
            $data['password_hash'] = Hash::make($request->input('password'));
        }

        $user->update($data);

        return response()->json([
            'success' => true,
            'user' => $user,
        ]);
    }

    public function updateProfile(Request $request)
    {
        $email = strtolower(trim((string)$request->input('email', '')));
        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();
        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $data = [];
        if ($request->has('name')) $data['name'] = $request->input('name');
        if ($request->has('phone')) $data['phone'] = $request->input('phone');
        if ($request->has('address')) $data['address'] = $request->input('address');
        if ($request->has('civil_status')) $data['civil_status'] = $request->input('civil_status');

        if ($request->has('profile_photo')) {
            $data['profile_photo'] = self::saveBase64Image($request->input('profile_photo'), 'profile');
        }
        if ($request->has('submitted_id')) {
            $data['submitted_id'] = self::saveBase64Image($request->input('submitted_id'), 'id');
        }

        if ($request->has('new_password') && !empty($request->input('new_password'))) {
            $comp = self::validatePasswordComplexity($request->input('new_password'));
            if (!$comp['isValid']) {
                return response()->json(['error' => $comp['message']], 400);
            }
            $data['password_hash'] = Hash::make($request->input('new_password'));
        }

        $user->update($data);

        // Update linked resident
        $resident = Resident::whereRaw('LOWER(email) = ?', [$email])->first();
        if ($resident) {
            $resData = [];
            if (isset($data['phone'])) $resData['phone'] = $data['phone'];
            if (isset($data['address'])) $resData['address'] = $data['address'];
            if (isset($data['civil_status'])) $resData['civil_status'] = $data['civil_status'];
            if (isset($data['submitted_id'])) $resData['submitted_id'] = $data['submitted_id'];
            $resident->update($resData);
        }

        return response()->json([
            'success' => true,
            'user' => $user,
        ]);
    }

    public function resetPassword(Request $request, $id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $newPass = $request->input('new_password', 'Password123!');
        $user->update(['password_hash' => Hash::make($newPass)]);

        ActivityLog::create([
            'user_name' => 'Admin',
            'user_role' => 'admin',
            'action' => "Reset password for user: {$user->email}",
        ]);

        return response()->json(['success' => true, 'message' => 'Password reset successfully']);
    }

    public function deleteUser($id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $user->update(['status' => 'Archived']);

        ActivityLog::create([
            'user_name' => 'Admin',
            'user_role' => 'admin',
            'action' => "Archived user: {$user->name} ({$user->email})",
        ]);

        return response()->json(['success' => true, 'message' => 'User archived successfully']);
    }
}
