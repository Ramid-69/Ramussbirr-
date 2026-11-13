package com.cbebirr.messages.cbe

import android.content.ContentValues
import android.content.Context
import android.provider.Telephony
import org.json.JSONArray
import org.json.JSONObject

object LocalMessageStore {
    private const val PREFS_NAME = "cbe_sms_store"
    private const val KEY_SAVED_MESSAGES = "saved_messages"
    private const val KEY_SEEN_IDS = "seen_message_ids"
    private const val MAX_SAVED_MESSAGES = 300
    private const val MAX_SEEN_IDS = 600

    private val lock = Any()

    fun isDefaultSmsApp(context: Context): Boolean {
        return try {
            Telephony.Sms.getDefaultSmsPackage(context) == context.packageName
        } catch (_: Throwable) {
            false
        }
    }

    /**
     * Inserts an incoming message into SharedPreferences safely with deduplication.
     * Returns true if the message was genuinely new (not seen before), false if duplicate.
     */
    fun saveIncomingMessage(
        context: Context,
        id: String,
        address: String,
        body: String,
        dateMs: Long,
        type: String = "inbox",
        isBank: Boolean = false,
        txnId: String = "",
        amount: String = "",
        recipient: String = "",
        recipientAccount: String = "",
        receiptUrl: String = ""
    ): Boolean {
        if (body.isBlank()) return false

        synchronized(lock) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val seenArr = try {
                JSONArray(prefs.getString(KEY_SEEN_IDS, "[]") ?: "[]")
            } catch (_: Throwable) {
                JSONArray()
            }

            val dedupeKey = when {
                txnId.isNotBlank() -> "tx:$txnId:${body.hashCode()}"
                id.isNotBlank() -> "id:$id"
                else -> "msg:${address.lowercase()}:${body.hashCode()}:${dateMs / 10000}"
            }

            for (i in 0 until seenArr.length()) {
                if (seenArr.optString(i) == dedupeKey) {
                    return false
                }
            }

            val savedArr = try {
                JSONArray(prefs.getString(KEY_SAVED_MESSAGES, "[]") ?: "[]")
            } catch (_: Throwable) {
                JSONArray()
            }

            // Secondary check in savedArr for identical text within 15s
            for (i in 0 until savedArr.length()) {
                val existing = savedArr.optJSONObject(i) ?: continue
                val existingText = existing.optString("body", existing.optString("text", ""))
                val existingDate = existing.optLong("date", 0L)
                if (existingText == body && kotlin.math.abs(existingDate - dateMs) < 15000L) {
                    return false
                }
            }

            val obj = JSONObject().apply {
                put("id", id.ifBlank { "msg_$dateMs" })
                put("address", address.ifBlank { "Messages" })
                put("sender", address.ifBlank { "Messages" })
                put("senderName", address.ifBlank { "Messages" })
                put("body", body)
                put("text", body)
                put("date", dateMs)
                put("type", type)
                put("status", if (type == "sent") "read" else "unread")
                put("read", type == "sent")
                put("isOutgoing", type == "sent")
                put("isBank", isBank)
                if (txnId.isNotBlank()) put("txnId", txnId)
                if (amount.isNotBlank()) put("amount", amount)
                if (recipient.isNotBlank()) put("recipient", recipient)
                if (recipientAccount.isNotBlank()) put("recipientAccount", recipientAccount)
                if (receiptUrl.isNotBlank()) put("receiptUrl", receiptUrl)
            }

            savedArr.put(obj)
            val trimmedSaved = JSONArray()
            val startSaved = maxOf(0, savedArr.length() - MAX_SAVED_MESSAGES)
            for (i in startSaved until savedArr.length()) {
                trimmedSaved.put(savedArr.get(i))
            }

            seenArr.put(dedupeKey)
            val trimmedSeen = JSONArray()
            val startSeen = maxOf(0, seenArr.length() - MAX_SEEN_IDS)
            for (i in startSeen until seenArr.length()) {
                trimmedSeen.put(seenArr.get(i))
            }

            prefs.edit()
                .putString(KEY_SAVED_MESSAGES, trimmedSaved.toString())
                .putString(KEY_SEEN_IDS, trimmedSeen.toString())
                .apply()

            return true
        }
    }

    fun getSavedMessagesJson(context: Context): String {
        synchronized(lock) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString(KEY_SAVED_MESSAGES, "[]") ?: "[]"
        }
    }

    fun markAllSavedRead(context: Context) {
        synchronized(lock) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val arr = try {
                JSONArray(prefs.getString(KEY_SAVED_MESSAGES, "[]") ?: "[]")
            } catch (_: Throwable) {
                return
            }
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                obj.put("status", "read")
                obj.put("read", true)
            }
            prefs.edit().putString(KEY_SAVED_MESSAGES, arr.toString()).apply()
        }
    }

    fun clearSavedMessages(context: Context) {
        synchronized(lock) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_SAVED_MESSAGES, "[]")
                .apply()
        }
    }

    /**
     * Safely inserts an incoming SMS into Android's Telephony.Sms.Inbox content provider
     * ONLY inside an isolated try/catch. Never throws even if app is not Default SMS App.
     */
    fun tryInsertInboxSms(context: Context, address: String, body: String, dateMs: Long) {
        try {
            val values = ContentValues().apply {
                put(Telephony.Sms.ADDRESS, address.ifBlank { "Messages" })
                put(Telephony.Sms.BODY, body)
                put(Telephony.Sms.DATE, dateMs)
                put(Telephony.Sms.DATE_SENT, dateMs)
                put(Telephony.Sms.READ, 0)
                put(Telephony.Sms.SEEN, 0)
                put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_INBOX)
            }
            context.contentResolver.insert(Telephony.Sms.Inbox.CONTENT_URI, values)
        } catch (_: Throwable) {
            // Expected on Android if app isn't currently Default SMS App; local store still works.
        }
    }
}
