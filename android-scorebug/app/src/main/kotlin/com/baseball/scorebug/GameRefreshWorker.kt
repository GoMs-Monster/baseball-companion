package com.baseball.scorebug

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class GameRefreshWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val repo = GameStateRepository(applicationContext)
        val manager = GlanceAppWidgetManager(applicationContext)
        val glanceIds = manager.getGlanceIds(ScoreBugWidget::class.java)

        for (glanceId in glanceIds) {
            val appWidgetId = try {
                val field = glanceId.javaClass.getDeclaredField("appWidgetId")
                field.isAccessible = true
                field.getInt(glanceId)
            } catch (_: Exception) { continue }

            repo.fetchGameState(appWidgetId)
        }

        // Update all widget instances
        ScoreBugWidget().updateAll(applicationContext)

        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "scorebug_refresh"

        fun schedule(context: Context, intervalMinutes: Long = 15) {
            val request = PeriodicWorkRequestBuilder<GameRefreshWorker>(
                intervalMinutes, TimeUnit.MINUTES
            ).build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
