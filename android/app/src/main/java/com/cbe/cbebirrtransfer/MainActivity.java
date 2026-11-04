package com.cbe.cbebirrtransfer;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.telephony.TelephonyManager;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.net.URLDecoder;

public class MainActivity extends Activity {

    public static MainActivity currentInstance = null;
    public static volatile boolean isExpectingUssdResponse = false;
    public static volatile long ussdRequestTimestamp = 0;

    private WebView webView;
    private static final int PERMISSION_REQ_CODE = 200;
    private static final String APP_URL = "https://ramussbirr.vercel.app";

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent != null && UssdAccessibilityService.ACTION_RECEIVER_FOUND.equals(intent.getAction())) {
                String name = intent.getStringExtra(UssdAccessibilityService.EXTRA_NAME);
                if (name != null && !name.trim().isEmpty()) {
                    injectReceiverName(name.trim());
                }
            }
        }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        currentInstance = this;

        checkPermissions();

        // Register broadcast listener from UssdAccessibilityService
        IntentFilter filter = new IntentFilter(UssdAccessibilityService.ACTION_RECEIVER_FOUND);
        registerReceiver(receiver, filter);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebChromeClient(new WebChromeClient());

        webView.addJavascriptInterface(new WebAppInterface(this), "Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    return handleUrl(request.getUrl().toString());
                }
                return false;
            }

            private boolean handleUrl(String url) {
                if (url != null && url.startsWith("tel:")) {
                    String decoded = url.replace("tel:", "").replace("%23", "#");
                    try {
                        decoded = URLDecoder.decode(url.replace("tel:", ""), "UTF-8");
                    } catch (Exception e) {
                        // ignore
                    }
                    executeSilentUssd(decoded, url);
                    return true;
                }
                return false;
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.proceed();
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                Toast.makeText(MainActivity.this, "Network error: " + description, Toast.LENGTH_SHORT).show();
            }
        });

        setContentView(webView);
        webView.clearCache(true);
        webView.loadUrl(APP_URL + "?v=" + System.currentTimeMillis());
    }

    @Override
    protected void onResume() {
        super.onResume();
        currentInstance = this;
    }

    @Override
    protected void onStop() {
        super.onStop();
        // If user manually switched apps, ensure we stop expecting USSD so app never randomly launches
        if (System.currentTimeMillis() - ussdRequestTimestamp > 12000) {
            isExpectingUssdResponse = false;
        }
    }

    /**
     * Executes USSD with CBEBirr tree *847*1*2*[account]#
     */
    private void executeSilentUssd(String ussdCode, final String rawTelUri) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                checkPermissions();
                return;
            }
        }

        // Set state: CBEBirr Plus is now actively awaiting USSD
        isExpectingUssdResponse = true;
        ussdRequestTimestamp = System.currentTimeMillis();

        // Ensure proper CBEBirr *847*1*2*[account]# format if only account was passed
        if (ussdCode != null && !ussdCode.contains("*1*2*") && ussdCode.startsWith("*847*")) {
            String remainder = ussdCode.replace("*847*", "").replace("#", "");
            ussdCode = "*847*1*2*" + remainder + "#";
        }

        final String finalUssdCode = ussdCode;
        final TelephonyManager tm = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
        if (tm == null) {
            fallbackActionCall(rawTelUri);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                tm.sendUssdRequest(finalUssdCode, new TelephonyManager.UssdResponseCallback() {
                    @Override
                    public void onReceiveUssdResponse(TelephonyManager telephonyManager, String request, CharSequence response) {
                        final String responseText = response.toString();
                        final String extractedName = extractReceiverName(responseText);

                        if (extractedName != null && !extractedName.isEmpty()) {
                            injectReceiverName(extractedName);
                        }
                    }

                    @Override
                    public void onReceiveUssdResponseFailed(TelephonyManager telephonyManager, String request, int failureCode) {
                        // Fallback to ACTION_CALL so carrier dialog shows
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                fallbackActionCall(rawTelUri);
                            }
                        });
                    }
                }, new Handler(Looper.getMainLooper()));
            } catch (Exception e) {
                fallbackActionCall(rawTelUri);
            }
        } else {
            fallbackActionCall(rawTelUri);
        }
    }

    public void setReceiverNameFromService(String name) {
        injectReceiverName(name);
    }

    /**
     * Directly injects the extracted name into the web app's Receiver Name field.
     * Zero modal popups are triggered.
     */
    private void injectReceiverName(final String name) {
        isExpectingUssdResponse = false;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView != null && name != null && !name.isEmpty()) {
                    String safeName = name.replace("'", "\\'");
                    String js = "if (window.onReceiverNameReceived) { window.onReceiverNameReceived('" + safeName + "'); }" +
                                "if (window.setReceiverNameDirectly) { window.setReceiverNameDirectly('" + safeName + "'); }" +
                                "var m = document.querySelectorAll('#fullscreenModal, .fullscreen-modal, [role=dialog]'); for(var i=0; i<m.length; i++) { m[i].remove(); }";
                    webView.evaluateJavascript(js, null);
                }
            }
        });
    }

    private void fallbackActionCall(String rawTelUri) {
        try {
            isExpectingUssdResponse = true;
            ussdRequestTimestamp = System.currentTimeMillis();
            Intent callIntent = new Intent(Intent.ACTION_CALL, Uri.parse(rawTelUri));
            callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(callIntent);
        } catch (Exception e) {
            isExpectingUssdResponse = false;
            Toast.makeText(this, "Could not dial: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private String extractReceiverName(String ussdText) {
        return UssdAccessibilityService.parseAccountName(ussdText);
    }

    private void checkPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{
                        Manifest.permission.CALL_PHONE,
                        Manifest.permission.READ_PHONE_STATE
                }, PERMISSION_REQ_CODE);
            }
        }
    }

    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void dialUSSD(final String ussdCode) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    String decoded = ussdCode.replace("tel:", "").replace("%23", "#");
                    try {
                        decoded = URLDecoder.decode(ussdCode.replace("tel:", ""), "UTF-8");
                    } catch (Exception e) {
                        // ignore
                    }
                    executeSilentUssd(decoded, ussdCode);
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            unregisterReceiver(receiver);
        } catch (Exception e) {
            // ignore
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
}
