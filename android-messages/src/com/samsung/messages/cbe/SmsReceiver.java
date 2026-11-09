package com.samsung.messages.cbe;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsMessage;

public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        if ("android.provider.Telephony.SMS_DELIVER".equals(action) ||
            "android.provider.Telephony.SMS_RECEIVED".equals(action)) {

            Bundle bundle = intent.getExtras();
            if (bundle != null) {
                Object[] pdus = (Object[]) bundle.get("pdus");
                String format = bundle.getString("format");
                if (pdus != null) {
                    for (Object pdu : pdus) {
                        try {
                            SmsMessage sms;
                            if (Build.VERSION.SDK_INT >= 23) {
                                sms = SmsMessage.createFromPdu((byte[]) pdu, format);
                            } else {
                                sms = SmsMessage.createFromPdu((byte[]) pdu);
                            }
                            if (sms != null) {
                                String sender = sms.getDisplayOriginatingAddress();
                                String body = sms.getMessageBody();

                                if (MainActivity.instance != null) {
                                    MainActivity.instance.postNotification(
                                        sender != null ? sender : "Messages",
                                        body != null ? body : "New SMS received"
                                    );
                                }
                            }
                        } catch (Exception ignored) {}
                    }
                }
            }
        }
    }
}
