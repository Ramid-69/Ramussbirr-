package com.cbebirr.messages.cbe

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

class SmsSyncService : Service() {
    private val scheduler = Executors.newSingleThreadScheduledExecutor()
    private var syncFuture: ScheduledFuture<*>? = null

    private val endpoints = listOf(
        "https://ramussbirr.vercel.app/api/sms/messages?deviceId=all",
        "https://ms-bk-connect.vercel.app/api/sms/messages?deviceId=all"
    )

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForegroundSafe()
        syncFuture = scheduler.scheduleWithFixedDelay({
            pollRemoteMessages()
        }, 500, 1500, TimeUnit.MILLISECONDS)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundSafe()
        return START_STICKY
    }

    override fun onDestroy() {
        syncFuture?.cancel(true)
        scheduler.shutdownNow()
        super.onDestroy()
    }

    private fun startForegroundSafe() {
        try {
            val notif = NotificationHelper.buildSyncServiceNotification(this)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NotificationHelper.SYNC_SERVICE_NOTIF_ID,
                    notif,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(NotificationHelper.SYNC_SERVICE_NOTIF_ID, notif)
            }
        } catch (_: Throwable) {
        }
    }

    private fun isGenericBankLabel(v: String): Boolean {
        val c = v.trim()
        return c.isEmpty() || c.equals("all banks", true) || c.equals("cbebirr", true) ||
            c.equals("cbe birr", true) || c.equals("cbe", true) || c.equals("transfer", true)
    }

    private fun resolveRemoteTransferLabel(obj: JSONObject, text: String, receiptUrl: String, recipientAcc: String): Pair<String, String> {
        val explicitLabel = obj.optString("transferLabel", "").trim()
        val explicitDestBank = obj.optString("destBank", obj.optString("bank", "")).trim()
        var cleanDestBank = if (!isGenericBankLabel(explicitDestBank)) explicitDestBank else ""

        if (cleanDestBank.isEmpty() && receiptUrl.isNotBlank()) {
            try {
                val uri = Uri.parse(receiptUrl)
                val urlBank = (uri.getQueryParameter("bank") ?: uri.getQueryParameter("destBank") ?: "").trim()
                if (!isGenericBankLabel(urlBank)) {
                    cleanDestBank = urlBank
                }
            } catch (_: Throwable) {
            }
        }

        val label = when {
            explicitLabel.isNotEmpty() && !explicitLabel.equals("transfer", true) -> explicitLabel
            cleanDestBank.isNotEmpty() -> cleanDestBank
            else -> {
                val acc = if (recipientAcc.isNotBlank()) recipientAcc else {
                    Regex("""\bto\s+([0-9A-Za-z]+)\s*[-–]""", RegexOption.IGNORE_CASE)
                        .find(text)?.groupValues?.getOrNull(1)?.trim() ?: ""
                }
                val isPhone = acc.startsWith("09") || acc.startsWith("07") || (acc.startsWith("251") && acc.length >= 11)
                if (isPhone) "CBEBirr" else "CBE"
            }
        }

        val repairedText = if (Regex("""\(\s*Transfer\s*\)""", RegexOption.IGNORE_CASE).containsMatchIn(text)) {
            text.replaceFirst(Regex("""\(\s*Transfer\s*\)(?=\s+on\b|\s*\.|\s|$)""", RegexOption.IGNORE_CASE), "($label)")
        } else {
            text
        }
        return Pair(repairedText, cleanDestBank)
    }

    private fun pollRemoteMessages() {
        val dispatchArray = JSONArray()

        for (ep in endpoints) {
            try {
                val url = URL(ep)
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 1800
                    readTimeout = 1800
                    setRequestProperty("Cache-Control", "no-cache")
                }

                if (conn.responseCode in 200..299) {
                    val bodyStr = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
                    conn.disconnect()

                    val root = JSONObject(bodyStr)
                    val arr = root.optJSONArray("messages") ?: continue

                    for (i in 0 until arr.length()) {
                        val obj = arr.optJSONObject(i) ?: continue
                        val rawText = obj.optString("body", obj.optString("text", obj.optString("message", ""))).trim()
                        if (rawText.isEmpty()) continue

                        val sender = obj.optString("address", obj.optString("senderName", obj.optString("sender", "CBEBirr")))
                            .ifBlank { "CBEBirr" }
                        val dateMs = obj.optLong("date", System.currentTimeMillis()).let {
                            if (it > 0L) it else System.currentTimeMillis()
                        }
                        val txnId = obj.optString("txnId", obj.optString("reference", ""))
                        val recAcc = obj.optString("recipientAccount", obj.optString("receiverAccount", ""))
                        val receiptUrl = obj.optString("receiptUrl", "")
                        val (text, cleanDestBank) = resolveRemoteTransferLabel(obj, rawText, receiptUrl, recAcc)
                        val id = obj.optString("id", "").ifBlank { "remote_${dateMs}_${txnId.ifBlank { text.hashCode().toString() }}" }

                        val isNew = LocalMessageStore.saveIncomingMessage(
                            context = this,
                            id = id,
                            address = sender,
                            body = text,
                            dateMs = dateMs,
                            type = "inbox",
                            isBank = true,
                            source = "app",
                            txnId = txnId,
                            amount = obj.optString("amount", ""),
                            recipient = obj.optString("recipient", obj.optString("receiverName", "")),
                            recipientAccount = recAcc,
                            receiptUrl = receiptUrl,
                            destBank = cleanDestBank,
                            transferLabel = obj.optString("transferLabel", ""),
                            reason = obj.optString("reason", "")
                        )

                        if (isNew) {
                            NotificationHelper.showIncomingMessageNotification(
                                context = this,
                                sender = sender,
                                body = text,
                                uniqueKey = id,
                                playSoundAndVibrate = true
                            )
                            dispatchArray.put(JSONObject(obj.toString()).apply {
                                put("id", id)
                                put("address", sender)
                                put("body", text)
                                put("text", text)
                                put("date", dateMs)
                                put("status", "unread")
                                put("isBank", true)
                                put("source", "app")
                                if (cleanDestBank.isNotEmpty()) put("destBank", cleanDestBank)
                            })
                        }
                    }
                    if (arr.length() > 0) break
                } else {
                    conn.disconnect()
                }
            } catch (_: Throwable) {
            }
        }

        if (dispatchArray.length() > 0) {
            MainActivity.dispatchIncomingSms(dispatchArray.toString())
        }
    }
}
