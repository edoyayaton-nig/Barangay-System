// End-to-End Live Appointment Lifecycle Test
// Tests resident booking -> nurse queue -> confirmation -> consultation -> completion

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

async function runAppointmentLifecycleTest() {
  console.log('\n\x1b[44;37m === LIVE END-TO-END APPOINTMENT LIFECYCLE TEST === \x1b[0m\n');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const residentName = `Juan Dela Cruz ${rand}`;
  const residentEmail = `juan.resident.${rand}@pianing.ph`;
  const residentPhone = '09171234567';
  const preferredDate = '2026-09-18';
  const serviceType = 'General Consultation';
  let appointmentId = null;
  let appointmentCode = null;

  // STEP 1: Resident Books Appointment
  console.log('\x1b[1m[STEP 1: Resident Portal Booking]\x1b[0m');
  const bookRes = await request('/appointments', {
    method: 'POST',
    body: JSON.stringify({
      resident_name: residentName,
      resident_phone: residentPhone,
      resident_email: residentEmail,
      barangay: 'Pianing',
      service_type: serviceType,
      preferred_date: preferredDate,
      preferred_time: 'Morning (8:00 AM - 11:30 AM)',
      resident_notes: 'Experiencing cough and mild fever for 2 days. Requesting medical evaluation.',
      status: 'Pending'
    })
  });

  if (!bookRes.ok) {
    throw new Error(`Booking failed: HTTP ${bookRes.status}: ${JSON.stringify(bookRes.data)}`);
  }

  appointmentId = bookRes.data?.id;
  appointmentCode = bookRes.data?.appointment_code;
  console.log(`  \x1b[32m✓\x1b[0m Appointment successfully booked!`);
  console.log(`    - ID: \x1b[36m${appointmentId}\x1b[0m`);
  console.log(`    - Tracking Code: \x1b[36m${appointmentCode}\x1b[0m`);
  console.log(`    - Resident: ${residentName}`);
  console.log(`    - Service: ${serviceType}`);
  console.log(`    - Status: \x1b[33m${bookRes.data?.status || 'Pending'}\x1b[0m\n`);

  // STEP 2: Nurse Retrieves Queue
  console.log('\x1b[1m[STEP 2: Nurse Dashboard Inspection]\x1b[0m');
  const queueRes = await request('/appointments?barangay=Pianing');
  if (!queueRes.ok) throw new Error(`Queue fetch failed: HTTP ${queueRes.status}`);
  const foundApt = (queueRes.data || []).find(a => a.id === appointmentId || a.appointment_code === appointmentCode);
  if (!foundApt) throw new Error(`Appointment ${appointmentCode} not found in Nurse queue!`);
  console.log(`  \x1b[32m✓\x1b[0m Nurse successfully retrieved appointment ${appointmentCode} from queue`);
  console.log(`    - Current Status: \x1b[33m${foundApt.status}\x1b[0m\n`);

  // STEP 3: Nurse Confirms Slot
  console.log('\x1b[1m[STEP 3: Nurse Confirms Appointment Slot]\x1b[0m');
  const confirmRes = await request(`/appointments/${appointmentId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'Approved',
      scheduled_date: '2026-09-18',
      scheduled_time: '09:30 AM',
      attending_bhw: 'Nurse Maria Santos, RN',
      bhw_notes: 'Slot confirmed for Room 2 Primary Health Care. Please arrive 15 minutes early with valid ID.'
    })
  });

  if (!confirmRes.ok) throw new Error(`Confirmation failed: HTTP ${confirmRes.status}: ${JSON.stringify(confirmRes.data)}`);
  console.log(`  \x1b[32m✓\x1b[0m Appointment confirmed by Nurse!`);
  console.log(`    - New Status: \x1b[32mApproved\x1b[0m`);
  console.log(`    - Scheduled Time: 2026-09-18 at 09:30 AM`);
  console.log(`    - Attending Staff: Nurse Maria Santos, RN`);
  console.log(`    - Nurse Notes: "${confirmRes.data?.bhw_notes || 'Confirmed'}"\n`);

  // STEP 4: Resident Checks Real-Time Live Status
  console.log('\x1b[1m[STEP 4: Resident Real-Time Status Verification]\x1b[0m');
  const resCheck = await request(`/appointments?barangay=Pianing`);
  const updatedForResident = (resCheck.data || []).find(a => a.id === appointmentId);
  if (!updatedForResident || updatedForResident.status !== 'Approved') {
    throw new Error(`Resident status mismatch! Expected Approved, got ${updatedForResident?.status}`);
  }
  console.log(`  \x1b[32m✓\x1b[0m Resident Portal receives live confirmed slot:`);
  console.log(`    - Status Badge: \x1b[32m${updatedForResident.status} (Confirmed Slot)\x1b[0m`);
  console.log(`    - Confirmed Date: ${updatedForResident.scheduled_date} at ${updatedForResident.scheduled_time}\n`);

  // STEP 5: Nurse Starts Consultation & Records Clinical Encounter
  console.log('\x1b[1m[STEP 5: Nurse Records Patient Consultation Encounter]\x1b[0m');
  const consultRes = await request('/consultations', {
    method: 'POST',
    body: JSON.stringify({
      patient_name: residentName,
      patient_phone: residentPhone,
      age: 29,
      gender: 'Male',
      chief_complaint: 'Fever (38.2 C), productive cough, and mild throat irritation for 2 days',
      blood_pressure: '120/80',
      temperature_c: 38.2,
      weight_kg: 68.5,
      diagnosis: 'Acute Upper Respiratory Tract Infection (URTI) with Acute Pharyngitis',
      treatment_prescription: 'Paracetamol 500mg tab TID for fever; Amoxicillin 500mg cap TID x 7 days; Oral rehydration',
      clinical_program: 'General Consultation',
      revisit_date: '2026-09-25',
      barangay: 'Pianing',
      consulted_by: 'Nurse Maria Santos, RN'
    })
  });

  if (!consultRes.ok) throw new Error(`Consultation recording failed: HTTP ${consultRes.status}: ${JSON.stringify(consultRes.data)}`);
  console.log(`  \x1b[32m✓\x1b[0m Consultation encounter recorded in clinical EHR registry!`);
  console.log(`    - Encounter ID: ${consultRes.data?.id || consultRes.data?.record?.id}`);
  console.log(`    - Vitals: BP 120/80, Temp 38.2°C, Weight 68.5kg`);
  console.log(`    - Diagnosis: Acute Upper Respiratory Tract Infection (URTI)`);
  console.log(`    - Prescribed: Paracetamol 500mg, Amoxicillin 500mg`);
  console.log(`    - Revisit Date: 2026-09-25\n`);

  // STEP 6: Nurse Completes Appointment
  console.log('\x1b[1m[STEP 6: Nurse Completes Appointment Lifecycle]\x1b[0m');
  const completeRes = await request(`/appointments/${appointmentId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'Completed',
      bhw_notes: 'Consultation concluded. Medications dispensed from health center inventory. Patient instructed for follow-up.'
    })
  });

  if (!completeRes.ok) throw new Error(`Completion failed: HTTP ${completeRes.status}`);
  console.log(`  \x1b[32m✓\x1b[0m Appointment successfully closed as \x1b[34mCompleted\x1b[0m!`);
  console.log(`    - Final Status: Completed`);
  console.log(`    - Notes: "${completeRes.data?.bhw_notes}"\n`);

  console.log('\x1b[42;30m === ALL 6 PHASES OF THE APPOINTMENT LIFECYCLE PASSED WITH 100% SUCCESS === \x1b[0m\n');
}

runAppointmentLifecycleTest().catch(err => {
  console.error('\n\x1b[41;37m TEST FAILED \x1b[0m', err);
  process.exit(1);
});
