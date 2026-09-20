// Built-in global fetch is used

async function run() {
  console.log('--- Testing Resident Profile Settings Email Change ---');

  const rand = Math.floor(1000 + Math.random() * 9000);
  const initialEmail = `resident.test.${rand}@gmail.com`;
  const updatedEmail = `resident.updated.${rand}@gmail.com`;
  const password = 'Password123!';

  // 1. Register a test resident
  console.log('1. Registering resident account:', initialEmail);
  const regRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Rosa',
      middle_name: 'Clara',
      last_name: `Santos${rand}`,
      email: initialEmail,
      password: password,
      phone: '09171234567',
      barangay: 'Pianing',
      purok: '3',
      city: 'Butuan City',
      gender: 'Female',
      civil_status: 'Single',
      date_of_birth: '1995-05-15',
      address: 'Purok 3, Barangay Pianing, Butuan City',
      years_of_residency: '5',
      employment_status: 'Employed',
      id_type: 'Philippine National ID (PhilSys)',
      submitted_id: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    })
  });

  const regData = await regRes.json();
  if (regRes.status !== 201 || !regData.user) {
    throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  }
  const userId = regData.user.id;
  console.log('✓ Resident registered with ID:', userId);

  // 2. Test updating profile with an already registered email (e.g. admin email or same user)
  console.log('2. Testing duplicate email prevention...');
  const dupRes = await fetch('http://localhost:5000/api/users/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: userId,
      email: initialEmail,
      new_email: 'juan.resident@gmail.com', // existing registered user email
      name: `Rosa Santos ${rand}`
    })
  });
  const dupData = await dupRes.json();
  if (dupRes.status === 400 && dupData.message.includes('already registered')) {
    console.log('✓ Duplicate email correctly rejected with 400:', dupData.message);
  } else {
    throw new Error(`Expected 400 duplicate error, got: ${dupRes.status} ${JSON.stringify(dupData)}`);
  }

  // 3. Test successfully changing email
  console.log('3. Updating email to:', updatedEmail);
  const updateRes = await fetch('http://localhost:5000/api/users/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: userId,
      email: initialEmail,
      new_email: updatedEmail,
      name: `Rosa Santos Updated ${rand}`,
      phone: '09179998888',
      purok: '4'
    })
  });

  const updateData = await updateRes.json();
  if (updateRes.status !== 200 || !updateData.success || updateData.email !== updatedEmail) {
    throw new Error(`Profile email update failed: ${JSON.stringify(updateData)}`);
  }
  console.log('✓ Profile email successfully changed to:', updateData.email);

  // 4. Test logging in with the new email
  console.log('4. Logging in with new email credentials...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: updatedEmail,
      password: password
    })
  });

  const loginData = await loginRes.json();
  if (loginRes.status !== 200 || !loginData.user || loginData.user.email.toLowerCase() !== updatedEmail.toLowerCase()) {
    throw new Error(`Login with new email failed: ${JSON.stringify(loginData)}`);
  }
  console.log('✓ Successfully logged into account using updated email:', loginData.user.email);

  console.log('All resident email change tests PASSED successfully!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
