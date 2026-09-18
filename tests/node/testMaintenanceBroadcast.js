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

  // 2. Fetch GET maintenance
  const getRes = await fetch('http://localhost:5000/api/system/maintenance');
  const getData = await getRes.json();

  if (!getData.enabled || getData.type !== 'down') {
    throw new Error(`GET maintenance mismatch: ${JSON.stringify(getData)}`);
  }
  console.log('✓ GET /api/system/maintenance confirmed enabled: true with down type');

  // 3. Verify file storage
  const filePath = path.join(__dirname, '..', '..', 'server', 'data', 'maintenance.json');
  const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!fileContent.enabled || fileContent.type !== 'down') {
    throw new Error('maintenance.json did not persist enabled: true');
  }
  console.log('✓ server/data/maintenance.json confirmed persisted state');

  console.log('All maintenance broadcast checks PASSED!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
