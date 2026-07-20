/**
 * Helper functions for tournament group management
 */

export interface GroupAssignment {
  groupName: string;
  groupPosition: number;
}

/**
 * Get group name for a given index (0 = A, 1 = B, etc.)
 */
export function getGroupName(index: number): string {
  return String.fromCharCode(65 + index); // 65 is 'A' in ASCII
}

/**
 * Assign teams to groups as evenly as possible
 *
 * @param totalTeams - Total number of teams
 * @param numberOfGroups - Number of groups to create
 * @returns Array of group assignments for each team
 */
export function assignTeamsToGroups(
  totalTeams: number,
  numberOfGroups: number
): GroupAssignment[] {
  if (numberOfGroups < 2 || numberOfGroups > 4) {
    throw new Error('Number of groups must be between 2 and 4');
  }

  if (totalTeams < numberOfGroups * 2) {
    throw new Error('Need at least 2 teams per group');
  }

  const assignments: GroupAssignment[] = [];
  const teamsPerGroup = Math.floor(totalTeams / numberOfGroups);
  const remainder = totalTeams % numberOfGroups;

  let teamIndex = 0;

  // Distribute teams across groups
  for (let groupIndex = 0; groupIndex < numberOfGroups; groupIndex++) {
    const groupName = getGroupName(groupIndex);
    // Groups with lower indices get the extra teams
    const teamsInThisGroup = groupIndex < remainder ? teamsPerGroup + 1 : teamsPerGroup;

    for (let positionInGroup = 0; positionInGroup < teamsInThisGroup; positionInGroup++) {
      assignments.push({
        groupName,
        groupPosition: positionInGroup + 1, // 1-indexed position
      });
      teamIndex++;
    }
  }

  return assignments;
}

/**
 * Calculate total matches for group stage
 * Each group plays round-robin internally
 */
export function calculateGroupStageMatches(
  totalTeams: number,
  numberOfGroups: number
): number {
  const assignments = assignTeamsToGroups(totalTeams, numberOfGroups);

  // Count teams per group
  const teamsByGroup = new Map<string, number>();
  for (const assignment of assignments) {
    const count = teamsByGroup.get(assignment.groupName) || 0;
    teamsByGroup.set(assignment.groupName, count + 1);
  }

  // Calculate round-robin matches for each group
  let totalMatches = 0;
  for (const teamsInGroup of Array.from(teamsByGroup.values())) {
    totalMatches += (teamsInGroup * (teamsInGroup - 1)) / 2;
  }

  return totalMatches;
}

/**
 * Get teams in a specific group from assignments
 */
export function getTeamsInGroup(
  assignments: GroupAssignment[],
  groupName: string
): number[] {
  return assignments
    .map((assignment, index) => ({ assignment, index }))
    .filter(({ assignment }) => assignment.groupName === groupName)
    .map(({ index }) => index);
}

/**
 * Get all group names for a given number of groups
 */
export function getAllGroupNames(numberOfGroups: number): string[] {
  return Array.from({ length: numberOfGroups }, (_, i) => getGroupName(i));
}

// ─── Pool Play ────────────────────────────────────────────────────────────────

export interface PoolAssignment {
  poolName: string;
  poolPosition: number;
}

/**
 * Divide teams into pools of a fixed size.
 * If total teams don't divide evenly, the last pool gets fewer teams.
 *
 * @param totalTeams - Total number of filled teams
 * @param teamsPerPool - Desired size of each pool
 * @returns Array of pool assignments (one per team, in order)
 */
export function assignTeamsToPools(
  totalTeams: number,
  teamsPerPool: number
): PoolAssignment[] {
  if (teamsPerPool < 2) throw new Error('Need at least 2 teams per pool');
  if (totalTeams < 2) throw new Error('Need at least 2 teams');

  const assignments: PoolAssignment[] = [];
  let poolIndex = 0;
  let positionInPool = 0;

  for (let i = 0; i < totalTeams; i++) {
    assignments.push({
      poolName: `Pool ${poolIndex + 1}`,
      poolPosition: positionInPool + 1,
    });
    positionInPool++;
    if (positionInPool >= teamsPerPool) {
      poolIndex++;
      positionInPool = 0;
    }
  }

  return assignments;
}

/**
 * Get all pool names for the given total teams and pool size.
 */
export function getAllPoolNames(totalTeams: number, teamsPerPool: number): string[] {
  const numPools = Math.ceil(totalTeams / teamsPerPool);
  return Array.from({ length: numPools }, (_, i) => `Pool ${i + 1}`);
}
