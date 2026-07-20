const token = process.env.DUPR_API_TOKEN;

async function testSearchEndpoint() {
  console.log('Testing DUPR Search Endpoint...\n');

  try {
    const url = 'https://uat.mydupr.com/api/player/v1.0/search?filter=L8EW8W&limit=10&offset=0&exclude=clubs';
    console.log('URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept': 'application/json',
      },
    });

    console.log('Status:', response.status);
    console.log('OK:', response.ok);

    const text = await response.text();
    console.log('\nResponse:');
    console.log(text.substring(0, 1000));

    if (response.ok) {
      const data = JSON.parse(text);
      console.log('\n✅ Search endpoint works!');
      console.log('Results found:', data.result?.length);
      if (data.result?.[0]) {
        console.log('First result:', data.result[0].fullName);
      }
    } else {
      console.log('\n❌ Search endpoint failed');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSearchEndpoint();
