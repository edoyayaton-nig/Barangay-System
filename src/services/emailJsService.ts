import emailjs from '@emailjs/browser';
import { notificationStore } from './notificationStore';

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
  serviceId: (import.meta as any).env?.VITE_EMAILJS_SERVICE_ID || 'service_6nk2ylj',
  templateId: (import.meta as any).env?.VITE_EMAILJS_TEMPLATE_ID || 'template_tjcwzij',
  publicKey: (import.meta as any).env?.VITE_EMAILJS_PUBLIC_KEY || ''
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

      // 3. For Pianing only, fallback to .env default if not yet customized
      if (cleanBrgy === 'pianing') {
        return DEFAULT_CONFIG;
      }

      // 4. Any other barangay without saved credentials gets completely blank credentials
      return {
        serviceId: '',
        templateId: '',
        publicKey: ''
      };
    }
  } catch {}
  return {
    serviceId: '',
    templateId: '',
    publicKey: ''
  };
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

/**
 * 4. Unified Resident Notification Dispatcher
 * Records persistent in-app notification in notificationStore AND dispatches email to resident's Gmail via EmailJS
 */
export async function dispatchResidentNotification(params: {
  residentEmail: string;
  residentName?: string;
  type?: 'account' | 'document' | 'health' | 'system';
  title: string;
  message: string;
  statusBadge?: string;
  badgeColor?: 'red' | 'amber' | 'blue' | 'indigo' | 'emerald' | 'slate';
  refCode?: string;
  barangay?: string;
  sendEmail?: boolean;
}): Promise<{ inApp: boolean; email: boolean; error?: string }> {
  let inAppSuccess = false;
  let emailSuccess = false;
  const cleanEmail = (params.residentEmail || '').toLowerCase().trim();

  // 1. In-App Notification (Permanently retained in resident's Notification Center)
  if (cleanEmail) {
    try {
      notificationStore.addNotification(cleanEmail, {
        type: params.type || 'system',
        title: params.title,
        message: params.message,
        status_badge: params.statusBadge || 'Update',
        badge_color: params.badgeColor || 'indigo',
        ref_code: params.refCode
      });
      inAppSuccess = true;
    } catch (inAppErr) {
      console.warn('⚠️ [NotificationStore] Failed to record in-app notification:', inAppErr);
    }
  }

  // 2. Direct Gmail Delivery via EmailJS
  if (params.sendEmail !== false && cleanEmail.includes('@')) {
    try {
      const emailResult = await sendEmailNotification({
        to_name: params.residentName || 'Resident',
        to_email: cleanEmail,
        subject: `${params.title} - Barangay ${params.barangay || 'Pianing'}`,
        message: params.message,
        barangay: params.barangay || 'Pianing',
        status: params.statusBadge,
        request_code: params.refCode
      });
      emailSuccess = emailResult.success;
    } catch (emailErr: any) {
      console.warn('⚠️ [EmailJS] Automated email dispatch failed:', emailErr?.message || emailErr);
    }
  }

  return { inApp: inAppSuccess, email: emailSuccess };
}

