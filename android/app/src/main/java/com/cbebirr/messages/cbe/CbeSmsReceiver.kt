package com.cbebirr.messages.cbe

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject

class CbeSmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != "com.cbe.cbebirrtransfer.SMS_WEBHOOK") return
        val rawPayload = intent.getStringExtra("payload")?.trim() ?: return
        if (rawPayload.isEmpty()) return

        val items = mutableListOf<JSONObject>()
        try {
            if (rawPayload.startsWith("[")) {
                val arr = JSONArray(rawPayload)
                for (i in 0 until arr.length()) {
                    arr.optJSONObject(i)?.let { items.add(it) }
                }
            } else if (rawPayload.startsWith("{")) {
                items.add(JSONObject(rawPayload))
            } else {
                items.add(JSONObject().put("text", rawPayload))
            }
        } catch (_: Throwable) {
            items.add(JSONObject().put("text", rawPayload))
        }

        val dispatchArray = JSONArray()

        for (obj in items) {
            val body = obj.optString("body", obj.optString("text", obj.optString("message", ""))).trim()
            if (body.isEmpty()) continue

            val sender = obj.optString("address", obj.optString("senderName", obj.optString("sender", "CBEBirr")))
                .ifBlank { "CBEBirr" }
            val dateMs = obj.optLong("date", System.currentTimeMillis()).let {
                if (it > 0L) it else System.currentTimeMillis()
            }
            val txnId = obj.optString("txnId", obj.optString("reference", ""))
            val amount = obj.optString("amount", "")
            val recipient = obj.optString("recipient", obj.optString("receiverName", ""))
            val recipientAcc = obj.optString("recipientAccount", obj.optString("receiverAccount", ""))
            val receiptUrl = obj.optString("receiptUrl", "")
            val id = obj.optString("id", "").ifBlank { "cbe_$dateMs" }

            val isNew = LocalMessageStore.saveIncomingMessage(
                context = context,
                id = id,
                address = sender,
                body = body,
                dateMs = dateMs,
                type = "inbox",
                isBank = true,
                txnId = txnId,
                amount = amount,
                recipient = recipient,
                recipientAccount = recipientAcc,
                receiptUrl = receiptUrl
            )

            if (LocalMessageStore.isDefaultSmsApp(context)) {
                LocalMessageStore.tryInsertInboxSms(context, sender, body, dateMs)
            }

            if (isNew) {
                NotificationHelper.showIncomingMessageNotification(
                    context = context,
                    sender = sender,
                    body = body,
                    uniqueKey = id,
                    playSoundAndVibrate = true
                )

                val out = JSONObject(obj.toString()).apply {
                    put("id", id)
                    put("address", sender)
                    put("sender", sender)
                    put("senderName", sender)
                    put("body", body)
                    put("text", body)
                    put("date", dateMs)
                    put("type", "inbox")
                    put("status", "unread")
                    put("isBank", true)
                }
                dispatchArray.put(out)
            }
        }

        if (dispatchArray.length() > 0) {
            MainActivity.dispatchIncomingSms(dispatchArray.toString())
        }
    }
}
