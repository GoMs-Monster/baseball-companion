# Android Scorebug Widget — Development Plan

## Overview

A native Android home screen widget that displays a live TV-style scorebug for the user's selected MLB team. Tapping the widget opens the Baseball Companion web app in the browser. The app is built with Kotlin using Jetpack Glance for the widget UI, and fetches data directly from the free MLB Stats API.

---

## 1. Scorebug Layout

The widget mimics a traditional TV broadcast scorebug. Two layout variants based on widget size:

### Compact (4×1 cells, ~280dp × 70dp)
```
┌──────────────────────────────────┐
│ SEA  3 │ ▲7 │ ●○○ │ ◇◆◇ │ 1-2 │
│ HOU  1 │    │     │     │     │
└──────────────────────────────────┘
```
- Team abbreviations + scores (left)
- Inning + half indicator (▲/▼)
- Outs (filled/empty dots)
- Base runners (diamond)
- Ball-strike count

### Expanded (4×2 cells, ~280dp × 140dp)
```
┌──────────────────────────────────────┐
│  [SEA logo]  SEA   3    ▲ 7th       │
│  [HOU logo]  HOU   1    ●●○  ◇◆◇   │
│──────────────────────────────────────│
│  AB: J. Rodriguez  vs  F. Valdez    │
│  Count: 1-2       Next: 7:10 PM    │
└──────────────────────────────────────┘
```
- Team logos + abbreviations + scores
- Inning, outs, base runners
- Current batter vs pitcher
- Ball-strike count
- Next game time (when no live game)

### Non-Game States
- **Pre-game:** Show matchup, probable pitchers, and first pitch time (local timezone)
- **Final:** Show final score with "FINAL" or "FINAL/10" label
- **Off day:** Show "No game today" with next game date/time

---

## 2. Widget Size Options

| Size Name | Grid Cells | Min Dimensions | Use Case |
|-----------|-----------|---------------|----------|
| Compact   | 4×1       | 250dp × 40dp  | Minimal scorebug strip |
| Standard  | 4×2       | 250dp × 110dp | Full scorebug with matchup info |

Both sizes are resizable. The widget provider XML defines:
- `minWidth="250dp"` / `minHeight="40dp"` (compact)
- `resizeMode="horizontal|vertical"`
- `maxWidth="350dp"` / `maxHeight="180dp"`

The widget detects its current size and renders the appropriate layout variant.

---

## 3. Data Source & API

All data comes from the **MLB Stats API** (free, no auth required):

| Endpoint | Purpose |
|----------|---------|
| `/api/v1/schedule?sportId=1&teamId={id}&date={date}` | Find today's game (gamePk) |
| `/api/v1/game/{gamePk}/linescore` | Live score, inning, outs, runners |
| `/api/v1/game/{gamePk}/feed/live` | Full live feed (batter, pitcher, count) |
| `/api/v1/schedule?sportId=1&date={date}&hydrate=linescore` | All games with scores (for multi-game view) |

### Data Model (what the widget needs)
```kotlin
data class GameState(
    val status: String,          // "Pre-Game", "In Progress", "Final"
    val awayTeam: String,        // "SEA"
    val homeTeam: String,        // "HOU"
    val awayScore: Int,
    val homeScore: Int,
    val inning: Int,
    val inningHalf: String,      // "Top" / "Bottom"
    val outs: Int,
    val onFirst: Boolean,
    val onSecond: Boolean,
    val onThird: Boolean,
    val balls: Int,
    val strikes: Int,
    val batterName: String,
    val pitcherName: String,
    val startTime: String,       // For pre-game display
    val gamePk: Int              // For deep linking
)
```

---

## 4. Data Refresh Strategy

The refresh rate adapts based on game status to balance battery life and timeliness:

| Game Status | Refresh Method | Interval | Rationale |
|------------|---------------|----------|-----------|
| **Live game** | Foreground service | 20 seconds | Match the web app's refresh rate; real-time feel |
| **Pre-game (within 1 hour)** | WorkManager | 15 minutes | Check for lineup/status changes |
| **Pre-game (>1 hour)** | WorkManager | 30 minutes | Just check for schedule changes |
| **Final** | WorkManager | 60 minutes | Low priority, check for next game |
| **Off day / no game** | WorkManager | 60 minutes | Check if schedule has updated |

### Live Game Foreground Service
- Starts automatically when a game enters "In Progress" status
- Shows a persistent notification: "Live: SEA 3 — HOU 1 (▲7)"
- Notification is tappable (opens web app)
- Stops automatically when game reaches "Final" status
- Uses `setForeground()` to survive Doze mode restrictions

### Battery Considerations
- Foreground service only runs during live games (~3 hours per game day)
- All other states use WorkManager (battery-friendly, system-managed)
- Network requests are lightweight (~2KB JSON for linescore endpoint)

---

## 5. Team Selection

### Configuration Activity
When the user adds the widget to their home screen, Android launches a **configuration activity**:

1. Displays a scrollable grid of all 30 MLB team logos + names
2. Teams grouped by division (AL West, NL East, etc.)
3. User taps their team → saved to SharedPreferences with `appWidgetId` as key
4. Widget immediately fetches data and renders
5. Configuration activity closes, widget appears on home screen

### Changing Teams
- Long-press widget → "Reconfigure" (Android 12+ supports this natively via `widgetFeatures="reconfigurable"`)
- Opens the same team picker activity
- Data refreshes immediately after selection

### Multiple Widgets
- Each widget instance can track a different team
- Team selection is stored per `appWidgetId`
- Useful for following multiple teams

---

## 6. Which Game Is Shown

### Automatic Game Selection Logic
```
1. Fetch today's schedule for the selected team
2. If a game is "In Progress" → show it (highest priority)
3. If a game is "Pre-Game" → show it with start time
4. If a game is "Final" → show final score
5. If multiple games (doubleheader) → show the one that is live,
   or the next upcoming one
6. If no game today → show "No game today" + next game date/time
```

### Edge Cases
- **Doubleheaders:** Show Game 1 if in progress, else Game 2 if in progress, else the next upcoming game
- **Postponed/Suspended:** Show status text ("Postponed — Rain") with reschedule info if available
- **Spring Training vs Regular Season:** Only show regular season and postseason games by default

---

## 7. Tapping the Widget → Opens Web App

### Click Behavior
- **Tap anywhere on the widget** → opens the Baseball Companion web app in the default browser
- URL format: `https://goms-monster.github.io/baseball-companion/mariners-companion/`
- The web app's `localStorage` team selection is independent of the widget's team selection

### Deep Link Strategy
- Append team ID as a URL parameter: `?team={teamId}`
- The web app can read this parameter on load and auto-switch to that team
- This requires a small addition to the web app's `app.js` to check URL params on startup

### Implementation
```kotlin
val intent = Intent(Intent.ACTION_VIEW, Uri.parse(
    "https://goms-monster.github.io/baseball-companion/mariners-companion/?team=$teamId"
))
// In Glance: actionStartActivity(intent)
```

---

## 8. App Architecture

### Project Structure
```
android-scorebug/
├── app/
│   ├── src/main/
│   │   ├── kotlin/com/baseball/scorebug/
│   │   │   ├── ScoreBugWidget.kt          # Glance widget (UI)
│   │   │   ├── ScoreBugWidgetReceiver.kt   # AppWidget receiver
│   │   │   ├── TeamPickerActivity.kt       # Config activity
│   │   │   ├── GameStateRepository.kt      # API data fetching
│   │   │   ├── GameRefreshWorker.kt        # WorkManager periodic job
│   │   │   ├── LiveGameService.kt          # Foreground service
│   │   │   ├── GameState.kt               # Data model
│   │   │   └── MlbApi.kt                  # Retrofit API interface
│   │   ├── res/
│   │   │   ├── xml/scorebug_widget_info.xml
│   │   │   ├── drawable/                   # Team logos (30 PNGs)
│   │   │   └── values/
│   │   │       ├── colors.xml              # Team color definitions
│   │   │       └── strings.xml
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── gradle/
└── build.gradle.kts
```

### Key Dependencies
```kotlin
dependencies {
    implementation("androidx.glance:glance-appwidget:1.1.0")
    implementation("androidx.glance:glance-material3:1.1.0")
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
```

### Minimum SDK & Target
- `minSdk = 26` (Android 8.0 — covers ~95% of devices)
- `targetSdk = 35` (latest)
- `compileSdk = 35`

---

## 9. Theming & Styling

### Team Colors
- Widget background uses the selected team's primary color (same values from `TEAM_COLORS` in app.js)
- Score text and accents use the team's accent color
- All 30 teams' color pairs are defined in `colors.xml`

### Dark/Light Mode
- Widget supports Material You dynamic theming on Android 12+
- Falls back to team colors on older Android versions

### Typography
- Scores: Bold, large monospace font (like a scoreboard)
- Team abbrevs: Bold sans-serif
- Matchup info: Regular weight, smaller size

### Visual Polish
- Rounded corners on widget background (12dp radius)
- Subtle shadow/elevation for depth
- Base runner diamonds rendered as small filled/unfilled shapes
- Out dots as filled/unfilled circles (matching the web app style)

---

## 10. Distribution & Installation

### Option A: GitHub Releases (Recommended for personal use)
1. Build a signed APK in Android Studio
2. Create a GitHub Release on the `baseball-companion` repo
3. Upload the APK as a release asset
4. Users download the APK from GitHub and sideload:
   - Download APK from GitHub Releases page
   - Tap the downloaded file
   - Allow "Install from unknown sources" for the browser (one-time)
   - Tap Install
5. Add widget: long-press home screen → Widgets → "MLB Scorebug"

### Option B: Google Play Store (If wider distribution desired)
- Requires a Google Play Developer account ($25 one-time fee)
- App review process (can be slow)
- Automatic updates for users
- Better for public distribution

### Recommendation
Start with **Option A** (GitHub Releases) for development and personal use. Move to Play Store later if desired.

### Updates
- For GitHub: upload new APK to releases, users re-download
- Could add an in-app update checker that compares version codes against GitHub API

---

## 11. Web App Changes Required

A small addition to the web app to support deep linking from the widget:

### URL Parameter Handling (app.js)
```javascript
// On startup, check for team parameter from widget deep link
const urlParams = new URLSearchParams(window.location.search);
const teamParam = urlParams.get('team');
if (teamParam && TEAMS[parseInt(teamParam)]) {
    TEAM_ID = parseInt(teamParam);
    localStorage.setItem('teamId', TEAM_ID);
}
```

This is the only change needed in the existing web app.

---

## 12. Development Phases

### Phase 1: Core Widget
- [ ] Set up Android Studio project with Kotlin + Glance
- [ ] Create data model and MLB API client (Retrofit)
- [ ] Build `GameStateRepository` to fetch and parse game data
- [ ] Implement compact (4×1) widget layout with Glance
- [ ] Add team picker configuration activity
- [ ] Wire up WorkManager for periodic background refresh
- [ ] Test with mock data and live API

### Phase 2: Live Game Experience
- [ ] Implement foreground service for 20-second live updates
- [ ] Add service auto-start/stop based on game status
- [ ] Build persistent notification with live score
- [ ] Add expanded (4×2) widget layout with batter/pitcher info
- [ ] Handle doubleheaders and edge cases

### Phase 3: Polish & Distribution
- [ ] Add all 30 team logos and color schemes
- [ ] Implement Material You theming
- [ ] Add widget reconfiguration support
- [ ] Add deep link URL parameter handling to web app
- [ ] Build signed APK
- [ ] Create GitHub Release with install instructions
- [ ] Write user-facing README for the Android app

### Phase 4: Future Enhancements (Optional)
- [ ] Multiple-game widget showing all scores (like the web app footer)
- [ ] Tap-to-expand: tap widget to show more detail in an overlay
- [ ] Game start notifications
- [ ] Android Auto / Wear OS support

---

## 13. Testing Strategy

### Unit Tests
- `GameStateRepository` parsing logic with fixture JSON
- Game selection logic (doubleheaders, off days, etc.)
- Refresh interval calculation based on game status

### Integration Tests
- API client against live MLB endpoints
- Widget rendering with various game states

### Manual Testing
- Test on physical device (widget rendering varies by launcher)
- Test all game states: pre-game, live, final, off day, postponed, doubleheader
- Test battery impact during extended live game sessions
- Test across Android versions (8.0, 12, 13, 14)

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| MLB API rate limiting | Cache responses, use lightweight linescore endpoint, respect intervals |
| API structure changes | Defensive parsing with null safety, version-pinned endpoints |
| Battery drain from foreground service | Auto-stop when game ends, use efficient 20s intervals |
| Widget rendering inconsistency across launchers | Test on Pixel, Samsung, and other popular launchers |
| Sideloading friction | Clear install instructions with screenshots in README |

---

## Summary

The Android Scorebug Widget is a focused, single-purpose native app that brings the most essential piece of the Baseball Companion — the live score — directly to the Android home screen. It uses the same MLB API as the web app, refreshes intelligently based on game state, and acts as a one-tap gateway to the full web experience.
