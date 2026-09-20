import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Email Service – Barangay Pianing Smart System
// Uses Gmail SMTP (or any SMTP provider) via environment variables.
// Falls back to console-logged simulation mode if not configured.
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_USER    = process.env.EMAIL_USER    || '';
const EMAIL_PASS    = process.env.EMAIL_PASS    || '';
const EMAIL_HOST    = process.env.EMAIL_HOST    || 'smtp.gmail.com';
const EMAIL_PORT    = parseInt(process.env.EMAIL_PORT || '465');
const EMAIL_SECURE  = process.env.EMAIL_SECURE !== 'false';   // true by default

// Dynamic barangay name — set VITE_BARANGAY_NAME in .env to change for any barangay
const BARANGAY_NAME = process.env.VITE_BARANGAY_NAME || process.env.BARANGAY_NAME || 'Barangay Pianing';
const EMAIL_FROM    = process.env.EMAIL_FROM    || `"${BARANGAY_NAME} System" <${EMAIL_USER}>`;

const EMAILJS_SERVICE_ID  = process.env.VITE_EMAILJS_SERVICE_ID  || process.env.EMAILJS_SERVICE_ID  || 'service_6nk2ylj';
const EMAILJS_TEMPLATE_ID = process.env.VITE_EMAILJS_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID || 'template_tjcwzij';
const EMAILJS_PUBLIC_KEY  = process.env.VITE_EMAILJS_PUBLIC_KEY  || process.env.EMAILJS_PUBLIC_KEY  || '';
const EMAILJS_PRIVATE_KEY = process.env.VITE_EMAILJS_PRIVATE_KEY || process.env.EMAILJS_PRIVATE_KEY || '';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!EMAIL_USER || !EMAIL_PASS || EMAIL_USER.includes('your_gmail') || EMAIL_PASS.includes('your_app_password')) {
    return null;
  }
  const cleanPass = EMAIL_PASS.replace(/\s+/g, '');
  transporter = nodemailer.createTransport({
    host:   EMAIL_HOST,
    port:   EMAIL_PORT,
    secure: EMAIL_SECURE,
    auth:   { user: EMAIL_USER.trim(), pass: cleanPass },
    tls:    { rejectUnauthorized: false }
  });
  return transporter;
}

async function sendViaEmailJs({ to, subject, text, html, recipientName, barangay }) {
  const serviceId = process.env.VITE_EMAILJS_SERVICE_ID || process.env.EMAILJS_SERVICE_ID || EMAILJS_SERVICE_ID;
  const templateId = process.env.VITE_EMAILJS_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID || EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.VITE_EMAILJS_PUBLIC_KEY || process.env.EMAILJS_PUBLIC_KEY || EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.VITE_EMAILJS_PRIVATE_KEY || process.env.EMAILJS_PRIVATE_KEY || EMAILJS_PRIVATE_KEY;
  const brgyName = barangay || BARANGAY_NAME;

  if (!publicKey) return null;
  try {
    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        to_name: recipientName || to,
        to_email: to,
        email: to,
        name: recipientName || to,
        title: subject,
        subject: subject,
        message: text || subject,
        time: new Date().toLocaleString('en-PH'),
        barangay_name: brgyName,
        from_name: `${brgyName} Administration`
      }
    };
    // Include private key if strict mode is enabled
    if (privateKey) payload.accessToken = privateKey;

    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      console.log(`✅ [EmailJS] Live email sent to ${to} – Subject: ${subject}`);
      return { success: true, provider: 'emailjs' };
    } else {
      const errText = await res.text();
      console.warn(`⚠️ [EmailJS] Failed to send to ${to}:`, errText);
      return { success: false, error: errText };
    }
  } catch (err) {
    console.warn(`⚠️ [EmailJS] Dispatch exception:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core send function
// ─────────────────────────────────────────────────────────────────────────────
export async function sendEmail({ to, subject, html, text, recipientName, barangay }) {
  // 1. Try Gmail SMTP if configured with real credentials
  const xporter = getTransporter();
  if (xporter) {
    try {
      const info = await xporter.sendMail({
        from:    EMAIL_FROM,
        to,
        subject,
        text:    text || '',
        html:    html || `<p>${text}</p>`
      });
      console.log(`✅ [Email] Sent to ${to} – Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId, provider: 'smtp' };
    } catch (error) {
      console.error(`❌ [Email SMTP] Failed to send to ${to}:`, error.message);
    }
  }

  // 2. Try EmailJS
  const jsResult = await sendViaEmailJs({ to, subject, text, html, recipientName, barangay });
  if (jsResult && jsResult.success) {
    return jsResult;
  }

  // 3. Simulation mode fallback
  console.log(`📧 [Email – SIMULATION] To: ${to} | Subject: ${subject}`);
  console.log(`   Body: ${text || html}`);
  return { success: true, simulated: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built email templates
// ─────────────────────────────────────────────────────────────────────────────

const baseStyle = `
  font-family: 'Segoe UI', Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
`;
const headerStyle = `
  background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
  padding: 28px 32px;
  text-align: center;
`;
const bodyStyle = `padding: 28px 32px; color: #374151;`;
const footerStyle = `background: #f3f4f6; padding: 16px 32px; text-align: center; font-size: 12px; color: #6b7280;`;
const badgeStyle = (color) => `display:inline-block;padding:6px 18px;border-radius:20px;font-weight:700;font-size:14px;color:#fff;background:${color};`;

const STATUS_COLORS = {
  Completed:  '#16a34a',
  Processing: '#d97706',
  Pending:    '#6b7280',
  Rejected:   '#dc2626',
};

// 1. Document status update email
export async function sendDocumentStatusEmail({ to, recipientName, documentType, requestCode, status, message }) {
  const color  = STATUS_COLORS[status] || '#2563eb';
  const subject = `[${BARANGAY_NAME}] Document Request Update – ${requestCode}`;
  const html = `
<div style="${baseStyle}">
  <div style="${headerStyle}">
    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Philippines_coat_of_arms.svg/180px-Philippines_coat_of_arms.svg.png" alt="PH Seal" height="48" style="margin-bottom:8px;" />
    <h2 style="color:#fff;margin:0;font-size:20px;">Barangay Pianing</h2>
    <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">Butuan City, Agusan del Norte</p>
  </div>
  <div style="${bodyStyle}">
    <p style="font-size:16px;">Dear <strong>${recipientName}</strong>,</p>
    <p>Your document request has been updated. Here are the details:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:600;color:#6b7280;width:150px;">Document Type</td><td style="padding:8px;">${documentType}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#6b7280;">Reference Code</td><td style="padding:8px;font-weight:700;color:#1d4ed8;">${requestCode}</td></tr>
      <tr><td style="padding:8px;font-weight:600;color:#6b7280;">Status</td><td style="padding:8px;"><span style="${badgeStyle(color)}">${status}</span></td></tr>
    </table>
    ${status === 'Completed' ? `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px;margin-top:16px;color:#15803d;">
      <strong>✅ Your document is ready!</strong><br/>
      Please visit the Barangay Hall to claim your document. Bring a valid ID and quote your reference code <strong>${requestCode}</strong>.
    </div>` : ''}
    ${message ? `<p style="margin-top:16px;font-size:14px;color:#4b5563;"><strong>Note:</strong> ${message}</p>` : ''}
    <p style="margin-top:24px;font-size:13px;color:#6b7280;">For inquiries, please visit the Barangay Hall during office hours (Mon–Fri, 8:00 AM – 5:00 PM).</p>
  </div>
  <div style="${footerStyle}">
    <p style="margin:0;">This is an automated notification from the <strong>Smart Barangay Management System</strong>.</p>
    <p style="margin:4px 0 0;">Barangay Pianing, Butuan City</p>
  </div>
</div>`;
  return sendEmail({ to, subject, html, text: `Dear ${recipientName}, your ${documentType} (${requestCode}) status has been updated to: ${status}.` });
}

// 2. Immunization reminder email
export async function sendImmunizationReminderEmail({ to, childName, parentName, vaccineName, doseNumber, dueDate }) {
  const subject = `[Barangay Health] Immunization Schedule – ${childName}`;
  const html = `
<div style="${baseStyle}">
  <div style="${headerStyle.replace('#1e3a5f', '#065f46').replace('#2563eb', '#059669')}">
    <h2 style="color:#fff;margin:0;font-size:20px;">🏥 Barangay Health Center</h2>
    <p style="color:#a7f3d0;margin:4px 0 0;font-size:13px;">Barangay Pianing, Butuan City</p>
  </div>
  <div style="${bodyStyle}">
    <p style="font-size:16px;">Dear <strong>${parentName || 'Parent/Guardian'}</strong>,</p>
    <p>This is a friendly reminder for the upcoming immunization schedule:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:600;color:#6b7280;width:160px;">Child's Name</td><td style="padding:8px;">${childName}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#6b7280;">Vaccine</td><td style="padding:8px;font-weight:700;color:#065f46;">${vaccineName}</td></tr>
      <tr><td style="padding:8px;font-weight:600;color:#6b7280;">Dose Number</td><td style="padding:8px;">Dose ${doseNumber}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#6b7280;">Due Date</td><td style="padding:8px;font-weight:700;color:#b45309;">${dueDate}</td></tr>
    </table>
    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:14px;margin-top:16px;color:#854d0e;">
      <strong>📋 Reminder:</strong> Please bring your child's <strong>Baby Health Card (Immunization Record)</strong> and arrive at least 15 minutes early.
    </div>
    <p style="margin-top:20px;font-size:13px;color:#6b7280;">Health Center hours: Monday–Friday, 8:00 AM – 4:00 PM. For schedule changes, contact the Barangay Health Center.</p>
  </div>
  <div style="${footerStyle}">
    <p style="margin:0;">Automated notification from the <strong>Smart Barangay Management System</strong>.</p>
  </div>
</div>`;
  return sendEmail({ to, subject, html, text: `Immunization reminder: ${vaccineName} Dose ${doseNumber} for ${childName} is due on ${dueDate}.` });
}

// 3. Maternal health / next visit reminder email
export async function sendMaternalReminderEmail({ to, motherName, nextVisit, pregnancyStatus, riskLevel, notes }) {
  const riskColor = riskLevel === 'High' ? '#dc2626' : riskLevel === 'Medium' ? '#d97706' : '#16a34a';
  const subject = `[Barangay Health] Prenatal/Postnatal Visit Reminder`;
  const html = `
<div style="${baseStyle}">
  <div style="${headerStyle.replace('#1e3a5f', '#5b21b6').replace('#2563eb', '#7c3aed')}">
    <h2 style="color:#fff;margin:0;font-size:20px;">🤱 Maternal Health Program</h2>
    <p style="color:#ddd6fe;margin:4px 0 0;font-size:13px;">Barangay Pianing Health Center</p>
  </div>
  <div style="${bodyStyle}">
    <p style="font-size:16px;">Dear <strong>${motherName}</strong>,</p>
    <p>This is a reminder for your upcoming health visit:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:600;color:#6b7280;width:160px;">Status</td><td style="padding:8px;">${pregnancyStatus}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#6b7280;">Next Visit</td><td style="padding:8px;font-weight:700;color:#7c3aed;">${nextVisit}</td></tr>
      <tr><td style="padding:8px;font-weight:600;color:#6b7280;">Risk Level</td><td style="padding:8px;"><span style="${badgeStyle(riskColor)}">${riskLevel} Risk</span></td></tr>
      ${notes ? `<tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#6b7280;">Notes</td><td style="padding:8px;font-size:13px;">${notes}</td></tr>` : ''}
    </table>
    <div style="background:#faf5ff;border:1px solid #d8b4fe;border-radius:8px;padding:14px;margin-top:16px;color:#6d28d9;">
      <strong>💜 Health Tip:</strong> Regular prenatal/postnatal check-ups are essential for your health and your baby's development. Please do not miss your scheduled visit.
    </div>
    <p style="margin-top:20px;font-size:13px;color:#6b7280;">For questions or rescheduling, please visit or call the Barangay Health Center.</p>
  </div>
  <div style="${footerStyle}">
    <p style="margin:0;">Automated notification from the <strong>Smart Barangay Management System</strong>.</p>
  </div>
</div>`;
  return sendEmail({ to, subject, html, text: `Maternal health reminder: ${motherName}, your next visit is scheduled on ${nextVisit}.` });
}

// 4. Account registration / verification email
export async function sendRegistrationEmail({ to, fullName, role, tempPassword }) {
  const subject = `[${BARANGAY_NAME}] Your Account Has Been Created`;
  const html = `
<div style="${baseStyle}">
  <div style="${headerStyle}">
    <h2 style="color:#fff;margin:0;font-size:20px;">Welcome to Barangay Pianing</h2>
    <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">Smart Barangay Management System</p>
  </div>
  <div style="${bodyStyle}">
    <p style="font-size:16px;">Dear <strong>${fullName}</strong>,</p>
    <p>Your account has been successfully created in the Barangay Pianing Smart System.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:600;color:#6b7280;width:160px;">Full Name</td><td style="padding:8px;">${fullName}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#6b7280;">Email (Login)</td><td style="padding:8px;">${to}</td></tr>
      <tr><td style="padding:8px;font-weight:600;color:#6b7280;">Role</td><td style="padding:8px;">${role}</td></tr>
      ${tempPassword ? `<tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#6b7280;">Temp Password</td><td style="padding:8px;font-weight:700;color:#dc2626;font-family:monospace;">${tempPassword}</td></tr>` : ''}
    </table>
    ${tempPassword ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:14px;margin-top:16px;color:#991b1b;"><strong>⚠️ Important:</strong> Please change your password immediately after your first login.</div>` : ''}
    <p style="margin-top:24px;font-size:13px;color:#6b7280;">If you did not request this account, please contact the Barangay Office immediately.</p>
  </div>
  <div style="${footerStyle}">
    <p style="margin:0;">Automated notification from the <strong>Smart Barangay Management System</strong>.</p>
  </div>
</div>`;
  return sendEmail({ to, subject, html, text: `Welcome ${fullName}! Your ${role} account has been created. Email: ${to}. ${tempPassword ? `Temp password: ${tempPassword}` : ''}` });
}

// 5. Account Verification Notice (Approval / Rejection & Wrong ID Correction)
export async function sendVerificationNoticeEmail({ to, fullName, status, reason, remarks, barangay }) {
  const isApproved = status === 'Verified' || status === 'Approved';
  const cause = reason || remarks || 'Submitted Government ID or registration details require correction.';
  const color = isApproved ? '#16a34a' : '#dc2626';
  const effectiveBrgy = barangay || BARANGAY_NAME;
  const subject = isApproved 
    ? `[${effectiveBrgy}] Account Verified — Services Unlocked`
    : `[${effectiveBrgy} Action Required] ID Verification Notice: ${cause}`;

  const html = `
<div style="${baseStyle}">
  <div style="${headerStyle.replace('#1e3a5f', isApproved ? '#065f46' : '#991b1b').replace('#2563eb', isApproved ? '#059669' : '#dc2626')}">
    <h2 style="color:#fff;margin:0;font-size:20px;">${isApproved ? '✅ Account Verified' : '⚠️ Verification Correction Required'}</h2>
    <p style="color:#fecaca;margin:4px 0 0;font-size:13px;">Barangay Pianing Resident Portal</p>
  </div>
  <div style="${bodyStyle}">
    <p style="font-size:16px;">Dear <strong>${fullName || 'Resident'}</strong>,</p>
    ${isApproved ? `
      <p>Great news! Your Barangay Pianing resident account application has been <strong>VERIFIED and APPROVED</strong>.</p>
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px;margin:16px 0;color:#15803d;">
        <strong>🎉 Online Services Unlocked:</strong><br/>
        You can now log in to the resident portal to request Barangay Clearances, Certificates of Residency/Indigency, Business Permits, and book Health Center appointments online.
      </div>
    ` : `
      <p>Your resident account registration requires correction before it can be verified.</p>
      <div style="background:#fef2f2;border:1.5px solid #f87171;border-radius:8px;padding:14px;margin:16px 0;color:#991b1b;">
        <strong style="display:block;font-size:14px;margin-bottom:6px;">⚠️ Reason / Cause for Notice:</strong>
        <p style="margin:0;font-weight:600;font-size:14px;color:#7f1d1d;">"${cause}"</p>
      </div>
      <div style="background:#f8fafc;border-left:4px solid #3b82f6;padding:12px 14px;border-radius:4px;margin:16px 0;font-size:13px;color:#1e293b;">
        <strong>👉 How to Fix:</strong><br/>
        1. Log in to your resident account on the Barangay Portal.<br/>
        2. Click the <strong>"Update Profile / Resubmit ID"</strong> banner on your dashboard.<br/>
        3. Upload a clear, valid government-issued ID photo (e.g. PhilID, Driver's License, Voter's ID, Postal ID).
      </div>
    `}
    <p style="margin-top:20px;font-size:12px;color:#6b7280;">If you have any questions, please visit the Barangay Pianing Hall during office hours (Monday - Friday, 8:00 AM - 5:00 PM).</p>
  </div>
  <div style="${footerStyle}">
    <p style="margin:0;">Automated notification from the <strong>Smart Barangay Management System</strong>.</p>
  </div>
</div>`;

  return sendEmail({
    to,
    subject,
    html,
    text: isApproved 
      ? `Welcome ${fullName}! Your Barangay account has been VERIFIED. You can now access all services online.`
      : `Barangay Notice for ${fullName}: Your ID verification requires correction: "${cause}". Please log in to your portal to resubmit a clear ID photo.`,
    recipientName: fullName,
    barangay: effectiveBrgy
  });
}


// 6. Health Center Appointment status email
export async function sendAppointmentStatusEmail({ to, recipientName, serviceType, appointmentCode, status, scheduledDate, scheduledTime, bhwNotes, attendingBhw }) {
  const color = status === 'Approved' ? '#16a34a' : status === 'Completed' ? '#2563eb' : status === 'Cancelled' ? '#dc2626' : '#d97706';
  const subject = `[Barangay Health Center] Appointment ${status}: ${serviceType} (${appointmentCode})`;
  const html = `
<div style="${baseStyle}">
  <div style="${headerStyle.replace('#1e3a5f', '#065f46').replace('#2563eb', '#059669')}">
    <h2 style="color:#fff;margin:0;font-size:20px;">🏥 Barangay Health Center Appointment</h2>
    <p style="color:#a7f3d0;margin:4px 0 0;font-size:13px;">Barangay Pianing, Butuan City</p>
  </div>
  <div style="${bodyStyle}">
    <p style="font-size:16px;">Dear <strong>${recipientName}</strong>,</p>
    <p>Your health center appointment schedule has been updated. Here are the confirmed details:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:600;color:#6b7280;width:160px;">Service / Program</td><td style="padding:8px;font-weight:700;color:#065f46;">${serviceType}</td></tr>
      <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#6b7280;">Appointment Ref</td><td style="padding:8px;font-weight:700;color:#1d4ed8;">${appointmentCode}</td></tr>
      <tr><td style="padding:8px;font-weight:600;color:#6b7280;">Status</td><td style="padding:8px;"><span style="${badgeStyle(color)}">${status}</span></td></tr>
      ${scheduledDate ? `<tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#6b7280;">Confirmed Date</td><td style="padding:8px;font-weight:700;color:#065f46;">${scheduledDate}</td></tr>` : ''}
      ${scheduledTime ? `<tr><td style="padding:8px;font-weight:600;color:#6b7280;">Time / Session</td><td style="padding:8px;font-weight:700;color:#065f46;">${scheduledTime}</td></tr>` : ''}
      ${attendingBhw ? `<tr style="background:#f9fafb;"><td style="padding:8px;font-weight:600;color:#6b7280;">Attending BHW/Staff</td><td style="padding:8px;">${attendingBhw}</td></tr>` : ''}
    </table>
    ${status === 'Approved' ? `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px;margin-top:16px;color:#15803d;">
      <strong>✅ Your appointment is CONFIRMED!</strong><br/>
      Please visit the Barangay Health Center on your scheduled date and time. Please bring a valid ID and any relevant health records / documents.
    </div>` : ''}
    ${bhwNotes ? `<p style="margin-top:16px;font-size:14px;color:#4b5563;"><strong>BHW Instructions:</strong> ${bhwNotes}</p>` : ''}
    <p style="margin-top:20px;font-size:13px;color:#6b7280;">Health Center hours: Monday to Friday, 8:00 AM – 5:00 PM. For inquiries or rescheduling, please contact the Barangay Health Center.</p>
  </div>
  <div style="${footerStyle}">
    <p style="margin:0;">Automated notification from the <strong>Smart Barangay Management System</strong>.</p>
  </div>
</div>`;
  return sendEmail({ to, subject, html, text: `Health Appointment ${status}: ${serviceType} (${appointmentCode}) scheduled for ${scheduledDate || 'pending'} ${scheduledTime || ''}.` });
}

// 7. Official Barangay Announcement broadcast email
export async function sendAnnouncementEmail({ to, title, message, authorName, date }) {
  const subject = `[${BARANGAY_NAME} Announcement] ${title}`;
  const html = `
<div style="${baseStyle}">
  <div style="${headerStyle}">
    <h2 style="color:#fff;margin:0;font-size:20px;">📢 Barangay Pianing Official Notice</h2>
    <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">Community Announcement</p>
  </div>
  <div style="${bodyStyle}">
    <h3 style="color:#1e3a5f;font-size:18px;margin-top:0;">${title}</h3>
    <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:14px;border-radius:4px;margin:16px 0;font-size:14px;color:#334155;line-height:1.6;white-space:pre-wrap;">${message}</div>
    <div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
      <p style="margin:2px 0;"><strong>Issued by:</strong> ${authorName || 'Barangay Administration'}</p>
      <p style="margin:2px 0;"><strong>Date:</strong> ${date || new Date().toLocaleDateString()}</p>
    </div>
  </div>
  <div style="${footerStyle}">
    <p style="margin:0;">Official broadcast from the <strong>Smart Barangay Management System — Barangay Pianing</strong>.</p>
  </div>
</div>`;
  return sendEmail({ to, subject, html, text: `[Barangay Pianing Announcement] ${title}\n\n${message}\n\nIssued by: ${authorName || 'Barangay Administration'}` });
}

// 8. General SMS-to-Email notification bridge
export async function sendDirectNotificationEmail({ to, recipientName, type, message }) {
  const subject = `[${BARANGAY_NAME} Alert] ${type || 'Notification'}`;
  const html = `
<div style="${baseStyle}">
  <div style="${headerStyle}">
    <h2 style="color:#fff;margin:0;font-size:20px;">📲 Barangay Official Notification</h2>
    <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">Barangay Pianing, Butuan City</p>
  </div>
  <div style="${bodyStyle}">
    <p style="font-size:15px;">Dear <strong>${recipientName || 'Resident'}</strong>,</p>
    <p>You have received the following official SMS &amp; system notification:</p>
    <div style="background:#f8fafc;border-left:4px solid #059669;padding:14px;border-radius:6px;margin:16px 0;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">
      <strong style="color:#059669;display:block;margin-bottom:6px;">Type: ${type || 'Notice'}</strong>
      ${message}
    </div>
    <p style="margin-top:20px;font-size:12px;color:#6b7280;">This message was automatically delivered to your registered email in synchronization with your mobile number.</p>
  </div>
  <div style="${footerStyle}">
    <p style="margin:0;">Automated notification from the <strong>Smart Barangay Management System</strong>.</p>
  </div>
</div>`;
  return sendEmail({ to, subject, html, text: `[Barangay Notification: ${type}]\n\n${message}` });
}

// 9. Profile & Data Update Notification Email
export async function sendProfileUpdateEmail({ to, fullName, changes, date }) {
  const subject = `[${BARANGAY_NAME}] Profile & Account Information Updated`;
  const html = `
<div style="${baseStyle}">
  <div style="${headerStyle}">
    <h2 style="color:#fff;margin:0;font-size:20px;">👤 Profile Information Updated</h2>
    <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">Smart Barangay Governance System</p>
  </div>
  <div style="${bodyStyle}">
    <p style="font-size:15px;">Dear <strong>${fullName || 'Resident'}</strong>,</p>
    <p>This is an official notification that your Barangay resident profile details were updated on <strong>${date || new Date().toLocaleString()}</strong>.</p>
    <div style="background:#f8fafc;border-left:4px solid #4f46e5;padding:14px;border-radius:6px;margin:16px 0;font-size:13px;color:#1e293b;line-height:1.6;">
      <strong style="color:#4f46e5;display:block;margin-bottom:6px;">Summary of Information Updated:</strong>
      <p style="margin:0;white-space:pre-wrap;font-weight:600;">${changes || 'Personal details updated successfully.'}</p>
    </div>
    <p style="font-size:13px;color:#64748b;">If you performed this update, no further action is required. If you did NOT authorize these changes, please contact the Barangay Administration office immediately.</p>
  </div>
  <div style="${footerStyle}">
    <p style="margin:0;">Automated notification from the <strong>Smart Barangay Management System — Barangay Pianing</strong>.</p>
  </div>
</div>`;
  return sendEmail({
    to,
    subject,
    html,
    text: `Notice for ${fullName}: Your profile information was updated on ${date || new Date().toLocaleDateString()}. Changes: ${changes}`
  });
}


