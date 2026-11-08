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
import java.io.File;
import java.io.FileOutputStream;
import android.util.Base64;
import android.media.MediaScannerConnection;
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
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN);

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

        webView.setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                downloadFileFromUrl(url, contentDisposition, mimetype);
            }
        });

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

        if (UssdAccessibilityService.instance != null) {
            UssdAccessibilityService.instance.showLoadingOverlay();
        }

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
            if (UssdAccessibilityService.instance != null) {
                UssdAccessibilityService.instance.showLoadingOverlay();
            }
            Intent callIntent = new Intent(Intent.ACTION_CALL, Uri.parse(rawTelUri));
            callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(callIntent);
        } catch (Exception e) {
            isExpectingUssdResponse = false;
            if (UssdAccessibilityService.instance != null) {
                UssdAccessibilityService.instance.hideLoadingOverlay();
            }
            Toast.makeText(this, "Could not dial: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private String extractReceiverName(String ussdText) {
        return UssdAccessibilityService.parseAccountName(ussdText);
    }

    private void checkPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            java.util.List<String> perms = new java.util.ArrayList<>();
            if (checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                perms.add(Manifest.permission.CALL_PHONE);
            }
            if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
                perms.add(Manifest.permission.READ_PHONE_STATE);
            }
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    perms.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
                }
            }
            if (!perms.isEmpty()) {
                requestPermissions(perms.toArray(new String[0]), PERMISSION_REQ_CODE);
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

        @JavascriptInterface
        public void sendSms(final String jsonPayload) {
            try {
                Intent intent = new Intent("com.cbe.cbebirrtransfer.SMS_WEBHOOK");
                intent.putExtra("payload", jsonPayload);
                mContext.sendBroadcast(intent);
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void saveBase64Pdf(final String base64Data, final String filename) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    savePdfBytesToStorage(base64Data, filename);
                }
            });
        }

        @JavascriptInterface
        public void downloadReceipt(final String url) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    downloadFileFromUrl(url, null, "application/pdf");
                }
            });
        }
    }

    public void savePdfBytesToStorage(String base64Data, String filename) {
        if (base64Data == null || base64Data.trim().isEmpty()) {
            Toast.makeText(this, "የደረሰኝ ዳታ ባዶ ነው (Empty receipt data)", Toast.LENGTH_SHORT).show();
            return;
        }

        try {
            String cleanData = base64Data;
            if (cleanData.contains(",")) {
                cleanData = cleanData.substring(cleanData.indexOf(",") + 1);
            }
            byte[] pdfBytes = Base64.decode(cleanData, Base64.DEFAULT);

            String safeName = (filename != null && !filename.trim().isEmpty()) ? filename : "CBEBirr_Official_Receipt.pdf";
            if (!safeName.toLowerCase().endsWith(".pdf")) {
                safeName += ".pdf";
            }

            File downloadDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
            if (!downloadDir.exists()) {
                downloadDir.mkdirs();
            }
            File pdfFile = new File(downloadDir, safeName);
            FileOutputStream fos = new FileOutputStream(pdfFile);
            fos.write(pdfBytes);
            fos.flush();
            fos.close();

            MediaScannerConnection.scanFile(
                    this,
                    new String[]{pdfFile.getAbsolutePath()},
                    new String[]{"application/pdf"},
                    null
            );

            Toast.makeText(this, "ደረሰኝ በስልክዎ Downloads ፎልደር ተቀምጧል (" + safeName + ")", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "ደረሰኝ ማስቀመጥ አልተቻለም: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    public void downloadFileFromUrl(String url, String contentDisposition, String mimetype) {
        try {
            android.app.DownloadManager.Request request = new android.app.DownloadManager.Request(Uri.parse(url));
            if (mimetype != null && !mimetype.isEmpty()) {
                request.setMimeType(mimetype);
            } else {
                request.setMimeType("application/pdf");
            }
            String cookies = android.webkit.CookieManager.getInstance().getCookie(url);
            if (cookies != null) {
                request.addRequestHeader("cookie", cookies);
            }
            request.setDescription("Downloading CBEBirr Official Receipt...");
            String filename = "CBEBirr_Receipt.pdf";
            if (contentDisposition != null) {
                filename = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimetype);
            } else if (url != null && url.contains("ref=")) {
                try {
                    Uri u = Uri.parse(url);
                    String ref = u.getQueryParameter("ref");
                    if (ref != null && !ref.isEmpty()) {
                        filename = "CBEBirr_Official_Receipt_" + ref + ".pdf";
                    }
                } catch (Exception ignored) {}
            }
            request.setTitle(filename);
            request.allowScanningByMediaScanner();
            request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, filename);
            android.app.DownloadManager dm = (android.app.DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (dm != null) {
                dm.enqueue(request);
                Toast.makeText(MainActivity.this, "ደረሰኝ በማውረድ ላይ... (" + filename + ")", Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
            } catch (Exception ignored) {}
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
