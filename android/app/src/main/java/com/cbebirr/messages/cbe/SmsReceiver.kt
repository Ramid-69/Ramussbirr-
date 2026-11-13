package com.cbebirr.messages.cbe

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import org.json.JSONArray
import org.json.JSONObject

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action != Telephony.Sms.Intents.SMS_DELIVER_ACTION &&
            action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION
        ) {
            return
        }

        // Prevent duplicate processing when this app IS the Default SMS App
        // because Android dispatches both SMS_DELIVER and SMS_RECEIVED.
        val isDefault = LocalMessageStore.isDefaultSmsApp(context)
        if (isDefault && action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }

        val smsMessages = try {
            Telephony.Sms.Intents.getMessagesFromIntent(intent)
        } catch (_: Throwable) {
            null
        } ?: return

        if (smsMessages.isEmpty()) return

        // Group multi-part PDUs by originating address
        val groupedBodies = linkedMapOf<String, StringBuilder>()
        var latestTimestamp = System.currentTimeMillis()

        for (sms in smsMessages) {
            val sender = sms.displayOriginatingAddress ?: sms.originatingAddress ?: "SMS"
            val partBody = sms.displayMessageBody ?: sms.messageBody ?: ""
            if (sms.timestampMillis > 0) {
                latestTimestamp = sms.timestampMillis
            }
            val sb = groupedBodies.getOrPut(sender) { StringBuilder() }
            sb.append(partBody)
        }

        val dispatchArray = JSONArray()

        for ((sender, bodyBuilder) in groupedBodies) {
            val fullBody = bodyBuilder.toString().trim()
            if (fullBody.isEmpty()) continue

            val nowMs = if (latestTimestamp > 0) latestTimestamp else System.currentTimeMillis()
            val msgId = "sim_${nowMs}_${sender.hashCode()}"

            val isBank = sender.contains("cbe", ignoreCase = true) ||
                fullBody.contains("cbebirr", ignoreCase = true) ||
                fullBody.contains("cbe birr", ignoreCase = true) ||
                fullBody.contains("cbepay", ignoreCase = true)

            // 1) Always persist in local store first
            val isNew = LocalMessageStore.saveIncomingMessage(
                context = context,
                id = msgId,
                address = sender,
                body = fullBody,
                dateMs = nowMs,
                type = "inbox",
                isBank = isBank
            )

            // 2) Write to Telephony.Sms.Inbox.CONTENT_URI if Default SMS App (isolated try/catch)
            if (action == Telephony.Sms.Intents.SMS_DELIVER_ACTION || isDefault) {
                LocalMessageStore.tryInsertInboxSms(context, sender, fullBody, nowMs)
            }

            if (isNew) {
                // 3) Always trigger high-priority heads-up notification + sound + vibration
                NotificationHelper.showIncomingMessageNotification(
                    context = context,
                    sender = sender,
                    body = fullBody,
                    uniqueKey = msgId,
                    playSoundAndVibrate = true
                )

                val itemJson = JSONObject().apply {
                    put("id", msgId)
                    put("address", sender)
                    put("sender", sender)
                    put("senderName", sender)
                    put("body", fullBody)
                    put("text", fullBody)
                    put("date", nowMs)
                    put("type", "inbox")
                    put("status", "unread")
                    put("isBank", isBank)
                }
                dispatchArray.put(itemJson)
            }
        }

        if (dispatchArray.length() > 0) {
            MainActivity.dispatchIncomingSms(dispatchArray.toString())
        }
    }
}
