const token = process.env.DUPR_API_TOKEN;

async function testBothAPIs() {
  const endpoints = [
    { name: 'UAT (Testing)', url: 'https://uat.mydupr.com/api/player/v1.0/search?filter=L8EW8W&limit=10&offset=0&exclude=clubs' },
    { name: 'Production', url: 'https://api.dupr.gg/api/player/v1.0/search?filter=L8EW8W&limit=10&offset=0&exclude=clubs' },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}`);
    console.log('='.repeat(60));

    try {
      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'accept': 'application/json',
        },
      });

      console.log('Status:', response.status);

      const text = await response.text();

      if (response.ok) {
        const data = JSON.parse(text);
        console.log('✅ SUCCESS!');
        console.log('Results:', data.result?.length);
        if (data.result?.[0]) {
          console.log('Player:', data.result[0].fullName);
          console.log('DUPR ID:', data.result[0].id);
        }
      } else {
        console.log('❌ FAILED');
        console.log('Response:', text.substring(0, 200));
      }
    } catch (error) {
      console.log('💥 ERROR:', error.message);
    }
  }
}

testBothAPIs();
