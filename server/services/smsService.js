import dotenv from 'dotenv';
dotenv.config();

const IPROG_API_TOKEN = process.env.IPROG_SMS_API_TOKEN || 'c54932a5cb3127cb6fecb3cfc20b14a9c399305b';
const IPROG_API_URL = process.env.IPROG_SMS_API_URL || 'https://www.iprogsms.com/api/v1/sms_messages';

/**
 * Standardize Philippine mobile numbers to valid 11-digit 09xxxxxxxxx or international format
 */
export function formatPhoneNumber(rawPhone) {
  if (!rawPhone) return '09171234567';
  // Remove non-numeric characters except leading +
  let cleaned = String(rawPhone).replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+63')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('63') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(2);
  }

  // Ensure 11 digits format e.g. 09171234567
  if (!cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '0' + cleaned;
  }

  return cleaned;
}

/**
 * Send real-time live SMS via iProgTech SMS Gateway API
 * @param {string} rawPhone - Recipient phone number (e.g. 09171234567)
 * @param {string} message - Text content to send
 * @returns {Promise<{success: boolean, messageId?: string, status?: number, error?: string, raw?: any}>}
 */
export async function sendLiveSms(rawPhone, message) {
  const phone = formatPhoneNumber(rawPhone);

  if (!IPROG_API_TOKEN) {
    console.warn('⚠️ [iProg SMS] No API token configured. SMS logged in simulation mode.');
    return { success: false, error: 'No API token configured' };
  }

  try {
    const payload = {
      api_token: IPROG_API_TOKEN,
      phone_number: phone,
      message: message
    };

    console.log(`📡 [iProg SMS] Dispatching to ${phone}...`);

    const response = await fetch(IPROG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.status === 200 || data.message?.includes('queued') || data.message_id) {
      console.log(`✅ [iProg SMS] Sent successfully to ${phone}! Message ID: ${data.message_id || 'N/A'}`);
      return {
        success: true,
        messageId: data.message_id,
        status: data.status || 200,
        raw: data
      };
    } else {
      console.warn(`⚠️ [iProg SMS] Gateway responded with notice:`, data);
      return {
        success: false,
        error: data.message || 'Gateway response error',
        raw: data
      };
    }
  } catch (error) {
    console.error(`❌ [iProg SMS] Network Error dispatching SMS to ${phone}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
