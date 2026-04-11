# MLB Companion — Features

## Team Selection & Theming
- **Team Picker** — Switch between all 30 MLB teams from the header dropdown
- **Dynamic Team Colors** — Primary and accent colors update across the entire UI to match the selected team
- **Persistent Selection** — Chosen team is saved to localStorage and remembered across sessions

## Live Game Banner
- **Live Score Display** — Real-time score with team abbreviations; click the opponent name to switch to their view
- **At-Bat Info** — Current batter/pitcher name, ball-strike count, outs indicator, and inning display
- **Challenge Counters** — Remaining manager challenges (CH) and ABS challenges shown in the live info bar

## Scorecard Tab
- **Full Lineup Scorecard** — Traditional baseball scorecard grid showing every at-bat result per inning
- **Scoring Notation** — Proper baseball notation (1B, F8, 6-4-3, etc.) with fielder position numbers derived from play credits
- **Base Diamonds** — Visual diamond indicators showing the furthest base each runner reached
- **Pitch Count Per At-Bat** — Ball-strike count displayed in each cell
- **Color-Coded Results** — Hits (green), on-base (blue), outs (red)
- **Substitution Tracking** — Pinch hitters and defensive replacements shown as sub-rows with dashed borders
- **Runs Summary Row** — Runs per inning totals at the bottom

## Box Score Tab
- **Batting Table** — Game stats (AB, R, H, RBI, BB, K) alongside season stats (AVG, OBP, SLG, OPS, wOBA)
- **Sortable Columns** — Click any column header to sort ascending/descending
- **Calculated wOBA** — Weighted on-base average computed from season stats using standard linear weights
- **Team Totals Row** — Aggregated game batting totals
- **Pitching Table** — Game pitching stats (IP, H, R, ER, BB, K, HR, PC) with season ERA, WHIP, and K/9
- **First-Pitch Strike %** — Calculated per pitcher from actual pitch-by-pitch data
- **High Pitch Count Highlight** — Pitch counts above a threshold shown in red

## Strike Zone Modal
- **Visual Strike Zone** — SVG plot of all pitches in the current at-bat mapped to zone coordinates
- **Color-Coded Pitches** — Balls (blue), strikes (red), fouls (grey), in-play (green) with numbered markers
- **Pitch List** — Detailed list of each pitch with type, speed, and result description
- **Batter/Pitcher Info** — Current matchup header with bat side indicator and batter silhouette

## Plays Modal
- **Play-by-Play Timeline** — Complete game timeline grouped by inning, newest inning first
- **Filter Tabs** — Toggle between "All Plays" and "Scoring" plays
- **Team-Colored Plays** — Your team's plays use primary/accent styling; opponent plays are muted grey
- **Manager Challenge Highlights** — Plays with manager reviews (tag plays, plays at bases) shown with amber/gold styling and a "Challenge · Overturned/Confirmed" badge
- **ABS Challenge Highlights** — Pitch-result challenges (by batters or catchers) shown with purple styling and an "ABS · Overturned/Confirmed" badge, including the challenger's name and pitch number
- **RBI Callouts** — RBI details shown on plays that drive in runs

## Team Stats Modal
- **Extra-Base Hit Breakdown** — Lists players with 2B, 3B, HR with season totals
- **RISP Performance** — Hits-for-at-bats with runners in scoring position
- **Situational Stats** — LOB, SF, SAC, GIDP, HBP with player names
- **Baserunning Stats** — Stolen bases, caught stealing, pickoffs with player names and season totals

## Pre-Game Preview
- **Matchup Header** — Team names with win-loss records
- **Probable Pitchers** — Starting pitchers for both teams
- **Venue Info** — Ballpark name

## League Scores Footer
- **Scrollable Scoreboard** — All MLB games for the day in a horizontal ticker
- **Team Logos & Scores** — Away/home logos with current scores
- **Live Game Indicator** — Green border for games currently in progress
- **Quick Switch** — Click any game card to switch to that team's view

## Division Standings Bar
- **Division Logos** — All teams in the selected team's division shown with logos
- **Win-Loss Records** — Current records displayed under each team
- **Highlight Selected Team** — Active team's logo is enlarged with a glow effect

## General
- **Auto-Refresh** — Game data polls every 20 seconds during live games
- **Scroll Preservation** — Horizontal and vertical scroll positions maintained across refreshes
- **Responsive Design** — Mobile-friendly layout with adjusted sizing for small screens
- **Electron/Web Ready** — Runs as a standalone app via `launch.bat` or in any browser

---

## Future / Wishlist
1. ~~**Challenges Tab in Plays Popup**~~ ✅ — Dedicated filter tab in the Plays modal to show only challenge plays (both manager and ABS)
2. ~~**Fix Side Scrolling on Mobile**~~ ✅ — Preserve horizontal scroll position on the scorecard across refreshes
3. ~~**Strikeout & Walk Season Stats**~~ ✅ — Add K and BB season totals to the batting and pitching tables
4. **Season Challenge Stats** — Show challenge usage stats for the season at both team and player level
5. **Android Scorebug Widget** — Standalone Android home screen widget displaying the live score bug
6. ~~**Pitcher Order in Box Score**~~ ✅ — Sort pitchers in the pitching table by order of appearance
7. ~~**Highlight Current Battery/Pitcher**~~ ✅ — Visually highlight the active batter or pitcher row in the box score and scorecard
8. ~~**Live Count on Scorecard**~~ ✅ — Show the current ball-strike count for the active at-bat in the scorecard cell
9. ~~**Auto Tab Switching**~~ ✅ — Default to the Card tab when the selected team is batting; switch to Box when they are pitching
10. ~~**Location-Based Game Times**~~ ✅ — Convert game times to the user's local timezone
11. ~~**Full League Standings Popup**~~ ✅ — Expand the division standings bar into a full-league standings modal when tapped
