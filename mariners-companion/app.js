const TEAMS = {108:"LAA",109:"ARI",110:"BAL",111:"BOS",112:"CHC",113:"CIN",114:"CLE",115:"COL",116:"DET",117:"HOU",118:"KC",119:"LAD",120:"WSH",121:"NYM",133:"OAK",134:"PIT",135:"SD",136:"SEA",137:"SF",138:"STL",139:"TB",140:"TEX",141:"TOR",142:"MIN",143:"PHI",144:"ATL",145:"CWS",146:"MIA",147:"NYY",158:"MIL"};
const TEAM_COLORS = {
  108:['#003263','#BA0021'],109:['#A71930','#E3D4AD'],110:['#1A1A1A','#DF4601'],
  111:['#0C2340','#BD3039'],112:['#0E3386','#CC3433'],113:['#15161A','#C6011F'],
  114:['#00385D','#E50022'],115:['#33006F','#C4CED4'],116:['#0C2340','#FA4616'],
  117:['#002D62','#EB6E1F'],118:['#004687','#BD9B60'],119:['#005A9C','#EF3E42'],
  120:['#14225A','#AB0003'],121:['#002D72','#FF5910'],133:['#003831','#EFB21E'],
  134:['#27251F','#FDB827'],135:['#2F241D','#FFC425'],136:['#0C2C56','#00A3E0'],
  137:['#27251F','#FD5A1E'],138:['#0C2340','#C41E3A'],139:['#092C5C','#8FBCE6'],
  140:['#003278','#C0111F'],141:['#134A8E','#E8291C'],142:['#002B5C','#D31145'],
  143:['#002D72','#E81828'],144:['#13274F','#CE1141'],145:['#27251F','#C4CED4'],
  146:['#000000','#00A3E0'],147:['#0C2340','#C4CED4'],158:['#12284B','#FFC52F']
};
let TEAM_ID = parseInt(localStorage.getItem('teamId')) || 136;

function applyTeamColors(id) {
  const [primary, accent] = TEAM_COLORS[id] || TEAM_COLORS[136];
  document.documentElement.style.setProperty('--primary', primary);
  document.documentElement.style.setProperty('--accent', accent);
  document.body.style.background = `linear-gradient(180deg, ${primary}88 0%, #0a0a0a 90%)`;
  document.body.style.backgroundAttachment = 'fixed';
}
let gamePk = null;
let currentTab = 'scorecard';
let userPickedTab = false;
let sortState = { key: 'order', asc: true };
let pitchSortState = { key: 'appearance', asc: true };
let latestGameState = null;
let standingsCache = null;
let challengeDb = null; // cached challenges.json data

const LOGO_URL = id => `https://www.mlbstatic.com/team-logos/${id}.svg`;
const teamBtn = document.getElementById('teamBtn');
const teamList = document.getElementById('teamList');

// Load season challenge database
async function loadChallengeDb() {
  try {
    const res = await fetch('challenges.json');
    if (!res.ok) return;
    challengeDb = await res.json();
    console.log(`Challenge DB loaded: ${challengeDb.challenges.length} records`);
  } catch { /* challenges.json may not exist yet */ }
}
loadChallengeDb();

// Merge static DB challenges with live game challenges for complete season data
function getSeasonChallenges() {
  const all = challengeDb ? [...challengeDb.challenges] : [];
  // Add current game's live challenges (if not already in the DB)
  if (latestGameState && gamePk) {
    const { liveData, isHome } = latestGameState;
    const gameData = liveData._gameData;
    const homeId = gameData.teams.home.id;
    const awayId = gameData.teams.away.id;
    const dbHasGame = all.some(c => c.gamePk === gamePk);
    if (!dbHasGame) {
      const plays = liveData.plays?.allPlays || [];
      const today = new Date().toISOString().slice(0, 10);
      for (const play of plays) {
        if (!play.about.isComplete) continue;
        const battingTeamId = play.about.halfInning === 'top' ? awayId : homeId;
        const inning = play.about.inning;
        // Manager challenges
        if (play.about.hasReview && play.reviewDetails) {
          const rt = play.reviewDetails.reviewType;
          if (rt === 'MF' || rt === 'MA') {
            all.push({ gamePk, date: today, inning, type: 'manager', reviewType: rt,
              result: play.reviewDetails.isOverturned ? 'overturned' : 'confirmed',
              teamId: play.reviewDetails.challengeTeamId || null,
              team: TEAMS[play.reviewDetails.challengeTeamId] || null,
              playerName: null, playerId: null, role: 'manager' });
          }
        }
        // ABS challenges from pitch events
        for (const pe of (play.playEvents || [])) {
          if (!pe.reviewDetails || pe.reviewDetails.reviewType !== 'MJ') continue;
          if (pe.reviewDetails.inProgress) continue;
          const rd = pe.reviewDetails;
          const role = rd.player?.id === play.matchup.batter.id ? 'batter' : 'catcher';
          all.push({ gamePk, date: today, inning, type: 'abs', reviewType: 'MJ',
            result: rd.isOverturned ? 'overturned' : 'confirmed',
            teamId: rd.challengeTeamId, team: TEAMS[rd.challengeTeamId] || null,
            playerName: rd.player?.fullName || null, playerId: rd.player?.id || null, role });
        }
      }
    }
  }
  return all;
}

function getTeamChallengeStats(teamId) {
  const all = getSeasonChallenges().filter(c => c.teamId === teamId);
  const abs = all.filter(c => c.type === 'abs');
  const mgr = all.filter(c => c.type === 'manager');
  return {
    absUsed: abs.length, absWon: abs.filter(c => c.result === 'overturned').length,
    managerUsed: mgr.length, managerWon: mgr.filter(c => c.result === 'overturned').length
  };
}

function getPlayerChallengeStats(teamId) {
  const all = getSeasonChallenges().filter(c => c.type === 'abs' && c.teamId === teamId && c.playerId);
  const byPlayer = {};
  all.forEach(c => {
    const key = c.playerId;
    if (!byPlayer[key]) byPlayer[key] = { name: c.playerName, role: c.role, used: 0, won: 0 };
    byPlayer[key].used++;
    if (c.result === 'overturned') byPlayer[key].won++;
  });
  return Object.values(byPlayer).sort((a, b) => b.used - a.used);
}

function setTeamBtn(id) {
  teamBtn.innerHTML = `<img src="${LOGO_URL(id)}" class="team-logo" alt="">${TEAMS[id]}`;
}
setTeamBtn(TEAM_ID);

Object.entries(TEAMS).sort((a,b)=>a[1].localeCompare(b[1])).forEach(([id,abv]) => {
  const item = document.createElement('div');
  item.className = 'team-item';
  item.innerHTML = `<img src="${LOGO_URL(id)}" class="team-logo" alt="">${abv}`;
  item.onclick = () => {
    TEAM_ID = parseInt(id);
    localStorage.setItem('teamId', TEAM_ID);

    setTeamBtn(TEAM_ID);
    applyTeamColors(TEAM_ID);
    teamList.classList.remove('open');
    gamePk = null;
    userPickedTab = false;
    update();
  };
  teamList.appendChild(item);
});

teamBtn.onclick = () => teamList.classList.toggle('open');
document.addEventListener('click', e => {
  if (!e.target.closest('#teamPicker')) teamList.classList.remove('open');
});
applyTeamColors(TEAM_ID);

document.getElementById('scoreText').addEventListener('click', e => {
  const link = e.target.closest('.opp-link');
  if (!link) return;
  const id = parseInt(link.dataset.team);
  if (!id || !TEAMS[id]) return;
  TEAM_ID = id;
  localStorage.setItem('teamId', TEAM_ID);
  setTeamBtn(TEAM_ID);
  applyTeamColors(TEAM_ID);
  gamePk = null;
  userPickedTab = false;
  update();
});

async function getTodayGamePk() {
  const d = new Date();
  const today = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${TEAM_ID}&date=${today}`);
  const data = await res.json();
  return data.dates[0]?.games[0]?.gamePk || null;
}

function calcWoba(s) {
  const bb = (s.baseOnBalls || 0) - (s.intentionalWalks || 0);
  const hbp = s.hitByPitch || 0;
  const singles = (s.hits || 0) - (s.doubles || 0) - (s.triples || 0) - (s.homeRuns || 0);
  const denom = (s.atBats || 0) + (s.baseOnBalls || 0) - (s.intentionalWalks || 0) + (s.sacFlies || 0) + hbp;
  if (denom === 0) return '.000';
  const woba = (0.696*bb + 0.726*hbp + 0.883*singles + 1.244*(s.doubles||0) + 1.569*(s.triples||0) + 2.004*(s.homeRuns||0)) / denom;
  return woba.toFixed(3);
}

async function fetchStandings() {
  if (standingsCache) return standingsCache;
  const year = new Date().getFullYear();
  const res = await fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${year}&standingsTypes=regularSeason`);
  const data = await res.json();
  standingsCache = data.records;
  return standingsCache;
}

function renderDivisionStandings() {
  fetchStandings().then(records => {
    const div = records.find(r => r.teamRecords.some(tr => tr.team.id === TEAM_ID));
    if (!div) { document.getElementById('divStandings').innerHTML = ''; return; }
    const teams = div.teamRecords.sort((a, b) => parseInt(a.divisionRank) - parseInt(b.divisionRank));
    document.getElementById('divStandings').innerHTML = teams.map(tr =>
      `<div class="ds-team">
        <img src="${LOGO_URL(tr.team.id)}" class="ds-flag${tr.team.id === TEAM_ID ? ' ds-selected' : ''}" alt="${TEAMS[tr.team.id]}">
        <span class="ds-record">${tr.wins}-${tr.losses}</span>
      </div>`
    ).join('');
  }).catch(() => {});
}

function renderBattingTable(my, liveData, isHome) {
  const currentPlay = liveData.plays?.currentPlay;
  const activeBatterId = currentPlay?.matchup?.batter?.id;
  const activePitcherId = currentPlay?.matchup?.pitcher?.id;

  const players = Object.values(my.players).map(p => {
    const bo = parseInt(p.battingOrder) || 0;
    return {
      id: p.person.id,
      name: p.person.fullName,
      num: p.jerseyNumber || '',
      pos: p.position.abbreviation,
      order: p.battingOrder || 999,
      slot: Math.floor(bo / 100),
      sub: bo % 100,
     ...p.stats.batting,
      avg: p.seasonStats.batting.avg,
      obp: p.seasonStats.batting.obp,
      slg: p.seasonStats.batting.slg,
      ops: p.seasonStats.batting.ops,
      woba: calcWoba(p.seasonStats.batting),
      sK: p.seasonStats.batting.strikeOuts || 0,
      sBB: p.seasonStats.batting.baseOnBalls || 0
    };
  }).filter(p => p.atBats > 0 || p.plateAppearances > 0);

  players.sort((a,b) => {
    const va = a[sortState.key], vb = b[sortState.key];
    if (va === vb) return 0;
    const cmp = (typeof va === 'string')? va.localeCompare(vb) : va - vb;
    return sortState.asc? cmp : -cmp;
  });

  let html = `<table id="battingTable" class="my-team"><thead>
    <tr class="group-row"><th colspan="1"></th><th colspan="6">Game</th><th colspan="7" class="divider">Season</th></tr>
    <tr>
    <th data-key="name">Player</th>
    <th data-key="atBats">AB</th><th data-key="runs">R</th>
    <th data-key="hits">H</th><th data-key="rbi">RBI</th>
    <th data-key="baseOnBalls">BB</th><th data-key="strikeOuts">K</th>
    <th data-key="avg" class="divider">AVG</th><th data-key="obp">OBP</th>
    <th data-key="slg">SLG</th><th data-key="ops">OPS</th><th data-key="woba">wOBA</th>
    <th data-key="sK">K</th><th data-key="sBB">BB</th></tr></thead>`;
  players.forEach(p => {
    const isSub = p.sub > 0;
    const isActive = p.id === activeBatterId;
    const classes = [isSub ? 'box-sub' : '', isActive ? 'active-player' : ''].filter(Boolean).join(' ');
    const trClass = classes ? ` class="${classes}"` : '';
    html += `<tr${trClass} data-pid="${p.id}"><td><span class="p-num">${p.num}</span>${p.name} <span class="p-pos">${p.pos}</span></td><td>${p.atBats}</td>
      <td>${p.runs}</td><td>${p.hits}</td><td>${p.rbi}</td>
      <td>${p.baseOnBalls}</td><td>${p.strikeOuts}</td><td class="divider">${p.avg}</td>
      <td>${p.obp}</td><td>${p.slg}</td><td>${p.ops}</td><td>${p.woba}</td>
      <td>${p.sK}</td><td>${p.sBB}</td></tr>`;
  });
  // Team totals row
  const t = players.reduce((t, p) => {
    t.ab += (p.atBats || 0); t.r += (p.runs || 0); t.h += (p.hits || 0);
    t.rbi += (p.rbi || 0); t.bb += (p.baseOnBalls || 0); t.k += (p.strikeOuts || 0);
    return t;
  }, { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, k: 0 });
  html += `<tr class="team-totals"><td><strong>Team</strong></td><td>${t.ab}</td>
    <td>${t.r}</td><td>${t.h}</td><td>${t.rbi}</td>
    <td>${t.bb}</td><td>${t.k}</td>
    <td class="divider"></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
  document.getElementById('content').innerHTML = html + '</table>';

  document.querySelectorAll('#battingTable th[data-key]').forEach(th => {
    th.onclick = () => {
      const key = th.dataset.key;
      sortState.asc = (sortState.key === key)?!sortState.asc : true;
      sortState.key = key;
      renderBattingTable(my, liveData, isHome);
    };
    if (th.dataset.key === sortState.key) th.textContent += sortState.asc? ' ▲' : ' ▼';
  });

  renderPitchingTable(my, liveData, isHome);

  // Wire player click handlers AFTER both tables are in the DOM
  document.querySelectorAll('#battingTable tr[data-pid], #pitchingTable tr[data-pid]').forEach(tr => {
    tr.style.cursor = 'pointer';
    tr.onclick = () => showPlayerModal(parseInt(tr.dataset.pid));
  });
}

function renderPitchingTable(my, liveData, isHome) {
  // Calculate first-pitch strikes per pitcher from play data
  const fpsMap = {};
  const allPlays = liveData?.plays?.allPlays || [];
  const myHalf = isHome ? 'top' : 'bottom'; // we pitch when opponent bats
  allPlays.forEach(play => {
    if (play.about.halfInning !== myHalf || !play.about.isComplete) return;
    const pitcherId = play.matchup.pitcher.id;
    const pitches = (play.playEvents || []).filter(e => e.isPitch);
    if (pitches.length > 0) {
      if (!fpsMap[pitcherId]) fpsMap[pitcherId] = 0;
      const firstPitch = pitches[0];
      if (firstPitch.details?.isStrike || firstPitch.details?.code === 'F') {
        fpsMap[pitcherId]++;
      }
    }
  });

  // Build appearance order from play-by-play data
  const appearanceOrder = {};
  let orderIdx = 0;
  allPlays.forEach(play => {
    if (play.about.halfInning !== myHalf || !play.about.isComplete) return;
    const pid = play.matchup.pitcher.id;
    if (!(pid in appearanceOrder)) appearanceOrder[pid] = orderIdx++;
  });

  const pitchers = Object.values(my.players).map(p => {
    const ss = p.seasonStats.pitching;
    const hand = (p.person.pitchHand?.code || 'R');
    const gStats = p.stats.pitching;
    const bf = gStats.battersFaced || 0;
    const fpCount = fpsMap[p.person.id] || 0;
    return {
      id: p.person.id,
      name: p.person.fullName,
      num: p.jerseyNumber || '',
      pos: hand + 'HP',
     ...gStats,
      fpsCount: fpCount,
      fps: `${fpCount}/${bf}`,
      era: ss.era,
      ipSort: parseFloat(gStats.inningsPitched || 0),
      appearance: appearanceOrder[p.person.id] ?? 999,
      record: `${ss.wins || 0}-${ss.losses || 0}`,
      sIP: ss.inningsPitched || '0.0',
      sK: ss.strikeOuts || 0,
      sBB: ss.baseOnBalls || 0,
      sWHIP: ss.whip || '-.--'
    };
  }).filter(p => p.battersFaced > 0);

  pitchers.sort((a,b) => {
    const key = pitchSortState.key === 'inningsPitched'? 'ipSort' : pitchSortState.key;
    const va = a[key], vb = b[key];
    if (va === vb) return 0;
    const cmp = (typeof va === 'string')? va.localeCompare(vb) : va - vb;
    return pitchSortState.asc? cmp : -cmp;
  });

  // Compute team totals
  const addIP = (a, b) => {
    const [aW, aF] = String(a).split('.').map(Number);
    const [bW, bF] = String(b).split('.').map(Number);
    let thirds = (aF || 0) + (bF || 0);
    let whole = (aW || 0) + (bW || 0) + Math.floor(thirds / 3);
    thirds = thirds % 3;
    return thirds ? `${whole}.${thirds}` : `${whole}.0`;
  };
  const totals = pitchers.reduce((t, p) => {
    t.ip = addIP(t.ip, p.inningsPitched || '0.0');
    t.h += (p.hits || 0); t.r += (p.runs || 0); t.er += (p.earnedRuns || 0);
    t.bb += (p.baseOnBalls || 0); t.k += (p.strikeOuts || 0);
    t.pc += (p.pitchesThrown || 0); t.fps += (p.fpsCount || 0);
    t.bf += (p.battersFaced || 0);
    return t;
  }, { ip: '0.0', h: 0, r: 0, er: 0, bb: 0, k: 0, pc: 0, fps: 0, bf: 0 });

  let html = `<table id="pitchingTable" class="my-team"><thead>
    <tr class="group-row"><th colspan="1"></th><th colspan="8">Game</th><th colspan="6" class="divider">Season</th></tr>
    <tr>
    <th data-key="name">Pitcher</th><th data-key="inningsPitched">IP</th>
    <th data-key="hits">H</th><th data-key="runs">R</th><th data-key="earnedRuns">ER</th>
    <th data-key="baseOnBalls">BB</th><th data-key="strikeOuts">K</th>
    <th data-key="pitchesThrown">PC</th><th data-key="fps">FPS</th><th data-key="era" class="divider">ERA</th>
    <th data-key="record">W-L</th><th data-key="sIP">IP</th>
    <th data-key="sK">K</th><th data-key="sBB">BB</th><th data-key="sWHIP">WHIP</th></tr></thead>`;
  const currentPlay = liveData.plays?.currentPlay;
  const activePitcherId = currentPlay?.matchup?.pitcher?.id;

  pitchers.forEach(p => {
    const pcClass = p.pitchesThrown>100?'high-pc':'';
    const isActive = p.id === activePitcherId;
    const trClass = isActive ? ' class="active-player"' : '';
    html += `<tr${trClass} data-pid="${p.id}"><td><span class="p-num">${p.num}</span>${p.name} <span class="p-pos">${p.pos}</span></td><td>${p.inningsPitched}</td><td>${p.hits}</td>
      <td>${p.runs}</td><td>${p.earnedRuns}</td><td>${p.baseOnBalls}</td>
      <td>${p.strikeOuts}</td><td class="${pcClass}">${p.pitchesThrown}</td><td>${totals.bf ? p.fps : ''}</td><td class="divider">${p.era}</td>
      <td>${p.record}</td><td>${p.sIP}</td><td>${p.sK}</td><td>${p.sBB}</td><td>${p.sWHIP}</td></tr>`;
  });
  // Team totals row
  html += `<tr class="team-totals"><td><strong>Team</strong></td><td>${totals.ip}</td><td>${totals.h}</td>
    <td>${totals.r}</td><td>${totals.er}</td><td>${totals.bb}</td>
    <td>${totals.k}</td><td>${totals.pc}</td><td>${totals.fps}/${totals.bf}</td>
    <td class="divider"></td><td></td><td></td><td></td><td></td><td></td></tr>`;
  document.getElementById('content').innerHTML += html + '</table>';

  document.querySelectorAll('#pitchingTable th[data-key]').forEach(th => {
    th.onclick = () => {
      const key = th.dataset.key;
      pitchSortState.asc = (pitchSortState.key === key)?!pitchSortState.asc : (key === 'name');
      pitchSortState.key = key;
      renderBattingTable(my, liveData, isHome);
    };
    if (th.dataset.key === pitchSortState.key) th.textContent += pitchSortState.asc? ' ▲' : ' ▼';
  });
}

function showTeamStats() {
  if (!latestGameState) return;
  const { my, liveData, isHome } = latestGameState;
  const ts = my.teamStats.batting;
  const allPlays = liveData?.plays?.allPlays || [];
  const myHalf = isHome ? 'bottom' : 'top';

  const seasonLookup = {};
  Object.values(my.players).forEach(p => {
    seasonLookup[p.person.id] = p.seasonStats.batting;
  });

  const xbh = { '2B': [], '3B': [], 'HR': [] };
  const hbpList = [], sbList = [], csList = [];
  let rispH = 0, rispAB = 0;
  allPlays.forEach(play => {
    if (play.about.halfInning !== myHalf || !play.about.isComplete) return;
    const batter = play.matchup.batter.fullName;
    const batterId = play.matchup.batter.id;
    const ss = seasonLookup[batterId];
    const ev = play.result.event;
    if (ev === 'Double') xbh['2B'].push(`${batter} (${ss?.doubles || 0})`);
    else if (ev === 'Triple') xbh['3B'].push(`${batter} (${ss?.triples || 0})`);
    else if (ev === 'Home Run') xbh['HR'].push(`${batter} (${ss?.homeRuns || 0})`);
    else if (ev === 'Hit By Pitch') hbpList.push(`${batter} (${ss?.hitByPitch || 0})`);
    play.runners?.forEach(r => {
      const rName = r.details?.runner?.fullName;
      const rId = r.details?.runner?.id;
      const rss = seasonLookup[rId];
      if (r.details?.event?.includes('Stolen Base')) sbList.push(`${rName} (${rss?.stolenBases || 0})`);
      if (r.details?.event?.includes('Caught Stealing')) csList.push(`${rName} (${rss?.caughtStealing || 0})`);
    });
    const hasRisp = play.runners?.some(r =>
      r.details?.runner?.id !== play.matchup.batter.id &&
      (r.movement?.originBase === '2B' || r.movement?.originBase === '3B')
    );
    if (hasRisp && play.result.type === 'atBat') {
      rispAB++;
      if (['Single','Double','Triple','Home Run'].includes(ev)) rispH++;
    }
  });

  const statLine = (label, val) => `<div class="ts-line"><span class="ts-label">${label}</span><span class="ts-val">${val}</span></div>`;
  const playerList = arr => arr.length ? arr.join(', ') : '—';

  let body = '<div class="ts-cards">';
  body += '<div class="ts-card"><div class="ts-card-title">Batting</div>';
  body += statLine('2B', playerList(xbh['2B']));
  body += statLine('3B', playerList(xbh['3B']));
  body += statLine('HR', playerList(xbh['HR']));
  body += statLine('RISP', `${rispH}-for-${rispAB}`);
  body += statLine('LOB', ts.leftOnBase || 0);
  body += statLine('SF', ts.sacFlies || 0);
  body += statLine('SAC', ts.sacBunts || 0);
  body += statLine('GIDP', ts.groundIntoDoublePlay || 0);
  body += statLine('HBP', playerList(hbpList));
  body += '</div>';
  body += '<div class="ts-card"><div class="ts-card-title">Baserunning</div>';
  body += statLine('SB', sbList.length ? playerList(sbList) : (ts.stolenBases || 0));
  body += statLine('CS', csList.length ? playerList(csList) : (ts.caughtStealing || 0));
  body += statLine('PO', ts.pickoffs || 0);
  body += '</div>';

  // Season challenge stats card — selected team only
  const myStats = getTeamChallengeStats(TEAM_ID);
  body += '<div class="ts-card"><div class="ts-card-title">Season Challenges</div>';
  body += statLine('ABS', `${myStats.absWon}/${myStats.absUsed} won`);
  body += statLine('Manager', `${myStats.managerWon}/${myStats.managerUsed} won`);

  // Player leaderboard
  const myPlayers = getPlayerChallengeStats(TEAM_ID);
  if (myPlayers.length) {
    body += `<div class="ts-sub" style="margin-top:8px">Players</div>`;
    myPlayers.slice(0, 5).forEach(p => {
      body += statLine(`${p.name} <span class="p-pos">${p.role}</span>`, `${p.won}/${p.used}`);
    });
  }
  body += '</div>';

  body += '</div>';

  document.getElementById('tsModalBody').innerHTML = body;
  document.getElementById('teamStatsModal').style.display = 'flex';
}

function showZoneModal() {
  if (!latestGameState) return;
  const { liveData, isHome } = latestGameState;
  renderAtBat(liveData, isHome);
  document.getElementById('zoneModal').style.display = 'flex';
}

function showPlaysModal() {
  if (!latestGameState) return;
  const { liveData, isHome } = latestGameState;
  renderTimeline(liveData, isHome, true);
  document.getElementById('playsModal').style.display = 'flex';
}

function showPlayerModal(playerId) {
  if (!latestGameState) return;
  const { my, opp } = latestGameState;
  // Find player in either team
  const p = my.players['ID' + playerId] || opp.players['ID' + playerId];
  if (!p) return;

  const name = p.person.fullName;
  const num = p.jerseyNumber || '';
  const pos = p.position.abbreviation;
  const isPitcher = p.stats.pitching && Object.keys(p.stats.pitching).length > 0 && (pos === 'P' || p.stats.pitching.inningsPitched);
  const statLine = (label, val) => `<div class="ts-line"><span class="ts-label">${label}</span><span class="ts-val">${val}</span></div>`;

  let body = `<div class="player-header"><span class="p-num">${num}</span> ${name} <span class="p-pos">${pos}</span></div>`;
  body += '<div class="ts-cards">';

  // Batting season stats
  const b = p.seasonStats.batting;
  if (b && (b.gamesPlayed > 0 || b.plateAppearances > 0)) {
    const xbh = (b.doubles || 0) + (b.triples || 0) + (b.homeRuns || 0);
    body += '<div class="ts-card"><div class="ts-card-title">Batting</div>';
    body += statLine('G', b.gamesPlayed || 0);
    body += statLine('AB', b.atBats || 0);
    body += statLine('PA', b.plateAppearances || 0);
    body += statLine('H', b.hits || 0);
    body += statLine('XBH', xbh);
    body += statLine('HR', b.homeRuns || 0);
    body += statLine('BB', b.baseOnBalls || 0);
    body += statLine('K', b.strikeOuts || 0);
    body += statLine('SB', b.stolenBases || 0);
    body += statLine('CS', b.caughtStealing || 0);
    body += statLine('AVG', b.avg || '.---');
    body += statLine('OBP', b.obp || '.---');
    body += statLine('SLG', b.slg || '.---');
    body += statLine('OPS', b.ops || '.---');
    body += statLine('wOBA', calcWoba(b));
    body += '</div>';
  }

  // Pitching season stats
  const pt = p.seasonStats.pitching;
  if (isPitcher && pt && pt.gamesPlayed > 0) {
    body += '<div class="ts-card"><div class="ts-card-title">Pitching</div>';
    body += statLine('G', pt.gamesPlayed || 0);
    body += statLine('GS', pt.gamesStarted || 0);
    body += statLine('W-L', `${pt.wins || 0}-${pt.losses || 0}`);
    body += statLine('ERA', pt.era || '-.--');
    body += statLine('IP', pt.inningsPitched || '0.0');
    body += statLine('K', pt.strikeOuts || 0);
    body += statLine('BB', pt.baseOnBalls || 0);
    body += statLine('WHIP', pt.whip || '-.--');
    body += statLine('K/9', pt.strikeoutsPer9Inn || '-.--');
    body += statLine('BB/9', pt.walksPer9Inn || '-.--');
    body += statLine('H/9', pt.hitsPer9Inn || '-.--');
    body += statLine('SV', pt.saves || 0);
    body += statLine('HLD', pt.holds || 0);
    body += '</div>';
  }

  body += '</div>';
  document.getElementById('playerModalBody').innerHTML = body;
  document.getElementById('playerModal').style.display = 'flex';
}

function showAtBatDetail(atBatIndex) {
  if (!latestGameState) return;
  const { liveData, isHome, my } = latestGameState;
  const allPlays = liveData.plays.allPlays || [];
  const myHalf = isHome ? 'bottom' : 'top';

  const abPlay = allPlays.find(p => p.about.atBatIndex === atBatIndex);
  if (!abPlay) return;

  const batterId = abPlay.matchup.batter.id;
  const batterName = abPlay.matchup.batter.fullName;
  const inning = abPlay.about.inning;
  const playerInfo = my.players['ID' + batterId];
  const num = playerInfo?.jerseyNumber || '';
  const pos = playerInfo?.position?.abbreviation || '';

  // Build at-bat detail card
  const pitcherName = abPlay.matchup.pitcher.fullName;
  const count = abPlay.count ? `${abPlay.count.balls}-${abPlay.count.strikes}` : '';
  const result = abPlay.result.event || '';
  const desc = abPlay.result.description || '';

  const eventLine = (icon, text) => `<div class="ab-event">${icon ? `<span class="ab-icon">${icon}</span>` : ''}<span class="ab-text">${text}</span></div>`;

  let body = `<div class="player-header"><span class="p-num">${num}</span> ${batterName} <span class="p-pos">${pos}</span></div>`;
  body += '<div class="ts-cards">';

  // At-Bat card
  body += '<div class="ts-card"><div class="ts-card-title">At Bat — Inning ' + inning + '</div>';
  body += eventLine('', `vs ${pitcherName}`);
  body += eventLine('', `Count: ${count}`);
  const resultCls = isHit(result) ? 'sc-hit' : isOnBase(result) ? 'sc-ob' : 'sc-out';
  body += eventLine('', `<span class="${resultCls}">${result}</span>`);
  body += eventLine('', desc);
  body += '</div>';

  // Trace runner journey through the rest of the half-inning
  // Handle pinch runners by tracking current runner ID
  let trackId = batterId;
  const events = [];

  // Get all plays in this half-inning after the at-bat
  const laterPlays = allPlays.filter(p =>
    p.about.halfInning === myHalf &&
    p.about.inning === inning &&
    p.about.isComplete &&
    p.about.atBatIndex > atBatIndex
  );

  for (const play of laterPlays) {
    if (!play.runners) continue;
    for (const r of play.runners) {
      const rId = r.details?.runner?.id;
      if (rId !== trackId) continue;

      const start = r.movement?.originBase || '';
      const end = r.movement?.end || '';
      const rEvent = r.details?.event || '';
      const rIsOut = r.movement?.isOut || r.details?.isOut;
      const onBatter = play.matchup?.batter?.fullName || '';
      const playCount = play.count ? `${play.count.balls}-${play.count.strikes}` : '';
      const playDesc = play.result?.description || '';

      let label = '';
      if (rEvent) {
        label = rEvent;
      } else if (end === 'score') {
        label = 'Scored';
      } else if (rIsOut) {
        label = 'Out';
      } else if (end && start && end !== start) {
        label = `Advanced to ${end}`;
      }

      if (!label) continue;

      let detail = '';
      if (onBatter) detail += `During ${onBatter}'s AB`;
      if (playCount) detail += ` (${playCount})`;

      const icon = end === 'score' ? '●' : rIsOut ? '✕' : rEvent.includes('Stolen') ? '→' : '→';
      events.push({ icon, label, detail, desc: playDesc, isOut: rIsOut, scored: end === 'score' });

      // Journey ends on score or out
      if (end === 'score' || rIsOut) break;
    }

    // Check for pinch runner replacement: if a runner replaces our tracked runner
    // the MLB API shows this as our runner going out and new runner at the same base
    // We detect by looking for offensive substitution plays
    if (play.result?.eventType === 'offensive_substitution') {
      for (const r of play.runners) {
        if (r.details?.runner?.id !== trackId) {
          const end = r.movement?.end;
          // New runner appeared at a base — this is our replacement
          if (end && end !== 'score' && !r.movement?.isOut) {
            trackId = r.details.runner.id;
            events.push({ icon: '↔', label: `Pinch runner: ${r.details.runner.fullName}`, detail: '', desc: '', isOut: false, scored: false });
            break;
          }
        }
      }
    }

    // Stop if journey ended
    const last = events[events.length - 1];
    if (last && (last.isOut || last.scored)) break;
  }

  if (events.length > 0) {
    body += '<div class="ts-card"><div class="ts-card-title">On the Bases</div>';
    events.forEach(e => {
      let html = `<div class="ab-event"><span class="ab-icon">${e.icon}</span><div class="ab-event-body">`;
      html += `<span class="ab-text">${e.label}</span>`;
      if (e.detail) html += `<span class="ab-detail">${e.detail}</span>`;
      if (e.desc) html += `<span class="ab-desc">${e.desc}</span>`;
      html += '</div></div>';
      body += html;
    });
    body += '</div>';
  }

  body += '</div>';
  document.getElementById('playerModalBody').innerHTML = body;
  document.getElementById('playerModal').style.display = 'flex';
}

let timelineFilter = 'scoring';

function getChallengeType(play) {
  if (!play.about.hasReview || !play.reviewDetails) return null;
  const rt = play.reviewDetails.reviewType;
  if (rt === 'MJ') return 'abs';
  return 'review';
}

function getAbsChallenges(play) {
  // ABS challenges live on individual pitch events within a play
  return (play.playEvents || [])
    .filter(pe => pe.reviewDetails && pe.reviewDetails.reviewType === 'MJ')
    .map(pe => ({
      player: pe.reviewDetails.player?.fullName || 'Unknown',
      overturned: pe.reviewDetails.isOverturned,
      inProgress: pe.reviewDetails.inProgress,
      challengeTeamId: pe.reviewDetails.challengeTeamId,
      pitchNumber: pe.pitchNumber
    }));
}

function renderTimeline(liveData, isHome, toModal) {
  const allPlays = (liveData.plays.allPlays || []).filter(p => p.about.isComplete && p.result.type === 'atBat');

  // Filter toggle
  let html = '<div class="tl-filter">';
  html += `<button class="tl-btn${timelineFilter === 'all' ? ' active' : ''}" data-filter="all">All Plays</button>`;
  html += `<button class="tl-btn${timelineFilter === 'scoring' ? ' active' : ''}" data-filter="scoring">Scoring</button>`;
  html += `<button class="tl-btn${timelineFilter === 'challenges' ? ' active' : ''}" data-filter="challenges">Challenges</button>`;
  html += '</div>';

  // Challenge season summary when on Challenges tab — selected team only
  if (timelineFilter === 'challenges') {
    const myStats = getTeamChallengeStats(TEAM_ID);
    html += '<div class="ch-season-summary">';
    html += `<span><strong>${TEAMS[TEAM_ID]}</strong> ABS ${myStats.absWon}/${myStats.absUsed}</span>`;
    html += `<span class="ch-sep">Season</span>`;
    html += `<span>Manager ${myStats.managerWon}/${myStats.managerUsed}</span>`;
    html += '</div>';
  }

  // Filter plays
  let plays;
  if (timelineFilter === 'scoring') {
    plays = allPlays.filter(p => p.result.rbi > 0 || /homers|scores/i.test(p.result.description));
  } else if (timelineFilter === 'challenges') {
    plays = allPlays.filter(p => getChallengeType(p) || getAbsChallenges(p).length > 0);
  } else {
    plays = allPlays;
  }

  html += '<div class="timeline">';
  if (plays.length === 0) {
    html += '<div class="play opp-play">' + (timelineFilter === 'challenges' ? 'No challenges this game' : 'No plays yet') + '</div>';
  } else {
    // Group by inning
    const byInning = {};
    plays.forEach(play => {
      const key = play.about.inning;
      if (!byInning[key]) byInning[key] = [];
      byInning[key].push(play);
    });

    // Render inning by inning, latest first
    const inningNums = Object.keys(byInning).map(Number).sort((a, b) => b - a);
    inningNums.forEach(inn => {
      html += `<div class="tl-inning-header">Inning ${inn}</div>`;
      byInning[inn].slice().reverse().forEach(play => {
        const challengeType = getChallengeType(play);
        const absChallenges = getAbsChallenges(play);
        const battingTeam = play.about.halfInning === 'top' ? liveData.boxscore.teams.away : liveData.boxscore.teams.home;
        const isMyTeam = battingTeam.team.id === TEAM_ID;
        const half = play.about.halfInning === 'top' ? '▲' : '▼';
        const event = play.result.event || '';
        const batter = play.matchup.batter.fullName;

        // Determine play class: manager challenge > normal play styling
        let playCls;
        if (challengeType === 'review') playCls = 'challenge-play';
        else if (absChallenges.length > 0) playCls = 'abs-challenge-play';
        else playCls = isMyTeam ? 'my-play' : 'opp-play';

        html += `<div class="play ${playCls}">`;
        html += `<div class="tl-half">${half}</div>`;
        html += `<div class="tl-body">`;

        // Headline with manager challenge badge if applicable
        if (challengeType === 'review') {
          const outcome = play.reviewDetails.isOverturned ? 'Overturned' : 'Confirmed';
          html += `<div class="tl-headline">${batter} — ${event}<span class="ch-badge ch-badge-review">Challenge · ${outcome}</span></div>`;
        } else {
          html += `<div class="tl-headline">${batter} — ${event}</div>`;
        }

        html += `<div class="tl-detail">${play.result.description || ''}</div>`;

        // ABS challenge details from pitch events
        if (absChallenges.length > 0) {
          absChallenges.forEach(ac => {
            const outcome = ac.inProgress ? 'In Progress' : ac.overturned ? 'Overturned' : 'Confirmed';
            html += `<div class="tl-detail"><span class="ch-badge ch-badge-abs">ABS · ${outcome}</span> ${ac.player} challenged pitch #${ac.pitchNumber}</div>`;
          });
        }

        if (play.result.rbi > 0) {
          html += `<div class="meta">${batter} — ${play.result.rbi} RBI</div>`;
        }
        html += '</div></div>';
      });
    });
  }

  html += '</div>';
  const target = toModal ? document.getElementById('playsModalBody') : document.getElementById('content');
  target.innerHTML = html;

  // Wire filter buttons
  target.querySelectorAll('.tl-btn').forEach(btn => {
    btn.onclick = () => { timelineFilter = btn.dataset.filter; renderTimeline(liveData, isHome, toModal); };
  });
}

function eventAbbrev(event) {
  const map = {
    'Single':'1B','Double':'2B','Triple':'3B','Home Run':'HR',
    'Strikeout':'K','Strikeout - DP':'K','Called Strikeout':'Kc',
    'Walk':'BB','Intent Walk':'IBB','Hit By Pitch':'HBP',
    'Groundout':'GO','Flyout':'FO','Pop Out':'PO','Line Out':'LO',
    'Lineout':'LO','Grounded Into DP':'GDP','Double Play':'DP',
    "Fielder's Choice":'FC','Forceout':'FC','Field Error':'E',
    'Sac Fly':'SF','Sac Bunt':'SAC','Sac Fly DP':'SF',
    'Bunt Groundout':'BG','Bunt Pop Out':'BP',
    'Runner Out':'RO','Caught Stealing':'CS','Pickoff':'PK',
    'Catcher Interf':'CI','Fan Interference':'FI'
  };
  return map[event] || (event ? event.substring(0,3).toUpperCase() : '?');
}

function scoringNotation(play) {
  const ev = play.result.event;
  // Hits, walks, HBP — use standard abbreviations
  if (isHit(ev) || isOnBase(ev)) return eventAbbrev(ev);
  if (['Strikeout','Called Strikeout','Strikeout - DP'].includes(ev)) return eventAbbrev(ev);
  if (ev === 'Caught Stealing' || ev === 'Pickoff') return eventAbbrev(ev);

  // Extract fielder position numbers from credits on the batter's runner entry
  const batterRunner = play.runners?.find(r => r.details?.runner?.id === play.matchup.batter.id);
  const credits = batterRunner?.credits || [];
  const positions = credits.map(c => c.position?.code).filter(Boolean);

  if (positions.length > 0) {
    const chain = positions.join('-');
    // Fly/line/pop outs — prefix letter + fielder number
    if (ev === 'Flyout') return 'F' + positions[0];
    if (ev === 'Line Out' || ev === 'Lineout') return 'L' + positions[0];
    if (ev === 'Pop Out') return 'P' + positions[0];
    if (ev === 'Bunt Pop Out') return 'BP' + positions[0];
    // Prefix with context for special plays
    if (ev === 'Field Error') return 'E' + positions[0];
    if (ev === 'Sac Fly' || ev === 'Sac Fly DP') return 'SF' + positions[0];
    if (ev === 'Sac Bunt') return 'SAC ' + chain;
    if (ev === 'Bunt Groundout') return 'BG ' + chain;
    if (ev === "Fielder's Choice" || ev === 'Forceout') return 'FC ' + chain;
    // For DP, gather all runner credits
    if (ev === 'Grounded Into DP' || ev === 'Double Play') {
      const allPos = [];
      play.runners?.forEach(r => r.credits?.forEach(c => { if (c.position?.code) allPos.push(c.position.code); }));
      const unique = [...new Set(allPos)];
      return unique.length > 0 ? unique.join('-') + ' DP' : eventAbbrev(ev);
    }
    return chain;
  }

  return eventAbbrev(ev);
}

function isHit(event) {
  return ['Single','Double','Triple','Home Run'].includes(event);
}

function isOnBase(event) {
  return ['Single','Double','Triple','Home Run','Walk','Intent Walk','Hit By Pitch'].includes(event);
}

function basesDiamond(furthestBase, outNum) {
  const scored = furthestBase >= 4;
  const reached = { '1B': furthestBase >= 1, '2B': furthestBase >= 2, '3B': furthestBase >= 3, 'score': scored };
  const isOut = outNum > 0;

  const col = scored ? '#ffd700' : 'var(--accent)';
  const dim = '#444';
  // Diamond: top=2B, right=1B, bottom=home, left=3B
  let svg = '<svg class="sc-diamond" width="38" height="38" viewBox="0 0 20 20">';
  if (scored) {
    svg += `<polygon points="10,3 17,10 10,17 3,10" fill="#ffd70044" stroke="#ffd700" stroke-width="1.5"/>`;
  } else {
    svg += `<line x1="10" y1="17" x2="17" y2="10" stroke="${reached['1B']?col:dim}" stroke-width="1.5"/>`;
    svg += `<line x1="17" y1="10" x2="10" y2="3" stroke="${reached['2B']?col:dim}" stroke-width="1.5"/>`;
    svg += `<line x1="10" y1="3" x2="3" y2="10" stroke="${reached['3B']?col:dim}" stroke-width="1.5"/>`;
    svg += `<line x1="3" y1="10" x2="10" y2="17" stroke="${reached['score']?col:dim}" stroke-width="1.5"/>`;
  }
  if (isOut) {
    svg += `<circle cx="10" cy="10" r="6" fill="none" stroke="#e05555" stroke-width="1.2"/>`;
    svg += `<text x="10" y="10.5" text-anchor="middle" dominant-baseline="middle" fill="#e05555" font-size="7" font-weight="700">${outNum}</text>`;
  }
  svg += '</svg>';
  return svg;
}

function playCount(play) {
  const c = play.count;
  if (!c) return '';
  return `${c.balls}-${c.strikes}`;
}

function renderScorecard(liveData, isHome) {
  const my = liveData.boxscore.teams[isHome ? 'home' : 'away'];
  const myHalf = isHome ? 'bottom' : 'top';
  const allPlays = liveData.plays.allPlays || [];
  const innings = liveData.linescore.innings || [];
  const numInnings = Math.max(innings.length, 9);
  const currentPlay = liveData.plays?.currentPlay;
  const activeBatterId = currentPlay?.matchup?.batter?.id;

  // Build lineup slots from battingOrder field
  const lineup = {};
  const playerSlot = {};
  Object.values(my.players).forEach(p => {
    if (!p.battingOrder) return;
    const slot = Math.floor(parseInt(p.battingOrder) / 100);
    const sub = parseInt(p.battingOrder) % 100;
    if (!lineup[slot]) lineup[slot] = [];
    lineup[slot].push({ id: p.person.id, name: p.person.fullName, pos: p.position.abbreviation, sub, num: p.jerseyNumber || '' });
    playerSlot[p.person.id] = slot;
  });
  Object.values(lineup).forEach(arr => arr.sort((a, b) => a.sub - b.sub));

  // Check for empty lineup (pre-game)
  if (Object.keys(lineup).length === 0) {
    document.getElementById('content').innerHTML = '<div class="preview"><div class="venue-info">Lineup not yet available</div></div>';
    return;
  }

  // Filter to our team's completed at-bats and group by slot + inning
  const myPlays = allPlays.filter(p => p.about.halfInning === myHalf && p.about.isComplete && p.result.type === 'atBat');
  const grid = {};
  myPlays.forEach(play => {
    const slot = playerSlot[play.matchup.batter.id];
    if (!slot) return;
    const inn = play.about.inning;
    if (!grid[slot]) grid[slot] = {};
    if (!grid[slot][inn]) grid[slot][inn] = [];
    grid[slot][inn].push(play);
  });

  // Track furthest base each runner reaches per at-bat (across all subsequent plays)
  const baseVal = { '1B': 1, '2B': 2, '3B': 3, 'score': 4 };
  // Key: `${playerId}-${inning}-${atBatIndex}` → furthest base (1-4)
  const furthest = {};
  // First pass: find where each batter initially reaches on their own at-bat
  const atBatKey = {}; // playerId → current key for tracking
  const allMyHalfPlays = allPlays.filter(p => p.about.halfInning === myHalf && p.about.isComplete);

  // Track out numbers per runner
  // Key: `${runnerId}-${inning}-${atBatIndex}` → out number (1, 2, or 3)
  const outsOnRunner = {};
  const outsByInning = {};

  allMyHalfPlays.forEach(play => {
    const inn = play.about.inning;
    if (!outsByInning[inn]) outsByInning[inn] = 0;

    // Always create a key for the batter on their at-bat
    if (play.result?.type === 'atBat') {
      atBatKey[play.matchup.batter.id] = `${play.matchup.batter.id}-${inn}-${play.about.atBatIndex}`;
    }

    play.runners?.forEach(r => {
      const rid = r.details?.runner?.id;
      if (!rid) return;

      // Track base advancement
      const end = r.movement?.end;
      const val = baseVal[end] || 0;
      if (val) {
        const key = atBatKey[rid];
        if (key) {
          furthest[key] = Math.max(furthest[key] || 0, val);
        }
      }

      // Track outs
      if (r.movement?.isOut || r.details?.isOut) {
        outsByInning[inn]++;
        const key = atBatKey[rid];
        if (key) outsOnRunner[key] = outsByInning[inn];
      }
    });
  });

  // Render header
  let html = '<div class="scorecard"><table class="sc-table"><thead><tr>';
  html += '<th class="sc-name">Player</th>';
  for (let i = 1; i <= numInnings; i++) html += `<th class="sc-inn">${i}</th>`;
  html += '<th class="sc-inn">AB</th><th class="sc-inn">H</th><th class="sc-inn">R</th>';
  html += '</tr></thead><tbody>';

  // Render lineup rows
  for (let slot = 1; slot <= 9; slot++) {
    const players = lineup[slot] || [];
    if (players.length === 0) { html += `<tr><td class="sc-name">—</td>${'<td class="sc-cell"></td>'.repeat(numInnings + 3)}</tr>`; continue; }

    players.forEach((player, pidx) => {
      const isActive = player.id === activeBatterId;
      const classes = [pidx > 0 ? 'sc-sub' : '', isActive ? 'active-player' : ''].filter(Boolean).join(' ');
      const trClass = classes ? ` class="${classes}"` : '';
      html += `<tr${trClass}>`;
      html += `<td class="sc-name"><span class="sc-num">${player.num}</span>${player.name} <span class="sc-pos-tag">${player.pos}</span></td>`;

      let pAB = 0, pH = 0, pR = 0;
      // Current live at-bat info for this player
      const isLiveAB = player.id === activeBatterId && currentPlay && !currentPlay.about.isComplete
        && currentPlay.about.halfInning === myHalf;
      const liveInning = isLiveAB ? currentPlay.about.inning : null;
      const liveCount = isLiveAB ? `${currentPlay.count.balls}-${currentPlay.count.strikes}` : '';

      for (let inn = 1; inn <= numInnings; inn++) {
        const cellPlays = (grid[slot]?.[inn] || []).filter(p => p.matchup.batter.id === player.id);
        if (cellPlays.length === 0) {
          if (inn === liveInning) {
            html += `<td class="sc-cell"><div class="sc-ab"><span class="sc-count sc-live-count">${liveCount}</span></div></td>`;
          } else {
            html += '<td class="sc-cell"></td>';
          }
        } else {
          const results = cellPlays.map(p => {
            const ev = p.result.event;
            const ab = scoringNotation(p);
            const cls = isHit(ev) ? 'sc-hit' : isOnBase(ev) ? 'sc-ob' : 'sc-out';
            // Tally stats
            if (!['Walk','Intent Walk','Hit By Pitch','Sac Fly','Sac Bunt','Sac Fly DP'].includes(ev)) pAB++;
            if (isHit(ev)) pH++;
            // Count runs scored by this player in this play
            p.runners?.forEach(r => {
              if (r.details?.isScoringEvent && r.movement?.end === 'score' && r.details?.runner?.id === player.id) pR++;
            });
            const fKey = `${player.id}-${inn}-${p.about.atBatIndex}`;
            const outNum = outsOnRunner[fKey] || 0;
            const diamond = basesDiamond(furthest[fKey] || 0, outNum);
            const cnt = playCount(p);
            return `<div class="sc-ab sc-clickable" onclick="showAtBatDetail(${p.about.atBatIndex})"><span class="sc-count">${cnt}</span><span class="${cls}" title="${ev}">${ab}</span>${diamond}</div>`;
          }).join('');
          html += `<td class="sc-cell">${results}</td>`;
        }
      }
      html += `<td class="sc-cell sc-stat">${pAB || ''}</td>`;
      html += `<td class="sc-cell sc-stat">${pH || ''}</td>`;
      html += `<td class="sc-cell sc-stat">${pR || ''}</td>`;
      html += '</tr>';
    });
  }

  // Inning runs footer
  html += '<tr class="sc-runs"><td class="sc-name">Runs</td>';
  const side = isHome ? 'home' : 'away';
  for (let i = 1; i <= numInnings; i++) {
    const innData = innings[i - 1];
    const runs = innData?.[side]?.runs;
    html += `<td class="sc-cell sc-run-cell">${runs !== undefined ? runs : ''}</td>`;
  }
  const totalR = innings.reduce((s, inn) => s + (inn[side]?.runs || 0), 0);
  html += `<td class="sc-cell sc-stat" colspan="3">${totalR}</td>`;
  html += '</tr>';

  html += '</tbody></table></div>';
  document.getElementById('content').innerHTML = html;
}

function renderLiveInfo(liveData, isHome, state, inningLabel) {
  const el = document.getElementById('liveInfo');
  const play = liveData.plays.currentPlay;
  const gd = liveData._gameData;

  // Challenge info
  const side = isHome ? 'home' : 'away';
  const review = gd?.review?.[side];
  const abs = gd?.absChallenges?.[side];
  const challengeHtml = (review || abs) ? `<span class="li-challenges">`
    + `CH:${review?.remaining ?? '—'} ABS:${abs?.remaining ?? '—'}`
    + `</span>` : '';

  if (state === 'Final' || !play) {
    el.innerHTML = `${challengeHtml}<span class="li-inning">${inningLabel}</span>`;
    return;
  }

  // Determine if our team is batting or pitching
  const myBatting = isHome ? play.about.halfInning === 'bottom' : play.about.halfInning === 'top';
  const playerName = myBatting
    ? play.matchup.batter.fullName
    : play.matchup.pitcher.fullName;
  const role = myBatting ? 'AB' : 'P';

  const balls = play.count.balls;
  const strikes = play.count.strikes;
  const outs = play.count.outs;

  const outDots = '●'.repeat(outs) + '○'.repeat(Math.max(0, 3 - outs));
  el.innerHTML = `
    <span class="mc-player">${playerName}</span>
    <span class="mc-sep">│</span>
    <span class="mc-count">${balls}-${strikes}</span>
    <span class="mc-sep">│</span>
    <span class="mc-outs">${outDots}</span>
    <span class="mc-sep">│</span>
    <span class="mc-inning">${inningLabel}</span>
    ${challengeHtml}`;
}

function renderAtBat(liveData, isHome) {
  const play = liveData.plays.currentPlay;
  const el = document.getElementById('zoneModalBody');
  if (!play) { el.innerHTML = '<div class="zone-tab-empty">No current at-bat</div>'; return; }

  const pitches = play.playEvents.filter(e => e.isPitch);
  if (pitches.length === 0) { el.innerHTML = '<div class="zone-tab-empty">No pitches yet</div>'; return; }

  // Strike zone bounds
  const lastP = pitches[pitches.length - 1];
  const szTop = lastP.pitchData?.strikeZoneTop || 3.5;
  const szBottom = lastP.pitchData?.strikeZoneBottom || 1.5;

  // Coordinate mapping: pX [-2,2] → x [0,400], pZ [0,5] → y [500,0]
  const mapX = px => ((px + 2) / 4) * 400;
  const mapY = pz => ((5 - pz) / 5) * 500;

  const zx1 = mapX(-0.708), zx2 = mapX(0.708);
  const zy1 = mapY(szTop), zy2 = mapY(szBottom);

  let svg = '<svg viewBox="-10 -10 420 520" class="sz-svg">';
  // Zone box
  svg += `<rect x="${zx1}" y="${zy1}" width="${zx2-zx1}" height="${zy2-zy1}" class="sz-zone"/>`;
  // Zone 3x3 grid
  const zw = (zx2 - zx1) / 3, zh = (zy2 - zy1) / 3;
  for (let i = 1; i < 3; i++) {
    svg += `<line x1="${zx1+zw*i}" y1="${zy1}" x2="${zx1+zw*i}" y2="${zy2}" class="sz-grid"/>`;
    svg += `<line x1="${zx1}" y1="${zy1+zh*i}" x2="${zx2}" y2="${zy1+zh*i}" class="sz-grid"/>`;
  }
  // Plate
  svg += `<line x1="${zx1}" y1="${mapY(0.5)}" x2="${zx2}" y2="${mapY(0.5)}" stroke="#444" stroke-width="3"/>`;

  // Plot pitches
  pitches.forEach((p, i) => {
    const coords = p.pitchData?.coordinates;
    if (!coords || coords.pX === undefined) return;
    const cx = mapX(coords.pX), cy = mapY(coords.pZ);
    const code = p.details.call?.code || p.details.code || 'B';
    const type = p.details.type?.code || '';
    const speed = p.pitchData.startSpeed ? Math.round(p.pitchData.startSpeed) : '';
    const desc = `#${i+1} ${type} ${speed}mph — ${p.details.description || ''}`;

    let cls = 'sz-ball';
    if (code === 'S' || code === 'C' || code === 'T') cls = 'sz-strike';
    else if (code === 'F') cls = 'sz-foul';
    else if (code === 'X' || code === 'D' || code === 'E') cls = 'sz-inplay';

    svg += `<circle cx="${cx}" cy="${cy}" r="14" class="sz-dot ${cls}"><title>${desc}</title></circle>`;
    svg += `<text x="${cx}" y="${cy+1}" class="sz-num">${i+1}</text>`;
  });
  svg += '</svg>';

  // Pitch list
  let list = '<div class="sz-list">';
  pitches.forEach((p, i) => {
    const code = p.details.call?.code || p.details.code || 'B';
    let cls = 'sz-ball';
    if (code === 'S' || code === 'C' || code === 'T') cls = 'sz-strike';
    else if (code === 'F') cls = 'sz-foul';
    else if (code === 'X' || code === 'D' || code === 'E') cls = 'sz-inplay';

    const speed = p.pitchData?.startSpeed ? Math.round(p.pitchData.startSpeed) : '';
    const type = p.details.type?.description || p.details.type?.code || '';
    list += `<div class="sz-pitch ${cls}">
      <span class="sz-pnum">${i+1}</span>
      <span class="sz-ptype">${type}</span>
      <span class="sz-pspeed">${speed}</span>
      <span class="sz-presult">${p.details.description || ''}</span>
    </div>`;
  });
  list += '</div>';

  const batter = play.matchup?.batter?.fullName || '';
  const pitcher = play.matchup?.pitcher?.fullName || '';
  const count = play.count ? `${play.count.balls}-${play.count.strikes}` : '';
  const batSide = play.matchup?.batSide?.code || '';
  const batSideLabel = batSide === 'L' ? 'LHB' : batSide === 'R' ? 'RHB' : '';
  const pitchHand = play.matchup?.pitchHand?.code || '';
  const pitchHandLabel = pitchHand === 'L' ? 'LHP' : pitchHand === 'R' ? 'RHP' : '';
  // Catcher's view: seeing batter from behind
  // RHB on left side (bat extends right from behind)
  const rhbSvg = `<svg viewBox="0 0 40 80" class="batter-silhouette"><circle cx="20" cy="10" r="8" fill="currentColor"/><line x1="20" y1="18" x2="20" y2="50" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="20" y1="50" x2="10" y2="72" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="20" y1="50" x2="30" y2="72" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="20" y1="28" x2="34" y2="20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="34" y1="20" x2="38" y2="6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
  // LHB on right side (bat extends left from behind)
  const lhbSvg = `<svg viewBox="0 0 40 80" class="batter-silhouette"><circle cx="20" cy="10" r="8" fill="currentColor"/><line x1="20" y1="18" x2="20" y2="50" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="20" y1="50" x2="10" y2="72" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="20" y1="50" x2="30" y2="72" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="20" y1="28" x2="6" y2="20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="6" y1="20" x2="2" y2="6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;

  const isLefty = batSide === 'L';
  el.innerHTML = `<div class="zone-tab">
    <div class="zone-tab-header">${batter} <span class="zone-side">${batSideLabel}</span> vs ${pitcher} <span class="zone-side">${pitchHandLabel}</span> <span class="zone-count">${count}</span></div>
    <div class="zone-tab-body">
      <div class="zone-plate-wrapper">
        ${!isLefty ? `<div class="batter-indicator">${rhbSvg}</div>` : '<div class="batter-indicator" style="visibility:hidden"><svg viewBox="0 0 40 80" class="batter-silhouette"></svg></div>'}
        ${svg}
        ${isLefty ? `<div class="batter-indicator">${lhbSvg}</div>` : '<div class="batter-indicator" style="visibility:hidden"><svg viewBox="0 0 40 80" class="batter-silhouette"></svg></div>'}
      </div>
      ${list}
    </div>
  </div>`;
}

document.getElementById('szClose').onclick = () => document.getElementById('szModal').style.display = 'none';
document.getElementById('szModal').onclick = e => { if (e.target.id === 'szModal') e.target.style.display = 'none'; };
document.querySelectorAll('nav button').forEach(btn => {
  btn.onclick = () => { currentTab = btn.dataset.tab; userPickedTab = true; update(); };
});

document.getElementById('zoneBtn').onclick = showZoneModal;
document.getElementById('playsBtn').onclick = showPlaysModal;
document.getElementById('statsBtn').onclick = showTeamStats;

document.getElementById('zoneClose').onclick = () => document.getElementById('zoneModal').style.display = 'none';
document.getElementById('zoneModal').onclick = e => { if (e.target.id === 'zoneModal') e.target.style.display = 'none'; };
document.getElementById('playsClose').onclick = () => document.getElementById('playsModal').style.display = 'none';
document.getElementById('playsModal').onclick = e => { if (e.target.id === 'playsModal') e.target.style.display = 'none'; };
document.getElementById('tsClose').onclick = () => document.getElementById('teamStatsModal').style.display = 'none';
document.getElementById('teamStatsModal').onclick = e => { if (e.target.id === 'teamStatsModal') e.target.style.display = 'none'; };
document.getElementById('standingsClose').onclick = () => document.getElementById('standingsModal').style.display = 'none';
document.getElementById('standingsModal').onclick = e => { if (e.target.id === 'standingsModal') e.target.style.display = 'none'; };
document.getElementById('playerClose').onclick = () => document.getElementById('playerModal').style.display = 'none';
document.getElementById('playerModal').onclick = e => { if (e.target.id === 'playerModal') e.target.style.display = 'none'; };

// Full league standings popup on division bar click
document.getElementById('divStandings').onclick = () => showStandingsModal();

const DIV_NAMES = { 201:'AL East', 202:'AL Central', 200:'AL West', 204:'NL East', 205:'NL Central', 203:'NL West' };

function showStandingsModal() {
  fetchStandings().then(records => {
    let html = '';
    // Sort divisions: AL East, Central, West then NL East, Central, West
    const divOrder = [201, 202, 200, 204, 205, 203];
    const sorted = divOrder.map(id => records.find(r => r.division?.id === id)).filter(Boolean);
    // Fallback if division IDs don't match
    const divisions = sorted.length ? sorted : records;

    divisions.forEach(div => {
      const divName = DIV_NAMES[div.division?.id] || div.division?.name || 'Division';
      html += `<div class="standings-division">`;
      html += `<div class="standings-division-title">${divName}</div>`;
      html += `<table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>L10</th><th>STRK</th></tr></thead><tbody>`;
      const teams = div.teamRecords.sort((a, b) => parseInt(a.divisionRank) - parseInt(b.divisionRank));
      teams.forEach(tr => {
        const isMy = tr.team.id === TEAM_ID ? ' st-my-team' : '';
        const gb = tr.divisionGamesBack === '-' ? '—' : tr.divisionGamesBack;
        const l10 = tr.records?.splitRecords?.find(r => r.type === 'lastTen');
        const l10Str = l10 ? `${l10.wins}-${l10.losses}` : '';
        html += `<tr class="${isMy}"><td><div class="st-team-cell"><img src="${LOGO_URL(tr.team.id)}" class="st-logo" alt="">${tr.team.name}</div></td>`;
        html += `<td>${tr.wins}</td><td>${tr.losses}</td><td>${tr.winningPercentage}</td><td>${gb}</td><td>${l10Str}</td><td>${tr.streak?.streakCode || ''}</td></tr>`;
      });
      html += '</tbody></table></div>';
    });

    document.getElementById('standingsModalBody').innerHTML = html;
    document.getElementById('standingsModal').style.display = 'flex';
  }).catch(() => {});
}

function updateActiveTab() {
  document.querySelectorAll('nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTab);
  });
}

function renderPreview(gameData, isHome) {
  const myTeam = gameData.teams[isHome ? 'home' : 'away'];
  const oppTeam = gameData.teams[isHome ? 'away' : 'home'];
  const pp = gameData.probablePitchers || {};

  let html = '<div class="preview">';
  html += `<div class="matchup-header">${myTeam.name} <span class="vs">vs</span> ${oppTeam.name}</div>`;
  html += `<div class="records">(${myTeam.record.wins}-${myTeam.record.losses}) vs (${oppTeam.record.wins}-${oppTeam.record.losses})</div>`;

  if (pp.away || pp.home) {
    const myPP = pp[isHome ? 'home' : 'away'];
    const oppPP = pp[isHome ? 'away' : 'home'];
    html += '<div class="probable-pitchers">';
    html += '<h3>Probable Pitchers</h3>';
    if (myPP) html += `<div class="pp my-play">${myPP.fullName}</div>`;
    if (oppPP) html += `<div class="pp opp-play">${oppPP.fullName}</div>`;
    html += '</div>';
  }

  html += `<div class="venue-info">${gameData.venue?.name || ''}</div>`;
  html += '</div>';
  document.getElementById('content').innerHTML = html;
}

async function update() {
  try {
    if (!gamePk) gamePk = await getTodayGamePk();
    if (!gamePk) {
      document.getElementById('scoreText').textContent = 'No game today';
      document.getElementById('content').innerHTML = '';
      document.getElementById('atbat').innerHTML = '';
      renderDivisionStandings();
      return;
    }
    const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`);
    const { gameData, liveData } = await res.json();
    liveData._gameData = gameData;
    const state = gameData.status.abstractGameState;
    const isHome = gameData.teams.home.id === TEAM_ID;
    const my = liveData.boxscore.teams[isHome ? 'home' : 'away'];
    const opp = liveData.boxscore.teams[isHome ? 'away' : 'home'];

    if (state === 'Preview') {
      const localTime = new Date(gameData.datetime.dateTime).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
      const status = gameData.status.detailedState;
      const oppId = opp.team.id;
      document.getElementById('scoreText').innerHTML = `
        ${TEAMS[TEAM_ID]} vs <span class="opp-link" data-team="${oppId}">${opp.team.name}</span>
        <span style="float:right">${status} — ${localTime}</span>`;
      document.getElementById('liveInfo').innerHTML = '';
      renderPreview(gameData, isHome);
      document.getElementById('atbat').innerHTML = '';
    } else {
      const ls = liveData.linescore;
      const inningLabel = state === 'Final' ? 'Final'
        : `${ls.inningState || ''} ${ls.currentInningOrdinal || ''}`.trim();
      const oppId = opp.team.id;
      document.getElementById('scoreText').innerHTML = `
        ${TEAMS[TEAM_ID]} ${my.teamStats.batting.runs} – <span class="opp-link" data-team="${oppId}">${opp.team.name}</span> ${opp.teamStats.batting.runs}`;

      latestGameState = { my, opp, liveData, isHome, state };

      // Auto-switch tab based on batting/pitching (#9) — only on first load
      if (state !== 'Final' && !userPickedTab) {
        const currentPlay = liveData.plays?.currentPlay;
        if (currentPlay && !currentPlay.about.isComplete) {
          const myBatting = isHome ? currentPlay.about.halfInning === 'bottom' : currentPlay.about.halfInning === 'top';
          currentTab = myBatting ? 'scorecard' : 'box';
          userPickedTab = true;
        }
      }

      renderLiveInfo(liveData, isHome, state, inningLabel);

      if (document.getElementById('zoneModal').style.display === 'flex') {
        renderAtBat(liveData, isHome);
      }

      const contentEl = document.getElementById('content');
      const scrollY = contentEl.scrollTop;
      const scEl = contentEl.querySelector('.scorecard');
      const scScrollX = scEl ? scEl.scrollLeft : 0;

      if (currentTab === 'box') renderBattingTable(my, liveData, isHome);
      else if (currentTab === 'scorecard') renderScorecard(liveData, isHome);

      contentEl.scrollTop = scrollY;
      const newSc = contentEl.querySelector('.scorecard');
      if (newSc) newSc.scrollLeft = scScrollX;

      document.getElementById('atbat').innerHTML = '';
    }

    updateActiveTab();
    renderLeagueScores();
    renderDivisionStandings();
  } catch (err) {
    console.error('Update failed:', err);
    document.getElementById('scoreText').textContent = 'Error loading game data';
  }
}

async function renderLeagueScores() {
  try {
    const d = new Date();
    const today = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
    const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=linescore`);
    const data = await res.json();
    const games = data.dates?.[0]?.games || [];

    const el = document.getElementById('leagueScores');
    if (games.length === 0) { el.innerHTML = ''; return; }

    let html = '';
    games.forEach(g => {
      if (g.gamePk === gamePk) return; // skip current game
      const away = g.teams.away;
      const home = g.teams.home;
      const awayId = away.team.id;
      const homeId = home.team.id;
      const awayAbv = TEAMS[awayId] || away.team.name;
      const homeAbv = TEAMS[homeId] || home.team.name;
      const state = g.status.abstractGameState;

      let status, awayScore, homeScore;
      if (state === 'Preview') {
        const time = g.gameDate ? new Date(g.gameDate).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '';
        status = g.status.detailedState === 'Postponed' ? 'PPD' : time;
        awayScore = '';
        homeScore = '';
      } else if (state === 'Final') {
        status = 'F';
        awayScore = away.score ?? '';
        homeScore = home.score ?? '';
      } else {
        const ls = g.linescore;
        const inn = ls ? `${(ls.inningHalf || '').charAt(0)}${ls.currentInning || ''}` : '';
        status = inn || 'Live';
        awayScore = away.score ?? '';
        homeScore = home.score ?? '';
      }

      const isLive = state === 'Live';
      html += `<div class="ls-game${isLive ? ' ls-live' : ''}" data-team-away="${awayId}" data-team-home="${homeId}">
        <div class="ls-teams">
          <span class="ls-team"><img src="${LOGO_URL(awayId)}" class="ls-logo" alt="">${awayAbv}</span>
          <span class="ls-team"><img src="${LOGO_URL(homeId)}" class="ls-logo" alt="">${homeAbv}</span>
        </div>
        <div class="ls-scores">
          <span class="ls-score">${awayScore}</span>
          <span class="ls-score">${homeScore}</span>
        </div>
        <div class="ls-status">${status}</div>
      </div>`;
    });

    el.innerHTML = html;

    el.querySelectorAll('.ls-game').forEach(card => {
      card.onclick = e => {
        const clickedTeam = e.target.closest('.ls-team');
        let id;
        if (clickedTeam) {
          const parent = clickedTeam.closest('.ls-game');
          const teams = parent.querySelectorAll('.ls-team');
          const idx = Array.from(teams).indexOf(clickedTeam);
          id = parseInt(idx === 0 ? parent.dataset.teamAway : parent.dataset.teamHome);
        } else {
          id = parseInt(card.dataset.teamHome);
        }
        if (!id || !TEAMS[id]) return;
        TEAM_ID = id;
        localStorage.setItem('teamId', TEAM_ID);
        setTeamBtn(TEAM_ID);
        applyTeamColors(TEAM_ID);
        gamePk = null;
        userPickedTab = false;
        update();
      };
    });
  } catch (err) {
    console.error('League scores failed:', err);
  }
}

update();
setInterval(update, 12000);