import mysql from 'mysql2/promise';

async function pruneDatabase() {
  console.log('--- Starting Smart Barangay Database Pruning ---');
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'smart_db',
    multipleStatements: true
  });

  try {
    // 1. Prune Document Requests down to 10 pristine canonical records
    console.log('Pruning document_requests...');
    await pool.query("DELETE FROM document_requests WHERE resident_name LIKE '%test%' OR resident_name LIKE '%haha%' OR resident_name LIKE '%API%'");
    
    // Check remaining count
    const [docs] = await pool.query("SELECT id FROM document_requests ORDER BY id ASC");
    if (docs.length > 10) {
      const keepIds = docs.slice(0, 10).map(d => d.id);
      await pool.query("DELETE FROM document_requests WHERE id NOT IN (?)", [keepIds]);
    } else if (docs.length < 10) {
      // Ensure we have 10 realistic diverse documents
      const needed = 10 - docs.length;
      const sampleDocs = [
        ['DOC-2026-001', 'Juan Perez Dela Cruz', 'Barangay Clearance', 'Employment Requirements', 'Pianing', 'Completed', 'juan.resident@gmail.com'],
        ['DOC-2026-002', 'Josefina Villanueva', 'Certificate of Indigency', 'DSWD Assistance / Medical Aid', 'Pianing', 'Completed', 'josefina.resident@gmail.com'],
        ['DOC-2026-003', 'Ramon Castillo', 'Certificate of Residency', 'Bank Account Opening', 'Pianing', 'Completed', 'ramon.test@gmail.com'],
        ['DOC-2026-004', 'Maria Teresa Santos', 'Barangay ID', 'Government Primary Valid ID', 'Pianing', 'Completed', 'maria.santos@gmail.com'],
        ['DOC-2026-005', 'Gabriel Alcantara', 'Business Permit Clearance', 'Sari-Sari Store Local Permit', 'Pianing', 'Completed', 'gabriel.store@gmail.com'],
        ['DOC-2026-006', 'Rosa Linda Flores', 'Barangay Clearance', 'Passport Application', 'Pianing', 'Processing', 'rosa.flores@gmail.com'],
        ['DOC-2026-007', 'Eduardo Ramos Jr.', 'Certificate of Residency', 'College Scholarship Application', 'Pianing', 'Processing', 'eduardo.ramos@gmail.com'],
        ['DOC-2026-008', 'Corazon Aquino Diaz', 'Certificate of Indigency', 'Hospital Bill Subsidy', 'Pianing', 'Pending', 'corazon.diaz@gmail.com'],
        ['DOC-2026-009', 'Danilo Bautista', 'Barangay Clearance', 'Security Guard Employment', 'Pianing', 'Pending', 'danilo.bautista@gmail.com'],
        ['DOC-2026-010', 'Kristine Joy Morales', 'Barangay ID', 'Senior Citizen Accompanying ID', 'Pianing', 'Pending', 'kristine.morales@gmail.com']
      ];
      for (let i = 0; i < needed; i++) {
        const d = sampleDocs[i % sampleDocs.length];
        await pool.query(
          `INSERT INTO document_requests 
           (request_code, resident_name, document_type, purpose, barangay, status, email, requested_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          d
        );
      }
    }
    const [[{ docCount }]] = await pool.query("SELECT COUNT(*) as docCount FROM document_requests");
    console.log(`Document Requests baseline: ${docCount} records.`);

    // 2. Clean testing resident users & retain exactly 10 clean Pending Approvals
    console.log('Pruning pending users...');
    // Delete garbage test accounts
    await pool.query(`
      DELETE FROM users 
      WHERE role = 'resident' 
        AND (
          name LIKE '%test%' 
          OR name LIKE '%haha%' 
          OR name LIKE '%edoy%' 
          OR name LIKE '%idol%' 
          OR name LIKE '%dnfgn%' 
          OR email LIKE '%test%' 
          OR email LIKE '%test1%' 
          OR email LIKE '%es@%'
        )
    `);

    // Clean pending residents
    const [pendingUsers] = await pool.query("SELECT id FROM users WHERE role = 'resident' AND verification_status IN ('Pending', 'Pending_Review') ORDER BY id ASC");
    if (pendingUsers.length > 10) {
      const keepPending = pendingUsers.slice(0, 10).map(u => u.id);
      await pool.query("DELETE FROM users WHERE role = 'resident' AND verification_status IN ('Pending', 'Pending_Review') AND id NOT IN (?)", [keepPending]);
    } else if (pendingUsers.length < 10) {
      const neededPending = 10 - pendingUsers.length;
      const samplePending = [
        ['Althea Mae Santos', 'althea.santos@gmail.com', '09175550001', 'Purok 1, Pianing', 'Pianing'],
        ['Benjamin Cruz', 'benjamin.cruz@gmail.com', '09175550002', 'Purok 2, Pianing', 'Pianing'],
        ['Catherine Reyes', 'catherine.reyes@gmail.com', '09175550003', 'Purok 3, Pianing', 'Pianing'],
        ['Dominic Soriano', 'dominic.soriano@gmail.com', '09175550004', 'Purok 1, Pianing', 'Pianing'],
        ['Eleanor Vargas', 'eleanor.vargas@gmail.com', '09175550005', 'Purok 4, Pianing', 'Pianing'],
        ['Fernando Silva', 'fernando.silva@gmail.com', '09175550006', 'Purok 2, Pianing', 'Pianing'],
        ['Giselle Mendoza', 'giselle.mendoza@gmail.com', '09175550007', 'Purok 5, Pianing', 'Pianing'],
        ['Harold Navarro', 'harold.navarro@gmail.com', '09175550008', 'Purok 3, Pianing', 'Pianing'],
        ['Isabel Pineda', 'isabel.pineda@gmail.com', '09175550009', 'Purok 1, Pianing', 'Pianing'],
        ['Jerome Garcia', 'jerome.garcia@gmail.com', '09175550010', 'Purok 2, Pianing', 'Pianing']
      ];
      for (let i = 0; i < neededPending; i++) {
        const p = samplePending[i % samplePending.length];
        await pool.query(
          `INSERT INTO users 
           (name, email, password_hash, role, phone, address, barangay, verification_status, status, created_at)
           VALUES (?, ?, '$2b$10$wT3b8g6LhPjZ6Bfxj4lVTuZ0dM1qI2uGq7P9q7k7aY8cZ3jA4g4dC', 'resident', ?, ?, ?, 'Pending_Review', 'Active', NOW())`,
          p
        );
      }
    }
    const [[{ pendingCount }]] = await pool.query("SELECT COUNT(*) as pendingCount FROM users WHERE role = 'resident' AND verification_status IN ('Pending', 'Pending_Review')");
    console.log(`Pending Approvals baseline: ${pendingCount} records.`);

    // 3. Clean residents table (Resident Management) down to verified baseline
    console.log('Pruning residents table...');
    await pool.query(`
      DELETE FROM residents 
      WHERE first_name LIKE '%test%' 
         OR last_name LIKE '%test%' 
         OR first_name LIKE '%haha%' 
         OR last_name LIKE '%haha%' 
         OR first_name LIKE '%API%'
         OR email LIKE '%test%'
         OR email LIKE '%haha%'
    `);

    // Ensure all residents remaining have verification_status = 'Verified'
    await pool.query("UPDATE residents SET verification_status = 'Verified' WHERE verification_status IS NULL OR verification_status = '' OR verification_status = 'Pending'");

    const [verifiedResidents] = await pool.query("SELECT id FROM residents WHERE verification_status = 'Verified' ORDER BY id ASC");
    if (verifiedResidents.length > 15) {
      const keepRes = verifiedResidents.slice(0, 15).map(r => r.id);
      await pool.query("DELETE FROM residents WHERE id NOT IN (?)", [keepRes]);
    }
    const [[{ residentCount }]] = await pool.query("SELECT COUNT(*) as residentCount FROM residents WHERE verification_status = 'Verified'");
    console.log(`Verified Residents baseline: ${residentCount} records.`);

    // 4. Prune health appointments down to 10 clean appointments
    console.log('Pruning health_appointments...');
    await pool.query("DELETE FROM health_appointments WHERE resident_name LIKE '%test%' OR resident_name LIKE '%haha%'");
    const [apts] = await pool.query("SELECT id FROM health_appointments ORDER BY id DESC");
    if (apts.length > 10) {
      const keepApts = apts.slice(0, 10).map(a => a.id);
      await pool.query("DELETE FROM health_appointments WHERE id NOT IN (?)", [keepApts]);
    }
    const [[{ aptCount }]] = await pool.query("SELECT COUNT(*) as aptCount FROM health_appointments");
    console.log(`Health Appointments baseline: ${aptCount} records.`);

    // 5. Prune clinical encounters down to 10 clean records
    console.log('Pruning clinical_encounters...');
    await pool.query("DELETE FROM clinical_encounters WHERE patient_name LIKE '%test%' OR patient_name LIKE '%haha%'");
    const [encs] = await pool.query("SELECT id FROM clinical_encounters ORDER BY id DESC");
    if (encs.length > 10) {
      const keepEncs = encs.slice(0, 10).map(e => e.id);
      await pool.query("DELETE FROM clinical_encounters WHERE id NOT IN (?)", [keepEncs]);
    }
    const [[{ encCount }]] = await pool.query("SELECT COUNT(*) as encCount FROM clinical_encounters");
    console.log(`Clinical Encounters baseline: ${encCount} records.`);

    // 6. Confirm schedules and inventory are 100% PRESERVED
    const [[{ schedCount }]] = await pool.query("SELECT COUNT(*) as schedCount FROM clinic_schedules");
    const [[{ invCount }]] = await pool.query("SELECT COUNT(*) as invCount FROM inventory");
    console.log(`Inventory preserved: ${invCount} items. Clinic Schedules preserved: ${schedCount} schedules.`);

    console.log('--- Database Pruning Completed Successfully ---');
  } catch (err) {
    console.error('Pruning error:', err);
  } finally {
    await pool.end();
  }
}

pruneDatabase();
