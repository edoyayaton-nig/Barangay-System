import { 
  sendRegistrationEmail, 
  sendProfileUpdateEmail, 
  sendDocumentStatusEmail,
  sendEmail 
} from '../../server/services/emailService.js';
import dotenv from 'dotenv';
dotenv.config();

async function runEmailVerification() {
  console.log('================================================================');
  console.log('🧪 EMAIL NOTIFICATION VERIFICATION SUITE');
  console.log('================================================================');

  const testRecipients = [
    { email: 'edoyayaton@gmail.com', name: 'Edoy Ayaton', role: 'resident' },
    { email: 'rea.villacencio@csucc.edu.ph', name: 'Prof. Rea Villacencio', role: 'resident' }
  ];

  console.log(`Current Configuration:`);
  console.log(`- EMAIL_HOST: ${process.env.EMAIL_HOST || 'smtp.gmail.com'}`);
  console.log(`- EMAIL_PORT: ${process.env.EMAIL_PORT || '465'}`);
  console.log(`- EMAIL_USER: ${process.env.EMAIL_USER || '(not set)'}`);
  console.log(`- SMTP Active: ${Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS && !process.env.EMAIL_USER.includes('your_gmail'))}`);
  console.log('----------------------------------------------------------------\n');

  let passedTests = 0;
  let totalTests = 0;

  for (const recipient of testRecipients) {
    console.log(`\n📬 Testing Dispatches for Recipient: ${recipient.name} <${recipient.email}>`);

    // Test 1: Account Registration Email
    totalTests++;
    try {
      console.log(`\n  [1/3] Dispatching Account Creation / Registration Email...`);
      const regRes = await sendRegistrationEmail({
        to: recipient.email,
        fullName: recipient.name,
        role: recipient.role,
        tempPassword: 'TemporaryPass2026!'
      });
      console.log(`   Result:`, regRes);
      if (regRes.success) {
        console.log(`   ✅ Account registration email dispatched successfully.`);
        passedTests++;
      } else {
        console.warn(`   ⚠️ Registration email dispatch warning:`, regRes.error);
      }
    } catch (err) {
      console.error(`   ❌ Registration test threw error:`, err.message);
    }

    // Test 2: Resident Profile & Data Change Email
    totalTests++;
    try {
      console.log(`\n  [2/3] Dispatching Resident Profile Update Notification Email...`);
      const profileRes = await sendProfileUpdateEmail({
        to: recipient.email,
        fullName: recipient.name,
        changes: [
          'Contact Number: 09171234567 -> 09289876543',
          'Purok Address: Purok 1 -> Purok 3A',
          'Civil Status: Single -> Married',
          'Employment Status: Student -> Employed'
        ],
        date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
      });
      console.log(`   Result:`, profileRes);
      if (profileRes.success) {
        console.log(`   ✅ Profile update notification email dispatched successfully.`);
        passedTests++;
      } else {
        console.warn(`   ⚠️ Profile update email dispatch warning:`, profileRes.error);
      }
    } catch (err) {
      console.error(`   ❌ Profile update test threw error:`, err.message);
    }

    // Test 3: Document Request & Status Notification Email
    totalTests++;
    try {
      console.log(`\n  [3/3] Dispatching Document Request Status Notification Email...`);
      const docRes = await sendDocumentStatusEmail({
        to: recipient.email,
        recipientName: recipient.name,
        documentType: 'Certificate of Land Occupancy',
        requestCode: 'DOC-2026-088',
        status: 'Processing',
        message: 'Your request has been validated by the Barangay Agrarian & Land Desk and is scheduled for digital certification.'
      });
      console.log(`   Result:`, docRes);
      if (docRes.success) {
        console.log(`   ✅ Document request notification email dispatched successfully.`);
        passedTests++;
      } else {
        console.warn(`   ⚠️ Document request email dispatch warning:`, docRes.error);
      }
    } catch (err) {
      console.error(`   ❌ Document request test threw error:`, err.message);
    }
  }

  console.log('\n================================================================');
  console.log(`🏁 EMAIL SUITE SUMMARY: ${passedTests} / ${totalTests} tests passed`);
  console.log('================================================================');
  return passedTests === totalTests;
}

runEmailVerification().then(success => {
  if (!success) process.exit(1);
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
