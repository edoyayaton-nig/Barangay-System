<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EmailService
{
    public static function getBarangayName(?string $barangay = null): string
    {
        return $barangay ?: env('VITE_BARANGAY_NAME', env('BARANGAY_NAME', 'Barangay Pianing'));
    }

    public static function sendEmail(array $params): array
    {
        $to = $params['to'] ?? '';
        $subject = $params['subject'] ?? '';
        $text = $params['text'] ?? '';
        $recipientName = $params['recipientName'] ?? '';
        $barangay = self::getBarangayName($params['barangay'] ?? null);

        if (empty($to)) {
            return ['success' => false, 'error' => 'Recipient email is required'];
        }

        // Try EmailJS if configured
        $emailJsRes = self::sendViaEmailJs($params);
        if ($emailJsRes && ($emailJsRes['success'] ?? false)) {
            return $emailJsRes;
        }

        // Try Laravel Mail if configured
        try {
            if (env('MAIL_USERNAME') && env('MAIL_PASSWORD')) {
                Mail::raw($text, function ($message) use ($to, $subject, $recipientName, $barangay) {
                    $message->to($to, $recipientName ?: $to)
                        ->subject($subject);
                });
                Log::info("📧 [Email – LIVE SMTP] Sent successfully to {$to} | {$subject}");
                return ['success' => true, 'provider' => 'smtp', 'messageId' => 'smtp_' . uniqid()];
            }
        } catch (\Throwable $e) {
            Log::warning("⚠️ [Email – SMTP Error] " . $e->getMessage());
        }

        // Simulation mode fallback
        Log::info("📧 [Email – SIMULATION] To: {$to} | Subject: {$subject}\n   Body: {$text}");
        return [
            'success' => true,
            'simulated' => true,
            'provider' => 'simulation',
            'message' => 'Logged in simulation mode (configure SMTP or EmailJS in .env for live dispatch)',
        ];
    }

    public static function sendViaEmailJs(array $params): ?array
    {
        $publicKey = env('VITE_EMAILJS_PUBLIC_KEY', env('EMAILJS_PUBLIC_KEY', 'rSYz738xJ3j-_8e-2'));
        if (empty($publicKey)) {
            return null;
        }

        $serviceId = env('VITE_EMAILJS_SERVICE_ID', env('EMAILJS_SERVICE_ID', 'service_dfjlsa5'));
        $templateId = env('VITE_EMAILJS_TEMPLATE_ID', env('EMAILJS_TEMPLATE_ID', 'template_fnn902a'));
        $privateKey = env('VITE_EMAILJS_PRIVATE_KEY', env('EMAILJS_PRIVATE_KEY', 'DvEOjZ67lbtllP8EJTkP4'));
        $barangay = self::getBarangayName($params['barangay'] ?? null);
        $to = $params['to'];
        $recipientName = $params['recipientName'] ?? $to;
        $subject = $params['subject'] ?? '';
        $text = $params['text'] ?? $subject;

        try {
            $payload = [
                'service_id' => $serviceId,
                'template_id' => $templateId,
                'user_id' => $publicKey,
                'template_params' => [
                    'to_name' => $recipientName,
                    'to_email' => $to,
                    'email' => $to,
                    'name' => $recipientName,
                    'title' => $subject,
                    'subject' => $subject,
                    'message' => $text,
                    'time' => date('Y-m-d H:i:s'),
                    'barangay_name' => $barangay,
                    'from_name' => "{$barangay} Administration",
                ],
            ];

            if (!empty($privateKey)) {
                $payload['accessToken'] = $privateKey;
            }

            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
                'origin' => 'http://localhost',
            ])->timeout(8)->post('https://api.emailjs.com/api/v1.0/email/send', $payload);

            if ($response->successful()) {
                Log::info("✅ [Email – EmailJS] Sent successfully to {$to} via template {$templateId}");
                return ['success' => true, 'provider' => 'emailjs'];
            }
        } catch (\Throwable $e) {
            Log::warning("⚠️ [Email – EmailJS Error] " . $e->getMessage());
        }

        return null;
    }

    public static function sendDocumentStatusEmail(string $email, string $name, string $docType, string $requestCode, string $status, ?string $remarks = null, ?string $barangay = null): array
    {
        $brgy = self::getBarangayName($barangay);
        $subject = "[{$brgy}] Document Request Update – {$requestCode}";
        $text = "Dear {$name}, your {$docType} ({$requestCode}) status has been updated to: {$status}." . ($remarks ? " Remarks: {$remarks}" : "");
        return self::sendEmail(['to' => $email, 'subject' => $subject, 'text' => $text, 'recipientName' => $name, 'barangay' => $brgy]);
    }

    public static function sendRegistrationEmail(string $email, string $name, ?string $barangay = null): array
    {
        $brgy = self::getBarangayName($barangay);
        $subject = "[{$brgy}] Your Account Has Been Created";
        $text = "Welcome {$name}! Your resident account has been created. Email: {$email}. Status: Pending Verification.";
        return self::sendEmail(['to' => $email, 'subject' => $subject, 'text' => $text, 'recipientName' => $name, 'barangay' => $brgy]);
    }

    public static function sendVerificationNoticeEmail(string $email, string $name, string $status, ?string $reason = null, ?string $barangay = null): array
    {
        $brgy = self::getBarangayName($barangay);
        if ($status === 'Verified') {
            $subject = "[{$brgy}] Account Verified — Services Unlocked";
            $text = "Welcome {$name}! Your Barangay account has been VERIFIED. You can now access all services online.";
        } else {
            $subject = "[{$brgy}] Account Verification Update";
            $text = "Dear {$name}, your account verification status is {$status}." . ($reason ? " Reason: {$reason}" : "");
        }
        return self::sendEmail(['to' => $email, 'subject' => $subject, 'text' => $text, 'recipientName' => $name, 'barangay' => $brgy]);
    }

    public static function sendAnnouncementEmail(array|string $recipients, string $title, string $message, string $severity = 'Info', ?string $barangay = null): array
    {
        $brgy = self::getBarangayName($barangay);
        $subject = "[{$brgy} Advisory] {$title}";
        $recArray = is_array($recipients) ? $recipients : explode(',', $recipients);
        $results = [];
        foreach ($recArray as $rec) {
            $email = trim($rec);
            if (!empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $results[] = self::sendEmail(['to' => $email, 'subject' => $subject, 'text' => $message, 'barangay' => $brgy]);
            }
        }
        return ['success' => true, 'count' => count($results)];
    }

    public static function sendAppointmentStatusEmail(string $email, string $name, string $serviceType, string $date, string $time, string $status, ?string $notes = null, ?string $barangay = null): array
    {
        $brgy = self::getBarangayName($barangay);
        $subject = "[{$brgy} Clinic] Appointment {$status} – {$serviceType}";
        $text = "Dear {$name}, your clinic appointment for {$serviceType} on {$date} ({$time}) is {$status}." . ($notes ? " Notes: {$notes}" : "");
        return self::sendEmail(['to' => $email, 'subject' => $subject, 'text' => $text, 'recipientName' => $name, 'barangay' => $brgy]);
    }

    public static function sendDirectNotificationEmail(string $email, string $name, string $title, string $message, ?string $barangay = null): array
    {
        $brgy = self::getBarangayName($barangay);
        return self::sendEmail(['to' => $email, 'subject' => "[{$brgy}] {$title}", 'text' => $message, 'recipientName' => $name, 'barangay' => $brgy]);
    }

    public static function sendProfileUpdateEmail(string $email, string $name, string $field, ?string $barangay = null): array
    {
        $brgy = self::getBarangayName($barangay);
        return self::sendEmail([
            'to' => $email,
            'subject' => "[{$brgy}] Profile Updated",
            'text' => "Hello {$name}, your profile ({$field}) was updated successfully.",
            'recipientName' => $name,
            'barangay' => $brgy,
        ]);
    }
}
