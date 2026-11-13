package com.cbebirr.messages.cbe

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class MmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == "android.provider.Telephony.WAP_PUSH_DELIVER") {
            NotificationHelper.showIncomingMessageNotification(
                context = context,
                sender = "Multimedia Message",
                body = "New MMS message received",
                uniqueKey = "mms_${System.currentTimeMillis()}",
                playSoundAndVibrate = true
            )
        }
    }
}
