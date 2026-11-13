package com.cbebirr.messages.cbe

import android.app.Service
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.provider.Telephony
import android.telephony.SmsManager

class RespondViaSmsService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "android.intent.action.RESPOND_VIA_MESSAGE") {
            val recipient = extractAddress(intent.data)
            val body = intent.getStringExtra(Intent.EXTRA_TEXT)
                ?: intent.getStringExtra("android.intent.extra.TEXT")
                ?: ""

            if (recipient.isNotBlank() && body.isNotBlank()) {
                try {
                    val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        getSystemService(SmsManager::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        SmsManager.getDefault()
                    }
                    val parts = smsManager.divideMessage(body)
                    if (parts.size > 1) {
                        smsManager.sendMultipartTextMessage(recipient, null, parts, null, null)
                    } else {
                        smsManager.sendTextMessage(recipient, null, body, null, null)
                    }

                    val cv = ContentValues().apply {
                        put(Telephony.Sms.ADDRESS, recipient)
                        put(Telephony.Sms.BODY, body)
                        put(Telephony.Sms.DATE, System.currentTimeMillis())
                        put(Telephony.Sms.READ, 1)
                        put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_SENT)
                    }
                    contentResolver.insert(Telephony.Sms.Sent.CONTENT_URI, cv)
                } catch (_: Throwable) {
                }
            }
        }
        stopSelf(startId)
        return START_NOT_STICKY
    }

    private fun extractAddress(uri: Uri?): String {
        val raw = uri?.schemeSpecificPart ?: return ""
        return raw.substringBefore("?").trim()
    }
}
