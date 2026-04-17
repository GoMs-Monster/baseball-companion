package com.baseball.scorebug

data class MlbTeam(
    val id: Int,
    val abbreviation: String,
    val name: String,
    val division: String
) {
    companion object {
        val ALL = listOf(
            // AL East
            MlbTeam(110, "BAL", "Baltimore Orioles", "AL East"),
            MlbTeam(111, "BOS", "Boston Red Sox", "AL East"),
            MlbTeam(147, "NYY", "New York Yankees", "AL East"),
            MlbTeam(139, "TB", "Tampa Bay Rays", "AL East"),
            MlbTeam(141, "TOR", "Toronto Blue Jays", "AL East"),
            // AL Central
            MlbTeam(145, "CWS", "Chicago White Sox", "AL Central"),
            MlbTeam(114, "CLE", "Cleveland Guardians", "AL Central"),
            MlbTeam(116, "DET", "Detroit Tigers", "AL Central"),
            MlbTeam(118, "KC", "Kansas City Royals", "AL Central"),
            MlbTeam(142, "MIN", "Minnesota Twins", "AL Central"),
            // AL West
            MlbTeam(117, "HOU", "Houston Astros", "AL West"),
            MlbTeam(108, "LAA", "Los Angeles Angels", "AL West"),
            MlbTeam(133, "OAK", "Oakland Athletics", "AL West"),
            MlbTeam(136, "SEA", "Seattle Mariners", "AL West"),
            MlbTeam(140, "TEX", "Texas Rangers", "AL West"),
            // NL East
            MlbTeam(144, "ATL", "Atlanta Braves", "NL East"),
            MlbTeam(158, "MIA", "Miami Marlins", "NL East"),
            MlbTeam(121, "NYM", "New York Mets", "NL East"),
            MlbTeam(143, "PHI", "Philadelphia Phillies", "NL East"),
            MlbTeam(120, "WSH", "Washington Nationals", "NL East"),
            // NL Central
            MlbTeam(112, "CHC", "Chicago Cubs", "NL Central"),
            MlbTeam(113, "CIN", "Cincinnati Reds", "NL Central"),
            MlbTeam(160, "MIL", "Milwaukee Brewers", "NL Central"),
            MlbTeam(134, "PIT", "Pittsburgh Pirates", "NL Central"),
            MlbTeam(138, "STL", "St. Louis Cardinals", "NL Central"),
            // NL West
            MlbTeam(109, "ARI", "Arizona Diamondbacks", "NL West"),
            MlbTeam(115, "COL", "Colorado Rockies", "NL West"),
            MlbTeam(119, "LAD", "Los Angeles Dodgers", "NL West"),
            MlbTeam(135, "SD", "San Diego Padres", "NL West"),
            MlbTeam(137, "SF", "San Francisco Giants", "NL West"),
        )

        fun byId(id: Int): MlbTeam? = ALL.find { it.id == id }
    }
}
