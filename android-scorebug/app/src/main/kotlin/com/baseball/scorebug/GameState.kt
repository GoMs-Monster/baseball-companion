package com.baseball.scorebug

data class GameState(
    val status: String,          // "Pre-Game", "In Progress", "Final", "No Game"
    val awayTeam: String,        // "SEA"
    val homeTeam: String,        // "HOU"
    val awayScore: Int,
    val homeScore: Int,
    val inning: Int,
    val inningHalf: String,      // "Top" / "Bottom" / ""
    val outs: Int,
    val onFirst: Boolean,
    val onSecond: Boolean,
    val onThird: Boolean,
    val balls: Int,
    val strikes: Int,
    val batterName: String,
    val pitcherName: String,
    val batterStats: String,     // e.g. "1-3"
    val pitcherPitchCount: Int,
    val awayChallenges: Int,     // 0-2 remaining
    val homeChallenges: Int,
    val startTime: String,       // For pre-game: "7:10 PM"
    val awayRecord: String,      // For pre-game: "38-22"
    val homeRecord: String,
    val awayTeamId: Int,
    val homeTeamId: Int,
    val gamePk: Int,
    val finalExtra: String       // "FINAL" or "FINAL/10"
) {
    companion object {
        fun empty() = GameState(
            status = "No Game",
            awayTeam = "", homeTeam = "",
            awayScore = 0, homeScore = 0,
            inning = 0, inningHalf = "",
            outs = 0,
            onFirst = false, onSecond = false, onThird = false,
            balls = 0, strikes = 0,
            batterName = "", pitcherName = "",
            batterStats = "", pitcherPitchCount = 0,
            awayChallenges = 2, homeChallenges = 2,
            startTime = "", awayRecord = "", homeRecord = "",
            awayTeamId = 0, homeTeamId = 0,
            gamePk = 0, finalExtra = "FINAL"
        )
    }
}
