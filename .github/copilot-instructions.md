# Copilot Instructions

## Project Overview

MLB Companion is a **zero-build vanilla JavaScript web app** that displays live MLB game data—scorecard, box score, strike zone, plays timeline, standings, and challenge tracking. It's hosted on GitHub Pages at `baseball-companion.com` and can also run as a Chrome `--app` window via `launch.bat`.

There is no build step, no bundler, no package.json for the web app. The app is a single `index.html` that loads `app.js` and `styles.css` directly.

## Architecture

### Web App (root)

All UI logic lives in a single `app.js` file (~1500 lines). Key structure:

- **Data source**: MLB Stats API (`statsapi.mlb.com`), free, no auth required. The main endpoint is `/api/v1.1/game/{gamePk}/feed/live` for full game data.
- **`update()` function**: Core loop that fetches live game data and renders the current tab. Called on load and every 20 seconds during live games via `setInterval`.
- **`TEAMS` / `TEAM_COLORS` constants**: Maps of MLB team IDs → abbreviations and color pairs `[primary, accent]`. These are duplicated in `scripts/scrape-challenges.js`—keep them in sync.
- **Team selection**: Stored in `localStorage` as `teamId`. Default is `136` (SEA).
- **Tab system**: Two main views—`scorecard` (play-by-play grid) and `box` (batting/pitching tables). Auto-switches based on whether the user's team is batting or pitching.
- **Modals**: Strike zone, plays timeline, team stats, standings, and player detail are rendered into modal overlays.
- **Scoring notation**: `scoringNotation(play)` derives traditional baseball notation (6-4-3, F8, etc.) from MLB API play credit data, not from description strings.
- **wOBA calculation**: `calcWoba()` computes weighted on-base average from season stats using standard linear weights.

### Challenge Scraper (`scripts/scrape-challenges.js`)

A Node.js script (requires Node 20+) that scrapes all completed MLB games for ABS and manager challenge data. Runs nightly via GitHub Actions (`.github/workflows/scrape-challenges.yml`). It's **incremental**—skips previously scraped games and appends new data to `challenges.json`.

### Android Widget (`android-scorebug/`)

A planned/in-progress Kotlin Android app using Jetpack Glance for a home screen scorebug widget. See `ANDROID_WIDGET_PLAN.md` for the full design. Uses the same MLB Stats API as the web app.

## Key Conventions

- **No frameworks or dependencies** for the web app. Everything is vanilla JS with direct DOM manipulation. Keep it that way.
- **CSS uses custom properties** `--primary` and `--accent` for team theming, set dynamically by `applyTeamColors()`.
- **All CSS in one file** (`styles.css`), all JS in one file (`app.js`). No modules, no imports.
- **MLB team IDs are numeric** (e.g., 136 = SEA, 147 = NYY). These are MLB's official IDs and appear throughout the codebase.
- **Scroll preservation**: The `update()` loop saves and restores scroll positions across re-renders. Any rendering changes must not break this pattern.
- **`liveData._gameData`**: The game data object is attached to `liveData` as a private property for convenience—this is intentional, not a bug.

## GitHub Actions

The only workflow is `scrape-challenges.yml`:
- Triggers daily at 10 AM UTC and on manual dispatch
- Runs `node scripts/scrape-challenges.js`
- Auto-commits updated `challenges.json` if changed
