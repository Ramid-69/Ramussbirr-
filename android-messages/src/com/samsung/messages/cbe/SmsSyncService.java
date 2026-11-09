package com.samsung.messages.cbe;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.IBinder;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import org.json.JSONObject;

public class SmsSyncService extends Service {

    private boolean isRunning = false;
    private int lastMessageCount = -1;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getStringExtra("action");
            String payload = intent.getStringExtra("payload");
            if ("incoming_sms".equals(action) && payload != null) {
                CbeSmsReceiver.handleIncomingPayload(this, payload);
            }
        }

        if (!isRunning) {
            isRunning = true;
            startPollingThread();
        }

        return START_STICKY;
    }

    private void startPollingThread() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                while (isRunning) {
                    try {
                        pollRemoteWebhook();
                    } catch (Exception ignored) {}

                    try {
                        Thread.sleep(2500);
                    } catch (InterruptedException e) {
                        break;
                    }
                }
            }
        }).start();
    }

    private void pollRemoteWebhook() {
        try {
            URL url = new URL("https://ramussbirr.vercel.app/api/sms/webhook?deviceId=dev_galaxy_a12");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            conn.setRequestProperty("x-api-key", "Ram69");

            if (conn.getResponseCode() == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();

                JSONObject root = new JSONObject(sb.toString());
                int count = root.optInt("count", 0);

                if (lastMessageCount != -1 && count > lastMessageCount) {
                    // New message arrived on server!
                    JSONArray msgs = root.optJSONArray("messages");
                    if (msgs != null && msgs.length() > 0) {
                        JSONObject latest = msgs.getJSONObject(msgs.length() - 1);
                        String sender = latest.optString("sender", latest.optString("senderName", "CBEBirr"));
                        String text = latest.optString("text", "New SMS received");

                        CbeSmsReceiver.handleIncomingPayload(SmsSyncService.this, latest.toString());
                    }
                }
                lastMessageCount = count;
            }
            conn.disconnect();
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
    }
}
