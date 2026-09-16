import assert from 'assert';

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('🧪 VERIFYING CLINICAL DISPENSING FREEDOM & RESIDENT RECORDS TRACKING');

  // 1. Check inventory before dispensing
  const invRes = await fetch(`${BASE_URL}/api/inventory?barangay=Pianing`);
  const invBefore = await invRes.json();
  const paracetamolBefore = invBefore.find(i => i.item_name.toLowerCase().includes('paracetamol')) || invBefore[0];
  console.log(`📦 Initial inventory for "${paracetamolBefore.item_name}": ${paracetamolBefore.stock} ${paracetamolBefore.unit}`);

  // 2. Dispense EXACTLY 1 unit (Testing freedom to give starting from 1)
  const consultPayload1 = {
    patient_name: 'Test Resident Maria Santos',
    contact_number: '09171234567',
    age: 28,
    gender: 'Female',
    barangay: 'Pianing',
    service_type: 'General Consultation',
    bp: '120/80',
    temp: '36.7',
    weight: '55',
    heart_rate: '76',
    chief_complaint: 'Mild headache',
    diagnosis: 'Tension headache',
    treatment: 'Rest and hydration',
    prescriptions: [
      {
        name: paracetamolBefore.item_name,
        dosage: '500mg',
        frequency: '1 tab as needed',
        duration: '1 day',
        quantity: 1, // FREEDOM TO GIVE STARTING FROM 1
        unit: paracetamolBefore.unit || 'tablets'
      }
    ],
    attending_nurse: 'Nurse Maria Santos'
  };

  const consultRes1 = await fetch(`${BASE_URL}/api/consultations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(consultPayload1)
  });
  assert.strictEqual(consultRes1.status, 201, 'Consultation with Qty=1 should succeed');
  const consultData1 = await consultRes1.json();
  console.log(`✓ Consultation logged with 1x ${paracetamolBefore.item_name}. Prescribed meds: "${consultData1.prescribed_meds}"`);
  assert(consultData1.prescribed_meds.includes('Qty: 1'), 'Prescribed meds string should state Qty: 1');

  // Wait 100ms for async inventory deduction
  await new Promise(r => setTimeout(r, 200));

  // Verify inventory reduced by exactly 1
  const invResAfter1 = await fetch(`${BASE_URL}/api/inventory?barangay=Pianing`);
  const invAfter1 = await invResAfter1.json();
  const paracetamolAfter1 = invAfter1.find(i => i.id === paracetamolBefore.id);
  console.log(`📦 Inventory after 1 unit dispensed: ${paracetamolAfter1.stock} ${paracetamolAfter1.unit}`);
  assert.strictEqual(paracetamolAfter1.stock, paracetamolBefore.stock - 1, 'Stock should decrease by exactly 1');

  // 3. Dispense a custom quantity (e.g. 14 units)
  const consultPayload14 = {
    patient_name: 'Test Resident Maria Santos',
    contact_number: '09171234567',
    age: 28,
    gender: 'Female',
    barangay: 'Pianing',
    service_type: 'General Consultation',
    bp: '120/80',
    temp: '36.8',
    chief_complaint: 'Bacterial infection follow-up',
    diagnosis: 'Pharyngitis',
    treatment: 'Antibiotic therapy',
    prescriptions: [
      {
        name: paracetamolBefore.item_name,
        dosage: '500mg',
        frequency: '1 tab 3x daily',
        duration: '5 days',
        quantity: 14, // CUSTOM FREEDOM QUANTITY
        unit: paracetamolBefore.unit || 'tablets'
      }
    ],
    attending_nurse: 'Nurse Maria Santos'
  };

  const consultRes14 = await fetch(`${BASE_URL}/api/consultations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(consultPayload14)
  });
  assert.strictEqual(consultRes14.status, 201, 'Consultation with Qty=14 should succeed');
  const consultData14 = await consultRes14.json();
  console.log(`✓ Consultation logged with 14x ${paracetamolBefore.item_name}. Prescribed meds: "${consultData14.prescribed_meds}"`);
  assert(consultData14.prescribed_meds.includes('Qty: 14'), 'Prescribed meds string should state Qty: 14');

  await new Promise(r => setTimeout(r, 200));
  const invResAfter14 = await fetch(`${BASE_URL}/api/inventory?barangay=Pianing`);
  const invAfter14 = await invResAfter14.json();
  const paracetamolAfter14 = invAfter14.find(i => i.id === paracetamolBefore.id);
  console.log(`📦 Inventory after 14 units dispensed: ${paracetamolAfter14.stock} ${paracetamolAfter14.unit}`);
  assert.strictEqual(paracetamolAfter14.stock, paracetamolAfter1.stock - 14, 'Stock should decrease by exactly 14');

  // 4. Test Vaccine Dispensing freedom (start from 1 vial)
  const vaccineBefore = invAfter14.find(i => i.category === 'Vaccine (EPI)') || invAfter14.find(i => i.item_name.toLowerCase().includes('pentavalent') || i.item_name.toLowerCase().includes('bcg')) || invAfter14[1];
  console.log(`💉 Initial vaccine stock for "${vaccineBefore.item_name}": ${vaccineBefore.stock} ${vaccineBefore.unit}`);

  const immunPayload = {
    child_name: 'Baby Juan Santos',
    guardian: 'Maria Santos',
    parent_name: 'Maria Santos',
    contact_number: '09171234567',
    age_months: '3',
    gender: 'Male',
    barangay: 'Pianing',
    vaccine_given: vaccineBefore.item_name,
    dose_number: 'Dose 1',
    dose_count: 1, // STARTING FROM 1
    quantity: 1,
    batch_number: 'LOT-EPI-9901',
    date_given: new Date().toISOString().split('T')[0],
    next_due_date: '2026-10-15',
    attending_nurse: 'Nurse Maria Santos'
  };

  const immunRes = await fetch(`${BASE_URL}/api/immunizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(immunPayload)
  });
  assert.strictEqual(immunRes.status, 201, 'Immunization should succeed');
  console.log(`✓ Child immunization logged with 1 vial of ${vaccineBefore.item_name}`);

  await new Promise(r => setTimeout(r, 200));
  const invResAfterVaccine = await fetch(`${BASE_URL}/api/inventory?barangay=Pianing`);
  const invAfterVaccine = await invResAfterVaccine.json();
  const vaccineAfter = invAfterVaccine.find(i => i.id === vaccineBefore.id);
  console.log(`💉 Vaccine stock after 1 dose dispensed: ${vaccineAfter.stock} ${vaccineAfter.unit}`);
  assert.strictEqual(vaccineAfter.stock, vaccineBefore.stock - 1, 'Vaccine stock should decrease by exactly 1');

  // 5. Test Maternal Record creation with Prenatal Vitamins
  const maternalPayload = {
    mother_name: 'Maria Santos',
    patient_name: 'Maria Santos',
    age: 28,
    contact_number: '09171234567',
    barangay: 'Pianing',
    gravida: 'G2',
    para: 'P1',
    lmp: '2026-04-01',
    edd: '2027-01-08',
    aog_weeks: '24',
    bp: '115/75',
    weight: '58.0',
    temp: '36.5',
    fetal_heart_rate: '146 bpm',
    fundic_height: '24 cm',
    next_visit: '2026-10-08',
    next_visit_date: '2026-10-08',
    prescribed_meds: 'FeSO4 + Folic Acid 400mcg daily (Qty: 30 tablets)',
    med_quantity: 30,
    attending_nurse: 'Nurse Maria Santos'
  };

  const matRes = await fetch(`${BASE_URL}/api/maternal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(maternalPayload)
  });
  assert.strictEqual(matRes.status, 201, 'Maternal record should be created');
  console.log(`✓ Maternal record logged with 30 tablets FeSO4 + Folic Acid`);

  // 6. Test Resident Records Retrieval (Can resident track their records?)
  const residentName = 'Maria Santos';
  const residentPhone = '09171234567';

  // Get all consultations for resident
  const allConsRes = await fetch(`${BASE_URL}/api/consultations?barangay=Pianing`);
  const allCons = await allConsRes.json();
  const residentCons = allCons.filter(c => 
    (c.patient_name && c.patient_name.toLowerCase().includes(residentName.toLowerCase())) ||
    (c.contact_number && c.contact_number.includes('09171234567'))
  );
  console.log(`✓ Resident Consultations tracked: ${residentCons.length} record(s) found`);
  assert(residentCons.length >= 2, 'Resident should have at least 2 consultations');
  const targetWithMeds = residentCons.find(c => c.prescribed_meds && c.prescribed_meds.includes('Qty:'));
  assert(targetWithMeds, 'Prescriptions should clearly show dispensed quantity');

  // Get maternal records for resident
  const allMatRes = await fetch(`${BASE_URL}/api/maternal`);
  const allMat = await allMatRes.json();
  const residentMat = allMat.filter(m =>
    (m.mother_name && m.mother_name.toLowerCase().includes(residentName.toLowerCase())) ||
    (m.patient_name && m.patient_name.toLowerCase().includes(residentName.toLowerCase())) ||
    (m.contact_number && m.contact_number.includes('09171234567'))
  );
  console.log(`✓ Resident Maternal Records tracked: ${residentMat.length} record(s) found`);
  assert(residentMat.length >= 1, 'Resident should have maternal record');
  console.log(`  - Gestation AOG: ${residentMat[0].aog_weeks} wks, FHR: ${residentMat[0].fetal_heart_rate}, Next Visit: ${residentMat[0].next_visit}`);

  // Get child immunization records for resident
  const allImmRes = await fetch(`${BASE_URL}/api/immunizations`);
  const allImm = await allImmRes.json();
  const residentImm = allImm.filter(i => {
    const gName = (i.guardian_name || i.parent_name || i.guardian || '').toLowerCase();
    const cName = (i.child_name || '').toLowerCase();
    const phone = (i.parent_phone || i.contact_number || i.phone || '').replace(/\D/g, '');
    if (gName.includes('maria santos') || cName.includes('maria santos')) return true;
    if (phone.includes('09171234567')) return true;
    return false;
  });
  console.log(`✓ Resident Child Immunization Cards tracked: ${residentImm.length} record(s) found`);
  assert(residentImm.length >= 1, 'Resident should have child immunization record');
  console.log(`  - Child: ${residentImm[0].child_name}, Vaccine: ${residentImm[0].vaccine_given} (${residentImm[0].dose_number})`);

  console.log('\n🎉 ALL CLINICAL DISPENSING & RESIDENT TRACKING TESTS PASSED PERFECTLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
