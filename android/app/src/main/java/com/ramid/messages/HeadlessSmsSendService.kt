package com.ramid.messages

import android.app.Service
import android.content.Intent
import android.os.IBinder

class HeadlessSmsSendService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Quick response via message service required by Android OS for default SMS app compliance
        stopSelf(startId)
        return START_NOT_STICKY
    }
}
