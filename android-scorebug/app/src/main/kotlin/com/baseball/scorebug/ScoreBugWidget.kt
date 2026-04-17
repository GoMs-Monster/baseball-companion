package com.baseball.scorebug

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontFamily
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.appwidget.cornerRadius
import androidx.glance.color.ColorProviders
import android.graphics.Color as AndroidColor
import androidx.glance.appwidget.appWidgetBackground

class ScoreBugWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val repo = GameStateRepository(context)
        // Resolve appWidgetId from GlanceId
        val appWidgetId = try {
            val field = id.javaClass.getDeclaredField("appWidgetId")
            field.isAccessible = true
            field.getInt(id)
        } catch (_: Exception) { 0 }

        val state = repo.getCachedGameState(appWidgetId) ?: GameState.empty()

        provideContent {
            GlanceTheme {
                ScoreBugContent(state, context)
            }
        }
    }
}

@Composable
private fun ScoreBugContent(state: GameState, context: Context) {
    val deepLink = "https://goms-monster.github.io/baseball-companion/mariners-companion/" +
        if (state.awayTeamId > 0) "?team=${state.awayTeamId}" else ""

    val bgColor = ColorProvider(AndroidColor.parseColor("#111111"))
    val barColor = ColorProvider(AndroidColor.parseColor("#0a0a0a"))
    val textPrimary = ColorProvider(AndroidColor.parseColor("#eeeeee"))
    val textDim = ColorProvider(AndroidColor.parseColor("#888888"))
    val textMuted = ColorProvider(AndroidColor.parseColor("#555555"))
    val dotOff = ColorProvider(AndroidColor.parseColor("#2a2a2a"))
    val dotOn = ColorProvider(AndroidColor.parseColor("#f5c542"))

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(bgColor)
            .cornerRadius(16.dp)
            .clickable(actionStartActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse(deepLink))
            ))
    ) {
        // Header player bar
        if (state.status == "In Progress" || state.status == "Pre-Game") {
            PlayerBar(state, isHeader = true, barColor, textPrimary, textDim, textMuted)
        }

        // Score section
        Column(
            modifier = GlanceModifier.fillMaxWidth().defaultWeight().padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Away team row
            TeamRow(
                teamAbbr = state.awayTeam,
                score = if (state.status == "Pre-Game") state.awayRecord
                        else state.awayScore.toString(),
                isScoreText = state.status == "Pre-Game",
                textPrimary = textPrimary,
                textDim = textDim
            )

            Spacer(modifier = GlanceModifier.height(2.dp))

            // Home team row
            TeamRow(
                teamAbbr = state.homeTeam,
                score = if (state.status == "Pre-Game") state.homeRecord
                        else state.homeScore.toString(),
                isScoreText = state.status == "Pre-Game",
                textPrimary = textPrimary,
                textDim = textDim
            )
        }

        // Footer player bar
        if (state.status == "In Progress" || state.status == "Pre-Game") {
            PlayerBar(state, isHeader = false, barColor, textPrimary, textDim, textMuted)
        }
    }
}

@Composable
private fun PlayerBar(
    state: GameState,
    isHeader: Boolean,
    barColor: ColorProvider,
    textPrimary: ColorProvider,
    textDim: ColorProvider,
    textMuted: ColorProvider
) {
    val isTopInning = state.inningHalf == "Top"

    // Header = away info when top (batter) or pitcher when bottom
    // Footer = home info when bottom (batter) or pitcher when top
    val label: String
    val name: String
    val stat: String

    if (state.status == "Pre-Game") {
        label = "SP"
        name = if (isHeader) state.batterName else state.pitcherName  // away SP / home SP
        stat = ""
    } else if (isHeader) {
        // Header is always the away-side player
        if (isTopInning) {
            label = "AB"
            name = state.batterName
            stat = state.batterStats
        } else {
            label = "P"
            name = state.pitcherName
            stat = if (state.pitcherPitchCount > 0) "p. ${state.pitcherPitchCount}" else ""
        }
    } else {
        // Footer is always the home-side player
        if (isTopInning) {
            label = "P"
            name = state.pitcherName
            stat = if (state.pitcherPitchCount > 0) "p. ${state.pitcherPitchCount}" else ""
        } else {
            label = "AB"
            name = state.batterName
            stat = state.batterStats
        }
    }

    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(barColor)
            .padding(horizontal = 12.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = TextStyle(
                color = textMuted,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold
            )
        )
        Spacer(modifier = GlanceModifier.width(6.dp))
        Text(
            text = name,
            style = TextStyle(
                color = textDim,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            ),
            modifier = GlanceModifier.defaultWeight()
        )
        if (stat.isNotBlank()) {
            Text(
                text = stat,
                style = TextStyle(
                    color = textMuted,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium
                )
            )
        }
    }
}

@Composable
private fun TeamRow(
    teamAbbr: String,
    score: String,
    isScoreText: Boolean,
    textPrimary: ColorProvider,
    textDim: ColorProvider
) {
    Row(
        modifier = GlanceModifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = teamAbbr,
            style = TextStyle(
                color = textPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            ),
            modifier = GlanceModifier.width(48.dp)
        )
        Text(
            text = score,
            style = TextStyle(
                color = if (isScoreText) textDim else textPrimary,
                fontSize = if (isScoreText) 13.sp else 22.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
        )
    }
}

class ScoreBugWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ScoreBugWidget()
}
