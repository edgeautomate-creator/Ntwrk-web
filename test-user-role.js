const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://evsrrxfqxbgaubxskpko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2c3JyeGZxeGJnYXVieHNrcGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzA1ODUsImV4cCI6MjA4Njc0NjU4NX0.IzOId4dmFwyLmIF6Mj5j8_J6SNWs7NFsd7B3lorMHp0'
);

async function testUserRole() {
  // Sign in as the test user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password123'
  });

  if (authError) {
    console.error('Auth error:', authError);
    return;
  }

  console.log('Signed in as:', authData.user.id);

  // Try to query user_roles
  const { data: userRole, error: roleError } = await supabase
    .from('user_roles')
    .select('organization_id, role')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (roleError) {
    console.error('Role query error:', roleError);
  } else {
    console.log('User role:', userRole);
  }

  // Sign out
  await supabase.auth.signOut();
}

testUserRole();
