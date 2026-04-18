#!/usr/bin/env node
// Scrapes all MLB regular-season games for challenge data (ABS + manager).
// Outputs challenges.json at repo root.
// Designed to run incrementally — skips games already in the JSON.

const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '..', 'challenges.json');
const SEASON_START = '2026-03-25'; // 2026 regular season opening day
const TEAMS = {108:"LAA",109:"ARI",110:"BAL",111:"BOS",112:"CHC",113:"CIN",114:"CLE",115:"COL",116:"DET",117:"HOU",118:"KC",119:"LAD",120:"WSH",121:"NYM",133:"OAK",134:"PIT",135:"SD",136:"SEA",137:"SF",138:"STL",139:"TB",140:"TEX",141:"TOR",142:"MIN",143:"PHI",144:"ATL",145:"CWS",146:"MIA",147:"NYY",158:"MIL"};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function todayStr() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}

// Load existing data for incremental mode
function loadExisting() {
  try {
    const raw = fs.readFileSync(OUTPUT, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { lastUpdated: null, lastGameDate: null, challenges: [] };
  }
}

// Fetch with retry + exponential backoff
async function fetchJSON(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      const wait = 1000 * Math.pow(2, i);
      console.warn(`  Retry ${i+1} for ${url} in ${wait}ms: ${err.message}`);
      await sleep(wait);
    }
  }
}

// Get all completed regular-season gamePks since a start date
async function getGamePks(startDate, endDate) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameType=R&startDate=${startDate}&endDate=${endDate}`;
  const data = await fetchJSON(url);
  const games = [];
  for (const dt of (data.dates || [])) {
    for (const g of dt.games) {
      if (g.status.abstractGameState === 'Final') {
        games.push({ gamePk: g.gamePk, date: dt.date });
      }
    }
  }
  return games;
}

// Extract challenges from a single game feed
function extractChallenges(gamePk, date, feed) {
  const challenges = [];
  const gameData = feed.gameData;
  const plays = feed.liveData?.plays?.allPlays || [];
  const homeId = gameData.teams.home.id;
  const awayId = gameData.teams.away.id;

  for (const play of plays) {
    const battingTeamId = play.about.halfInning === 'top' ? awayId : homeId;
    const fieldingTeamId = play.about.halfInning === 'top' ? homeId : awayId;
    const inning = play.about.inning;

    // 1) Play-level manager challenges (MF = field, MA = tag/appeal)
    if (play.about.hasReview && play.reviewDetails) {
      const rt = play.reviewDetails.reviewType;
      if (rt === 'MF' || rt === 'MA') {
        // Manager challenges don't have a specific player — attribute to team
        // The challenging team is in reviewDetails or we infer from isOverturned context
        const challengeTeamId = play.reviewDetails.challengeTeamId || null;
        challenges.push({
          gamePk, date, inning,
          type: 'manager',
          reviewType: rt,
          result: play.reviewDetails.isOverturned ? 'overturned' : 'confirmed',
          teamId: challengeTeamId,
          team: TEAMS[challengeTeamId] || null,
          playerName: null,
          playerId: null,
          role: 'manager'
        });
      }
    }

    // 2) Pitch-event ABS challenges (MJ)
    for (const pe of (play.playEvents || [])) {
      if (!pe.reviewDetails || pe.reviewDetails.reviewType !== 'MJ') continue;
      if (pe.reviewDetails.inProgress) continue; // skip incomplete

      const rd = pe.reviewDetails;
      const playerId = rd.player?.id || null;
      const playerName = rd.player?.fullName || null;
      const challengeTeamId = rd.challengeTeamId;

      // Determine role: batter if they're the at-bat batter, otherwise catcher
      let role = 'catcher';
      if (playerId && playerId === play.matchup.batter.id) {
        role = 'batter';
      }

      challenges.push({
        gamePk, date, inning,
        type: 'abs',
        reviewType: 'MJ',
        result: rd.isOverturned ? 'overturned' : 'confirmed',
        teamId: challengeTeamId,
        team: TEAMS[challengeTeamId] || null,
        playerName, playerId, role
      });
    }

    // 3) Play-level ABS challenges (MJ at play level — some show here too)
    if (play.about.hasReview && play.reviewDetails?.reviewType === 'MJ') {
      const rd = play.reviewDetails;
      if (!rd.inProgress) {
        // Only add if there isn't already a pitch-event entry for this same play
        // (avoid double-counting — check if we already captured an ABS from pitch events in this at-bat)
        const batterId = play.matchup.batter.id;
        const alreadyCaptured = challenges.some(c =>
          c.gamePk === gamePk && c.type === 'abs' && c.playerId === batterId && c.inning === inning
        );
        if (!alreadyCaptured) {
          challenges.push({
            gamePk, date, inning,
            type: 'abs',
            reviewType: 'MJ',
            result: rd.isOverturned ? 'overturned' : 'confirmed',
            teamId: rd.challengeTeamId || null,
            team: TEAMS[rd.challengeTeamId] || null,
            playerName: play.matchup.batter.fullName,
            playerId: batterId,
            role: 'batter'
          });
        }
      }
    }
  }

  return challenges;
}

async function main() {
  const existing = loadExisting();
  const existingPks = new Set(existing.challenges.map(c => c.gamePk));
  const endDate = todayStr();

  // Start from day after last scraped date, or season start
  const startDate = existing.lastGameDate
    ? nextDay(existing.lastGameDate)
    : SEASON_START;

  if (startDate > endDate) {
    console.log('Already up to date.');
    return;
  }

  console.log(`Fetching schedule from ${startDate} to ${endDate}...`);
  const games = await getGamePks(startDate, endDate);
  // Filter out already-scraped games
  const newGames = games.filter(g => !existingPks.has(g.gamePk));
  console.log(`Found ${games.length} completed games, ${newGames.length} new.`);

  if (newGames.length === 0) {
    console.log('No new games to process.');
    // Still update lastUpdated timestamp
    existing.lastUpdated = new Date().toISOString();
    existing.lastGameDate = endDate;
    fs.writeFileSync(OUTPUT, JSON.stringify(existing, null, 2));
    return;
  }

  let processed = 0;
  let totalChallenges = 0;

  for (const { gamePk, date } of newGames) {
    try {
      const feed = await fetchJSON(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`);
      const challenges = extractChallenges(gamePk, date, feed);
      existing.challenges.push(...challenges);
      totalChallenges += challenges.length;
      processed++;
      if (processed % 50 === 0) {
        console.log(`  Processed ${processed}/${newGames.length} games (${totalChallenges} challenges so far)`);
      }
    } catch (err) {
      console.warn(`  Failed to process game ${gamePk}: ${err.message}`);
    }
    await sleep(100); // rate limit
  }

  existing.lastUpdated = new Date().toISOString();
  existing.lastGameDate = endDate;

  fs.writeFileSync(OUTPUT, JSON.stringify(existing, null, 2));
  console.log(`Done! Processed ${processed} games, found ${totalChallenges} new challenges.`);
  console.log(`Total challenges in DB: ${existing.challenges.length}`);
}

function nextDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
