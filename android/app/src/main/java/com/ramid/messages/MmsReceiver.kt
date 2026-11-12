package com.ramid.messages

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Required dummy BroadcastReceiver for WAP_PUSH_DELIVER to comply with Android Default SMS App specification.
 */
class MmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // MMS WAP push delivered - placeholder for default SMS app role compliance
    }
}
