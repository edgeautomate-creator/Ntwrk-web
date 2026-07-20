const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testEdgeFunctionCorrectly() {
  console.log('Testing DUPR Edge Function with correct POST method...\n');

  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/dupr-search-player`;
  
  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ duprId: 'L8EW8W' }),
    });

    console.log('Response Status:', response.status);
    console.log('Response OK:', response.ok);

    const text = await response.text();
    console.log('\nResponse Body:');
    console.log(text);

    if (response.ok) {
      const data = JSON.parse(text);
      if (data.success) {
        console.log('\n✅ SUCCESS!');
        console.log('Players found:', data.result?.length);
        if (data.result?.[0]) {
          console.log('Player:', data.result[0].fullName);
          console.log('DUPR ID:', data.result[0].id);
        }
      } else {
        console.log('\n❌ Edge function returned error:');
        console.log(data.error);
      }
    }
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testEdgeFunctionCorrectly();
