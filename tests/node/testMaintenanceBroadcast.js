import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('--- Testing System Maintenance Broadcast API ---');

  // 1. Activate broadcast with Outage preset
  const activateRes = await fetch('http://localhost:5000/api/system/maintenance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enabled: true,
      type: 'down',
      title: 'CRITICAL ALERT: System is Temporarily Down',
      message: 'The Barangay Information System is currently experiencing an unexpected database server outage.',
      estimated_uptime: 'Expected recovery: Within 1 hour'
    })
  });

  const activateData = await activateRes.json();
  if (activateRes.status !== 200 || !activateData.success) {
    throw new Error(`Activation failed: ${JSON.stringify(activateData)}`);
  }
  console.log('✓ POST /api/system/maintenance successfully activated broadcast');

  // 2. Fetch GET maintenance (confirm active)
  const getActiveRes = await fetch('http://localhost:5000/api/system/maintenance');
  const getActiveData = await getActiveRes.json();

  if (!getActiveData.enabled || getActiveData.type !== 'down') {
    throw new Error(`GET maintenance mismatch: ${JSON.stringify(getActiveData)}`);
  }
  console.log('✓ GET /api/system/maintenance confirmed enabled: true with down type');

  // 3. Deactivate broadcast (Turn OFF)
  const deactivateRes = await fetch('http://localhost:5000/api/system/maintenance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enabled: false,
      type: 'down',
      title: 'CRITICAL ALERT: System is Temporarily Down',
      message: 'The system is normal.',
      estimated_uptime: ''
    })
  });

  const deactivateData = await deactivateRes.json();
  if (deactivateRes.status !== 200 || !deactivateData.success || deactivateData.maintenance.enabled !== false) {
    throw new Error(`Deactivation failed: ${JSON.stringify(deactivateData)}`);
  }
  console.log('✓ POST /api/system/maintenance successfully deactivated broadcast (Turned OFF)');

  // 4. Fetch GET maintenance (confirm disabled)
  const getDeactRes = await fetch('http://localhost:5000/api/system/maintenance');
  const getDeactData = await getDeactRes.json();

  if (getDeactData.enabled !== false) {
    throw new Error(`GET maintenance mismatch: expected enabled: false, got: ${JSON.stringify(getDeactData)}`);
  }
  console.log('✓ GET /api/system/maintenance confirmed enabled: false (broadcast OFF)');

  // 5. Verify file storage persistence
  const filePath = path.join(__dirname, '..', '..', 'server', 'data', 'maintenance.json');
  const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (fileContent.enabled !== false) {
    throw new Error('maintenance.json did not persist enabled: false');
  }
  console.log('✓ server/data/maintenance.json confirmed persisted enabled: false state');

  console.log('All maintenance broadcast activate AND deactivate checks PASSED!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
