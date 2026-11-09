import emailjs from '@emailjs/browser';
import { notificationStore } from './notificationStore';
import { apiService } from './api';

// ─────────────────────────────────────────────────────────────────────────────
// EmailJS Service – Barangay Pianing Smart System
// Service ID: service_6nk2ylj (Configured)
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
}

const DEFAULT_CONFIG: EmailJsConfig = {
  serviceId: (import.meta as any).env?.VITE_EMAILJS_SERVICE_ID || 'service_dfjlsa5',
  templateId: (import.meta as any).env?.VITE_EMAILJS_TEMPLATE_ID || 'template_fnn902a',
  publicKey: (import.meta as any).env?.VITE_EMAILJS_PUBLIC_KEY || 'rSYz738xJ3j-_8e-2'
};

// Retrieve configuration (strictly scoped per barangay jurisdiction)
export function getEmailJsConfig(barangayName?: string): EmailJsConfig {
  try {
    let target = barangayName;
    if (!target) {
      try {
        const uStr = localStorage.getItem('barangay_user');
        if (uStr) {
          const u = JSON.parse(uStr);
          if (u?.barangay) target = u.barangay;
        }
      } catch {}
    }

    if (target) {
      const cleanBrgy = target.replace(/^Barangay\s+/i, '').trim().toLowerCase();
      // 1. Check barangay-specific emailjs_config cache
      const brgySaved = localStorage.getItem(`emailjs_config_${cleanBrgy}`);
      if (brgySaved) {
        const parsed = JSON.parse(brgySaved);
        if (parsed.serviceId || parsed.templateId || parsed.publicKey) {
          return {
            serviceId: parsed.serviceId || '',
            templateId: parsed.templateId || '',
            publicKey: parsed.publicKey || '',
          };
        }
      }

      // 2. Check barangay-specific notification settings cache
      const notifSaved = localStorage.getItem(`barangay_notification_settings_${cleanBrgy}`);
      if (notifSaved) {
        const parsed = JSON.parse(notifSaved);
        if (parsed.emailjs_service_id || parsed.emailjs_template_id || parsed.emailjs_public_key) {
          return {
            serviceId: parsed.emailjs_service_id || '',
            templateId: parsed.emailjs_template_id || '',
            publicKey: parsed.emailjs_public_key || '',
          };
        }
      }

      // 3. Fallback to DEFAULT_CONFIG so all 4 accounts (Superadmin, Admin, Nurse, BHW) work seamlessly
      return DEFAULT_CONFIG;
    }
  } catch {}
  return DEFAULT_CONFIG;
}

export function saveEmailJsConfig(config: Partial<EmailJsConfig>, barangayName?: string) {
  let target = barangayName;
  if (!target) {
    try {
      const uStr = localStorage.getItem('barangay_user');
      if (uStr) {
        const u = JSON.parse(uStr);
        if (u?.barangay) target = u.barangay;
      }
    } catch {}
  }
  const cleanBrgy = (target || 'pianing').replace(/^Barangay\s+/i, '').trim().toLowerCase();
  const current = getEmailJsConfig(cleanBrgy);
  const updated = { ...current, ...config };
  localStorage.setItem(`emailjs_config_${cleanBrgy}`, JSON.stringify(updated));
  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Send Method (supports both @emailjs/browser SDK and REST API fallback)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendEmailNotification(params: {
  to_name: string;
  to_email: string;
  subject: string;
  message: string;
  barangay?: string;
  status?: string;
  request_code?: string;
  document_type?: string;
}): Promise<{ success: boolean; message: string }> {
  const config = getEmailJsConfig(params.barangay);

  if (!params.to_email || !params.to_email.includes('@')) {
    return { success: false, message: 'Invalid recipient email address' };
  }

  const effectivePublicKey = (config.publicKey || (import.meta as any).env?.VITE_EMAILJS_PUBLIC_KEY || '').trim();

  if (!config.templateId || !config.serviceId || !effectivePublicKey) {
    console.info('ℹ️ [EmailJS] External email dispatch skipped (Public Key not configured in .env). Notifications are saved in-app.');
    return { success: false, message: 'EmailJS Public Key not configured. In-app notification recorded.' };
  }

  // Variable names match your EmailJS "Contact Us" template EXACTLY
  const templateParams = {
    name:          params.to_name || 'Resident',
    email:         params.to_email.trim().toLowerCase(),
    to_email:      params.to_email.trim().toLowerCase(),
    title:         params.subject,
    message:       params.message,
    time:          new Date().toLocaleString('en-PH', {
                     year: 'numeric', month: 'long', day: 'numeric',
                     hour: '2-digit', minute: '2-digit'
                   }),
    barangay:      params.barangay || 'Barangay Pianing',
    status:        params.status || '',
    request_code:  params.request_code || '',
    document_type: params.document_type || '',
    from_name:     'Barangay Pianing Administration',
  };

  try {
    // 1. Primary: Use @emailjs/browser
    const response = await emailjs.send(
      config.serviceId,
      config.templateId,
      templateParams,
      effectivePublicKey
    );
    console.log('✅ [EmailJS] Email dispatched successfully:', response.status, response.text);
    return { success: true, message: 'Email sent successfully via EmailJS!' };
  } catch (sdkError: any) {
    console.warn('⚠️ [EmailJS SDK] SDK send error, trying REST API fallback...', sdkError?.text || sdkError?.message);

    // 2. Fallback: Direct EmailJS REST endpoint
    try {
      const restRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: config.serviceId,
          template_id: config.templateId,
          user_id: effectivePublicKey,
          template_params: templateParams,
        })
      });

      if (restRes.ok) {
        console.log('✅ [EmailJS REST] Email dispatched successfully!');
        return { success: true, message: 'Email sent via EmailJS REST API!' };
      } else {
        const errorText = await restRes.text();
        console.warn('❌ [EmailJS REST] Error response:', errorText);
        return {
          success: false,
          message: `EmailJS response: ${errorText || 'Check your Template ID and Public Key'}`
        };
      }
    } catch (restError: any) {
      console.error('❌ [EmailJS] Dispatch failed:', restError);
      return { success: false, message: restError?.message || 'Email delivery failed' };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Specific Automated Trigger Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Send Account Approval Email when Admin verifies resident
 */
export async function sendResidentApprovalEmail(resident: {
  name: string;
  email: string;
  barangay?: string;
}) {
  return sendEmailNotification({
    to_name: resident.name,
    to_email: resident.email,
    subject: `✅ Your Barangay ${resident.barangay || 'Pianing'} Account is Approved & Verified`,
    message: `Mabuhay ${resident.name}! Your Barangay resident account has been reviewed and officially VERIFIED by the Barangay Administration. You can now log in to the portal to request Barangay Clearances, Residency Certificates, and access health appointments online.`,
    status: 'Verified',
    barangay: resident.barangay || 'Pianing'
  });
}

/**
 * 2. Send Correction / Resubmission Notice when Admin flags ID discrepancy
 */
export async function sendResidentCorrectionEmail(applicant: {
  name: string;
  email: string;
  barangay?: string;
  reason: string;
}) {
  return sendEmailNotification({
    to_name: applicant.name,
    to_email: applicant.email,
    subject: `⚠️ Notice: ID Correction / Resubmission Required for Your Account Application`,
    message: `Hello ${applicant.name}, your account registration for Barangay ${applicant.barangay || 'Pianing'} requires revision before it can be verified. Discrepancy details: "${applicant.reason}". Please log in to your portal account to resubmit a clear copy of your valid Government ID.`,
    status: 'Needs Correction',
    barangay: applicant.barangay || 'Pianing'
  });
}

/**
 * 3. Send Document Status Update (Ready for Pickup, Approved, Completed)
 */
export async function sendDocumentReadyEmail(doc: {
  resident_name: string;
  resident_email?: string;
  document_type: string;
  request_code: string;
  status: string;
  barangay?: string;
}) {
  if (!doc.resident_email) return { success: false, message: 'No email attached to document' };

  let statusMsg = '';
  if (doc.status === 'Ready for Pickup') {
    statusMsg = `Your requested ${doc.document_type} (Tracking Code: ${doc.request_code}) is now PRINTED and READY FOR PICKUP at the Barangay Hall. Please bring a valid ID and the required processing fee when claiming.`;
  } else if (doc.status === 'Completed') {
    statusMsg = `Your ${doc.document_type} (Tracking Code: ${doc.request_code}) has been officially claimed and marked as COMPLETED. Thank you!`;
  } else {
    statusMsg = `Your ${doc.document_type} (Tracking Code: ${doc.request_code}) is now in status: ${doc.status}.`;
  }

  return sendEmailNotification({
    to_name: doc.resident_name,
    to_email: doc.resident_email,
    subject: `📄 [Barangay Pianing] Update on ${doc.document_type} (${doc.request_code})`,
    message: statusMsg,
    status: doc.status,
    request_code: doc.request_code,
    document_type: doc.document_type,
    barangay: doc.barangay || 'Pianing'
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. iProg SMS Gateway Integration
// API Key: c54932a5cb3127cb6fecb3cfc20b14a9c399305b
// ─────────────────────────────────────────────────────────────────────────────
export const IPROG_SMS_TOKEN = 'c54932a5cb3127cb6fecb3cfc20b14a9c399305b';
export const IPROG_SMS_URL = 'https://www.iprogsms.com/api/v1/sms_messages';
export const IPROG_OTP_URL = 'https://www.iprogsms.com/api/v1/otp/send_otp';

export function formatPhilippineMobile(raw?: string): string {
  if (!raw) return '';
  let cleaned = String(raw).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+63')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.startsWith('63') && cleaned.length === 12) cleaned = '0' + cleaned.slice(2);
  if (!cleaned.startsWith('0') && cleaned.length === 10) cleaned = '0' + cleaned;
  return cleaned;
}

export function isSmartOrTntNetwork(phone?: string): boolean {
  const cleaned = formatPhilippineMobile(phone);
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

export async function sendLiveSmsNotification(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cleanPhone = formatPhilippineMobile(phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: 'Invalid Philippine phone number' };
  }

  // 1. Primary: Use local Laravel proxy to prevent CORS issues in browser
  try {
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone, message }),
    });
    const data = await res.json();
    if (data.success || data.status === 200 || (data.message && typeof data.message === 'string' && data.message.includes('queued')) || data.messageId || data.message_id) {
      console.log(`✅ [iProg SMS Proxy] Successfully sent to ${cleanPhone}:`, data);
      return { success: true, messageId: data.messageId || data.message_id || 'iSms-Delivered' };
    }
    if (data.error || data.message) {
      const errMsg = typeof data.error === 'string' ? data.error : (typeof data.message === 'string' ? data.message : JSON.stringify(data.error || data.message));
      console.warn(`⚠️ [iProg SMS Proxy Warning]:`, errMsg);
    }
  } catch (backendErr) {
    console.warn('⚠️ [iProg SMS Proxy] Retrying with direct gateway...', backendErr);
  }

  // 2. Direct Gateway Fallback with Multi-Network Routing
  const isSmart = isSmartOrTntNetwork(cleanPhone);
  const directUrls = isSmart 
    ? [IPROG_OTP_URL, IPROG_SMS_URL] 
    : [IPROG_SMS_URL, IPROG_OTP_URL];

  let lastDirectError = '';
  for (const url of directUrls) {
    try {
      const directRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          api_token: IPROG_SMS_TOKEN,
          phone_number: cleanPhone,
          message,
        }),
      });
      const data = await directRes.json();
      const msgStr = typeof data.message === 'string' ? data.message : (Array.isArray(data.message) ? data.message.join(' ') : '');
      const isSuccess = data.status === 200 ||
        data.status === 'success' ||
        msgStr.toLowerCase().includes('queued') ||
        msgStr.toLowerCase().includes('success') ||
        Boolean(data.message_id);

      if (isSuccess) {
        const messageId = data.message_id || (data.data?.otp_code ? 'iSms-TX' + Math.random().toString(36).substring(2, 7).toUpperCase() : 'iSms-Delivered');
        console.log(`✅ [iProg SMS Direct] Successfully sent to ${cleanPhone}:`, data);
        return { success: true, messageId };
      }
      lastDirectError = msgStr || JSON.stringify(data);
    } catch (directErr: any) {
      lastDirectError = directErr?.message || 'Network error';
    }
  }

  console.warn('❌ [iProg SMS Direct Error]:', lastDirectError);
  return { success: false, error: lastDirectError || 'SMS gateway rejected' };
}


/**
 * 5. Unified Resident Notification Dispatcher
 * Records persistent In-App notification, and strictly enforces the Single-Transaction Credit Conservation Policy:
 * - Account: Only dispatches external Email/SMS ONCE upon official Verification (Approved) or Decline (Rejected).
 * - Document: Only dispatches external Email/SMS ONCE when document is 'Ready for Pickup' (or Rejected).
 * - Health (Nurse/BHW): Only dispatches external Email/SMS ONCE when the appointment/service is 'Completed' (or Cancelled).
 * - Backend Deduplication: If externalDispatchedByBackend is true, skips client-side Email/SMS to prevent dual credit consumption.
 */
export async function dispatchResidentNotification(params: {
  residentEmail: string;
  residentName?: string;
  phone?: string;
  type?: 'account' | 'document' | 'health' | 'system' | 'verification';
  title: string;
  message: string;
  statusBadge?: string;
  badgeColor?: 'red' | 'amber' | 'blue' | 'indigo' | 'emerald' | 'slate';
  refCode?: string;
  barangay?: string;
  sendEmail?: boolean;
  sendSms?: boolean;
  externalDispatchedByBackend?: boolean;
}): Promise<{ inApp: boolean; email: boolean; sms: boolean; error?: string }> {
  let inAppSuccess = false;
  let emailSuccess = false;
  let smsSuccess = false;
  let dispatchError: string | undefined = undefined;
  const cleanEmail = (params.residentEmail || '').toLowerCase().trim();
  const rawStatus = (params.statusBadge || '').toLowerCase().trim();

  // 1. In-App Notification (Always recorded in resident's Notification Center & MySQL DB for audit tracking)
  if (cleanEmail) {
    try {
      notificationStore.addNotification(cleanEmail, {
        type: params.type || 'system',
        title: params.title,
        message: params.message,
        status_badge: params.statusBadge || 'Update',
        badge_color: params.badgeColor || 'indigo',
        ref_code: params.refCode,
      });
      inAppSuccess = true;
    } catch (inAppErr) {
      console.warn('⚠️ [NotificationStore] Failed to record in-app notification:', inAppErr);
    }

    try {
      // NOTE: send_sms is omitted/false here so that backend does NOT trigger a second SMS!
      await apiService.sendNotification({
        recipient_email: cleanEmail,
        recipient_phone: params.phone,
        recipient_name: params.residentName,
        title: params.title,
        message: params.message,
        type: params.type || 'system',
        ref_code: params.refCode,
        barangay: params.barangay || 'Pianing'
      }).catch(() => {});
      inAppSuccess = true;
    } catch (dbErr) {
      console.warn('⚠️ [apiService] Failed to persist notification to MySQL DB:', dbErr);
    }
  }

  // 2. Single-Transaction Credit Conservation Policy Gate
  let isExternalEligible = true;

  if (params.type === 'account' || params.type === 'verification') {
    // Only send on official verification (Approved) or rejection (Declined/Action Needed). NEVER on registration/creation.
    const validAccountStatuses = ['verified', 'approved', 'rejected', 'action needed', 'declined'];
    isExternalEligible = validAccountStatuses.includes(rawStatus);
  } else if (params.type === 'document') {
    // Only send when Ready for Pickup (or Rejected). NEVER on Pending, Processing, or Completed.
    const validDocStatuses = ['ready for pickup', 'ready', 'rejected', 'declined'];
    isExternalEligible = validDocStatuses.includes(rawStatus);
  } else if (params.type === 'health') {
    // Only send when service/appointment is Completed (or Cancelled). NEVER on booking, triage, or scheduled.
    const validHealthStatuses = ['completed', 'cancelled', 'overdue'];
    isExternalEligible = validHealthStatuses.includes(rawStatus);
  }

  // If backend already dispatched the external SMS/Email or caller explicitly requested skip
  if (params.externalDispatchedByBackend) {
    isExternalEligible = false;
  }

  // 3. Direct Gmail Delivery via EmailJS
  const shouldSendEmail = isExternalEligible && params.sendEmail !== false && cleanEmail.includes('@');
  if (shouldSendEmail) {
    try {
      const emailResult = await sendEmailNotification({
        to_name: params.residentName || 'Resident',
        to_email: cleanEmail,
        subject: `${params.title} - Barangay ${params.barangay || 'Pianing'}`,
        message: params.message,
        barangay: params.barangay || 'Pianing',
        status: params.statusBadge,
        request_code: params.refCode,
      });
      emailSuccess = emailResult.success;
      if (!emailResult.success && emailResult.message) {
        dispatchError = emailResult.message;
      }
    } catch (emailErr: any) {
      console.warn('⚠️ [EmailJS] Automated email dispatch failed:', emailErr?.message || emailErr);
    }
  }

  // 4. Live SMS Delivery via iProg SMS Gateway
  const shouldSendSms = isExternalEligible && params.sendSms !== false && Boolean(params.phone);
  if (shouldSendSms && params.phone) {
    try {
      const smsMsg = `Barangay ${params.barangay || 'Pianing'}: ${params.message}`;
      const smsResult = await sendLiveSmsNotification(params.phone, smsMsg);
      smsSuccess = smsResult.success;
      if (!smsResult.success && smsResult.error) {
        dispatchError = smsResult.error;
      }
    } catch (smsErr: any) {
      console.warn('⚠️ [iProg SMS] Automated SMS dispatch failed:', smsErr);
      dispatchError = smsErr?.message || 'Failed to dispatch SMS';
    }
  }

  return { inApp: inAppSuccess, email: emailSuccess, sms: smsSuccess, error: dispatchError };
}

