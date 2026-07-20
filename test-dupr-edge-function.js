const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testEdgeFunction() {
  console.log('Testing DUPR Edge Function...\n');
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('Has anon key:', !!SUPABASE_ANON_KEY, '\n');

  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/dupr-search-player`;
  console.log('Edge Function URL:', edgeFunctionUrl);
  console.log('Query: L8EW8W\n');

  try {
    const response = await fetch(`${edgeFunctionUrl}?query=L8EW8W`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response Status:', response.status);
    console.log('Response OK:', response.ok);
    console.log('Response Headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    const text = await response.text();
    console.log('\nResponse Body:');
    console.log(text);

    if (response.ok) {
      console.log('\n✅ Edge function returned success!');
      const data = JSON.parse(text);
      console.log('Players found:', data.players?.length);
      if (data.players?.[0]) {
        console.log('First player:', data.players[0].fullName);
      }
    } else {
      console.log('\n❌ Edge function returned error');
      console.log('This is the "non-2xx status code" error you\'re seeing');
    }
  } catch (error) {
    console.error('\n💥 Request failed:', error.message);
  }
}

testEdgeFunction();
