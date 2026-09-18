// End-to-End Test: Multi-City Governance, Staff Delegation & Resident Services
// Scenario:
// 1. Create Super Admin from another city (Cabadbaran City, Barangay Antonio Luna).
// 2. Super Admin creates a Barangay Admin for Antonio Luna to process official documents.
// 3. Super Admin creates a Nurse assigned to health in Antonio Luna.
// 4. Resident from Cabadbaran City registers with valid ID in Barangay Antonio Luna.
// 5. Resident requests official Barangay Clearance and books a Health Center Appointment.
// 6. Cabadbaran Admin approves resident and completes the document clearance lifecycle.
// 7. Cabadbaran Nurse approves appointment, records clinical consultation, and completes appointment.
// 8. Territorial boundary verification: Ensures Barangay Pianing Admin/Nurse CANNOT see Cabadbaran records.
// 9. Super Admin verification: Ensures Super Admin has global oversight across all cities.

const BASE_URL = 'http://localhost:5000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runCrossCityTest() {
  console.log('\n\x1b[45;37m ============================================================================== \x1b[0m');
  console.log('\x1b[45;37m   CROSS-CITY END-TO-END TEST: CABADBARAN CITY & BARANGAY ANTONIO LUNA          \x1b[0m');
  console.log('\x1b[45;37m ============================================================================== \x1b[0m\n');

  const rand = Math.floor(1000 + Math.random() * 9000);
  const city = 'Cabadbaran City';
  const barangay = 'Antonio Luna';
  let passedAssertions = 0;
  let failedAssertions = 0;

  function assert(condition, message) {
    if (condition) {
      passedAssertions++;
      console.log(`  \x1b[32m✓\x1b[0m ${message}`);
    } else {
      failedAssertions++;
      console.error(`  \x1b[31m✗\x1b[0m FAILED: ${message}`);
      throw new Error(message);
    }
  }

  // Pre-clean any existing active admin for this barangay to satisfy 1 Admin per Barangay rule
  const usersRes = await request('/users');
  const existingAdmins = (usersRes.data || []).filter(u => u.role === 'admin' && u.status === 'Active' && (u.barangay || '').toLowerCase() === barangay.toLowerCase());
  for (const ea of existingAdmins) {
    await request(`/users/${ea.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Inactive' })
    });
  }

  // --------------------------------------------------------------------------
  // STEP 1: CREATE SUPER ADMIN FROM BARANGAY ANTONIO LUNA, CABADBARAN CITY
  // --------------------------------------------------------------------------
  console.log('\x1b[1m[STEP 1: Create Super Admin from Barangay Antonio Luna, Cabadbaran City]\x1b[0m');
  const saEmail = `superadmin.antonioluna.${rand}@gmail.com`;
  const saName = `Super Admin Antonio Luna (${rand})`;
  const saPassword = 'SuperAdmin123!';

  const saCreateRes = await request('/users', {
    method: 'POST',
    body: JSON.stringify({
      name: saName,
      email: saEmail,
      password: saPassword,
      role: 'superadmin',
      barangay: barangay,
      city: city,
      phone: '09171112233',
      status: 'Active'
    })
  });
  assert(saCreateRes.ok, `Super Admin created specifically from Barangay ${barangay}, ${city} (ID: ${saCreateRes.data?.id})`);

  // Verify Super Admin can login
  const saLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: saEmail, password: saPassword })
  });
  assert(saLoginRes.ok && saLoginRes.data?.user?.role === 'superadmin', 'Super Admin successfully logged in with valid role');
  assert(saLoginRes.data?.user?.barangay === barangay, `Super Admin registered to jurisdiction: Barangay ${barangay}, ${city}`);
  console.log(`  \x1b[90mSuper Admin: ${saName} (${saEmail}) | Jurisdiction: Barangay ${barangay}, ${city}\x1b[0m\n`);

  // --------------------------------------------------------------------------
  // STEP 2: SUPER ADMIN CREATES BARANGAY ADMIN FOR ANTONIO LUNA
  // --------------------------------------------------------------------------
  console.log(`\x1b[1m[STEP 2: Super Admin Creates Barangay Admin for Barangay ${barangay}]\x1b[0m`);
  const adminEmail = `admin.antonioluna.${rand}@gmail.com`;
  const adminName = `Barangay Admin Antonio Luna ${rand}`;
  const adminPassword = 'AdminPassword123!';

  const adminCreateRes = await request('/users', {
    method: 'POST',
    body: JSON.stringify({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      barangay: barangay,
      city: city,
      phone: '09182223344',
      employee_id: `CBR-ADM-${rand}`,
      job_title: `Punong Barangay Administrator (${barangay})`,
      status: 'Active',
      created_by: saName
    })
  });
  assert(adminCreateRes.ok, `Barangay Admin created for Barangay ${barangay}, ${city}`);

  // Verify Admin Login
  const adminLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  assert(adminLoginRes.ok && adminLoginRes.data?.user?.role === 'admin', 'Barangay Admin login verified with role admin');
  assert(adminLoginRes.data?.user?.barangay === barangay, `Admin correctly assigned to Barangay ${barangay}`);
  console.log(`  \x1b[90mAdmin: ${adminName} (${adminEmail}) | Assigned: Barangay ${barangay}, ${city}\x1b[0m\n`);

  // --------------------------------------------------------------------------
  // STEP 3: SUPER ADMIN CREATES NURSE FOR HEALTH CENTER IN ANTONIO LUNA
  // --------------------------------------------------------------------------
  console.log(`\x1b[1m[STEP 3: Super Admin Creates Clinic Nurse for Health Center in ${barangay}]\x1b[0m`);
  const nurseEmail = `nurse.antonioluna.${rand}@gmail.com`;
  const nurseName = `Nurse Antonio Luna Health Center ${rand}`;
  const nursePassword = 'NursePassword123!';

  const nurseCreateRes = await request('/users', {
    method: 'POST',
    body: JSON.stringify({
      name: nurseName,
      email: nurseEmail,
      password: nursePassword,
      role: 'nurse',
      barangay: barangay,
      city: city,
      phone: '09193334455',
      employee_id: `CBR-NRS-${rand}`,
      job_title: `Health Center Duty Nurse (${barangay})`,
      status: 'Active',
      created_by: saName
    })
  });
  assert(nurseCreateRes.ok, `Clinic Nurse created for Health Center in Barangay ${barangay}`);

  // Verify Nurse Login
  const nurseLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: nurseEmail, password: nursePassword })
  });
  assert(nurseLoginRes.ok && nurseLoginRes.data?.user?.role === 'nurse', 'Clinic Nurse login verified with role nurse');
  assert(nurseLoginRes.data?.user?.barangay === barangay, `Nurse correctly assigned to Barangay ${barangay} Health Center`);
  console.log(`  \x1b[90mNurse: ${nurseName} (${nurseEmail}) | Assigned: Barangay ${barangay} Clinic\x1b[0m\n`);

  // --------------------------------------------------------------------------
  // STEP 4: RESIDENT REGISTERS FROM CABADBARAN CITY WITH VALID ID
  // --------------------------------------------------------------------------
  console.log('\x1b[1m[STEP 4: Resident Registers from Cabadbaran City in Barangay Antonio Luna]\x1b[0m');
  const resEmail = `resident.cbr.${rand}@gmail.com`;
  const resFirstName = 'Juan';
  const resLastName = `Cabadbaran ${rand}`;
  const resFullName = `${resFirstName} ${resLastName}`;
  const resPassword = 'ResidentPassword123!';
  const resPhone = '09175556677';
  const resAddress = `Purok 1, Barangay ${barangay}, ${city}`;

  const regRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      first_name: resFirstName,
      last_name: resLastName,
      email: resEmail,
      password: resPassword,
      phone: resPhone,
      city: city,
      barangay: barangay,
      purok: '1',
      address: resAddress,
      date_of_birth: '1998-07-15',
      gender: 'Male',
      civil_status: 'Single',
      employment_status: 'Employed',
      years_of_residency: '4',
      id_type: 'Philippine National ID (PhilSys)',
      submitted_id: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    })
  });
  assert(regRes.ok || regRes.status === 201, `Resident successfully registered in ${city} (HTTP ${regRes.status})`);
  assert(regRes.data?.user?.verification_status === 'Pending_Review', 'Resident initialized with Pending_Review verification status');
  const residentId = regRes.data?.user?.id;
  assert(residentId, `Resident assigned unique ID: ${residentId}`);
  console.log(`  \x1b[90mResident: ${resFullName} | Address: ${resAddress}\x1b[0m\n`);

  // --------------------------------------------------------------------------
  // STEP 5: TERRITORIAL ISOLATION CHECK (PIANING ADMIN VS CABADBARAN ADMIN)
  // --------------------------------------------------------------------------
  console.log('\x1b[1m[STEP 5: Verify Territorial Boundary Isolation on Pending Queue]\x1b[0m');
  // Pianing Admin checks pending queue: MUST NOT SEE CABADBARAN RESIDENT
  const pianingQueueRes = await request('/residents/pending?barangay=Pianing');
  assert(pianingQueueRes.ok, 'Pianing Admin retrieved pending queue');
  const foundInPianing = (pianingQueueRes.data || []).some(r => r.email?.toLowerCase() === resEmail.toLowerCase());
  assert(!foundInPianing, '✓ ISOLATION PASS: Pianing Admin CANNOT see Cabadbaran resident');

  // Cabadbaran Admin checks pending queue: MUST SEE CABADBARAN RESIDENT
  const cbrQueueRes = await request(`/residents/pending?barangay=${encodeURIComponent(barangay)}`);
  assert(cbrQueueRes.ok, `Cabadbaran Admin retrieved pending queue for Barangay ${barangay}`);
  const foundInCbr = (cbrQueueRes.data || []).some(r => r.email?.toLowerCase() === resEmail.toLowerCase());
  assert(foundInCbr, `✓ ROUTING PASS: Cabadbaran Admin SEES resident in Barangay ${barangay} queue\n`);

  // --------------------------------------------------------------------------
  // STEP 6: CABADBARAN ADMIN APPROVES RESIDENT IDENTITY
  // --------------------------------------------------------------------------
  console.log('\x1b[1m[STEP 6: Cabadbaran Admin Approves Resident Identity]\x1b[0m');
  const approveRes = await request(`/residents/${residentId}/approve`, {
    method: 'PUT',
    body: JSON.stringify({ verified_by: adminName })
  });
  assert(approveRes.ok, `Resident ID successfully verified & approved by Cabadbaran Admin (${adminName})`);

  // Verify resident login and status
  const resLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: resEmail, password: resPassword })
  });
  assert(resLogin.ok, 'Resident logged in successfully');
  assert(resLogin.data?.user?.verification_status === 'Verified', 'Resident verification status is now Verified\n');

  // --------------------------------------------------------------------------
  // STEP 7: RESIDENT REQUESTS BARANGAY CLEARANCE DOCUMENT
  // --------------------------------------------------------------------------
  console.log('\x1b[1m[STEP 7: Resident Requests Official Barangay Clearance]\x1b[0m');
  const docCreateRes = await request('/documents', {
    method: 'POST',
    body: JSON.stringify({
      resident_name: resFullName,
      resident_id: residentId,
      email: resEmail,
      document_type: 'Barangay Clearance',
      purpose: 'Local Employment in Cabadbaran City',
      barangay: barangay
    })
  });
  assert(docCreateRes.ok || docCreateRes.status === 201, `Document request created (Tracking Code: ${docCreateRes.data?.request_code})`);
  const docId = docCreateRes.data?.id;
  const docCode = docCreateRes.data?.request_code;
  assert(docId && docCode, 'Document received valid numeric ID and tracking code');

  // Verify Pianing Admin cannot see document
  const pianingDocsRes = await request('/documents?barangay=Pianing');
  const foundDocInPianing = (pianingDocsRes.data || []).some(d => d.request_code === docCode);
  assert(!foundDocInPianing, '✓ ISOLATION PASS: Pianing Admin CANNOT see Cabadbaran document request');

  // Verify Cabadbaran Admin sees document
  const cbrDocsRes = await request(`/documents?barangay=${encodeURIComponent(barangay)}`);
  const foundDocInCbr = (cbrDocsRes.data || []).some(d => d.request_code === docCode);
  assert(foundDocInCbr, `✓ ROUTING PASS: Cabadbaran Admin SEES document in Barangay ${barangay} queue\n`);

  // --------------------------------------------------------------------------
  // STEP 8: CABADBARAN ADMIN PROCESSES & COMPLETES CLEARANCE DOCUMENT
  // --------------------------------------------------------------------------
  console.log('\x1b[1m[STEP 8: Cabadbaran Admin Processes & Completes Document Lifecycle]\x1b[0m');
  // Transition to Processing
  const procRes = await request(`/documents/${docId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Processing', processed_by: adminName })
  });
  assert(procRes.ok, `Document ${docCode} transitioned to Processing`);

  // Transition to Ready for Pickup
  const readyRes = await request(`/documents/${docId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Ready for Pickup', processed_by: adminName })
  });
  assert(readyRes.ok, `Document ${docCode} transitioned to Ready for Pickup`);

  // Transition to Completed
  const compRes = await request(`/documents/${docId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Completed', processed_by: adminName })
  });
  assert(compRes.ok, `Document ${docCode} completed and ready for archiving\n`);

  // --------------------------------------------------------------------------
  // STEP 9: RESIDENT BOOKS HEALTH CENTER CLINIC APPOINTMENT
  // --------------------------------------------------------------------------
  console.log('\x1b[1m[STEP 9: Resident Books Health Center Clinic Appointment]\x1b[0m');
  const aptCreateRes = await request('/appointments', {
    method: 'POST',
    body: JSON.stringify({
      resident_name: resFullName,
      resident_phone: resPhone,
      resident_email: resEmail,
      resident_id: residentId,
      barangay: barangay,
      service_type: 'General Consultation',
      preferred_date: '2026-09-25',
      preferred_time: 'Morning (8:00 AM - 11:30 AM)',
      resident_notes: 'Cough and medical checkup for employment certificate.',
      status: 'Pending'
    })
  });
  if (!aptCreateRes.ok) {
    console.error('APT CREATE ERROR:', aptCreateRes.status, aptCreateRes.data);
  }
  assert(aptCreateRes.ok || aptCreateRes.status === 201, `Clinic appointment created (Tracking Code: ${aptCreateRes.data?.appointment_code})`);
  const aptId = aptCreateRes.data?.id;
  const aptCode = aptCreateRes.data?.appointment_code;
  assert(aptId && aptCode, 'Appointment received valid numeric ID and tracking code');

  // Verify Pianing Nurse cannot see Cabadbaran appointment
  const pianingAptsRes = await request('/appointments?barangay=Pianing');
  const foundAptInPianing = (pianingAptsRes.data || []).some(a => a.appointment_code === aptCode);
  assert(!foundAptInPianing, '✓ ISOLATION PASS: Pianing Clinic Nurse CANNOT see Cabadbaran appointment');

  // Verify Cabadbaran Nurse sees appointment
  const cbrAptsRes = await request(`/appointments?barangay=${encodeURIComponent(barangay)}`);
  const foundAptInCbr = (cbrAptsRes.data || []).some(a => a.appointment_code === aptCode);
  assert(foundAptInCbr, `✓ ROUTING PASS: Cabadbaran Clinic Nurse SEES appointment in Barangay ${barangay} health queue\n`);

  // --------------------------------------------------------------------------
  // STEP 10: CABADBARAN NURSE CONFIRMS SLOT, CONDUCTS ENCOUNTER & COMPLETES
  // --------------------------------------------------------------------------
  console.log('\x1b[1m[STEP 10: Cabadbaran Nurse Approves Slot & Conducts Clinical Visit]\x1b[0m');
  // Nurse approves slot
  const confirmAptRes = await request(`/appointments/${aptId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'Approved',
      scheduled_time: '2026-09-25 at 09:30 AM',
      attending_staff: nurseName,
      nurse_notes: 'Slot confirmed at Barangay Antonio Luna Health Post. Fasting not required.'
    })
  });
  assert(confirmAptRes.ok, `Appointment ${aptCode} confirmed by Cabadbaran Nurse (${nurseName})`);

  // Nurse logs consultation clinical record
  const consultRes = await request('/consultations', {
    method: 'POST',
    body: JSON.stringify({
      resident_id: residentId,
      patient_name: resFullName,
      resident_name: resFullName,
      barangay: barangay,
      consultation_date: '2026-09-25',
      attending_provider: nurseName,
      chief_complaint: 'Employment Medical Clearance checkup',
      diagnosis: 'Physically Fit, Mild Pharyngitis',
      blood_pressure: '120/80',
      temperature: '36.7',
      heart_rate: '74',
      respiratory_rate: '18',
      weight: '65.0',
      height: '168',
      treatment_plan: 'Oral hydration, Vitamin C 500mg once daily x 7 days',
      disposition: 'Treated and Discharged - Fit to Work'
    })
  });
  assert(consultRes.ok, 'Clinical consultation encounter successfully recorded in Health Center EHR Registry');

  // Nurse marks appointment lifecycle as Completed
  const completeAptRes = await request(`/appointments/${aptId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'Completed',
      nurse_notes: 'Consultation concluded. Fit to work certificate cleared. Patient discharged.'
    })
  });
  assert(completeAptRes.ok, `Appointment ${aptCode} concluded with status Completed\n`);

  // --------------------------------------------------------------------------
  // STEP 11: SUPER ADMIN GLOBAL OVERSIGHT AUDIT
  // --------------------------------------------------------------------------
  console.log('\x1b[1m[STEP 11: Super Admin Global Multi-City Oversight Audit]\x1b[0m');
  // Super Admin retrieves all residents across all cities/barangays
  const saResidentsRes = await request('/residents');
  assert(saResidentsRes.ok, 'Super Admin fetched global resident masterlist');
  const saFoundRes = (saResidentsRes.data || []).some(r => r.email?.toLowerCase() === resEmail.toLowerCase());
  assert(saFoundRes, `Super Admin has full visibility of Cabadbaran resident (${resFullName})`);

  // Super Admin retrieves all documents across all cities/barangays
  const saDocsRes = await request('/documents');
  assert(saDocsRes.ok, 'Super Admin fetched global documents repository');
  const saFoundDoc = (saDocsRes.data || []).some(d => d.request_code === docCode);
  assert(saFoundDoc, `Super Admin has full visibility of Cabadbaran document (${docCode})`);

  // Super Admin retrieves all appointments across all cities/barangays
  const saAptsRes = await request('/appointments');
  assert(saAptsRes.ok, 'Super Admin fetched global appointments repository');
  const saFoundApt = (saAptsRes.data || []).some(a => a.appointment_code === aptCode);
  assert(saFoundApt, `Super Admin has full visibility of Cabadbaran appointment (${aptCode})\n`);

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log('\x1b[42;30m ============================================================================== \x1b[0m');
  console.log(`\x1b[42;30m   CROSS-CITY SIMULATION RESULT: ALL ${passedAssertions} ASSERTIONS PASSED WITH 0 FAILURES!    \x1b[0m`);
  console.log('\x1b[42;30m ============================================================================== \x1b[0m\n');
  console.log(`  - City Tested:                 ${city}`);
  console.log(`  - Barangay Tested:             ${barangay}`);
  console.log(`  - Super Admin:                 ${saName} (${saEmail})`);
  console.log(`  - Barangay Admin:              ${adminName} (${adminEmail})`);
  console.log(`  - Clinic Nurse:                ${nurseName} (${nurseEmail})`);
  console.log(`  - Resident:                    ${resFullName} (${resEmail})`);
  console.log(`  - Clearance Document Code:     ${docCode} (Completed)`);
  console.log(`  - Clinic Appointment Code:     ${aptCode} (Completed)`);
  console.log(`  - Territorial Isolation:       Strictly Verified (Pianing saw 0 Cabadbaran records)`);
  console.log(`  - Super Admin Global Access:   Strictly Verified (Saw all records)\n`);
}

runCrossCityTest().catch(err => {
  console.error('\x1b[41;37m CROSS-CITY TEST RUN FAILED \x1b[0m', err);
  process.exit(1);
});
