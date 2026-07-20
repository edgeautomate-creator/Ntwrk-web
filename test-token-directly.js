const token = process.env.DUPR_API_TOKEN;

console.log('Testing DUPR API Token directly...\n');
console.log('Token exists:', !!token);
console.log('Token length:', token?.length);
console.log('Token preview:', token?.substring(0, 50) + '...\n');

async function testToken() {
  try {
    console.log('Step 1: Testing direct DUPR API call...');
    const response = await fetch('https://uat.mydupr.com/api/player/v1.0/L8EW8W?exclude=clubs', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept': 'application/json',
      },
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    const text = await response.text();
    console.log('Response body:', text.substring(0, 500));

    if (response.ok) {
      console.log('\n✅ Token is VALID - DUPR API accepts it');
      const data = JSON.parse(text);
      console.log('Player name:', data.result?.fullName);
    } else {
      console.log('\n❌ Token is INVALID - DUPR API rejected it');
      console.log('This means the token needs to be regenerated');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testToken();
