// Verification Test: Enforcing Residency Verification on Appointment Booking
const BASE_URL = 'http://localhost:5000/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runAppointmentVerificationTests() {
  console.log('\n   \x1b[45;37m VERIFY: APPOINTMENT RESIDENCY VERIFICATION ENFORCEMENT \x1b[0m\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  \x1b[32m✓\x1b[0m \x1b[90m${name}\x1b[0m`);
    } catch (err) {
      failed++;
      console.log(`  \x1b[31m✗\x1b[0m \x1b[31m${name}: ${err.message}\x1b[0m`);
    }
  }

  // 1. Missing identification (no resident_id and no resident_email)
  await test('Reject booking when identification is missing (HTTP 400)', async () => {
    const res = await request('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        resident_name: 'Anonymous Person',
        service_type: 'General Consultation',
        preferred_date: '2026-09-25'
      })
    });
    if (res.status !== 400) throw new Error(`Expected HTTP 400, got ${res.status}`);
    if (!res.data?.message?.includes('required')) throw new Error(`Unexpected message: ${res.data?.message}`);
  });

  // 2. Unregistered guest email (not in system)
  await test('Reject booking from unregistered guest email (HTTP 403)', async () => {
    const res = await request('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        resident_email: `unregistered.stranger.${Date.now()}@gmail.com`,
        resident_name: 'Stranger In City',
        service_type: 'General Consultation',
        preferred_date: '2026-09-25'
      })
    });
    if (res.status !== 403) throw new Error(`Expected HTTP 403, got ${res.status}`);
    if (!res.data?.message?.toLowerCase().includes('verification required')) {
      throw new Error(`Expected verification required message, got: ${res.data?.message}`);
    }
  });

  // 3. Registered resident with 'Pending_Review' status
  let pendingResident = null;
  await test('Reject booking from Pending_Review resident (HTTP 403)', async () => {
    // Create a pending resident
    const ts = Date.now();
    const uniqueEmail = `test.pending.applicant.${ts}@gmail.com`;
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        first_name: `Pending${ts}`,
        last_name: `Applicant${ts}`,
        name: `Pending${ts} Applicant${ts}`,
        email: uniqueEmail,
        password: 'Password123!',
        phone: '09170001122',
        barangay: 'Pianing',
        purok: '1',
        submitted_id: 'data:image/png;base64,SAMPLE_ID'
      })
    });
    pendingResident = { id: regRes.data?.user?.id, email: uniqueEmail };

    const bookRes = await request('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        resident_id: pendingResident.id,
        resident_email: pendingResident.email,
        resident_name: 'Pending Applicant',
        service_type: 'General Consultation',
        preferred_date: '2026-09-25'
      })
    });
    if (bookRes.status !== 403) throw new Error(`Expected HTTP 403, got ${bookRes.status}`);
    if (!bookRes.data?.message?.toLowerCase().includes('pending')) {
      throw new Error(`Expected message stating pending review, got: ${bookRes.data?.message}`);
    }
  });

  // 4. Resident with 'Rejected' status
  await test('Reject booking from Rejected resident (HTTP 403)', async () => {
    if (!pendingResident?.id) throw new Error('No test resident available');
    // Reject resident
    await request(`/residents/${pendingResident.id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason: 'Illegible ID photo' })
    });

    const bookRes = await request('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        resident_id: pendingResident.id,
        resident_email: pendingResident.email,
        resident_name: 'Rejected Applicant',
        service_type: 'General Consultation',
        preferred_date: '2026-09-25'
      })
    });
    if (bookRes.status !== 403) throw new Error(`Expected HTTP 403, got ${bookRes.status}`);
    if (!bookRes.data?.message?.toLowerCase().includes('rejected')) {
      throw new Error(`Expected message stating rejected ID, got: ${bookRes.data?.message}`);
    }
  });

  // 5. Approved / Verified resident
  await test('Allow booking for Verified resident (HTTP 201)', async () => {
    if (!pendingResident?.id) throw new Error('No test resident available');
    // Approve and verify resident
    const approveRes = await request(`/residents/${pendingResident.id}/approve`, {
      method: 'PUT'
    });
    if (!approveRes.ok) throw new Error(`Failed to approve resident: ${approveRes.data?.message}`);

    const bookRes = await request('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        resident_id: pendingResident.id,
        resident_email: pendingResident.email,
        resident_name: 'Verified Citizen',
        service_type: 'General Consultation',
        preferred_date: '2026-09-25',
        preferred_time: 'Morning (8:00 AM - 11:30 AM)'
      })
    });
    if (bookRes.status !== 201) throw new Error(`Expected HTTP 201, got ${bookRes.status}: ${bookRes.data?.message}`);
    if (!bookRes.data?.appointment_code) throw new Error('Expected valid appointment_code');
    if (bookRes.data?.status !== 'Pending') throw new Error(`Expected initial status Pending, got ${bookRes.data?.status}`);
  });

  console.log(`\n\x1b[1mSummary: ${passed} passed, ${failed} failed.\x1b[0m\n`);
  if (failed > 0) process.exit(1);
}

runAppointmentVerificationTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
