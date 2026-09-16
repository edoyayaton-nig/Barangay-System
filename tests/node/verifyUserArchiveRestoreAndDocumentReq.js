// Automated Verification Script: Archive/Restore Resident User & Document Request Flow
const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('\n   \x1b[46;30m VERIFY: ARCHIVE, RESTORE & DOCUMENT REQUEST WORKFLOWS \x1b[0m\n');
  let passed = 0;
  let failed = 0;

  async function test(title, fn) {
    try {
      await fn();
      passed++;
      console.log(`  \x1b[32m✓\x1b[0m \x1b[90m${title}\x1b[0m`);
    } catch (err) {
      failed++;
      console.log(`  \x1b[31m✗\x1b[0m \x1b[31m${title}: ${err.message}\x1b[0m`);
    }
  }

  // 1. Find a resident user to test archive/restore
  let targetUser = null;
  await test('Fetch users and identify a resident user', async () => {
    const res = await fetch(`${BASE_URL}/users`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const users = await res.json();
    targetUser = users.find(u => u.role === 'resident') || users[users.length - 1];
    if (!targetUser) throw new Error('No user found to test');
    console.log(`     Target User ID: ${targetUser.id}, Name: ${targetUser.name}, Role: ${targetUser.role}, Status: ${targetUser.status}`);
  });

  // 2. Archive the user
  await test(`Archive user ${targetUser?.id} (PUT /api/users/:id { status: 'Archived' })`, async () => {
    const res = await fetch(`${BASE_URL}/users/${targetUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Archived' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const updated = await res.json();
    if (updated.status !== 'Archived' && (!updated.user || updated.user.status !== 'Archived')) {
      const checkRes = await fetch(`${BASE_URL}/users`);
      const allUsers = await checkRes.json();
      const fresh = allUsers.find(u => u.id === targetUser.id);
      if (fresh && fresh.status !== 'Archived') {
        throw new Error(`Expected status to be 'Archived', got '${fresh.status}'`);
      }
    }
  });

  // 3. Restore the user
  await test(`Restore user ${targetUser?.id} (PUT /api/users/:id { status: 'Active' })`, async () => {
    const res = await fetch(`${BASE_URL}/users/${targetUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Active' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const checkRes = await fetch(`${BASE_URL}/users`);
    const allUsers = await checkRes.json();
    const fresh = allUsers.find(u => u.id === targetUser.id);
    if (fresh && fresh.status !== 'Active') {
      throw new Error(`Expected status to be 'Active', got '${fresh.status}'`);
    }
    console.log(`     User ${targetUser.id} successfully restored to Active.`);
  });

  // 4. Request a document
  let createdDoc = null;
  await test('Request a civil clearance document (POST /api/documents)', async () => {
    const payload = {
      resident_name: targetUser?.name || 'Juan Dela Cruz',
      email: targetUser?.email || 'test.resident@gmail.com',
      document_type: 'Barangay Clearance',
      purpose: 'Employment Application & Identification',
      barangay: 'Pianing'
    };
    const res = await fetch(`${BASE_URL}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    createdDoc = await res.json();
    if (!createdDoc || !createdDoc.request_code) {
      throw new Error('Missing request_code in document response');
    }
    console.log(`     Created Document: ${createdDoc.request_code} (${createdDoc.document_type})`);
  });

  // 5. Verify created document exists in documents list
  await test(`Verify newly requested document exists in GET /api/documents`, async () => {
    const res = await fetch(`${BASE_URL}/documents`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const docs = await res.json();
    const match = docs.find(d => d.request_code === createdDoc.request_code);
    if (!match) throw new Error(`Document with request_code ${createdDoc.request_code} not found`);
    if (match.status !== 'Pending') {
      throw new Error(`Expected status 'Pending', got '${match.status}'`);
    }
    console.log(`     Found in registry: ID ${match.id}, Status: ${match.status}, Barangay: ${match.barangay}`);
  });

  // 6. Test Super Admin Resident Verification and Unverification
  await test('Verify resident approval (PUT /api/residents/:id/approve) and unverify', async () => {
    const resList = await fetch(`${BASE_URL}/residents`);
    const residents = await resList.json();
    if (residents.length === 0) throw new Error('No residents in database');
    const targetResident = residents[0];

    // Approve
    const approveRes = await fetch(`${BASE_URL}/residents/${targetResident.id}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: 'Super Admin Juan' })
    });
    if (!approveRes.ok) throw new Error(`Failed to approve resident: HTTP ${approveRes.status}`);

    // Verify status is Verified
    const freshProfile = await fetch(`${BASE_URL}/residents/${targetResident.id}/full-profile`);
    const profileData = await freshProfile.json();
    if (profileData.resident.verification_status !== 'Verified') {
      throw new Error(`Expected 'Verified', got '${profileData.resident.verification_status}'`);
    }
    console.log(`     Resident ${targetResident.id} is now Verified`);

    // Unverify
    const unverifyRes = await fetch(`${BASE_URL}/residents/${targetResident.id}/unverify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Unverified', reason: 'Automated test toggle' })
    });
    if (!unverifyRes.ok) throw new Error(`Failed to unverify resident: HTTP ${unverifyRes.status}`);
    console.log(`     Resident ${targetResident.id} successfully toggled back to Unverified`);
  });

  console.log(`\n   \x1b[32mResults: ${passed} Passed, ${failed} Failed\x1b[0m\n`);
  if (failed > 0) process.exit(1);
}

runTests();
