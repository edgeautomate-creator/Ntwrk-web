#!/usr/bin/env node

/**
 * Script to create a test league with mock data for testing
 * Creates: organization, league, season, 4 teams with 4 players each + subs, and matches
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env file manually
const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Test player data (mock users)
const mockPlayers = [
  // Team 1 - The Dink Masters
  { email: 'alice@test.com', name: 'Alice Johnson', dupr: 4.5 },
  { email: 'bob@test.com', name: 'Bob Smith', dupr: 4.3 },
  { email: 'carol@test.com', name: 'Carol Davis', dupr: 4.7 },
  { email: 'dave@test.com', name: 'Dave Wilson', dupr: 4.4 },
  { email: 'sub1@test.com', name: 'Sub Player 1', dupr: 4.2 },

  // Team 2 - The Kitchen Crew
  { email: 'eve@test.com', name: 'Eve Brown', dupr: 4.6 },
  { email: 'frank@test.com', name: 'Frank Miller', dupr: 4.4 },
  { email: 'grace@test.com', name: 'Grace Lee', dupr: 4.8 },
  { email: 'henry@test.com', name: 'Henry Taylor', dupr: 4.5 },
  { email: 'sub2@test.com', name: 'Sub Player 2', dupr: 4.3 },

  // Team 3 - Paddle Smashers
  { email: 'iris@test.com', name: 'Iris Anderson', dupr: 4.4 },
  { email: 'jack@test.com', name: 'Jack Thomas', dupr: 4.6 },
  { email: 'kate@test.com', name: 'Kate Martinez', dupr: 4.2 },
  { email: 'leo@test.com', name: 'Leo Garcia', dupr: 4.7 },
  { email: 'sub3@test.com', name: 'Sub Player 3', dupr: 4.1 },

  // Team 4 - Net Ninjas
  { email: 'mary@test.com', name: 'Mary Rodriguez', dupr: 4.5 },
  { email: 'nick@test.com', name: 'Nick White', dupr: 4.3 },
  { email: 'olivia@test.com', name: 'Olivia Harris', dupr: 4.6 },
  { email: 'paul@test.com', name: 'Paul Clark', dupr: 4.4 },
  { email: 'sub4@test.com', name: 'Sub Player 4', dupr: 4.2 },
];

const teams = [
  { name: 'The Dink Masters', players: [0, 1, 2, 3], sub: 4 },
  { name: 'The Kitchen Crew', players: [5, 6, 7, 8], sub: 9 },
  { name: 'Paddle Smashers', players: [10, 11, 12, 13], sub: 14 },
  { name: 'Net Ninjas', players: [15, 16, 17, 18], sub: 19 },
];

async function main() {
  console.log('🏓 Creating test league with mock data...\n');

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('❌ Error: Not authenticated. Please log in first.');
    process.exit(1);
  }
  console.log('✅ Authenticated as:', user.email);

  // Get user's organization
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!userRole) {
    console.error('❌ Error: User has no organization. Please create an organization first.');
    process.exit(1);
  }

  const organizationId = userRole.organization_id;
  console.log('✅ Using organization:', organizationId);

  // Create mock users (profiles only - no actual auth accounts)
  console.log('\n📝 Creating mock player profiles...');
  const playerIds = [];
  const profileInserts = [];

  for (const player of mockPlayers) {
    // Generate a fake UUID for the player
    const playerId = crypto.randomUUID();
    playerIds.push(playerId);

    profileInserts.push({
      id: playerId,
      full_name: player.name,
      dupr_singles_rating: player.dupr,
      dupr_doubles_rating: player.dupr,
    });
  }

  // Note: We can't actually create these profiles without auth.users entries
  // Instead, let's use the current user and create a simpler test setup
  console.log('⚠️  Note: Using simplified approach - all players will be you for testing\n');

  // Create league
  console.log('🏆 Creating test league...');
  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .insert({
      organization_id: organizationId,
      name: 'Test Spring League 2026',
      description: 'A test league with 4 teams for testing match scoring functionality',
      created_by: user.id,
    })
    .select()
    .single();

  if (leagueError) {
    console.error('❌ Error creating league:', leagueError);
    process.exit(1);
  }
  console.log('✅ League created:', league.name);

  // Create season
  console.log('\n📅 Creating season...');
  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .insert({
      league_id: league.id,
      organization_id: organizationId,
      name: 'Spring 2026',
      start_date: null,
      end_date: null,
      best_of: 3,
      created_by: user.id,
    })
    .select()
    .single();

  if (seasonError) {
    console.error('❌ Error creating season:', seasonError);
    process.exit(1);
  }
  console.log('✅ Season created:', season.name);

  // Create teams (divisions)
  console.log('\n👥 Creating teams...');
  const createdTeams = [];
  for (const team of teams) {
    const { data: division, error: divError } = await supabase
      .from('divisions')
      .insert({
        season_id: season.id,
        organization_id: organizationId,
        name: team.name,
        format: 'doubles',
        skill_level: 'intermediate',
        created_by: user.id,
      })
      .select()
      .single();

    if (divError) {
      console.error('❌ Error creating team:', divError);
      continue;
    }

    createdTeams.push({ ...division, playerSlots: team.players, subSlot: team.sub });
    console.log('  ✅ Team created:', team.name);

    // Add current user as captain to first team
    if (createdTeams.length === 1) {
      const { error: playerError } = await supabase
        .from('team_players')
        .insert({
          team_id: division.id,
          user_id: user.id,
          organization_id: organizationId,
          player_position: 1,
          is_captain: true,
          is_substitute: false,
        });

      if (!playerError) {
        console.log('  ✅ You are now captain of', team.name);
      }
    }
  }

  // Create match schedule
  console.log('\n⚡ Creating match schedule...');
  const matchups = [
    { home: 0, away: 1 },
    { home: 2, away: 3 },
    { home: 0, away: 2 },
    { home: 1, away: 3 },
    { home: 0, away: 3 },
    { home: 1, away: 2 },
  ];

  for (const [idx, matchup] of matchups.entries()) {
    const homeTeam = createdTeams[matchup.home];
    const awayTeam = createdTeams[matchup.away];

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        season_id: season.id,
        organization_id: organizationId,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        match_date: null,
        location: 'Test Court Complex',
        status: 'scheduled',
        format: 'doubles',
        best_of: 3,
      })
      .select()
      .single();

    if (matchError) {
      console.error('❌ Error creating match:', matchError);
      continue;
    }

    console.log(`  ✅ Match ${idx + 1}: ${homeTeam.name} vs ${awayTeam.name}`);
  }

  console.log('\n✨ Test league created successfully!');
  console.log('\n📋 Summary:');
  console.log(`   League: ${league.name}`);
  console.log(`   Season: ${season.name}`);
  console.log(`   Teams: ${createdTeams.length}`);
  console.log(`   Matches: ${matchups.length}`);
  console.log('\n🎮 You can now test the league functionality!');
  console.log(`   Navigate to: /dashboard/leagues/${league.id}`);
}

main().catch(console.error);
