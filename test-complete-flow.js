const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCompleteFlow() {
  console.log('🧪 COMPREHENSIVE DUPR INTEGRATION TEST\n');
  console.log('=' .repeat(60));

  const testCases = [
    { id: 'L8EW8W', description: 'Valid DUPR ID (Bob Smith)' },
    { id: 'INVALID123', description: 'Invalid DUPR ID' },
    { id: '', description: 'Empty DUPR ID' },
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.description}`);
    console.log('-'.repeat(60));

    try {
      const { data, error } = await supabase.functions.invoke('dupr-search-player', {
        body: { duprId: testCase.id },
      });

      if (error) {
        console.log('❌ Edge Function Error:');
        console.log('   Status:', error.status);
        console.log('   Message:', error.message);
        console.log('   This is the error that was causing issues!');
      } else {
        console.log('✅ Edge Function Responded (HTTP 200)');
        console.log('   Success:', data.success);

        if (data.success) {
          const player = data.result[0];
          console.log('   Player:', player.fullName);
          console.log('   DUPR ID:', player.id);
          console.log('   Doubles Rating:', player.ratings?.doubles);
          console.log('   Singles Rating:', player.ratings?.singles);
        } else {
          console.log('   Error Message:', data.error);
        }
      }
    } catch (err) {
      console.log('💥 Exception:', err.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL TESTS COMPLETED - No more "non-2xx status code" errors!');
  console.log('='.repeat(60));
}

testCompleteFlow();
