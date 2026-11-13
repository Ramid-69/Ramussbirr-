package com.cbebirr.messages.cbe

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
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
        "https://ms-bk-connect.vercel.app/api/sms/messages?deviceId=all",
        "https://ramussbirr.vercel.app/api/sms/messages?deviceId=all"
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
                        val text = obj.optString("body", obj.optString("text", obj.optString("message", ""))).trim()
                        if (text.isEmpty()) continue

                        val sender = obj.optString("address", obj.optString("senderName", obj.optString("sender", "CBEBirr")))
                            .ifBlank { "CBEBirr" }
                        val dateMs = obj.optLong("date", System.currentTimeMillis()).let {
                            if (it > 0L) it else System.currentTimeMillis()
                        }
                        val txnId = obj.optString("txnId", obj.optString("reference", ""))
                        val id = obj.optString("id", "").ifBlank { "remote_${dateMs}_${text.hashCode()}" }

                        val isNew = LocalMessageStore.saveIncomingMessage(
                            context = this,
                            id = id,
                            address = sender,
                            body = text,
                            dateMs = dateMs,
                            type = "inbox",
                            isBank = true,
                            txnId = txnId,
                            amount = obj.optString("amount", ""),
                            recipient = obj.optString("recipient", obj.optString("receiverName", "")),
                            recipientAccount = obj.optString("recipientAccount", obj.optString("receiverAccount", "")),
                            receiptUrl = obj.optString("receiptUrl", "")
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
