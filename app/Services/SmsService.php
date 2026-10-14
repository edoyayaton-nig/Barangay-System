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
     * Send real-time live SMS via iProgTech SMS Gateway API
     */
    public static function sendLiveSms(?string $rawPhone, string $message): array
    {
        $phone = self::formatPhoneNumber($rawPhone);
        $apiToken = env('IPROG_SMS_API_TOKEN', 'c54932a5cb3127cb6fecb3cfc20b14a9c399305b');
        $apiUrl = env('IPROG_SMS_API_URL', 'https://www.iprogsms.com/api/v1/sms_messages');

        if (empty($apiToken)) {
            Log::warning('⚠️ [iProg SMS] No API token configured. SMS logged in simulation mode.');
            return ['success' => false, 'error' => 'No API token configured'];
        }

        try {
            $payload = [
                'api_token' => $apiToken,
                'phone_number' => $phone,
                'message' => $message,
            ];

            Log::info("📡 [iProg SMS] Dispatching to {$phone}...");

            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])->timeout(8)->post($apiUrl, $payload);

            $data = $response->json();
            $bodyText = $response->body();

            $msgStr = '';
            if (isset($data['message'])) {
                $msgStr = is_string($data['message']) ? $data['message'] : json_encode($data['message']);
            }

            if (
                ($data['status'] ?? 0) === 200 ||
                (!empty($msgStr) && str_contains(strtolower($msgStr), 'queued')) ||
                (!empty($msgStr) && str_contains(strtolower($msgStr), 'success')) ||
                !empty($data['message_id'])
            ) {
                Log::info("✅ [iProg SMS] Sent successfully to {$phone}! Message ID: " . ($data['message_id'] ?? 'N/A'));
                return [
                    'success' => true,
                    'messageId' => $data['message_id'] ?? null,
                    'status' => $data['status'] ?? 200,
                    'raw' => $data ?: $bodyText,
                ];
            } else {
                Log::warning('⚠️ [iProg SMS] Gateway responded with notice: ' . ($msgStr ?: $bodyText));
                return [
                    'success' => false,
                    'error' => !empty($msgStr) ? $msgStr : ($bodyText ?: 'Gateway response error'),
                    'raw' => $data ?: $bodyText,
                ];
            }
        } catch (\Throwable $e) {
            Log::error("❌ [iProg SMS] Network Error dispatching SMS to {$phone}: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
