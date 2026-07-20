const SUPABASE_URL = 'https://evsrrxfqxbgaubxskpko.supabase.co';

async function testUATAuth() {
  console.log('Testing DUPR UAT Authentication...\n');

  // You need to provide your UAT test credentials
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Usage: node test-uat-auth.js <email> <password>');
    process.exit(1);
  }

  try {
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${'*'.repeat(password.length)}\n`);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/dupr-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response Headers:`, Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log(`📦 Raw Response Body:\n${responseText}\n`);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('✅ SUCCESS!');
      console.log('📦 Parsed Response:');
      console.log(`   - User Token: ${data.userToken ? 'PRESENT' : 'MISSING'}`);
      console.log(`   - Refresh Token: ${data.refreshToken ? 'PRESENT' : 'MISSING'}`);
      console.log(`   - DUPR ID: ${data.duprId}`);
      console.log(`   - Email: ${data.email}`);
      console.log(`   - Full Name: ${data.fullName}`);
      console.log(`   - Singles Rating: ${data.stats?.singles || 'N/A'}`);
      console.log(`   - Doubles Rating: ${data.stats?.doubles || 'N/A'}`);
    } else {
      console.error('❌ FAILED');
      try {
        const errorData = JSON.parse(responseText);
        console.error('Error:', errorData);
      } catch {
        console.error('Raw error:', responseText);
      }
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
    console.error(error);
  }
}

testUATAuth();
