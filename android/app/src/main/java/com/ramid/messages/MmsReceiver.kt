package com.ramid.messages

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class MmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // MMS / WAP Push handler required by Android OS for default SMS app compliance
    }
}
