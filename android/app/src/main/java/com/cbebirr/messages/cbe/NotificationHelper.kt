package com.cbebirr.messages.cbe

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

object NotificationHelper {
    const val ALERT_CHANNEL_ID = "cbe_messages_alert_v3"
    const val SILENT_SYNC_CHANNEL_ID = "cbe_sync_silent_v3"
    const val SYNC_SERVICE_NOTIF_ID = 9001

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

            if (nm.getNotificationChannel(ALERT_CHANNEL_ID) == null) {
                val defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val audioAttrs = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                    .build()

                val alertChannel = NotificationChannel(
                    ALERT_CHANNEL_ID,
                    "Messages & Banking Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Real-time SIM SMS and CBEBirr transaction notifications"
                    enableLights(true)
                    lightColor = Color.BLUE
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0L, 220L, 120L, 220L)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    setShowBadge(true)
                    if (defaultSound != null) {
                        setSound(defaultSound, audioAttrs)
                    }
                }
                nm.createNotificationChannel(alertChannel)
            }

            if (nm.getNotificationChannel(SILENT_SYNC_CHANNEL_ID) == null) {
                val syncChannel = NotificationChannel(
                    SILENT_SYNC_CHANNEL_ID,
                    "Messages Background Sync",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Keeps incoming banking alerts active in the background"
                    enableLights(false)
                    enableVibration(false)
                    setShowBadge(false)
                    setSound(null, null)
                }
                nm.createNotificationChannel(syncChannel)
            }
        }
    }

    fun hasNotificationPermission(context: Context): Boolean {
        val runtimeGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        val osEnabled = try {
            NotificationManagerCompat.from(context).areNotificationsEnabled()
        } catch (_: Throwable) {
            true
        }
        return runtimeGranted && osEnabled
    }

    fun buildSyncServiceNotification(context: Context): Notification {
        ensureChannels(context)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pi = PendingIntent.getActivity(
            context,
            100,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(context, SILENT_SYNC_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("Messages")
            .setContentText("Ready to receive SMS & banking alerts")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pi)
            .build()
    }

    fun showIncomingMessageNotification(
        context: Context,
        sender: String,
        body: String,
        uniqueKey: String = "${sender}_${System.currentTimeMillis()}",
        playSoundAndVibrate: Boolean = true
    ) {
        ensureChannels(context)

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("open_sender", sender)
        }
        val reqCode = (uniqueKey.hashCode() and 0x7fffffff)
        val pendingIntent = PendingIntent.getActivity(
            context,
            reqCode,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = sender.ifBlank { "New Message" }
        val text = body.ifBlank { "New message received" }

        val notification = NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            ) {
                nm?.notify(reqCode, notification)
            }
        } catch (_: Throwable) {
        }

        if (playSoundAndVibrate) {
            val appCtx = context.applicationContext
            Thread {
                triggerSystemVibration(appCtx)
            }.start()
        }
    }

    fun playSystemNotificationSound(context: Context) {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            if (uri != null) {
                val ringtone = RingtoneManager.getRingtone(context, uri)
                ringtone?.play()
            }
        } catch (_: Throwable) {
        }
    }

    fun triggerSystemVibration(context: Context) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                val vib = vm?.defaultVibrator
                vib?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 220, 120, 220), -1))
            } else {
                @Suppress("DEPRECATION")
                val vib = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vib?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 220, 120, 220), -1))
                } else {
                    @Suppress("DEPRECATION")
                    vib?.vibrate(250)
                }
            }
        } catch (_: Throwable) {
        }
    }
}
