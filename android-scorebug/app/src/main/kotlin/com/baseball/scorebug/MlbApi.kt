package com.baseball.scorebug

import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface MlbApi {

    @GET("api/v1/schedule")
    suspend fun getSchedule(
        @Query("sportId") sportId: Int = 1,
        @Query("teamId") teamId: Int,
        @Query("date") date: String,
        @Query("hydrate") hydrate: String = "linescore,probablePitcher"
    ): ScheduleResponse

    @GET("api/v1.1/game/{gamePk}/feed/live")
    suspend fun getLiveFeed(
        @Path("gamePk") gamePk: Int
    ): LiveFeedResponse
}

// --- Schedule endpoint models ---

data class ScheduleResponse(
    val dates: List<ScheduleDate>?
)

data class ScheduleDate(
    val games: List<ScheduleGame>?
)

data class ScheduleGame(
    val gamePk: Int,
    val gameDate: String,
    val status: GameStatus,
    val teams: GameTeams,
    val linescore: Linescore?
)

data class GameStatus(
    val abstractGameState: String,   // "Preview", "Live", "Final"
    val detailedState: String        // "Pre-Game", "In Progress", "Final", "Postponed", etc.
)

data class GameTeams(
    val away: GameTeamInfo,
    val home: GameTeamInfo
)

data class GameTeamInfo(
    val team: TeamRef,
    val score: Int?,
    val leagueRecord: LeagueRecord?,
    val probablePitcher: ProbablePitcher?
)

data class TeamRef(
    val id: Int,
    val name: String,
    val abbreviation: String?
)

data class LeagueRecord(
    val wins: Int,
    val losses: Int
)

data class ProbablePitcher(
    val id: Int,
    val fullName: String
)

data class Linescore(
    val currentInning: Int?,
    val inningHalf: String?,
    val outs: Int?,
    val balls: Int?,
    val strikes: Int?,
    val offense: LinescoreOffense?,
    val defense: LinescoreDefense?
)

data class LinescoreOffense(
    val batter: PlayerRef?,
    val first: PlayerRef?,
    val second: PlayerRef?,
    val third: PlayerRef?
)

data class LinescoreDefense(
    val pitcher: PlayerRef?
)

data class PlayerRef(
    val id: Int?,
    val fullName: String?
)

// --- Live feed endpoint models ---

data class LiveFeedResponse(
    val gameData: LiveGameData?,
    val liveData: LiveData?
)

data class LiveGameData(
    val status: GameStatus?,
    val teams: LiveTeams?,
    val probablePitchers: ProbablePitchers?
)

data class LiveTeams(
    val away: LiveTeamInfo?,
    val home: LiveTeamInfo?
)

data class LiveTeamInfo(
    val id: Int?,
    val abbreviation: String?,
    val record: LiveRecord?
)

data class LiveRecord(
    val wins: Int?,
    val losses: Int?
)

data class ProbablePitchers(
    val away: PlayerRef?,
    val home: PlayerRef?
)

data class LiveData(
    val linescore: LiveLinescore?,
    val plays: Plays?
)

data class LiveLinescore(
    val currentInning: Int?,
    val inningHalf: String?,
    val outs: Int?,
    val balls: Int?,
    val strikes: Int?,
    val offense: LinescoreOffense?,
    val defense: LinescoreDefense?,
    val teams: LinescoreTeams?
)

data class LinescoreTeams(
    val away: LinescoreTeamScore?,
    val home: LinescoreTeamScore?
)

data class LinescoreTeamScore(
    val runs: Int?
)

data class Plays(
    val currentPlay: CurrentPlay?
)

data class CurrentPlay(
    val matchup: Matchup?,
    val count: Count?
)

data class Matchup(
    val batter: PlayerRef?,
    val pitcher: PlayerRef?,
    val batSide: SideInfo?,
    val pitchHand: SideInfo?
)

data class SideInfo(
    val code: String?
)

data class Count(
    val balls: Int?,
    val strikes: Int?,
    val outs: Int?
)
