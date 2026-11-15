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
    private const val KEY_DELETED_KEYS = "deleted_message_keys"
    private const val MAX_SAVED_MESSAGES = 400
    private const val MAX_SEEN_IDS = 800
    private const val MAX_DELETED_KEYS = 800

    private val lock = Any()

    fun isDefaultSmsApp(context: Context): Boolean {
        return try {
            Telephony.Sms.getDefaultSmsPackage(context) == context.packageName
        } catch (_: Throwable) {
            false
        }
    }

    private fun normalizePhoneKey(raw: String): String {
        val digits = raw.filter { it.isDigit() }
        return if (digits.length >= 9) digits.takeLast(9) else raw.trim().lowercase()
    }

    private fun buildCandidateDeleteKeys(
        id: String,
        address: String,
        body: String,
        dateMs: Long,
        txnId: String,
        source: String
    ): List<String> {
        val keys = mutableListOf<String>()
        if (id.isNotBlank()) keys.add("id:$id")
        if (txnId.isNotBlank()) keys.add("tx:$txnId")
        if (body.isNotBlank()) {
            keys.add("msg:${source}:${body.trim().hashCode()}:${dateMs / 10000L}")
            keys.add("bsec:${address.trim().lowercase()}:${body.trim().hashCode()}:${dateMs / 1000L}")
        }
        return keys
    }

    private fun isDeletedLocked(
        deletedArr: JSONArray,
        id: String,
        address: String,
        body: String,
        dateMs: Long,
        txnId: String,
        source: String
    ): Boolean {
        if (deletedArr.length() == 0) return false
        val candidates = buildCandidateDeleteKeys(id, address, body, dateMs, txnId, source).toSet()
        for (i in 0 until deletedArr.length()) {
            val k = deletedArr.optString(i)
            if (k in candidates) return true
        }
        return false
    }

    /**
     * Inserts an incoming message into SharedPreferences safely with deduplication & delete tombstones.
     * Returns true if the message was genuinely new (not seen or deleted before), false if duplicate/deleted.
     */
    fun saveIncomingMessage(
        context: Context,
        id: String,
        address: String,
        body: String,
        dateMs: Long,
        type: String = "inbox",
        isBank: Boolean = false,
        source: String = "sim",
        txnId: String = "",
        amount: String = "",
        recipient: String = "",
        recipientAccount: String = "",
        receiptUrl: String = ""
    ): Boolean {
        if (body.isBlank()) return false

        synchronized(lock) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val deletedArr = try {
                JSONArray(prefs.getString(KEY_DELETED_KEYS, "[]") ?: "[]")
            } catch (_: Throwable) {
                JSONArray()
            }

            if (isDeletedLocked(deletedArr, id, address, body, dateMs, txnId, source)) {
                return false
            }

            val seenArr = try {
                JSONArray(prefs.getString(KEY_SEEN_IDS, "[]") ?: "[]")
            } catch (_: Throwable) {
                JSONArray()
            }

            val dedupeKey = when {
                txnId.isNotBlank() -> "tx:$source:$txnId:${body.hashCode()}"
                id.isNotBlank() -> "id:$source:$id"
                else -> "msg:$source:${address.lowercase()}:${body.hashCode()}:${dateMs / 10000}"
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

            // Secondary check in savedArr for identical text+source within 15s
            for (i in 0 until savedArr.length()) {
                val existing = savedArr.optJSONObject(i) ?: continue
                val existingText = existing.optString("body", existing.optString("text", ""))
                val existingDate = existing.optLong("date", 0L)
                val existingSource = existing.optString("source", "sim")
                if (existingSource == source && existingText == body && kotlin.math.abs(existingDate - dateMs) < 15000L) {
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
                put("source", source)
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

    fun deleteMessage(
        context: Context,
        id: String,
        address: String,
        body: String,
        dateMs: Long,
        source: String = "sim"
    ): Boolean {
        synchronized(lock) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val savedArr = try {
                JSONArray(prefs.getString(KEY_SAVED_MESSAGES, "[]") ?: "[]")
            } catch (_: Throwable) {
                JSONArray()
            }
            val deletedArr = try {
                JSONArray(prefs.getString(KEY_DELETED_KEYS, "[]") ?: "[]")
            } catch (_: Throwable) {
                JSONArray()
            }

            val nextArr = JSONArray()
            var removedAny = false
            val cleanBody = body.trim()

            for (i in 0 until savedArr.length()) {
                val obj = savedArr.optJSONObject(i) ?: continue
                val objId = obj.optString("id", "")
                val objBody = obj.optString("body", obj.optString("text", "")).trim()
                val objDate = obj.optLong("date", 0L)
                val objTxn = obj.optString("txnId", "")
                val objAddr = obj.optString("address", "")
                val objSource = obj.optString("source", if (objId.startsWith("cbe") || objId.startsWith("remote_")) "app" else "sim")

                val matchId = id.isNotBlank() && objId == id
                val matchBodyAndTime = cleanBody.isNotEmpty() && objBody == cleanBody &&
                    (dateMs <= 0L || kotlin.math.abs(objDate - dateMs) < 5000L) &&
                    (source.isBlank() || objSource == source)

                if (matchId || matchBodyAndTime) {
                    removedAny = true
                    buildCandidateDeleteKeys(objId, objAddr, objBody, objDate, objTxn, objSource).forEach {
                        deletedArr.put(it)
                    }
                } else {
                    nextArr.put(obj)
                }
            }

            buildCandidateDeleteKeys(id, address, cleanBody, dateMs, "", source).forEach {
                deletedArr.put(it)
            }

            val trimmedDeleted = JSONArray()
            val startDel = maxOf(0, deletedArr.length() - MAX_DELETED_KEYS)
            for (i in startDel until deletedArr.length()) {
                trimmedDeleted.put(deletedArr.get(i))
            }

            prefs.edit()
                .putString(KEY_SAVED_MESSAGES, nextArr.toString())
                .putString(KEY_DELETED_KEYS, trimmedDeleted.toString())
                .apply()

            return removedAny
        }
    }

    fun deleteConversation(
        context: Context,
        address: String,
        source: String
    ): Boolean {
        synchronized(lock) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val savedArr = try {
                JSONArray(prefs.getString(KEY_SAVED_MESSAGES, "[]") ?: "[]")
            } catch (_: Throwable) {
                JSONArray()
            }
            val deletedArr = try {
                JSONArray(prefs.getString(KEY_DELETED_KEYS, "[]") ?: "[]")
            } catch (_: Throwable) {
                JSONArray()
            }

            val nextArr = JSONArray()
            var removedAny = false
            val targetNorm = normalizePhoneKey(address)
            val targetLower = address.trim().lowercase()

            for (i in 0 until savedArr.length()) {
                val obj = savedArr.optJSONObject(i) ?: continue
                val objId = obj.optString("id", "")
                val objBody = obj.optString("body", obj.optString("text", "")).trim()
                val objDate = obj.optLong("date", 0L)
                val objTxn = obj.optString("txnId", "")
                val objAddr = obj.optString("address", obj.optString("sender", ""))
                val objSource = obj.optString("source", if (objId.startsWith("cbe") || objId.startsWith("remote_")) "app" else "sim")

                val sameSource = source.isBlank() || objSource == source
                val objNorm = normalizePhoneKey(objAddr)
                val sameAddress = if (source == "app" && targetLower.contains("cbe")) {
                    true
                } else {
                    objAddr.trim().lowercase() == targetLower || (targetNorm.isNotEmpty() && objNorm == targetNorm)
                }

                if (sameSource && sameAddress) {
                    removedAny = true
                    buildCandidateDeleteKeys(objId, objAddr, objBody, objDate, objTxn, objSource).forEach {
                        deletedArr.put(it)
                    }
                } else {
                    nextArr.put(obj)
                }
            }

            val trimmedDeleted = JSONArray()
            val startDel = maxOf(0, deletedArr.length() - MAX_DELETED_KEYS)
            for (i in startDel until deletedArr.length()) {
                trimmedDeleted.put(deletedArr.get(i))
            }

            prefs.edit()
                .putString(KEY_SAVED_MESSAGES, nextArr.toString())
                .putString(KEY_DELETED_KEYS, trimmedDeleted.toString())
                .apply()

            return removedAny
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
     * Safely inserts an incoming SIM SMS into Android's Telephony.Sms.Inbox content provider
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
