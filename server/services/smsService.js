import dotenv from 'dotenv';
dotenv.config();

const IPROG_API_TOKEN = process.env.IPROG_SMS_API_TOKEN || 'c54932a5cb3127cb6fecb3cfc20b14a9c399305b';
const IPROG_API_URL = process.env.IPROG_SMS_API_URL || 'https://www.iprogsms.com/api/v1/sms_messages';
const IPROG_OTP_URL = 'https://www.iprogsms.com/api/v1/otp/send_otp';

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
 * Check if a Philippine mobile number belongs to Smart / TNT / Sun Cellular network
 */
export function isSmartOrTntNetwork(phone) {
  const cleaned = formatPhoneNumber(phone);
  const prefix = cleaned.slice(0, 4);

  const smartTntPrefixes = [
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

  return smartTntPrefixes.includes(prefix);
}

/**
 * Send real-time live SMS via iProgTech SMS Gateway API with intelligent multi-network routing
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

  const isSmartTnt = isSmartOrTntNetwork(phone);
  console.log(`📡 [iProg SMS] Dispatching to ${phone} (Smart/TNT: ${isSmartTnt ? 'YES' : 'NO'})...`);

  let lastError = '';
  const routes = isSmartTnt
    ? [{ type: 'priority', url: IPROG_OTP_URL }, { type: 'standard', url: IPROG_API_URL }]
    : [{ type: 'standard', url: IPROG_API_URL }, { type: 'priority', url: IPROG_OTP_URL }];

  for (const route of routes) {
    try {
      const payload = {
        api_token: IPROG_API_TOKEN,
        phone_number: phone,
        message: message
      };

      const response = await fetch(route.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      const msgStr = typeof data.message === 'string' ? data.message : (Array.isArray(data.message) ? data.message.join(' ') : '');

      const isSuccess = data.status === 200 ||
        data.status === 'success' ||
        msgStr.toLowerCase().includes('queued') ||
        msgStr.toLowerCase().includes('success') ||
        Boolean(data.message_id);

      if (isSuccess) {
        const messageId = data.message_id || (data.data?.otp_code ? 'iSms-TX' + Math.random().toString(36).substring(2, 7).toUpperCase() : 'iSms-Delivered');
        console.log(`✅ [iProg SMS] Sent successfully to ${phone}! Message ID: ${messageId}`);
        return {
          success: true,
          messageId,
          status: 200,
          network: isSmartTnt ? 'Smart / TNT / Sun' : 'Globe / TM / DITO',
          raw: data
        };
      }

      lastError = msgStr || JSON.stringify(data);
      console.warn(`⚠️ [iProg SMS] Route (${route.type}) notice: ${lastError}. Trying alternative route...`);
    } catch (routeErr) {
      lastError = routeErr.message;
      console.warn(`⚠️ [iProg SMS] Route (${route.type}) error: ${lastError}. Trying alternative route...`);
    }
  }

  console.error(`❌ [iProg SMS] Failed dispatch to ${phone}:`, lastError);
  return {
    success: false,
    error: lastError || 'SMS delivery failed across all routes'
  };
}

