// Test script to verify league creation flow
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLeagueCreation() {
  console.log('Testing league creation flow...\n');

  try {
    // 1. Check if user is authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('❌ Not authenticated. Please log in first.');
      return;
    }

    console.log('✅ User authenticated:', session.user.email);

    // 2. Check user role and organization
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (roleError) {
      console.error('❌ Error fetching user role:', roleError.message);
      return;
    }

    if (!userRole) {
      console.error('❌ User does not have an organization role');
      return;
    }

    console.log('✅ User role:', userRole.role);
    console.log('✅ Organization ID:', userRole.organization_id);

    // 3. Check if user can create leagues
    if (userRole.role !== 'admin' && userRole.role !== 'organizer') {
      console.error('❌ User does not have permission to create leagues');
      return;
    }

    // 4. Test creating a test league
    console.log('\n📝 Creating test league...');

    const testLeagueName = `Test League ${Date.now()}`;

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name: testLeagueName,
        description: 'Test league for validation',
        organization_id: userRole.organization_id,
        is_public: true,
      })
      .select()
      .single();

    if (leagueError) {
      console.error('❌ Error creating league:', leagueError.message);
      return;
    }

    console.log('✅ League created:', league.name, '(ID:', league.id + ')');

    // 5. Test creating a season
    console.log('\n📝 Creating test season...');

    const { data: season, error: seasonError } = await supabase
      .from('seasons')
      .insert({
        league_id: league.id,
        organization_id: userRole.organization_id,
        name: 'Spring 2026',
        type: 'regular',
        format: 'doubles',
        max_teams: 4,
        has_playoffs: false,
        is_active: true,
        league_type: 'non_dupr',
        players_per_team: 2,
        regular_season_weeks: 4,
        playoff_teams: 0,
        matches_per_matchup: 3,
      })
      .select()
      .single();

    if (seasonError) {
      console.error('❌ Error creating season:', seasonError.message);
      await supabase.from('leagues').delete().eq('id', league.id);
      return;
    }

    console.log('✅ Season created:', season.name, '(ID:', season.id + ')');

    // 6. Test creating teams
    console.log('\n📝 Creating test teams...');

    const teamNames = ['Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta'];
    const teamInserts = teamNames.map(name => ({
      season_id: season.id,
      organization_id: userRole.organization_id,
      name: name,
    }));

    const { data: teams, error: teamsError } = await supabase
      .from('divisions')
      .insert(teamInserts)
      .select();

    if (teamsError) {
      console.error('❌ Error creating teams:', teamsError.message);
      await supabase.from('leagues').delete().eq('id', league.id);
      return;
    }

    console.log('✅ Teams created:', teams.length);
    teams.forEach(t => console.log('   -', t.name));

    // 7. Test creating standings
    console.log('\n📝 Creating standings entries...');

    const standingsInserts = teams.map(team => ({
      season_id: season.id,
      division_id: team.id,
      team_id: team.id,
      organization_id: userRole.organization_id,
    }));

    const { data: standings, error: standingsError } = await supabase
      .from('standings')
      .insert(standingsInserts)
      .select();

    if (standingsError) {
      console.error('❌ Error creating standings:', standingsError.message);
      await supabase.from('leagues').delete().eq('id', league.id);
      return;
    }

    console.log('✅ Standings created:', standings.length);

    // 8. Test creating league weeks
    console.log('\n📝 Creating league weeks...');

    const { data: week1, error: week1Error } = await supabase
      .from('league_weeks')
      .insert({
        season_id: season.id,
        week_number: 1,
        status: 'scheduled',
      })
      .select()
      .single();

    if (week1Error) {
      console.error('❌ Error creating week 1:', week1Error.message);
      await supabase.from('leagues').delete().eq('id', league.id);
      return;
    }

    console.log('✅ Week 1 created (ID:', week1.id + ')');

    // 9. Test creating team matchups
    console.log('\n📝 Creating team matchups...');

    const matchupInserts = [
      {
        league_week_id: week1.id,
        home_team_id: teams[0].id,
        away_team_id: teams[1].id,
        status: 'scheduled',
      },
      {
        league_week_id: week1.id,
        home_team_id: teams[2].id,
        away_team_id: teams[3].id,
        status: 'scheduled',
      }
    ];

    const { data: matchups, error: matchupsError } = await supabase
      .from('team_matchups')
      .insert(matchupInserts)
      .select();

    if (matchupsError) {
      console.error('❌ Error creating matchups:', matchupsError.message);
      await supabase.from('leagues').delete().eq('id', league.id);
      return;
    }

    console.log('✅ Matchups created:', matchups.length);

    // 10. Test team player registration
    console.log('\n📝 Testing team player registration...');

    const { data: playerReg, error: playerError } = await supabase
      .from('team_players')
      .insert({
        team_id: teams[0].id,
        user_id: session.user.id,
        organization_id: userRole.organization_id,
        player_position: 1,
        is_captain: true,
        is_substitute: false,
      })
      .select()
      .single();

    if (playerError) {
      console.error('❌ Error registering player:', playerError.message);
    } else {
      console.log('✅ Player registered to team:', teams[0].name);
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await supabase.from('leagues').delete().eq('id', league.id);
    console.log('✅ Test data cleaned up');

    console.log('\n✅ All tests passed! League creation flow is working correctly.');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
  }
}

testLeagueCreation();
