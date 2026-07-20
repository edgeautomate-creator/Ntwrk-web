export function validatePlayoffStructure(playoffTeams: number, byeTeams: number): boolean {
  if (byeTeams >= playoffTeams) return false;
  let currentTeams = playoffTeams;
  let currentByes = byeTeams;
  while (currentTeams > 1) {
    const playingTeams = currentTeams - currentByes;
    if (playingTeams < 0 || playingTeams % 2 !== 0) return false;
    const winners = playingTeams / 2;
    const nextRoundTeams = winners + currentByes;
    if (nextRoundTeams === 1) return true;
    if (nextRoundTeams % 2 !== 0 && nextRoundTeams !== 1) return false;
    currentTeams = nextRoundTeams;
    currentByes = 0;
  }
  return true;
}
