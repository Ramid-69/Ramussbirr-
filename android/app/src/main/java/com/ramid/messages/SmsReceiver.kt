package com.ramid.messages

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import org.json.JSONObject

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return

        // 1. Check for CBEBirr internal transfer broadcast
        if (action == "com.cbe.cbebirrtransfer.SMS_WEBHOOK") {
            handleCbeWebhookBroadcast(context, intent)
            return
        }

        // 2. Standard Android SMS delivery (SMS_DELIVER / SMS_RECEIVED)
        if (action == Telephony.Sms.Intents.SMS_DELIVER_ACTION ||
            action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            handleIncomingSimSms(context, intent)
        }
    }

    private fun handleIncomingSimSms(context: Context, intent: Intent) {
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (messages.isEmpty()) return

        val address = messages[0].displayOriginatingAddress ?: "Unknown"
        val bodyBuilder = StringBuilder()
        var timestamp = System.currentTimeMillis()

        for (msg in messages) {
            bodyBuilder.append(msg.displayMessageBody ?: "")
            timestamp = msg.timestampMillis
        }

        val fullBody = bodyBuilder.toString()

        // Write to system SMS Inbox (required for default SMS app)
        try {
            val values = ContentValues().apply {
                put(Telephony.Sms.ADDRESS, address)
                put(Telephony.Sms.BODY, fullBody)
                put(Telephony.Sms.DATE, timestamp)
                put(Telephony.Sms.READ, 0)
                put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_INBOX)
            }
            context.contentResolver.insert(Telephony.Sms.Inbox.CONTENT_URI, values)
        } catch (ignored: Exception) {}

        // Notify active WebView
        val json = JSONObject().apply {
            put("id", "sim-${System.currentTimeMillis()}")
            put("address", address)
            put("sender", address)
            put("senderName", address)
            put("body", fullBody)
            put("text", fullBody)
            put("date", timestamp)
            put("type", "inbox")
            put("read", false)
        }
        MainActivity.dispatchIncomingSms(json.toString())

        // Show Heads-Up Notification
        showNotification(context, address, fullBody)
    }

    private fun handleCbeWebhookBroadcast(context: Context, intent: Intent) {
        val payloadStr = intent.getStringExtra("payload") ?: intent.getStringExtra("body")
        if (!payloadStr.isNullOrEmpty()) {
            try {
                val json = JSONObject(payloadStr)
                val sender = json.optString("senderName", json.optString("sender", "CBEBirr"))
                val text = json.optString("text", json.optString("body", ""))
                MainActivity.dispatchIncomingSms(json.toString())
                if (text.isNotEmpty()) {
                    showNotification(context, sender, text)
                }
            } catch (e: Exception) {
                MainActivity.dispatchIncomingSms(payloadStr)
            }
        }
    }

    private fun showNotification(context: Context, title: String, message: String) {
        val channelId = "messages_high_priority_channel"
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "New Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Incoming SMS and banking transaction alerts"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 180, 80, 240)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setVibrate(longArrayOf(0, 180, 80, 240))
            .build()

        notificationManager.notify((System.currentTimeMillis() % 100000).toInt(), notification)
    }
}
