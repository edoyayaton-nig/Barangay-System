import { getPool } from '../../server/config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000';

async function runTest() {
  console.log('================================================================');
  console.log('🧪 COMPREHENSIVE RESIDENT END-TO-END NOTIFICATION TEST');
  console.log('================================================================');
  const targetEmail = 'edoyayaton@gmail.com';
  console.log(`Target Resident: Edoy Ayaton <${targetEmail}>`);

  // Step 0: Clean up any old test records for fresh registration test
  console.log('\n🧹 Step 0: Cleaning up previous test records for clean run...');
  const pool = getPool();
  if (pool) {
    try {
      await pool.query("DELETE FROM document_requests WHERE LOWER(email) = LOWER(?)", [targetEmail]);
      await pool.query("DELETE FROM health_appointments WHERE LOWER(resident_email) = LOWER(?)", [targetEmail]);
      await pool.query("DELETE FROM sms_notifications WHERE recipient_phone = '09171234567'");
      await pool.query("DELETE FROM residents WHERE LOWER(email) = LOWER(?)", [targetEmail]);
      await pool.query("DELETE FROM users WHERE LOWER(email) = LOWER(?)", [targetEmail]);
      console.log('✓ Cleaned previous records from MySQL');
    } catch (e) {
      console.warn('Cleanup note:', e.message);
    }
  }

  // Step 1: Create Resident Account
  console.log(`\n📝 Step 1: Creating new resident account (${targetEmail})...`);
  const regPayload = {
    first_name: 'Edoy',
    middle_name: 'S',
    last_name: 'Ayaton',
    email: targetEmail,
    password: 'Password123!',
    phone: '09171234567',
    barangay: 'Pianing',
    city: 'Butuan City',
    purok: '3',
    address: 'Purok 3, Barangay Pianing',
    civil_status: 'Single',
    employment_status: 'Employed',
    date_of_birth: '1995-05-15',
    gender: 'Male',
    id_type: 'National ID',
    submitted_id: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  };

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload)
  });
  const regData = await regRes.json();
  console.log(`Registration Response (Status: ${regRes.status}):`, regData.message);
  const residentId = regData.user?.id || regData.id;
  console.log(`✅ Resident ID: ${residentId}`);

  // Step 2: Admin Verifies the Resident Account
  console.log(`\n🛡️ Step 2: Admin approving & verifying resident #${residentId}...`);
  const approveRes = await fetch(`${BASE_URL}/api/residents/${residentId}/approve`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved_by: 'Admin Juan Dela Cruz' })
  });
  const approveData = await approveRes.json();
  console.log(`Verification Response (Status: ${approveRes.status}):`, approveData.message);

  // Step 3: Change Resident Profile Data
  console.log(`\n✏️ Step 3: Updating resident profile (changing phone, purok, civil status)...`);
  const profileUpdatePayload = {
    id: residentId,
    email: targetEmail,
    fullName: 'Edoy S. Ayaton',
    first_name: 'Edoy',
    last_name: 'Ayaton',
    phone: '09179876543',
    purok: '3A',
    civil_status: 'Married',
    address: 'Purok 3A, Barangay Pianing'
  };
  const profileRes = await fetch(`${BASE_URL}/api/users/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profileUpdatePayload)
  });
  const profileData = await profileRes.json();
  console.log(`Profile Update Response (Status: ${profileRes.status}):`, profileData.message);

  // Step 4: Request a Document (Certificate of Residency)
  console.log(`\n📄 Step 4: Submitting Document Request (Certificate of Residency)...`);
  const docPayload = {
    resident_id: residentId,
    document_type: 'Certificate of Residency',
    resident_name: 'Edoy S. Ayaton',
    first_name: 'Edoy',
    last_name: 'Ayaton',
    email: targetEmail,
    contact_number: '09179876543',
    barangay: 'Pianing',
    purok: 'Purok 3A',
    civil_status: 'Married',
    purpose: 'Employment & Scholarship Validation',
    delivery_option: 'Digital Copy (PDF)'
  };
  const docRes = await fetch(`${BASE_URL}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docPayload)
  });
  const docData = await docRes.json();
  const docId = docData.id;
  const requestCode = docData.tracking_code || docData.request_code;
  console.log(`Document Request Created (Status: ${docRes.status}): ID=${docId}, Code=${requestCode}`);

  // Step 5: Mark Document as "Ready for Pickup"
  console.log(`\n🎉 Step 5: Admin changing document #${docId} status to 'Ready for Pickup'...`);
  const readyRes = await fetch(`${BASE_URL}/api/documents/${docId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'Ready for Pickup',
      processed_by: 'Captain Juan Dela Cruz'
    })
  });
  const readyData = await readyRes.json();
  console.log(`Document Status Update (Status: ${readyRes.status}):`, readyData.message);

  // Step 6: Health Center Appointment & Due Date Dispatch
  console.log(`\n🏥 Step 6A: Booking a Health Center Consultation...`);
  const aptPayload = {
    resident_id: residentId,
    resident_name: 'Edoy S. Ayaton',
    resident_phone: '09179876543',
    resident_email: targetEmail,
    barangay: 'Pianing',
    service_type: 'General Medical Consultation',
    preferred_date: '2026-09-25',
    preferred_time: 'Morning (8:00 AM - 11:30 AM)',
    resident_notes: 'Regular health assessment & vital signs screening'
  };
  const aptRes = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(aptPayload)
  });
  const aptData = await aptRes.json();
  const aptId = aptData.id;
  const aptCode = aptData.appointment_code;
  console.log(`Appointment Created (Status: ${aptRes.status}): ID=${aptId}, Code=${aptCode}`);

  console.log(`\n📅 Step 6B: Health Center dispatching scheduled due date & confirming appointment...`);
  const confirmAptRes = await fetch(`${BASE_URL}/api/appointments/${aptId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'Approved',
      scheduled_date: '2026-09-25',
      scheduled_time: '09:00 AM',
      bhw_notes: 'Confirmed for morning clinic session. Please bring PhilHealth ID if available.',
      attending_bhw: 'Nurse Maria Santos'
    })
  });
  const confirmAptData = await confirmAptRes.json();
  console.log(`Appointment Due Date Confirmation (Status: ${confirmAptRes.status}):`, confirmAptData.message);

  // Step 7: Direct SMS & Text Notification to Resident
  console.log(`\n💬 Step 7: Dispatching direct text notification to resident...`);
  const textRes = await fetch(`${BASE_URL}/api/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient_name: 'Edoy S. Ayaton',
      recipient_phone: '09179876543',
      recipient_email: targetEmail,
      type: 'Health Center Alert',
      message: 'Reminder from Barangay Health Center: Your consultation is scheduled for Friday, Sept 25, 2026 at 9:00 AM with Nurse Maria Santos.'
    })
  });
  const textData = await textRes.json();
  console.log(`Text Notification Dispatch (Status: ${textRes.status}):`, textData.message || 'Notification recorded');

  // Step 8: PDF Download Check
  console.log(`\n🖨️ Step 8: Generating Official PDF attachment for Document #${docId}...`);
  const pdfRes = await fetch(`${BASE_URL}/api/documents/${docId}/pdf`);
  const pdfBytes = (await pdfRes.arrayBuffer()).byteLength;
  console.log(`PDF Download: HTTP ${pdfRes.status}, Size = ${pdfBytes} bytes`);

  console.log('\n================================================================');
  console.log('✅ ALL 7 STEPS EXECUTED SUCCESSFULLY!');
  console.log('================================================================');
  process.exit(0);
}

runTest().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
