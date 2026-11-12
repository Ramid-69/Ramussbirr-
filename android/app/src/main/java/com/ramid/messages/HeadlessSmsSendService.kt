package com.ramid.messages

import android.app.Service
import android.content.Intent
import android.os.IBinder

/**
 * Required Service for RESPOND_VIA_MESSAGE to comply with Android Default SMS App specification.
 */
class HeadlessSmsSendService : Service() {
    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        stopSelf()
        return START_NOT_STICKY
    }
}
