package com.baseball.scorebug

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class GameStateRepository(private val context: Context) {

    private val api: MlbApi = Retrofit.Builder()
        .baseUrl("https://statsapi.mlb.com/")
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(MlbApi::class.java)

    private val prefs: SharedPreferences =
        context.getSharedPreferences("scorebug", Context.MODE_PRIVATE)

    private val gson = Gson()

    // Store team selection per widget
    fun setTeamId(appWidgetId: Int, teamId: Int) {
        prefs.edit().putInt("team_$appWidgetId", teamId).apply()
    }

    fun getTeamId(appWidgetId: Int): Int {
        return prefs.getInt("team_$appWidgetId", 136) // default: SEA
    }

    fun removeWidget(appWidgetId: Int) {
        prefs.edit().remove("team_$appWidgetId").remove("game_$appWidgetId").apply()
    }

    // Cache game state per widget
    fun getCachedGameState(appWidgetId: Int): GameState? {
        val json = prefs.getString("game_$appWidgetId", null) ?: return null
        return try { gson.fromJson(json, GameState::class.java) } catch (_: Exception) { null }
    }

    private fun cacheGameState(appWidgetId: Int, state: GameState) {
        prefs.edit().putString("game_$appWidgetId", gson.toJson(state)).apply()
    }

    suspend fun fetchGameState(appWidgetId: Int): GameState {
        val teamId = getTeamId(appWidgetId)
        return try {
            val state = fetchForTeam(teamId)
            cacheGameState(appWidgetId, state)
            state
        } catch (e: Exception) {
            getCachedGameState(appWidgetId) ?: GameState.empty()
        }
    }

    private suspend fun fetchForTeam(teamId: Int): GameState {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
            timeZone = TimeZone.getDefault()
        }.format(Date())

        val schedule = api.getSchedule(teamId = teamId, date = today)
        val games = schedule.dates?.firstOrNull()?.games

        if (games.isNullOrEmpty()) {
            val team = MlbTeam.byId(teamId)
            return GameState.empty().copy(
                status = "No Game",
                awayTeam = team?.abbreviation ?: "",
                homeTeam = "",
                awayTeamId = teamId
            )
        }

        // Pick best game: live > pre-game > final
        val game = games.find { it.status.abstractGameState == "Live" }
            ?: games.find { it.status.abstractGameState == "Preview" }
            ?: games.last()

        return when (game.status.abstractGameState) {
            "Live" -> fetchLiveGame(game)
            "Final" -> buildFinalState(game)
            else -> buildPreGameState(game)
        }
    }

    private suspend fun fetchLiveGame(game: ScheduleGame): GameState {
        val feed = api.getLiveFeed(game.gamePk)
        val ls = feed.liveData?.linescore
        val play = feed.liveData?.plays?.currentPlay
        val gd = feed.gameData

        val awayAbbr = gd?.teams?.away?.abbreviation
            ?: game.teams.away.team.abbreviation ?: "???"
        val homeAbbr = gd?.teams?.home?.abbreviation
            ?: game.teams.home.team.abbreviation ?: "???"

        val batter = play?.matchup?.batter
        val pitcher = play?.matchup?.pitcher

        return GameState(
            status = "In Progress",
            awayTeam = awayAbbr,
            homeTeam = homeAbbr,
            awayScore = ls?.teams?.away?.runs ?: game.teams.away.score ?: 0,
            homeScore = ls?.teams?.home?.runs ?: game.teams.home.score ?: 0,
            inning = ls?.currentInning ?: 1,
            inningHalf = ls?.inningHalf ?: "Top",
            outs = play?.count?.outs ?: ls?.outs ?: 0,
            onFirst = ls?.offense?.first != null,
            onSecond = ls?.offense?.second != null,
            onThird = ls?.offense?.third != null,
            balls = play?.count?.balls ?: ls?.balls ?: 0,
            strikes = play?.count?.strikes ?: ls?.strikes ?: 0,
            batterName = formatPlayerName(batter?.fullName ?: ""),
            pitcherName = formatPlayerName(pitcher?.fullName ?: ""),
            batterStats = "", // Could be enriched with boxscore data
            pitcherPitchCount = 0, // Could be enriched with boxscore data
            awayChallenges = 2,
            homeChallenges = 2,
            startTime = "",
            awayRecord = "",
            homeRecord = "",
            awayTeamId = game.teams.away.team.id,
            homeTeamId = game.teams.home.team.id,
            gamePk = game.gamePk,
            finalExtra = ""
        )
    }

    private fun buildFinalState(game: ScheduleGame): GameState {
        val awayAbbr = game.teams.away.team.abbreviation ?: "???"
        val homeAbbr = game.teams.home.team.abbreviation ?: "???"
        val inning = game.linescore?.currentInning ?: 9
        val finalLabel = if (inning > 9) "FINAL/$inning" else "FINAL"

        return GameState(
            status = "Final",
            awayTeam = awayAbbr,
            homeTeam = homeAbbr,
            awayScore = game.teams.away.score ?: 0,
            homeScore = game.teams.home.score ?: 0,
            inning = inning,
            inningHalf = "",
            outs = 0,
            onFirst = false, onSecond = false, onThird = false,
            balls = 0, strikes = 0,
            batterName = "", pitcherName = "",
            batterStats = "", pitcherPitchCount = 0,
            awayChallenges = 0, homeChallenges = 0,
            startTime = "",
            awayRecord = "",
            homeRecord = "",
            awayTeamId = game.teams.away.team.id,
            homeTeamId = game.teams.home.team.id,
            gamePk = game.gamePk,
            finalExtra = finalLabel
        )
    }

    private fun buildPreGameState(game: ScheduleGame): GameState {
        val awayAbbr = game.teams.away.team.abbreviation ?: "???"
        val homeAbbr = game.teams.home.team.abbreviation ?: "???"

        val awayRec = game.teams.away.leagueRecord?.let { "${it.wins}-${it.losses}" } ?: ""
        val homeRec = game.teams.home.leagueRecord?.let { "${it.wins}-${it.losses}" } ?: ""

        val timeFormat = SimpleDateFormat("h:mm a", Locale.US).apply {
            timeZone = TimeZone.getDefault()
        }
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val startTime = try {
            timeFormat.format(isoFormat.parse(game.gameDate)!!)
        } catch (_: Exception) { "" }

        val awaySP = game.teams.away.probablePitcher?.fullName ?: "TBD"
        val homeSP = game.teams.home.probablePitcher?.fullName ?: "TBD"

        return GameState(
            status = "Pre-Game",
            awayTeam = awayAbbr,
            homeTeam = homeAbbr,
            awayScore = 0, homeScore = 0,
            inning = 0, inningHalf = "",
            outs = 0,
            onFirst = false, onSecond = false, onThird = false,
            balls = 0, strikes = 0,
            batterName = formatPlayerName(awaySP),
            pitcherName = formatPlayerName(homeSP),
            batterStats = "", pitcherPitchCount = 0,
            awayChallenges = 2, homeChallenges = 2,
            startTime = startTime,
            awayRecord = awayRec,
            homeRecord = homeRec,
            awayTeamId = game.teams.away.team.id,
            homeTeamId = game.teams.home.team.id,
            gamePk = game.gamePk,
            finalExtra = ""
        )
    }

    private fun formatPlayerName(fullName: String): String {
        if (fullName.isBlank() || fullName == "TBD") return fullName
        val parts = fullName.split(" ")
        return if (parts.size >= 2) {
            "${parts[0].first()}. ${parts.drop(1).joinToString(" ")}"
        } else fullName
    }
}
