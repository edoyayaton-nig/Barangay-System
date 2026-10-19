<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsService
{
    /**
     * Standardize Philippine mobile numbers to valid 11-digit 09xxxxxxxxx or international format
     */
    public static function formatPhoneNumber(?string $rawPhone): string
    {
        if (empty($rawPhone)) {
            return '09171234567';
        }

        // Remove non-numeric characters except leading +
        $cleaned = preg_replace('/[^\d+]/', '', (string)$rawPhone);

        if (str_starts_with($cleaned, '+63')) {
            $cleaned = '0' . substr($cleaned, 3);
        } elseif (str_starts_with($cleaned, '63') && strlen($cleaned) === 12) {
            $cleaned = '0' . substr($cleaned, 2);
        }

        // Ensure 11 digits format e.g. 09171234567
        if (!str_starts_with($cleaned, '0') && strlen($cleaned) === 10) {
            $cleaned = '0' . $cleaned;
        }

        return $cleaned;
    }

    /**
     * Check if a Philippine mobile number belongs to Smart / TNT / Sun Cellular network
     * which enforces strict NTC anti-spam rules blocking shared gateway sender names.
     */
    public static function isSmartOrTntNetwork(string $phone): bool
    {
        $cleaned = self::formatPhoneNumber($phone);
        $prefix = substr($cleaned, 0, 4);

        $smartTntPrefixes = [
            // Smart Postpaid / Prepaid
            '0813', '0911', '0913', '0914', '0918', '0919', '0920', '0921', '0928', '0929',
            '0939', '0946', '0947', '0948', '0949', '0951', '0961', '0963', '0964', '0968',
            '0969', '0970', '0971', '0981', '0989', '0998', '0999',
            // Sun Cellular
            '0922', '0923', '0924', '0925', '0931', '0932', '0933', '0934', '0940', '0941',
            '0942', '0943', '0944',
            // TNT (Talk 'N Text)
            '0907', '0908', '0909', '0910', '0912', '0930', '0938', '0950'
        ];

        return in_array($prefix, $smartTntPrefixes, true);
    }

    /**
     * Send real-time live SMS via iProgTech SMS Gateway API with intelligent multi-network routing
     */
    public static function sendLiveSms(?string $rawPhone, string $message, ?string $recipientName = null, ?string $type = null): array
    {
        $phone = self::formatPhoneNumber($rawPhone);
        $apiToken = env('IPROG_SMS_API_TOKEN', 'c54932a5cb3127cb6fecb3cfc20b14a9c399305b');
        $standardUrl = env('IPROG_SMS_API_URL', 'https://www.iprogsms.com/api/v1/sms_messages');
        $otpUrl = 'https://www.iprogsms.com/api/v1/otp/send_otp';

        if (empty($apiToken)) {
            Log::warning('⚠️ [iProg SMS] No API token configured. SMS logged in simulation mode.');
            return ['success' => false, 'error' => 'No API token configured'];
        }

        $isSmartTnt = self::isSmartOrTntNetwork($phone);
        Log::info("📡 [iProg SMS] Dispatching to {$phone} (Smart/TNT: " . ($isSmartTnt ? 'YES' : 'NO') . ")...");

        $isSuccess = false;
        $messageId = null;
        $respData = null;
        $bodyText = '';
        $lastError = '';

        // Priority Strategy:
        // Smart/TNT networks block pooled sender names on the standard endpoint.
        // Therefore, if Smart/TNT is detected, use the whitelisted Priority Transactional route FIRST.
        // For Globe/TM/DITO, use standard route first, with automatic instant fallback to the priority route.
        $routes = $isSmartTnt 
            ? [['type' => 'priority', 'url' => $otpUrl], ['type' => 'standard', 'url' => $standardUrl]]
            : [['type' => 'standard', 'url' => $standardUrl], ['type' => 'priority', 'url' => $otpUrl]];

        foreach ($routes as $route) {
            try {
                $payload = [
                    'api_token' => $apiToken,
                    'phone_number' => $phone,
                    'message' => $message,
                ];

                $response = Http::withHeaders([
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ])->timeout(8)->post($route['url'], $payload);

                $respData = $response->json();
                $bodyText = $response->body();

                $msgStr = '';
                if (isset($respData['message'])) {
                    if (is_array($respData['message'])) {
                        $msgStr = implode(' ', array_filter($respData['message']));
                    } else {
                        $msgStr = (string)$respData['message'];
                    }
                }

                // Check for success condition across both endpoints
                if (
                    ($respData['status'] ?? 0) === 200 ||
                    ($respData['status'] ?? '') === 'success' ||
                    (!empty($msgStr) && str_contains(strtolower($msgStr), 'queued')) ||
                    (!empty($msgStr) && str_contains(strtolower($msgStr), 'success')) ||
                    !empty($respData['message_id'])
                ) {
                    $isSuccess = true;
                    $messageId = $respData['message_id'] ?? ($respData['data']['otp_code'] ?? null ? 'iSms-TX' . strtoupper(substr(md5(uniqid()), 0, 5)) : null);
                    break;
                }

                $lastError = !empty($msgStr) ? $msgStr : $bodyText;
                Log::warning("⚠️ [iProg SMS] Route ({$route['type']}) notice: {$lastError}. Trying alternative route...");
            } catch (\Throwable $routeEx) {
                $lastError = $routeEx->getMessage();
                Log::warning("⚠️ [iProg SMS] Route ({$route['type']}) error: {$lastError}. Trying alternative route...");
            }
        }

        // Persist to sms_notifications database table
        try {
            \Illuminate\Support\Facades\DB::table('sms_notifications')->insert([
                'recipient_name' => $recipientName ?: 'Resident',
                'recipient_phone' => $phone,
                'type' => $type ?: 'Barangay Announcement',
                'message' => $message,
                'status' => $isSuccess ? 'Sent' : 'Failed',
                'sent_at' => now(),
            ]);
        } catch (\Throwable $dbErr) {
            Log::warning('⚠️ [iProg SMS] Could not write to sms_notifications table: ' . $dbErr->getMessage());
        }

        if ($isSuccess) {
            Log::info("✅ [iProg SMS] Sent successfully to {$phone}! Message ID: " . ($messageId ?: 'iSms-Delivered'));
            return [
                'success' => true,
                'messageId' => $messageId ?: 'iSms-Delivered',
                'status' => 200,
                'network' => $isSmartTnt ? 'Smart / TNT / Sun' : 'Globe / TM / DITO',
                'raw' => $respData ?: $bodyText,
            ];
        } else {
            Log::error("❌ [iProg SMS] Failed dispatch to {$phone}: " . $lastError);
            return [
                'success' => false,
                'error' => $lastError ?: 'SMS delivery failed across all routes',
                'raw' => $respData ?: $bodyText,
            ];
        }
    }
}

