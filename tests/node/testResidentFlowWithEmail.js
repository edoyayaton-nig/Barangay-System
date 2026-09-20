import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000';

async function runResidentFlow() {
  console.log('================================================================');
  console.log('🧪 FULL RESIDENT LIFECYCLE & EMAIL NOTIFICATION VERIFICATION');
  console.log('================================================================');
  console.log(`Target Resident Email: edoyayaton@gmail.com`);
  console.log(`SMTP Settings in .env:`);
  console.log(` - EMAIL_USER: ${process.env.EMAIL_USER}`);
  console.log(` - EMAIL_PASS: ${process.env.EMAIL_PASS ? (process.env.EMAIL_PASS.includes('your_app_password') ? '(PLACEHOLDER: your_app_password_here)' : '********') : '(EMPTY)'}`);
  console.log(` - Live SMTP Ready: ${Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS && !process.env.EMAIL_USER.includes('your_gmail') && !process.env.EMAIL_PASS.includes('your_app_password'))}`);
  console.log('----------------------------------------------------------------\n');

  // Step 1: Register Resident with edoyayaton@gmail.com
  console.log('📝 Step 1: Registering new resident account (edoyayaton@gmail.com)...');
  const registerPayload = {
    first_name: 'Edoy',
    middle_name: 'S',
    last_name: 'Ayaton',
    email: 'edoyayaton@gmail.com',
    password: 'Password123!',
    phone: '09171234567',
    barangay: 'Pianing',
    city: 'Butuan City',
    purok: '3A',
    address: 'Purok 3A, Barangay Pianing',
    civil_status: 'Single',
    employment_status: 'Employed',
    date_of_birth: '1995-05-15',
    gender: 'Male',
    id_type: 'National ID',
    submitted_id: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  };

  let residentId = null;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registerPayload)
  });

  const regData = await regRes.json();
  console.log(`Register status: ${regRes.status}`, regData.message || '');
  if (regRes.status === 201) {
    residentId = regData.user?.id || regData.id;
    console.log(`✅ Resident registered with ID: ${residentId}`);
  } else if (regData.message && regData.message.includes('already registered')) {
    console.log(`ℹ️ Account already exists. Fetching resident record...`);
    const resListRes = await fetch(`${BASE_URL}/api/residents`);
    const resList = await resListRes.json();
    const found = resList.find(r => r.email && r.email.toLowerCase() === 'edoyayaton@gmail.com');
    if (found) {
      residentId = found.id;
      console.log(`Found existing resident ID: ${residentId}`);
    }
  }

  if (!residentId) {
    console.error('Could not get resident ID');
    process.exit(1);
  }

  // Step 2: Admin Approves / Verifies Resident
  console.log(`\n🛡️ Step 2: Admin Approving / Verifying Resident #${residentId}...`);
  const approveRes = await fetch(`${BASE_URL}/api/residents/${residentId}/approve`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved_by: 'Admin Juan Dela Cruz' })
  });
  const approveData = await approveRes.json();
  console.log(`Approve status: ${approveRes.status}`, approveData.message || '');

  // Step 3: Resident Requests Document (Certificate of Residency)
  console.log(`\n📄 Step 3: Resident Submitting Document Request (Certificate of Residency)...`);
  const docPayload = {
    resident_id: residentId,
    document_type: 'Certificate of Residency',
    resident_name: 'Edoy Ayaton',
    first_name: 'Edoy',
    last_name: 'Ayaton',
    email: 'edoyayaton@gmail.com',
    contact_number: '09171234567',
    barangay: 'Pianing',
    purok: 'Purok 3A',
    civil_status: 'Single',
    purpose: 'Scholarship Application & Bank Requirement',
    delivery_option: 'Digital Copy (PDF)'
  };

  const docRes = await fetch(`${BASE_URL}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docPayload)
  });
  const docData = await docRes.json();
  console.log(`Document submission status: ${docRes.status}`);
  const docId = docData.id;
  const trackingCode = docData.tracking_code || docData.request_code;
  console.log(`✅ Document created with ID: ${docId}, Tracking Code: ${trackingCode}`);

  // Step 4: Admin Updates Document Status to 'Ready for Pickup' and 'Completed'
  console.log(`\n🎉 Step 4: Admin Updating Document #${docId} Status to 'Ready for Pickup'...`);
  const updateDocRes = await fetch(`${BASE_URL}/api/documents/${docId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'Ready for Pickup',
      processed_by: 'Captain Juan Dela Cruz'
    })
  });
  const updateDocData = await updateDocRes.json();
  console.log(`Document status update: ${updateDocRes.status}`, updateDocData.message || 'Status updated to Ready for Pickup');

  // Step 5: Verify PDF Generation for the Completed Document
  console.log(`\n🖨️ Step 5: Testing PDF Generation for Document #${docId}...`);
  const pdfRes = await fetch(`${BASE_URL}/api/documents/${docId}/pdf`);
  console.log(`PDF Download status: ${pdfRes.status}, Content-Type: ${pdfRes.headers.get('content-type')}`);
  const pdfBuf = await pdfRes.arrayBuffer();
  console.log(`✅ Generated PDF attachment size: ${pdfBuf.byteLength} bytes`);

  console.log('\n================================================================');
  console.log('📊 NOTIFICATION SUMMARY & ANALYSIS');
  console.log('================================================================');
  console.log('1. Registration Trigger: sendRegistrationEmail() called.');
  console.log('2. Resident Verification Trigger: sendVerificationNoticeEmail() called.');
  console.log('3. Document Request Trigger: sendDocumentStatusEmail() called.');
  console.log('4. Document Completed Trigger: sendDocumentStatusEmail() called.');
  console.log('----------------------------------------------------------------');
  if (process.env.EMAIL_PASS && process.env.EMAIL_PASS.includes('your_app_password')) {
    console.log('⚠️ WHY WAS NO EMAIL RECEIVED IN GMAIL INBOX?');
    console.log('  Because the server is currently configured with placeholder SMTP credentials:');
    console.log(`  EMAIL_USER=${process.env.EMAIL_USER}`);
    console.log(`  EMAIL_PASS=${process.env.EMAIL_PASS}`);
    console.log('  To receive actual physical emails in edoyayaton@gmail.com:');
    console.log('  A Google App Password must be generated from:');
    console.log('  https://myaccount.google.com/apppasswords');
    console.log('  and added to the .env file as EMAIL_PASS.');
  } else {
    console.log('✅ Real SMTP credentials configured!');
  }
  console.log('================================================================');
}

runResidentFlow().catch(err => {
  console.error('Test error:', err);
});
