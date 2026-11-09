package com.samsung.messages.cbe;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Vibrator;
import org.json.JSONArray;
import org.json.JSONObject;

public class CbeSmsReceiver extends BroadcastReceiver {

    public static final String ACTION_CBE_SMS = "com.cbe.cbebirrtransfer.SMS_WEBHOOK";
    private static final String CHANNEL_ID = "cbe_messages_channel";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        if (ACTION_CBE_SMS.equals(action)) {
            String payloadStr = intent.getStringExtra("payload");
            if (payloadStr != null && !payloadStr.trim().isEmpty()) {
                handleIncomingPayload(context, payloadStr);
            }
        }
    }

    public static void handleIncomingPayload(Context context, String payloadStr) {
        try {
            JSONObject obj = new JSONObject(payloadStr);
            String sender = obj.optString("senderName", obj.optString("sender", "CBEBirr"));
            String text = obj.optString("text", obj.optString("message", ""));
            String txnId = obj.optString("txnId", obj.optString("reference", ""));
            String amount = obj.optString("amount", "");
            String balance = obj.optString("balance", "");
            String recipient = obj.optString("recipient", obj.optString("receiverName", ""));
            String recipientAccount = obj.optString("recipientAccount", obj.optString("receiverAccount", ""));

            if (text.isEmpty()) {
                text = "Dear Customer, transfer of " + (amount.isEmpty() ? "500.00" : amount) +
                       "Br. to " + (recipientAccount.isEmpty() ? "1000440979843" : recipientAccount) +
                       " successful. Txn ID " + (txnId.isEmpty() ? "FT263027RY7L" : txnId) +
                       ". Balance " + (balance.isEmpty() ? "3,450.00" : balance) + "Br.";
            }

            // 1. Save to local persistent storage (so Messages app has it immediately)
            saveMessageLocally(context, sender, text, amount, txnId, recipient, recipientAccount);

            // 2. Play phone's native system notification sound and vibration
            playSystemSoundAndVibrate(context);

            // 3. Post system notification in Notification Shade
            postSystemNotification(context, sender, text);

            // 4. If MainActivity is open, notify webview directly
            if (MainActivity.instance != null) {
                MainActivity.instance.notifyNewMessageDelivered(sender, text, txnId, amount);
            }
        } catch (Exception ignored) {}
    }

    private static void saveMessageLocally(Context context, String sender, String text, String amount, String txnId, String rec, String acc) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("cbe_sms_store", Context.MODE_PRIVATE);
            String existingJson = prefs.getString("messages", "[]");
            JSONArray array = new JSONArray(existingJson);

            JSONObject newMsg = new JSONObject();
            newMsg.put("id", "cbe-" + System.currentTimeMillis());
            newMsg.put("sender", sender);
            newMsg.put("senderName", sender);
            newMsg.put("conversationId", sender);
            newMsg.put("text", text);
            newMsg.put("amount", amount);
            newMsg.put("txnId", txnId);
            newMsg.put("recipient", rec);
            newMsg.put("recipientAccount", acc);
            newMsg.put("timestamp", "Just now");
            newMsg.put("date", new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).format(new java.util.Date()));
            newMsg.put("isOutgoing", false);
            newMsg.put("isBank", true);
            newMsg.put("status", "unread");

            // Prepend new message
            JSONArray updated = new JSONArray();
            updated.put(newMsg);
            for (int i = 0; i < array.length(); i++) {
                updated.put(array.get(i));
            }

            prefs.edit().putString("messages", updated.toString()).apply();
        } catch (Exception ignored) {}
    }

    private static void postSystemNotification(Context context, String title, String body) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi;
            if (Build.VERSION.SDK_INT >= 23) {
                pi = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | 0x04000000);
            } else {
                pi = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT);
            }

            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            Notification.Builder builder = new Notification.Builder(context);
            builder.setContentTitle(title)
                   .setContentText(body)
                   .setSmallIcon(android.R.drawable.sym_action_chat)
                   .setContentIntent(pi)
                   .setAutoCancel(true)
                   .setPriority(Notification.PRIORITY_HIGH)
                   .setSound(soundUri)
                   .setVibrate(new long[]{0, 250, 100, 250});

            if (Build.VERSION.SDK_INT >= 26) {
                try {
                    builder.getClass().getMethod("setChannelId", String.class).invoke(builder, CHANNEL_ID);
                } catch (Exception ignored) {}
            }

            nm.notify((int) System.currentTimeMillis(), builder.build());
        } catch (Exception ignored) {}
    }

    private static void playSystemSoundAndVibrate(Context context) {
        try {
            Uri alert = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            Ringtone r = RingtoneManager.getRingtone(context.getApplicationContext(), alert);
            if (r != null) {
                r.play();
            }
            Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                v.vibrate(new long[]{0, 250, 100, 250}, -1);
            }
        } catch (Exception ignored) {}
    }
}
